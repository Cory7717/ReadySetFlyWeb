import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

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
];

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export default function RadioCommsTrainer() {
  const { user } = useAuth();
  const isPro = user?.logbookProStatus === "active";
  const [selectedScenarioId, setSelectedScenarioId] = useState(SCENARIOS[0].id);
  const [stepIndex, setStepIndex] = useState(0);
  const [input, setInput] = useState("");
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [showFeedback, setShowFeedback] = useState<string | null>(null);
  const [enableAudio, setEnableAudio] = useState(true);

  useEffect(() => {
    trackEvent("radio_comms_view", { pro: isPro });
  }, [isPro]);

  const scenario = useMemo(() => {
    const found = SCENARIOS.find((s) => s.id === selectedScenarioId) || SCENARIOS[0];
    if (isPro) return found;
    return { ...found, steps: found.steps.slice(0, 2) };
  }, [selectedScenarioId, isPro]);

  const currentStep = scenario.steps[stepIndex];

  const resetScenario = () => {
    setStepIndex(0);
    setInput("");
    setScore({ correct: 0, total: 0 });
    setShowFeedback(null);
  };

  const speakLine = (text: string) => {
    if (!enableAudio || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const evaluate = () => {
    if (!currentStep) return;
    const tokens = currentStep.expectedTokens.map((t) => normalize(t));
    const normalizedInput = normalize(input);
    const hit = tokens.every((token) => normalizedInput.includes(token));
    const nextScore = {
      correct: score.correct + (hit ? 1 : 0),
      total: score.total + 1,
    };
    setScore(nextScore);
    setShowFeedback(hit ? "Correct" : "Needs work");
    trackEvent("radio_comms_attempt", { scenario: scenario.id, hit });
    speakLine(currentStep.atcReply);
  };

  const nextStep = () => {
    if (stepIndex < scenario.steps.length - 1) {
      setStepIndex(stepIndex + 1);
      setInput("");
      setShowFeedback(null);
      return;
    }
    setShowFeedback("Scenario complete");
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
        {!isPro && <Badge variant="outline">Demo preview</Badge>}
      </div>

      {!isPro && (
        <Alert>
          <AlertDescription>
            Demo mode includes one scenario with limited steps. Upgrade to Logbook Pro for all scenarios, scoring, and full practice sessions.
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
              disabled={!isPro && item.id !== SCENARIOS[0].id}
            >
              {item.title}
            </Button>
          ))}
          {!isPro && (
            <Button asChild variant="outline">
              <Link href="/logbook/pro">Unlock full trainer</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{scenario.title}</CardTitle>
          <CardDescription>{scenario.summary}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Step {stepIndex + 1} of {scenario.steps.length}
            </div>
            <div className="text-sm text-muted-foreground">
              Score: {score.correct}/{score.total}
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-2">
            <div className="text-sm text-muted-foreground">Prompt</div>
            <div className="font-semibold">{currentStep?.prompt}</div>
            <div className="text-xs text-muted-foreground">{currentStep?.tips}</div>
          </div>

          <div className="space-y-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your radio call..."
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={evaluate} disabled={!input}>
                Check Call
              </Button>
              <Button variant="outline" onClick={nextStep}>
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
          </div>

          {showFeedback && (
            <div className="rounded-md border p-3 text-sm">
              {showFeedback === "Correct" && (
                <span className="text-green-600">Correct. ATC response: {currentStep.atcReply}</span>
              )}
              {showFeedback === "Needs work" && (
                <span className="text-red-600">
                  Needs work. Expected to include: {currentStep.expectedTokens.join(", ")}. ATC response: {currentStep.atcReply}
                </span>
              )}
              {showFeedback === "Scenario complete" && (
                <span className="text-primary">Scenario complete. Great work!</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sample radio calls</CardTitle>
          <CardDescription>
            Hear and read example calls. Available in full with Logbook Pro.
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
                Upgrade to Logbook Pro to unlock full scenario examples, scoring, and practice history.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Want more practice?</CardTitle>
          <CardDescription>
            Logbook Pro unlocks all scenarios, advanced scoring, and saved practice history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/logbook/pro">Upgrade to Logbook Pro</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
