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

const BROWSER_ORIGIN_ENV_KEYS = [
  "WEB_ORIGIN",
  "CORS_ORIGIN",
  "CLIENT_URL",
  "APP_URL",
] as const;

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

export function createCorsRejectionDiagnostics(allowedOrigins: readonly string[]): RequestHandler {
  const configuredOrigins = [...allowedOrigins];
  return (req, res, next) => {
    const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
    if (!isRejectedOrigin(origin, configuredOrigins)) return next();

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
}

export function getAllowedOrigins(
  environment: NodeJS.ProcessEnv = process.env,
  warn: (...data: unknown[]) => void = console.warn,
): string[] {
  const ignoredApiOrigins = new Map<string, Set<string>>();
  const envOrigins = BROWSER_ORIGIN_ENV_KEYS.flatMap((source) =>
    (environment[source] ? environment[source]!.split(",") : []).map((value) => ({
      origin: normalizeOrigin(value),
      source,
    })),
  )
    .filter(({ origin }) => Boolean(origin))
    .filter(({ origin, source }) => {
      if (!API_ONLY_ORIGINS.has(origin)) return true;
      const sources = ignoredApiOrigins.get(origin) || new Set<string>();
      sources.add(source);
      ignoredApiOrigins.set(origin, sources);
      return false;
    })
    .map(({ origin }) => origin);

  ignoredApiOrigins.forEach((sources, origin) => {
    warn(JSON.stringify({
      event: "cors_configured_api_origin_ignored",
      origin,
      configuredBy: Array.from(sources).sort(),
      reason: "API-only origins are not valid browser app origins.",
    }));
  });

  const defaults = environment.NODE_ENV === "production"
    ? DEFAULT_WEB_ORIGINS
    : [...DEFAULT_WEB_ORIGINS, ...LOCAL_DEV_ORIGINS];
  return Array.from(new Set([...defaults, ...envOrigins]));
}

export function buildCorsOptions(allowedOrigins: readonly string[] = getAllowedOrigins()): CorsOptions {
  const configuredOrigins = [...allowedOrigins];

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);
      if (configuredOrigins.includes(normalizedOrigin)) {
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
