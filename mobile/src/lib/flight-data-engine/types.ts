import type { ActiveFlightRoute, ActiveFlightSession, FlightOperationalPhase } from '../activeFlightSession';
import type { FlightDeckSourceHealth } from '../flightDeckSafety';
import type { MobileRouteLeg, MobileRouteProgressSummary } from '../flightMath';
import type { FlightDeckSourceArbitrationState } from '../sourceArbitration';

export type RankedTrafficTarget = EngineTrafficTarget & {
  distanceNm: number;
  altitudeDeltaFt: number | null;
  threatScore: number;
  threatLevel: 'immediate' | 'advisory' | 'monitor';
};

export type EngineRoutePoint = {
  icao: string;
  name?: string | null;
  latitude: number;
  longitude: number;
};

export type EngineOwnshipSample = {
  lat: number;
  lon: number;
  altitudeFt?: number | null;
  speedKts?: number | null;
  heading?: number | null;
  updatedAt?: number;
  source?: string;
};

export type EngineAttitudeSample = {
  pitchDeg?: number | null;
  rollDeg?: number | null;
  headingDeg?: number | null;
  headingReference?: 'true' | 'magnetic';
  indicatedAirspeedKts?: number | null;
  trueAirspeedKts?: number | null;
  updatedAt?: number;
  source?: string;
};

export type EngineTrafficTarget = {
  id: string;
  lat: number;
  lon: number;
  altitudeFt?: number;
  speedKts?: number;
  headingDeg?: number;
  callsign?: string;
  updatedAt: number;
};

export type EngineReceiverHealthInput = {
  status?: string | null;
  ownshipFresh?: boolean;
  attitudeFresh?: boolean;
  trafficFresh?: boolean;
  heartbeatFresh?: boolean;
  lastFrameAt?: number | null;
};

export type FlightDataEngineConfiguration = {
  plannedAltitudeFt?: number | null;
  simulationAltitudeFt?: number | null;
  trafficStaleMs?: number;
};

export type FlightDataEngineInput = {
  nowMs: number;
  session: ActiveFlightSession | null;
  routeSnapshot: ActiveFlightRoute | null;
  routePoints: EngineRoutePoint[];
  routeTotalNm?: number | null;
  simulation: {
    active: boolean;
    ownship: EngineOwnshipSample | null;
    attitude: EngineAttitudeSample | null;
    trafficTargets: EngineTrafficTarget[];
  };
  deviceGps: EngineOwnshipSample | null;
  receiver: {
    health: EngineReceiverHealthInput | null;
    ownship: EngineOwnshipSample | null;
    attitude: EngineAttitudeSample | null;
  };
  trafficTargets: EngineTrafficTarget[];
  navigation?: {
    activeLegIndex?: number | null;
    sequencingSuspended?: boolean;
  };
  configuration?: FlightDataEngineConfiguration;
};

export type DerivedSourceState = {
  health: FlightDeckSourceHealth;
  arbitration: FlightDeckSourceArbitrationState;
  ownship: EngineOwnshipSample | null;
  attitude: EngineAttitudeSample | null;
  receiverOwnshipFresh: boolean;
  receiverAttitudeFresh: boolean;
  gpsOwnshipFresh: boolean;
};

export type DerivedRouteState = {
  points: EngineRoutePoint[];
  legs: MobileRouteLeg[];
  directToActive: boolean;
  totalNm: number | null;
};

export type DerivedNavigationState = {
  activeLegIndex: number;
  progress: MobileRouteProgressSummary | null;
  activeLeg: MobileRouteLeg | null;
  phase: {
    stage: FlightOperationalPhase;
    label: string;
    detail: string;
  };
};

export type DerivedTrafficState = {
  tacticalTargets: EngineTrafficTarget[];
  rankedTargets: RankedTrafficTarget[];
  immediateCount: number;
};

export type FlightDataTransitionProposal =
  | {
      type: 'sequence-active-leg';
      activeLegIndex: number;
      reason: 'auto-sequence';
    }
  | {
      type: 'phase-change';
      phase: FlightOperationalPhase;
    };

export type FlightDataEngineOutput = {
  source: DerivedSourceState;
  route: DerivedRouteState;
  navigation: DerivedNavigationState;
  traffic: DerivedTrafficState;
  transitionProposals: FlightDataTransitionProposal[];
  alerts: Array<{ id: string; level: 'advisory' | 'caution' | 'warning'; message: string }>;
};
