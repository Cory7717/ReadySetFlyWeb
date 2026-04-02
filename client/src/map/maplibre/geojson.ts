import type { FeatureCollection, LineString } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

export function emptyFeatureCollection(): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

export function buildLineStringCollection(
  coordinates: Array<[number, number]>,
  properties: Record<string, unknown> = {},
): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features:
      coordinates.length > 1
        ? [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates,
              },
              properties,
            },
          ]
        : [],
  };
}

export function normalizeFeatureCollection(input: FeatureCollection | null | undefined): FeatureCollection {
  if (!input || input.type !== "FeatureCollection") {
    return emptyFeatureCollection();
  }
  return input;
}

export function upsertGeoJsonLineLayer({
  map,
  sourceId,
  layerId,
  data,
  color,
  width,
  opacity,
  dasharray,
  beforeId,
}: {
  map: MapLibreMap;
  sourceId: string;
  layerId: string;
  data: FeatureCollection<LineString>;
  color: string;
  width: number;
  opacity: number;
  dasharray?: number[];
  beforeId?: string;
}) {
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
  map.addSource(sourceId, { type: "geojson", data });
  map.addLayer(
    {
      id: layerId,
      type: "line",
      source: sourceId,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": color,
        "line-width": width,
        "line-opacity": opacity,
        ...(dasharray ? { "line-dasharray": dasharray } : {}),
      },
    },
    beforeId,
  );
}

export function removeGeoJsonLayer(map: MapLibreMap, sourceId: string, layerId: string) {
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

export function setGeoJsonSourceData(map: MapLibreMap, sourceId: string, data: FeatureCollection) {
  const source = map.getSource(sourceId) as GeoJSONSource | undefined;
  source?.setData(data as GeoJSON.FeatureCollection);
}
