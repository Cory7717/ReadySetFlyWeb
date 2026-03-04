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
    title: "Find",
    description: "Start with the marketplace and directory entry points that bring most users into RSF first.",
    cards: [
      {
        title: "Marketplace",
        description: "Explore schools, services, jobs, charter, and aviation business listings.",
        href: "/marketplace",
        cta: "Open marketplace",
        icon: Briefcase,
        accent: true,
        badge: "Most used",
      },
      {
        title: "Rentals",
        description: "Browse rentals, aircraft access, and school-related listings.",
        href: "/rentals",
        cta: "Browse rentals",
        icon: Plane,
        badge: "Most used",
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
  {
    title: "Plan",
    description: "After discovery, these are the core planning and briefing tools pilots use most often.",
    cards: [
      {
        title: "Flight Planner",
        description: "Build routes, fuel plans, timing, and alternates.",
        href: "/flight-planner",
        cta: "Open planner",
        icon: Plane,
        accent: true,
        badge: "Core workflow",
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
        title: "NOTAM Briefing",
        description: "Jump straight to airport NOTAM briefing and runway advisory tools.",
        href: "/pilot-tools#airport-briefing",
        cta: "Open NOTAM briefing",
        icon: FileText,
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
    title: "Train & Track",
    description: "These tools cover logging, training, IFR prep, and practice history after the planning work is done.",
    cards: [
      {
        title: "Digital Logbook",
        description: "Track flights, endorsements, aircraft, and training history.",
        href: "/logbook",
        cta: "Open logbook",
        icon: FileText,
        accent: true,
        badge: "Most used",
      },
      {
        title: "Student Tools",
        description: "Training plans, study tools, abbreviations, and progress tracking.",
        href: "/student",
        cta: "Open Student Hub",
        icon: BookOpen,
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
        title: "Weight & Balance",
        description: "Aircraft loading, envelope checks, and load planning.",
        href: "/weight-balance",
        cta: "Open weight & balance",
        icon: Calculator,
      },
    ],
  },
  {
    title: "Advanced & Coming Soon",
    description: "Power-user tools stay visible here, while unfinished IFR-critical features remain clearly marked until they are ready.",
    cards: [
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
        title: "GPS Trainers",
        description: "RSF GPS training units and interactive cockpit workflow practice.",
        href: "/gps-sims",
        cta: "Coming soon",
        icon: Route,
        badge: "Coming soon",
        comingSoon: true,
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
];

export default function ToolHub() {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    trackEvent("tool_hub_view");
  }, []);

  const featuredStarts = [
    {
      title: "Find aircraft, schools, and instructors",
      description: "Start with the marketplace, rentals, or CFI directory when you need access, training, or services.",
      href: "/marketplace",
      cta: "Start with listings",
    },
    {
      title: "Build a route before you go",
      description: "Check conditions, review airspace, and work through the planner before the flight leaves the page.",
      href: "/flight-planner",
      cta: "Build route",
    },
    {
      title: "Keep your flying records current",
      description: "Use the digital logbook to keep flights, training history, and endorsements together.",
      href: "/logbook",
      cta: "Open logbook",
    },
  ];

  return (
    <div className="min-h-screen">
      <section className="border-b border-white/10 bg-[linear-gradient(135deg,hsl(221_66%_19%),hsl(221_74%_34%))] py-10 text-slate-100 shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]">
        <div className="container mx-auto px-4 space-y-4">
          <span className="rsf-kicker border-white/10 bg-white/10 text-slate-100">Pilot guide</span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">Find what you need, then use the right RSF tool next.</h1>
          <p className="max-w-3xl text-slate-300">
            Use RSF in the same order pilots actually work: find aircraft or people first, plan the flight, then train or keep records without jumping between products.
          </p>
          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200/90">
            <span className="rounded-full border border-white/14 bg-white/8 px-3 py-1">Marketplace first</span>
            <span className="rounded-full border border-white/14 bg-white/8 px-3 py-1">Planning support</span>
            <span className="rounded-full border border-white/14 bg-white/8 px-3 py-1">Training and records</span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              asChild
              className="w-full sm:w-auto"
              onClick={() => trackEvent("tool_hub_click", { target: "/marketplace" })}
            >
              <Link href="/marketplace">Open Marketplace</Link>
            </Button>
            <Button
              variant="outline"
              asChild
              className="w-full border-slate-300/20 bg-white/5 text-slate-100 hover:bg-white/10 sm:w-auto"
              onClick={() => trackEvent("tool_hub_click", { target: "/rentals" })}
            >
              <Link href="/rentals">Browse Rentals</Link>
            </Button>
            <Button
              variant="outline"
              asChild
              className="w-full border-slate-300/20 bg-white/5 text-slate-100 hover:bg-white/10 sm:w-auto"
              onClick={() => trackEvent("tool_hub_click", { target: "/flight-planner" })}
            >
              <Link href="/flight-planner">Open Flight Planner</Link>
            </Button>
            <div className="flex items-center">
              <Badge variant="secondary" className="border-0 bg-white/10 text-slate-200 shadow-none">All tools &amp; features</Badge>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8 sm:py-10 space-y-8 sm:space-y-10">
        <div className="rounded-[1.6rem] border border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.96),rgba(255,255,255,0.7))] p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="rsf-kicker">Most pilots start here</span>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Three ways to use RSF without hunting through every page.</h2>
            </div>
            <p className="max-w-xl text-sm text-muted-foreground">
              These are the three fastest paths through the site: find listings, build a route, or go straight to the logbook.
            </p>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {featuredStarts.map((item) => (
              <div
                key={item.title}
                className="rounded-[1.25rem] border border-primary/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0.58))] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
              >
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                <Button
                  asChild
                  className="mt-4 w-full sm:w-auto"
                  onClick={() => trackEvent("tool_hub_click", { target: item.href })}
                >
                  <Link href={item.href}>{item.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>

        {toolSections.map((section) => (
          <div key={section.title} className="space-y-4">
            <div className="space-y-2 border-l-4 border-primary pl-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">RSF guide section</div>
              <h2 className="text-2xl font-semibold">{section.title}</h2>
              <p className="max-w-3xl text-sm text-muted-foreground">{section.description}</p>
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
                      !card.accent && !card.comingSoon ? "border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.97),rgba(255,255,255,0.58))]" : "",
                      card.accent ? "border-primary/34 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--primary)/0.12))]" : "",
                      card.comingSoon ? "border-dashed border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.74),hsl(var(--muted)/0.74))] text-muted-foreground opacity-70" : "",
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
