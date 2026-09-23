import { apiUrl } from "@/lib/api";

const VISITOR_ID_KEY = "rsf_visitor_id";
const SESSION_ID_KEY = "rsf_session_id";
const SESSION_PING_PREFIX = "rsf_session_ping:";
const SESSION_PING_TTL_MS = 1000 * 60 * 30;

type AnalyticsRouteMeta = {
  canonicalPath: string;
  pageTitle: string;
  contentGroup: string;
  siteArea: "courtyard" | "cory_armer_portfolio" | "ready_set_fly";
  contentName: string;
};

const SPECIAL_ANALYTICS_ROUTES: Array<{ match: (path: string) => boolean; title: string; group: string; area: AnalyticsRouteMeta["siteArea"]; name: string; canonical?: string }> = [
  { match: (path) => path.startsWith("/courtyard/meeting-calendar/share/"), title: "Shared Meeting Calendar | Courtyard", group: "Courtyard Operations", area: "courtyard", name: "Meeting Calendar Share", canonical: "/courtyard/meeting-calendar/share/:token" },
  { match: (path) => path.startsWith("/courtyard/sales-transition/"), title: "Sales Transition Hub | Courtyard", group: "Courtyard Operations", area: "courtyard", name: "Sales Transition Share", canonical: "/courtyard/sales-transition/:token" },
  { match: (path) => path.startsWith("/incidentreport/share/"), title: "Shared Incident Report | Courtyard", group: "Courtyard Operations", area: "courtyard", name: "Incident Report Share", canonical: "/incidentreport/share/:token" },
  { match: (path) => path === "/courtyard/meeting-calendar", title: "Meeting & Group Calendar | Courtyard", group: "Courtyard Operations", area: "courtyard", name: "Meeting Calendar" },
  { match: (path) => path === "/courtyard/sales-intelligence", title: "Sales Intelligence | Courtyard", group: "Courtyard Operations", area: "courtyard", name: "Sales Intelligence" },
  { match: (path) => path === "/courtyard/revenue", title: "Revenue Intelligence | Courtyard", group: "Courtyard Operations", area: "courtyard", name: "Revenue Intelligence" },
  { match: (path) => path === "/courtyard/budget", title: "Budget & Checkbook | Courtyard", group: "Courtyard Operations", area: "courtyard", name: "Budget" },
  { match: (path) => path === "/courtyard", title: "Courtyard Associate Portal", group: "Courtyard Operations", area: "courtyard", name: "Courtyard Portal" },
  { match: (path) => path === "/schedule", title: "Associate Schedule | Courtyard", group: "Courtyard Operations", area: "courtyard", name: "Schedule" },
  { match: (path) => path === "/tips/waste", title: "Bistro Waste Log | Courtyard", group: "Courtyard Operations", area: "courtyard", name: "Bistro Waste Log" },
  { match: (path) => path === "/tips/admin", title: "Bistro Tips Administration | Courtyard", group: "Courtyard Operations", area: "courtyard", name: "Bistro Tips Admin" },
  { match: (path) => path === "/tips", title: "Bistro Tips | Courtyard", group: "Courtyard Operations", area: "courtyard", name: "Bistro Tips" },
  { match: (path) => path === "/opsreport", title: "Operations Report | Courtyard", group: "Courtyard Operations", area: "courtyard", name: "Ops Report" },
  { match: (path) => path === "/comptroller" || path === "/comtroller", title: "Comptroller | Courtyard", group: "Courtyard Operations", area: "courtyard", name: "Comptroller", canonical: "/comptroller" },
  { match: (path) => path === "/dosreporting", title: "Director of Sales Reporting | Courtyard", group: "Courtyard Operations", area: "courtyard", name: "DOS Reporting" },
  { match: (path) => path === "/incidentreport", title: "Incident Reports | Courtyard", group: "Courtyard Operations", area: "courtyard", name: "Incident Reports" },
  { match: (path) => path === "/bankdeposit", title: "Bank Deposit | Courtyard", group: "Courtyard Operations", area: "courtyard", name: "Bank Deposit" },
  { match: (path) => path === "/coryarmer", title: "Cory Armer | Writer & Creator Portfolio", group: "Cory Armer Portfolio", area: "cory_armer_portfolio", name: "Portfolio Home" },
  { match: (path) => path === "/noiseandfury", title: "Noise & Fury | Cory Armer", group: "Cory Armer Projects", area: "cory_armer_portfolio", name: "Noise & Fury" },
  { match: (path) => path === "/graveside", title: "Graveside | Cory Armer", group: "Cory Armer Projects", area: "cory_armer_portfolio", name: "Graveside" },
  { match: (path) => path === "/thegrasp", title: "The Grasp | Cory Armer", group: "Cory Armer Projects", area: "cory_armer_portfolio", name: "The Grasp" },
  { match: (path) => path === "/certainty", title: "CERTAINTY | A Limited Series by Cory Armer", group: "Cory Armer Projects", area: "cory_armer_portfolio", name: "CERTAINTY" },
  { match: (path) => path === "/patriotprotocol", title: "The Patriot Protocol | Cory Armer", group: "Cory Armer Projects", area: "cory_armer_portfolio", name: "The Patriot Protocol" },
];

function pathnameOnly(rawPath: string) {
  const raw = String(rawPath || "/").trim() || "/";
  if (/^https?:\/\//i.test(raw)) {
    try { return new URL(raw).pathname || "/"; } catch {}
  }
  const path = raw.split(/[?#]/, 1)[0] || "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function analyticsRouteMeta(rawPath: string): AnalyticsRouteMeta {
  const path = pathnameOnly(rawPath);
  const route = SPECIAL_ANALYTICS_ROUTES.find((candidate) => candidate.match(path));
  if (route) return { canonicalPath: route.canonical || path, pageTitle: route.title, contentGroup: route.group, siteArea: route.area, contentName: route.name };
  if (path.startsWith("/courtyard/")) {
    const name = path.split("/").filter(Boolean).slice(1).map((part) => part.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())).join(" / ");
    return { canonicalPath: path, pageTitle: `${name} | Courtyard`, contentGroup: "Courtyard Operations", siteArea: "courtyard", contentName: name };
  }
  const fallbackName = path === "/" ? "Ready Set Fly Home" : path.split("/").filter(Boolean).map((part) => part.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())).join(" / ");
  return { canonicalPath: path, pageTitle: typeof document !== "undefined" ? document.title : fallbackName, contentGroup: "Ready Set Fly", siteArea: "ready_set_fly", contentName: fallbackName };
}

let priorGaPageLocation = "";

const getStoredVisitorId = (): string | undefined => {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage.getItem(VISITOR_ID_KEY) || undefined;
  } catch {
    return undefined;
  }
};

const createVisitorId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const ensureVisitorId = (): string => {
  const existing = getStoredVisitorId();
  if (existing) return existing;
  const next = createVisitorId();
  try {
    window.localStorage.setItem(VISITOR_ID_KEY, next);
  } catch {}
  return next;
};

const getSessionId = (): string | undefined => {
  if (typeof window === "undefined") return undefined;
  try {
    return window.sessionStorage.getItem(SESSION_ID_KEY) || undefined;
  } catch {
    return undefined;
  }
};

const ensureSessionId = (): string => {
  const existing = getSessionId();
  if (existing) return existing;
  const next = createVisitorId();
  try {
    window.sessionStorage.setItem(SESSION_ID_KEY, next);
  } catch {}
  return next;
};

const shouldPingSession = (page: string): boolean => {
  if (typeof window === "undefined") return false;
  const key = `${SESSION_PING_PREFIX}${page || "/"}`;
  try {
    const last = window.sessionStorage.getItem(key);
    if (!last) return true;
    const lastTime = Number(last);
    if (!Number.isFinite(lastTime)) return true;
    return Date.now() - lastTime > SESSION_PING_TTL_MS;
  } catch {
    return true;
  }
};

const markSessionPing = (page: string) => {
  if (typeof window === "undefined") return;
  const key = `${SESSION_PING_PREFIX}${page || "/"}`;
  try {
    window.sessionStorage.setItem(key, String(Date.now()));
  } catch {}
};

export function trackEvent(event: string, params?: Record<string, any>) {
  try {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", event, params || {});
    }
  } catch {}

  if (typeof window === "undefined") return;
  const visitorId = ensureVisitorId();
  const payload = {
    event,
    page: typeof params?.page === "string" ? params.page : undefined,
    params,
    visitorId,
  };

  const send = async () => {
    try {
      const response = await fetch(apiUrl("/api/analytics/event"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        keepalive: true,
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const data = await response.json().catch(() => null);
        if (data?.visitorId && data.visitorId !== visitorId) {
          window.localStorage.setItem(VISITOR_ID_KEY, data.visitorId);
        }
      }
    } catch {}
  };

  void send();
}

export function trackPageView(rawPath: string) {
  if (typeof window === "undefined") return;
  const meta = analyticsRouteMeta(rawPath);
  const pageLocation = `${window.location.origin}${meta.canonicalPath}`;
  const pageReferrer = priorGaPageLocation || document.referrer || undefined;
  trackEvent("page_view", {
    page: meta.canonicalPath,
    page_path: meta.canonicalPath,
    page_location: pageLocation,
    page_title: meta.pageTitle,
    page_referrer: pageReferrer,
    content_group: meta.contentGroup,
    site_area: meta.siteArea,
    content_name: meta.contentName,
  });
  priorGaPageLocation = pageLocation;
}

export function trackSessionPing(page: string) {
  if (typeof window === "undefined") return;
  const normalizedPage = page.startsWith("/") ? page : `/${page}`;
  if (!shouldPingSession(normalizedPage)) return;

  const visitorId = ensureVisitorId();
  const sessionId = ensureSessionId();

  const send = async () => {
    try {
      const response = await fetch(apiUrl("/api/analytics/session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        keepalive: true,
        body: JSON.stringify({ page: normalizedPage, visitorId, sessionId }),
      });
      if (response.ok) {
        const data = await response.json().catch(() => null);
        if (data?.visitorId && data.visitorId !== visitorId) {
          window.localStorage.setItem(VISITOR_ID_KEY, data.visitorId);
        }
      }
    } catch {}
  };

  markSessionPing(normalizedPage);
  void send();
}
