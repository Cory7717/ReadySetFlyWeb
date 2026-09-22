import assert from "node:assert/strict";
import test from "node:test";
import { isExactDuplicateRequest, requestRangesOverlap, requestTimeWindowsOverlap } from "../../server/scheduleRequestConflicts";

test("same date AM and PM requests do not conflict when shifts do not overlap", () => {
  const am = { requestDate: "2026-09-25", requestEndDate: "2026-09-25", startTime: "07:00", endTime: "15:00" };
  const pm = { requestDate: "2026-09-25", requestEndDate: "2026-09-25", startTime: "15:00", endTime: "23:00" };
  assert.equal(requestRangesOverlap(am, pm), true);
  assert.equal(requestTimeWindowsOverlap(am, pm), false);
});

test("Bistro AM and Bistro PM use their configured time windows", () => {
  const bistroAm = { requestDate: "2026-09-25", startTime: "06:00", endTime: "14:00" };
  const bistroPm = { requestDate: "2026-09-25", startTime: "14:00", endTime: "22:00" };
  assert.equal(requestTimeWindowsOverlap(bistroAm, bistroPm), false);
});

test("overlapping shifts and full-day requests produce a coverage warning", () => {
  const am = { startTime: "07:00", endTime: "15:00" };
  assert.equal(requestTimeWindowsOverlap(am, { startTime: "14:00", endTime: "22:00" }), true);
  assert.equal(requestTimeWindowsOverlap(am, { startTime: null, endTime: null }), true);
});

test("overnight request windows compare correctly", () => {
  const overnight = { startTime: "23:00", endTime: "07:00" };
  assert.equal(requestTimeWindowsOverlap(overnight, { startTime: "06:00", endTime: "08:00" }), true);
  assert.equal(requestTimeWindowsOverlap(overnight, { startTime: "15:00", endTime: "22:00" }), false);
});

test("an associate cannot create the same active request repeatedly", () => {
  const existing = { requesterUserId: "avery", requestDate: "2026-09-25", requestEndDate: "2026-09-25", requestType: "time_off", startTime: "15:00", endTime: "23:00" };
  assert.equal(isExactDuplicateRequest(existing, { ...existing }), true);
  assert.equal(isExactDuplicateRequest(existing, { ...existing, requesterUserId: "lauren" }), false);
  assert.equal(isExactDuplicateRequest(existing, { ...existing, startTime: "07:00", endTime: "15:00" }), false);
});
