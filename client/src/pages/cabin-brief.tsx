import { useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Copy, PlaneLanding, PlaneTakeoff, RefreshCcw, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";
import CabinBriefSearchForm, { type CabinBriefAirportOption } from "@/components/CabinBriefSearchForm";

type WeatherPayload = {
  icao: string;
  metar: { rawOb?: string } | null;
  taf: { rawTAF?: string } | null;
  cached?: boolean;
};

type AirportMeta = {
  icao: string;
  name: string | null;
  lat: number;
  lon: number;
  timezone?: string | null;
};

type PirepResponse = {
  reports?: Array<{ rawOb?: string }>;
};

type CabinBriefResponse = {
  departure: string;
  enRoute: string;
  arrival: string;
  overall: string;
  generatedAt: string;
  model: string;
};

function formatAirportLabel(option: CabinBriefAirportOption | null, fallback: string) {
  if (!option) return fallback;
  const place = [option.city, option.state].filter(Boolean).join(", ");
  return place || option.name || fallback;
}

function formatAirportSearchLabel(option: CabinBriefAirportOption | null, fallbackIcao: string): CabinBriefAirportOption {
  return option ?? { icao: fallbackIcao, name: fallbackIcao, city: null, state: null };
}

function formatDisplayDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
}

function buildRoutePirepNotes(
  reports: Array<{ rawOb?: string }> | undefined,
  departureLabel: string,
  arrivalLabel: string,
) {
  const reportLines = (reports ?? [])
    .map((report) => report.rawOb?.trim())
    .filter(Boolean)
    .slice(0, 6) as string[];

  if (reportLines.length === 0) {
    return `No recent pilot ride reports were found in the broad corridor between ${departureLabel} and ${arrivalLabel}. Be conservative about en route certainty and avoid claiming conditions for the entire route.`;
  }

  return `Recent pilot ride reports from a broad corridor between ${departureLabel} and ${arrivalLabel}:\n${reportLines.join("\n")}\nUse these only as broad route clues, not point-by-point certainty for the full trip.`;
}

function buildPirepBbox(origin: AirportMeta | null | undefined, destination: AirportMeta | null | undefined) {
  if (!origin || !destination) return null;
  const south = Math.min(origin.lat, destination.lat) - 0.9;
  const north = Math.max(origin.lat, destination.lat) + 0.9;
  const west = Math.min(origin.lon, destination.lon) - 0.9;
  const east = Math.max(origin.lon, destination.lon) + 0.9;
  return `${south.toFixed(3)},${west.toFixed(3)},${north.toFixed(3)},${east.toFixed(3)}`;
}

export default function CabinBrief() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const searchParams = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const from = (searchParams.get("from") || "").trim().toUpperCase();
  const to = (searchParams.get("to") || "").trim().toUpperCase();
  const date = (searchParams.get("date") || new Date().toISOString().slice(0, 10)).trim();

  const hasRoute = Boolean(from && to);

  const originLookup = useQuery<CabinBriefAirportOption | null>({
    queryKey: ["/api/airports/search", from, "cabin-brief-from"],
    enabled: hasRoute,
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/airports/search?q=${encodeURIComponent(from)}`));
      if (!res.ok) return null;
      const results = (await res.json()) as CabinBriefAirportOption[];
      return results.find((item) => item.icao.toUpperCase() === from) ?? results[0] ?? null;
    },
    staleTime: 1000 * 60 * 30,
  });

  const destinationLookup = useQuery<CabinBriefAirportOption | null>({
    queryKey: ["/api/airports/search", to, "cabin-brief-to"],
    enabled: hasRoute,
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/airports/search?q=${encodeURIComponent(to)}`));
      if (!res.ok) return null;
      const results = (await res.json()) as CabinBriefAirportOption[];
      return results.find((item) => item.icao.toUpperCase() === to) ?? results[0] ?? null;
    },
    staleTime: 1000 * 60 * 30,
  });

  const originMeta = useQuery<AirportMeta>({
    queryKey: ["/api/airports", from, "cabin-brief-origin"],
    enabled: hasRoute,
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/airports/${from}`));
      if (!res.ok) throw new Error("Failed to load departure airport");
      return res.json();
    },
    staleTime: 1000 * 60 * 60,
  });

  const destinationMeta = useQuery<AirportMeta>({
    queryKey: ["/api/airports", to, "cabin-brief-destination"],
    enabled: hasRoute,
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/airports/${to}`));
      if (!res.ok) throw new Error("Failed to load arrival airport");
      return res.json();
    },
    staleTime: 1000 * 60 * 60,
  });

  const departureWeather = useQuery<WeatherPayload>({
    queryKey: ["/api/aviation-weather", from, "cabin-brief-departure"],
    enabled: hasRoute,
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/aviation-weather/${from}`));
      if (!res.ok) throw new Error("Failed to load departure weather");
      return res.json();
    },
    staleTime: 1000 * 60 * 10,
  });

  const arrivalWeather = useQuery<WeatherPayload>({
    queryKey: ["/api/aviation-weather", to, "cabin-brief-arrival"],
    enabled: hasRoute,
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/aviation-weather/${to}`));
      if (!res.ok) throw new Error("Failed to load arrival weather");
      return res.json();
    },
    staleTime: 1000 * 60 * 10,
  });

  const pirepBbox = useMemo(
    () => buildPirepBbox(originMeta.data, destinationMeta.data),
    [originMeta.data, destinationMeta.data],
  );

  const routePireps = useQuery<PirepResponse>({
    queryKey: ["/api/aviation/pireps", pirepBbox, "cabin-brief"],
    enabled: Boolean(pirepBbox),
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/aviation/pireps?bbox=${encodeURIComponent(pirepBbox || "")}&ageHours=6`));
      if (!res.ok) throw new Error("Failed to load route ride reports");
      return res.json();
    },
    staleTime: 1000 * 60 * 15,
  });

  const departureLabel = formatAirportLabel(originLookup.data ?? null, from);
  const arrivalLabel = formatAirportLabel(destinationLookup.data ?? null, to);

  const routeNotes = useMemo(
    () => buildRoutePirepNotes(routePireps.data?.reports, departureLabel, arrivalLabel),
    [routePireps.data?.reports, departureLabel, arrivalLabel],
  );

  const cabinBrief = useQuery<CabinBriefResponse>({
    queryKey: [
      "/api/ai-tools/cabin-brief",
      from,
      to,
      date,
      departureWeather.data?.metar?.rawOb ?? "",
      departureWeather.data?.taf?.rawTAF ?? "",
      arrivalWeather.data?.metar?.rawOb ?? "",
      arrivalWeather.data?.taf?.rawTAF ?? "",
      routeNotes,
    ],
    enabled:
      hasRoute &&
      Boolean(departureWeather.data?.metar?.rawOb || departureWeather.data?.taf?.rawTAF) &&
      Boolean(arrivalWeather.data?.metar?.rawOb || arrivalWeather.data?.taf?.rawTAF),
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/ai-tools/cabin-brief"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departureLabel,
          arrivalLabel,
          dateLabel: formatDisplayDate(date),
          departureMetar: departureWeather.data?.metar?.rawOb ?? "",
          departureTaf: departureWeather.data?.taf?.rawTAF ?? "",
          arrivalMetar: arrivalWeather.data?.metar?.rawOb ?? "",
          arrivalTaf: arrivalWeather.data?.taf?.rawTAF ?? "",
          routeNotes,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: "Cabin Brief unavailable" }));
        throw new Error(payload.error || "Cabin Brief unavailable");
      }
      return res.json();
    },
    staleTime: 0,
  });

  const isRefreshing =
    departureWeather.isFetching ||
    arrivalWeather.isFetching ||
    routePireps.isFetching ||
    cabinBrief.isFetching;

  const handleRefresh = async () => {
    trackEvent("cabin_brief_refresh", { from, to });
    await Promise.all([
      departureWeather.refetch(),
      arrivalWeather.refetch(),
      routePireps.refetch(),
    ]);
    await cabinBrief.refetch();
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/cabin-brief?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${encodeURIComponent(date)}`;
    await navigator.clipboard.writeText(shareUrl);
    trackEvent("cabin_brief_share", { from, to });
    toast({ title: "Link copied!" });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,hsl(var(--primary)/0.08),transparent_25%),#EEF3F9]">
      <div className="container mx-auto px-4 py-8 sm:px-6 sm:py-10">
        <div className="space-y-8">
          <section className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(135deg,#112b4a,#1e4368)] p-6 text-white shadow-[var(--shadow-rsf-panel)] sm:p-8">
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#F0B429]">
                Cabin Brief - For Passengers
              </div>
              <div className="text-3xl font-semibold tracking-tight sm:text-4xl">Cabin Brief</div>
              <div className="text-sm text-slate-200">
                Plain-English flight weather for passengers - no pilot license required.
              </div>
              {hasRoute ? (
                <>
                  <div className="pt-2 text-2xl font-semibold sm:text-3xl">
                    {departureLabel} -&gt; {arrivalLabel}
                  </div>
                  <div className="text-sm text-slate-200">
                    {formatDisplayDate(date)}
                    {cabinBrief.data?.generatedAt
                      ? ` - Briefing generated at ${new Date(cabinBrief.data.generatedAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}`
                      : ""}
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-200">
                  Enter a departure and destination below to generate a passenger-friendly weather briefing.
                </div>
              )}
            </div>
          </section>

          {!hasRoute ? (
            <Card>
              <CardHeader>
                <CardTitle>Start a Cabin Brief</CardTitle>
                <CardDescription>
                  Pick the airports you are flying between and RSF will turn the weather into plain-English passenger language.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CabinBriefSearchForm
                  onSubmit={({ from: origin, to: destination, date: selectedDate }) => {
                    trackEvent("cabin_brief_search", {
                      from: origin.icao,
                      to: destination.icao,
                    });
                    navigate(`/cabin-brief?from=${encodeURIComponent(origin.icao)}&to=${encodeURIComponent(destination.icao)}&date=${encodeURIComponent(selectedDate)}`);
                  }}
                />
              </CardContent>
            </Card>
          ) : (
            <>
              {cabinBrief.data?.overall ? (
                <Card className="border-[#F0B429]/30 bg-white/90">
                  <CardContent className="p-5 text-base leading-relaxed text-slate-800">
                    {cabinBrief.data.overall}
                  </CardContent>
                </Card>
              ) : null}

              <div className="space-y-4">
                <Card className="border-l-4 border-l-sky-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <PlaneTakeoff className="h-5 w-5 text-sky-600" />
                      Departure
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm leading-7 text-slate-700">
                    {cabinBrief.isLoading ? "Building your departure briefing..." : cabinBrief.data?.departure || "Departure summary unavailable."}
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-[#F0B429]">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Send className="h-5 w-5 text-[#d89d15]" />
                      En Route
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm leading-7 text-slate-700">
                    {cabinBrief.isLoading ? "Building your en route briefing..." : cabinBrief.data?.enRoute || "En route summary unavailable."}
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-emerald-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <PlaneLanding className="h-5 w-5 text-emerald-600" />
                      Arrival
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm leading-7 text-slate-700">
                    {cabinBrief.isLoading ? "Building your arrival briefing..." : cabinBrief.data?.arrival || "Arrival summary unavailable."}
                  </CardContent>
                </Card>
              </div>

              <Alert className="border-amber-300 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <AlertDescription className="flex flex-col gap-3 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    Weather data refreshes every hour. If your flight is more than 2 hours away - or you are on a longer trip - tap "Refresh Briefing" for the latest conditions closer to departure.
                  </div>
                  <Button size="sm" variant="outline" className="border-amber-400 bg-white" onClick={handleRefresh}>
                    <RefreshCcw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                    Refresh Briefing
                  </Button>
                </AlertDescription>
              </Alert>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" onClick={handleShare}>
                  <Copy className="mr-2 h-4 w-4" />
                  Share This Briefing
                </Button>
                <div className="text-sm text-muted-foreground">
                  Create a free account to save your briefings.{" "}
                  <Link
                    href="/register"
                    className="font-medium text-primary underline underline-offset-4"
                    onClick={() => trackEvent("cta_click", { label: "cabin_brief_register", target: "/register" })}
                  >
                    Create free account
                  </Link>
                </div>
              </div>

              {cabinBrief.isError ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    {cabinBrief.error instanceof Error ? cabinBrief.error.message : "Cabin Brief is temporarily unavailable."}
                  </AlertDescription>
                </Alert>
              ) : null}

              <Card>
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold">Are you the pilot?</div>
                    <div className="text-sm text-muted-foreground">Get the full professional weather briefing.</div>
                  </div>
                  <Button asChild variant="outline">
                    <Link
                      href="/aviation-weather"
                      onClick={() => trackEvent("cta_click", { label: "cabin_brief_pilot_cta", target: "/aviation-weather" })}
                    >
                      Get the full professional weather briefing
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Check another route</CardTitle>
                  <CardDescription>
                    Search another trip without going back to the landing page.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CabinBriefSearchForm
                    initialFrom={formatAirportSearchLabel(originLookup.data ?? null, from)}
                    initialTo={formatAirportSearchLabel(destinationLookup.data ?? null, to)}
                    initialDate={date}
                    onSubmit={({ from: origin, to: destination, date: selectedDate }) => {
                      trackEvent("cabin_brief_search", {
                        from: origin.icao,
                        to: destination.icao,
                      });
                      navigate(`/cabin-brief?from=${encodeURIComponent(origin.icao)}&to=${encodeURIComponent(destination.icao)}&date=${encodeURIComponent(selectedDate)}`);
                    }}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
