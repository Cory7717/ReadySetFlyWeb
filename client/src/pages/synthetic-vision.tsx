import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, Navigation, Plane, Radar, RefreshCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

type AdsbAircraft = {
  icao?: string;
  hex?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number;
  alt_geom?: number;
  gs?: number;
  track?: number;
  flight?: string;
  r?: string;
  t?: string;
};

type AdsbExchangeResponse = {
  ac?: AdsbAircraft[];
  now?: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const formatCallsign = (value?: string) => (value || "").trim();

const getTerrainThreat = (aglFt: number, vsFpm: number) => {
  if (aglFt < 1200 && vsFpm < -900) return { label: "TERRAIN CAUTION", tone: "critical" as const };
  if (aglFt < 2200 && vsFpm < -600) return { label: "TERRAIN AWARE", tone: "warning" as const };
  return { label: "TERRAIN CLEAR", tone: "normal" as const };
};

export default function SyntheticVisionPage() {
  const { user, isAuthenticated } = useAuth();
  const entitlements = (user as any)?.entitlements;
  const isPro = entitlements?.canUseGpsSims ?? (user?.logbookProStatus === "active");

  const [pitchDeg, setPitchDeg] = useState(2);
  const [bankDeg, setBankDeg] = useState(0);
  const [headingDeg, setHeadingDeg] = useState(127);
  const [trackDeg, setTrackDeg] = useState(124);
  const [altitudeMslFt, setAltitudeMslFt] = useState(4500);
  const [aglFt, setAglFt] = useState(2600);
  const [groundSpeedKt, setGroundSpeedKt] = useState(118);
  const [verticalSpeedFpm, setVerticalSpeedFpm] = useState(-300);
  const [trafficEnabled, setTrafficEnabled] = useState(true);
  const [trafficLat, setTrafficLat] = useState(30.2672);
  const [trafficLon, setTrafficLon] = useState(-97.7431);
  const [trafficRadiusNm, setTrafficRadiusNm] = useState(80);

  useEffect(() => {
    trackEvent("synthetic_vision_view", { page: "/synthetic-vision" });
  }, []);

  const { data, isFetching, isLoading, error, refetch } = useQuery<AdsbExchangeResponse>({
    queryKey: ["/api/adsb/aircraft", trafficLat, trafficLon, trafficRadiusNm],
    enabled: Boolean(isPro && trafficEnabled),
    refetchInterval: 4000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: trafficLat.toFixed(4),
        lon: trafficLon.toFixed(4),
        dist: Math.round(trafficRadiusNm).toString(),
      });
      const res = await fetch(apiUrl(`/api/adsb/aircraft?${params.toString()}`), { credentials: "include" });
      if (!res.ok) throw new Error("Unable to load live traffic");
      return res.json();
    },
  });

  const traffic = useMemo(() => {
    const list = data?.ac ?? [];
    return list
      .filter((item) => typeof item.lat === "number" && typeof item.lon === "number")
      .slice(0, 25);
  }, [data]);

  const trafficUpdatedAt = data?.now ? new Date(data.now * 1000) : null;
  const terrainThreat = getTerrainThreat(aglFt, verticalSpeedFpm);
  const flightPathOffsetPx = clamp((trackDeg - headingDeg) * 2.2, -90, 90);
  const rollPointerPx = clamp(bankDeg * 2.2, -100, 100);

  const threatToneClass =
    terrainThreat.tone === "critical"
      ? "bg-red-500/20 text-red-200 border-red-400/30"
      : terrainThreat.tone === "warning"
      ? "bg-amber-500/20 text-amber-200 border-amber-400/30"
      : "bg-emerald-500/20 text-emerald-200 border-emerald-400/30";

  const pitchLines = Array.from({ length: 13 }, (_, index) => {
    const pitchMark = 30 - index * 5;
    return {
      pitchMark,
      offsetPx: pitchMark * 5,
      isMajor: pitchMark % 10 === 0,
    };
  });

  if (!isPro) {
    return (
      <div className="min-h-screen bg-background">
        <section className="bg-muted py-10">
          <div className="container mx-auto px-4 space-y-3">
            <Badge variant="outline">RSF In-Flight Lab</Badge>
            <h1 className="font-display text-3xl sm:text-4xl font-bold">RSF Synthetic Vision + Live Traffic</h1>
            <p className="text-muted-foreground max-w-3xl">
              RSF Pro unlocks synthetic-vision training, traffic overlays, and instructor-ready in-flight scenario reviews.
            </p>
          </div>
        </section>

        <section className="container mx-auto px-4 py-10">
          <Card>
            <CardHeader>
              <CardTitle>RSF Pro Feature</CardTitle>
              <CardDescription>
                This tool is available with RSF Pro so we can maintain realistic simulator quality and review workflows.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                <li>RSF-branded synthetic vision presentation</li>
                <li>Live ADS-B traffic panel with rapid refresh</li>
                <li>Scenario presets with session telemetry capture</li>
              </ul>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href={isAuthenticated ? "/logbook/pro" : "/register"}>
                    {isAuthenticated ? "Upgrade to RSF Pro" : "Create Free Account"}
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/gps-sims">Open GPS Sims</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-muted py-10">
        <div className="container mx-auto px-4 space-y-3">
          <Badge variant="outline">RSF Pro · Beta</Badge>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">RSF Synthetic Vision Lab</h1>
          <p className="text-muted-foreground max-w-3xl">
            RSF-branded synthetic vision and live traffic reference panel for advanced training workflows.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/flight-planner">Back to Flight Planner</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/live-traffic">Open Full Live Traffic Map</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8 space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Advisory training tool</AlertTitle>
          <AlertDescription>
            For situational awareness training only. Not a certified primary flight display or collision-avoidance system.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5" />
                Synthetic Vision View
              </CardTitle>
              <CardDescription>RSF-branded attitude, terrain-threat, and flight path marker preview.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-950 h-[420px]">
                <div
                  className="absolute inset-[-20%] origin-center"
                  style={{
                    transform: `translateY(${pitchDeg * 5}px) rotate(${bankDeg * -1}deg)`,
                  }}
                >
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-sky-300 via-sky-500 to-sky-700" />
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-amber-700 to-amber-950" />
                  <div className="absolute inset-x-0 top-1/2 h-[2px] bg-white/80" />

                  {pitchLines.map((line) => (
                    <div
                      key={line.pitchMark}
                      className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center text-white/80 text-[11px] font-medium"
                      style={{ top: `calc(50% - ${line.offsetPx}px)` }}
                    >
                      <span className="w-8 text-right pr-2">{line.pitchMark !== 0 ? line.pitchMark : ""}</span>
                      <div className={line.isMajor ? "w-24 h-[2px] bg-white/70" : "w-12 h-[1px] bg-white/55"} />
                      <span className="w-8 pl-2">{line.pitchMark !== 0 ? line.pitchMark : ""}</span>
                    </div>
                  ))}
                </div>

                <div className="absolute inset-x-0 top-3 flex justify-center text-xs font-semibold text-slate-900">
                  <div className="rounded-md bg-white/90 px-3 py-1">HDG {Math.round(headingDeg).toString().padStart(3, "0")}</div>
                </div>

                <div className="absolute left-4 top-16 rounded-md border border-white/20 bg-slate-900/70 px-3 py-2 text-xs text-slate-100">
                  <div>ALT {Math.round(altitudeMslFt).toLocaleString()} MSL</div>
                  <div>AGL {Math.round(aglFt).toLocaleString()} FT</div>
                  <div>GS {Math.round(groundSpeedKt)} KT</div>
                  <div>VS {Math.round(verticalSpeedFpm)} FPM</div>
                </div>

                <div className="absolute right-4 top-16 rounded-md border border-white/20 bg-slate-900/70 px-3 py-2 text-xs text-slate-100">
                  <div>TRK {Math.round(trackDeg).toString().padStart(3, "0")}</div>
                  <div>BANK {Math.round(bankDeg)}°</div>
                  <div>PITCH {Math.round(pitchDeg)}°</div>
                </div>

                <div
                  className="absolute left-1/2 top-1/2 -translate-y-1/2"
                  style={{ transform: `translate(${flightPathOffsetPx}px, -50%)` }}
                >
                  <div className="h-6 w-6 rounded-full border-2 border-lime-300/90" />
                  <div className="mx-auto h-4 w-[2px] bg-lime-300/90" />
                </div>

                <div className="absolute left-1/2 top-6 -translate-x-1/2">
                  <div className="h-2 w-1 rounded bg-white/80" style={{ transform: `translateX(${rollPointerPx}px)` }} />
                </div>

                <div className={`absolute bottom-4 left-4 rounded-md border px-3 py-1 text-xs font-semibold ${threatToneClass}`}>
                  {terrainThreat.label}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pitch">Pitch ({pitchDeg}°)</Label>
                  <Input id="pitch" type="range" min={-20} max={20} value={pitchDeg} onChange={(e) => setPitchDeg(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank">Bank ({bankDeg}°)</Label>
                  <Input id="bank" type="range" min={-45} max={45} value={bankDeg} onChange={(e) => setBankDeg(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heading">Heading ({headingDeg}°)</Label>
                  <Input id="heading" type="range" min={0} max={359} value={headingDeg} onChange={(e) => setHeadingDeg(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="track">Track ({trackDeg}°)</Label>
                  <Input id="track" type="range" min={0} max={359} value={trackDeg} onChange={(e) => setTrackDeg(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agl">AGL ({aglFt} ft)</Label>
                  <Input id="agl" type="range" min={200} max={8000} step={100} value={aglFt} onChange={(e) => setAglFt(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vs">Vertical Speed ({verticalSpeedFpm} fpm)</Label>
                  <Input id="vs" type="range" min={-2000} max={2000} step={100} value={verticalSpeedFpm} onChange={(e) => setVerticalSpeedFpm(Number(e.target.value))} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPitchDeg(4);
                    setBankDeg(18);
                    setHeadingDeg(142);
                    setTrackDeg(148);
                    setVerticalSpeedFpm(350);
                    setAglFt(3200);
                    trackEvent("synthetic_vision_preset", { preset: "departure_turn" });
                  }}
                >
                  Departure Turn
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPitchDeg(-2);
                    setBankDeg(0);
                    setHeadingDeg(185);
                    setTrackDeg(184);
                    setVerticalSpeedFpm(-650);
                    setAglFt(1800);
                    trackEvent("synthetic_vision_preset", { preset: "approach_descent" });
                  }}
                >
                  Approach Descent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPitchDeg(10);
                    setBankDeg(28);
                    setHeadingDeg(95);
                    setTrackDeg(110);
                    setVerticalSpeedFpm(1200);
                    setAglFt(900);
                    trackEvent("synthetic_vision_preset", { preset: "escape_maneuver" });
                  }}
                >
                  Escape Climb
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radar className="h-5 w-5" />
                Live Traffic Panel
              </CardTitle>
              <CardDescription>ADSBExchange traffic feed in a compact in-flight reference layout.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Traffic feed</p>
                  <p className="text-xs text-muted-foreground">4-second refresh cycle</p>
                </div>
                <Switch
                  checked={trafficEnabled}
                  onCheckedChange={(checked) => {
                    setTrafficEnabled(checked);
                    trackEvent("synthetic_vision_traffic_toggle", { enabled: checked });
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="traffic-lat">Lat</Label>
                  <Input
                    id="traffic-lat"
                    value={trafficLat}
                    type="number"
                    step="0.0001"
                    onChange={(e) => setTrafficLat(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="traffic-lon">Lon</Label>
                  <Input
                    id="traffic-lon"
                    value={trafficLon}
                    type="number"
                    step="0.0001"
                    onChange={(e) => setTrafficLon(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="traffic-radius">Radius NM</Label>
                <Input
                  id="traffic-radius"
                  value={trafficRadiusNm}
                  type="number"
                  min={25}
                  max={300}
                  onChange={(e) => setTrafficRadiusNm(clamp(Number(e.target.value), 25, 300))}
                />
              </div>

              <Button variant="outline" className="w-full" onClick={() => refetch()} disabled={!trafficEnabled}>
                <RefreshCcw className="h-4 w-4 mr-2" />
                Refresh traffic
              </Button>

              <div className="rounded-md border p-3 text-xs text-muted-foreground">
                {trafficUpdatedAt ? `Updated ${trafficUpdatedAt.toLocaleTimeString()}` : "No update timestamp yet"}
                {isFetching ? " · refreshing..." : ""}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>Unable to load traffic feed. Check ADSBExchange configuration.</AlertDescription>
                </Alert>
              )}

              <div className="max-h-[360px] overflow-y-auto space-y-2">
                {trafficEnabled && !isLoading && traffic.length === 0 && (
                  <div className="text-sm text-muted-foreground">No traffic returned for this area.</div>
                )}
                {traffic.map((ac) => {
                  const ident = formatCallsign(ac.flight) || ac.r || ac.t || ac.icao || ac.hex || "UNKNOWN";
                  return (
                    <div key={`${ac.icao || ac.hex || ident}-${ac.lat}-${ac.lon}`} className="rounded-md border px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{ident}</p>
                        <Badge variant="outline">TRK {Math.round(ac.track ?? 0)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ALT {Math.round((ac.alt_baro ?? ac.alt_geom ?? 0) || 0)} ft · GS {Math.round(ac.gs ?? 0)} kt
                      </p>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                Traffic and synthetic view are advisory references only and do not replace certified avionics or ATC instructions.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
