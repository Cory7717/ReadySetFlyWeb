import { createHash } from "node:crypto";
import type { Readable } from "node:stream";
import { S3StorageService } from "../s3Storage";

export type FaaObstacleSnapshotManifest = {
  version: 1;
  archiveKey: string;
  checksumSha256: string;
  archiveBytes: number;
  csvBytes: number;
  recordCount: number;
  fetchedAt: string;
  publishedAt: string | null;
  provenance: "official-default" | "environment-override";
  sourceHost: string;
  sourcePath: string;
  freshnessBasis: string[];
};

export type FaaObstacleDurableSnapshot = {
  archive: Buffer;
  manifest: FaaObstacleSnapshotManifest;
};

export interface FaaObstacleSnapshotStore {
  load(): Promise<FaaObstacleDurableSnapshot | null>;
  save(snapshot: FaaObstacleDurableSnapshot): Promise<void>;
}

const MANIFEST_KEY = "reference-data/faa-obstacles/latest.json";
const ARCHIVE_PREFIX = "reference-data/faa-obstacles/archives";
const MAX_MANIFEST_BYTES = 32 * 1024;

async function readBoundedStream(
  stream: Readable,
  maxBytes: number,
  timeoutMs: number,
) {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  const timer = setTimeout(() => stream.destroy(new Error("S3 obstacle snapshot read timed out")), timeoutMs);
  try {
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > maxBytes) {
        stream.destroy();
        throw new Error("S3 obstacle snapshot exceeded its safe size limit");
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks, totalBytes);
  } finally {
    clearTimeout(timer);
  }
}

function isNotFound(error: unknown) {
  const value = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  return value?.name === "NoSuchKey" || value?.Code === "NoSuchKey" || value?.$metadata?.httpStatusCode === 404;
}

function parseManifest(buffer: Buffer): FaaObstacleSnapshotManifest {
  const parsed = JSON.parse(buffer.toString("utf8")) as Partial<FaaObstacleSnapshotManifest>;
  if (
    parsed.version !== 1 ||
    typeof parsed.archiveKey !== "string" ||
    !parsed.archiveKey.startsWith(`${ARCHIVE_PREFIX}/`) ||
    !/^[a-f0-9]{64}$/.test(String(parsed.checksumSha256 || "")) ||
    !Number.isFinite(parsed.archiveBytes) ||
    !Number.isFinite(parsed.csvBytes) ||
    !Number.isFinite(parsed.recordCount) ||
    typeof parsed.fetchedAt !== "string" ||
    (parsed.publishedAt !== null && typeof parsed.publishedAt !== "string") ||
    (parsed.provenance !== "official-default" &&
      parsed.provenance !== "environment-override") ||
    typeof parsed.sourceHost !== "string" ||
    typeof parsed.sourcePath !== "string" ||
    !Array.isArray(parsed.freshnessBasis)
  ) {
    throw new Error("S3 obstacle snapshot manifest is invalid");
  }
  return parsed as FaaObstacleSnapshotManifest;
}

export function createS3FaaObstacleSnapshotStore(options: {
  maxArchiveBytes: number;
  timeoutMs?: number;
  storage?: S3StorageService;
}): FaaObstacleSnapshotStore {
  const storage = options.storage || new S3StorageService();
  const timeoutMs = options.timeoutMs ?? 30_000;

  const loadManifest = async () => {
    try {
      const object = await storage.getObjectStream({ key: MANIFEST_KEY });
      return parseManifest(await readBoundedStream(object.stream, MAX_MANIFEST_BYTES, timeoutMs));
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  };

  return {
    async load() {
      const manifest = await loadManifest();
      if (!manifest) return null;
      if (manifest.archiveBytes <= 0 || manifest.archiveBytes > options.maxArchiveBytes) {
        throw new Error("S3 obstacle snapshot manifest archive size is outside the safe range");
      }
      const object = await storage.getObjectStream({ key: manifest.archiveKey });
      const archive = await readBoundedStream(object.stream, options.maxArchiveBytes, timeoutMs);
      if (archive.length !== manifest.archiveBytes) {
        throw new Error("S3 obstacle snapshot size does not match its manifest");
      }
      const checksum = createHash("sha256").update(archive).digest("hex");
      if (checksum !== manifest.checksumSha256) {
        throw new Error("S3 obstacle snapshot checksum does not match its manifest");
      }
      return { archive, manifest };
    },

    async save(snapshot) {
      const checksum = createHash("sha256").update(snapshot.archive).digest("hex");
      if (checksum !== snapshot.manifest.checksumSha256) {
        throw new Error("Refusing to save an obstacle snapshot with an invalid checksum");
      }
      const archiveKey = `${ARCHIVE_PREFIX}/${checksum}.zip`;
      const previous = await loadManifest().catch(() => null);
      await storage.uploadBuffer({
        key: archiveKey,
        buffer: snapshot.archive,
        contentType: "application/zip",
      });
      const manifest: FaaObstacleSnapshotManifest = {
        ...snapshot.manifest,
        archiveKey,
      };
      await storage.uploadBuffer({
        key: MANIFEST_KEY,
        buffer: Buffer.from(JSON.stringify(manifest)),
        contentType: "application/json",
      });
      if (previous?.archiveKey && previous.archiveKey !== archiveKey) {
        await storage.deleteObject(previous.archiveKey).catch(() => undefined);
      }
    },
  };
}
