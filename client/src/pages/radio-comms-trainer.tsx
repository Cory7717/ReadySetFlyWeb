import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trackEvent } from "@/lib/analytics";
import { getCurrentReturnTo, withReturnTo } from "@/lib/returnTo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

type RadioCommsSession = {
  id: string;
  scenarioId: string;
  scoreCorrect?: number | null;
  scoreTotal?: number | null;
  durationSec?: number | null;
  createdAt?: string | null;
};

type ScenarioAttempt = {
  stepId: string;
  input: string;
  expectedTokens: string[];
  hit: boolean;
  atcReply: string;
  tokenResults: Array<{ token: string; hit: boolean }>;
};

type ScenarioStep = {
  id: string;
  role: "pilot" | "atc";
  prompt: string;
  expectedTokens: string[];
  atcReply: string;
  tips: string;
};

type Scenario = {
  id: string;
  title: string;
  summary: string;
  steps: ScenarioStep[];
  examples: { pilot: string; atc: string }[];
};

type FeedbackState = {
  type: "correct" | "needs_work" | "complete";
  tokenResults?: Array<{ token: string; hit: boolean }>;
} | null;

const SCENARIOS: Scenario[] = [
  {
    id: "towered-pattern",
    title: "Towered Pattern (VFR)",
    summary: "Practice pattern entries, downwind, base, and final calls.",
    steps: [
      {
        id: "entry-call",
        role: "pilot",
        prompt: "Make your initial call 10 miles out.",
        expectedTokens: ["tower", "request", "full stop"],
        atcReply: "Cessna 123AB, enter left downwind runway 27, report midfield.",
        tips: "Include who you are calling, who you are, position, and request.",
      },
      {
        id: "midfield",
        role: "pilot",
        prompt: "Report midfield downwind.",
        expectedTokens: ["midfield", "downwind", "runway"],
        atcReply: "Cessna 123AB, number two, follow Cherokee on base.",
        tips: "State position, runway, and your call sign.",
      },
      {
        id: "final",
        role: "pilot",
        prompt: "Call final for landing.",
        expectedTokens: ["final", "runway"],
        atcReply: "Cessna 123AB, cleared to land runway 27.",
        tips: "Keep it short and confirm runway.",
      },
      {
        id: "clear",
        role: "pilot",
        prompt: "Call clear of the runway.",
        expectedTokens: ["clear", "runway"],
        atcReply: "Cessna 123AB, taxi to parking via Alpha.",
        tips: "Advise when you are clear and ready to taxi.",
      },
    ],
    examples: [
      {
        pilot: "Van Nuys Tower, Cessna 123AB, ten miles east, inbound full stop with Information Alpha.",
        atc: "Cessna 123AB, Van Nuys Tower, enter left downwind runway 16R, report midfield.",
      },
      {
        pilot: "Van Nuys Tower, Cessna 123AB, midfield left downwind runway 16R.",
        atc: "Cessna 123AB, number two, follow Cherokee on base.",
      },
    ],
  },
  {
    id: "ground-departure",
    title: "Ground + Tower Departure",
    summary: "Taxi request, run-up, and takeoff clearance sequence.",
    steps: [
      {
        id: "taxi-request",
        role: "pilot",
        prompt: "Request taxi for departure.",
        expectedTokens: ["ground", "taxi", "departure"],
        atcReply: "Cessna 123AB, taxi to runway 18 via Bravo.",
        tips: "Include ATIS code and your requested runway if known.",
      },
      {
        id: "ready",
        role: "pilot",
        prompt: "Advise tower you are ready for departure.",
        expectedTokens: ["ready", "runway"],
        atcReply: "Cessna 123AB, cleared for takeoff runway 18.",
        tips: "State holding short and ready for departure.",
      },
      {
        id: "departure",
        role: "pilot",
        prompt: "Report leaving the pattern.",
        expectedTokens: ["departure", "leaving", "pattern"],
        atcReply: "Cessna 123AB, contact departure on 124.7.",
        tips: "Share your direction of departure and altitude.",
      },
    ],
    examples: [
      {
        pilot: "Austin Ground, Cessna 123AB at Signature, ready to taxi with Information Bravo, VFR to the south.",
        atc: "Cessna 123AB, Austin Ground, taxi to runway 18L via Bravo and Delta.",
      },
      {
        pilot: "Austin Tower, Cessna 123AB holding short runway 18L, ready for departure.",
        atc: "Cessna 123AB, Austin Tower, cleared for takeoff runway 18L.",
      },
    ],
  },
  {
    id: "class-d-arrival",
    title: "Class D Arrival",
    summary: "Inbound call, pattern entry, and landing clearance.",
    steps: [
      {
        id: "inbound",
        role: "pilot",
        prompt: "Call inbound to Class D.",
        expectedTokens: ["inbound", "request", "full stop"],
        atcReply: "Cessna 123AB, enter right downwind runway 22, report base.",
        tips: "Include your distance and direction from the field.",
      },
      {
        id: "base",
        role: "pilot",
        prompt: "Report base leg.",
        expectedTokens: ["base", "runway"],
        atcReply: "Cessna 123AB, cleared to land runway 22.",
        tips: "Keep the call short and precise.",
      },
      {
        id: "clear",
        role: "pilot",
        prompt: "Call clear of the runway.",
        expectedTokens: ["clear", "runway"],
        atcReply: "Cessna 123AB, taxi to parking via Alpha.",
        tips: "Advise when you are clear and ready to taxi.",
      },
    ],
    examples: [
      {
        pilot: "McKinney Tower, Cessna 123AB, fifteen miles northeast, inbound full stop with Information Echo.",
        atc: "Cessna 123AB, McKinney Tower, enter right downwind runway 17, report base.",
      },
      {
        pilot: "McKinney Tower, Cessna 123AB, right base runway 17.",
        atc: "Cessna 123AB, cleared to land runway 17.",
      },
    ],
  },
  {
    id: "ctaf-uncontrolled",
    title: "CTAF (Uncontrolled)",
    summary: "Self-announce position calls at a non-towered airport.",
    steps: [
      {
        id: "ctaf-10-out",
        role: "pilot",
        prompt: "Announce 10 miles out inbound.",
        expectedTokens: ["traffic", "inbound", "10"],
        atcReply: "(No ATC — listen for traffic calls.)",
        tips: "Use airport name + 'traffic' twice. Include altitude and intentions.",
      },
      {
        id: "ctaf-downwind",
        role: "pilot",
        prompt: "Self-announce entering the 45 for downwind.",
        expectedTokens: ["traffic", "downwind", "runway"],
        atcReply: "(No ATC — listen for traffic calls.)",
        tips: "State airport, position, runway, and tail number.",
      },
      {
        id: "ctaf-final",
        role: "pilot",
        prompt: "Self-announce on final.",
        expectedTokens: ["traffic", "final", "runway"],
        atcReply: "(No ATC — listen for traffic calls.)",
        tips: "Keep it brief. Airport name + traffic + final + runway.",
      },
      {
        id: "ctaf-clear",
        role: "pilot",
        prompt: "Self-announce clear of the runway.",
        expectedTokens: ["traffic", "clear", "runway"],
        atcReply: "(No ATC — listen for traffic calls.)",
        tips: "Announce when clear so others in the pattern know.",
      },
    ],
    examples: [
      {
        pilot: "Smithville traffic, Cessna 123AB, ten miles south, inbound full stop runway 18, Smithville traffic.",
        atc: "(No ATC — other aircraft in pattern self-announce.)",
      },
      {
        pilot: "Smithville traffic, Cessna 123AB, left downwind runway 18, full stop, Smithville.",
        atc: "(No ATC — continue self-announcing each leg.)",
      },
    ],
  },
  {
    id: "emergency-mayday",
    title: "Emergency (Mayday)",
    summary: "Practice the Mayday distress call and ATC coordination.",
    steps: [
      {
        id: "mayday-call",
        role: "pilot",
        prompt: "Declare a Mayday for engine failure.",
        expectedTokens: ["mayday", "engine", "altitude"],
        atcReply: "Cessna 123AB, roger Mayday, say souls on board and fuel remaining.",
        tips: "Mayday x3, who you're calling, call sign, nature of emergency, position, altitude, intentions.",
      },
      {
        id: "souls-fuel",
        role: "pilot",
        prompt: "Report souls on board and fuel remaining.",
        expectedTokens: ["souls", "fuel"],
        atcReply: "Cessna 123AB, squawk 7700, nearest airport is 8 miles southwest, runway 36.",
        tips: "Give the number of people on board and fuel in hours and minutes.",
      },
      {
        id: "squawk-7700",
        role: "pilot",
        prompt: "Confirm squawking 7700 and state intentions.",
        expectedTokens: ["7700", "airport"],
        atcReply: "Cessna 123AB, radar contact, 7 miles from runway 36. Winds 350 at 10.",
        tips: "Confirm the squawk code and declare your intended landing site.",
      },
      {
        id: "final-emergency",
        role: "pilot",
        prompt: "Call final for emergency landing.",
        expectedTokens: ["final", "emergency"],
        atcReply: "Cessna 123AB, emergency equipment is standing by. Cleared to land runway 36.",
        tips: "Short and clear. Runway + final + emergency equipment acknowledged.",
      },
    ],
    examples: [
      {
        pilot: "Mayday, Mayday, Mayday. Denver Approach, Cessna 123AB, engine failure, 8,500 feet, 15 miles east, request immediate assistance.",
        atc: "Cessna 123AB, roger Mayday. Say souls on board and fuel remaining.",
      },
      {
        pilot: "Two souls on board, fuel two hours remaining, squawking 7700, requesting vectors to nearest airport.",
        atc: "Cessna 123AB, squawk 7700 confirmed. Turn left heading 270, runway 36 in 8 miles.",
      },
    ],
  },
];

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export default function RadioCommsTrainer() {
  const { user, isAuthenticated } = useAuth();
  const entitlements = (user as { entitlements?: { canUseScenarioScoring?: boolean } } | undefined)
    ?.entitlements;
  const isPro = entitlements?.canUseScenarioScoring ?? (user?.logbookProStatus === "active");
  const isGuest = !isAuthenticated;
  const isFree = isAuthenticated && !isPro;
  const queryClient = useQueryClient();
  const [selectedScenarioId, setSelectedScenarioId] = useState(SCENARIOS[0].id);
  const [stepIndex, setStepIndex] = useState(0);
  const [input, setInput] = useState("");
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [showFeedback, setShowFeedback] = useState<FeedbackState>(null);
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [enableAudio, setEnableAudio] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>("");
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");
  const [attempts, setAttempts] = useState<ScenarioAttempt[]>([]);
  const [sessionSaved, setSessionSaved] = useState(false);
  const sessionStartRef = useRef<number | null>(null);
  const [freeUsageCount, setFreeUsageCount] = useState(0);
  const [freeUsageDate, setFreeUsageDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [guestUsed, setGuestUsed] = useState(false);
  const [conversationLog, setConversationLog] = useState<Array<{ role: "atc" | "pilot"; text: string; hit?: boolean }>>([]);
  const [showAnswerVisible, setShowAnswerVisible] = useState(false);
  const todayKey = new Date().toISOString().slice(0, 10);
  const freeUsageKey = "rsf-radio-free-usage";
  const guestUsageKey = "rsf-radio-guest-usage";

  const { data: sessions = [] } = useQuery<RadioCommsSession[]>({
    queryKey: ["/api/radio-comms/sessions"],
    enabled: isPro,
  });

  const saveSessionMutation = useMutation({
    mutationFn: async (payload: {
      scenarioId: string;
      scoreCorrect: number;
      scoreTotal: number;
      durationSec: number | null;
      attempts: ScenarioAttempt[];
    }) => {
      const res = await apiRequest("POST", "/api/radio-comms/sessions", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/radio-comms/sessions"] });
    },
  });

  useEffect(() => {
    trackEvent("radio_comms_view", { pro: isPro });
  }, [isPro]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isFree) {
      try {
        const raw = window.localStorage.getItem(freeUsageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as { date?: string; count?: number };
          if (parsed?.date === todayKey) {
            setFreeUsageDate(parsed.date);
            setFreeUsageCount(parsed.count ?? 0);
          } else {
            setFreeUsageDate(todayKey);
            setFreeUsageCount(0);
          }
        } else {
          setFreeUsageDate(todayKey);
          setFreeUsageCount(0);
        }
      } catch {
        setFreeUsageDate(todayKey);
        setFreeUsageCount(0);
      }
    }
    if (isGuest) {
      try {
        const raw = window.sessionStorage.getItem(guestUsageKey);
        setGuestUsed(raw === "1");
      } catch {
        setGuestUsed(false);
      }
    }
  }, [isFree, isGuest, todayKey]);

  const freeLimitReached = isFree && freeUsageDate === todayKey && freeUsageCount >= 1;
  const guestLimitReached = isGuest && guestUsed;
  const limitReached = freeLimitReached || guestLimitReached;

  const recordScenarioUsage = () => {
    if (typeof window === "undefined") return;
    if (isFree) {
      const nextCount = freeUsageDate === todayKey ? freeUsageCount + 1 : 1;
      const payload = { date: todayKey, count: nextCount };
      window.localStorage.setItem(freeUsageKey, JSON.stringify(payload));
      setFreeUsageDate(todayKey);
      setFreeUsageCount(nextCount);
    }
    if (isGuest) {
      window.sessionStorage.setItem(guestUsageKey, "1");
      setGuestUsed(true);
    }
  };

  const gateText = isGuest
    ? "Create a free RSF account to keep practicing full scenarios."
    : "Upgrade to RSF Premium for unlimited scenarios and scoring history.";

  useEffect(() => {
    if (!sessionStartRef.current) {
      sessionStartRef.current = Date.now();
    }
  }, []);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const loadVoices = () => {
      const nextVoices = window.speechSynthesis
        .getVoices()
        .filter((voice) => voice.lang?.toLowerCase().startsWith("en"));
      if (nextVoices.length) {
        setVoices(nextVoices);
        if (!selectedVoiceUri && !selectedVoiceName) {
          const preferred = nextVoices.find((voice) =>
            /Google|Samantha|Aria|Jenny|Natural|Neural/i.test(voice.name)
          );
          if (preferred) {
            setSelectedVoiceUri(preferred.voiceURI);
            setSelectedVoiceName(preferred.name);
          }
        }
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoiceUri, selectedVoiceName]);

  const scenario = useMemo(() => {
    const found = SCENARIOS.find((s) => s.id === selectedScenarioId) || SCENARIOS[0];
    if (isGuest) return { ...found, steps: found.steps.slice(0, 2) };
    return found;
  }, [selectedScenarioId, isGuest]);

  const currentStep = scenario.steps[stepIndex];

  const resetScenario = () => {
    setStepIndex(0);
    setInput("");
    setScore({ correct: 0, total: 0 });
    setShowFeedback(null);
    setGateMessage(null);
    setAttempts([]);
    setSessionSaved(false);
    setConversationLog([]);
    setShowAnswerVisible(false);
    sessionStartRef.current = Date.now();
  };

  const getExampleForStep = (stepId: string | undefined): string => {
    if (!stepId) return "";
    const step = scenario.steps.find((item) => item.id === stepId);
    const token = step?.expectedTokens[0]?.toLowerCase() ?? "";
    const example = scenario.examples.find((ex) => ex.pilot.toLowerCase().includes(token));
    return example?.pilot ?? "See scenario examples below for reference.";
  };

  const resolveVoice = (availableVoices: SpeechSynthesisVoice[]) => {
    if (!availableVoices.length) return null;
    const byUri = selectedVoiceUri
      ? availableVoices.find((voice) => voice.voiceURI === selectedVoiceUri)
      : null;
    if (byUri) return byUri;
    const byName = selectedVoiceName
      ? availableVoices.find(
          (voice) => voice.name.toLowerCase() === selectedVoiceName.toLowerCase()
        )
      : null;
    if (byName) return byName;
    const preferred = availableVoices.find((voice) =>
      /Google|Samantha|Aria|Jenny|Natural|Neural|David|Zira/i.test(voice.name)
    );
    return preferred || availableVoices[0];
  };

  const speakLine = (text: string) => {
    if (!enableAudio || !("speechSynthesis" in window)) return;
    const availableVoices = voices.length ? voices : window.speechSynthesis.getVoices();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    const selected = resolveVoice(availableVoices);
    if (selected) {
      utterance.voice = selected;
      utterance.lang = selected.lang || "en-US";
    }
    window.speechSynthesis.speak(utterance);
  };

  const evaluate = () => {
    if (limitReached) {
      setGateMessage(gateText);
      return;
    }
    if (!currentStep) return;
    const tokens = currentStep.expectedTokens.map((t) => normalize(t));
    const normalizedInput = normalize(input);
    const tokenResults = tokens.map((token) => ({
      token,
      hit: normalizedInput.includes(token),
    }));
    const hit = tokenResults.every((result) => result.hit);
    const nextScore = {
      correct: score.correct + (hit ? 1 : 0),
      total: score.total + 1,
    };
    setScore(nextScore);
    setShowFeedback({
      type: hit ? "correct" : "needs_work",
      tokenResults,
    });
    setAttempts((prev) => [
      ...prev,
      {
        stepId: currentStep.id,
        input,
        expectedTokens: currentStep.expectedTokens,
        hit,
        atcReply: currentStep.atcReply,
        tokenResults,
      },
    ]);
    setConversationLog((prev) => [
      ...prev,
      {
        role: "pilot",
        text: input,
        hit,
      },
      {
        role: "atc",
        text: currentStep.atcReply,
      },
    ]);
    trackEvent("radio_comms_attempt", { scenario: scenario.id, hit });
    speakLine(currentStep.atcReply);
  };

  const nextStep = () => {
    if (limitReached) {
      setGateMessage(gateText);
      return;
    }
    if (stepIndex < scenario.steps.length - 1) {
      setStepIndex(stepIndex + 1);
      setInput("");
      setShowFeedback(null);
      setShowAnswerVisible(false);
      return;
    }
    setShowFeedback({ type: "complete" });
    if (!isPro) {
      recordScenarioUsage();
      setGateMessage(gateText);
    }
    if (isPro && !sessionSaved) {
      setSessionSaved(true);
      const durationSec = sessionStartRef.current
        ? Math.round((Date.now() - sessionStartRef.current) / 1000)
        : null;
      saveSessionMutation.mutate({
        scenarioId: scenario.id,
        scoreCorrect: score.correct,
        scoreTotal: score.total || scenario.steps.length,
        durationSec,
        attempts,
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Radio Comms Trainer</h1>
          <p className="text-muted-foreground">
            Practice real-world ATC phraseology with guided scenarios.
          </p>
        </div>
        {isGuest && <Badge variant="outline">Guest preview</Badge>}
        {isFree && <Badge variant="outline">Free access</Badge>}
      </div>

      {isGuest && (
        <Alert>
          <AlertDescription>
            Guest preview includes one scenario with limited steps. Create a free account to keep practicing without losing momentum.
          </AlertDescription>
        </Alert>
      )}
      {isFree && (
        <Alert>
          <AlertDescription>
            Free accounts get one full scenario per day. Upgrade when daily repetition, saved scoring, and history become worth paying for.
          </AlertDescription>
        </Alert>
      )}
      {gateMessage && (
        <Alert>
          <AlertDescription>{gateMessage}</AlertDescription>
        </Alert>
      )}
      {!("speechSynthesis" in window) && (
        <Alert>
          <AlertDescription>
            Audio playback is not supported in this browser. You can still use the trainer with text prompts.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Select a scenario</CardTitle>
          <CardDescription>
            Choose a training flow based on your current learning goals.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {SCENARIOS.map((item) => (
            <Button
              key={item.id}
              variant={selectedScenarioId === item.id ? "default" : "outline"}
              onClick={() => {
                setSelectedScenarioId(item.id);
                resetScenario();
              }}
              disabled={isGuest && item.id !== SCENARIOS[0].id}
            >
              {item.title}
            </Button>
          ))}
          {!isPro && (
            <Button asChild variant="outline">
              <Link href={isAuthenticated ? "/logbook/pro" : withReturnTo("/register", getCurrentReturnTo())}>
                {isAuthenticated ? "Unlock full trainer" : "Create free account"}
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{scenario.title}</CardTitle>
          <CardDescription>{scenario.summary}</CardDescription>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs text-muted-foreground">Voice</div>
            <label htmlFor="voice-select" className="sr-only">
              Voice selection
            </label>
            <select
              id="voice-select"
              className="rounded-md border bg-background px-2 py-1 text-sm"
              value={selectedVoiceUri}
              onChange={(e) => {
                const uri = e.target.value;
                setSelectedVoiceUri(uri);
                const match = voices.find((voice) => voice.voiceURI === uri);
                setSelectedVoiceName(match?.name || "");
              }}
            >
              <option value="">Best available</option>
              {voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
            {selectedVoiceName && (
              <span className="text-xs text-muted-foreground">
                Using: {selectedVoiceName}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Step {stepIndex + 1} of {scenario.steps.length}</span>
              <span>Score {score.correct}/{score.total}</span>
            </div>
            <div className="flex gap-1">
              {scenario.steps.map((step, idx) => {
                const attempt = attempts.find((a) => a.stepId === step.id);
                return (
                  <div
                    key={step.id}
                    className={cn(
                      "h-2 flex-1 rounded-full transition-colors",
                      idx < stepIndex && attempt?.hit
                        ? "bg-green-400"
                        : idx < stepIndex && !attempt?.hit
                          ? "bg-red-400"
                          : idx === stepIndex
                            ? "bg-sky-400"
                            : "bg-muted"
                    )}
                  />
                );
              })}
            </div>
          </div>

          {conversationLog.length > 0 && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3 max-h-64 overflow-y-auto">
              {conversationLog.map((entry, idx) => (
                <div
                  key={`${entry.role}-${idx}`}
                  className={cn(
                    "flex flex-col max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    entry.role === "pilot"
                      ? "ml-auto bg-sky-100 text-sky-900 items-end"
                      : "mr-auto bg-slate-100 text-slate-800 items-start"
                  )}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                    {entry.role === "pilot" ? "You (Pilot)" : "ATC"}
                  </div>
                  <div
                    className={cn(
                      entry.role === "pilot" && entry.hit === false
                        ? "text-red-700"
                        : entry.role === "pilot" && entry.hit === true
                          ? "text-green-700"
                          : ""
                    )}
                  >
                    {entry.text}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border-l-4 border-sky-400 bg-sky-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-600 mb-1">
              Your turn
            </div>
            <div className="font-semibold text-sm">{currentStep?.prompt}</div>
            <div className="text-xs text-muted-foreground mt-1">{currentStep?.tips}</div>
          </div>

          <div className="space-y-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your radio call..."
              disabled={limitReached}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (showFeedback) {
                    nextStep();
                  } else if (input) {
                    evaluate();
                  }
                }
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={evaluate} disabled={!input || limitReached}>
                Check Call
              </Button>
              <Button variant="outline" onClick={nextStep} disabled={limitReached}>
                Next Step
              </Button>
              <Button variant="ghost" onClick={resetScenario}>
                Reset
              </Button>
              <Button
                variant={enableAudio ? "default" : "outline"}
                onClick={() => setEnableAudio(!enableAudio)}
              >
                {enableAudio ? "Audio on" : "Audio off"}
              </Button>
            </div>
            {!limitReached && (
              <div className="text-xs text-muted-foreground">
                Press Enter to check · Enter again to advance
              </div>
            )}
          </div>

          {showFeedback?.type === "correct" && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                <span>✓ Correct</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {showFeedback.tokenResults?.map(({ token, hit }) => (
                  <span
                    key={token}
                    className={cn(
                      "rounded px-2 py-0.5 text-xs font-medium border",
                      hit
                        ? "bg-green-100 text-green-800 border-green-300"
                        : "bg-red-100 text-red-800 border-red-300"
                    )}
                  >
                    {token}
                  </span>
                ))}
              </div>
            </div>
          )}

          {showFeedback?.type === "needs_work" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
              <div className="text-sm font-semibold text-red-700">Needs work</div>
              <div className="flex flex-wrap gap-1">
                {showFeedback.tokenResults?.map(({ token, hit }) => (
                  <span
                    key={token}
                    className={cn(
                      "rounded px-2 py-0.5 text-xs font-medium border",
                      hit
                        ? "bg-green-100 text-green-800 border-green-300"
                        : "bg-red-100 text-red-800 border-red-300"
                    )}
                  >
                    {hit ? `✓ ${token}` : `✗ ${token}`}
                  </span>
                ))}
              </div>
              {showAnswerVisible && (
                <div className="rounded border bg-white px-3 py-2 text-xs text-slate-700">
                  <div className="font-semibold mb-1">Example correct call:</div>
                  <div className="italic">{getExampleForStep(currentStep?.id)}</div>
                </div>
              )}
              <button
                type="button"
                className="text-xs text-muted-foreground underline"
                onClick={() => setShowAnswerVisible(true)}
              >
                Show example answer
              </button>
            </div>
          )}

          {showFeedback?.type === "complete" && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm font-semibold text-primary">
              Scenario complete — {score.correct}/{score.total} calls correct.
              {saveSessionMutation.isPending && isPro ? " Saving..." : ""}
            </div>
          )}
        </CardContent>
      </Card>

      {isPro && (
        <Card>
          <CardHeader>
            <CardTitle>Practice history</CardTitle>
            <CardDescription>Saved RSF Premium sessions and scores.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Complete a scenario to save your first session.
              </div>
            ) : (
              sessions.map((session) => {
                const scenarioTitle = SCENARIOS.find((s) => s.id === session.scenarioId)?.title || session.scenarioId;
                const scoreLine = session.scoreTotal
                  ? `${session.scoreCorrect ?? 0}/${session.scoreTotal}`
                  : session.scoreCorrect?.toString() ?? "—";
                return (
                  <div key={session.id} className="rounded-lg border p-3 text-sm space-y-1">
                    <div className="font-semibold">{scenarioTitle}</div>
                    <div className="text-xs text-muted-foreground">
                      {session.createdAt ? new Date(session.createdAt).toLocaleDateString() : "—"} · Score {scoreLine}
                      {session.durationSec ? ` · ${Math.round(session.durationSec / 60)}m` : ""}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sample radio calls</CardTitle>
          <CardDescription>
            Hear and read example calls. Available in full with RSF Premium.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scenario.examples.map((example, idx) => (
            <div key={`${scenario.id}-example-${idx}`} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Example {idx + 1}</div>
                <Button size="sm" variant="outline" onClick={() => speakLine(example.pilot)}>
                  Play Pilot
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                <div className="font-medium text-foreground">Pilot</div>
                <div>{example.pilot}</div>
              </div>
              <div className="text-sm text-muted-foreground">
                <div className="font-medium text-foreground">ATC</div>
                <div>{example.atc}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => speakLine(example.atc)}>
                Play ATC
              </Button>
            </div>
          ))}
          {!isPro && (
            <Alert>
              <AlertDescription>
                Upgrade to RSF Premium once you want full scenario examples, saved scoring, and a repeatable training record instead of one-off practice.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
