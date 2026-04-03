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
type SurfaceFeature = {
  type: "Feature";
  geometry:
    | { type: "LineString"; coordinates: [number, number][] }
    | { type: "Polygon"; coordinates: [number, number][][] };
  properties: {
    aeroway: string;
    name: string | null;
    ref: string | null;
    surface: string | null;
  };
};

type MapLibreAirportSurfacePreviewProps = {
  airportIcao: string;
  mode: "departure" | "arrival";
  ownship: { lat: number; lon: number; headingDeg: number };
  surfaceFeatures?: SurfaceFeature[];
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
const SURFACE_FILL_SOURCE_ID = "rsf-surface-fill";
const SURFACE_FILL_LAYER_ID = "rsf-surface-fill-layer";
const SURFACE_OUTLINE_LAYER_ID = "rsf-surface-outline-layer";
const SURFACE_LINE_SOURCE_ID = "rsf-surface-line";
const SURFACE_LINE_LAYER_ID = "rsf-surface-line-layer";
const OSM_TILE_URLS = [
  "https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
  "https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
  "https://c.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
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

function buildFeatureCollection(features: SurfaceFeature[]) {
  return {
    type: "FeatureCollection" as const,
    features,
  };
}

function extendFeatureBounds(bounds: maplibregl.LngLatBounds, feature: SurfaceFeature) {
  if (feature.geometry.type === "LineString") {
    feature.geometry.coordinates.forEach(([lon, lat]) => bounds.extend([lon, lat]));
    return;
  }
  feature.geometry.coordinates.forEach((ring) => {
    ring.forEach(([lon, lat]) => bounds.extend([lon, lat]));
  });
}

export default function MapLibreAirportSurfacePreview({
  airportIcao,
  mode,
  ownship,
  surfaceFeatures = [],
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
  const surfaceFillGeoJson = useMemo(
    () => buildFeatureCollection(surfaceFeatures.filter((feature) => feature.geometry.type === "Polygon")),
    [surfaceFeatures],
  );
  const surfaceLineGeoJson = useMemo(
    () => buildFeatureCollection(surfaceFeatures.filter((feature) => feature.geometry.type === "LineString")),
    [surfaceFeatures],
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
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      }),
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");
    map.on("load", () => {
      window.setTimeout(() => map.resize(), 0);
      window.setTimeout(() => map.resize(), 150);
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

      if (!map.getSource(SURFACE_FILL_SOURCE_ID)) {
        map.addSource(SURFACE_FILL_SOURCE_ID, {
          type: "geojson",
          data: surfaceFillGeoJson as GeoJSON.FeatureCollection,
        });
      }
      if (!map.getLayer(SURFACE_FILL_LAYER_ID)) {
        map.addLayer({
          id: SURFACE_FILL_LAYER_ID,
          type: "fill",
          source: SURFACE_FILL_SOURCE_ID,
          paint: {
            "fill-color": [
              "match",
              ["get", "aeroway"],
              "runway",
              "#D9DDE2",
              "apron",
              "#2D3742",
              "helipad",
              "#A1A8AF",
              "#23303C",
            ],
            "fill-opacity": [
              "match",
              ["get", "aeroway"],
              "runway",
              0.44,
              "apron",
              0.68,
              "helipad",
              0.42,
              0.58,
            ],
          },
        });
      }
      if (!map.getLayer(SURFACE_OUTLINE_LAYER_ID)) {
        map.addLayer({
          id: SURFACE_OUTLINE_LAYER_ID,
          type: "line",
          source: SURFACE_FILL_SOURCE_ID,
          paint: {
            "line-color": "#516273",
            "line-width": 1.2,
            "line-opacity": 0.8,
          },
        });
      }
      if (!map.getSource(SURFACE_LINE_SOURCE_ID)) {
        map.addSource(SURFACE_LINE_SOURCE_ID, {
          type: "geojson",
          data: surfaceLineGeoJson as GeoJSON.FeatureCollection,
        });
      }
      if (!map.getLayer(SURFACE_LINE_LAYER_ID)) {
        map.addLayer({
          id: SURFACE_LINE_LAYER_ID,
          type: "line",
          source: SURFACE_LINE_SOURCE_ID,
          paint: {
            "line-color": [
              "match",
              ["get", "aeroway"],
              "taxiway",
              "#6F7E8D",
              "taxilane",
              "#8091A3",
              "holding_position",
              "#D0A24A",
              "runway",
              "#D9DDE2",
              "#516273",
            ],
            "line-width": [
              "match",
              ["get", "aeroway"],
              "taxiway",
              4,
              "taxilane",
              3,
              "holding_position",
              3.5,
              "runway",
              5,
              2.2,
            ],
            "line-opacity": 0.9,
          },
        });
      }
    });

    mapRef.current = map;
    return () => {
      ownshipMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [ownship.headingDeg, ownship.lat, ownship.lon, routeBaseGeoJson, routeDoneGeoJson, routeUpcomingGeoJson, runwayBarGeoJson, runwayCenterGeoJson, surfaceFillGeoJson, surfaceLineGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      map.resize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

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
    setGeoJsonSourceData(map, SURFACE_FILL_SOURCE_ID, surfaceFillGeoJson as any);
    setGeoJsonSourceData(map, SURFACE_LINE_SOURCE_ID, surfaceLineGeoJson as any);
  }, [routeBaseGeoJson, routeDoneGeoJson, routeUpcomingGeoJson, runwayBarGeoJson, runwayCenterGeoJson, surfaceFillGeoJson, surfaceLineGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = new maplibregl.LngLatBounds([ownship.lon, ownship.lat], [ownship.lon, ownship.lat]);
    route.forEach((point) => bounds.extend([point.lon, point.lat]));
    runwayCenterline.forEach((point) => bounds.extend([point.lon, point.lat]));
    runwayBar.forEach((point) => bounds.extend([point.lon, point.lat]));
    surfaceFeatures.forEach((feature) => extendFeatureBounds(bounds, feature));
    map.fitBounds(bounds as LngLatBoundsLike, {
      padding: 68,
      duration: 0,
      maxZoom: mode === "departure" ? 17.6 : 17.3,
      bearing: ownship.headingDeg,
    });
  }, [mode, ownship.headingDeg, ownship.lon, ownship.lat, route, runwayBar, runwayCenterline, surfaceFeatures]);

  useEffect(() => {
    return () => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;
      removeGeoJsonLayer(map, ROUTE_BASE_SOURCE_ID, ROUTE_BASE_LAYER_ID);
      removeGeoJsonLayer(map, ROUTE_DONE_SOURCE_ID, ROUTE_DONE_LAYER_ID);
      removeGeoJsonLayer(map, ROUTE_UPCOMING_SOURCE_ID, ROUTE_UPCOMING_LAYER_ID);
      removeGeoJsonLayer(map, RUNWAY_CENTER_SOURCE_ID, RUNWAY_CENTER_LAYER_ID);
      removeGeoJsonLayer(map, RUNWAY_BAR_SOURCE_ID, RUNWAY_BAR_LAYER_ID);
      removeGeoJsonLayer(map, SURFACE_FILL_SOURCE_ID, SURFACE_OUTLINE_LAYER_ID);
      removeGeoJsonLayer(map, SURFACE_FILL_SOURCE_ID, SURFACE_FILL_LAYER_ID);
      removeGeoJsonLayer(map, SURFACE_LINE_SOURCE_ID, SURFACE_LINE_LAYER_ID);
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
