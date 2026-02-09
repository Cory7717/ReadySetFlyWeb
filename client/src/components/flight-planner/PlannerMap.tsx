import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, WMSTileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type PlannerPoint = {
  icao: string;
  lat: number;
  lon: number;
};

type PlannerMapProps = {
  points: PlannerPoint[];
  heightClassName?: string;
  mapStyle?: "standard" | "sectional" | "radar" | "winds";
};

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

export default function PlannerMap({ points, heightClassName = "h-[380px]", mapStyle = "standard" }: PlannerMapProps) {
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
  const openWeatherKey = import.meta.env.VITE_OPENWEATHER_API_KEY as string | undefined;

  const windTileUrl = openWeatherKey
    ? `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${openWeatherKey}`
    : "https://tiles.windy.com/tiles/v9.0/wind/{z}/{x}/{y}.png";

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
          <TileLayer
            attribution={openWeatherKey ? "OpenWeather" : "Windy.com"}
            url={windTileUrl}
            opacity={1}
            maxZoom={18}
            maxNativeZoom={12}
            minZoom={2}
            zIndex={600}
            crossOrigin="anonymous"
          />
        )}
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
      </MapContainer>
    </div>
  );
}
