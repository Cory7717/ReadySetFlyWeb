import { apiUrl } from "@/lib/api";

const VISITOR_ID_KEY = "rsf_visitor_id";

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
