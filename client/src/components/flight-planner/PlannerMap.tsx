import { useEffect } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type PlannerPoint = {
  icao: string;
  lat: number;
  lon: number;
};

type PlannerMapProps = {
  points: PlannerPoint[];
  height?: string;
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
          map.setMinZoom(2);
          map.setMaxZoom(12);
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

export default function PlannerMap({ points, height = "380px", mapStyle = "standard" }: PlannerMapProps) {
  const center: [number, number] = points.length
    ? [points[0].lat, points[0].lon]
    : [39.5, -98.35];
  const showRadar = mapStyle === "radar";
  const showWinds = mapStyle === "winds";

  return (
    <div style={{ height }}>
      <MapContainer center={center} zoom={points.length ? 6 : 4} scrollWheelZoom className="h-full w-full rounded-xl">
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
            opacity={0.9}
          />
        )}
        {showRadar && (
          <TileLayer
            attribution="NOAA nowCOAST (radar)"
            url="https://nowcoast.noaa.gov/arcgis/rest/services/nowcoast/observations/weather_radar/MapServer/tile/{z}/{y}/{x}"
            opacity={0.7}
            maxZoom={10}
            minZoom={3}
            zIndex={600}
          />
        )}
        {showWinds && (
          <TileLayer
            attribution="NOAA nowCOAST (winds)"
            url="https://nowcoast.noaa.gov/arcgis/rest/services/nowcoast/analysis/winds/MapServer/tile/{z}/{y}/{x}"
            opacity={0.8}
            maxZoom={9}
            minZoom={3}
            zIndex={600}
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
