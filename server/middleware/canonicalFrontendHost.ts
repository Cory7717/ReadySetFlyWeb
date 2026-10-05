import type { RequestHandler } from "express";

const API_HOSTNAME = "api.readysetfly.us";
const API_ONLY_HOSTNAMES = new Set([
  API_HOSTNAME,
  "readysetfly-api.onrender.com",
]);
const CANONICAL_FRONTEND_ORIGIN = "https://readysetfly.us";

const EXEMPT_PATH_PREFIXES = [
  "/api",
  "/healthz",
  "/assets",
  "/cesium",
  "/objects",
  "/public-objects",
  "/attached_assets",
  "/uploads",
  "/downloads",
];

const EXEMPT_FILES = new Set([
  "/favicon.ico",
  "/manifest.json",
  "/robots.txt",
  "/sitemap.xml",
  "/firebase-messaging-sw.js",
  "/service-worker.js",
]);

function normalizedHostname(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(":")[0];
}

export function isApiHostFrontendPage(pathname: string): boolean {
  const path = String(pathname || "/");
  if (EXEMPT_FILES.has(path)) return false;
  return !EXEMPT_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function buildCanonicalFrontendRedirect(originalUrl: string): string {
  try {
    const parsed = new URL(originalUrl || "/", `https://${API_HOSTNAME}`);
    return `${CANONICAL_FRONTEND_ORIGIN}${parsed.pathname}${parsed.search}`;
  } catch {
    return CANONICAL_FRONTEND_ORIGIN;
  }
}

export const canonicalFrontendHost: RequestHandler = (req, res, next) => {
  const forwardedHost = String(req.get("x-forwarded-host") || "").split(",")[0].trim();
  const hostname = normalizedHostname(forwardedHost || req.hostname || req.get("host") || "");
  if (!API_ONLY_HOSTNAMES.has(hostname) || !isApiHostFrontendPage(req.path)) {
    return next();
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(404).json({ error: "Route not found" });
  }

  return res.redirect(308, buildCanonicalFrontendRedirect(req.originalUrl));
};
