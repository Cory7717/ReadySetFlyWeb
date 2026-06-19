import { apiUrl } from "@/lib/api";
import { getRequestedWebMapEngine, type RsfWebMapEngine } from "@/map/engine";

export type RsfPlannerMapStyle = "standard" | "sectional" | "radar" | "winds" | "clouds" | "globe";
export type RsfLeafletMapStyle = Exclude<RsfPlannerMapStyle, "globe">;
export type RsfLiveMapStyle = Exclude<RsfPlannerMapStyle, "winds">;
export type RsfDemoViewMode = "overhead" | "vision" | "surface";
export type RsfCockpitAccent = "map" | "vision" | "globe" | "winds";
export type RsfSectionalSourceKey = "direct-faa-wms" | "proxy-faa-wms";
export type RsfPlannerRenderer = "leaflet" | "maplibre";

export const RSF_FAA_WMS_DIRECT_URL = "https://sua.faa.gov/geoserver/wms";
export const RSF_FAA_WMS_URL = apiUrl("/api/tiles/faa/wms");

export function getRsfSectionalSourceKey(): RsfSectionalSourceKey {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  const raw = String(env.VITE_RSF_SECTIONAL_SOURCE || "direct").trim().toLowerCase();
  return raw === "proxy" ? "proxy-faa-wms" : "direct-faa-wms";
}

export function getRsfSectionalSourceBaseUrl(source = getRsfSectionalSourceKey()) {
  return source === "proxy-faa-wms" ? RSF_FAA_WMS_URL : RSF_FAA_WMS_DIRECT_URL;
}

export function getRsfSectionalSourceLabel(source = getRsfSectionalSourceKey()) {
  return source === "proxy-faa-wms" ? "FAA WMS proxy" : "Direct FAA WMS";
}

export function getRsfSectionalWmsTileUrl(source = getRsfSectionalSourceKey()) {
  return `${getRsfSectionalSourceBaseUrl(source)}?service=WMS&request=GetMap&layers=SUA:us_sectionals&styles=&format=image/png&transparent=true&version=1.1.1&srs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}`;
}

export function getRsfPlannerRenderer(
  mapStyle: RsfPlannerMapStyle | RsfLiveMapStyle,
  requestedEngine: RsfWebMapEngine = getRequestedWebMapEngine(),
): RsfPlannerRenderer {
  if (requestedEngine !== "maplibre") return "leaflet";
  if (mapStyle === "winds" || mapStyle === "sectional") return "leaflet";
  return "maplibre";
}

export const RSF_SECTIONAL_WMS_TILE_URL = getRsfSectionalWmsTileUrl();
export const RSF_SECTIONAL_SOURCE_LABEL = getRsfSectionalSourceLabel();

export const RSF_ROUTE_LINE_STYLE = { color: "#2563eb", weight: 3, opacity: 0.78 } as const;
export const RSF_ROUTE_HALO_LINE_STYLE = { color: "#0ea5e9", weight: 4 } as const;

export const RSF_TERRAIN_RISK_STYLES = {
  comfortable: { color: "#16a34a", weight: 5, opacity: 0.9 },
  caution: { color: "#f59e0b", weight: 5, opacity: 0.92 },
  warning: { color: "#dc2626", weight: 5, opacity: 0.96 },
} as const;

export const RSF_TERRAIN_SURFACE_STYLES = {
  comfortable: { color: "#16a34a", weight: 16, opacity: 0.14, lineCap: "round" as const },
  caution: { color: "#f59e0b", weight: 18, opacity: 0.18, lineCap: "round" as const },
  warning: { color: "#dc2626", weight: 20, opacity: 0.22, lineCap: "round" as const },
} as const;

export const RSF_COCKPIT_SHELL_CLASS = "border-[hsl(214_18%_76%_/_0.14)] bg-[linear-gradient(180deg,hsl(220_18%_14%_/_0.98),hsl(220_22%_9%_/_0.99))] text-[#E8EDF4] shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.07)]";
export const RSF_COCKPIT_MUTED_TEXT_CLASS = "text-[#7A9BB8]";
export const RSF_COCKPIT_PANEL_CLASS = "border-[hsl(214_18%_76%_/_0.12)] bg-[linear-gradient(180deg,hsl(220_18%_12%_/_0.98),hsl(220_22%_8%_/_0.99))] text-[#E8EDF4] shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.05)]";
export const RSF_COCKPIT_PANEL_ELEVATED_CLASS = "border-[hsl(214_18%_76%_/_0.13)] bg-[linear-gradient(180deg,hsl(220_18%_15%_/_0.98),hsl(220_20%_10%_/_0.98))] text-[#E8EDF4] shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.06),0_18px_36px_-26px_hsl(220_44%_2%_/_0.82)]";

export const RSF_PLANNER_MAP_STYLE_OPTIONS: Array<{ value: RsfPlannerMapStyle; label: string; accent: RsfCockpitAccent }> = [
  { value: "standard", label: "Standard", accent: "map" },
  { value: "sectional", label: "Sectional", accent: "vision" },
  { value: "radar", label: "Radar", accent: "map" },
  { value: "clouds", label: "Clouds", accent: "map" },
  { value: "globe", label: "3D Globe", accent: "globe" },
  { value: "winds", label: "Winds", accent: "winds" },
];

export const RSF_LIVE_MAP_STYLE_OPTIONS: Array<{ value: RsfLiveMapStyle; label: string; accent: RsfCockpitAccent }> = [
  { value: "standard", label: "Standard", accent: "map" },
  { value: "sectional", label: "Sectional", accent: "vision" },
  { value: "radar", label: "Radar", accent: "map" },
  { value: "clouds", label: "Clouds", accent: "map" },
  { value: "globe", label: "3D Globe", accent: "globe" },
];

export const RSF_DEMO_VIEW_MODE_OPTIONS: Array<{ value: RsfDemoViewMode; label: string; accent: RsfCockpitAccent }> = [
  { value: "overhead", label: "Overhead", accent: "map" },
  { value: "vision", label: "Vision", accent: "vision" },
  { value: "surface", label: "Surface", accent: "map" },
];

export function getRsfCockpitToggleClass(active: boolean, accent: RsfCockpitAccent) {
  if (!active) return "border-[#1E2D42] bg-[#111820] text-[#7A9BB8] hover:bg-[#1A2332]";
  switch (accent) {
    case "vision":
      return "border-[#C8922A] bg-[#1A2332] text-[#E8EDF4]";
    case "globe":
      return "border-[#34d399] bg-[#163128] text-[#E8EDF4]";
    case "winds":
      return "border-[#22c55e] bg-[#10261c] text-[#E8EDF4]";
    case "map":
    default:
      return "border-[#4A9FD4] bg-[#1A2332] text-[#E8EDF4]";
  }
}
