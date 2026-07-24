import {
  buildDefaultWeightBalanceProfile,
  createScenarioForProfile,
  type WeightBalanceProfile,
  type WeightBalanceScenario,
} from "@shared/weight-balance";

const PROFILE_KEY = "rsf.weightBalance.profiles.v1";
const SCENARIO_KEY = "rsf.weightBalance.scenarios.v1";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadWeightBalanceProfiles(): WeightBalanceProfile[] {
  const stored = readJson<WeightBalanceProfile[]>(PROFILE_KEY, []);
  if (stored.length > 0) return stored;
  return [buildDefaultWeightBalanceProfile()];
}

export function saveWeightBalanceProfiles(profiles: WeightBalanceProfile[]): void {
  writeJson(PROFILE_KEY, profiles);
}

export function loadWeightBalanceScenarios(profile: WeightBalanceProfile): WeightBalanceScenario[] {
  const stored = readJson<WeightBalanceScenario[]>(SCENARIO_KEY, []);
  const matching = stored.filter((scenario) => scenario.profileId === profile.id);
  if (matching.length > 0) return matching;
  return [createScenarioForProfile(profile)];
}

export function saveWeightBalanceScenarios(scenarios: WeightBalanceScenario[]): void {
  const existing = readJson<WeightBalanceScenario[]>(SCENARIO_KEY, []);
  const profileIds = new Set(scenarios.map((scenario) => scenario.profileId));
  writeJson(
    SCENARIO_KEY,
    [...existing.filter((scenario) => !profileIds.has(scenario.profileId)), ...scenarios]
  );
}

export function exportWeightBalanceData(
  profiles: WeightBalanceProfile[],
  scenarios: WeightBalanceScenario[]
): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), profiles, scenarios }, null, 2);
}

export function parseWeightBalanceImport(payload: string): {
  profiles: WeightBalanceProfile[];
  scenarios: WeightBalanceScenario[];
} {
  const parsed = JSON.parse(payload) as {
    profiles?: WeightBalanceProfile[];
    scenarios?: WeightBalanceScenario[];
  };
  return {
    profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
    scenarios: Array.isArray(parsed.scenarios) ? parsed.scenarios : [],
  };
}
