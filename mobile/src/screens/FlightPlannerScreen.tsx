import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Callout, Marker, Polyline, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createGdl90Listener, TrafficTarget } from '../utils/gdl90';
import { api } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
import {
  bearingBetweenPoints,
  clamp,
  computeMobileRouteProgress,
  getDistanceNmFromLatLon,
  greatCircleNm,
  interpolateRouteOwnship,
  normalizeHeadingDelta,
  offsetLatLonByNm,
  rankTrafficTargets,
  relativeClockPosition,
} from '../lib/flightMath';
import type { MobileRouteProgressSummary } from '../lib/flightMath';
import FlightDeckView from '../components/flight-deck/FlightDeckView';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type AirportMeta = {
  icao: string;
  name?: string;
  latitude: number;
  longitude: number;
  timezone?: string | null;
};

type AircraftType = {
  id: string;
  make: string;
  model: string;
  icaoType?: string | null;
  cruiseKtas: number;
  fuelBurnGph: number;
  usableFuelGal: number;
  maxGrossWeightLb: number;
};

type AircraftProfile = {
  id: string;
  name: string;
  type?: AircraftType | null;
  cruiseKtasEffective?: number;
  fuelBurnGphEffective?: number;
  usableFuelGalEffective?: number;
  maxGrossWeightLbEffective?: number;
};

type AircraftPerformanceState = {
  selectedType: AircraftType | null;
  selectedProfileId: string | null;
  cruiseKtas: string;
  fuelBurnGph: string;
  usableFuel: string;
  maxGrossWeight: string;
};

type AircraftPerformanceAction =
  | { type: 'set_selected_type'; value: AircraftType | null }
  | { type: 'set_selected_profile_id'; value: string | null }
  | { type: 'load_from_type'; value: AircraftType }
  | { type: 'load_from_profile'; value: AircraftProfile }
  | { type: 'set_field'; field: 'cruiseKtas' | 'fuelBurnGph' | 'usableFuel' | 'maxGrossWeight'; value: string };

const initialAircraftPerformanceState: AircraftPerformanceState = {
  selectedType: null,
  selectedProfileId: null,
  cruiseKtas: '110',
  fuelBurnGph: '8.5',
  usableFuel: '40',
  maxGrossWeight: '2400',
};

function aircraftPerformanceReducer(
  state: AircraftPerformanceState,
  action: AircraftPerformanceAction,
): AircraftPerformanceState {
  switch (action.type) {
    case 'set_selected_type':
      return { ...state, selectedType: action.value };
    case 'set_selected_profile_id':
      return { ...state, selectedProfileId: action.value };
    case 'load_from_type':
      return {
        ...state,
        selectedType: action.value,
        cruiseKtas: String(action.value.cruiseKtas),
        fuelBurnGph: String(action.value.fuelBurnGph),
        usableFuel: String(action.value.usableFuelGal),
        maxGrossWeight: String(action.value.maxGrossWeightLb),
      };
    case 'load_from_profile':
      return {
        ...state,
        selectedProfileId: action.value.id,
        cruiseKtas: String(action.value.cruiseKtasEffective || ''),
        fuelBurnGph: String(action.value.fuelBurnGphEffective || ''),
        usableFuel: String(action.value.usableFuelGalEffective || ''),
        maxGrossWeight: String(action.value.maxGrossWeightLbEffective || ''),
      };
    case 'set_field':
      return { ...state, [action.field]: action.value };
    default:
      return state;
  }
}

const ICAO_REGEX = /^[A-Z0-9]{3,4}$/;
const WINDS_ALOFT_LEVELS = [3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000];

type WeatherResponse = {
  icao: string;
  metar: any;
  taf: any;
};

type NearbyDiversionAirport = {
  icao: string;
  name?: string | null;
  lat?: number | null;
  lon?: number | null;
  distanceNm: number;
  bearingDeg: number;
  maxRunwayFt?: number | null;
  towered?: boolean;
  flightCategory?: string | null;
  scoreReasons?: string[];
  frequencySummary?: Array<{
    type?: string | null;
    description?: string | null;
    frequencyMhz?: number | null;
  }>;
};

type NearbyDiversionResponse = {
  airports: NearbyDiversionAirport[];
};

type RunwayBriefingResponse = {
  runwayInUse?: string | null;
  advisory?: {
    runway?: string | null;
    headwind?: number | null;
    crosswind?: number | null;
  } | null;
};

type TerrainProfileResponse = {
  source: string;
  sampledPointCount: number;
  maxElevationFt: number | null;
  samples: Array<{
    lat: number;
    lon: number;
    elevationFt: number | null;
  }>;
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

type NearbyObstacleResponse = {
  source: string;
  radiusNm: number;
  count: number;
  highestObstacle: NearbyObstacle | null;
  obstacles: NearbyObstacle[];
};

type RankedTrafficTarget = TrafficTarget & {
  distanceNm: number;
  altitudeDeltaFt: number | null;
  threatScore: number;
  threatLevel: 'immediate' | 'advisory' | 'monitor';
};

type TrafficTrend = {
  distanceRateNmPerMin: number | null;
  bearingRateDegPerMin: number | null;
  closureText: string;
};

type PositionFetchSnapshot = {
  lat: number;
  lon: number;
  at: number;
};

type OwnshipData = {
  lat: number;
  lon: number;
  altitudeFt?: number;
  speedKts?: number;
  heading?: number;
};

type WindsAloftPoint = {
  stationId: string;
  icao?: string;
  lat: number;
  lon: number;
  windDir: number | null;
  windSpeed: number | null;
  tempC: number | null;
};

type WindsAloftMeta = {
  altitudeFt: number;
  validTime?: string | null;
  warnings?: string[];
};

type FlightDeckPanel = 'status' | 'layers' | 'traffic' | 'diversions';
type FlightDeckView = 'map' | 'vision';
type FlightDeckActionTone = 'default' | 'accent' | 'caution' | 'warning';

function buildSimulatedTrafficTargets(
  ownship: OwnshipData | null,
  options?: { injectConflict?: boolean },
): TrafficTarget[] {
  if (!ownship) return [];
  const lead = offsetLatLonByNm(ownship.lat, ownship.lon, 1.5, 1.2);
  const high = offsetLatLonByNm(ownship.lat, ownship.lon, -2.1, 2.8);
  const targets: TrafficTarget[] = [
    {
      id: 'sim-traffic-1',
      callsign: 'RSF201',
      lat: lead.lat,
      lon: lead.lon,
      altitudeFt: Math.round((ownship.altitudeFt || 6500) + 300),
      updatedAt: Date.now(),
    },
    {
      id: 'sim-traffic-2',
      callsign: 'RSF402',
      lat: high.lat,
      lon: high.lon,
      altitudeFt: Math.round((ownship.altitudeFt || 6500) - 800),
      updatedAt: Date.now(),
    },
  ];
  if (options?.injectConflict) {
    const close = offsetLatLonByNm(ownship.lat, ownship.lon, 0.35, 0.18);
    targets.unshift({
      id: 'sim-traffic-conflict',
      callsign: 'TA101',
      lat: close.lat,
      lon: close.lon,
      altitudeFt: Math.round((ownship.altitudeFt || 6500) + 100),
      updatedAt: Date.now(),
    });
  }
  return targets;
}

function pickBestDiversionFrequency(
  airport: NearbyDiversionAirport | null | undefined,
) {
  const entries = airport?.frequencySummary || [];
  type FrequencyEntry = NonNullable<NearbyDiversionAirport['frequencySummary']>[number];
  const rank = (value: FrequencyEntry) => {
    const type = String(value?.type || '').toLowerCase();
    if (type.includes('tower')) return 1;
    if (type.includes('ctaf')) return 2;
    if (type.includes('unicom')) return 3;
    if (type.includes('approach')) return 4;
    if (type.includes('ground')) return 5;
    if (type.includes('departure')) return 6;
    return 9;
  };
  return [...entries].sort((a, b) => rank(a) - rank(b))[0] || null;
}

function formatAltitudeDelta(altitudeDeltaFt: number | null | undefined) {
  if (typeof altitudeDeltaFt !== 'number' || !Number.isFinite(altitudeDeltaFt)) return 'alt unknown';
  return `${altitudeDeltaFt >= 0 ? '+' : ''}${Math.round(altitudeDeltaFt)} ft`;
}

function parseFlightCategory(metar: any): 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN' {
  const declared = String(metar?.fltCat || metar?.flightCategory || '').toUpperCase();
  if (declared === 'VFR' || declared === 'MVFR' || declared === 'IFR' || declared === 'LIFR') {
    return declared as 'VFR' | 'MVFR' | 'IFR' | 'LIFR';
  }
  if (!metar?.rawOb) return 'UNKNOWN';
  const raw = metar.rawOb || '';
  const visMatch = raw.match(/\s(\d{1,2})SM/);
  const visibility = visMatch ? parseInt(visMatch[1], 10) : 10;
  const ceilingMatch = raw.match(/(BKN|OVC)(\d{3})/);
  const ceiling = ceilingMatch ? parseInt(ceilingMatch[2], 10) * 100 : 10000;

  if (ceiling >= 3000 && visibility > 5) return 'VFR';
  if (ceiling >= 1000 && visibility >= 3) return 'MVFR';
  if (ceiling >= 500 && visibility >= 1) return 'IFR';
  return 'LIFR';
}

function hasThunder(taf: any) {
  const raw = taf?.rawTAF || '';
  return raw.includes('TS');
}

function normalizeTimeZone(value?: string | null) {
  const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!value) return fallback;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return value;
  } catch {
    return fallback;
  }
}

function parseDateTimeInput(value: string) {
  if (!value) return null;
  const normalized = value.trim().replace(' ', 'T');
  const [datePart, timePart] = normalized.split('T');
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return { year, month, day, hour, minute };
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  parts.forEach((part) => {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  });
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return (asUtc - date.getTime()) / 60000;
}

function zonedDateTimeToUtc(value: string, timeZone: string) {
  const parts = parseDateTimeInput(value);
  if (!parts) return null;
  const guess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0));
  const offset = getTimeZoneOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - offset * 60000);
}

function formatDateTimeLocal(date: Date, timeZone: string) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = dtf.formatToParts(date);
    const map: Record<string, string> = {};
    parts.forEach((part) => {
      if (part.type !== 'literal') {
        map[part.type] = part.value;
      }
    });
    return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}`;
  } catch {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}

function resolveWindsAltitude(requested?: number | null) {
  const fallback = WINDS_ALOFT_LEVELS.includes(12000) ? 12000 : WINDS_ALOFT_LEVELS[0];
  if (!requested || !Number.isFinite(requested)) return fallback;
  let best = fallback;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const alt of WINDS_ALOFT_LEVELS) {
    const delta = Math.abs(alt - requested);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = alt;
    }
  }
  return best;
}

function buildBboxFromPoints(points: AirportMeta[]) {
  if (!points.length) return null;
  const lats = points.map((p) => p.latitude);
  const lons = points.map((p) => p.longitude);
  const pad = 1.5;
  const south = Math.min(...lats) - pad;
  const north = Math.max(...lats) + pad;
  const west = Math.min(...lons) - pad;
  const east = Math.max(...lons) + pad;
  return { south, west, north, east };
}

function buildBboxFromRegion(region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }) {
  const south = region.latitude - region.latitudeDelta / 2;
  const north = region.latitude + region.latitudeDelta / 2;
  const west = region.longitude - region.longitudeDelta / 2;
  const east = region.longitude + region.longitudeDelta / 2;
  return { south, west, north, east };
}

function formatCloudTimeLabel(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toUTCString().replace('GMT', 'UTC');
}

function shouldSkipPositionRefresh(
  lastFetch: PositionFetchSnapshot | null,
  next: { lat: number; lon: number },
  options: { minDistanceNm: number; minIntervalMs: number },
) {
  if (!lastFetch) return false;
  const elapsedMs = Date.now() - lastFetch.at;
  if (elapsedMs >= options.minIntervalMs) return false;
  const movedNm = getDistanceNmFromLatLon(
    { lat: lastFetch.lat, lon: lastFetch.lon },
    { lat: next.lat, lon: next.lon },
  );
  return movedNm < options.minDistanceNm;
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function isWithinConus(lat: number, lon: number) {
  return lat >= 14.56 && lat <= 56.78 && lon >= -152.11 && lon <= -52.92;
}

function isWithinAlaska(lat: number, lon: number) {
  return lat >= 51 && lat <= 72 && lon >= -170 && lon <= -129;
}

function isWithinHawaii(lat: number, lon: number) {
  return lat >= 18 && lat <= 23 && lon >= -161 && lon <= -154;
}

export default function FlightPlannerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useIsAuthenticated();
  const isFlightDeck = route.name === 'FlightDeck' || route.params?.mode === 'flight';
  const [departure, setDeparture] = useState('KJFK');
  const [destination, setDestination] = useState('KBOS');
  const [waypoints, setWaypoints] = useState('');
  const [plannedStops, setPlannedStops] = useState('');
  const [alternate, setAlternate] = useState('');
  const [tailNumber, setTailNumber] = useState('');
  const [fuelOnBoard, setFuelOnBoard] = useState('');
  const [notes, setNotes] = useState('');
  const [plannedAltitude, setPlannedAltitude] = useState('');
  const [plannedDepartureAt, setPlannedDepartureAt] = useState('');
  const [plannedArrivalAt, setPlannedArrivalAt] = useState('');
  const [arrivalAuto, setArrivalAuto] = useState(true);
  const [suggestedMode, setSuggestedMode] = useState<'direct' | 'midpoint'>('direct');
  const [loading, setLoading] = useState(false);
  const [routeSummary, setRouteSummary] = useState<{ totalNm: number; legs: { from: string; to: string; nm: number }[] } | null>(null);
  const [routePoints, setRoutePoints] = useState<AirportMeta[]>([]);
  const [mapStyle, setMapStyle] = useState<'standard' | 'sectional' | 'terrain' | 'radar' | 'winds' | 'clouds'>('standard');
  const [windsAltitudeChoice, setWindsAltitudeChoice] = useState<'planned' | string>('planned');
  const [windsAloftPoints, setWindsAloftPoints] = useState<WindsAloftPoint[]>([]);
  const [windsAloftMeta, setWindsAloftMeta] = useState<WindsAloftMeta | null>(null);
  const [windsAloftError, setWindsAloftError] = useState<string | null>(null);
  const [cloudFrames, setCloudFrames] = useState<string[]>([]);
  const [cloudFrameIndex, setCloudFrameIndex] = useState(0);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const cloudTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mapRegion, setMapRegion] = useState<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(null);
  const [trafficEnabled, setTrafficEnabled] = useState(false);
  const [trafficPort, setTrafficPort] = useState('4000');
  const [trafficTargets, setTrafficTargets] = useState<TrafficTarget[]>([]);
  const [trafficFilter, setTrafficFilter] = useState<'all' | 'conflict' | 'above' | 'below'>('all');
  const [trafficStatus, setTrafficStatus] = useState<'idle' | 'listening' | 'error'>('idle');
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const trafficListenerRef = useState<{ stop?: () => void }>(() => ({}))[0];
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'listening' | 'error'>('idle');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsData, setGpsData] = useState<{ lat: number; lon: number; altitudeFt?: number; speedKts?: number; heading?: number } | null>(null);
  const [verticalSpeedFpm, setVerticalSpeedFpm] = useState<number | null>(null);
  const [simulationEnabled, setSimulationEnabled] = useState(false);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationSpeed, setSimulationSpeed] = useState<'1x' | '4x' | '8x'>('4x');
  const [flightDeckPanel, setFlightDeckPanel] = useState<FlightDeckPanel>('status');
  const [flightDeckView, setFlightDeckView] = useState<FlightDeckView>('map');
  const [flightDeckDrawerOpen, setFlightDeckDrawerOpen] = useState(false);
  const [flightDeckHudExpanded, setFlightDeckHudExpanded] = useState(false);
  const [flightDeckChromeVisible, setFlightDeckChromeVisible] = useState(true);
  const [flightDeckInteractionTick, setFlightDeckInteractionTick] = useState(0);
  const [flightDeckAdvisoriesMuted, setFlightDeckAdvisoriesMuted] = useState(false);
  const [flightDeckTargetAltitudeFt, setFlightDeckTargetAltitudeFt] = useState<number | null>(null);
  const [trafficResolutionBias, setTrafficResolutionBias] = useState<'left' | 'right' | null>(null);
  const [selectedTrafficId, setSelectedTrafficId] = useState<string | null>(null);
  const [simulationConflictEnabled, setSimulationConflictEnabled] = useState(false);
  const [simulatedGpsData, setSimulatedGpsData] = useState<OwnshipData | null>(null);
  const [simulatedVerticalSpeedFpm, setSimulatedVerticalSpeedFpm] = useState<number | null>(null);
  const locationSubRef = useState<{ remove?: () => void }>(() => ({}))[0];
  const mapRef = useRef<MapView | null>(null);
  const flightDeckChromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flightDeckAutoPanelRef = useRef<string | null>(null);
  const lastDiversionFetchRef = useRef<PositionFetchSnapshot | null>(null);
  const lastObstacleFetchRef = useRef<PositionFetchSnapshot | null>(null);
  const [aircraftPerformanceState, dispatchAircraftPerformance] = useReducer(
    aircraftPerformanceReducer,
    initialAircraftPerformanceState,
  );

  const [aircraftQuery, setAircraftQuery] = useState('');
  const [aircraftResults, setAircraftResults] = useState<AircraftType[]>([]);
  const [profiles, setProfiles] = useState<AircraftProfile[]>([]);
  const [departureTimeZone, setDepartureTimeZone] = useState('');
  const [destinationTimeZone, setDestinationTimeZone] = useState('');
  const [reserveMinutes, setReserveMinutes] = useState('45');
  const [headwind, setHeadwind] = useState('0');

  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [departureWeather, setDepartureWeather] = useState<WeatherResponse | null>(null);
  const [destinationWeather, setDestinationWeather] = useState<WeatherResponse | null>(null);
  const [enrouteWeather, setEnrouteWeather] = useState<WeatherResponse[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryCounts, setSummaryCounts] = useState({
    winds: 0,
    notams: 0,
    pireps: 0,
    convective: 0,
    icing: 0,
    turbulence: 0,
  });
  const [departureSuggestions, setDepartureSuggestions] = useState<AirportMeta[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<AirportMeta[]>([]);
  const [suggestedWaypoints, setSuggestedWaypoints] = useState<string[]>([]);
  const [suggestedStops, setSuggestedStops] = useState<string[]>([]);
  const [suggestionMeta, setSuggestionMeta] = useState<{ routeDistanceNm: number; maxLegNm: number } | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [diversionCandidates, setDiversionCandidates] = useState<NearbyDiversionAirport[]>([]);
  const [diversionLoading, setDiversionLoading] = useState(false);
  const [diversionError, setDiversionError] = useState<string | null>(null);
  const [selectedDiversionIcao, setSelectedDiversionIcao] = useState<string | null>(null);
  const [selectedDiversionBriefing, setSelectedDiversionBriefing] = useState<RunwayBriefingResponse | null>(null);
  const [selectedDiversionBriefingLoading, setSelectedDiversionBriefingLoading] = useState(false);
  const [terrainProfile, setTerrainProfile] = useState<TerrainProfileResponse | null>(null);
  const [terrainProfileLoading, setTerrainProfileLoading] = useState(false);
  const [obstacleScan, setObstacleScan] = useState<NearbyObstacleResponse | null>(null);
  const [obstacleScanLoading, setObstacleScanLoading] = useState(false);
  const [trafficTrendMap, setTrafficTrendMap] = useState<Record<string, TrafficTrend>>({});
  const trafficSnapshotRef = useRef<Record<string, { distanceNm: number; bearingDelta: number; at: number }>>({});

  const [checklist, setChecklist] = useState({
    weather: false,
    fuel: false,
    currency: false,
    notams: false,
  });
  const deviceTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );
  const {
    selectedType,
    selectedProfileId,
    cruiseKtas,
    fuelBurnGph,
    usableFuel,
    maxGrossWeight,
  } = aircraftPerformanceState;
  const isSuperAdmin = Boolean((user as any)?.isSuperAdmin);
  const simulationMultiplier = simulationSpeed === '8x' ? 8 : simulationSpeed === '4x' ? 4 : 1;
  const simulationCruiseKts = Math.max(60, Number(cruiseKtas) || 110);
  const simulationAltitudeFt = Math.max(2500, Number(plannedAltitude) || 6500);
  const simulatedTrafficTargets = useMemo(
    () => buildSimulatedTrafficTargets(simulatedGpsData, { injectConflict: simulationConflictEnabled }),
    [simulatedGpsData, simulationConflictEnabled]
  );
  const activeOwnship = simulationEnabled && simulatedGpsData ? simulatedGpsData : gpsData;
  const activeVerticalSpeedFpm = simulationEnabled ? simulatedVerticalSpeedFpm : verticalSpeedFpm;
  const activeTrafficTargets = simulationEnabled ? simulatedTrafficTargets : trafficTargets;
  const flightDeckSessionState = simulationEnabled ? 'SIM' : gpsEnabled || trafficEnabled ? 'LIVE' : 'PREFLIGHT';
  const flightDeckLayerLabel =
    mapStyle === 'standard'
      ? 'Map'
      : mapStyle === 'sectional'
        ? 'VFR'
        : mapStyle === 'terrain'
          ? 'Terrain'
          : mapStyle === 'radar'
            ? 'Radar'
            : mapStyle === 'winds'
              ? 'Winds'
              : 'Clouds';
  const flightDeckActiveSession = simulationEnabled || gpsEnabled || trafficEnabled || Boolean(activeOwnship);
  const routeProgress = useMemo(
    () => computeMobileRouteProgress(routePoints, activeOwnship),
    [activeOwnship, routePoints]
  );
  const flightPhase = useMemo<'ground' | 'departure' | 'enroute' | 'arrival'>(() => {
    if (!routeProgress) return activeOwnship ? 'departure' : 'ground';
    if (routeProgress.progressPct < 18) return 'departure';
    if (routeProgress.progressPct > 78 || routeProgress.remainingRouteNm < 35) return 'arrival';
    return 'enroute';
  }, [activeOwnship, routeProgress]);
  const rankedTrafficTargets = useMemo(
    () => rankTrafficTargets(activeTrafficTargets, activeOwnship),
    [activeOwnship, activeTrafficTargets]
  );
  const visibleTrafficTargets = useMemo(() => {
    if (trafficFilter === 'all') return rankedTrafficTargets;
    if (trafficFilter === 'conflict') {
      return rankedTrafficTargets.filter((target) => target.threatLevel !== 'monitor');
    }
    if (trafficFilter === 'above') {
      return rankedTrafficTargets.filter((target) => (target.altitudeDeltaFt ?? 0) > 0);
    }
    return rankedTrafficTargets.filter((target) => (target.altitudeDeltaFt ?? 0) < 0);
  }, [rankedTrafficTargets, trafficFilter]);
  const immediateTrafficCount = useMemo(
    () => rankedTrafficTargets.filter((target) => target.threatLevel === 'immediate').length,
    [rankedTrafficTargets]
  );
  const selectedDiversion = useMemo(
    () => diversionCandidates.find((airport) => airport.icao === selectedDiversionIcao) || null,
    [diversionCandidates, selectedDiversionIcao]
  );
  const selectedDiversionBestComm = useMemo(
    () => pickBestDiversionFrequency(selectedDiversion),
    [selectedDiversion]
  );
  const selectedDiversionPoint = useMemo(() => {
    if (!selectedDiversion) return null;
    if (typeof selectedDiversion.lat === 'number' && typeof selectedDiversion.lon === 'number') {
      return { latitude: selectedDiversion.lat, longitude: selectedDiversion.lon };
    }
    if (!activeOwnship) return null;
    const bearingRad = toRad(selectedDiversion.bearingDeg);
    const northNm = Math.cos(bearingRad) * selectedDiversion.distanceNm;
    const eastNm = Math.sin(bearingRad) * selectedDiversion.distanceNm;
    const estimate = offsetLatLonByNm(activeOwnship.lat, activeOwnship.lon, northNm, eastNm);
    return { latitude: estimate.lat, longitude: estimate.lon };
  }, [activeOwnship, selectedDiversion]);
  const diversionPanelAirports = useMemo(() => {
    const wxRank = (airport: NearbyDiversionAirport) => {
      switch ((airport.flightCategory || '').toUpperCase()) {
        case 'VFR':
          return 0;
        case 'MVFR':
          return 1;
        case 'IFR':
          return 2;
        case 'LIFR':
          return 3;
        default:
          return 2;
      }
    };
    return [...diversionCandidates]
      .sort((a, b) => {
        const aSelected = selectedDiversion?.icao === a.icao ? -1 : 0;
        const bSelected = selectedDiversion?.icao === b.icao ? -1 : 0;
        if (aSelected !== bSelected) return aSelected - bSelected;
        const wxDelta = wxRank(a) - wxRank(b);
        if (wxDelta !== 0) return wxDelta;
        const runwayDelta = (b.maxRunwayFt || 0) - (a.maxRunwayFt || 0);
        if (runwayDelta !== 0) return runwayDelta;
        return a.distanceNm - b.distanceNm;
      })
      .slice(0, 4);
  }, [diversionCandidates, selectedDiversion?.icao]);
  const topTrafficTarget = visibleTrafficTargets[0] || null;
  const selectedTrafficTarget = useMemo(
    () => visibleTrafficTargets.find((target) => target.id === selectedTrafficId) || topTrafficTarget || null,
    [selectedTrafficId, topTrafficTarget, visibleTrafficTargets]
  );
  const trafficPanelTargets = useMemo(() => {
    if (!selectedTrafficTarget) return visibleTrafficTargets.slice(0, 5);
    const rest = visibleTrafficTargets.filter((target) => target.id !== selectedTrafficTarget.id);
    return [selectedTrafficTarget, ...rest].slice(0, 5);
  }, [selectedTrafficTarget, visibleTrafficTargets]);
  const selectedTrafficTrend = useMemo(
    () => (selectedTrafficTarget ? trafficTrendMap[selectedTrafficTarget.id] || null : null),
    [selectedTrafficTarget, trafficTrendMap]
  );
  const selectedDiversionRunwaySummary = useMemo(() => {
    if (selectedDiversionBriefingLoading) return 'Loading runway briefing';
    if (selectedDiversionBriefing?.advisory) {
      return `Runway ${selectedDiversionBriefing.advisory.runway || '--'} · HW ${selectedDiversionBriefing.advisory.headwind ?? '--'} kt · XW ${selectedDiversionBriefing.advisory.crosswind ?? '--'} kt`;
    }
    if (selectedDiversionBriefing?.runwayInUse) {
      return `Runway in use ${selectedDiversionBriefing.runwayInUse}`;
    }
    return 'Runway advisory pending';
  }, [selectedDiversionBriefing, selectedDiversionBriefingLoading]);
  useEffect(() => {
    if (!activeOwnship || !rankedTrafficTargets.length) {
      setTrafficTrendMap({});
      trafficSnapshotRef.current = {};
      return;
    }

    const nextSnapshots: Record<string, { distanceNm: number; bearingDelta: number; at: number }> = {};
    const nextTrends: Record<string, TrafficTrend> = {};
    const now = Date.now();

    rankedTrafficTargets.forEach((target) => {
      const bearingToTraffic = bearingBetweenPoints(
        { latitude: activeOwnship.lat, longitude: activeOwnship.lon },
        { latitude: target.lat, longitude: target.lon },
      );
      const bearingDelta = normalizeHeadingDelta(bearingToTraffic - (activeOwnship.heading ?? 0));
      const previous = trafficSnapshotRef.current[target.id];
      let distanceRateNmPerMin: number | null = null;
      let bearingRateDegPerMin: number | null = null;
      if (previous) {
        const elapsedMinutes = Math.max((now - previous.at) / 60000, 0.016);
        distanceRateNmPerMin = (target.distanceNm - previous.distanceNm) / elapsedMinutes;
        bearingRateDegPerMin = normalizeHeadingDelta(bearingDelta - previous.bearingDelta) / elapsedMinutes;
      }
      const closureText =
        distanceRateNmPerMin == null
          ? 'Monitor'
          : distanceRateNmPerMin <= -1
            ? 'Closing fast'
            : distanceRateNmPerMin <= -0.25
              ? 'Converging'
              : distanceRateNmPerMin >= 0.35
                ? 'Opening'
                : 'Stable';
      nextTrends[target.id] = {
        distanceRateNmPerMin,
        bearingRateDegPerMin,
        closureText,
      };
      nextSnapshots[target.id] = {
        distanceNm: target.distanceNm,
        bearingDelta,
        at: now,
      };
    });

    trafficSnapshotRef.current = nextSnapshots;
    setTrafficTrendMap(nextTrends);
  }, [activeOwnship, rankedTrafficTargets]);
  const terrainPathParam = useMemo(
    () =>
      routePoints.length >= 2
        ? routePoints.map((point) => `${point.latitude},${point.longitude}`).join(';')
        : '',
    [routePoints]
  );
  const nextWaypointMeta = useMemo(() => {
    if (!routeProgress?.nextWaypoint) return null;
    const normalized = routeProgress.nextWaypoint.toUpperCase();
    return routePoints.find((point) => point.icao.toUpperCase() === normalized) || routePoints[1] || null;
  }, [routePoints, routeProgress?.nextWaypoint]);
  const terrainTrendFt = useMemo(() => {
    const samples = terrainProfile?.samples ?? [];
    if (samples.length < 3) return 0;
    const near = samples.slice(0, Math.min(samples.length, 6)).map((sample) => sample.elevationFt ?? 0);
    return Math.max(...near) - (near[0] ?? 0);
  }, [terrainProfile?.samples]);
  const terrainAlertThresholds = useMemo(() => {
    const baseWarning = flightPhase === 'departure' || flightPhase === 'arrival' ? 1500 : 1000;
    const baseCaution = flightPhase === 'departure' || flightPhase === 'arrival' ? 2500 : 2000;
    const riseBuffer = terrainTrendFt > 1200 ? 500 : terrainTrendFt > 600 ? 250 : 0;
    return {
      warningFt: baseWarning + riseBuffer,
      cautionFt: baseCaution + riseBuffer,
      closingFast: terrainTrendFt > 1200,
    };
  }, [flightPhase, terrainTrendFt]);
  const terrainClearanceFt = useMemo(() => {
    if (!terrainProfile?.maxElevationFt || !Number.isFinite(simulationAltitudeFt)) return null;
    return simulationAltitudeFt - terrainProfile.maxElevationFt;
  }, [simulationAltitudeFt, terrainProfile?.maxElevationFt]);
  const terrainRisk = useMemo<'nominal' | 'caution' | 'warning' | 'unknown'>(() => {
    if (terrainClearanceFt == null) return 'unknown';
    if (terrainClearanceFt < terrainAlertThresholds.warningFt) return 'warning';
    if (terrainClearanceFt < terrainAlertThresholds.cautionFt) return 'caution';
    return 'nominal';
  }, [terrainAlertThresholds.cautionFt, terrainAlertThresholds.warningFt, terrainClearanceFt]);
  const highestObstacleHeightFt = obstacleScan?.highestObstacle?.amslFt ?? obstacleScan?.highestObstacle?.aglFt ?? null;
  const closestObstacleDistanceNm = useMemo(() => {
    const obstacles = obstacleScan?.obstacles ?? [];
    if (!obstacles.length) return null;
    return obstacles.reduce((min, obstacle) => Math.min(min, obstacle.distanceNm), Number.POSITIVE_INFINITY);
  }, [obstacleScan?.obstacles]);
  const obstacleTimeMinutes = useMemo(() => {
    if (!closestObstacleDistanceNm || !activeOwnship?.speedKts || activeOwnship.speedKts < 40) return null;
    return (closestObstacleDistanceNm / activeOwnship.speedKts) * 60;
  }, [activeOwnship?.speedKts, closestObstacleDistanceNm]);
  const obstacleAlertThresholds = useMemo(() => {
    const baseWarning = flightPhase === 'departure' || flightPhase === 'arrival' ? 1000 : 700;
    const baseCaution = flightPhase === 'departure' || flightPhase === 'arrival' ? 1800 : 1500;
    const closureBuffer = obstacleTimeMinutes != null && obstacleTimeMinutes <= 4
      ? 300
      : obstacleTimeMinutes != null && obstacleTimeMinutes <= 8
        ? 150
        : 0;
    return {
      warningFt: baseWarning + closureBuffer,
      cautionFt: baseCaution + closureBuffer,
      closingFast: obstacleTimeMinutes != null && obstacleTimeMinutes <= 4,
    };
  }, [flightPhase, obstacleTimeMinutes]);
  const obstacleClearanceFt = useMemo(() => {
    if (highestObstacleHeightFt == null) return null;
    const referenceAltitude = activeOwnship?.altitudeFt ?? simulationAltitudeFt;
    return referenceAltitude - highestObstacleHeightFt;
  }, [activeOwnship?.altitudeFt, highestObstacleHeightFt, simulationAltitudeFt]);
  const obstacleRisk = useMemo<'nominal' | 'caution' | 'warning' | 'unknown'>(() => {
    if (obstacleClearanceFt == null) return 'unknown';
    if (obstacleClearanceFt < obstacleAlertThresholds.warningFt) return 'warning';
    if (obstacleClearanceFt < obstacleAlertThresholds.cautionFt) return 'caution';
    return 'nominal';
  }, [obstacleAlertThresholds.cautionFt, obstacleAlertThresholds.warningFt, obstacleClearanceFt]);
  const activeFlightAlert = useMemo(() => {
    if (selectedTrafficTarget?.threatLevel === 'immediate') {
      return {
        severity: 'warning' as const,
        title: 'Immediate traffic',
        detail: `${selectedTrafficTarget.callsign || 'Traffic'} ${selectedTrafficTarget.distanceNm.toFixed(1)} NM · ${formatAltitudeDelta(selectedTrafficTarget.altitudeDeltaFt)}`,
      };
    }
    if (
      selectedDiversion &&
      (
        selectedDiversion.flightCategory === 'IFR' ||
        selectedDiversion.flightCategory === 'LIFR' ||
        (selectedDiversionBriefing?.advisory?.crosswind ?? 0) >= 15
      )
    ) {
      return {
        severity: 'caution' as const,
        title: 'Diversion caution',
        detail: `${selectedDiversion.icao} ${selectedDiversion.flightCategory || 'WX'}${selectedDiversionBriefing?.advisory?.crosswind ? ` · XW ${selectedDiversionBriefing.advisory.crosswind} kt` : ''}`,
      };
    }
    if (terrainRisk === 'warning') {
      return {
        severity: 'warning' as const,
        title: 'Terrain warning',
        detail: `Route terrain clearance ${Math.round(terrainClearanceFt || 0)} ft${terrainAlertThresholds.closingFast ? ' - terrain rising quickly' : ''}`,
      };
    }
    if (obstacleRisk === 'warning') {
      return {
        severity: 'warning' as const,
        title: 'Obstacle warning',
        detail: `Nearby obstacle clearance ${Math.round(obstacleClearanceFt || 0)} ft${obstacleAlertThresholds.closingFast ? ' - closure increasing' : ''}`,
      };
    }
    if (terrainRisk === 'caution') {
      return {
        severity: 'caution' as const,
        title: 'Terrain caution',
        detail: `Route terrain clearance ${Math.round(terrainClearanceFt || 0)} ft`,
      };
    }
    return null;
  }, [
    obstacleAlertThresholds.closingFast,
    obstacleClearanceFt,
    obstacleRisk,
    selectedDiversion,
    selectedDiversionBriefing?.advisory?.crosswind,
    selectedTrafficTarget,
    terrainAlertThresholds.closingFast,
    terrainClearanceFt,
    terrainRisk,
  ]);
  const flightDeckVisibleAlert = useMemo(() => {
    if (selectedTrafficTarget?.threatLevel === 'immediate') {
      return {
        severity: 'warning' as const,
        title: 'Immediate traffic',
        detail: `${selectedTrafficTarget.callsign || 'Traffic'} ${selectedTrafficTarget.distanceNm.toFixed(1)} NM · ${formatAltitudeDelta(selectedTrafficTarget.altitudeDeltaFt)}`,
      };
    }
    if (terrainRisk === 'warning') {
      return {
        severity: 'warning' as const,
        title: 'Terrain warning',
        detail: `Route terrain clearance ${Math.round(terrainClearanceFt || 0)} ft${terrainAlertThresholds.closingFast ? ' - terrain rising quickly' : ''}`,
      };
    }
    if (obstacleRisk === 'warning') {
      return {
        severity: 'warning' as const,
        title: 'Obstacle warning',
        detail: `Nearby obstacle clearance ${Math.round(obstacleClearanceFt || 0)} ft${obstacleAlertThresholds.closingFast ? ' - closure increasing' : ''}`,
      };
    }
    if (flightDeckAdvisoriesMuted) {
      return null;
    }
    return activeFlightAlert;
  }, [
    activeFlightAlert,
    flightDeckAdvisoriesMuted,
    obstacleAlertThresholds.closingFast,
    obstacleClearanceFt,
    obstacleRisk,
    selectedTrafficTarget,
    terrainAlertThresholds.closingFast,
    terrainClearanceFt,
    terrainRisk,
  ]);
  const visionGuidance = useMemo(() => {
    if (selectedTrafficTarget?.threatLevel === 'immediate') {
      return `Traffic ${selectedTrafficTarget.callsign || 'target'} ahead`;
    }
    if (terrainRisk === 'warning') {
      return terrainAlertThresholds.closingFast ? 'Terrain rising rapidly' : 'Terrain margin low';
    }
    if (terrainRisk === 'caution') {
      return 'Terrain rising ahead';
    }
    if (selectedDiversion) {
      return `Nearest escape ${selectedDiversion.icao}`;
    }
    if (routeProgress?.nextWaypoint) {
      return `Track to ${routeProgress.nextWaypoint}`;
    }
    return 'Hold current route';
  }, [routeProgress?.nextWaypoint, selectedDiversion, selectedTrafficTarget, terrainRisk]);
  const visionTerrainColumns = useMemo(() => {
    const samples = terrainProfile?.samples ?? [];
    const ownshipAltitude = activeOwnship?.altitudeFt ?? simulationAltitudeFt;
    if (!samples.length || !Number.isFinite(ownshipAltitude)) return [];
    const maxElevation = Math.max(...samples.map((sample) => sample.elevationFt ?? 0), 1);
    return samples.slice(0, 14).map((sample, index, arr) => {
      const elevation = sample.elevationFt ?? 0;
      const ratio = Math.max(0.08, Math.min(0.92, elevation / Math.max(maxElevation, ownshipAltitude)));
      const danger = ownshipAltitude - elevation;
      return {
        key: `terrain-column-${index}`,
        leftPct: arr.length <= 1 ? 50 : (index / (arr.length - 1)) * 100,
        heightPct: Math.max(10, Math.min(60, ratio * 68)),
        risk:
          danger < 1000 ? 'warning' : danger < 2000 ? 'caution' : 'nominal',
      };
    });
  }, [activeOwnship?.altitudeFt, simulationAltitudeFt, terrainProfile?.samples]);
  const visionObstacleCues = useMemo(() => {
    const obstacles = obstacleScan?.obstacles ?? [];
    if (!obstacles.length || !activeOwnship) return [];
    return obstacles.slice(0, 3).map((obstacle, index) => {
      const bearingToObstacle = bearingBetweenPoints(
        { latitude: activeOwnship.lat, longitude: activeOwnship.lon },
        { latitude: obstacle.lat, longitude: obstacle.lon },
      );
      const bearingDelta = normalizeHeadingDelta(bearingToObstacle - (activeOwnship.heading ?? 0));
      const xPct = Math.max(14, Math.min(86, 50 + bearingDelta / 2.2));
      const obstacleAltitude = obstacle.amslFt ?? obstacle.aglFt ?? 0;
      const altitudeDelta = obstacleAltitude - (activeOwnship.altitudeFt ?? simulationAltitudeFt);
      const yPct = Math.max(26, Math.min(76, 54 + altitudeDelta / 180));
      return {
        key: `vision-obstacle-${obstacle.id}-${index}`,
        xPct,
        yPct,
        risk: altitudeDelta > -700 ? 'warning' : altitudeDelta > -1500 ? 'caution' : 'nominal',
      };
    });
  }, [activeOwnship, obstacleScan?.obstacles, simulationAltitudeFt]);
  const visionTrafficCue = useMemo(() => {
    if (!selectedTrafficTarget || !activeOwnship) return null;
    const bearingToTraffic = bearingBetweenPoints(
      { latitude: activeOwnship.lat, longitude: activeOwnship.lon },
      { latitude: selectedTrafficTarget.lat, longitude: selectedTrafficTarget.lon },
    );
    const bearingDelta = normalizeHeadingDelta(bearingToTraffic - (activeOwnship.heading ?? 0));
    const absBearingDelta = Math.abs(bearingDelta);
    const sector =
      absBearingDelta <= 20
        ? 'ahead'
        : absBearingDelta <= 70
          ? bearingDelta < 0
            ? 'left crossing'
            : 'right crossing'
          : absBearingDelta >= 135
            ? 'aft sector'
            : bearingDelta < 0
              ? 'left'
              : 'right';
    const trend = trafficTrendMap[selectedTrafficTarget.id];
    const vectorDxPct = clamp((trend?.bearingRateDegPerMin ?? 0) / 8, -8, 8);
    const vectorDyPct =
      trend?.distanceRateNmPerMin == null
        ? 0
        : trend.distanceRateNmPerMin < 0
          ? 8
          : trend.distanceRateNmPerMin > 0
            ? -8
            : 0;
    return {
      xPct: clamp(50 + bearingDelta / 1.8, 18, 82),
      yPct: clamp(48 - (selectedTrafficTarget.altitudeDeltaFt ?? 0) / 220, 18, 72),
      threat: selectedTrafficTarget.threatLevel,
      sector,
      clock: relativeClockPosition(bearingDelta),
      closureText:
        trend?.closureText ||
        (selectedTrafficTarget.distanceNm <= 2 && absBearingDelta <= 35
          ? 'Converging'
          : selectedTrafficTarget.distanceNm <= 4
            ? 'Near sector'
            : 'Monitor'),
      vectorDxPct,
      vectorDyPct,
    };
  }, [activeOwnship, selectedTrafficTarget, trafficTrendMap]);
  const visionRouteGuidance = useMemo(() => {
    if (!activeOwnship || !nextWaypointMeta || !routeProgress) return null;
    const desiredTrack = routeProgress.desiredTrackDeg ?? bearingBetweenPoints(
      { latitude: activeOwnship.lat, longitude: activeOwnship.lon },
      { latitude: nextWaypointMeta.latitude, longitude: nextWaypointMeta.longitude },
    );
    const headingDelta = normalizeHeadingDelta(desiredTrack - (activeOwnship.heading ?? desiredTrack));
    const centerShiftPct = clamp(headingDelta / 2.6 + routeProgress.crossTrackNm * 5.2, -18, 18);
    const gates = [0, 1, 2, 3].map((index) => {
      const width = 58 - index * 11;
      const height = 14 - index * 2;
      const top = 62 - index * 12;
      const center = 50 + centerShiftPct * (1 - index * 0.18);
      return {
        key: `vision-gate-${index}`,
        leftPct: center - width / 2,
        widthPct: width,
        topPct: top,
        heightPct: height,
      };
    });
    const tunnelBands = gates.slice(0, 3).map((gate, index) => ({
      key: `vision-band-${index}`,
      leftPct: gate.leftPct + 3.5,
      widthPct: Math.max(12, gate.widthPct - 7),
      topPct: gate.topPct + 1.5,
      heightPct: Math.max(5, gate.heightPct - 3),
    }));
    const lateralCaptured = Math.abs(routeProgress.crossTrackNm) < 0.25 && Math.abs(headingDelta) < 5;
    const corridorSeverity =
      routeProgress.offRouteNm > 2.5 || Math.abs(headingDelta) > 25
        ? 'warning'
        : routeProgress.offRouteNm > 1.5 || Math.abs(headingDelta) > 12
          ? 'caution'
          : 'nominal';
    return {
      desiredTrack,
      headingDelta,
      offRouteNm: routeProgress.offRouteNm,
      crossTrackNm: routeProgress.crossTrackNm,
      centerlineLeftPct: 49.5 + clamp(centerShiftPct * 0.45, -10, 10),
      gates,
      tunnelBands,
      lateralCaptured,
      corridorSeverity,
      lateralCue:
        routeProgress.offRouteNm > 1.5
          ? routeProgress.crossTrackNm >= 0
            ? 'Correct right to rejoin'
            : 'Correct left to rejoin'
          : Math.abs(headingDelta) > 8
            ? headingDelta >= 0
              ? 'Ease right on course'
              : 'Ease left on course'
            : 'Centered on route',
    };
  }, [activeOwnship, nextWaypointMeta, routeProgress]);
  const terrainEscapeGuidance = useMemo(() => {
    if (terrainRisk === 'nominal' && obstacleRisk === 'nominal') return null;
    const terrainSafeAltitude = terrainProfile?.maxElevationFt != null ? Math.ceil((terrainProfile.maxElevationFt + 2000) / 100) * 100 : null;
    const obstacleSafeAltitude = highestObstacleHeightFt != null ? Math.ceil((highestObstacleHeightFt + 1500) / 100) * 100 : null;
    const safeAltitudeFt = Math.max(terrainSafeAltitude ?? 0, obstacleSafeAltitude ?? 0, simulationAltitudeFt);
    if (terrainRisk === 'warning' || obstacleRisk === 'warning') {
      return selectedDiversion
        ? `Climb toward ${safeAltitudeFt.toFixed(0)} ft or divert ${selectedDiversion.icao}`
        : `Climb toward ${safeAltitudeFt.toFixed(0)} ft immediately`;
    }
    if (terrainRisk === 'caution' || obstacleRisk === 'caution') {
      return selectedDiversion
        ? `Monitor climb margin. ${selectedDiversion.icao} is the nearest escape.`
        : `Monitor climb margin. Terrain funnel tightening ahead.`;
    }
    return null;
  }, [highestObstacleHeightFt, obstacleRisk, selectedDiversion, simulationAltitudeFt, terrainProfile?.maxElevationFt, terrainRisk]);
  const terrainEscapeTargetFt = useMemo(() => {
    const terrainSafeAltitude = terrainProfile?.maxElevationFt != null ? Math.ceil((terrainProfile.maxElevationFt + 2000) / 100) * 100 : null;
    const obstacleSafeAltitude = highestObstacleHeightFt != null ? Math.ceil((highestObstacleHeightFt + 1500) / 100) * 100 : null;
    const best = Math.max(terrainSafeAltitude ?? 0, obstacleSafeAltitude ?? 0);
    return best > 0 ? best : null;
  }, [highestObstacleHeightFt, terrainProfile?.maxElevationFt]);
  const visionManeuverRecommendation = useMemo(() => {
    if (selectedTrafficTarget?.threatLevel === 'immediate') {
      const sector = visionTrafficCue?.sector || 'ahead';
      const altitudeDelta = selectedTrafficTarget.altitudeDeltaFt ?? 0;
      const closure = visionTrafficCue?.closureText || 'Monitor';
      if (sector.includes('left')) {
        return altitudeDelta >= 0 ? `${closure}: traffic left/high. Turn right and hold altitude.` : `${closure}: traffic left/low. Turn right and consider climb.`;
      }
      if (sector.includes('right')) {
        return altitudeDelta >= 0 ? `${closure}: traffic right/high. Turn left and hold altitude.` : `${closure}: traffic right/low. Turn left and consider climb.`;
      }
      return altitudeDelta >= 0 ? `${closure}: traffic ahead/high. Offset right and monitor descent.` : `${closure}: traffic ahead/low. Hold course and climb if needed.`;
    }
    if (terrainRisk === 'warning' || obstacleRisk === 'warning') {
      return terrainEscapeGuidance || 'Immediate escape action recommended.';
    }
    if (terrainRisk === 'caution' || obstacleRisk === 'caution') {
      return selectedDiversion ? `Keep ${selectedDiversion.icao} available as an escape.` : 'Maintain climb margin and stay centered in the corridor.';
    }
    if (visionRouteGuidance?.offRouteNm && visionRouteGuidance.offRouteNm > 1.5) {
      return 'Rejoin the route corridor before the next waypoint.';
    }
    return 'Continue current route and monitor traffic.';
  }, [obstacleRisk, selectedDiversion, selectedTrafficTarget, terrainEscapeGuidance, terrainRisk, visionRouteGuidance?.offRouteNm, visionTrafficCue?.sector]);
  const trafficConflictGuidance = useMemo(() => {
    if (selectedTrafficTarget?.threatLevel !== 'immediate') return null;
    const sector = visionTrafficCue?.sector || 'ahead';
    const altitudeDelta = selectedTrafficTarget.altitudeDeltaFt ?? 0;
    const defaultBias =
      sector.includes('left')
        ? 'right'
        : sector.includes('right')
          ? 'left'
          : altitudeDelta >= 0
            ? 'left'
            : 'right';
    const bias = trafficResolutionBias || defaultBias;
    const verticalCommand = altitudeDelta < 0 ? 'Consider climb for separation' : 'Hold altitude';
    if (sector.includes('left') || sector.includes('right')) {
      return {
        lateralOffsetPct: bias === 'right' ? 12 : -12,
        verticalOffsetPct: altitudeDelta < 0 ? -6 : 0,
        turnCommand: `Traffic bias ${bias}`,
        verticalCommand,
        mode: 'traffic' as const,
      };
    }
    return {
      lateralOffsetPct: bias === 'right' ? 8 : -8,
      verticalOffsetPct: altitudeDelta < 0 ? -8 : 4,
      turnCommand: `Traffic ahead - bias ${bias}`,
      verticalCommand: altitudeDelta < 0 ? 'Climb if needed for separation' : 'Hold altitude / monitor descent',
      mode: 'traffic' as const,
    };
  }, [selectedTrafficTarget, trafficResolutionBias, visionTrafficCue?.sector]);
  const visionDirectorCue = useMemo(() => {
    if (trafficConflictGuidance) {
      return {
        ...trafficConflictGuidance,
        lateralCaptured: false,
        verticalCaptured: false,
      };
    }
    const currentAltitude = activeOwnship?.altitudeFt ?? simulationAltitudeFt;
    const headingDelta = visionRouteGuidance?.headingDelta ?? 0;
    const targetAltitude =
      terrainRisk === 'warning' || obstacleRisk === 'warning'
        ? Math.max(terrainEscapeTargetFt ?? 0, flightDeckTargetAltitudeFt ?? 0, currentAltitude)
        : flightDeckTargetAltitudeFt ?? simulationAltitudeFt;
    const altitudeErrorFt = targetAltitude - currentAltitude;
    const lateralCaptured = Boolean(visionRouteGuidance?.lateralCaptured);
    const verticalCaptured = Math.abs(altitudeErrorFt) < 150;
    const mode =
      terrainRisk === 'warning' || obstacleRisk === 'warning'
        ? 'escape'
        : !lateralCaptured || Math.abs(headingDelta) > 12
          ? 'intercept'
          : !verticalCaptured
            ? 'capture'
            : 'track';
    return {
      lateralOffsetPct: clamp(headingDelta * 0.32, -16, 16),
      verticalOffsetPct: clamp(-altitudeErrorFt / 90, -18, 18),
      lateralCaptured,
      verticalCaptured,
      mode,
      turnCommand:
        Math.abs(headingDelta) < 6 ? 'Track centered'
        : headingDelta > 0 ? `Turn right ${Math.round(Math.abs(headingDelta))}°`
        : `Turn left ${Math.round(Math.abs(headingDelta))}°`,
      verticalCommand:
        Math.abs(altitudeErrorFt) < 150 ? 'Hold altitude'
        : altitudeErrorFt > 0 ? `Climb to ${Math.round(targetAltitude)} ft`
        : `Descend to ${Math.round(targetAltitude)} ft`,
    };
  }, [activeOwnship?.altitudeFt, flightDeckTargetAltitudeFt, obstacleRisk, simulationAltitudeFt, terrainEscapeTargetFt, terrainRisk, trafficConflictGuidance, visionRouteGuidance?.headingDelta, visionRouteGuidance?.lateralCaptured]);
  const mapTacticalSummary = useMemo(() => {
    const modeLabel =
      visionDirectorCue.mode === 'traffic'
        ? 'Traffic'
        : visionDirectorCue.mode === 'escape'
        ? 'Escape'
        : visionDirectorCue.mode === 'intercept'
          ? 'Intercept'
          : visionDirectorCue.mode === 'capture'
            ? 'Capture'
            : 'Track';
    return {
      modeLabel,
      heading: visionDirectorCue.turnCommand,
      vertical: visionDirectorCue.verticalCommand,
      recommendation: visionManeuverRecommendation,
    };
  }, [visionDirectorCue.mode, visionDirectorCue.turnCommand, visionDirectorCue.verticalCommand, visionManeuverRecommendation]);
  const visionVerticalCueLabel = useMemo(() => {
    if (visionDirectorCue.verticalCommand.startsWith('Climb')) return 'CLB';
    if (visionDirectorCue.verticalCommand.startsWith('Descend')) return 'DES';
    return 'ALT';
  }, [visionDirectorCue.verticalCommand]);
  const flightDeckCommandBankDeg = useMemo(
    () => clamp(visionDirectorCue.lateralOffsetPct * 1.8, -30, 30),
    [visionDirectorCue.lateralOffsetPct]
  );
  const flightDeckBankTicks = useMemo(
    () => [-30, -20, -10, 0, 10, 20, 30].map((value) => ({
      value,
      leftPct: 50 + value * 1.12,
      major: value % 20 === 0 || value === 0,
    })),
    []
  );
  const pulseFlightDeckChrome = (keepVisible = false) => {
    setFlightDeckChromeVisible(true);
    setFlightDeckInteractionTick(Date.now());
    if (!keepVisible) return;
    if (flightDeckChromeTimerRef.current) {
      clearTimeout(flightDeckChromeTimerRef.current);
      flightDeckChromeTimerRef.current = null;
    }
  };
  const openFlightDeckPanel = (panel: FlightDeckPanel) => {
    setFlightDeckPanel(panel);
    setFlightDeckDrawerOpen(true);
    pulseFlightDeckChrome(true);
  };
  const toggleFlightDeckPanel = (panel: FlightDeckPanel) => {
    pulseFlightDeckChrome(true);
    if (flightDeckDrawerOpen && flightDeckPanel === panel) {
      setFlightDeckDrawerOpen(false);
      return;
    }
    setFlightDeckPanel(panel);
    setFlightDeckDrawerOpen(true);
  };
  const toggleFlightDeckView = () => {
    pulseFlightDeckChrome();
    setFlightDeckView((current) => (current === 'map' ? 'vision' : 'map'));
  };
  const toggleFlightDeckHud = () => {
    pulseFlightDeckChrome(true);
    setFlightDeckHudExpanded((prev) => !prev);
  };
  const focusMapOnPoint = (
    latitude: number,
    longitude: number,
    deltas: { latitudeDelta?: number; longitudeDelta?: number } = {},
  ) => {
    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: deltas.latitudeDelta ?? 0.65,
        longitudeDelta: deltas.longitudeDelta ?? 0.65,
      },
      450,
    );
  };
  const focusTrafficTarget = (target: RankedTrafficTarget) => {
    setSelectedTrafficId(target.id);
    openFlightDeckPanel('traffic');
    setFlightDeckView('map');
    focusMapOnPoint(target.lat, target.lon, { latitudeDelta: 0.32, longitudeDelta: 0.32 });
  };
  const focusDiversionAirport = (airport: NearbyDiversionAirport) => {
    setSelectedDiversionIcao(airport.icao);
    openFlightDeckPanel('diversions');
    setFlightDeckView('map');
    if (typeof airport.lat === 'number' && typeof airport.lon === 'number') {
      focusMapOnPoint(airport.lat, airport.lon, { latitudeDelta: 0.36, longitudeDelta: 0.36 });
    } else if (activeOwnship) {
      const bearingRad = toRad(airport.bearingDeg);
      const northNm = Math.cos(bearingRad) * airport.distanceNm;
      const eastNm = Math.sin(bearingRad) * airport.distanceNm;
      const estimate = offsetLatLonByNm(activeOwnship.lat, activeOwnship.lon, northNm, eastNm);
      focusMapOnPoint(estimate.lat, estimate.lon, { latitudeDelta: 0.42, longitudeDelta: 0.42 });
    }
  };
  const engageDirectToDiversion = (airport: NearbyDiversionAirport) => {
    setSelectedDiversionIcao(airport.icao);
    openFlightDeckPanel('status');
    setFlightDeckView('map');
    setDestination(airport.icao);
    setSuggestedMode('direct');
    setWaypoints('');
    setPlannedStops('');
    if (simulationEnabled) {
      setSimulationRunning(false);
      if (typeof airport.lat === 'number' && typeof airport.lon === 'number') {
        setSimulatedGpsData({
          lat: airport.lat,
          lon: airport.lon,
          altitudeFt: Math.max(1500, (activeOwnship?.altitudeFt || simulationAltitudeFt) - 800),
          speedKts: Math.max(90, activeOwnship?.speedKts || simulationCruiseKts),
          heading: activeOwnship?.heading || airport.bearingDeg,
        });
        setSimulatedVerticalSpeedFpm(-350);
      }
    }
    focusDiversionAirport(airport);
  };

  useEffect(() => {
    const routeParams = route.params || {};
    const nextDeparture = typeof routeParams.departure === 'string' ? routeParams.departure.trim().toUpperCase() : '';
    const nextDestination = typeof routeParams.destination === 'string' ? routeParams.destination.trim().toUpperCase() : '';
    const nextWaypoints = typeof routeParams.waypoints === 'string' ? routeParams.waypoints.trim().toUpperCase() : '';
    const nextPlannedStops = typeof routeParams.plannedStops === 'string' ? routeParams.plannedStops.trim().toUpperCase() : '';
    const nextPlannedAltitude = typeof routeParams.plannedAltitude === 'string' ? routeParams.plannedAltitude.trim() : '';
    const nextCruiseKtas = typeof routeParams.cruiseKtas === 'string' ? routeParams.cruiseKtas.trim() : '';

    if (nextDeparture) setDeparture(nextDeparture);
    if (nextDestination) setDestination(nextDestination);
    if (nextWaypoints) setWaypoints(nextWaypoints);
    if (nextPlannedStops) setPlannedStops(nextPlannedStops);
    if (nextPlannedAltitude) setPlannedAltitude(nextPlannedAltitude);
    if (nextCruiseKtas) {
      dispatchAircraftPerformance({ type: 'set_field', field: 'cruiseKtas', value: nextCruiseKtas });
    }
  }, [route.params]);

  useEffect(() => {
    if (!isFlightDeck) {
      if (flightDeckChromeTimerRef.current) {
        clearTimeout(flightDeckChromeTimerRef.current);
        flightDeckChromeTimerRef.current = null;
      }
      setFlightDeckView('map');
      setFlightDeckDrawerOpen(false);
      setFlightDeckHudExpanded(false);
      setFlightDeckChromeVisible(true);
      setFlightDeckTargetAltitudeFt(null);
      setTrafficResolutionBias(null);
      return;
    }
    if (flightDeckView === 'vision' && !activeOwnship) {
      setFlightDeckView('map');
    }
  }, [activeOwnship, flightDeckView, isFlightDeck]);

  useEffect(() => {
    if (selectedTrafficTarget?.threatLevel !== 'immediate' && trafficResolutionBias) {
      setTrafficResolutionBias(null);
    }
  }, [selectedTrafficTarget?.threatLevel, trafficResolutionBias]);

  useEffect(() => {
    if (terrainRisk === 'nominal' && obstacleRisk === 'nominal' && flightDeckTargetAltitudeFt != null) {
      setFlightDeckTargetAltitudeFt(null);
    }
  }, [flightDeckTargetAltitudeFt, obstacleRisk, terrainRisk]);

  useEffect(() => {
    if (flightDeckChromeTimerRef.current) {
      clearTimeout(flightDeckChromeTimerRef.current);
      flightDeckChromeTimerRef.current = null;
    }

    if (!isFlightDeck) {
      return;
    }

    if (!flightDeckActiveSession || flightDeckDrawerOpen || flightDeckHudExpanded) {
      setFlightDeckChromeVisible(true);
      return;
    }

    setFlightDeckChromeVisible(true);
    flightDeckChromeTimerRef.current = setTimeout(() => {
      setFlightDeckChromeVisible(false);
    }, 4000);

    return () => {
      if (flightDeckChromeTimerRef.current) {
        clearTimeout(flightDeckChromeTimerRef.current);
        flightDeckChromeTimerRef.current = null;
      }
    };
  }, [flightDeckActiveSession, flightDeckDrawerOpen, flightDeckHudExpanded, flightDeckInteractionTick, isFlightDeck]);

  useEffect(() => {
    const alertKey = flightDeckVisibleAlert
      ? `${flightDeckVisibleAlert.severity}:${flightDeckVisibleAlert.title}:${selectedTrafficTarget?.id || terrainRisk}:${selectedDiversion?.icao || obstacleRisk}`
      : null;
    if (!alertKey) {
      flightDeckAutoPanelRef.current = null;
      return;
    }
    const alertSeverity = flightDeckVisibleAlert?.severity;
    if (alertSeverity !== 'warning' || flightDeckAutoPanelRef.current === alertKey) {
      return;
    }
    flightDeckAutoPanelRef.current = alertKey;
    if (selectedTrafficTarget?.threatLevel === 'immediate') {
      openFlightDeckPanel('traffic');
      return;
    }
    openFlightDeckPanel('status');
  }, [flightDeckVisibleAlert, obstacleRisk, selectedDiversion?.icao, selectedTrafficTarget, terrainRisk]);

  const flightDeckLowerStackBottom = Math.max(
    insets.bottom + (flightDeckHudExpanded ? 222 : 118),
    flightDeckHudExpanded ? 234 : 130,
  );
  const flightDeckTrafficCardVisible = Boolean(
    selectedTrafficTarget && (
      selectedTrafficTarget.threatLevel !== 'monitor' ||
      flightDeckPanel === 'traffic' ||
      Boolean(flightDeckVisibleAlert)
    )
  );
  const flightDeckDiversionCardVisible = Boolean(
    selectedDiversion && (
      !flightDeckTrafficCardVisible ||
      flightDeckPanel === 'diversions' ||
      terrainRisk !== 'nominal' ||
      obstacleRisk !== 'nominal'
    )
  );
  const flightDeckActionButtons: Array<{
    key: string;
    label: string;
    value: string;
    tone: FlightDeckActionTone;
    active?: boolean;
    onPress: () => void;
  }> =
    selectedTrafficTarget?.threatLevel === 'immediate'
      ? [
          {
            key: 'focus-traffic',
            label: 'Focus',
            value: selectedTrafficTarget.callsign || 'Traffic',
            tone: 'warning',
            onPress: () => focusTrafficTarget(selectedTrafficTarget),
          },
          {
            key: 'bias-left',
            label: 'Bias left',
            value: trafficResolutionBias === 'left' ? 'Armed' : 'Resolve',
            tone: 'caution',
            active: trafficResolutionBias === 'left',
            onPress: () => {
              pulseFlightDeckChrome(true);
              setTrafficResolutionBias((current) => (current === 'left' ? null : 'left'));
            },
          },
          {
            key: 'bias-right',
            label: 'Bias right',
            value: trafficResolutionBias === 'right' ? 'Armed' : 'Resolve',
            tone: 'caution',
            active: trafficResolutionBias === 'right',
            onPress: () => {
              pulseFlightDeckChrome(true);
              setTrafficResolutionBias((current) => (current === 'right' ? null : 'right'));
            },
          },
          {
            key: 'mute-noncritical',
            label: flightDeckAdvisoriesMuted ? 'Alerts' : 'Quiet',
            value: flightDeckAdvisoriesMuted ? 'Advisories off' : 'Mute noncritical',
            tone: 'default',
            active: flightDeckAdvisoriesMuted,
            onPress: () => {
              pulseFlightDeckChrome(true);
              setFlightDeckAdvisoriesMuted((current) => !current);
            },
          },
        ]
      : terrainRisk === 'warning' || terrainRisk === 'caution' || obstacleRisk === 'warning' || obstacleRisk === 'caution'
        ? [
            {
              key: 'climb-target',
              label: 'Climb',
              value: terrainEscapeTargetFt ? `${terrainEscapeTargetFt} ft` : visionDirectorCue.verticalCommand,
              tone: terrainRisk === 'warning' || obstacleRisk === 'warning' ? 'warning' : 'caution',
              active: flightDeckTargetAltitudeFt != null,
              onPress: () => {
                pulseFlightDeckChrome(true);
                setFlightDeckTargetAltitudeFt((current) =>
                  terrainEscapeTargetFt && current !== terrainEscapeTargetFt ? terrainEscapeTargetFt : null
                );
                setFlightDeckHudExpanded(true);
              },
            },
            {
              key: 'nearest-diversion',
              label: 'Nearest',
              value: selectedDiversion?.icao || `${diversionCandidates.length} nearby`,
              tone: 'accent',
              onPress: () => {
                if (selectedDiversion) {
                  focusDiversionAirport(selectedDiversion);
                  return;
                }
                toggleFlightDeckPanel('diversions');
              },
            },
            {
              key: 'escape-route',
              label: 'Escape',
              value: selectedDiversion ? `Direct ${selectedDiversion.icao}` : 'Open route',
              tone: 'warning',
              onPress: () => {
                pulseFlightDeckChrome(true);
                if (selectedDiversion) {
                  engageDirectToDiversion(selectedDiversion);
                  return;
                }
                openFlightDeckPanel('status');
              },
            },
            {
              key: 'deck-status',
              label: 'Deck',
              value: mapTacticalSummary.modeLabel,
              tone: 'default',
              active: flightDeckPanel === 'status' && flightDeckDrawerOpen,
              onPress: () => toggleFlightDeckPanel('status'),
            },
          ]
        : [
            {
              key: 'layers',
              label: 'Layers',
              value: flightDeckLayerLabel,
              tone: 'default',
              active: flightDeckPanel === 'layers' && flightDeckDrawerOpen,
              onPress: () => toggleFlightDeckPanel('layers'),
            },
            {
              key: 'traffic',
              label: 'Traffic',
              value: immediateTrafficCount ? `${immediateTrafficCount} TA` : `${visibleTrafficTargets.length} targets`,
              tone: immediateTrafficCount ? 'caution' : 'default',
              active: flightDeckPanel === 'traffic' && flightDeckDrawerOpen,
              onPress: () => toggleFlightDeckPanel('traffic'),
            },
            {
              key: 'diversions',
              label: 'Diversions',
              value: selectedDiversion?.icao || `${diversionCandidates.length} nearby`,
              tone: 'accent',
              active: flightDeckPanel === 'diversions' && flightDeckDrawerOpen,
              onPress: () => toggleFlightDeckPanel('diversions'),
            },
            {
              key: 'vision',
              label: flightDeckView === 'vision' ? 'Map' : 'Vision',
              value: flightDeckView === 'vision' ? 'Return map' : 'Synthetic view',
              tone: 'accent',
              active: flightDeckView === 'vision',
              onPress: toggleFlightDeckView,
            },
          ];

  useEffect(() => {
    if (!visibleTrafficTargets.length) {
      setSelectedTrafficId(null);
      return;
    }
    setSelectedTrafficId((current) =>
      current && visibleTrafficTargets.some((target) => target.id === current)
        ? current
        : visibleTrafficTargets[0]?.id || null
    );
  }, [visibleTrafficTargets]);

  useEffect(() => {
    if (trafficEnabled || gpsEnabled || simulationEnabled) {
      activateKeepAwake();
    } else {
      deactivateKeepAwake();
    }
  }, [trafficEnabled, gpsEnabled, simulationEnabled]);

  useEffect(() => {
    let cancelled = false;
    if (!activeOwnship?.lat || !activeOwnship?.lon) {
      setDiversionCandidates([]);
      setDiversionLoading(false);
      setDiversionError(null);
      lastDiversionFetchRef.current = null;
      return;
    }
    if (
      shouldSkipPositionRefresh(
        lastDiversionFetchRef.current,
        { lat: activeOwnship.lat, lon: activeOwnship.lon },
        { minDistanceNm: 0.5, minIntervalMs: 45000 },
      )
    ) {
      return;
    }

    lastDiversionFetchRef.current = { lat: activeOwnship.lat, lon: activeOwnship.lon, at: Date.now() };
    setDiversionLoading(true);
    setDiversionError(null);
    api
      .get<NearbyDiversionResponse>('/api/airports/nearby', {
        params: {
          lat: activeOwnship.lat,
          lon: activeOwnship.lon,
          radiusNm: 60,
          limit: 5,
        },
      })
      .then((res) => {
        if (cancelled) return;
        const airports = Array.isArray(res.data?.airports) ? res.data.airports : [];
        setDiversionCandidates(airports);
        setSelectedDiversionIcao((current) => current || airports[0]?.icao || null);
        setDiversionLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setDiversionCandidates([]);
        setDiversionError(error?.response?.data?.error || 'Unable to load nearby diversion airports.');
        setDiversionLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeOwnship?.lat, activeOwnship?.lon]);

  useEffect(() => {
    if (!simulationEnabled) {
      setSimulationRunning(false);
      setSimulationProgress(0);
      setSimulatedGpsData(null);
      setSimulatedVerticalSpeedFpm(null);
      return;
    }
    if (routePoints.length < 2) {
      setSimulationEnabled(false);
      Alert.alert('Build a route first', 'Simulation needs a built route with at least a departure and destination.');
      return;
    }
    const initial = interpolateRouteOwnship(routePoints, 0, simulationCruiseKts, simulationAltitudeFt);
    setSimulationProgress(0);
    setSimulationRunning(true);
    setSimulatedGpsData(initial?.ownship || null);
    setSimulatedVerticalSpeedFpm(initial?.verticalSpeedFpm ?? null);
  }, [simulationEnabled, routePoints, simulationCruiseKts, simulationAltitudeFt]);

  useEffect(() => {
    if (!simulationEnabled || !simulationRunning || routePoints.length < 2) return;
    const legLengths = routePoints.slice(1).map((point, index) => greatCircleNm(routePoints[index], point));
    const totalRouteNm = legLengths.reduce((sum, value) => sum + value, 0);
    if (!totalRouteNm || !Number.isFinite(totalRouteNm)) return;

    const timer = setInterval(() => {
      setSimulationProgress((current) => {
        const nmPerSecond = (simulationCruiseKts * simulationMultiplier) / 3600;
        const next = Math.min(1, current + nmPerSecond / totalRouteNm);
        const frame = interpolateRouteOwnship(routePoints, next, simulationCruiseKts, simulationAltitudeFt);
        setSimulatedGpsData(frame?.ownship || null);
        setSimulatedVerticalSpeedFpm(frame?.verticalSpeedFpm ?? null);
        if (next >= 1) {
          setSimulationRunning(false);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [simulationEnabled, simulationRunning, routePoints, simulationCruiseKts, simulationMultiplier, simulationAltitudeFt]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedDiversionIcao) {
      setSelectedDiversionBriefing(null);
      setSelectedDiversionBriefingLoading(false);
      return;
    }
    setSelectedDiversionBriefingLoading(true);
    api
      .get<RunwayBriefingResponse>(`/api/airports/${selectedDiversionIcao}/runway-briefing`)
      .then((res) => {
        if (cancelled) return;
        setSelectedDiversionBriefing(res.data || null);
        setSelectedDiversionBriefingLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSelectedDiversionBriefing(null);
        setSelectedDiversionBriefingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDiversionIcao]);

  useEffect(() => {
    let cancelled = false;
    if (!terrainPathParam) {
      setTerrainProfile(null);
      setTerrainProfileLoading(false);
      return;
    }
    setTerrainProfileLoading(true);
    api
      .get<TerrainProfileResponse>('/api/aviation/terrain-profile', {
        params: { path: terrainPathParam, samples: 18 },
      })
      .then((res) => {
        if (cancelled) return;
        setTerrainProfile(res.data || null);
        setTerrainProfileLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setTerrainProfile(null);
        setTerrainProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [terrainPathParam]);

  useEffect(() => {
    let cancelled = false;
    if (!activeOwnship?.lat || !activeOwnship?.lon) {
      setObstacleScan(null);
      setObstacleScanLoading(false);
      lastObstacleFetchRef.current = null;
      return;
    }
    if (
      shouldSkipPositionRefresh(
        lastObstacleFetchRef.current,
        { lat: activeOwnship.lat, lon: activeOwnship.lon },
        { minDistanceNm: 0.25, minIntervalMs: 20000 },
      )
    ) {
      return;
    }
    lastObstacleFetchRef.current = { lat: activeOwnship.lat, lon: activeOwnship.lon, at: Date.now() };
    setObstacleScanLoading(true);
    api
      .get<NearbyObstacleResponse>('/api/aviation/obstacles/nearby', {
        params: {
          lat: activeOwnship.lat,
          lon: activeOwnship.lon,
          radiusNm: 18,
          limit: 15,
        },
      })
      .then((res) => {
        if (cancelled) return;
        setObstacleScan(res.data || null);
        setObstacleScanLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setObstacleScan(null);
        setObstacleScanLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeOwnship?.lat, activeOwnship?.lon]);

  useEffect(() => {
    let lastAlt: { alt: number; time: number } | null = null;
    if (!gpsEnabled) {
      locationSubRef.remove?.();
      setGpsStatus('idle');
      setGpsError(null);
      setGpsData(null);
      setVerticalSpeedFpm(null);
      return;
    }

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatus('error');
        setGpsError('Location permission denied.');
        setGpsEnabled(false);
        return;
      }
      setGpsStatus('listening');
      setGpsError(null);
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 2000,
          distanceInterval: 5,
        },
        (location) => {
          const speedKts = location.coords.speed ? location.coords.speed * 1.94384 : undefined;
          const altitudeFt = location.coords.altitude ? location.coords.altitude * 3.28084 : undefined;
          const heading = typeof location.coords.heading === 'number' ? location.coords.heading : undefined;
          setGpsData({
            lat: location.coords.latitude,
            lon: location.coords.longitude,
            altitudeFt,
            speedKts,
            heading,
          });
          if (altitudeFt) {
            const now = Date.now();
            if (lastAlt) {
              const delta = altitudeFt - lastAlt.alt;
              const minutes = (now - lastAlt.time) / 60000;
              if (minutes > 0) {
                setVerticalSpeedFpm(delta / minutes);
              }
            }
            lastAlt = { alt: altitudeFt, time: now };
          }
        }
      );
      locationSubRef.remove = subscription.remove;
    })().catch((err) => {
      setGpsStatus('error');
      setGpsError(String(err));
    });

    return () => {
      locationSubRef.remove?.();
    };
  }, [gpsEnabled]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.get('/api/aircraft/profiles')
      .then((res) => setProfiles(res.data || []))
      .catch(() => setProfiles([]));
  }, [isAuthenticated]);

  useEffect(() => {
    const value = departure.trim();
    const normalized = value.toUpperCase();
    if (!value || ICAO_REGEX.test(normalized)) {
      setDepartureSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/api/airports/search', { params: { q: value } });
        setDepartureSuggestions(res.data || []);
      } catch {
        setDepartureSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [departure]);

  useEffect(() => {
    const value = destination.trim();
    const normalized = value.toUpperCase();
    if (!value || ICAO_REGEX.test(normalized)) {
      setDestinationSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/api/airports/search', { params: { q: value } });
        setDestinationSuggestions(res.data || []);
      } catch {
        setDestinationSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [destination]);

  useEffect(() => {
    const dep = departure.trim().toUpperCase();
    const dest = destination.trim().toUpperCase();
    if (!ICAO_REGEX.test(dep) || !ICAO_REGEX.test(dest)) {
      setSuggestedWaypoints([]);
      setSuggestedStops([]);
      setSuggestionMeta(null);
      return;
    }

    const cruise = parseFloat(cruiseKtas) || 110;
    const burn = parseFloat(fuelBurnGph) || 8;
    const fuel = parseFloat(usableFuel) || 40;
    const reserve = parseFloat(reserveMinutes) || 45;
    const fuelBoard = parseFloat(fuelOnBoard || '');
    setSuggestionLoading(true);
    api.get('/api/airports/route-suggestions', {
      params: {
        departure: dep,
        destination: dest,
        cruiseKtas: cruise,
        fuelBurnGph: burn,
        usableFuelGal: fuel,
        reserveMinutes: reserve,
        fuelOnBoard: Number.isFinite(fuelBoard) ? fuelBoard : undefined,
      },
    })
      .then((res) => {
        setSuggestedWaypoints(res.data?.waypoints || []);
        setSuggestedStops(res.data?.plannedStops || []);
        if (res.data?.meta) {
          setSuggestionMeta({
            routeDistanceNm: res.data.meta.routeDistanceNm,
            maxLegNm: res.data.meta.maxLegNm,
          });
        } else {
          setSuggestionMeta(null);
        }
      })
      .catch(() => {
        setSuggestedWaypoints([]);
        setSuggestedStops([]);
        setSuggestionMeta(null);
      })
      .finally(() => setSuggestionLoading(false));
  }, [departure, destination, cruiseKtas, fuelBurnGph, usableFuel, reserveMinutes, fuelOnBoard]);

  const effectiveProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) || null,
    [profiles, selectedProfileId]
  );
  const activeAircraftLabel = useMemo(() => {
    if (effectiveProfile?.name) return effectiveProfile.name;
    if (selectedType) return `${selectedType.make} ${selectedType.model}`;
    return 'Custom aircraft';
  }, [effectiveProfile?.name, selectedType]);
  const routeHeadline = useMemo(() => {
    const dep = departure.trim().toUpperCase();
    const dest = destination.trim().toUpperCase();
    if (ICAO_REGEX.test(dep) && ICAO_REGEX.test(dest)) {
      return `${dep} to ${dest}`;
    }
    return 'Build your next route';
  }, [departure, destination]);

  useEffect(() => {
    if (effectiveProfile) {
      dispatchAircraftPerformance({ type: 'load_from_profile', value: effectiveProfile });
    }
  }, [effectiveProfile]);

  useEffect(() => {
    if (selectedType) {
      dispatchAircraftPerformance({ type: 'load_from_type', value: selectedType });
    }
  }, [selectedType]);

  const searchAircraft = async () => {
    if (!aircraftQuery.trim()) {
      setAircraftResults([]);
      return;
    }
    try {
      const res = await api.get('/api/aircraft/types', { params: { q: aircraftQuery.trim() } });
      setAircraftResults(res.data || []);
    } catch {
      setAircraftResults([]);
    }
  };

  const fetchWeather = async () => {
    const dep = departure.trim().toUpperCase();
    const dest = destination.trim().toUpperCase();
    if (!dep || !dest) {
      Alert.alert('Missing airports', 'Departure and destination are required.');
      return;
    }
    const wpList = waypoints
      .split(/[\s,]+/)
      .map((code) => code.trim().toUpperCase())
      .filter((code) => ICAO_REGEX.test(code));
    const stopList = plannedStops
      .split(/[\s,]+/)
      .map((code) => code.trim().toUpperCase())
      .filter((code) => ICAO_REGEX.test(code));
    const weatherCodes = Array.from(new Set([dep, ...stopList, ...wpList, dest]))
      .filter(Boolean)
      .slice(0, 8);

    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const results = await Promise.all(
        weatherCodes.map((icao) =>
          api.get(`/api/aviation-weather/${icao}`).then((res) => res.data).catch(() => null)
        )
      );
      const data = results.filter(Boolean) as WeatherResponse[];
      const depData = data.find((item) => item.icao?.toUpperCase() === dep) || null;
      const destData = data.find((item) => item.icao?.toUpperCase() === dest) || null;
      setDepartureWeather(depData);
      setDestinationWeather(destData);
      setEnrouteWeather(
        data.filter(
          (item) =>
            item.icao?.toUpperCase() !== dep && item.icao?.toUpperCase() !== dest
        )
      );
    } catch (error: any) {
      setWeatherError(error?.response?.data?.error || 'Unable to load weather.');
    } finally {
      setWeatherLoading(false);
    }
  };

  const buildRoute = async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    const dep = departure.trim().toUpperCase();
    const dest = destination.trim().toUpperCase();
    if (!dep || !dest) {
      if (!silent) {
        Alert.alert('Missing airports', 'Departure and destination are required.');
      }
      return;
    }
    const wpList = waypoints
      .split(/[\s,]+/)
      .map((code) => code.trim().toUpperCase())
      .filter((code) => ICAO_REGEX.test(code));
    const stopList = plannedStops
      .split(/[\s,]+/)
      .map((code) => code.trim().toUpperCase())
      .filter((code) => ICAO_REGEX.test(code));
    const codes = [dep, ...stopList, ...wpList, dest];
    setLoading(true);
    try {
      const airports: AirportMeta[] = [];
      for (const code of codes) {
        const res = await api.get(`/api/airports/${code}`);
        const payload = res.data || {};
        const latitude = Number(payload.latitude ?? payload.lat);
        const longitude = Number(payload.longitude ?? payload.lon);
        airports.push({
          icao: payload.icao || code,
          name: payload.name,
          latitude,
          longitude,
          timezone: payload.timezone ?? null,
        });
      }
      let routedAirports = airports;
      if (suggestedMode === 'midpoint' && wpList.length === 0 && stopList.length === 0 && airports.length >= 2) {
        const start = airports[0];
        const end = airports[airports.length - 1];
        const lat1 = toRad(start.latitude);
        const lon1 = toRad(start.longitude);
        const lat2 = toRad(end.latitude);
        const lon2 = toRad(end.longitude);
        const dLon = lon2 - lon1;
        const bx = Math.cos(lat2) * Math.cos(dLon);
        const by = Math.cos(lat2) * Math.sin(dLon);
        const lat3 = Math.atan2(
          Math.sin(lat1) + Math.sin(lat2),
          Math.sqrt((Math.cos(lat1) + bx) ** 2 + by ** 2)
        );
        const lon3 = lon1 + Math.atan2(by, Math.cos(lat1) + bx);
        const mid: AirportMeta = {
          icao: 'MID',
          latitude: (lat3 * 180) / Math.PI,
          longitude: (lon3 * 180) / Math.PI,
          name: 'Midpoint',
        };
        routedAirports = [start, mid, end];
      }
      const legs = routedAirports.slice(0, -1).map((airport, idx) => {
        const next = routedAirports[idx + 1];
        return {
          from: airport.icao,
          to: next.icao,
          nm: greatCircleNm(airport, next),
        };
      });
      const totalNm = legs.reduce((sum, leg) => sum + leg.nm, 0);
      setRouteSummary({ totalNm, legs });
      setRoutePoints(routedAirports);
      setDepartureTimeZone(airports[0]?.timezone || '');
      setDestinationTimeZone(airports[airports.length - 1]?.timezone || '');
    } catch (error: any) {
      if (!silent) {
        Alert.alert('Route error', error?.response?.data?.error || 'Unable to build route.');
      }
      if (!silent) {
        setRouteSummary(null);
        setRoutePoints([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const dep = departure.trim().toUpperCase();
    const dest = destination.trim().toUpperCase();
    if (!ICAO_REGEX.test(dep) || !ICAO_REGEX.test(dest)) return;
    const timer = setTimeout(() => {
      buildRoute({ silent: true });
    }, 700);
    return () => clearTimeout(timer);
  }, [departure, destination, waypoints, plannedStops, suggestedMode]);

  useEffect(() => {
    if (mapStyle !== 'winds') {
      setWindsAloftPoints([]);
      setWindsAloftMeta(null);
      setWindsAloftError(null);
      return;
    }

    const bboxSource = mapRegion
      ? buildBboxFromRegion(mapRegion)
      : buildBboxFromPoints(routePoints);

    if (!bboxSource) return;

    const bbox = `${bboxSource.south},${bboxSource.west},${bboxSource.north},${bboxSource.east}`;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/api/aviation/winds-temps', {
          params: { altitude: resolvedWindsAltitude, bbox },
        });
        if (cancelled) return;
        const payload = res.data || {};
        setWindsAloftPoints(Array.isArray(payload.stations) ? payload.stations : []);
        setWindsAloftMeta({
          altitudeFt: payload.altitudeFt ?? resolvedWindsAltitude,
          validTime: payload.validTime ?? null,
          warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
        });
        setWindsAloftError(null);
      } catch {
        if (cancelled) return;
        setWindsAloftPoints([]);
        setWindsAloftMeta(null);
        setWindsAloftError('Winds aloft data unavailable.');
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mapStyle, mapRegion, routePoints, windsAltitudeChoice, plannedAltitude]);

  useEffect(() => {
    if (!showClouds || showCloudsGlobal) {
      setCloudFrames([]);
      setCloudFrameIndex(0);
      setCloudError(null);
      return;
    }

    let isActive = true;
    api.get('/api/aviation/cloud-frames', { params: { source: cloudSource, count: 12, intervalMin: 10 } })
      .then((res) => {
        if (!isActive) return;
        const frames = Array.isArray(res.data?.frames) ? res.data.frames.filter(Boolean) : [];
        setCloudFrames(frames);
        setCloudFrameIndex(frames.length > 0 ? frames.length - 1 : 0);
        setCloudError(frames.length > 0 ? null : 'Cloud loop unavailable.');
      })
      .catch(() => {
        if (!isActive) return;
        setCloudFrames([]);
        setCloudFrameIndex(0);
        setCloudError('Cloud loop unavailable.');
      });

    return () => {
      isActive = false;
    };
  }, [mapStyle, mapRegion?.latitude, mapRegion?.longitude, mapRegion?.latitudeDelta, mapRegion?.longitudeDelta]);

  useEffect(() => {
    if (!showClouds || cloudFrames.length === 0) {
      if (cloudTimerRef.current) {
        clearInterval(cloudTimerRef.current);
        cloudTimerRef.current = null;
      }
      return;
    }

    if (cloudTimerRef.current) {
      clearInterval(cloudTimerRef.current);
    }

    cloudTimerRef.current = setInterval(() => {
      setCloudFrameIndex((prev) => (prev + 1) % cloudFrames.length);
    }, 1200);

    return () => {
      if (cloudTimerRef.current) {
        clearInterval(cloudTimerRef.current);
        cloudTimerRef.current = null;
      }
    };
  }, [mapStyle, cloudFrames.length]);

  const visibleWindsPoints = useMemo(() => {
    if (mapStyle !== 'winds') return [] as WindsAloftPoint[];
    const delta = mapRegion?.latitudeDelta ?? 8;
    if (delta > 20) return windsAloftPoints.filter((_, index) => index % 4 === 0);
    if (delta > 12) return windsAloftPoints.filter((_, index) => index % 3 === 0);
    if (delta > 8) return windsAloftPoints.filter((_, index) => index % 2 === 0);
    return windsAloftPoints;
  }, [mapStyle, mapRegion, windsAloftPoints]);

  const cruise = parseFloat(cruiseKtas) || 0;
  const burn = parseFloat(fuelBurnGph) || 0;
  const reserve = parseFloat(reserveMinutes) || 0;
  const wind = parseFloat(headwind) || 0;
  const totalNm = routeSummary?.totalNm || 0;
  const effectiveSpeed = Math.max(cruise - wind, 1);
  const eteHours = effectiveSpeed > 0 ? totalNm / effectiveSpeed : 0;
  const fuelRequired = eteHours * burn;
  const totalFuel = fuelRequired + (burn * (reserve / 60));
  const eteMinutes = eteHours ? Math.round(eteHours * 60) : 0;
  const plannedAltitudeFt = parseFloat(plannedAltitude);
  const plannedAltitudeValue = Number.isFinite(plannedAltitudeFt) ? plannedAltitudeFt : undefined;
  const windsAltitudeFt = windsAltitudeChoice === 'planned'
    ? plannedAltitudeValue
    : Number(windsAltitudeChoice);
  const resolvedWindsAltitude = resolveWindsAltitude(windsAltitudeFt ?? null);
  const showClouds = mapStyle === 'clouds';
  const gibsDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const isConus = Boolean(mapRegion && isWithinConus(mapRegion.latitude, mapRegion.longitude));
  const isAlaska = Boolean(mapRegion && isWithinAlaska(mapRegion.latitude, mapRegion.longitude));
  const isHawaii = Boolean(mapRegion && isWithinHawaii(mapRegion.latitude, mapRegion.longitude));
  const cloudSource = (isAlaska || isHawaii) ? 'goes-west' : 'goes-east';
  const showCloudsGlobal = Boolean(
    mapRegion && (
      mapRegion.longitudeDelta > 60 ||
      mapRegion.latitudeDelta > 30 ||
      (!isConus && !isAlaska && !isHawaii)
    )
  );
  const cloudTileUrl = cloudFrames.length > 0
    ? `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${cloudSource === 'goes-west' ? 'GOES-West_ABI_GeoColor' : 'GOES-East_ABI_GeoColor'}/default/${encodeURIComponent(cloudFrames[cloudFrameIndex])}/GoogleMapsCompatible_Level4/{z}/{y}/{x}.jpg`
    : '';
  const cloudTimeLabel = formatCloudTimeLabel(cloudFrames[cloudFrameIndex]);
  const resolvedDepartureTimeZone = normalizeTimeZone(departureTimeZone || deviceTimeZone);
  const resolvedDestinationTimeZone = normalizeTimeZone(destinationTimeZone || deviceTimeZone);
  const plannedDepartureUtc = useMemo(() => {
    if (!plannedDepartureAt) return null;
    return zonedDateTimeToUtc(plannedDepartureAt, resolvedDepartureTimeZone);
  }, [plannedDepartureAt, resolvedDepartureTimeZone]);
  const hoursToDeparture = useMemo(() => {
    if (!plannedDepartureUtc) return null;
    return (plannedDepartureUtc.getTime() - Date.now()) / 3600000;
  }, [plannedDepartureUtc]);
  const forecastNotice = useMemo(() => {
    if (!hoursToDeparture || hoursToDeparture <= 24) return null;
    const days = hoursToDeparture / 24;
    if (days > 10) {
      return `Planned departure is ${days.toFixed(1)} days out. Long-range forecasts are limited; recheck weather 24 hours and day-of.`;
    }
    if (days > 3) {
      return `Planned departure is about ${Math.round(days)} days out. TAFs cover ~24–30 hours; recheck the night before and day-of.`;
    }
    return `Planned departure is about ${Math.round(hoursToDeparture)} hours out. Recheck weather within 24 hours of departure.`;
  }, [hoursToDeparture]);
  const altitudeRisks = useMemo(() => {
    if (!Number.isFinite(plannedAltitudeFt) || plannedAltitudeFt <= 0) return [];
    const risks: string[] = [];
    if (plannedAltitudeFt >= 18000) risks.push('Flight levels require IFR clearance planning.');
    if (plannedAltitudeFt >= 12500) risks.push('Oxygen required above 12,500 ft MSL for more than 30 minutes.');
    if (plannedAltitudeFt >= 14000) risks.push('Oxygen required for crew above 14,000 ft MSL.');
    if (plannedAltitudeFt >= 15000) risks.push('Passengers require oxygen above 15,000 ft MSL.');
    if (wind >= 25) risks.push(`Headwind ${wind} kt may increase fuel burn at altitude.`);
    risks.push('Review AIRMET/SIGMETs and turbulence or icing layers.');
    if (mapStyle !== 'winds') risks.push('Check the Winds Aloft overlay for upper-level flow and turbulence hints.');
    return risks;
  }, [plannedAltitudeFt, wind, mapStyle]);

  useEffect(() => {
    if (!arrivalAuto || !plannedDepartureAt || !eteMinutes) return;
    const departureUtc = zonedDateTimeToUtc(plannedDepartureAt, resolvedDepartureTimeZone);
    if (!departureUtc) return;
    const arrivalUtc = new Date(departureUtc.getTime() + eteMinutes * 60000);
    const arrivalLocal = formatDateTimeLocal(arrivalUtc, resolvedDestinationTimeZone);
    setPlannedArrivalAt(arrivalLocal);
  }, [arrivalAuto, plannedDepartureAt, eteMinutes, resolvedDepartureTimeZone, resolvedDestinationTimeZone]);
  const depCategory = parseFlightCategory(departureWeather?.metar);
  const destCategory = parseFlightCategory(destinationWeather?.metar);
  const allWeather = [
    ...(departureWeather ? [departureWeather] : []),
    ...enrouteWeather,
    ...(destinationWeather ? [destinationWeather] : []),
  ];
  const primaryIcao = departure.trim().toUpperCase();
  const hasPrimaryIcao = ICAO_REGEX.test(primaryIcao);
  const hasIfrWeather = useMemo(
    () => allWeather.some((item) => {
      const category = parseFlightCategory(item?.metar);
      return category === 'IFR' || category === 'LIFR';
    }),
    [allWeather]
  );
  const hasThunderRisk = useMemo(
    () => allWeather.some((item) => hasThunder(item?.taf)),
    [allWeather]
  );
  const summaryCategoryLabel = useMemo(() => {
    if (allWeather.length === 0) return 'No METARs yet';
    if (hasIfrWeather) return 'IFR/LIFR risk';
    return 'VFR/MVFR trend';
  }, [allWeather.length, hasIfrWeather]);
  const enrouteFindings = enrouteWeather.map((item) => ({
    icao: item.icao?.toUpperCase() || '',
    category: parseFlightCategory(item.metar),
    thunder: hasThunder(item.taf),
  }));
  const enrouteIfr = enrouteFindings
    .filter((item) => item.category === 'IFR' || item.category === 'LIFR')
    .map((item) => item.icao);
  const enrouteTs = enrouteFindings.filter((item) => item.thunder).map((item) => item.icao);
  const routeRiskLabel = useMemo(() => {
    let hasIfr = false;
    let hasTs = false;
    allWeather.forEach((item) => {
      const category = parseFlightCategory(item?.metar);
      if (category === 'IFR' || category === 'LIFR') hasIfr = true;
      if (hasThunder(item?.taf)) hasTs = true;
    });
    if (hasIfr && hasTs) return 'IFR + Thunderstorms';
    if (hasTs) return 'Thunderstorms';
    if (hasIfr) return 'IFR Conditions';
    return 'Normal';
  }, [allWeather]);

  const routeVariationNotes = useMemo(() => {
    const notes: string[] = [];
    if (enrouteIfr.length > 0) {
      notes.push(`IFR/LIFR enroute: ${enrouteIfr.join(', ')}`);
    }
    if (enrouteTs.length > 0) {
      notes.push(`Thunderstorms flagged enroute: ${enrouteTs.join(', ')}`);
    }
    return notes;
  }, [enrouteIfr, enrouteTs]);

  useEffect(() => {
    if (!mapRef.current || routePoints.length < 2) return;
    const coords = routePoints.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 60, bottom: 60, left: 60, right: 60 },
      animated: true,
    });
  }, [routePoints]);

  useEffect(() => {
    if (!isFlightDeck || mapStyle !== 'standard') return;
    setMapStyle('sectional');
  }, [isFlightDeck, mapStyle]);

  useEffect(() => {
    if (!isFlightDeck || flightDeckView !== 'map' || !activeOwnship || !mapRef.current) return;
    const speedKts = activeOwnship.speedKts ?? simulationCruiseKts;
    const latitudeDelta = speedKts >= 160 ? 0.28 : speedKts >= 110 ? 0.22 : 0.16;
    const longitudeDelta = speedKts >= 160 ? 0.22 : speedKts >= 110 ? 0.18 : 0.14;
    mapRef.current.animateToRegion(
      {
        latitude: activeOwnship.lat,
        longitude: activeOwnship.lon,
        latitudeDelta,
        longitudeDelta,
      },
      450,
    );
  }, [activeOwnship?.heading, activeOwnship?.lat, activeOwnship?.lon, activeOwnship?.speedKts, flightDeckView, isFlightDeck, simulationCruiseKts]);

  useEffect(() => {
    if (!routePoints.length && !hasPrimaryIcao) return;

    const bboxSource = buildBboxFromPoints(routePoints);
    const bbox = bboxSource
      ? `${bboxSource.south},${bboxSource.west},${bboxSource.north},${bboxSource.east}`
      : null;

    const countHazards = (payload: any) => {
      if (!payload) return 0;
      const count = (value: any) => {
        if (Array.isArray(value)) return value.length;
        if (Array.isArray(value?.features)) return value.features.length;
        return 0;
      };
      return count(payload.airsigmet) + count(payload.gairmet) + count(payload.airmet) + count(payload.tcf);
    };

    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError(null);

    const requests: Promise<any>[] = [];

    if (bbox) {
      requests.push(api.get('/api/aviation/winds-temps', { params: { altitude: resolvedWindsAltitude, bbox } }));
    } else {
      requests.push(Promise.resolve({ data: { stations: [] } }));
    }

    if (hasPrimaryIcao) {
      requests.push(api.get(`/api/aviation/pireps?icao=${primaryIcao}&radiusNm=150&ageHours=4`));
      requests.push(api.get(`/api/notams/${primaryIcao}`));
    } else {
      requests.push(Promise.resolve({ data: { reports: [] } }));
      requests.push(Promise.resolve({ data: { notams: [] } }));
    }

    requests.push(api.get('/api/aviation/hazards?hazard=conv'));
    requests.push(api.get('/api/aviation/hazards?hazard=ice'));
    requests.push(api.get('/api/aviation/hazards?hazard=turb'));

    Promise.all(requests)
      .then((responses) => {
        if (cancelled) return;
        const windsPayload = responses[0]?.data;
        const pirepsPayload = responses[1]?.data;
        const notamsPayload = responses[2]?.data;
        const convPayload = responses[3]?.data;
        const icingPayload = responses[4]?.data;
        const turbPayload = responses[5]?.data;

        setSummaryCounts({
          winds: Array.isArray(windsPayload?.stations) ? windsPayload.stations.length : 0,
          notams: Array.isArray(notamsPayload?.notams) ? notamsPayload.notams.length : 0,
          pireps: Array.isArray(pirepsPayload?.reports) ? pirepsPayload.reports.length : 0,
          convective: countHazards(convPayload),
          icing: countHazards(icingPayload),
          turbulence: countHazards(turbPayload),
        });
        setSummaryLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setSummaryError(error?.response?.data?.error || 'Unable to load summary data.');
        setSummaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [routePoints, departure, windsAltitudeChoice, plannedAltitude]);

  const flightDeckState = {
    insets,
    navigation,
    departure,
    destination,
    waypoints,
    plannedStops,
    plannedAltitude,
    cruiseKtas,
    routeHeadline,
    flightDeckSessionState,
    routeProgress,
    flightDeckView,
    flightDeckChromeVisible,
    flightDeckDrawerOpen,
    terrainRisk,
    visionRouteGuidance,
    visionTerrainColumns,
    visionDirectorCue,
    visionVerticalCueLabel,
    visionGuidance,
    terrainEscapeGuidance,
    visionTrafficCue,
    visionObstacleCues,
    terrainClearanceFt,
    terrainProfileLoading,
    obstacleRisk,
    obstacleClearanceFt,
    obstacleScanLoading,
    selectedTrafficTarget,
    visionManeuverRecommendation,
    mapRef,
    mapStyle,
    routePoints,
    activeOwnship,
    showCloudsGlobal,
    gibsDate,
    cloudTileUrl,
    cloudFrameIndex,
    visibleWindsPoints,
    selectedDiversionPoint,
    selectedDiversionIcao,
    diversionCandidates,
    visibleTrafficTargets,
    selectedDiversion,
    selectedDiversionRunwaySummary,
    selectedDiversionBestComm,
    selectedTrafficTrend,
    mapTacticalSummary,
    flightDeckTargetAltitudeFt,
    flightDeckVisibleAlert,
    flightDeckLowerStackBottom,
    flightDeckTrafficCardVisible,
    flightDeckDiversionCardVisible,
    flightDeckActionButtons,
    flightDeckHudExpanded,
    activeVerticalSpeedFpm,
    immediateTrafficCount,
    routeRiskLabel,
    flightDeckPanel,
    simulationEnabled,
    gpsEnabled,
    trafficEnabled,
    isSuperAdmin,
    simulationProgress,
    simulationSpeed,
    simulationConflictEnabled,
    summaryCounts,
    topTrafficTarget,
    trafficPanelTargets,
    diversionPanelAirports,
    terrainProfile,
    obstacleScan,
    selectedDiversionBriefingLoading,
    selectedDiversionBriefing,
    flightDeckCommandBankDeg,
    flightDeckBankTicks,
    trafficFilter,
    formatAltitudeDelta,
  };

  const flightDeckActions = {
    pulseFlightDeckChrome,
    toggleFlightDeckView,
    toggleFlightDeckHud,
    setMapRegion,
    setSelectedDiversionIcao,
    setSelectedTrafficId,
    setFlightDeckDrawerOpen,
    setFlightDeckPanel,
    setTrafficEnabled,
    setGpsEnabled,
    setSimulationEnabled,
    setSimulationSpeed,
    setSimulationConflictEnabled,
    setMapStyle,
    setTrafficFilter,
    focusDiversionAirport,
    engageDirectToDiversion,
    focusTrafficTarget,
    setAlternate,
  };

  if (isFlightDeck) {
    return (
      <FlightDeckView state={flightDeckState} actions={flightDeckActions} styles={styles} />
    );

  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top, spacing.sm), paddingBottom: 120 + insets.bottom },
      ]}
    >
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>RSF FLIGHT PLANNER</Text>
            <Text style={styles.heroTitle}>{routeHeadline}</Text>
            <Text style={styles.heroSubtitle}>
              Map-first planning with live weather, receiver-aware cockpit context, and filing-ready route review.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Mobile flagship</Text>
          </View>
        </View>

        <View style={styles.heroMetricRow}>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricLabel}>Aircraft</Text>
            <Text style={styles.heroMetricValue}>{activeAircraftLabel}</Text>
          </View>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricLabel}>Route</Text>
            <Text style={styles.heroMetricValue}>
              {routeSummary ? `${routeSummary.totalNm.toFixed(0)} NM` : 'Not built'}
            </Text>
          </View>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricLabel}>Live status</Text>
            <Text style={styles.heroMetricValue}>
              {simulationEnabled ? 'Simulating' : gpsEnabled || trafficEnabled ? 'Cockpit on' : 'Preflight'}
            </Text>
          </View>
        </View>
        <View style={styles.heroMetricRow}>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricLabel}>Weather watch</Text>
            <Text style={styles.heroMetricValue}>{routeRiskLabel}</Text>
          </View>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricLabel}>ETA / ETE</Text>
            <Text style={styles.heroMetricValue}>
              {routeProgress?.etaText || routeSummary ? 'Active' : 'Pending'}
            </Text>
          </View>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricLabel}>Hazard flags</Text>
            <Text style={styles.heroMetricValue}>
              {routeVariationNotes.length > 0 ? `${routeVariationNotes.length} notes` : 'Clear'}
            </Text>
          </View>
        </View>

        <View style={styles.heroActionRow}>
          <TouchableOpacity style={styles.heroPrimaryAction} onPress={() => void buildRoute()} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.heroPrimaryActionText}>Build route</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.heroSecondaryAction}
            onPress={() => navigation?.navigate?.('FlightDeck', {
              departure,
              destination,
              waypoints,
              plannedStops,
              plannedAltitude,
              cruiseKtas,
              mode: 'flight',
            })}
          >
            <Text style={styles.heroSecondaryActionText}>Flight Deck</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Route Builder</Text>
        <Text style={styles.sectionSubtitle}>Enter ICAO codes or city/state to find airports.</Text>

        <Text style={styles.fieldLabel}>Departure</Text>
        <Text style={styles.fieldHelper}>Example: KAUS or Austin, TX</Text>
        <TextInput style={styles.input} value={departure} onChangeText={setDeparture} placeholder="Departure (ICAO or city/state)" />
        {departureSuggestions.length > 0 && (
          <View style={styles.suggestionList}>
            {departureSuggestions.slice(0, 6).map((airport) => (
              <TouchableOpacity
                key={`${airport.icao}-${airport.name || ''}`}
                style={styles.suggestionItem}
                onPress={() => {
                  setDeparture(airport.icao);
                  setDepartureSuggestions([]);
                }}
              >
                <Text style={styles.suggestionItemText}>
                  {airport.icao} {airport.name ? `* ${airport.name}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.fieldLabel}>Destination</Text>
        <Text style={styles.fieldHelper}>Example: KDAL or Dallas, TX</Text>
        <TextInput style={styles.input} value={destination} onChangeText={setDestination} placeholder="Destination (ICAO or city/state)" />
        {destinationSuggestions.length > 0 && (
          <View style={styles.suggestionList}>
            {destinationSuggestions.slice(0, 6).map((airport) => (
              <TouchableOpacity
                key={`${airport.icao}-${airport.name || ''}`}
                style={styles.suggestionItem}
                onPress={() => {
                  setDestination(airport.icao);
                  setDestinationSuggestions([]);
                }}
              >
                <Text style={styles.suggestionItemText}>
                  {airport.icao} {airport.name ? `* ${airport.name}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.fieldLabel}>Waypoints (optional)</Text>
        <Text style={styles.fieldHelper}>Space or comma separated ICAO codes.</Text>
        <TextInput
          style={styles.input}
          value={waypoints}
          onChangeText={setWaypoints}
          placeholder="Example: KACT KTYR"
        />

        <Text style={styles.fieldLabel}>Planned fuel stops (optional)</Text>
        <Text style={styles.fieldHelper}>Add airports for fuel or rest stops.</Text>
        <TextInput
          style={styles.input}
          value={plannedStops}
          onChangeText={setPlannedStops}
          placeholder="Example: KGLS"
        />

        {suggestionLoading && (
          <Text style={styles.helperText}>Calculating suggested waypoints and stops...</Text>
        )}
        {suggestedWaypoints.length > 0 && (
          <View style={styles.suggestionBox}>
            <Text style={styles.suggestionTitle}>Suggested waypoints</Text>
            <View style={styles.pillRow}>
              {suggestedWaypoints.map((icao) => (
                <View key={`wp-${icao}`} style={styles.pill}>
                  <Text style={styles.pillText}>{icao}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setWaypoints(suggestedWaypoints.join(' '))}
            >
              <Text style={styles.secondaryButtonText}>
                {waypoints.trim().length > 0 ? 'Replace with suggested' : 'Use suggested'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {suggestedStops.length > 0 && (
          <View style={styles.suggestionBox}>
            <Text style={styles.suggestionTitle}>Suggested fuel stops</Text>
            <View style={styles.pillRow}>
              {suggestedStops.map((icao) => (
                <View key={`stop-${icao}`} style={styles.pill}>
                  <Text style={styles.pillText}>{icao}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setPlannedStops(suggestedStops.join(' '))}
            >
              <Text style={styles.secondaryButtonText}>
                {plannedStops.trim().length > 0 ? 'Replace with suggested' : 'Use suggested'}
              </Text>
            </TouchableOpacity>
            {suggestionMeta && (
              <Text style={styles.helperText}>
                Max leg ~{suggestionMeta.maxLegNm.toFixed(0)} NM based on current fuel assumptions.
              </Text>
            )}
          </View>
        )}

        <Text style={styles.fieldLabel}>Alternate (optional)</Text>
        <TextInput style={styles.input} value={alternate} onChangeText={setAlternate} placeholder="Alternate airport" />

        <Text style={styles.fieldLabel}>Tail Number (optional)</Text>
        <TextInput style={styles.input} value={tailNumber} onChangeText={setTailNumber} placeholder="N12345" />

        <Text style={styles.fieldLabel}>Fuel on board (gal)</Text>
        <TextInput style={styles.input} value={fuelOnBoard} onChangeText={setFuelOnBoard} placeholder="Example: 40" keyboardType="numeric" />

        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes or route details"
          multiline
        />
        <View style={styles.suggestionBox}>
          <Text style={styles.suggestionTitle}>Suggested routes</Text>
          <Text style={styles.suggestionText}>Midpoint adds a virtual waypoint for planning only.</Text>
          <View style={styles.suggestionRow}>
            <TouchableOpacity
              style={[styles.suggestionButton, suggestedMode === 'direct' && styles.suggestionButtonActive]}
              onPress={() => setSuggestedMode('direct')}
            >
              <Text style={styles.suggestionButtonText}>Direct</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.suggestionButton, suggestedMode === 'midpoint' && styles.suggestionButtonActive]}
              onPress={() => setSuggestedMode('midpoint')}
              disabled={waypoints.trim().length > 0 || plannedStops.trim().length > 0}
            >
              <Text style={styles.suggestionButtonText}>Add midpoint</Text>
            </TouchableOpacity>
          </View>
          {(waypoints.trim().length > 0 || plannedStops.trim().length > 0) && (
            <Text style={styles.suggestionHint}>Midpoint is disabled when custom waypoints or stops are entered.</Text>
          )}
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={() => void buildRoute()} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Build Route</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={fetchWeather} disabled={weatherLoading}>
          {weatherLoading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.secondaryButtonText}>Check Weather</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.mapHeader}>
          <Text style={styles.sectionTitle}>Route Map</Text>
          <View style={styles.mapToggleRow}>
            <TouchableOpacity
              style={[styles.mapToggleButton, mapStyle === 'standard' && styles.mapToggleActive]}
              onPress={() => setMapStyle('standard')}
            >
              <Text style={styles.mapToggleText}>Standard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mapToggleButton, mapStyle === 'sectional' && styles.mapToggleActive]}
              onPress={() => setMapStyle('sectional')}
            >
              <Text style={styles.mapToggleText}>Sectional (FAA)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mapToggleButton, mapStyle === 'terrain' && styles.mapToggleActive]}
              onPress={() => setMapStyle('terrain')}
            >
              <Text style={styles.mapToggleText}>Terrain</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mapToggleButton, mapStyle === 'radar' && styles.mapToggleActive]}
              onPress={() => setMapStyle('radar')}
            >
              <Text style={styles.mapToggleText}>Radar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mapToggleButton, mapStyle === 'clouds' && styles.mapToggleActive]}
              onPress={() => setMapStyle('clouds')}
            >
              <Text style={styles.mapToggleText}>Clouds</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mapToggleButton, mapStyle === 'winds' && styles.mapToggleActive]}
              onPress={() => setMapStyle('winds')}
            >
              <Text style={styles.mapToggleText}>Winds Aloft</Text>
            </TouchableOpacity>
          </View>
        </View>
        {mapStyle === 'winds' && (
          <View style={styles.altitudeRow}>
            <TouchableOpacity
              style={[styles.altitudeButton, windsAltitudeChoice === 'planned' && styles.altitudeButtonActive]}
              onPress={() => setWindsAltitudeChoice('planned')}
            >
              <Text style={[styles.altitudeText, windsAltitudeChoice === 'planned' && styles.altitudeTextActive]}>Planned</Text>
            </TouchableOpacity>
            {WINDS_ALOFT_LEVELS.map((altitude) => (
              <TouchableOpacity
                key={`alt-${altitude}`}
                style={[styles.altitudeButton, windsAltitudeChoice === String(altitude) && styles.altitudeButtonActive]}
                onPress={() => setWindsAltitudeChoice(String(altitude))}
              >
                <Text style={[styles.altitudeText, windsAltitudeChoice === String(altitude) && styles.altitudeTextActive]}>
                  {altitude.toLocaleString()} ft
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <TouchableOpacity style={styles.helpLink} onPress={() => navigation.navigate('ReceiverHelp')}>
          <Ionicons name="help-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.helpLinkText}>How to connect your ADS‑B receiver</Text>
        </TouchableOpacity>
        <View style={styles.trafficRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Live Traffic (ADS-B)</Text>
            <Text style={styles.helperText}>Connect to onboard receiver (GDL-90 compatible).</Text>
          </View>
          <TouchableOpacity
            style={[styles.mapToggleButton, trafficEnabled && styles.mapToggleActive]}
            onPress={() => {
              const enabled = !trafficEnabled;
              setTrafficEnabled(enabled);
              if (!enabled) {
                trafficListenerRef.stop?.();
                setTrafficStatus('idle');
                setTrafficTargets([]);
                return;
              }
              setTrafficError(null);
              setTrafficStatus('listening');
              const port = Math.max(1, Math.min(65535, Number(trafficPort) || 4000));
              const listener = createGdl90Listener(
                port,
                (target) => {
                  setTrafficTargets((prev) => {
                    const next = prev.filter((t) => Date.now() - t.updatedAt < 2 * 60 * 1000);
                    const existingIndex = next.findIndex((t) => t.id === target.id);
                    if (existingIndex >= 0) {
                      next[existingIndex] = target;
                      return [...next];
                    }
                    return [...next, target];
                  });
                },
                (err) => {
                  setTrafficStatus('error');
                  setTrafficError(String(err));
                }
              );
              trafficListenerRef.stop = listener.stop;
              listener.start();
            }}
          >
            <Text style={styles.mapToggleText}>{trafficEnabled ? 'On' : 'Off'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.trafficRow}>
          <TextInput
            style={[styles.input, styles.portInput]}
            value={trafficPort}
            onChangeText={setTrafficPort}
            keyboardType="numeric"
            placeholder="Port"
          />
          <Text style={styles.helperText}>Default ports: 4000 / 49002</Text>
        </View>
        <View style={styles.altitudeRow}>
          {[
            ['all', 'All'],
            ['conflict', 'Conflict'],
            ['above', 'Above'],
            ['below', 'Below'],
          ].map(([value, label]) => (
            <TouchableOpacity
              key={value}
              style={[styles.altitudeButton, trafficFilter === value && styles.altitudeButtonActive]}
              onPress={() => setTrafficFilter(value as 'all' | 'conflict' | 'above' | 'below')}
            >
              <Text style={[styles.altitudeText, trafficFilter === value && styles.altitudeTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {!!immediateTrafficCount && (
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>Immediate traffic</Text>
            <Text style={styles.alertText}>
              {immediateTrafficCount} nearby target{immediateTrafficCount === 1 ? '' : 's'} in the conflict band.
            </Text>
          </View>
        )}
        <View style={styles.trafficRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Device GPS (fallback)</Text>
            <Text style={styles.helperText}>Uses phone GPS for altitude and speed if ADS‑B not available.</Text>
          </View>
          <TouchableOpacity
            style={[styles.mapToggleButton, gpsEnabled && styles.mapToggleActive]}
            onPress={() => setGpsEnabled((prev) => !prev)}
            disabled={simulationEnabled}
          >
            <Text style={styles.mapToggleText}>{gpsEnabled ? 'On' : 'Off'}</Text>
          </TouchableOpacity>
        </View>
        {isSuperAdmin && (
          <View style={styles.simCard}>
            <View style={styles.trafficRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Flight Simulation</Text>
                <Text style={styles.helperText}>Super Admin test mode for route progress, diversions, and cockpit UI.</Text>
              </View>
              <TouchableOpacity
                style={[styles.mapToggleButton, simulationEnabled && styles.mapToggleActive]}
                onPress={() => {
                  if (!simulationEnabled && routePoints.length < 2) {
                    Alert.alert('Build a route first', 'Simulation needs a built route before it can run.');
                    return;
                  }
                  setSimulationEnabled((prev) => !prev);
                }}
              >
                <Text style={styles.mapToggleText}>{simulationEnabled ? 'On' : 'Off'}</Text>
              </TouchableOpacity>
            </View>
            {simulationEnabled ? (
              <>
                <View style={styles.altitudeRow}>
                  {(['1x', '4x', '8x'] as const).map((value) => (
                    <TouchableOpacity
                      key={`sim-${value}`}
                      style={[styles.altitudeButton, simulationSpeed === value && styles.altitudeButtonActive]}
                      onPress={() => setSimulationSpeed(value)}
                    >
                      <Text style={[styles.altitudeText, simulationSpeed === value && styles.altitudeTextActive]}>{value}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.simActionRow}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => setSimulationRunning((prev) => !prev)}
                  >
                    <Text style={styles.secondaryButtonText}>{simulationRunning ? 'Pause sim' : 'Resume sim'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      const frame = interpolateRouteOwnship(routePoints, 0, simulationCruiseKts, simulationAltitudeFt);
                      setSimulationProgress(0);
                      setSimulationRunning(true);
                      setSimulatedGpsData(frame?.ownship || null);
                      setSimulatedVerticalSpeedFpm(frame?.verticalSpeedFpm ?? null);
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>Reset sim</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.helperText}>
                  {Math.round(simulationProgress * 100)}% complete · {simulationSpeed} playback
                </Text>
              </>
            ) : null}
          </View>
        )}
        {gpsStatus === 'error' && gpsError && (
          <Text style={styles.errorText}>GPS error: {gpsError}</Text>
        )}
        {trafficStatus === 'error' && trafficError && (
          <Text style={styles.errorText}>Traffic error: {trafficError}</Text>
        )}
        {routePoints.length > 0 ? (
          <MapView
            style={styles.map}
            ref={mapRef}
            mapType="standard"
            initialRegion={{
              latitude: routePoints[0].latitude,
              longitude: routePoints[0].longitude,
              latitudeDelta: 3,
              longitudeDelta: 3,
            }}
            onRegionChangeComplete={(region) => setMapRegion(region)}
          >
            {mapStyle === 'sectional' && (
              <UrlTile
                urlTemplate="https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}"
                maximumZ={12}
                minimumZ={6}
                tileSize={256}
                opacity={0.85}
                zIndex={600}
              />
            )}
            {mapStyle === 'terrain' && (
              <UrlTile
                urlTemplate="https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}"
                maximumZ={15}
                minimumZ={4}
                tileSize={256}
                opacity={0.85}
                zIndex={600}
              />
            )}
            {mapStyle === 'radar' && (
              <UrlTile
                urlTemplate="https://nowcoast.noaa.gov/arcgis/rest/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer/tile/{z}/{y}/{x}"
                maximumZ={11}
                minimumZ={4}
                tileSize={256}
                opacity={0.75}
                zIndex={600}
              />
            )}
            {mapStyle === 'clouds' && showCloudsGlobal && (
              <UrlTile
                urlTemplate={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`}
                maximumZ={9}
                minimumZ={2}
                tileSize={256}
                opacity={0.75}
                zIndex={600}
              />
            )}
            {mapStyle === 'clouds' && !showCloudsGlobal && cloudTileUrl && (
              <UrlTile
                key={`clouds-${cloudFrameIndex}`}
                urlTemplate={cloudTileUrl}
                maximumZ={8}
                minimumZ={3}
                tileSize={256}
                opacity={0.75}
                zIndex={600}
              />
            )}
            {mapStyle === 'clouds' && !showCloudsGlobal && !cloudTileUrl && (
              <UrlTile
                urlTemplate={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`}
                maximumZ={9}
                minimumZ={2}
                tileSize={256}
                opacity={0.75}
                zIndex={600}
              />
            )}
            {mapStyle === 'winds' && (
              <>
                {visibleWindsPoints.map((point, index) => {
                  if (point.windDir === null || point.windSpeed === null) return null;
                  const size = Math.min(26, Math.max(14, Math.round(point.windSpeed / 3) + 12));
                  const rotation = (point.windDir + 180) % 360;
                  return (
                    <Marker
                      key={`${point.stationId}-${point.lat}-${point.lon}-${index}`}
                      coordinate={{ latitude: point.lat, longitude: point.lon }}
                      anchor={{ x: 0.5, y: 0.5 }}
                    >
                      <View style={[styles.windMarker, { transform: [{ rotate: `${rotation}deg` }] }]}>
                        <Ionicons name="arrow-up" size={size} color="#0284c7" />
                      </View>
                      <Callout>
                        <Text style={styles.calloutText}>
                          {point.icao || point.stationId}: {Math.round(point.windDir)} deg / {Math.round(point.windSpeed)} kt
                          {point.tempC !== null ? `, ${point.tempC}C` : ''}
                        </Text>
                      </Callout>
                    </Marker>
                  );
                })}
              </>
            )}
            <Polyline
              coordinates={routePoints.map((point) => ({ latitude: point.latitude, longitude: point.longitude }))}
              strokeColor="#0ea5e9"
              strokeWidth={3}
            />
            {visibleTrafficTargets.map((target) => (
              <Marker
                key={target.id}
                coordinate={{ latitude: target.lat, longitude: target.lon }}
                title={target.callsign || 'Traffic'}
                description={`${target.distanceNm.toFixed(1)} NM${target.altitudeFt ? ` • ${target.altitudeFt} ft` : ''}`}
                pinColor={target.threatLevel === 'immediate' ? '#dc2626' : target.threatLevel === 'advisory' ? '#f97316' : '#eab308'}
              />
            ))}
            {activeOwnship ? (
              <Marker
                coordinate={{ latitude: activeOwnship.lat, longitude: activeOwnship.lon }}
                anchor={{ x: 0.5, y: 0.5 }}
                title={simulationEnabled ? 'Simulated ownship' : 'Ownship'}
                description={`${activeOwnship.speedKts ? `${Math.round(activeOwnship.speedKts)} kt` : 'Speed --'}${activeOwnship.altitudeFt ? ` · ${Math.round(activeOwnship.altitudeFt)} ft` : ''}`}
              >
                <View
                  style={[
                    styles.ownshipMarker,
                    activeOwnship.heading ? { transform: [{ rotate: `${activeOwnship.heading}deg` }] } : null,
                  ]}
                >
                  <Ionicons name="navigate" size={18} color="#ffffff" />
                </View>
              </Marker>
            ) : null}
            {routePoints.map((point) => (
              <Marker
                key={point.icao}
                coordinate={{ latitude: point.latitude, longitude: point.longitude }}
                title={point.icao}
                description={point.name || undefined}
                anchor={{ x: 0.5, y: 1 }}
              >
                <View style={styles.markerLabelContainer}>
                  <Text style={styles.markerLabelText}>{point.icao}</Text>
                  <View style={styles.markerDot} />
                </View>
              </Marker>
            ))}
          </MapView>
        ) : (
          <Text style={styles.helperText}>Enter airports and build a route to preview the map.</Text>
        )}
        {mapStyle === 'sectional' && (
          <Text style={styles.helperText}>
            Sectional tiles appear at zoom 6+; zoom in for FAA chart detail (US-only).
          </Text>
        )}
        <Text style={styles.helperText}>Sectional tiles provided by FAA/Aeronautical Information Services.</Text>
        {mapStyle === 'terrain' && <Text style={styles.helperText}>Terrain tiles provided by USGS National Map.</Text>}
        {mapStyle === 'radar' && (
          <Text style={styles.helperText}>
            Weather overlays are for situational awareness only. Radar shows current precip; blank means no returns.
          </Text>
        )}
        {mapStyle === 'clouds' && (
          <Text style={styles.helperText}>
            Clouds layer shows satellite imagery ({cloudSource === 'goes-west' ? 'GOES-West' : 'GOES-East'}).
            {cloudTimeLabel ? ` Time ${cloudTimeLabel}.` : ' Live imagery.'}
          </Text>
        )}
        {mapStyle === 'clouds' && cloudError && (
          <Text style={styles.errorText}>{cloudError}</Text>
        )}
        {mapStyle === 'winds' && (
          <Text style={styles.helperText}>
            NOAA AWC winds aloft at {windsAloftMeta?.altitudeFt ?? resolvedWindsAltitude} ft. Arrows show wind from,
            size scales with speed. Always brief officially.
          </Text>
        )}
        {mapStyle === 'winds' && windsAloftMeta?.validTime && (
          <Text style={styles.helperText}>Valid {windsAloftMeta.validTime}.</Text>
        )}
        {mapStyle === 'winds' && windsAloftMeta?.warnings?.length ? (
          <Text style={styles.helperText}>{windsAloftMeta.warnings.join(' ')}</Text>
        ) : null}
        {mapStyle === 'winds' && windsAloftError ? (
          <Text style={styles.errorText}>{windsAloftError}</Text>
        ) : null}
        <View style={styles.instrumentPanel}>
          <Text style={styles.instrumentTitle}>Live Flight Data</Text>
          <View style={styles.instrumentRow}>
            <View style={styles.instrumentBox}>
              <Text style={styles.instrumentLabel}>Altitude</Text>
              <Text style={styles.instrumentValue}>{activeOwnship?.altitudeFt ? `${activeOwnship.altitudeFt.toFixed(0)} ft` : '-'}</Text>
            </View>
            <View style={styles.instrumentBox}>
              <Text style={styles.instrumentLabel}>Groundspeed</Text>
              <Text style={styles.instrumentValue}>{activeOwnship?.speedKts ? `${activeOwnship.speedKts.toFixed(0)} kt` : '-'}</Text>
            </View>
          </View>
          <View style={styles.instrumentRow}>
            <View style={styles.instrumentBox}>
              <Text style={styles.instrumentLabel}>Track</Text>
              <Text style={styles.instrumentValue}>{activeOwnship?.heading ? `${activeOwnship.heading.toFixed(0)}°` : '-'}</Text>
            </View>
            <View style={styles.instrumentBox}>
              <Text style={styles.instrumentLabel}>Vert Speed</Text>
              <Text style={styles.instrumentValue}>{activeVerticalSpeedFpm ? `${activeVerticalSpeedFpm.toFixed(0)} fpm` : '-'}</Text>
            </View>
          </View>
          {routeProgress && (
            <>
              <Text style={[styles.instrumentTitle, { marginTop: spacing.sm }]}>Route Progress</Text>
              <View style={styles.instrumentRow}>
                <View style={styles.instrumentBox}>
                  <Text style={styles.instrumentLabel}>Remaining</Text>
                  <Text style={styles.instrumentValue}>{routeProgress.remainingRouteNm.toFixed(1)} NM</Text>
                </View>
                <View style={styles.instrumentBox}>
                  <Text style={styles.instrumentLabel}>ETA</Text>
                  <Text style={styles.instrumentValue}>{routeProgress.etaText || '-'}</Text>
                </View>
              </View>
              <View style={styles.instrumentRow}>
                <View style={styles.instrumentBox}>
                  <Text style={styles.instrumentLabel}>Next Point</Text>
                  <Text style={styles.instrumentValue}>{routeProgress.nextWaypoint || '-'}</Text>
                </View>
                <View style={styles.instrumentBox}>
                  <Text style={styles.instrumentLabel}>Off Route</Text>
                  <Text style={styles.instrumentValue}>{routeProgress.offRouteNm.toFixed(1)} NM</Text>
                </View>
              </View>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${routeProgress.progressPct}%` }]} />
              </View>
              <Text style={styles.helperText}>
                {routeProgress.progressPct.toFixed(0)}% complete on the current route.
              </Text>
            </>
          )}
          {!!rankedTrafficTargets.length && (
            <>
              <Text style={[styles.instrumentTitle, { marginTop: spacing.sm }]}>Traffic watch</Text>
              {visibleTrafficTargets.slice(0, 3).map((target) => (
                <View key={`traffic-${target.id}`} style={styles.diversionCard}>
                  <View style={styles.diversionHeader}>
                    <Text style={styles.diversionTitle}>{target.callsign || 'Traffic'}</Text>
                    <Text
                      style={[
                        styles.diversionBadge,
                        target.threatLevel === 'immediate'
                          ? styles.badgeDanger
                          : target.threatLevel === 'advisory'
                            ? styles.badgeWarning
                            : styles.badgeNeutral,
                      ]}
                    >
                      {target.threatLevel}
                    </Text>
                  </View>
                  <Text style={styles.diversionMeta}>
                    {target.distanceNm.toFixed(1)} NM
                    {typeof target.altitudeFt === 'number' ? ` • ${Math.round(target.altitudeFt)} ft` : ''}
                    {typeof target.altitudeDeltaFt === 'number'
                      ? ` • ${target.altitudeDeltaFt >= 0 ? '+' : ''}${Math.round(target.altitudeDeltaFt)} ft`
                      : ''}
                  </Text>
                  <Text style={styles.helperText}>Threat score {target.threatScore}</Text>
                </View>
              ))}
            </>
          )}
          <Text style={[styles.instrumentTitle, { marginTop: spacing.sm }]}>Diversion candidates</Text>
          {diversionLoading ? (
            <Text style={styles.helperText}>Loading nearby airports...</Text>
          ) : diversionError ? (
            <Text style={styles.errorText}>{diversionError}</Text>
          ) : diversionCandidates.length === 0 ? (
            <Text style={styles.helperText}>Enable GPS to score nearby diversion airports.</Text>
          ) : (
            <View style={styles.diversionList}>
              {diversionCandidates.slice(0, 3).map((airport) => (
                <TouchableOpacity
                  key={airport.icao}
                  style={[
                    styles.diversionCard,
                    selectedDiversionIcao === airport.icao && styles.diversionCardActive,
                  ]}
                  onPress={() => setSelectedDiversionIcao(airport.icao)}
                  activeOpacity={0.9}
                >
                  <View style={styles.diversionHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.diversionTitle}>
                        {airport.icao}{airport.name ? ` · ${airport.name}` : ''}
                      </Text>
                      <Text style={styles.diversionMeta}>
                        {airport.distanceNm.toFixed(1)} NM · {Math.round(airport.bearingDeg)}°
                        {airport.maxRunwayFt ? ` · ${airport.maxRunwayFt.toLocaleString()} ft` : ''}
                      </Text>
                    </View>
                    {airport.flightCategory ? (
                      <Text style={styles.diversionBadge}>{airport.flightCategory}</Text>
                    ) : null}
                  </View>
                  {selectedDiversionIcao === airport.icao ? (
                    selectedDiversionBriefingLoading ? (
                      <Text style={styles.helperText}>Loading runway briefing...</Text>
                    ) : selectedDiversionBriefing?.advisory ? (
                      <Text style={styles.helperText}>
                        Runway {selectedDiversionBriefing.advisory.runway || '--'} ·
                        HW {selectedDiversionBriefing.advisory.headwind ?? '--'} kt ·
                        XW {selectedDiversionBriefing.advisory.crosswind ?? '--'} kt
                        {selectedDiversionBriefing.runwayInUse ? ` · In use ${selectedDiversionBriefing.runwayInUse}` : ''}
                      </Text>
                    ) : selectedDiversionBriefing?.runwayInUse ? (
                      <Text style={styles.helperText}>Runway in use {selectedDiversionBriefing.runwayInUse}</Text>
                    ) : null
                  ) : null}
                  {airport.scoreReasons?.length ? (
                    <Text style={styles.helperText}>{airport.scoreReasons.slice(0, 2).join(' · ')}</Text>
                  ) : null}
                  {selectedDiversionIcao === airport.icao && selectedDiversionBestComm ? (
                    <Text style={styles.helperText}>
                      Best comm: {selectedDiversionBestComm.type || selectedDiversionBestComm.description || 'Frequency'}
                      {selectedDiversionBestComm.frequencyMhz ? ` ${selectedDiversionBestComm.frequencyMhz.toFixed(3)}` : ''}
                    </Text>
                  ) : null}
                  <View style={styles.diversionActions}>
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => setAlternate(airport.icao)}>
                      <Text style={styles.secondaryButtonText}>Use as alternate</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => {
                        setDestination(airport.icao);
                        setSuggestedMode('direct');
                        setWaypoints('');
                        setPlannedStops('');
                      }}
                    >
                      <Text style={styles.secondaryButtonText}>Use as destination</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aircraft Performance</Text>
        <TextInput
          style={styles.input}
          value={aircraftQuery}
          onChangeText={setAircraftQuery}
          onSubmitEditing={searchAircraft}
          placeholder="Search aircraft (C172, SR22, DA40)"
        />
        <TouchableOpacity style={styles.secondaryButton} onPress={searchAircraft}>
          <Text style={styles.secondaryButtonText}>Search Library</Text>
        </TouchableOpacity>

        {!!aircraftResults.length && (
          <View style={styles.list}>
            {aircraftResults.slice(0, 6).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.listItem}
                onPress={() => {
                  dispatchAircraftPerformance({ type: 'load_from_type', value: item });
                  dispatchAircraftPerformance({ type: 'set_selected_profile_id', value: null });
                }}
              >
                <Text style={styles.listItemText}>{item.make} {item.model} ({item.icaoType || 'N/A'})</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {isAuthenticated && (
          <>
            <Text style={styles.subTitle}>Saved Profiles</Text>
            <View style={styles.list}>
              {profiles.length === 0 && <Text style={styles.helperText}>No saved profiles yet.</Text>}
              {profiles.map((profile) => (
                <TouchableOpacity
                key={profile.id}
                style={styles.listItem}
                onPress={() => {
                    dispatchAircraftPerformance({ type: 'set_selected_profile_id', value: profile.id });
                    dispatchAircraftPerformance({ type: 'set_selected_type', value: null });
                }}
              >
                  <Text style={styles.listItemText}>{profile.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Cruise KTAS</Text>
            <TextInput
              style={styles.input}
              value={cruiseKtas}
              onChangeText={(value) => dispatchAircraftPerformance({ type: 'set_field', field: 'cruiseKtas', value })}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Fuel Burn (GPH)</Text>
            <TextInput
              style={styles.input}
              value={fuelBurnGph}
              onChangeText={(value) => dispatchAircraftPerformance({ type: 'set_field', field: 'fuelBurnGph', value })}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Usable Fuel (gal)</Text>
            <TextInput
              style={styles.input}
              value={usableFuel}
              onChangeText={(value) => dispatchAircraftPerformance({ type: 'set_field', field: 'usableFuel', value })}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Max Gross (lb)</Text>
            <TextInput
              style={styles.input}
              value={maxGrossWeight}
              onChangeText={(value) => dispatchAircraftPerformance({ type: 'set_field', field: 'maxGrossWeight', value })}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Reserve (min)</Text>
            <TextInput style={styles.input} value={reserveMinutes} onChangeText={setReserveMinutes} keyboardType="numeric" />
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Avg Headwind (kt)</Text>
            <TextInput style={styles.input} value={headwind} onChangeText={setHeadwind} keyboardType="numeric" />
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Planned Altitude (ft)</Text>
            <TextInput
              style={styles.input}
              value={plannedAltitude}
              onChangeText={setPlannedAltitude}
              keyboardType="numeric"
              placeholder="8500"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Performance Summary</Text>
        <View style={styles.statsRow}>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>ETE</Text>
            <Text style={styles.statsValue}>{eteHours ? `${eteHours.toFixed(2)} hrs` : '-'}</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Trip Fuel</Text>
            <Text style={styles.statsValue}>{fuelRequired ? `${fuelRequired.toFixed(1)} gal` : '-'}</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Fuel + Reserve</Text>
            <Text style={styles.statsValue}>{totalFuel ? `${totalFuel.toFixed(1)} gal` : '-'}</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Effective Speed</Text>
            <Text style={styles.statsValue}>{effectiveSpeed ? `${effectiveSpeed.toFixed(0)} kt` : '-'}</Text>
          </View>
        </View>
        {altitudeRisks.length > 0 && (
          <View style={styles.altitudeCard}>
            <Text style={styles.altitudeTitle}>Altitude notes</Text>
            {altitudeRisks.map((note) => (
              <Text key={note} style={styles.altitudeText}>- {note}</Text>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Schedule & Timing</Text>
        <Text style={styles.sectionSubtitle}>Local time at each airport. Arrival auto-calculates from ETE.</Text>
        <Text style={styles.fieldLabel}>Planned Departure</Text>
        <TextInput
          style={styles.input}
          value={plannedDepartureAt}
          onChangeText={setPlannedDepartureAt}
          placeholder="YYYY-MM-DD HH:MM"
        />
        <Text style={styles.helperText}>Local time at departure ({resolvedDepartureTimeZone}).</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.fieldLabel}>Planned Arrival</Text>
          <TouchableOpacity
            style={[styles.autoCalcButton, (!plannedDepartureAt || !eteMinutes) && styles.autoCalcButtonDisabled]}
            onPress={() => setArrivalAuto(true)}
            disabled={!plannedDepartureAt || !eteMinutes}
          >
            <Text style={styles.autoCalcText}>Auto-calc</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.input}
          value={plannedArrivalAt}
          onChangeText={(value) => {
            setPlannedArrivalAt(value);
            setArrivalAuto(false);
          }}
          placeholder="YYYY-MM-DD HH:MM"
        />
        <Text style={styles.helperText}>Local time at destination ({resolvedDestinationTimeZone}).</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.summaryBlock}>
          <Text style={styles.summaryLabel}>Route</Text>
          <Text style={styles.summaryRoute} numberOfLines={2}>
            {[departure.trim().toUpperCase(), plannedStops.trim(), waypoints.trim(), destination.trim().toUpperCase()]
              .filter(Boolean)
              .join(' ')}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Distance</Text>
          <Text style={styles.summaryValue}>{totalNm ? `${totalNm.toFixed(1)} NM` : '-'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Estimated Time</Text>
          <Text style={styles.summaryValue}>{eteHours ? `${eteHours.toFixed(2)} hrs` : '-'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Trip Fuel</Text>
          <Text style={styles.summaryValue}>{fuelRequired ? `${fuelRequired.toFixed(1)} gal` : '-'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Fuel + Reserve</Text>
          <Text style={styles.summaryValue}>{totalFuel ? `${totalFuel.toFixed(1)} gal` : '-'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Planned Altitude</Text>
          <Text style={styles.summaryValue}>{plannedAltitude ? `${plannedAltitude} ft` : '-'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Route Risk</Text>
          <Text style={[styles.summaryValue, routeRiskLabel !== 'Normal' && { color: colors.warning }]}>
            {routeRiskLabel}
          </Text>
        </View>
        <Text style={styles.helperText}>
          RSF does not file flight plans automatically. Use Flight Service or an approved provider.
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.summaryHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Route Weather Summary</Text>
            <Text style={styles.sectionSubtitle}>NOAA/AWC snapshot for your route.</Text>
          </View>
          <TouchableOpacity
            style={styles.summaryLink}
            onPress={() => navigation?.navigate?.('AviationWeatherHub')}
          >
            <Text style={styles.summaryLinkText}>Open Hub</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
        {summaryLoading && <ActivityIndicator color={colors.primary} />}
        {summaryError && <Text style={styles.errorText}>{summaryError}</Text>}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>Flight category</Text>
            <Text style={styles.summaryValue}>{summaryCategoryLabel}</Text>
            {hasThunderRisk && <Text style={styles.warningText}>Thunderstorm risk in TAFs</Text>}
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>Winds aloft</Text>
            <Text style={styles.summaryValue}>
              {summaryCounts.winds > 0 ? `${summaryCounts.winds} stations` : 'No winds data'}
            </Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>NOTAMs</Text>
            <Text style={styles.summaryValue}>
              {summaryCounts.notams > 0 ? `${summaryCounts.notams} active` : 'None loaded'}
            </Text>
          </View>
        </View>
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>PIREPs {summaryCounts.pireps}</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Convective {summaryCounts.convective}</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Icing {summaryCounts.icing}</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Turbulence {summaryCounts.turbulence}</Text>
          </View>
        </View>
      </View>

      {(departureWeather || destinationWeather || weatherError) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weather Snapshot</Text>
          {forecastNotice && <Text style={styles.helperText}>{forecastNotice}</Text>}
          {weatherError && <Text style={styles.helperText}>{weatherError}</Text>}
          <View style={styles.weatherCard}>
            <Text style={styles.weatherTitle}>Departure {departure.toUpperCase()}</Text>
            <Text style={styles.weatherValue}>{depCategory}</Text>
            <Text style={styles.weatherText} numberOfLines={2}>{departureWeather?.metar?.rawOb || 'METAR unavailable'}</Text>
          </View>
          <View style={styles.weatherCard}>
            <Text style={styles.weatherTitle}>Destination {destination.toUpperCase()}</Text>
            <Text style={styles.weatherValue}>{destCategory}</Text>
            <Text style={styles.weatherText} numberOfLines={2}>{destinationWeather?.metar?.rawOb || 'METAR unavailable'}</Text>
          </View>
          {enrouteWeather.length > 0 && (
            <View style={styles.weatherCard}>
              <Text style={styles.weatherTitle}>Enroute Weather</Text>
              {enrouteWeather.map((item) => (
                <View key={`enroute-${item.icao}`} style={styles.enrouteRow}>
                  <Text style={styles.enrouteLabel}>{item.icao?.toUpperCase()}</Text>
                  <Text style={styles.enrouteValue}>{parseFlightCategory(item.metar)}</Text>
                </View>
              ))}
            </View>
          )}
          {routeVariationNotes.length > 0 && (
            <View style={styles.weatherCard}>
              <Text style={styles.weatherTitle}>Potential routing adjustments</Text>
              {routeVariationNotes.map((note) => (
                <Text key={note} style={styles.weatherText}>- {note}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Go / No-Go Checklist</Text>
        {[
          { key: 'weather', label: 'Weather reviewed' },
          { key: 'fuel', label: 'Fuel planned' },
          { key: 'currency', label: 'Currency checked' },
          { key: 'notams', label: 'NOTAMs acknowledged' },
        ].map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.checkRow}
            onPress={() => setChecklist((prev) => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
          >
            <View style={[styles.checkBox, checklist[item.key as keyof typeof checklist] && styles.checkBoxActive]}>
              {checklist[item.key as keyof typeof checklist] && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.checkText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {routeSummary?.legs?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route Legs</Text>
          {routeSummary.legs.map((leg) => (
            <View key={`${leg.from}-${leg.to}`} style={styles.legRow}>
              <Text style={styles.legText}>{`${leg.from} -> ${leg.to}`}</Text>
              <Text style={styles.legText}>{leg.nm.toFixed(1)} NM</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flightDeckContainer: { flex: 1, backgroundColor: colors.flightBackground },
  flightDeckHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    zIndex: 20,
  },
  flightDeckHeaderCard: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(10,14,20,0.82)',
    borderWidth: 1,
    borderColor: colors.flightBorder,
  },
  flightDeckEyebrow: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.flightAccent,
    fontWeight: '700',
  },
  flightDeckTitle: {
    marginTop: 6,
    fontSize: 22,
    lineHeight: 26,
    color: colors.flightText,
    fontWeight: '600',
  },
  flightDeckSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: colors.flightTextMuted,
  },
  flightDeckHeaderActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  flightDeckExitButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.flightSurfaceElevated,
    borderWidth: 1,
    borderColor: colors.flightBorder,
  },
  flightDeckExitButtonActive: {
    borderColor: colors.flightAccent,
  },
  flightDeckExitText: {
    color: colors.flightText,
    fontSize: 13,
    fontWeight: '600',
  },
  flightDeckMapShell: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.flightSurface,
    ...shadow.flightGlass,
  },
  flightDeckMap: { width: '100%', height: '100%', backgroundColor: colors.flightBackground },
  flightDeckVisionShell: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#07111E',
  },
  flightDeckVisionSky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '58%',
    backgroundColor: '#132846',
  },
  flightDeckVisionGround: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: '#4D4028',
  },
  flightDeckVisionHorizon: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '56%',
    height: 2,
    backgroundColor: colors.flightText,
    opacity: 0.9,
  },
  flightDeckVisionBankArc: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.xl,
    right: spacing.xl,
    height: 28,
  },
  flightDeckVisionBankTick: {
    position: 'absolute',
    top: 10,
    width: 2,
    height: 8,
    marginLeft: -1,
    borderRadius: 999,
    backgroundColor: 'rgba(232,237,244,0.62)',
  },
  flightDeckVisionBankTickMajor: {
    top: 6,
    height: 12,
    backgroundColor: colors.flightAccent,
  },
  flightDeckVisionBankPointer: {
    position: 'absolute',
    alignSelf: 'center',
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.flightAccent,
    marginLeft: -8,
  },
  flightDeckVisionCenterline: {
    position: 'absolute',
    top: '16%',
    bottom: '14%',
    width: 2,
    marginLeft: -1,
    backgroundColor: 'rgba(200, 146, 42, 0.42)',
  },
  flightDeckVisionRouteGate: {
    position: 'absolute',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(200, 146, 42, 0.78)',
    backgroundColor: 'rgba(200, 146, 42, 0.08)',
  },
  flightDeckVisionRouteGateCaution: {
    borderColor: 'rgba(245, 166, 35, 0.82)',
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
  },
  flightDeckVisionTunnelBand: {
    position: 'absolute',
    borderRadius: 16,
    backgroundColor: 'rgba(200, 146, 42, 0.09)',
  },
  flightDeckVisionTunnelBandCaution: {
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
  },
  flightDeckVisionTunnelBandWarning: {
    backgroundColor: 'rgba(232, 69, 60, 0.12)',
  },
  flightDeckVisionFlightPathMarker: {
    position: 'absolute',
    top: '47%',
    alignSelf: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.flightAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flightDeckVisionFlightPathInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.flightAccent,
  },
  flightDeckVisionTrackVector: {
    position: 'absolute',
    top: '34%',
    bottom: '46%',
    alignSelf: 'center',
    width: 2,
    backgroundColor: 'rgba(200,146,42,0.72)',
    borderRadius: 999,
  },
  flightDeckVisionDirectorHorizontal: {
    position: 'absolute',
    top: '47.5%',
    alignSelf: 'center',
    width: 120,
    height: 10,
    marginTop: -5,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(232, 237, 244, 0.78)',
    backgroundColor: 'rgba(232, 237, 244, 0.12)',
  },
  flightDeckVisionDirectorVertical: {
    position: 'absolute',
    top: '41%',
    alignSelf: 'center',
    width: 10,
    height: 120,
    marginLeft: -5,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(232, 237, 244, 0.78)',
    backgroundColor: 'rgba(232, 237, 244, 0.1)',
  },
  flightDeckVisionDirectorCaptured: {
    borderColor: 'rgba(0, 212, 160, 0.78)',
    backgroundColor: 'rgba(0, 212, 160, 0.12)',
  },
  flightDeckVisionDirectorCaution: {
    borderColor: 'rgba(245, 166, 35, 0.82)',
    backgroundColor: 'rgba(245, 166, 35, 0.16)',
  },
  flightDeckVisionDirectorWarning: {
    borderColor: 'rgba(232, 69, 60, 0.9)',
    backgroundColor: 'rgba(232, 69, 60, 0.18)',
  },
  flightDeckVisionCaptureTag: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(10,14,20,0.82)',
    borderWidth: 1,
    borderColor: colors.flightBorder,
  },
  flightDeckVisionCaptureTagTop: {
    top: '36%',
  },
  flightDeckVisionCaptureTagBottom: {
    top: '68%',
  },
  flightDeckVisionCaptureTagText: {
    color: colors.flightText,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  flightDeckVisionReadoutLeft: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
  },
  flightDeckVisionReadoutRight: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    alignItems: 'flex-end',
  },
  flightDeckVisionLabel: {
    color: 'rgba(245,166,35,0.75)',
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  flightDeckVisionValue: {
    color: colors.flightCaution,
    fontSize: 28,
    fontWeight: '600',
    marginTop: 4,
  },
  flightDeckVisionBanner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(10,14,20,0.82)',
    borderWidth: 1,
    borderColor: colors.flightBorder,
  },
  flightDeckVisionBannerTitle: {
    color: colors.flightText,
    fontSize: 14,
    fontWeight: '700',
  },
  flightDeckVisionBannerText: {
    color: colors.flightTextMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  flightDeckVisionBannerSupport: {
    color: colors.flightAccent,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    fontWeight: '600',
  },
  flightDeckVisionBannerSupportMuted: {
    color: colors.flightTextMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
    fontWeight: '600',
  },
  flightDeckVisionBannerAlert: {
    color: colors.flightWarning,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    fontWeight: '700',
  },
  flightDeckVisionPitchLine: {
    position: 'absolute',
    alignSelf: 'center',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(232,237,244,0.75)',
    alignItems: 'center',
  },
  flightDeckVisionPitchLabel: {
    position: 'absolute',
    top: -10,
    right: -28,
    color: colors.flightTextMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  flightDeckVisionGuidanceChip: {
    position: 'absolute',
    top: spacing.lg,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(10,14,20,0.82)',
    borderWidth: 1,
    borderColor: colors.flightBorder,
  },
  flightDeckVisionGuidanceText: {
    color: colors.flightAccent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  flightDeckVisionGroundCaution: {
    backgroundColor: '#5D4628',
  },
  flightDeckVisionGroundWarning: {
    backgroundColor: '#6A2B24',
  },
  flightDeckVisionHorizonCaution: {
    backgroundColor: colors.flightCaution,
  },
  flightDeckVisionHorizonWarning: {
    backgroundColor: colors.flightWarning,
  },
  flightDeckVisionTerrainBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '48%',
  },
  flightDeckVisionTerrainColumn: {
    position: 'absolute',
    bottom: 0,
    width: 26,
    marginLeft: -13,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    opacity: 0.92,
  },
  flightDeckVisionTerrainColumnNominal: {
    backgroundColor: 'rgba(0,212,160,0.28)',
  },
  flightDeckVisionTerrainColumnCaution: {
    backgroundColor: 'rgba(245,166,35,0.46)',
  },
  flightDeckVisionTerrainColumnWarning: {
    backgroundColor: 'rgba(232,69,60,0.52)',
  },
  flightDeckVisionTrafficSymbol: {
    position: 'absolute',
    width: 26,
    height: 26,
    marginLeft: -13,
    marginTop: -13,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.flightText,
    backgroundColor: colors.flightAdvisory,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flightDeckVisionTrafficVector: {
    position: 'absolute',
    width: 2,
    height: 18,
    left: -1,
    top: -20,
    backgroundColor: 'rgba(232,237,244,0.72)',
    borderRadius: 999,
  },
  flightDeckVisionTrafficSymbolCaution: {
    backgroundColor: colors.flightCaution,
  },
  flightDeckVisionTrafficSymbolWarning: {
    backgroundColor: colors.flightWarning,
  },
  flightDeckVisionObstacleCue: {
    position: 'absolute',
    width: 10,
    height: 26,
    marginLeft: -5,
    marginTop: -13,
    borderRadius: 999,
    backgroundColor: 'rgba(0,212,160,0.72)',
  },
  flightDeckVisionObstacleCueCaution: {
    backgroundColor: 'rgba(245,166,35,0.86)',
  },
  flightDeckVisionObstacleCueWarning: {
    backgroundColor: 'rgba(232,69,60,0.92)',
  },
  flightDeckVisionTelemetryLeft: {
    position: 'absolute',
    left: spacing.md,
    bottom: 104,
  },
  flightDeckVisionTelemetryRight: {
    position: 'absolute',
    right: spacing.md,
    bottom: 104,
    alignItems: 'flex-end',
  },
  flightDeckVisionTelemetryLabel: {
    color: 'rgba(245,166,35,0.75)',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  flightDeckVisionTelemetryValue: {
    color: colors.flightText,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  flightDeckVisionTelemetryValueCaution: {
    color: colors.flightCaution,
  },
  flightDeckVisionTelemetryValueWarning: {
    color: colors.flightWarning,
  },
  flightDeckVisionTrafficCue: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 148,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(10,14,20,0.82)',
    borderWidth: 1,
    borderColor: colors.flightBorder,
  },
  flightDeckVisionTrafficCueTitle: {
    color: colors.flightTextMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  flightDeckVisionTrafficCueText: {
    color: colors.flightText,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  flightDeckVisionTrafficCueMeta: {
    color: colors.flightTextMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  flightDeckVisionManeuverCard: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    top: spacing.xl + 84,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(10,14,20,0.8)',
    borderWidth: 1,
    borderColor: colors.flightBorder,
  },
  flightDeckVisionManeuverTitle: {
    color: colors.flightTextMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  flightDeckVisionManeuverText: {
    color: colors.flightText,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    fontWeight: '600',
  },
  flightDeckEmptyMap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.flightSurface,
    padding: spacing.lg,
  },
  flightDeckEmptyTitle: {
    color: colors.flightText,
    fontSize: 20,
    fontWeight: '700',
  },
  flightDeckEmptyText: {
    color: colors.flightTextMuted,
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  flightDeckTapReveal: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 12,
  },
  flightDeckChip: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(17,24,32,0.92)',
    borderWidth: 1,
    borderColor: colors.flightBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flightDeckChipActive: {
    backgroundColor: colors.flightSurfaceElevated,
    borderColor: colors.flightAccent,
  },
  flightDeckChipText: {
    color: colors.flightTextMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  flightDeckChipTextActive: {
    color: colors.flightText,
  },
  flightDeckBottomStack: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    gap: spacing.xs,
    zIndex: 15,
  },
  flightDeckAlertStrip: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderWidth: 1,
  },
  flightDeckAlertStripAdvisory: {
    backgroundColor: 'rgba(74,159,212,0.18)',
    borderColor: 'rgba(74,159,212,0.45)',
  },
  flightDeckAlertStripCaution: {
    backgroundColor: 'rgba(245,166,35,0.18)',
    borderColor: 'rgba(245,166,35,0.45)',
  },
  flightDeckAlertStripWarning: {
    backgroundColor: 'rgba(232,69,60,0.18)',
    borderColor: 'rgba(232,69,60,0.45)',
  },
  flightDeckAlertTitle: {
    color: colors.flightText,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  flightDeckAlertText: {
    color: colors.flightTextMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  flightDeckContextCard: {
    borderRadius: radius.lg,
    backgroundColor: 'rgba(10,14,20,0.9)',
    borderWidth: 1,
    borderColor: colors.flightBorder,
    padding: spacing.sm,
  },
  flightDeckContextCardAccent: {
    borderColor: 'rgba(200,146,42,0.5)',
  },
  flightDeckContextCardCaution: {
    borderColor: 'rgba(245,166,35,0.55)',
    backgroundColor: 'rgba(245,166,35,0.12)',
  },
  flightDeckContextCardWarning: {
    borderColor: 'rgba(232,69,60,0.58)',
    backgroundColor: 'rgba(232,69,60,0.12)',
  },
  flightDeckContextCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  flightDeckContextCardEyebrow: {
    color: colors.flightTextMuted,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  flightDeckContextCardBadge: {
    color: colors.flightAccent,
    fontSize: 11,
    fontWeight: '700',
  },
  flightDeckContextCardTitle: {
    color: colors.flightText,
    fontSize: 13,
    lineHeight: 17,
    marginTop: 6,
    fontWeight: '600',
  },
  flightDeckContextCardText: {
    color: colors.flightTextMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  flightDeckContextCardActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  flightDeckMiniChip: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.flightSurfaceElevated,
    borderWidth: 1,
    borderColor: colors.flightBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flightDeckMiniChipActive: {
    backgroundColor: colors.flightAccent,
    borderColor: colors.flightAccent,
  },
  flightDeckMiniChipText: {
    color: colors.flightText,
    fontSize: 11,
    fontWeight: '600',
  },
  flightDeckMiniChipTextActive: {
    color: colors.flightBackground,
  },
  flightDeckMapActionCard: {
    borderRadius: radius.lg,
    backgroundColor: 'rgba(10,14,20,0.86)',
    borderWidth: 1,
    borderColor: colors.flightBorder,
    padding: spacing.sm,
    ...shadow.flightGlass,
  },
  flightDeckMapActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flightDeckMapActionLabel: {
    color: colors.flightTextMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  flightDeckMapActionMode: {
    color: colors.flightAccent,
    fontSize: 11,
    fontWeight: '700',
  },
  flightDeckMapActionText: {
    color: colors.flightText,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
    fontWeight: '600',
  },
  flightDeckMapActionSubtext: {
    color: colors.flightTextMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
    fontWeight: '600',
  },
  flightDeckMapActionRecommendation: {
    color: colors.flightText,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },
  flightTrafficMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flightTrafficAttentionRing: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'rgba(245,166,35,0.75)',
  },
  flightTrafficAttentionRingImmediate: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderColor: 'rgba(232,69,60,0.8)',
  },
  flightTrafficMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flightTrafficMarkerImmediate: {
    backgroundColor: colors.flightWarning,
    borderColor: colors.flightText,
  },
  flightTrafficMarkerAdvisory: {
    backgroundColor: colors.flightCaution,
    borderColor: colors.flightText,
  },
  flightTrafficMarkerMonitor: {
    backgroundColor: colors.flightSurfaceElevated,
    borderColor: colors.flightTextMuted,
  },
  flightTrafficMarkerSelected: {
    transform: [{ scale: 1.12 }],
    borderColor: colors.flightAccent,
  },
  flightDeckDiversionMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.flightSurfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.flightTextMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flightDeckDiversionMarkerActive: {
    backgroundColor: colors.flightAccent,
    borderColor: colors.flightText,
  },
  flightDeckHud: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    minHeight: 84,
    borderRadius: 999,
    backgroundColor: 'rgba(10,14,20,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(74,159,212,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    ...shadow.flightGlass,
  },
  flightDeckHudExpandedCard: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 112,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(10,14,20,0.92)',
    borderWidth: 1,
    borderColor: colors.flightBorder,
    padding: spacing.sm,
    ...shadow.flightGlass,
  },
  flightDeckHudExpandedRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  flightDeckHudExpandedMetric: {
    flex: 1,
    padding: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.flightSurface,
  },
  flightDeckHudExpandedLabel: {
    color: colors.flightTextMuted,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  flightDeckHudExpandedValue: {
    color: colors.flightText,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  flightDeckHudCell: { flex: 1, alignItems: 'center' },
  flightDeckHudLabel: {
    color: colors.flightTextMuted,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  flightDeckHudValue: {
    color: colors.flightText,
    fontSize: 22,
    fontWeight: '600',
    marginTop: 4,
  },
  flightDeckHudDivider: {
    width: 1,
    height: 34,
    backgroundColor: colors.flightBorder,
  },
  flightDeckQuickRail: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  flightDeckQuickButton: {
    flex: 1,
    minHeight: 62,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(10,14,20,0.9)',
    borderWidth: 1,
    borderColor: colors.flightBorder,
    justifyContent: 'space-between',
  },
  flightDeckQuickButtonActive: {
    backgroundColor: colors.flightSurfaceElevated,
    borderColor: colors.flightAccent,
  },
  flightDeckQuickButtonWarning: {
    borderColor: 'rgba(232,69,60,0.58)',
    backgroundColor: 'rgba(232,69,60,0.12)',
  },
  flightDeckQuickButtonCaution: {
    borderColor: 'rgba(245,166,35,0.55)',
    backgroundColor: 'rgba(245,166,35,0.12)',
  },
  flightDeckQuickButtonAccent: {
    borderColor: 'rgba(200,146,42,0.55)',
  },
  flightDeckQuickButtonLabel: {
    color: colors.flightTextMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  flightDeckQuickButtonValue: {
    color: colors.flightText,
    fontSize: 12,
    lineHeight: 15,
    marginTop: 6,
    fontWeight: '600',
  },
  flightDeckQuickButtonValueActive: {
    color: colors.flightAccent,
  },
  flightOwnshipMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.flightAccent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.flightText,
  },
  flightDeckSheet: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    maxHeight: '50%',
    borderRadius: radius.xl,
    backgroundColor: 'rgba(10,14,20,0.96)',
    borderWidth: 1,
    borderColor: colors.flightBorder,
    zIndex: 18,
    ...shadow.flightGlass,
  },
  flightDeckDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  flightDeckDrawerTitle: {
    color: colors.flightText,
    fontSize: 16,
    fontWeight: '700',
  },
  flightDeckDrawerSubtitle: {
    color: colors.flightTextMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  flightDeckDrawerClose: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.flightSurfaceElevated,
    borderWidth: 1,
    borderColor: colors.flightBorder,
  },
  flightDeckDrawerCloseText: {
    color: colors.flightText,
    fontSize: 12,
    fontWeight: '600',
  },
  flightDeckPanelTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  flightDeckTab: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.flightSurface,
    borderWidth: 1,
    borderColor: colors.flightBorder,
  },
  flightDeckTabActive: {
    backgroundColor: colors.flightSurfaceElevated,
    borderColor: colors.flightAccent,
  },
  flightDeckTabText: {
    color: colors.flightTextMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  flightDeckTabTextActive: {
    color: colors.flightText,
  },
  flightDeckPanel: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.flightSurface,
    borderWidth: 1,
    borderColor: colors.flightBorder,
  },
  flightDeckPanelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  flightDeckPanelTitle: {
    color: colors.flightText,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  flightDeckPanelText: {
    color: colors.flightTextMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  flightDeckBadge: {
    color: colors.flightAccent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  flightDeckBadgeAdvisory: {
    color: colors.flightAdvisory,
  },
  flightDeckBadgeCaution: {
    color: colors.flightCaution,
  },
  flightDeckBadgeWarning: {
    color: colors.flightWarning,
  },
  flightDeckControlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  flightDeckListCard: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.flightBorder,
    backgroundColor: colors.flightSurfaceElevated,
  },
  flightDeckListCardActive: {
    borderColor: colors.flightAccent,
  },
  flightDeckListTitle: {
    color: colors.flightText,
    fontSize: 14,
    fontWeight: '700',
  },
  flightDeckListMeta: {
    color: colors.flightTextMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  content: { padding: spacing.sm, paddingBottom: 120 },
  heroPanel: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.cockpit,
    ...shadow.floating,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#93c5fd',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#ffffff',
    marginTop: 10,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#dbe4f0',
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  heroBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  heroMetricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroMetricCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroMetricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#bfdbfe',
    textTransform: 'uppercase',
  },
  heroMetricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statsCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsLabel: {
    ...typography.muted,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  statsValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
    marginTop: 6,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroPrimaryAction: {
    flex: 1,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  heroPrimaryActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  heroSecondaryAction: {
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  heroSecondaryActionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm },
  sectionSubtitle: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: spacing.xs },
  fieldHelper: { fontSize: 11, color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: colors.primaryStrong,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.primary, fontWeight: '600' },
  list: { marginBottom: spacing.sm },
  listItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listItemText: { fontSize: 14, color: colors.text },
  subTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  helperText: { fontSize: 12, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridItem: { width: '48%' },
  label: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: colors.textMuted },
  summaryValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  summaryBlock: { marginBottom: spacing.sm },
  summaryRoute: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 4 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  summaryLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryLinkText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  summaryGrid: { gap: spacing.sm },
  summaryTile: { padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  warningText: { fontSize: 11, color: colors.warning, marginTop: spacing.xs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  autoCalcButton: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  autoCalcButtonDisabled: { opacity: 0.5 },
  autoCalcText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  legRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  legText: { fontSize: 13, color: colors.textMuted },
  suggestionBox: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.sm, marginBottom: spacing.sm, backgroundColor: colors.surfaceMuted },
  suggestionTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  suggestionText: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  suggestionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  suggestionButton: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  suggestionButtonActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  suggestionButtonText: { fontSize: 12, color: colors.text },
  suggestionHint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs, marginBottom: spacing.xs },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pillText: { fontSize: 11, color: colors.text },
  suggestionList: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: spacing.sm },
  suggestionItem: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestionItemText: { fontSize: 12, color: colors.text },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  altitudeCard: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  altitudeTitle: { fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 4 },
  altitudeText: { fontSize: 12, color: colors.textMuted },
  weatherCard: { backgroundColor: colors.surfaceMuted, padding: spacing.sm, borderRadius: radius.md, marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border },
  weatherTitle: { fontSize: 12, color: colors.textMuted },
  weatherValue: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  weatherText: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  enrouteRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  enrouteLabel: { fontSize: 12, color: colors.text },
  enrouteValue: { fontSize: 12, color: colors.textMuted },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  checkBox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  checkBoxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkText: { fontSize: 13, color: colors.text },
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  mapToggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  altitudeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  altitudeButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  altitudeButtonActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  altitudeTextActive: { color: colors.primary, fontWeight: '600' },
  mapToggleButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  mapToggleActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  mapToggleText: { fontSize: 12, color: colors.text },
  map: { width: '100%', height: 240, borderRadius: radius.lg, overflow: 'hidden' },
  helpLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  helpLinkText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  trafficRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  simCard: {
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  simActionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  portInput: { flex: 1 },
  alertCard: {
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  alertTitle: { fontSize: 12, fontWeight: '700', color: '#991b1b', marginBottom: 4 },
  alertText: { fontSize: 12, color: '#7f1d1d' },
  errorText: { fontSize: 12, color: colors.danger },
  markerLabelContainer: { alignItems: 'center' },
  markerLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: '#fff',
  },
  ownshipMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#ffffff',
    ...shadow.card,
  },
  windMarker: { alignItems: 'center', justifyContent: 'center' },
  calloutText: { fontSize: 12, color: colors.text },
  instrumentPanel: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  instrumentTitle: { fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  instrumentRow: { flexDirection: 'row', gap: spacing.sm },
  instrumentBox: { flex: 1, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  instrumentLabel: { fontSize: 11, color: colors.textMuted },
  instrumentValue: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 4 },
  progressBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  diversionList: { marginTop: spacing.sm, gap: spacing.sm },
  diversionCard: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  diversionCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  diversionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  diversionTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  diversionMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  diversionBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  badgeDanger: {
    color: '#991b1b',
    backgroundColor: '#fee2e2',
  },
  badgeWarning: {
    color: '#9a3412',
    backgroundColor: '#ffedd5',
  },
  badgeNeutral: {
    color: '#92400e',
    backgroundColor: '#fef3c7',
  },
  diversionActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
