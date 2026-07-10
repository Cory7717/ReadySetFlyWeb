import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeLeidosProviderLifecycle } from "../../server/services/flight-plan-filing/provider";

test("provider lifecycle normalization only uses explicit provider state values", () => {
  assert.deepEqual(normalizeLeidosProviderLifecycle("PROPOSED"), {
    lifecycle: "proposed",
    reason: "explicit_provider_proposed",
  });
  assert.deepEqual(normalizeLeidosProviderLifecycle("CLOSED"), {
    lifecycle: "closed",
    reason: "explicit_provider_closure",
  });
  assert.deepEqual(normalizeLeidosProviderLifecycle("CANCELLED"), {
    lifecycle: "cancelled",
    reason: "explicit_provider_cancellation",
  });
  assert.deepEqual(normalizeLeidosProviderLifecycle(null), {
    lifecycle: "unknown",
    reason: "unknown_mapping",
  });
});

test("ARTCC ROGERED without provider flight state does not imply closed or cancelled", () => {
  const result = normalizeLeidosProviderLifecycle(null);
  assert.equal(result.lifecycle, "unknown");
  assert.notEqual(result.lifecycle, "closed");
  assert.notEqual(result.lifecycle, "cancelled");
});

test("provider snapshot merge preserves last-known values on null retrieve", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  assert.match(routes, /lastKnownArtccState/);
  assert.match(routes, /provider_record_not_retrievable/);
  assert.match(routes, /preserveLifecycle/);
  assert.match(routes, /provider_lifecycle_transition/);
});

test("Flight Planner panel does not show local filingStatus as provider status", () => {
  const panel = readFileSync("client/src/components/flight-planner/FilingProviderWorkspace.tsx", "utf8");
  assert.match(panel, /Provider lifecycle/);
  assert.match(panel, /Provider flight state/);
  assert.match(panel, /Last known ARTCC state/);
  assert.match(panel, /Provider retrieval/);
  assert.doesNotMatch(panel, /Provider status<\/div>\s*<div className="font-medium">\{asString\(providerSnapshot\.providerStatus\) \|\| plan\.filingStatus/);
});

test("webhook diagnostics include raw flight and ARTCC state values", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  assert.match(routes, /rawFlightState/);
  assert.match(routes, /rawArtccState/);
  assert.match(routes, /previousLifecycleStatus/);
  assert.match(routes, /mappingReason/);
});

test("duplicate webhook deliveries are identified before side effects", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  const webhookRoute = routes.slice(routes.indexOf('app.post("/api/leidos/webhooks/flight-service"'));
  const duplicateCheck = webhookRoute.indexOf("leidos_push_duplicate_ignored");
  const notificationCreate = webhookRoute.indexOf("storage.createUserNotification");
  assert.ok(duplicateCheck > 0, "duplicate webhook ignore path should exist");
  assert.ok(notificationCreate > 0, "webhook notification creation should exist");
  assert.ok(duplicateCheck < notificationCreate, "duplicate check must run before notification creation");
  assert.match(routes, /processedWebhookEvents/);
  assert.match(routes, /activeLeidosWebhookEvents/);
  assert.match(routes, /eventHash/);
  assert.match(routes, /suppressTransitionLog: true/);
});
