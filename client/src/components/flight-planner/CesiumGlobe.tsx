import { useEffect, useMemo, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

import type { PlannerPoint } from "@/components/flight-planner/PlannerMap";

const OSM_URL = "https://a.tile.openstreetmap.org/";

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

  const hasIonToken = Boolean(import.meta.env.VITE_CESIUM_ION_TOKEN);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    if (hasIonToken) {
      Cesium.Ion.defaultAccessToken = String(import.meta.env.VITE_CESIUM_ION_TOKEN);
    } else {
      setTokenWarning("Add VITE_CESIUM_ION_TOKEN for terrain and premium imagery.");
    }

    const viewer = new Cesium.Viewer(containerRef.current, {
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

    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({ url: OSM_URL })
    );

    if (hasIonToken) {
      Cesium.createWorldTerrainAsync()
        .then((terrain: Cesium.TerrainProvider) => {
          viewer.terrainProvider = terrain;
        })
        .catch(() => null);
    }

    viewerRef.current = viewer;

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [hasIonToken]);

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
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
