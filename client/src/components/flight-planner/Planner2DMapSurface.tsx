import PlannerMap from "@/components/flight-planner/PlannerMap";
import MapLibrePlannerMap from "@/components/flight-planner/MapLibrePlannerMap";
import type { Planner2DMapProps } from "@/components/flight-planner/plannerMapTypes";
import { getRequestedWebMapEngine } from "@/map/engine";

export default function Planner2DMapSurface(props: Planner2DMapProps) {
  const prefersMapLibre = getRequestedWebMapEngine() === "maplibre";
  const canUseMapLibre = prefersMapLibre && props.mapStyle !== "winds";

  if (canUseMapLibre) {
    return <MapLibrePlannerMap {...props} />;
  }

  return <PlannerMap {...props} />;
}
