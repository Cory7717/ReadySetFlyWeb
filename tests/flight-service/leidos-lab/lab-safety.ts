import { getFlightServiceRuntimeMode } from "../../../server/services/flightServiceRuntimeMode";

export type LabSafetySnapshot = {
  ok: boolean;
  environment: "Leidos LAB" | "Unsafe";
  productionFilingDisabled: boolean;
  certificationModeEnabled: boolean;
  providerCalls: "Real LAB" | "Blocked";
  labEndpointConfirmed: boolean;
  acknowledgementCurrent: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
};

const boolEnv = (value?: string | null) => /^(true|1|yes|on)$/i.test(String(value || "").trim());

export const getLabSafetySnapshot = (env: NodeJS.ProcessEnv = process.env): LabSafetySnapshot => {
  const provider = String(env.FLIGHT_SERVICE_PROVIDER || "").trim().toLowerCase();
  const leidosEnv = String(env.LEIDOS_ENV || env.FLIGHT_SERVICE_ENVIRONMENT || env.LEIDOS_FLIGHT_SERVICE_ENV || "").trim().toLowerCase();
  const certificationEnabled = boolEnv(env.LEIDOS_LAB_CERTIFICATION_ENABLED);
  const operationalFlag =
    boolEnv(env.FLIGHT_SERVICE_OPERATIONAL_FILING_ENABLED) ||
    boolEnv(env.FLIGHT_FILING_OPERATIONAL_ENABLED);
  const liveEnabled = boolEnv(env.LEIDOS_FLIGHT_SERVICE_ENABLE_LIVE);
  const baseUrl = String(env.LEIDOS_FLIGHT_SERVICE_REST_BASE_URL || "").trim().toLowerCase();
  const labEndpointConfirmed = !baseUrl || baseUrl.includes("ffspelabs") || baseUrl.includes("lab");
  const acknowledgementAt = Date.parse(String(env.LEIDOS_LAB_ACKNOWLEDGED_AT || ""));
  const acknowledgementCurrent = Number.isFinite(acknowledgementAt) && Date.now() - acknowledgementAt <= 24 * 60 * 60 * 1000;
  const runtime = getFlightServiceRuntimeMode(env);

  const checks = [
    { name: "FLIGHT_SERVICE_PROVIDER=leidos", passed: provider === "leidos", detail: provider || "missing" },
    { name: "LEIDOS_ENV=lab", passed: leidosEnv === "lab", detail: leidosEnv || "missing" },
    { name: "LEIDOS_LAB_CERTIFICATION_ENABLED=true", passed: certificationEnabled, detail: String(certificationEnabled) },
    { name: "FLIGHT_SERVICE_OPERATIONAL_FILING_ENABLED=false", passed: !operationalFlag, detail: String(operationalFlag) },
    { name: "LEIDOS_FLIGHT_SERVICE_ENABLE_LIVE=true", passed: liveEnabled, detail: String(liveEnabled) },
    { name: "LAB endpoint confirmed", passed: labEndpointConfirmed, detail: baseUrl || "default lab endpoint" },
    { name: "LAB acknowledgement current", passed: acknowledgementCurrent, detail: env.LEIDOS_LAB_ACKNOWLEDGED_AT || "missing" },
    { name: "runtime production disabled", passed: !runtime.operationalFilingEnabled, detail: JSON.stringify(runtime) },
  ];
  const ok = checks.every((check) => check.passed);
  return {
    ok,
    environment: ok ? "Leidos LAB" : "Unsafe",
    productionFilingDisabled: !operationalFlag && !runtime.operationalFilingEnabled,
    certificationModeEnabled: certificationEnabled,
    providerCalls: ok ? "Real LAB" : "Blocked",
    labEndpointConfirmed,
    acknowledgementCurrent,
    checks,
  };
};

export const formatLabSafetyFailure = (snapshot: LabSafetySnapshot) => [
  "Leidos LAB certification is fail-closed.",
  "",
  "Required environment:",
  "  FLIGHT_SERVICE_PROVIDER=leidos",
  "  LEIDOS_ENV=lab",
  "  LEIDOS_LAB_CERTIFICATION_ENABLED=true",
  "  FLIGHT_SERVICE_OPERATIONAL_FILING_ENABLED=false",
  "  LEIDOS_FLIGHT_SERVICE_ENABLE_LIVE=true",
  "  LEIDOS_LAB_ACKNOWLEDGED_AT=<ISO timestamp within 24 hours>",
  "",
  "Failed checks:",
  ...snapshot.checks.filter((check) => !check.passed).map((check) => `  - ${check.name}: ${check.detail}`),
].join("\n");
