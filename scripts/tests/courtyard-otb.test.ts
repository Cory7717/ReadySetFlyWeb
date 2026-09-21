import assert from "node:assert/strict";
import test from "node:test";
import { parseCourtyardOtbCsv } from "../../server/courtyardOtb";

const header = "Date,Rms Sold,Group PU,Group UnPU,Occ %,ADR Sold ($),Unused,Rm Rev ($)";
test("Marriott OTB mapping excludes TOTAL and computes monthly values from stay dates", () => {
  const csv = [header, "09/01/2026,100,12,2,50%,100.00,,10000.00", "09/02/2026,50,4,1,25%,110.00,,5500.00", "TOTAL,150,16,3,37.5%,103.33,,15500.00"].join("\n");
  const parsed = parseCourtyardOtbCsv(csv);
  assert.equal(parsed.targetMonth, "2026-09-01");
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.ignoredRows, 1);
  assert.equal(parsed.roomRevenue, 15500);
  assert.equal(parsed.roomsOtb, 150);
  assert.equal(parsed.adr, 103.33);
  assert.equal(parsed.occupancy, 150 / (118 * 30));
  assert.ok(parsed.warnings.some((warning) => warning.includes("2 of 30 stay dates")));
  assert.equal(parsed.groupPu, 16);
  assert.equal(parsed.groupUnpu, 3);
});

test("CSV quoted values and alternate month use deterministic duplicate fingerprint", () => {
  const csv = [header, '10/01/2026,788,0,0,21.84%,134.90,,"106,302.28"', 'TOTAL,788,0,0,21.84%,134.90,,"106,302.28"'].join("\n");
  const parsed = parseCourtyardOtbCsv(csv);
  assert.equal(parsed.targetMonth, "2026-10-01");
  assert.equal(parsed.roomRevenue, 106302.28);
  assert.equal(parsed.roomsOtb, 788);
  assert.equal(parsed.fingerprint, parseCourtyardOtbCsv(csv).fingerprint);
  const later = csv.replace("106,302.28", "106,402.28");
  assert.notEqual(parsed.fingerprint, parseCourtyardOtbCsv(later).fingerprint);
});

test("mixed months and duplicate stay dates are rejected", () => {
  assert.throws(() => parseCourtyardOtbCsv([header, "09/30/2026,10,0,0,10%,100,,1000", "10/01/2026,10,0,0,10%,100,,1000"].join("\n")), /multiple stay months/);
  assert.throws(() => parseCourtyardOtbCsv([header, "09/01/2026,10,0,0,10%,100,,1000", "09/01/2026,10,0,0,10%,100,,1000"].join("\n")), /duplicate stay dates/);
});

test("Marriott two-digit-year dates resolve to the intended month", () => {
  const parsed = parseCourtyardOtbCsv([header, "11/18/26,17,3,0,55%,108.82,,1850.00"].join("\n"));
  assert.equal(parsed.targetMonth, "2026-11-01");
  assert.equal(parsed.rows[0].stayDate, "2026-11-18");
});

test("December occupancy uses all available room-nights, not the average reported daily percentage", () => {
  const parsed = parseCourtyardOtbCsv([header, "12/01/2026,53,0,0,34.23%,95.36,,5054.26"].join("\n"));
  assert.equal(parsed.roomsOtb, 53);
  assert.equal(parsed.occupancy, 53 / (118 * 31));
  assert.ok(parsed.warnings.some((warning) => warning.includes("1 of 31 stay dates")));
  assert.ok(parsed.warnings.some((warning) => warning.includes("Source Occ% averages 34.23%")));
});
