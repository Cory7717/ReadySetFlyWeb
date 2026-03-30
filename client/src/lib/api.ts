// Centralized API base + helpers.
// Prefer same-origin for the live web app so `readysetfly.us` can use its own `/api`
// path without forcing browser CORS to the Render API origin.

function resolveDefaultApiBase(): string {
  if (typeof window === "undefined") {
    return "https://readysetfly-api.onrender.com";
  }

  const hostname = window.location.hostname.toLowerCase();
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";

  const prefersSameOrigin =
    isLocalHost ||
    hostname === "readysetfly.us" ||
    hostname === "www.readysetfly.us" ||
    hostname.endsWith(".onrender.com");

  return prefersSameOrigin ? "" : "https://readysetfly-api.onrender.com";
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
