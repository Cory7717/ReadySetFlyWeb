declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const PIXEL_ID = "946184354930309";
const IS_PROD = !import.meta.env.DEV;

export function pixelPageView(): void {
  if (!IS_PROD) return;
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", "PageView");
}

export function pixelEvent(
  eventName: string,
  params?: Record<string, unknown>
): void {
  if (!IS_PROD) return;
  if (typeof window === "undefined" || !window.fbq) return;
  if (params) {
    window.fbq("track", eventName, params);
  } else {
    window.fbq("track", eventName);
  }
}

export function pixelCustomEvent(
  eventName: string,
  params?: Record<string, unknown>
): void {
  if (!IS_PROD) return;
  if (typeof window === "undefined" || !window.fbq) return;
  if (params) {
    window.fbq("trackCustom", eventName, params);
  } else {
    window.fbq("trackCustom", eventName);
  }
}

export { PIXEL_ID };
