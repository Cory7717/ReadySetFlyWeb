const ROUTE_WEATHER_IGNORED_TOKENS = new Set([
  "DCT",
  "DIRECT",
  "VIA",
  "TO",
  "FROM",
  "SID",
  "STAR",
]);

const ROUTE_WEATHER_TOKEN_PATTERN = /^[A-Z0-9]{3,5}$/;

export type RouteWeatherTokenFilterResult = {
  tokensOriginal: string[];
  tokensFiltered: string[];
  tokensIgnored: string[];
};

export const tokenizeRouteWeatherInput = (route: string | null | undefined) =>
  String(route || "")
    .toUpperCase()
    .split(/[\s,;|]+/g)
    .map((token) => token.trim().replace(/^[./-]+|[./-]+$/g, ""))
    .filter(Boolean);

export function analyzeRouteWeatherTokens(route: string | null | undefined): RouteWeatherTokenFilterResult {
  const tokensOriginal = tokenizeRouteWeatherInput(route);
  const tokensFiltered: string[] = [];
  const tokensIgnored: string[] = [];
  const seen = new Set<string>();
  const seenIgnored = new Set<string>();

  for (const token of tokensOriginal) {
    const ignored =
      ROUTE_WEATHER_IGNORED_TOKENS.has(token) ||
      !ROUTE_WEATHER_TOKEN_PATTERN.test(token) ||
      /^(V|J|Q|T)\d+[A-Z]?$/.test(token);

    if (ignored) {
      if (!seenIgnored.has(token)) {
        tokensIgnored.push(token);
        seenIgnored.add(token);
      }
      continue;
    }

    if (!seen.has(token)) {
      tokensFiltered.push(token);
      seen.add(token);
    }
  }

  return { tokensOriginal, tokensFiltered, tokensIgnored };
}

export const filterRouteWeatherTokens = (route: string | null | undefined) =>
  analyzeRouteWeatherTokens(route).tokensFiltered;

export function buildRouteWeatherIcaoList({
  departure,
  destination,
  alternate,
  route,
  limit = 8,
}: {
  departure?: string | null;
  destination?: string | null;
  alternate?: string | null;
  route?: string | null;
  limit?: number;
}) {
  const candidates = [
    departure,
    ...filterRouteWeatherTokens(route),
    destination,
    alternate,
  ]
    .map((token) => String(token || "").trim().toUpperCase())
    .filter((token) => ROUTE_WEATHER_TOKEN_PATTERN.test(token) && !ROUTE_WEATHER_IGNORED_TOKENS.has(token));

  return Array.from(new Set(candidates)).slice(0, limit);
}
