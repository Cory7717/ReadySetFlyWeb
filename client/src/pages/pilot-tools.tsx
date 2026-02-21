import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Cloud, Search, ExternalLink, AlertTriangle, FileText, Radio, Loader2, CloudSun, Plane, Wind, Gauge, Scale } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";

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

function parseFlightCategory(metar: any): { category: string; color: string } {
  if (!metar) return { category: "UNKNOWN", color: "gray" };

  // Extract ceiling and visibility from rawOb
  const raw = metar.rawOb || "";
  
  // Simple heuristic for flight category based on common METAR patterns
  // VFR: ceiling > 3000 ft, vis > 5 mi
  // MVFR: ceiling 1000-3000 ft or vis 3-5 mi
  // IFR: ceiling 500-1000 ft or vis 1-3 mi
  // LIFR: ceiling < 500 ft or vis < 1 mi

  const visMatch = raw.match(/\s(\d{1,2})SM/);
  const visibility = visMatch ? parseInt(visMatch[1]) : 10;

  const ceilingMatch = raw.match(/(BKN|OVC)(\d{3})/);
  const ceiling = ceilingMatch ? parseInt(ceilingMatch[2]) * 100 : 10000;

  if (ceiling >= 3000 && visibility > 5) {
    return { category: "VFR", color: "green" };
  } else if (ceiling >= 1000 && visibility >= 3) {
    return { category: "MVFR", color: "blue" };
  } else if (ceiling >= 500 && visibility >= 1) {
    return { category: "IFR", color: "red" };
  } else {
    return { category: "LIFR", color: "purple" };
  }
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
  // ATIS identifier appears after RMK in format like "RMK AO2 SLP123 T01234567 INFO A"
  // or just "ATIS ALPHA" or single letter at end
  const raw = metar.rawOb;
  
  // Try to find INFO X pattern (most common)
  const infoMatch = raw.match(/\bINFO\s+([A-Z])\b/i);
  if (infoMatch) {
    return `Information ${infoMatch[1].toUpperCase()}`;
  }
  
  // Try to find ATIS X pattern
  const atisMatch = raw.match(/\bATIS\s+([A-Z])\b/i);
  if (atisMatch) {
    return `Information ${atisMatch[1].toUpperCase()}`;
  }
  
  // Try to find single letter at the very end after RMK
  const rmkIndex = raw.indexOf('RMK');
  if (rmkIndex !== -1) {
    const afterRmk = raw.substring(rmkIndex);
    // Look for pattern like ending with single letter
    const endMatch = afterRmk.match(/\s([A-Z])\s*$/);
    if (endMatch) {
      return `Information ${endMatch[1]}`;
    }
  }
  
  return null;
}

function extractRunwayInUse(metar: any): string | null {
  if (!metar?.rawOb) return null;
  const raw = metar.rawOb;
  
  // Look for RWY XX or RUNWAY XX patterns in remarks
  const rwyMatch = raw.match(/\b(?:RWY|RUNWAY)\s+(\d{2}[LCR]?(?:\s*(?:AND|\/|&)\s*\d{2}[LCR]?)*)/i);
  if (rwyMatch) {
    return rwyMatch[1].replace(/\s+/g, ' ').trim();
  }
  
  // Also try to find arrival/departure runway info
  const arrRwyMatch = raw.match(/\bARR\s+(?:RWY|RUNWAY)\s+(\d{2}[LCR]?)/i);
  const depRwyMatch = raw.match(/\bDEP\s+(?:RWY|RUNWAY)\s+(\d{2}[LCR]?)/i);
  
  if (arrRwyMatch || depRwyMatch) {
    const runways = [];
    if (arrRwyMatch) runways.push(`${arrRwyMatch[1]} (arr)`);
    if (depRwyMatch) runways.push(`${depRwyMatch[1]} (dep)`);
    return runways.join(', ');
  }
  
  return null;
}

export default function PilotTools() {
  const { user } = useAuth();
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
  const densityAltitude = Math.round(pressureAltitude + 120 * (oat - isaTemp));

  const { data: weather, isLoading, error, refetch } = useQuery<WeatherData>({
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

  const { data: runwayBriefing, isLoading: runwayLoading } = useQuery<{
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

  const { data: notams, isLoading: notamsLoading, isError: notamsError } = useQuery<{
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
      setSearchIcao(normalized);
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

  useEffect(() => {
    trackEvent("pilot_tools_view", { page: "/pilot-tools" });
  }, []);


  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <CloudSun className="h-8 w-8" />
            Pilot Tools
          </h1>
          <p className="text-muted-foreground">
            Aviation weather, NOTAMs, and airport information
          </p>
        </div>

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
            <CardDescription>Save common routes, fuel notes, and timing.</CardDescription>
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
            <CardDescription>Practice ATC phraseology with guided scenarios.</CardDescription>
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
            <Button disabled aria-disabled>
              Coming Soon
            </Button>
            <Badge variant="secondary">Coming soon</Badge>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wind className="h-5 w-5" />
              Crosswind Calculator
            </CardTitle>
            <CardDescription>Quickly estimate crosswind and headwind components.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Crosswind</div>
                <div className="text-lg font-semibold">
                  {Math.abs(crosswind).toFixed(1)} kt {crosswindDir}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Head/Tailwind</div>
                <div className="text-lg font-semibold">
                  {Math.abs(headwind).toFixed(1)} kt {headwind >= 0 ? "headwind" : "tailwind"}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Max crosswind (gust)</div>
                <div className="text-lg font-semibold">
                  {maxCrosswind.toFixed(1)} kt
                </div>
                <div className="text-xs text-muted-foreground">
                  Max headwind: {Math.abs(maxHeadwind).toFixed(1)} kt
                </div>
              </div>
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
            <div className="grid gap-3 md:grid-cols-3">
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
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant={tempUnit === "C" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTempUnit("C")}
                    >
                      C
                    </Button>
                    <Button
                      type="button"
                      variant={tempUnit === "F" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTempUnit("F")}
                    >
                      F
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Pressure altitude</div>
                <div className="text-lg font-semibold">{pressureAltitude.toLocaleString()} ft</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Density altitude</div>
                <div className="text-lg font-semibold">{densityAltitude.toLocaleString()} ft</div>
              </div>
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
              EB-6 Advanced Calculator
            </CardTitle>
            <CardDescription>Performance + wind + fuel with configurable outputs.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href="/tools/eb6">Open EB-6 Advanced</Link>
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

        {/* Search */}
        <Card id="airport-weather">
          <CardHeader>
            <CardTitle>Airport Weather</CardTitle>
            <CardDescription>Enter an ICAO code or city/state to find nearby airports.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
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
                  {runwayInUseDisplay && (
                    <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200">
                      Runway {runwayInUseDisplay} in use
                    </Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    onClick={() => window.open(`https://tfr.faa.gov/tfr2/list.html`, '_blank')}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    TFRs
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => window.open(`https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/`, '_blank')}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Chart Supplement
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => window.open(`https://www.1800wxbrief.com/`, '_blank')}
                  >
                    <Radio className="h-4 w-4 mr-2" />
                    1800WXBRIEF
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => window.open(`https://skyvector.com/airport/${weather.icao}`, '_blank')}
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
    </div>
  );
}
