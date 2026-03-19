import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SponsoredRightRail } from "@/components/banners/SponsoredRightRail";
import WeatherBriefingSummarizer from "@/components/ai/WeatherBriefingSummarizer";
import NotamTranslator from "@/components/ai/NotamTranslator";
import { Cloud, Search, ExternalLink, AlertTriangle, FileText, Radio, Loader2, CloudSun, Plane, Wind, Gauge, Scale } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";
import { canUseInternalPreview } from "@/lib/internal-preview";
import { getCurrentReturnTo, withReturnTo, withSourceParam } from "@/lib/returnTo";
import { cn } from "@/lib/utils";
import { extractAtisIdentifier, extractRunwayInUse, parseFlightCategory, parseWeatherHazards } from "@/lib/weatherInterpretation";

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
  lat?: number;
  lon?: number;
}

const ICAO_REGEX = /^[A-Z0-9]{3,4}$/;

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

function RunwayDiagram({
  runwayHeadingDeg,
  windDirDeg,
  windSpeedKt,
  crosswindKt,
  headwindKt,
}: {
  runwayHeadingDeg: number;
  windDirDeg: number;
  windSpeedKt: number;
  crosswindKt: number;
  headwindKt: number;
}) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const runwayLen = 70;
  const runwayWidth = 14;
  const arrowLen = Math.min(65, Math.max(20, windSpeedKt * 2.2));

  const windRad = ((windDirDeg + 180) * Math.PI) / 180;

  const windTipX = cx + Math.sin(windRad) * arrowLen;
  const windTipY = cy - Math.cos(windRad) * arrowLen;
  const windTailX = cx - Math.sin(windRad) * (arrowLen * 0.35);
  const windTailY = cy + Math.cos(windRad) * (arrowLen * 0.35);

  const isHeadwind = headwindKt >= 0;
  const crossDir = crosswindKt > 0 ? "R" : crosswindKt < 0 ? "L" : "";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-[200px] h-[200px]"
        role="img"
        aria-label="Runway wind diagram"
      >
        <defs>
          <marker
            id="wind-arrow"
            viewBox="0 0 10 10"
            refX="9" refY="5"
            markerWidth="5" markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z"
                  fill="#0ea5e9" />
          </marker>
        </defs>

        <circle cx={cx} cy={cy} r={90}
                className="fill-slate-50 stroke-slate-200"
                strokeWidth="1" />

        {[0, 90, 180, 270].map((deg) => {
          const r = (deg * Math.PI) / 180;
          return (
            <line
              key={deg}
              x1={cx + Math.sin(r) * 84}
              y1={cy - Math.cos(r) * 84}
              x2={cx + Math.sin(r) * 90}
              y2={cy - Math.cos(r) * 90}
              className="stroke-slate-300"
              strokeWidth="1.5"
            />
          );
        })}

        <g transform={`rotate(${runwayHeadingDeg}, ${cx}, ${cy})`}>
          <rect
            x={cx - runwayWidth / 2}
            y={cy - runwayLen}
            width={runwayWidth}
            height={runwayLen * 2}
            rx="2"
            className="fill-slate-700"
          />
          {[-30, -10, 10, 30].map((offset) => (
            <rect
              key={offset}
              x={cx - 0.75}
              y={cy + offset - 8}
              width={1.5}
              height={10}
              className="fill-white/60"
            />
          ))}
          <rect x={cx - runwayWidth / 2} y={cy - runwayLen}
                width={runwayWidth} height={3}
                className="fill-white/80" />
          <rect x={cx - runwayWidth / 2} y={cy + runwayLen - 3}
                width={runwayWidth} height={3}
                className="fill-white/80" />
        </g>

        {windSpeedKt > 0 && (
          <line
            x1={windTailX}
            y1={windTailY}
            x2={windTipX}
            y2={windTipY}
            stroke="#0ea5e9"
            strokeWidth="2.5"
            markerEnd="url(#wind-arrow)"
          />
        )}

        <circle cx={cx} cy={cy} r="3"
                className="fill-slate-400" />
      </svg>

      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-sky-500 rounded" />
          Wind
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 bg-slate-700 rounded-sm" />
          Runway
        </span>
      </div>

      <div className="text-xs text-center text-muted-foreground">
        {isHeadwind ? "Headwind" : "Tailwind"} from {windDirDeg}°
        {crossDir ? ` · crosswind from ${crossDir === "R" ? "right" : "left"}` : ""}
      </div>
    </div>
  );
}

export default function PilotTools() {
  const { user } = useAuth();
  const canPreviewInternal = canUseInternalPreview(user);
  const entitlements = (user as any)?.entitlements;
  const isPro = entitlements?.tier ? entitlements.tier !== "free" : user?.logbookProStatus === "active";
  const [icao, setIcao] = useState("KAUS");
  const [searchIcao, setSearchIcao] = useState("KAUS");
  const [airportSuggestions, setAirportSuggestions] = useState<AirportSearchResult[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [runwayHeading, setRunwayHeading] = useState("180");
  const [windDirection, setWindDirection] = useState("210");
  const [windSpeed, setWindSpeed] = useState("12");
  const [windGust, setWindGust] = useState("");
  const [fieldElevation, setFieldElevation] = useState("500");
  const [altimeterSetting, setAltimeterSetting] = useState("29.92");
  const [oatValue, setOatValue] = useState("20");
  const [tempUnit, setTempUnit] = useState<"C" | "F">("C");
  const [humidity, setHumidity] = useState("50");
  const [showAiWeatherSummary, setShowAiWeatherSummary] = useState(false);
  const [showAiNotamTranslator, setShowAiNotamTranslator] = useState(false);

  const heading = Number(runwayHeading) || 0;
  const windDir = Number(windDirection) || 0;
  const windKt = Number(windSpeed) || 0;
  const gustKt = Number(windGust) || 0;
  const angle = ((windDir - heading + 540) % 360) - 180;
  const angleRad = (Math.PI / 180) * angle;
  const crosswind = windKt * Math.sin(angleRad);
  const headwind = windKt * Math.cos(angleRad);
  const crosswindDir = crosswind > 0 ? "from right" : crosswind < 0 ? "from left" : "calm";
  const maxCrosswind = gustKt ? Math.abs(gustKt * Math.sin(angleRad)) : Math.abs(crosswind);
  const maxHeadwind = gustKt ? gustKt * Math.cos(angleRad) : headwind;

  const elevation = Number(fieldElevation) || 0;
  const altimeter = Number(altimeterSetting) || 29.92;
  const oatInput = Number(oatValue) || 0;
  const oat = tempUnit === "F" ? (oatInput - 32) * (5 / 9) : oatInput;
  const pressureAltitude = Math.round(elevation + (29.92 - altimeter) * 1000);
  const isaTemp = 15 - 2 * (pressureAltitude / 1000);
  const rhValue = Math.min(100, Math.max(0, Number(humidity) || 0));
  const es = 6.1078 * Math.pow(10, (7.5 * oat) / (237.3 + oat));
  const e = (rhValue / 100) * es;
  const stationPressureHpa = 1013.25 * Math.pow(altimeter / 29.92126, 5.2561);
  const tvCorrection = e > 0 ? (0.379 * e) / stationPressureHpa : 0;
  const virtualTempK = (oat + 273.15) / (1 - tvCorrection);
  const virtualTempC = virtualTempK - 273.15;
  const densityAltitudeHumid = Math.round(
    pressureAltitude + 120 * (virtualTempC - isaTemp)
  );
  const densityAltitude = densityAltitudeHumid;
  const isaDeviation = Math.round(oat - isaTemp);

  const {
    data: weather,
    isLoading,
    isFetching: weatherFetching,
    error,
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
    enabled: !!searchIcao,
  });

  const { data: airportMeta } = useQuery<AirportSearchResult | null>({
    queryKey: ["/api/airports/search", searchIcao, "exact"],
    queryFn: async () => {
      if (!searchIcao) return null;
      const res = await fetch(apiUrl(`/api/airports/search?q=${encodeURIComponent(searchIcao)}`), {
        credentials: "include",
      });
      if (!res.ok) return null;
      const results = (await res.json()) as AirportSearchResult[];
      if (!results?.length) return null;
      const upper = searchIcao.toUpperCase();
      return results.find((item) => item.icao?.toUpperCase() === upper) ?? results[0] ?? null;
    },
    enabled: !!searchIcao,
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
    wind: { direction: number | null; speed: number | null; gust: number | null };
    advisory: { runway: string; heading: number; headwind: number; crosswind: number } | null;
    runways: Array<{
      leIdent: string | null;
      heIdent: string | null;
      leHeading: number | null;
      heHeading: number | null;
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
    enabled: !!searchIcao,
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
    raw?: any;
  }>({
    queryKey: ["/api/notams", searchIcao],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/notams?icao=${searchIcao}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch NOTAMs");
      return res.json();
    },
    enabled: !!searchIcao,
  });

  useEffect(() => {
    const trimmed = icao.trim();
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
        setAirportSuggestions(results.slice(0, 8));
      } catch {
        setAirportSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);

    return () => window.clearTimeout(handle);
  }, [icao]);

  const handleSelectAirport = (airport: AirportSearchResult) => {
    const next = airport.icao.toUpperCase();
    setIcao(next);
    setSearchIcao(next);
    setAirportSuggestions([]);
  };

  const handleSearch = () => {
    const trimmed = icao.trim();
    if (!trimmed) return;
    const normalized = trimmed.toUpperCase();
    if (ICAO_REGEX.test(normalized)) {
      if (normalized === searchIcao) {
        void Promise.all([
          refetchWeather(),
          refetchRunwayBriefing(),
          refetchNotams(),
        ]);
      } else {
        setSearchIcao(normalized);
      }
      return;
    }
    if (airportSuggestions.length > 0) {
      handleSelectAirport(airportSuggestions[0]);
    }
  };

  const flightCategory = parseFlightCategory(weather?.metar);
  const atisInfo = extractAtisIdentifier(weather?.metar);
  const runwayInUse = extractRunwayInUse(weather?.metar);
  const runwayInUseDisplay =
    runwayBriefing?.runwayInUse ||
    runwayInUse ||
    runwayBriefing?.advisory?.runway ||
    null;
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
  const weatherHazards = useMemo(
    () => parseWeatherHazards(weather?.metar, weather?.taf, notams?.notams ?? []),
    [weather?.metar, weather?.taf, notams?.notams]
  );

  useEffect(() => {
    trackEvent("pilot_tools_view", { page: "/pilot-tools" });
  }, []);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <CloudSun className="h-8 w-8" />
            Pilot Tools
          </h1>
          <p className="text-muted-foreground">
            Start with free aviation tools. Upgrade only when saved workflow and repeat-use speed become worth it.
          </p>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Subscription Value</div>
              <h2 className="text-2xl font-semibold text-slate-900">RSF Pro is about reducing repeat work, not collecting “advanced features.”</h2>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                Use the free tools to plan, calculate, and browse. Upgrade when you want saved plans, saved aircraft assumptions, practice history, and a cleaner pilot workflow across sessions.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-background px-4 py-3">
                  <div className="text-sm font-semibold">Plan faster</div>
                  <div className="mt-1 text-xs text-muted-foreground">Reuse saved route setups instead of rebuilding them.</div>
                </div>
                <div className="rounded-xl border bg-background px-4 py-3">
                  <div className="text-sm font-semibold">Train with continuity</div>
                  <div className="mt-1 text-xs text-muted-foreground">Keep comms and training history tied to your account.</div>
                </div>
                <div className="rounded-xl border bg-background px-4 py-3">
                  <div className="text-sm font-semibold">Keep records cleaner</div>
                  <div className="mt-1 text-xs text-muted-foreground">Tie planning, logbook, and reminders together in one workflow.</div>
                </div>
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border bg-background p-4">
              <div className="text-sm font-semibold">Best next step</div>
              <div className="text-sm text-muted-foreground">
                If you are still exploring, stay free. If you are flying often enough that repeated setup feels annoying, that is the time to trial Pro.
              </div>
              <div className="flex flex-wrap gap-2">
                {!user ? (
                  <Button asChild>
                    <Link href={withReturnTo("/register", getCurrentReturnTo())}>Create free account</Link>
                  </Button>
                ) : null}
                <Button
                  asChild
                  variant="outline"
                  onClick={() => trackEvent("subscription_cta_click", { source_page: "/pilot-tools", target: "/logbook/pro", context: "pilot_tools_value_panel" })}
                >
                  <Link href={withSourceParam("/logbook/pro", "/pilot-tools")}>See Pro plans</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-slate-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-sky-600" />
              Aviation Weather Hub
            </CardTitle>
            <CardDescription>
              NOAA/AWC METAR, TAF, NOTAMs, PIREPs, hazards, winds aloft, icing, and turbulence in one view.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button asChild onClick={() => trackEvent("cta_click", { label: "aviation_weather_hub", target: "/aviation-weather" })}>
              <Link href="/aviation-weather">Open Aviation Weather Hub</Link>
            </Button>
            <Badge variant="outline">New</Badge>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-primary" />
              Need an aircraft?
            </CardTitle>
            <CardDescription>
              Browse rentals or explore the marketplace for CFIs, schools, and services.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button asChild onClick={() => trackEvent("cta_click", { label: "browse_rentals", target: "/rentals" })}>
              <Link href="/rentals">Browse Rentals</Link>
            </Button>
            <Button
              variant="outline"
              asChild
              onClick={() => trackEvent("cta_click", { label: "browse_marketplace", target: "/marketplace" })}
            >
              <Link href="/marketplace">Explore Marketplace</Link>
            </Button>
            <Button
              variant="outline"
              asChild
              onClick={() => trackEvent("cta_click", { label: "post_listing", target: "/create-marketplace-listing" })}
            >
              <Link href="/create-marketplace-listing">Post a Listing</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5" />
              Flight Planner (RSF Pro)
            </CardTitle>
            <CardDescription>Preview the planner free. Pro becomes valuable when you want saved routes, saved aircraft assumptions, and faster repeat planning.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href="/flight-planner">
                {isPro ? "Open Flight Planner" : "Preview Flight Planner"}
              </Link>
            </Button>
            <Badge variant="outline">{isPro ? "Active" : "Preview available"}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5" />
              Radio Comms Trainer (RSF Pro)
            </CardTitle>
            <CardDescription>Try guided scenarios free. Pro unlocks full practice history, scoring, and repeat training continuity.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href="/radio-comms-trainer">
                {isPro ? "Open Trainer" : "Try Demo"}
              </Link>
            </Button>
            <Badge variant="outline">{isPro ? "Active" : "Demo available"}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              IFR Approach Plates
            </CardTitle>
            <CardDescription>Search and download current FAA approach plates.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href="/approach-plates">Open Approach Plates</Link>
            </Button>
            <Badge variant="outline">Hosted by ReadySetFly</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              TFR Map (RSF)
            </CardTitle>
            <CardDescription>RSF-owned TFR map powered by FAA SWIM.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href={`/tfr-map?icao=${encodeURIComponent(searchIcao)}`}>Open TFR Map</Link>
            </Button>
            <Badge variant="outline">Live airspace</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5" />
              Live Traffic (RSF)
            </CardTitle>
            <CardDescription>Global ADS-B traffic map powered by ADSBExchange.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            {canPreviewInternal ? (
              <>
                <Button asChild>
                  <Link href="/live-traffic">Open Internal Preview</Link>
                </Button>
                <Badge variant="outline">Internal Preview</Badge>
              </>
            ) : (
              <>
                <Button disabled aria-disabled>
                  Coming Soon
                </Button>
                <Badge variant="secondary">Coming soon</Badge>
              </>
            )}
            <Badge variant="outline">ADSBExchange</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Airport Briefing (NOTAMs + Runway)
            </CardTitle>
            <CardDescription>Live NOTAMs and runway advisory for any airport.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <a href="#airport-briefing">Open Airport Briefing</a>
            </Button>
            <Badge variant="outline">FAA SWIM</Badge>
          </CardContent>
        </Card>

        <div id="calculators" className="space-y-2 pt-2">
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Pilot Calculators</h2>
              <p className="text-sm text-muted-foreground">
                Crosswind, density altitude, e6b, weight & balance, and cost planning.
              </p>
            </div>
            <Badge variant="outline">Free tools</Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wind className="h-5 w-5" />
              Crosswind Calculator
            </CardTitle>
            <CardDescription>Quickly estimate crosswind and headwind components.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {weather?.metar?.rawOb && (() => {
              const raw = weather.metar.rawOb as string;
              const windMatch = raw.match(/\b(\d{3})(\d{2})(?:G(\d{2}))?KT\b/);
              if (!windMatch) return null;
              return (
                <div className="flex items-center gap-2 rounded-lg border bg-sky-50 px-3 py-2 text-xs text-sky-800">
                  <span>
                    METAR wind: {windMatch[1]}° at {windMatch[2]}kt
                    {windMatch[3] ? ` gusting ${windMatch[3]}kt` : ""}
                  </span>
                  <button
                    type="button"
                    className="ml-auto rounded border border-sky-300 px-2 py-0.5 text-xs font-semibold hover:bg-sky-100 transition-colors"
                    onClick={() => {
                      setWindDirection(windMatch[1]);
                      setWindSpeed(windMatch[2]);
                      setWindGust(windMatch[3] ?? "");
                    }}
                  >
                    Fill from METAR
                  </button>
                </div>
              );
            })()}
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Runway heading</Label>
                <Input value={runwayHeading} onChange={(e) => setRunwayHeading(e.target.value)} placeholder="180" />
              </div>
              <div className="space-y-2">
                <Label>Wind direction</Label>
                <Input value={windDirection} onChange={(e) => setWindDirection(e.target.value)} placeholder="210" />
              </div>
              <div className="space-y-2">
                <Label>Wind speed (kt)</Label>
                <Input value={windSpeed} onChange={(e) => setWindSpeed(e.target.value)} placeholder="12" />
              </div>
              <div className="space-y-2">
                <Label>Gust (kt, optional)</Label>
                <Input value={windGust} onChange={(e) => setWindGust(e.target.value)} placeholder="20" />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-[1fr_auto]">
              <div className="space-y-3">
                <div className="grid gap-3 grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Crosswind (steady)</div>
                    <div className="text-xl font-bold">
                      {Math.abs(crosswind).toFixed(1)} kt
                    </div>
                    <div className="text-xs text-muted-foreground">{crosswindDir}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">
                      {headwind >= 0 ? "Headwind" : "Tailwind"} (steady)
                    </div>
                    <div className="text-xl font-bold">
                      {Math.abs(headwind).toFixed(1)} kt
                    </div>
                  </div>
                  {gustKt > 0 && (
                    <>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <div className="text-xs text-muted-foreground">
                          Crosswind (gust)
                        </div>
                        <div className="text-xl font-bold text-amber-800">
                          {maxCrosswind.toFixed(1)} kt
                        </div>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <div className="text-xs text-muted-foreground">
                          {maxHeadwind >= 0 ? "Headwind" : "Tailwind"} (gust)
                        </div>
                        <div className="text-xl font-bold text-amber-800">
                          {Math.abs(maxHeadwind).toFixed(1)} kt
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
                  <div className="font-semibold text-foreground text-sm mb-1">
                    Component breakdown
                  </div>
                  <div>
                    Wind angle to runway:{" "}
                    <span className="font-mono font-semibold text-foreground">
                      {Math.abs(angle).toFixed(0)}°{" "}
                      {crosswindDir !== "calm" ? `(${crosswindDir})` : "(calm)"}
                    </span>
                  </div>
                  <div>
                    Crosswind = {windKt} × sin({Math.abs(angle).toFixed(0)}°) ={" "}
                    <span className="font-semibold text-foreground">
                      {Math.abs(crosswind).toFixed(1)} kt
                    </span>
                  </div>
                  <div>
                    Headwind = {windKt} × cos({Math.abs(angle).toFixed(0)}°) ={" "}
                    <span className="font-semibold text-foreground">
                      {Math.abs(headwind).toFixed(1)} kt
                    </span>
                  </div>
                </div>

                {(() => {
                  const maxXwind = gustKt ? maxCrosswind : Math.abs(crosswind);
                  const warnThreshold = 15;
                  const dangerThreshold = 20;
                  if (maxXwind < warnThreshold) return null;
                  return (
                    <div className={cn(
                      "rounded-lg border px-4 py-2 text-sm font-medium",
                      maxXwind >= dangerThreshold
                        ? "border-red-300 bg-red-50 text-red-800"
                        : "border-amber-300 bg-amber-50 text-amber-800"
                    )}>
                      {maxXwind >= dangerThreshold
                        ? `⚠ ${maxXwind.toFixed(1)} kt crosswind exceeds typical light aircraft limits`
                        : `⚡ ${maxXwind.toFixed(1)} kt crosswind — verify aircraft max demonstrated crosswind`}
                    </div>
                  );
                })()}
              </div>

              <RunwayDiagram
                runwayHeadingDeg={heading}
                windDirDeg={windDir}
                windSpeedKt={windKt}
                crosswindKt={crosswind}
                headwindKt={headwind}
              />
            </div>
            <Alert>
              <AlertDescription className="text-xs">
                For planning only. Verify with official sources and aircraft limitations.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Density Altitude Calculator
            </CardTitle>
            <CardDescription>Estimate pressure altitude and density altitude.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Field elevation (ft)</Label>
                <Input value={fieldElevation} onChange={(e) => setFieldElevation(e.target.value)} placeholder="500" />
              </div>
              <div className="space-y-2">
                <Label>Altimeter (inHg)</Label>
                <Input value={altimeterSetting} onChange={(e) => setAltimeterSetting(e.target.value)} placeholder="29.92" />
              </div>
              <div className="space-y-2">
                <Label>OAT ({tempUnit === "F" ? "F" : "C"})</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={oatValue}
                    onChange={(e) => setOatValue(e.target.value)}
                    placeholder={tempUnit === "F" ? "68" : "20"}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (tempUnit === "C") {
                        const c = parseFloat(oatValue);
                        if (Number.isFinite(c)) setOatValue(((c * 9 / 5) + 32).toFixed(1));
                        setTempUnit("F");
                      } else {
                        const f = parseFloat(oatValue);
                        if (Number.isFinite(f)) setOatValue((((f - 32) * 5) / 9).toFixed(1));
                        setTempUnit("C");
                      }
                    }}
                    className="rounded border border-input bg-background px-2 py-1 text-xs font-semibold hover:bg-muted transition-colors whitespace-nowrap"
                  >
                    °{tempUnit === "C" ? "C → F" : "F → C"}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Rel. humidity (%)</Label>
                <Input
                  value={humidity}
                  onChange={(e) => setHumidity(e.target.value)}
                  placeholder="50"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Pressure Altitude</div>
                  <div className="text-xl font-bold">
                    {pressureAltitude.toLocaleString()} ft
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Field elev {elevation.toLocaleString()} ft
                    {pressureAltitude > elevation
                      ? ` · +${(pressureAltitude - elevation).toLocaleString()} ft (low pressure)`
                      : pressureAltitude < elevation
                        ? ` · ${(pressureAltitude - elevation).toLocaleString()} ft (high pressure)`
                        : " · standard pressure"}
                  </div>
                </div>

                <div className={cn(
                  "rounded-lg border p-3",
                  densityAltitude > elevation + 2000
                    ? "border-red-200 bg-red-50"
                    : densityAltitude > elevation + 1000
                      ? "border-amber-200 bg-amber-50"
                      : ""
                )}>
                  <div className="text-xs text-muted-foreground">Density Altitude</div>
                  <div className={cn(
                    "text-xl font-bold",
                    densityAltitude > elevation + 2000
                      ? "text-red-700"
                      : densityAltitude > elevation + 1000
                        ? "text-amber-700"
                        : ""
                  )}>
                    {densityAltitude.toLocaleString()} ft
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {densityAltitude > elevation
                      ? `+${(densityAltitude - elevation).toLocaleString()} ft above field`
                      : `${(densityAltitude - elevation).toLocaleString()} ft below field`}
                  </div>
                </div>

                <div className={cn(
                  "rounded-lg border p-3",
                  isaDeviation > 15
                    ? "border-red-200 bg-red-50"
                    : isaDeviation > 8
                      ? "border-amber-200 bg-amber-50"
                      : ""
                )}>
                  <div className="text-xs text-muted-foreground">ISA Deviation</div>
                  <div className={cn(
                    "text-xl font-bold",
                    isaDeviation > 15 ? "text-red-700" : isaDeviation > 8 ? "text-amber-700" : ""
                  )}>
                    {isaDeviation > 0 ? "+" : ""}{isaDeviation}°C
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ISA at this PA = {Math.round(isaTemp)}°C
                  </div>
                </div>
              </div>

              {(() => {
                const daDiff = densityAltitude - elevation;
                if (daDiff > 3000) {
                  return (
                    <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800">
                      ⚠ DA {densityAltitude.toLocaleString()} ft — significantly degraded performance. Verify takeoff/climb data carefully.
                    </div>
                  );
                }
                if (daDiff > 1500) {
                  return (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
                      ⚡ DA {densityAltitude.toLocaleString()} ft — expect noticeably reduced climb rate. Review POH performance charts.
                    </div>
                  );
                }
                if (daDiff < -500) {
                  return (
                    <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-800">
                      ✓ DA below field elevation — favorable performance conditions.
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            <Alert>
              <AlertDescription className="text-xs">
                Density altitude is an estimate. Always consult official performance charts.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              e6b advanced calculator
            </CardTitle>
            <CardDescription>Performance + wind + fuel with configurable outputs.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href="/tools/e6b">Open e6b advanced</Link>
            </Button>
            <Badge variant="outline">New tool</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Weight & Balance
            </CardTitle>
            <CardDescription>Calculate CG and gross weight using the RSF aircraft library.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href="/weight-balance">Open Weight & Balance</Link>
            </Button>
            <Badge variant="outline">Planning tool</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Ownership Cost Calculator
            </CardTitle>
            <CardDescription>Estimate monthly and annual ownership costs.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href="/ownership-cost-calculator">Open Ownership Cost</Link>
            </Button>
            <Badge variant="outline">Planning tool</Badge>
          </CardContent>
        </Card>

        {/* Search */}
        <Card id="airport-weather" className="overflow-visible">
          <CardHeader>
            <CardTitle>Airport Weather</CardTitle>
            <CardDescription>Enter an ICAO code or city/state to find nearby airports.</CardDescription>
          </CardHeader>
          <CardContent className="relative z-30 space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="icao" className="sr-only">ICAO Code</Label>
                <Input
                  id="icao"
                  value={icao}
                  onChange={(e) => setIcao(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="ICAO or city (e.g., KAUS or Dallas, TX)"
                />
                {loadingSuggestions && (
                  <div className="text-xs text-muted-foreground">Searching airports...</div>
                )}
                {airportSuggestions.length > 0 && (
                  <div className="rounded-lg border bg-background shadow-sm">
                    {airportSuggestions.map((airport) => (
                      <button
                        key={`${airport.icao}-${airport.name ?? ""}`}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => handleSelectAirport(airport)}
                      >
                        <div className="font-medium">{airport.icao}</div>
                        <div className="text-xs text-muted-foreground">
                          {airport.name || "Unknown airport"}
                          {airport.city ? ` - ${airport.city}` : ""}
                          {airport.state ? `, ${airport.state}` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {airportMeta && (
                  <div className="text-xs text-muted-foreground">
                    {airportMeta.name ?? "Unknown airport"}
                    {airportLocation ? ` (${airportLocation})` : ""}
                  </div>
                )}
              </div>
              <Button onClick={handleSearch} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error instanceof Error && error.message.includes("404") 
                ? `No weather data available for this airport. ${searchIcao} may not report METAR/TAF.`
                : "Failed to fetch weather data. Please check the ICAO code and try again."}
            </AlertDescription>
          </Alert>
        )}

        {weather && (
          <>
            {/* Flight Category & Quick Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Cloud className="h-5 w-5" />
                    {conditionsTitle}
                  </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge 
                    variant="outline" 
                      className={`text-white ${
                        flightCategory.color === "green" ? "bg-green-600" :
                        flightCategory.color === "blue" ? "bg-blue-600" :
                        flightCategory.color === "red" ? "bg-red-600" :
                        "bg-purple-600"
                      }`}
                    >
                      {flightCategory.category}
                    </Badge>
                    {runwayInUseDisplay && (
                      <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200">
                        Active RWY: {runwayInUseDisplay}
                      </Badge>
                    )}
                    {atisInfo && (
                      <Badge variant="outline" className="bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-200">
                        ATIS: {atisInfo}
                      </Badge>
                    )}
                    {weatherHazards.map((hazard) => (
                      <Badge
                        key={hazard.id}
                        variant="outline"
                        className={
                          hazard.tone === "red"
                            ? "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
                            : hazard.tone === "amber"
                              ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                              : "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200"
                        }
                      >
                        {hazard.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <CardDescription className="flex items-center gap-2 flex-wrap">
                  {weather.metar && (
                    <span className="text-xs">
                      Updated: {formatTimeAgo(new Date(weather.metar.obsTime).getTime())}
                    </span>
                  )}
                  {weather.cached && (
                    <Badge variant="secondary" className="text-xs">Cached</Badge>
                  )}
                  {(weatherFetching || runwayFetching || notamsFetching) && (
                    <Badge variant="secondary" className="text-xs">Refreshing</Badge>
                  )}
                  {runwayInUseDisplay && (
                    <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200">
                      Runway {runwayInUseDisplay} in use
                    </Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className={weatherHazards.length > 0 ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20" : ""}>
                  <AlertTriangle className={cn(
                    "h-4 w-4",
                    weatherHazards.some((hazard) => hazard.tone === "red")
                      ? "text-red-700 dark:text-red-200"
                      : weatherHazards.length > 0
                        ? "text-amber-700 dark:text-amber-200"
                        : ""
                  )} />
                  <AlertDescription className="text-xs">
                    <strong>{flightCategory.category} is ceiling/visibility only.</strong>{" "}
                    {weatherHazards.length > 0
                      ? weatherHazards.map((hazard) => hazard.detail).join(" ")
                      : "No additional precipitation, convective, gust, or runway-surface hazards are currently flagged from the METAR/TAF/NOTAM summary."}
                  </AlertDescription>
                </Alert>
                {weather.metar ? (
                  <>
                    <div>
                      <Label className="text-sm font-semibold">METAR</Label>
                      <p className="font-mono text-sm bg-muted p-3 rounded-md mt-1">
                        {weather.metar.rawOb}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No METAR data available</p>
                )}

                <Separator />

                {weather.taf ? (
                  <div>
                    <Label className="text-sm font-semibold">TAF (Forecast)</Label>
                    <p className="font-mono text-sm bg-muted p-3 rounded-md mt-1 whitespace-pre-wrap">
                      {weather.taf.rawTAF}
                    </p>
                  </div>
                ) : (
                  <div>
                    <Label className="text-sm font-semibold">TAF (Forecast)</Label>
                    <p className="text-sm text-muted-foreground mt-1">No TAF data available</p>
                  </div>
                )}

                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">AI weather briefing</div>
                      <div className="text-xs text-muted-foreground">
                        Summarize METAR and TAF into a short pilot-ready briefing.
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAiWeatherSummary((current) => !current)}
                      className="w-full sm:w-auto"
                    >
                      {showAiWeatherSummary ? "Hide AI summary" : "Open AI summary"}
                    </Button>
                  </div>
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

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>Disclaimer:</strong> This information is for planning purposes only and is not for official flight briefings. 
                    Always obtain an official weather briefing before flight.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card id="airport-briefing">
              <CardHeader>
                <CardTitle>Airport Briefing</CardTitle>
                <CardDescription>Runway guidance and live NOTAMs for {weather.icao}</CardDescription>
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
                        <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200">
                          Active RWY: {runwayInUseDisplay}
                        </Badge>
                      )}
                      {atisInfo && (
                        <Badge variant="outline" className="bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-200">
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
                  <p className="text-xs text-muted-foreground">
                    NOTAMs powered by FAA SWIM.
                  </p>
                </div>

                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">AI NOTAM translator</div>
                      <div className="text-xs text-muted-foreground">
                        Translate raw NOTAMs into plain-English operational and legality impacts.
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAiNotamTranslator((current) => !current)}
                      className="w-full sm:w-auto"
                    >
                      {showAiNotamTranslator ? "Hide AI translator" : "Open AI translator"}
                    </Button>
                  </div>
                  {showAiNotamTranslator && (
                    <div className="mt-3">
                      <NotamTranslator
                        notams={notams?.notams?.map((item) => item.text ?? "").filter(Boolean).join("\n\n") ?? ""}
                        airport={weather.icao}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* External Resources */}
            <Card>
              <CardHeader>
                <CardTitle>Aviation Resources</CardTitle>
                <CardDescription>Official sources for flight planning</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    RSF Tools
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button variant="outline" className="justify-start" asChild>
                      <a href="#airport-weather">
                        <Cloud className="h-4 w-4 mr-2" />
                        RSF METAR/TAF
                      </a>
                    </Button>

                    <Button variant="outline" className="justify-start" asChild>
                      <a href="#airport-briefing">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        RSF NOTAMs + Runway
                      </a>
                    </Button>

                    <Button variant="outline" className="justify-start" asChild>
                      <Link href={`/tfr-map?icao=${encodeURIComponent(searchIcao)}`}>
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        RSF TFR Map
                      </Link>
                    </Button>
                  </div>
                </div>

                <Separator className="my-2" />

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Official Sources
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button variant="outline" className="justify-start" asChild>
                    <a
                      href={`https://www.aviationweather.gov/metar/data?ids=${weather.icao}&format=decoded`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Cloud className="h-4 w-4 mr-2" />
                      View METAR/TAF
                      <ExternalLink className="h-3 w-3 ml-auto" />
                    </a>
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => window.open(`https://tfr.faa.gov/tfr2/list.html`, "_blank", "noopener,noreferrer")}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    TFRs
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => window.open(`https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/`, "_blank", "noopener,noreferrer")}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Chart Supplement
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => window.open(`https://www.1800wxbrief.com/`, "_blank", "noopener,noreferrer")}
                  >
                    <Radio className="h-4 w-4 mr-2" />
                    1800WXBRIEF
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => window.open(`https://skyvector.com/airport/${weather.icao}`, "_blank", "noopener,noreferrer")}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    SkyVector
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </Button>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>METAR:</strong> Current observed weather conditions</p>
                  <p><strong>TAF:</strong> Terminal Aerodrome Forecast (6-30 hour forecast)</p>
                  <p><strong>NOTAMs:</strong> Notices to Airmen (runway closures, navaid outages, etc.)</p>
                  <p><strong>TFRs:</strong> Temporary Flight Restrictions</p>
                  <p><strong>Chart Supplement:</strong> Airport/facility directory with frequencies and procedures</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
        </div>
        <SponsoredRightRail
          placement="pilot-tools"
          infoTestId="button-banner-ad-info-pilot-tools"
          className="xl:sticky xl:top-24 xl:self-start"
        />
      </div>
    </div>
  );
}
