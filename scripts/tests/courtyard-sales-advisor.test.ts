import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSalesAdvisorPreview,
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
