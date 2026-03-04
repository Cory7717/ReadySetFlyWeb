import { useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trackEvent } from "@/lib/analytics";
import { NextStepCTA } from "@/components/student/NextStepCTA";
import { BannerAdRotation } from "@/components/banners/BannerAdRotation";
import { useAuth } from "@/hooks/useAuth";
import { PageShell } from "@/components/layout/PageShell";
import { BookOpenCheck, ClipboardList, GraduationCap, Plane, Radar, Route } from "lucide-react";

type ToolCard = {
  title: string;
  description: string;
  href: string;
  cta: string;
  comingSoon?: boolean;
};

type ToolSection = {
  title: string;
  description: string;
  cards: ToolCard[];
};

const studentSections: ToolSection[] = [
  {
    title: "Start Here",
    description: "These are the first tools new student pilots should use to map training, cost, and next steps.",
    cards: [
      { title: "Can I Become a Pilot?", description: "Quick wizard to map your training path.", href: "/student/wizard", cta: "Start your path" },
      { title: "Student Pilot Roadmap", description: "Step-by-step milestones from discovery flight to checkride.", href: "/student/roadmap", cta: "View roadmap" },
      { title: "Training Cost Calculator", description: "Estimate total training cost before you commit.", href: "/student/cost", cta: "Estimate cost" },
      { title: "Flight Planner", description: "Build practice routes, timing, and fuel estimates as you train.", href: "/flight-planner", cta: "Build a route" },
    ],
  },
  {
    title: "Track Progress",
    description: "Keep your progress, study plan, and training materials organized in one place.",
    cards: [
      { title: "Progress Tracker", description: "Track hours, solos, and milestones.", href: "/student/progress", cta: "Track progress" },
      { title: "Training Workspace", description: "Store lessons, notes, and training documents.", href: "/student/training", cta: "Open workspace" },
      { title: "Written Test Prep Tracker", description: "Organize study topics and check your progress.", href: "/student/written", cta: "Track study plan" },
      { title: "Independent CFI Syllabi", description: "Review ACS-aligned Part 61 training templates.", href: "/student/syllabi", cta: "Review syllabi" },
    ],
  },
  {
    title: "Practice & Study",
    description: "Use these tools to build confidence on the ground before the next lesson or checkride.",
    cards: [
      { title: "Aviation Abbreviations", description: "RSF glossary and quiz mode for common acronyms.", href: "/student/abbreviations", cta: "Study abbreviations" },
      { title: "VOR Trainer", description: "Practice radials, OBS, flags, and intercepts.", href: "/student/vor-trainer", cta: "Practice VOR" },
      { title: "6-Pack Panel Trainer", description: "Learn the classic flight instruments with an interactive panel.", href: "/student/six-pack-trainer", cta: "Practice six-pack" },
      { title: "Preflight & Checklist Trainer", description: "Walk through common checklist flows before the next flight.", href: "/student/checklists", cta: "Practice checklists" },
      { title: "Student Weather", description: "Review simplified weather built for training use.", href: "/student/weather", cta: "Review weather" },
      { title: "IFR Tools Hub", description: "Preview the IFR side of RSF as your training progresses.", href: "/ifr-tools", cta: "Open IFR tools" },
      { title: "RSF GPS Simulators", description: "IFR GPS workflows for top avionics stacks.", href: "/gps-sims", cta: "Coming soon", comingSoon: true },
    ],
  },
];

export default function StudentHub() {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    trackEvent("student_page_view", { page: "hub" });
  }, []);

  return (
    <PageShell
      kicker="Training"
      title="Student Pilots"
      description="Start flying with tools-first guidance. Build confidence, plan your timeline, and connect with training providers."
      actions={
        <>
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
        </>
      }
      contentClassName="space-y-8"
    >
      <BannerAdRotation placement="student-hub" className="px-0 py-0" />

      <section>
        <div className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.15rem] border border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--primary)/0.08))] p-5 shadow-[var(--shadow-rsf-panel)]">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
              <GraduationCap className="h-4 w-4" />
              Student Pilot Starter
            </div>
            <h2 className="text-2xl font-semibold">Start with the tools that matter first</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              If you are just getting started, map your training path, estimate total cost, and build your first practice route before you move deeper into the rest of the hub.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Button asChild className="w-full">
                <Link href="/student/wizard">Start your path</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/student/cost">Estimate training cost</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/flight-planner">Build a route</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { icon: Route, title: "Map your path", text: "Use the wizard and roadmap to understand what comes next." },
              { icon: ClipboardList, title: "Track progress", text: "Keep hours, lessons, study goals, and milestones organized." },
              { icon: BookOpenCheck, title: "Practice on the ground", text: "Build confidence with weather, VOR, panel, and checklist tools." },
            ].map((item) => (
              <div key={item.title} className="rounded-[1rem] border border-white/10 bg-white/75 p-4 shadow-[var(--shadow-rsf-soft)]">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <item.icon className="h-4 w-4 text-primary" />
                  {item.title}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {!isAuthenticated ? (
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-semibold">Create a free account to keep training momentum</div>
                <p className="text-sm text-muted-foreground">
                  Save student progress, return to your training tools later, and connect with schools or instructors when you are ready.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:w-auto">
                <Button asChild onClick={() => trackEvent("student_cta_click", { label: "Create Free Account", target: "/register" })}>
                  <Link href="/register">Create Free Account</Link>
                </Button>
                <Button variant="outline" asChild onClick={() => trackEvent("student_cta_click", { label: "Sign In", target: "/login" })}>
                  <Link href="/login">Sign In</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
        <div className="space-y-6">
          {studentSections.map((section) => (
            <div key={section.title} className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold">{section.title}</h2>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.cards.map((tool) => (
                  <Card
                    key={tool.href}
                    className={tool.comingSoon ? "border-dashed bg-muted/40 text-muted-foreground opacity-70" : "hover-elevate"}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {tool.title}
                        {tool.comingSoon ? <Badge variant="secondary">Coming soon</Badge> : null}
                      </CardTitle>
                      <CardDescription>{tool.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {tool.comingSoon ? (
                        <Button variant="outline" className="w-full" disabled aria-disabled>
                          Coming soon
                        </Button>
                      ) : (
                        <Button asChild variant="outline" className="w-full">
                          <Link href={tool.href}>{tool.cta}</Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
