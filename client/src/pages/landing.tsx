import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { BannerAdRotation } from "@/components/banners/BannerAdRotation";
import { FeaturedPartnerToolCard } from "@/components/partners/FeaturedPartnerToolCard";
import { LandingCurrentConditions } from "@/components/landing/LandingCurrentConditions";
import { LandingEventsRail } from "@/components/landing/LandingEventsRail";
import { LandingModuleChooser } from "@/components/landing/LandingModuleChooser";
import { MobileBottomNav as LandingMobileBottomNav, MobilePillNav as LandingMobilePillNav, type LandingMobileTab } from "@/components/landing/MobileLandingNav";
import WeatherBriefingSummarizer from "@/components/ai/WeatherBriefingSummarizer";
import NotamTranslator from "@/components/ai/NotamTranslator";
import CabinBriefSearchForm from "@/components/CabinBriefSearchForm";
import { BookOpen, CalendarDays, Plane, CheckCircle2, AlertTriangle, Tent, UtensilsCrossed, Home, Anchor, Wrench, Calculator, ShoppingBag, FileText, Users, Search, MapPin, X, DollarSign, UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { pixelEvent } from "@/lib/pixel";
import { useAuth } from "@/hooks/useAuth";
import { extractAtisIdentifier, extractRunwayInUse, parseFlightCategory, parseWeatherHazards } from "@/lib/weatherInterpretation";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import av8mapsLogo from "@assets/Av8Maps.JPG";
import rsfOpaqueLogo from "@assets/RSFOpaqueLogo_1761494760586.png";
import rsfPromoVideo from "@assets/rsf-video-2026-02-28.mp4";

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

type FuelType = "100LL" | "Jet-A" | "Mogas" | "100LL UL";

interface FuelPrice {
  type: FuelType;
  pricePPG: number | null;
  updatedAt: string | null;
  source: "airnav" | "community" | "mock";
  reportedBy?: "airnav" | "pilot";
}

interface FuelPriceResult {
  icao: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  fuels: FuelPrice[];
  distanceMiles?: number;
}

interface FuelPriceResponse {
  results: FuelPriceResult[];
  queriedAt: string;
  source: "airnav" | "community" | "mixed" | "mock";
  communityEnabled: boolean;
}

interface MembershipPartnerOfferPublic {
  id: string;
  name: string;
  partnerName: string;
  slug: string;
  description?: string | null;
  tier: "pro" | "pro_plus";
  durationDays: number;
}

type LandingModuleId = "conditions" | "cfi" | "partner" | "events";
type MobileTab = LandingMobileTab;

const ICAO_REGEX = /^[A-Z0-9]{3,4}$/;
const LANDING_WEATHER_BAR_DISMISS_KEY = "rsf.landing.weather_jump.dismissed";
const FUEL_MAP_COL_CLASSES = [
  "col-start-1", "col-start-2", "col-start-3", "col-start-4", "col-start-5", "col-start-6",
  "col-start-7", "col-start-8", "col-start-9", "col-start-10", "col-start-11", "col-start-12",
];
const FUEL_MAP_ROW_CLASSES = [
  "row-start-1", "row-start-2", "row-start-3", "row-start-4", "row-start-5", "row-start-6",
];
const AV8MAPS_EMBED_ENABLED =
  String(import.meta.env.VITE_AV8MAPS_EMBED_ENABLED ?? "false").toLowerCase() === "true";
const AV8MAPS_EMBED_URL = (import.meta.env.VITE_AV8MAPS_EMBED_URL || "").trim();
const SHOW_LANDING_FUEL_TOOL = false;

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}


export default function Landing() {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
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
  const { data: cpaOffer } = useQuery<MembershipPartnerOfferPublic | null>({
    queryKey: ["/api/membership-partner-offers", "cpa-3mo-pro-plus", "landing"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/membership-partner-offers/cpa-3mo-pro-plus"));
      if (!response.ok) return null;
      return response.json();
    },
    staleTime: 1000 * 60 * 10,
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
  const [openLandingModules, setOpenLandingModules] = useState<LandingModuleId[]>(["conditions", "partner"]);
  const [icaoInput, setIcaoInput] = useState("KAUS");
  const [searchIcao, setSearchIcao] = useState("KAUS");
  const [fuelRadiusMiles, setFuelRadiusMiles] = useState("50");
  const [selectedFuelType, setSelectedFuelType] = useState<FuelType>("100LL");
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>("weather");
  const [mobileFuelExpanded, setMobileFuelExpanded] = useState(false);
  const [hasUsedTool, setHasUsedTool] = useState(false);
  const [hasUsedWeatherTool, setHasUsedWeatherTool] = useState(false);
  const [weatherJumpDismissed, setWeatherJumpDismissed] = useState(false);
  const [showAiWeatherSummary, setShowAiWeatherSummary] = useState(false);
  const [showAiNotamTranslator, setShowAiNotamTranslator] = useState(false);
  const [airportSuggestions, setAirportSuggestions] = useState<AirportSearchResult[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [introPhase, setIntroPhase] = useState(0);
  const introTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
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

  const {
    data: weather,
    isLoading: weatherLoading,
    isFetching: weatherFetching,
    refetch: refetchWeather,
  } = useQuery<WeatherData>({
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

  const { data: fuelPrices, isLoading: fuelPricesLoading, isError: fuelPricesError } = useQuery<FuelPriceResponse>({
    queryKey: ["/api/fuel-prices", searchIcao, fuelRadiusMiles],
    queryFn: async () => {
      const res = await fetch(
        apiUrl(`/api/fuel-prices?airport=${encodeURIComponent(searchIcao)}&radiusMiles=${encodeURIComponent(fuelRadiusMiles)}`),
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch fuel prices");
      return res.json();
    },
    enabled: SHOW_LANDING_FUEL_TOOL && Boolean(searchIcao),
    staleTime: 1000 * 60 * 15,
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

  const {
    data: runwayBriefing,
    isLoading: runwayLoading,
    isFetching: runwayFetching,
    refetch: refetchRunwayBriefing,
  } = useQuery<{
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

  const {
    data: notams,
    isLoading: notamsLoading,
    isFetching: notamsFetching,
    isError: notamsError,
    refetch: refetchNotams,
  } = useQuery<{
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
  const weatherUpdatedAt = weather?.metar?.obsTime
    ? formatTimeAgo(new Date(weather.metar.obsTime).getTime())
    : null;
  const metarDisplay = weather?.metar?.rawOb ?? "METAR feed pending";
  const tafDisplay = weather?.taf?.rawTAF ?? "No TAF forecast available";
  const runwayHeadline = runwayBriefing?.advisory?.runway || runwayInUseDisplay || "--";
  const weatherStatusTone =
    flightCategory.category === "VFR"
      ? "text-[#00D4A0]"
      : flightCategory.category === "MVFR"
        ? "text-[#4A9FD4]"
        : flightCategory.category === "IFR"
          ? "text-[#F5A623]"
          : "text-[#E8453C]";
  const weatherHazards = useMemo(
    () => parseWeatherHazards(weather?.metar, weather?.taf, notams?.notams ?? []),
    [weather?.metar, weather?.taf, notams?.notams]
  );
  const hasProCore = !!(user as any)?.entitlements?.isPro;
  const hasProPlus = !!(user as any)?.entitlements?.isProPlus;
  const isPaidUser = hasProCore || hasProPlus;
  const membershipPageHref = "/logbook/pro";
  const membershipCtaLabel = hasProCore && !hasProPlus ? "Upgrade to Pro+" : isPaidUser ? "Manage Membership" : "Subscribe Now";
  const membershipCtaDescription = hasProCore && !hasProPlus
    ? "Move into the training stack, advanced sims, and higher-end pilot workflow tools."
    : isPaidUser
      ? "Open your RSF Pro page to manage plan details, trials, and membership settings."
      : "Open the dedicated RSF Pro page for plan details, feature breakdowns, and subscription links.";
  const fuelAirports = useMemo(
    () =>
      (fuelPrices?.results ?? [])
        .map((airport) => {
          const matchingFuel = airport.fuels.find(
            (fuel) => fuel.type === selectedFuelType && fuel.pricePPG !== null
          );
          return matchingFuel ? { ...airport, matchingFuel } : null;
        })
        .filter(
          (airport): airport is FuelPriceResult & { matchingFuel: FuelPrice } => !!airport
        )
        .sort((a, b) => (a.matchingFuel.pricePPG ?? Infinity) - (b.matchingFuel.pricePPG ?? Infinity)),
    [fuelPrices, selectedFuelType]
  );
  const cheapestFuelAirport = fuelAirports[0] ?? null;
  const fuelMapPins = useMemo(() => {
    if (fuelAirports.length === 0) return [];
    const lats = fuelAirports.map((airport) => airport.lat);
    const lons = fuelAirports.map((airport) => airport.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const latRange = Math.max(maxLat - minLat, 0.01);
    const lonRange = Math.max(maxLon - minLon, 0.01);

    return fuelAirports.slice(0, 8).map((airport) => {
      const normalizedX = (airport.lon - minLon) / lonRange;
      const normalizedY = (maxLat - airport.lat) / latRange;
      const colIndex = Math.max(0, Math.min(11, Math.round(normalizedX * 11)));
      const rowIndex = Math.max(0, Math.min(5, Math.round(normalizedY * 5)));
      return {
        ...airport,
        colClass: FUEL_MAP_COL_CLASSES[colIndex],
        rowClass: FUEL_MAP_ROW_CLASSES[rowIndex],
      };
    });
  }, [fuelAirports]);

  const refreshAirportConditions = async () => {
    const normalized = icaoInput.trim().toUpperCase();
    if (!ICAO_REGEX.test(normalized)) return;
    if (normalized !== searchIcao) {
      setSearchIcao(normalized);
      setHasUsedTool(true);
      setHasUsedWeatherTool(true);
      return;
    }
    await Promise.all([
      refetchWeather(),
      refetchRunwayBriefing(),
      refetchNotams(),
    ]);
    setHasUsedTool(true);
    setHasUsedWeatherTool(true);
  };

  const submitIcao = () => {
    const normalized = icaoInput.trim().toUpperCase();
    if (!ICAO_REGEX.test(normalized)) return;
    setSearchIcao(normalized);
    setHasUsedTool(true);
    setHasUsedWeatherTool(true);
    pixelEvent("Search", {
      search_string: normalized,
      content_category: "Airport Weather Search",
    });
  };

  const applySuggestion = (suggestion: AirportSearchResult) => {
    const normalized = suggestion.icao.toUpperCase();
    setIcaoInput(normalized);
    setSearchIcao(normalized);
    setAirportSuggestions([]);
    setHasUsedWeatherTool(true);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setWeatherJumpDismissed(window.localStorage.getItem(LANDING_WEATHER_BAR_DISMISS_KEY) === "true");
    } catch {
      setWeatherJumpDismissed(false);
    }
  }, []);

  useEffect(() => {
    if (activeMobileTab === "find") {
      setMobileFuelExpanded(true);
    }
  }, [activeMobileTab]);

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

  const scrollToWeatherSection = () => {
    if (!openLandingModules.includes("conditions")) {
      setOpenLandingModules((current) => [...current, "conditions"]);
    }
    window.requestAnimationFrame(() => {
      document.getElementById("airport-weather")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const dismissWeatherJumpBar = () => {
    setWeatherJumpDismissed(true);
    try {
      window.localStorage.setItem(LANDING_WEATHER_BAR_DISMISS_KEY, "true");
    } catch {}
  };

  const MobilePillNav = () => (
    <div className="sticky top-0 z-40 border-b border-[#203249] bg-[linear-gradient(180deg,rgba(10,14,20,0.98),rgba(14,22,34,0.94))] px-3 py-2 backdrop-blur md:hidden">
      <div className="scrollbar-hide flex gap-2 overflow-x-auto">
        {[
          { id: "weather" as MobileTab, label: "⛅ Weather" },
          { id: "find" as MobileTab, label: "🗺 Explore" },
          { id: "plan" as MobileTab, label: "✈️ Plan" },
          ...(isAuthenticated
            ? [{ id: "log" as MobileTab, label: "📓 Log" }]
            : []),
          ...(!isPaidUser
            ? [{ id: "pricing" as MobileTab, label: "💳 Pricing" }]
            : []),
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveMobileTab(tab.id);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              activeMobileTab === tab.id
                ? "border-[#5b4520] bg-[#271d0b] text-[#ffd278] shadow-sm"
                : "border-[#29415e] bg-[#102236] text-[#9FC6EA] hover:bg-[#15304b]"
            }`}
          >
            {({ weather: "Weather", find: "Explore", plan: "Planner", log: "Logbook", pricing: "RSF Pro" } as Record<MobileTab, string>)[tab.id] ?? tab.label}
          </button>
        ))}
      </div>
    </div>
  );

  const MobileBottomNav = () => (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#203249] bg-[linear-gradient(180deg,rgba(10,14,20,0.98),rgba(14,22,34,0.96))] pb-safe backdrop-blur-md md:hidden">
      <div className={`grid ${!isAuthenticated || !isPaidUser ? "grid-cols-5" : "grid-cols-4"}`}>
        {[
          {
            key: "weather",
            label: "Wx",
            icon: AlertTriangle,
            onClick: () => setActiveMobileTab("weather"),
            active: activeMobileTab === "weather",
          },
          {
            key: "find",
            label: "Find",
            icon: MapPin,
            onClick: () => setActiveMobileTab("find"),
            active: activeMobileTab === "find",
          },
          {
            key: "plan",
            label: "Plan",
            icon: Calculator,
            onClick: () => setActiveMobileTab("plan"),
            active: activeMobileTab === "plan",
          },
          ...(isAuthenticated
            ? [
                {
                  key: "log",
                  label: "Log",
                  icon: FileText,
                  onClick: () => setActiveMobileTab("log"),
                  active: activeMobileTab === "log",
                },
              ]
            : []),
          ...(!isPaidUser
            ? [
                {
                  key: "pricing",
                  label: "Pro",
                  icon: DollarSign,
                  onClick: () => setActiveMobileTab("pricing"),
                  active: activeMobileTab === "pricing",
                },
              ]
            : []),
          ...(!isAuthenticated
            ? [
                {
                  key: "join",
                  label: "Join",
                  icon: UserPlus,
                  onClick: () => navigate("/register"),
                  active: false,
                },
              ]
            : []),
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              item.onClick();
              if (item.key !== "join") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            className={`relative flex flex-col items-center gap-0.5 px-2 py-3 text-xs font-medium transition-colors ${
              item.active ? "text-[#ffd278]" : "text-[#7A9BB8]"
            }`}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
            {item.active && (
              <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[#D9A441]" />
            )}
          </button>
        ))}
      </div>
    </div>
  );

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

  const runIntroSequence = () => {
    introTimersRef.current.forEach(clearTimeout);
    introTimersRef.current = [];
    setIntroPhase(0);
    const schedule = (phase: number, ms: number) => {
      const t = setTimeout(() => setIntroPhase(phase), ms);
      introTimersRef.current.push(t);
    };
    schedule(1, 2500);
    schedule(2, 3400);
    schedule(3, 4000);
    schedule(4, 4700);
    schedule(5, 5500);
  };

  useEffect(() => {
    runIntroSequence();
    return () => introTimersRef.current.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setActiveSlide(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);
  
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <LandingMobilePillNav
        activeTab={activeMobileTab}
        isAuthenticated={isAuthenticated}
        isPaidUser={isPaidUser}
        onSelectTab={setActiveMobileTab}
      />
      {activeMobileTab === "weather" && (
        <div className="md:hidden">
          <div className="container mx-auto space-y-4 px-4 pt-4 text-[#E8EDF4]">
            <Card className="overflow-visible border-[#203249] bg-[linear-gradient(180deg,rgba(10,14,20,0.98),rgba(14,22,34,0.94))] shadow-[0_20px_50px_-30px_rgba(0,0,0,0.8)]">
              <CardContent className="relative z-30 p-4">
                <div className="space-y-2">
                  <Label htmlFor="mobile-weather-icao" className="text-sm font-semibold text-[#F1F5FA]">
                    Airport ICAO
                  </Label>
                  <div className="relative">
                    <Input
                      id="mobile-weather-icao"
                      value={icaoInput}
                      onChange={(event) => setIcaoInput(event.target.value)}
                      onBlur={submitIcao}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          refreshAirportConditions();
                        }
                      }}
                      placeholder="KAUS or Austin, TX"
                      className="border-[#29415e] bg-[#0d1622] pr-10 text-[#F1F5FA] placeholder:text-[#6f87a0]"
                    />
                    <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A9BB8]" />
                    {(loadingSuggestions || airportSuggestions.length > 0) && (
                      <div className="absolute z-20 mt-2 w-full rounded-md border border-[#29415e] bg-[#0d1622] shadow-sm">
                        {loadingSuggestions ? (
                          <div className="px-3 py-2 text-xs text-[#7A9BB8]">Searching airports...</div>
                        ) : (
                          <ul className="max-h-56 overflow-auto">
                            {airportSuggestions.map((suggestion) => (
                              <li key={suggestion.icao}>
                                <button
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => applySuggestion(suggestion)}
                                  className="w-full px-3 py-2 text-left text-sm text-[#E8EDF4] hover:bg-[#15283d]"
                                >
                                  <div className="font-semibold text-[#F1F5FA]">{suggestion.icao}</div>
                                  <div className="text-xs text-[#7A9BB8]">
                                    {suggestion.name}
                                    {suggestion.city ? ` - ${suggestion.city}` : ""}
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
                      <div className="mt-2 text-xs text-[#7A9BB8]">
                        {airportMeta.name ?? "Unknown airport"}
                        {airportLocation ? ` (${airportLocation})` : ""}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshAirportConditions}
                    disabled={!ICAO_REGEX.test(icaoInput.trim().toUpperCase())}
                    className="w-full border-[#29415e] bg-[#102236] text-[#E8EDF4] hover:bg-[#15304b]"
                  >
                    {weatherFetching || runwayFetching || notamsFetching ? "Refreshing..." : "Update conditions"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center gap-2">
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
                <Badge variant="outline" className="border-[#29415e] bg-[#102236] text-[#9FC6EA]">
                  Active RWY: {runwayInUseDisplay}
                </Badge>
              )}
              {atisInfo && (
                <Badge variant="outline" className="border-[#35516e] bg-[#102236] text-[#8FC7FF]">
                  ATIS: {atisInfo}
                </Badge>
              )}
              {weatherHazards.map((hazard) => (
                <Badge
                  key={hazard.id}
                  variant="outline"
                  className={
                    hazard.tone === "red"
                      ? "border-[#6d2c27] bg-[#2b1111] text-[#ff8c84]"
                      : hazard.tone === "amber"
                        ? "border-[#6d5520] bg-[#271d0b] text-[#ffd278]"
                        : "border-[#35516e] bg-[#102236] text-[#8FC7FF]"
                  }
                >
                  {hazard.label}
                </Badge>
              ))}
            </div>

            {weather?.metar ? (
              <div>
                <Label className="text-sm font-semibold text-[#F1F5FA]">METAR</Label>
                <p className="mt-1 rounded-md border border-[#203249] bg-[#0d1622] p-3 font-mono text-sm break-all text-[#F5A623]">
                  {weather.metar.rawOb}
                </p>
              </div>
            ) : (
              <p className="text-sm text-[#7A9BB8]">No METAR data available.</p>
            )}

            {weather?.taf && (
              <div>
                <Label className="text-sm font-semibold text-[#F1F5FA]">TAF (Forecast)</Label>
                <p className="mt-1 rounded-md border border-[#203249] bg-[#0d1622] p-3 font-mono text-sm whitespace-pre-wrap break-all text-[#8FC7FF]">
                  {weather.taf.rawTAF}
                </p>
              </div>
            )}

            <div className="rounded-lg border border-[#29415e] bg-[linear-gradient(180deg,rgba(13,22,34,0.98),rgba(18,31,48,0.94))] p-4">
              <div className="mb-3 space-y-1">
                <div className="text-sm font-semibold text-[#F1F5FA]">AI weather briefing</div>
                <div className="text-xs text-[#7A9BB8]">
                  Plain-English summary of METAR and TAF for {searchIcao}.
                </div>
              </div>
                <Button
                  type="button"
                  size="sm"
                  className="w-full bg-[#D9A441] text-[#0A0E14] hover:bg-[#efb85b]"
                  onClick={() => {
                    const next = !showAiWeatherSummary;
                    setShowAiWeatherSummary(next);
                    if (next) {
                      pixelEvent("ViewContent", {
                        content_name: "AI Weather Summary",
                        content_category: "Aviation Tools",
                      });
                    }
                  }}
                >
                {showAiWeatherSummary ? "Hide AI summary" : "Open AI summary"}
              </Button>
              {showAiWeatherSummary && (
                <div className="mt-3">
                  <WeatherBriefingSummarizer
                    metar={weather?.metar?.rawOb ?? ""}
                    taf={weather?.taf?.rawTAF ?? ""}
                    origin={searchIcao}
                  />
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[#29415e] bg-[linear-gradient(180deg,rgba(13,22,34,0.98),rgba(18,31,48,0.94))] p-4">
              <div className="mb-3 space-y-1">
                <div className="text-sm font-semibold text-[#F1F5FA]">AI NOTAM translator</div>
                <div className="text-xs text-[#7A9BB8]">
                  Plain-English operational impacts for active NOTAMs at {searchIcao}.
                </div>
              </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full border-[#29415e] bg-[#102236] text-[#E8EDF4] hover:bg-[#15304b]"
                  onClick={() => {
                    const next = !showAiNotamTranslator;
                    setShowAiNotamTranslator(next);
                    if (next) {
                      pixelEvent("ViewContent", {
                        content_name: "AI NOTAM Translator",
                        content_category: "Aviation Tools",
                      });
                    }
                  }}
                >
                {showAiNotamTranslator ? "Hide AI translator" : "Open AI translator"}
              </Button>
              {showAiNotamTranslator && (
                <div className="mt-3">
                  <NotamTranslator
                    notams={notams?.notams?.map((item) => item.text ?? "").filter(Boolean).join("\n\n") ?? ""}
                    airport={searchIcao}
                  />
                </div>
              )}
            </div>

            {notams?.notams?.length ? (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[#F1F5FA]">Active NOTAMs</Label>
                {notams.notams.slice(0, 4).map((item) => (
                  <div key={item.id} className="space-y-1 rounded-lg border border-[#29415e] bg-[#0f1a28] p-3 text-xs text-[#E8EDF4]">
                    <div className="font-semibold">{item.text}</div>
                    {(item.effective || item.expires) && (
                      <div className="text-[#7A9BB8]">
                        {item.effective ? `Effective ${item.effective}` : ""}
                        {item.expires ? ` - Expires ${item.expires}` : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            {runwayBriefing?.advisory && (
              <div className="rounded-lg border border-[#29415e] bg-[#0f1a28] p-3 text-sm text-[#E8EDF4]">
                <Label className="mb-2 block text-sm font-semibold text-[#F1F5FA]">Runway Advisory</Label>
                <div className="sr-only">
                  <Badge variant="outline">Recommended: {runwayBriefing.advisory.runway}</Badge>
                  <span className="text-xs text-[#7A9BB8]">
                    Headwind {runwayBriefing.advisory.headwind} kt - Crosswind {runwayBriefing.advisory.crosswind} kt
                  </span>
                </div>
                <p className="mt-2 text-xs text-[#7A9BB8]">
                  Advisory only. ATC assigns runways - verify with ATIS and tower.
                </p>
              </div>
            )}

            <div className={`${SHOW_LANDING_FUEL_TOOL ? "" : "hidden"} rounded-lg border border-white/10 bg-muted/20 p-4`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Fuel prices near {searchIcao}</div>
                  <div className="text-xs text-muted-foreground">
                    {cheapestFuelAirport
                      ? `Cheapest ${selectedFuelType}: $${cheapestFuelAirport.matchingFuel.pricePPG?.toFixed(2)} at ${cheapestFuelAirport.icao}`
                      : "Search fuel prices in the Explore tab"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setActiveMobileTab("find");
                    setMobileFuelExpanded(true);
                  }}
                >
                  View prices
                </Button>
              </div>
            </div>

            <Alert className="border-[#6d5520] bg-[#271d0b] text-[#E8EDF4]">
              <AlertTriangle className="h-4 w-4 text-[#ffd278]" />
              <AlertDescription className="text-xs">
                <strong>Disclaimer:</strong> Planning use only. Always obtain an official weather briefing before flight.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}
      {activeMobileTab === "plan" && (
        <div className="container mx-auto space-y-4 px-4 pt-4 text-[#E8EDF4] md:hidden">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-[#F1F5FA]">Plan your flight</h2>
            <p className="text-sm text-[#7A9BB8]">
              Tools for route planning, performance, and airspace awareness.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Flight Planner", desc: "Route, fuel, timing, alternates.", href: "/flight-planner", icon: Plane },
              { label: "TFR + NOTAM Map", desc: "Active restrictions and airspace.", href: "/tfr-map", icon: AlertTriangle },
              { label: "E6B Calculator", desc: "Wind, fuel burn, time/speed/dist.", href: "/e6b", icon: Calculator },
              { label: "Crosswind Calc", desc: "Headwind and crosswind components.", href: "/pilot-tools", icon: Plane },
              { label: "Density Altitude", desc: "Performance altitude calculator.", href: "/pilot-tools", icon: Plane },
              { label: "All Tools", desc: "Full tool hub.", href: "/tool-hub", icon: Search },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() =>
                  trackEvent("cta_click", {
                    label: `mobile_plan_tab_${item.label.toLowerCase().replace(/\s/g, "_")}`,
                    target: item.href,
                  })
                }
              >
                <div className="flex h-full flex-col gap-2 rounded-xl border border-[#29415e] bg-[linear-gradient(180deg,rgba(13,22,34,0.98),rgba(18,31,48,0.94))] p-4 transition hover:bg-[#15304b]">
                  <item.icon className="h-4 w-4 text-[#D9A441]" />
                  <div className="text-sm font-semibold leading-tight text-[#F1F5FA]">{item.label}</div>
                  <div className="text-xs leading-snug text-[#7A9BB8]">{item.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
      {activeMobileTab === "log" && (
        <div className="container mx-auto space-y-4 px-4 pt-4 text-[#E8EDF4] md:hidden">
          {isPaidUser ? (
            <>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-[#F1F5FA]">Your logbook</h2>
                <p className="text-sm text-[#7A9BB8]">
                  Track flights, endorsements, and currency.
                </p>
              </div>
              <Button asChild className="w-full bg-[#D9A441] text-[#0A0E14] hover:bg-[#efb85b]" size="lg">
                <Link
                  href="/logbook"
                  onClick={() => trackEvent("cta_click", { label: "mobile_log_tab_open_logbook", target: "/logbook" })}
                >
                  Open digital logbook
                </Link>
              </Button>
              {hasProPlus ? (
                <Button asChild variant="outline" className="w-full border-[#29415e] bg-[#102236] text-[#E8EDF4] hover:bg-[#15304b]">
                  <Link href="/cfi/training-center">CFI Training Center</Link>
                </Button>
              ) : (
                <div className="rounded-lg border border-[#5b4520] bg-[#271d0b] p-4 text-sm text-[#E8EDF4]">
                  <div className="mb-1 font-semibold text-[#F1F5FA]">Upgrade to Pro+</div>
                  <p className="mb-3 text-xs text-[#d7b57a]">
                    Unlock GPS simulators and the CFI training center.
                  </p>
                  <Button asChild size="sm" className="w-full bg-[#D9A441] text-[#0A0E14] hover:bg-[#efb85b]">
                    <Link href="/logbook/pro">Upgrade to Pro+</Link>
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-[#F1F5FA]">Free digital logbook</h2>
                <p className="text-sm text-[#7A9BB8]">
                  Log flights with the basic RSF logbook now. Upgrade for saved plans, enhanced tracking, and Pro features.
                </p>
              </div>
              <div className="rounded-lg border border-[#29415e] bg-[linear-gradient(180deg,rgba(13,22,34,0.98),rgba(18,31,48,0.94))] p-4 text-sm text-[#E8EDF4]">
                <div className="font-semibold text-[#F1F5FA]">Included with a free account</div>
                <ul className="mt-2 space-y-2 text-xs text-[#7A9BB8]">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D9A441]" />
                    Basic digital logbook access
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D9A441]" />
                    Core flight entry and tracking
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D9A441]" />
                    Upgrade when you need saved plans and enhanced tools
                  </li>
                </ul>
              </div>
              <Button asChild className="w-full bg-[#D9A441] text-[#0A0E14] hover:bg-[#efb85b]" size="lg">
                <Link
                  href="/logbook"
                  onClick={() => trackEvent("cta_click", { label: "mobile_log_tab_open_logbook", target: "/logbook" })}
                >
                  Open free logbook
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full border-[#29415e] bg-[#102236] text-[#E8EDF4] hover:bg-[#15304b]">
                <Link
                  href="/logbook/pro"
                  onClick={() => trackEvent("cta_click", { label: "mobile_log_tab_start_trial", target: "/logbook/pro" })}
                >
                  Start 14-day Pro trial
                </Link>
              </Button>
            </>
          )}
        </div>
      )}
      {activeMobileTab === "pricing" && (
        <div className="container mx-auto space-y-4 px-4 pt-4 md:hidden">
          <Card className="border-[#29415e] bg-[linear-gradient(180deg,rgba(10,14,20,0.98),rgba(14,22,34,0.94))] text-[#E8EDF4] shadow-[0_20px_50px_-30px_rgba(0,0,0,0.8)]">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="rsf-kicker border-[#29415e] bg-[#102236] text-[#D9A441]">RSF Pro</span>
                <Badge variant="outline" className="border-[#29415e] bg-[#102236] text-[#9FC6EA]">
                  Plans moved off this page
                </Badge>
              </div>
              <div className="space-y-2">
                <CardTitle className="text-xl text-[#F1F5FA]">Open the dedicated membership page.</CardTitle>
                <CardDescription className="text-sm text-[#7A9BB8]">
                  {membershipCtaDescription}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full bg-[#D9A441] text-[#0A0E14] hover:bg-[#efb85b]">
                <Link
                  href={membershipPageHref}
                  onClick={() => trackEvent("cta_click", { label: "mobile_pricing_tab_membership_cta", target: membershipPageHref })}
                >
                  {membershipCtaLabel}
                </Link>
              </Button>
              <p className="text-xs text-[#7A9BB8]">
                The RSF Pro page now carries the full plan details, trial language, and subscribe flows.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      {!weatherJumpDismissed && !hasUsedWeatherTool && (
        <div className="hidden border-b border-[#1c3147] bg-[linear-gradient(180deg,rgba(13,22,34,0.98),rgba(10,14,20,0.96))] md:block">
          <div className="container mx-auto px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7A9BB8]">Weather &amp; NOTAM Briefing</p>
                <p className="text-sm font-semibold text-[#E8EDF4]">Get current airport weather and NOTAMs</p>
                <p className="text-xs text-[#9CB4CC]">
                  Check live METARs, TAFs, runway conditions, and airport briefing details from the landing page.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="bg-[#D9A441] text-[#0A0E14] hover:bg-[#efb85b]"
                  onClick={() => {
                    trackEvent("landing_weather_jump_bar_click", { target: "airport-weather" });
                    setHasUsedWeatherTool(true);
                    scrollToWeatherSection();
                  }}
                >
                  Jump to weather
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-[#7A9BB8] hover:text-[#E8EDF4]"
                  aria-label="Dismiss weather briefing banner"
                  onClick={() => {
                    trackEvent("landing_weather_jump_bar_dismissed", { target: "airport-weather" });
                    dismissWeatherJumpBar();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div id="landing-find-section" className={activeMobileTab === "find" ? "" : "hidden md:block"}>
      {/* Hero Section */}
      <div className={`${SHOW_LANDING_FUEL_TOOL ? "" : "hidden"} relative overflow-hidden border-b border-white/8 bg-[linear-gradient(180deg,hsl(var(--primary)/0.16),transparent_72%)]`}>
        <div className="container mx-auto px-4 py-12 sm:py-20">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_390px] xl:items-start">
            <div className="rsf-card-shell overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-white/10 bg-[linear-gradient(135deg,hsl(221_64%_23%),hsl(221_72%_38%))] px-5 py-4 text-slate-100 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rsf-kicker border-white/20 bg-white/10 text-slate-100">Fuel Price Finder</span>
                    <Badge variant="secondary" className="border-0 bg-white/10 text-slate-100 shadow-none">
                      {fuelPrices?.source === "mock" ? "Sample data" : "Live feed"}
                    </Badge>
                    <Badge variant="secondary" className="border-0 bg-white/10 text-slate-100 shadow-none">
                      {selectedFuelType}
                    </Badge>
                  </div>
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                      As of March 7th, this is a new feature for RSF
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-slate-200 sm:text-base">
                      Give us a week and we will be live with the lowest fuel costs near you, along with a sectional-style map to visualize the best options around your airport. We are starting with 100LL and Jet-A fuel types, and will be adding more fuel types and features based on your feedback.
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-white/15 bg-black/10 px-3 py-2 text-xs text-slate-200">
                  {fuelPrices?.source === "mock"
                    ? "Sample fuel data until live provider is enabled."
                    : `Updated ${new Date(fuelPrices?.queriedAt ?? Date.now()).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}`}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 px-5 py-3 md:hidden">
                <span className="text-sm text-slate-200">
                  {mobileFuelExpanded ? "Showing fuel prices near " : "Tap to find fuel prices near "}
                  <span className="font-semibold">{searchIcao}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setMobileFuelExpanded((value) => !value)}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-slate-100 hover:bg-white/20"
                >
                  {mobileFuelExpanded ? "Collapse" : "Show prices"}
                </button>
              </div>
              <div className={`md:block ${mobileFuelExpanded ? "block" : "hidden"}`}>
              <div className="space-y-5 p-5">
                <div className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_120px_auto]">
                    <div className="space-y-2">
                      <Label htmlFor="fuel-airport-search" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Airport
                      </Label>
                      <div className="relative">
                        <Input
                          id="fuel-airport-search"
                          value={icaoInput}
                          onChange={(event) => setIcaoInput(event.target.value.toUpperCase())}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              trackEvent("fuel_price_search", {
                                airport: icaoInput.trim().toUpperCase(),
                                radius: fuelRadiusMiles,
                              });
                              submitIcao();
                            }
                          }}
                          placeholder="ICAO or airport code"
                          className="pr-10"
                          data-testid="input-fuel-airport-search"
                        />
                        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        {airportSuggestions.length > 0 ? (
                          <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 rounded-xl border border-white/10 bg-background/95 p-1 shadow-lg backdrop-blur">
                            {airportSuggestions.map((suggestion) => (
                              <button
                                key={suggestion.icao}
                                type="button"
                                className="flex w-full items-start justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                                onClick={() => applySuggestion(suggestion)}
                              >
                                <span className="font-medium">{suggestion.icao}</span>
                                <span className="ml-3 text-xs text-muted-foreground">
                                  {[suggestion.name, suggestion.city, suggestion.state].filter(Boolean).join(" / ")}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {loadingSuggestions ? (
                        <div className="text-xs text-muted-foreground">Searching airports...</div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          Search by ICAO. Fuel pricing returns nearby airports inside the selected radius.
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fuel-radius" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Radius
                      </Label>
                      <select
                        id="fuel-radius"
                        aria-label="Fuel search radius"
                        title="Fuel search radius"
                        value={fuelRadiusMiles}
                        onChange={(event) => setFuelRadiusMiles(event.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        data-testid="select-fuel-radius"
                      >
                        <option value="25">25 mi</option>
                        <option value="50">50 mi</option>
                        <option value="75">75 mi</option>
                        <option value="100">100 mi</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        className="w-full"
                        onClick={() => {
                          trackEvent("fuel_price_search", {
                            airport: icaoInput.trim().toUpperCase(),
                            radius: fuelRadiusMiles,
                          });
                          setHasUsedTool(true);
                          submitIcao();
                        }}
                        data-testid="button-fuel-search"
                      >
                        Search prices
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(["100LL", "Jet-A", "Mogas", "100LL UL"] as FuelType[]).map((fuelType) => (
                      <Button
                        key={fuelType}
                        type="button"
                        size="sm"
                        variant={selectedFuelType === fuelType ? "default" : "outline"}
                        onClick={() => setSelectedFuelType(fuelType)}
                        data-testid={`button-fuel-type-${fuelType}`}
                      >
                        {fuelType}
                      </Button>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[1.15rem] border border-white/10 bg-[linear-gradient(180deg,hsl(208_34%_16%),hsl(220_32%_12%))] p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Regional fuel map</div>
                          <div className="text-sm text-slate-200">
                            {fuelPricesLoading
                              ? "Loading nearby fuel prices..."
                              : fuelPricesError
                                ? "Fuel service temporarily unavailable."
                                : `Showing up to ${fuelMapPins.length} nearby airports around ${searchIcao}`}
                          </div>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                          <MapPin className="mr-1 inline h-3.5 w-3.5" />
                          {selectedFuelType} pins
                        </div>
                      </div>
                      <div className="mt-4 rounded-[1rem] border border-sky-400/10 bg-[linear-gradient(180deg,hsl(201_44%_18%),hsl(215_36%_11%))] p-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                          <span>Sectional-style regional view</span>
                          <span>Advisory only</span>
                        </div>
                        <div className="relative isolate grid aspect-[16/9] min-h-[280px] grid-cols-12 grid-rows-6 overflow-hidden rounded-[0.8rem] border border-sky-400/10 bg-[radial-gradient(circle_at_20%_18%,hsl(47_48%_52%/0.18),transparent_22%),radial-gradient(circle_at_78%_74%,hsl(120_45%_42%/0.16),transparent_26%),linear-gradient(135deg,hsl(105_22%_27%/0.88),hsl(145_24%_23%/0.82)_38%,hsl(191_38%_20%/0.88)_72%,hsl(215_34%_13%/0.96))] p-4 sm:min-h-[340px]">
                          {fuelPrices?.source === "mock" ? (
                            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
                              <div className="max-w-[220px] rotate-[-24deg] text-center text-3xl font-black uppercase tracking-[0.22em] text-slate-100/18 sm:text-4xl">
                                Sample Pricing
                              </div>
                            </div>
                          ) : null}
                          <div className="col-span-full row-span-full rounded-[0.8rem] border border-dashed border-white/10" />
                          <div className="pointer-events-none absolute inset-x-[12%] top-[30%] h-px rotate-[8deg] border-t border-dashed border-amber-100/20" />
                          <div className="pointer-events-none absolute inset-x-[22%] top-[60%] h-px -rotate-[12deg] border-t border-dashed border-sky-100/15" />
                          <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/10 bg-slate-950/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                            N
                          </div>
                          <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-white/10 bg-slate-950/55 px-2 py-1 text-[10px] text-slate-300">
                            Area: {searchIcao}
                          </div>
                          <div className="pointer-events-none absolute bottom-3 right-3 rounded-md border border-white/10 bg-slate-950/55 px-2 py-1 text-[10px] text-slate-300">
                            Radius {fuelRadiusMiles} mi
                          </div>
                        {fuelMapPins.map((airport, index) => (
                          <button
                            key={`${airport.icao}-${airport.matchingFuel.type}`}
                            type="button"
                            onClick={() => {
                              setIcaoInput(airport.icao);
                              setSearchIcao(airport.icao);
                            }}
                            title={`${airport.icao} - $${airport.matchingFuel.pricePPG?.toFixed(2)}`}
                            className={`relative z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-sky-300/60 bg-slate-950/90 text-xs font-semibold text-white shadow-lg transition hover:border-sky-300 hover:bg-slate-950 sm:h-9 sm:w-9 ${airport.colClass} ${airport.rowClass}`}
                          >
                            {index + 1}
                          </button>
                        ))}
                        {!fuelPricesLoading && fuelMapPins.length === 0 ? (
                          <div className="col-span-full row-span-full flex items-center justify-center text-sm text-slate-300">
                            No nearby pricing available for {selectedFuelType}.
                          </div>
                        ) : null}
                        </div>
                      </div>
                      {fuelMapPins.length > 0 ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {fuelMapPins.slice(0, 6).map((airport, index) => (
                            <button
                              key={`${airport.icao}-legend`}
                              type="button"
                              onClick={() => {
                                setIcaoInput(airport.icao);
                                setSearchIcao(airport.icao);
                              }}
                              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:bg-white/10"
                            >
                              <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 text-xs font-semibold text-sky-200">
                                  {index + 1}
                                </span>
                                <div>
                                  <div className="text-sm font-semibold text-white">{airport.icao}</div>
                                  <div className="text-[11px] text-slate-400">
                                    {airport.distanceMiles?.toFixed(1) ?? "0.0"} mi
                                  </div>
                                </div>
                              </div>
                              <div className="text-sm font-semibold text-sky-200">
                                ${airport.matchingFuel.pricePPG?.toFixed(2)}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
                      <div className="rounded-[1rem] border border-[#1a3d3a] bg-[#0d2220] p-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#4DA8A8]">Cheapest nearby</div>
                        {cheapestFuelAirport ? (
                          <div className="mt-2 space-y-1">
                            <div className="text-xl font-semibold text-[#4DA8A8]">
                              ${cheapestFuelAirport.matchingFuel.pricePPG?.toFixed(2)}
                            </div>
                            <div className="text-sm font-medium text-foreground">{cheapestFuelAirport.icao} - {cheapestFuelAirport.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {[cheapestFuelAirport.city, cheapestFuelAirport.state].filter(Boolean).join(", ")}
                              {cheapestFuelAirport.distanceMiles !== undefined ? ` - ${cheapestFuelAirport.distanceMiles.toFixed(1)} mi` : ""}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-muted-foreground">
                            No fuel result yet for this search.
                          </div>
                        )}
                      </div>
                      <div className="rounded-[1rem] border border-white/10 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--muted)/0.86))] p-4">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">Nearby price board</div>
                          <div className="text-xs text-muted-foreground">{selectedFuelType}</div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {fuelPricesLoading ? (
                            <div className="text-sm text-muted-foreground">Loading price board...</div>
                          ) : fuelAirports.length > 0 ? (
                            fuelAirports.slice(0, 5).map((airport) => (
                              <button
                                key={airport.icao}
                                type="button"
                                onClick={() => {
                                  setIcaoInput(airport.icao);
                                  setSearchIcao(airport.icao);
                                }}
                                className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/50 px-3 py-2 text-left transition hover:bg-white"
                              >
                                <div>
                                  <div className="text-sm font-semibold">{airport.icao}</div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {airport.distanceMiles?.toFixed(1) ?? "0.0"} mi - {airport.city}, {airport.state}
                                  </div>
                                </div>
                                <div className="text-base font-semibold text-primary">
                                  ${airport.matchingFuel.pricePPG?.toFixed(2)}
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="text-sm text-muted-foreground">No price board entries found.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button size="lg" asChild data-testid="button-marketplace">
                      <Link
                        href="/marketplace"
                        onClick={() => trackEvent("cta_click", { label: "landing_marketplace", target: "/marketplace" })}
                      >
                        Browse listings
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" asChild data-testid="button-rentals">
                      <Link
                        href="/rentals"
                        onClick={() => trackEvent("cta_click", { label: "landing_rentals", target: "/rentals" })}
                      >
                        Find rentals
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" asChild data-testid="button-plan-flight">
                      <Link
                        href="/flight-planner"
                        onClick={() => trackEvent("cta_click", { label: "landing_plan_flight", target: "/flight-planner" })}
                      >
                        Build a route
                      </Link>
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => {
                        setActiveMobileTab("weather");
                        setHasUsedWeatherTool(true);
                        if (!openLandingModules.includes("conditions")) toggleLandingModule("conditions");
                        document.getElementById("airport-weather")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      data-testid="button-fuel-open-weather"
                    >
                      Open weather below
                    </Button>
                  </div>
                </div>
              </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-white/80 px-4 py-3 text-sm">
                <div className="text-muted-foreground">
                  Want information on becoming a sponsored business?
                </div>
                <Button asChild size="sm" variant="secondary" data-testid="button-banner-ad-info-public">
                  <a href="/banner-advertise" target="_blank" rel="noopener noreferrer">
                    Click here
                  </a>
                </Button>
              </div>
              <BannerAdRotation
                placement="home"
                variant="compact"
                showLeadIn={false}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          DIRECTION 2 HERO — "The Collapse" animation
      ============================================================ */}
      <div className="relative border-b border-[#1c3147] bg-[linear-gradient(180deg,#081019_0%,#0a1420_42%,#0c1825_100%)]">
        <div className="container mx-auto px-4 py-10 md:py-16">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            {/* LEFT — animation panel */}
            <div className="relative flex min-h-[400px] flex-col items-center justify-center md:min-h-[520px]">
              {/* Skip intro button */}
              <AnimatePresence>
                {introPhase < 5 && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute right-0 top-0 z-20 text-xs text-[#7A9BB8] hover:text-[#E8EDF4] transition-colors"
                    onClick={() => {
                      introTimersRef.current.forEach(clearTimeout);
                      setIntroPhase(5);
                    }}
                  >
                    Skip intro
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Phase 0-2: Scattered tiles */}
              <AnimatePresence>
                {introPhase <= 2 && (
                  <motion.div
                    key="tiles"
                    className="relative flex items-center justify-center w-full h-64 md:h-80"
                    exit={{ opacity: 0 }}
                  >
                    <p className="absolute top-0 left-1/2 -translate-x-1/2 text-sm text-[#7A9BB8] text-center mb-6 whitespace-nowrap">
                      Sound familiar?
                    </p>
                    {[
                      {
                        label: "Weather App",
                        body: "KAUS 041753Z 18012KT 10SM FEW045 28/14",
                        bodyClass: "font-mono text-xs text-[#F5A623]",
                        extra: <span className="inline-flex items-center gap-1 rounded-full bg-green-700/80 px-2 py-0.5 text-[10px] text-white">VFR</span>,
                        initX: -120, initY: -80, initR: -8,
                        delay: 0,
                      },
                      {
                        label: "Logbook App",
                        body: "N12345 · KAUS→KSAT · 1.4hrs",
                        bodyClass: "font-mono text-xs text-[#E8EDF4]",
                        extra: null,
                        initX: 100, initY: -60, initR: 6,
                        delay: 0.5,
                      },
                      {
                        label: "Flight Plan App",
                        body: "KAUS DCT KSAT DCT KDAL",
                        bodyClass: "font-mono text-xs text-[#9CB4CC]",
                        extra: null,
                        initX: -90, initY: 80, initR: 4,
                        delay: 1.0,
                      },
                      {
                        label: "Marketplace App",
                        body: "Cessna 172S · $185/hr · KAUS",
                        bodyClass: "font-mono text-xs text-[#E8EDF4]",
                        extra: null,
                        initX: 110, initY: 90, initR: -5,
                        delay: 1.5,
                      },
                    ].map((tile, i) => (
                      <motion.div
                        key={tile.label}
                        className="absolute w-44 h-24 md:w-48 md:h-28 rounded-xl border border-[#29415e] bg-[#0d1622] p-3 shadow-lg"
                        initial={{ x: tile.initX, y: tile.initY, rotate: tile.initR, scale: 1, opacity: 0 }}
                        animate={
                          introPhase === 0
                            ? {
                                x: [tile.initX, tile.initX, tile.initX],
                                y: [tile.initY, tile.initY - 6, tile.initY],
                                rotate: tile.initR,
                                scale: 1,
                                opacity: 1,
                                transition: {
                                  opacity: { duration: 0.4, delay: tile.delay },
                                  y: {
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                    delay: tile.delay,
                                  },
                                },
                              }
                            : introPhase === 1
                            ? {
                                x: 0, y: 0, rotate: 0, scale: 0.7, opacity: 1,
                                transition: { duration: 0.8, ease: "easeInOut" },
                              }
                            : {
                                x: 0, y: 0, rotate: 0, scale: 0, opacity: 0,
                                transition: { duration: 0.4, ease: "easeIn" },
                              }
                        }
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          {tile.extra}
                          <span className="text-[10px] text-[#7A9BB8]">{tile.label}</span>
                        </div>
                        <div className={tile.bodyClass}>{tile.body}</div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Phase 2: pulse burst */}
              <AnimatePresence>
                {introPhase === 2 && (
                  <motion.div
                    key="pulse"
                    className="absolute rounded-full bg-[#D9A441]"
                    initial={{ scale: 0, opacity: 1, width: 64, height: 64 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
                  />
                )}
              </AnimatePresence>

              {/* Phase 3+: logo */}
              <AnimatePresence>
                {introPhase >= 3 && (
                  <motion.div
                    key="emerge"
                    className="absolute inset-0 flex flex-col items-center justify-center gap-5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <motion.img
                      src={rsfOpaqueLogo}
                      alt="Ready Set Fly"
                      className="h-14 mx-auto"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6 }}
                    />

                    <AnimatePresence>
                      {introPhase >= 4 && (
                        <motion.p
                          key="tagline"
                          className="text-xl md:text-2xl font-semibold text-[#F1F5FA] text-center px-4"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.8 }}
                        >
                          Where pilots land before they fly.
                        </motion.p>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {introPhase >= 5 && (
                        <motion.div
                          key="ctas"
                          className="flex flex-col gap-3 w-full max-w-xs"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5 }}
                        >
                          <Button asChild className="w-full bg-[#D9A441] text-[#0A0E14] hover:bg-[#efb85b]">
                            <Link
                              href="/register"
                              onClick={() => trackEvent("cta_click", { label: "hero_intro_get_started", target: "/register" })}
                            >
                              Get Started
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full border-[#29415e] bg-transparent text-[#E8EDF4] hover:bg-[#102236]"
                            onClick={() => {
                              document.getElementById("rsf-feature-rail")?.scrollIntoView({ behavior: "smooth" });
                            }}
                          >
                            See What&apos;s Inside
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Replay button */}
                    <AnimatePresence>
                      {introPhase >= 5 && (
                        <motion.button
                          key="replay"
                          type="button"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5 }}
                          className="text-xs text-[#6D88A6] hover:text-[#9CB4CC] transition-colors mt-1"
                          onClick={runIntroSequence}
                        >
                          ↺ Replay
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* RIGHT — Live Interface Preview (desktop only) */}
            <div className="hidden md:block">
              <div className="rounded-[1.4rem] border border-[#203249] bg-[#0d1622] p-5 shadow-[0_32px_80px_-36px_rgba(0,0,0,0.9)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-[#6D88A6]">Live Conditions Surface</div>
                  <Badge className="border border-[#30465d] bg-[#0f1b29] text-[#7EC4FF] hover:bg-[#0f1b29]">
                    {weatherLoading ? "Syncing" : "Live"}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge
                    className={`${
                      flightCategory.color === "green" ? "bg-green-700" :
                      flightCategory.color === "blue" ? "bg-blue-700" :
                      flightCategory.color === "red" ? "bg-red-700" : "bg-purple-700"
                    } text-white border-0`}
                  >
                    {flightCategory.category}
                  </Badge>
                  {(runwayInUseDisplay || runwayHeadline !== "--") && (
                    <Badge variant="outline" className="border-[#29415e] bg-[#102236] text-[#9FC6EA]">
                      RWY {runwayHeadline}
                    </Badge>
                  )}
                  {atisInfo && (
                    <Badge variant="outline" className="border-[#35516e] bg-[#102236] text-[#8FC7FF]">
                      ATIS {atisInfo}
                    </Badge>
                  )}
                  {weatherHazards.slice(0, 2).map((h) => (
                    <Badge
                      key={h.id}
                      variant="outline"
                      className={
                        h.tone === "red" ? "border-[#6d2c27] bg-[#2b1111] text-[#ff8c84]"
                        : h.tone === "amber" ? "border-[#6d5520] bg-[#271d0b] text-[#ffd278]"
                        : "border-[#35516e] bg-[#102236] text-[#8FC7FF]"
                      }
                    >
                      {h.label}
                    </Badge>
                  ))}
                </div>

                <div className="rounded-[1rem] border border-[#203249] bg-[#0a111a] p-3 mb-3">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#6D88A6] mb-2">METAR</div>
                  <p className="font-mono text-xs leading-5 text-[#F5A623] line-clamp-3 break-all">
                    {metarDisplay}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-[0.85rem] border border-[#1f3248] bg-[#0f1a28] p-2.5">
                    <div className="text-[9px] uppercase tracking-[0.2em] text-[#6D88A6]">NOTAMs</div>
                    <div className="mt-1 text-base font-mono text-[#E8EDF4]">{notams?.notams?.length ?? 0}</div>
                  </div>
                  <div className="rounded-[0.85rem] border border-[#1f3248] bg-[#0f1a28] p-2.5">
                    <div className="text-[9px] uppercase tracking-[0.2em] text-[#6D88A6]">Hazards</div>
                    <div className="mt-1 text-base font-mono text-[#E8EDF4]">{weatherHazards.length}</div>
                  </div>
                  <div className="rounded-[0.85rem] border border-[#1f3248] bg-[#0f1a28] p-2.5">
                    <div className="text-[9px] uppercase tracking-[0.2em] text-[#6D88A6]">Station</div>
                    <div className="mt-1 text-base font-mono text-[#E8EDF4]">{searchIcao}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          SECTION 2 — ICAO SEARCH BAR
      ============================================================ */}
      <div className="bg-[#0d1622] border-y border-[#203249] py-6 px-4">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm text-[#7A9BB8] mb-2 text-center">Check conditions at your airport</p>
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Input
                value={icaoInput}
                onChange={(e) => setIcaoInput(e.target.value)}
                onBlur={submitIcao}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); refreshAirportConditions(); }
                }}
                placeholder="ICAO or city, e.g. KAUS"
                className="h-12 text-base bg-[#0A0E14] border-[#29415e] text-[#F1F5FA] font-mono placeholder:text-[#4a6480]"
              />
              {(loadingSuggestions || airportSuggestions.length > 0) && (
                <div className="absolute z-20 mt-1 w-full rounded-md border border-[#29415e] bg-[#0d1622] shadow-lg">
                  {loadingSuggestions ? (
                    <div className="px-3 py-2 text-xs text-[#7A9BB8]">Searching airports...</div>
                  ) : (
                    <ul className="max-h-52 overflow-auto">
                      {airportSuggestions.map((s) => (
                        <li key={s.icao}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applySuggestion(s)}
                            className="w-full px-3 py-2 text-left text-sm text-[#E8EDF4] hover:bg-[#15283d]"
                          >
                            <div className="font-semibold font-mono text-[#F1F5FA]">{s.icao}</div>
                            <div className="text-xs text-[#7A9BB8]">
                              {[s.name, s.city, s.state].filter(Boolean).join(" · ")}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <Button
              onClick={() => { refreshAirportConditions(); scrollToWeatherSection(); }}
              disabled={!ICAO_REGEX.test(icaoInput.trim().toUpperCase())}
              className="h-12 px-6 bg-[#D9A441] text-[#0A0E14] hover:bg-[#efb85b] shrink-0"
            >
              Check Conditions
            </Button>
          </div>
        </div>
      </div>

      {/* ============================================================
          SECTION 3 — FEATURE RAIL (Embla carousel)
      ============================================================ */}
      <div id="rsf-feature-rail" className="relative border-b border-[#1c3147]">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {[
              {
                kicker: "Always On",
                headline: "Live conditions before you leave the ground.",
                description: "METARs, TAFs, NOTAMs, and runway advisories — pulled live from FAA sources and translated into plain English by AI.",
                cta: "Check Conditions",
                ctaAction: () => scrollToWeatherSection(),
                panel: (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge className={`${flightCategory.color === "green" ? "bg-green-700" : flightCategory.color === "blue" ? "bg-blue-700" : flightCategory.color === "red" ? "bg-red-700" : "bg-purple-700"} text-white border-0`}>
                        {flightCategory.category}
                      </Badge>
                      {weatherHazards.slice(0, 3).map((h) => (
                        <Badge key={h.id} variant="outline" className={h.tone === "red" ? "border-[#6d2c27] bg-[#2b1111] text-[#ff8c84]" : h.tone === "amber" ? "border-[#6d5520] bg-[#271d0b] text-[#ffd278]" : "border-[#35516e] bg-[#102236] text-[#8FC7FF]"}>
                          {h.label}
                        </Badge>
                      ))}
                    </div>
                    <div className="rounded-xl border border-[#203249] bg-[#0a111a] p-3">
                      <div className="text-[9px] uppercase tracking-[0.2em] text-[#6D88A6] mb-1.5">METAR</div>
                      <p className="font-mono text-xs text-[#F5A623] break-all line-clamp-4">{metarDisplay}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-[#1f3248] bg-[#0f1a28] p-2.5">
                        <div className="text-[#6D88A6] mb-1">NOTAMs</div>
                        <div className="font-mono text-[#E8EDF4]">{notams?.notams?.length ?? 0} active</div>
                      </div>
                      <div className="rounded-lg border border-[#1f3248] bg-[#0f1a28] p-2.5">
                        <div className="text-[#6D88A6] mb-1">Runway</div>
                        <div className="font-mono text-[#E8EDF4]">{runwayHeadline}</div>
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                kicker: "Route to Wheels Up",
                headline: "Plan the whole flight, not just the route.",
                description: "Departure to destination, fuel stops, alternates, TFR awareness, and a full preflight briefing in one workflow.",
                cta: "Open Flight Planner",
                ctaHref: "/flight-planner",
                panel: (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-[#203249] bg-[#0a111a] p-3 space-y-2">
                      <div className="text-[9px] uppercase tracking-[0.2em] text-[#6D88A6]">Route</div>
                      <p className="font-mono text-sm text-[#9CB4CC]">KAUS DCT LLO DCT KSAT</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { label: "Fuel Stop", value: "KSAT" },
                        { label: "Alternate", value: "KMSY" },
                        { label: "Est. Time", value: "1h 12m" },
                        { label: "TFRs", value: "0 active" },
                      ].map((r) => (
                        <div key={r.label} className="rounded-lg border border-[#1f3248] bg-[#0f1a28] p-2.5">
                          <div className="text-[#6D88A6] mb-1">{r.label}</div>
                          <div className="font-mono text-[#E8EDF4]">{r.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              },
              {
                kicker: "Find. Fly. Own.",
                headline: "Rentals, listings, and CFIs in one place.",
                description: "Browse aircraft rentals, find a CFI, list your aircraft, or connect with flying clubs — without opening another tab.",
                cta: "Browse Marketplace",
                ctaHref: "/marketplace",
                panel: (
                  <div className="space-y-3">
                    {[
                      { icao: "KAUS", model: "Cessna 172S", price: "$185/hr", detail: "VFR / IFR · Wet" },
                      { icao: "KAUS", model: "Piper PA-28", price: "$145/hr", detail: "VFR · Dry" },
                      { icao: "KSAT", model: "DA-40 Diamond", price: "$210/hr", detail: "G1000 · IFR" },
                    ].map((ac) => (
                      <div key={ac.model} className="rounded-xl border border-[#203249] bg-[#0a111a] p-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-mono text-sm text-[#F1F5FA]">{ac.model}</div>
                          <div className="text-xs text-[#7A9BB8]">{ac.icao} · {ac.detail}</div>
                        </div>
                        <div className="font-mono text-sm text-[#D9A441] shrink-0">{ac.price}</div>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                kicker: "Every Flight Counts",
                headline: "Your logbook lives here now.",
                description: "Digital flight records, endorsements, currency tracking, and training progress — all in one pilot profile.",
                cta: "Open Logbook",
                ctaHref: "/logbook",
                panel: (
                  <div className="space-y-3">
                    {[
                      { date: "2026-04-04", route: "KAUS → KSAT", time: "1.4", remarks: "Night XC" },
                      { date: "2026-04-01", route: "KSAT → KHOU", time: "0.9", remarks: "Currency" },
                      { date: "2026-03-28", route: "KAUS → KAUS", time: "1.1", remarks: "Pattern work" },
                    ].map((entry) => (
                      <div key={entry.date} className="rounded-xl border border-[#203249] bg-[#0a111a] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-xs text-[#9CB4CC]">{entry.date}</span>
                          <span className="font-mono text-xs text-[#D9A441]">{entry.time} hrs</span>
                        </div>
                        <div className="mt-1 font-mono text-sm text-[#F1F5FA]">{entry.route}</div>
                        <div className="text-xs text-[#7A9BB8]">{entry.remarks}</div>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                kicker: "For Everyone on Board",
                headline: "Your passengers deserve to know too.",
                description: "Cabin Brief gives non-pilots a plain-English AI summary of the flight ahead — weather, turbulence, what to expect. One tap to share.",
                cta: "Try Cabin Brief",
                ctaHref: "/cabin-brief",
                goldTint: true,
                panel: (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-[#5b4520] bg-[#120e04] p-4 space-y-2">
                      <div className="text-[9px] uppercase tracking-[0.2em] text-[#D9A441]">Cabin Brief · KAUS → KSAT</div>
                      <p className="text-sm leading-6 text-[#E8C57A]">
                        Expect a smooth 1hr 12min flight. Light winds at altitude, some bumps possible over the Hill Country. Skies will be clear with good visibility.
                      </p>
                      <div className="flex gap-2 pt-1">
                        <span className="rounded-full border border-[#5b4520] bg-[#1e1408] px-2 py-0.5 text-[10px] text-[#D9A441]">VFR</span>
                        <span className="rounded-full border border-[#5b4520] bg-[#1e1408] px-2 py-0.5 text-[10px] text-[#D9A441]">Light turbulence possible</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#7A9BB8] text-center">Share with passengers before departure</p>
                  </div>
                ),
              },
            ].map((slide, i) => (
              <div key={i} className="flex-[0_0_100%] min-w-0">
                <div className={`min-h-[480px] md:min-h-[440px] flex items-center border-b border-[#1c3147] bg-[linear-gradient(180deg,#0A0E14,#0d1622)] px-4 py-16 md:px-8 ${slide.goldTint ? "" : ""}`}>
                  <div className="max-w-6xl mx-auto w-full grid gap-8 md:grid-cols-[3fr_2fr] md:items-center">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.24em] text-[#6D88A6] mb-3">{slide.kicker}</div>
                      <h2 className="text-3xl md:text-4xl font-semibold text-[#F1F5FA] mb-4 leading-tight">{slide.headline}</h2>
                      <p className="text-base text-[#9CB4CC] leading-7 max-w-lg mb-6">{slide.description}</p>
                      {slide.ctaHref ? (
                        <Button asChild className="bg-[#D9A441] text-[#0A0E14] hover:bg-[#efb85b]">
                          <Link
                            href={slide.ctaHref}
                            onClick={() => trackEvent("cta_click", { label: `feature_rail_slide_${i}`, target: slide.ctaHref })}
                          >
                            {slide.cta}
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          className="bg-[#D9A441] text-[#0A0E14] hover:bg-[#efb85b]"
                          onClick={(slide as any).ctaAction}
                        >
                          {slide.cta}
                        </Button>
                      )}
                    </div>
                    <div className="hidden md:block">{slide.panel}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nav arrows */}
        <button
          type="button"
          onClick={() => emblaApi?.scrollPrev()}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 hidden md:flex h-10 w-10 items-center justify-center rounded-full border border-[#29415e] bg-[#0d1622] text-[#7A9BB8] hover:text-[#D9A441] transition-colors"
          aria-label="Previous slide"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => emblaApi?.scrollNext()}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 hidden md:flex h-10 w-10 items-center justify-center rounded-full border border-[#29415e] bg-[#0d1622] text-[#7A9BB8] hover:text-[#D9A441] transition-colors"
          aria-label="Next slide"
        >
          ›
        </button>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-2 py-4 bg-[#0A0E14]">
          {[0, 1, 2, 3, 4].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => emblaApi?.scrollTo(i)}
              className={`rounded-full transition-all duration-300 ${
                activeSlide === i ? "bg-[#D9A441] w-6 h-1.5" : "bg-[#29415e] w-1.5 h-1.5"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* ============================================================
          SECTION 4 — SOCIAL PROOF
      ============================================================ */}
      <div className="py-12 bg-[#0A0E14] border-b border-[#1c3147]">
        <div className="container mx-auto px-4 text-center">
          <p className="text-2xl font-semibold text-[#F1F5FA]">Where pilots land before they fly.</p>
          <p className="text-sm text-[#7A9BB8] mt-2 max-w-md mx-auto">
            Join our growing family of aviators — from student pilots to ATP.
          </p>
          {cpaOffer ? (
            <div className="mt-8 mx-auto max-w-md rounded-[1.2rem] border border-[#5d4717] bg-[linear-gradient(135deg,rgba(200,146,42,0.18),rgba(15,25,38,0.96))] p-5 text-left">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge className="border border-[#74551d] bg-[#241a09] text-[#F5C86A] hover:bg-[#241a09]">CPA Exclusive</Badge>
                <Badge className="border border-[#2d435a] bg-[#10233a] text-[#D6E4F4] hover:bg-[#10233a]">
                  {cpaOffer.tier === "pro_plus" ? "RSF Pro+" : "RSF Pro"}
                </Badge>
              </div>
              <h3 className="text-lg font-semibold text-[#F5F0E4] mb-2">
                {cpaOffer.durationDays / 30} months free for {cpaOffer.partnerName} members
              </h3>
              <p className="text-sm text-[#D0D8E2] mb-4">Unlock the partner offer directly inside the RSF operations stack.</p>
              <Button asChild className="w-full bg-[#C8922A] text-[#081019] hover:bg-[#d7a445]">
                <Link
                  href={`/logbook/pro?offer=${encodeURIComponent(cpaOffer.slug)}`}
                  onClick={() => trackEvent("cta_click", { label: "landing_social_proof_cpa", target: `/logbook/pro?offer=${cpaOffer.slug}` })}
                >
                  Claim CPA offer
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* ============================================================
          BELOW HERE: EXISTING SECTIONS — DO NOT RESTYLE
          Old desktop hero placeholder (hidden) kept for reference
      ============================================================ */}
      <div className="hidden border-b border-[#1c3147] bg-[radial-gradient(circle_at_top_left,rgba(74,159,212,0.18),transparent_26%),radial-gradient(circle_at_80%_16%,rgba(200,146,42,0.16),transparent_22%),linear-gradient(180deg,#081019_0%,#0a1420_42%,#0c1825_100%)] md:block">
        <div className="container mx-auto px-4 py-8 sm:py-10">
          <div className="mx-auto max-w-[1240px]">
            <div className="rounded-[1.6rem] border border-[#203249] bg-[linear-gradient(180deg,rgba(10,14,20,0.96),rgba(14,22,34,0.94))] p-6 text-[#E8EDF4] shadow-[0_32px_80px_-36px_rgba(0,0,0,0.72)] sm:p-7">
              <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-[#7A9BB8]">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#2a425f] bg-[#0d1826] px-3 py-1">
                  <Plane className="h-3.5 w-3.5 text-[#C8922A]" />
                  Flight Operations
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#2a425f] bg-[#0d1826] px-3 py-1">
                  Desktop Briefing Surface
                </span>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] xl:items-stretch">
                <div className="flex flex-col gap-5">
                  <div className="space-y-3">
                    <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.03em] text-[#E8EDF4] sm:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
                      Aviation planning and pilot workflow software that looks like it belongs in the briefing room.
                    </h1>
                    <p className="max-w-2xl text-base leading-7 text-[#9CB4CC]">
                      Ready Set Fly is the ground-side companion to the cockpit: airport conditions, runway context, NOTAM intelligence, route planning, marketplace access, and pilot tools in one aviation-native surface.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,0.94fr)_minmax(0,0.94fr)_minmax(0,1.08fr)]">
                    {[
                      { label: "Station", value: searchIcao, detail: airportMeta?.name ?? "Active airport focus", tone: "text-[#E8EDF4]" },
                      { label: "Flight Rules", value: flightCategory.category, detail: weatherUpdatedAt ? `Updated ${weatherUpdatedAt}` : "Awaiting METAR", tone: weatherStatusTone },
                      { label: "Runway", value: runwayHeadline, detail: runwayBriefing?.advisory ? "Wind-matched advisory" : "Awaiting advisory", tone: "text-[#E8EDF4]" },
                    ].map((item) => (
                      <div key={item.label} className={`rounded-[1.05rem] border border-[#203249] bg-[linear-gradient(180deg,rgba(14,22,33,0.92),rgba(10,16,24,0.88))] p-4 ${item.label === "Runway" ? "sm:col-span-2 xl:col-span-1" : ""}`}>
                        <div className="text-[10px] uppercase tracking-[0.24em] text-[#6D88A6]">{item.label}</div>
                        <div className={`mt-2 text-2xl ${item.tone}`} style={{ fontFamily: "var(--font-mono)" }}>
                          {item.value}
                        </div>
                        <div className="mt-1 text-xs text-[#7A9BB8]">{item.detail}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={scrollToWeatherSection} className="bg-[#C8922A] text-[#081019] hover:bg-[#d9a846]">
                      Open briefing deck
                    </Button>
                    <Button asChild variant="outline" className="border-[#2a425f] bg-[#0f1825] text-[#D8E2ED] hover:bg-[#122033] hover:text-[#F2F6FB]">
                      <Link
                        href="/flight-planner"
                        onClick={() => trackEvent("cta_click", { label: "landing_flight_planner_console", target: "/flight-planner" })}
                      >
                        Plan a route
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" className="text-[#9CB4CC] hover:bg-[#102031] hover:text-[#E8EDF4]">
                      <Link
                        href="/tool-hub"
                        onClick={() => trackEvent("cta_click", { label: "landing_tool_hub_console", target: "/tool-hub" })}
                      >
                        View all tools
                      </Link>
                    </Button>
                  </div>

                  <div className="rounded-[1.2rem] border border-[#203249] bg-[linear-gradient(180deg,rgba(12,18,27,0.88),rgba(14,23,35,0.84))] p-4 xl:mt-auto">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.24em] text-[#6D88A6]">Cabin Brief</div>
                        <div className="mt-1 text-sm text-[#D2DCE7]">Passenger-friendly weather briefing for non-pilots.</div>
                      </div>
                      <Badge className="border border-[#30465d] bg-[#101d2b] text-[#C8922A] hover:bg-[#101d2b]">
                        Public-facing
                      </Badge>
                    </div>
                    <CabinBriefSearchForm
                      theme="dark"
                      submitLabel="Get My Cabin Brief"
                      onSubmit={({ from, to, date }) => {
                        trackEvent("cabin_brief_search", {
                          from: from.icao,
                          to: to.icao,
                        });
                        navigate(
                          `/cabin-brief?from=${encodeURIComponent(from.icao)}&to=${encodeURIComponent(to.icao)}&date=${encodeURIComponent(date)}`,
                        );
                      }}
                    />
                  </div>
                </div>

                <div className="flex h-full flex-col rounded-[1.3rem] border border-[#203249] bg-[linear-gradient(180deg,rgba(11,18,27,0.96),rgba(14,24,38,0.96))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="flex items-center justify-between gap-3 border-b border-[#1d3045] pb-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.24em] text-[#6D88A6]">Briefing Console</div>
                      <div className="mt-1 text-lg font-semibold text-[#E8EDF4]">Airport Conditions Surface</div>
                    </div>
                    <Badge className="border border-[#30465d] bg-[#0f1b29] text-[#7EC4FF] hover:bg-[#0f1b29]">
                      {weatherLoading || runwayLoading ? "Syncing" : "Live-backed"}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1rem] border border-[#203249] bg-[#0d1622] p-4">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-[#6D88A6]">METAR</div>
                      <div className="mt-3 line-clamp-4 text-[13px] leading-6 text-[#F5A623]" style={{ fontFamily: "var(--font-mono)" }}>
                        {metarDisplay}
                      </div>
                    </div>
                    <div className="rounded-[1rem] border border-[#203249] bg-[#0d1622] p-4">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-[#6D88A6]">TAF</div>
                      <div className="mt-3 line-clamp-4 text-[13px] leading-6 text-[#A9C7E6]" style={{ fontFamily: "var(--font-mono)" }}>
                        {tafDisplay}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1rem] border border-[#203249] bg-[linear-gradient(180deg,#0d1622,#0a111a)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.24em] text-[#6D88A6]">Field Summary</div>
                        <div className="mt-1 text-sm text-[#D7E1EC]">
                          {airportMeta?.name ?? "Airport briefing"} {airportLocation ? `- ${airportLocation}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-[#6D88A6]">Runway</div>
                        <div className="mt-1 text-xl text-[#E8EDF4]" style={{ fontFamily: "var(--font-mono)" }}>
                          {runwayHeadline}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[0.9rem] border border-[#1f3248] bg-[#0f1a28] p-3">
                        <div className="text-[10px] uppercase tracking-[0.22em] text-[#6D88A6]">Hazards</div>
                        <div className="mt-2 text-sm text-[#E8EDF4]">{weatherHazards.length || 0}</div>
                        <div className="mt-1 text-xs text-[#7A9BB8]">Weather and runway flags</div>
                      </div>
                      <div className="rounded-[0.9rem] border border-[#1f3248] bg-[#0f1a28] p-3">
                        <div className="text-[10px] uppercase tracking-[0.22em] text-[#6D88A6]">NOTAMs</div>
                        <div className="mt-2 text-sm text-[#E8EDF4]">{notams?.notams?.length ?? 0}</div>
                        <div className="mt-1 text-xs text-[#7A9BB8]">FAA SWIM-backed notices</div>
                      </div>
                      <div className="rounded-[0.9rem] border border-[#1f3248] bg-[#0f1a28] p-3">
                        <div className="text-[10px] uppercase tracking-[0.22em] text-[#6D88A6]">ATIS</div>
                        <div className="mt-2 text-sm text-[#E8EDF4]">{atisInfo || "--"}</div>
                        <div className="mt-1 text-xs text-[#7A9BB8]">Broadcast identifier</div>
                      </div>
                    </div>
                  </div>

                  {cpaOffer ? (
                    <div className="mt-4 rounded-[1rem] border border-[#5d4717] bg-[linear-gradient(135deg,rgba(200,146,42,0.18),rgba(15,25,38,0.96))] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border border-[#74551d] bg-[#241a09] text-[#F5C86A] hover:bg-[#241a09]">
                          CPA Exclusive
                        </Badge>
                        <Badge className="border border-[#2d435a] bg-[#10233a] text-[#D6E4F4] hover:bg-[#10233a]">
                          {cpaOffer.tier === "pro_plus" ? "RSF Pro+" : "RSF Pro"}
                        </Badge>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-[#F5F0E4]">
                        {cpaOffer.durationDays / 30} months free for {cpaOffer.partnerName} members
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[#D0D8E2]">
                        Unlock the partner offer directly inside the RSF operations stack.
                      </p>
                      <Button
                        asChild
                        className="mt-4 w-full bg-[#C8922A] text-[#081019] hover:bg-[#d7a445]"
                      >
                        <Link
                          href={`/logbook/pro?offer=${encodeURIComponent(cpaOffer.slug)}`}
                          onClick={() =>
                            trackEvent("cta_click", {
                              label: "landing_cpa_partner_offer",
                              target: `/logbook/pro?offer=${cpaOffer.slug}`,
                            })
                          }
                        >
                          Claim CPA offer
                        </Link>
                      </Button>
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 border-t border-[#1d3045] pt-4 sm:grid-cols-3">
                    {[
                      { label: "Conditions", value: flightCategory.category, detail: weatherUpdatedAt ? `Updated ${weatherUpdatedAt}` : "Awaiting sync" },
                      { label: "Console", value: "Dispatch", detail: "Airport, runway, and NOTAM surface" },
                      { label: "Output", value: "Pilot-ready", detail: "Built for preflight and handoff" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-[0.95rem] border border-[#203249] bg-[#0f1a28] p-3">
                        <div className="text-[10px] uppercase tracking-[0.22em] text-[#6D88A6]">{item.label}</div>
                        <div className="mt-2 text-sm font-semibold text-[#E8EDF4]">{item.value}</div>
                        <div className="mt-1 text-xs text-[#7A9BB8]">{item.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden">
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.95fr)]">
          <div className="rounded-[1.35rem] border border-sky-200/80 bg-white/80 p-5 shadow-[var(--shadow-rsf-panel)] backdrop-blur sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#F0B429]/40 bg-[#F0B429]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b6500]">
                    ✈ Cabin Brief
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b6500]/90">
                    - For Passengers
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#F0B429]/40 bg-[#F0B429]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b6500]">
                    Cabin Brief
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b6500]/90">
                    For Passengers
                  </span>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  Know what&apos;s ahead. Plain-English flight weather for every passenger.
                </h2>
                <p className="text-sm text-slate-700 sm:text-base">
                  No pilot license required - just your departure and destination.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <CabinBriefSearchForm
                submitLabel="Get My Cabin Brief"
                onSubmit={({ from, to, date }) => {
                  trackEvent("cabin_brief_search", {
                    from: from.icao,
                    to: to.icao,
                  });
                  navigate(
                    `/cabin-brief?from=${encodeURIComponent(from.icao)}&to=${encodeURIComponent(to.icao)}&date=${encodeURIComponent(date)}`,
                  );
                }}
              />
            </div>
          </div>
            {cpaOffer ? (
              <div className="rounded-[1.35rem] border border-[#1f4d8f]/15 bg-[linear-gradient(165deg,#0c1c34,#153159)] p-5 text-white shadow-[var(--shadow-rsf-panel)] sm:p-6">
                <div className="flex h-full flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border border-white/20 bg-white/10 text-white hover:bg-white/10">
                        CPA Exclusive
                      </Badge>
                      <Badge variant="secondary" className="bg-[#f0b429] text-slate-950 hover:bg-[#f0b429]">
                        {cpaOffer.tier === "pro_plus" ? "RSF Pro+" : "RSF Pro"}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-semibold tracking-tight">
                        {cpaOffer.durationDays / 30} months free for {cpaOffer.partnerName} members
                      </h3>
                      <p className="text-sm leading-6 text-slate-200">
                        Enter your CPA member number, create a free RSF account, and unlock the partner offer directly through Ready Set Fly.
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/12 bg-white/10 p-3 text-xs leading-5 text-slate-200">
                      Member verification is required.
                      <br />
                      New RSF account signup is part of the redemption flow.
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Button
                      asChild
                      className="w-full bg-[#f0b429] text-slate-950 hover:bg-[#e4aa22]"
                    >
                      <Link
                        href={`/logbook/pro?offer=${encodeURIComponent(cpaOffer.slug)}`}
                        onClick={() =>
                          trackEvent("cta_click", {
                            label: "landing_cpa_partner_offer",
                            target: `/logbook/pro?offer=${cpaOffer.slug}`,
                          })
                        }
                      >
                        Claim CPA offer
                      </Link>
                    </Button>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
                      Monthly RSF membership platform. No annual lock-in required.
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {activeMobileTab === "find" && (
        <div className="border-b border-[#203249] bg-[#0a0e14] md:hidden">
          <div className="container mx-auto px-4 py-4">
            <Card className="border-[#5d4717] bg-[linear-gradient(135deg,rgba(200,146,42,0.10),rgba(13,22,34,0.98))] shadow-sm">
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#D9A441]">
                    Cabin Brief - For Passengers
                  </div>
                  <div className="text-base font-semibold text-[#F1F5FA]">
                    Traveling with someone who is not a pilot?
                  </div>
                  <div className="text-sm text-[#9CB4CC]">
                    Open a plain-English weather briefing built for passengers and nervous flyers.
                  </div>
                </div>
                <Button
                  asChild
                  className="w-full bg-[#D9A441] text-[#0A0E14] hover:bg-[#efb85b]"
                >
                  <Link
                    href="/cabin-brief"
                    onClick={() => trackEvent("cta_click", { label: "landing_mobile_cabin_brief", target: "/cabin-brief" })}
                  >
                    Open Cabin Brief
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!isAuthenticated && hasUsedTool && (
        <div className="border-t border-[#1c3147] bg-[#0a0e14]">
          <div className="container mx-auto px-4 py-5">
            <div className="flex flex-col gap-4 rounded-xl border border-[#29415e] bg-[#0f1a28] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-[#F1F5FA]">
                  Save searches, log flights, and unlock every RSF tool.
                </p>
                <p className="text-xs text-[#7A9BB8]">
                  Free account — no credit card. Upgrade to Pro anytime with a 14-day trial.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link
                    href="/register"
                    onClick={() => trackEvent("cta_click", {
                      label: "post_tool_nudge_register",
                      target: "/register",
                    })}
                  >
                    Create free account
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link
                    href="/login"
                    onClick={() => trackEvent("cta_click", {
                      label: "post_tool_nudge_sign_in",
                      target: "/login",
                    })}
                  >
                    Sign in
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div id="landing-quickstart-section" className="hidden rsf-section-band py-8 sm:py-10 md:block">
        <div className="container mx-auto px-4">
          <div className={`grid gap-6 ${!hasProPlus ? "xl:grid-cols-[minmax(0,1.12fr)_320px]" : ""}`}>
            <section className={`rounded-[1.45rem] border border-[#203249] bg-[linear-gradient(180deg,rgba(10,14,20,0.98),rgba(14,22,34,0.94))] p-5 text-[#E8EDF4] shadow-[0_24px_60px_-32px_rgba(0,0,0,0.78)] sm:p-6 ${activeMobileTab === "find" || activeMobileTab === "plan" || activeMobileTab === "log" ? "" : "hidden md:block"}`}>
              <div className="mb-6 space-y-2">
                <span className="rsf-kicker border-[#29415e] bg-[#102236] text-[#9FC6EA]">Flight Operations</span>
                <h2 className="text-2xl font-semibold text-[#F1F5FA] sm:text-3xl">Where do you want to go?</h2>
                <p className="max-w-2xl text-sm text-[#7A9BB8]">Four paths into the RSF platform — pick the one that matches your next move.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-4 rounded-[1.15rem] border border-[#29415e] bg-[#0d1622] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.75rem] border border-[#3a5b7b] bg-[#0f1a28]">
                      <ShoppingBag className="h-5 w-5 text-[#D9A441]" />
                    </div>
                    <div className="text-base font-semibold text-[#F1F5FA]">Marketplace</div>
                  </div>
                  <p className="text-sm leading-6 text-[#9CB4CC]">Browse aircraft rentals, listings, CFI directory, and aviation services.</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Button asChild className="bg-[#D9A441] text-[#0A0E14] hover:bg-[#efb85b]">
                      <Link href="/marketplace" onClick={() => trackEvent("cta_click", { label: "path_card_marketplace", target: "/marketplace" })}>
                        Browse Listings
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="border-[#29415e] bg-[#0f1a28] text-[#E8EDF4] hover:bg-[#15304b]">
                      <Link href="/rentals" onClick={() => trackEvent("cta_click", { label: "path_card_rentals", target: "/rentals" })}>
                        Find Rentals
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-4 rounded-[1.15rem] border border-[#29415e] bg-[#0d1622] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.75rem] border border-[#3a5b7b] bg-[#0f1a28]">
                      <Calculator className="h-5 w-5 text-[#D9A441]" />
                    </div>
                    <div className="text-base font-semibold text-[#F1F5FA]">Pilot Tools</div>
                  </div>
                  <p className="text-sm leading-6 text-[#9CB4CC]">E6B, crosswind, density altitude, weight &amp; balance, and more.</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Button asChild className="bg-[#D9A441] text-[#0A0E14] hover:bg-[#efb85b]">
                      <Link href="/tool-hub" onClick={() => trackEvent("cta_click", { label: "path_card_tool_hub", target: "/tool-hub" })}>
                        Open Tool Hub
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-4 rounded-[1.15rem] border border-[#29415e] bg-[#0d1622] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.75rem] border border-[#3a5b7b] bg-[#0f1a28]">
                      <Plane className="h-5 w-5 text-[#D9A441]" />
                    </div>
                    <div className="text-base font-semibold text-[#F1F5FA]">Plan &amp; Track</div>
                  </div>
                  <p className="text-sm leading-6 text-[#9CB4CC]">Flight planner, digital logbook, TFR map, and route builder.</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Button asChild className="bg-[#D9A441] text-[#0A0E14] hover:bg-[#efb85b]">
                      <Link href="/flight-planner" onClick={() => trackEvent("cta_click", { label: "path_card_flight_planner", target: "/flight-planner" })}>
                        Flight Planner
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="border-[#29415e] bg-[#0f1a28] text-[#E8EDF4] hover:bg-[#15304b]">
                      <Link href="/logbook" onClick={() => trackEvent("cta_click", { label: "path_card_logbook", target: "/logbook" })}>
                        Logbook
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-4 rounded-[1.15rem] border border-[#5d4717] bg-[linear-gradient(135deg,rgba(200,146,42,0.10),rgba(13,22,34,0.98))] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.75rem] border border-[#5d4717] bg-[#1e1408]">
                      <Users className="h-5 w-5 text-[#D9A441]" />
                    </div>
                    <div className="text-base font-semibold text-[#F1F5FA]">Cabin Brief</div>
                  </div>
                  <p className="text-sm leading-6 text-[#9CB4CC]">Not a pilot? Get a plain-English AI weather brief for your flight.</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Button asChild className="bg-[#D9A441] text-[#0A0E14] hover:bg-[#efb85b]">
                      <Link href="/cabin-brief" onClick={() => trackEvent("cta_click", { label: "path_card_cabin_brief", target: "/cabin-brief" })}>
                        Get Cabin Brief
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            {!hasProPlus && (
              <aside className="hidden md:block">
                <Card id="landing-membership-section" className="sticky top-24 overflow-hidden border-[#2b4258] bg-[linear-gradient(180deg,rgba(10,14,20,0.99),rgba(16,25,38,0.96))] text-[#E8EDF4] shadow-[0_24px_60px_-32px_rgba(0,0,0,0.78)]">
                  <div className="border-b border-[#203249] bg-[linear-gradient(135deg,rgba(17,28,42,0.95),rgba(25,47,74,0.9))] px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rsf-kicker border-[#35516e] bg-[#10233a] text-[#D9A441]">RSF Pro</span>
                      <Badge variant="outline" className="border-[#35516e] bg-[#10233a] text-[#9FC6EA]">
                        Membership status
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-[#7EA8CC]">Pilot workflow upgrade</div>
                      <div className="text-2xl font-semibold text-[#F1F5FA]">{membershipCtaLabel}</div>
                    </div>
                  </div>
                  <CardContent className="space-y-4 p-5">
                    <div className="rounded-[0.95rem] border border-[#203249] bg-[#0f1a28] p-4">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-[#7EA8CC]">Why this lives here</div>
                      <p className="mt-2 text-sm leading-6 text-[#B5C8DA]">
                        {membershipCtaDescription}
                      </p>
                    </div>
                    <div className="grid gap-3">
                      {[
                        "Detailed plan comparison moved off the landing page",
                        "Quick Start stays focused on day-of-flight workflows",
                        "Use the dedicated membership page for subscribe and manage actions",
                      ].map((item) => (
                        <div key={item} className="rounded-[0.95rem] border border-[#203249] bg-[#0d1622] px-3 py-2.5 text-sm text-[#D7E1EC]">
                          {item}
                        </div>
                      ))}
                    </div>
                    <Button asChild className="w-full bg-[#D9A441] text-[#0A0E14] hover:bg-[#efb85b]">
                      <Link
                        href={membershipPageHref}
                        onClick={() => trackEvent("cta_click", { label: "landing_sidebar_membership_cta", target: membershipPageHref })}
                      >
                        {membershipCtaLabel}
                      </Link>
                    </Button>
                    <p className="text-xs text-[#7A9BB8]">
                      The membership page now carries plan details, feature breakdowns, and subscription links instead of splitting attention on the landing surface.
                    </p>
                  </CardContent>
                </Card>
              </aside>
            )}

          </div>

        </div>
      </div>
      </div>

      <LandingModuleChooser
        modules={[
          {
            id: "conditions",
            title: "Current Conditions",
            description: "Weather, runway guidance, and NOTAM briefing",
          },
          {
            id: "cfi",
            title: "Create Your CFI Profile",
            description: "Instructor directory and profile setup",
          },
          {
            id: "partner",
            title: "Featured Partner Tool",
            description: "Destination planning with Av8Maps",
          },
          {
            id: "events",
            title: "Community Calendar",
            description: "Fly-ins, safety seminars, and aviation events",
          },
        ]}
        openModules={openLandingModules}
        onToggle={toggleLandingModule}
      />

      <LandingCurrentConditions
        open={openLandingModules.includes("conditions")}
        icaoInput={icaoInput}
        searchIcao={searchIcao}
        airportSuggestions={airportSuggestions}
        loadingSuggestions={loadingSuggestions}
        airportMeta={airportMeta}
        airportLocation={airportLocation}
        isValidIcao={ICAO_REGEX.test(icaoInput.trim().toUpperCase())}
        weather={weather}
        runwayBriefing={runwayBriefing}
        notams={notams}
        weatherLoading={weatherLoading}
        weatherFetching={weatherFetching}
        runwayLoading={runwayLoading}
        runwayFetching={runwayFetching}
        notamsLoading={notamsLoading}
        notamsFetching={notamsFetching}
        notamsError={notamsError}
        conditionsTitle={conditionsTitle}
        weatherUpdatedAt={weatherUpdatedAt}
        flightCategory={flightCategory}
        runwayInUseDisplay={runwayInUseDisplay}
        atisInfo={atisInfo}
        weatherHazards={weatherHazards}
        showAiWeatherSummary={showAiWeatherSummary}
        showAiNotamTranslator={showAiNotamTranslator}
        onIcaoInputChange={setIcaoInput}
        onSubmitIcao={submitIcao}
        onRefresh={refreshAirportConditions}
        onApplySuggestion={applySuggestion}
        onToggleAiWeatherSummary={() => {
          const next = !showAiWeatherSummary;
          setShowAiWeatherSummary(next);
          if (next) {
            pixelEvent("ViewContent", {
              content_name: "AI Weather Summary",
              content_category: "Aviation Tools",
            });
          }
        }}
        onToggleAiNotamTranslator={() => {
          const next = !showAiNotamTranslator;
          setShowAiNotamTranslator(next);
          if (next) {
            pixelEvent("ViewContent", {
              content_name: "AI NOTAM Translator",
              content_category: "Aviation Tools",
            });
          }
        }}
      />
      {/* CFI marketplace and featured partner */}
      {(openLandingModules.includes("cfi") || openLandingModules.includes("partner") || activeMobileTab === "find") && (
      <div className={`py-10 sm:py-12 ${activeMobileTab !== "find" ? "hidden md:block" : ""}`}>
        <div className="container mx-auto px-4">
          {(openLandingModules.includes("partner") || activeMobileTab === "find") ? (
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
          {(openLandingModules.includes("cfi") || activeMobileTab === "find") ? (
          <Card className="mt-6 border-[#203249] bg-[linear-gradient(180deg,rgba(10,14,20,0.98),rgba(14,22,34,0.94))] text-[#E8EDF4] shadow-[0_20px_50px_-30px_rgba(0,0,0,0.8)]">
            <CardContent className="p-5 sm:p-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4 max-w-3xl">
                <div className="space-y-2">
                  <span className="rsf-kicker border-[#29415e] bg-[#102236] text-[#8FC7FF]">CFI Marketplace</span>
                  <div className="flex items-center gap-2 text-base sm:text-lg font-semibold text-[#F1F5FA]">
                    <BookOpen className="h-5 w-5 text-[#8FC7FF]" />
                    CFI Instructors: Create your RSF profile
                  </div>
                  <p className="text-sm text-[#7A9BB8] max-w-2xl">
                    Get discovered by student pilots, highlight your ratings, set your training focus, and accept booking requests through the CFI marketplace.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    "Create a free RSF account or sign in",
                    "Build your instructor profile with ratings and specialties",
                    "Appear in the directory and receive student inquiries",
                  ].map((item) => (
                    <div key={item} className="rounded-[0.9rem] border border-[#29415e] bg-[#0f1a28] p-3 text-sm text-[#7A9BB8]">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[260px]">
                <Button variant="outline" asChild className="border-[#29415e] bg-[#102236] text-[#E8EDF4] hover:bg-[#15304b]">
                  <Link
                    href="/cfi"
                    onClick={() => trackEvent("cta_click", { label: "landing_cfi_directory", target: "/cfi" })}
                  >
                    View CFI directory
                  </Link>
                </Button>
                <Button asChild className="bg-[#D9A441] text-[#0A0E14] hover:bg-[#efb85b]">
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
                  <Button variant="ghost" asChild className="text-[#9FC6EA] hover:bg-[#102236] hover:text-[#E8EDF4]">
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
          <Card className="mt-6 border-[#203249] bg-[linear-gradient(180deg,rgba(10,14,20,0.98),rgba(14,22,34,0.94))] text-[#E8EDF4] shadow-[0_20px_50px_-30px_rgba(0,0,0,0.8)]">
            <CardContent className="p-5 sm:p-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4 max-w-3xl">
                <div className="space-y-2">
                  <span className="rsf-kicker border-[#29415e] bg-[#102236] text-[#D9A441]">Flying Clubs</span>
                  <div className="flex items-center gap-2 text-base sm:text-lg font-semibold text-[#F1F5FA]">
                    <Users className="h-5 w-5 text-[#D9A441]" />
                    Run your flying club inside RSF
                  </div>
                  <p className="text-sm text-[#7A9BB8] max-w-2xl">
                    Clubs can create a profile, organize members, assign aircraft, and build a shared scheduling workflow. Pilots can also browse listed clubs through the RSF club directory.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    "Create a club profile and publish it in the RSF directory",
                    "Organize member access, fleet records, and club communications",
                    "Grow into deeper scheduling, billing, and maintenance workflows over time",
                  ].map((item) => (
                    <div key={item} className="rounded-[0.9rem] border border-[#29415e] bg-[#0f1a28] p-3 text-sm text-[#7A9BB8]">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[260px]">
                <Button variant="outline" asChild className="border-[#29415e] bg-[#102236] text-[#E8EDF4] hover:bg-[#15304b]">
                  <Link
                    href="/flying-clubs"
                    onClick={() => trackEvent("cta_click", { label: "landing_flying_clubs_directory", target: "/flying-clubs" })}
                  >
                    View Flying Clubs
                  </Link>
                </Button>
                <Button asChild className="bg-[#D9A441] text-[#0A0E14] hover:bg-[#efb85b]">
                  <Link
                    href={isAuthenticated ? "/flying-clubs" : "/register"}
                    onClick={() =>
                      trackEvent("cta_click", {
                        label: isAuthenticated ? "landing_flying_clubs_start" : "landing_flying_clubs_register",
                        target: isAuthenticated ? "/flying-clubs" : "/register",
                      })
                    }
                  >
                    {isAuthenticated ? "Start your club" : "Create free account"}
                  </Link>
                </Button>
                {!isAuthenticated ? (
                  <Button variant="ghost" asChild className="text-[#9FC6EA] hover:bg-[#102236] hover:text-[#E8EDF4]">
                    <Link
                      href="/login"
                      onClick={() => trackEvent("cta_click", { label: "landing_flying_clubs_sign_in", target: "/login" })}
                    >
                      Already have an account? Sign in
                    </Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      {/* Aviation Events Feed */}
      {(openLandingModules.includes("events") || activeMobileTab === "find") && (
      <div className={`py-10 ${activeMobileTab !== "find" ? "hidden md:block" : ""}`}>
        <LandingEventsRail
          feedEvents={feedEvents}
          eventsScrollRef={eventsScrollRef}
          formatEventRange={formatEventRange}
          onHoveringChange={setEventsHovering}
          onPauseAutoScroll={() => pauseAutoScroll()}
          onScroll={scrollEvents}
          onEventClick={() => trackEvent("cta_click", { label: "events_feed", target: "/events" })}
        />
      </div>
      )}

      <LandingMobileBottomNav
        activeTab={activeMobileTab}
        isAuthenticated={isAuthenticated}
        isPaidUser={isPaidUser}
        onSelectTab={setActiveMobileTab}
        onJoin={() => navigate("/register")}
      />
    </div>
  );
}


