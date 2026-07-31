import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverSource = readFileSync(
  new URL("../../server/routes/tips.ts", import.meta.url),
  "utf8",
);
const clientSource = readFileSync(
  new URL("../../client/src/pages/tips.tsx", import.meta.url),
  "utf8",
);

test("Bistro tips never infer an even split from the number of associates", () => {
  assert.doesNotMatch(serverSource, /50\/50 split/);
  assert.doesNotMatch(clientSource, /50\/50/);
  assert.doesNotMatch(serverSource, /splitCount:\s*activeCells\.length/);
});

test("grid entry saves use the associate and date conflict key", () => {
  const routeStart = serverSource.indexOf('router.post(\n    "/grid/entries"');
  const routeEnd = serverSource.indexOf('router.post(\n    "/grid/days"', routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart);

  const route = serverSource.slice(routeStart, routeEnd);
  assert.match(route, /target:\s*\[tipEntries\.userId, tipEntries\.entryDate\]/);
  assert.match(route, /payPeriodStart:\s*period\.start/);
  assert.match(route, /payPeriodEnd:\s*period\.end/);
  assert.doesNotMatch(route, /insert\(tipGridDaySummaries\)/);
});

test("browser saves are serialized and visibly acknowledged", () => {
  assert.match(clientSource, /scope:\s*\{ id: "tips-grid-entry-saves" \}/);
  assert.match(clientSource, /title: "Tips saved"/);
});
