import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../../mobile/src/screens/FlightPlannerScreen.tsx", import.meta.url),
  "utf8",
);

test("mobile Flight Planner carries optional runway reference provenance without changing the legacy payload contract", () => {
  assert.match(source, /referenceData\?:\s*\{/);
  assert.match(source, /stale\?: boolean/);
  assert.match(source, /cacheStatus\?: 'fresh' \| 'stale' \| 'expired' \| 'empty'/);
});

test("mobile Flight Planner visibly distinguishes stale runway reference data", () => {
  assert.match(source, /STALE REFERENCE - VERIFY/);
  assert.match(source, /sourceLabel:\s*briefing\?\.referenceData\?\.stale/);
  assert.match(source, /Cached runway reference data is in use for/);
  assert.match(source, /selectedDiversionBriefing\?\.referenceData\?\.stale/);
  assert.doesNotMatch(
    source,
    /sourceLabel:\s*briefing\?\.advisory \|\| briefing\?\.runwayInUse \? 'briefing live'/,
  );
});
