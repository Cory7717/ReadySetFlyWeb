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
  parseSalesImport,
  recoveryPriority,
} from "../courtyardSalesImport";

const DEFAULT_HOTEL_ID = "courtyard-austin-lakeline";
const RECOVERY_MONTHS = 3;
const GROUP_REPORT_TYPE = "marriott_mint_group_account_tracking";
const SPECIAL_REPORT_TYPE = "marriott_mint_special_corp_government";
const ALL_MARKET_REPORT_TYPE = "marriott_mint_all_market_segments";
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
  limits: { fileSize: MAX_SALES_IMPORT_BYTES, files: 1 },
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
    if (!hotels.length && admin(user)) {
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
      };
      map.set(r.normalizedAccountKey, a);
    }
    a.roomNights += n(r.roomNights);
    a.roomRevenue += n(r.roomRevenue);
    a.losNumerator += n(r.averageLos) * n(r.roomNights);
    a.bookingOffices.add(r.bookingOffice);
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
      const p = parseSalesImport(req.file.buffer);
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
        suggestedReportType:
          segments.size > 2
            ? ALL_MARKET_REPORT_TYPE
            : [...segments].some(
                  (value) =>
                    value.includes("special corp") || value.includes("govt"),
                )
              ? SPECIAL_REPORT_TYPE
              : GROUP_REPORT_TYPE,
        preview: p.accepted.slice(0, 5).map((r) => ({
          account: r.globalUltimateAccountName || r.accountName,
          bookingOffice: r.bookingOffice,
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
      const sourceReportType = String(req.body.reportType || "");
      const reportYear = Number(req.body.reportYear),
        reportMonth = Number(req.body.reportMonth),
        replace = String(req.body.replace) === "true";
      if (!hasHotel(req, hotelId))
        return res
          .status(403)
          .json({ error: "You do not have access to that property." });
      if (
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
      const p = parseSalesImport(req.file.buffer);
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
        await db.insert(courtyardSalesProduction).values(
          p.accepted.map((r) => ({
            importBatchId: batch.id,
            hotelId,
            reportYear,
            reportMonth,
            globalUltimateAccountName: r.globalUltimateAccountName || null,
            highestLevelAccountId: r.highestLevelAccountId || null,
            accountName: r.accountName || null,
            accountId: r.accountId || null,
            accountType: r.accountType || null,
            marketCategory: r.marketCategory || null,
            marketSegment: r.marketSegment || null,
            rateProgramCode: r.rateProgramCode || null,
            rateProgram: r.rateProgram || null,
            bookingOffice: r.bookingOffice || null,
            roomNights: String(r.roomNights),
            roomRevenue: String(r.roomRevenue),
            roomAdr: String(r.roomAdr),
            totalRevenue: String(r.totalRevenue),
            totalAdr: String(r.totalAdr),
            averageLos: String(r.averageLos),
            fees: String(r.fees),
            taxes: String(r.taxes),
            addOns: String(r.addOns),
            sourceRowNumber: r.sourceRowNumber,
            normalizedAccountKey: r.normalizedAccountKey,
            normalizedRowHash: r.normalizedRowHash,
          })),
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
      const active = batches.filter((b) => b.status === "completed");
      const batchIds = active.map((b) => b.id);
      const rows = batchIds.length
        ? await db
            .select()
            .from(courtyardSalesProduction)
            .where(inArray(courtyardSalesProduction.importBatchId, batchIds))
        : [];
      const batchById = new Map(active.map((batch) => [batch.id, batch]));
      const groupRows = rows.filter(
        (row) =>
          batchById.get(row.importBatchId)?.sourceReportType !==
          SPECIAL_REPORT_TYPE,
      );
      const specialRows = rows.filter(
        (row) =>
          batchById.get(row.importBatchId)?.sourceReportType ===
          SPECIAL_REPORT_TYPE,
      );
      const allMarketRows = rows.filter(
        (row) =>
          batchById.get(row.importBatchId)?.sourceReportType ===
          ALL_MARKET_REPORT_TYPE,
      );
      const marketSegments = [
        ...new Set(
          allMarketRows.map(
            (row) =>
              String(row.marketSegment || "Unspecified").trim() ||
              "Unspecified",
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
        ...summarize(allMarketRows).map((account) => ({
          ...account,
          reportCategory: "total",
          recurring: account.history.length >= 2,
        })),
        ...marketSegments.flatMap((segment) =>
          summarize(
            allMarketRows.filter(
              (row) =>
                (String(row.marketSegment || "Unspecified").trim() ||
                  "Unspecified") === segment,
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
      for (const a of accounts) {
        const monthsSince = latest === null ? 0 : latest - a.lastPeriod;
        a.monthsSinceLast = monthsSince;
        a.status =
          monthsSince >= RECOVERY_MONTHS ? "Potential Recovery" : "Active";
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
      res.json({
        periods,
        latestPeriod: latest,
        accounts,
        marketSegments,
        imports: batches.map((b) => ({
          ...b,
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
