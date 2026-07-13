export const LEIDOS_WEBHOOK_SUCCESS_RESPONSE = Object.freeze({
  success: "true",
});

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const normalizeText = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text || null;
};

const keyAliases = (key: string) => new Set([
  key,
  key.toLowerCase(),
  key.replace(/[_\-\s]/g, "").toLowerCase(),
]);

const keyMatches = (actualKey: string, aliases: Set<string>) => {
  const normalized = actualKey.replace(/[_\-\s]/g, "").toLowerCase();
  return aliases.has(actualKey) || aliases.has(actualKey.toLowerCase()) || aliases.has(normalized);
};

const findNestedString = (value: unknown, keys: string[], depth = 0): string | null => {
  if (!value || depth > 8) return null;
  const direct = normalizeText(value);
  if (direct && depth > 0) return null;
  const record = asRecord(value);
  if (!record) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findNestedString(item, keys, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }
  const aliases = keys.flatMap((key) => Array.from(keyAliases(key)));
  const aliasSet = new Set(aliases);
  for (const [key, nested] of Object.entries(record)) {
    if (keyMatches(key, aliasSet)) {
      const text = normalizeText(nested);
      if (text) return text;
    }
  }
  for (const nested of Object.values(record)) {
    const found = findNestedString(nested, keys, depth + 1);
    if (found) return found;
  }
  return null;
};

const findNestedValue = (value: unknown, keys: string[], depth = 0): unknown => {
  if (!value || depth > 8) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNestedValue(item, keys, depth + 1);
      if (found !== null && found !== undefined) return found;
    }
    return null;
  }
  const record = asRecord(value);
  if (!record) return null;
  const aliasSet = new Set(keys.flatMap((key) => Array.from(keyAliases(key))));
  for (const [key, nested] of Object.entries(record)) {
    if (keyMatches(key, aliasSet) && nested !== null && nested !== undefined) return nested;
  }
  for (const nested of Object.values(record)) {
    const found = findNestedValue(nested, keys, depth + 1);
    if (found !== null && found !== undefined) return found;
  }
  return null;
};

const collectSafeKeyPaths = (value: unknown, prefix = "", depth = 0, paths: string[] = []) => {
  if (!value || depth > 6 || paths.length >= 80) return paths;
  if (Array.isArray(value)) {
    value.slice(0, 3).forEach((item, index) => collectSafeKeyPaths(item, `${prefix}[${index}]`, depth + 1, paths));
    return paths;
  }
  const record = asRecord(value);
  if (!record) return paths;
  for (const [key, nested] of Object.entries(record)) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push(path);
    collectSafeKeyPaths(nested, path, depth + 1, paths);
    if (paths.length >= 80) break;
  }
  return paths;
};

const collectSafeEnumLikeValues = (value: unknown, prefix = "", depth = 0, found: Array<{ path: string; value: string }> = []) => {
  if (!value || depth > 6 || found.length >= 40) return found;
  if (Array.isArray(value)) {
    value.slice(0, 5).forEach((item, index) => collectSafeEnumLikeValues(item, `${prefix}[${index}]`, depth + 1, found));
    return found;
  }
  const record = asRecord(value);
  if (!record) return found;
  for (const [key, nested] of Object.entries(record)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const text = normalizeText(nested);
    if (
      text &&
      /state|status|type|version|stamp|identifier|planid|messageid|timestamp|datetime|reference|transaction/i.test(key) &&
      text.length <= 80 &&
      !/name|phone|remark|comment|route|address|email|pilot|crew|passenger/i.test(key)
    ) {
      found.push({ path, value: text });
    }
    collectSafeEnumLikeValues(nested, path, depth + 1, found);
    if (found.length >= 40) break;
  }
  return found;
};

export const summarizeLeidosWebhookPayload = (payload: unknown) => {
  const record = asRecord(payload);
  const nestedAlert = asRecord(record?.flightAlert);

  return {
    payloadType: Array.isArray(payload) ? "array" : payload === null ? "null" : typeof payload,
    payloadKeys: record ? Object.keys(record).slice(0, 25) : [],
    flightAlertKeys: nestedAlert ? Object.keys(nestedAlert).slice(0, 25) : [],
    structuralKeyPaths: collectSafeKeyPaths(payload).slice(0, 80),
    enumLikeValues: collectSafeEnumLikeValues(payload).slice(0, 40),
  };
};

export const normalizeLeidosWebhookLifecycle = (value: unknown): string | null => {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;
  if (/cancelled|canceled|cancellation/.test(text)) return "cancelled";
  if (/\bclosed\b|closure|closeout/.test(text)) return "closed";
  if (/reject/.test(text)) return "rejected";
  if (/\bactivated\b|\bactive\b|\bopened\b/.test(text)) return "activated";
  if (/\bproposed\b/.test(text)) return "proposed";
  if (/\bfiled\b|\baccepted\b/.test(text)) return "filed";
  return null;
};

export const extractLeidosWebhookFields = (payload: unknown) => {
  const record = asRecord(payload) || {};
  const alert = asRecord(record.flightAlert) || record;
  const searchRoot = alert === record ? record : { ...record, flightAlert: alert };
  const notificationType =
    findNestedString(alert, ["notificationType", "type", "eventType"]) ||
    findNestedString(record, ["notificationType", "type", "eventType"]) ||
    "";
  const flightIdentifier =
    findNestedString(alert, ["flightIdentifier", "planId", "flightPlanId", "providerPlanId", "id"]) ||
    findNestedString(record, ["flightIdentifier", "planId", "flightPlanId", "providerPlanId", "id"]);
  const flightVersionStamp =
    findNestedString(alert, ["flightVersionStamp", "versionStamp", "version", "providerVersionStamp"]) ||
    findNestedString(record, ["flightVersionStamp", "versionStamp", "version", "providerVersionStamp"]);
  const flightState = findNestedString(searchRoot, [
    "flightState",
    "flight_state",
    "flightPlanState",
    "flightPlanStatus",
    "flightStatus",
    "lifecycle",
    "lifecycleStatus",
    "providerLifecycleStatus",
    "status",
    "state",
  ]);
  const expectedRoute = findNestedString(searchRoot, ["expectedRoute", "providerRoute", "routeText", "routeString"]);
  const artccState = findNestedString(searchRoot, ["artccState", "artccStatus", "artcc_status"]);
  const artccInfo = findNestedValue(searchRoot, ["artccInfo", "artcc_info"]);
  const providerMessageId =
    findNestedString(alert, ["messageId", "referenceId", "transactionId", "trackingId"]) ||
    findNestedString(record, ["messageId", "referenceId", "transactionId", "trackingId"]);
  const messageDateTime =
    findNestedString(alert, ["messageDateTime", "notificationTimestamp", "timestamp", "dateTime"]) ||
    findNestedString(record, ["messageDateTime", "notificationTimestamp", "timestamp", "dateTime"]);
  const changeType = findNestedString(searchRoot, ["changeType", "change"]);
  const alertType = findNestedString(searchRoot, ["alertType", "alert"]);
  const extractedMessage =
    findNestedString(alert, ["alertMessage", "message", "description", "detail"]) ||
    findNestedString(record, ["alertMessage", "message", "description", "detail"]) ||
    notificationType ||
    "Flight plan update received";
  const normalizedLifecycle = normalizeLeidosWebhookLifecycle(flightState);
  const hasMeaningfulProviderChange = Boolean(
    flightVersionStamp ||
    normalizedLifecycle ||
    flightState ||
    expectedRoute ||
    artccState ||
    artccInfo ||
    changeType ||
    alertType
  );

  return {
    alert,
    notificationType,
    flightIdentifier,
    flightVersionStamp,
    flightState,
    expectedRoute,
    artccState,
    artccInfo,
    providerMessageId,
    messageDateTime,
    changeType,
    alertType,
    extractedMessage,
    normalizedLifecycle,
    hasMeaningfulProviderChange,
  };
};
