import type { Request } from "express";

const DEFAULT_FRONTEND_BASE_URL = "https://readysetfly.us";
const DEFAULT_API_BASE_URL = "https://api.readysetfly.us";

const API_ONLY_HOSTS = new Set([
  "api.readysetfly.us",
  "readysetfly-api.onrender.com",
]);

const PUBLIC_WEB_HOSTS = new Set([
  "readysetfly.us",
  "www.readysetfly.us",
  "readysetfly-web.onrender.com",
]);

function normalizeUrlOrigin(value: string | null | undefined): string | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProtocol).origin.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function hostnameFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isApiOnlyOrigin(value: string | null): boolean {
  const hostname = hostnameFromUrl(value);
  return Boolean(hostname && API_ONLY_HOSTS.has(hostname));
}

function isLocalOrigin(value: string | null): boolean {
  const hostname = hostnameFromUrl(value);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isUsableFrontendOrigin(value: string | null): value is string {
  if (!value) return false;
  if (isApiOnlyOrigin(value)) return false;

  const hostname = hostnameFromUrl(value);
  if (!hostname) return false;
  if (PUBLIC_WEB_HOSTS.has(hostname)) return true;
  if (isLocalOrigin(value) && process.env.NODE_ENV !== "production") return true;

  return process.env.NODE_ENV !== "production";
}

function normalizeReadySetFlyApiUrl(value: string): string {
  const origin = normalizeUrlOrigin(value);
  if (!origin) return String(value || "").trim().replace(/\/+$/, "");

  try {
    const parsed = new URL(origin);
    if (
      parsed.hostname.toLowerCase() === "readysetfly-api.onrender.com" &&
      String(process.env.NODE_ENV).toLowerCase() === "production"
    ) {
      parsed.hostname = "api.readysetfly.us";
      return parsed.origin;
    }
    return parsed.origin;
  } catch {
    return origin;
  }
}

function requestOrigin(req?: Request): string | null {
  if (!req) return null;
  const host = req.get("x-forwarded-host") || req.get("host");
  if (!host) return null;
  const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
  return normalizeUrlOrigin(`${protocol}://${host}`);
}

export function getFrontendBaseUrl(req?: Request): string {
  const candidates = [
    process.env.FRONTEND_BASE_URL,
    process.env.FRONTEND_URL,
    process.env.CLIENT_URL,
    process.env.PUBLIC_URL,
    process.env.WEB_BASE_URL,
    process.env.WEB_ORIGIN,
    process.env.APP_URL,
    process.env.APP_BASE_URL,
    process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : null,
    requestOrigin(req),
    process.env.NODE_ENV !== "production" ? `http://localhost:${process.env.PORT || "5000"}` : null,
    DEFAULT_FRONTEND_BASE_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeUrlOrigin(candidate);
    if (isUsableFrontendOrigin(normalized)) return normalized;
  }

  return DEFAULT_FRONTEND_BASE_URL;
}

export function getApiBaseUrl(req?: Request): string {
  const candidates = [
    process.env.API_BASE_URL,
    process.env.API_URL,
    process.env.PUBLIC_API_BASE_URL,
    process.env.VITE_API_BASE_URL,
    process.env.VITE_API_URL,
    process.env.RENDER_EXTERNAL_URL,
    requestOrigin(req),
    process.env.NODE_ENV !== "production" ? `http://localhost:${process.env.PORT || "5000"}` : null,
    DEFAULT_API_BASE_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeUrlOrigin(candidate);
    if (!normalized) continue;
    const hostname = hostnameFromUrl(normalized);
    if (hostname && (API_ONLY_HOSTS.has(hostname) || isLocalOrigin(normalized))) {
      return normalizeReadySetFlyApiUrl(normalized);
    }
  }

  return DEFAULT_API_BASE_URL;
}

export function buildFrontendUrl(pathOrUrl: string, req?: Request): string {
  try {
    return new URL(pathOrUrl, getFrontendBaseUrl(req)).toString();
  } catch {
    return getFrontendBaseUrl(req);
  }
}

export function redactSensitiveUrlForAuthLog(value: string | null | undefined): string | null {
  const normalized = normalizeUrlOrigin(value);
  if (!normalized && !value) return null;

  try {
    const parsed = new URL(String(value));
    for (const key of ["token", "code", "state", "access_token", "refresh_token", "id_token"]) {
      if (parsed.searchParams.has(key)) parsed.searchParams.set(key, "[redacted]");
    }
    return parsed.toString();
  } catch {
    return normalized || String(value || "").replace(/(token=)[^&]+/gi, "$1[redacted]");
  }
}

export function emailDomainOnly(email: string | null | undefined): string | null {
  const domain = String(email || "").split("@")[1]?.trim().toLowerCase();
  return domain || null;
}

export function logAuthRedirectDiagnostic(
  event: string,
  req: Request | undefined,
  details: Record<string, unknown> = {},
) {
  const payload = {
    event,
    requestHost: req?.get("host") || null,
    requestOrigin: req?.get("origin") || null,
    requestReferer: req?.get("referer") || req?.get("referrer") || null,
    ...details,
  };

  console.log(JSON.stringify(payload));
}
