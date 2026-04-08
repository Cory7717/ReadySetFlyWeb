import type { MutableRefObject } from 'react';
import type { Region } from 'react-native-maps';
import type { EdgeInsets } from 'react-native-safe-area-context';
import type { MobileRouteExecutionPlanViewEntry } from '../../lib/flightMath';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export type LatLon = { latitude: number; longitude: number };

export type OwnshipPosition = {
  lat: number;
  lon: number;
  altitudeFt?: number | null;
  groundSpeedKts?: number | null;
  trackDeg?: number | null;
  verticalSpeedFpm?: number | null;
  heading?: number | null;
  speedKts?: number | null;
};

export type AttitudeData = {
  rollDeg?: number | null;
  pitchDeg?: number | null;
  headingDeg?: number | null;
};

export type SourceSummary = {
  code: 'SIM' | 'RXR' | 'GPS' | 'STALE' | 'PREFLT' | string;
  label?: string | null;
  freshness?: string | null;
  detail?: string | null;
  pilotGrade?: string | boolean | null;
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
  lat?: number | null;
  lon?: number | null;
  altitudeFt?: number | null;
  altitudeLabel?: string | null;
  closureText?: string | null;
  callsign?: string | null;
  trackDeg?: number | null;
  groundSpeedKts?: number | null;
  verticalTrend?: 'climb' | 'descend' | 'level' | null;
  vector?: { latitude: number; longitude: number }[];
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
  focusLabel?: string | null;
  support?: string | null;
  rangeLabel?: string | null;
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
  key: string;
  label: string;
  value?: string;
  tone?: string;
  active?: boolean;
  icon?: string | null;
  onPress?: () => void;
};

export type FlightDeckVisibleAlert = {
  id?: string;
  severity: 'info' | 'caution' | 'warning' | string;
  title: string;
  detail?: string | null;
} | null;

// ---------------------------------------------------------------------------
// Bank ticks
// ---------------------------------------------------------------------------

export type BankTick = {
  value: number;
  leftPct: number;
  major: boolean;
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
  mode?: string | null;
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
  distanceNm?: number | null;
  altitudeDeltaFt?: number | null;
  threatScore?: number | null;
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
  [key: string]: any;
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
  waypoints: string;
  plannedStops: string;
  plannedAltitude: string;
  cruiseKtas: string;

  // Route summary
  routeHeadline: string | null;
  routeProgress: any | null;
  routeExecutionSummary: RouteExecutionSummary | null;
  activeExecutionPlanView: MobileRouteExecutionPlanViewEntry[];
  routeRiskLabel: string | null;

  // Flight deck session
  flightDeckSessionState: string | null;
  flightDeckPhaseSummary: { stage?: string; label?: string; detail?: string } | null;
  visionMode: 'route' | 'free';

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
  flightDeckRunwayOpsSummary: any | null;

  // Terrain
  terrainRisk: string | null;
  terrainClearanceFt: number | null;
  terrainProfileLoading: boolean;
  terrainProfile: any | null;
  terrainEscapeGuidance: any | null;

  // Obstacles
  obstacleRisk: string | null;
  obstacleClearanceFt: number | null;
  obstacleScanLoading: boolean;
  obstacleScan: any | null;
  visionObstacleCues: any[];

  // Vision / synthetic
  visionRouteGuidance: any | null;
  visionTerrainColumns: any[];
  visionDirectorCue: VisionDirectorCue;
  visionVerticalCueLabel: string | null;
  visionGuidance: any | null;
  visionTrafficCue: any | null;
  visionReadinessSummary: any | null;
  visionManeuverRecommendation: any | null;

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
  receiverStatusSummary: any | null;
  receiverHealth: any | null;
  receiverOwnshipAgeMs: number | null;
  receiverOwnshipFresh: boolean;
  gpsOwnshipAgeMs: number | null;
  gpsOwnshipFresh: boolean;

  // Map
  mapRef: MutableRefObject<any> | null;
  mapStyle: string;
  routePoints: LatLon[];
  tacticalMapRegion: Region | null;
  mapRouteDisplay: MapRouteDisplay;
  mapTrafficPresentation: TrafficPresentation[];
  mapDisplayTrafficTargets: TrafficTarget[];
  mapVerticalGuidancePresentation: any | null;
  mapTacticalSummary: MapTacticalSummary;
  mapOverlayProfile: MapOverlayProfile;
  mapRunwayFocusSummary: MapRunwayFocusSummary;

  // Weather overlay
  showCloudsGlobal: boolean;
  gibsDate: string | null;
  cloudTileUrl: string | null;
  cloudFrameIndex: number;
  visibleWindsPoints: any[];

  // Diversion
  selectedDiversionPoint: LatLon | null;
  selectedDiversionIcao: string | null;
  diversionCandidates: DiversionCandidate[];
  selectedDiversion: any | null;
  selectedDiversionRunwaySummary: any | null;
  selectedDiversionBestComm: any | null;
  selectedDiversionBriefingLoading: boolean;
  selectedDiversionBriefing: any | null;
  diversionPanelAirports: DiversionCandidate[];

  // Departure / destination
  departureBriefing: any | null;
  departureBriefingLoading: boolean;
  destinationBriefingLoading: boolean;
  destinationRunwayCue: any | null;
  destinationRunwayOverlay: any | null;
  activeRunwayOverlay: any | null;
  activeRunwayOverlayLabel: string | null;
  departureFrequenciesLoading: boolean;
  destinationFrequenciesLoading: boolean;

  // Traffic
  visibleTrafficTargets: TrafficTarget[];
  selectedTrafficTarget: TrafficTarget | null;
  selectedTrafficTrend: any | null;
  topTrafficTarget: TrafficTarget | null;
  trafficPanelTargets: TrafficTarget[];
  immediateTrafficCount: number;
  trafficEnabled: boolean;
  trafficFilter: string | null;

  // Simulation
  simulationEnabled: boolean;
  simulationProgress: number | null;
  simulationSpeed: '1x' | '4x' | '8x';
  simulationConflictEnabled: boolean;

  // GPS
  gpsEnabled: boolean;

  // Admin
  isSuperAdmin: boolean;

  // Summary
  summaryCounts: SummaryCounts;

  // Misc
  formatAltitudeDelta: ((delta: number | null | undefined) => string) | null;
}

export interface FlightDeckActionsProps {
  pulseFlightDeckChrome: (keepVisible?: boolean) => void;
  toggleFlightDeckView: () => void;
  toggleFlightDeckHud: () => void;
  setMapRegion: (region: Region) => void;
  setSelectedDiversionIcao: (icao: string | null) => void;
  setSelectedTrafficId: (id: string | null) => void;
  setFlightDeckDrawerOpen: (open: boolean) => void;
  setFlightDeckPanel: (panel: string) => void;
  setTrafficEnabled: (enabled: boolean) => void;
  setGpsEnabled: (enabled: boolean) => void;
  setSimulationEnabled: (enabled: boolean) => void;
  setSimulationSpeed: (speed: '1x' | '4x' | '8x') => void;
  setSimulationConflictEnabled: (enabled: boolean) => void;
  setMapStyle: (style: 'standard' | 'winds' | 'terrain' | 'sectional' | 'radar' | 'clouds') => void;
  setTrafficFilter: (filter: 'all' | 'conflict' | 'above' | 'below') => void;
  focusDiversionAirport: (airport: any) => void;
  engageDirectToDiversion: (airport: any) => void;
  resumePlannedRoute: () => void;
  toggleSequencingSuspend: () => void;
  sequencePreviousLeg: () => void;
  sequenceNextLeg: () => void;
  focusTrafficTarget: (target: any) => void;
  setAlternate: (icao: string) => void;
}
