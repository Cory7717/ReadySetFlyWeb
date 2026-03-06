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

type TrainerSessionEntry = {
  id: string;
  label: string;
  matched: boolean;
  timestamp: number;
};

type TrainerSessionReport = {
  id: string;
  unitId: string;
  unitTitle: string;
  taskId: string;
  taskTitle: string;
  mode: "learn" | "checkride";
  scenarioId: string | null;
  startedAt: string;
  completedAt: string;
  durationSec: number;
  requiredActions: string[];
  matchedActions: string[];
  totalActions: number;
  accuracy: number;
  completion: number;
  score: number;
  navSource: string;
  activeLegIdent: string | null;
  actionTimeline: Array<{ label: string; matched: boolean; timestamp: number }>;
};

type GpsPage = "MAP" | "NAV" | "FPL" | "NRST" | "PROC" | "DIRECT" | "MENU";

function ScoreArc({
  value,
  label,
  size = 80,
}: {
  value: number;
  label: string;
  size?: number;
}) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (value / 100) * circumference;
  const color =
    value >= 80 ? "#22c55e" : value >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-300"
        />
        <text
          x={size / 2}
          y={size / 2 + 5}
          textAnchor="middle"
          fontSize="15"
          fontWeight="bold"
          fill={color}
        >
          {value}
        </text>
      </svg>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function AnimatedKnob({
  value,
  size = 44,
  label,
}: {
  value: number;
  size?: number;
  label: string;
}) {
  const rotation = (value % 12) * 30;
  const sizeClass =
    size <= 28 ? "h-7 w-7" : size <= 34 ? "h-8 w-8" : size <= 40 ? "h-10 w-10" : "h-11 w-11";
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div className={`relative ${sizeClass} rounded-full border-2 border-slate-600 bg-gradient-to-br from-slate-700 to-slate-900 shadow-inner`}>
        <svg viewBox="0 0 44 44" className="absolute inset-0 h-full w-full">
          <g transform={`rotate(${rotation} 22 22)`}>
            <line x1="22" y1="22" x2="22" y2="8" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" />
          </g>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-slate-500" />
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground font-medium">
        {label}
      </span>
    </div>
  );
}

function GpsScreen({
  activePage,
  route,
  activeLegIndex,
  navSource,
  cursorMode,
  cdiDeflection,
  approachLoaded,
  approachActivated,
  messages,
  inputBuffer,
  routePoints,
  nearestAirports,
  directToOptions,
  directToIndex,
  activeLegIdent,
  mapRangeNm,
  aircraftPoint,
  targetPoint,
  onActivateLeg,
  onActivateDirectTo,
  onPageChange,
}: {
  activePage: GpsPage;
  route: string[];
  activeLegIndex: number;
  navSource: string;
  cursorMode: boolean;
  cdiDeflection: number;
  approachLoaded: boolean;
  approachActivated: boolean;
  messages: string[];
  inputBuffer: string;
  routePoints: Array<{ x: number; y: number; ident: string }>;
  nearestAirports: string[];
  directToOptions: string[];
  directToIndex: number;
  activeLegIdent: string | null;
  mapRangeNm: number;
  aircraftPoint: { x: number; y: number };
  targetPoint: { x: number; y: number } | null;
  onActivateLeg: (index: number) => void;
  onActivateDirectTo: (ident: string) => void;
  onPageChange: (page: GpsPage) => void;
}) {
  const mapPolyline = routePoints
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
  const cdiOffset = Math.round(cdiDeflection * 28);
  const cdiX = Math.max(1, Math.min(79, 40 + cdiOffset * 0.6));

  return (
    <div className="rounded-lg overflow-hidden border-4 border-slate-800 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)] bg-slate-900 select-none">
      <div className="flex items-center justify-between bg-slate-800 px-3 py-1 text-[10px] font-mono text-slate-400">
        <span>{navSource}</span>
        <span className="font-semibold text-amber-400">
          {activePage}
        </span>
        <span>
          {activeLegIdent ? `▶ ${activeLegIdent}` : "NO ACT LEG"}
        </span>
      </div>

      <div className="bg-slate-950 min-h-[220px] p-0 relative">
        {(activePage === "MAP" || activePage === "NAV") && (
          <div className="relative h-[220px]">
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
              {[25, 50, 75].map((v) => (
                <g key={v}>
                  <line x1={v} y1={0} x2={v} y2={100} stroke="#1e293b" strokeWidth="0.3" />
                  <line x1={0} y1={v} x2={100} y2={v} stroke="#1e293b" strokeWidth="0.3" />
                </g>
              ))}
              {routePoints.length > 1 && (
                <polyline points={mapPolyline} fill="none" stroke="#10b981" strokeWidth="0.6" />
              )}
              {targetPoint && (
                <line
                  x1={aircraftPoint.x}
                  y1={aircraftPoint.y}
                  x2={targetPoint.x}
                  y2={targetPoint.y}
                  stroke="#f59e0b"
                  strokeDasharray="2 1.5"
                  strokeWidth="0.5"
                />
              )}
              {routePoints.map((point, idx) => (
                <g key={point.ident}>
                  <circle cx={point.x} cy={point.y} r={1.8} fill={idx === activeLegIndex ? "#10b981" : "#64748b"} />
                  <text
                    x={point.x + 2.5}
                    y={point.y - 2}
                    fontSize="4"
                    fontFamily="monospace"
                    fill={idx === activeLegIndex ? "#10b981" : "#94a3b8"}
                  >
                    {point.ident}
                  </text>
                </g>
              ))}
              <g transform={`translate(${aircraftPoint.x}, ${aircraftPoint.y})`}>
                <polygon points="0,-3 1.5,2 0,1 -1.5,2" fill="#22c55e" stroke="#15803d" strokeWidth="0.3" />
              </g>
            </svg>
            <div className="absolute bottom-1 left-2 font-mono text-[10px] text-slate-500">
              {mapRangeNm}nm
            </div>
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <span className="font-mono text-[10px] text-slate-400">CDI</span>
              <svg viewBox="0 0 80 12" className="h-3 w-20">
                <rect x="0" y="3" width="80" height="6" rx="3" fill="#334155" />
                <line x1="40" y1="0.5" x2="40" y2="11.5" stroke="#64748b" strokeWidth="1" />
                <rect x={cdiX} y="1" width="2" height="10" rx="1" fill="#fbbf24" />
              </svg>
            </div>
          </div>
        )}

        {activePage === "FPL" && (
          <div className="p-3 font-mono text-sm space-y-0.5 min-h-[220px]">
            <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider">Active flight plan</div>
            {route.length === 0 && (
              <div className="text-slate-600 text-xs">No waypoints - use FPL + knob to add</div>
            )}
            {route.map((ident, idx) => (
              <div
                key={`${ident}-${idx}`}
                onClick={() => onActivateLeg(idx)}
                className={[
                  "flex items-center justify-between px-2 py-0.5",
                  "rounded cursor-pointer transition-colors",
                  idx === activeLegIndex
                    ? "bg-emerald-900/60 text-emerald-300"
                    : "text-slate-300 hover:bg-slate-800",
                  cursorMode ? "" : "opacity-60",
                ].join(" ")}
              >
                <span>{idx === activeLegIndex ? "▶" : " "} {ident}</span>
                {idx < route.length - 1 && (
                  <span className="text-slate-600 text-xs">
                    {"-> "}
                    {route[idx + 1]}
                  </span>
                )}
              </div>
            ))}
            {!cursorMode && (
              <div className="mt-3 text-[10px] text-amber-500">Push knob to enter cursor mode</div>
            )}
            {inputBuffer && (
              <div className="mt-2 rounded border border-emerald-700 bg-emerald-950 px-2 py-1 text-emerald-300 text-xs font-mono">
                {inputBuffer}_
              </div>
            )}
          </div>
        )}

        {activePage === "NRST" && (
          <div className="p-3 font-mono space-y-1 min-h-[220px]">
            <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider">Nearest airports</div>
            {nearestAirports.map((ident) => (
              <div
                key={ident}
                onClick={() => onActivateDirectTo(ident)}
                className="flex items-center justify-between px-2 py-1 rounded cursor-pointer text-slate-300 hover:bg-slate-800 transition-colors"
              >
                <span>{ident}</span>
                <span className="text-emerald-500 text-xs">D→</span>
              </div>
            ))}
          </div>
        )}

        {activePage === "DIRECT" && (
          <div className="p-3 font-mono space-y-1 min-h-[220px]">
            <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider">Direct-to</div>
            {directToOptions.map((ident, idx) => (
              <div
                key={ident}
                onClick={() => onActivateDirectTo(ident)}
                className={[
                  "flex items-center gap-2 px-2 py-1 rounded",
                  "cursor-pointer transition-colors",
                  idx === directToIndex
                    ? "bg-emerald-900/60 text-emerald-300"
                    : "text-slate-300 hover:bg-slate-800",
                ].join(" ")}
              >
                <span>{idx === directToIndex ? "▶" : " "}</span>
                <span>{ident}</span>
              </div>
            ))}
          </div>
        )}

        {activePage === "PROC" && (
          <div className="p-3 font-mono space-y-3 min-h-[220px]">
            <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider">Procedures</div>
            <div className="space-y-2 text-sm">
              <div
                className={[
                  "px-3 py-2 rounded border",
                  approachLoaded
                    ? "border-emerald-700 bg-emerald-950/60 text-emerald-300"
                    : "border-slate-700 text-slate-400",
                ].join(" ")}
              >
                {approachLoaded ? "✓ Approach loaded" : "  No approach"}
              </div>
              <div
                className={[
                  "px-3 py-2 rounded border",
                  approachActivated
                    ? "border-amber-700 bg-amber-950/60 text-amber-300"
                    : "border-slate-700 text-slate-500",
                ].join(" ")}
              >
                {approachActivated ? "▶ Approach active" : "  Approach inactive"}
              </div>
            </div>
            <div className="text-[10px] text-slate-500">Use PROC key then select approach</div>
          </div>
        )}

        {activePage === "MENU" && (
          <div className="p-3 font-mono space-y-1 min-h-[220px]">
            <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider">Messages</div>
            {messages.length === 0 && <div className="text-slate-600 text-xs">No messages</div>}
            {messages.map((msg) => (
              <div key={msg} className="text-amber-400 text-xs px-2 py-1 rounded bg-amber-950/30">
                {msg}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex border-t border-slate-800 bg-slate-900">
        {(["MAP", "NAV", "FPL", "NRST", "PROC", "DIRECT", "MENU"] as const).map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={[
              "flex-1 py-1 text-[10px] font-mono font-semibold",
              "transition-colors border-r border-slate-800",
              "last:border-r-0",
              activePage === page
                ? "bg-emerald-900/60 text-emerald-300"
                : "text-slate-500 hover:bg-slate-800 hover:text-slate-300",
            ].join(" ")}
          >
            {page}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GpsSimsUnit() {
  const [, params] = useRoute("/gps-sims/:unitId");
  const unit = gpsTrainerUnits.find((item) => item.id === params?.unitId);
  const resolvedUnit = unit ?? gpsTrainerUnits[0];
  const panelBaseUrl = import.meta.env.VITE_GPS_PANEL_BASE_URL as string | undefined;
  const panelImage = panelBaseUrl
    ? `${panelBaseUrl.replace(/\/$/, "")}/${resolvedUnit?.panel?.imageKey}.png`
    : resolvedUnit?.panel?.image ?? "";
  const panelFallback = apiUrl(
    `/api/gps-sims/panels/${resolvedUnit?.panel?.imageKey ?? ""}`
  );
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
    resolvedUnit?.tasks[0]?.id ?? null
  );
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(
    resolvedUnit?.panel?.hotspots[0]?.id ?? null
  );
  const [stepProgress, setStepProgress] = useState<Record<string, boolean[]>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [loadedFromProfile, setLoadedFromProfile] = useState(false);
  const [actionLog, setActionLog] = useState<Array<{ id: string; label: string; matched: boolean }>>(
    []
  );
  const [sessionLog, setSessionLog] = useState<TrainerSessionEntry[]>([]);
  const [matchedActions, setMatchedActions] = useState<string[]>([]);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [sessionCompletedAt, setSessionCompletedAt] = useState<number | null>(null);
  const [lastSessionReport, setLastSessionReport] = useState<TrainerSessionReport | null>(null);
  const [showAvionicsExplain, setShowAvionicsExplain] = useState(true);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(
    avionicsScenarios[0]?.id ?? null
  );
  const [knobValues, setKnobValues] = useState<Record<string, number>>({});
  const [panelSrc, setPanelSrc] = useState("");
  const [lastPressedId, setLastPressedId] = useState<string | null>(null);
  const [sequenceWarning, setSequenceWarning] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const knobDragRef = useRef<{ hotspotId: string; lastAngle: number } | null>(null);
  const pressFlashTimer = useRef<number | null>(null);
  const sequenceWarningTimer = useRef<number | null>(null);
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
    if (!resolvedUnit?.panel?.hotspots) return "";
    const rules = resolvedUnit.panel.hotspots.map((hotspot) => {
      const className = getHotspotClass(hotspot.id);
      return `.${className}{left:${hotspot.x}%;top:${hotspot.y}%;width:${hotspot.width}%;height:${hotspot.height}%;touch-action:none;}`;
    });
    return `${rules.join("\n")}`;
  }, [resolvedUnit?.panel?.hotspots]);

  useEffect(() => {
    if (unit) {
      trackEvent("gps_sims_unit_view", { unit: resolvedUnit.id });
    }
  }, [unit]);

  useEffect(() => {
    setPanelSrc(panelImage || panelFallback);
  }, [panelImage, panelFallback]);

  useEffect(() => {
    return () => {
      if (pressFlashTimer.current) window.clearTimeout(pressFlashTimer.current);
      if (sequenceWarningTimer.current) window.clearTimeout(sequenceWarningTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!resolvedUnit?.tasks?.length) return;
    if (!selectedTaskId || !resolvedUnit.tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(resolvedUnit.tasks[0].id);
    }
  }, [resolvedUnit?.id, selectedTaskId]);

  useEffect(() => {
    if (!resolvedUnit?.panel?.hotspots?.length) return;
    if (!selectedHotspotId || !resolvedUnit.panel.hotspots.some((hotspot) => hotspot.id === selectedHotspotId)) {
      setSelectedHotspotId(resolvedUnit.panel.hotspots[0].id);
    }
  }, [resolvedUnit?.id, selectedHotspotId]);

  useEffect(() => {
    setLoadedFromProfile(false);
  }, [resolvedUnit?.id]);

  useEffect(() => {
    setActionLog([]);
    setKnobValues({});
  }, [resolvedUnit?.id]);

  useEffect(() => {
    resetSession();
  }, [selectedTaskId, mode, resolvedUnit?.id]);

  useEffect(() => {
    if (!unit) return;
    const sessions = (profile?.progressJson as any)?.gpsTrainerSessions;
    if (!Array.isArray(sessions)) {
      setLastSessionReport(null);
      return;
    }
    const latest = sessions
      .filter((entry) => entry?.unitId === resolvedUnit.id)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];
    setLastSessionReport(latest || null);
  }, [profile?.progressJson, resolvedUnit?.id]);

  useEffect(() => {
    setActiveScenarioId(avionicsScenarios[0]?.id ?? null);
  }, [resolvedUnit?.id, avionicsScenarios]);

  useEffect(() => {
    if (!unit || !canPersist || loadedFromProfile) return;
    const saved = (profile?.progressJson as any)?.gpsTrainer?.[resolvedUnit.id];
    if (saved) {
      if (saved.mode === "learn" || saved.mode === "checkride") {
        setMode(saved.mode);
      }
      if (saved.selectedTaskId && resolvedUnit.tasks.some((task) => task.id === saved.selectedTaskId)) {
        setSelectedTaskId(saved.selectedTaskId);
      }
      if (saved.stepProgress && typeof saved.stepProgress === "object") {
        setStepProgress(saved.stepProgress);
      }
    }
    setLoadedFromProfile(true);
  }, [unit, canPersist, loadedFromProfile, profile?.progressJson]);

  const selectedTask =
    resolvedUnit?.tasks.find((task) => task.id === selectedTaskId) ?? resolvedUnit?.tasks[0];
  const progress =
    selectedTask ? stepProgress[selectedTask.id] ?? createStepState(selectedTask) : [];
  const selectedHotspot =
    resolvedUnit?.panel.hotspots.find((hotspot) => hotspot.id === selectedHotspotId) ??
    resolvedUnit?.panel.hotspots[0];

  const showGate = !isPro;
  const gateTitle = isAuthenticated ? "Upgrade to RSF Pro" : "Create a free account";
  const gateMessage = isAuthenticated
    ? "GPS sims unlock with RSF Pro for full workflows, checkrides, and saved training progress."
    : "Create a free RSF account to unlock RSF Pro GPS simulator training.";
  const gateCtaLabel = isAuthenticated ? "Upgrade to RSF Pro" : "Create free account";
  const gateCtaHref = isAuthenticated ? "/logbook/pro" : "/register";

  const completedCount = progress.filter(Boolean).length;
  const actionHints = selectedTask?.actionHints ?? [];
  const requiredActionKeys = useMemo(
    () => Array.from(new Set(actionHints)),
    [actionHints]
  );
  const rotationStep = 18;
  const activePage = avionics.activePage as GpsPage;
  const matchedRequiredCount = matchedActions.filter((key) => requiredActionKeys.includes(key)).length;
  const autoCompletedSteps = useMemo(() => {
    if (!selectedTask?.actionHints) return [] as boolean[];
    return selectedTask.steps.map((_, idx) => {
      const hint = actionHints[idx];
      if (!hint) return false;
      return matchedActions.includes(hint);
    });
  }, [selectedTask, actionHints, matchedActions]);
  const totalActions = sessionLog.length;
  const accuracy = totalActions ? Math.round((matchedRequiredCount / totalActions) * 100) : 0;
  const completion = requiredActionKeys.length
    ? Math.round((matchedRequiredCount / requiredActionKeys.length) * 100)
    : 0;
  const score = Math.round(completion * 0.7 + accuracy * 0.3);
  const checkrideComplete = mode === "checkride" && requiredActionKeys.length > 0 &&
    matchedRequiredCount >= requiredActionKeys.length;
  const durationSec = sessionStartedAt
    ? Math.max(0, Math.round(((sessionCompletedAt ?? Date.now()) - sessionStartedAt) / 1000))
    : 0;

  useEffect(() => {
    if (mode !== "checkride") return;
    if (!sessionStartedAt || sessionCompletedAt) return;
    if (requiredActionKeys.length && matchedRequiredCount >= requiredActionKeys.length) {
      setSessionCompletedAt(Date.now());
    }
  }, [mode, sessionStartedAt, sessionCompletedAt, requiredActionKeys.length, matchedRequiredCount]);

  const handleToggleStep = (index: number) => {
    if (!selectedTask) return;
    setStepProgress((prev) => {
      const nextSteps = [...(prev[selectedTask.id] ?? createStepState(selectedTask))];
      nextSteps[index] = !nextSteps[index];
      return { ...prev, [selectedTask.id]: nextSteps };
    });
  };

  const handleResetTask = () => {
    if (!selectedTask) return;
    setStepProgress((prev) => ({
      ...prev,
      [selectedTask.id]: createStepState(selectedTask),
    }));
    setRevealed((prev) => ({ ...prev, [selectedTask.id]: false }));
    resetSession();
  };

  useEffect(() => {
    if (!unit || !selectedTask) return;
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= selectedTask.steps.length) {
        e.preventDefault();
        handleToggleStep(num - 1);
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const currentIndex = resolvedUnit.tasks.findIndex((t) => t.id === selectedTask.id);
        const nextIndex = e.key === "ArrowRight"
          ? Math.min(currentIndex + 1, resolvedUnit.tasks.length - 1)
          : Math.max(currentIndex - 1, 0);
        setSelectedTaskId(resolvedUnit.tasks[nextIndex].id);
        return;
      }

      if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleResetTask();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedTask, unit, resolvedUnit?.tasks, handleToggleStep, handleResetTask]);

  const describeHotspot = (hotspotId: string) =>
    resolvedUnit?.panel.hotspots.find((item) => item.id === hotspotId)?.label ?? hotspotId;

  const resetSession = () => {
    setSessionLog([]);
    setMatchedActions([]);
    setSessionStartedAt(null);
    setSessionCompletedAt(null);
    setSequenceWarning(null);
  };

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
    const now = Date.now();
    const label =
      action.type === "press"
        ? `Pressed ${describeHotspot(action.hotspotId)}`
        : `Rotated ${describeHotspot(action.hotspotId)} ${
            action.direction === "cw" ? "clockwise" : "counterclockwise"
          }`;
    setActionLog((prev) => [{ id: key, label, matched }, ...prev].slice(0, 6));
    setSessionLog((prev) => [{ id: key, label, matched, timestamp: now }, ...prev].slice(0, 200));
    if (mode === "checkride" && !sessionStartedAt) {
      setSessionStartedAt(now);
    }
    if (matched) {
      setMatchedActions((prev) => (prev.includes(key) ? prev : [...prev, key]));
    }
    if (mode === "checkride" && sessionLog.length >= 3 && !matched) {
      setSequenceWarning(
        `${label} is not in the expected sequence for this task.`
      );
      if (sequenceWarningTimer.current) window.clearTimeout(sequenceWarningTimer.current);
      sequenceWarningTimer.current = window.setTimeout(() => setSequenceWarning(null), 3000);
    }
  };

  const handleButtonPress = (hotspotId: string) => {
    setSelectedHotspotId(hotspotId);
    pressButton(hotspotId);
    recordAction({ type: "press", hotspotId });
    setLastPressedId(hotspotId);
    if (pressFlashTimer.current) window.clearTimeout(pressFlashTimer.current);
    pressFlashTimer.current = window.setTimeout(() => setLastPressedId(null), 150);
  };

  const handleActivateDirectTo = (ident: string | null) => {
    if (!ident) return;
    setDirectToTarget(ident);
    trackEvent("direct_to_activate", { unit: resolvedUnit.id, ident });
  };

  const handleAddWaypoint = () => {
    const trimmed = newWaypoint.trim().toUpperCase();
    if (!trimmed) return;
    addWaypoint(trimmed);
    setNewWaypoint("");
    trackEvent("fpl_create", { unit: resolvedUnit.id, ident: trimmed });
  };

  const handleScenarioStart = (scenarioId: string) => {
    const scenario = avionicsScenarios.find((item) => item.id === scenarioId);
    if (!scenario) return;
    setActiveScenarioId(scenarioId);
    applyScenario(scenario);
    resetSession();
    trackEvent("scenario_start", { unit: resolvedUnit.id, scenario: scenarioId });
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
    resetSession();
  };

  const getHotspotCenter = (hotspotId: string) => {
    const container = panelRef.current;
    const hotspot = resolvedUnit.panel.hotspots.find((item) => item.id === hotspotId);
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
      trackEvent("knob_rotate", { unit: resolvedUnit.id, knob: hotspotId, direction });
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
    trackEvent("knob_rotate", { unit: resolvedUnit.id, knob: hotspotId, direction: direction > 0 ? "cw" : "ccw" });
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
        [resolvedUnit.id]: {
          mode,
          selectedTaskId,
          stepProgress,
          updatedAt: new Date().toISOString(),
        },
      },
    };
    saveProfile({ progressJson: payload });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (!mins) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const buildSessionReport = () => {
    if (!unit || !sessionStartedAt) return null;
    const completedAt = sessionCompletedAt ?? Date.now();
    const report: TrainerSessionReport = {
      id: crypto.randomUUID?.() || `${resolvedUnit.id}-${Date.now()}`,
      unitId: resolvedUnit.id,
      unitTitle: resolvedUnit.title,
      taskId: selectedTask.id,
      taskTitle: selectedTask.title,
      mode,
      scenarioId: activeScenarioId ?? null,
      startedAt: new Date(sessionStartedAt).toISOString(),
      completedAt: new Date(completedAt).toISOString(),
      durationSec,
      requiredActions: requiredActionKeys,
      matchedActions,
      totalActions,
      accuracy,
      completion,
      score,
      navSource: avionics.navSource,
      activeLegIdent,
      actionTimeline: sessionLog
        .slice(0, 20)
        .map((entry) => ({
          label: entry.label,
          matched: entry.matched,
          timestamp: entry.timestamp,
        }))
        .reverse(),
    };
    return report;
  };

  const persistSessionReport = (report: TrainerSessionReport) => {
    if (!canPersist) return;
    const currentProgress = (profile?.progressJson as any) || {};
    const sessions = Array.isArray(currentProgress.gpsTrainerSessions)
      ? currentProgress.gpsTrainerSessions
      : [];
    const nextSessions = [report, ...sessions].slice(0, 40);
    saveProfile({
      progressJson: {
        ...currentProgress,
        gpsTrainerSessions: nextSessions,
      },
    });
  };

  const handleCompleteCheckride = () => {
    const report = buildSessionReport();
    if (!report) return;
    setLastSessionReport(report);
    persistSessionReport(report);
    trackEvent("gps_checkride_complete", {
      unit: report.unitId,
      task: report.taskId,
      score: report.score,
      accuracy: report.accuracy,
      completion: report.completion,
      durationSec: report.durationSec,
      mode: report.mode,
    });
  };

  const downloadSessionReport = (report: TrainerSessionReport) => {
    const lines: string[] = [];
    lines.push("Ready Set Fly - GPS Simulator Session Report");
    lines.push("");
    lines.push(`Unit: ${report.unitTitle} (${report.unitId})`);
    lines.push(`Task: ${report.taskTitle}`);
    lines.push(`Mode: ${report.mode}`);
    if (report.scenarioId) lines.push(`Scenario: ${report.scenarioId}`);
    lines.push(`Started: ${report.startedAt}`);
    lines.push(`Completed: ${report.completedAt}`);
    lines.push(`Duration: ${formatDuration(report.durationSec)}`);
    lines.push("");
    lines.push(`Score: ${report.score}/100`);
    lines.push(`Completion: ${report.completion}%`);
    lines.push(`Accuracy: ${report.accuracy}%`);
    lines.push(`Total actions: ${report.totalActions}`);
    lines.push(`Nav source: ${report.navSource}`);
    if (report.activeLegIdent) lines.push(`Active leg: ${report.activeLegIdent}`);
    lines.push("");
    lines.push("Required actions:");
    report.requiredActions.forEach((action) => lines.push(`- ${action}`));
    lines.push("");
    lines.push("Matched actions:");
    report.matchedActions.forEach((action) => lines.push(`- ${action}`));
    lines.push("");
    lines.push("Action timeline:");
    report.actionTimeline.forEach((entry) => {
      const stamp = new Date(entry.timestamp).toISOString();
      lines.push(`- ${stamp} ${entry.matched ? "[OK]" : "[?]"} ${entry.label}`);
    });

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rsf-gps-session-${report.unitId}-${report.taskId}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

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

  if (showGate) {
    return (
      <div className="min-h-screen bg-background">
        <section className="bg-muted py-10">
          <div className="container mx-auto px-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">RSF Branded</Badge>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold">{resolvedUnit.title}</h1>
            <p className="text-muted-foreground max-w-3xl">{resolvedUnit.summary}</p>
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
                  alt={resolvedUnit.panel.alt}
                  className="h-auto w-full object-cover"
                  loading="lazy"
                  onError={() =>
                    setPanelSrc((current) => (current === panelFallback ? current : panelFallback))
                  }
                />
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                <div className="text-xs font-semibold text-foreground mb-2">RSF Pro unlocks</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Checkride mode with scoring + realism guardrails.</li>
                  <li>Instructor-ready session reports and progress history.</li>
                  <li>Advanced scenarios and simulator presets.</li>
                </ul>
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

  if (!selectedTask || !selectedHotspot) {
    return null;
  }

  const showSteps = mode === "learn" || revealed[selectedTask.id];



  return (
    <div className="min-h-screen">
      <section className="bg-muted py-10">
        <div className="container mx-auto px-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">RSF Branded</Badge>
            <Badge variant="secondary">{mode === "learn" ? "Learn Mode" : "Checkride Mode"}</Badge>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">{resolvedUnit.title}</h1>
          <p className="text-muted-foreground max-w-3xl">{resolvedUnit.summary}</p>
          <div className="flex flex-wrap gap-2">
            {resolvedUnit.highlights.map((item) => (
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
            <Badge variant="outline">Progress + instructor reports save with RSF Pro</Badge>
          </CardContent>
        </Card>

        {activeScenarioId && (() => {
          const activeScenario = avionicsScenarios.find((s) => s.id === activeScenarioId);
          if (!activeScenario) return null;
          return (
            <div className="sticky top-0 z-30 flex items-center justify-between gap-3 rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 shadow-sm">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-sky-800">Active scenario:</span>
                <span className="text-sky-700">{activeScenario.title}</span>
                {mode === "checkride" && sessionStartedAt && (
                  <Badge variant="secondary" className="text-xs">
                    Checkride running - {formatDuration(durationSec)}
                  </Badge>
                )}
              </div>
              <button
                type="button"
                onClick={handleScenarioReset}
                className="rounded border border-sky-300 px-2 py-0.5 text-xs text-sky-600 hover:bg-sky-100 transition-colors"
              >
                End scenario
              </button>
            </div>
          );
        })()}

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
                alt={resolvedUnit.panel.alt}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={() =>
                  setPanelSrc((current) => (current === panelFallback ? current : panelFallback))
                }
              />
              {resolvedUnit.panel.hotspots.map((hotspot) => (
                <button
                  key={hotspot.id}
                  type="button"
                  className={[
                    "absolute rounded-lg border-2 text-xs font-semibold uppercase",
                    "tracking-wide transition-all duration-150 cursor-pointer",
                    "flex items-center justify-center",
                    getHotspotClass(hotspot.id),
                    hotspot.id === selectedHotspot?.id
                      ? "border-sky-400 bg-sky-400/25 shadow-[0_0_0_2px_rgba(56,189,248,0.4)] text-white"
                      : "border-white/25 bg-white/5 text-transparent",
                    "hover:border-white/60 hover:bg-white/15 hover:text-white/80",
                    hotspot.interaction?.type === "knob"
                      ? "cursor-grab active:cursor-grabbing"
                      : "cursor-pointer",
                    lastPressedId === hotspot.id
                      ? "scale-95 border-white bg-white/30"
                      : "",
                  ].filter(Boolean).join(" ")}
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
                  title={`${hotspot.label}${
                    hotspot.interaction?.type === "knob"
                      ? " (drag to rotate, double-click to push)"
                      : " (click to activate)"
                  }`}
                >
                  <span className="sr-only">{hotspot.label}</span>
                  {hotspot.interaction?.type === "knob" && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <AnimatedKnob
                        value={knobValues[hotspot.id] ?? 0}
                        size={Math.min(
                          40,
                          Math.round((hotspot.width / 100) * (panelRef.current?.offsetWidth ?? 200) * 0.8)
                        )}
                        label=""
                      />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 pt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded border-2 border-sky-400 bg-sky-400/25" />
                Selected
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded border-2 border-white/25 bg-white/5" />
                Available - hover to highlight
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded border-2 border-white/60 bg-white/15" />
                Knob - drag or scroll to rotate
              </span>
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
                {resolvedUnit.panel.hotspots.map((hotspot) => (
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
                <div className="text-xs font-semibold text-foreground mb-2">Action timeline</div>
                {actionLog.length === 0 ? (
                  <div className="text-xs">Try a button or knob to see feedback.</div>
                ) : (
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {actionLog.map((entry, idx) => (
                      <div
                        key={`${entry.id}-${idx}`}
                        className={[
                          "flex items-center gap-2 text-xs rounded px-1.5 py-0.5",
                          idx === 0 ? "bg-muted font-medium" : "opacity-70",
                        ].join(" ")}
                      >
                        <span className={entry.matched ? "text-emerald-600 font-bold" : "text-muted-foreground"}>
                          {entry.matched ? "✓" : "·"}
                        </span>
                        <span className={entry.matched ? "text-emerald-700" : ""}>{entry.label}</span>
                      </div>
                    ))}
                  </div>
                )}
                {sequenceWarning && (
                  <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                    ⚡ {sequenceWarning}
                  </div>
                )}
                {Object.keys(knobValues).length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground border-t pt-2">
                    {Object.entries(knobValues).map(([id, value]) => (
                      <span key={id} className="mr-3">
                        {describeHotspot(id)}: {value > 0 ? `+${value}` : value}
                      </span>
                    ))}
                  </div>
                )}
                {avionics.lastAction && (
                  <div className="mt-1 text-xs text-muted-foreground border-t pt-1">
                    Sim: {avionics.lastAction}
                  </div>
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
                  <GpsScreen
                    activePage={activePage}
                    route={avionics.route}
                    activeLegIndex={avionics.activeLegIndex}
                    navSource={avionics.navSource}
                    cursorMode={avionics.cursorMode}
                    cdiDeflection={avionics.cdiDeflection}
                    approachLoaded={avionics.approachLoaded}
                    approachActivated={avionics.approachActivated}
                    messages={avionics.messages}
                    inputBuffer={avionics.inputBuffer ?? ""}
                    routePoints={routePoints}
                    nearestAirports={nearestAirports}
                    directToOptions={directToOptions}
                    directToIndex={avionics.directToIndex}
                    activeLegIdent={activeLegIdent}
                    mapRangeNm={mapRangeNm}
                    aircraftPoint={aircraftPoint}
                    targetPoint={targetPoint ?? null}
                    onActivateLeg={activateLeg}
                    onActivateDirectTo={handleActivateDirectTo}
                    onPageChange={(page) => setPage(page)}
                  />
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
              {resolvedUnit.tasks.map((task) => (
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
                <div className="space-y-0">
                  {selectedTask.steps.map((step, index) => {
                    const isChecked =
                      progress[index] || autoCompletedSteps[index] || false;
                    const isAuto =
                      autoCompletedSteps[index] && !progress[index];
                    const isActive =
                      !isChecked &&
                      (index === 0 || progress[index - 1] || autoCompletedSteps[index - 1]);
                    return (
                      <div key={`${step}-${index}`} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <button
                            type="button"
                            onClick={() => handleToggleStep(index)}
                            className={[
                              "flex h-7 w-7 flex-shrink-0 items-center justify-center",
                              "rounded-full border-2 text-xs font-bold transition-all",
                              isChecked
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : isActive
                                  ? "border-sky-500 bg-sky-50 text-sky-700 shadow-sm"
                                  : "border-muted-foreground/30 bg-background text-muted-foreground",
                            ].join(" ")}
                            aria-label={`Toggle step ${index + 1}`}
                          >
                            {isChecked ? "✓" : index + 1}
                          </button>
                          {index < selectedTask.steps.length - 1 && (
                            <div
                              className={[
                                "w-0.5 flex-1 min-h-[20px]",
                                isChecked ? "bg-emerald-300" : "bg-muted",
                              ].join(" ")}
                            />
                          )}
                        </div>
                        <div
                          className={[
                            "flex-1 rounded-lg border p-3 text-sm mb-3 transition-colors",
                            isChecked
                              ? "border-emerald-200 bg-emerald-50/50 text-muted-foreground line-through"
                              : isActive
                                ? "border-sky-200 bg-sky-50/50"
                                : "border-muted",
                          ].join(" ")}
                        >
                          <span>{step}</span>
                          {isAuto && (
                            <span className="ml-2 text-[10px] text-emerald-600 font-semibold">
                              auto
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Steps are hidden in Checkride Mode. Reveal only after you attempt the flow.
                </div>
              )}
              <div className="text-xs text-muted-foreground pt-1">
                Keys: 1–9 toggle steps · ← → switch tasks · R reset
              </div>

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
            <CardTitle>Checkride Score & Instructor Review</CardTitle>
            <CardDescription>
              Realism-focused scoring and reports. Complete the task to generate an instructor-ready summary.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode !== "checkride" ? (
              <div className="text-sm text-muted-foreground">
                Switch to Checkride Mode to track scoring, timing, and instructor reports.
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-end justify-center gap-6 rounded-lg border bg-muted/20 py-4">
                    <ScoreArc value={score} label="Score" size={88} />
                    <ScoreArc value={completion} label="Completion" size={80} />
                    <ScoreArc value={accuracy} label="Accuracy" size={80} />
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex h-[80px] w-[80px] items-center justify-center rounded-full border-2 border-muted text-lg font-bold text-foreground">
                        {sessionStartedAt ? formatDuration(durationSec) : "-"}
                      </div>
                      <div className="text-xs text-muted-foreground">Time</div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex h-[80px] w-[80px] items-center justify-center rounded-full border-2 border-muted text-base font-bold text-foreground">
                        {matchedRequiredCount}/{requiredActionKeys.length}
                      </div>
                      <div className="text-xs text-muted-foreground">Required</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant={checkrideComplete ? "default" : "outline"}>
                      {checkrideComplete ? "Ready to finalize" : "In progress"}
                    </Badge>
                    <Button type="button" onClick={handleCompleteCheckride} disabled={!checkrideComplete}>
                      Generate instructor report
                    </Button>
                    <Button type="button" variant="outline" onClick={resetSession}>
                      Reset attempt
                    </Button>
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div className="space-y-3">
              <div className="text-sm font-semibold">Instructor review</div>
              {lastSessionReport ? (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                  <div className="font-semibold">{lastSessionReport.taskTitle}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(lastSessionReport.completedAt).toLocaleString()}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">Score {lastSessionReport.score}/100</Badge>
                    <Badge variant="outline">Accuracy {lastSessionReport.accuracy}%</Badge>
                    <Badge variant="outline">Completion {lastSessionReport.completion}%</Badge>
                    <Badge variant="outline">Time {formatDuration(lastSessionReport.durationSec)}</Badge>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => downloadSessionReport(lastSessionReport)}
                  >
                    Download report
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No instructor report saved yet. Finish a checkride to generate one.
                </div>
              )}
              {!canPersist && (
                <div className="text-xs text-muted-foreground">
                  Instructor reports save with RSF Pro. Upgrade to unlock report history and sharing.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>IFR Scenarios</CardTitle>
            <CardDescription>Practice real-world workflows with short scenarios.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {resolvedUnit.scenarios.map((scenario) => {
                const isActive = activeScenarioId === scenario.id;
                return (
                  <div
                    key={scenario.id}
                    className={[
                      "rounded-lg border p-4 space-y-3 transition-colors",
                      isActive
                        ? "border-sky-300 bg-sky-50/50"
                        : "hover:border-muted-foreground/30",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold">{scenario.title}</div>
                      {isActive && (
                        <Badge variant="default" className="text-xs shrink-0">
                          Active
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {scenario.summary}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {scenario.tasks.map((taskId) => {
                        const task = resolvedUnit.tasks.find((t) => t.id === taskId);
                        return (
                          <button
                            key={taskId}
                            type="button"
                            onClick={() => {
                              setSelectedTaskId(taskId);
                              handleScenarioStart(scenario.id);
                            }}
                            className="rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-muted hover:border-foreground/30"
                          >
                            {task?.title ?? taskId}
                          </button>
                        );
                      })}
                    </div>
                    {scenario.notes && scenario.notes.length > 0 && (
                      <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                        {scenario.notes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={isActive ? "secondary" : "outline"}
                        onClick={() => handleScenarioStart(scenario.id)}
                      >
                        {isActive ? "Restart" : "Load scenario"}
                      </Button>
                      {isActive && (
                        <Button type="button" size="sm" variant="ghost" onClick={handleScenarioReset}>
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
