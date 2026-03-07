import { Router } from "express";
import OpenAI from "openai";

const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const configuredBaseUrl = (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || "").trim();
const openaiBaseUrl = configuredBaseUrl && configuredBaseUrl.startsWith("http") ? configuredBaseUrl : undefined;

if (configuredBaseUrl && !openaiBaseUrl) {
  console.warn("OpenAI base URL ignored because it is not a valid http(s) URL", configuredBaseUrl);
}

const openai = new OpenAI({
  apiKey: openaiApiKey,
  ...(openaiBaseUrl ? { baseURL: openaiBaseUrl } : {}),
});

const truncateField = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") return "";
  return value.slice(0, maxLength).trim();
};

const requireUserId = (user: unknown) => {
  if (!user || typeof user !== "object") return null;
  const id = "id" in user ? user.id : null;
  return typeof id === "string" ? id : null;
};

export const aiToolsRouter = Router();

aiToolsRouter.post("/weather-summary", async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Sign in to use AI features" });
  }

  const metar = truncateField(req.body?.metar, 3000);
  const taf = truncateField(req.body?.taf, 3000);
  const pireps = truncateField(req.body?.pireps, 3000);
  const sigmet = truncateField(req.body?.sigmet, 3000);
  const origin = truncateField(req.body?.origin, 3000);
  const destination = truncateField(req.body?.destination, 3000);

  if (!metar && !taf) {
    return res.status(400).json({ error: "Provide at least METAR or TAF data" });
  }

  if (!openaiApiKey) {
    console.error("[weather-summary]", "Missing OpenAI API key");
    return res.status(502).json({ error: "AI summarizer temporarily unavailable" });
  }

  const routeContext = origin && destination
    ? `from ${origin} to ${destination}`
    : origin
      ? `departing ${origin}`
      : destination
        ? `arriving ${destination}`
        : "";

  const userPrompt = `Summarize the following weather data for a flight ${routeContext}:

${metar ? `METAR:\n${metar}\n` : ""}${taf ? `TAF:\n${taf}\n` : ""}${pireps ? `PIREPs:\n${pireps}\n` : ""}${sigmet ? `SIGMETs/AIRMETs:\n${sigmet}\n` : ""}`.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a knowledgeable and safety-focused aviation weather briefer. Your job is to translate raw aviation weather data into a clear, plain-English summary that a general aviation pilot can act on. Always lead with the most safety-relevant information. Flag any conditions that could affect go/no-go decisions. Use pilot-friendly language but keep technical accuracy. Never fabricate weather data — only summarize what is provided. Format your response in three sections: CONDITIONS SUMMARY, FLIGHT IMPACTS, and ITEMS TO WATCH. Keep the total response under 250 words.",
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    console.log("[weather-summary] generated for user", requireUserId(req.user));

    return res.json({
      summary: completion.choices[0]?.message?.content?.trim() ?? "",
      model: "gpt-4o-mini",
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[weather-summary]", error);
    return res.status(502).json({ error: "AI summarizer temporarily unavailable" });
  }
});

aiToolsRouter.post("/notam-translate", async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Sign in to use AI features" });
  }

  const notams = truncateField(req.body?.notams, 6000);
  const airport = truncateField(req.body?.airport, 3000);
  const route = truncateField(req.body?.route, 3000);

  if (!notams) {
    return res.status(400).json({ error: "notams is required" });
  }

  if (!openaiApiKey) {
    console.error("[notam-translate]", "Missing OpenAI API key");
    return res.status(502).json({ error: "AI summarizer temporarily unavailable" });
  }

  const userPrompt = `Translate the following NOTAMs into plain English.
${airport ? `Airport/area: ${airport}.` : ""}
${route ? `Planned route: ${route}.` : ""}

NOTAMs:
${notams}`.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert aviation briefer specializing in NOTAMs. Your job is to translate raw NOTAM text into plain English that a general aviation pilot can quickly understand and act on. For each NOTAM: explain what it means in one or two plain sentences, state whether it is likely relevant to a typical GA flight, and flag any that are safety-critical or could affect flight legality. Group your output into two sections: CRITICAL OR RELEVANT and LOW PRIORITY OR INFORMATIONAL. If a route or airport is provided, use that context to assess relevance. Never fabricate NOTAM content — only translate what is provided. Keep language concise and pilot-friendly.",
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    console.log("[notam-translate] generated for user", requireUserId(req.user));

    return res.json({
      translation: completion.choices[0]?.message?.content?.trim() ?? "",
      model: "gpt-4o-mini",
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[notam-translate]", error);
    return res.status(502).json({ error: "AI summarizer temporarily unavailable" });
  }
});
