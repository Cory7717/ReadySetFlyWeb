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
  courtyardSalesAdvisorAnalyses,
  courtyardSalesMonthlyTargets,
  courtyardSalesDemandEvents,
  courtyardSalesRegionalProspects,
  courtyardSalesAccountProfiles,
  courtyardSalesActivities,
  courtyardSalesImportBatches,
  courtyardSalesProduction,
  courtyardSalesRawRows,
  courtyardSalesOpportunities,
  courtyardSalesWeeklyReports,
  courtyardSalesTransitions,
  courtyardSalesTransitionItems,
  courtyardSalesTransitionDocuments,
  courtyardSalesTransitionShares,
  courtyardMeetingSpaces,
  courtyardMeetingEvents,
  courtyardMeetingEventDocuments,
  courtyardMeetingCalendarShares,
  courtyardGroupRoomBlocks,
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
import {
  SALES_ADVISOR_ANALYSIS_TYPES,
  SALES_ADVISOR_BUSINESS_TYPES,
  SALES_ADVISOR_PROMPT_VERSION,
  buildSalesAdvisorPreview,
  buildMonthlySalesTargets,
  compactAdvisorContext,
  salesAdvisorFingerprint,
} from "../courtyardSalesAdvisor";
import { generateSalesAdvisorAssistance, generateSalesAdvisorNarrative } from "../courtyardSalesAdvisorAi";
import { salesAdvisorModel } from "../openaiClient";
import {
  discoverRegionalBusinesses,
  fetchRegionalBusinessContactDetails,
  prospectScore,
  targetRoles,
} from "../courtyardSalesDemand";
import { researchDemandEvents } from "../courtyardSalesDemandResearch";
import { mergeDatScreenshotImports, parseDatScreenshot, parseDatWorkbook } from "../courtyardSalesDatImport";

const DEFAULT_HOTEL_ID = "courtyard-austin-lakeline";
const SHARED_SALES_PIN = "12833";
const RECOVERY_MONTHS = 3;
const GROUP_REPORT_TYPE = "marriott_mint_group_account_tracking";
const SPECIAL_REPORT_TYPE = "marriott_mint_special_corp_government";
const ALL_MARKET_REPORT_TYPE = "marriott_mint_all_market_segments";
const STAY_MARKET_REPORT_TYPE = "stay_revenue_by_market_segment_with_groups";
const STAY_GROUP_SUMMARY_REPORT_TYPE = "stay_group_summary";
const STAY_RESERVATIONS_REPORT_TYPE = "stay_reservations_company_names";
const DAT_SCREENSHOT_REPORT_TYPE = "marriott_dat_analytical_demand_screenshot";
const DAT_EXCEL_REPORT_TYPE = "marriott_dat_analytical_demand_excel";
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
  [DAT_SCREENSHOT_REPORT_TYPE]: {
    system: "DAT",
    label: "Analytical Demand Screenshot",
    purpose: "Hotel Production",
  },
  [DAT_EXCEL_REPORT_TYPE]: {
    system: "DAT",
    label: "Analytical Demand Excel Export",
    purpose: "Hotel Production",
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
const TRANSITION_CATEGORIES = ["system", "account", "opportunity", "responsibility", "contact", "knowledge", "deadline"];
const TRANSITION_ITEM_STATUSES = ["not_started", "in_progress", "ready_for_review", "complete", "needs_follow_up"];
const TRANSITION_STATUSES = ["in_progress", "complete", "cancelled"];
function validDateOnly(value: unknown) {
  if (!value) return true;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}
function validEmail(value: unknown) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SALES_IMPORT_BYTES, files: 3 },
});
const transitionUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
const transitionTokenHash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
function safeTransitionUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new Error("Enter a complete link beginning with http:// or https://."); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Transition links must use http or https.");
  return parsed.toString();
}
function transitionCredentialKey() {
  const secret = process.env.SALES_TRANSITION_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret) throw new Error("Transition credential encryption is not configured.");
  return crypto.createHash("sha256").update(secret).digest();
}
function encryptTransitionPassword(value: unknown) {
  const password = String(value || "");
  if (!password) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", transitionCredentialKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return { password: { version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") } };
}
function decryptTransitionPassword(metadata: any) {
  try {
    const payload = metadata?.password;
    if (!payload?.iv || !payload?.tag || !payload?.data) return "";
    const decipher = crypto.createDecipheriv("aes-256-gcm", transitionCredentialKey(), Buffer.from(payload.iv, "base64"));
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]).toString("utf8");
  } catch { return ""; }
}
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
const canManageMeetingCalendar = (req: any) =>
  admin(req.salesUser) || Boolean(req.session?.salesIntelligenceUnlocked);
function meetingEventWriteValues(body: any, holdExpiresAt: Date | null, eventDays = 1) {
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    createdByUserId: _createdByUserId,
    updatedByUserId: _updatedByUserId,
    eventEndDate: _eventEndDate,
    ...formValues
  } = body || {};
  const revenueFields = ["roomRentalRevenue", "avRevenue", "otherRevenue"];
  const revenue = Object.fromEntries(revenueFields.map((field) => [field, Number(body?.[field] || 0).toFixed(2)]));
  const breakfastPerPerson = Number(body?.breakfastPerPerson || 0);
  const lunchDinnerPerPerson = Number(body?.lunchDinnerPerPerson || 0);
  const cateringRevenue = Number(body?.attendance || 0) * eventDays * (breakfastPerPerson + lunchDinnerPerPerson);
  const roomTaxPercent = 6, roomServiceFeePercent = 21, fbTaxPercent = 8.25, fbGratuityPercent = 18;
  const roomRental = Number(body?.roomRentalRevenue || 0);
  const fbSubtotal = cateringRevenue + Number(body?.otherRevenue || 0);
  const expectedRevenue = (roomRental + (roomRental * roomTaxPercent / 100) + (roomRental * roomServiceFeePercent / 100) + fbSubtotal + (fbSubtotal * fbTaxPercent / 100) + (fbSubtotal * fbGratuityPercent / 100) + Number(body?.avRevenue || 0)).toFixed(2);
  return {
    ...formValues,
    ...revenue,
    cateringRevenue: cateringRevenue.toFixed(2),
    breakfastPerPerson: breakfastPerPerson.toFixed(2),
    lunchDinnerPerPerson: lunchDinnerPerPerson.toFixed(2),
    roomTaxPercent: roomTaxPercent.toFixed(3),
    roomServiceFeePercent: roomServiceFeePercent.toFixed(3),
    fbTaxPercent: fbTaxPercent.toFixed(3),
    fbGratuityPercent: fbGratuityPercent.toFixed(3),
    holdExpiresAt,
    opportunityId: String(body?.opportunityId || "").trim() || null,
    accountKey: String(body?.accountKey || "").trim() || null,
    expectedRevenue,
  };
}
function meetingRevenueValidationError(body: any) {
  for (const field of ["roomRentalRevenue", "avRevenue", "otherRevenue", "breakfastPerPerson", "lunchDinnerPerPerson"]) {
    const value = Number(body?.[field] || 0);
    if (!Number.isFinite(value) || value < 0 || value > 9999999999) return "Revenue amounts must be valid non-negative numbers.";
  }
  if (body?.meetingRoom && !["pecan", "cedar", "full_room"].includes(String(body.meetingRoom))) return "Choose a valid meeting room.";
  return null;
}
const GROUP_ROOM_STATUSES = ["prospect", "tentative", "definite", "in_house", "completed", "cancelled"];
function groupRoomWriteValues(body: any) {
  const peakRooms = body?.peakRooms === "" || body?.peakRooms == null ? null : Number(body.peakRooms);
  const totalRoomNights = body?.totalRoomNights === "" || body?.totalRoomNights == null ? null : Number(body.totalRoomNights);
  const groupRate = body?.groupRate === "" || body?.groupRate == null ? null : Number(body.groupRate);
  const depositAmount = body?.depositAmount === "" || body?.depositAmount == null ? null : Number(body.depositAmount);
  return {
    groupName: String(body?.groupName || "").trim(), projectName: String(body?.projectName || "").trim() || null,
    arrivalDate: body.arrivalDate, departureDate: body.departureDate, status: String(body?.status || "prospect"),
    peakRooms, totalRoomNights, roomTypeMix: String(body?.roomTypeMix || "").trim() || null,
    groupRate: groupRate == null ? null : groupRate.toFixed(2), estimatedRoomRevenue: groupRate == null || totalRoomNights == null ? null : (groupRate * totalRoomNights).toFixed(2),
    bookingMethod: String(body?.bookingMethod || "").trim() || null, cutoffDate: body?.cutoffDate || null, groupCode: String(body?.groupCode || "").trim() || null, taxExempt: Boolean(body?.taxExempt),
    primaryContactName: String(body?.primaryContactName || "").trim() || null, primaryContactEmail: String(body?.primaryContactEmail || "").trim() || null, primaryContactPhone: String(body?.primaryContactPhone || "").trim() || null, salesOwner: String(body?.salesOwner || "").trim() || null,
    billingInstructions: String(body?.billingInstructions || "").trim() || null, depositDueDate: body?.depositDueDate || null, depositAmount: depositAmount == null ? null : depositAmount.toFixed(2),
    arrivalNotes: String(body?.arrivalNotes || "").trim() || null, vipNotes: String(body?.vipNotes || "").trim() || null, transportationNotes: String(body?.transportationNotes || "").trim() || null, breakfastNotes: String(body?.breakfastNotes || "").trim() || null,
    frontDeskNotes: String(body?.frontDeskNotes || "").trim() || null, housekeepingNotes: String(body?.housekeepingNotes || "").trim() || null, internalNotes: String(body?.internalNotes || "").trim() || null,
  };
}
function groupRoomValidationError(body: any) {
  if (!String(body?.groupName || "").trim()) return "Group/company is required.";
  if (!validDateOnly(body?.arrivalDate) || !validDateOnly(body?.departureDate)) return "Enter valid arrival and departure dates.";
  if (body.departureDate <= body.arrivalDate) return "Departure must be after arrival.";
  if (!GROUP_ROOM_STATUSES.includes(String(body?.status || ""))) return "Choose a valid group status.";
  for (const field of ["peakRooms", "totalRoomNights"]) { const value = body?.[field]; if (value !== "" && value != null && (!Number.isInteger(Number(value)) || Number(value) < 0)) return "Room counts must be non-negative whole numbers."; }
  for (const field of ["groupRate", "depositAmount"]) { const value = body?.[field]; if (value !== "" && value != null && (!Number.isFinite(Number(value)) || Number(value) < 0)) return "Rates and deposits must be valid non-negative amounts."; }
  return null;
}
async function auth(req: any, res: any, next: any) {
  try {
    const id = req.session?.tipsUserId;
    if (!id && req.session?.salesIntelligenceUnlocked) {
      const hotels = await db.select().from(courtyardHotels).where(eq(courtyardHotels.id, DEFAULT_HOTEL_ID));
      if (!hotels.length) return res.status(503).json({ error: "The Sales Intelligence property is not configured." });
      req.salesUser = { id: null, email: "sultan@globiwest.com", employeeDisplayName: "Regional VP", role: "regional_viewer", toolAccessJson: { salesintelligence: true } };
      req.salesHotels = hotels;
      req.salesPinAccess = true;
      return next();
    }
    if (!id)
      return res.status(401).json({ error: "Courtyard login is required." });
    const [user] = await db
      .select()
      .from(tipsUsers)
      .where(eq(tipsUsers.id, String(id)))
      .limit(1);
    if (!user || user.disabledAt || user.mustChangePassword)
      return res.status(401).json({ error: "Courtyard login is required." });
    if (!allowed(user) && req.session?.salesIntelligenceUnlocked) {
      const hotels = await db.select().from(courtyardHotels).where(eq(courtyardHotels.id, DEFAULT_HOTEL_ID));
      if (!hotels.length) return res.status(503).json({ error: "The Sales Intelligence property is not configured." });
      req.salesUser = { id: null, email: "shared-access@readysetfly.us", employeeDisplayName: "Shared PIN User", role: "shared_viewer", toolAccessJson: { salesintelligence: true } };
      req.salesHotels = hotels;
      req.salesPinAccess = true;
      return next();
    }
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
        lastStayDate: null,
      };
      map.set(r.normalizedAccountKey, a);
    }
    a.roomNights += n(r.roomNights);
    a.roomRevenue += n(r.roomRevenue);
    a.losNumerator += n(r.averageLos) * n(r.roomNights);
    a.bookingOffices.add(r.bookingOffice);
    if (
      r.stayDepartureDate &&
      (!a.lastStayDate || r.stayDepartureDate > a.lastStayDate)
    )
      a.lastStayDate = r.stayDepartureDate;
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

function advisorParameters(input: any) {
  const lookbackMonths = [12, 24, 36].includes(Number(input.lookbackMonths))
    ? Number(input.lookbackMonths)
    : 24;
  const analysisType = SALES_ADVISOR_ANALYSIS_TYPES.includes(input.analysisType)
    ? input.analysisType
    : "full_plan";
  const requestedTypes = Array.isArray(input.businessTypes)
    ? input.businessTypes
    : String(input.businessTypes || "")
        .split(",")
        .filter(Boolean);
  const businessTypes = requestedTypes.filter((value: string) =>
    SALES_ADVISOR_BUSINESS_TYPES.includes(value as any),
  );
  return {
    lookbackMonths,
    analysisType,
    businessTypes: businessTypes.length
      ? businessTypes
      : [...SALES_ADVISOR_BUSINESS_TYPES],
  };
}

function monthlyTargetPeriod(input: any) {
  const targetYear = Number(input.targetYear);
  const targetMonth = Number(input.targetMonth);
  if (!Number.isInteger(targetYear) || targetYear < 2020 || targetYear > 2100)
    throw new Error("Choose a valid target year.");
  if (!Number.isInteger(targetMonth) || targetMonth < 1 || targetMonth > 12)
    throw new Error("Choose a valid target month.");
  return { targetYear, targetMonth };
}

async function advisorSourceData(hotelId: string) {
  const batches = await db
    .select()
    .from(courtyardSalesImportBatches)
    .where(eq(courtyardSalesImportBatches.hotelId, hotelId));
  const active = batches.filter((batch) => batch.status === "completed");
  const ids = active.map((batch) => batch.id);
  const rows = ids.length
    ? await db
        .select()
        .from(courtyardSalesProduction)
        .where(inArray(courtyardSalesProduction.importBatchId, ids))
    : [];
  return { batches: active, rows };
}

async function createAdvisorPdf(analysis: any, hotelName: string) {
  const preview = analysis.inputSnapshotJson || {};
  const result = analysis.resultJson || {};
  const candidates = preview.candidates || [];
  const priorityByKey = new Map(
    (result.priorities || []).map((item: any) => [item.accountKey, item]),
  );
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.184, 0.373, 0.275);
  const dark = rgb(0.125, 0.094, 0.078);
  const tan = rgb(0.969, 0.945, 0.906);
  const line = rgb(0.804, 0.741, 0.659);
  const muted = rgb(0.373, 0.322, 0.278);
  let page: any;
  let y = 0;
  const pages: any[] = [];
  const addPage = () => {
    page = pdf.addPage([612, 792]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: 710, width: 612, height: 82, color: green });
    page.drawText(String(hotelName || "Courtyard Hotel").toUpperCase(), {
      x: 42, y: 765, size: 9, font: bold, color: rgb(0.91, 0.85, 0.72),
    });
    page.drawText("DIRECTOR OF SALES ACTION PLAN", {
      x: 42, y: 737, size: 20, font: bold, color: rgb(1, 1, 1),
    });
    page.drawText(`Prepared ${new Date(analysis.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, {
      x: 430, y: 765, size: 8, font: regular, color: rgb(1, 1, 1),
    });
    y = 682;
  };
  const ensure = (height: number) => {
    if (y - height < 48) addPage();
  };
  const paragraph = (text: string, options: any = {}) => {
    const size = options.size || 9.5;
    const max = options.max || 94;
    const lines = wrapText(String(text || ""), max);
    ensure(lines.length * (size + 4) + 4);
    for (const item of lines) {
      page.drawText(item, { x: options.x || 42, y, size, font: options.bold ? bold : regular, color: options.color || dark });
      y -= size + 4;
    }
    y -= options.after ?? 3;
  };
  const section = (title: string, subtitle?: string) => {
    ensure(subtitle ? 54 : 34);
    y -= 5;
    page.drawText(title.toUpperCase(), { x: 42, y, size: 12, font: bold, color: green });
    page.drawRectangle({ x: 42, y: y - 8, width: 528, height: 1, color: line });
    y -= 22;
    if (subtitle) paragraph(subtitle, { size: 8.5, color: muted, after: 7 });
  };
  addPage();
  const through = preview.generatedThrough
    ? new Date(Date.UTC(preview.generatedThrough.year, preview.generatedThrough.month - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    : "Latest imported month";
  paragraph(`Planning window: Last ${preview.lookbackMonths || analysis.lookbackMonths} months through ${through}  |  Focus: ${String(analysis.analysisType || "full plan").replace(/_/g, " ")}`, { size: 9, color: muted, after: 10 });
  section("Executive Direction");
  paragraph(result.executiveSummary || "Production history has been ranked to identify the strongest onsite sales priorities.", { size: 10.5, max: 88, after: 10 });

  const metrics = [
    ["PROSPECTS REVIEWED", preview.summary?.prospectsReviewed || 0],
    ["RECOVERY TARGETS", preview.summary?.recoveryOpportunities || 0],
    ["DECLINING ACCOUNTS", preview.summary?.decliningAccounts || 0],
    ["EST. RECOVERY", `$${Number(preview.summary?.estimatedRecoveryRevenue || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`],
  ];
  ensure(66);
  metrics.forEach(([label, value], index) => {
    const x = 42 + index * 134;
    page.drawRectangle({ x, y: y - 48, width: 124, height: 52, color: tan, borderColor: line, borderWidth: 0.7 });
    page.drawText(String(label), { x: x + 9, y: y - 13, size: 6.8, font: bold, color: muted });
    page.drawText(String(value), { x: x + 9, y: y - 36, size: 15, font: bold, color: dark });
  });
  y -= 68;

  section("Priority Prospect Portfolio", "Ranked from imported named-account production. Scores combine historical value, recoverability, timing, and current production status.");
  for (const [index, candidate] of candidates.slice(0, 10).entries()) {
    const narrative: any = priorityByKey.get(candidate.key);
    const rationale = narrative?.rationale || `${candidate.status}; ${candidate.confidence} confidence.`;
    const action = narrative?.planningNote || "Review account history, identify the decision maker, and determine the best outreach approach.";
    const needed = 100 + wrapText(rationale, 82).length * 11 + wrapText(action, 82).length * 11;
    ensure(needed);
    const top = y;
    page.drawRectangle({ x: 42, y: top - needed + 8, width: 528, height: needed, color: index % 2 ? rgb(1, 1, 1) : tan, borderColor: line, borderWidth: 0.6 });
    page.drawRectangle({ x: 42, y: top - needed + 8, width: 7, height: needed, color: green });
    page.drawText(`#${index + 1}`, { x: 60, y: top - 20, size: 9, font: bold, color: green });
    page.drawText(String(candidate.name).slice(0, 58), { x: 89, y: top - 20, size: 12, font: bold, color: dark });
    page.drawText(`PRIORITY ${candidate.scores.overall}`, { x: 482, y: top - 20, size: 7.5, font: bold, color: green });
    y = top - 39;
    paragraph(`${candidate.businessType}  |  ${candidate.status}  |  ${candidate.confidence} confidence  |  ${candidate.productionBasis} production basis`, { x: 60, size: 8, color: muted, max: 90, after: 2 });
    paragraph(`${Number(candidate.totalRoomNights).toLocaleString()} historical room nights  |  $${Number(candidate.totalRevenue).toLocaleString("en-US", { maximumFractionDigits: 0 })} historical revenue  |  $${Number(candidate.estimatedRecoveryRevenue).toLocaleString("en-US", { maximumFractionDigits: 0 })} estimated opportunity`, { x: 60, size: 8.5, bold: true, max: 88, after: 3 });
    paragraph(rationale, { x: 60, size: 8.7, max: 88, after: 2 });
    paragraph(`RECOMMENDED ACTION: ${action}`, { x: 60, size: 8.5, bold: true, color: green, max: 85, after: 8 });
    y = top - needed - 5;
  }

  section("This Week's Onsite Action Plan", "A practical working sequence for the Director of Sales. Adjust timing around property priorities and customer availability.");
  for (const [index, item] of (result.weeklyPlan || []).entries()) {
    ensure(55);
    page.drawRectangle({ x: 42, y: y - 9, width: 22, height: 22, color: green });
    page.drawText(String(index + 1), { x: 50, y: y - 2, size: 9, font: bold, color: rgb(1, 1, 1) });
    paragraph(`${item.dayOrSequence}: ${item.focus}`, { x: 75, size: 10, bold: true, max: 76, after: 1 });
    paragraph(item.actionPlanEntry || "Complete the planned outreach and retain the result onsite.", { x: 75, size: 9, color: muted, max: 76, after: 8 });
  }

  const limitations = [...(preview.limitations || []), ...(result.additionalLimitations || [])];
  if (limitations.length) {
    section("Data Notes & Planning Guardrails");
    for (const item of limitations) paragraph(`• ${item}`, { x: 50, size: 8.5, color: muted, max: 88, after: 2 });
  }
  pages.forEach((item, index) => {
    item.drawRectangle({ x: 0, y: 0, width: 612, height: 30, color: tan });
    item.drawText("CONFIDENTIAL · ONSITE SALES PLANNING", { x: 42, y: 11, size: 6.8, font: bold, color: muted });
    item.drawText(`Page ${index + 1} of ${pages.length}`, { x: 520, y: 11, size: 7, font: regular, color: muted });
  });
  return pdf.save();
}

async function createMeetingBeoPdf(event: any, seriesEvents: any[], spaceName: string) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const gold = rgb(0.85, 0.55, 0.05), ink = rgb(0.14, 0.14, 0.14), muted = rgb(0.38, 0.36, 0.34), pale = rgb(0.97, 0.96, 0.93), white = rgb(1, 1, 1);
  const dates = seriesEvents.map((item) => item.eventDate).sort();
  const money = (value: any) => `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const roomRental = Number(event.roomRentalRevenue || 0), fbSubtotal = Number(event.cateringRevenue || 0) + Number(event.otherRevenue || 0);
  const roomTax = roomRental * 0.06, roomService = roomRental * 0.21, fbTax = fbSubtotal * 0.0825, fbGratuity = fbSubtotal * 0.18;
  const dateLabel = dates.length > 1 ? `${dates[0]} through ${dates[dates.length - 1]}` : dates[0];
  let page: any, y = 0;
  const addPage = () => {
    page = pdf.addPage([612, 792]); y = 730;
    page.drawText("COURTYARD", { x: 205, y: 746, size: 25, font: bold, color: gold, characterSpacing: 4 });
    page.drawText("BY MARRIOTT", { x: 268, y: 730, size: 8, font: bold, color: gold, characterSpacing: 2 });
    page.drawLine({ start: { x: 46, y: 716 }, end: { x: 566, y: 716 }, thickness: 1.2, color: gold });
    return page;
  };
  const ensure = (height: number) => { if (y - height < 58) addPage(); };
  const section = (title: string) => { ensure(30); page.drawText(title.toUpperCase(), { x: 46, y, size: 12, font: bold, color: gold }); y -= 7; page.drawLine({ start: { x: 46, y }, end: { x: 566, y }, thickness: 1, color: gold }); y -= 18; };
  const row = (label: string, value: any, height = 22) => { ensure(height); page.drawRectangle({ x: 46, y: y - height + 6, width: 520, height, color: pale, borderColor: rgb(0.84, 0.82, 0.78), borderWidth: 0.5 }); page.drawText(label, { x: 54, y: y - 8, size: 8.5, font: bold, color: ink }); const text = String(value ?? "Not specified"); const clipped = text.length > 74 ? `${text.slice(0, 71)}...` : text; page.drawText(clipped, { x: 210, y: y - 8, size: 8.5, font: regular, color: ink }); y -= height; };
  const note = (label: string, value: any) => { if (!value) return; const text = String(value); const lines: string[] = []; let current = ""; for (const word of text.split(/\s+/)) { if (`${current} ${word}`.trim().length > 92) { lines.push(current); current = word; } else current = `${current} ${word}`.trim(); } if (current) lines.push(current); ensure(28 + lines.length * 11); page.drawText(label, { x: 52, y, size: 9, font: bold, color: ink }); y -= 13; for (const line of lines) { page.drawText(line, { x: 52, y, size: 8.5, font: regular, color: muted }); y -= 11; } y -= 7; };
  addPage();
  page.drawText("BANQUET EVENT ORDER", { x: 46, y: 690, size: 20, font: bold, color: ink });
  page.drawText(`${event.groupName}  |  ${dateLabel}`, { x: 46, y: 671, size: 11, font: bold, color: gold });
  page.drawText(`Status: ${String(event.status || "inquiry").replaceAll("_", " ").toUpperCase()}  |  BEO generated ${new Date().toLocaleDateString("en-US")}`, { x: 46, y: 653, size: 8, font: regular, color: muted });
  y = 624;
  section("Event overview");
  row("Event / Project", event.eventName);
  row("Meeting dates", `${dateLabel} (${dates.length} day${dates.length === 1 ? "" : "s"})`);
  row("Meeting room", event.meetingRoom === "pecan" ? "Pecan - 560 sq. ft." : event.meetingRoom === "cedar" ? "Cedar - 1,575 sq. ft." : event.meetingRoom === "full_room" ? "Full Room - 2,135 sq. ft." : spaceName);
  row("Setup / Attendance", `${String(event.roomSetup || "Not specified").replaceAll("_", " ")} / ${event.attendance ?? "Not specified"} attendees per day`);
  section("Operational timeline");
  row("Setup begins", String(event.setupStartTime || "").slice(0, 5)); row("Guest arrival", String(event.guestStartTime || "").slice(0, 5)); row("Guest event ends", String(event.guestEndTime || "").slice(0, 5)); row("Breakdown complete", String(event.breakdownEndTime || "").slice(0, 5));
  section("Catering and services");
  row("Breakfast", `${money(event.breakfastPerPerson)} per person x ${event.attendance || 0} x ${dates.length} day(s)`);
  row("Lunch / Dinner", `${money(event.lunchDinnerPerPerson)} per person x ${event.attendance || 0} x ${dates.length} day(s)`);
  row("Calculated in-house catering", money(event.cateringRevenue)); row("A/V add-ons", money(event.avRevenue)); row("Drink / coffee / incidentals", money(event.otherRevenue));
  note("Catering and incidental details", event.cateringNotes);
  section("Contacts");
  row("Sales owner", event.salesOwner || "Not assigned"); row("Client contact", event.clientName || "Not provided"); row("Email / Phone", [event.clientEmail, event.clientPhone].filter(Boolean).join("  |  ") || "Not provided");
  section("Revenue summary");
  row("Meeting room rental", money(event.roomRentalRevenue)); row("In-house catering", money(event.cateringRevenue)); row("A/V and incidentals", money(Number(event.avRevenue || 0) + Number(event.otherRevenue || 0)));
  row("Meeting room tax (6%)", money(roomTax)); row("Room service fee (21%)", money(roomService)); row("F&B tax (8.25%)", money(fbTax)); row("F&B gratuity (18%)", money(fbGratuity));
  ensure(32); page.drawRectangle({ x: 46, y: y - 24, width: 520, height: 30, color: ink }); page.drawText("TOTAL EVENT REVENUE", { x: 54, y: y - 13, size: 10, font: bold, color: white }); page.drawText(money(event.expectedRevenue), { x: 470, y: y - 13, size: 11, font: bold, color: gold }); y -= 43;
  section("Operational notes");
  note("Internal / setup notes", event.internalNotes); note("Audio / visual", event.avNotes); note("Accessibility", event.accessibilityNotes);
  ensure(90); page.drawText("TEAM CONFIRMATION", { x: 46, y, size: 10, font: bold, color: gold }); y -= 28; page.drawText("Setup completed by: ______________________________   Time: __________", { x: 52, y, size: 9, font: regular, color: ink }); y -= 25; page.drawText("Breakdown completed by: __________________________   Time: __________", { x: 52, y, size: 9, font: regular, color: ink });
  pdf.getPages().forEach((item, index) => { item.drawText("Courtyard by Marriott Austin Northwest/Lakeline  |  12833 Ranch Road 620 N  |  Austin, TX 78750", { x: 46, y: 28, size: 7.5, font: regular, color: muted }); item.drawText(`Page ${index + 1}`, { x: 530, y: 28, size: 8, font: regular, color: muted }); });
  return pdf.save();
}

export function registerCourtyardSalesIntelligenceRoutes(app: Express) {
  const publicRouter = express.Router();
  publicRouter.post("/pin-login", (req: any, res) => {
    const submittedPin = String(req.body?.pin || "");
    const valid = submittedPin.length === SHARED_SALES_PIN.length
      && crypto.timingSafeEqual(Buffer.from(submittedPin), Buffer.from(SHARED_SALES_PIN));
    if (!valid) return res.status(401).json({ error: "Invalid PIN." });
    req.session.salesIntelligenceUnlocked = true;
    req.session.save(() => res.json({ unlocked: true }));
  });
  publicRouter.get("/transition-share/:token", async (req, res, next) => {
    try {
      const [share] = await db.select().from(courtyardSalesTransitionShares).where(eq(courtyardSalesTransitionShares.tokenHash, transitionTokenHash(req.params.token))).limit(1);
      if (!share || share.revokedAt || new Date(share.expiresAt) <= new Date()) return res.status(404).json({ error: "This transition link is invalid or expired." });
      const [transition] = await db.select().from(courtyardSalesTransitions).where(eq(courtyardSalesTransitions.id, share.transitionId)).limit(1);
      if (!transition) return res.status(404).json({ error: "Transition not found." });
      const [items, documents] = await Promise.all([
        db.select().from(courtyardSalesTransitionItems).where(and(eq(courtyardSalesTransitionItems.transitionId, transition.id), eq(courtyardSalesTransitionItems.confidential, false))).orderBy(asc(courtyardSalesTransitionItems.category), asc(courtyardSalesTransitionItems.title)),
        db.select({ id: courtyardSalesTransitionDocuments.id, filename: courtyardSalesTransitionDocuments.filename, mimeType: courtyardSalesTransitionDocuments.mimeType, sizeBytes: courtyardSalesTransitionDocuments.sizeBytes, category: courtyardSalesTransitionDocuments.category, description: courtyardSalesTransitionDocuments.description, createdAt: courtyardSalesTransitionDocuments.createdAt }).from(courtyardSalesTransitionDocuments).where(and(eq(courtyardSalesTransitionDocuments.transitionId, transition.id), eq(courtyardSalesTransitionDocuments.confidential, false))),
      ]);
      await db.update(courtyardSalesTransitionShares).set({ lastAccessedAt: new Date(), accessCount: share.accessCount + 1 }).where(eq(courtyardSalesTransitionShares.id, share.id));
      res.json({ transition, items: items.map((item) => ({ ...item, username: null, vaultUrl: null, mfaOwner: null, recoveryContact: null, metadataJson: null })), documents, allowDownloads: share.allowDownloads });
    } catch (e) { next(e); }
  });
  publicRouter.get("/transition-share/:token/documents/:documentId", async (req, res, next) => {
    try {
      const [share] = await db.select().from(courtyardSalesTransitionShares).where(eq(courtyardSalesTransitionShares.tokenHash, transitionTokenHash(req.params.token))).limit(1);
      if (!share || !share.allowDownloads || share.revokedAt || new Date(share.expiresAt) <= new Date()) return res.status(403).json({ error: "Document download is not available." });
      const [document] = await db.select().from(courtyardSalesTransitionDocuments).where(and(eq(courtyardSalesTransitionDocuments.id, req.params.documentId), eq(courtyardSalesTransitionDocuments.transitionId, share.transitionId), eq(courtyardSalesTransitionDocuments.confidential, false))).limit(1);
      if (!document) return res.status(404).json({ error: "Document not found." });
      res.setHeader("Content-Type", document.mimeType); res.setHeader("Content-Disposition", `attachment; filename="${document.filename.replace(/[\r\n"]/g, "_")}"`); res.send(Buffer.from(document.contentBase64, "base64"));
    } catch (e) { next(e); }
  });
  publicRouter.get("/meeting-calendar-share/:token", async (req, res, next) => {
    try { const [share] = await db.select().from(courtyardMeetingCalendarShares).where(eq(courtyardMeetingCalendarShares.tokenHash, transitionTokenHash(req.params.token))).limit(1); if (!share || share.revokedAt || new Date(share.expiresAt) <= new Date()) return res.status(404).json({ error: "This calendar link is invalid or expired." }); const events = await db.select({ id: courtyardMeetingEvents.id, eventDate: courtyardMeetingEvents.eventDate, setupStartTime: courtyardMeetingEvents.setupStartTime, guestStartTime: courtyardMeetingEvents.guestStartTime, guestEndTime: courtyardMeetingEvents.guestEndTime, breakdownEndTime: courtyardMeetingEvents.breakdownEndTime, status: courtyardMeetingEvents.status, roomSetup: courtyardMeetingEvents.roomSetup }).from(courtyardMeetingEvents).where(eq(courtyardMeetingEvents.hotelId, share.hotelId)).orderBy(asc(courtyardMeetingEvents.eventDate), asc(courtyardMeetingEvents.setupStartTime)); const visible = events.filter((event) => (!share.rangeStart || event.eventDate >= share.rangeStart) && (!share.rangeEnd || event.eventDate <= share.rangeEnd) && !["cancelled", "expired"].includes(event.status)); await db.update(courtyardMeetingCalendarShares).set({ accessCount: share.accessCount + 1, lastAccessedAt: new Date() }).where(eq(courtyardMeetingCalendarShares.id, share.id)); res.json({ events: visible.map((event) => ({ ...event, label: "Meeting space occupied" })), expiresAt: share.expiresAt }); } catch (e) { next(e); }
  });
  app.use("/api/courtyard/sales-intelligence", publicRouter);
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
  router.get("/transitions", async (req: any, res, next) => {
    try {
      const hotelId = String(req.query.hotelId || ""); if (!hasHotel(req, hotelId)) return res.status(403).json({ error: "Property access required." });
      const transitions = await db.select().from(courtyardSalesTransitions).where(eq(courtyardSalesTransitions.hotelId, hotelId)).orderBy(desc(courtyardSalesTransitions.createdAt));
      if (!transitions.length) return res.json({ transitions: [], transition: null, items: [], documents: [], shares: [], progress: 0 });
      const transition = transitions[0];
      const [items, documents, shares] = await Promise.all([
        db.select().from(courtyardSalesTransitionItems).where(eq(courtyardSalesTransitionItems.transitionId, transition.id)).orderBy(asc(courtyardSalesTransitionItems.category), asc(courtyardSalesTransitionItems.title)),
        db.select({ id: courtyardSalesTransitionDocuments.id, filename: courtyardSalesTransitionDocuments.filename, mimeType: courtyardSalesTransitionDocuments.mimeType, sizeBytes: courtyardSalesTransitionDocuments.sizeBytes, category: courtyardSalesTransitionDocuments.category, description: courtyardSalesTransitionDocuments.description, confidential: courtyardSalesTransitionDocuments.confidential, createdAt: courtyardSalesTransitionDocuments.createdAt }).from(courtyardSalesTransitionDocuments).where(eq(courtyardSalesTransitionDocuments.transitionId, transition.id)).orderBy(desc(courtyardSalesTransitionDocuments.createdAt)),
        db.select().from(courtyardSalesTransitionShares).where(eq(courtyardSalesTransitionShares.transitionId, transition.id)).orderBy(desc(courtyardSalesTransitionShares.createdAt)),
      ]);
      const progress = items.length ? Math.round(items.filter((item) => item.status === "complete").length / items.length * 100) : 0;
      res.json({ transitions, transition, items: items.map((item: any) => ({ ...item, password: decryptTransitionPassword(item.metadataJson), metadataJson: undefined })), documents, shares, progress });
    } catch (e) { next(e); }
  });
  router.get("/meeting-calendar", async (req: any, res, next) => {
    try { const hotelId=String(req.query.hotelId||""); if(!hasHotel(req,hotelId)) return res.status(403).json({error:"Property access required."}); await db.update(courtyardMeetingEvents).set({status:"expired",updatedAt:new Date()}).where(and(eq(courtyardMeetingEvents.hotelId,hotelId),eq(courtyardMeetingEvents.status,"courtesy_hold"),lt(courtyardMeetingEvents.holdExpiresAt,new Date()))); let spaces=await db.select().from(courtyardMeetingSpaces).where(and(eq(courtyardMeetingSpaces.hotelId,hotelId),eq(courtyardMeetingSpaces.active,true))); if(!spaces.length){spaces=await db.insert(courtyardMeetingSpaces).values({hotelId,name:"Meeting Space",squareFeet:2000}).returning();} const start=String(req.query.start||"0001-01-01"),end=String(req.query.end||"9999-12-31"); const events=(await db.select().from(courtyardMeetingEvents).where(eq(courtyardMeetingEvents.hotelId,hotelId)).orderBy(asc(courtyardMeetingEvents.eventDate),asc(courtyardMeetingEvents.setupStartTime))).filter(x=>x.eventDate>=start&&x.eventDate<=end); const groupRoomBlocks=(await db.select().from(courtyardGroupRoomBlocks).where(eq(courtyardGroupRoomBlocks.hotelId,hotelId)).orderBy(asc(courtyardGroupRoomBlocks.arrivalDate))).filter(x=>x.arrivalDate<=end&&x.departureDate>=start); const ids=events.map(x=>x.id); const documents=ids.length?await db.select({id:courtyardMeetingEventDocuments.id,eventId:courtyardMeetingEventDocuments.eventId,filename:courtyardMeetingEventDocuments.filename,category:courtyardMeetingEventDocuments.category,sizeBytes:courtyardMeetingEventDocuments.sizeBytes}).from(courtyardMeetingEventDocuments).where(inArray(courtyardMeetingEventDocuments.eventId,ids)):[]; const calendarManager=canManageMeetingCalendar(req); const shares=calendarManager?await db.select().from(courtyardMeetingCalendarShares).where(eq(courtyardMeetingCalendarShares.hotelId,hotelId)).orderBy(desc(courtyardMeetingCalendarShares.createdAt)):[]; res.json({spaces,events,groupRoomBlocks,documents,shares,user:{isAdmin:calendarManager}}); }catch(e){next(e);}
  });
  router.get("/meeting-calendar/events/:id/beo.pdf", async (req: any, res, next) => {
    try {
      const [event] = await db.select().from(courtyardMeetingEvents).where(eq(courtyardMeetingEvents.id, req.params.id)).limit(1);
      if (!event || !hasHotel(req, event.hotelId)) return res.status(404).json({ error: "Event not found." });
      const seriesEvents = event.bookingSeriesId
        ? await db.select().from(courtyardMeetingEvents).where(eq(courtyardMeetingEvents.bookingSeriesId, event.bookingSeriesId)).orderBy(asc(courtyardMeetingEvents.eventDate))
        : [event];
      const [space] = await db.select().from(courtyardMeetingSpaces).where(eq(courtyardMeetingSpaces.id, event.spaceId)).limit(1);
      const bytes = await createMeetingBeoPdf(event, seriesEvents, space?.name || "Meeting Space");
      const safeName = String(event.groupName || "event").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "event";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${safeName}-BEO.pdf"`);
      res.send(Buffer.from(bytes));
    } catch (error) { next(error); }
  });
  router.post("/meeting-calendar/events", async (req: any, res, next) => {
    try {
      const hotelId = String(req.body.hotelId || "");
      if (!hasHotel(req, hotelId)) return res.status(403).json({ error: "Property access required." });
      const required = ["spaceId", "groupName", "eventName", "eventDate", "setupStartTime", "guestStartTime", "guestEndTime", "breakdownEndTime"];
      if (required.some((field) => !String(req.body[field] || "").trim())) return res.status(400).json({ error: "Group, event, date, space, and all operational times are required." });
      const revenueError = meetingRevenueValidationError(req.body);
      if (revenueError) return res.status(400).json({ error: revenueError });
      if (!(req.body.setupStartTime <= req.body.guestStartTime && req.body.guestStartTime < req.body.guestEndTime && req.body.guestEndTime <= req.body.breakdownEndTime)) return res.status(400).json({ error: "Times must follow setup start, guest start, guest end, then breakdown end." });
      if (!validDateOnly(req.body.eventDate) || !validDateOnly(req.body.eventEndDate)) return res.status(400).json({ error: "Enter a valid event date range." });
      const startDate = String(req.body.eventDate);
      const endDate = String(req.body.eventEndDate || startDate);
      if (endDate < startDate) return res.status(400).json({ error: "The end date cannot be before the start date." });
      const dates: string[] = [];
      const cursor = new Date(`${startDate}T12:00:00Z`), rangeEnd = new Date(`${endDate}T12:00:00Z`);
      while (cursor <= rangeEnd && dates.length <= 31) { dates.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
      if (dates.length > 31 || cursor <= rangeEnd) return res.status(400).json({ error: "A meeting-space booking may span no more than 31 consecutive days." });
      const holdExpiresAt = req.body.holdExpiresAt ? new Date(req.body.holdExpiresAt) : null;
      if (holdExpiresAt && Number.isNaN(holdExpiresAt.getTime())) return res.status(400).json({ error: "Enter a valid courtesy-hold expiration date and time." });
      const active = (await db.select().from(courtyardMeetingEvents).where(and(eq(courtyardMeetingEvents.spaceId, req.body.spaceId), inArray(courtyardMeetingEvents.eventDate, dates)))).filter((event) => !["cancelled", "completed", "expired"].includes(event.status));
      const conflict = active.find((event) => req.body.setupStartTime < event.breakdownEndTime && event.setupStartTime < req.body.breakdownEndTime);
      if (conflict && (!canManageMeetingCalendar(req) || !String(req.body.conflictOverrideReason || "").trim())) return res.status(409).json({ error: `The space is occupied on ${conflict.eventDate} by ${conflict.groupName} from ${conflict.setupStartTime.slice(0, 5)} to ${conflict.breakdownEndTime.slice(0, 5)}. An override reason is required.`, code: "MEETING_SPACE_CONFLICT" });
      if (req.body.status === "definite" && !canManageMeetingCalendar(req)) return res.status(403).json({ error: "Calendar PIN access is required to mark an event definite." });
      const baseValues = meetingEventWriteValues(req.body, holdExpiresAt, dates.length);
      const bookingSeriesId = crypto.randomUUID();
      const events = await db.insert(courtyardMeetingEvents).values(dates.map((eventDate) => ({ ...baseValues, eventDate, bookingSeriesId, bookingStartDate: dates[0], createdByUserId: req.salesUser.id, updatedByUserId: req.salesUser.id }))).returning();
      res.status(201).json({ event: events[0], events, count: events.length });
    } catch (error) { next(error); }
  });
  router.patch("/meeting-calendar/events/:id", async (req: any, res, next) => {
    try {
      const [existing] = await db.select().from(courtyardMeetingEvents).where(eq(courtyardMeetingEvents.id, req.params.id)).limit(1);
      if (!existing || !hasHotel(req, existing.hotelId)) return res.status(404).json({ error: "Event not found." });
      const required = ["spaceId", "groupName", "eventName", "eventDate", "setupStartTime", "guestStartTime", "guestEndTime", "breakdownEndTime"];
      if (required.some((field) => !String(req.body[field] || "").trim())) return res.status(400).json({ error: "Group, event, date, space, and all operational times are required." });
      const revenueError = meetingRevenueValidationError(req.body);
      if (revenueError) return res.status(400).json({ error: revenueError });
      if (!validDateOnly(req.body.eventDate) || !validDateOnly(req.body.eventEndDate)) return res.status(400).json({ error: "Enter a valid event date range." });
      const startDate = String(req.body.eventDate), endDate = String(req.body.eventEndDate || startDate);
      if (endDate < startDate) return res.status(400).json({ error: "The end date cannot be before the start date." });
      const dates: string[] = [];
      const cursor = new Date(`${startDate}T12:00:00Z`), rangeEnd = new Date(`${endDate}T12:00:00Z`);
      while (cursor <= rangeEnd && dates.length <= 31) { dates.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
      if (dates.length > 31 || cursor <= rangeEnd) return res.status(400).json({ error: "A meeting-space booking may span no more than 31 consecutive days." });
      if (!(req.body.setupStartTime <= req.body.guestStartTime && req.body.guestStartTime < req.body.guestEndTime && req.body.guestEndTime <= req.body.breakdownEndTime)) return res.status(400).json({ error: "Times must follow setup start, guest start, guest end, then breakdown end." });
      const [space] = await db.select({ id: courtyardMeetingSpaces.id }).from(courtyardMeetingSpaces).where(and(eq(courtyardMeetingSpaces.id, req.body.spaceId), eq(courtyardMeetingSpaces.hotelId, existing.hotelId))).limit(1);
      if (!space) return res.status(400).json({ error: "The selected meeting space is not available for this property." });
      const holdExpiresAt = req.body.holdExpiresAt ? new Date(req.body.holdExpiresAt) : null;
      if (holdExpiresAt && Number.isNaN(holdExpiresAt.getTime())) return res.status(400).json({ error: "Enter a valid courtesy-hold expiration date and time." });
      let seriesEvents = existing.bookingSeriesId
        ? await db.select().from(courtyardMeetingEvents).where(eq(courtyardMeetingEvents.bookingSeriesId, existing.bookingSeriesId))
        : [];
      if (!seriesEvents.length) {
        const legacyMatches = await db.select().from(courtyardMeetingEvents).where(and(
          eq(courtyardMeetingEvents.hotelId, existing.hotelId),
          eq(courtyardMeetingEvents.spaceId, existing.spaceId),
          eq(courtyardMeetingEvents.groupName, existing.groupName),
          eq(courtyardMeetingEvents.eventName, existing.eventName),
        )).orderBy(asc(courtyardMeetingEvents.eventDate));
        const existingIndex = legacyMatches.findIndex((event) => event.id === existing.id);
        if (existingIndex >= 0) {
          let firstIndex = existingIndex, lastIndex = existingIndex;
          const dayGap = (left: string, right: string) => Math.round((new Date(`${right}T12:00:00Z`).getTime() - new Date(`${left}T12:00:00Z`).getTime()) / 86400000);
          while (firstIndex > 0 && dayGap(legacyMatches[firstIndex - 1].eventDate, legacyMatches[firstIndex].eventDate) <= 1) firstIndex -= 1;
          while (lastIndex < legacyMatches.length - 1 && dayGap(legacyMatches[lastIndex].eventDate, legacyMatches[lastIndex + 1].eventDate) <= 1) lastIndex += 1;
          seriesEvents = legacyMatches.slice(firstIndex, lastIndex + 1);
        }
      }
      if (!seriesEvents.length) seriesEvents = [existing];
      const effectiveDates = Array.from(new Set([...seriesEvents.map((event) => event.eventDate), ...dates])).sort();
      const seriesIds = new Set(seriesEvents.map((event) => event.id));
      const active = (await db.select().from(courtyardMeetingEvents).where(and(eq(courtyardMeetingEvents.spaceId, req.body.spaceId), inArray(courtyardMeetingEvents.eventDate, effectiveDates)))).filter((event) => !seriesIds.has(event.id) && !["cancelled", "completed", "expired"].includes(event.status));
      const conflict = active.find((event) => req.body.setupStartTime < event.breakdownEndTime && event.setupStartTime < req.body.breakdownEndTime);
      if (conflict && (!canManageMeetingCalendar(req) || !String(req.body.conflictOverrideReason || "").trim())) return res.status(409).json({ error: `The space is occupied on ${conflict.eventDate} by ${conflict.groupName} from ${conflict.setupStartTime.slice(0, 5)} to ${conflict.breakdownEndTime.slice(0, 5)}. An override reason is required.`, code: "MEETING_SPACE_CONFLICT" });
      if (req.body.status === "definite" && !canManageMeetingCalendar(req)) return res.status(403).json({ error: "Calendar PIN access is required to mark an event definite." });
      const bookingSeriesId = existing.bookingSeriesId || existing.id;
      const baseValues = { ...meetingEventWriteValues(req.body, holdExpiresAt, effectiveDates.length), bookingSeriesId, bookingStartDate: effectiveDates[0], hotelId: existing.hotelId, updatedByUserId: req.salesUser.id, updatedAt: new Date() };
      const events = await db.transaction(async (tx) => {
        const { eventDate: _eventDate, ...sharedValues } = baseValues;
        const updated = await tx.update(courtyardMeetingEvents).set(sharedValues).where(inArray(courtyardMeetingEvents.id, seriesEvents.map((event) => event.id))).returning();
        const existingDates = new Set(seriesEvents.map((event) => event.eventDate));
        const missingDates = effectiveDates.filter((eventDate) => !existingDates.has(eventDate));
        const added = missingDates.length
          ? await tx.insert(courtyardMeetingEvents).values(missingDates.map((eventDate) => ({ ...baseValues, eventDate, createdByUserId: req.salesUser.id }))).returning()
          : [];
        return [...updated, ...added].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
      });
      res.json({ event: events[0], events, count: events.length });
    } catch (error) { next(error); }
  });
  router.post("/meeting-calendar/events/:id/documents",transitionUpload.single("file"),async(req:any,res,next)=>{try{const [event]=await db.select().from(courtyardMeetingEvents).where(eq(courtyardMeetingEvents.id,req.params.id)).limit(1);if(!event||!hasHotel(req,event.hotelId))return res.status(404).json({error:"Event not found."});if(!req.file)return res.status(400).json({error:"Choose a file."});const [document]=await db.insert(courtyardMeetingEventDocuments).values({eventId:event.id,filename:req.file.originalname,mimeType:req.file.mimetype||"application/octet-stream",sizeBytes:req.file.size,category:req.body.category||"other",contentBase64:req.file.buffer.toString("base64"),uploadedByUserId:req.salesUser.id}).returning();res.status(201).json({document:{...document,contentBase64:undefined}});}catch(e){next(e);}});
  router.get("/meeting-calendar/events/:eventId/documents/:id",async(req:any,res,next)=>{try{const [event]=await db.select().from(courtyardMeetingEvents).where(eq(courtyardMeetingEvents.id,req.params.eventId)).limit(1);if(!event||!hasHotel(req,event.hotelId))return res.status(404).json({error:"Event not found."});const [doc]=await db.select().from(courtyardMeetingEventDocuments).where(and(eq(courtyardMeetingEventDocuments.id,req.params.id),eq(courtyardMeetingEventDocuments.eventId,event.id))).limit(1);if(!doc)return res.status(404).json({error:"Document not found."});res.setHeader("Content-Type",doc.mimeType);res.setHeader("Content-Disposition",`attachment; filename="${doc.filename.replace(/[\r\n"]/g,"_")}"`);res.send(Buffer.from(doc.contentBase64,"base64"));}catch(e){next(e);}});
  router.post("/meeting-calendar/shares",async(req:any,res,next)=>{try{const hotelId=String(req.body.hotelId||"");if(!hasHotel(req,hotelId))return res.status(403).json({error:"Property access required."});const token=crypto.randomBytes(32).toString("base64url"),days=Math.min(30,Math.max(1,Number(req.body.expiresInDays||7))),expiresAt=new Date(Date.now()+days*86400000);const [share]=await db.insert(courtyardMeetingCalendarShares).values({hotelId,tokenHash:transitionTokenHash(token),recipientName:req.body.recipientName||null,rangeStart:req.body.rangeStart||null,rangeEnd:req.body.rangeEnd||null,expiresAt,createdByUserId:req.salesUser.id}).returning();const base=(process.env.FRONTEND_BASE_URL||"https://readysetfly.us").replace(/\/$/,"");res.status(201).json({share,url:`${base}/courtyard/meeting-calendar/share/${token}`});}catch(e){next(e);}});
  router.post("/meeting-calendar/group-rooms", async (req: any, res, next) => {
    try {
      const hotelId = String(req.body.hotelId || "");
      if (!hasHotel(req, hotelId)) return res.status(403).json({ error: "Property access required." });
      const validationError = groupRoomValidationError(req.body);
      if (validationError) return res.status(400).json({ error: validationError });
      const [block] = await db.insert(courtyardGroupRoomBlocks).values({ hotelId, ...groupRoomWriteValues(req.body), createdByUserId: req.salesUser.id, updatedByUserId: req.salesUser.id }).returning();
      res.status(201).json({ block });
    } catch (e) { next(e); }
  });
  router.patch("/meeting-calendar/group-rooms/:id", async (req: any, res, next) => {
    try {
      const [existing] = await db.select().from(courtyardGroupRoomBlocks).where(eq(courtyardGroupRoomBlocks.id, req.params.id)).limit(1);
      if (!existing || !hasHotel(req, existing.hotelId)) return res.status(404).json({ error: "Group room block not found." });
      const validationError = groupRoomValidationError(req.body);
      if (validationError) return res.status(400).json({ error: validationError });
      const [block] = await db.update(courtyardGroupRoomBlocks).set({ ...groupRoomWriteValues(req.body), updatedByUserId: req.salesUser.id, updatedAt: new Date() }).where(eq(courtyardGroupRoomBlocks.id, existing.id)).returning();
      res.json({ block });
    } catch (e) { next(e); }
  });
  router.post("/transitions", async (req: any, res, next) => {
    try { const hotelId = String(req.body.hotelId || ""); if (!hasHotel(req, hotelId)) return res.status(403).json({ error: "Property access required." }); if (!String(req.body.title || "").trim()) return res.status(400).json({ error: "Title is required." }); if (!validDateOnly(req.body.departureDate)) return res.status(400).json({ error: "Enter a valid departure date." }); const [transition] = await db.insert(courtyardSalesTransitions).values({ hotelId, title: String(req.body.title).trim(), departureDate: req.body.departureDate || null, departingUserName: req.body.departingUserName || null, summary: req.body.summary || null, createdByUserId: req.salesUser.id }).returning(); res.status(201).json({ transition }); } catch (e) { next(e); }
  });
  router.patch("/transitions/:id", async (req: any, res, next) => {
    try { const [existing] = await db.select().from(courtyardSalesTransitions).where(eq(courtyardSalesTransitions.id, req.params.id)).limit(1); if (!existing || !hasHotel(req, existing.hotelId)) return res.status(404).json({ error: "Transition not found." }); const action = String(req.body.action || ""); const values: any = { updatedAt: new Date() }; if (action === "departing_signoff") values.departingSignedAt = new Date(); else if (action === "manager_accept") { if (!admin(req.salesUser)) return res.status(403).json({ error: "Manager access required." }); values.managerAcceptedAt = new Date(); values.status = "complete"; } else { if (req.body.departureDate !== undefined && !validDateOnly(req.body.departureDate)) return res.status(400).json({ error: "Enter a valid departure date." }); if (req.body.status && !TRANSITION_STATUSES.includes(req.body.status)) return res.status(400).json({ error: "Invalid transition status." }); Object.assign(values, { title: req.body.title, departureDate: req.body.departureDate || null, summary: req.body.summary, status: req.body.status }); } const [transition] = await db.update(courtyardSalesTransitions).set(values).where(eq(courtyardSalesTransitions.id, existing.id)).returning(); res.json({ transition }); } catch (e) { next(e); }
  });
  router.post("/transitions/:id/items", async (req: any, res, next) => {
    try { const [transition] = await db.select().from(courtyardSalesTransitions).where(eq(courtyardSalesTransitions.id, req.params.id)).limit(1); if (!transition || !hasHotel(req, transition.hotelId)) return res.status(404).json({ error: "Transition not found." }); if (!String(req.body.title || "").trim()) return res.status(400).json({ error: "Item title is required." }); const category=String(req.body.category||"knowledge"),status=String(req.body.status||"not_started"); if(!TRANSITION_CATEGORIES.includes(category))return res.status(400).json({error:"Invalid handoff category."});if(!TRANSITION_ITEM_STATUSES.includes(status))return res.status(400).json({error:"Invalid handoff status."});if(!validDateOnly(req.body.dueDate))return res.status(400).json({error:"Enter a valid due date."});const opportunityId=String(req.body.opportunityId||"").trim()||null;if(opportunityId){const [opportunity]=await db.select({id:courtyardSalesOpportunities.id}).from(courtyardSalesOpportunities).where(and(eq(courtyardSalesOpportunities.id,opportunityId),eq(courtyardSalesOpportunities.hotelId,transition.hotelId))).limit(1);if(!opportunity)return res.status(400).json({error:"The linked opportunity does not exist for this property."});} let url=null,vaultUrl=null,metadataJson=null;try{url=safeTransitionUrl(req.body.url);vaultUrl=safeTransitionUrl(req.body.vaultUrl);metadataJson=encryptTransitionPassword(req.body.password);}catch(error){return res.status(400).json({error:(error as Error).message});} const [item] = await db.insert(courtyardSalesTransitionItems).values({ transitionId: transition.id, category, title: String(req.body.title).trim(), description: req.body.description || null, status, dueDate: req.body.dueDate || null, ownerName: req.body.ownerName || null, url, username: req.body.username || null, vaultUrl, mfaOwner: req.body.mfaOwner || null, recoveryContact: req.body.recoveryContact || null, accountKey: req.body.accountKey || null, opportunityId, frequency: req.body.frequency || null, confidential: Boolean(req.body.confidential), metadataJson, createdByUserId: req.salesUser.id }).returning(); res.status(201).json({ item: { ...item, password: String(req.body.password || ""), metadataJson: undefined } }); } catch (e) { next(e); }
  });
  router.patch("/transitions/:transitionId/items/:id", async (req: any, res, next) => {
    try { const [transition] = await db.select().from(courtyardSalesTransitions).where(eq(courtyardSalesTransitions.id, req.params.transitionId)).limit(1); if (!transition || !hasHotel(req, transition.hotelId)) return res.status(404).json({ error: "Transition not found." }); const [existingItem]=await db.select().from(courtyardSalesTransitionItems).where(and(eq(courtyardSalesTransitionItems.id,req.params.id),eq(courtyardSalesTransitionItems.transitionId,transition.id))).limit(1);if(!existingItem)return res.status(404).json({error:"Handoff item not found."});const category=String(req.body.category??existingItem.category),status=String(req.body.status??existingItem.status);if(!TRANSITION_CATEGORIES.includes(category))return res.status(400).json({error:"Invalid handoff category."});if(!TRANSITION_ITEM_STATUSES.includes(status))return res.status(400).json({error:"Invalid handoff status."});if(req.body.dueDate!==undefined&&!validDateOnly(req.body.dueDate))return res.status(400).json({error:"Enter a valid due date."});let url=existingItem.url,vaultUrl=existingItem.vaultUrl,metadataJson=existingItem.metadataJson;try{if(req.body.url!==undefined)url=safeTransitionUrl(req.body.url);if(req.body.vaultUrl!==undefined)vaultUrl=safeTransitionUrl(req.body.vaultUrl);if(req.body.password!==undefined)metadataJson=encryptTransitionPassword(req.body.password);}catch(error){return res.status(400).json({error:(error as Error).message});}const values:any={category,status,url,vaultUrl,metadataJson,updatedAt:new Date()};for(const field of ["title","description","ownerName","username","mfaOwner","recoveryContact","accountKey","frequency"]){if(req.body[field]!==undefined)values[field]=req.body[field]||null;}if(req.body.dueDate!==undefined)values.dueDate=req.body.dueDate||null;if(req.body.confidential!==undefined)values.confidential=Boolean(req.body.confidential);const [item] = await db.update(courtyardSalesTransitionItems).set(values).where(eq(courtyardSalesTransitionItems.id,existingItem.id)).returning(); res.json({ item: { ...item, password: decryptTransitionPassword(item.metadataJson), metadataJson: undefined } }); } catch (e) { next(e); }
  });
  router.post("/transitions/:id/documents", transitionUpload.single("file"), async (req: any, res, next) => {
    try { const [transition] = await db.select().from(courtyardSalesTransitions).where(eq(courtyardSalesTransitions.id, req.params.id)).limit(1); if (!transition || !hasHotel(req, transition.hotelId)) return res.status(404).json({ error: "Transition not found." }); if (!req.file) return res.status(400).json({ error: "Choose a file." }); const [document] = await db.insert(courtyardSalesTransitionDocuments).values({ transitionId: transition.id, filename: req.file.originalname, mimeType: req.file.mimetype || "application/octet-stream", sizeBytes: req.file.size, category: req.body.category || "other", description: req.body.description || null, confidential: req.body.confidential === "true", contentBase64: req.file.buffer.toString("base64"), uploadedByUserId: req.salesUser.id }).returning(); res.status(201).json({ document: { ...document, contentBase64: undefined } }); } catch (e) { next(e); }
  });
  router.get("/transitions/:transitionId/documents/:id", async (req: any, res, next) => {
    try { const [transition] = await db.select().from(courtyardSalesTransitions).where(eq(courtyardSalesTransitions.id, req.params.transitionId)).limit(1); if (!transition || !hasHotel(req, transition.hotelId)) return res.status(404).json({ error: "Transition not found." }); const [document] = await db.select().from(courtyardSalesTransitionDocuments).where(and(eq(courtyardSalesTransitionDocuments.id, req.params.id), eq(courtyardSalesTransitionDocuments.transitionId, transition.id))).limit(1); if (!document) return res.status(404).json({ error: "Document not found." }); res.setHeader("Content-Type", document.mimeType); res.setHeader("Content-Disposition", `attachment; filename="${document.filename.replace(/[\r\n"]/g, "_")}"`); res.send(Buffer.from(document.contentBase64, "base64")); } catch (e) { next(e); }
  });
  router.post("/transitions/:id/shares", async (req: any, res, next) => {
    try { const [transition] = await db.select().from(courtyardSalesTransitions).where(eq(courtyardSalesTransitions.id, req.params.id)).limit(1); if (!transition || !hasHotel(req, transition.hotelId)) return res.status(404).json({ error: "Transition not found." }); const requestedDays=Number(req.body.expiresInDays);if(!Number.isInteger(requestedDays)||requestedDays<1||requestedDays>30)return res.status(400).json({error:"Expiration must be between 1 and 30 days."});if(!validEmail(req.body.recipientEmail))return res.status(400).json({error:"Enter a valid recipient email address."}); const token = crypto.randomBytes(32).toString("base64url"); const expiresAt = new Date(Date.now() + requestedDays * 86400000); const [share] = await db.insert(courtyardSalesTransitionShares).values({ transitionId: transition.id, tokenHash: transitionTokenHash(token), recipientName: req.body.recipientName || null, recipientEmail: req.body.recipientEmail || null, expiresAt, allowDownloads: Boolean(req.body.allowDownloads), createdByUserId: req.salesUser.id }).returning(); const base = (process.env.FRONTEND_BASE_URL || "https://readysetfly.us").replace(/\/$/, ""); res.status(201).json({ share, url: `${base}/courtyard/sales-transition/${token}` }); } catch (e) { next(e); }
  });
  router.patch("/transitions/:transitionId/shares/:id/revoke", async (req: any, res, next) => {
    try { const [transition] = await db.select().from(courtyardSalesTransitions).where(eq(courtyardSalesTransitions.id, req.params.transitionId)).limit(1); if (!transition || !hasHotel(req, transition.hotelId)) return res.status(404).json({ error: "Transition not found." }); await db.update(courtyardSalesTransitionShares).set({ revokedAt: new Date() }).where(and(eq(courtyardSalesTransitionShares.id, req.params.id), eq(courtyardSalesTransitionShares.transitionId, transition.id))); res.status(204).end(); } catch (e) { next(e); }
  });
  router.post("/preview", upload.single("file"), async (req: any, res, next) => {
    try {
      if (!req.file)
        return res.status(400).json({ error: "Choose a report file." });
      const reportYear = Number(req.body.reportYear);
      const reportMonth = Number(req.body.reportMonth);
      const isStayFormat = Number.isInteger(reportYear) && reportYear >= 2026;
      const requestedReportType = String(req.body.reportType || "");
      const isDatScreenshot = requestedReportType === DAT_SCREENSHOT_REPORT_TYPE;
      const isDatExcel = requestedReportType === DAT_EXCEL_REPORT_TYPE;
      const isDatReport = isDatScreenshot || isDatExcel;
      const detectedStayReportType = isStayFormat
        ? (isDatReport ? null : detectStaySalesReportType(req.file.buffer))
        : null;
      const isGroupSummary =
        isStayFormat &&
        (detectedStayReportType || requestedReportType) ===
          STAY_GROUP_SUMMARY_REPORT_TYPE;
      const isReservationsReport =
        isStayFormat &&
        detectedStayReportType === STAY_RESERVATIONS_REPORT_TYPE;
      const p = isDatExcel
        ? parseDatWorkbook(req.file.buffer)
        : isDatScreenshot
        ? await parseDatScreenshot(req.file)
        : isReservationsReport
        ? parseStayReservationsCompanyImport(
            req.file.buffer,
            reportYear,
            reportMonth,
          )
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
        isDatScreenshot,
        isDatExcel,
        showsTableStart: (p as any).showsTableStart ?? null,
        showsTableEnd: (p as any).showsTableEnd ?? null,
        reportDateRange: (p as any).reportDateRange || null,
        calculatedTotals: {
          roomNights: p.accepted.reduce((sum: number, row: any) => sum + Number(row.roomNights || 0), 0),
          roomRevenue: p.accepted.reduce((sum: number, row: any) => sum + Number(row.roomRevenue || 0), 0),
        },
        extractedRows: isDatReport ? p.accepted.map((row: any) => ({
          key: row.normalizedAccountKey,
          roomNights: row.roomNights,
          roomRevenue: row.roomRevenue,
        })) : [],
        suggestedReportType: isDatReport
          ? requestedReportType
          : isReservationsReport
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
            : isDatReport
              ? r.marketCategory
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
          ? [DAT_EXCEL_REPORT_TYPE, DAT_SCREENSHOT_REPORT_TYPE].includes(requestedReportType)
            ? requestedReportType
            : detectStaySalesReportType(req.file.buffer) || requestedReportType
          : requestedReportType;
      if (
        reportYear >= 2026 &&
        ![
          STAY_MARKET_REPORT_TYPE,
          STAY_GROUP_SUMMARY_REPORT_TYPE,
          STAY_RESERVATIONS_REPORT_TYPE,
          DAT_EXCEL_REPORT_TYPE,
          DAT_SCREENSHOT_REPORT_TYPE,
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
        sourceReportType === DAT_EXCEL_REPORT_TYPE
          ? parseDatWorkbook(req.file.buffer)
        : sourceReportType === DAT_SCREENSHOT_REPORT_TYPE
          ? await parseDatScreenshot(req.file)
        : reportYear >= 2026 && sourceReportType === STAY_RESERVATIONS_REPORT_TYPE
          ? parseStayReservationsCompanyImport(
              req.file.buffer,
              reportYear,
              reportMonth,
            )
          : reportYear >= 2026 &&
              sourceReportType === STAY_GROUP_SUMMARY_REPORT_TYPE
            ? parseStayGroupSummaryImport(req.file.buffer)
            : reportYear >= 2026
              ? parseStayMarketSegmentImport(req.file.buffer)
              : parseSalesImport(req.file.buffer);
      if ([DAT_EXCEL_REPORT_TYPE, DAT_SCREENSHOT_REPORT_TYPE].includes(sourceReportType)) {
        const [imageYear, imageMonth] = p.reportDateRange.start.split("-").map(Number);
        if (imageYear !== reportYear || imageMonth !== reportMonth)
          return res.status(400).json({
            error: `The DAT report TimeFrame is ${p.reportDateRange.start} to ${p.reportDateRange.end}. Import it as ${imageYear}-${String(imageMonth).padStart(2, "0")}.`,
          });
      }
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
      const existingSourceTypes = reportYear >= 2026 && isAuthoritativeHotelProductionReport(sourceReportType)
        ? [STAY_MARKET_REPORT_TYPE, DAT_EXCEL_REPORT_TYPE, DAT_SCREENSHOT_REPORT_TYPE]
        : [sourceReportType];
      const existing = await db
        .select()
        .from(courtyardSalesImportBatches)
        .where(
          and(
            eq(courtyardSalesImportBatches.hotelId, hotelId),
            eq(courtyardSalesImportBatches.reportYear, reportYear),
            eq(courtyardSalesImportBatches.reportMonth, reportMonth),
            inArray(courtyardSalesImportBatches.sourceReportType, existingSourceTypes),
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
        sourceReportType,
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
        const requestedReportType = String(req.body.reportType || "");
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
        const prepared = requestedReportType === DAT_SCREENSHOT_REPORT_TYPE
          ? await (async () => {
              const parsedParts = await Promise.all(files.map((file) => parseDatScreenshot(file)));
              const parsed = mergeDatScreenshotImports(parsedParts);
              const [imageYear, imageMonth] = parsed.reportDateRange.start.split("-").map(Number);
              if (imageYear !== reportYear || imageMonth !== reportMonth)
                throw new Error(`The DAT screenshot TimeFrame is ${parsed.reportDateRange.start} to ${parsed.reportDateRange.end}. Import it as ${imageYear}-${String(imageMonth).padStart(2, "0")}.`);
              const combinedBuffer = Buffer.concat(files.map((file) => file.buffer));
              return [{
                file: { ...files[0], originalname: files.map((file) => file.originalname).join(" + "), buffer: combinedBuffer },
                sourceReportType: DAT_SCREENSHOT_REPORT_TYPE,
                parsed,
                checksum: crypto.createHash("sha256").update(combinedBuffer).digest("hex"),
              }];
            })()
          : files.map((file) => {
          const sourceReportType = detectStaySalesReportType(file.buffer);
          if (!sourceReportType)
            throw new Error(
              `${file.originalname} is not a recognized STAY report.`,
            );
          const parsed =
            sourceReportType === STAY_RESERVATIONS_REPORT_TYPE
              ? parseStayReservationsCompanyImport(
                  file.buffer,
                  reportYear,
                  reportMonth,
                )
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
          const conflictSourceTypes = isAuthoritativeHotelProductionReport(item.sourceReportType)
            ? [STAY_MARKET_REPORT_TYPE, DAT_EXCEL_REPORT_TYPE, DAT_SCREENSHOT_REPORT_TYPE]
            : [item.sourceReportType];
          const existing = await db
            .select()
            .from(courtyardSalesImportBatches)
            .where(
              and(
                eq(courtyardSalesImportBatches.hotelId, hotelId),
                eq(courtyardSalesImportBatches.reportYear, reportYear),
                eq(courtyardSalesImportBatches.reportMonth, reportMonth),
                inArray(courtyardSalesImportBatches.sourceReportType, conflictSourceTypes),
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
                DAT_EXCEL_REPORT_TYPE,
                DAT_SCREENSHOT_REPORT_TYPE,
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
      const stayRows = rows.filter((row) =>
        [STAY_MARKET_REPORT_TYPE, DAT_EXCEL_REPORT_TYPE, DAT_SCREENSHOT_REPORT_TYPE].includes(
          batchById.get(row.importBatchId)?.sourceReportType,
        ),
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
          a.status =
            a.roomNights > 0 ? "Observed Activity" : "Identified Prospect";
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
                periodBatches.find((batch) => batch.sourceReportType === DAT_EXCEL_REPORT_TYPE)?.sourceReportType
                  || periodBatches.find((batch) => batch.sourceReportType === DAT_SCREENSHOT_REPORT_TYPE)?.sourceReportType
                  || STAY_MARKET_REPORT_TYPE,
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
  router.get("/advisor/monthly-targets", async (req: any, res, next) => {
    try {
      const hotelId = String(req.query.hotelId || req.salesHotels[0]?.id || "");
      if (!hasHotel(req, hotelId))
        return res.status(403).json({ error: "You do not have access to that property." });
      const period = monthlyTargetPeriod(req.query);
      const source = await advisorSourceData(hotelId);
      const recommendation = buildMonthlySalesTargets({ ...source, ...period } as any);
      const saved = await db
        .select()
        .from(courtyardSalesMonthlyTargets)
        .where(
          and(
            eq(courtyardSalesMonthlyTargets.hotelId, hotelId),
            eq(courtyardSalesMonthlyTargets.targetYear, period.targetYear),
            eq(courtyardSalesMonthlyTargets.targetMonth, period.targetMonth),
          ),
        );
      const savedBySegment = new Map(saved.map((row) => [row.segment, row]));
      res.json({
        ...recommendation,
        segments: recommendation.segments.map((segment) => ({
          ...segment,
          saved: savedBySegment.get(segment.segment) || null,
        })),
      });
    } catch (error: any) {
      if (error?.message?.startsWith("Choose a valid"))
        return res.status(400).json({ error: error.message });
      next(error);
    }
  });

  router.put("/advisor/monthly-targets", async (req: any, res, next) => {
    try {
      const hotelId = String(req.body.hotelId || req.salesHotels[0]?.id || "");
      if (!hasHotel(req, hotelId))
        return res.status(403).json({ error: "You do not have access to that property." });
      const period = monthlyTargetPeriod(req.body);
      const requested = Array.isArray(req.body.segments) ? req.body.segments : [];
      if (requested.length !== 2)
        return res.status(400).json({ error: "Save both Group and Special Corp targets together." });
      const source = await advisorSourceData(hotelId);
      const recommendation = buildMonthlySalesTargets({ ...source, ...period } as any);
      const sourceFingerprint = salesAdvisorFingerprint(source.batches as any, {
        ...period,
        purpose: "monthly-sales-target",
      });
      const existing = await db
        .select()
        .from(courtyardSalesMonthlyTargets)
        .where(
          and(
            eq(courtyardSalesMonthlyTargets.hotelId, hotelId),
            eq(courtyardSalesMonthlyTargets.targetYear, period.targetYear),
            eq(courtyardSalesMonthlyTargets.targetMonth, period.targetMonth),
          ),
        );
      if (existing.some((row) => row.status === "locked") && !admin(req.salesUser))
        return res.status(409).json({ error: "This monthly target plan is locked. A manager must unlock it before changes can be saved." });
      const status = req.body.status === "locked" ? "locked" : "draft";
      const values = requested.map((item: any) => {
        const segment = String(item.segment || "");
        if (!["Group", "Special Corp"].includes(segment))
          throw new Error("Choose valid target segments.");
        const suggested = recommendation.segments.find((row) => row.segment === segment)!;
        const targetRoomNights = Number(item.targetRoomNights);
        const targetRevenue = Number(item.targetRevenue);
        const stretchRoomNights = Number(item.stretchRoomNights);
        const stretchRevenue = Number(item.stretchRevenue);
        if (![targetRoomNights, targetRevenue, stretchRoomNights, stretchRevenue].every((value) => Number.isFinite(value) && value >= 0))
          throw new Error("Target rooms and revenue must be valid non-negative numbers.");
        const targetAdr = targetRoomNights > 0 ? targetRevenue / targetRoomNights : 0;
        const stretchAdr = stretchRoomNights > 0 ? stretchRevenue / stretchRoomNights : 0;
        return {
          hotelId,
          ...period,
          segment,
          targetRoomNights: String(targetRoomNights),
          targetRevenue: String(targetRevenue),
          targetAdr: String(targetAdr),
          stretchRoomNights: String(stretchRoomNights),
          stretchRevenue: String(stretchRevenue),
          stretchAdr: String(stretchAdr),
          baselineJson: suggested.baseline,
          rationale: String(item.rationale || suggested.rationale).slice(0, 4000),
          status,
          sourceFingerprint,
          lockedAt: status === "locked" ? new Date() : null,
          createdByUserId: req.salesUser.id,
          updatedByUserId: req.salesUser.id,
          updatedAt: new Date(),
        };
      });
      const saved = await db.transaction(async (tx) => {
        const rows = [];
        for (const value of values) {
          const [row] = await tx
            .insert(courtyardSalesMonthlyTargets)
            .values(value)
            .onConflictDoUpdate({
              target: [
                courtyardSalesMonthlyTargets.hotelId,
                courtyardSalesMonthlyTargets.targetYear,
                courtyardSalesMonthlyTargets.targetMonth,
                courtyardSalesMonthlyTargets.segment,
              ],
              set: {
                targetRoomNights: value.targetRoomNights,
                targetRevenue: value.targetRevenue,
                targetAdr: value.targetAdr,
                stretchRoomNights: value.stretchRoomNights,
                stretchRevenue: value.stretchRevenue,
                stretchAdr: value.stretchAdr,
                baselineJson: value.baselineJson,
                rationale: value.rationale,
                status: value.status,
                sourceFingerprint: value.sourceFingerprint,
                lockedAt: value.lockedAt,
                updatedByUserId: value.updatedByUserId,
                updatedAt: value.updatedAt,
              },
            })
            .returning();
          rows.push(row);
        }
        return rows;
      });
      res.json({ targets: saved, status });
    } catch (error: any) {
      if (error?.message?.startsWith("Choose") || error?.message?.startsWith("Target"))
        return res.status(400).json({ error: error.message });
      next(error);
    }
  });

  router.get("/advisor/demand", async (req: any, res, next) => {
    try {
      const hotelId = String(req.query.hotelId || req.salesHotels[0]?.id || "");
      if (!hasHotel(req, hotelId)) return res.status(403).json({ error: "You do not have access to that property." });
      const { targetYear, targetMonth } = monthlyTargetPeriod(req.query);
      const start = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
      const next = new Date(Date.UTC(targetYear, targetMonth, 1));
      const end = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
      const [events, persisted, source] = await Promise.all([
        db.select().from(courtyardSalesDemandEvents).where(and(eq(courtyardSalesDemandEvents.hotelId, hotelId), gte(courtyardSalesDemandEvents.startDate, start), lt(courtyardSalesDemandEvents.startDate, end))).orderBy(courtyardSalesDemandEvents.startDate),
        db.select().from(courtyardSalesRegionalProspects).where(eq(courtyardSalesRegionalProspects.hotelId, hotelId)).orderBy(desc(courtyardSalesRegionalProspects.opportunityScore)).limit(150),
        advisorSourceData(hotelId),
      ]);
      const historical = buildSalesAdvisorPreview({ ...source, lookbackMonths: 36, businessTypes: ["Groups", "Special Corp", "Government", "Corporate Accounts"], analysisType: "full_plan" } as any)
        .candidates.filter((candidate) => candidate.typicalMonths.includes(targetMonth))
        .slice(0, 30)
        .map((candidate) => ({
          id: `historical:${candidate.businessType}:${candidate.key}`,
          companyName: candidate.name,
          distanceMiles: null,
          distanceBand: "Hotel production history",
          industry: candidate.businessType,
          evidenceClass: candidate.status === "Recovery Opportunity" ? "former_producer" : "proven_producer",
          sourceType: "hotel_history",
          opportunitySignalsJson: [`Produced during ${new Date(2020, targetMonth - 1, 1).toLocaleDateString("en-US", { month: "long" })} in imported hotel history`, candidate.status],
          targetRolesJson: targetRoles(candidate.businessType, []),
          historicalAccountKey: candidate.key,
          historicalRoomNights: candidate.totalRoomNights,
          historicalRevenue: candidate.totalRevenue,
          opportunityScore: Math.max(70, candidate.scores.overall),
          rationale: `${candidate.status}. ${candidate.confidence} confidence from imported production history.`,
          status: "new",
        }));
      const projectLeads = persisted.filter((item) => item.sourceType === "public_project");
      const prospects = [...historical, ...persisted.filter((item) => item.sourceType !== "public_project")].sort((a: any, b: any) => Number(b.opportunityScore) - Number(a.opportunityScore));
      res.json({ targetYear, targetMonth, events, prospects, projectLeads, configuration: { webResearch: !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY), places: !!process.env.GOOGLE_PLACES_API_KEY } });
    } catch (error: any) {
      if (error?.message?.startsWith("Choose a valid")) return res.status(400).json({ error: error.message });
      next(error);
    }
  });

  router.post("/advisor/demand/events", async (req: any, res, next) => {
    try {
      const hotelId = String(req.body.hotelId || "");
      if (!hasHotel(req, hotelId)) return res.status(403).json({ error: "You do not have access to that property." });
      const eventName = String(req.body.eventName || "").trim();
      const startDate = String(req.body.startDate || "");
      if (!eventName || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return res.status(400).json({ error: "Enter an event name and valid start date." });
      const [event] = await db.insert(courtyardSalesDemandEvents).values({
        hotelId, eventName: eventName.slice(0, 240), category: String(req.body.category || "Other"), startDate,
        endDate: /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.endDate || "")) ? req.body.endDate : null,
        venue: String(req.body.venue || "").slice(0, 240) || null, city: String(req.body.city || "").slice(0, 120) || null,
        demandLevel: ["low", "medium", "high"].includes(req.body.demandLevel) ? req.body.demandLevel : "medium",
        opportunityTypesJson: Array.isArray(req.body.opportunityTypes) ? req.body.opportunityTypes.slice(0, 8) : [],
        targetRolesJson: Array.isArray(req.body.targetRoles) ? req.body.targetRoles.slice(0, 12) : [],
        recommendedAction: String(req.body.recommendedAction || "").slice(0, 1000) || null,
        bookingWindowDays: Number(req.body.bookingWindowDays || 90), sourceName: String(req.body.sourceName || "DOS knowledge").slice(0, 200),
        sourceUrl: /^https:\/\//.test(String(req.body.sourceUrl || "")) ? req.body.sourceUrl : null,
        evidenceStatus: "manual", confidence: "medium", sourceLastVerifiedAt: new Date(), createdByUserId: req.salesUser.id,
      }).returning();
      res.status(201).json({ event });
    } catch (error) { next(error); }
  });

  router.post("/advisor/demand/prospects", async (req: any, res, next) => {
    try {
      const hotelId = String(req.body.hotelId || "");
      if (!hasHotel(req, hotelId)) return res.status(403).json({ error: "You do not have access to that property." });
      const companyName = String(req.body.companyName || "").trim();
      if (!companyName) return res.status(400).json({ error: "Enter a company name." });
      const miles = Math.max(0, Math.min(75, Number(req.body.distanceMiles || 0)));
      const signals = Array.isArray(req.body.opportunitySignals) ? req.body.opportunitySignals.slice(0, 12) : [];
      const industry = String(req.body.industry || "Business").slice(0, 160);
      const evidenceClass = "manually_identified";
      const [prospect] = await db.insert(courtyardSalesRegionalProspects).values({
        hotelId, companyName: companyName.slice(0, 240), address: String(req.body.address || "").slice(0, 500) || null,
        city: String(req.body.city || "").slice(0, 120) || null, distanceMiles: String(miles),
        distanceBand: miles <= 10 ? "0–10 miles" : miles <= 25 ? "10–25 miles" : miles <= 50 ? "25–50 miles" : "50–75 miles",
        industry, website: /^https:\/\//.test(String(req.body.website || "")) ? req.body.website : null,
        evidenceClass, sourceType: "manual", sourceId: crypto.randomUUID(), opportunitySignalsJson: signals,
        targetRolesJson: targetRoles(industry, signals), opportunityScore: prospectScore({ distanceMiles: miles, evidenceClass, signals, industry }),
        rationale: String(req.body.rationale || "Manually identified by the onsite sales team; travel potential requires qualification.").slice(0, 2000),
        lastVerifiedAt: new Date(), createdByUserId: req.salesUser.id,
      }).returning();
      res.status(201).json({ prospect });
    } catch (error) { next(error); }
  });

  router.post("/advisor/demand/prospects/:id/enrich", async (req: any, res, next) => {
    try {
      const hotelId = String(req.body.hotelId || "");
      if (!hasHotel(req, hotelId)) return res.status(403).json({ error: "You do not have access to that property." });
      const [existing] = await db.select().from(courtyardSalesRegionalProspects).where(and(eq(courtyardSalesRegionalProspects.id, req.params.id), eq(courtyardSalesRegionalProspects.hotelId, hotelId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Regional prospect not found." });
      if (existing.sourceType !== "google_places" || !existing.sourceId) return res.status(400).json({ error: "Contact enrichment is available for Google Places prospects." });
      const details = await fetchRegionalBusinessContactDetails(existing.sourceId);
      const [prospect] = await db.update(courtyardSalesRegionalProspects).set({ ...details, lastVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(courtyardSalesRegionalProspects.id, existing.id)).returning();
      res.json({ prospect });
    } catch (error: any) {
      if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message });
      next(error);
    }
  });

  router.post("/advisor/demand/project-leads", async (req: any, res, next) => {
    try {
      const hotelId = String(req.body.hotelId || "");
      if (!hasHotel(req, hotelId)) return res.status(403).json({ error: "You do not have access to that property." });
      const projectName = String(req.body.projectName || "").trim();
      const sourceUrl = String(req.body.sourceUrl || "").trim();
      if (!projectName) return res.status(400).json({ error: "Enter a project name." });
      if (sourceUrl && !/^https:\/\//i.test(sourceUrl)) return res.status(400).json({ error: "Project source must be a secure web address." });
      const date = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : null;
      const demandTypes = Array.isArray(req.body.demandTypes) ? req.body.demandTypes.map(String).filter(Boolean).slice(0, 12) : [];
      const subcontractors = Array.isArray(req.body.knownSubcontractors) ? req.body.knownSubcontractors.map(String).filter(Boolean).slice(0, 30) : [];
      const [project] = await db.insert(courtyardSalesRegionalProspects).values({
        hotelId,
        companyName: projectName.slice(0, 240),
        address: String(req.body.projectLocation || "").slice(0, 500) || null,
        city: String(req.body.sourceCity || "Cedar Park").slice(0, 120),
        industry: String(req.body.projectCategory || "Public project").slice(0, 160),
        evidenceClass: sourceUrl ? "user_entered_public_source" : "manually_identified",
        sourceType: "public_project",
        sourceId: crypto.randomUUID(),
        sourceUrl: sourceUrl || null,
        opportunitySignalsJson: demandTypes,
        targetRolesJson: targetRoles(String(req.body.projectCategory || "Project"), demandTypes),
        opportunityScore: Math.max(20, Math.min(100, Number(req.body.opportunityScore || 45))),
        rationale: "User-entered project lead. Lodging demand, contractors, dates, and travel needs remain unverified unless supported by the linked public source.",
        status: ["new", "researching", "contractor_identified", "contact_identified", "outreach_started", "meeting_scheduled", "proposal_sent", "won", "lost", "not_qualified"].includes(String(req.body.status)) ? String(req.body.status) : "new",
        projectStatus: String(req.body.projectStatus || "Unknown").slice(0, 120),
        estimatedStartDate: date(req.body.estimatedStartDate),
        estimatedCompletionDate: date(req.body.estimatedCompletionDate),
        primeContractor: String(req.body.primeContractor || "").slice(0, 240) || null,
        engineeringFirm: String(req.body.engineeringFirm || "").slice(0, 240) || null,
        architect: String(req.body.architect || "").slice(0, 240) || null,
        projectManager: String(req.body.projectManager || "").slice(0, 240) || null,
        knownSubcontractorsJson: subcontractors,
        demandTypesJson: demandTypes,
        notes: String(req.body.notes || "").slice(0, 4000) || null,
        nextAction: String(req.body.nextAction || "Verify the project schedule and identify awarded firms").slice(0, 500),
        followUpDate: date(req.body.followUpDate),
        assignedUserId: req.salesUser.id,
        lastVerifiedAt: null,
        createdByUserId: req.salesUser.id,
      }).returning();
      res.status(201).json({ project });
    } catch (error) { next(error); }
  });

  router.post("/advisor/demand/research", async (req: any, res, next) => {
    try {
      const hotelId = String(req.body.hotelId || "");
      if (!hasHotel(req, hotelId)) return res.status(403).json({ error: "You do not have access to that property." });
      const { targetYear, targetMonth } = monthlyTargetPeriod(req.body);
      const discovered = await researchDemandEvents(targetYear, targetMonth);
      const start = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
      const next = new Date(Date.UTC(targetYear, targetMonth, 1));
      const end = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
      const existing = await db.select().from(courtyardSalesDemandEvents).where(and(eq(courtyardSalesDemandEvents.hotelId, hotelId), gte(courtyardSalesDemandEvents.startDate, start), lt(courtyardSalesDemandEvents.startDate, end)));
      const keys = new Set(existing.map((event) => `${event.eventName.toLowerCase()}|${event.startDate}|${event.sourceUrl}`));
      const fresh = discovered.filter((event: any) => !keys.has(`${event.eventName.toLowerCase()}|${event.startDate}|${event.sourceUrl}`));
      const inserted = fresh.length ? await db.insert(courtyardSalesDemandEvents).values(fresh.map((event: any) => ({ hotelId, ...event, opportunityTypesJson: event.opportunityTypes, targetRolesJson: event.targetRoles, evidenceStatus: "verified_source", sourceLastVerifiedAt: new Date(), createdByUserId: req.salesUser.id }))).returning() : [];
      res.json({ discovered: discovered.length, added: inserted.length });
    } catch (error: any) {
      if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message });
      next(error);
    }
  });

  router.post("/advisor/demand/discover-businesses", async (req: any, res, next) => {
    try {
      const hotelId = String(req.body.hotelId || "");
      if (!hasHotel(req, hotelId)) return res.status(403).json({ error: "You do not have access to that property." });
      const discovery = await discoverRegionalBusinesses();
      const discovered = discovery.prospects;
      const saved = [];
      for (const prospect of discovered) {
        const [row] = await db.insert(courtyardSalesRegionalProspects).values({ hotelId, ...prospect, latitude: String(prospect.latitude), longitude: String(prospect.longitude), distanceMiles: String(prospect.distanceMiles), sourceType: "google_places", lastVerifiedAt: new Date(), createdByUserId: req.salesUser.id }).onConflictDoUpdate({ target: [courtyardSalesRegionalProspects.hotelId, courtyardSalesRegionalProspects.sourceType, courtyardSalesRegionalProspects.sourceId], set: { companyName: prospect.companyName, address: prospect.address, latitude: String(prospect.latitude), longitude: String(prospect.longitude), distanceMiles: String(prospect.distanceMiles), distanceBand: prospect.distanceBand, industry: prospect.industry, website: prospect.website, phone: prospect.phone, sourceUrl: prospect.sourceUrl, opportunitySignalsJson: prospect.opportunitySignalsJson, targetRolesJson: prospect.targetRolesJson, evidenceClass: prospect.evidenceClass, opportunityScore: prospect.opportunityScore, rationale: prospect.rationale, lastVerifiedAt: new Date(), updatedAt: new Date() } }).returning();
        saved.push(row);
      }
      res.json({ discovered: discovered.length, saved: saved.length, diagnostics: discovery.diagnostics });
    } catch (error: any) {
      if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message });
      next(error);
    }
  });

  router.get("/advisor/preview", async (req: any, res, next) => {
    try {
      const hotelId = String(req.query.hotelId || req.salesHotels[0]?.id || "");
      if (!hasHotel(req, hotelId))
        return res.status(403).json({ error: "You do not have access to that property." });
      const parameters = advisorParameters(req.query);
      const source = await advisorSourceData(hotelId);
      res.json(buildSalesAdvisorPreview({ ...source, ...parameters } as any));
    } catch (error) {
      next(error);
    }
  });

  router.post("/advisor/assist", async (req: any, res, next) => {
    try {
      const hotelId = String(req.body.hotelId || "");
      if (!hasHotel(req, hotelId)) return res.status(403).json({ error: "You do not have access to that property." });
      const assistanceType = String(req.body.assistanceType || "");
      if (!["email", "call_script", "research_checklist"].includes(assistanceType)) return res.status(400).json({ error: "Choose a valid Sales Advisor assistance type." });
      const accountKey = String(req.body.accountKey || "");
      const projectId = String(req.body.projectId || "");
      let evidence: any;
      if (accountKey) {
        const source = await advisorSourceData(hotelId);
        const preview = buildSalesAdvisorPreview({ ...source, lookbackMonths: 36, businessTypes: [...SALES_ADVISOR_BUSINESS_TYPES], analysisType: "full_plan" } as any);
        const candidate = preview.candidates.find((item) => item.key === accountKey);
        if (!candidate) return res.status(404).json({ error: "Sales opportunity not found in the authorized hotel data." });
        const [crm] = await db.select().from(courtyardSalesOpportunities).where(and(eq(courtyardSalesOpportunities.hotelId, hotelId), eq(courtyardSalesOpportunities.normalizedAccountKey, accountKey))).orderBy(desc(courtyardSalesOpportunities.updatedAt)).limit(1);
        const { history, ...summary } = candidate;
        evidence = { source: "hotel production data", opportunity: { ...summary, recentHistory: history.slice(-6) }, crm: crm ? { stage: crm.stage, nextAction: crm.nextAction, nextActionAt: crm.nextActionAt, notes: crm.notes } : null };
      } else if (projectId) {
        const [project] = await db.select().from(courtyardSalesRegionalProspects).where(and(eq(courtyardSalesRegionalProspects.hotelId, hotelId), eq(courtyardSalesRegionalProspects.id, projectId), eq(courtyardSalesRegionalProspects.sourceType, "public_project"))).limit(1);
        if (!project) return res.status(404).json({ error: "Project lead not found." });
        evidence = { source: project.sourceUrl ? "user-entered project information with a linked public source" : "user-entered project information", project: { name: project.companyName, city: project.city, category: project.industry, projectStatus: project.projectStatus, estimatedStartDate: project.estimatedStartDate, estimatedCompletionDate: project.estimatedCompletionDate, location: project.address, primeContractor: project.primeContractor, engineeringFirm: project.engineeringFirm, architect: project.architect, projectManager: project.projectManager, knownSubcontractors: project.knownSubcontractorsJson, demandTypes: project.demandTypesJson, notes: project.notes, nextAction: project.nextAction, sourceUrl: project.sourceUrl }, warning: "A linked URL is not proof that every user-entered field was verified." };
      } else return res.status(400).json({ error: "Choose a named opportunity or project lead." });
      const result = await generateSalesAdvisorAssistance(evidence, assistanceType as any);
      res.json({ assistanceType, result });
    } catch (error: any) {
      if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message });
      next(error);
    }
  });

  router.get("/advisor/analyses", async (req: any, res, next) => {
    try {
      const hotelId = String(req.query.hotelId || req.salesHotels[0]?.id || "");
      if (!hasHotel(req, hotelId))
        return res.status(403).json({ error: "You do not have access to that property." });
      const rows = await db
        .select()
        .from(courtyardSalesAdvisorAnalyses)
        .where(eq(courtyardSalesAdvisorAnalyses.hotelId, hotelId))
        .orderBy(desc(courtyardSalesAdvisorAnalyses.createdAt))
        .limit(12);
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  router.post("/advisor/generate", async (req: any, res, next) => {
    try {
      const hotelId = String(req.body.hotelId || req.salesHotels[0]?.id || "");
      if (!hasHotel(req, hotelId))
        return res.status(403).json({ error: "You do not have access to that property." });
      const parameters = advisorParameters(req.body);
      const source = await advisorSourceData(hotelId);
      const preview = buildSalesAdvisorPreview({ ...source, ...parameters } as any);
      if (!preview.candidates.length)
        return res.status(400).json({ error: "No named prospects match these filters. Import or broaden the source data first." });
      const [crmOpportunities, projectLeads] = await Promise.all([
        db.select().from(courtyardSalesOpportunities).where(eq(courtyardSalesOpportunities.hotelId, hotelId)).orderBy(desc(courtyardSalesOpportunities.updatedAt)).limit(150),
        db.select().from(courtyardSalesRegionalProspects).where(eq(courtyardSalesRegionalProspects.hotelId, hotelId)).orderBy(desc(courtyardSalesRegionalProspects.updatedAt)).limit(150),
      ]);
      const executionState = {
        crm: crmOpportunities.map((item) => [item.id, item.normalizedAccountKey, item.stage, item.nextActionAt, item.updatedAt]),
        projects: projectLeads.filter((item) => item.sourceType === "public_project").map((item) => [item.id, item.status, item.followUpDate, item.updatedAt]),
      };
      const sourceFingerprint = salesAdvisorFingerprint(source.batches as any, { ...parameters, executionState });
      if (!req.body.regenerate) {
        const [cached] = await db
          .select()
          .from(courtyardSalesAdvisorAnalyses)
          .where(
            and(
              eq(courtyardSalesAdvisorAnalyses.hotelId, hotelId),
              eq(courtyardSalesAdvisorAnalyses.sourceFingerprint, sourceFingerprint),
              eq(courtyardSalesAdvisorAnalyses.status, "completed"),
            ),
          )
          .orderBy(desc(courtyardSalesAdvisorAnalyses.createdAt))
          .limit(1);
        if (cached) return res.json({ ...cached, cached: true });
      }
      const candidateKeys = new Set(preview.topPriorities.map((candidate) => candidate.key));
      const context = {
        ...compactAdvisorContext(preview),
        crmExecution: crmOpportunities.filter((item) => candidateKeys.has(item.normalizedAccountKey)).map((item) => ({ accountKey: item.normalizedAccountKey, stage: item.stage, nextAction: item.nextAction, nextActionAt: item.nextActionAt })),
        publicProjects: projectLeads.filter((item) => item.sourceType === "public_project").slice(0, 20).map((item) => ({ name: item.companyName, status: item.status, projectStatus: item.projectStatus, sourceUrl: item.sourceUrl, demandTypes: item.demandTypesJson, nextAction: item.nextAction, followUpDate: item.followUpDate, evidence: item.sourceUrl ? "user-entered with public source" : "user-entered" })),
      };
      const narrative = await generateSalesAdvisorNarrative(context as any);
      const validKeys = new Set(preview.candidates.map((candidate) => candidate.key));
      const result = {
        ...narrative,
        priorities: narrative.priorities.filter((item) => validKeys.has(item.accountKey)),
        demandDrivers: narrative.demandDrivers.filter((item) => validKeys.has(item.accountKey)),
      };
      const [analysis] = await db
        .insert(courtyardSalesAdvisorAnalyses)
        .values({
          hotelId,
          createdByUserId: req.salesUser.id,
          analysisType: parameters.analysisType,
          lookbackMonths: parameters.lookbackMonths,
          businessTypesJson: parameters.businessTypes,
          requestParametersJson: parameters,
          sourceFingerprint,
          inputSnapshotJson: preview,
          resultJson: result,
          model: salesAdvisorModel(),
          promptVersion: SALES_ADVISOR_PROMPT_VERSION,
          status: "completed",
          updatedAt: new Date(),
        })
        .returning();
      res.status(201).json({ ...analysis, cached: false });
    } catch (error: any) {
      if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message });
      next(error);
    }
  });

  router.get("/advisor/analyses/:id.pdf", async (req: any, res, next) => {
    try {
      const hotelId = String(req.query.hotelId || req.salesHotels[0]?.id || "");
      if (!hasHotel(req, hotelId))
        return res.status(403).json({ error: "You do not have access to that property." });
      const [analysis] = await db
        .select()
        .from(courtyardSalesAdvisorAnalyses)
        .where(and(eq(courtyardSalesAdvisorAnalyses.id, req.params.id), eq(courtyardSalesAdvisorAnalyses.hotelId, hotelId)))
        .limit(1);
      if (!analysis) return res.status(404).json({ error: "Analysis not found." });
      const hotelName = req.salesHotels.find((hotel: any) => hotel.id === hotelId)?.name || "Courtyard Hotel";
      const bytes = await createAdvisorPdf(analysis, hotelName);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="sales-advisor-${analysis.id}.pdf"`);
      res.send(Buffer.from(bytes));
    } catch (error) {
      next(error);
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
