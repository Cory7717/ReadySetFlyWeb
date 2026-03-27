const normalizeMetadataKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const asTrimmedString = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
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
        const match = asTrimmedString(child);
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
  findNestedStringValue(input, [
    "versionStamp",
    "version_stamp",
    "currentVersionStamp",
    "current_version_stamp",
    "versionNumber",
    "version_number",
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
