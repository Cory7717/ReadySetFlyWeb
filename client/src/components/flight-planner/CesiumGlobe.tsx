import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import { apiUrl } from "@/lib/api";
import { clearTfmsOverlay, setTfmsOverlay } from "@/map/layers/tfmsOverlayLayer";

import type { PlannerPoint, PlannerTerrainHotSpot, PlannerTerrainSegment } from "@/components/flight-planner/PlannerMap";

const OSM_URL = "https://a.tile.openstreetmap.org/";
const GIBS_BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const NIGHT_LAYER = "VIIRS_Black_Marble";
const NIGHT_DATE = "2012-01-01";

const buildPositions = (points: PlannerPoint[]) =>
  points.flatMap((point) => [point.lon, point.lat]);

const terrainRiskVisuals = {
  comfortable: {
    corridor: Cesium.Color.fromCssColorString("#22c55e").withAlpha(0.16),
    line: Cesium.Color.fromCssColorString("#4ade80"),
    width: 10,
  },
  caution: {
    corridor: Cesium.Color.fromCssColorString("#f59e0b").withAlpha(0.2),
    line: Cesium.Color.fromCssColorString("#fbbf24"),
    width: 12,
  },
  warning: {
    corridor: Cesium.Color.fromCssColorString("#ef4444").withAlpha(0.24),
    line: Cesium.Color.fromCssColorString("#f87171"),
    width: 14,
  },
} as const;

export default function CesiumGlobe({
  points,
  heightClassName = "h-[380px]",
  tfmsOverlayEnabled = false,
  plannedAltitudeFt,
  terrainSegments = [],
  terrainHotSpots = [],
}: {
  points: PlannerPoint[];
  heightClassName?: string;
  tfmsOverlayEnabled?: boolean;
  plannedAltitudeFt?: number;
  terrainSegments?: PlannerTerrainSegment[];
  terrainHotSpots?: PlannerTerrainHotSpot[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [tokenWarning, setTokenWarning] = useState<string | null>(null);
  const [showClouds, setShowClouds] = useState(true);
  const [showRadar, setShowRadar] = useState(true);
  const [showNight, setShowNight] = useState(true);
  const [showAtmosphere, setShowAtmosphere] = useState(true);
  const [cloudFrame, setCloudFrame] = useState<string | null>(null);
  const [radarFrame, setRadarFrame] = useState<string | null>(null);
  const cloudLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const radarLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const nightLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const overlayAbortRef = useRef<AbortController | null>(null);
  const overlayTimerRef = useRef<number | null>(null);
  const lastOverlayBboxRef = useRef<string | null>(null);

  const runtimeIonToken = (globalThis as any).CESIUM_ION_TOKEN as string | undefined;
  const envIonToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;
  const ionToken = envIonToken || runtimeIonToken || "";
  const hasIonToken = Boolean(ionToken);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const cesiumBaseUrl = `${import.meta.env.BASE_URL || "/"}cesium/`;
    (globalThis as any).CESIUM_BASE_URL = cesiumBaseUrl;

    let cancelled = false;

    const ensureWidgetsCss = () => {
      const href = `${cesiumBaseUrl}Widgets/widgets.css`;
      if (typeof document === "undefined") return;
      if (document.querySelector(`link[data-cesium-widgets][href="${href}"]`)) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.cesiumWidgets = "true";
      document.head.appendChild(link);
    };

    ensureWidgetsCss();

    const setBaseUrl = (Cesium as any).buildModuleUrl?.setBaseUrl;
    if (typeof setBaseUrl === "function") {
      setBaseUrl(cesiumBaseUrl);
    }

    if (hasIonToken) {
      Cesium.Ion.defaultAccessToken = String(ionToken);
    } else {
      setTokenWarning("Add VITE_CESIUM_ION_TOKEN for terrain and premium imagery.");
    }

    const viewer = new Cesium.Viewer(containerRef.current as HTMLDivElement, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      shouldAnimate: true,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    });

    const controller = viewer.scene.screenSpaceCameraController;
    controller.enableZoom = false;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const height = viewer.camera.positionCartographic.height;
      const zoomFactor = Math.max(0.05, Math.min(0.5, Math.abs(event.deltaY) / 600));
      const amount = Math.max(200, height * zoomFactor);
      if (event.deltaY > 0) {
        viewer.camera.zoomOut(amount);
      } else {
        viewer.camera.zoomIn(amount);
      }
    };
    const canvas = viewer.scene.canvas;
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({ url: OSM_URL })
    );

    if (hasIonToken) {
      Cesium.createWorldTerrainAsync()
        .then((terrain) => {
          if (cancelled || !viewerRef.current) return;
          viewerRef.current.terrainProvider = terrain;
        })
        .catch(() => null);
    }

    viewerRef.current = viewer;

    return () => {
      cancelled = true;
      if (viewerRef.current) {
        canvas.removeEventListener("wheel", handleWheel);
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [hasIonToken]);

  useEffect(() => {
    if (!showClouds) {
      setCloudFrame(null);
      return;
    }
    let active = true;
    const loadFrame = async () => {
      try {
        const res = await fetch(apiUrl("/api/aviation/cloud-frames?source=goes-east&count=6&intervalMin=10"));
        if (!res.ok) return;
        const data = await res.json();
        const frames = Array.isArray(data?.frames) ? data.frames.filter(Boolean) : [];
        if (!active) return;
        setCloudFrame(frames.length ? frames[frames.length - 1] : null);
      } catch {
        if (active) setCloudFrame(null);
      }
    };
    loadFrame();
    const timer = window.setInterval(loadFrame, 1000 * 60 * 5);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [showClouds]);

  useEffect(() => {
    if (!showRadar) {
      setRadarFrame(null);
      return;
    }
    let active = true;
    const loadRadar = async () => {
      try {
        const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");
        if (!response.ok) return;
        const data = await response.json();
        const frames = [
          ...(data?.radar?.past || []),
          ...(data?.radar?.nowcast || [])
        ]
          .map((item: { path?: string }) => item.path)
          .filter(Boolean) as string[];
        if (!active) return;
        const last = frames.length ? frames[frames.length - 1] : null;
        setRadarFrame(last);
      } catch {
        if (active) setRadarFrame(null);
      }
    };
    loadRadar();
    const timer = window.setInterval(loadRadar, 1000 * 60 * 5);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [showRadar]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (!showClouds || !cloudFrame) {
      if (cloudLayerRef.current) {
        viewer.imageryLayers.remove(cloudLayerRef.current, true);
        cloudLayerRef.current = null;
      }
      return;
    }
    const frame = encodeURIComponent(cloudFrame);
    const url = `${GIBS_BASE}/GOES-East_ABI_GeoColor/default/${frame}/GoogleMapsCompatible_Level4/{z}/{y}/{x}.jpg`;
    const provider = new Cesium.UrlTemplateImageryProvider({
      url,
      credit: "NASA GIBS (GOES-East GeoColor)",
      maximumLevel: 8,
    });
    if (cloudLayerRef.current) {
      viewer.imageryLayers.remove(cloudLayerRef.current, true);
    }
    cloudLayerRef.current = viewer.imageryLayers.addImageryProvider(provider);
    cloudLayerRef.current.alpha = 0.6;
  }, [showClouds, cloudFrame]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (!showRadar || !radarFrame) {
      if (radarLayerRef.current) {
        viewer.imageryLayers.remove(radarLayerRef.current, true);
        radarLayerRef.current = null;
      }
      return;
    }
    const normalizedFrame = radarFrame.replace(/^\/??v2\/radar\//, "");
    const url = apiUrl(`/api/tiles/rainviewer/v2/radar/${normalizedFrame}/256/{z}/{x}/{y}/2/1_1.png`);
    const provider = new Cesium.UrlTemplateImageryProvider({
      url,
      credit: "RainViewer",
      maximumLevel: 8,
    });
    if (radarLayerRef.current) {
      viewer.imageryLayers.remove(radarLayerRef.current, true);
    }
    radarLayerRef.current = viewer.imageryLayers.addImageryProvider(provider);
    radarLayerRef.current.alpha = 0.55;
  }, [showRadar, radarFrame]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (!nightLayerRef.current) {
      const url = `${GIBS_BASE}/${NIGHT_LAYER}/default/${NIGHT_DATE}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg`;
      const provider = new Cesium.UrlTemplateImageryProvider({
        url,
        credit: "NASA GIBS (Black Marble)",
        maximumLevel: 8,
      });
      nightLayerRef.current = viewer.imageryLayers.addImageryProvider(provider, 0);
      nightLayerRef.current.alpha = 0.45;
    }
    nightLayerRef.current.show = showNight;
  }, [showNight]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = showAtmosphere;
    }
    viewer.scene.globe.enableLighting = showAtmosphere;
    (viewer.scene.globe as any).dynamicAtmosphereLighting = showAtmosphere;
    if (viewer.scene.sun) {
      viewer.scene.sun.show = showAtmosphere;
    }
  }, [showAtmosphere]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (!tfmsOverlayEnabled) {
      lastOverlayBboxRef.current = null;
      clearTfmsOverlay(viewer);
      return;
    }

    let active = true;

    const computeViewBbox = () => {
      const rectangle = viewer.camera.computeViewRectangle();
      if (!rectangle) return null;
      let west = Cesium.Math.toDegrees(rectangle.west);
      let south = Cesium.Math.toDegrees(rectangle.south);
      let east = Cesium.Math.toDegrees(rectangle.east);
      let north = Cesium.Math.toDegrees(rectangle.north);

      if (!Number.isFinite(west) || !Number.isFinite(east) || !Number.isFinite(south) || !Number.isFinite(north)) {
        return null;
      }

      if (west > east) {
        west = -180;
        east = 180;
      }

      return [west, south, east, north].map((value) => value.toFixed(5)).join(",");
    };

    const fetchOverlay = async () => {
      const bbox = computeViewBbox();
      if (!bbox || bbox === lastOverlayBboxRef.current) return;
      lastOverlayBboxRef.current = bbox;

      if (overlayAbortRef.current) {
        overlayAbortRef.current.abort();
      }
      const controller = new AbortController();
      overlayAbortRef.current = controller;

      try {
        const response = await fetch(apiUrl(`/api/tfms/overlay?bbox=${encodeURIComponent(bbox)}`), {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!active) return;
        await setTfmsOverlay(viewer, data?.features || [], data?.styleHints);
      } catch (error: any) {
        if (error?.name === "AbortError") return;
      }
    };

    const scheduleFetch = () => {
      if (overlayTimerRef.current) {
        window.clearTimeout(overlayTimerRef.current);
      }
      overlayTimerRef.current = window.setTimeout(fetchOverlay, 800);
    };

    scheduleFetch();
    const listener = () => scheduleFetch();
    viewer.camera.changed.addEventListener(listener);

    return () => {
      active = false;
      viewer.camera.changed.removeEventListener(listener);
      if (overlayTimerRef.current) {
        window.clearTimeout(overlayTimerRef.current);
        overlayTimerRef.current = null;
      }
      if (overlayAbortRef.current) {
        overlayAbortRef.current.abort();
        overlayAbortRef.current = null;
      }
      clearTfmsOverlay(viewer);
    };
  }, [tfmsOverlayEnabled]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.entities.removeAll();

    if (points.length === 0) return;

    const positions = buildPositions(points);
    const polylinePositions = Cesium.Cartesian3.fromDegreesArray(positions);
    const routeAltitudeMeters =
      plannedAltitudeFt && Number.isFinite(plannedAltitudeFt) && plannedAltitudeFt > 0
        ? Math.max(250, plannedAltitudeFt * 0.3048)
        : 600;

    if (terrainSegments.length > 0) {
      terrainSegments.forEach((segment) => {
        const [[startLat, startLon], [endLat, endLon]] = segment.positions;
        const visuals = terrainRiskVisuals[segment.risk];
        const elevatedPositions = Cesium.Cartesian3.fromDegreesArrayHeights([
          startLon,
          startLat,
          routeAltitudeMeters,
          endLon,
          endLat,
          routeAltitudeMeters,
        ]);

        viewer.entities.add({
          polyline: {
            positions: elevatedPositions,
            width: visuals.width + 8,
            material: new Cesium.PolylineGlowMaterialProperty({
              color: visuals.corridor,
              glowPower: 0.3,
              taperPower: 0.8,
            }),
          },
        });

        viewer.entities.add({
          wall: {
            positions: Cesium.Cartesian3.fromDegreesArray([
              startLon,
              startLat,
              endLon,
              endLat,
            ]),
            maximumHeights: [routeAltitudeMeters, routeAltitudeMeters],
            minimumHeights: [0, 0],
            material: visuals.corridor,
            outline: false,
          },
        });

        viewer.entities.add({
          polyline: {
            positions: elevatedPositions,
            width: visuals.width,
            material: new Cesium.PolylineGlowMaterialProperty({
              color: visuals.line,
              glowPower: 0.15,
            }),
          },
          description:
            `Terrain clearance: ${segment.clearanceFt != null ? `${Math.round(segment.clearanceFt).toLocaleString()} ft` : "Unknown"}\n` +
            `Highest terrain: ${segment.maxElevationFt != null ? `${Math.round(segment.maxElevationFt).toLocaleString()} ft` : "Unknown"}`,
        });
      });
    }

    viewer.entities.add({
      polyline: {
        positions: polylinePositions,
        width: terrainSegments.length > 0 ? 2 : 4,
        material: Cesium.Color.fromCssColorString("#67e8f9"),
      },
    });

    points.forEach((point, index) => {
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(point.lon, point.lat, routeAltitudeMeters),
        label: {
          text: index === 0 ? `${point.icao} · DEP` : index === points.length - 1 ? `${point.icao} · DEST` : point.icao,
          font: "14px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
        },
        point: {
          pixelSize: index === 0 || index === points.length - 1 ? 10 : 8,
          color: index === 0
            ? Cesium.Color.fromCssColorString("#34d399")
            : index === points.length - 1
              ? Cesium.Color.fromCssColorString("#60a5fa")
              : Cesium.Color.CYAN,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
        },
      });
    });

    terrainHotSpots.forEach((hotSpot) => {
      const tone =
        hotSpot.risk === "warning"
          ? Cesium.Color.fromCssColorString("#ef4444")
          : hotSpot.risk === "caution"
            ? Cesium.Color.fromCssColorString("#f59e0b")
            : Cesium.Color.fromCssColorString("#22c55e");

      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(hotSpot.lon, hotSpot.lat, routeAltitudeMeters + 350),
        label: {
          text: `#${hotSpot.rank} ${hotSpot.progressLabel}`,
          font: "13px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          showBackground: true,
          backgroundColor: tone.withAlpha(0.9),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -18),
        },
        point: {
          pixelSize: 12,
          color: tone,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        description:
          `Terrain hot spot ${hotSpot.rank}\n` +
          `Progress: ${hotSpot.progressLabel}\n` +
          `Highest terrain: ${hotSpot.maxElevationFt != null ? `${Math.round(hotSpot.maxElevationFt).toLocaleString()} ft` : "Unknown"}\n` +
          `Clearance: ${hotSpot.clearanceFt != null ? `${Math.round(hotSpot.clearanceFt).toLocaleString()} ft` : "Unknown"}`,
      });
    });

    viewer.zoomTo(viewer.entities, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-30), 0));
  }, [plannedAltitudeFt, points, terrainHotSpots, terrainSegments]);

  return (
    <div className={heightClassName}>
      <div className="relative h-full w-full rounded-xl overflow-hidden">
        {tokenWarning && (
          <div className="absolute left-3 top-3 z-[1100] rounded-md border bg-white/90 px-3 py-2 text-xs text-slate-700 shadow">
            {tokenWarning}
          </div>
        )}
        <div className="absolute right-3 top-3 z-[1100] space-y-2 rounded-md border bg-white/90 px-3 py-2 text-xs text-slate-700 shadow">
          <div className="font-semibold">Globe overlays</div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showClouds} onChange={(e) => setShowClouds(e.target.checked)} />
            Clouds
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showRadar} onChange={(e) => setShowRadar(e.target.checked)} />
            Radar
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showNight} onChange={(e) => setShowNight(e.target.checked)} />
            Night lights
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showAtmosphere} onChange={(e) => setShowAtmosphere(e.target.checked)} />
            Atmosphere
          </label>
          {!hasIonToken && (
            <div className="text-[11px] text-slate-500">Terrain needs Ion token.</div>
          )}
        </div>
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
