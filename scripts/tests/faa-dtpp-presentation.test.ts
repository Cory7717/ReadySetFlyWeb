import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("plate API preserves the plates array and adds cycle provenance", () => {
  const source = fs.readFileSync(path.join(root, "server/routes.ts"), "utf8");
  assert.match(source, /plates: result\.plates/);
  assert.match(source, /cycle: result\.referenceData\.cycle/);
  assert.match(source, /referenceData: result\.referenceData/);
  assert.match(source, /referenceData: \{ status: "unavailable", stale: true \}/);
});

test("web distinguishes unavailable and stale FAA plates from zero results", () => {
  const source = fs.readFileSync(path.join(root, "client/src/pages/approach-plates.tsx"), "utf8");
  assert.match(source, /FAA cycle \{data\.referenceData\.cycle\}/);
  assert.match(source, /FAA plate data is currently unavailable\. No zero-result determination was made\./);
  assert.match(source, /Verify chart currency before operational use\./);
});

test("mobile distinguishes unavailable and stale FAA plates from zero results", () => {
  const source = fs.readFileSync(path.join(root, "mobile/src/screens/ApproachPlatesScreen.tsx"), "utf8");
  assert.match(source, /setReferenceData\(res\.data\?\.referenceData \|\| null\)/);
  assert.match(source, /FAA plate data is unavailable\. This is not a confirmed zero-plate result\./);
  assert.match(source, /Verify chart currency before operational use\./);
});

test("d-TPP recovery does not touch active-flight, GPS, terrain, or filing modules", () => {
  const changed = fs.readFileSync(path.join(root, "server/services/faaDtppCycle.ts"), "utf8");
  assert.doesNotMatch(changed, /activeFlight|GPS|terrain|Leidos|SWIM|NOTAM/i);
});
