export function trackEvent(event: string, params?: Record<string, any>) {
  try {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", event, params || {});
    }
  } catch {}
}
