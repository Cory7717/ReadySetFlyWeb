import OpenAI from "openai";

let client: OpenAI | null | undefined;

export function getOpenAIClient() {
  if (client !== undefined) return client;
  const apiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = (
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    ""
  ).trim();
  client = apiKey
    ? new OpenAI({
        apiKey,
        ...(baseUrl.startsWith("http") ? { baseURL: baseUrl } : {}),
      })
    : null;
  return client;
}

export const salesAdvisorModel = () =>
  process.env.SALES_ADVISOR_OPENAI_MODEL || "gpt-5.6-sol";
