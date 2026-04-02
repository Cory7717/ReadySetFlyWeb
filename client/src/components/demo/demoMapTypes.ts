import type { RunwayOverlay, VisionRunwayCue } from "@shared/flight-scene";
import type { DemoRoutePoint } from "@/lib/flightDemo";

export type DemoDiversion = {
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

export type DemoTrafficTarget = {
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

export type DemoTerrainState = {
  terrainAheadFt: number;
  obstacleAheadFt: number;
  terrainClearanceFt: number;
  obstacleClearanceFt: number;
  risk: "nominal" | "caution" | "warning";
  obstacleRisk: "nominal" | "caution" | "warning";
  safeAltitudeFt: number;
  guidance: string;
};

export type DemoFlightPhase = "surface-departure" | "departure" | "enroute" | "arrival" | "surface-arrival";

export type Demo2DMapSurfaceProps = {
  routePoints: DemoRoutePoint[];
  ownship: { lat: number; lon: number; heading: number };
  nextWaypoint: string | null;
  remainingRouteNm: number;
  flightPhase: DemoFlightPhase;
  trafficTargets: DemoTrafficTarget[];
  selectedTrafficTarget: DemoTrafficTarget | null;
  diversionCandidates: DemoDiversion[];
  selectedDiversion: DemoDiversion | null;
  terrainState: DemoTerrainState | null;
  runwayCue: VisionRunwayCue | null;
  runwayOverlay: RunwayOverlay | null;
  runwayOverlayLabel: string | null;
};
