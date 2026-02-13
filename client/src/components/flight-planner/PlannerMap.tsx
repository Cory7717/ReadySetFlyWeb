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
  mapStyle?: "standard" | "sectional" | "radar" | "winds" | "clouds";
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

function FitBounds({ points, mapStyle }: { points: PlannerPoint[]; mapStyle: "standard" | "sectional" | "radar" | "winds" | "clouds" }) {
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

function MapStyleController({ mapStyle }: { mapStyle: "standard" | "sectional" | "radar" | "winds" | "clouds" }) {
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

function isWithinConus(center: L.LatLng | null) {
  if (!center) return false;
  return center.lat >= 14.56 && center.lat <= 56.78 && center.lng >= -152.11 && center.lng <= -52.92;
}

function isWithinAlaska(center: L.LatLng | null) {
  if (!center) return false;
  return center.lat >= 51 && center.lat <= 72 && center.lng >= -170 && center.lng <= -129;
}

function isWithinHawaii(center: L.LatLng | null) {
  if (!center) return false;
  return center.lat >= 18 && center.lat <= 23 && center.lng >= -161 && center.lng <= -154;
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

function formatCloudTimeLabel(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toUTCString().replace("GMT", "UTC");
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
}: PlannerMapProps) {
  const center: [number, number] = points.length
    ? [points[0].lat, points[0].lon]
    : [39.5, -98.35];
  const showRadar = mapStyle === "radar";
  const showWinds = mapStyle === "winds";
  const showClouds = mapStyle === "clouds";
  const initialZoom = mapStyle === "sectional" ? 6 : (points.length ? 6 : 4);
  const [mapZoom, setMapZoom] = useState(initialZoom);
  const [mapCenter, setMapCenter] = useState<L.LatLng | null>(null);
  const isConus = isWithinConus(mapCenter);
  const isAlaska = isWithinAlaska(mapCenter);
  const isHawaii = isWithinHawaii(mapCenter);
  const cloudSource = isAlaska || isHawaii ? "goes-west" : "goes-east";
  const showCloudsConus = showClouds;
  const [radarFrames, setRadarFrames] = useState<string[]>([]);
  const [radarFrameIndex, setRadarFrameIndex] = useState(0);
  const [radarError, setRadarError] = useState(false);
  const radarTimerRef = useRef<number | null>(null);
  const [cloudFrames, setCloudFrames] = useState<string[]>([]);
  const [cloudFrameIndex, setCloudFrameIndex] = useState(0);
  const [cloudError, setCloudError] = useState(false);
  const cloudTimerRef = useRef<number | null>(null);
  const [cloudPlaying, setCloudPlaying] = useState(true);
  const [cloudSpeedMs, setCloudSpeedMs] = useState(1200);
  const [cloudRefreshKey, setCloudRefreshKey] = useState(0);
  const gibsDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
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
    return `https://tilecache.rainviewer.com/v2/radar/${normalizedFrame}/256/{z}/{x}/{y}/2/1_1.png`;
  }, [showRadar, radarFrames, radarFrameIndex]);

  const cloudTileUrl = useMemo(() => {
    if (!showCloudsConus || cloudFrames.length === 0) return "";
    const frame = encodeURIComponent(cloudFrames[cloudFrameIndex]);
    const layer = cloudSource === "goes-west" ? "GOES-West_ABI_GeoColor" : "GOES-East_ABI_GeoColor";
    return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${frame}/GoogleMapsCompatible_Level4/{z}/{y}/{x}.jpg`;
  }, [showCloudsConus, cloudFrames, cloudFrameIndex, cloudSource]);

  const cloudTimeLabel = useMemo(
    () => formatCloudTimeLabel(cloudFrames[cloudFrameIndex]),
    [cloudFrames, cloudFrameIndex]
  );

  useEffect(() => {
    if (!mapRef.current) return;
    const timer = window.setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [isFullscreen]);

  useEffect(() => {
    if (!showClouds) return;
    const timer = window.setInterval(() => {
      setCloudRefreshKey((prev) => prev + 1);
    }, 1000 * 60 * 5);
    return () => window.clearInterval(timer);
  }, [showClouds]);

  useEffect(() => {
    if (!showCloudsConus) {
      setCloudFrames([]);
      setCloudFrameIndex(0);
      setCloudError(false);
      return;
    }

    let isActive = true;
    const loadCloudFrames = async () => {
      try {
        const res = await fetch(apiUrl(`/api/aviation/cloud-frames?source=${cloudSource}&count=12&intervalMin=10`));
        if (!res.ok) {
          throw new Error("Failed to load cloud frames");
        }
        const data = await res.json();
        const frames = Array.isArray(data?.frames) ? data.frames.filter(Boolean) : [];
        if (!isActive) return;
        setCloudFrames(frames);
        setCloudFrameIndex(frames.length > 0 ? frames.length - 1 : 0);
        setCloudError(frames.length === 0);
      } catch (error) {
        console.error("Cloud frame fetch failed:", error);
        if (isActive) {
          setCloudFrames([]);
          setCloudFrameIndex(0);
          setCloudError(true);
        }
      }
    };

    loadCloudFrames();

    return () => {
      isActive = false;
    };
  }, [showCloudsConus, cloudSource]);

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

  useEffect(() => {
    if (!showCloudsConus || cloudFrames.length === 0 || !cloudPlaying) {
      if (cloudTimerRef.current) {
        window.clearInterval(cloudTimerRef.current);
        cloudTimerRef.current = null;
      }
      return;
    }

    if (cloudTimerRef.current) {
      window.clearInterval(cloudTimerRef.current);
    }

    cloudTimerRef.current = window.setInterval(() => {
      setCloudFrameIndex((prev) => (prev + 1) % cloudFrames.length);
    }, cloudSpeedMs);

    return () => {
      if (cloudTimerRef.current) {
        window.clearInterval(cloudTimerRef.current);
        cloudTimerRef.current = null;
      }
    };
  }, [showCloudsConus, cloudFrames.length, cloudPlaying, cloudSpeedMs]);

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
    if (!showWinds || windsAloftPoints.length === 0) return [];
    if (!routeBounds) return windsAloftPoints.slice(0, 6);
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
          ? "fixed inset-0 z-[1000] bg-black/80 p-3"
          : "space-y-2"
      }
    >
      <div
        className={
          isFullscreen
            ? "relative h-full w-full rounded-xl overflow-hidden"
            : `relative ${heightClassName}`
        }
      >
        <button
          type="button"
          onClick={() => setIsFullscreen((prev) => !prev)}
          className="absolute right-3 top-3 z-[1100] rounded-md border bg-white/90 px-2 py-1 text-xs font-semibold text-slate-900 shadow hover:bg-white"
        >
          {isFullscreen ? "Close full screen" : "Full screen"}
        </button>
        {showCloudsConus && cloudFrames.length > 0 && (
          <div className="absolute left-3 top-3 z-[1100] space-y-2 rounded-md border bg-white/90 px-3 py-2 text-xs text-slate-700 shadow">
            <div className="font-semibold">Cloud loop</div>
            <div>{cloudTimeLabel || "Live"}</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCloudPlaying((prev) => !prev)}
                className="rounded-md border bg-white px-2 py-1 text-xs font-semibold text-slate-900"
              >
                {cloudPlaying ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                onClick={() => setCloudSpeedMs(1600)}
                className={`rounded-md border px-2 py-1 text-xs font-semibold ${cloudSpeedMs === 1600 ? "bg-slate-900 text-white" : "bg-white text-slate-900"}`}
              >
                Slow
              </button>
              <button
                type="button"
                onClick={() => setCloudSpeedMs(1200)}
                className={`rounded-md border px-2 py-1 text-xs font-semibold ${cloudSpeedMs === 1200 ? "bg-slate-900 text-white" : "bg-white text-slate-900"}`}
              >
                Med
              </button>
              <button
                type="button"
                onClick={() => setCloudSpeedMs(800)}
                className={`rounded-md border px-2 py-1 text-xs font-semibold ${cloudSpeedMs === 800 ? "bg-slate-900 text-white" : "bg-white text-slate-900"}`}
              >
                Fast
              </button>
            </div>
          </div>
        )}
        <MapContainer
          center={center}
          zoom={initialZoom}
          scrollWheelZoom
          className="h-full w-full rounded-xl"
          whenReady={(event) => {
            mapRef.current = event.target;
          }}
        >
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
        {showCloudsConus && (
          cloudTileUrl ? (
            <TileLayer
              key={`clouds-conus-anim-${cloudFrameIndex}`}
              attribution={cloudSource === "goes-west" ? "NASA GIBS (GOES-West GeoColor)" : "NASA GIBS (GOES-East GeoColor)"}
              url={cloudTileUrl}
              opacity={0.75}
              maxNativeZoom={8}
              zIndex={600}
              noWrap
            />
          ) : (
            <TileLayer
              key={`clouds-fallback-${cloudRefreshKey}`}
              attribution="NASA GIBS"
              url={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`}
              opacity={0.7}
              maxNativeZoom={9}
              zIndex={600}
            />
          )
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
        <MapCenterTracker onCenterChange={setMapCenter} />
        </MapContainer>
      </div>
      {showWinds && !isFullscreen && (
        <div className="text-xs text-muted-foreground">
          NOAA AWC winds aloft at {windsAloftMeta?.altitudeFt ?? windsAltitude} ft.
          {windsAloftMeta?.validTime ? ` Valid ${windsAloftMeta.validTime}.` : ""}
          {windsAloftMeta?.warnings?.length ? ` ${windsAloftMeta.warnings.join(" ")}` : ""}
          {windsAloftError ? ` ${windsAloftError}` : ""}
        </div>
      )}
      {showWinds && !isFullscreen && nearestWinds.length > 0 && (
        <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
          {nearestWinds.map(({ point, distanceNm }) => (
            <div key={`${point.stationId}-${point.lat}`} className="flex items-center justify-between rounded-md border px-2 py-1">
              <span className="font-semibold text-slate-700">
                {point.icao || point.stationId}
              </span>
              <span>
                {Math.round(point.windDir ?? 0)} deg / {Math.round(point.windSpeed ?? 0)} kt · {distanceNm.toFixed(0)} nm
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
