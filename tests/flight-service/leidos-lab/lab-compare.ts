import { compareRetrievedProviderPlanFields } from "../../../server/services/flight-plan-filing/provider";

export type LabDiffClassification =
  | "MATCH"
  | "WARNING"
  | "MISMATCH"
  | "PROVIDER_NORMALIZED"
  | "RSF_BUG"
  | "NEEDS_LEIDOS_CLARIFICATION";

export type LabFieldDiff = {
  field: string;
  expected: unknown;
  actual: unknown;
  classification: LabDiffClassification;
  suggestedLikelyCause: "RSF" | "Leidos" | "unclear" | "none";
  issue: string;
};

const comparable = (value: unknown) => String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");

export const compareLabRetrieve = ({
  submittedFields,
  retrievedProviderPlan,
  expectedOtherInfoIncludes = [],
}: {
  submittedFields: Record<string, unknown>;
  retrievedProviderPlan: Record<string, unknown> | null;
  expectedOtherInfoIncludes?: string[];
}) => {
  if (!retrievedProviderPlan) {
    return [{
      field: "retrieve",
      expected: "provider retrieve response",
      actual: null,
      classification: "MISMATCH" as const,
      suggestedLikelyCause: "unclear" as const,
      issue: "No retrieve response was available after provider action.",
    }];
  }
  const comparison = compareRetrievedProviderPlanFields({ submittedFields, retrievedProviderPlan });
  const diffs: LabFieldDiff[] = comparison.mismatchedFields.map((entry) => ({
    field: entry.field,
    expected: entry.submitted,
    actual: entry.retrieved,
    classification: entry.issue === "missing_from_retrieve" ? "NEEDS_LEIDOS_CLARIFICATION" : "MISMATCH",
    suggestedLikelyCause: entry.issue === "missing_from_retrieve" ? "Leidos" : "unclear",
    issue: entry.issue,
  }));
  const retrievedOtherInfo = comparable(
    (retrievedProviderPlan as Record<string, unknown>).otherInfo ??
    (retrievedProviderPlan as Record<string, unknown>).otherInformation,
  );
  for (const expected of expectedOtherInfoIncludes) {
    if (!retrievedOtherInfo.includes(comparable(expected))) {
      diffs.push({
        field: "otherInfo",
        expected,
        actual: retrievedOtherInfo || null,
        classification: "MISMATCH",
        suggestedLikelyCause: "unclear",
        issue: `Expected retrieved Field 18 to include ${expected}`,
      });
    }
  }
  return diffs;
};
