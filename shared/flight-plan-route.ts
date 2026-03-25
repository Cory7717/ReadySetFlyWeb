export type FiledRouteTokenKind =
  | "airport"
  | "fix"
  | "navaid"
  | "airway"
  | "procedure"
  | "direct"
  | "coordinate"
  | "unknown";

export type FiledRouteToken = {
  token: string;
  kind: FiledRouteTokenKind;
  index: number;
};

export type FiledRouteTokenCounts = Record<FiledRouteTokenKind, number>;

export type FiledRouteAirwaySegment = {
  airway: string;
  index: number;
  entryToken: string | null;
  exitToken: string | null;
};

export const FILED_ROUTE_DEFAULT_COUNTS: FiledRouteTokenCounts = {
  airport: 0,
  fix: 0,
  navaid: 0,
  airway: 0,
  procedure: 0,
  direct: 0,
  coordinate: 0,
  unknown: 0,
};

export function normalizeRouteText(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

export function parseAirportWaypoints(input: string) {
  return input
    .split(/[,\s]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .filter((item) => /^[A-Z0-9]{3,4}$/.test(item));
}

export function classifyFiledRouteToken(token: string): FiledRouteTokenKind {
  const normalized = token.trim().toUpperCase();
  if (!normalized) return "unknown";
  if (normalized === "DCT") return "direct";
  if (/^(V|J|Q|T)\d+[A-Z]?$/.test(normalized)) return "airway";
  if (/^\d{2,4}[NS]\d{3,5}[EW]$/.test(normalized) || /^\d{2,4}[NS]\/\d{3,5}[EW]$/.test(normalized)) {
    return "coordinate";
  }
  if (/^[A-Z]{5}$/.test(normalized)) return "fix";
  if (/^[A-Z]{3,6}\d[A-Z]?$/.test(normalized)) return "procedure";
  if (/^[A-Z]{2,3}$/.test(normalized)) return "navaid";
  if (/^[A-Z]{4}$/.test(normalized)) return "airport";
  return "unknown";
}

export function parseFiledRouteTokens(input: string): FiledRouteToken[] {
  const normalized = normalizeRouteText(input);
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean)
    .map((token, index) => ({
      token,
      kind: classifyFiledRouteToken(token),
      index,
    }));
}

export function extractAirportTokensFromFiledRoute(tokens: FiledRouteToken[]) {
  return tokens
    .filter((token) => token.kind === "airport")
    .map((token) => token.token);
}

export function filedRouteTokenKindLabel(kind: FiledRouteTokenKind) {
  switch (kind) {
    case "airport":
      return "Airport";
    case "fix":
      return "Fix";
    case "navaid":
      return "Navaid";
    case "airway":
      return "Airway";
    case "procedure":
      return "SID/STAR";
    case "direct":
      return "Direct";
    case "coordinate":
      return "Lat/Lon";
    default:
      return "Route token";
  }
}

export function countFiledRouteTokens(tokens: FiledRouteToken[]): FiledRouteTokenCounts {
  return tokens.reduce<FiledRouteTokenCounts>((acc, token) => {
    acc[token.kind] += 1;
    return acc;
  }, { ...FILED_ROUTE_DEFAULT_COUNTS });
}

export function isFiledRouteAnchorKind(kind: FiledRouteTokenKind) {
  return kind === "airport" || kind === "fix" || kind === "navaid" || kind === "procedure" || kind === "coordinate";
}

export function buildFiledRouteAirwaySegments(tokens: FiledRouteToken[]): FiledRouteAirwaySegment[] {
  return tokens
    .filter((token) => token.kind === "airway")
    .map((airwayToken) => {
      let entryToken: string | null = null;
      let exitToken: string | null = null;

      for (let i = airwayToken.index - 1; i >= 0; i -= 1) {
        if (isFiledRouteAnchorKind(tokens[i].kind)) {
          entryToken = tokens[i].token;
          break;
        }
      }

      for (let i = airwayToken.index + 1; i < tokens.length; i += 1) {
        if (isFiledRouteAnchorKind(tokens[i].kind)) {
          exitToken = tokens[i].token;
          break;
        }
      }

      return {
        airway: airwayToken.token,
        index: airwayToken.index,
        entryToken,
        exitToken,
      };
    });
}

export function buildFiledRouteWarnings(tokens: FiledRouteToken[]) {
  const warnings: string[] = [];
  const airwaySegments = buildFiledRouteAirwaySegments(tokens);

  const unknownTokens = tokens.filter((token) => token.kind === "unknown");
  if (unknownTokens.length > 0) {
    warnings.push(`RSF could not classify these route tokens yet: ${unknownTokens.map((token) => token.token).join(", ")}.`);
  }

  const incompleteAirways = airwaySegments.filter((segment) => !segment.entryToken || !segment.exitToken);
  if (incompleteAirways.length > 0) {
    warnings.push(`Some airways are missing a recognizable entry or exit token: ${incompleteAirways.map((segment) => segment.airway).join(", ")}.`);
  }

  if (tokens.some((token) => token.kind === "procedure")) {
    warnings.push("SID/STAR tokens are recognized for review, but RSF does not expand full procedure geometry yet.");
  }

  if (tokens.some((token) => token.kind === "fix" || token.kind === "navaid" || token.kind === "airway")) {
    warnings.push("Fixes, navaids, and airways are recognized in the filed route, but RSF still uses airport-resolvable points for current map/weather geometry.");
  }

  return warnings;
}

export type FiledRouteAnalysis = {
  normalizedRoute: string;
  tokens: FiledRouteToken[];
  counts: FiledRouteTokenCounts;
  airportTokens: string[];
  airwaySegments: FiledRouteAirwaySegment[];
  warnings: string[];
};

export function analyzeFiledRoute(input: string): FiledRouteAnalysis {
  const normalizedRoute = normalizeRouteText(input);
  const tokens = parseFiledRouteTokens(normalizedRoute);
  return {
    normalizedRoute,
    tokens,
    counts: countFiledRouteTokens(tokens),
    airportTokens: extractAirportTokensFromFiledRoute(tokens),
    airwaySegments: buildFiledRouteAirwaySegments(tokens),
    warnings: buildFiledRouteWarnings(tokens),
  };
}
