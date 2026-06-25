const USEFUL_PROVIDER_FIELDS = [
  "facility",
  "facilityId",
  "center",
  "name",
  "state",
  "status",
  "message",
  "phone",
  "frequency",
] as const;

const normalizeText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const normalized = String(value).replace(/\s+/g, " ").trim();
    if (!normalized || normalized === "[object Object]") return null;
    return normalized;
  }
  return null;
};

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export const formatArtccInfo = (artccInfo: unknown): string => {
  const scalar = normalizeText(artccInfo);
  if (scalar) return scalar;
  if (!artccInfo || typeof artccInfo !== "object" || Array.isArray(artccInfo)) return "";

  const record = artccInfo as Record<string, unknown>;
  const primary = unique([
    normalizeText(record.facilityId),
    normalizeText(record.facility),
    normalizeText(record.center),
  ].filter((value): value is string => Boolean(value)));
  const secondary = unique([
    normalizeText(record.name),
    normalizeText(record.state),
    normalizeText(record.status),
    normalizeText(record.message),
  ].filter((value): value is string => Boolean(value)));
  const contact = unique([
    normalizeText(record.frequency),
    normalizeText(record.phone),
  ].filter((value): value is string => Boolean(value)));
  const parts = [...primary, ...secondary, ...contact];
  return parts.length > 0 ? parts.join(" / ") : "";
};

export const formatProviderNotificationValue = (value: unknown): string => {
  const scalar = normalizeText(value);
  if (scalar) return scalar;
  if (Array.isArray(value)) {
    return unique(value.map((entry) => formatProviderNotificationValue(entry)).filter(Boolean)).join(", ");
  }
  if (!value || typeof value !== "object") return "";

  const record = value as Record<string, unknown>;
  return unique(
    USEFUL_PROVIDER_FIELDS
      .map((field) => normalizeText(record[field]))
      .filter((entry): entry is string => Boolean(entry)),
  ).join(" / ");
};

export const sanitizeNotificationMessage = (message: unknown): string => {
  const normalized = normalizeText(message);
  if (!normalized) return "";
  return normalized
    .replace(/\s*ARTCC info:\s*\[object Object\]\.\s*/gi, " ")
    .replace(/\s*ARTCC:\s*\[object Object\]\.\s*/gi, " ")
    .replace(/\[object Object\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

export type ProviderChangeSummary = {
  added: string[];
  removed: string[];
  modified: string[];
  unchanged: string[];
  technicalDetails: Array<{
    field: string;
    previous: string;
    current: string;
    raw: string;
  }>;
};

const ICAO_SUBFIELD_PATTERN = /[A-Z]{2,5}\//;
const ICAO_SUBFIELD_START_PATTERN = /^[A-Z]{2,5}\//;

const normalizeComparableText = (value: string) => value.replace(/\s+/g, " ").trim();

const parseChangedField = (value: unknown) => {
  const raw = sanitizeNotificationMessage(value);
  if (!raw) return null;
  const prefixMatch = raw.match(/^(.*?)\s+changed from\s+/i);
  if (!prefixMatch) return null;
  const field = normalizeComparableText(prefixMatch[1] || "Field");
  const remainder = raw.slice(prefixMatch[0].length).replace(/\.$/, "");
  const separators = Array.from(remainder.matchAll(/\s+to\s+/gi));
  if (separators.length === 0) return null;
  const preferredSeparator = separators.find((separator) => {
    const currentCandidate = remainder.slice((separator.index || 0) + separator[0].length).trim();
    return /other\s+info/i.test(field) && ICAO_SUBFIELD_START_PATTERN.test(currentCandidate);
  }) || separators[separators.length - 1];
  const separatorIndex = preferredSeparator.index || 0;
  const separatorLength = preferredSeparator[0].length;
  return {
    field,
    previous: normalizeComparableText(remainder.slice(0, separatorIndex)),
    current: normalizeComparableText(remainder.slice(separatorIndex + separatorLength)),
    raw,
  };
};

const splitChangedFieldMessages = (value: string) => {
  const normalized = sanitizeNotificationMessage(value);
  if (!normalized) return [];
  return normalized
    .split(/\.\s+(?=[A-Za-z][A-Za-z ]+\s+changed from\s+)/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const tokenizeIcaoOtherInfo = (value: string) => {
  const normalized = normalizeComparableText(value).toUpperCase();
  if (!normalized) return [];
  const matches = Array.from(normalized.matchAll(/[A-Z]{2,5}\//g));
  if (matches.length === 0) return normalized.split(/\s+/).filter(Boolean);

  return matches
    .map((match, index) => {
      const start = match.index || 0;
      const end = index + 1 < matches.length ? matches[index + 1].index || normalized.length : normalized.length;
      return normalized.slice(start, end).trim();
    })
    .filter(Boolean);
};

const tokenizeComparableValue = (field: string, value: string) => {
  if (/other\s+info/i.test(field) || ICAO_SUBFIELD_PATTERN.test(value)) return tokenizeIcaoOtherInfo(value);
  return normalizeComparableText(value).split(/\s+/).filter(Boolean);
};

const pushUnique = (target: string[], value: string) => {
  const normalized = normalizeComparableText(value);
  if (normalized && !target.includes(normalized)) target.push(normalized);
};

export const summarizeProviderChangeDetails = (details: unknown, changedFields?: unknown): ProviderChangeSummary | null => {
  const rawFields = Array.isArray(changedFields)
    ? changedFields.map((entry) => sanitizeNotificationMessage(entry)).filter(Boolean)
    : [];
  const fallbackMessage = sanitizeNotificationMessage(details);
  const fallbackFields = rawFields.length === 0 && /^Flight Service changed this plan:/i.test(fallbackMessage)
    ? splitChangedFieldMessages(fallbackMessage.replace(/^Flight Service changed this plan:\s*/i, ""))
    : [];
  const parsed = [...rawFields, ...fallbackFields]
    .map(parseChangedField)
    .filter((entry): entry is NonNullable<ReturnType<typeof parseChangedField>> => Boolean(entry));

  if (parsed.length === 0) return null;

  const summary: ProviderChangeSummary = {
    added: [],
    removed: [],
    modified: [],
    unchanged: [],
    technicalDetails: parsed,
  };

  for (const change of parsed) {
    const previous = normalizeComparableText(change.previous);
    const current = normalizeComparableText(change.current);
    if (!previous && !current) continue;
    if (previous === current) continue;

    const previousTokens = tokenizeComparableValue(change.field, previous);
    const currentTokens = tokenizeComparableValue(change.field, current);
    const previousSet = new Set(previousTokens);
    const currentSet = new Set(currentTokens);
    const tokenizedCleanly = previousTokens.length > 0 || currentTokens.length > 0;

    if (tokenizedCleanly) {
      currentTokens.filter((token) => !previousSet.has(token)).forEach((token) => pushUnique(summary.added, token));
      previousTokens.filter((token) => !currentSet.has(token)).forEach((token) => pushUnique(summary.removed, token));
      currentTokens.filter((token) => previousSet.has(token)).forEach((token) => pushUnique(summary.unchanged, token));
      continue;
    }

    pushUnique(summary.modified, `${change.field}: ${previous} -> ${current}`);
  }

  if (summary.added.length === 0 && summary.removed.length === 0 && summary.modified.length === 0) return null;
  return summary;
};
