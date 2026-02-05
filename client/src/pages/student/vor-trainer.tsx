import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { trackEvent } from "@/lib/analytics";

type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
};

type Scenario = {
  id: string;
  title: string;
  description: string;
  targetObs: number;
  targetFlag: "TO" | "FROM";
  targetBearingFrom: number;
  toleranceDeg: number;
};

const SCENARIOS: Scenario[] = [
  {
    id: "to-270",
    title: "Inbound 270, on the 090 radial",
    description: "Set OBS to 270 with TO flag and center the CDI.",
    targetObs: 270,
    targetFlag: "TO",
    targetBearingFrom: 90,
    toleranceDeg: 3,
  },
  {
    id: "from-090",
    title: "Outbound 090, on the 090 radial",
    description: "Set OBS to 090 with FROM flag and center the CDI.",
    targetObs: 90,
    targetFlag: "FROM",
    targetBearingFrom: 90,
    toleranceDeg: 3,
  },
  {
    id: "intercept-180",
    title: "Intercept inbound 180 from 150 radial",
    description: "Set OBS to 180 with TO flag and center the CDI from the 150 radial.",
    targetObs: 180,
    targetFlag: "TO",
    targetBearingFrom: 150,
    toleranceDeg: 5,
  },
];

const QUIZ: QuizQuestion[] = [
  {
    id: "radial-definition",
    prompt: "A VOR radial is defined as:",
    options: [
      "The direction TO the station",
      "The direction FROM the station",
      "The aircraft heading when tracking the course",
    ],
    answer: "The direction FROM the station",
    explanation: "Radials are always the magnetic bearing FROM the station.",
  },
  {
    id: "obs-to-flag",
    prompt: "If your OBS is set to 090 and the TO flag is showing, you are tracking:",
    options: [
      "Inbound course 090 to the station",
      "Outbound radial 090 from the station",
      "Inbound course 270 to the station",
    ],
    answer: "Inbound course 090 to the station",
    explanation: "With TO flag, the OBS course is the inbound course TO the station.",
  },
  {
    id: "reciprocal-course",
    prompt: "If you want to fly OUTBOUND on the 180 radial, what OBS course should you set?",
    options: ["180", "360", "090"],
    answer: "180",
    explanation: "Outbound on the 180 radial uses OBS 180 with FROM flag.",
  },
];

const normalizeDeg = (deg: number) => {
  const normalized = deg % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const smallestAngleDiffDeg = (a: number, b: number) => {
  const diff = normalizeDeg(a - b);
  return diff > 180 ? diff - 360 : diff;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toCourseFromRadial = (bearingFromStationDeg: number) =>
  normalizeDeg(bearingFromStationDeg + 180);

const computeFlag = (obsDeg: number, bearingFromStationDeg: number) => {
  const toCourse = toCourseFromRadial(bearingFromStationDeg);
  const diffTo = smallestAngleDiffDeg(obsDeg, toCourse);
  return Math.abs(diffTo) <= 90 ? "TO" : "FROM";
};

const computeDeflection = (
  obsDeg: number,
  bearingFromStationDeg: number,
  fullScaleDeg = 10
) => {
  const flag = computeFlag(obsDeg, bearingFromStationDeg);
  const desiredRadial =
    flag === "TO" ? normalizeDeg(obsDeg + 180) : normalizeDeg(obsDeg);
  const radialErrorDeg = smallestAngleDiffDeg(bearingFromStationDeg, desiredRadial);
  const deflection = clamp(radialErrorDeg / fullScaleDeg, -1, 1);
  return { deflection, flag, radialErrorDeg };
};

const formatDeg = (value: number) => normalizeDeg(Math.round(value)).toString().padStart(3, "0");

export function VORTrainerV1() {
  const [obsDeg, setObsDeg] = useState(270);
  const [bearingFromStationDeg, setBearingFromStationDeg] = useState(90);
  const [activeScenario, setActiveScenario] = useState(SCENARIOS[0]);
  const [resultMessage, setResultMessage] = useState("");

  const knobRef = useRef<HTMLDivElement | null>(null);
  const startObsRef = useRef(obsDeg);
  const startAngleRef = useRef<number | null>(null);

  const fullScaleDeg = 10;
  const { deflection, flag, radialErrorDeg } = useMemo(
    () => computeDeflection(obsDeg, bearingFromStationDeg, fullScaleDeg),
    [obsDeg, bearingFromStationDeg]
  );

  const updateCenter = () => {
    if (!knobRef.current) return null;
    const rect = knobRef.current.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const handleKnobPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      startObsRef.current = obsDeg;
      const center = updateCenter();
      if (center) {
        startAngleRef.current = Math.atan2(event.clientY - center.y, event.clientX - center.x);
      }
    },
    [obsDeg]
  );

  const handleKnobPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (startAngleRef.current === null) return;
      const center = updateCenter();
      if (!center) return;
      const currentAngle = Math.atan2(event.clientY - center.y, event.clientX - center.x);
      const deltaAngle = currentAngle - startAngleRef.current;
      const deltaDeg = (deltaAngle * 180) / Math.PI;
      setObsDeg(normalizeDeg(startObsRef.current + deltaDeg));
    },
    []
  );

  const handleKnobPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    startAngleRef.current = null;
    setObsDeg((prev) => Math.round(normalizeDeg(prev)));
  }, []);

  const handleKnobWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const step = event.shiftKey ? 5 : 1;
    const delta = event.deltaY > 0 ? -step : step;
    setObsDeg((prev) => normalizeDeg(prev + delta));
  }, []);

  const adjustBearing = useCallback((delta: number) => {
    setBearingFromStationDeg((prev) => normalizeDeg(prev + delta));
  }, []);

  const handleLoadScenario = () => {
    setObsDeg(activeScenario.targetObs);
    setBearingFromStationDeg(activeScenario.targetBearingFrom);
    setResultMessage("");
  };

  const handleCheckScenario = () => {
    const obsDiff = Math.abs(smallestAngleDiffDeg(obsDeg, activeScenario.targetObs));
    const { deflection: scenarioDeflection, flag: scenarioFlag } = computeDeflection(
      obsDeg,
      bearingFromStationDeg,
      fullScaleDeg
    );
    const isCentered = Math.abs(scenarioDeflection) <= 0.1;
    const flagMatch = scenarioFlag === activeScenario.targetFlag;
    const obsMatch = obsDiff <= activeScenario.toleranceDeg;

    if (obsMatch && isCentered && flagMatch) {
      setResultMessage("Nice work. CDI centered with correct TO/FROM.");
      return;
    }

    const issues: string[] = [];
    if (!obsMatch) issues.push("OBS not aligned");
    if (!isCentered) issues.push("CDI not centered");
    if (!flagMatch) issues.push("TO/FROM mismatch");
    setResultMessage(`Keep tuning: ${issues.join(", ")}.`);
  };

  const knobPointerStyle = {
    transform: `rotate(${obsDeg}deg) translateY(-34px)`,
  };

  const cdiOffset = deflection * 40;
  const obsDisplay = formatDeg(obsDeg);
  const bearingDisplay = formatDeg(bearingFromStationDeg);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        adjustBearing(-5);
      }
      if (event.key === "ArrowRight") {
        adjustBearing(5);
      }
      if (event.key === "ArrowDown") {
        adjustBearing(-10);
      }
      if (event.key === "ArrowUp") {
        adjustBearing(10);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [adjustBearing]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-xl border bg-slate-950 p-4 shadow-sm">
            <svg viewBox="0 0 400 400" className="w-full h-auto select-none">
              <rect x="10" y="10" width="380" height="380" rx="14" fill="#111" stroke="#2d2d2d" strokeWidth="4" />
              {[
                [30, 30],
                [370, 30],
                [30, 370],
                [370, 370],
              ].map(([x, y], index) => (
                <g key={index}>
                  <circle cx={x} cy={y} r={10} fill="#1c1c1c" stroke="#444" />
                  <circle cx={x} cy={y} r={4} fill="#555" />
                </g>
              ))}

              <circle cx="200" cy="200" r="150" fill="#0b0b0b" stroke="#333" strokeWidth="3" />
              <circle cx="200" cy="200" r="132" fill="none" stroke="#262626" strokeWidth="2" />

              {[...Array(36)].map((_, idx) => {
                const angle = (idx * 10 * Math.PI) / 180;
                const inner = idx % 3 === 0 ? 120 : 126;
                const outer = 136;
                const x1 = 200 + inner * Math.sin(angle);
                const y1 = 200 - inner * Math.cos(angle);
                const x2 = 200 + outer * Math.sin(angle);
                const y2 = 200 - outer * Math.cos(angle);
                return (
                  <line
                    key={idx}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#ddd"
                    strokeWidth={idx % 3 === 0 ? 2 : 1}
                  />
                );
              })}

              {[0, 3, 6, 9].map((index) => {
                const angleDeg = index * 30;
                const angle = (angleDeg * Math.PI) / 180;
                const radius = 102;
                const x = 200 + radius * Math.sin(angle);
                const y = 200 - radius * Math.cos(angle) + 5;
                const label = (angleDeg === 0 ? "360" : angleDeg.toString()).padStart(3, "0");
                return (
                  <text key={angleDeg} x={x} y={y} fill="#f0f0f0" fontSize="14" textAnchor="middle" fontFamily="monospace">
                    {label}
                  </text>
                );
              })}

              <g transform={`rotate(${obsDeg} 200 200)`} style={{ transition: "transform 200ms ease-out" }}>
                <line x1="200" y1="65" x2="200" y2="335" stroke="#f3f3f3" strokeWidth="2" />
                <polygon points="200,48 190,68 210,68" fill="#f3f3f3" />
                <line x1="190" y1="200" x2="210" y2="200" stroke="#f3f3f3" strokeWidth="4" />
              </g>

              <g transform={`translate(${cdiOffset} 0)`}>
                <rect x="196" y="110" width="8" height="180" rx="3" fill="#f7f7f7" />
                <rect x="188" y="196" width="24" height="8" rx="3" fill="#f7f7f7" />
              </g>

              <rect x="160" y="140" width="80" height="28" rx="4" fill="#1a1a1a" stroke="#444" />
              <text x="200" y="159" fill="#ffd65a" fontSize="16" textAnchor="middle" fontFamily="sans-serif">
                {flag}
              </text>

              <circle cx="200" cy="200" r="6" fill="#f7f7f7" />
            </svg>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="font-semibold">OBS {obsDisplay}°</div>
            <div className="text-muted-foreground">Radial {bearingDisplay}°</div>
            <div className="text-muted-foreground">TO/FROM: {flag}</div>
            <div className="text-muted-foreground">Error: {radialErrorDeg.toFixed(1)}°</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => adjustBearing(-10)}>
              -10°
            </Button>
            <Button type="button" variant="outline" onClick={() => adjustBearing(-5)}>
              -5°
            </Button>
            <Button type="button" variant="outline" onClick={() => adjustBearing(5)}>
              +5°
            </Button>
            <Button type="button" variant="outline" onClick={() => adjustBearing(10)}>
              +10°
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scenario trainer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={activeScenario.id}
                onChange={(event) => {
                  const next = SCENARIOS.find((scenario) => scenario.id === event.target.value);
                  setActiveScenario(next || SCENARIOS[0]);
                }}
              >
                {SCENARIOS.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.title}
                  </option>
                ))}
              </select>
              <p className="text-sm text-muted-foreground">{activeScenario.description}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handleLoadScenario}>
                  Load scenario
                </Button>
                <Button type="button" variant="outline" onClick={handleCheckScenario}>
                  Check answer
                </Button>
              </div>
              {resultMessage && <div className="text-sm font-medium">{resultMessage}</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OBS knob</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                ref={knobRef}
                className="relative h-24 w-24 rounded-full border bg-slate-900 shadow-inner select-none"
                onPointerDown={handleKnobPointerDown}
                onPointerMove={handleKnobPointerMove}
                onPointerUp={handleKnobPointerUp}
                onPointerCancel={handleKnobPointerUp}
                onWheel={handleKnobWheel}
              >
                <div className="absolute inset-3 rounded-full border bg-slate-800" />
                <div
                  className="absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-full rounded-full bg-yellow-400"
                  style={knobPointerStyle}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Drag to rotate. Scroll to adjust by 1° (Shift = 5°).
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function StudentVorTrainer() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    trackEvent("student_page_view", { page: "vor_trainer" });
  }, []);

  const score = useMemo(
    () =>
      QUIZ.reduce(
        (acc, question) => {
          if (answers[question.id]) acc.total += 1;
          if (answers[question.id] === question.answer) acc.correct += 1;
          return acc;
        },
        { correct: 0, total: 0 }
      ),
    [answers]
  );

  return (
    <StudentLayout
      title="VOR Trainer"
      subtitle="Interactive OBS, CDI, and TO/FROM drills for real-world intercepts."
    >
      <Alert>
        <AlertTitle>Training aid only</AlertTitle>
        <AlertDescription>
          This trainer is for learning fundamentals. Always cross-check with your instructor,
          charts, and aircraft manuals.
        </AlertDescription>
      </Alert>

      <VORTrainerV1 />

      <Card>
        <CardHeader>
          <CardTitle>Quick VOR Quiz</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline">
              Score: {score.correct}/{score.total}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setAnswers({});
                setRevealed({});
              }}
            >
              Reset
            </Button>
          </div>

          {QUIZ.map((question) => {
            const selected = answers[question.id];
            const show = revealed[question.id];
            return (
              <div key={question.id} className="rounded-lg border p-4 space-y-3">
                <div className="font-semibold">{question.prompt}</div>
                <div className="flex flex-wrap gap-2">
                  {question.options.map((option) => {
                    const isSelected = selected === option;
                    const isCorrect = option === question.answer;
                    const showCorrect = show && isCorrect;
                    const showIncorrect = show && isSelected && !isCorrect;
                    return (
                      <Button
                        key={option}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        className={
                          showCorrect
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : showIncorrect
                              ? "border-destructive bg-destructive/10 text-destructive"
                              : undefined
                        }
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [question.id]: option }))
                        }
                      >
                        {option}
                      </Button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setRevealed((prev) => ({ ...prev, [question.id]: true }))
                    }
                    disabled={!selected}
                  >
                    Check answer
                  </Button>
                  {show && (
                    <span className="text-sm text-muted-foreground">
                      {question.explanation}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </StudentLayout>
  );
}
