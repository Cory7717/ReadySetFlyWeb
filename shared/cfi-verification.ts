export type CfiCredentialLike = {
  type?: string | null;
  expiresOn?: string | Date | null;
};

type CfiCredentialRequirement = {
  key: "cfi_certificate" | "pilot_certificate" | "medical_certificate";
  label: string;
  matches: string[];
  requiresCurrentDate?: boolean;
};

export const CFI_REQUIRED_CREDENTIALS: CfiCredentialRequirement[] = [
  {
    key: "cfi_certificate",
    label: "CFI Certificate",
    matches: ["cfi", "flight instructor"],
  },
  {
    key: "pilot_certificate",
    label: "Pilot Certificate",
    matches: ["pilot certificate", "pilot license", "airman certificate", "commercial", "private pilot"],
  },
  {
    key: "medical_certificate",
    label: "Medical Certificate (current)",
    matches: ["medical"],
    requiresCurrentDate: true,
  },
];

export type CfiVerificationCheck = {
  key: CfiCredentialRequirement["key"];
  label: string;
  met: boolean;
  reason?: string;
};

const toComparableDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const includesAny = (value: string, needles: string[]) =>
  needles.some((needle) => value.includes(needle));

const matchesCredentialRequirement = (
  credential: CfiCredentialLike,
  requirement: CfiCredentialRequirement
) => {
  const type = String(credential.type || "").toLowerCase();
  return includesAny(type, requirement.matches);
};

export function getCfiVerificationReadiness(
  credentials: CfiCredentialLike[],
  now: Date = new Date()
): { isReady: boolean; checks: CfiVerificationCheck[] } {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const checks = CFI_REQUIRED_CREDENTIALS.map((requirement) => {
    const matches = credentials.filter((credential) =>
      matchesCredentialRequirement(credential, requirement)
    );
    if (matches.length === 0) {
      return {
        key: requirement.key,
        label: requirement.label,
        met: false,
        reason: "Not uploaded",
      };
    }

    if (!requirement.requiresCurrentDate) {
      return { key: requirement.key, label: requirement.label, met: true };
    }

    const withDate = matches
      .map((credential) => toComparableDate(credential.expiresOn))
      .filter((date): date is Date => !!date)
      .sort((a, b) => b.getTime() - a.getTime());

    if (withDate.length === 0) {
      return {
        key: requirement.key,
        label: requirement.label,
        met: false,
        reason: "Add expiration date",
      };
    }

    if (withDate[0] < startOfToday) {
      return {
        key: requirement.key,
        label: requirement.label,
        met: false,
        reason: "Expired",
      };
    }

    return { key: requirement.key, label: requirement.label, met: true };
  });

  return {
    isReady: checks.every((check) => check.met),
    checks,
  };
}
