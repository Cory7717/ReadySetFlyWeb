import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverSource = () => readFileSync("server/routes/schedule.ts", "utf8");
const clientSource = () => readFileSync("client/src/pages/schedule.tsx", "utf8");

test("actualized OTB import accepts common actual room revenue headers", () => {
  const source = serverSource();
  assert.match(source, /function reportValue/);
  assert.match(source, /normalizedReportHeader/);
  assert.match(source, /"Actual Room Revenue"/);
  assert.match(source, /"Room Revenue"/);
  assert.match(source, /"Rm Rev \(\$?\)"/);
  assert.match(source, /actualRoomRevenue:\s*reportNumber/);
});

test("schedule labor metrics use actual revenue when actualized data exists", () => {
  const source = serverSource();
  assert.match(source, /hasActualRoomRevenue/);
  assert.match(source, /effectiveRoomRevenue = hasActualRoomRevenue/);
  assert.match(source, /weeklyRoomRevenue = Number\(\(laborMetrics\.weekly as any\)\.effectiveRoomRevenue/);
  assert.match(source, /roomRevenueSource:\s*hasActualRoomRevenue \? "actual" : "forecast"/);
});

test("schedule UI labels actual room revenue distinctly from forecast revenue", () => {
  const source = clientSource();
  assert.match(source, /Actual room revenue/);
  assert.match(source, /Forecast was \$\{payload\.totals\.laborMetrics\.weekly\.roomRevenue/);
  assert.match(source, /effectiveRoomRevenue \?\? payload\.totals\.laborMetrics\.weekly\.roomRevenue/);
  assert.match(source, /Labor % \{payload\.totals\.laborMetrics\?\.weekly\.roomRevenueSource === "actual" \? "actual" : "forecast"\} room rev/);
});

