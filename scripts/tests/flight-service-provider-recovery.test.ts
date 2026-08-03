import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planNeedsProviderWebhookRecovery } from "../../client/src/components/flight-planner/providerSyncRecovery";
import type { FlightPlan } from "../../shared/schema";

const plan = (overrides: Partial<FlightPlan> = {}) => ({
  id: "plan-1",
  filingProviderPlanId: "658167349_806440_10941",
  filingStatus: "filed",
  filingProviderSnapshot: {
    providerLifecycleStatus: "PROPOSED",
    providerWebhookRetrievalPending: false,
  },
  isCertificationTest: false,
  source: "flight-planner",
  ...overrides,
} as FlightPlan);

test("healthy PROPOSED plans do not enter background provider recovery", () => {
  assert.equal(planNeedsProviderWebhookRecovery(plan()), false);
});

test("healthy ACTIVE plans do not enter background provider recovery", () => {
  assert.equal(planNeedsProviderWebhookRecovery(plan({
    filingStatus: "activated",
    filingProviderSnapshot: {
      providerLifecycleStatus: "ACTIVE",
      providerWebhookRetrievalPending: false,
    },
  })), false);
});

test("only plans explicitly pending webhook retrieval enter recovery", () => {
  assert.equal(planNeedsProviderWebhookRecovery(plan({
    filingProviderSnapshot: {
      providerLifecycleStatus: "ACTIVE",
      providerWebhookRetrievalPending: true,
    },
  })), true);
});

test("recovery runs on the five-minute cycle without an immediate dependency-driven poll", () => {
  const planner = readFileSync("client/src/pages/flight-planner.tsx", "utf8");
  const recoveryEffect = planner.slice(
    planner.indexOf("const recoveryProviderPlans"),
    planner.indexOf("}, [activeTab", planner.indexOf("const recoveryProviderPlans")),
  );
  assert.match(recoveryEffect, /planNeedsProviderWebhookRecovery\(plan\)/);
  assert.match(recoveryEffect, /setInterval\(poll, 5 \* 60_000\)/);
  assert.doesNotMatch(recoveryEffect, /void poll\(\)/);
});

test("successful provider persistence clears webhook retrieval recovery", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  const persistSync = routes.slice(
    routes.indexOf("const persistLeidosProviderSync"),
    routes.indexOf("const filingPreviewSchema"),
  );
  assert.match(persistSync, /providerWebhookRetrievalPending:\s*false/);
  assert.match(persistSync, /providerWebhookRetrievalFailureAt:\s*null/);
});

test("local notification polling remains local and cannot invoke provider sync", () => {
  const planner = readFileSync("client/src/pages/flight-planner.tsx", "utf8");
  const notificationQuery = planner.slice(
    planner.indexOf("queryKey: [\"/api/notifications/unread\"]"),
    planner.indexOf("const invalidateFlightPlanQueries", planner.indexOf("queryKey: [\"/api/notifications/unread\"]")),
  );
  assert.match(notificationQuery, /refetchInterval:\s*isAuthenticated \? 15_000 : false/);
  assert.doesNotMatch(notificationQuery, /filing-sync|syncLeidosPlanMetadata/);
});
