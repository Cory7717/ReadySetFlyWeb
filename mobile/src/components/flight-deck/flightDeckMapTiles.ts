export type FlightDeckSectionalSource = {
  id: 'faa-arcgis' | 'faa-wms';
  label: string;
  kind: 'xyz' | 'wms';
  urlTemplate: string;
  minimumZ: number;
  maximumZ: number;
  maximumNativeZ?: number;
  opacity: number;
};

export const FAA_SECTIONAL_ARCGIS_SOURCE: FlightDeckSectionalSource = {
  id: 'faa-arcgis',
  label: 'FAA ArcGIS cache',
  kind: 'xyz',
  urlTemplate:
    'https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}',
  minimumZ: 8,
  maximumZ: 12,
  maximumNativeZ: 12,
  opacity: 1,
};

export const FAA_SECTIONAL_WMS_SOURCE: FlightDeckSectionalSource = {
  id: 'faa-wms',
  label: 'FAA WMS fallback',
  kind: 'wms',
  urlTemplate:
    'https://sua.faa.gov/geoserver/wms?service=WMS&request=GetMap&layers=SUA:us_sectionals&styles=&format=image/png&transparent=false&version=1.1.1&srs=EPSG:900913&bbox={minX},{minY},{maxX},{maxY}&width={width}&height={height}',
  minimumZ: 2,
  maximumZ: 12,
  maximumNativeZ: 12,
  opacity: 1,
};

export function getPrimaryFlightDeckSectionalSource() {
  return FAA_SECTIONAL_ARCGIS_SOURCE;
}

export function getFallbackFlightDeckSectionalSource() {
  return FAA_SECTIONAL_WMS_SOURCE;
}
