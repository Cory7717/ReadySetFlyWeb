import * as Cesium from "cesium";

const overlaySources = new WeakMap<Cesium.Viewer, Cesium.DataSource>();

type TfmsOverlayStyleHints = {
  recommendedOpacity?: number;
};

function normalizeFeatures(input: any): any {
  if (!input) {
    return { type: "FeatureCollection", features: [] };
  }
  if (Array.isArray(input)) {
    return { type: "FeatureCollection", features: input };
  }
  if (input.type === "FeatureCollection") {
    return input;
  }
  if (input.type === "Feature") {
    return { type: "FeatureCollection", features: [input] };
  }
  return { type: "FeatureCollection", features: [] };
}

function applyOpacity(entity: Cesium.Entity, opacity: number) {
  if (entity.polygon?.material && (entity.polygon.material as any).color) {
    const colorProperty = (entity.polygon.material as any).color;
    const current = colorProperty?.getValue?.(Cesium.JulianDate.now());
    if (current && current.withAlpha) {
      entity.polygon.material = new Cesium.ColorMaterialProperty(current.withAlpha(opacity));
    }
  }
  if (entity.polyline?.material && (entity.polyline.material as any).color) {
    const colorProperty = (entity.polyline.material as any).color;
    const current = colorProperty?.getValue?.(Cesium.JulianDate.now());
    if (current && current.withAlpha) {
      entity.polyline.material = new Cesium.ColorMaterialProperty(current.withAlpha(opacity));
    }
  }
}

export async function setTfmsOverlay(
  viewer: Cesium.Viewer,
  features: any,
  styleHints?: TfmsOverlayStyleHints
) {
  const existing = overlaySources.get(viewer);
  if (existing) {
    viewer.dataSources.remove(existing, true);
    overlaySources.delete(viewer);
  }

  const dataSource = new Cesium.GeoJsonDataSource("tfms-overlay");
  const collection = normalizeFeatures(features);
  await dataSource.load(collection, { clampToGround: true });

  if (styleHints?.recommendedOpacity !== undefined) {
    const opacity = Math.max(0.05, Math.min(0.9, styleHints.recommendedOpacity));
    dataSource.entities.values.forEach((entity) => applyOpacity(entity, opacity));
  }

  viewer.dataSources.add(dataSource);
  overlaySources.set(viewer, dataSource);
}

export function clearTfmsOverlay(viewer: Cesium.Viewer) {
  const existing = overlaySources.get(viewer);
  if (existing) {
    viewer.dataSources.remove(existing, true);
    overlaySources.delete(viewer);
  }
}
