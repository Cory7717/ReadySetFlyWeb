import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("filing action enriches plan with authoritative airport metadata before validation and provider dispatch", () => {
  const source = read("server/routes.ts");

  assert.match(source, /async function enrichFlightPlanWithFilingAirportTimezoneMetadata/);
  assert.match(source, /const referenceMap = await loadAirportReferenceCache\(\)/);
  assert.match(source, /departureAirportMetadata: toFilingAirportTimezoneMetadata\(departureReference, departure\)/);
  assert.match(source, /planningReferenceDepartureAirportMetadata/);

  const routeStart = source.indexOf('app.post("/api/flight-plans/:id/filing-action"');
  assert.ok(routeStart >= 0, "filing action route should exist");
  const validationIndex = source.indexOf("validateFlightPlanForAction", routeStart);
  const enrichmentIndex = source.indexOf("effectivePlanWithAirportTimezoneMetadata", routeStart);
  const stageIndex = source.indexOf("flightPlanFilingProvider.stageAction", routeStart);

  assert.ok(enrichmentIndex > routeStart && enrichmentIndex < validationIndex, "airport metadata enrichment should happen before validation");
  assert.ok(stageIndex > validationIndex, "provider dispatch should happen after validation");
  const routeBody = source.slice(routeStart, stageIndex + 220);
  assert.match(routeBody, /validateFlightPlanForAction\(effectivePlanWithAirportTimezoneMetadata, action\)/);
  assert.match(routeBody, /flightPlanFilingProvider\.stageAction\(effectivePlanWithAirportTimezoneMetadata, action\)/);
});

test("provider timezone resolver consumes enriched airport metadata instead of only a hardcoded ICAO list", () => {
  const source = read("server/services/flight-plan-filing/provider.ts");

  assert.match(source, /type AirportTimezoneInput/);
  assert.match(source, /const asAirportTimezoneInput/);
  assert.match(source, /plannerState\?\.departureAirportMetadata/);
  assert.match(source, /plannerState\?\.planningReferenceDepartureAirportMetadata/);
  assert.match(source, /departureAirport: departureAirportMetadata \?\? \{ icao: plan\.departure \|\| null \}/);
});
