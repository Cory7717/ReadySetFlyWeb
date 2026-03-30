import { performance } from "node:perf_hooks";

type Scenario = {
  name: string;
  method?: "GET" | "POST";
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
};

type ScenarioResult = {
  name: string;
  total: number;
  ok: number;
  failed: number;
  statuses: Record<number, number>;
  p50Ms: number;
  p95Ms: number;
  avgMs: number;
};

const BASE_URL = String(process.env.LOAD_TEST_BASE_URL || process.env.API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
const CONCURRENCY = Math.max(1, Number(process.env.LOAD_TEST_CONCURRENCY || 24));
const REQUESTS_PER_SCENARIO = Math.max(1, Number(process.env.LOAD_TEST_REQUESTS_PER_SCENARIO || 60));

const scenarios: Scenario[] = [
  { name: "airport-search-kdal", path: "/api/airports/search?q=KDAL" },
  { name: "airport-search-khou", path: "/api/airports/search?q=KHOU" },
  { name: "nearby-kdal", path: "/api/airports/nearby?lat=32.8471&lon=-96.8518&radiusNm=70&limit=4" },
  { name: "nearby-khou", path: "/api/airports/nearby?lat=29.6454&lon=-95.2789&radiusNm=70&limit=4" },
  { name: "route-kdal-khou", path: "/api/airports/route-suggestions?departure=KDAL&destination=KHOU&cruiseKtas=140" },
  { name: "freq-kdal", path: "/api/airports/KDAL/frequencies" },
  { name: "freq-khou", path: "/api/airports/KHOU/frequencies" },
  { name: "brief-kdal", path: "/api/airports/KDAL/runway-briefing" },
  { name: "brief-khou", path: "/api/airports/KHOU/runway-briefing" },
  { name: "plates-kdal", path: "/api/plates/KDAL" },
];

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index];
}

async function runScenario(scenario: Scenario): Promise<ScenarioResult> {
  let nextIndex = 0;
  const durations: number[] = [];
  const statuses = new Map<number, number>();

  const worker = async () => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= REQUESTS_PER_SCENARIO) return;

      const startedAt = performance.now();
      try {
        const response = await fetch(`${BASE_URL}${scenario.path}`, {
          method: scenario.method || "GET",
          headers: {
            "User-Agent": "ReadySetFlyLaunchReadiness/1.0",
            ...(scenario.body ? { "Content-Type": "application/json" } : {}),
            ...(scenario.headers || {}),
          },
          body: scenario.body ? JSON.stringify(scenario.body) : undefined,
        });
        const durationMs = performance.now() - startedAt;
        durations.push(durationMs);
        statuses.set(response.status, (statuses.get(response.status) || 0) + 1);
        await response.arrayBuffer().catch(() => new ArrayBuffer(0));
      } catch {
        const durationMs = performance.now() - startedAt;
        durations.push(durationMs);
        statuses.set(0, (statuses.get(0) || 0) + 1);
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const ok = Array.from(statuses.entries())
    .filter(([status]) => status >= 200 && status < 300)
    .reduce((sum, [, count]) => sum + count, 0);
  const failed = REQUESTS_PER_SCENARIO - ok;
  const avgMs = durations.length > 0 ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0;

  return {
    name: scenario.name,
    total: REQUESTS_PER_SCENARIO,
    ok,
    failed,
    statuses: Object.fromEntries(Array.from(statuses.entries()).sort((a, b) => a[0] - b[0])),
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    avgMs,
  };
}

async function main() {
  console.log(`Launch readiness load test`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Concurrency per scenario: ${CONCURRENCY}`);
  console.log(`Requests per scenario: ${REQUESTS_PER_SCENARIO}`);

  const results: ScenarioResult[] = [];
  for (const scenario of scenarios) {
    console.log(`Running ${scenario.name} ...`);
    results.push(await runScenario(scenario));
  }

  console.table(
    results.map((result) => ({
      scenario: result.name,
      total: result.total,
      ok: result.ok,
      failed: result.failed,
      avgMs: result.avgMs.toFixed(1),
      p50Ms: result.p50Ms.toFixed(1),
      p95Ms: result.p95Ms.toFixed(1),
      statuses: JSON.stringify(result.statuses),
    })),
  );
}

void main().catch((error) => {
  console.error("Launch readiness load test failed:", error);
  process.exitCode = 1;
});
