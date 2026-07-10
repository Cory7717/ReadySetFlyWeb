import { normalizeRouteText, parseFiledRouteTokens } from "./flight-plan-route";

export function composePlanningGeometryRoute({
  departure,
  route,
  destination,
}: {
  departure?: string | null;
  route?: string | null;
  destination?: string | null;
}) {
  const departureToken = normalizeRouteText(String(departure || ""));
  const destinationToken = normalizeRouteText(String(destination || ""));
  const routeTokens = normalizeRouteText(String(route || ""))
    .split(/\s+/)
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);
  const meaningfulRouteTokens = parseFiledRouteTokens(routeTokens.join(" "))
    .filter((token) => token.token !== "DCT");
  const firstMeaningfulRouteToken = meaningfulRouteTokens[0]?.token || null;
  const lastMeaningfulRouteToken = meaningfulRouteTokens[meaningfulRouteTokens.length - 1]?.token || null;
  let tokens = [...routeTokens];

  if (departureToken && firstMeaningfulRouteToken !== departureToken) {
    tokens = tokens[0] === "DCT" ? [departureToken, ...tokens] : [departureToken, "DCT", ...tokens];
  }

  if (destinationToken && lastMeaningfulRouteToken !== destinationToken) {
    tokens = tokens[tokens.length - 1] === "DCT" ? [...tokens, destinationToken] : [...tokens, "DCT", destinationToken];
  }

  return normalizeRouteText(tokens.filter((token, index, arr) =>
    !(token === "DCT" && arr[index - 1] === "DCT")
  ).join(" "));
}
