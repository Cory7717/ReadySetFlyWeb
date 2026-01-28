import { useEffect, useState } from "react";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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

const miniModules = [
  {
    id: "aerodynamics",
    title: "Aerodynamics",
    overview:
      "Know how lift, drag, stability, and energy management affect every phase of flight.",
    keyPoints: [
      "Angle of attack drives lift and stall behavior regardless of airspeed.",
      "Load factor increases stall speed and affects maneuvering limits.",
      "Left-turning tendencies require coordinated use of rudder and aileron.",
    ],
    pitfalls: [
      "Confusing pitch with angle of attack.",
      "Forgetting how weight and load factor change stall speed.",
    ],
    practice: "Explain how a steep turn changes stall speed and why.",
  },
  {
    id: "airspace",
    title: "Airspace",
    overview:
      "Master airspace classes, entry requirements, and cloud clearances.",
    keyPoints: [
      "Know equipment and comm requirements for B, C, and D airspace.",
      "Memorize VFR cloud clearance and visibility by class and altitude.",
      "Understand special use airspace (MOA, restricted, prohibited).",
    ],
    pitfalls: [
      "Mixing up Class E vs G cloud clearances.",
      "Assuming ATC clearance is required for Class C/D entry.",
    ],
    practice: "Describe entry requirements for Class C and its cloud clearances.",
  },
  {
    id: "weather",
    title: "Weather",
    overview:
      "Interpret METARs/TAFs and recognize hazards like icing, turbulence, and convective weather.",
    keyPoints: [
      "Identify ceilings, visibility, wind, and altimeter settings in METARs.",
      "Use TAF trends to anticipate changing conditions.",
      "Recognize thunderstorm stages and associated hazards.",
    ],
    pitfalls: [
      "Ignoring freezing level and icing risk.",
      "Focusing on a single report instead of trends.",
    ],
    practice: "Decode a METAR and determine flight category (VFR/MVFR/IFR).",
  },
  {
    id: "navigation",
    title: "Navigation",
    overview:
      "Understand pilotage, dead reckoning, and basic radio navigation.",
    keyPoints: [
      "Convert between true/magnetic heading and course.",
      "Interpret VOR radials and TO/FROM indications.",
      "Use sectional charts for obstacles, airspace, and terrain.",
    ],
    pitfalls: [
      "Mixing up heading vs course vs track.",
      "Tuning the wrong VOR frequency or incorrect OBS setting.",
    ],
    practice: "Explain how to intercept and track a VOR radial.",
  },
  {
    id: "regulations",
    title: "Regulations",
    overview:
      "Know the rules that define privileges, limitations, and responsibility.",
    keyPoints: [
      "Required documents: ARROW (aircraft) and personal certificates.",
      "Right-of-way rules and required minimums.",
      "Currency vs proficiency and the 90-day landing rule.",
    ],
    pitfalls: [
      "Confusing required inspections and AD compliance.",
      "Misunderstanding when a flight review is required.",
    ],
    practice: "List required inspections for a rental aircraft.",
  },
  {
    id: "performance",
    title: "Performance",
    overview:
      "Use POH data to calculate takeoff, landing, and climb performance.",
    keyPoints: [
      "Density altitude affects aircraft performance and distance.",
      "Weight and balance change stall speed and climb rate.",
      "Use performance charts correctly with conditions and corrections.",
    ],
    pitfalls: [
      "Skipping chart corrections for temperature and pressure altitude.",
      "Underestimating takeoff distance on hot days.",
    ],
    practice: "Compute takeoff distance for a given pressure altitude and temperature.",
  },
  {
    id: "systems",
    title: "Systems",
    overview:
      "Know the engine, fuel, electrical, and flight control systems.",
    keyPoints: [
      "Fuel system design, vents, and cross-feed basics.",
      "Electrical system components and alternator failure indications.",
      "Carburetor heat and mixture use by phase of flight.",
    ],
    pitfalls: [
      "Using carb heat incorrectly in cruise.",
      "Not recognizing early electrical failure signs.",
    ],
    practice: "Explain how to manage fuel and mixture during a climb.",
  },
  {
    id: "human-factors",
    title: "Human factors",
    overview:
      "Understand decision-making, risk management, and physiological limits.",
    keyPoints: [
      "Use PAVE and 3P for structured risk management.",
      "Hypoxia, dehydration, and fatigue degrade performance.",
      "Recognize hazardous attitudes and apply antidotes.",
    ],
    pitfalls: [
      "Overconfidence after a recent checkride.",
      "Ignoring personal minimums under pressure.",
    ],
    practice: "Describe how you would use PAVE before a training flight.",
  },
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
        <Accordion type="single" collapsible className="w-full">
          {miniModules.map((module) => (
            <AccordionItem key={module.id} value={module.id}>
              <AccordionTrigger>{module.title}</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">{module.overview}</p>
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
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>

      <NextStepCTA label="Schedule an instructor session" type="cfi" />
    </StudentLayout>
  );
}
