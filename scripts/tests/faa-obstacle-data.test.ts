import assert from "node:assert/strict";
import test from "node:test";
import AdmZip from "adm-zip";
import { Readable } from "node:stream";
import {
  DEFAULT_FAA_DDOF_CACHE_TTL_MS,
  MAX_FAA_DDOF_CACHE_TTL_MS,
  MIN_FAA_DDOF_CACHE_TTL_MS,
  OFFICIAL_FAA_DDOF_URL,
  buildFaaObstacleDownloadUrl,
  createFaaObstacleDataService,
  parseFaaObstacleCsvBuffer,
  queryNearbyFaaObstacles,
  logFaaObstacleSnapshotDiagnostic,
  resolveFaaObstacleCacheTtlMs,
  resolveFaaObstacleSource,
} from "../../server/services/faaObstacleData";
import type { FaaObstacleRecord } from "../../server/services/faaObstacleData";
import type {
  FaaObstacleDurableSnapshot,
  FaaObstacleSnapshotStore,
} from "../../server/services/faaObstacleSnapshotStore";
import {
  createS3FaaObstacleSnapshotStore,
  FaaObstacleSnapshotStoreError,
} from "../../server/services/faaObstacleSnapshotStore";

const HEADER =
  "OAS,VERIFIED STATUS,COUNTRY,STATE,CITY,LATDEC,LONDEC,DMSLAT,DMSLON,TYPE,QUANTITY,AGL,AMSL,LIGHTING,ACCURACY,MARKING,FAA STUDY,ACTION,JDATE";

function csv(rows = 2) {
  return Buffer.from(
    [
      HEADER,
      ...Array.from({ length: rows }, (_, index) =>
        [
          `48-${String(index + 1).padStart(6, "0")}`,
          "O",
          "US",
          "TX",
          index === 0 ? 'AUSTIN, NORTH' : "CEDAR PARK",
          String(30.2 + index * 0.01),
          String(-97.7 - index * 0.01),
          "",
          "",
          "TOWER",
          "1",
          "00200",
          "01000",
          "R",
          "5D",
          "M",
          "2026ASW00001OE",
          "C",
          "2026285",
        ]
          .map((value) =>
            value.includes(",") ? `"${value.replace(/"/g, '""')}"` : value,
          )
          .join(","),
      ),
      "",
    ].join("\r\n"),
    "utf8",
  );
}

function zipWith(
  entryName = "DOF.CSV",
  csvBuffer = csv(),
  entryTime = new Date("2026-10-12T03:31:49Z"),
) {
  const zip = new AdmZip();
  zip.addFile(entryName, csvBuffer);
  const entry = zip.getEntry(entryName);
  if (entry) entry.header.time = entryTime;
  return zip.toBuffer();
}

function directoryHtml(size: number) {
  return `10/12/2026  3:31 AM ${size} <A HREF="/Obst_Data/DAILY_DOF_CSV.ZIP">DAILY_DOF_CSV.ZIP</A>`;
}

class MemorySnapshotStore implements FaaObstacleSnapshotStore {
  snapshot: FaaObstacleDurableSnapshot | null = null;

  async load() {
    return this.snapshot
      ? {
          archive: Buffer.from(this.snapshot.archive),
          manifest: { ...this.snapshot.manifest },
        }
      : null;
  }

  async save(snapshot: FaaObstacleDurableSnapshot) {
    this.snapshot = {
      archive: Buffer.from(snapshot.archive),
      manifest: { ...snapshot.manifest },
    };
  }
}

function obstacle(
  id: string,
  lat: number,
  amslFt: number | null,
  aglFt: number | null,
): FaaObstacleRecord {
  return {
    id,
    lat,
    lon: -97.7,
    amslFt,
    aglFt,
    city: "AUSTIN",
    state: "TX",
    kind: "TOWER",
    lighting: "R",
  };
}

test("FAA obstacle configuration preserves overrides and safely defaults TTL", () => {
  assert.deepEqual(resolveFaaObstacleSource(undefined), {
    sourceUrl: OFFICIAL_FAA_DDOF_URL,
    sourceWasOverridden: false,
  });
  assert.deepEqual(resolveFaaObstacleSource("  https://mirror.example/dof.zip  "), {
    sourceUrl: "https://mirror.example/dof.zip",
    sourceWasOverridden: true,
  });
  assert.equal(
    resolveFaaObstacleCacheTtlMs(undefined),
    DEFAULT_FAA_DDOF_CACHE_TTL_MS,
  );
  assert.equal(
    resolveFaaObstacleCacheTtlMs("not-a-number"),
    DEFAULT_FAA_DDOF_CACHE_TTL_MS,
  );
  assert.equal(resolveFaaObstacleCacheTtlMs("1"), MIN_FAA_DDOF_CACHE_TTL_MS);
  assert.equal(
    resolveFaaObstacleCacheTtlMs(String(30 * 24 * 60 * 60 * 1000)),
    MAX_FAA_DDOF_CACHE_TTL_MS,
  );
});

test("official and overridden download URLs preserve exact endpoint semantics", () => {
  const defaultUrl = buildFaaObstacleDownloadUrl({
    sourceUrl: OFFICIAL_FAA_DDOF_URL,
    sourceWasOverridden: false,
    nowMs: 1_800_000,
    cacheTtlMs: 900_000,
  });
  assert.equal(defaultUrl, OFFICIAL_FAA_DDOF_URL);
  const override = "https://aeronav.faa.gov/Obst_Data/DAILY_DOF_CSV.ZIP?signed=value";
  assert.equal(
    buildFaaObstacleDownloadUrl({
      sourceUrl: override,
      sourceWasOverridden: true,
      nowMs: 1_800_000,
      cacheTtlMs: 900_000,
    }),
    override,
  );
});

test("current FAA CSV schema maps OAS to a stable identifier", () => {
  const parsed = parseFaaObstacleCsvBuffer(csv(), {
    minRecords: 2,
    maxRecords: 10,
  });
  assert.equal(parsed.records.length, 2);
  assert.equal(parsed.records[0].id, "48-000001");
  assert.equal(parsed.records[0].city, "AUSTIN, NORTH");
  assert.equal(parsed.records[0].lat, 30.2);
  assert.equal(parsed.records[0].lon, -97.7);
  assert.equal(parsed.records[0].aglFt, 200);
  assert.equal(parsed.records[0].amslFt, 1000);
});

test("parser rejects incomplete schemas and unreasonable coordinate quality", () => {
  assert.throws(
    () =>
      parseFaaObstacleCsvBuffer(
        Buffer.from("LATDEC,LONDEC,TYPE,AGL,AMSL\n30,-97,TOWER,1,2\n"),
        { minRecords: 1 },
      ),
    /missing required headers: identifier/,
  );
  const invalid = Buffer.from(
    `${HEADER}\n48-000001,O,US,TX,AUSTIN,999,-97,,,TOWER,1,200,1000,R,5D,M,X,C,2026285\n`,
  );
  assert.throws(
    () => parseFaaObstacleCsvBuffer(invalid, { minRecords: 0 }),
    /coordinate validation failed/,
  );
});

test("parser rejects duplicate stable OAS identifiers", () => {
  const duplicate = Buffer.from(
    `${HEADER}\n48-000001,O,US,TX,AUSTIN,30.2,-97.7,,,TOWER,1,200,1000,R,5D,M,X,C,2026285\n48-000001,O,US,TX,AUSTIN,30.3,-97.8,,,TOWER,1,300,1100,R,5D,M,X,C,2026285\n`,
  );
  assert.throws(
    () => parseFaaObstacleCsvBuffer(duplicate, { minRecords: 1 }),
    /duplicate stable obstacle identifier/,
  );
});

test("parser preserves missing MSL separately from valid AGL height", () => {
  const missingMsl = Buffer.from(
    `${HEADER}\n48-000001,O,US,TX,AUSTIN,30.2,-97.7,,,TOWER,1,200,,R,5D,M,X,C,2026285\n`,
  );
  const parsed = parseFaaObstacleCsvBuffer(missingMsl, { minRecords: 1 });
  assert.equal(parsed.records[0].amslFt, null);
  assert.equal(parsed.records[0].aglFt, 200);
});

test("nearby query treats missing MSL as unverifiable and never substitutes AGL", () => {
  const result = queryNearbyFaaObstacles({
    records: [obstacle("missing-msl", 30.2, null, 2_000)],
    lat: 30.2,
    lon: -97.7,
    radiusNm: 10,
    limit: 5,
  });
  assert.equal(result.highestObstacle, null);
  assert.equal(result.mslElevationAvailableCount, 0);
  assert.equal(result.missingMslElevationCount, 1);
  assert.equal(result.clearanceStatus, "unverifiable");
});

test("nearby query returns a known MSL obstacle as verifiable", () => {
  const result = queryNearbyFaaObstacles({
    records: [obstacle("known-msl", 30.2, 1_250, 300)],
    lat: 30.2,
    lon: -97.7,
    radiusNm: 10,
    limit: 5,
  });
  assert.equal(result.highestObstacle?.id, "known-msl");
  assert.equal(result.highestObstacle?.amslFt, 1_250);
  assert.equal(result.clearanceStatus, "verifiable");
});

test("mixed nearby obstacles exclude missing MSL from the highest calculation", () => {
  const result = queryNearbyFaaObstacles({
    records: [
      obstacle("tall-agl-no-msl", 30.2, null, 5_000),
      obstacle("known-msl", 30.21, 1_500, 200),
    ],
    lat: 30.2,
    lon: -97.7,
    radiusNm: 10,
    limit: 5,
  });
  assert.equal(result.highestObstacle?.id, "known-msl");
  assert.equal(result.mslElevationAvailableCount, 1);
  assert.equal(result.missingMslElevationCount, 1);
});

test("highest MSL obstacle is selected across the complete radius before display limiting", () => {
  const result = queryNearbyFaaObstacles({
    records: [
      obstacle("near-low", 30.2, 800, 100),
      obstacle("far-high", 30.25, 3_500, 500),
    ],
    lat: 30.2,
    lon: -97.7,
    radiusNm: 10,
    limit: 1,
  });
  assert.equal(result.nearby.length, 1);
  assert.equal(result.nearby[0].id, "near-low");
  assert.equal(result.highestObstacle?.id, "far-high");
  assert.equal(result.highestObstacle?.amslFt, 3_500);
});

test("verified refresh accepts matching directory metadata and exposes additive provenance", async () => {
  const archive = zipWith();
  const requests: Array<{ url: string; headers: Headers }> = [];
  const service = createFaaObstacleDataService({
    minRecords: 2,
    maxRecords: 10,
    now: () => Date.parse("2026-10-12T12:00:00Z"),
    fetchImpl: async (input, init) => {
      const url = String(input);
      requests.push({ url, headers: new Headers(init?.headers) });
      if (url === "https://aeronav.faa.gov/Obst_Data/") {
        return new Response(directoryHtml(archive.length), { status: 200 });
      }
      if (init?.method === "HEAD") {
        return new Response(null, {
          status: 200,
          headers: { "content-length": String(archive.length) },
        });
      }
      return new Response(new Uint8Array(archive), {
        status: 200,
        headers: { "last-modified": "Mon, 12 Oct 2026 03:31:49 GMT" },
      });
    },
  });
  const result = await service.getData();
  assert.equal(result.records.length, 2);
  assert.equal(result.referenceData.status, "fresh");
  assert.equal(result.referenceData.stale, false);
  assert.equal(result.referenceData.provenance, "official-default");
  assert.ok(result.referenceData.freshnessBasis.includes("faa-directory-size"));
  const archiveRequest = requests.find(
    ({ url, headers }) =>
      url === OFFICIAL_FAA_DDOF_URL && headers.get("accept") === "application/octet-stream",
  );
  assert.ok(archiveRequest);
  assert.equal(archiveRequest.headers.get("accept"), "application/octet-stream");
  assert.equal(archiveRequest.headers.get("accept-encoding"), "identity");
  assert.equal(archiveRequest.headers.get("cache-control"), "no-cache");
});

test("directory size mismatch rejects an upstream stale copy", async () => {
  const archive = zipWith();
  const service = createFaaObstacleDataService({
    minRecords: 2,
    maxRecords: 10,
    now: () => Date.parse("2026-10-12T12:00:00Z"),
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url === "https://aeronav.faa.gov/Obst_Data/") {
        return new Response(directoryHtml(archive.length + 1), { status: 200 });
      }
      if (init?.method === "HEAD") {
        return new Response(null, {
          status: 200,
          headers: { "content-length": String(archive.length) },
        });
      }
      return new Response(new Uint8Array(archive), {
        status: 200,
        headers: { "last-modified": "Mon, 12 Oct 2026 03:31:49 GMT" },
      });
    },
  });
  await assert.rejects(
    service.getData(),
    /did not match the current official directory publication/,
  );
});

test("stale HTTP metadata cannot override matching current directory and ZIP evidence", async () => {
  const archive = zipWith();
  const service = createFaaObstacleDataService({
    minRecords: 2,
    maxRecords: 10,
    now: () => Date.parse("2026-10-12T12:00:00Z"),
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url === "https://aeronav.faa.gov/Obst_Data/") {
        return new Response(directoryHtml(archive.length), { status: 200 });
      }
      if (init?.method === "HEAD") {
        return new Response(null, {
          status: 200,
          headers: { "content-length": String(archive.length) },
        });
      }
      return new Response(new Uint8Array(archive), {
        status: 200,
        headers: { "last-modified": "Thu, 01 Oct 2026 03:31:49 GMT" },
      });
    },
  });
  const result = await service.getData();
  assert.equal(result.referenceData.status, "fresh");
});

test("an environment override cannot bypass reliable stale publication timestamps", async () => {
  const archive = zipWith(
    "DOF.CSV",
    csv(),
    new Date("2026-10-01T03:31:49Z"),
  );
  const service = createFaaObstacleDataService({
    sourceUrl: "https://mirror.example/dof.zip",
    sourceWasOverridden: true,
    minRecords: 2,
    maxRecords: 10,
    now: () => Date.parse("2026-10-12T12:00:00Z"),
    fetchImpl: async () =>
      new Response(new Uint8Array(archive), {
        status: 200,
        headers: { "last-modified": "Thu, 01 Oct 2026 03:31:49 GMT" },
      }),
  });
  await assert.rejects(service.getData(), /older than the accepted freshness window/);
});

test("a current HTTP timestamp cannot mask a stale ZIP publication", async () => {
  const archive = zipWith(
    "DOF.CSV",
    csv(),
    new Date("2026-10-01T03:31:49Z"),
  );
  const service = createFaaObstacleDataService({
    minRecords: 2,
    maxRecords: 10,
    now: () => Date.parse("2026-10-12T12:00:00Z"),
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url === "https://aeronav.faa.gov/Obst_Data/") {
        return new Response(directoryHtml(archive.length), { status: 200 });
      }
      if (init?.method === "HEAD") {
        return new Response(null, {
          status: 200,
          headers: { "content-length": String(archive.length) },
        });
      }
      return new Response(new Uint8Array(archive), {
        status: 200,
        headers: { "last-modified": "Mon, 12 Oct 2026 03:31:49 GMT" },
      });
    },
  });
  await assert.rejects(service.getData(), /older than the accepted freshness window/);
});

test("cold-start failures enter retry cooldown instead of hammering FAA", async () => {
  let nowMs = Date.parse("2026-10-12T12:00:00Z");
  let archiveRequests = 0;
  const service = createFaaObstacleDataService({
    sourceUrl: "https://mirror.example/dof.zip",
    sourceWasOverridden: true,
    retryCooldownMs: 300_000,
    now: () => nowMs,
    fetchImpl: async () => {
      archiveRequests += 1;
      return new Response("missing", { status: 404 });
    },
  });
  await assert.rejects(service.getData(), /download failed \(404\)/);
  nowMs += 1_000;
  await assert.rejects(service.getData(), /retry cooldown/);
  assert.equal(archiveRequests, 1);
});

test("failed refresh serves verified last-known-good data and respects retry cooldown", async () => {
  const archive = zipWith();
  let nowMs = Date.parse("2026-10-12T12:00:00Z");
  let failArchive = false;
  let archiveRequests = 0;
  const service = createFaaObstacleDataService({
    minRecords: 2,
    maxRecords: 10,
    cacheTtlMs: 60_000,
    retryCooldownMs: 300_000,
    now: () => nowMs,
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url === "https://aeronav.faa.gov/Obst_Data/") {
        return new Response(directoryHtml(archive.length), { status: 200 });
      }
      if (init?.method === "HEAD") {
        return new Response(null, {
          status: 200,
          headers: { "content-length": String(archive.length) },
        });
      }
      archiveRequests += 1;
      if (failArchive) return new Response("missing", { status: 404 });
      return new Response(new Uint8Array(archive), {
        status: 200,
        headers: { "last-modified": "Mon, 12 Oct 2026 03:31:49 GMT" },
      });
    },
  });
  const first = await service.getData();
  assert.equal(first.referenceData.status, "fresh");
  nowMs += 120_000;
  failArchive = true;
  const stale = await service.getData();
  assert.equal(stale.referenceData.status, "stale");
  assert.equal(stale.referenceData.stale, true);
  assert.match(stale.referenceData.warning || "", /last-known-good/);
  const duringCooldown = await service.getData();
  assert.equal(duringCooldown.referenceData.status, "stale");
  assert.equal(archiveRequests, 2);
});

test("verified data survives restart and a subsequent FAA 406 as stale durable LKG", async () => {
  const archive = zipWith();
  const store = new MemorySnapshotStore();
  const diagnostics: Array<{ event: string }> = [];
  let nowMs = Date.parse("2026-10-12T12:00:00Z");
  const firstService = createFaaObstacleDataService({
    sourceUrl: "https://mirror.example/dof.zip",
    sourceWasOverridden: true,
    minRecords: 2,
    maxRecords: 10,
    now: () => nowMs,
    snapshotStore: store,
    snapshotDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    fetchImpl: async () =>
      new Response(new Uint8Array(archive), {
        status: 200,
        headers: { "last-modified": "Mon, 12 Oct 2026 03:31:49 GMT" },
      }),
  });
  await firstService.getData();
  assert.ok(store.snapshot);

  nowMs += 60_000;
  const restartedService = createFaaObstacleDataService({
    sourceUrl: "https://mirror.example/dof.zip",
    sourceWasOverridden: true,
    minRecords: 2,
    maxRecords: 10,
    now: () => nowMs,
    snapshotStore: store,
    snapshotDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    fetchImpl: async () => new Response("not acceptable", { status: 406 }),
  });
  const result = await restartedService.getData();
  assert.equal(result.records.length, 2);
  assert.equal(result.referenceData.status, "stale");
  assert.equal(result.referenceData.stale, true);
  assert.ok(result.referenceData.freshnessBasis.includes("durable-s3-snapshot"));
  assert.match(result.referenceData.warning || "", /last-known-good/);
  assert.ok(diagnostics.some(({ event }) => event === "faa_obstacle_snapshot_written"));
  assert.ok(diagnostics.some(({ event }) => event === "faa_obstacle_snapshot_restored"));
});

test("corrupt durable data is rejected and cannot replace an unavailable result", async () => {
  const archive = zipWith();
  const store = new MemorySnapshotStore();
  const seedService = createFaaObstacleDataService({
    sourceUrl: "https://mirror.example/dof.zip",
    sourceWasOverridden: true,
    minRecords: 2,
    maxRecords: 10,
    now: () => Date.parse("2026-10-12T12:00:00Z"),
    snapshotStore: store,
    fetchImpl: async () => new Response(new Uint8Array(archive), { status: 200 }),
  });
  await seedService.getData();
  assert.ok(store.snapshot);
  store.snapshot!.archive[0] ^= 0xff;

  const service = createFaaObstacleDataService({
    sourceUrl: "https://mirror.example/dof.zip",
    sourceWasOverridden: true,
    minRecords: 2,
    maxRecords: 10,
    now: () => Date.parse("2026-10-12T12:01:00Z"),
    snapshotStore: store,
    fetchImpl: async () => new Response("not acceptable", { status: 406 }),
  });
  await assert.rejects(service.getData(), /download failed \(406\)/);
  assert.equal(service.getDiagnostics().hasSnapshot, false);
});

test("expired durable data is rejected and cannot be represented as current", async () => {
  const archive = zipWith();
  const store = new MemorySnapshotStore();
  const fetchedAt = Date.parse("2026-10-12T12:00:00Z");
  const diagnostics: Array<{
    event: string;
    failureStage: string;
    errorCode: string;
    cacheState: string;
    snapshotAgeMs?: number;
    sourcePublicationTimestamp?: string | null;
  }> = [];
  const seedService = createFaaObstacleDataService({
    sourceUrl: "https://mirror.example/dof.zip",
    sourceWasOverridden: true,
    minRecords: 2,
    maxRecords: 10,
    now: () => fetchedAt,
    maxStaleMs: 60_000,
    snapshotStore: store,
    snapshotDiagnostic: () => undefined,
    fetchImpl: async () => new Response(new Uint8Array(archive), { status: 200 }),
  });
  await seedService.getData();

  const restarted = createFaaObstacleDataService({
    sourceUrl: "https://mirror.example/dof.zip",
    sourceWasOverridden: true,
    minRecords: 2,
    maxRecords: 10,
    now: () => fetchedAt + 120_000,
    maxStaleMs: 60_000,
    snapshotStore: store,
    snapshotDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    fetchImpl: async () => new Response("not acceptable", { status: 406 }),
  });
  await assert.rejects(restarted.getData(), /download failed \(406\)/);
  assert.equal(restarted.getDiagnostics().hasSnapshot, false);
  assert.equal(diagnostics[0].event, "faa_obstacle_snapshot_expired");
  assert.equal(diagnostics[0].failureStage, "freshness_validation");
  assert.equal(diagnostics[0].errorCode, "snapshot_expired");
  assert.equal(diagnostics[0].cacheState, "empty");
  assert.equal(diagnostics[0].snapshotAgeMs, 120_000);
  assert.match(String(diagnostics[0].sourcePublicationTimestamp), /^2026-10-12T03:31:4[89]\.000Z$/);
});

test("snapshot credential failure does not block a valid live FAA refresh", async () => {
  const archive = zipWith();
  const diagnostics: Array<{ event: string; failureStage: string; errorCode: string }> = [];
  const failingStore: FaaObstacleSnapshotStore = {
    async load() {
      throw new FaaObstacleSnapshotStoreError("manifest_read", "authorization_denied");
    },
    async save() {
      throw new FaaObstacleSnapshotStoreError("archive_write", "authorization_denied");
    },
  };
  const service = createFaaObstacleDataService({
    sourceUrl: "https://mirror.example/dof.zip",
    sourceWasOverridden: true,
    minRecords: 2,
    maxRecords: 10,
    now: () => Date.parse("2026-10-12T12:00:00Z"),
    snapshotStore: failingStore,
    snapshotDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    fetchImpl: async () => new Response(new Uint8Array(archive), { status: 200 }),
  });
  const result = await service.getData();
  assert.equal(result.referenceData.status, "fresh");
  assert.equal(result.records.length, 2);
  assert.deepEqual(diagnostics.map(({ event, failureStage, errorCode }) => ({ event, failureStage, errorCode })), [
    { event: "faa_obstacle_snapshot_authorization_denied", failureStage: "manifest_read", errorCode: "authorization_denied" },
    { event: "faa_obstacle_snapshot_authorization_denied", failureStage: "archive_write", errorCode: "authorization_denied" },
  ]);
});

test("missing snapshot manifest is an observable normal cache miss", async () => {
  const diagnostics: Array<{ event: string; cacheState: string }> = [];
  const service = createFaaObstacleDataService({
    sourceUrl: "https://mirror.example/dof.zip",
    sourceWasOverridden: true,
    snapshotStore: new MemorySnapshotStore(),
    snapshotDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    fetchImpl: async () => new Response("not acceptable", { status: 406 }),
  });
  await assert.rejects(service.getData(), /download failed \(406\)/);
  assert.deepEqual(diagnostics, [{
    event: "faa_obstacle_snapshot_manifest_not_found",
    failureStage: "manifest_read",
    errorCode: "not_found",
    cacheState: "empty",
  }]);
});

test("snapshot store classifies invalid manifests and missing archives", async () => {
  const objects = new Map<string, Buffer>();
  const fakeStorage = {
    async getObjectStream({ key }: { key: string }) {
      const body = objects.get(key);
      if (!body) {
        const error = new Error("missing") as Error & { name: string };
        error.name = "NoSuchKey";
        throw error;
      }
      return { stream: Readable.from([body]) };
    },
    async uploadBuffer() {},
    async deleteObject() {},
  };
  const store = createS3FaaObstacleSnapshotStore({
    maxArchiveBytes: 1024 * 1024,
    storage: fakeStorage as never,
  });
  objects.set("reference-data/faa-obstacles/latest.json", Buffer.from("not-json"));
  await assert.rejects(store.load(), (error: unknown) =>
    error instanceof FaaObstacleSnapshotStoreError &&
    error.failureStage === "manifest_validation" &&
    error.errorCode === "manifest_invalid");

  const archive = zipWith();
  const checksumSha256 = (await import("node:crypto")).createHash("sha256").update(archive).digest("hex");
  objects.set("reference-data/faa-obstacles/latest.json", Buffer.from(JSON.stringify({
    version: 1,
    archiveKey: `reference-data/faa-obstacles/archives/${checksumSha256}.zip`,
    checksumSha256,
    archiveBytes: archive.length,
    csvBytes: csv().length,
    recordCount: 2,
    fetchedAt: "2026-10-12T12:00:00.000Z",
    publishedAt: "2026-10-12T03:31:49.000Z",
    provenance: "official-default",
    sourceHost: "aeronav.faa.gov",
    sourcePath: "/Obst_Data/DAILY_DOF_CSV.ZIP",
    freshnessBasis: ["zip-entry-time"],
  })));
  await assert.rejects(store.load(), (error: unknown) =>
    error instanceof FaaObstacleSnapshotStoreError &&
    error.failureStage === "archive_read" &&
    error.errorCode === "archive_not_found");
});

test("default snapshot diagnostics are emitted as one sanitized JSON line", () => {
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    logFaaObstacleSnapshotDiagnostic({
      event: "faa_obstacle_snapshot_authorization_denied",
      failureStage: "manifest_read",
      errorCode: "authorization_denied",
      cacheState: "empty",
    });
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 1);
  assert.equal(typeof calls[0][0], "string");
  assert.deepEqual(JSON.parse(String(calls[0][0])), {
    event: "faa_obstacle_snapshot_authorization_denied",
    failureStage: "manifest_read",
    errorCode: "authorization_denied",
    cacheState: "empty",
  });
});

test("S3 durable replacement writes the verified archive before the manifest pointer", async () => {
  const objects = new Map<string, Buffer>();
  const writes: string[] = [];
  const fakeStorage = {
    async getObjectStream({ key }: { key: string }) {
      const body = objects.get(key);
      if (!body) {
        const error = new Error("missing") as Error & { name: string };
        error.name = "NoSuchKey";
        throw error;
      }
      return { stream: Readable.from([body]) };
    },
    async uploadBuffer({ key, buffer }: { key: string; buffer: Buffer }) {
      writes.push(key);
      objects.set(key, Buffer.from(buffer));
    },
    async deleteObject(key: string) {
      objects.delete(key);
    },
  };
  const store = createS3FaaObstacleSnapshotStore({
    maxArchiveBytes: 1024 * 1024,
    storage: fakeStorage as never,
  });
  const archive = zipWith();
  const checksumSha256 = (await import("node:crypto"))
    .createHash("sha256")
    .update(archive)
    .digest("hex");
  await store.save({
    archive,
    manifest: {
      version: 1,
      archiveKey: "reference-data/faa-obstacles/archives/pending.zip",
      checksumSha256,
      archiveBytes: archive.length,
      csvBytes: csv().length,
      recordCount: 2,
      fetchedAt: "2026-10-12T12:00:00.000Z",
      publishedAt: "2026-10-12T03:31:49.000Z",
      provenance: "official-default",
      sourceHost: "aeronav.faa.gov",
      sourcePath: "/Obst_Data/DAILY_DOF_CSV.ZIP",
      freshnessBasis: ["zip-entry-time"],
    },
  });
  assert.match(writes[0], /\/archives\/[a-f0-9]{64}\.zip$/);
  assert.equal(writes[1], "reference-data/faa-obstacles/latest.json");
  const restored = await store.load();
  assert.deepEqual(restored?.archive, archive);
  assert.equal(restored?.manifest.recordCount, 2);
});

test("concurrent refreshes are deduplicated", async () => {
  const archive = zipWith();
  let archiveRequests = 0;
  const service = createFaaObstacleDataService({
    sourceUrl: "https://mirror.example/dof.zip",
    sourceWasOverridden: true,
    minRecords: 2,
    maxRecords: 10,
    now: () => Date.parse("2026-10-12T12:00:00Z"),
    fetchImpl: async () => {
      archiveRequests += 1;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return new Response(new Uint8Array(archive), { status: 200 });
    },
  });
  const [first, second] = await Promise.all([
    service.getData(),
    service.getData(),
  ]);
  assert.equal(first.records.length, 2);
  assert.equal(second.records.length, 2);
  assert.equal(archiveRequests, 1);
});

test("cyclical DAT archives remain unsupported", async () => {
  const archive = zipWith("DOF.DAT", Buffer.from("fixed format data"));
  const service = createFaaObstacleDataService({
    sourceUrl: "https://mirror.example/cycle.zip",
    sourceWasOverridden: true,
    minRecords: 1,
    fetchImpl: async () =>
      new Response(new Uint8Array(archive), { status: 200 }),
  });
  await assert.rejects(service.getData(), /did not contain DOF\.CSV/);
});
