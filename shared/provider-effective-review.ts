import crypto from "crypto";

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};

const compact = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || null;
};

const normalizeUpper = (value: unknown): string | null => {
  const text = compact(value);
  return text ? text.toUpperCase() : null;
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as JsonRecord;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

const hashCanonical = (value: unknown): string =>
  crypto.createHash("sha256").update(stableStringify(value)).digest("hex");

const getChangedProviderValue = (snapshot: JsonRecord, field: string): unknown => {
  const diffs = Array.isArray(snapshot.fieldDiffs) ? snapshot.fieldDiffs : [];
  const found = diffs.find((entry) => {
    const diff = asRecord(entry);
    return String(diff.field || "") === field && diff.changedByProvider === true;
  });
  return asRecord(found).providerValue;
};

const hasChangedProviderField = (snapshot: JsonRecord, field: string): boolean => {
  const diffs = Array.isArray(snapshot.fieldDiffs) ? snapshot.fieldDiffs : [];
  return diffs.some((entry) => {
    const diff = asRecord(entry);
    return String(diff.field || "") === field && diff.changedByProvider === true;
  });
};

const changedFieldsFromSnapshot = (snapshot: JsonRecord): string[] => {
  const fields = new Set<string>();
  const route = asRecord(snapshot.route);
  if (route.changedByProvider === true) fields.add("route");
  for (const entry of Array.isArray(snapshot.fieldDiffs) ? snapshot.fieldDiffs : []) {
    const diff = asRecord(entry);
    if (diff.changedByProvider === true) {
      const field = compact(diff.field);
      if (field) fields.add(field);
    }
  }
  return Array.from(fields).sort();
};

export const buildProviderEffectivePlanSnapshot = (
  plan: JsonRecord | null | undefined,
  snapshotInput: JsonRecord | null | undefined,
) => {
  const snapshot = asRecord(snapshotInput);
  const route = asRecord(snapshot.route);
  const planRecord = asRecord(plan);
  const routeValue = route.changedByProvider === true
    ? route.providerRoute
    : route.normalizedTransmittedRoute ?? route.localEnteredRoute ?? route.providerRoute ?? planRecord.route;
  const otherInfoValue = hasChangedProviderField(snapshot, "otherInfo")
    ? getChangedProviderValue(snapshot, "otherInfo")
    : planRecord.otherInfo;

  const canonical = {
    aircraftIdentifier: normalizeUpper(planRecord.aircraftId ?? planRecord.aircraftIdentifier),
    aircraftType: normalizeUpper(planRecord.actualAircraftType ?? planRecord.aircraftType),
    alternate: normalizeUpper(planRecord.alternate),
    departure: normalizeUpper(planRecord.departure),
    departureInstant: compact(planRecord.plannedDepartureUtc ?? planRecord.departureInstant),
    destination: normalizeUpper(planRecord.destination),
    equipment: normalizeUpper(planRecord.equipment),
    flightDuration: compact(planRecord.estimatedEnrouteMinutes ?? planRecord.flightDuration),
    flightRules: normalizeUpper(planRecord.flightRules),
    fuelOnBoard: compact(planRecord.enduranceMinutes ?? planRecord.fuelOnBoard),
    otherInfo: normalizeUpper(otherInfoValue),
    plannedAltitudeFt: compact(planRecord.plannedAltitudeFt),
    remarks: normalizeUpper(planRecord.remarks),
    route: normalizeUpper(routeValue),
    soulsOnBoard: compact(planRecord.soulsOnBoard),
    surveillance: normalizeUpper(planRecord.surveillanceEquipment ?? planRecord.surveillance),
  };

  return Object.fromEntries(
    Object.entries(canonical).filter(([, value]) => value !== null && value !== ""),
  );
};

export const hashProviderEffectivePlanSnapshot = (canonical: JsonRecord): string =>
  hashCanonical(canonical);

export const buildProviderReviewDecision = ({
  plan,
  previousSnapshot,
  nextSnapshot,
}: {
  plan: JsonRecord | null | undefined;
  previousSnapshot: JsonRecord | null | undefined;
  nextSnapshot: JsonRecord | null | undefined;
}) => {
  const previous = asRecord(previousSnapshot);
  const next = asRecord(nextSnapshot);
  const canonical = buildProviderEffectivePlanSnapshot(plan, next);
  const effectiveHash = hashProviderEffectivePlanSnapshot(canonical);
  const acceptedHash = compact(previous.providerReviewAcceptedEffectivePlanHash ?? next.providerReviewAcceptedEffectivePlanHash);
  const acceptedVersion = compact(previous.providerReviewAcceptedVersionStamp ?? next.providerReviewAcceptedVersionStamp);
  const nextVersion = compact(next.versionStamp);
  const changedFields = changedFieldsFromSnapshot(next);
  const hasEffectiveChange = changedFields.length > 0;
  const legacyAcceptedSameVersion = !acceptedHash && acceptedVersion && nextVersion && acceptedVersion === nextVersion && previous.providerPendingReview !== true;
  const acceptedEffectiveHash = acceptedHash || (legacyAcceptedSameVersion ? effectiveHash : null);
  const hashMatchesAccepted = Boolean(acceptedEffectiveHash && acceptedEffectiveHash === effectiveHash);
  const reviewPending = Boolean(hasEffectiveChange && !hashMatchesAccepted);
  const reason = reviewPending
    ? acceptedEffectiveHash && acceptedEffectiveHash !== effectiveHash
      ? "effective_plan_changed_after_acceptance"
      : "provider_effective_plan_differs_from_local_baseline"
    : hashMatchesAccepted
      ? acceptedHash
        ? "accepted_effective_plan_unchanged"
        : "legacy_accepted_version_baseline_established"
      : hasEffectiveChange
        ? "effective_plan_change_not_pending"
        : "no_effective_plan_change";

  return {
    acceptedEffectiveHash,
    canonical,
    changedFields,
    effectiveHash,
    hashMatchesAccepted,
    reviewPending,
    reason,
  };
};

