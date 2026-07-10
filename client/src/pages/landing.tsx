import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BannerAdRotation } from "@/components/banners/BannerAdRotation";
import { FeaturedPartnerToolCard } from "@/components/partners/FeaturedPartnerToolCard";
import { LandingCurrentConditions } from "@/components/landing/LandingCurrentConditions";
import { LandingEventsRail } from "@/components/landing/LandingEventsRail";
import { LandingModuleChooser } from "@/components/landing/LandingModuleChooser";
import { MobileBottomNav as LandingMobileBottomNav, MobilePillNav as LandingMobilePillNav, type LandingMobileTab } from "@/components/landing/MobileLandingNav";
import WeatherBriefingSummarizer from "@/components/ai/WeatherBriefingSummarizer";
import NotamTranslator from "@/components/ai/NotamTranslator";
import CabinBriefSearchForm from "@/components/CabinBriefSearchForm";
import { BookOpen, CalendarDays, Plane, CheckCircle2, AlertTriangle, Tent, UtensilsCrossed, Home, Anchor, Wrench, Calculator, ShoppingBag, FileText, Users, Search, MapPin, X, DollarSign, UserPlus, Smartphone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { pixelEvent } from "@/lib/pixel";
import { useAuth } from "@/hooks/useAuth";
import { PostActionSignupPrompt } from "@/components/conversion/PostActionSignupPrompt";
import { AppDownloadBadges } from "@/components/GooglePlayBadge";
import { clearResumeFlow, getPrimaryResumeFlow, saveResumeFlow, type ResumeFlowRecord } from "@/lib/firstSessionFlow";
import { extractAtisIdentifier, extractRunwayInUse, parseFlightCategory, parseWeatherHazards } from "@/lib/weatherInterpretation";
import { useEffect, useMemo, useRef, useState } from "react";
import av8mapsLogo from "@assets/Av8Maps.JPG";

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
  tier: "premium";
  durationDays: number;
}

type QuickLogDraft = {
  flightDate: string;
  aircraft: string;
  route: string;
  duration: string;
  remarks: string;
};

const EMPTY_QUICK_LOG_DRAFT: QuickLogDraft = {
  flightDate: "",
  aircraft: "",
  route: "",
  duration: "",
  remarks: "",
};

const LANDING_PARTNER_OFFER_SLUGS = ["cpa-3mo-pro-plus", "abs-2mo-pro-plus"] as const;

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
  const { data: partnerOffers = [] } = useQuery<MembershipPartnerOfferPublic[]>({
    queryKey: ["/api/membership-partner-offers", "landing", ...LANDING_PARTNER_OFFER_SLUGS],
    queryFn: async () => {
      const responses = await Promise.all(
        LANDING_PARTNER_OFFER_SLUGS.map(async (slug) => {
          const response = await fetch(apiUrl(`/api/membership-partner-offers/${slug}`));
          if (!response.ok) return null;
          return (await response.json()) as MembershipPartnerOfferPublic;
        })
      );
      return responses.filter((offer): offer is MembershipPartnerOfferPublic => Boolean(offer));
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
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [quickLogDraft, setQuickLogDraft] = useState<QuickLogDraft>(EMPTY_QUICK_LOG_DRAFT);
  const [resumeFlow, setResumeFlow] = useState<ResumeFlowRecord | null>(null);
  const [showLogbookSignupPrompt, setShowLogbookSignupPrompt] = useState(false);
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
  const membershipCtaLabel = isPaidUser ? "Manage Membership" : "Subscribe Now";
  const membershipCtaDescription = hasProCore && !hasProPlus
    ? "Move into the training stack, advanced sims, and higher-end pilot workflow tools."
    : isPaidUser
      ? "Open your RSF Pro page to manage plan details, trials, and membership settings."
      : "Open the dedicated RSF Pro page for plan details, feature breakdowns, and subscription links.";
  const metallicPrimaryButtonClass = "rsf-metal-button-primary";
  const metallicSecondaryButtonClass = "rsf-metal-button-secondary";
  const metallicPanelClass = "rsf-metal-panel";
  const metallicPanelInteractiveClass = "rsf-metal-panel rsf-metal-panel-interactive";
  const metallicSubpanelClass = "rsf-metal-subpanel";
  const fragmentedWorkflowCards = [
    {
      title: "Flight Planning",
      description: "Route building, alternates, performance inputs, and departure-to-destination planning.",
      icon: Plane,
    },
    {
      title: "Weather / NOTAMs",
      description: "METARs, TAFs, NOTAMs, runway advisories, and quick hazard context before launch.",
      icon: AlertTriangle,
    },
    {
      title: "Filing / Briefing",
      description: "Preflight packet review and FAA Flight Service filing from one RSF workflow.",
      icon: FileText,
    },
    {
      title: "In-Flight Tracking",
      description: "App follow-through with route awareness, traffic, and weather while en route.",
      icon: MapPin,
    },
    {
      title: "Training Tools",
      description: "Student progress, training utilities, endorsements, and post-flight follow-up.",
      icon: BookOpen,
    },
    {
      title: "Rentals / Marketplace",
      description: "Aircraft rentals, CFIs, marketplace listings, clubs, and aviation services.",
      icon: ShoppingBag,
    },
  ] as const;
  const workflowSteps = [
    {
      title: "Plan on the web",
      description: "Build the route, review weather and NOTAM context, and stage the whole flight in one web workflow.",
      icon: Plane,
    },
    {
      title: "File to the FAA",
      description: "Submit to FAA Flight Service, then pick the plan up with ATC when you are ready.",
      icon: FileText,
    },
    {
      title: "Continue in the app",
      description: "Open the same flight in the app with full FMS capability instead of starting over on another device.",
      icon: Smartphone,
    },
    {
      title: "Fly with live awareness",
      description: "See live traffic, en route weather, and ADS-B-connected situational awareness as the flight unfolds.",
      icon: CheckCircle2,
    },
  ] as const;
  const ecosystemCards = [
    {
      title: "Planning and Flight Following",
      description: "Web planning, FAA filing, app follow-through, live traffic, and en route weather in one lane.",
      icon: Plane,
      actions: [
        { label: "Flight Planner", href: "/flight-planner", track: "landing_ecosystem_flight_planner" },
        { label: "ADS-B Setup", href: "/adsb-receiver-help", track: "landing_ecosystem_adsb_help" },
      ],
    },
    {
      title: "Training and Logbook",
      description: "Training tools, endorsements, student progress, currency, and post-flight records on the same account.",
      icon: BookOpen,
      actions: [
        { label: "Student Hub", href: "/student", track: "landing_ecosystem_student_hub" },
        { label: "Logbook", href: "/logbook", track: "landing_ecosystem_logbook" },
      ],
    },
    {
      title: "Marketplace and Rentals",
      description: "Browse aircraft rentals, listings, CFIs, clubs, and aviation services without leaving RSF.",
      icon: ShoppingBag,
      actions: [
        { label: "Marketplace", href: "/marketplace", track: "landing_ecosystem_marketplace" },
        { label: "Rentals", href: "/rentals", track: "landing_ecosystem_rentals" },
      ],
    },
    {
      title: "Pilot Tools and Utilities",
      description: "E6B, weather utilities, passenger briefings, and day-of-flight pilot tools stay close to the plan.",
      icon: Calculator,
      actions: [
        { label: "Tool Hub", href: "/tool-hub", track: "landing_ecosystem_tool_hub" },
        { label: "Cabin Brief", href: "/cabin-brief", track: "landing_ecosystem_cabin_brief" },
      ],
    },
  ] as const;
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
    setResumeFlow(getPrimaryResumeFlow());
  }, []);

  useEffect(() => {
    if (resumeFlow?.type !== "logbook" || !resumeFlow.payload) return;
    const hasCurrentDraft = Object.values(quickLogDraft).some((value) => String(value || "").trim().length > 0);
    if (hasCurrentDraft) return;
    setQuickLogDraft((current) => ({
      flightDate: typeof resumeFlow.payload?.flightDate === "string" ? resumeFlow.payload.flightDate : current.flightDate,
      aircraft: typeof resumeFlow.payload?.aircraft === "string" ? resumeFlow.payload.aircraft : current.aircraft,
      route: typeof resumeFlow.payload?.route === "string" ? resumeFlow.payload.route : current.route,
      duration: typeof resumeFlow.payload?.duration === "string" ? resumeFlow.payload.duration : current.duration,
      remarks: typeof resumeFlow.payload?.remarks === "string" ? resumeFlow.payload.remarks : current.remarks,
    }));
  }, [quickLogDraft, resumeFlow]);

  useEffect(() => {
    const hasDraftContent = Object.values(quickLogDraft).some((value) => String(value || "").trim().length > 0);
    if (!hasDraftContent) return;
    saveResumeFlow({
      type: "logbook",
      title: "Log your first flight",
      description: "Your first flight draft is ready to finish when you come back.",
      target: "landing-logbook",
      updatedAt: Date.now(),
      payload: quickLogDraft,
    });
    setResumeFlow(getPrimaryResumeFlow());
  }, [quickLogDraft]);

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

  const handleFirstActionClick = (action: "planner" | "logbook" | "rentals") => {
    trackEvent("first_action_clicked", { action, page: "/" });
    if (action === "planner") {
      navigate("/flight-planner?source=first_action");
      return;
    }
    if (action === "rentals") {
      navigate("/rentals?source=first_action");
      return;
    }
    if (isAuthenticated) {
      navigate("/logbook");
      return;
    }
    setIsQuickLogOpen(true);
  };

  const handleSaveQuickLogDraft = () => {
    const normalizedDraft: QuickLogDraft = {
      flightDate: quickLogDraft.flightDate,
      aircraft: quickLogDraft.aircraft.trim(),
      route: quickLogDraft.route.trim().toUpperCase(),
      duration: quickLogDraft.duration.trim(),
      remarks: quickLogDraft.remarks.trim(),
    };

    saveResumeFlow({
      type: "logbook",
      title: "Log your first flight",
      description: "Your first flight draft is ready to finish when you come back.",
      target: "landing-logbook",
      updatedAt: Date.now(),
      payload: normalizedDraft,
    });
    setResumeFlow(getPrimaryResumeFlow());
    setQuickLogDraft(normalizedDraft);
    setIsQuickLogOpen(false);
    if (!isAuthenticated) {
      setShowLogbookSignupPrompt(true);
    }
  };

  const handleContinueFlow = () => {
    if (!resumeFlow) return;
    trackEvent("continue_flow_clicked", { flow: resumeFlow.type, target: resumeFlow.target });
    if (resumeFlow.type === "logbook") {
      setIsQuickLogOpen(true);
      return;
    }
    navigate(resumeFlow.target);
  };

  const dismissResumeFlow = () => {
    if (!resumeFlow) return;
    clearResumeFlow(resumeFlow.type);
    setResumeFlow(getPrimaryResumeFlow());
  };
  
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <LandingMobilePillNav
        activeTab={activeMobileTab}
        isAuthenticated={isAuthenticated}
        isPaidUser={isPaidUser}
        onSelectTab={setActiveMobileTab}
      />
      <div className="border-b border-[#5d6f85]/18 bg-[#0d1219]">
        <div className="container mx-auto px-4 py-2.5">
          <div className="flex flex-col gap-2 rounded-xl border border-[#5d6f85]/22 bg-[linear-gradient(135deg,rgba(17,24,34,0.96),rgba(24,33,45,0.92))] px-4 py-3 text-[#E8EDF4] shadow-[0_18px_50px_-35px_rgba(0,0,0,0.9)] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Badge className="border border-[#D9A441]/35 bg-[#D9A441]/12 text-[#F6D788] hover:bg-[#D9A441]/12">
                New flat rate
              </Badge>
              <div className="text-sm font-semibold text-[#F5F8FC]">
                Full RSF Premium access for $7.99/month.
              </div>
              <div className="text-xs text-[#A9BBCD]">
                Unlimited active flight plans, AI tools, logbook, training, and advanced aviation features.
              </div>
            </div>
            <Button
              asChild
              size="sm"
              className="h-8 shrink-0 rounded-lg bg-[#4F8DFF] px-3 text-xs font-semibold text-white hover:bg-[#3F7BE8]"
              onClick={() => {
                trackEvent("subscription_cta_click", {
                  source_page: "/",
                  target: "/logbook/pro",
                  context: "landing_premium_banner",
                  tier: "premium",
                });
              }}
            >
              <Link href="/logbook/pro">Upgrade to Premium</Link>
            </Button>
          </div>
        </div>
      </div>
      {activeMobileTab === "weather" && (
        <div className="md:hidden">
          <div className="container mx-auto space-y-4 px-4 pt-4 text-[#E8EDF4]">
            <Card className={`${metallicPanelClass} overflow-visible rounded-[1.2rem]`}>
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
                      className="border-[#55657a]/35 bg-[#11161d] pr-10 text-[#F1F5FA] placeholder:text-[#708299]"
                    />
                    <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#90a6c0]" />
                    {(loadingSuggestions || airportSuggestions.length > 0) && (
                      <div className="absolute z-20 mt-2 w-full rounded-xl border border-[#55657a]/35 bg-[#11161d] shadow-[0_20px_40px_-28px_rgba(0,0,0,0.9)]">
                        {loadingSuggestions ? (
                          <div className="px-3 py-2 text-xs text-[#91a8c3]">Searching airports...</div>
                        ) : (
                          <ul className="max-h-56 overflow-auto">
                            {airportSuggestions.map((suggestion) => (
                              <li key={suggestion.icao}>
                                <button
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => applySuggestion(suggestion)}
                                  className="w-full px-3 py-2 text-left text-sm text-[#E8EDF4] transition-colors hover:bg-[#18212d]"
                                >
                                  <div className="font-semibold text-[#F1F5FA]">{suggestion.icao}</div>
                                  <div className="text-xs text-[#91a8c3]">
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
                      <div className="mt-2 text-xs text-[#91a8c3]">
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
                    className={`w-full ${metallicSecondaryButtonClass}`}
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
                <Badge variant="outline" className="border-[#5b6e87]/35 bg-[#131923] text-[#9db8d8]">
                  Active RWY: {runwayInUseDisplay}
                </Badge>
              )}
              {atisInfo && (
                <Badge variant="outline" className="border-[#5c74a3]/40 bg-[#141b28] text-[#9fc0ff]">
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
                        : "border-[#5c74a3]/40 bg-[#141b28] text-[#9fc0ff]"
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
              <p className="text-sm text-[#91a8c3]">No METAR data available.</p>
            )}

            {weather?.taf && (
              <div>
                <Label className="text-sm font-semibold text-[#F1F5FA]">TAF (Forecast)</Label>
                <p className="mt-1 rounded-md border border-[#203249] bg-[#0d1622] p-3 font-mono text-sm whitespace-pre-wrap break-all text-[#8FC7FF]">
                  {weather.taf.rawTAF}
                </p>
              </div>
            )}

            <div className={`${metallicSubpanelClass} rounded-[1rem] p-4`}>
              <div className="mb-3 space-y-1">
                <div className="text-sm font-semibold text-[#F1F5FA]">AI weather briefing</div>
                <div className="text-xs text-[#91a8c3]">
                  Plain-English summary of METAR and TAF for {searchIcao}.
                </div>
              </div>
                <Button
                  type="button"
                  size="sm"
                  className={`w-full ${metallicPrimaryButtonClass}`}
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

            <div className={`${metallicSubpanelClass} rounded-[1rem] p-4`}>
              <div className="mb-3 space-y-1">
                <div className="text-sm font-semibold text-[#F1F5FA]">AI NOTAM translator</div>
                <div className="text-xs text-[#91a8c3]">
                  Plain-English operational impacts for active NOTAMs at {searchIcao}.
                </div>
              </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={`w-full ${metallicSecondaryButtonClass}`}
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
                  <div key={item.id} className={`${metallicSubpanelClass} space-y-1 rounded-[0.95rem] p-3 text-xs text-[#E8EDF4]`}>
                    <div className="font-semibold">{item.text}</div>
                    {(item.effective || item.expires) && (
                      <div className="text-[#91a8c3]">
                        {item.effective ? `Effective ${item.effective}` : ""}
                        {item.expires ? ` - Expires ${item.expires}` : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            {runwayBriefing?.advisory && (
              <div className={`${metallicSubpanelClass} rounded-[0.95rem] p-3 text-sm text-[#E8EDF4]`}>
                <Label className="mb-2 block text-sm font-semibold text-[#F1F5FA]">Runway Advisory</Label>
                <div className="sr-only">
                  <Badge variant="outline">Recommended: {runwayBriefing.advisory.runway}</Badge>
                  <span className="text-xs text-[#91a8c3]">
                    Headwind {runwayBriefing.advisory.headwind} kt - Crosswind {runwayBriefing.advisory.crosswind} kt
                  </span>
                </div>
                <p className="mt-2 text-xs text-[#91a8c3]">
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

            <Alert className="border-[#596778]/35 bg-[linear-gradient(180deg,rgba(31,34,40,0.96),rgba(20,23,28,0.98))] text-[#E8EDF4]">
              <AlertTriangle className="h-4 w-4 text-[#9ec0ff]" />
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
            <p className="text-sm text-[#91a8c3]">
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
                <div className={`${metallicPanelInteractiveClass} flex h-full flex-col gap-2 rounded-[1.05rem] p-4`}>
                  <item.icon className="h-4 w-4 text-[#9ec0ff]" />
                  <div className="text-sm font-semibold leading-tight text-[#F1F5FA]">{item.label}</div>
                  <div className="text-xs leading-snug text-[#a7b8cd]">{item.desc}</div>
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
                <p className="text-sm text-[#91a8c3]">
                  Track flights, endorsements, and currency.
                </p>
              </div>
              <Button asChild className={`w-full ${metallicPrimaryButtonClass}`} size="lg">
                <Link
                  href="/logbook"
                  onClick={() => trackEvent("cta_click", { label: "mobile_log_tab_open_logbook", target: "/logbook" })}
                >
                  Open digital logbook
                </Link>
              </Button>
              {hasProPlus ? (
                <Button asChild variant="outline" className={`w-full ${metallicSecondaryButtonClass}`}>
                  <Link href="/cfi/training-center">CFI Training Center</Link>
                </Button>
              ) : (
                <div className={`${metallicSubpanelClass} rounded-[1rem] p-4 text-sm text-[#E8EDF4]`}>
                  <div className="mb-1 font-semibold text-[#F1F5FA]">Upgrade to Premium</div>
                  <p className="mb-3 text-xs text-[#9bb1cc]">
                    Unlock GPS simulators and the CFI training center.
                  </p>
                  <Button asChild size="sm" className={`w-full ${metallicPrimaryButtonClass}`}>
                    <Link href="/logbook/pro">Upgrade to Premium</Link>
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-[#F1F5FA]">Free digital logbook</h2>
                <p className="text-sm text-[#91a8c3]">
                  Log flights with the basic RSF logbook now. Upgrade for saved plans, enhanced tracking, and Pro features.
                </p>
              </div>
              <div className={`${metallicSubpanelClass} rounded-[1rem] p-4 text-sm text-[#E8EDF4]`}>
                <div className="font-semibold text-[#F1F5FA]">Included with a free account</div>
                <ul className="mt-2 space-y-2 text-xs text-[#91a8c3]">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#9ec0ff]" />
                    Basic digital logbook access
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#9ec0ff]" />
                    Core flight entry and tracking
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#9ec0ff]" />
                    Upgrade when you need saved plans and enhanced tools
                  </li>
                </ul>
              </div>
              <Button asChild className={`w-full ${metallicPrimaryButtonClass}`} size="lg">
                <Link
                  href="/logbook"
                  onClick={() => trackEvent("cta_click", { label: "mobile_log_tab_open_logbook", target: "/logbook" })}
                >
                  Open free logbook
                </Link>
              </Button>
              <Button asChild variant="outline" className={`w-full ${metallicSecondaryButtonClass}`}>
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
          <Card className={`${metallicPanelClass} text-[#E8EDF4]`}>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="rsf-kicker">RSF Pro</span>
                <Badge variant="outline" className="border-[#5b6e87]/35 bg-[#131923] text-[#9db8d8]">
                  Plans moved off this page
                </Badge>
              </div>
              <div className="space-y-2">
                <CardTitle className="text-xl text-[#F1F5FA]">Open the dedicated membership page.</CardTitle>
                <CardDescription className="text-sm text-[#91a8c3]">
                  {membershipCtaDescription}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className={`w-full ${metallicPrimaryButtonClass}`}>
                <Link
                  href={membershipPageHref}
                  onClick={() => trackEvent("cta_click", { label: "mobile_pricing_tab_membership_cta", target: membershipPageHref })}
                >
                  {membershipCtaLabel}
                </Link>
              </Button>
              <p className="text-xs text-[#91a8c3]">
                The RSF Pro page now carries the full plan details, trial language, and subscribe flows.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      {!weatherJumpDismissed && !hasUsedWeatherTool && (
        <div className="hidden border-b border-white/10 bg-[linear-gradient(180deg,rgba(19,23,29,0.98),rgba(10,12,16,0.98))] md:block">
          <div className="container mx-auto px-4 py-3">
            <div className={`${metallicPanelClass} flex flex-col gap-3 rounded-[1.15rem] px-4 py-3 md:flex-row md:items-center md:justify-between`}>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9fb3ca]">Weather &amp; NOTAM Briefing</p>
                <p className="text-sm font-semibold text-[#EEF4FF]">Get current airport weather and NOTAMs</p>
                <p className="text-xs text-[#a2b5cc]">
                  Check live METARs, TAFs, runway conditions, and airport briefing details from the landing page.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className={metallicPrimaryButtonClass}
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
                  className="h-8 w-8 text-[#91a8c3] hover:bg-white/5 hover:text-[#EEF4FF]"
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
                <Button size="lg" asChild className={metallicPrimaryButtonClass} data-testid="button-marketplace">
                      <Link
                        href="/marketplace"
                        onClick={() => trackEvent("cta_click", { label: "landing_marketplace", target: "/marketplace" })}
                      >
                        Browse listings
                      </Link>
                    </Button>
                <Button size="lg" variant="outline" asChild className={metallicSecondaryButtonClass} data-testid="button-rentals">
                      <Link
                        href="/rentals"
                        onClick={() => trackEvent("cta_click", { label: "landing_rentals", target: "/rentals" })}
                      >
                        Find rentals
                      </Link>
                    </Button>
                <Button size="lg" variant="outline" asChild className={metallicSecondaryButtonClass} data-testid="button-plan-flight">
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
                      className={metallicSecondaryButtonClass}
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
              <div className={`${metallicPanelClass} rounded-[1.1rem] p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a8bedf]">
                      Featured Sponsor
                    </div>
                    <div className="text-sm text-[#C0CDDC]">
                      Aviation businesses can appear here in a clean sponsored placement inside RSF.
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className={metallicSecondaryButtonClass} data-testid="button-banner-ad-info-public">
                    <a href="/banner-advertise" target="_blank" rel="noopener noreferrer">
                      Advertise
                    </a>
                  </Button>
                </div>
                <BannerAdRotation
                  placement="home"
                  variant="compact"
                  showLeadIn={false}
                  className="mt-4"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rsf-metal-hero relative overflow-hidden">
        <div className="container mx-auto px-4 py-12 md:py-16 xl:py-20">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] xl:items-start">
            <div className="space-y-6">
              <div className="rsf-kicker text-[#bfd0e8]">
                <Plane className="h-3.5 w-3.5 text-[#8eb3ff]" />
                General Aviation Ecosystem
              </div>
              <div className="space-y-4">
                <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.045em] text-[#F6F8FC] sm:text-5xl xl:text-6xl [font-family:var(--font-display)]">
                  Plan, train, fly, and manage your aviation workflow.
                  <span className="block text-[#cdd9ee]">Ready Set Fly keeps the pilot workflow in one place.</span>
                </h1>
                <p className="max-w-3xl text-lg leading-8 text-[#CCD6E4]">
                  Plan, train, fly, and manage your aviation workflow in one place. Start with a flight plan, then review weather, route context, aircraft records, training tools, and marketplace access without hunting through disconnected menus.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  "One shared workflow from planning to post-flight follow-through",
                  "Web-to-app continuity instead of disconnected tools",
                  "Live flight plan submission to FAA Flight Service",
                  "Training, rentals, marketplace, and pilot tools under one account",
                ].map((item) => (
                  <div key={item} className={`${metallicSubpanelClass} px-4 py-3 text-sm text-[#E0E7F1]`}>
                    {item}
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className={metallicPrimaryButtonClass}>
                  <Link
                    href="/flight-planner"
                    onClick={() => trackEvent("cta_click", { label: "landing_hero_open_planner", target: "/flight-planner" })}
                  >
                    Start Flight Plan
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className={metallicSecondaryButtonClass}
                  onClick={() => {
                    trackEvent("cta_click", { label: "landing_hero_explore_tools", target: "#landing-workflow-section" });
                    document.getElementById("landing-workflow-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  Explore Tools
                </Button>
              </div>
              <AppDownloadBadges
                source="landing_hero"
                className="sm:inline-block"
              />
              <p className="text-sm text-[#9aafcc] leading-relaxed">
                Pilots are already using RSF to plan, file, and track flights in one place.{" "}
                <span className="text-[#c0d0e8]">Free to use. No account required to start planning.</span>
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#A8B8CC]">
                <Badge variant="outline" className="border-[#5d6f85]/35 bg-[#141a22] text-[#d2dbe8]">US-only</Badge>
                <span className="tracking-[0.16em] text-[#8fa6c8]">Plan. Train. Fly. Manage.</span>
              </div>
            </div>

            <div className="space-y-4 xl:pt-2">
              <Card className={`${metallicPanelClass} overflow-hidden text-[#E8EDF4]`}>
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="rsf-metal-divider flex flex-wrap items-center justify-between gap-3 pb-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.24em] text-[#9cb8df]">Web-to-App Continuity</div>
                      <div className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[#F6F8FC]">One flight, one workflow, one ecosystem.</div>
                    </div>
                    <Badge variant="outline" className="border-[#5a7398]/35 bg-[#141d29] text-[#d6e4ff]">
                      Live FAA filing
                    </Badge>
                  </div>
                  <div className="grid gap-3">
                    {workflowSteps.map((step, index) => (
                      <div key={step.title} className={`${metallicPanelInteractiveClass} rounded-[1rem] p-4`}>
                        <div className="flex items-start gap-3">
                          <div className="rsf-metal-icon-chip flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#9ebdff]">
                            <step.icon className="h-4 w-4" />
                          </div>
                          <div className="space-y-1">
                            <div className="text-[10px] uppercase tracking-[0.2em] text-[#94aed3]">Step {index + 1}</div>
                            <div className="text-sm font-semibold text-[#F6F8FC]">{step.title}</div>
                            <div className="text-sm leading-6 text-[#B8C8DA]">{step.description}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      "Full FMS capability in the app",
                      "Live traffic and en route weather",
                      "ADS-B system connectivity",
                      "Shared plans and follow-through across devices",
                    ].map((item) => (
                      <div key={item} className={`${metallicSubpanelClass} rounded-[0.95rem] px-3 py-2 text-sm text-[#E0E7F1]`}>
                        {item}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2 xl:items-stretch">
            <Card className={`${metallicPanelClass} h-full text-[#E8EDF4]`}>
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a8bedf]">
                      RSF Partner Membership Offers
                    </div>
                    <div className="max-w-2xl text-sm leading-6 text-[#CCD7E5]">
                      Aircraft owners and pilots from student to ATP are already flying with RSF. Partner organizations can route members into a free RSF account and unlock time-limited RSF Premium access through a dedicated offer flow.
                    </div>
                  </div>
                  {partnerOffers.length > 0 ? (
                    <Badge className="border border-[#5d6f85]/35 bg-[#141d29] text-[#d6e4ff] hover:bg-[#141d29]">
                      {partnerOffers.length} active member offer{partnerOffers.length === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                </div>
                {partnerOffers.length > 0 ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {partnerOffers.map((offer) => {
                      const offerHref = offer.slug === "abs-2mo-pro-plus"
                        ? "/abs/redeem"
                        : `/logbook/pro?offer=${encodeURIComponent(offer.slug)}`;
                      const partnerShortLabel =
                        offer.slug.startsWith("cpa-")
                          ? "CPA Exclusive"
                          : offer.slug.startsWith("abs-")
                            ? "ABS Exclusive"
                            : "Partner Exclusive";
                      return (
                        <div key={offer.id} className={`${metallicSubpanelClass} rounded-[1rem] p-5`}>
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Badge className="border border-[#5d6f85]/35 bg-[#151b23] text-[#dbe6f6] hover:bg-[#151b23]">{partnerShortLabel}</Badge>
                            <Badge className="border border-[#5d6f85]/35 bg-[#141d29] text-[#d6e4ff] hover:bg-[#141d29]">
                              RSF Premium
                            </Badge>
                          </div>
                          <h3 className="mb-2 text-lg font-semibold text-[#F5F8FC]">
                            {offer.durationDays / 30} months free for {offer.partnerName} members
                          </h3>
                          <p className="mb-4 text-sm text-[#CCD7E5]">
                            {offer.description?.trim() || "Claim the partner offer and keep planning, filing, and flight follow-through inside one connected RSF workflow."}
                          </p>
                          <Button asChild className={`w-full sm:w-auto ${metallicPrimaryButtonClass}`}>
                            <Link
                              href={offerHref}
                              onClick={() => trackEvent("cta_click", { label: `landing_partner_offer_${offer.slug}`, target: offerHref })}
                            >
                              Claim {offer.slug.startsWith("abs-") ? "ABS" : offer.slug.startsWith("cpa-") ? "CPA" : "partner"} offer
                            </Link>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className={`${metallicPanelClass} flex h-full flex-col rounded-[1.15rem] p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a8bedf]">
                    Featured Sponsor
                  </div>
                  <div className="text-sm text-[#C0CDDC]">
                    Premium aviation partner placement integrated into the RSF homepage.
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className={metallicSecondaryButtonClass}>
                  <a href="/banner-advertise" target="_blank" rel="noopener noreferrer">
                    Advertise
                  </a>
                </Button>
              </div>
              <BannerAdRotation
                placement="home"
                variant="compact"
                showLeadIn={false}
                className="mt-4 flex-1"
              />
            </div>
          </div>
        </div>
      </div>

      <section id="landing-workflow-section" className="rsf-metal-section border-y border-white/8 px-4 py-8 sm:py-10">
        <div className="container mx-auto space-y-8">
          <div className="max-w-3xl space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9cb8df]">Pilot workflow</div>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[#F5F8FC] sm:text-3xl">
              Start where pilots actually start.
            </h2>
            <p className="text-sm leading-6 text-[#B8C8DA]">
              RSF is organized around the work: plan the flight, fly smarter, train and track progress, then manage the records and aircraft details that support the next flight.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: "Plan a Flight",
                copy: "Build routes, review weather, brief airports, and prepare flight plans.",
                cta: "Open Flight Planner",
                href: "/flight-planner",
                icon: Plane,
              },
              {
                title: "Fly Smarter",
                copy: "Use flight deck, ADS-B, synthetic vision, and route awareness tools.",
                cta: "Explore Flight Tools",
                href: "/live-traffic",
                icon: Smartphone,
              },
              {
                title: "Train & Track",
                copy: "Student tools, logbook, syllabi, currency tracking, and proficiency tools.",
                cta: "Open Training Hub",
                href: "/student",
                icon: BookOpen,
              },
              {
                title: "Manage Aviation",
                copy: "Aircraft profiles, records, ownership tools, listings, and notifications.",
                cta: "Open Dashboard",
                href: "/dashboard",
                icon: FileText,
              },
            ].map((card) => (
              <div key={card.title} className={`${metallicPanelInteractiveClass} flex h-full flex-col rounded-[1.2rem] p-5 text-[#E8EDF4]`}>
                <div className="rsf-metal-icon-chip mb-4 flex h-11 w-11 items-center justify-center rounded-full text-[#9ebdff]">
                  <card.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-[#F5F8FC]">{card.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-[#B8C8DA]">{card.copy}</p>
                <Button asChild className={`mt-4 w-full ${card.href === "/flight-planner" ? metallicPrimaryButtonClass : metallicSecondaryButtonClass}`} variant={card.href === "/flight-planner" ? "default" : "outline"}>
                  <Link href={card.href}>{card.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
          <div className={`${metallicPanelClass} rounded-[1.25rem] p-5 text-[#E8EDF4] sm:p-6`}>
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9cb8df]">Featured capability</div>
                <h2 className="mt-2 text-2xl font-semibold text-[#F5F8FC]">Weather-Aware Route Planning</h2>
              </div>
              <p className="text-sm leading-6 text-[#B8C8DA]">
                RSF can assist route planning by evaluating weather and route conditions before the pilot reviews and files. The workflow is AI-assisted, weather-aware, and pilot-reviewed; route suggestions support judgment, they do not replace it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="landing-quickstart-section" className="rsf-metal-section border-y border-white/8 px-4 py-8 sm:py-10">
        <div className="container mx-auto">
          <div className="space-y-6">
            <div className="max-w-2xl space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9cb8df]">First action</div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[#F5F8FC] sm:text-3xl">
                Start with something useful
              </h2>
              <p className="text-sm leading-6 text-[#B8C8DA]">
                Try one of these — no account needed.
              </p>
            </div>

            {resumeFlow ? (
              <div className={`${metallicPanelClass} flex flex-col gap-4 rounded-[1.15rem] p-4 text-[#E8EDF4] sm:flex-row sm:items-center sm:justify-between`}>
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9cb8df]">Finish what you started</div>
                  <div className="text-base font-semibold text-[#F5F8FC]">{resumeFlow.title}</div>
                  <div className="text-sm text-[#AFC1D6]">{resumeFlow.description}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" className={metallicPrimaryButtonClass} onClick={handleContinueFlow}>
                    {resumeFlow.type === "listing"
                      ? "Complete your aircraft listing"
                      : resumeFlow.type === "verification"
                        ? "Finish your verification"
                        : "Log your first flight"}
                  </Button>
                  <Button type="button" variant="outline" className={metallicSecondaryButtonClass} onClick={dismissResumeFlow}>
                    Dismiss
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
              <div className={`${metallicPanelInteractiveClass} rounded-[1.25rem] p-5 text-[#E8EDF4]`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9cb8df]">Recommended first step</div>
                    <div className="text-xl font-semibold tracking-[-0.02em] text-[#F5F8FC]">
                      Plan your route, weather, and hazards (~2 min)
                    </div>
                    <p className="text-sm leading-6 text-[#B8C8DA]">
                      Build your route, weather, and hazards in one place before you create an account.
                    </p>
                  </div>
                  <Badge variant="outline" className="border-[#5d6f85]/35 bg-[#141d29] text-[#d6e4ff]">
                    About 2 minutes
                  </Badge>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button type="button" className={metallicPrimaryButtonClass} onClick={() => handleFirstActionClick("planner")}>
                    Open Flight Planner
                  </Button>
                </div>
              </div>

              <div className={`${metallicPanelInteractiveClass} rounded-[1.25rem] p-5 text-[#E8EDF4]`}>
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9cb8df]">Quick logbook start</div>
                  <div className="text-lg font-semibold tracking-[-0.02em] text-[#F5F8FC]">Log your first flight</div>
                  <p className="text-sm leading-6 text-[#B8C8DA]">
                    Start tracking your hours with a simple first entry in about a minute.
                  </p>
                </div>
                <div className="mt-5">
                  <Button type="button" variant="outline" className={metallicSecondaryButtonClass} onClick={() => handleFirstActionClick("logbook")}>
                    Open quick log
                  </Button>
                </div>
              </div>

              <div className={`${metallicPanelInteractiveClass} rounded-[1.25rem] p-5 text-[#E8EDF4]`}>
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9cb8df]">Aircraft search</div>
                  <div className="text-lg font-semibold tracking-[-0.02em] text-[#F5F8FC]">Explore aircraft rentals</div>
                  <p className="text-sm leading-6 text-[#B8C8DA]">
                    Find aircraft near you and compare options without leaving RSF.
                  </p>
                </div>
                <div className="mt-5">
                  <Button type="button" variant="outline" className={metallicSecondaryButtonClass} onClick={() => handleFirstActionClick("rentals")}>
                    Browse rentals
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="rsf-metal-section px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-3 text-center">
            <p className="text-sm font-medium text-[#E1E8F2]">Check live conditions while you plan</p>
            <p className="text-xs text-[#98AEC8]">Quick airport weather, runway, and NOTAM context without leaving the homepage.</p>
          </div>
          <div className="relative flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Input
                value={icaoInput}
                onChange={(e) => setIcaoInput(e.target.value)}
                onBlur={submitIcao}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); refreshAirportConditions(); }
                }}
                placeholder="ICAO or city, e.g. KAUS"
                className="h-12 border-[#4c5d73]/35 bg-[#0f1318] font-mono text-base text-[#F3F7FC] placeholder:text-[#60758f]"
              />
              {(loadingSuggestions || airportSuggestions.length > 0) && (
                 <div className="absolute z-20 mt-1 w-full rounded-md border border-[#47576c]/35 bg-[#11161d] shadow-lg">
                  {loadingSuggestions ? (
                    <div className="px-3 py-2 text-xs text-[#91a8c3]">Searching airports...</div>
                  ) : (
                    <ul className="max-h-52 overflow-auto">
                      {airportSuggestions.map((s) => (
                        <li key={s.icao}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applySuggestion(s)}
                            className="w-full px-3 py-2 text-left text-sm text-[#E8EDF4] transition-colors hover:bg-[#18202a]"
                          >
                            <div className="font-semibold font-mono text-[#F1F5FA]">{s.icao}</div>
                            <div className="text-xs text-[#91a8c3]">
                              {[s.name, s.city, s.state].filter(Boolean).join(" / ")}
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
              className={`h-12 shrink-0 px-6 ${metallicPrimaryButtonClass}`}
            >
              Check Conditions
            </Button>
          </div>
        </div>
      </div>

      <section className="rsf-metal-section">
        <div className="container mx-auto px-4 py-14 sm:py-16">
          <div className="max-w-3xl space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9cb8df]">Why RSF Exists</div>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#F5F8FC] sm:text-4xl">
              Still juggling multiple aviation apps?
            </h2>
            <p className="text-base leading-7 text-[#C0CDDC]">
              Most GA pilots bounce between separate tools for flight planning, weather, NOTAMs, filing, in-flight tracking, training, rentals, and marketplace activity. RSF brings those workflows back into one aviation-native platform.
            </p>
          </div>
          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {fragmentedWorkflowCards.map((item) => (
                <div key={item.title} className={`${metallicPanelInteractiveClass} rounded-[1.1rem] p-5`}>
                  <div className="rsf-metal-icon-chip flex h-11 w-11 items-center justify-center rounded-[0.85rem] text-[#9ebdff]">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="mt-4 text-base font-semibold text-[#F5F8FC]">{item.title}</div>
                  <p className="mt-2 text-sm leading-6 text-[#B8C8DA]">{item.description}</p>
                </div>
              ))}
            </div>
            <Card className={`${metallicPanelClass} text-[#E8EDF4]`}>
              <CardContent className="space-y-5 p-6">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#9cb8df]">Unified Answer</div>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[#F5F8FC]">RSF keeps the flight, the tools, and the follow-through on one system.</h3>
                </div>
                <div className="space-y-3">
                  {[
                    "One route can flow from web planning into the app instead of being rebuilt from scratch.",
                    "One account connects filing, logbook, training, rentals, marketplace, and utilities.",
                    "One ecosystem keeps the pilot workflow connected before, during, and after the flight.",
                  ].map((item) => (
                    <div key={item} className={`${metallicSubpanelClass} rounded-[0.95rem] px-4 py-3 text-sm leading-6 text-[#DCE6F2]`}>
                      {item}
                    </div>
                  ))}
                </div>
                <Button asChild className={`w-full ${metallicPrimaryButtonClass}`}>
                  <Link
                    href="/register"
                    onClick={() => trackEvent("cta_click", { label: "landing_fragmentation_register", target: "/register" })}
                  >
                    Create Free Account
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="rsf-metal-section">
        <div className="container mx-auto px-4 py-14 sm:py-16">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:items-start">
            <div className="space-y-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9cb8df]">Serious Differentiator</div>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#F5F8FC] sm:text-4xl">
                Plan on the web. File with the FAA. Follow the flight in the app.
              </h2>
              <p className="text-base leading-7 text-[#C0CDDC]">
                RSF is built around continuity. Start the flight plan on the web, submit it to FAA Flight Service, pick it up with ATC when ready, then continue the flight in the app with the same operational context still intact.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  "Full FMS capability in the mobile app",
                  "Live traffic and en route weather",
                  "ADS-B connectivity for compatible setups",
                  "FAA filing workflow without switching platforms",
                ].map((item) => (
                  <div key={item} className={`${metallicSubpanelClass} rounded-[1rem] px-4 py-3 text-sm text-[#E0E7F1]`}>
                    {item}
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild className={metallicPrimaryButtonClass}>
                  <Link
                    href="/flight-planner"
                    onClick={() => trackEvent("cta_click", { label: "landing_workflow_open_planner", target: "/flight-planner" })}
                  >
                    Start on the Web
                  </Link>
                </Button>
                <Button asChild variant="outline" className={metallicSecondaryButtonClass}>
                  <Link
                    href="/adsb-receiver-help"
                    onClick={() => trackEvent("cta_click", { label: "landing_workflow_adsb_help", target: "/adsb-receiver-help" })}
                  >
                    See ADS-B Connectivity
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              {workflowSteps.map((step, index) => (
                <div key={step.title} className={`${metallicPanelInteractiveClass} rounded-[1.15rem] p-5 text-[#E8EDF4]`}>
                  <div className="flex items-start gap-4">
                    <div className="rsf-metal-icon-chip flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#9ebdff]">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-[#9cb8df]">Phase {index + 1}</div>
                      <div className="text-lg font-semibold text-[#F5F8FC]">{step.title}</div>
                      <div className="text-sm leading-6 text-[#B8C8DA]">{step.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {activeMobileTab === "find" && (
        <div className="border-b border-[#203249] bg-[#0a0e14] md:hidden">
          <div className="container mx-auto px-4 py-4">
            <Card className={`${metallicPanelClass} shadow-none`}>
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9fb3ca]">
                    Cabin Brief - For Passengers
                  </div>
                  <div className="text-base font-semibold text-[#F1F5FA]">
                    Traveling with someone who is not a pilot?
                  </div>
                  <div className="text-sm text-[#a7b8cd]">
                    Open a plain-English weather briefing built for passengers and nervous flyers.
                  </div>
                </div>
                <Button
                  asChild
                  className={`w-full ${metallicPrimaryButtonClass}`}
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
            <div className={`${metallicPanelClass} flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between`}>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-[#F5F8FC]">
                  Save searches, log flights, and unlock every RSF tool.
                </p>
                <p className="text-xs text-[#A1B5CC]">
                  Free account — no credit card. Upgrade to Pro anytime with a 14-day trial.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button asChild size="sm" className={metallicPrimaryButtonClass}>
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
                <Button asChild size="sm" variant="outline" className={metallicSecondaryButtonClass}>
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

      <div id="landing-ecosystem-section" className="hidden rsf-section-band py-8 sm:py-10 md:block">
        <div className="container mx-auto px-4">
          <div className={`grid gap-6 ${!hasProPlus ? "xl:grid-cols-[minmax(0,1.12fr)_320px]" : ""}`}>
            <section className={`${metallicPanelClass} rounded-[1.45rem] p-5 text-[#E8EDF4] sm:p-6 ${activeMobileTab === "find" || activeMobileTab === "plan" || activeMobileTab === "log" ? "" : "hidden md:block"}`}>
              <div className="mb-6 space-y-2">
                <span className="rsf-kicker text-[#bfd0e8]">The Full RSF Ecosystem</span>
                <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[#F5F8FC] sm:text-3xl">Beyond the flight plan, everything else stays connected too.</h2>
                <p className="max-w-3xl text-sm text-[#AFC1D6]">RSF is not only a planner. It keeps training, logbook, marketplace, rentals, pilot tools, and follow-through tied back to the same aviation workflow.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {ecosystemCards.map((card) => (
                  <div key={card.title} className={`${metallicPanelInteractiveClass} flex flex-col gap-4 rounded-[1.15rem] p-5`}>
                    <div className="flex items-center gap-3">
                      <div className="rsf-metal-icon-chip flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.75rem]">
                        <card.icon className="h-5 w-5 text-[#9ebdff]" />
                      </div>
                      <div className="text-base font-semibold text-[#F5F8FC]">{card.title}</div>
                    </div>
                    <p className="text-sm leading-6 text-[#B8C8DA]">{card.description}</p>
                    <div className="mt-auto flex flex-wrap gap-2 pt-2">
                      {card.actions.map((action, index) => (
                        <Button
                          key={action.href}
                          asChild
                          variant={index === 0 ? "default" : "outline"}
                          className={index === 0 ? metallicPrimaryButtonClass : metallicSecondaryButtonClass}
                        >
                          <Link href={action.href} onClick={() => trackEvent("cta_click", { label: action.track, target: action.href })}>
                            {action.label}
                          </Link>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            {!hasProPlus && (
              <aside className="hidden md:block">
                <Card id="landing-membership-section" className={`${metallicPanelClass} sticky top-24 overflow-hidden text-[#E8EDF4]`}>
                  <div className="rsf-metal-divider bg-[linear-gradient(135deg,rgba(22,28,36,0.96),rgba(19,34,61,0.92),rgba(13,19,28,0.98))] px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rsf-kicker text-[#d4e1f7]">RSF Pro</span>
                      <Badge variant="outline" className="border-[#5d6f85]/35 bg-[#141d29] text-[#d6e4ff]">
                        Membership status
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-[#9cb8df]">Pilot workflow upgrade</div>
                      <div className="text-2xl font-semibold tracking-[-0.02em] text-[#F5F8FC]">{membershipCtaLabel}</div>
                    </div>
                  </div>
                  <CardContent className="space-y-4 p-5">
                    <div className={`${metallicSubpanelClass} rounded-[0.95rem] p-4`}>
                      <div className="text-[10px] uppercase tracking-[0.22em] text-[#9cb8df]">Why this lives here</div>
                      <p className="mt-2 text-sm leading-6 text-[#C1D0E0]">
                        {membershipCtaDescription}
                      </p>
                    </div>
                    <div className="grid gap-3">
                      {[
                        "Detailed plan comparison moved off the landing page",
                        "Quick Start stays focused on day-of-flight workflows",
                        "Use the dedicated membership page for subscribe and manage actions",
                      ].map((item) => (
                        <div key={item} className={`${metallicSubpanelClass} rounded-[0.95rem] px-3 py-2.5 text-sm text-[#E0E7F1]`}>
                          {item}
                        </div>
                      ))}
                    </div>
                    <Button asChild className={`w-full ${metallicPrimaryButtonClass}`}>
                      <Link
                        href={membershipPageHref}
                        onClick={() => trackEvent("cta_click", { label: "landing_sidebar_membership_cta", target: membershipPageHref })}
                      >
                        {membershipCtaLabel}
                      </Link>
                    </Button>
                    <p className="text-xs text-[#A1B5CC]">
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
          <Card className={`${metallicPanelClass} mt-6 text-[#E8EDF4]`}>
            <CardContent className="p-5 sm:p-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4 max-w-3xl">
                <div className="space-y-2">
                  <span className="rsf-kicker text-[#d4e1f7]">CFI Marketplace</span>
                  <div className="flex items-center gap-2 text-base sm:text-lg font-semibold text-[#F5F8FC]">
                    <BookOpen className="h-5 w-5 text-[#9ebdff]" />
                    CFI Instructors: Create your RSF profile
                  </div>
                  <p className="text-sm text-[#AFC1D6] max-w-2xl">
                    Get discovered by student pilots, highlight your ratings, set your training focus, and accept booking requests through the CFI marketplace.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    "Create a free RSF account or sign in",
                    "Build your instructor profile with ratings and specialties",
                    "Appear in the directory and receive student inquiries",
                  ].map((item) => (
                    <div key={item} className={`${metallicSubpanelClass} rounded-[0.9rem] p-3 text-sm text-[#AFC1D6]`}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[260px]">
                <Button variant="outline" asChild className={metallicSecondaryButtonClass}>
                  <Link
                    href="/cfi"
                    onClick={() => trackEvent("cta_click", { label: "landing_cfi_directory", target: "/cfi" })}
                  >
                    View CFI directory
                  </Link>
                </Button>
                <Button asChild className={metallicPrimaryButtonClass}>
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
                    <Button variant="ghost" asChild className="text-[#b9cbdf] hover:bg-[#161d27] hover:text-[#F5F8FC]">
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
          <Card className={`${metallicPanelClass} mt-6 text-[#E8EDF4]`}>
            <CardContent className="p-5 sm:p-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4 max-w-3xl">
                <div className="space-y-2">
                  <span className="rsf-kicker text-[#d4e1f7]">Flying Clubs</span>
                  <div className="flex items-center gap-2 text-base sm:text-lg font-semibold text-[#F5F8FC]">
                    <Users className="h-5 w-5 text-[#9ebdff]" />
                    Run your flying club inside RSF
                  </div>
                  <p className="text-sm text-[#AFC1D6] max-w-2xl">
                    Clubs can create a profile, organize members, assign aircraft, and build a shared scheduling workflow. Pilots can also browse listed clubs through the RSF club directory.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    "Create a club profile and publish it in the RSF directory",
                    "Organize member access, fleet records, and club communications",
                    "Grow into deeper scheduling, billing, and maintenance workflows over time",
                  ].map((item) => (
                    <div key={item} className={`${metallicSubpanelClass} rounded-[0.9rem] p-3 text-sm text-[#AFC1D6]`}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[260px]">
                <Button variant="outline" asChild className={metallicSecondaryButtonClass}>
                  <Link
                    href="/flying-clubs"
                    onClick={() => trackEvent("cta_click", { label: "landing_flying_clubs_directory", target: "/flying-clubs" })}
                  >
                    View Flying Clubs
                  </Link>
                </Button>
                <Button asChild className={metallicPrimaryButtonClass}>
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
                  <Button variant="ghost" asChild className="text-[#b9cbdf] hover:bg-[#161d27] hover:text-[#F5F8FC]">
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

      <Dialog open={isQuickLogOpen} onOpenChange={setIsQuickLogOpen}>
        <DialogContent className={`${metallicPanelClass} max-w-xl text-[#E8EDF4]`}>
          <DialogHeader>
            <DialogTitle>Log your first flight</DialogTitle>
            <DialogDescription className="text-[#AFC1D6]">
              Start a simple draft in about a minute. You can create a free account after you see the workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quick-log-date">Flight date</Label>
              <Input
                id="quick-log-date"
                type="date"
                value={quickLogDraft.flightDate}
                onChange={(event) => setQuickLogDraft((current) => ({ ...current, flightDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-log-duration">Flight time</Label>
              <Input
                id="quick-log-duration"
                value={quickLogDraft.duration}
                onChange={(event) => setQuickLogDraft((current) => ({ ...current, duration: event.target.value }))}
                placeholder="1.2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-log-aircraft">Aircraft</Label>
              <Input
                id="quick-log-aircraft"
                value={quickLogDraft.aircraft}
                onChange={(event) => setQuickLogDraft((current) => ({ ...current, aircraft: event.target.value }))}
                placeholder="C172 / N12345"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-log-route">Route</Label>
              <Input
                id="quick-log-route"
                value={quickLogDraft.route}
                onChange={(event) => setQuickLogDraft((current) => ({ ...current, route: event.target.value.toUpperCase() }))}
                placeholder="KAUS KHYI"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="quick-log-remarks">Notes</Label>
              <Input
                id="quick-log-remarks"
                value={quickLogDraft.remarks}
                onChange={(event) => setQuickLogDraft((current) => ({ ...current, remarks: event.target.value }))}
                placeholder="Short local flight, pattern work, cross-country practice..."
              />
            </div>
          </div>
          <div className={`${metallicSubpanelClass} rounded-[0.95rem] p-3 text-sm text-[#DCE6F2]`}>
            Save a simple draft now, then create a free account if you want to keep tracking hours and come back later.
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className={metallicSecondaryButtonClass} onClick={() => setIsQuickLogOpen(false)}>
              Close
            </Button>
            <Button type="button" className={metallicPrimaryButtonClass} onClick={handleSaveQuickLogDraft}>
              Save draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PostActionSignupPrompt
        visible={showLogbookSignupPrompt && !isAuthenticated}
        source="logbook"
        returnTo="/"
        onDismiss={() => setShowLogbookSignupPrompt(false)}
      />

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




