import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { trackEvent } from "@/lib/analytics";
import { gpsTrainerDisclaimer, gpsTrainerUnits, type GpsTrainerTask } from "@shared/gps-sims";
import { useAuth } from "@/hooks/useAuth";
import { useStudentProfile } from "@/hooks/useStudentProfile";

function createStepState(task: GpsTrainerTask) {
  return new Array(task.steps.length).fill(false);
}

export default function GpsSimsUnit() {
  const [, params] = useRoute("/gps-sims/:unitId");
  const unit = gpsTrainerUnits.find((item) => item.id === params?.unitId);
  const { user } = useAuth();
  const { profile, saveProfile, saving } = useStudentProfile();
  const entitlements = (user as any)?.entitlements;
  const isPro = entitlements?.tier ? entitlements.tier !== "free" : user?.logbookProStatus === "active";
  const canPersist = Boolean(isPro);

  const [mode, setMode] = useState<"learn" | "checkride">("learn");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    unit?.tasks[0]?.id ?? null
  );
  const [stepProgress, setStepProgress] = useState<Record<string, boolean[]>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [loadedFromProfile, setLoadedFromProfile] = useState(false);

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
    setLoadedFromProfile(false);
  }, [unit?.id]);

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

  const completedCount = progress.filter(Boolean).length;

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
                    : "Upgrade to RSF Pro to save progress and training history."}
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
