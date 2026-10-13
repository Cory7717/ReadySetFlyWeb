import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const routeSource = readFileSync("server/routes/aiTools.ts", "utf8");
const adminSource = readFileSync("client/src/pages/admin.tsx", "utf8");

test("AI credit reset is authenticated, administrator-only, and self-scoped", () => {
  assert.match(
    routeSource,
    /aiToolsRouter\.delete\("\/usage\/me", isAuthenticated, isAdmin/,
  );
  assert.match(routeSource, /const userId = extractUserId\(req\.user\)/);
  assert.match(routeSource, /\.where\(eq\(aiToolUsages\.userId, userId\)\)/);
  assert.doesNotMatch(routeSource, /aiToolsRouter\.delete\("\/usage\/:userId"/);
});

test("AI credit reset reports the restored allowance without changing the configured limit", () => {
  assert.match(routeSource, /remainingUses: AI_FREE_USE_LIMIT/);
  assert.match(adminSource, /apiRequest\("DELETE", "\/api\/ai-tools\/usage\/me"\)/);
  assert.match(adminSource, /Reset my AI credits/);
});
