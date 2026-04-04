import type { MutableRefObject } from 'react';
import type { Region } from 'react-native-maps';
import type { EdgeInsets } from 'react-native-safe-area-context';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export type LatLon = { lat: number; lon: number };

export type OwnshipPosition = {
  lat: number;
  lon: number;
  altitudeFt: number;
  groundSpeedKts?: number | null;
  trackDeg?: number | null;
  verticalSpeedFpm?: number | null;
};

export type AttitudeData = {
  rollDeg: number;
  pitchDeg: number;
  headingDeg?: number | null;
};

export type SourceSummary = {
  code: 'SIM' | 'RXR' | 'GPS' | 'STALE' | 'PREFLT' | string;
  label?: string | null;
  freshness?: string | null;
};

// ---------------------------------------------------------------------------
// Map / route display
// ---------------------------------------------------------------------------

export type MapRouteDisplay = {
  completed: LatLon[];
  activeLeg: LatLon[];
  upcoming: LatLon[];
};

export type TrafficPresentation = {
  id: string;
  lat: number;
  lon: number;
  altitudeFt?: number | null;
  callsign?: string | null;
  trackDeg?: number | null;
  groundSpeedKts?: number | null;
  verticalTrend?: 'climb' | 'descend' | 'level' | null;
};

export type MapOverlayProfile = {
  label: string;
  activeLegWidth: number;
  completedLegWidth: number;
  upcomingLegWidth: number;
  upcomingLegOpacity: number;
  runwayEmphasisWidth: number;
  showTrafficVectors: boolean;
  showMonitorAltitudeTags: boolean;
  maxWindMarkers: number;
  radarOpacity: number;
  cloudOpacity: number;
};

export type MapTacticalSummary = {
  modeLabel: string;
  heading: string;
  vertical: string;
  verticalSupport: string;
  verticalConstraintCall: string;
  recommendation: string;
};

export type MapRunwayFocusSummary = {
  emphasize: boolean;
  label: string;
};

// ---------------------------------------------------------------------------
// Vertical path / guidance
// ---------------------------------------------------------------------------

export type VerticalPathSummary = {
  modeLabel: string;
  guidanceMode: string;
  targetAltitudeFt: number | null;
  verticalErrorFt: number | null;
  requiredVsiFpm: number | null;
  topOfDescentNm: number | null;
  distanceToTodNm: number | null;
  advisoryCall: string;
  support: string;
  recommendation: string;
  cueLabel: string;
  manualBugActive: boolean;
};

export type VerticalConstraintSummary = {
  modeLabel: string;
  sourceLabel: string;
  targetAltitudeFt: number | null;
  requiredVsiFpm: number | null;
  support: string;
  recommendation: string;
  call: string;
  activeConstraintLabel: string;
  nextConstraintLabel: string | null;
  nextConstraintArmed: boolean;
  activeConstraintDistanceNm: number | null;
  constraintGateState: 'monitor' | 'active' | 'captured' | string;
  constraintGateCall: string;
};

export type VerticalAlertSummary = {
  severity: string | null;
  title: string | null;
  detail: string | null;
  deviationLabel: string;
  todLabel: string;
};

export type VisionDirectorCue = {
  lateralOffsetPct: number;
  verticalOffsetPct: number;
  lateralCaptured: boolean;
  verticalCaptured: boolean;
  mode: string;
  turnCommand: string;
  verticalCommand: string;
};

// ---------------------------------------------------------------------------
// Action buttons / alerts
// ---------------------------------------------------------------------------

export type FlightDeckActionButton = {
  id: string;
  label: string;
  icon?: string | null;
  tone?: 'primary' | 'warning' | 'danger' | 'default' | string;
  onPress?: () => void;
};

export type FlightDeckVisibleAlert = {
  id: string;
  severity: 'info' | 'caution' | 'warning' | string;
  title: string;
  detail?: string | null;
} | null;

// ---------------------------------------------------------------------------
// Bank ticks
// ---------------------------------------------------------------------------

export type BankTick = {
  deg: number;
  label?: string | null;
};

// ---------------------------------------------------------------------------
// Surface preview
// ---------------------------------------------------------------------------

export type SurfacePoint = { x: number; y: number };

export type SurfacePreview = {
  headline: string;
  runwayId: string;
  holdShortActive: boolean;
  runwayOccupied: boolean;
  route: SurfacePoint[];
  secondaryRoute: SurfacePoint[];
  ownship: SurfacePoint & { headingDeg: number };
  groundFreq: string;
  towerFreq: string;
  atisFreq: string;
  routeCall: string;
  runwayMeta: string;
  support: string;
  clearanceLabel: string;
  surfaceRegion?: Region | null;
  surfaceFeatures?: Array<{
    geometry: {
      type: 'Polygon' | 'LineString' | string;
      coordinates: number[][][] | number[][];
    };
    properties?: Record<string, unknown>;
  }>;
} | null;

// ---------------------------------------------------------------------------
// Traffic
// ---------------------------------------------------------------------------

export type TrafficTarget = {
  id: string;
  callsign?: string | null;
  lat: number;
  lon: number;
  altitudeFt?: number | null;
  groundSpeedKts?: number | null;
  trackDeg?: number | null;
  verticalTrend?: 'climb' | 'descend' | 'level' | null;
  threatLevel?: 'traffic' | 'proximity' | 'advisory' | string | null;
};

// ---------------------------------------------------------------------------
// Diversion
// ---------------------------------------------------------------------------

export type DiversionCandidate = {
  icao: string;
  name?: string | null;
  distanceNm?: number | null;
  runwaySummary?: string | null;
};

// ---------------------------------------------------------------------------
// Summary counts
// ---------------------------------------------------------------------------

export type SummaryCounts = {
  winds: number;
  notams: number;
  pireps: number;
  convective: number;
  icing: number;
  turbulence: number;
};

// ---------------------------------------------------------------------------
// Execution plan
// ---------------------------------------------------------------------------

export type ExecutionPlanEntry = {
  ident: string;
  lat: number;
  lon: number;
  distanceNm?: number | null;
  bearingDeg?: number | null;
  legLabel?: string | null;
  status?: 'completed' | 'active' | 'armed' | 'queued' | string;
};

export type RouteExecutionSummary = {
  activeLegIndex: number | null;
  sequencingSuspended?: boolean;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Main state / actions interfaces
// ---------------------------------------------------------------------------

export interface FlightDeckStateProps {
  // Navigation + insets
  insets: EdgeInsets;
  navigation: { goBack: () => void; navigate: (screen: string, params?: Record<string, unknown>) => void };

  // Route planning inputs
  departure: string | null;
  destination: string | null;
  waypoints: string[];
  plannedStops: unknown[];
  plannedAltitude: number | null;
  cruiseKtas: number | null;

  // Route summary
  routeHeadline: string | null;
  routeProgress: unknown | null;
  routeExecutionSummary: RouteExecutionSummary | null;
  activeExecutionPlanView: ExecutionPlanEntry[];
  routeRiskLabel: string | null;

  // Flight deck session
  flightDeckSessionState: string | null;
  flightDeckPhaseSummary: string | null;

  // UI state
  flightDeckView: 'map' | 'vision' | 'surface' | string;
  flightDeckChromeVisible: boolean;
  flightDeckDrawerOpen: boolean;
  flightDeckPanel: string | null;
  flightDeckHudExpanded: boolean;
  flightDeckLowerStackBottom: number;
  flightDeckTrafficCardVisible: boolean;
  flightDeckDiversionCardVisible: boolean;
  flightDeckActionButtons: FlightDeckActionButton[];
  flightDeckVisibleAlert: FlightDeckVisibleAlert;
  flightDeckTargetAltitudeFt: number | null;
  flightDeckCommandBankDeg: number;
  flightDeckBankTicks: BankTick[];
  flightDeckSurfacePreview: SurfacePreview;
  flightDeckRunwayOpsSummary: unknown | null;

  // Terrain
  terrainRisk: string | null;
  terrainClearanceFt: number | null;
  terrainProfileLoading: boolean;
  terrainProfile: unknown | null;
  terrainEscapeGuidance: unknown | null;

  // Obstacles
  obstacleRisk: string | null;
  obstacleClearanceFt: number | null;
  obstacleScanLoading: boolean;
  obstacleScan: unknown | null;
  visionObstacleCues: unknown[];

  // Vision / synthetic
  visionRouteGuidance: unknown | null;
  visionTerrainColumns: unknown[];
  visionDirectorCue: VisionDirectorCue;
  visionVerticalCueLabel: string | null;
  visionGuidance: unknown | null;
  visionTrafficCue: unknown | null;
  visionReadinessSummary: unknown | null;
  visionManeuverRecommendation: unknown | null;

  // Vertical path
  flightDeckVerticalPathSummary: VerticalPathSummary;
  flightDeckVerticalConstraintSummary: VerticalConstraintSummary;
  flightDeckVerticalAlertSummary: VerticalAlertSummary;

  // Ownship / GPS
  activeOwnship: OwnshipPosition | null;
  activeAttitude: AttitudeData | null;
  activeVerticalSpeedFpm: number | null;
  ownshipSourceSummary: SourceSummary | null;
  headingSourceSummary: SourceSummary | null;
  attitudeSourceSummary: SourceSummary | null;

  // Receiver
  receiverStatusSummary: unknown | null;
  receiverHealth: unknown | null;
  receiverOwnshipAgeMs: number | null;
  receiverOwnshipFresh: boolean;
  gpsOwnshipAgeMs: number | null;
  gpsOwnshipFresh: boolean;

  // Map
  mapRef: MutableRefObject<unknown> | null;
  mapStyle: string;
  routePoints: LatLon[];
  tacticalMapRegion: Region | null;
  mapRouteDisplay: MapRouteDisplay;
  mapTrafficPresentation: TrafficPresentation[];
  mapDisplayTrafficTargets: TrafficTarget[];
  mapVerticalGuidancePresentation: unknown | null;
  mapTacticalSummary: MapTacticalSummary;
  mapOverlayProfile: MapOverlayProfile;
  mapRunwayFocusSummary: MapRunwayFocusSummary;

  // Weather overlay
  showCloudsGlobal: boolean;
  gibsDate: string | null;
  cloudTileUrl: string | null;
  cloudFrameIndex: number;
  visibleWindsPoints: unknown[];

  // Diversion
  selectedDiversionPoint: LatLon | null;
  selectedDiversionIcao: string | null;
  diversionCandidates: DiversionCandidate[];
  selectedDiversion: unknown | null;
  selectedDiversionRunwaySummary: unknown | null;
  selectedDiversionBestComm: unknown | null;
  selectedDiversionBriefingLoading: boolean;
  selectedDiversionBriefing: unknown | null;
  diversionPanelAirports: DiversionCandidate[];

  // Departure / destination
  departureBriefing: unknown | null;
  departureBriefingLoading: boolean;
  destinationBriefingLoading: boolean;
  destinationRunwayCue: unknown | null;
  destinationRunwayOverlay: unknown | null;
  activeRunwayOverlay: unknown | null;
  activeRunwayOverlayLabel: string | null;
  departureFrequenciesLoading: boolean;
  destinationFrequenciesLoading: boolean;

  // Traffic
  visibleTrafficTargets: TrafficTarget[];
  selectedTrafficTarget: TrafficTarget | null;
  selectedTrafficTrend: unknown | null;
  topTrafficTarget: TrafficTarget | null;
  trafficPanelTargets: TrafficTarget[];
  immediateTrafficCount: number;
  trafficEnabled: boolean;
  trafficFilter: string | null;

  // Simulation
  simulationEnabled: boolean;
  simulationProgress: number | null;
  simulationSpeed: number;
  simulationConflictEnabled: boolean;

  // GPS
  gpsEnabled: boolean;

  // Admin
  isSuperAdmin: boolean;

  // Summary
  summaryCounts: SummaryCounts;

  // Misc
  formatAltitudeDelta: ((delta: number) => string) | null;
}

export interface FlightDeckActionsProps {
  pulseFlightDeckChrome: () => void;
  toggleFlightDeckView: () => void;
  toggleFlightDeckHud: () => void;
  setMapRegion: (region: Region) => void;
  setSelectedDiversionIcao: (icao: string | null) => void;
  setSelectedTrafficId: (id: string | null) => void;
  setFlightDeckDrawerOpen: (open: boolean) => void;
  setFlightDeckPanel: (panel: string | null) => void;
  setTrafficEnabled: (enabled: boolean) => void;
  setGpsEnabled: (enabled: boolean) => void;
  setSimulationEnabled: (enabled: boolean) => void;
  setSimulationSpeed: (speed: number) => void;
  setSimulationConflictEnabled: (enabled: boolean) => void;
  setMapStyle: (style: string) => void;
  setTrafficFilter: (filter: string | null) => void;
  focusDiversionAirport: (icao: string) => void;
  engageDirectToDiversion: () => void;
  resumePlannedRoute: () => void;
  toggleSequencingSuspend: () => void;
  sequencePreviousLeg: () => void;
  sequenceNextLeg: () => void;
  focusTrafficTarget: (id: string) => void;
  setAlternate: (icao: string) => void;
}
