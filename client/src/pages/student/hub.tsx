import { useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trackEvent } from "@/lib/analytics";
import { NextStepCTA } from "@/components/student/NextStepCTA";

const tools = [
  { title: "Can I Become a Pilot?", description: "Quick wizard to map your path.", href: "/student/wizard" },
  { title: "Student Pilot Roadmap", description: "Step-by-step training milestones.", href: "/student/roadmap" },
  { title: "Training Cost Calculator", description: "Estimate total training costs.", href: "/student/cost" },
  { title: "Progress Tracker", description: "Track hours, solos, and milestones.", href: "/student/progress" },
  { title: "Written Test Prep Tracker", description: "Organize study topics.", href: "/student/written" },
  { title: "Preflight & Checklist Trainer", description: "Lightweight training flows.", href: "/student/checklists" },
  { title: "Student Weather", description: "Simplified training weather.", href: "/student/weather" },
  { title: "Flight Planner", description: "Map-based planning with time and fuel estimates.", href: "/flight-planner" },
];

export default function StudentHub() {
  useEffect(() => {
    trackEvent("student_page_view", { page: "hub" });
  }, []);

  return (
    <div className="min-h-screen">
      <section className="bg-muted py-10">
        <div className="container mx-auto px-4 space-y-3">
          <h1 className="font-display text-3xl sm:text-4xl font-bold">Student Pilots</h1>
          <p className="text-muted-foreground max-w-3xl">
            Start flying with tools-first guidance. Build confidence, plan your timeline, and connect with training providers.
          </p>
          <div className="flex flex-wrap gap-3">
            <NextStepCTA label="Find a Flight School" type="flight-school" />
            <NextStepCTA label="Book a Discovery Flight" type="flight-school" tags={["discovery-flight"]} />
            <Button
              variant="outline"
              onClick={() => {
                trackEvent("student_cta_click", { label: "Open Flight Planner", target: "/flight-planner" });
              }}
              asChild
            >
              <Link href="/flight-planner">Open Flight Planner</Link>
            </Button>
            <Badge variant="outline">Free tools for new pilots</Badge>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <Card key={tool.href} className="hover-elevate">
              <CardHeader>
                <CardTitle>{tool.title}</CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href={tool.href}>Open tool</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
