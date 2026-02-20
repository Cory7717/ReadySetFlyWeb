import test from "node:test";
import assert from "node:assert/strict";
import { resolveTfmsAccess, PlanTier } from "../../server/lib/tier";

const makeUser = (tier: "free" | "pro" | "pro_plus", status: "active" | "inactive" = "active") => ({
  membershipTier: tier,
  membershipStatus: status,
});

test("TFMS tier gating for alerts", () => {
  const free = resolveTfmsAccess(makeUser("free", "inactive") as any, "alerts");
  assert.equal(free.allowed, false);
  assert.equal(free.requiredTier, PlanTier.PRO_CORE);

  const pro = resolveTfmsAccess(makeUser("pro") as any, "alerts");
  assert.equal(pro.allowed, true);
});

test("TFMS tier gating for overlay and risk", () => {
  const pro = resolveTfmsAccess(makeUser("pro") as any, "overlay");
  assert.equal(pro.allowed, false);
  assert.equal(pro.requiredTier, PlanTier.PRO_PLUS);

  const proPlus = resolveTfmsAccess(makeUser("pro_plus") as any, "overlay");
  assert.equal(proPlus.allowed, true);

  const risk = resolveTfmsAccess(makeUser("pro_plus") as any, "risk");
  assert.equal(risk.allowed, true);
});
