import { useEffect, useMemo, useRef, useState } from "react";
import * as Cesium from "cesium";
import { apiUrl } from "@/lib/api";

import type { PlannerPoint } from "@/components/flight-planner/PlannerMap";

const OSM_URL = "https://a.tile.openstreetmap.org/";
const GIBS_BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const NIGHT_LAYER = "VIIRS_Black_Marble";
const NIGHT_DATE = "2012-01-01";

const buildPositions = (points: PlannerPoint[]) =>
  points.flatMap((point) => [point.lon, point.lat]);

export default function CesiumGlobe({
  points,
  heightClassName = "h-[380px]",
}: {
  points: PlannerPoint[];
  heightClassName?: string;
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
    const url = `https://tilecache.rainviewer.com/v2/radar/${normalizedFrame}/256/{z}/{x}/{y}/2/1_1.png`;
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
    viewer.scene.skyAtmosphere.show = showAtmosphere;
    viewer.scene.globe.enableLighting = showAtmosphere;
    (viewer.scene.globe as any).dynamicAtmosphereLighting = showAtmosphere;
    viewer.scene.sun.show = showAtmosphere;
  }, [showAtmosphere]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.entities.removeAll();

    if (points.length === 0) return;

    const positions = buildPositions(points);
    const polylinePositions = Cesium.Cartesian3.fromDegreesArray(positions);

    viewer.entities.add({
      polyline: {
        positions: polylinePositions,
        width: 3,
        material: Cesium.Color.CYAN,
      },
    });

    points.forEach((point) => {
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(point.lon, point.lat),
        label: {
          text: point.icao,
          font: "14px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
        },
        point: {
          pixelSize: 8,
          color: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
        },
      });
    });

    viewer.zoomTo(viewer.entities, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-30), 0));
  }, [points]);

  const tokenHint = useMemo(() => tokenWarning, [tokenWarning]);

  return (
    <div className={heightClassName}>
      <div className="relative h-full w-full rounded-xl overflow-hidden">
        {tokenHint && (
          <div className="absolute left-3 top-3 z-[1100] rounded-md border bg-white/90 px-3 py-2 text-xs text-slate-700 shadow">
            {tokenHint}
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
