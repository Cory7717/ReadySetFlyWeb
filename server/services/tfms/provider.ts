export type TfmsAlertType = "GDP" | "GS" | "FLOW" | "REROUTE" | "MIT" | "AIRSPACE";
export type TfmsAlertSeverity = "info" | "advisory" | "warning";

export type TfmsAlert = {
  type: TfmsAlertType;
  severity: TfmsAlertSeverity;
  title: string;
  details: string;
  effectiveStart: string;
  effectiveEnd: string;
  reference: string;
};

export type TfmsCongestionSummary = "low" | "moderate" | "high" | "unknown";

export type TfmsCongestion = {
  summary: TfmsCongestionSummary;
  confidence: number;
};

export type TfmsStatus = {
  generatedAt: string;
  source: "stub" | "db";
  dep: string;
  dest: string;
  alerts: TfmsAlert[];
  congestion: TfmsCongestion;
};

export type TfmsOverlay = {
  generatedAt: string;
  features: any[];
  styleHints?: { recommendedOpacity?: number };
};

export type TfmsRiskInputs = {
  dep: string;
  dest: string;
  alerts: TfmsAlert[];
  congestion: TfmsCongestion;
};

export type TfmsStatusParams = {
  dep: string;
  dest: string;
  route?: string | null;
  now?: Date;
};

export type TfmsOverlayParams = {
  bbox: string;
  now?: Date;
};

export type TfmsRiskParams = {
  dep: string;
  dest: string;
  route?: string | null;
  now?: Date;
};

export interface TfmsProvider {
  source: "stub" | "db";
  getStatus(params: TfmsStatusParams): Promise<TfmsStatus>;
  getOverlay(params: TfmsOverlayParams): Promise<TfmsOverlay>;
  getRiskInputs(params: TfmsRiskParams): Promise<TfmsRiskInputs>;
}

export function resolveTfmsProviderKey(value?: string | null): "stub" | "db" {
  const normalized = (value || "stub").trim().toLowerCase();
  return normalized === "db" ? "db" : "stub";
}
