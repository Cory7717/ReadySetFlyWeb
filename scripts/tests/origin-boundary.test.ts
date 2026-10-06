import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import express from "express";
import cors from "cors";
import {
  buildCorsOptions,
  CorsOriginDeniedError,
  createCorsRejectionDiagnostics,
  getAllowedOrigins,
} from "../../server/corsOptions";
import {
  buildCanonicalFrontendRedirect,
  canonicalFrontendHost,
  isApiHostFrontendPage,
} from "../../server/middleware/canonicalFrontendHost";
import {
  redactSensitiveUrlForAuthLog,
  sanitizeAuthReferrerForLog,
} from "../../server/authRedirectUrls";
import {
  frontendUrlForHostname,
  withReturnTo,
} from "../../client/src/lib/returnTo";
import { getQueryFn } from "../../client/src/lib/queryClient";

const representativeApiPaths = [
  "/api/airports/search",
  "/api/airports/KAUS/runway-briefing",
  "/api/notams",
  "/api/rentals",
  "/api/courtyard/sales-intelligence/me",
  "/api/courtyard/sales-intelligence/meeting-calendar",
  "/api/schedule/requests",
  "/api/opsreport",
];

const startTestServer = async (allowedOrigins = getAllowedOrigins()) => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(canonicalFrontendHost);
  app.use(createCorsRejectionDiagnostics(allowedOrigins));
  app.use(cors(buildCorsOptions(allowedOrigins)));
  app.get("/api/ping", (_req, res) => res.json({ ok: true }));
  app.get(representativeApiPaths, (_req, res) => res.json({ ok: true }));
  app.get("/api/auth/google/callback", (_req, res) => res.json({ callback: true }));
  app.get("/healthz", (_req, res) => res.json({ ok: true }));
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof CorsOriginDeniedError) {
      return res.status(403).json({ message: "Origin not allowed", requestId: res.locals.requestId });
    }
    return next(err);
  });
  app.use("*", (_req, res) => res.status(200).type("text/html").send("frontend fallback"));

  const server = app.listen(0);
  await new Promise<void>((resolveReady) => server.once("listening", resolveReady));
  const address = server.address();
  assert(address && typeof address === "object");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => error ? rejectClose(error) : resolveClose());
    }),
  };
};

test("configured API hosts are excluded once during initialization, not revalidated per request", async () => {
  const warnings: string[] = [];
  const allowedOrigins = getAllowedOrigins(
    {
      NODE_ENV: "production",
      WEB_ORIGIN: "https://readysetfly.us,https://readysetfly-api.onrender.com",
      CORS_ORIGIN: "https://readysetfly-api.onrender.com",
    },
    (...args: unknown[]) => warnings.push(args.map(String).join(" ")),
  );

  assert.equal(allowedOrigins.includes("https://readysetfly.us"), true);
  assert.equal(allowedOrigins.includes("https://readysetfly-api.onrender.com"), false);
  assert.equal(warnings.length, 1);
  assert.deepEqual(JSON.parse(warnings[0]), {
    event: "cors_configured_api_origin_ignored",
    origin: "https://readysetfly-api.onrender.com",
    configuredBy: ["CORS_ORIGIN", "WEB_ORIGIN"],
    reason: "API-only origins are not valid browser app origins.",
  });

  const server = await startTestServer(allowedOrigins);
  try {
    for (let requestIndex = 0; requestIndex < 3; requestIndex += 1) {
      const response = await fetch(`${server.baseUrl}/api/ping`, {
        headers: { Origin: "https://readysetfly.us" },
      });
      assert.equal(response.status, 200);
    }
    assert.equal(warnings.length, 1);
  } finally {
    await server.close();
  }
});

test("signup navigation preserves a safe returnTo and escapes API-only hosts", () => {
  const priorWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { origin: "https://api.readysetfly.us", hostname: "api.readysetfly.us" } },
  });
  try {
    const path = withReturnTo("/register", "/flight-planner?departure=KAUS");
    assert.equal(path, "/register?redirect=%2Fflight-planner%3Fdeparture%3DKAUS");
    assert.equal(
      frontendUrlForHostname(path, "api.readysetfly.us"),
      "https://readysetfly.us/register?redirect=%2Fflight-planner%3Fdeparture%3DKAUS",
    );
    assert.equal(frontendUrlForHostname(path, "readysetfly.us"), path);
    assert.equal(frontendUrlForHostname("//evil.example/steal", "api.readysetfly.us"), "https://readysetfly.us/");
  } finally {
    if (priorWindow === undefined) {
      Reflect.deleteProperty(globalThis, "window");
    } else {
      Object.defineProperty(globalThis, "window", { configurable: true, value: priorWindow });
    }
  }
});

test("API host frontend redirects are fixed-origin and preserve path/query", () => {
  assert.equal(isApiHostFrontendPage("/register"), true);
  assert.equal(isApiHostFrontendPage("/flight-planner"), true);
  assert.equal(isApiHostFrontendPage("/api/auth/google/callback"), false);
  assert.equal(isApiHostFrontendPage("/healthz"), false);
  assert.equal(isApiHostFrontendPage("/downloads/guide.pdf"), false);
  assert.equal(
    buildCanonicalFrontendRedirect("/register?redirect=%2Fflight-planner"),
    "https://readysetfly.us/register?redirect=%2Fflight-planner",
  );
  assert.equal(
    buildCanonicalFrontendRedirect("//evil.example/steal?token=secret"),
    "https://readysetfly.us/steal?token=secret",
  );
});

test("API host redirects page routes while API, OAuth, health, and assets remain accessible", async () => {
  const server = await startTestServer();
  try {
    const page = await fetch(`${server.baseUrl}/flight-planner?departure=KAUS`, {
      headers: { "X-Forwarded-Host": "api.readysetfly.us" },
      redirect: "manual",
    });
    assert.equal(page.status, 308);
    assert.equal(page.headers.get("location"), "https://readysetfly.us/flight-planner?departure=KAUS");

    const renderPage = await fetch(`${server.baseUrl}/register`, {
      headers: { "X-Forwarded-Host": "readysetfly-api.onrender.com" },
      redirect: "manual",
    });
    assert.equal(renderPage.status, 308);
    assert.equal(renderPage.headers.get("location"), "https://readysetfly.us/register");

    for (const path of ["/api/ping", "/api/auth/google/callback", "/healthz"]) {
      const response = await fetch(`${server.baseUrl}${path}`, { headers: { "X-Forwarded-Host": "api.readysetfly.us" } });
      assert.equal(response.status, 200, path);
    }

    const asset = await fetch(`${server.baseUrl}/downloads/guide.pdf`, { headers: { "X-Forwarded-Host": "api.readysetfly.us" } });
    assert.equal(asset.status, 200);
    assert.equal(await asset.text(), "frontend fallback");
  } finally {
    await server.close();
  }
});

test("CORS allows frontend and no-origin traffic and handles preflight", async () => {
  const server = await startTestServer();
  try {
    const allowed = await fetch(`${server.baseUrl}/api/ping`, {
      headers: { Origin: "https://readysetfly.us" },
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("access-control-allow-origin"), "https://readysetfly.us");
    assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");

    for (const path of representativeApiPaths) {
      const response = await fetch(`${server.baseUrl}${path}`, {
        headers: { Origin: "https://readysetfly.us" },
      });
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get("access-control-allow-origin"), "https://readysetfly.us", path);
      assert.equal(response.headers.get("access-control-allow-credentials"), "true", path);
    }

    const preflight = await fetch(`${server.baseUrl}/api/ping`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://readysetfly.us",
        "Access-Control-Request-Method": "GET",
      },
    });
    assert.equal(preflight.status, 204);

    const noOrigin = await fetch(`${server.baseUrl}/api/ping`);
    assert.equal(noOrigin.status, 200);
    assert.equal(noOrigin.headers.get("access-control-allow-origin"), null);

    const nativeApiRequest = await fetch(`${server.baseUrl}/api/airports/search`);
    assert.equal(nativeApiRequest.status, 200);
    assert.equal(nativeApiRequest.headers.get("access-control-allow-origin"), null);
  } finally {
    await server.close();
  }
});

test("CORS denial is a quiet 403 and diagnostics exclude secrets", async () => {
  const server = await startTestServer();
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "));
  try {
    const denied = await fetch(`${server.baseUrl}/api/ping?token=super-secret`, {
      headers: {
        Origin: "https://api.readysetfly.us",
        Referer: "https://api.readysetfly.us/register?token=super-secret",
        Cookie: "session=super-secret",
        "X-Request-ID": "request-123",
        "CF-Ray": "ray-456",
        "User-Agent": "Mozilla/5.0 Chrome/120.0",
        "Sec-Fetch-Site": "same-origin",
      },
    });
    assert.equal(denied.status, 403);
    assert.deepEqual(await denied.json(), { message: "Origin not allowed", requestId: "request-123" });
    assert.equal(warnings.length, 1);
    const diagnostic = JSON.parse(warnings[0]);
    assert.equal(diagnostic.event, "cors_api_origin_rejected");
    assert.equal(diagnostic.pathname, "/api/ping");
    assert.equal(diagnostic.userAgentClass, "chrome");
    assert.equal(diagnostic.cloudflareRay, "ray-456");
    assert.equal(warnings[0].includes("super-secret"), false);

    const deniedPreflight = await fetch(`${server.baseUrl}/api/ping`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://api.readysetfly.us",
        "Access-Control-Request-Method": "POST",
      },
    });
    assert.equal(deniedPreflight.status, 403);
  } finally {
    console.warn = originalWarn;
    await server.close();
  }
});

test("unauthorized browser origins remain rejected across RSF and Courtyard APIs", async () => {
  const server = await startTestServer();
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "));
  try {
    for (const path of ["/api/airports/search", "/api/courtyard/sales-intelligence/me"]) {
      const response = await fetch(`${server.baseUrl}${path}`, {
        headers: { Origin: "https://unauthorized.example" },
      });
      assert.equal(response.status, 403, path);
      assert.equal(response.headers.get("access-control-allow-origin"), null, path);
    }
    assert.equal(warnings.length, 2);
    for (const warning of warnings) {
      assert.equal(JSON.parse(warning).event, "cors_origin_rejected");
    }
  } finally {
    console.warn = originalWarn;
    await server.close();
  }
});

test("authentication diagnostics remove credentials, fragments, and parameter values", () => {
  assert.equal(
    sanitizeAuthReferrerForLog("https://user:password@readysetfly.us/verify-email?token=secret#fragment"),
    "https://readysetfly.us/verify-email",
  );
  assert.equal(
    redactSensitiveUrlForAuthLog("https://readysetfly.us/login?code=secret&returnTo=%2Fflight-planner#fragment"),
    "https://readysetfly.us/login",
  );
});

test("anonymous auth remains a non-retrying null result", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
    calls += 1;
    assert.equal(init?.credentials, "include");
    return new Response(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const query = getQueryFn<unknown>({ on401: "returnNull" });
    const result = await query({ queryKey: ["/api/auth/user"] } as never);
    assert.equal(result, null);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OAuth callbacks remain API-hosted and completed web auth returns to the frontend", () => {
  const source = readFileSync(resolve("server/oauthSessionAuth.ts"), "utf8");
  assert.match(source, /return `\$\{getApiBaseUrl\(\)\}\/api\/auth\/google\/callback`/);
  assert.match(source, /callbackURL: `\$\{getApiBaseUrl\(\)\}\/api\/auth\/google\/mobile\/callback`/);
  assert.match(source, /const frontend = getFrontendBaseUrl\(req\)/);
  assert.match(source, /const redirectTarget = new URL\(returnTo, frontend\)\.toString\(\)/);
});

test("canonical and Open Graph page URLs use the validated frontend origin", () => {
  const source = readFileSync(resolve("server/vite.ts"), "utf8");
  assert.match(source, /const url = escapeHtml\(frontendAbsoluteUrl\(meta\.canonicalPath \|\| pathname\)\)/);
  assert.match(source, /<meta property="og:url" content="\$\{url\}" \/>/);
  assert.match(source, /<link rel="canonical" href="\$\{url\}" \/>/);
});
