import {
  ActivityIndicator,
  Alert,
  Platform,
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
import Constants from 'expo-constants';
import MapView, { Callout, Marker, Polyline, PROVIDER_GOOGLE, UrlTile, WMSTile } from 'react-native-maps';
import * as Location from 'expo-location';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AttitudeReport, createGdl90Listener, OwnshipReport, ReceiverHealth, TrafficTarget } from '../utils/gdl90';
import { api } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
import {
  buildArrivalRunwayCue,
  buildArrivalRunwayOverlay,
  buildDepartureRunwayOverlay,
  buildVisionObstacleCues,
  buildVisionTrafficCue,
  buildVisionTerrainColumns,
  type RunwayOverlay,
  type VisionRunwayCue,
} from '@shared/flight-scene';
import {
  annotateMobileRouteExecutionPlan,
  bearingBetweenPoints,
  buildMobileRouteLegs,
  buildMobileRouteExecutionPlan,
  buildMobileRouteProcedureChains,
  clamp,
  computeMobileRouteProgress,
  getMobileRouteLegBehavior,
  getMobileRouteProcedureChainBehavior,
  getMobileRouteProcedureCueStack,
  getMobileRouteProcedureContext,
  getMobileRouteProcedureEntryDescriptor,
  getMobileRouteProcedureEntryRole,
  getMobileRouteProcedureExecutionProfile,
  getMobileRouteProcedureEntryTransitionBehavior,
  getMobileRouteProcedureRoleExecutionPolicy,
  getMobileRouteProcedureRoleCueProfile,
  getMobileRouteProcedureTransitionTable,
  getMobileRouteProcedureTemplate,
  getMobileRouteExecutionSegment,
  getDistanceNmFromLatLon,
  greatCircleNm,
  interpolateRouteOwnship,
  normalizeHeadingDelta,
  offsetLatLonByNm,
  rankTrafficTargets,
} from '../lib/flightMath';
import type { MobileRouteLeg, MobileRouteNavDataLegPayload, MobileRouteProgressSummary } from '../lib/flightMath';
import { analyzeFiledRoute, isFiledRouteAnchorKind } from '@shared/flight-plan-route';
import { getFlightDeckSourceArbitrationState } from '../lib/sourceArbitration';
import FlightDeckView from '../components/flight-deck/FlightDeckView';
import FormDateTimeField from '../components/FormDateTimeField';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';
import { diagnosticsEnabled, logDiagnostic, warnDiagnostic } from '../utils/diagnostics';

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

const FAA_SECTIONAL_WMS_TEMPLATE =
  'https://sua.faa.gov/geoserver/wms?service=WMS&request=GetMap&layers=SUA:us_sectionals&styles=&format=image/png&transparent=false&version=1.1.1&srs=EPSG:900913&bbox={minX},{minY},{maxX},{maxY}&width={width}&height={height}';

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

type RouteSearchResponse = {
  provider?: string | null;
  environment?: string | null;
  route?: string | null;
  atcRecentIFRRoutes?: string[];
  codedDepartureRoutes?: string[];
  faaPreferredRoutes?: string[];
  warnings?: string[];
  available?: boolean;
  message?: string | null;
};

type RunwayBriefingResponse = {
  icao?: string | null;
  runwayInUse?: string | null;
  advisory?: {
    runway?: string | null;
    heading?: number | null;
    headwind?: number | null;
    crosswind?: number | null;
  } | null;
  runways?: Array<{
    leIdent?: string | null;
    heIdent?: string | null;
    leHeading?: number | null;
    heHeading?: number | null;
    lengthFt?: number | null;
    surface?: string | null;
  }> | null;
};

type AirportFrequencyResponse = {
  icao?: string | null;
  frequencies?: Array<{
    type?: string | null;
    description?: string | null;
    frequencyMhz?: number | null;
  }> | null;
};

type DestinationRunwayCue = VisionRunwayCue;
type DestinationRunwayOverlay = RunwayOverlay;

type FlightDeckSurfacePoint = {
  x: number;
  y: number;
};

type SurfaceGeometryFeature = {
  type: 'Feature';
  geometry:
    | { type: 'LineString'; coordinates: [number, number][] }
    | { type: 'Polygon'; coordinates: [number, number][][] };
  properties: {
    aeroway: string;
    name: string | null;
    ref: string | null;
    surface: string | null;
  };
};

type AirportSurfaceGeometryResponse = {
  icao: string;
  source: string;
  fetchedAt: string;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  features: SurfaceGeometryFeature[];
};

type FlightDeckSurfaceGeoPoint = {
  lat: number;
  lon: number;
  headingDeg?: number;
};

type FlightDeckSurfacePreview = {
  airportIcao: string;
  runwayId: string;
  runwayHeadingDeg: number;
  mode: 'departure' | 'arrival';
  progressPct: number;
  headline: string;
  support: string;
  routeCall: string;
  clearanceLabel: string;
  holdShortActive: boolean;
  runwayOccupied: boolean;
  runwayMeta: string;
  groundFreq: string;
  towerFreq: string;
  atisFreq: string;
  ownship: { x: number; y: number; headingDeg: number };
  route: FlightDeckSurfacePoint[];
  secondaryRoute: FlightDeckSurfacePoint[];
  geoOwnship: FlightDeckSurfaceGeoPoint;
  geoRoute: FlightDeckSurfaceGeoPoint[];
  geoCompletedRoute: FlightDeckSurfaceGeoPoint[];
  geoUpcomingRoute: FlightDeckSurfaceGeoPoint[];
  geoRunwayCenterline: FlightDeckSurfaceGeoPoint[];
  geoRunwayBar: FlightDeckSurfaceGeoPoint[];
  surfaceFeatures: SurfaceGeometryFeature[];
  activeTaxiway: string;
  upcomingTaxiways: string[];
  progressCall: string;
  nextActionCall: string;
  cameraModeLabel: string;
  nextTurnDistanceNm: number | null;
  surfaceRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
};

type FlightDeckRunwayOpsSummary = {
  airportIcao: string;
  runwayId: string;
  runwayHeadingDeg: number;
  runwayMeta: string;
  phaseCall: string;
  headwindKt: number | null;
  crosswindKt: number | null;
  groundFreq: string;
  towerFreq: string;
  atisFreq: string;
  sourceLabel: string;
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
  updatedAt?: number;
  source?: 'simulation' | 'receiver' | 'device';
};

type ReceiverAttitudeData = {
  pitchDeg?: number;
  rollDeg?: number;
  headingDeg?: number;
  headingReference?: 'true' | 'magnetic';
  indicatedAirspeedKts?: number;
  trueAirspeedKts?: number;
  updatedAt?: number;
  source?: 'receiver';
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

type FlightDeckPanel = 'status' | 'surface' | 'layers' | 'traffic' | 'diversions';
type FlightDeckView = 'split' | 'map' | 'vision';
type FlightDeckActionTone = 'default' | 'accent' | 'caution' | 'warning';
type FlightDeckPhaseStage =
  | 'preflight'
  | 'taxi-out'
  | 'departure'
  | 'climb'
  | 'cruise'
  | 'descent'
  | 'arrival'
  | 'final'
  | 'taxi-in';
type RouteExecutionOverride = {
  mode: 'direct-to-diversion' | 'direct-to-route';
  origin: AirportMeta;
  target: AirportMeta;
  activatedAt: number;
  targetLegIndex?: number | null;
};

const RECEIVER_OWNSHIP_STALE_MS = 15000;
const DEVICE_OWNSHIP_STALE_MS = 15000;
const RECEIVER_ATTITUDE_STALE_MS = 5000;

function formatOwnshipAge(ms: number | null | undefined) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '--';
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

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

function pickAirportFrequency(
  response: AirportFrequencyResponse | null | undefined,
  keywords: string[],
) {
  const entries = Array.isArray(response?.frequencies) ? response.frequencies : [];
  const loweredKeywords = keywords.map((keyword) => keyword.toLowerCase());
  return (
    entries.find((entry) => {
      const type = String(entry?.type || '').toLowerCase();
      const description = String(entry?.description || '').toLowerCase();
      return loweredKeywords.some((keyword) => type.includes(keyword) || description.includes(keyword));
    }) || null
  );
}

function localSurfacePointToGeo({
  point,
  airport,
  runwayHeadingDeg,
  nmPerUnit,
}: {
  point: { x: number; y: number };
  airport: { latitude: number; longitude: number };
  runwayHeadingDeg: number;
  nmPerUnit: number;
}) {
  const eastUnits = point.x - 70;
  const northUnits = 50 - point.y;
  const distanceNm = Math.hypot(eastUnits, northUnits) * nmPerUnit;
  if (!Number.isFinite(distanceNm) || distanceNm <= 0.0001) {
    return { lat: airport.latitude, lon: airport.longitude };
  }

  const localBearingDeg = ((Math.atan2(eastUnits, northUnits) * 180) / Math.PI + 360) % 360;
  return offsetLatLonByNm(
    airport.latitude,
    airport.longitude,
    Math.cos(((runwayHeadingDeg + localBearingDeg) * Math.PI) / 180) * distanceNm,
    Math.sin(((runwayHeadingDeg + localBearingDeg) * Math.PI) / 180) * distanceNm,
  );
}

function flattenSurfaceLineCoordinates(features: SurfaceGeometryFeature[]) {
  return features.flatMap((feature) => {
    if (feature.geometry.type !== 'LineString') return [] as Array<{ lat: number; lon: number }>;
    if (!['taxiway', 'taxilane', 'runway', 'holding_position'].includes(feature.properties.aeroway)) {
      return [] as Array<{ lat: number; lon: number }>;
    }
    return feature.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
  });
}

function snapSurfacePoints(
  points: Array<{ lat: number; lon: number }>,
  features: SurfaceGeometryFeature[],
  thresholdNm = 0.09,
) {
  const candidates = flattenSurfaceLineCoordinates(features);
  if (!candidates.length) return points;

  return points.map((point) => {
    let nearest = point;
    let nearestDistance = Number.POSITIVE_INFINITY;
    candidates.forEach((candidate) => {
      const distance = greatCircleNm(
        { latitude: point.lat, longitude: point.lon },
        { latitude: candidate.lat, longitude: candidate.lon },
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = candidate;
      }
    });
    return nearestDistance <= thresholdNm ? nearest : point;
  });
}

function getSurfaceLineFeatures(features: SurfaceGeometryFeature[]) {
  return features.filter(
    (feature) =>
      feature.geometry.type === 'LineString' &&
      ['taxiway', 'taxilane', 'runway', 'holding_position'].includes(feature.properties.aeroway),
  );
}

function getSurfaceFeatureLabel(feature: SurfaceGeometryFeature) {
  const ref = feature.properties.ref?.trim();
  const name = feature.properties.name?.trim();
  if (ref) return ref;
  if (name) return name;
  if (feature.properties.aeroway === 'holding_position') return 'Hold short';
  return feature.properties.aeroway.replace(/_/g, ' ');
}

function deriveGeoProgressAlongRoute(
  route: Array<{ lat: number; lon: number }>,
  progress: number,
) {
  if (route.length < 2) {
    const point = route[0] || { lat: 0, lon: 0 };
    return {
      route,
      completedRoute: route,
      upcomingRoute: route,
      ownship: { ...point, headingDeg: 0 },
    };
  }

  const legDistances = route.slice(1).map((point, index) =>
    greatCircleNm(
      { latitude: route[index].lat, longitude: route[index].lon },
      { latitude: point.lat, longitude: point.lon },
    ),
  );
  const totalDistance = legDistances.reduce((sum, value) => sum + value, 0);
  const targetDistance = totalDistance * clamp(progress, 0, 1);
  let traversed = 0;
  let activeSegmentIndex = 0;
  let ownship = {
    lat: route[0].lat,
    lon: route[0].lon,
    headingDeg: bearingBetweenPoints(
      { latitude: route[0].lat, longitude: route[0].lon },
      { latitude: route[1].lat, longitude: route[1].lon },
    ),
  };

  for (let i = 0; i < legDistances.length; i += 1) {
    const legDistance = legDistances[i];
    const nextTraversed = traversed + legDistance;
    if (targetDistance <= nextTraversed || i === legDistances.length - 1) {
      const start = route[i];
      const end = route[i + 1];
      const localT = legDistance > 0 ? clamp((targetDistance - traversed) / legDistance, 0, 1) : 0;
      ownship = {
        lat: start.lat + (end.lat - start.lat) * localT,
        lon: start.lon + (end.lon - start.lon) * localT,
        headingDeg: bearingBetweenPoints(
          { latitude: start.lat, longitude: start.lon },
          { latitude: end.lat, longitude: end.lon },
        ),
      };
      activeSegmentIndex = i;
      break;
    }
    traversed = nextTraversed;
  }

  return {
    route,
    completedRoute: [...route.slice(0, activeSegmentIndex + 1), { lat: ownship.lat, lon: ownship.lon }],
    upcomingRoute: [{ lat: ownship.lat, lon: ownship.lon }, ...route.slice(activeSegmentIndex + 1)],
    ownship,
  };
}

function deriveTaxiRouteFromSurfaceGeometry(
  baseRoute: Array<{ lat: number; lon: number }>,
  features: SurfaceGeometryFeature[],
  taxiProgress: number,
) {
  const lineFeatures = getSurfaceLineFeatures(features);
  if (baseRoute.length < 2 || !lineFeatures.length) return null;

  const nodeIndexByKey = new Map<string, number>();
  const nodes: Array<{ lat: number; lon: number }> = [];
  const adjacency = new Map<number, Array<{ to: number; cost: number }>>();

  const ensureNode = (lat: number, lon: number) => {
    const key = `${lat.toFixed(6)}:${lon.toFixed(6)}`;
    const existing = nodeIndexByKey.get(key);
    if (existing != null) return existing;
    const index = nodes.length;
    nodes.push({ lat, lon });
    nodeIndexByKey.set(key, index);
    adjacency.set(index, []);
    return index;
  };

  lineFeatures.forEach((feature) => {
    if (feature.geometry.type !== 'LineString') return;
    for (let i = 0; i < feature.geometry.coordinates.length - 1; i += 1) {
      const [startLon, startLat] = feature.geometry.coordinates[i];
      const [endLon, endLat] = feature.geometry.coordinates[i + 1];
      const startIndex = ensureNode(startLat, startLon);
      const endIndex = ensureNode(endLat, endLon);
      const cost = greatCircleNm(
        { latitude: startLat, longitude: startLon },
        { latitude: endLat, longitude: endLon },
      );
      adjacency.get(startIndex)?.push({ to: endIndex, cost });
      adjacency.get(endIndex)?.push({ to: startIndex, cost });
    }
  });

  if (nodes.length < 2) return null;

  const nearestNodeIndex = (point: { lat: number; lon: number }) => {
    let winner = -1;
    let winnerDistance = Number.POSITIVE_INFINITY;
    nodes.forEach((node, index) => {
      const distance = greatCircleNm(
        { latitude: point.lat, longitude: point.lon },
        { latitude: node.lat, longitude: node.lon },
      );
      if (distance < winnerDistance) {
        winnerDistance = distance;
        winner = index;
      }
    });
    return { index: winner, distanceNm: winnerDistance };
  };

  const startMatch = nearestNodeIndex(baseRoute[0]);
  const endMatch = nearestNodeIndex(baseRoute[baseRoute.length - 1]);
  if (startMatch.index < 0 || endMatch.index < 0 || startMatch.distanceNm > 0.35 || endMatch.distanceNm > 0.35) {
    return null;
  }

  const distances = new Array<number>(nodes.length).fill(Number.POSITIVE_INFINITY);
  const previous = new Array<number>(nodes.length).fill(-1);
  const visited = new Set<number>();
  distances[startMatch.index] = 0;

  while (visited.size < nodes.length) {
    let current = -1;
    let currentDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < distances.length; i += 1) {
      if (!visited.has(i) && distances[i] < currentDistance) {
        current = i;
        currentDistance = distances[i];
      }
    }
    if (current === -1 || current === endMatch.index) break;
    visited.add(current);
    adjacency.get(current)?.forEach(({ to, cost }) => {
      const nextDistance = currentDistance + cost;
      if (nextDistance < distances[to]) {
        distances[to] = nextDistance;
        previous[to] = current;
      }
    });
  }

  if (!Number.isFinite(distances[endMatch.index])) return null;

  const nodePath: number[] = [];
  let cursor = endMatch.index;
  while (cursor !== -1) {
    nodePath.push(cursor);
    cursor = previous[cursor];
  }
  nodePath.reverse();
  const route = nodePath.map((index) => nodes[index]);
  if (route.length < 2) return null;

  const progressState = deriveGeoProgressAlongRoute(route, taxiProgress);

  const pointDistanceToFeature = (point: { lat: number; lon: number }, feature: SurfaceGeometryFeature) => {
    if (feature.geometry.type !== 'LineString') return Number.POSITIVE_INFINITY;
    return feature.geometry.coordinates.reduce((best, [lon, lat]) => {
      const distance = greatCircleNm(
        { latitude: point.lat, longitude: point.lon },
        { latitude: lat, longitude: lon },
      );
      return Math.min(best, distance);
    }, Number.POSITIVE_INFINITY);
  };

  const nearestFeatureLabel = (point: { lat: number; lon: number }) => {
    let match: SurfaceGeometryFeature | null = null;
    let matchDistance = Number.POSITIVE_INFINITY;
    lineFeatures.forEach((feature) => {
      const distance = pointDistanceToFeature(point, feature);
      if (distance < matchDistance) {
        match = feature;
        matchDistance = distance;
      }
    });
    return match ? getSurfaceFeatureLabel(match) : null;
  };

  return {
    ...progressState,
    activeTaxiway: nearestFeatureLabel(progressState.ownship),
    upcomingTaxiways: progressState.upcomingRoute
      .slice(1, 5)
      .map((point) => nearestFeatureLabel(point))
      .filter((label, index, array): label is string => Boolean(label) && array.indexOf(label) === index)
      .slice(0, 3),
  };
}

function buildSurfaceRegion({
  ownship,
  route,
  runwayCenterline,
  runwayBar,
  mode,
  holdShortActive,
  runwayOccupied,
}: {
  ownship: { lat: number; lon: number };
  route: Array<{ lat: number; lon: number }>;
  runwayCenterline: Array<{ lat: number; lon: number }>;
  runwayBar?: Array<{ lat: number; lon: number }>;
  mode: 'departure' | 'arrival';
  holdShortActive: boolean;
  runwayOccupied: boolean;
}) {
  const forwardRoute = route.slice(0, mode === 'departure' ? 5 : 4);
  const points = [
    ownship,
    ...forwardRoute,
    ...(holdShortActive || runwayOccupied ? runwayCenterline : runwayCenterline.slice(0, 2)),
    ...(holdShortActive || runwayOccupied ? runwayBar || [] : []),
  ].filter(
    (point) =>
      typeof point?.lat === 'number' &&
      Number.isFinite(point.lat) &&
      typeof point?.lon === 'number' &&
      Number.isFinite(point.lon),
  );

  if (!points.length) {
    return {
      latitude: 39.5,
      longitude: -98.35,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }

  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lon);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.7, mode === 'departure' ? 0.0035 : 0.0045),
    longitudeDelta: Math.max((maxLon - minLon) * 2.0, mode === 'departure' ? 0.0045 : 0.0055),
  };
}

function deriveSurfaceNextAction({
  ownship,
  upcomingRoute,
  activeTaxiway,
  upcomingTaxiways,
  holdShortActive,
  runwayOccupied,
  runwayId,
}: {
  ownship: { lat: number; lon: number; headingDeg: number };
  upcomingRoute: Array<{ lat: number; lon: number }>;
  activeTaxiway: string;
  upcomingTaxiways: string[];
  holdShortActive: boolean;
  runwayOccupied: boolean;
  runwayId: string;
}) {
  if (holdShortActive) {
    return {
      nextActionCall: `Hold short runway ${runwayId}. Await tower release.`,
      cameraModeLabel: 'Hold short focus',
      nextTurnDistanceNm: null,
    };
  }
  if (runwayOccupied) {
    return {
      nextActionCall: `Runway ${runwayId} occupied. Continue only when cleared.`,
      cameraModeLabel: 'Runway focus',
      nextTurnDistanceNm: null,
    };
  }

  if (upcomingRoute.length >= 3) {
    const legA = bearingBetweenPoints(
      { latitude: upcomingRoute[0].lat, longitude: upcomingRoute[0].lon },
      { latitude: upcomingRoute[1].lat, longitude: upcomingRoute[1].lon },
    );
    const legB = bearingBetweenPoints(
      { latitude: upcomingRoute[1].lat, longitude: upcomingRoute[1].lon },
      { latitude: upcomingRoute[2].lat, longitude: upcomingRoute[2].lon },
    );
    const delta = normalizeHeadingDelta(legB - legA);
    const turnDistanceNm = greatCircleNm(
      { latitude: ownship.lat, longitude: ownship.lon },
      { latitude: upcomingRoute[1].lat, longitude: upcomingRoute[1].lon },
    );
    if (Math.abs(delta) >= 20) {
      return {
        nextActionCall: `Next ${delta > 0 ? 'right' : 'left'} turn in ${turnDistanceNm.toFixed(2)} NM${upcomingTaxiways[0] ? ` toward ${upcomingTaxiways[0]}` : ''}.`,
        cameraModeLabel: 'Turn-ahead focus',
        nextTurnDistanceNm: turnDistanceNm,
      };
    }
  }

  return {
    nextActionCall: activeTaxiway
      ? `Continue on ${activeTaxiway}${upcomingTaxiways[0] ? ` toward ${upcomingTaxiways[0]}` : ''}.`
      : 'Continue taxi along the active ground path.',
    cameraModeLabel: 'Ownship follow',
    nextTurnDistanceNm: null,
  };
}

function buildTacticalMapRegion({
  phaseStage,
  ownship,
  routePoints,
  routeProgress,
  activeRunwayOverlay,
  selectedTrafficTarget,
  selectedDiversionPoint,
}: {
  phaseStage?: FlightDeckPhaseStage | null;
  ownship: OwnshipData | null;
  routePoints: Array<{ latitude: number; longitude: number }>;
  routeProgress: MobileRouteProgressSummary | null;
  activeRunwayOverlay: RunwayOverlay | null;
  selectedTrafficTarget?: RankedTrafficTarget | null;
  selectedDiversionPoint?: { latitude: number; longitude: number } | null;
}) {
  if (!ownship && !routePoints.length) return null;

  const ownshipPoint = ownship
    ? [{ latitude: ownship.lat, longitude: ownship.lon }]
    : [];
  const activeLegIndex = routeProgress?.legIndex ?? 0;
  const routeWindow =
    phaseStage === 'taxi-out' || phaseStage === 'taxi-in'
      ? routePoints.slice(activeLegIndex, activeLegIndex + 2)
      : phaseStage === 'departure' || phaseStage === 'arrival' || phaseStage === 'final'
        ? routePoints.slice(activeLegIndex, activeLegIndex + 4)
        : routePoints.slice(activeLegIndex, activeLegIndex + 5);
  const runwayPoints = [
    ...(activeRunwayOverlay?.centerline || []),
    ...(activeRunwayOverlay?.runwayBar || []),
  ];
  const trafficPoint =
    selectedTrafficTarget && (selectedTrafficTarget.threatLevel === 'immediate' || selectedTrafficTarget.threatLevel === 'advisory')
      ? [{ latitude: selectedTrafficTarget.lat, longitude: selectedTrafficTarget.lon }]
      : [];
  const diversionPoint = selectedDiversionPoint ? [selectedDiversionPoint] : [];

  const focusPoints = [
    ...ownshipPoint,
    ...routeWindow,
    ...(phaseStage === 'taxi-out' || phaseStage === 'taxi-in' || phaseStage === 'departure' || phaseStage === 'arrival' || phaseStage === 'final'
      ? runwayPoints
      : []),
    ...(phaseStage === 'cruise' || phaseStage === 'descent' || phaseStage === 'arrival' ? diversionPoint : []),
    ...(phaseStage !== 'taxi-out' && phaseStage !== 'taxi-in' ? trafficPoint : []),
  ].filter(
    (point) =>
      typeof point?.latitude === 'number' &&
      Number.isFinite(point.latitude) &&
      typeof point?.longitude === 'number' &&
      Number.isFinite(point.longitude),
  );

  if (!focusPoints.length) return null;

  const latitudes = focusPoints.map((point) => point.latitude);
  const longitudes = focusPoints.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLon + maxLon) / 2;

  const minLatDelta =
    phaseStage === 'taxi-out' || phaseStage === 'taxi-in'
      ? 0.010
      : phaseStage === 'departure' || phaseStage === 'arrival' || phaseStage === 'final'
        ? 0.07
        : phaseStage === 'climb' || phaseStage === 'descent'
          ? 0.16
          : 0.28;
  const minLonDelta =
    phaseStage === 'taxi-out' || phaseStage === 'taxi-in'
      ? 0.014
      : phaseStage === 'departure' || phaseStage === 'arrival' || phaseStage === 'final'
        ? 0.1
        : phaseStage === 'climb' || phaseStage === 'descent'
          ? 0.22
          : 0.38;

  return {
    latitude,
    longitude,
    latitudeDelta: Math.max((maxLat - minLat) * 1.85, minLatDelta),
    longitudeDelta: Math.max((maxLon - minLon) * 2.05, minLonDelta),
  };
}

function formatTacticalRangeNm(region: { latitudeDelta: number; longitudeDelta: number } | null) {
  if (!region) return '--';
  const approxRange = Math.max(region.latitudeDelta * 60, region.longitudeDelta * 35);
  return `${Math.round(approxRange)} NM`;
}

function offsetGeoPoint(point: { lat: number; lon: number }, bearingDeg: number, distanceNm: number) {
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const northNm = Math.cos(bearingRad) * distanceNm;
  const eastNm = Math.sin(bearingRad) * distanceNm;
  return offsetLatLonByNm(point.lat, point.lon, northNm, eastNm);
}

function projectPointAlongRoute(
  routePoints: Array<{ latitude: number; longitude: number }>,
  startPoint: { latitude: number; longitude: number },
  activeLegIndex: number,
  distanceNm: number,
) {
  const clampedDistanceNm = Math.max(0, distanceNm);
  const path = [
    startPoint,
    ...routePoints
      .slice(Math.max(activeLegIndex + 1, 0))
      .map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
  ];
  if (path.length < 2 || clampedDistanceNm <= 0.01) return startPoint;

  let remainingNm = clampedDistanceNm;
  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index];
    const end = path[index + 1];
    const legDistanceNm = greatCircleNm(start, end);
    if (!Number.isFinite(legDistanceNm) || legDistanceNm <= 0.01) continue;
    if (remainingNm <= legDistanceNm) {
      const ratio = clamp(remainingNm / legDistanceNm, 0, 1);
      return {
        latitude: start.latitude + (end.latitude - start.latitude) * ratio,
        longitude: start.longitude + (end.longitude - start.longitude) * ratio,
      };
    }
    remainingNm -= legDistanceNm;
  }

  return path[path.length - 1];
}

function formatFrequency(frequencyMhz: number | null | undefined) {
  return typeof frequencyMhz === 'number' && Number.isFinite(frequencyMhz)
    ? frequencyMhz.toFixed(3)
    : '--';
}

function formatAltitudeDelta(altitudeDeltaFt: number | null | undefined) {
  if (typeof altitudeDeltaFt !== 'number' || !Number.isFinite(altitudeDeltaFt)) return 'alt unknown';
  return `${altitudeDeltaFt >= 0 ? '+' : '-'}${Math.round(altitudeDeltaFt)} ft`;
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

function normalizeRunwayIdent(value?: string | null) {
  return String(value || '')
    .toUpperCase()
    .replace(/^RWY\s*/i, '')
    .trim();
}

function resolveDestinationRunway(briefing: RunwayBriefingResponse | null | undefined) {
  if (!briefing) return null;
  const desiredId = normalizeRunwayIdent(briefing.advisory?.runway || briefing.runwayInUse);
  const runways = Array.isArray(briefing.runways) ? briefing.runways : [];

  for (const runway of runways) {
    const leIdent = normalizeRunwayIdent(runway.leIdent);
    const heIdent = normalizeRunwayIdent(runway.heIdent);
    if (desiredId && desiredId === leIdent && runway.leHeading != null) {
      return {
        runwayId: desiredId,
        headingDeg: runway.leHeading,
        lengthFt: runway.lengthFt ?? null,
        surface: runway.surface ?? null,
      };
    }
    if (desiredId && desiredId === heIdent && runway.heHeading != null) {
      return {
        runwayId: desiredId,
        headingDeg: runway.heHeading,
        lengthFt: runway.lengthFt ?? null,
        surface: runway.surface ?? null,
      };
    }
  }

  if (briefing.advisory?.heading != null) {
    return {
      runwayId: desiredId || normalizeRunwayIdent(briefing.advisory?.runway) || 'RWY',
      headingDeg: briefing.advisory.heading,
      lengthFt: null,
      surface: null,
    };
  }

  const fallback = runways
    .flatMap((runway) => [
      runway.leHeading != null
        ? {
            runwayId: normalizeRunwayIdent(runway.leIdent) || 'RWY',
            headingDeg: runway.leHeading,
            lengthFt: runway.lengthFt ?? null,
            surface: runway.surface ?? null,
          }
        : null,
      runway.heHeading != null
        ? {
            runwayId: normalizeRunwayIdent(runway.heIdent) || 'RWY',
            headingDeg: runway.heHeading,
            lengthFt: runway.lengthFt ?? null,
            surface: runway.surface ?? null,
          }
        : null,
    ])
    .filter(Boolean)
    .sort((a, b) => (b?.lengthFt || 0) - (a?.lengthFt || 0))[0];

  return fallback || null;
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

function buildStructuredCourseFixNavDataLegs(
  legs: MobileRouteLeg[],
  routeAnchorTokens: string[],
  plannedAltitudeFt: number | undefined,
): Record<number, MobileRouteNavDataLegPayload | undefined> {
  if (routeAnchorTokens.length !== legs.length + 1) {
    return {};
  }
  return legs.reduce<Record<number, MobileRouteNavDataLegPayload | undefined>>((acc, leg, index) => {
    if (leg.legType === 'direct-to') return acc;
    const fromFix = routeAnchorTokens[index];
    const toFix = routeAnchorTokens[index + 1];
    acc[leg.index] = {
      kind: 'course-fix-nav-data',
      sourceKind: 'route-structure',
      label: `${fromFix} to ${toFix}`,
      fromFix,
      toFix,
      courseDeg: leg.courseDeg,
      distanceNm: leg.nm,
      altitudeConstraintFt: plannedAltitudeFt ?? null,
      sourceCycle: 'route-structure',
    };
    return acc;
  }, {});
}

function buildProviderCourseFixNavDataLegs(
  legs: MobileRouteLeg[],
  routeAnchorTokens: string[],
  plannedAltitudeFt: number | undefined,
  sourceCycle: string | null,
): Record<number, MobileRouteNavDataLegPayload | undefined> {
  if (routeAnchorTokens.length !== legs.length + 1) {
    return {};
  }
  return legs.reduce<Record<number, MobileRouteNavDataLegPayload | undefined>>((acc, leg, index) => {
    if (leg.legType === 'direct-to') return acc;
    const fromFix = routeAnchorTokens[index];
    const toFix = routeAnchorTokens[index + 1];
    acc[leg.index] = {
      kind: 'course-fix-nav-data',
      sourceKind: 'nav-data',
      label: `${fromFix} to ${toFix}`,
      fromFix,
      toFix,
      courseDeg: leg.courseDeg,
      distanceNm: leg.nm,
      altitudeConstraintFt: plannedAltitudeFt ?? null,
      sourceCycle,
    };
    return acc;
  }, {});
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
  const [routeSummary, setRouteSummary] = useState<{ totalNm: number; legs: MobileRouteLeg[] } | null>(null);
  const [routePoints, setRoutePoints] = useState<AirportMeta[]>([]);
  const [activeLegIndex, setActiveLegIndex] = useState(0);
  const [sequencingSuspended, setSequencingSuspended] = useState(false);
  const [routeExecutionOverride, setRouteExecutionOverride] = useState<RouteExecutionOverride | null>(null);
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
  const [plannerMapLayoutReady, setPlannerMapLayoutReady] = useState(false);
  const [plannerMapReady, setPlannerMapReady] = useState(false);
  const [plannerMapRenderTimedOut, setPlannerMapRenderTimedOut] = useState(false);
  const [trafficEnabled, setTrafficEnabled] = useState(false);
  const [trafficPort, setTrafficPort] = useState('4000');
  const [trafficTargets, setTrafficTargets] = useState<TrafficTarget[]>([]);
  const [receiverOwnship, setReceiverOwnship] = useState<OwnshipData | null>(null);
  const [receiverAttitude, setReceiverAttitude] = useState<ReceiverAttitudeData | null>(null);
  const [receiverHealth, setReceiverHealth] = useState<ReceiverHealth | null>(null);
  const [trafficFilter, setTrafficFilter] = useState<'all' | 'conflict' | 'above' | 'below'>('all');
  const [trafficStatus, setTrafficStatus] = useState<'idle' | 'listening' | 'error'>('idle');
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const trafficListenerRef = useState<{ stop?: () => void }>(() => ({}))[0];
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'listening' | 'error'>('idle');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsData, setGpsData] = useState<OwnshipData | null>(null);
  const [verticalSpeedFpm, setVerticalSpeedFpm] = useState<number | null>(null);
  const [simulationEnabled, setSimulationEnabled] = useState(false);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationSpeed, setSimulationSpeed] = useState<'1x' | '4x' | '8x'>('4x');
  const [flightDeckPanel, setFlightDeckPanel] = useState<FlightDeckPanel>('status');
  const [flightDeckView, setFlightDeckView] = useState<FlightDeckView>('split');
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
  const [ownshipClockMs, setOwnshipClockMs] = useState(() => Date.now());
  const [simulatedVerticalSpeedFpm, setSimulatedVerticalSpeedFpm] = useState<number | null>(null);
  const locationSubRef = useState<{ remove?: () => void }>(() => ({}))[0];
  const mapRef = useRef<MapView | null>(null);
  const flightDeckChromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flightDeckAutoPanelRef = useRef<string | null>(null);
  const flightDeckMapFocusSignatureRef = useRef<string | null>(null);
  const flightDeckMapHeadingRef = useRef<number | null>(null);
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
  const [providerRouteSearch, setProviderRouteSearch] = useState<RouteSearchResponse | null>(null);
  const [diversionCandidates, setDiversionCandidates] = useState<NearbyDiversionAirport[]>([]);
  const [diversionLoading, setDiversionLoading] = useState(false);
  const [diversionError, setDiversionError] = useState<string | null>(null);
  const [selectedDiversionIcao, setSelectedDiversionIcao] = useState<string | null>(null);
  const [selectedDiversionBriefing, setSelectedDiversionBriefing] = useState<RunwayBriefingResponse | null>(null);
  const [selectedDiversionBriefingLoading, setSelectedDiversionBriefingLoading] = useState(false);
  const [departureBriefing, setDepartureBriefing] = useState<RunwayBriefingResponse | null>(null);
  const [departureBriefingLoading, setDepartureBriefingLoading] = useState(false);
  const [destinationBriefing, setDestinationBriefing] = useState<RunwayBriefingResponse | null>(null);
  const [destinationBriefingLoading, setDestinationBriefingLoading] = useState(false);
  const [departureSurfaceGeometry, setDepartureSurfaceGeometry] = useState<AirportSurfaceGeometryResponse | null>(null);
  const [departureSurfaceGeometryLoading, setDepartureSurfaceGeometryLoading] = useState(false);
  const [destinationSurfaceGeometry, setDestinationSurfaceGeometry] = useState<AirportSurfaceGeometryResponse | null>(null);
  const [destinationSurfaceGeometryLoading, setDestinationSurfaceGeometryLoading] = useState(false);
  const [departureFrequencies, setDepartureFrequencies] = useState<AirportFrequencyResponse | null>(null);
  const [departureFrequenciesLoading, setDepartureFrequenciesLoading] = useState(false);
  const [destinationFrequencies, setDestinationFrequencies] = useState<AirportFrequencyResponse | null>(null);
  const [destinationFrequenciesLoading, setDestinationFrequenciesLoading] = useState(false);
  const [terrainProfile, setTerrainProfile] = useState<TerrainProfileResponse | null>(null);
  const [terrainProfileLoading, setTerrainProfileLoading] = useState(false);
  const [obstacleScan, setObstacleScan] = useState<NearbyObstacleResponse | null>(null);
  const [obstacleScanLoading, setObstacleScanLoading] = useState(false);
  const [trafficTrendMap, setTrafficTrendMap] = useState<Record<string, TrafficTrend>>({});
  const trafficSnapshotRef = useRef<Record<string, { distanceNm: number; bearingDelta: number; at: number }>>({});
  const plannedAltitudeFt = parseFloat(plannedAltitude);
  const plannedAltitudeValue = Number.isFinite(plannedAltitudeFt) ? plannedAltitudeFt : undefined;

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
  const receiverOwnshipAgeMs = receiverOwnship?.updatedAt ? ownshipClockMs - receiverOwnship.updatedAt : null;
  const receiverOwnshipFresh = receiverOwnshipAgeMs != null && receiverOwnshipAgeMs <= RECEIVER_OWNSHIP_STALE_MS;
  const receiverAttitudeAgeMs = receiverAttitude?.updatedAt ? ownshipClockMs - receiverAttitude.updatedAt : null;
  const receiverAttitudeFresh = receiverAttitudeAgeMs != null && receiverAttitudeAgeMs <= RECEIVER_ATTITUDE_STALE_MS;
  const gpsOwnshipAgeMs = gpsData?.updatedAt ? ownshipClockMs - gpsData.updatedAt : null;
  const gpsOwnshipFresh = gpsOwnshipAgeMs != null && gpsOwnshipAgeMs <= DEVICE_OWNSHIP_STALE_MS;
  const activeOwnship: OwnshipData | null = simulationEnabled && simulatedGpsData
    ? simulatedGpsData
    : receiverOwnshipFresh && receiverOwnship
      ? {
          ...receiverOwnship,
          heading:
            receiverAttitudeFresh && typeof receiverAttitude?.headingDeg === 'number'
              ? receiverAttitude.headingDeg
              : receiverOwnship.heading,
        }
      : gpsOwnshipFresh && gpsData
        ? gpsData
        : null;
  const mapConfig = (Constants.expoConfig?.extra as { googleMaps?: { androidApiKeyConfigured?: boolean; androidPackage?: string } } | undefined)
    ?.googleMaps;
  const plannerMapUsesGoogleProvider = Platform.OS === 'android';
  const plannerMapKeyConfigured = !plannerMapUsesGoogleProvider || Boolean(mapConfig?.androidApiKeyConfigured);
  const showPlannerMapDiagnostics =
    diagnosticsEnabled() || plannerMapRenderTimedOut || (plannerMapUsesGoogleProvider && !plannerMapKeyConfigured);
  useEffect(() => {
    if (!routePoints.length) return;
    setPlannerMapReady(false);
    setPlannerMapRenderTimedOut(false);
  }, [routePoints]);

  useEffect(() => {
    if (!routePoints.length) {
      setPlannerMapLayoutReady(false);
      setPlannerMapReady(false);
      setPlannerMapRenderTimedOut(false);
      return;
    }

    if (plannerMapReady) {
      setPlannerMapRenderTimedOut(false);
      return;
    }

    setPlannerMapRenderTimedOut(false);
    const timeout = setTimeout(() => {
      setPlannerMapRenderTimedOut(true);
      warnDiagnostic('maps', 'planner_map_ready_timeout', {
        provider: plannerMapUsesGoogleProvider ? 'google' : 'default',
        keyConfigured: plannerMapKeyConfigured,
        packageName: mapConfig?.androidPackage,
        routePointCount: routePoints.length,
        layoutReady: plannerMapLayoutReady,
      });
    }, 8000);

    return () => clearTimeout(timeout);
  }, [mapConfig?.androidPackage, plannerMapKeyConfigured, plannerMapLayoutReady, plannerMapReady, plannerMapUsesGoogleProvider, routePoints.length]);

  useEffect(() => {
    if (plannerMapRenderTimedOut) return;
    if (flightDeckView === 'vision' && !activeOwnship) {
      warnDiagnostic('flightDeck', 'vision_missing_ownship', {
        isFlightDeck,
        ownshipSource: null,
      });
    }
  }, [activeOwnship, flightDeckView, isFlightDeck, plannerMapRenderTimedOut]);
  const ownshipSourceSummary = useMemo(() => {
    if (simulationEnabled && simulatedGpsData) {
      return {
        code: 'SIM',
        label: 'Simulation',
        detail: `Playback active at ${simulationSpeed}.`,
        freshness: 'Live',
      };
    }
    if (receiverOwnship && receiverOwnshipFresh) {
      return {
        code: 'RXR',
        label: 'Receiver ownship',
        detail:
          receiverHealth?.status === 'healthy'
            ? 'GDL-90 receiver ownship is primary.'
            : 'Receiver ownship is primary.',
        freshness: `Updated ${formatOwnshipAge(receiverOwnshipAgeMs)} ago`,
      };
    }
    if (receiverOwnship && !receiverOwnshipFresh) {
      return {
        code: gpsData ? 'GPS' : 'STALE',
        label: gpsData ? 'Device GPS primary' : 'Receiver stale',
        detail: gpsData
          ? 'Receiver ownship stale. Falling back to device GPS.'
          : 'Receiver ownship is stale and no GPS fallback is active.',
        freshness: gpsData && gpsOwnshipFresh
          ? `Receiver stale ${formatOwnshipAge(receiverOwnshipAgeMs)} - GPS updated ${formatOwnshipAge(gpsOwnshipAgeMs)} ago`
          : `Receiver stale ${formatOwnshipAge(receiverOwnshipAgeMs)}`,
      };
    }
    if (gpsData && gpsOwnshipFresh) {
      return {
        code: 'GPS',
        label: 'Device GPS',
        detail: 'Device location is primary ownship source.',
        freshness: `Updated ${formatOwnshipAge(gpsOwnshipAgeMs)} ago`,
      };
    }
    if (gpsData && !gpsOwnshipFresh) {
      return {
        code: 'STALE',
        label: 'Device GPS stale',
        detail: 'Device ownship is stale and not used for active guidance.',
        freshness: `Stale ${formatOwnshipAge(gpsOwnshipAgeMs)}`,
      };
    }
    return {
      code: 'PREFLT',
      label: 'No ownship',
      detail: 'Enable receiver traffic, device GPS, or sim to start live tracking.',
      freshness: 'Awaiting source',
    };
  }, [
    gpsData,
    gpsOwnshipAgeMs,
    gpsOwnshipFresh,
    ownshipClockMs,
    receiverHealth?.status,
    receiverOwnship,
    receiverOwnshipAgeMs,
    receiverOwnshipFresh,
    simulationEnabled,
    simulatedGpsData,
    simulationSpeed,
  ]);
  const headingSourceSummary = useMemo(() => {
    if (simulationEnabled && simulatedGpsData) {
      return {
        code: 'SIM',
        label: 'Simulated heading',
        detail: 'Playback heading is driving lateral cues.',
      };
    }
    if (receiverAttitudeFresh && typeof receiverAttitude?.headingDeg === 'number') {
      return {
        code: receiverAttitude.headingReference === 'magnetic' ? 'AHRS-M' : 'AHRS-T',
        label: receiverAttitude.headingReference === 'magnetic' ? 'AHRS magnetic heading' : 'AHRS true heading',
        detail: 'Receiver AHRS heading is driving track-up and vision cues.',
      };
    }
    if (receiverOwnshipFresh && typeof receiverOwnship?.heading === 'number') {
      return {
        code: 'RXR',
        label: 'Receiver heading',
        detail: 'Receiver heading is driving track-up and vision cues.',
      };
    }
    if (gpsOwnshipFresh && typeof gpsData?.heading === 'number') {
      return {
        code: (gpsData.speedKts ?? 0) >= 25 ? 'GPS' : 'GPS-LIM',
        label: (gpsData.speedKts ?? 0) >= 25 ? 'GPS track heading' : 'GPS heading limited',
        detail: (gpsData.speedKts ?? 0) >= 25
          ? 'Device GPS track is driving heading cues.'
          : 'Device GPS heading is available but low-speed accuracy is limited.',
      };
    }
    return {
      code: 'NONE',
      label: 'Heading unavailable',
      detail: 'No reliable heading source is currently active.',
    };
  }, [gpsData?.heading, gpsData?.speedKts, gpsOwnshipFresh, receiverAttitude?.headingDeg, receiverAttitude?.headingReference, receiverAttitudeFresh, receiverOwnship?.heading, receiverOwnshipFresh, simulatedGpsData, simulationEnabled]);
  const attitudeSourceSummary = useMemo(() => {
    if (simulationEnabled && simulatedGpsData) {
      return {
        code: 'SIM',
        label: 'Simulated attitude',
        detail: 'Vision attitude cues are driven by simulation playback.',
        pilotGrade: true,
      };
    }
    if (receiverAttitudeFresh && (typeof receiverAttitude?.pitchDeg === 'number' || typeof receiverAttitude?.rollDeg === 'number')) {
      return {
        code: 'AHRS',
        label: 'Receiver AHRS',
        detail: `Receiver AHRS is driving synthetic vision attitude.${typeof receiverAttitude.pitchDeg === 'number' && typeof receiverAttitude.rollDeg === 'number' ? ` Pitch ${receiverAttitude.pitchDeg.toFixed(1)}°, roll ${receiverAttitude.rollDeg.toFixed(1)}°.` : ''}`,
        pilotGrade: true,
      };
    }
    if (receiverOwnshipFresh || receiverHealth?.status === 'healthy') {
      return {
        code: 'WAIT',
        label: 'AHRS awaiting data',
        detail: 'Receiver ownship is live, but no fresh AHRS attitude message is available yet. Vision remains stabilized and guidance-only.',
        pilotGrade: false,
      };
    }
    return {
      code: 'PEND',
      label: 'AHRS pending',
      detail: 'No external AHRS is connected yet. Vision remains stabilized and guidance-only.',
      pilotGrade: false,
    };
  }, [receiverAttitude?.pitchDeg, receiverAttitude?.rollDeg, receiverAttitudeFresh, receiverHealth?.status, receiverOwnshipFresh, simulatedGpsData, simulationEnabled]);
  const visionReadinessSummary = useMemo(() => {
    if (attitudeSourceSummary.pilotGrade) {
      return {
        code: 'FULL',
        label: 'Vision ready',
        detail: 'Attitude-backed synthetic vision is active.',
      };
    }
    if (receiverOwnshipFresh && !receiverAttitudeFresh) {
      return {
        code: 'ARM',
        label: 'AHRS standby',
        detail: 'Receiver ownship is live. Waiting for AHRS attitude frames to enable full synthetic vision.',
      };
    }
    return {
      code: 'GUIDE',
      label: 'Guidance mode',
      detail: 'Stable synthetic vision guidance is available, but live attitude remains advisory until AHRS is connected.',
    };
  }, [attitudeSourceSummary.pilotGrade, receiverAttitudeFresh, receiverOwnshipFresh]);
  const sourceArbitrationSummary = useMemo(
    () =>
      getFlightDeckSourceArbitrationState({
        simulationEnabled,
        receiverOwnshipFresh,
        receiverAttitudeFresh,
        gpsOwnshipFresh,
        receiverHealthy: receiverHealth?.status === 'healthy',
        deviceMotionActive: false,
      }),
    [gpsOwnshipFresh, receiverAttitudeFresh, receiverHealth?.status, receiverOwnshipFresh, simulationEnabled]
  );
  const receiverStatusSummary = useMemo(() => {
    const status = receiverHealth?.status || 'idle';
    if (status === 'healthy') {
      return {
        code: 'HEALTHY',
        detail: 'Heartbeat and ownship are current.',
      };
    }
    if (status === 'traffic-only') {
      return {
        code: 'TRFC',
        detail: 'Traffic is live, but ownship is not current.',
      };
    }
    if (status === 'stale') {
      return {
        code: 'STALE',
        detail: 'Receiver frames have gone stale.',
      };
    }
    return {
      code: 'IDLE',
      detail: trafficEnabled ? 'Waiting for first receiver frames.' : 'Receiver listener is off.',
    };
  }, [receiverHealth?.status, trafficEnabled]);
  const activeVerticalSpeedFpm = simulationEnabled ? simulatedVerticalSpeedFpm : verticalSpeedFpm;
  const activeTrafficTargets = simulationEnabled ? simulatedTrafficTargets : trafficTargets;
  const activeAttitude = simulationEnabled && simulatedGpsData
    ? {
        pitchDeg: 0,
        rollDeg: 0,
        headingDeg: simulatedGpsData.heading,
        headingReference: 'true' as const,
        indicatedAirspeedKts: simulatedGpsData.speedKts,
        trueAirspeedKts: simulatedGpsData.speedKts,
        updatedAt: simulatedGpsData.updatedAt,
        source: 'simulation' as const,
      }
    : receiverAttitudeFresh
      ? receiverAttitude
      : null;
  const flightDeckSessionState = simulationEnabled
    ? 'SIM'
    : activeOwnship
      ? 'LIVE'
      : gpsEnabled || trafficEnabled || Boolean(receiverOwnship) || Boolean(gpsData)
        ? 'MONITOR'
        : 'PREFLIGHT';
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
  const directToRouteActive =
    routeExecutionOverride?.mode === 'direct-to-diversion' || routeExecutionOverride?.mode === 'direct-to-route';
  const activeRoutePoints = useMemo(() => {
    if (!directToRouteActive) return routePoints;
    return [routeExecutionOverride.origin, routeExecutionOverride.target];
  }, [directToRouteActive, routeExecutionOverride, routePoints]);
  const plannedRouteStructureText = useMemo(() => {
    const dep = departure.trim().toUpperCase();
    const dest = destination.trim().toUpperCase();
    const stopList = plannedStops
      .split(/[\s,]+/)
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);
    const wpList = waypoints
      .split(/[\s,]+/)
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);
    return [dep, ...stopList, ...wpList, dest].filter(Boolean).join(' ');
  }, [departure, destination, plannedStops, waypoints]);
  const plannedRouteAnalysis = useMemo(() => analyzeFiledRoute(plannedRouteStructureText), [plannedRouteStructureText]);
  const providerRouteAnalysis = useMemo(
    () => analyzeFiledRoute(providerRouteSearch?.route || ''),
    [providerRouteSearch?.route]
  );
  const plannedRouteAnchorTokens = useMemo(
    () =>
      plannedRouteAnalysis.tokens
        .filter((token) => isFiledRouteAnchorKind(token.kind))
        .map((token) => token.token),
    [plannedRouteAnalysis]
  );
  const providerRouteAnchorTokens = useMemo(
    () =>
      providerRouteAnalysis.tokens
        .filter((token) => isFiledRouteAnchorKind(token.kind))
        .map((token) => token.token),
    [providerRouteAnalysis]
  );
  const activeRouteLegs = useMemo(
    () =>
      buildMobileRouteLegs(activeRoutePoints, {
        mode: directToRouteActive ? 'direct-to' : 'planned',
      }),
    [activeRoutePoints, directToRouteActive]
  );
  const activeLegDefinition = useMemo(
    () => activeRouteLegs[Math.min(activeLegIndex, Math.max(0, activeRouteLegs.length - 1))] || null,
    [activeLegIndex, activeRouteLegs]
  );
  const routeProgress = useMemo(
    () => computeMobileRouteProgress(activeRoutePoints, activeOwnship, { activeLegIndex }),
    [activeLegIndex, activeOwnship, activeRoutePoints]
  );
  const visionMode = useMemo<'route' | 'free'>(() => (
    routeProgress?.nextWaypoint || activeRoutePoints.length > 1 ? 'route' : 'free'
  ), [activeRoutePoints.length, routeProgress?.nextWaypoint]);
  const activeLegBehavior = useMemo(
    () =>
      getMobileRouteLegBehavior(activeLegDefinition, {
        legProgressPct: routeProgress?.legProgressPct,
        remainingRouteNm: routeProgress?.remainingRouteNm,
      }),
    [activeLegDefinition, routeProgress?.legProgressPct, routeProgress?.remainingRouteNm]
  );
  const activeExecutionSegmentPreview = useMemo(
    () => getMobileRouteExecutionSegment(activeLegBehavior.profile, { sequenceGateState: 'blocked' }),
    [activeLegBehavior.profile]
  );
  const activeProcedureExecutionProfilePreview = useMemo(
    () => getMobileRouteProcedureExecutionProfile(getMobileRouteProcedureContext(activeLegBehavior.profile).kind),
    [activeLegBehavior.profile]
  );
  const activeProcedureCueStackPreview = useMemo(
    () => getMobileRouteProcedureCueStack(getMobileRouteProcedureContext(activeLegBehavior.profile).kind),
    [activeLegBehavior.profile]
  );
  const activeProcedureRoleExecutionPolicyPreview = useMemo(
    () =>
      getMobileRouteProcedureRoleExecutionPolicy(
        getMobileRouteProcedureEntryRole(getMobileRouteProcedureContext(activeLegBehavior.profile).kind, {
          entryIndexInChain: 0,
          entryCount: 1,
        }).kind,
      ),
    [activeLegBehavior.profile]
  );
  const plannedRouteRejoinProgress = useMemo(
    () => computeMobileRouteProgress(routePoints, activeOwnship),
    [activeOwnship, routePoints]
  );
  const lateralCapturedForSequencing = useMemo(() => {
    if (!activeOwnship || !routeProgress) return false;
    const desiredTrack = routeProgress.desiredTrackDeg ?? 0;
    const headingDelta = normalizeHeadingDelta(desiredTrack - (activeOwnship.heading ?? desiredTrack));
    return Math.abs(routeProgress.crossTrackNm) < 0.25 && Math.abs(headingDelta) < 5;
  }, [activeOwnship, routeProgress]);
  useEffect(() => {
    setActiveLegIndex(0);
    setSequencingSuspended(false);
  }, [routePoints, routeExecutionOverride?.mode, routeExecutionOverride?.target.icao]);
  useEffect(() => {
    if (!activeOwnship || !routeProgress || activeRoutePoints.length < 2) return;
    const currentLegIndex = Math.min(activeLegIndex, activeRoutePoints.length - 2);
    if (currentLegIndex !== routeProgress.legIndex) return;
    if (currentLegIndex >= activeRoutePoints.length - 2) return;
    if (routeProgress.sequencingState === 'reintercept') return;
    if (sequencingSuspended) return;

    const activeLegEnd = activeRoutePoints[currentLegIndex + 1];
    if (!activeLegEnd) return;

    const distanceToLegEndNm = getDistanceNmFromLatLon(
      { lat: activeOwnship.lat, lon: activeOwnship.lon },
      { lat: activeLegEnd.latitude, lon: activeLegEnd.longitude },
    );
    const speedCaptureNm = Math.max(0.45, Math.min(2.4, (activeOwnship.speedKts ?? 90) / 120));
    const sequencingCaptureNm = Math.max(activeLegBehavior.sequencingCaptureNm, speedCaptureNm * 0.75);
    const armingProgressPct = clamp(
      activeProcedureExecutionProfilePreview.armAtProgressPct + activeProcedureRoleExecutionPolicyPreview.armBiasPct,
      30,
      96,
    );
    const openProgressPct = clamp(
      activeProcedureExecutionProfilePreview.openAtProgressPct + activeProcedureRoleExecutionPolicyPreview.openBiasPct,
      40,
      99,
    );
    const gateArmed =
      routeProgress.legProgressPct >= armingProgressPct ||
      routeProgress.remainingLegNm <= sequencingCaptureNm * 1.35;
    const gateOpenByProgress =
      routeProgress.legProgressPct >= openProgressPct ||
      routeProgress.remainingLegNm <= sequencingCaptureNm * 0.85 ||
      distanceToLegEndNm <= sequencingCaptureNm;
    const lateralReady =
      !activeProcedureExecutionProfilePreview.requiresLateralCapture ||
      lateralCapturedForSequencing;
    const gateOpen = gateArmed && gateOpenByProgress && lateralReady;
    const effectiveSequencingModel = activeProcedureRoleExecutionPolicyPreview.sequencingModel;
    const shouldAdvance = gateOpen && effectiveSequencingModel === 'auto';

    if (shouldAdvance) {
      setActiveLegIndex((prev) => Math.min(prev + 1, activeRoutePoints.length - 2));
    }
  }, [activeLegBehavior.sequencingCaptureNm, activeLegIndex, activeOwnship, activeProcedureExecutionProfilePreview.armAtProgressPct, activeProcedureExecutionProfilePreview.openAtProgressPct, activeProcedureExecutionProfilePreview.requiresLateralCapture, activeProcedureRoleExecutionPolicyPreview.armBiasPct, activeProcedureRoleExecutionPolicyPreview.openBiasPct, activeProcedureRoleExecutionPolicyPreview.sequencingModel, activeRoutePoints, lateralCapturedForSequencing, routeProgress, sequencingSuspended]);
  const flightDeckPhaseSummary = useMemo(() => {
    if (!activeOwnship) {
      return {
        stage: 'preflight' as FlightDeckPhaseStage,
        label: 'Preflight',
        detail: 'Build a route and connect a live source to start active guidance.',
      };
    }
    const speedKts = activeOwnship.speedKts ?? 0;
    const altitudeFt = activeOwnship.altitudeFt ?? 0;
    const progressPct = routeProgress?.progressPct ?? 0;
    const remainingRouteNm = routeProgress?.remainingRouteNm ?? Number.POSITIVE_INFINITY;
    const targetCruiseAltitudeFt = Number(plannedAltitude) || simulationAltitudeFt;
    const cruiseCaptureFloorFt = Math.max(targetCruiseAltitudeFt * 0.88, targetCruiseAltitudeFt - 1500);

    if (progressPct >= 95 && speedKts < 45) {
      return {
        stage: 'taxi-in' as FlightDeckPhaseStage,
        label: 'Taxi in',
        detail: 'Arrival rollout complete. Surface guidance should favor ramp and parking flow.',
      };
    }
    if (remainingRouteNm <= 12) {
      return {
        stage: 'final' as FlightDeckPhaseStage,
        label: 'Final',
        detail: 'Runway environment should be primary with final-alignment and rollout cues.',
      };
    }
    if (progressPct > 78 || remainingRouteNm < 35) {
      return {
        stage: 'arrival' as FlightDeckPhaseStage,
        label: 'Arrival',
        detail: 'Arrival corridor is active. Tighten runway, terrain, and diversion awareness.',
      };
    }
    if (progressPct > 58 && altitudeFt < cruiseCaptureFloorFt) {
      return {
        stage: 'descent' as FlightDeckPhaseStage,
        label: 'Descent',
        detail: 'Manage descent path, terrain clearance, and arrival setup.',
      };
    }
    if (altitudeFt >= cruiseCaptureFloorFt && progressPct >= 25 && progressPct <= 72) {
      return {
        stage: 'cruise' as FlightDeckPhaseStage,
        label: 'Cruise',
        detail: 'Enroute tactical scan is primary. Traffic, weather, and route execution should dominate.',
      };
    }
    if (progressPct < 25 && altitudeFt < cruiseCaptureFloorFt && speedKts >= 85) {
      return {
        stage: 'climb' as FlightDeckPhaseStage,
        label: 'Climb',
        detail: 'Initial climb is active. Terrain, obstacle, and departure corridor cues should stay elevated.',
      };
    }
    if (progressPct < 10 && speedKts >= 45) {
      return {
        stage: 'departure' as FlightDeckPhaseStage,
        label: 'Departure',
        detail: 'Runway departure and initial corridor capture should be primary.',
      };
    }
    if (progressPct < 6 && speedKts < 45) {
      return {
        stage: 'taxi-out' as FlightDeckPhaseStage,
        label: 'Taxi out',
        detail: 'Surface movement and hold-short guidance should be primary.',
      };
    }
    return {
      stage: 'climb' as FlightDeckPhaseStage,
      label: 'Climb',
      detail: 'Flight is transitioning from terminal to enroute guidance.',
    };
  }, [activeOwnship, plannedAltitude, routeProgress, simulationAltitudeFt]);
  const flightPhase = useMemo<'ground' | 'departure' | 'enroute' | 'arrival'>(() => {
    switch (flightDeckPhaseSummary.stage) {
      case 'preflight':
        return 'ground';
      case 'taxi-out':
      case 'departure':
      case 'climb':
        return 'departure';
      case 'cruise':
      case 'descent':
        return 'enroute';
      case 'arrival':
      case 'final':
      case 'taxi-in':
        return 'arrival';
      default:
        return 'ground';
    }
  }, [flightDeckPhaseSummary.stage]);
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
  const destinationElevationFtEstimate = useMemo(
    () => terrainProfile?.samples?.[terrainProfile.samples.length - 1]?.elevationFt ?? 0,
    [terrainProfile?.samples],
  );
  const departureRunway = useMemo(
    () => resolveDestinationRunway(departureBriefing),
    [departureBriefing]
  );
  const destinationRunway = useMemo(
    () => resolveDestinationRunway(destinationBriefing),
    [destinationBriefing]
  );
  const destinationRunwayCue = useMemo<DestinationRunwayCue | null>(() => {
    const destinationPoint = activeRoutePoints[activeRoutePoints.length - 1];
    if (!activeOwnship || !destinationPoint || !destinationRunway) return null;
    if (flightPhase !== 'arrival') return null;
    const destinationElevationFt = terrainProfile?.samples?.[terrainProfile.samples.length - 1]?.elevationFt ?? 0;
    const currentAltitudeFt = activeOwnship.altitudeFt ?? simulationAltitudeFt;
    return buildArrivalRunwayCue({
      ownship: {
        lat: activeOwnship.lat,
        lon: activeOwnship.lon,
        heading: activeOwnship.heading ?? destinationRunway.headingDeg,
        altitudeFt: currentAltitudeFt,
      },
      airport: {
        latitude: destinationPoint.latitude,
        longitude: destinationPoint.longitude,
      },
      runway: destinationRunway,
      destinationElevationFt,
      activeRangeNm: 18,
      maxDistanceNm: 30,
    });
  }, [activeOwnship, activeRoutePoints, destinationRunway, flightPhase, simulationAltitudeFt, terrainProfile?.samples]);
  const destinationRunwayOverlay = useMemo<DestinationRunwayOverlay | null>(() => {
    const destinationPoint = activeRoutePoints[activeRoutePoints.length - 1];
    if (!destinationPoint || !destinationRunway || !destinationRunwayCue) return null;
    return buildArrivalRunwayOverlay({
      airport: {
        latitude: destinationPoint.latitude,
        longitude: destinationPoint.longitude,
      },
      runway: destinationRunway,
      approachLengthNm: flightPhase === 'arrival' ? 8 : 5,
    });
  }, [activeRoutePoints, destinationRunway, destinationRunwayCue, flightPhase]);
  const departureRunwayOverlay = useMemo<DestinationRunwayOverlay | null>(() => {
    const departurePoint = activeRoutePoints[0];
    if (!departurePoint || !departureRunway || flightPhase !== 'departure') return null;
    return buildDepartureRunwayOverlay({
      airport: {
        latitude: departurePoint.latitude,
        longitude: departurePoint.longitude,
      },
      runway: departureRunway,
    });
  }, [activeRoutePoints, departureRunway, flightPhase]);
  const activeRunwayOverlay = flightPhase === 'arrival' ? destinationRunwayOverlay : departureRunwayOverlay;
  const activeRunwayOverlayLabel = flightPhase === 'arrival'
    ? destinationRunway ? `Final ${destinationRunway.runwayId}` : null
    : departureRunway ? `Dep ${departureRunway.runwayId}` : null;
  const tacticalMapRegion = useMemo(
    () =>
      buildTacticalMapRegion({
        phaseStage: flightDeckPhaseSummary?.stage || null,
        ownship: activeOwnship,
        routePoints: activeRoutePoints,
        routeProgress,
        activeRunwayOverlay,
        selectedTrafficTarget,
        selectedDiversionPoint,
      }),
    [
      activeOwnship,
      activeRoutePoints,
      activeRunwayOverlay,
      flightDeckPhaseSummary?.stage,
      routeProgress,
      selectedDiversionPoint,
      selectedTrafficTarget,
    ],
  );
  const tacticalMapRangeLabel = useMemo(() => formatTacticalRangeNm(tacticalMapRegion), [tacticalMapRegion]);
  const trafficPanelTargets = useMemo(() => {
    if (!selectedTrafficTarget) return visibleTrafficTargets.slice(0, 5);
    const rest = visibleTrafficTargets.filter((target) => target.id !== selectedTrafficTarget.id);
    return [selectedTrafficTarget, ...rest].slice(0, 5);
  }, [selectedTrafficTarget, visibleTrafficTargets]);
  const mapDisplayTrafficTargets = useMemo(() => {
    const phase = flightDeckPhaseSummary.stage;
    const selectedId = selectedTrafficTarget?.id;
    const requiredIds = new Set(
      visibleTrafficTargets
        .filter((target) => target.id === selectedId || target.threatLevel === 'immediate')
        .map((target) => target.id),
    );

    const filtered = visibleTrafficTargets.filter((target) => {
      if (requiredIds.has(target.id)) return true;
      if (phase === 'taxi-out' || phase === 'taxi-in') {
        return target.threatLevel !== 'monitor' && target.distanceNm <= 3;
      }
      if (phase === 'departure' || phase === 'final') {
        return target.threatLevel !== 'monitor' || target.distanceNm <= 8;
      }
      if (phase === 'arrival' || phase === 'descent') {
        return target.threatLevel !== 'monitor' || target.distanceNm <= 12;
      }
      if (phase === 'climb') {
        return target.threatLevel !== 'monitor' || target.distanceNm <= 10;
      }
      return target.threatLevel !== 'monitor' || target.distanceNm <= 18;
    });

    const prioritized = [...filtered].sort((a, b) => {
      const aSelected = a.id === selectedId ? -1 : 0;
      const bSelected = b.id === selectedId ? -1 : 0;
      if (aSelected !== bSelected) return aSelected - bSelected;
      const threatRank = (target: any) =>
        target.threatLevel === 'immediate' ? 0 : target.threatLevel === 'advisory' ? 1 : 2;
      const threatDelta = threatRank(a) - threatRank(b);
      if (threatDelta !== 0) return threatDelta;
      return a.distanceNm - b.distanceNm;
    });

    const limit =
      phase === 'taxi-out' || phase === 'taxi-in'
        ? 3
        : phase === 'departure' || phase === 'arrival' || phase === 'final'
          ? 5
          : 6;
    return prioritized.slice(0, limit);
  }, [flightDeckPhaseSummary.stage, selectedTrafficTarget?.id, visibleTrafficTargets]);
  const mapRouteDisplay = useMemo(() => {
    if (!activeRoutePoints.length) {
      return { completed: [], activeLeg: [], upcoming: [] };
    }
    const legIndex = Math.min(routeProgress?.legIndex ?? 0, Math.max(0, activeRoutePoints.length - 1));
    const ownshipPoint = activeOwnship
      ? { latitude: activeOwnship.lat, longitude: activeOwnship.lon }
      : null;
    const legStart = activeRoutePoints[legIndex] || activeRoutePoints[0];
    const legEnd = activeRoutePoints[legIndex + 1] || null;
    const completed =
      ownshipPoint
        ? [...activeRoutePoints.slice(0, Math.max(legIndex, 1)), ownshipPoint]
        : activeRoutePoints.slice(0, Math.max(legIndex + 1, 1));
    const activeLeg =
      ownshipPoint && legEnd
        ? [ownshipPoint, legEnd]
        : legEnd
          ? [legStart, legEnd]
          : [];
    const upcoming = legEnd ? activeRoutePoints.slice(legIndex + 1) : [];
    return { completed, activeLeg, upcoming };
  }, [activeOwnship, activeRoutePoints, routeProgress?.legIndex]);
  const mapTrafficPresentation = useMemo(() => {
    if (!activeOwnship) return [];
    return mapDisplayTrafficTargets.map((target) => {
      const trend = trafficTrendMap[target.id] || null;
      const bearingDeg = bearingBetweenPoints(
        { latitude: activeOwnship.lat, longitude: activeOwnship.lon },
        { latitude: target.lat, longitude: target.lon },
      );
      const closureRate = trend?.distanceRateNmPerMin ?? 0;
      const bearingRate = trend?.bearingRateDegPerMin ?? 0;
      const vectorLengthNm = Math.max(0.08, Math.min(0.32, Math.abs(closureRate) * 0.18 + Math.abs(bearingRate) * 0.004));
      const vectorBearingDeg =
        closureRate <= -0.05
          ? (bearingDeg + 180 + bearingRate * 0.35 + 360) % 360
          : (bearingDeg + bearingRate * 0.35 + 360) % 360;
      const vectorEnd = offsetGeoPoint({ lat: target.lat, lon: target.lon }, vectorBearingDeg, vectorLengthNm);
      return {
        id: target.id,
        altitudeLabel:
          typeof target.altitudeDeltaFt === 'number'
            ? `${target.altitudeDeltaFt >= 0 ? '+' : ''}${Math.round(target.altitudeDeltaFt)}`
            : '--',
        closureText: trend?.closureText || 'Monitor',
        vector: [
          { latitude: target.lat, longitude: target.lon },
          { latitude: vectorEnd.lat, longitude: vectorEnd.lon },
        ],
      };
    });
  }, [activeOwnship, mapDisplayTrafficTargets, trafficTrendMap]);
  const mapRunwayFocusSummary = useMemo(() => {
    const stage = flightDeckPhaseSummary.stage;
    const emphasize =
      Boolean(activeRunwayOverlay) &&
      (stage === 'departure' || stage === 'arrival' || stage === 'final' || stage === 'taxi-out' || stage === 'taxi-in');
    return {
      emphasize,
      label:
        stage === 'final'
          ? 'Final corridor'
          : stage === 'arrival'
            ? 'Arrival corridor'
            : stage === 'departure'
              ? 'Departure corridor'
              : stage === 'taxi-out' || stage === 'taxi-in'
                ? 'Runway vicinity'
                : 'Route corridor',
    };
  }, [activeRunwayOverlay, flightDeckPhaseSummary.stage]);
  const mapOverlayProfile = useMemo(() => {
    const stage = flightDeckPhaseSummary.stage;
    const terminal = ['taxi-out', 'departure', 'arrival', 'final', 'taxi-in'].includes(stage);
    return {
      label:
        stage === 'taxi-out' || stage === 'taxi-in'
          ? 'Ground priority'
          : stage === 'departure'
            ? 'Departure priority'
            : stage === 'arrival' || stage === 'final'
              ? 'Arrival priority'
              : 'Enroute priority',
      activeLegWidth:
        stage === 'taxi-out' || stage === 'taxi-in'
          ? 4
          : stage === 'departure' || stage === 'final'
            ? 6
            : 5,
      completedLegWidth: terminal ? 3 : 2.5,
      upcomingLegWidth: terminal ? 2.5 : 3,
      upcomingLegOpacity:
        stage === 'final'
          ? 0.18
          : stage === 'arrival'
            ? 0.24
            : stage === 'departure'
              ? 0.3
              : 0.42,
      runwayEmphasisWidth:
        stage === 'final'
          ? 16
          : stage === 'arrival'
            ? 14
            : stage === 'departure'
              ? 12
              : 10,
      showTrafficVectors: stage !== 'taxi-out' && stage !== 'taxi-in',
      showMonitorAltitudeTags: !terminal,
      maxWindMarkers:
        stage === 'taxi-out' || stage === 'taxi-in'
          ? 0
          : terminal
            ? 6
            : 12,
      radarOpacity:
        stage === 'taxi-out' || stage === 'taxi-in'
          ? 0.38
          : terminal
            ? 0.52
            : 0.75,
      cloudOpacity:
        stage === 'taxi-out' || stage === 'taxi-in'
          ? 0.35
          : terminal
            ? 0.5
            : 0.75,
    };
  }, [flightDeckPhaseSummary.stage]);
  const flightDeckVerticalPathSummary = useMemo(() => {
    const roundedCruiseAltitudeFt = Math.max(1000, Math.round((plannedAltitudeValue ?? simulationAltitudeFt) / 100) * 100);
    const manualBugActive = flightDeckTargetAltitudeFt != null;
    const manualBugTargetFt = manualBugActive ? flightDeckTargetAltitudeFt : null;

    if (!activeOwnship) {
      return {
        modeLabel: 'Vertical pending',
        guidanceMode: 'hold' as const,
        targetAltitudeFt: manualBugTargetFt,
        verticalErrorFt: null as number | null,
        requiredVsiFpm: null as number | null,
        topOfDescentNm: null as number | null,
        distanceToTodNm: null as number | null,
        advisoryCall: manualBugTargetFt ? `Altitude bug ${manualBugTargetFt} ft` : 'Vertical path pending',
        support: 'Connect ownship and activate a route for advisory vertical guidance.',
        recommendation: 'Use the planned altitude field or connect a live source.',
        cueLabel: 'ALT',
        manualBugActive,
      };
    }

    const stage = flightDeckPhaseSummary.stage;
    const currentAltitudeFt = activeOwnship.altitudeFt ?? simulationAltitudeFt;
    const groundspeedKts = Math.max(activeOwnship.speedKts ?? simulationCruiseKts, 60);
    const remainingRouteNm = routeProgress?.remainingRouteNm ?? null;
    const remainingLegNm = routeProgress?.remainingLegNm ?? null;
    const destinationFieldTargetFt = Math.max(1000, Math.round((destinationElevationFtEstimate + 50) / 50) * 50);
    const terminalTargetFt = Math.max(1500, Math.round((destinationElevationFtEstimate + 1500) / 100) * 100);
    const topOfDescentNm =
      roundedCruiseAltitudeFt > terminalTargetFt
        ? Math.max((roundedCruiseAltitudeFt - terminalTargetFt) / 318, 0)
        : 0;
    const distanceToTodNm =
      typeof remainingRouteNm === 'number' && Number.isFinite(remainingRouteNm)
        ? remainingRouteNm - topOfDescentNm
        : null;
    const threeDegreeVsiFpm = Math.round(((groundspeedKts * 318) / 60) / 25) * 25;

    const computeRequiredVsi = (targetAltitudeFt: number, distanceNm: number | null) => {
      if (typeof distanceNm !== 'number' || !Number.isFinite(distanceNm) || distanceNm <= 0.2) return null;
      const minutesToTarget = Math.max((distanceNm / groundspeedKts) * 60, 0.5);
      return Math.round(((targetAltitudeFt - currentAltitudeFt) / minutesToTarget) / 25) * 25;
    };

    let targetAltitudeFt = manualBugTargetFt;
    let verticalErrorFt: number | null = manualBugActive && manualBugTargetFt != null ? manualBugTargetFt - currentAltitudeFt : null;
    let requiredVsiFpm: number | null = manualBugActive && manualBugTargetFt != null ? computeRequiredVsi(manualBugTargetFt, remainingLegNm ?? remainingRouteNm) : null;
    let modeLabel = manualBugActive ? 'Manual altitude' : 'Vertical advisory';
    let guidanceMode: 'hold' | 'climb' | 'descent' | 'path' = 'hold';
    let advisoryCall = manualBugTargetFt ? `Climb to ${manualBugTargetFt} ft` : 'Hold altitude';
    let support = 'Vertical path monitor';
    let recommendation = 'Maintain the current altitude target.';
    let cueLabel = 'ALT';

    if (stage === 'preflight' || stage === 'taxi-out' || stage === 'taxi-in') {
      modeLabel = stage === 'preflight' ? 'Vertical pending' : 'Ground vertical';
      guidanceMode = 'hold';
      advisoryCall = manualBugTargetFt ? `Altitude bug ${manualBugTargetFt} ft` : 'Ground phase - hold altitude';
      support =
        stage === 'preflight'
          ? 'Awaiting an active route and ownship source.'
          : 'Vertical path is suppressed during ground operations.';
      recommendation = stage === 'preflight' ? 'Set a planned altitude before departure.' : 'Use surface and runway guidance as the primary scan.';
    } else if (stage === 'departure' || stage === 'climb') {
      const climbTargetFt = manualBugTargetFt ?? roundedCruiseAltitudeFt;
      const climbErrorFt = climbTargetFt - currentAltitudeFt;
      const climbVsiFpm = computeRequiredVsi(climbTargetFt, remainingLegNm ?? Math.min(remainingRouteNm ?? 12, 12));
      targetAltitudeFt = climbTargetFt;
      verticalErrorFt = climbErrorFt;
      requiredVsiFpm = climbVsiFpm;
      guidanceMode = 'climb';
      cueLabel = 'CLB';
      modeLabel = stage === 'departure' ? 'Departure climb' : 'Climb advisory';
      advisoryCall =
        Math.abs(climbErrorFt) < 150
          ? `Cruise altitude captured ${climbTargetFt} ft`
          : `Climb to ${climbTargetFt} ft`;
      support =
        typeof remainingRouteNm === 'number' && Number.isFinite(remainingRouteNm)
          ? `${remainingRouteNm.toFixed(1)} NM route remaining`
          : 'Climb corridor active';
      recommendation =
        climbVsiFpm && climbErrorFt > 0
          ? `Advisory climb ${Math.abs(climbVsiFpm)} fpm toward cruise.`
          : 'Stay on the departure corridor and monitor terrain.';
    } else if (stage === 'cruise') {
      targetAltitudeFt = manualBugTargetFt ?? roundedCruiseAltitudeFt;
      verticalErrorFt = targetAltitudeFt - currentAltitudeFt;
      requiredVsiFpm = null;
      guidanceMode = 'hold';
      cueLabel = 'ALT';
      if (distanceToTodNm != null && distanceToTodNm <= 0) {
        modeLabel = 'Descent plan';
        guidanceMode = 'descent';
        cueLabel = 'DES';
        targetAltitudeFt = manualBugTargetFt ?? terminalTargetFt;
        verticalErrorFt = targetAltitudeFt - currentAltitudeFt;
        requiredVsiFpm = computeRequiredVsi(targetAltitudeFt, remainingRouteNm);
        advisoryCall = `Descend toward ${targetAltitudeFt} ft`;
        support = `TOD passed ${Math.abs(distanceToTodNm).toFixed(1)} NM ago`;
        recommendation =
          requiredVsiFpm != null
            ? `Need ${Math.abs(requiredVsiFpm)} fpm to recover the terminal gate.`
            : 'Begin descent and monitor terrain clearance.';
      } else if (distanceToTodNm != null && distanceToTodNm <= 15) {
        modeLabel = 'TOD monitor';
        advisoryCall = `TOD in ${distanceToTodNm.toFixed(1)} NM`;
        support = `Prepare descent to ${terminalTargetFt} ft terminal gate`;
        recommendation = `Plan ${Math.abs(threeDegreeVsiFpm)} fpm on profile at ${Math.round(groundspeedKts)} kt.`;
      } else {
        modeLabel = 'Cruise hold';
        advisoryCall = `Hold ${targetAltitudeFt} ft`;
        support =
          distanceToTodNm != null
            ? `TOD in ${distanceToTodNm.toFixed(1)} NM`
            : 'Cruise altitude established';
        recommendation = 'Maintain cruise and monitor weather, traffic, and TOD.';
      }
    } else {
      const useFinalPath = stage === 'arrival' || stage === 'final' || stage === 'descent';
      const pathTargetFtBase =
        typeof remainingRouteNm === 'number' && Number.isFinite(remainingRouteNm)
          ? destinationFieldTargetFt + Math.max(remainingRouteNm, 0) * 318 + 50
          : terminalTargetFt;
      const advisoryTargetFt =
        stage === 'descent'
          ? Math.max(terminalTargetFt, Math.round(pathTargetFtBase / 100) * 100)
          : Math.round(pathTargetFtBase / 50) * 50;
      targetAltitudeFt = manualBugTargetFt ?? advisoryTargetFt;
      verticalErrorFt = targetAltitudeFt - currentAltitudeFt;
      requiredVsiFpm =
        stage === 'final'
          ? threeDegreeVsiFpm
          : computeRequiredVsi(targetAltitudeFt, remainingRouteNm);
      guidanceMode = useFinalPath ? 'path' : 'descent';
      cueLabel = 'DES';
      modeLabel =
        stage === 'final'
          ? 'Final path'
          : stage === 'arrival'
            ? 'Arrival descent'
            : 'Terminal descent';
      advisoryCall =
        Math.abs(verticalErrorFt) < 150
          ? stage === 'final'
            ? 'On final vertical path'
            : 'On terminal descent path'
          : verticalErrorFt < 0
            ? `Descend toward ${targetAltitudeFt} ft`
            : `Recover to ${targetAltitudeFt} ft`;
      support =
        typeof remainingRouteNm === 'number' && Number.isFinite(remainingRouteNm)
          ? `${remainingRouteNm.toFixed(1)} NM remaining - ${destinationRunway?.runwayId || 'RWY'} corridor active`
          : 'Terminal descent active';
      recommendation =
        requiredVsiFpm != null
          ? `Vertical path ${verticalErrorFt < 0 ? 'high' : verticalErrorFt > 0 ? 'low' : 'on path'} - ${Math.abs(requiredVsiFpm)} fpm guidance.`
          : 'Monitor final-path alignment and runway capture.';
    }

    return {
      modeLabel,
      guidanceMode,
      targetAltitudeFt,
      verticalErrorFt,
      requiredVsiFpm,
      topOfDescentNm,
      distanceToTodNm,
      advisoryCall,
      support,
      recommendation,
      cueLabel,
      manualBugActive,
    };
  }, [
    activeOwnship,
    activeVerticalSpeedFpm,
    destinationElevationFtEstimate,
    destinationRunway?.runwayId,
    flightDeckPhaseSummary.stage,
    flightDeckTargetAltitudeFt,
    plannedAltitudeValue,
    routeProgress?.remainingLegNm,
    routeProgress?.remainingRouteNm,
    simulationAltitudeFt,
    simulationCruiseKts,
  ]);
  const plannerNavDataSnapshot = useMemo(() => {
    const navDataLegsByIndex = buildStructuredCourseFixNavDataLegs(
      routeSummary?.legs || [],
      plannedRouteAnchorTokens,
      plannedAltitudeValue,
    );
    const providerNavDataLegsByIndex = buildProviderCourseFixNavDataLegs(
      routeSummary?.legs || [],
      providerRouteAnchorTokens,
      plannedAltitudeValue,
      providerRouteSearch?.environment || providerRouteSearch?.provider || null,
    );
    Object.entries(providerNavDataLegsByIndex).forEach(([legIndex, payload]) => {
      if (payload) {
        navDataLegsByIndex[Number(legIndex)] = payload;
      }
    });
    const plannerLegs = routeSummary?.legs || [];
    const departureLeg = plannerLegs[0];
    const arrivalFeedLeg = plannerLegs.length > 1 ? plannerLegs[plannerLegs.length - 2] : null;
    const finalLeg = plannerLegs[plannerLegs.length - 1];
    if (departureLeg && departureRunway) {
      navDataLegsByIndex[departureLeg.index] = {
        kind: 'runway-release-nav-data',
        sourceKind: 'briefing-data',
        label: `${departure.trim().toUpperCase() || departureLeg.from} ${departureRunway.runwayId}`,
        airportIdent: departure.trim().toUpperCase() || departureLeg.from,
        runwayIdent: departureRunway.runwayId,
        releaseHeading: departureRunway.headingDeg,
        initialAltitudeFt: plannedAltitudeValue ?? null,
        sourceCycle: null,
      };
    }
    if (arrivalFeedLeg && destinationRunway) {
      navDataLegsByIndex[arrivalFeedLeg.index] = {
        kind: 'terminal-feed-nav-data',
        sourceKind: 'briefing-data',
        label: `${destination.trim().toUpperCase() || arrivalFeedLeg.to} ${destinationRunway.runwayId} arrival feed`,
        arrivalIdent: `${destination.trim().toUpperCase() || arrivalFeedLeg.to} ${destinationRunway.runwayId}`,
        transitionFix: arrivalFeedLeg.from,
        handoffFix: arrivalFeedLeg.to,
        altitudeConstraintFt: plannedAltitudeValue ?? null,
        sourceCycle: null,
      };
    }
    if (finalLeg && destinationRunway) {
      navDataLegsByIndex[finalLeg.index] = {
        kind: 'final-capture-nav-data',
        sourceKind: 'briefing-data',
        label: `${destinationRunway.runwayId} final`,
        runwayIdent: destinationRunway.runwayId,
        finalCourseDeg: destinationRunway.headingDeg,
        thresholdFix: destination.trim().toUpperCase() || finalLeg.to,
        glideslopeAngleDeg: 3,
        sourceCycle: null,
      };
    }
    const payloads = Object.values(navDataLegsByIndex).filter(Boolean);
    const structuredLegCount = payloads.filter((payload) => payload?.sourceKind === 'route-structure').length;
    const briefingLegCount = payloads.filter((payload) => payload?.sourceKind === 'briefing-data').length;
    const navDataLegCount = payloads.filter((payload) => payload?.sourceKind === 'nav-data').length;
    const totalLegCount = routeSummary?.legs?.length || 0;
    const coveredLegCount = payloads.length;
    const coveragePct = totalLegCount > 0 ? Math.round((coveredLegCount / totalLegCount) * 100) : 0;
    return {
      source:
        navDataLegCount > 0
          ? ('nav-data' as const)
          : briefingLegCount > 0 && structuredLegCount > 0
            ? ('hybrid' as const)
            : briefingLegCount > 0
              ? ('briefing-data' as const)
              : structuredLegCount > 0
                ? ('route-structure' as const)
                : ('route-chain' as const),
      navDataLegsByIndex,
      structuredLegCount,
      briefingLegCount,
      navDataLegCount,
      totalLegCount,
      coveredLegCount,
      coveragePct,
      warnings: plannedRouteAnalysis.warnings,
      providerWarnings: Array.isArray(providerRouteSearch?.warnings) ? providerRouteSearch.warnings : [],
      airwaySegments: plannedRouteAnalysis.airwaySegments,
      providerRoute: providerRouteSearch?.route || null,
      providerRouteAvailable: Boolean(providerRouteSearch?.available && providerRouteSearch?.route),
      tokenCounts: plannedRouteAnalysis.counts,
    };
  }, [departure, departureRunway, destination, destinationRunway, plannedRouteAnalysis, plannedRouteAnchorTokens, plannedAltitudeValue, providerRouteAnchorTokens, providerRouteSearch?.available, providerRouteSearch?.environment, providerRouteSearch?.provider, providerRouteSearch?.route, providerRouteSearch?.warnings, routeSummary?.legs]);
  const activeNavDataLegsByIndex = useMemo(
    () =>
      directToRouteActive
        ? {}
        : plannerNavDataSnapshot.navDataLegsByIndex,
    [directToRouteActive, plannerNavDataSnapshot.navDataLegsByIndex]
  );
  const activeExecutionPlan = useMemo(
    () => buildMobileRouteExecutionPlan(activeRouteLegs, { navDataLegsByIndex: activeNavDataLegsByIndex }),
    [activeNavDataLegsByIndex, activeRouteLegs]
  );
  const activeProcedureChains = useMemo(
    () => buildMobileRouteProcedureChains(activeExecutionPlan),
    [activeExecutionPlan]
  );
  const plannerExecutionPlan = useMemo(
    () => buildMobileRouteExecutionPlan(routeSummary?.legs || [], { navDataLegsByIndex: plannerNavDataSnapshot.navDataLegsByIndex }),
    [plannerNavDataSnapshot.navDataLegsByIndex, routeSummary?.legs]
  );
  const plannerProcedureChains = useMemo(
    () => buildMobileRouteProcedureChains(plannerExecutionPlan),
    [plannerExecutionPlan]
  );
  const nextWaypointMeta = useMemo(() => {
    if (!routeProgress?.nextWaypoint) return null;
    const normalized = routeProgress.nextWaypoint.toUpperCase();
    return activeRoutePoints.find((point) => point.icao.toUpperCase() === normalized) || activeRoutePoints[1] || null;
  }, [activeRoutePoints, routeProgress?.nextWaypoint]);
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
  const routeExecutionSummary = useMemo(() => {
    if (!routeProgress) {
      return {
        mode: 'planned' as const,
        sequencingSuspended: false,
        activeLegIndex: 0,
        canSequencePrev: false,
        canSequenceNext: false,
        activeLegLabel: 'No active leg',
        activeLegType: 'enroute' as const,
        activeLegProfile: 'enroute' as const,
        activeLegGuidanceMode: 'track' as const,
        activeLegAnnunciation: 'Build route',
        nextLegLabel: 'Build route',
        nextLegType: null,
        destinationLegLabel: 'Destination pending',
        destinationLegType: null,
        nextLegArmed: false,
        nextAction: 'auto-advance' as const,
        nextActionCall: 'Next leg will auto-sequence when armed.',
        nextLegControlLabel: 'Force next',
        manualAdvanceRequired: false,
        nextLegDesiredTrackDeg: null,
        nextLegTurnDeltaDeg: null,
        nextLegTurnDirection: 'straight' as const,
        navDataSourceSummary: {
          code: 'CHAIN',
          detail: 'Route-chain geometry only. No structured route semantics are active.',
        },
        navDataWarnings: [] as string[],
        navDataCoveragePct: 0,
        navDataStructuredLegCount: 0,
        navDataBriefingLegCount: 0,
        navDataProviderLegCount: 0,
        navDataAirwaySegmentCount: 0,
        verticalConstraintState: 'path-monitor' as const,
        verticalConstraintCall: 'No structured vertical constraint active.',
        activeVerticalConstraintLabel: null,
        nextVerticalConstraintLabel: null,
        nextVerticalConstraintArmed: false,
        verticalConstraintSource: 'route-chain' as const,
        turnAnticipationState: 'idle' as const,
        turnAnticipationCall: 'No turn armed',
        lateralExecutionState: 'intercept' as const,
        sequenceGateState: 'blocked' as const,
        sequenceGateCall: 'Standby gate',
        activeExecutionSegment: {
          kind: 'enroute-track' as const,
          label: 'Standby segment',
          sequencingModel: 'auto' as const,
        },
        activeExecutionTransition: {
          kind: 'course-capture' as const,
          label: 'Course capture',
        },
        activeProcedureContext: {
          kind: 'enroute-structure' as const,
          label: 'Enroute structure',
        },
        activeProcedureHandoff: {
          kind: 'auto-course-handoff' as const,
          label: 'Auto course handoff',
        },
        activeProcedureChain: null,
        activeProcedureChainBehavior: null,
        activeProcedureTemplate: null,
        activeProcedureExecutionProfile: null,
        activeProcedureCueStack: null,
        activeProcedureEntryRole: null,
        activeProcedureEntryDescriptor: null,
        activeProcedureEntryTransitionBehavior: null,
        activeProcedureTransitionTable: null,
        activeProcedureSegmentTemplate: null,
        activeProcedureSegmentClass: null,
        activeProcedureLegAdapter: null,
        activeProcedureLegFamily: null,
        activeProcedureLegParserTarget: null,
        activeProcedureLegIngestionContract: null,
        activeParsedLegPayload: null,
        activeProcedureRoleCueProfile: null,
        activeProcedureRoleExecutionPolicy: null,
        nextExecutionSegment: null,
        nextExecutionTransition: null,
        nextProcedureContext: null,
        nextProcedureHandoff: null,
        nextProcedureChain: null,
        nextProcedureChainBehavior: null,
        nextProcedureTemplate: null,
        nextProcedureExecutionProfile: null,
        nextProcedureCueStack: null,
        nextProcedureEntryRole: null,
        nextProcedureEntryDescriptor: null,
        nextProcedureEntryTransitionBehavior: null,
        nextProcedureTransitionTable: null,
        nextProcedureSegmentTemplate: null,
        nextProcedureSegmentClass: null,
        nextProcedureLegAdapter: null,
        nextProcedureLegFamily: null,
        nextProcedureLegParserTarget: null,
        nextProcedureLegIngestionContract: null,
        nextParsedLegPayload: null,
        nextProcedureRoleCueProfile: null,
        nextProcedureRoleExecutionPolicy: null,
        transitionState: 'standby' as const,
        transitionCall: 'Standby',
        sequencingLabel: 'Standby',
        sequencingDetail: 'Build a route and establish live ownship to begin leg sequencing.',
      };
    }
    const sequencingLabel =
      sequencingSuspended
        ? 'Suspend'
        : routeProgress.sequencingState === 'reintercept'
        ? 'Reintercept'
        : routeProgress.sequencingState === 'terminal'
          ? 'Terminal leg'
          : 'Sequencing';
    const sequencingDetail =
      sequencingSuspended
        ? `Sequencing suspended on ${routeProgress.activeLegLabel || routeProgress.nextWaypoint || 'active leg'}.`
        : routeProgress.sequencingState === 'reintercept'
        ? `Hold ${routeProgress.activeLegLabel || routeProgress.nextWaypoint || 'active leg'} until course capture is restored.`
        : routeProgress.sequencingState === 'terminal'
          ? `Destination leg ${routeProgress.destinationLegLabel || routeProgress.destinationWaypoint || '--'} is active.`
          : `${routeProgress.remainingLegNm.toFixed(1)} NM remaining on ${routeProgress.activeLegLabel || routeProgress.nextWaypoint || 'active leg'}.`;
    const activeProcedureChain =
      activeProcedureChains.find(
        (chain) =>
          routeProgress.legIndex >= chain.startLegIndex && routeProgress.legIndex <= chain.endLegIndex,
      ) || null;
    const nextProcedureChain =
      activeProcedureChains.find((chain) => chain.startLegIndex > routeProgress.legIndex) || null;
    const activeProcedureChainBehavior =
      activeProcedureChain ? getMobileRouteProcedureChainBehavior(activeProcedureChain.kind) : null;
    const nextProcedureChainBehavior =
      nextProcedureChain ? getMobileRouteProcedureChainBehavior(nextProcedureChain.kind) : null;
    const activeProcedureTemplate = getMobileRouteProcedureTemplate(
      activeProcedureChain?.kind || 'enroute-structure',
    );
    const activeProcedureCueStack = getMobileRouteProcedureCueStack(
      activeProcedureChain?.kind || 'enroute-structure',
    );
    const nextProcedureTemplate = nextProcedureChain
      ? getMobileRouteProcedureTemplate(nextProcedureChain.kind)
      : null;
    const activeProcedureExecutionProfile = getMobileRouteProcedureExecutionProfile(
      activeProcedureChain?.kind || 'enroute-structure',
    );
    const nextProcedureExecutionProfile = nextProcedureChain
      ? getMobileRouteProcedureExecutionProfile(nextProcedureChain.kind)
      : null;
    const nextProcedureCueStack = nextProcedureChain
      ? getMobileRouteProcedureCueStack(nextProcedureChain.kind)
      : null;
    const activeProcedureEntryDescriptor = getMobileRouteProcedureEntryDescriptor(
      activeExecutionPlan[routeProgress.legIndex] || {
        fromFix: activeRouteLegs[routeProgress.legIndex]?.from || 'PT',
        toFix: activeRouteLegs[routeProgress.legIndex]?.to || 'PT',
        distanceNm: activeRouteLegs[routeProgress.legIndex]?.nm || 0,
        courseDeg: activeRouteLegs[routeProgress.legIndex]?.courseDeg ?? null,
        procedure: { kind: activeProcedureChain?.kind || 'enroute-structure', label: activeProcedureChain?.label || 'Enroute structure' },
      },
      {
        entryIndexInChain: activeProcedureChain
          ? routeProgress.legIndex - activeProcedureChain.startLegIndex
          : 0,
        entryCount: activeProcedureChain?.entryCount ?? 1,
      },
    );
    const activeProcedureEntryRole = activeProcedureEntryDescriptor.role;
    const nextProcedureEntryDescriptor =
      nextProcedureChain && routeProgress.legIndex + 1 >= nextProcedureChain.startLegIndex
        ? getMobileRouteProcedureEntryDescriptor(activeExecutionPlan[routeProgress.legIndex + 1] || {
            fromFix: activeRouteLegs[routeProgress.legIndex + 1]?.from || 'PT',
            toFix: activeRouteLegs[routeProgress.legIndex + 1]?.to || 'PT',
            distanceNm: activeRouteLegs[routeProgress.legIndex + 1]?.nm || 0,
            courseDeg: activeRouteLegs[routeProgress.legIndex + 1]?.courseDeg ?? null,
            procedure: { kind: nextProcedureChain.kind, label: nextProcedureChain.label },
          }, {
            entryIndexInChain: routeProgress.legIndex + 1 - nextProcedureChain.startLegIndex,
            entryCount: nextProcedureChain.entryCount,
          })
        : routeProgress.legIndex + 1 < activeRouteLegs.length
          ? getMobileRouteProcedureEntryDescriptor(
              {
                fromFix: activeRouteLegs[routeProgress.legIndex + 1]?.from || 'PT',
                toFix: activeRouteLegs[routeProgress.legIndex + 1]?.to || 'PT',
                distanceNm: activeRouteLegs[routeProgress.legIndex + 1]?.nm || 0,
                courseDeg: activeRouteLegs[routeProgress.legIndex + 1]?.courseDeg ?? null,
                procedure: {
                  kind:
                    activeRouteLegs[routeProgress.legIndex + 1]?.legType === 'departure'
                      ? 'departure-procedure'
                      : activeRouteLegs[routeProgress.legIndex + 1]?.legType === 'arrival'
                        ? 'arrival-procedure'
                        : activeRouteLegs[routeProgress.legIndex + 1]?.legType === 'direct-to'
                          ? 'direct-navigation'
                          : 'enroute-structure',
                  label:
                    activeRouteLegs[routeProgress.legIndex + 1]?.legType === 'departure'
                      ? 'Departure procedure'
                      : activeRouteLegs[routeProgress.legIndex + 1]?.legType === 'arrival'
                        ? 'Arrival procedure'
                        : activeRouteLegs[routeProgress.legIndex + 1]?.legType === 'direct-to'
                          ? 'Direct navigation'
                          : 'Enroute structure',
                },
                navDataPayload: null,
              },
              {
                entryIndexInChain: 0,
                entryCount: 1,
              },
            )
          : null;
    const nextProcedureEntryRole = nextProcedureEntryDescriptor?.role || null;
    const activeProcedureRoleCueProfile = getMobileRouteProcedureRoleCueProfile(
      activeProcedureEntryRole.kind,
    );
    const activeProcedureRoleExecutionPolicy = getMobileRouteProcedureRoleExecutionPolicy(
      activeProcedureEntryRole.kind,
    );
    const activeProcedureEntryTransitionBehavior = getMobileRouteProcedureEntryTransitionBehavior(
      activeProcedureEntryDescriptor,
    );
    const activeProcedureTransitionTable = getMobileRouteProcedureTransitionTable(
      activeProcedureChain?.kind || 'enroute-structure',
      activeProcedureEntryDescriptor,
      nextProcedureEntryDescriptor || null,
    );
    const nextProcedureRoleCueProfile = nextProcedureEntryRole
      ? getMobileRouteProcedureRoleCueProfile(nextProcedureEntryRole.kind)
      : null;
    const nextProcedureRoleExecutionPolicy = nextProcedureEntryRole
      ? getMobileRouteProcedureRoleExecutionPolicy(nextProcedureEntryRole.kind)
      : null;
    const nextProcedureEntryTransitionBehavior = nextProcedureEntryDescriptor
      ? getMobileRouteProcedureEntryTransitionBehavior(nextProcedureEntryDescriptor)
      : null;
    const nextProcedureTransitionTable = nextProcedureEntryDescriptor
      ? getMobileRouteProcedureTransitionTable(
          nextProcedureChain?.kind ||
            (activeRouteLegs[routeProgress.legIndex + 1]?.legType === 'departure'
              ? 'departure-procedure'
              : activeRouteLegs[routeProgress.legIndex + 1]?.legType === 'arrival'
                ? 'arrival-procedure'
                : activeRouteLegs[routeProgress.legIndex + 1]?.legType === 'direct-to'
                  ? 'direct-navigation'
                  : 'enroute-structure'),
          nextProcedureEntryDescriptor,
          null,
        )
      : null;
    const armingProgressPct = clamp(
      activeProcedureExecutionProfile.armAtProgressPct + activeProcedureRoleExecutionPolicy.armBiasPct,
      30,
      96,
    );
    const openProgressPct = clamp(
      activeProcedureExecutionProfile.openAtProgressPct + activeProcedureRoleExecutionPolicy.openBiasPct,
      40,
      99,
    );
    const nextLegArmed =
      !sequencingSuspended &&
      routeProgress.sequencingState === 'on-leg' &&
      routeProgress.legProgressPct >= armingProgressPct &&
      routeProgress.legsRemaining > 0;
    const nextLegStart = activeRoutePoints[routeProgress.legIndex + 1] || null;
    const nextLegEnd = activeRoutePoints[routeProgress.legIndex + 2] || null;
    const nextLegDesiredTrackDeg =
      nextLegStart && nextLegEnd ? bearingBetweenPoints(nextLegStart, nextLegEnd) : null;
    const nextLegTurnDeltaDeg =
      typeof nextLegDesiredTrackDeg === 'number' && typeof routeProgress.desiredTrackDeg === 'number'
        ? normalizeHeadingDelta(nextLegDesiredTrackDeg - routeProgress.desiredTrackDeg)
        : null;
    const nextLegTurnDirection =
      typeof nextLegTurnDeltaDeg === 'number' && Math.abs(nextLegTurnDeltaDeg) >= 8
        ? nextLegTurnDeltaDeg > 0
          ? 'right'
          : 'left'
        : 'straight';
    const turnAnticipationState =
      nextLegArmed &&
      typeof nextLegTurnDeltaDeg === 'number' &&
      Math.abs(nextLegTurnDeltaDeg) >= 15
        ? 'armed'
        : nextLegArmed
          ? 'monitor'
          : 'idle';
    const turnAnticipationCall =
      turnAnticipationState === 'armed'
        ? `${nextLegTurnDirection === 'right' ? 'Right' : 'Left'} turn ahead ${Math.round(Math.abs(nextLegTurnDeltaDeg ?? 0))}Â°`
        : turnAnticipationState === 'monitor'
          ? 'Next leg armed'
          : 'No turn armed';
    const activeVerticalConstraintPayload =
      activeProcedureEntryDescriptor.parsedLegPayload?.kind === 'runway-release-payload' ||
      activeProcedureEntryDescriptor.parsedLegPayload?.kind === 'terminal-feed-payload' ||
      activeProcedureEntryDescriptor.parsedLegPayload?.kind === 'final-capture-payload'
        ? activeProcedureEntryDescriptor.parsedLegPayload
        : null;
    const nextVerticalConstraintPayload =
      nextProcedureEntryDescriptor?.parsedLegPayload?.kind === 'runway-release-payload' ||
      nextProcedureEntryDescriptor?.parsedLegPayload?.kind === 'terminal-feed-payload' ||
      nextProcedureEntryDescriptor?.parsedLegPayload?.kind === 'final-capture-payload'
        ? nextProcedureEntryDescriptor.parsedLegPayload
        : null;
    const formatVerticalConstraintLabel = (payload: typeof activeVerticalConstraintPayload | typeof nextVerticalConstraintPayload) => {
      if (!payload) return null;
      if (payload.kind === 'runway-release-payload') return `${payload.airportIdent} RWY ${payload.runwayIdent}`;
      if (payload.kind === 'terminal-feed-payload') return `${payload.arrivalIdent} ${payload.transitionFix} -> ${payload.handoffFix}`;
      return `RWY ${payload.runwayIdent} final`;
    };
    const activeVerticalConstraintLabel = formatVerticalConstraintLabel(activeVerticalConstraintPayload);
    const nextVerticalConstraintLabel = formatVerticalConstraintLabel(nextVerticalConstraintPayload);
    const sequenceGateState =
      sequencingSuspended
        ? 'hold'
        : routeProgress.sequencingState === 'reintercept'
          ? 'blocked'
          : routeProgress.legProgressPct >= openProgressPct &&
              (!activeProcedureExecutionProfile.requiresLateralCapture || visionRouteGuidance?.lateralCaptured)
            ? activeProcedureRoleExecutionPolicy.sequencingModel === 'managed'
              ? 'manual-open'
              : 'open'
            : routeProgress.legProgressPct >= armingProgressPct
              ? 'armed'
              : 'blocked';
    const nextVerticalConstraintArmed =
      Boolean(nextVerticalConstraintPayload) &&
      (nextLegArmed || sequenceGateState === 'armed' || sequenceGateState === 'manual-open' || sequenceGateState === 'open');
    const verticalConstraintState =
      sequencingSuspended
        ? ('constraint-hold' as const)
        : activeVerticalConstraintPayload
          ? nextVerticalConstraintArmed
            ? ('constraint-handoff-armed' as const)
            : ('constraint-active' as const)
          : nextVerticalConstraintPayload
            ? nextVerticalConstraintArmed
              ? ('next-constraint-armed' as const)
              : ('next-constraint-staged' as const)
            : ('path-monitor' as const);
    const verticalConstraintCall =
      verticalConstraintState === 'constraint-hold'
        ? `Vertical constraint hold ${activeVerticalConstraintLabel || 'active path'}`
        : verticalConstraintState === 'constraint-handoff-armed'
          ? `${activeVerticalConstraintLabel || 'Active constraint'} - next armed ${nextVerticalConstraintLabel || 'constraint'}`
          : verticalConstraintState === 'constraint-active'
            ? `Constraint active ${activeVerticalConstraintLabel || 'current path'}`
            : verticalConstraintState === 'next-constraint-armed'
              ? `Next constraint armed ${nextVerticalConstraintLabel || 'upcoming path'}`
              : verticalConstraintState === 'next-constraint-staged'
                ? `Next constraint staged ${nextVerticalConstraintLabel || 'upcoming path'}`
                : 'Path monitor active';
    const manualAdvanceRequired = activeProcedureEntryTransitionBehavior.nextAction === 'pilot-advance';
    const nextActionCall = manualAdvanceRequired
      ? activeProcedureEntryTransitionBehavior.handoffCue
      : `${activeProcedureEntryTransitionBehavior.handoffCue} Automatic advance remains enabled when the gate opens.`;
    const nextLegControlLabel = manualAdvanceRequired ? 'Advance leg' : 'Force next';
    const lateralExecutionState =
      sequencingSuspended
        ? 'hold'
        : routeProgress.sequencingState === 'reintercept'
          ? 'reintercept'
          : visionRouteGuidance?.lateralCaptured
            ? 'established'
            : routeProgress.offRouteNm <= 0.45 && Math.abs(visionRouteGuidance?.headingDelta ?? 0) <= 10
            ? 'capture'
              : 'intercept';
    const sequenceGateCall =
      sequenceGateState === 'hold'
        ? activeProcedureRoleCueProfile.transitionCalls.hold
        : sequenceGateState === 'manual-open'
          ? `${activeProcedureRoleCueProfile.gateSubject} open - manual advance required`
        : sequenceGateState === 'open'
          ? `${activeProcedureRoleCueProfile.gateSubject} open`
          : sequenceGateState === 'armed'
            ? `${activeProcedureRoleCueProfile.gateSubject} armed`
            : `${activeProcedureRoleCueProfile.gateSubject} blocked`;
    const transitionState =
      sequencingSuspended
        ? 'sequencing-hold'
        : activeLegBehavior.profile === 'direct-to'
          ? lateralExecutionState === 'established'
            ? 'direct-established'
            : 'direct-intercept'
          : activeLegBehavior.profile === 'initial-departure'
            ? nextLegArmed
              ? 'departure-armed'
              : 'departure-rollout'
            : activeLegBehavior.profile === 'departure-transition'
              ? lateralExecutionState === 'established'
                ? 'departure-established'
                : 'departure-transition'
              : activeLegBehavior.profile === 'arrival-transition'
                ? nextLegArmed
                  ? 'arrival-armed'
                  : 'arrival-transition'
                : activeLegBehavior.profile === 'final'
                  ? lateralExecutionState === 'established'
                    ? 'final-established'
                    : 'final-intercept'
                  : lateralExecutionState === 'established'
                    ? 'enroute-established'
                    : lateralExecutionState === 'capture'
                      ? 'enroute-capture'
                      : 'enroute-intercept';
    const transitionCall =
      transitionState === 'sequencing-hold'
        ? activeProcedureRoleCueProfile.transitionCalls.hold
        : transitionState === 'departure-armed' || transitionState === 'arrival-armed'
          ? activeProcedureRoleCueProfile.transitionCalls.armed || activeProcedureRoleCueProfile.transitionCalls.intercept
          : transitionState === 'departure-rollout'
            ? activeProcedureRoleCueProfile.transitionCalls.rollout || activeProcedureRoleCueProfile.transitionCalls.intercept
            : transitionState === 'departure-established' ||
                transitionState === 'direct-established' ||
                transitionState === 'final-established' ||
                transitionState === 'enroute-established'
              ? activeProcedureRoleCueProfile.transitionCalls.established
              : transitionState === 'enroute-capture'
                ? activeProcedureRoleCueProfile.transitionCalls.capture || activeProcedureRoleCueProfile.transitionCalls.intercept
                : activeProcedureRoleCueProfile.transitionCalls.intercept;
    const activeExecutionSegment = getMobileRouteExecutionSegment(activeLegBehavior.profile, {
      sequenceGateState: sequenceGateState === 'manual-open' ? 'open' : sequenceGateState,
    });
    const nextExecutionSegmentEntry = activeExecutionPlan[routeProgress.legIndex + 1] || null;
    const nextExecutionSegment =
      nextExecutionSegmentEntry != null
        ? {
            ...nextExecutionSegmentEntry.segment,
            sequencingModel: nextExecutionSegmentEntry.segment.sequencingModel,
          }
        : null;
    return {
      mode: directToRouteActive ? ('direct-to' as const) : ('planned' as const),
      sequencingSuspended,
      activeLegIndex: routeProgress.legIndex,
      canSequencePrev: routeProgress.legIndex > 0,
      canSequenceNext:
        routeProgress.legIndex < Math.max(0, activeRouteLegs.length - 1) &&
        (!manualAdvanceRequired || nextLegArmed || sequenceGateState === 'manual-open' || sequencingSuspended),
      activeLegLabel: routeProgress.activeLegLabel || routeProgress.nextWaypoint || 'Active leg',
      activeLegType: activeRouteLegs[routeProgress.legIndex]?.legType || 'enroute',
      activeLegProfile: activeLegBehavior.profile,
      activeLegGuidanceMode: activeLegBehavior.guidanceMode,
      activeLegAnnunciation: `${activeProcedureEntryRole.cue} · ${activeLegBehavior.annunciation}`,
      nextLegLabel: routeProgress.nextLegLabel || routeProgress.nextWaypoint || 'Next leg pending',
      nextLegType: activeRouteLegs[routeProgress.legIndex + 1]?.legType || null,
      destinationLegLabel: routeProgress.destinationLegLabel || routeProgress.destinationWaypoint || 'Destination leg pending',
      destinationLegType: activeRouteLegs[activeRouteLegs.length - 1]?.legType || null,
      nextLegArmed,
      nextAction: activeProcedureEntryTransitionBehavior.nextAction,
      nextActionCall,
      nextLegControlLabel,
      manualAdvanceRequired,
      nextLegDesiredTrackDeg,
      nextLegTurnDeltaDeg,
      nextLegTurnDirection,
        navDataSourceSummary: {
          code:
          plannerNavDataSnapshot.source === 'nav-data'
            ? 'NAV'
            : plannerNavDataSnapshot.source === 'hybrid'
              ? 'HYBRID'
              : plannerNavDataSnapshot.source === 'briefing-data'
                ? 'BRIEF'
                : plannerNavDataSnapshot.source === 'route-structure'
            ? 'STRUCT'
            : 'CHAIN',
        detail:
          plannerNavDataSnapshot.source === 'nav-data'
            ? `Provider-backed route guidance is active on ${plannerNavDataSnapshot.navDataLegCount}/${plannerNavDataSnapshot.totalLegCount || activeRouteLegs.length || 0} legs${plannerNavDataSnapshot.providerRouteAvailable ? '.' : ', with fallback structure on remaining legs.'}`
            : plannerNavDataSnapshot.source === 'hybrid'
              ? `Hybrid route intelligence active: ${plannerNavDataSnapshot.navDataLegCount} provider legs, ${plannerNavDataSnapshot.structuredLegCount} structured legs, and ${plannerNavDataSnapshot.briefingLegCount} briefing-backed legs.`
              : plannerNavDataSnapshot.source === 'briefing-data'
                ? `Briefing-backed departure, arrival feed, and final data is active on ${plannerNavDataSnapshot.briefingLegCount}/${plannerNavDataSnapshot.totalLegCount || activeRouteLegs.length || 0} legs.`
                : plannerNavDataSnapshot.source === 'route-structure'
                  ? `Structured route semantics active on ${plannerNavDataSnapshot.structuredLegCount}/${plannerNavDataSnapshot.totalLegCount || activeRouteLegs.length || 0} legs.`
                  : 'Route-chain geometry only. No structured route semantics are active.',
      },
      navDataWarnings: [...plannerNavDataSnapshot.warnings, ...plannerNavDataSnapshot.providerWarnings],
      navDataCoveragePct: plannerNavDataSnapshot.coveragePct,
      navDataStructuredLegCount: plannerNavDataSnapshot.structuredLegCount,
      navDataBriefingLegCount: plannerNavDataSnapshot.briefingLegCount,
      navDataProviderLegCount: plannerNavDataSnapshot.navDataLegCount,
      navDataAirwaySegmentCount: plannerNavDataSnapshot.airwaySegments.length,
      verticalConstraintState,
      verticalConstraintCall,
      activeVerticalConstraintLabel,
      nextVerticalConstraintLabel,
      nextVerticalConstraintArmed,
      verticalConstraintSource:
        activeVerticalConstraintPayload?.source ||
        nextVerticalConstraintPayload?.source ||
        plannerNavDataSnapshot.source,
      turnAnticipationState,
      turnAnticipationCall,
      lateralExecutionState,
      sequenceGateState,
      sequenceGateCall,
      activeExecutionSegment,
      activeExecutionSegmentEntry: activeExecutionPlan[routeProgress.legIndex] || null,
      activeExecutionTransition:
        activeExecutionPlan[routeProgress.legIndex]?.transition || {
          kind: 'course-capture' as const,
          label: 'Course capture',
        },
      activeProcedureContext:
        activeExecutionPlan[routeProgress.legIndex]?.procedure || {
          kind: 'enroute-structure' as const,
          label: 'Enroute structure',
        },
      activeProcedureHandoff:
        activeExecutionPlan[routeProgress.legIndex]?.handoff || {
          kind: 'auto-course-handoff' as const,
          label: 'Auto course handoff',
        },
      activeProcedureChain,
      activeProcedureChainBehavior,
      activeProcedureTemplate,
      activeProcedureExecutionProfile,
      activeProcedureCueStack,
      activeProcedureEntryRole,
      activeProcedureEntryDescriptor,
      activeProcedureEntryTransitionBehavior,
      activeProcedureTransitionTable,
      activeProcedureSegmentTemplate: activeProcedureEntryDescriptor.segmentTemplate,
      activeProcedureSegmentClass: activeProcedureEntryDescriptor.segmentClass,
      activeProcedureLegAdapter: activeProcedureEntryDescriptor.procedureLegAdapter,
      activeProcedureLegFamily: activeProcedureEntryDescriptor.procedureLegFamily,
      activeProcedureLegParserTarget: activeProcedureEntryDescriptor.procedureLegParserTarget,
      activeProcedureLegIngestionContract: activeProcedureEntryDescriptor.procedureLegIngestionContract,
      activeParsedLegPayload: activeProcedureEntryDescriptor.parsedLegPayload,
      activeProcedureRoleCueProfile,
      activeProcedureRoleExecutionPolicy,
      nextExecutionSegment,
      nextExecutionSegmentEntry,
      nextExecutionTransition: nextExecutionSegmentEntry?.transition || null,
      nextProcedureContext: nextExecutionSegmentEntry?.procedure || null,
      nextProcedureHandoff: nextExecutionSegmentEntry?.handoff || null,
      nextProcedureChain,
      nextProcedureChainBehavior,
      nextProcedureTemplate,
      nextProcedureExecutionProfile,
      nextProcedureCueStack,
      nextProcedureEntryRole,
      nextProcedureEntryDescriptor,
      nextProcedureEntryTransitionBehavior,
      nextProcedureTransitionTable,
      nextProcedureSegmentTemplate: nextProcedureEntryDescriptor?.segmentTemplate || null,
      nextProcedureSegmentClass: nextProcedureEntryDescriptor?.segmentClass || null,
      nextProcedureLegAdapter: nextProcedureEntryDescriptor?.procedureLegAdapter || null,
      nextProcedureLegFamily: nextProcedureEntryDescriptor?.procedureLegFamily || null,
      nextProcedureLegParserTarget: nextProcedureEntryDescriptor?.procedureLegParserTarget || null,
      nextProcedureLegIngestionContract: nextProcedureEntryDescriptor?.procedureLegIngestionContract || null,
      nextParsedLegPayload: nextProcedureEntryDescriptor?.parsedLegPayload || null,
      nextProcedureRoleCueProfile,
      nextProcedureRoleExecutionPolicy,
      transitionState,
      transitionCall,
      sequencingLabel,
      sequencingDetail: `${sequencingDetail} ${activeProcedureRoleCueProfile.sequencingSummary}. ${activeProcedureCueStack.sequencingSummary}. ${activeProcedureEntryTransitionBehavior.sequencingCue} Handoff ${activeExecutionPlan[routeProgress.legIndex]?.handoff?.label || 'Auto course handoff'}. ${activeProcedureEntryTransitionBehavior.handoffCue} ${activeProcedureTransitionTable.handoffPathLabel}. ${activeProcedureChainBehavior?.label || 'Enroute auto block'}. ${activeProcedureTemplate.label}. Arm at ${armingProgressPct.toFixed(0)}%${activeProcedureRoleExecutionPolicy.manualReason ? ` ${activeProcedureRoleExecutionPolicy.manualReason}` : ''}`,
    };
  }, [activeExecutionPlan, activeLegBehavior.annunciation, activeLegBehavior.guidanceMode, activeLegBehavior.profile, activeProcedureChains, activeRouteLegs, activeRoutePoints, plannerNavDataSnapshot.airwaySegments.length, plannerNavDataSnapshot.briefingLegCount, plannerNavDataSnapshot.coveragePct, plannerNavDataSnapshot.coveredLegCount, plannerNavDataSnapshot.navDataLegCount, plannerNavDataSnapshot.providerRouteAvailable, plannerNavDataSnapshot.providerWarnings, plannerNavDataSnapshot.source, plannerNavDataSnapshot.structuredLegCount, plannerNavDataSnapshot.totalLegCount, plannerNavDataSnapshot.warnings, routeExecutionOverride?.mode, routeProgress, sequencingSuspended, visionRouteGuidance?.headingDelta, visionRouteGuidance?.lateralCaptured]);
  const flightDeckVerticalConstraintSummary = useMemo(() => {
    const activePayload = routeExecutionSummary.activeParsedLegPayload;
    const nextPayload = routeExecutionSummary.nextParsedLegPayload;
    const stage = flightDeckPhaseSummary.stage;
    const currentAltitudeFt = activeOwnship?.altitudeFt ?? simulationAltitudeFt;
    const groundspeedKts = Math.max(activeOwnship?.speedKts ?? simulationCruiseKts, 60);
    const remainingRouteNm =
      typeof routeProgress?.remainingRouteNm === 'number' && Number.isFinite(routeProgress.remainingRouteNm)
        ? routeProgress.remainingRouteNm
        : null;
    const computeRequiredVsi = (targetAltitudeFt: number, distanceNm: number | null) => {
      if (typeof distanceNm !== 'number' || !Number.isFinite(distanceNm) || distanceNm <= 0.2) return null;
      const minutes = Math.max((distanceNm / groundspeedKts) * 60, 0.5);
      return Math.round(((targetAltitudeFt - currentAltitudeFt) / minutes) / 25) * 25;
    };

    const courseConstraintFt =
      activePayload?.kind === 'course-to-fix-payload'
        ? null
        : nextPayload?.kind === 'course-to-fix-payload'
          ? null
          : null;
    void courseConstraintFt;

    let modeLabel = 'Heuristic path';
    let sourceLabel = 'Heuristic';
    let targetAltitudeFt: number | null = null;
    let requiredVsiFpm: number | null = null;
    let support = 'No structured vertical constraint is active yet.';
    let recommendation = 'Continue using the advisory path model.';
    let call = flightDeckVerticalPathSummary.advisoryCall;
    let activeConstraintLabel = 'Advisory path';
    let nextConstraintLabel: string | null = null;
    let nextConstraintArmed = false;
    let activeConstraintDistanceNm = remainingRouteNm;
    let constraintGateState: 'monitor' | 'staged' | 'armed' | 'open' | 'hold' | 'active' = 'monitor';
    let constraintGateCall = 'Vertical path monitor';

    const terminalPayload =
      activePayload?.kind === 'terminal-feed-payload'
        ? activePayload
        : nextPayload?.kind === 'terminal-feed-payload'
          ? nextPayload
          : null;
    const finalPayload =
      activePayload?.kind === 'final-capture-payload'
        ? activePayload
        : nextPayload?.kind === 'final-capture-payload'
          ? nextPayload
          : null;
    const runwayReleasePayload =
      activePayload?.kind === 'runway-release-payload'
        ? activePayload
        : nextPayload?.kind === 'runway-release-payload'
          ? nextPayload
          : null;
    const courseConstraintPayload =
      activePayload?.kind === 'course-to-fix-payload' && typeof activePayload.altitudeConstraintFt === 'number'
        ? activePayload
        : nextPayload?.kind === 'course-to-fix-payload' && typeof nextPayload.altitudeConstraintFt === 'number'
          ? nextPayload
          : null;
    const nextConstraintPayload =
      nextPayload?.kind === 'course-to-fix-payload' && typeof nextPayload.altitudeConstraintFt === 'number'
        ? nextPayload
        :
      nextPayload?.kind === 'terminal-feed-payload' ||
      nextPayload?.kind === 'final-capture-payload' ||
      nextPayload?.kind === 'runway-release-payload'
        ? nextPayload
        : null;

    if (nextConstraintPayload) {
      nextConstraintArmed =
        Boolean(routeExecutionSummary.nextLegArmed) ||
        routeExecutionSummary.sequenceGateState === 'armed' ||
        routeExecutionSummary.sequenceGateState === 'manual-open' ||
        routeExecutionSummary.sequenceGateState === 'open';
      nextConstraintLabel =
        nextConstraintPayload.kind === 'runway-release-payload'
          ? `${nextConstraintPayload.airportIdent} RWY ${nextConstraintPayload.runwayIdent}`
          : nextConstraintPayload.kind === 'course-to-fix-payload'
            ? `${nextConstraintPayload.fromFix} -> ${nextConstraintPayload.toFix}`
          : nextConstraintPayload.kind === 'terminal-feed-payload'
            ? `${nextConstraintPayload.arrivalIdent} ${nextConstraintPayload.transitionFix}`
            : `RWY ${nextConstraintPayload.runwayIdent} final`;
    }

    if ((stage === 'departure' || stage === 'climb') && runwayReleasePayload?.initialAltitudeFt) {
      targetAltitudeFt = runwayReleasePayload.initialAltitudeFt;
      requiredVsiFpm = computeRequiredVsi(targetAltitudeFt, routeProgress?.remainingLegNm ?? remainingRouteNm);
      modeLabel = 'Procedure climb';
      sourceLabel = runwayReleasePayload.source;
      activeConstraintLabel = `${runwayReleasePayload.airportIdent} RWY ${runwayReleasePayload.runwayIdent}`;
      support = `${runwayReleasePayload.airportIdent} RWY ${runwayReleasePayload.runwayIdent} release altitude`;
      recommendation =
        requiredVsiFpm != null
          ? `Procedure climb target ${targetAltitudeFt} ft - ${Math.abs(requiredVsiFpm)} fpm advisory.`
          : `Procedure climb target ${targetAltitudeFt} ft.`;
      call = `Climb to ${targetAltitudeFt} ft`;
    } else if (courseConstraintPayload?.altitudeConstraintFt) {
      targetAltitudeFt = courseConstraintPayload.altitudeConstraintFt;
      activeConstraintDistanceNm =
        courseConstraintPayload === activePayload
          ? routeProgress?.remainingLegNm ?? remainingRouteNm
          : remainingRouteNm;
      requiredVsiFpm = computeRequiredVsi(targetAltitudeFt, activeConstraintDistanceNm);
      modeLabel = 'Leg constraint';
      sourceLabel = courseConstraintPayload.source;
      activeConstraintLabel = `${courseConstraintPayload.fromFix} -> ${courseConstraintPayload.toFix}`;
      support = `Meet ${targetAltitudeFt} ft by ${courseConstraintPayload.toFix}`;
      recommendation =
        requiredVsiFpm != null
          ? `Leg altitude constraint active - ${Math.abs(requiredVsiFpm)} fpm required by ${courseConstraintPayload.toFix}.`
          : `Leg altitude constraint active for ${courseConstraintPayload.toFix}.`;
      call =
        Math.abs(targetAltitudeFt - currentAltitudeFt) < 150
          ? `Leg constraint met ${targetAltitudeFt} ft`
          : targetAltitudeFt < currentAltitudeFt
            ? `Descend to ${targetAltitudeFt} ft by ${courseConstraintPayload.toFix}`
            : `Climb to ${targetAltitudeFt} ft by ${courseConstraintPayload.toFix}`;
    } else if ((stage === 'descent' || stage === 'arrival') && terminalPayload?.altitudeConstraintFt) {
      targetAltitudeFt = terminalPayload.altitudeConstraintFt;
      requiredVsiFpm = computeRequiredVsi(targetAltitudeFt, remainingRouteNm);
      modeLabel = 'Terminal constraint';
      sourceLabel = terminalPayload.source;
      activeConstraintLabel = `${terminalPayload.arrivalIdent} ${terminalPayload.transitionFix} -> ${terminalPayload.handoffFix}`;
      support = `${terminalPayload.arrivalIdent} via ${terminalPayload.transitionFix} -> ${terminalPayload.handoffFix}`;
      recommendation =
        requiredVsiFpm != null
          ? `Meet ${targetAltitudeFt} ft at terminal feed - ${Math.abs(requiredVsiFpm)} fpm required.`
          : `Meet ${targetAltitudeFt} ft at terminal feed.`;
      call =
        Math.abs(targetAltitudeFt - currentAltitudeFt) < 150
          ? `Terminal constraint met ${targetAltitudeFt} ft`
          : targetAltitudeFt < currentAltitudeFt
            ? `Descend to ${targetAltitudeFt} ft`
            : `Recover to ${targetAltitudeFt} ft`;
    } else if (stage === 'final' && finalPayload) {
      const glideAngleDeg = finalPayload.glideslopeAngleDeg ?? 3;
      const feetPerNm = Math.tan((glideAngleDeg * Math.PI) / 180) * 6076;
      targetAltitudeFt =
        typeof remainingRouteNm === 'number'
          ? Math.round((destinationElevationFtEstimate + remainingRouteNm * feetPerNm + 50) / 50) * 50
          : null;
      requiredVsiFpm = targetAltitudeFt != null ? computeRequiredVsi(targetAltitudeFt, remainingRouteNm) : null;
      modeLabel = 'Final constraint';
      sourceLabel = finalPayload.source;
      activeConstraintLabel = `RWY ${finalPayload.runwayIdent} ${finalPayload.thresholdFix}`;
      support = `RWY ${finalPayload.runwayIdent} final ${glideAngleDeg.toFixed(1)}° via ${finalPayload.thresholdFix}`;
      recommendation =
        requiredVsiFpm != null
          ? `Fly the final path at ${Math.abs(requiredVsiFpm)} fpm.`
          : `Track the final glidepath to runway ${finalPayload.runwayIdent}.`;
      call =
        targetAltitudeFt != null
          ? Math.abs(targetAltitudeFt - currentAltitudeFt) < 120
            ? 'On final glidepath'
            : targetAltitudeFt < currentAltitudeFt
              ? `Descend on final to ${targetAltitudeFt} ft`
              : `Recover to final path ${targetAltitudeFt} ft`
          : `Track RWY ${finalPayload.runwayIdent} final path`;
    }

    if (nextConstraintLabel) {
      if (routeExecutionSummary.sequencingSuspended || routeExecutionSummary.sequenceGateState === 'hold') {
        constraintGateState = 'hold';
        constraintGateCall = `Vertical hold - ${nextConstraintLabel}`;
      } else if (
        routeExecutionSummary.sequenceGateState === 'open' ||
        routeExecutionSummary.sequenceGateState === 'manual-open'
      ) {
        constraintGateState = 'open';
        constraintGateCall = `Vertical handoff open - ${nextConstraintLabel}`;
      } else if (nextConstraintArmed) {
        constraintGateState = 'armed';
        constraintGateCall = `Vertical handoff armed - ${nextConstraintLabel}`;
      } else {
        constraintGateState = 'staged';
        constraintGateCall = `Vertical handoff staged - ${nextConstraintLabel}`;
      }
    } else if (targetAltitudeFt != null) {
      constraintGateState = 'active';
      constraintGateCall = `${modeLabel} active`;
    }

    return {
      modeLabel,
      sourceLabel,
      targetAltitudeFt,
      requiredVsiFpm,
      support,
      recommendation,
      call,
      activeConstraintLabel,
      nextConstraintLabel,
      nextConstraintArmed,
      activeConstraintDistanceNm,
      constraintGateState,
      constraintGateCall,
    };
  }, [
    activeOwnship?.altitudeFt,
    activeOwnship?.speedKts,
    destinationElevationFtEstimate,
    flightDeckPhaseSummary.stage,
    flightDeckVerticalPathSummary.advisoryCall,
    routeExecutionSummary.nextLegArmed,
    routeExecutionSummary.sequencingSuspended,
    routeExecutionSummary.sequenceGateState,
    routeExecutionSummary.activeParsedLegPayload,
    routeExecutionSummary.nextParsedLegPayload,
    routeProgress?.remainingLegNm,
    routeProgress?.remainingRouteNm,
    simulationAltitudeFt,
    simulationCruiseKts,
  ]);
  const mapVerticalGuidancePresentation = useMemo(() => {
    if (!activeOwnship || activeRoutePoints.length < 2) return null;

    const ownshipPoint = { latitude: activeOwnship.lat, longitude: activeOwnship.lon };
    const activeLegIndex = Math.min(routeProgress?.legIndex ?? 0, Math.max(0, activeRoutePoints.length - 2));
    const remainingRouteNm =
      typeof routeProgress?.remainingRouteNm === 'number' && Number.isFinite(routeProgress.remainingRouteNm)
        ? routeProgress.remainingRouteNm
        : null;
    const activeConstraintDistanceNm =
      typeof flightDeckVerticalConstraintSummary.activeConstraintDistanceNm === 'number' &&
      Number.isFinite(flightDeckVerticalConstraintSummary.activeConstraintDistanceNm)
        ? flightDeckVerticalConstraintSummary.activeConstraintDistanceNm
        : null;
    const todDistanceNm =
      typeof flightDeckVerticalPathSummary.distanceToTodNm === 'number' &&
      Number.isFinite(flightDeckVerticalPathSummary.distanceToTodNm) &&
      flightDeckVerticalPathSummary.distanceToTodNm > 0
        ? flightDeckVerticalPathSummary.distanceToTodNm
        : null;

    let kind: 'constraint' | 'tod' | null = null;
    let anchorDistanceNm: number | null = null;
    let label = '';
    let subtitle = '';
    let detail = '';

    if (
      flightDeckVerticalConstraintSummary.targetAltitudeFt != null &&
      activeConstraintDistanceNm != null &&
      activeConstraintDistanceNm > 0.15
    ) {
      kind = 'constraint';
      anchorDistanceNm = activeConstraintDistanceNm;
      label = flightDeckVerticalConstraintSummary.modeLabel === 'Leg constraint' ? 'ALT' : 'PROC';
      subtitle = `${Math.round(flightDeckVerticalConstraintSummary.targetAltitudeFt)} FT`;
      detail = flightDeckVerticalConstraintSummary.activeConstraintLabel;
    } else if (todDistanceNm != null && todDistanceNm > 0.35) {
      kind = 'tod';
      anchorDistanceNm = todDistanceNm;
      label = 'TOD';
      subtitle = `${todDistanceNm.toFixed(1)} NM`;
      detail = flightDeckVerticalPathSummary.modeLabel;
    }

    if (!kind || anchorDistanceNm == null) return null;

    const boundedDistanceNm =
      remainingRouteNm != null ? Math.min(anchorDistanceNm, Math.max(remainingRouteNm, 0.2)) : anchorDistanceNm;
    const coordinate = projectPointAlongRoute(activeRoutePoints, ownshipPoint, activeLegIndex, boundedDistanceNm);

    return {
      kind,
      label,
      subtitle,
      detail,
      distanceNm: anchorDistanceNm,
      coordinate,
    };
  }, [
    activeOwnship,
    activeRoutePoints,
    flightDeckVerticalConstraintSummary.activeConstraintDistanceNm,
    flightDeckVerticalConstraintSummary.activeConstraintLabel,
    flightDeckVerticalConstraintSummary.modeLabel,
    flightDeckVerticalConstraintSummary.targetAltitudeFt,
    flightDeckVerticalPathSummary.distanceToTodNm,
    flightDeckVerticalPathSummary.modeLabel,
    routeProgress?.legIndex,
    routeProgress?.remainingRouteNm,
  ]);
  const selectedTrafficTrend = useMemo(
    () => (selectedTrafficTarget ? trafficTrendMap[selectedTrafficTarget.id] || null : null),
    [selectedTrafficTarget, trafficTrendMap]
  );
  const selectedDiversionRunwaySummary = useMemo(() => {
    if (selectedDiversionBriefingLoading) return 'Loading runway briefing';
    if (selectedDiversionBriefing?.advisory) {
      return `Runway ${selectedDiversionBriefing.advisory.runway || '--'} Â· HW ${selectedDiversionBriefing.advisory.headwind ?? '--'} kt Â· XW ${selectedDiversionBriefing.advisory.crosswind ?? '--'} kt`;
    }
    if (selectedDiversionBriefing?.runwayInUse) {
      return `Runway in use ${selectedDiversionBriefing.runwayInUse}`;
    }
    return 'Runway advisory pending';
  }, [selectedDiversionBriefing, selectedDiversionBriefingLoading]);
  useEffect(() => {
    if (!simulationEnabled && !receiverOwnship && !gpsData && !simulatedGpsData) return;
    const timer = setInterval(() => {
      setOwnshipClockMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [gpsData, receiverOwnship, simulatedGpsData, simulationEnabled]);
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
      activeRoutePoints.length >= 2
        ? activeRoutePoints.map((point) => `${point.latitude},${point.longitude}`).join(';')
        : '',
    [activeRoutePoints]
  );
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
  const flightDeckVerticalAlertSummary = useMemo(() => {
    const activeTargetAltitudeFt =
      flightDeckVerticalConstraintSummary.targetAltitudeFt ?? flightDeckVerticalPathSummary.targetAltitudeFt;
    const activeVerticalErrorFt =
      flightDeckVerticalConstraintSummary.targetAltitudeFt != null
        ? activeTargetAltitudeFt != null
          ? activeTargetAltitudeFt - (activeOwnship?.altitudeFt ?? simulationAltitudeFt)
          : null
        : flightDeckVerticalPathSummary.verticalErrorFt;
    const distanceToTodNm = flightDeckVerticalPathSummary.distanceToTodNm;
    const stage = flightDeckPhaseSummary.stage;
    const deviationAbsFt =
      typeof activeVerticalErrorFt === 'number' && Number.isFinite(activeVerticalErrorFt)
        ? Math.abs(activeVerticalErrorFt)
        : null;
    const deviationLabel =
      deviationAbsFt == null
        ? 'VNAV pending'
        : deviationAbsFt < 120
          ? 'On path'
          : `${activeVerticalErrorFt != null && activeVerticalErrorFt < 0 ? 'High' : 'Low'} ${Math.round(deviationAbsFt)} ft`;
    const todLabel =
      typeof distanceToTodNm === 'number' && Number.isFinite(distanceToTodNm)
        ? distanceToTodNm > 0
          ? `TOD ${distanceToTodNm.toFixed(1)} NM`
          : `TOD passed ${Math.abs(distanceToTodNm).toFixed(1)} NM`
        : 'TOD pending';

    if (
      stage === 'cruise' &&
      typeof distanceToTodNm === 'number' &&
      Number.isFinite(distanceToTodNm) &&
      distanceToTodNm > 0 &&
      distanceToTodNm <= 4
    ) {
      return {
        severity: 'caution' as const,
        title: 'Top of descent approaching',
        detail: `${todLabel}. ${flightDeckVerticalPathSummary.recommendation}`,
        deviationLabel,
        todLabel,
      };
    }

    if (
      (stage === 'descent' || stage === 'arrival' || stage === 'final') &&
      deviationAbsFt != null &&
      activeTargetAltitudeFt != null
    ) {
      const thresholdFt = stage === 'final' ? 250 : 450;
      if (deviationAbsFt >= thresholdFt) {
        return {
          severity: stage === 'final' && deviationAbsFt >= 600 ? ('warning' as const) : ('caution' as const),
          title: stage === 'final' ? 'Vertical path deviation' : 'Descent path deviation',
          detail: `${deviationLabel}. Target ${Math.round(activeTargetAltitudeFt)} ft. ${flightDeckVerticalConstraintSummary.targetAltitudeFt != null ? flightDeckVerticalConstraintSummary.recommendation : flightDeckVerticalPathSummary.recommendation}`,
          deviationLabel,
          todLabel,
        };
      }
    }

    if (
      stage === 'cruise' &&
      typeof distanceToTodNm === 'number' &&
      Number.isFinite(distanceToTodNm) &&
      distanceToTodNm < -2 &&
      deviationAbsFt != null &&
      deviationAbsFt >= 500
    ) {
      return {
        severity: 'caution' as const,
        title: 'Descent path late',
        detail: `${todLabel}. ${deviationLabel}. ${flightDeckVerticalPathSummary.recommendation}`,
        deviationLabel,
        todLabel,
      };
    }

    return {
      severity: null,
      title: null,
      detail: null,
      deviationLabel,
      todLabel,
    };
  }, [
    activeOwnship?.altitudeFt,
    flightDeckPhaseSummary.stage,
    flightDeckVerticalConstraintSummary.recommendation,
    flightDeckVerticalConstraintSummary.targetAltitudeFt,
    flightDeckVerticalPathSummary.distanceToTodNm,
    flightDeckVerticalPathSummary.recommendation,
    flightDeckVerticalPathSummary.targetAltitudeFt,
    flightDeckVerticalPathSummary.verticalErrorFt,
    simulationAltitudeFt,
  ]);
  const activeFlightAlert = useMemo(() => {
    if (selectedTrafficTarget?.threatLevel === 'immediate') {
      return {
        severity: 'warning' as const,
        title: 'Immediate traffic',
        detail: `${selectedTrafficTarget.callsign || 'Traffic'} ${selectedTrafficTarget.distanceNm.toFixed(1)} NM Â· ${formatAltitudeDelta(selectedTrafficTarget.altitudeDeltaFt)}`,
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
        detail: `${selectedDiversion.icao} ${selectedDiversion.flightCategory || 'WX'}${selectedDiversionBriefing?.advisory?.crosswind ? ` Â· XW ${selectedDiversionBriefing.advisory.crosswind} kt` : ''}`,
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
    if (flightDeckVerticalAlertSummary.severity && flightDeckVerticalAlertSummary.title && flightDeckVerticalAlertSummary.detail) {
      return {
        severity: flightDeckVerticalAlertSummary.severity,
        title: flightDeckVerticalAlertSummary.title,
        detail: flightDeckVerticalAlertSummary.detail,
      };
    }
    return null;
  }, [
    flightDeckVerticalAlertSummary.detail,
    flightDeckVerticalAlertSummary.severity,
    flightDeckVerticalAlertSummary.title,
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
        detail: `${selectedTrafficTarget.callsign || 'Traffic'} ${selectedTrafficTarget.distanceNm.toFixed(1)} NM Â· ${formatAltitudeDelta(selectedTrafficTarget.altitudeDeltaFt)}`,
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
    if (flightDeckVerticalAlertSummary.severity && flightDeckVerticalAlertSummary.title && flightDeckVerticalAlertSummary.detail) {
      return {
        severity: flightDeckVerticalAlertSummary.severity,
        title: flightDeckVerticalAlertSummary.title,
        detail: flightDeckVerticalAlertSummary.detail,
      };
    }
    return activeFlightAlert;
  }, [
    activeFlightAlert,
    flightDeckAdvisoriesMuted,
    flightDeckVerticalAlertSummary.detail,
    flightDeckVerticalAlertSummary.severity,
    flightDeckVerticalAlertSummary.title,
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
    if (visionMode === 'free' && activeOwnship) {
      return 'Free-flight awareness active';
    }
    if (routeProgress?.activeLegLabel) {
      return routeProgress.sequencingState === 'reintercept'
        ? `Rejoin ${routeProgress.activeLegLabel}`
        : `${activeLegBehavior.annunciation}`;
    }
    if (routeProgress?.nextWaypoint) {
      return `Track to ${routeProgress.nextWaypoint}`;
    }
    return visionMode === 'free' ? 'Awaiting live ownship source' : 'Hold current route';
  }, [activeLegBehavior.annunciation, activeOwnship, routeProgress?.activeLegLabel, routeProgress?.nextWaypoint, routeProgress?.sequencingState, selectedDiversion, selectedTrafficTarget, terrainRisk, visionMode]);
  const visionTerrainColumns = useMemo(() => {
    const samples = terrainProfile?.samples ?? [];
    const ownshipAltitude = activeOwnship?.altitudeFt ?? simulationAltitudeFt;
    return buildVisionTerrainColumns({
      samples,
      ownshipAltitudeFt: ownshipAltitude,
      maxColumns: 14,
      keyPrefix: 'terrain-column',
    });
  }, [activeOwnship?.altitudeFt, simulationAltitudeFt, terrainProfile?.samples]);
  const visionObstacleCues = useMemo(() => {
    const obstacles = obstacleScan?.obstacles ?? [];
    if (!obstacles.length || !activeOwnship) return [];
    return buildVisionObstacleCues({
      ownship: {
        lat: activeOwnship.lat,
        lon: activeOwnship.lon,
        heading: activeOwnship.heading ?? 0,
        altitudeFt: activeOwnship.altitudeFt ?? simulationAltitudeFt,
      },
      obstacles,
      maxCues: 3,
    });
  }, [activeOwnship, obstacleScan?.obstacles, simulationAltitudeFt]);
  const visionTrafficCue = useMemo(() => {
    if (!selectedTrafficTarget || !activeOwnship) return null;
    const closureOverride =
      trafficTrendMap[selectedTrafficTarget.id]?.closureText ||
      undefined;
    return buildVisionTrafficCue({
      ownship: {
        lat: activeOwnship.lat,
        lon: activeOwnship.lon,
        heading: activeOwnship.heading ?? 0,
        altitudeFt: activeOwnship.altitudeFt ?? simulationAltitudeFt,
      },
      target: {
        id: selectedTrafficTarget.id,
        lat: selectedTrafficTarget.lat,
        lon: selectedTrafficTarget.lon,
        altitudeDeltaFt: selectedTrafficTarget.altitudeDeltaFt,
        distanceNm: selectedTrafficTarget.distanceNm,
        threatLevel: selectedTrafficTarget.threatLevel,
      },
      bearingRateDegPerMin: trafficTrendMap[selectedTrafficTarget.id]?.bearingRateDegPerMin ?? 0,
      distanceRateNmPerMin: trafficTrendMap[selectedTrafficTarget.id]?.distanceRateNmPerMin,
      closureText: closureOverride,
    });
  }, [activeOwnship, selectedTrafficTarget, trafficTrendMap]);
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
        : flightDeckTargetAltitudeFt ?? flightDeckVerticalPathSummary.targetAltitudeFt ?? simulationAltitudeFt;
    const altitudeErrorFt =
      terrainRisk === 'warning' || obstacleRisk === 'warning'
        ? targetAltitude - currentAltitude
        : flightDeckTargetAltitudeFt != null
          ? flightDeckTargetAltitudeFt - currentAltitude
          : flightDeckVerticalPathSummary.verticalErrorFt ?? targetAltitude - currentAltitude;
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
        : headingDelta > 0 ? `Turn right ${Math.round(Math.abs(headingDelta))}Â°`
        : `Turn left ${Math.round(Math.abs(headingDelta))}Â°`,
      verticalCommand:
        terrainRisk === 'warning' || obstacleRisk === 'warning'
          ? Math.abs(altitudeErrorFt) < 150 ? 'Hold altitude'
          : altitudeErrorFt > 0 ? `Climb to ${Math.round(targetAltitude)} ft`
          : `Descend to ${Math.round(targetAltitude)} ft`
          : flightDeckTargetAltitudeFt == null
            ? flightDeckVerticalPathSummary.advisoryCall
            : Math.abs(altitudeErrorFt) < 150 ? 'Hold altitude'
            : altitudeErrorFt > 0 ? `Climb to ${Math.round(targetAltitude)} ft`
            : `Descend to ${Math.round(targetAltitude)} ft`,
    };
  }, [activeOwnship?.altitudeFt, flightDeckTargetAltitudeFt, flightDeckVerticalPathSummary.advisoryCall, flightDeckVerticalPathSummary.targetAltitudeFt, flightDeckVerticalPathSummary.verticalErrorFt, obstacleRisk, simulationAltitudeFt, terrainEscapeTargetFt, terrainRisk, trafficConflictGuidance, visionRouteGuidance?.headingDelta, visionRouteGuidance?.lateralCaptured]);
  const mapTacticalSummary = useMemo(() => {
    const modeLabel =
      directToRouteActive
        ? 'Direct'
        : activeProcedureCueStackPreview.modeLabel === 'Departure'
          ? 'Departure'
          : activeProcedureCueStackPreview.modeLabel === 'Arrival'
            ? 'Arrival'
            : activeProcedureCueStackPreview.modeLabel === 'Final'
              ? 'Final'
              : activeLegBehavior.guidanceMode === 'departure'
          ? 'Departure'
          : activeLegBehavior.guidanceMode === 'terminal'
            ? 'Terminal'
            : visionDirectorCue.mode === 'traffic'
        ? 'Traffic'
        : visionDirectorCue.mode === 'escape'
        ? 'Escape'
        : visionDirectorCue.mode === 'intercept'
          ? 'Intercept'
          : visionDirectorCue.mode === 'capture'
            ? 'Capture'
            : 'Track';
    const focusLabel =
      flightDeckPhaseSummary.stage === 'taxi-out' || flightDeckPhaseSummary.stage === 'taxi-in'
        ? 'Ground corridor'
        : flightDeckPhaseSummary.stage === 'departure'
          ? 'Departure corridor'
          : flightDeckPhaseSummary.stage === 'climb'
            ? 'Climb scan'
            : flightDeckPhaseSummary.stage === 'cruise'
              ? 'Enroute scan'
              : flightDeckPhaseSummary.stage === 'descent'
                ? 'Arrival setup'
                : flightDeckPhaseSummary.stage === 'arrival'
                  ? 'Terminal corridor'
                  : flightDeckPhaseSummary.stage === 'final'
                    ? 'Final map'
                    : 'Route scan';
    const support =
      selectedTrafficTarget?.threatLevel === 'immediate'
        ? `Traffic priority ${selectedTrafficTarget.callsign || 'target'} ${selectedTrafficTarget.distanceNm.toFixed(1)} NM`
        : selectedDiversion
          ? `Diversion staged ${selectedDiversion.icao} ${selectedDiversion.distanceNm.toFixed(1)} NM`
          : routeProgress
            ? `${routeProgress.remainingLegNm.toFixed(1)} NM leg / ${routeProgress.remainingRouteNm.toFixed(1)} NM route`
            : flightDeckPhaseSummary.detail;
    return {
      modeLabel: activeExecutionSegmentPreview.label || modeLabel,
      heading: visionDirectorCue.turnCommand,
      vertical: visionDirectorCue.verticalCommand,
      verticalSupport: flightDeckVerticalPathSummary.support,
      verticalConstraintCall: routeExecutionSummary.verticalConstraintCall,
      recommendation:
        selectedTrafficTarget?.threatLevel === 'immediate' || selectedDiversion
          ? activeProcedureCueStackPreview.sequencingSummary || visionManeuverRecommendation
          : flightDeckVerticalPathSummary.recommendation || activeProcedureCueStackPreview.sequencingSummary || visionManeuverRecommendation,
      focusLabel,
      rangeLabel: tacticalMapRangeLabel,
      support,
    };
  }, [
    activeExecutionSegmentPreview.label,
    activeLegBehavior.guidanceMode,
    activeProcedureCueStackPreview.modeLabel,
    activeProcedureCueStackPreview.sequencingSummary,
    flightDeckVerticalPathSummary.support,
    flightDeckVerticalPathSummary.recommendation,
    flightDeckPhaseSummary.detail,
    flightDeckPhaseSummary.stage,
    routeExecutionSummary.verticalConstraintCall,
    routeExecutionOverride?.mode,
    routeProgress,
    selectedDiversion,
    selectedTrafficTarget,
    tacticalMapRangeLabel,
    visionDirectorCue.mode,
    visionDirectorCue.turnCommand,
    visionDirectorCue.verticalCommand,
    visionManeuverRecommendation,
  ]);
  const activeExecutionPlanView = useMemo(
    () =>
      annotateMobileRouteExecutionPlan(activeExecutionPlan, {
        activeLegIndex: routeProgress?.legIndex ?? -1,
        nextLegArmed: routeExecutionSummary.nextLegArmed,
        sequencingSuspended: routeExecutionSummary.sequencingSuspended,
        sequenceGateState: routeExecutionSummary.sequenceGateState as 'open' | 'armed' | 'blocked' | 'hold' | 'manual-open' | undefined,
        procedureChains: activeProcedureChains,
      }),
    [
      activeExecutionPlan,
      activeProcedureChains,
      routeExecutionSummary.nextLegArmed,
      routeExecutionSummary.sequenceGateState,
      routeExecutionSummary.sequencingSuspended,
      routeProgress?.legIndex,
    ]
  );
  const plannerExecutionPlanView = useMemo(
    () =>
      annotateMobileRouteExecutionPlan(plannerExecutionPlan, {
        activeLegIndex:
          routeProgress && !directToRouteActive
            ? routeProgress.legIndex
            : -1,
        nextLegArmed:
          routeProgress && !directToRouteActive
            ? routeExecutionSummary.nextLegArmed
            : false,
        sequencingSuspended:
          routeProgress && !directToRouteActive
            ? routeExecutionSummary.sequencingSuspended
            : false,
        sequenceGateState:
          routeProgress && !directToRouteActive
            ? (routeExecutionSummary.sequenceGateState as 'open' | 'armed' | 'blocked' | 'hold' | 'manual-open' | undefined)
            : 'blocked',
        procedureChains: plannerProcedureChains,
      }),
    [
      plannerExecutionPlan,
      plannerProcedureChains,
      routeExecutionOverride?.mode,
      routeExecutionSummary.nextLegArmed,
      routeExecutionSummary.sequenceGateState,
      routeExecutionSummary.sequencingSuspended,
      routeProgress,
    ]
  );
  const visionVerticalCueLabel = useMemo(() => {
    if (flightDeckTargetAltitudeFt == null && flightDeckVerticalPathSummary.cueLabel) return flightDeckVerticalPathSummary.cueLabel;
    if (visionDirectorCue.verticalCommand.startsWith('Climb')) return 'CLB';
    if (visionDirectorCue.verticalCommand.startsWith('Descend')) return 'DES';
    return 'ALT';
  }, [flightDeckTargetAltitudeFt, flightDeckVerticalPathSummary.cueLabel, visionDirectorCue.verticalCommand]);
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
    setFlightDeckView((current) => {
      const next = current === 'vision' ? 'split' : 'vision';
      logDiagnostic('flightDeck', 'view_changed', {
        view: next,
        visionMode,
        ownshipAvailable: Boolean(activeOwnship),
        pilotGradeAttitude: Boolean(attitudeSourceSummary.pilotGrade),
      });
      return next;
    });
  };
  const setFlightDeckViewMode = (next: FlightDeckView) => {
    pulseFlightDeckChrome(next === 'split');
    setFlightDeckView((current) => {
      if (current === next) return current;
      logDiagnostic('flightDeck', 'view_changed', {
        view: next,
        visionMode,
        ownshipAvailable: Boolean(activeOwnship),
        pilotGradeAttitude: Boolean(attitudeSourceSummary.pilotGrade),
      });
      return next;
    });
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
  useEffect(() => {
    if (!isFlightDeck) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      return;
    }

    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
      .then(() => {
        logDiagnostic('flightDeck', 'orientation_lock', {
          lock: 'landscape',
        });
      })
      .catch((error) => {
        warnDiagnostic('flightDeck', 'orientation_lock_failed', {
          message: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [isFlightDeck]);

  useEffect(() => {
    logDiagnostic('maps', 'map_style_changed', {
      style: mapStyle,
      isFlightDeck,
      sectionalSource: mapStyle === 'sectional' ? 'direct_faa_wms' : undefined,
    });
  }, [isFlightDeck, mapStyle]);

  useEffect(() => {
    logDiagnostic('flightDeck', 'vision_mode_changed', {
      mode: visionMode,
      routeAvailable: routePoints.length > 1,
      ownshipAvailable: Boolean(activeOwnship),
    });
  }, [activeOwnship, routePoints.length, visionMode]);

  useEffect(() => {
    if (!isFlightDeck || flightDeckView !== 'map' || !tacticalMapRegion) return;

    const signature = [
      flightDeckPhaseSummary.stage,
      routeProgress?.legIndex ?? -1,
      selectedTrafficTarget?.id || 'none',
      selectedDiversion?.icao || 'none',
    ].join(':');

    const stageChanged = flightDeckMapFocusSignatureRef.current !== signature;
    const ownshipOutsideWindow =
      !!activeOwnship &&
      !!mapRegion &&
      (Math.abs(activeOwnship.lat - mapRegion.latitude) > mapRegion.latitudeDelta * 0.28 ||
        Math.abs(activeOwnship.lon - mapRegion.longitude) > mapRegion.longitudeDelta * 0.28);

    if (!stageChanged && !ownshipOutsideWindow) return;

    flightDeckMapFocusSignatureRef.current = signature;
    if (activeOwnship?.heading != null) {
      flightDeckMapHeadingRef.current = activeOwnship.heading;
      mapRef.current?.animateCamera(
        {
          center: {
            latitude: tacticalMapRegion.latitude,
            longitude: tacticalMapRegion.longitude,
          },
          heading: activeOwnship.heading,
          pitch: 0,
        },
        { duration: 450 },
      );
      return;
    }
    mapRef.current?.animateToRegion(tacticalMapRegion, 450);
  }, [
    activeOwnship,
    flightDeckPhaseSummary.stage,
    flightDeckView,
    isFlightDeck,
    mapRegion,
    routeProgress?.legIndex,
    selectedDiversion?.icao,
    selectedTrafficTarget?.id,
    tacticalMapRegion,
  ]);
  useEffect(() => {
    if (!isFlightDeck || flightDeckView !== 'map' || activeOwnship?.heading == null) return;
    const previousHeading = flightDeckMapHeadingRef.current;
    if (previousHeading != null && Math.abs(normalizeHeadingDelta(activeOwnship.heading - previousHeading)) < 8) {
      return;
    }
    flightDeckMapHeadingRef.current = activeOwnship.heading;
    mapRef.current?.animateCamera(
      {
        heading: activeOwnship.heading,
        pitch: 0,
      },
      { duration: 260 },
    );
  }, [activeOwnship?.heading, flightDeckView, isFlightDeck]);
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
  const buildDirectToOrigin = (fallbackLat: number, fallbackLon: number): AirportMeta =>
    activeOwnship
      ? {
          icao: 'DCT',
          name: 'Direct-To',
          latitude: activeOwnship.lat,
          longitude: activeOwnship.lon,
        }
      : routePoints[Math.min(activeLegIndex, Math.max(0, routePoints.length - 1))] || routePoints[0] || {
          icao: departure.trim().toUpperCase() || 'ORIG',
          name: 'Origin',
          latitude: fallbackLat,
          longitude: fallbackLon,
        };
  const engageDirectToDiversion = (airport: NearbyDiversionAirport) => {
    setSelectedDiversionIcao(airport.icao);
    openFlightDeckPanel('status');
    setFlightDeckView('map');
    if (typeof airport.lat === 'number' && typeof airport.lon === 'number') {
      setRouteExecutionOverride({
        mode: 'direct-to-diversion',
        origin: buildDirectToOrigin(airport.lat, airport.lon),
        target: {
          icao: airport.icao,
          name: airport.name || airport.icao,
          latitude: airport.lat,
          longitude: airport.lon,
        },
        activatedAt: Date.now(),
      });
      setActiveLegIndex(0);
      setSequencingSuspended(false);
    }
    if (simulationEnabled) {
      setSimulationRunning(false);
      setSimulatedVerticalSpeedFpm(-350);
    }
    focusDiversionAirport(airport);
  };
  const engageDirectToRouteWaypoint = (targetIndex: number) => {
    const waypoint = routePoints[targetIndex];
    if (!waypoint) return;
    setRouteExecutionOverride({
      mode: 'direct-to-route',
      origin: buildDirectToOrigin(waypoint.latitude, waypoint.longitude),
      target: {
        icao: waypoint.icao,
        name: waypoint.name || waypoint.icao,
        latitude: waypoint.latitude,
        longitude: waypoint.longitude,
      },
      activatedAt: Date.now(),
      targetLegIndex: Math.max(0, targetIndex - 1),
    });
    setActiveLegIndex(0);
    setSequencingSuspended(false);
    openFlightDeckPanel('status');
    setFlightDeckView('map');
    focusMapOnPoint(waypoint.latitude, waypoint.longitude, { latitudeDelta: 0.34, longitudeDelta: 0.34 });
  };
  const activatePlannedLeg = (legIndex: number) => {
    const boundedLegIndex = Math.min(Math.max(0, legIndex), Math.max(0, routePoints.length - 2));
    const focusPoint = routePoints[boundedLegIndex + 1] || routePoints[boundedLegIndex] || null;
    setRouteExecutionOverride(null);
    setActiveLegIndex(boundedLegIndex);
    setSequencingSuspended(true);
    openFlightDeckPanel('status');
    setFlightDeckView('map');
    if (focusPoint) {
      focusMapOnPoint(focusPoint.latitude, focusPoint.longitude, { latitudeDelta: 0.3, longitudeDelta: 0.3 });
    }
  };
  const resumePlannedRoute = () => {
    setRouteExecutionOverride(null);
    setActiveLegIndex(Math.min(plannedRouteRejoinProgress?.legIndex ?? 0, Math.max(0, routePoints.length - 2)));
    setSequencingSuspended(false);
    openFlightDeckPanel('status');
    setFlightDeckView('map');
  };
  const toggleSequencingSuspend = () => {
    setSequencingSuspended((prev) => !prev);
    openFlightDeckPanel('status');
  };
  const sequencePreviousLeg = () => {
    setActiveLegIndex((prev) => Math.max(0, prev - 1));
    setSequencingSuspended(true);
    openFlightDeckPanel('status');
  };
  const sequenceNextLeg = () => {
    setActiveLegIndex((prev) => Math.min(Math.max(0, activeRoutePoints.length - 2), prev + 1));
    setSequencingSuspended(routeExecutionSummary?.nextAction === 'pilot-advance' ? false : true);
    openFlightDeckPanel('status');
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
      setFlightDeckView('split');
      setFlightDeckDrawerOpen(false);
      setFlightDeckHudExpanded(false);
      setFlightDeckChromeVisible(true);
      setFlightDeckTargetAltitudeFt(null);
      setTrafficResolutionBias(null);
      return;
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

  const flightDeckInstrumentRouteVisible = Boolean(routeProgress?.nextWaypoint && activeOwnship);
  const flightDeckLowerStackBottom = Math.max(
    insets.bottom + (flightDeckHudExpanded ? (flightDeckInstrumentRouteVisible ? 258 : 222) : (flightDeckInstrumentRouteVisible ? 146 : 118)),
    flightDeckHudExpanded ? (flightDeckInstrumentRouteVisible ? 270 : 234) : (flightDeckInstrumentRouteVisible ? 158 : 130),
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
              key: 'vnav',
              label: 'VNAV',
              value:
                flightDeckVerticalConstraintSummary.targetAltitudeFt != null
                  ? `${Math.round(flightDeckVerticalConstraintSummary.targetAltitudeFt)} ft`
                  : flightDeckVerticalPathSummary.distanceToTodNm != null && flightDeckVerticalPathSummary.distanceToTodNm > 0
                  ? `TOD ${flightDeckVerticalPathSummary.distanceToTodNm.toFixed(1)} NM`
                  : flightDeckVerticalPathSummary.targetAltitudeFt != null
                    ? `${Math.round(flightDeckVerticalPathSummary.targetAltitudeFt)} ft`
                    : flightDeckVerticalPathSummary.modeLabel,
              tone:
                flightDeckVerticalConstraintSummary.targetAltitudeFt != null ||
                flightDeckVerticalPathSummary.guidanceMode === 'descent' ||
                flightDeckVerticalPathSummary.guidanceMode === 'path'
                  ? 'caution'
                  : 'default',
              active:
                (flightDeckVerticalConstraintSummary.targetAltitudeFt != null &&
                  flightDeckTargetAltitudeFt === flightDeckVerticalConstraintSummary.targetAltitudeFt) ||
                (flightDeckVerticalConstraintSummary.targetAltitudeFt == null &&
                  flightDeckVerticalPathSummary.targetAltitudeFt != null &&
                  flightDeckTargetAltitudeFt === flightDeckVerticalPathSummary.targetAltitudeFt),
              onPress: () => {
                pulseFlightDeckChrome(true);
                const nextTargetAltitudeFt =
                  flightDeckVerticalConstraintSummary.targetAltitudeFt ?? flightDeckVerticalPathSummary.targetAltitudeFt;
                if (nextTargetAltitudeFt != null) {
                  setFlightDeckTargetAltitudeFt((current) =>
                    current === nextTargetAltitudeFt ? null : nextTargetAltitudeFt
                  );
                } else {
                  openFlightDeckPanel('status');
                }
                setFlightDeckHudExpanded(true);
              },
            },
            {
              key: 'vision',
              label: flightDeckView === 'vision' ? 'Split' : attitudeSourceSummary.pilotGrade ? 'Vision' : 'Vision assist',
              value: flightDeckView === 'vision'
                ? 'Dual pane'
                : attitudeSourceSummary.pilotGrade
                  ? 'Synthetic view'
                  : 'Guidance only',
              tone: attitudeSourceSummary.pilotGrade ? 'accent' : 'caution',
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

  // Snap to ~0.24 NM grid (~0.004 deg lat/lon) to avoid re-running the
  // diversion fetch on every GPS tick when the aircraft is nearly stationary.
  const diversionSnapLat = activeOwnship?.lat != null ? Math.round(activeOwnship.lat / 0.004) * 0.004 : null;
  const diversionSnapLon = activeOwnship?.lon != null ? Math.round(activeOwnship.lon / 0.004) * 0.004 : null;

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
  }, [diversionSnapLat, diversionSnapLon]);

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
    setSimulatedGpsData(initial?.ownship ? { ...initial.ownship, updatedAt: Date.now(), source: 'simulation' } : null);
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
        setSimulatedGpsData(frame?.ownship ? { ...frame.ownship, updatedAt: Date.now(), source: 'simulation' } : null);
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
    const departureIcao = departure.trim().toUpperCase();
    if (!ICAO_REGEX.test(departureIcao)) {
      setDepartureBriefing(null);
      setDepartureBriefingLoading(false);
      return;
    }
    setDepartureBriefingLoading(true);
    api
      .get<RunwayBriefingResponse>(`/api/airports/${departureIcao}/runway-briefing`)
      .then((res) => {
        if (cancelled) return;
        setDepartureBriefing(res.data || null);
        setDepartureBriefingLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDepartureBriefing(null);
        setDepartureBriefingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [departure]);

  useEffect(() => {
    let cancelled = false;
    const departureIcao = departure.trim().toUpperCase();
    if (!ICAO_REGEX.test(departureIcao)) {
      setDepartureSurfaceGeometry(null);
      setDepartureSurfaceGeometryLoading(false);
      return;
    }
    setDepartureSurfaceGeometryLoading(true);
    api
      .get<AirportSurfaceGeometryResponse>(`/api/airports/${departureIcao}/surface-geometry`)
      .then((res) => {
        if (cancelled) return;
        setDepartureSurfaceGeometry(res.data || null);
        setDepartureSurfaceGeometryLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDepartureSurfaceGeometry(null);
        setDepartureSurfaceGeometryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [departure]);

  useEffect(() => {
    let cancelled = false;
    const departureIcao = departure.trim().toUpperCase();
    if (!ICAO_REGEX.test(departureIcao)) {
      setDepartureFrequencies(null);
      setDepartureFrequenciesLoading(false);
      return;
    }
    setDepartureFrequenciesLoading(true);
    api
      .get<AirportFrequencyResponse>(`/api/airports/${departureIcao}/frequencies`)
      .then((res) => {
        if (cancelled) return;
        setDepartureFrequencies(res.data || null);
        setDepartureFrequenciesLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDepartureFrequencies(null);
        setDepartureFrequenciesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [departure]);

  useEffect(() => {
    let cancelled = false;
    const destinationIcao = destination.trim().toUpperCase();
    if (!ICAO_REGEX.test(destinationIcao)) {
      setDestinationBriefing(null);
      setDestinationBriefingLoading(false);
      return;
    }
    setDestinationBriefingLoading(true);
    api
      .get<RunwayBriefingResponse>(`/api/airports/${destinationIcao}/runway-briefing`)
      .then((res) => {
        if (cancelled) return;
        setDestinationBriefing(res.data || null);
        setDestinationBriefingLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDestinationBriefing(null);
        setDestinationBriefingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [destination]);

  useEffect(() => {
    let cancelled = false;
    const destinationIcao = destination.trim().toUpperCase();
    if (!ICAO_REGEX.test(destinationIcao)) {
      setDestinationSurfaceGeometry(null);
      setDestinationSurfaceGeometryLoading(false);
      return;
    }
    setDestinationSurfaceGeometryLoading(true);
    api
      .get<AirportSurfaceGeometryResponse>(`/api/airports/${destinationIcao}/surface-geometry`)
      .then((res) => {
        if (cancelled) return;
        setDestinationSurfaceGeometry(res.data || null);
        setDestinationSurfaceGeometryLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDestinationSurfaceGeometry(null);
        setDestinationSurfaceGeometryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [destination]);

  useEffect(() => {
    let cancelled = false;
    const destinationIcao = destination.trim().toUpperCase();
    if (!ICAO_REGEX.test(destinationIcao)) {
      setDestinationFrequencies(null);
      setDestinationFrequenciesLoading(false);
      return;
    }
    setDestinationFrequenciesLoading(true);
    api
      .get<AirportFrequencyResponse>(`/api/airports/${destinationIcao}/frequencies`)
      .then((res) => {
        if (cancelled) return;
        setDestinationFrequencies(res.data || null);
        setDestinationFrequenciesLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDestinationFrequencies(null);
        setDestinationFrequenciesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [destination]);

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

  // Snap to ~0.12 NM grid (~0.002 deg lat/lon) to avoid re-running the
  // obstacle scan on every GPS tick when the aircraft is nearly stationary.
  const obstacleSnapLat = activeOwnship?.lat != null ? Math.round(activeOwnship.lat / 0.002) * 0.002 : null;
  const obstacleSnapLon = activeOwnship?.lon != null ? Math.round(activeOwnship.lon / 0.002) * 0.002 : null;

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
  }, [obstacleSnapLat, obstacleSnapLon]);

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
            updatedAt: Date.now(),
            source: 'device',
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
    if (!isFlightDeck || simulationEnabled) {
      return;
    }
    logDiagnostic('flightDeck', 'device_motion_disabled', {
      reason: 'external_attitude_required',
      simulationEnabled,
    });
  }, [isFlightDeck, simulationEnabled]);

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

  useEffect(() => {
    const dep = departure.trim().toUpperCase();
    const dest = destination.trim().toUpperCase();
    if (!ICAO_REGEX.test(dep) || !ICAO_REGEX.test(dest)) {
      setProviderRouteSearch(null);
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      api.get<RouteSearchResponse>('/api/flight-plans/route-search', {
        params: {
          departure: dep,
          destination: dest,
          altitudeFt: plannedAltitudeValue,
        },
      })
        .then((res) => {
          if (!active) return;
          setProviderRouteSearch(res.data || null);
        })
        .catch(() => {
          if (!active) return;
          setProviderRouteSearch(null);
        });
    }, 450);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [departure, destination, plannedAltitudeValue]);

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
  const flightDeckRouteHeadline = useMemo(() => {
    if (directToRouteActive) {
      return `Direct ${routeExecutionOverride.target.icao}`;
    }
    return routeHeadline;
  }, [directToRouteActive, routeExecutionOverride, routeHeadline]);

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
      const legs = buildMobileRouteLegs(routedAirports);
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
      return `Planned departure is about ${Math.round(days)} days out. TAFs cover ~24â€“30 hours; recheck the night before and day-of.`;
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
    const coordsSource = isFlightDeck ? activeRoutePoints : routePoints;
    if (!mapRef.current || coordsSource.length < 2) return;
    const coords = coordsSource.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 60, bottom: 60, left: 60, right: 60 },
      animated: true,
    });
  }, [activeRoutePoints, isFlightDeck, routePoints]);

  useEffect(() => {
    if (!isFlightDeck || mapStyle !== 'standard') return;
    setMapStyle('sectional');
  }, [isFlightDeck, mapStyle]);

  useEffect(() => {
    if (!isFlightDeck || flightDeckView !== 'map' || !activeOwnship || !mapRef.current) return;
    const speedKts = activeOwnship.speedKts ?? simulationCruiseKts;
    const heading = typeof activeOwnship.heading === 'number' && speedKts >= 25 ? activeOwnship.heading : 0;
    const zoom = speedKts >= 170 ? 10.8 : speedKts >= 125 ? 11.4 : speedKts >= 85 ? 12.1 : 12.9;
    mapRef.current.animateCamera(
      {
        center: {
          latitude: activeOwnship.lat,
          longitude: activeOwnship.lon,
        },
        heading,
        pitch: 0,
        zoom,
      },
      { duration: 450 },
    );
  }, [activeOwnship?.heading, activeOwnship?.lat, activeOwnship?.lon, activeOwnship?.speedKts, flightDeckView, isFlightDeck, simulationCruiseKts]);
  const flightDeckSurfacePreview = useMemo<FlightDeckSurfacePreview | null>(() => {
    const departureSurface = flightPhase === 'departure';
    const airport = departureSurface ? activeRoutePoints[0] : activeRoutePoints[activeRoutePoints.length - 1];
    const runway = departureSurface ? departureRunway : destinationRunway;
    const runwayOverlay = departureSurface ? departureRunwayOverlay : destinationRunwayOverlay;
    const surfaceGeometry = departureSurface ? departureSurfaceGeometry : destinationSurfaceGeometry;
    const surfaceGeometryLoading = departureSurface ? departureSurfaceGeometryLoading : destinationSurfaceGeometryLoading;
    const frequencies = departureSurface ? departureFrequencies : destinationFrequencies;
    const progressPct = routeProgress?.progressPct ?? 0;
    if (!airport || !runway || !routeProgress || (flightPhase !== 'departure' && flightPhase !== 'arrival')) return null;
    const groundFrequency = pickAirportFrequency(frequencies, ['ground', 'gnd', 'taxi']);
    const towerFrequency = pickAirportFrequency(frequencies, ['tower', 'twr']);
    const atisFrequency = pickAirportFrequency(frequencies, ['atis', 'awos', 'asos']);
    const taxiProgress = departureSurface
      ? clamp(progressPct / 8, 0, 1)
      : clamp((progressPct - 92) / 8, 0, 1);
    const route = departureSurface
      ? [
          { x: 18, y: 48 },
          { x: 28, y: 48 },
          { x: 40, y: 40 },
          { x: 50, y: 40 },
          { x: 50, y: 31 },
        ]
      : [
          { x: 50, y: 31 },
          { x: 50, y: 40 },
          { x: 40, y: 40 },
          { x: 28, y: 48 },
          { x: 18, y: 48 },
        ];
    const secondaryRoute = departureSurface
      ? [
          { x: 50, y: 22 },
          { x: 60, y: 22 },
          { x: 70, y: 14 },
          { x: 84, y: 14 },
        ]
      : [
          { x: 84, y: 14 },
          { x: 70, y: 14 },
          { x: 60, y: 22 },
          { x: 50, y: 22 },
        ];
    const nmPerUnit = runway.lengthFt ? Math.max(0.002, Math.min(0.01, runway.lengthFt / 6076 / 92)) : 0.0048;
    const baseGeoRoute = snapSurfacePoints(
      route.map((point) =>
        localSurfacePointToGeo({
          point,
          airport: { latitude: airport.latitude, longitude: airport.longitude },
          runwayHeadingDeg: runway.headingDeg,
          nmPerUnit,
        }),
      ),
      Array.isArray(surfaceGeometry?.features) ? surfaceGeometry.features : [],
    );
    const derivedTaxiRoute = deriveTaxiRouteFromSurfaceGeometry(
      baseGeoRoute,
      Array.isArray(surfaceGeometry?.features) ? surfaceGeometry.features : [],
      taxiProgress,
    );
    const fallbackGeoProgress = deriveGeoProgressAlongRoute(baseGeoRoute, taxiProgress);
    const geoRoute = derivedTaxiRoute?.route || baseGeoRoute;
    const geoCompletedRoute = derivedTaxiRoute?.completedRoute || fallbackGeoProgress.completedRoute;
    const geoUpcomingRoute = derivedTaxiRoute?.upcomingRoute || fallbackGeoProgress.upcomingRoute;
    const geoOwnship = derivedTaxiRoute?.ownship || fallbackGeoProgress.ownship;
    const holdShortActive = departureSurface && taxiProgress >= 0.72 && taxiProgress < 0.92;
    const runwayOccupied = departureSurface ? taxiProgress > 0.93 : taxiProgress < 0.18;
    const activeTaxiway = derivedTaxiRoute?.activeTaxiway || (holdShortActive ? 'Hold short' : 'Alpha');
    const upcomingTaxiways =
      derivedTaxiRoute?.upcomingTaxiways?.length
        ? derivedTaxiRoute.upcomingTaxiways
        : departureSurface
          ? ['Alpha', runway.runwayId]
          : ['Alpha', 'Ramp'];
    const geoRunwayCenterline =
      runwayOverlay?.centerline?.map((point) => ({ lat: point.latitude, lon: point.longitude })) || [];
    const geoRunwayBar =
      runwayOverlay?.runwayBar?.map((point) => ({ lat: point.latitude, lon: point.longitude })) || [];
    const progressCall = departureSurface
      ? holdShortActive
        ? `Hold short runway ${runway.runwayId}`
        : runwayOccupied
          ? `Line up runway ${runway.runwayId}`
          : `Taxi via ${activeTaxiway}`
      : runwayOccupied
        ? `Exit runway ${runway.runwayId}`
        : `Taxi in via ${activeTaxiway}`;
    const surfaceAction = deriveSurfaceNextAction({
      ownship: geoOwnship,
      upcomingRoute: geoUpcomingRoute,
      activeTaxiway,
      upcomingTaxiways,
      holdShortActive,
      runwayOccupied,
      runwayId: runway.runwayId,
    });
    const surfaceRegion = buildSurfaceRegion({
      ownship: { lat: geoOwnship.lat, lon: geoOwnship.lon },
      route: geoUpcomingRoute,
      runwayCenterline: geoRunwayCenterline,
      runwayBar: geoRunwayBar,
      mode: departureSurface ? 'departure' : 'arrival',
      holdShortActive,
      runwayOccupied,
    });
    const ownship = route.reduce<FlightDeckSurfacePreview['ownship']>(
      (current, _point, index) => {
        if (index === route.length - 1) return current;
        const start = route[index];
        const end = route[index + 1];
        const segmentStart = index / (route.length - 1);
        const segmentEnd = (index + 1) / (route.length - 1);
        if (taxiProgress < segmentStart || taxiProgress > segmentEnd) return current;
        const localT = clamp((taxiProgress - segmentStart) / Math.max(segmentEnd - segmentStart, 0.001), 0, 1);
        return {
          x: start.x + (end.x - start.x) * localT,
          y: start.y + (end.y - start.y) * localT,
          headingDeg: Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI) + 90,
        };
      },
      { x: route[0].x, y: route[0].y, headingDeg: departureSurface ? 45 : 225 },
    );
    return {
      airportIcao: airport.icao,
      runwayId: runway.runwayId,
      runwayHeadingDeg: runway.headingDeg,
      mode: departureSurface ? 'departure' : 'arrival',
      progressPct: taxiProgress,
      headline: departureSurface
        ? flightDeckPhaseSummary.stage === 'taxi-out'
          ? 'Taxi-out surface tracking to runway hold-short.'
          : 'Departure surface tracking to runway hold-short.'
        : flightDeckPhaseSummary.stage === 'taxi-in'
          ? 'Taxi-in surface guidance active after landing rollout.'
          : 'Arrival rollout transitions into taxi-in guidance.',
      support: departureSurface
        ? surfaceGeometryLoading
          ? `Loading airport surface geometry for runway ${runway.runwayId} taxi-out guidance.`
          : `Airport geometry tracks taxi-out flow, hold-short state, and runway ${runway.runwayId} entry.`
        : surfaceGeometryLoading
          ? `Loading airport surface geometry for runway ${runway.runwayId} rollout and taxi-in guidance.`
          : `Airport geometry tracks runway ${runway.runwayId} exit, occupancy state, and taxi-in from the landing surface.`,
      routeCall: departureSurface
        ? `Taxi via Alpha to runway ${runway.runwayId}. Hold short until cleared.`
        : `Exit runway ${runway.runwayId}, then taxi via Alpha to parking.`,
      clearanceLabel: departureSurface
        ? holdShortActive
          ? `Hold short runway ${runway.runwayId}. Await tower release.`
          : runwayOccupied
            ? `Entering runway ${runway.runwayId}. Confirm takeoff clearance.`
            : `Taxi clearance active via Alpha.`
        : runwayOccupied
          ? `Runway ${runway.runwayId} still occupied during rollout.`
          : `Clear of runway ${runway.runwayId}. Continue taxi-in via Alpha.`,
      holdShortActive,
      runwayOccupied,
      runwayMeta: `${runway.lengthFt ? `${runway.lengthFt.toLocaleString()} ft` : 'Length N/A'} - ${runway.surface || 'Surface N/A'}`,
      groundFreq: formatFrequency(groundFrequency?.frequencyMhz),
      towerFreq: formatFrequency(towerFrequency?.frequencyMhz),
      atisFreq: formatFrequency(atisFrequency?.frequencyMhz),
      ownship,
      route,
      secondaryRoute,
      geoOwnship,
      geoRoute,
      geoCompletedRoute,
      geoUpcomingRoute,
      geoRunwayCenterline,
      geoRunwayBar,
      surfaceFeatures: Array.isArray(surfaceGeometry?.features) ? surfaceGeometry.features : [],
      activeTaxiway,
      upcomingTaxiways,
      progressCall,
      nextActionCall: surfaceAction.nextActionCall,
      cameraModeLabel: surfaceAction.cameraModeLabel,
      nextTurnDistanceNm: surfaceAction.nextTurnDistanceNm,
      surfaceRegion,
    };
  }, [
    activeRoutePoints,
    departureFrequencies,
    departureRunway,
    departureRunwayOverlay,
    departureSurfaceGeometry,
    destinationFrequencies,
    destinationRunway,
    destinationRunwayOverlay,
    destinationSurfaceGeometry,
    destinationSurfaceGeometryLoading,
    flightDeckPhaseSummary.stage,
    flightPhase,
    routeProgress,
    departureSurfaceGeometryLoading,
  ]);
  const flightDeckRunwayOpsSummary = useMemo<FlightDeckRunwayOpsSummary | null>(() => {
    const departureSurface = flightPhase === 'departure';
    const airport = departureSurface ? activeRoutePoints[0] : activeRoutePoints[activeRoutePoints.length - 1];
    const runway = departureSurface ? departureRunway : destinationRunway;
    const briefing = departureSurface ? departureBriefing : destinationBriefing;
    const frequencies = departureSurface ? departureFrequencies : destinationFrequencies;
    if (!airport || !runway || (flightPhase !== 'departure' && flightPhase !== 'arrival')) return null;
    const groundFrequency = pickAirportFrequency(frequencies, ['ground', 'gnd', 'taxi']);
    const towerFrequency = pickAirportFrequency(frequencies, ['tower', 'twr']);
    const atisFrequency = pickAirportFrequency(frequencies, ['atis', 'awos', 'asos']);
    return {
      airportIcao: airport.icao,
      runwayId: runway.runwayId,
      runwayHeadingDeg: runway.headingDeg,
      runwayMeta: `${runway.lengthFt ? `${runway.lengthFt.toLocaleString()} ft` : 'Length N/A'} - ${runway.surface || 'Surface N/A'}`,
      phaseCall: departureSurface
        ? flightDeckPhaseSummary.stage === 'taxi-out'
          ? `Taxi-out and hold-short guidance staged for runway ${runway.runwayId}.`
          : flightDeckPhaseSummary.stage === 'climb'
            ? `Departure runway ${runway.runwayId} remains active during climb-out.`
            : `Departure runway ${runway.runwayId} staged for taxi-out and lineup.`
        : flightDeckPhaseSummary.stage === 'final'
          ? `Final runway ${runway.runwayId} staged for alignment and rollout.`
          : flightDeckPhaseSummary.stage === 'taxi-in'
            ? `Taxi-in guidance continues from runway ${runway.runwayId}.`
            : `Arrival runway ${runway.runwayId} staged for final, rollout, and taxi-in.`,
      headwindKt: briefing?.advisory?.headwind ?? null,
      crosswindKt: briefing?.advisory?.crosswind ?? null,
      groundFreq: formatFrequency(groundFrequency?.frequencyMhz),
      towerFreq: formatFrequency(towerFrequency?.frequencyMhz),
      atisFreq: formatFrequency(atisFrequency?.frequencyMhz),
      sourceLabel: briefing?.advisory || briefing?.runwayInUse ? 'briefing live' : 'runway staged',
    };
  }, [activeRoutePoints, departureBriefing, departureFrequencies, departureRunway, destinationBriefing, destinationFrequencies, destinationRunway, flightDeckPhaseSummary.stage, flightPhase]);

  useEffect(() => {
    if (!activeRoutePoints.length && !hasPrimaryIcao) return;

    const bboxSource = buildBboxFromPoints(activeRoutePoints);
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
  }, [activeRoutePoints, departure, windsAltitudeChoice, plannedAltitude]);

  const flightDeckState = {
    insets,
    navigation,
    departure,
    destination,
    waypoints,
    plannedStops,
    plannedAltitude,
    cruiseKtas,
    routeHeadline: flightDeckRouteHeadline,
    flightDeckSessionState,
    flightDeckPhaseSummary,
    visionMode,
    routeProgress,
    routeExecutionSummary,
    activeExecutionPlanView,
    flightDeckView,
    flightDeckChromeVisible,
    flightDeckDrawerOpen,
    terrainRisk,
    visionRouteGuidance,
    visionTerrainColumns,
    visionDirectorCue,
    flightDeckVerticalPathSummary,
    flightDeckVerticalConstraintSummary,
    flightDeckVerticalAlertSummary,
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
    routePoints: activeRoutePoints,
    activeOwnship,
    activeAttitude,
    ownshipSourceSummary,
    sourceArbitrationSummary,
    headingSourceSummary,
    attitudeSourceSummary,
    visionReadinessSummary,
    receiverStatusSummary,
    receiverHealth,
    receiverOwnshipAgeMs,
    receiverOwnshipFresh,
    gpsOwnshipAgeMs,
    gpsOwnshipFresh,
    showCloudsGlobal,
    gibsDate,
    cloudTileUrl,
    cloudFrameIndex,
    visibleWindsPoints,
    selectedDiversionPoint,
    selectedDiversionIcao,
    diversionCandidates,
    visibleTrafficTargets,
    mapDisplayTrafficTargets,
    mapTrafficPresentation,
    mapRouteDisplay,
    mapVerticalGuidancePresentation,
    selectedDiversion,
    selectedDiversionRunwaySummary,
    departureBriefing,
    departureBriefingLoading,
    destinationBriefing,
    destinationBriefingLoading,
    destinationRunwayCue,
    destinationRunwayOverlay,
    activeRunwayOverlay,
    activeRunwayOverlayLabel,
    departureFrequenciesLoading,
    destinationFrequenciesLoading,
    flightDeckSurfacePreview,
    flightDeckRunwayOpsSummary,
    selectedDiversionBestComm,
    selectedTrafficTrend,
    mapTacticalSummary,
    mapOverlayProfile,
    mapRunwayFocusSummary,
    tacticalMapRegion,
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
    setFlightDeckViewMode,
    toggleFlightDeckHud,
    setMapRegion,
    setSelectedDiversionIcao,
    setSelectedTrafficId,
    setFlightDeckDrawerOpen,
    setFlightDeckPanel: (panel: string) => setFlightDeckPanel(panel as FlightDeckPanel),
    setTrafficEnabled,
    setGpsEnabled,
    setSimulationEnabled,
    setSimulationSpeed,
    setSimulationConflictEnabled,
    setMapStyle,
    setTrafficFilter,
    focusDiversionAirport,
    engageDirectToDiversion,
    engageDirectToRouteWaypoint,
    activatePlannedLeg,
    resumePlannedRoute,
    toggleSequencingSuspend,
    sequencePreviousLeg,
    sequenceNextLeg,
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
            <Text style={styles.heroMetricLabel}>Ownship source</Text>
            <Text style={styles.heroMetricValue}>{ownshipSourceSummary.code}</Text>
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
            <Text style={styles.heroSecondaryActionText}>Open Flight Deck</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.heroHelperText}>
          Planner is for route building, timing, performance, weather, and validation. Flight Deck is the in-flight display once planning is complete.
        </Text>
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
          <Text style={styles.helpLinkText}>How to connect your ADSâ€‘B receiver</Text>
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
                setReceiverOwnship(null);
                setReceiverAttitude(null);
                setReceiverHealth(null);
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
                (ownship: OwnshipReport) => {
                  setReceiverOwnship({
                    lat: ownship.lat,
                    lon: ownship.lon,
                    altitudeFt: ownship.altitudeFt,
                    speedKts: ownship.speedKts,
                    heading: ownship.headingDeg,
                    updatedAt: ownship.updatedAt,
                    source: 'receiver',
                  });
                },
                (attitude: AttitudeReport) => {
                  setReceiverAttitude({
                    pitchDeg: attitude.pitchDeg,
                    rollDeg: attitude.rollDeg,
                    headingDeg: attitude.headingDeg,
                    headingReference: attitude.headingReference,
                    indicatedAirspeedKts: attitude.indicatedAirspeedKts,
                    trueAirspeedKts: attitude.trueAirspeedKts,
                    updatedAt: attitude.updatedAt,
                    source: 'receiver',
                  });
                },
                (err) => {
                  setTrafficStatus('error');
                  setTrafficError(String(err));
                },
                (health) => {
                  setReceiverHealth(health);
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
            <Text style={styles.helperText}>Uses phone GPS for altitude and speed if ADSâ€‘B not available.</Text>
          </View>
          <TouchableOpacity
            style={[styles.mapToggleButton, gpsEnabled && styles.mapToggleActive]}
            onPress={() => setGpsEnabled((prev) => !prev)}
            disabled={simulationEnabled}
          >
            <Text style={styles.mapToggleText}>{gpsEnabled ? 'On' : 'Off'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>Ownship input priority</Text>
          <Text style={styles.alertText}>
            {ownshipSourceSummary.label} ({ownshipSourceSummary.code}) - {ownshipSourceSummary.detail}
          </Text>
          <Text style={styles.helperText}>{ownshipSourceSummary.freshness}</Text>
          <Text style={styles.helperText}>Receiver: {receiverStatusSummary.code} - {receiverStatusSummary.detail}</Text>
          <Text style={styles.helperText}>Heading: {headingSourceSummary.label} ({headingSourceSummary.code})</Text>
          <Text style={styles.helperText}>Vision: {visionReadinessSummary.label} ({visionReadinessSummary.code})</Text>
          {receiverHealth?.warnings?.length ? (
            <Text style={styles.helperText}>{receiverHealth.warnings[0]}</Text>
          ) : null}
          {receiverOwnshipFresh === false ? (
            <Text style={styles.helperText}>
              Receiver ownship is stale.{gpsOwnshipFresh ? ' Device GPS is ready as fallback.' : ' No live fallback is active.'}
            </Text>
          ) : null}
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
                  {Math.round(simulationProgress * 100)}% complete Â· {simulationSpeed} playback
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
            provider={plannerMapUsesGoogleProvider ? PROVIDER_GOOGLE : undefined}
            mapType={Platform.OS === 'android' && mapStyle === 'sectional' ? 'none' : 'standard'}
            initialRegion={{
              latitude: routePoints[0].latitude,
              longitude: routePoints[0].longitude,
              latitudeDelta: 3,
              longitudeDelta: 3,
            }}
            onLayout={() => {
              setPlannerMapLayoutReady(true);
              logDiagnostic('maps', 'planner_map_layout_ready', {
                provider: plannerMapUsesGoogleProvider ? 'google' : 'default',
                keyConfigured: plannerMapKeyConfigured,
              });
            }}
            onMapReady={() => {
              setPlannerMapReady(true);
              setPlannerMapRenderTimedOut(false);
              logDiagnostic('maps', 'planner_map_ready', {
                provider: plannerMapUsesGoogleProvider ? 'google' : 'default',
                keyConfigured: plannerMapKeyConfigured,
                routePointCount: routePoints.length,
              });
            }}
            onRegionChangeComplete={(region) => setMapRegion(region)}
          >
            {mapStyle === 'sectional' && (
              <WMSTile
                urlTemplate={FAA_SECTIONAL_WMS_TEMPLATE}
                maximumZ={12}
                maximumNativeZ={12}
                minimumZ={2}
                tileSize={256}
                opacity={1}
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
                description={`${target.distanceNm.toFixed(1)} NM${target.altitudeFt ? ` â€¢ ${target.altitudeFt} ft` : ''}`}
                pinColor={target.threatLevel === 'immediate' ? '#dc2626' : target.threatLevel === 'advisory' ? '#f97316' : '#eab308'}
              />
            ))}
            {activeOwnship ? (
              <Marker
                coordinate={{ latitude: activeOwnship.lat, longitude: activeOwnship.lon }}
                anchor={{ x: 0.5, y: 0.5 }}
                title={simulationEnabled ? 'Simulated ownship' : 'Ownship'}
                description={`${activeOwnship.speedKts ? `${Math.round(activeOwnship.speedKts)} kt` : 'Speed --'}${activeOwnship.altitudeFt ? ` Â· ${Math.round(activeOwnship.altitudeFt)} ft` : ''}`}
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
          <View style={{ flex: 1, backgroundColor: '#0A0E14', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#7A9BB8', fontSize: 13, fontFamily: 'monospace' }}>
              Enter departure airport to load map
            </Text>
          </View>
        )}
        {mapStyle === 'sectional' && (
          <Text style={styles.helperText}>
            FAA sectional charts now render across the route view; chart detail sharpens as you zoom in (US-only).
          </Text>
        )}
        <Text style={styles.helperText}>Sectional tiles provided by FAA/Aeronautical Information Services.</Text>
        {showPlannerMapDiagnostics && (
          <View style={styles.mapDiagnosticCard}>
            <Text style={styles.mapDiagnosticTitle}>Map diagnostics</Text>
            <Text style={styles.mapDiagnosticText}>
              Provider: {plannerMapUsesGoogleProvider ? 'Google' : 'Default'} | Build key: {plannerMapKeyConfigured ? 'present' : 'missing'}
            </Text>
            <Text style={styles.mapDiagnosticText}>
              Layout: {plannerMapLayoutReady ? 'ready' : 'pending'} | Engine: {plannerMapReady ? 'ready' : plannerMapRenderTimedOut ? 'timeout' : 'pending'}
            </Text>
            {plannerMapUsesGoogleProvider && !plannerMapKeyConfigured ? (
              <Text style={styles.mapDiagnosticWarning}>
                Android Google Maps key is not in the mobile build config. Set `GOOGLE_MAPS_API_KEY` in the Expo/EAS build environment. Render API env vars do not reach the native app build.
              </Text>
            ) : null}
            {plannerMapRenderTimedOut ? (
              <Text style={styles.mapDiagnosticWarning}>
                If layout is ready but the map never becomes ready, check Google Maps SDK enablement, Android app restriction package `com.readysetfly.mobile`, and matching SHA-1/SHA-256 fingerprints.
              </Text>
            ) : null}
          </View>
        )}
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
              <Text style={styles.instrumentValue}>{activeOwnship?.heading ? `${activeOwnship.heading.toFixed(0)}Â°` : '-'}</Text>
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
                    {typeof target.altitudeFt === 'number' ? ` â€¢ ${Math.round(target.altitudeFt)} ft` : ''}
                    {typeof target.altitudeDeltaFt === 'number'
                      ? ` â€¢ ${target.altitudeDeltaFt >= 0 ? '+' : '-'}${Math.round(target.altitudeDeltaFt)} ft`
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
                        {airport.icao}{airport.name ? ` Â· ${airport.name}` : ''}
                      </Text>
                      <Text style={styles.diversionMeta}>
                        {airport.distanceNm.toFixed(1)} NM Â· {Math.round(airport.bearingDeg)}Â°
                        {airport.maxRunwayFt ? ` Â· ${airport.maxRunwayFt.toLocaleString()} ft` : ''}
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
                        Runway {selectedDiversionBriefing.advisory.runway || '--'} Â·
                        HW {selectedDiversionBriefing.advisory.headwind ?? '--'} kt Â·
                        XW {selectedDiversionBriefing.advisory.crosswind ?? '--'} kt
                        {selectedDiversionBriefing.runwayInUse ? ` Â· In use ${selectedDiversionBriefing.runwayInUse}` : ''}
                      </Text>
                    ) : selectedDiversionBriefing?.runwayInUse ? (
                      <Text style={styles.helperText}>Runway in use {selectedDiversionBriefing.runwayInUse}</Text>
                    ) : null
                  ) : null}
                  {airport.scoreReasons?.length ? (
                    <Text style={styles.helperText}>{airport.scoreReasons.slice(0, 2).join(' Â· ')}</Text>
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
                  setAircraftQuery('');
                  setAircraftResults([]);
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
                    setAircraftQuery('');
                    setAircraftResults([]);
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
        <FormDateTimeField
          label="Planned Departure"
          value={plannedDepartureAt}
          onChangeText={setPlannedDepartureAt}
          placeholder="Select departure date and time"
          mode="datetime"
          style={styles.fieldBlock}
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
        <FormDateTimeField
          label="Planned Arrival"
          value={plannedArrivalAt}
          onChangeText={(value) => {
            setPlannedArrivalAt(value);
            setArrivalAuto(false);
          }}
          placeholder="Select arrival date and time"
          mode="datetime"
          style={styles.fieldBlock}
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
          {routeSummary.legs.map((leg, index) => {
            const planEntry = plannerExecutionPlanView[index];
            const isActive = planEntry?.status === 'active' || planEntry?.status === 'managed-open';
            const isCompleted = planEntry?.status === 'completed';
            const isArmed = planEntry?.status === 'armed';
            const isLiveLeg = isActive && routeProgress?.legIndex === index;
            const procedureChain =
              plannerProcedureChains.find(
                (chain) => index >= chain.startLegIndex && index <= chain.endLegIndex,
              ) || null;
            const chainLabel =
              procedureChain && procedureChain.label && procedureChain.label !== 'Enroute structure'
                ? procedureChain.label
                : null;
            return (
              <View
                key={`${leg.from}-${leg.to}`}
                style={[
                  styles.legRow,
                  isActive ? styles.legRowActive : null,
                  isCompleted ? styles.legRowCompleted : null,
                ]}
              >
                <View style={styles.legMeta}>
                  <View style={styles.legHeaderRow}>
                    <Text
                      style={[
                        styles.legText,
                        isActive ? styles.legTextActive : null,
                        isCompleted ? styles.legTextCompleted : null,
                      ]}
                    >
                      {leg.from} → {leg.to}
                    </Text>
                    <View
                      style={[
                        styles.legBadge,
                        isActive
                          ? styles.legBadgeActive
                          : isArmed
                            ? styles.legBadgeArmed
                            : isCompleted
                              ? styles.legBadgeCompleted
                              : styles.legBadgeQueued,
                      ]}
                    >
                      <Text
                        style={[
                          styles.legBadgeText,
                          isActive
                            ? styles.legBadgeTextActive
                            : isArmed
                              ? styles.legBadgeTextArmed
                              : styles.legBadgeTextDefault,
                        ]}
                      >
                        {isActive ? 'ACTIVE' : isArmed ? 'ARMED' : isCompleted ? 'DONE' : 'QUEUED'}
                      </Text>
                    </View>
                  </View>
                  {isLiveLeg && routeProgress ? (
                    <Text style={styles.legSubtext}>
                      {routeProgress.remainingLegNm.toFixed(1)} NM remaining
                      {planEntry?.actionCue ? ` · ${planEntry.actionCue}` : ''}
                    </Text>
                  ) : planEntry?.actionCue ? (
                    <Text style={styles.legSubtext}>{planEntry.actionCue} · {leg.legType}</Text>
                  ) : (
                    <Text style={styles.legSubtext}>{leg.legType} leg</Text>
                  )}
                  {chainLabel ? (
                    <Text style={styles.legSubtext}>{chainLabel}</Text>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.legText,
                    isActive ? styles.legTextActive : null,
                    isCompleted ? styles.legTextCompleted : null,
                  ]}
                >
                  {leg.nm.toFixed(1)} NM
                </Text>
              </View>
            );
          })}
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
  flightDeckHeaderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  flightDeckHeaderMetaChip: {
    minHeight: 24,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.flightSurfaceElevated,
    borderWidth: 1,
    borderColor: colors.flightBorder,
  },
  flightDeckHeaderMetaChipActive: {
    backgroundColor: 'rgba(74,159,212,0.16)',
    borderColor: 'rgba(74,159,212,0.46)',
  },
  flightDeckHeaderMetaChipAccent: {
    backgroundColor: 'rgba(200,146,42,0.14)',
    borderColor: 'rgba(200,146,42,0.42)',
  },
  flightDeckHeaderMetaChipWarning: {
    backgroundColor: 'rgba(232,69,60,0.14)',
    borderColor: 'rgba(232,69,60,0.42)',
  },
  flightDeckHeaderMetaChipText: {
    color: colors.flightText,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  flightDeckHeaderMetaChipTextActive: {
    color: colors.flightAccent,
  },
  flightDeckHeaderMetaChipTextAccent: {
    color: colors.flightCaution,
  },
  flightDeckHeaderMetaChipTextWarning: {
    color: colors.flightWarning,
  },
  flightDeckHeaderMetaText: {
    flex: 1,
    color: colors.flightTextMuted,
    fontSize: 11,
    lineHeight: 15,
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
  flightDeckNavDock: {
    position: 'absolute',
    zIndex: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  flightDeckNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(9,13,19,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(108,130,156,0.34)',
    ...shadow.flightGlass,
  },
  flightDeckNavButtonText: {
    marginLeft: 6,
    color: colors.flightText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  flightDeckMapPaneFull: {
    flex: 1,
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
  flightDeckVisionBankReference: {
    position: 'absolute',
    alignSelf: 'center',
    top: -1,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(232,237,244,0.9)',
    marginLeft: -7,
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
  flightDeckVisionBankPointerActual: {
    position: 'absolute',
    alignSelf: 'center',
    top: 2,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(232,237,244,0.9)',
    marginLeft: -7,
  },
  flightDeckVisionBankPointerCommand: {
    position: 'absolute',
    alignSelf: 'center',
    top: 16,
    width: 10,
    height: 10,
    marginLeft: -5,
    borderRadius: 999,
    backgroundColor: colors.flightAccent,
    borderWidth: 2,
    borderColor: '#07111E',
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
  flightDeckVisionRunwayCenterline: {
    position: 'absolute',
    width: 2,
    marginLeft: -1,
    borderRadius: 999,
    backgroundColor: 'rgba(232,237,244,0.84)',
  },
  flightDeckVisionRunwayBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.flightText,
    backgroundColor: 'rgba(232,237,244,0.08)',
  },
  flightDeckVisionRunwayEdge: {
    position: 'absolute',
    width: 2,
    marginLeft: -1,
    borderRadius: 999,
    backgroundColor: 'rgba(232,237,244,0.72)',
  },
  flightDeckVisionRunwayDash: {
    position: 'absolute',
    width: 8,
    height: 14,
    marginLeft: -4,
    marginTop: -7,
    borderRadius: 3,
    backgroundColor: 'rgba(232,237,244,0.84)',
  },
  flightDeckVisionRunwayThreshold: {
    position: 'absolute',
    height: 3,
    marginTop: -1.5,
    backgroundColor: colors.flightAccent,
  },
  flightDeckVisionRunwayThresholdStripe: {
    position: 'absolute',
    width: 8,
    height: 18,
    marginLeft: -4,
    marginTop: -9,
    borderRadius: 2,
    backgroundColor: 'rgba(232,237,244,0.7)',
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
  flightDeckVisionVerticalScale: {
    position: 'absolute',
    right: '16%',
    top: '31%',
    bottom: '24%',
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flightDeckVisionVerticalScaleCenter: {
    position: 'absolute',
    width: 2,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(232, 237, 244, 0.2)',
  },
  flightDeckVisionVerticalBug: {
    width: 14,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.flightAccent,
    shadowColor: colors.flightAccent,
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  flightDeckVisionVerticalBugActive: {
    backgroundColor: colors.flightAccent,
  },
  flightDeckVisionVerticalBugArmed: {
    backgroundColor: colors.flightCaution,
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
  flightDeckVisionPitchMark: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flightDeckVisionPitchMarkWing: {
    position: 'absolute',
    top: 0,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(232,237,244,0.78)',
  },
  flightDeckVisionPitchMarkWingLeft: {
    right: 22,
  },
  flightDeckVisionPitchMarkWingRight: {
    left: 22,
  },
  flightDeckVisionPitchMarkWingMajor: {
    width: 62,
  },
  flightDeckVisionPitchMarkWingMinor: {
    width: 42,
    opacity: 0.88,
  },
  flightDeckVisionPitchMarkLabel: {
    position: 'absolute',
    top: -9,
    color: colors.flightTextMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  flightDeckVisionPitchMarkLabelLeft: {
    left: -112,
  },
  flightDeckVisionPitchMarkLabelRight: {
    right: -112,
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
  flightDeckVisionApproachChip: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(10,14,20,0.82)',
    borderWidth: 1,
    borderColor: colors.flightBorder,
    maxWidth: 184,
  },
  flightDeckVisionApproachTitle: {
    color: colors.flightTextMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  flightDeckVisionApproachText: {
    color: colors.flightText,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  flightDeckVisionApproachMeta: {
    color: colors.flightCaution,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
    fontWeight: '600',
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
  flightDeckChipDisabled: {
    opacity: 0.42,
  },
  flightDeckChipText: {
    color: colors.flightTextMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  flightDeckChipTextActive: {
    color: colors.flightText,
  },
  flightDeckChipTextDisabled: {
    color: colors.flightTextMuted,
  },
  flightDeckChipWarning: {
    backgroundColor: 'rgba(232,69,60,0.14)',
    borderColor: 'rgba(232,69,60,0.52)',
  },
  flightDeckChipTextWarning: {
    color: colors.flightWarning,
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
  flightDeckApproachCard: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(10,14,20,0.92)',
    borderWidth: 1,
    borderColor: colors.flightBorder,
    maxWidth: 232,
  },
  flightDeckApproachCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  flightDeckApproachCardEyebrow: {
    color: colors.flightTextMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  flightDeckApproachCardBadge: {
    color: colors.flightAccent,
    fontSize: 11,
    fontWeight: '700',
  },
  flightDeckApproachCardTitle: {
    color: colors.flightText,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  flightDeckApproachCardText: {
    color: colors.flightTextMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  flightDeckRunwayOpsCard: {
    alignSelf: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(10,14,20,0.92)',
    borderWidth: 1,
    borderColor: colors.flightBorder,
    maxWidth: 268,
  },
  flightDeckSurfaceCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.flightSurface,
    borderWidth: 1,
    borderColor: colors.flightBorder,
  },
  flightDeckSurfaceDiagram: {
    marginTop: spacing.sm,
    borderRadius: radius.xl,
    padding: spacing.xs,
    backgroundColor: 'rgba(7,16,26,0.96)',
    borderWidth: 1,
    borderColor: colors.flightBorder,
  },
  flightDeckSurfaceMap: {
    width: '100%',
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: '#0B1119',
  },
  flightDeckSurfaceDiagramFrame: {
    position: 'relative',
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: '#0B1119',
    borderWidth: 1,
    borderColor: 'rgba(30,45,66,0.9)',
    overflow: 'hidden',
  },
  flightDeckSurfaceRunway: {
    position: 'absolute',
    left: '44%',
    top: '8%',
    width: '12%',
    height: '74%',
    borderRadius: radius.md,
    backgroundColor: '#19212C',
    borderWidth: 1,
    borderColor: 'rgba(232,237,244,0.16)',
  },
  flightDeckSurfaceRunwayCenterline: {
    position: 'absolute',
    left: '49.7%',
    top: '12%',
    width: 2,
    height: '66%',
    backgroundColor: 'rgba(232,237,244,0.72)',
  },
  flightDeckSurfaceRunwayLabelTop: {
    position: 'absolute',
    top: '16%',
    left: '58%',
    color: colors.flightCaution,
    fontSize: 12,
    fontWeight: '700',
  },
  flightDeckSurfaceRunwayLabelBottom: {
    position: 'absolute',
    bottom: '12%',
    left: '58%',
    color: colors.flightCaution,
    fontSize: 12,
    fontWeight: '700',
  },
  flightDeckSurfaceHoldShort: {
    position: 'absolute',
    left: '38%',
    top: '46%',
    width: '24%',
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.flightCaution,
  },
  flightDeckSurfaceHoldShortActive: {
    backgroundColor: colors.flightWarning,
  },
  flightDeckSurfaceRoute: {
    position: 'absolute',
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.flightAccent,
  },
  flightDeckSurfaceSecondaryRoute: {
    position: 'absolute',
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(74,159,212,0.6)',
  },
  flightDeckSurfaceOwnship: {
    position: 'absolute',
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    borderRadius: 14,
    backgroundColor: colors.flightText,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.flightBackground,
  },
  flightDeckSurfaceOwnshipMap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.flightAccent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.flightBackground,
    ...shadow.flightGlass,
  },
  flightDeckSurfaceOccupiedBadge: {
    position: 'absolute',
    top: '22%',
    left: '47%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(232,69,60,0.22)',
    borderWidth: 1,
    borderColor: colors.flightWarning,
  },
  flightDeckSurfaceOccupiedText: {
    color: colors.flightText,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  flightDeckSurfaceRampLabel: {
    position: 'absolute',
    left: '10%',
    bottom: '9%',
    color: colors.flightTextMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  flightDeckSurfaceTaxiLabelA: {
    position: 'absolute',
    left: '31%',
    top: '58%',
    color: colors.flightTextMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  flightDeckSurfaceTaxiLabelB: {
    position: 'absolute',
    left: '63%',
    top: '23%',
    color: colors.flightTextMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  flightDeckSurfaceStatusRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  flightDeckSurfaceStatusCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.flightSurfaceElevated,
    borderWidth: 1,
    borderColor: colors.flightBorder,
  },
  flightTrafficMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flightTrafficAltitudeTag: {
    position: 'absolute',
    bottom: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(10,14,20,0.88)',
    borderWidth: 1,
    borderColor: colors.flightBorder,
  },
  flightTrafficAltitudeTagText: {
    color: colors.flightText,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  flightDeckVerticalMarker: {
    minWidth: 62,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  flightDeckVerticalMarkerConstraint: {
    backgroundColor: 'rgba(17,22,30,0.92)',
    borderColor: colors.flightAccent,
  },
  flightDeckVerticalMarkerTod: {
    backgroundColor: 'rgba(10,14,20,0.92)',
    borderColor: colors.flightAdvisory,
  },
  flightDeckVerticalMarkerLabel: {
    color: colors.flightText,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  flightDeckVerticalMarkerValue: {
    color: colors.flightText,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
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
    zIndex: 14,
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
  flightDeckHudSourceChip: {
    position: 'absolute',
    top: 8,
    right: 12,
    minHeight: 22,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.flightSurfaceElevated,
    borderWidth: 1,
    borderColor: colors.flightBorder,
    zIndex: 2,
  },
  flightDeckHudSourceChipActive: {
    backgroundColor: 'rgba(74,159,212,0.16)',
    borderColor: 'rgba(74,159,212,0.46)',
  },
  flightDeckHudSourceChipAccent: {
    backgroundColor: 'rgba(200,146,42,0.14)',
    borderColor: 'rgba(200,146,42,0.42)',
  },
  flightDeckHudSourceChipWarning: {
    backgroundColor: 'rgba(232,69,60,0.14)',
    borderColor: 'rgba(232,69,60,0.42)',
  },
  flightDeckHudSourceChipText: {
    color: colors.flightText,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  flightDeckHudSourceChipTextActive: {
    color: colors.flightAccent,
  },
  flightDeckHudSourceChipTextAccent: {
    color: colors.flightCaution,
  },
  flightDeckHudSourceChipTextWarning: {
    color: colors.flightWarning,
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
  heroHelperText: {
    fontSize: 12,
    color: '#dbe4f0',
    marginTop: spacing.sm,
    lineHeight: 18,
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
  fieldBlock: { marginBottom: spacing.sm },
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
  legMeta: { flex: 1, paddingRight: 12 },
  legSubtext: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  legRowActive: {
    backgroundColor: 'rgba(79, 140, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 10,
    marginHorizontal: -10,
  },
  legRowCompleted: { opacity: 0.66 },
  legTextActive: { color: colors.text, fontWeight: '700' },
  legTextCompleted: { color: colors.textMuted },
  legHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  legBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  legBadgeActive: { backgroundColor: 'rgba(79,140,255,0.15)', borderWidth: 1, borderColor: 'rgba(79,140,255,0.4)' },
  legBadgeArmed: { backgroundColor: 'rgba(245,158,11,0.12)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)' },
  legBadgeCompleted: { backgroundColor: colors.surfaceMuted },
  legBadgeQueued: { backgroundColor: colors.surfaceMuted },
  legBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  legBadgeTextActive: { color: '#4f8cff' },
  legBadgeTextArmed: { color: colors.warning },
  legBadgeTextDefault: { color: colors.textMuted },
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
  mapDiagnosticCard: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  mapDiagnosticTitle: { fontSize: 12, fontWeight: '700', color: colors.text },
  mapDiagnosticText: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  mapDiagnosticWarning: { fontSize: 12, color: colors.warning, marginTop: 6 },
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


