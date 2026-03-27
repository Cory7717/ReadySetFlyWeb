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
import { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Callout, Marker, Polyline, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createGdl90Listener, TrafficTarget } from '../utils/gdl90';
import { api } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
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

type RankedTrafficTarget = TrafficTarget & {
  distanceNm: number;
  altitudeDeltaFt: number | null;
  threatScore: number;
  threatLevel: 'immediate' | 'advisory' | 'monitor';
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

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function greatCircleNm(a: AirportMeta, b: AirportMeta) {
  const R = 3440.065;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function projectLatLonToNm(lat: number, lon: number, refLat: number) {
  const latNm = lat * 60;
  const lonNm = lon * 60 * Math.cos((refLat * Math.PI) / 180);
  return { x: lonNm, y: latNm };
}

type MobileRouteProgressSummary = {
  totalRouteNm: number;
  remainingRouteNm: number;
  progressPct: number;
  offRouteNm: number;
  nextWaypoint: string | null;
  etaText: string | null;
};

function computeMobileRouteProgress(
  routePoints: AirportMeta[],
  ownship: { lat: number; lon: number; speedKts?: number | null } | null,
): MobileRouteProgressSummary | null {
  if (!ownship || routePoints.length < 2) return null;

  const legLengths = routePoints.slice(1).map((point, index) => greatCircleNm(routePoints[index], point));
  const totalRouteNm = legLengths.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(totalRouteNm) || totalRouteNm <= 0) return null;

  const refLat = ownship.lat;
  const ownshipPoint = projectLatLonToNm(ownship.lat, ownship.lon, refLat);
  let best:
    | {
        legIndex: number;
        offRouteNm: number;
        traveledNm: number;
      }
    | null = null;

  let traveledBeforeLeg = 0;
  for (let index = 0; index < routePoints.length - 1; index += 1) {
    const start = routePoints[index];
    const end = routePoints[index + 1];
    const startNm = projectLatLonToNm(start.latitude, start.longitude, refLat);
    const endNm = projectLatLonToNm(end.latitude, end.longitude, refLat);
    const dx = endNm.x - startNm.x;
    const dy = endNm.y - startNm.y;
    const legLengthSq = dx * dx + dy * dy;
    const tRaw =
      legLengthSq > 0
        ? ((ownshipPoint.x - startNm.x) * dx + (ownshipPoint.y - startNm.y) * dy) / legLengthSq
        : 0;
    const t = Math.min(1, Math.max(0, tRaw));
    const nearestX = startNm.x + dx * t;
    const nearestY = startNm.y + dy * t;
    const offRouteNm = Math.hypot(ownshipPoint.x - nearestX, ownshipPoint.y - nearestY);
    const legLengthNm = legLengths[index] ?? 0;
    const traveledNm = traveledBeforeLeg + legLengthNm * t;

    if (!best || offRouteNm < best.offRouteNm) {
      best = { legIndex: index, offRouteNm, traveledNm };
    }
    traveledBeforeLeg += legLengthNm;
  }

  if (!best) return null;

  const remainingRouteNm = Math.max(0, totalRouteNm - best.traveledNm);
  const speedKts = ownship.speedKts ?? null;
  const etaText =
    speedKts && speedKts > 20
      ? new Date(Date.now() + (remainingRouteNm / speedKts) * 60 * 60 * 1000).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        })
      : null;

  return {
    totalRouteNm,
    remainingRouteNm,
    progressPct: Math.min(100, Math.max(0, (best.traveledNm / totalRouteNm) * 100)),
    offRouteNm: best.offRouteNm,
    nextWaypoint: routePoints[best.legIndex + 1]?.icao || routePoints[routePoints.length - 1]?.icao || null,
    etaText,
  };
}

function getDistanceNmFromLatLon(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const R = 3440.065;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function rankTrafficTargets(
  trafficTargets: TrafficTarget[],
  ownship: { lat: number; lon: number; altitudeFt?: number } | null,
): RankedTrafficTarget[] {
  if (!ownship) return [];

  return trafficTargets
    .map((target) => {
      const distanceNm = getDistanceNmFromLatLon(
        { lat: ownship.lat, lon: ownship.lon },
        { lat: target.lat, lon: target.lon }
      );
      const altitudeDeltaFt =
        typeof ownship.altitudeFt === 'number' && typeof target.altitudeFt === 'number'
          ? target.altitudeFt - ownship.altitudeFt
          : null;
      const verticalGap = altitudeDeltaFt === null ? 4000 : Math.abs(altitudeDeltaFt);
      const distanceScore = distanceNm <= 2 ? 70 : distanceNm <= 5 ? 45 : distanceNm <= 10 ? 25 : 10;
      const verticalScore = verticalGap <= 500 ? 30 : verticalGap <= 1000 ? 20 : verticalGap <= 2000 ? 10 : 0;
      const threatScore = distanceScore + verticalScore;
      const threatLevel: RankedTrafficTarget['threatLevel'] =
        threatScore >= 80 ? 'immediate' : threatScore >= 45 ? 'advisory' : 'monitor';

      return {
        ...target,
        distanceNm,
        altitudeDeltaFt,
        threatScore,
        threatLevel,
      };
    })
    .sort((a, b) => b.threatScore - a.threatScore || a.distanceNm - b.distanceNm);
}

function pickBestDiversionFrequency(
  airport: NearbyDiversionAirport | null | undefined,
) {
  const entries = airport?.frequencySummary || [];
  const rank = (value: NearbyDiversionAirport['frequencySummary'][number]) => {
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
  const { isAuthenticated } = useIsAuthenticated();
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
  const locationSubRef = useState<{ remove?: () => void }>(() => ({}))[0];
  const mapRef = useRef<MapView | null>(null);

  const [aircraftQuery, setAircraftQuery] = useState('');
  const [aircraftResults, setAircraftResults] = useState<AircraftType[]>([]);
  const [selectedType, setSelectedType] = useState<AircraftType | null>(null);
  const [profiles, setProfiles] = useState<AircraftProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [departureTimeZone, setDepartureTimeZone] = useState('');
  const [destinationTimeZone, setDestinationTimeZone] = useState('');

  const [cruiseKtas, setCruiseKtas] = useState('110');
  const [fuelBurnGph, setFuelBurnGph] = useState('8.5');
  const [usableFuel, setUsableFuel] = useState('40');
  const [maxGrossWeight, setMaxGrossWeight] = useState('2400');
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
  const routeProgress = useMemo(
    () => computeMobileRouteProgress(routePoints, gpsData),
    [gpsData, routePoints]
  );
  const rankedTrafficTargets = useMemo(
    () => rankTrafficTargets(trafficTargets, gpsData),
    [gpsData, trafficTargets]
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

  useEffect(() => {
    const routeParams = route.params || {};
    const nextDeparture = typeof routeParams.departure === 'string' ? routeParams.departure.trim().toUpperCase() : '';
    const nextDestination = typeof routeParams.destination === 'string' ? routeParams.destination.trim().toUpperCase() : '';
    const nextWaypoints = typeof routeParams.waypoints === 'string' ? routeParams.waypoints.trim().toUpperCase() : '';
    const nextPlannedStops = typeof routeParams.plannedStops === 'string' ? routeParams.plannedStops.trim().toUpperCase() : '';

    if (nextDeparture) setDeparture(nextDeparture);
    if (nextDestination) setDestination(nextDestination);
    if (nextWaypoints) setWaypoints(nextWaypoints);
    if (nextPlannedStops) setPlannedStops(nextPlannedStops);
  }, [route.params]);

  useEffect(() => {
    if (trafficEnabled || gpsEnabled) {
      activateKeepAwake();
    } else {
      deactivateKeepAwake();
    }
  }, [trafficEnabled, gpsEnabled]);

  useEffect(() => {
    let cancelled = false;
    if (!gpsData?.lat || !gpsData?.lon) {
      setDiversionCandidates([]);
      setDiversionLoading(false);
      setDiversionError(null);
      return;
    }

    setDiversionLoading(true);
    setDiversionError(null);
    api
      .get<NearbyDiversionResponse>('/api/airports/nearby', {
        params: {
          lat: gpsData.lat,
          lon: gpsData.lon,
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
  }, [gpsData?.lat, gpsData?.lon]);

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
      setCruiseKtas(String(effectiveProfile.cruiseKtasEffective || ''));
      setFuelBurnGph(String(effectiveProfile.fuelBurnGphEffective || ''));
      setUsableFuel(String(effectiveProfile.usableFuelGalEffective || ''));
      setMaxGrossWeight(String(effectiveProfile.maxGrossWeightLbEffective || ''));
    }
  }, [effectiveProfile]);

  useEffect(() => {
    if (selectedType) {
      setCruiseKtas(String(selectedType.cruiseKtas));
      setFuelBurnGph(String(selectedType.fuelBurnGph));
      setUsableFuel(String(selectedType.usableFuelGal));
      setMaxGrossWeight(String(selectedType.maxGrossWeightLb));
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
              {gpsEnabled || trafficEnabled ? 'Cockpit on' : 'Preflight'}
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
          <TouchableOpacity style={styles.heroPrimaryAction} onPress={buildRoute} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.heroPrimaryActionText}>Build route</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.heroSecondaryAction}
            onPress={() => navigation?.navigate?.('LogbookPro')}
          >
            <Text style={styles.heroSecondaryActionText}>Membership</Text>
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
        <TouchableOpacity style={styles.primaryButton} onPress={buildRoute} disabled={loading}>
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
          >
            <Text style={styles.mapToggleText}>{gpsEnabled ? 'On' : 'Off'}</Text>
          </TouchableOpacity>
        </View>
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
              <Text style={styles.instrumentValue}>{gpsData?.altitudeFt ? `${gpsData.altitudeFt.toFixed(0)} ft` : '-'}</Text>
            </View>
            <View style={styles.instrumentBox}>
              <Text style={styles.instrumentLabel}>Groundspeed</Text>
              <Text style={styles.instrumentValue}>{gpsData?.speedKts ? `${gpsData.speedKts.toFixed(0)} kt` : '-'}</Text>
            </View>
          </View>
          <View style={styles.instrumentRow}>
            <View style={styles.instrumentBox}>
              <Text style={styles.instrumentLabel}>Track</Text>
              <Text style={styles.instrumentValue}>{gpsData?.heading ? `${gpsData.heading.toFixed(0)}°` : '-'}</Text>
            </View>
            <View style={styles.instrumentBox}>
              <Text style={styles.instrumentLabel}>Vert Speed</Text>
              <Text style={styles.instrumentValue}>{verticalSpeedFpm ? `${verticalSpeedFpm.toFixed(0)} fpm` : '-'}</Text>
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
                  setSelectedType(item);
                  setSelectedProfileId(null);
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
                    setSelectedProfileId(profile.id);
                    setSelectedType(null);
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
            <TextInput style={styles.input} value={cruiseKtas} onChangeText={setCruiseKtas} keyboardType="numeric" />
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Fuel Burn (GPH)</Text>
            <TextInput style={styles.input} value={fuelBurnGph} onChangeText={setFuelBurnGph} keyboardType="numeric" />
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Usable Fuel (gal)</Text>
            <TextInput style={styles.input} value={usableFuel} onChangeText={setUsableFuel} keyboardType="numeric" />
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Max Gross (lb)</Text>
            <TextInput style={styles.input} value={maxGrossWeight} onChangeText={setMaxGrossWeight} keyboardType="numeric" />
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
              <Text style={styles.legText}>{leg.from} -> {leg.to}</Text>
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
