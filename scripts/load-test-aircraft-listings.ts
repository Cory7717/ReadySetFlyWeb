type LoadTestResult = {
  ok: boolean;
  status: number;
  durationMs: number;
  id?: string;
  error?: string;
  replay?: boolean;
};

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const SESSION_COOKIE = process.env.SESSION_COOKIE || "";
const CONCURRENCY = Number(process.env.CONCURRENCY || 25);
const REQUESTS = Number(process.env.REQUESTS || CONCURRENCY);
const DELETE_AFTER = String(process.env.DELETE_AFTER || "false").toLowerCase() === "true";

if (!SESSION_COOKIE) {
  console.error("SESSION_COOKIE is required.");
  process.exit(1);
}

function buildPayload(index: number) {
  const token = `${Date.now()}-${index}-${crypto.randomUUID().slice(0, 8)}`;
  const registration = `N${String(10000 + index)}${token.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase()}`;

  return {
    submissionKey: `load-test-${token}`,
    make: "Cessna",
    model: "172S LOAD TEST",
    year: 2019,
    registration,
    category: "Single-Engine",
    totalTime: 2450,
    engine: "Lycoming IO-360-L2A",
    avionicsSuite: "Garmin G1000 NXi",
    hourlyRate: "189.00",
    location: "Austin, TX",
    airportCode: "KAUS",
    description: `Load test listing ${token} to verify burst readiness for rental listing creation.`,
    insuranceIncluded: true,
    wetRate: true,
    minFlightHours: 100,
    serialNumber: `LOAD-${token}`,
    annualInspectionDate: "2026-03-01",
    annualSignerName: "Load Test IA",
    annualSignerCertNumber: "LT123456",
    requires100Hour: false,
    requiredCertifications: ["PPL"],
    images: [],
  };
}

async function createListing(index: number): Promise<LoadTestResult> {
  const payload = buildPayload(index);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${BASE_URL}/api/aircraft`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: SESSION_COOKIE,
      },
      body: JSON.stringify(payload),
    });

    const durationMs = Date.now() - startedAt;
    const text = await response.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      durationMs,
      id: parsed?.id,
      replay: Boolean(parsed?.idempotentReplay),
      error: response.ok ? undefined : parsed?.error || text || `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function deleteListing(id: string) {
  await fetch(`${BASE_URL}/api/aircraft/${id}`, {
    method: "DELETE",
    headers: {
      Cookie: SESSION_COOKIE,
    },
  });
}

function percentile(values: number[], pct: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((pct / 100) * sorted.length) - 1);
  return sorted[index];
}

async function run() {
  const queue = Array.from({ length: REQUESTS }, (_, index) => index);
  const createdIds: string[] = [];
  const results: LoadTestResult[] = [];

  const worker = async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (next === undefined) return;
      const result = await createListing(next);
      results.push(result);
      if (result.id && result.ok) {
        createdIds.push(result.id);
      }
    }
  };

  const startedAt = Date.now();
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker()));
  const totalDurationMs = Date.now() - startedAt;

  if (DELETE_AFTER) {
    for (const id of createdIds) {
      await deleteListing(id);
    }
  }

  const durations = results.map((entry) => entry.durationMs);
  const successCount = results.filter((entry) => entry.ok).length;
  const failureCount = results.length - successCount;
  const replayCount = results.filter((entry) => entry.replay).length;
  const errorGroups = new Map<string, number>();
  for (const result of results) {
    if (!result.error) continue;
    errorGroups.set(result.error, (errorGroups.get(result.error) || 0) + 1);
  }

  console.log(JSON.stringify({
    baseUrl: BASE_URL,
    concurrency: CONCURRENCY,
    requests: REQUESTS,
    deleteAfter: DELETE_AFTER,
    totalDurationMs,
    successCount,
    failureCount,
    replayCount,
    avgDurationMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    errors: Array.from(errorGroups.entries()).map(([error, count]) => ({ error, count })),
  }, null, 2));
}

void run();
