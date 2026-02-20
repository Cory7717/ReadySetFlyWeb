import type {
  TfmsAlert,
  TfmsAlertSeverity,
  TfmsAlertType,
  TfmsCongestion,
  TfmsCongestionSummary,
  TfmsOverlay,
  TfmsOverlayParams,
  TfmsProvider,
  TfmsRiskInputs,
  TfmsRiskParams,
  TfmsStatus,
  TfmsStatusParams,
} from "../provider";

const ALERT_TYPES: TfmsAlertType[] = ["GDP", "GS", "FLOW", "REROUTE", "MIT", "AIRSPACE"];
const SEVERITIES: TfmsAlertSeverity[] = ["info", "advisory", "warning"];
const CONGESTION_SUMMARIES: TfmsCongestionSummary[] = ["low", "moderate", "high", "unknown"];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickFrom<T>(list: T[], seed: number, offset = 0): T {
  const index = (seed + offset) % list.length;
  return list[index];
}

function buildAlert(dep: string, dest: string, seed: number, index: number, now: Date): TfmsAlert {
  const type = pickFrom(ALERT_TYPES, seed, index * 7);
  const severity = pickFrom(SEVERITIES, seed, index * 13);
  const start = new Date(now.getTime() + index * 45 * 60 * 1000);
  const end = new Date(start.getTime() + (2 + (seed % 4)) * 60 * 60 * 1000);
  const ref = `${type}-${dep}-${dest}-${(seed + index).toString(36).toUpperCase()}`;

  return {
    type,
    severity,
    title: `${type} advisory for ${dep} to ${dest}`,
    details: `Flow program impacting ${dep} to ${dest}. Expect adjusted rates and potential routing constraints.`,
    effectiveStart: start.toISOString(),
    effectiveEnd: end.toISOString(),
    reference: ref,
  };
}

function buildCongestion(seed: number): TfmsCongestion {
  const summary = pickFrom(CONGESTION_SUMMARIES, seed, 3);
  const confidence = Math.min(0.9, 0.35 + ((seed % 40) / 100));
  return { summary, confidence };
}

function parseBbox(bbox: string): [number, number, number, number] | null {
  const parts = bbox.split(",").map((value) => Number(value));
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) return null;
  const [minLon, minLat, maxLon, maxLat] = parts;
  if (minLon >= maxLon || minLat >= maxLat) return null;
  return [minLon, minLat, maxLon, maxLat];
}

function buildOverlayFeatures(bbox: string, seed: number) {
  const bounds = parseBbox(bbox);
  if (!bounds) return [];
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;
  const midLon = minLon + lonSpan * 0.5;
  const midLat = minLat + latSpan * 0.5;
  const insetLon = lonSpan * (0.15 + (seed % 7) / 100);
  const insetLat = latSpan * (0.12 + (seed % 5) / 100);

  const polygon = {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [midLon - insetLon, midLat - insetLat],
        [midLon + insetLon, midLat - insetLat],
        [midLon + insetLon, midLat + insetLat],
        [midLon - insetLon, midLat + insetLat],
        [midLon - insetLon, midLat - insetLat],
      ]],
    },
    properties: {
      label: "Congestion corridor",
      severity: pickFrom(SEVERITIES, seed, 2),
    },
  };

  const line = {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [
        [minLon + lonSpan * 0.2, minLat + latSpan * 0.75],
        [midLon, midLat],
        [maxLon - lonSpan * 0.1, minLat + latSpan * 0.2],
      ],
    },
    properties: {
      label: "Flow advisory path",
      severity: pickFrom(SEVERITIES, seed, 5),
    },
  };

  return [polygon, line];
}

function buildAlerts(dep: string, dest: string, route: string | null | undefined, now: Date): TfmsAlert[] {
  const seed = hashString(`${dep}-${dest}-${route || ""}`);
  const count = (seed % 3) + 1;
  return Array.from({ length: count }, (_, index) => buildAlert(dep, dest, seed, index, now));
}

export function createStubTfmsProvider(): TfmsProvider {
  return {
    source: "stub",
    async getStatus(params: TfmsStatusParams): Promise<TfmsStatus> {
      const now = params.now || new Date();
      const seed = hashString(`${params.dep}-${params.dest}-${params.route || ""}`);
      const alerts = buildAlerts(params.dep, params.dest, params.route, now);
      const congestion = buildCongestion(seed);

      return {
        generatedAt: now.toISOString(),
        source: "stub",
        dep: params.dep,
        dest: params.dest,
        alerts,
        congestion,
      };
    },
    async getOverlay(params: TfmsOverlayParams): Promise<TfmsOverlay> {
      const now = params.now || new Date();
      const seed = hashString(params.bbox);
      return {
        generatedAt: now.toISOString(),
        features: buildOverlayFeatures(params.bbox, seed),
        styleHints: { recommendedOpacity: 0.35 },
      };
    },
    async getRiskInputs(params: TfmsRiskParams): Promise<TfmsRiskInputs> {
      const now = params.now || new Date();
      const alerts = buildAlerts(params.dep, params.dest, params.route, now);
      const congestion = buildCongestion(hashString(`${params.dep}-${params.dest}`));
      return {
        dep: params.dep,
        dest: params.dest,
        alerts,
        congestion,
      };
    },
  };
}
