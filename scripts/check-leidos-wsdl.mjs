import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const WSDL_TARGETS = [
  {
    environment: "LAB",
    url: "https://ffspelabs.leidos.com/Website2/resources/doc/WebService.xml",
  },
  {
    environment: "PRODUCTION",
    url: "https://www.1800wxbrief.com/Website/resources/doc/WebService.xml",
  },
];

const expectedSha256 = (process.env.LEIDOS_WSDL_EXPECTED_SHA256 || "").trim().toLowerCase();
const outputDir = process.env.LEIDOS_WSDL_EVIDENCE_DIR || "certification-results/leidos-wsdl";

async function fetchWsdl(target) {
  const startedAt = new Date().toISOString();
  const response = await fetch(target.url, { method: "GET" });
  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return {
    environment: target.environment,
    url: target.url,
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get("content-type"),
    bytes: bytes.length,
    sha256,
    expectedSha256: expectedSha256 || null,
    driftDetected: Boolean(expectedSha256 && sha256 !== expectedSha256),
    retrievedAt: startedAt,
  };
}

const results = [];
for (const target of WSDL_TARGETS) {
  results.push(await fetchWsdl(target));
}

const lab = results.find((result) => result.environment === "LAB");
const production = results.find((result) => result.environment === "PRODUCTION");
const crossEnvironmentDrift = Boolean(lab && production && lab.sha256 !== production.sha256);
const report = {
  generatedAt: new Date().toISOString(),
  source: "Leidos public WSDL documentation endpoints",
  crossEnvironmentDrift,
  results,
};

await mkdir(outputDir, { recursive: true });
const reportPath = join(outputDir, `leidos-wsdl-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
await writeFile(reportPath, JSON.stringify(report, null, 2));

for (const result of results) {
  console.log(`${result.environment} WSDL ${result.status} ${result.bytes} bytes sha256=${result.sha256}`);
}
console.log(`WSDL evidence written to ${reportPath}`);

if (results.some((result) => !result.ok)) {
  console.error("One or more Leidos WSDL endpoints did not return HTTP success.");
  process.exit(1);
}

if (crossEnvironmentDrift) {
  console.error("Leidos LAB and production WSDL checksums differ.");
  process.exit(1);
}

if (results.some((result) => result.driftDetected)) {
  console.error("Leidos WSDL checksum drift detected against LEIDOS_WSDL_EXPECTED_SHA256.");
  process.exit(1);
}
