import { eq, isNotNull, or } from "drizzle-orm";
import { db } from "../server/db";
import { flightPlans, flightServiceProviderActionAttempts } from "../shared/schema";
import {
  providerDiagnosticContainsForbiddenContent,
  sanitizeProviderDiagnosticRecordForPersistence,
} from "../server/services/flight-service-provider-diagnostics";

const apply = process.argv.includes("--apply");
const batchSizeArg = process.argv.find((arg) => arg.startsWith("--batch-size="));
const batchSize = Math.max(1, Math.min(Number(batchSizeArg?.split("=")[1] || 100), 500));

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const run = async () => {
  let scannedFlightPlans = 0;
  let affectedFlightPlans = 0;
  let updatedFlightPlans = 0;
  let scannedAttempts = 0;
  let affectedAttempts = 0;
  let updatedAttempts = 0;

  const plans = await db
    .select({
      id: flightPlans.id,
      filingRaw: flightPlans.filingRaw,
      filingActionHistory: flightPlans.filingActionHistory,
    })
    .from(flightPlans)
    .where(or(isNotNull(flightPlans.filingRaw), isNotNull(flightPlans.filingActionHistory)));

  for (let index = 0; index < plans.length; index += batchSize) {
    const batch = plans.slice(index, index + batchSize);
    for (const plan of batch) {
      scannedFlightPlans += 1;
      const sanitizedRaw = sanitizeProviderDiagnosticRecordForPersistence(plan.filingRaw);
      const sanitizedHistory = Array.isArray(plan.filingActionHistory)
        ? plan.filingActionHistory.map((entry) => sanitizeProviderDiagnosticRecordForPersistence(entry))
        : [];
      const changed = !sameJson(plan.filingRaw, sanitizedRaw) || !sameJson(plan.filingActionHistory, sanitizedHistory);
      const containsForbidden =
        providerDiagnosticContainsForbiddenContent(plan.filingRaw) ||
        providerDiagnosticContainsForbiddenContent(plan.filingActionHistory);
      if (changed || containsForbidden) affectedFlightPlans += 1;
      if (apply && changed) {
        await db
          .update(flightPlans)
          .set({
            filingRaw: Object.keys(sanitizedRaw).length ? sanitizedRaw as any : null,
            filingActionHistory: sanitizedHistory as any,
          })
          .where(eq(flightPlans.id, plan.id));
        updatedFlightPlans += 1;
      }
    }
    console.log(JSON.stringify({
      event: "flight_service_provider_diagnostic_cleanup_progress",
      kind: "flight_plans",
      scanned: scannedFlightPlans,
      affected: affectedFlightPlans,
      updated: updatedFlightPlans,
      apply,
    }));
  }

  const attempts = await db
    .select({
      id: flightServiceProviderActionAttempts.id,
      responsePlan: flightServiceProviderActionAttempts.responsePlan,
      responseBody: flightServiceProviderActionAttempts.responseBody,
      errorMessage: flightServiceProviderActionAttempts.errorMessage,
    })
    .from(flightServiceProviderActionAttempts)
    .where(or(
      isNotNull(flightServiceProviderActionAttempts.responsePlan),
      isNotNull(flightServiceProviderActionAttempts.responseBody),
      isNotNull(flightServiceProviderActionAttempts.errorMessage),
    ));

  for (let index = 0; index < attempts.length; index += batchSize) {
    const batch = attempts.slice(index, index + batchSize);
    for (const attempt of batch) {
      scannedAttempts += 1;
      const sanitizedPlan = sanitizeProviderDiagnosticRecordForPersistence(attempt.responsePlan);
      const sanitizedBody = sanitizeProviderDiagnosticRecordForPersistence(attempt.responseBody);
      const sanitizedError = String(sanitizeProviderDiagnosticRecordForPersistence({ errorMessage: attempt.errorMessage || "" }).errorMessage || "");
      const changed =
        !sameJson(attempt.responsePlan, sanitizedPlan) ||
        !sameJson(attempt.responseBody, sanitizedBody) ||
        String(attempt.errorMessage || "") !== sanitizedError;
      const containsForbidden =
        providerDiagnosticContainsForbiddenContent(attempt.responsePlan) ||
        providerDiagnosticContainsForbiddenContent(attempt.responseBody) ||
        providerDiagnosticContainsForbiddenContent(attempt.errorMessage);
      if (changed || containsForbidden) affectedAttempts += 1;
      if (apply && changed) {
        await db
          .update(flightServiceProviderActionAttempts)
          .set({
            responsePlan: Object.keys(sanitizedPlan).length ? sanitizedPlan as any : null,
            responseBody: Object.keys(sanitizedBody).length ? sanitizedBody as any : null,
            errorMessage: sanitizedError || null,
          })
          .where(eq(flightServiceProviderActionAttempts.id, attempt.id));
        updatedAttempts += 1;
      }
    }
    console.log(JSON.stringify({
      event: "flight_service_provider_diagnostic_cleanup_progress",
      kind: "provider_action_attempts",
      scanned: scannedAttempts,
      affected: affectedAttempts,
      updated: updatedAttempts,
      apply,
    }));
  }

  console.log(JSON.stringify({
    event: "flight_service_provider_diagnostic_cleanup_complete",
    dryRun: !apply,
    flightPlans: { scanned: scannedFlightPlans, affected: affectedFlightPlans, updated: updatedFlightPlans },
    providerActionAttempts: { scanned: scannedAttempts, affected: affectedAttempts, updated: updatedAttempts },
    applyCommand: "npm run flight-service:sanitize-provider-diagnostics -- --apply",
  }));
};

run()
  .catch((error) => {
    console.error(JSON.stringify({
      event: "flight_service_provider_diagnostic_cleanup_failed",
      message: error instanceof Error ? error.message : String(error),
    }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await (db as any).$client?.end?.().catch?.(() => undefined);
  });
