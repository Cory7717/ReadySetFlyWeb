const MAX_DIAGNOSTIC_STRING_LENGTH = 500;
const MAX_DIAGNOSTIC_ARRAY_LENGTH = 25;
const MAX_DIAGNOSTIC_DEPTH = 8;

const FORBIDDEN_DIAGNOSTIC_KEY_PATTERN =
  /(authorization|credential|password|secret|token|requestpayload|payloadsnapshot|pilotdata|pilotname|pilotphone|phonenumber|telephone|remarks?|otherinfo|supplemental|suppremarks|passenger|crew|fullname|emailaddress|address|messagecontent|^rawpayload$|^webhookpayload$|^metadataresponse$|^response$|fullflightplan|flightplanobject)/i;

const ALLOWED_DIAGNOSTIC_KEY_PATTERN =
  /^(action|requestaction|provider|providerplanid|flightidentifier|versionstamp|httpstatus|returnstatus|responsemessages|returncodedmessage|codedmessage|code|message|details|severity|title|status|statusreason|errorcode|errormessage|normalizedlifecycle|providerlifecyclestatus|providerstatus|artccstate|routechangedbyprovider|changedbyprovider|evidencekind|evidencesource|source|requesturl|providerurl|providerendpoint|timestamp|syncedat|processedat|completedat|dispatchedat|createdat|updatedat|retryclassification|outcomeclassification|provideroutcomeunknown|provideroutcomeunknownreason|provideroutcomeunknownaction|terminalaction|versionstampexpected|responsekeys|metadatakeys|responseprovidercandidates|responseversioncandidates|metadataprovideridcandidates|metadataversioncandidates|requestdiagnostics|responsediagnostics|metadatadiagnostics|metadataresponsediagnostics|omitted|type|keys|path|preview)$/i;

const redactDiagnosticText = (value: string) => {
  let redacted = value;
  redacted = redacted.replace(/\bBasic\s+[A-Za-z0-9+/=._-]+/gi, "Basic [redacted]");
  redacted = redacted.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]");
  redacted = redacted.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]");
  redacted = redacted.replace(/\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g, "[redacted-phone]");
  redacted = redacted.replace(/\b(password|passwd|secret|credential|authorization|token)=([^&\s]+)/gi, "$1=[redacted]");
  if (redacted.length > MAX_DIAGNOSTIC_STRING_LENGTH) {
    redacted = `${redacted.slice(0, MAX_DIAGNOSTIC_STRING_LENGTH)}...`;
  }
  return redacted;
};

const normalizeDiagnosticKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, "");

const summarizeDiagnosticObject = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    omitted: true,
    type: Array.isArray(value) ? "array" : "object",
    keys: Object.keys(record)
      .slice(0, 30)
      .map((key) => FORBIDDEN_DIAGNOSTIC_KEY_PATTERN.test(normalizeDiagnosticKey(key)) ? "[redacted-key]" : key),
  };
};

export const sanitizeProviderDiagnosticForPersistence = (
  input: unknown,
  options: { allowUnknownTopLevelKeys?: boolean } = {},
): unknown => {
  const seen = new WeakSet<object>();

  const sanitize = (value: unknown, keyPath: string[], depth: number): unknown => {
    if (value === null || value === undefined) return value;
    if (typeof value === "string") return redactDiagnosticText(value);
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value !== "object") return String(value);

    if (seen.has(value)) return "[circular omitted]";
    seen.add(value);

    if (depth > MAX_DIAGNOSTIC_DEPTH) {
      return summarizeDiagnosticObject(value);
    }

    if (Array.isArray(value)) {
      return value
        .slice(0, MAX_DIAGNOSTIC_ARRAY_LENGTH)
        .map((entry) => sanitize(entry, keyPath, depth + 1))
        .filter((entry) => entry !== undefined);
    }

    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const normalizedKey = normalizeDiagnosticKey(key);
      if (FORBIDDEN_DIAGNOSTIC_KEY_PATTERN.test(normalizedKey)) {
        const summary = summarizeDiagnosticObject(child);
        if ((normalizedKey === "response" || normalizedKey === "metadataresponse") && summary) {
          output[`${key}Diagnostics`] = sanitize(summary, [...keyPath, `${key}Diagnostics`], depth + 1);
        }
        continue;
      }

      const allowed =
        options.allowUnknownTopLevelKeys && keyPath.length === 0
          ? true
          : ALLOWED_DIAGNOSTIC_KEY_PATTERN.test(normalizedKey);
      if (!allowed) continue;

      const sanitized = sanitize(child, [...keyPath, key], depth + 1);
      if (sanitized !== undefined) {
        output[key] = sanitized;
      }
    }
    return output;
  };

  return sanitize(input, [], 0);
};

export const sanitizeProviderDiagnosticRecordForPersistence = (
  input: unknown,
): Record<string, unknown> => {
  const sanitized = sanitizeProviderDiagnosticForPersistence(input, { allowUnknownTopLevelKeys: true });
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? sanitized as Record<string, unknown>
    : {};
};

export const providerDiagnosticContainsForbiddenContent = (input: unknown): boolean => {
  const visited = new WeakSet<object>();
  const inspect = (value: unknown, path: string[]): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") {
      return /\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/.test(value) ||
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value) ||
        /\bBasic\s+[A-Za-z0-9+/=._-]+/i.test(value) ||
        /\bBearer\s+[A-Za-z0-9._~+/=-]+/i.test(value);
    }
    if (typeof value !== "object") return false;
    if (visited.has(value)) return false;
    visited.add(value);
    if (Array.isArray(value)) return value.some((entry, index) => inspect(entry, [...path, String(index)]));
    return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
      const normalizedKey = normalizeDiagnosticKey(key);
      return FORBIDDEN_DIAGNOSTIC_KEY_PATTERN.test(normalizedKey) || inspect(child, [...path, key]);
    });
  };
  return inspect(input, []);
};
