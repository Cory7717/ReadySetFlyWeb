import { runCertificationReport } from "./certification-report";

const enabled = process.env.FLIGHT_SERVICE_PROVIDER_TESTS_ENABLED === "true";
const confirmed = process.env.FLIGHT_SERVICE_PROVIDER_TEST_CONFIRMATION === "I_UNDERSTAND_THIS_CALLS_PROVIDER_LAB";

if (!enabled || !confirmed) {
  console.error("Flight Service provider/lab certification is disabled.");
  console.error("Set FLIGHT_SERVICE_PROVIDER_TESTS_ENABLED=true and FLIGHT_SERVICE_PROVIDER_TEST_CONFIRMATION=I_UNDERSTAND_THIS_CALLS_PROVIDER_LAB to run provider/lab mode.");
  process.exit(1);
}

console.log("Provider/lab certification guard passed.");
console.log("This harness is provider-safe by default. Add live provider adapters only behind this guard.");

const { report } = runCertificationReport({ writeReport: false });
console.log(`Mock preflight scenarios executed before provider/lab adapter: ${report.summary.totalScenarios}`);
process.exitCode = report.summary.failed > 0 ? 1 : 0;
