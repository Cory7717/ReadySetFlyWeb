import type { CrmLead } from "@shared/schema";

type EmailPreferences = Record<string, boolean>;

const DEFAULT_UNSUBSCRIBED_PREFERENCES: EmailPreferences = {
  sales: false,
  product_updates: false,
  marketplace_updates: false,
};

export const logger = {
  info(event: string, payload: Record<string, unknown>) {
    console.info(event, payload);
  },
};

function normalizeEmailPreferences(value: unknown): EmailPreferences | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
    key,
    Boolean(entryValue),
  ]);
  return Object.fromEntries(entries);
}

export function buildUnsubscribedEmailPreferences(value: unknown): EmailPreferences {
  const existing = normalizeEmailPreferences(value) ?? {};
  const forcedFalseEntries = Object.keys(existing).map((key) => [key, false] as const);
  return {
    ...Object.fromEntries(forcedFalseEntries),
    ...DEFAULT_UNSUBSCRIBED_PREFERENCES,
  };
}

export function buildCrmEmailUnsubscribeUpdate(value?: unknown) {
  const timestamp = new Date();
  return {
    emailUnsubscribed: true,
    emailUnsubscribedAt: timestamp,
    emailSuppressionReason: "user_unsubscribed",
    emailPreferences: buildUnsubscribedEmailPreferences(value),
    marketingEmailOptOutAt: timestamp,
  };
}

export function buildCrmEmailResubscribeUpdate(value?: unknown) {
  const existing = normalizeEmailPreferences(value) ?? {};
  return {
    emailUnsubscribed: false,
    emailUnsubscribedAt: null,
    emailSuppressionReason: null,
    emailPreferences: {
      ...existing,
      sales: true,
    },
    marketingEmailOptOutAt: null,
  };
}

export function canSendEmail(
  lead: Pick<CrmLead, "emailUnsubscribed" | "emailPreferences" | "marketingEmailOptOutAt"> | null | undefined,
) {
  if (!lead) return false;
  const preferences = normalizeEmailPreferences(lead.emailPreferences);
  const legacySuppressed = Boolean(lead.marketingEmailOptOutAt);
  return !lead.emailUnsubscribed && !legacySuppressed && (preferences?.sales ?? true);
}

export function preserveLeadEmailSuppression<T extends Record<string, unknown>>(
  updates: T,
  existingLead?: Pick<
    CrmLead,
    | "emailUnsubscribed"
    | "emailUnsubscribedAt"
    | "emailSuppressionReason"
    | "emailPreferences"
    | "marketingEmailOptOutAt"
  > | null,
) {
  const next = { ...updates } as Record<string, unknown>;
  delete next.emailUnsubscribed;
  delete next.emailUnsubscribedAt;
  delete next.emailSuppressionReason;
  delete next.emailPreferences;
  delete next.marketingEmailOptOutAt;

  if (existingLead?.emailUnsubscribed || existingLead?.marketingEmailOptOutAt) {
    next["emailUnsubscribed"] = true;
    next["emailUnsubscribedAt"] = existingLead.emailUnsubscribedAt ?? existingLead.marketingEmailOptOutAt ?? null;
    next["emailSuppressionReason"] = existingLead.emailSuppressionReason ?? "user_unsubscribed";
    next["emailPreferences"] = buildUnsubscribedEmailPreferences(existingLead.emailPreferences);
    next["marketingEmailOptOutAt"] = existingLead.marketingEmailOptOutAt ?? existingLead.emailUnsubscribedAt ?? null;
  }

  return next as T;
}
