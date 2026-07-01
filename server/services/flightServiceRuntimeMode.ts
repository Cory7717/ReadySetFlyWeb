export type FlightServiceRuntimeEnvironment = "LAB" | "TEST" | "VALIDATION" | "PRODUCTION";

export type FlightServiceRuntimeMode = {
  environment: FlightServiceRuntimeEnvironment;
  operationalFilingEnabled: boolean;
  providerTestModeEnabled: boolean;
  acknowledgementRequired: boolean;
  isOperational: boolean;
};

const boolEnv = (value?: string | null) => /^(true|1|yes|on)$/i.test(String(value || "").trim());

export const normalizeFlightServiceEnvironment = (value?: string | null): FlightServiceRuntimeEnvironment => {
  const environment = String(value || "LAB").trim().toUpperCase();
  return ["LAB", "TEST", "VALIDATION", "PRODUCTION"].includes(environment)
    ? environment as FlightServiceRuntimeEnvironment
    : "LAB";
};

export const getFlightServiceRuntimeMode = (env: NodeJS.ProcessEnv = process.env): FlightServiceRuntimeMode => {
  const environment = normalizeFlightServiceEnvironment(env.FLIGHT_SERVICE_ENVIRONMENT || env.LEIDOS_FLIGHT_SERVICE_ENV || "LAB");
  const operationalFilingEnabled = environment === "PRODUCTION" && boolEnv(env.FLIGHT_FILING_OPERATIONAL_ENABLED);
  return {
    environment,
    operationalFilingEnabled,
    providerTestModeEnabled: environment !== "PRODUCTION",
    acknowledgementRequired: !operationalFilingEnabled,
    isOperational: operationalFilingEnabled,
  };
};

export const hasFlightServiceTestAcknowledgement = (
  body: unknown,
  environment: FlightServiceRuntimeEnvironment | string,
  nowMs = Date.now(),
) => {
  const record = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const acknowledgement = record.testAcknowledgement && typeof record.testAcknowledgement === "object" && !Array.isArray(record.testAcknowledgement)
    ? record.testAcknowledgement as Record<string, unknown>
    : null;
  if (!acknowledgement || acknowledgement.accepted !== true) return false;
  const acknowledgedEnvironment = String(acknowledgement.environment || "").trim().toUpperCase();
  if (acknowledgedEnvironment && acknowledgedEnvironment !== String(environment).trim().toUpperCase()) return false;
  const acknowledgedAt = Date.parse(String(acknowledgement.acknowledgedAt || ""));
  if (!Number.isFinite(acknowledgedAt)) return false;
  return nowMs - acknowledgedAt <= 24 * 60 * 60 * 1000;
};
