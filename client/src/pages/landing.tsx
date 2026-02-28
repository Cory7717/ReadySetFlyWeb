import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { BannerAdRotation } from "@/components/banners/BannerAdRotation";
import { FeaturedPartnerToolCard } from "@/components/partners/FeaturedPartnerToolCard";
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, Plane, Smartphone, CheckCircle2, AlertTriangle, Tent, UtensilsCrossed, Home, Anchor, Wrench, Calculator, ShoppingBag, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
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
      <div className="relative bg-gradient-to-br from-primary/20 via-background to-background">
        <div className="container mx-auto px-4 py-12 sm:py-20">
          <div className="max-w-4xl mx-auto text-center space-y-4 sm:space-y-6">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
              Ready Set Fly
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground px-4">
              Plan a flight. Get route analysis. Learn and log with confidence.
            </p>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              Ready Set Fly is a planning-first, safety-oriented pilot tool. Training and logging are embedded into the planning flow so risk surfaces earlier and decisions stay sharper.
            </p>
            <p className="text-sm sm:text-base text-muted-foreground max-w-3xl mx-auto px-4">
              RSF is built for pilots who want clearer planning, smarter route decisions, and post-flight reflection -- before any transactions ever enter the picture.
            </p>
            <p className="text-sm sm:text-base font-semibold text-primary">
              Plan first. Train smart. Then connect with rentals and listings.
            </p>
            <Badge variant="outline" className="mx-auto text-xs px-3 py-1">
              Available for US Residents Only
            </Badge>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                size="lg" 
                asChild
                data-testid="button-plan-flight"
              >
                <Link
                  href="/flight-planner"
                  onClick={() => trackEvent("cta_click", { label: "plan_flight", target: "/flight-planner" })}
                >
                  Plan a flight
                </Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                asChild
                data-testid="button-training"
              >
                <Link
                  href="/student"
                  onClick={() => trackEvent("cta_click", { label: "training", target: "/student" })}
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Training tools
                </Link>
              </Button>
            </div>
          </div>
      </div>
      </div>

      <div className="py-8 sm:py-10 bg-muted/10 border-y border-border/40">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-border/50">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-2">
                    <Badge variant="outline" className="text-xs">Quick Start Index</Badge>
                    <h2 className="text-2xl sm:text-3xl font-semibold">Find What RSF Offers Fast</h2>
                    <p className="text-sm sm:text-base text-muted-foreground max-w-3xl">
                      Start with the feature area you need now. Open the full Tool Hub any time for the complete list.
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
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="flex min-h-[164px] flex-col justify-between p-5">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-base font-semibold">
                        <Plane className="h-5 w-5 text-primary" />
                        Flight Planner
                        </div>
                        <p className="text-sm text-muted-foreground">Route, fuel, timing, alternates, and planning flow.</p>
                      </div>
                      <Button asChild size="sm" className="w-full">
                        <Link
                          href="/flight-planner"
                          onClick={() => trackEvent("cta_click", { label: "quick_index_flight_planner", target: "/flight-planner" })}
                        >
                          Open
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="flex min-h-[164px] flex-col justify-between p-5">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-base font-semibold">
                          <AlertTriangle className="h-5 w-5" />
                        TFR + NOTAM Map
                        </div>
                        <p className="text-sm text-muted-foreground">Current restrictions, NOTAM awareness, and active airspace overlays.</p>
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

                  <Card>
                    <CardContent className="flex min-h-[164px] flex-col justify-between p-5">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-base font-semibold">
                          <BookOpen className="h-5 w-5" />
                        Student Tools
                        </div>
                        <p className="text-sm text-muted-foreground">Roadmaps, study aids, progress tracking, and pilot training support.</p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="w-full">
                        <Link
                          href="/student"
                          onClick={() => trackEvent("cta_click", { label: "quick_index_student_tools", target: "/student" })}
                        >
                          Open
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="flex min-h-[164px] flex-col justify-between p-5">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-base font-semibold">
                          <Calculator className="h-5 w-5" />
                        IFR + Calculators
                        </div>
                        <p className="text-sm text-muted-foreground">IFR workflows, training sims, and core pilot calculation tools.</p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="w-full">
                        <Link
                          href="/ifr-tools"
                          onClick={() => trackEvent("cta_click", { label: "quick_index_ifr_tools", target: "/ifr-tools" })}
                        >
                          Open
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="flex min-h-[164px] flex-col justify-between p-5">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-base font-semibold">
                          <ShoppingBag className="h-5 w-5" />
                        Marketplace
                        </div>
                        <p className="text-sm text-muted-foreground">Find CFIs, flight schools, rentals, jobs, and aviation services.</p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="w-full">
                        <Link
                          href="/marketplace"
                          onClick={() => trackEvent("cta_click", { label: "quick_index_marketplace", target: "/marketplace" })}
                        >
                          Open
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="flex min-h-[164px] flex-col justify-between p-5">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-base font-semibold">
                          <FileText className="h-5 w-5" />
                        Digital Logbook
                        </div>
                        <p className="text-sm text-muted-foreground">Track flights, endorsements, signoffs, and progress in your RSF logbook.</p>
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
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-border/60 bg-black shadow-sm">
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

            <Card className="border-border/50">
              <CardContent className="p-5 sm:p-6">
                <div className="text-center space-y-3">
                  <Badge variant="outline" className="mx-auto text-xs">RSF Memberships</Badge>
                  <h2 className="text-2xl sm:text-3xl font-semibold">RSF Free vs Pro Core vs Pro+</h2>
                  <p className="text-sm sm:text-base text-muted-foreground max-w-3xl mx-auto">
                    See exactly what you get when you upgrade. Free tools stay open; Pro adds saves and alerts; Pro+ unlocks operational intelligence.
                  </p>
                </div>

                <div className="mt-6 grid gap-4">
                  <Card className="border-primary/10">
                    <CardHeader>
                      <CardTitle className="text-lg">RSF Free</CardTitle>
                      <CardDescription>Open tools, no credit card required.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-3xl font-bold">$0<span className="text-sm text-muted-foreground">/mo</span></div>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                          Run all calculators and planning tools.
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                          View live NOTAMs, TFRs, and weather.
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                          Create aviation events with a free RSF account (anti-spam).
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="border-primary/30 shadow-sm">
                    <CardHeader>
                      <Badge className="w-fit">Most Popular</Badge>
                      <CardTitle className="text-lg">{membershipTierInfo.pro.title}</CardTitle>
                      <CardDescription>{membershipTierInfo.pro.subtitle}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-3xl font-bold">
                        ${proMonthly?.toFixed(2) ?? "14.99"}
                        <span className="text-sm text-muted-foreground">/mo</span>
                      </div>
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

                  <Card className="border-primary/20">
                    <CardHeader>
                      <Badge variant="secondary" className="w-fit">Power Pilot</Badge>
                      <CardTitle className="text-lg">{membershipTierInfo.pro_plus.title}</CardTitle>
                      <CardDescription>{membershipTierInfo.pro_plus.subtitle}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-3xl font-bold">
                        ${proPlusMonthly?.toFixed(2) ?? "24.99"}
                        <span className="text-sm text-muted-foreground">/mo</span>
                      </div>
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

      {/* Current Conditions */}
      <div className="py-10 sm:py-12">
        <div className="container mx-auto px-4 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-semibold">Current Conditions</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Live weather and airport conditions for quick planning context.
            </p>
          </div>

          <Card className="border-muted-foreground/20">
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
            <Card id="airport-weather" className="border-muted-foreground/20">
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
                      <Badge variant="outline" className="bg-amber-50 text-amber-800">
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

            <Card id="airport-briefing" className="border-muted-foreground/20">
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
                        <Badge variant="outline" className="bg-amber-50 text-amber-800">
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

      {/* Choose your starting point */}
      <div className="py-10 sm:py-12">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-semibold">Choose your starting point</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              RSF supports pilots at every stage -- pick a starting point.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Popular tools:</span>
            {[
              { label: "e6b advanced", href: "/tools/e6b", slug: "e6b-advanced" },
              { label: "VOR/Knob Trainer", href: "/student/vor-trainer", slug: "vor-knob" },
              { label: "Six-Pack Panel", href: "/student/six-pack-trainer", slug: "six-pack" },
              { label: "IFR Tools", href: "/ifr-tools", slug: "ifr-tools" },
              { label: "TFR Map", href: "/tfr-map", slug: "tfr-map" },
              { label: "NOTAM Briefing", href: "/pilot-tools#airport-briefing", slug: "notam-briefing" },
            ].map((tool) => (
              <Button key={tool.slug} size="sm" variant="outline" asChild>
                <Link
                  href={tool.href}
                  onClick={() => trackEvent("starting_point_tool_click", { tool_slug: tool.slug })}
                >
                  {tool.label}
                </Link>
              </Button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">CFI instructor?</span>
            <Button size="sm" variant="secondary" asChild>
              <Link
                href="/cfi"
                onClick={() => trackEvent("starting_point_tool_click", { tool_slug: "cfi-directory" })}
              >
                Create your profile
              </Link>
            </Button>
          </div>
          <Card className="mt-6 border-primary/20 bg-primary/5">
            <CardContent className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-base sm:text-lg font-semibold">
                  <BookOpen className="h-5 w-5 text-primary" />
                  CFI Instructors: Create your RSF profile
                </div>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  Get discovered by student pilots, highlight your ratings, and accept booking requests through the CFI marketplace.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  asChild
                >
                  <Link
                    href="/cfi"
                    onClick={() => trackEvent("cta_click", { label: "landing_cfi_directory", target: "/cfi" })}
                  >
                    View CFI directory
                  </Link>
                </Button>
                <Button asChild>
                  <Link
                    href="/dashboard/cfi"
                    onClick={() => trackEvent("cta_click", { label: "landing_cfi_create_profile", target: "/dashboard/cfi" })}
                  >
                    Create your profile
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          <FeaturedPartnerToolCard
            className="mt-6 mx-auto w-full md:w-2/3"
            partnerKey="av8maps"
            title="Av8Maps — Nationwide GA Destination Maps"
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
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                id: "experienced_pilot",
                title: "Experienced Pilot",
                subtitle: "Planning, performance, currency, and proficiency tools",
                primary: { label: "Open pilot tools", href: "/pilot-tools", track: "start_experienced_primary" },
                links: [
                  { label: "Pilot calculators", href: "/pilot-tools", track: "start_experienced_calculators" },
                  { label: "Digital logbook", href: "/logbook", track: "start_experienced_logbook" },
                  { label: "Currency tracking", href: "/logbook", track: "start_experienced_currency" },
                  { label: "IFR tools", href: "/ifr-tools", track: "start_experienced_ifr" },
                ],
              },
              {
                id: "student_pilot",
                title: "Student Pilot",
                subtitle: "Training guidance, fundamentals, and progress tracking",
                primary: { label: "Open Student Hub", href: "/student", track: "start_student_primary" },
                links: [
                  { label: "6-Pack trainer", href: "/student/six-pack-trainer", track: "start_student_six_pack" },
                  { label: "Training syllabi", href: "/student/syllabi", track: "start_student_syllabi" },
                  { label: "Cost calculator", href: "/student/cost", track: "start_student_cost" },
                  { label: "Student weather", href: "/student/weather", track: "start_student_weather" },
                ],
              },
              {
                id: "rent_aircraft",
                title: "Rent an Aircraft",
                subtitle: "Find rentals, flight schools, and verified access",
                primary: { label: "Browse rentals", href: "/rentals", track: "start_rentals_primary" },
                links: [
                  { label: "Flight schools", href: "/rentals", track: "start_rentals_schools" },
                  { label: "Verification & safety", href: "/faq", track: "start_rentals_verification" },
                ],
              },
              {
                id: "marketplace_jobs",
                title: "Marketplace & Jobs",
                subtitle: "Aircraft, jobs, services, and charter listings",
                primary: { label: "Open marketplace", href: "/marketplace", track: "start_marketplace_primary" },
                links: [
                  { label: "Aircraft listings", href: "/marketplace", track: "start_marketplace_aircraft" },
                  { label: "Aviation jobs", href: "/marketplace", track: "start_marketplace_jobs" },
                  { label: "Services & charter", href: "/marketplace", track: "start_marketplace_services" },
                ],
              },
            ].map((card) => (
              <Card key={card.title} className="border-muted-foreground/20">
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-2">
                    <div className="text-lg font-semibold">{card.title}</div>
                    <p className="text-sm text-muted-foreground">{card.subtitle}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {card.links.map((link) => (
                      <Button key={link.label} size="sm" variant="outline" asChild>
                        <Link
                          href={link.href}
                          onClick={() => trackEvent("cta_click", { label: link.track, target: link.href })}
                        >
                          {link.label}
                        </Link>
                      </Button>
                    ))}
                  </div>
                  <Button size="sm" variant="secondary" className="w-fit" asChild>
                    <Link
                      href={card.primary.href}
                      onClick={() => {
                        trackEvent("starting_point_card_click", { card_id: card.id });
                        trackEvent("cta_click", { label: card.primary.track, target: card.primary.href });
                      }}
                    >
                      {card.primary.label}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Aviation Events Feed */}
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
            <div className="relative mt-6 rounded-2xl border bg-background/70">
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
                {feedEvents.map((event) => (
                  <Link
                    key={event.id}
                    href="/events"
                    onClick={() => trackEvent("cta_click", { label: "events_feed", target: "/events" })}
                  >
                    <div className="min-w-[260px] snap-start overflow-hidden rounded-xl border bg-background shadow-sm hover:shadow-md transition-shadow">
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

