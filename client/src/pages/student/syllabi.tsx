import { useEffect } from "react";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { trackEvent } from "@/lib/analytics";
import {
  trainingSyllabi,
  trainingSyllabusComplianceNotes,
  trainingSyllabusSimulatorNote,
} from "@shared/training-syllabi";

export default function StudentSyllabi() {
  useEffect(() => {
    trackEvent("student_page_view", { page: "syllabi" });
  }, []);

  return (
    <StudentLayout
      title="Independent CFI Syllabi"
      subtitle="ACS-aligned Part 61 templates for instructors and student pilots."
    >
      <div className="space-y-6">
        <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">Compliance Notes</Badge>
            <Badge variant="secondary">Part 61</Badge>
          </div>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            {trainingSyllabusComplianceNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{trainingSyllabusSimulatorNote}</p>
        </div>

        {trainingSyllabi.map((syllabus) => (
          <div key={syllabus.id} className="rounded-lg border p-5 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-lg font-semibold">{syllabus.title}</div>
                <p className="text-sm text-muted-foreground">{syllabus.subtitle}</p>
              </div>
              <Badge variant="outline">Template</Badge>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold">Completion standards</div>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                {syllabus.completionStandards.map((standard) => (
                  <li key={standard}>{standard}</li>
                ))}
              </ul>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="text-sm font-semibold">Phases and lesson focus</div>
              <Accordion type="multiple" className="space-y-2">
                {syllabus.phases.map((phase) => (
                  <AccordionItem key={phase.id} value={phase.id} className="border rounded-lg px-3">
                    <AccordionTrigger className="text-left">
                      <div>
                        <div className="font-medium">{phase.title}</div>
                        <p className="text-xs text-muted-foreground">{phase.summary}</p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div>
                        <div className="text-xs font-semibold uppercase text-muted-foreground">Ground</div>
                        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                          {phase.ground.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase text-muted-foreground">Flight</div>
                        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                          {phase.flight.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      {phase.stageCheck && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-semibold">Stage check:</span> {phase.stageCheck}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="text-sm font-semibold">Optional simulator modules</div>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                {syllabus.simulatorModules.map((module) => (
                  <li key={module}>{module}</li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">{trainingSyllabusSimulatorNote}</p>
            </div>
          </div>
        ))}
      </div>
    </StudentLayout>
  );
}
