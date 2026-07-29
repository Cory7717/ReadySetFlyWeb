import { getOpenAIClient, salesAdvisorModel } from "./openaiClient";

const eventSchema = {
  type: "object",
  additionalProperties: false,
  required: ["events"],
  properties: {
    events: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["eventName", "category", "startDate", "endDate", "venue", "city", "demandLevel", "opportunityTypes", "targetRoles", "recommendedAction", "bookingWindowDays", "sourceName", "sourceUrl", "confidence"],
        properties: {
          eventName: { type: "string", maxLength: 240 },
          category: { type: "string", enum: ["Citywide", "Sports", "Graduation", "Concert", "Festival", "Convention", "University", "Government", "Corporate", "Construction", "Other"] },
          startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          endDate: { type: ["string", "null"] },
          venue: { type: ["string", "null"] },
          city: { type: ["string", "null"] },
          demandLevel: { type: "string", enum: ["low", "medium", "high"] },
          opportunityTypes: { type: "array", items: { type: "string" }, maxItems: 5 },
          targetRoles: { type: "array", items: { type: "string" }, maxItems: 8 },
          recommendedAction: { type: "string", maxLength: 700 },
          bookingWindowDays: { type: "integer", minimum: 14, maximum: 365 },
          sourceName: { type: "string" },
          sourceUrl: { type: "string" },
          confidence: { type: "string", enum: ["medium", "high"] },
        },
      },
    },
  },
};

export async function researchDemandEvents(year: number, month: number) {
  const client = getOpenAIClient();
  if (!client) throw Object.assign(new Error("OpenAI is not configured for demand research."), { statusCode: 503 });
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const response = await client.responses.create({
    model: salesAdvisorModel(),
    reasoning: { effort: "low" },
    tools: [{
      type: "web_search",
      search_context_size: "medium",
      user_location: { type: "approximate", city: "Austin", region: "Texas", country: "US", timezone: "America/Chicago" },
      filters: { allowed_domains: ["austintexas.org", "austintexas.gov", "austinconventioncenter.com", "hebcenter.com", "roundrocktexas.gov", "goroundrock.com", "calendar.utexas.edu", "cedarparktexas.gov", "moodycenteratx.com", "circuitoftheamericas.com"] },
    }],
    input: `Research verified upcoming demand generators during ${monthLabel} within roughly 75 miles of Courtyard Austin Lakeline. Include citywides, conventions, sports tournaments, graduations, major concerts, festivals, university events, government activity, and publicly announced corporate or construction activity likely to generate overnight lodging. Use only official sources from the allowed domains. Every event must have a direct supporting source URL and exact date; omit anything unverified. Recommend hotel outreach roles, not invented personal names. Demand level is a planning inference, not an attendance claim.`,
    text: { format: { type: "json_schema", name: "hotel_demand_events", strict: true, schema: eventSchema }, verbosity: "low" },
    include: ["web_search_call.action.sources"],
  } as any);
  const parsed = JSON.parse(response.output_text || '{"events":[]}');
  return (parsed.events || []).filter((event: any) => event.startDate?.startsWith(`${year}-${String(month).padStart(2, "0")}`) && /^https:\/\//.test(event.sourceUrl));
}
