import PlannerMap from "@/components/flight-planner/PlannerMap";
import MapLibrePlannerMap from "@/components/flight-planner/MapLibrePlannerMap";
import type { Planner2DMapProps } from "@/components/flight-planner/plannerMapTypes";

const getRequestedEngine = () => String(import.meta.env.VITE_WEB_MAP_ENGINE || "leaflet").trim().toLowerCase();

export default function Planner2DMapSurface(props: Planner2DMapProps) {
  const requestedEngine = getRequestedEngine();
  const prefersMapLibre = requestedEngine === "maplibre";
  const canUseMapLibre = prefersMapLibre && props.mapStyle !== "winds";

  if (canUseMapLibre) {
    return <MapLibrePlannerMap {...props} />;
  }

  return <PlannerMap {...props} />;
}
