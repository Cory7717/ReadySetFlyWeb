const normalizeMetadataKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const asTrimmedString = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return null;
  const text = String(value).trim();
  return text || null;
};

const extractNestedPrimitiveString = (input: unknown, maxDepth = 4) => {
  if (input === null || input === undefined) return null;
  if (typeof input !== "object") {
    return asTrimmedString(input);
  }

  const preferredKeys = new Set(
    [
      "value",
      "stamp",
      "version",
      "versionid",
      "versionnumber",
      "id",
      "token",
      "etag",
      "sequencenumber",
      "revisionnumber",
      "lastmodified",
      "timestamp",
      "text",
    ].map(normalizeMetadataKey),
  );

  const visited = new Set<unknown>();
  const queue: Array<{ value: unknown; depth: number }> = [{ value: input, depth: 0 }];
  let fallbackMatch: string | null = null;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const { value, depth } = current;
    if (value === null || value === undefined || visited.has(value) || depth > maxDepth) {
      continue;
    }

    if (typeof value !== "object") {
      const match = asTrimmedString(value);
      if (match) return match;
      continue;
    }

    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        queue.push({ value: item, depth: depth + 1 });
      }
      continue;
    }

    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      const normalizedKey = normalizeMetadataKey(key);
      const match = asTrimmedString(child);
      if (match && preferredKeys.has(normalizedKey)) {
        return match;
      }
      if (match && !fallbackMatch) {
        fallbackMatch = match;
      }
    }

    for (const child of Object.values(record)) {
      queue.push({ value: child, depth: depth + 1 });
    }
  }

  return fallbackMatch;
};

const findNestedVersionStampToken = (
  input: unknown,
  candidateKeys: string[],
  maxDepth = 8,
) => {
  if (!input || typeof input !== "object") return null;

  const normalizedCandidates = new Set(candidateKeys.map(normalizeMetadataKey));
  const visited = new Set<unknown>();
  const queue: Array<{ value: unknown; depth: number }> = [{ value: input, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const { value, depth } = current;
    if (!value || typeof value !== "object" || visited.has(value) || depth > maxDepth) {
      continue;
    }
    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        queue.push({ value: item, depth: depth + 1 });
      }
      continue;
    }

    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      if (normalizedCandidates.has(normalizeMetadataKey(key))) {
        const nestedMatch = extractNestedPrimitiveString(child);
        if (nestedMatch) return nestedMatch;
        if (child && typeof child === "object") {
          try {
            return JSON.stringify(child);
          } catch {
            // fall through to continued search
          }
        }
      }
    }

    for (const child of Object.values(record)) {
      queue.push({ value: child, depth: depth + 1 });
    }
  }

  return null;
};

const findNestedStringValue = (
  input: unknown,
  candidateKeys: string[],
  maxDepth = 8,
) => {
  if (!input || typeof input !== "object") return null;

  const normalizedCandidates = new Set(candidateKeys.map(normalizeMetadataKey));
  const visited = new Set<unknown>();
  const queue: Array<{ value: unknown; depth: number }> = [{ value: input, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const { value, depth } = current;
    if (!value || typeof value !== "object" || visited.has(value) || depth > maxDepth) {
      continue;
    }
    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        queue.push({ value: item, depth: depth + 1 });
      }
      continue;
    }

    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      if (normalizedCandidates.has(normalizeMetadataKey(key))) {
        const match = extractNestedPrimitiveString(child);
        if (match) return match;
      }
    }

    for (const child of Object.values(record)) {
      queue.push({ value: child, depth: depth + 1 });
    }
  }

  return null;
};

export const extractFilingVersionStamp = (input: unknown) =>
  findNestedVersionStampToken(input, [
    "versionStamp",
    "version_stamp",
    "version",
    "versionId",
    "version_id",
    "currentVersionStamp",
    "current_version_stamp",
    "currentVersion",
    "current_version",
    "flightPlanVersion",
    "flight_plan_version",
    "flightPlanVersionStamp",
    "flight_plan_version_stamp",
    "versionNumber",
    "version_number",
    "fpVersion",
    "fp_version",
    "filedVersion",
    "filed_version",
    "amendVersion",
    "amend_version",
    "etag",
    "eTag",
    "lastModified",
    "last_modified",
    "sequenceNumber",
    "sequence_number",
    "revisionNumber",
    "revision_number",
  ]);

export const extractFilingProviderPlanId = (input: unknown) => {
  if (!input || typeof input !== "object") return null;

  const record = input as Record<string, unknown>;
  const direct =
    asTrimmedString(record.providerPlanId) ||
    asTrimmedString(record.flightIdentifier) ||
    asTrimmedString(record.flightPlanId) ||
    asTrimmedString(record.planId) ||
    asTrimmedString(record.id);

  if (direct) return direct;

  return findNestedStringValue(input, [
    "providerPlanId",
    "provider_plan_id",
    "flightIdentifier",
    "flight_identifier",
    "flightPlanId",
    "flight_plan_id",
    "planId",
    "plan_id",
  ]);
};
