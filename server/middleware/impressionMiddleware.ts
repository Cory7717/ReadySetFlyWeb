import type { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Augment Express Request with fields set by this middleware chain
// ---------------------------------------------------------------------------
declare global {
  namespace Express {
    interface Request {
      clientIP?: string;
      impressionCounted?: boolean;
    }
  }
}

// ---------------------------------------------------------------------------
// Gate flag — do NOT use NODE_ENV here. Vite owns that variable during the
// Render build step and conflicts with it, causing a 127 exit code.
// Set REQUIRE_CF_GUARD=true in Render environment on readysetfly-api only.
// ---------------------------------------------------------------------------
const CF_REQUIRED = process.env.REQUIRE_CF_GUARD === 'true';

// ---------------------------------------------------------------------------
// 1. Cloudflare Origin Guard
//    Blocks direct-origin requests that bypass Cloudflare (no CF headers).
//    Only active when CF_REQUIRED is true so local dev is unaffected.
// ---------------------------------------------------------------------------
export function cloudflareGuard(req: Request, res: Response, next: NextFunction): void {
  if (!CF_REQUIRED) {
    // In dev/staging, set a synthetic clientIP and pass through
    req.clientIP = req.ip || '127.0.0.1';
    return next();
  }

  const cfConnectingIp = req.headers['cf-connecting-ip'] as string | undefined;
  const cfRay = req.headers['cf-ray'] as string | undefined;

  if (!cfConnectingIp || !cfRay) {
    console.warn(
      `[CF-GUARD] Blocked direct-origin request from ${req.ip} to ${req.hostname}`,
    );
    res.status(403).json({
      error: 'Forbidden',
      message: 'Direct origin access is not permitted.',
    });
    return;
  }

  req.clientIP = cfConnectingIp;
  next();
}

// ---------------------------------------------------------------------------
// 2. Impression Rate Limiter
//    Max 10 requests per IP per 60-second window, scoped to impression routes.
//    Only active in production.
//    TODO: swap the in-memory buckets for a Redis INCR + EXPIRE when scaling
//    to multiple Render instances.
// ---------------------------------------------------------------------------
const RATE_WINDOW_MS = 60 * 1000; // 60 seconds
const RATE_MAX = 10;

// Map<ip, expiry timestamp of the current window>
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

// Prune expired buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  rateBuckets.forEach((bucket, key) => {
    if (now >= bucket.resetAt) rateBuckets.delete(key);
  });
}, 5 * 60 * 1000);

export function impressionRateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (!CF_REQUIRED) return next();

  const ip = req.clientIP || req.ip || 'unknown';
  const now = Date.now();
  const existing = rateBuckets.get(ip);

  if (!existing || now >= existing.resetAt) {
    // Start a fresh window
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return next();
  }

  if (existing.count >= RATE_MAX) {
    console.warn(`[RATE-LIMIT] ${ip} exceeded impression rate limit`);
    res.setHeader('X-RateLimit-Limit', String(RATE_MAX));
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(existing.resetAt / 1000)));
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Max 10 impression calls per minute.',
    });
    return;
  }

  existing.count += 1;
  res.setHeader('X-RateLimit-Limit', String(RATE_MAX));
  res.setHeader('X-RateLimit-Remaining', String(RATE_MAX - existing.count));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(existing.resetAt / 1000)));
  next();
}

// ---------------------------------------------------------------------------
// 3. Impression Deduplication
//    Same IP + same ad ID within 5 minutes = duplicate, not counted.
//    TODO: swap for a Redis SET NX PX call when scaling to multiple Render
//    instances — the in-memory Map is not shared across workers/instances.
// ---------------------------------------------------------------------------
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Map<`${adId}:${ip}`, expiry timestamp>
const dedupMap = new Map<string, number>();

// Prune expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  dedupMap.forEach((expiresAt, key) => {
    if (now >= expiresAt) dedupMap.delete(key);
  });
}, 10 * 60 * 1000);

export function impressionDedup(req: Request, res: Response, next: NextFunction): void {
  const ip = req.clientIP || req.ip || 'unknown';
  const adId = req.params.id;
  const key = `${adId}:${ip}`;
  const now = Date.now();

  const expiresAt = dedupMap.get(key);
  if (expiresAt && now < expiresAt) {
    console.log(`[DEDUP] Duplicate impression skipped: adId=${adId} ip=${ip}`);
    res.status(200).json({ counted: false, reason: 'duplicate' });
    return;
  }

  // Fresh impression — record it and let the route handler proceed
  dedupMap.set(key, now + DEDUP_TTL_MS);
  req.impressionCounted = true;
  next();
}
