import { useEffect, type ComponentType } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  Calculator,
  Cloud,
  CloudSun,
  FileText,
  Navigation,
  Plane,
  Radio,
  Route,
  Signal,
  Users,
} from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

type ToolHubCard = {
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: ComponentType<{ className?: string }>;
  accent?: boolean;
  badge?: string;
  detailBadges?: string[];
  comingSoon?: boolean;
};

type ToolHubSection = {
  title: string;
  description: string;
  cards: ToolHubCard[];
};

const calculatorLinks = [
  { label: "e6b advanced", href: "/tools/e6b" },
  { label: "Crosswind", href: "/pilot-tools#calculators" },
  { label: "Density Altitude", href: "/pilot-tools#calculators" },
  { label: "Weight & Balance", href: "/weight-balance" },
  { label: "Ownership Cost", href: "/ownership-cost-calculator" },
];

const toolSections: ToolHubSection[] = [
  {
    title: "Core Pilot Tools",
    description: "Start with the tools most pilots are likely to use repeatedly for planning, logging, weather, and restriction checks.",
    cards: [
      {
        title: "Flight Planner",
        description: "Build routes, fuel plans, timing, and alternates.",
        href: "/flight-planner",
        cta: "Open planner",
        icon: Plane,
        accent: true,
        badge: "Most used",
      },
      {
        title: "Digital Logbook",
        description: "Track flights, endorsements, aircraft, and training history.",
        href: "/logbook",
        cta: "Open logbook",
        icon: FileText,
        badge: "Most used",
      },
      {
        title: "Airport Conditions",
        description: "Weather, NOTAMs, runway briefing, and hazards.",
        href: "/pilot-tools#airport-weather",
        cta: "Open conditions",
        icon: CloudSun,
      },
      {
        title: "TFR Map",
        description: "Live TFRs, SUA overlays, and airspace restriction awareness.",
        href: "/tfr-map",
        cta: "Open TFR map",
        icon: AlertTriangle,
        badge: "FAA SWIM",
      },
      {
        title: "Aviation Weather Hub",
        description: "METARs, TAFs, PIREPs, hazards, winds aloft, icing, and turbulence.",
        href: "/aviation-weather",
        cta: "Open weather hub",
        icon: Cloud,
        badge: "New",
      },
      {
        title: "Pilot Calculators",
        description: "All calculators in one place.",
        href: "/pilot-tools#calculators",
        cta: "Open calculators",
        icon: Calculator,
        badge: "Free tools",
        detailBadges: calculatorLinks.map((calc) => calc.label),
      },
    ],
  },
  {
    title: "Advanced Planning and Airspace",
    description: "Use these after the core workflow for briefing depth, performance checks, and situational awareness.",
    cards: [
      {
        title: "NOTAM Briefing",
        description: "Jump straight to airport NOTAM briefing and runway advisory tools.",
        href: "/pilot-tools#airport-briefing",
        cta: "Open NOTAM briefing",
        icon: FileText,
      },
      {
        title: "Live Traffic",
        description: "Global ADS-B traffic view for situational awareness.",
        href: "/live-traffic",
        cta: "Coming soon",
        icon: Plane,
        badge: "Coming soon",
        comingSoon: true,
      },
      {
        title: "Weight & Balance",
        description: "Aircraft loading, envelope checks, and load planning.",
        href: "/weight-balance",
        cta: "Open weight & balance",
        icon: Calculator,
      },
      {
        title: "Ownership Cost Calculator",
        description: "Estimate ownership costs and long-term operating economics.",
        href: "/ownership-cost-calculator",
        cta: "Open ownership cost",
        icon: Calculator,
      },
      {
        title: "E6B Advanced",
        description: "Use the digital E6B workflow for planning and inflight calculations.",
        href: "/tools/e6b",
        cta: "Open E6B",
        icon: Calculator,
      },
    ],
  },
  {
    title: "Training and IFR",
    description: "When users move beyond planning, these are the next training, IFR, and scenario tools they are likely to use.",
    cards: [
      {
        title: "IFR Tools",
        description: "IFR planners, procedures, sims, and training aids.",
        href: "/ifr-tools",
        cta: "Open IFR tools",
        icon: Radio,
      },
      {
        title: "IFR Approach Plates",
        description: "Search and review current FAA approach plates.",
        href: "/approach-plates",
        cta: "Open plates",
        icon: FileText,
      },
      {
        title: "GPS Trainers",
        description: "RSF GPS training units and interactive cockpit workflow practice.",
        href: "/gps-sims",
        cta: "Coming soon",
        icon: Route,
        badge: "Coming soon",
        comingSoon: true,
      },
      {
        title: "Radio Comms Trainer",
        description: "Practice phraseology and scenario-based ATC communication.",
        href: "/radio-comms-trainer",
        cta: "Open trainer",
        icon: Signal,
      },
      {
        title: "Student Tools",
        description: "Training plans, study tools, abbreviations, and progress tracking.",
        href: "/student",
        cta: "Open Student Hub",
        icon: BookOpen,
      },
      {
        title: "Synthetic Vision",
        description: "RSF Pro synthetic-vision lab with training scoring and review.",
        href: "/synthetic-vision",
        cta: "Coming soon",
        icon: Navigation,
        badge: "Coming soon",
        comingSoon: true,
      },
    ],
  },
  {
    title: "Directories and Feature Entry Points",
    description: "These are the broader entry points for instructors, rentals, marketplace discovery, events, and support.",
    cards: [
      {
        title: "Marketplace",
        description: "Explore schools, services, jobs, charter, and aviation business listings.",
        href: "/marketplace",
        cta: "Open marketplace",
        icon: Briefcase,
      },
      {
        title: "Rentals",
        description: "Browse rentals, aircraft access, and school-related listings.",
        href: "/rentals",
        cta: "Browse rentals",
        icon: Plane,
      },
      {
        title: "CFI Directory",
        description: "Browse instructors, compare profiles, and connect with CFIs.",
        href: "/cfi",
        cta: "Open CFI directory",
        icon: Users,
      },
      {
        title: "CFI Instructor Profile",
        description: "Create or manage your instructor presence inside the RSF CFI marketplace.",
        href: "/dashboard/cfi",
        cta: "Open CFI profile",
        icon: Users,
      },
      {
        title: "Aviation Events",
        description: "Find fly-ins, seminars, community events, and safety gatherings.",
        href: "/events",
        cta: "View events",
        icon: BookOpen,
      },
      {
        title: "FAQ and Verification",
        description: "Read platform guidance, verification details, and operational help.",
        href: "/faq",
        cta: "Open FAQ",
        icon: FileText,
      },
    ],
  },
];

export default function ToolHub() {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    trackEvent("tool_hub_view");
  }, []);

  return (
    <div className="min-h-screen">
      <section className="border-b border-slate-900/10 bg-[linear-gradient(135deg,hsl(210_28%_11%),hsl(195_33%_22%))] py-10 text-slate-100">
        <div className="container mx-auto px-4 space-y-3">
          <span className="rsf-kicker border-white/10 bg-white/10 text-amber-100">Tool Hub</span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">Pilot Tool Hub</h1>
          <p className="max-w-3xl text-slate-300">
            Start with the daily-use pilot workflow first: plan, brief, log, then move into weather depth, IFR practice, directories, and supporting tools.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              asChild
              className="w-full sm:w-auto"
              onClick={() => trackEvent("tool_hub_click", { target: "/flight-planner" })}
            >
              <Link href="/flight-planner">Open Flight Planner</Link>
            </Button>
            <Button
              variant="outline"
              asChild
              className="w-full border-slate-300/20 bg-white/5 text-slate-100 hover:bg-white/10 sm:w-auto"
              onClick={() => trackEvent("tool_hub_click", { target: "/logbook" })}
            >
              <Link href="/logbook">Open Digital Logbook</Link>
            </Button>
            <div className="flex items-center">
              <Badge variant="secondary" className="border-0 bg-white/10 text-slate-200 shadow-none">All pilot tools</Badge>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8 sm:py-10 space-y-8 sm:space-y-10">
        {toolSections.map((section) => (
          <div key={section.title} className="space-y-4">
            <div className="rounded-[1.2rem] border border-card-border bg-[linear-gradient(180deg,hsl(var(--card)),hsl(var(--muted)/0.45))] p-4 sm:p-5 shadow-sm">
              <div className="space-y-1 border-l-4 border-amber-400 pl-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">RSF workflow group</div>
                <h2 className="text-2xl font-semibold">{section.title}</h2>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {section.cards.map((card) => {
                const Icon = card.icon;
                const href =
                  card.title === "CFI Instructor Profile" && !isAuthenticated ? "/register" : card.href;
                const cta =
                  card.title === "CFI Instructor Profile" && !isAuthenticated
                    ? "Create free account"
                    : card.cta;
                return (
                  <Card
                    key={card.title}
                    className={[
                      "h-full",
                      card.accent ? "border-primary/30 bg-[linear-gradient(180deg,hsl(var(--card)),hsl(var(--primary)/0.09))]" : "",
                      card.comingSoon ? "border-dashed bg-[linear-gradient(180deg,hsl(var(--card)/0.72),hsl(var(--muted)/0.7))] text-muted-foreground opacity-70" : "",
                    ].join(" ").trim()}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <CardTitle className="flex items-center gap-2">
                            <Icon className={`h-5 w-5 ${card.accent ? "text-primary" : ""}`} />
                            {card.title}
                          </CardTitle>
                          <CardDescription>{card.description}</CardDescription>
                        </div>
                        {card.badge ? <Badge variant={card.accent ? "default" : "outline"}>{card.badge}</Badge> : null}
                      </div>
                    </CardHeader>
                    <CardContent className="flex h-full flex-col justify-between space-y-3">
                      {card.detailBadges ? (
                        <div className="flex flex-wrap gap-2">
                          {card.detailBadges.map((detail: string) => (
                            <Badge key={detail} variant="outline">
                              {detail}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                      <Button
                        className="w-full"
                        variant={card.accent ? "default" : "outline"}
                        disabled={card.comingSoon}
                        aria-disabled={card.comingSoon}
                        onClick={() => {
                          if (!card.comingSoon) {
                            trackEvent("tool_hub_click", { target: href });
                          }
                        }}
                      >
                        {card.comingSoon ? cta : <Link href={href}>{cta}</Link>}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
