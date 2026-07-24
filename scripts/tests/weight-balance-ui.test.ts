import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/weight-balance.tsx", "utf8");

test("weight balance page exposes dedicated profile and scenario workflow", () => {
  assert.match(source, /Calculate Load/);
  assert.match(source, /Edit Aircraft Profile/);
  assert.match(source, /Load Sheet/);
  assert.match(source, /Phase Results/);
  assert.match(source, /CG Envelope/);
});

test("weight balance page includes aircraft library import without changing planner filing", () => {
  assert.match(source, /Import From Aircraft Library/);
  assert.match(source, /profileFromAircraft/);
  assert.doesNotMatch(source, /leidos/i);
  assert.doesNotMatch(source, /flight service/i);
});

test("weight balance page supports local export import and print", () => {
  assert.match(source, /Show Export JSON/);
  assert.match(source, /Import JSON/);
  assert.match(source, /window\.print/);
});
