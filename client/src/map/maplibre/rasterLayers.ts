import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

type RasterBaseStyleOptions = {
  sourceId: string;
  layerId: string;
  tiles: string[];
  attribution: string;
  tileSize?: number;
  minzoom?: number;
  maxzoom?: number;
};

type RasterLayerOptions = {
  map: MapLibreMap;
  sourceId: string;
  layerId: string;
  tiles: string[];
  attribution: string;
  opacity: number;
  tileSize?: number;
  minzoom?: number;
  maxzoom?: number;
  beforeId?: string;
};

export function createRasterBaseStyle({
  sourceId,
  layerId,
  tiles,
  attribution,
  tileSize = 256,
  minzoom,
  maxzoom,
}: RasterBaseStyleOptions): StyleSpecification {
  return {
    version: 8,
    sources: {
      [sourceId]: {
        type: "raster",
        tiles,
        tileSize,
        attribution,
        ...(typeof minzoom === "number" ? { minzoom } : {}),
        ...(typeof maxzoom === "number" ? { maxzoom } : {}),
      },
    },
    layers: [{ id: layerId, type: "raster", source: sourceId }],
  } as StyleSpecification;
}

export function addOrReplaceRasterLayer({
  map,
  sourceId,
  layerId,
  tiles,
  attribution,
  opacity,
  tileSize = 256,
  minzoom,
  maxzoom,
  beforeId,
}: RasterLayerOptions) {
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
  map.addSource(sourceId, {
    type: "raster",
    tiles,
    tileSize,
    attribution,
    ...(typeof maxzoom === "number" ? { maxzoom } : {}),
    ...(typeof minzoom === "number" ? { minzoom } : {}),
  });
  map.addLayer(
    {
      id: layerId,
      type: "raster",
      source: sourceId,
      paint: {
        "raster-opacity": opacity,
      },
    },
    beforeId,
  );
}

export function removeRasterLayer(map: MapLibreMap, sourceId: string, layerId: string) {
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}
