import type { CorsOptions } from "cors";

const DEFAULT_WEB_ORIGINS = [
  "https://readysetfly.us",
  "https://www.readysetfly.us",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:5000",
];

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

function getConfiguredOrigins(): string[] {
  const envOrigins = [
    process.env.WEB_ORIGIN,
    process.env.CORS_ORIGIN,
    process.env.CLIENT_URL,
    process.env.APP_URL,
  ]
    .flatMap((value) => (value ? value.split(",") : []))
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);

  return Array.from(new Set([...DEFAULT_WEB_ORIGINS, ...envOrigins]));
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

      callback(new Error(`CORS origin not allowed: ${normalizedOrigin}`));
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
