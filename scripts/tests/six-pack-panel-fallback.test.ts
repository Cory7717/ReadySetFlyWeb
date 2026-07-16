import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const routesSource = readFileSync("server/routes.ts", "utf8");
const trainerSource = readFileSync("client/src/pages/student/six-pack-trainer.tsx", "utf8");

test("six-pack panel endpoint falls back to public image when S3 credentials fail", () => {
  assert.match(routesSource, /app\.get\('\/api\/six-pack\/panel'/);
  assert.match(routesSource, /getSixPackPanelPublicUrl/);
  assert.match(routesSource, /isS3CredentialOrAccessError/);
  assert.match(routesSource, /InvalidAccessKeyId/);
  assert.match(routesSource, /res\.redirect\(302, publicFallbackUrl\)/);
  assert.match(routesSource, /six_pack_panel_s3_unavailable/);
});

test("six-pack panel endpoint logs sanitized S3 diagnostics only", () => {
  assert.match(routesSource, /function sanitizeS3Error/);
  assert.match(routesSource, /httpStatusCode/);
  assert.match(routesSource, /requestId/);
  assert.doesNotMatch(routesSource, /console\.error\("Error streaming six-pack panel image:", error\)/);
  assert.doesNotMatch(routesSource, /AWSAccessKeyId/);
});

test("six-pack trainer explains fallback retry instead of exposing S3 internals", () => {
  assert.match(trainerSource, /fallback image source/);
  assert.doesNotMatch(trainerSource, /Verify the S3 object is public/);
});
