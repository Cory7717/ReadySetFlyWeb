import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSalesAdvisorPreview,
  buildMonthlySalesTargets,
  compactAdvisorContext,
  salesAdvisorFingerprint,
} from "../../server/courtyardSalesAdvisor";

const batch = (id: string, month: number, sourceReportType = "stay_group_summary") => ({
  id,
  reportYear: 2026,
  reportMonth: month,
  sourceReportType,
  fileChecksum: `checksum-${id}`,
  status: "completed",
});
const row = (importBatchId: string, month: number, key: string, name: string, roomNights = 20, roomRevenue = 2000, marketSegment = "Group") => ({
  importBatchId,
  reportYear: 2026,
  reportMonth: month,
  normalizedAccountKey: key,
  accountName: name,
  marketSegment,
  roomNights,
  roomRevenue,
});
const parameters = {
  lookbackMonths: 12,
  businessTypes: ["Groups"] as any,
  analysisType: "full_plan" as const,
};

test("broad STAY segment totals never become named prospects", () => {
  const preview = buildSalesAdvisorPreview({
    batches: [batch("groups", 1), batch("segments", 1, "stay_revenue_by_market_segment_with_groups")],
    rows: [row("groups", 1, "stay-group:acme", "Acme Meeting"), row("segments", 1, "stay-segment:group", "Group", 100, 10000)],
    ...parameters,
  });
  assert.deepEqual(preview.candidates.map((item) => item.name), ["Acme Meeting"]);
});

test("missing source months are unknown and prevent a false recovery label", () => {
  const preview = buildSalesAdvisorPreview({
    batches: [batch("jan", 1), batch("apr", 4)],
    rows: [row("jan", 1, "stay-group:acme", "Acme Meeting")],
    ...parameters,
  });
  assert.equal(preview.candidates[0].status, "Active / Monitor");
  assert.equal(preview.candidates[0].dataComplete, false);
  assert.equal(preview.candidates[0].missingComparableMonths, 2);
  assert.match(preview.limitations.join(" "), /unknown, never as zero/i);
});

test("three imported zero-production months produce a recovery opportunity", () => {
  const preview = buildSalesAdvisorPreview({
    batches: [batch("jan", 1), batch("feb", 2), batch("mar", 3), batch("apr", 4)],
    rows: [row("jan", 1, "stay-group:acme", "Acme Meeting")],
    ...parameters,
  });
  assert.equal(preview.candidates[0].status, "Recovery Opportunity");
  assert.equal(preview.candidates[0].dataComplete, true);
});

test("STAY Reservations revenue remains explicitly estimated", () => {
  const preview = buildSalesAdvisorPreview({
    batches: [batch("reservations", 1, "stay_reservations_company_names")],
    rows: [row("reservations", 1, "stay-company:acme", "Acme Corp", 12, 1440, "Special Corp")],
    lookbackMonths: 12,
    businessTypes: ["Special Corp"],
    analysisType: "full_plan",
  } as any);
  assert.equal(preview.candidates[0].productionBasis, "estimated");
  assert.match(preview.limitations.join(" "), /estimated/i);
});

test("AI context is compact and contains no raw rows or guest PII fields", () => {
  const preview = buildSalesAdvisorPreview({
    batches: [batch("groups", 1)],
    rows: [row("groups", 1, "stay-group:acme", "Acme Meeting")],
    ...parameters,
  });
  const context = compactAdvisorContext(preview);
  const serialized = JSON.stringify(context);
  assert.doesNotMatch(serialized, /rawPayload|guestName|email|phone/i);
  assert.equal((context.candidates[0] as any).history, undefined);
});

test("cache fingerprint changes with source data and filter parameters", () => {
  const first = salesAdvisorFingerprint([batch("jan", 1)], parameters);
  const changedSource = salesAdvisorFingerprint([{ ...batch("jan", 1), fileChecksum: "new" }], parameters);
  const changedFilter = salesAdvisorFingerprint([batch("jan", 1)], { ...parameters, lookbackMonths: 24 });
  assert.notEqual(first, changedSource);
  assert.notEqual(first, changedFilter);
});

test("monthly targets grow prior-year Group and Special Corp rooms and revenue", () => {
  const batches = [
    { ...batch("aug-2025", 8, "marriott_mint_all_market_segments"), reportYear: 2025 },
  ];
  const rows = [
    { ...row("aug-2025", 8, "mint-segment:group", "Group", 240, 28800, "Group"), reportYear: 2025 },
    { ...row("aug-2025", 8, "mint-segment:special", "Special Corp", 180, 21600, "Special Corp"), reportYear: 2025 },
  ];
  const plan = buildMonthlySalesTargets({ batches, rows, targetYear: 2026, targetMonth: 8 } as any);
  const group = plan.segments.find((item) => item.segment === "Group")!;
  const special = plan.segments.find((item) => item.segment === "Special Corp")!;
  assert.equal(group.baseline.roomNights, 240);
  assert.ok(group.recommended.roomNights > 240);
  assert.ok(group.recommended.revenue > 28800);
  assert.ok(special.recommended.roomNights > 180);
  assert.ok(special.recommended.revenue > 21600);
});

test("named-account estimates support prospecting but never change official target baseline", () => {
  const batches = [
    { ...batch("official", 8, "marriott_mint_all_market_segments"), reportYear: 2025 },
    { ...batch("named", 8, "stay_group_summary"), reportYear: 2025 },
  ];
  const rows = [
    { ...row("official", 8, "segment:group", "Group", 100, 10000, "Group"), reportYear: 2025 },
    { ...row("official", 8, "segment:special", "Special Corp", 50, 5000, "Special Corp"), reportYear: 2025 },
    { ...row("named", 8, "stay-group:large", "Large Named Group", 999, 999999, "Group"), reportYear: 2025 },
  ];
  const plan = buildMonthlySalesTargets({ batches, rows, targetYear: 2026, targetMonth: 8 } as any);
  const group = plan.segments.find((item) => item.segment === "Group")!;
  assert.equal(group.baseline.roomNights, 100);
  assert.equal(group.baseline.revenue, 10000);
  assert.equal(group.namedProspects[0].name, "Large Named Group");
});

test("monthly target progress uses authoritative actual production when loaded", () => {
  const batches = [
    { ...batch("prior", 8, "marriott_mint_all_market_segments"), reportYear: 2025 },
    { ...batch("actual", 8, "stay_revenue_by_market_segment_with_groups"), reportYear: 2026 },
  ];
  const rows = [
    { ...row("prior", 8, "segment:group", "Group", 100, 10000, "Group"), reportYear: 2025 },
    { ...row("prior", 8, "segment:special", "Special Corp", 50, 5000, "Special Corp"), reportYear: 2025 },
    { ...row("actual", 8, "stay-segment:group", "Group", 60, 6600, "Group"), reportYear: 2026 },
    { ...row("actual", 8, "stay-segment:special", "Special Corp", 20, 2200, "Special Corp"), reportYear: 2026 },
  ];
  const plan = buildMonthlySalesTargets({ batches, rows, targetYear: 2026, targetMonth: 8 } as any);
  const group = plan.segments.find((item) => item.segment === "Group")!;
  assert.equal(group.actual?.roomNights, 60);
  assert.equal(group.actual?.revenue, 6600);
  assert.ok(Number(group.actual?.roomNightsAttainmentPercent) > 0);
});
