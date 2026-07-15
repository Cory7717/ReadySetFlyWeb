import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { normalizeRouteForProvider } from "../../shared/flight-plan-filing-workflow";
import { composePlanningGeometryRoute } from "../../shared/flight-plan-planning-route";
import { parseFiledRouteTokens } from "../../shared/flight-plan-route";

const flightPlannerSource = readFileSync("client/src/pages/flight-planner.tsx", "utf8");

const tokenList = (route: string) =>
  parseFiledRouteTokens(route)
    .filter((token) => token.token !== "DCT")
    .map((token) => token.token);

test("planning geometry restores endpoints while provider route stays endpoint-free", () => {
  const providerRoute = normalizeRouteForProvider("ALB DCT SYR DCT BOI", {
    departure: "KBOS",
    destination: "KSEA",
  }).normalizedRoute;
  const planningGeometry = composePlanningGeometryRoute({
    departure: "KBOS",
    route: providerRoute,
    destination: "KSEA",
  });

  assert.equal(providerRoute, "ALB DCT SYR DCT BOI");
  assert.deepEqual(tokenList(planningGeometry), ["KBOS", "ALB", "SYR", "BOI", "KSEA"]);
});

test("planning geometry does not duplicate endpoints already in the user route", () => {
  const planningGeometry = composePlanningGeometryRoute({
    departure: "KBOS",
    route: "KBOS DCT ALB DCT KSEA",
    destination: "KSEA",
  });

  assert.deepEqual(tokenList(planningGeometry), ["KBOS", "ALB", "KSEA"]);
});

test("direct route planning geometry connects departure to destination", () => {
  const planningGeometry = composePlanningGeometryRoute({
    departure: "KBOS",
    route: "DCT",
    destination: "KSEA",
  });

  assert.deepEqual(tokenList(planningGeometry), ["KBOS", "KSEA"]);
});

test("single enroute fix planning geometry includes both endpoint legs", () => {
  const planningGeometry = composePlanningGeometryRoute({
    departure: "KBOS",
    route: "ALB",
    destination: "KSEA",
  });

  assert.deepEqual(tokenList(planningGeometry), ["KBOS", "ALB", "KSEA"]);
});

test("Flight Planner route-analysis query uses planning geometry route, not provider route", () => {
  assert.match(flightPlannerSource, /planningGeometryRouteInput/);
  assert.match(flightPlannerSource, /queryKey:\s*\["\/api\/flight-plans\/route-analysis",\s*"planning-geometry",\s*planningGeometryRouteInput\]/);
  assert.match(flightPlannerSource, /route:\s*planningGeometryRouteInput/);
  assert.match(flightPlannerSource, /event:\s*"flight_planner_route_geometry_debug"/);
});

test("Flight Planner Direct mode route points are endpoint-only and ignore stale helpers", () => {
  assert.match(flightPlannerSource, /const suggestedWaypoint = useMemo\(\(\) => \{\s*if \(routeMode !== "auto"\) return null;/);
  assert.match(flightPlannerSource, /const routePoints: PlannerPoint\[\] = useMemo\(\(\) => \{\s*if \(routeMode === "direct"\) \{\s*return airportPoints;\s*\}/);
  assert.match(flightPlannerSource, /if \(routeMode === "auto" && waypoints\.length > 0 && routeAssistResolvedPoints\.length >= 2\)/);
  assert.doesNotMatch(flightPlannerSource, /routeMode !== "manual" && waypoints\.length > 0 && routeAssistResolvedPoints\.length >= 2/);
  assert.match(flightPlannerSource, /flight_planner_direct_geometry_invariant_failed/);
  assert.match(flightPlannerSource, /filedRouteIsDirect/);
});
