import { useEffect, useMemo, useRef } from "react";
import maplibregl, { type LngLatBoundsLike, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Live2DMapSurfaceProps } from "@/components/adsb/Live2DMapSurface";
import {
  RSF_ROUTE_LINE_STYLE,
  RSF_SECTIONAL_TILE_URL,
  RSF_TERRAIN_RISK_STYLES,
  RSF_TERRAIN_SURFACE_STYLES,
} from "@/map/rsfMapSpec";
import {
  buildLineStringCollection,
  emptyFeatureCollection,
  normalizeFeatureCollection,
  setGeoJsonSourceData,
} from "@/map/maplibre/geojson";
import { clearMarkers, replaceMarkerSet, replaceSingleMarker } from "@/map/maplibre/markers";
import { addOrReplaceRasterLayer, createRasterBaseStyle, removeRasterLayer } from "@/map/maplibre/rasterLayers";

export type MapLibreLiveMapProps = Omit<Live2DMapSurfaceProps, "children">;

const ROUTE_SOURCE_ID = "rsf-live-route";
const ROUTE_LAYER_ID = "rsf-live-route-layer";
const TRAIL_SOURCE_ID = "rsf-live-trail";
const TRAIL_LAYER_ID = "rsf-live-trail-layer";
const OFFROUTE_SOURCE_ID = "rsf-live-offroute";
const OFFROUTE_LAYER_ID = "rsf-live-offroute-layer";
const TERRAIN_SOURCE_ID = "rsf-live-terrain";
const TERRAIN_SURFACE_LAYER_ID = "rsf-live-terrain-surface";
const TERRAIN_LINE_LAYER_ID = "rsf-live-terrain-line";
const RANGE_RING_SOURCE_ID = "rsf-live-range-ring";
const RANGE_RING_LAYER_ID = "rsf-live-range-ring";
const TFR_SOURCE_ID = "rsf-live-tfr";
const TFR_FILL_LAYER_ID = "rsf-live-tfr-fill";
const TFR_LINE_LAYER_ID = "rsf-live-tfr-line";
const SUA_SOURCE_ID = "rsf-live-sua";
const SUA_FILL_LAYER_ID = "rsf-live-sua-fill";
const SUA_LINE_LAYER_ID = "rsf-live-sua-line";
const SECTIONAL_SOURCE_ID = "rsf-live-sectional";
const SECTIONAL_LAYER_ID = "rsf-live-sectional-layer";
const RADAR_SOURCE_ID = "rsf-live-radar";
const RADAR_LAYER_ID = "rsf-live-radar-layer";
const RADAR_WMS_SOURCE_ID = "rsf-live-radar-wms";
const RADAR_WMS_LAYER_ID = "rsf-live-radar-wms-layer";
const CLOUD_SOURCE_ID = "rsf-live-clouds";
const CLOUD_LAYER_ID = "rsf-live-clouds-layer";

const terrainRiskExpression = [
  "match",
  ["get", "risk"],
  "warning",
  RSF_TERRAIN_RISK_STYLES.warning.color,
  "caution",
  RSF_TERRAIN_RISK_STYLES.caution.color,
  RSF_TERRAIN_RISK_STYLES.comfortable.color,
] as any;

const terrainSurfaceWidthExpression = [
  "match",
  ["get", "risk"],
  "warning",
  RSF_TERRAIN_SURFACE_STYLES.warning.weight,
  "caution",
  RSF_TERRAIN_SURFACE_STYLES.caution.weight,
  RSF_TERRAIN_SURFACE_STYLES.comfortable.weight,
] as any;

function buildTerrainCollection(segments: MapLibreLiveMapProps["terrainCueSegments"]) {
  return {
    type: "FeatureCollection" as const,
    features: segments.map((segment, index) => ({
      type: "Feature" as const,
      id: `terrain-${index}`,
      geometry: {
        type: "LineString" as const,
        coordinates: segment.positions.map(([lat, lon]) => [lon, lat]),
      },
      properties: {
        risk: segment.risk,
        clearanceFt: segment.clearanceFt,
        maxElevationFt: segment.maxElevationFt,
      },
    })),
  };
}

function buildCirclePolygon(lat: number, lon: number, radiusNm: number, steps = 64) {
  const radiusKm = radiusNm * 1.852;
  const coordinates: Array<[number, number]> = [];
  for (let step = 0; step <= steps; step += 1) {
    const angle = (step / steps) * Math.PI * 2;
    const dxKm = Math.cos(angle) * radiusKm;
    const dyKm = Math.sin(angle) * radiusKm;
    const latOffset = dyKm / 110.574;
    const lonOffset = dxKm / (111.32 * Math.cos((lat * Math.PI) / 180));
    coordinates.push([lon + lonOffset, lat + latOffset]);
  }
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        geometry: {
          type: "Polygon" as const,
          coordinates: [coordinates],
        },
        properties: {},
      },
    ],
  };
}

function buildOwnshipElement(headingDeg: number | null) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
      <svg width="28" height="28" viewBox="0 0 24 24" style="transform: rotate(${headingDeg ?? 0}deg); transform-origin: 50% 50%;">
        <path d="M12 1 L16 20 L12 17 L8 20 Z" fill="#2563eb" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
        <circle cx="12" cy="12" r="2.4" fill="#ffffff"/>
      </svg>
    </div>
  `;
  return wrapper.firstElementChild as HTMLElement;
}

function buildAirportPointElement(label: string, active = false) {
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "4px";

  const dot = document.createElement("div");
  dot.style.width = "18px";
  dot.style.height = "18px";
  dot.style.borderRadius = "9999px";
  dot.style.background = "#ffffff";
  dot.style.border = "2px solid #2563eb";
  dot.style.color = "#2563eb";
  dot.style.display = "flex";
  dot.style.alignItems = "center";
  dot.style.justifyContent = "center";
  dot.style.fontWeight = "700";
  dot.style.fontSize = "10px";
  dot.textContent = label;
  wrapper.appendChild(dot);

  if (active) {
    const text = document.createElement("div");
    text.style.padding = "3px 8px";
    text.style.borderRadius = "9999px";
    text.style.background = "rgba(255,255,255,0.92)";
    text.style.color = "#0f172a";
    text.style.fontSize = "11px";
    text.style.fontWeight = "700";
    text.style.whiteSpace = "nowrap";
    text.textContent = "Selected";
    wrapper.appendChild(text);
  }

  return wrapper;
}

function buildTerrainHotSpotElement(hotSpot: MapLibreLiveMapProps["terrainHotSpotMarkers"][number]) {
  const el = document.createElement("div");
  const tone =
    hotSpot.risk === "warning" ? "#dc2626" : hotSpot.risk === "caution" ? "#f59e0b" : "#16a34a";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.minWidth = "24px";
  el.style.height = "22px";
  el.style.padding = "0 6px";
  el.style.borderRadius = "9999px";
  el.style.background = tone;
  el.style.border = "2px solid #ffffff";
  el.style.color = "#ffffff";
  el.style.fontSize = "11px";
  el.style.fontWeight = "700";
  el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.25)";
  el.textContent = String(hotSpot.rank);
  return el;
}

function buildTrafficElement(target: MapLibreLiveMapProps["filteredTrafficTargets"][number], selected: boolean) {
  const tone = target.onGround
    ? "#6b7280"
    : target.threatLevel === "immediate"
      ? "#dc2626"
      : target.threatLevel === "advisory"
        ? "#f59e0b"
        : target.relativeAltitudeFt !== null && Math.abs(target.relativeAltitudeFt) <= 1000
          ? "#ef4444"
          : "#0f766e";
  const size = target.threatLevel === "immediate" ? 28 : target.threatLevel === "advisory" ? 26 : 24;
  const wrapper = document.createElement("div");
  wrapper.style.width = `${size}px`;
  wrapper.style.height = `${size}px`;
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.justifyContent = "center";
  wrapper.style.borderRadius = "9999px";
  if (selected || target.threatLevel === "immediate") {
    wrapper.style.boxShadow =
      target.threatLevel === "immediate" ? "0 0 0 4px rgba(220,38,38,0.2)" : "0 0 0 3px rgba(245,158,11,0.18)";
  }
  wrapper.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" style="transform: rotate(${target.trackDeg ?? 0}deg); transform-origin: 50% 50%;">
      <path d="M12 2 L14 10 L21 12 L14 14 L12 22 L10 14 L3 12 L10 10 Z" fill="${tone}" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>
  `;
  return wrapper;
}

function buildObstacleElement(obstacle: MapLibreLiveMapProps["nearbyObstacles"][number]) {
  const el = document.createElement("div");
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.width = "18px";
  el.style.height = "18px";
  el.style.borderRadius = "9999px";
  el.style.background = "#fef2f2";
  el.style.border = "2px solid #dc2626";
  el.style.color = "#991b1b";
  el.style.fontSize = "10px";
  el.style.fontWeight = "700";
  el.textContent = obstacle.aglFt !== null && obstacle.aglFt >= 1000 ? "!" : "O";
  return el;
}

function buildDiversionElement(rank: number, active: boolean) {
  const el = document.createElement("div");
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.minWidth = "26px";
  el.style.height = "22px";
  el.style.padding = "0 6px";
  el.style.borderRadius = "9999px";
  el.style.background = active ? "#2563eb" : "#0f766e";
  el.style.border = "2px solid #ffffff";
  el.style.color = "#ffffff";
  el.style.fontSize = "11px";
  el.style.fontWeight = "700";
  el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.25)";
  el.textContent = `D${rank}`;
  return el;
}

function formatSignedAltitude(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${Math.round(value).toLocaleString()} ft`;
}

export default function MapLibreLiveMap({
  mapStyle,
  mapCenter,
  focusTarget,
  followOwnship,
  onFollowOwnshipChange,
  ownship,
  trail,
  routePoints,
  routeProgress,
  terrainCueSegments,
  terrainHotSpotMarkers,
  filteredTrafficTargets,
  selectedTrafficTarget,
  onSelectTrafficTarget,
  showTfrOverlay,
  tfrData,
  showSuaOverlay,
  suaData,
  showObstacleOverlay,
  nearbyObstacles,
  showDiversionOverlay,
  diversionMapMarkers,
  selectedDiversion,
  onSelectDiversion,
  rangeNm,
  radarTileUrl,
  radarFallbackActive,
  cloudTileUrl,
  showTerrainShading,
}: MapLibreLiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const ownshipMarkerRef = useRef<maplibregl.Marker | null>(null);
  const routeMarkersRef = useRef<maplibregl.Marker[]>([]);
  const hotspotMarkersRef = useRef<maplibregl.Marker[]>([]);
  const trafficMarkersRef = useRef<maplibregl.Marker[]>([]);
  const obstacleMarkersRef = useRef<maplibregl.Marker[]>([]);
  const diversionMarkersRef = useRef<maplibregl.Marker[]>([]);
  const baseCenter = useMemo<[number, number]>(() => [mapCenter[1], mapCenter[0]], [mapCenter]);

  const routeGeoJson = useMemo(
    () => buildLineStringCollection(routePoints.map((point) => [point.lon, point.lat])),
    [routePoints],
  );
  const trailGeoJson = useMemo(() => buildLineStringCollection(trail.map(([lat, lon]) => [lon, lat])), [trail]);
  const offRouteGeoJson = useMemo(() => {
    if (!ownship || !routeProgress || routeProgress.offRouteNm < 0.2) {
      return buildLineStringCollection([]);
    }
    return buildLineStringCollection([
      [ownship.lon, ownship.lat],
      [routeProgress.nearestPoint.lon, routeProgress.nearestPoint.lat],
    ]);
  }, [ownship, routeProgress]);
  const terrainGeoJson = useMemo(() => buildTerrainCollection(terrainCueSegments), [terrainCueSegments]);
  const rangeRingGeoJson = useMemo(() => {
    if (!ownship) return emptyFeatureCollection();
    return buildCirclePolygon(ownship.lat, ownship.lon, rangeNm);
  }, [ownship, rangeNm]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: baseCenter,
      zoom: 8,
      attributionControl: {},
      style: createRasterBaseStyle({
        sourceId: "osm",
        layerId: "rsf-live-base-osm",
        tiles: ["https://{a,b,c}.tile.openstreetmap.org/{z}/{x}/{y}.png"],
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }),
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");
    map.on("dragstart", () => onFollowOwnshipChange(false));

    map.on("load", () => {
      map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: routeGeoJson as any });
      map.addSource(TRAIL_SOURCE_ID, { type: "geojson", data: trailGeoJson as any });
      map.addSource(OFFROUTE_SOURCE_ID, { type: "geojson", data: offRouteGeoJson as any });
      map.addSource(TERRAIN_SOURCE_ID, { type: "geojson", data: terrainGeoJson as any });
      map.addSource(RANGE_RING_SOURCE_ID, { type: "geojson", data: rangeRingGeoJson as any });
      map.addSource(TFR_SOURCE_ID, { type: "geojson", data: normalizeFeatureCollection(tfrData) as any });
      map.addSource(SUA_SOURCE_ID, { type: "geojson", data: normalizeFeatureCollection(suaData) as any });

      map.addLayer({
        id: TERRAIN_SURFACE_LAYER_ID,
        type: "line",
        source: TERRAIN_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: showTerrainShading && terrainCueSegments.length > 0 ? "visible" : "none",
        },
        paint: {
          "line-color": terrainRiskExpression,
          "line-width": terrainSurfaceWidthExpression,
          "line-opacity": [
            "match",
            ["get", "risk"],
            "warning",
            RSF_TERRAIN_SURFACE_STYLES.warning.opacity,
            "caution",
            RSF_TERRAIN_SURFACE_STYLES.caution.opacity,
            RSF_TERRAIN_SURFACE_STYLES.comfortable.opacity,
          ] as any,
        },
      });
      map.addLayer({
        id: TERRAIN_LINE_LAYER_ID,
        type: "line",
        source: TERRAIN_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: terrainCueSegments.length > 0 ? "visible" : "none",
        },
        paint: {
          "line-color": terrainRiskExpression,
          "line-width": [
            "match",
            ["get", "risk"],
            "warning",
            RSF_TERRAIN_RISK_STYLES.warning.weight,
            "caution",
            RSF_TERRAIN_RISK_STYLES.caution.weight,
            RSF_TERRAIN_RISK_STYLES.comfortable.weight,
          ] as any,
          "line-opacity": [
            "match",
            ["get", "risk"],
            "warning",
            RSF_TERRAIN_RISK_STYLES.warning.opacity,
            "caution",
            RSF_TERRAIN_RISK_STYLES.caution.opacity,
            RSF_TERRAIN_RISK_STYLES.comfortable.opacity,
          ] as any,
        },
      });
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: terrainCueSegments.length > 0 ? "none" : "visible",
        },
        paint: {
          "line-color": RSF_ROUTE_LINE_STYLE.color,
          "line-width": RSF_ROUTE_LINE_STYLE.weight,
          "line-opacity": RSF_ROUTE_LINE_STYLE.opacity,
        },
      });
      map.addLayer({
        id: TRAIL_LAYER_ID,
        type: "line",
        source: TRAIL_SOURCE_ID,
        paint: {
          "line-color": "#2563eb",
          "line-width": 2.5,
          "line-opacity": 0.75,
        },
      });
      map.addLayer({
        id: OFFROUTE_LAYER_ID,
        type: "line",
        source: OFFROUTE_SOURCE_ID,
        paint: {
          "line-color": "#0f172a",
          "line-width": 2,
          "line-opacity": 0.65,
          "line-dasharray": [3, 3],
        },
      });
      map.addLayer({
        id: RANGE_RING_LAYER_ID,
        type: "line",
        source: RANGE_RING_SOURCE_ID,
        paint: {
          "line-color": "#0ea5e9",
          "line-width": 1.5,
          "line-opacity": 0.85,
          "line-dasharray": [2, 2],
        },
      });
      map.addLayer({
        id: TFR_FILL_LAYER_ID,
        type: "fill",
        source: TFR_SOURCE_ID,
        layout: { visibility: showTfrOverlay ? "visible" : "none" },
        paint: { "fill-color": "#dc2626", "fill-opacity": 0.1 },
      });
      map.addLayer({
        id: TFR_LINE_LAYER_ID,
        type: "line",
        source: TFR_SOURCE_ID,
        layout: { visibility: showTfrOverlay ? "visible" : "none" },
        paint: { "line-color": "#dc2626", "line-width": 2, "line-opacity": 0.85 },
      });
      map.addLayer({
        id: SUA_FILL_LAYER_ID,
        type: "fill",
        source: SUA_SOURCE_ID,
        layout: { visibility: showSuaOverlay ? "visible" : "none" },
        paint: { "fill-color": "#2563eb", "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: SUA_LINE_LAYER_ID,
        type: "line",
        source: SUA_SOURCE_ID,
        layout: { visibility: showSuaOverlay ? "visible" : "none" },
        paint: { "line-color": "#2563eb", "line-width": 1.5, "line-opacity": 0.75 },
      });
    });

    mapRef.current = map;
    return () => {
      ownshipMarkerRef.current?.remove();
      clearMarkers(routeMarkersRef.current);
      clearMarkers(hotspotMarkersRef.current);
      clearMarkers(trafficMarkersRef.current);
      clearMarkers(obstacleMarkersRef.current);
      clearMarkers(diversionMarkersRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, [baseCenter, onFollowOwnshipChange, routeGeoJson, showSuaOverlay, showTerrainShading, showTfrOverlay, suaData, terrainCueSegments.length, terrainGeoJson, tfrData, trailGeoJson, offRouteGeoJson, rangeRingGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (followOwnship && ownship) {
      map.easeTo({ center: [ownship.lon, ownship.lat], duration: 0 });
    }
  }, [followOwnship, ownship]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusTarget) return;
    map.easeTo({ center: [focusTarget.lon, focusTarget.lat], zoom: Math.max(map.getZoom(), 9), duration: 700 });
  }, [focusTarget]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    map.setMinZoom(mapStyle === "sectional" ? 4 : 2);
    map.setMaxZoom(mapStyle === "sectional" ? 12 : 18);

    if (mapStyle === "sectional") {
      addOrReplaceRasterLayer({
        map,
        sourceId: SECTIONAL_SOURCE_ID,
        layerId: SECTIONAL_LAYER_ID,
        tiles: [RSF_SECTIONAL_TILE_URL],
        attribution: "Federal Aviation Administration, Aeronautical Information Services",
        opacity: 0.85,
        minzoom: 4,
        maxzoom: 12,
        beforeId: TERRAIN_SURFACE_LAYER_ID,
      });
    } else {
      removeRasterLayer(map, SECTIONAL_SOURCE_ID, SECTIONAL_LAYER_ID);
    }

    if (mapStyle === "radar" && radarTileUrl && !radarFallbackActive) {
      addOrReplaceRasterLayer({
        map,
        sourceId: RADAR_SOURCE_ID,
        layerId: RADAR_LAYER_ID,
        tiles: [radarTileUrl],
        attribution: "RainViewer",
        opacity: 0.8,
        beforeId: TERRAIN_SURFACE_LAYER_ID,
      });
      removeRasterLayer(map, RADAR_WMS_SOURCE_ID, RADAR_WMS_LAYER_ID);
    } else {
      removeRasterLayer(map, RADAR_SOURCE_ID, RADAR_LAYER_ID);
    }

    if (mapStyle === "radar" && radarFallbackActive) {
      addOrReplaceRasterLayer({
        map,
        sourceId: RADAR_WMS_SOURCE_ID,
        layerId: RADAR_WMS_LAYER_ID,
        tiles: [
          "https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi?service=WMS&request=GetMap&layers=nexrad-n0r-900913&styles=&format=image/png&transparent=true&version=1.1.1&srs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}",
        ],
        attribution: "IEM NEXRAD Base Reflectivity",
        opacity: 0.75,
        beforeId: TERRAIN_SURFACE_LAYER_ID,
      });
    } else {
      removeRasterLayer(map, RADAR_WMS_SOURCE_ID, RADAR_WMS_LAYER_ID);
    }

    if (mapStyle === "clouds" && cloudTileUrl) {
      addOrReplaceRasterLayer({
        map,
        sourceId: CLOUD_SOURCE_ID,
        layerId: CLOUD_LAYER_ID,
        tiles: [cloudTileUrl],
        attribution: "NASA GIBS",
        opacity: 0.68,
        maxzoom: 9,
        beforeId: TERRAIN_SURFACE_LAYER_ID,
      });
    } else {
      removeRasterLayer(map, CLOUD_SOURCE_ID, CLOUD_LAYER_ID);
    }
  }, [cloudTileUrl, mapStyle, radarFallbackActive, radarTileUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    setGeoJsonSourceData(map, ROUTE_SOURCE_ID, routeGeoJson);
    setGeoJsonSourceData(map, TRAIL_SOURCE_ID, trailGeoJson);
    setGeoJsonSourceData(map, OFFROUTE_SOURCE_ID, offRouteGeoJson);
    setGeoJsonSourceData(map, TERRAIN_SOURCE_ID, terrainGeoJson);
    setGeoJsonSourceData(map, RANGE_RING_SOURCE_ID, rangeRingGeoJson);
    setGeoJsonSourceData(map, TFR_SOURCE_ID, normalizeFeatureCollection(tfrData));
    setGeoJsonSourceData(map, SUA_SOURCE_ID, normalizeFeatureCollection(suaData));

    if (map.getLayer(ROUTE_LAYER_ID)) {
      map.setLayoutProperty(ROUTE_LAYER_ID, "visibility", terrainCueSegments.length > 0 ? "none" : "visible");
    }
    if (map.getLayer(TERRAIN_SURFACE_LAYER_ID)) {
      map.setLayoutProperty(
        TERRAIN_SURFACE_LAYER_ID,
        "visibility",
        showTerrainShading && terrainCueSegments.length > 0 ? "visible" : "none",
      );
    }
    if (map.getLayer(TERRAIN_LINE_LAYER_ID)) {
      map.setLayoutProperty(TERRAIN_LINE_LAYER_ID, "visibility", terrainCueSegments.length > 0 ? "visible" : "none");
    }
    if (map.getLayer(TFR_FILL_LAYER_ID)) map.setLayoutProperty(TFR_FILL_LAYER_ID, "visibility", showTfrOverlay ? "visible" : "none");
    if (map.getLayer(TFR_LINE_LAYER_ID)) map.setLayoutProperty(TFR_LINE_LAYER_ID, "visibility", showTfrOverlay ? "visible" : "none");
    if (map.getLayer(SUA_FILL_LAYER_ID)) map.setLayoutProperty(SUA_FILL_LAYER_ID, "visibility", showSuaOverlay ? "visible" : "none");
    if (map.getLayer(SUA_LINE_LAYER_ID)) map.setLayoutProperty(SUA_LINE_LAYER_ID, "visibility", showSuaOverlay ? "visible" : "none");
  }, [
    offRouteGeoJson,
    rangeRingGeoJson,
    routeGeoJson,
    showSuaOverlay,
    showTerrainShading,
    showTfrOverlay,
    suaData,
    terrainCueSegments.length,
    terrainGeoJson,
    tfrData,
    trailGeoJson,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!ownship) {
      ownshipMarkerRef.current?.remove();
      ownshipMarkerRef.current = null;
      return;
    }
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
  }, [ownship]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    routeMarkersRef.current = replaceMarkerSet({
      map,
      current: routeMarkersRef.current,
      items: routePoints,
      createMarker: (point, index) =>
        new maplibregl.Marker({
          element: buildAirportPointElement(String(index + 1), false),
          anchor: "center",
        })
          .setLngLat([point.lon, point.lat])
          .setPopup(new maplibregl.Popup({ offset: 10 }).setText(point.label))
          .addTo(map),
    });
  }, [routePoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    hotspotMarkersRef.current = replaceMarkerSet({
      map,
      current: hotspotMarkersRef.current,
      items: terrainHotSpotMarkers,
      createMarker: (hotSpot) =>
        new maplibregl.Marker({
          element: buildTerrainHotSpotElement(hotSpot),
          anchor: "center",
        })
          .setLngLat([hotSpot.lon, hotSpot.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 12 }).setHTML(
              `<div style="font-size:12px;line-height:1.35"><strong>Terrain hot spot ${hotSpot.rank}</strong><br/>${hotSpot.progressLabel}<br/>Clearance ${hotSpot.clearanceFt != null ? Math.round(hotSpot.clearanceFt).toLocaleString() : "--"} ft</div>`,
            ),
          )
          .addTo(map),
    });
  }, [terrainHotSpotMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    trafficMarkersRef.current = replaceMarkerSet({
      map,
      current: trafficMarkersRef.current,
      items: filteredTrafficTargets,
      createMarker: (target) => {
        const marker = new maplibregl.Marker({
          element: buildTrafficElement(target, selectedTrafficTarget?.id === target.id),
          anchor: "center",
        })
          .setLngLat([target.lon, target.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 12 }).setHTML(
              `<div style="font-size:12px;line-height:1.35"><strong>${target.callsign || target.tail || target.id}</strong><br/>Distance ${target.distanceNm ? target.distanceNm.toFixed(1) : "--"} NM<br/>Relative ${formatSignedAltitude(target.relativeAltitudeFt)}</div>`,
            ),
          )
          .addTo(map);
        marker.getElement().addEventListener("click", () => onSelectTrafficTarget(target));
        return marker;
      },
    });
  }, [filteredTrafficTargets, onSelectTrafficTarget, selectedTrafficTarget?.id]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    obstacleMarkersRef.current = showObstacleOverlay
      ? replaceMarkerSet({
          map,
          current: obstacleMarkersRef.current,
          items: nearbyObstacles,
          createMarker: (obstacle) =>
            new maplibregl.Marker({
              element: buildObstacleElement(obstacle),
              anchor: "center",
            })
              .setLngLat([obstacle.lon, obstacle.lat])
              .setPopup(
                new maplibregl.Popup({ offset: 12 }).setHTML(
                  `<div style="font-size:12px;line-height:1.35"><strong>${obstacle.kind || "Obstacle"}</strong><br/>AMSL ${obstacle.amslFt != null ? Math.round(obstacle.amslFt).toLocaleString() : "--"} ft</div>`,
                ),
              )
              .addTo(map),
        })
      : (clearMarkers(obstacleMarkersRef.current), []);
  }, [nearbyObstacles, showObstacleOverlay]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    diversionMarkersRef.current = showDiversionOverlay
      ? replaceMarkerSet({
          map,
          current: diversionMarkersRef.current,
          items: diversionMapMarkers,
          createMarker: (airport, index) => {
            const marker = new maplibregl.Marker({
              element: buildDiversionElement(index + 1, selectedDiversion?.icao === airport.icao),
              anchor: "center",
            })
              .setLngLat([airport.lon, airport.lat])
              .setPopup(
                new maplibregl.Popup({ offset: 12 }).setHTML(
                  `<div style="font-size:12px;line-height:1.35"><strong>${airport.icao}${airport.name ? ` · ${airport.name}` : ""}</strong><br/>Distance ${airport.distanceNm.toFixed(1)} NM<br/>Bearing ${Math.round(airport.bearingDeg)}°</div>`,
                ),
              )
              .addTo(map);
            marker.getElement().addEventListener("click", () => onSelectDiversion(airport));
            return marker;
          },
        })
      : (clearMarkers(diversionMarkersRef.current), []);
  }, [diversionMapMarkers, onSelectDiversion, selectedDiversion?.icao, showDiversionOverlay]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || routePoints.length < 2) return;
    if (!ownship) {
      const bounds = new maplibregl.LngLatBounds([routePoints[0].lon, routePoints[0].lat], [routePoints[0].lon, routePoints[0].lat]);
      routePoints.forEach((point) => bounds.extend([point.lon, point.lat]));
      map.fitBounds(bounds as LngLatBoundsLike, { padding: 72, duration: 0, maxZoom: mapStyle === "sectional" ? 12 : 11 });
    }
  }, [mapStyle, ownship, routePoints]);

  return <div className="h-full w-full" ref={containerRef} />;
}
