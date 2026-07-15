import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const plannerSource = readFileSync("client/src/pages/flight-planner.tsx", "utf8");
const providerSource = readFileSync("server/services/flight-plan-filing/provider.ts", "utf8");

test("Route Assist provider response normalization extracts route strings from objects", () => {
  assert.match(providerSource, /const asRouteStringArray = \(value: unknown\) =>/);
  assert.match(providerSource, /\.map\(\(item\) => extractNestedRouteString\(item\)/);
  assert.match(providerSource, /const route = extractNestedRouteString\(parsed\.route\) \|\| null/);
  assert.match(providerSource, /route,\s*\n\s*atcRecentIFRRoutes,/);
  assert.doesNotMatch(providerSource, /String\(item \|\| ""\)\.trim\(\)/);
});

test("Route Assist request includes documented SearchPathOptionType", () => {
  assert.match(providerSource, /LEIDOS_ROUTE_SEARCH_OPTION_SYSTEM_RECOMMENDED = "SYSTEM_RECOMMENDED"/);
  assert.match(providerSource, /LEIDOS_ROUTE_SEARCH_PATH_OPTION_LOW_ALTITUDE_ONLY = "LOW_ALTITUDE_ONLY"/);
  assert.match(providerSource, /url\.searchParams\.set\("searchOption", searchOption\)/);
  assert.match(providerSource, /url\.searchParams\.set\("searchPathOption", searchPathOption\)/);
  assert.doesNotMatch(providerSource, /if \(altitudeFt[\s\S]{0,180}searchPathOption/);
});

test("Route Assist diagnostics preserve provider messages without exposing credentials", () => {
  assert.match(providerSource, /event: "flight_route_assist_provider_response"/);
  assert.match(providerSource, /providerResponseMessages/);
  assert.match(providerSource, /providerEndpoint: `\$\{url\.origin\}\$\{url\.pathname\}`/);
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
  assert.match(plannerSource, /leidosRouteQuery\.data\?\.available === false[\s\S]{0,120}ROUTE_ASSIST_UNAVAILABLE_MESSAGE/);
  assert.match(plannerSource, /!leidosRouteQuery\.error[\s\S]{0,160}leidosRouteQuery\.data\?\.available !== false[\s\S]{0,160}!routeAssistHasSuggestions/);
  assert.match(plannerSource, /No Route Assist suggestions came back for this city pair yet/);
  assert.doesNotMatch(plannerSource, /Missing value for SearchPathOptionType/);
});
