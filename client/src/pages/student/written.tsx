import { useEffect, useMemo, useState } from "react";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { NextStepCTA } from "@/components/student/NextStepCTA";
import { trackEvent } from "@/lib/analytics";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { faaAlignedCurriculum } from "@/data/studentCurriculum";
import { Button } from "@/components/ui/button";

const studyTopics = [
  "Aerodynamics",
  "Airspace",
  "Weather",
  "Navigation",
  "Regulations",
  "Performance",
  "Systems",
  "Human factors",
];

const miniModules = faaAlignedCurriculum;

export default function StudentWrittenTracker() {
  const { profile, saveProfile } = useStudentProfile();
  const [completed, setCompleted] = useState<Record<string, boolean>>(
    profile.progressJson?.writtenChecklist || {}
  );
  const [weakTopics, setWeakTopics] = useState<Record<string, boolean>>(
    profile.progressJson?.weakTopics || {}
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    trackEvent("student_page_view", { page: "written" });
  }, []);

  useEffect(() => {
    if (hydrated) return;
    if (profile.progressJson?.writtenChecklist) {
      setCompleted(profile.progressJson.writtenChecklist);
    }
    if (profile.progressJson?.weakTopics) {
      setWeakTopics(profile.progressJson.weakTopics);
    }
    setHydrated(true);
  }, [profile.progressJson, hydrated]);

  useEffect(() => {
    saveProfile({ progressJson: { ...profile.progressJson, writtenChecklist: completed, weakTopics } });
  }, [completed, weakTopics]);

  const focus = studyTopics.filter((topic) => weakTopics[topic]);
  const acsTags = useMemo(() => {
    const set = new Set<string>();
    faaAlignedCurriculum.forEach((module) => module.acsAreas.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, []);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const miniModules = useMemo(() => {
    if (selectedTags.length === 0) return faaAlignedCurriculum;
    return faaAlignedCurriculum.filter((module) =>
      selectedTags.every((tag) => module.acsAreas.includes(tag))
    );
  }, [selectedTags]);

  const [quizSelections, setQuizSelections] = useState<Record<string, string>>({});
  const [quizRevealed, setQuizRevealed] = useState<Record<string, boolean>>({});

  const todaySeed = useMemo(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  }, []);

  const rotateQuestions = (moduleId: string, questions: typeof faaAlignedCurriculum[number]["quiz"]) => {
    if (!questions.length) return questions;
    const seedValue = `${moduleId}-${todaySeed}`;
    let hash = 0;
    for (let i = 0; i < seedValue.length; i += 1) {
      hash = (hash * 31 + seedValue.charCodeAt(i)) % 9973;
    }
    const offset = hash % questions.length;
    return [...questions.slice(offset), ...questions.slice(0, offset)];
  };

  const selectQuizAnswer = (moduleId: string, question: string, option: string) => {
    const key = `${moduleId}::${question}`;
    setQuizSelections((prev) => ({ ...prev, [key]: option }));
  };

  const revealModuleQuiz = (moduleId: string, questions: typeof faaAlignedCurriculum[number]["quiz"]) => {
    const keys = questions.map((q) => `${moduleId}::${q.question}`);
    const allAnswered = keys.every((key) => Boolean(quizSelections[key]));
    if (allAnswered) {
      setQuizRevealed((prev) => ({ ...prev, [moduleId]: true }));
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const downloadStudyPlan = () => {
    const lines: string[] = [];
    lines.push("Ready Set Fly - FAA-aligned Study Plan");
    lines.push("");
    lines.push(`Study focus: ${focus.length ? focus.join(", ") : "Balanced across topics"}`);
    lines.push("");
    miniModules.forEach((module) => {
      lines.push(`## ${module.title}`);
      lines.push(module.summary);
      lines.push(`ACS areas: ${module.acsAreas.join(", ")}`);
      lines.push("");
      lines.push("Objectives:");
      module.objectives.forEach((obj) => lines.push(`- ${obj}`));
      lines.push("Key points:");
      module.keyPoints.forEach((point) => lines.push(`- ${point}`));
      lines.push("Common pitfalls:");
      module.pitfalls.forEach((point) => lines.push(`- ${point}`));
      lines.push(`Practice: ${module.practice}`);
      lines.push("References:");
      module.references.forEach((ref) => lines.push(`- ${ref}`));
      lines.push("");
    });

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "readysetfly-study-plan.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <StudentLayout
      title="Written Test Prep Tracker"
      subtitle="Stay organized and focus on weak topics."
    >
      <Alert>
        <AlertTitle>FAA-aligned study guidance</AlertTitle>
        <AlertDescription>
          These mini-modules are based on FAA knowledge standards and training best practices.
          Always verify details against the FAA Airman Knowledge Test Guide, ACS, and your instructor.
        </AlertDescription>
      </Alert>

      <Card className="p-4 space-y-3">
        <div className="text-sm text-muted-foreground">Study plan</div>
        {studyTopics.map((topic) => (
          <div key={topic} className="flex items-center gap-3">
            <Checkbox
              checked={completed[topic]}
              onCheckedChange={(value) => setCompleted((prev) => ({ ...prev, [topic]: Boolean(value) }))}
            />
            <span className="text-sm">{topic}</span>
            <Checkbox
              checked={weakTopics[topic]}
              onCheckedChange={(value) => setWeakTopics((prev) => ({ ...prev, [topic]: Boolean(value) }))}
            />
            <span className="text-xs text-muted-foreground">Needs focus</span>
          </div>
        ))}
      </Card>

      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Study focus</div>
        <div className="font-semibold">{focus.length ? focus.join(", ") : "You are balanced across topics."}</div>
      </Card>

      <Card className="p-4">
        <div className="text-sm text-muted-foreground mb-2">RSF mini-modules</div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs text-muted-foreground">Filter by ACS:</span>
          {acsTags.map((tag) => (
            <Button
              key={tag}
              size="sm"
              variant={selectedTags.includes(tag) ? "default" : "outline"}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </Button>
          ))}
          {selectedTags.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setSelectedTags([])}>
              Clear filters
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={downloadStudyPlan}>
            Download study plan
          </Button>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {miniModules.map((module) => {
            const rotatedQuiz = rotateQuestions(module.id, module.quiz);
            const answeredCount = rotatedQuiz.filter((q) => quizSelections[`${module.id}::${q.question}`]).length;
            const canReveal = answeredCount === rotatedQuiz.length && rotatedQuiz.length > 0;
            const revealed = quizRevealed[module.id];
            return (
            <AccordionItem key={module.id} value={module.id}>
              <AccordionTrigger>{module.title}</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">{module.summary}</p>
                  <div>
                    <div className="font-semibold">ACS mapping</div>
                    <div className="text-muted-foreground">{module.acsAreas.join(", ")}</div>
                  </div>
                  <div>
                    <div className="font-semibold">Key points</div>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {module.keyPoints.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold">Common pitfalls</div>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {module.pitfalls.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold">Practice prompt</div>
                    <div className="text-muted-foreground">{module.practice}</div>
                  </div>
                  <div>
                    <div className="font-semibold">FAA references</div>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {module.references.map((ref) => (
                        <li key={ref}>{ref}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold">Quick quiz</div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {rotatedQuiz.length ? `${answeredCount}/${rotatedQuiz.length} answered` : "No quiz available"}
                    </div>
                    <div className="space-y-2 text-muted-foreground">
                      {rotatedQuiz.map((quiz) => {
                        const key = `${module.id}::${quiz.question}`;
                        const selected = quizSelections[key];
                        return (
                          <div key={quiz.question} className="rounded-md border p-3">
                            <div className="font-medium text-foreground">{quiz.question}</div>
                            <div className="mt-2 grid gap-2">
                              {quiz.options.map((option) => {
                                const isSelected = selected === option;
                                const isCorrect = option === quiz.answer;
                                const showResult = revealed && isSelected;
                                const resultIcon = showResult ? (isCorrect ? "✅" : "❌") : "";
                                return (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() => selectQuizAnswer(module.id, quiz.question, option)}
                                    className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                                      isSelected ? "border-primary bg-primary/10" : "border-muted"
                                    }`}
                                  >
                                    <span className="mr-2">{resultIcon}</span>
                                    {option}
                                  </button>
                                );
                              })}
                            </div>
                            {revealed && (
                              <div className="text-xs text-muted-foreground mt-2">
                                Answer: {quiz.answer}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canReveal}
                        onClick={() => revealModuleQuiz(module.id, rotatedQuiz)}
                      >
                        Reveal answers
                      </Button>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
          })}
        </Accordion>
      </Card>

      <NextStepCTA label="Schedule an instructor session" type="cfi" />
    </StudentLayout>
  );
}
