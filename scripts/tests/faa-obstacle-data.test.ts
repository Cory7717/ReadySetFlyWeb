import assert from "node:assert/strict";
import test from "node:test";
import AdmZip from "adm-zip";
import {
  DEFAULT_FAA_DDOF_CACHE_TTL_MS,
  MAX_FAA_DDOF_CACHE_TTL_MS,
  MIN_FAA_DDOF_CACHE_TTL_MS,
  OFFICIAL_FAA_DDOF_URL,
  buildFaaObstacleDownloadUrl,
  createFaaObstacleDataService,
  parseFaaObstacleCsvBuffer,
  resolveFaaObstacleCacheTtlMs,
  resolveFaaObstacleSource,
} from "../../server/services/faaObstacleData";

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
  entryTime?: Date,
) {
  const zip = new AdmZip();
  zip.addFile(entryName, csvBuffer);
  const entry = zip.getEntry(entryName);
  if (entry && entryTime) entry.header.time = entryTime;
  return zip.toBuffer();
}

function directoryHtml(size: number) {
  return `10/12/2026  3:31 AM ${size} <A HREF="/Obst_Data/DAILY_DOF_CSV.ZIP">DAILY_DOF_CSV.ZIP</A>`;
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

test("cache busting applies only to the built-in official FAA endpoint", () => {
  const defaultUrl = buildFaaObstacleDownloadUrl({
    sourceUrl: OFFICIAL_FAA_DDOF_URL,
    sourceWasOverridden: false,
    nowMs: 1_800_000,
    cacheTtlMs: 900_000,
  });
  assert.equal(new URL(defaultUrl).searchParams.get("rsf_refresh"), "2");
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
      if (url.includes("rsf_manifest")) {
        return new Response(directoryHtml(archive.length), { status: 200 });
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
  const archiveRequest = requests.find(({ url }) => url.includes("rsf_refresh="));
  assert.ok(archiveRequest);
  assert.equal(archiveRequest.headers.get("accept-encoding"), "identity");
  assert.equal(archiveRequest.headers.get("cache-control"), null);
});

test("directory size mismatch rejects an upstream stale copy", async () => {
  const archive = zipWith();
  const service = createFaaObstacleDataService({
    minRecords: 2,
    maxRecords: 10,
    now: () => Date.parse("2026-10-12T12:00:00Z"),
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes("rsf_manifest")) {
        return new Response(directoryHtml(archive.length + 1), { status: 200 });
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

test("official publication timestamp must be current enough", async () => {
  const archive = zipWith();
  const service = createFaaObstacleDataService({
    minRecords: 2,
    maxRecords: 10,
    now: () => Date.parse("2026-10-12T12:00:00Z"),
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes("rsf_manifest")) {
        return new Response(directoryHtml(archive.length), { status: 200 });
      }
      return new Response(new Uint8Array(archive), {
        status: 200,
        headers: { "last-modified": "Thu, 01 Oct 2026 03:31:49 GMT" },
      });
    },
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
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes("rsf_manifest")) {
        return new Response(directoryHtml(archive.length), { status: 200 });
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
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes("rsf_manifest")) {
        return new Response(directoryHtml(archive.length), { status: 200 });
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
