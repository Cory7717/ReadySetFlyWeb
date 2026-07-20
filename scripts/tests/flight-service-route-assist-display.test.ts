import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  classifyLeidosRouteSearchResult,
  isLikelyUnsupportedOceanicRouteAssistPair,
  selectLeidosRouteSearchRequest,
  selectLeidosRouteSearchPathOption,
  LEIDOS_ROUTE_SEARCH_OPTION_J_ROUTE,
  LEIDOS_ROUTE_SEARCH_OPTION_Q_ROUTE,
} from "../../server/services/flight-plan-filing/provider";

const plannerSource = readFileSync("client/src/pages/flight-planner.tsx", "utf8");
const providerSource = readFileSync("server/services/flight-plan-filing/provider.ts", "utf8");

test("Route Assist provider response normalization extracts route strings from objects", () => {
  assert.match(providerSource, /const asRouteStringArray = \(value: unknown\) =>/);
  assert.match(providerSource, /\.map\(\(item\) => extractNestedRouteString\(item\)/);
  assert.match(providerSource, /const route = extractNestedRouteString\(parsed\.route\) \|\| null/);
  assert.match(providerSource, /route,\s*\n\s*atcRecentIFRRoutes,/);
  assert.doesNotMatch(providerSource, /String\(item \|\| ""\)\.trim\(\)/);
});

test("Route Assist request includes documented SearchPathOptionType only for low-altitude routing", () => {
  assert.match(providerSource, /LEIDOS_ROUTE_SEARCH_OPTION_SYSTEM_RECOMMENDED = "SYSTEM_RECOMMENDED"/);
  assert.match(providerSource, /LEIDOS_ROUTE_SEARCH_PATH_OPTION_LOW_ALTITUDE_ONLY = "LOW_ALTITUDE_ONLY"/);
  assert.equal(selectLeidosRouteSearchPathOption(9000), "LOW_ALTITUDE_ONLY");
  assert.equal(selectLeidosRouteSearchPathOption(17999), "LOW_ALTITUDE_ONLY");
  assert.equal(selectLeidosRouteSearchPathOption(18000), null);
  assert.equal(selectLeidosRouteSearchPathOption(23000), null);
  assert.match(providerSource, /url\.searchParams\.set\("searchOption", String\(searchOption\)\)/);
  assert.match(providerSource, /if \(searchPathOption\) \{\s*url\.searchParams\.set\("searchPathOption", searchPathOption\);/);
  assert.doesNotMatch(providerSource, /const searchOption = LEIDOS_ROUTE_SEARCH_OPTION_SYSTEM_RECOMMENDED;[\s\S]{0,200}if \(searchPathOption\)/);
});

test("Route Assist request plan never dispatches SYSTEM_RECOMMENDED without LOW_ALTITUDE_ONLY", () => {
  assert.deepEqual(selectLeidosRouteSearchRequest({ altitudeFt: 9000 }), {
    dispatchable: true,
    searchOption: "SYSTEM_RECOMMENDED",
    searchPathOption: "LOW_ALTITUDE_ONLY",
    reason: "low_altitude_system_recommended",
    message: null,
  });
  assert.equal(selectLeidosRouteSearchRequest({ altitudeFt: 17999 }).dispatchable, true);
  const atFloor = selectLeidosRouteSearchRequest({ altitudeFt: 18000 });
  assert.equal(atFloor.dispatchable, false);
  assert.equal(atFloor.reason, "high_altitude_route_family_required");
  const high = selectLeidosRouteSearchRequest({ altitudeFt: 23000 });
  assert.equal(high.dispatchable, false);
  assert.equal(high.searchOption, null);
  assert.equal(high.searchPathOption, null);
  const missing = selectLeidosRouteSearchRequest({ altitudeFt: null });
  assert.equal(missing.dispatchable, false);
  assert.equal(missing.reason, "missing_or_invalid_altitude");
  const invalid = selectLeidosRouteSearchRequest({ altitudeFt: Number.NaN });
  assert.equal(invalid.dispatchable, false);
  assert.equal(invalid.reason, "missing_or_invalid_altitude");
});

test("Route Assist supports only explicit documented high-altitude route families", () => {
  assert.deepEqual(selectLeidosRouteSearchRequest({ altitudeFt: 23000, explicitSearchOption: LEIDOS_ROUTE_SEARCH_OPTION_J_ROUTE }), {
    dispatchable: true,
    searchOption: "J_ROUTE",
    searchPathOption: null,
    reason: "explicit_high_altitude_route_family",
    message: null,
  });
  assert.deepEqual(selectLeidosRouteSearchRequest({ altitudeFt: 23000, explicitSearchOption: LEIDOS_ROUTE_SEARCH_OPTION_Q_ROUTE }), {
    dispatchable: true,
    searchOption: "Q_ROUTE",
    searchPathOption: null,
    reason: "explicit_high_altitude_route_family",
    message: null,
  });
  assert.equal(selectLeidosRouteSearchRequest({ altitudeFt: 23000, explicitSearchOption: "GPS_DIRECT" }).dispatchable, false);
  assert.match(providerSource, /LEIDOS_ROUTE_ASSIST_HIGH_ALTITUDE_UNAVAILABLE_MESSAGE/);
});

test("Route Assist skips obvious oceanic pairs before domestic provider routeSearch", () => {
  assert.equal(isLikelyUnsupportedOceanicRouteAssistPair("KLAS", "PHNL"), true);
  assert.equal(isLikelyUnsupportedOceanicRouteAssistPair("PHNL", "KLAS"), true);
  assert.equal(isLikelyUnsupportedOceanicRouteAssistPair("KEDC", "KDTO"), false);
  assert.match(providerSource, /event: "flight_route_assist_skipped"/);
  assert.match(providerSource, /unsupported_oceanic_route_assist_pair/);
});

test("Route Assist diagnostics preserve provider messages without exposing credentials", () => {
  assert.match(providerSource, /event: "flight_route_assist_provider_response"/);
  assert.match(providerSource, /providerResponseMessages/);
  assert.match(providerSource, /const providerEndpoint = safeProviderEndpointForLog\(url\.toString\(\)\)/);
  assert.match(providerSource, /providerReturnStatus/);
  assert.doesNotMatch(providerSource, /event: "flight_route_assist_provider_response"[\s\S]{0,600}Authorization/);
});

test("Route Assist panel renders normalized route strings instead of raw objects", () => {
  assert.match(plannerSource, /const normalizeRouteAssistText = \(value: unknown, keys: string\[\], depth = 0\): string \| null =>/);
  assert.match(plannerSource, /return text && text !== "\[object Object\]" \? text : null/);
  assert.match(plannerSource, /const routeAssistRecommendedRoute = useMemo/);
  assert.match(plannerSource, /const routeAssistGroups = useMemo/);
  assert.match(plannerSource, /routeAssistGroups\.map\(\(group\) =>/);
  assert.match(plannerSource, /setRouteOptionPreview\(routeAssistRecommendedRoute\)/);
  assert.match(plannerSource, /Apply previewed route/);
  assert.match(plannerSource, /applyFiledRouteToPlanner\(routeOptionPreview\)/);
  assert.match(plannerSource, /No Route Assist suggestions came back for this city pair yet/);
  assert.doesNotMatch(plannerSource, /\{leidosRouteQuery\.data\.route\}/);
  assert.doesNotMatch(plannerSource, /\{leidosRouteQuery\.data\.message\}/);
  assert.doesNotMatch(plannerSource, /leidosRouteQuery\.data\.warnings\.join\(" "\)/);
});

test("Route Assist separates provider errors from successful empty results", () => {
  assert.match(plannerSource, /ROUTE_ASSIST_UNAVAILABLE_MESSAGE = "Route Assist could not retrieve a suggested route\. You can continue with a custom route or try again\."/);
  assert.deepEqual(classifyLeidosRouteSearchResult({ providerReturnStatus: false, hasSuggestions: false }), {
    available: false,
    message: "Leidos could not find a route for the selected altitude and routing type.",
  });
  assert.deepEqual(classifyLeidosRouteSearchResult({ providerReturnStatus: false, hasSuggestions: true }), {
    available: false,
    message: "Leidos could not find a route for the selected altitude and routing type.",
  });
  assert.deepEqual(classifyLeidosRouteSearchResult({ providerReturnStatus: true, hasSuggestions: false }), {
    available: true,
    message: null,
  });
  assert.match(plannerSource, /leidosRouteQuery\.data\?\.available === false[\s\S]{0,120}ROUTE_ASSIST_UNAVAILABLE_MESSAGE/);
  assert.match(plannerSource, /!leidosRouteQuery\.error[\s\S]{0,160}leidosRouteQuery\.data\?\.available !== false[\s\S]{0,160}!routeAssistHasSuggestions/);
  assert.match(plannerSource, /No Route Assist suggestions came back for this city pair yet/);
  assert.doesNotMatch(plannerSource, /Missing value for SearchPathOptionType/);
});

test("Route Assist waits for current planner inputs and rejects stale responses", () => {
  assert.match(plannerSource, /type LeidosRouteSearchInput =/);
  assert.match(plannerSource, /const leidosRouteSearchInput = useMemo<LeidosRouteSearchInput \| null>/);
  assert.match(plannerSource, /setStableLeidosRouteSearchInput\(null\)/);
  assert.match(plannerSource, /window\.setTimeout\(\(\) => \{\s*setStableLeidosRouteSearchInput\(leidosRouteSearchInput\);/);
  assert.match(plannerSource, /queryClient\.cancelQueries\(\{ queryKey: \["\/api\/flight-plans\/route-search"\] \}\)/);
  assert.match(plannerSource, /signal,/);
  assert.match(plannerSource, /responseDeparture !== stableLeidosRouteSearchInput\.departure/);
  assert.match(plannerSource, /responseDestination !== stableLeidosRouteSearchInput\.destination/);
});
