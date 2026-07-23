import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const routesSource = readFileSync("server/routes.ts", "utf8");
const flightPlannerSource = readFileSync("client/src/pages/flight-planner.tsx", "utf8");

test("airport API exposes normalized communications and KEDC supplemental fallback", () => {
  assert.match(routesSource, /type AirportCommunication = \{/);
  assert.match(routesSource, /communications: AirportCommunication\[\]/);
  assert.match(routesSource, /communicationsUnavailable: boolean/);
  assert.match(routesSource, /frequencies: AirportCommunication\[\]/);

  assert.match(routesSource, /SUPPLEMENTAL_AIRPORT_COMMUNICATIONS/);
  assert.match(routesSource, /KEDC/);
  for (const frequency of ["118.825", "120.3", "122.975", "119.45", "127.225", "126.025"]) {
    assert.match(routesSource, new RegExp(frequency.replace(".", "\\.")));
  }
});

test("airport detail and frequency endpoints attach communications without a second client lookup", () => {
  assert.match(routesSource, /app\.get\("\/api\/airports\/:icao"/);
  assert.match(routesSource, /attachAirportCommunications/);
  assert.match(routesSource, /app\.get\("\/api\/airports\/:icao\/frequencies"/);
  assert.match(routesSource, /res\.json\(\{\s+icao: resolvedIcao,\s+requestedIcao,/);

  assert.match(flightPlannerSource, /extractAirportCommunications/);
  assert.match(flightPlannerSource, /detailHasCommunications/);
  assert.match(flightPlannerSource, /\/api\/airports\/\$\{encodeURIComponent\(icao\)\}\/frequencies/);
  assert.doesNotMatch(flightPlannerSource, /Failed to search airport frequencies/);
});

test("flight planner renders grouped airport communications instead of false no-frequency copy", () => {
  assert.match(flightPlannerSource, /Airport Communications Briefing/);
  assert.match(flightPlannerSource, /frequencyGroups\.map/);
  assert.match(flightPlannerSource, /FAA supplemental/);
  assert.match(flightPlannerSource, /Communications data unavailable/);
  assert.doesNotMatch(flightPlannerSource, /No frequencies returned for this airport/);
});

test("flight planner frequency lookups require a resolved airport, not just uppercase tokens", () => {
  assert.match(flightPlannerSource, /const hasResolvedAirport = Boolean\(/);
  assert.match(flightPlannerSource, /airportSearchResultMatchesIdentifier\(airport, icao\)/);
  assert.match(flightPlannerSource, /enabled: Boolean\(icao && hasResolvedAirport && !detailHasCommunications/);
  assert.match(flightPlannerSource, /event: "airport_frequency_lookup_requested"/);
});

test("manual route fallback does not treat syntactic airport-style words as confirmed airports", () => {
  assert.match(flightPlannerSource, /recognizedAirportTokens: \[\] as string\[\]/);
  assert.match(flightPlannerSource, /unresolvedAirportTokens: filedRouteAnalysis\.airportTokens/);
  assert.match(flightPlannerSource, /const filedRouteAirportTokens = resolvedFiledRouteAnalysis\.recognizedAirportTokens/);
  for (const token of ["MANY", "SURE", "THAT", "HAVE"]) {
    assert.doesNotMatch(flightPlannerSource, new RegExp(`encodeURIComponent\\("${token}"\\)`));
  }
});

test("airport frequency endpoint rejects unknown identifiers before unavailable-communications logging", () => {
  assert.match(routesSource, /resolveKnownAirportIdentifier/);
  assert.match(routesSource, /airport_frequency_lookup_rejected/);
  assert.match(routesSource, /invalidIdentifier: true/);
  const frequencyRoute = routesSource.match(/app\.get\("\/api\/airports\/:icao\/frequencies"[\s\S]*?\n  \}\);/)?.[0] || "";
  assert.match(frequencyRoute, /const resolvedIcao = await resolveKnownAirportIdentifier\(requestedIcao\)/);
  assert.match(frequencyRoute, /if \(!resolvedIcao\)/);
  assert.match(frequencyRoute, /return res\.json\(\{\s+icao: requestedIcao,[\s\S]*invalidIdentifier: true/);
  assert.match(frequencyRoute, /normalizeAirportCommunications\(resolvedIcao, frequencyMap\)/);
  assert.match(frequencyRoute, /logAirportCommunicationUnavailable\(resolvedIcao, "no_frequency_rows_for_airport"\)/);
});
