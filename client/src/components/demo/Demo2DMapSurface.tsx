import type { ReactNode } from "react";
import MapLibreDemoMap from "@/components/demo/MapLibreDemoMap";
import type { Demo2DMapSurfaceProps } from "@/components/demo/demoMapTypes";
import { getRequestedWebMapEngine } from "@/map/engine";

export default function Demo2DMapSurface(props: Demo2DMapSurfaceProps & { children: ReactNode }) {
  if (getRequestedWebMapEngine() === "maplibre") {
    return <MapLibreDemoMap {...props} />;
  }

  return <>{props.children}</>;
}
