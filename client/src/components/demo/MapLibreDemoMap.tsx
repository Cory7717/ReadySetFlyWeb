import { useEffect, useMemo, useRef } from "react";
import maplibregl, { type LngLatBoundsLike, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { RSF_COCKPIT_MUTED_TEXT_CLASS } from "@/map/rsfMapSpec";
import type { Demo2DMapSurfaceProps } from "@/components/demo/demoMapTypes";
import { createRasterBaseStyle } from "@/map/maplibre/rasterLayers";
import {
  buildLineStringCollection,
  removeGeoJsonLayer,
  setGeoJsonSourceData,
  upsertGeoJsonLineLayer,
} from "@/map/maplibre/geojson";
import { clearMarkers, replaceMarkerSet, replaceSingleMarker } from "@/map/maplibre/markers";

const ROUTE_SOURCE_ID = "rsf-demo-route";
const ROUTE_LAYER_ID = "rsf-demo-route-layer";
const RUNWAY_CENTER_SOURCE_ID = "rsf-demo-runway-center";
const RUNWAY_CENTER_LAYER_ID = "rsf-demo-runway-center-layer";
const RUNWAY_BAR_SOURCE_ID = "rsf-demo-runway-bar";
const RUNWAY_BAR_LAYER_ID = "rsf-demo-runway-bar-layer";
const SELECTED_TRAFFIC_LINE_SOURCE_ID = "rsf-demo-selected-traffic-line";
const SELECTED_TRAFFIC_LINE_LAYER_ID = "rsf-demo-selected-traffic-line-layer";

function buildOwnshipElement(headingDeg: number) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
      <svg width="28" height="28" viewBox="0 0 24 24" style="transform: rotate(${headingDeg}deg); transform-origin: 50% 50%;">
        <path d="M12 1 L16 20 L12 17 L8 20 Z" fill="#E8EDF4" stroke="#0A0E14" stroke-width="1.1" stroke-linejoin="round"/>
      </svg>
    </div>
  `;
  return wrapper.firstElementChild as HTMLElement;
}

function buildWaypointElement(label: string, primary: boolean, next: boolean) {
  const el = document.createElement("div");
  el.style.display = "flex";
  el.style.flexDirection = "column";
  el.style.alignItems = "center";
  el.style.gap = "4px";

  const dot = document.createElement("div");
  dot.style.width = primary ? "18px" : "14px";
  dot.style.height = primary ? "18px" : "14px";
  dot.style.borderRadius = "9999px";
  dot.style.background = next ? "#00D4A0" : primary ? "#E8EDF4" : "#4A9FD4";
  dot.style.border = `2px solid ${primary ? "#C8922A" : "rgba(10,14,20,0.85)"}`;
  el.appendChild(dot);

  const text = document.createElement("div");
  text.style.padding = "3px 7px";
  text.style.borderRadius = "9999px";
  text.style.background = "rgba(9,16,24,0.82)";
  text.style.border = "1px solid rgba(30,45,66,0.85)";
  text.style.color = next ? "#00D4A0" : "#E8EDF4";
  text.style.fontSize = "10px";
  text.style.fontWeight = "700";
  text.style.whiteSpace = "nowrap";
  text.textContent = label;
  el.appendChild(text);
  return el;
}

function buildTrafficElement(target: Demo2DMapSurfaceProps["trafficTargets"][number], selected: boolean) {
  const tone =
    target.threatLevel === "immediate"
      ? "#E8453C"
      : target.threatLevel === "advisory"
        ? "#F5A623"
        : "#E8EDF4";
  const size = target.threatLevel === "immediate" ? 28 : 24;
  const wrapper = document.createElement("div");
  wrapper.style.width = `${size}px`;
  wrapper.style.height = `${size}px`;
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.justifyContent = "center";
  wrapper.style.borderRadius = "9999px";
  if (selected || target.threatLevel === "immediate") {
    wrapper.style.boxShadow =
      target.threatLevel === "immediate" ? "0 0 0 4px rgba(245,166,35,0.2)" : "0 0 0 3px rgba(245,166,35,0.18)";
  }
  wrapper.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24">
      <rect x="7" y="7" width="10" height="10" transform="rotate(45 12 12)" fill="${tone}" stroke="rgba(10,14,20,0.88)" stroke-width="1"/>
    </svg>
  `;
  return wrapper;
}

function buildDiversionElement(icao: string, active: boolean) {
  const el = document.createElement("div");
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.minWidth = "24px";
  el.style.height = "24px";
  el.style.padding = "0 7px";
  el.style.borderRadius = "9999px";
  el.style.background = active ? "#4A9FD4" : "#0A0E14";
  el.style.border = "2px solid #4A9FD4";
  el.style.color = "#E8EDF4";
  el.style.fontSize = "10px";
  el.style.fontWeight = "700";
  el.textContent = icao;
  return el;
}

export default function MapLibreDemoMap({
  routePoints,
  ownship,
  nextWaypoint,
  remainingRouteNm,
  flightPhase,
  trafficTargets,
  selectedTrafficTarget,
  diversionCandidates,
  selectedDiversion,
  terrainState,
  runwayCue,
  runwayOverlay,
  runwayOverlayLabel,
}: Demo2DMapSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const ownshipMarkerRef = useRef<maplibregl.Marker | null>(null);
  const waypointMarkersRef = useRef<maplibregl.Marker[]>([]);
  const trafficMarkersRef = useRef<maplibregl.Marker[]>([]);
  const diversionMarkersRef = useRef<maplibregl.Marker[]>([]);

  const routeGeoJson = useMemo(
    () => buildLineStringCollection(routePoints.map((point) => [point.longitude, point.latitude] as [number, number])),
    [routePoints],
  );
  const runwayCenterGeoJson = useMemo(
    () =>
      buildLineStringCollection(
        runwayOverlay?.centerline.map((point) => [point.longitude, point.latitude] as [number, number]) ?? [],
      ),
    [runwayOverlay],
  );
  const runwayBarGeoJson = useMemo(
    () =>
      buildLineStringCollection(
        runwayOverlay?.runwayBar.map((point) => [point.longitude, point.latitude] as [number, number]) ?? [],
      ),
    [runwayOverlay],
  );
  const selectedTrafficLineGeoJson = useMemo(() => {
    if (!selectedTrafficTarget) return buildLineStringCollection([]);
    return buildLineStringCollection([
      [ownship.lon, ownship.lat],
      [selectedTrafficTarget.lon, selectedTrafficTarget.lat],
    ]);
  }, [ownship.lat, ownship.lon, selectedTrafficTarget]);

  const mapTitle = flightPhase.startsWith("surface") ? "Surface chart" : "Chart follow";
  const mapStatusLabel =
    flightPhase === "surface-departure"
      ? "Taxi out"
      : flightPhase === "departure"
        ? "Departure corridor"
        : flightPhase === "arrival"
          ? "Arrival corridor"
          : flightPhase === "surface-arrival"
            ? "Taxi in"
            : "Enroute corridor";

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [ownship.lon, ownship.lat],
      zoom: 7.4,
      attributionControl: {},
      style: createRasterBaseStyle({
        sourceId: "osmBase",
        layerId: "rsf-demo-osm-base",
        tiles: ["https://{a,b,c}.tile.openstreetmap.org/{z}/{x}/{y}.png"],
        attribution: "&copy; OpenStreetMap contributors",
      }),
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");
    map.on("load", () => {
      upsertGeoJsonLineLayer({ map, sourceId: ROUTE_SOURCE_ID, layerId: ROUTE_LAYER_ID, data: routeGeoJson, color: "#C8922A", width: 5, opacity: 0.9 });
      upsertGeoJsonLineLayer({ map, sourceId: RUNWAY_CENTER_SOURCE_ID, layerId: RUNWAY_CENTER_LAYER_ID, data: runwayCenterGeoJson, color: "#C8922A", width: 2.6, opacity: 0.88 });
      upsertGeoJsonLineLayer({ map, sourceId: RUNWAY_BAR_SOURCE_ID, layerId: RUNWAY_BAR_LAYER_ID, data: runwayBarGeoJson, color: "#F5A623", width: 5, opacity: 0.92 });
      upsertGeoJsonLineLayer({
        map,
        sourceId: SELECTED_TRAFFIC_LINE_SOURCE_ID,
        layerId: SELECTED_TRAFFIC_LINE_LAYER_ID,
        data: selectedTrafficLineGeoJson,
        color: "#F5A623",
        width: 2,
        opacity: 0.8,
        dasharray: [2, 1],
      });
    });

    mapRef.current = map;
    return () => {
      ownshipMarkerRef.current?.remove();
      clearMarkers(waypointMarkersRef.current);
      clearMarkers(trafficMarkersRef.current);
      clearMarkers(diversionMarkersRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, [ownship.lat, ownship.lon, routeGeoJson, runwayBarGeoJson, runwayCenterGeoJson, selectedTrafficLineGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = new maplibregl.LngLatBounds([ownship.lon, ownship.lat], [ownship.lon, ownship.lat]);
    const extendRunway = () => {
      runwayOverlay?.centerline.forEach((point) => bounds.extend([point.longitude, point.latitude]));
      runwayOverlay?.runwayBar.forEach((point) => bounds.extend([point.longitude, point.latitude]));
    };

    if (flightPhase === "surface-departure" || flightPhase === "departure") {
      routePoints.slice(0, Math.min(3, routePoints.length)).forEach((point) => bounds.extend([point.longitude, point.latitude]));
      trafficTargets.slice(0, 2).forEach((target) => bounds.extend([target.lon, target.lat]));
      extendRunway();
      map.fitBounds(bounds as LngLatBoundsLike, { padding: 72, duration: 0, maxZoom: flightPhase === "surface-departure" ? 15.5 : 11.8 });
      return;
    }

    if (flightPhase === "arrival" || flightPhase === "surface-arrival") {
      routePoints.slice(Math.max(routePoints.length - 3, 0)).forEach((point) => bounds.extend([point.longitude, point.latitude]));
      trafficTargets.slice(0, 2).forEach((target) => bounds.extend([target.lon, target.lat]));
      extendRunway();
      map.fitBounds(bounds as LngLatBoundsLike, { padding: 72, duration: 0, maxZoom: flightPhase === "surface-arrival" ? 15.5 : 11.8 });
      return;
    }

    routePoints.forEach((point) => bounds.extend([point.longitude, point.latitude]));
    trafficTargets.forEach((target) => bounds.extend([target.lon, target.lat]));
    diversionCandidates.slice(0, 4).forEach((airport) => bounds.extend([airport.lon, airport.lat]));
    map.fitBounds(bounds as LngLatBoundsLike, { padding: 72, duration: 0, maxZoom: 10.5 });
  }, [diversionCandidates, flightPhase, ownship.lat, ownship.lon, routePoints, runwayOverlay, trafficTargets]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    ownshipMarkerRef.current = replaceSingleMarker({
      map,
      current: ownshipMarkerRef.current,
      createMarker: () =>
        new maplibregl.Marker({
          element: buildOwnshipElement(ownship.heading),
          anchor: "center",
        })
          .setLngLat([ownship.lon, ownship.lat])
          .addTo(map),
    });
  }, [ownship.heading, ownship.lat, ownship.lon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    waypointMarkersRef.current = replaceMarkerSet({
      map,
      current: waypointMarkersRef.current,
      items: routePoints,
      createMarker: (point) =>
        new maplibregl.Marker({
          element: buildWaypointElement(point.icao, point.kind === "origin" || point.kind === "destination", nextWaypoint === point.icao),
          anchor: "bottom",
        })
          .setLngLat([point.longitude, point.latitude])
          .addTo(map),
    });
  }, [nextWaypoint, routePoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    trafficMarkersRef.current = replaceMarkerSet({
      map,
      current: trafficMarkersRef.current,
      items: trafficTargets,
      createMarker: (target) =>
        new maplibregl.Marker({
          element: buildTrafficElement(target, selectedTrafficTarget?.id === target.id),
          anchor: "center",
        })
          .setLngLat([target.lon, target.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 12 }).setHTML(
              `<div style="font-size:12px;line-height:1.35"><strong>${target.callsign}</strong><br/>${target.clock} · ${target.distanceNm.toFixed(1)} NM<br/>${target.closureText}</div>`,
            ),
          )
          .addTo(map),
    });
  }, [selectedTrafficTarget?.id, trafficTargets]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    diversionMarkersRef.current = replaceMarkerSet({
      map,
      current: diversionMarkersRef.current,
      items: diversionCandidates.slice(0, 5),
      createMarker: (airport) =>
        new maplibregl.Marker({
          element: buildDiversionElement(airport.icao, selectedDiversion?.icao === airport.icao),
          anchor: "center",
        })
          .setLngLat([airport.lon, airport.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 12 }).setHTML(
              `<div style="font-size:12px;line-height:1.35"><strong>${airport.icao}${airport.name ? ` · ${airport.name}` : ""}</strong><br/>${airport.distanceNm.toFixed(1)} NM · ${airport.flightCategory || "WX --"}</div>`,
            ),
          )
          .addTo(map),
    });
  }, [diversionCandidates, selectedDiversion?.icao]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    setGeoJsonSourceData(map, ROUTE_SOURCE_ID, routeGeoJson);
    if (runwayOverlay) {
      if (map.getSource(RUNWAY_CENTER_SOURCE_ID) && map.getSource(RUNWAY_BAR_SOURCE_ID)) {
        setGeoJsonSourceData(map, RUNWAY_CENTER_SOURCE_ID, runwayCenterGeoJson);
        setGeoJsonSourceData(map, RUNWAY_BAR_SOURCE_ID, runwayBarGeoJson);
      } else {
        upsertGeoJsonLineLayer({ map, sourceId: RUNWAY_CENTER_SOURCE_ID, layerId: RUNWAY_CENTER_LAYER_ID, data: runwayCenterGeoJson, color: "#C8922A", width: 2.6, opacity: 0.88 });
        upsertGeoJsonLineLayer({ map, sourceId: RUNWAY_BAR_SOURCE_ID, layerId: RUNWAY_BAR_LAYER_ID, data: runwayBarGeoJson, color: "#F5A623", width: 5, opacity: 0.92 });
      }
    } else {
      removeGeoJsonLayer(map, RUNWAY_CENTER_SOURCE_ID, RUNWAY_CENTER_LAYER_ID);
      removeGeoJsonLayer(map, RUNWAY_BAR_SOURCE_ID, RUNWAY_BAR_LAYER_ID);
    }
    if (selectedTrafficTarget) {
      if (map.getSource(SELECTED_TRAFFIC_LINE_SOURCE_ID)) {
        setGeoJsonSourceData(map, SELECTED_TRAFFIC_LINE_SOURCE_ID, selectedTrafficLineGeoJson);
      } else {
        upsertGeoJsonLineLayer({
          map,
          sourceId: SELECTED_TRAFFIC_LINE_SOURCE_ID,
          layerId: SELECTED_TRAFFIC_LINE_LAYER_ID,
          data: selectedTrafficLineGeoJson,
          color: "#F5A623",
          width: 2,
          opacity: 0.8,
          dasharray: [2, 1],
        });
      }
    } else {
      removeGeoJsonLayer(map, SELECTED_TRAFFIC_LINE_SOURCE_ID, SELECTED_TRAFFIC_LINE_LAYER_ID);
    }
  }, [routeGeoJson, runwayBarGeoJson, runwayCenterGeoJson, runwayOverlay, selectedTrafficLineGeoJson, selectedTrafficTarget]);

  return (
    <div className="relative h-[420px] overflow-hidden rounded-[24px] border border-slate-800 bg-[#0A0E14]">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-x-4 top-4 flex items-center justify-between">
        <div className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
          {mapTitle}
        </div>
        <div className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
          {runwayOverlayLabel || (runwayCue ? `Final ${runwayCue.runwayId}` : "Track up")}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-4 bottom-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[#1E2D42] bg-[#091018]/90 px-4 py-3">
          <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${RSF_COCKPIT_MUTED_TEXT_CLASS}`}>Terrain</div>
          <div className="mt-1 text-sm font-semibold text-[#E8EDF4]">
            {terrainState ? `${terrainState.terrainClearanceFt.toLocaleString()} ft clr` : "Preview layer"}
          </div>
          <div className={`mt-1 text-xs ${RSF_COCKPIT_MUTED_TEXT_CLASS}`}>{terrainState?.guidance ?? "Tactical terrain overlay preview."}</div>
        </div>
        <div className="rounded-2xl border border-[#1E2D42] bg-[#091018]/90 px-4 py-3">
          <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${RSF_COCKPIT_MUTED_TEXT_CLASS}`}>Traffic</div>
          <div className="mt-1 text-sm font-semibold text-[#E8EDF4]">
            {selectedTrafficTarget
              ? `${selectedTrafficTarget.callsign} ${selectedTrafficTarget.distanceNm.toFixed(1)} NM`
              : "No traffic target"}
          </div>
          <div className={`mt-1 text-xs ${RSF_COCKPIT_MUTED_TEXT_CLASS}`}>
            {selectedTrafficTarget
              ? `${selectedTrafficTarget.clock} - ${selectedTrafficTarget.altitudeDeltaFt > 0 ? "+" : ""}${Math.round(selectedTrafficTarget.altitudeDeltaFt)} ft - ${selectedTrafficTarget.closureText}`
              : "Traffic preview idle"}
          </div>
        </div>
        <div className="rounded-2xl border border-[#1E2D42] bg-[#091018]/90 px-4 py-3">
          <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${RSF_COCKPIT_MUTED_TEXT_CLASS}`}>Diversion</div>
          <div className="mt-1 text-sm font-semibold text-[#E8EDF4]">
            {selectedDiversion ? `${selectedDiversion.icao} ${selectedDiversion.distanceNm.toFixed(1)} NM` : "Scanning nearby"}
          </div>
          <div className={`mt-1 text-xs ${RSF_COCKPIT_MUTED_TEXT_CLASS}`}>
            {selectedDiversion
              ? `${selectedDiversion.maxRunwayFt?.toLocaleString() || "--"} ft - ${selectedDiversion.flightCategory || "WX --"}`
              : "Nearby-airport lookup"}
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute left-4 top-14 rounded-full border border-[#1E2D42] bg-[#091018]/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7A9BB8]">
        {mapStatusLabel}
      </div>
      <div className="pointer-events-none absolute right-4 top-14 rounded-full border border-[#1E2D42] bg-[#091018]/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7A9BB8]">
        {Math.round(remainingRouteNm)} NM remain
      </div>
    </div>
  );
}
