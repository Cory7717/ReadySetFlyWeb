import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, WMSTileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { apiUrl } from "@/lib/api";

export type PlannerPoint = {
  icao: string;
  lat: number;
  lon: number;
};

type PlannerMapProps = {
  points: PlannerPoint[];
  heightClassName?: string;
  mapStyle?: "standard" | "sectional" | "radar" | "winds";
  plannedAltitudeFt?: number;
  windsAltitudeFt?: number;
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

function FitBounds({ points, mapStyle }: { points: PlannerPoint[]; mapStyle: "standard" | "sectional" | "radar" | "winds" }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (!map.getPane("mapPane")) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon]));
    const raf = requestAnimationFrame(() => {
      try {
        map.fitBounds(bounds.pad(0.2));
        if (mapStyle === "sectional") {
          const zoom = map.getZoom();
          if (zoom > 12) map.setZoom(12);
          if (zoom < 6) map.setZoom(6);
        }
      } catch {
        // Map may be unmounted during transitions; ignore.
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [map, points, mapStyle]);

  return null;
}

function MapStyleController({ mapStyle }: { mapStyle: "standard" | "sectional" | "radar" | "winds" }) {
  const map = useMap();

  useEffect(() => {
    if (!map.getPane("mapPane")) return;
    const raf = requestAnimationFrame(() => {
      try {
        if (mapStyle === "sectional") {
          map.setMinZoom(6);
          map.setMaxZoom(12);
          if (map.getZoom() < 6) {
            map.setZoom(6);
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

function WindsAloftController({
  enabled,
  altitudeFt,
  onUpdate,
  onError,
}: {
  enabled: boolean;
  altitudeFt: number;
  onUpdate: (points: WindsAloftPoint[], meta: WindsAloftMeta | null) => void;
  onError: (message: string | null) => void;
}) {
  const map = useMap();

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
      const bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ]
        .map((value) => value.toFixed(4))
        .join(",");

      if (abort) abort.abort();
      abort = new AbortController();

      try {
        const res = await fetch(
          apiUrl(`/api/aviation/winds-temps?altitude=${altitudeFt}&bbox=${bbox}`),
          { credentials: "include", signal: abort.signal }
        );
        if (!res.ok) {
          throw new Error(`Winds aloft unavailable (${res.status})`);
        }
        const payload = await res.json();
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
  }, [enabled, altitudeFt, map, onUpdate, onError]);

  return null;
}

export default function PlannerMap({
  points,
  heightClassName = "h-[380px]",
  mapStyle = "standard",
  plannedAltitudeFt,
  windsAltitudeFt,
}: PlannerMapProps) {
  const center: [number, number] = points.length
    ? [points[0].lat, points[0].lon]
    : [39.5, -98.35];
  const showRadar = mapStyle === "radar";
  const showWinds = mapStyle === "winds";
  const initialZoom = mapStyle === "sectional" ? 6 : (points.length ? 6 : 4);
  const [radarFrames, setRadarFrames] = useState<string[]>([]);
  const [radarFrameIndex, setRadarFrameIndex] = useState(0);
  const [radarError, setRadarError] = useState(false);
  const radarTimerRef = useRef<number | null>(null);
  const [windsAloftPoints, setWindsAloftPoints] = useState<WindsAloftPoint[]>([]);
  const [windsAloftMeta, setWindsAloftMeta] = useState<WindsAloftMeta | null>(null);
  const [windsAloftError, setWindsAloftError] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(initialZoom);
  const windsAltitude = useMemo(
    () => resolveWindsAltitude(windsAltitudeFt ?? plannedAltitudeFt ?? null),
    [plannedAltitudeFt, windsAltitudeFt]
  );

  const radarTileUrl = useMemo(() => {
    if (!showRadar || radarFrames.length === 0) return "";
    const frame = radarFrames[radarFrameIndex];
    return `https://tilecache.rainviewer.com/v2/radar/${frame}/256/{z}/{x}/{y}/2/1_1.png`;
  }, [showRadar, radarFrames, radarFrameIndex]);

  useEffect(() => {
    if (!showRadar) {
      setRadarFrames([]);
      setRadarFrameIndex(0);
      setRadarError(false);
      return;
    }

    let isActive = true;
    const loadRadarFrames = async () => {
      try {
        const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");
        if (!response.ok) {
          throw new Error("Failed to load radar frames");
        }
        const data = await response.json();
        const frames = [
          ...(data?.radar?.past || []),
          ...(data?.radar?.nowcast || [])
        ]
          .map((item: { path?: string }) => item.path)
          .filter(Boolean) as string[];

        if (!isActive) return;
        setRadarFrames(frames);
        setRadarFrameIndex(frames.length > 0 ? frames.length - 1 : 0);
        setRadarError(frames.length === 0);
      } catch (error) {
        console.error("Radar frame fetch failed:", error);
        if (isActive) {
          setRadarFrames([]);
          setRadarFrameIndex(0);
          setRadarError(true);
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
    }, 800);

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
    if (mapZoom < 5) {
      return windsAloftPoints.filter((_, index) => index % 4 === 0);
    }
    if (mapZoom < 6) {
      return windsAloftPoints.filter((_, index) => index % 3 === 0);
    }
    if (mapZoom < 7) {
      return windsAloftPoints.filter((_, index) => index % 2 === 0);
    }
    return windsAloftPoints;
  }, [mapZoom, showWinds, windsAloftPoints]);

  return (
    <div className={heightClassName}>
      <MapContainer center={center} zoom={initialZoom} scrollWheelZoom className="h-full w-full rounded-xl">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mapStyle === "sectional" && (
          <TileLayer
            attribution='Federal Aviation Administration, Aeronautical Information Services'
            url="https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}"
            minZoom={6}
            maxZoom={12}
            maxNativeZoom={12}
            opacity={0.85}
          />
        )}
        {showRadar && radarTileUrl && (
          <TileLayer
            attribution="RainViewer"
            url={radarTileUrl}
            opacity={0.8}
            zIndex={600}
            crossOrigin="anonymous"
          />
        )}
        {showRadar && !radarTileUrl && radarError && (
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
        {showWinds && (
          <WindsAloftController
            enabled={showWinds}
            altitudeFt={windsAltitude}
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
                className="rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-slate-900 shadow"
                opacity={1}
              >
                {stationLabel}: {Math.round(point.windDir)} deg / {Math.round(point.windSpeed)} kt{tempLabel}
              </Tooltip>
            </Marker>
          );
        })}
        <MapStyleController mapStyle={mapStyle} />
        {points.length > 1 && (
          <Polyline
            positions={points.map((p) => [p.lat, p.lon])}
            pathOptions={{ color: "#0ea5e9", weight: 4 }}
          />
        )}
        {points.map((point) => (
          <Marker
            key={point.icao}
            position={[point.lat, point.lon]}
            icon={defaultIcon}
          >
            <Tooltip
              permanent
              direction="top"
              offset={[0, -18]}
              className="rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-slate-900 shadow"
              opacity={1}
            >
              {point.icao}
            </Tooltip>
          </Marker>
        ))}
        <FitBounds points={points} mapStyle={mapStyle} />
        <MapZoomTracker onZoomChange={setMapZoom} />
      </MapContainer>
      {showWinds && (
        <div className="mt-2 text-xs text-muted-foreground">
          NOAA AWC winds aloft (legacy wind/temp tables) at {windsAloftMeta?.altitudeFt ?? windsAltitude} ft.
          {windsAloftMeta?.validTime ? ` Valid ${windsAloftMeta.validTime}.` : ""}
          {windsAloftMeta?.warnings?.length ? ` ${windsAloftMeta.warnings.join(" ")}` : ""}
          {windsAloftError ? ` ${windsAloftError}` : ""}
        </div>
      )}
    </div>
  );
}
