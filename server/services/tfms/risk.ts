import type { TfmsAlert, TfmsCongestion, TfmsCongestionSummary } from "./provider";

export type TfmsRiskFactor = {
  key: "TFMS_GDP" | "TFMS_FLOW" | "TFMS_GS" | "TFMS_REROUTE" | "TFMS_MIT" | "TFMS_AIRSPACE" | "WX" | "NOTAM" | "TFR";
  weight: number;
  value: string;
  note: string;
};

export type TfmsRiskResult = {
  riskScore: number;
  rating: "low" | "moderate" | "high" | "unknown";
  factors: TfmsRiskFactor[];
};

const severityWeight: Record<TfmsAlert["severity"], number> = {
  info: 6,
  advisory: 14,
  warning: 24,
};

const congestionWeight: Record<TfmsCongestionSummary, number> = {
  low: 8,
  moderate: 18,
  high: 30,
  unknown: 0,
};

function buildTfmsFactor(key: TfmsRiskFactor["key"], alerts: TfmsAlert[], weight: number) {
  const match = alerts.find((alert) => alert.type === key.replace("TFMS_", ""));
  if (!match) {
    return { key, weight, value: "none", note: "No active advisory detected." } as TfmsRiskFactor;
  }
  return {
    key,
    weight,
    value: match.severity,
    note: match.title,
  } as TfmsRiskFactor;
}

function buildUnknownFactor(key: TfmsRiskFactor["key"]) {
  return {
    key,
    weight: 0,
    value: "unknown",
    note: "Signal unavailable.",
  } as TfmsRiskFactor;
}

export function computeTfmsRisk(alerts: TfmsAlert[], congestion: TfmsCongestion): TfmsRiskResult {
  const tfmsScore = alerts.reduce((total, alert) => total + severityWeight[alert.severity], 0);
  const congestionScore = congestionWeight[congestion.summary];
  const rawScore = Math.min(100, Math.round(tfmsScore + congestionScore));

  const hasSignals = alerts.length > 0 || congestion.summary !== "unknown";
  const rating = !hasSignals
    ? "unknown"
    : rawScore >= 70
      ? "high"
      : rawScore >= 35
        ? "moderate"
        : "low";

  const factors: TfmsRiskFactor[] = [
    buildTfmsFactor("TFMS_GDP", alerts, 0.25),
    buildTfmsFactor("TFMS_FLOW", alerts, 0.2),
    buildTfmsFactor("TFMS_GS", alerts, 0.1),
    buildTfmsFactor("TFMS_REROUTE", alerts, 0.15),
    buildTfmsFactor("TFMS_MIT", alerts, 0.1),
    buildTfmsFactor("TFMS_AIRSPACE", alerts, 0.1),
    buildUnknownFactor("WX"),
    buildUnknownFactor("NOTAM"),
    buildUnknownFactor("TFR"),
  ];

  return {
    riskScore: rawScore,
    rating,
    factors,
  };
}
