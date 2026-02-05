import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

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

const DEFAULT_PANEL_URL =
  import.meta.env.VITE_SIX_PACK_PANEL_URL || "/assets/6pack-instrument-panel.png";

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
  const [progress, setProgress] = useState<SixPackProgress>(initialProgress);
  const [guidedStepIndex, setGuidedStepIndex] = useState(0);
  const [guidedHint, setGuidedHint] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(() => buildQuiz());
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizChecked, setQuizChecked] = useState(false);
  const [showGuestGate, setShowGuestGate] = useState(false);

  const activeInstrument = instrumentMap.get(activeInstrumentId || "ai") || INSTRUMENTS[0];
  const isGuest = !user;
  const guestLimit = 2;
  const guestLocked = isGuest && progress.guestClicks >= guestLimit;
  const guidedComplete = progress.guidedCompleted;

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
          {isGuest && (
            <Badge variant="outline">
              Guest clicks: {Math.max(guestLimit - progress.guestClicks, 0)} left
            </Badge>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-xl border bg-slate-900">
              <img
                src={DEFAULT_PANEL_URL}
                alt="RSF six-pack trainer panel"
                className="block h-auto w-full"
              />
              {HOTSPOTS.map((spot) => {
                const isSelected = spot.id === activeInstrumentId;
                const isHighlighted = highlightMode && highlightTargetId === spot.id;
                const isDimmed = highlightMode && highlightTargetId && !isHighlighted;
                const instrumentName = instrumentMap.get(spot.id)?.name || "Instrument";
                return (
                  <button
                    key={spot.id}
                    type="button"
                    aria-label={`Select ${instrumentName}`}
                    aria-pressed={isSelected}
                    className={cn(
                      "absolute rounded-full border-2 border-transparent transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected && "border-sky-400 bg-sky-400/20",
                      isHighlighted && "border-amber-400 bg-amber-400/10",
                      isDimmed && "bg-black/35"
                    )}
                    style={{
                      left: `${spot.xPct}%`,
                      top: `${spot.yPct}%`,
                      width: `${spot.wPct}%`,
                      height: `${spot.hPct}%`,
                    }}
                    disabled={guestLocked}
                    onClick={() => handleInstrumentClick(spot.id)}
                  />
                );
              })}
              {showGuestGate && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center text-white">
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
            <p className="text-sm text-muted-foreground">
              Tap the instruments to learn what they do. This is an instructional trainer, not an FAA briefing.
            </p>
          </div>

          <div className="space-y-4">
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
    </StudentLayout>
  );
}
