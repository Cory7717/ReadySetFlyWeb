import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import { apiUrl } from "@/lib/api";
import { clearTfmsOverlay, setTfmsOverlay } from "@/map/layers/tfmsOverlayLayer";
import { RSF_TERRAIN_RISK_STYLES } from "@/map/rsfMapSpec";
import type { RunwayOverlay } from "@shared/flight-scene";
import type { FeatureCollection } from "geojson";
import type { PlannerPoint, PlannerTerrainHotSpot, PlannerTerrainSegment } from "@/components/flight-planner/plannerMapTypes";

const OSM_URL = "https://a.tile.openstreetmap.org/";
const GIBS_BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const NIGHT_LAYER = "VIIRS_Black_Marble";
const NIGHT_DATE = "2012-01-01";

const buildPositions = (points: PlannerPoint[]) =>
  points.flatMap((point) => [point.lon, point.lat]);

const terrainRiskVisuals = {
  comfortable: {
    corridor: Cesium.Color.fromCssColorString(RSF_TERRAIN_RISK_STYLES.comfortable.color).withAlpha(0.16),
    line: Cesium.Color.fromCssColorString(RSF_TERRAIN_RISK_STYLES.comfortable.color),
    width: 10,
  },
  caution: {
    corridor: Cesium.Color.fromCssColorString(RSF_TERRAIN_RISK_STYLES.caution.color).withAlpha(0.2),
    line: Cesium.Color.fromCssColorString(RSF_TERRAIN_RISK_STYLES.caution.color),
    width: 12,
  },
  warning: {
    corridor: Cesium.Color.fromCssColorString(RSF_TERRAIN_RISK_STYLES.warning.color).withAlpha(0.24),
    line: Cesium.Color.fromCssColorString(RSF_TERRAIN_RISK_STYLES.warning.color),
    width: 14,
  },
} as const;

type GlobeRunwayOverlay = {
  overlay: RunwayOverlay;
  label?: string | null;
  tone?: "departure" | "arrival";
};

type GlobeOwnship = {
  lat: number;
  lon: number;
  altitudeFt?: number | null;
  headingDeg?: number | null;
};

type GlobeGeoJsonOverlay = {
  id: string;
  data: FeatureCollection | null | undefined;
  strokeColor?: string;
  fillColor?: string;
  opacity?: number;
};

type GlobeTrafficTarget = {
  id: string | number;
  lat: number;
  lon: number;
  altitudeFt?: number | null;
  relativeAltitudeFt?: number | null;
  trackDeg?: number | null;
  threatLevel?: "monitor" | "advisory" | "immediate";
  label?: string | null;
};

type GlobeObstacle = {
  id: string | number;
  lat: number;
  lon: number;
  amslFt?: number | null;
  aglFt?: number | null;
  kind?: string | null;
};

type GlobeDiversionAirport = {
  icao: string;
  lat: number;
  lon: number;
  maxRunwayFt?: number | null;
  immediateReady?: boolean;
};

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

function colorFromHex(hex: string) {
  const color = Cesium.Color.fromCssColorString(hex);
  return [color.red, color.green, color.blue, color.alpha];
}

let simpleAircraftModelUriCache: string | null = null;

function buildSimpleAircraftModelUri() {
  if (simpleAircraftModelUriCache) return simpleAircraftModelUriCache;

  // X=right wing, Y=nose-forward, Z=up for local ENU heading alignment.
  const positions = new Float32Array([
    0.0, 4.2, 0.0,
    -0.35, 2.2, 0.25,
    0.35, 2.2, 0.25,
    -0.35, 2.2, -0.25,
    0.35, 2.2, -0.25,
    -4.8, 0.4, 0.0,
    4.8, 0.4, 0.0,
    -0.2, -2.6, 0.35,
    0.2, -2.6, 0.35,
    -0.2, -2.8, -0.2,
    0.2, -2.8, -0.2,
    -1.8, -2.1, 0.0,
    1.8, -2.1, 0.0,
    0.0, -3.4, 1.1,
  ]);

  const indices = new Uint16Array([
    0, 1, 2,
    0, 2, 4,
    0, 4, 3,
    0, 3, 1,
    1, 5, 3,
    2, 4, 6,
    7, 8, 13,
    7, 11, 13,
    8, 12, 13,
    9, 10, 11,
    10, 12, 11,
    7, 9, 10,
    7, 10, 8,
  ]);

  const positionBytes = new Uint8Array(positions.buffer);
  const indexBytes = new Uint8Array(indices.buffer);
  const combined = new Uint8Array(positionBytes.byteLength + indexBytes.byteLength);
  combined.set(positionBytes, 0);
  combined.set(indexBytes, positionBytes.byteLength);

  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (let index = 0; index < positions.length; index += 3) {
    min[0] = Math.min(min[0], positions[index]);
    min[1] = Math.min(min[1], positions[index + 1]);
    min[2] = Math.min(min[2], positions[index + 2]);
    max[0] = Math.max(max[0], positions[index]);
    max[1] = Math.max(max[1], positions[index + 1]);
    max[2] = Math.max(max[2], positions[index + 2]);
  }

  const gltf = {
    asset: { version: "2.0", generator: "RSF CesiumGlobe" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0 },
            indices: 1,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: colorFromHex("#3b82f6"),
          metallicFactor: 0.15,
          roughnessFactor: 0.7,
        },
        doubleSided: true,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: positions.length / 3,
        type: "VEC3",
        min,
        max,
      },
      {
        bufferView: 1,
        componentType: 5123,
        count: indices.length,
        type: "SCALAR",
      },
    ],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: 0,
        byteLength: positionBytes.byteLength,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: positionBytes.byteLength,
        byteLength: indexBytes.byteLength,
        target: 34963,
      },
    ],
    buffers: [
      {
        byteLength: combined.byteLength,
        uri: `data:application/octet-stream;base64,${toBase64(combined)}`,
      },
    ],
  };

  simpleAircraftModelUriCache = `data:model/gltf+json;base64,${btoa(JSON.stringify(gltf))}`;
  return simpleAircraftModelUriCache;
}

function normalizeFeatureCollection(input: FeatureCollection | null | undefined) {
  if (!input || input.type !== "FeatureCollection") {
    return { type: "FeatureCollection", features: [] } as FeatureCollection;
  }
  return input;
}

export default function CesiumGlobe({
  points,
  heightClassName = "h-[380px]",
  tfmsOverlayEnabled = false,
  plannedAltitudeFt,
  terrainSegments = [],
  terrainHotSpots = [],
  runwayOverlays = [],
  ownship = null,
  geoJsonOverlays = [],
  trafficTargets = [],
  obstacles = [],
  diversionAirports = [],
  rangeRingNm,
  cameraMode = "overview",
  cameraRangeNm,
}: {
  points: PlannerPoint[];
  heightClassName?: string;
  tfmsOverlayEnabled?: boolean;
  plannedAltitudeFt?: number;
  terrainSegments?: PlannerTerrainSegment[];
  terrainHotSpots?: PlannerTerrainHotSpot[];
  runwayOverlays?: GlobeRunwayOverlay[];
  ownship?: GlobeOwnship | null;
  geoJsonOverlays?: GlobeGeoJsonOverlay[];
  trafficTargets?: GlobeTrafficTarget[];
  obstacles?: GlobeObstacle[];
  diversionAirports?: GlobeDiversionAirport[];
  rangeRingNm?: number;
  cameraMode?: "overview" | "follow-ownship";
  cameraRangeNm?: number;
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
  const geoJsonOverlayRefs = useRef<Cesium.DataSource[]>([]);

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
    controller.enableZoom = true;
    controller.enableTilt = true;
    controller.enableTranslate = true;
    controller.enableLook = true;
    controller.minimumZoomDistance = 200;
    controller.maximumZoomDistance = 20_000_000;

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

    geoJsonOverlayRefs.current.forEach((dataSource) => {
      viewer.dataSources.remove(dataSource, true);
    });
    geoJsonOverlayRefs.current = [];

    let cancelled = false;

    const loadOverlays = async () => {
      for (const overlay of geoJsonOverlays) {
        const featureCollection = normalizeFeatureCollection(overlay.data);
        if (!featureCollection.features.length) continue;

        const dataSource = await Cesium.GeoJsonDataSource.load(featureCollection, {
          clampToGround: true,
        });
        const stroke = Cesium.Color.fromCssColorString(overlay.strokeColor || "#38bdf8");
        const fill = Cesium.Color.fromCssColorString(overlay.fillColor || overlay.strokeColor || "#38bdf8")
          .withAlpha(Math.max(0.08, Math.min(0.75, overlay.opacity ?? 0.18)));

        dataSource.entities.values.forEach((entity) => {
          if (entity.polygon) {
            entity.polygon.material = new Cesium.ColorMaterialProperty(fill);
            entity.polygon.outline = new Cesium.ConstantProperty(true);
            entity.polygon.outlineColor = new Cesium.ConstantProperty(stroke);
          }
          if (entity.polyline) {
            entity.polyline.material = new Cesium.ColorMaterialProperty(stroke);
            entity.polyline.width = new Cesium.ConstantProperty(2);
          }
          if (entity.point) {
            entity.point.color = new Cesium.ConstantProperty(stroke);
            entity.point.pixelSize = new Cesium.ConstantProperty(8);
          }
        });

        if (cancelled) {
          viewer.dataSources.remove(dataSource, true);
          continue;
        }
        viewer.dataSources.add(dataSource);
        geoJsonOverlayRefs.current.push(dataSource);
      }
    };

    void loadOverlays();

    return () => {
      cancelled = true;
      geoJsonOverlayRefs.current.forEach((dataSource) => {
        viewer.dataSources.remove(dataSource, true);
      });
      geoJsonOverlayRefs.current = [];
    };
  }, [geoJsonOverlays]);

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
        width: terrainSegments.length > 0 ? 10 : 12,
        material: new Cesium.PolylineGlowMaterialProperty({
          color: Cesium.Color.fromCssColorString("#67e8f9").withAlpha(0.26),
          glowPower: 0.22,
          taperPower: 0.78,
        }),
      },
    });

    viewer.entities.add({
      polyline: {
        positions: polylinePositions,
        width: terrainSegments.length > 0 ? 3 : 5,
        material: new Cesium.PolylineGlowMaterialProperty({
          color: Cesium.Color.fromCssColorString("#67e8f9"),
          glowPower: 0.08,
        }),
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

    runwayOverlays.forEach(({ overlay, label, tone }) => {
      const centerlineColor =
        tone === "arrival"
          ? Cesium.Color.fromCssColorString("#f59e0b")
          : Cesium.Color.fromCssColorString("#22c55e");
      const runwayBarColor =
        tone === "arrival"
          ? Cesium.Color.fromCssColorString("#fde68a")
          : Cesium.Color.fromCssColorString("#86efac");
      const centerlinePositions = Cesium.Cartesian3.fromDegreesArray(
        overlay.centerline.flatMap((point) => [point.longitude, point.latitude]),
      );
      const runwayBarPositions = Cesium.Cartesian3.fromDegreesArray(
        overlay.runwayBar.flatMap((point) => [point.longitude, point.latitude]),
      );

      viewer.entities.add({
        polyline: {
          positions: centerlinePositions,
          width: tone === "arrival" ? 7 : 6,
          material: new Cesium.PolylineGlowMaterialProperty({
            color: centerlineColor.withAlpha(0.95),
            glowPower: 0.22,
          }),
          clampToGround: true,
        },
      });

      viewer.entities.add({
        polyline: {
          positions: runwayBarPositions,
          width: 8,
          material: runwayBarColor.withAlpha(0.95),
          clampToGround: true,
        },
      });

      const thresholdMidpoint = {
        latitude: (overlay.runwayBar[0]?.latitude + overlay.runwayBar[1]?.latitude) / 2,
        longitude: (overlay.runwayBar[0]?.longitude + overlay.runwayBar[1]?.longitude) / 2,
      };
      if (Number.isFinite(thresholdMidpoint.latitude) && Number.isFinite(thresholdMidpoint.longitude) && label) {
        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(
            thresholdMidpoint.longitude,
            thresholdMidpoint.latitude,
            45,
          ),
          label: {
            text: label,
            font: "13px sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            showBackground: true,
            backgroundColor: centerlineColor.withAlpha(0.82),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -12),
          },
        });
      }
    });

    if (ownship) {
      const ownshipAltitudeMeters =
        ownship.altitudeFt && Number.isFinite(ownship.altitudeFt)
          ? Math.max(180, ownship.altitudeFt * 0.3048)
          : routeAltitudeMeters;
      const ownshipPosition = Cesium.Cartesian3.fromDegrees(ownship.lon, ownship.lat, ownshipAltitudeMeters);
      viewer.entities.add({
        position: ownshipPosition,
        orientation: Cesium.Transforms.headingPitchRollQuaternion(
          ownshipPosition,
          new Cesium.HeadingPitchRoll(
            Cesium.Math.toRadians(ownship.headingDeg ?? 0),
            0,
            0,
          ),
        ),
        model: {
          uri: buildSimpleAircraftModelUri(),
          scale: 36,
          minimumPixelSize: 52,
          maximumScale: 80,
        },
        label: {
          text: ownship.headingDeg != null ? `OWN ${Math.round(ownship.headingDeg).toString().padStart(3, "0")}` : "OWN",
          font: "13px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString("#1d4ed8").withAlpha(0.85),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -22),
        },
      });

      if (rangeRingNm && Number.isFinite(rangeRingNm) && rangeRingNm > 0) {
        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(ownship.lon, ownship.lat, 0),
          ellipse: {
            semiMajorAxis: rangeRingNm * 1852,
            semiMinorAxis: rangeRingNm * 1852,
            material: Cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.06),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.55),
            height: 0,
          },
        });
      }
    }

    trafficTargets.forEach((target) => {
      const trafficAltitudeMeters =
        target.altitudeFt && Number.isFinite(target.altitudeFt)
          ? Math.max(150, target.altitudeFt * 0.3048)
          : routeAltitudeMeters;
      const tone =
        target.threatLevel === "immediate"
          ? "#ef4444"
          : target.threatLevel === "advisory"
            ? "#f59e0b"
            : "#14b8a6";
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(target.lon, target.lat, trafficAltitudeMeters),
        point: {
          pixelSize: target.threatLevel === "immediate" ? 14 : 11,
          color: Cesium.Color.fromCssColorString(tone),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text:
            `${target.label || String(target.id)}${
              target.relativeAltitudeFt != null
                ? ` ${target.relativeAltitudeFt > 0 ? "+" : ""}${Math.round(target.relativeAltitudeFt)}`
                : ""
            }`,
          font: "12px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString(tone).withAlpha(0.78),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -14),
        },
      });

      if (target.trackDeg != null && Number.isFinite(target.trackDeg)) {
        const vectorLengthMeters = 6 * 1852;
        const headingRad = Cesium.Math.toRadians(target.trackDeg);
        const endLon = target.lon + (Math.sin(headingRad) * vectorLengthMeters) / (111320 * Math.cos((target.lat * Math.PI) / 180));
        const endLat = target.lat + (Math.cos(headingRad) * vectorLengthMeters) / 111320;
        viewer.entities.add({
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArrayHeights([
              target.lon,
              target.lat,
              trafficAltitudeMeters,
              endLon,
              endLat,
              trafficAltitudeMeters,
            ]),
            width: target.threatLevel === "immediate" ? 3 : 2,
            material: new Cesium.PolylineGlowMaterialProperty({
              color: Cesium.Color.fromCssColorString(tone).withAlpha(0.92),
              glowPower: 0.14,
            }),
          },
        });
      }
    });

    obstacles.forEach((obstacle) => {
      const obstacleHeightMeters =
        obstacle.amslFt && Number.isFinite(obstacle.amslFt)
          ? Math.max(25, obstacle.amslFt * 0.3048)
          : 25;
      viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArrayHeights([
            obstacle.lon,
            obstacle.lat,
            0,
            obstacle.lon,
            obstacle.lat,
            obstacleHeightMeters,
          ]),
          width: 3,
          material: new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString("#ef4444")),
        },
      });
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(obstacle.lon, obstacle.lat, obstacleHeightMeters),
        point: {
          pixelSize: 10,
          color: Cesium.Color.fromCssColorString("#ef4444"),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: obstacle.kind || "Obstacle",
          font: "11px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
        },
      });
    });

    diversionAirports.forEach((airport) => {
      const tone = airport.immediateReady ? "#14b8a6" : "#60a5fa";
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(airport.lon, airport.lat, 18),
        point: {
          pixelSize: 10,
          color: Cesium.Color.fromCssColorString(tone),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: airport.icao,
          font: "11px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString(tone).withAlpha(0.76),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
        },
      });
    });

    if (cameraMode === "follow-ownship" && ownship) {
      const ownshipAltitudeMeters =
        ownship.altitudeFt && Number.isFinite(ownship.altitudeFt)
          ? Math.max(180, ownship.altitudeFt * 0.3048)
          : routeAltitudeMeters;
      const ownshipPosition = Cesium.Cartesian3.fromDegrees(ownship.lon, ownship.lat, ownshipAltitudeMeters);
      const rangeMeters = Math.max(18_000, (cameraRangeNm ?? 48) * 1852);
      viewer.camera.lookAt(
        ownshipPosition,
        new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(ownship.headingDeg ?? 0),
          Cesium.Math.toRadians(-38),
          rangeMeters,
        ),
      );
    } else {
      viewer.zoomTo(viewer.entities, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-30), 0));
    }
  }, [
    cameraMode,
    cameraRangeNm,
    diversionAirports,
    obstacles,
    ownship,
    plannedAltitudeFt,
    points,
    rangeRingNm,
    runwayOverlays,
    terrainHotSpots,
    terrainSegments,
    trafficTargets,
  ]);

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
          {cameraMode === "follow-ownship" && (
            <div className="text-[11px] text-slate-500">Camera following ownship corridor.</div>
          )}
        </div>
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
