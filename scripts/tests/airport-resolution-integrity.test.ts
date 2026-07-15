import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { analyzeFiledRoute } from "../../shared/flight-plan-route";

const serverSource = readFileSync("server/routes.ts", "utf8");
const plannerSource = readFileSync("client/src/pages/flight-planner.tsx", "utf8");

test("airport search merges airport-reference records with weather stations", () => {
  const searchStart = serverSource.indexOf('app.get("/api/airports/search"');
  assert.ok(searchStart > 0, "airport search route exists");
  const searchSource = serverSource.slice(searchStart, serverSource.indexOf('app.get("/api/airports/nearby"', searchStart));

  assert.match(searchSource, /loadStationCache\(\)/);
  assert.match(searchSource, /loadAirportReferenceCache\(\)/);
  assert.match(searchSource, /airportReferenceToSearchResult/);
  assert.match(searchSource, /weatherStationAvailable/);
  assert.match(searchSource, /const cacheKey = `v2:\$\{query\}`/);
  assert.match(searchSource, /identifiers\.some\(\(code\) => code\.toLowerCase\(\) === query\)/);
});

test("airport search preserves non-ICAO FAA identifiers such as 22T", () => {
  assert.match(serverSource, /ident\?: string \| null/);
  assert.match(serverSource, /gpsCode\?: string \| null/);
  assert.match(serverSource, /localCode\?: string \| null/);
  assert.match(serverSource, /displayIdentifier\?: string \| null/);
  assert.match(serverSource, /airportReferenceCodes/);
  assert.match(serverSource, /const selectedCode =/);

  const analysis = analyzeFiledRoute("KARB DCT 22T");
  const tokens = new Map(analysis.tokens.map((token) => [token.token, token.kind]));
  assert.equal(tokens.get("22T"), "airport");
  assert.equal(tokens.has("K22T"), false);
});

test("planner does not K-prefix numeric three-character airport identifiers", () => {
  assert.match(plannerSource, /if \(\/\^\[A-Z\]\{3\}\$\/\.test\(normalized\)\) \{/);
  assert.doesNotMatch(plannerSource, /if \(normalized\.length === 3\) \{\s*candidates\.push\(`K\$\{normalized\}`\)/);
});

test("manual Route Builder geometry waits for canonical endpoints", () => {
  assert.match(plannerSource, /const hasCanonicalRouteEndpoints = Boolean\(planningDepartureCode && planningDestinationCode\)/);
  assert.match(plannerSource, /routeMode === "manual" && hasCanonicalRouteEndpoints && filedRouteResolvedPoints\.length >= 2/);
  assert.match(plannerSource, /Select a departure and destination before building the enroute route/);
  assert.match(plannerSource, /Route Builder text is saved as draft text/);
});
