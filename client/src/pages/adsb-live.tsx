import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, WMSTileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FeatureCollection } from "geojson";
import {
  AlertTriangle,
  Cloud,
  LocateFixed,
  Navigation,
  Plane,
  Radar,
  Radio,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";

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
  onGround: boolean;
};

type AdsbExchangePayload = {
  ac?: Array<Record<string, any>>;
};

type SavedFlightPlan = {
  id: string;
  title: string | null;
  departure: string;
  destination: string;
  route: string | null;
  alternate: string | null;
  filingStatus: string | null;
  filingFlightRules: string | null;
  filingPlannedAltitudeFt?: number | null;
};

type AirportSearchResult = {
  icao?: string | null;
  iata?: string | null;
  gpsCode?: string | null;
  ident?: string | null;
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lon?: number | null;
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

type NearbyDiversionResponse = {
  lat: number;
  lon: number;
  radiusNm: number;
  airports: NearbyDiversionAirport[];
};

type OverlayFeatureCollection = FeatureCollection & {
  stale?: boolean;
  updatedAt?: string;
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

type NearbyObstacleResponse = {
  source: string;
  radiusNm: number;
  count: number;
  highestObstacle: {
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
  } | null;
  obstacles: Array<{
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
  }>;
};

type MapStyle = "standard" | "sectional" | "radar" | "clouds";

const defaultCenter: [number, number] = [39.5, -98.35];

const FAA_SECTIONAL_TILE_URL =
  "https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}";
const ICAO_TOKEN_REGEX = /^[A-Z0-9]{3,5}$/;

const routeLineStyle = { color: "#2563eb", weight: 3, opacity: 0.78 };
const terrainRiskStyles = {
  comfortable: { color: "#16a34a", weight: 5, opacity: 0.9 },
  caution: { color: "#f59e0b", weight: 5, opacity: 0.92 },
  warning: { color: "#dc2626", weight: 5, opacity: 0.96 },
} as const;
const terrainSurfaceStyles = {
  comfortable: { color: "#16a34a", weight: 16, opacity: 0.14, lineCap: "round" as const },
  caution: { color: "#f59e0b", weight: 18, opacity: 0.18, lineCap: "round" as const },
  warning: { color: "#dc2626", weight: 20, opacity: 0.22, lineCap: "round" as const },
} as const;

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
  risk: keyof typeof terrainRiskStyles;
};

type TerrainProfileChartPoint = {
  x: number;
  y: number;
  elevationFt: number;
  progressRatio: number;
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

const haversineNm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c * 0.539957;
};

const projectLatLonToNm = (lat: number, lon: number, refLat: number) => {
  const latNm = lat * 60;
  const lonNm = lon * 60 * Math.cos((refLat * Math.PI) / 180);
  return { x: lonNm, y: latNm };
};

const computeRouteProgress = (
  routePoints: RoutePoint[],
  ownship: LiveOwnship | null,
): RouteProgressSummary | null => {
  if (!ownship || routePoints.length < 2) return null;

  const legLengths = routePoints.slice(1).map((point, index) =>
    haversineNm(routePoints[index].lat, routePoints[index].lon, point.lat, point.lon),
  );
  const totalRouteNm = legLengths.reduce((sum, value) => sum + value, 0);
  if (totalRouteNm <= 0) return null;

  const refLat = ownship.lat;
  const ownshipPoint = projectLatLonToNm(ownship.lat, ownship.lon, refLat);

  let best:
    | {
        legIndex: number;
        distanceNm: number;
        traveledNm: number;
        remainingNm: number;
        nearestLat: number;
        nearestLon: number;
        nextWaypoint: RoutePoint | null;
      }
    | null = null;

  let traveledBeforeLeg = 0;
  for (let index = 0; index < routePoints.length - 1; index += 1) {
    const start = routePoints[index];
    const end = routePoints[index + 1];
    const startNm = projectLatLonToNm(start.lat, start.lon, refLat);
    const endNm = projectLatLonToNm(end.lat, end.lon, refLat);
    const dx = endNm.x - startNm.x;
    const dy = endNm.y - startNm.y;
    const legLengthSq = dx * dx + dy * dy;
    const tRaw = legLengthSq > 0
      ? ((ownshipPoint.x - startNm.x) * dx + (ownshipPoint.y - startNm.y) * dy) / legLengthSq
      : 0;
    const t = Math.min(1, Math.max(0, tRaw));
    const nearestX = startNm.x + dx * t;
    const nearestY = startNm.y + dy * t;
    const offRouteNm = Math.hypot(ownshipPoint.x - nearestX, ownshipPoint.y - nearestY);
    const nearestLat = nearestY / 60;
    const nearestLon = nearestX / (60 * Math.cos((refLat * Math.PI) / 180));
    const legLengthNm = legLengths[index] ?? 0;
    const traveledNm = traveledBeforeLeg + legLengthNm * t;
    const remainingNm = Math.max(0, totalRouteNm - traveledNm);

    if (!best || offRouteNm < best.distanceNm) {
      best = {
        legIndex: index,
        distanceNm: offRouteNm,
        traveledNm,
        remainingNm,
        nearestLat,
        nearestLon,
        nextWaypoint: routePoints[index + 1] ?? null,
      };
    }
    traveledBeforeLeg += legLengthNm;
  }

  if (!best) return null;

  const destination = routePoints[routePoints.length - 1];
  const directToDestinationNm = haversineNm(ownship.lat, ownship.lon, destination.lat, destination.lon);
  const speedKt = ownship.speedKt ?? null;
  const etaIso =
    speedKt && speedKt > 20
      ? new Date(Date.now() + (best.remainingNm / speedKt) * 60 * 60 * 1000).toISOString()
      : null;

  return {
    totalRouteNm,
    remainingRouteNm: best.remainingNm,
    directToDestinationNm,
    distanceFlownNm: best.traveledNm,
    progressPct: Math.min(100, Math.max(0, (best.traveledNm / totalRouteNm) * 100)),
    offRouteNm: best.distanceNm,
    nearestPoint: { lat: best.nearestLat, lon: best.nearestLon },
    activeLegIndex: best.legIndex,
    nextWaypoint: best.nextWaypoint,
    etaIso,
  };
};

const formatSignedAltitude = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${Math.round(value).toLocaleString()} ft`;
};

const formatAltitude = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${Math.round(value).toLocaleString()} ft`;
};

const formatSpeed = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${Math.round(value)} kt`;
};

const formatHeading = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${Math.round(value)} deg`;
};

const formatBearing = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return "--";
  const normalized = ((Math.round(value) % 360) + 360) % 360;
  return `${String(normalized).padStart(3, "0")} deg`;
};

const formatClearance = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${Math.round(value).toLocaleString()} ft`;
};

const formatEtaLocal = (value: string | null) => {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";
  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const buildOwnshipIcon = (headingDeg: number | null) =>
  L.divIcon({
    className: "",
    html: `
      <div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
        <svg width="28" height="28" viewBox="0 0 24 24" style="transform: rotate(${headingDeg ?? 0}deg); transform-origin: 50% 50%;">
          <path d="M12 1 L16 20 L12 17 L8 20 Z" fill="#2563eb" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
          <circle cx="12" cy="12" r="2.4" fill="#ffffff"/>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const buildTrafficIcon = (trackDeg: number | null, onGround: boolean, relativeAltitudeFt: number | null) => {
  const tone = onGround
    ? "#6b7280"
    : relativeAltitudeFt !== null && Math.abs(relativeAltitudeFt) <= 1000
      ? "#ef4444"
      : "#0f766e";

  return L.divIcon({
    className: "",
    html: `
      <div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
        <svg width="24" height="24" viewBox="0 0 24 24" style="transform: rotate(${trackDeg ?? 0}deg); transform-origin: 50% 50%;">
          <path d="M12 2 L14 10 L21 12 L14 14 L12 22 L10 14 L3 12 L10 10 Z" fill="${tone}" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"/>
        </svg>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const buildObstacleIcon = (aglFt: number | null) =>
  L.divIcon({
    className: "",
    html: `
      <div style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:9999px;background:#fef2f2;border:2px solid #dc2626;color:#991b1b;font-size:10px;font-weight:700;">
        ${aglFt !== null && aglFt >= 1000 ? "!" : "O"}
      </div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const buildDiversionIcon = (rank: number) =>
  L.divIcon({
    className: "",
    html: `
      <div style="display:flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;border-radius:9999px;background:#0f766e;border:2px solid #ffffff;color:#ffffff;font-size:11px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.25);">
        D${rank}
      </div>
    `,
    iconSize: [26, 22],
    iconAnchor: [13, 11],
  });

const buildTerrainHotSpotIcon = (risk: keyof typeof terrainRiskStyles, rank: number) => {
  const tone = risk === "warning" ? "#dc2626" : risk === "caution" ? "#f59e0b" : "#16a34a";
  return L.divIcon({
    className: "",
    html: `
      <div style="display:flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;border-radius:9999px;background:${tone};border:2px solid #ffffff;color:#ffffff;font-size:11px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.25);">
        ${rank}
      </div>
    `,
    iconSize: [24, 22],
    iconAnchor: [12, 11],
  });
};

const normalizeAirportCode = (value: string | null | undefined) => String(value || "").trim().toUpperCase();

const extractRouteAirportCandidates = (plan: SavedFlightPlan | null) => {
  if (!plan) return [] as string[];
  const tokens = [
    normalizeAirportCode(plan.departure),
    ...String(plan.route || "")
      .toUpperCase()
      .split(/\s+/)
      .map((token) => token.replace(/[^A-Z0-9]/g, ""))
      .filter((token) => ICAO_TOKEN_REGEX.test(token)),
    normalizeAirportCode(plan.destination),
    normalizeAirportCode(plan.alternate),
  ].filter(Boolean);

  return Array.from(new Set(tokens));
};

const airportResultToPoint = (code: string, item: AirportSearchResult | null | undefined): RoutePoint | null => {
  if (!item) return null;
  const lat = Number(item.latitude ?? item.lat);
  const lon = Number(item.longitude ?? item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const icao = normalizeAirportCode(item.icao || item.gpsCode || item.ident || item.iata || code);
  const name = String(item.name || icao).trim();
  return {
    icao,
    label: `${icao} · ${name}`,
    lat,
    lon,
  };
};

const GeoJsonOverlayLayer = ({
  data,
  kind,
}: {
  data: FeatureCollection | null | undefined;
  kind: "tfr" | "sua";
}) => {
  const map = useMap();

  useEffect(() => {
    if (!data?.features?.length) return undefined;
    const layer = L.geoJSON(data, {
      style: (feature: any) => {
        if (kind === "tfr") {
          return {
            color: "#f97316",
            weight: 2,
            fillColor: "#f97316",
            fillOpacity: 0.2,
          };
        }
        const rawType = String(feature?.properties?.type || feature?.properties?.raw?.SPECIALUSEAIRSPACETYPE || "").toLowerCase();
        const type = rawType.replace(/[^a-z]/g, "");
        let color = "#0f766e";
        if (type.includes("restricted")) color = "#ef4444";
        if (type.includes("prohibited")) color = "#b91c1c";
        if (type.includes("warning")) color = "#f59e0b";
        if (type.includes("moa")) color = "#2563eb";
        return {
          color,
          weight: 1,
          dashArray: "4 3",
          fillColor: color,
          fillOpacity: 0.08,
        };
      },
      onEachFeature: (feature: any, layerInstance) => {
        const title =
          kind === "tfr"
            ? feature?.properties?.notamId || feature?.properties?.title || "TFR"
            : feature?.properties?.name || feature?.properties?.raw?.FEATURENAME || "SUA";
        layerInstance.bindTooltip(String(title), { sticky: true });
      },
    });

    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [data, kind, map]);

  return null;
};

function RecenterOwnship({
  ownship,
  followOwnship,
}: {
  ownship: LiveOwnship | null;
  followOwnship: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!ownship || !followOwnship) return;
    map.setView([ownship.lat, ownship.lon], Math.max(map.getZoom(), 8), {
      animate: true,
    });
  }, [followOwnship, map, ownship]);

  return null;
}

export default function AdsbLive() {
  const { isAuthenticated } = useAuth();
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [followOwnship, setFollowOwnship] = useState(true);
  const [mapStyle, setMapStyle] = useState<MapStyle>("radar");
  const [rangeNm, setRangeNm] = useState("50");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [ownship, setOwnship] = useState<LiveOwnship | null>(null);
  const [trail, setTrail] = useState<Array<[number, number]>>([]);
  const [radarFrames, setRadarFrames] = useState<string[]>([]);
  const [radarFrameIndex, setRadarFrameIndex] = useState(0);
  const [radarFallbackActive, setRadarFallbackActive] = useState(false);
  const [showTfrOverlay, setShowTfrOverlay] = useState(true);
  const [showSuaOverlay, setShowSuaOverlay] = useState(false);
  const [showObstacleOverlay, setShowObstacleOverlay] = useState(true);
  const [showDiversionOverlay, setShowDiversionOverlay] = useState(true);
  const [showTerrainShading, setShowTerrainShading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState("none");
  const watchIdRef = useRef<number | null>(null);
  const radarTimerRef = useRef<number | null>(null);
  const cloudDate = useMemo(
    () => new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString().slice(0, 10),
    []
  );

  useEffect(() => {
    trackEvent("live_traffic_view", { page: "/live-traffic" });
  }, []);

  const beginTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported on this device/browser.");
      return;
    }
    setGeoError(null);
    setTrackingEnabled(true);
  }, []);

  const stopTracking = useCallback(() => {
    setTrackingEnabled(false);
  }, []);

  useEffect(() => {
    if (!trackingEnabled) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported on this device/browser.");
      return;
    }

    trackEvent("live_traffic_tracking_start", { rangeNm });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nextOwnship: LiveOwnship = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          altitudeFt: position.coords.altitude != null ? position.coords.altitude * 3.28084 : null,
          speedKt: position.coords.speed != null ? position.coords.speed * 1.94384 : null,
          headingDeg: position.coords.heading != null && Number.isFinite(position.coords.heading)
            ? position.coords.heading
            : null,
          timestamp: position.timestamp,
        };
        setOwnship(nextOwnship);
        setTrail((current) => {
          const next = [...current, [nextOwnship.lat, nextOwnship.lon] as [number, number]];
          return next.slice(-25);
        });
        setGeoError(null);
      },
      (error) => {
        setGeoError(error.message || "Unable to determine device position.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [rangeNm, trackingEnabled]);

  useEffect(() => {
    if (mapStyle !== "radar") {
      setRadarFrames([]);
      setRadarFrameIndex(0);
      setRadarFallbackActive(false);
      return;
    }

    let isMounted = true;

    const loadFrames = async () => {
      try {
        const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");
        if (!response.ok) throw new Error("Failed to load radar frames");
        const payload = await response.json();
        const frames = [...(payload?.radar?.past || []), ...(payload?.radar?.nowcast || [])]
          .map((item: { path?: string }) => item.path)
          .filter(Boolean) as string[];
        if (!isMounted) return;
        setRadarFrames(frames);
        setRadarFrameIndex(frames.length > 0 ? frames.length - 1 : 0);
        setRadarFallbackActive(frames.length === 0);
      } catch {
        if (!isMounted) return;
        setRadarFrames([]);
        setRadarFrameIndex(0);
        setRadarFallbackActive(true);
      }
    };

    loadFrames();
    return () => {
      isMounted = false;
    };
  }, [mapStyle]);

  useEffect(() => {
    if (mapStyle !== "radar" || radarFrames.length === 0) {
      if (radarTimerRef.current) {
        window.clearInterval(radarTimerRef.current);
        radarTimerRef.current = null;
      }
      return;
    }

    if (radarTimerRef.current) {
      window.clearInterval(radarTimerRef.current);
    }

    radarTimerRef.current = window.setInterval(() => {
      setRadarFrameIndex((current) => (current + 1) % radarFrames.length);
    }, 1800);

    return () => {
      if (radarTimerRef.current) {
        window.clearInterval(radarTimerRef.current);
        radarTimerRef.current = null;
      }
    };
  }, [mapStyle, radarFrames.length]);

  const trafficQuery = useQuery<AdsbExchangePayload>({
    queryKey: [
      "/api/adsb/aircraft",
      ownship ? ownship.lat.toFixed(3) : null,
      ownship ? ownship.lon.toFixed(3) : null,
      rangeNm,
    ],
    enabled: Boolean(ownship),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      if (!ownship) {
        return { ac: [] };
      }
      const params = new URLSearchParams({
        lat: String(ownship.lat),
        lon: String(ownship.lon),
        dist: rangeNm,
      });
      const response = await fetch(apiUrl(`/api/adsb/aircraft?${params}`), {
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to load nearby traffic.");
      }
      return response.json();
    },
  });

  const trafficTargets = useMemo<TrafficTarget[]>(() => {
    if (!trafficQuery.data?.ac || !ownship) return [];
    const normalized: TrafficTarget[] = [];
    trafficQuery.data.ac.forEach((raw, index) => {
      const lat = Number(raw.lat);
      const lon = Number(raw.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const altitudeFt = Number.isFinite(Number(raw.alt_baro))
        ? Number(raw.alt_baro)
        : Number.isFinite(Number(raw.alt_geom))
          ? Number(raw.alt_geom)
          : null;
      const distanceNm = haversineNm(ownship.lat, ownship.lon, lat, lon);
      const relativeAltitudeFt = altitudeFt !== null && ownship.altitudeFt !== null
        ? altitudeFt - ownship.altitudeFt
        : null;
      normalized.push({
        id: String(raw.hex || raw.icao || index),
        callsign: raw.flight ? String(raw.flight).trim() : null,
        tail: raw.r ? String(raw.r).trim() : null,
        lat,
        lon,
        altitudeFt,
        groundSpeedKt: Number.isFinite(Number(raw.gs)) ? Number(raw.gs) : null,
        trackDeg: Number.isFinite(Number(raw.track)) ? Number(raw.track) : null,
        category: raw.t ? String(raw.t) : null,
        squawk: raw.squawk ? String(raw.squawk) : null,
        relativeAltitudeFt,
        distanceNm,
        onGround: Boolean(raw.gnd),
      });
    });

    return normalized
      .sort((a, b) => (a.distanceNm ?? Number.POSITIVE_INFINITY) - (b.distanceNm ?? Number.POSITIVE_INFINITY))
      .slice(0, 40);
  }, [ownship, trafficQuery.data]);

  const trafficAlerts = useMemo(
    () =>
      trafficTargets.filter(
        (target) =>
          (target.distanceNm ?? Number.POSITIVE_INFINITY) <= 3 &&
          target.relativeAltitudeFt !== null &&
          Math.abs(target.relativeAltitudeFt) <= 1000
      ),
    [trafficTargets]
  );

  const radarTileUrl = useMemo(() => {
    if (mapStyle !== "radar" || radarFrames.length === 0) return "";
    const frame = radarFrames[radarFrameIndex];
    const normalized = frame.replace(/^\/??v2\/radar\//, "");
    return apiUrl(`/api/tiles/rainviewer/v2/radar/${normalized}/256/{z}/{x}/{y}/2/1_1.png`);
  }, [mapStyle, radarFrameIndex, radarFrames]);

  const cloudTileUrl = useMemo(() => {
    if (mapStyle !== "clouds") return "";
    return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${cloudDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
  }, [cloudDate, mapStyle]);

  const mapCenter = ownship ? ([ownship.lat, ownship.lon] as [number, number]) : defaultCenter;
  const ownshipIcon = useMemo(() => buildOwnshipIcon(ownship?.headingDeg ?? null), [ownship?.headingDeg]);
  const overlayBbox = useMemo(() => {
    if (!ownship) return "";
    const latPad = Math.max(0.4, Number(rangeNm) / 60);
    const lonPad = Math.max(0.4, Number(rangeNm) / (60 * Math.max(Math.cos((ownship.lat * Math.PI) / 180), 0.2)));
    return [
      (ownship.lat - latPad).toFixed(4),
      (ownship.lon - lonPad).toFixed(4),
      (ownship.lat + latPad).toFixed(4),
      (ownship.lon + lonPad).toFixed(4),
    ].join(",");
  }, [ownship, rangeNm]);

  const savedPlansQuery = useQuery<SavedFlightPlan[]>({
    queryKey: ["/api/flight-plans"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/flight-plans"), { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load saved flight plans.");
      return response.json();
    },
  });

  const selectedPlan = useMemo(
    () => savedPlansQuery.data?.find((plan) => plan.id === selectedPlanId) ?? null,
    [savedPlansQuery.data, selectedPlanId]
  );

  useEffect(() => {
    if (!savedPlansQuery.data?.length) return;
    if (selectedPlanId !== "none" && savedPlansQuery.data.some((plan) => plan.id === selectedPlanId)) return;
    setSelectedPlanId(savedPlansQuery.data[0].id);
  }, [savedPlansQuery.data, selectedPlanId]);

  const routeCodes = useMemo(() => extractRouteAirportCandidates(selectedPlan), [selectedPlan]);

  const routePointsQuery = useQuery<RoutePoint[]>({
    queryKey: ["/api/airports/search", routeCodes.join("|")],
    enabled: routeCodes.length > 0,
    queryFn: async () => {
      const points: RoutePoint[] = [];
      for (const code of routeCodes) {
        const response = await fetch(apiUrl(`/api/airports/search?q=${encodeURIComponent(code)}`), {
          credentials: "include",
        });
        if (!response.ok) continue;
        const payload = await response.json();
        const candidates = Array.isArray(payload) ? payload : Array.isArray(payload?.airports) ? payload.airports : [];
        const exact = candidates.find((item: AirportSearchResult) => {
          const itemCode = normalizeAirportCode(item.icao || item.gpsCode || item.ident || item.iata);
          return itemCode === code;
        }) || candidates[0];
        const point = airportResultToPoint(code, exact);
        if (point) {
          points.push(point);
        }
      }
      return points;
    },
  });

  const routePoints = routePointsQuery.data ?? [];
  const routePathParam = useMemo(
    () => routePoints.map((point) => `${point.lat.toFixed(6)},${point.lon.toFixed(6)}`).join(";"),
    [routePoints]
  );
  const routeProgress = useMemo(
    () => computeRouteProgress(routePoints, ownship),
    [ownship, routePoints]
  );
  const diversionRadiusNm = useMemo(() => {
    const numericRange = Number(rangeNm);
    if (!Number.isFinite(numericRange)) return 60;
    return Math.max(40, Math.min(120, numericRange));
  }, [rangeNm]);
  const nearbyDiversionsQuery = useQuery<NearbyDiversionResponse>({
    queryKey: [
      "/api/airports/nearby",
      ownship?.lat?.toFixed(3) ?? null,
      ownship?.lon?.toFixed(3) ?? null,
      diversionRadiusNm,
    ],
    enabled: Boolean(ownship),
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      if (!ownship) {
        return { lat: 0, lon: 0, radiusNm: diversionRadiusNm, airports: [] };
      }
      const params = new URLSearchParams({
        lat: String(ownship.lat),
        lon: String(ownship.lon),
        radiusNm: String(diversionRadiusNm),
        limit: "8",
      });
      const response = await fetch(apiUrl(`/api/airports/nearby?${params.toString()}`), {
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to load nearby diversion airports.");
      }
      return response.json();
    },
  });
  const diversionCandidates = nearbyDiversionsQuery.data?.airports ?? [];
  const diversionMapMarkers = diversionCandidates.slice(0, 5);
  const bestDiversion = diversionCandidates[0] ?? null;
  const immediateDiversions = diversionCandidates.filter((airport) => airport.immediateReady).slice(0, 3);
  const routeSummaryText = selectedPlan
    ? `${selectedPlan.departure} to ${selectedPlan.destination}${selectedPlan.alternate ? ` · alt ${selectedPlan.alternate}` : ""}`
    : "No route selected";

  const tfrQuery = useQuery<OverlayFeatureCollection>({
    queryKey: ["/api/tfrs", overlayBbox],
    enabled: showTfrOverlay && Boolean(overlayBbox),
    queryFn: async () => {
      const response = await fetch(apiUrl(`/api/tfrs?bbox=${encodeURIComponent(overlayBbox)}`), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Unable to load nearby TFRs.");
      return response.json();
    },
    refetchInterval: 60 * 1000,
  });

  const suaQuery = useQuery<OverlayFeatureCollection>({
    queryKey: ["/api/airspace/sua", overlayBbox],
    enabled: showSuaOverlay && Boolean(overlayBbox),
    queryFn: async () => {
      const response = await fetch(apiUrl(`/api/airspace/sua?bbox=${encodeURIComponent(overlayBbox)}`), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Unable to load nearby special use airspace.");
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const tfrCount = tfrQuery.data?.features?.length ?? 0;
  const suaCount = suaQuery.data?.features?.length ?? 0;

  const terrainProfileQuery = useQuery<TerrainProfileResponse>({
    queryKey: ["/api/aviation/terrain-profile", routePathParam],
    enabled: routePoints.length >= 2,
    queryFn: async () => {
      const response = await fetch(apiUrl(`/api/aviation/terrain-profile?path=${encodeURIComponent(routePathParam)}`), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Unable to load route terrain profile.");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const obstacleQuery = useQuery<NearbyObstacleResponse>({
    queryKey: ["/api/aviation/obstacles/nearby", ownship?.lat?.toFixed(4) ?? null, ownship?.lon?.toFixed(4) ?? null, rangeNm],
    enabled: Boolean(ownship),
    queryFn: async () => {
      if (!ownship) {
        return { source: "FAA Daily DOF", radiusNm: Number(rangeNm), count: 0, highestObstacle: null, obstacles: [] };
      }
      const params = new URLSearchParams({
        lat: String(ownship.lat),
        lon: String(ownship.lon),
        radiusNm: rangeNm,
        limit: "40",
      });
      const response = await fetch(apiUrl(`/api/aviation/obstacles/nearby?${params.toString()}`), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Unable to load nearby obstacles.");
      return response.json();
    },
    refetchInterval: 60 * 1000,
    staleTime: 60 * 1000,
  });

  const terrainMaxElevationFt = terrainProfileQuery.data?.maxElevationFt ?? null;
  const obstacleCount = obstacleQuery.data?.count ?? 0;
  const highestObstacle = obstacleQuery.data?.highestObstacle ?? null;
  const nearbyObstacles = obstacleQuery.data?.obstacles ?? [];
  const terrainReferenceAltitudeFt = selectedPlan?.filingPlannedAltitudeFt ?? ownship?.altitudeFt ?? null;
  const terrainReferenceSource = selectedPlan?.filingPlannedAltitudeFt != null
    ? "planned altitude"
    : ownship?.altitudeFt != null
      ? "ownship altitude"
      : null;
  const terrainCueSegments = useMemo<TerrainCueSegment[]>(() => {
    const samples = terrainProfileQuery.data?.samples ?? [];
    if (samples.length < 2) return [];

    const classifyRisk = (clearanceFt: number | null): keyof typeof terrainRiskStyles => {
      if (clearanceFt === null || !Number.isFinite(clearanceFt)) return "comfortable";
      if (clearanceFt < 1000) return "warning";
      if (clearanceFt < 2000) return "caution";
      return "comfortable";
    };

    const segments: TerrainCueSegment[] = [];
    for (let index = 1; index < samples.length; index += 1) {
      const previous = samples[index - 1];
      const current = samples[index];
      const maxElevationFt =
        previous.elevationFt != null && current.elevationFt != null
          ? Math.max(previous.elevationFt, current.elevationFt)
          : previous.elevationFt ?? current.elevationFt ?? null;
      const clearanceFt =
        terrainReferenceAltitudeFt != null && maxElevationFt != null
          ? terrainReferenceAltitudeFt - maxElevationFt
          : null;

      segments.push({
        positions: [
          [previous.lat, previous.lon],
          [current.lat, current.lon],
        ],
        maxElevationFt,
        clearanceFt,
        risk: classifyRisk(clearanceFt),
      });
    }

    return segments;
  }, [terrainProfileQuery.data?.samples, terrainReferenceAltitudeFt]);
  const terrainCueCounts = useMemo(
    () =>
      terrainCueSegments.reduce(
        (acc, segment) => {
          acc[segment.risk] += 1;
          return acc;
        },
        { comfortable: 0, caution: 0, warning: 0 }
      ),
    [terrainCueSegments]
  );
  const terrainCueStatus = useMemo(() => {
    if (!terrainReferenceSource) return "No altitude source yet";
    if (terrainCueCounts.warning > 0) return "Terrain warning segments";
    if (terrainCueCounts.caution > 0) return "Tight terrain clearance";
    if (terrainCueSegments.length > 0) return "Comfortable terrain clearance";
    return "No terrain cueing yet";
  }, [terrainCueCounts, terrainCueSegments.length, terrainReferenceSource]);
  const terrainCueToneClass = terrainCueCounts.warning > 0
    ? "text-red-600"
    : terrainCueCounts.caution > 0
      ? "text-amber-600"
      : terrainCueSegments.length > 0
        ? "text-emerald-600"
        : "text-muted-foreground";
  const worstTerrainSegment = useMemo(() => {
    if (terrainCueSegments.length === 0) return null;
    return terrainCueSegments.reduce((worst, segment, index) => {
      const currentClearance = segment.clearanceFt ?? Number.POSITIVE_INFINITY;
      const worstClearance = worst.segment.clearanceFt ?? Number.POSITIVE_INFINITY;
      if (currentClearance < worstClearance) {
        return { index, segment };
      }
      return worst;
    }, { index: 0, segment: terrainCueSegments[0] });
  }, [terrainCueSegments]);
  const terrainHotSpots = useMemo(() => {
    if (terrainCueSegments.length === 0) return [] as Array<{
      index: number;
      segment: TerrainCueSegment;
      progressLabel: string;
    }>;

    const scored = terrainCueSegments
      .map((segment, index) => {
        const startPct = Math.round((index / terrainCueSegments.length) * 100);
        const endPct = Math.round(((index + 1) / terrainCueSegments.length) * 100);
        const riskScore = segment.risk === "warning" ? 0 : segment.risk === "caution" ? 1 : 2;
        const clearanceScore = segment.clearanceFt ?? Number.POSITIVE_INFINITY;
        return {
          index,
          segment,
          progressLabel: `${startPct}% to ${endPct}%`,
          riskScore,
          clearanceScore,
        };
      })
      .sort((a, b) => {
        if (a.riskScore !== b.riskScore) return a.riskScore - b.riskScore;
        return a.clearanceScore - b.clearanceScore;
      });

    return scored.slice(0, 3).map(({ index, segment, progressLabel }) => ({
      index,
      segment,
      progressLabel,
    }));
  }, [terrainCueSegments]);
  const terrainClearanceHeadline = worstTerrainSegment
    ? `${formatClearance(worstTerrainSegment.segment.clearanceFt)} minimum clearance`
    : "--";
  const terrainClearanceAdvisory = worstTerrainSegment
    ? worstTerrainSegment.segment.risk === "warning"
      ? "One or more route segments are below the 1,000 ft terrain buffer."
      : worstTerrainSegment.segment.risk === "caution"
        ? "Part of the route is inside the tighter 2,000 ft terrain margin."
        : "Current route stays in the comfortable terrain margin."
    : "Select a saved route overlay to evaluate terrain clearance.";
  const terrainProfileChart = useMemo(() => {
    const samples = terrainProfileQuery.data?.samples ?? [];
    const validSamples = samples
      .map((sample, index) => ({
        index,
        elevationFt: sample.elevationFt,
      }))
      .filter((sample): sample is { index: number; elevationFt: number } => sample.elevationFt != null && Number.isFinite(sample.elevationFt));

    if (validSamples.length < 2) return null;

    const chartWidth = 320;
    const chartHeight = 148;
    const padding = { top: 10, right: 8, bottom: 22, left: 8 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;
    const maxTerrainFt = Math.max(...validSamples.map((sample) => sample.elevationFt));
    const topAltitudeFt = Math.max(maxTerrainFt + 2500, terrainReferenceAltitudeFt != null ? terrainReferenceAltitudeFt + 1000 : 0, 4000);
    const minAltitudeFt = 0;
    const altitudeSpanFt = Math.max(1000, topAltitudeFt - minAltitudeFt);
    const sampleCount = samples.length;

    const points: TerrainProfileChartPoint[] = validSamples.map((sample) => {
      const progressRatio = sampleCount > 1 ? sample.index / (sampleCount - 1) : 0;
      return {
        x: padding.left + progressRatio * innerWidth,
        y: padding.top + ((topAltitudeFt - sample.elevationFt) / altitudeSpanFt) * innerHeight,
        elevationFt: sample.elevationFt,
        progressRatio,
      };
    });

    const terrainLine = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const terrainArea = [
      `${padding.left},${chartHeight - padding.bottom}`,
      ...points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`),
      `${padding.left + innerWidth},${chartHeight - padding.bottom}`,
    ].join(" ");
    const referenceY = terrainReferenceAltitudeFt != null
      ? padding.top + ((topAltitudeFt - terrainReferenceAltitudeFt) / altitudeSpanFt) * innerHeight
      : null;
    const yTicks = [0.25, 0.5, 0.75].map((ratio) => {
      const y = padding.top + ratio * innerHeight;
      const altitudeFt = Math.round(topAltitudeFt - ratio * altitudeSpanFt);
      return { y, altitudeFt };
    });
    const hotSpots = terrainHotSpots.map((item) => {
      const point = points[Math.min(item.index + 1, points.length - 1)] ?? points[points.length - 1];
      return {
        ...item,
        x: point.x,
        y: point.y,
      };
    });

    return {
      chartWidth,
      chartHeight,
      padding,
      terrainLine,
      terrainArea,
      referenceY,
      yTicks,
      hotSpots,
    };
  }, [terrainHotSpots, terrainProfileQuery.data?.samples, terrainReferenceAltitudeFt]);
  const terrainHotSpotMarkers = useMemo(
    () =>
      terrainHotSpots.map((item, rank) => {
        const point = terrainCueSegments[item.index + 1]?.positions?.[0]
          ?? terrainCueSegments[item.index]?.positions?.[1]
          ?? terrainCueSegments[item.index]?.positions?.[0]
          ?? null;
        if (!point) return null;
        return {
          rank: rank + 1,
          risk: item.segment.risk,
          progressLabel: item.progressLabel,
          maxElevationFt: item.segment.maxElevationFt,
          clearanceFt: item.segment.clearanceFt,
          lat: point[0],
          lon: point[1],
        };
      }).filter(Boolean) as Array<{
        rank: number;
        risk: keyof typeof terrainRiskStyles;
        progressLabel: string;
        maxElevationFt: number | null;
        clearanceFt: number | null;
        lat: number;
        lon: number;
      }>,
    [terrainCueSegments, terrainHotSpots]
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Beta</Badge>
            <Badge className="bg-sky-600 text-white hover:bg-sky-600">Monthly billing, no annual lock-in</Badge>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Plane className="h-6 w-6 text-sky-600" />
            RSF Live Flight Map
          </h1>
          <p className="text-muted-foreground max-w-4xl">
            Follow your flight with device GPS, nearby traffic, and live weather overlays. This first phase is built around
            browser GPS, RSF traffic/weather layers, and first-pass terrain/obstacle awareness while direct portable
            receiver ingestion continues next.
          </p>
        </div>

        <Alert className="border-dashed">
          <AlertTitle>Situational awareness only</AlertTitle>
          <AlertDescription>
            RSF Live Flight Map is not primary navigation. Always use certified avionics, current charts, and ATC guidance
            for operational decisions.
          </AlertDescription>
        </Alert>

        {!trackingEnabled && (
          <Alert>
            <LocateFixed className="h-4 w-4" />
            <AlertDescription className="flex flex-wrap items-center gap-3">
              Enable device location to start ownship tracking, traffic lookups, and map following.
              <Button size="sm" onClick={beginTracking}>Start live tracking</Button>
            </AlertDescription>
          </Alert>
        )}

        {geoError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{geoError}</AlertDescription>
          </Alert>
        )}

        {trafficAlerts.length > 0 && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-950">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              {trafficAlerts.length} traffic {trafficAlerts.length === 1 ? "target is" : "targets are"} within 3 NM and 1,000 ft of your current altitude.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Live map</CardTitle>
                  <CardDescription>Ownship, nearby traffic, and live weather overlays.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={mapStyle} onValueChange={(value) => setMapStyle(value as MapStyle)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="sectional">Sectional</SelectItem>
                      <SelectItem value="radar">Radar</SelectItem>
                      <SelectItem value="clouds">Clouds</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={rangeNm} onValueChange={setRangeNm}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25 NM</SelectItem>
                      <SelectItem value="50">50 NM</SelectItem>
                      <SelectItem value="100">100 NM</SelectItem>
                      <SelectItem value="150">150 NM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {isAuthenticated && (
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Choose saved route overlay" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No saved route overlay</SelectItem>
                      {(savedPlansQuery.data ?? []).map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.title || `${plan.departure} to ${plan.destination}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <label className="flex items-center gap-2">
                  <Switch checked={followOwnship} onCheckedChange={setFollowOwnship} />
                  Follow ownship
                </label>
                <label className="flex items-center gap-2">
                  <Switch checked={showTfrOverlay} onCheckedChange={setShowTfrOverlay} />
                  TFR overlay
                </label>
                <label className="flex items-center gap-2">
                  <Switch checked={showSuaOverlay} onCheckedChange={setShowSuaOverlay} />
                  SUA overlay
                </label>
                <label className="flex items-center gap-2">
                  <Switch checked={showObstacleOverlay} onCheckedChange={setShowObstacleOverlay} />
                  Obstacles
                </label>
                <label className="flex items-center gap-2">
                  <Switch checked={showDiversionOverlay} onCheckedChange={setShowDiversionOverlay} />
                  Diversions
                </label>
                <label className="flex items-center gap-2">
                  <Switch checked={showTerrainShading} onCheckedChange={setShowTerrainShading} />
                  Terrain shading
                </label>
                <Button type="button" variant="outline" size="sm" onClick={() => trafficQuery.refetch()}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Refresh traffic
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href="/adsb-receiver-help">
                    <Radio className="mr-2 h-4 w-4" />
                    Receiver setup help
                  </Link>
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href="/tfr-map">
                    <ShieldAlert className="mr-2 h-4 w-4" />
                    Open TFR map
                  </Link>
                </Button>
                {trackingEnabled ? (
                  <Button type="button" variant="ghost" size="sm" onClick={stopTracking}>
                    Stop tracking
                  </Button>
                ) : null}
              </div>

              <div className="h-[580px] overflow-hidden rounded-xl border">
                <MapContainer center={mapCenter} zoom={8} scrollWheelZoom className="h-full w-full">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {mapStyle === "sectional" && (
                    <TileLayer
                      attribution="Federal Aviation Administration, Aeronautical Information Services"
                      url={FAA_SECTIONAL_TILE_URL}
                      minZoom={4}
                      maxZoom={12}
                      maxNativeZoom={12}
                      opacity={0.85}
                    />
                  )}
                  {mapStyle === "radar" && radarTileUrl && !radarFallbackActive && (
                    <TileLayer
                      attribution="RainViewer"
                      url={radarTileUrl}
                      opacity={0.8}
                      zIndex={600}
                      crossOrigin="anonymous"
                      eventHandlers={{
                        tileerror: () => {
                          setRadarFallbackActive(true);
                        },
                      }}
                    />
                  )}
                  {mapStyle === "radar" && (radarFallbackActive || !radarTileUrl) && (
                    <WMSTileLayer
                      attribution="IEM NEXRAD Base Reflectivity"
                      url="https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi"
                      layers="nexrad-n0r-900913"
                      format="image/png"
                      transparent
                      opacity={0.75}
                      zIndex={600}
                    />
                  )}
                  {mapStyle === "clouds" && cloudTileUrl && (
                    <TileLayer
                      attribution="NASA GIBS"
                      url={cloudTileUrl}
                      opacity={0.68}
                      maxNativeZoom={9}
                      zIndex={600}
                      crossOrigin="anonymous"
                    />
                  )}
                  {ownship && (
                    <>
                      <RecenterOwnship ownship={ownship} followOwnship={followOwnship} />
                      <Marker position={[ownship.lat, ownship.lon]} icon={ownshipIcon}>
                        <Tooltip direction="top" offset={[0, -10]}>
                          Ownship
                        </Tooltip>
                        <Popup>
                          <div className="space-y-1 text-sm">
                            <div className="font-semibold">Ownship</div>
                            <div>Altitude: {formatAltitude(ownship.altitudeFt)}</div>
                            <div>Speed: {formatSpeed(ownship.speedKt)}</div>
                            <div>Heading: {formatHeading(ownship.headingDeg)}</div>
                          </div>
                        </Popup>
                      </Marker>
                      <Polyline positions={trail} pathOptions={{ color: "#2563eb", weight: 2.5, opacity: 0.75 }} />
                      <Circle
                        center={[ownship.lat, ownship.lon]}
                        radius={Number(rangeNm) * 1852}
                        pathOptions={{ color: "#0ea5e9", weight: 1.5, dashArray: "4 4", fillOpacity: 0.03 }}
                      />
                      {routeProgress && routeProgress.offRouteNm >= 0.2 ? (
                        <Polyline
                          positions={[
                            [ownship.lat, ownship.lon],
                            [routeProgress.nearestPoint.lat, routeProgress.nearestPoint.lon],
                          ]}
                          pathOptions={{ color: "#0f172a", weight: 2, opacity: 0.65, dashArray: "6 6" }}
                        >
                          <Tooltip direction="top" offset={[0, -8]}>
                            <div className="space-y-0.5 text-xs">
                              <div className="font-semibold">Route deviation</div>
                              <div>{routeProgress.offRouteNm.toFixed(1)} NM from planned route</div>
                              <div>
                                Rejoin before {routeProgress.nextWaypoint?.icao || selectedPlan?.destination || "destination"}
                              </div>
                            </div>
                          </Tooltip>
                        </Polyline>
                      ) : null}
                    </>
                  )}
                  {terrainCueSegments.length > 0
                    ? terrainCueSegments.map((segment, index) => (
                        <Fragment key={`terrain-segment-wrap-${index}`}>
                          {showTerrainShading ? (
                            <Polyline
                              key={`terrain-surface-${index}`}
                              positions={segment.positions}
                              pathOptions={terrainSurfaceStyles[segment.risk]}
                            />
                          ) : null}
                          <Polyline
                            key={`terrain-segment-${index}`}
                            positions={segment.positions}
                            pathOptions={terrainRiskStyles[segment.risk]}
                          >
                            <Tooltip direction="top" offset={[0, -8]}>
                              <div className="space-y-0.5 text-xs">
                                <div className="font-semibold">
                                  {segment.risk === "warning"
                                    ? "Terrain warning"
                                    : segment.risk === "caution"
                                      ? "Tight clearance"
                                      : "Comfortable clearance"}
                                </div>
                                <div>Highest terrain: {formatAltitude(segment.maxElevationFt)}</div>
                                <div>Clearance: {formatClearance(segment.clearanceFt)}</div>
                              </div>
                            </Tooltip>
                          </Polyline>
                        </Fragment>
                      ))
                    : routePoints.length >= 2 && (
                        <Polyline
                          positions={routePoints.map((point) => [point.lat, point.lon] as [number, number])}
                          pathOptions={routeLineStyle}
                        />
                      )}
                  {routePoints.map((point, index) => (
                    <Marker
                      key={`route-${point.icao}-${index}`}
                      position={[point.lat, point.lon]}
                      icon={L.divIcon({
                        className: "",
                        html: `<div style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:9999px;background:#ffffff;border:2px solid #2563eb;color:#2563eb;font-weight:700;font-size:10px;">${index + 1}</div>`,
                        iconSize: [18, 18],
                        iconAnchor: [9, 9],
                      })}
                    >
                      <Tooltip direction="top" offset={[0, -10]}>
                        {point.label}
                      </Tooltip>
                    </Marker>
                  ))}
                  {terrainHotSpotMarkers.map((hotSpot) => (
                    <Marker
                      key={`terrain-hotspot-marker-${hotSpot.rank}-${hotSpot.progressLabel}`}
                      position={[hotSpot.lat, hotSpot.lon]}
                      icon={buildTerrainHotSpotIcon(hotSpot.risk, hotSpot.rank)}
                    >
                      <Tooltip direction="top" offset={[0, -10]}>
                        Terrain hot spot {hotSpot.rank}
                      </Tooltip>
                      <Popup>
                        <div className="space-y-1 text-sm">
                          <div className="font-semibold">Terrain hot spot {hotSpot.rank}</div>
                          <div>
                            {hotSpot.risk === "warning"
                              ? "Warning segment"
                              : hotSpot.risk === "caution"
                                ? "Tight clearance segment"
                                : "Comfortable segment"}
                          </div>
                          <div>Route progress: {hotSpot.progressLabel}</div>
                          <div>Highest terrain: {formatAltitude(hotSpot.maxElevationFt)}</div>
                          <div>Clearance: {formatClearance(hotSpot.clearanceFt)}</div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                  {showTfrOverlay && tfrQuery.data?.features?.length ? (
                    <GeoJsonOverlayLayer data={tfrQuery.data} kind="tfr" />
                  ) : null}
                  {showSuaOverlay && suaQuery.data?.features?.length ? (
                    <GeoJsonOverlayLayer data={suaQuery.data} kind="sua" />
                  ) : null}
                  {showObstacleOverlay && nearbyObstacles.map((obstacle) => (
                    <Marker
                      key={`obstacle-${obstacle.id}`}
                      position={[obstacle.lat, obstacle.lon]}
                      icon={buildObstacleIcon(obstacle.aglFt)}
                    >
                      <Tooltip direction="top" offset={[0, -10]}>
                        {obstacle.kind || "Obstacle"} · {formatAltitude(obstacle.amslFt)}
                      </Tooltip>
                      <Popup>
                        <div className="space-y-1 text-sm">
                          <div className="font-semibold">{obstacle.kind || "Obstacle"}</div>
                          <div>AMSL: {formatAltitude(obstacle.amslFt)}</div>
                          <div>AGL: {formatAltitude(obstacle.aglFt)}</div>
                          <div>Distance: {obstacle.distanceNm.toFixed(1)} NM</div>
                          {(obstacle.city || obstacle.state) ? (
                            <div>
                              {[obstacle.city, obstacle.state].filter(Boolean).join(", ")}
                            </div>
                          ) : null}
                          {obstacle.lighting ? <div>Lighting: {obstacle.lighting}</div> : null}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                  {showDiversionOverlay && diversionMapMarkers.map((airport, index) => (
                    <Marker
                      key={`diversion-${airport.icao}-${index}`}
                      position={[airport.lat, airport.lon]}
                      icon={buildDiversionIcon(index + 1)}
                    >
                      <Tooltip direction="top" offset={[0, -10]}>
                        {airport.icao} · {airport.name || "Diversion airport"}
                      </Tooltip>
                      <Popup>
                        <div className="space-y-1 text-sm">
                          <div className="font-semibold">{airport.icao} {airport.name ? `· ${airport.name}` : ""}</div>
                          {(airport.city || airport.state) ? (
                            <div>{[airport.city, airport.state].filter(Boolean).join(", ")}</div>
                          ) : null}
                          <div>Distance: {airport.distanceNm.toFixed(1)} NM</div>
                          <div>Bearing: {formatBearing(airport.bearingDeg)}</div>
                          <div>Max runway: {airport.maxRunwayFt ? `${airport.maxRunwayFt.toLocaleString()} ft` : "--"}</div>
                          {airport.flightCategory ? <div>Weather: {airport.flightCategory}</div> : null}
                          {airport.surfaces.length > 0 ? <div>Surface: {airport.surfaces.join(", ")}</div> : null}
                          {airport.runwayAdvisory ? (
                            <div>
                              Best runway: {airport.runwayAdvisory.runway}
                              {airport.runwayAdvisory.crosswindKt !== null
                                ? ` · XW ${airport.runwayAdvisory.crosswindKt.toFixed(0)} kt`
                                : ""}
                            </div>
                          ) : null}
                          {airport.frequencySummary[0]?.frequencyMhz ? (
                            <div>
                              Primary freq: {airport.frequencySummary[0].frequencyMhz.toFixed(3)}
                              {airport.frequencySummary[0].type ? ` · ${airport.frequencySummary[0].type}` : ""}
                            </div>
                          ) : null}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                  {trafficTargets.map((target) => (
                    <Marker
                      key={target.id}
                      position={[target.lat, target.lon]}
                      icon={buildTrafficIcon(target.trackDeg, target.onGround, target.relativeAltitudeFt)}
                    >
                      <Tooltip direction="top" offset={[0, -10]}>
                        {target.callsign || target.tail || target.id}
                      </Tooltip>
                      <Popup>
                        <div className="space-y-1 text-sm">
                          <div className="font-semibold">{target.callsign || target.tail || target.id}</div>
                          <div>Distance: {target.distanceNm ? `${target.distanceNm.toFixed(1)} NM` : "--"}</div>
                          <div>Altitude: {formatAltitude(target.altitudeFt)}</div>
                          <div>Relative: {formatSignedAltitude(target.relativeAltitudeFt)}</div>
                          <div>Speed: {formatSpeed(target.groundSpeedKt)}</div>
                          <div>Track: {formatHeading(target.trackDeg)}</div>
                          {target.category ? <div>Type: {target.category}</div> : null}
                          {target.squawk ? <div>Squawk: {target.squawk}</div> : null}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Tracking</div>
                  <div className="font-semibold">{trackingEnabled && ownship ? "Live" : "Idle"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Nearby traffic</div>
                  <div className="font-semibold">{trafficTargets.length}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Ownship altitude</div>
                  <div className="font-semibold">{formatAltitude(ownship?.altitudeFt ?? null)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Ownship groundspeed</div>
                  <div className="font-semibold">{formatSpeed(ownship?.speedKt ?? null)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Nearby TFRs</div>
                  <div className="font-semibold">{showTfrOverlay ? tfrCount : "Off"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Nearby SUA</div>
                  <div className="font-semibold">{showSuaOverlay ? suaCount : "Off"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Highest nearby obstacle</div>
                  <div className="font-semibold">{highestObstacle ? formatAltitude(highestObstacle.amslFt) : "--"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Max route terrain</div>
                  <div className="font-semibold">{terrainMaxElevationFt !== null ? formatAltitude(terrainMaxElevationFt) : "--"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Best diversion</div>
                  <div className="font-semibold">{bestDiversion ? bestDiversion.icao : "--"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {bestDiversion ? `${bestDiversion.distanceNm.toFixed(1)} NM · ${formatBearing(bestDiversion.bearingDeg)}` : "Start tracking to rank nearby airports."}
                  </div>
                  {bestDiversion?.scoreReasons?.length ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Best ranked for {bestDiversion.scoreReasons.join(", ")}.
                    </div>
                  ) : null}
                </div>
                <div className="rounded-lg border p-3 md:col-span-2">
                  <div className="text-xs text-muted-foreground">Terrain cueing</div>
                  <div className={`font-semibold ${terrainCueToneClass}`}>{terrainCueStatus}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {terrainReferenceSource
                      ? `Using ${terrainReferenceSource} ${formatAltitude(terrainReferenceAltitudeFt)} for map clearance cueing.`
                      : "Select a saved route with planned altitude or start GPS tracking for terrain cueing."}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                      Comfortable {terrainCueCounts.comfortable > 0 ? terrainCueCounts.comfortable : ""}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      Tight {terrainCueCounts.caution > 0 ? terrainCueCounts.caution : ""}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
                      Warning {terrainCueCounts.warning > 0 ? terrainCueCounts.warning : ""}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Active route overlay</CardTitle>
                <CardDescription>Keep your saved planned route visible while tracking live position and terrain context.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isAuthenticated ? (
                  <div className="text-sm text-muted-foreground">
                    Sign in to load saved flight plans as a live route overlay.
                  </div>
                ) : savedPlansQuery.isLoading ? (
                  <div className="text-sm text-muted-foreground">Loading saved routes...</div>
                ) : selectedPlan ? (
                  <>
                    <div className="rounded-lg border p-3">
                      <div className="font-medium">{selectedPlan.title || `${selectedPlan.departure} to ${selectedPlan.destination}`}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{routeSummaryText}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">{selectedPlan.filingFlightRules || "VFR"}</Badge>
                        <Badge variant="outline">{selectedPlan.filingStatus || "draft"}</Badge>
                        <Badge variant="secondary">{routePoints.length} route points resolved</Badge>
                      </div>
                    </div>
                    {routeProgress ? (
                      <div className="rounded-lg border p-3 space-y-3">
                        <div className="font-medium">Live route progress</div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border bg-muted/30 p-3">
                            <div className="text-xs text-muted-foreground">Route remaining</div>
                            <div className="font-semibold">{routeProgress.remainingRouteNm.toFixed(1)} NM</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Direct to destination {routeProgress.directToDestinationNm.toFixed(1)} NM
                            </div>
                          </div>
                          <div className="rounded-lg border bg-muted/30 p-3">
                            <div className="text-xs text-muted-foreground">Estimated arrival</div>
                            <div className="font-semibold">{formatEtaLocal(routeProgress.etaIso)}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Based on current speed {formatSpeed(ownship?.speedKt ?? null)}
                            </div>
                          </div>
                          <div className="rounded-lg border bg-muted/30 p-3">
                            <div className="text-xs text-muted-foreground">Next route point</div>
                            <div className="font-semibold">{routeProgress.nextWaypoint?.icao || selectedPlan.destination}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Active leg {routeProgress.activeLegIndex + 1} of {Math.max(routePoints.length - 1, 1)}
                            </div>
                          </div>
                          <div className="rounded-lg border bg-muted/30 p-3">
                            <div className="text-xs text-muted-foreground">Off-route deviation</div>
                            <div className={`font-semibold ${routeProgress.offRouteNm >= 2 ? "text-red-700" : routeProgress.offRouteNm >= 0.75 ? "text-amber-700" : "text-emerald-700"}`}>
                              {routeProgress.offRouteNm.toFixed(1)} NM
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Progress {Math.round(routeProgress.progressPct)}% · flown {routeProgress.distanceFlownNm.toFixed(1)} of {routeProgress.totalRouteNm.toFixed(1)} NM
                            </div>
                          </div>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-sky-600 transition-all"
                            style={{ width: `${Math.max(3, Math.min(100, routeProgress.progressPct))}%` }}
                          />
                        </div>
                      </div>
                    ) : selectedPlan && ownship ? (
                      <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                        RSF needs at least two resolved route points to calculate live route progress for this plan.
                      </div>
                    ) : null}
                    {routePoints.length > 0 ? (
                      <div className="space-y-2">
                        {terrainProfileQuery.isLoading ? (
                          <div className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">Loading terrain profile...</div>
                        ) : null}
                        {terrainProfileQuery.error ? (
                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              {terrainProfileQuery.error instanceof Error ? terrainProfileQuery.error.message : "Terrain profile unavailable."}
                            </AlertDescription>
                          </Alert>
                        ) : null}
                        {terrainProfileQuery.data ? (
                          <div className="rounded-lg border p-3 space-y-3">
                            <div className="font-medium">USGS terrain profile</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {terrainProfileQuery.data.sampledPointCount} samples · highest terrain {formatAltitude(terrainProfileQuery.data.maxElevationFt)}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              <Badge variant="outline">
                                Ref {terrainReferenceSource ? `${terrainReferenceSource} ${formatAltitude(terrainReferenceAltitudeFt)}` : "none"}
                              </Badge>
                              <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                                Comfortable {terrainCueCounts.comfortable}
                              </Badge>
                              <Badge variant="outline" className="border-amber-200 text-amber-700">
                                Tight {terrainCueCounts.caution}
                              </Badge>
                              <Badge variant="outline" className="border-red-200 text-red-700">
                                Warning {terrainCueCounts.warning}
                              </Badge>
                            </div>
                            <div className="grid gap-2 md:grid-cols-2">
                              <div className="rounded-lg border bg-muted/30 p-3">
                                <div className="text-xs text-muted-foreground">Worst clearance</div>
                                <div className={`font-semibold ${terrainCueToneClass}`}>{terrainClearanceHeadline}</div>
                                <div className="mt-1 text-xs text-muted-foreground">{terrainClearanceAdvisory}</div>
                              </div>
                              {worstTerrainSegment ? (
                                <div className="rounded-lg border bg-muted/30 p-3">
                                  <div className="text-xs text-muted-foreground">Highest-risk stretch</div>
                                  <div className="font-semibold">
                                    Segment {worstTerrainSegment.index + 1} of {terrainCueSegments.length}
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    Highest terrain {formatAltitude(worstTerrainSegment.segment.maxElevationFt)} · clearance {formatClearance(worstTerrainSegment.segment.clearanceFt)}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                            {terrainProfileChart ? (
                              <div className="rounded-lg border bg-muted/20 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-medium">Vertical profile</div>
                                  <div className="text-xs text-muted-foreground">
                                    Terrain vs {terrainReferenceSource ? `${terrainReferenceSource} ${formatAltitude(terrainReferenceAltitudeFt)}` : "reference altitude"}
                                  </div>
                                </div>
                                <div className="mt-3 overflow-hidden rounded-md border bg-background">
                                  <svg
                                    viewBox={`0 0 ${terrainProfileChart.chartWidth} ${terrainProfileChart.chartHeight}`}
                                    className="h-40 w-full"
                                    role="img"
                                    aria-label="Terrain profile chart"
                                  >
                                    <rect width={terrainProfileChart.chartWidth} height={terrainProfileChart.chartHeight} fill="transparent" />
                                    {terrainProfileChart.yTicks.map((tick) => (
                                      <g key={`terrain-tick-${tick.altitudeFt}`}>
                                        <line
                                          x1={terrainProfileChart.padding.left}
                                          x2={terrainProfileChart.chartWidth - terrainProfileChart.padding.right}
                                          y1={tick.y}
                                          y2={tick.y}
                                          stroke="currentColor"
                                          strokeOpacity="0.12"
                                          strokeDasharray="4 4"
                                        />
                                        <text
                                          x={terrainProfileChart.chartWidth - terrainProfileChart.padding.right - 2}
                                          y={tick.y - 4}
                                          textAnchor="end"
                                          fontSize="10"
                                          fill="currentColor"
                                          opacity="0.65"
                                        >
                                          {Math.round(tick.altitudeFt).toLocaleString()} ft
                                        </text>
                                      </g>
                                    ))}
                                    <polygon points={terrainProfileChart.terrainArea} fill="#c084fc" fillOpacity="0.22" />
                                    <polyline
                                      points={terrainProfileChart.terrainLine}
                                      fill="none"
                                      stroke="#7c3aed"
                                      strokeWidth="2"
                                      strokeLinejoin="round"
                                      strokeLinecap="round"
                                    />
                                    {terrainProfileChart.referenceY != null ? (
                                      <line
                                        x1={terrainProfileChart.padding.left}
                                        x2={terrainProfileChart.chartWidth - terrainProfileChart.padding.right}
                                        y1={terrainProfileChart.referenceY}
                                        y2={terrainProfileChart.referenceY}
                                        stroke="#2563eb"
                                        strokeWidth="2"
                                        strokeDasharray="6 4"
                                      />
                                    ) : null}
                                    {terrainProfileChart.hotSpots.map((hotSpot) => (
                                      <g key={`terrain-profile-hotspot-${hotSpot.index}`}>
                                        <circle
                                          cx={hotSpot.x}
                                          cy={hotSpot.y}
                                          r="4"
                                          fill={
                                            hotSpot.segment.risk === "warning"
                                              ? "#dc2626"
                                              : hotSpot.segment.risk === "caution"
                                                ? "#f59e0b"
                                                : "#16a34a"
                                          }
                                          stroke="#ffffff"
                                          strokeWidth="1.5"
                                        />
                                      </g>
                                    ))}
                                    <text
                                      x={terrainProfileChart.padding.left}
                                      y={terrainProfileChart.chartHeight - 6}
                                      fontSize="10"
                                      fill="currentColor"
                                      opacity="0.65"
                                    >
                                      Departure
                                    </text>
                                    <text
                                      x={terrainProfileChart.chartWidth - terrainProfileChart.padding.right}
                                      y={terrainProfileChart.chartHeight - 6}
                                      textAnchor="end"
                                      fontSize="10"
                                      fill="currentColor"
                                      opacity="0.65"
                                    >
                                      Destination
                                    </text>
                                  </svg>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
                                    Terrain profile
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <span className="h-0.5 w-4 bg-blue-600" style={{ borderTop: "2px dashed currentColor" }} />
                                    Reference altitude
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
                                    Hot spots
                                  </span>
                                </div>
                              </div>
                            ) : null}
                            {terrainHotSpots.length > 0 ? (
                              <div className="space-y-2">
                                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Terrain hot spots
                                </div>
                                {terrainHotSpots.map((item, hotSpotIndex) => (
                                  <div key={`terrain-hot-spot-${item.index}`} className="rounded-lg border px-3 py-2 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-2 font-medium">
                                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-xs font-semibold">
                                          {hotSpotIndex + 1}
                                        </span>
                                        <span>
                                          {item.segment.risk === "warning"
                                            ? "Warning segment"
                                            : item.segment.risk === "caution"
                                              ? "Tight clearance segment"
                                              : "Comfortable segment"}
                                        </span>
                                      </div>
                                      <Badge variant="outline">{item.progressLabel}</Badge>
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      Highest terrain {formatAltitude(item.segment.maxElevationFt)} · clearance {formatClearance(item.segment.clearanceFt)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {routePoints.map((point) => (
                          <div key={`point-${point.icao}-${point.lat}-${point.lon}`} className="rounded-lg border px-3 py-2 text-sm">
                            <div className="font-medium">{point.icao}</div>
                            <div className="text-muted-foreground">{point.label.replace(`${point.icao} · `, "")}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        RSF could not resolve route airports from this plan yet.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Choose a saved flight plan to overlay it on the live map.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Operational status</CardTitle>
                <CardDescription>What this live map can and cannot do right now.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Navigation className="mt-0.5 h-4 w-4 text-sky-600" />
                  <div>
                    <div className="font-medium">Device GPS ownship is live</div>
                    <div className="text-muted-foreground">RSF can follow your current position from browser/device geolocation.</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Radar className="mt-0.5 h-4 w-4 text-sky-600" />
                  <div>
                    <div className="font-medium">Traffic and weather overlays are live</div>
                    <div className="text-muted-foreground">Nearby traffic comes from the RSF ADS-B proxy; radar and cloud overlays are available on-map.</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Radio className="mt-0.5 h-4 w-4 text-amber-600" />
                  <div>
                    <div className="font-medium">Portable receiver ingest is next</div>
                    <div className="text-muted-foreground">
                      RSF currently provides receiver setup guidance, but direct GDL-90 receiver ingestion is not yet wired in.
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Cloud className="mt-0.5 h-4 w-4 text-amber-600" />
                  <div>
                    <div className="font-medium">Terrain and obstacles are in first-pass beta</div>
                    <div className="text-muted-foreground">
                      RSF now shows obstacle proximity plus terrain clearance cueing on the route. The next step is richer
                      map shading and more advanced hazard logic.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Closest traffic</CardTitle>
                <CardDescription>Sorted by distance from your current position.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {trafficQuery.isLoading ? (
                  <div className="text-sm text-muted-foreground">Loading nearby traffic...</div>
                ) : trafficQuery.error ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {trafficQuery.error instanceof Error ? trafficQuery.error.message : "Unable to load nearby traffic."}
                    </AlertDescription>
                  </Alert>
                ) : trafficTargets.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Start tracking and wait for a position fix to load nearby traffic.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {trafficTargets.slice(0, 10).map((target) => (
                      <div key={`list-${target.id}`} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{target.callsign || target.tail || target.id}</div>
                            <div className="text-xs text-muted-foreground">
                              {target.category || "Traffic"} {target.onGround ? "· On ground" : ""}
                            </div>
                          </div>
                          <Badge variant="outline">
                            {target.distanceNm ? `${target.distanceNm.toFixed(1)} NM` : "--"}
                          </Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>Altitude: <span className="font-medium text-foreground">{formatAltitude(target.altitudeFt)}</span></div>
                          <div>Relative: <span className="font-medium text-foreground">{formatSignedAltitude(target.relativeAltitudeFt)}</span></div>
                          <div>Speed: <span className="font-medium text-foreground">{formatSpeed(target.groundSpeedKt)}</span></div>
                          <div>Track: <span className="font-medium text-foreground">{formatHeading(target.trackDeg)}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Diversion candidates</CardTitle>
                <CardDescription>Nearest practical airports around ownship with runway and frequency context.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {nearbyDiversionsQuery.isLoading ? (
                  <div className="text-sm text-muted-foreground">Loading nearby diversion airports...</div>
                ) : nearbyDiversionsQuery.error ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {nearbyDiversionsQuery.error instanceof Error ? nearbyDiversionsQuery.error.message : "Unable to load diversion airports."}
                    </AlertDescription>
                  </Alert>
                ) : diversionCandidates.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Start tracking to load nearby airports suitable for quick diversion review.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {diversionCandidates.map((airport, index) => (
                      <div key={`diversion-list-${airport.icao}-${index}`} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 font-medium">
                              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-xs font-semibold">
                                {index + 1}
                              </span>
                              <span>{airport.icao}</span>
                              {airport.name ? <span className="text-muted-foreground">· {airport.name}</span> : null}
                            </div>
                            {(airport.city || airport.state) ? (
                              <div className="text-xs text-muted-foreground">
                                {[airport.city, airport.state].filter(Boolean).join(", ")}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="outline">{airport.distanceNm.toFixed(1)} NM</Badge>
                            {index === 0 ? <Badge>Best ranked</Badge> : null}
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>
                            Bearing: <span className="font-medium text-foreground">{formatBearing(airport.bearingDeg)}</span>
                          </div>
                          <div>
                            Max runway: <span className="font-medium text-foreground">{airport.maxRunwayFt ? `${airport.maxRunwayFt.toLocaleString()} ft` : "--"}</span>
                          </div>
                          <div>
                            Weather: <span className="font-medium text-foreground">{airport.flightCategory || "--"}</span>
                          </div>
                          <div>
                            Field type: <span className="font-medium text-foreground">{airport.towered ? "Towered" : "Non-towered"}</span>
                          </div>
                          <div className="col-span-2">
                            Surfaces: <span className="font-medium text-foreground">{airport.surfaces.length > 0 ? airport.surfaces.join(", ") : "--"}</span>
                          </div>
                          {airport.runwayAdvisory ? (
                            <div className="col-span-2">
                              Best runway/wind: <span className="font-medium text-foreground">{airport.runwayAdvisory.runway}</span>
                              <span className="font-medium text-foreground">
                                {airport.runwayAdvisory.headwindKt !== null ? ` · HW ${airport.runwayAdvisory.headwindKt.toFixed(0)} kt` : ""}
                                {airport.runwayAdvisory.crosswindKt !== null ? ` · XW ${airport.runwayAdvisory.crosswindKt.toFixed(0)} kt` : ""}
                              </span>
                            </div>
                          ) : null}
                        </div>
                        {airport.scoreReasons.length > 0 ? (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Ranked for {airport.scoreReasons.join(", ")}.
                          </div>
                        ) : null}
                        {airport.frequencySummary.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            {airport.frequencySummary.map((item, freqIndex) => (
                              <Badge key={`diversion-freq-${airport.icao}-${freqIndex}`} variant="secondary" className="font-normal">
                                {item.type || item.description || "Freq"} {item.frequencyMhz ? `· ${item.frequencyMhz.toFixed(3)}` : ""}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-muted-foreground">No airport frequencies cached yet for this field.</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Divert now short list</CardTitle>
                <CardDescription>Closest immediate diversion options with acceptable runway, weather, and wind context.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {nearbyDiversionsQuery.isLoading ? (
                  <div className="text-sm text-muted-foreground">Scoring immediate diversion options...</div>
                ) : nearbyDiversionsQuery.error ? (
                  <div className="text-sm text-muted-foreground">Diversion short list unavailable while airport data reloads.</div>
                ) : immediateDiversions.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No airport currently meets the immediate-diversion screen. Use the ranked list above for the next-best field.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {immediateDiversions.map((airport, index) => (
                      <div key={`immediate-diversion-${airport.icao}-${index}`} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">
                              {airport.icao}{airport.name ? ` · ${airport.name}` : ""}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {airport.distanceNm.toFixed(1)} NM · {formatBearing(airport.bearingDeg)} · {airport.maxRunwayFt ? `${airport.maxRunwayFt.toLocaleString()} ft` : "--"}
                            </div>
                          </div>
                          {index === 0 ? <Badge>Primary</Badge> : <Badge variant="outline">Alternate</Badge>}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Chosen for {airport.immediateReasons.join(", ")}.
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <Badge variant="secondary">{airport.flightCategory || "Weather unk"}</Badge>
                          <Badge variant="secondary">{airport.towered ? "Towered" : "Non-towered"}</Badge>
                          {airport.runwayAdvisory ? (
                            <Badge variant="secondary">
                              {airport.runwayAdvisory.runway}
                              {airport.runwayAdvisory.crosswindKt !== null ? ` · XW ${airport.runwayAdvisory.crosswindKt.toFixed(0)} kt` : ""}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hazard watch</CardTitle>
                <CardDescription>Nearby restrictions, obstacles, and terrain context around your current position and selected route.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="rounded-lg border p-3">
                  <div className="font-medium text-foreground">TFR overlay</div>
                  <div>{showTfrOverlay ? `${tfrCount} nearby TFR features loaded.` : "Overlay turned off."}</div>
                  {tfrQuery.error ? <div className="text-red-600">{tfrQuery.error instanceof Error ? tfrQuery.error.message : "TFR load failed."}</div> : null}
                </div>
                <div className="rounded-lg border p-3">
                  <div className="font-medium text-foreground">Special use airspace</div>
                  <div>{showSuaOverlay ? `${suaCount} nearby SUA features loaded.` : "Overlay turned off."}</div>
                  {suaQuery.error ? <div className="text-red-600">{suaQuery.error instanceof Error ? suaQuery.error.message : "SUA load failed."}</div> : null}
                </div>
                <div className="rounded-lg border p-3">
                  <div className="font-medium text-foreground">FAA obstacles</div>
                  <div>{showObstacleOverlay ? `${obstacleCount} nearby obstacles loaded from the FAA Daily DOF.` : "Overlay turned off."}</div>
                  {highestObstacle ? (
                    <div>
                      Highest nearby obstacle: {formatAltitude(highestObstacle.amslFt)}
                      {highestObstacle.distanceNm ? ` · ${highestObstacle.distanceNm.toFixed(1)} NM` : ""}
                    </div>
                  ) : null}
                  {obstacleQuery.error ? <div className="text-red-600">{obstacleQuery.error instanceof Error ? obstacleQuery.error.message : "Obstacle load failed."}</div> : null}
                </div>
                <div className="rounded-lg border p-3">
                  <div className="font-medium text-foreground">USGS terrain</div>
                  <div>
                    {terrainProfileQuery.data
                      ? `Route terrain profile loaded. Max terrain ${formatAltitude(terrainProfileQuery.data.maxElevationFt)}.`
                      : "Terrain profile appears when a saved route overlay is selected."}
                  </div>
                  {terrainProfileQuery.data ? (
                    <div className={`mt-1 ${terrainCueToneClass}`}>
                      {terrainClearanceHeadline} · {terrainClearanceAdvisory}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-lg border p-3">
                  <div className="font-medium text-foreground">Next integrations</div>
                  <div>- Vertical profile visualization and top-of-climb style route context</div>
                  <div>- Terrain labels and corridor hotspot annotations directly on the map</div>
                  <div>- Leidos route briefings linked from the active plan</div>
                  <div>- Direct portable ADS-B receiver ingestion for stronger in-flight traffic fidelity</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
