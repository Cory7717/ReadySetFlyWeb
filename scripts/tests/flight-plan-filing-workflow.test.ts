import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFilingFieldDiffs,
  buildOtherInfoWithDof,
  formatIcaoDof,
  normalizeRouteForProvider,
} from "../../shared/flight-plan-filing-workflow";

test("same-day filing does not inject DOF", () => {
  const result = buildOtherInfoWithDof({
    existingOtherInfo: "PBN/A1B2 RMK/LOCAL",
    plannedDepartureAt: "2026-04-23T15:30:00.000Z",
    operationalTimeZone: "UTC",
    now: new Date("2026-04-23T12:00:00.000Z"),
  });

  assert.equal(result.injected, false);
  assert.equal(result.dof, null);
  assert.equal(result.otherInfo, "PBN/A1B2 RMK/LOCAL");
});

test("future-dated filing injects DOF in ICAO format", () => {
  const result = buildOtherInfoWithDof({
    existingOtherInfo: "PBN/A1B2",
    plannedDepartureAt: "2026-04-26T15:30:00.000Z",
    operationalTimeZone: "UTC",
    now: new Date("2026-04-23T12:00:00.000Z"),
  });

  assert.equal(formatIcaoDof("2026-04-26T15:30:00.000Z"), "260426");
  assert.equal(result.injected, true);
  assert.equal(result.dof, "260426");
  assert.equal(result.otherInfo, "PBN/A1B2 DOF/260426");
});

test("standard airport-only route preserves tokens without adding DCT wrappers", () => {
  const normalized = normalizeRouteForProvider("KBPG KSRR KINW");
  assert.equal(normalized.localEnteredRoute, "KBPG KSRR KINW");
  assert.equal(normalized.normalizedRoute, "KBPG KSRR KINW");
  assert.equal(normalized.changed, false);
  assert.equal(normalized.hasValidToken, true);
});

test("already normalized route preserves intentional leading and trailing DCT", () => {
  const normalized = normalizeRouteForProvider("DCT KBPG DCT KSRR DCT KINW DCT");
  assert.equal(normalized.normalizedRoute, "DCT KBPG DCT KSRR DCT KINW DCT");
  assert.equal(normalized.changed, false);
});

test("provider route removes departure and destination airport tokens", () => {
  const normalized = normalizeRouteForProvider("DCT KBOS DCT BAF V141 ALB DCT KSEA DCT", {
    departure: "KBOS",
    destination: "KSEA",
  });
  assert.equal(normalized.normalizedRoute, "BAF V141 ALB");
  assert.equal(normalized.changed, true);
  assert.ok(normalized.notes.some((note) => note.includes("removed departure/destination airport tokens")));
});

test("provider route removes endpoint airports and orphaned DCT only", () => {
  const cases = [
    ["KBOS DCT ALB DCT KSEA", "ALB"],
    ["KBOS DCT ALB DCT SYR DCT KSEA", "ALB DCT SYR"],
    ["DCT ALB J60 BOI", "DCT ALB J60 BOI"],
    ["ALB J60 BOI DCT", "ALB J60 BOI DCT"],
    ["DCT", "DCT"],
    ["KBOS DCT KSEA", "DCT"],
    ["ALB DCT DCT SYR", "ALB DCT SYR"],
    ["ALB DCT KBOS DCT SYR DCT KSEA DCT BOI", "ALB DCT KBOS DCT SYR DCT KSEA DCT BOI"],
    ["DALL3 EIC V18 MEI LGC4", "DALL3 EIC V18 MEI LGC4"],
    ["DCT EMI/D01+40 DCT MAPEL/D00+30 V143 DELRO DCT", "DCT EMI/D01+40 DCT MAPEL/D00+30 V143 DELRO DCT"],
  ] as const;

  for (const [input, expected] of cases) {
    const normalized = normalizeRouteForProvider(input, {
      departure: "KBOS",
      destination: "KSEA",
    });
    assert.equal(normalized.normalizedRoute, expected, input);
  }
});

test("direct route validates after duplicate DCT normalization", () => {
  const normalized = normalizeRouteForProvider("DCT DCT");
  assert.equal(normalized.normalizedRoute, "DCT");
  assert.equal(normalized.hasValidToken, true);
  assert.equal(normalized.notes.some((note) => note.includes("Route must contain")), false);
});

test("provider route change diff is detected", () => {
  const diffs = buildFilingFieldDiffs({
    localRoute: "KBPG KSRR KINW",
    transmittedRoute: "DCT KBPG DCT KSRR DCT KINW DCT",
    providerRoute: "DCT KBPG DCT TCC DCT KINW DCT",
    localOtherInfo: "PBN/A1B2",
    transmittedOtherInfo: "PBN/A1B2 DOF/260426",
    providerOtherInfo: "PBN/A1B2 DOF/260426",
    dof: "260426",
  });

  const routeDiff = diffs.find((entry) => entry.field === "route");
  assert.ok(routeDiff);
  assert.equal(routeDiff?.changedForTransmission, true);
  assert.equal(routeDiff?.changedByProvider, true);
});
