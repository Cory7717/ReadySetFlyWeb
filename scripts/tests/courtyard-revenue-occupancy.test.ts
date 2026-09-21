import assert from "node:assert/strict";
import test from "node:test";
import { daysInTargetMonth, effectiveSnapshotOccupancy, monthlyOtbOccupancy } from "../../server/courtyardRevenueOccupancy";

test("monthly OTB occupancy uses calendar days, including leap-year February", () => {
  assert.equal(daysInTargetMonth("2026-12-01"), 31);
  assert.equal(daysInTargetMonth("2028-02-01"), 29);
  assert.equal(monthlyOtbOccupancy(53, "2026-12-01"), 53 / (118 * 31));
  assert.equal(monthlyOtbOccupancy(0, "2026-12-01"), 0);
  assert.equal(monthlyOtbOccupancy(null, "2026-12-01"), null);
});

test("existing detailed snapshots are corrected while aggregate-only snapshots are unchanged", () => {
  const snapshot = { targetMonth: "2026-12-01", roomsOtb: 53, occupancy: "0.34230" };
  assert.equal(effectiveSnapshotOccupancy({ ...snapshot, detailAvailable: true }), 53 / (118 * 31));
  assert.equal(effectiveSnapshotOccupancy({ ...snapshot, detailAvailable: false }), "0.34230");
});
