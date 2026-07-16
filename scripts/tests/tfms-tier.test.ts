import test from "node:test";
import assert from "node:assert/strict";
import { resolveTfmsAccess, PlanTier } from "../../server/lib/tier";

const makeUser = (tier: "free" | "premium" | "pro" | "pro_plus" | "pro_core" | "core", status: "active" | "inactive" = "active") => ({
  membershipTier: tier,
  membershipStatus: status,
});

test("TFMS tier gating for alerts", () => {
  const free = resolveTfmsAccess(makeUser("free", "inactive") as any, "alerts");
  assert.equal(free.allowed, false);
  assert.equal(free.requiredTier, PlanTier.PREMIUM);

  const premium = resolveTfmsAccess(makeUser("premium") as any, "alerts");
  assert.equal(premium.allowed, true);
});

test("TFMS tier gating for overlay and risk", () => {
  const premiumOverlay = resolveTfmsAccess(makeUser("premium") as any, "overlay");
  assert.equal(premiumOverlay.allowed, true);

  const legacyPro = resolveTfmsAccess(makeUser("pro") as any, "overlay");
  assert.equal(legacyPro.allowed, true);

  const legacyProPlus = resolveTfmsAccess(makeUser("pro_plus") as any, "overlay");
  assert.equal(legacyProPlus.allowed, true);

  const legacyCore = resolveTfmsAccess(makeUser("core") as any, "overlay");
  assert.equal(legacyCore.allowed, true);

  const risk = resolveTfmsAccess(makeUser("premium") as any, "risk");
  assert.equal(risk.allowed, true);
});
