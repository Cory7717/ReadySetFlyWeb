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
        required: ["eventName", "category", "startDate", "endDate", "venue", "city", "distanceMiles", "demandLevel", "opportunityTypes", "targetRoles", "recommendedAction", "bookingWindowDays", "sourceName", "sourceUrl", "confidence"],
        properties: {
          eventName: { type: "string", maxLength: 240 },
          category: { type: "string", enum: ["Citywide", "Youth Sports", "Sports", "Graduation", "Concert", "Festival", "Convention", "University", "Government", "Corporate", "Construction", "Medical", "Relocation", "Wedding", "Housing Displacement", "Film Production", "Other"] },
          startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          endDate: { type: ["string", "null"] },
          venue: { type: ["string", "null"] },
          city: { type: ["string", "null"] },
          distanceMiles: { type: ["number", "null"], minimum: 0, maximum: 75 },
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

export function isDemandEventHotelFit(event: { category?: string; distanceMiles?: number | null }) {
  if (event.category === "Construction") return event.distanceMiles != null && event.distanceMiles <= 15;
  return event.distanceMiles == null || event.distanceMiles <= 75;
}

export async function researchDemandEvents(year: number, month: number) {
  const client = getOpenAIClient();
  if (!client) throw Object.assign(new Error("OpenAI is not configured for demand research."), { statusCode: 503 });
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const run = async (name: string, domains: string[], prompt: string) => {
    const response = await client.responses.create({
      model: salesAdvisorModel(),
      reasoning: { effort: "low" },
      tools: [{
        type: "web_search",
        search_context_size: "medium",
        user_location: { type: "approximate", city: "Austin", region: "Texas", country: "US", timezone: "America/Chicago" },
        filters: { allowed_domains: domains },
      }],
      input: prompt,
      text: { format: { type: "json_schema", name, strict: true, schema: eventSchema }, verbosity: "low" },
      include: ["web_search_call.action.sources"],
    } as any);
    return JSON.parse(response.output_text || '{"events":[]}').events || [];
  };
  const generalDomains = ["austintexas.org", "austintexas.gov", "austinconventioncenter.com", "hebcenter.com", "roundrocktexas.gov", "goroundrock.com", "calendar.utexas.edu", "cedarparktexas.gov", "moodycenteratx.com", "circuitoftheamericas.com"];
  const sportsDomains = ["lonestar-sc.com", "uiltexas.org", "stxsoccer.org", "wddoa.org", "usyouthsoccer.org", "usacup.org", "5v5soccer.com", "socceryouth.com", "lsvolleyball.org", "austinjuniors.com", "leagueapps.com", "sportngin.com", "exposureevents.com", "roundrocktexas.gov", "goroundrock.com", "hebcenter.com"];
  const sharedRules = `The hotel is Courtyard Austin Northwest/Lakeline at 12833 Ranch Road 620 North, Austin, Texas, coordinates 30.465947,-97.801203. Every result must occur during ${monthLabel}, include an exact date and direct supporting URL, and have credible overnight lodging potential. Report an approximate hotel distance only when the venue or project location is established; otherwise use null. Omit ordinary local league games, day camps, practices, and small community events. Recommend outreach roles, never invented personal names. Demand level is a planning inference. For construction or project crews, include only projects within 15 driving miles of the hotel; do not include remote road work such as Johnny Morris Road. For medical, relocation, housing displacement, film production, weddings, utilities, insurance-response, or government activity, include only a specific dated or officially announced demand signal—not a generic organization.`;
  const [general, sports] = await Promise.all([
    run("hotel_general_demand", generalDomains, `Research verified hotel demand generators. Include citywides, conventions, graduations, major concerts and festivals, university and government activity, nearby corporate training or openings, medical travel signals, relocation or housing displacement, film production, weddings, utility or insurance-response activity, and nearby long-duration construction that satisfies the fit rules. ${sharedRules}`),
    run("hotel_youth_sports", sportsDomains, `Research traveling amateur and youth sports tournaments in Cedar Park, Round Rock, Leander, Georgetown, and North Austin. Explicitly search soccer, volleyball, basketball, baseball, softball, lacrosse, cheer, dance, gymnastics, swimming, track, 5v5/7v7, showcases, qualifiers, and UIL events at Round Rock Multipurpose Complex, Round Rock Sports Center, Old Settlers Park, Dell Diamond, H-E-B Center, Austin Sports Center Cedar Park, Kelly Reeves Athletic Complex, Williamson County Expo Center, and Brushy Creek facilities. Prioritize multi-day events, traveling teams, showcases, state/regional championships, and stay-to-play events. If a housing provider is named, identify the housing-provider or tournament-housing role in targetRoles and explain that booking access may require joining the official block. ${sharedRules}`),
  ]);
  const valid = [...general, ...sports].filter((event: any) => {
    if (!event.startDate?.startsWith(`${year}-${String(month).padStart(2, "0")}`) || !/^https:\/\//.test(event.sourceUrl)) return false;
    return isDemandEventHotelFit(event);
  });
  return Array.from(new Map(valid.map((event: any) => [`${event.eventName.toLowerCase()}|${event.startDate}`, event])).values());
}
