export const LEIDOS_WEBHOOK_SUCCESS_RESPONSE = Object.freeze({
  success: "true",
});

export const summarizeLeidosWebhookPayload = (payload: unknown) => {
  const record = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : null;
  const nestedAlert = record?.flightAlert && typeof record.flightAlert === "object" && !Array.isArray(record.flightAlert)
    ? record.flightAlert as Record<string, unknown>
    : null;

  return {
    payloadType: Array.isArray(payload) ? "array" : payload === null ? "null" : typeof payload,
    payloadKeys: record ? Object.keys(record).slice(0, 25) : [],
    flightAlertKeys: nestedAlert ? Object.keys(nestedAlert).slice(0, 25) : [],
  };
};
