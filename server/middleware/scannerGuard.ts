import type { Request, RequestHandler } from "express";

type ScannerBucket = {
  count: number;
  resetAt: number;
};

const SCANNER_WINDOW_MS = 10 * 60 * 1000;
const SCANNER_MAX_ATTEMPTS = 30;
const scannerBuckets = new Map<string, ScannerBucket>();

const directScannerPatterns = [
  /^\/(\.env(?:[.~].*)?|\.git(?:\/|$)|\.svn(?:\/|$)|\.hg(?:\/|$)|\.DS_Store(?:$|\/))/i,
  /\/\.env(\.|$|~)/i,
  /\/\.git\//i,
  /^\/(?:phpinfo|info|test|debug)\.php$/i,
  /\.(bak|backup|old|save|swp|sql|zip|tar|gz|7z|map)$/i,
];

const sensitiveConfigDirs = new Set([
  "admin",
  "api",
  "backend",
  "bootstrap",
  "config",
  "database",
  "private",
  "src",
  "storage",
  "vendor",
  "wp",
  "wordpress",
  "laravel",
]);

const secretLikeNames = [
  ".env",
  "env",
  "config",
  "configuration",
  "credentials",
  "database",
  "db",
  "secret",
  "secrets",
  "settings",
];

const secretLikeExtensions = /\.(env|ini|conf|config|json|yaml|yml|toml|xml|sql|bak|backup|old|save|swp|zip|tar|gz|7z)$/i;

const safeDecodePath = (path: string) => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

export const isScannerProbePath = (rawPath: string) => {
  const path = safeDecodePath(rawPath || "/").replace(/\\/g, "/");
  if (directScannerPatterns.some((pattern) => pattern.test(path))) return true;

  const segments = path.split("/").filter(Boolean);
  if (segments.some((segment) => /^(\.env|\.git|\.svn|\.hg|\.DS_Store)(?:$|[.~])/i.test(segment))) {
    return true;
  }

  const lowerSegments = segments.map((segment) => segment.toLowerCase());
  const hasSensitiveDir = lowerSegments.some((segment) => sensitiveConfigDirs.has(segment));
  if (!hasSensitiveDir) return false;

  const leaf = lowerSegments[lowerSegments.length - 1] || "";
  if (secretLikeNames.some((name) => leaf === name || leaf.startsWith(`${name}.`) || leaf.startsWith(`${name}~`))) {
    return true;
  }

  return secretLikeExtensions.test(leaf);
};

const getRequestIp = (req: Request) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return Array.isArray(ip) ? ip[0] || "unknown" : String(ip);
};

const getRequestId = (req: Request) => {
  const value = req.headers["x-request-id"] || req.headers["cf-ray"];
  return Array.isArray(value) ? value[0] || null : value || null;
};

const incrementScannerBucket = (ip: string) => {
  const now = Date.now();
  const existing = scannerBuckets.get(ip);
  if (!existing || existing.resetAt <= now) {
    const next = { count: 1, resetAt: now + SCANNER_WINDOW_MS };
    scannerBuckets.set(ip, next);
    return next;
  }
  existing.count += 1;
  return existing;
};

setInterval(() => {
  const now = Date.now();
  scannerBuckets.forEach((bucket, ip) => {
    if (bucket.resetAt <= now) scannerBuckets.delete(ip);
  });
}, SCANNER_WINDOW_MS).unref?.();

export const scannerGuard: RequestHandler = (req, res, next) => {
  if (!isScannerProbePath(req.path)) return next();

  const ip = getRequestIp(req);
  const bucket = incrementScannerBucket(ip);
  console.warn(JSON.stringify({
    event: "blocked_scanner_probe",
    path: req.originalUrl || req.path,
    method: req.method,
    ip,
    userAgent: req.headers["user-agent"] || null,
    requestId: getRequestId(req),
  }));

  if (bucket.count > SCANNER_MAX_ATTEMPTS) {
    res.setHeader("Retry-After", Math.ceil((bucket.resetAt - Date.now()) / 1000));
    return res.status(429).type("text/plain").send("Not found");
  }

  return res.status(404).type("text/plain").send("Not found");
};
