import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trackEvent } from "@/lib/analytics";
import { NextStepCTA } from "@/components/student/NextStepCTA";
import { SponsoredRightRail } from "@/components/banners/SponsoredRightRail";
import { useAuth } from "@/hooks/useAuth";
import { canUseInternalPreview } from "@/lib/internal-preview";
import { PageShell } from "@/components/layout/PageShell";
import { BookOpenCheck, ClipboardList, GraduationCap, Route } from "lucide-react";

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
  const { isAuthenticated, user } = useAuth();
  const canPreviewInternal = canUseInternalPreview(user);
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
            onClick={() => trackEvent("student_cta_click", { label: "Open Flight Planner", target: "/flight-planner" })}
            asChild
          >
            <Link href="/flight-planner">Open Flight Planner</Link>
          </Button>
          <Badge variant="outline">Free tools for new pilots</Badge>
        </>
      }
      contentClassName="space-y-8"
    >
      <section className="space-y-6">
        {/* Hero panel + summary cards + ad rail */}
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr_340px]">

          {/* Hero CTA panel */}
          <div className="rsf-card-shell p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
              <GraduationCap className="h-4 w-4" />
              Student Pilot Starter
            </div>
            <h2 className="text-xl font-semibold text-[#F5F8FC]">Start with the tools that matter first</h2>
            <p className="mt-2 text-sm text-[#A9BBCD]">
              If you are just getting started, map your training path, estimate total cost, and build
              your first practice route before you move deeper into the rest of the hub.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Button asChild className="rsf-metal-button-primary w-full">
                <Link href="/student/wizard">Start your path</Link>
              </Button>
              <Button asChild variant="outline" className="w-full border-[#5d6f85]/30 bg-[#141b24] text-[#E8EDF4] hover:bg-[#1a2430]">
                <Link href="/student/cost">Estimate training cost</Link>
              </Button>
              <Button asChild variant="outline" className="w-full border-[#5d6f85]/30 bg-[#141b24] text-[#E8EDF4] hover:bg-[#1a2430]">
                <Link href="/flight-planner">Build a route</Link>
              </Button>
            </div>
          </div>

          {/* Three summary tiles */}
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { icon: Route, title: "Map your path", text: "Use the wizard and roadmap to understand what comes next." },
              { icon: ClipboardList, title: "Track progress", text: "Keep hours, lessons, study goals, and milestones organized." },
              { icon: BookOpenCheck, title: "Practice on the ground", text: "Build confidence with weather, VOR, panel, and checklist tools." },
            ].map((item) => (
              <div key={item.title} className="rsf-metal-subpanel rounded-[1rem] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#F5F8FC]">
                  <item.icon className="h-4 w-4 text-primary" />
                  {item.title}
                </div>
                <p className="mt-2 text-sm text-[#A9BBCD]">{item.text}</p>
              </div>
            ))}
          </div>

          <SponsoredRightRail
            placement="student-hub"
            infoTestId="button-banner-ad-info-student-hub"
            className="xl:sticky xl:top-24 xl:self-start"
          />
        </div>

        {/* Auth prompt */}
        {!isAuthenticated && (
          <div className="rsf-metal-subpanel rounded-[1.1rem] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[#F5F8FC]">Create a free account to keep training momentum</div>
                <p className="text-sm text-[#A9BBCD]">
                  Save student progress, return to your training tools later, and connect with schools or instructors when you are ready.
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <Button asChild className="rsf-metal-button-primary" onClick={() => trackEvent("student_cta_click", { label: "Create Free Account", target: "/register" })}>
                  <Link href="/register">Create free account</Link>
                </Button>
                <Button variant="outline" asChild className="border-[#5d6f85]/30 bg-[#141b24] text-[#E8EDF4] hover:bg-[#1a2430]" onClick={() => trackEvent("student_cta_click", { label: "Sign In", target: "/login" })}>
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tool sections */}
        <div className="space-y-8">
          {studentSections.map((section) => (
            <div key={section.title} className="space-y-3">
              <div className="space-y-0.5">
                <h2 className="text-base font-semibold text-[#F5F8FC]">{section.title}</h2>
                <p className="text-sm text-[#A9BBCD]">{section.description}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {section.cards.map((tool) => {
                  const isPreviewCard = Boolean(tool.comingSoon && canPreviewInternal);
                  const isLockedCard = Boolean(tool.comingSoon && !canPreviewInternal);
                  return (
                    <div
                      key={tool.href}
                      className={[
                        "rsf-metal-panel rounded-[1.1rem] p-4 flex flex-col gap-3",
                        !isLockedCard && "rsf-metal-panel-interactive",
                        isLockedCard && "opacity-50",
                      ].filter(Boolean).join(" ")}
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[#F5F8FC]">
                          {tool.title}
                          {isPreviewCard && <Badge variant="outline" className="border-[#5c74a3]/40 bg-[#141b28] text-[#9fc0ff] text-[10px]">Preview</Badge>}
                          {isLockedCard && <Badge variant="secondary" className="border-[#5b6e87]/35 bg-[#131923] text-[#9db8d8] text-[10px]">Soon</Badge>}
                        </div>
                        <p className="text-xs text-[#A9BBCD]">{tool.description}</p>
                      </div>
                      {isLockedCard ? (
                        <Button variant="outline" className="w-full border-[#5d6f85]/20 bg-[#0f141a] text-[#708299]" disabled>
                          Coming soon
                        </Button>
                      ) : (
                        <Button asChild variant="outline" className="w-full border-[#5d6f85]/30 bg-[#141b24] text-[#E8EDF4] hover:bg-[#1a2430]">
                          <Link href={tool.href}>{isPreviewCard ? "Open preview" : tool.cta}</Link>
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
