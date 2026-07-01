import test from "node:test";
import assert from "node:assert/strict";
import { buildZzzzSupplementalRemarks, compareRetrievedProviderPlanFields } from "../../server/services/flight-plan-filing/provider";

test("Field 18 and supplemental remarks stay separated in retrieve comparison", () => {
  const comparison = compareRetrievedProviderPlanFields({
    submittedFields: {
      otherInfo: "PBN/A1 RMK/FIELD 18 TEST",
      suppRemarksExtended: "SUPPLEMENTAL TEST",
    },
    retrievedProviderPlan: {
      otherInfo: "PBN/A1 RMK/FIELD 18 TEST",
      suppRemarksExtended: "SUPPLEMENTAL TEST",
    },
  });

  assert.equal(comparison.mismatchedFields.length, 0);
  assert.ok(comparison.matchedFields.some((entry) => entry.field === "otherInfo"));
  assert.ok(comparison.matchedFields.some((entry) => entry.field === "suppRemarksExtended"));
});

test("ZZZZ supplemental remarks do not append private field names when not needed", () => {
  const supplemental = buildZzzzSupplementalRemarks("SUPPLEMENTAL TEST", {
    departureName: "Private Strip",
    destinationName: null,
    alternateName: null,
  });

  assert.equal(supplemental, "SUPPLEMENTAL TEST");
});
