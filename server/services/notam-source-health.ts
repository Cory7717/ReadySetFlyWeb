import { db } from "../db";
import { notamSourceHealth } from "@shared/schema";

export type NotamSource = "swim" | "nms_api";

export type NotamHealthPatch = {
  workerState?: string;
  connectionState?: string;
  consumerState?: string;
  lastHeartbeatAt?: Date;
  lastAttemptAt?: Date;
  lastSuccessAt?: Date;
  lastSourceUpdateAt?: Date;
  lastMessageReceivedAt?: Date;
  lastPersistedAt?: Date;
  lastFailureAt?: Date;
  lastFailureCode?: string;
  lastResult?: string;
  coverage?: unknown;
};

function safeFailureCode(value: unknown) {
  const raw = String(value || "UNKNOWN").toUpperCase();
  return raw.replace(/[^A-Z0-9_.:-]/g, "_").slice(0, 80) || "UNKNOWN";
}

export async function updateNotamSourceHealth(source: NotamSource, patch: NotamHealthPatch) {
  const now = new Date();
  const values: Record<string, unknown> = { source, updatedAt: now };
  const updates: Record<string, unknown> = { updatedAt: now };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const safeValue = key === "lastFailureCode" ? safeFailureCode(value) : value;
    values[key] = safeValue;
    updates[key] = safeValue;
  }
  await db
    .insert(notamSourceHealth)
    .values(values as any)
    .onConflictDoUpdate({ target: notamSourceHealth.source, set: updates as any });
}

export type NotamSourceHealthRow = typeof notamSourceHealth.$inferSelect;
export type PublicNotamSourceHealth = {
  source: string;
  status: "healthy" | "degraded" | "stale" | "disconnected" | "unknown";
  workerState: string | null;
  connectionState: string | null;
  consumerState: string | null;
  lastHeartbeatAt: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastSourceUpdateAt: string | null;
  lastMessageReceivedAt: string | null;
  lastPersistedAt: string | null;
  lastFailureAt: string | null;
  lastFailureCode: string | null;
  lastResult: string | null;
  coverage: unknown;
};

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function deriveNotamSourceHealth(
  source: NotamSource,
  row: NotamSourceHealthRow | undefined,
  nowMs = Date.now(),
  heartbeatMaxAgeMs = 5 * 60 * 1000,
  nmsSuccessMaxAgeMs = 60 * 60 * 1000,
): PublicNotamSourceHealth {
  if (!row) {
    return {
      source,
      status: "unknown",
      workerState: null,
      connectionState: null,
      consumerState: null,
      lastHeartbeatAt: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastSourceUpdateAt: null,
      lastMessageReceivedAt: null,
      lastPersistedAt: null,
      lastFailureAt: null,
      lastFailureCode: null,
      lastResult: null,
      coverage: null,
    };
  }

  const heartbeatMs = row.lastHeartbeatAt ? new Date(row.lastHeartbeatAt).getTime() : 0;
  const heartbeatFresh = heartbeatMs > 0 && nowMs - heartbeatMs <= heartbeatMaxAgeMs;
  const connectionDown = source === "swim" && row.connectionState !== "connected";
  const consumerDown = source === "swim" && row.consumerState !== "up";
  const successMs = row.lastSuccessAt ? new Date(row.lastSuccessAt).getTime() : 0;
  const recentFailure = Boolean(
    row.lastFailureAt && (!row.lastSuccessAt || new Date(row.lastFailureAt).getTime() > successMs),
  );

  let status: PublicNotamSourceHealth["status"];
  if (!heartbeatFresh) status = heartbeatMs ? "stale" : "unknown";
  else if (connectionDown || consumerDown) status = "disconnected";
  else if (recentFailure) status = "degraded";
  else if (source === "nms_api" && (!successMs || nowMs - successMs > nmsSuccessMaxAgeMs)) status = "stale";
  else status = "healthy";

  return {
    source,
    status,
    workerState: row.workerState ?? null,
    connectionState: row.connectionState ?? null,
    consumerState: row.consumerState ?? null,
    lastHeartbeatAt: iso(row.lastHeartbeatAt),
    lastAttemptAt: iso(row.lastAttemptAt),
    lastSuccessAt: iso(row.lastSuccessAt),
    lastSourceUpdateAt: iso(row.lastSourceUpdateAt),
    lastMessageReceivedAt: iso(row.lastMessageReceivedAt),
    lastPersistedAt: iso(row.lastPersistedAt),
    lastFailureAt: iso(row.lastFailureAt),
    lastFailureCode: row.lastFailureCode ?? null,
    lastResult: row.lastResult ?? null,
    coverage: row.coverage ?? null,
  };
}
