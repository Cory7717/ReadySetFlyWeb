import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "../../../db";
import { tfmsEvents, tfmsOverlays } from "@shared/schema";
import type {
  TfmsAlert,
  TfmsCongestion,
  TfmsOverlay,
  TfmsOverlayParams,
  TfmsProvider,
  TfmsRiskInputs,
  TfmsRiskParams,
  TfmsStatus,
  TfmsStatusParams,
} from "../provider";

const buildCongestion = (alerts: TfmsAlert[]): TfmsCongestion => {
  if (alerts.length === 0) {
    return { summary: "unknown", confidence: 0.2 };
  }
  const severityScore = alerts.reduce((total, alert) => {
    if (alert.severity === "warning") return total + 2;
    if (alert.severity === "advisory") return total + 1;
    return total + 0.5;
  }, 0);
  const average = severityScore / alerts.length;
  if (average >= 1.6) return { summary: "high", confidence: 0.7 };
  if (average >= 1.0) return { summary: "moderate", confidence: 0.6 };
  return { summary: "low", confidence: 0.5 };
};

export function createDbTfmsProvider(): TfmsProvider {
  return {
    source: "db",
    async getStatus(params: TfmsStatusParams): Promise<TfmsStatus> {
      const now = params.now || new Date();
      const dep = params.dep.toUpperCase();
      const dest = params.dest.toUpperCase();
      const clause = or(
        eq(tfmsEvents.depIcao, dep),
        eq(tfmsEvents.destIcao, dest),
        and(isNull(tfmsEvents.depIcao), isNull(tfmsEvents.destIcao))
      );

      const rows = await db
        .select()
        .from(tfmsEvents)
        .where(clause)
        .orderBy(desc(tfmsEvents.effectiveStart), desc(tfmsEvents.createdAt))
        .limit(40);

      const alerts = rows.map((row: any) => {
        const details = (row.details || {}) as any;
        return {
          type: row.type as TfmsAlert["type"],
          severity: row.severity as TfmsAlert["severity"],
          title: details.title || `${row.type} advisory`,
          details: details.details || details.summary || "TFMS advisory active.",
          effectiveStart: row.effectiveStart ? row.effectiveStart.toISOString() : now.toISOString(),
          effectiveEnd: row.effectiveEnd ? row.effectiveEnd.toISOString() : now.toISOString(),
          reference: details.reference || row.id,
        };
      });

      return {
        generatedAt: now.toISOString(),
        source: "db",
        dep,
        dest,
        alerts,
        congestion: buildCongestion(alerts),
      };
    },
    async getOverlay(params: TfmsOverlayParams): Promise<TfmsOverlay> {
      const now = params.now || new Date();
      const rows = await db
        .select()
        .from(tfmsOverlays)
        .where(eq(tfmsOverlays.bbox, params.bbox))
        .orderBy(desc(tfmsOverlays.generatedAt))
        .limit(1);

      const overlay = rows[0];
      const rawGeojson: any = overlay?.geojson ?? null;
      const features = Array.isArray(rawGeojson?.features)
        ? rawGeojson.features
        : Array.isArray(rawGeojson)
          ? rawGeojson
          : [];
      return {
        generatedAt: (overlay?.generatedAt || now).toISOString(),
        features,
        styleHints: { recommendedOpacity: 0.35 },
      };
    },
    async getRiskInputs(params: TfmsRiskParams): Promise<TfmsRiskInputs> {
      const status = await this.getStatus(params);
      return {
        dep: status.dep,
        dest: status.dest,
        alerts: status.alerts,
        congestion: status.congestion,
      };
    },
  };
}
