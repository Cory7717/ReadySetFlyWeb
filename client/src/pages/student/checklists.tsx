import { useEffect } from "react";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Card } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics";

const checklistSections = [
  {
    title: "Generic Preflight Flow",
    items: [
      "Check weather + NOTAMs",
      "Review aircraft logbook status",
      "Walkaround: fuel, oil, control surfaces",
      "Pitot/static covers removed",
      "Documents: ARROW",
    ],
  },
  {
    title: "Pattern Work Flow",
    items: [
      "Brief takeoff/landing plan",
      "Callouts: airspeed, altitude, spacing",
      "Stabilized approach criteria",
      "Go-around decision points",
    ],
  },
  {
    title: "What to Bring to Lessons",
    items: [
      "Logbook + student pilot certificate",
      "Headset",
      "Kneeboard + pen",
      "Sectional / EFB",
      "Water + sunglasses",
    ],
  },
];

export default function StudentChecklists() {
  useEffect(() => {
    trackEvent("student_page_view", { page: "checklists" });
  }, []);

  return (
    <StudentLayout
      title="Preflight & Checklist Trainer"
      subtitle="Lightweight checklists for student pilots. Not a substitute for POH or instructor guidance."
    >
      <div className="grid gap-4">
        {checklistSections.map((section) => (
          <Card key={section.title} className="p-4 space-y-2">
            <div className="font-semibold">{section.title}</div>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </StudentLayout>
  );
}
