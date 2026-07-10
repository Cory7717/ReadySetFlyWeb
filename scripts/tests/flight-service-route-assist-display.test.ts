import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const plannerSource = readFileSync("client/src/pages/flight-planner.tsx", "utf8");
const providerSource = readFileSync("server/services/flight-plan-filing/provider.ts", "utf8");

test("Route Assist provider response normalization extracts route strings from objects", () => {
  assert.match(providerSource, /const asRouteStringArray = \(value: unknown\) =>/);
  assert.match(providerSource, /\.map\(\(item\) => extractNestedRouteString\(item\)/);
  assert.match(providerSource, /route: extractNestedRouteString\(parsed\.route\) \|\| null/);
  assert.doesNotMatch(providerSource, /String\(item \|\| ""\)\.trim\(\)/);
});

test("Route Assist panel renders normalized route strings instead of raw objects", () => {
  assert.match(plannerSource, /const normalizeRouteAssistText = \(value: unknown, keys: string\[\], depth = 0\): string \| null =>/);
  assert.match(plannerSource, /return text && text !== "\[object Object\]" \? text : null/);
  assert.match(plannerSource, /const routeAssistRecommendedRoute = useMemo/);
  assert.match(plannerSource, /const routeAssistGroups = useMemo/);
  assert.match(plannerSource, /routeAssistGroups\.map\(\(group\) =>/);
  assert.match(plannerSource, /applyFiledRouteToPlanner\(routeAssistRecommendedRoute\)/);
  assert.match(plannerSource, /No Route Assist suggestions came back for this city pair yet/);
  assert.doesNotMatch(plannerSource, /\{leidosRouteQuery\.data\.route\}/);
  assert.doesNotMatch(plannerSource, /\{leidosRouteQuery\.data\.message\}/);
  assert.doesNotMatch(plannerSource, /leidosRouteQuery\.data\.warnings\.join\(" "\)/);
});
