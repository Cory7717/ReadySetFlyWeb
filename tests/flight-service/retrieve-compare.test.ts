import test from "node:test";
import assert from "node:assert/strict";
import { compareRetrievedProviderPlanFields } from "../../server/services/flight-plan-filing/provider";

test("phone and home base are flagged when missing from retrieve response", () => {
  const comparison = compareRetrievedProviderPlanFields({
    submittedFields: {
      pilotPhone: "15124121762",
      aircraftHomeBase: "KEDC",
      route: "DCT",
    },
    retrievedProviderPlan: {
      route: "DCT",
    },
  });

  assert.ok(comparison.mismatchedFields.some((entry) => entry.field === "pilotPhone" && entry.issue === "missing_from_retrieve"));
  assert.ok(comparison.mismatchedFields.some((entry) => entry.field === "aircraftHomeBase" && entry.issue === "missing_from_retrieve"));
  assert.ok(comparison.matchedFields.some((entry) => entry.field === "route"));
});

test("Field 18 and supplemental remarks are compared separately", () => {
  const comparison = compareRetrievedProviderPlanFields({
    submittedFields: {
      otherInfo: "RMK/FIELD 18 TEST",
      suppRemarksExtended: "SUPPLEMENTAL TEST",
    },
    retrievedProviderPlan: {
      otherInfo: "RMK/FIELD 18 TEST",
    },
  });

  assert.ok(comparison.matchedFields.some((entry) => entry.field === "otherInfo"));
  assert.ok(comparison.mismatchedFields.some((entry) => entry.field === "suppRemarksExtended" && entry.issue === "missing_from_retrieve"));
});

test("supplemental remarks returned under Field 18 are flagged", () => {
  const comparison = compareRetrievedProviderPlanFields({
    submittedFields: {
      otherInfo: "RMK/FIELD 18 TEST",
      suppRemarksExtended: "SUPPLEMENTAL TEST",
    },
    retrievedProviderPlan: {
      otherInfo: "RMK/FIELD 18 TEST SUPPLEMENTAL TEST",
    },
  });

  assert.ok(comparison.mismatchedFields.some((entry) => entry.issue === "supplemental_returned_in_otherInfo"));
});
