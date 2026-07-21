import React from "react";
import { Badge } from "@/components/ui/badge";
import type { FlightPlan } from "@shared/schema";
import { isGenuineFilingProviderPlanId } from "@shared/flight-plan-filing";
import { formatFlightPlanDepartureTime } from "@shared/flight-plan-time";
import { sanitizeNotificationMessage, summarizeProviderChangeDetails } from "@shared/provider-notification-format";
import { ProviderChangeSummaryView } from "./ProviderChangeSummaryView";

type ProviderMessage = {
  id: string;
  timestamp: string;
  severity: "info" | "success" | "warning" | "error";
  title: string;
  details: string;
  providerPlanId?: string | null;
  raw?: Record<string, unknown> | null;
};

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const asString = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const formatDateTime = (value: unknown) => {
  const text = asString(value);
  if (!text) return "—";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleString();
};

const formatStatusValue = (value: unknown) => {
  const text = asString(value);
  if (!text) return "Unknown";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

const formatRetrievalState = (value: unknown) => {
  const state = String(value || "").trim().toLowerCase();
  if (state === "retrievable") return "Retrievable";
  if (state === "not_found") return "No longer retrievable";
  if (state === "unavailable") return "Unavailable";
  if (state === "provider_error") return "Provider error";
  if (state === "not_attempted") return "Not attempted";
  return "Not checked";
};

const readPayload = (plan: FlightPlan) => asRecord((plan as Record<string, unknown>).filingPayload);
const readProviderSnapshot = (plan: FlightPlan) => asRecord((plan as Record<string, unknown>).filingProviderSnapshot);
export const readProviderMessages = (plan: FlightPlan): ProviderMessage[] =>
  Array.isArray((plan as Record<string, unknown>).filingProviderMessages)
    ? (plan as Record<string, unknown>).filingProviderMessages as ProviderMessage[]
    : [];

export const collapseDuplicateProviderMessages = (messages: ProviderMessage[]) => {
  const seen = new Set<string>();
  return messages.filter((message) => {
    const title = String(message.title || "").trim().toLowerCase();
    if (
      title !== "provider changes accepted" &&
      title !== "provider update acknowledged" &&
      title !== "provider update marked reviewed"
    ) return true;
    const key = [
      "provider_update_reviewed",
      String(message.providerPlanId || "").trim().toLowerCase(),
      String(message.details || "").trim().toLowerCase(),
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const displayProviderMessageTitle = (title: unknown) => {
  const normalized = String(title || "").trim();
  if (["provider changes accepted", "provider update acknowledged"].includes(normalized.toLowerCase())) {
    return "Provider update acknowledged";
  }
  return normalized || "Provider update";
};

const displayProviderMessageDetails = (details: unknown) => {
  const normalized = sanitizeNotificationMessage(details);
  if (/Pilot reviewed and accepted the current provider version in RSF/i.test(normalized)) {
    return "Pilot acknowledged the current provider version in RSF. Amendments can be submitted again from this provider state.";
  }
  return normalized;
};

export const summarizeProviderUpdates = (plan: FlightPlan) => {
  const messages = collapseDuplicateProviderMessages(readProviderMessages(plan));
  const latest = messages[0] || null;
  return {
    count: messages.length,
    latestSeverity: latest?.severity || "info",
  };
};

const severityTone: Record<ProviderMessage["severity"], string> = {
  info: "border-blue-400/40 bg-blue-950/30 text-blue-200",
  success: "border-emerald-400/40 bg-emerald-950/30 text-emerald-200",
  warning: "border-amber-400/40 bg-amber-950/30 text-amber-200",
  error: "border-red-400/40 bg-red-950/30 text-red-200",
};

const valueTone = (changed: boolean) => (changed ? "text-amber-200" : "text-foreground");

export function FilingProviderWorkspace({ plan, pilotPhone, pilotHomeBase }: { plan: FlightPlan; pilotPhone?: string | null; pilotHomeBase?: string | null }) {
  const payload = readPayload(plan);
  const providerSnapshot = readProviderSnapshot(plan);
  const providerReference = isGenuineFilingProviderPlanId(providerSnapshot.providerReferenceId)
    ? asString(providerSnapshot.providerReferenceId)
    : isGenuineFilingProviderPlanId(plan.filingProviderPlanId)
    ? plan.filingProviderPlanId
    : null;
  const payloadRoute = asRecord(payload.route);
  const providerRoute = asRecord(providerSnapshot.route);
  const localRoute = asString(plan.route);
  const transmittedRoute = asString(payloadRoute.normalizedTransmittedRoute);
  const effectiveRoute = asString(providerRoute.providerRoute);
  const fieldDiffs = Array.isArray(providerSnapshot.fieldDiffs) ? providerSnapshot.fieldDiffs as Array<Record<string, unknown>> : [];
  const filedPilotPhone = asString((plan as any).filingPilotPhone) || pilotPhone;
  const filedHomeBase = asString((plan as any).filingAircraftHomeBase) || pilotHomeBase;
  const assignedBeaconCode = asString((plan as any).filingAssignedBeaconCode) || asString(providerSnapshot.beaconCode);
  const providerLifecycle = asString(providerSnapshot.providerLifecycleStatus);
  const providerFlightState = asString(providerSnapshot.providerFlightState || providerSnapshot.providerStatus || providerSnapshot.lastKnownProviderFlightState);
  const lastKnownArtccState = asString(providerSnapshot.lastKnownArtccState || providerSnapshot.artccState);
  const plannedDeparture = formatFlightPlanDepartureTime(plan);
  const filedDeparture = formatFlightPlanDepartureTime(plan, {
    instantUtc: asString(payload.departureInstant) || plan.plannedDepartureAt,
  });

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <section className="rounded-lg border p-3">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Local Plan</div>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">User-entered route</div>
            <div className="font-medium break-words">{localRoute || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Planned departure</div>
            <div className="font-medium">{plannedDeparture.displayDepartureAirportTime}</div>
            <div className="font-mono text-xs text-muted-foreground">{plannedDeparture.displayZulu}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Local other info</div>
            <div className="font-medium break-words">{plan.filingOtherInfo || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Internal remarks</div>
            <div className="font-medium break-words">{plan.filingRemarks || plan.notes || "—"}</div>
          </div>
          {(filedPilotPhone || filedHomeBase) && (
            <div className="mt-1 space-y-1 border-t border-border/40 pt-2">
              {filedPilotPhone && (
                <div>
                  <div className="text-xs text-muted-foreground">Pilot phone</div>
                  <div className="font-medium">{filedPilotPhone}</div>
                </div>
              )}
              {filedHomeBase && (
                <div>
                  <div className="text-xs text-muted-foreground">Aircraft home base</div>
                  <div className="font-medium">{filedHomeBase}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border p-3">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Filed Payload Summary</div>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Filed / normalized route</div>
            <div className={`font-medium break-words ${valueTone(localRoute !== transmittedRoute && Boolean(transmittedRoute))}`}>
              {transmittedRoute || "Not transmitted yet"}
            </div>
            {localRoute && transmittedRoute && localRoute !== transmittedRoute && (
              <div className="mt-1 text-[11px] text-amber-200">Normalized by RSF for provider filing</div>
            )}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Filed departure</div>
            <div className="font-medium">{filedDeparture.displayDepartureAirportTime}</div>
            <div className="font-mono text-xs text-muted-foreground">{filedDeparture.displayZulu}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">ICAO DOF</div>
            <div className={`font-medium ${valueTone(Boolean(payload.dofInjected))}`}>{asString(payload.dof) || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Filed Other Info</div>
            <div className="font-medium break-words">{asString(payload.otherInfo) || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Payload built</div>
            <div className="font-medium">{formatDateTime(payload.builtAt)}</div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border p-3">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Provider Sync / Effective Plan</div>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Provider-updated route</div>
            <div className={`font-medium break-words ${valueTone(Boolean(effectiveRoute && transmittedRoute && effectiveRoute !== transmittedRoute))}`}>
              {effectiveRoute || "No provider route returned yet"}
            </div>
            {effectiveRoute && transmittedRoute && effectiveRoute !== transmittedRoute && (
              <div className="mt-1 text-[11px] text-amber-200">Updated by provider</div>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">Provider lifecycle</div>
              <div className="font-medium">{formatStatusValue(providerLifecycle)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Provider flight state</div>
              <div className="font-medium">{providerFlightState || "Not returned"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Last known ARTCC state</div>
              <div className="font-medium">{lastKnownArtccState || "Not returned"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Provider retrieval</div>
              <div className="font-medium">{formatRetrievalState(providerSnapshot.providerRetrievalState)}</div>
            </div>
          </div>
          {(providerSnapshot.providerStatus || providerSnapshot.artccState || plan.filingStatus) && (
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">Current provider status</div>
              <div className="font-medium">{asString(providerSnapshot.providerStatus) || plan.filingStatus || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Current ARTCC state</div>
              <div className="font-medium">{asString(providerSnapshot.artccState) || "—"}</div>
            </div>
          </div>
          )}
          {assignedBeaconCode && (
            <div>
              <div className="text-xs text-muted-foreground">Assigned Beacon Code</div>
              <div className="font-medium font-mono">{assignedBeaconCode}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-muted-foreground">Provider sync</div>
            <div className="font-medium">{formatDateTime(providerSnapshot.syncedAt || plan.filingLastProviderSyncAt)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Provider reference</div>
            <div className="font-medium break-all">{providerReference || "—"}</div>
          </div>
          {fieldDiffs.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Detected differences</div>
              <div className="flex flex-wrap gap-2">
                {fieldDiffs
                  .filter((entry) => Boolean(entry.changedForTransmission || entry.changedByProvider))
                  .map((entry, index) => (
                    <Badge key={`${entry.field || "diff"}-${index}`} variant="secondary">
                      {String(entry.field || "field")}
                    </Badge>
                  ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function FilingProviderUpdatesList({ plan }: { plan: FlightPlan }) {
  const messages = collapseDuplicateProviderMessages(readProviderMessages(plan));

  if (messages.length === 0) {
    return <div className="text-sm text-muted-foreground">No provider updates recorded for this plan yet.</div>;
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <div key={message.id} className={`rounded-lg border p-3 ${severityTone[message.severity] || severityTone.info}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium">{displayProviderMessageTitle(message.title)}</div>
            <div className="text-xs opacity-80">{formatDateTime(message.timestamp)}</div>
          </div>
          {(() => {
            const summary = summarizeProviderChangeDetails(message.details, message.raw?.changedFields);
            return summary ? (
              <ProviderChangeSummaryView summary={summary} />
            ) : (
              <div className="mt-2 text-sm break-words">
                {displayProviderMessageDetails(message.details) || "The filing provider pushed an update for this flight plan."}
              </div>
            );
          })()}
          {isGenuineFilingProviderPlanId(message.providerPlanId) && (
            <div className="mt-2 text-[11px] opacity-80">Provider reference: {message.providerPlanId}</div>
          )}
        </div>
      ))}
    </div>
  );
}
