import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { getOpenAIClient, salesAdvisorModel } from "./openaiClient";

const advisorNarrativeSchema = z.object({
  executiveSummary: z.string().max(1400),
  priorities: z.array(
    z.object({
      accountKey: z.string(),
      rationale: z.string().max(700),
      recommendedApproach: z.string().max(700),
      planningNote: z.string().max(700),
    }),
  ).max(20),
  demandDrivers: z.array(
    z.object({
      accountKey: z.string(),
      inference: z.string().max(500),
      confidence: z.enum(["low", "medium", "high"]),
    }),
  ).max(20),
  weeklyPlan: z.array(
    z.object({
      dayOrSequence: z.string().max(80),
      focus: z.string().max(240),
      accounts: z.array(z.string()),
      actionPlanEntry: z.string().max(700),
    }),
  ).max(10),
  additionalLimitations: z.array(z.string().max(500)).max(10),
});

export async function generateSalesAdvisorNarrative(context: Record<string, unknown>) {
  const client = getOpenAIClient();
  if (!client)
    throw Object.assign(new Error("OpenAI is not configured for Sales Advisor."), {
      statusCode: 503,
    });
  const completion = await client.chat.completions.parse({
    model: salesAdvisorModel(),
    reasoning_effort: "low",
    messages: [
      {
        role: "system",
        content:
          "You are an onsite hotel Director of Sales planning advisor. Turn the supplied deterministic production analysis into a polished, evidence-based weekly prospecting plan for the DOS to use at the property. Never change, recalculate, or invent production figures. Treat missing months as unknown. Clearly label demand-driver statements as inferences. Recommend concrete outreach and research actions, but do not imply that any external system was updated. Reference only account keys supplied in the context.",
      },
      {
        role: "user",
        content: JSON.stringify(context),
      },
    ],
    response_format: zodResponseFormat(advisorNarrativeSchema, "sales_advisor_narrative"),
  } as any);
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) throw new Error("Sales Advisor returned no structured result.");
  return parsed;
}
