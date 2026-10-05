const AUTH_PATHS = new Set(["/login", "/register"]);
const CANONICAL_FRONTEND_ORIGIN = "https://readysetfly.us";
const API_ONLY_HOSTS = new Set([
  "api.readysetfly.us",
  "readysetfly-api.onrender.com",
]);

function safeFrontendPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  try {
    const parsed = new URL(value, CANONICAL_FRONTEND_ORIGIN);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export function frontendUrlForHostname(path: string, hostname: string): string {
  const safePath = safeFrontendPath(path);
  return API_ONLY_HOSTS.has(String(hostname || "").trim().toLowerCase())
    ? `${CANONICAL_FRONTEND_ORIGIN}${safePath}`
    : safePath;
}

export function frontendUrl(path: string): string {
  if (typeof window === "undefined") return safeFrontendPath(path);
  return frontendUrlForHostname(path, window.location.hostname);
}

export function normalizeReturnTo(value?: string | null): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  try {
    const parsed = new URL(value, window.location.origin);
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return AUTH_PATHS.has(parsed.pathname) ? "/" : normalized;
  } catch {
    return "/";
  }
}

export function getCurrentReturnTo(): string {
  if (typeof window === "undefined") return "/";
  return normalizeReturnTo(`${window.location.pathname}${window.location.search}${window.location.hash}`);
}

export function getReturnToFromWindow(): string {
  if (typeof window === "undefined") return "/";
  const params = new URLSearchParams(window.location.search);
  return normalizeReturnTo(params.get("redirect"));
}

export function normalizeSourcePath(value?: string | null): string {
  return normalizeReturnTo(value);
}

export function getSourceFromWindow(): string {
  if (typeof window === "undefined") return "/";
  const params = new URLSearchParams(window.location.search);
  return normalizeSourcePath(params.get("source"));
}

export function withReturnTo(path: string, returnTo?: string): string {
  if (typeof window === "undefined") return path;

  const safeReturnTo = normalizeReturnTo(returnTo ?? getCurrentReturnTo());
  if (!safeReturnTo || safeReturnTo === "/") return path;

  const url = new URL(path, window.location.origin);
  url.searchParams.set("redirect", safeReturnTo);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function withSourceParam(path: string, source?: string): string {
  if (typeof window === "undefined") return path;

  const safeSource = normalizeSourcePath(source ?? getCurrentReturnTo());
  if (!safeSource || safeSource === "/") return path;

  const url = new URL(path, window.location.origin);
  url.searchParams.set("source", safeSource);
  return `${url.pathname}${url.search}${url.hash}`;
}
