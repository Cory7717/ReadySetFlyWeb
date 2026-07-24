export type FlightDeckEntryMode =
  | 'blank_vfr'
  | 'planned_route'
  | 'saved_flight'
  | 'resume'
  | 'direct_to'
  | 'simulation';

export type FlightDeckRouteParams = {
  mode: 'flight';
  entryMode: FlightDeckEntryMode;
  departure?: string;
  destination?: string;
  waypoints?: string;
  plannedStops?: string;
  plannedAltitude?: string;
  cruiseKtas?: string;
  savedFlightId?: string;
  activeFlightSessionId?: string;
  directToIdentifier?: string;
  simulation?: boolean;
};

const normalizeText = (value: unknown, upper = false) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return upper ? trimmed.toUpperCase() : trimmed;
};

export function normalizeFlightDeckRouteParams(params: unknown): FlightDeckRouteParams | null {
  if (!params || typeof params !== 'object') return null;
  const raw = params as Partial<FlightDeckRouteParams>;
  if (raw.mode !== 'flight') return null;
  const entryMode = raw.entryMode || inferFlightDeckEntryMode(raw);
  return {
    mode: 'flight',
    entryMode,
    departure: normalizeText(raw.departure, true),
    destination: normalizeText(raw.destination, true),
    waypoints: normalizeText(raw.waypoints, true),
    plannedStops: normalizeText(raw.plannedStops, true),
    plannedAltitude: normalizeText(raw.plannedAltitude),
    cruiseKtas: normalizeText(raw.cruiseKtas),
    savedFlightId: normalizeText(raw.savedFlightId),
    activeFlightSessionId: normalizeText(raw.activeFlightSessionId),
    directToIdentifier: normalizeText(raw.directToIdentifier, true),
    simulation: raw.simulation === true,
  };
}

export function inferFlightDeckEntryMode(params: Partial<FlightDeckRouteParams>): FlightDeckEntryMode {
  if (params.simulation) return 'simulation';
  if (normalizeText(params.activeFlightSessionId)) return 'resume';
  if (normalizeText(params.savedFlightId)) return 'saved_flight';
  if (normalizeText(params.directToIdentifier, true)) return 'direct_to';
  if (normalizeText(params.departure, true) || normalizeText(params.destination, true)) return 'planned_route';
  return 'blank_vfr';
}

export function createBlankVfrFlightDeckParams(): FlightDeckRouteParams {
  return {
    mode: 'flight',
    entryMode: 'blank_vfr',
  };
}

export function createPlannedRouteFlightDeckParams(params: {
  departure?: string;
  destination?: string;
  waypoints?: string;
  plannedStops?: string;
  plannedAltitude?: string;
  cruiseKtas?: string;
}): FlightDeckRouteParams {
  return {
    mode: 'flight',
    entryMode: 'planned_route',
    departure: normalizeText(params.departure, true),
    destination: normalizeText(params.destination, true),
    waypoints: normalizeText(params.waypoints, true),
    plannedStops: normalizeText(params.plannedStops, true),
    plannedAltitude: normalizeText(params.plannedAltitude),
    cruiseKtas: normalizeText(params.cruiseKtas),
  };
}

export function createResumeFlightDeckParams(params: {
  departure?: string | null;
  destination?: string | null;
  waypoints?: string | null;
  plannedStops?: string | null;
  plannedAltitude?: string | null;
  cruiseKtas?: string | null;
  activeFlightSessionId?: string | null;
}): FlightDeckRouteParams {
  return {
    mode: 'flight',
    entryMode: 'resume',
    departure: normalizeText(params.departure, true),
    destination: normalizeText(params.destination, true),
    waypoints: normalizeText(params.waypoints, true),
    plannedStops: normalizeText(params.plannedStops, true),
    plannedAltitude: normalizeText(params.plannedAltitude),
    cruiseKtas: normalizeText(params.cruiseKtas),
    activeFlightSessionId: normalizeText(params.activeFlightSessionId),
  };
}

export function isNoRouteFlightDeckEntry(params: FlightDeckRouteParams | null) {
  if (!params) return false;
  return (
    params.entryMode === 'blank_vfr' &&
    !params.departure &&
    !params.destination &&
    !params.waypoints &&
    !params.plannedStops &&
    !params.directToIdentifier
  );
}

export function shouldInitializeFlightDeckWithoutRoute(params: FlightDeckRouteParams | null) {
  return !params || isNoRouteFlightDeckEntry(params);
}
