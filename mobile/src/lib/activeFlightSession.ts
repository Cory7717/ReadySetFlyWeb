import type { FlightDeckEntryMode, FlightDeckRouteParams } from './flightDeckEntry';
import type { FlightDeckSourceHealth } from './flightDeckSafety';

export const ACTIVE_FLIGHT_SESSION_SCHEMA_VERSION = 1;
export const ACTIVE_FLIGHT_STORAGE_KEY = 'rsf_active_flight_v1';

export type ActiveFlightSessionStatus =
  | 'initializing'
  | 'active'
  | 'paused'
  | 'backgrounded'
  | 'completed'
  | 'abandoned';

export type FlightOperationalPhase =
  | 'preflight'
  | 'taxi-out'
  | 'departure'
  | 'climb'
  | 'cruise'
  | 'descent'
  | 'arrival'
  | 'final'
  | 'taxi-in';

export type ActiveFlightRoutePoint = {
  icao: string;
  name?: string | null;
  latitude: number;
  longitude: number;
};

export type ActiveFlightRoute = {
  departure?: string | null;
  destination?: string | null;
  waypoints?: string | null;
  plannedStops?: string | null;
  plannedAltitude?: string | null;
  cruiseKtas?: string | null;
  points: ActiveFlightRoutePoint[];
  totalNm?: number | null;
};

export type ActiveDirectToState = {
  mode: 'direct-to-diversion' | 'direct-to-route';
  origin: ActiveFlightRoutePoint;
  target: ActiveFlightRoutePoint;
  activatedAt: string;
  targetLegIndex?: number | null;
};

export type ActiveFlightSession = {
  schemaVersion: 1;
  id: string;
  status: ActiveFlightSessionStatus;
  entryMode: FlightDeckEntryMode;
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
  resumedAt: string | null;
  completedAt: string | null;
  route: ActiveFlightRoute | null;
  navigation: {
    activeLegIndex: number | null;
    sequencingSuspended: boolean;
    directTo: ActiveDirectToState | null;
    skippedLegIndexes: number[];
  };
  phase: FlightOperationalPhase;
  aircraft: {
    profileId?: string;
    tailNumber?: string;
    aircraftTypeId?: string;
  } | null;
  sourceSnapshot: {
    positionSource: 'simulation' | 'gdl90' | 'device_gps' | 'none';
    receiverState: string;
    attitudeSource: 'simulation' | 'gdl90_ahrs' | 'none';
  };
  traffic: {
    targetCount: number;
    immediateCount: number;
    lastUpdatedAt: string | null;
  };
  display: {
    mode?: string;
    orientation?: string;
  };
  resumeMetadata: {
    lastPersistedAt: string | null;
    lastForegroundAt: string | null;
    lastBackgroundAt: string | null;
  };
};

export type ActiveFlightSessionUpdate = Partial<
  Pick<ActiveFlightSession, 'status' | 'route' | 'phase' | 'aircraft' | 'sourceSnapshot' | 'traffic' | 'display'>
> & {
  entryMode?: FlightDeckEntryMode;
  navigation?: Partial<ActiveFlightSession['navigation']>;
  resumedAt?: string | null;
  completedAt?: string | null;
  lastForegroundAt?: string | null;
  lastBackgroundAt?: string | null;
};

const toIso = (value: Date | string | number = new Date()) => new Date(value).toISOString();

const createSessionId = (now = Date.now()) => `afs_${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const normalizeText = (value: unknown, upper = false) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return upper ? trimmed.toUpperCase() : trimmed;
};

const normalizePoint = (point: unknown): ActiveFlightRoutePoint | null => {
  if (!point || typeof point !== 'object') return null;
  const raw = point as Record<string, unknown>;
  const latitude = typeof raw.latitude === 'number' ? raw.latitude : typeof raw.lat === 'number' ? raw.lat : null;
  const longitude = typeof raw.longitude === 'number' ? raw.longitude : typeof raw.lon === 'number' ? raw.lon : null;
  const icao = normalizeText(raw.icao, true);
  if (!icao || typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  return {
    icao,
    name: normalizeText(raw.name) || icao,
    latitude,
    longitude,
  };
};

export function createActiveFlightRoute(input: {
  departure?: string | null;
  destination?: string | null;
  waypoints?: string | null;
  plannedStops?: string | null;
  plannedAltitude?: string | null;
  cruiseKtas?: string | null;
  points?: unknown[];
  totalNm?: number | null;
}): ActiveFlightRoute | null {
  const points = Array.isArray(input.points) ? input.points.map(normalizePoint).filter(Boolean) as ActiveFlightRoutePoint[] : [];
  const route: ActiveFlightRoute = {
    departure: normalizeText(input.departure, true),
    destination: normalizeText(input.destination, true),
    waypoints: normalizeText(input.waypoints, true),
    plannedStops: normalizeText(input.plannedStops, true),
    plannedAltitude: normalizeText(input.plannedAltitude),
    cruiseKtas: normalizeText(input.cruiseKtas),
    points,
    totalNm: typeof input.totalNm === 'number' && Number.isFinite(input.totalNm) ? input.totalNm : null,
  };
  if (!route.departure && !route.destination && !route.waypoints && !route.plannedStops && points.length === 0) {
    return null;
  }
  return route;
}

export function createActiveFlightSession(options: {
  entryMode: FlightDeckEntryMode;
  route?: ActiveFlightRoute | null;
  id?: string | null;
  now?: Date | string | number;
}): ActiveFlightSession {
  const now = toIso(options.now);
  return {
    schemaVersion: ACTIVE_FLIGHT_SESSION_SCHEMA_VERSION,
    id: options.id || createSessionId(new Date(now).getTime()),
    status: 'initializing',
    entryMode: options.entryMode,
    createdAt: now,
    startedAt: null,
    updatedAt: now,
    resumedAt: null,
    completedAt: null,
    route: options.route || null,
    navigation: {
      activeLegIndex: null,
      sequencingSuspended: false,
      directTo: null,
      skippedLegIndexes: [],
    },
    phase: 'preflight',
    aircraft: null,
    sourceSnapshot: {
      positionSource: 'none',
      receiverState: 'idle',
      attitudeSource: 'none',
    },
    traffic: {
      targetCount: 0,
      immediateCount: 0,
      lastUpdatedAt: null,
    },
    display: {},
    resumeMetadata: {
      lastPersistedAt: null,
      lastForegroundAt: now,
      lastBackgroundAt: null,
    },
  };
}

export function updateActiveFlightSession(
  session: ActiveFlightSession,
  update: ActiveFlightSessionUpdate,
  nowValue: Date | string | number = new Date()
): ActiveFlightSession {
  const now = toIso(nowValue);
  const nextStatus = update.status || session.status;
  return {
    ...session,
    status: nextStatus,
    entryMode: update.entryMode || session.entryMode,
    updatedAt: now,
    startedAt: session.startedAt || (nextStatus === 'active' ? now : null),
    completedAt: update.completedAt !== undefined ? update.completedAt : session.completedAt,
    resumedAt: update.resumedAt !== undefined ? update.resumedAt : session.resumedAt,
    route: update.route !== undefined ? update.route : session.route,
    navigation: update.navigation
      ? {
          activeLegIndex:
            update.navigation.activeLegIndex !== undefined
              ? update.navigation.activeLegIndex
              : session.navigation.activeLegIndex,
          sequencingSuspended:
            update.navigation.sequencingSuspended !== undefined
              ? update.navigation.sequencingSuspended
              : session.navigation.sequencingSuspended,
          directTo: update.navigation.directTo !== undefined ? update.navigation.directTo : session.navigation.directTo,
          skippedLegIndexes: update.navigation.skippedLegIndexes || session.navigation.skippedLegIndexes,
        }
      : session.navigation,
    phase: update.phase || session.phase,
    aircraft: update.aircraft !== undefined ? update.aircraft : session.aircraft,
    sourceSnapshot: update.sourceSnapshot || session.sourceSnapshot,
    traffic: update.traffic || session.traffic,
    display: update.display ? { ...session.display, ...update.display } : session.display,
    resumeMetadata: {
      ...session.resumeMetadata,
      lastForegroundAt:
        update.lastForegroundAt !== undefined ? update.lastForegroundAt : session.resumeMetadata.lastForegroundAt,
      lastBackgroundAt:
        update.lastBackgroundAt !== undefined ? update.lastBackgroundAt : session.resumeMetadata.lastBackgroundAt,
    },
  };
}

export function markActiveFlightSessionPersisted(
  session: ActiveFlightSession,
  nowValue: Date | string | number = new Date()
): ActiveFlightSession {
  const now = toIso(nowValue);
  return {
    ...session,
    updatedAt: now,
    resumeMetadata: {
      ...session.resumeMetadata,
      lastPersistedAt: now,
    },
  };
}

export function mapPositionSource(source: FlightDeckSourceHealth['activeSource']) {
  if (source === 'receiver') return 'gdl90' as const;
  if (source === 'gps') return 'device_gps' as const;
  if (source === 'simulation') return 'simulation' as const;
  return 'none' as const;
}

export function parseActiveFlightSession(raw: unknown): ActiveFlightSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<ActiveFlightSession>;
  if (value.schemaVersion !== ACTIVE_FLIGHT_SESSION_SCHEMA_VERSION || typeof value.id !== 'string') return null;
  if (!value.entryMode || !value.createdAt || !value.updatedAt) return null;
  return {
    ...createActiveFlightSession({
      entryMode: value.entryMode,
      route: value.route || null,
      id: value.id,
      now: value.createdAt,
    }),
    ...value,
    schemaVersion: ACTIVE_FLIGHT_SESSION_SCHEMA_VERSION,
    navigation: {
      activeLegIndex:
        typeof value.navigation?.activeLegIndex === 'number' ? value.navigation.activeLegIndex : null,
      sequencingSuspended: value.navigation?.sequencingSuspended === true,
      directTo: value.navigation?.directTo || null,
      skippedLegIndexes: Array.isArray(value.navigation?.skippedLegIndexes) ? value.navigation.skippedLegIndexes : [],
    },
    resumeMetadata: {
      lastPersistedAt: value.resumeMetadata?.lastPersistedAt || null,
      lastForegroundAt: value.resumeMetadata?.lastForegroundAt || null,
      lastBackgroundAt: value.resumeMetadata?.lastBackgroundAt || null,
    },
  };
}

export function createSessionFromLegacyResumePayload(
  payload: {
    entryMode?: FlightDeckEntryMode | null;
    departure?: string | null;
    destination?: string | null;
    waypoints?: string | null;
    plannedStops?: string | null;
    plannedAltitude?: string | null;
    cruiseKtas?: string | null;
    activeFlightSessionId?: string | null;
    savedAt?: number | null;
  },
  fallbackEntryMode: FlightDeckEntryMode = 'resume'
) {
  const route = createActiveFlightRoute({
    departure: payload.departure,
    destination: payload.destination,
    waypoints: payload.waypoints,
    plannedStops: payload.plannedStops,
    plannedAltitude: payload.plannedAltitude,
    cruiseKtas: payload.cruiseKtas,
  });
  return createActiveFlightSession({
    id: payload.activeFlightSessionId || null,
    entryMode: payload.entryMode || fallbackEntryMode,
    route,
    now: payload.savedAt || Date.now(),
  });
}

export function createFlightDeckParamsFromSession(session: ActiveFlightSession): FlightDeckRouteParams {
  return {
    mode: 'flight',
    entryMode: 'resume',
    departure: session.route?.departure || undefined,
    destination: session.route?.destination || undefined,
    waypoints: session.route?.waypoints || undefined,
    plannedStops: session.route?.plannedStops || undefined,
    plannedAltitude: session.route?.plannedAltitude || undefined,
    cruiseKtas: session.route?.cruiseKtas || undefined,
    activeFlightSessionId: session.id,
  };
}
