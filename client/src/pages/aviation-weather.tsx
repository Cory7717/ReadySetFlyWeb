import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import WeatherBriefingSummarizer from "@/components/ai/WeatherBriefingSummarizer";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { runWithAuth } from "@/utils/authGate";

const ICAO_REGEX = /^[A-Z0-9]{3,4}$/;
const WINDS_ALOFT_LEVELS = [3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000];

type HazardSummaryItem = {
  source: "airsigmet" | "gairmet" | "airmet";
  hazard: string;
  dueTo?: string;
  validFrom?: string;
  validTo?: string;
};

type AirportFavorite = {
  id: string;
  icao: string;
  name?: string | null;
  city?: string | null;
  state?: string | null;
  alertIfr?: boolean | null;
  alertMvfr?: boolean | null;
};

const pickHazardValue = (value: any) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const buildHazardSummary = (payload: any) => {
  const items: HazardSummaryItem[] = [];
  const pushItem = (source: HazardSummaryItem["source"], entry: any, fallback: string) => {
    if (!entry) return;
    const hazard = pickHazardValue(entry.hazard || entry.hazard_type || entry.rawAirSigmet || entry.rawAirmet || fallback);
    const dueTo = pickHazardValue(entry.dueTo || entry.due_to || entry.due_to_desc || "");
    const validFrom = pickHazardValue(entry.validTimeFrom || entry.valid_time_from || entry.validFrom || "");
    const validTo = pickHazardValue(entry.validTimeTo || entry.valid_time_to || entry.validTo || "");
    items.push({ source, hazard, dueTo: dueTo || undefined, validFrom: validFrom || undefined, validTo: validTo || undefined });
  };

  if (Array.isArray(payload?.airsigmet)) {
    payload.airsigmet.forEach((entry: any) => pushItem("airsigmet", entry, "SIGMET"));
  }
  if (Array.isArray(payload?.gairmet)) {
    payload.gairmet.forEach((entry: any) => pushItem("gairmet", entry, "G-AIRMET"));
  }
  if (Array.isArray(payload?.airmet)) {
    payload.airmet.forEach((entry: any) => pushItem("airmet", entry, "AIRMET"));
  }

  const tcfCount = Array.isArray(payload?.tcf?.features) ? payload.tcf.features.length : 0;
  const warnings = Array.isArray(payload?.warnings) ? payload.warnings : [];

  return { items, warnings, tcfCount };
};

export default function AviationWeatherHub() {
  const [icaoInput, setIcaoInput] = useState("KAUS");
  const [searchIcao, setSearchIcao] = useState("KAUS");
  const [activeTab, setActiveTab] = useState("overview");
  const [windsAltitude, setWindsAltitude] = useState("12000");
  const trackedTabs = useRef(new Set<string>());
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (trackedTabs.current.has(activeTab)) return;
    trackedTabs.current.add(activeTab);
    const eventMap: Record<string, string> = {
      overview: "view_weather_overview",
      metar: "view_metar",
      taf: "view_taf",
      notams: "view_notams",
      pireps: "view_pireps",
      hazards: "view_hazards",
      winds: "view_winds",
      icing: "view_icing",
      turbulence: "view_turb",
    };
    trackEvent(eventMap[activeTab] || "view_weather_tab", { source: "aviation_hub" });
  }, [activeTab]);

  const normalizedIcao = useMemo(() => icaoInput.trim().toUpperCase(), [icaoInput]);
  const canSearch = ICAO_REGEX.test(normalizedIcao);

  const submitIcao = () => {
    if (!canSearch) return;
    setSearchIcao(normalizedIcao);
  };

  const refreshFavorites = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/airports/favorites"] });
  };

  const handleToggleFavorite = () => {
    runWithAuth("save_airport_favorite", async () => {
      try {
        if (currentFavorite) {
          await apiRequest("DELETE", `/api/airports/favorites/${searchIcao}`);
          toast({ title: "Removed from favorites", description: `${searchIcao} removed.` });
        } else {
          const airport = airportQuery.data;
          await apiRequest("POST", "/api/airports/favorites", {
            icao: searchIcao,
            name: airport?.name ?? null,
            city: airport?.city ?? null,
            state: airport?.state ?? null,
            alertIfr: false,
            alertMvfr: false,
          });
          toast({ title: "Airport saved", description: `${searchIcao} added to favorites.` });
        }
      } finally {
        refreshFavorites();
      }
    });
  };

  const handleUpdateAlerts = (updates: { alertIfr?: boolean; alertMvfr?: boolean }) => {
    runWithAuth("update_airport_alerts", async () => {
      if (!currentFavorite) return;
      await apiRequest("PATCH", `/api/airports/favorites/${searchIcao}/alerts`, updates);
      refreshFavorites();
    });
  };

  const airportQuery = useQuery({
    queryKey: ["/api/airports", searchIcao],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/airports/${searchIcao}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch airport");
      return res.json();
    },
    enabled: Boolean(searchIcao),
    staleTime: 1000 * 60 * 60,
  });

  const favoritesQuery = useQuery<AirportFavorite[]>({
    queryKey: ["/api/airports/favorites"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/airports/favorites"), { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to fetch airport favorites");
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  const favorites = favoritesQuery.data ?? [];
  const currentFavorite = useMemo(
    () => favorites.find((favorite) => favorite.icao === searchIcao),
    [favorites, searchIcao]
  );

  const metarQuery = useQuery({
    queryKey: ["/api/aviation/metar", searchIcao],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/aviation/metar/${searchIcao}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch METAR");
      return res.json();
    },
    enabled: Boolean(searchIcao),
    staleTime: 1000 * 60 * 3,
  });

  const tafQuery = useQuery({
    queryKey: ["/api/aviation/taf", searchIcao],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/aviation/taf/${searchIcao}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch TAF");
      return res.json();
    },
    enabled: Boolean(searchIcao),
    staleTime: 1000 * 60 * 3,
  });

  const notamsQuery = useQuery({
    queryKey: ["/api/notams", searchIcao],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/notams?icao=${searchIcao}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch NOTAMs");
      return res.json();
    },
    enabled: Boolean(searchIcao),
    staleTime: 1000 * 60 * 5,
  });

  const pirepsQuery = useQuery({
    queryKey: ["/api/aviation/pireps", searchIcao],
    queryFn: async () => {
      const res = await fetch(
        apiUrl(`/api/aviation/pireps?icao=${searchIcao}&radiusNm=200&ageHours=6`),
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch PIREPs");
      return res.json();
    },
    enabled: Boolean(searchIcao),
    staleTime: 1000 * 60 * 10,
  });

  const hazardsQuery = useQuery({
    queryKey: ["/api/aviation/hazards"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/aviation/hazards"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch hazards");
      return res.json();
    },
    staleTime: 1000 * 60 * 10,
  });

  const gfaQuery = useQuery({
    queryKey: ["/api/aviation/gfa/layers"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/aviation/gfa/layers"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch GFA layers");
      return res.json();
    },
    staleTime: 1000 * 60 * 30,
  });

  const windsQuery = useQuery({
    queryKey: ["/api/aviation/winds-temps", searchIcao, windsAltitude],
    queryFn: async () => {
      const airport = airportQuery.data;
      if (!airport?.lat || !airport?.lon) return { stations: [] };
      const lat = Number(airport.lat);
      const lon = Number(airport.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { stations: [] };
      const pad = 2.0;
      const bbox = `${lat - pad},${lon - pad},${lat + pad},${lon + pad}`;
      const res = await fetch(
        apiUrl(`/api/aviation/winds-temps?altitude=${windsAltitude}&bbox=${bbox}`),
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch winds aloft");
      return res.json();
    },
    enabled: Boolean(searchIcao) && Boolean(airportQuery.data?.lat),
    staleTime: 1000 * 60 * 15,
  });

  const icingQuery = useQuery({
    queryKey: ["/api/aviation/icing"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/aviation/icing"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch icing guidance");
      return res.json();
    },
    staleTime: 1000 * 60 * 60,
  });

  const turbulenceQuery = useQuery({
    queryKey: ["/api/aviation/turbulence"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/aviation/turbulence"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch turbulence guidance");
      return res.json();
    },
    staleTime: 1000 * 60 * 60,
  });

  const hazardsSummary = useMemo(() => buildHazardSummary(hazardsQuery.data), [hazardsQuery.data]);
  const icingSummary = useMemo(() => buildHazardSummary(icingQuery.data), [icingQuery.data]);
  const turbulenceSummary = useMemo(() => buildHazardSummary(turbulenceQuery.data), [turbulenceQuery.data]);

  const notamsCount = Array.isArray(notamsQuery.data?.notams) ? notamsQuery.data.notams.length : 0;
  const pirepsCount = Array.isArray(pirepsQuery.data?.reports) ? pirepsQuery.data.reports.length : 0;
  const windsCount = Array.isArray(windsQuery.data?.stations) ? windsQuery.data.stations.length : 0;

  const metarData = metarQuery.data?.data ?? metarQuery.data;
  const tafData = tafQuery.data?.data ?? tafQuery.data;
  const metarRaw = metarData?.rawOb || metarData?.raw || metarQuery.data?.raw || "";
  const tafRaw = tafData?.rawTAF || tafData?.raw || tafQuery.data?.raw || "";

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10">
      <div className="space-y-3">
        <div>
          <div className="text-sm text-muted-foreground">Aviation Weather Hub</div>
          <h1 className="text-2xl font-semibold">NOAA/AWC Aviation Weather</h1>
        </div>
        <Card>
          <CardContent className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="icao">Airport ICAO</Label>
              <Input
                id="icao"
                value={icaoInput}
                onChange={(event) => setIcaoInput(event.target.value)}
                placeholder="KAUS"
              />
              {!canSearch && icaoInput.trim().length > 0 && (
                <div className="text-xs text-amber-600">Enter a valid 3-4 letter ICAO code.</div>
              )}
            </div>
            <Button onClick={submitIcao} disabled={!canSearch}>Load Weather</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Favorite airports & alerts</CardTitle>
            <CardDescription>Save airports and toggle IFR/MVFR push alerts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-semibold">{searchIcao}</div>
                <div className="text-xs text-muted-foreground">
                  {airportQuery.data?.name
                    ? `${airportQuery.data?.name}${airportQuery.data?.city ? ` · ${airportQuery.data?.city}` : ""}${airportQuery.data?.state ? `, ${airportQuery.data?.state}` : ""}`
                    : "Save this airport for quick access and alerts."}
                </div>
              </div>
              <Button variant={currentFavorite ? "outline" : "default"} onClick={handleToggleFavorite}>
                {currentFavorite ? "Remove favorite" : "Save airport"}
              </Button>
            </div>

            {!isAuthenticated && (
              <div className="text-xs text-muted-foreground">
                Sign in to save airports and receive IFR/MVFR alerts.
              </div>
            )}

            {currentFavorite && (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="text-sm font-semibold">IFR/LIFR alerts</div>
                    <div className="text-xs text-muted-foreground">Notify when conditions drop to IFR.</div>
                  </div>
                  <Switch
                    checked={Boolean(currentFavorite.alertIfr)}
                    onCheckedChange={(checked) => handleUpdateAlerts({ alertIfr: checked })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="text-sm font-semibold">MVFR alerts</div>
                    <div className="text-xs text-muted-foreground">Notify when conditions drop to MVFR or worse.</div>
                  </div>
                  <Switch
                    checked={Boolean(currentFavorite.alertMvfr)}
                    onCheckedChange={(checked) => handleUpdateAlerts({ alertMvfr: checked })}
                  />
                </div>
              </div>
            )}

            {favorites.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {favorites.map((favorite) => (
                  <Button
                    key={favorite.id}
                    variant={favorite.icao === searchIcao ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSearchIcao(favorite.icao);
                      setIcaoInput(favorite.icao);
                    }}
                  >
                    {favorite.icao}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metar">METAR</TabsTrigger>
          <TabsTrigger value="taf">TAF</TabsTrigger>
          <TabsTrigger value="notams">NOTAMs</TabsTrigger>
          <TabsTrigger value="pireps">PIREPs</TabsTrigger>
          <TabsTrigger value="hazards">Hazards</TabsTrigger>
          <TabsTrigger value="winds">Winds Aloft</TabsTrigger>
          <TabsTrigger value="icing">Icing</TabsTrigger>
          <TabsTrigger value="turbulence">Turbulence</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>METAR</CardTitle>
                <CardDescription>Latest surface observation.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {metarQuery.data?.raw || metarQuery.data?.data?.rawOb || "No METAR loaded."}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>TAF</CardTitle>
                <CardDescription>Terminal forecast.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {tafQuery.data?.raw || tafQuery.data?.data?.rawTAF || "No TAF loaded."}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Route Signals</CardTitle>
                <CardDescription>Quick hazard + report counts.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant="secondary">NOTAMs {notamsCount} · US-only</Badge>
                <Badge variant="secondary">PIREPs {pirepsCount} · US-only</Badge>
                <Badge variant="secondary">Winds {windsCount}</Badge>
              </CardContent>
            </Card>
          </div>
          <div className="mt-4">
            <WeatherBriefingSummarizer
              metar={metarRaw}
              taf={tafRaw}
              pireps={pirepsQuery.data?.reports?.map((report: any) => report.rawOb ?? "").filter(Boolean).join("\n") ?? ""}
              sigmet={hazardsSummary.items.map((item) => item.hazard).filter(Boolean).join("\n")}
              origin={searchIcao}
            />
          </div>
        </TabsContent>

        <TabsContent value="metar" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>METAR</CardTitle>
              <CardDescription>Decoded + raw observation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {metarRaw ? (
                <div className="rounded-lg border bg-muted p-3 text-xs">
                  {metarRaw}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No METAR loaded.</div>
              )}
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Station</div>
                  <div className="font-semibold">{metarData?.icaoId || metarData?.station || searchIcao}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Observed</div>
                  <div className="font-semibold">{metarData?.obsTime || "-"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Wind</div>
                  <div className="font-semibold">
                    {metarData?.windDir ?? "-"} deg / {metarData?.windSpeed ?? "-"} kt
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Visibility</div>
                  <div className="font-semibold">{metarData?.visib ?? metarData?.visibility ?? "-"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Temp / Dewpoint</div>
                  <div className="font-semibold">
                    {metarData?.temp ?? "-"}C / {metarData?.dewpt ?? "-"}C
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Altimeter</div>
                  <div className="font-semibold">{metarData?.altimInHg ?? metarData?.altimeter ?? "-"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Flight Category</div>
                  <div className="font-semibold">{metarData?.fltCat || metarData?.flightCategory || "-"}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="taf" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>TAF</CardTitle>
              <CardDescription>Forecast details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tafRaw ? (
                <div className="rounded-lg border bg-muted p-3 text-xs">
                  {tafRaw}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No TAF loaded.</div>
              )}
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Station</div>
                  <div className="font-semibold">{tafData?.icaoId || tafData?.station || searchIcao}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Issued</div>
                  <div className="font-semibold">{tafData?.issueTime || "-"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Valid From</div>
                  <div className="font-semibold">{tafData?.validTimeFrom || "-"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Valid To</div>
                  <div className="font-semibold">{tafData?.validTimeTo || "-"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Forecast Periods</div>
                  <div className="font-semibold">{Array.isArray(tafData?.fcsts) ? tafData.fcsts.length : "-"}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notams" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>NOTAMs</CardTitle>
              <CardDescription>Active notices for {searchIcao}. US-only (FAA).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {notamsQuery.isError && (
                <div className="text-sm text-muted-foreground">NOTAM feed unavailable.</div>
              )}
              {!notamsQuery.isError && notamsCount === 0 && (
                <div className="text-sm text-muted-foreground">No active NOTAMs.</div>
              )}
              {notamsQuery.data?.notams?.map((notam: any) => (
                <div key={notam.id} className="rounded-lg border p-3 text-sm">
                  <div className="font-semibold">{notam.id}</div>
                  <div className="text-xs text-muted-foreground mt-1">{notam.text}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pireps" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>PIREPs</CardTitle>
              <CardDescription>Recent reports within 200 NM. US-only (FAA).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {pirepsCount === 0 && <div className="text-sm text-muted-foreground">No recent PIREPs in range.</div>}
              {pirepsQuery.data?.reports?.slice(0, 16).map((report: any, index: number) => (
                <div key={`${report.rawOb || report.id || index}`} className="rounded-lg border p-3 text-sm">
                  <div className="font-semibold">{report.rawOb || "PIREP"}</div>
                  {report.obsTime && <div className="text-xs text-muted-foreground mt-1">{report.obsTime}</div>}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hazards" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Hazards</CardTitle>
              <CardDescription>Domestic SIGMETs, G-AIRMETs, and convective forecasts (US-only).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {hazardsSummary.warnings.length > 0 && (
                <Alert>
                  <AlertDescription>{hazardsSummary.warnings.join(" ")}</AlertDescription>
                </Alert>
              )}
              <div className="text-sm text-muted-foreground">
                {hazardsSummary.items.length > 0
                  ? `${hazardsSummary.items.length} hazard items available.`
                  : "No hazards returned."}
                {hazardsSummary.tcfCount > 0 && ` TCF features: ${hazardsSummary.tcfCount}.`}
              </div>
              <div className="space-y-2">
                {hazardsSummary.items.length === 0 && hazardsSummary.tcfCount === 0 ? (
                  <div className="text-sm text-muted-foreground">No hazard details available.</div>
                ) : (
                  hazardsSummary.items.slice(0, 16).map((item, index) => (
                    <div key={`${item.source}-${item.hazard}-${index}`} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{item.hazard}</div>
                        <Badge variant="outline">{item.source.toUpperCase()}</Badge>
                      </div>
                      {item.dueTo && <div className="text-xs text-muted-foreground mt-1">Due to {item.dueTo}</div>}
                      {(item.validFrom || item.validTo) && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Valid {item.validFrom || "-"} to {item.validTo || "-"}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="winds" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Winds & Temps Aloft</CardTitle>
              <CardDescription>NOAA AWC wind/temp table overlay.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Altitude</Label>
                <Select value={windsAltitude} onValueChange={setWindsAltitude}>
                  <SelectTrigger className="h-8 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WINDS_ALOFT_LEVELS.map((altitude) => (
                      <SelectItem key={altitude} value={String(altitude)}>
                        {altitude.toLocaleString()} ft
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {windsCount === 0 && <div className="text-sm text-muted-foreground">No winds aloft data in range.</div>}
              {windsQuery.data?.stations?.slice(0, 16).map((station: any) => (
                <div key={`${station.stationId}-${station.lat}`} className="rounded-lg border p-3 text-sm">
                  <div className="font-semibold">{station.icao || station.stationId}</div>
                  <div className="text-xs text-muted-foreground">
                    {station.windDir ?? "-"} deg / {station.windSpeed ?? "-"} kt
                    {station.tempC !== null ? `, ${station.tempC}C` : ""}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="icing" className="mt-6">
          <Alert>
            <AlertDescription>
              Icing guidance is currently stubbed until NOAA/AWC provides a direct API or tile feed.
            </AlertDescription>
          </Alert>
          <Card className="mt-4">
            <CardContent className="space-y-3">
              {icingSummary.warnings.length > 0 && (
                <Alert>
                  <AlertDescription>{icingSummary.warnings.join(" ")}</AlertDescription>
                </Alert>
              )}
              {icingSummary.items.length === 0 ? (
                <div className="text-sm text-muted-foreground">No icing guidance returned yet.</div>
              ) : (
                icingSummary.items.slice(0, 16).map((item, index) => (
                  <div key={`${item.source}-${item.hazard}-${index}`} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{item.hazard}</div>
                      <Badge variant="outline">{item.source.toUpperCase()}</Badge>
                    </div>
                    {item.dueTo && <div className="text-xs text-muted-foreground mt-1">Due to {item.dueTo}</div>}
                    {(item.validFrom || item.validTo) && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Valid {item.validFrom || "-"} to {item.validTo || "-"}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="turbulence" className="mt-6">
          <Alert>
            <AlertDescription>
              Turbulence guidance is currently stubbed until NOAA/AWC provides a direct API or tile feed.
            </AlertDescription>
          </Alert>
          <Card className="mt-4">
            <CardContent className="space-y-3">
              {turbulenceSummary.warnings.length > 0 && (
                <Alert>
                  <AlertDescription>{turbulenceSummary.warnings.join(" ")}</AlertDescription>
                </Alert>
              )}
              {turbulenceSummary.items.length === 0 ? (
                <div className="text-sm text-muted-foreground">No turbulence guidance returned yet.</div>
              ) : (
                turbulenceSummary.items.slice(0, 16).map((item, index) => (
                  <div key={`${item.source}-${item.hazard}-${index}`} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{item.hazard}</div>
                      <Badge variant="outline">{item.source.toUpperCase()}</Badge>
                    </div>
                    {item.dueTo && <div className="text-xs text-muted-foreground mt-1">Due to {item.dueTo}</div>}
                    {(item.validFrom || item.validTo) && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Valid {item.validFrom || "-"} to {item.validTo || "-"}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {gfaQuery.data?.warnings?.length ? (
        <div className="mt-6 text-xs text-muted-foreground">{gfaQuery.data.warnings.join(" ")}</div>
      ) : null}
    </div>
  );
}
