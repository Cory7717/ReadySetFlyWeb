import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  extractLeidosWebhookFields,
  LEIDOS_WEBHOOK_SUCCESS_RESPONSE,
  normalizeLeidosWebhookLifecycle,
  summarizeLeidosWebhookPayload,
} from "../../server/services/leidosWebhook";

test("Leidos webhook acknowledgement matches the documented response contract", () => {
  assert.deepEqual(LEIDOS_WEBHOOK_SUCCESS_RESPONSE, { success: "true" });
});

test("Leidos webhook log summary excludes provider values and pilot PII", () => {
  const canary = "SENSITIVE_CANARY_VALUE";
  const summary = summarizeLeidosWebhookPayload({
    notificationType: "FLIGHT_CHANGE",
    pilotData: canary,
    pilotPhone: canary,
    route: canary,
    supplementalRemarksExtended: canary,
    flightAlert: {
      flightIdentifier: "658167349_806440_3217",
      message: canary,
    },
  });
  const serialized = JSON.stringify(summary);

  assert.equal(serialized.includes(canary), false);
  assert.deepEqual(summary.payloadKeys, [
    "notificationType",
    "pilotData",
    "pilotPhone",
    "route",
    "supplementalRemarksExtended",
    "flightAlert",
  ]);
  assert.deepEqual(summary.flightAlertKeys, ["flightIdentifier", "message"]);
  assert.ok(Array.isArray(summary.structuralKeyPaths));
  assert.ok(Array.isArray(summary.enumLikeValues));
  assert.equal(serialized.includes("pilotPhone"), true);
});

test("existing PROPOSED flightAlert shape extracts provider lifecycle evidence", () => {
  const parsed = extractLeidosWebhookFields({
    notificationType: "FLIGHT_ALERT",
    flightAlert: {
      flightIdentifier: "658167349_806440_3217",
      flightVersionStamp: "20260713174500000",
      flightState: "PROPOSED",
      artccState: "ROGERED",
      messageDateTime: "2026-07-13T17:42:00Z",
      messageId: "message-1",
    },
  });

  assert.equal(parsed.flightIdentifier, "658167349_806440_3217");
  assert.equal(parsed.flightVersionStamp, "20260713174500000");
  assert.equal(parsed.flightState, "PROPOSED");
  assert.equal(parsed.artccState, "ROGERED");
  assert.equal(parsed.normalizedLifecycle, "proposed");
  assert.equal(parsed.hasMeaningfulProviderChange, true);
});

test("nested flightAlert status shape extracts IFR activation evidence", () => {
  const parsed = extractLeidosWebhookFields({
    notificationType: "FLIGHT_ALERT",
    flightAlert: {
      flightIdentifier: "658167349_806440_3217",
      message: {
        messageDateTime: "2026-07-13T17:52:22Z",
        messageId: "message-activation",
      },
      flightPlan: {
        versionStamp: "20260713175222000",
        flightPlanStatus: "ACTIVATED",
        artccStatus: "ROGERED",
      },
    },
  });

  assert.equal(parsed.flightIdentifier, "658167349_806440_3217");
  assert.equal(parsed.flightVersionStamp, "20260713175222000");
  assert.equal(parsed.flightState, "ACTIVATED");
  assert.equal(parsed.artccState, "ROGERED");
  assert.equal(parsed.providerMessageId, "message-activation");
  assert.equal(parsed.messageDateTime, "2026-07-13T17:52:22Z");
  assert.equal(parsed.normalizedLifecycle, "activated");
  assert.equal(parsed.hasMeaningfulProviderChange, true);
});

test("empty flightAlert is classified as no-op instead of provider review", () => {
  const parsed = extractLeidosWebhookFields({
    notificationType: "FLIGHT_ALERT",
    flightAlert: {
      flightIdentifier: "658167349_806440_3217",
      messageDateTime: "2026-07-13T17:52:22Z",
    },
  });

  assert.equal(parsed.flightIdentifier, "658167349_806440_3217");
  assert.equal(parsed.notificationType, "FLIGHT_ALERT");
  assert.equal(parsed.flightState, null);
  assert.equal(parsed.artccState, null);
  assert.equal(parsed.expectedRoute, null);
  assert.equal(parsed.normalizedLifecycle, null);
  assert.equal(parsed.hasMeaningfulProviderChange, false);
});

test("unknown incoming state remains unknown and does not normalize over known lifecycle", () => {
  assert.equal(normalizeLeidosWebhookLifecycle("SOMETHING_NEW"), null);
});

test("no-op webhook route path does not create pending provider review or notification", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  const noopIndex = routes.indexOf("leidos_webhook_noop_processed");
  const pendingReviewIndex = routes.indexOf("providerPendingReview: hasExplicitProviderChange");
  const notificationIndex = routes.indexOf("providerPushNotification = await storage.createUserNotification");

  assert.ok(noopIndex > 0, "no-op webhook branch should be present");
  assert.ok(pendingReviewIndex > noopIndex, "pending-review snapshot should be after the no-op branch");
  assert.ok(notificationIndex > noopIndex, "notification creation should be after the no-op branch");
  assert.match(routes, /const hasExplicitProviderChange = hasMeaningfulProviderChange/);
});
