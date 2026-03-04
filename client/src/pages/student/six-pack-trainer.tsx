import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { trackEvent } from "@/lib/analytics";
import { apiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import "./six-pack-trainer.css";

type Instrument = {
  id: string;
  name: string;
  shortDescription: string;
  systemSource: string;
  howToUse: string[];
  commonErrors: string[];
  failureIndications: string[];
  quickTips: string[];
  quizFacts: string[];
};

type Hotspot = {
  id: string;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
};

type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
};

type SixPackProgress = {
  exploreVisited: string[];
  guidedCompleted: boolean;
  quizBestScore: number;
  quizCompleted: boolean;
  guestClicks: number;
};

type FlightControls = {
  pitchCmd: number;
  bankCmd: number;
  throttlePct: number;
  rudderTrim: number;
};

type FlightState = {
  pitchDeg: number;
  bankDeg: number;
  headingDeg: number;
  airspeedKts: number;
  altitudeFt: number;
  vsiFpm: number;
  slipSkid: number;
  turnRateDegPerSec: number;
  throttlePct: number;
  timeSec: number;
};

type FlightScenario = {
  id: string;
  title: string;
  description: string;
  state: Partial<FlightState>;
  controls?: Partial<FlightControls>;
  explainer: string;
};

const S3_PUBLIC_BASE = "https://readysetfly-images.s3.us-east-2.amazonaws.com";
const PANEL_S3_URL = `${S3_PUBLIC_BASE}/6pack-instrument-panel.png`;
const rawPanelUrl = import.meta.env.VITE_SIX_PACK_PANEL_URL as string | undefined;

const buildPanelCandidates = () => {
  const candidates: string[] = [];
  const addCandidate = (value?: string) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed || candidates.includes(trimmed)) return;
    candidates.push(trimmed);
  };

  if (rawPanelUrl) {
    if (rawPanelUrl.startsWith("http")) {
      addCandidate(rawPanelUrl);
    } else if (rawPanelUrl.startsWith("/")) {
      addCandidate(apiUrl(rawPanelUrl));
    } else {
      addCandidate(`${S3_PUBLIC_BASE}/${rawPanelUrl.replace(/^\/+/, "")}`);
    }
  }

  addCandidate(PANEL_S3_URL);
  addCandidate(apiUrl("/api/six-pack/panel"));

  return candidates;
};

const PANEL_CANDIDATES = buildPanelCandidates();

const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const normalizeHeading = (value: number) => {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};
const approachValue = (current: number, target: number, ratePerSec: number, dt: number) => {
  const delta = target - current;
  const maxStep = ratePerSec * dt;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
};

const DEFAULT_CONTROLS: FlightControls = {
  pitchCmd: 0,
  bankCmd: 0,
  throttlePct: 55,
  rudderTrim: 0,
};

const DEFAULT_STATE: FlightState = {
  pitchDeg: 0,
  bankDeg: 0,
  headingDeg: 0,
  airspeedKts: 105,
  altitudeFt: 3500,
  vsiFpm: 0,
  slipSkid: 0,
  turnRateDegPerSec: 0,
  throttlePct: 55,
  timeSec: 0,
};

const FLIGHT_SCENARIOS: FlightScenario[] = [
  {
    id: "straight-level",
    title: "Straight & Level",
    description: "Stabilized cruise with centered ball.",
    state: { pitchDeg: 0, bankDeg: 0, airspeedKts: 105, altitudeFt: 3500, vsiFpm: 0 },
    controls: { pitchCmd: 0, bankCmd: 0, throttlePct: 55, rudderTrim: 0 },
    explainer: "Stable attitude produces a steady airspeed and zero vertical speed.",
  },
  {
    id: "climb",
    title: "Climb",
    description: "Smooth pitch-up with added power.",
    state: { pitchDeg: 6, bankDeg: 0, airspeedKts: 95, vsiFpm: 700 },
    controls: { pitchCmd: 6, bankCmd: 0, throttlePct: 75, rudderTrim: 0 },
    explainer: "Pitch up increases climb rate; airspeed decays unless power is added.",
  },
  {
    id: "descend",
    title: "Descend",
    description: "Lower the nose and manage airspeed.",
    state: { pitchDeg: -4, bankDeg: 0, airspeedKts: 115, vsiFpm: -600 },
    controls: { pitchCmd: -4, bankCmd: 0, throttlePct: 35, rudderTrim: 0 },
    explainer: "Pitch down increases airspeed; VSI reacts first, altitude follows.",
  },
  {
    id: "standard-left",
    title: "Standard Rate Turn (L)",
    description: "Bank to ~15 deg and hold coordinated.",
    state: { pitchDeg: 1, bankDeg: -15, airspeedKts: 100, vsiFpm: 0 },
    controls: { pitchCmd: 1, bankCmd: -15, throttlePct: 55, rudderTrim: 0 },
    explainer: "Bank angle drives turn rate; keep the ball centered.",
  },
  {
    id: "standard-right",
    title: "Standard Rate Turn (R)",
    description: "Bank to ~15 deg and hold coordinated.",
    state: { pitchDeg: 1, bankDeg: 15, airspeedKts: 100, vsiFpm: 0 },
    controls: { pitchCmd: 1, bankCmd: 15, throttlePct: 55, rudderTrim: 0 },
    explainer: "Turns are driven by bank, not rudder alone.",
  },
  {
    id: "unusual-high",
    title: "Unusual Attitude (Nose High)",
    description: "Recover from a nose-high attitude.",
    state: { pitchDeg: 15, bankDeg: 10, airspeedKts: 70, vsiFpm: 900 },
    controls: { pitchCmd: 10, bankCmd: 10, throttlePct: 70, rudderTrim: 0 },
    explainer: "Reduce pitch and add power to regain airspeed.",
  },
  {
    id: "unusual-low",
    title: "Unusual Attitude (Nose Low)",
    description: "Recover from a nose-low attitude.",
    state: { pitchDeg: -15, bankDeg: -25, airspeedKts: 140, vsiFpm: -1500 },
    controls: { pitchCmd: -8, bankCmd: -20, throttlePct: 30, rudderTrim: 0 },
    explainer: "Level the wings, reduce power, then ease back on pitch.",
  },
];

const SCAN_LINKS: Record<string, string[]> = {
  ai: ["asi", "altimeter", "vsi"],
  asi: ["ai", "vsi"],
  altimeter: ["ai", "vsi"],
  vsi: ["ai", "altimeter"],
  turn: ["heading"],
  heading: ["turn"],
};

const INSTRUMENTS: Instrument[] = [
  {
    id: "asi",
    name: "Airspeed Indicator",
    shortDescription: "Shows indicated airspeed from pitot and static pressure.",
    systemSource: "Pitot + static",
    howToUse: [
      "Confirm takeoff roll with 'airspeed alive.'",
      "Cross-check airspeed with pitch and power.",
      "Use trend changes to adjust pitch early.",
    ],
    commonErrors: [
      "Position error near flaps or slip.",
      "Lag during rapid pitch changes.",
      "Incorrect reading with blocked pitot or static.",
    ],
    failureIndications: [
      "Pitot blocked: acts like an altimeter.",
      "Static blocked: freezes or changes with altitude changes.",
      "Icing: needle drops or reads zero.",
    ],
    quickTips: [
      "Call out 'airspeed alive' on the roll.",
      "Use small pitch changes to correct trend.",
    ],
    quizFacts: ["Uses both pitot and static pressure."],
  },
  {
    id: "ai",
    name: "Attitude Indicator",
    shortDescription: "Primary pitch and bank reference for scan.",
    systemSource: "Gyro (vacuum or electric)",
    howToUse: [
      "Lead with attitude, then cross-check other instruments.",
      "Set and hold pitch for climbs and descents.",
      "Confirm bank angle on turns and rollouts.",
    ],
    commonErrors: [
      "Fixating on the horizon bar too long.",
      "Chasing small oscillations instead of smoothing.",
      "Ignoring precession or drift over time.",
    ],
    failureIndications: [
      "Tumbling or frozen horizon.",
      "Uncommanded roll or pitch movement.",
      "Low suction or power warning.",
    ],
    quickTips: [
      "Lead the scan with the attitude indicator.",
      "Use small corrections, then recheck.",
    ],
    quizFacts: ["Gyro-driven, most important for basic control."],
  },
  {
    id: "altimeter",
    name: "Altimeter",
    shortDescription: "Displays altitude based on static pressure.",
    systemSource: "Static",
    howToUse: [
      "Set baro before takeoff and approach.",
      "Cross-check with VSI for trend.",
      "Confirm level-off within target altitude.",
    ],
    commonErrors: [
      "Incorrect baro setting.",
      "Lag during rapid climbs or descents.",
      "Misreading the hundreds vs thousands hands.",
    ],
    failureIndications: [
      "Static blocked: altitude freezes.",
      "Rapid fluctuations in turbulence or leaks.",
    ],
    quickTips: [
      "Say the full altitude out loud (e.g., 3,500).",
      "Recheck baro at each update.",
    ],
    quizFacts: ["Static-only instrument."],
  },
  {
    id: "turn",
    name: "Turn Coordinator",
    shortDescription: "Shows rate of turn and slip/skid.",
    systemSource: "Gyro (typically electric)",
    howToUse: [
      "Use the wings to confirm standard rate turns.",
      "Center the ball with coordinated rudder.",
      "Cross-check with heading for rollout timing.",
    ],
    commonErrors: [
      "Ignoring the slip/skid ball.",
      "Using it instead of attitude for pitch.",
    ],
    failureIndications: [
      "No response when banking.",
      "Ball stuck or drifting when wings level.",
    ],
    quickTips: [
      "Keep the ball centered with light rudder.",
      "Standard rate = 3 deg/sec.",
    ],
    quizFacts: ["Shows rate of turn and coordination."],
  },
  {
    id: "heading",
    name: "Heading Indicator",
    shortDescription: "Gyro heading reference aligned with compass.",
    systemSource: "Gyro (vacuum or electric)",
    howToUse: [
      "Set to the magnetic compass regularly.",
      "Use for steady headings in turbulence.",
      "Cross-check with turn coordinator for rollout.",
    ],
    commonErrors: [
      "Forgetting to realign with compass.",
      "Assuming it is always accurate.",
    ],
    failureIndications: [
      "Rapid drift or frozen card.",
      "Uncommanded rotation on straight flight.",
    ],
    quickTips: [
      "Align every 10-15 minutes.",
      "Trust it more than the compass in turbulence.",
    ],
    quizFacts: ["Most affected by precession."],
  },
  {
    id: "vsi",
    name: "Vertical Speed Indicator",
    shortDescription: "Shows rate of climb or descent.",
    systemSource: "Static",
    howToUse: [
      "Use to catch trends early.",
      "Confirm level-off within 100 fpm.",
      "Cross-check with altimeter for accuracy.",
    ],
    commonErrors: [
      "Chasing small needle movements.",
      "Ignoring lag after configuration changes.",
    ],
    failureIndications: [
      "Needle stuck at zero.",
      "Opposite indication after static blockage.",
    ],
    quickTips: [
      "Use VSI for trend, altimeter for truth.",
      "Smooth corrections prevent oscillation.",
    ],
    quizFacts: ["Best trend instrument for climb/descent."],
  },
];

const HOTSPOTS: Hotspot[] = [
  { id: "asi", xPct: 6, yPct: 6, wPct: 26, hPct: 36 },
  { id: "ai", xPct: 37, yPct: 6, wPct: 26, hPct: 36 },
  { id: "altimeter", xPct: 68, yPct: 6, wPct: 26, hPct: 36 },
  { id: "turn", xPct: 6, yPct: 54, wPct: 26, hPct: 36 },
  { id: "heading", xPct: 37, yPct: 54, wPct: 26, hPct: 36 },
  { id: "vsi", xPct: 68, yPct: 54, wPct: 26, hPct: 36 },
];

const GUIDE_SEQUENCE = ["ai", "asi", "altimeter", "turn", "heading", "vsi"] as const;

const QUIZ_BANK: QuizQuestion[] = [
  {
    id: "pitot-static",
    prompt: "Which instrument uses pitot and static pressure?",
    options: ["Airspeed Indicator", "Altimeter", "Heading Indicator", "Turn Coordinator"],
    answer: "Airspeed Indicator",
    explanation: "The ASI is the only six-pack instrument that uses pitot pressure.",
  },
  {
    id: "rate-of-climb",
    prompt: "Which instrument indicates rate of climb or descent?",
    options: ["Altimeter", "VSI", "Turn Coordinator", "Heading Indicator"],
    answer: "VSI",
    explanation: "The VSI shows vertical speed using static pressure changes over time.",
  },
  {
    id: "gyro-pitch-roll",
    prompt: "Which instrument is the primary pitch and bank reference?",
    options: ["Attitude Indicator", "Airspeed Indicator", "Altimeter", "VSI"],
    answer: "Attitude Indicator",
    explanation: "The attitude indicator is the main gyro reference for pitch and bank.",
  },
  {
    id: "static-only",
    prompt: "Which instrument uses only static pressure?",
    options: ["Altimeter", "Turn Coordinator", "Heading Indicator", "Attitude Indicator"],
    answer: "Altimeter",
    explanation: "The altimeter uses static pressure only.",
  },
  {
    id: "coordination",
    prompt: "Which instrument shows rate of turn and slip/skid?",
    options: ["Turn Coordinator", "Heading Indicator", "VSI", "Altimeter"],
    answer: "Turn Coordinator",
    explanation: "The turn coordinator displays rate of turn and the ball shows coordination.",
  },
  {
    id: "precession",
    prompt: "Which instrument requires periodic alignment with the magnetic compass?",
    options: ["Heading Indicator", "Airspeed Indicator", "VSI", "Altimeter"],
    answer: "Heading Indicator",
    explanation: "The heading indicator drifts and must be aligned to the compass.",
  },
  {
    id: "scan-lead",
    prompt: "Which instrument should lead the basic instrument scan?",
    options: ["Attitude Indicator", "VSI", "Turn Coordinator", "Altimeter"],
    answer: "Attitude Indicator",
    explanation: "The attitude indicator is the primary control instrument in the scan.",
  },
  {
    id: "trend-tool",
    prompt: "Which instrument is best for detecting vertical trend quickly?",
    options: ["VSI", "Altimeter", "Heading Indicator", "Turn Coordinator"],
    answer: "VSI",
    explanation: "The VSI is a trend instrument, showing changes before the altimeter.",
  },
  {
    id: "gyro-failure",
    prompt: "A tumbling horizon bar indicates failure of the:",
    options: ["Attitude Indicator", "VSI", "Altimeter", "Airspeed Indicator"],
    answer: "Attitude Indicator",
    explanation: "A tumbling horizon bar is a classic attitude indicator failure sign.",
  },
  {
    id: "static-block",
    prompt: "A blocked static port will freeze which instrument first?",
    options: ["Altimeter", "Heading Indicator", "Turn Coordinator", "Attitude Indicator"],
    answer: "Altimeter",
    explanation: "Static blockage freezes the altimeter; VSI returns to zero after a lag.",
  },
  {
    id: "ball-center",
    prompt: "Keeping the ball centered indicates:",
    options: ["Coordinated flight", "Best glide", "Level flight", "Standard rate turns"],
    answer: "Coordinated flight",
    explanation: "The ball centered means no slip or skid.",
  },
  {
    id: "airspeed-alive",
    prompt: "On takeoff, the callout 'airspeed alive' verifies:",
    options: ["The ASI is responding", "The VSI is centered", "The compass is aligned", "The VSI matches altitude"],
    answer: "The ASI is responding",
    explanation: "The ASI should show movement early in the takeoff roll.",
  },
];

const DEFAULT_PROGRESS: SixPackProgress = {
  exploreVisited: [],
  guidedCompleted: false,
  quizBestScore: 0,
  quizCompleted: false,
  guestClicks: 0,
};

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const buildQuiz = () => shuffle(QUIZ_BANK).slice(0, 10);

const mapRange = (value: number, inMin: number, inMax: number, outMin: number, outMax: number) => {
  const clamped = clampValue(value, inMin, inMax);
  const ratio = (clamped - inMin) / (inMax - inMin);
  return outMin + ratio * (outMax - outMin);
};

const simulateFlight = (prev: FlightState, controls: FlightControls, dt: number): FlightState => {
  const pitchCmd = clampValue(controls.pitchCmd, -15, 15);
  const bankCmd = clampValue(controls.bankCmd, -30, 30);
  const pitchDeg = approachValue(prev.pitchDeg, pitchCmd, 12, dt);
  const bankDeg = approachValue(prev.bankDeg, bankCmd, 18, dt);

  const turnRate = clampValue((bankDeg / 25) * 3, -6, 6);
  const headingDeg = normalizeHeading(prev.headingDeg + turnRate * dt);

  const targetAirspeed = clampValue(60 + controls.throttlePct * 1.2 - pitchDeg * 1.4, 45, 160);
  const airspeedKts = approachValue(prev.airspeedKts, targetAirspeed, 20, dt);

  const vsiTarget = clampValue(pitchDeg * 300 + (controls.throttlePct - 50) * 6, -2000, 2000);
  const vsiFpm = approachValue(prev.vsiFpm, vsiTarget, 1200, dt);

  const altitudeFt = prev.altitudeFt + (vsiFpm * dt) / 60;
  const slipSkid = clampValue((bankDeg / 25) - controls.rudderTrim, -1, 1);

  return {
    pitchDeg,
    bankDeg,
    headingDeg,
    airspeedKts,
    altitudeFt,
    vsiFpm,
    slipSkid,
    turnRateDegPerSec: turnRate,
    throttlePct: controls.throttlePct,
    timeSec: prev.timeSec + dt,
  };
};

const useFlightSimulator = () => {
  const [state, setState] = useState<FlightState>(DEFAULT_STATE);
  const [controls, setControls] = useState<FlightControls>(DEFAULT_CONTROLS);
  const controlsRef = useRef(controls);

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    let last = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      setState((prev) => simulateFlight(prev, controlsRef.current, dt));
    }, 1000 / 30);
    return () => window.clearInterval(interval);
  }, []);

  const applyScenario = (scenario: FlightScenario) => {
    setState((prev) => ({ ...prev, ...scenario.state }));
    if (scenario.controls) {
      setControls((prev) => ({ ...prev, ...scenario.controls }));
    }
  };

  const reset = () => {
    setState(DEFAULT_STATE);
    setControls(DEFAULT_CONTROLS);
  };

  return { state, controls, setControls, applyScenario, reset };
};

const InstrumentShell = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <svg viewBox="0 0 120 120" className="h-full w-full">
    <defs>
      <radialGradient id="instrumentGlow" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="#0f172a" />
        <stop offset="100%" stopColor="#020617" />
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="58" fill="#0b0b0b" stroke="#1f2937" strokeWidth="4" />
    <circle cx="60" cy="60" r="52" fill="url(#instrumentGlow)" stroke="#0f172a" strokeWidth="2" />
    {children}
    <text x="60" y="112" fill="#94a3b8" fontSize="9" textAnchor="middle">
      {label}
    </text>
  </svg>
);

const AttitudeIndicator = ({ pitchDeg, bankDeg }: { pitchDeg: number; bankDeg: number }) => {
  const pitchOffset = clampValue(pitchDeg, -20, 20) * 1.4;
  return (
    <InstrumentShell label="ATT">
      <g transform={`rotate(${bankDeg} 60 60)`}>
        <g transform={`translate(0 ${pitchOffset})`}>
          <rect x="8" y="8" width="104" height="52" fill="#2563eb" />
          <rect x="8" y="60" width="104" height="52" fill="#78350f" />
          <line x1="8" y1="60" x2="112" y2="60" stroke="#f8fafc" strokeWidth="2" />
        </g>
      </g>
      <line x1="25" y1="60" x2="95" y2="60" stroke="#fbbf24" strokeWidth="3" />
      <line x1="60" y1="60" x2="60" y2="75" stroke="#fbbf24" strokeWidth="3" />
      <polygon points="60,20 55,30 65,30" fill="#fbbf24" />
    </InstrumentShell>
  );
};

const AirspeedIndicator = ({ airspeedKts }: { airspeedKts: number }) => {
  const angle = mapRange(airspeedKts, 40, 160, -135, 135);
  return (
    <InstrumentShell label="ASI">
      {[40, 60, 80, 100, 120, 140, 160].map((speed) => {
        const tickAngle = mapRange(speed, 40, 160, -135, 135);
        const rad = (tickAngle * Math.PI) / 180;
        const x1 = 60 + Math.cos(rad) * 34;
        const y1 = 60 + Math.sin(rad) * 34;
        const x2 = 60 + Math.cos(rad) * 42;
        const y2 = 60 + Math.sin(rad) * 42;
        return <line key={speed} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e2e8f0" strokeWidth="2" />;
      })}
      <line
        x1="60"
        y1="60"
        x2="60"
        y2="22"
        stroke="#f87171"
        strokeWidth="3"
        transform={`rotate(${angle} 60 60)`}
      />
      <circle cx="60" cy="60" r="4" fill="#f87171" />
      <text x="60" y="70" fill="#e2e8f0" fontSize="10" textAnchor="middle">
        {Math.round(airspeedKts)} KT
      </text>
    </InstrumentShell>
  );
};

const Altimeter = ({ altitudeFt }: { altitudeFt: number }) => {
  const hundreds = normalizeHeading((altitudeFt % 1000) / 1000 * 360);
  const thousands = normalizeHeading((altitudeFt % 10000) / 10000 * 360);
  return (
    <InstrumentShell label="ALT">
      <circle cx="60" cy="60" r="40" fill="none" stroke="#94a3b8" strokeWidth="2" />
      <line
        x1="60"
        y1="60"
        x2="60"
        y2="26"
        stroke="#e2e8f0"
        strokeWidth="2"
        transform={`rotate(${hundreds} 60 60)`}
      />
      <line
        x1="60"
        y1="60"
        x2="60"
        y2="18"
        stroke="#fbbf24"
        strokeWidth="3"
        transform={`rotate(${thousands} 60 60)`}
      />
      <circle cx="60" cy="60" r="4" fill="#fbbf24" />
      <text x="60" y="90" fill="#e2e8f0" fontSize="10" textAnchor="middle">
        {Math.round(altitudeFt)} ft
      </text>
    </InstrumentShell>
  );
};

const VerticalSpeed = ({ vsiFpm }: { vsiFpm: number }) => {
  const angle = mapRange(vsiFpm, -2000, 2000, -90, 90);
  return (
    <InstrumentShell label="VSI">
      <circle cx="60" cy="60" r="36" fill="none" stroke="#94a3b8" strokeWidth="2" />
      <line
        x1="60"
        y1="60"
        x2="60"
        y2="26"
        stroke="#38bdf8"
        strokeWidth="3"
        transform={`rotate(${angle} 60 60)`}
      />
      <text x="60" y="90" fill="#e2e8f0" fontSize="10" textAnchor="middle">
        {Math.round(vsiFpm)} fpm
      </text>
    </InstrumentShell>
  );
};

const HeadingIndicator = ({ headingDeg }: { headingDeg: number }) => {
  return (
    <InstrumentShell label="HDG">
      <g transform={`rotate(${-headingDeg} 60 60)`}>
        <circle cx="60" cy="60" r="40" fill="none" stroke="#94a3b8" strokeWidth="2" />
        {[0, 90, 180, 270].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x = 60 + Math.cos(rad) * 34;
          const y = 60 + Math.sin(rad) * 34;
          const label = deg === 0 ? "N" : deg === 90 ? "E" : deg === 180 ? "S" : "W";
          return (
            <text key={deg} x={x} y={y + 4} fill="#e2e8f0" fontSize="10" textAnchor="middle">
              {label}
            </text>
          );
        })}
      </g>
      <polygon points="60,12 54,24 66,24" fill="#fbbf24" />
      <text x="60" y="90" fill="#e2e8f0" fontSize="10" textAnchor="middle">
        {Math.round(headingDeg)} deg
      </text>
    </InstrumentShell>
  );
};

const TurnCoordinator = ({
  bankDeg,
  slipSkid,
  turnRate,
}: {
  bankDeg: number;
  slipSkid: number;
  turnRate: number;
}) => {
  const bank = clampValue(bankDeg, -30, 30);
  const ballOffset = clampValue(slipSkid, -1, 1) * 14;
  return (
    <InstrumentShell label="TURN">
      <rect x="18" y="30" width="84" height="40" rx="8" fill="#111827" stroke="#334155" />
      <g transform={`rotate(${bank} 60 50)`}>
        <rect x="48" y="46" width="24" height="8" fill="#e2e8f0" />
        <rect x="58" y="36" width="4" height="24" fill="#e2e8f0" />
      </g>
      <rect x="30" y="78" width="60" height="8" rx="4" fill="#0f172a" stroke="#334155" />
      <circle cx={60 + ballOffset} cy="82" r="4" fill="#fbbf24" />
      <text x="60" y="100" fill="#e2e8f0" fontSize="10" textAnchor="middle">
        {turnRate.toFixed(1)} deg/s
      </text>
    </InstrumentShell>
  );
};

export default function StudentSixPackTrainer() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { profile, saveProfile } = useStudentProfile();

  const instrumentMap = useMemo(
    () => new Map(INSTRUMENTS.map((instrument) => [instrument.id, instrument])),
    []
  );

  const initialProgress = useMemo(() => {
    const stored = (profile.progressJson as Record<string, any> | undefined)?.sixPack;
    return { ...DEFAULT_PROGRESS, ...(stored || {}) };
  }, [profile.progressJson]);

  const [mode, setMode] = useState<"explore" | "guided" | "quiz">("explore");
  const [activeInstrumentId, setActiveInstrumentId] = useState<string | null>("ai");
  const [highlightMode, setHighlightMode] = useState(true);
  const [scanLinksEnabled, setScanLinksEnabled] = useState(true);
  const [explainEnabled, setExplainEnabled] = useState(true);
  const [scanFocusId, setScanFocusId] = useState<string | null>(null);
  const [progress, setProgress] = useState<SixPackProgress>(initialProgress);
  const [guidedStepIndex, setGuidedStepIndex] = useState(0);
  const [guidedHint, setGuidedHint] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(() => buildQuiz());
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizChecked, setQuizChecked] = useState(false);
  const [showGuestGate, setShowGuestGate] = useState(false);
  const [panelIndex, setPanelIndex] = useState(0);
  const [panelLoaded, setPanelLoaded] = useState(false);
  const [panelError, setPanelError] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState(FLIGHT_SCENARIOS[0]?.id ?? "straight-level");
  const [lastExplainer, setLastExplainer] = useState<string | null>(null);
  const [padPoint, setPadPoint] = useState({ x: 0.5, y: 0.5 });
  const [isPadActive, setIsPadActive] = useState(false);
  const padRef = useRef<HTMLDivElement | null>(null);
  const padDotRef = useRef<HTMLDivElement | null>(null);

  const { state: flightState, controls, setControls, applyScenario, reset } = useFlightSimulator();

  const panelSrc = PANEL_CANDIDATES[panelIndex] ?? PANEL_S3_URL;
  const activeInstrument = instrumentMap.get(activeInstrumentId || "ai") || INSTRUMENTS[0];
  const isGuest = !user;
  const guestLimit = 2;
  const guestLocked = isGuest && progress.guestClicks >= guestLimit;
  const guidedComplete = progress.guidedCompleted;
  const activeScenario = useMemo(
    () => FLIGHT_SCENARIOS.find((scenario) => scenario.id === activeScenarioId) ?? FLIGHT_SCENARIOS[0],
    [activeScenarioId]
  );

  const pushExplainer = useCallback(
    (message: string) => {
      if (!explainEnabled) return;
      setLastExplainer(message);
    },
    [explainEnabled]
  );

  useEffect(() => {
    setProgress(initialProgress);
  }, [initialProgress]);

  useEffect(() => {
    trackEvent("student_page_view", { page: "six_pack_trainer" });
  }, []);

  useEffect(() => {
    setShowGuestGate(guestLocked);
  }, [guestLocked]);

  useEffect(() => {
    setPanelLoaded(false);
  }, [panelIndex]);

  useEffect(() => {
    if (FLIGHT_SCENARIOS[0]) {
      applyScenario(FLIGHT_SCENARIOS[0]);
    }
  }, [applyScenario]);

  useEffect(() => {
    if (isPadActive) return;
    const x = clampValue((controls.bankCmd / 30 + 1) / 2, 0, 1);
    const y = clampValue(1 - (controls.pitchCmd / 15 + 1) / 2, 0, 1);
    setPadPoint({ x, y });
  }, [controls.bankCmd, controls.pitchCmd, isPadActive]);

  useEffect(() => {
    if (!padDotRef.current) {
      return;
    }
    const x = clampValue(padPoint.x, 0, 1);
    const y = clampValue(padPoint.y, 0, 1);
    padDotRef.current.style.left = `${x * 100}%`;
    padDotRef.current.style.top = `${y * 100}%`;
  }, [padPoint.x, padPoint.y]);

  useEffect(() => {
    if (progress.guidedCompleted) {
      setGuidedStepIndex(GUIDE_SEQUENCE.length);
    }
  }, [progress.guidedCompleted]);

  const persistProgress = useCallback(
    (next: SixPackProgress) => {
      setProgress(next);
      const progressJson =
        typeof profile.progressJson === "object" && profile.progressJson !== null
          ? { ...(profile.progressJson as Record<string, any>), sixPack: next }
          : { sixPack: next };
      saveProfile({ progressJson });
    },
    [profile.progressJson, saveProfile]
  );

  const updateControls = useCallback(
    (next: Partial<FlightControls>, message?: string) => {
      setControls((prev) => ({
        ...prev,
        pitchCmd: clampValue(next.pitchCmd ?? prev.pitchCmd, -15, 15),
        bankCmd: clampValue(next.bankCmd ?? prev.bankCmd, -30, 30),
        throttlePct: clampValue(next.throttlePct ?? prev.throttlePct, 0, 100),
        rudderTrim: clampValue(next.rudderTrim ?? prev.rudderTrim, -1, 1),
      }));
      if (message) pushExplainer(message);
    },
    [pushExplainer, setControls]
  );

  const handleScenarioApply = useCallback(
    (scenarioId: string) => {
      setActiveScenarioId(scenarioId);
      const scenario = FLIGHT_SCENARIOS.find((item) => item.id === scenarioId);
      if (scenario) {
        applyScenario(scenario);
        pushExplainer(scenario.explainer);
      }
    },
    [applyScenario, pushExplainer]
  );

  const handleResetScenario = useCallback(() => {
    reset();
    setActiveScenarioId(FLIGHT_SCENARIOS[0]?.id ?? "straight-level");
    pushExplainer("Back to straight-and-level. Rebuild the scan from neutral.");
  }, [reset, pushExplainer]);

  const handleThrottleChange = useCallback(
    (value: number) => {
      const message =
        value > controls.throttlePct
          ? "Power added: expect airspeed and climb to build."
          : "Power reduced: expect airspeed and VSI to settle down.";
      updateControls({ throttlePct: value }, message);
    },
    [controls.throttlePct, updateControls]
  );

  const handleRudderTrimChange = useCallback(
    (value: number) => {
      const message =
        value > controls.rudderTrim
          ? "Trimmed right: watch the ball move right of center."
          : "Trimmed left: watch the ball move left of center.";
      updateControls({ rudderTrim: value }, message);
    },
    [controls.rudderTrim, updateControls]
  );

  const updatePadFromEvent = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!padRef.current) return;
      const rect = padRef.current.getBoundingClientRect();
      const x = clampValue((event.clientX - rect.left) / rect.width, 0, 1);
      const y = clampValue((event.clientY - rect.top) / rect.height, 0, 1);
      setPadPoint({ x, y });
      const bankCmd = clampValue((x - 0.5) * 2 * 30, -30, 30);
      const pitchCmd = clampValue((0.5 - y) * 2 * 15, -15, 15);
      updateControls(
        { bankCmd, pitchCmd },
        pitchCmd > 3
          ? "Pitch up increases climb rate; airspeed may decay without power."
          : pitchCmd < -3
            ? "Pitch down trades altitude for airspeed; VSI moves first."
            : "Bank angle drives turn rate; keep the ball centered."
      );
    },
    [updateControls]
  );

  const handlePadPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      setIsPadActive(true);
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      updatePadFromEvent(event);
    },
    [updatePadFromEvent]
  );

  const handlePadPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isPadActive) return;
      updatePadFromEvent(event);
    },
    [isPadActive, updatePadFromEvent]
  );

  const handlePadPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    setIsPadActive(false);
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }, []);

  const handleInstrumentClick = useCallback(
    (instrumentId: string) => {
      if (guestLocked) {
        setShowGuestGate(true);
        return;
      }

      if (isGuest) {
        const nextClicks = progress.guestClicks + 1;
        persistProgress({ ...progress, guestClicks: nextClicks });
        if (nextClicks >= guestLimit) {
          setShowGuestGate(true);
        }
      }

      setActiveInstrumentId(instrumentId);
      if (isMobile) {
        setInfoOpen(true);
      }
      trackEvent("instrument_click", { instrument: instrumentId, mode });

      if (!progress.exploreVisited.includes(instrumentId)) {
        persistProgress({
          ...progress,
          exploreVisited: [...progress.exploreVisited, instrumentId],
        });
      }

      if (mode === "guided") {
        const expected = GUIDE_SEQUENCE[Math.min(guidedStepIndex, GUIDE_SEQUENCE.length - 1)];
        if (instrumentId === expected) {
          const nextStep = guidedStepIndex + 1;
          trackEvent("guided_step_complete", { step: guidedStepIndex + 1, instrument: instrumentId });
          setGuidedHint("");
          if (nextStep >= GUIDE_SEQUENCE.length) {
            setGuidedStepIndex(GUIDE_SEQUENCE.length);
            persistProgress({ ...progress, guidedCompleted: true });
          } else {
            setGuidedStepIndex(nextStep);
          }
        } else {
          const expectedName = instrumentMap.get(expected)?.name || "the next instrument";
          setGuidedHint(`Try the ${expectedName}.`);
        }
      }
    },
    [
      guestLocked,
      isGuest,
      progress,
      persistProgress,
      mode,
      guidedStepIndex,
      instrumentMap,
    ]
  );

  const resetGuided = () => {
    setGuidedStepIndex(0);
    setGuidedHint("");
    persistProgress({ ...progress, guidedCompleted: false });
  };

  const quizScore = useMemo(() => {
    return quizQuestions.reduce(
      (acc, question) => {
        if (quizAnswers[question.id]) acc.total += 1;
        if (quizAnswers[question.id] === question.answer) acc.correct += 1;
        return acc;
      },
      { correct: 0, total: 0 }
    );
  }, [quizQuestions, quizAnswers]);

  const checkQuiz = () => {
    setQuizChecked(true);
    trackEvent("quiz_completed", { score: quizScore.correct, total: quizQuestions.length });
    if (quizScore.correct > progress.quizBestScore) {
      persistProgress({ ...progress, quizBestScore: quizScore.correct, quizCompleted: true });
    } else if (!progress.quizCompleted) {
      persistProgress({ ...progress, quizCompleted: true });
    }
  };

  const resetQuiz = () => {
    setQuizQuestions(buildQuiz());
    setQuizAnswers({});
    setQuizChecked(false);
  };

  const renderInfoPanel = () => (
    <Card className="border-muted-foreground/20 bg-slate-950 text-white">
      <CardHeader>
        <CardTitle className="text-lg">{activeInstrument.name}</CardTitle>
        <p className="text-sm text-slate-300">{activeInstrument.shortDescription}</p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview">
          <TabsList className="bg-slate-900">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="failures">Failures</TabsTrigger>
            <TabsTrigger value="tips">Tips</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="text-sm text-slate-200 space-y-2">
            <div className="font-semibold">What it measures</div>
            <p>{activeInstrument.shortDescription}</p>
            <div className="font-semibold">How pilots use it</div>
            <ul className="list-disc pl-4 space-y-1">
              {activeInstrument.howToUse.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="system" className="text-sm text-slate-200 space-y-2">
            <div className="font-semibold">Source system</div>
            <p>{activeInstrument.systemSource}</p>
            <div className="font-semibold">Quick check</div>
            <ul className="list-disc pl-4 space-y-1">
              {activeInstrument.quickTips.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="failures" className="text-sm text-slate-200 space-y-2">
            <div className="font-semibold">Common errors</div>
            <ul className="list-disc pl-4 space-y-1">
              {activeInstrument.commonErrors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="font-semibold">Failure indications</div>
            <ul className="list-disc pl-4 space-y-1">
              {activeInstrument.failureIndications.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="tips" className="text-sm text-slate-200 space-y-2">
            <div className="font-semibold">Quick tips</div>
            <ul className="list-disc pl-4 space-y-1">
              {activeInstrument.quickTips.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="font-semibold">Quiz facts</div>
            <ul className="list-disc pl-4 space-y-1">
              {activeInstrument.quizFacts.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );

  const guideStepId = GUIDE_SEQUENCE[Math.min(guidedStepIndex, GUIDE_SEQUENCE.length - 1)];
  const guideStepName = instrumentMap.get(guideStepId)?.name || "Next instrument";
  const highlightTargetId =
    mode === "guided" && guidedStepIndex < GUIDE_SEQUENCE.length ? guideStepId : activeInstrumentId;

  const scanTargets = useMemo(() => {
    if (!scanLinksEnabled || !scanFocusId) return new Set<string>();
    return new Set([scanFocusId, ...(SCAN_LINKS[scanFocusId] ?? [])]);
  }, [scanLinksEnabled, scanFocusId]);

  const renderInstrumentOverlay = (instrumentId: string) => {
    switch (instrumentId) {
      case "asi":
        return <AirspeedIndicator airspeedKts={flightState.airspeedKts} />;
      case "ai":
        return <AttitudeIndicator pitchDeg={flightState.pitchDeg} bankDeg={flightState.bankDeg} />;
      case "altimeter":
        return <Altimeter altitudeFt={flightState.altitudeFt} />;
      case "turn":
        return (
          <TurnCoordinator
            bankDeg={flightState.bankDeg}
            slipSkid={flightState.slipSkid}
            turnRate={flightState.turnRateDegPerSec}
          />
        );
      case "heading":
        return <HeadingIndicator headingDeg={flightState.headingDeg} />;
      case "vsi":
        return <VerticalSpeed vsiFpm={flightState.vsiFpm} />;
      default:
        return null;
    }
  };

  const renderPanel = (options?: { showExpand?: boolean; className?: string }) => {
    const showExpand = options?.showExpand ?? false;
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-slate-900 aspect-[4/3] min-h-[280px] sm:min-h-[380px]",
          options?.className
        )}
      >
        <img
          src={panelSrc}
          alt="RSF six-pack trainer panel"
          className="absolute inset-0 h-full w-full object-contain"
          onLoad={() => {
            setPanelLoaded(true);
            setPanelError(false);
          }}
          onError={() => {
            setPanelLoaded(false);
            if (panelIndex < PANEL_CANDIDATES.length - 1) {
              setPanelIndex(panelIndex + 1);
              return;
            }
            setPanelError(true);
          }}
        />
        {showExpand && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="absolute right-3 top-3 z-20 shadow"
            onClick={() => setPanelExpanded(true)}
          >
            Expand panel
          </Button>
        )}
        {!panelError &&
          HOTSPOTS.map((spot) => {
            const isSelected = spot.id === activeInstrumentId;
            const isHighlighted = highlightMode && highlightTargetId === spot.id;
            const isDimmed = highlightMode && highlightTargetId && !isHighlighted;
            const isLinked = scanTargets.has(spot.id);
            return (
              <div
                key={`${spot.id}-overlay`}
                data-hotspot={spot.id}
                className={cn(
                  "six-pack-panel-slot six-pack-panel-overlay transition",
                  isDimmed && "opacity-30",
                  isLinked && "opacity-100"
                )}
              >
                <div
                  className={cn(
                    "six-pack-overlay-surface h-full w-full rounded-full",
                    panelLoaded ? "six-pack-overlay-loaded" : "six-pack-overlay-loading",
                    isSelected && "ring-2 ring-sky-300",
                    isHighlighted && "ring-2 ring-amber-300"
                  )}
                >
                  {renderInstrumentOverlay(spot.id)}
                </div>
              </div>
            );
          })}
        {!panelError &&
          HOTSPOTS.map((spot) => {
            const isSelected = spot.id === activeInstrumentId;
            const isHighlighted = highlightMode && highlightTargetId === spot.id;
            const isDimmed = highlightMode && highlightTargetId && !isHighlighted;
            const isLinked = scanTargets.has(spot.id);
            const instrumentName = instrumentMap.get(spot.id)?.name || "Instrument";
            return (
              <button
                key={spot.id}
                type="button"
                aria-label={`Select ${instrumentName}`}
                data-hotspot={spot.id}
                className={cn(
                  "six-pack-hotspot six-pack-panel-slot rounded-full border-2 border-transparent transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected && "border-sky-400 bg-sky-400/10",
                  isHighlighted && "border-amber-400 bg-amber-400/10",
                  isLinked && "border-amber-300/70",
                  isDimmed && "bg-black/30"
                )}
                disabled={guestLocked}
                onClick={() => handleInstrumentClick(spot.id)}
                onMouseEnter={() => setScanFocusId(spot.id)}
                onMouseLeave={() => setScanFocusId(null)}
                onFocus={() => setScanFocusId(spot.id)}
                onBlur={() => setScanFocusId(null)}
              />
            );
          })}
        {panelError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-6 text-center text-white">
            <div className="space-y-3 max-w-sm">
              <div className="text-lg font-semibold">Panel image failed to load</div>
              <p className="text-sm text-white/80">
                Verify the S3 object is public and the URL is correct.
              </p>
              <Button asChild variant="secondary">
                <a href={panelSrc} target="_blank" rel="noopener noreferrer">
                  Open image URL
                </a>
              </Button>
            </div>
          </div>
        )}
        {showGuestGate && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6 text-center text-white">
            <div className="space-y-3 max-w-xs">
              <div className="text-lg font-semibold">Create a free account to continue</div>
              <p className="text-sm text-white/80">
                Guests can explore two instruments. Create an account to unlock the full panel.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button asChild variant="secondary">
                  <Link href="/register">Create free account</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <StudentLayout
      title="6-Pack Panel Trainer"
      subtitle="Learn the classic flight instruments with an interactive panel."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant={mode === "explore" ? "default" : "outline"}
            onClick={() => setMode("explore")}
          >
            Explore
          </Button>
          <Button
            type="button"
            variant={mode === "guided" ? "default" : "outline"}
            onClick={() => setMode("guided")}
          >
            Guided lesson
          </Button>
          <Button
            type="button"
            variant={mode === "quiz" ? "default" : "outline"}
            onClick={() => setMode("quiz")}
          >
            Quick quiz
          </Button>
          <div className="flex items-center gap-2">
            <Switch checked={highlightMode} onCheckedChange={setHighlightMode} />
            <span className="text-sm text-muted-foreground">Highlight mode</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={scanLinksEnabled} onCheckedChange={setScanLinksEnabled} />
            <span className="text-sm text-muted-foreground">Scan links</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={explainEnabled} onCheckedChange={setExplainEnabled} />
            <span className="text-sm text-muted-foreground">What just happened</span>
          </div>
          {isGuest && (
            <Badge variant="outline">
              Guest clicks: {Math.max(guestLimit - progress.guestClicks, 0)} left
            </Badge>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
          <div className="space-y-4 min-w-0">
            {renderPanel({ showExpand: true })}
            <p className="text-sm text-muted-foreground">
              Tap the instruments to learn what they do. This is an instructional trainer, not an FAA briefing.
            </p>
            <Card>
              <CardHeader>
                <CardTitle>Flight controls</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-[220px_1fr]">
                <div className="space-y-3">
                  <div className="text-sm font-semibold">Pitch & bank</div>
                  <div
                    ref={padRef}
                    className="six-pack-control-pad relative h-44 w-full rounded-xl border bg-slate-950/60"
                    onPointerDown={handlePadPointerDown}
                    onPointerMove={handlePadPointerMove}
                    onPointerUp={handlePadPointerUp}
                    onPointerLeave={handlePadPointerUp}
                  >
                    <div className="absolute inset-4 rounded-lg border border-dashed border-slate-700" />
                    <div
                      ref={padDotRef}
                      className="six-pack-pad-dot absolute h-4 w-4 rounded-full bg-amber-400 shadow"
                    />
                    <div className="absolute bottom-2 left-2 text-xs text-slate-300">
                      Drag to change attitude
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Pitch {flightState.pitchDeg.toFixed(1)} deg / Bank {flightState.bankDeg.toFixed(1)} deg
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                    <div className="text-sm font-semibold">Throttle</div>
                    <label className="sr-only" id="six-pack-throttle-label" htmlFor="six-pack-throttle">
                      Throttle percentage
                    </label>
                    <input
                      id="six-pack-throttle"
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(controls.throttlePct)}
                      onChange={(event) => handleThrottleChange(Number(event.target.value))}
                      className="w-full"
                      aria-label="Throttle percentage"
                      aria-labelledby="six-pack-throttle-label"
                      title="Throttle percentage"
                    />
                      <div className="text-xs text-muted-foreground">{Math.round(controls.throttlePct)}%</div>
                    </div>
                    <div className="space-y-2">
                    <div className="text-sm font-semibold">Rudder trim</div>
                    <label className="sr-only" id="six-pack-rudder-label" htmlFor="six-pack-rudder-trim">
                      Rudder trim
                    </label>
                    <input
                      id="six-pack-rudder-trim"
                      type="range"
                      min={-1}
                      max={1}
                      step={0.05}
                      value={Number(controls.rudderTrim.toFixed(2))}
                      onChange={(event) => handleRudderTrimChange(Number(event.target.value))}
                      className="w-full"
                      aria-label="Rudder trim"
                      aria-labelledby="six-pack-rudder-label"
                      title="Rudder trim"
                    />
                      <div className="text-xs text-muted-foreground">
                        {controls.rudderTrim.toFixed(2)} trim
                      </div>
                    </div>
                  </div>

                  <div className="text-sm font-semibold">Scenario presets</div>
                  <div className="flex flex-wrap gap-2">
                    {FLIGHT_SCENARIOS.map((scenario) => (
                      <Button
                        key={scenario.id}
                        type="button"
                        size="sm"
                        variant={scenario.id === activeScenarioId ? "default" : "outline"}
                        onClick={() => handleScenarioApply(scenario.id)}
                      >
                        {scenario.title}
                      </Button>
                    ))}
                    <Button type="button" size="sm" variant="outline" onClick={handleResetScenario}>
                      Reset
                    </Button>
                  </div>

                  <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground sm:grid-cols-3">
                    <div>Airspeed: {flightState.airspeedKts.toFixed(0)} kt</div>
                    <div>Alt: {flightState.altitudeFt.toFixed(0)} ft</div>
                    <div>VSI: {flightState.vsiFpm.toFixed(0)} fpm</div>
                    <div>Heading: {flightState.headingDeg.toFixed(0)} deg</div>
                    <div>Slip: {flightState.slipSkid.toFixed(2)}</div>
                    <div>Turn: {flightState.turnRateDegPerSec.toFixed(1)} deg/s</div>
                  </div>

                  {explainEnabled && lastExplainer && (
                    <div className="rounded-lg border bg-slate-950/60 p-3 text-sm text-slate-100">
                      <div className="text-xs font-semibold text-slate-300 mb-1">What just happened?</div>
                      {lastExplainer}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 min-w-0">
            {!isMobile && renderInfoPanel()}

            {mode === "guided" && (
              <Card>
                <CardHeader>
                  <CardTitle>Guided lesson</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {guidedStepIndex < GUIDE_SEQUENCE.length ? (
                    <>
                      <Badge variant="outline">
                        Step {guidedStepIndex + 1}/{GUIDE_SEQUENCE.length}
                      </Badge>
                      <p>
                        Start with <strong>{guideStepName}</strong>. Tap the highlighted instrument to continue.
                      </p>
                    </>
                  ) : (
                    <p className="font-semibold">Lesson complete. Great work!</p>
                  )}
                  {guidedHint && <p className="text-muted-foreground">{guidedHint}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={resetGuided}>
                      Reset lesson
                    </Button>
                    {guidedComplete && <Badge>Completed</Badge>}
                  </div>
                </CardContent>
              </Card>
            )}

            {mode === "quiz" && (
              <Card>
                <CardHeader>
                  <CardTitle>Quick quiz (10 questions)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      Score: {quizScore.correct}/{quizQuestions.length}
                    </Badge>
                    <Badge variant="secondary">
                      Best: {progress.quizBestScore}/{quizQuestions.length}
                    </Badge>
                    <Button type="button" variant="outline" size="sm" onClick={resetQuiz}>
                      Reset quiz
                    </Button>
                  </div>

                  {quizQuestions.map((question, index) => {
                    const selected = quizAnswers[question.id];
                    return (
                      <div key={question.id} className="rounded-lg border p-3 space-y-2">
                        <div className="font-semibold">{index + 1}. {question.prompt}</div>
                        <div className="flex flex-wrap gap-2">
                          {question.options.map((option) => {
                            const isSelected = selected === option;
                            const isCorrect = quizChecked && option === question.answer;
                            const isIncorrect = quizChecked && isSelected && option !== question.answer;
                            return (
                              <Button
                                key={option}
                                type="button"
                                variant={isSelected ? "default" : "outline"}
                                className={cn(
                                  isCorrect && "border-emerald-500 bg-emerald-50 text-emerald-700",
                                  isIncorrect && "border-destructive bg-destructive/10 text-destructive"
                                )}
                                onClick={() =>
                                  setQuizAnswers((prev) => ({ ...prev, [question.id]: option }))
                                }
                              >
                                {option}
                              </Button>
                            );
                          })}
                        </div>
                        {quizChecked && (
                          <p className="text-muted-foreground">{question.explanation}</p>
                        )}
                      </div>
                    );
                  })}

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={checkQuiz} disabled={quizChecked}>
                      Check answers
                    </Button>
                    {quizChecked && <Badge>Completed</Badge>}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {isMobile && (
        <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Instrument details</SheetTitle>
            </SheetHeader>
            {renderInfoPanel()}
          </SheetContent>
        </Sheet>
      )}

      <Dialog open={panelExpanded} onOpenChange={setPanelExpanded}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>6-Pack Panel Trainer</DialogTitle>
          </DialogHeader>
          <div className="mt-3">
            {renderPanel({ className: "min-h-[70vh] sm:min-h-[75vh]" })}
          </div>
        </DialogContent>
      </Dialog>
    </StudentLayout>
  );
}
