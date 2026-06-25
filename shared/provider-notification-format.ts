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
