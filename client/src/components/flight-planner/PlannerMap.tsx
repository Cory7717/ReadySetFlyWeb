import { useEffect } from "react";
import { MapContainer, Marker, Polyline, TileLayer, WMSTileLayer, useMap } from "react-leaflet";
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
          if (zoom < 4) map.setZoom(4);
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
          map.setMinZoom(4);
          map.setMaxZoom(12);
          if (map.getZoom() < 4) map.setZoom(4);
          if (map.getZoom() > 12) map.setZoom(12);
          return;
        }
        map.setMinZoom(3);
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
        {mapStyle === "sectional" ? (
          <TileLayer
            attribution='Federal Aviation Administration, Aeronautical Information Services'
            url="https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}"
            minZoom={4}
            maxZoom={12}
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        {showRadar && (
          <WMSTileLayer
            url="https://nowcoast.noaa.gov/geoserver/observations/weather_radar/wms"
            layers="conus_base_reflectivity_mosaic"
            format="image/png"
            transparent
            opacity={0.55}
          />
        )}
        {showWinds && (
          <WMSTileLayer
            url="https://nowcoast.noaa.gov/geoserver/analysis/winds/wms"
            layers="analysis_wind_speed"
            format="image/png"
            transparent
            opacity={0.6}
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
          />
        ))}
        <FitBounds points={points} mapStyle={mapStyle} />
      </MapContainer>
    </div>
  );
}
