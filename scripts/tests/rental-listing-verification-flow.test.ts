import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

test("rental listing verification failures route owners to identity verification", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/list-aircraft.tsx"), "utf8");
  const verificationErrorIndex = source.indexOf('title: "Verification Required"');
  const verifyRouteIndex = source.indexOf('navigate("/verify-identity")', verificationErrorIndex);
  const profileRouteIndex = source.indexOf('navigate("/profile")', verificationErrorIndex);

  assert.ok(verificationErrorIndex >= 0, "verification-required handler should be present");
  assert.ok(verifyRouteIndex > verificationErrorIndex, "verification failures should route to /verify-identity");
  assert.equal(profileRouteIndex, -1, "verification failures should not route to /profile");
});
