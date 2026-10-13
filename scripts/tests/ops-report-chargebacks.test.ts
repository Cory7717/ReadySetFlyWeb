import assert from "node:assert/strict";
import test from "node:test";
import { collectOpenChargebacks } from "../../server/services/opsReportChargebacks";

test("carries review and pending challenged chargebacks from prior weeks", () => {
  const rows = collectOpenChargebacks([
    {
      weekStart: "2026-09-21",
      payloadJson: { chargebacks: [
        { guest: "Ada Guest", caseId: "CB-1", amount: "$100.00", decision: "review", outcome: "pending" },
        { guest: "Ben Guest", caseId: "CB-2", amount: "80", decision: "challenged", outcome: "pending" },
      ] },
    },
  ]);
  assert.deepEqual(rows.map((row) => row.caseId), ["CB-1", "CB-2"]);
  assert.equal(rows[0].originWeekStart, "2026-09-21");
  assert.equal(rows[0].carriedFromWeekStart, "2026-09-21");
});

test("does not carry accepted, won, or lost chargebacks", () => {
  const rows = collectOpenChargebacks([
    {
      weekStart: "2026-09-21",
      payloadJson: { chargebacks: [
        { guest: "Accepted", caseId: "CB-1", amount: "10", decision: "accepted", outcome: "n/a" },
        { guest: "Won", caseId: "CB-2", amount: "20", decision: "challenged", outcome: "won" },
        { guest: "Lost", caseId: "CB-3", amount: "30", decision: "challenged", outcome: "lost" },
      ] },
    },
  ]);
  assert.deepEqual(rows, []);
});

test("uses the newest weekly state and does not resurrect a resolved dispute", () => {
  const rows = collectOpenChargebacks([
    {
      weekStart: "2026-09-14",
      payloadJson: { chargebacks: [{ guest: "Ada Guest", caseId: "CB-1", amount: "100", decision: "review", outcome: "pending" }] },
    },
    {
      weekStart: "2026-09-21",
      payloadJson: { chargebacks: [{ guest: "Ada Guest", caseId: "cb-1", amount: "$100.00", decision: "challenged", outcome: "won" }] },
    },
  ]);
  assert.deepEqual(rows, []);
});

test("deduplicates legacy rows without a case ID across carried weeks", () => {
  const rows = collectOpenChargebacks([
    {
      weekStart: "2026-09-14",
      payloadJson: { chargebacks: [{ guest: "Ada Guest", reason: "No show", amount: "$75.00", responseDue: "2026-09-30", decision: "review" }] },
    },
    {
      weekStart: "2026-09-21",
      payloadJson: { chargebacks: [{ guest: "Ada Guest", reason: "No show", amount: "75", responseDue: "2026-09-30", decision: "challenged", outcome: "pending" }] },
    },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].decision, "challenged");
  assert.equal(rows[0].carriedFromWeekStart, "2026-09-21");
  assert.match(String(rows[0].trackingId), /^legacy:/);
});
