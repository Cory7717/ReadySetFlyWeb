import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";

export type Eb6OutputMode = "quick" | "advanced" | "custom";

export type Eb6Prefs = {
  mode: Eb6OutputMode;
  outputs: string[];
};

const STORAGE_KEY = "rsf.eb6.outputPrefs";

export const readLocalEb6Prefs = (): Eb6Prefs | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Eb6Prefs;
    if (!parsed || !parsed.mode || !Array.isArray(parsed.outputs)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const writeLocalEb6Prefs = (prefs: Eb6Prefs) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
};

export const fetchEb6Prefs = async (): Promise<Eb6Prefs | null> => {
  try {
    const response = await fetch(apiUrl("/api/user/settings"), { credentials: "include" });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || !data.eb6OutputMode || !Array.isArray(data.eb6SelectedOutputs)) return null;
    return { mode: data.eb6OutputMode, outputs: data.eb6SelectedOutputs };
  } catch {
    return null;
  }
};

export const saveEb6Prefs = async (prefs: Eb6Prefs) => {
  await apiRequest("PUT", "/api/user/settings", {
    eb6OutputMode: prefs.mode,
    eb6SelectedOutputs: prefs.outputs,
  });
};
