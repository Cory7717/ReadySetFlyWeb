import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type LngLatBoundsLike, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { apiUrl } from "@/lib/api";
import type {
  Planner2DMapProps,
  PlannerLegHealthMarker,
  PlannerPoint,
  PlannerTerrainHotSpot,
  PlannerTerrainSegment,
} from "@/components/flight-planner/plannerMapTypes";
import {
  RSF_COCKPIT_MUTED_TEXT_CLASS,
  RSF_ROUTE_HALO_LINE_STYLE,
  RSF_SECTIONAL_WMS_TILE_URL,
  RSF_TERRAIN_RISK_STYLES,
  RSF_TERRAIN_SURFACE_STYLES,
} from "@/map/rsfMapSpec";
import { buildLineStringCollection, setGeoJsonSourceData } from "@/map/maplibre/geojson";
import { clearMarkers, replaceMarkerSet } from "@/map/maplibre/markers";
import { addOrReplaceRasterLayer, createRasterBaseStyle, removeRasterLayer } from "@/map/maplibre/rasterLayers";

const MAP_SOURCE_ID = "rsf-planner-route";
const TERRAIN_SOURCE_ID = "rsf-planner-terrain";
const ROUTE_LAYER_ID = "rsf-planner-route-line";
const TERRAIN_SURFACE_LAYER_ID = "rsf-planner-terrain-surface";
const TERRAIN_LINE_LAYER_ID = "rsf-planner-terrain-line";
const SECTIONAL_SOURCE_ID = "rsf-planner-sectional";
const SECTIONAL_LAYER_ID = "rsf-planner-sectional-layer";
const RADAR_SOURCE_ID = "rsf-planner-radar";
const RADAR_LAYER_ID = "rsf-planner-radar-layer";
const RADAR_WMS_SOURCE_ID = "rsf-planner-radar-wms";
const RADAR_WMS_LAYER_ID = "rsf-planner-radar-wms-layer";
const CLOUD_SOURCE_ID = "rsf-planner-clouds";
const CLOUD_LAYER_ID = "rsf-planner-clouds-layer";
const OSM_TILE_URLS = [
  "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
] as const;

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

const terrainLineWidthExpression = [
  "match",
  ["get", "risk"],
  "warning",
  RSF_TERRAIN_RISK_STYLES.warning.weight,
  "caution",
  RSF_TERRAIN_RISK_STYLES.caution.weight,
  RSF_TERRAIN_RISK_STYLES.comfortable.weight,
] as any;

function buildRouteGeoJson(points: PlannerPoint[]) {
  return buildLineStringCollection(points.map((point) => [point.lon, point.lat]));
}

function buildTerrainGeoJson(segments: PlannerTerrainSegment[]) {
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

function buildAirportMarkerElement(point: PlannerPoint, airportLabelMode: Planner2DMapProps["airportLabelMode"]) {
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "4px";

  const dot = document.createElement("div");
  dot.style.width = "12px";
  dot.style.height = "12px";
  dot.style.borderRadius = "9999px";
  dot.style.background = "#ffffff";
  dot.style.border = "2px solid #2563eb";
  dot.style.boxShadow = "0 2px 6px rgba(15, 23, 42, 0.35)";
  wrapper.appendChild(dot);

  if (airportLabelMode !== "markers") {
    const label = document.createElement("div");
    label.style.padding = "3px 8px";
    label.style.borderRadius = "9999px";
    label.style.background = "rgba(255,255,255,0.92)";
    label.style.color = "#0f172a";
    label.style.fontSize = "11px";
    label.style.fontWeight = "700";
    label.style.boxShadow = "0 2px 8px rgba(15,23,42,0.18)";
    label.style.whiteSpace = "nowrap";
    label.textContent = point.label ? `${point.icao} • ${point.label}` : point.icao;
    wrapper.appendChild(label);
  }

  return wrapper;
}

function buildTerrainHotSpotElement(hotSpot: PlannerTerrainHotSpot) {
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

function buildLegHealthElement(marker: PlannerLegHealthMarker) {
  const el = document.createElement("div");
  const tone =
    marker.status === "warning" ? "#dc2626" : marker.status === "caution" ? "#f59e0b" : "#2563eb";
  const text = marker.status === "warning" ? "!" : marker.status === "caution" ? "~" : "OK";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.minWidth = "28px";
  el.style.height = "18px";
  el.style.padding = "0 6px";
  el.style.borderRadius = "9999px";
  el.style.background = tone;
  el.style.border = "2px solid #ffffff";
  el.style.color = "#ffffff";
  el.style.fontSize = "10px";
  el.style.fontWeight = "700";
  el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
  el.textContent = text;
  return el;
}

export default function MapLibrePlannerMap({
  points,
  heightClassName = "h-[380px]",
  mapStyle = "standard",
  terrainSegments = [],
  terrainHotSpots = [],
  legHealthMarkers = [],
  airportLabelMode = "icao",
}: Planner2DMapProps) {
  const center = useMemo<[number, number]>(
    () => (points.length ? [points[0].lon, points[0].lat] : [-98.35, 39.5]),
    [points],
  );
  const initialZoom = mapStyle === "sectional" ? 4 : points.length ? 6 : 4;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [radarFrames, setRadarFrames] = useState<string[]>([]);
  const [radarFrameIndex, setRadarFrameIndex] = useState(0);
  const [radarError, setRadarError] = useState(false);
  const [radarFallbackActive, setRadarFallbackActive] = useState(false);
  const radarTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const airportMarkersRef = useRef<maplibregl.Marker[]>([]);
  const terrainMarkersRef = useRef<maplibregl.Marker[]>([]);
  const healthMarkersRef = useRef<maplibregl.Marker[]>([]);
  const initialCenterRef = useRef(center);
  const initialZoomRef = useRef(initialZoom);
  const gibsDate = useMemo(
    () => new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString().slice(0, 10),
    [],
  );

  const routeGeoJson = useMemo(() => buildRouteGeoJson(points), [points]);
  const terrainGeoJson = useMemo(() => buildTerrainGeoJson(terrainSegments), [terrainSegments]);

  const radarTileUrl = useMemo(() => {
    if (mapStyle !== "radar" || radarFrames.length === 0) return "";
    const frame = radarFrames[radarFrameIndex];
    const normalizedFrame = frame.replace(/^\/??v2\/radar\//, "");
    return apiUrl(`/api/tiles/rainviewer/v2/radar/${normalizedFrame}/256/{z}/{x}/{y}/2/1_1.png`);
  }, [mapStyle, radarFrames, radarFrameIndex]);

  const cloudTileUrl = useMemo(() => {
    if (mapStyle !== "clouds") return "";
    return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
  }, [gibsDate, mapStyle]);

  const syncRasterLayers = useCallback(
    (map: MapLibreMap) => {
      if (!map.isStyleLoaded()) return;

      map.setMinZoom(mapStyle === "sectional" ? 2 : 2);
      map.setMaxZoom(mapStyle === "sectional" ? 12 : 18);

      if (mapStyle === "sectional") {
        addOrReplaceRasterLayer({
          map,
          sourceId: SECTIONAL_SOURCE_ID,
          layerId: SECTIONAL_LAYER_ID,
          tiles: [RSF_SECTIONAL_WMS_TILE_URL],
          attribution: "FAA SUA Geoserver Charts",
          opacity: 1,
          minzoom: 2,
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

      if (mapStyle === "radar" && (radarFallbackActive || (!radarTileUrl && radarError))) {
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
          opacity: 0.7,
          maxzoom: 9,
          beforeId: TERRAIN_SURFACE_LAYER_ID,
        });
      } else {
        removeRasterLayer(map, CLOUD_SOURCE_ID, CLOUD_LAYER_ID);
      }
    },
    [cloudTileUrl, mapStyle, radarError, radarFallbackActive, radarTileUrl],
  );

  useEffect(() => {
    if (mapStyle !== "radar") {
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
        if (!response.ok) throw new Error("Failed to load radar frames");
        const data = await response.json();
        const frames = (Array.isArray(data?.frames) ? data.frames : []).filter(Boolean) as string[];
        if (!isActive) return;
        setRadarFrames(frames);
        setRadarFrameIndex(frames.length > 0 ? frames.length - 1 : 0);
        setRadarError(frames.length === 0);
        setRadarFallbackActive(frames.length === 0);
      } catch {
        if (!isActive) return;
        setRadarFrames([]);
        setRadarFrameIndex(0);
        setRadarError(true);
        setRadarFallbackActive(true);
      }
    };

    loadRadarFrames();
    return () => {
      isActive = false;
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
      setRadarFrameIndex((prev) => (prev + 1) % radarFrames.length);
    }, 1600);

    return () => {
      if (radarTimerRef.current) {
        window.clearInterval(radarTimerRef.current);
        radarTimerRef.current = null;
      }
    };
  }, [mapStyle, radarFrames.length]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: initialCenterRef.current,
      zoom: initialZoomRef.current,
      attributionControl: {},
      style: createRasterBaseStyle({
        sourceId: "osm",
        layerId: "rsf-base-osm",
        tiles: [...OSM_TILE_URLS],
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }),
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");

    map.on("load", () => {
      map.addSource(MAP_SOURCE_ID, {
        type: "geojson",
        data: routeGeoJson,
      });
      map.addSource(TERRAIN_SOURCE_ID, {
        type: "geojson",
        data: terrainGeoJson,
      });

      map.addLayer({
        id: TERRAIN_SURFACE_LAYER_ID,
        type: "line",
        source: TERRAIN_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: terrainSegments.length > 0 ? "visible" : "none",
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
          ],
        },
      });

      map.addLayer({
        id: TERRAIN_LINE_LAYER_ID,
        type: "line",
        source: TERRAIN_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: terrainSegments.length > 0 ? "visible" : "none",
        },
        paint: {
          "line-color": terrainRiskExpression,
          "line-width": terrainLineWidthExpression,
          "line-opacity": [
            "match",
            ["get", "risk"],
            "warning",
            RSF_TERRAIN_RISK_STYLES.warning.opacity,
            "caution",
            RSF_TERRAIN_RISK_STYLES.caution.opacity,
            RSF_TERRAIN_RISK_STYLES.comfortable.opacity,
          ],
        },
      });

      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: MAP_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: terrainSegments.length > 0 ? "none" : "visible",
        },
        paint: {
          "line-color": RSF_ROUTE_HALO_LINE_STYLE.color,
          "line-width": RSF_ROUTE_HALO_LINE_STYLE.weight,
          "line-opacity": 0.9,
        },
      });

      setMapReady(true);
    });

    mapRef.current = map;
    return () => {
      setMapReady(false);
      clearMarkers(airportMarkersRef.current);
      clearMarkers(terrainMarkersRef.current);
      clearMarkers(healthMarkersRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = window.setTimeout(() => map.resize(), 120);
    return () => window.clearTimeout(timer);
  }, [isFullscreen]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    syncRasterLayers(map);
  }, [mapReady, syncRasterLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.isStyleLoaded()) return;
    setGeoJsonSourceData(map, MAP_SOURCE_ID, routeGeoJson);
    const routeLayerVisible = terrainSegments.length > 0 ? "none" : "visible";
    if (map.getLayer(ROUTE_LAYER_ID)) map.setLayoutProperty(ROUTE_LAYER_ID, "visibility", routeLayerVisible);
  }, [mapReady, routeGeoJson, terrainSegments.length]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.isStyleLoaded()) return;
    setGeoJsonSourceData(map, TERRAIN_SOURCE_ID, terrainGeoJson);
    const terrainVisible = terrainSegments.length > 0 ? "visible" : "none";
    if (map.getLayer(TERRAIN_SURFACE_LAYER_ID)) map.setLayoutProperty(TERRAIN_SURFACE_LAYER_ID, "visibility", terrainVisible);
    if (map.getLayer(TERRAIN_LINE_LAYER_ID)) map.setLayoutProperty(TERRAIN_LINE_LAYER_ID, "visibility", terrainVisible);
  }, [mapReady, terrainGeoJson, terrainSegments.length]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || points.length === 0) return;
    const bounds = new maplibregl.LngLatBounds([points[0].lon, points[0].lat], [points[0].lon, points[0].lat]);
    points.forEach((point) => bounds.extend([point.lon, point.lat]));
    window.requestAnimationFrame(() => {
      if (points.length === 1) {
        map.easeTo({ center: [points[0].lon, points[0].lat], zoom: mapStyle === "sectional" ? 8 : 10, duration: 0 });
        return;
      }
      map.fitBounds(bounds as LngLatBoundsLike, {
        padding: 72,
        duration: 0,
        maxZoom: mapStyle === "sectional" ? 12 : 15,
      });
    });
  }, [mapReady, mapStyle, points]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    airportMarkersRef.current = replaceMarkerSet({
      map,
      current: airportMarkersRef.current,
      items: points,
      createMarker: (point) =>
        new maplibregl.Marker({
          element: buildAirportMarkerElement(point, airportLabelMode),
          anchor: "bottom",
        })
          .setLngLat([point.lon, point.lat])
          .addTo(map),
    });
  }, [airportLabelMode, points]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    terrainMarkersRef.current = replaceMarkerSet({
      map,
      current: terrainMarkersRef.current,
      items: terrainHotSpots,
      createMarker: (hotSpot) =>
        new maplibregl.Marker({
          element: buildTerrainHotSpotElement(hotSpot),
          anchor: "center",
        })
          .setLngLat([hotSpot.lon, hotSpot.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 12 }).setHTML(
              `<div style="font-size:12px;line-height:1.35"><strong>Terrain hot spot ${hotSpot.rank}</strong><br/>${hotSpot.progressLabel}</div>`,
            ),
          )
          .addTo(map),
    });
  }, [terrainHotSpots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    healthMarkersRef.current = replaceMarkerSet({
      map,
      current: healthMarkersRef.current,
      items: legHealthMarkers,
      createMarker: (marker) =>
        new maplibregl.Marker({
          element: buildLegHealthElement(marker),
          anchor: "center",
        })
          .setLngLat([marker.lon, marker.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 12 }).setHTML(
              `<div style="font-size:12px;line-height:1.35"><strong>${marker.label}</strong><br/>${marker.detail}</div>`,
            ),
          )
          .addTo(map),
    });
  }, [legHealthMarkers]);

  const engineLabel = useMemo(() => {
    const status = mapReady ? "ready" : "loading";
    return mapStyle === "sectional"
      ? `MapLibre sectional ${status} · FAA WMS`
      : `MapLibre ${mapStyle} ${status}`;
  }, [mapReady, mapStyle]);
  const showWeatherAdvisory = mapStyle === "radar" || mapStyle === "clouds";

  return (
    <div className={isFullscreen ? "fixed inset-0 z-[1000] bg-[rgba(7,9,12,0.9)] p-3" : "space-y-2"}>
      <div className={isFullscreen ? "relative h-full w-full overflow-hidden rounded-[1.2rem] border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(18,22,28,0.98),rgba(9,12,16,0.99))]" : `relative overflow-hidden rounded-[1.2rem] border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(18,22,28,0.98),rgba(9,12,16,0.99))] ${heightClassName}`}>
        <button
          type="button"
          onClick={() => setIsFullscreen((prev) => !prev)}
          className="absolute right-3 top-3 z-[1100] rounded-[0.9rem] border border-[#5d6f85]/30 bg-[linear-gradient(180deg,rgba(22,28,36,0.98),rgba(13,17,22,0.98))] px-3 py-1.5 text-xs font-semibold text-[#E8EDF4] shadow-[0_16px_28px_-24px_rgba(0,0,0,0.88)] transition-all duration-200 hover:-translate-y-px hover:border-[#6f86a7]/35 hover:bg-[linear-gradient(180deg,rgba(28,35,46,0.98),rgba(16,21,28,0.98))]"
        >
          {isFullscreen ? "Close full screen" : "Full screen"}
        </button>
        <div ref={containerRef} className="h-full w-full rounded-xl" />
        <div className="absolute left-3 top-3 z-[1000] max-w-[calc(100%-9rem)] truncate rounded-full border border-[#5d6f85]/25 bg-[rgba(9,13,18,0.9)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#A9BBCD] sm:max-w-[60%]" title={engineLabel}>
          {engineLabel}
        </div>
      </div>
      {showWeatherAdvisory ? (
        <div className={`text-xs ${RSF_COCKPIT_MUTED_TEXT_CLASS} text-[#A9BBCD]`}>
          Weather layers remain advisory-only. This MapLibre path is active for the planner preview while RSF completes the full engine migration.
        </div>
      ) : null}
    </div>
  );
}
