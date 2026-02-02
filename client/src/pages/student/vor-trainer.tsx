import { useMemo, useState } from "react";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { trackEvent } from "@/lib/analytics";

type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
};

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
    explanation:
      "Radials are always the magnetic bearing FROM the station.",
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
    explanation:
      "With TO flag, the OBS course is the inbound course TO the station.",
  },
  {
    id: "reciprocal-course",
    prompt: "If you want to fly OUTBOUND on the 180 radial, what OBS course should you set?",
    options: ["180", "360", "090"],
    answer: "180",
    explanation:
      "Outbound on the 180 radial uses OBS 180 with FROM flag.",
  },
];

function normalizeCourse(value: number) {
  if (!Number.isFinite(value)) return null;
  let normalized = Math.round(value);
  while (normalized <= 0) normalized += 360;
  while (normalized > 360) normalized -= 360;
  return normalized;
}

export default function StudentVorTrainer() {
  const [obsCourse, setObsCourse] = useState("090");
  const [flag, setFlag] = useState<"to" | "from">("to");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  useMemo(() => {
    trackEvent("student_page_view", { page: "vor_trainer" });
    return null;
  }, []);

  const courseValue = normalizeCourse(Number(obsCourse));
  const radialFrom =
    courseValue === null
      ? null
      : flag === "from"
        ? courseValue
        : normalizeCourse(courseValue + 180);
  const inboundCourse =
    courseValue === null
      ? null
      : flag === "to"
        ? courseValue
        : normalizeCourse(courseValue + 180);

  const score = QUIZ.reduce(
    (acc, question) => {
      if (answers[question.id]) acc.total += 1;
      if (answers[question.id] === question.answer) acc.correct += 1;
      return acc;
    },
    { correct: 0, total: 0 }
  );

  return (
    <StudentLayout
      title="VOR Trainer"
      subtitle="Quick drills for radials, OBS, flags, and intercept basics."
    >
      <Alert>
        <AlertTitle>Training aid only</AlertTitle>
        <AlertDescription>
          This trainer is for learning fundamentals. Always cross-check with your instructor,
          charts, and aircraft manuals.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>OBS to Radial Converter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[220px_1fr] items-end">
            <div className="space-y-2">
              <Label htmlFor="obs-course">OBS course</Label>
              <Input
                id="obs-course"
                inputMode="numeric"
                value={obsCourse}
                onChange={(e) => setObsCourse(e.target.value)}
                placeholder="090"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={flag === "to" ? "default" : "outline"}
                onClick={() => setFlag("to")}
              >
                TO Flag
              </Button>
              <Button
                type="button"
                variant={flag === "from" ? "default" : "outline"}
                onClick={() => setFlag("from")}
              >
                FROM Flag
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            {courseValue === null ? (
              <div className="text-sm text-muted-foreground">
                Enter an OBS course between 1 and 360.
              </div>
            ) : (
              <>
                <div className="text-sm text-muted-foreground">
                  OBS course: <span className="font-semibold text-foreground">{courseValue}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Radial (FROM station):{" "}
                  <span className="font-semibold text-foreground">{radialFrom}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Inbound course (TO station):{" "}
                  <span className="font-semibold text-foreground">{inboundCourse}</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle>Quick Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>Radials are always labeled FROM the station.</div>
          <div>TO flag means you are flying toward the station on the OBS course.</div>
          <div>FROM flag means you are flying away from the station on the OBS course.</div>
          <Separator />
          <div>Common intercept angles: 20-45 degrees for light winds.</div>
        </CardContent>
      </Card>
    </StudentLayout>
  );
}
