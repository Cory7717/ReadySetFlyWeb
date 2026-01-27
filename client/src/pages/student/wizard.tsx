import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StudentLayout } from "@/components/student/StudentLayout";
import { NextStepCTA } from "@/components/student/NextStepCTA";
import { trackEvent } from "@/lib/analytics";
import { useStudentProfile } from "@/hooks/useStudentProfile";

const steps = [
  "Goals",
  "Budget",
  "Time",
  "Medical",
  "Location",
  "Summary",
];

export default function StudentWizard() {
  const { profile, saveProfile } = useStudentProfile();
  const [step, setStep] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [data, setData] = useState({
    goals: profile.wizardJson?.goals || "hobby",
    budget: profile.wizardJson?.budget || "10k-20k",
    time: profile.wizardJson?.time || "4-6",
    medical: profile.wizardJson?.medical || "unknown",
    location: profile.wizardJson?.location || "",
  });

  useEffect(() => {
    trackEvent("student_page_view", { page: "wizard" });
  }, []);

  useEffect(() => {
    if (hydrated) return;
    if (profile.wizardJson) {
      setData({
        goals: profile.wizardJson?.goals || "hobby",
        budget: profile.wizardJson?.budget || "10k-20k",
        time: profile.wizardJson?.time || "4-6",
        medical: profile.wizardJson?.medical || "unknown",
        location: profile.wizardJson?.location || "",
      });
    }
    setHydrated(true);
  }, [profile.wizardJson, hydrated]);

  useEffect(() => {
    saveProfile({ wizardJson: data });
  }, [data]);

  const summary = useMemo(() => {
    const pathway =
      data.goals === "career"
        ? "Structured training with focused timeline"
        : data.goals === "hobby"
          ? "Flexible training pace with weekend sessions"
          : "Start with a discovery flight and adjust after";
    const timeline =
      data.time === "1-2" ? "12–18 months" : data.time === "3-4" ? "8–12 months" : "5–9 months";
    const cost =
      data.budget === "5k-10k" ? "$12k–$18k" : data.budget === "10k-20k" ? "$15k–$22k" : "$20k–$28k";
    return { pathway, timeline, cost };
  }, [data]);

  return (
    <StudentLayout
      title="Can I Become a Pilot?"
      subtitle="Answer a few quick questions to get a tailored training summary."
    >
      <div className="flex flex-wrap gap-2">
        {steps.map((label, idx) => (
          <span
            key={label}
            className={`text-xs px-2 py-1 rounded-full border ${idx === step ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {label}
          </span>
        ))}
      </div>

      {step === 0 && (
        <Card className="p-4 space-y-3">
          <Label>What is your primary goal?</Label>
          <RadioGroup value={data.goals} onValueChange={(value) => setData((prev) => ({ ...prev, goals: value }))}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="hobby" id="goal-hobby" />
              <Label htmlFor="goal-hobby">Hobby / Personal travel</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="career" id="goal-career" />
              <Label htmlFor="goal-career">Career / Professional track</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="undecided" id="goal-undecided" />
              <Label htmlFor="goal-undecided">Undecided</Label>
            </div>
          </RadioGroup>
        </Card>
      )}

      {step === 1 && (
        <Card className="p-4 space-y-3">
          <Label>Budget range</Label>
          <RadioGroup value={data.budget} onValueChange={(value) => setData((prev) => ({ ...prev, budget: value }))}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="5k-10k" id="budget-low" />
              <Label htmlFor="budget-low">$5k–$10k</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="10k-20k" id="budget-mid" />
              <Label htmlFor="budget-mid">$10k–$20k</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="20k+" id="budget-high" />
              <Label htmlFor="budget-high">$20k+</Label>
            </div>
          </RadioGroup>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-4 space-y-3">
          <Label>Time available (hours per week)</Label>
          <RadioGroup value={data.time} onValueChange={(value) => setData((prev) => ({ ...prev, time: value }))}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="1-2" id="time-low" />
              <Label htmlFor="time-low">1–2 hrs/week</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="3-4" id="time-mid" />
              <Label htmlFor="time-mid">3–4 hrs/week</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="4-6" id="time-high" />
              <Label htmlFor="time-high">4–6 hrs/week</Label>
            </div>
          </RadioGroup>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-4 space-y-3">
          <Label>Medical status (non-medical advice)</Label>
          <RadioGroup value={data.medical} onValueChange={(value) => setData((prev) => ({ ...prev, medical: value }))}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="unknown" id="med-unknown" />
              <Label htmlFor="med-unknown">Not sure yet</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="ok" id="med-ok" />
              <Label htmlFor="med-ok">Likely OK</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="concerns" id="med-concerns" />
              <Label htmlFor="med-concerns">Have concerns</Label>
            </div>
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            This is not medical advice. Always consult an FAA medical examiner.
          </p>
        </Card>
      )}

      {step === 4 && (
        <Card className="p-4 space-y-3">
          <Label>Location (city/state or ZIP)</Label>
          <Input
            placeholder="Austin, TX or 78701"
            value={data.location}
            onChange={(e) => setData((prev) => ({ ...prev, location: e.target.value }))}
          />
        </Card>
      )}

      {step === 5 && (
        <Card className="p-4 space-y-4">
          <div>
            <div className="text-sm text-muted-foreground">Recommended pathway</div>
            <div className="font-semibold">{summary.pathway}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Estimated timeline</div>
            <div className="font-semibold">{summary.timeline}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Estimated cost range</div>
            <div className="font-semibold">{summary.cost}</div>
          </div>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>Book a discovery flight</li>
            <li>Talk with a flight school or CFI about pacing</li>
            <li>Schedule your medical exam</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <NextStepCTA label="Book a Discovery Flight" type="flight-school" location={data.location} tags={["discovery-flight"]} />
            <NextStepCTA label="Find a Flight School" type="flight-school" location={data.location} />
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep((prev) => Math.max(0, prev - 1))} disabled={step === 0}>
          Back
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={() => setStep((prev) => Math.min(steps.length - 1, prev + 1))}>
            Next
          </Button>
        ) : (
          <Button onClick={() => trackEvent("student_wizard_complete", { location: data.location })}>
            Done
          </Button>
        )}
      </div>
    </StudentLayout>
  );
}
