import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import express from "express";
import { scannerGuard, isScannerProbePath } from "../../server/middleware/scannerGuard";

const startTestServer = async () => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(scannerGuard);
  app.get("/api/healthz", (_req, res) => res.json({ ok: true }));
  app.post("/api/flight-plans/:id/filing-action", (_req, res) => res.status(401).json({ error: "Unauthorized" }));
  app.use("*", (_req, res) => res.status(200).type("text/html").send("<!doctype html><div>fallback</div>"));

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

test("scanner guard identifies secret and backup probes", () => {
  assert.equal(isScannerProbePath("/.env"), true);
  assert.equal(isScannerProbePath("/.git/config"), true);
  assert.equal(isScannerProbePath("/backend/.env"), true);
  assert.equal(isScannerProbePath("/config/database.sql"), true);
  assert.equal(isScannerProbePath("/phpinfo.php"), true);
  assert.equal(isScannerProbePath("/assets/app.js.map"), true);
  assert.equal(isScannerProbePath("/api/healthz"), false);
});

test("scanner guard blocks probes before fallback HTML", async () => {
  const server = await startTestServer();
  try {
    for (const path of ["/.env", "/.git/config", "/backend/.env", "/phpinfo.php"]) {
      const response = await fetch(`${server.baseUrl}${path}`);
      const text = await response.text();
      assert.equal(response.status, 404);
      assert.equal(response.headers.get("content-type")?.startsWith("text/plain"), true);
      assert.equal(text.includes("fallback"), false);
    }

    const health = await fetch(`${server.baseUrl}/api/healthz`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);
  } finally {
    await server.close();
  }
});

test("Leidos filing action route remains protected by authentication middleware", () => {
  const routesSource = readFileSync(resolve("server/routes.ts"), "utf8");
  assert.match(
    routesSource,
    /app\.post\("\/api\/flight-plans\/:id\/filing-action",\s*isAuthenticated,/,
  );
  assert.match(
    routesSource,
    /app\.post\("\/api\/flight-plans\/:id\/filing-sync",\s*isAuthenticated,/,
  );
  assert.match(
    routesSource,
    /app\.post\("\/api\/leidos\/webhooks\/flight-service"[\s\S]*verifyLeidosWebhookAuthorization\(req\.headers\.authorization\)/,
  );
  assert.match(
    routesSource,
    /app\.post\("\/api\/leidos\/webhooks\/flight-service"[\s\S]*LEIDOS_WEBHOOK_SUCCESS_RESPONSE/,
  );
  assert.doesNotMatch(
    routesSource,
    /event:\s*"leidos_push_no_flight_identifier"[\s\S]{0,300}body:\s*payload/,
  );
});
