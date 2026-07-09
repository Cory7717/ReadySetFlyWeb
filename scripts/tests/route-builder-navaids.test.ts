import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { analyzeFiledRoute, normalizeRouteText } from "../../shared/flight-plan-route";
import { normalizeRouteForProvider } from "../../shared/flight-plan-filing-workflow";

const acceptanceRoute = "KEDC DCT CWK DCT SAT DCT AUS DCT ACT DCT MQP DCT KDTO";
const mullanPassRoute = "KEDC DCT MLP DCT KDTO";
const routesSource = readFileSync("server/routes.ts", "utf8");
const flightPlannerSource = readFileSync("client/src/pages/flight-planner.tsx", "utf8");

test("Route Builder classifies and preserves MQP as a navaid token", () => {
  const analysis = analyzeFiledRoute(acceptanceRoute);
  assert.equal(analysis.normalizedRoute, acceptanceRoute);

  const tokens = new Map(analysis.tokens.map((token) => [token.token, token.kind]));
  for (const ident of ["CWK", "SAT", "AUS", "ACT", "MQP"]) {
    assert.equal(tokens.get(ident), "navaid", `${ident} should be classified as a navaid`);
  }
  assert.equal(tokens.get("KEDC"), "airport");
  assert.equal(tokens.get("KDTO"), "airport");
  assert.equal(
    analysis.warnings.some((warning) => warning.includes("RSF maps resolved airports and navaids")),
    true,
  );
});

test("provider route normalization keeps MQP in the filed route", () => {
  const normalized = normalizeRouteForProvider(acceptanceRoute);
  assert.equal(normalized.localEnteredRoute, acceptanceRoute);
  const providerRoute = normalizeRouteText(normalized.normalizedRoute || "");
  for (const ident of ["CWK", "SAT", "AUS", "ACT", "MQP"]) {
    assert.equal(providerRoute.includes(ident), true, `${ident} should remain in the provider route`);
  }
});

test("Route Builder classifies and preserves MLP as a navaid token without airport prefixing", () => {
  const analysis = analyzeFiledRoute(mullanPassRoute);
  assert.equal(analysis.normalizedRoute, mullanPassRoute);

  const tokens = new Map(analysis.tokens.map((token) => [token.token, token.kind]));
  assert.equal(tokens.get("MLP"), "navaid");
  assert.equal(tokens.has("KMLP"), false);

  const normalized = normalizeRouteForProvider(mullanPassRoute);
  assert.equal(normalized.localEnteredRoute, mullanPassRoute);
  const providerRoute = normalizeRouteText(normalized.normalizedRoute || "");
  assert.equal(providerRoute.includes("MLP"), true);
  assert.equal(providerRoute.includes("KMLP"), false);
});

test("route analysis resolves navaids for map geometry and reports unknown waypoints", () => {
  assert.match(routesSource, /NAVAIDS_CACHE_URL/);
  assert.match(routesSource, /loadNavaidCache/);
  assert.match(routesSource, /routePoints/);
  assert.match(routesSource, /navaidMap\?\.get\(token\.token\)/);
  assert.match(routesSource, /Unknown waypoint:/);
});

test("Flight Planner consumes resolved route points for manual Route Builder map geometry", () => {
  assert.match(flightPlannerSource, /filedRouteResolvedPoints/);
  assert.match(flightPlannerSource, /routeMode === "manual" && filedRouteResolvedPoints\.length >= 2/);
  assert.match(flightPlannerSource, /Route points resolved for map geometry/);
});

test("Flight Planner does not send navaid route-assist waypoints to airport detail lookups", () => {
  assert.match(flightPlannerSource, /routeAssistAnalysisInput/);
  assert.match(flightPlannerSource, /routeAssistAnalysisQuery/);
  assert.match(flightPlannerSource, /routeAssistAirportTokens/);
  assert.match(flightPlannerSource, /filter\(isConfirmedAirportRoutePoint\)/);
  assert.match(flightPlannerSource, /return waypoints\.filter\(\(token\) => token\.length === 4 && ICAO_REGEX\.test\(token\)\)/);
  assert.match(flightPlannerSource, /return \[\.\.\.plannedStops, \.\.\.routeAssistAirportTokens\]/);
  assert.match(flightPlannerSource, /waypoints\.length > 0 && routeAssistResolvedPoints\.length >= 2/);
});
