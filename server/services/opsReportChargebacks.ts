import { createHash } from "crypto";

export type OpsChargebackRow = Record<string, unknown>;

type OpsDraftChargebacks = {
  weekStart: string;
  payloadJson: unknown;
};

const DEFAULT_ONLY_VALUES = new Set(["review", "pending", "not-started"]);
const CONTENT_FIELDS = [
  "guest",
  "guestName",
  "caseId",
  "reason",
  "amount",
  "responseDue",
  "respondDate",
  "notes",
  "comment",
  "owner",
  "submittedDate",
  "confirmationNumber",
  "followUpDate",
  "evidenceNotes",
];

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizedText(value: unknown) {
  return text(value).toLowerCase().replace(/\s+/g, " ");
}

function normalizedAmount(value: unknown) {
  const parsed = Number(text(value).replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed.toFixed(2) : normalizedText(value);
}

function fallbackKey(row: OpsChargebackRow) {
  return [
    normalizedText(row.guest || row.guestName),
    normalizedText(row.reason),
    normalizedAmount(row.amount),
    normalizedText(row.responseDue || row.respondDate),
  ].join("|");
}

function legacyTrackingId(row: OpsChargebackRow) {
  return `legacy:${createHash("sha256").update(fallbackKey(row)).digest("hex").slice(0, 24)}`;
}

export function chargebackIdentityKeys(row: OpsChargebackRow): string[] {
  const keys: string[] = [];
  const trackingId = normalizedText(row.trackingId);
  const caseId = normalizedText(row.caseId);
  const confirmationNumber = normalizedText(row.confirmationNumber);
  if (trackingId) keys.push(`tracking:${trackingId}`);
  if (caseId) keys.push(`case:${caseId}`);
  if (confirmationNumber) keys.push(`confirmation:${confirmationNumber}`);
  keys.push(`tracking:${legacyTrackingId(row)}`, `fallback:${fallbackKey(row)}`);
  return Array.from(new Set(keys));
}

export function chargebackHasMeaningfulContent(row: OpsChargebackRow) {
  return CONTENT_FIELDS.some((field) => {
    const value = normalizedText(row[field]);
    return Boolean(value) && !DEFAULT_ONLY_VALUES.has(value);
  });
}

export function chargebackNeedsAttention(row: OpsChargebackRow) {
  if (!chargebackHasMeaningfulContent(row)) return false;
  const decision = normalizedText(row.decision) || "review";
  const outcome = normalizedText(row.outcome) || "pending";
  if (decision === "accepted" || outcome === "won" || outcome === "lost") return false;
  return decision === "review" || decision === "challenged";
}

function rowsFromDraft(draft: OpsDraftChargebacks): OpsChargebackRow[] {
  if (!draft.payloadJson || typeof draft.payloadJson !== "object" || Array.isArray(draft.payloadJson)) return [];
  const rows = (draft.payloadJson as Record<string, unknown>).chargebacks;
  return Array.isArray(rows) ? rows.filter((row): row is OpsChargebackRow => Boolean(row) && typeof row === "object" && !Array.isArray(row)) : [];
}

/**
 * Returns the newest known state of each historical chargeback that still needs
 * action. Drafts must be supplied oldest-to-newest so a later resolution wins.
 */
export function collectOpenChargebacks(drafts: OpsDraftChargebacks[]): OpsChargebackRow[] {
  const latestByIdentity = new Map<string, OpsChargebackRow>();
  const aliasToIdentity = new Map<string, string>();

  for (const draft of drafts) {
    for (const rawRow of rowsFromDraft(draft)) {
      if (!chargebackHasMeaningfulContent(rawRow)) continue;
      const keys = chargebackIdentityKeys(rawRow);
      const existingIdentity = keys.map((key) => aliasToIdentity.get(key)).find(Boolean);
      const identity = existingIdentity || keys[0];
      const previous = latestByIdentity.get(identity);
      const trackingId = text(rawRow.trackingId) || text(previous?.trackingId) || legacyTrackingId(rawRow);
      const originWeekStart = text(rawRow.originWeekStart) || text(previous?.originWeekStart) || draft.weekStart;
      const row = {
        ...rawRow,
        trackingId,
        originWeekStart,
        carriedFromWeekStart: draft.weekStart,
      };
      latestByIdentity.set(identity, row);
      for (const key of chargebackIdentityKeys(row)) aliasToIdentity.set(key, identity);
    }
  }

  return Array.from(latestByIdentity.values()).filter(chargebackNeedsAttention);
}
