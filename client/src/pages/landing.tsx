import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { BannerAdRotation } from "@/components/banners/BannerAdRotation";
import { FeaturedPartnerToolCard } from "@/components/partners/FeaturedPartnerToolCard";
import { BookOpen, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Plane, Smartphone, CheckCircle2, AlertTriangle, Tent, UtensilsCrossed, Home, Anchor, Wrench, Calculator, ShoppingBag, FileText, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useRef, useState } from "react";
import av8mapsLogo from "@assets/Av8Maps.JPG";
import rsfPromoVideo from "@assets/rsf-video-2026-02-28.mp4";
import { membershipPlanOptions, membershipTierInfo } from "@shared/membership-plans";

interface WeatherData {
  icao: string;
  metar: any;
  taf: any;
  timestamp: number;
  cached: boolean;
}

interface AirportSearchResult {
  icao: string;
  name?: string | null;
  city?: string | null;
  state?: string | null;
}

type LandingModuleId = "conditions" | "cfi" | "partner" | "events";

const ICAO_REGEX = /^[A-Z0-9]{3,4}$/;
const AV8MAPS_EMBED_ENABLED =
  String(import.meta.env.VITE_AV8MAPS_EMBED_ENABLED ?? "false").toLowerCase() === "true";
const AV8MAPS_EMBED_URL = (import.meta.env.VITE_AV8MAPS_EMBED_URL || "").trim();

function parseFlightCategory(metar: any): { category: string; color: string } {
  if (!metar) return { category: "UNKNOWN", color: "gray" };
  const raw = metar.rawOb || "";
  const visMatch = raw.match(/\s(\d{1,2})SM/);
  const visibility = visMatch ? parseInt(visMatch[1]) : 10;
  const ceilingMatch = raw.match(/(BKN|OVC)(\d{3})/);
  const ceiling = ceilingMatch ? parseInt(ceilingMatch[2]) * 100 : 10000;
  if (ceiling >= 3000 && visibility > 5) return { category: "VFR", color: "green" };
  if (ceiling >= 1000 && visibility >= 3) return { category: "MVFR", color: "blue" };
  if (ceiling >= 500 && visibility >= 1) return { category: "IFR", color: "red" };
  return { category: "LIFR", color: "purple" };
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

function extractAtisIdentifier(metar: any): string | null {
  if (!metar?.rawOb) return null;
  const raw = metar.rawOb;
  const infoMatch = raw.match(/\bINFO\s+([A-Z])\b/i);
  if (infoMatch) return `Information ${infoMatch[1].toUpperCase()}`;
  const atisMatch = raw.match(/\bATIS\s+([A-Z])\b/i);
  if (atisMatch) return `Information ${atisMatch[1].toUpperCase()}`;
  const rmkIndex = raw.indexOf("RMK");
  if (rmkIndex !== -1) {
    const afterRmk = raw.substring(rmkIndex);
    const endMatch = afterRmk.match(/\s([A-Z])\s*$/);
    if (endMatch) return `Information ${endMatch[1]}`;
  }
  return null;
}

function extractRunwayInUse(metar: any): string | null {
  if (!metar?.rawOb) return null;
  const raw = metar.rawOb;
  const rwyMatch = raw.match(/\b(?:RWY|RUNWAY)\s+(\d{2}[LCR]?(?:\s*(?:AND|\/|&)\s*\d{2}[LCR]?)*)/i);
  if (rwyMatch) return rwyMatch[1].replace(/\s+/g, " ").trim();
  const arrRwyMatch = raw.match(/\bARR\s+(?:RWY|RUNWAY)\s+(\d{2}[LCR]?)/i);
  const depRwyMatch = raw.match(/\bDEP\s+(?:RWY|RUNWAY)\s+(\d{2}[LCR]?)/i);
  if (arrRwyMatch || depRwyMatch) {
    const runways = [];
    if (arrRwyMatch) runways.push(`${arrRwyMatch[1]} (arr)`);
    if (depRwyMatch) runways.push(`${depRwyMatch[1]} (dep)`);
    return runways.join(", ");
  }
  return null;
}

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const { data: eventsData } = useQuery({
    queryKey: ["aviation-events", "feed"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/events"));
      if (!response.ok) {
        return { events: [] };
      }
      return response.json();
    },
  });
  const events = eventsData?.events ?? [];
  const feedEvents = events.slice(0, 10);
  const formatEventRange = (start: string, end: string) => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    });
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "";
    if (startDate.toDateString() === endDate.toDateString()) {
      return formatter.format(startDate);
    }
    return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
  };
  const eventsScrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollActiveRef = useRef(false);
  const [eventsHovering, setEventsHovering] = useState(false);
  const [autoPauseUntil, setAutoPauseUntil] = useState(0);
  const [openLandingModules, setOpenLandingModules] = useState<LandingModuleId[]>([]);
  const [icaoInput, setIcaoInput] = useState("KAUS");
  const [searchIcao, setSearchIcao] = useState("KAUS");
  const [airportSuggestions, setAirportSuggestions] = useState<AirportSearchResult[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const av8mapsTiles = useMemo(
    () => [
      {
        title: "Fly-in Camping",
        description: "Discover aviation-friendly camping spots and overnight adventures.",
        slug: "fly-in-camping",
        dest: "fly-in-camping",
        icon: <Tent className="h-4 w-4" />,
      },
      {
        title: "Fly-in Restaurants",
        description: "Plan a meal stop with pilot-loved dining destinations.",
        slug: "fly-in-restaurants",
        dest: "fly-in-restaurants",
        icon: <UtensilsCrossed className="h-4 w-4" />,
      },
      {
        title: "Vacation Rentals & Hotels",
        description: "Stay close to the ramp with aviation-friendly lodging options.",
        slug: "vacation-rentals-hotels",
        dest: "vacation-rentals-hotels",
        icon: <Home className="h-4 w-4" />,
      },
      {
        title: "Find an AME",
        description: "Locate aviation medical examiners near your route.",
        slug: "find-an-ame",
        dest: "find-an-ame",
        icon: <Wrench className="h-4 w-4" />,
      },
      {
        title: "Fly-ins & Events",
        description: "Browse upcoming fly-ins, meetups, and aviation events.",
        slug: "fly-ins-events",
        dest: "fly-ins-events",
        icon: <CalendarDays className="h-4 w-4" />,
      },
      {
        title: "Seaplane Destinations",
        description: "Explore water-accessible locations and seaplane getaways.",
        slug: "seaplane-destinations",
        dest: "seaplane-destinations",
        icon: <Anchor className="h-4 w-4" />,
      },
    ],
    []
  );

  const { data: weather, isLoading: weatherLoading } = useQuery<WeatherData>({
    queryKey: [`/api/aviation-weather/${searchIcao}`],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/aviation-weather/${searchIcao}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch weather data");
      return res.json();
    },
    enabled: Boolean(searchIcao),
    staleTime: 1000 * 60 * 10,
  });

  const { data: airportMeta } = useQuery<AirportSearchResult | null>({
    queryKey: ["/api/airports/search", searchIcao, "exact"],
    queryFn: async () => {
      if (!searchIcao) return null;
      const res = await fetch(apiUrl(`/api/airports/search?q=${encodeURIComponent(searchIcao)}`));
      if (!res.ok) return null;
      const results = (await res.json()) as AirportSearchResult[];
      if (!results?.length) return null;
      const upper = searchIcao.toUpperCase();
      return results.find((item) => item.icao?.toUpperCase() === upper) ?? results[0] ?? null;
    },
    enabled: Boolean(searchIcao),
    staleTime: 1000 * 60 * 30,
  });

  const { data: runwayBriefing, isLoading: runwayLoading } = useQuery<{
    icao: string;
    runwayInUse: string | null;
    advisory: { runway: string; heading: number; headwind: number; crosswind: number } | null;
    runways: Array<{
      leIdent: string | null;
      heIdent: string | null;
      lengthFt: number | null;
      surface: string | null;
    }>;
  }>({
    queryKey: [`/api/airports/${searchIcao}/runway-briefing`],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/airports/${searchIcao}/runway-briefing`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch runway briefing");
      return res.json();
    },
    enabled: Boolean(searchIcao),
    staleTime: 1000 * 60 * 10,
  });

  const { data: notams, isLoading: notamsLoading, isError: notamsError } = useQuery<{
    icao: string;
    notams: Array<{ id: string; text: string; effective?: string; expires?: string }>;
  }>({
    queryKey: ["/api/notams", searchIcao],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/notams?icao=${searchIcao}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch NOTAMs");
      return res.json();
    },
    enabled: Boolean(searchIcao),
    staleTime: 1000 * 60 * 5,
  });

  const flightCategory = parseFlightCategory(weather?.metar);
  const runwayInUseDisplay =
    runwayBriefing?.runwayInUse || extractRunwayInUse(weather?.metar) || null;
  const atisInfo = extractAtisIdentifier(weather?.metar);
  const airportLocation = [airportMeta?.city, airportMeta?.state].filter(Boolean).join(", ");
  const airportDescriptor = [
    airportMeta?.name ?? null,
    airportLocation ? `(${airportLocation})` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const airportTitleBase = weather?.icao || searchIcao;
  const conditionsTitle = `${airportTitleBase}${
    airportDescriptor ? ` - ${airportDescriptor}` : ""
  } - Current Conditions`;
  const proMonthly = membershipPlanOptions.pro.find((plan) => plan.interval === "monthly")?.price;
  const proPlusMonthly = membershipPlanOptions.pro_plus.find((plan) => plan.interval === "monthly")?.price;

  const submitIcao = () => {
    const normalized = icaoInput.trim().toUpperCase();
    if (!ICAO_REGEX.test(normalized)) return;
    setSearchIcao(normalized);
  };

  const applySuggestion = (suggestion: AirportSearchResult) => {
    const normalized = suggestion.icao.toUpperCase();
    setIcaoInput(normalized);
    setSearchIcao(normalized);
    setAirportSuggestions([]);
  };

  useEffect(() => {
    const trimmed = icaoInput.trim();
    const normalized = trimmed.toUpperCase();
    if (trimmed.length < 2 || ICAO_REGEX.test(normalized)) {
      setAirportSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    const handle = window.setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(apiUrl(`/api/airports/search?q=${encodeURIComponent(trimmed)}`));
        if (!res.ok) throw new Error("Failed to search airports");
        const results = (await res.json()) as AirportSearchResult[];
        setAirportSuggestions(results.slice(0, 6));
      } catch {
        setAirportSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 250);

    return () => window.clearTimeout(handle);
  }, [icaoInput]);

  const pauseAutoScroll = (ms = 8000) => {
    setAutoPauseUntil(Date.now() + ms);
  };

  const scrollEvents = (direction: "left" | "right") => {
    const container = eventsScrollRef.current;
    if (!container) return;
    const delta = container.clientWidth * 0.75;
    pauseAutoScroll();
    container.scrollBy({ left: direction === "left" ? -delta : delta, behavior: "smooth" });
  };

  useEffect(() => {
    const container = eventsScrollRef.current;
    if (!container || feedEvents.length <= 1) return;
    let rafId = 0;
    let lastTime = 0;
    const speedPxPerSec = 26;
    const setAutoScrollState = (active: boolean) => {
      if (autoScrollActiveRef.current === active) return;
      autoScrollActiveRef.current = active;
      container.style.scrollSnapType = active ? "none" : "x mandatory";
      container.style.scrollBehavior = active ? "auto" : "smooth";
    };

    const tick = (time: number) => {
      if (!container) return;
      const shouldScroll = !eventsHovering && Date.now() >= autoPauseUntil;
      if (!shouldScroll) {
        setAutoScrollState(false);
        lastTime = time;
        rafId = window.requestAnimationFrame(tick);
        return;
      }
      setAutoScrollState(true);
      if (!lastTime) lastTime = time;
      const deltaSec = (time - lastTime) / 1000;
      lastTime = time;
      const maxScroll = container.scrollWidth - container.clientWidth;
      if (maxScroll > 0) {
        let next = container.scrollLeft + speedPxPerSec * deltaSec;
        if (next >= maxScroll - 4) {
          next = 0;
        }
        container.scrollLeft = next;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      container.style.scrollSnapType = "";
      container.style.scrollBehavior = "";
    };
  }, [feedEvents.length, eventsHovering, autoPauseUntil]);

  const toggleLandingModule = (moduleId: LandingModuleId) => {
    setOpenLandingModules((current) => {
      const next = current.includes(moduleId)
        ? current.filter((item) => item !== moduleId)
        : [...current, moduleId];
      trackEvent("landing_module_toggle", {
        module: moduleId,
        state: next.includes(moduleId) ? "open" : "closed",
      });
      return next;
    });
  };

  useEffect(() => {
    trackEvent("starting_point_section_view");
  }, []);
  
  return (
    <div className="min-h-screen">
      <BannerAdRotation 
        placement="home" 
        className="container mx-auto px-4 pt-6 sm:pt-8 max-w-7xl mb-10 sm:mb-14"
      />

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-[linear-gradient(180deg,hsl(var(--primary)/0.16),transparent_72%)]">
        <div className="container mx-auto px-4 py-12 sm:py-20">
          <div className="max-w-4xl mx-auto text-center space-y-4 sm:space-y-6">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
              Ready Set Fly
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground px-4">
              Find rentals, instructors, and aviation services. Keep the tools close.
            </p>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              Ready Set Fly is a marketplace-first aviation platform for pilots who need rentals, CFIs, flight schools, and aviation services in one place.
            </p>
            <p className="text-sm sm:text-base text-muted-foreground max-w-3xl mx-auto px-4">
              The built-in planner, digital logbook, current conditions, and training tools are here to keep users engaged after they land on the marketplace and need to keep working.
            </p>
            <p className="text-sm sm:text-base font-semibold text-primary">
              Find first. Plan second. Train and track when you are ready.
            </p>
            <Badge variant="outline" className="mx-auto text-xs px-3 py-1">
              Available for US Residents Only
            </Badge>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" asChild data-testid="button-marketplace">
                <Link
                  href="/marketplace"
                  onClick={() => trackEvent("cta_click", { label: "landing_marketplace", target: "/marketplace" })}
                >
                  Explore marketplace
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild data-testid="button-rentals">
                <Link
                  href="/rentals"
                  onClick={() => trackEvent("cta_click", { label: "landing_rentals", target: "/rentals" })}
                >
                  Browse rentals
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild data-testid="button-plan-flight">
                <Link
                  href="/flight-planner"
                  onClick={() => trackEvent("cta_click", { label: "landing_plan_flight", target: "/flight-planner" })}
                >
                  Open flight planner
                </Link>
              </Button>
            </div>
          </div>
      </div>
      </div>

      <div className="rsf-section-band py-8 sm:py-10">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="overflow-hidden border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.97),hsl(var(--muted)/0.78))]">
              <CardContent className="p-5 sm:p-6">
                <div className="mb-5 flex items-center justify-between rounded-[1rem] border border-white/10 bg-[linear-gradient(135deg,hsl(221_64%_23%),hsl(221_72%_38%))] px-4 py-3 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-200">Operations Deck</div>
                    <div className="text-sm text-slate-200">Marketplace entry points first, support tools second</div>
                  </div>
                  <Badge variant="secondary" className="border-0 bg-white/10 text-slate-100 shadow-none">Find • Plan • Track</Badge>
                </div>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-2">
                    <span className="rsf-kicker">Quick Start Index</span>
                    <h2 className="text-2xl sm:text-3xl font-semibold">Start With What You Need Right Now</h2>
                    <p className="text-sm sm:text-base text-muted-foreground max-w-3xl">
                      Use RSF to find aviation services first, then keep planning, logging, and training in the same workflow.
                    </p>
                  </div>
                  <Button asChild variant="outline">
                    <Link
                      href="/tool-hub"
                      onClick={() => trackEvent("cta_click", { label: "quick_index_view_all_tools", target: "/tool-hub" })}
                    >
                      View all tools &amp; features
                    </Link>
                  </Button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Card className="border-primary/30 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--primary)/0.12))]">
                    <CardContent className="flex min-h-[164px] flex-col justify-between p-5">
                      <div className="space-y-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80">Find</div>
                        <div className="flex items-center gap-2 text-base font-semibold">
                        <ShoppingBag className="h-5 w-5 text-primary" />
                        Marketplace
                        </div>
                        <p className="text-sm text-muted-foreground">Find CFIs, flight schools, jobs, charter, and aviation services.</p>
                      </div>
                      <Button asChild size="sm" className="w-full">
                        <Link
                          href="/marketplace"
                          onClick={() => trackEvent("cta_click", { label: "quick_index_marketplace", target: "/marketplace" })}
                        >
                          Open
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-primary/28 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--primary)/0.1))]">
                    <CardContent className="flex min-h-[164px] flex-col justify-between p-5">
                      <div className="space-y-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80">Find</div>
                        <div className="flex items-center gap-2 text-base font-semibold">
                          <Plane className="h-5 w-5" />
                        Rentals
                        </div>
                        <p className="text-sm text-muted-foreground">Browse aircraft access and school-related rental options.</p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="w-full">
                        <Link
                          href="/rentals"
                          onClick={() => trackEvent("cta_click", { label: "quick_index_rentals", target: "/rentals" })}
                        >
                          Open
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-[hsl(var(--accent)/0.34)] bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--accent)/0.12))]">
                    <CardContent className="flex min-h-[164px] flex-col justify-between p-5">
                      <div className="space-y-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--accent))]">Connect</div>
                        <div className="flex items-center gap-2 text-base font-semibold">
                          <Users className="h-5 w-5" />
                        CFI Directory
                        </div>
                        <p className="text-sm text-muted-foreground">Compare instructor profiles and connect with CFIs on RSF.</p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="w-full">
                        <Link
                          href="/cfi"
                          onClick={() => trackEvent("cta_click", { label: "quick_index_cfi_directory", target: "/cfi" })}
                        >
                          Open
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-900/18 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),rgba(22,32,42,0.1))]">
                    <CardContent className="flex min-h-[164px] flex-col justify-between p-5">
                      <div className="space-y-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-700/90 dark:text-slate-300/80">Plan</div>
                        <div className="flex items-center gap-2 text-base font-semibold">
                          <Plane className="h-5 w-5" />
                        Flight Planner
                        </div>
                        <p className="text-sm text-muted-foreground">Route, fuel, timing, alternates, and day-of-flight planning flow.</p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="w-full">
                        <Link
                          href="/flight-planner"
                          onClick={() => trackEvent("cta_click", { label: "quick_index_flight_planner", target: "/flight-planner" })}
                        >
                          Open
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-primary/22 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--primary)/0.08))]">
                    <CardContent className="flex min-h-[164px] flex-col justify-between p-5">
                      <div className="space-y-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/70">Track</div>
                        <div className="flex items-center gap-2 text-base font-semibold">
                          <FileText className="h-5 w-5" />
                        Digital Logbook
                        </div>
                        <p className="text-sm text-muted-foreground">Keep flights, endorsements, signoffs, and currency in one record.</p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="w-full">
                        <Link
                          href="/logbook"
                          onClick={() => trackEvent("cta_click", { label: "quick_index_digital_logbook", target: "/logbook" })}
                        >
                          Open
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-accent/34 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--accent)/0.14))]">
                    <CardContent className="flex min-h-[164px] flex-col justify-between p-5">
                      <div className="space-y-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-700/80 dark:text-slate-300/80">Brief</div>
                        <div className="flex items-center gap-2 text-base font-semibold">
                          <AlertTriangle className="h-5 w-5" />
                        TFR + NOTAM Map
                        </div>
                        <p className="text-sm text-muted-foreground">Review restrictions, NOTAM awareness, and active airspace overlays.</p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="w-full">
                        <Link
                          href="/tfr-map"
                          onClick={() => trackEvent("cta_click", { label: "quick_index_tfr_map", target: "/tfr-map" })}
                        >
                          Open
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-4 overflow-hidden rounded-[1rem] border border-white/10 bg-[linear-gradient(180deg,hsl(221_52%_19%),hsl(221_34%_15%))] shadow-[var(--shadow-rsf-panel)]">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-slate-300">
                    <span>RSF walkthrough</span>
                    <span className="text-slate-400">Muted overview</span>
                  </div>
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    aria-label="Ready Set Fly overview video"
                    className="h-full min-h-[240px] w-full object-cover"
                  >
                    <source src={rsfPromoVideo} type="video/mp4" />
                  </video>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.97),hsl(var(--muted)/0.74))]">
              <CardContent className="p-5 sm:p-6">
                <div className="text-center space-y-3">
                  <span className="rsf-kicker mx-auto">RSF Memberships</span>
                  <h2 className="text-2xl sm:text-3xl font-semibold">RSF Free vs Pro Core vs Pro+</h2>
                  <p className="text-sm sm:text-base text-muted-foreground max-w-3xl mx-auto">
                    Start with a free account for marketplace browsing and open tools. Upgrade when you want saved workflow, tracked records, and two full weeks to test the paid tier before billing.
                  </p>
                </div>

                <div className="mt-6 grid gap-4">
                  <Card className="border-white/16 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),rgba(255,255,255,0.62))]">
                    <CardHeader>
                      <CardTitle className="text-lg">RSF Free</CardTitle>
                      <CardDescription>Marketplace access and open tools, no credit card required.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-3xl font-bold">$0<span className="text-sm text-muted-foreground">/mo</span></div>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                          Browse marketplace, rentals, and CFI directory without paying first.
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                          Use current conditions, TFR/NOTAM awareness, and core planning tools.
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                          Create an account to save favorites, contact faster, and start basic planning.
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="border-primary/40 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--primary)/0.12))]">
                    <CardHeader>
                      <Badge className="w-fit">Most Popular</Badge>
                      <CardTitle className="text-lg">{membershipTierInfo.pro.title}</CardTitle>
                      <CardDescription>{membershipTierInfo.pro.subtitle}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-3xl font-bold">
                        ${proMonthly?.toFixed(2) ?? "5.99"}
                        <span className="text-sm text-muted-foreground">/mo</span>
                      </div>
                      <p className="text-xs font-medium text-emerald-600">14-day free trial on monthly billing</p>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {membershipTierInfo.pro.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <Button asChild className="w-full">
                        <Link href="/logbook/pro">Upgrade to Pro</Link>
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-[hsl(var(--accent)/0.32)] bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--accent)/0.11))]">
                    <CardHeader>
                      <Badge variant="secondary" className="w-fit">Power Pilot</Badge>
                      <CardTitle className="text-lg">{membershipTierInfo.pro_plus.title}</CardTitle>
                      <CardDescription>{membershipTierInfo.pro_plus.subtitle}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-3xl font-bold">
                        ${proPlusMonthly?.toFixed(2) ?? "11.99"}
                        <span className="text-sm text-muted-foreground">/mo</span>
                      </div>
                      <p className="text-xs font-medium text-emerald-600">14-day free trial on monthly billing</p>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {membershipTierInfo.pro_plus.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <Button asChild variant="outline" className="w-full">
                        <Link href="/logbook/pro">Upgrade to Pro+</Link>
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="py-10 sm:py-12">
        <div className="container mx-auto px-4">
          <Card className="overflow-hidden border-white/12 bg-[linear-gradient(180deg,hsl(221_54%_18%/0.82),hsl(221_42%_15%/0.88))] text-slate-100 shadow-[var(--shadow-rsf-panel)]">
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <span className="rsf-kicker border-white/12 bg-white/8 text-slate-100">Operational Modules</span>
                  <h2 className="text-2xl sm:text-3xl font-semibold">Open the next section when you need it</h2>
                  <p className="max-w-3xl text-sm text-slate-200/85 sm:text-base">
                    Where do you want to go next?.
                  </p>
                </div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Reveal workflow</div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    id: "conditions" as LandingModuleId,
                    title: "Current Conditions",
                    description: "Weather, runway guidance, and NOTAM briefing",
                  },
                  {
                    id: "cfi" as LandingModuleId,
                    title: "Create Your CFI Profile",
                    description: "Instructor directory and profile setup",
                  },
                  {
                    id: "partner" as LandingModuleId,
                    title: "Featured Partner Tool",
                    description: "Destination planning with Av8Maps",
                  },
                  {
                    id: "events" as LandingModuleId,
                    title: "Community Calendar",
                    description: "Fly-ins, safety seminars, and aviation events",
                  },
                ].map((module) => {
                  const isOpen = openLandingModules.includes(module.id);
                  return (
                    <button
                      key={module.id}
                      type="button"
                      onClick={() => toggleLandingModule(module.id)}
                      className="rounded-[1rem] border border-white/12 bg-white/6 p-4 text-left transition-colors hover:bg-white/10"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-slate-50">{module.title}</div>
                          <div className="text-xs text-slate-300">{module.description}</div>
                        </div>
                        {isOpen ? <ChevronUp className="mt-0.5 h-4 w-4 text-slate-200" /> : <ChevronDown className="mt-0.5 h-4 w-4 text-slate-200" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Current Conditions */}
      {openLandingModules.includes("conditions") && (
      <div className="pb-10 sm:pb-12">
        <div className="container mx-auto px-4 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-semibold">Current Conditions</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Live weather and airport conditions for quick planning context.
            </p>
          </div>

          <Card className="border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.97),hsl(var(--muted)/0.7))]">
            <CardContent className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                  <Label htmlFor="landing-icao" className="text-sm font-semibold">
                    Airport ICAO
                  </Label>
                  <div className="relative max-w-xs">
                    <Input
                      id="landing-icao"
                      value={icaoInput}
                      onChange={(event) => setIcaoInput(event.target.value)}
                      onBlur={submitIcao}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          submitIcao();
                        }
                      }}
                      placeholder="KAUS or Austin, TX"
                    />
                    {(loadingSuggestions || airportSuggestions.length > 0) && (
                      <div className="absolute z-20 mt-2 w-full rounded-md border bg-background shadow-sm">
                        {loadingSuggestions ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">Searching airports...</div>
                        ) : (
                          <ul className="max-h-56 overflow-auto">
                            {airportSuggestions.map((suggestion) => (
                              <li key={suggestion.icao}>
                                <button
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => applySuggestion(suggestion)}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60"
                                >
                                  <div className="font-semibold">{suggestion.icao}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {suggestion.name}
                                    {suggestion.city ? ` â€¢ ${suggestion.city}` : ""}
                                    {suggestion.state ? `, ${suggestion.state}` : ""}
                                  </div>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    {airportMeta && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {airportMeta.name ?? "Unknown airport"}
                        {airportLocation ? ` (${airportLocation})` : ""}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={submitIcao}
                  disabled={!ICAO_REGEX.test(icaoInput.trim().toUpperCase())}
                >
                  Update conditions
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card id="airport-weather" className="border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.97),hsl(var(--primary)/0.09))]">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle>{conditionsTitle}</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="secondary"
                      className={`text-white ${
                        flightCategory.color === "green"
                          ? "bg-green-600"
                          : flightCategory.color === "blue"
                          ? "bg-blue-600"
                          : flightCategory.color === "red"
                          ? "bg-red-600"
                          : "bg-purple-600"
                      }`}
                    >
                      {flightCategory.category}
                    </Badge>
                    {runwayInUseDisplay && (
                      <Badge variant="outline" className="bg-primary/10 text-primary">
                        Active RWY: {runwayInUseDisplay}
                      </Badge>
                    )}
                    {atisInfo && (
                      <Badge variant="outline" className="bg-sky-100 text-sky-800">
                        ATIS: {atisInfo}
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription className="flex items-center gap-2 flex-wrap">
                  {weather?.metar && (
                    <span className="text-xs">
                      Updated: {formatTimeAgo(new Date(weather.metar.obsTime).getTime())}
                    </span>
                  )}
                  {weather?.cached && <Badge variant="secondary" className="text-xs">Cached</Badge>}
                  {weatherLoading && <Badge variant="secondary">Loading</Badge>}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {weather?.metar ? (
                  <div>
                    <Label className="text-sm font-semibold">METAR</Label>
                    <p className="font-mono text-sm bg-muted p-3 rounded-md mt-1">
                      {weather.metar.rawOb}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No METAR data available.
                  </p>
                )}

                <Separator />

                {weather?.taf ? (
                  <div>
                    <Label className="text-sm font-semibold">TAF (Forecast)</Label>
                    <p className="font-mono text-sm bg-muted p-3 rounded-md mt-1 whitespace-pre-wrap">
                      {weather.taf.rawTAF}
                    </p>
                  </div>
                ) : (
                  <div>
                    <Label className="text-sm font-semibold">TAF (Forecast)</Label>
                    <p className="text-sm text-muted-foreground mt-1">No TAF data available.</p>
                  </div>
                )}

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>Disclaimer:</strong> Planning use only. Always obtain an official weather briefing before flight.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card id="airport-briefing" className="border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.97),hsl(var(--accent)/0.14))]">
              <CardHeader>
                <CardTitle>Airport Briefing</CardTitle>
                <CardDescription>Runway guidance and live NOTAMs for {searchIcao}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Label className="text-sm font-semibold">Runway Advisory</Label>
                    {runwayLoading && <Badge variant="secondary">Loading runways</Badge>}
                  </div>
                  {(runwayInUseDisplay || atisInfo) && (
                    <div className="flex flex-wrap gap-2">
                      {runwayInUseDisplay && (
                        <Badge variant="outline" className="bg-primary/10 text-primary">
                          Active RWY: {runwayInUseDisplay}
                        </Badge>
                      )}
                      {atisInfo && (
                        <Badge variant="outline" className="bg-sky-100 text-sky-800">
                          ATIS: {atisInfo}
                        </Badge>
                      )}
                    </div>
                  )}
                  {runwayBriefing?.advisory ? (
                    <div className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Recommended: {runwayBriefing.advisory.runway}</Badge>
                        <span className="text-muted-foreground">
                          Headwind {runwayBriefing.advisory.headwind} kt - Crosswind {runwayBriefing.advisory.crosswind} kt
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Advisory only. ATC assigns runways; verify with ATIS and tower.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Runway advisory unavailable. Check ATIS or tower for active runway.
                    </p>
                  )}

                  {runwayBriefing?.runways?.length ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {runwayBriefing.runways.slice(0, 6).map((runway, index) => (
                        <div key={`${runway.leIdent}-${runway.heIdent}-${index}`} className="rounded-lg border p-2 text-xs">
                          <div className="font-semibold">
                            {runway.leIdent || "--"} / {runway.heIdent || "--"}
                          </div>
                          <div className="text-muted-foreground">
                            {runway.surface || "Surface N/A"} - {runway.lengthFt ? `${runway.lengthFt} ft` : "Length N/A"}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Runway details not available.</p>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Label className="text-sm font-semibold">NOTAMs</Label>
                    {notamsLoading && <Badge variant="secondary">Loading NOTAMs</Badge>}
                  </div>
                  {notamsError ? (
                    <p className="text-sm text-muted-foreground">NOTAM feed unavailable.</p>
                  ) : notams?.notams?.length ? (
                    <div className="space-y-2">
                      {notams.notams.slice(0, 6).map((item) => (
                        <div key={item.id} className="rounded-lg border p-3 text-xs space-y-1">
                          <div className="font-semibold">{item.text}</div>
                          {(item.effective || item.expires) && (
                            <div className="text-muted-foreground">
                              {item.effective ? `Effective ${item.effective}` : ""}{" "}
                              {item.expires ? `- Expires ${item.expires}` : ""}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No active NOTAMs.</p>
                  )}
                  <p className="text-xs text-muted-foreground">NOTAMs powered by FAA SWIM.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      )}

      {/* CFI marketplace and featured partner */}
      {(openLandingModules.includes("cfi") || openLandingModules.includes("partner")) && (
      <div className="py-10 sm:py-12">
        <div className="container mx-auto px-4">
          {openLandingModules.includes("cfi") ? (
          <Card className="mt-6 border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.97),hsl(var(--primary)/0.11))]">
            <CardContent className="p-5 sm:p-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4 max-w-3xl">
                <div className="space-y-2">
                  <span className="rsf-kicker">CFI Marketplace</span>
                  <div className="flex items-center gap-2 text-base sm:text-lg font-semibold">
                    <BookOpen className="h-5 w-5 text-primary" />
                    CFI Instructors: Create your RSF profile
                  </div>
                  <p className="text-sm text-muted-foreground max-w-2xl">
                    Get discovered by student pilots, highlight your ratings, set your training focus, and accept booking requests through the CFI marketplace.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    "Create a free RSF account or sign in",
                    "Build your instructor profile with ratings and specialties",
                    "Appear in the directory and receive student inquiries",
                  ].map((item) => (
                    <div key={item} className="rounded-[0.9rem] border border-primary/15 bg-background/70 p-3 text-sm text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[260px]">
                <Button variant="outline" asChild>
                  <Link
                    href="/cfi"
                    onClick={() => trackEvent("cta_click", { label: "landing_cfi_directory", target: "/cfi" })}
                  >
                    View CFI directory
                  </Link>
                </Button>
                <Button asChild>
                  <Link
                    href={isAuthenticated ? "/dashboard/cfi" : "/register"}
                    onClick={() =>
                      trackEvent("cta_click", {
                        label: isAuthenticated ? "landing_cfi_create_profile" : "landing_cfi_register",
                        target: isAuthenticated ? "/dashboard/cfi" : "/register",
                      })
                    }
                  >
                    {isAuthenticated ? "Create your profile" : "Create free account"}
                  </Link>
                </Button>
                {!isAuthenticated ? (
                  <Button variant="ghost" asChild>
                    <Link
                      href="/login"
                      onClick={() => trackEvent("cta_click", { label: "landing_cfi_sign_in", target: "/login" })}
                    >
                      Already have an account? Sign in
                    </Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
          ) : null}
          {openLandingModules.includes("partner") ? (
            <FeaturedPartnerToolCard
              className="mt-6 mx-auto w-full md:w-2/3"
              partnerKey="av8maps"
              title="Av8Maps - Nationwide GA Destination Maps"
              description="Choose your next flight destination with fly-in camping, restaurants, aviation-friendly stays, and more."
              logoSrc={av8mapsLogo}
              ctaLabel="Explore Av8Maps"
              outboundPath="/out/av8maps"
              placement="home_featured_partner_card"
              source="home_featured_partner_card"
              badgeLabel="Featured Partner Tool"
              embedEnabled={AV8MAPS_EMBED_ENABLED}
              embedUrl={AV8MAPS_EMBED_URL || undefined}
              tiles={av8mapsTiles}
            />
          ) : null}
        </div>
      </div>
      )}

      {/* Aviation Events Feed */}
      {openLandingModules.includes("events") && (
      <div className="py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Community Calendar
              </div>
              <h2 className="text-2xl font-semibold">Upcoming Aviation Events</h2>
              <p className="text-sm text-muted-foreground">
                Share fly-ins, safety seminars, and airshows with the RSF community.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/events">View all events</Link>
            </Button>
          </div>

          {feedEvents.length ? (
            <div className="relative mt-6 rounded-[1.3rem] border border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.97),hsl(var(--muted)/0.68))] shadow-[var(--shadow-rsf-panel)]">
              <div className="absolute -left-4 top-1/2 z-10 hidden -translate-y-1/2 sm:flex">
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Scroll events left"
                  onClick={() => scrollEvents("left")}
                  className="h-10 w-10 rounded-full shadow-lg"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              <div className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 sm:flex">
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Scroll events right"
                  onClick={() => scrollEvents("right")}
                  className="h-10 w-10 rounded-full shadow-lg"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div
                ref={eventsScrollRef}
                onMouseEnter={() => setEventsHovering(true)}
                onMouseLeave={() => setEventsHovering(false)}
                onPointerDown={() => pauseAutoScroll()}
                onTouchStart={() => pauseAutoScroll()}
                className="events-scroll flex gap-4 overflow-x-auto px-4 py-4 scroll-smooth snap-x snap-mandatory"
              >
                {feedEvents.map((event: any) => (
                  <Link
                    key={event.id}
                    href="/events"
                    onClick={() => trackEvent("cta_click", { label: "events_feed", target: "/events" })}
                  >
                    <div className="min-w-[260px] snap-start overflow-hidden rounded-[1rem] border border-white/14 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),rgba(255,255,255,0.66))] shadow-sm transition-shadow hover:shadow-[var(--shadow-rsf-panel)]">
                      {event.imageUrl && (
                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          className="h-28 w-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="p-4">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline">{event.category}</Badge>
                          {event.isSample && (
                            <Badge variant="secondary" className="text-[10px]">
                              SAMPLE
                            </Badge>
                          )}
                        </div>
                        <div className="mt-3 font-semibold">{event.title}</div>
                        <div className="text-xs text-muted-foreground">{formatEventRange(event.startDate, event.endDate)}</div>
                        <div className="text-xs text-muted-foreground mt-1">{event.location}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <Card className="mt-6">
              <CardContent className="p-6 text-sm text-muted-foreground">
                No events posted yet. Add a fly-in or safety seminar to kick things off.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      )}

      {/* Mobile App Section */}
      <div className="py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                  {/* Content Side */}
                  <div className="p-6 sm:p-8 lg:p-12 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Smartphone className="h-6 w-6 text-primary" />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Coming Soon
                      </Badge>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                      Take Ready Set Fly Anywhere
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      Our mobile app is coming soon to iOS and Android. Plan flights, review route analysis,
                      and keep training tools handy on the go.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-sm">Build and review flight plans anywhere</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-sm">Review overviews and training tools on the go</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-sm">Log flights and track currency after landing</span>
                      </div>
                    </div>
                  </div>

                  {/* App Store Badges Side */}
                  <div className="bg-muted/30 p-6 sm:p-8 lg:p-12 flex flex-col justify-center items-center gap-4">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Download on
                    </p>
                    
                    {/* App Store Badge - Placeholder */}
                    <div 
                      className="w-full max-w-[200px] h-[60px] rounded-lg border-2 border-muted flex items-center justify-center bg-background/50 cursor-not-allowed opacity-60"
                      data-testid="badge-app-store"
                    >
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Available Soon</div>
                        <div className="font-semibold">App Store</div>
                      </div>
                    </div>

                    {/* Play Store Badge - Placeholder */}
                    <div 
                      className="w-full max-w-[200px] h-[60px] rounded-lg border-2 border-muted flex items-center justify-center bg-background/50 cursor-not-allowed opacity-60"
                      data-testid="badge-play-store"
                    >
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Available Soon</div>
                        <div className="font-semibold">Google Play</div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground text-center mt-4 max-w-[250px]">
                      Sign up now to be notified when our mobile apps launch
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Admin Login */}
      <div className="py-8">
        <div className="container mx-auto px-4 text-center">
          <Button 
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = apiUrl('/api/auth/google')}
            data-testid="button-admin-login"
            className="text-muted-foreground hover:text-foreground"
          >
            Admin Login
          </Button>
        </div>
      </div>
    </div>
  );
}
