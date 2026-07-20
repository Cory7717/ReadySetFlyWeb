import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  providerDiagnosticContainsForbiddenContent,
  sanitizeProviderDiagnosticRecordForPersistence,
} from "../../server/services/flight-service-provider-diagnostics";

const routesSource = readFileSync("server/routes.ts", "utf8");
const providerSource = readFileSync("server/services/flight-plan-filing/provider.ts", "utf8");
const cleanupSource = readFileSync("scripts/sanitize-flight-service-provider-diagnostics.ts", "utf8");

test("provider diagnostic sanitizer removes forbidden nested provider payload content", () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  const sanitized = sanitizeProviderDiagnosticRecordForPersistence({
    action: "file",
    httpStatus: 200,
    returnStatus: true,
    providerPlanId: "provider-1",
    versionStamp: "20260720120000000",
    responseMessages: [
      "Contact pilot@example.com or 512-555-0199",
      "Webservice.DuplicateFlight",
    ],
    response: {
      pilotPhone: "5125550199",
      phoneNumber: "5125550198",
      pilotData: "Pilot Person",
      remarks: "RMK/SENSITIVE",
      otherInfo: "PBN/A1",
      authorization: "Basic abc123",
      requestPayload: { pilotPhone: "5125550199" },
      artccInfo: { messageContent: "Raw ARTCC message body" },
      fullFlightPlanObject: { tailNumber: "N12345" },
      circular,
    },
    metadataResponse: {
      PilotPhone: "5125550197",
      OtherInfo: "DOF/260720",
    },
  });

  const serialized = JSON.stringify(sanitized);
  assert.match(serialized, /provider-1/);
  assert.match(serialized, /Webservice\.DuplicateFlight/);
  assert.doesNotMatch(serialized, /5125550199|512-555-0199|5125550198|5125550197/);
  assert.doesNotMatch(serialized, /pilot@example\.com|Pilot Person|RMK\/SENSITIVE|PBN\/A1|abc123|Raw ARTCC|N12345/);
  assert.doesNotMatch(serialized, /"response"\s*:/);
  assert.doesNotMatch(serialized, /"metadataResponse"\s*:/);
  assert.match(serialized, /responseDiagnostics/);
  assert.match(serialized, /metadataResponseDiagnostics/);
  assert.equal(providerDiagnosticContainsForbiddenContent(sanitized), false);
});

test("provider persistence boundaries use the shared sanitizer", () => {
  assert.match(providerSource, /sanitizeProviderDiagnosticRecordForPersistence/);
  assert.match(routesSource, /const sanitizedProviderRaw = sanitizeProviderDiagnosticRecordForPersistence\(providerResult\.raw\)/);
  assert.match(routesSource, /mergePreservedFilingRaw\(plan\.filingRaw, sanitizedProviderRaw\)/);
  assert.match(routesSource, /responsePlan: sanitizeProviderDiagnosticRecordForPersistence/);
  assert.match(routesSource, /responseBody: compactProviderActionResultForStorage/);
  assert.match(routesSource, /safeUpdates\.responsePlan = sanitizeProviderDiagnosticRecordForPersistence/);
  assert.match(routesSource, /safeUpdates\.responseBody = sanitizeProviderDiagnosticRecordForPersistence/);
  assert.doesNotMatch(providerSource, /raw:\s*\{[\s\S]{0,240}metadataResponse,\s*[\s\S]{0,80}response: parsedResponse/);
});

test("historical diagnostic cleanup utility is dry-run by default and apply-gated", () => {
  assert.match(cleanupSource, /const apply = process\.argv\.includes\("--apply"\)/);
  assert.match(cleanupSource, /dryRun: !apply/);
  assert.match(cleanupSource, /flight_service_provider_diagnostic_cleanup_progress/);
  assert.match(cleanupSource, /npm run flight-service:sanitize-provider-diagnostics -- --apply/);
  assert.match(cleanupSource, /sanitizeProviderDiagnosticRecordForPersistence/);
  assert.doesNotMatch(cleanupSource, /console\.log\([^)]*filingRaw/);
});
