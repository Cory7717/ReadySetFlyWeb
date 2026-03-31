// Centralized API base + helpers.
// Lock production hosts to the matching API origin so stale build-time env vars
// cannot point auth/session traffic at the wrong host after a domain cutover.

function resolveHostLockedApiBase(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const hostname = window.location.hostname.toLowerCase();
  if (hostname === "readysetfly.us" || hostname === "www.readysetfly.us") {
    return "https://api.readysetfly.us";
  }

  if (hostname === "readysetfly-web.onrender.com") {
    return "https://readysetfly-api.onrender.com";
  }

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  ) {
    return "";
  }

  return null;
}

function resolveFallbackApiBase(): string {
  if (typeof window === "undefined") {
    return "https://api.readysetfly.us";
  }

  return "https://readysetfly-api.onrender.com";
}

function resolveConfiguredApiBase(): string {
  const locked = resolveHostLockedApiBase();
  if (locked !== null) {
    return locked;
  }

  return (
    // Explicit build-time override for non-production-host environments.
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
    // Optional runtime injection (window.__API_BASE_URL__)
    (typeof window !== "undefined" && (window as any).__API_BASE_URL__) ||
    resolveFallbackApiBase()
  );
}

const API_BASE = resolveConfiguredApiBase();

function buildUrl(path: string): string {
  if (!API_BASE) return path;
  if (/^https?:\/\//i.test(path)) return path; // already absolute
  if (!path.startsWith("/")) return `${API_BASE}/${path}`;
  return `${API_BASE}${path}`;
}

export function apiUrl(path: string): string {
  return buildUrl(path);
}

export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(buildUrl(input), init);
}
