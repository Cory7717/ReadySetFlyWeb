import PlannerMap from "@/components/flight-planner/PlannerMap";
import MapLibrePlannerMap from "@/components/flight-planner/MapLibrePlannerMap";
import type { Planner2DMapProps } from "@/components/flight-planner/plannerMapTypes";
import { getRsfPlannerRenderer } from "@/map/rsfMapSpec";

export default function Planner2DMapSurface(props: Planner2DMapProps) {
  const canUseMapLibre = getRsfPlannerRenderer(props.mapStyle ?? "standard") === "maplibre";

  if (canUseMapLibre) {
    return <MapLibrePlannerMap {...props} />;
  }

  return <PlannerMap {...props} />;
}
