import assert from "node:assert/strict";
import test from "node:test";
import { pickupWatchDates, substantialRoomPickup } from "../../server/courtyardRevenuePickup";

test("substantial room pickup means strictly more than seven rooms", () => {
  assert.equal(substantialRoomPickup(7), false);
  assert.equal(substantialRoomPickup(8), true);
  assert.equal(substantialRoomPickup(12), true);
  assert.equal(substantialRoomPickup(0), false);
  assert.equal(substantialRoomPickup(-4), false);
  assert.equal(substantialRoomPickup(undefined), false);
});

test("watchlist includes only comparable stay dates and sorts biggest pickup first", () => {
  const rows = [
    { stayDate: "2026-10-01", comparable: true, roomDelta: 8 },
    { stayDate: "2026-10-02", comparable: true, roomDelta: 7 },
    { stayDate: "2026-10-03", comparable: false, roomDelta: 20 },
    { stayDate: "2026-10-04", comparable: true, roomDelta: 12 },
  ];
  assert.deepEqual(pickupWatchDates(rows).map((row) => row.stayDate), ["2026-10-04", "2026-10-01"]);
  assert.equal(rows[0].stayDate, "2026-10-01", "source order is preserved");
});
