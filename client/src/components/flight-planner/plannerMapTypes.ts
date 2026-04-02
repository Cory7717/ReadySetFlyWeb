import type { RsfLeafletMapStyle } from "@/map/rsfMapSpec";

export type PlannerPoint = {
  icao: string;
  lat: number;
  lon: number;
  label?: string | null;
};

export type PlannerTerrainSegment = {
  positions: [[number, number], [number, number]];
  maxElevationFt: number | null;
  clearanceFt: number | null;
  risk: "comfortable" | "caution" | "warning";
};

export type PlannerTerrainHotSpot = {
  rank: number;
  risk: "comfortable" | "caution" | "warning";
  progressLabel: string;
  maxElevationFt: number | null;
  clearanceFt: number | null;
  lat: number;
  lon: number;
};

export type PlannerLegHealthMarker = {
  key: string;
  status: "comfortable" | "caution" | "warning";
  label: string;
  detail: string;
  lat: number;
  lon: number;
};

export type Planner2DMapProps = {
  points: PlannerPoint[];
  heightClassName?: string;
  mapStyle?: RsfLeafletMapStyle;
  plannedAltitudeFt?: number;
  windsAltitudeFt?: number;
  airportLabelMode?: "icao" | "full" | "markers";
  terrainSegments?: PlannerTerrainSegment[];
  terrainHotSpots?: PlannerTerrainHotSpot[];
  legHealthMarkers?: PlannerLegHealthMarker[];
};
