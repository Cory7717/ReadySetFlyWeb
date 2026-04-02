import { useEffect, useMemo, useRef } from "react";
import maplibregl, { type LngLatBoundsLike, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createRasterBaseStyle } from "@/map/maplibre/rasterLayers";
import {
  buildLineStringCollection,
  removeGeoJsonLayer,
  setGeoJsonSourceData,
  upsertGeoJsonLineLayer,
} from "@/map/maplibre/geojson";
import { replaceSingleMarker } from "@/map/maplibre/markers";

type SurfacePoint = { lat: number; lon: number };

type MapLibreAirportSurfacePreviewProps = {
  airportIcao: string;
  mode: "departure" | "arrival";
  ownship: { lat: number; lon: number; headingDeg: number };
  route: SurfacePoint[];
  completedRoute: SurfacePoint[];
  upcomingRoute: SurfacePoint[];
  runwayCenterline: SurfacePoint[];
  runwayBar: SurfacePoint[];
};

const ROUTE_BASE_SOURCE_ID = "rsf-surface-route-base";
const ROUTE_BASE_LAYER_ID = "rsf-surface-route-base-layer";
const ROUTE_DONE_SOURCE_ID = "rsf-surface-route-done";
const ROUTE_DONE_LAYER_ID = "rsf-surface-route-done-layer";
const ROUTE_UPCOMING_SOURCE_ID = "rsf-surface-route-upcoming";
const ROUTE_UPCOMING_LAYER_ID = "rsf-surface-route-upcoming-layer";
const RUNWAY_CENTER_SOURCE_ID = "rsf-surface-runway-center";
const RUNWAY_CENTER_LAYER_ID = "rsf-surface-runway-center-layer";
const RUNWAY_BAR_SOURCE_ID = "rsf-surface-runway-bar";
const RUNWAY_BAR_LAYER_ID = "rsf-surface-runway-bar-layer";
const OSM_TILE_URLS = [
  "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
] as const;

function buildOwnshipElement(headingDeg: number) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 10px rgba(0,0,0,0.28));">
      <svg width="30" height="30" viewBox="0 0 24 24" style="transform: rotate(${headingDeg}deg); transform-origin: 50% 50%;">
        <path d="M12 1.8 L16 20 L12 16.8 L8 20 Z" fill="#E8EDF4" stroke="#0A0E14" stroke-width="1.15" stroke-linejoin="round"/>
      </svg>
    </div>
  `;
  return wrapper.firstElementChild as HTMLElement;
}

export default function MapLibreAirportSurfacePreview({
  airportIcao,
  mode,
  ownship,
  route,
  completedRoute,
  upcomingRoute,
  runwayCenterline,
  runwayBar,
}: MapLibreAirportSurfacePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const ownshipMarkerRef = useRef<maplibregl.Marker | null>(null);

  const routeBaseGeoJson = useMemo(
    () => buildLineStringCollection(route.map((point) => [point.lon, point.lat] as [number, number])),
    [route],
  );
  const routeDoneGeoJson = useMemo(
    () => buildLineStringCollection(completedRoute.map((point) => [point.lon, point.lat] as [number, number])),
    [completedRoute],
  );
  const routeUpcomingGeoJson = useMemo(
    () => buildLineStringCollection(upcomingRoute.map((point) => [point.lon, point.lat] as [number, number])),
    [upcomingRoute],
  );
  const runwayCenterGeoJson = useMemo(
    () => buildLineStringCollection(runwayCenterline.map((point) => [point.lon, point.lat] as [number, number])),
    [runwayCenterline],
  );
  const runwayBarGeoJson = useMemo(
    () => buildLineStringCollection(runwayBar.map((point) => [point.lon, point.lat] as [number, number])),
    [runwayBar],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [ownship.lon, ownship.lat],
      zoom: 16.5,
      bearing: ownship.headingDeg,
      pitch: 0,
      attributionControl: false,
      dragRotate: false,
      touchZoomRotate: false,
      style: createRasterBaseStyle({
        sourceId: "osmSurface",
        layerId: "rsf-surface-osm",
        tiles: [...OSM_TILE_URLS],
        attribution: "&copy; OpenStreetMap contributors",
      }),
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");
    map.on("load", () => {
      upsertGeoJsonLineLayer({
        map,
        sourceId: ROUTE_BASE_SOURCE_ID,
        layerId: ROUTE_BASE_LAYER_ID,
        data: routeBaseGeoJson,
        color: "#2B3642",
        width: 12,
        opacity: 0.95,
      });
      upsertGeoJsonLineLayer({
        map,
        sourceId: ROUTE_DONE_SOURCE_ID,
        layerId: ROUTE_DONE_LAYER_ID,
        data: routeDoneGeoJson,
        color: "#4A9FD4",
        width: 4,
        opacity: 0.88,
        dasharray: [2.6, 1.8],
      });
      upsertGeoJsonLineLayer({
        map,
        sourceId: ROUTE_UPCOMING_SOURCE_ID,
        layerId: ROUTE_UPCOMING_LAYER_ID,
        data: routeUpcomingGeoJson,
        color: "#C8922A",
        width: 5,
        opacity: 0.94,
      });
      upsertGeoJsonLineLayer({
        map,
        sourceId: RUNWAY_CENTER_SOURCE_ID,
        layerId: RUNWAY_CENTER_LAYER_ID,
        data: runwayCenterGeoJson,
        color: "#E8EDF4",
        width: 2,
        opacity: 0.95,
        dasharray: [3, 3],
      });
      upsertGeoJsonLineLayer({
        map,
        sourceId: RUNWAY_BAR_SOURCE_ID,
        layerId: RUNWAY_BAR_LAYER_ID,
        data: runwayBarGeoJson,
        color: "#F5A623",
        width: 6,
        opacity: 0.95,
      });
    });

    mapRef.current = map;
    return () => {
      ownshipMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [ownship.headingDeg, ownship.lat, ownship.lon, routeBaseGeoJson, routeDoneGeoJson, routeUpcomingGeoJson, runwayBarGeoJson, runwayCenterGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    ownshipMarkerRef.current = replaceSingleMarker({
      map,
      current: ownshipMarkerRef.current,
      createMarker: () =>
        new maplibregl.Marker({
          element: buildOwnshipElement(ownship.headingDeg),
          anchor: "center",
        })
          .setLngLat([ownship.lon, ownship.lat])
          .addTo(map),
    });
  }, [ownship.headingDeg, ownship.lat, ownship.lon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    setGeoJsonSourceData(map, ROUTE_BASE_SOURCE_ID, routeBaseGeoJson);
    setGeoJsonSourceData(map, ROUTE_DONE_SOURCE_ID, routeDoneGeoJson);
    setGeoJsonSourceData(map, ROUTE_UPCOMING_SOURCE_ID, routeUpcomingGeoJson);
    setGeoJsonSourceData(map, RUNWAY_CENTER_SOURCE_ID, runwayCenterGeoJson);
    setGeoJsonSourceData(map, RUNWAY_BAR_SOURCE_ID, runwayBarGeoJson);
  }, [routeBaseGeoJson, routeDoneGeoJson, routeUpcomingGeoJson, runwayBarGeoJson, runwayCenterGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = new maplibregl.LngLatBounds([ownship.lon, ownship.lat], [ownship.lon, ownship.lat]);
    route.forEach((point) => bounds.extend([point.lon, point.lat]));
    runwayCenterline.forEach((point) => bounds.extend([point.lon, point.lat]));
    runwayBar.forEach((point) => bounds.extend([point.lon, point.lat]));
    map.fitBounds(bounds as LngLatBoundsLike, {
      padding: 68,
      duration: 0,
      maxZoom: mode === "departure" ? 17.6 : 17.3,
      bearing: ownship.headingDeg,
    });
  }, [mode, ownship.headingDeg, ownship.lon, ownship.lat, route, runwayBar, runwayCenterline]);

  useEffect(() => {
    return () => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;
      removeGeoJsonLayer(map, ROUTE_BASE_SOURCE_ID, ROUTE_BASE_LAYER_ID);
      removeGeoJsonLayer(map, ROUTE_DONE_SOURCE_ID, ROUTE_DONE_LAYER_ID);
      removeGeoJsonLayer(map, ROUTE_UPCOMING_SOURCE_ID, ROUTE_UPCOMING_LAYER_ID);
      removeGeoJsonLayer(map, RUNWAY_CENTER_SOURCE_ID, RUNWAY_CENTER_LAYER_ID);
      removeGeoJsonLayer(map, RUNWAY_BAR_SOURCE_ID, RUNWAY_BAR_LAYER_ID);
    };
  }, []);

  return (
    <div className="relative h-[340px] overflow-hidden rounded-[20px] border border-[#1E2D42] bg-[#0A1018]">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-[#1E2D42] bg-[#091018]/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7A9BB8]">
        {airportIcao} {mode === "departure" ? "taxi out" : "taxi in"}
      </div>
    </div>
  );
}
