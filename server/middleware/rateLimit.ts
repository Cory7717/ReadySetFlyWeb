import crypto from "crypto";

type RateLimitConfig = {
  windowMs?: number;
  anonMax?: number;
  authMax?: number;
  message?: string;
  key?: string;
};

const readNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const hashIp = (ip: string) =>
  crypto.createHash("sha256").update(ip).digest("hex").slice(0, 12);

const buckets = new Map<string, number[]>();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  const windowMs = readNumber(process.env.RATE_LIMIT_ANON_WINDOW_MS, 10 * 60 * 1000);
  for (const [key, timestamps] of buckets.entries()) {
    const recent = timestamps.filter((t) => now - t < windowMs);
    if (recent.length === 0) {
      buckets.delete(key);
    } else {
      buckets.set(key, recent);
    }
  }
}, CLEANUP_INTERVAL_MS);

export const createSoftAuthRateLimiter = (config: RateLimitConfig = {}) => {
  const baseWindowMs = readNumber(process.env.RATE_LIMIT_ANON_WINDOW_MS, 10 * 60 * 1000);
  const defaultAnonMax = readNumber(process.env.RATE_LIMIT_ANON_MAX, 60);
  const defaultAuthMax = readNumber(process.env.RATE_LIMIT_AUTH_MAX, 300);

  return (req: any, res: any, next: any) => {
    if (process.env.SOFT_AUTH_ENABLED === "false") {
      return next();
    }

    const isAuthed = Boolean(req.user?.claims?.sub || req.user?.id);
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    const windowMs = config.windowMs ?? baseWindowMs;
    const anonMax = config.anonMax ?? defaultAnonMax;
    const authMax = config.authMax ?? defaultAuthMax;
    const max = isAuthed ? authMax : anonMax;
    const routeKey = config.key || req.route?.path || req.path || "unknown";
    const bucketKey = `${routeKey}:${isAuthed ? "auth" : "anon"}:${ip}`;

    const now = Date.now();
    const timestamps = buckets.get(bucketKey) ?? [];
    const recent = timestamps.filter((t) => now - t < windowMs);

    if (recent.length >= max) {
      const ipHash = hashIp(ip);
      console.warn(
        JSON.stringify({
          event: "rate_limited",
          route: routeKey,
          isAuthed,
          ipHash,
        })
      );
      return res.status(429).json({
        error: "rate_limited",
        message: "Please try again later or create a free account for higher limits.",
      });
    }

    recent.push(now);
    buckets.set(bucketKey, recent);
    return next();
  };
};
