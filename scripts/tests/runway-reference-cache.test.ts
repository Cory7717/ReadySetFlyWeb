import assert from "node:assert/strict";
import test from "node:test";
import {
  createRunwayReferenceCache,
  RunwayReferenceFetchError,
} from "../../server/services/runway-reference-cache";

const RUNWAY_CSV = [
  '"id","airport_ref","airport_ident","length_ft","width_ft","surface","lighted","closed","le_ident","le_latitude_deg","le_longitude_deg","le_elevation_ft","le_heading_degT","le_displaced_threshold_ft","he_ident","he_latitude_deg","he_longitude_deg","he_elevation_ft","he_heading_degT","he_displaced_threshold_ft"',
  '1,1,"KAUS",12250,150,"CON",1,0,"18L",0,0,0,180,0,"36R",0,0,0,360,0',
].join("\n");

function response(body = RUNWAY_CSV, status = 200, url = "https://davidmegginson.github.io/ourairports-data/runways.csv") {
  const result = new Response(body, { status });
  Object.defineProperty(result, "url", { value: url });
  return result;
}

function tlsError() {
  const cause = Object.assign(new Error("certificate has expired"), { code: "CERT_HAS_EXPIRED" });
  return Object.assign(new TypeError("fetch failed"), { cause });
}

function createCache(overrides: Partial<Parameters<typeof createRunwayReferenceCache>[0]> = {}) {
  return createRunwayReferenceCache({
    sourceUrl: "https://davidmegginson.github.io/ourairports-data/runways.csv",
    ttlMs: 100,
    maxStaleMs: 1_000,
    retryDelayMs: 50,
    timeoutMs: 25,
    log: () => undefined,
    ...overrides,
  });
}

test("loads and parses runway reference data successfully", async () => {
  const cache = createCache({ fetchImpl: async () => response() });
  const data = await cache.load();
  assert.equal(data.get("KAUS")?.[0]?.lengthFt, 12250);
  assert.equal(cache.getStatus().cacheStatus, "fresh");
});

test("classifies an expired TLS certificate and fails closed without cache", async () => {
  const cache = createCache({ fetchImpl: async () => { throw tlsError(); } });
  await assert.rejects(cache.load(), (error: any) => {
    assert.equal(error.code, "CERT_HAS_EXPIRED");
    assert.equal(error.classification, "tls");
    return true;
  });
  assert.equal(cache.getStatus().cacheStatus, "empty");
});

test("classifies DNS failure and rate-limits an immediate retry", async () => {
  let fetchCalls = 0;
  const dnsError = Object.assign(new TypeError("fetch failed"), {
    cause: Object.assign(new Error("not found"), { code: "ENOTFOUND" }),
  });
  const cache = createCache({
    fetchImpl: async () => {
      fetchCalls += 1;
      throw dnsError;
    },
  });
  await assert.rejects(cache.load(), (error: any) => error.classification === "dns");
  await assert.rejects(cache.load(), (error: any) => error.code === "ENOTFOUND");
  assert.equal(fetchCalls, 1);
});

test("aborts a runway fetch after the configured timeout", async () => {
  const cache = createCache({
    timeoutMs: 5,
    fetchImpl: async (_input, init) =>
      await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
  });
  await assert.rejects(cache.load(), (error: any) => {
    assert.equal(error.code, "ETIMEDOUT");
    assert.equal(error.classification, "timeout");
    return true;
  });
});

test("uses last-known-good data when a refresh fails within the stale window", async () => {
  let now = 1_000;
  let fail = false;
  const cache = createCache({
    now: () => now,
    fetchImpl: async () => {
      if (fail) throw tlsError();
      return response();
    },
  });
  const fresh = await cache.load();
  fail = true;
  now += 101;
  const fallback = await cache.load();
  assert.strictEqual(fallback, fresh);
  assert.equal(cache.getStatus().cacheStatus, "stale");
  assert.equal(cache.getStatus().lastErrorCode, "CERT_HAS_EXPIRED");
});

test("does not return data beyond the configured maximum stale age", async () => {
  let now = 1_000;
  let fail = false;
  const cache = createCache({
    now: () => now,
    fetchImpl: async () => {
      if (fail) throw tlsError();
      return response();
    },
  });
  await cache.load();
  fail = true;
  now += 1_001;
  await assert.rejects(cache.load(), RunwayReferenceFetchError);
  assert.equal(cache.getStatus().cacheStatus, "expired");
});

test("reports stale provenance and age without presenting fallback data as fresh", async () => {
  let now = 5_000;
  let fail = false;
  const cache = createCache({
    now: () => now,
    fetchImpl: async () => {
      if (fail) throw new TypeError("offline");
      return response();
    },
  });
  await cache.load();
  fail = true;
  now += 250;
  await cache.load();
  assert.deepEqual(
    { stale: cache.getStatus().stale, ageSeconds: cache.getStatus().ageSeconds },
    { stale: true, ageSeconds: 0 },
  );
});

test("fails closed when a followed redirect encounters invalid TLS", async () => {
  const cache = createCache({ fetchImpl: async () => { throw tlsError(); } });
  await assert.rejects(cache.load(), (error: any) => {
    assert.equal(error.classification, "tls");
    return true;
  });
});

test("deduplicates concurrent runway refresh requests", async () => {
  let fetchCalls = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const cache = createCache({
    fetchImpl: async () => {
      fetchCalls += 1;
      await gate;
      return response();
    },
  });
  const loads = [cache.load(), cache.load(), cache.load()];
  release?.();
  const results = await Promise.all(loads);
  assert.equal(fetchCalls, 1);
  assert.strictEqual(results[0], results[1]);
});

test("rejects empty or malformed provider datasets instead of caching false success", async () => {
  const cache = createCache({ fetchImpl: async () => response("airport_ident,length_ft\n") });
  await assert.rejects(cache.load(), (error: any) => {
    assert.equal(error.classification, "data");
    return true;
  });
  assert.equal(cache.getStatus().cacheStatus, "empty");
});
