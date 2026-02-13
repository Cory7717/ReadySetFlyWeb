import test from "node:test";
import assert from "node:assert/strict";
import { parseWindsAloftReport } from "../../server/services/aviation-weather";

test("winds aloft report parsing extracts metadata and stations", () => {
  const sample = [
    "DATA BASED ON 131200Z",
    "VALID 131800Z",
    "FT  3000 6000 9000 12000 18000",
    "ABI 9900 9900 9900 9900 9900",
    "AUS 9900 9900 9900 9900 9900",
  ].join("\n");

  const report = parseWindsAloftReport(sample);

  assert.equal(report.dataBasedOn, "131200Z");
  assert.equal(report.validTime, "131800Z");
  assert.deepEqual(report.altitudes, [3000, 6000, 9000, 12000, 18000]);
  assert.equal(report.stations.length, 2);

  const abi = report.stations.find((station) => station.stationId === "ABI");
  assert.ok(abi);
  assert.deepEqual(abi?.values[3000], {
    directionDeg: null,
    speedKt: 0,
    tempC: null,
  });
});
