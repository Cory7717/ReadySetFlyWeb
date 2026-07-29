import crypto from "crypto";
import { normalizeSalesMarketSegment } from "./courtyardSalesImport";

export const SALES_ADVISOR_PROMPT_VERSION = "sales-advisor-v2-onsite";
export const SALES_ADVISOR_CALCULATION_VERSION = "sales-advisor-calculation-v1";
export const SALES_ADVISOR_BUSINESS_TYPES = [
  "Groups",
  "Special Corp",
  "Government",
  "Corporate Accounts",
] as const;
export const SALES_ADVISOR_ANALYSIS_TYPES = [
  "recovery",
  "declining",
  "full_plan",
] as const;

const GROUP_SOURCES = new Set([
  "marriott_mint_group_account_tracking",
  "stay_group_summary",
]);
const SPECIAL_SOURCES = new Set([
  "marriott_mint_special_corp_government",
  "stay_reservations_company_names",
]);
const ANALYTICAL_SOURCE = "marriott_mint_analytical_account_tracking";
const periodIndex = (year: number, month: number) => year * 12 + month - 1;
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const number = (value: unknown) => Number(value || 0);
const monthName = (month: number) =>
  new Date(Date.UTC(2020, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    timeZone: "UTC",
  });

export type AdvisorBusinessType = (typeof SALES_ADVISOR_BUSINESS_TYPES)[number];
export type AdvisorAnalysisType = (typeof SALES_ADVISOR_ANALYSIS_TYPES)[number];

export type AdvisorBatch = {
  id: string;
  reportYear: number;
  reportMonth: number;
  sourceReportType: string;
  fileChecksum: string;
  status: string;
};

export type AdvisorProductionRow = {
  importBatchId: string;
  reportYear: number;
  reportMonth: number;
  normalizedAccountKey: string;
  globalUltimateAccountName?: string | null;
  accountName?: string | null;
  marketSegment?: string | null;
  roomNights: unknown;
  roomRevenue: unknown;
};

function businessType(row: AdvisorProductionRow, source: string): AdvisorBusinessType | null {
  const segment = normalizeSalesMarketSegment(row.marketSegment);
  if (GROUP_SOURCES.has(source) || (source === ANALYTICAL_SOURCE && segment === "Group"))
    return "Groups";
  if (SPECIAL_SOURCES.has(source))
    return segment === "Government" ? "Government" : "Special Corp";
  if (source === ANALYTICAL_SOURCE)
    return segment === "Government"
      ? "Government"
      : segment === "Special Corp"
        ? "Special Corp"
        : "Corporate Accounts";
  return null;
}

function productionBasis(source: string): "official" | "observed" | "estimated" {
  if (source === "stay_reservations_company_names") return "estimated";
  if (source === "stay_group_summary") return "observed";
  return "official";
}

function sourcePeriodsForType(
  batches: AdvisorBatch[],
  type: AdvisorBusinessType,
) {
  return new Set(
    batches
      .filter((batch) => {
        if (type === "Groups")
          return GROUP_SOURCES.has(batch.sourceReportType) || batch.sourceReportType === ANALYTICAL_SOURCE;
        if (type === "Special Corp" || type === "Government")
          return SPECIAL_SOURCES.has(batch.sourceReportType) || batch.sourceReportType === ANALYTICAL_SOURCE;
        return batch.sourceReportType === ANALYTICAL_SOURCE;
      })
      .map((batch) => periodIndex(batch.reportYear, batch.reportMonth)),
  );
}

function demandDriver(name: string) {
  const value = name.toLowerCase();
  const match = [
    [/volleyball|soccer|baseball|softball|basketball|tournament|athletic/, "Sports or tournament travel"],
    [/wedding|bride|groom/, "Wedding room block"],
    [/church|ministry|religious/, "Faith-based event travel"],
    [/construction|engineering|electric|roof|plumb/, "Project or crew travel"],
    [/medical|health|hospital|clinic/, "Medical or healthcare travel"],
    [/government|army|navy|air force|military|city of|state of/, "Government or military travel"],
    [/training|conference|meeting|association/, "Meeting or training demand"],
  ].find(([pattern]) => (pattern as RegExp).test(value));
  return match ? String(match[1]) : "Business purpose is not identifiable from the account name";
}

export function buildSalesAdvisorPreview(args: {
  batches: AdvisorBatch[];
  rows: AdvisorProductionRow[];
  lookbackMonths: number;
  businessTypes: AdvisorBusinessType[];
  analysisType: AdvisorAnalysisType;
}) {
  const activeBatches = args.batches.filter((batch) => batch.status === "completed");
  const batchById = new Map(activeBatches.map((batch) => [batch.id, batch]));
  const latestPeriod = activeBatches.length
    ? Math.max(...activeBatches.map((batch) => periodIndex(batch.reportYear, batch.reportMonth)))
    : null;
  const firstPeriod = latestPeriod == null ? null : latestPeriod - args.lookbackMonths + 1;
  const accounts = new Map<string, any>();

  for (const row of args.rows) {
    const batch = batchById.get(row.importBatchId);
    if (!batch || String(row.normalizedAccountKey).startsWith("stay-segment:")) continue;
    const type = businessType(row, batch.sourceReportType);
    const index = periodIndex(row.reportYear, row.reportMonth);
    if (!type || !args.businessTypes.includes(type) || (firstPeriod != null && index < firstPeriod)) continue;
    const key = `${type}:${row.normalizedAccountKey}`;
    const account = accounts.get(key) || {
      key: row.normalizedAccountKey,
      name: row.globalUltimateAccountName || row.accountName || "Unnamed account",
      businessType: type,
      months: new Map<number, { roomNights: number; roomRevenue: number }>(),
      bases: new Set<string>(),
    };
    const month = account.months.get(index) || { roomNights: 0, roomRevenue: 0 };
    month.roomNights += number(row.roomNights);
    month.roomRevenue += number(row.roomRevenue);
    account.months.set(index, month);
    account.bases.add(productionBasis(batch.sourceReportType));
    accounts.set(key, account);
  }

  const candidates = Array.from(accounts.values()).map((account) => {
    const history = Array.from(account.months.entries())
      .map(([index, totals]: any) => ({ index, ...totals }))
      .sort((a, b) => a.index - b.index);
    const positive = history.filter((item) => item.roomNights > 0 || item.roomRevenue > 0);
    const last = positive.at(-1);
    const prior = positive.at(-2);
    const comparablePeriods = sourcePeriodsForType(activeBatches, account.businessType);
    let missingComparableMonths = 0;
    let completeMonthsAfterLast = 0;
    if (last && latestPeriod != null) {
      for (let index = last.index + 1; index <= latestPeriod; index++) {
        if (comparablePeriods.has(index)) completeMonthsAfterLast++;
        else missingComparableMonths++;
      }
    }
    const declinePercent = last && prior && prior.roomRevenue > 0
      ? ((last.roomRevenue - prior.roomRevenue) / prior.roomRevenue) * 100
      : null;
    const totalRoomNights = positive.reduce((sum, item) => sum + item.roomNights, 0);
    const totalRevenue = positive.reduce((sum, item) => sum + item.roomRevenue, 0);
    const producingMonths = positive.length;
    const typicalMonths = Array.from(new Set(positive.map((item) => (item.index % 12) + 1)));
    const recurring = producingMonths >= 2;
    const dataComplete = missingComparableMonths === 0;
    const status = !last
      ? "Insufficient History"
      : dataComplete && completeMonthsAfterLast >= 3
        ? "Recovery Opportunity"
        : declinePercent != null && declinePercent <= -20
          ? "Declining"
          : "Active / Monitor";
    const averagePositiveRevenue = producingMonths ? totalRevenue / producingMonths : 0;
    const confidence = producingMonths >= 3 && dataComplete ? "High" : producingMonths >= 2 ? "Medium" : "Low";
    const recencyMonths = last && latestPeriod != null ? latestPeriod - last.index : null;
    const basis = account.bases.has("estimated")
      ? "estimated"
      : account.bases.has("observed")
        ? "observed"
        : "official";
    return {
      key: account.key,
      name: account.name,
      businessType: account.businessType,
      status,
      productionBasis: basis,
      totalRoomNights: Math.round(totalRoomNights * 10) / 10,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      adr: totalRoomNights > 0 ? Math.round((totalRevenue / totalRoomNights) * 100) / 100 : 0,
      producingMonths,
      recencyMonths,
      recurring,
      typicalMonths,
      typicalMonthLabels: typicalMonths.map(monthName),
      lastProduction: last ? { year: Math.floor(last.index / 12), month: (last.index % 12) + 1 } : null,
      declinePercent: declinePercent == null ? null : Math.round(declinePercent),
      estimatedRecoveryRevenue: Math.round(averagePositiveRevenue),
      confidence,
      dataComplete,
      missingComparableMonths,
      possibleDemandDriver: demandDriver(account.name),
      history: history.map((item) => ({
        year: Math.floor(item.index / 12),
        month: (item.index % 12) + 1,
        roomNights: Math.round(item.roomNights * 10) / 10,
        roomRevenue: Math.round(item.roomRevenue * 100) / 100,
      })),
      scores: { historicalValue: 0, recoverability: 0, timingUrgency: 0, overall: 0 },
    };
  });

  const maxRevenue = Math.max(1, ...candidates.map((item) => item.totalRevenue));
  for (const candidate of candidates) {
    const historicalValue = clamp((Math.log1p(candidate.totalRevenue) / Math.log1p(maxRevenue)) * 100);
    const recoverability = clamp(
      (candidate.recurring ? 35 : 10) + Math.min(candidate.producingMonths * 8, 32) +
        (candidate.confidence === "High" ? 25 : candidate.confidence === "Medium" ? 15 : 5),
    );
    const nextTypicalDistance = latestPeriod == null || !candidate.typicalMonths.length
      ? 12
      : Math.min(...candidate.typicalMonths.map((month: number) => ((month - 1 - (latestPeriod % 12) + 12) % 12)));
    const timingUrgency = clamp(nextTypicalDistance <= 4 ? 100 - nextTypicalDistance * 18 : 20);
    const statusWeight = candidate.status === "Recovery Opportunity" ? 100 : candidate.status === "Declining" ? 80 : 35;
    candidate.scores = {
      historicalValue,
      recoverability,
      timingUrgency,
      overall: clamp(historicalValue * 0.35 + recoverability * 0.3 + timingUrgency * 0.2 + statusWeight * 0.15),
    };
  }
  const filtered = candidates
    .filter((item) =>
      args.analysisType === "recovery"
        ? item.status === "Recovery Opportunity"
        : args.analysisType === "declining"
          ? item.status === "Declining"
          : true,
    )
    .sort((a, b) => b.scores.overall - a.scores.overall);
  const limitations = [];
  if (!filtered.length) limitations.push("No named prospects matched the selected filters and imported reporting window.");
  if (filtered.some((item) => !item.dataComplete)) limitations.push("Missing source months are treated as unknown, never as zero production.");
  if (filtered.some((item) => item.productionBasis === "estimated")) limitations.push("STAY Reservations company revenue is estimated from observed stays and rates.");
  if (activeBatches.length < args.lookbackMonths) limitations.push("The requested lookback exceeds the number of imported source months.");
  return {
    generatedThrough: latestPeriod == null ? null : { year: Math.floor(latestPeriod / 12), month: (latestPeriod % 12) + 1 },
    lookbackMonths: args.lookbackMonths,
    analysisType: args.analysisType,
    businessTypes: args.businessTypes,
    summary: {
      prospectsReviewed: filtered.length,
      recoveryOpportunities: filtered.filter((item) => item.status === "Recovery Opportunity").length,
      decliningAccounts: filtered.filter((item) => item.status === "Declining").length,
      estimatedRecoveryRevenue: filtered.reduce((sum, item) => sum + item.estimatedRecoveryRevenue, 0),
    },
    candidates: filtered.slice(0, 50),
    limitations,
  };
}

export function salesAdvisorFingerprint(
  batches: AdvisorBatch[],
  parameters: Record<string, unknown>,
) {
  const sources = batches
    .filter((batch) => batch.status === "completed")
    .map((batch) => [batch.id, batch.fileChecksum, batch.sourceReportType, batch.reportYear, batch.reportMonth])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ sources, parameters, calculationVersion: SALES_ADVISOR_CALCULATION_VERSION, promptVersion: SALES_ADVISOR_PROMPT_VERSION }))
    .digest("hex");
}

export function compactAdvisorContext(preview: ReturnType<typeof buildSalesAdvisorPreview>) {
  return {
    generatedThrough: preview.generatedThrough,
    lookbackMonths: preview.lookbackMonths,
    analysisType: preview.analysisType,
    businessTypes: preview.businessTypes,
    summary: preview.summary,
    candidates: preview.candidates.slice(0, 20).map(({ history, ...candidate }) => ({
      ...candidate,
      recentHistory: history.slice(-6),
    })),
    limitations: preview.limitations,
  };
}
