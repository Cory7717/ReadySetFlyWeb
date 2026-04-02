export type RsfPlannerMapStyle = "standard" | "sectional" | "radar" | "winds" | "clouds" | "globe";
export type RsfLeafletMapStyle = Exclude<RsfPlannerMapStyle, "globe">;
export type RsfLiveMapStyle = Exclude<RsfPlannerMapStyle, "winds">;
export type RsfDemoViewMode = "overhead" | "vision" | "surface";
export type RsfCockpitAccent = "map" | "vision" | "globe" | "winds";

export const RSF_SECTIONAL_TILE_URL =
  "https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}";

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

export const RSF_COCKPIT_SHELL_CLASS = "border-[#1E2D42] bg-[#111820] text-[#E8EDF4]";
export const RSF_COCKPIT_MUTED_TEXT_CLASS = "text-[#7A9BB8]";
export const RSF_COCKPIT_PANEL_CLASS = "border-[#1E2D42] bg-[#0A0E14] text-[#E8EDF4]";
export const RSF_COCKPIT_PANEL_ELEVATED_CLASS = "border-[#1E2D42] bg-[#0C121B]/96 text-[#E8EDF4]";

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
