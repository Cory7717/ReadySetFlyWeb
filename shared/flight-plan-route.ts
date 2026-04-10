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

export type FiledRouteStructureSegmentKind =
  | "origin"
  | "departure-procedure"
  | "airway"
  | "enroute"
  | "arrival-procedure"
  | "destination";

export type FiledRouteStructureSegment = {
  kind: FiledRouteStructureSegmentKind;
  label: string;
  tokens: string[];
  tokenKinds: FiledRouteTokenKind[];
  startIndex: number;
  endIndex: number;
  transitionHint: string | null;
  runwayHint: string | null;
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
  structure: FiledRouteStructureSegment[];
  warnings: string[];
};

function deriveProcedureSegmentLabel(
  kind: FiledRouteStructureSegmentKind,
  token: string,
  indexInClass: number,
) {
  if (kind === "departure-procedure") {
    return indexInClass === 0 ? `Departure procedure ${token}` : `Departure transition ${token}`;
  }
  if (kind === "arrival-procedure") {
    return indexInClass === 0 ? `Arrival procedure ${token}` : `Arrival transition ${token}`;
  }
  return `Procedure ${token}`;
}

function deriveTransitionHint(
  tokens: FiledRouteToken[],
  startIndex: number,
  endIndex: number,
) {
  const previousAnchor = [...tokens]
    .slice(0, startIndex)
    .reverse()
    .find((token) => isFiledRouteAnchorKind(token.kind));
  const nextAnchor = tokens
    .slice(endIndex + 1)
    .find((token) => isFiledRouteAnchorKind(token.kind));

  if (!previousAnchor && !nextAnchor) return null;
  if (!previousAnchor) return `Feeds ${nextAnchor?.token || "next anchor"}`;
  if (!nextAnchor) return `Entered from ${previousAnchor.token}`;
  return `${previousAnchor.token} -> ${nextAnchor.token}`;
}

function deriveRunwayHint(token: string) {
  const runwayMatch = token.match(/RWY?(\d{1,2}[LRC]?)/i);
  return runwayMatch ? `RWY ${runwayMatch[1].toUpperCase()}` : null;
}

export function buildFiledRouteStructure(
  tokens: FiledRouteToken[],
  options?: { departureAirport?: string | null; destinationAirport?: string | null },
): FiledRouteStructureSegment[] {
  if (!tokens.length) return [];

  const departureAirport = options?.departureAirport?.trim().toUpperCase() || null;
  const destinationAirport = options?.destinationAirport?.trim().toUpperCase() || null;
  const segments: FiledRouteStructureSegment[] = [];
  const anchorKinds = new Set<FiledRouteTokenKind>(["airport", "fix", "navaid", "coordinate"]);
  const lastProcedureIndex = [...tokens].reverse().find((token) => token.kind === "procedure")?.index ?? -1;
  let procedureIndexInClass = 0;
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];

    if (token.kind === "airport" && departureAirport && token.token === departureAirport && index === 0) {
      segments.push({
        kind: "origin",
        label: `Origin ${token.token}`,
        tokens: [token.token],
        tokenKinds: [token.kind],
        startIndex: index,
        endIndex: index,
        transitionHint: null,
        runwayHint: null,
      });
      index += 1;
      procedureIndexInClass = 0;
      continue;
    }

    if (token.kind === "airport" && destinationAirport && token.token === destinationAirport && index === tokens.length - 1) {
      segments.push({
        kind: "destination",
        label: `Destination ${token.token}`,
        tokens: [token.token],
        tokenKinds: [token.kind],
        startIndex: index,
        endIndex: index,
        transitionHint: null,
        runwayHint: null,
      });
      index += 1;
      procedureIndexInClass = 0;
      continue;
    }

    if (token.kind === "procedure") {
      const kind: FiledRouteStructureSegmentKind =
        index <= Math.max(1, lastProcedureIndex / 2) ? "departure-procedure" : "arrival-procedure";
      segments.push({
        kind,
        label: deriveProcedureSegmentLabel(kind, token.token, procedureIndexInClass),
        tokens: [token.token],
        tokenKinds: [token.kind],
        startIndex: index,
        endIndex: index,
        transitionHint: deriveTransitionHint(tokens, index, index),
        runwayHint: deriveRunwayHint(token.token),
      });
      index += 1;
      procedureIndexInClass += 1;
      continue;
    }

    if (token.kind === "airway") {
      const airwaySegment = buildFiledRouteAirwaySegments(tokens).find((segment) => segment.index === index);
      segments.push({
        kind: "airway",
        label: `Airway ${token.token}`,
        tokens: [token.token],
        tokenKinds: [token.kind],
        startIndex: index,
        endIndex: index,
        transitionHint:
          airwaySegment?.entryToken || airwaySegment?.exitToken
            ? `${airwaySegment?.entryToken || "?"} -> ${airwaySegment?.exitToken || "?"}`
            : null,
        runwayHint: null,
      });
      index += 1;
      procedureIndexInClass = 0;
      continue;
    }

    const startIndex = index;
    const segmentTokens: FiledRouteToken[] = [];
    while (
      index < tokens.length &&
      (anchorKinds.has(tokens[index].kind) || tokens[index].kind === "direct")
    ) {
      segmentTokens.push(tokens[index]);
      index += 1;
      if (tokens[index - 1].kind === "direct") {
        break;
      }
    }

    if (!segmentTokens.length) {
      index += 1;
      continue;
    }

    segments.push({
      kind: "enroute",
      label:
        segmentTokens[0].kind === "direct"
          ? "Direct segment"
          : segmentTokens.length === 1
            ? `Enroute ${segmentTokens[0].token}`
            : `Enroute ${segmentTokens[0].token} -> ${segmentTokens[segmentTokens.length - 1].token}`,
      tokens: segmentTokens.map((entry) => entry.token),
      tokenKinds: segmentTokens.map((entry) => entry.kind),
      startIndex,
      endIndex: index - 1,
      transitionHint: deriveTransitionHint(tokens, startIndex, index - 1),
      runwayHint: null,
    });
    procedureIndexInClass = 0;
  }

  return segments;
}

export function analyzeFiledRoute(input: string): FiledRouteAnalysis {
  const normalizedRoute = normalizeRouteText(input);
  const tokens = parseFiledRouteTokens(normalizedRoute);
  return {
    normalizedRoute,
    tokens,
    counts: countFiledRouteTokens(tokens),
    airportTokens: extractAirportTokensFromFiledRoute(tokens),
    airwaySegments: buildFiledRouteAirwaySegments(tokens),
    structure: buildFiledRouteStructure(tokens),
    warnings: buildFiledRouteWarnings(tokens),
  };
}
