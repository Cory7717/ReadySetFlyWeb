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
      successMeasure: z.string().max(500),
      followUpTiming: z.string().max(160),
    }),
  ).max(5),
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

const advisorAssistanceSchema = z.object({
  title: z.string().max(200),
  verifiedFacts: z.array(z.string().max(400)).max(12),
  inferences: z.array(z.string().max(400)).max(8),
  unknownsToVerify: z.array(z.string().max(400)).max(12),
  content: z.string().max(5000),
});

export async function generateSalesAdvisorNarrative(context: Record<string, unknown>) {
  const client = getOpenAIClient();
  if (!client)
    throw Object.assign(new Error("OpenAI is not configured for Sales Advisor."), {
      statusCode: 503,
    });
  const system = "You are an onsite hotel Director of Sales planning advisor. Turn the supplied deterministic production analysis into a polished, evidence-based weekly prospecting plan for the DOS to use at the property. Return no more than five priorities. Never change, recalculate, or invent production figures. Treat missing months as unknown. Clearly label demand-driver statements as inferences. Recommend concrete outreach and research actions with a measurable success measure and follow-up timing, but do not imply that any external system was updated. Reference only account keys supplied in the context.";
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const completion = await client.chat.completions.parse({
        model: salesAdvisorModel(),
        reasoning_effort: "low",
        messages: [
          { role: "system", content: attempt ? `${system} The prior response failed validation. Return a complete response matching the required schema exactly.` : system },
          { role: "user", content: JSON.stringify(context) },
        ],
        response_format: zodResponseFormat(advisorNarrativeSchema, "sales_advisor_narrative"),
      } as any);
      const parsed = completion.choices[0]?.message.parsed as z.infer<typeof advisorNarrativeSchema> | null | undefined;
      if (!parsed) throw new Error("The model returned no validated result.");
      const allowed = new Set(((context as any).candidates || []).map((item: any) => item.key));
      parsed.priorities = parsed.priorities.filter((item) => allowed.has(item.accountKey)).slice(0, 5);
      parsed.demandDrivers = parsed.demandDrivers.filter((item) => allowed.has(item.accountKey));
      return parsed;
    } catch (error) {
      lastError = error;
    }
  }
  const controlled = new Error("Sales Advisor could not produce a validated plan. Please try again.");
  (controlled as any).statusCode = 502;
  (controlled as any).cause = lastError;
  throw controlled;
}

export async function generateSalesAdvisorAssistance(context: Record<string, unknown>, assistanceType: "email" | "call_script" | "research_checklist") {
  const client = getOpenAIClient();
  if (!client) throw Object.assign(new Error("OpenAI is not configured for Sales Advisor."), { statusCode: 503 });
  const completion = await client.chat.completions.parse({
    model: salesAdvisorModel(), reasoning_effort: "low",
    messages: [
      { role: "system", content: `Create a concise hotel-sales ${assistanceType.replace("_", " ")} for the onsite DOS. Use only supplied facts. Do not invent contacts, dates, travel needs, contractors, or production. Clearly separate verified facts, inferences, and unknowns. The content must be immediately usable but must ask the DOS to verify unknown information.` },
      { role: "user", content: JSON.stringify(context) },
    ],
    response_format: zodResponseFormat(advisorAssistanceSchema, "sales_advisor_assistance"),
  } as any);
  const parsed = completion.choices[0]?.message.parsed as z.infer<typeof advisorAssistanceSchema> | null | undefined;
  if (!parsed) throw Object.assign(new Error("Sales Advisor could not produce validated assistance. Please try again."), { statusCode: 502 });
  return parsed;
}
