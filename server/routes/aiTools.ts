import crypto from "crypto";
import type { Request, Response } from "express";
import { Router } from "express";
import OpenAI from "openai";
import { count, eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { aiToolUsages } from "@shared/schema";
import { getEntitlementsForUser } from "../membership";

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

const AI_FREE_USE_LIMIT = 5;
const AI_ANON_COOKIE = "rsf_ai_anon";

type AiToolType = "weather_summary" | "notam_translate";

const truncateField = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") return "";
  return value.slice(0, maxLength).trim();
};

const extractUserId = (user: unknown) => {
  if (!user || typeof user !== "object") return null;
  const candidate = user as { id?: unknown; claims?: { sub?: unknown } };
  if (typeof candidate.id === "string" && candidate.id.trim()) {
    return candidate.id;
  }
  if (typeof candidate.claims?.sub === "string" && candidate.claims.sub.trim()) {
    return candidate.claims.sub;
  }
  return null;
};

const parseCookies = (cookieHeader?: string) => {
  if (!cookieHeader) return new Map<string, string>();
  return new Map(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        if (separator < 0) return [part, ""];
        return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
      }),
  );
};

const hashIp = (ip: string) => {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 64);
};

async function resolveAiAccess(req: Request, res: Response) {
  const userId = extractUserId(req.user);
  if (userId) {
    const user = await storage.getUser(userId);
    const entitlements = getEntitlementsForUser(user || null);
    return {
      userId,
      anonId: null,
      isPremium: entitlements.tier === "premium",
      ipHash: hashIp((req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? ""),
    };
  }

  const cookies = parseCookies(req.headers.cookie);
  let anonId = cookies.get(AI_ANON_COOKIE) ?? null;
  if (!anonId) {
    anonId = crypto.randomUUID().replace(/-/g, "");
    res.append(
      "Set-Cookie",
      `${AI_ANON_COOKIE}=${encodeURIComponent(anonId)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`,
    );
  }

  return {
    userId: null,
    anonId,
    isPremium: false,
    ipHash: hashIp((req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? ""),
  };
}

async function getUsageCount(identity: { userId: string | null; anonId: string | null }) {
  if (identity.userId) {
    const [result] = await db
      .select({ value: count() })
      .from(aiToolUsages)
      .where(eq(aiToolUsages.userId, identity.userId));
    return Number(result?.value ?? 0);
  }

  if (identity.anonId) {
    const [result] = await db
      .select({ value: count() })
      .from(aiToolUsages)
      .where(eq(aiToolUsages.anonId, identity.anonId));
    return Number(result?.value ?? 0);
  }

  return AI_FREE_USE_LIMIT;
}

async function recordUsage(identity: { userId: string | null; anonId: string | null; ipHash: string | null }, toolType: AiToolType) {
  await db.insert(aiToolUsages).values({
    userId: identity.userId ?? null,
    anonId: identity.anonId ?? null,
    toolType,
    ipHash: identity.ipHash ?? null,
  });
}

function buildLimitErrorMessage(isAuthenticated: boolean) {
  if (isAuthenticated) {
    return "Free AI usage limit reached. Upgrade to RSF Premium to continue using AI weather and NOTAM translation.";
  }
  return "Free AI usage limit reached. Sign in and upgrade to RSF Premium to continue using AI weather and NOTAM translation.";
}

function parseCabinBriefContent(content: string) {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  const departureMatch = normalized.match(/Departure:\s*([\s\S]*?)(?=\n\s*En Route:|\n\s*Arrival:|\n\s*Trip Summary:|$)/i);
  const enRouteMatch = normalized.match(/En Route:\s*([\s\S]*?)(?=\n\s*Arrival:|\n\s*Trip Summary:|$)/i);
  const arrivalMatch = normalized.match(/Arrival:\s*([\s\S]*?)(?=\n\s*Trip Summary:|$)/i);
  const summaryMatch = normalized.match(/Trip Summary:\s*([\s\S]*?)$/i);

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    departure: departureMatch?.[1]?.trim() || paragraphs[0] || "",
    enRoute: enRouteMatch?.[1]?.trim() || paragraphs[1] || "",
    arrival: arrivalMatch?.[1]?.trim() || paragraphs[2] || "",
    overall: summaryMatch?.[1]?.trim() || "",
    raw: normalized,
  };
}

export const aiToolsRouter = Router();

aiToolsRouter.post("/weather-summary", async (req, res) => {
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

  try {
    const identity = await resolveAiAccess(req, res);
    const usageCount = identity.isPremium ? 0 : await getUsageCount(identity);
    if (!identity.isPremium && usageCount >= AI_FREE_USE_LIMIT) {
      return res.status(403).json({
        error: buildLimitErrorMessage(Boolean(identity.userId)),
        code: "AI_USAGE_LIMIT",
        remainingUses: 0,
        requiresPremium: true,
        requiresPro: true, // Deprecated response alias for older clients.
      });
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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a knowledgeable and safety-focused aviation weather briefer. Your job is to translate raw aviation weather data into a clear, plain-English summary that a general aviation pilot can act on. Always lead with the most safety-relevant information. Flag any conditions that could affect go/no-go decisions. Use pilot-friendly language but keep technical accuracy. Never fabricate weather data - only summarize what is provided. Format your response in three sections: CONDITIONS SUMMARY, FLIGHT IMPACTS, and ITEMS TO WATCH. Keep the total response under 250 words.",
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    await recordUsage(identity, "weather_summary");
    console.log("[weather-summary] generated for user", identity.userId ?? identity.anonId);

    return res.json({
      summary: completion.choices[0]?.message?.content?.trim() ?? "",
      model: "gpt-4o-mini",
      generatedAt: new Date().toISOString(),
      remainingUses: identity.isPremium ? null : Math.max(0, AI_FREE_USE_LIMIT - usageCount - 1),
    });
  } catch (error) {
    console.error("[weather-summary]", error);
    return res.status(502).json({ error: "AI summarizer temporarily unavailable" });
  }
});

aiToolsRouter.post("/notam-translate", async (req, res) => {
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

  try {
    const identity = await resolveAiAccess(req, res);
    const usageCount = identity.isPremium ? 0 : await getUsageCount(identity);
    if (!identity.isPremium && usageCount >= AI_FREE_USE_LIMIT) {
      return res.status(403).json({
        error: buildLimitErrorMessage(Boolean(identity.userId)),
        code: "AI_USAGE_LIMIT",
        remainingUses: 0,
        requiresPremium: true,
        requiresPro: true, // Deprecated response alias for older clients.
      });
    }

    const userPrompt = `Translate the following NOTAMs into plain English.
${airport ? `Airport/area: ${airport}.` : ""}
${route ? `Planned route: ${route}.` : ""}

NOTAMs:
${notams}`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert aviation briefer specializing in NOTAMs. Your job is to translate raw NOTAM text into plain English that a general aviation pilot can quickly understand and act on. For each NOTAM: explain what it means in one or two plain sentences, state whether it is likely relevant to a typical GA flight, and flag any that are safety-critical or could affect flight legality. Group your output into two sections: CRITICAL OR RELEVANT and LOW PRIORITY OR INFORMATIONAL. If a route or airport is provided, use that context to assess relevance. Never fabricate NOTAM content - only translate what is provided. Keep language concise and pilot-friendly.",
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    await recordUsage(identity, "notam_translate");
    console.log("[notam-translate] generated for user", identity.userId ?? identity.anonId);

    return res.json({
      translation: completion.choices[0]?.message?.content?.trim() ?? "",
      model: "gpt-4o-mini",
      generatedAt: new Date().toISOString(),
      remainingUses: identity.isPremium ? null : Math.max(0, AI_FREE_USE_LIMIT - usageCount - 1),
    });
  } catch (error) {
    console.error("[notam-translate]", error);
    return res.status(502).json({ error: "AI summarizer temporarily unavailable" });
  }
});

aiToolsRouter.post("/cabin-brief", async (req, res) => {
  const departureLabel = truncateField(req.body?.departureLabel, 3000);
  const arrivalLabel = truncateField(req.body?.arrivalLabel, 3000);
  const dateLabel = truncateField(req.body?.dateLabel, 200);
  const departureMetar = truncateField(req.body?.departureMetar, 3000);
  const departureTaf = truncateField(req.body?.departureTaf, 3000);
  const arrivalMetar = truncateField(req.body?.arrivalMetar, 3000);
  const arrivalTaf = truncateField(req.body?.arrivalTaf, 3000);
  const routeNotes = truncateField(req.body?.routeNotes, 4000);

  if ((!departureMetar && !departureTaf) || (!arrivalMetar && !arrivalTaf)) {
    return res.status(400).json({ error: "Departure and arrival weather data are required" });
  }

  if (!openaiApiKey) {
    console.error("[cabin-brief]", "Missing OpenAI API key");
    return res.status(502).json({ error: "Cabin Brief is temporarily unavailable" });
  }

  try {
    const userPrompt = `Create a passenger-friendly Cabin Brief for a trip from ${departureLabel || "the departure airport"} to ${arrivalLabel || "the destination airport"}${dateLabel ? ` on ${dateLabel}` : ""}.

Use exactly this format:
Departure:
[3-4 sentences]

En Route:
[3-4 sentences]

Arrival:
[3-4 sentences]

Trip Summary:
[1 sentence]

Departure weather:
${departureMetar ? `METAR:\n${departureMetar}\n` : ""}${departureTaf ? `TAF:\n${departureTaf}\n` : ""}

Arrival weather:
${arrivalMetar ? `METAR:\n${arrivalMetar}\n` : ""}${arrivalTaf ? `TAF:\n${arrivalTaf}\n` : ""}

Route notes:
${routeNotes || "No route-wide pilot reports were available, so be careful not to overstate en route conditions."}`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a friendly, reassuring flight weather assistant writing for nervous or curious airline and GA passengers - not pilots. Your job is to translate raw aviation weather data into plain, warm, conversational English that anyone can understand.\n\nRules:\n- Never use ICAO codes, METAR abbreviations, or pilot jargon without immediately explaining them in plain English\n- Use everyday language: 'partly cloudy' not 'SCT045', 'light breeze' not '8 knots', 'some bumpiness' not 'moderate turbulence'\n- Be reassuring but honest - do not hide real weather, just contextualize it ('some light choppiness is completely normal and expected')\n- Structure your response in exactly three sections: Departure, En Route, Arrival\n- Keep each section to 3-4 sentences max - conversational, not clinical\n- End with one sentence of overall trip summary in a warm tone",
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    const parsed = parseCabinBriefContent(content);

    return res.json({
      departure: parsed.departure,
      enRoute: parsed.enRoute,
      arrival: parsed.arrival,
      overall: parsed.overall,
      raw: parsed.raw,
      model: "gpt-4o-mini",
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cabin-brief]", error);
    return res.status(502).json({ error: "Cabin Brief is temporarily unavailable" });
  }
});
