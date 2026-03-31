// Centralized API base + helpers.
// Prefer explicit API hosts for production domains so auth/session traffic keeps
// flowing even when the frontend is served from a separate static site.

function resolveDefaultApiBase(): string {
  if (typeof window === "undefined") {
    return "https://api.readysetfly.us";
  }

  const hostname = window.location.hostname.toLowerCase();
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";

  if (hostname === "readysetfly.us" || hostname === "www.readysetfly.us") {
    return "https://api.readysetfly.us";
  }

  if (hostname === "readysetfly-web.onrender.com") {
    return "https://readysetfly-api.onrender.com";
  }

  return isLocalHost ? "" : "https://readysetfly-api.onrender.com";
}

const DEFAULT_API_BASE = resolveDefaultApiBase();

const API_BASE =
  // Highest priority: explicit env override
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
  // Optional runtime injection (window.__API_BASE_URL__)
  (typeof window !== "undefined" && (window as any).__API_BASE_URL__) ||
  DEFAULT_API_BASE;

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
