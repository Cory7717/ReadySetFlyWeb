const SESSION_MARKER_KEY = "rsf.anon.session";
const SESSION_COUNT_KEY = "anon_session_count";
const TOOL_INTERACTIONS_KEY = "anon_tool_interactions";
const FLIGHT_PLAN_FILES_KEY = "anon_flight_plan_files";
const LAST_SEEN_KEY = "anon_last_seen_at";
const DISMISS_UNTIL_KEY = "anon_banner_dismissed_until";

const readNumber = (key: string): number => {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(key);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

const writeNumber = (key: string, value: number) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {}
};

const emitUsageEvent = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("rsf_anon_usage"));
};

export const isSoftAuthEnabled = (): boolean => {
  if (typeof import.meta === "undefined") return true;
  return (import.meta as any).env?.VITE_SOFT_AUTH_ENABLED !== "false";
};

export const recordAnonSession = () => {
  if (!isSoftAuthEnabled() || typeof window === "undefined") return;
  try {
    const already = window.sessionStorage.getItem(SESSION_MARKER_KEY);
    if (!already) {
      const next = readNumber(SESSION_COUNT_KEY) + 1;
      writeNumber(SESSION_COUNT_KEY, next);
      window.sessionStorage.setItem(SESSION_MARKER_KEY, String(Date.now()));
    }
  } catch {}
  writeNumber(LAST_SEEN_KEY, Date.now());
  emitUsageEvent();
};

export const recordAnonToolInteraction = () => {
  if (!isSoftAuthEnabled() || typeof window === "undefined") return;
  const next = readNumber(TOOL_INTERACTIONS_KEY) + 1;
  writeNumber(TOOL_INTERACTIONS_KEY, next);
  writeNumber(LAST_SEEN_KEY, Date.now());
  emitUsageEvent();
};

export const getAnonUsage = () => {
  return {
    sessionCount: readNumber(SESSION_COUNT_KEY),
    toolInteractions: readNumber(TOOL_INTERACTIONS_KEY),
    flightPlanFiles: readNumber(FLIGHT_PLAN_FILES_KEY),
    lastSeenAt: readNumber(LAST_SEEN_KEY),
    dismissedUntil: readNumber(DISMISS_UNTIL_KEY),
  };
};

export const getAnonFlightPlanFileCount = () => readNumber(FLIGHT_PLAN_FILES_KEY);

export const recordAnonFlightPlanFile = () => {
  if (!isSoftAuthEnabled() || typeof window === "undefined") return;
  const next = readNumber(FLIGHT_PLAN_FILES_KEY) + 1;
  writeNumber(FLIGHT_PLAN_FILES_KEY, next);
  writeNumber(LAST_SEEN_KEY, Date.now());
  emitUsageEvent();
};

export const dismissSignupBanner = (days: number) => {
  if (!isSoftAuthEnabled() || typeof window === "undefined") return;
  const until = Date.now() + days * 24 * 60 * 60 * 1000;
  writeNumber(DISMISS_UNTIL_KEY, until);
  emitUsageEvent();
};

export const shouldShowSignupBanner = (timeOnSiteMs: number) => {
  if (!isSoftAuthEnabled()) return false;
  const { sessionCount, toolInteractions, dismissedUntil } = getAnonUsage();
  if (dismissedUntil && dismissedUntil > Date.now()) return false;
  return sessionCount >= 2 || toolInteractions >= 10 || timeOnSiteMs >= 60_000;
};
