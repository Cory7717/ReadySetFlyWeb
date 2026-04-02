export type RsfWebMapEngine = "leaflet" | "maplibre";

export function getRequestedWebMapEngine(): RsfWebMapEngine {
  const raw = String(import.meta.env.VITE_WEB_MAP_ENGINE || "leaflet").trim().toLowerCase();
  return raw === "maplibre" ? "maplibre" : "leaflet";
}
