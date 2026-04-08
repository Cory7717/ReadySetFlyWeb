import { TileLayer, WMSTileLayer } from "react-leaflet";
import { RSF_FAA_WMS_DIRECT_URL, type RsfLeafletMapStyle, type RsfLiveMapStyle } from "@/map/rsfMapSpec";

type LeafletWeatherStyle = Extract<RsfLeafletMapStyle | RsfLiveMapStyle, "sectional" | "radar" | "clouds">;

export function LeafletAviationBaseLayers({
  mapStyle,
  radarTileUrl,
  radarFallbackActive = false,
  onRadarTileError,
  cloudTileUrl,
}: {
  mapStyle: RsfLeafletMapStyle | RsfLiveMapStyle;
  radarTileUrl?: string;
  radarFallbackActive?: boolean;
  onRadarTileError?: () => void;
  cloudTileUrl?: string;
}) {
  const style = mapStyle as LeafletWeatherStyle | "standard";

  return (
    <>
      {style !== "sectional" && (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      )}
      {style === "sectional" && (
        <WMSTileLayer
          attribution="FAA SUA Geoserver Charts"
          url={RSF_FAA_WMS_DIRECT_URL}
          layers="SUA:us_sectionals"
          format="image/png"
          transparent={false}
          version="1.1.1"
          opacity={1}
        />
      )}
      {style === "radar" && radarTileUrl && !radarFallbackActive && (
        <TileLayer
          attribution="RainViewer"
          url={radarTileUrl}
          opacity={0.8}
          zIndex={600}
          crossOrigin="anonymous"
          eventHandlers={
            onRadarTileError
              ? {
                  tileerror: () => onRadarTileError(),
                }
              : undefined
          }
        />
      )}
      {style === "radar" && (radarFallbackActive || !radarTileUrl) && (
        <WMSTileLayer
          attribution="IEM NEXRAD Base Reflectivity"
          url="https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi"
          layers="nexrad-n0r-900913"
          format="image/png"
          transparent
          opacity={0.75}
          zIndex={600}
        />
      )}
      {style === "clouds" && cloudTileUrl && (
        <TileLayer
          attribution="NASA GIBS"
          url={cloudTileUrl}
          opacity={0.7}
          maxNativeZoom={9}
          zIndex={600}
          crossOrigin="anonymous"
        />
      )}
    </>
  );
}
