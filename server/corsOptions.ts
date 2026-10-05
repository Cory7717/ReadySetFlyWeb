import crypto from "crypto";
import type { RequestHandler } from "express";
import type { CorsOptions } from "cors";

const DEFAULT_WEB_ORIGINS = [
  "https://readysetfly.us",
  "https://www.readysetfly.us",
];

const LOCAL_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:5000",
];

const API_ONLY_ORIGINS = new Set([
  "https://api.readysetfly.us",
  "https://readysetfly-api.onrender.com",
]);

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

export class CorsOriginDeniedError extends Error {
  status = 403;
  statusCode = 403;
  code = "CORS_ORIGIN_DENIED";

  constructor() {
    super("Origin not allowed");
    this.name = "CorsOriginDeniedError";
  }
}

function safeHeader(value: unknown, maxLength = 160): string | null {
  const normalized = String(value || "").replace(/[\r\n\t]/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function safeCorrelationId(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return /^[A-Za-z0-9._:-]{1,128}$/.test(normalized) ? normalized : null;
}

function safeOriginForLog(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return "invalid";
  }
}

function coarseUserAgent(value: unknown): string {
  const userAgent = String(value || "");
  if (!userAgent) return "unknown";
  if (/(bot|crawler|spider|headless|lighthouse|monitor|uptime)/i.test(userAgent)) return "automation";
  if (/(wv\)|webview|; wv)/i.test(userAgent)) return "webview";
  if (/(okhttp|dart|expo|reactnative|readysetfly)/i.test(userAgent)) return "native-client";
  if (/Edg\//i.test(userAgent)) return "edge";
  if (/Firefox\//i.test(userAgent)) return "firefox";
  if (/Chrome\//i.test(userAgent)) return "chrome";
  if (/Safari\//i.test(userAgent)) return "safari";
  return "other";
}

function isRejectedOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  return !allowedOrigins.includes(normalizeOrigin(origin));
}

export const corsRejectionDiagnostics: RequestHandler = (req, res, next) => {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  const allowedOrigins = getConfiguredOrigins();
  if (!isRejectedOrigin(origin, allowedOrigins)) return next();

  const incomingRequestId = safeCorrelationId(req.headers["x-request-id"]);
  const cloudflareRay = safeCorrelationId(req.headers["cf-ray"]);
  const requestId = incomingRequestId || cloudflareRay || crypto.randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);

  console.warn(JSON.stringify({
    event: API_ONLY_ORIGINS.has(normalizeOrigin(origin!))
      ? "cors_api_origin_rejected"
      : "cors_origin_rejected",
    requestId,
    method: req.method,
    pathname: String(req.path || "/").slice(0, 300),
    host: safeHeader(req.get("host"), 255),
    origin: safeOriginForLog(origin),
    cloudflareRay,
    secFetchSite: safeHeader(req.headers["sec-fetch-site"], 32),
    userAgentClass: coarseUserAgent(req.headers["user-agent"]),
  }));

  return next();
};

function getConfiguredOrigins(): string[] {
  const envOrigins = [
    process.env.WEB_ORIGIN,
    process.env.CORS_ORIGIN,
    process.env.CLIENT_URL,
    process.env.APP_URL,
  ]
    .flatMap((value) => (value ? value.split(",") : []))
    .map((value) => normalizeOrigin(value))
    .filter(Boolean)
    .filter((value) => {
      if (!API_ONLY_ORIGINS.has(value)) return true;
      console.warn(JSON.stringify({
        event: "cors_configured_api_origin_ignored",
        origin: value,
        reason: "API-only origins are not valid browser app origins.",
      }));
      return false;
    });

  const defaults = process.env.NODE_ENV === "production"
    ? DEFAULT_WEB_ORIGINS
    : [...DEFAULT_WEB_ORIGINS, ...LOCAL_DEV_ORIGINS];
  return Array.from(new Set([...defaults, ...envOrigins]));
}

export function getAllowedOrigins(): string[] {
  return getConfiguredOrigins();
}

export function buildCorsOptions(): CorsOptions {
  const allowedOrigins = getConfiguredOrigins();

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);
      if (allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      callback(new CorsOriginDeniedError());
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Origin",
      "X-Requested-With",
    ],
    optionsSuccessStatus: 204,
  };
}
