import test from "node:test";
import assert from "node:assert/strict";
import { deriveNotamSourceHealth } from "../../server/services/notam-source-health";

const now = Date.parse("2026-10-12T18:00:00Z");

function row(overrides: Record<string, unknown> = {}) {
  return {
    source: "swim",
    workerState: "running",
    connectionState: "connected",
    consumerState: "up",
    lastHeartbeatAt: new Date(now - 30_000),
    lastAttemptAt: null,
    lastSuccessAt: new Date(now - 30_000),
    lastSourceUpdateAt: null,
    lastMessageReceivedAt: null,
    lastPersistedAt: null,
    lastFailureAt: null,
    lastFailureCode: null,
    lastResult: "consumer_up",
    coverage: null,
    updatedAt: new Date(now - 30_000),
    ...overrides,
  } as any;
}

test("healthy SWIM does not require recent traffic when session and consumer are up", () => {
  assert.equal(deriveNotamSourceHealth("swim", row(), now).status, "healthy");
});

test("stale heartbeat cannot be concealed by another source", () => {
  const result = deriveNotamSourceHealth("swim", row({ lastHeartbeatAt: new Date(now - 10 * 60_000) }), now);
  assert.equal(result.status, "stale");
});

test("disconnected SWIM is reported independently", () => {
  assert.equal(deriveNotamSourceHealth("swim", row({ connectionState: "disconnected" }), now).status, "disconnected");
});

test("successful empty NMS delta remains healthy", () => {
  const result = deriveNotamSourceHealth("nms_api", row({
    source: "nms_api",
    connectionState: null,
    consumerState: null,
    lastResult: "sync_success_empty_delta",
  }), now);
  assert.equal(result.status, "healthy");
});

test("missing worker row is unknown and exposes no private configuration", () => {
  const result = deriveNotamSourceHealth("swim", undefined, now);
  assert.equal(result.status, "unknown");
  assert.equal(JSON.stringify(result).includes("queue"), false);
});
