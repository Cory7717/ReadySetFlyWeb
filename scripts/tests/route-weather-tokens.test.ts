import test from "node:test";
import assert from "node:assert/strict";
import { buildRouteWeatherIcaoList, filterRouteWeatherTokens } from "../../shared/route-weather-tokens";
import { normalizeRouteForProvider } from "../../shared/flight-plan-filing-workflow";

test("DCT alone produces no route-token weather lookup", () => {
  assert.deepEqual(filterRouteWeatherTokens("DCT"), []);
});

test("DCT KDWH DCT produces only KDWH", () => {
  assert.deepEqual(filterRouteWeatherTokens("DCT KDWH DCT"), ["KDWH"]);
});

test("route weather tokens are deduplicated while preserving order", () => {
  assert.deepEqual(filterRouteWeatherTokens("KEDC DCT KDWH DCT KEDC KBPT KDWH"), ["KEDC", "KDWH", "KBPT"]);
});

test("departure destination and alternate weather checks still happen", () => {
  assert.deepEqual(buildRouteWeatherIcaoList({
    departure: "KEDC",
    destination: "KBPT",
    alternate: "KIAH",
    route: "DCT",
  }), ["KEDC", "KBPT", "KIAH"]);
});

test("route weather list excludes duplicate departure and destination route tokens", () => {
  assert.deepEqual(buildRouteWeatherIcaoList({
    departure: "KEDC",
    destination: "KBPT",
    alternate: null,
    route: "KEDC DCT KDWH DCT KBPT",
  }), ["KEDC", "KDWH", "KBPT"]);
});

test("filing payload route normalization remains unchanged", () => {
  assert.equal(normalizeRouteForProvider("DCT KDWH DCT").normalizedRoute, "DCT KDWH DCT");
});
