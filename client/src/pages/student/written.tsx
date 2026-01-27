import { useEffect, useState } from "react";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { NextStepCTA } from "@/components/student/NextStepCTA";
import { trackEvent } from "@/lib/analytics";
import { useStudentProfile } from "@/hooks/useStudentProfile";

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

  return (
    <StudentLayout
      title="Written Test Prep Tracker"
      subtitle="Stay organized and focus on weak topics."
    >
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

      <NextStepCTA label="Schedule an instructor session" type="cfi" />
    </StudentLayout>
  );
}
