import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Clock3,
  Gauge,
  Map as MapIcon,
  Navigation,
  Pause,
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

type NearbyAirportResponse = {
  lat: number;
  lon: number;
  radiusNm: number;
  airports: DemoDiversion[];
};

type DemoDiversion = {
  icao: string;
  name?: string | null;
  city?: string | null;
  state?: string | null;
  lat: number;
  lon: number;
  distanceNm: number;
  bearingDeg: number;
  maxRunwayFt: number | null;
  towered: boolean;
  score: number;
  immediateReady: boolean;
  immediateReasons: string[];
  flightCategory: string | null;
  runwayAdvisory: {
    runway: string;
    headwindKt: number;
    crosswindKt: number;
  } | null;
  frequencySummary: Array<{
    type: string | null;
    description: string | null;
    frequencyMhz: number | null;
  }>;
};

type DemoTrafficTarget = {
  id: string;
  callsign: string;
  lat: number;
  lon: number;
  distanceNm: number;
  bearingDeg: number;
  altitudeDeltaFt: number;
  threatLevel: "monitor" | "advisory" | "immediate";
  closureText: string;
  sector: string;
  clock: string;
  threatScore: number;
};

type DemoTerrainState = {
  terrainAheadFt: number;
  obstacleAheadFt: number;
  terrainClearanceFt: number;
  obstacleClearanceFt: number;
  risk: "nominal" | "caution" | "warning";
  obstacleRisk: "nominal" | "caution" | "warning";
  safeAltitudeFt: number;
  guidance: string;
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

function formatAltitudeDelta(deltaFt: number) {
  const rounded = Math.round(deltaFt / 100) * 100;
  return rounded > 0 ? `+${rounded} ft` : `${rounded} ft`;
}

function formatFrequency(frequencyMhz: number | null | undefined) {
  return typeof frequencyMhz === "number" ? frequencyMhz.toFixed(3) : "--";
}

function bearingToClock(relativeBearingDeg: number) {
  const normalized = ((relativeBearingDeg % 360) + 360) % 360;
  const hour = Math.round(normalized / 30) || 12;
  return `${hour} o'clock`;
}

function bearingToSector(relativeBearingDeg: number) {
  const normalized = ((relativeBearingDeg % 360) + 360) % 360;
  if (normalized <= 25 || normalized >= 335) return "ahead";
  if (normalized < 160) return "right";
  if (normalized <= 200) return "behind";
  return "left";
}

function offsetPointByBearing(
  origin: { lat: number; lon: number },
  bearingDeg: number,
  distanceNm: number,
) {
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const northNm = Math.cos(bearingRad) * distanceNm;
  const eastNm = Math.sin(bearingRad) * distanceNm;
  const avgLat = origin.lat;
  return {
    lat: origin.lat + northNm / 60,
    lon: origin.lon + eastNm / (60 * Math.cos((avgLat * Math.PI) / 180)),
  };
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
  trafficTargets,
  selectedTrafficTarget,
  diversionCandidates,
  selectedDiversion,
  terrainState,
}: {
  routePoints: DemoRoutePoint[];
  ownship: { lat: number; lon: number; heading: number };
  nextWaypoint: string | null;
  remainingRouteNm: number;
  trafficTargets: DemoTrafficTarget[];
  selectedTrafficTarget: DemoTrafficTarget | null;
  diversionCandidates: DemoDiversion[];
  selectedDiversion: DemoDiversion | null;
  terrainState: DemoTerrainState | null;
}) {
  const rangeAheadNm = clamp(Math.max(remainingRouteNm * 0.42, 18), 18, 64);
  const rangeSideNm = Math.max(14, rangeAheadNm * 0.72);
  const projected = routePoints.map((point) => ({
    point,
    ...projectMapPoint(ownship, point, rangeAheadNm, rangeSideNm),
  }));
  const projectedTraffic = trafficTargets.map((target) => ({
    target,
    ...projectMapPoint(
      ownship,
      {
        icao: target.callsign,
        latitude: target.lat,
        longitude: target.lon,
      },
      rangeAheadNm,
      rangeSideNm,
    ),
  }));
  const projectedDiversions = diversionCandidates.map((airport) => ({
    airport,
    ...projectMapPoint(
      ownship,
      {
        icao: airport.icao,
        latitude: airport.lat,
        longitude: airport.lon,
      },
      rangeAheadNm,
      rangeSideNm,
    ),
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
        {terrainState ? (
          <>
            <ellipse
              cx="50"
              cy="48"
              rx="20"
              ry="9"
              fill={
                terrainState.risk === "warning"
                  ? "rgba(232,69,60,0.22)"
                  : terrainState.risk === "caution"
                    ? "rgba(245,166,35,0.18)"
                    : "rgba(0,212,160,0.12)"
              }
            />
            <ellipse
              cx="50"
              cy="38"
              rx="14"
              ry="6"
              fill={
                terrainState.obstacleRisk === "warning"
                  ? "rgba(232,69,60,0.18)"
                  : terrainState.obstacleRisk === "caution"
                    ? "rgba(245,166,35,0.14)"
                    : "rgba(74,159,212,0.1)"
              }
            />
          </>
        ) : null}
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
        {selectedTrafficTarget ? (
          <line
            x1="50"
            y1="78"
            x2={projectedTraffic.find((item) => item.target.id === selectedTrafficTarget.id)?.x ?? 50}
            y2={projectedTraffic.find((item) => item.target.id === selectedTrafficTarget.id)?.y ?? 78}
            stroke={selectedTrafficTarget.threatLevel === "immediate" ? "#E8453C" : "#F5A623"}
            strokeWidth="0.55"
            strokeDasharray="2.8 1.4"
          />
        ) : null}
        {projectedDiversions.map(({ airport, x, y }) => {
          const active = selectedDiversion?.icao === airport.icao;
          return (
            <g key={`demo-diversion-${airport.icao}`}>
              <rect
                x={x - 1.3}
                y={y - 1.3}
                width="2.6"
                height="2.6"
                rx="0.6"
                fill={active ? "#4A9FD4" : "#0A0E14"}
                stroke="#4A9FD4"
                strokeWidth="0.45"
              />
              {active ? (
                <text x={x + 2.1} y={y + 0.4} fill="#4A9FD4" fontSize="2.2" letterSpacing="0.12">
                  {airport.icao}
                </text>
              ) : null}
            </g>
          );
        })}
        {projectedTraffic.map(({ target, x, y }) => (
          <g key={target.id}>
            {target.threatLevel === "immediate" ? (
              <circle cx={x} cy={y} r="3.2" fill="none" stroke="rgba(245,166,35,0.42)" strokeWidth="0.5" />
            ) : null}
            <rect
              x={x - 1.45}
              y={y - 1.45}
              width="2.9"
              height="2.9"
              transform={`rotate(45 ${x} ${y})`}
              fill={
                target.threatLevel === "immediate"
                  ? "#E8453C"
                  : target.threatLevel === "advisory"
                    ? "#F5A623"
                    : "#E8EDF4"
              }
              stroke="rgba(10,14,20,0.88)"
              strokeWidth="0.4"
            />
            {selectedTrafficTarget?.id === target.id ? (
              <text x={x + 2} y={y - 2} fill="#F5A623" fontSize="2.2" letterSpacing="0.12">
                {target.callsign}
              </text>
            ) : null}
          </g>
        ))}
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
      <div className="pointer-events-none absolute inset-x-4 bottom-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[#1E2D42] bg-[#091018]/90 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Terrain</div>
          <div className="mt-1 text-sm font-semibold text-[#E8EDF4]">
            {terrainState ? `${terrainState.terrainClearanceFt.toLocaleString()} ft clr` : "Preview layer"}
          </div>
          <div className="mt-1 text-xs text-[#7A9BB8]">{terrainState?.guidance ?? "Tactical terrain overlay preview."}</div>
        </div>
        <div className="rounded-2xl border border-[#1E2D42] bg-[#091018]/90 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Traffic</div>
          <div className="mt-1 text-sm font-semibold text-[#E8EDF4]">
            {selectedTrafficTarget
              ? `${selectedTrafficTarget.callsign} ${selectedTrafficTarget.distanceNm.toFixed(1)} NM`
              : "No traffic target"}
          </div>
          <div className="mt-1 text-xs text-[#7A9BB8]">
            {selectedTrafficTarget
              ? `${selectedTrafficTarget.clock} · ${formatAltitudeDelta(selectedTrafficTarget.altitudeDeltaFt)} · ${selectedTrafficTarget.closureText}`
              : "Traffic preview idle"}
          </div>
        </div>
        <div className="rounded-2xl border border-[#1E2D42] bg-[#091018]/90 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Diversion</div>
          <div className="mt-1 text-sm font-semibold text-[#E8EDF4]">
            {selectedDiversion ? `${selectedDiversion.icao} ${selectedDiversion.distanceNm.toFixed(1)} NM` : "Scanning nearby"}
          </div>
          <div className="mt-1 text-xs text-[#7A9BB8]">
            {selectedDiversion
              ? `${selectedDiversion.maxRunwayFt?.toLocaleString() || "--"} ft · ${selectedDiversion.flightCategory || "WX --"}`
              : "Nearby-airport lookup"}
          </div>
        </div>
      </div>
    </div>
  );
}

function FlightDemoTape({
  label,
  value,
  unit,
  step,
  side,
  formatValue,
}: {
  label: string;
  value: number;
  unit: string;
  step: number;
  side: "left" | "right";
  formatValue: (value: number) => string;
}) {
  const ticks = Array.from({ length: 9 }, (_, index) => {
    const tickValue = Math.round(value / step) * step + (index - 4) * step;
    return {
      value: tickValue,
      offsetPx: (tickValue - value) * -0.48,
    };
  });

  return (
    <div
      className={`absolute top-1/2 z-20 hidden h-60 w-[84px] -translate-y-1/2 rounded-[22px] border border-[#1E2D42] bg-[#081019]/84 backdrop-blur md:block ${side === "left" ? "left-4" : "right-4"}`}
    >
      <div className="absolute inset-x-0 top-3 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">
        {label}
      </div>
      <div className="absolute inset-x-3 top-1/2 h-10 -translate-y-1/2 rounded-xl border border-[#C8922A]/40 bg-[#0D151F]/96" />
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">
        <div className="font-mono text-2xl text-[#F5A623]">{formatValue(value)}</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#7A9BB8]">{unit}</div>
      </div>
      <div className="absolute inset-x-0 bottom-4 top-10 overflow-hidden">
        {ticks.map((tick) => (
          <div
            key={`${label}-${tick.value}`}
            className="absolute inset-x-0 flex items-center text-[11px] text-[#D6A85A]"
            style={{ top: `calc(50% + ${tick.offsetPx}px)` }}
          >
            {side === "left" ? (
              <>
                <span className="ml-3 font-mono">{formatValue(tick.value)}</span>
                <div className="ml-auto mr-4 h-px w-4 bg-[#F5A623]/70" />
              </>
            ) : (
              <>
                <div className="ml-4 h-px w-4 bg-[#F5A623]/70" />
                <span className="ml-auto mr-3 font-mono">{formatValue(tick.value)}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FlightDemoHudStrip({
  metrics,
}: {
  metrics: { label: string; value: string; unit?: string }[];
}) {
  return (
    <div className="rounded-[28px] border border-[#1E2D42] bg-[rgba(10,14,20,0.88)] px-5 py-4 backdrop-blur">
      <div className="grid gap-3 md:grid-cols-5">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className={`flex min-h-[62px] flex-col justify-center ${index < metrics.length - 1 ? "md:border-r md:border-[#1E2D42]" : ""} md:pr-3`}
          >
            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#7A9BB8]">{metric.label}</div>
            <div className="mt-1 flex items-end gap-2 font-mono text-[28px] leading-none text-[#E8EDF4]">
              <span>{metric.value}</span>
              {metric.unit ? <span className="pb-1 text-[11px] uppercase tracking-[0.16em] text-[#7A9BB8]">{metric.unit}</span> : null}
            </div>
          </div>
        ))}
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
  terrainState,
  selectedTrafficTarget,
  selectedDiversion,
}: {
  routePoints: DemoRoutePoint[];
  ownship: { lat: number; lon: number; altitudeFt: number; heading: number; speedKts: number };
  nextWaypoint: string | null;
  nextWaypointDistanceNm: number | null;
  crossTrackNm: number;
  verticalSpeedFpm: number;
  remainingRouteNm: number;
  terrainState: DemoTerrainState | null;
  selectedTrafficTarget: DemoTrafficTarget | null;
  selectedDiversion: DemoDiversion | null;
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
  const bankDeg = clamp(routeCue * 1.15, -22, 22);
  const pitchDeg = clamp(verticalSpeedFpm / 140, -7, 8);
  const sceneOffsetPx = pitchDeg * 18;
  const flightPathOffsetY = clamp((-verticalSpeedFpm / 65) - pitchDeg * 3.5, -82, 70);
  const flightPathOffsetX = clamp(routeCue * 3.2, -58, 58);
  const gateCenters = [routeCue * 0.22, routeCue * 0.45, routeCue * 0.72, routeCue];
  const speedTrend = verticalSpeedFpm > 150 ? "Climb" : verticalSpeedFpm < -150 ? "Descent" : "Level";
  const pitchLadder = [-20, -15, -10, -5, 5, 10, 15, 20];
  const trafficProjection = selectedTrafficTarget
    ? projectPointRelativeToOwnship(ownship, {
        latitude: selectedTrafficTarget.lat,
        longitude: selectedTrafficTarget.lon,
      })
    : null;
  const trafficCueX = trafficProjection ? clamp(50 + trafficProjection.rightNm * 3.8, 14, 86) : null;
  const trafficCueY = trafficProjection
    ? clamp(52 - trafficProjection.forwardNm * 2.8 - selectedTrafficTarget!.altitudeDeltaFt / 180, 22, 80)
    : null;

  return (
    <div className="relative h-[420px] overflow-hidden rounded-[24px] border border-slate-800 bg-[#060A10]">
      <div
        className="absolute inset-[-16%]"
        style={{ transform: `translateY(${sceneOffsetPx}px) rotate(${bankDeg}deg)` }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#071225_0%,#12315A_32%,#28558A_49%,#C58B54_49.6%,#695034_50.2%,#45311F_74%,#21170F_100%)]" />
        <div className="absolute inset-x-0 top-1/2 h-[2px] bg-white/85 shadow-[0_0_18px_rgba(255,255,255,0.18)]" />
        {pitchLadder.map((value) => (
          <div
            key={`pitch-${value}`}
            className="absolute left-1/2 flex -translate-x-1/2 items-center gap-3 text-[11px] font-medium text-white/80"
            style={{ top: `calc(50% ${value > 0 ? "-" : "+"} ${Math.abs(value) * 13}px)` }}
          >
            <span>{value > 0 ? `+${value}` : value}</span>
            <div className="h-px w-28 bg-white/60" />
            <span>{value > 0 ? `+${value}` : value}</span>
          </div>
        ))}
      </div>
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
      <div
        className="absolute top-[9.6%] h-4 w-4"
        style={{ left: `calc(50% + ${bankDeg * 1.6}px - 8px)` }}
      >
        <div className="h-full w-full [clip-path:polygon(50%_100%,0_0,100%_0)] bg-[#F5A623]" />
      </div>
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
        className="absolute left-1/2 top-[56%] h-20 w-[3px] rounded-full bg-[#C8922A]"
        style={{ marginLeft: `${flightPathOffsetX}px` }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#C8922A]"
        style={{ marginLeft: `${flightPathOffsetX}px`, marginTop: `${flightPathOffsetY}px` }}
      >
        <div className="absolute left-1/2 top-1/2 h-[2px] w-6 -translate-x-1/2 -translate-y-1/2 bg-[#C8922A]" />
        <div className="absolute left-1/2 top-1/2 h-6 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-[#C8922A]" />
      </div>
      <div className="absolute left-1/2 top-1/2 z-20 h-[2px] w-16 -translate-x-1/2 bg-white/80" />
      <div className="absolute left-[calc(50%-68px)] top-1/2 z-20 h-[2px] w-10 bg-white/80" />
      <div className="absolute left-[calc(50%+28px)] top-1/2 z-20 h-[2px] w-10 bg-white/80" />
      <FlightDemoTape
        label="IAS"
        value={ownship.speedKts}
        unit="KT"
        step={10}
        side="left"
        formatValue={(value) => Math.max(0, Math.round(value)).toString()}
      />
      <FlightDemoTape
        label="ALT"
        value={ownship.altitudeFt}
        unit="FT"
        step={500}
        side="right"
        formatValue={(value) => Math.max(0, Math.round(value / 10) * 10).toString()}
      />
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
          <div className="mt-1 text-xs text-[#7A9BB8]">{speedTrend}</div>
        </div>
      </div>
      {terrainState ? (
        <div className="absolute bottom-[92px] left-4 z-20 max-w-[280px] rounded-2xl border border-[#1E2D42] bg-[#091018]/92 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Terrain guidance</div>
          <div
            className={`mt-1 text-sm font-semibold ${
              terrainState.risk === "warning" || terrainState.obstacleRisk === "warning"
                ? "text-[#E8453C]"
                : terrainState.risk === "caution" || terrainState.obstacleRisk === "caution"
                  ? "text-[#F5A623]"
                  : "text-[#E8EDF4]"
            }`}
          >
            {terrainState.guidance}
          </div>
          <div className="mt-1 text-xs text-[#7A9BB8]">
            Terrain {terrainState.terrainClearanceFt.toLocaleString()} ft clr · Obstacle {terrainState.obstacleClearanceFt.toLocaleString()} ft clr
          </div>
        </div>
      ) : null}
      {trafficCueX != null && trafficCueY != null && selectedTrafficTarget ? (
        <div
          className="absolute z-20"
          style={{ left: `${trafficCueX}%`, top: `${trafficCueY}%` }}
        >
          <div className="h-10 w-[2px] bg-[#F5A623]/70" />
          <div
            className={`absolute left-1/2 top-10 h-4 w-4 -translate-x-1/2 rotate-45 border ${
              selectedTrafficTarget.threatLevel === "immediate"
                ? "border-[#E8453C] bg-[#E8453C]"
                : selectedTrafficTarget.threatLevel === "advisory"
                  ? "border-[#F5A623] bg-[#F5A623]"
                  : "border-[#E8EDF4] bg-[#E8EDF4]"
            }`}
          />
        </div>
      ) : null}
      {selectedTrafficTarget ? (
        <div className="absolute bottom-[92px] right-4 z-20 max-w-[260px] rounded-2xl border border-[#1E2D42] bg-[#091018]/92 px-4 py-3 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Traffic</div>
          <div className="mt-1 text-sm font-semibold text-[#E8EDF4]">
            {selectedTrafficTarget.callsign} · {selectedTrafficTarget.distanceNm.toFixed(1)} NM · {formatAltitudeDelta(selectedTrafficTarget.altitudeDeltaFt)}
          </div>
          <div className="mt-1 text-xs text-[#7A9BB8]">
            {selectedTrafficTarget.clock} · {selectedTrafficTarget.sector} · {selectedTrafficTarget.closureText}
          </div>
        </div>
      ) : null}
      <div className="absolute bottom-4 left-1/2 z-20 w-[min(92%,480px)] -translate-x-1/2">
        <div className="grid gap-3 rounded-[24px] border border-[#1E2D42] bg-[#091018]/92 px-4 py-3 sm:grid-cols-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Cross track</div>
            <div className="mt-1 font-mono text-2xl text-[#F5A623]">{Math.abs(crossTrackNm).toFixed(1)} NM</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Vertical speed</div>
            <div className="mt-1 font-mono text-2xl text-[#F5A623]">
              {verticalSpeedFpm > 0 ? "+" : ""}
              {Math.round(verticalSpeedFpm)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Heading</div>
            <div className="mt-1 font-mono text-2xl text-[#F5A623]">{Math.round(ownship.heading).toString().padStart(3, "0")}</div>
          </div>
        </div>
      </div>
      {selectedDiversion ? (
        <div className="absolute left-1/2 top-[18%] z-20 min-w-[220px] -translate-x-1/2 rounded-full border border-[#1E2D42] bg-[#091018]/88 px-4 py-2 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Best diversion</div>
          <div className="mt-0.5 text-sm font-semibold text-[#E8EDF4]">
            {selectedDiversion.icao} · {selectedDiversion.distanceNm.toFixed(1)} NM · {selectedDiversion.flightCategory || "WX --"}
          </div>
        </div>
      ) : null}
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
  const [diversionCandidates, setDiversionCandidates] = useState<DemoDiversion[]>([]);
  const [diversionLoading, setDiversionLoading] = useState(false);
  const lastNearbyFetchRef = useRef<{ lat: number; lon: number; fetchedAt: number } | null>(null);

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
      setDiversionCandidates([]);
      lastNearbyFetchRef.current = null;
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
  const terrainState = useMemo<DemoTerrainState | null>(() => {
    if (!flightFrame?.ownship) return null;
    const progressPhase = progressPct * Math.PI * (routeMeta?.overwaterLikely ? 2.2 : 3.4);
    const terrainAheadFt = Math.round(
      1200 +
        Math.abs(Math.sin(progressPhase)) * 2600 +
        Math.abs(Math.cos(progressPhase * 0.55)) * 900 -
        (routeMeta?.overwaterLikely ? 600 : 0),
    );
    const obstacleAheadFt = terrainAheadFt + Math.round(350 + Math.abs(Math.cos(progressPhase * 1.7)) * 650);
    const terrainClearanceFt = Math.round(flightFrame.ownship.altitudeFt - terrainAheadFt);
    const obstacleClearanceFt = Math.round(flightFrame.ownship.altitudeFt - obstacleAheadFt);
    const risk = terrainClearanceFt < 1200 ? "warning" : terrainClearanceFt < 2200 ? "caution" : "nominal";
    const obstacleRisk = obstacleClearanceFt < 800 ? "warning" : obstacleClearanceFt < 1500 ? "caution" : "nominal";
    const safeAltitudeFt = Math.ceil((Math.max(terrainAheadFt + 2000, obstacleAheadFt + 1500) || DEMO_ALTITUDE_FT) / 100) * 100;
    const guidance =
      risk === "warning" || obstacleRisk === "warning"
        ? `Climb toward ${safeAltitudeFt.toLocaleString()} ft immediately`
        : risk === "caution" || obstacleRisk === "caution"
          ? `Monitor terrain. ${safeAltitudeFt.toLocaleString()} ft keeps a safer margin.`
          : `Terrain nominal. ${terrainClearanceFt.toLocaleString()} ft clearance ahead.`;
    return {
      terrainAheadFt,
      obstacleAheadFt,
      terrainClearanceFt,
      obstacleClearanceFt,
      risk,
      obstacleRisk,
      safeAltitudeFt,
      guidance,
    };
  }, [flightFrame?.ownship, progressPct, routeMeta?.overwaterLikely]);

  const trafficTargets = useMemo<DemoTrafficTarget[]>(() => {
    if (!flightFrame?.ownship) return [];
    const ownship = flightFrame.ownship;
    const phase = progressPct * Math.PI * 4.2;
    const definitions = [
      {
        id: "traffic-alpha",
        callsign: "N731RS",
        distanceNm: 2.6 + Math.abs(Math.sin(phase)) * 1.6,
        bearingOffsetDeg: 18 + Math.sin(phase * 0.8) * 10,
        altitudeDeltaFt: Math.round(250 + Math.cos(phase) * 180),
      },
      {
        id: "traffic-bravo",
        callsign: "AAL218",
        distanceNm: 5.8 + Math.abs(Math.cos(phase * 0.7)) * 2.4,
        bearingOffsetDeg: -34 + Math.sin(phase * 0.6) * 12,
        altitudeDeltaFt: Math.round(-700 + Math.sin(phase * 0.9) * 250),
      },
      {
        id: "traffic-charlie",
        callsign: "SWA55",
        distanceNm: 8.4 + Math.abs(Math.sin(phase * 0.45)) * 2.2,
        bearingOffsetDeg: 56 + Math.cos(phase * 0.5) * 8,
        altitudeDeltaFt: Math.round(1200 + Math.cos(phase * 0.75) * 320),
      },
    ] as const;

    return definitions
      .map((definition) => {
        const bearingDeg = (ownship.heading + definition.bearingOffsetDeg + 360) % 360;
        const point = offsetPointByBearing({ lat: ownship.lat, lon: ownship.lon }, bearingDeg, definition.distanceNm);
        const immediate =
          definition.distanceNm <= 3.5 && Math.abs(definition.altitudeDeltaFt) <= 500;
        const advisory =
          !immediate && definition.distanceNm <= 6 && Math.abs(definition.altitudeDeltaFt) <= 1000;
        const threatLevel: DemoTrafficTarget["threatLevel"] = immediate
          ? "immediate"
          : advisory
            ? "advisory"
            : "monitor";
        const relativeBearing = (bearingDeg - ownship.heading + 360) % 360;
        return {
          id: definition.id,
          callsign: definition.callsign,
          lat: point.lat,
          lon: point.lon,
          distanceNm: Number(definition.distanceNm.toFixed(1)),
          bearingDeg: Math.round(bearingDeg),
          altitudeDeltaFt: definition.altitudeDeltaFt,
          threatLevel,
          closureText: immediate ? "Immediate conflict" : advisory ? "Converging" : "Monitor",
          sector: bearingToSector(relativeBearing),
          clock: bearingToClock(relativeBearing),
          threatScore: Math.round((12 - definition.distanceNm) * 8 - Math.abs(definition.altitudeDeltaFt) / 120),
        };
      })
      .sort((a, b) => {
        const severityWeight = { immediate: 3, advisory: 2, monitor: 1 };
        if (severityWeight[b.threatLevel] !== severityWeight[a.threatLevel]) {
          return severityWeight[b.threatLevel] - severityWeight[a.threatLevel];
        }
        return a.distanceNm - b.distanceNm;
      });
  }, [flightFrame?.ownship, progressPct]);

  const selectedTrafficTarget = trafficTargets[0] ?? null;
  const selectedDiversion = diversionCandidates[0] ?? null;

  useEffect(() => {
    if (!flightFrame?.ownship) return;
    const ownship = flightFrame.ownship;
    const lastFetch = lastNearbyFetchRef.current;
    const movedNm = lastFetch
      ? greatCircleNm(
          { latitude: lastFetch.lat, longitude: lastFetch.lon },
          { latitude: ownship.lat, longitude: ownship.lon },
        )
      : Infinity;
    const staleMs = lastFetch ? Date.now() - lastFetch.fetchedAt : Infinity;
    if (movedNm < 18 && staleMs < 30000) return;

    let cancelled = false;
    setDiversionLoading(true);
    void fetch(
      apiUrl(
        `/api/airports/nearby?lat=${ownship.lat.toFixed(4)}&lon=${ownship.lon.toFixed(4)}&radiusNm=70&limit=4`,
      ),
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("nearby airport lookup failed");
        return (await response.json()) as NearbyAirportResponse;
      })
      .then((data) => {
        if (cancelled) return;
        const airports = Array.isArray(data.airports) ? data.airports : [];
        setDiversionCandidates(airports.filter((airport) => airport.icao !== routePoints[0]?.icao).slice(0, 4));
        lastNearbyFetchRef.current = {
          lat: ownship.lat,
          lon: ownship.lon,
          fetchedAt: Date.now(),
        };
      })
      .catch(() => {
        if (!cancelled) {
          setDiversionCandidates([]);
        }
      })
      .finally(() => {
        if (!cancelled) setDiversionLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [flightFrame?.ownship, routePoints]);

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
        unit: "kt",
      },
      {
        label: "ALT",
        value: flightFrame?.ownship.altitudeFt ? Math.round(flightFrame.ownship.altitudeFt).toString() : "--",
        unit: "ft",
      },
      {
        label: "VSI",
        value: flightFrame ? `${Math.round(flightFrame.verticalSpeedFpm)}` : "--",
        unit: "fpm",
      },
      {
        label: "HDG",
        value: flightFrame?.ownship.heading ? Math.round(flightFrame.ownship.heading).toString().padStart(3, "0") : "--",
        unit: "deg",
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
                trafficTargets={trafficTargets}
                selectedTrafficTarget={selectedTrafficTarget}
                diversionCandidates={diversionCandidates}
                selectedDiversion={selectedDiversion}
                terrainState={terrainState}
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
                terrainState={terrainState}
                selectedTrafficTarget={selectedTrafficTarget}
                selectedDiversion={selectedDiversion}
              />
            ) : null}

            <FlightDemoHudStrip metrics={demoMetrics} />
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
                <CardTitle>Tactical overlays</CardTitle>
                <CardDescription className="text-[#7A9BB8]">
                  Browser-side preview of the mobile FlightDeck traffic, terrain, and diversion stack.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-[#1E2D42] bg-[#0A0E14] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Traffic focus</div>
                      <div className="mt-1 text-sm font-semibold text-[#E8EDF4]">
                        {selectedTrafficTarget
                          ? `${selectedTrafficTarget.callsign} · ${selectedTrafficTarget.distanceNm.toFixed(1)} NM · ${formatAltitudeDelta(selectedTrafficTarget.altitudeDeltaFt)}`
                          : "No traffic target"}
                      </div>
                      <div className="mt-1 text-xs text-[#7A9BB8]">
                        {selectedTrafficTarget
                          ? `${selectedTrafficTarget.clock} · ${selectedTrafficTarget.closureText} · score ${selectedTrafficTarget.threatScore}`
                          : "Traffic overlay is in preview mode."}
                      </div>
                    </div>
                    <Badge className="border-[#1E2D42] bg-[#111820] text-[#7A9BB8] hover:bg-[#111820]">
                      {selectedTrafficTarget?.threatLevel || "idle"}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-2xl border border-[#1E2D42] bg-[#0A0E14] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Best diversion</div>
                      <div className="mt-1 text-sm font-semibold text-[#E8EDF4]">
                        {selectedDiversion
                          ? `${selectedDiversion.icao} · ${selectedDiversion.distanceNm.toFixed(1)} NM · ${selectedDiversion.flightCategory || "WX --"}`
                          : diversionLoading
                            ? "Scanning nearby airports"
                            : "No nearby diversion"}
                      </div>
                      <div className="mt-1 text-xs text-[#7A9BB8]">
                        {selectedDiversion
                          ? `Runway ${selectedDiversion.maxRunwayFt?.toLocaleString() || "--"} ft · ${selectedDiversion.frequencySummary[0]?.type || "Comm"} ${formatFrequency(selectedDiversion.frequencySummary[0]?.frequencyMhz)}`
                          : "Nearby-airport scoring mirrors the mobile diversion flow."}
                      </div>
                    </div>
                    <Badge className="border-[#1E2D42] bg-[#111820] text-[#7A9BB8] hover:bg-[#111820]">
                      {selectedDiversion?.immediateReady ? "ready" : "monitor"}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-2xl border border-[#1E2D42] bg-[#0A0E14] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7A9BB8]">Terrain</div>
                      <div className="mt-1 text-sm font-semibold text-[#E8EDF4]">
                        {terrainState
                          ? `${terrainState.terrainClearanceFt.toLocaleString()} ft terrain clr · ${terrainState.obstacleClearanceFt.toLocaleString()} ft obstacle clr`
                          : "Terrain layer offline"}
                      </div>
                      <div className="mt-1 text-xs text-[#7A9BB8]">
                        {terrainState?.guidance || "Terrain preview follows the simulated route segment."}
                      </div>
                    </div>
                    <Badge className="border-[#1E2D42] bg-[#111820] text-[#7A9BB8] hover:bg-[#111820]">
                      {terrainState ? terrainState.risk : "idle"}
                    </Badge>
                  </div>
                </div>
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
