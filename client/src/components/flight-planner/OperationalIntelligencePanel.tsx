import React, { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";

export type TfmsTier = "free" | "premium";

type TfmsAlert = {
  type: string;
  severity: "info" | "advisory" | "warning";
  title: string;
  details: string;
  effectiveStart: string;
  effectiveEnd: string;
  reference: string;
};

type TfmsStatusResponse = {
  generatedAt: string;
  source: string;
  dep: string;
  dest: string;
  alerts: TfmsAlert[];
  congestion: {
    summary: "low" | "moderate" | "high" | "unknown";
    confidence: number;
  };
};

type TfmsRiskResponse = {
  generatedAt: string;
  riskScore: number;
  rating: "low" | "moderate" | "high" | "unknown";
  factors: Array<{ key: string; weight: number; value: string; note: string }>;
  disclaimer: string;
};

type OperationalIntelligencePanelProps = {
  dep: string;
  dest: string;
  route: string;
  tier: TfmsTier;
  mapStyle: string;
  overlayEnabled: boolean;
  onToggleOverlay: (enabled: boolean) => void;
};

const lockedBullets = [
  "Ground Delay Programs",
  "Flow Restrictions",
  "Congestion Overlay",
  "Departure Risk Score",
];

const getSeverityBadge = (severity: TfmsAlert["severity"]) => {
  if (severity === "warning") return "destructive";
  if (severity === "advisory") return "secondary";
  return "outline";
};

const formatConfidence = (value: number) => `${Math.round(value * 100)}%`;

const plannerPanelClass = "rounded-[1.35rem] border-[#5d6f85]/20 bg-transparent text-[#E8EDF4]";
const plannerSubpanelClass = "rsf-planner-subpanel";
const plannerMutedClass = "text-[#A9BBCD]";
const plannerTitleClass = "text-[#F5F8FC]";
const plannerSelectActionClass = "rsf-metal-button-secondary";

export function OperationalIntelligencePanelView({
  tier,
  status,
  risk,
  hasRoute,
  mapStyle,
  overlayEnabled,
  onToggleOverlay,
  onRetryStatus,
  isLoading,
  hasError,
}: {
  tier: TfmsTier;
  status?: TfmsStatusResponse | null;
  risk?: TfmsRiskResponse | null;
  hasRoute: boolean;
  mapStyle: string;
  overlayEnabled: boolean;
  onToggleOverlay: (enabled: boolean) => void;
  onRetryStatus: () => void;
  isLoading: boolean;
  hasError: boolean;
}) {
  const alerts = status?.alerts ?? [];
  const congestion = status?.congestion;

  return (
    <Card className={plannerPanelClass}>
      <CardHeader>
        <CardTitle className={plannerTitleClass}>Operational Intelligence (TFMS)</CardTitle>
        <CardDescription className={plannerMutedClass}>
          Flow, delay, and restriction signals to support preflight awareness.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tier === "free" && (
          <div className="space-y-3">
            <div className={`${plannerSubpanelClass} p-4`}>
              <div className="text-sm font-semibold text-[#F5F8FC]">Upgrade to unlock TFMS operational intelligence</div>
              <div className={`mt-1 text-xs ${plannerMutedClass}`}>
                TFR map overlays and route-corridor TFR checks are available separately in the route map and analysis panels.
                Premium unlocks the FAA traffic-flow intelligence below.
              </div>
              <ul className={`mt-2 list-disc space-y-1 pl-4 text-xs ${plannerMutedClass}`}>
                {lockedBullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <Button asChild className="rsf-metal-button-primary">
              <a href="/membership">Upgrade to Premium</a>
            </Button>
          </div>
        )}

        {tier !== "free" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-[#F5F8FC]">Operational Alerts</div>
              <Button size="sm" variant="outline" className={plannerSelectActionClass} onClick={onRetryStatus}>
                Refresh
              </Button>
            </div>
            {!hasRoute && (
              <div className={`text-sm ${plannerMutedClass}`}>
                Enter a departure and destination to load TFMS alerts.
              </div>
            )}
            {hasError && (
              <Alert variant="destructive">
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>Operational feed unavailable.</span>
                  <Button size="sm" variant="secondary" onClick={onRetryStatus}>
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {!hasError && isLoading && hasRoute && (
              <div className={`text-sm ${plannerMutedClass}`}>Loading operational alerts...</div>
            )}

            {!hasError && !isLoading && hasRoute && alerts.length === 0 && (
              <div className={`text-sm ${plannerMutedClass}`}>No active TFMS advisories detected.</div>
            )}

            {!hasError && hasRoute && alerts.length > 0 && (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div key={alert.reference} className={`${plannerSubpanelClass} p-3`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-[#F5F8FC]">{alert.title}</div>
                      <Badge variant={getSeverityBadge(alert.severity)}>{alert.severity}</Badge>
                    </div>
                    <div className={`mt-1 text-xs ${plannerMutedClass}`}>{alert.details}</div>
                    <div className={`mt-2 text-xs ${plannerMutedClass}`}>
                      Effective {new Date(alert.effectiveStart).toLocaleString()} - {new Date(alert.effectiveEnd).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {hasRoute && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-[#5d6f85]/35 bg-[#141b24] text-[#d7e1ef]">Congestion: {congestion?.summary || "unknown"}</Badge>
                {congestion?.confidence !== undefined && (
                  <span className={`text-xs ${plannerMutedClass}`}>Confidence {formatConfidence(congestion.confidence)}</span>
                )}
              </div>
            )}

            {tier === "premium" && (
              <div className="space-y-3">
                <div className={`${plannerSubpanelClass} flex flex-wrap items-center justify-between gap-2 p-3`}>
                  <div>
                    <div className="text-sm font-semibold text-[#F5F8FC]">Congestion Overlay</div>
                    <div className={`text-xs ${plannerMutedClass}`}>Map layer driven by TFMS corridor hints.</div>
                  </div>
                  <Switch checked={overlayEnabled} onCheckedChange={onToggleOverlay} />
                </div>
                {overlayEnabled && mapStyle !== "globe" && (
                  <div className={`text-xs ${plannerMutedClass}`}>
                    Overlay displays in the 3D globe view.
                  </div>
                )}

                <div className={`${plannerSubpanelClass} space-y-2 p-3`}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-[#F5F8FC]">Departure Risk Score</div>
                    <Badge variant="outline" className="border-[#5d6f85]/35 bg-[#141b24] text-[#d7e1ef]">{risk?.rating || "unknown"}</Badge>
                  </div>
                  {!hasRoute && (
                    <div className={`text-xs ${plannerMutedClass}`}>
                      Enter a departure and destination to load risk scoring.
                    </div>
                  )}
                  <Progress value={risk?.riskScore ?? 0} />
                  <div className={`text-xs ${plannerMutedClass}`}>
                    Score {risk?.riskScore ?? 0} / 100
                  </div>
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="factors">
                      <AccordionTrigger className="text-sm">Factors</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 text-xs">
                          {(risk?.factors || []).map((factor) => (
                            <div key={factor.key} className="flex items-start justify-between gap-2">
                              <div className="font-semibold text-[#F5F8FC]">{factor.key}</div>
                              <div className={`text-right ${plannerMutedClass}`}>{factor.value}</div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>
            )}
          </>
        )}

        <div className={`text-xs ${plannerMutedClass}`}>
          Decision-support only; verify with official sources.
        </div>
      </CardContent>
    </Card>
  );
}

export default function OperationalIntelligencePanel({
  dep,
  dest,
  route,
  tier,
  mapStyle,
  overlayEnabled,
  onToggleOverlay,
}: OperationalIntelligencePanelProps) {
  const hasRoute = /^[A-Z0-9]{3,4}$/.test(dep) && /^[A-Z0-9]{3,4}$/.test(dest);
  const canFetch = tier !== "free" && hasRoute;
  const canFetchRisk = tier === "premium" && hasRoute;
  const lastRiskGeneratedAt = useRef<string | null>(null);

  const statusQuery = useQuery<TfmsStatusResponse>({
    queryKey: ["/api/tfms/status", dep, dest, route],
    queryFn: async () => {
      const params = new URLSearchParams({ dep, dest });
      if (route) params.set("route", route);
      const res = await fetch(apiUrl(`/api/tfms/status?${params.toString()}`), { credentials: "include" });
      if (!res.ok) throw new Error("TFMS status unavailable");
      return res.json();
    },
    enabled: canFetch,
    staleTime: 1000 * 60 * 5,
  });

  const riskQuery = useQuery<TfmsRiskResponse>({
    queryKey: ["/api/tfms/risk", dep, dest, route],
    queryFn: async () => {
      const params = new URLSearchParams({ dep, dest });
      if (route) params.set("route", route);
      const res = await fetch(apiUrl(`/api/tfms/risk?${params.toString()}`), { credentials: "include" });
      if (!res.ok) throw new Error("TFMS risk unavailable");
      return res.json();
    },
    enabled: canFetchRisk,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    trackEvent("tfms_panel_viewed", { tier });
  }, [tier]);

  const handleToggleOverlay = (enabled: boolean) => {
    onToggleOverlay(enabled);
    trackEvent("tfms_overlay_toggle", { enabled });
  };

  useEffect(() => {
    const generatedAt = riskQuery.data?.generatedAt;
    if (!generatedAt || generatedAt === lastRiskGeneratedAt.current) return;
    const riskData = riskQuery.data;
    if (!riskData) return;
    lastRiskGeneratedAt.current = generatedAt;
    trackEvent("tfms_risk_generated", { score: riskData.riskScore, rating: riskData.rating });
  }, [riskQuery.data?.generatedAt, riskQuery.data?.riskScore, riskQuery.data?.rating]);

  return (
    <OperationalIntelligencePanelView
      tier={tier}
      status={statusQuery.data}
      risk={riskQuery.data}
      hasRoute={hasRoute}
      mapStyle={mapStyle}
      overlayEnabled={overlayEnabled}
      onToggleOverlay={handleToggleOverlay}
      onRetryStatus={() => statusQuery.refetch()}
      isLoading={statusQuery.isLoading}
      hasError={statusQuery.isError}
    />
  );
}
