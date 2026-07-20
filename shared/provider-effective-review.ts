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

const normalizeInstant = (value: unknown): string | null => {
  const text = compact(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : text;
};

const normalizeDurationMinutes = (value: unknown): string | null => {
  const text = compact(value);
  if (!text) return null;
  const iso = text.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
  if (iso) {
    return String(Number(iso[1] || 0) * 60 + Number(iso[2] || 0));
  }
  return text;
};

export const normalizeProviderReviewRoute = (value: unknown): string | null => {
  const text = normalizeUpper(value);
  if (!text) return null;
  const tokens = text.split(/\s+/).filter(Boolean);
  const collapsed = tokens.filter((token, index) => !(token === "DCT" && tokens[index - 1] === "DCT"));
  if (collapsed.length === 1 && collapsed[0] === "DCT") return null;
  while (collapsed.length > 1 && collapsed[0] === "DCT") collapsed.shift();
  while (collapsed.length > 1 && collapsed[collapsed.length - 1] === "DCT") collapsed.pop();
  const withoutDirectFormatting = collapsed.filter((token) => token !== "DCT");
  return (withoutDirectFormatting.length > 0 ? withoutDirectFormatting : collapsed).join(" ") || null;
};

export const normalizeProviderReviewOtherInfo = (value: unknown): string | null => {
  const text = normalizeUpper(value);
  if (!text) return null;
  const matches = Array.from(text.matchAll(/\b([A-Z]{2,5})\/(.*?)(?=\s+[A-Z]{2,5}\/|$)/g));
  if (matches.length === 0) return text;
  const fields = matches
    .map((match) => ({
      prefix: match[1],
      value: compact(match[2])?.toUpperCase() || "",
    }))
    .filter((field) => field.value);
  return fields
    .sort((a, b) => `${a.prefix}/${a.value}`.localeCompare(`${b.prefix}/${b.value}`))
    .map((field) => `${field.prefix}/${field.value}`)
    .join(" ") || null;
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
  const routeCandidateValues = [
    route.normalizedTransmittedRoute,
    route.localEnteredRoute,
    route.transmittedRoute,
    route.acceptedRoute,
  ];
  const providerRoute = normalizeProviderReviewRoute(route.providerRoute ?? route.routeProvider ?? route.providerReturnedRoute);
  const routeMatchesAnyCandidate = routeCandidateValues.some(
    (value) => normalizeProviderReviewRoute(value) === providerRoute,
  );
  if (
    route.changedByProvider === true &&
    providerRoute &&
    !routeMatchesAnyCandidate
  ) {
    fields.add("route");
  }
  for (const entry of Array.isArray(snapshot.fieldDiffs) ? snapshot.fieldDiffs : []) {
    const diff = asRecord(entry);
    if (diff.changedByProvider === true) {
      const field = compact(diff.field);
      if (field === "route") {
        const normalizedProvider = normalizeProviderReviewRoute(diff.providerValue);
        const matchesTransmitted = [
          diff.transmittedValue,
          diff.localValue,
          diff.acceptedValue,
        ].some((value) => normalizeProviderReviewRoute(value) === normalizedProvider);
        if (!normalizedProvider || matchesTransmitted) {
          continue;
        }
      }
      if (field === "otherInfo" && normalizeProviderReviewOtherInfo(diff.providerValue) === normalizeProviderReviewOtherInfo(diff.transmittedValue ?? diff.localValue)) {
        continue;
      }
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
  const normalizedProviderRoute = normalizeProviderReviewRoute(route.providerRoute ?? route.routeProvider ?? route.providerReturnedRoute);
  const routeValue = route.changedByProvider === true && normalizedProviderRoute
    ? route.providerRoute ?? route.routeProvider ?? route.providerReturnedRoute
    : route.normalizedTransmittedRoute ?? route.localEnteredRoute ?? route.providerRoute ?? planRecord.route;
  const otherInfoValue = hasChangedProviderField(snapshot, "otherInfo")
    ? getChangedProviderValue(snapshot, "otherInfo")
    : planRecord.otherInfo;
  const providerOrPlan = (field: string, planValue: unknown) =>
    hasChangedProviderField(snapshot, field) ? getChangedProviderValue(snapshot, field) : planValue;

  const canonical = {
    aircraftIdentifier: normalizeUpper(planRecord.aircraftId ?? planRecord.aircraftIdentifier ?? planRecord.tailNumber),
    aircraftType: normalizeUpper(planRecord.actualAircraftType ?? planRecord.aircraftType),
    alternate: normalizeUpper(providerOrPlan("alternate", planRecord.alternate)),
    departure: normalizeUpper(providerOrPlan("departure", planRecord.departure)),
    departureInstant: normalizeInstant(providerOrPlan("departureInstant", planRecord.plannedDepartureUtc ?? planRecord.departureInstant ?? planRecord.plannedDepartureAt)),
    destination: normalizeUpper(providerOrPlan("destination", planRecord.destination)),
    equipment: normalizeUpper(planRecord.equipment ?? planRecord.filingEquipment),
    flightDuration: normalizeDurationMinutes(planRecord.estimatedEnrouteMinutes ?? planRecord.flightDuration ?? planRecord.filingEstimatedEnrouteMinutes),
    flightRules: normalizeUpper(planRecord.flightRules ?? planRecord.filingFlightRules),
    fuelOnBoard: normalizeDurationMinutes(planRecord.enduranceMinutes ?? planRecord.fuelOnBoard ?? planRecord.filingEnduranceMinutes),
    otherInfo: normalizeProviderReviewOtherInfo(otherInfoValue ?? planRecord.filingOtherInfo),
    plannedAltitudeFt: compact(providerOrPlan("plannedAltitudeFt", planRecord.plannedAltitudeFt ?? planRecord.filingPlannedAltitudeFt)),
    remarks: normalizeUpper(planRecord.remarks ?? planRecord.filingRemarks ?? planRecord.notes),
    route: normalizeProviderReviewRoute(routeValue),
    soulsOnBoard: compact(planRecord.soulsOnBoard ?? planRecord.filingSoulsOnBoard),
    surveillance: normalizeUpper(planRecord.surveillanceEquipment ?? planRecord.surveillance ?? planRecord.filingSurveillanceEquipment),
  };

  return Object.fromEntries(
    Object.entries(canonical).filter(([, value]) => value !== null && value !== ""),
  );
};

export const hashProviderEffectivePlanSnapshot = (canonical: JsonRecord): string =>
  hashCanonical(canonical);

export const providerReviewNotificationMatchesCurrentReview = ({
  providerPendingReview,
  notificationProviderPlanId,
  notificationVersionStamp,
  notificationEffectivePlanHash,
  currentProviderPlanId,
  currentVersionStamp,
  currentEffectivePlanHash,
}: {
  providerPendingReview: boolean;
  notificationProviderPlanId?: unknown;
  notificationVersionStamp?: unknown;
  notificationEffectivePlanHash?: unknown;
  currentProviderPlanId?: unknown;
  currentVersionStamp?: unknown;
  currentEffectivePlanHash?: unknown;
}): boolean => {
  if (!providerPendingReview) return true;

  const notificationPlanId = compact(notificationProviderPlanId);
  const currentPlanId = compact(currentProviderPlanId);
  if (notificationPlanId && currentPlanId && notificationPlanId !== currentPlanId) {
    return false;
  }

  const notificationVersion = compact(notificationVersionStamp);
  const currentVersion = compact(currentVersionStamp);
  const notificationHash = compact(notificationEffectivePlanHash);
  const currentHash = compact(currentEffectivePlanHash);

  if (!notificationVersion && !notificationHash) return false;
  if (notificationHash && currentHash && notificationHash === currentHash) return true;
  if (notificationVersion && currentVersion && notificationVersion === currentVersion) return true;
  return false;
};

export const buildProviderAcceptedEffectivePlanSnapshot = (
  payloadInput: JsonRecord | null | undefined,
  fallbackPlan?: JsonRecord | null | undefined,
) => {
  const payload = asRecord(payloadInput);
  const plan = asRecord(fallbackPlan);
  const canonical = {
    aircraftIdentifier: normalizeUpper(payload.aircraftIdentifier ?? plan.aircraftId ?? plan.aircraftIdentifier ?? plan.tailNumber),
    aircraftType: normalizeUpper(payload.aircraftType ?? plan.actualAircraftType ?? plan.aircraftType),
    alternate: normalizeUpper(payload.altDestination1 ?? plan.alternate),
    departure: normalizeUpper(payload.departure ?? plan.departure),
    departureInstant: normalizeInstant(payload.departureInstant ?? plan.plannedDepartureUtc ?? plan.departureInstant ?? plan.plannedDepartureAt),
    destination: normalizeUpper(payload.destination ?? plan.destination),
    equipment: normalizeUpper(payload.aircraftEquipment ?? plan.equipment ?? plan.filingEquipment),
    flightDuration: normalizeDurationMinutes(payload.flightDuration ?? plan.estimatedEnrouteMinutes ?? plan.filingEstimatedEnrouteMinutes),
    flightRules: normalizeUpper(payload.flightRules ?? plan.flightRules ?? plan.filingFlightRules),
    fuelOnBoard: normalizeDurationMinutes(payload.fuelOnBoard ?? plan.enduranceMinutes ?? plan.filingEnduranceMinutes),
    otherInfo: normalizeProviderReviewOtherInfo(payload.otherInfo ?? plan.otherInfo ?? plan.filingOtherInfo),
    plannedAltitudeFt: compact(payload.plannedAltitudeFt ?? payload.altitudeFt ?? plan.plannedAltitudeFt ?? plan.filingPlannedAltitudeFt),
    remarks: normalizeUpper(payload.remarks ?? plan.remarks ?? plan.filingRemarks ?? plan.notes),
    route: normalizeProviderReviewRoute(payload.route ?? plan.route),
    soulsOnBoard: compact(payload.peopleOnBoardExtended ?? plan.soulsOnBoard ?? plan.filingSoulsOnBoard),
    surveillance: normalizeUpper(payload.surveillanceEquipment ?? plan.surveillanceEquipment ?? plan.surveillance ?? plan.filingSurveillanceEquipment),
  };

  return Object.fromEntries(
    Object.entries(canonical).filter(([, value]) => value !== null && value !== ""),
  );
};

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
  let changedFields = changedFieldsFromSnapshot(next);
  const previousChangedFields = changedFieldsFromSnapshot(previous);
  const preserveExistingPendingReview = Boolean(
    previous.providerPendingReview === true &&
    changedFields.length === 0 &&
    previousChangedFields.length > 0,
  );
  if (preserveExistingPendingReview) {
    changedFields = previousChangedFields;
  }
  const hasEffectiveChange = changedFields.length > 0;
  const legacyAcceptedSameVersion = !acceptedHash && acceptedVersion && nextVersion && acceptedVersion === nextVersion && previous.providerPendingReview !== true;
  const acceptedEffectiveHash = acceptedHash || (legacyAcceptedSameVersion ? effectiveHash : null);
  const hashMatchesAccepted = Boolean(acceptedEffectiveHash && acceptedEffectiveHash === effectiveHash);
  const reviewPending = Boolean(preserveExistingPendingReview || (hasEffectiveChange && !hashMatchesAccepted));
  const reason = reviewPending
    ? preserveExistingPendingReview
      ? "pending_review_preserved_incomplete_provider_snapshot"
      : acceptedEffectiveHash && acceptedEffectiveHash !== effectiveHash
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
