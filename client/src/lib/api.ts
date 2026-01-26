// Centralized API base + helpers to avoid hitting GitHub Pages in production
// In dev, the Vite proxy handles relative `/api` calls, so keep base empty on localhost.

const DEFAULT_API_BASE =
  typeof window !== "undefined"
    ? window.location.hostname.includes("localhost")
      ? ""
      : window.location.origin
    : "https://readysetfly-api.onrender.com";

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
