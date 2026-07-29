// @ts-nocheck -- This server module uses runtime-supported Map iterator spreading.
import type { Express } from "express";
import express from "express";
import multer from "multer";
import crypto from "crypto";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "../db";
import {
  courtyardHotelUserAccess,
  courtyardHotels,
  courtyardSalesAccountNotes,
  courtyardSalesAccountProfiles,
  courtyardSalesActivities,
  courtyardSalesImportBatches,
  courtyardSalesProduction,
  courtyardSalesRawRows,
  courtyardSalesOpportunities,
  courtyardSalesWeeklyReports,
  tipsUsers,
} from "@shared/schema";
import {
  MAX_SALES_IMPORT_BYTES,
  consecutiveComparableMonths,
  detectStaySalesReportType,
  isAuthoritativeHotelProductionReport,
  parseSalesImport,
  parseStayGroupSummaryImport,
  parseStayMarketSegmentImport,
  parseStayReservationsCompanyImport,
  normalizeSalesMarketSegment,
  recoveryPriority,
} from "../courtyardSalesImport";

const DEFAULT_HOTEL_ID = "courtyard-austin-lakeline";
const RECOVERY_MONTHS = 3;
const GROUP_REPORT_TYPE = "marriott_mint_group_account_tracking";
const SPECIAL_REPORT_TYPE = "marriott_mint_special_corp_government";
const ALL_MARKET_REPORT_TYPE = "marriott_mint_all_market_segments";
const STAY_MARKET_REPORT_TYPE = "stay_revenue_by_market_segment_with_groups";
const STAY_GROUP_SUMMARY_REPORT_TYPE = "stay_group_summary";
const STAY_RESERVATIONS_REPORT_TYPE = "stay_reservations_company_names";
const REPORT_METADATA: Record<
  string,
  { system: string; label: string; purpose: string }
> = {
  [STAY_MARKET_REPORT_TYPE]: {
    system: "STAY",
    label: "Revenue by Market Segment",
    purpose: "Hotel Production",
  },
  [STAY_GROUP_SUMMARY_REPORT_TYPE]: {
    system: "STAY",
    label: "Group Summary",
    purpose: "Named Group Prospecting",
  },
  [STAY_RESERVATIONS_REPORT_TYPE]: {
    system: "STAY",
    label: "Reservations by Company",
    purpose: "Special Corp/Govt Names",
  },
  [ALL_MARKET_REPORT_TYPE]: {
    system: "MINT",
    label: "All Market Segments",
    purpose: "Hotel Production",
  },
  [GROUP_REPORT_TYPE]: {
    system: "MINT",
    label: "Account Tracking",
    purpose: "Historical Account Prospecting",
  },
  marriott_mint_analytical_account_tracking: {
    system: "MINT",
    label: "Analytical Account Tracking",
    purpose: "Historical Account Prospecting",
  },
  [SPECIAL_REPORT_TYPE]: {
    system: "MINT",
    label: "Special Corp/Govt",
    purpose: "Corporate Account Prospecting",
  },
};
const OPPORTUNITY_STAGES = [
  "prospect",
  "contact_attempted",
  "connected",
  "qualified",
  "proposal_sent",
  "tentative",
  "definite",
  "lost",
  "nurture",
];
const ACTIVITY_TYPES = [
  "call",
  "email",
  "meeting",
  "site_tour",
  "proposal",
  "follow_up",
  "note",
];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SALES_IMPORT_BYTES, files: 3 },
});
const accessMap = (user: any) =>
  user?.toolAccessJson && typeof user.toolAccessJson === "object"
    ? user.toolAccessJson
    : {};
const allowed = (user: any) => {
  const a = accessMap(user);
  return (
    a.salesintelligence ??
    a.dosreporting ??
    (user?.role === "super_admin" || user?.role === "manager")
  );
};
const admin = (user: any) =>
  user?.role === "super_admin" || user?.role === "manager";
async function auth(req: any, res: any, next: any) {
  try {
    const id = req.session?.tipsUserId;
    if (!id)
      return res.status(401).json({ error: "Courtyard login is required." });
    const [user] = await db
      .select()
      .from(tipsUsers)
      .where(eq(tipsUsers.id, String(id)))
      .limit(1);
    if (!user || user.disabledAt || user.mustChangePassword)
      return res.status(401).json({ error: "Courtyard login is required." });
    if (!allowed(user))
      return res.status(403).json({
        error: "Sales Intelligence access is not enabled for this account.",
      });
    let hotels = await db
      .select({ hotel: courtyardHotels })
      .from(courtyardHotelUserAccess)
      .innerJoin(
        courtyardHotels,
        eq(courtyardHotelUserAccess.hotelId, courtyardHotels.id),
      )
      .where(eq(courtyardHotelUserAccess.userId, user.id));
    if (!hotels.length && allowed(user)) {
      const fallback = await db
        .select()
        .from(courtyardHotels)
        .where(eq(courtyardHotels.id, DEFAULT_HOTEL_ID));
      hotels = fallback.map((h) => ({ hotel: h }));
    }
    req.salesUser = user;
    req.salesHotels = hotels.map((h) => h.hotel);
    next();
  } catch (e) {
    next(e);
  }
}
function hasHotel(req: any, id: string) {
  return req.salesHotels.some((h: any) => h.id === id);
}
function productionInsertValue(
  row: any,
  batchId: string,
  hotelId: string,
  reportYear: number,
  reportMonth: number,
) {
  return {
    importBatchId: batchId,
    hotelId,
    reportYear,
    reportMonth,
    globalUltimateAccountName: row.globalUltimateAccountName || null,
    highestLevelAccountId: row.highestLevelAccountId || null,
    accountName: row.accountName || null,
    accountId: row.accountId || null,
    accountType: row.accountType || null,
    marketCategory: row.marketCategory || null,
    marketSegment: row.marketSegment || null,
    rateProgramCode: row.rateProgramCode || null,
    rateProgram: row.rateProgram || null,
    bookingOffice: row.bookingOffice || null,
    roomNights: String(row.roomNights),
    roomRevenue: String(row.roomRevenue),
    roomAdr: String(row.roomAdr),
    totalRevenue: String(row.totalRevenue),
    totalAdr: String(row.totalAdr),
    averageLos: String(row.averageLos),
    fees: String(row.fees),
    taxes: String(row.taxes),
    addOns: String(row.addOns),
    stayArrivalDate: row.stayArrivalDate || null,
    stayDepartureDate: row.stayDepartureDate || null,
    groupBookingCode: row.groupBookingCode || null,
    sourceProfile: row.sourceProfile || null,
    contractedRoomNights:
      row.contractedRoomNights == null
        ? null
        : String(row.contractedRoomNights),
    blockedRoomNights:
      row.blockedRoomNights == null ? null : String(row.blockedRoomNights),
    cancelledRoomNights:
      row.cancelledRoomNights == null ? null : String(row.cancelledRoomNights),
    noShowRoomNights:
      row.noShowRoomNights == null ? null : String(row.noShowRoomNights),
    cutoffDate: row.cutoffDate || null,
    released: row.released == null ? null : Boolean(row.released),
    sourceRowNumber: row.sourceRowNumber,
    normalizedAccountKey: row.normalizedAccountKey,
    normalizedRowHash: row.normalizedRowHash,
  };
}
const n = (v: any) => Number(v || 0);
const periodIndex = (y: number, m: number) => y * 12 + m - 1;
const periodLabel = (y: number, m: number) =>
  new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
function summarize(rows: any[]) {
  const map = new Map<string, any>();
  for (const r of rows) {
    let a = map.get(r.normalizedAccountKey);
    if (!a) {
      a = {
        key: r.normalizedAccountKey,
        displayName:
          r.globalUltimateAccountName || r.accountName || "Unnamed account",
        globalUltimateAccountName: r.globalUltimateAccountName,
        highestLevelAccountId: r.highestLevelAccountId,
        accountId: r.accountId,
        accountType: r.accountType,
        marketCategory: r.marketCategory,
        marketSegment: r.marketSegment,
        rateProgram: r.rateProgram,
        roomNights: 0,
        roomRevenue: 0,
        losNumerator: 0,
        months: new Map(),
        bookingOffices: new Set(),
        bookings: [],
      };
      map.set(r.normalizedAccountKey, a);
    }
    a.roomNights += n(r.roomNights);
    a.roomRevenue += n(r.roomRevenue);
    a.losNumerator += n(r.averageLos) * n(r.roomNights);
    a.bookingOffices.add(r.bookingOffice);
    if (r.groupBookingCode)
      a.bookings.push({
        bookingCode: r.groupBookingCode,
        profile: r.sourceProfile,
        arrivalDate: r.stayArrivalDate,
        departureDate: r.stayDepartureDate,
        contractedRoomNights: n(r.contractedRoomNights),
        blockedRoomNights: n(r.blockedRoomNights),
        pickedUpRoomNights: n(r.roomNights),
        cancelledRoomNights: n(r.cancelledRoomNights),
        noShowRoomNights: n(r.noShowRoomNights),
        roomRevenue: n(r.roomRevenue),
        adr: n(r.roomAdr),
        cutoffDate: r.cutoffDate,
        released: r.released,
      });
    const pi = periodIndex(r.reportYear, r.reportMonth);
    let month = a.months.get(pi) || {
      year: r.reportYear,
      month: r.reportMonth,
      roomNights: 0,
      roomRevenue: 0,
      losNumerator: 0,
      bookingOffices: new Set(),
    };
    month.roomNights += n(r.roomNights);
    month.roomRevenue += n(r.roomRevenue);
    month.losNumerator += n(r.averageLos) * n(r.roomNights);
    month.bookingOffices.add(r.bookingOffice);
    a.months.set(pi, month);
  }
  return [...map.values()].map((a) => {
    const history = [...a.months.entries()].sort((x, y) => x[0] - y[0]);
    const first = history[0]?.[0],
      last = history.at(-1)?.[0];
    return {
      ...a,
      months: undefined,
      bookingOffices: [...a.bookingOffices].filter(Boolean),
      adr: a.roomNights > 0 ? a.roomRevenue / a.roomNights : 0,
      averageLos: a.roomNights > 0 ? a.losNumerator / a.roomNights : 0,
      firstPeriod: first,
      lastPeriod: last,
      history: history.map(([index, m]: any) => ({
        ...m,
        index,
        label: periodLabel(m.year, m.month),
        adr: m.roomNights > 0 ? m.roomRevenue / m.roomNights : 0,
        averageLos: m.roomNights > 0 ? m.losNumerator / m.roomNights : 0,
        bookingOffices: [...m.bookingOffices].filter(Boolean),
      })),
    };
  });
}

function parseDateOrNull(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}
function weekBounds(weekStart: string) {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()))
    throw new Error("Choose a valid week start date.");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}
function activityMetrics(rows: any[], opportunities: any[]) {
  const byType: Record<string, number> = {};
  for (const row of rows)
    byType[row.activityType] = (byType[row.activityType] || 0) + 1;
  return {
    totalActivities: rows.length,
    byType,
    newOpportunities: opportunities.length,
    pipelineRoomNights: opportunities.reduce(
      (s, row) => s + n(row.estimatedRoomNights),
      0,
    ),
    pipelineRevenue: opportunities.reduce(
      (s, row) => s + n(row.estimatedRevenue),
      0,
    ),
    won: opportunities.filter((row) => row.stage === "definite").length,
    lost: opportunities.filter((row) => row.stage === "lost").length,
  };
}
function wrapText(text: string, max = 88) {
  const words = String(text || "").split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > max) {
      if (line) lines.push(line);
      line = word;
    } else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["Not entered."];
}

export function registerCourtyardSalesIntelligenceRoutes(app: Express) {
  const router = express.Router();
  router.use(auth);
  router.get("/me", (req: any, res) =>
    res.json({
      user: {
        id: req.salesUser.id,
        name: req.salesUser.employeeDisplayName || req.salesUser.email,
        isAdmin: admin(req.salesUser),
      },
      hotels: req.salesHotels,
      recoveryThresholdMonths: RECOVERY_MONTHS,
    }),
  );
  router.post("/preview", upload.single("file"), (req: any, res, next) => {
    try {
      if (!req.file)
        return res.status(400).json({ error: "Choose a report file." });
      const reportYear = Number(req.body.reportYear);
      const isStayFormat = Number.isInteger(reportYear) && reportYear >= 2026;
      const requestedReportType = String(req.body.reportType || "");
      const detectedStayReportType = isStayFormat
        ? detectStaySalesReportType(req.file.buffer)
        : null;
      const isGroupSummary =
        isStayFormat &&
        (detectedStayReportType || requestedReportType) ===
          STAY_GROUP_SUMMARY_REPORT_TYPE;
      const isReservationsReport =
        isStayFormat &&
        detectedStayReportType === STAY_RESERVATIONS_REPORT_TYPE;
      const p = isReservationsReport
        ? parseStayReservationsCompanyImport(req.file.buffer)
        : isGroupSummary
          ? parseStayGroupSummaryImport(req.file.buffer)
          : isStayFormat
            ? parseStayMarketSegmentImport(req.file.buffer)
            : parseSalesImport(req.file.buffer);
      const segments = new Set(
        p.accepted.map((row) => String(row.marketSegment || "").toLowerCase()),
      );
      res.json({
        detectedDelimiter: p.delimiter,
        headers: p.rawHeaders,
        rowsFound: p.rowsFound,
        acceptedRows: p.accepted.length,
        rejectedRows: p.rejected.length,
        duplicateRows: p.duplicateRowCount,
        warnings: p.warnings,
        isStayFormat,
        isGroupSummary,
        isReservationsReport,
        reportDateRange: (p as any).reportDateRange || null,
        suggestedReportType: isReservationsReport
          ? STAY_RESERVATIONS_REPORT_TYPE
          : isGroupSummary
            ? STAY_GROUP_SUMMARY_REPORT_TYPE
            : isStayFormat
              ? STAY_MARKET_REPORT_TYPE
              : segments.size > 2
                ? ALL_MARKET_REPORT_TYPE
                : [...segments].some(
                      (value) =>
                        value.includes("special corp") ||
                        value.includes("govt"),
                    )
                  ? SPECIAL_REPORT_TYPE
                  : GROUP_REPORT_TYPE,
        preview: p.accepted.slice(0, 5).map((r) => ({
          account: r.globalUltimateAccountName || r.accountName,
          bookingOffice: r.bookingOffice,
          sourceDetail: isReservationsReport
            ? r.marketSegment
            : isGroupSummary
              ? r.groupBookingCode
              : isStayFormat
                ? r.accountType
                : r.bookingOffice,
          roomNights: r.roomNights,
          roomRevenue: r.roomRevenue,
        })),
      });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });
  router.post("/import", upload.single("file"), async (req: any, res, next) => {
    try {
      if (!req.file)
        return res.status(400).json({ error: "Choose a report file." });
      const hotelId = String(req.body.hotelId || "");
      const requestedReportType = String(req.body.reportType || "");
      const reportYear = Number(req.body.reportYear),
        reportMonth = Number(req.body.reportMonth),
        replace = String(req.body.replace) === "true";
      if (!hasHotel(req, hotelId))
        return res
          .status(403)
          .json({ error: "You do not have access to that property." });
      const sourceReportType =
        reportYear >= 2026
          ? detectStaySalesReportType(req.file.buffer) || requestedReportType
          : requestedReportType;
      if (
        reportYear >= 2026 &&
        ![
          STAY_MARKET_REPORT_TYPE,
          STAY_GROUP_SUMMARY_REPORT_TYPE,
          STAY_RESERVATIONS_REPORT_TYPE,
        ].includes(sourceReportType)
      )
        return res.status(400).json({
          error:
            "Upload a STAY Hotel Production, Group Summary, or Reservations Report.",
        });
      if (
        reportYear < 2026 &&
        ![
          GROUP_REPORT_TYPE,
          SPECIAL_REPORT_TYPE,
          ALL_MARKET_REPORT_TYPE,
        ].includes(sourceReportType)
      )
        return res.status(400).json({
          error:
            "Choose Group Account Production or Special Corp/Govt before importing.",
        });
      if (
        !Number.isInteger(reportYear) ||
        reportYear < 2000 ||
        reportYear > 2100 ||
        !Number.isInteger(reportMonth) ||
        reportMonth < 1 ||
        reportMonth > 12
      )
        return res
          .status(400)
          .json({ error: "Choose a valid report month and year." });
      const p =
        reportYear >= 2026 && sourceReportType === STAY_RESERVATIONS_REPORT_TYPE
          ? parseStayReservationsCompanyImport(req.file.buffer)
          : reportYear >= 2026 &&
              sourceReportType === STAY_GROUP_SUMMARY_REPORT_TYPE
            ? parseStayGroupSummaryImport(req.file.buffer)
            : reportYear >= 2026
              ? parseStayMarketSegmentImport(req.file.buffer)
              : parseSalesImport(req.file.buffer);
      if (reportYear >= 2026 && sourceReportType === STAY_MARKET_REPORT_TYPE) {
        const mismatched = p.accepted.filter((row: any) => {
          const [year, month] = String(row.stayDate || "")
            .split("-")
            .map(Number);
          return year !== reportYear || month !== reportMonth;
        });
        if (mismatched.length)
          return res.status(400).json({
            error: `The STAY report contains ${mismatched.length} row(s) outside the selected ${reportYear}-${String(reportMonth).padStart(2, "0")}. Upload one complete calendar month at a time.`,
          });
      }
      if (
        reportYear >= 2026 &&
        sourceReportType === STAY_GROUP_SUMMARY_REPORT_TYPE
      ) {
        const monthStart = `${reportYear}-${String(reportMonth).padStart(2, "0")}-01`;
        const followingMonth = new Date(Date.UTC(reportYear, reportMonth, 1))
          .toISOString()
          .slice(0, 10);
        const outsideMonth = p.accepted.filter(
          (row: any) =>
            row.stayDepartureDate < monthStart ||
            row.stayArrivalDate >= followingMonth,
        );
        if (outsideMonth.length)
          return res.status(400).json({
            error: `The Group Summary contains ${outsideMonth.length} booking(s) that do not overlap the selected month. Confirm the report filters and reporting period.`,
          });
      }
      const checksum = crypto
        .createHash("sha256")
        .update(req.file.buffer)
        .digest("hex");
      const exact = await db
        .select()
        .from(courtyardSalesImportBatches)
        .where(
          and(
            eq(courtyardSalesImportBatches.hotelId, hotelId),
            eq(courtyardSalesImportBatches.fileChecksum, checksum),
            eq(courtyardSalesImportBatches.status, "completed"),
          ),
        )
        .limit(1);
      if (exact.length && !replace)
        return res.status(409).json({
          error: "This exact file has already been imported.",
          code: "duplicate_file",
        });
      const existing = await db
        .select()
        .from(courtyardSalesImportBatches)
        .where(
          and(
            eq(courtyardSalesImportBatches.hotelId, hotelId),
            eq(courtyardSalesImportBatches.reportYear, reportYear),
            eq(courtyardSalesImportBatches.reportMonth, reportMonth),
            eq(courtyardSalesImportBatches.sourceReportType, sourceReportType),
            eq(courtyardSalesImportBatches.status, "completed"),
          ),
        );
      if (existing.length && !replace)
        return res.status(409).json({
          error:
            "This property already has data for that month. Confirm Replace Month to continue.",
          code: "duplicate_month",
        });
      if (existing.length && replace) {
        if (!admin(req.salesUser))
          return res.status(403).json({
            error: "Manager access is required to replace an import.",
          });
        await db
          .update(courtyardSalesImportBatches)
          .set({ status: "replaced", replacedAt: new Date() })
          .where(
            inArray(
              courtyardSalesImportBatches.id,
              existing.map((x) => x.id),
            ),
          );
      }
      const [batch] = await db
        .insert(courtyardSalesImportBatches)
        .values({
          hotelId,
          reportYear,
          reportMonth,
          originalFilename: req.file.originalname,
          detectedDelimiter: p.delimiter,
          sourceReportType,
          uploadedBy: req.salesUser.id,
          rowCount: p.rowsFound,
          acceptedRowCount: p.accepted.length,
          rejectedRowCount: p.rejected.length,
          duplicateRowCount: p.duplicateRowCount,
          fileChecksum: checksum,
          validationSummaryJson: {
            warnings: p.warnings,
            rejected: p.rejected.slice(0, 100),
            ignoredDetailRows: (p as any).ignoredRowCount || 0,
          },
        })
        .returning();
      if (p.accepted.length) {
        await db.insert(courtyardSalesRawRows).values(
          p.accepted.map((r) => ({
            importBatchId: batch.id,
            sourceRowNumber: r.sourceRowNumber,
            rawPayloadJson: r.raw,
            normalizedRowHash: r.normalizedRowHash,
          })),
        );
        await db
          .insert(courtyardSalesProduction)
          .values(
            p.accepted.map((r) =>
              productionInsertValue(
                r,
                batch.id,
                hotelId,
                reportYear,
                reportMonth,
              ),
            ),
          );
      }
      const accounts = new Set(p.accepted.map((r) => r.normalizedAccountKey))
        .size;
      res.status(201).json({
        batchId: batch.id,
        label: periodLabel(reportYear, reportMonth),
        accounts,
        acceptedRows: p.accepted.length,
        rejectedRows: p.rejected.length,
        duplicateRows: p.duplicateRowCount,
        roomNights: p.accepted.reduce((s, r) => s + r.roomNights, 0),
        roomRevenue: p.accepted.reduce((s, r) => s + r.roomRevenue, 0),
      });
    } catch (e: any) {
      if (e?.code === "LIMIT_FILE_SIZE")
        return res
          .status(413)
          .json({ error: "The file exceeds the 5 MB upload limit." });
      next(e);
    }
  });
  router.post(
    "/imports",
    upload.array("files", 3),
    async (req: any, res, next) => {
      try {
        const files = (req.files || []) as Express.Multer.File[];
        const hotelId = String(req.body.hotelId || "");
        const reportYear = Number(req.body.reportYear);
        const reportMonth = Number(req.body.reportMonth);
        const replace = String(req.body.replace) === "true";
        if (!files.length)
          return res.status(400).json({ error: "Choose one or more reports." });
        if (!hasHotel(req, hotelId))
          return res
            .status(403)
            .json({ error: "You do not have access to that property." });
        if (
          reportYear < 2026 ||
          !Number.isInteger(reportMonth) ||
          reportMonth < 1 ||
          reportMonth > 12
        )
          return res.status(400).json({
            error:
              "Coordinated multi-file imports require a valid STAY month in 2026 or later.",
          });
        const prepared = files.map((file) => {
          const sourceReportType = detectStaySalesReportType(file.buffer);
          if (!sourceReportType)
            throw new Error(
              `${file.originalname} is not a recognized STAY report.`,
            );
          const parsed =
            sourceReportType === STAY_RESERVATIONS_REPORT_TYPE
              ? parseStayReservationsCompanyImport(file.buffer)
              : sourceReportType === STAY_GROUP_SUMMARY_REPORT_TYPE
                ? parseStayGroupSummaryImport(file.buffer)
                : parseStayMarketSegmentImport(file.buffer);
          if (sourceReportType === STAY_MARKET_REPORT_TYPE) {
            const mismatched = parsed.accepted.filter((row: any) => {
              const [year, month] = String(row.stayDate || "")
                .split("-")
                .map(Number);
              return year !== reportYear || month !== reportMonth;
            });
            if (mismatched.length)
              throw new Error(
                `${file.originalname} contains ${mismatched.length} production row(s) outside the selected month.`,
              );
          }
          if (sourceReportType === STAY_GROUP_SUMMARY_REPORT_TYPE) {
            const monthStart = `${reportYear}-${String(reportMonth).padStart(2, "0")}-01`;
            const followingMonth = new Date(
              Date.UTC(reportYear, reportMonth, 1),
            )
              .toISOString()
              .slice(0, 10);
            const outside = parsed.accepted.filter(
              (row: any) =>
                row.stayDepartureDate < monthStart ||
                row.stayArrivalDate >= followingMonth,
            );
            if (outside.length)
              throw new Error(
                `${file.originalname} contains ${outside.length} group(s) outside the selected month.`,
              );
          }
          return {
            file,
            sourceReportType,
            parsed,
            checksum: crypto
              .createHash("sha256")
              .update(file.buffer)
              .digest("hex"),
          };
        });
        const selectedTypes = new Set(
          prepared.map((item) => item.sourceReportType),
        );
        if (selectedTypes.size !== prepared.length)
          return res.status(400).json({
            error: "Select only one file of each STAY report type for a month.",
          });
        const conflicts = [] as any[];
        for (const item of prepared) {
          const existing = await db
            .select()
            .from(courtyardSalesImportBatches)
            .where(
              and(
                eq(courtyardSalesImportBatches.hotelId, hotelId),
                eq(courtyardSalesImportBatches.reportYear, reportYear),
                eq(courtyardSalesImportBatches.reportMonth, reportMonth),
                eq(
                  courtyardSalesImportBatches.sourceReportType,
                  item.sourceReportType,
                ),
                eq(courtyardSalesImportBatches.status, "completed"),
              ),
            );
          conflicts.push(...existing);
        }
        if (conflicts.length && !replace)
          return res.status(409).json({
            error:
              "One or more selected report types already exist for this month. Confirm Replace Month to replace only those matching sources.",
            code: "duplicate_month",
          });
        if (conflicts.length && replace && !admin(req.salesUser))
          return res.status(403).json({
            error: "Manager access is required to replace an import.",
          });
        const results = await db.transaction(async (tx) => {
          if (conflicts.length)
            await tx
              .update(courtyardSalesImportBatches)
              .set({ status: "replaced", replacedAt: new Date() })
              .where(
                inArray(
                  courtyardSalesImportBatches.id,
                  conflicts.map((item) => item.id),
                ),
              );
          const imported = [] as any[];
          for (const item of prepared) {
            const p = item.parsed;
            const [batch] = await tx
              .insert(courtyardSalesImportBatches)
              .values({
                hotelId,
                reportYear,
                reportMonth,
                originalFilename: item.file.originalname,
                detectedDelimiter: p.delimiter,
                sourceReportType: item.sourceReportType,
                uploadedBy: req.salesUser.id,
                rowCount: p.rowsFound,
                acceptedRowCount: p.accepted.length,
                rejectedRowCount: p.rejected.length,
                duplicateRowCount: p.duplicateRowCount,
                fileChecksum: item.checksum,
                validationSummaryJson: {
                  warnings: p.warnings,
                  rejected: p.rejected.slice(0, 100),
                  ignoredDetailRows: p.ignoredRowCount || 0,
                },
              })
              .returning();
            if (p.accepted.length) {
              await tx.insert(courtyardSalesRawRows).values(
                p.accepted.map((row: any) => ({
                  importBatchId: batch.id,
                  sourceRowNumber: row.sourceRowNumber,
                  rawPayloadJson: row.raw,
                  normalizedRowHash: row.normalizedRowHash,
                })),
              );
              await tx
                .insert(courtyardSalesProduction)
                .values(
                  p.accepted.map((row: any) =>
                    productionInsertValue(
                      row,
                      batch.id,
                      hotelId,
                      reportYear,
                      reportMonth,
                    ),
                  ),
                );
            }
            imported.push({
              batchId: batch.id,
              sourceReportType: item.sourceReportType,
              accounts: new Set(
                p.accepted.map((row: any) => row.normalizedAccountKey),
              ).size,
              roomNights: p.accepted.reduce(
                (sum: number, row: any) => sum + row.roomNights,
                0,
              ),
              roomRevenue: p.accepted.reduce(
                (sum: number, row: any) => sum + row.roomRevenue,
                0,
              ),
            });
          }
          return imported;
        });
        res.status(201).json({
          label: periodLabel(reportYear, reportMonth),
          reports: results,
          accounts: results.reduce((sum, item) => sum + item.accounts, 0),
          roomNights: results.reduce((sum, item) => sum + item.roomNights, 0),
          roomRevenue: results.reduce((sum, item) => sum + item.roomRevenue, 0),
        });
      } catch (error: any) {
        if (error?.code === "LIMIT_FILE_SIZE")
          return res
            .status(413)
            .json({ error: "A selected file exceeds the 5 MB upload limit." });
        res.status(400).json({ error: error.message || "Import failed." });
      }
    },
  );
  router.get("/dashboard", async (req: any, res, next) => {
    try {
      const hotelId = String(req.query.hotelId || req.salesHotels[0]?.id || "");
      if (!hasHotel(req, hotelId))
        return res
          .status(403)
          .json({ error: "You do not have access to that property." });
      const batches = await db
        .select()
        .from(courtyardSalesImportBatches)
        .where(eq(courtyardSalesImportBatches.hotelId, hotelId))
        .orderBy(
          desc(courtyardSalesImportBatches.reportYear),
          desc(courtyardSalesImportBatches.reportMonth),
          desc(courtyardSalesImportBatches.createdAt),
        );
      const active = batches.filter(
        (batch) =>
          batch.status === "completed" &&
          (batch.reportYear >= 2026
            ? [
                STAY_MARKET_REPORT_TYPE,
                STAY_GROUP_SUMMARY_REPORT_TYPE,
                STAY_RESERVATIONS_REPORT_TYPE,
              ].includes(batch.sourceReportType)
            : batch.sourceReportType !== STAY_MARKET_REPORT_TYPE),
      );
      const batchIds = active.map((b) => b.id);
      const rows = batchIds.length
        ? await db
            .select()
            .from(courtyardSalesProduction)
            .where(inArray(courtyardSalesProduction.importBatchId, batchIds))
        : [];
      const batchById = new Map(active.map((batch) => [batch.id, batch]));
      const periodsBySource = new Map<string, Set<number>>();
      for (const batch of active) {
        const periods =
          periodsBySource.get(batch.sourceReportType) || new Set<number>();
        periods.add(periodIndex(batch.reportYear, batch.reportMonth));
        periodsBySource.set(batch.sourceReportType, periods);
      }
      const stayRows = rows.filter(
        (row) =>
          batchById.get(row.importBatchId)?.sourceReportType ===
          STAY_MARKET_REPORT_TYPE,
      );
      const companyNameRows = rows.filter(
        (row) =>
          batchById.get(row.importBatchId)?.sourceReportType ===
          STAY_RESERVATIONS_REPORT_TYPE,
      );
      const analyticalAccountRows = rows.filter(
        (row) =>
          batchById.get(row.importBatchId)?.sourceReportType ===
          "marriott_mint_analytical_account_tracking",
      );
      const groupRows = rows
        .filter((row) => {
          const type = batchById.get(row.importBatchId)?.sourceReportType;
          return type === GROUP_REPORT_TYPE;
        })
        .concat(
          analyticalAccountRows.filter(
            (row) => normalizeSalesMarketSegment(row.marketSegment) === "Group",
          ),
        )
        .concat(
          rows.filter(
            (row) =>
              batchById.get(row.importBatchId)?.sourceReportType ===
              STAY_GROUP_SUMMARY_REPORT_TYPE,
          ),
        );
      const corporateRows = analyticalAccountRows.filter(
        (row) => normalizeSalesMarketSegment(row.marketSegment) !== "Group",
      );
      const specialRows = rows
        .filter(
          (row) =>
            batchById.get(row.importBatchId)?.sourceReportType ===
            SPECIAL_REPORT_TYPE,
        )
        .concat(
          stayRows.filter((row) =>
            ["Special Corp", "Government"].includes(
              normalizeSalesMarketSegment(row.marketSegment),
            ),
          ),
        );
      const allMarketRows = rows
        .filter((row) => {
          const type = batchById.get(row.importBatchId)?.sourceReportType;
          return isAuthoritativeHotelProductionReport(String(type || ""));
        })
        .map((row) => {
          const segment = normalizeSalesMarketSegment(row.marketSegment);
          if (
            batchById.get(row.importBatchId)?.sourceReportType !==
            STAY_MARKET_REPORT_TYPE
          )
            return { ...row, marketSegment: segment };
          return {
            ...row,
            marketSegment: segment,
            globalUltimateAccountName: segment,
            accountName: segment,
            normalizedAccountKey: `stay-segment:${segment.toLowerCase().replace(/\s+/g, " ")}`,
          };
        });
      const marketSegments = [
        ...new Set(
          allMarketRows
            .map(
              (row) =>
                String(row.marketSegment || "Unspecified").trim() ||
                "Unspecified",
            )
            .concat(groupRows.length ? ["Group"] : [])
            .concat(
              companyNameRows.map((row) =>
                normalizeSalesMarketSegment(row.marketSegment),
              ),
            ),
        ),
      ].sort((a, b) => a.localeCompare(b));
      const accounts = [
        ...summarize(groupRows).map((account) => ({
          ...account,
          reportCategory: "group",
          recurring: account.history.length >= 2,
        })),
        ...summarize(specialRows).map((account) => ({
          ...account,
          reportCategory: "special",
          recurring: account.history.length >= 2,
        })),
        ...summarize(corporateRows).map((account) => ({
          ...account,
          reportCategory: "corporate",
          recurring: account.history.length >= 2,
        })),
        ...summarize(allMarketRows).map((account) => ({
          ...account,
          reportCategory: "total",
          recurring: account.history.length >= 2,
        })),
        ...marketSegments.flatMap((segment) =>
          summarize(
            segment === "Group"
              ? groupRows
              : allMarketRows
                  .filter(
                    (row) =>
                      (String(row.marketSegment || "Unspecified").trim() ||
                        "Unspecified") === segment,
                  )
                  .concat(
                    companyNameRows.filter(
                      (row) =>
                        normalizeSalesMarketSegment(row.marketSegment) ===
                        segment,
                    ),
                  ),
          ).map((account) => ({
            ...account,
            reportCategory: `segment:${segment}`,
            recurring: account.history.length >= 2,
          })),
        ),
      ];
      const latest = accounts.length
        ? Math.max(...accounts.map((a) => a.lastPeriod))
        : null;
      const groupPeriods = new Set<number>(
        active
          .filter((batch) =>
            [
              GROUP_REPORT_TYPE,
              "marriott_mint_analytical_account_tracking",
              STAY_GROUP_SUMMARY_REPORT_TYPE,
            ].includes(batch.sourceReportType),
          )
          .map((batch) => periodIndex(batch.reportYear, batch.reportMonth)),
      );
      const specialPeriods = new Set<number>(
        active
          .filter((batch) =>
            [SPECIAL_REPORT_TYPE, STAY_RESERVATIONS_REPORT_TYPE].includes(
              batch.sourceReportType,
            ),
          )
          .map((batch) => periodIndex(batch.reportYear, batch.reportMonth)),
      );
      const corporatePeriods =
        periodsBySource.get("marriott_mint_analytical_account_tracking") ||
        new Set<number>();
      for (const a of accounts) {
        const monthsSince = latest === null ? 0 : latest - a.lastPeriod;
        a.monthsSinceLast = monthsSince;
        if (String(a.key).startsWith("stay-company:")) {
          a.status = "Identified Prospect";
        } else if (
          a.reportCategory === "total" ||
          String(a.key).startsWith("stay-segment:")
        ) {
          const history = a.history
            .slice()
            .sort((x: any, y: any) => x.index - y.index);
          const current = history.at(-1);
          const prior = history.at(-2);
          a.status =
            !current || !prior || current.index - prior.index !== 1
              ? "Insufficient History"
              : prior.roomRevenue === 0
                ? current.roomRevenue > 0
                  ? "Growing"
                  : "Stable"
                : (current.roomRevenue - prior.roomRevenue) /
                      Math.abs(prior.roomRevenue) >=
                    0.05
                  ? "Growing"
                  : (current.roomRevenue - prior.roomRevenue) /
                        Math.abs(prior.roomRevenue) <=
                      -0.05
                    ? "Declining"
                    : "Stable";
        } else {
          const comparablePeriods =
            a.reportCategory === "special"
              ? specialPeriods
              : a.reportCategory === "corporate"
                ? corporatePeriods
                : groupPeriods;
          const comparableLatest = comparablePeriods.size
            ? Math.max(...Array.from(comparablePeriods))
            : a.lastPeriod;
          const comparableMonths = consecutiveComparableMonths(
            a.lastPeriod,
            comparableLatest,
            comparablePeriods,
          );
          a.monthsSinceLast = comparableMonths;
          a.status =
            comparableMonths === null
              ? "Insufficient Data"
              : comparableMonths >= RECOVERY_MONTHS
                ? "Potential Recovery"
                : "Active";
        }
        a.recoveryPriority = recoveryPriority(
          a.roomRevenue,
          a.roomNights,
          monthsSince,
          a.history.length,
        );
      }
      const periods = [
        ...new Map(
          active.map((b) => [
            `${b.reportYear}-${b.reportMonth}`,
            {
              year: b.reportYear,
              month: b.reportMonth,
              label: periodLabel(b.reportYear, b.reportMonth),
            },
          ]),
        ).values(),
      ];
      const dataHealth = periods.map((period) => {
        const periodBatches = active.filter(
          (batch) =>
            batch.reportYear === period.year &&
            batch.reportMonth === period.month,
        );
        const expected =
          period.year >= 2026
            ? [
                STAY_MARKET_REPORT_TYPE,
                STAY_GROUP_SUMMARY_REPORT_TYPE,
                STAY_RESERVATIONS_REPORT_TYPE,
              ]
            : [ALL_MARKET_REPORT_TYPE, GROUP_REPORT_TYPE, SPECIAL_REPORT_TYPE];
        const sources = expected.map((sourceReportType, index) => {
          const batch = periodBatches.find(
            (item) => item.sourceReportType === sourceReportType,
          );
          const sourceRows = batch
            ? rows.filter((row) => row.importBatchId === batch.id)
            : [];
          return {
            sourceReportType,
            ...(REPORT_METADATA[sourceReportType] || {}),
            required: index === 0,
            imported: !!batch,
            roomNights: sourceRows.reduce(
              (sum, row) => sum + n(row.roomNights),
              0,
            ),
            roomRevenue: sourceRows.reduce(
              (sum, row) => sum + n(row.roomRevenue),
              0,
            ),
          };
        });
        const requiredComplete = sources
          .filter((source) => source.required)
          .every((source) => source.imported);
        const allComplete = sources.every((source) => source.imported);
        return {
          ...period,
          status: allComplete
            ? "Complete"
            : requiredComplete
              ? "Production Complete — Prospecting Sources Missing"
              : "Missing Hotel Production",
          sources,
        };
      });
      res.json({
        periods,
        latestPeriod: latest,
        accounts,
        marketSegments,
        dataHealth,
        imports: batches.map((b) => ({
          ...b,
          ...(REPORT_METADATA[b.sourceReportType] || {}),
          accounts: new Set(
            rows
              .filter((r) => r.importBatchId === b.id)
              .map((r) => r.normalizedAccountKey),
          ).size,
          roomNights: rows
            .filter((r) => r.importBatchId === b.id)
            .reduce((s, r) => s + n(r.roomNights), 0),
          roomRevenue: rows
            .filter((r) => r.importBatchId === b.id)
            .reduce((s, r) => s + n(r.roomRevenue), 0),
        })),
      });
    } catch (e) {
      next(e);
    }
  });
  router.get("/accounts/:accountKey", async (req: any, res, next) => {
    try {
      const hotelId = String(req.query.hotelId || "");
      const accountKey = decodeURIComponent(req.params.accountKey);
      if (!hasHotel(req, hotelId))
        return res
          .status(403)
          .json({ error: "You do not have access to that property." });
      const [profile] = await db
        .select()
        .from(courtyardSalesAccountProfiles)
        .where(
          and(
            eq(courtyardSalesAccountProfiles.hotelId, hotelId),
            eq(courtyardSalesAccountProfiles.normalizedAccountKey, accountKey),
          ),
        )
        .limit(1);
      const notes = profile
        ? await db
            .select()
            .from(courtyardSalesAccountNotes)
            .where(eq(courtyardSalesAccountNotes.profileId, profile.id))
            .orderBy(desc(courtyardSalesAccountNotes.createdAt))
        : [];
      res.json({
        profile: profile || {
          hotelId,
          normalizedAccountKey: accountKey,
          contactName: "",
          phone: "",
          email: "",
        },
        notes,
      });
    } catch (e) {
      next(e);
    }
  });
  router.put(
    "/accounts/:accountKey",
    express.json(),
    async (req: any, res, next) => {
      try {
        const hotelId = String(req.body.hotelId || "");
        const accountKey = decodeURIComponent(req.params.accountKey);
        if (!hasHotel(req, hotelId))
          return res
            .status(403)
            .json({ error: "You do not have access to that property." });
        const contactName = String(req.body.contactName || "")
          .trim()
          .slice(0, 200);
        const phone = String(req.body.phone || "")
          .trim()
          .slice(0, 80);
        const email = String(req.body.email || "")
          .trim()
          .slice(0, 254);
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          return res
            .status(400)
            .json({ error: "Enter a valid email address." });
        const [profile] = await db
          .insert(courtyardSalesAccountProfiles)
          .values({
            hotelId,
            normalizedAccountKey: accountKey,
            contactName,
            phone,
            email,
            updatedBy: req.salesUser.id,
          })
          .onConflictDoUpdate({
            target: [
              courtyardSalesAccountProfiles.hotelId,
              courtyardSalesAccountProfiles.normalizedAccountKey,
            ],
            set: {
              contactName,
              phone,
              email,
              updatedBy: req.salesUser.id,
              updatedAt: new Date(),
            },
          })
          .returning();
        res.json({ profile });
      } catch (e) {
        next(e);
      }
    },
  );
  router.post(
    "/accounts/:accountKey/notes",
    express.json(),
    async (req: any, res, next) => {
      try {
        const hotelId = String(req.body.hotelId || "");
        const accountKey = decodeURIComponent(req.params.accountKey);
        const note = String(req.body.note || "").trim();
        if (!hasHotel(req, hotelId))
          return res
            .status(403)
            .json({ error: "You do not have access to that property." });
        if (!note)
          return res
            .status(400)
            .json({ error: "Enter a contact note before saving." });
        if (note.length > 4000)
          return res
            .status(400)
            .json({ error: "Notes are limited to 4,000 characters." });
        const [profile] = await db
          .insert(courtyardSalesAccountProfiles)
          .values({
            hotelId,
            normalizedAccountKey: accountKey,
            updatedBy: req.salesUser.id,
          })
          .onConflictDoUpdate({
            target: [
              courtyardSalesAccountProfiles.hotelId,
              courtyardSalesAccountProfiles.normalizedAccountKey,
            ],
            set: { updatedBy: req.salesUser.id, updatedAt: new Date() },
          })
          .returning();
        const [saved] = await db
          .insert(courtyardSalesAccountNotes)
          .values({ profileId: profile.id, note, createdBy: req.salesUser.id })
          .returning();
        res.status(201).json({ note: saved });
      } catch (e) {
        next(e);
      }
    },
  );
  router.get("/crm", async (req: any, res, next) => {
    try {
      const hotelId = String(req.query.hotelId || "");
      if (!hasHotel(req, hotelId))
        return res
          .status(403)
          .json({ error: "You do not have access to that property." });
      const [opportunities, activities] = await Promise.all([
        db
          .select()
          .from(courtyardSalesOpportunities)
          .where(eq(courtyardSalesOpportunities.hotelId, hotelId))
          .orderBy(
            asc(courtyardSalesOpportunities.nextActionAt),
            desc(courtyardSalesOpportunities.updatedAt),
          ),
        db
          .select()
          .from(courtyardSalesActivities)
          .where(eq(courtyardSalesActivities.hotelId, hotelId))
          .orderBy(desc(courtyardSalesActivities.createdAt))
          .limit(100),
      ]);
      const now = Date.now();
      const queue = opportunities
        .filter((row) => !["definite", "lost"].includes(row.stage))
        .map((row) => ({
          ...row,
          overdue: row.nextActionAt
            ? new Date(row.nextActionAt).getTime() < now
            : false,
        }))
        .sort(
          (a, b) =>
            Number(b.overdue) - Number(a.overdue) ||
            new Date(a.nextActionAt || "2999-01-01").getTime() -
              new Date(b.nextActionAt || "2999-01-01").getTime(),
        );
      res.json({ opportunities, activities, queue });
    } catch (e) {
      next(e);
    }
  });
  router.post("/opportunities", express.json(), async (req: any, res, next) => {
    try {
      const hotelId = String(req.body.hotelId || "");
      if (!hasHotel(req, hotelId))
        return res
          .status(403)
          .json({ error: "You do not have access to that property." });
      const stage = String(req.body.stage || "prospect");
      if (!OPPORTUNITY_STAGES.includes(stage))
        return res.status(400).json({ error: "Choose a valid sales stage." });
      const accountName = String(req.body.accountName || "").trim();
      const accountKey = String(req.body.normalizedAccountKey || "").trim();
      if (!accountName || !accountKey)
        return res.status(400).json({ error: "Choose an account." });
      const [row] = await db
        .insert(courtyardSalesOpportunities)
        .values({
          hotelId,
          normalizedAccountKey: accountKey,
          accountName,
          stage,
          arrivalDate: req.body.arrivalDate || null,
          departureDate: req.body.departureDate || null,
          estimatedRoomNights: String(
            Number(req.body.estimatedRoomNights || 0),
          ),
          estimatedRevenue: String(Number(req.body.estimatedRevenue || 0)),
          marketSegment:
            String(req.body.marketSegment || "").slice(0, 120) || null,
          nextAction: String(req.body.nextAction || "").slice(0, 500) || null,
          nextActionAt: parseDateOrNull(req.body.nextActionAt),
          notes: String(req.body.notes || "").slice(0, 4000) || null,
          ownerUserId: req.salesUser.id,
          createdBy: req.salesUser.id,
        })
        .returning();
      res.status(201).json({ opportunity: row });
    } catch (e) {
      next(e);
    }
  });
  router.patch(
    "/opportunities/:id",
    express.json(),
    async (req: any, res, next) => {
      try {
        const [existing] = await db
          .select()
          .from(courtyardSalesOpportunities)
          .where(eq(courtyardSalesOpportunities.id, req.params.id))
          .limit(1);
        if (!existing || !hasHotel(req, existing.hotelId))
          return res.status(404).json({ error: "Opportunity not found." });
        const stage = String(req.body.stage || existing.stage);
        if (!OPPORTUNITY_STAGES.includes(stage))
          return res.status(400).json({ error: "Choose a valid sales stage." });
        const [row] = await db
          .update(courtyardSalesOpportunities)
          .set({
            stage,
            nextAction:
              req.body.nextAction === undefined
                ? existing.nextAction
                : String(req.body.nextAction || "").slice(0, 500) || null,
            nextActionAt:
              req.body.nextActionAt === undefined
                ? existing.nextActionAt
                : parseDateOrNull(req.body.nextActionAt),
            estimatedRoomNights:
              req.body.estimatedRoomNights === undefined
                ? existing.estimatedRoomNights
                : String(Number(req.body.estimatedRoomNights || 0)),
            estimatedRevenue:
              req.body.estimatedRevenue === undefined
                ? existing.estimatedRevenue
                : String(Number(req.body.estimatedRevenue || 0)),
            updatedAt: new Date(),
          })
          .where(eq(courtyardSalesOpportunities.id, existing.id))
          .returning();
        res.json({ opportunity: row });
      } catch (e) {
        next(e);
      }
    },
  );
  router.post("/activities", express.json(), async (req: any, res, next) => {
    try {
      const hotelId = String(req.body.hotelId || "");
      if (!hasHotel(req, hotelId))
        return res
          .status(403)
          .json({ error: "You do not have access to that property." });
      const activityType = String(req.body.activityType || "");
      if (!ACTIVITY_TYPES.includes(activityType))
        return res.status(400).json({ error: "Choose a valid activity type." });
      const accountName = String(req.body.accountName || "").trim();
      const accountKey = String(req.body.normalizedAccountKey || "").trim();
      if (!accountName || !accountKey)
        return res.status(400).json({ error: "Choose an account." });
      const [row] = await db
        .insert(courtyardSalesActivities)
        .values({
          hotelId,
          normalizedAccountKey: accountKey,
          accountName,
          opportunityId: req.body.opportunityId || null,
          activityType,
          outcome: String(req.body.outcome || "").slice(0, 250) || null,
          details: String(req.body.details || "").slice(0, 4000) || null,
          nextFollowUpAt: parseDateOrNull(req.body.nextFollowUpAt),
          createdBy: req.salesUser.id,
        })
        .returning();
      if (req.body.opportunityId && req.body.nextFollowUpAt)
        await db
          .update(courtyardSalesOpportunities)
          .set({
            nextAction: "Follow up after logged activity",
            nextActionAt: parseDateOrNull(req.body.nextFollowUpAt),
            updatedAt: new Date(),
          })
          .where(eq(courtyardSalesOpportunities.id, req.body.opportunityId));
      res.status(201).json({ activity: row });
    } catch (e) {
      next(e);
    }
  });
  router.get("/weekly-report", async (req: any, res, next) => {
    try {
      const hotelId = String(req.query.hotelId || ""),
        weekStart = String(req.query.weekStart || "");
      if (!hasHotel(req, hotelId))
        return res
          .status(403)
          .json({ error: "You do not have access to that property." });
      const { start, end } = weekBounds(weekStart);
      const [saved, activities, opportunities] = await Promise.all([
        db
          .select()
          .from(courtyardSalesWeeklyReports)
          .where(
            and(
              eq(courtyardSalesWeeklyReports.hotelId, hotelId),
              eq(courtyardSalesWeeklyReports.weekStart, weekStart),
            ),
          )
          .limit(1),
        db
          .select()
          .from(courtyardSalesActivities)
          .where(
            and(
              eq(courtyardSalesActivities.hotelId, hotelId),
              gte(courtyardSalesActivities.createdAt, start),
              lt(courtyardSalesActivities.createdAt, end),
            ),
          ),
        db
          .select()
          .from(courtyardSalesOpportunities)
          .where(
            and(
              eq(courtyardSalesOpportunities.hotelId, hotelId),
              gte(courtyardSalesOpportunities.createdAt, start),
              lt(courtyardSalesOpportunities.createdAt, end),
            ),
          ),
      ]);
      res.json({
        report: saved[0] || null,
        metrics: activityMetrics(activities, opportunities),
        activities,
        opportunities,
      });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });
  router.put("/weekly-report", express.json(), async (req: any, res, next) => {
    try {
      const hotelId = String(req.body.hotelId || ""),
        weekStart = String(req.body.weekStart || "");
      if (!hasHotel(req, hotelId))
        return res
          .status(403)
          .json({ error: "You do not have access to that property." });
      weekBounds(weekStart);
      const narrative =
        req.body.narrative && typeof req.body.narrative === "object"
          ? Object.fromEntries(
              Object.entries(req.body.narrative).map(([k, v]) => [
                k,
                String(v || "").slice(0, 6000),
              ]),
            )
          : {};
      const status = req.body.status === "submitted" ? "submitted" : "draft";
      const [row] = await db
        .insert(courtyardSalesWeeklyReports)
        .values({
          hotelId,
          weekStart,
          status,
          narrativeJson: narrative,
          submittedAt: status === "submitted" ? new Date() : null,
          updatedBy: req.salesUser.id,
        })
        .onConflictDoUpdate({
          target: [
            courtyardSalesWeeklyReports.hotelId,
            courtyardSalesWeeklyReports.weekStart,
          ],
          set: {
            status,
            narrativeJson: narrative,
            submittedAt: status === "submitted" ? new Date() : null,
            updatedBy: req.salesUser.id,
            updatedAt: new Date(),
          },
        })
        .returning();
      res.json({ report: row });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });
  router.get("/weekly-report.pdf", async (req: any, res, next) => {
    try {
      const hotelId = String(req.query.hotelId || ""),
        weekStart = String(req.query.weekStart || "");
      if (!hasHotel(req, hotelId))
        return res
          .status(403)
          .json({ error: "You do not have access to that property." });
      const { start, end } = weekBounds(weekStart);
      const [hotelRows, reports, activities, opportunities] = await Promise.all(
        [
          db
            .select()
            .from(courtyardHotels)
            .where(eq(courtyardHotels.id, hotelId))
            .limit(1),
          db
            .select()
            .from(courtyardSalesWeeklyReports)
            .where(
              and(
                eq(courtyardSalesWeeklyReports.hotelId, hotelId),
                eq(courtyardSalesWeeklyReports.weekStart, weekStart),
              ),
            )
            .limit(1),
          db
            .select()
            .from(courtyardSalesActivities)
            .where(
              and(
                eq(courtyardSalesActivities.hotelId, hotelId),
                gte(courtyardSalesActivities.createdAt, start),
                lt(courtyardSalesActivities.createdAt, end),
              ),
            ),
          db
            .select()
            .from(courtyardSalesOpportunities)
            .where(
              and(
                eq(courtyardSalesOpportunities.hotelId, hotelId),
                gte(courtyardSalesOpportunities.createdAt, start),
                lt(courtyardSalesOpportunities.createdAt, end),
              ),
            ),
        ],
      );
      const metrics = activityMetrics(activities, opportunities),
        narrative: any = reports[0]?.narrativeJson || {};
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica),
        bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      let page = pdf.addPage([612, 792]),
        y = 748;
      const draw = (text: string, size = 10, isBold = false) => {
        for (const line of wrapText(text, size >= 16 ? 55 : 92)) {
          if (y < 55) {
            page = pdf.addPage([612, 792]);
            y = 748;
          }
          page.drawText(line, {
            x: 48,
            y,
            size,
            font: isBold ? bold : font,
            color: rgb(0.12, 0.09, 0.07),
          });
          y -= size + 5;
        }
      };
      draw(hotelRows[0]?.name || "Courtyard", 18, true);
      draw(`Weekly Sales Report | Week of ${weekStart}`, 14, true);
      y -= 6;
      draw(
        `Activities: ${metrics.totalActivities}   Calls: ${metrics.byType.call || 0}   Emails: ${metrics.byType.email || 0}   Meetings/Site Tours: ${(metrics.byType.meeting || 0) + (metrics.byType.site_tour || 0)}`,
        10,
        true,
      );
      draw(
        `New Opportunities: ${metrics.newOpportunities}   Pipeline Room Nights: ${metrics.pipelineRoomNights}   Pipeline Revenue: $${metrics.pipelineRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
        10,
        true,
      );
      y -= 10;
      for (const [label, key] of [
        ["Weekly Accomplishments", "accomplishments"],
        ["Major Wins", "wins"],
        ["Challenges / Lost Business", "challenges"],
        ["Competitor Information", "competitorInfo"],
        ["Community / Networking", "networking"],
        ["Priorities for Next Week", "nextWeekPriorities"],
        ["Support Needed from GM", "supportNeeded"],
      ]) {
        draw(label, 12, true);
        draw(narrative[key] || "Not entered.");
        y -= 7;
      }
      const bytes = await pdf.save();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="weekly-sales-report-${weekStart}.pdf"`,
      );
      res.send(Buffer.from(bytes));
    } catch (e) {
      next(e);
    }
  });
  router.delete("/imports/:id", async (req: any, res, next) => {
    try {
      if (!admin(req.salesUser))
        return res
          .status(403)
          .json({ error: "Manager access is required to delete imports." });
      const [batch] = await db
        .select()
        .from(courtyardSalesImportBatches)
        .where(eq(courtyardSalesImportBatches.id, req.params.id))
        .limit(1);
      if (!batch || !hasHotel(req, batch.hotelId))
        return res.status(404).json({ error: "Import not found." });
      await db
        .delete(courtyardSalesImportBatches)
        .where(eq(courtyardSalesImportBatches.id, batch.id));
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });
  app.use("/api/courtyard/sales-intelligence", router);
}
