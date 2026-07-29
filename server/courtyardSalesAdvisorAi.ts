import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { getOpenAIClient, salesAdvisorModel } from "./openaiClient";

const advisorNarrativeSchema = z.object({
  executiveSummary: z.string(),
  priorities: z.array(
    z.object({
      accountKey: z.string(),
      rationale: z.string(),
      recommendedApproach: z.string(),
      ivyActivity: z.string(),
    }),
  ),
  demandDrivers: z.array(
    z.object({
      accountKey: z.string(),
      inference: z.string(),
      confidence: z.enum(["low", "medium", "high"]),
    }),
  ),
  weeklyPlan: z.array(
    z.object({
      dayOrSequence: z.string(),
      focus: z.string(),
      accounts: z.array(z.string()),
      ivyEntry: z.string(),
    }),
  ),
  additionalLimitations: z.array(z.string()),
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
          "You are a hotel Director of Sales planning advisor. Turn the supplied deterministic production analysis into a concise, evidence-based weekly prospecting plan. Never change, recalculate, or invent production figures. Treat missing months as unknown. Clearly label demand-driver statements as inferences. Do not create CRM tasks; write short IVY-ready activity text the DOS can copy. Reference only account keys supplied in the context.",
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
