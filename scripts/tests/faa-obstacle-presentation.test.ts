import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("web never reports a confirmed zero-obstacle result after an upstream error", () => {
  const source = fs.readFileSync(
    path.join(root, "client/src/pages/adsb-live.tsx"),
    "utf8",
  );
  assert.match(
    source,
    /FAA obstacle data is unavailable; no zero-obstacle conclusion has been made\./,
  );
  assert.match(source, /verified last-known-good FAA data/);
});

test("mobile visibly labels stale obstacle reference data", () => {
  const source = fs.readFileSync(
    path.join(root, "mobile/src/components/flight-deck/FlightDeckView.tsx"),
    "utf8",
  );
  assert.match(source, /obstacleScan\?\.stale/);
  assert.match(source, /verified last-known-good obstacle data/);
  assert.match(source, /Stale obstacle reference/);
  assert.match(source, /Obstacle reference unavailable/);
  assert.match(source, /No zero-obstacle or clearance conclusion has been made/);
  assert.match(source, /STALE ·/);
});

test("obstacle recovery does not change active-flight or navigation ownership", () => {
  const source = fs.readFileSync(
    path.join(root, "mobile/src/screens/FlightPlannerScreen.tsx"),
    "utf8",
  );
  assert.match(source, /api\s*\.get<NearbyObstacleResponse>\('\/api\/aviation\/obstacles\/nearby'/);
  assert.match(source, /setObstacleScan\(res\.data \|\| null\)/);
  assert.match(source, /dataStatus: 'unavailable'/);
  assert.match(source, /deriveFlightDataState/);
  assert.match(
    source,
    /highestObstacleHeightFt = obstacleScan\?\.highestObstacle\?\.amslFt \?\? null/,
  );
  assert.doesNotMatch(
    source,
    /highestObstacleHeightFt = obstacleScan\?\.highestObstacle\?\.amslFt \?\? obstacleScan\?\.highestObstacle\?\.aglFt/,
  );
});

test("nearby obstacle response retains legacy fields and adds status metadata", () => {
  const source = fs.readFileSync(path.join(root, "server/routes.ts"), "utf8");
  assert.match(source, /source: "FAA Daily DOF"/);
  assert.match(source, /radiusNm/);
  assert.match(source, /count: nearby\.length/);
  assert.match(source, /highestObstacle/);
  assert.match(source, /obstacles: nearby/);
  assert.match(source, /dataStatus: obstacleData\.referenceData\.status/);
  assert.match(source, /referenceData: obstacleData\.referenceData/);
  assert.match(source, /missingMslElevationCount/);
  assert.match(source, /clearanceStatus/);
  assert.match(source, /queryNearbyFaaObstacles/);
  assert.match(source, /snapshotStore: faaObstacleSnapshotConfigurationReady/);
  assert.match(source, /process\.env\.AWS_ACCESS_KEY_ID/);
  assert.match(source, /process\.env\.AWS_SECRET_ACCESS_KEY/);
});
