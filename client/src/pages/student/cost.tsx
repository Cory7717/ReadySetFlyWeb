import { useEffect, useMemo, useState } from "react";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { NextStepCTA } from "@/components/student/NextStepCTA";
import { trackEvent } from "@/lib/analytics";

const aircraftPresets: Record<string, number> = {
  C172: 165,
  "PA-28": 155,
  Other: 170,
};

export default function StudentCostCalculator() {
  const [location, setLocation] = useState("");
  const [aircraftType, setAircraftType] = useState<keyof typeof aircraftPresets>("C172");
  const [lessonsPerWeek, setLessonsPerWeek] = useState("2");
  const [aircraftRate, setAircraftRate] = useState(String(aircraftPresets.C172));
  const [instructorRate, setInstructorRate] = useState("65");
  const [totalHours, setTotalHours] = useState("65");

  useEffect(() => {
    trackEvent("student_page_view", { page: "cost" });
  }, []);

  useEffect(() => {
    setAircraftRate(String(aircraftPresets[aircraftType]));
  }, [aircraftType]);

  const estimate = useMemo(() => {
    const hours = Number(totalHours) || 0;
    const perHour = (Number(aircraftRate) || 0) + (Number(instructorRate) || 0);
    const total = hours * perHour;
    const weeklyHours = Math.max(1, Number(lessonsPerWeek) || 1) * 1.4;
    const weeks = weeklyHours ? hours / weeklyHours : 0;
    const months = weeks / 4;
    return { total, months };
  }, [totalHours, aircraftRate, instructorRate, lessonsPerWeek]);

  return (
    <StudentLayout
      title="Training Cost Calculator"
      subtitle="Estimate training costs and timeline. This is a rough estimate; flight schools vary."
    >
      <Card className="p-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Location</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City or ZIP" />
        </div>
        <div className="space-y-2">
          <Label>Aircraft type</Label>
          <select
            className="border rounded-md h-10 px-3 w-full bg-background"
            value={aircraftType}
            onChange={(e) => setAircraftType(e.target.value as keyof typeof aircraftPresets)}
          >
            {Object.keys(aircraftPresets).map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Lessons per week</Label>
          <Input value={lessonsPerWeek} onChange={(e) => setLessonsPerWeek(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Aircraft wet rate ($/hr)</Label>
          <Input value={aircraftRate} onChange={(e) => setAircraftRate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Instructor rate ($/hr)</Label>
          <Input value={instructorRate} onChange={(e) => setInstructorRate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Expected total hours</Label>
          <Input value={totalHours} onChange={(e) => setTotalHours(e.target.value)} />
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <div className="text-sm text-muted-foreground">Estimated total cost</div>
        <div className="text-2xl font-semibold">${estimate.total.toLocaleString()}</div>
        <div className="text-sm text-muted-foreground">
          Estimated completion: {estimate.months ? `${Math.ceil(estimate.months)} months` : "N/A"}
        </div>
      </Card>

      <NextStepCTA label="Compare Flight Schools near you" type="flight-school" location={location} />
    </StudentLayout>
  );
}
