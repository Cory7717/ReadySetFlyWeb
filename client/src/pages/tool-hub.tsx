import { useEffect } from "react";
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

const calculatorLinks = [
  { label: "e6b advanced", href: "/tools/e6b" },
  { label: "Crosswind", href: "/pilot-tools#calculators" },
  { label: "Density Altitude", href: "/pilot-tools#calculators" },
  { label: "Weight & Balance", href: "/weight-balance" },
  { label: "Ownership Cost", href: "/ownership-cost-calculator" },
];

const toolSections = [
  {
    title: "Core Pilot Tools",
    description: "The tools most pilots will use repeatedly for planning, logging, and daily decisions.",
    cards: [
      {
        title: "Flight Planner",
        description: "Build routes, fuel plans, timing, and alternates.",
        href: "/flight-planner",
        cta: "Open planner",
        icon: Plane,
        accent: true,
      },
      {
        title: "Digital Logbook",
        description: "Track flights, endorsements, aircraft, and training history.",
        href: "/logbook",
        cta: "Open logbook",
        icon: FileText,
        badge: "Core tool",
      },
      {
        title: "Airport Conditions",
        description: "Weather, NOTAMs, runway briefing, and hazards.",
        href: "/pilot-tools#airport-weather",
        cta: "Open conditions",
        icon: CloudSun,
      },
      {
        title: "Aviation Weather Hub",
        description: "METARs, TAFs, PIREPs, hazards, winds aloft, icing, and turbulence.",
        href: "/aviation-weather",
        cta: "Open weather hub",
        icon: Cloud,
        badge: "New",
      },
    ],
  },
  {
    title: "Training and IFR",
    description: "Training workflows, scenario practice, and instrument-reference tools.",
    cards: [
      {
        title: "Student Tools",
        description: "Training plans, study tools, abbreviations, and progress tracking.",
        href: "/student",
        cta: "Open Student Hub",
        icon: BookOpen,
      },
      {
        title: "GPS Trainers",
        description: "RSF GPS training units and interactive cockpit workflow practice.",
        href: "/gps-sims",
        cta: "Open GPS trainers",
        icon: Route,
      },
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
        title: "Radio Comms Trainer",
        description: "Practice phraseology and scenario-based ATC communication.",
        href: "/radio-comms-trainer",
        cta: "Open trainer",
        icon: Signal,
      },
      {
        title: "Synthetic Vision",
        description: "RSF Pro synthetic-vision lab with training scoring and review.",
        href: "/synthetic-vision",
        cta: "Open synthetic vision",
        icon: Navigation,
        badge: "RSF Pro",
      },
    ],
  },
  {
    title: "Calculators and Airspace",
    description: "Quick-reference computation tools plus live restriction checks.",
    cards: [
      {
        title: "Pilot Calculators",
        description: "All calculators in one place.",
        href: "/pilot-tools#calculators",
        cta: "Open calculators",
        icon: Calculator,
        badge: "Free tools",
        detailBadges: calculatorLinks.map((calc) => calc.label),
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
        cta: "Open live traffic",
        icon: Plane,
        badge: "Beta",
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
    title: "Directories and Feature Entry Points",
    description: "The non-tool destinations users still need for discovering instructors, rentals, services, and events.",
    cards: [
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
        title: "Rentals",
        description: "Browse rentals, aircraft access, and school-related listings.",
        href: "/rentals",
        cta: "Browse rentals",
        icon: Plane,
      },
      {
        title: "Marketplace",
        description: "Explore schools, services, jobs, charter, and aviation business listings.",
        href: "/marketplace",
        cta: "Open marketplace",
        icon: Briefcase,
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
      <section className="bg-muted/30 py-10">
        <div className="container mx-auto px-4 space-y-3">
          <Badge variant="outline">Tool Hub</Badge>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">Pilot Tool Hub</h1>
          <p className="text-muted-foreground max-w-3xl">
            All current RSF pilot tools and training utilities in one place. Start with planning and logging, then move into weather, IFR, and training workflows.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              onClick={() => trackEvent("tool_hub_click", { target: "/flight-planner" })}
            >
              <Link href="/flight-planner">Open Flight Planner</Link>
            </Button>
            <Button
              variant="outline"
              asChild
              onClick={() => trackEvent("tool_hub_click", { target: "/logbook" })}
            >
              <Link href="/logbook">Open Digital Logbook</Link>
            </Button>
            <Badge variant="secondary">All pilot tools</Badge>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 space-y-8">
        {toolSections.map((section) => (
          <div key={section.title} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">{section.title}</h2>
              <p className="text-sm text-muted-foreground">{section.description}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                    className={card.accent ? "border-primary/20 bg-primary/5" : undefined}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <CardTitle className="flex items-center gap-2">
                            <Icon className={`h-5 w-5 ${card.accent ? "text-primary" : ""}`} />
                            {card.title}
                          </CardTitle>
                          <CardDescription>{card.description}</CardDescription>
                        </div>
                        {card.badge ? <Badge variant="outline">{card.badge}</Badge> : null}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {card.detailBadges ? (
                        <div className="flex flex-wrap gap-2">
                          {card.detailBadges.map((detail) => (
                            <Badge key={detail} variant="outline">
                              {detail}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                      <Button
                        asChild
                        className="w-full"
                        variant={card.accent ? "default" : "outline"}
                        onClick={() => trackEvent("tool_hub_click", { target: href })}
                      >
                        <Link href={href}>{cta}</Link>
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
