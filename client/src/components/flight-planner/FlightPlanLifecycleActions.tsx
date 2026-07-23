import React from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FlightPlan } from "@shared/schema";
import { extractFilingVersionStamp, isGenuineFilingProviderPlanId } from "@shared/flight-plan-filing";
import { isFlightPlanCloseOverdue } from "@shared/flight-plan-lifecycle";
import { summarizeProviderUpdates } from "./FilingProviderWorkspace";

type FilingActionName = "file" | "amend" | "activate" | "cancel" | "close";

export const getProviderSnapshot = (plan: FlightPlan | null | undefined) => {
  const snapshot = (plan as any)?.filingProviderSnapshot;
  return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
    ? snapshot as Record<string, any>
    : {};
};

export const hasLiveProviderPlan = (plan: FlightPlan | null | undefined) =>
  Boolean(plan?.filingIsLive && isGenuineFilingProviderPlanId(plan?.filingProviderPlanId));

export const isCertificationFlightPlan = (plan: FlightPlan | null | undefined) =>
  Boolean((plan as any)?.isCertificationTest || String((plan as any)?.source || "") === "leidos-certification");

export const hasPendingProviderReview = (plan: FlightPlan | null | undefined) =>
  !isTerminalFilingPlan(plan) &&
  getProviderSnapshot(plan).providerPendingReview === true;

export const getProviderActionAvailability = (plan: FlightPlan | null | undefined) => {
  const snapshot = getProviderSnapshot(plan);
  const availability = snapshot.providerActionAvailability;
  const lifecycle = String(snapshot.providerLifecycleStatus || "").toLowerCase();
  const availabilityReason = String(availability?.reason || "");
  const staleUnknownAvailability = Boolean(
    lifecycle &&
    lifecycle !== "unknown" &&
    (
      availability?.requiresSync === true ||
      /could not determine|refresh provider sync|provider state is unknown/i.test(availabilityReason)
    )
  );
  const allowsAvailability = (value: unknown) => value == null || staleUnknownAvailability || Boolean(value);
  const lifecycleAllowsAmend = ["proposed", "filed", "activated", "active"].includes(lifecycle);
  const lifecycleAllowsActivate = ["proposed", "filed"].includes(lifecycle);
  const lifecycleAllowsCancel = lifecycle === "proposed" || lifecycle === "filed";
  const lifecycleAllowsClose = lifecycle === "activated" || lifecycle === "active";
  const versionStamp = snapshot.versionStamp || extractFilingVersionStamp(plan);
  const providerStatusKnown = Boolean(
    lifecycle &&
    lifecycle !== "unknown" &&
    (
      snapshot.providerStatus ||
      snapshot.providerFlightState ||
      snapshot.artccState ||
      snapshot.lastKnownArtccState ||
      versionStamp ||
      snapshot.cancellationIndicator ||
      snapshot.closureIndicator ||
      snapshot.providerLifecycleSource === "provider_response" ||
      snapshot.providerLifecycleSource === "provider_retrieve" ||
      snapshot.providerLifecycleSource === "local_reconciliation"
    )
  );
  return {
    lifecycle: lifecycle || "unknown",
    providerStatusKnown,
    amend: lifecycleAllowsAmend && allowsAvailability(availability?.amend),
    activate: lifecycleAllowsActivate && allowsAvailability(availability?.activate),
    cancel: lifecycleAllowsCancel && allowsAvailability(availability?.cancel),
    close: lifecycleAllowsClose && allowsAvailability(availability?.close),
    reason: staleUnknownAvailability ? "" : availabilityReason,
    staleUnknownAvailability,
    rawAvailability: availability || null,
  };
};

export const getCanonicalPlanDepartureInstant = (plan: FlightPlan | null | undefined) => {
  const payload = plan && (plan as Record<string, unknown>).filingPayload && typeof (plan as Record<string, unknown>).filingPayload === "object"
    ? (plan as Record<string, unknown>).filingPayload as Record<string, unknown>
    : {};
  const candidates = [
    plan?.plannedDepartureAt,
    typeof payload.departureInstant === "string" ? payload.departureInstant : null,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = candidate instanceof Date ? candidate : new Date(candidate);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  return null;
};

const normalizedClientFilingStatus = (plan: FlightPlan | null | undefined) =>
  String(plan?.filingStatus || "").toLowerCase();

export const canSubmitAmendForPlan = (plan: FlightPlan | null | undefined) => {
  if (!plan) return false;
  const provider = getProviderActionAvailability(plan);
  return Boolean(
    hasLiveProviderPlan(plan) &&
    !isTerminalFilingPlan(plan) &&
    provider.providerStatusKnown &&
    provider.amend,
  );
};

export const canActivatePlan = (plan: FlightPlan | null | undefined) =>
  {
    const provider = getProviderActionAvailability(plan);
    return Boolean(
      plan &&
      String(plan.filingFlightRules || "VFR").toUpperCase() === "VFR" &&
      !isTerminalFilingPlan(plan) &&
      provider.providerStatusKnown &&
      provider.activate &&
      hasLiveProviderPlan(plan),
    );
  };

export const canClosePlan = (plan: FlightPlan | null | undefined) =>
  {
    const provider = getProviderActionAvailability(plan);
    return Boolean(
      plan &&
      String(plan.filingFlightRules || "VFR").toUpperCase() === "VFR" &&
      !isTerminalFilingPlan(plan) &&
      provider.providerStatusKnown &&
      provider.close &&
      hasLiveProviderPlan(plan),
    );
  };

export const isPlanOverdueForClose = (plan: FlightPlan | null | undefined) =>
  Boolean(plan && isFlightPlanCloseOverdue(plan.plannedArrivalAt));

export const canCancelPlan = (plan: FlightPlan | null | undefined) =>
  {
    const provider = getProviderActionAvailability(plan);
    return Boolean(
      plan &&
      !isTerminalFilingPlan(plan) &&
      provider.providerStatusKnown &&
      provider.cancel &&
      hasLiveProviderPlan(plan),
    );
  };

export const getLifecycleActionDisabledReason = (plan: FlightPlan | null | undefined, action: "activate" | "cancel" | "close") => {
  if (!plan) return "Save this plan before using filing provider lifecycle actions.";
  if (!hasLiveProviderPlan(plan)) return "This plan does not have a live provider filing reference yet.";
  if (isTerminalFilingPlan(plan)) return "This plan is already closed or cancelled.";
  const provider = getProviderActionAvailability(plan);
  if (!provider.providerStatusKnown) {
    return provider.reason || "Refresh provider sync before taking filing provider lifecycle actions. RSF could not determine the current provider state.";
  }
  const rules = String(plan.filingFlightRules || "VFR").toUpperCase();
  if (action === "cancel") {
    if (!provider.cancel) return `Cancellation unavailable because the provider lifecycle is ${provider.lifecycle}.`;
  }
  if (action === "activate") {
    if (rules !== "VFR") return "Activation is only available for VFR flight plans.";
    if (!provider.activate) return `Activation unavailable because the provider lifecycle is ${provider.lifecycle}.`;
  }
  if (action === "close") {
    if (rules !== "VFR") return "Close is only available for VFR flight plans.";
    if (!provider.close) return `Close unavailable because the provider lifecycle is ${provider.lifecycle}.`;
  }
  return null;
};

export const canFilePlan = (plan: FlightPlan | null | undefined) => {
  if (!plan) return true;
  if (hasPendingProviderReview(plan)) return false;
  const status = normalizedClientFilingStatus(plan) || "draft";
  return !hasLiveProviderPlan(plan) && !["filed", "activated", "cancelled", "closed"].includes(status);
};

export const getFileAvailabilityMessage = (plan: FlightPlan | null | undefined) => {
  if (!plan) return "Save the current values first, then RSF will submit the saved packet.";
  if (hasPendingProviderReview(plan)) return "Open Provider Updates and acknowledge the current provider version before filing another provider action.";
  if (!canFilePlan(plan)) return "This plan already has a provider lifecycle state. Use Amend, Activate, Cancel, Close, or Provider Sync as applicable.";
  return "RSF saves the visible planner values first, then files that saved packet.";
};

export const isTerminalFilingPlan = (plan: FlightPlan | null | undefined) =>
  ["cancelled", "closed"].includes(normalizedClientFilingStatus(plan));

export const shouldApplyPastDepartureReadinessBlock = (plan: FlightPlan | null | undefined) => {
  if (!plan) return true;
  return canFilePlan(plan);
};

export const getPastDepartureLifecycleMessage = (plan: FlightPlan | null | undefined, departureAt: Date | null | undefined, nowMs = Date.now()) => {
  if (!plan || !departureAt || !Number.isFinite(departureAt.getTime()) || departureAt.getTime() >= nowMs - 60_000) {
    return null;
  }
  if (canFilePlan(plan)) return null;
  const snapshot = getProviderSnapshot(plan);
  const lifecycle = String(snapshot.providerLifecycleStatus || "").trim().toLowerCase();
  if (lifecycle === "activated" || lifecycle === "active" || normalizedClientFilingStatus(plan) === "activated") {
    return "Provider lifecycle: ACTIVE.";
  }
  if (!["cancelled", "closed"].includes(normalizedClientFilingStatus(plan))) {
    return "Departure time has passed. Waiting for provider lifecycle confirmation.";
  }
  return null;
};

export const getCertificationCleanupAction = (plan: FlightPlan | null | undefined): FilingActionName =>
  normalizedClientFilingStatus(plan) === "activated" ? "close" : "cancel";

export const getAmendAvailabilityMessage = (plan: FlightPlan | null | undefined) => {
  if (!plan) {
    return "Save this plan first, then file it before trying to amend it through the filing provider.";
  }

  const status = normalizedClientFilingStatus(plan);
  const rules = String(plan.filingFlightRules || "VFR").toUpperCase();

  if (!plan.filingIsLive) {
    return "This saved plan is still local or staged. File it live with the filing provider first, then amend it from the filed record.";
  }

  if (!isGenuineFilingProviderPlanId(plan.filingProviderPlanId)) {
    return "This filed record is missing the provider flight identifier. File it again so RSF can refresh the amend tracking.";
  }

  if (!extractFilingVersionStamp(plan)) {
    return "This filed record is still waiting on the provider amend token. Refresh provider sync in a few minutes, then try amend again.";
  }

  const provider = getProviderActionAvailability(plan);
  if (!provider.providerStatusKnown) {
    return provider.reason || "Refresh provider sync before taking filing provider lifecycle actions. RSF could not determine the current provider state.";
  }

  if (rules === "IFR" && status !== "filed") {
    return "IFR plans can only be amended from the filed state.";
  }

  if (rules === "VFR" && !["filed", "activated"].includes(status)) {
    return "VFR plans can only be amended from the filed or active state.";
  }

  return "This plan is not currently in a live amendable state. Save your edits, then use File to submit the updated version.";
};

export const getProviderLifecycleAvailabilityMessage = (plan: FlightPlan | null | undefined) => {
  if (!isGenuineFilingProviderPlanId(plan?.filingProviderPlanId)) return null;
  const provider = getProviderActionAvailability(plan);
  const snapshot = getProviderSnapshot(plan);
  if (snapshot.externalChangeNotice) return String(snapshot.externalChangeNotice);
  if (!provider.providerStatusKnown) {
    return provider.reason || "Provider state is unknown. Refresh provider sync before cancel, close, or activate.";
  }
  return null;
};

type FlightPlanLifecycleActionsProps = {
  plan: FlightPlan;
  labels: {
    file: string;
    amend: string;
    activate: string;
    cancel: string;
    close: string;
    sync: string;
  };
  pending?: {
    filingAction?: boolean;
    updatePlan?: boolean;
    createPlan?: boolean;
    sync?: boolean;
    acceptProviderReview?: boolean;
  };
  hasBlockingReadinessIssue?: boolean;
  amendUnavailableReason?: string | null;
  fileUnavailableReason?: string | null;
  providerActionsPausedReason?: string | null;
  certificationPlan?: boolean;
  syncLabel?: string;
  onFile: () => void;
  onAmend: () => void;
  onSync: () => void;
  onAcceptProviderChanges: () => void;
  onProviderUpdates: () => void;
  onActivate: () => void;
  onClose: () => void;
  onCancel: () => void;
  onCertificationCleanup: () => void;
  onDownloadSummary: () => void;
};

export function FlightPlanLifecycleActions({
  plan,
  labels,
  pending,
  hasBlockingReadinessIssue = false,
  amendUnavailableReason,
  fileUnavailableReason,
  providerActionsPausedReason,
  certificationPlan,
  syncLabel,
  onFile,
  onAmend,
  onSync,
  onAcceptProviderChanges,
  onProviderUpdates,
  onActivate,
  onClose,
  onCancel,
  onCertificationCleanup,
  onDownloadSummary,
}: FlightPlanLifecycleActionsProps) {
  const terminal = isTerminalFilingPlan(plan);
  const liveProviderPlan = hasLiveProviderPlan(plan);
  const providerReviewPending = hasPendingProviderReview(plan);
  const rules = String(plan.filingFlightRules || "VFR").toUpperCase();
  const isVfr = rules === "VFR";
  const actionPending = Boolean(pending?.filingAction);
  const syncPending = Boolean(pending?.sync);
  const updatePending = Boolean(pending?.updatePlan);
  const createPending = Boolean(pending?.createPlan);
  const acceptPending = Boolean(pending?.acceptProviderReview);
  const providerActionsPaused = Boolean(providerActionsPausedReason);
  const amendBlockedReason =
    providerActionsPausedReason || (hasBlockingReadinessIssue ? "Resolve readiness check issues before amending." : amendUnavailableReason || null);
  const amendDisabled = actionPending || updatePending || syncPending || Boolean(amendBlockedReason);
  const fileBlockedReason =
    providerActionsPausedReason || (hasBlockingReadinessIssue ? "Resolve readiness check issues before filing." : fileUnavailableReason || getFileAvailabilityMessage(plan));
  const activateDisabledReason = providerActionsPausedReason || getLifecycleActionDisabledReason(plan, "activate");
  const cancelDisabledReason = providerActionsPausedReason || getLifecycleActionDisabledReason(plan, "cancel");
  const closeDisabledReason = providerActionsPausedReason || getLifecycleActionDisabledReason(plan, "close");
  const provider = getProviderActionAvailability(plan);
  const snapshot = getProviderSnapshot(plan);
  const activateDisabled = actionPending || syncPending || providerActionsPaused || !canActivatePlan(plan);
  const closeDisabled = actionPending || syncPending || providerActionsPaused || !canClosePlan(plan);
  const cancelDisabled = actionPending || syncPending || providerActionsPaused || !canCancelPlan(plan);
  const diagnosticSignature = JSON.stringify({
    planId: plan.id,
    rules,
    status: normalizedClientFilingStatus(plan),
    liveProviderPlan,
    providerPlanIdPresent: isGenuineFilingProviderPlanId(plan.filingProviderPlanId),
    versionStampPresent: Boolean(snapshot.versionStamp || extractFilingVersionStamp(plan)),
    lifecycle: provider.lifecycle,
    lifecycleSource: snapshot.providerLifecycleSource || null,
    providerStatusKnown: provider.providerStatusKnown,
    rawAvailability: provider.rawAvailability,
    computedAvailability: {
      amend: provider.amend,
      activate: provider.activate,
      cancel: provider.cancel,
      close: provider.close,
    },
    disabledReasons: {
      amend: amendBlockedReason,
      activate: activateDisabledReason,
      cancel: cancelDisabledReason,
      close: closeDisabledReason,
    },
    disabled: {
      amend: amendDisabled,
      activate: activateDisabled,
      cancel: cancelDisabled,
      close: closeDisabled,
    },
  });
  const lastDiagnosticSignatureRef = React.useRef("");
  React.useEffect(() => {
    if (!labels.activate.toLowerCase().includes("test")) return;
    if (lastDiagnosticSignatureRef.current === diagnosticSignature) return;
    lastDiagnosticSignatureRef.current = diagnosticSignature;
    console.info(JSON.stringify({
      event: "flight_plan_lifecycle_button_diagnostic",
      planId: plan.id,
      filingFlightRules: rules,
      localFilingStatus: normalizedClientFilingStatus(plan),
      filingIsLive: Boolean(plan.filingIsLive),
      providerPlanIdPresent: isGenuineFilingProviderPlanId(plan.filingProviderPlanId),
      versionStampPresent: Boolean(snapshot.versionStamp || extractFilingVersionStamp(plan)),
      effectiveLifecycle: provider.lifecycle,
      effectiveLifecycleSource: snapshot.providerLifecycleSource || null,
      effectiveLifecycleKnown: provider.providerStatusKnown,
      latestRetrieveIncludedLifecycle: snapshot.providerLifecycleSource === "provider_retrieve" && provider.lifecycle !== "unknown",
      rawProviderActionAvailability: provider.rawAvailability,
      computedActionAvailability: {
        amend: provider.amend,
        activate: provider.activate,
        cancel: provider.cancel,
        close: provider.close,
      },
      finalDisabledReasons: {
        amend: amendBlockedReason,
        activate: activateDisabledReason,
        cancel: cancelDisabledReason,
        close: closeDisabledReason,
      },
      finalButtonDisabled: {
        amend: amendDisabled,
        activate: activateDisabled,
        cancel: cancelDisabled,
        close: closeDisabled,
      },
    }));
  }, [amendBlockedReason, amendDisabled, activateDisabled, activateDisabledReason, cancelDisabled, cancelDisabledReason, closeDisabled, closeDisabledReason, diagnosticSignature, labels.activate, plan, provider, rules, snapshot]);

  return (
    <div className="flex flex-wrap gap-2">
      {canFilePlan(plan) && (
        <Button
          size="sm"
          variant="outline"
          onClick={onFile}
            disabled={actionPending || updatePending || createPending || syncPending || hasBlockingReadinessIssue || providerActionsPaused}
          title={fileBlockedReason}
        >
          {labels.file}
        </Button>
      )}
      {!terminal && liveProviderPlan && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={onAmend}
            disabled={amendDisabled}
            title={amendBlockedReason || "Save the current values, then submit an amendment to the filed provider record."}
          >
            {labels.amend}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onSync}
            disabled={actionPending || syncPending || providerActionsPaused}
            title={providerActionsPausedReason || "Refresh this plan from the filing provider."}
          >
            {syncLabel || labels.sync}
          </Button>
        </>
      )}
      {providerReviewPending && (
        <Button
          size="sm"
          variant="default"
          onClick={onAcceptProviderChanges}
          disabled={actionPending || syncPending || acceptPending || providerActionsPaused}
          title={providerActionsPausedReason || "Acknowledge that RSF applied the provider update shown here."}
        >
          {acceptPending ? "Acknowledging..." : "Acknowledge provider update"}
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        className={cn(
          "relative",
          summarizeProviderUpdates(plan).count > 0 && summarizeProviderUpdates(plan).latestSeverity === "error" && "border-red-400/50 text-red-200",
          summarizeProviderUpdates(plan).count > 0 && summarizeProviderUpdates(plan).latestSeverity === "warning" && "border-amber-400/50 text-amber-200",
          summarizeProviderUpdates(plan).count > 0 && summarizeProviderUpdates(plan).latestSeverity === "success" && "border-emerald-400/50 text-emerald-200",
          summarizeProviderUpdates(plan).count > 0 && summarizeProviderUpdates(plan).latestSeverity === "info" && "border-blue-400/50 text-blue-200",
        )}
        onClick={onProviderUpdates}
        aria-label="Provider updates"
        title="Provider updates"
      >
        <Bell className="h-4 w-4 mr-1" />
        {summarizeProviderUpdates(plan).count > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
            {summarizeProviderUpdates(plan).count}
          </span>
        ) : null}
        Provider updates
      </Button>
      {!terminal && isVfr && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={onActivate}
            disabled={activateDisabled}
            title={activateDisabledReason || "Activate this VFR provider flight plan."}
          >
            {labels.activate}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            disabled={closeDisabled}
            title={closeDisabledReason || "Close this active VFR provider flight plan."}
          >
            {labels.close}
          </Button>
        </>
      )}
      {!terminal && liveProviderPlan && (
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={cancelDisabled}
          title={cancelDisabledReason || "Cancel this proposed provider flight plan."}
        >
          {labels.cancel}
        </Button>
      )}
      {certificationPlan && !terminal && (
        <Button
          size="sm"
          variant="destructive"
          onClick={onCertificationCleanup}
          disabled={actionPending || syncPending || providerActionsPaused}
          title={providerActionsPausedReason || "Requires LAB acknowledgement. If the provider plan is already terminal, RSF will close the local certification plan without another provider call."}
        >
          Cleanup test plan
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={onDownloadSummary}
      >
        Download filing summary
      </Button>
    </div>
  );
}
