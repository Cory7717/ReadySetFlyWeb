import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Clock3,
  Gauge,
  Map as MapIcon,
  Navigation,
  Pause,
  PlaneLanding,
  PlaneTakeoff,
  Play,
  RotateCcw,
  Route as RouteIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import {
  bearingBetweenPoints,
  clamp,
  computeDemoRouteProgress,
  computeRouteDistanceNm,
  greatCircleNm,
  interpolateRouteOwnship,
  projectPointRelativeToOwnship,
  type DemoRoutePoint,
} from "@/lib/flightDemo";

type AirportSearchResult = {
  icao: string;
  name?: string | null;
  city?: string | null;
  state?: string | null;
  lat?: number;
  lon?: number;
};

type AirportMeta = {
  icao: string;
  name: string | null;
  lat: number;
  lon: number;
  city?: string | null;
  state?: string | null;
};

type RouteSuggestionResponse = {
  departure: string;
  destination: string;
  waypoints: string[];
  plannedStops: string[];
  meta?: {
    routeDistanceNm?: number;
    planningLegNm?: number;
    suggestedStopCount?: number;
    overwaterLikely?: boolean;
  } | null;
};

type ViewMode = "map" | "vision";
type DemoSpeed = "1x" | "2x" | "4x" | "8x";

const DEFAULT_DEPARTURE = "KDAL";
const DEFAULT_ARRIVAL = "KHOU";
const DEMO_CRUISE_KTS = 140;
const DEMO_ALTITUDE_FT = 6500;

function normalizeAirportCode(value: string) {
  return value.trim().toUpperCase();
}

function formatMinutes(totalMinutes: number | null) {
  if (totalMinutes == null || !Number.isFinite(totalMinutes)) return "--";
  const rounded = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  return hours > 0 ? `${hours}h ${minutes.toString().padStart(2, "0")}m` : `${minutes}m`;
}

function formatRouteLabel(points: DemoRoutePoint[]) {
  return points.map((point) => point.icao).join(" ");
}

function smallestAngleDiff(target: number, current: number) {
  let diff = (target - current + 540) % 360 - 180;
  if (diff === -180) diff = 180;
  return diff;
}

async function fetchAirportSuggestions(query: string) {
  const normalized = normalizeAirportCode(query);
  if (!normalized) return [] as AirportSearchResult[];
  const response = await fetch(apiUrl(`/api/airports/search?q=${encodeURIComponent(normalized)}`));
  if (!response.ok) return [] as AirportSearchResult[];
  const data = await response.json();
  return Array.isArray(data) ? data.slice(0, 8) : [];
}

async function fetchAirportMeta(icao: string): Promise<AirportMeta | null> {
  const normalized = normalizeAirportCode(icao);
  if (!normalized) return null;

  const detailResponse = await fetch(apiUrl(`/api/airports/${encodeURIComponent(normalized)}`));
  if (detailResponse.ok) {
    const detail = await detailResponse.json();
    const lat = Number(detail?.lat);
    const lon = Number(detail?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return {
        icao: normalizeAirportCode(String(detail?.icao || normalized)),
        name: detail?.name ?? null,
        city: detail?.city ?? null,
        state: detail?.state ?? null,
        lat,
        lon,
      };
    }
  }

  const suggestions = await fetchAirportSuggestions(normalized);
  const exact = suggestions.find((airport) => normalizeAirportCode(airport.icao) === normalized) || suggestions[0];
  if (!exact) return null;
  const lat = Number(exact.lat);
  const lon = Number(exact.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    icao: normalizeAirportCode(exact.icao),
    name: exact.name ?? null,
    city: exact.city ?? null,
    state: exact.state ?? null,
    lat,
    lon,
  };
}

function orderIntermediateAirports(
  departure: AirportMeta,
  destination: AirportMeta,
  intermediates: AirportMeta[],
) {
  if (intermediates.length <= 1) return intermediates;
  const refLat = (departure.lat + destination.lat) / 2;
  const start = {
    x: departure.lon * 60 * Math.cos((refLat * Math.PI) / 180),
    y: departure.lat * 60,
  };
  const end = {
    x: destination.lon * 60 * Math.cos((refLat * Math.PI) / 180),
    y: destination.lat * 60,
  };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const legSq = Math.max(dx * dx + dy * dy, 1);

  return [...intermediates].sort((a, b) => {
    const ax = a.lon * 60 * Math.cos((refLat * Math.PI) / 180) - start.x;
    const ay = a.lat * 60 - start.y;
    const bx = b.lon * 60 * Math.cos((refLat * Math.PI) / 180) - start.x;
    const by = b.lat * 60 - start.y;
    const aAlong = (ax * dx + ay * dy) / legSq;
    const bAlong = (bx * dx + by * dy) / legSq;
    return aAlong - bAlong;
  });
}

function projectMapPoint(
  ownship: { lat: number; lon: number; heading: number },
  point: DemoRoutePoint,
  rangeAheadNm: number,
  rangeSideNm: number,
) {
  const { forwardNm, rightNm } = projectPointRelativeToOwnship(ownship, point);
  return {
    x: 50 + (rightNm / rangeSideNm) * 34,
    y: 78 - (forwardNm / rangeAheadNm) * 64,
    forwardNm,
  };
}

function FlightDemoMapSurface({
  routePoints,
  ownship,
  nextWaypoint,
  remainingRouteNm,
}: {
  routePoints: DemoRoutePoint[];
  ownship: { lat: number; lon: number; heading: number };
  nextWaypoint: string | null;
  remainingRouteNm: number;
}) {
  const rangeAheadNm = clamp(Math.max(remainingRouteNm * 0.42, 18), 18, 64);
  const rangeSideNm = Math.max(14, rangeAheadNm * 0.72);
  const projected = routePoints.map((point) => ({
    point,
    ...projectMapPoint(ownship, point, rangeAheadNm, rangeSideNm),
  }));
  const polylinePoints = projected
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");

  return (
    <div className="relative h-[420px] overflow-hidden rounded-[24px] border border-slate-800 bg-[#0A0E14]">
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <defs>
          <linearGradient id="rsf-demo-map-bg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#091018" />
            <stop offset="65%" stopColor="#0A0E14" />
            <stop offset="100%" stopColor="#060A10" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill="url(#rsf-demo-map-bg)" />
        {Array.from({ length: 8 }).map((_, index) => (
          <line
            key={`grid-v-${index}`}
            x1={10 + index * 10}
            y1="0"
            x2={10 + index * 10}
            y2="100"
            stroke="rgba(122,155,184,0.08)"
            strokeWidth="0.3"
          />
        ))}
        {Array.from({ length: 8 }).map((_, index) => (
          <line
            key={`grid-h-${index}`}
            x1="0"
            y1={8 + index * 11}
            x2="100"
            y2={8 + index * 11}
            stroke="rgba(122,155,184,0.08)"
            strokeWidth="0.3"
          />
        ))}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#C8922A"
          strokeWidth="1.25"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {projected.map(({ point, x, y }) => {
          const isNext = nextWaypoint === point.icao;
          const isPrimary = point.kind === "origin" || point.kind === "destination";
          return (
            <g key={`demo-map-${point.icao}`}>
              <circle
                cx={x}
                cy={y}
                r={isPrimary ? 1.9 : point.kind === "stop" ? 1.7 : 1.4}
                fill={isNext ? "#00D4A0" : point.kind === "stop" ? "#4A9FD4" : "#E8EDF4"}
                stroke={isPrimary ? "#C8922A" : "rgba(10,14,20,0.85)"}
                strokeWidth="0.45"
              />
              <text
                x={x + 1.8}
                y={y - 1.8}
                fill={isNext ? "#00D4A0" : "#E8EDF4"}
                fontSize="2.3"
                letterSpacing="0.14"
              >
                {point.icao}
              </text>
            </g>
          );
        })}
        <g transform="translate(50 78)">
          <path d="M0 -4.2 L2.9 3.2 L0 1.4 L-2.9 3.2 Z" fill="#E8EDF4" stroke="#0A0E14" strokeWidth="0.45" />
          <circle cx="0" cy="0" r="5.8" fill="none" stroke="rgba(74,159,212,0.22)" strokeWidth="0.55" />
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-x-4 top-4 flex items-center justify-between">
        <div className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
          Map Follow
        </div>
        <div className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
          Track up
        </div>
      </div>
    </div>
  );
}

function FlightDemoVisionSurface({
  routePoints,
  ownship,
  nextWaypoint,
  nextWaypointDistanceNm,
  crossTrackNm,
  verticalSpeedFpm,
  remainingRouteNm,
}: {
  routePoints: DemoRoutePoint[];
  ownship: { lat: number; lon: number; altitudeFt: number; heading: number };
  nextWaypoint: string | null;
  nextWaypointDistanceNm: number | null;
  crossTrackNm: number;
  verticalSpeedFpm: number;
  remainingRouteNm: number;
}) {
  const currentIndex = routePoints.findIndex((point) => point.icao === nextWaypoint);
  const nextLegBearing =
    currentIndex > 0 && currentIndex < routePoints.length - 1
      ? bearingBetweenPoints(routePoints[currentIndex], routePoints[currentIndex + 1])
      : ownship.heading;
  const routeCue = clamp(
    (crossTrackNm * -10) +
      (nextWaypointDistanceNm != null && nextWaypointDistanceNm < 12
        ? smallestAngleDiff(nextLegBearing, ownship.heading) * 0.32
        : 0),
    -18,
    18,
  );
  const pitchOffset = clamp(verticalSpeedFpm / 120, -8, 6);
  const gateCenters = [routeCue * 0.22, routeCue * 0.45, routeCue * 0.72, routeCue];

  return (
    <div className="relative h-[420px] overflow-hidden rounded-[24px] border border-slate-800 bg-[#060A10]">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#0A1428_0%,#16345E_48%,#1D2D23_49%,#3B2C1E_100%)]" />
      <div className="absolute inset-x-0 top-[49%] h-[2px] bg-white/80" />
      <div className="absolute inset-x-0 top-[22%] flex justify-center">
        <div className="relative h-12 w-56">
          <div className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 rounded-b-full border-x border-b border-white/50" />
          {[-30, -20, -10, 10, 20, 30].map((tick) => (
            <div
              key={`bank-${tick}`}
              className="absolute top-3 h-3 w-px bg-white/50"
              style={{ left: `${50 + tick * 1.05}%` }}
            />
          ))}
        </div>
      </div>
      {[-10, -5, 0, 5, 10].map((value) => (
        <div
          key={`pitch-${value}`}
          className="absolute left-1/2 flex -translate-x-1/2 items-center gap-3 text-[11px] font-medium text-white/75"
          style={{ top: `${50 - value * 2.35 + pitchOffset}%` }}
        >
          <span>{value > 0 ? `+${value}` : value}</span>
          <div className="h-px w-28 bg-white/60" />
          <span>{value > 0 ? `+${value}` : value}</span>
        </div>
      ))}
      {gateCenters.map((center, index) => (
        <div
          key={`vision-gate-${index}`}
          className="absolute rounded-[18px] border border-[#C8922A]/80 bg-[#C8922A]/8"
          style={{
            left: `${50 + center - (18 - index * 2)}%`,
            top: `${24 + index * 12}%`,
            width: `${36 - index * 4}%`,
            height: `${17 - index * 1.5}%`,
          }}
        />
      ))}
      <div
        className="absolute left-1/2 top-[56%] h-16 w-[3px] rounded-full bg-[#C8922A]"
        style={{ transform: `translateX(${routeCue * 1.8}px)` }}
      />
      <div className="absolute left-1/2 top-[62%] h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#C8922A]">
        <div className="absolute left-1/2 top-1/2 h-[2px] w-6 -translate-x-1/2 -translate-y-1/2 bg-[#C8922A]" />
        <div className="absolute left-1/2 top-1/2 h-6 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-[#C8922A]" />
      </div>
      <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3">
        <div className="rounded-2xl border border-[#1E2D42] bg-[#091018]/88 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Vision guidance</div>
          <div className="mt-1 text-sm font-semibold text-[#E8EDF4]">
            {nextWaypoint ? `Track ${nextWaypoint}` : "Route tunnel active"}
          </div>
          <div className="mt-1 text-xs text-[#7A9BB8]">
            {nextWaypointDistanceNm != null ? `${nextWaypointDistanceNm.toFixed(1)} NM to next fix` : "Monitoring current leg"}
          </div>
        </div>
        <div className="rounded-2xl border border-[#1E2D42] bg-[#091018]/88 px-4 py-3 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Remain</div>
          <div className="mt-1 font-mono text-xl text-[#F5A623]">{remainingRouteNm.toFixed(1)} NM</div>
        </div>
      </div>
      <div className="absolute bottom-4 left-4 right-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#1E2D42] bg-[#091018]/88 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Altitude</div>
          <div className="mt-1 font-mono text-2xl text-[#F5A623]">{Math.round(ownship.altitudeFt)}</div>
        </div>
        <div className="rounded-2xl border border-[#1E2D42] bg-[#091018]/88 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Heading</div>
          <div className="mt-1 font-mono text-2xl text-[#F5A623]">{Math.round(ownship.heading).toString().padStart(3, "0")}</div>
        </div>
        <div className="rounded-2xl border border-[#1E2D42] bg-[#091018]/88 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Cross track</div>
          <div className="mt-1 font-mono text-2xl text-[#F5A623]">{Math.abs(crossTrackNm).toFixed(1)} NM</div>
        </div>
      </div>
    </div>
  );
}

export default function SyntheticVisionPage() {
  const [departureInput, setDepartureInput] = useState(DEFAULT_DEPARTURE);
  const [arrivalInput, setArrivalInput] = useState(DEFAULT_ARRIVAL);
  const [departureSuggestions, setDepartureSuggestions] = useState<AirportSearchResult[]>([]);
  const [arrivalSuggestions, setArrivalSuggestions] = useState<AirportSearchResult[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [speed, setSpeed] = useState<DemoSpeed>("4x");
  const [running, setRunning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routePoints, setRoutePoints] = useState<DemoRoutePoint[]>([]);
  const [routeLabel, setRouteLabel] = useState("");
  const [routeMeta, setRouteMeta] = useState<RouteSuggestionResponse["meta"] | null>(null);
  const [progressNm, setProgressNm] = useState(0);

  useEffect(() => {
    trackEvent("synthetic_vision_demo_view", { page: "/synthetic-vision" });
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const suggestions = await fetchAirportSuggestions(departureInput).catch(() => [] as AirportSearchResult[]);
      setDepartureSuggestions(suggestions);
    }, 160);
    return () => window.clearTimeout(timeout);
  }, [departureInput]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const suggestions = await fetchAirportSuggestions(arrivalInput).catch(() => [] as AirportSearchResult[]);
      setArrivalSuggestions(suggestions);
    }, 160);
    return () => window.clearTimeout(timeout);
  }, [arrivalInput]);

  const loadDemoRoute = useCallback(async (nextDeparture?: string, nextArrival?: string) => {
    const departure = normalizeAirportCode(nextDeparture ?? departureInput);
    const arrival = normalizeAirportCode(nextArrival ?? arrivalInput);
    if (!departure || !arrival) {
      setError("Departure and arrival are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const suggestionResponse = await fetch(
        apiUrl(
          `/api/airports/route-suggestions?departure=${encodeURIComponent(departure)}&destination=${encodeURIComponent(arrival)}&cruiseKtas=${DEMO_CRUISE_KTS}`,
        ),
      );
      const suggestions: RouteSuggestionResponse | null = suggestionResponse.ok ? await suggestionResponse.json() : null;
      const stopSet = new Set((suggestions?.plannedStops || []).map(normalizeAirportCode));
      const routeIcaos = Array.from(
        new Set([
          departure,
          ...(suggestions?.waypoints || []).map(normalizeAirportCode),
          ...(suggestions?.plannedStops || []).map(normalizeAirportCode),
          arrival,
        ]),
      );
      const airportMetaList = await Promise.all(routeIcaos.map((icao) => fetchAirportMeta(icao)));
      const airportMap = new globalThis.Map(
        airportMetaList
          .filter((airport): airport is AirportMeta => Boolean(airport))
          .map((airport) => [airport.icao, airport]),
      );

      const departureMeta = airportMap.get(departure);
      const arrivalMeta = airportMap.get(arrival);
      if (!departureMeta || !arrivalMeta) {
        throw new Error("Unable to resolve one of the demo airports.");
      }

      const intermediates = orderIntermediateAirports(
        departureMeta,
        arrivalMeta,
        routeIcaos
          .filter((icao) => icao !== departure && icao !== arrival)
          .map((icao) => airportMap.get(icao))
          .filter((airport): airport is AirportMeta => Boolean(airport)),
      );

      const nextRoute: DemoRoutePoint[] = [
        {
          icao: departureMeta.icao,
          name: departureMeta.name,
          latitude: departureMeta.lat,
          longitude: departureMeta.lon,
          kind: "origin",
        },
        ...intermediates.map(
          (airport): DemoRoutePoint => ({
            icao: airport.icao,
            name: airport.name,
            latitude: airport.lat,
            longitude: airport.lon,
            kind: stopSet.has(airport.icao) ? "stop" : "waypoint",
          }),
        ),
        {
          icao: arrivalMeta.icao,
          name: arrivalMeta.name,
          latitude: arrivalMeta.lat,
          longitude: arrivalMeta.lon,
          kind: "destination",
        },
      ];

      setDepartureInput(departureMeta.icao);
      setArrivalInput(arrivalMeta.icao);
      setRoutePoints(nextRoute);
      setRouteLabel(formatRouteLabel(nextRoute));
      setRouteMeta(suggestions?.meta ?? null);
      setProgressNm(0);
      setRunning(true);
      trackEvent("synthetic_vision_demo_build", {
        departure: departureMeta.icao,
        destination: arrivalMeta.icao,
        points: nextRoute.length,
      });
    } catch (buildError) {
      const message = buildError instanceof Error ? buildError.message : "Unable to build the flight demo.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [arrivalInput, departureInput]);

  useEffect(() => {
    void loadDemoRoute(DEFAULT_DEPARTURE, DEFAULT_ARRIVAL);
  }, [loadDemoRoute]);

  const speedMultiplier = speed === "8x" ? 8 : speed === "4x" ? 4 : speed === "2x" ? 2 : 1;
  const totalRouteNm = useMemo(() => computeRouteDistanceNm(routePoints), [routePoints]);
  const progressPct = totalRouteNm > 0 ? clamp(progressNm / totalRouteNm, 0, 1) : 0;
  const flightFrame = useMemo(
    () => interpolateRouteOwnship(routePoints, progressPct, DEMO_CRUISE_KTS, DEMO_ALTITUDE_FT),
    [progressPct, routePoints],
  );
  const routeProgress = useMemo(
    () =>
      computeDemoRouteProgress(
        routePoints,
        flightFrame?.ownship
          ? { lat: flightFrame.ownship.lat, lon: flightFrame.ownship.lon, speedKts: flightFrame.ownship.speedKts }
          : null,
      ),
    [flightFrame, routePoints],
  );
  const nextWaypointPoint = useMemo(
    () => routePoints.find((point) => point.icao === routeProgress?.nextWaypoint) || null,
    [routePoints, routeProgress?.nextWaypoint],
  );
  const nextWaypointDistanceNm = useMemo(() => {
    if (!flightFrame?.ownship || !nextWaypointPoint) return null;
    return greatCircleNm(
      { latitude: flightFrame.ownship.lat, longitude: flightFrame.ownship.lon },
      nextWaypointPoint,
    );
  }, [flightFrame?.ownship, nextWaypointPoint]);
  const elapsedMinutes = totalRouteNm > 0 ? (progressNm / DEMO_CRUISE_KTS) * 60 : 0;
  const remainingMinutes = routeProgress ? (routeProgress.remainingRouteNm / DEMO_CRUISE_KTS) * 60 : null;

  useEffect(() => {
    if (!running || !totalRouteNm || loading) return;
    let last = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.08);
      last = now;
      setProgressNm((current) => {
        const next = Math.min(totalRouteNm, current + (DEMO_CRUISE_KTS * speedMultiplier * dt) / 3600);
        if (next >= totalRouteNm) {
          setRunning(false);
        }
        return next;
      });
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [loading, running, speedMultiplier, totalRouteNm]);

  const demoMetrics = useMemo(
    () => [
      {
        label: "IAS",
        value: flightFrame?.ownship.speedKts ? Math.round(flightFrame.ownship.speedKts).toString() : "--",
      },
      {
        label: "ALT",
        value: flightFrame?.ownship.altitudeFt ? Math.round(flightFrame.ownship.altitudeFt).toString() : "--",
      },
      {
        label: "VSI",
        value: flightFrame ? `${Math.round(flightFrame.verticalSpeedFpm)}` : "--",
      },
      {
        label: "HDG",
        value: flightFrame?.ownship.heading ? Math.round(flightFrame.ownship.heading).toString().padStart(3, "0") : "--",
      },
      {
        label: "ETE",
        value: formatMinutes(remainingMinutes),
      },
    ],
    [flightFrame, remainingMinutes],
  );

  return (
    <div className="min-h-screen bg-[#060A10] text-[#E8EDF4]">
      <section className="border-b border-[#1E2D42] bg-[radial-gradient(circle_at_top_left,#16345E_0%,#0A1428_32%,#060A10_78%)] py-12">
        <div className="container mx-auto px-4 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-[#1E2D42] bg-[#111820] text-[#E8EDF4] hover:bg-[#111820]">Web Demo</Badge>
            <Badge className="border-[#1E2D42] bg-[#111820] text-[#7A9BB8] hover:bg-[#111820]">Map-first FlightDeck preview</Badge>
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                Flight demo for the new mobile cockpit.
              </h1>
              <p className="max-w-3xl text-base leading-7 text-[#7A9BB8]">
                Enter a departure and arrival airport, then preview a browser simulation of the new Ready Set Fly
                in-flight experience. The map follows the aircraft, the route uses live airport geometry, and playback
                runs up to 8x speed.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline" className="border-[#1E2D42] bg-[#111820] text-[#E8EDF4] hover:bg-[#1A2332]">
                  <Link href="/flight-planner">Open planner</Link>
                </Button>
                <Button asChild variant="outline" className="border-[#1E2D42] bg-[#111820] text-[#E8EDF4] hover:bg-[#1A2332]">
                  <Link href="/ifr-tools">IFR tools</Link>
                </Button>
              </div>
            </div>

            <Card className="border-[#1E2D42] bg-[#111820]/95 text-[#E8EDF4] shadow-none">
              <CardHeader>
                <CardTitle>Build demo route</CardTitle>
                <CardDescription className="text-[#7A9BB8]">
                  Departure and arrival are enough. RSF will fill in helper waypoints when it can.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Departure</label>
                    <Input
                      list="rsf-demo-departures"
                      value={departureInput}
                      onChange={(event) => setDepartureInput(normalizeAirportCode(event.target.value))}
                      className="border-[#1E2D42] bg-[#0A0E14] font-mono text-lg text-[#E8EDF4]"
                      placeholder="KDAL"
                    />
                    <datalist id="rsf-demo-departures">
                      {departureSuggestions.map((airport) => (
                        <option key={`dep-${airport.icao}`} value={airport.icao}>
                          {airport.name || airport.city || airport.icao}
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Arrival</label>
                    <Input
                      list="rsf-demo-arrivals"
                      value={arrivalInput}
                      onChange={(event) => setArrivalInput(normalizeAirportCode(event.target.value))}
                      className="border-[#1E2D42] bg-[#0A0E14] font-mono text-lg text-[#E8EDF4]"
                      placeholder="KHOU"
                    />
                    <datalist id="rsf-demo-arrivals">
                      {arrivalSuggestions.map((airport) => (
                        <option key={`arr-${airport.icao}`} value={airport.icao}>
                          {airport.name || airport.city || airport.icao}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#1E2D42] bg-[#0A0E14] px-4 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Demo profile</div>
                    <div className="mt-2 flex items-center gap-2 text-sm text-[#E8EDF4]">
                      <Gauge className="h-4 w-4 text-[#4A9FD4]" />
                      {DEMO_CRUISE_KTS} KTAS at {DEMO_ALTITUDE_FT.toLocaleString()} ft
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#1E2D42] bg-[#0A0E14] px-4 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Playback</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(["1x", "2x", "4x", "8x"] as DemoSpeed[]).map((value) => (
                        <Button
                          key={value}
                          type="button"
                          size="sm"
                          variant="outline"
                          className={value === speed ? "border-[#C8922A] bg-[#1A2332] text-[#E8EDF4]" : "border-[#1E2D42] bg-[#111820] text-[#7A9BB8]"}
                          onClick={() => setSpeed(value)}
                        >
                          {value}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => void loadDemoRoute()}
                    disabled={loading}
                    className="bg-[#C8922A] text-[#0A0E14] hover:bg-[#d5a042]"
                  >
                    {loading ? "Building..." : "Launch Flight Demo"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#1E2D42] bg-[#111820] text-[#E8EDF4] hover:bg-[#1A2332]"
                    onClick={() => {
                      setProgressNm(0);
                      setRunning(false);
                    }}
                  >
                    Reset position
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8 space-y-6">
        {error ? (
          <Alert className="border-[#E8453C]/30 bg-[#2A1212] text-[#E8EDF4]">
            <AlertTitle>Unable to build demo</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">FlightDeck demo</div>
                <div className="mt-1 flex items-center gap-2 text-2xl font-semibold">
                  <RouteIcon className="h-5 w-5 text-[#C8922A]" />
                  {routeLabel || `${departureInput} ${arrivalInput}`}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={viewMode === "map" ? "border-[#4A9FD4] bg-[#1A2332] text-[#E8EDF4]" : "border-[#1E2D42] bg-[#111820] text-[#7A9BB8]"}
                  onClick={() => setViewMode("map")}
                >
                  <MapIcon className="mr-2 h-4 w-4" />
                  Map
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={viewMode === "vision" ? "border-[#C8922A] bg-[#1A2332] text-[#E8EDF4]" : "border-[#1E2D42] bg-[#111820] text-[#7A9BB8]"}
                  onClick={() => setViewMode("vision")}
                >
                  <Navigation className="mr-2 h-4 w-4" />
                  Vision
                </Button>
              </div>
            </div>

            {viewMode === "map" && flightFrame?.ownship ? (
              <FlightDemoMapSurface
                routePoints={routePoints}
                ownship={flightFrame.ownship}
                nextWaypoint={routeProgress?.nextWaypoint || null}
                remainingRouteNm={routeProgress?.remainingRouteNm || totalRouteNm}
              />
            ) : null}

            {viewMode === "vision" && flightFrame?.ownship ? (
              <FlightDemoVisionSurface
                routePoints={routePoints}
                ownship={flightFrame.ownship}
                nextWaypoint={routeProgress?.nextWaypoint || null}
                nextWaypointDistanceNm={nextWaypointDistanceNm}
                crossTrackNm={routeProgress?.crossTrackNm || 0}
                verticalSpeedFpm={flightFrame.verticalSpeedFpm}
                remainingRouteNm={routeProgress?.remainingRouteNm || totalRouteNm}
              />
            ) : null}

            <div className="rounded-[28px] border border-[#1E2D42] bg-[#091018]/92 px-5 py-4">
              <div className="grid gap-4 sm:grid-cols-5">
                {demoMetrics.map((metric) => (
                  <div key={metric.label} className="space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">{metric.label}</div>
                    <div className="font-mono text-2xl text-[#E8EDF4]">{metric.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Card className="border-[#1E2D42] bg-[#111820] text-[#E8EDF4] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle>Flight progress</CardTitle>
                <CardDescription className="text-[#7A9BB8]">
                  Browser-side playback of the mobile route-following model.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={routeProgress?.progressPct || 0} className="h-2 bg-[#1A2332]" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#1E2D42] bg-[#0A0E14] px-4 py-3">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">
                      <Clock3 className="h-3.5 w-3.5" />
                      Elapsed
                    </div>
                    <div className="mt-2 text-xl font-semibold">{formatMinutes(elapsedMinutes)}</div>
                  </div>
                  <div className="rounded-2xl border border-[#1E2D42] bg-[#0A0E14] px-4 py-3">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">
                      <ArrowRight className="h-3.5 w-3.5" />
                      Remaining
                    </div>
                    <div className="mt-2 text-xl font-semibold">{formatMinutes(remainingMinutes)}</div>
                  </div>
                </div>
                <div className="rounded-2xl border border-[#1E2D42] bg-[#0A0E14] px-4 py-3 text-sm text-[#7A9BB8]">
                  <div className="flex items-center justify-between gap-3">
                    <span>Route distance</span>
                    <span className="font-mono text-[#E8EDF4]">{totalRouteNm.toFixed(1)} NM</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span>Next waypoint</span>
                    <span className="font-mono text-[#E8EDF4]">{routeProgress?.nextWaypoint || "--"}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span>Playback speed</span>
                    <span className="font-mono text-[#E8EDF4]">{speed}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="bg-[#C8922A] text-[#0A0E14] hover:bg-[#d5a042]"
                    onClick={() => setRunning((current) => !current)}
                  >
                    {running ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                    {running ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#1E2D42] bg-[#111820] text-[#E8EDF4] hover:bg-[#1A2332]"
                    onClick={() => {
                      setProgressNm(0);
                      setRunning(true);
                    }}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restart
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#1E2D42] bg-[#111820] text-[#E8EDF4] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle>Route sequence</CardTitle>
                <CardDescription className="text-[#7A9BB8]">
                  Suggested route-assist waypoints and fuel-stop candidates when available.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {routePoints.map((point, index) => (
                  <div key={`route-seq-${point.icao}-${index}`} className="rounded-2xl border border-[#1E2D42] bg-[#0A0E14] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {point.kind === "origin" ? (
                          <PlaneTakeoff className="h-4 w-4 text-[#00D4A0]" />
                        ) : point.kind === "destination" ? (
                          <PlaneLanding className="h-4 w-4 text-[#4A9FD4]" />
                        ) : (
                          <Navigation className="h-4 w-4 text-[#C8922A]" />
                        )}
                        <div>
                          <div className="font-mono text-base text-[#E8EDF4]">{point.icao}</div>
                          <div className="text-xs text-[#7A9BB8]">{point.name || "Airport reference"}</div>
                        </div>
                      </div>
                      <Badge className="border-[#1E2D42] bg-[#111820] text-[#7A9BB8] hover:bg-[#111820]">
                        {point.kind === "origin"
                          ? "Departure"
                          : point.kind === "destination"
                            ? "Arrival"
                            : point.kind === "stop"
                              ? "Fuel stop"
                              : "Waypoint"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Alert className="border-[#1E2D42] bg-[#0A0E14] text-[#E8EDF4]">
              <AlertTitle>What this demo is showing</AlertTitle>
              <AlertDescription className="text-[#7A9BB8]">
                This is a browser preview of the mobile FlightDeck direction, not a certified flight instrument. The
                route-following math is live, but the web surface is meant for preview, review, and product demonstration.
              </AlertDescription>
            </Alert>

            <div className="rounded-[24px] border border-[#1E2D42] bg-[#111820] p-5 text-sm text-[#7A9BB8]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Route assist</div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span>Planner leg target</span>
                  <span className="font-mono text-[#E8EDF4]">{routeMeta?.planningLegNm ? `${routeMeta.planningLegNm.toFixed(0)} NM` : "--"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Suggested fuel stops</span>
                  <span className="font-mono text-[#E8EDF4]">{routeMeta?.suggestedStopCount ?? 0}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Overwater bias</span>
                  <span className="font-mono text-[#E8EDF4]">{routeMeta?.overwaterLikely ? "Likely" : "No"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
