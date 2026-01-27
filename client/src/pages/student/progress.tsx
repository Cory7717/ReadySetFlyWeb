import { useEffect, useState } from "react";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { NextStepCTA } from "@/components/student/NextStepCTA";
import { trackEvent } from "@/lib/analytics";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useToast } from "@/hooks/use-toast";

export default function StudentProgress() {
  const { toast } = useToast();
  const { profile, saveProfile } = useStudentProfile();
  const [hydrated, setHydrated] = useState(false);
  const [progress, setProgress] = useState({
    hours: profile.progressJson?.hours || "",
    solos: profile.progressJson?.solos || "",
    xcHours: profile.progressJson?.xcHours || "",
    writtenPassed: profile.progressJson?.writtenPassed || false,
    checkrideDate: profile.progressJson?.checkrideDate || "",
  });

  useEffect(() => {
    trackEvent("student_page_view", { page: "progress" });
  }, []);

  useEffect(() => {
    if (hydrated) return;
    if (profile.progressJson) {
      setProgress({
        hours: profile.progressJson?.hours || "",
        solos: profile.progressJson?.solos || "",
        xcHours: profile.progressJson?.xcHours || "",
        writtenPassed: profile.progressJson?.writtenPassed || false,
        checkrideDate: profile.progressJson?.checkrideDate || "",
      });
    }
    setHydrated(true);
  }, [profile.progressJson, hydrated]);

  useEffect(() => {
    saveProfile({ progressJson: progress });
  }, [progress]);

  const celebrate = (message: string) => {
    toast({ title: "Nice progress!", description: message });
  };

  return (
    <StudentLayout
      title="Student Progress Tracker"
      subtitle="Track your milestones and keep momentum."
    >
      <Card className="p-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Total hours logged</Label>
          <Input value={progress.hours} onChange={(e) => setProgress((p) => ({ ...p, hours: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Solos completed</Label>
          <Input value={progress.solos} onChange={(e) => setProgress((p) => ({ ...p, solos: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Cross-country hours</Label>
          <Input value={progress.xcHours} onChange={(e) => setProgress((p) => ({ ...p, xcHours: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Checkride scheduled</Label>
          <Input type="date" value={progress.checkrideDate} onChange={(e) => setProgress((p) => ({ ...p, checkrideDate: e.target.value }))} />
        </div>
        <div className="flex items-center justify-between md:col-span-2">
          <Label>Written exam passed</Label>
          <Switch
            checked={progress.writtenPassed}
            onCheckedChange={(value) => {
              setProgress((p) => ({ ...p, writtenPassed: value }));
              if (value) celebrate("You passed your written!");
            }}
          />
        </div>
      </Card>

      <NextStepCTA
        label="Ready for the next step? Find a Flight School"
        type="flight-school"
      />
    </StudentLayout>
  );
}
