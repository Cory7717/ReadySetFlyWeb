import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { trackEvent } from "@/lib/analytics";
import { apiUrl } from "@/lib/api";
import { useAvionicsSimulator } from "@/lib/avionics-sim";
import { gpsTrainerDisclaimer, gpsTrainerUnits, type GpsTrainerTask } from "@shared/gps-sims";
import { useAuth } from "@/hooks/useAuth";
import { useStudentProfile } from "@/hooks/useStudentProfile";

function createStepState(task: GpsTrainerTask) {
  return new Array(task.steps.length).fill(false);
}

export default function GpsSimsUnit() {
  const [, params] = useRoute("/gps-sims/:unitId");
  const unit = gpsTrainerUnits.find((item) => item.id === params?.unitId);
  const routeSeed = useMemo(() => {
    switch (params?.unitId) {
      case "rsf-navstack-530":
        return ["KDAL", "KACT", "KCLL"];
      case "rsf-touch-750":
        return ["KMCI", "KMKC", "KICT"];
      case "rsf-ifd-style":
        return ["KPAO", "KSNS", "KMRY"];
      case "rsf-glass-classic":
        return ["KAUS", "KGTU", "KHYI"];
      default:
        return ["KAUS", "KGTU", "KHYI"];
    }
  }, [params?.unitId]);

  const { state: avionics, derived, actions, scenarios: avionicsScenarios } =
    useAvionicsSimulator(routeSeed);

  const [newWaypoint, setNewWaypoint] = useState("");
  const { user, isAuthenticated } = useAuth();
  const { profile, saveProfile, saving } = useStudentProfile();
  const entitlements = (user as any)?.entitlements;
  const isPro = entitlements?.canUseGpsSims ?? (user?.logbookProStatus === "active");
  const canPersist = Boolean(isPro);

  const [mode, setMode] = useState<"learn" | "checkride">("learn");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    unit?.tasks[0]?.id ?? null
  );
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(
    unit?.panel?.hotspots[0]?.id ?? null
  );
  const [stepProgress, setStepProgress] = useState<Record<string, boolean[]>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [loadedFromProfile, setLoadedFromProfile] = useState(false);
  const [actionLog, setActionLog] = useState<Array<{ id: string; label: string; matched: boolean }>>(
    []
  );
  const [showAvionicsExplain, setShowAvionicsExplain] = useState(true);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(
    avionicsScenarios[0]?.id ?? null
  );
  const [knobValues, setKnobValues] = useState<Record<string, number>>({});
  const panelRef = useRef<HTMLDivElement | null>(null);
  const knobDragRef = useRef<{ hotspotId: string; lastAngle: number } | null>(null);
  const {
    pressButton,
    rotateKnob,
    pushKnob,
    addWaypoint,
    removeWaypoint,
    activateLeg,
    setPage,
    setDirectToTarget,
    applyScenario,
    setInputBuffer,
    clearMessages,
  } = actions;
  const {
    routePoints,
    aircraftPoint,
    targetPoint,
    mapRangeNm,
    nearestAirports,
    directToOptions,
    activeLegIdent,
  } = derived;

  const getHotspotClass = (id: string) => `rsf-hotspot-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  const hotspotCss = useMemo(() => {
    if (!unit?.panel?.hotspots) return "";
    const rules = unit.panel.hotspots.map((hotspot) => {
      const className = getHotspotClass(hotspot.id);
      return `.${className}{left:${hotspot.x}%;top:${hotspot.y}%;width:${hotspot.width}%;height:${hotspot.height}%;touch-action:none;}`;
    });
    const cdiRule = `.rsf-cdi-indicator{left:calc(50% + ${cdiOffset}px);}`;
    return `${rules.join("\n")}\n${cdiRule}`;
  }, [unit?.panel?.hotspots, cdiOffset]);

  useEffect(() => {
    if (unit) {
      trackEvent("gps_sims_unit_view", { unit: unit.id });
    }
  }, [unit]);

  useEffect(() => {
    if (!unit?.tasks?.length) return;
    if (!selectedTaskId || !unit.tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(unit.tasks[0].id);
    }
  }, [unit?.id, selectedTaskId]);

  useEffect(() => {
    if (!unit?.panel?.hotspots?.length) return;
    if (!selectedHotspotId || !unit.panel.hotspots.some((hotspot) => hotspot.id === selectedHotspotId)) {
      setSelectedHotspotId(unit.panel.hotspots[0].id);
    }
  }, [unit?.id, selectedHotspotId]);

  useEffect(() => {
    setLoadedFromProfile(false);
  }, [unit?.id]);

  useEffect(() => {
    setActionLog([]);
    setKnobValues({});
  }, [unit?.id]);

  useEffect(() => {
    setActiveScenarioId(avionicsScenarios[0]?.id ?? null);
  }, [unit?.id, avionicsScenarios]);

  useEffect(() => {
    if (!unit || !canPersist || loadedFromProfile) return;
    const saved = (profile?.progressJson as any)?.gpsTrainer?.[unit.id];
    if (saved) {
      if (saved.mode === "learn" || saved.mode === "checkride") {
        setMode(saved.mode);
      }
      if (saved.selectedTaskId && unit.tasks.some((task) => task.id === saved.selectedTaskId)) {
        setSelectedTaskId(saved.selectedTaskId);
      }
      if (saved.stepProgress && typeof saved.stepProgress === "object") {
        setStepProgress(saved.stepProgress);
      }
    }
    setLoadedFromProfile(true);
  }, [unit, canPersist, loadedFromProfile, profile?.progressJson]);

  if (!unit) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Trainer not found</CardTitle>
            <CardDescription>
              That GPS simulator does not exist. Choose a unit from the hub.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/gps-sims">Back to GPS Sims</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedTask =
    unit.tasks.find((task) => task.id === selectedTaskId) ?? unit.tasks[0];
  const progress =
    stepProgress[selectedTask.id] ?? createStepState(selectedTask);
  const selectedHotspot =
    unit.panel.hotspots.find((hotspot) => hotspot.id === selectedHotspotId) ??
    unit.panel.hotspots[0];
  const panelBaseUrl = import.meta.env.VITE_GPS_PANEL_BASE_URL as string | undefined;
  const panelImage = panelBaseUrl
    ? `${panelBaseUrl.replace(/\/$/, "")}/${unit.panel.imageKey}.png`
    : unit.panel.image;
  const panelFallback = apiUrl(`/api/gps-sims/panels/${unit.panel.imageKey}`);
  const [panelSrc, setPanelSrc] = useState(panelImage);

  const showGate = !isPro;
  const gateTitle = isAuthenticated ? "Upgrade to RSF Pro" : "Create a free account";
  const gateMessage = isAuthenticated
    ? "GPS sims unlock with RSF Pro for full workflows, checkrides, and saved training progress."
    : "Create a free RSF account to unlock RSF Pro GPS simulator training.";
  const gateCtaLabel = isAuthenticated ? "Upgrade to RSF Pro" : "Create free account";
  const gateCtaHref = isAuthenticated ? "/logbook/pro" : "/register";

  useEffect(() => {
    setPanelSrc(panelImage);
  }, [panelImage]);

  if (showGate) {
    return (
      <div className="min-h-screen bg-background">
        <section className="bg-muted py-10">
          <div className="container mx-auto px-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">RSF Branded</Badge>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold">{unit.title}</h1>
            <p className="text-muted-foreground max-w-3xl">{unit.summary}</p>
          </div>
        </section>

        <section className="container mx-auto px-4 py-10 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{gateTitle}</CardTitle>
              <CardDescription>{gateMessage}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border bg-slate-950/10 overflow-hidden">
                <img
                  src={panelSrc}
                  alt={unit.panel.alt}
                  className="h-auto w-full object-cover"
                  loading="lazy"
                  onError={() =>
                    setPanelSrc((current) => (current === panelFallback ? current : panelFallback))
                  }
                />
              </div>
              <Button asChild>
                <Link href={gateCtaHref}>{gateCtaLabel}</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    );
  }

  const completedCount = progress.filter(Boolean).length;
  const actionHints = selectedTask.actionHints ?? [];
  const rotationStep = 18;
  const activePage = avionics.activePage;
  const directToSelection =
    directToOptions[avionics.directToIndex] ?? directToOptions[0] ?? null;
  const mapPolyline = routePoints.map((point) => `${point.x},${point.y}`).join(" ");
  const cdiOffset = Math.round(avionics.cdiDeflection * 28);
  const mapHeading = Math.round(avionics.simulatedAircraft.groundTrackDeg);

  const handleToggleStep = (index: number) => {
    setStepProgress((prev) => {
      const nextSteps = [...(prev[selectedTask.id] ?? createStepState(selectedTask))];
      nextSteps[index] = !nextSteps[index];
      return { ...prev, [selectedTask.id]: nextSteps };
    });
  };

  const handleResetTask = () => {
    setStepProgress((prev) => ({
      ...prev,
      [selectedTask.id]: createStepState(selectedTask),
    }));
    setRevealed((prev) => ({ ...prev, [selectedTask.id]: false }));
  };

  const describeHotspot = (hotspotId: string) =>
    unit.panel.hotspots.find((item) => item.id === hotspotId)?.label ?? hotspotId;

  const recordAction = (action: {
    type: "press" | "rotate";
    hotspotId: string;
    direction?: "cw" | "ccw";
  }) => {
    const baseKey = `${action.type}:${action.hotspotId}`;
    const key = action.direction ? `${baseKey}:${action.direction}` : baseKey;
    const matched =
      actionHints.includes(key) ||
      (action.type === "rotate" && actionHints.includes(baseKey));
    const label =
      action.type === "press"
        ? `Pressed ${describeHotspot(action.hotspotId)}`
        : `Rotated ${describeHotspot(action.hotspotId)} ${
            action.direction === "cw" ? "clockwise" : "counterclockwise"
          }`;
    setActionLog((prev) => [{ id: key, label, matched }, ...prev].slice(0, 6));
  };

  const handleButtonPress = (hotspotId: string) => {
    setSelectedHotspotId(hotspotId);
    pressButton(hotspotId);
    recordAction({ type: "press", hotspotId });
  };

  const handleActivateDirectTo = (ident: string | null) => {
    if (!ident) return;
    setDirectToTarget(ident);
    trackEvent("direct_to_activate", { unit: unit.id, ident });
  };

  const handleAddWaypoint = () => {
    const trimmed = newWaypoint.trim().toUpperCase();
    if (!trimmed) return;
    addWaypoint(trimmed);
    setNewWaypoint("");
    trackEvent("fpl_create", { unit: unit.id, ident: trimmed });
  };

  const handleScenarioStart = (scenarioId: string) => {
    const scenario = avionicsScenarios.find((item) => item.id === scenarioId);
    if (!scenario) return;
    setActiveScenarioId(scenarioId);
    applyScenario(scenario);
    trackEvent("scenario_start", { unit: unit.id, scenario: scenarioId });
  };

  const handleScenarioReset = () => {
    setActiveScenarioId(null);
    applyScenario({
      id: "reset",
      title: "Reset",
      description: "Reset avionics state.",
      route: routeSeed,
      activePage: "MAP",
    });
    setDirectToTarget(null);
    setPage("MAP");
  };

  const getHotspotCenter = (hotspotId: string) => {
    const container = panelRef.current;
    const hotspot = unit.panel.hotspots.find((item) => item.id === hotspotId);
    if (!container || !hotspot) return null;
    const rect = container.getBoundingClientRect();
    return {
      x: rect.left + rect.width * (hotspot.x + hotspot.width / 2) / 100,
      y: rect.top + rect.height * (hotspot.y + hotspot.height / 2) / 100,
    };
  };

  const calculateAngle = (x: number, y: number, center: { x: number; y: number }) =>
    (Math.atan2(y - center.y, x - center.x) * 180) / Math.PI;

  const handleKnobPointerDown = (event: React.PointerEvent, hotspotId: string) => {
    const center = getHotspotCenter(hotspotId);
    if (!center) return;
    const angle = calculateAngle(event.clientX, event.clientY, center);
    knobDragRef.current = { hotspotId, lastAngle: angle };
    setSelectedHotspotId(hotspotId);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handleKnobPointerMove = (event: React.PointerEvent, hotspotId: string) => {
    const dragState = knobDragRef.current;
    if (!dragState || dragState.hotspotId !== hotspotId) return;
    const center = getHotspotCenter(hotspotId);
    if (!center) return;
    const angle = calculateAngle(event.clientX, event.clientY, center);
    let delta = angle - dragState.lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    if (Math.abs(delta) >= rotationStep) {
      const direction = delta > 0 ? "cw" : "ccw";
      knobDragRef.current = { hotspotId, lastAngle: angle };
      setKnobValues((prev) => ({
        ...prev,
        [hotspotId]: (prev[hotspotId] ?? 0) + (direction === "cw" ? 1 : -1),
      }));
      rotateKnob(hotspotId, direction === "cw" ? 1 : -1);
      recordAction({ type: "rotate", hotspotId, direction });
      trackEvent("knob_rotate", { unit: unit.id, knob: hotspotId, direction });
    }
  };

  const handleKnobPointerUp = (event: React.PointerEvent) => {
    knobDragRef.current = null;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // ignore if pointer capture was not set
    }
  };

  const handleKnobWheel = (event: React.WheelEvent, hotspotId: string) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    rotateKnob(hotspotId, direction);
    setKnobValues((prev) => ({
      ...prev,
      [hotspotId]: (prev[hotspotId] ?? 0) + direction,
    }));
    recordAction({ type: "rotate", hotspotId, direction: direction > 0 ? "cw" : "ccw" });
    trackEvent("knob_rotate", { unit: unit.id, knob: hotspotId, direction: direction > 0 ? "cw" : "ccw" });
  };

  const handleKnobPush = (hotspotId: string) => {
    pushKnob(hotspotId);
    recordAction({ type: "press", hotspotId });
  };

  const handleSaveProgress = () => {
    if (!unit || !canPersist) return;
    const currentProgress = (profile?.progressJson as any) || {};
    const gpsTrainer = currentProgress.gpsTrainer || {};
    const payload = {
      ...currentProgress,
      gpsTrainer: {
        ...gpsTrainer,
        [unit.id]: {
          mode,
          selectedTaskId,
          stepProgress,
          updatedAt: new Date().toISOString(),
        },
      },
    };
    saveProfile({ progressJson: payload });
  };

  const showSteps = mode === "learn" || revealed[selectedTask.id];

  const renderMapPanel = () => (
    <div className="relative h-56 rounded-lg border bg-slate-950/80 overflow-hidden">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        {routePoints.length > 1 && (
          <polyline points={mapPolyline} fill="none" stroke="#1d4ed8" strokeWidth="0.8" />
        )}
        {targetPoint && aircraftPoint && (
          <line
            x1={aircraftPoint.x}
            y1={aircraftPoint.y}
            x2={targetPoint.x}
            y2={targetPoint.y}
            stroke="#f59e0b"
            strokeDasharray="2 2"
            strokeWidth="0.6"
          />
        )}
        {routePoints.map((point) => (
          <g key={point.ident}>
            <circle cx={point.x} cy={point.y} r={1.6} fill="#60a5fa" />
            <text x={point.x + 2} y={point.y - 2} fontSize="4" fill="#e2e8f0">
              {point.ident}
            </text>
          </g>
        ))}
        <circle cx={aircraftPoint.x} cy={aircraftPoint.y} r={2.2} fill="#22c55e" />
      </svg>
      <div className="absolute left-2 top-2 rounded bg-black/50 px-2 py-1 text-[11px] text-slate-100">
        {avionics.navSource} · {mapHeading} deg
      </div>
      <div className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-[11px] text-slate-100">
        Range {mapRangeNm} nm
      </div>
      <div className="absolute bottom-2 right-2 flex items-center gap-2 rounded bg-black/50 px-2 py-1 text-[11px] text-slate-100">
        <span>CDI</span>
        <div className="relative h-1 w-16 rounded-full bg-slate-700">
          <div
            className="rsf-cdi-indicator absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-amber-400"
          />
        </div>
      </div>
    </div>
  );

  const renderAvionicsPage = () => {
    switch (activePage) {
      case "FPL":
        return (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Rotate the knob to move the cursor. Click a leg to activate it.
            </div>
            <div className="space-y-2">
              {avionics.route.map((ident, index) => (
                <div
                  key={`${ident}-${index}`}
                  className="flex items-center justify-between rounded-md border px-2 py-1 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{ident}</span>
                    {index === avionics.activeLegIndex && (
                      <Badge variant="secondary">Active</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => activateLeg(index)}
                    >
                      Activate
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeWaypoint(index)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={newWaypoint}
                onChange={(event) => setNewWaypoint(event.target.value.toUpperCase())}
                placeholder="Add waypoint"
                className="h-9 w-36 rounded-md border bg-background px-2 text-sm"
              />
              <Button type="button" size="sm" onClick={handleAddWaypoint}>
                Add
              </Button>
            </div>
          </div>
        );
      case "DIRECT":
        return (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Rotate the knob or pick a waypoint to activate direct-to.
            </div>
            <div className="space-y-2">
              {directToOptions.map((ident) => (
                <Button
                  key={ident}
                  type="button"
                  variant={ident === directToSelection ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleActivateDirectTo(ident)}
                >
                  {ident}
                </Button>
              ))}
            </div>
            {directToSelection && (
              <Button type="button" onClick={() => handleActivateDirectTo(directToSelection)}>
                Activate Direct-To {directToSelection}
              </Button>
            )}
          </div>
        );
      case "NRST":
        return (
          <div className="space-y-2 text-sm">
            {nearestAirports.map((ident) => (
              <div key={ident} className="flex items-center justify-between rounded-md border px-2 py-1">
                <span>{ident}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => handleActivateDirectTo(ident)}>
                  Direct-To
                </Button>
              </div>
            ))}
          </div>
        );
      case "PROC":
        return (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant={avionics.approachLoaded ? "default" : "outline"}>
                {avionics.approachLoaded ? "Approach loaded" : "Approach not loaded"}
              </Badge>
              {avionics.approachActivated && <Badge>Active</Badge>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => pressButton("approach-load")}>
                Load approach
              </Button>
              <Button type="button" size="sm" onClick={() => pressButton("approach-activate")}>
                Activate approach
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Use PROC then verify the fixes on the flight plan.
            </div>
          </div>
        );
      case "MENU":
        return (
          <div className="space-y-2 text-sm">
            {avionics.messages.length ? (
              avionics.messages.map((message) => (
                <div key={message} className="rounded-md border px-2 py-1">
                  {message}
                </div>
              ))
            ) : (
              <div className="text-xs text-muted-foreground">No active messages.</div>
            )}
            <Button type="button" size="sm" variant="outline" onClick={clearMessages}>
              Clear messages
            </Button>
          </div>
        );
      case "NAV":
      case "MAP":
      default:
        return renderMapPanel();
    }
  };

  return (
    <div className="min-h-screen">
      <section className="bg-muted py-10">
        <div className="container mx-auto px-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">RSF Branded</Badge>
            <Badge variant="secondary">{mode === "learn" ? "Learn Mode" : "Checkride Mode"}</Badge>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">{unit.title}</h1>
          <p className="text-muted-foreground max-w-3xl">{unit.summary}</p>
          <div className="flex flex-wrap gap-2">
            {unit.highlights.map((item) => (
              <Badge key={item} variant="secondary">
                {item}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/gps-sims">All GPS Sims</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/ifr-tools">IFR Tools</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 space-y-6">
        <Alert>
          <AlertTitle>Training aid only</AlertTitle>
          <AlertDescription>{gpsTrainerDisclaimer.join(" ")}</AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Trainer Mode</CardTitle>
            <CardDescription>
              Learn mode guides each step. Checkride mode hides steps until you validate.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant={mode === "learn" ? "default" : "outline"}
              onClick={() => setMode("learn")}
            >
              Learn Mode
            </Button>
            <Button
              type="button"
              variant={mode === "checkride" ? "default" : "outline"}
              onClick={() => setMode("checkride")}
            >
              Checkride Mode
            </Button>
            <Badge variant="outline">Progress saves with RSF Pro</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Panel Walkthrough</CardTitle>
            <CardDescription>
              Tap hot zones to rehearse knob pushes, softkeys, and touchscreen flows.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div
              ref={panelRef}
              className="relative overflow-hidden rounded-2xl border bg-slate-950/10 aspect-[2/1]"
            >
              <style>{hotspotCss}</style>
              <img
                src={panelSrc}
                alt={unit.panel.alt}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={() =>
                  setPanelSrc((current) => (current === panelFallback ? current : panelFallback))
                }
              />
              {unit.panel.hotspots.map((hotspot) => (
                <button
                  key={hotspot.id}
                  type="button"
                  className={`absolute rounded-lg border text-xs font-semibold uppercase tracking-wide transition ${getHotspotClass(hotspot.id)} ${
                    hotspot.id === selectedHotspot?.id
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-white/40 bg-white/10 text-white"
                  }`}
                  onClick={() =>
                    hotspot.interaction?.type === "knob"
                      ? undefined
                      : handleButtonPress(hotspot.id)
                  }
                  onPointerDown={(event) =>
                    hotspot.interaction?.type === "knob"
                      ? handleKnobPointerDown(event, hotspot.id)
                      : undefined
                  }
                  onPointerMove={(event) =>
                    hotspot.interaction?.type === "knob"
                      ? handleKnobPointerMove(event, hotspot.id)
                      : undefined
                  }
                  onPointerUp={(event) =>
                    hotspot.interaction?.type === "knob" ? handleKnobPointerUp(event) : undefined
                  }
                  onPointerLeave={(event) =>
                    hotspot.interaction?.type === "knob" ? handleKnobPointerUp(event) : undefined
                  }
                  onDoubleClick={() =>
                    hotspot.interaction?.type === "knob" ? handleKnobPush(hotspot.id) : undefined
                  }
                  onWheel={(event) =>
                    hotspot.interaction?.type === "knob" ? handleKnobWheel(event, hotspot.id) : undefined
                  }
                  aria-label={hotspot.label}
                >
                  <span className="sr-only">{hotspot.label}</span>
                </button>
              ))}
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">{selectedHotspot?.label}</h3>
                <p className="text-sm text-muted-foreground">{selectedHotspot?.description}</p>
              </div>
              <Separator />
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Suggested flow:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Touch the hotspot, then run the related task checklist.</li>
                  <li>Confirm CDI/annunciations after every automation step.</li>
                  <li>Brief the approach before activating procedures.</li>
                </ul>
              </div>
              <div className="flex flex-wrap gap-2">
                {unit.panel.hotspots.map((hotspot) => (
                  <Button
                    key={hotspot.id}
                    type="button"
                    variant={hotspot.id === selectedHotspot?.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleButtonPress(hotspot.id)}
                  >
                    {hotspot.label}
                  </Button>
                ))}
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                <div className="text-xs font-semibold text-foreground mb-2">Action feedback</div>
                {actionLog.length ? (
                  <div className="space-y-1">
                    <div className={actionLog[0].matched ? "text-emerald-600" : ""}>
                      {actionLog[0].label} {actionLog[0].matched ? "(OK)" : ""}
                    </div>
                    {Object.keys(knobValues).length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {Object.entries(knobValues).map(([id, value]) => (
                          <span key={id} className="mr-3">
                            {describeHotspot(id)}: {value > 0 ? `+${value}` : value}
                          </span>
                        ))}
                      </div>
                    )}
                    {avionics.lastAction && (
                      <div className="text-xs text-muted-foreground">
                        Sim: {avionics.lastAction}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs">Try a button or knob to see feedback.</div>
                )}
              </div>
              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Avionics Console</CardTitle>
                  <CardDescription>
                    Live trainer state powered by RSF avionics logic.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {(["MAP", "NAV", "FPL", "NRST", "PROC", "DIRECT", "MENU"] as const).map(
                      (page) => (
                        <Button
                          key={page}
                          type="button"
                          size="sm"
                          variant={activePage === page ? "default" : "outline"}
                          onClick={() => setPage(page)}
                        >
                          {page}
                        </Button>
                      )
                    )}
                  </div>
                  <div className="rounded-lg border bg-background/80 p-3">
                    {renderAvionicsPage()}
                  </div>
                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <div>Active leg: {activeLegIdent ?? "—"}</div>
                    <div>Source: {avionics.navSource}</div>
                    <div>Cursor mode: {avionics.cursorMode ? "On" : "Off"}</div>
                    <div>Range: {mapRangeNm} nm</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={showAvionicsExplain} onCheckedChange={setShowAvionicsExplain} />
                    <span className="text-xs text-muted-foreground">What just happened</span>
                  </div>
                  {showAvionicsExplain && avionics.lastAction && (
                    <div className="rounded-md border bg-muted/50 p-2 text-xs text-muted-foreground">
                      {avionics.lastAction}
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-foreground">Scenario presets</div>
                    <div className="flex flex-wrap gap-2">
                      {avionicsScenarios.map((scenario) => (
                        <Button
                          key={scenario.id}
                          type="button"
                          size="sm"
                          variant={activeScenarioId === scenario.id ? "default" : "outline"}
                          onClick={() => handleScenarioStart(scenario.id)}
                        >
                          {scenario.title}
                        </Button>
                      ))}
                      <Button type="button" size="sm" variant="outline" onClick={handleScenarioReset}>
                        Reset
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground">
                Want more realism? Drop in actual panel artwork and we can remap hotspots.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>Pick a workflow to practice.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {unit.tasks.map((task) => (
                <Button
                  key={task.id}
                  type="button"
                  variant={selectedTask.id === task.id ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  {task.title}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{selectedTask.title}</CardTitle>
              <CardDescription>{selectedTask.goal}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge variant="outline">
                  Steps: {completedCount}/{selectedTask.steps.length}
                </Badge>
                <Button type="button" variant="ghost" size="sm" onClick={handleResetTask}>
                  Reset task
                </Button>
                {!showSteps && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRevealed((prev) => ({ ...prev, [selectedTask.id]: true }))}
                  >
                    Reveal steps
                  </Button>
                )}
              </div>

              {showSteps ? (
                <div className="space-y-3">
                  {selectedTask.steps.map((step, index) => (
                    <label
                      key={step}
                      className="flex items-start gap-3 rounded-lg border p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={progress[index] || false}
                        onChange={() => handleToggleStep(index)}
                      />
                      <span>{step}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Steps are hidden in Checkride Mode. Reveal only after you attempt the flow.
                </div>
              )}

              {selectedTask.tips && selectedTask.tips.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Instructor tips</div>
                    <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                      {selectedTask.tips.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              <Separator />
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>
                  {isPro
                    ? "Saved progress and training history are enabled."
                    : "Upgrade to RSF Pro or Pro+ to save progress and training history."}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveProgress}
                  disabled={!canPersist || saving}
                >
                  {saving ? "Saving..." : "Save progress"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>IFR Scenarios</CardTitle>
            <CardDescription>Practice real-world workflows with short scenarios.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {unit.scenarios.map((scenario) => (
              <div key={scenario.id} className="rounded-lg border p-4 space-y-2">
                <div className="font-semibold">{scenario.title}</div>
                <div className="text-sm text-muted-foreground">{scenario.summary}</div>
                <div className="flex flex-wrap gap-2">
                  {scenario.tasks.map((taskId) => {
                    const task = unit.tasks.find((item) => item.id === taskId);
                    return (
                      <Badge key={taskId} variant="secondary">
                        {task?.title ?? taskId}
                      </Badge>
                    );
                  })}
                </div>
                {scenario.notes && scenario.notes.length > 0 && (
                  <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                    {scenario.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
