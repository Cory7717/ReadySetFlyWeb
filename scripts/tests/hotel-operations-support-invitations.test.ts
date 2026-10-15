import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const routes = readFileSync("server/routes/hotelOperationsPhase2.ts", "utf8");
const auth = readFileSync("server/routes/hotelOperations.ts", "utf8");
const migration = readFileSync("migrations/0156_add_hotel_operations_support_invitations.sql", "utf8");
const page = readFileSync("client/src/pages/hotel-operations-admin.tsx", "utf8");

test("support invitations store hashed, single-use, expiring tokens", () => {
  assert.match(migration, /token_hash varchar\(64\) NOT NULL UNIQUE/i);
  assert.match(migration, /uniq_hotel_ops_active_support_invite/i);
  assert.match(routes, /tokenHash: hashToken\(token\)/);
  assert.match(routes, /isNull\(hotelOpsSupportInvitations\.acceptedAt\)/);
  assert.match(routes, /isNull\(hotelOpsSupportInvitations\.revokedAt\)/);
  assert.match(routes, /gt\(hotelOpsSupportInvitations\.expiresAt/);
  assert.doesNotMatch(routes, /passwordHash[^\n]+sendPortalEmail/);
});

test("support-only accounts are authorized without tenant membership", () => {
  assert.match(auth, /memberships\.length === 0 && !supportAccess\[0\]/);
  assert.match(auth, /supportRole: supportAccess\[0\]\?\.supportRole/);
  assert.match(routes, /returnTo: "\/hoteloperations\/admin\/support"/);
});

test("support roles remain distinct and cannot reach owner middleware", () => {
  assert.match(routes, /support_administrator_required/);
  assert.match(routes, /supportRole === "support_administrator"/);
  assert.match(
    routes,
    /router\.get\([\s\S]*?"\/admin\/overview"[\s\S]*?requirePortalSession[\s\S]*?owner/,
  );
  assert.match(
    routes,
    /router\.patch\([\s\S]*?"\/admin\/support-settings"[\s\S]*?requirePortalSession[\s\S]*?owner/,
  );
});

test("revocation invalidates support authorization sessions", () => {
  assert.match(routes, /if \(!input\.enabled\)[\s\S]+hotelOpsSessions[\s\S]+revokedAt: new Date\(\)/);
});

test("support personnel UI invites by email and exposes both scoped roles", () => {
  assert.match(page, /Support team email/);
  assert.match(page, /Support Specialist/);
  assert.match(page, /Support Administrator/);
  assert.match(page, /Pending invitations/);
  assert.match(page, /Active support personnel/);
});
