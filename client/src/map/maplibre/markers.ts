import type { Map as MapLibreMap, Marker } from "maplibre-gl";

export function clearMarkers(markers: Marker[]) {
  markers.forEach((marker) => marker.remove());
}

export function replaceMarkerSet<T>({
  map,
  current,
  items,
  createMarker,
}: {
  map: MapLibreMap;
  current: Marker[];
  items: T[];
  createMarker: (item: T, index: number, map: MapLibreMap) => Marker;
}) {
  clearMarkers(current);
  return items.map((item, index) => createMarker(item, index, map));
}

export function replaceSingleMarker({
  map,
  current,
  createMarker,
}: {
  map: MapLibreMap;
  current: Marker | null;
  createMarker: (map: MapLibreMap) => Marker;
}) {
  current?.remove();
  return createMarker(map);
}
