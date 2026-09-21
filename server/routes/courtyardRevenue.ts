import type { Express } from "express";
import multer from "multer";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { courtyardRevenueAnnotations, courtyardRevenueBenchmarks, courtyardRevenueForecasts, courtyardRevenueSnapshots, courtyardRevenueStayDates } from "@shared/schema";
import { courtyardSalesAuth, hasCourtyardHotel } from "./courtyardSalesIntelligence";
import { parseCourtyardOtbCsv } from "../courtyardOtb";

const hotelId = "courtyard-austin-lakeline";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2_000_000, files: 1 } });
const dateSchema = z.string().regex(/^20\d{2}-\d{2}-\d{2}$/);
const monthSchema = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])-01$/);
const money = (value: unknown) => Number(value || 0);
// Isolated defaults for V1; these can be replaced by property-level settings
// without changing the comparison or persistence model.
const DEMAND_REVIEW_THRESHOLDS = { roomPickup: 10, occupancyPoints: 8, revenuePickup: 1500, flatAdrDollars: 2 };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000);
const monthEnd = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
const sortSnapshots = (a: any, b: any) => String(a.snapshotDate).localeCompare(String(b.snapshotDate)) || String(a.snapshotTime || "").localeCompare(String(b.snapshotTime || "")) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || String(a.id).localeCompare(String(b.id));
// The original CSV is retained as evidence in the database, but never loaded
// into dashboard queries or returned to the browser with every snapshot.
const snapshotColumns = {
  id: courtyardRevenueSnapshots.id,
  targetMonth: courtyardRevenueSnapshots.targetMonth,
  snapshotDate: courtyardRevenueSnapshots.snapshotDate,
  snapshotTime: courtyardRevenueSnapshots.snapshotTime,
  roomRevenue: courtyardRevenueSnapshots.roomRevenue,
  roomsOtb: courtyardRevenueSnapshots.roomsOtb,
  adr: courtyardRevenueSnapshots.adr,
  occupancy: courtyardRevenueSnapshots.occupancy,
  groupPu: courtyardRevenueSnapshots.groupPu,
  groupUnpu: courtyardRevenueSnapshots.groupUnpu,
  sourceFilename: courtyardRevenueSnapshots.sourceFilename,
  fingerprint: courtyardRevenueSnapshots.fingerprint,
  detailAvailable: courtyardRevenueSnapshots.detailAvailable,
  sourceNote: courtyardRevenueSnapshots.sourceNote,
  createdAt: courtyardRevenueSnapshots.createdAt,
};
const canEdit = (req: any) => Boolean(req.salesPinAccess || ["manager", "super_admin"].includes(req.salesUser?.role) || req.salesUser?.toolAccessJson?.salesintelligence === true);

function history(snapshots: any[], benchmark: any, forecasts: any[]) {
  const first = snapshots[0];
  return snapshots.map((snapshot, index) => {
    const previous = snapshots[index - 1];
    const pickup = previous ? money(snapshot.roomRevenue) - money(previous.roomRevenue) : null;
    const elapsedDays = previous ? daysBetween(String(snapshot.snapshotDate), String(previous.snapshotDate)) : null;
    const forecast = forecasts.filter((row) => String(row.forecastDate) <= String(snapshot.snapshotDate)).at(-1);
    return {
      ...snapshot,
      daysRemaining: Math.max(0, daysBetween(monthEnd(String(snapshot.targetMonth)), String(snapshot.snapshotDate))),
      pickup,
      elapsedDays,
      pickupPerDay: elapsedDays && elapsedDays > 0 && pickup != null ? pickup / elapsedDays : null,
      cumulativePickup: first ? money(snapshot.roomRevenue) - money(first.roomRevenue) : 0,
      roomPickup: previous && snapshot.roomsOtb != null && previous.roomsOtb != null ? snapshot.roomsOtb - previous.roomsOtb : null,
      adrMovement: previous && snapshot.adr != null && previous.adr != null ? money(snapshot.adr) - money(previous.adr) : null,
      occupancyMovement: previous && snapshot.occupancy != null && previous.occupancy != null ? money(snapshot.occupancy) - money(previous.occupancy) : null,
      priorYearVariance: benchmark?.priorYearRevenue != null ? money(snapshot.roomRevenue) - money(benchmark.priorYearRevenue) : null,
      budgetGap: benchmark?.budgetRevenue != null ? money(benchmark.budgetRevenue) - money(snapshot.roomRevenue) : null,
      forecastLow: forecast?.forecastLow ?? null,
      workingForecast: forecast?.workingForecast ?? null,
      forecastHigh: forecast?.forecastHigh ?? null,
      percentFinalBooked: benchmark?.finalActualRevenue ? money(snapshot.roomRevenue) / money(benchmark.finalActualRevenue) : null,
    };
  });
}

function stayDateComparison(current: any[], previous: any[]) {
  const prior = new Map(previous.map((row) => [String(row.stayDate), row]));
  const compared = current.map((row) => {
    const old: any = prior.get(String(row.stayDate));
    if (!old) return { ...row, comparable: false };
    const roomDelta = row.roomsSold - old.roomsSold;
    const revenueDelta = money(row.roomRevenue) - money(old.roomRevenue);
    const occupancyDelta = row.occupancy == null || old.occupancy == null ? null : money(row.occupancy) - money(old.occupancy);
    const adrDelta = row.adr == null || old.adr == null ? null : money(row.adr) - money(old.adr);
    const signal = (roomDelta >= DEMAND_REVIEW_THRESHOLDS.roomPickup || (occupancyDelta != null && occupancyDelta * 100 >= DEMAND_REVIEW_THRESHOLDS.occupancyPoints) || revenueDelta >= DEMAND_REVIEW_THRESHOLDS.revenuePickup)
      ? "Demand review" : null;
    return { ...row, comparable: true, previousRooms: old.roomsSold, previousOccupancy: old.occupancy, previousAdr: old.adr, previousRevenue: old.roomRevenue, roomDelta, revenueDelta, occupancyDelta, adrDelta, groupPuDelta: money(row.groupPu) - money(old.groupPu), groupUnpuDelta: money(row.groupUnpu) - money(old.groupUnpu), signal, adrFlatWhileAccelerating: Boolean(signal && adrDelta != null && Math.abs(adrDelta) < DEMAND_REVIEW_THRESHOLDS.flatAdrDollars) };
  });
  return compared.map((row: any, index) => ({ ...row, adjacentAcceleration: Boolean(row.signal && ((compared[index - 1] as any)?.signal || (compared[index + 1] as any)?.signal)) }));
}

export function registerCourtyardRevenueRoutes(app: Express) {
  const guard = (req: any, res: any, next: any) => hasCourtyardHotel(req, hotelId) ? next() : res.status(403).json({ error: "Property access required." });
  const edit = (req: any, res: any, next: any) => canEdit(req) ? next() : res.status(403).json({ error: "Revenue editing access required." });
  const file = upload.single("report");
  const parseFile = (req: any) => {
    if (!req.file || !/\.csv$/i.test(req.file.originalname)) throw new Error("Choose a Marriott OTB CSV file.");
    const sourceCsv = req.file.buffer.toString("utf8");
    return { sourceCsv, parsed: parseCourtyardOtbCsv(sourceCsv) };
  };
  app.get("/api/courtyard/revenue", courtyardSalesAuth, guard, async (req: any, res, next) => {
    try {
      const [allSnapshots, benchmarks, forecasts, annotations] = await Promise.all([
        db.select(snapshotColumns).from(courtyardRevenueSnapshots).where(eq(courtyardRevenueSnapshots.hotelId, hotelId)),
        db.select().from(courtyardRevenueBenchmarks).where(eq(courtyardRevenueBenchmarks.hotelId, hotelId)),
        db.select().from(courtyardRevenueForecasts).where(eq(courtyardRevenueForecasts.hotelId, hotelId)),
        db.select().from(courtyardRevenueAnnotations).where(eq(courtyardRevenueAnnotations.hotelId, hotelId)),
      ]);
      const months = Array.from(new Set([...allSnapshots.map((s) => String(s.targetMonth)), ...benchmarks.map((b) => String(b.targetMonth))])).sort();
      const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
      const selected = monthSchema.safeParse(req.query.month).success ? String(req.query.month) : months.includes(currentMonth) ? currentMonth : months.at(-1) || currentMonth;
      const snapshots = allSnapshots.filter((s) => String(s.targetMonth) === selected).sort(sortSnapshots);
      const benchmark = benchmarks.find((b) => String(b.targetMonth) === selected) || null;
      const monthForecasts = forecasts.filter((f) => String(f.targetMonth) === selected).sort((a, b) => String(a.forecastDate).localeCompare(String(b.forecastDate)) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const latestWithDetail = [...snapshots].reverse().slice(0, 2);
      const comparableSnapshots = latestWithDetail.every((s) => s.detailAvailable) ? latestWithDetail : latestWithDetail[0]?.detailAvailable ? latestWithDetail.slice(0, 1) : [];
      const detail = await Promise.all(comparableSnapshots.map((s) => db.select().from(courtyardRevenueStayDates).where(eq(courtyardRevenueStayDates.snapshotId, s.id)).orderBy(asc(courtyardRevenueStayDates.stayDate))));
      const stayDatePickup = detail.length === 2 ? stayDateComparison(detail[0], detail[1]) : detail.length === 1 ? detail[0].map((row) => ({ ...row, comparable: false })) : [];
      const latest = snapshots.at(-1);
      const outlook = months.filter((month) => daysBetween(month, new Date().toISOString().slice(0, 10)) >= -31 && daysBetween(month, new Date().toISOString().slice(0, 10)) <= 120).map((month) => {
        const monthSnapshots = allSnapshots.filter((s) => String(s.targetMonth) === month).sort(sortSnapshots);
        const current = monthSnapshots.at(-1), previous = monthSnapshots.at(-2), b = benchmarks.find((row) => String(row.targetMonth) === month);
        return { month, daysOut: Math.max(0, daysBetween(month, new Date().toISOString().slice(0, 10))), snapshotDate: current?.snapshotDate || null, roomRevenue: current?.roomRevenue ?? null, roomsOtb: current?.roomsOtb ?? null, adr: current?.adr ?? null, occupancy: current?.occupancy ?? null, priorYearRevenue: b?.priorYearRevenue ?? null, budgetRevenue: b?.budgetRevenue ?? null, remainingGap: current && b?.budgetRevenue != null ? money(b.budgetRevenue) - money(current.roomRevenue) : null, pickup: current && previous ? money(current.roomRevenue) - money(previous.roomRevenue) : null };
      });
      const priorMonth = `${Number(selected.slice(0, 4)) - 1}${selected.slice(4)}`;
      const priorCurve = allSnapshots.filter((s) => String(s.targetMonth) === priorMonth).sort(sortSnapshots).map((s) => ({ daysRemaining: daysBetween(monthEnd(priorMonth), String(s.snapshotDate)), revenue: money(s.roomRevenue), rooms: s.roomsOtb, adr: s.adr, occupancy: s.occupancy, snapshotDate: s.snapshotDate }));
      const currentDays = latest ? daysBetween(monthEnd(selected), String(latest.snapshotDate)) : null;
      const sameDaysOut = currentDays == null || !priorCurve.length ? null : priorCurve.reduce((nearest, row) => Math.abs(row.daysRemaining - currentDays) < Math.abs(nearest.daysRemaining - currentDays) ? row : nearest);
      res.json({ months, selectedMonth: selected, snapshots: history(snapshots, benchmark, monthForecasts), latest: latest || null, benchmark, forecasts: monthForecasts, annotations: annotations.filter((a) => String(a.targetMonth || "") === selected), stayDatePickup, comparedSnapshotDates: comparableSnapshots.map((s) => s.snapshotDate), outlook, priorCurve, sameDaysOut, canEdit: canEdit(req) });
    } catch (error) { next(error); }
  });
  app.post("/api/courtyard/revenue/preview", courtyardSalesAuth, guard, edit, file, async (req: any, res, next) => {
    try {
      const { parsed } = parseFile(req);
      const monthRows = await db.select({ id: courtyardRevenueSnapshots.id, snapshotDate: courtyardRevenueSnapshots.snapshotDate, roomRevenue: courtyardRevenueSnapshots.roomRevenue, roomsOtb: courtyardRevenueSnapshots.roomsOtb, fingerprint: courtyardRevenueSnapshots.fingerprint }).from(courtyardRevenueSnapshots).where(and(eq(courtyardRevenueSnapshots.hotelId, hotelId), eq(courtyardRevenueSnapshots.targetMonth, parsed.targetMonth)));
      const duplicate = monthRows.find((s) => s.fingerprint === parsed.fingerprint || (String(s.snapshotDate) === String(req.body.snapshotDate) && money(s.roomRevenue) === parsed.roomRevenue && s.roomsOtb === parsed.roomsOtb));
      res.json({ ...parsed, duplicate: Boolean(duplicate), duplicateSnapshot: duplicate ? { id: duplicate.id, snapshotDate: duplicate.snapshotDate } : null });
    } catch (error: any) { res.status(400).json({ error: error.message || "Invalid OTB report." }); }
  });
  app.post("/api/courtyard/revenue/snapshots", courtyardSalesAuth, guard, edit, file, async (req: any, res, next) => {
    try {
      const date = dateSchema.parse(req.body.snapshotDate);
      const snapshotTime = req.body.snapshotTime ? z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).parse(req.body.snapshotTime) : null;
      const { parsed, sourceCsv } = parseFile(req);
      const duplicates = await db.select({ snapshotDate: courtyardRevenueSnapshots.snapshotDate, roomRevenue: courtyardRevenueSnapshots.roomRevenue, roomsOtb: courtyardRevenueSnapshots.roomsOtb, fingerprint: courtyardRevenueSnapshots.fingerprint }).from(courtyardRevenueSnapshots).where(and(eq(courtyardRevenueSnapshots.hotelId, hotelId), eq(courtyardRevenueSnapshots.targetMonth, parsed.targetMonth)));
      if (duplicates.some((s) => s.fingerprint === parsed.fingerprint || (String(s.snapshotDate) === date && money(s.roomRevenue) === parsed.roomRevenue && s.roomsOtb === parsed.roomsOtb))) return res.status(409).json({ error: "This appears to be an existing snapshot. It was not saved or counted as pickup." });
      const [saved] = await db.insert(courtyardRevenueSnapshots).values({ hotelId, targetMonth: parsed.targetMonth, snapshotDate: date, snapshotTime, roomRevenue: parsed.roomRevenue.toFixed(2), roomsOtb: parsed.roomsOtb, adr: parsed.adr.toFixed(2), occupancy: parsed.occupancy == null ? null : parsed.occupancy.toFixed(5), groupPu: parsed.groupPu, groupUnpu: parsed.groupUnpu, sourceFilename: req.file.originalname.slice(0, 250), fingerprint: parsed.fingerprint, sourceCsv, detailAvailable: true, createdByUserId: req.salesUser?.id || null }).returning();
      try {
        await db.insert(courtyardRevenueStayDates).values(parsed.rows.map((row) => ({ snapshotId: saved.id, stayDate: row.stayDate, roomsSold: row.roomsSold, occupancy: row.occupancy == null ? null : row.occupancy.toFixed(5), adr: row.adr == null ? null : row.adr.toFixed(2), roomRevenue: row.roomRevenue.toFixed(2), groupPu: row.groupPu, groupUnpu: row.groupUnpu })));
      } catch (error) { await db.delete(courtyardRevenueSnapshots).where(eq(courtyardRevenueSnapshots.id, saved.id)); throw error; }
      const { sourceCsv: _sourceCsv, ...snapshot } = saved;
      res.status(201).json({ snapshot });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Enter a valid snapshot date and optional time." });
      if (error?.code === "23505") return res.status(409).json({ error: "An identical snapshot was saved already. No duplicate pickup was created." });
      next(error);
    }
  });
  app.put("/api/courtyard/revenue/benchmarks/:month", courtyardSalesAuth, guard, edit, async (req: any, res, next) => {
    try {
      const month = monthSchema.parse(req.params.month);
      const nullable = z.coerce.number().finite().min(0).nullable().optional();
      const input = z.object({ priorYearRevenue: nullable, priorYearRooms: nullable, priorYearOccupancy: nullable, priorYearAdr: nullable, budgetRevenue: nullable, budgetRooms: nullable, budgetOccupancy: nullable, budgetAdr: nullable, finalActualRevenue: nullable }).parse(req.body);
      const values: any = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value == null ? null : ["priorYearRooms", "budgetRooms"].includes(key) ? Math.round(value) : String(value)]));
      const [saved] = await db.insert(courtyardRevenueBenchmarks).values({ hotelId, targetMonth: month, ...values }).onConflictDoUpdate({ target: [courtyardRevenueBenchmarks.hotelId, courtyardRevenueBenchmarks.targetMonth], set: { ...values, updatedAt: new Date() } }).returning();
      res.json({ benchmark: saved });
    } catch (error: any) { if (error instanceof z.ZodError) return res.status(400).json({ error: "Enter valid non-negative benchmark values." }); next(error); }
  });
  app.post("/api/courtyard/revenue/forecasts", courtyardSalesAuth, guard, edit, async (req: any, res, next) => {
    try {
      const input = z.object({ targetMonth: monthSchema, forecastDate: dateSchema, forecastLow: z.coerce.number().min(0), workingForecast: z.coerce.number().min(0), forecastHigh: z.coerce.number().min(0), note: z.string().max(1000).optional() }).parse(req.body);
      if (input.forecastLow > input.workingForecast || input.workingForecast > input.forecastHigh) return res.status(400).json({ error: "Forecast must be Low ≤ Working ≤ High." });
      const [forecast] = await db.insert(courtyardRevenueForecasts).values({ hotelId, targetMonth: input.targetMonth, forecastDate: input.forecastDate, forecastLow: input.forecastLow.toFixed(2), workingForecast: input.workingForecast.toFixed(2), forecastHigh: input.forecastHigh.toFixed(2), note: input.note || null, createdByUserId: req.salesUser?.id || null }).returning();
      res.status(201).json({ forecast });
    } catch (error: any) { if (error instanceof z.ZodError) return res.status(400).json({ error: "Enter a valid forecast date and amounts." }); next(error); }
  });
  app.post("/api/courtyard/revenue/annotations", courtyardSalesAuth, guard, edit, async (req: any, res, next) => {
    try {
      const input = z.object({ annotationDate: dateSchema, targetMonth: monthSchema.nullable().optional(), kind: z.enum(["stay_date", "milestone"]), label: z.string().trim().min(1).max(120), note: z.string().max(1000).optional() }).parse(req.body);
      const [annotation] = await db.insert(courtyardRevenueAnnotations).values({ hotelId, ...input, targetMonth: input.targetMonth || null }).returning();
      res.status(201).json({ annotation });
    } catch (error: any) { if (error instanceof z.ZodError) return res.status(400).json({ error: "Enter a valid annotation." }); next(error); }
  });
}
