import test from "node:test";
import assert from "node:assert/strict";
import { createStubTfmsProvider } from "../../server/services/tfms/providers/stub";

const provider = createStubTfmsProvider();
const now = new Date("2026-01-01T00:00:00Z");

test("TFMS stub provider is deterministic for status", async () => {
  const params = { dep: "KDAL", dest: "KATL", route: "KMEI", now };
  const first = await provider.getStatus(params);
  const second = await provider.getStatus(params);
  assert.deepEqual(first, second);
});

test("TFMS stub provider is deterministic for overlay", async () => {
  const params = { bbox: "-100.00000,30.00000,-90.00000,40.00000", now };
  const first = await provider.getOverlay(params);
  const second = await provider.getOverlay(params);
  assert.deepEqual(first, second);
});
