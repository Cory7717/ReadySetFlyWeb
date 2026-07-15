import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, MapContainer, Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { apiUrl } from "@/lib/api";
import { LeafletAviationBaseLayers } from "@/map/leaflet/LeafletAviationBaseLayers";
import {
  RSF_ROUTE_HALO_LINE_STYLE,
  RSF_TERRAIN_RISK_STYLES,
  RSF_TERRAIN_SURFACE_STYLES,
  type RsfLeafletMapStyle,
} from "@/map/rsfMapSpec";
import type {
  Planner2DMapProps,
  PlannerLegHealthMarker,
  PlannerPoint,
  PlannerTerrainHotSpot,
  PlannerTerrainSegment,
} from "@/components/flight-planner/plannerMapTypes";

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
  validTime: string | null;
  dataBasedOn: string | null;
  warnings: string[];
};

const WINDS_ALOFT_LEVELS = [3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000];

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const terrainRiskStyles = RSF_TERRAIN_RISK_STYLES;
const terrainSurfaceStyles = RSF_TERRAIN_SURFACE_STYLES;
const plannerTooltipClassName = "rounded-[0.85rem] border border-[#5d6f85]/22 bg-[linear-gradient(180deg,rgba(23,28,36,0.98),rgba(11,15,21,0.98))] px-2.5 py-1.5 text-xs font-semibold text-[#F5F8FC] shadow-[0_14px_30px_-22px_rgba(0,0,0,0.92)]";

const buildTerrainHotSpotIcon = (risk: PlannerTerrainHotSpot["risk"], rank: number) => {
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

const buildLegHealthIcon = (status: PlannerLegHealthMarker["status"]) => {
  const tone = status === "warning" ? "#dc2626" : status === "caution" ? "#f59e0b" : "#2563eb";
  const text = status === "warning" ? "!" : status === "caution" ? "~" : "OK";
  return L.divIcon({
    className: "",
    html: `
      <div style="display:flex;align-items:center;justify-content:center;min-width:26px;height:18px;padding:0 6px;border-radius:9999px;background:${tone};border:2px solid #ffffff;color:#ffffff;font-size:10px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.2);">
        ${text}
      </div>
    `,
    iconSize: [28, 18],
    iconAnchor: [14, 9],
  });
};

function FitBounds({ points, mapStyle }: { points: PlannerPoint[]; mapStyle: RsfLeafletMapStyle }) {
  const map = useMap();
  const routeKey = points.map((point) => `${point.icao}:${point.lat.toFixed(5)},${point.lon.toFixed(5)}`).join("|");
  const boundsPoints = useMemo(() => points.map((point) => [point.lat, point.lon] as [number, number]), [routeKey]);

  useEffect(() => {
    if (boundsPoints.length === 0) return;
    if (!map.getPane("mapPane")) return;
    const bounds = L.latLngBounds(boundsPoints);
    const raf = requestAnimationFrame(() => {
      try {
        map.fitBounds(bounds.pad(0.2));
        if (mapStyle === "sectional") {
          const zoom = map.getZoom();
          if (zoom > 12) map.setZoom(12);
          if (zoom < 2) map.setZoom(2);
        }
      } catch {
        // Map may be unmounted during transitions; ignore.
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [map, routeKey, boundsPoints, mapStyle]);

  return null;
}

function MapStyleController({ mapStyle }: { mapStyle: RsfLeafletMapStyle }) {
  const map = useMap();

  useEffect(() => {
    if (!map.getPane("mapPane")) return;
    const raf = requestAnimationFrame(() => {
      try {
        if (mapStyle === "sectional") {
          map.setMinZoom(2);
          map.setMaxZoom(12);
          if (map.getZoom() < 2) {
            map.setZoom(2);
          }
          return;
        }
        map.setMinZoom(2);
        map.setMaxZoom(18);
      } catch {
        // Map may be unmounted during transitions; ignore.
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [map, mapStyle]);

  return null;
}

function MapZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();

  useEffect(() => {
    onZoomChange(map.getZoom());
    const handle = () => onZoomChange(map.getZoom());
    map.on("zoomend", handle);
    return () => {
      map.off("zoomend", handle);
    };
  }, [map, onZoomChange]);

  return null;
}

function MapCenterTracker({ onCenterChange }: { onCenterChange: (center: L.LatLng) => void }) {
  const map = useMap();

  useEffect(() => {
    onCenterChange(map.getCenter());
    const handle = () => onCenterChange(map.getCenter());
    map.on("moveend", handle);
    return () => {
      map.off("moveend", handle);
    };
  }, [map, onCenterChange]);

  return null;
}

function resolveWindsAltitude(requested: number | null | undefined) {
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

function buildWindIcon(directionDeg: number, speedKt: number) {
  const arrowDir = (directionDeg + 180) % 360;
  const size = Math.min(22, Math.max(16, Math.round(speedKt / 3) + 12));
  const html = `
    <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
      <svg width="${size}" height="${size}" viewBox="0 0 18 18" style="transform: rotate(${arrowDir}deg); transform-origin: 50% 50%;">
        <path d="M9 2 L9 14 M6 11 L9 14 L12 11" stroke="#0284c7" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
  `;

  return L.divIcon({
    html,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}


function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = rKm * c;
  return km * 0.539957;
}

function WindsAloftController({
  enabled,
  altitudeFt,
  routeBounds,
  onUpdate,
  onError,
}: {
  enabled: boolean;
  altitudeFt: number;
  routeBounds: L.LatLngBounds | null;
  onUpdate: (points: WindsAloftPoint[], meta: WindsAloftMeta | null) => void;
  onError: (message: string | null) => void;
}) {
  const map = useMap();

  const buildBbox = (bounds: L.LatLngBounds, minSpanDeg: number, padDeg: number) => {
    const south = bounds.getSouth() - padDeg;
    const north = bounds.getNorth() + padDeg;
    const west = bounds.getWest() - padDeg;
    const east = bounds.getEast() + padDeg;
    const latSpan = Math.max(minSpanDeg, north - south);
    const lonSpan = Math.max(minSpanDeg, east - west);
    const latCenter = (north + south) / 2;
    const lonCenter = (east + west) / 2;
    const southAdj = latCenter - latSpan / 2;
    const northAdj = latCenter + latSpan / 2;
    const westAdj = lonCenter - lonSpan / 2;
    const eastAdj = lonCenter + lonSpan / 2;
    return [southAdj, westAdj, northAdj, eastAdj]
      .map((value) => value.toFixed(4))
      .join(",");
  };

  useEffect(() => {
    if (!enabled) {
      onUpdate([], null);
      onError(null);
      return;
    }

    let abort: AbortController | null = null;
    let timer: number | null = null;

    const fetchData = async () => {
      if (!enabled) return;
      const bounds = map.getBounds();

      const runFetch = async (bbox: string) => {
        if (abort) abort.abort();
        abort = new AbortController();
        const res = await fetch(
          apiUrl(`/api/aviation/winds-temps?altitude=${altitudeFt}&bbox=${bbox}`),
          { credentials: "include", signal: abort.signal }
        );
        if (!res.ok) {
          throw new Error(`Winds aloft unavailable (${res.status})`);
        }
        return res.json();
      };

      try {
        const primaryBbox = buildBbox(bounds, 4, 0.6);
        let payload = await runFetch(primaryBbox);
        if ((payload?.stations?.length ?? 0) === 0 && routeBounds) {
          const routeBbox = buildBbox(routeBounds, 6, 1.2);
          payload = await runFetch(routeBbox);
        }
        if ((payload?.stations?.length ?? 0) === 0) {
          const expandedBbox = buildBbox(bounds, 12, 3.5);
          payload = await runFetch(expandedBbox);
        }
        onUpdate(payload?.stations ?? [], {
          altitudeFt: payload?.altitudeFt ?? altitudeFt,
          validTime: payload?.validTime ?? null,
          dataBasedOn: payload?.dataBasedOn ?? null,
          warnings: Array.isArray(payload?.warnings) ? payload.warnings : [],
        });
        onError(null);
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        onUpdate([], null);
        onError("Winds aloft data unavailable.");
      }
    };

    const schedule = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(fetchData, 350);
    };

    fetchData();
    map.on("moveend", schedule);

    return () => {
      map.off("moveend", schedule);
      if (timer) window.clearTimeout(timer);
      if (abort) abort.abort();
    };
  }, [enabled, altitudeFt, map, routeBounds, onUpdate, onError]);

  return null;
}

export default function PlannerMap({
  points,
  heightClassName = "h-[380px]",
  mapStyle = "standard",
  plannedAltitudeFt,
  windsAltitudeFt,
  airportLabelMode = "icao",
  terrainSegments = [],
  terrainHotSpots = [],
  legHealthMarkers = [],
  tfrFeatures = [],
  showTfrOverlay = false,
  onSelectTfr,
}: Planner2DMapProps) {
  const center: [number, number] = points.length
    ? [points[0].lat, points[0].lon]
    : [39.5, -98.35];
  const showRadar = mapStyle === "radar";
  const showWinds = mapStyle === "winds";
  const showClouds = mapStyle === "clouds";
  const initialZoom = mapStyle === "sectional" ? 4 : (points.length ? 6 : 4);
  const [mapZoom, setMapZoom] = useState(initialZoom);
  const [mapCenter, setMapCenter] = useState<L.LatLng | null>(null);
  const showCloudsConus = showClouds;
  const [radarFrames, setRadarFrames] = useState<string[]>([]);
  const [radarFrameIndex, setRadarFrameIndex] = useState(0);
  const [radarError, setRadarError] = useState(false);
  const [radarFallbackActive, setRadarFallbackActive] = useState(false);
  const radarTimerRef = useRef<number | null>(null);
  const gibsDate = useMemo(
    () => new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString().slice(0, 10),
    []
  );
  const [windsAloftPoints, setWindsAloftPoints] = useState<WindsAloftPoint[]>([]);
  const [windsAloftMeta, setWindsAloftMeta] = useState<WindsAloftMeta | null>(null);
  const [windsAloftError, setWindsAloftError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const routeBounds = useMemo(
    () => (points.length > 0 ? L.latLngBounds(points.map((p) => [p.lat, p.lon])) : null),
    [points]
  );
  const windsAltitude = useMemo(
    () => resolveWindsAltitude(windsAltitudeFt ?? plannedAltitudeFt ?? null),
    [plannedAltitudeFt, windsAltitudeFt]
  );

  const radarTileUrl = useMemo(() => {
    if (!showRadar || radarFrames.length === 0) return "";
    const frame = radarFrames[radarFrameIndex];
    const normalizedFrame = frame.replace(/^\/??v2\/radar\//, "");
    return apiUrl(`/api/tiles/rainviewer/v2/radar/${normalizedFrame}/256/{z}/{x}/{y}/2/1_1.png`);
  }, [showRadar, radarFrames, radarFrameIndex]);

  const cloudTileUrl = useMemo(() => {
    if (!showCloudsConus) return "";
    return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
  }, [showCloudsConus, gibsDate]);

  useEffect(() => {
    if (!mapRef.current) return;
    const timer = window.setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [isFullscreen]);


  useEffect(() => {
    if (!showRadar) {
      setRadarFrames([]);
      setRadarFrameIndex(0);
      setRadarError(false);
      setRadarFallbackActive(false);
      return;
    }

    let isActive = true;
    const loadRadarFrames = async () => {
      try {
        const response = await fetch(apiUrl("/api/weather/rainviewer/frames"), { credentials: "include" });
        if (!response.ok) {
          throw new Error("Failed to load radar frames");
        }
        const data = await response.json();
        const frames = (Array.isArray(data?.frames) ? data.frames : []).filter(Boolean) as string[];

        if (!isActive) return;
        setRadarFrames(frames);
        setRadarFrameIndex(frames.length > 0 ? frames.length - 1 : 0);
        setRadarError(frames.length === 0);
        setRadarFallbackActive(frames.length === 0);
      } catch (error) {
        console.error("Radar frame fetch failed:", error);
        if (isActive) {
          setRadarFrames([]);
          setRadarFrameIndex(0);
          setRadarError(true);
          setRadarFallbackActive(true);
        }
      }
    };

    loadRadarFrames();

    return () => {
      isActive = false;
    };
  }, [showRadar]);

  useEffect(() => {
    if (!showRadar || radarFrames.length === 0) {
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
      setRadarFrameIndex((prev) => (prev + 1) % radarFrames.length);
    }, 1600);

    return () => {
      if (radarTimerRef.current) {
        window.clearInterval(radarTimerRef.current);
        radarTimerRef.current = null;
      }
    };
  }, [showRadar, radarFrames.length]);


  const handleWindsUpdate = useCallback((points: WindsAloftPoint[], meta: WindsAloftMeta | null) => {
    setWindsAloftPoints(points);
    setWindsAloftMeta(meta);
  }, []);

  const handleWindsError = useCallback((message: string | null) => {
    setWindsAloftError(message);
  }, []);

  const visibleWindsPoints = useMemo(() => {
    if (!showWinds) return [];
    if (mapZoom < 4) {
      return windsAloftPoints.filter((_, index) => index % 3 === 0);
    }
    if (mapZoom < 5) {
      return windsAloftPoints.filter((_, index) => index % 2 === 0);
    }
    return windsAloftPoints;
  }, [mapZoom, showWinds, windsAloftPoints]);

  const nearestWinds = useMemo(() => {
    if (!showWinds || windsAloftPoints.length === 0) return [] as { point: WindsAloftPoint; distanceNm: number }[];
    if (!routeBounds) {
      return windsAloftPoints.slice(0, 6).map((point) => ({ point, distanceNm: Number.POSITIVE_INFINITY }));
    }
    const center = routeBounds.getCenter();
    return [...windsAloftPoints]
      .map((point) => ({
        point,
        distanceNm: distanceNm(center.lat, center.lng, point.lat, point.lon),
      }))
      .sort((a, b) => a.distanceNm - b.distanceNm)
      .slice(0, 6);
  }, [routeBounds, showWinds, windsAloftPoints]);

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-[1000] bg-[rgba(7,9,12,0.9)] p-3"
          : "space-y-2"
      }
    >
      <div
        className={
          isFullscreen
            ? "relative h-full w-full overflow-hidden rounded-[1.2rem] border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(18,22,28,0.98),rgba(9,12,16,0.99))]"
            : `relative overflow-hidden rounded-[1.2rem] border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(18,22,28,0.98),rgba(9,12,16,0.99))] ${heightClassName}`
        }
      >
        {mapStyle === "sectional" && !isFullscreen && (
          <div className="pointer-events-none absolute left-3 top-3 z-[1100] max-w-[calc(100%-9rem)] truncate rounded-full border border-[#5d6f85]/24 bg-[rgba(9,12,17,0.78)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d8e6f6] shadow-[0_16px_28px_-24px_rgba(0,0,0,0.88)] sm:max-w-[60%]">
            Leaflet Sectional · Direct FAA WMS
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsFullscreen((prev) => !prev)}
          className="absolute right-3 top-3 z-[1100] rounded-[0.9rem] border border-[#5d6f85]/30 bg-[linear-gradient(180deg,rgba(22,28,36,0.98),rgba(13,17,22,0.98))] px-3 py-1.5 text-xs font-semibold text-[#E8EDF4] shadow-[0_16px_28px_-24px_rgba(0,0,0,0.88)] transition-all duration-200 hover:-translate-y-px hover:border-[#6f86a7]/35 hover:bg-[linear-gradient(180deg,rgba(28,35,46,0.98),rgba(16,21,28,0.98))]"
        >
          {isFullscreen ? "Close full screen" : "Full screen"}
        </button>
        <MapContainer
          center={center}
          zoom={initialZoom}
          scrollWheelZoom
          className="h-full w-full rounded-xl"
          ref={mapRef}
        >
        <LeafletAviationBaseLayers
          mapStyle={mapStyle}
          radarTileUrl={showRadar ? radarTileUrl : ""}
          radarFallbackActive={showRadar && (radarFallbackActive || (!radarTileUrl && radarError))}
          onRadarTileError={() => {
            setRadarError(true);
            setRadarFallbackActive(true);
            setRadarFrames([]);
            setRadarFrameIndex(0);
          }}
          cloudTileUrl={showCloudsConus ? cloudTileUrl : ""}
        />
        {showWinds && (
          <WindsAloftController
            enabled={showWinds}
            altitudeFt={windsAltitude}
            routeBounds={routeBounds}
            onUpdate={handleWindsUpdate}
            onError={handleWindsError}
          />
        )}
        {showWinds && visibleWindsPoints.map((point) => {
          if (point.windDir === null || point.windSpeed === null) return null;
          const icon = buildWindIcon(point.windDir, point.windSpeed);
          const tempLabel = Number.isFinite(point.tempC ?? NaN) ? `, ${point.tempC}C` : "";
          const stationLabel = point.icao ?? point.stationId;
          return (
            <Marker
              key={`${point.stationId}-${point.lat}-${point.lon}`}
              position={[point.lat, point.lon]}
              icon={icon}
            >
              <Tooltip
                direction="top"
                offset={[0, -12]}
                className={plannerTooltipClassName}
                opacity={1}
              >
                {stationLabel}: {Math.round(point.windDir)} deg / {Math.round(point.windSpeed)} kt{tempLabel}
              </Tooltip>
            </Marker>
          );
        })}
        <MapStyleController mapStyle={mapStyle} />
        {showTfrOverlay && tfrFeatures.length > 0 && (
          <GeoJSON
            key={`planner-tfr-${tfrFeatures.map((feature) => feature.id || feature.properties?.notamId || feature.properties?.title || "tfr").join("|")}`}
            data={{ type: "FeatureCollection", features: tfrFeatures } as any}
            style={(feature: any) => {
              const status = feature?.properties?.corridorStatus;
              const active = status === "active";
              return {
                color: active ? "#ef4444" : "#f59e0b",
                weight: active ? 2 : 1.5,
                opacity: 0.9,
                fillColor: active ? "#ef4444" : "#f59e0b",
                fillOpacity: active ? 0.16 : 0.1,
              };
            }}
            eventHandlers={{
              click: (event) => {
                const feature = (event as any).layer?.feature;
                if (feature && onSelectTfr) onSelectTfr(feature);
              },
            }}
            onEachFeature={(feature, layer) => {
              const props: any = feature?.properties || {};
              const label = props.notamId || props.title || props.reason || "TFR";
              layer.bindTooltip(String(label), {
                direction: "top",
                opacity: 1,
                className: plannerTooltipClassName,
              });
            }}
          />
        )}
        {terrainSegments.length > 0
          ? terrainSegments.map((segment, index) => (
              <Fragment key={`planner-terrain-segment-${index}`}>
                <Polyline
                  positions={segment.positions}
                  pathOptions={terrainSurfaceStyles[segment.risk]}
                />
                <Polyline
                  positions={segment.positions}
                  pathOptions={terrainRiskStyles[segment.risk]}
                >
                  <Tooltip
                    direction="top"
                    offset={[0, -12]}
                    className={plannerTooltipClassName}
                    opacity={1}
                  >
                    {segment.risk === "warning"
                      ? "Terrain warning"
                      : segment.risk === "caution"
                        ? "Tight clearance"
                        : "Comfortable clearance"}
                    {` · ${segment.clearanceFt != null ? `${Math.round(segment.clearanceFt).toLocaleString()} ft` : "--"}`}
                  </Tooltip>
                </Polyline>
              </Fragment>
            ))
          : points.length > 1 && (
              <Polyline
                positions={points.map((p) => [p.lat, p.lon])}
                pathOptions={RSF_ROUTE_HALO_LINE_STYLE}
              />
            )}
        {points.map((point) => (
          <Marker
            key={point.icao}
            position={[point.lat, point.lon]}
            icon={defaultIcon}
          >
            <Tooltip
              permanent={airportLabelMode !== "markers"}
              direction="top"
              offset={[0, -18]}
              className={plannerTooltipClassName}
              opacity={1}
            >
              {point.label ? `${point.icao} • ${point.label}` : point.icao}
            </Tooltip>
          </Marker>
        ))}
        {terrainHotSpots.map((hotSpot) => (
          <Marker
            key={`planner-terrain-hotspot-${hotSpot.rank}-${hotSpot.progressLabel}`}
            position={[hotSpot.lat, hotSpot.lon]}
            icon={buildTerrainHotSpotIcon(hotSpot.risk, hotSpot.rank)}
          >
            <Tooltip
              direction="top"
              offset={[0, -10]}
              className={plannerTooltipClassName}
              opacity={1}
            >
              Terrain hot spot {hotSpot.rank}
            </Tooltip>
          </Marker>
        ))}
        {legHealthMarkers.map((marker) => (
          <Marker
            key={`planner-leg-health-${marker.key}`}
            position={[marker.lat, marker.lon]}
            icon={buildLegHealthIcon(marker.status)}
          >
            <Tooltip
              direction="top"
              offset={[0, -10]}
              className={plannerTooltipClassName}
              opacity={1}
            >
              {marker.label}
              <div className="text-[11px] font-normal text-[#A9BBCD]">{marker.detail}</div>
            </Tooltip>
          </Marker>
        ))}
        <FitBounds points={points} mapStyle={mapStyle} />
        <MapZoomTracker onZoomChange={setMapZoom} />
        <MapCenterTracker onCenterChange={setMapCenter} />
        </MapContainer>
      </div>
      {showWinds && !isFullscreen && (
        <div className="text-xs text-[#A9BBCD]">
          NOAA AWC winds aloft at {windsAloftMeta?.altitudeFt ?? windsAltitude} ft.
          {windsAloftMeta?.validTime ? ` Valid ${windsAloftMeta.validTime}.` : ""}
          {windsAloftMeta?.warnings?.length ? ` ${windsAloftMeta.warnings.join(" ")}` : ""}
          {windsAloftError ? ` ${windsAloftError}` : ""}
        </div>
      )}
      {showWinds && !isFullscreen && nearestWinds.length > 0 && (
        <div className="grid gap-2 text-xs text-[#A9BBCD] md:grid-cols-2">
          {nearestWinds.map(({ point, distanceNm }) => (
            <div key={`${point.stationId}-${point.lat}`} className="flex items-center justify-between rounded-[0.9rem] border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(20,24,31,0.98),rgba(13,17,22,0.98))] px-2 py-1">
              <span className="font-semibold text-[#F5F8FC]">
                {point.icao || point.stationId}
              </span>
              <span>
                {Math.round(point.windDir ?? 0)} deg / {Math.round(point.windSpeed ?? 0)} kt · {Number.isFinite(distanceNm) ? `${distanceNm.toFixed(0)} nm` : "--"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
