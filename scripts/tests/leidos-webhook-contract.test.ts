import assert from "node:assert/strict";
import test from "node:test";
import {
  LEIDOS_WEBHOOK_SUCCESS_RESPONSE,
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
      flightIdentifier: canary,
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
});
