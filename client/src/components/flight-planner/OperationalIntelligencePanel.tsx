import { useEffect, useRef } from "react";
import { Link } from "wouter";
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

export type TfmsTier = "free" | "pro_core" | "pro_plus";

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
  "Congestion Overlay (Pro+)",
  "Departure Risk Score (Pro+)",
];

const getSeverityBadge = (severity: TfmsAlert["severity"]) => {
  if (severity === "warning") return "destructive";
  if (severity === "advisory") return "secondary";
  return "outline";
};

const formatConfidence = (value: number) => `${Math.round(value * 100)}%`;

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
    <Card>
      <CardHeader>
        <CardTitle>Operational Intelligence (TFMS)</CardTitle>
        <CardDescription>
          Flow, delay, and restriction signals to support preflight awareness.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tier === "free" && (
          <div className="space-y-3">
            <div className="rounded-lg border p-4">
              <div className="text-sm font-semibold">Upgrade to unlock TFMS</div>
              <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground space-y-1">
                {lockedBullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <Button asChild>
              <Link href="/logbook/pro">Upgrade to Pro Core</Link>
            </Button>
          </div>
        )}

        {tier !== "free" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Operational Alerts</div>
              <Button size="sm" variant="outline" onClick={onRetryStatus}>
                Refresh
              </Button>
            </div>
            {!hasRoute && (
              <div className="text-sm text-muted-foreground">
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
              <div className="text-sm text-muted-foreground">Loading operational alerts...</div>
            )}

            {!hasError && !isLoading && hasRoute && alerts.length === 0 && (
              <div className="text-sm text-muted-foreground">No active TFMS advisories detected.</div>
            )}

            {!hasError && hasRoute && alerts.length > 0 && (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div key={alert.reference} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{alert.title}</div>
                      <Badge variant={getSeverityBadge(alert.severity)}>{alert.severity}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{alert.details}</div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Effective {new Date(alert.effectiveStart).toLocaleString()} - {new Date(alert.effectiveEnd).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {hasRoute && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Congestion: {congestion?.summary || "unknown"}</Badge>
                {congestion?.confidence !== undefined && (
                  <span className="text-xs text-muted-foreground">Confidence {formatConfidence(congestion.confidence)}</span>
                )}
              </div>
            )}

            {tier === "pro_core" && (
              <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                Congestion overlay and risk score are available in Pro+.
                <div className="mt-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href="/logbook/pro">Upgrade to Pro+</Link>
                  </Button>
                </div>
              </div>
            )}

            {tier === "pro_plus" && (
              <div className="space-y-3">
                <div className="rounded-lg border p-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">Congestion Overlay</div>
                    <div className="text-xs text-muted-foreground">Map layer driven by TFMS corridor hints.</div>
                  </div>
                  <Switch checked={overlayEnabled} onCheckedChange={onToggleOverlay} />
                </div>
                {overlayEnabled && mapStyle !== "globe" && (
                  <div className="text-xs text-muted-foreground">
                    Overlay displays in the 3D globe view.
                  </div>
                )}

                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Departure Risk Score</div>
                    <Badge variant="outline">{risk?.rating || "unknown"}</Badge>
                  </div>
                  {!hasRoute && (
                    <div className="text-xs text-muted-foreground">
                      Enter a departure and destination to load risk scoring.
                    </div>
                  )}
                  <Progress value={risk?.riskScore ?? 0} />
                  <div className="text-xs text-muted-foreground">
                    Score {risk?.riskScore ?? 0} / 100
                  </div>
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="factors">
                      <AccordionTrigger className="text-sm">Factors</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 text-xs">
                          {(risk?.factors || []).map((factor) => (
                            <div key={factor.key} className="flex items-start justify-between gap-2">
                              <div className="font-semibold">{factor.key}</div>
                              <div className="text-muted-foreground text-right">{factor.value}</div>
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

        <div className="text-xs text-muted-foreground">
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
  const canFetchRisk = tier === "pro_plus" && hasRoute;
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
