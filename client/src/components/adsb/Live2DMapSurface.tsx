import type { ReactNode } from "react";
import type { FeatureCollection } from "geojson";
import MapLibreLiveMap, { type MapLibreLiveMapProps } from "@/components/adsb/MapLibreLiveMap";
import { getRsfPlannerRenderer, type RsfLiveMapStyle } from "@/map/rsfMapSpec";

export type Live2DMapFocusTarget = { lat: number; lon: number; label: string; nonce: number } | null;

type LiveOwnship = {
  lat: number;
  lon: number;
  altitudeFt: number | null;
  speedKt: number | null;
  headingDeg: number | null;
  timestamp: number;
};

type TrafficTarget = {
  id: string;
  callsign: string | null;
  tail: string | null;
  lat: number;
  lon: number;
  altitudeFt: number | null;
  groundSpeedKt: number | null;
  trackDeg: number | null;
  category: string | null;
  squawk: string | null;
  relativeAltitudeFt: number | null;
  distanceNm: number | null;
  verticalRateFpm: number | null;
  threatScore: number;
  threatLevel: "immediate" | "advisory" | "monitor";
  onGround: boolean;
};

type NearbyDiversionAirport = {
  icao: string;
  name: string | null;
  city?: string | null;
  state?: string | null;
  lat: number;
  lon: number;
  distanceNm: number;
  bearingDeg: number;
  maxRunwayFt: number | null;
  surfaces: string[];
  towered: boolean;
  score: number;
  scoreReasons: string[];
  immediateReady: boolean;
  immediateReasons: string[];
  flightCategory: string | null;
  runwayAdvisory: {
    runway: string;
    headwindKt: number | null;
    crosswindKt: number | null;
  } | null;
  frequencySummary: Array<{
    type: string | null;
    description: string | null;
    frequencyMhz: number | null;
  }>;
};

type RoutePoint = {
  icao: string;
  label: string;
  lat: number;
  lon: number;
};

type TerrainCueSegment = {
  positions: [[number, number], [number, number]];
  maxElevationFt: number | null;
  clearanceFt: number | null;
  risk: "comfortable" | "caution" | "warning";
};

type TerrainHotSpotMarker = {
  rank: number;
  risk: "comfortable" | "caution" | "warning";
  progressLabel: string;
  maxElevationFt: number | null;
  clearanceFt: number | null;
  lat: number;
  lon: number;
};

type NearbyObstacle = {
  id: string;
  lat: number;
  lon: number;
  amslFt: number | null;
  aglFt: number | null;
  city: string | null;
  state: string | null;
  kind: string | null;
  lighting: string | null;
  distanceNm: number;
};

type RouteProgressSummary = {
  totalRouteNm: number;
  remainingRouteNm: number;
  directToDestinationNm: number;
  distanceFlownNm: number;
  progressPct: number;
  offRouteNm: number;
  nearestPoint: { lat: number; lon: number };
  activeLegIndex: number;
  nextWaypoint: RoutePoint | null;
  etaIso: string | null;
};

export type Live2DMapSurfaceProps = {
  mapStyle: RsfLiveMapStyle;
  mapCenter: [number, number];
  focusTarget: Live2DMapFocusTarget;
  followOwnship: boolean;
  onFollowOwnshipChange: (value: boolean) => void;
  ownship: LiveOwnship | null;
  trail: [number, number][];
  routePoints: RoutePoint[];
  routeProgress: RouteProgressSummary | null;
  terrainCueSegments: TerrainCueSegment[];
  terrainHotSpotMarkers: TerrainHotSpotMarker[];
  filteredTrafficTargets: TrafficTarget[];
  selectedTrafficTarget: TrafficTarget | null;
  onSelectTrafficTarget: (value: TrafficTarget | null) => void;
  showTfrOverlay: boolean;
  tfrData: FeatureCollection | null | undefined;
  showSuaOverlay: boolean;
  suaData: FeatureCollection | null | undefined;
  showObstacleOverlay: boolean;
  nearbyObstacles: NearbyObstacle[];
  showDiversionOverlay: boolean;
  diversionMapMarkers: NearbyDiversionAirport[];
  selectedDiversion: NearbyDiversionAirport | null;
  onSelectDiversion: (value: NearbyDiversionAirport | null) => void;
  rangeNm: number;
  radarTileUrl: string;
  radarFallbackActive: boolean;
  cloudTileUrl: string;
  showTerrainShading: boolean;
  children: ReactNode;
};

export default function Live2DMapSurface(props: Live2DMapSurfaceProps) {
  if (getRsfPlannerRenderer(props.mapStyle) === "maplibre") {
    const mapLibreProps: MapLibreLiveMapProps = props;
    return <MapLibreLiveMap {...mapLibreProps} />;
  }

  return <>{props.children}</>;
}
