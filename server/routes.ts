import type { Express } from "express";
import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import crypto from "crypto";
import zlib from "zlib";
import cors from "cors";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import OpenAI from "openai";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { Client, Environment, LogLevel, OrdersController } from "@paypal/paypal-server-sdk";
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { storage } from "./storage";
import { db } from "./db";
import { insertAircraftListingSchema, insertMarketplaceListingSchema, insertRentalSchema, insertMessageSchema, insertReviewSchema, insertFavoriteSchema, insertAirportFavoriteSchema, insertExpenseSchema, insertJobApplicationSchema, insertPromoAlertSchema, insertBannerAdSchema, insertLogbookEntrySchema, insertLogbookProSettingsSchema, insertLogbookArchiveSchema, insertFlightPlanSchema, insertAircraftProfileSchema, insertAircraftTypeSchema, insertEndorsementSchema, insertNotificationPreferencesSchema, insertUserSettingsSchema, insertPushTokenSchema, insertRadioCommsSessionSchema, insertAviationEventSchema, insertAnalyticsEventSchema, insertHkDailyMetricSchema, insertHkAttendantMetricSchema, insertCfiProfileSchema, insertCfiSchoolSchema, insertCfiSchoolMemberSchema, insertCfiCredentialSchema, insertCfiAvailabilityRuleSchema, insertCfiBookingRequestSchema, insertCfiStudentSchema, insertCfiLessonTemplateSchema, insertCfiLessonSchema, insertCfiStudentFileSchema, insertCfiStudentMilestoneSchema, insertCfiStudentEndorsementSchema, insertCfiConversationSchema, insertCfiMessageSchema, insertCfiLegalAcceptanceSchema, insertPartnerRedirectSchema, partnerRedirects, aviationEvents, notams as notamsTable, users, cfiStudents, cfiConversations, cfiMessages, cfiProfiles, cfiLessons, cfiStudentMilestones, type BannerAdOrder, type HkDailyMetric, type HkAttendantMetric } from "@shared/schema";
import { renderHkMetricsPdf } from "./hk-metrics-pdf";
import { addDays, format, getISOWeek, getISOWeekYear, parse, parseISO, startOfISOWeek, endOfISOWeek, startOfMonth, endOfMonth } from "date-fns";
import { gpsTrainerUnits } from "@shared/gps-sims";
import { setupAuth, isAuthenticated, isAdmin, isSuperAdmin } from "./auth";
import { getUncachableResendClient } from "./resendClient";
import { sendBannerAdvertiserContactEmail, sendContactFormEmail, sendMarketplaceListingContactEmail } from "./email-templates";
import { ADMIN_PERMISSIONS, ADMIN_ROLE_PERMISSIONS, normalizeAdminPermissions, type AdminPermission, type AdminRole } from "@shared/config/adminAccess";
import registerMobileAuthRoutes from "./mobile-auth-routes";
import { registerUnifiedAuthRoutes } from "./unified-auth-routes";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { getBasePrice, getUpgradeDelta, calculateTotalWithTax, isValidUpgrade, VALID_TIERS } from "@shared/config/listingPricing";
import { paypalRequest } from "./paypal-client";
import { getEntitlementsForUser, isSuperAdminEmail, mapPayPalStatusToMembership, resolveMembershipFromPlanId, resolvePayPalPlanId } from "./membership";
import { maybeSyncLogbookProSubscription } from "./paypal-subscription-sync";
import { buildMarketplaceListingFeeBreakdown } from "./marketplace-fees";
import { resolveTfmsAccess } from "./lib/tier";
import { resolveTfmsProviderKey, type TfmsOverlay, type TfmsStatus } from "./services/tfms/provider";
import { createStubTfmsProvider } from "./services/tfms/providers/stub";
import { createSoftAuthRateLimiter } from "./middleware/rateLimit";
import { createDbTfmsProvider } from "./services/tfms/providers/db";
import { computeTfmsRisk } from "./services/tfms/risk";
import { partners } from "./config/partners";
import {
  fetchMetar,
  fetchTaf,
  fetchPireps,
  fetchAirSigmets,
  fetchGAirmets,
  fetchAirmets,
  fetchTcf,
  fetchWindsAloftReport,
  buildEmptyStub,
} from "./services/aviation-weather";

// Initialize OpenAI client with fallback to standard OpenAI if Replit integration vars are missing
const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
// Prefer AI_INTEGRATIONS_OPENAI_BASE_URL if valid, otherwise OPENAI_BASE_URL, and only apply when it looks like a URL
const configuredBaseUrl = (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || "").trim();
const openaiBaseUrl = configuredBaseUrl && configuredBaseUrl.startsWith("http") ? configuredBaseUrl : undefined;

if (configuredBaseUrl && !openaiBaseUrl) {
  console.warn("OpenAI base URL ignored because it is not a valid http(s) URL", configuredBaseUrl);
}

const openai = new OpenAI({
  apiKey: openaiApiKey,
  ...(openaiBaseUrl ? { baseURL: openaiBaseUrl } : {}),
});

// Initialize PayPal SDK
if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
  throw new Error('Missing required PayPal secrets: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET');
}

const isProd = process.env.NODE_ENV === "production";

const paypalClient = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: process.env.PAYPAL_CLIENT_ID,
    oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET,
  },
  timeout: 0,
  environment: isProd ? Environment.Production : Environment.Sandbox,
  logging: isProd
    ? {
        logLevel: LogLevel.Error,
        logRequest: { logBody: false },
        logResponse: { logHeaders: false },
      }
    : {
        logLevel: LogLevel.Info,
        logRequest: { logBody: true },
        logResponse: { logHeaders: true },
      },
});

const ordersController = new OrdersController(paypalClient);

const logDebug = (...args: unknown[]) => {
  if (!isProd) {
    console.log(...args);
  }
};

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

type FlightCategory = "VFR" | "MVFR" | "IFR" | "LIFR" | "UNKNOWN";
const computeFlightCategory = (metar: any): FlightCategory => {
  const declared = String(metar?.fltCat || metar?.flightCategory || "").toUpperCase();
  if (declared === "VFR" || declared === "MVFR" || declared === "IFR" || declared === "LIFR") {
    return declared as FlightCategory;
  }
  const raw = metar?.rawOb || metar?.raw || "";
  if (!raw) return "UNKNOWN";
  const visMatch = raw.match(/\s(\d{1,2})SM/);
  const visibility = visMatch ? parseInt(visMatch[1], 10) : 10;
  const ceilingMatch = raw.match(/(BKN|OVC)(\d{3})/);
  const ceiling = ceilingMatch ? parseInt(ceilingMatch[2], 10) * 100 : 10000;

  if (ceiling >= 3000 && visibility > 5) return "VFR";
  if (ceiling >= 1000 && visibility >= 3) return "MVFR";
  if (ceiling >= 500 && visibility >= 1) return "IFR";
  return "LIFR";
};

type CloudFrameCache = {
  fetchedAt: number;
  frames: string[];
};

const cloudFrameCacheBySource: Record<string, CloudFrameCache> = {};

const CLOUD_FRAME_TTL = 1000 * 60 * 5;

const parseIsoDurationMinutes = (value: string) => {
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!match) return null;
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = match[2] ? Number(match[2]) : 0;
  const total = hours * 60 + minutes;
  return Number.isFinite(total) && total > 0 ? total : null;
};

const buildRecentTimes = (end: Date, intervalMinutes: number, count: number) => {
  const times: string[] = [];
  const intervalMs = intervalMinutes * 60 * 1000;
  const endMs = Math.floor(end.getTime() / intervalMs) * intervalMs;
  for (let i = count - 1; i >= 0; i -= 1) {
    const time = new Date(endMs - intervalMs * i);
    times.push(time.toISOString().replace(".000Z", "Z"));
  }
  return times;
};

const parseGibsTimeDimension = (value: string, count: number) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("/")) {
    const [start, end, period] = trimmed.split("/");
    const intervalMinutes = period ? parseIsoDurationMinutes(period) : null;
    const endDate = end ? new Date(end) : null;
    if (!endDate || Number.isNaN(endDate.getTime()) || !intervalMinutes) return null;
    return buildRecentTimes(endDate, intervalMinutes, count);
  }
  const values = trimmed.split(",").map((item) => item.trim()).filter(Boolean);
  if (values.length === 0) return null;
  return values.slice(-count);
};


function getPublicBaseUrl() {
  const base =
    process.env.APP_BASE_URL ||
    process.env.WEB_BASE_URL ||
    process.env.REPLIT_DEV_DOMAIN ||
    process.env.RENDER_EXTERNAL_URL ||
    "http://localhost:5000";
  return base.startsWith("http") ? base : `https://${base}`;
}

const marketingSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET || "default-jwt-secret-change-in-production";

function signMarketingToken(payload: Record<string, any>) {
  return jwt.sign(payload, marketingSecret, { expiresIn: "180d" });
}

function verifyMarketingToken(token: string): Record<string, any> | null {
  try {
    return jwt.verify(token, marketingSecret) as Record<string, any>;
  } catch {
    return null;
  }
}

function parsePayPalCustomId(customId: string) {
  const result: Record<string, string> = {};
  if (!customId) return result;
  const parts = customId.split("|").map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    const [key, ...rest] = part.split(":");
    if (!key || rest.length === 0) continue;
    result[key] = rest.join(":");
  }
  return result;
}

function toCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function normalizeAnalyticsPage(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("http")) {
    try {
      const url = new URL(trimmed);
      return url.pathname || "/";
    } catch {}
  }
  if (trimmed.startsWith("/")) return trimmed;
  return `/${trimmed}`;
}

function deriveAnalyticsPage(event: string, page: unknown, params: Record<string, any> | undefined): string | undefined {
  if (event === "student_page_view" && typeof params?.page === "string") {
    return normalizeAnalyticsPage(`/student/${params.page.replace(/^\/+/, "")}`);
  }
  if (event === "planner_page_view") return "/flight-planner";
  if (event === "gps_sims_hub_view") return "/gps-sims";
  if (event === "gps_sims_unit_view" && typeof params?.unit === "string") {
    return normalizeAnalyticsPage(`/gps-sims/${params.unit}`);
  }
  if (event === "radio_comms_view") return "/radio-comms-trainer";
  if (event === "marketplace_view") return "/marketplace";
  if (event === "rentals_view") return "/rentals";
  if (event === "ifr_tools_view") return "/ifr-tools";
  if (event === "pilot_tools_view") return "/pilot-tools";
  const fallback =
    (typeof page === "string" && page) ||
    (typeof params?.page === "string" && params.page) ||
    (typeof params?.target === "string" && params.target) ||
    "";
  return normalizeAnalyticsPage(fallback);
}

const formatMetricDate = (value: string | Date | null | undefined) => {
  if (!value) return "";
  if (typeof value === "string") return value.split("T")[0];
  if (value instanceof Date) return format(value, "yyyy-MM-dd");
  return "";
};

const normalizeHkNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundTo = (value: number | null, digits = 2) => {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

const computeStandardHours = (checkouts: number, stayovers: number) => roundTo(checkouts * 0.5 + stayovers * 0.25);

const computeRate = (hours: number, rooms: number, multiplier = 1) => {
  if (!rooms) return null;
  return roundTo((hours * multiplier) / rooms);
};

const computeDailyDerived = (entry: HkDailyMetric) => {
  const roomsSoldValue = entry.roomsSold ?? null;
  const totalDailyHoursValue = entry.totalDailyHours ?? null;
  const roomsSold = normalizeHkNumber(entry.roomsSold);
  const totalDailyHours = normalizeHkNumber(entry.totalDailyHours);
  const checkouts = normalizeHkNumber(entry.checkouts);
  const stayovers = normalizeHkNumber(entry.stayovers);
  const roomsCleaned = normalizeHkNumber(entry.roomsCleaned);
  const paidHours = normalizeHkNumber(entry.paidHours);
  const productiveHours = normalizeHkNumber(entry.productiveHours);
  const standardHours = computeStandardHours(checkouts, stayovers);
  const varianceHours = standardHours === null ? null : roundTo(paidHours - standardHours);
  const roomsForMpor = normalizeHkNumber(entry.checkouts) + normalizeHkNumber(entry.stayovers);
  const mporPaid = computeRate(paidHours, roomsForMpor, 60);
  const mporProductive = computeRate(productiveHours, roomsForMpor, 60);
  const hpor = computeRate(totalDailyHours, roomsSold, 1);
  const avgMinutesPerRoom = computeRate(productiveHours, roomsCleaned, 60);

  return {
    ...entry,
    metricDate: formatMetricDate(entry.metricDate as any),
    roomsSold: roomsSoldValue,
    totalDailyHours: totalDailyHoursValue,
    standardHours,
    varianceHours,
    mporPaid,
    mporProductive,
    hpor,
    avgMinutesPerRoom,
  };
};

const computeAttendantDerived = (entry: HkAttendantMetric) => {
  const checkouts = normalizeHkNumber(entry.checkoutsCleaned);
  const stayovers = normalizeHkNumber(entry.stayoversCleaned);
  const roomsCleaned = normalizeHkNumber(entry.roomsCleaned);
  const paidHours = normalizeHkNumber(entry.paidHours);
  const productiveHours = normalizeHkNumber(entry.productiveHours);
  const standardHours = computeStandardHours(checkouts, stayovers);
  const varianceHours = standardHours === null ? null : roundTo(paidHours - standardHours);
  const mporPaid = computeRate(paidHours, roomsCleaned, 60);
  const mporProductive = computeRate(productiveHours, roomsCleaned, 60);
  const hpor = computeRate(paidHours, roomsCleaned, 1);
  const avgMinutesPerRoom = computeRate(productiveHours, roomsCleaned, 60);

  return {
    ...entry,
    metricDate: formatMetricDate(entry.metricDate as any),
    standardHours,
    varianceHours,
    mporPaid,
    mporProductive,
    hpor,
    avgMinutesPerRoom,
  };
};

const normalizeHeaderToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const detectRoomsSoldHeader = (line: string) => {
  if (!line) return null;
  const delimiter = line.includes("\t") ? "\t" : line.includes(",") ? "," : "  ";
  const columns = delimiter === "  " ? line.trim().split(/\s{2,}/) : line.split(delimiter);
  const normalized = columns.map((col) => normalizeHeaderToken(col));
  const dateIndex = normalized.findIndex((token) => token.includes("date"));
  const roomsIndex = normalized.findIndex((token) =>
    ["roomssold", "roomsold", "rmsold", "rooms", "roomsoccupied", "occupied", "occ"].some((key) => token.includes(key))
  );
  if (dateIndex === -1 || roomsIndex === -1) return null;
  return { delimiter, dateIndex, roomsIndex };
};

const parseRoomsSoldDateToken = (token: string) => {
  const trimmed = token.trim();
  const isoMatch = trimmed.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(date.getTime())) return format(date, "yyyy-MM-dd");
  }

  const slashMatch = trimmed.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    const date = parse(`${month}/${day}/${year}`, "M/d/yyyy", new Date());
    if (!Number.isNaN(date.getTime())) return format(date, "yyyy-MM-dd");
  }

  const compactMatch = trimmed.match(/\b(\d{1,2})([A-Za-z]{3})(\d{2})\b/);
  if (compactMatch) {
    const [, day, monthToken, year] = compactMatch;
    const date = parse(`${day}${monthToken}${year}`, "dMMMyy", new Date());
    if (!Number.isNaN(date.getTime())) return format(date, "yyyy-MM-dd");
  }

  const monthMap: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  const alphaMatch = trimmed.match(/\b(\d{1,2})-([A-Za-z]{3})-(\d{4})\b/);
  if (alphaMatch) {
    const [, day, monthToken, year] = alphaMatch;
    const monthIndex = monthMap[monthToken.toLowerCase()];
    if (monthIndex !== undefined) {
      const date = new Date(Number(year), monthIndex, Number(day));
      if (!Number.isNaN(date.getTime())) return format(date, "yyyy-MM-dd");
    }
  }
  return null;
};

const extractRoomsSoldFromLine = (line: string) => {
  const roomsSoldMatch = line.match(/#\s*rooms\s*sold\b/i);
  const roomsOccupiedMatch = line.match(/#\s*rooms\s*occupied\b/i);
  const roomNightsSoldMatch = line.match(/#\s*room\s*nights\s*sold\b/i);
  const targetMatch = roomsSoldMatch || roomNightsSoldMatch || roomsOccupiedMatch;
  if (!targetMatch) return null;

  const after = line.slice(targetMatch.index ? targetMatch.index + targetMatch[0].length : 0);
  const match = after.match(/\b\d[\d,]*\b/);
  if (match) return Number(match[0].replace(/,/g, ""));
  return null;
};

const extractTotalRoomSalesFromLine = (line: string) => {
  if (!/total\s+room\s+sales/i.test(line)) return null;
  const tokens = (line.match(/\d[\d,]*\.?\d*-?/g) || []) as string[];
  if (tokens.length < 3) return null;
  const dailyToken = tokens[0];
  const mtdToken = tokens[2];
  if (!dailyToken || !mtdToken) return null;
  const toSignedNumber = (token: string) => {
    const trimmed = token.trim();
    const isNegative = trimmed.endsWith("-");
    const numeric = Number(trimmed.replace(/,/g, "").replace(/-$/, ""));
    return isNegative ? -numeric : numeric;
  };
  const daily = toSignedNumber(dailyToken);
  const mtd = toSignedNumber(mtdToken);
  if (!Number.isFinite(daily) || !Number.isFinite(mtd)) return null;
  return { roomRevenueDaily: daily, roomRevenueMtd: mtd };
};

const parseRoomsSoldFile = (content: string) => {
  const lines = content.split(/\r?\n/);
  const skipped: Array<{ line: number; reason: string; raw: string }> = [];
  const parsed: Array<{ line: number; date: string; roomsSold: number; raw: string }> = [];
  const parsedRevenue: Array<{ line: number; date: string; roomRevenueDaily: number; roomRevenueMtd: number; raw: string }> = [];
  const headerLineIndex = lines.findIndex((line) => detectRoomsSoldHeader(line));
  const headerInfo = headerLineIndex >= 0 ? detectRoomsSoldHeader(lines[headerLineIndex]) : null;
  let defaultDate: string | null = null;

  for (const line of lines) {
    const dateMatch = line.match(/\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{1,2}-[A-Za-z]{3}-\d{4}\b|\b\d{1,2}[A-Za-z]{3}\d{2}\b/);
    if (dateMatch) {
      const parsedDate = parseRoomsSoldDateToken(dateMatch[0]);
      if (parsedDate) {
        defaultDate = parsedDate;
        break;
      }
    }
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    if (headerInfo && index <= headerLineIndex) return;

    let dateToken: string | null = null;
    let roomsSold: number | null = null;

    if (headerInfo) {
      const parts = headerInfo.delimiter === "  " ? line.split(/\s{2,}/) : line.split(headerInfo.delimiter);
      const dateCell = parts[headerInfo.dateIndex] ?? "";
      const roomsCell = parts[headerInfo.roomsIndex] ?? "";
      dateToken = parseRoomsSoldDateToken(dateCell);
      const roomsMatch = roomsCell.match(/\b\d[\d,]*\b/);
      roomsSold = roomsMatch ? Number(roomsMatch[0].replace(/,/g, "")) : null;
    } else {
      const dateMatch = rawLine.match(/\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{1,2}-[A-Za-z]{3}-\d{4}\b|\b\d{1,2}[A-Za-z]{3}\d{2}\b/);
      dateToken = dateMatch ? parseRoomsSoldDateToken(dateMatch[0]) : null;
      roomsSold = extractRoomsSoldFromLine(rawLine);
    }

    const revenue = extractTotalRoomSalesFromLine(rawLine);
    if (revenue) {
      const revenueDate = dateToken || defaultDate;
      if (!revenueDate) {
        skipped.push({ line: index + 1, reason: "No date found for revenue", raw: rawLine });
      } else {
        parsedRevenue.push({
          line: index + 1,
          date: revenueDate,
          roomRevenueDaily: revenue.roomRevenueDaily,
          roomRevenueMtd: revenue.roomRevenueMtd,
          raw: rawLine,
        });
      }
    }

    if (!dateToken && roomsSold !== null && defaultDate) {
      dateToken = defaultDate;
    }

    if (!dateToken) {
      skipped.push({ line: index + 1, reason: "No date found", raw: rawLine });
      return;
    }
    if (roomsSold === null || Number.isNaN(roomsSold)) {
      skipped.push({ line: index + 1, reason: "No rooms sold value found", raw: rawLine });
      return;
    }
    parsed.push({ line: index + 1, date: dateToken, roomsSold, raw: rawLine });
  });

  return { parsed, parsedRevenue, skipped };
};

const aggregateDailyTotals = (entries: HkDailyMetric[]) => {
  return entries.reduce(
    (acc, entry) => {
      acc.occupiedRooms += normalizeHkNumber(entry.occupiedRooms);
      acc.roomsSold += normalizeHkNumber(entry.roomsSold);
      acc.roomRevenueDaily += normalizeHkNumber(entry.roomRevenueDaily);
      const roomRevenueMtd = normalizeHkNumber(entry.roomRevenueMtd);
      if (roomRevenueMtd > acc.roomRevenueMtd) {
        acc.roomRevenueMtd = roomRevenueMtd;
      }
      acc.checkouts += normalizeHkNumber(entry.checkouts);
      acc.stayovers += normalizeHkNumber(entry.stayovers);
      acc.roomsCleaned += normalizeHkNumber(entry.roomsCleaned);
      acc.paidHours += normalizeHkNumber(entry.paidHours);
      acc.lunchMinutes += normalizeHkNumber(entry.lunchMinutes);
      acc.productiveHours += normalizeHkNumber(entry.productiveHours);
      acc.attendantsWorking += normalizeHkNumber(entry.attendantsWorking);
      acc.lateCheckouts += normalizeHkNumber(entry.lateCheckouts);
      acc.inspections += normalizeHkNumber(entry.inspections);
      acc.recleans += normalizeHkNumber(entry.recleans);
      acc.dndRooms += normalizeHkNumber(entry.dndRooms);
      acc.oooRooms += normalizeHkNumber(entry.oooRooms);
      const roomsSold = normalizeHkNumber(entry.roomsSold);
      const totalDailyHours = normalizeHkNumber(entry.totalDailyHours);
      if (roomsSold > 0 && totalDailyHours > 0) {
        acc.totalDailyHours += totalDailyHours;
        acc.totalRoomsSoldForHpor += roomsSold;
        acc.hporEligibleDays += 1;
      } else {
        acc.hporMissingDays += 1;
      }
      return acc;
    },
    {
      occupiedRooms: 0,
      roomsSold: 0,
      roomRevenueDaily: 0,
      roomRevenueMtd: 0,
      checkouts: 0,
      stayovers: 0,
      roomsCleaned: 0,
      paidHours: 0,
      lunchMinutes: 0,
      productiveHours: 0,
      attendantsWorking: 0,
      lateCheckouts: 0,
      inspections: 0,
      recleans: 0,
      dndRooms: 0,
      oooRooms: 0,
      totalDailyHours: 0,
      totalRoomsSoldForHpor: 0,
      hporEligibleDays: 0,
      hporMissingDays: 0,
    }
  );
};

const buildDailyRollup = (totals: ReturnType<typeof aggregateDailyTotals>) => {
  const standardHours = computeStandardHours(totals.checkouts, totals.stayovers);
  const varianceHours = standardHours === null ? null : roundTo(totals.paidHours - standardHours);
  return {
    ...totals,
    paidHours: roundTo(totals.paidHours),
    productiveHours: roundTo(totals.productiveHours),
    totalDailyHours: roundTo(totals.totalDailyHours),
    roomRevenueDaily: roundTo(totals.roomRevenueDaily),
    roomRevenueMtd: roundTo(totals.roomRevenueMtd),
    standardHours,
    varianceHours,
    mporPaid: computeRate(totals.paidHours, totals.checkouts + totals.stayovers, 60),
    mporProductive: computeRate(totals.productiveHours, totals.checkouts + totals.stayovers, 60),
    hpor: computeRate(totals.totalDailyHours, totals.totalRoomsSoldForHpor, 1),
    avgMinutesPerRoom: computeRate(totals.productiveHours, totals.roomsCleaned, 60),
  };
};

const groupDailyByIsoWeek = (entries: HkDailyMetric[]) => {
  const map = new Map<string, { key: string; weekStart: string; weekEnd: string; totals: ReturnType<typeof aggregateDailyTotals> }>();
  entries.forEach((entry) => {
    const metricDate = formatMetricDate(entry.metricDate as any);
    if (!metricDate) return;
    const date = parseISO(metricDate);
    const key = `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, "0")}`;
    const weekStart = format(startOfISOWeek(date), "yyyy-MM-dd");
    const weekEnd = format(endOfISOWeek(date), "yyyy-MM-dd");
    if (!map.has(key)) {
      map.set(key, { key, weekStart, weekEnd, totals: aggregateDailyTotals([]) });
    }
    const bucket = map.get(key);
    if (bucket) {
      const totals = bucket.totals;
      totals.occupiedRooms += normalizeHkNumber(entry.occupiedRooms);
      totals.roomsSold += normalizeHkNumber(entry.roomsSold);
      totals.checkouts += normalizeHkNumber(entry.checkouts);
      totals.stayovers += normalizeHkNumber(entry.stayovers);
      totals.roomsCleaned += normalizeHkNumber(entry.roomsCleaned);
      totals.paidHours += normalizeHkNumber(entry.paidHours);
      totals.lunchMinutes += normalizeHkNumber(entry.lunchMinutes);
      totals.productiveHours += normalizeHkNumber(entry.productiveHours);
      totals.attendantsWorking += normalizeHkNumber(entry.attendantsWorking);
      totals.lateCheckouts += normalizeHkNumber(entry.lateCheckouts);
      totals.inspections += normalizeHkNumber(entry.inspections);
      totals.recleans += normalizeHkNumber(entry.recleans);
      totals.dndRooms += normalizeHkNumber(entry.dndRooms);
      totals.oooRooms += normalizeHkNumber(entry.oooRooms);
      const roomsSold = normalizeHkNumber(entry.roomsSold);
      const totalDailyHours = normalizeHkNumber(entry.totalDailyHours);
      if (roomsSold > 0 && totalDailyHours > 0) {
        totals.totalDailyHours += totalDailyHours;
        totals.totalRoomsSoldForHpor += roomsSold;
        totals.hporEligibleDays += 1;
      } else {
        totals.hporMissingDays += 1;
      }
    }
  });

  return Array.from(map.values())
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .map((bucket) => ({
      key: bucket.key,
      weekStart: bucket.weekStart,
      weekEnd: bucket.weekEnd,
      ...buildDailyRollup(bucket.totals),
    }));
};

const groupDailyByMonth = (entries: HkDailyMetric[]) => {
  const map = new Map<string, { key: string; monthStart: string; monthEnd: string; totals: ReturnType<typeof aggregateDailyTotals> }>();
  entries.forEach((entry) => {
    const metricDate = formatMetricDate(entry.metricDate as any);
    if (!metricDate) return;
    const date = parseISO(metricDate);
    const key = format(date, "yyyy-MM");
    const monthStart = format(startOfMonth(date), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(date), "yyyy-MM-dd");
    if (!map.has(key)) {
      map.set(key, { key, monthStart, monthEnd, totals: aggregateDailyTotals([]) });
    }
    const bucket = map.get(key);
    if (bucket) {
      const totals = bucket.totals;
      totals.occupiedRooms += normalizeHkNumber(entry.occupiedRooms);
      totals.roomsSold += normalizeHkNumber(entry.roomsSold);
      totals.checkouts += normalizeHkNumber(entry.checkouts);
      totals.stayovers += normalizeHkNumber(entry.stayovers);
      totals.roomsCleaned += normalizeHkNumber(entry.roomsCleaned);
      totals.paidHours += normalizeHkNumber(entry.paidHours);
      totals.lunchMinutes += normalizeHkNumber(entry.lunchMinutes);
      totals.productiveHours += normalizeHkNumber(entry.productiveHours);
      totals.attendantsWorking += normalizeHkNumber(entry.attendantsWorking);
      totals.lateCheckouts += normalizeHkNumber(entry.lateCheckouts);
      totals.inspections += normalizeHkNumber(entry.inspections);
      totals.recleans += normalizeHkNumber(entry.recleans);
      totals.dndRooms += normalizeHkNumber(entry.dndRooms);
      totals.oooRooms += normalizeHkNumber(entry.oooRooms);
      const roomsSold = normalizeHkNumber(entry.roomsSold);
      const totalDailyHours = normalizeHkNumber(entry.totalDailyHours);
      if (roomsSold > 0 && totalDailyHours > 0) {
        totals.totalDailyHours += totalDailyHours;
        totals.totalRoomsSoldForHpor += roomsSold;
        totals.hporEligibleDays += 1;
      } else {
        totals.hporMissingDays += 1;
      }
    }
  });

  return Array.from(map.values())
    .sort((a, b) => a.monthStart.localeCompare(b.monthStart))
    .map((bucket) => ({
      key: bucket.key,
      monthStart: bucket.monthStart,
      monthEnd: bucket.monthEnd,
      ...buildDailyRollup(bucket.totals),
    }));
};

const aggregateAttendantTotals = (entries: HkAttendantMetric[]) => {
  return entries.reduce(
    (acc, entry) => {
      acc.checkoutsCleaned += normalizeHkNumber(entry.checkoutsCleaned);
      acc.stayoversCleaned += normalizeHkNumber(entry.stayoversCleaned);
      acc.roomsCleaned += normalizeHkNumber(entry.roomsCleaned);
      acc.paidHours += normalizeHkNumber(entry.paidHours);
      acc.lunchMinutes += normalizeHkNumber(entry.lunchMinutes);
      acc.productiveHours += normalizeHkNumber(entry.productiveHours);
      acc.deepCleans += normalizeHkNumber(entry.deepCleans);
      acc.recleans += normalizeHkNumber(entry.recleans);
      acc.inspections += normalizeHkNumber(entry.inspections);
      acc.lateCheckouts += normalizeHkNumber(entry.lateCheckouts);
      return acc;
    },
    {
      checkoutsCleaned: 0,
      stayoversCleaned: 0,
      roomsCleaned: 0,
      paidHours: 0,
      lunchMinutes: 0,
      productiveHours: 0,
      deepCleans: 0,
      recleans: 0,
      inspections: 0,
      lateCheckouts: 0,
    }
  );
};

const buildAttendantRollup = (totals: ReturnType<typeof aggregateAttendantTotals>) => {
  const standardHours = computeStandardHours(totals.checkoutsCleaned, totals.stayoversCleaned);
  const varianceHours = standardHours === null ? null : roundTo(totals.paidHours - standardHours);
  return {
    ...totals,
    paidHours: roundTo(totals.paidHours),
    productiveHours: roundTo(totals.productiveHours),
    standardHours,
    varianceHours,
    mporPaid: computeRate(totals.paidHours, totals.roomsCleaned, 60),
    mporProductive: computeRate(totals.productiveHours, totals.roomsCleaned, 60),
    hpor: computeRate(totals.paidHours, totals.roomsCleaned, 1),
    avgMinutesPerRoom: computeRate(totals.productiveHours, totals.roomsCleaned, 60),
  };
};

const groupAttendants = (entries: HkAttendantMetric[]) => {
  const map = new Map<
    string,
    { attendantName: string; property: string; totals: ReturnType<typeof aggregateAttendantTotals>; daysWorked: Set<string> }
  >();

  entries.forEach((entry) => {
    const attendantName = (entry.attendantName || "").trim();
    const property = (entry.property || "").trim();
    if (!attendantName) return;
    const key = `${property}::${attendantName}`;
    if (!map.has(key)) {
      map.set(key, { attendantName, property, totals: aggregateAttendantTotals([]), daysWorked: new Set() });
    }
    const bucket = map.get(key);
    if (bucket) {
      const totals = bucket.totals;
      totals.checkoutsCleaned += normalizeHkNumber(entry.checkoutsCleaned);
      totals.stayoversCleaned += normalizeHkNumber(entry.stayoversCleaned);
      totals.roomsCleaned += normalizeHkNumber(entry.roomsCleaned);
      totals.paidHours += normalizeHkNumber(entry.paidHours);
      totals.lunchMinutes += normalizeHkNumber(entry.lunchMinutes);
      totals.productiveHours += normalizeHkNumber(entry.productiveHours);
      totals.deepCleans += normalizeHkNumber(entry.deepCleans);
      totals.recleans += normalizeHkNumber(entry.recleans);
      totals.inspections += normalizeHkNumber(entry.inspections);
      totals.lateCheckouts += normalizeHkNumber(entry.lateCheckouts);
      const metricDate = formatMetricDate(entry.metricDate as any);
      if (metricDate) bucket.daysWorked.add(metricDate);
    }
  });

  return Array.from(map.values())
    .map((bucket) => ({
      attendantName: bucket.attendantName,
      property: bucket.property,
      daysWorked: bucket.daysWorked.size,
      ...buildAttendantRollup(bucket.totals),
    }))
    .sort((a, b) => a.attendantName.localeCompare(b.attendantName));
};

const buildHkSummary = async (startDate: string, endDate: string, property?: string | null) => {
  const dailyEntries = await storage.getHkDailyMetrics(startDate, endDate, property);
  const attendantEntries = await storage.getHkAttendantMetrics(startDate, endDate, property);

  const dailyDerived = dailyEntries.map((entry) => computeDailyDerived(entry));
  const attendantDerived = attendantEntries.map((entry) => computeAttendantDerived(entry));

  const overall = buildDailyRollup(aggregateDailyTotals(dailyEntries));
  const weeklyRollups = groupDailyByIsoWeek(dailyEntries);
  const monthlyRollups = groupDailyByMonth(dailyEntries);
  const attendantRollups = groupAttendants(attendantEntries);

  return {
    dailyEntries: dailyDerived,
    attendantEntries: attendantDerived,
    weeklyRollups,
    monthlyRollups,
    attendantRollups,
    overall,
  };
};

const resolveHkDateRange = (query: any) => {
  const today = new Date();
  const defaultEnd = format(today, "yyyy-MM-dd");
  const startFallback = new Date(today);
  startFallback.setDate(startFallback.getDate() - 6);
  const defaultStart = format(startFallback, "yyyy-MM-dd");

  const startRaw = typeof query?.start === "string" ? query.start : defaultStart;
  const endRaw = typeof query?.end === "string" ? query.end : defaultEnd;
  const startDate = formatMetricDate(startRaw) || defaultStart;
  const endDate = formatMetricDate(endRaw) || defaultEnd;

  return { startDate, endDate };
};

function extractPayPalOrderAmount(orderData: any): { value: string; currency: string } | null {
  const unit = orderData?.purchase_units?.[0];
  const amountValue =
    unit?.amount?.value ??
    unit?.payments?.captures?.[0]?.amount?.value ??
    unit?.payments?.authorizations?.[0]?.amount?.value;
  const currency =
    unit?.amount?.currency_code ??
    unit?.amount?.currencyCode ??
    unit?.payments?.captures?.[0]?.amount?.currency_code ??
    unit?.payments?.captures?.[0]?.amount?.currencyCode ??
    unit?.payments?.authorizations?.[0]?.amount?.currency_code ??
    unit?.payments?.authorizations?.[0]?.amount?.currencyCode;
  if (!amountValue || !currency) return null;
  return { value: String(amountValue), currency: String(currency) };
}

async function getPayPalOrder(orderId: string) {
  const { body } = await ordersController.getOrder({ id: orderId } as any);
  return JSON.parse(String(body));
}

function getAdminPermissionsForUser(user: any): AdminPermission[] {
  if (!user) return [];
  if (user.isSuperAdmin) return [...ADMIN_PERMISSIONS];
  const role = user.adminRole as AdminRole | null | undefined;
  if (role && ADMIN_ROLE_PERMISSIONS[role]) {
    return ADMIN_ROLE_PERMISSIONS[role];
  }
  return normalizeAdminPermissions(null, user.adminPermissions ?? []);
}

function requireAdminPermission(permission: AdminPermission): express.RequestHandler {
  return async (req: any, res, next) => {
    if (String(process.env.AUTH_DISABLED ?? "").toLowerCase() === "true") return next();
    const userId = req.user?.claims?.sub || req.session?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUser(String(userId));
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: "Forbidden - Admin access required" });
    }
    const permissions = getAdminPermissionsForUser(user);
    if (!permissions.includes(permission)) {
      return res.status(403).json({ message: "Forbidden - Insufficient admin permissions" });
    }
    next();
  };
}

const requireUsersAdmin = requireAdminPermission("users");
const requireVerificationsAdmin = requireAdminPermission("verifications");
const requireAnalyticsAdmin = requireAdminPermission("analytics");
const requireWithdrawalsAdmin = requireAdminPermission("withdrawals");
const requireCrmAdmin = requireAdminPermission("crm");
const requireAircraftAdmin = requireAdminPermission("aircraft");
const requireMarketplaceAdmin = requireAdminPermission("marketplace");
const requireStaleAdmin = requireAdminPermission("stale");
const requirePromoAdmin = requireAdminPermission("promo");
const requirePromoCodesAdmin = requireAdminPermission("promo-codes");
const requireNotificationsAdmin = requireAdminPermission("notifications");
const requireBannersAdmin = requireAdminPermission("banners");
const requireHkMetricsAdmin = requireAdminPermission("hk-metrics");

const SAMPLE_MARKETPLACE_LISTINGS = [
  {
    id: "sample-marketplace-aircraft-sale",
    userId: "sample-user",
    category: "aircraft-sale",
    tier: "premium",
    title: "2007 Cessna 182T Skylane G1000 - Low Time",
    description:
      "Pristine, hangared Cessna 182T with Garmin G1000 avionics and fresh annual. Perfect for IFR cross-country missions with a full utility load and recent upgrades.",
    images: [
      "https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=1200",
      "https://images.unsplash.com/photo-1529078155058-5d716f45d604?w=1200",
    ],
    location: "Austin, TX",
    city: "Austin",
    state: "TX",
    zipCode: "78701",
    contactEmail: "listings@readysetfly.com",
    contactPhone: "512-555-0182",
    details: {
      make: "Cessna",
      model: "182T Skylane",
      year: "2007",
      registration: "N182RSF",
      seats: "4",
      totalTime: "1920",
      engineTime: "320",
      usefulLoad: "1120",
      annualDue: "2026-10-01",
      avionics: "Garmin G1000, GTX 345, GFC 700 Autopilot",
      interiorCondition: "excellent",
      exteriorCondition: "excellent",
      damageHistory: "None",
      engineType: "Single-Engine",
    },
    price: "289000",
    isActive: true,
    isPaid: true,
    isFeatured: true,
    isExample: true,
    viewCount: 0,
  },
  {
    id: "sample-marketplace-charter",
    userId: "sample-user",
    category: "charter",
    title: "Lone Star Charter - Citation CJ3+",
    description:
      "On-demand charter with a CJ3+ based at KDAL. Ideal for business travel across Texas and the Gulf Coast. 24/7 dispatch and concierge support.",
    images: ["https://images.unsplash.com/photo-1459603677915-a62079ffd002?w=1200"],
    location: "Dallas, TX",
    city: "Dallas",
    state: "TX",
    zipCode: "75235",
    contactEmail: "charter@readysetfly.com",
    contactPhone: "972-555-0140",
    details: {
      companyName: "Lone Star Charter",
      aircraftAvailable: "Citation CJ3+ (7 pax), Pilatus PC-12 (8 pax)",
      serviceArea: "Texas, Gulf Coast, Rocky Mountains",
      pricingStructure: "Hourly + reposition; transparent estimates within 30 minutes",
    },
    isActive: true,
    isPaid: true,
    isExample: true,
    viewCount: 0,
  },
  {
    id: "sample-marketplace-cfi",
    userId: "sample-user",
    category: "cfi",
    title: "Howard Hughes - Advanced CFI/CFII/MEI",
    description:
      "Yes, that Howard Hughes. Precision IFR training, complex aircraft checkouts, and multi-engine mentorship. Known for calm instruction and high standards.",
    images: ["https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200"],
    location: "Houston, TX",
    city: "Houston",
    state: "TX",
    zipCode: "77002",
    contactEmail: "cfi@readysetfly.com",
    contactPhone: "713-555-0194",
    details: {
      instructorName: "Howard Hughes",
      hourlyRate: "95",
      certifications: ["CFI", "CFII", "MEI"],
      specialties: "IFR proficiency, complex endorsements, multi-engine training",
    },
    price: "95",
    isActive: true,
    isPaid: true,
    isExample: true,
    viewCount: 0,
  },
  {
    id: "sample-marketplace-flight-school",
    userId: "sample-user",
    category: "flight-school",
    title: "Hill Country Flight Academy",
    description:
      "Accelerated programs for PPL, IR, and Commercial with a modern fleet and experienced instructors. Structured syllabi and flexible scheduling.",
    images: ["https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200"],
    location: "San Marcos, TX",
    city: "San Marcos",
    state: "TX",
    zipCode: "78666",
    contactEmail: "training@readysetfly.com",
    contactPhone: "512-555-0178",
    details: {
      schoolName: "Hill Country Flight Academy",
      aircraftFleet: "C172 G1000 (4), PA-28 (3), Seminole (1)",
      programsOffered: "Private, Instrument, Commercial, Multi-Engine, CFI",
      pricingInfo: "Flat-rate PPL packages and hourly pay-as-you-go options",
    },
    isActive: true,
    isPaid: true,
    isExample: true,
    viewCount: 0,
  },
  {
    id: "sample-marketplace-mechanic",
    userId: "sample-user",
    category: "mechanic",
    title: "AeroCare A&P - Mobile Maintenance",
    description:
      "FAA-certified A&P/IA with mobile service across Central Texas. Annuals, pre-buys, and avionics troubleshooting with transparent estimates.",
    images: ["https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200"],
    location: "Round Rock, TX",
    city: "Round Rock",
    state: "TX",
    zipCode: "78664",
    contactEmail: "maintenance@readysetfly.com",
    contactPhone: "737-555-0168",
    details: {
      businessName: "AeroCare Maintenance",
      specialties: "Annual inspections, pre-buys, avionics troubleshooting",
      serviceArea: "Central Texas, Hill Country",
    },
    isActive: true,
    isPaid: true,
    isExample: true,
    viewCount: 0,
  },
  {
    id: "sample-marketplace-job",
    userId: "sample-user",
    category: "job",
    title: "First Officer - Turboprop Charter (Full Time)",
    description:
      "Growing charter operator seeking a safety-focused First Officer. Competitive pay, schedule stability, and upgrade path to Captain within 12-18 months.",
    images: ["https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200"],
    location: "Fort Worth, TX",
    city: "Fort Worth",
    state: "TX",
    zipCode: "76177",
    contactEmail: "careers@readysetfly.com",
    contactPhone: "817-555-0139",
    details: {
      jobTitle: "First Officer",
      company: "SkyTrail Charter",
      employmentType: "Full-time",
      salaryRange: "$78k - $92k",
      requirements: "Commercial ASEL, 500 TT, turbine time preferred.",
    },
    isActive: true,
    isPaid: true,
    isExample: true,
    viewCount: 0,
  },
] as any[];

const SAMPLE_AIRCRAFT_LISTING = {
  id: "sample-aircraft-cessna-172",
  ownerId: "sample-owner",
  make: "Cessna",
  model: "172S Skyhawk",
  year: 2018,
  registration: "N172RSF",
  category: "Single-Engine",
  totalTime: 1250,
  engine: "Lycoming IO-360-L2A",
  avionicsSuite: "Garmin G1000 NXi",
  requiredCertifications: ["PPL", "IFR"],
  minFlightHours: 50,
  hourlyRate: "165",
  insuranceIncluded: true,
  wetRate: true,
  images: [
    "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?w=1200",
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200",
  ],
  location: "Georgetown, TX",
  city: "Georgetown",
  state: "TX",
  zipCode: "78628",
  airportCode: "KGTU",
  engineType: "Single-Engine",
  engineCount: 1,
  seatingCapacity: 4,
  description:
    "Sample rental listing with a modern G1000 NXi cockpit and freshly updated interior. Perfect for training, weekend trips, and instrument proficiency.",
  isListed: true,
  viewCount: 0,
  responseTime: 6,
  acceptanceRate: 98,
  isExample: true,
} as any;

const SAMPLE_MARKETPLACE_INDEX = new Map(
  SAMPLE_MARKETPLACE_LISTINGS.map((listing) => [listing.id, listing])
);

function getSampleMarketplaceListing(id: string) {
  return SAMPLE_MARKETPLACE_INDEX.get(id) || null;
}

function isSampleAircraftId(id: string) {
  return id === SAMPLE_AIRCRAFT_LISTING.id;
}

function matchesMarketplaceSampleFilters(listing: any, filters: any) {
  if (filters.category && listing.category !== filters.category) return false;
  if (filters.city) {
    const city = String(listing.city || listing.location || "").toLowerCase();
    if (!city.includes(String(filters.city).toLowerCase())) return false;
  }
  if (filters.keyword) {
    const haystack = `${listing.title || ""} ${listing.description || ""}`.toLowerCase();
    if (!haystack.includes(String(filters.keyword).toLowerCase())) return false;
  }
  const priceValue = listing.price !== null && listing.price !== undefined ? Number(listing.price) : null;
  if (filters.minPrice !== undefined && (priceValue === null || priceValue < filters.minPrice)) return false;
  if (filters.maxPrice !== undefined && (priceValue === null || priceValue > filters.maxPrice)) return false;
  if (filters.engineType && filters.engineType !== "all") {
    const details = listing.details || {};
    if (details.engineType !== filters.engineType) return false;
  }
  if (filters.cfiRating && filters.cfiRating !== "all") {
    const details = listing.details || {};
    if (!details.certifications || !details.certifications.includes(filters.cfiRating)) return false;
  }
  return true;
}

function getSampleMarketplaceListings(filters?: any) {
  if (!filters) return SAMPLE_MARKETPLACE_LISTINGS;
  return SAMPLE_MARKETPLACE_LISTINGS.filter((listing) =>
    matchesMarketplaceSampleFilters(listing, filters)
  );
}

const GPS_PANEL_KEYS = new Set(gpsTrainerUnits.map((unit) => unit.panel.imageKey));

function buildGpsPanelObjectKeys(imageKey: string): string[] {
  const normalizedKey = imageKey.replace(/\.png$/i, "");
  const unit = gpsTrainerUnits.find((item) => item.panel.imageKey === normalizedKey || item.id === normalizedKey);
  const candidates = new Set<string>([`uploads/${normalizedKey}.png`]);

  if (unit) {
    const title = unit.title.trim();
    if (title) {
      const spaced = title.replace(/\s+/g, " ").trim();
      const dashed = spaced.replace(/\s+/g, "-");
      const underscored = spaced.replace(/\s+/g, "_");
      const slug = spaced.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      candidates.add(`uploads/${spaced}.png`);
      candidates.add(`uploads/${dashed}.png`);
      candidates.add(`uploads/${underscored}.png`);
      if (slug) candidates.add(`uploads/${slug}.png`);
    }
  }

  return Array.from(candidates);
}

const AVIATION_EVENT_CATEGORIES = [
  "Airshow",
  "Fly-In",
  "Safety Seminar",
  "Training",
  "Meetup",
  "Charity",
  "Career",
  "Museum",
  "Other",
] as const;

const AVIATION_EVENT_BLOCKLIST = [
  "for sale",
  "for rent",
  "lease",
  "real estate",
  "crypto",
  "investment",
  "token",
  "loan",
  "mortgage",
  "affiliate",
  "marketing",
];

const SAMPLE_AVIATION_EVENTS = [
  {
    id: "sample-hill-country-fly-in",
    title: "Hill Country Fly-In Breakfast",
    description:
      "Sample event: Ramp-open breakfast with pilot briefing, local GA vendors, and short seminars on mountain flying.",
    location: "KGTU - Georgetown, TX",
    category: "Fly-In",
    eventUrl: "https://readysetfly.us/events/sample-hill-country",
    imageUrl: "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?w=1200",
    startDate: new Date("2026-03-07T14:00:00Z"),
    endDate: new Date("2026-03-07T18:00:00Z"),
    isSample: true,
  },
  {
    id: "sample-safety-seminar",
    title: "RSF Safety Seminar: Weather Decisions",
    description:
      "Sample event: Interactive safety session focused on weather decision-making and preflight go/no-go planning.",
    location: "AUS Flight School - Austin, TX",
    category: "Safety Seminar",
    eventUrl: "https://readysetfly.us/events/sample-weather",
    imageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200",
    startDate: new Date("2026-03-19T00:30:00Z"),
    endDate: new Date("2026-03-19T02:30:00Z"),
    isSample: true,
  },
  {
    id: "sample-career-night",
    title: "Southwest Aviation Career Night",
    description:
      "Sample event: Meet regional operators, hear from CFIs, and learn about time-building opportunities.",
    location: "KADS - Addison, TX",
    category: "Career",
    eventUrl: "https://readysetfly.us/events/sample-career-night",
    imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200",
    startDate: new Date("2026-04-02T23:00:00Z"),
    endDate: new Date("2026-04-03T01:00:00Z"),
    isSample: true,
  },
  {
    id: "sample-ifr-clinic",
    title: "Desert IFR Clinic",
    description:
      "Sample event: IFR training clinic with hold entries, approach briefings, and simulator demos.",
    location: "KSDL - Scottsdale, AZ",
    category: "Training",
    eventUrl: "https://readysetfly.us/events/sample-ifr-clinic",
    imageUrl: "https://images.unsplash.com/photo-1529078155058-5d716f45d604?w=1200",
    startDate: new Date("2026-04-11T16:00:00Z"),
    endDate: new Date("2026-04-11T21:00:00Z"),
    isSample: true,
  },
  {
    id: "sample-gulf-coast-airshow",
    title: "Gulf Coast Airshow Weekend",
    description:
      "Sample event: Weekend airshow with formation teams, static ramp access, and youth STEM briefings.",
    location: "KPNS - Pensacola, FL",
    category: "Airshow",
    eventUrl: "https://readysetfly.us/events/sample-gulf-coast-airshow",
    imageUrl: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200",
    startDate: new Date("2026-05-16T15:00:00Z"),
    endDate: new Date("2026-05-17T22:00:00Z"),
    isSample: true,
  },
  {
    id: "sample-charity-fly-in",
    title: "Wings for Warriors Charity Fly-In",
    description:
      "Sample event: Charity fly-in supporting veterans with ramp tours, sunrise departures, and raffles.",
    location: "KAPA - Centennial, CO",
    category: "Charity",
    eventUrl: "https://readysetfly.us/events/sample-charity-fly-in",
    imageUrl: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200",
    startDate: new Date("2026-06-13T13:00:00Z"),
    endDate: new Date("2026-06-13T20:00:00Z"),
    isSample: true,
  },
] as const;

const serializeAviationEvent = (event: any) => ({
  id: event.id,
  title: event.title,
  description: event.description,
  location: event.location,
  category: event.category,
  eventUrl: event.eventUrl ?? undefined,
  imageUrl: event.imageUrl ?? undefined,
  startDate: event.startDate instanceof Date ? event.startDate.toISOString() : event.startDate,
  endDate: event.endDate instanceof Date ? event.endDate.toISOString() : event.endDate,
  isSample: Boolean(event.isSample),
});


async function walkDir(dir: string): Promise<string[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkDir(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

type ApproachPlateType = "IAP" | "SID" | "STAR" | "AIRPORT" | "OTHER";

type ApproachPlateSyncState = {
  inProgress: boolean;
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  lastResult: any | null;
  lastError: string | null;
};

const approachPlateSyncState: ApproachPlateSyncState = {
  inProgress: false,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastResult: null,
  lastError: null,
};

// Optional auto-cache refresh (clears metadata cache on interval)
const ENABLE_PLATE_CACHE_CRON =
  String(process.env.ENABLE_PLATE_CACHE_CRON || "").toLowerCase() === "true";
const PLATE_CACHE_REFRESH_MS = Number(process.env.PLATE_CACHE_REFRESH_MS || 24 * 60 * 60 * 1000);
let plateCacheCronStarted = false;

function inferPlateType(name: string): ApproachPlateType {
  const upper = name.toUpperCase();
  if (upper.includes("STAR")) return "STAR";
  if (upper.includes("SID")) return "SID";
  if (upper.includes("DP")) return "SID";
  if (upper.includes("IAP")) return "IAP";
  if (upper.includes("AIRPORT")) return "AIRPORT";
  return "OTHER";
}

type PlateMeta = {
  name: string;
  type: string;
  effectiveDate?: string | null;
  url: string;
};

type AirportMeta = {
  icao: string;
  name: string | null;
  lat: number;
  lon: number;
  elevationFt?: number | null;
  timezone?: string | null;
};

type AirportSearchResult = {
  icao: string;
  name: string | null;
  city?: string | null;
  state?: string | null;
  lat: number;
  lon: number;
};

type AirportReference = AirportSearchResult & {
  timezone?: string | null;
};

type RunwayMeta = {
  leIdent: string | null;
  heIdent: string | null;
  leHeading: number | null;
  heHeading: number | null;
  lengthFt: number | null;
  surface: string | null;
};

function toNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function buildEffectiveValues(profile: any | null, baseType: any | null) {
  const baseCruise = toNumber(baseType?.cruiseKtas);
  const baseBurn = toNumber(baseType?.fuelBurnGph);
  const baseFuel = toNumber(baseType?.usableFuelGal);
  const baseWeight = toNumber(baseType?.maxGrossWeightLb);
  const overrideCruise = toNumber(profile?.cruiseKtasOverride);
  const overrideBurn = toNumber(profile?.fuelBurnOverrideGph);
  const overrideFuel = toNumber(profile?.usableFuelOverrideGal);
  const overrideWeight = toNumber(profile?.maxGrossWeightOverrideLb);

  return {
    cruise_ktas_effective: overrideCruise ?? baseCruise,
    fuel_burn_gph_effective: overrideBurn ?? baseBurn,
    usable_fuel_gal_effective: overrideFuel ?? baseFuel,
    max_gross_weight_lb_effective: overrideWeight ?? baseWeight,
  };
}

const PLATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const PLATE_CACHE_MAX = 500;
const plateMetaCache = new Map<string, { data: PlateMeta[]; expiresAt: number; createdAt: number }>();
const AIRPORT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const airportMetaCache = new Map<string, { data: AirportMeta; expiresAt: number }>();
const STATION_CACHE_URL = "https://aviationweather.gov/data/cache/stations.cache.json.gz";
const STATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let stationCache: { data: AirportSearchResult[]; expiresAt: number } | null = null;
const AIRPORTS_CACHE_URL = "https://ourairports.com/data/airports.csv";
const AIRPORTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let airportTimezoneCache: { data: Map<string, string>; expiresAt: number } | null = null;
let airportReferenceCache: { data: Map<string, AirportReference>; expiresAt: number } | null = null;
const RUNWAY_CACHE_URL = "https://ourairports.com/data/runways.csv";
const RUNWAY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let runwayCache: { data: Map<string, RunwayMeta[]>; expiresAt: number } | null = null;
const NOTAM_CACHE_TTL_MS = 2 * 60 * 1000;
const notamCache = new Map<string, { data: any; expiresAt: number }>();
const TFR_CACHE_TTL_MS = 60 * 60 * 1000;
const TFR_EMPTY_CACHE_TTL_MS = 5 * 60 * 1000;
const tfrCache = new Map<string, { data: any; expiresAt: number }>();
const TFR_STALE_MAX_AGE_MINUTES = Number(process.env.TFR_STALE_MAX_AGE_MINUTES || 12 * 60);
const TFR_STALE_MAX_AGE_MS = Math.max(30, TFR_STALE_MAX_AGE_MINUTES) * 60 * 1000;
let tfrLastSuccess: { data: any; fetchedAt: number } | null = null;
const SUA_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const suaCache = new Map<string, { data: any; expiresAt: number }>();
const TFR_ARCGIS_PROXY_URL = (process.env.TFR_ARCGIS_PROXY_URL || "").trim();
const TFR_ARCGIS_URLS_ENV = (process.env.TFR_ARCGIS_URLS || "").trim();
const TFR_ARCGIS_URLS = TFR_ARCGIS_URLS_ENV
  ? TFR_ARCGIS_URLS_ENV.split(",").map((entry) => entry.trim()).filter(Boolean)
  : [];
const TFR_WFS_ENABLED = String(process.env.TFR_WFS_ENABLED || "true").toLowerCase() === "true";
const TFR_WFS_URL = (process.env.TFR_WFS_URL || "https://sua.faa.gov/geoserver/wfs").trim();
const SUA_ARCGIS_URL = (process.env.SUA_ARCGIS_URL || "https://coast.noaa.gov/arcgis/rest/services/Hosted/MilitarySpecialUseAirspace/FeatureServer/0/query").trim();
const NOTAM_SOURCE = (process.env.NOTAM_SOURCE || "http").trim().toLowerCase();
const NOTAM_HTTP_BASE_URL = (process.env.NOTAM_HTTP_BASE_URL || "").trim();
const SWIM_NOTAM_QUERY_BASE_URL = (process.env.SWIM_NOTAM_QUERY_BASE_URL || "").trim();
const SWIM_NOTAM_QUERY_HEADERS_JSON = (process.env.SWIM_NOTAM_QUERY_HEADERS_JSON || "").trim();
const TFMS_ENABLED = String(process.env.TFMS_ENABLED || "false").toLowerCase() === "true";
const TFMS_PROVIDER = resolveTfmsProviderKey(process.env.TFMS_PROVIDER);
const TFMS_CACHE_TTL_SECONDS = Number(process.env.TFMS_CACHE_TTL_SECONDS || 300);
const TFMS_CACHE_TTL_MS = Math.max(30, TFMS_CACHE_TTL_SECONDS) * 1000;
const tfmsProvider = TFMS_PROVIDER === "db" ? createDbTfmsProvider() : createStubTfmsProvider();
const tfmsCache = new Map<string, { expiresAt: number; value: any }>();
const FAA_TFR_ARCGIS_URLS = [
  ...(TFR_ARCGIS_PROXY_URL ? [TFR_ARCGIS_PROXY_URL] : []),
  ...TFR_ARCGIS_URLS,
  "https://services1.arcgis.com/n4Ot9Qz0t5espY4s/ArcGIS/rest/services/FAA_TFRs/FeatureServer/0/query",
  "https://services1.arcgis.com/n4Ot9Qz0t5espY4s/arcgis/rest/services/FAA_TFRs/FeatureServer/0/query",
  "https://gis.faa.gov/arcgis/rest/services/TFMS/TFR/MapServer/0/query",
  "https://tfr.faa.gov/tfr_map_ims/MapServer/0/query",
].filter((value, index, arr) => value && arr.indexOf(value) === index);
let swimTokenCache: { token: string; expiresAt: number } | null = null;

const getTfmsCache = <T,>(key: string): T | null => {
  const entry = tfmsCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    tfmsCache.delete(key);
    return null;
  }
  return entry.value as T;
};

const setTfmsCache = <T,>(key: string, value: T) => {
  if (tfmsCache.size > 400) {
    tfmsCache.clear();
  }
  tfmsCache.set(key, { expiresAt: Date.now() + TFMS_CACHE_TTL_MS, value });
};

const getNotamCache = <T,>(key: string): T | null => {
  const entry = notamCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    notamCache.delete(key);
    return null;
  }
  return entry.data as T;
};

const setNotamCache = <T,>(key: string, value: T) => {
  if (notamCache.size > 200) {
    notamCache.clear();
  }
  notamCache.set(key, { expiresAt: Date.now() + NOTAM_CACHE_TTL_MS, data: value });
};

function normalizeIcao(value: string) {
  return value.trim().toUpperCase();
}

function dmsToDecimal(deg: number, min: number, sec: number, hemi: string) {
  const sign = hemi === "S" || hemi === "W" ? -1 : 1;
  return sign * (deg + min / 60 + sec / 3600);
}

function parseCoordPair(text: string) {
  const match = text.match(
    /(\d{2})[°º]\s*(\d{2})['’]\s*(\d{2})"?\s*([NS])\s+(\d{2,3})[°º]\s*(\d{2})['’]\s*(\d{2})"?\s*([EW])/
  );
  if (!match) return null;
  const lat = dmsToDecimal(Number(match[1]), Number(match[2]), Number(match[3]), match[4]);
  const lon = dmsToDecimal(Number(match[5]), Number(match[6]), Number(match[7]), match[8]);
  return { lat, lon };
}

function bearingBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

function destinationPoint(lat: number, lon: number, bearingDeg: number, distanceNm: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const radiusNm = 3440.065;
  const angular = distanceNm / radiusNm;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(lat);
  const lon1 = toRad(lon);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
    );

  return { lat: toDeg(lat2), lon: toDeg(lon2) };
}

function distanceNmBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radiusNm = 3440.065;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radiusNm * c;
}

function findNearestStation(
  stations: AirportSearchResult[],
  target: { lat: number; lon: number },
  exclude: Set<string>,
  maxRadiusNm: number
) {
  let best: { station: AirportSearchResult; distanceNm: number } | null = null;
  for (const station of stations) {
    if (!station?.icao) continue;
    if (exclude.has(station.icao)) continue;
    if (!Number.isFinite(station.lat) || !Number.isFinite(station.lon)) continue;
    const distance = distanceNmBetween(target.lat, target.lon, station.lat, station.lon);
    if (distance > maxRadiusNm) continue;
    if (!best || distance < best.distanceNm) {
      best = { station, distanceNm: distance };
    }
  }
  return best?.station ?? null;
}

function buildArcPoints(
  center: { lat: number; lon: number },
  start: { lat: number; lon: number },
  end: { lat: number; lon: number },
  radiusNm: number,
  clockwise: boolean
) {
  let startBearing = bearingBetween(center.lat, center.lon, start.lat, start.lon);
  let endBearing = bearingBetween(center.lat, center.lon, end.lat, end.lon);

  if (clockwise && endBearing <= startBearing) {
    endBearing += 360;
  }
  if (!clockwise && startBearing <= endBearing) {
    startBearing += 360;
  }

  const total = Math.abs(endBearing - startBearing);
  const steps = Math.max(12, Math.ceil(total / 5));
  const increment = (endBearing - startBearing) / steps;

  const points: { lat: number; lon: number }[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const bearing = startBearing + increment * i;
    points.push(destinationPoint(center.lat, center.lon, bearing, radiusNm));
  }
  return points;
}

function parseTfrPolygon(text: string) {
  const arcRegex =
    /(Clockwise|Counterclockwise)\s+on\s+a\s+(\d+(?:\.\d+)?)\s*NM ARC Centered on:\s*([0-9º'\"NS\s]+)\s+([0-9º'\"EW\s]+)/gi;
  const coordRegex =
    /(\d{2})[°º]\s*(\d{2})['’]\s*(\d{2})"?\s*([NS])\s+(\d{2,3})[°º]\s*(\d{2})['’]\s*(\d{2})"?\s*([EW])/gi;

  const arcMatches: Array<{ index: number; end: number; clockwise: boolean; radius: number; center: { lat: number; lon: number } | null }> = [];
  let match: RegExpExecArray | null;
  while ((match = arcRegex.exec(text)) !== null) {
    const clockwise = match[1].toLowerCase().startsWith("clockwise");
    const radius = Number(match[2]);
    const center = parseCoordPair(`${match[3]} ${match[4]}`);
    arcMatches.push({
      index: match.index,
      end: match.index + match[0].length,
      clockwise,
      radius,
      center,
    });
  }

  const tokens: Array<
    | { type: "point"; index: number; lat: number; lon: number }
    | { type: "arc"; index: number; clockwise: boolean; radius: number; center: { lat: number; lon: number } }
  > = [];

  while ((match = coordRegex.exec(text)) !== null) {
    const index = match.index;
    const isArcCenter = arcMatches.some((arc) => index >= arc.index && index <= arc.end);
    if (isArcCenter) continue;
    const lat = dmsToDecimal(Number(match[1]), Number(match[2]), Number(match[3]), match[4]);
    const lon = dmsToDecimal(Number(match[5]), Number(match[6]), Number(match[7]), match[8]);
    tokens.push({ type: "point", index, lat, lon });
  }

  arcMatches.forEach((arc) => {
    if (!arc.center) return;
    tokens.push({
      type: "arc",
      index: arc.index,
      clockwise: arc.clockwise,
      radius: arc.radius,
      center: arc.center,
    });
  });

  tokens.sort((a, b) => a.index - b.index);

  const points: { lat: number; lon: number }[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type === "point") {
      points.push({ lat: token.lat, lon: token.lon });
      continue;
    }

    const start = points[points.length - 1];
    const nextPointToken = tokens.slice(i + 1).find((item) => item.type === "point") as
      | { type: "point"; index: number; lat: number; lon: number }
      | undefined;
    if (!start || !nextPointToken) continue;
    const arcPoints = buildArcPoints(
      token.center,
      start,
      { lat: nextPointToken.lat, lon: nextPointToken.lon },
      token.radius,
      token.clockwise
    );
    arcPoints.slice(1).forEach((p) => points.push(p));
  }

  if (points.length >= 3) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first.lat !== last.lat || first.lon !== last.lon) {
      points.push({ ...first });
    }
  }

  return points;
}

function parseBboxParam(value: unknown) {
  if (typeof value !== "string") return null;
  const parts = value.split(",").map((item) => Number(item.trim()));
  if (parts.length !== 4 || parts.some((num) => !Number.isFinite(num))) return null;
  const [minLon, minLat, maxLon, maxLat] = parts;
  return { minLon, minLat, maxLon, maxLat };
}

function getFeatureBounds(feature: any) {
  const coords: [number, number][] = [];
  const geometry = feature?.geometry;
  if (!geometry) return null;
  const collect = (arr: any) => {
    if (!Array.isArray(arr)) return;
    if (typeof arr[0] === "number" && typeof arr[1] === "number") {
      coords.push([arr[0], arr[1]]);
      return;
    }
    arr.forEach(collect);
  };
  collect(geometry.coordinates);
  if (!coords.length) return null;
  let minLon = coords[0][0];
  let maxLon = coords[0][0];
  let minLat = coords[0][1];
  let maxLat = coords[0][1];
  coords.forEach(([lon, lat]) => {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
  return { minLon, minLat, maxLon, maxLat };
}

function featureIntersectsBbox(feature: any, bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number }) {
  const bounds = getFeatureBounds(feature);
  if (!bounds) return false;
  return !(
    bounds.maxLon < bbox.minLon ||
    bounds.minLon > bbox.maxLon ||
    bounds.maxLat < bbox.minLat ||
    bounds.minLat > bbox.maxLat
  );
}

function getFeatureCentroid(feature: any) {
  const bounds = getFeatureBounds(feature);
  if (!bounds) return null;
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lon: (bounds.minLon + bounds.maxLon) / 2,
  };
}

function parseArcGisDate(value: any) {
  if (!value) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return null;
}

function parseArcGisCompactDate(value: any) {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d{12}$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6));
    const day = Number(raw.slice(6, 8));
    const hour = Number(raw.slice(8, 10));
    const minute = Number(raw.slice(10, 12));
    if ([year, month, day, hour, minute].every(Number.isFinite)) {
      return new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString();
    }
  }
  if (/^\d{14}$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6));
    const day = Number(raw.slice(6, 8));
    const hour = Number(raw.slice(8, 10));
    const minute = Number(raw.slice(10, 12));
    const second = Number(raw.slice(12, 14));
    if ([year, month, day, hour, minute, second].every(Number.isFinite)) {
      return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();
    }
  }
  return parseArcGisDate(raw);
}

function normalizeArcGisTfrFeature(feature: any) {
  if (!feature?.geometry) return null;
  const props = feature?.properties || feature?.attributes || {};
  const notamId =
    props.NOTAM ||
    props.NOTAM_ID ||
    props.NOTAMID ||
    props.NOTAM_ID_1 ||
    props.TFR_ID ||
    props.NAME ||
    props.OBJECTID;
  const notamKey = props.NOTAM_KEY || props.NOTAMKEY || props.NOTAM_ID || props.NOTAM || null;
  const title = props.TITLE || props.NAME || props.EVENT || null;
  const legal = props.LEGAL || props.LEGALTYPE || props.CATEGORY || null;
  const location = props.LOCATION || props.AREA || props.NAME || props.EVENT || props.CITY || null;
  const reason = props.REASON || props.EVENT || props.TYPE || props.PURPOSE || null;
  const altitudeParts = [props.LOWER_ALT, props.UPPER_ALT].filter(Boolean);
  const altitude = altitudeParts.length ? altitudeParts.join(" - ") : props.ALTITUDE || props.ALT || null;
  const effectiveAt = parseArcGisDate(props.START || props.START_DATE || props.EFFECTIVE || props.BEGIN);
  const expiresAt = parseArcGisDate(props.END || props.END_DATE || props.EXPIRES || props.ENDDATE);
  const lastUpdatedAt = parseArcGisCompactDate(
    props.LAST_MODIFICATION_DATETIME || props.LASTUPDATED || props.LAST_MODIFIED || props.EDITED
  );

  return {
    ...feature,
    properties: {
      notamId: notamId ? String(notamId) : "TFR",
      notamKey: notamKey ? String(notamKey) : null,
      title,
      legal,
      location,
      reason,
      altitude,
      effectiveAt,
      expiresAt,
      lastUpdatedAt,
      source: "faa-arcgis",
      raw: props,
    },
  };
}

async function fetchArcGisTfrs(bbox?: { minLon: number; minLat: number; maxLon: number; maxLat: number }) {
  let lastError = "ArcGIS fetch failed";
  let lastUrl = "";
  const attempts: Array<{ url: string; ok: boolean; status?: number; error?: string }> = [];

  const geometry = bbox
    ? `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`
    : "-180,-90,180,90";

  const paramsBase = {
    where: "1=1",
    outFields: "*",
    returnGeometry: "true",
    geometry,
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
    inSR: "4326",
    outSR: "4326",
  };

  const formatOrder = ["json", "geojson"];
  const headerVariants: Array<{ label: string; headers: Record<string, string> }> = [
    {
      label: "with-referer",
      headers: {
        "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)",
        "Accept": "application/json",
        "Referer": "https://tfr.faa.gov",
        "Origin": "https://tfr.faa.gov",
      },
    },
    {
      label: "no-referer",
      headers: {
        "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)",
        "Accept": "application/json",
      },
    },
  ];

  for (const baseUrl of FAA_TFR_ARCGIS_URLS) {
    for (const format of formatOrder) {
      const params = new URLSearchParams({ ...paramsBase, f: format });
      for (const variant of headerVariants) {
        const url = `${baseUrl}?${params.toString()}`;
        lastUrl = url;
        try {
          const response = await fetchWithTimeout(
            url,
            {
              headers: variant.headers,
            },
            8000
          );
          if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            const snippet = errorText.trim().slice(0, 200);
            lastError = `HTTP ${response.status}${snippet ? `: ${snippet}` : ""}`;
            attempts.push({ url, ok: false, status: response.status, error: `${lastError} (${variant.label})` });
            continue;
          }
          const payload = await response.json().catch(() => null);
          if (payload?.error) {
            lastError = payload.error?.message || "ArcGIS error";
            attempts.push({ url, ok: false, error: `${lastError} (${variant.label})` });
            continue;
          }
          if (!payload?.features || !Array.isArray(payload.features)) {
            lastError = "ArcGIS response missing features";
            attempts.push({ url, ok: false, error: `${lastError} (${variant.label})` });
            continue;
          }

          const rawFeatures = payload.features;
          const esriFeatures = rawFeatures
            .map((feature: any) => {
              if (feature?.type === "Feature" && feature?.properties) return feature;
              const properties = feature?.attributes || feature?.properties || {};
              const geometry = feature?.geometry;
              if (!geometry) return null;
              if (geometry.rings) {
                return {
                  type: "Feature",
                  geometry: { type: "Polygon", coordinates: geometry.rings },
                  properties,
                };
              }
              if (geometry.paths) {
                return {
                  type: "Feature",
                  geometry: { type: "LineString", coordinates: geometry.paths[0] || [] },
                  properties,
                };
              }
              if (Number.isFinite(geometry.x) && Number.isFinite(geometry.y)) {
                return {
                  type: "Feature",
                  geometry: { type: "Point", coordinates: [geometry.x, geometry.y] },
                  properties,
                };
              }
              return null;
            })
            .filter(Boolean);

          const features = esriFeatures.map(normalizeArcGisTfrFeature).filter(Boolean);
          const data = {
            type: "FeatureCollection",
            features,
            updatedAt: new Date().toISOString(),
            source: "faa-arcgis",
          };
          if (features.length) {
            tfrLastSuccess = { data, fetchedAt: Date.now() };
          }
          return {
            data: {
              ...data,
            },
            attempts,
          };
        } catch (error: any) {
          console.error("ArcGIS TFR fetch failed:", error);
          lastError = error?.message || "ArcGIS fetch failed";
          attempts.push({ url, ok: false, error: `${lastError} (${variant.label})` });
        }
      }
    }
  }

  return { data: null, error: `${lastError} (${lastUrl})`, attempts };
}

function normalizeSuaWfsTfrFeature(feature: any) {
  if (!feature?.geometry) return null;
  const props = feature?.properties || {};
  const text = typeof props.tfr_short === "string" ? props.tfr_short : "";
  const locationMatch = text.match(/AIRSPACE\s+([^.\n]+)/i);
  const location = locationMatch?.[1]?.trim() || props.state || props.center_abbr || null;
  const altitudeFromText = extractAltitudeFromNotam(text);
  const lowAltitude = Number(props.low_altitude);
  const highAltitude = Number(props.high_altitude);
  const lowUnit = Number(props.low_altitude_agl) === 1 ? "AGL" : "MSL";
  const highUnit = Number(props.high_altitude_agl) === 1 ? "AGL" : "MSL";
  const fallbackAltitude =
    Number.isFinite(lowAltitude) && Number.isFinite(highAltitude)
      ? `${lowAltitude === 0 ? "SFC" : `${lowAltitude * 100} FT ${lowUnit}`} - ${highAltitude * 100} FT ${highUnit}`
      : null;
  const notamKey = props.airspace_name ? String(props.airspace_name) : null;
  const title = notamKey ? `FDC ${notamKey}` : "Temporary Flight Restriction";

  return {
    ...feature,
    properties: {
      notamId: notamKey || String(props.id || props.gid || "TFR"),
      notamKey,
      title,
      legal: props.airspace_type || props.type_class || null,
      location,
      reason: props.remarks || props.airspace_type || null,
      altitude: altitudeFromText || fallbackAltitude,
      effectiveAt: parseArcGisDate(props.start_time),
      expiresAt: parseArcGisDate(props.end_time),
      lastUpdatedAt: parseArcGisDate(props.update_date),
      text: text || null,
      source: "faa-sua-wfs",
      raw: props,
    },
  };
}

async function fetchSuaWfsTfrs(bbox?: { minLon: number; minLat: number; maxLon: number; maxLat: number }) {
  if (!TFR_WFS_ENABLED || !TFR_WFS_URL) {
    return { data: null, error: "WFS fallback disabled", attempts: [] as Array<{ url: string; ok: boolean; status?: number; error?: string }> };
  }

  const params = new URLSearchParams({
    service: "WFS",
    version: "1.0.0",
    request: "GetFeature",
    typeName: "SUA:schedule",
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    CQL_FILTER: "type_class = 'TFR'",
  });

  if (bbox) {
    params.set("bbox", `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat},EPSG:4326`);
  }

  const url = `${TFR_WFS_URL}?${params.toString()}`;
  const attempts: Array<{ url: string; ok: boolean; status?: number; error?: string }> = [];

  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)",
          "Accept": "application/json",
        },
      },
      10000
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      const snippet = errorText.trim().slice(0, 200);
      const message = `HTTP ${response.status}${snippet ? `: ${snippet}` : ""}`;
      attempts.push({ url, ok: false, status: response.status, error: message });
      return { data: null, error: message, attempts };
    }

    const payload = await response.json().catch(() => null);
    if (!payload?.features || !Array.isArray(payload.features)) {
      const message = "WFS response missing features";
      attempts.push({ url, ok: false, error: message });
      return { data: null, error: message, attempts };
    }

    const features = payload.features.map(normalizeSuaWfsTfrFeature).filter(Boolean);
    const data = {
      type: "FeatureCollection",
      features,
      updatedAt: new Date().toISOString(),
      source: "faa-sua-wfs",
    };
    if (features.length) {
      tfrLastSuccess = { data, fetchedAt: Date.now() };
    }
    attempts.push({ url, ok: true, status: response.status });
    return { data, attempts };
  } catch (error: any) {
    const message = error?.message || "WFS fetch failed";
    attempts.push({ url, ok: false, error: message });
    return { data: null, error: `${message} (${url})`, attempts };
  }
}

function extractLineValue(text: string, label: string) {
  const match = text.match(new RegExp(`${label}\\s*:\\s*([^\\n\\r]+)`, "i"));
  return match ? match[1].trim() : null;
}

function extractAltitudeFromNotam(text: string) {
  if (!text) return null;
  const line =
    extractLineValue(text, "Altitude") ||
    extractLineValue(text, "Altitudes") ||
    extractLineValue(text, "Altitude(s)") ||
    extractLineValue(text, "Altitude(s)") ||
    extractLineValue(text, "Vertical Limits") ||
    extractLineValue(text, "Vertical Limits") ||
    extractLineValue(text, "Vertical Limits (MSL)") ||
    extractLineValue(text, "Vertical Limits (MSL)");
  if (line) return line;

  const sfcMatch = text.match(/\b(SFC|SURFACE|GROUND)\b\s*(?:-|TO)\s*(FL?\s?\d{2,3}|\d{3,5}\s*(?:FT|MSL|AGL)?)/i);
  if (sfcMatch) return sfcMatch[0].replace(/\s+/g, " ");

  const altitudeMatch = text.match(/\b(\d{3,5})\s*(?:FT|MSL|AGL)\b/i);
  if (altitudeMatch) return altitudeMatch[0].replace(/\s+/g, " ");

  const flMatch = text.match(/\bFL\s?\d{2,3}\b/i);
  if (flMatch) return flMatch[0].replace(/\s+/g, " ");

  return null;
}

function extractNotamKeyBase(value?: string | null) {
  if (!value) return null;
  const text = String(value).toUpperCase();
  const match = text.match(/[A-Z]?\d{1,5}\/\d{2,4}/);
  return match ? match[0] : null;
}

function getNotamRowKeyBases(row: any) {
  const bases = new Set<string>();
  const idBase = extractNotamKeyBase(row?.notamId);
  const textBase = extractNotamKeyBase(row?.text);
  if (idBase) bases.add(idBase);
  if (textBase) bases.add(textBase);
  return Array.from(bases);
}

async function enrichArcGisTfrFeatures(features: any[]) {
  if (!features.length) return features;
  const keyBases = new Set<string>();
  for (const feature of features) {
    const raw = feature?.properties?.raw || {};
    const base =
      extractNotamKeyBase(feature?.properties?.notamKey) ||
      extractNotamKeyBase(raw?.NOTAM_KEY) ||
      extractNotamKeyBase(raw?.NOTAM) ||
      extractNotamKeyBase(feature?.properties?.title);
    if (base) keyBases.add(base);
  }

  const baseList = Array.from(keyBases).slice(0, 200);
  if (!baseList.length) return features;

  const keyFilters = baseList.map((key) => or(ilike(notamsTable.notamId, `%${key}%`), ilike(notamsTable.text, `%${key}%`)));
  const keyFilter = keyFilters.length === 1 ? keyFilters[0] : or(...keyFilters);
  if (!keyFilter) return features;

  const nowDate = new Date();
  const rows = await db
    .select()
    .from(notamsTable)
    .where(
      and(
        eq(notamsTable.source, "nms_api"),
        or(isNull(notamsTable.expiresAt), gte(notamsTable.expiresAt, nowDate)),
        keyFilter
      )
    )
    .limit(5000);

  if (!rows.length) return features;

  const rowByBase = new Map<string, any>();
  for (const row of rows) {
    const bases = getNotamRowKeyBases(row);
    for (const base of bases) {
      const existing = rowByBase.get(base);
      if (!existing || (row.effectiveAt && existing.effectiveAt && row.effectiveAt > existing.effectiveAt)) {
        rowByBase.set(base, row);
      }
    }
  }

  return features.map((feature) => {
    const raw = feature?.properties?.raw || {};
    const base =
      extractNotamKeyBase(feature?.properties?.notamKey) ||
      extractNotamKeyBase(raw?.NOTAM_KEY) ||
      extractNotamKeyBase(raw?.NOTAM) ||
      extractNotamKeyBase(feature?.properties?.title);
    if (!base) return feature;
    const row = rowByBase.get(base);
    if (!row) return feature;

    const text = row.text || "";
    const location = extractLineValue(text, "Location") || feature?.properties?.location || null;
    const reason = extractLineValue(text, "Reason for NOTAM") || feature?.properties?.reason || null;
    const tfrType = extractLineValue(text, "Type") || feature?.properties?.tfrType || null;
            const altitude = extractAltitudeFromNotam(text) || feature?.properties?.altitude || null;

    return {
      ...feature,
      properties: {
        ...feature.properties,
        notamId: row.notamId || feature?.properties?.notamId,
        location,
        reason,
        tfrType,
        altitude,
        effectiveAt: row.effectiveAt ? row.effectiveAt.toISOString() : feature?.properties?.effectiveAt,
        expiresAt: row.expiresAt ? row.expiresAt.toISOString() : feature?.properties?.expiresAt,
        text,
        sourceDetail: row.source || "nms_api",
      },
    };
  });
}

function normalizeSUAFeature(feature: any) {
  if (!feature?.geometry) return null;
  const props = feature?.properties || feature?.attributes || {};
  const name = props.FEATURENAME || props.FEATURE_NAME || props.NAME || props.AIRSPACE || props.AIRSPACENAME || null;
  const type = props.SPECIALUSEAIRSPACETYPE || props.TYPE || props.CATEGORY || props.AIRSPACETYPE || null;
  const floor = props.FLOOR || props.FLOORVALUE || props.LOWERALTITUDE || props.LOWER_ALT || props.ALTLOWER || null;
  const ceiling = props.CEILING || props.CEILINGVALUE || props.UPPERALTITUDE || props.UPPER_ALT || props.ALTUPPER || null;
  const agency = props.SCHEDULINGAGENCY || props.AGENCY || null;
  const region = props.REGION || props.COPAREA || null;

  return {
    ...feature,
    properties: {
      name,
      type,
      floor,
      ceiling,
      agency,
      region,
      source: "sua-arcgis",
      raw: props,
    },
  };
}

async function fetchArcGisSUA(bbox?: { minLon: number; minLat: number; maxLon: number; maxLat: number }) {
  const geometry = bbox
    ? `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`
    : "-180,-90,180,90";

  const params = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    returnGeometry: "true",
    geometry,
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
    inSR: "4326",
    outSR: "4326",
    f: "json",
  });

  const url = `${SUA_ARCGIS_URL}?${params.toString()}`;
  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)",
        "Referer": "https://www.faa.gov",
        "Origin": "https://www.faa.gov",
      },
    },
    10000
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`SUA ArcGIS request failed (${response.status}) ${errorText.slice(0, 200)}`);
  }

  const payload = await response.json().catch(() => null);
  if (!payload?.features || !Array.isArray(payload.features)) {
    throw new Error("SUA ArcGIS response missing features");
  }

  const esriFeatures = payload.features
    .map((feature: any) => {
      if (feature?.type === "Feature" && feature?.properties) return feature;
      const properties = feature?.attributes || feature?.properties || {};
      const geometry = feature?.geometry;
      if (!geometry) return null;
      if (geometry.rings) {
        return {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: geometry.rings },
          properties,
        };
      }
      if (geometry.paths) {
        return {
          type: "Feature",
          geometry: { type: "LineString", coordinates: geometry.paths[0] || [] },
          properties,
        };
      }
      if (Number.isFinite(geometry.x) && Number.isFinite(geometry.y)) {
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [geometry.x, geometry.y] },
          properties,
        };
      }
      return null;
    })
    .filter(Boolean);

  const features = esriFeatures.map(normalizeSUAFeature).filter(Boolean);
  return {
    type: "FeatureCollection",
    features,
    updatedAt: new Date().toISOString(),
    source: "sua-arcgis",
  };
}

function isTfrNotam(text: string, notamId: string) {
  const upperText = text.toUpperCase();
  if (notamId?.toUpperCase().startsWith("FDC")) return true;
  return (
    upperText.includes("TEMPORARY FLIGHT RESTRICTION") ||
    upperText.includes("AIRSPACE DEFINITION") ||
    upperText.includes("TFR")
  );
}

function extractRunwayInUseFromMetar(metar: any): string | null {
  const raw = metar?.rawOb;
  if (!raw) return null;
  const rwyMatch = raw.match(/\b(?:RWY|RUNWAY)\s+(\d{2}[LCR]?(?:\s*(?:AND|\/|&)\s*\d{2}[LCR]?)*)/i);
  if (rwyMatch) {
    return rwyMatch[1].replace(/\s+/g, " ").trim();
  }
  const arrRwyMatch = raw.match(/\bARR\s+(?:RWY|RUNWAY)\s+(\d{2}[LCR]?)/i);
  const depRwyMatch = raw.match(/\bDEP\s+(?:RWY|RUNWAY)\s+(\d{2}[LCR]?)/i);
  if (arrRwyMatch || depRwyMatch) {
    const runways = [];
    if (arrRwyMatch) runways.push(`${arrRwyMatch[1]} (arr)`);
    if (depRwyMatch) runways.push(`${depRwyMatch[1]} (dep)`);
    return runways.join(", ");
  }
  return null;
}

function parseMetarWind(metar: any): { direction: number | null; speed: number | null; gust: number | null } {
  const wdir = Number(metar?.wdir);
  const wspd = Number(metar?.wspd);
  const wgst = Number(metar?.wgst);
  if (Number.isFinite(wdir) && Number.isFinite(wspd)) {
    return { direction: wdir, speed: wspd, gust: Number.isFinite(wgst) ? wgst : null };
  }
  const raw = metar?.rawOb;
  if (!raw) return { direction: null, speed: null, gust: null };
  const match = raw.match(/\b(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?KT\b/);
  if (!match) return { direction: null, speed: null, gust: null };
  if (match[1] === "VRB") {
    return { direction: null, speed: Number(match[2]), gust: match[4] ? Number(match[4]) : null };
  }
  return { direction: Number(match[1]), speed: Number(match[2]), gust: match[4] ? Number(match[4]) : null };
}

function normalizeHeading(value: number) {
  const heading = value % 360;
  return heading < 0 ? heading + 360 : heading;
}

type RunwayAdvisory = {
  runway: string;
  heading: number;
  headwind: number;
  crosswind: number;
};

function computeRunwayAdvisory(runways: RunwayMeta[], windDir: number, windSpeed: number): RunwayAdvisory | null {
  let best: RunwayAdvisory | null = null;

  const evaluate = (ident: string | null, heading: number | null) => {
    if (!ident || heading === null) return;
    const angle = ((windDir - heading + 540) % 360) - 180;
    const angleRad = (Math.PI / 180) * angle;
    const headwind = windSpeed * Math.cos(angleRad);
    const crosswind = Math.abs(windSpeed * Math.sin(angleRad));
    if (!best || headwind > best.headwind) {
      best = { runway: ident, heading, headwind, crosswind };
    }
  };

  runways.forEach((runway) => {
    if (runway.leHeading !== null) evaluate(runway.leIdent, normalizeHeading(runway.leHeading));
    if (runway.heHeading !== null) evaluate(runway.heIdent, normalizeHeading(runway.heHeading));
  });

  return best;
}

function buildIcaoCandidates(value: string) {
  const normalized = normalizeIcao(value);
  if (normalized.length === 3) {
    return Array.from(new Set([`K${normalized}`, normalized]));
  }
  return [normalized];
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

async function loadStationCache(): Promise<AirportSearchResult[]> {
  const now = Date.now();
  if (stationCache && stationCache.expiresAt > now) return stationCache.data;

  const response = await fetch(STATION_CACHE_URL, {
    headers: { "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)" },
  });
  if (!response.ok) {
    throw new Error(`Failed to load station cache: ${response.status}`);
  }

  const compressed = Buffer.from(await response.arrayBuffer());
  const jsonText = zlib.gunzipSync(compressed).toString("utf-8");
  const parsed = JSON.parse(jsonText);
  const rows = Array.isArray(parsed) ? parsed : parsed?.data ?? [];

  const mapped: AirportSearchResult[] = rows
    .map((row: any) => {
      const icao =
        row.icaoId ??
        row.icao ??
        row.stationId ??
        row.station ??
        row.site ??
        row.siteId ??
        row.iataId;
      const lat = Number(row.latitude ?? row.lat ?? row.latitude_dec ?? row.lat_dec ?? row.latDec);
      const lon = Number(row.longitude ?? row.lon ?? row.longitude_dec ?? row.lon_dec ?? row.lonDec);
      if (!icao || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return {
        icao: String(icao).toUpperCase(),
        name: row.name ?? row.site ?? row.stationName ?? row.facilityName ?? null,
        city: row.city ?? null,
        state: row.state ?? row.stateCode ?? null,
        lat,
        lon,
      } as AirportSearchResult;
    })
    .filter(Boolean);

  stationCache = { data: mapped, expiresAt: now + STATION_CACHE_TTL_MS };
  return mapped;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current);
  return result;
}

async function loadAirportTimezoneCache(): Promise<Map<string, string>> {
  const now = Date.now();
  if (airportTimezoneCache && airportTimezoneCache.expiresAt > now) {
    return airportTimezoneCache.data;
  }

  const response = await fetch(AIRPORTS_CACHE_URL, {
    headers: { "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)" },
  });
  if (!response.ok) {
    throw new Error(`Failed to load airports data: ${response.status}`);
  }

  const text = await response.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const map = new Map<string, string>();
  if (lines.length === 0) {
    airportTimezoneCache = { data: map, expiresAt: now + AIRPORTS_CACHE_TTL_MS };
    return map;
  }

  const header = parseCsvLine(lines[0]).map((value) => value.trim().toLowerCase());
  const idxIdent = header.indexOf("ident");
  const idxGps = header.indexOf("gps_code");
  const idxLocal = header.indexOf("local_code");
  const idxIata = header.indexOf("iata_code");
  const idxTimezone = header.indexOf("timezone");

  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    if (row.length < 5) continue;
    const timezone = idxTimezone >= 0 ? row[idxTimezone]?.trim() : "";
    if (!timezone) continue;
    const ident = idxIdent >= 0 ? row[idxIdent]?.trim().toUpperCase() : "";
    const gpsCode = idxGps >= 0 ? row[idxGps]?.trim().toUpperCase() : "";
    const localCode = idxLocal >= 0 ? row[idxLocal]?.trim().toUpperCase() : "";
    const iataCode = idxIata >= 0 ? row[idxIata]?.trim().toUpperCase() : "";
    const candidates = [gpsCode, ident, localCode, iataCode].filter(Boolean);
    candidates.forEach((code) => {
      if (!map.has(code)) {
        map.set(code, timezone);
      }
    });
  }

  airportTimezoneCache = { data: map, expiresAt: now + AIRPORTS_CACHE_TTL_MS };
  return map;
}

async function loadAirportReferenceCache(): Promise<Map<string, AirportReference>> {
  const now = Date.now();
  if (airportReferenceCache && airportReferenceCache.expiresAt > now) {
    return airportReferenceCache.data;
  }

  const response = await fetch(AIRPORTS_CACHE_URL, {
    headers: { "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)" },
  });
  if (!response.ok) {
    throw new Error(`Failed to load airports data: ${response.status}`);
  }

  const text = await response.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const map = new Map<string, AirportReference>();
  if (lines.length === 0) {
    airportReferenceCache = { data: map, expiresAt: now + AIRPORTS_CACHE_TTL_MS };
    return map;
  }

  const header = parseCsvLine(lines[0]).map((value) => value.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const idxIdent = idx("ident");
  const idxGps = idx("gps_code");
  const idxLocal = idx("local_code");
  const idxIata = idx("iata_code");
  const idxName = idx("name");
  const idxCity = idx("municipality");
  const idxRegion = idx("iso_region");
  const idxLat = idx("latitude_deg");
  const idxLon = idx("longitude_deg");
  const idxTimezone = idx("timezone");

  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const lat = idxLat >= 0 ? Number(row[idxLat]) : NaN;
    const lon = idxLon >= 0 ? Number(row[idxLon]) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const ident = idxIdent >= 0 ? row[idxIdent]?.trim().toUpperCase() : "";
    const gpsCode = idxGps >= 0 ? row[idxGps]?.trim().toUpperCase() : "";
    const localCode = idxLocal >= 0 ? row[idxLocal]?.trim().toUpperCase() : "";
    const iataCode = idxIata >= 0 ? row[idxIata]?.trim().toUpperCase() : "";
    const name = idxName >= 0 ? row[idxName]?.trim() : "";
    const city = idxCity >= 0 ? row[idxCity]?.trim() : "";
    const region = idxRegion >= 0 ? row[idxRegion]?.trim() : "";
    const timezone = idxTimezone >= 0 ? row[idxTimezone]?.trim() : "";

    if (!ident && !gpsCode && !localCode && !iataCode) continue;

    let state: string | null = null;
    if (region.startsWith("US-")) {
      state = region.slice(3);
    } else if (region.includes("-")) {
      state = region.split("-")[1] || null;
    }

    const canonical = ident || gpsCode || localCode || iataCode;
    const reference: AirportReference = {
      icao: canonical,
      name: name || null,
      city: city || null,
      state: state || null,
      lat,
      lon,
      timezone: timezone || null,
    };

    const candidates = [gpsCode, ident, localCode, iataCode].filter(Boolean);
    candidates.forEach((code) => {
      if (!map.has(code)) {
        map.set(code, reference);
      }
    });
  }

  airportReferenceCache = { data: map, expiresAt: now + AIRPORTS_CACHE_TTL_MS };
  return map;
}

async function loadRunwayCache(): Promise<Map<string, RunwayMeta[]>> {
  const now = Date.now();
  if (runwayCache && runwayCache.expiresAt > now) return runwayCache.data;

  const response = await fetch(RUNWAY_CACHE_URL, {
    headers: { "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)" },
  });
  if (!response.ok) {
    throw new Error(`Failed to load runways data: ${response.status}`);
  }

  const csvText = await response.text();
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return new Map();

  const header = parseCsvLine(lines[0]);
  const idx = (name: string) => header.indexOf(name);

  const airportIdentIdx = idx("airport_ident");
  const lengthIdx = idx("length_ft");
  const surfaceIdx = idx("surface");
  const closedIdx = idx("closed");
  const leIdentIdx = idx("le_ident");
  const heIdentIdx = idx("he_ident");
  const leHeadingIdx = idx("le_heading_degT");
  const heHeadingIdx = idx("he_heading_degT");

  const dataMap = new Map<string, RunwayMeta[]>();

  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const airportIdent = row[airportIdentIdx]?.toUpperCase();
    if (!airportIdent) continue;
    const isClosed = row[closedIdx] === "1";
    if (isClosed) continue;

    const runway: RunwayMeta = {
      leIdent: row[leIdentIdx] || null,
      heIdent: row[heIdentIdx] || null,
      leHeading: row[leHeadingIdx] ? Number(row[leHeadingIdx]) : null,
      heHeading: row[heHeadingIdx] ? Number(row[heHeadingIdx]) : null,
      lengthFt: row[lengthIdx] ? Number(row[lengthIdx]) : null,
      surface: row[surfaceIdx] || null,
    };

    if (!dataMap.has(airportIdent)) {
      dataMap.set(airportIdent, []);
    }
    dataMap.get(airportIdent)!.push(runway);
  }

  runwayCache = { data: dataMap, expiresAt: now + RUNWAY_CACHE_TTL_MS };
  return dataMap;
}

function buildNotamUrl(template: string, icao: string) {
  if (template.includes("{{icao}}")) {
    return template.replace(/{{icao}}/g, icao);
  }
  if (template.includes("{icao}")) {
    return template.replace(/{icao}/g, icao);
  }
  const joinChar = template.includes("?") ? "&" : "?";
  return `${template}${joinChar}icao=${icao}`;
}

async function getSwimAccessToken(): Promise<string> {
  const now = Date.now();
  if (swimTokenCache && swimTokenCache.expiresAt > now) {
    return swimTokenCache.token;
  }

  const tokenUrl = process.env.SWIM_TOKEN_URL;
  const clientId = process.env.SWIM_CLIENT_ID;
  const clientSecret = process.env.SWIM_CLIENT_SECRET;
  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error("SWIM token configuration missing");
  }

  const body = new URLSearchParams();
  body.append("grant_type", "client_credentials");
  const scope = process.env.SWIM_SCOPE;
  if (scope) body.append("scope", scope);

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`SWIM token request failed: ${response.status}`);
  }

  const json = await response.json();
  const accessToken = json?.access_token;
  const expiresIn = Number(json?.expires_in ?? 3600);
  if (!accessToken) {
    throw new Error("SWIM token response missing access_token");
  }

  swimTokenCache = {
    token: accessToken,
    expiresAt: now + Math.max(60, expiresIn - 60) * 1000,
  };

  return accessToken;
}

function normalizeNotams(payload: any): Array<{ id: string; text: string; effective?: string; expires?: string }> {
  if (!payload) return [];
  const candidate =
    payload.notams ||
    payload.data ||
    payload.items ||
    payload.results ||
    payload.Notam ||
    payload.NOTAM ||
    payload;

  if (Array.isArray(candidate)) {
    return candidate.map((item, index) => ({
      id: item?.id || item?.notam_id || item?.notamId || `notam-${index}`,
      text: item?.text || item?.notamText || item?.raw || JSON.stringify(item),
      effective: item?.effective || item?.start || item?.startDate,
      expires: item?.expires || item?.end || item?.endDate,
    }));
  }

  if (typeof candidate === "object") {
    const text = candidate?.text || candidate?.notamText || candidate?.raw;
    if (text) {
      return [
        {
          id: candidate?.id || "notam-0",
          text,
          effective: candidate?.effective || candidate?.start,
          expires: candidate?.expires || candidate?.end,
        },
      ];
    }
  }

  return [];
}

function stableNotamIdFromText(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 24);
}

function parseNotamDateValue(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === "string") {
    const iso = parseISO(value);
    if (Number.isFinite(iso.getTime())) return iso;
    const fallback = new Date(value);
    if (Number.isFinite(fallback.getTime())) return fallback;
    return null;
  }
  const fallback = new Date(value);
  return Number.isFinite(fallback.getTime()) ? fallback : null;
}

function getDtppMetaUrl() {
  if (process.env.FAA_DTPP_META_URL) return process.env.FAA_DTPP_META_URL;

  const cycleCode = getDtppCycleCode();
  if (!cycleCode) {
    throw new Error("FAA_DTPP_CYCLE or FAA_DTPP_ZIP_URL must be configured");
  }

  return `https://aeronav.faa.gov/d-tpp/${cycleCode}/xml_data/d-TPP_Metafile.xml`;
}

function getPdfBaseUrl() {
  if (process.env.FAA_DTPP_PDF_BASE_URL) return process.env.FAA_DTPP_PDF_BASE_URL;

  const cycleCode = getDtppCycleCode();
  if (!cycleCode) {
    throw new Error("FAA_DTPP_CYCLE or FAA_DTPP_ZIP_URL must be configured");
  }

  return `https://aeronav.faa.gov/d-tpp/${cycleCode}`;
}

function getDtppCycleCode(): string | null {
  const cycle = process.env.FAA_DTPP_CYCLE;
  if (cycle && cycle.length >= 4) {
    return cycle.slice(0, 4);
  }

  const zipUrl = process.env.FAA_DTPP_ZIP_URL;
  if (!zipUrl) return null;
  const match = zipUrl.match(/_(\d{6})/);
  if (match && match[1]) {
    return match[1].slice(0, 4);
  }
  return null;
}

function getCachedPlates(icao: string) {
  const key = normalizeIcao(icao);
  const cached = plateMetaCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    plateMetaCache.delete(key);
    return null;
  }
  return cached.data;
}

function setCachedPlates(icao: string, data: PlateMeta[]) {
  const key = normalizeIcao(icao);
  plateMetaCache.set(key, {
    data,
    createdAt: Date.now(),
    expiresAt: Date.now() + PLATE_CACHE_TTL_MS,
  });

  if (plateMetaCache.size > PLATE_CACHE_MAX) {
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [entryKey, entry] of Array.from(plateMetaCache.entries())) {
      if (entry.createdAt < oldestAt) {
        oldestAt = entry.createdAt;
        oldestKey = entryKey;
      }
    }
    if (oldestKey) plateMetaCache.delete(oldestKey);
  }
}

function getCachedAirport(icao: string) {
  const key = normalizeIcao(icao);
  const cached = airportMetaCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    airportMetaCache.delete(key);
    return null;
  }
  return cached.data;
}

function setCachedAirport(icao: string, data: AirportMeta) {
  const key = normalizeIcao(icao);
  airportMetaCache.set(key, {
    data,
    expiresAt: Date.now() + AIRPORT_CACHE_TTL_MS,
  });
}

function clearPlateCache() {
  plateMetaCache.clear();
}

function startPlateCacheCron() {
  if (plateCacheCronStarted || !ENABLE_PLATE_CACHE_CRON) return;
  plateCacheCronStarted = true;
  const interval = Number.isFinite(PLATE_CACHE_REFRESH_MS) && PLATE_CACHE_REFRESH_MS > 0
    ? PLATE_CACHE_REFRESH_MS
    : 24 * 60 * 60 * 1000;
  setInterval(() => {
    clearPlateCache();
    approachPlateSyncState.lastResult = { cleared: true, reason: "auto" };
    approachPlateSyncState.lastFinishedAt = new Date();
  }, interval);
}

function extractTagValue(source: string, tag: string): string | null {
  const match = source.match(new RegExp(`<${tag}>(.*?)</${tag}>`, "i"));
  return match ? match[1].trim() : null;
}

async function extractAirportXmlForIcao(response: Response, icao: string): Promise<string | null> {
  if (!response.body) return null;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const target = `ICAO_IDENT="${icao}"`;
  const endTag = "</airport_name>";

  let buffer = "";
  let foundStart = false;
  let startIdx = -1;
  const maxBuffer = 1200000;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const upperBuffer = buffer.toUpperCase();

    if (!foundStart) {
      const targetIdx = upperBuffer.indexOf(target);
      if (targetIdx !== -1) {
        startIdx = upperBuffer.lastIndexOf("<AIRPORT_NAME", targetIdx);
        if (startIdx === -1) startIdx = targetIdx;
        foundStart = true;
      }
    }

    if (foundStart) {
      const endIdx = upperBuffer.indexOf(endTag.toUpperCase(), startIdx);
      if (endIdx !== -1) {
        return buffer.slice(startIdx, endIdx + endTag.length);
      }
      if (buffer.length > maxBuffer) {
        buffer = buffer.slice(startIdx);
        startIdx = 0;
      }
    } else if (buffer.length > maxBuffer) {
      buffer = buffer.slice(-maxBuffer);
    }
  }

  return null;
}

async function fetchPlateMetadataForIcao(icao: string): Promise<PlateMeta[]> {
  const cached = getCachedPlates(icao);
  if (cached) return cached;

  const normalizedIcao = normalizeIcao(icao);
  const metaUrl = getDtppMetaUrl();
  const pdfBase = getPdfBaseUrl().replace(/\/+$/, "");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const response = await fetch(metaUrl, {
    signal: controller.signal,
    headers: {
      "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)",
      "Accept": "application/xml,text/xml;q=0.9,*/*;q=0.8",
    },
  });
  clearTimeout(timeout);

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    throw new Error(`Failed to fetch metadata: ${response.status} ${body}`);
  }

  const airportXml = await extractAirportXmlForIcao(response, normalizedIcao);
  if (!airportXml) {
    setCachedPlates(icao, []);
    return [];
  }

  const recordMatches = airportXml.match(/<record>[\s\S]*?<\/record>/gi) || [];
  const plates: PlateMeta[] = [];

  for (const record of recordMatches) {
    const pdfName = extractTagValue(record, "pdf_name");
    if (!pdfName) continue;
    const name = extractTagValue(record, "chart_name") || pdfName;
    const type = extractTagValue(record, "chart_code") || inferPlateType(name);
    const effectiveDate = extractTagValue(record, "amdtdate");
    plates.push({
      name,
      type,
      effectiveDate,
      url: `${pdfBase}/${pdfName}`,
    });
  }

  setCachedPlates(icao, plates);
  return plates;
}

// Multer setup for file uploads with disk storage
const ensureUploadDir = (dir: string) => {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (error) {
    console.error(`Failed to ensure upload directory ${dir}:`, error);
  }
};

ensureUploadDir("uploads/marketplace");
ensureUploadDir("uploads/documents");

const storage_config = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname.includes('image') || file.mimetype.startsWith('image/')) {
      cb(null, 'uploads/marketplace/');
    } else {
      cb(null, 'uploads/documents/');
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = file.originalname.split('.').pop();
    cb(null, `${file.fieldname}-${uniqueSuffix}.${ext}`);
  }
});

const upload = multer({ 
  storage: storage_config, 
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept images, PDFs, and Word documents
    const allowedTypes = [
      'image/',
      'application/pdf',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
    ];
    
    const isAllowed = allowedTypes.some(type => file.mimetype.startsWith(type) || file.mimetype === type);
    
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error('Only image, PDF, and Word document files are allowed'));
    }
  }
});

const roomsSoldUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isTxt = file.mimetype === "text/plain" || file.originalname.toLowerCase().endsWith(".txt");
    if (isTxt) {
      cb(null, true);
    } else {
      cb(new Error("Only .txt files are allowed for rooms sold imports"));
    }
  },
});

// IP-based rate limiting middleware
interface RateLimitOptions {
  windowMs: number;
  max: number;
  dailyMax?: number;
  message?: string;
}

function createIpRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, dailyMax, message = "Too many requests, please try again later" } = options;
  const requests = new Map<string, number[]>();

  // Cleanup stale entries every 5 minutes to prevent memory growth
  setInterval(() => {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    for (const [ip, timestamps] of Array.from(requests.entries())) {
      const recentTimestamps = timestamps.filter((t: number) => now - t < dayInMs);
      if (recentTimestamps.length === 0) {
        requests.delete(ip);
      } else {
        requests.set(ip, recentTimestamps);
      }
    }
  }, 5 * 60 * 1000);

  return (req: any, res: any, next: any) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    if (!requests.has(ip)) {
      requests.set(ip, []);
    }
    
    const timestamps = requests.get(ip)!;
    
    // Keep all timestamps within 24 hours for daily limit tracking
    const dailyTimestamps = timestamps.filter(t => now - t < dayInMs);
    
    // Check daily limit first if configured
    if (dailyMax && dailyTimestamps.length >= dailyMax) {
      const oldestDailyTimestamp = Math.min(...dailyTimestamps);
      const retryAfter = Math.ceil((dayInMs - (now - oldestDailyTimestamp)) / 1000);
      
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ 
        error: "Daily request limit exceeded",
        retryAfter 
      });
    }
    
    // Check rolling window limit
    const recentTimestamps = dailyTimestamps.filter(t => now - t < windowMs);
    
    if (recentTimestamps.length >= max) {
      const oldestTimestamp = Math.min(...recentTimestamps);
      const retryAfter = Math.ceil((windowMs - (now - oldestTimestamp)) / 1000);
      
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ 
        error: message,
        retryAfter 
      });
    }
    
    // Record this request and update with all daily timestamps
    dailyTimestamps.push(now);
    requests.set(ip, dailyTimestamps);
    
    next();
  };
}

// Rate limiter for contact form: 5 requests per 10 minutes, 20 per day
const contactFormRateLimiter = createIpRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  dailyMax: 20,
  message: "Too many contact form submissions. Please try again later."
});

const airportLookupRateLimiter = createIpRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  dailyMax: 1000,
  message: "Too many airport lookups. Please try again shortly.",
});

const aircraftProfileRateLimiter = createIpRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  dailyMax: 500,
  message: "Too many requests. Please slow down.",
});

const aircraftTypeRateLimiter = createIpRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  dailyMax: 1000,
  message: "Too many requests. Please slow down.",
});

const notamRateLimiter = createSoftAuthRateLimiter({
  anonMax: Number(process.env.RATE_LIMIT_NOTAM_ANON_MAX || process.env.RATE_LIMIT_ANON_MAX || 30),
  key: "notams",
});

const tfrRateLimiter = createSoftAuthRateLimiter({
  anonMax: Number(process.env.RATE_LIMIT_TFR_ANON_MAX || process.env.RATE_LIMIT_ANON_MAX || 30),
  key: "tfrs",
});

const weatherRateLimiter = createSoftAuthRateLimiter({
  anonMax: Number(process.env.RATE_LIMIT_WEATHER_ANON_MAX || process.env.RATE_LIMIT_ANON_MAX || 60),
  key: "weather",
});

const airportSearchRateLimiter = createSoftAuthRateLimiter({
  anonMax: Number(process.env.RATE_LIMIT_AIRPORT_SEARCH_ANON_MAX || process.env.RATE_LIMIT_ANON_MAX || 60),
  key: "airport_search",
});

// Verification middleware - checks if user is verified
// CRITICAL: For rental-related endpoints (aircraft listings, rental bookings),
// verification is ALWAYS enforced for safety and security, regardless of any flags
const isVerified = async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // ALWAYS enforce verification for rentals (aircraft listings and bookings)
    // This is a critical security requirement that cannot be disabled
    if (!user.isVerified) {
      return res.status(403).json({ 
        error: "Account verification required",
        message: "Aircraft rentals require verified users for safety and security. Please complete account verification."
      });
    }
    
    next();
  } catch (error) {
    console.error("Error checking verification:", error);
    res.status(500).json({ error: "Verification check failed" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  startPlateCacheCron();
  // CORS: allow frontend origins and send credentials for session cookies
  const defaultOrigins = [
    "https://readysetfly.us",
    "https://www.readysetfly.us",
    "http://localhost:5173",
    "http://localhost:4173",
  ];
  const envOrigins = process.env.WEB_ORIGIN ? process.env.WEB_ORIGIN.split(",") : [];
  const allowedOrigins = Array.from(
    new Set([...envOrigins.map((o) => o.trim()).filter(Boolean), ...defaultOrigins]),
  );

  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
  }));

  // Auth middleware
  await setupAuth(app);

  // Unified authentication routes (for both web and mobile)
  app.use('/api/auth', registerUnifiedAuthRoutes(storage));

  // Mobile app authentication routes (JWT-based for React Native) - DEPRECATED, use /api/auth instead
  app.use('/api/mobile/auth', registerMobileAuthRoutes(storage));

  // Serve uploaded files
  app.use('/uploads', express.static('uploads'));

  // Serve GPS trainer panel images from S3 (private buckets supported)
  app.get('/api/gps-sims/panels/:imageKey', async (req, res) => {
    const rawKey = String(req.params.imageKey || "");
    const normalizedKey = rawKey.replace(/\.png$/i, "").trim();

    if (!normalizedKey || normalizedKey.includes("/") || normalizedKey.includes("..")) {
      return res.status(400).json({ error: "Invalid image key" });
    }

    if (!GPS_PANEL_KEYS.has(normalizedKey)) {
      return res.status(404).json({ error: "Panel image not found" });
    }

    if (!process.env.AWS_S3_BUCKET) {
      return res.status(404).json({ error: "Panel image not available" });
    }

    try {
      const { S3StorageService } = await import("./s3Storage.js");
      const s3Service = new S3StorageService();
      const candidates = buildGpsPanelObjectKeys(normalizedKey);

      for (const key of candidates) {
        try {
          const { stream, contentType, contentLength } = await s3Service.getObjectStream({ key });
          res.setHeader("Content-Type", contentType || "image/png");
          if (contentLength) res.setHeader("Content-Length", String(contentLength));
          res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=86400");
          await pipeline(stream, res);
          return;
        } catch (error: any) {
          const statusCode = error?.$metadata?.httpStatusCode;
          if (error?.name === "NoSuchKey" || statusCode === 404) {
            continue;
          }
          throw error;
        }
      }

      return res.status(404).json({ error: "Panel image not found" });
    } catch (error) {
      console.error("Error streaming GPS panel image:", error);
      if (res.headersSent) {
        res.end();
        return;
      }
      return res.status(500).json({ error: "Failed to load panel image" });
    }
  });

  // Serve six-pack trainer panel image from S3 (private buckets supported)
  app.get('/api/six-pack/panel', async (req, res) => {
    if (!process.env.AWS_S3_BUCKET) {
      return res.status(404).json({ error: "Panel image not available" });
    }

    const rawKeys = (process.env.SIX_PACK_PANEL_KEY || "6pack-instrument-panel.png")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);
    const bucketName = process.env.AWS_S3_BUCKET;

    const normalizePanelKey = (value: string) => {
      let key = value.trim();
      if (!key) return "";
      if (key.startsWith("http")) {
        try {
          const parsed = new URL(key);
          key = parsed.pathname.replace(/^\/+/, "");
          if (key.startsWith(`${bucketName}/`)) {
            key = key.slice(bucketName.length + 1);
          }
        } catch {
          // Fall back to raw key
        }
      }
      return key;
    };

    const candidates = Array.from(
      new Set(
        rawKeys.flatMap((rawKey) => {
          const normalized = normalizePanelKey(rawKey);
          if (!normalized) return [];
          if (normalized.includes("..") || normalized.startsWith("/")) return [];
          if (normalized.includes("/")) {
            return [normalized];
          }
          return [normalized, `uploads/${normalized}`];
        })
      )
    );

    if (!candidates.length) {
      return res.status(400).json({ error: "Invalid panel key" });
    }

    try {
      const { S3StorageService } = await import("./s3Storage.js");
      const s3Service = new S3StorageService();
      for (const key of candidates) {
        try {
          const { stream, contentType, contentLength } = await s3Service.getObjectStream({ key });
          res.setHeader("Content-Type", contentType || "image/png");
          if (contentLength) res.setHeader("Content-Length", String(contentLength));
          res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=86400");
          await pipeline(stream, res);
          return;
        } catch (error: any) {
          const statusCode = error?.$metadata?.httpStatusCode;
          if (error?.name === "NoSuchKey" || statusCode === 404) {
            continue;
          }
          throw error;
        }
      }

      return res.status(404).json({ error: "Panel image not found" });
    } catch (error: any) {
      const statusCode = error?.$metadata?.httpStatusCode;
      if (error?.name === "NoSuchKey" || statusCode === 404) {
        return res.status(404).json({ error: "Panel image not found" });
      }
      console.error("Error streaming six-pack panel image:", error);
      if (res.headersSent) {
        res.end();
        return;
      }
      return res.status(500).json({ error: "Failed to load panel image" });
    }
  });

  // Object Storage Routes (for marketplace listing images)
  // Get upload URL for listing images
  app.post('/api/objects/upload', isAuthenticated, async (req: any, res) => {
    try {
      // Use S3 for production, fallback to ObjectStorage for Replit
      if (process.env.AWS_S3_BUCKET) {
        const { S3StorageService } = await import('./s3Storage.js');
        const s3Service = new S3StorageService();
        const uploadURL = await s3Service.getPresignedUploadUrl();
        res.json({ uploadURL });
      } else {
        const objectStorageService = new ObjectStorageService();
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        res.json({ uploadURL });
      }
    } catch (error) {
      console.error('Error getting upload URL:', error);
      res.status(500).json({ error: 'Failed to get upload URL' });
    }
  });

  // Set ACL policy for uploaded objects (used by admin banner uploads and listings)
  app.post('/api/objects/set-acl', isAuthenticated, async (req: any, res) => {
    try {
      const rawPath = typeof req.body?.path === "string" ? req.body.path.trim() : "";
      if (!rawPath) {
        return res.status(400).json({ error: "path is required" });
      }

      const access = typeof req.body?.access === "string" ? req.body.access.toLowerCase() : "private";
      const visibility = access === "publicread" || access === "public" ? "public" : "private";

      if (process.env.AWS_S3_BUCKET) {
        const { S3StorageService } = await import('./s3Storage.js');
        const s3Service = new S3StorageService();
        if (visibility === "public") {
          await s3Service.setPublicRead(rawPath);
        }
        let cleanUrl = rawPath;
        try {
          const parsed = new URL(rawPath);
          cleanUrl = `${parsed.origin}${parsed.pathname}`;
        } catch {
          cleanUrl = rawPath.split("?")[0];
        }
        return res.status(200).json({ objectPath: cleanUrl });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(rawPath, {
        owner: req.user.claims.sub,
        visibility,
      });
      return res.status(200).json({ objectPath });
    } catch (error) {
      console.error('Error setting object ACL:', error);
      return res.status(500).json({ error: 'Failed to set object ACL' });
    }
  });

  // Set ACL policy for uploaded listing images
  app.put('/api/listing-images', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.body.imageURL) {
        return res.status(400).json({ error: 'imageURL is required' });
      }

      const requesterId = req.user.claims.sub;
      
      // Use S3 for production, fallback to ObjectStorage for Replit
      if (process.env.AWS_S3_BUCKET) {
        const { S3StorageService } = await import('./s3Storage.js');
        const s3Service = new S3StorageService();
        await s3Service.setPublicRead(req.body.imageURL);
        res.status(200).json({ objectPath: req.body.imageURL });
      } else {
        const objectStorageService = new ObjectStorageService();
        const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
          req.body.imageURL,
          {
            owner: userId,
            visibility: "public", // Listing images are public
          },
        );
        res.status(200).json({ objectPath });
      }
    } catch (error) {
      console.error('Error setting listing image ACL:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Serve objects with ACL check
  app.get('/objects/:objectPath(*)', async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub; // May be undefined for unauthenticated requests
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      
      if (!canAccess) {
        return res.sendStatus(401);
      }
      
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error('Error serving object:', error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      if (String(process.env.AUTH_LOG_REQUEST_META || '').toLowerCase() === 'true') {
        const forwardedFor = String(req.headers['x-forwarded-for'] || '')
          .split(',')[0]
          .trim();
        const ip =
          forwardedFor ||
          String(req.headers['x-real-ip'] || '') ||
          req.socket?.remoteAddress ||
          'unknown';
        const userAgent = String(req.headers['user-agent'] || 'unknown');
        logDebug(`[AUTH META] ip=${ip} ua="${userAgent}"`);
      }
      const sessionUserId = req.user?.claims?.sub || req.session?.userId;
      if (!sessionUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      logDebug("[AUTH /api/auth/user] Looking up user with session ID:", sessionUserId);
      let user = await storage.getUser(sessionUserId);
      
      if (!user) {
        logDebug("[AUTH /api/auth/user] User not found by ID, trying email lookup");
        // Try to find by email as fallback (for testing scenarios where sub may change)
        const email = req.user?.claims?.email;
        if (email) {
          user = await storage.getUserByEmail(email);
          logDebug("[AUTH /api/auth/user] Email lookup result:", user ? `Found user ${user.id}` : "Not found");
        }
        
        if (!user) {
          logDebug("[AUTH /api/auth/user] User not found by ID or email");
          return res.status(404).json({ message: "User not found" });
        }
      }
      
      // Grant Super Admin access to @readysetfly.us emails and allowed founders
      const email = user.email?.toLowerCase();
      const shouldBeSuperAdmin = isSuperAdminEmail(email);
      
      // Update super admin status if needed - use the FOUND user's ID, not the session ID
      if (shouldBeSuperAdmin && !user.isSuperAdmin) {
        logDebug("[AUTH /api/auth/user] Granting super admin to user:", user.id);
        await storage.updateUser(user.id, { 
          isSuperAdmin: true,
          isAdmin: true,
          isVerified: true,
          adminRole: "operations",
          adminPermissions: [...ADMIN_PERMISSIONS],
        });
        user = await storage.getUser(user.id); // Refetch updated user
      }

      if (user) {
        user = await maybeSyncLogbookProSubscription(storage, user);
      }

      const entitlements = getEntitlementsForUser(user);
      res.json({ ...user, entitlements });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Delete user account
  app.delete('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      logDebug("[DELETE /api/auth/user] Deleting user account:", userId);
      
      const success = await storage.deleteUser(userId);
      
      if (success) {
        // Logout safely: run passport logout first, then destroy session to avoid race conditions.
        const sendDeleted = () => res.json({ message: "Account deleted successfully" });
        const destroySession = () => {
          if (req.session && typeof req.session.destroy === "function") {
            return req.session.destroy((destroyErr: any) => {
              if (destroyErr) {
                console.error("Session destroy error after account deletion:", destroyErr);
              }
              sendDeleted();
            });
          }
          return sendDeleted();
        };

        if (req.session && typeof req.logout === "function") {
          return req.logout((err: any) => {
            if (err) {
              console.error("Error logging out after account deletion:", err);
            }
            destroySession();
          });
        }

        return destroySession();
      } else {
        res.status(500).json({ error: "Failed to delete account" });
      }
    } catch (error) {
      console.error("Error deleting user account:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // Web logout endpoint (used by header link)
  app.get("/api/logout", (req, res) => {
    try {
      const frontendBase = process.env.FRONTEND_BASE_URL || "https://readysetfly.us";
      const requestedRedirect = typeof req.query.redirect === "string" ? req.query.redirect : "";
      let safeRedirect = frontendBase;
      if (requestedRedirect) {
        try {
          const parsed = new URL(requestedRedirect);
          const allowedHosts = new Set(["readysetfly.us", "www.readysetfly.us", "localhost", "127.0.0.1"]);
          if (allowedHosts.has(parsed.hostname)) {
            safeRedirect = parsed.origin;
          }
        } catch {
          // ignore invalid redirect and use frontend base
        }
      }

      const finish = () => {
        res.clearCookie("connect.sid");
        return res.redirect(safeRedirect);
      };

      const destroySession = () => {
        if (req.session && typeof req.session.destroy === "function") {
          return req.session.destroy((destroyErr: any) => {
            if (destroyErr) {
              console.error("Session destroy error:", destroyErr);
            }
            finish();
          });
        }
        return finish();
      };

      if (req.session && typeof req.logout === "function") {
        return req.logout((err: any) => {
          if (err) {
            console.error("Logout error:", err);
          }
          destroySession();
        });
      }

      return destroySession();
    } catch (error) {
      console.error("Logout error:", error);
      return res.status(500).json({ error: "Failed to logout" });
    }
  });

  // Image upload endpoint for marketplace listings
  app.post("/api/upload-images", isAuthenticated, upload.array('images', 15), async (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }
      
      // Return URLs for uploaded files
      const imageUrls = files.map(file => `/uploads/marketplace/${file.filename}`);
      
      res.json({ imageUrls });
    } catch (error: any) {
      console.error("Image upload error:", error);
      res.status(500).json({ error: error.message || "Image upload failed" });
    }
  });

  // Document upload endpoint for invoices and other documents
  app.post("/api/upload-documents", isAuthenticated, upload.array('documents', 5), async (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }
      
      // Return URLs for uploaded documents (saved in uploads/documents/)
      const documentUrls = files.map(file => `/uploads/documents/${file.filename}`);
      
      res.json({ documentUrls });
    } catch (error: any) {
      console.error("Document upload error:", error);
      res.status(500).json({ error: error.message || "Document upload failed" });
    }
  });

  // PayPal - Get Client ID for frontend SDK initialization
  app.get("/api/paypal/config", async (req, res) => {
    res.json({ 
      clientId: process.env.PAYPAL_CLIENT_ID,
      environment: process.env.NODE_ENV === "production" ? "production" : "sandbox"
    });
  });

  app.post("/api/marketplace/listing-fee-quote", isAuthenticated, async (req: any, res) => {
    try {
      const { category, tier } = req.body || {};
      if (!category) {
        return res.status(400).json({ error: "Listing category is required" });
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const feeBreakdown = buildMarketplaceListingFeeBreakdown({ category, tier, user });

      if (!feeBreakdown.isTraditionalMarketplace) {
        return res.status(400).json({ error: "Unsupported listing category" });
      }

      res.json({
        ...feeBreakdown,
      });
    } catch (error: any) {
      console.error("Marketplace listing fee quote error:", error);
      res.status(500).json({ error: error.message || "Failed to calculate listing fee" });
    }
  });

  const parseBillingInterval = (value?: string | null): "monthly" | "biannual" | "annual" | null => {
    if (!value) return null;
    const normalized = value.toLowerCase();
    if (normalized === "monthly") return "monthly";
    if (normalized === "biannual" || normalized === "semiannual" || normalized === "6-months") return "biannual";
    if (normalized === "annual" || normalized === "yearly") return "annual";
    return null;
  };

  const buildSubscriptionReturnUrls = () => {
    const baseUrl = getPublicBaseUrl();
    return {
      return_url: `${baseUrl}/logbook/pro/success`,
      cancel_url: `${baseUrl}/logbook/pro/cancel`,
    };
  };

  const createMembershipSubscription = async (userId: string, tier: "pro" | "pro_plus", interval: "monthly" | "biannual" | "annual") => {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const planId = resolvePayPalPlanId(tier, interval);
    const { return_url, cancel_url } = buildSubscriptionReturnUrls();
    const subscription = await paypalRequest("/v1/billing/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: planId,
        custom_id: `user:${userId}|tier:${tier}|interval:${interval}|purpose:membership`,
        subscriber: user.email ? { email_address: user.email } : undefined,
        application_context: {
          brand_name: "Ready Set Fly",
          user_action: "SUBSCRIBE_NOW",
          return_url,
          cancel_url,
        },
      }),
    });

    const approveUrl =
      subscription?.links?.find((l: any) => l.rel === "approve")?.href ||
      subscription?.links?.[0]?.href;

      await storage.updateUser(userId, {
        membershipTier: tier,
        membershipStatus: "inactive",
        membershipProvider: "paypal",
        membershipInterval: interval,
        membershipTrialEndsAt: null,
        membershipNextBillingAt: null,
        paypalSubscriptionId: subscription.id,
        paypalPlanId: planId,
        logbookProStatus: "pending",
        logbookProPlan: interval,
        logbookProSubscriptionId: subscription.id,
      });

    return { subscription, approveUrl };
  };

  const confirmMembershipSubscription = async (userId: string, subscriptionId: string) => {
    const subscription = await paypalRequest(`/v1/billing/subscriptions/${subscriptionId}`, {
      method: "GET",
    });

    const customIdRaw = subscription?.custom_id;
    const customData = parsePayPalCustomId(customIdRaw || "");
    if (customData.user && customData.user !== userId) {
      throw new Error("Subscription does not belong to this user");
    }
    if (!customData.user && customIdRaw && customIdRaw !== userId) {
      throw new Error("Subscription does not belong to this user");
    }

    const status = (subscription?.status || "UNKNOWN").toLowerCase();
    const planId = subscription?.plan_id;
    const planInfo = resolveMembershipFromPlanId(planId);
    if (!planInfo) {
      throw new Error("Unknown PayPal plan ID");
    }

      const startedAt = subscription?.start_time ? new Date(subscription.start_time) : new Date();
      const nextBillingAt = subscription?.billing_info?.next_billing_time
        ? new Date(subscription.billing_info.next_billing_time)
        : null;
      const lastPaymentAt = subscription?.billing_info?.last_payment?.time
        ? new Date(subscription.billing_info.last_payment.time)
        : null;
      const isTrial = planInfo.interval === "monthly" && nextBillingAt && !lastPaymentAt;
      const membershipStatus = isTrial ? "trialing" : mapPayPalStatusToMembership(status);
      await storage.updateUser(userId, {
        membershipTier: planInfo.tier,
        membershipStatus,
        membershipProvider: "paypal",
        membershipInterval: planInfo.interval,
        membershipEndsAt: nextBillingAt || undefined,
        membershipTrialEndsAt: isTrial ? nextBillingAt : null,
        membershipNextBillingAt: nextBillingAt || undefined,
        paypalSubscriptionId: subscriptionId,
        paypalPlanId: planId,
        logbookProStatus:
          membershipStatus === "active" || membershipStatus === "trialing" ? "active" : status,
        logbookProPlan: planInfo.interval,
        logbookProSubscriptionId: subscriptionId,
        logbookProStartedAt: startedAt,
        logbookProEndsAt: nextBillingAt || undefined,
      });

    return subscription;
  };

  const cancelMembershipSubscription = async (userId: string, reason?: string) => {
    const user = await storage.getUser(userId);
    const subscriptionId = user?.paypalSubscriptionId || user?.logbookProSubscriptionId;
    if (!user || !subscriptionId) {
      throw new Error("No active subscription found");
    }

    await paypalRequest(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: reason || "User requested cancellation" }),
    });

    await storage.updateUser(userId, {
      membershipStatus: "cancelled",
      membershipProvider: "paypal",
      logbookProStatus: "cancelled",
      logbookProCanceledAt: new Date(),
      logbookProCancelAtPeriodEnd: false,
    });
  };

  // PayPal - Create RSF Membership subscription
  app.post("/api/paypal/membership/subscribe", isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.user.claims.sub;
      const tier = req.body?.tier === "pro_plus" ? "pro_plus" : req.body?.tier === "pro" ? "pro" : null;
      const interval = parseBillingInterval(req.body?.interval);
      if (!tier || !interval) {
        return res.status(400).json({ error: "Invalid membership tier or interval" });
      }
      const { subscription, approveUrl } = await createMembershipSubscription(userId, tier, interval);
      res.json({ id: subscription.id, approveUrl });
    } catch (error: any) {
      console.error("Membership subscription create error:", error);
      res.status(500).json({ error: error.message || "Failed to create subscription" });
    }
  });

  // PayPal - Confirm RSF Membership subscription after approval
  app.get("/api/paypal/membership/confirm", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const subscriptionId = req.query.subscriptionId as string;
      if (!subscriptionId) {
        return res.status(400).json({ error: "Missing subscriptionId" });
      }

      const subscription = await confirmMembershipSubscription(userId, subscriptionId);
      res.json({ status: subscription.status, subscription });
    } catch (error: any) {
      console.error("Membership subscription confirm error:", error);
      res.status(500).json({ error: error.message || "Failed to confirm subscription" });
    }
  });

  // PayPal - Cancel RSF Membership subscription
  app.post("/api/paypal/membership/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await cancelMembershipSubscription(userId, req.body?.reason);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Membership subscription cancel error:", error);
      res.status(500).json({ error: error.message || "Failed to cancel subscription" });
    }
  });

  // Legacy Logbook Pro endpoints (mapped to RSF Pro core monthly)
  app.post("/api/paypal/logbook/subscribe", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { subscription, approveUrl } = await createMembershipSubscription(userId, "pro", "monthly");
      res.json({ id: subscription.id, approveUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create subscription" });
    }
  });

  app.get("/api/paypal/logbook/confirm", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const subscriptionId = req.query.subscriptionId as string;
      if (!subscriptionId) {
        return res.status(400).json({ error: "Missing subscriptionId" });
      }
      const subscription = await confirmMembershipSubscription(userId, subscriptionId);
      res.json({ status: subscription.status, subscription });
    } catch (error: any) {
      console.error("Legacy confirm error:", error);
      res.status(500).json({ error: error.message || "Failed to confirm subscription" });
    }
  });

  app.post("/api/paypal/logbook/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await cancelMembershipSubscription(userId, req.body?.reason);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Legacy cancel error:", error);
      res.status(500).json({ error: error.message || "Failed to cancel subscription" });
    }
  });

  // PayPal - Webhook (subscription lifecycle + payment status)
  app.post("/api/paypal/webhook", async (req, res) => {
    try {
      const webhookId = process.env.PAYPAL_WEBHOOK_ID;
      if (!webhookId) {
        return res.status(500).json({ error: "Missing PayPal webhook ID" });
      }

      const transmissionId = req.header("paypal-transmission-id");
      const transmissionTime = req.header("paypal-transmission-time");
      const transmissionSig = req.header("paypal-transmission-sig");
      const certUrl = req.header("paypal-cert-url");
      const authAlgo = req.header("paypal-auth-algo");

      if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
        return res.status(400).json({ error: "Missing PayPal signature headers" });
      }

      const verification = await paypalRequest("/v1/notifications/verify-webhook-signature", {
        method: "POST",
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: webhookId,
          webhook_event: req.body,
        }),
      });

      if (verification?.verification_status !== "SUCCESS") {
        return res.status(400).json({ error: "Invalid webhook signature" });
      }

      const eventType = req.body?.event_type;
      const resource = req.body?.resource;

      if (!eventType || !resource) {
        return res.json({ received: true });
      }

      const subscriptionId =
        resource?.billing_agreement_id ||
        resource?.subscription_id ||
        resource?.id;
      let user = null;
      let customData: Record<string, string> = {};

      if (resource?.custom_id) {
        customData = parsePayPalCustomId(String(resource.custom_id));
        if (customData.user) {
          user = await storage.getUser(String(customData.user));
        }
      }

      if (!user && subscriptionId) {
        user = await storage.getUserByPayPalSubscriptionId(String(subscriptionId));
      }

      if (!user && subscriptionId) {
        user = await storage.getUserByLogbookSubscriptionId(String(subscriptionId));
      }

      if (!user && resource?.subscriber?.email_address) {
        user = await storage.getUserByEmail(String(resource.subscriber.email_address));
      }

      if (!user) {
        console.warn("PayPal webhook: user not found for subscription", subscriptionId);
        return res.json({ received: true });
      }

        let subscriptionDetails: any = resource;
        if (subscriptionId && (!resource?.billing_info || !resource?.plan_id)) {
          try {
            subscriptionDetails = await paypalRequest(`/v1/billing/subscriptions/${subscriptionId}`, {
              method: "GET",
            });
          } catch {
            subscriptionDetails = resource;
          }
        }

        const planId = subscriptionDetails?.plan_id || resource?.plan_id;
        const planInfo = resolveMembershipFromPlanId(planId);
        const planInterval =
          planInfo?.interval || user.membershipInterval || user.logbookProPlan;

        const startedAt = subscriptionDetails?.start_time
          ? new Date(subscriptionDetails.start_time)
          : resource?.start_time
            ? new Date(resource.start_time)
            : undefined;
        const nextBillingAt = subscriptionDetails?.billing_info?.next_billing_time
          ? new Date(subscriptionDetails.billing_info.next_billing_time)
          : resource?.billing_info?.next_billing_time
            ? new Date(resource.billing_info.next_billing_time)
            : undefined;
        const lastPaymentAt = subscriptionDetails?.billing_info?.last_payment?.time
          ? new Date(subscriptionDetails.billing_info.last_payment.time)
          : undefined;
        const subscriptionStatus = (subscriptionDetails?.status || resource?.status || "UNKNOWN").toLowerCase();
        const isTrial = planInterval === "monthly" && nextBillingAt && !lastPaymentAt;
        const computedStatus = isTrial ? "trialing" : mapPayPalStatusToMembership(subscriptionStatus);

        const updates: any = {
          membershipProvider: "paypal",
          paypalSubscriptionId: subscriptionId || user.paypalSubscriptionId,
          paypalPlanId: planId || user.paypalPlanId,
          logbookProSubscriptionId: subscriptionId || user.logbookProSubscriptionId,
          logbookProPlan: planInterval,
          membershipInterval: planInterval,
          membershipTrialEndsAt: isTrial ? nextBillingAt : null,
          membershipNextBillingAt: nextBillingAt,
        };

        if (planInfo?.tier) {
          updates.membershipTier = planInfo.tier;
        }
        if (nextBillingAt) {
          updates.membershipEndsAt = nextBillingAt;
          updates.logbookProEndsAt = nextBillingAt;
        }

        switch (eventType) {
          case "BILLING.SUBSCRIPTION.ACTIVATED":
          case "BILLING.SUBSCRIPTION.RE-ACTIVATED":
            updates.membershipStatus = computedStatus === "trialing" ? "trialing" : "active";
            updates.logbookProStatus = "active";
            if (startedAt) updates.logbookProStartedAt = startedAt;
            updates.logbookProCancelAtPeriodEnd = false;
            break;
          case "BILLING.SUBSCRIPTION.CREATED":
            updates.membershipStatus = "inactive";
            updates.logbookProStatus = "pending";
            if (startedAt) updates.logbookProStartedAt = startedAt;
            break;
          case "BILLING.SUBSCRIPTION.CANCELLED":
          case "BILLING.SUBSCRIPTION.EXPIRED":
            updates.membershipStatus = "cancelled";
            updates.logbookProStatus = "cancelled";
            updates.logbookProCanceledAt = resource?.status_update_time
              ? new Date(resource.status_update_time)
              : new Date();
            updates.logbookProCancelAtPeriodEnd = false;
            break;
          case "BILLING.SUBSCRIPTION.SUSPENDED":
            updates.membershipStatus = "cancelled";
            updates.logbookProStatus = "suspended";
            break;
          case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
            updates.membershipStatus = "past_due";
            updates.logbookProStatus = "payment_failed";
            break;
          case "BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED":
            updates.membershipStatus = computedStatus === "trialing" ? "trialing" : "active";
            updates.logbookProStatus = "active";
            break;
          default:
            break;
        }

      await storage.updateUser(user.id, updates);

      const isSubscriptionPaymentEvent =
        eventType === "BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED" ||
        eventType === "BILLING.SUBSCRIPTION.PAYMENT.COMPLETED" ||
        eventType === "PAYMENT.SALE.COMPLETED";
      const hasMembershipPurpose = customData.purpose === "membership";
      const subscriptionPaymentId =
        req.body?.id ||
        resource?.id ||
        resource?.resource_id ||
        `${eventType}:${subscriptionId ?? "unknown"}`;

      if (isSubscriptionPaymentEvent && (hasMembershipPurpose || subscriptionId)) {
        const amountValue =
          resource?.amount?.value ??
          resource?.amount?.total ??
          resource?.amount?.amount?.value ??
          resource?.amount?.gross_amount?.value ??
          resource?.amount?.grossAmount?.value;
        if (amountValue) {
          const amountNumber = Number(amountValue);
          if (Number.isFinite(amountNumber) && amountNumber > 0) {
            const description = `membership_fee:${String(subscriptionPaymentId)}`;
            const existing = await storage.getTransactionsByUser(user.id);
            const alreadyRecorded = existing.some(
              (transaction) =>
                transaction.type === "membership_fee" && transaction.description === description
            );
            if (!alreadyRecorded) {
              await storage.createTransaction({
                userId: user.id,
                type: "membership_fee",
                amount: amountNumber.toFixed(2),
                status: "completed",
                description,
                rentalId: null,
                marketplaceListingId: null,
                depositedToBankAt: null,
              });
            }
          }
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("PayPal webhook error:", error);
      res.status(500).json({ error: "Webhook handling failed" });
    }
  });

  // PayPal - Create order for marketplace listing fees
  app.post("/api/paypal/create-order-listing", isAuthenticated, async (req: any, res) => {
    try {
      const { category, tier, promoCode, finalAmount } = req.body;
      const userId = req.user.claims.sub;
      
      if (!category) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const user = await storage.getUser(userId);
      const feeBreakdown = buildMarketplaceListingFeeBreakdown({ category, tier, user });
      if (!feeBreakdown.isTraditionalMarketplace) {
        return res.status(400).json({ error: "Unsupported listing category" });
      }

      // Server-side pricing calculation - NEVER trust client
      const fullAmount = feeBreakdown.totalDue;
      
      // If promo code applied, validate and use discounted amount
      let amount = fullAmount;
      if (promoCode) {
        // Re-validate promo code server-side and get promo details
        const validatedPromo = await storage.validatePromoCodeForContext(promoCode, 'marketplace');
        
        if (!validatedPromo) {
          return res.status(400).json({ error: "Invalid or expired promo code" });
        }
        
        // Calculate discount SERVER-SIDE from validated promo details
        let serverCalculatedDiscount = 0;
        if (validatedPromo.discountType === 'percentage') {
          const discountPercent = parseFloat(validatedPromo.discountValue || "0");
          serverCalculatedDiscount = (fullAmount * discountPercent) / 100;
        } else if (validatedPromo.discountType === 'fixed' || validatedPromo.discountType === 'fixed_amount') {
          serverCalculatedDiscount = parseFloat(validatedPromo.discountValue || "0");
        } else if (validatedPromo.discountType === 'free_7_day' || validatedPromo.discountType === 'waive_creation_fee') {
          serverCalculatedDiscount = fullAmount;
        }
        
        // Clamp discount to not exceed full amount
        serverCalculatedDiscount = Math.min(serverCalculatedDiscount, fullAmount);
        
        // Calculate expected final amount from SERVER-CALCULATED discount
        const expectedFinal = Math.max(0, fullAmount - serverCalculatedDiscount);
        if (finalAmount !== undefined) {
          const parsedFinal = parseFloat(finalAmount);
          
          if (!Number.isFinite(parsedFinal) || parsedFinal < 0) {
            console.error(`Invalid final amount: ${finalAmount}`);
            return res.status(400).json({ error: "Invalid final amount" });
          }
          
          // Normalize to cents (integers) for precise comparison
          const expectedFinalCents = Math.round(expectedFinal * 100);
          const providedFinalCents = Math.round(parsedFinal * 100);
          
          // Verify client-provided finalAmount matches server calculation (exact match in cents)
          if (expectedFinalCents !== providedFinalCents) {
            console.error(`Amount mismatch: expected ${expectedFinal.toFixed(2)} ($${expectedFinalCents}??), got ${parsedFinal.toFixed(2)} ($${providedFinalCents}??)`);
            return res.status(400).json({ error: "Amount verification failed - promo discount mismatch" });
          }
        }

        // Use server-calculated amount (normalized to 2 decimals)
        amount = expectedFinal;
      }
      
      // Normalize amount to 2 decimal places (prevents PayPal errors)
      amount = Math.round(amount * 100) / 100;
      
      // Ensure amount is never $0 (those should use free completion endpoint)
      if (amount <= 0) {
        return res.status(400).json({ error: "Use free completion endpoint for $0 orders" });
      }
      
      const collect = {
        body: {
          intent: "CAPTURE",
          purchaseUnits: [
            {
              amount: {
                currencyCode: "USD",
                value: amount.toFixed(2),
              },
              description: `Ready Set Fly - ${category} listing fee (${tier || 'basic'} tier)`,
              customId: `user:${userId}|category:${category}|tier:${tier || 'basic'}|purpose:marketplace_listing_fee`,
            },
          ],
        },
        prefer: "return=minimal",
      };

      const { body, ...httpResponse } = await ordersController.createOrder(collect as any);
      const jsonResponse = JSON.parse(String(body));

      if (feeBreakdown.membershipDiscountPct > 0) {
        logDebug(
          `Marketplace listing discount applied: ${category} ${tier || "basic"} ` +
            `tier=${feeBreakdown.membershipTierApplied} pct=${feeBreakdown.membershipDiscountPct}`
        );
      }
      jsonResponse.feeBreakdown = feeBreakdown;
      
      res.status(httpResponse.statusCode).json(jsonResponse);
    } catch (error: any) {
      console.error("PayPal create order error:", error);
      res.status(500).json({ error: error.message || "Failed to create order" });
    }
  });

  // PayPal - Create order for marketplace listing upgrade
  app.post("/api/paypal/create-order-upgrade", isAuthenticated, async (req: any, res) => {
    try {
      const { listingId, newTier } = req.body;
      const userId = req.user.claims.sub;
      
      if (!listingId || !newTier) {
        return res.status(400).json({ error: "Missing required fields: listingId and newTier" });
      }
      
      // Validate new tier
      if (!VALID_TIERS.includes(newTier as any)) {
        return res.status(400).json({ error: "Invalid tier" });
      }
      
      // Fetch the existing listing
      const listing = await storage.getMarketplaceListing(listingId);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      // Verify ownership
      if (listing.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to upgrade this listing" });
      }
      
      // Validate upgrade (must be going up in tier)
      if (!isValidUpgrade(listing.tier || 'basic', newTier)) {
        return res.status(400).json({ error: "Invalid upgrade - must upgrade to a higher tier" });
      }
      
      // Calculate upgrade cost using shared pricing helper
      const upgradeDelta = getUpgradeDelta(listing.category, listing.tier || 'basic', newTier);
      const totalWithTax = calculateTotalWithTax(upgradeDelta);
      
      // Ensure amount is never $0
      if (totalWithTax <= 0) {
        return res.status(400).json({ error: "Upgrade amount must be greater than $0" });
      }
      
      // Normalize to 2 decimal places
      const amount = Math.round(totalWithTax * 100) / 100;
      
      logDebug(`Creating upgrade order for listing ${listingId}: ${listing.tier} → ${newTier}, amount: $${amount}`);
      
      const collect = {
        body: {
          intent: "CAPTURE",
          purchaseUnits: [
            {
              amount: {
                currencyCode: "USD",
                value: amount.toFixed(2),
              },
              description: `Ready Set Fly - Listing Upgrade (${listing.tier} → ${newTier})`,
              customId: `upgrade:${listingId}|user:${userId}|tier:${newTier}|purpose:marketplace_upgrade_fee`,
            },
          ],
        },
        prefer: "return=minimal",
      };

      const { body, ...httpResponse } = await ordersController.createOrder(collect as any);
      const jsonResponse = JSON.parse(String(body));
      
      res.status(httpResponse.statusCode).json(jsonResponse);
    } catch (error: any) {
      console.error("PayPal create upgrade order error:", error);
      res.status(500).json({ error: error.message || "Failed to create upgrade order" });
    }
  });

  // PayPal - Create order for rental payments
  app.post("/api/paypal/create-order-rental", isAuthenticated, isVerified, async (req: any, res) => {
    try {
      const { rentalId } = req.body;
      const userId = req.user.claims.sub;
      
      if (!rentalId) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const rental = await storage.getRental(rentalId);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      
      if (rental.renterId !== userId) {
        return res.status(403).json({ error: "Not authorized to pay for this rental" });
      }
      
      if (rental.isPaid) {
        return res.status(400).json({ error: "Rental is already paid" });
      }
      
      if (rental.status !== "approved") {
        return res.status(400).json({ error: "Rental must be in approved status" });
      }
      
      const expectedAmount = parseFloat(rental.totalCostRenter || "0");
      if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
        return res.status(400).json({ error: "Invalid rental amount" });
      }
      
      const collect = {
        body: {
          intent: "CAPTURE",
          purchaseUnits: [
            {
              amount: {
                currencyCode: "USD",
                value: expectedAmount.toFixed(2),
              },
              description: `Ready Set Fly - Aircraft rental payment`,
              customId: `user:${userId}|purpose:rental_payment|rental:${rentalId}`,
            },
          ],
        },
        prefer: "return=minimal",
      };

      const { body, ...httpResponse } = await ordersController.createOrder(collect as any);
      const jsonResponse = JSON.parse(String(body));
      
      res.status(httpResponse.statusCode).json(jsonResponse);
    } catch (error: any) {
      console.error("PayPal create rental order error:", error);
      res.status(500).json({ error: error.message || "Failed to create order" });
    }
  });

  // PayPal - Create order for banner ad payments
  app.post("/api/paypal/create-order-banner-ad", async (req: any, res) => {
    try {
      const { orderId, promoCode } = req.body;
      
      if (!orderId) {
        return res.status(400).json({ error: "Missing order ID" });
      }
      
      // Load the banner ad order to get pricing
      const order = await storage.getBannerAdOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Use original grandTotal as baseline (never mutate it)
      const originalAmount = parseFloat(order.grandTotal);
      let discountAmount = parseFloat(order.discountAmount || "0");
      let appliedPromoCode = order.promoCode || null;
      
      // Validate and apply promo code if provided (only if not already applied)
      if (promoCode && !order.promoCode) {
        const validPromo = await storage.validatePromoCodeForContext(promoCode, 'banner-ad');
        if (validPromo) {
          appliedPromoCode = validPromo.code;
          
          // Calculate discount from original amount
          if (validPromo.discountType === 'percentage') {
            discountAmount = originalAmount * (parseFloat(validPromo.discountValue || "0") / 100);
          } else if (validPromo.discountType === 'fixed') {
            discountAmount = parseFloat(validPromo.discountValue || "0");
          }
          
          // Persist promo code and discount (but NOT grandTotal - keep it as original)
          await storage.updateBannerAdOrder(orderId, {
            promoCode: validPromo.code,
            discountAmount: discountAmount.toFixed(2),
          });
          
          logDebug(`Promo code ${promoCode} applied to order ${orderId}: -$${discountAmount.toFixed(2)}`);
        }
      }
      
      // Calculate final amount from original - discount (idempotent)
      const finalAmount = Math.max(0, originalAmount - discountAmount);
      
      // For $0 orders (100% promo discount), generate a secure token for free completion
      if (finalAmount <= 0) {
        // Generate JWT token for secure free order completion
        const completionToken = jwt.sign(
          {
            orderId: orderId,
            sponsorEmail: order.sponsorEmail,
            type: 'free-order-completion',
          },
          process.env.SESSION_SECRET || 'dev-secret',
          { expiresIn: '15m' } // Token expires in 15 minutes
        );
        
        logDebug(`✅ Generated free completion token for banner ad order ${orderId} (100% discount applied)`);
        
        return res.json({
          useFreeCompletion: true,
          completionToken,
          orderId,
          message: 'This order qualifies for free completion - no payment required'
        });
      }
      
      logDebug(`Creating PayPal order for ${orderId}: original=$${originalAmount.toFixed(2)}, discount=$${discountAmount.toFixed(2)}, final=$${finalAmount.toFixed(2)}`);
      
      
      const collect = {
        body: {
          intent: "CAPTURE",
          purchaseUnits: [
            {
              amount: {
                currencyCode: "USD",
                value: finalAmount.toFixed(2),
              },
              description: `Ready Set Fly - Banner Ad: ${order.title}`,
              customId: `banner-ad:${orderId}|sponsor:${order.sponsorEmail}${appliedPromoCode ? `|promo:${appliedPromoCode}` : ''}`,
            },
          ],
        },
        prefer: "return=minimal",
      };

      const { body, ...httpResponse } = await ordersController.createOrder(collect as any);
      const jsonResponse = JSON.parse(String(body));
      
      res.status(httpResponse.statusCode).json(jsonResponse);
    } catch (error: any) {
      console.error("PayPal create banner ad order error:", error);
      res.status(500).json({ error: error.message || "Failed to create order" });
    }
  });

  // PayPal - Capture order payment (after user approval)
  app.post("/api/paypal/capture-order/:orderID", isAuthenticated, async (req: any, res) => {
    try {
      const { orderID } = req.params;
      
      const collect = {
        id: orderID,
        prefer: "return=minimal",
      };

      const { body, ...httpResponse } = await ordersController.captureOrder(collect);
      const jsonResponse = JSON.parse(String(body));
      
      res.status(httpResponse.statusCode).json(jsonResponse);
    } catch (error: any) {
      console.error("PayPal capture order error:", error);
      res.status(500).json({ error: error.message || "Failed to capture order" });
    }
  });

  // PayPal - Capture banner ad payment (public - no auth required)
  app.post("/api/paypal/capture-banner-ad/:orderID/:bannerAdOrderId", async (req, res) => {
    try {
      const { orderID, bannerAdOrderId } = req.params;
      
      // Capture the PayPal order
      const collect = {
        id: orderID,
        prefer: "return=minimal",
      };

      const { body, ...httpResponse } = await ordersController.captureOrder(collect);
      const jsonResponse = JSON.parse(String(body));
      
      // CRITICAL SECURITY: Verify the captured order matches the banner ad order
      if (jsonResponse.status === 'COMPLETED') {
        // Extract customId from purchase units
        const customId = jsonResponse.purchase_units?.[0]?.custom_id || '';
        
        // Parse customId format: "banner-ad:{orderId}|sponsor:{email}|promo:{code}"
        const orderIdMatch = customId.match(/banner-ad:([^|]+)/);
        const capturedOrderId = orderIdMatch ? orderIdMatch[1] : null;
        
        if (!capturedOrderId || capturedOrderId !== bannerAdOrderId) {
          console.error(`❌ Payment fraud attempt: PayPal order ${orderID} customId mismatch. Expected ${bannerAdOrderId}, got ${capturedOrderId}`);
          return res.status(400).json({ 
            error: "Payment validation failed",
            details: "Order ID mismatch - payment cannot be applied to this order" 
          });
        }
        
        // Extract promo code if present
        const promoMatch = customId.match(/promo:([^|]+)/);
        const promoCode = promoMatch ? promoMatch[1] : null;
        
        // Reload the banner ad order to verify it exists and is pending
        const order = await storage.getBannerAdOrder(bannerAdOrderId);
        if (!order) {
          console.error(`❌ Banner ad order ${bannerAdOrderId} not found during payment capture`);
          return res.status(404).json({ error: "Order not found" });
        }
        
        if (order.paymentStatus === 'paid') {
          console.warn(`⚠️ Banner ad order ${bannerAdOrderId} already marked as paid`);
          return res.status(400).json({ error: "Order already paid" });
        }
        
        // Record promo code usage if applied
        if (promoCode) {
          try {
            const promoCodeRecord = await storage.getPromoCodeByCode(promoCode);
            if (promoCodeRecord) {
              await storage.recordPromoCodeUsage({
                promoCodeId: promoCodeRecord.id,
                bannerAdOrderId: bannerAdOrderId,
              });
              logDebug(`✅ Promo code ${promoCode} usage recorded for banner ad order ${bannerAdOrderId}`);
            }
          } catch (error) {
            console.error(`⚠️ Failed to record promo code usage for ${promoCode}:`, error);
            // Don't fail the payment - just log the error
          }
        }
        
        // Update payment status
        await storage.updateBannerAdOrder(bannerAdOrderId, {
          paymentStatus: 'paid',
          paypalOrderId: orderID,
          paypalPaymentDate: new Date(),
        });
        
        logDebug(`✅ Banner ad order ${bannerAdOrderId} payment captured: ${orderID}`);
      }
      
      res.status(httpResponse.statusCode).json(jsonResponse);
    } catch (error: any) {
      console.error("PayPal capture banner ad order error:", error);
      res.status(500).json({ error: error.message || "Failed to capture order" });
    }
  });

  // Complete FREE banner ad order (100% promo discount - no PayPal payment required)
  // SECURITY: Requires cryptographically signed token to prevent unauthorized completion
  app.post("/api/banner-ad/complete-free-order/:bannerAdOrderId", async (req, res) => {
    try {
      const { bannerAdOrderId } = req.params;
      const { completionToken } = req.body;
      
      // SECURITY: Validate completion token is provided
      if (!completionToken || typeof completionToken !== 'string') {
        console.error(`❌ Missing completion token for order ${bannerAdOrderId}`);
        return res.status(400).json({ error: "Security token is required" });
      }
      
      // SECURITY: Verify and decode the signed token
      let tokenData: any;
      try {
        tokenData = jwt.verify(completionToken, process.env.SESSION_SECRET || 'dev-secret');
      } catch (error: any) {
        console.error(`❌ Invalid or expired token for order ${bannerAdOrderId}:`, error.message);
        return res.status(403).json({ error: "Invalid or expired security token" });
      }
      
      // SECURITY: Verify token is for this specific order
      if (tokenData.orderId !== bannerAdOrderId) {
        console.error(`❌ Token/order ID mismatch for ${bannerAdOrderId}. Token says: ${tokenData.orderId}`);
        return res.status(403).json({ error: "Invalid security token" });
      }
      
      // SECURITY: Verify token type is for free order completion
      if (tokenData.type !== 'free-order-completion') {
        console.error(`❌ Wrong token type for order ${bannerAdOrderId}: ${tokenData.type}`);
        return res.status(403).json({ error: "Invalid security token" });
      }
      
      // Load the banner ad order
      const order = await storage.getBannerAdOrder(bannerAdOrderId);
      if (!order) {
        console.error(`❌ Banner ad order ${bannerAdOrderId} not found`);
        return res.status(404).json({ error: "Order not found" });
      }
      
      // SECURITY: Verify sponsor email from token matches order (belt-and-suspenders)
      if (order.sponsorEmail.toLowerCase() !== tokenData.sponsorEmail.toLowerCase()) {
        console.error(`❌ Token email mismatch for order ${bannerAdOrderId}. Expected ${order.sponsorEmail}, token says ${tokenData.sponsorEmail}`);
        return res.status(403).json({ error: "Invalid security token" });
      }
      
      // Verify order hasn't been paid yet
      if (order.paymentStatus === 'paid') {
        console.warn(`⚠️ Banner ad order ${bannerAdOrderId} already marked as paid`);
        return res.status(400).json({ error: "Order already paid" });
      }
      
      // Calculate final amount (must be $0 for free orders)
      const originalAmount = parseFloat(order.grandTotal);
      const discountAmount = parseFloat(order.discountAmount || "0");
      const finalAmount = Math.max(0, originalAmount - discountAmount);
      
      // CRITICAL: Verify this is actually a free order
      if (finalAmount > 0) {
        console.error(`❌ Free order validation failed for ${bannerAdOrderId}: final amount is $${finalAmount.toFixed(2)}, not $0.00`);
        return res.status(400).json({ 
          error: "This is not a free order",
          details: `Order total is $${finalAmount.toFixed(2)}. Payment is required.`
        });
      }
      
      // SECURITY: Re-validate promo code is still active and valid
      if (order.promoCode) {
        const validPromo = await storage.validatePromoCodeForContext(order.promoCode, 'banner-ad');
        if (!validPromo) {
          console.error(`❌ Promo code ${order.promoCode} is no longer valid for order ${bannerAdOrderId}`);
          return res.status(400).json({ 
            error: "Promo code is no longer valid",
            details: "Please refresh the page and try again"
          });
        }
        
        // Record promo code usage
        try {
          const promoCodeRecord = await storage.getPromoCodeByCode(order.promoCode);
          if (promoCodeRecord) {
            await storage.recordPromoCodeUsage({
              promoCodeId: promoCodeRecord.id,
              bannerAdOrderId: bannerAdOrderId,
            });
            logDebug(`✅ Promo code ${order.promoCode} usage recorded for FREE banner ad order ${bannerAdOrderId}`);
          }
        } catch (error) {
          console.error(`⚠️ Failed to record promo code usage for ${order.promoCode}:`, error);
          // Don't fail the order completion - just log the error
        }
      }
      
      // Mark order as paid (even though $0) and set to pending review
      await storage.updateBannerAdOrder(bannerAdOrderId, {
        paymentStatus: 'paid',
        approvalStatus: 'pending_review',
        paypalOrderId: 'FREE-' + bannerAdOrderId, // Mark as free order
        paypalPaymentDate: new Date(),
      });
      
      logDebug(`✅ FREE banner ad order ${bannerAdOrderId} completed with promo code ${order.promoCode} by ${order.sponsorEmail}`);
      
      res.json({ 
        status: 'COMPLETED',
        message: 'Free order completed successfully',
        orderId: bannerAdOrderId
      });
    } catch (error: any) {
      console.error("Free banner ad order completion error:", error);
      res.status(500).json({ error: error.message || "Failed to complete free order" });
    }
  });

  // Complete marketplace listing creation after PayPal payment
  app.post("/api/marketplace/complete-create", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { orderId, listingData } = req.body;

      if (!orderId || !listingData) {
        return res.status(400).json({ error: "orderId and listingData are required" });
      }

      const {
        userId: _ignoredUserId,
        isPaid: _ignoredPaid,
        expiresAt: _ignoredExpires,
        monthlyFee: _ignoredMonthlyFee,
        paymentIntentId: _ignoredPaymentIntentId,
        promoCodeUsed,
        promoCode,
        discountAmount,
        originalAmount,
        finalAmount,
        ...safeListingData
      } = listingData;

      const category = safeListingData.category;
      const tier = safeListingData.tier || "basic";
      if (!category) {
        return res.status(400).json({ error: "Listing category is required" });
      }

      const user = await storage.getUser(userId);
      const feeBreakdown = buildMarketplaceListingFeeBreakdown({ category, tier, user });
      if (!feeBreakdown.isTraditionalMarketplace) {
        return res.status(400).json({ error: "Unsupported listing category" });
      }

      const fullAmount = feeBreakdown.totalDue;
      let expectedAmount = fullAmount;
      let validatedPromo: any = null;

      const promoToApply = (promoCode || promoCodeUsed || "").toString().trim();
      if (promoToApply) {
        validatedPromo = await storage.validatePromoCodeForContext(promoToApply, 'marketplace');
        if (!validatedPromo) {
          return res.status(400).json({ error: "Invalid or expired promo code" });
        }

        let serverCalculatedDiscount = 0;
        if (validatedPromo.discountType === 'percentage') {
          const discountPercent = parseFloat(validatedPromo.discountValue || "0");
          serverCalculatedDiscount = (fullAmount * discountPercent) / 100;
        } else if (validatedPromo.discountType === 'fixed' || validatedPromo.discountType === 'fixed_amount') {
          serverCalculatedDiscount = parseFloat(validatedPromo.discountValue || "0");
        } else if (validatedPromo.discountType === 'free_7_day' || validatedPromo.discountType === 'waive_creation_fee') {
          serverCalculatedDiscount = fullAmount;
        }

        serverCalculatedDiscount = Math.min(serverCalculatedDiscount, fullAmount);
        expectedAmount = Math.max(0, fullAmount - serverCalculatedDiscount);
      }

      if (expectedAmount <= 0) {
        return res.status(400).json({ error: "Use free completion endpoint for $0 orders" });
      }

      // Verify PayPal order
      let orderData: any;
      try {
        orderData = await getPayPalOrder(orderId);
      } catch (paypalError: any) {
        console.error("PayPal order verification error:", paypalError);
        return res.status(400).json({ error: "Failed to verify payment" });
      }

      if (orderData.status !== 'COMPLETED') {
        return res.status(400).json({ error: "Payment not completed" });
      }

      const customId = orderData.purchase_units?.[0]?.custom_id || orderData.purchase_units?.[0]?.customId || "";
      const customData = parsePayPalCustomId(customId);
      if (customData.user !== userId || customData.purpose !== "marketplace_listing_fee") {
        return res.status(400).json({ error: "Payment order mismatch" });
      }
      if (customData.category && customData.category !== category) {
        return res.status(400).json({ error: "Listing category does not match payment" });
      }
      if (customData.tier && customData.tier !== tier) {
        return res.status(400).json({ error: "Listing tier does not match payment" });
      }

      const orderAmount = extractPayPalOrderAmount(orderData);
      if (!orderAmount) {
        return res.status(400).json({ error: "Payment amount not found" });
      }

      if (orderAmount.currency !== "USD") {
        return res.status(400).json({ error: "Unsupported payment currency" });
      }

      const expectedCents = toCents(expectedAmount);
      const orderCents = toCents(orderAmount.value);
      if (!expectedCents || !orderCents || expectedCents !== orderCents) {
        return res.status(400).json({ error: "Payment amount mismatch" });
      }

      // Validate the base listing data
      const validatedData = insertMarketplaceListingSchema.parse({
        ...safeListingData,
        userId,
        monthlyFee: feeBreakdown.finalListingFee.toFixed(2),
      });

      const listing = await storage.createMarketplaceListing({
        ...validatedData,
        isPaid: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const consumption = await storage.consumePayPalOrder({
        orderId,
        userId,
        purpose: "marketplace_listing_fee",
        resourceType: "listing",
        resourceId: listing.id,
        amount: orderAmount.value,
        currency: orderAmount.currency,
      });

        if (!consumption) {
          await storage.deleteMarketplaceListing(listing.id);
          return res.status(400).json({ error: "This payment has already been processed" });
        }

        // Record marketplace listing fee transaction (admin analytics)
        try {
          await storage.createTransaction({
            userId,
            type: "marketplace_listing_fee",
            amount: orderAmount.value,
            marketplaceListingId: listing.id,
            status: "completed",
            description: `Marketplace listing fee (${category}, ${tier}) (PayPal ${orderId})`,
            rentalId: null,
            depositedToBankAt: null,
          });
        } catch (error) {
          console.error("Failed to record listing fee transaction:", error);
        }

        // Record promo code usage if applied
        if (validatedPromo) {
        try {
          await storage.recordPromoCodeUsage({
            promoCodeId: validatedPromo.id,
            userId: userId,
            marketplaceListingId: listing.id,
          });
          logDebug(`✅ Promo code ${validatedPromo.code} usage recorded for marketplace listing ${listing.id}`);
        } catch (error) {
          console.error(`⚠️ Failed to record promo code usage for ${validatedPromo.code}:`, error);
        }
      }

      // Check listing threshold and create notification if needed
      try {
        const categoryListings = await storage.getMarketplaceListingsByCategory(listing.category);
        const activeCount = categoryListings.filter((l: any) => l.isActive).length;
        
        if (activeCount === 25 || activeCount === 30) {
          await storage.createAdminNotification({
            type: "listing_threshold",
            category: listing.category,
            title: `${listing.category.replace('-', ' ').toUpperCase()} Listings Threshold Reached`,
            message: `The ${listing.category.replace('-', ' ')} category now has ${activeCount} active listings.`,
            isRead: false,
            isActionable: true,
            listingCount: activeCount,
            threshold: activeCount,
          });
        }
      } catch (notifError) {
        console.error("Failed to create threshold notification:", notifError);
      }

      if (feeBreakdown.membershipDiscountPct > 0) {
        logDebug(
          `Marketplace listing discount applied: ${category} ${tier} ` +
            `tier=${feeBreakdown.membershipTierApplied} pct=${feeBreakdown.membershipDiscountPct}`
        );
      }

      res.status(201).json({
        listing,
        feeBreakdown,
      });
    } catch (error: any) {
      console.error("Marketplace listing completion error:", error);
      res.status(400).json({ error: error.message || "Failed to complete listing creation" });
    }
  });

  // Complete FREE marketplace listing (100% promo discount - no PayPal payment required)
  // SECURITY: Requires cryptographically signed token to prevent unauthorized completion
  app.post("/api/marketplace/complete-free-listing", isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.user.claims.sub;
      const { completionToken, listingData } = req.body;
      
      // SECURITY: Validate completion token is provided
      if (!completionToken || typeof completionToken !== 'string') {
        console.error(`❌ Missing completion token for free marketplace listing`);
        return res.status(400).json({ error: "Security token is required" });
      }
      
      // SECURITY: Verify and decode the signed token
      let tokenData: any;
      try {
        tokenData = jwt.verify(completionToken, process.env.SESSION_SECRET || 'dev-secret');
      } catch (error: any) {
        console.error(`❌ Invalid or expired token for free marketplace listing:`, error.message);
        return res.status(403).json({ error: "Invalid or expired security token" });
      }
      
      const tokenUserId = tokenData.userId ? String(tokenData.userId) : null;
      // SECURITY: Verify user ID from token matches authenticated user (except admin free tokens)
      if (tokenData.type !== "admin-free-marketplace-listing") {
        if (!tokenUserId || tokenUserId !== requesterId) {
          console.error(`❌ Token user ID mismatch. Expected ${requesterId}, token says ${tokenData.userId}`);
          return res.status(403).json({ error: "Invalid security token" });
        }
      }

      // Calculate final amount (must be $0 for free orders)
      const originalAmount = parseFloat(tokenData.originalAmount);
      const discountAmount = parseFloat(tokenData.discountAmount);
      const finalAmount = Math.max(0, originalAmount - discountAmount);

      if (finalAmount > 0) {
        console.error(`❌ Free listing validation failed: final amount is $${finalAmount.toFixed(2)}, not $0.00`);
        return res.status(400).json({ 
          error: "This is not a free listing",
          details: `Listing total is $${finalAmount.toFixed(2)}. Payment is required.`
        });
      }

      // Branch by token type
      if (tokenData.type === 'free-marketplace-listing') {
        // SECURITY: Re-validate promo code is still active and valid
        if (tokenData.promoCode) {
          const validPromo = await storage.validatePromoCodeForContext(tokenData.promoCode, 'marketplace');
          if (!validPromo) {
            console.error(`❌ Promo code ${tokenData.promoCode} is no longer valid for marketplace listing`);
            return res.status(400).json({ 
              error: "Promo code is no longer valid",
              details: "Please refresh the page and try again"
            });
          }
          
          // Validate the base listing data
          const validatedData = insertMarketplaceListingSchema.parse({ 
            ...listingData, 
            userId: requesterId,
            monthlyFee: "0",
          });
          
          // Create listing with free promo benefits
          const listing = await storage.createMarketplaceListing({
            ...validatedData,
            isPaid: true, // Mark as paid since it's free with promo
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          });
          
          // Record promo code usage
          try {
            await storage.recordPromoCodeUsage({
              promoCodeId: tokenData.promoCode,
              userId: requesterId,
              marketplaceListingId: listing.id,
            });
            logDebug(`✅ Promo code ${tokenData.promoCode} usage recorded for FREE marketplace listing ${listing.id}`);
          } catch (error) {
            console.error(`⚠️ Failed to record promo code usage for ${tokenData.promoCode}:`, error);
            // Don't fail the listing creation - just log the error
          }
          
          // Create threshold notification if needed
          try {
            const categoryListings = await storage.getMarketplaceListingsByCategory(listing.category);
            const activeCount = categoryListings.filter((l: any) => l.isActive).length;
            
            if (activeCount === 25 || activeCount === 30) {
              await storage.createAdminNotification({
                type: "listing_threshold",
                category: listing.category,
                title: `${listing.category.replace('-', ' ').toUpperCase()} Listings Threshold Reached`,
                message: `The ${listing.category.replace('-', ' ')} category now has ${activeCount} active listings.`,
                isRead: false,
                isActionable: true,
                listingCount: activeCount,
                threshold: activeCount,
              });
            }
          } catch (notifError) {
            console.error("Failed to create threshold notification:", notifError);
          }
          
          logDebug(`✅ FREE marketplace listing ${listing.id} completed with promo code ${tokenData.promoCode} by user ${requesterId}`);
          
          const feeBreakdown = buildMarketplaceListingFeeBreakdown({
            category: listing.category,
            tier: listing.tier || "basic",
            user: await storage.getUser(requesterId),
          });

          return res.status(201).json({ 
            status: 'COMPLETED',
            message: 'Free listing created successfully',
            listing,
            feeBreakdown,
          });
        } else {
          return res.status(400).json({ error: "No promo code provided for free listing" });
        }
      }

      if (tokenData.type === 'admin-free-marketplace-listing') {
        const requester = await storage.getUser(requesterId);
        if (!requester || (!requester.isAdmin && !requester.isSuperAdmin)) {
          console.error(`❌ Non-admin user ${requesterId} attempted to use admin free listing token`);
          return res.status(403).json({ error: "Admin access required" });
        }

        const durationDays = Math.min(Math.max(Number(tokenData.durationDays) || 30, 1), 90);
        const targetUserId = tokenUserId || requesterId;
        const validatedData = insertMarketplaceListingSchema.parse({ 
          ...listingData, 
          userId: targetUserId,
          monthlyFee: "0",
        });
        
        const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
        const listing = await storage.createMarketplaceListing({
          ...validatedData,
          isPaid: true,
          monthlyFee: "0",
          expiresAt,
          promoFreeUntil: expiresAt,
          promoGrantedBy: tokenData.issuedBy || requesterId,
          promoGrantedAt: new Date(),
          adminNotes: `Admin free listing grant (${durationDays}d) by ${tokenData.issuedBy || 'admin'}`,
        });

        const feeBreakdown = buildMarketplaceListingFeeBreakdown({
          category: listing.category,
          tier: listing.tier || "basic",
          user: await storage.getUser(targetUserId),
        });

        logDebug(`✅ Admin free marketplace listing ${listing.id} created for user ${targetUserId} by ${tokenData.issuedBy || 'admin'}`);

        return res.status(201).json({
          status: 'COMPLETED',
          message: 'Admin free listing created successfully',
          listing,
          feeBreakdown,
        });
      }

      console.error(`❌ Wrong token type for free marketplace listing: ${tokenData.type}`);
      return res.status(403).json({ error: "Invalid security token" });
    } catch (error: any) {
      console.error("Free marketplace listing completion error:", error);
      res.status(500).json({ error: error.message || "Failed to complete free listing" });
    }
  });

  // Mobile PayPal Payment Page - Rental Payments
  app.get("/mobile-paypal-rental-payment", async (req, res) => {
    const { rentalId } = req.query;
    if (!rentalId) {
      return res.status(400).send("Rental ID is required");
    }
    const rental = await storage.getRental(String(rentalId));
    if (!rental) {
      return res.status(404).send("Rental not found");
    }
    const amountValue = Number.parseFloat(rental.totalCostRenter || "0");
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return res.status(400).send("Invalid rental amount");
    }
    const amountDisplay = amountValue.toFixed(2);
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #f9fafb; }
    .container { max-width: 500px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 24px; color: #111827; margin-bottom: 8px; }
    .header p { color: #6b7280; font-size: 14px; }
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 16px; }
    .amount { text-align: center; font-size: 36px; font-weight: bold; color: #1e40af; margin-bottom: 24px; }
    .field { margin-bottom: 16px; }
    .field label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #374151; }
    .field-container { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; min-height: 44px; background: #fff; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .btn { width: 100%; padding: 14px; background: #1e40af; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
    .btn:disabled { background: #9ca3af; cursor: not-allowed; }
    .loading { text-align: center; color: #6b7280; padding: 20px; }
    .error { color: #dc2626; background: #fee2e2; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
  </style>
  <script src="https://www.paypal.com/sdk/js?client-id=${process.env.PAYPAL_CLIENT_ID}&components=card-fields&disable-funding=paylater"></script>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Complete Payment</h1>
      <p>Secure payment powered by PayPal Business/Commerce, a trusted global payments platform</p>
    </div>
    
    <div class="card">
      <div class="amount">$${amountDisplay}</div>
      
      <div id="error-message"></div>
      
      <div class="field">
        <label>Cardholder Name</label>
        <div id="card-name-field" class="field-container"></div>
      </div>
      
      <div class="field">
        <label>Card Number</label>
        <div id="card-number-field" class="field-container"></div>
      </div>
      
      <div class="field-row">
        <div class="field">
          <label>Expiry Date</label>
          <div id="card-expiry-field" class="field-container"></div>
        </div>
        <div class="field">
          <label>CVV</label>
          <div id="card-cvv-field" class="field-container"></div>
        </div>
      </div>
      
      <button id="pay-button" class="btn" disabled>Loading...</button>
    </div>
  </div>

  <script>
    const button = document.getElementById('pay-button');
    const errorDiv = document.getElementById('error-message');
    
    const cardFields = paypal.CardFields({
      createOrder: async () => {
        const response = await fetch('/api/paypal/create-order-rental', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            rentalId: '${rentalId}'
          })
        });
        const order = await response.json();
        return order.id;
      },
      onApprove: async (data) => {
        button.disabled = true;
        button.textContent = 'Processing...';
        
        try {
          const response = await fetch('/api/paypal/capture-order/' + data.orderID, {
            method: 'POST',
            credentials: 'include'
          });
          const result = await response.json();
          
          if (result.status === 'COMPLETED') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PAYMENT_SUCCESS',
              orderID: data.orderID
            }));
          } else {
            throw new Error('Payment not completed');
          }
        } catch (error) {
          errorDiv.innerHTML = '<div class="error">Payment failed. Please try again.</div>';
          button.disabled = false;
          button.textContent = 'Pay $${amountDisplay}';
        }
      },
      onError: (error) => {
        console.error('PayPal error:', error);
        errorDiv.innerHTML = '<div class="error">Payment error. Please check your card details.</div>';
      }
    });

    if (cardFields.isEligible()) {
      cardFields.NameField().render('#card-name-field');
      cardFields.NumberField().render('#card-number-field');
      cardFields.ExpiryField().render('#card-expiry-field');
      cardFields.CVVField().render('#card-cvv-field');
      
      button.disabled = false;
      button.textContent = 'Pay $${amountDisplay}';
      
      button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = 'Processing...';
        await cardFields.submit();
      });
    } else {
      errorDiv.innerHTML = '<div class="error">Card payments are not available.</div>';
    }
  </script>
</body>
</html>
    `);
  });

  // Mobile PayPal Payment Page - Marketplace Listings
  app.get("/mobile-paypal-marketplace-payment", (req, res) => {
    const { category, tier } = req.query;
    if (!category) {
      return res.status(400).send("Category is required");
    }
    const amountValue = calculateTotalWithTax(getBasePrice(String(category), String(tier || 'basic')));
    const amountDisplay = amountValue.toFixed(2);
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #f9fafb; }
    .container { max-width: 500px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 24px; color: #111827; margin-bottom: 8px; }
    .header p { color: #6b7280; font-size: 14px; }
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 16px; }
    .amount { text-align: center; font-size: 36px; font-weight: bold; color: #1e40af; margin-bottom: 24px; }
    .field { margin-bottom: 16px; }
    .field label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #374151; }
    .field-container { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; min-height: 44px; background: #fff; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .btn { width: 100%; padding: 14px; background: #1e40af; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
    .btn:disabled { background: #9ca3af; cursor: not-allowed; }
    .loading { text-align: center; color: #6b7280; padding: 20px; }
    .error { color: #dc2626; background: #fee2e2; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
  </style>
  <script src="https://www.paypal.com/sdk/js?client-id=${process.env.PAYPAL_CLIENT_ID}&components=card-fields&disable-funding=paylater"></script>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Complete Payment</h1>
      <p>Secure payment powered by PayPal Business/Commerce, a trusted global payments platform</p>
    </div>
    
    <div class="card">
      <div class="amount">$${amountDisplay}</div>
      
      <div id="error-message"></div>
      
      <div class="field">
        <label>Cardholder Name</label>
        <div id="card-name-field" class="field-container"></div>
      </div>
      
      <div class="field">
        <label>Card Number</label>
        <div id="card-number-field" class="field-container"></div>
      </div>
      
      <div class="field-row">
        <div class="field">
          <label>Expiry Date</label>
          <div id="card-expiry-field" class="field-container"></div>
        </div>
        <div class="field">
          <label>CVV</label>
          <div id="card-cvv-field" class="field-container"></div>
        </div>
      </div>
      
      <button id="pay-button" class="btn" disabled>Loading...</button>
    </div>
  </div>

  <script>
    const button = document.getElementById('pay-button');
    const errorDiv = document.getElementById('error-message');
    
    const cardFields = paypal.CardFields({
      createOrder: async () => {
        const response = await fetch('/api/paypal/create-order-listing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            category: '${category}',
            tier: '${tier}'
          })
        });
        const order = await response.json();
        return order.id;
      },
      onApprove: async (data) => {
        button.disabled = true;
        button.textContent = 'Processing...';
        
        try {
          const response = await fetch('/api/paypal/capture-order/' + data.orderID, {
            method: 'POST',
            credentials: 'include'
          });
          const result = await response.json();
          
          if (result.status === 'COMPLETED') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PAYMENT_SUCCESS',
              orderID: data.orderID
            }));
          } else {
            throw new Error('Payment not completed');
          }
        } catch (error) {
          errorDiv.innerHTML = '<div class="error">Payment failed. Please try again.</div>';
          button.disabled = false;
          button.textContent = 'Pay $${amountDisplay}';
        }
      },
      onError: (error) => {
        console.error('PayPal error:', error);
        errorDiv.innerHTML = '<div class="error">Payment error. Please check your card details.</div>';
      }
    });

    if (cardFields.isEligible()) {
      cardFields.NameField().render('#card-name-field');
      cardFields.NumberField().render('#card-number-field');
      cardFields.ExpiryField().render('#card-expiry-field');
      cardFields.CVVField().render('#card-cvv-field');
      
      button.disabled = false;
      button.textContent = 'Pay $${amountDisplay}';
      
      button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = 'Processing...';
        await cardFields.submit();
      });
    } else {
      errorDiv.innerHTML = '<div class="error">Card payments are not available.</div>';
    }
  </script>
</body>
</html>
    `);
  });

  // Banner Ad Payment Page - Public (no auth required)
  app.get("/banner-ad-payment", async (req, res) => {
    const { orderId } = req.query;
    
    if (!orderId) {
      return res.status(400).send("Order ID is required");
    }
    
    // Load order to get amount and details
    const order = await storage.getBannerAdOrder(orderId as string);
    if (!order) {
      return res.status(404).send("Order not found");
    }
    
    const amount = order.grandTotal;
    const title = order.title;
    const sponsorEmail = order.sponsorEmail;
    
    // Calculate final amount after discount
    const originalAmount = parseFloat(order.grandTotal);
    const discountAmount = parseFloat(order.discountAmount || "0");
    const finalAmount = Math.max(0, originalAmount - discountAmount);
    const isFreeOrder = finalAmount === 0;
    
    // Generate signed completion token for free orders
    let completionToken = null;
    if (isFreeOrder) {
      completionToken = jwt.sign(
        {
          type: 'free-order-completion',
          orderId: orderId,
          sponsorEmail: sponsorEmail,
        },
        process.env.SESSION_SECRET || 'dev-secret',
        { expiresIn: '15m' } // Token expires in 15 minutes
      );
      logDebug(`Generated free order completion token for ${orderId}`);
    }
    
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Banner Ad Payment - Ready Set Fly</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #f9fafb; }
    .container { max-width: 500px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 24px; color: #111827; margin-bottom: 8px; }
    .header p { color: #6b7280; font-size: 14px; }
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 16px; }
    .order-info { background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
    .order-info h3 { font-size: 14px; color: #6b7280; margin-bottom: 6px; }
    .order-info p { font-size: 16px; color: #111827; font-weight: 500; }
    .amount { text-align: center; font-size: 36px; font-weight: bold; color: #1e40af; margin-bottom: 24px; }
    .field { margin-bottom: 16px; }
    .field label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #374151; }
    .field-container { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; min-height: 44px; background: #fff; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .btn { width: 100%; padding: 14px; background: #1e40af; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
    .btn:disabled { background: #9ca3af; cursor: not-allowed; }
    .btn-secondary { background: #6b7280; }
    .btn-secondary:hover { background: #4b5563; }
    .success { background: #d1fae5; color: #047857; padding: 16px; border-radius: 8px; margin-bottom: 16px; text-align: center; }
    .info { background: #dbeafe; color: #1e40af; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
    .error { color: #dc2626; background: #fee2e2; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
    .promo-section { margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb; }
    .promo-input-group { display: flex; gap: 8px; margin-bottom: 8px; }
    .promo-input { flex: 1; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
    .promo-btn { padding: 12px 20px; background: #6b7280; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .promo-btn:hover { background: #4b5563; }
    .promo-btn:disabled { background: #9ca3af; cursor: not-allowed; }
    .discount-info { background: #d1fae5; color: #047857; padding: 12px; border-radius: 8px; font-size: 14px; margin-top: 8px; }
    .amount-breakdown { font-size: 14px; color: #6b7280; margin-top: 8px; }
    .amount-breakdown .line { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .amount-breakdown .total { font-weight: bold; color: #111827; padding-top: 8px; border-top: 1px solid #e5e7eb; margin-top: 8px; }
  </style>
  <script src="https://www.paypal.com/sdk/js?client-id=${process.env.PAYPAL_CLIENT_ID}&components=card-fields&disable-funding=paylater"></script>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Complete Payment</h1>
      <p>Secure payment powered by PayPal Business/Commerce, a trusted global payments platform</p>
    </div>
    
    <div class="card">
      <div class="order-info">
        <h3>Banner Ad Campaign</h3>
        <p>${title}</p>
      </div>
      
      <div class="promo-section">
        <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px; color: #374151;">Have a promo code?</label>
        <div class="promo-input-group">
          <input 
            type="text" 
            id="promo-code-input" 
            class="promo-input" 
            placeholder="Enter promo code"
            style="text-transform: uppercase;"
          />
          <button id="apply-promo-btn" class="promo-btn">Apply</button>
        </div>
        <div id="promo-message"></div>
      </div>
      
      <div id="amount-display">
        <div class="amount">$${amount}</div>
      </div>
      
      <div id="success-message"></div>
      <div id="error-message"></div>
      
      <div id="payment-fields">
        <div class="field">
          <label>Cardholder Name</label>
          <div id="card-name-field" class="field-container"></div>
        </div>
        
        <div class="field">
          <label>Card Number</label>
          <div id="card-number-field" class="field-container"></div>
        </div>
        
        <div class="field-row">
          <div class="field">
            <label>Expiry Date</label>
            <div id="card-expiry-field" class="field-container"></div>
          </div>
          <div class="field">
            <label>CVV</label>
            <div id="card-cvv-field" class="field-container"></div>
          </div>
        </div>
        
        <button id="pay-button" class="btn" disabled>Loading...</button>
      </div>
    </div>
  </div>

  <script>
    const button = document.getElementById('pay-button');
    const errorDiv = document.getElementById('error-message');
    const successDiv = document.getElementById('success-message');
    const paymentFields = document.getElementById('payment-fields');
    const promoInput = document.getElementById('promo-code-input');
    const applyPromoBtn = document.getElementById('apply-promo-btn');
    const promoMessage = document.getElementById('promo-message');
    const amountDisplay = document.getElementById('amount-display');
    
    // Pricing state
    let originalAmount = ${amount};
    let currentAmount = ${amount};
    let appliedPromoCode = null;
    
    // Free order state
    const isFreeOrder = ${isFreeOrder};
    const finalAmount = ${finalAmount};
    const completionToken = '${completionToken || ''}';
    
    // Payment processing state management (30-second timeout)
    let processingTimeout = null;
    
    function startProcessing() {
      button.disabled = true;
      button.textContent = 'Processing...';
      errorDiv.innerHTML = '';
      
      // Set 30-second timeout
      processingTimeout = setTimeout(() => {
        resetProcessing('Payment timed out after 30 seconds. Please try again or contact support@readysetfly.us');
      }, 30000);
    }
    
    function resetProcessing(errorMessage = null) {
      if (processingTimeout) {
        clearTimeout(processingTimeout);
        processingTimeout = null;
      }
      button.disabled = false;
      button.textContent = 'Pay $' + currentAmount.toFixed(2);
      
      if (errorMessage) {
        errorDiv.innerHTML = '<div class="error">' + errorMessage + '</div>';
      }
    }
    
    // Promo code validation
    applyPromoBtn.addEventListener('click', async () => {
      const code = promoInput.value.trim().toUpperCase();
      if (!code) {
        promoMessage.innerHTML = '<div class="error">Please enter a promo code</div>';
        return;
      }
      
      applyPromoBtn.disabled = true;
      applyPromoBtn.textContent = 'Validating...';
      promoMessage.innerHTML = '';
      
      try {
        const response = await fetch('/api/promo-codes/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, context: 'banner-ad' })
        });
        const result = await response.json();
        
        if (result.valid) {
          appliedPromoCode = result;
          
          // Calculate discount
          let discount = 0;
          if (result.discountType === 'percentage') {
            discount = originalAmount * (result.discountValue / 100);
          } else if (result.discountType === 'fixed') {
            discount = result.discountValue;
          }
          
          currentAmount = Math.max(0, originalAmount - discount);
          
          // Update display with breakdown
          amountDisplay.innerHTML = \`
            <div class="amount-breakdown">
              <div class="line">
                <span>Subtotal:</span>
                <span>$\${originalAmount.toFixed(2)}</span>
              </div>
              <div class="line" style="color: #047857;">
                <span>Discount (\${result.code}):</span>
                <span>-$\${discount.toFixed(2)}</span>
              </div>
              <div class="line total">
                <span>Total:</span>
                <span style="font-size: 24px; color: #1e40af;">$\${currentAmount.toFixed(2)}</span>
              </div>
            </div>
          \`;
          
          promoMessage.innerHTML = \`<div class="discount-info">\${result.description}</div>\`;
          promoInput.disabled = true;
          applyPromoBtn.textContent = 'Applied';
          
          // Update button text with new amount
          if (button.textContent.includes('Pay')) {
            button.textContent = 'Pay $' + currentAmount.toFixed(2);
          }
        } else {
          promoMessage.innerHTML = \`<div class="error">\${result.message || 'Invalid promo code'}</div>\`;
          applyPromoBtn.disabled = false;
          applyPromoBtn.textContent = 'Apply';
        }
      } catch (error) {
        console.error('Promo code validation error:', error);
        promoMessage.innerHTML = '<div class="error">Failed to validate promo code</div>';
        applyPromoBtn.disabled = false;
        applyPromoBtn.textContent = 'Apply';
      }
    });
    
    // Handle FREE orders differently (no PayPal payment required)
    if (isFreeOrder) {
      // Show claim button instead of card fields
      paymentFields.innerHTML = \`
        <div class="info">Your total is $0.00 after applying the promo code!</div>
        <button id="claim-button" class="btn" data-testid="button-claim-free-order">Claim Free Banner Ad</button>
      \`;
      
      // Add click handler for free order claim
      const claimButton = document.getElementById('claim-button');
      claimButton.addEventListener('click', async () => {
        startProcessing();
        claimButton.textContent = 'Processing...';
        
        try {
          const response = await fetch('/api/banner-ad/complete-free-order/${orderId}', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completionToken })
          });
          
          const result = await response.json();
          
          if (response.ok) {
            // Clear timeout - success
            if (processingTimeout) {
              clearTimeout(processingTimeout);
              processingTimeout = null;
            }
            
            paymentFields.style.display = 'none';
            successDiv.innerHTML = '<div class="success"><h3>Order Claimed Successfully!</h3><p>Your free banner ad order has been confirmed. It will be reviewed and activated within 1 business day. We will contact you at ${sponsorEmail}.</p></div>';
            
            setTimeout(() => {
              window.location.href = '/';
            }, 5000);
          } else {
            resetProcessing(result.error || 'Failed to claim free order. Please contact support@readysetfly.us');
          }
        } catch (error) {
          console.error('Free order claim error:', error);
          resetProcessing('Failed to claim free order. Please try again or contact support@readysetfly.us');
        }
      });
    } else {
      // Standard PayPal payment flow for non-free orders
      const cardFields = paypal.CardFields({
        createOrder: async () => {
          const requestBody = {
            orderId: '${orderId}'
          };
          
          // Include promo code if applied
          if (appliedPromoCode) {
            requestBody.promoCode = appliedPromoCode.code;
          }
          
          const response = await fetch('/api/paypal/create-order-banner-ad', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });
          const order = await response.json();
          
          // Check if backend says this is now a free order (100% discount applied)
          if (order.useFreeCompletion) {
            // Clear timeout
            if (processingTimeout) {
              clearTimeout(processingTimeout);
              processingTimeout = null;
            }
            
            // Complete the free order immediately
            const completeResponse = await fetch('/api/banner-ad/complete-free-order/${orderId}', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ 
                completionToken: order.completionToken 
              })
            });
            
            const result = await completeResponse.json();
            
            if (completeResponse.ok) {
              paymentFields.style.display = 'none';
              successDiv.innerHTML = '<div class="success"><h3>Order Claimed Successfully!</h3><p>Your free banner ad order has been confirmed. It will be reviewed and activated within 1 business day. We will contact you at ${sponsorEmail}.</p></div>';
              
              setTimeout(() => {
                window.location.href = '/';
              }, 5000);
              
              // Throw to stop PayPal flow
              throw new Error('FREE_ORDER_COMPLETED');
            } else {
              throw new Error(result.error || 'Failed to complete free order');
            }
          }
          
          if (!order.id) {
            throw new Error(order.error || 'Failed to create payment');
          }
          return order.id;
        },
        onApprove: async (data) => {
          // Clear timeout - payment approved
          if (processingTimeout) {
            clearTimeout(processingTimeout);
            processingTimeout = null;
          }
          
          button.disabled = true;
          button.textContent = 'Processing...';
          
          try {
            // Capture the payment
            const response = await fetch('/api/paypal/capture-banner-ad/' + data.orderID + '/${orderId}', {
              method: 'POST'
            });
            const result = await response.json();
            
            if (result.status === 'COMPLETED') {
              paymentFields.style.display = 'none';
              successDiv.innerHTML = '<div class="success"><h3>Payment Successful!</h3><p>Thank you for your payment. Your banner ad order will be reviewed and activated within 1 business day. We will contact you at ${sponsorEmail}.</p></div>';
              
              setTimeout(() => {
                window.location.href = '/';
              }, 5000);
            } else {
              throw new Error('Payment not completed');
            }
          } catch (error) {
            console.error('Payment capture error:', error);
            resetProcessing('Payment capture failed. Please contact support@readysetfly.us with order ID: ${orderId}');
          }
        },
        onError: (error) => {
          console.error('PayPal error:', error);
          resetProcessing('Payment error. Please check your card details and try again.');
        }
      });

      if (cardFields.isEligible()) {
        cardFields.NameField().render('#card-name-field');
        cardFields.NumberField().render('#card-number-field');
        cardFields.ExpiryField().render('#card-expiry-field');
        cardFields.CVVField().render('#card-cvv-field');
        
        button.disabled = false;
          button.textContent = 'Pay $' + currentAmount.toFixed(2);
        
        button.addEventListener('click', async () => {
          startProcessing();
          
          try {
            await cardFields.submit();
          } catch (error) {
            console.error('Card field submission error:', error);
            resetProcessing('Payment submission failed. Please check your card details and try again.');
          }
        });
      } else {
        errorDiv.innerHTML = '<div class="error">Card payments are not available. Please contact support@readysetfly.us.</div>';
      }
    }
  </script>
</body>
</html>
    `);
  });

  // Contact Form - Public (no auth required)
  app.post("/api/contact", contactFormRateLimiter, async (req, res) => {
    try {
      // Server-side validation using Zod schema
      const contactFormSchema = z.object({
        firstName: z.string().min(1, "First name is required").max(100),
        lastName: z.string().min(1, "Last name is required").max(100),
        email: z.string().email("Valid email is required").max(255),
        subject: z.string().min(1, "Subject is required").max(200),
        message: z.string().min(10, "Message must be at least 10 characters").max(2000),
      });
      
      const validationResult = contactFormSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid form data", 
          details: validationResult.error.errors 
        });
      }
      
      const data = validationResult.data;
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      
      // Persist submission to database BEFORE sending email (audit trail)
      const submission = await storage.createContactSubmission({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        subject: data.subject,
        message: data.message,
        ipAddress: ip,
      });
      
      logDebug(`Contact form submission persisted: ${submission.id} from ${data.email}`);
      
      // Send email asynchronously (non-blocking)
      sendContactFormEmail(data)
        .then(async () => {
          // Update email status on success
          await storage.updateContactSubmissionEmailStatus(submission.id, true);
          logDebug(`Email sent successfully for submission ${submission.id}`);
        })
        .catch((error) => {
          // Log error but don't block response - submission is already persisted
          console.error(`Failed to send email for submission ${submission.id}:`, error);
        });
      
      // Respond immediately after persisting (don't wait for email)
      res.json({ success: true });
    } catch (error) {
      console.error('Contact form error:', error);
      res.status(500).json({ error: "Failed to process contact form submission" });
    }
  });

  // Cron endpoint: Send expiration reminders for banner ads and marketplace listings
  // SECURITY: Requires CRON_SECRET header to prevent unauthorized access
  app.post("/api/cron/send-expiration-reminders", async (req, res) => {
    try {
      // Verify cron secret token
      const cronSecret = req.headers['x-cron-secret'];
      const expectedSecret = process.env.CRON_SECRET || process.env.SESSION_SECRET; // Fallback to SESSION_SECRET if CRON_SECRET not set
      
      if (!cronSecret || cronSecret !== expectedSecret) {
        console.warn('Unauthorized cron attempt from IP:', req.ip);
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const {  getBannerAdExpirationReminderHtml, getBannerAdExpirationReminderText, getMarketplaceListingExpirationReminderHtml, getMarketplaceListingExpirationReminderText } = await import('./email-templates');
      const { client, fromEmail } = await getUncachableResendClient();
      
      let bannersProcessed = 0;
      let listingsProcessed = 0;
      let errors: string[] = [];
      
      // Find banner ads expiring soon (configurable lead time, default 3 days)
      const leadDays = Number(process.env.EXPIRATION_REMINDER_DAYS ?? 3);
      const expiringBanners = await storage.getExpiringBannerAdOrders(leadDays);
      
      // Find marketplace listings expiring soon with same lead time
      const expiringListings = await storage.getExpiringMarketplaceListings(leadDays);
      
      // Send banner ad expiration reminders
      for (const banner of expiringBanners) {
        try {
          const htmlBody = getBannerAdExpirationReminderHtml(banner.sponsorName, {
            title: banner.title,
            company: banner.sponsorCompany || banner.sponsorName,
            tier: banner.tier,
            endDate: banner.endDate?.toISOString() || new Date().toISOString(),
            startDate: banner.startDate?.toISOString() || new Date().toISOString(),
          });
          
          const textBody = getBannerAdExpirationReminderText(banner.sponsorName, {
            title: banner.title,
            company: banner.sponsorCompany || banner.sponsorName,
            tier: banner.tier,
            endDate: banner.endDate?.toISOString() || new Date().toISOString(),
            startDate: banner.startDate?.toISOString() || new Date().toISOString(),
            leadDays,
          });
          
          await client.emails.send({
            from: fromEmail,
            to: banner.sponsorEmail,
            subject: `Action Required: Your Ready Set Fly banner campaign ends in ${leadDays} days`,
            html: htmlBody,
            text: textBody,
          });
          
          // Mark reminder as sent
          await storage.updateBannerAdOrder(banner.id, {
            expirationReminderSent: true,
            expirationReminderSentAt: new Date(),
          });
          
          bannersProcessed++;
          logDebug(`Sent expiration reminder for banner ad order ${banner.id} to ${banner.sponsorEmail}`);
        } catch (error: any) {
          console.error(`Failed to send reminder for banner ad ${banner.id}:`, error);
          errors.push(`Banner ${banner.id}: ${error.message}`);
        }
      }
      
      // Send marketplace listing expiration reminders
      for (const listing of expiringListings) {
        try {
          // Get user details
          const user = await storage.getUser(listing.userId);
          if (!user || !user.email) {
            console.warn(`Skipping listing ${listing.id} - user not found or no email`);
            continue;
          }
          
          const userName = user.firstName || user.email.split('@')[0];
          
          const htmlBody = getMarketplaceListingExpirationReminderHtml(userName, {
            id: listing.id,
            title: listing.title,
            category: listing.category,
            tier: listing.tier || 'basic',
            expiresAt: listing.expiresAt?.toISOString() || new Date().toISOString(),
          });
          
          const textBody = getMarketplaceListingExpirationReminderText(userName, {
            id: listing.id,
            title: listing.title,
            category: listing.category,
            tier: listing.tier || 'basic',
            expiresAt: listing.expiresAt?.toISOString() || new Date().toISOString(),
            leadDays,
          });
          
          await client.emails.send({
            from: fromEmail,
            to: user.email,
            subject: `Renew your ${listing.category} listing – ${leadDays} days left on Ready Set Fly`,
            html: htmlBody,
            text: textBody,
          });
          
          // Mark reminder as sent
          await storage.updateMarketplaceListing(listing.id, {
            expirationReminderSent: true,
            expirationReminderSentAt: new Date(),
          });
          
          listingsProcessed++;
          logDebug(`Sent expiration reminder for marketplace listing ${listing.id} to ${user.email}`);
        } catch (error: any) {
          console.error(`Failed to send reminder for listing ${listing.id}:`, error);
          errors.push(`Listing ${listing.id}: ${error.message}`);
        }
      }
      
      res.json({
        success: true,
        bannersProcessed,
        listingsProcessed,
        totalReminders: bannersProcessed + listingsProcessed,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error('Cron job error:', error);
      res.status(500).json({ 
        error: "Failed to send expiration reminders",
        details: error.message 
      });
    }
  });

  app.get("/api/marketing/unsubscribe", async (req, res) => {
    try {
      const token = typeof req.query?.token === "string" ? req.query.token : "";
      if (!token) {
        return res.status(400).send("Missing unsubscribe token.");
      }

      const payload = verifyMarketingToken(token);
      if (!payload || payload.action !== "weekly_opt_out" || !payload.userId) {
        return res.status(400).send("Invalid or expired unsubscribe token.");
      }

      const updated = await storage.updateUser(String(payload.userId), {
        weeklyEmailOptIn: false,
        weeklyEmailOptOutAt: new Date(),
      });

      if (!updated) {
        return res.status(404).send("User not found.");
      }

      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"><title>Unsubscribed</title></head>
          <body style="font-family: Arial, sans-serif; padding: 24px;">
            <h2>You are unsubscribed.</h2>
            <p>You will no longer receive weekly Ready Set Fly emails.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Unsubscribe error:", error);
      res.status(500).send("Unable to process unsubscribe request.");
    }
  });

  app.post("/api/cron/send-weekly-engagement", async (req, res) => {
    try {
      const cronSecret = req.headers['x-cron-secret'];
      const expectedSecret = process.env.CRON_SECRET || process.env.SESSION_SECRET;
      if (!cronSecret || cronSecret !== expectedSecret) {
        console.warn('Unauthorized cron attempt from IP:', req.ip);
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { getWeeklyEngagementEmailHtml, getWeeklyEngagementEmailText } = await import('./email-templates');
      const { client, fromEmail } = await getUncachableResendClient();

      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const candidates = await db
        .select()
        .from(users)
        .where(and(eq(users.weeklyEmailOptIn, true), eq(users.isSuspended, false)));

      let emailsSent = 0;
      const errors: string[] = [];

      for (const user of candidates) {
        if (!user.email) continue;
        if (user.weeklyEmailLastSentAt && user.weeklyEmailLastSentAt > cutoff) continue;

        const firstName = user.firstName || user.email.split("@")[0];
        const token = signMarketingToken({ userId: user.id, action: "weekly_opt_out" });
        const unsubscribeUrl = `${getPublicBaseUrl()}/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`;

        try {
          await client.emails.send({
            from: fromEmail,
            to: user.email,
            subject: "Your weekly Ready Set Fly pilot tools rundown",
            html: getWeeklyEngagementEmailHtml({ firstName, unsubscribeUrl }),
            text: getWeeklyEngagementEmailText({ firstName, unsubscribeUrl }),
          });

          await storage.updateUser(user.id, {
            weeklyEmailLastSentAt: new Date(),
          });

          emailsSent += 1;
        } catch (error: any) {
          console.error(`Failed to send weekly email to ${user.email}:`, error);
          errors.push(`${user.email}: ${error.message || "send failed"}`);
        }
      }

      res.json({
        success: true,
        totalCandidates: candidates.length,
        emailsSent,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error("Weekly engagement cron error:", error);
      res.status(500).json({ error: "Failed to send weekly engagement emails" });
    }
  });

  // Cron endpoint: Clear approach-plate cache (metadata is fetched on demand)
  app.post("/api/cron/approach-plates/sync", async (req, res) => {
    try {
      const cronSecretHeader = req.headers['x-cron-secret'];
      const cronSecretQuery = typeof req.query?.secret === "string" ? req.query.secret : "";
      const cronSecret = cronSecretHeader || cronSecretQuery;
      const expectedSecret = process.env.CRON_SECRET || process.env.SESSION_SECRET;
      if (!cronSecret || cronSecret !== expectedSecret) {
        console.warn('Unauthorized cron attempt from IP:', req.ip);
        return res.status(401).json({ error: 'Unauthorized' });
      }

      clearPlateCache();
      approachPlateSyncState.lastResult = { cleared: true };
      approachPlateSyncState.lastFinishedAt = new Date();
      res.json({ cleared: true });
    } catch (error: any) {
      console.error("Approach plate sync error:", error);
      approachPlateSyncState.lastError = error.message || String(error);
      approachPlateSyncState.lastFinishedAt = new Date();
      approachPlateSyncState.inProgress = false;
      res.status(500).json({ error: "Failed to sync approach plates", details: error.message || String(error) });
    }
  });

  app.post("/api/admin/approach-plates/sync", isAuthenticated, isAdmin, async (req, res) => {
    try {
      if (approachPlateSyncState.inProgress) {
        return res.status(409).json({ error: "Sync already in progress" });
      }

      approachPlateSyncState.inProgress = true;
      approachPlateSyncState.lastStartedAt = new Date();
      approachPlateSyncState.lastFinishedAt = null;
      approachPlateSyncState.lastError = null;

      setTimeout(async () => {
        try {
          clearPlateCache();
          approachPlateSyncState.lastResult = { cleared: true };
          approachPlateSyncState.lastFinishedAt = new Date();
        } catch (error: any) {
          console.error("Admin approach plate sync error:", error);
          approachPlateSyncState.lastError = error.message || String(error);
          approachPlateSyncState.lastFinishedAt = new Date();
        } finally {
          approachPlateSyncState.inProgress = false;
        }
      }, 0);

      res.status(202).json({
        started: true,
        cleared: true,
      });
    } catch (error: any) {
      console.error("Admin approach plate sync error:", error);
      res.status(500).json({ error: "Failed to sync approach plates", details: error.message || String(error) });
    }
  });

  app.get("/api/admin/approach-plates/status", isAuthenticated, isAdmin, async (_req, res) => {
    res.json({
      inProgress: approachPlateSyncState.inProgress,
      lastStartedAt: approachPlateSyncState.lastStartedAt,
      lastFinishedAt: approachPlateSyncState.lastFinishedAt,
      lastError: approachPlateSyncState.lastError,
      lastResult: approachPlateSyncState.lastResult,
    });
  });

  // AI Description Generation endpoint
  app.post("/api/generate-description", isAuthenticated, async (req, res) => {
    try {
      const { listingType, details } = req.body;

      if (!openaiApiKey) {
        return res.status(503).json({ error: "AI service unavailable", details: "Missing OpenAI API key" });
      }
      
      if (!listingType || !details) {
        return res.status(400).json({ error: "Missing required fields: listingType and details" });
      }

      let systemPrompt = "";
      let userPrompt = "";

      // Customize prompts based on listing type
      switch (listingType) {
        case "aircraft-rental":
          systemPrompt = "You are an expert aviation copywriter specializing in aircraft rental listings. Create compelling, professional descriptions that highlight aircraft capabilities, features, and benefits for potential renters.";
          userPrompt = `Create a detailed, professional description for this aircraft rental listing:\n\nMake: ${details.make}\nModel: ${details.model}\nYear: ${details.year}\nCategory: ${details.category}\n${details.engine ? `Engine: ${details.engine}\n` : ''}${details.avionics ? `Avionics: ${details.avionics}\n` : ''}${details.totalTime ? `Total Time: ${details.totalTime} hours\n` : ''}${details.location ? `Location: ${details.location}\n` : ''}\n\nWrite a compelling 150-250 word description that emphasizes the aircraft's features, capabilities, and what makes it ideal for renters. Use professional aviation terminology but keep it accessible. Focus on practical benefits and highlight any special features or recent upgrades.`;
          break;

        case "aircraft-sale":
          systemPrompt = "You are an expert aviation sales copywriter. Create persuasive descriptions for aircraft for sale that emphasize value, condition, and investment potential.";
          userPrompt = `Create a detailed sales description for this aircraft:\n\n${details.title}\n${details.price ? `Price: $${details.price}\n` : ''}${details.location ? `Location: ${details.location}\n` : ''}\n\nWrite a compelling 150-250 word sales description that highlights the aircraft's value, condition, features, and investment potential. Emphasize what makes this aircraft stand out in the market.`;
          break;

        case "aviation-job":
          systemPrompt = "You are an expert in aviation recruitment. Create engaging job descriptions that attract qualified pilots and aviation professionals.";
          userPrompt = `Create a professional job description for this aviation position:\n\nTitle: ${details.title}\n${details.company ? `Company: ${details.company}\n` : ''}${details.location ? `Location: ${details.location}\n` : ''}${details.salary ? `Salary: ${details.salary}\n` : ''}\n\nWrite an engaging 150-250 word job description that outlines responsibilities, requirements, and benefits. Make it appealing to qualified aviation professionals.`;
          break;

        case "cfi-listing":
          systemPrompt = "You are an aviation education expert. Create descriptions for Certified Flight Instructor (CFI) listings that highlight expertise and teaching capabilities.";
          userPrompt = `Create a professional description for this CFI listing:\n\nTitle: ${details.title}\n${details.certifications ? `Certifications: ${details.certifications}\n` : ''}${details.location ? `Location: ${details.location}\n` : ''}${details.experience ? `Experience: ${details.experience}\n` : ''}\n\nWrite a 150-250 word description showcasing the instructor's qualifications, teaching style, and what students can expect. Emphasize expertise and approachability.`;
          break;

        case "flight-school":
          systemPrompt = "You are an aviation education marketing expert. Create compelling descriptions for flight schools that attract aspiring pilots.";
          userPrompt = `Create a professional description for this flight school:\n\nName: ${details.title}\n${details.location ? `Location: ${details.location}\n` : ''}${details.programs ? `Programs: ${details.programs}\n` : ''}\n\nWrite a 150-250 word description that highlights the school's programs, instructors, aircraft, and unique advantages. Make it inspiring for aspiring pilots.`;
          break;

        case "mechanic":
          systemPrompt = "You are an aviation maintenance expert. Create professional descriptions for aircraft mechanic services that inspire confidence.";
          userPrompt = `Create a professional description for this aircraft mechanic service:\n\nTitle: ${details.title}\n${details.certifications ? `Certifications: ${details.certifications}\n` : ''}${details.location ? `Location: ${details.location}\n` : ''}${details.specialties ? `Specialties: ${details.specialties}\n` : ''}\n\nWrite a 150-250 word description that emphasizes expertise, certifications, services offered, and commitment to safety and quality.`;
          break;

        case "charter":
          systemPrompt = "You are an aviation charter service marketing expert. Create descriptions that emphasize luxury, convenience, and safety.";
          userPrompt = `Create a professional description for this charter service:\n\nTitle: ${details.title}\n${details.aircraftType ? `Aircraft Type: ${details.aircraftType}\n` : ''}${details.location ? `Based: ${details.location}\n` : ''}${details.capacity ? `Capacity: ${details.capacity}\n` : ''}\n\nWrite a 150-250 word description that highlights the service's benefits, aircraft capabilities, safety record, and commitment to customer satisfaction. Emphasize luxury and convenience.`;
          break;

        default:
          return res.status(400).json({ error: "Invalid listing type" });
      }

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const description = completion.choices[0]?.message?.content || "";

      res.json({ description });
    } catch (error: any) {
      console.error("AI description generation error:", {
        message: error?.message,
        status: error?.status,
        response: error?.response?.data,
        baseURL: openaiBaseUrl || "default",
      });
      res.status(500).json({ 
        error: "Failed to generate description",
        details: error?.message || "Unexpected error",
      });
    }
  });

  // Aircraft Types (RSF Library)
  app.get("/api/aircraft/types", aircraftTypeRateLimiter, async (req, res) => {
    try {
      const { q, category, engine_type: engineType, limit, offset } = req.query as any;
      const types = await storage.getAircraftTypes({
        q: typeof q === "string" ? q : undefined,
        category: typeof category === "string" ? category : undefined,
        engineType: typeof engineType === "string" ? engineType : undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });
      const response = types.map((type) => ({
        ...type,
        ...buildEffectiveValues(null, type),
      }));
      res.json(response);
    } catch (error) {
      console.error("Failed to fetch aircraft types:", error);
      res.status(500).json({ error: "Failed to fetch aircraft types" });
    }
  });

  app.get("/api/aircraft/types/:id", aircraftTypeRateLimiter, async (req, res) => {
    try {
      const type = await storage.getAircraftTypeById(req.params.id);
      if (!type) {
        return res.status(404).json({ error: "Aircraft type not found" });
      }
      res.json({ ...type, ...buildEffectiveValues(null, type) });
    } catch (error) {
      console.error("Failed to fetch aircraft type:", error);
      res.status(500).json({ error: "Failed to fetch aircraft type" });
    }
  });

  app.post("/api/aircraft/types", isAdmin, aircraftTypeRateLimiter, async (req, res) => {
    try {
      const result = insertAircraftTypeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const created = await storage.createAircraftType(result.data as any);
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to create aircraft type:", error);
      res.status(500).json({ error: "Failed to create aircraft type" });
    }
  });

  app.put("/api/aircraft/types/:id", isAdmin, aircraftTypeRateLimiter, async (req, res) => {
    try {
      const result = insertAircraftTypeSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const updated = await storage.updateAircraftType(req.params.id, result.data as any);
      if (!updated) {
        return res.status(404).json({ error: "Aircraft type not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Failed to update aircraft type:", error);
      res.status(500).json({ error: "Failed to update aircraft type" });
    }
  });

  app.delete("/api/aircraft/types/:id", isAdmin, aircraftTypeRateLimiter, async (req, res) => {
    try {
      const success = await storage.deleteAircraftType(req.params.id);
      res.json({ success });
    } catch (error) {
      console.error("Failed to delete aircraft type:", error);
      res.status(500).json({ error: "Failed to delete aircraft type" });
    }
  });

  // Aircraft Profiles (User-specific)
  app.get("/api/aircraft/profiles", isAuthenticated, aircraftProfileRateLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profiles = await storage.getAircraftProfilesByUser(userId);
      const typeIds = profiles.map((profile) => profile.typeId).filter(Boolean) as string[];
      const types = await storage.getAircraftTypesByIds(typeIds);
      const typeMap = new Map(types.map((type) => [type.id, type]));
      const response = profiles.map((profile) => ({
        ...profile,
        type: profile.typeId ? typeMap.get(profile.typeId) || null : null,
        ...buildEffectiveValues(profile, profile.typeId ? typeMap.get(profile.typeId) : null),
      }));
      res.json(response);
    } catch (error) {
      console.error("Failed to fetch aircraft profiles:", error);
      res.status(500).json({ error: "Failed to fetch aircraft profiles" });
    }
  });

  app.post("/api/aircraft/profiles", isAuthenticated, aircraftProfileRateLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = insertAircraftProfileSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const created = await storage.createAircraftProfile({ ...result.data, userId } as any);
      const baseType = created.typeId ? await storage.getAircraftTypeById(created.typeId) : null;
      res.status(201).json({ ...created, type: baseType, ...buildEffectiveValues(created, baseType) });
    } catch (error) {
      console.error("Failed to create aircraft profile:", error);
      res.status(500).json({ error: "Failed to create aircraft profile" });
    }
  });

  app.put("/api/aircraft/profiles/:id", isAuthenticated, aircraftProfileRateLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const existing = await storage.getAircraftProfileById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Aircraft profile not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const result = insertAircraftProfileSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const updated = await storage.updateAircraftProfile(req.params.id, result.data as any);
      if (!updated) {
        return res.status(404).json({ error: "Aircraft profile not found" });
      }
      const baseType = updated.typeId ? await storage.getAircraftTypeById(updated.typeId) : null;
      res.json({ ...updated, type: baseType, ...buildEffectiveValues(updated, baseType) });
    } catch (error) {
      console.error("Failed to update aircraft profile:", error);
      res.status(500).json({ error: "Failed to update aircraft profile" });
    }
  });

  app.delete("/api/aircraft/profiles/:id", isAuthenticated, aircraftProfileRateLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const existing = await storage.getAircraftProfileById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Aircraft profile not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const success = await storage.deleteAircraftProfile(req.params.id);
      res.json({ success });
    } catch (error) {
      console.error("Failed to delete aircraft profile:", error);
      res.status(500).json({ error: "Failed to delete aircraft profile" });
    }
  });

  // Aircraft Listings
  app.get("/api/aircraft", async (req, res) => {
    try {
      const listings = await storage.getAllAircraftListings();
      res.json([SAMPLE_AIRCRAFT_LISTING, ...listings]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch aircraft listings" });
    }
  });

  app.get("/api/aircraft/:id", async (req, res) => {
    try {
      if (isSampleAircraftId(req.params.id)) {
        return res.json(SAMPLE_AIRCRAFT_LISTING);
      }
      const listing = await storage.getAircraftListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Aircraft not found" });
      }
      res.json(listing);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch aircraft" });
    }
  });

  // Increment aircraft listing view count
  app.post("/api/aircraft/:id/view", async (req, res) => {
    try {
      if (isSampleAircraftId(req.params.id)) {
        return res.json({ success: true, sample: true });
      }
      const listing = await storage.getAircraftListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Aircraft not found" });
      }
      await storage.incrementAircraftViewCount(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to increment aircraft view count:", error);
      res.status(500).json({ error: "Failed to track view" });
    }
  });

  app.get("/api/aircraft/owner/:ownerId", async (req, res) => {
    try {
      const listings = await storage.getAircraftListingsByOwner(req.params.ownerId);
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch owner aircraft" });
    }
  });

  app.post("/api/aircraft", 
    isAuthenticated, 
    isVerified,
    upload.fields([
      { name: 'insuranceDoc', maxCount: 1 },
      { name: 'annualInspectionDoc', maxCount: 1 },
    ]),
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        
        // Parse listing data - handle both multipart and JSON
        const hasFiles = files && Object.keys(files).length > 0;
        const listingData = hasFiles ? JSON.parse(req.body.listingData || '{}') : req.body;
        
        // Create individual placeholder URLs for each verification document type (only if files present)
        const timestamp = Date.now();
        const insuranceDocUrl = hasFiles && files.insuranceDoc ? `/uploads/insurance-${userId}-${timestamp}.pdf` : null;
        const annualInspectionDocUrl = hasFiles && files.annualInspectionDoc ? `/uploads/annual-${userId}-${timestamp}.pdf` : null;
        
        // Collect all non-null document URLs for verification submission
        const docUrls = [
          insuranceDocUrl,
          annualInspectionDocUrl,
        ].filter((url): url is string => url !== null);
        
        // Calculate annual due date (12 months from inspection date)
        let annualDueDate = null;
        if (listingData.annualInspectionDate) {
          const inspectionDate = new Date(listingData.annualInspectionDate);
          const dueDate = new Date(inspectionDate);
          dueDate.setFullYear(dueDate.getFullYear() + 1);
          // Convert back to YYYY-MM-DD string format for text field
          annualDueDate = dueDate.toISOString().split('T')[0];
        }
        
        // Calculate 100-hour remaining (currentTach - hour100InspectionTach)
        let hour100Remaining = null;
        if (listingData.requires100Hour && 
            listingData.currentTach !== undefined && listingData.currentTach !== null &&
            listingData.hour100InspectionTach !== undefined && listingData.hour100InspectionTach !== null) {
          const remaining = 100 - (listingData.currentTach - listingData.hour100InspectionTach);
          hour100Remaining = Math.max(0, remaining);
        }
        
        // Create listing - if verification docs provided, keep unlisted until admin approval
        // Otherwise, publish immediately (preserves existing behavior for JSON-only submissions)
        const validatedData = insertAircraftListingSchema.parse({
          ...listingData,
          ownerId: userId,
          isListed: !hasFiles || docUrls.length === 0, // Publish immediately if no verification docs
          ownershipVerified: false,
          maintenanceVerified: false,
          hasMaintenanceTracking: !!listingData.maintenanceTrackingProvider,
          // Automatic calculations
          annualDueDate,
          hour100Remaining,
          // Include verification doc URLs in listing for reference
          insuranceDocUrl,
          annualInspectionDocUrl,
        });
        
        const listing = await storage.createAircraftListing(validatedData);
        
        // Create verification submission for admin review (only if verification docs provided)
        if (hasFiles && docUrls.length > 0) {
          await storage.createVerificationSubmission({
            userId,
            type: 'owner_aircraft',
            status: 'pending',
            aircraftId: listing.id,
            submissionData: {
              ...listingData,
              registration: listing.registration,
              make: listing.make,
              model: listing.model,
            },
            documentUrls: docUrls,
            reviewedBy: null,
            reviewedAt: null,
            reviewNotes: null,
            rejectionReason: null,
            faaRegistryChecked: false,
            faaRegistryMatch: null,
            faaRegistryData: null,
            sources: [],
            fileHashes: [],
            pilotLicenseExpiresAt: null,
            medicalCertExpiresAt: null,
            insuranceExpiresAt: null,
            governmentIdExpiresAt: null,
            expirationNotificationSent: false,
            lastNotificationSentAt: null,
          });
        }
        
        res.status(201).json(listing);
      } catch (error: any) {
        console.error("Create aircraft listing error:", error);
        res.status(400).json({ error: error.message || "Invalid aircraft data" });
      }
    }
  );

  app.patch("/api/aircraft/:id", isAuthenticated, isVerified, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const listing = await storage.getAircraftListing(req.params.id);
      
      if (!listing) {
        return res.status(404).json({ error: "Aircraft not found" });
      }
      
      // Verify ownership or admin status
      const user = await storage.getUser(userId);
      if (listing.ownerId !== userId && !user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ error: "Not authorized to update this aircraft" });
      }
      
      const updatedListing = await storage.updateAircraftListing(req.params.id, req.body);
      res.json(updatedListing);
    } catch (error) {
      res.status(500).json({ error: "Failed to update aircraft" });
    }
  });

  app.post("/api/aircraft/:id/toggle", isAuthenticated, isVerified, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const listing = await storage.getAircraftListing(req.params.id);
      
      if (!listing) {
        return res.status(404).json({ error: "Aircraft not found" });
      }
      
      // Verify ownership or admin status
      const user = await storage.getUser(userId);
      if (listing.ownerId !== userId && !user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ error: "Not authorized to toggle this aircraft" });
      }
      
      const toggledListing = await storage.toggleAircraftListingStatus(req.params.id);
      res.json(toggledListing);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle aircraft status" });
    }
  });

  app.delete("/api/aircraft/:id", isAuthenticated, isVerified, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const listing = await storage.getAircraftListing(req.params.id);
      
      if (!listing) {
        return res.status(404).json({ error: "Aircraft not found" });
      }
      
      // Verify ownership or admin status
      const user = await storage.getUser(userId);
      if (listing.ownerId !== userId && !user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ error: "Not authorized to delete this aircraft" });
      }
      
      await storage.deleteAircraftListing(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete aircraft" });
    }
  });

  // Marketplace Listings with filtering
  app.get("/api/marketplace", async (req, res) => {
    try {
      const { city, category, minPrice, maxPrice, engineType, keyword, radius, cfiRating } = req.query;
      
      // If no filters provided, use the old method
      if (!city && !category && !minPrice && !maxPrice && !engineType && !keyword && !radius && !cfiRating) {
        const listings = await storage.getAllMarketplaceListings();
        const samples = getSampleMarketplaceListings();
        return res.json([...samples, ...listings]);
      }

      // Use filtered query with validation
      const filters: any = {};
      if (city) filters.city = city as string;
      if (category) filters.category = category as string;
      
      // Validate and parse numeric price filters
      if (minPrice) {
        const parsed = parseFloat(minPrice as string);
        if (!isNaN(parsed)) filters.minPrice = parsed;
      }
      if (maxPrice) {
        const parsed = parseFloat(maxPrice as string);
        if (!isNaN(parsed)) filters.maxPrice = parsed;
      }
      
      if (engineType) filters.engineType = engineType as string;
      if (keyword) filters.keyword = keyword as string;
      if (cfiRating) filters.cfiRating = cfiRating as string;
      
      // Validate and parse radius filter
      if (radius) {
        const parsed = parseFloat(radius as string);
        if (!isNaN(parsed)) filters.radius = parsed;
      }

      const listings = await storage.getFilteredMarketplaceListings(filters);
      const samples = getSampleMarketplaceListings(filters);
      res.json([...samples, ...listings]);
    } catch (error) {
      console.error("Failed to fetch marketplace listings:", error);
      res.status(500).json({ error: "Failed to fetch marketplace listings" });
    }
  });

  app.get("/api/marketplace/category/:category", async (req, res) => {
    try {
      const listings = await storage.getMarketplaceListingsByCategory(req.params.category);
      const samples = getSampleMarketplaceListings({ category: req.params.category });
      res.json([...samples, ...listings]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch category listings" });
    }
  });

  app.get("/api/marketplace/user/:userId", async (req, res) => {
    try {
      const listings = await storage.getMarketplaceListingsByUser(req.params.userId);
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user listings" });
    }
  });

  // Get flagged marketplace listings (admin only) - MUST come before :id route
  app.get("/api/marketplace/flagged", isAuthenticated, requireMarketplaceAdmin, async (req, res) => {
    try {
      const flaggedListings = await storage.getFlaggedMarketplaceListings();
      res.json(flaggedListings);
    } catch (error) {
      console.error("Error fetching flagged listings:", error);
      res.status(500).json({ error: "Failed to fetch flagged listings" });
    }
  });

  app.get("/api/marketplace/:id", async (req: any, res) => {
    try {
      const sampleListing = getSampleMarketplaceListing(req.params.id);
      if (sampleListing) {
        return res.json({ ...sampleListing, userHasFlagged: false });
      }
      const listing = await storage.getMarketplaceListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      // Check if current user has flagged this listing
      let userHasFlagged = false;
      if (req.user?.claims?.sub) {
        const userId = req.user.claims.sub;
        userHasFlagged = await storage.checkIfUserFlaggedListing(req.params.id, userId);
      }
      
      res.json({ ...listing, userHasFlagged });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch listing" });
    }
  });

  // Increment marketplace listing view count
  app.post("/api/marketplace/:id/view", async (req: any, res) => {
    try {
      const sampleListing = getSampleMarketplaceListing(req.params.id);
      if (sampleListing) {
        return res.json({ success: true, sample: true });
      }
      const listing = await storage.getMarketplaceListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      // Increment view count
      await storage.incrementMarketplaceViewCount(req.params.id);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to increment view count:", error);
      res.status(500).json({ error: "Failed to track view" });
    }
  });

  // Contact marketplace listing owner
  app.post("/api/marketplace/:id/contact", contactFormRateLimiter, async (req, res) => {
    try {
      const contactSchema = z.object({
        name: z.string().trim().min(1, "Name is required").max(160),
        email: z.string().trim().email("Valid email is required").max(255),
        phone: z.string().trim().max(40).optional(),
        message: z.string().trim().max(2000).optional(),
      });

      const parsed = contactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid contact data",
          details: parsed.error.errors,
        });
      }

      const listingId = req.params.id;
      if (getSampleMarketplaceListing(listingId)) {
        return res.status(400).json({ error: "Sample listings cannot be contacted." });
      }

      const listing = await storage.getMarketplaceListing(listingId);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }

      const listingOwner = await storage.getUser(listing.userId);
      const recipientEmail = listing.contactEmail || listingOwner?.email;
      if (!recipientEmail) {
        return res.status(400).json({
          error: "Listing does not have a contact email configured. Please ask the seller to update their listing.",
        });
      }

      const categoryLabels: Record<string, string> = {
        "aircraft-sale": "Aircraft For Sale",
        "charter": "Charter Services",
        "cfi": "CFI Services",
        "flight-school": "Flight School",
        "mechanic": "A&P Mechanic",
        "job": "Job Opening",
      };

      const recipientName = listingOwner?.firstName || listingOwner?.email || undefined;

      await sendMarketplaceListingContactEmail({
        recipientEmail,
        recipientName,
        listingId: listing.id,
        listingTitle: listing.title,
        listingCategory: categoryLabels[listing.category] || listing.category,
        listingLocation: listing.location || undefined,
        listingTier: listing.tier || undefined,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        message: parsed.data.message,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Marketplace listing contact error:", error);
      res.status(500).json({ error: "Failed to contact listing owner" });
    }
  });

  // Promo code validation (public for banner ads, authenticated for marketplace)
  app.post("/api/promo-codes/validate", async (req: any, res) => {
    try {
      const { code, context } = req.body;
      
      if (!code || !context) {
        return res.status(400).json({ valid: false, message: "Code and context are required" });
      }

      if (context !== "banner-ad" && context !== "marketplace") {
        return res.status(400).json({ valid: false, message: "Invalid context" });
      }

      // Validate using database
      const promoCode = await storage.validatePromoCodeForContext(code, context);
      
      if (!promoCode) {
        return res.json({ valid: false, message: "Invalid or expired promo code" });
      }

      // Return valid promo code details
      res.json({ 
        valid: true,
        code: promoCode.code,
        description: promoCode.description || "Promo code applied successfully!",
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue ? parseFloat(promoCode.discountValue) : null,
      });
    } catch (error: any) {
      console.error("Promo code validation error:", error);
      res.status(500).json({ valid: false, message: "Failed to validate promo code" });
    }
  });

  // Auto-deactivate expired listings (called periodically or on-demand)
  app.post("/api/marketplace/check-expirations", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const result = await storage.deactivateExpiredListings();
      res.json({ 
        deactivatedCount: result.deactivatedCount,
        message: `Deactivated ${result.deactivatedCount} expired listings`
      });
    } catch (error: any) {
      console.error("Failed to check expirations:", error);
      res.status(500).json({ error: "Failed to check expirations" });
    }
  });

  // Reactivate a listing (renew for another 30 days with payment)
  app.post("/api/marketplace/:id/reactivate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { transactionId } = req.body;
      
      const listing = await storage.getMarketplaceListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      if (listing.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to reactivate this listing" });
      }
      
      // Payment verification is REQUIRED for reactivation
      if (!transactionId) {
        return res.status(402).json({ 
          error: "Payment required",
          message: "Payment is required to reactivate this listing."
        });
      }
      
      // Verify payment was successful with Braintree
      // const transaction = await gateway.transaction.find(transactionId);
      /*
      if (transaction.status !== 'settled' && transaction.status !== 'submitted_for_settlement') {
        return res.status(402).json({ 
          error: "Payment required",
          message: "Payment has not been completed."
        });
      }
      
      if (transaction.customFields?.user_id !== userId) {
        return res.status(403).json({ 
          error: "Unauthorized",
          message: "Payment verification failed"
        });
      }
      
      // Calculate monthlyFee from payment amount
      const monthlyFee = parseFloat(transaction.amount);
      
      // Reactivate listing for another 30 days
      const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const updated = await storage.updateMarketplaceListing(req.params.id, {
        isActive: true,
        expiresAt: newExpiresAt,
        isPaid: true,
        monthlyFee: monthlyFee.toString(),
        updatedAt: new Date(),
      });
      
      res.json(updated);
      */
      // TODO: Re-implement payment verification using PayPal instead of Braintree
    } catch (error: any) {
      console.error("Failed to reactivate listing:", error);
      res.status(500).json({ error: "Failed to reactivate listing" });
    }
  });
  app.post("/api/marketplace", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { paymentIntentId, isPaid, expiresAt, monthlyFee, ...listingData } = req.body;

      if (paymentIntentId || isPaid || expiresAt) {
        return res.status(400).json({
          error: "Payment completion required",
          message: "Use /api/marketplace/complete-create after PayPal payment"
        });
      }

      const baseAmount = getBasePrice(listingData.category, listingData.tier);

      // Validate the base listing data first
      const validatedData = insertMarketplaceListingSchema.parse({
        ...listingData,
        userId,
        monthlyFee: baseAmount.toFixed(2),
      });

      // Create as draft (unpaid + inactive)
      const listing = await storage.createMarketplaceListing({
        ...validatedData,
        isPaid: false,
        isActive: false,
        expiresAt: null,
      });

      res.status(201).json({ status: 'draft', listing });
    } catch (error: any) {
      console.error("Marketplace listing creation error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      res.status(400).json({ error: error.message || "Invalid listing data" });
    }
  });

  app.patch("/api/marketplace/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const listingId = req.params.id;

      const sampleListing = getSampleMarketplaceListing(listingId);
      if (sampleListing) {
        return res.status(403).json({ error: "Sample listings cannot be edited" });
      }
      
      // First, fetch the existing listing to verify ownership
      const existingListing = await storage.getMarketplaceListing(listingId);
      if (!existingListing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      // Prevent editing sample listings
      if ((existingListing as any).isExample) {
        return res.status(403).json({ error: "Sample listings cannot be edited" });
      }
      
      // Verify the user owns this listing
      if (existingListing.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized - you can only edit your own listings" });
      }
      
      // Update the listing (don't allow changing userId or payment-related fields)
      const { userId: _, monthlyFee: __, isPaid: ___, expiresAt: ____, ...updateData } = req.body;
      const listing = await storage.updateMarketplaceListing(listingId, updateData);
      
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      res.json(listing);
    } catch (error: any) {
      console.error("Marketplace listing update error:", error);
      res.status(500).json({ error: error.message || "Failed to update listing" });
    }
  });
  // Upgrade marketplace listing tier (deprecated - use complete-upgrade)
  app.post("/api/marketplace/:id/upgrade", isAuthenticated, async (_req: any, res) => {
    return res.status(400).json({
      error: "Upgrade requires PayPal payment",
      message: "Use /api/marketplace/:id/complete-upgrade after payment capture"
    });
  });

  // Complete marketplace listing upgrade after PayPal payment
  app.post("/api/marketplace/:id/complete-upgrade", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const listingId = req.params.id;
      const { newTier, orderId } = req.body;
      
      if (!newTier || !orderId) {
        return res.status(400).json({ error: "Missing required fields: newTier and orderId" });
      }
      
      // Validate new tier
      if (!VALID_TIERS.includes(newTier as any)) {
        return res.status(400).json({ error: "Invalid tier" });
      }
      
      // Fetch the existing listing
      const listing = await storage.getMarketplaceListing(listingId);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      // Prevent upgrading sample listings
      if ((listing as any).isExample) {
        return res.status(403).json({ error: "Sample listings cannot be upgraded" });
      }
      
      // Verify ownership
      if (listing.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to upgrade this listing" });
      }
      
      // Validate upgrade (must be going up in tier)
      if (!isValidUpgrade(listing.tier || 'basic', newTier)) {
        return res.status(400).json({ error: "Invalid upgrade - must upgrade to a higher tier" });
      }
      // Verify PayPal order was captured
      let orderData: any;
      try {
        orderData = await getPayPalOrder(orderId);
      } catch (paypalError: any) {
        console.error("PayPal order verification error:", paypalError);
        return res.status(400).json({ error: "Failed to verify payment" });
      }

      if (orderData.status !== 'COMPLETED') {
        return res.status(400).json({ error: "Payment not completed" });
      }

      const customId = orderData.purchase_units?.[0]?.custom_id || orderData.purchase_units?.[0]?.customId || '';
      const customData = parsePayPalCustomId(customId);
      if (customData.user !== userId || customData.purpose !== 'marketplace_upgrade_fee') {
        return res.status(400).json({ error: "Payment order mismatch" });
      }
      if (customData.upgrade && customData.upgrade !== listingId) {
        return res.status(400).json({ error: "Payment order mismatch" });
      }
      if (customData.tier && customData.tier !== newTier) {
        return res.status(400).json({ error: "Payment tier mismatch" });
      }

      const orderAmount = extractPayPalOrderAmount(orderData);
      if (!orderAmount) {
        return res.status(400).json({ error: "Payment amount not found" });
      }

      if (orderAmount.currency !== 'USD') {
        return res.status(400).json({ error: "Unsupported payment currency" });
      }

      const upgradeDelta = getUpgradeDelta(listing.category, listing.tier || 'basic', newTier);
      const expectedAmount = calculateTotalWithTax(upgradeDelta);
      if (expectedAmount <= 0) {
        return res.status(400).json({ error: "Upgrade amount must be greater than $0" });
      }

      const expectedCents = toCents(expectedAmount);
      const orderCents = toCents(orderAmount.value);
      if (!expectedCents || !orderCents || expectedCents !== orderCents) {
        return res.status(400).json({ error: "Payment amount mismatch" });
      }

      const consumption = await storage.consumePayPalOrder({
        orderId,
        userId,
        purpose: 'marketplace_upgrade_fee',
        resourceType: 'listing',
        resourceId: listingId,
        amount: orderAmount.value,
        currency: orderAmount.currency,
      });

        if (!consumption) {
          return res.status(400).json({ error: "This payment has already been processed" });
        }

        // Record marketplace upgrade fee transaction (admin analytics)
        try {
          await storage.createTransaction({
            userId,
            type: "marketplace_upgrade_fee",
            amount: orderAmount.value,
            marketplaceListingId: listingId,
            status: "completed",
            description: `Marketplace upgrade ${listing.tier || "basic"} → ${newTier} (PayPal ${orderId})`,
            rentalId: null,
            depositedToBankAt: null,
          });
        } catch (error) {
          console.error("Failed to record upgrade fee transaction:", error);
        }

        const transactionHistory = (listing as any).upgradeTransactions || [];
      
      // Calculate new monthly fee using shared pricing helper
      const newMonthlyFee = (parseFloat(listing.monthlyFee || '25') + upgradeDelta).toString();
      
      // Update the listing with new tier and track the transaction
      const updatedListing = await storage.updateMarketplaceListing(listingId, {
        tier: newTier,
        monthlyFee: newMonthlyFee,
        upgradeTransactions: [...transactionHistory, orderId],
      } as any);
      
      logDebug(`✅ Listing ${listingId} upgraded: ${listing.tier} → ${newTier}, PayPal order: ${orderId}`);
      
      res.json({
        message: "Listing upgraded successfully",
        listing: updatedListing,
        transactionId: orderId,
      });
    } catch (error: any) {
      console.error("Complete upgrade error:", error);
      res.status(500).json({ error: error.message || "Failed to complete upgrade" });
    }
  });

  app.delete("/api/marketplace/:id", async (req, res) => {
    try {
      // Check if listing is a sample listing
      const listing = await storage.getMarketplaceListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if ((listing as any).isExample) {
        return res.status(403).json({ error: "Sample listings cannot be deleted" });
      }
      
      const deleted = await storage.deleteMarketplaceListing(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Listing not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete listing" });
    }
  });

  // Flag marketplace listing as spam/fraud
  app.post("/api/marketplace/:id/flag", isAuthenticated, async (req: any, res) => {
    try {
      const sampleListing = getSampleMarketplaceListing(req.params.id);
      if (sampleListing) {
        return res.json({ flagCount: 0, sample: true });
      }
      const userId = req.user.claims.sub;
      const listingId = req.params.id;
      const { reason } = req.body;

      // Check if listing exists
      const listing = await storage.getMarketplaceListing(listingId);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }

      // Attempt to flag the listing
      const result = await storage.flagMarketplaceListing(listingId, userId, reason);

      if (!result.success) {
        return res.status(400).json({ error: "You have already flagged this listing", flagCount: result.flagCount });
      }

      res.json({ 
        message: "Listing flagged successfully",
        flagCount: result.flagCount,
      });
    } catch (error: any) {
      console.error("Error flagging marketplace listing:", error);
      res.status(500).json({ error: "Failed to flag listing" });
    }
  });

  // Rentals
  app.get("/api/rentals", async (req, res) => {
    try {
      const rentals = await storage.getAllRentals();
      res.json(rentals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rentals" });
    }
  });

  app.get("/api/rentals/renter/:renterId", async (req, res) => {
    try {
      const rentals = await storage.getRentalsByRenter(req.params.renterId);
      res.json(rentals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch renter rentals" });
    }
  });

  app.get("/api/rentals/owner/:ownerId", async (req, res) => {
    try {
      const rentals = await storage.getRentalsByOwner(req.params.ownerId);
      res.json(rentals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch owner rentals" });
    }
  });

  app.get("/api/rentals/aircraft/:aircraftId", async (req, res) => {
    try {
      const rentals = await storage.getRentalsByAircraft(req.params.aircraftId);
      res.json(rentals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch aircraft rentals" });
    }
  });

  app.get("/api/rentals/:id", async (req, res) => {
    try {
      const rental = await storage.getRental(req.params.id);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      res.json(rental);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rental" });
    }
  });

  app.post("/api/rentals", isAuthenticated, isVerified, async (req: any, res) => {
    try {
      const renterId = req.user.claims.sub;
      
      // Add renterId from session and ensure dates/hours are properly formatted
      const rentalData = {
        ...req.body,
        renterId,
        // Convert dates to ISO strings if they aren't already
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        // Ensure estimatedHours and hourlyRate are strings
        estimatedHours: String(req.body.estimatedHours),
        hourlyRate: String(req.body.hourlyRate),
      };
      
      const validatedData = insertRentalSchema.parse(rentalData);
      const rental = await storage.createRental(validatedData);
      res.status(201).json(rental);
    } catch (error: any) {
      console.error("Rental creation error:", error);
      res.status(400).json({ error: error.message || "Invalid rental data" });
    }
  });

  app.patch("/api/rentals/:id", async (req, res) => {
    try {
      const rental = await storage.updateRental(req.params.id, req.body);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      res.json(rental);
    } catch (error) {
      res.status(500).json({ error: "Failed to update rental" });
    }
  });

  // Complete rental payment - verifies payment and updates status
  app.post("/api/rentals/:id/complete-payment", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { orderId, transactionId } = req.body;
      const paypalOrderId = orderId || transactionId;

      if (!paypalOrderId) {
        return res.status(400).json({ error: "Order ID required" });
      }

      const rental = await storage.getRental(req.params.id);
      
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }

      // Verify the rental belongs to the current user (renter)
      if (rental.renterId !== userId) {
        return res.status(403).json({ error: "Not authorized to complete this rental" });
      }

      if (rental.isPaid) {
        return res.status(400).json({ error: "Rental is already paid" });
      }

      // Verify rental is in approved status
      if (rental.status !== "approved") {
        return res.status(400).json({ error: "Rental must be in approved status" });
      }

      // Verify PayPal order
      let orderData: any;
      try {
        orderData = await getPayPalOrder(paypalOrderId);
      } catch (paypalError: any) {
        console.error("PayPal order verification error:", paypalError);
        return res.status(400).json({ error: "Failed to verify payment" });
      }

      if (orderData.status !== 'COMPLETED') {
        return res.status(400).json({ error: "Payment not completed" });
      }

      const customId = orderData.purchase_units?.[0]?.custom_id || orderData.purchase_units?.[0]?.customId || "";
      const customData = parsePayPalCustomId(customId);
      if (
        customData.user !== userId ||
        customData.purpose !== "rental_payment" ||
        customData.rental !== rental.id
      ) {
        return res.status(400).json({ error: "Payment order mismatch" });
      }

      const orderAmount = extractPayPalOrderAmount(orderData);
      if (!orderAmount) {
        return res.status(400).json({ error: "Payment amount not found" });
      }

      if (orderAmount.currency !== "USD") {
        return res.status(400).json({ error: "Unsupported payment currency" });
      }

      const expectedAmount = parseFloat(rental.totalCostRenter || "0");
      const expectedCents = toCents(expectedAmount);
      const orderCents = toCents(orderAmount.value);

      if (!expectedCents || !orderCents || expectedCents !== orderCents) {
        return res.status(400).json({ error: "Payment amount mismatch" });
      }

      const consumption = await storage.consumePayPalOrder({
        orderId: paypalOrderId,
        userId,
        purpose: "rental_payment",
        resourceType: "rental",
        resourceId: rental.id,
        amount: orderAmount.value,
        currency: orderAmount.currency,
      });

        if (!consumption) {
          return res.status(400).json({ error: "This payment has already been processed" });
        }

        // Record platform fee revenue transaction (admin analytics)
        try {
          const platformFeeRenter = parseFloat(rental.platformFeeRenter || "0");
          const platformFeeOwner = parseFloat(rental.platformFeeOwner || "0");
          const platformFeeTotal = platformFeeRenter + platformFeeOwner;
          if (platformFeeTotal > 0) {
            await storage.createTransaction({
              userId,
              type: "platform_fee",
              amount: platformFeeTotal.toFixed(2),
              rentalId: rental.id,
              status: "completed",
              description: `Platform fee for rental ${rental.id} (PayPal ${paypalOrderId})`,
              marketplaceListingId: null,
              depositedToBankAt: null,
            });
          }
        } catch (error) {
          console.error("Failed to record platform fee transaction:", error);
        }

        // Update rental to mark as paid and active
        const updatedRental = await storage.updateRental(req.params.id, {
          isPaid: true,
          status: "active",
        });

      // Credit owner's balance with their payout amount
      const ownerPayoutAmount = parseFloat(rental.ownerPayout);
      await storage.addToUserBalance(rental.ownerId, ownerPayoutAmount);
      logDebug(`[RENTAL PAYMENT] Credited $${ownerPayoutAmount} to owner ${rental.ownerId} for rental ${rental.id}`);

      res.json(updatedRental);
    } catch (error: any) {
      console.error("Complete payment error:", error);
      res.status(500).json({ error: error.message || "Failed to complete rental payment" });
    }
  });

  // Messages
  app.get("/api/rentals/:rentalId/messages", async (req, res) => {
    try {
      // Verify rental exists and is active
      const rental = await storage.getRental(req.params.rentalId);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      if (rental.status !== "active") {
        return res.status(403).json({ error: "Messaging only available for active rentals" });
      }

      const messages = await storage.getMessagesByRental(req.params.rentalId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      // Verify rental exists and is active
      const rental = await storage.getRental(req.body.rentalId);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      if (rental.status !== "active") {
        return res.status(403).json({ error: "Messaging only available for active rentals" });
      }

      const validatedData = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(validatedData);
      res.status(201).json(message);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid message data" });
    }
  });

  app.patch("/api/messages/:id/read", async (req, res) => {
    try {
      const message = await storage.markMessageAsRead(req.params.id);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      res.json(message);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark message as read" });
    }
  });

  // Reviews
  app.get("/api/reviews/user/:userId", async (req, res) => {
    try {
      const reviews = await storage.getReviewsByUser(req.params.userId);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.get("/api/reviews/rental/:rentalId", async (req, res) => {
    try {
      const reviews = await storage.getReviewsByRental(req.params.rentalId);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.get("/api/rentals/:rentalId/can-review", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rental = await storage.getRental(req.params.rentalId);
      
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }

      // Only completed rentals can be reviewed
      if (rental.status !== "completed") {
        return res.json({ canReview: false, reason: "Rental must be completed" });
      }

      // Check if user is either the renter or owner
      const isParticipant = rental.renterId === userId || rental.ownerId === userId;
      if (!isParticipant) {
        return res.json({ canReview: false, reason: "Not a participant in this rental" });
      }

      // Check if user has already reviewed
      const hasReviewed = await storage.hasUserReviewedRental(req.params.rentalId, userId);
      if (hasReviewed) {
        return res.json({ canReview: false, reason: "Already reviewed" });
      }

      // Determine who should be reviewed (the other party)
      const revieweeId = rental.renterId === userId ? rental.ownerId : rental.renterId;
      
      res.json({ 
        canReview: true, 
        revieweeId,
        rental 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to check review eligibility" });
    }
  });

  app.post("/api/reviews", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Verify rental exists and is completed
      const rental = await storage.getRental(req.body.rentalId);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      if (rental.status !== "completed") {
        return res.status(400).json({ error: "Can only review completed rentals" });
      }

      // Verify user is participant
      const isParticipant = rental.renterId === userId || rental.ownerId === userId;
      if (!isParticipant) {
        return res.status(403).json({ error: "Not authorized to review this rental" });
      }

      // Verify user hasn't already reviewed
      const hasReviewed = await storage.hasUserReviewedRental(req.body.rentalId, userId);
      if (hasReviewed) {
        return res.status(400).json({ error: "Already reviewed this rental" });
      }

      // SERVER-SIDE DETERMINATION: reviewee is always the other party in the rental
      // This prevents client-side spoofing of revieweeId
      const revieweeId = rental.renterId === userId ? rental.ownerId : rental.renterId;

      // Validate and create review (exclude revieweeId from client input)
      const { revieweeId: clientRevieweeId, ...reviewData } = req.body;
      const validatedData = insertReviewSchema.parse({
        ...reviewData,
        reviewerId: userId,
        revieweeId, // Server-calculated, not from client
      });
      
      const review = await storage.createReview(validatedData);
      res.status(201).json(review);
    } catch (error: any) {
      console.error("Review creation error:", error);
      res.status(400).json({ error: error.message || "Invalid review data" });
    }
  });

  // Favorites
  app.post("/api/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body with Zod
      const validatedData = insertFavoriteSchema.parse({
        ...req.body,
        userId, // Server-side, not from client
      });

      const favorite = await storage.addFavorite(userId, validatedData.listingType, validatedData.listingId);
      res.status(201).json(favorite);
    } catch (error: any) {
      console.error("Add favorite error:", error);
      res.status(400).json({ error: error.message || "Failed to add favorite" });
    }
  });

  app.delete("/api/favorites/:listingType/:listingId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { listingType, listingId } = req.params;

      if (listingType !== "marketplace" && listingType !== "aircraft") {
        return res.status(400).json({ error: "listingType must be 'marketplace' or 'aircraft'" });
      }

      const removed = await storage.removeFavorite(userId, listingType, listingId);
      if (!removed) {
        return res.status(404).json({ error: "Favorite not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Remove favorite error:", error);
      res.status(500).json({ error: "Failed to remove favorite" });
    }
  });

  app.get("/api/favorites/check/:listingType/:listingId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { listingType, listingId } = req.params;

      if (listingType !== "marketplace" && listingType !== "aircraft") {
        return res.status(400).json({ error: "listingType must be 'marketplace' or 'aircraft'" });
      }

      const isFavorited = await storage.checkIfFavorited(userId, listingType, listingId);
      res.json({ isFavorited });
    } catch (error) {
      console.error("Check favorite error:", error);
      res.status(500).json({ error: "Failed to check favorite status" });
    }
  });

  app.get("/api/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const favorites = await storage.getUserFavorites(userId);
      res.json(favorites);
    } catch (error) {
      console.error("Get favorites error:", error);
      res.status(500).json({ error: "Failed to fetch favorites" });
    }
  });

  // Transactions
  app.get("/api/transactions/user/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = (req as any).user?.claims?.sub || (req.session as any)?.userId;
      const requestedUserId = req.params.userId;

      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (String(requesterId) !== String(requestedUserId)) {
        const requester = await storage.getUser(String(requesterId));
        if (!requester || (!requester.isAdmin && !requester.isSuperAdmin)) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      const transactions = await storage.getTransactionsByUser(requestedUserId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transactions", isAuthenticated, requireAnalyticsAdmin, async (req, res) => {
    try {
      const transaction = await storage.createTransaction(req.body);
      res.status(201).json(transaction);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid transaction data" });
    }
  });

  app.patch("/api/transactions/:id", isAuthenticated, requireAnalyticsAdmin, async (req, res) => {
    try {
      const transaction = await storage.updateTransaction(req.params.id, req.body);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ error: "Failed to update transaction" });
    }
  });

  // Verification Submissions
  app.post("/api/verification-submissions", 
    isAuthenticated, 
    upload.fields([
      { name: 'governmentIdFront', maxCount: 1 },
      { name: 'governmentIdBack', maxCount: 1 },
      { name: 'pilotCertificatePhoto', maxCount: 1 },
    ]), 
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        
        // Parse submission data from form
        const submissionData = JSON.parse(req.body.submissionData || '{}');
        const type = req.body.type || 'renter_identity';
        
        // In production, upload files to cloud storage (S3, Replit Object Storage, etc.)
        // For now, create placeholder URLs
        const documentUrls: string[] = [];
        
        if (files.governmentIdFront) {
          documentUrls.push(`/uploads/id-front-${userId}-${Date.now()}.jpg`);
        }
        if (files.governmentIdBack) {
          documentUrls.push(`/uploads/id-back-${userId}-${Date.now()}.jpg`);
        }
        if (files.pilotCertificatePhoto) {
          documentUrls.push(`/uploads/pilot-cert-${userId}-${Date.now()}.jpg`);
        }
        
        // Create verification submission
        const submission = await storage.createVerificationSubmission({
          userId,
          type,
          status: 'pending',
          aircraftId: null,
          submissionData,
          documentUrls,
          reviewedBy: null,
          reviewedAt: null,
          reviewNotes: null,
          rejectionReason: null,
          faaRegistryChecked: false,
          faaRegistryMatch: null,
          faaRegistryData: null,
          sources: [],
          fileHashes: [],
          pilotLicenseExpiresAt: null,
          medicalCertExpiresAt: null,
          insuranceExpiresAt: null,
          governmentIdExpiresAt: null,
          expirationNotificationSent: false,
          lastNotificationSentAt: null,
        });
        
        res.json(submission);
      } catch (error: any) {
        console.error("Verification submission error:", error);
        res.status(500).json({ error: error.message || "Failed to submit verification" });
      }
    }
  );

  app.get("/api/verification-submissions/user/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const targetUserId = req.params.userId;
      
      // Only allow users to view their own submissions (or admins)
      const requestingUser = await storage.getUser(requestingUserId);
      if (requestingUserId !== targetUserId && !requestingUser?.isAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const submissions = await storage.getVerificationSubmissionsByUser(targetUserId);
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch verification submissions" });
    }
  });

  app.get("/api/verification-submissions/pending", isAuthenticated, requireVerificationsAdmin, async (req, res) => {
    try {
      // Disable caching for admin verification data
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const submissions = await storage.getPendingVerificationSubmissions();
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending verifications" });
    }
  });

  app.patch("/api/verification-submissions/:id", isAuthenticated, requireVerificationsAdmin, async (req: any, res) => {
    try {
      const reviewerId = req.user.claims.sub;
      const updates = {
        ...req.body,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      };
      
      const submission = await storage.updateVerificationSubmission(req.params.id, updates);
      
      if (!submission) {
        return res.status(404).json({ error: "Verification submission not found" });
      }
      
      // If approved, update user verification status
      if (req.body.status === 'approved') {
        if (submission.type === 'renter_identity') {
          const submissionData = submission.submissionData as any;
          await storage.updateUser(submission.userId, {
            legalFirstName: submissionData.legalFirstName,
            legalLastName: submissionData.legalLastName,
            dateOfBirth: submissionData.dateOfBirth,
            identityVerified: true,
            identityVerifiedAt: new Date(),
            isVerified: true, // Legacy field
          });
          
          // If FAA data provided, update that too
          if (submissionData.faaCertificateNumber) {
            await storage.updateUser(submission.userId, {
              faaCertificateNumber: submissionData.faaCertificateNumber,
              pilotCertificateName: submissionData.pilotCertificateName,
              faaVerified: true,
              faaVerifiedMonth: new Date().toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' }),
              faaVerifiedAt: new Date(),
            });
          }
        } else if (submission.type === 'owner_aircraft' && submission.aircraftId) {
          // Approve owner/aircraft verification - publish the listing
          await storage.updateAircraftListing(submission.aircraftId, {
            ownershipVerified: true,
            maintenanceVerified: true,
            maintenanceVerifiedAt: new Date(),
            isListed: true, // Publish the listing
          });
        }
      }
      
      res.json(submission);
    } catch (error) {
      res.status(500).json({ error: "Failed to update verification submission" });
    }
  });

  // Withdrawal Requests (PayPal Payouts)
  app.get("/api/balance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const balance = await storage.getUserBalance(userId);
      res.json({ balance });
    } catch (error) {
      console.error("Error fetching user balance:", error);
      res.status(500).json({ error: "Failed to fetch balance" });
    }
  });

  app.post("/api/withdrawals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, paypalEmail } = req.body;

      // Validate inputs
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "Invalid withdrawal amount" });
      }

      if (!paypalEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail)) {
        return res.status(400).json({ error: "Valid PayPal email is required" });
      }

      // Check if user has sufficient balance
      const userBalance = parseFloat(await storage.getUserBalance(userId));
      if (userBalance < parsedAmount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // Deduct amount from user balance atomically before processing
      await storage.deductFromUserBalance(userId, parsedAmount);

      // Create initial withdrawal request  
      const request = await storage.createWithdrawalRequest({
        userId,
        amount: amount.toString(),
        paypalEmail
      });

      // Update to processing status
      await storage.updateWithdrawalRequest(request.id, { status: "processing" });

      // Automatically process payout via PayPal
      try {
        const { sendPayout } = await import("./paypal-payouts");
        const payoutResult = await sendPayout({
          recipientEmail: paypalEmail,
          amount: parsedAmount,
          senderItemId: request.id,
          note: `Withdrawal request ${request.id}`,
          emailSubject: "You've received a payout from Ready Set Fly",
          emailMessage: "Your rental earnings have been sent to your PayPal account."
        });

        if (payoutResult.success) {
          // Update withdrawal with success status and PayPal details
          const completedRequest = await storage.updateWithdrawalRequest(request.id, {
            status: "completed",
            payoutBatchId: payoutResult.batchId,
            payoutItemId: payoutResult.itemId,
            transactionId: payoutResult.transactionId,
            processedAt: new Date()
          });

          logDebug(`[PAYOUT SUCCESS] User ${userId} withdrawal ${request.id}: $${parsedAmount} sent to ${paypalEmail}`);
          res.json(completedRequest);
        } else {
          // Payout failed - refund user balance
          await storage.addToUserBalance(userId, parsedAmount);
          await storage.updateWithdrawalRequest(request.id, {
            status: "failed",
            failureReason: payoutResult.error,
            processedAt: new Date()
          });

          console.error(`[PAYOUT FAILED] User ${userId} withdrawal ${request.id}: ${payoutResult.error}`);
          res.status(400).json({ 
            error: `Payout failed: ${payoutResult.error}. Your balance has been refunded.`
          });
        }
      } catch (payoutError: any) {
        // Exception during payout - refund balance and mark as failed
        await storage.addToUserBalance(userId, parsedAmount);
        await storage.updateWithdrawalRequest(request.id, {
          status: "failed",
          failureReason: payoutError.message,
          processedAt: new Date()
        });

        console.error(`[PAYOUT ERROR] User ${userId} withdrawal ${request.id}:`, payoutError);
        res.status(500).json({ 
          error: `Payout processing error: ${payoutError.message}. Your balance has been refunded.`
        });
      }
    } catch (error: any) {
      console.error("Error creating withdrawal request:", error);
      res.status(500).json({ error: error.message || "Failed to create withdrawal request" });
    }
  });

  app.get("/api/withdrawals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getWithdrawalRequestsByUser(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching withdrawal requests:", error);
      res.status(500).json({ error: "Failed to fetch withdrawal requests" });
    }
  });

  // Admin routes
  app.get("/api/admin/users", isAuthenticated, requireUsersAdmin, async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      // searchUsers already sanitizes sensitive fields at the storage layer
      const users = query ? await storage.searchUsers(query) : [];
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  // Get specific user details (admin)
  app.get("/api/admin/users/:userId", isAuthenticated, requireUsersAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // Get user's aircraft listings (admin)
  app.get("/api/admin/users/:userId/aircraft", isAuthenticated, requireUsersAdmin, async (req, res) => {
    try {
      const listings = await storage.getAircraftListingsByOwner(req.params.userId);
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user's aircraft listings" });
    }
  });

  // Get user's marketplace listings (admin)
  app.get("/api/admin/users/:userId/marketplace", isAuthenticated, requireUsersAdmin, async (req, res) => {
    try {
      const listings = await storage.getMarketplaceListingsByUser(req.params.userId);
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user's marketplace listings" });
    }
  });

  // Get user's verification submissions (admin)
  app.get("/api/admin/users/:userId/verifications", isAuthenticated, requireVerificationsAdmin, async (req, res) => {
    try {
      const verifications = await storage.getVerificationSubmissionsByUser(req.params.userId);
      res.json(verifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user's verification submissions" });
    }
  });

  // Reset user password (admin)
  app.post("/api/admin/users/:userId/reset-password", isAuthenticated, requireUsersAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // In a real implementation, this would send a password reset email
      // For now, we'll just return success
      // TODO: Integrate with email service to send password reset link
      
      res.json({ 
        success: true, 
        message: "Password reset email would be sent to user",
        email: user.email 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to initiate password reset" });
    }
  });

  // Update user (admin) - for verification toggles and admin status
  app.patch("/api/admin/users/:userId", isAuthenticated, requireUsersAdmin, async (req, res) => {
    try {
      const requestingUserId = (req as any).user?.claims?.sub || (req as any).session?.userId;
      const requestingUser = requestingUserId ? await storage.getUser(String(requestingUserId)) : null;
      if (!requestingUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const updates = { ...req.body };
      const touchingAdminFields =
        "isAdmin" in updates ||
        "isSuperAdmin" in updates ||
        "adminRole" in updates ||
        "adminPermissions" in updates;

      if (touchingAdminFields && !requestingUser.isSuperAdmin) {
        return res.status(403).json({ error: "Super Admin required to manage admin roles" });
      }

      const user = await storage.updateUser(req.params.userId, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Grant or revoke CFI support access (Super Admin only)
  app.post("/api/admin/users/:userId/cfi-grant", isAuthenticated, requireUsersAdmin, async (req: any, res) => {
    try {
      const adminId = req.user?.claims?.sub || req.session?.userId;
      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const admin = await storage.getUser(String(adminId));
      if (!admin || !admin.isSuperAdmin) {
        return res.status(403).json({ error: "Super Admin required" });
      }

      const targetUser = await storage.getUser(req.params.userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const action = String(req.body?.action || "grant").toLowerCase();
      if (action === "revoke") {
        const updated = await storage.updateUser(req.params.userId, {
          cfiGrantEndsAt: null,
          cfiGrantGrantedBy: adminId,
          cfiGrantGrantedAt: new Date(),
        });
        return res.json({ cfiGrantEndsAt: null, user: updated });
      }

      const durationDays = Number(req.body?.durationDays || 30);
      const now = new Date();
      const grantEndsAt = addDays(now, durationDays);
      const updated = await storage.updateUser(req.params.userId, {
        cfiGrantEndsAt: grantEndsAt,
        cfiGrantGrantedBy: adminId,
        cfiGrantGrantedAt: now,
      });

      res.json({ cfiGrantEndsAt: grantEndsAt.toISOString(), user: updated });
    } catch (error) {
      console.error("Error granting CFI access:", error);
      res.status(500).json({ error: "Failed to grant CFI access" });
    }
  });

  const adminInviteSchema = z.object({
    email: z.string().email(),
    role: z.enum(["operations", "finance", "sales", "support", "content", "housekeeping"]),
    permissions: z.array(z.string()).optional(),
  });

  app.get("/api/admin/invites", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      const invites = await storage.listAdminInvites();
      res.json(invites);
    } catch (error) {
      res.status(500).json({ error: "Failed to load admin invites" });
    }
  });

  app.get("/api/admin/admins", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      const admins = await storage.getAdminUsers();
      res.json(admins);
    } catch (error) {
      res.status(500).json({ error: "Failed to load admin users" });
    }
  });

  app.post("/api/admin/invites", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const result = adminInviteSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }

      const requestingUserId = req.user?.claims?.sub || req.session?.userId;
      if (!requestingUserId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { email, role, permissions } = result.data;
      const normalizedEmail = email.toLowerCase();
      const normalizedPermissions = normalizeAdminPermissions(role, permissions ?? null);

      const existingUser = await storage.getUserByEmail(normalizedEmail);
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invite = await storage.createAdminInvite({
        email: normalizedEmail,
        role,
        permissions: normalizedPermissions,
        token,
        invitedBy: String(requestingUserId),
        expiresAt,
      });

      if (existingUser) {
        await storage.updateUser(existingUser.id, {
          isAdmin: true,
          adminRole: role,
          adminPermissions: normalizedPermissions,
        });
        await storage.acceptAdminInvite(invite.id, existingUser.id);
      }

      try {
        const { sendAdminInviteEmail } = await import("./email-templates");
        await sendAdminInviteEmail({
          email: normalizedEmail,
          inviteToken: token,
          role,
        });
      } catch (emailError) {
        console.error("Failed to send admin invite email:", emailError);
      }

      res.json({ success: true, invite });
    } catch (error) {
      res.status(500).json({ error: "Failed to create admin invite" });
    }
  });

  app.post("/api/admin/invites/accept", isAuthenticated, async (req: any, res) => {
    try {
      const token = String(req.body?.token || "");
      if (!token) {
        return res.status(400).json({ error: "Missing invite token" });
      }

      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(String(userId));
      if (!user || !user.email) {
        return res.status(400).json({ error: "User email required to accept invite" });
      }

      const invite = await storage.getAdminInviteByToken(token);
      if (!invite) {
        return res.status(404).json({ error: "Invite not found" });
      }
      if (invite.acceptedAt) {
        return res.status(409).json({ error: "Invite already used" });
      }
      if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
        return res.status(410).json({ error: "Invite expired" });
      }
      if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
        return res.status(403).json({ error: "Invite email does not match your account" });
      }

      await storage.acceptAdminInvite(invite.id, user.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to accept invite" });
    }
  });

  app.get("/api/admin/aircraft", isAuthenticated, requireAircraftAdmin, async (req, res) => {
    try {
      // Note: getAllAircraftListings already has reasonable limits in storage layer
      const listings = await storage.getAllAircraftListings();
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch aircraft listings" });
    }
  });

  app.get("/api/admin/marketplace", isAuthenticated, requireMarketplaceAdmin, async (req, res) => {
    try {
      // Note: getAllMarketplaceListings already has reasonable limits in storage layer
      const listings = await storage.getAllMarketplaceListings();
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch marketplace listings" });
    }
  });

  // Issue an admin-only free listing token (used to create free listings for content/testing)
  app.post("/api/admin/marketplace/free-listing-token", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const requesterId = req.user?.claims?.sub || req.session?.userId;
      const requestedUserId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
      const requestedEmail = typeof req.body?.email === "string" ? req.body.email.trim() : "";
      const allowEmailOnly = Boolean(req.body?.allowEmailOnly);
      const durationDays = Math.min(Math.max(Number(req.body?.durationDays) || 30, 1), 90);

      let targetUserId = requestedUserId || "";
      let targetEmail = requestedEmail || "";

      let fallbackToAdmin = false;
      if (!targetUserId && targetEmail) {
        const byEmail = await storage.getUserByEmail(targetEmail);
        if (!byEmail) {
          if (!allowEmailOnly) {
            return res.status(404).json({ error: "User not found for the provided email" });
          }
          fallbackToAdmin = true;
        } else {
          targetUserId = byEmail.id;
          targetEmail = byEmail.email || targetEmail;
        }
      }

      if (targetUserId) {
        const targetUser = await storage.getUser(String(targetUserId));
        if (!targetUser) {
          return res.status(404).json({ error: "User not found for the provided user ID" });
        }
        if (!targetEmail) {
          targetEmail = targetUser.email || "";
        }
      }

      const finalUserId = targetUserId || requesterId;
      if (!targetUserId && targetEmail) {
        fallbackToAdmin = true;
      }

      const token = jwt.sign({
        type: 'admin-free-marketplace-listing',
        userId: finalUserId,
        targetEmail: targetEmail || undefined,
        issuedBy: requesterId,
        durationDays,
        originalAmount: '0',
        discountAmount: '0',
        issuedAt: Date.now(),
      }, process.env.SESSION_SECRET || 'dev-secret', { expiresIn: '2h' });

      res.json({
        token,
        durationDays,
        userId: finalUserId,
        email: targetEmail || undefined,
        fallbackToAdmin,
      });
    } catch (error: any) {
      console.error('Failed to issue admin free listing token:', error);
      res.status(500).json({ error: error.message || 'Failed to issue token' });
    }
  });

  // Update aircraft listing (admin actions)
  app.patch("/api/admin/aircraft/:id", isAuthenticated, requireAircraftAdmin, async (req, res) => {
    try {
      const { isListed, isFeatured, adminNotes } = req.body;
      const updates: any = {};
      
      if (typeof isListed === 'boolean') updates.isListed = isListed;
      if (typeof isFeatured === 'boolean') updates.isFeatured = isFeatured;
      if (adminNotes !== undefined) updates.adminNotes = adminNotes;
      
      const aircraft = await storage.updateAircraftListing(req.params.id, updates);
      if (!aircraft) {
        return res.status(404).json({ error: "Aircraft listing not found" });
      }
      res.json(aircraft);
    } catch (error) {
      console.error("Error updating aircraft listing:", error);
      res.status(500).json({ error: "Failed to update aircraft listing" });
    }
  });

  // Update marketplace listing (admin actions)
  app.patch("/api/admin/marketplace/:id", isAuthenticated, requireMarketplaceAdmin, async (req, res) => {
    try {
      const { isActive, isFeatured, adminNotes, expiresAt } = req.body;
      const updates: any = {};
      
      if (typeof isActive === 'boolean') updates.isActive = isActive;
      if (typeof isFeatured === 'boolean') updates.isFeatured = isFeatured;
      if (adminNotes !== undefined) updates.adminNotes = adminNotes;
      if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
      
      const listing = await storage.updateMarketplaceListing(req.params.id, updates);
      if (!listing) {
        return res.status(404).json({ error: "Marketplace listing not found" });
      }
      res.json(listing);
    } catch (error) {
      console.error("Error updating marketplace listing:", error);
      res.status(500).json({ error: "Failed to update marketplace listing" });
    }
  });

  // Analytics events (guest-safe)
  type AnalyticsEventInput = z.infer<typeof insertAnalyticsEventSchema>;
  const analyticsQueue: AnalyticsEventInput[] = [];
  const ANALYTICS_QUEUE_LIMIT = 500;
  const ANALYTICS_FLUSH_INTERVAL_MS = 1500;
  let analyticsFlushInProgress = false;
  let analyticsFlushTimer: NodeJS.Timeout | null = null;

  const flushAnalyticsQueue = async () => {
    if (analyticsFlushInProgress || analyticsQueue.length === 0) return;
    analyticsFlushInProgress = true;
    const batch = analyticsQueue.splice(0, 25);
    try {
      for (const item of batch) {
        await storage.createAnalyticsEvent(item);
      }
    } catch (error) {
      console.warn("Analytics flush failed:", error);
    } finally {
      analyticsFlushInProgress = false;
    }
  };

  if (!analyticsFlushTimer) {
    analyticsFlushTimer = setInterval(() => {
      void flushAnalyticsQueue();
    }, ANALYTICS_FLUSH_INTERVAL_MS);
  }

  app.post("/api/analytics/event", async (req: any, res) => {
    try {
      const event = typeof req.body?.event === "string" ? req.body.event.trim() : "";
      if (!event) {
        return res.status(400).json({ error: "Event is required" });
      }

      const params = req.body?.params && typeof req.body.params === "object" ? req.body.params : undefined;
      const page = deriveAnalyticsPage(event, req.body?.page, params);
      let visitorId = typeof req.body?.visitorId === "string" ? req.body.visitorId.trim() : "";
      if (!visitorId) visitorId = crypto.randomUUID();

      const parsed = insertAnalyticsEventSchema.safeParse({
        event,
        page,
        visitorId,
        userId: req.user?.claims?.sub,
        meta: params,
      });

      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid analytics payload" });
      }

      while (analyticsQueue.length >= ANALYTICS_QUEUE_LIMIT) {
        analyticsQueue.shift();
      }
      analyticsQueue.push(parsed.data);
      res.json({ success: true, visitorId: parsed.data.visitorId });
    } catch (error) {
      console.error("Failed to record analytics event:", error);
      res.status(500).json({ error: "Failed to record analytics event" });
    }
  });

  app.post("/api/analytics/session", async (req: any, res) => {
    try {
      const page = normalizeAnalyticsPage(req.body?.page) || "/";
      let visitorId = typeof req.body?.visitorId === "string" ? req.body.visitorId.trim() : "";
      if (!visitorId) visitorId = crypto.randomUUID();
      const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
      const meta = {
        sessionId: sessionId || undefined,
        userAgent: req.headers["user-agent"],
        ip: req.headers["x-forwarded-for"] || req.ip,
        referrer: req.headers["referer"] || req.headers["referrer"],
      };

      const parsed = insertAnalyticsEventSchema.safeParse({
        event: "session_ping",
        page,
        visitorId,
        userId: req.user?.claims?.sub,
        meta,
      });

      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid session payload" });
      }

      while (analyticsQueue.length >= ANALYTICS_QUEUE_LIMIT) {
        analyticsQueue.shift();
      }
      analyticsQueue.push(parsed.data);
      res.json({ success: true, visitorId: parsed.data.visitorId });
    } catch (error) {
      console.error("Failed to record session ping:", error);
      res.status(500).json({ error: "Failed to record session ping" });
    }
  });

  const sanitizeOutboundParam = (value: unknown, fallback: string) => {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim().toLowerCase();
    const cleaned = trimmed.replace(/[^a-z0-9_-]/g, "");
    return cleaned || fallback;
  };

  const buildOutboundRedirectUrl = (baseUrl: string, params: Record<string, string>) => {
    try {
      const url = new URL(baseUrl);
      Object.entries(params).forEach(([key, val]) => {
        if (val) {
          url.searchParams.set(key, val);
        }
      });
      return url.toString();
    } catch (error) {
      console.warn("Invalid partner base URL:", baseUrl, error);
      return baseUrl;
    }
  };

  const resolvePartnerDestination = (partnerConfig: typeof partners.av8maps, destKey: string | null) => {
    if (!destKey || !partnerConfig?.paths) return partnerConfig.baseUrl;
    const path = partnerConfig.paths[destKey];
    if (!path) return partnerConfig.baseUrl;
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }
    try {
      return new URL(path, partnerConfig.baseUrl).toString();
    } catch {
      return partnerConfig.baseUrl;
    }
  };

  app.get("/out/av8maps", async (req: any, res) => {
    const partner = partners.av8maps;
    if (!partner?.active) {
      return res.status(403).json({ error: "partner_inactive" });
    }
    if (!partner?.baseUrl) {
      return res.status(500).json({ error: "partner_unavailable" });
    }

    const source = sanitizeOutboundParam(req.query.src, "home_featured_partner");
    const content = sanitizeOutboundParam(req.query.utm_content, "cta");
    const destKey = sanitizeOutboundParam(req.query.dest, "");

    const destination = resolvePartnerDestination(partner, destKey || null);
    const redirectUrl = buildOutboundRedirectUrl(destination, {
      utm_source: partner.utm.source || "readysetfly",
      utm_medium: partner.utm.medium || "featured_partner",
      utm_campaign: partner.utm.campaign || "av8maps_partner",
      utm_content: content,
    });

    const userId = req.user?.claims?.sub || req.session?.userId || null;
    const sessionId = typeof req.sessionID === "string" ? req.sessionID : null;
    const ip = String(req.headers["x-forwarded-for"] || req.ip || "");
    const ipHash = ip ? crypto.createHash("sha256").update(ip).digest("hex").slice(0, 12) : undefined;
    const meta = {
      partner: "av8maps",
      placement: "home_featured_partner_card",
      source,
      utm_content: content,
      session_id: sessionId || undefined,
    };

    console.log(JSON.stringify({
      event: "partner_click",
      partner: "av8maps",
      source,
      utm_content: content,
      user_id: userId || undefined,
      session_id: sessionId || undefined,
      ipHash,
    }));

    const visitorId = sessionId || crypto.randomUUID();
    const analyticsRecord = insertAnalyticsEventSchema.safeParse({
      event: "partner_click",
      page: "/",
      visitorId,
      userId: userId || undefined,
      meta,
    });

    const redirectRecord = insertPartnerRedirectSchema.safeParse({
      partner: "av8maps",
      userId: userId || undefined,
      sessionId: sessionId || undefined,
    });

    setImmediate(() => {
      if (analyticsRecord.success) {
        void storage.createAnalyticsEvent(analyticsRecord.data).catch((error) => {
          console.warn("Failed to record partner click analytics:", error);
        });
      }
      if (redirectRecord.success) {
        void db.insert(partnerRedirects).values(redirectRecord.data).catch((error) => {
          console.warn("Failed to record partner redirect:", error);
        });
      }
    });

    return res.redirect(302, redirectUrl);
  });

  app.get("/api/partner/redirect", async (req: any, res) => {
    const rawPartner = Array.isArray(req.query.partner) ? req.query.partner[0] : req.query.partner;
    const partnerKey = typeof rawPartner === "string" ? rawPartner.trim().toLowerCase() : "";
    if (!partnerKey) {
      return res.status(400).json({ error: "partner_required" });
    }

    const partner = partners[partnerKey];
    if (!partner) {
      return res.status(400).json({ error: "invalid_partner" });
    }
    if (!partner.active) {
      return res.status(403).json({ error: "partner_inactive" });
    }

    const userId = req.user?.claims?.sub || req.session?.userId || null;
    const sessionId = typeof req.sessionID === "string" ? req.sessionID : null;
    const ip = String(req.headers["x-forwarded-for"] || req.ip || "");
    const ipHash = ip ? crypto.createHash("sha256").update(ip).digest("hex").slice(0, 12) : undefined;
    const meta = {
      partner: partnerKey,
      session_id: sessionId || undefined,
      source: "featured_card",
    };

    console.log(JSON.stringify({
      event: "partner_redirect",
      partner: partnerKey,
      user_id: userId || undefined,
      session_id: sessionId || undefined,
      source: "featured_card",
      ipHash,
    }));

    const visitorId = sessionId || crypto.randomUUID();
    const analyticsRecord = insertAnalyticsEventSchema.safeParse({
      event: "partner_redirect",
      page: "/pilot-tools",
      visitorId,
      userId: userId || undefined,
      meta,
    });

    const redirectRecord = insertPartnerRedirectSchema.safeParse({
      partner: partnerKey,
      userId: userId || undefined,
      sessionId: sessionId || undefined,
    });

    setImmediate(() => {
      if (analyticsRecord.success) {
        void storage.createAnalyticsEvent(analyticsRecord.data).catch((error) => {
          console.warn("Failed to record partner redirect analytics:", error);
        });
      }
      if (redirectRecord.success) {
        void db.insert(partnerRedirects).values(redirectRecord.data).catch((error) => {
          console.warn("Failed to record partner redirect:", error);
        });
      }
    });

    return res.redirect(302, partner.redirectUrl);
  });

  app.post("/api/partner-tools/:partner/impression", async (req, res) => {
    try {
      const partnerKey = String(req.params.partner || "").trim().toLowerCase();
      if (!partnerKey || !partners[partnerKey]) {
        return res.status(400).json({ error: "invalid_partner" });
      }
      await storage.incrementPartnerToolImpressions(partnerKey);
      res.json({ success: true });
    } catch (error) {
      console.error("Partner tool impression error:", error);
      res.status(500).json({ error: "Failed to record impression" });
    }
  });

  app.post("/api/partner-tools/:partner/click", async (req, res) => {
    try {
      const partnerKey = String(req.params.partner || "").trim().toLowerCase();
      if (!partnerKey || !partners[partnerKey]) {
        return res.status(400).json({ error: "invalid_partner" });
      }
      await storage.incrementPartnerToolClicks(partnerKey);
      res.json({ success: true });
    } catch (error) {
      console.error("Partner tool click error:", error);
      res.status(500).json({ error: "Failed to record click" });
    }
  });

  // Admin Analytics
  app.get("/api/admin/analytics", isAuthenticated, requireAnalyticsAdmin, async (req, res) => {
    try {
      const analytics = await storage.getAnalytics();
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Admin Feature Usage (engagement)
  app.get("/api/admin/feature-usage", isAuthenticated, requireAnalyticsAdmin, async (req, res) => {
    try {
      const daysParam = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
      const days = Number(daysParam ?? 7);
      const usage = await storage.getFeatureUsage(days);
      res.json(usage);
    } catch (error) {
      console.error("Failed to fetch feature usage:", error);
      const daysParam = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
      const rangeDays = Number(daysParam ?? 7);
      res.json({
        rangeDays,
        totalEvents: 0,
        uniqueVisitors: 0,
        returningVisitors: 0,
        guestEvents: 0,
        guestVisitors: 0,
        pages: [],
      });
    }
  });

  // User Metrics (Admin only)
  app.get("/api/admin/user-metrics", isAuthenticated, requireAnalyticsAdmin, async (req, res) => {
    try {
      const [userMetrics, geographic, retention] = await Promise.all([
        storage.getUserMetrics(),
        storage.getGeographicDistribution(),
        storage.getUserRetentionMetrics()
      ]);
      
      res.json({
        ...userMetrics,
        geographic,
        retention
      });
    } catch (error) {
      console.error("Error fetching user metrics:", error);
      res.status(500).json({ error: "Failed to fetch user metrics" });
    }
  });

  // Admin - Withdrawal Requests
  app.get("/api/admin/withdrawals", isAuthenticated, requireWithdrawalsAdmin, async (req, res) => {
    try {
      const requests = await storage.getAllWithdrawalRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching withdrawal requests:", error);
      res.status(500).json({ error: "Failed to fetch withdrawal requests" });
    }
  });

  app.get("/api/admin/withdrawals/pending", isAuthenticated, requireWithdrawalsAdmin, async (req, res) => {
    try {
      const requests = await storage.getPendingWithdrawalRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching pending withdrawals:", error);
      res.status(500).json({ error: "Failed to fetch pending withdrawals" });
    }
  });

  app.post("/api/admin/withdrawals/:id/process", isAuthenticated, requireWithdrawalsAdmin, async (req: any, res) => {
    try {
      const withdrawalId = req.params.id;
      const adminId = req.user.claims.sub;

      // Get withdrawal request
      const withdrawal = await storage.getWithdrawalRequest(withdrawalId);
      if (!withdrawal) {
        return res.status(404).json({ error: "Withdrawal request not found" });
      }

      if (withdrawal.status !== "pending") {
        return res.status(400).json({ error: "Withdrawal request is not pending" });
      }

      // Update status to processing
      await storage.updateWithdrawalRequest(withdrawalId, {
        status: "processing",
        processedBy: adminId,
        processedAt: new Date()
      });

      // Send payout via PayPal
      const { sendPayout } = await import("./paypal-payouts");
      const payoutResult = await sendPayout({
        recipientEmail: withdrawal.paypalEmail,
        amount: parseFloat(withdrawal.amount),
        senderItemId: withdrawalId,
        note: `Withdrawal request ${withdrawalId}`,
        emailSubject: "You've received a payout from Ready Set Fly",
        emailMessage: "Your rental earnings have been sent to your PayPal account."
      });

      if (payoutResult.success) {
        // Update withdrawal with PayPal details
        await storage.updateWithdrawalRequest(withdrawalId, {
          status: "completed",
          payoutBatchId: payoutResult.batchId,
          payoutItemId: payoutResult.itemId,
          transactionId: payoutResult.transactionId
        });

        res.json({
          success: true,
          message: "Payout sent successfully",
          withdrawal: await storage.getWithdrawalRequest(withdrawalId)
        });
      } else {
        // Payout failed - refund user balance and mark as failed
        await storage.addToUserBalance(withdrawal.userId, parseFloat(withdrawal.amount));
        await storage.updateWithdrawalRequest(withdrawalId, {
          status: "failed",
          failureReason: payoutResult.error
        });

        res.status(400).json({
          success: false,
          error: payoutResult.error,
          message: "Payout failed, user balance has been refunded"
        });
      }
    } catch (error: any) {
      console.error("Error processing withdrawal:", error);
      res.status(500).json({ error: error.message || "Failed to process withdrawal" });
    }
  });

  app.patch("/api/admin/withdrawals/:id", isAuthenticated, requireWithdrawalsAdmin, async (req: any, res) => {
    try {
      const withdrawalId = req.params.id;
      const { status, adminNotes } = req.body;

      const withdrawal = await storage.getWithdrawalRequest(withdrawalId);
      if (!withdrawal) {
        return res.status(404).json({ error: "Withdrawal request not found" });
      }

      // If cancelling, refund user balance
      if (status === "cancelled" && withdrawal.status === "pending") {
        await storage.addToUserBalance(withdrawal.userId, parseFloat(withdrawal.amount));
      }

      const updated = await storage.updateWithdrawalRequest(withdrawalId, {
        status,
        adminNotes,
        processedBy: req.user.claims.sub,
        processedAt: new Date()
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating withdrawal:", error);
      res.status(500).json({ error: error.message || "Failed to update withdrawal" });
    }
  });

  // Stale & Orphaned Listings Management (Admin only)
  app.get("/api/admin/stale-listings", isAuthenticated, requireStaleAdmin, async (req, res) => {
    try {
      const daysStale = parseInt(req.query.days as string) || 60;
      const [staleAircraft, staleMarketplace] = await Promise.all([
        storage.getStaleAircraftListings(daysStale),
        storage.getStaleMarketplaceListings(daysStale)
      ]);
      
      res.json({
        aircraft: staleAircraft,
        marketplace: staleMarketplace,
        totalCount: staleAircraft.length + staleMarketplace.length
      });
    } catch (error) {
      console.error("Error fetching stale listings:", error);
      res.status(500).json({ error: "Failed to fetch stale listings" });
    }
  });

  app.get("/api/admin/orphaned-listings", isAuthenticated, requireStaleAdmin, async (req, res) => {
    try {
      const [orphanedAircraft, orphanedMarketplace] = await Promise.all([
        storage.getOrphanedAircraftListings(),
        storage.getOrphanedMarketplaceListings()
      ]);
      
      res.json({
        aircraft: orphanedAircraft,
        marketplace: orphanedMarketplace,
        totalCount: orphanedAircraft.length + orphanedMarketplace.length
      });
    } catch (error) {
      console.error("Error fetching orphaned listings:", error);
      res.status(500).json({ error: "Failed to fetch orphaned listings" });
    }
  });

  app.post("/api/admin/send-listing-reminders", isAuthenticated, requireStaleAdmin, async (req, res) => {
    try {
      const { getUncachableResendClient } = await import('./resendClient');
      const { getListingReminderEmailHtml, getListingReminderEmailText } = await import('./email-templates');
      
      const usersWithListings = await storage.getUsersWithActiveListings();
      const { client, fromEmail } = await getUncachableResendClient();
      
      let successCount = 0;
      let failureCount = 0;
      const errors: string[] = [];

      for (const { user, aircraftCount, marketplaceCount } of usersWithListings) {
        if (!user.email) {
          failureCount++;
          errors.push(`User ${user.id} has no email`);
          continue;
        }

        try {
          await client.emails.send({
            from: fromEmail,
            to: user.email,
            subject: `📋 Monthly Listing Review - ${aircraftCount + marketplaceCount} Active Listing${aircraftCount + marketplaceCount === 1 ? '' : 's'}`,
            html: getListingReminderEmailHtml(user.firstName || 'Pilot', aircraftCount, marketplaceCount),
            text: getListingReminderEmailText(user.firstName || 'Pilot', aircraftCount, marketplaceCount),
          });
          successCount++;
        } catch (emailError: any) {
          failureCount++;
          errors.push(`Failed to send to ${user.email}: ${emailError.message}`);
          console.error(`Error sending email to ${user.email}:`, emailError);
        }
      }

      res.json({
        success: true,
        totalUsers: usersWithListings.length,
        emailsSent: successCount,
        emailsFailed: failureCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error: any) {
      console.error("Error sending listing reminders:", error);
      res.status(500).json({ error: error.message || "Failed to send listing reminders" });
    }
  });

  // Refresh Listings (User endpoints)
  app.patch("/api/aircraft/:id/refresh", isAuthenticated, async (req: any, res) => {
    try {
      const aircraft = await storage.getAircraftListing(req.params.id);
      if (!aircraft) {
        return res.status(404).json({ error: "Aircraft listing not found" });
      }

      // Get user from session
      const sessionUserId = req.user.claims.sub;
      const user = await storage.getUser(sessionUserId);
      
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Verify ownership
      if (aircraft.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ error: "Not authorized to refresh this listing" });
      }

      const updated = await storage.refreshAircraftListing(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error refreshing aircraft listing:", error);
      res.status(500).json({ error: "Failed to refresh aircraft listing" });
    }
  });

  app.patch("/api/marketplace/:id/refresh", isAuthenticated, async (req: any, res) => {
    try {
      const listing = await storage.getMarketplaceListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Marketplace listing not found" });
      }

      // Get user from session
      const sessionUserId = req.user.claims.sub;
      const user = await storage.getUser(sessionUserId);
      
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Verify ownership
      if (listing.userId !== user.id && !user.isAdmin) {
        return res.status(403).json({ error: "Not authorized to refresh this listing" });
      }

      const updated = await storage.refreshMarketplaceListing(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error refreshing marketplace listing:", error);
      res.status(500).json({ error: "Failed to refresh marketplace listing" });
    }
  });

  // CRM - Leads (Admin only)
  app.get("/api/crm/leads", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const leads = await storage.getAllLeads();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  app.post("/api/crm/leads", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const lead = await storage.createLead(req.body);
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: "Failed to create lead" });
    }
  });

  app.patch("/api/crm/leads/:id", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const lead = await storage.updateLead(req.params.id, req.body);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  app.delete("/api/crm/leads/:id", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const success = await storage.deleteLead(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  // CRM - Contacts (Admin only)
  app.get("/api/crm/contacts", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const contacts = await storage.getAllContacts();
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.post("/api/crm/contacts", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const contact = await storage.createContact(req.body);
      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  app.patch("/api/crm/contacts/:id", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const contact = await storage.updateContact(req.params.id, req.body);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  app.delete("/api/crm/contacts/:id", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const success = await storage.deleteContact(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });

  // CRM - Deals (Admin only)
  app.get("/api/crm/deals", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const deals = await storage.getAllDeals();
      res.json(deals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deals" });
    }
  });

  app.post("/api/crm/deals", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const deal = await storage.createDeal(req.body);
      res.json(deal);
    } catch (error) {
      res.status(500).json({ error: "Failed to create deal" });
    }
  });

  app.patch("/api/crm/deals/:id", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const deal = await storage.updateDeal(req.params.id, req.body);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json(deal);
    } catch (error) {
      res.status(500).json({ error: "Failed to update deal" });
    }
  });

  app.delete("/api/crm/deals/:id", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const success = await storage.deleteDeal(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete deal" });
    }
  });

  // CRM - Activities (Admin only)
  app.get("/api/crm/activities", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const activities = await storage.getAllActivities();
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  app.post("/api/crm/activities", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const activity = await storage.createActivity(req.body);
      res.json(activity);
    } catch (error) {
      res.status(500).json({ error: "Failed to create activity" });
    }
  });

  app.patch("/api/crm/activities/:id", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const activity = await storage.updateActivity(req.params.id, req.body);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }
      res.json(activity);
    } catch (error) {
      res.status(500).json({ error: "Failed to update activity" });
    }
  });

  app.delete("/api/crm/activities/:id", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const success = await storage.deleteActivity(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Activity not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete activity" });
    }
  });

  // Expenses (Admin only - for analytics tracking)
  app.get("/api/admin/expenses", isAuthenticated, requireAnalyticsAdmin, async (req, res) => {
    try {
      const expenses = await storage.getAllExpenses();
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post("/api/admin/expenses", isAuthenticated, requireAnalyticsAdmin, async (req, res) => {
    try {
      const result = insertExpenseSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const expense = await storage.createExpense(result.data);
      res.status(201).json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.patch("/api/admin/expenses/:id", isAuthenticated, requireAnalyticsAdmin, async (req, res) => {
    try {
      // Validate partial update data
      const result = insertExpenseSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const expense = await storage.updateExpense(req.params.id, result.data);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to update expense" });
    }
  });

  app.delete("/api/admin/expenses/:id", isAuthenticated, requireAnalyticsAdmin, async (req, res) => {
    try {
      const success = await storage.deleteExpense(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  // HK Metrics (Admin only)
  app.get("/api/admin/hk-metrics/properties", isAuthenticated, requireHkMetricsAdmin, async (_req, res) => {
    try {
      const properties = await storage.listHkProperties();
      res.json(properties);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch properties" });
    }
  });

  app.get("/api/admin/hk-metrics/summary", isAuthenticated, requireHkMetricsAdmin, async (req, res) => {
    try {
      const { startDate, endDate } = resolveHkDateRange(req.query);
      const property = typeof req.query.property === "string" ? req.query.property.trim() : "";
      const summary = await buildHkSummary(startDate, endDate, property || null);
      res.json({ startDate, endDate, property: property || null, ...summary });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch HK metrics" });
    }
  });

  app.post("/api/admin/hk-metrics/daily", isAuthenticated, requireHkMetricsAdmin, async (req: any, res) => {
    try {
      const result = insertHkDailyMetricSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const userId = req.user?.claims?.sub || req.session?.userId;
      const property = result.data.property.trim();
      if (!property) {
        return res.status(400).json({ error: "Property is required" });
      }
      const { notes, ...rest } = result.data;
      const payload = {
        ...rest,
        metricDate: result.data.metricDate,
        property,
        paidHours: String(result.data.paidHours),
        productiveHours: String(result.data.productiveHours),
        roomsSold: result.data.roomsSold ?? null,
        totalDailyHours: result.data.totalDailyHours ?? null,
        roomRevenueDaily: result.data.roomRevenueDaily ?? null,
        roomRevenueMtd: result.data.roomRevenueMtd ?? null,
        notes: notes?.trim() || undefined,
        createdBy: userId ? String(userId) : null,
      };
      const saved = await storage.upsertHkDailyMetric(payload);
      res.status(201).json(saved);
    } catch (error) {
      res.status(500).json({ error: "Failed to save HK daily metrics" });
    }
  });

  app.patch("/api/admin/hk-metrics/day", isAuthenticated, requireHkMetricsAdmin, async (req: any, res) => {
    try {
      const patchSchema = z.object({
        metricDate: z.coerce.date(),
        property: z.string().min(1),
        roomsSold: z.coerce.number().int().min(0).optional().nullable(),
        totalDailyHours: z.union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.number().min(0)])
          .optional()
          .nullable(),
        roomRevenueDaily: z.union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.number().min(0)])
          .optional()
          .nullable(),
        roomRevenueMtd: z.union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.number().min(0)])
          .optional()
          .nullable(),
        occupiedRooms: z.coerce.number().int().min(0).optional().nullable(),
        notes: z.string().optional().nullable(),
      });
      const result = patchSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const userId = req.user?.claims?.sub || req.session?.userId;
      const property = result.data.property.trim();
      if (!property) {
        return res.status(400).json({ error: "Property is required" });
      }

      const totalDailyHours =
        result.data.totalDailyHours === null || result.data.totalDailyHours === undefined
          ? null
          : String(result.data.totalDailyHours);
      const roomRevenueDaily =
        result.data.roomRevenueDaily === null || result.data.roomRevenueDaily === undefined
          ? null
          : String(result.data.roomRevenueDaily);
      const roomRevenueMtd =
        result.data.roomRevenueMtd === null || result.data.roomRevenueMtd === undefined
          ? null
          : String(result.data.roomRevenueMtd);
      const roomsSoldOverride = result.data.roomsSold !== undefined;

      const saved = await storage.upsertHkDailyMetricFields({
        metricDate: formatMetricDate(result.data.metricDate as any) || format(result.data.metricDate, "yyyy-MM-dd"),
        property,
        roomsSold: result.data.roomsSold ?? undefined,
        totalDailyHours,
        roomRevenueDaily,
        roomRevenueMtd,
        occupiedRooms: result.data.occupiedRooms ?? undefined,
        notes: result.data.notes === null || result.data.notes === undefined ? undefined : result.data.notes,
        roomsSoldImported: roomsSoldOverride ? false : undefined,
        roomsSoldImportedAt: roomsSoldOverride ? null : undefined,
        createdBy: userId ? String(userId) : null,
      });
      res.json(saved);
    } catch (error) {
      res.status(500).json({ error: "Failed to update HK daily metrics" });
    }
  });

  app.post("/api/admin/hk-metrics/attendant", isAuthenticated, requireHkMetricsAdmin, async (req: any, res) => {
    try {
      const result = insertHkAttendantMetricSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const userId = req.user?.claims?.sub || req.session?.userId;
      const property = result.data.property.trim();
      const attendantName = result.data.attendantName.trim();
      if (!property || !attendantName) {
        return res.status(400).json({ error: "Property and attendant name are required" });
      }
      const { notes, ...rest } = result.data;
      const payload = {
        ...rest,
        metricDate: result.data.metricDate,
        property,
        attendantName,
        paidHours: String(result.data.paidHours),
        productiveHours: String(result.data.productiveHours),
        notes: notes?.trim() || undefined,
        createdBy: userId ? String(userId) : null,
      };
      const saved = await storage.upsertHkAttendantMetric(payload);
      res.status(201).json(saved);
    } catch (error) {
      res.status(500).json({ error: "Failed to save attendant metrics" });
    }
  });

  app.post(
    "/api/admin/hk-metrics/import-rooms-sold",
    isAuthenticated,
    requireHkMetricsAdmin,
    roomsSoldUpload.array("files"),
    async (req: any, res) => {
      try {
        const property = typeof req.body?.property === "string" ? req.body.property.trim() : "";
        if (!property) {
          return res.status(400).json({ error: "Property is required" });
        }
        const files = (req.files as Express.Multer.File[]) || [];
        if (!files.length) {
          return res.status(400).json({ error: "No TXT files uploaded" });
        }

        const parsedEntries: Array<{ date: string; roomsSold: number; fileName: string; line: number }> = [];
        const revenueEntries: Array<{
          date: string;
          roomRevenueDaily: number;
          roomRevenueMtd: number;
          fileName: string;
          line: number;
        }> = [];
        const skippedEntries: Array<{ fileName: string; line: number; reason: string; raw: string }> = [];

        files.forEach((file) => {
          const content = file.buffer.toString("utf-8");
          const { parsed, parsedRevenue, skipped } = parseRoomsSoldFile(content);
          parsed.forEach((entry) => {
            parsedEntries.push({ date: entry.date, roomsSold: entry.roomsSold, fileName: file.originalname, line: entry.line });
          });
          parsedRevenue.forEach((entry) => {
            revenueEntries.push({
              date: entry.date,
              roomRevenueDaily: entry.roomRevenueDaily,
              roomRevenueMtd: entry.roomRevenueMtd,
              fileName: file.originalname,
              line: entry.line,
            });
          });
          skipped.forEach((entry) => {
            skippedEntries.push({ fileName: file.originalname, line: entry.line, reason: entry.reason, raw: entry.raw });
          });
        });

        const perDate = new Map<
          string,
          {
            roomsSold?: number;
            roomRevenueDaily?: number;
            roomRevenueMtd?: number;
            source: string;
            line: number;
          }
        >();
        const overwriteLog: Array<{ date: string; previous: number; next: number }> = [];
        parsedEntries.forEach((entry) => {
          if (perDate.has(entry.date)) {
            const previous = perDate.get(entry.date);
            if (previous?.roomsSold !== undefined && previous.roomsSold !== entry.roomsSold) {
              overwriteLog.push({ date: entry.date, previous: previous.roomsSold, next: entry.roomsSold });
            }
          }
          perDate.set(entry.date, {
            ...perDate.get(entry.date),
            roomsSold: entry.roomsSold,
            source: entry.fileName,
            line: entry.line,
          });
        });

        revenueEntries.forEach((entry) => {
          const existing = perDate.get(entry.date);
          perDate.set(entry.date, {
            ...existing,
            roomRevenueDaily: entry.roomRevenueDaily,
            roomRevenueMtd: entry.roomRevenueMtd,
            source: entry.fileName,
            line: entry.line,
          });
        });

        const dates = Array.from(perDate.keys());
        const existingEntries = await storage.getHkDailyMetricsForDates(property, dates);
        const existingMap = new Map<string, HkDailyMetric>();
        existingEntries.forEach((entry) => {
          const metricDate = formatMetricDate(entry.metricDate as any);
          if (metricDate) existingMap.set(metricDate, entry);
        });

        let updatedCount = 0;
        let conflictCount = 0;
        const conflicts: Array<{ date: string; previous: number | null; next: number }> = [];
        const importedAt = new Date();

        const perDateEntries: Array<[
          string,
          {
            roomsSold?: number;
            roomRevenueDaily?: number;
            roomRevenueMtd?: number;
            source: string;
            line: number;
          }
        ]> = [];
        perDate.forEach((value, key) => {
          perDateEntries.push([key, value]);
        });

        await Promise.all(
          perDateEntries.map(async ([date, payload]) => {
            const existing = existingMap.get(date);
            if (payload.roomsSold !== undefined && existing && existing.roomsSold !== null && Number(existing.roomsSold) !== payload.roomsSold) {
              conflictCount += 1;
              conflicts.push({ date, previous: Number(existing.roomsSold), next: payload.roomsSold });
            }
            if (
              payload.roomRevenueDaily !== undefined &&
              existing &&
              existing.roomRevenueDaily !== null &&
              Number(existing.roomRevenueDaily) !== payload.roomRevenueDaily
            ) {
              conflictCount += 1;
              conflicts.push({ date, previous: Number(existing.roomRevenueDaily), next: payload.roomRevenueDaily });
            }
            if (
              payload.roomRevenueMtd !== undefined &&
              existing &&
              existing.roomRevenueMtd !== null &&
              Number(existing.roomRevenueMtd) !== payload.roomRevenueMtd
            ) {
              conflictCount += 1;
              conflicts.push({ date, previous: Number(existing.roomRevenueMtd), next: payload.roomRevenueMtd });
            }
            await storage.upsertHkDailyMetricFields({
              metricDate: date,
              property,
              roomsSold: payload.roomsSold,
              roomsSoldImported: true,
              roomsSoldImportedAt: importedAt,
              roomRevenueDaily: payload.roomRevenueDaily !== undefined ? payload.roomRevenueDaily.toFixed(2) : undefined,
              roomRevenueMtd: payload.roomRevenueMtd !== undefined ? payload.roomRevenueMtd.toFixed(2) : undefined,
            });
            updatedCount += 1;
          })
        );

        const userId = req.user?.claims?.sub || req.session?.userId;
        const parsedCount = parsedEntries.length + revenueEntries.length;
        const skippedCount = skippedEntries.length;
        await storage.createHkRoomsSoldImport({
          uploadedBy: userId ? String(userId) : null,
          filenames: files.map((file) => file.originalname),
          parsedCount,
          updatedCount,
          skippedCount,
          conflictCount,
          details: {
            overwritten: overwriteLog,
            conflicts,
            skipped: skippedEntries,
          },
        });

        res.json({
          filesProcessed: files.length,
          parsedCount,
          updatedCount,
          skippedCount,
          conflictCount,
          overwrittenCount: overwriteLog.length,
          overwrittenDates: overwriteLog.map((entry) => entry.date),
          skipped: skippedEntries,
          conflicts,
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to import rooms sold TXT files" });
      }
    }
  );

  app.get("/api/admin/hk-metrics/pdf", isAuthenticated, requireHkMetricsAdmin, async (req, res) => {
    try {
      const { startDate, endDate } = resolveHkDateRange(req.query);
      const property = typeof req.query.property === "string" ? req.query.property.trim() : "";
      const mporStandardRaw = Number(req.query.mporStandard ?? 24);
      const mporStandard = Number.isFinite(mporStandardRaw) ? mporStandardRaw : 24;
      const budgetRaw = Number(req.query.budget);
      const budgetedRevenue = Number.isFinite(budgetRaw) ? budgetRaw : null;
      const roomInventoryRaw = Number(req.query.roomInventory ?? 134);
      const roomInventory = Number.isFinite(roomInventoryRaw) && roomInventoryRaw > 0 ? roomInventoryRaw : 134;
      const summary = await buildHkSummary(startDate, endDate, property || null);
      const pdfBuffer = await renderHkMetricsPdf({
        property: property || "All",
        startDate,
        endDate,
        mporStandard,
        budgetedRevenue,
        roomInventory,
        summary: summary as any,
      });
      const safeProperty = (property || "all").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="hk-metrics-${safeProperty}-${startDate}-to-${endDate}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate HK metrics PDF" });
    }
  });

  // Promo Codes (Admin only)
  app.get("/api/admin/promo-codes", isAuthenticated, requirePromoCodesAdmin, async (req, res) => {
    try {
      const promoCodes = await storage.getAllPromoCodes();
      res.json(promoCodes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch promo codes" });
    }
  });

  app.post("/api/admin/promo-codes", isAuthenticated, requirePromoCodesAdmin, async (req, res) => {
    try {
      const { insertPromoCodeSchema } = await import("@shared/schema");
      const result = insertPromoCodeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const promoCode = await storage.createPromoCode(result.data);
      res.status(201).json(promoCode);
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        return res.status(400).json({ error: "Promo code already exists" });
      }
      res.status(500).json({ error: "Failed to create promo code" });
    }
  });

  app.patch("/api/admin/promo-codes/:id", isAuthenticated, requirePromoCodesAdmin, async (req, res) => {
    try {
      const { insertPromoCodeSchema } = await import("@shared/schema");
      const result = insertPromoCodeSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const promoCode = await storage.updatePromoCode(req.params.id, result.data);
      if (!promoCode) {
        return res.status(404).json({ error: "Promo code not found" });
      }
      res.json(promoCode);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ error: "Promo code already exists" });
      }
      res.status(500).json({ error: "Failed to update promo code" });
    }
  });

  app.delete("/api/admin/promo-codes/:id", isAuthenticated, requirePromoCodesAdmin, async (req, res) => {
    try {
      const success = await storage.deletePromoCode(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Promo code not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete promo code" });
    }
  });

  // Admin Notifications
  app.get("/api/admin/notifications", isAuthenticated, requireNotificationsAdmin, async (req, res) => {
    try {
      const notifications = await storage.getAllAdminNotifications();
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/admin/notifications/unread", isAuthenticated, requireNotificationsAdmin, async (req, res) => {
    try {
      const notifications = await storage.getUnreadAdminNotifications();
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unread notifications" });
    }
  });

  app.post("/api/admin/notifications", isAuthenticated, requireNotificationsAdmin, async (req, res) => {
    try {
      const notification = await storage.createAdminNotification(req.body);
      res.status(201).json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to create notification" });
    }
  });

  app.patch("/api/admin/notifications/:id/read", isAuthenticated, requireNotificationsAdmin, async (req, res) => {
    try {
      const notification = await storage.markNotificationAsRead(req.params.id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.patch("/api/admin/notifications/:id/actionable", isAuthenticated, requireNotificationsAdmin, async (req, res) => {
    try {
      const { isActionable } = req.body;
      const notification = await storage.markNotificationAsActionable(req.params.id, isActionable);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to update notification" });
    }
  });

  app.delete("/api/admin/notifications/:id", isAuthenticated, requireNotificationsAdmin, async (req, res) => {
    try {
      const success = await storage.deleteAdminNotification(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // Banner Ad Orders - Admin Management
  app.get("/api/admin/banner-ad-orders", isAuthenticated, requireBannersAdmin, async (req, res) => {
    try {
      const { approvalStatus, paymentStatus } = req.query;
      const orders = await storage.getBannerAdOrdersByStatus(
        approvalStatus as string | undefined,
        paymentStatus as string | undefined
      );
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch banner ad orders" });
    }
  });

  app.get("/api/admin/banner-ad-orders/:id", isAuthenticated, requireBannersAdmin, async (req, res) => {
    try {
      const order = await storage.getBannerAdOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Banner ad order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch banner ad order" });
    }
  });

  app.post("/api/admin/banner-ad-orders", isAuthenticated, requireBannersAdmin, async (req, res) => {
    try {
      const normalizeOptionalDate = (value: unknown) => {
        if (value === undefined || value === null || value === "") return undefined;
        if (value instanceof Date) return value;
        const parsed = new Date(String(value));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };

      const startDate = normalizeOptionalDate(req.body.startDate);
      const endDate = normalizeOptionalDate(req.body.endDate);
      if (startDate === null || endDate === null) {
        return res.status(400).json({ error: "Invalid campaign date" });
      }

      // BACKEND VALIDATION: Recalculate pricing server-side to prevent tampering
      const { calculateBannerAdPricing } = await import("../shared/config/bannerPricing");
      const { validatePromoCode, calculatePromoDiscount } = await import("../shared/config/promoCodes");
      
      const tier = req.body.tier;
      const promoCode = req.body.promoCode?.trim();
      
      // Calculate base pricing
      const basePricing = calculateBannerAdPricing(tier);
      
      // Apply promo code if provided and valid
      let finalPricing = {
        monthlyRate: basePricing.monthlyRate.toString(),
        totalAmount: basePricing.subscriptionTotal.toString(),
        creationFee: basePricing.creationFee.toString(),
        grandTotal: basePricing.grandTotal.toString(),
        discountAmount: "0.00",
        promoCode: "",
      };
      
      if (promoCode) {
        const promo = validatePromoCode(promoCode);
        if (promo) {
          const discounts = calculatePromoDiscount(
            basePricing.creationFee,
            basePricing.subscriptionTotal,
            promoCode
          );
          
          finalPricing = {
            monthlyRate: basePricing.monthlyRate.toString(),
            totalAmount: basePricing.subscriptionTotal.toString(),
            creationFee: discounts.finalCreationFee.toFixed(2),
            grandTotal: discounts.finalGrandTotal.toFixed(2),
            discountAmount: discounts.totalDiscount.toFixed(2),
            promoCode: promo.code,
          };
        }
      }
      
      // Override request body with validated pricing
      const validatedOrderData = {
        ...req.body,
        ...finalPricing,
        startDate,
        endDate,
      };
      
      const order = await storage.createBannerAdOrder(validatedOrderData);
      
      // Send email notification to sponsor (non-blocking)
      (async () => {
        try {
          const { getUncachableResendClient } = await import("./resendClient");
          const { getBannerAdOrderEmailHtml, getBannerAdOrderEmailText } = await import("./email-templates");
          
          const { client, fromEmail } = await getUncachableResendClient();
          
          await client.emails.send({
            from: fromEmail,
            to: order.sponsorEmail ?? "noreply@readysetfly.com",
            subject: `Banner Ad Order Confirmation - ${order.title}`,
            html: getBannerAdOrderEmailHtml(order.sponsorName || "Sponsor", {
              orderId: order.id,
              title: order.title,
              tier: order.tier,
              monthlyRate: order.monthlyRate,
              creationFee: order.creationFee ?? "0.00",
              totalAmount: order.totalAmount ?? "0.00",
              grandTotal: order.grandTotal ?? "0.00",
              // @ts-ignore
              promoCode: (order.promoCode || "") as string,
              // @ts-ignore
              discountAmount: (order.discountAmount || "") as string,
            }),
            text: getBannerAdOrderEmailText(order.sponsorName || "Sponsor", {
              orderId: order.id,
              title: order.title,
              tier: order.tier,
              monthlyRate: order.monthlyRate,
              creationFee: order.creationFee ?? "0.00",
              totalAmount: order.totalAmount ?? "0.00",
              grandTotal: order.grandTotal ?? "0.00",
              // @ts-ignore
              promoCode: (order.promoCode || "") as string,
              // @ts-ignore
              discountAmount: (order.discountAmount || "") as string,
            }),
          });
          
          logDebug(`✅ Banner ad order confirmation email sent to ${order.sponsorEmail ?? "admin"}`);
        } catch (emailError) {
          console.error('❌ Failed to send banner ad order email:', emailError);
        }
      })();
      
      res.status(201).json(order);
    } catch (error) {
      console.error('Banner ad order creation error:', error);
      res.status(500).json({ error: "Failed to create banner ad order", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/admin/banner-ad-orders/:id", isAuthenticated, requireBannersAdmin, async (req, res) => {
    try {
      const normalizeOptionalDate = (value: unknown) => {
        if (value === undefined || value === null || value === "") return undefined;
        if (value instanceof Date) return value;
        const parsed = new Date(String(value));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };

      const startDate = normalizeOptionalDate(req.body.startDate);
      const endDate = normalizeOptionalDate(req.body.endDate);
      if (startDate === null || endDate === null) {
        return res.status(400).json({ error: "Invalid campaign date" });
      }

      // CRITICAL: Load existing order to get tier if not provided in request
      const existingOrder = await storage.getBannerAdOrder(req.params.id);
      if (!existingOrder) {
        return res.status(404).json({ error: "Banner ad order not found" });
      }
      
      // BACKEND VALIDATION: Always recalculate pricing server-side to prevent tampering
      const { calculateBannerAdPricing } = await import("../shared/config/bannerPricing");
      const { validatePromoCode, calculatePromoDiscount } = await import("../shared/config/promoCodes");
      
      // Use tier from request, or fallback to existing tier
      const tier = req.body.tier || existingOrder.tier;
      const promoCode = req.body.promoCode?.trim() ?? (req.body.promoCode === "" ? "" : existingOrder.promoCode);
      
      // ALWAYS calculate base pricing
      const basePricing = calculateBannerAdPricing(tier);
      
      // Apply promo code if provided and valid
      let finalPricing = {
        monthlyRate: basePricing.monthlyRate.toString(),
        totalAmount: basePricing.subscriptionTotal.toString(),
        creationFee: basePricing.creationFee.toString(),
        grandTotal: basePricing.grandTotal.toString(),
        discountAmount: "0.00",
        promoCode: "",
      };
      
      if (promoCode) {
        const promo = validatePromoCode(promoCode);
        if (promo) {
          const discounts = calculatePromoDiscount(
            basePricing.creationFee,
            basePricing.subscriptionTotal,
            promoCode
          );
          
          finalPricing = {
            monthlyRate: basePricing.monthlyRate.toString(),
            totalAmount: basePricing.subscriptionTotal.toString(),
            creationFee: discounts.finalCreationFee.toFixed(2),
            grandTotal: discounts.finalGrandTotal.toFixed(2),
            discountAmount: discounts.totalDiscount.toFixed(2),
            promoCode: promo.code,
          };
        }
      }
      
      // ALWAYS override request body with validated pricing
      req.body = {
        ...req.body,
        tier, // Ensure tier is set
        ...finalPricing,
        ...(startDate !== undefined ? { startDate } : {}),
        ...(endDate !== undefined ? { endDate } : {}),
      };
      
      const order = await storage.updateBannerAdOrder(req.params.id, req.body);
      res.json(order);
    } catch (error) {
      console.error('Banner ad order update error:', error);
      res.status(500).json({ error: "Failed to update banner ad order" });
    }
  });

  app.delete("/api/admin/banner-ad-orders/:id", isAuthenticated, requireBannersAdmin, async (req, res) => {
    try {
      const success = await storage.deleteBannerAdOrder(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Banner ad order not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete banner ad order" });
    }
  });

  app.post("/api/admin/banner-ad-orders/:id/activate", isAuthenticated, requireBannersAdmin, async (req, res) => {
    try {
      const requesterId = (req as any).user?.claims?.sub || (req.session as any)?.userId;
      const requester = requesterId ? await storage.getUser(String(requesterId)) : undefined;

      if (requester?.isSuperAdmin) {
        const order = await storage.getBannerAdOrder(req.params.id);
        if (!order) {
          return res.status(404).json({ error: "Banner ad order not found" });
        }

        const updates: Partial<BannerAdOrder> = {};
        if (order.paymentStatus !== "paid") {
          updates.paymentStatus = "comped";
        }
        if (!order.paypalOrderId || order.paypalOrderId.trim() === "") {
          updates.paypalOrderId = `ADMIN-COMPED-${Date.now()}`;
        }
        if (order.approvalStatus !== "approved") {
          updates.approvalStatus = "approved";
        }
        if (Object.keys(updates).length > 0) {
          const adminNotes = order.adminNotes?.trim() || "";
          updates.adminNotes = adminNotes
            ? `${adminNotes}\nAdmin free activation by ${requester.email || requester.id}`
            : `Admin free activation by ${requester.email || requester.id}`;
          await storage.updateBannerAdOrder(order.id, updates);
        }
      }

      const ad = await storage.activateBannerAdOrder(req.params.id);
      if (!ad) {
        return res.status(400).json({ error: "Failed to activate order. Order must be paid and have required content." });
      }
      res.json(ad);
    } catch (error) {
      // Handle duplicate activation attempt
      if (error instanceof Error && error.message === 'ALREADY_ACTIVATED') {
        return res.status(409).json({ error: "This order has already been activated." });
      }
      // Enforce payment and approval guards
      if (error instanceof Error && error.message === 'UNPAID_ORDER') {
        return res.status(402).json({ error: "Payment required", details: "Order must be paid before activation." });
      }
      if (error instanceof Error && error.message === 'MISSING_PAYMENT_REFERENCE') {
        return res.status(400).json({ error: "Payment reference missing", details: "PayPal order ID is missing; capture must complete before activation." });
      }
      if (error instanceof Error && error.message === 'NOT_APPROVED') {
        return res.status(400).json({ error: "Approval required", details: "Order must be approved before activation." });
      }
      // Handle missing image
      if (error instanceof Error && error.message === 'IMAGE_REQUIRED') {
        return res.status(400).json({ errorCode: "IMAGE_REQUIRED", error: "Banner image is required. Please upload an image before activating this order." });
      }
      console.error('Banner ad order activation error:', error);
      res.status(500).json({ error: "Failed to activate banner ad order", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/admin/banner-ad-orders/:id/approval", isAuthenticated, requireBannersAdmin, async (req, res) => {
    try {
      const { approvalStatus, adminNotes } = req.body;
      
      // Validate approval status
      const validStatuses = ['approved', 'rejected', 'sent', 'draft'];
      if (!approvalStatus || !validStatuses.includes(approvalStatus)) {
        return res.status(400).json({ error: "Invalid approval status. Must be: approved, rejected, sent, or draft" });
      }
      
      // Get current order to check payment status
      const order = await storage.getBannerAdOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Banner ad order not found" });
      }
      
      // Only allow approval if order is paid or comped
      if (approvalStatus === 'approved' && order.paymentStatus !== 'paid' && order.paymentStatus !== 'comped') {
        return res.status(400).json({ error: "Cannot approve unpaid orders. Order must be paid or comped before approval." });
      }
      
      // Update approval status
      const updated = await storage.updateBannerAdOrder(req.params.id, {
        approvalStatus,
        adminNotes: adminNotes || order.adminNotes
      });
      
      logDebug(`✅ Banner ad order ${req.params.id} approval status updated to: ${approvalStatus}`);
      res.json(updated);
    } catch (error) {
      console.error('Banner ad order approval error:', error);
      res.status(500).json({ error: "Failed to update approval status" });
    }
  });

  // Banner Ads - Admin Management
  app.get("/api/admin/banner-ads", isAuthenticated, requireBannersAdmin, async (req, res) => {
    try {
      const ads = await storage.getAllBannerAds();
      res.json(ads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch banner ads" });
    }
  });

  app.get("/api/admin/banner-ads/:id", isAuthenticated, requireBannersAdmin, async (req, res) => {
    try {
      const ad = await storage.getBannerAd(req.params.id);
      if (!ad) {
        return res.status(404).json({ error: "Banner ad not found" });
      }
      res.json(ad);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch banner ad" });
    }
  });

  app.get("/api/admin/banner-ads/:id/summary.csv", isAuthenticated, requireBannersAdmin, async (req, res) => {
    try {
      const ad = await storage.getBannerAd(req.params.id);
      if (!ad) {
        return res.status(404).json({ error: "Banner ad not found" });
      }
      const order = ad.orderId ? await storage.getBannerAdOrder(ad.orderId) : undefined;
      const impressions = ad.impressions ?? 0;
      const clicks = ad.clicks ?? 0;
      const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00";

      const rows = [
        [
          "banner_id",
          "title",
          "sponsor_name",
          "sponsor_email",
          "placements",
          "category",
          "start_date",
          "end_date",
          "impressions",
          "clicks",
          "ctr_percent",
          "link",
        ],
        [
          ad.id,
          ad.title,
          order?.sponsorName ?? "",
          order?.sponsorEmail ?? "",
          (ad.placements || []).join("|"),
          ad.category ?? "",
          ad.startDate ? new Date(ad.startDate).toISOString() : "",
          ad.endDate ? new Date(ad.endDate).toISOString() : "",
          impressions.toString(),
          clicks.toString(),
          ctr,
          ad.link ?? "",
        ],
      ];

      const csv = rows
        .map((row) =>
          row
            .map((value) => {
              const str = String(value ?? "");
              if (/[",\n]/.test(str)) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            })
            .join(",")
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="banner-summary-${ad.id}.csv"`);
      res.status(200).send(csv);
    } catch (error) {
      console.error("Banner summary export error:", error);
      res.status(500).json({ error: "Failed to export banner summary" });
    }
  });

  app.get("/api/admin/partner-tools/metrics", isAuthenticated, requireBannersAdmin, async (req, res) => {
    try {
      const metrics = await storage.getPartnerToolMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Partner tool metrics error:", error);
      res.status(500).json({ error: "Failed to fetch partner tool metrics" });
    }
  });

  app.post("/api/admin/banner-ads", isAuthenticated, requireBannersAdmin, async (req, res) => {
    try {
      const payload = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      };

      const validatedData = insertBannerAdSchema.parse(payload);
      if (!validatedData.endDate) {
        return res.status(400).json({ error: "End date is required for manual banner creation" });
      }
      const ad = await storage.createBannerAd(validatedData);
      res.status(201).json(ad);
    } catch (error: any) {
      console.error("Banner ad creation error:", error);
      res.status(400).json({ error: error.message || "Failed to create banner ad" });
    }
  });

  app.patch("/api/admin/banner-ads/:id", isAuthenticated, requireBannersAdmin, async (req, res) => {
    try {
      logDebug("[BANNER UPDATE] Request body:", req.body);
      logDebug("[BANNER UPDATE] Banner ID:", req.params.id);
      
      // Admin can update ALL fields
      const updateData: any = {};
      
      // Handle date conversions
      if (req.body.startDate) {
        updateData.startDate = new Date(req.body.startDate);
      }
      if (req.body.endDate) {
        updateData.endDate = new Date(req.body.endDate);
      }
      
      // Copy all other fields
      const fieldsToUpdate = [
        'title',
        'description',
        'adCopy',
        'imageUrl',
        'videoUrl',
        'videoMuted',
        'instagramUrl',
        'facebookUrl',
        'link',
        'placements',
        'category',
        'isActive',
      ];
      for (const field of fieldsToUpdate) {
        if (field in req.body) {
          updateData[field] = req.body[field];
        }
      }
      
      logDebug("[BANNER UPDATE] Update data:", updateData);
      
      const ad = await storage.updateBannerAd(req.params.id, updateData);
      if (!ad) {
        return res.status(404).json({ error: "Banner ad not found" });
      }
      logDebug("[BANNER UPDATE] Success! Updated ad:", ad);
      res.json(ad);
    } catch (error) {
      console.error("[BANNER UPDATE] Error:", error);
      res.status(500).json({ error: "Failed to update banner ad" });
    }
  });

  app.delete("/api/admin/banner-ads/:id", isAuthenticated, requireBannersAdmin, async (req, res) => {
    try {
      const success = await storage.deleteBannerAd(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Banner ad not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete banner ad" });
    }
  });

  // Banner Ads - Public Endpoints
  app.get("/api/banner-ads/active", async (req, res) => {
    try {
      const { placement, category } = req.query;
      const ads = await storage.getActiveBannerAds(
        placement as string | undefined,
        category as string | undefined
      );
      res.json(ads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active banner ads" });
    }
  });

  app.post("/api/banner-ads/:id/impression", async (req, res) => {
    try {
      await storage.incrementBannerImpressions(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to track impression" });
    }
  });

  app.post("/api/banner-ads/:id/click", async (req, res) => {
    try {
      await storage.incrementBannerClicks(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to track click" });
    }
  });

  app.post("/api/banner-ads/:id/contact", contactFormRateLimiter, async (req, res) => {
    try {
      const contactSchema = z.object({
        name: z.string().trim().min(1, "Name is required").max(160),
        email: z.string().trim().email("Valid email is required").max(255),
        phone: z.string().trim().max(40).optional(),
        message: z.string().trim().max(2000).optional(),
        placement: z.string().trim().max(120).optional(),
        category: z.string().trim().max(120).optional(),
      });

      const parsed = contactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid contact data",
          details: parsed.error.errors,
        });
      }

      const ad = await storage.getBannerAd(req.params.id);
      if (!ad) {
        return res.status(404).json({ error: "Banner ad not found" });
      }

      if (!ad.orderId) {
        return res.status(400).json({ error: "Banner ad advertiser not available" });
      }

      const order = await storage.getBannerAdOrder(ad.orderId);
      if (!order || !order.sponsorEmail) {
        return res.status(404).json({ error: "Advertiser not found" });
      }

      await sendBannerAdvertiserContactEmail({
        sponsorEmail: order.sponsorEmail,
        sponsorName: order.sponsorName,
        adTitle: ad.title,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        message: parsed.data.message,
        placement: parsed.data.placement,
        category: parsed.data.category,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Banner advertiser contact error:", error);
      res.status(500).json({ error: "Failed to contact advertiser" });
    }
  });

  app.post("/api/banner-ads/inquiry", async (req, res) => {
    try {
      const inquirySchema = z.object({
        firstName: z.string().trim().min(1, "First name is required").max(80),
        lastName: z.string().trim().min(1, "Last name is required").max(80),
        email: z.string().trim().email("Valid email is required").max(255),
        phone: z.string().trim().max(40).optional(),
        company: z.string().trim().max(160).optional(),
        website: z.string().trim().max(240).optional(),
        placements: z.array(z.string().trim().max(120)).optional(),
        desiredTier: z.string().trim().max(60).optional(),
        timeframe: z.string().trim().max(120).optional(),
        budget: z.string().trim().max(120).optional(),
        message: z.string().trim().max(2000).optional(),
        agreementAccepted: z.literal(true, {
          errorMap: () => ({ message: "Agreement acceptance is required" }),
        }),
        agreementName: z.string().trim().min(1, "Signature name is required").max(160),
        agreementTitle: z.string().trim().max(160).optional(),
        agreementVersion: z.string().trim().max(200).optional(),
      });

      const parsed = inquirySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid inquiry data", details: parsed.error.errors });
      }

      const placements = parsed.data.placements?.length ? parsed.data.placements.join(", ") : "Not specified";
      const agreementVersion = parsed.data.agreementVersion || "RSF Banner Advertising Agreement";
      const agreementSignedAt = new Date();
      const agreementDateLabel = agreementSignedAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      const lines = [
        `Banner Ad Inquiry`,
        ``,
        `Contact`,
        `Name: ${parsed.data.firstName} ${parsed.data.lastName}`,
        `Email: ${parsed.data.email}`,
        `Phone: ${parsed.data.phone || "Not provided"}`,
        ``,
        `Business`,
        `Company: ${parsed.data.company || "Not provided"}`,
        `Website: ${parsed.data.website || "Not provided"}`,
        ``,
        `Campaign`,
        `Preferred placements: ${placements}`,
        `Desired tier: ${parsed.data.desiredTier || "Not specified"}`,
        `Timeframe: ${parsed.data.timeframe || "Not specified"}`,
        `Budget: ${parsed.data.budget || "Not specified"}`,
        ``,
        `Agreement`,
        `Accepted: Yes`,
        `Signature name: ${parsed.data.agreementName}`,
        `Signature title: ${parsed.data.agreementTitle || "Not provided"}`,
        `Signature date: ${agreementDateLabel}`,
        `Agreement version: ${agreementVersion}`,
        ``,
        `Notes`,
        `${parsed.data.message || "No additional notes."}`,
      ];

      const subjectCompany = parsed.data.company || `${parsed.data.firstName} ${parsed.data.lastName}`;
      const ip = req.ip || req.connection.remoteAddress || "unknown";
      const userAgent = req.get("user-agent") || undefined;
      const messageBody = lines.join("\n");

      const submission = await storage.createContactSubmission({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        subject: `Banner Ad Inquiry - ${subjectCompany}`,
        message: messageBody,
        ipAddress: ip,
        userAgent,
      });

      sendContactFormEmail({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        subject: `Banner Ad Inquiry - ${subjectCompany}`,
        message: messageBody,
      })
        .then(async () => {
          await storage.updateContactSubmissionEmailStatus(submission.id, true);
        })
        .catch((error) => {
          console.error(`Failed to send banner ad inquiry email for submission ${submission.id}:`, error);
        });

      res.json({ success: true });
    } catch (error) {
      console.error("Banner ad inquiry error:", error);
      res.status(500).json({ error: "Failed to submit banner inquiry" });
    }
  });

  // Extract invoice data using OpenAI Vision API
  app.post("/api/admin/extract-invoice-data", isAuthenticated, isAdmin, upload.single('invoice'), async (req, res) => {
    const fs = await import('fs/promises');
    let filePath: string | null = null;
    let shouldCleanup = false;
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No invoice file provided" });
      }

      filePath = req.file.path;
      shouldCleanup = true; // File was uploaded, ensure cleanup

      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: "Invalid file type. Please upload an image or PDF." });
      }

      // Read file and convert to base64
      const fileBuffer = await fs.readFile(filePath);
      const base64Image = fileBuffer.toString('base64');
      const mimeType = req.file.mimetype;

      const prompt = `You are an invoice data extraction assistant. Analyze this invoice image and extract the following information in JSON format:
{
  "amount": "the total amount (just the number with decimal, no currency symbol)",
  "date": "the invoice date in YYYY-MM-DD format",
  "description": "a brief description of what the invoice is for (company name + service/product)",
  "category": "best matching category: 'server', 'database', or 'other'"
}

If you cannot find certain fields, omit them from the response. Be accurate and only return the JSON object, nothing else.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.1, // Lower temperature for more consistent extraction
      });

      const responseText = completion.choices[0]?.message?.content || "{}";
      
      // Parse JSON from response (handle potential markdown code blocks)
      let extractedData: any = {};
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        extractedData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch (parseError) {
        console.error('Failed to parse AI response:', responseText);
        extractedData = {};
      }

      // Validate extracted data structure
      const validatedData: any = {};
      if (extractedData.amount && typeof extractedData.amount === 'string') {
        validatedData.amount = extractedData.amount;
      }
      if (extractedData.date && typeof extractedData.date === 'string') {
        validatedData.date = extractedData.date;
      }
      if (extractedData.description && typeof extractedData.description === 'string') {
        validatedData.description = extractedData.description;
      }
      if (extractedData.category && ['server', 'database', 'other'].includes(extractedData.category)) {
        validatedData.category = extractedData.category;
      }

      res.json(validatedData);
    } catch (error: any) {
      console.error('Invoice extraction error:', error);
      const errorMessage = error.message || "Failed to extract invoice data";
      res.status(500).json({ error: errorMessage });
    } finally {
      // Always clean up the uploaded file
      if (filePath && shouldCleanup) {
        try {
          await fs.unlink(filePath);
        } catch (cleanupError) {
          console.error('Failed to clean up temp file:', cleanupError);
        }
      }
    }
  });

  // Promo Alerts (Public read active, Admin read all/write)
  app.get("/api/promo-alerts", async (req, res) => {
    try {
      const alerts = await storage.getActivePromoAlerts();
      res.json(alerts);
    } catch (error) {
      console.error('Failed to fetch promo alerts:', error);
      res.status(500).json({ error: "Failed to fetch promotional alerts" });
    }
  });

  app.get("/api/admin/promo-alerts", isAuthenticated, requirePromoAdmin, async (req, res) => {
    try {
      const alerts = await storage.getAllPromoAlerts();
      res.json(alerts);
    } catch (error) {
      console.error('Failed to fetch all promo alerts:', error);
      res.status(500).json({ error: "Failed to fetch promotional alerts" });
    }
  });

  app.post("/api/promo-alerts", isAuthenticated, requirePromoAdmin, async (req, res) => {
    try {
      const validatedData = insertPromoAlertSchema.parse(req.body);
      const alert = await storage.createPromoAlert(validatedData);
      res.json(alert);
    } catch (error: any) {
      console.error('Failed to create promo alert:', error);
      res.status(400).json({ error: error.message || "Failed to create promotional alert" });
    }
  });

  app.patch("/api/promo-alerts/:id", isAuthenticated, requirePromoAdmin, async (req, res) => {
    try {
      const partialSchema = insertPromoAlertSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      const alert = await storage.updatePromoAlert(req.params.id, validatedData);
      if (!alert) {
        return res.status(404).json({ error: "Promotional alert not found" });
      }
      res.json(alert);
    } catch (error: any) {
      console.error('Failed to update promo alert:', error);
      res.status(400).json({ error: error.message || "Failed to update promotional alert" });
    }
  });

  app.delete("/api/promo-alerts/:id", isAuthenticated, requirePromoAdmin, async (req, res) => {
    try {
      const deleted = await storage.deletePromoAlert(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Promotional alert not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete promo alert:', error);
      res.status(500).json({ error: "Failed to delete promotional alert" });
    }
  });

  // Grant promotional free time to marketplace listing (admin only)
  app.post("/api/admin/marketplace/:id/grant-promo", isAuthenticated, requirePromoAdmin, async (req: any, res) => {
    try {
      const { durationDays } = req.body;
      
      if (!durationDays || durationDays < 1 || durationDays > 31) {
        return res.status(400).json({ error: "Duration must be between 1 and 31 days" });
      }
      
      const listing = await storage.grantMarketplacePromoFreeTime(
        req.params.id, 
        durationDays, 
        req.user.id
      );
      
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      res.json(listing);
    } catch (error: any) {
      console.error('Failed to grant promo free time:', error);
      res.status(500).json({ error: error.message || "Failed to grant promotional free time" });
    }
  });

  // Aviation Events (community calendar)
  app.get("/api/events", async (_req, res) => {
    try {
      const now = new Date();
      await db
        .delete(aviationEvents)
        .where(
          and(
            lt(aviationEvents.endDate, now),
            or(isNull(aviationEvents.isSample), eq(aviationEvents.isSample, false))
          )
        );

      const rows = await db
        .select()
        .from(aviationEvents)
        .where(gte(aviationEvents.endDate, now))
        .orderBy(asc(aviationEvents.startDate), asc(aviationEvents.createdAt));

      const merged = [
        ...rows.map(serializeAviationEvent),
        ...SAMPLE_AVIATION_EVENTS.map(serializeAviationEvent),
      ];

      merged.sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );

      res.json({ events: merged });
    } catch (error) {
      console.error("Failed to load aviation events:", error);
      res.status(500).json({ error: "Failed to load aviation events" });
    }
  });

  app.post("/api/events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const payload = insertAviationEventSchema.parse(req.body);
      const blocklistHaystack = `${payload.title} ${payload.description} ${payload.location}`.toLowerCase();
      if (AVIATION_EVENT_BLOCKLIST.some((term) => blocklistHaystack.includes(term))) {
        return res.status(400).json({
          error: "Events must be aviation-only. Use Marketplace listings for ads or sales posts.",
        });
      }

      if (payload.endDate.getTime() < payload.startDate.getTime()) {
        return res.status(400).json({ error: "End date must be after the start date" });
      }

      const now = new Date();
      if (payload.endDate.getTime() < now.getTime()) {
        return res.status(400).json({ error: "Event end date must be in the future" });
      }

      const eventUrl = payload.eventUrl?.trim() ? payload.eventUrl.trim() : null;
      const imageUrl = payload.imageUrl?.trim() ? payload.imageUrl.trim() : null;

      const [created] = await db
        .insert(aviationEvents)
        .values({
          title: payload.title,
          description: payload.description,
          location: payload.location,
          category: payload.category,
          eventUrl,
          imageUrl,
          createdBy: userId,
          startDate: payload.startDate,
          endDate: payload.endDate,
          isSample: false,
        })
        .returning();

      res.json(serializeAviationEvent(created));
    } catch (error: any) {
      console.error("Failed to create aviation event:", error);
      res.status(400).json({ error: error.message || "Failed to publish event" });
    }
  });

  // Job Applications
  app.post("/api/job-applications", upload.single('resume'), async (req: any, res) => {
    try {
      const { listingId, firstName, lastName, email, phone, currentJobTitle, yearsOfExperience, coverLetter } = req.body;

      if (getSampleMarketplaceListing(listingId)) {
        return res.status(400).json({ error: "Sample listing - applications are disabled." });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: "Resume file is required" });
      }
      
      // Get the listing to retrieve job poster's email
      const listing = await storage.getMarketplaceListing(listingId);
      if (!listing || listing.category !== 'job') {
        return res.status(404).json({ error: "Job listing not found" });
      }
      
      // CRITICAL: Validate email exists BEFORE creating application to avoid inconsistent state
      const listingOwner = await storage.getUser(listing.userId);
      const recipientEmail = listing.contactEmail || listingOwner?.email;
      
      if (!recipientEmail) {
        console.error(`No recipient email found for job listing ${listingId}. contactEmail: ${listing.contactEmail}, owner email: ${listingOwner?.email}`);
        return res.status(400).json({ 
          error: "Job listing does not have a contact email configured. Please contact the job poster to update their listing." 
        });
      }
      
      // Get authenticated user if logged in
      const applicantId = req.user ? req.user.claims.sub : null;
      
      // Validate application data
      const applicationData = insertJobApplicationSchema.parse({
        listingId,
        applicantId,
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        currentJobTitle: currentJobTitle || undefined,
        yearsOfExperience: yearsOfExperience || undefined,
        coverLetter: coverLetter || undefined,
        resumeUrl: `/uploads/documents/${req.file.filename}`,
      });
      
      // CRITICAL: Send email FIRST before creating application to ensure transactional consistency
      // If email fails, no application is saved (prevents orphaned applications + duplicate submissions)
      try {
        const { client, fromEmail } = await getUncachableResendClient();
        
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0066cc 0%, #004a99 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">New Job Application Received</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin: 0 0 20px 0;">
      You've received a new application for your job listing:
    </p>
    
    <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #0066cc;">${listing.title}</h2>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">${listing.location || 'Location not specified'}</p>
    </div>
    
    <div style="margin: 25px 0;">
      <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 15px 0; color: #374151;">Applicant Information</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Name:</td>
          <td style="padding: 8px 0; font-weight: 500; font-size: 14px;">${firstName} ${lastName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email:</td>
          <td style="padding: 8px 0; font-weight: 500; font-size: 14px;">${email}</td>
        </tr>
        ${phone ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Phone:</td>
          <td style="padding: 8px 0; font-weight: 500; font-size: 14px;">${phone}</td>
        </tr>
        ` : ''}
        ${currentJobTitle ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Current Job Title:</td>
          <td style="padding: 8px 0; font-weight: 500; font-size: 14px;">${currentJobTitle}</td>
        </tr>
        ` : ''}
        ${yearsOfExperience ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Years of Experience:</td>
          <td style="padding: 8px 0; font-weight: 500; font-size: 14px;">${yearsOfExperience}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    ${coverLetter ? `
    <div style="margin: 25px 0;">
      <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 10px 0; color: #374151;">Cover Letter</h3>
      <div style="background: #f9fafb; padding: 15px; border-radius: 6px; border-left: 3px solid #0066cc;">
        <p style="margin: 0; font-size: 14px; white-space: pre-wrap;">${coverLetter}</p>
      </div>
    </div>
    ` : ''}
    
    <div style="margin: 30px 0; padding: 20px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        <strong>Note:</strong> The applicant's resume has been uploaded to your Ready Set Fly dashboard. Log in to view the full application and resume.
      </p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.APP_BASE_URL || process.env.WEB_BASE_URL || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'https://readysetfly.us')}/marketplace/${listingId}" 
         style="display: inline-block; background: #0066cc; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 500; font-size: 16px;">
        View Application
      </a>
    </div>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 13px;">
        Ready Set Fly - Aviation Marketplace & Rental Platform
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        This is an automated notification. Please do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>
        `;
        
        logDebug(`Sending job application email to: ${recipientEmail} for listing: ${listing.title}`);
        
        await client.emails.send({
          from: fromEmail,
          to: recipientEmail,
          subject: `Inquiry From Ready Set Fly about your Aviation Jobs Listing: ${listing.title}`,
          html: emailHtml,
        });
        
        logDebug(`Job application email sent successfully to: ${recipientEmail}`);
        
        // Create application AFTER email sends successfully (transactional consistency)
        const application = await storage.createJobApplication(applicationData);
        
        res.json(application);
      } catch (emailError) {
        console.error(`CRITICAL: Failed to send job application email to ${recipientEmail}:`, emailError);
        // Email send failed, so don't create application (prevents orphaned records)
        return res.status(500).json({ 
          error: "Failed to send notification to job poster. Please try again or contact support@readysetfly.us" 
        });
      }
    } catch (error: any) {
      console.error('Job application error:', error);
      res.status(500).json({ error: error.message || "Failed to submit application" });
    }
  });

  // Get applications for a specific listing (job poster only)
  app.get("/api/job-applications/listing/:listingId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Verify user owns the listing
      const listing = await storage.getMarketplaceListing(req.params.listingId);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      if (listing.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to view applications for this listing" });
      }
      
      const applications = await storage.getJobApplicationsByListing(req.params.listingId);
      res.json(applications);
    } catch (error) {
      console.error('Failed to fetch job applications:', error);
      res.status(500).json({ error: "Failed to fetch applications" });
    }
  });

  // Get applications by applicant (user's own applications)
  app.get("/api/job-applications/applicant", isAuthenticated, async (req: any, res) => {
    try {
      const applicantId = req.user.claims.sub;
      const applications = await storage.getJobApplicationsByApplicant(applicantId);
      res.json(applications);
    } catch (error) {
      console.error('Failed to fetch user applications:', error);
      res.status(500).json({ error: "Failed to fetch applications" });
    }
  });

  // Update application status (job poster only)
  app.patch("/api/job-applications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const application = await storage.getJobApplication(req.params.id);
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      // Verify user owns the listing
      const listing = await storage.getMarketplaceListing(application.listingId);
      if (!listing || listing.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to update this application" });
      }
      
      const updated = await storage.updateJobApplication(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error('Failed to update application:', error);
      res.status(500).json({ error: "Failed to update application" });
    }
  });

  // Update current user's profile (authenticated)
  app.patch("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { paypalEmail } = req.body;

      // Only allow updating specific safe fields
      const updateData: any = {};
      if (paypalEmail !== undefined) {
        updateData.paypalEmail = paypalEmail;
      }

      const user = await storage.updateUser(userId, updateData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.get("/api/user/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const settings = await storage.getUserSettings(String(userId));
      res.json(settings || { eb6OutputMode: "quick", eb6SelectedOutputs: [] });
    } catch (error) {
      console.error("Failed to fetch user settings:", error);
      res.status(500).json({ error: "Failed to fetch user settings" });
    }
  });

  app.put("/api/user/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = insertUserSettingsSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const settings = await storage.upsertUserSettings(String(userId), result.data as any);
      res.json(settings);
    } catch (error) {
      console.error("Failed to update user settings:", error);
      res.status(500).json({ error: "Failed to update user settings" });
    }
  });

  // Student Pilot profile (tools-first experience)
  const studentProfileLimiter = createIpRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    message: "Too many student profile requests, please try again later",
  });

  app.get("/api/student/profile", isAuthenticated, studentProfileLimiter, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getStudentProfile(String(userId));
      res.json(profile || { userId, wizardJson: null, roadmapJson: null, progressJson: null });
    } catch (error) {
      console.error("Failed to fetch student profile:", error);
      res.status(500).json({ error: "Failed to fetch student profile" });
    }
  });

  app.put("/api/student/profile", isAuthenticated, studentProfileLimiter, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const payloadSize = JSON.stringify(req.body || {}).length;
      if (payloadSize > 20000) {
        return res.status(413).json({ error: "Payload too large" });
      }

      const updates = {
        userId: String(userId),
        wizardJson: req.body?.wizardJson ?? null,
        roadmapJson: req.body?.roadmapJson ?? null,
        progressJson: req.body?.progressJson ?? null,
      };
      const profile = await storage.upsertStudentProfile(String(userId), updates);
      res.json(profile);
    } catch (error) {
      console.error("Failed to update student profile:", error);
      res.status(500).json({ error: "Failed to update student profile" });
    }
  });

  const USER_SELF_UPDATE_FIELDS = [
    "firstName",
    "lastName",
    "phone",
    "totalFlightHours",
    "certifications",
    "aircraftTypesFlown",
    "profileImageUrl",
    "pilotLicenseUrl",
    "insuranceUrl",
  ] as const;

  const sanitizeUser = (user: any) => {
    const {
      hashedPassword,
      passwordCreatedAt,
      emailVerificationToken,
      emailVerificationExpires,
      ...safeUser
    } = user;
    return safeUser;
  };

  const pickUserUpdates = (input: any) => {
    const updates: Record<string, unknown> = {};
    for (const key of USER_SELF_UPDATE_FIELDS) {
      if (input?.[key] !== undefined) {
        updates[key] = input[key];
      }
    }
    return updates;
  };

  // Users/Profile
  app.get("/api/users/:id", isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.user?.claims?.sub;
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const requester = await storage.getUser(requesterId);
      if (!requester) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const isSelf = requesterId === req.params.id;
      if (!isSelf && !requester.isAdmin && !requester.isSuperAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(sanitizeUser(user));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.patch("/api/users/:id", isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.user?.claims?.sub;
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (requesterId !== req.params.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const updates = pickUserUpdates(req.body);
      if (!Object.keys(updates).length) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const user = await storage.updateUser(req.params.id, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(sanitizeUser(user));
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Aviation Weather API (public access with caching)
  const weatherCache = new Map<string, { data: any; timestamp: number }>();
  const WEATHER_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

  function parseBbox(raw: string | null): { west: number; south: number; east: number; north: number } | null {
    if (!raw) return null;
    const parts = raw.split(",").map((value) => Number(value));
    if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) return null;
    const [west, south, east, north] = parts;
    if (west > east || south > north) return null;
    return { west, south, east, north };
  }

  function parseLatLonBbox(raw: string | null): { south: number; west: number; north: number; east: number } | null {
    if (!raw) return null;
    const parts = raw.split(",").map((value) => Number(value));
    if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) return null;
    const [lat0, lon0, lat1, lon1] = parts;
    const south = Math.min(lat0, lat1);
    const north = Math.max(lat0, lat1);
    const west = Math.min(lon0, lon1);
    const east = Math.max(lon0, lon1);
    if (west > east || south > north) return null;
    return { south, west, north, east };
  }

  function pickWindsAltitude(requested: number | null, available: number[]): number {
    const fallback = available.includes(12000) ? 12000 : available[0] ?? 12000;
    if (!requested || !Number.isFinite(requested)) return fallback;
    let best = fallback;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const alt of available) {
      const delta = Math.abs(alt - requested);
      if (delta < bestDelta) {
        best = alt;
        bestDelta = delta;
      }
    }
    return best;
  }

  app.get("/api/airports/search", airportSearchRateLimiter, airportLookupRateLimiter, async (req, res) => {
    try {
      const rawQuery = String(req.query.q || "");
      const query = normalizeSearch(rawQuery);
      if (!query || query.length < 2) {
        return res.json([]);
      }

      res.setHeader("x-rsf-airport-search", "1");
      const stations = await loadStationCache();
      const terms = query.split(" ").filter(Boolean);

      const scored = stations
        .map((station) => {
          const haystack = normalizeSearch(
            `${station.icao} ${station.name ?? ""} ${station.city ?? ""} ${station.state ?? ""}`
          );

          let score = 0;
          if (station.icao.toLowerCase() === query) score += 100;
          if (station.icao.toLowerCase().startsWith(query)) score += 80;
          if (haystack.includes(query)) score += 40;
          for (const term of terms) {
            if (station.icao.toLowerCase().startsWith(term)) score += 30;
            if (haystack.includes(term)) score += 10;
          }

          return score > 0 ? { station, score } : null;
        })
        .filter(Boolean) as { station: AirportSearchResult; score: number }[];

      scored.sort((a, b) => b.score - a.score);

      const results = scored.slice(0, 12).map(({ station }) => station);
      return res.json(results);
    } catch (error) {
      console.error("Airport search failed:", error);
      res.status(500).json({ error: "Failed to search airports" });
    }
  });

  app.get("/api/airports/route-suggestions", airportSearchRateLimiter, airportLookupRateLimiter, async (req, res) => {
    try {
      const departure = normalizeIcao(String(req.query.departure || ""));
      const destination = normalizeIcao(String(req.query.destination || ""));
      const emptyResponse = {
        departure,
        destination,
        waypoints: [],
        plannedStops: [],
        meta: null,
      };
      if (!/^[A-Z0-9]{3,4}$/.test(departure) || !/^[A-Z0-9]{3,4}$/.test(destination)) {
        return res.json(emptyResponse);
      }

      const cruiseKtas = Math.max(40, toNumber(req.query.cruiseKtas) ?? 110);
      const fuelBurnGph = Math.max(0.1, toNumber(req.query.fuelBurnGph) ?? 8);
      const usableFuelGal = Math.max(0, toNumber(req.query.usableFuelGal) ?? 40);
      const fuelOnBoard = toNumber(req.query.fuelOnBoard);
      const reserveMinutesRaw = toNumber(req.query.reserveMinutes);
      const reserveMinutes = Math.max(0, Math.min(180, reserveMinutesRaw ?? 45));
      const fuelGallons = Math.max(0, fuelOnBoard ?? usableFuelGal);

      const stations = await loadStationCache();
      const referenceMap = await loadAirportReferenceCache().catch(() => null);
      const findStation = (value: string) => {
        const candidates = buildIcaoCandidates(value);
        const station = stations.find((entry) => candidates.includes(entry.icao));
        if (station) return station;
        if (!referenceMap) return null;
        for (const candidate of candidates) {
          const fallback = referenceMap.get(candidate);
          if (fallback && Number.isFinite(fallback.lat) && Number.isFinite(fallback.lon)) {
            return {
              icao: candidate,
              name: fallback.name ?? null,
              city: fallback.city ?? null,
              state: fallback.state ?? null,
              lat: fallback.lat,
              lon: fallback.lon,
            } as AirportSearchResult;
          }
        }
        return null;
      };

      const departureStation = findStation(departure);
      const destinationStation = findStation(destination);
      if (!departureStation || !destinationStation) {
        return res.json({
          ...emptyResponse,
          departure: departureStation?.icao ?? departure,
          destination: destinationStation?.icao ?? destination,
        });
      }

      const routeDistanceNm = distanceNmBetween(
        departureStation.lat,
        departureStation.lon,
        destinationStation.lat,
        destinationStation.lon
      );
      const reserveHours = reserveMinutes / 60;
      const enduranceHours = fuelBurnGph > 0 ? fuelGallons / fuelBurnGph : 0;
      const availableHours = Math.max(0, enduranceHours - reserveHours);
      const maxLegNm = availableHours * cruiseKtas;
      const planningLegNm = maxLegNm * 0.9;

      let stopCount = 0;
      if (planningLegNm > 0 && routeDistanceNm > planningLegNm * 1.1) {
        stopCount = Math.min(3, Math.max(0, Math.ceil(routeDistanceNm / planningLegNm) - 1));
      }

      let waypointCount = 0;
      if (routeDistanceNm > 140) waypointCount = 1;
      if (routeDistanceNm > 320) waypointCount = 2;
      if (routeDistanceNm > 600) waypointCount = 3;

      const bearing = bearingBetween(
        departureStation.lat,
        departureStation.lon,
        destinationStation.lat,
        destinationStation.lon
      );
      const used = new Set<string>([departureStation.icao, destinationStation.icao]);
      const plannedStops: string[] = [];
      const waypoints: string[] = [];
      const candidateRadii = [60, 90, 120, 160];

      const pickAtFraction = (fraction: number) => {
        const target = destinationPoint(
          departureStation.lat,
          departureStation.lon,
          bearing,
          routeDistanceNm * fraction
        );
        for (const radius of candidateRadii) {
          const candidate = findNearestStation(stations, target, used, radius);
          if (candidate) {
            used.add(candidate.icao);
            return candidate.icao;
          }
        }
        return null;
      };

      if (stopCount > 0) {
        const step = 1 / (stopCount + 1);
        for (let i = 1; i <= stopCount; i += 1) {
          const suggestion = pickAtFraction(step * i);
          if (suggestion) plannedStops.push(suggestion);
        }
      }

      if (waypointCount > 0) {
        const fractions =
          waypointCount === 1
            ? [0.5]
            : waypointCount === 2
              ? [0.35, 0.65]
              : [0.25, 0.5, 0.75];
        for (const fraction of fractions) {
          const suggestion = pickAtFraction(fraction);
          if (suggestion) waypoints.push(suggestion);
        }
      }

      return res.json({
        departure: departureStation.icao,
        destination: destinationStation.icao,
        waypoints,
        plannedStops,
        meta: {
          routeDistanceNm: Number(routeDistanceNm.toFixed(1)),
          maxLegNm: Number(maxLegNm.toFixed(1)),
          cruiseKtas,
          fuelBurnGph,
          fuelGallons,
          reserveMinutes,
        },
      });
    } catch (error) {
      console.error("Route suggestion failed:", error);
      res.status(500).json({ error: "Failed to generate route suggestions" });
    }
  });

  app.get("/api/airports/:icao", airportLookupRateLimiter, async (req, res) => {
    try {
      const requestedIcao = normalizeIcao(req.params.icao || "");
      if (requestedIcao.toLowerCase() === "search") {
        return res.status(400).json({ error: "Use /api/airports/search?q=your+city" });
      }
      if (!/^[A-Z0-9]{3,4}$/.test(requestedIcao)) {
        return res.status(400).json({ error: "Invalid ICAO code format" });
      }

      let referenceMap: Map<string, AirportReference> | null = null;
      const getReferenceMap = async () => {
        if (referenceMap) return referenceMap;
        try {
          referenceMap = await loadAirportReferenceCache();
        } catch (error) {
          console.warn("Airport reference cache failed:", error);
          referenceMap = null;
        }
        return referenceMap;
      };

      const candidates = buildIcaoCandidates(requestedIcao);

      for (const candidate of candidates) {
        const cached = getCachedAirport(candidate);
        if (cached) {
          return res.json({ ...cached, cached: true });
        }

        const stationUrls = [
          `https://aviationweather.gov/api/data/station?ids=${candidate}&format=json`,
          `https://aviationweather.gov/api/data/airport?ids=${candidate}&format=json`,
          `https://aviationweather.gov/api/data/stations?ids=${candidate}&format=json`,
        ];

        const fetchStation = async (url: string) => {
          try {
            const response = await fetchWithTimeout(
              url,
              { headers: { "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)" } },
              6000
            );
            if (!response.ok) {
              return null;
            }
            return await response.json();
          } catch {
            return null;
          }
        };

        let stationData: any = null;
        for (const url of stationUrls) {
          stationData = await fetchStation(url);
          if (stationData) break;
        }

        const stationCandidate = Array.isArray(stationData)
          ? stationData[0]
          : stationData?.[0] ?? stationData?.data?.[0] ?? stationData;

        if (!stationCandidate) {
          const refMap = await getReferenceMap();
          const fallback = refMap?.get(candidate);
          if (fallback) {
            const payload: AirportMeta = {
              icao: candidate,
              name: fallback.name ?? null,
              lat: Number(fallback.lat),
              lon: Number(fallback.lon),
              elevationFt: null,
              timezone: fallback.timezone ?? null,
            };

            setCachedAirport(candidate, payload);
            if (candidate !== requestedIcao) {
              setCachedAirport(requestedIcao, payload);
            }
            return res.json({ ...payload, cached: false, source: "ourairports" });
          }
          continue;
        }

        const lat = Number(
          stationCandidate.latitude ??
            stationCandidate.lat ??
            stationCandidate.latitude_dec ??
            stationCandidate.lat_dec ??
            stationCandidate.latDec
        );
        const lon = Number(
          stationCandidate.longitude ??
            stationCandidate.lon ??
            stationCandidate.longitude_dec ??
            stationCandidate.lon_dec ??
            stationCandidate.lonDec
        );

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          const refMap = await getReferenceMap();
          const fallback = refMap?.get(candidate);
          if (fallback) {
            const payload: AirportMeta = {
              icao: candidate,
              name: fallback.name ?? null,
              lat: Number(fallback.lat),
              lon: Number(fallback.lon),
              elevationFt: null,
              timezone: fallback.timezone ?? null,
            };

            setCachedAirport(candidate, payload);
            if (candidate !== requestedIcao) {
              setCachedAirport(requestedIcao, payload);
            }
            return res.json({ ...payload, cached: false, source: "ourairports" });
          }
          continue;
        }

        let timezone: string | null = null;
        try {
          const tzMap = await loadAirportTimezoneCache();
          timezone =
            tzMap.get(candidate) ??
            (candidate.length === 4 && candidate.startsWith("K")
              ? tzMap.get(candidate.slice(1))
              : null) ??
            null;
        } catch (error) {
          console.warn("Airport timezone lookup failed:", error);
        }
        if (!timezone) {
          const refMap = await getReferenceMap();
          const fallback = refMap?.get(candidate);
          timezone = fallback?.timezone ?? null;
        }

        const payload: AirportMeta = {
          icao: candidate,
          name:
            stationCandidate.site ??
            stationCandidate.name ??
            stationCandidate.stationName ??
            stationCandidate.facilityName ??
            null,
          lat,
          lon,
          elevationFt: stationCandidate.elevation ? Number(stationCandidate.elevation) : null,
          timezone,
        };

        setCachedAirport(candidate, payload);
        if (candidate !== requestedIcao) {
          setCachedAirport(requestedIcao, payload);
        }
        return res.json({ ...payload, cached: false });
      }

      return res.status(404).json({ error: "Airport not found" });
    } catch (error) {
      console.error("Airport lookup failed:", error);
      res.status(500).json({ error: "Failed to fetch airport data" });
    }
  });

  app.get("/api/aviation-weather/:icao", weatherRateLimiter, async (req, res) => {
    try {
      const requestedIcao = normalizeIcao(req.params.icao || "");
      
      // Validate ICAO format (3-4 letter code)
      if (!/^[A-Z0-9]{3,4}$/.test(requestedIcao)) {
        return res.status(400).json({ error: "Invalid ICAO code format" });
      }

      const now = Date.now();
      const candidates = buildIcaoCandidates(requestedIcao);

      for (const candidate of candidates) {
        const cached = weatherCache.get(candidate);

        // Return cached data if fresh
        if (cached && (now - cached.timestamp) < WEATHER_CACHE_TTL) {
          return res.json({ ...cached.data, cached: true });
        }

        // Fetch METAR and TAF from Aviation Weather Center API
        const metarUrl = `https://aviationweather.gov/api/data/metar?ids=${candidate}&format=json`;
        const tafUrl = `https://aviationweather.gov/api/data/taf?ids=${candidate}&format=json`;

        const [metarRes, tafRes] = await Promise.all([
          fetchWithTimeout(metarUrl, { headers: { "User-Agent": "ReadySetFly/1.0" } }, 6000).catch(
            () => null
          ),
          fetchWithTimeout(tafUrl, { headers: { "User-Agent": "ReadySetFly/1.0" } }, 6000).catch(
            () => null
          ),
        ]);

        let metar = null;
        let taf = null;
        let metarError = null;
        let tafError = null;

        const parseWeatherPayload = async (response: Response | null, label: string) => {
          if (!response) {
            return { data: null, error: `${label} timeout` };
          }
          if (!response.ok) {
            return { data: null, error: `${label} unavailable (${response.status})` };
          }
          const body = await response.text();
          const trimmed = body.trim();
          if (!trimmed) {
            return { data: null, error: `${label} empty response` };
          }
          if (trimmed.startsWith("<")) {
            return { data: null, error: `${label} unexpected response` };
          }
          try {
            const parsed = JSON.parse(trimmed);
            const data = Array.isArray(parsed) ? parsed[0] ?? null : parsed ?? null;
            return { data, error: null };
          } catch (e) {
            logDebug(`${label} parse error for ${candidate}:`, e);
            return { data: null, error: `Failed to parse ${label} response` };
          }
        };

        const metarPayload = await parseWeatherPayload(metarRes, "METAR");
        const tafPayload = await parseWeatherPayload(tafRes, "TAF");
        metar = metarPayload.data;
        taf = tafPayload.data;
        metarError = metarPayload.error;
        tafError = tafPayload.error;

        if (!metar && !taf && metarError && tafError) {
          continue;
        }

        const responseData = {
          icao: candidate,
          metar,
          taf,
          timestamp: now,
          cached: false
        };

        weatherCache.set(candidate, { data: responseData, timestamp: now });
        if (candidate !== requestedIcao) {
          weatherCache.set(requestedIcao, { data: responseData, timestamp: now });
        }

        if (weatherCache.size > 100) {
          const oldestKey = weatherCache.keys().next().value as string | undefined;
          if (oldestKey) {
            weatherCache.delete(oldestKey);
          }
        }

        return res.json(responseData);
      }

      return res.status(404).json({ 
        error: `No weather data available for ${requestedIcao}. This airport may not report METAR/TAF data.`,
      });
    } catch (error) {
      console.error("Aviation weather fetch error:", error);
      res.status(500).json({ error: "Failed to fetch aviation weather data" });
    }
  });

  app.get("/api/aviation/metar/:icao", async (req, res) => {
    try {
      const requestedIcao = normalizeIcao(req.params.icao || "");
      if (!/^[A-Z0-9]{3,4}$/.test(requestedIcao)) {
        return res.status(400).json({ error: "Invalid ICAO code format" });
      }

      const result = await fetchMetar(requestedIcao);
      res.json({
        icao: requestedIcao,
        ...result,
      });
    } catch (error) {
      console.error("METAR fetch failed:", error);
      res.status(500).json({ error: "Failed to fetch METAR" });
    }
  });

  app.get("/api/aviation/taf/:icao", async (req, res) => {
    try {
      const requestedIcao = normalizeIcao(req.params.icao || "");
      if (!/^[A-Z0-9]{3,4}$/.test(requestedIcao)) {
        return res.status(400).json({ error: "Invalid ICAO code format" });
      }

      const result = await fetchTaf(requestedIcao);
      res.json({
        icao: requestedIcao,
        ...result,
      });
    } catch (error) {
      console.error("TAF fetch failed:", error);
      res.status(500).json({ error: "Failed to fetch TAF" });
    }
  });

  app.get("/api/aviation/notams/:icao", async (req, res) => {
    const requestedIcao = normalizeIcao(req.params.icao || "");
    if (!/^[A-Z0-9]{3,4}$/.test(requestedIcao)) {
      return res.status(400).json({ error: "Invalid ICAO code format" });
    }
    res.redirect(307, `/api/notams?icao=${requestedIcao}`);
  });

  app.get("/api/aviation/pireps", async (req, res) => {
    try {
      const bbox = typeof req.query.bbox === "string" ? req.query.bbox : null;
      const parsedBbox = parseLatLonBbox(bbox);
      const idParam = typeof req.query.icao === "string" ? normalizeIcao(req.query.icao) : null;
      const radiusNm = toNumber(req.query.radiusNm);
      const distanceSm = radiusNm ? Number((radiusNm * 1.15078).toFixed(1)) : undefined;
      const age = toNumber(req.query.ageHours);
      const level = toNumber(req.query.levelFt);
      const inten = typeof req.query.inten === "string" ? (req.query.inten as "lgt" | "mod" | "sev") : undefined;

      const params = {
        bbox: parsedBbox ? `${parsedBbox.south},${parsedBbox.west},${parsedBbox.north},${parsedBbox.east}` : undefined,
        id: idParam ?? undefined,
        distance: distanceSm,
        age: age ?? undefined,
        level: level ?? undefined,
        inten,
      };

      const result = await fetchPireps(params);
      res.json({
        query: { bbox: params.bbox, icao: idParam, radiusNm: radiusNm ?? null },
        ...result,
        reports: result.data ?? [],
      });
    } catch (error) {
      console.error("PIREPs fetch failed:", error);
      res.status(500).json({ error: "Failed to fetch PIREPs" });
    }
  });

  app.get("/api/aviation/hazards", async (req, res) => {
    try {
      const hazard = typeof req.query.hazard === "string" ? req.query.hazard.toLowerCase() : undefined;
      const level = toNumber(req.query.levelFt);

      const includeGairmet = hazard !== "conv";
      const includeAirmet = hazard !== "conv";
      const includeTcf = !hazard || hazard === "conv";

      const airsigmet = await fetchAirSigmets({
        hazard: (hazard as "conv" | "turb" | "ice" | "ifr") || undefined,
        level: level ?? undefined,
        format: "json",
      });

      const gairmetProduct = hazard === "ice" ? "zulu" : hazard === "turb" ? "tango" : hazard === "ifr" ? "sierra" : undefined;
      const gairmetHazard = hazard === "ice" ? "ice" : hazard === "turb" ? "turb-lo" : hazard === "ifr" ? "ifr" : undefined;

      const gairmet = includeGairmet
        ? await fetchGAirmets({
            product: gairmetProduct,
            hazard: gairmetHazard,
            format: "json",
          })
        : { data: [], decoded: [], fetchedAt: Date.now(), source: "awc", warnings: [] };

      const airmet = includeAirmet
        ? await fetchAirmets({
            hazard: (hazard as "turb" | "ifr" | "conv" | "ice") || undefined,
            level: level ?? undefined,
            format: "json",
          })
        : { data: [], decoded: [], fetchedAt: Date.now(), source: "awc", warnings: [] };

      const tcf = includeTcf
        ? await fetchTcf()
        : { data: null, decoded: null, fetchedAt: Date.now(), source: "awc", warnings: [] };

      const warnings = [
        ...airsigmet.warnings,
        ...gairmet.warnings,
        ...airmet.warnings,
        ...tcf.warnings,
      ];

      res.json({
        source: "awc",
        fetchedAt: Math.max(airsigmet.fetchedAt, gairmet.fetchedAt, airmet.fetchedAt, tcf.fetchedAt),
        warnings,
        airsigmet: airsigmet.data ?? [],
        gairmet: gairmet.data ?? [],
        airmet: airmet.data ?? [],
        tcf: tcf.data ?? null,
      });
    } catch (error) {
      console.error("Hazards fetch failed:", error);
      res.status(500).json({ error: "Failed to fetch hazards" });
    }
  });

  app.get("/api/aviation/winds-temps", async (req, res) => {
    try {
      const altitudeParam = toNumber(req.query.altitude);
      const reportResult = await fetchWindsAloftReport();
      const report = reportResult.data;
      if (!report) {
        return res.status(200).json({
          altitudeFt: null,
          validTime: null,
          dataBasedOn: null,
          stations: [],
          warnings: reportResult.warnings,
        });
      }

      const altitudeFt = pickWindsAltitude(altitudeParam, report.altitudes);
      const bbox = parseLatLonBbox(typeof req.query.bbox === "string" ? req.query.bbox : null);

      const stations = await loadStationCache();
      const stationMap = new Map<string, AirportSearchResult>();
      stations.forEach((station) => {
        stationMap.set(station.icao, station);
        if (station.icao.startsWith("K") && station.icao.length === 4) {
          stationMap.set(station.icao.slice(1), station);
        }
      });

      const results = report.stations
        .map((station) => {
          const sample = station.values[altitudeFt];
          if (!sample || sample.speedKt === null || sample.speedKt <= 0) return null;
          const ref = stationMap.get(station.stationId);
          if (!ref) return null;
          if (bbox) {
            if (ref.lon < bbox.west || ref.lon > bbox.east || ref.lat < bbox.south || ref.lat > bbox.north) {
              return null;
            }
          }
          return {
            stationId: station.stationId,
            icao: ref.icao,
            lat: ref.lat,
            lon: ref.lon,
            windDir: sample.directionDeg,
            windSpeed: sample.speedKt,
            tempC: sample.tempC,
          };
        })
        .filter((item) => Boolean(item));

      res.json({
        altitudeFt,
        validTime: report.validTime,
        dataBasedOn: report.dataBasedOn,
        stations: results,
        warnings: reportResult.warnings,
      });
    } catch (error) {
      console.error("Winds temps fetch failed:", error);
      res.status(500).json({ error: "Failed to fetch winds aloft" });
    }
  });

  app.get("/api/aviation/icing", async (_req, res) => {
    const stub = buildEmptyStub("Icing guidance");
    res.json({
      ...stub,
      data: null,
      layers: [],
      todo: "TODO: Add CIP/FIP icing layers if AWC provides an API endpoint.",
    });
  });

  app.get("/api/aviation/turbulence", async (_req, res) => {
    const stub = buildEmptyStub("Turbulence guidance");
    res.json({
      ...stub,
      data: null,
      layers: [],
      todo: "TODO: Add GTG/AWC turbulence layers if AWC provides an API endpoint.",
    });
  });

  app.get("/api/aviation/gfa/layers", async (_req, res) => {
    const stub = buildEmptyStub("GFA layers");
    res.json({
      ...stub,
      layers: [
        { id: "ceil-vis", label: "Ceiling/Visibility", status: "unavailable" },
        { id: "clouds", label: "Clouds", status: "unavailable" },
        { id: "precip", label: "Precipitation", status: "unavailable" },
        { id: "thunder", label: "Thunderstorms", status: "unavailable" },
        { id: "temp", label: "Temperature", status: "unavailable" },
        { id: "winds", label: "Winds", status: "unavailable" },
        { id: "turbulence", label: "Turbulence", status: "unavailable" },
        { id: "icing", label: "Icing", status: "unavailable" },
      ],
      todo: "TODO: Wire GFA layers when NOAA/AWC offers a public API or tiles.",
    });
  });

  app.get("/api/aviation/gfa/data", async (_req, res) => {
    const stub = buildEmptyStub("GFA data");
    res.json({
      ...stub,
      data: null,
      todo: "TODO: Implement GFA data once NOAA/AWC provides an accessible endpoint.",
    });
  });

  app.get("/api/aviation/cloud-frames", async (req, res) => {
    const source = typeof req.query.source === "string" ? req.query.source : "goes-east";
    const countParam = toNumber(req.query.count);
    const count = countParam && countParam > 0 ? Math.min(countParam, 24) : 12;
    const intervalParam = toNumber(req.query.intervalMin);
    const intervalMinutes = intervalParam && intervalParam > 0 ? intervalParam : 10;

    const now = Date.now();
    const cached = cloudFrameCacheBySource[source];
    if (cached && now - cached.fetchedAt < CLOUD_FRAME_TTL) {
      return res.json({ source, frames: cached.frames });
    }

    const fallbackFrames = buildRecentTimes(new Date(Date.now() - 1000 * 60 * 20), intervalMinutes, count);
    try {
      const capabilitiesUrl =
        "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities";
      const response = await fetchWithTimeout(
        capabilitiesUrl,
        { headers: { "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)" } },
        8000
      );
      if (!response.ok) {
        cloudFrameCacheBySource[source] = { fetchedAt: now, frames: fallbackFrames };
        return res.json({
          source,
          frames: fallbackFrames,
          warning: `Cloud animation fallback (${response.status})`,
        });
      }
      const text = await response.text();
      const layerId = source === "goes-west" ? "GOES-West_ABI_GeoColor" : "GOES-East_ABI_GeoColor";
      const dimensionRegex = new RegExp(
        `<Layer>[\\s\\S]*?<Identifier>${layerId}<\\/Identifier>[\\s\\S]*?<Dimension[\\s\\S]*?<Identifier>Time<\\/Identifier>[\\s\\S]*?<Default>[^<]*<\\/Default>[\\s\\S]*?<Value>([^<]+)<\\/Value>[\\s\\S]*?<\\/Dimension>`,
        "i"
      );
      const valueMatch = text.match(dimensionRegex);
      const parsedFrames = valueMatch ? parseGibsTimeDimension(valueMatch[1], count) : null;
      const frames = parsedFrames && parsedFrames.length > 0 ? parsedFrames : fallbackFrames;

      cloudFrameCacheBySource[source] = { fetchedAt: now, frames };

      res.json({
        source,
        frames,
        warning: parsedFrames && parsedFrames.length > 0 ? undefined : "Cloud animation fallback",
      });
    } catch (error) {
      console.error("Cloud frames fetch failed:", error);
      cloudFrameCacheBySource[source] = { fetchedAt: now, frames: fallbackFrames };
      res.json({ source, frames: fallbackFrames, warning: "Cloud animation fallback" });
    }
  });

  app.get("/api/tiles/rainviewer/*", async (req, res) => {
    try {
      const params = req.params as Record<string, string | undefined>;
      const rawPath = params["0"] || "";
      const trimmedPath = rawPath.replace(/^\/+/, "");
      if (!trimmedPath.startsWith("v2/radar/")) {
        return res.status(400).json({ error: "Unsupported RainViewer path" });
      }
      const targetUrl = `https://tilecache.rainviewer.com/${trimmedPath}`;
      const response = await fetchWithTimeout(
        targetUrl,
        { headers: { "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)" } },
        8000
      );
      const contentType = response.headers.get("content-type") || "image/png";
      const buffer = Buffer.from(await response.arrayBuffer());
      res.status(response.status);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(buffer);
    } catch (error) {
      console.error("RainViewer tile proxy failed:", error);
      res.status(502).json({ error: "RainViewer tile unavailable" });
    }
  });

  app.get("/api/winds-aloft", async (req, res) => {
    try {
      const altitudeParam = toNumber(req.query.altitude);
      const reportResult = await fetchWindsAloftReport();
      const report = reportResult.data;
      if (!report) {
        return res.status(200).json({
          altitudeFt: null,
          validTime: null,
          dataBasedOn: null,
          stations: [],
          warnings: reportResult.warnings,
        });
      }
      const altitudeFt = pickWindsAltitude(altitudeParam, report.altitudes);
      const bbox = parseBbox(typeof req.query.bbox === "string" ? req.query.bbox : null);

      const stations = await loadStationCache();
      const stationMap = new Map<string, AirportSearchResult>();
      stations.forEach((station) => {
        stationMap.set(station.icao, station);
        if (station.icao.startsWith("K") && station.icao.length === 4) {
          stationMap.set(station.icao.slice(1), station);
        }
      });

      const results = report.stations
        .map((station) => {
          const sample = station.values[altitudeFt];
          if (!sample || sample.speedKt === null || sample.speedKt <= 0) return null;
          const ref = stationMap.get(station.stationId);
          if (!ref) return null;
          if (bbox) {
            if (ref.lon < bbox.west || ref.lon > bbox.east || ref.lat < bbox.south || ref.lat > bbox.north) {
              return null;
            }
          }
          return {
            stationId: station.stationId,
            icao: ref.icao,
            lat: ref.lat,
            lon: ref.lon,
            windDir: sample.directionDeg,
            windSpeed: sample.speedKt,
            tempC: sample.tempC,
          };
        })
        .filter((item) => Boolean(item));

      res.json({
        altitudeFt,
        validTime: report.validTime,
        dataBasedOn: report.dataBasedOn,
        stations: results,
        warnings: reportResult.warnings,
      });
    } catch (error) {
      console.error("Winds aloft fetch failed:", error);
      res.status(500).json({ error: "Failed to fetch winds aloft data" });
    }
  });

  // Airport favorites + alerts (auth required)
  app.get("/api/airports/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const favorites = await storage.getAirportFavorites(userId);
      res.json(favorites);
    } catch (error) {
      console.error("Failed to fetch airport favorites:", error);
      res.status(500).json({ error: "Failed to fetch airport favorites" });
    }
  });

  app.get("/api/airports/favorites/check/:icao", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const icao = normalizeIcao(req.params.icao || "");
      if (!/^[A-Z0-9]{3,4}$/.test(icao)) {
        return res.status(400).json({ error: "Invalid ICAO code format" });
      }
      const isFavorited = await storage.checkAirportFavorite(userId, icao);
      res.json({ isFavorited });
    } catch (error) {
      console.error("Failed to check airport favorite:", error);
      res.status(500).json({ error: "Failed to check airport favorite" });
    }
  });

  app.post("/api/airports/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = insertAirportFavoriteSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const favorite = await storage.addAirportFavorite(userId, result.data as any);
      res.status(201).json(favorite);
    } catch (error: any) {
      console.error("Failed to add airport favorite:", error);
      res.status(500).json({ error: error.message || "Failed to add airport favorite" });
    }
  });

  app.delete("/api/airports/favorites/:icao", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const icao = normalizeIcao(req.params.icao || "");
      if (!/^[A-Z0-9]{3,4}$/.test(icao)) {
        return res.status(400).json({ error: "Invalid ICAO code format" });
      }
      const success = await storage.removeAirportFavorite(userId, icao);
      res.json({ success });
    } catch (error) {
      console.error("Failed to remove airport favorite:", error);
      res.status(500).json({ error: "Failed to remove airport favorite" });
    }
  });

  app.patch("/api/airports/favorites/:icao/alerts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const icao = normalizeIcao(req.params.icao || "");
      if (!/^[A-Z0-9]{3,4}$/.test(icao)) {
        return res.status(400).json({ error: "Invalid ICAO code format" });
      }
      const result = z
        .object({
          alertIfr: z.boolean().optional(),
          alertMvfr: z.boolean().optional(),
        })
        .safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const updated = await storage.updateAirportFavoriteAlerts(userId, icao, result.data);
      if (!updated) {
        return res.status(404).json({ error: "Airport favorite not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Failed to update airport alerts:", error);
      res.status(500).json({ error: "Failed to update airport alerts" });
    }
  });

  app.get("/api/airports/:icao/runways", async (req, res) => {
    try {
      const requestedIcao = normalizeIcao(req.params.icao || "");
      if (!/^[A-Z0-9]{3,4}$/.test(requestedIcao)) {
        return res.status(400).json({ error: "Invalid ICAO code format" });
      }

      const runwayMap = await loadRunwayCache();
      const runways = runwayMap.get(requestedIcao) || [];
      return res.json({ icao: requestedIcao, runways });
    } catch (error) {
      console.error("Runway lookup failed:", error);
      res.status(500).json({ error: "Failed to fetch runway data" });
    }
  });

  app.get("/api/airports/:icao/runway-briefing", async (req, res) => {
    try {
      const requestedIcao = normalizeIcao(req.params.icao || "");
      if (!/^[A-Z0-9]{3,4}$/.test(requestedIcao)) {
        return res.status(400).json({ error: "Invalid ICAO code format" });
      }

      const runwayMap = await loadRunwayCache();
      const runways = runwayMap.get(requestedIcao) || [];

      const candidates = buildIcaoCandidates(requestedIcao);
      let metar: any | null = null;
      for (const candidate of candidates) {
        const cached = weatherCache.get(candidate);
        if (cached) {
          metar = cached.data?.metar || null;
          if (metar) break;
        }
      }

      if (!metar) {
        const metarRes = await fetchWithTimeout(
          `https://aviationweather.gov/api/data/metar?ids=${requestedIcao}&format=json`,
          { headers: { "User-Agent": "ReadySetFly/1.0" } },
          6000
        ).catch(() => null);
        if (metarRes && metarRes.ok) {
          const body = await metarRes.text();
          const trimmed = body.trim();
          if (trimmed && !trimmed.startsWith("<")) {
            try {
              const metarData = JSON.parse(trimmed);
              metar = Array.isArray(metarData) && metarData.length > 0 ? metarData[0] : null;
            } catch (error) {
              logDebug(`Runway briefing METAR parse error for ${requestedIcao}:`, error);
            }
          }
        }
      }

      const runwayInUse = extractRunwayInUseFromMetar(metar);
      const wind = parseMetarWind(metar);
      const hasWind =
        wind.direction !== null &&
        wind.speed !== null &&
        Number.isFinite(wind.direction) &&
        Number.isFinite(wind.speed);

      const advisory = hasWind && runways.length > 0 && wind.speed !== null
        ? computeRunwayAdvisory(runways, wind.direction!, wind.speed)
        : null;

      res.json({
        icao: requestedIcao,
        runwayInUse,
        wind: {
          direction: wind.direction,
          speed: wind.speed,
          gust: wind.gust,
        },
        advisory: advisory
          ? {
              runway: advisory.runway,
              heading: advisory.heading,
              headwind: Number(advisory.headwind.toFixed(1)),
              crosswind: Number(advisory.crosswind.toFixed(1)),
            }
          : null,
        runways,
      });
    } catch (error) {
      console.error("Runway briefing failed:", error);
      res.status(500).json({ error: "Failed to fetch runway briefing" });
    }
  });

  const fetchSwimNotamSnapshot = async (
    requestedIcao: string,
    start: number
  ): Promise<{ ok: true; notams: Array<{ id: string; text: string; effective?: string; expires?: string }> } | { ok: false; status: number; error: string }> => {
    if (!SWIM_NOTAM_QUERY_BASE_URL) {
      return { ok: false, status: 503, error: "SWIM NOTAM query not configured" };
    }

    const url = buildNotamUrl(SWIM_NOTAM_QUERY_BASE_URL, requestedIcao);
    let extraHeaders: Record<string, string> = {};
    if (SWIM_NOTAM_QUERY_HEADERS_JSON) {
      try {
        extraHeaders = JSON.parse(SWIM_NOTAM_QUERY_HEADERS_JSON);
      } catch (error) {
        console.warn("SWIM_NOTAM_QUERY_HEADERS_JSON is not valid JSON");
      }
    }

    let token: string | null = null;
    if (process.env.SWIM_TOKEN_URL && process.env.SWIM_CLIENT_ID && process.env.SWIM_CLIENT_SECRET) {
      try {
        token = await getSwimAccessToken();
      } catch (error: any) {
        console.warn(`SWIM NOTAM snapshot token failed: ${error?.message || "unknown error"}`);
      }
    }

    try {
      const response = await fetchWithTimeout(
        url,
        {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...extraHeaders,
          },
        },
        8000
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error(
          JSON.stringify({
            event: "notam_backfill_error",
            source: "swim_snapshot",
            icao: requestedIcao,
            status: response.status,
            snippet: errorText.trim().slice(0, 200),
            latencyMs: Date.now() - start,
          })
        );
        return { ok: false, status: response.status, error: `SWIM NOTAM snapshot failed (${response.status})` };
      }

      const payload = await response.json().catch(() => null);
      const notams = normalizeNotams(payload);
      console.log(
        JSON.stringify({
          event: "notam_backfill_fetch",
          source: "swim_snapshot",
          icao: requestedIcao,
          count: notams.length,
          latencyMs: Date.now() - start,
        })
      );
      return { ok: true, notams };
    } catch (error: any) {
      console.error(
        JSON.stringify({
          event: "notam_backfill_error",
          source: "swim_snapshot",
          icao: requestedIcao,
          error: error?.message || "fetch failed",
          latencyMs: Date.now() - start,
        })
      );
      return { ok: false, status: 502, error: "SWIM NOTAM snapshot failed (network)" };
    }
  };

  const upsertNotamsFromSnapshot = async (
    requestedIcao: string,
    notams: Array<{ id: string; text: string; effective?: string; expires?: string }>
  ) => {
    if (!notams.length) return;
    for (const item of notams) {
      const text = item?.text ? String(item.text) : "";
      if (!text.trim()) continue;
      const notamId = item?.id ? String(item.id) : stableNotamIdFromText(`${requestedIcao}|${text}`);
      const effectiveAt = parseNotamDateValue(item?.effective);
      const expiresAt = parseNotamDateValue(item?.expires);
      try {
        await db
          .insert(notamsTable)
          .values({
            icao: requestedIcao,
            notamId,
            text,
            effectiveAt: effectiveAt ?? null,
            expiresAt: expiresAt ?? null,
            source: "swim_backfill",
            raw: item,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: notamsTable.notamId,
            set: {
              icao: requestedIcao,
              text,
              effectiveAt: effectiveAt ?? null,
              expiresAt: expiresAt ?? null,
              raw: item,
              updatedAt: new Date(),
            },
          });
      } catch (error) {
        console.warn("SWIM snapshot upsert failed:", error);
      }
    }
  };

  const fetchHttpNotams = async (
    requestedIcao: string,
    start: number,
    sourceLabel: string
  ): Promise<{ ok: true; notams: any[] } | { ok: false; status: number; error: string }> => {
    if (!NOTAM_HTTP_BASE_URL) {
      return { ok: false, status: 503, error: "NOTAM HTTP source not configured" };
    }

    const url = buildNotamUrl(NOTAM_HTTP_BASE_URL, requestedIcao);
    let extraHeaders: Record<string, string> = {};
    const extraHeadersRaw = process.env.NOTAM_HTTP_HEADERS_JSON;
    if (extraHeadersRaw) {
      try {
        extraHeaders = JSON.parse(extraHeadersRaw);
      } catch (error) {
        console.warn("NOTAM_HTTP_HEADERS_JSON is not valid JSON");
      }
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(
        url,
        {
          headers: {
            Accept: "application/json",
            ...extraHeaders,
          },
        },
        8000
      );
    } catch (error: any) {
      console.error(
        JSON.stringify({
          event: "notam_fetch_error",
          source: sourceLabel,
          icao: requestedIcao,
          error: error?.message || "fetch failed",
          latencyMs: Date.now() - start,
        })
      );
      return { ok: false, status: 502, error: "NOTAM fetch failed (network)" };
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(
        JSON.stringify({
          event: "notam_fetch_error",
          source: sourceLabel,
          icao: requestedIcao,
          status: response.status,
          snippet: errorText.trim().slice(0, 200),
          latencyMs: Date.now() - start,
        })
      );
      return { ok: false, status: response.status, error: `NOTAM fetch failed (${response.status})` };
    }

    const payload = await response.json().catch(() => null);
    const notams = normalizeNotams(payload);
    console.log(
      JSON.stringify({
        event: "notam_fetch",
        source: sourceLabel,
        icao: requestedIcao,
        status: response.status,
        count: notams.length,
        latencyMs: Date.now() - start,
      })
    );
    return { ok: true, notams };
  };

  app.get("/api/notams", notamRateLimiter, async (req, res) => {
    const start = Date.now();
    try {
      const requestedIcao = normalizeIcao(String(req.query?.icao || ""));
      if (!/^[A-Z0-9]{3,4}$/.test(requestedIcao)) {
        return res.status(400).json({ error: "Invalid ICAO code format" });
      }

      if (NOTAM_SOURCE === "swim_jms") {
        const nowDate = new Date();
        const altIcao =
          requestedIcao.length === 4 && requestedIcao.startsWith("K")
            ? requestedIcao.slice(1)
            : null;
        const icaoClause = altIcao
          ? or(eq(notamsTable.icao, requestedIcao), eq(notamsTable.icao, altIcao))
          : eq(notamsTable.icao, requestedIcao);
        const rows = await db
          .select()
          .from(notamsTable)
          .where(and(icaoClause, or(isNull(notamsTable.expiresAt), gte(notamsTable.expiresAt, nowDate))))
          .orderBy(desc(notamsTable.effectiveAt), desc(notamsTable.createdAt))
          .limit(50);

        if (rows.length > 0) {
          console.log(
            JSON.stringify({
              event: "notam_fetch",
              source: NOTAM_SOURCE,
              icao: requestedIcao,
              count: rows.length,
              latencyMs: Date.now() - start,
            })
          );
          return res.json({
            icao: requestedIcao,
            source: NOTAM_SOURCE,
            notams: rows.map((row) => ({
              id: row.notamId,
              text: row.text,
              effective: row.effectiveAt ? row.effectiveAt.toISOString() : undefined,
              expires: row.expiresAt ? row.expiresAt.toISOString() : undefined,
            })),
          });
        }

        const backfillCandidates = [requestedIcao];
        if (altIcao) backfillCandidates.push(altIcao);

        if (SWIM_NOTAM_QUERY_BASE_URL) {
          let backfillNotams: Array<{ id: string; text: string; effective?: string; expires?: string }> | null = null;
          let backfillIcao = requestedIcao;

          for (const candidate of backfillCandidates) {
            const cacheKey = `swim_backfill:${candidate}`;
            const cached = getNotamCache<Array<{ id: string; text: string; effective?: string; expires?: string }>>(cacheKey);
            if (cached) {
              backfillNotams = cached;
              backfillIcao = candidate;
              if (cached.length > 0) break;
              continue;
            }

            const snapshot = await fetchSwimNotamSnapshot(candidate, start);
            if (snapshot.ok) {
              setNotamCache(cacheKey, snapshot.notams);
              backfillNotams = snapshot.notams;
              backfillIcao = candidate;
              if (snapshot.notams.length > 0) break;
            } else {
              if (snapshot.status === 401 || snapshot.status === 403) {
                break;
              }
            }
          }

          if (backfillNotams && backfillNotams.length > 0) {
            await upsertNotamsFromSnapshot(backfillIcao, backfillNotams);
            return res.json({
              icao: requestedIcao,
              source: "swim_backfill",
              notams: backfillNotams,
            });
          }
        }

        if (NOTAM_HTTP_BASE_URL) {
          const fallback = await fetchHttpNotams(requestedIcao, start, "http_fallback");
          if (fallback.ok) {
            return res.json({
              icao: requestedIcao,
              source: "http_fallback",
              notams: fallback.notams,
            });
          }

          return res
            .status(fallback.status)
            .json({ icao: requestedIcao, source: NOTAM_SOURCE, notams: [], notice: "Awaiting SWIM stream." });
        }

        return res
          .status(200)
          .json({ icao: requestedIcao, source: NOTAM_SOURCE, notams: [], notice: "Awaiting SWIM stream." });
      }

      const httpResult = await fetchHttpNotams(requestedIcao, start, NOTAM_SOURCE);
      if (!httpResult.ok) {
        return res.status(httpResult.status).json({ error: httpResult.error });
      }
      return res.json({
        icao: requestedIcao,
        source: NOTAM_SOURCE,
        notams: httpResult.notams,
      });
    } catch (error: any) {
      console.error(
        JSON.stringify({
          event: "notam_fetch_error",
          source: NOTAM_SOURCE,
          error: error?.message || "Unknown error",
        })
      );
      return res.status(500).json({ error: error.message || "Failed to fetch NOTAMs" });
    }
  });

  app.get("/api/notams/health", async (_req, res) => {
    try {
      const [latest] = await db
        .select({ updatedAt: notamsTable.updatedAt })
        .from(notamsTable)
        .orderBy(desc(notamsTable.updatedAt))
        .limit(1);

      const lastUpdatedAt = latest?.updatedAt ? new Date(latest.updatedAt) : null;
      const maxAgeMinutes = Number(process.env.NOTAM_HEALTH_MAX_AGE_MINUTES || 60);
      const ageMs = lastUpdatedAt ? Date.now() - lastUpdatedAt.getTime() : null;
      const isStale = ageMs === null ? true : ageMs > maxAgeMinutes * 60 * 1000;

      res.json({
        ok: !isStale,
        lastUpdatedAt: lastUpdatedAt ? lastUpdatedAt.toISOString() : null,
        maxAgeMinutes,
        isStale,
      });
    } catch (error) {
      console.error("NOTAM health check failed:", error);
      res.status(500).json({ ok: false, error: "Failed to check NOTAM health" });
    }
  });

  app.get("/api/aviation/health", (_req, res) => {
    res.json({
      tfrProxyConfigured: Boolean(TFR_ARCGIS_PROXY_URL),
      notamSource: NOTAM_SOURCE || "http",
    });
  });

  const parseTfmsBbox = (raw: string | undefined): string | null => {
    if (!raw) return null;
    const parts = raw.split(",").map((value) => Number(value));
    if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) return null;
    const [minLon, minLat, maxLon, maxLat] = parts;
    if (minLon >= maxLon || minLat >= maxLat) return null;
    return [minLon, minLat, maxLon, maxLat].map((value) => value.toFixed(5)).join(",");
  };

  app.get("/api/tfms/status", isAuthenticated, async (req: any, res) => {
    const started = Date.now();
    try {
      if (!TFMS_ENABLED) {
        return res.status(503).json({ error: "TFMS disabled" });
      }

      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const access = resolveTfmsAccess(user, "alerts");
      if (!access.allowed) {
        return res.status(403).json({ error: "Upgrade required", requiredTier: access.requiredTier });
      }

      const dep = normalizeIcao(String(req.query.dep || ""));
      const dest = normalizeIcao(String(req.query.dest || ""));
      const route = typeof req.query.route === "string" ? req.query.route.trim() : "";

      if (!/^[A-Z0-9]{3,4}$/.test(dep) || !/^[A-Z0-9]{3,4}$/.test(dest)) {
        return res.status(400).json({ error: "Invalid dep/dest ICAO code" });
      }

      const cacheKey = `tfms:status:${TFMS_PROVIDER}:${dep}:${dest}:${route}`;
      let cacheHit = false;
      let payload = getTfmsCache<TfmsStatus>(cacheKey);
      if (!payload) {
        payload = await tfmsProvider.getStatus({ dep, dest, route, now: new Date() });
        setTfmsCache(cacheKey, payload);
      } else {
        cacheHit = true;
      }

      console.log(
        JSON.stringify({
          event: "tfms.status.request",
          userId,
          tier: access.tier,
          dep,
          dest,
          provider: TFMS_PROVIDER,
          cacheHit,
          durationMs: Date.now() - started,
          resultCounts: { alerts: payload.alerts.length },
        })
      );

      return res.json(payload);
    } catch (error: any) {
      console.error("TFMS status failed:", error);
      return res.status(500).json({ error: "Failed to load TFMS status" });
    }
  });

  app.get("/api/tfms/overlay", isAuthenticated, async (req: any, res) => {
    const started = Date.now();
    try {
      if (!TFMS_ENABLED) {
        return res.status(503).json({ error: "TFMS disabled" });
      }

      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const access = resolveTfmsAccess(user, "overlay");
      if (!access.allowed) {
        return res.status(403).json({ error: "Upgrade required", requiredTier: access.requiredTier });
      }

      const rawBbox = typeof req.query.bbox === "string" ? req.query.bbox : undefined;
      const bbox = parseTfmsBbox(rawBbox);
      if (!bbox) {
        return res.status(400).json({ error: "Invalid bbox" });
      }

      const cacheKey = `tfms:overlay:${TFMS_PROVIDER}:${bbox}`;
      let cacheHit = false;
      let payload = getTfmsCache<TfmsOverlay>(cacheKey);
      if (!payload) {
        payload = await tfmsProvider.getOverlay({ bbox, now: new Date() });
        setTfmsCache(cacheKey, payload);
      } else {
        cacheHit = true;
      }

      console.log(
        JSON.stringify({
          event: "tfms.overlay.request",
          userId,
          tier: access.tier,
          bbox,
          provider: TFMS_PROVIDER,
          cacheHit,
          durationMs: Date.now() - started,
          resultCounts: { features: payload.features.length },
        })
      );

      return res.json(payload);
    } catch (error: any) {
      console.error("TFMS overlay failed:", error);
      return res.status(500).json({ error: "Failed to load TFMS overlay" });
    }
  });

  app.get("/api/tfms/risk", isAuthenticated, async (req: any, res) => {
    const started = Date.now();
    try {
      if (!TFMS_ENABLED) {
        return res.status(503).json({ error: "TFMS disabled" });
      }

      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const access = resolveTfmsAccess(user, "risk");
      if (!access.allowed) {
        return res.status(403).json({ error: "Upgrade required", requiredTier: access.requiredTier });
      }

      const dep = normalizeIcao(String(req.query.dep || ""));
      const dest = normalizeIcao(String(req.query.dest || ""));
      const route = typeof req.query.route === "string" ? req.query.route.trim() : "";
      if (!/^[A-Z0-9]{3,4}$/.test(dep) || !/^[A-Z0-9]{3,4}$/.test(dest)) {
        return res.status(400).json({ error: "Invalid dep/dest ICAO code" });
      }

      const cacheKey = `tfms:risk:${TFMS_PROVIDER}:${dep}:${dest}:${route}`;
      let cacheHit = false;
      let payload = getTfmsCache<any>(cacheKey);
      if (!payload) {
        const inputs = await tfmsProvider.getRiskInputs({ dep, dest, route, now: new Date() });
        const result = computeTfmsRisk(inputs.alerts, inputs.congestion);
        payload = {
          generatedAt: new Date().toISOString(),
          riskScore: result.riskScore,
          rating: result.rating,
          factors: result.factors,
          disclaimer: "Decision-support only; verify with official sources.",
        };
        setTfmsCache(cacheKey, payload);
      } else {
        cacheHit = true;
      }

      console.log(
        JSON.stringify({
          event: "tfms.risk.request",
          userId,
          tier: access.tier,
          dep,
          dest,
          provider: TFMS_PROVIDER,
          cacheHit,
          durationMs: Date.now() - started,
        })
      );

      return res.json(payload);
    } catch (error: any) {
      console.error("TFMS risk failed:", error);
      return res.status(500).json({ error: "Failed to load TFMS risk" });
    }
  });

  app.get("/api/notams/:icao", notamRateLimiter, async (req, res) => {
    const requestedIcao = normalizeIcao(req.params.icao || "");
    if (!/^[A-Z0-9]{3,4}$/.test(requestedIcao)) {
      return res.status(400).json({ error: "Invalid ICAO code format" });
    }
    return res.redirect(307, `/api/notams?icao=${requestedIcao}`);
  });

  app.get("/api/tfrs", tfrRateLimiter, async (req, res) => {
    try {
      const requestId = crypto.randomUUID?.() || crypto.randomBytes(8).toString("hex");
      const cacheKey = "ALL";
      const now = Date.now();
      const cached = tfrCache.get(cacheKey);
      const debug = String(req.query?.debug || "") === "1";
      const force = String(req.query?.force || "") === "1";
      const cacheValid = !force && cached && cached.expiresAt > now;
      const bbox = parseBboxParam(req.query?.bbox);
      const lat = Number(req.query?.lat);
      const lon = Number(req.query?.lon);
      const radiusNm = Number(req.query?.radiusNm);
      const hasRadiusFilter = Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(radiusNm);

      let arcgisMeta:
        | { attempted: boolean; ok: boolean; error?: string; attempts?: Array<{ url: string; ok: boolean; status?: number; error?: string }> }
        | null = null;
      let wfsMeta:
        | { attempted: boolean; ok: boolean; error?: string; attempts?: Array<{ url: string; ok: boolean; status?: number; error?: string }> }
        | null = null;

      const buildPayload = async () => {
        const arcgisResult = await fetchArcGisTfrs();
        arcgisMeta = {
          attempted: true,
          ok: Boolean(arcgisResult?.data),
          error: arcgisResult?.error,
          attempts: arcgisResult?.attempts,
        };
        if (arcgisResult?.data) {
          const enrichedFeatures = await enrichArcGisTfrFeatures(arcgisResult.data.features || []);
          return {
            payload: {
              ...arcgisResult.data,
              features: enrichedFeatures,
            },
            staleHint: false,
          };
        }

        const wfsResult = await fetchSuaWfsTfrs();
        wfsMeta = {
          attempted: true,
          ok: Boolean(wfsResult?.data),
          error: wfsResult?.error,
          attempts: wfsResult?.attempts,
        };
        if (wfsResult?.data) {
          const enrichedFeatures = await enrichArcGisTfrFeatures(wfsResult.data.features || []);
          return {
            payload: {
              ...wfsResult.data,
              features: enrichedFeatures,
            },
            staleHint: false,
          };
        }

        const nowDate = new Date();
        const rows = await db
          .select()
          .from(notamsTable)
          .where(
            and(
              eq(notamsTable.source, "nms_api"),
              or(isNull(notamsTable.expiresAt), gte(notamsTable.expiresAt, nowDate)),
              or(
                ilike(notamsTable.notamId, "FDC%"),
                ilike(notamsTable.text, "%TFR%"),
                ilike(notamsTable.text, "%TEMPORARY FLIGHT RESTRICTION%")
              )
            )
          )
          .orderBy(desc(notamsTable.effectiveAt), desc(notamsTable.createdAt))
          .limit(3000);

        const features = rows
          .filter((row) => row.text && isTfrNotam(row.text, row.notamId))
          .map((row) => {
            const rawGeometry = (row.raw as any)?.geometry;
            const reason = extractLineValue(row.text, "Reason for NOTAM");
            const location = extractLineValue(row.text, "Location");
            const tfrType = extractLineValue(row.text, "Type");
            const altitude = extractAltitudeFromNotam(row.text);
            if (rawGeometry && rawGeometry.type && rawGeometry.coordinates) {
              return {
                type: "Feature",
                geometry: rawGeometry,
                properties: {
                  notamId: row.notamId,
                  icao: row.icao,
                  location,
                  reason,
                  tfrType,
                  altitude,
                  effectiveAt: row.effectiveAt ? row.effectiveAt.toISOString() : null,
                  expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
                  text: row.text,
                  source: row.source,
                },
              };
            }

            const points = parseTfrPolygon(row.text || "");
            if (!points || points.length < 3) return null;

            return {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [points.map((p) => [p.lon, p.lat])],
              },
              properties: {
                notamId: row.notamId,
                icao: row.icao,
                location,
                reason,
                tfrType,
                altitude,
                effectiveAt: row.effectiveAt ? row.effectiveAt.toISOString() : null,
                expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
                text: row.text,
              },
            };
          })
          .filter(Boolean);

        if (!features.length && tfrLastSuccess && Date.now() - tfrLastSuccess.fetchedAt < TFR_STALE_MAX_AGE_MS) {
          return {
            payload: {
              ...tfrLastSuccess.data,
              source: "faa-arcgis-stale",
            },
            staleHint: true,
          };
        }

        return {
          payload: {
            type: "FeatureCollection",
            features,
            updatedAt: new Date().toISOString(),
            source: "notam-cache",
          },
          staleHint: false,
        };
      };

      let payload = cacheValid ? cached?.data : null;
      let stale = false;

      if (!payload) {
        try {
          const result = await buildPayload();
          payload = result.payload;
          stale = result.staleHint;
          const ttl =
            stale || !payload?.features?.length ? TFR_EMPTY_CACHE_TTL_MS : TFR_CACHE_TTL_MS;
          tfrCache.set(cacheKey, { data: payload, expiresAt: Date.now() + ttl });
        } catch (error) {
          console.error("TFR fetch failed:", error);
          if (cached?.data) {
            payload = cached.data;
            stale = true;
          } else {
            return res.status(502).json({ error: "Failed to fetch TFRs", stale: false });
          }
        }
      }

      const icaoFilter = String(req.query?.icao || "").toUpperCase();
      const altIcao = icaoFilter.length === 4 && icaoFilter.startsWith("K") ? icaoFilter.slice(1) : null;

      if (payload?.source === "faa-arcgis-stale") {
        stale = true;
      }

      let filteredFeatures = (payload.features || []).filter((feature: any) => {
        if (!icaoFilter) return true;
        const icao = feature?.properties?.icao;
        return icao === icaoFilter || (altIcao && icao === altIcao);
      });

      if (bbox) {
        filteredFeatures = filteredFeatures.filter((feature: any) => featureIntersectsBbox(feature, bbox));
      }

      if (hasRadiusFilter) {
        filteredFeatures = filteredFeatures.filter((feature: any) => {
          const centroid = getFeatureCentroid(feature);
          if (!centroid) return false;
          return distanceNmBetween(lat, lon, centroid.lat, centroid.lon) <= radiusNm;
        });
      }

      if (debug && !arcgisMeta && !(payload?.features || []).length) {
        const arcgisResult = await fetchArcGisTfrs(bbox || undefined);
        arcgisMeta = {
          attempted: true,
          ok: Boolean(arcgisResult?.data),
          error: arcgisResult?.error,
          attempts: arcgisResult?.attempts,
        };
      }

      if (arcgisMeta?.attempted && !arcgisMeta.ok) {
        console.error(
          JSON.stringify({
            event: "tfr_upstream_error",
            requestId,
            error: arcgisMeta.error,
            attempts: arcgisMeta.attempts,
          })
        );
      }

      if (wfsMeta && wfsMeta.attempted && !wfsMeta.ok) {
        console.error(
          JSON.stringify({
            event: "tfr_wfs_upstream_error",
            requestId,
            error: wfsMeta.error,
            attempts: wfsMeta.attempts,
          })
        );
      }

      const responsePayload: any = {
        ...payload,
        features: filteredFeatures,
        stale,
      };

      if (debug && (arcgisMeta || wfsMeta)) {
        responsePayload.debug = {
          ...(arcgisMeta ? { arcgis: arcgisMeta } : {}),
          ...(wfsMeta ? { wfs: wfsMeta } : {}),
        };
      }

      const latencyMs = Date.now() - now;
      const arcgisAttempt = arcgisMeta?.attempts?.find((attempt) => attempt.ok) || arcgisMeta?.attempts?.[0];
      console.log(
        JSON.stringify({
          event: "tfr_fetch",
          requestId,
          proxyConfigured: Boolean(TFR_ARCGIS_PROXY_URL),
          source: payload?.source || "unknown",
          arcgisUrl: arcgisAttempt?.url,
          arcgisStatus: arcgisAttempt?.status,
          count: filteredFeatures.length,
          stale,
          latencyMs,
        })
      );

      res.json(responsePayload);
    } catch (error: any) {
      console.error(
        JSON.stringify({
          event: "tfr_fetch_error",
          error: error?.message || "Unknown error",
        })
      );
      const cached = tfrCache.get("ALL");
      if (cached?.data) {
        return res.status(200).json({ ...cached.data, stale: true });
      }
      res.status(502).json({ error: "Failed to fetch TFRs", stale: false });
    }
  });

  app.get("/api/airspace/sua", async (req, res) => {
    try {
      const bbox = parseBboxParam(req.query?.bbox);
      const cacheKey = bbox
        ? `BBOX:${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`
        : "ALL";
      const cached = suaCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return res.json(cached.data);
      }

      const payload = await fetchArcGisSUA(bbox || undefined);
      suaCache.set(cacheKey, { data: payload, expiresAt: Date.now() + SUA_CACHE_TTL_MS });

      console.log(
        JSON.stringify({
          event: "sua_fetch",
          count: payload?.features?.length || 0,
          bbox: bbox ? cacheKey.replace("BBOX:", "") : null,
        })
      );

      return res.json(payload);
    } catch (error: any) {
      console.error("SUA fetch failed:", error);
      const cached = suaCache.get("ALL");
      if (cached?.data) {
        return res.status(200).json({ ...cached.data, stale: true });
      }
      return res.status(502).json({ error: "Failed to load special use airspace", stale: false });
    }
  });

  app.get("/api/adsb/aircraft", async (req, res) => {
    try {
      const apiKey = process.env.ADSBEXCHANGE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "ADSBExchange API key missing" });
      }

      const lat = Number(req.query.lat);
      const lon = Number(req.query.lon);
      const dist = Number(req.query.dist);

      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(dist)) {
        return res.status(400).json({ error: "lat, lon, and dist are required" });
      }

      const clampedDist = Math.min(Math.max(dist, 10), 500);
      const baseUrl = (process.env.ADSBEXCHANGE_API_BASE || "https://api.adsbexchange.com/v2").replace(/\/$/, "");
      const target = `${baseUrl}/lat/${lat}/lon/${lon}/dist/${clampedDist}/`;

      const response = await fetchWithTimeout(
        target,
        {
          headers: {
            "api-auth": apiKey,
            "accept": "application/json",
          },
        },
        10000
      );

      if (!response.ok) {
        const details = await response.text();
        return res.status(response.status).json({ error: "ADSBExchange request failed", details });
      }

      const payload = await response.json();
      return res.json(payload);
    } catch (error: any) {
      console.error("ADSBExchange fetch failed:", error);
      res.status(500).json({ error: error.message || "Failed to fetch ADS-B data" });
    }
  });

  // Approach Plates (FAA d-TPP metadata, on-demand)
  const platesRateLimiter = createIpRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    message: "Too many plate requests, please try again later",
  });

  // Streaming proxy for plate PDFs (no buffering)
  app.get("/api/plates/proxy", platesRateLimiter, async (req, res) => {
    try {
      const urlParam = String(req.query.url || "");
      if (!urlParam) {
        return res.status(400).json({ error: "Missing url" });
      }

      const decodedUrl = decodeURIComponent(urlParam);
      const target = new URL(decodedUrl);
      const allowedHosts = (process.env.FAA_PLATE_PROXY_HOSTS || "aeronav.faa.gov,www.aeronav.faa.gov")
        .split(",")
        .map((host) => host.trim())
        .filter(Boolean);

      if (!allowedHosts.includes(target.hostname)) {
        return res.status(400).json({ error: "URL host not allowed" });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const upstream = await fetch(target.toString(), { signal: controller.signal });
      clearTimeout(timeout);

      if (!upstream.ok || !upstream.body) {
        const body = await upstream.text().catch(() => "");
        return res.status(upstream.status).send(body || "Failed to fetch plate");
      }

      const contentLength = upstream.headers.get("content-length");
      if (contentLength && Number(contentLength) > 20 * 1024 * 1024) {
        return res.status(413).json({ error: "Plate file too large" });
      }

      res.status(upstream.status);
      const contentType = upstream.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      if (contentLength) res.setHeader("Content-Length", contentLength);
      const cacheControl = upstream.headers.get("cache-control");
      if (cacheControl) res.setHeader("Cache-Control", cacheControl);

      // Stream without buffering to avoid memory spikes
      await pipeline(Readable.fromWeb(upstream.body as any), res);
    } catch (error: any) {
      console.error("Plate proxy error:", error);
      if (res.headersSent) {
        res.end();
        return;
      }
      res.status(500).json({ error: "Failed to proxy plate", details: error.message || String(error) });
    }
  });

  app.get("/api/plates/:icao", platesRateLimiter, async (req, res) => {
    try {
      const icao = normalizeIcao(req.params.icao || "");
      if (!/^[A-Z0-9]{3,4}$/.test(icao)) {
        return res.status(400).json({ error: "Invalid ICAO code format" });
      }

      const plates = await fetchPlateMetadataForIcao(icao);
      res.json({
        icao,
        fetchedAt: new Date().toISOString(),
        plates,
      });
    } catch (error: any) {
      console.error("Approach plate metadata error:", error);
      res.status(500).json({
        error: "Failed to load approach plates",
        details: error.message || String(error),
        metaUrl: (() => {
          try { return getDtppMetaUrl(); } catch { return null; }
        })(),
      });
    }
  });

  // Legacy Approach Plates (stored PDFs)
  app.get("/api/approach-plates/search", async (req, res) => {
    try {
      const query = String(req.query.q || "").trim();
      const limit = Number(req.query.limit || 50);
      const cycle = process.env.FAA_DTPP_CYCLE;
      let plates = await storage.searchApproachPlates(query, limit, cycle);
      if (cycle && plates.length === 0) {
        plates = await storage.searchApproachPlates(query, limit);
      }
      res.json({ plates, cycle });
    } catch (error) {
      console.error("Approach plate search error:", error);
      res.status(500).json({ error: "Failed to search approach plates" });
    }
  });

  app.get("/api/approach-plates/:id/file", async (req, res) => {
    try {
      const plate = await storage.getApproachPlateById(req.params.id);
      if (!plate) {
        return res.status(404).json({ error: "Approach plate not found" });
      }

      if (plate.storagePath.startsWith("s3:")) {
        const key = plate.storagePath.slice(3);
        const mod = await import("./s3Storage.js");
        const s3Service = new mod.S3StorageService();
        const { stream, contentType, contentLength } = await s3Service.getObjectStream({ key });
        res.set({
          "Content-Type": contentType || "application/pdf",
          "Content-Length": contentLength?.toString() || undefined,
          "Cache-Control": "public, max-age=3600",
        });
        stream.on("error", (err: any) => {
          console.error("S3 stream error:", err);
          if (!res.headersSent) {
            res.status(500).end();
          }
        });
        stream.pipe(res);
        return;
      }

      const filePath = path.resolve(plate.storagePath);
      res.set({
        "Content-Type": "application/pdf",
        "Cache-Control": "public, max-age=3600",
      });
      res.sendFile(filePath);
    } catch (error) {
      console.error("Approach plate fetch error:", error);
      res.status(500).json({ error: "Failed to load approach plate" });
    }
  });

    async function requireMembership(req: any, res: any, next: any) {
      try {
        const userId = req.user?.claims?.sub || req.session?.userId;
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        const entitlements = getEntitlementsForUser(user);
        if (entitlements.tier === "free") {
          return res.status(403).json({ error: "RSF Pro membership required" });
        }
        req.membershipUser = user;
        next();
      } catch (error) {
        console.error("RSF membership guard error:", error);
        res.status(500).json({ error: "Failed to validate membership" });
      }
    }

    async function requireCfiAccess(req: any, res: any, next: any) {
      try {
        const userId = req.user?.claims?.sub || req.session?.userId;
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        const entitlements = getEntitlementsForUser(user);
        if (!entitlements.canUseCfi) {
          return res.status(403).json({ error: "CFI trial or RSF Pro membership required" });
        }
        req.cfiAccessUser = user;
        next();
      } catch (error) {
        console.error("CFI access guard error:", error);
        res.status(500).json({ error: "Failed to validate CFI access" });
      }
    }

    async function requireLogbookPro(req: any, res: any, next: any) {
      try {
        const userId = req.user?.claims?.sub || req.session?.userId;
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        const entitlements = getEntitlementsForUser(user);
        if (!entitlements.canUseLogbook) {
          return res.status(403).json({ error: "RSF Pro membership required" });
        }
        req.logbookProUser = user;
        next();
      } catch (error) {
        console.error("RSF Pro guard error:", error);
        res.status(500).json({ error: "Failed to validate subscription" });
      }
    }

  const normalizeCfiSlug = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const parseCfiDate = (value: unknown) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  // CFI Booking Platform (public directory)
  app.get("/api/cfi/profiles", async (req, res) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const state = typeof req.query.state === "string" ? req.query.state : undefined;
      const airport = typeof req.query.airport === "string" ? req.query.airport : undefined;
      const profiles = await storage.listPublishedCfiProfiles({ q, state, airport });
      res.json(profiles);
    } catch (error) {
      console.error("Failed to list CFI profiles:", error);
      res.status(500).json({ error: "Failed to load CFI directory" });
    }
  });

  app.get("/api/cfi/profiles/:slug", async (req: any, res) => {
    try {
      const profile = await storage.getCfiProfileBySlug(req.params.slug);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!profile.isPublished && profile.userId !== userId) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Failed to fetch CFI profile:", error);
      res.status(500).json({ error: "Failed to load CFI profile" });
    }
  });

  // Start one-time CFI trial (30 days)
  app.post("/api/cfi/trial/start", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const entitlements = getEntitlementsForUser(user);
      if (entitlements.tier !== "free") {
        return res.status(409).json({ error: "RSF Pro membership already active" });
      }

      if (user.cfiTrialRedeemed) {
        return res.status(409).json({ error: "CFI trial already used" });
      }

      const now = new Date();
      const currentTrialEndsAt = user.cfiTrialEndsAt ? new Date(user.cfiTrialEndsAt) : null;
      if (currentTrialEndsAt && currentTrialEndsAt > now) {
        return res.json({ cfiTrialEndsAt: currentTrialEndsAt.toISOString() });
      }

      const trialEndsAt = addDays(now, 30);
      await storage.updateUser(userId, {
        cfiTrialStartedAt: now,
        cfiTrialEndsAt: trialEndsAt,
        cfiTrialRedeemed: true,
      });

      res.json({ cfiTrialEndsAt: trialEndsAt.toISOString() });
    } catch (error) {
      console.error("Failed to start CFI trial:", error);
      res.status(500).json({ error: "Failed to start CFI trial" });
    }
  });

  // CFI dashboard (trial or RSF Pro)
  app.get("/api/cfi/profile", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.json(null);
      }
      const [credentials, availability, cfiTerms] = await Promise.all([
        storage.getCfiCredentials(profile.id),
        storage.getCfiAvailabilityRules(profile.id),
        storage.getCfiLatestLegalAcceptance(userId, "cfi_terms"),
      ]);
      res.json({ profile, credentials, availability, legal: { cfi_terms: !!cfiTerms } });
    } catch (error) {
      console.error("Failed to load CFI dashboard:", error);
      res.status(500).json({ error: "Failed to load CFI dashboard" });
    }
  });

  app.post("/api/cfi/profile", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const existing = await storage.getCfiProfileByUser(userId);
      if (existing) {
        return res.status(409).json({ error: "CFI profile already exists" });
      }
      const payload = { ...req.body };
      if (payload.slug) {
        payload.slug = normalizeCfiSlug(payload.slug);
      }
      const result = insertCfiProfileSchema.safeParse(payload);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      if (result.data.slug) {
        const slugOwner = await storage.getCfiProfileBySlug(result.data.slug);
        if (slugOwner) {
          return res.status(409).json({ error: "Slug already in use" });
        }
      }
      const profile = await storage.createCfiProfile({ ...result.data, userId } as any);
      res.status(201).json(profile);
    } catch (error) {
      console.error("Failed to create CFI profile:", error);
      res.status(500).json({ error: "Failed to create CFI profile" });
    }
  });

  app.patch("/api/cfi/profile", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const existing = await storage.getCfiProfileByUser(userId);
      if (!existing) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const payload = { ...req.body };
      if (payload.slug) {
        payload.slug = normalizeCfiSlug(payload.slug);
      }
      const result = insertCfiProfileSchema.partial().safeParse(payload);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      if (result.data.slug && result.data.slug !== existing.slug) {
        const slugOwner = await storage.getCfiProfileBySlug(result.data.slug);
        if (slugOwner && slugOwner.userId !== userId) {
          return res.status(409).json({ error: "Slug already in use" });
        }
      }
      const updated = await storage.updateCfiProfile(existing.id, userId, result.data as any);
      res.json(updated);
    } catch (error) {
      console.error("Failed to update CFI profile:", error);
      res.status(500).json({ error: "Failed to update CFI profile" });
    }
  });

  app.post("/api/cfi/profile/publish", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const existing = await storage.getCfiProfileByUser(userId);
      if (!existing) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const accepted = await storage.getCfiLatestLegalAcceptance(userId, "cfi_terms");
      if (!accepted) {
        return res.status(403).json({ error: "CFI terms acceptance required" });
      }
      const updated = await storage.updateCfiProfile(existing.id, userId, { isPublished: true });
      res.json(updated);
    } catch (error) {
      console.error("Failed to publish CFI profile:", error);
      res.status(500).json({ error: "Failed to publish CFI profile" });
    }
  });

  app.get("/api/cfi/credentials", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.json([]);
      }
      const credentials = await storage.getCfiCredentials(profile.id);
      res.json(credentials);
    } catch (error) {
      console.error("Failed to load CFI credentials:", error);
      res.status(500).json({ error: "Failed to load CFI credentials" });
    }
  });

  app.post("/api/cfi/credentials", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const result = insertCfiCredentialSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const created = await storage.createCfiCredential({ ...result.data, cfiProfileId: profile.id } as any);
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to create CFI credential:", error);
      res.status(500).json({ error: "Failed to create CFI credential" });
    }
  });

  app.delete("/api/cfi/credentials/:id", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const success = await storage.deleteCfiCredential(req.params.id, profile.id);
      res.json({ success });
    } catch (error) {
      console.error("Failed to delete CFI credential:", error);
      res.status(500).json({ error: "Failed to delete CFI credential" });
    }
  });

  app.get("/api/cfi/availability", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.json([]);
      }
      const rules = await storage.getCfiAvailabilityRules(profile.id);
      res.json(rules);
    } catch (error) {
      console.error("Failed to load CFI availability:", error);
      res.status(500).json({ error: "Failed to load CFI availability" });
    }
  });

  app.put("/api/cfi/availability", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const result = z.array(insertCfiAvailabilityRuleSchema).safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const rules = await storage.replaceCfiAvailabilityRules(profile.id, result.data as any);
      res.json(rules);
    } catch (error) {
      console.error("Failed to update CFI availability:", error);
      res.status(500).json({ error: "Failed to update CFI availability" });
    }
  });

  app.get("/api/cfi/booking-requests", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.json([]);
      }
      const requests = await storage.getCfiBookingRequestsForCfi(profile.id);
      res.json(requests);
    } catch (error) {
      console.error("Failed to load CFI booking requests:", error);
      res.status(500).json({ error: "Failed to load CFI booking requests" });
    }
  });

  app.patch("/api/cfi/booking-requests/:id", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const request = await storage.getCfiBookingRequest(req.params.id);
      if (!request || request.cfiProfileId !== profile.id) {
        return res.status(404).json({ error: "Booking request not found" });
      }
      const payload = z
        .object({ status: z.string().min(1) })
        .safeParse(req.body || {});
      if (!payload.success) {
        return res.status(400).json({ error: payload.error.format() });
      }
      const updated = await storage.updateCfiBookingRequest(req.params.id, {
        status: payload.data.status,
      });
      res.json(updated);
    } catch (error) {
      console.error("Failed to update CFI booking request:", error);
      res.status(500).json({ error: "Failed to update CFI booking request" });
    }
  });

  app.get("/api/cfi/booking-requests/sent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const requests = await storage.getCfiBookingRequestsForStudent(userId);
      res.json(requests);
    } catch (error) {
      console.error("Failed to load student booking requests:", error);
      res.status(500).json({ error: "Failed to load booking requests" });
    }
  });

  app.post("/api/cfi/profiles/:slug/requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileBySlug(req.params.slug);
      if (!profile || !profile.isPublished) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      if (profile.userId === userId) {
        return res.status(400).json({ error: "Cannot request your own profile" });
      }
      const accepted = await storage.getCfiLatestLegalAcceptance(userId, "cfi_student_terms");
      if (!accepted) {
        return res.status(403).json({ error: "Student terms acceptance required" });
      }
      const payload = { ...req.body };
      payload.requestedStart = parseCfiDate(payload.requestedStart);
      payload.requestedEnd = parseCfiDate(payload.requestedEnd);
      if (!payload.requestedStart || !payload.requestedEnd) {
        return res.status(400).json({ error: "Invalid requested start/end" });
      }
      const result = insertCfiBookingRequestSchema.safeParse(payload);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const created = await storage.createCfiBookingRequest({
        ...result.data,
        cfiProfileId: profile.id,
        studentUserId: userId,
      } as any);
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to create CFI booking request:", error);
      res.status(500).json({ error: "Failed to create CFI booking request" });
    }
  });

  app.post("/api/cfi/legal-acceptances", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const payload = {
        ...req.body,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      };
      const result = insertCfiLegalAcceptanceSchema.safeParse(payload);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const created = await storage.createCfiLegalAcceptance({ ...result.data, userId } as any);
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to record CFI legal acceptance:", error);
      res.status(500).json({ error: "Failed to record legal acceptance" });
    }
  });

  app.get("/api/cfi/legal-acceptances", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const acceptanceType = typeof req.query.type === "string" ? req.query.type : "";
      if (!acceptanceType) {
        return res.status(400).json({ error: "Acceptance type required" });
      }
      const acceptance = await storage.getCfiLatestLegalAcceptance(userId, acceptanceType);
      res.json(acceptance || null);
    } catch (error) {
      console.error("Failed to fetch CFI legal acceptance:", error);
      res.status(500).json({ error: "Failed to fetch legal acceptance" });
    }
  });

  // Pilot Logbook Routes (authenticated users only)
  app.get("/api/logbook", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const entries = await storage.getLogbookEntriesByUser(userId);
      res.json(entries);
    } catch (error) {
      console.error("Failed to fetch logbook entries:", error);
      res.status(500).json({ error: "Failed to fetch logbook entries" });
    }
  });

  app.post("/api/logbook", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = insertLogbookEntrySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const entry = await storage.createLogbookEntry({ ...(result.data as any), userId });
      res.status(201).json(entry);
    } catch (error) {
      console.error("Failed to create logbook entry:", error);
      res.status(500).json({ error: "Failed to create logbook entry" });
    }
  });

  app.get("/api/logbook/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const entry = await storage.getLogbookEntryById(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: "Logbook entry not found" });
      }
      // Ensure user owns this entry
      if (entry.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(entry);
    } catch (error) {
      console.error("Failed to fetch logbook entry:", error);
      res.status(500).json({ error: "Failed to fetch logbook entry" });
    }
  });

  app.patch("/api/logbook/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const existing = await storage.getLogbookEntryById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Logbook entry not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const result = insertLogbookEntrySchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      // Convert flightDate string to Date if present
      const updateData = {
        ...result.data,
        flightDate: result.data.flightDate ? (typeof result.data.flightDate === 'string' ? new Date(result.data.flightDate) : result.data.flightDate) : undefined,
      };
      const entry = await storage.updateLogbookEntry(req.params.id, updateData as any);
      res.json(entry);
    } catch (error: any) {
      console.error("Failed to update logbook entry:", error);
      res.status(error.message?.includes("locked") ? 403 : 500).json({ 
        error: error.message || "Failed to update logbook entry" 
      });
    }
  });

  app.post("/api/logbook/:id/lock", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const existing = await storage.getLogbookEntryById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Logbook entry not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { signatureDataUrl, signedByName } = req.body;
      if (!signatureDataUrl || !signedByName) {
        return res.status(400).json({ error: "signatureDataUrl and signedByName are required" });
      }
      const forwarded = (req.headers["x-forwarded-for"] as string) || "";
      const ip = forwarded.split(",")[0].trim() || req.ip;
      const entry = await storage.lockLogbookEntry(req.params.id, signatureDataUrl, signedByName, ip);
      res.json(entry);
    } catch (error: any) {
      console.error("Failed to lock logbook entry:", error);
      res.status(error.message?.includes("locked") || error.message?.includes("not found") ? 400 : 500).json({ 
        error: error.message || "Failed to lock logbook entry" 
      });
    }
  });

  app.post("/api/logbook/:id/countersign", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const existing = await storage.getLogbookEntryById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Logbook entry not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { signatureDataUrl, signedByName } = req.body;
      if (!signatureDataUrl || !signedByName) {
        return res.status(400).json({ error: "signatureDataUrl and signedByName are required" });
      }
      const forwarded = (req.headers["x-forwarded-for"] as string) || "";
      const ip = forwarded.split(",")[0].trim() || req.ip;
      const entry = await storage.countersignLogbookEntry(req.params.id, signatureDataUrl, signedByName, ip);
      res.json(entry);
    } catch (error: any) {
      console.error("Failed to countersign logbook entry:", error);
      res.status(error.message?.includes("not found") ? 404 : 500).json({ 
        error: error.message || "Failed to countersign logbook entry" 
      });
    }
  });

  app.post("/api/logbook/:id/unlock", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const existing = await storage.getLogbookEntryById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Logbook entry not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const entry = await storage.unlockLogbookEntry(req.params.id);
      res.json(entry);
    } catch (error: any) {
      console.error("Failed to unlock logbook entry:", error);
      res.status(500).json({ error: error.message || "Failed to unlock logbook entry" });
    }
  });

  app.delete("/api/logbook/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const existing = await storage.getLogbookEntryById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Logbook entry not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const success = await storage.deleteLogbookEntry(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Logbook entry not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete logbook entry:", error);
      res.status(error.message?.includes("locked") ? 403 : 500).json({ 
        error: error.message || "Failed to delete logbook entry" 
      });
    }
  });

  const SCHOOL_ADMIN_ROLES = new Set(["owner", "admin"]);

  app.get("/api/cfi/schools", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const schools = await storage.listCfiSchoolsForUser(userId);
      res.json(schools);
    } catch (error) {
      console.error("Failed to list CFI schools:", error);
      res.status(500).json({ error: "Failed to load CFI schools" });
    }
  });

  app.get("/api/cfi/school", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const memberships = await storage.listCfiSchoolMembershipsForUser(userId);
      const adminMembership = memberships.find(
        (member) => member.status === "active" && SCHOOL_ADMIN_ROLES.has(member.role)
      );
      if (!adminMembership) {
        return res.json(null);
      }
      const school = await storage.getCfiSchoolById(adminMembership.schoolId);
      if (!school) {
        return res.json(null);
      }
      const members = await storage.listCfiSchoolMembers(school.id);
      const memberUserIds = members.map((member) => member.userId);
      const memberUsers =
        memberUserIds.length > 0
          ? await db
              .select({
                id: users.id,
                email: users.email,
                firstName: users.firstName,
                lastName: users.lastName,
                profileImageUrl: users.profileImageUrl,
              })
              .from(users)
              .where(inArray(users.id, memberUserIds))
          : [];
      const memberMap = new Map(memberUsers.map((user) => [user.id, user]));
      const enrichedMembers = members.map((member) => ({
        ...member,
        user: memberMap.get(member.userId) || null,
      }));
      const metrics = {
        instructors: enrichedMembers.filter((member) => member.status === "active").length,
        students: 0,
        lessons: 0,
        upcomingLessons: 0,
        completedLessons: 0,
        milestonesCompleted: 0,
      };

      const profileRows = await db
        .select({ id: cfiProfiles.id })
        .from(cfiProfiles)
        .where(eq(cfiProfiles.schoolId, school.id));
      const profileIds = profileRows.map((row) => row.id);

      if (profileIds.length > 0) {
        const [studentCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(cfiStudents)
          .where(inArray(cfiStudents.cfiProfileId, profileIds));
        metrics.students = studentCount?.count ?? 0;

        const [lessonCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(cfiLessons)
          .where(inArray(cfiLessons.cfiProfileId, profileIds));
        metrics.lessons = lessonCount?.count ?? 0;

        const [upcomingCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(cfiLessons)
          .where(and(inArray(cfiLessons.cfiProfileId, profileIds), gte(cfiLessons.scheduledAt, new Date())));
        metrics.upcomingLessons = upcomingCount?.count ?? 0;

        const [completedCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(cfiLessons)
          .where(and(inArray(cfiLessons.cfiProfileId, profileIds), eq(cfiLessons.status, "complete")));
        metrics.completedLessons = completedCount?.count ?? 0;

        const studentRows = await db
          .select({ id: cfiStudents.id })
          .from(cfiStudents)
          .where(inArray(cfiStudents.cfiProfileId, profileIds));
        const studentIds = studentRows.map((row) => row.id);
        if (studentIds.length > 0) {
          const [milestoneCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(cfiStudentMilestones)
            .where(and(inArray(cfiStudentMilestones.studentId, studentIds), eq(cfiStudentMilestones.status, "complete")));
          metrics.milestonesCompleted = milestoneCount?.count ?? 0;
        }
      }

      res.json({ school, members: enrichedMembers, role: adminMembership.role, metrics });
    } catch (error) {
      console.error("Failed to load CFI school dashboard:", error);
      res.status(500).json({ error: "Failed to load school dashboard" });
    }
  });

  app.post("/api/cfi/school", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const existing = await storage.getCfiSchoolByOwner(userId);
      if (existing) {
        return res.status(409).json({ error: "School already exists for this owner" });
      }
      const payload = { ...req.body };
      if (payload.slug) {
        payload.slug = normalizeCfiSlug(payload.slug);
      }
      const result = insertCfiSchoolSchema.safeParse(payload);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      if (result.data.slug) {
        const slugOwner = await storage.getCfiSchoolBySlug(result.data.slug);
        if (slugOwner) {
          return res.status(409).json({ error: "School slug already in use" });
        }
      }
      const school = await storage.createCfiSchool({ ...result.data, ownerUserId: userId } as any);
      await storage.addCfiSchoolMember({
        schoolId: school.id,
        userId,
        role: "owner",
        status: "active",
      } as any);
      res.status(201).json(school);
    } catch (error) {
      console.error("Failed to create CFI school:", error);
      res.status(500).json({ error: "Failed to create CFI school" });
    }
  });

  app.patch("/api/cfi/school", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const schoolId = typeof req.body?.schoolId === "string" ? req.body.schoolId : undefined;
      if (!schoolId) {
        return res.status(400).json({ error: "schoolId is required" });
      }
      const membership = await storage.getCfiSchoolMembership(schoolId, userId);
      if (!membership || !SCHOOL_ADMIN_ROLES.has(membership.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      const payload = { ...req.body };
      delete payload.schoolId;
      if (payload.slug) {
        payload.slug = normalizeCfiSlug(payload.slug);
      }
      const result = insertCfiSchoolSchema.partial().safeParse(payload);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      if (result.data.slug) {
        const slugOwner = await storage.getCfiSchoolBySlug(result.data.slug);
        if (slugOwner && slugOwner.id !== schoolId) {
          return res.status(409).json({ error: "School slug already in use" });
        }
      }
      const updated = await storage.updateCfiSchool(schoolId, result.data as any);
      res.json(updated);
    } catch (error) {
      console.error("Failed to update CFI school:", error);
      res.status(500).json({ error: "Failed to update CFI school" });
    }
  });

  app.post("/api/cfi/school/members", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const schoolId = typeof req.body?.schoolId === "string" ? req.body.schoolId : undefined;
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      const role = typeof req.body?.role === "string" ? req.body.role : "instructor";
      if (!schoolId || !email) {
        return res.status(400).json({ error: "schoolId and email are required" });
      }
      const membership = await storage.getCfiSchoolMembership(schoolId, userId);
      if (!membership || !SCHOOL_ADMIN_ROLES.has(membership.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      const targetUser = await storage.getUserByEmail(email);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found for email" });
      }
      const result = insertCfiSchoolMemberSchema.safeParse({
        userId: targetUser.id,
        role,
        status: "active",
      });
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const member = await storage.addCfiSchoolMember({
        schoolId,
        userId: targetUser.id,
        role: result.data.role,
        status: result.data.status,
      } as any);
      res.status(201).json(member);
    } catch (error) {
      console.error("Failed to add CFI school member:", error);
      res.status(500).json({ error: "Failed to add school member" });
    }
  });

  app.delete("/api/cfi/school/members/:id", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const schoolId = typeof req.query?.schoolId === "string" ? req.query.schoolId : undefined;
      if (!schoolId) {
        return res.status(400).json({ error: "schoolId is required" });
      }
      const membership = await storage.getCfiSchoolMembership(schoolId, userId);
      if (!membership || !SCHOOL_ADMIN_ROLES.has(membership.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      const success = await storage.removeCfiSchoolMember(req.params.id, schoolId);
      res.json({ success });
    } catch (error) {
      console.error("Failed to remove CFI school member:", error);
      res.status(500).json({ error: "Failed to remove school member" });
    }
  });

  // CFI Training Center - student roster
  app.get("/api/cfi/students", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const rows = await db
        .select({
          student: cfiStudents,
          user: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
          },
        })
        .from(cfiStudents)
        .innerJoin(users, eq(users.id, cfiStudents.studentUserId))
        .where(eq(cfiStudents.cfiProfileId, profile.id))
        .orderBy(desc(cfiStudents.createdAt));

      const formatted = rows.map((row) => ({
        ...row.student,
        user: row.user,
      }));
      res.json(formatted);
    } catch (error) {
      console.error("Failed to load CFI students:", error);
      res.status(500).json({ error: "Failed to load students" });
    }
  });

  app.post("/api/cfi/students", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const payload = z.object({
        email: z.string().email(),
        startDate: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      }).safeParse(req.body);
      if (!payload.success) {
        return res.status(400).json({ error: payload.error.format() });
      }
      const studentUser = await storage.getUserByEmail(payload.data.email);
      if (!studentUser) {
        return res.status(404).json({ error: "No RSF account found for this email" });
      }
      const existing = await storage.getCfiStudentByProfileAndUser(profile.id, studentUser.id);
      if (existing) {
        return res.status(200).json(existing);
      }
      const created = await storage.createCfiStudent({
        cfiProfileId: profile.id,
        studentUserId: studentUser.id,
        startDate: payload.data.startDate ? new Date(payload.data.startDate) : null,
        notes: payload.data.notes || null,
        status: "active",
      } as any);
      await storage.createCfiConversation({
        cfiProfileId: profile.id,
        studentId: created.id,
      } as any);
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to add CFI student:", error);
      res.status(500).json({ error: "Failed to add student" });
    }
  });

  app.get("/api/cfi/students/:id/synthetic-vision-sessions", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const student = await storage.getCfiStudentById(req.params.id);
      if (!student || student.cfiProfileId !== profile.id) {
        return res.status(404).json({ error: "Student not found" });
      }

      const studentProfile = await storage.getStudentProfile(student.studentUserId);
      const sessionsRaw = (studentProfile?.progressJson as any)?.syntheticVisionSessions;
      const sessions = Array.isArray(sessionsRaw) ? sessionsRaw : [];

      res.json({
        studentId: student.id,
        studentUserId: student.studentUserId,
        total: sessions.length,
        sessions: sessions.slice(0, 40),
      });
    } catch (error) {
      console.error("Failed to load student synthetic vision sessions:", error);
      res.status(500).json({ error: "Failed to load synthetic vision sessions" });
    }
  });

  app.patch("/api/cfi/students/:id", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const result = insertCfiStudentSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const updates = result.data as any;
      if (updates.startDate === "") {
        updates.startDate = null;
      } else if (updates.startDate) {
        updates.startDate = new Date(updates.startDate);
      }
      const updated = await storage.updateCfiStudent(req.params.id, profile.id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Student not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Failed to update CFI student:", error);
      res.status(500).json({ error: "Failed to update student" });
    }
  });

  app.delete("/api/cfi/students/:id", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const success = await storage.deleteCfiStudent(req.params.id, profile.id);
      res.json({ success });
    } catch (error) {
      console.error("Failed to delete CFI student:", error);
      res.status(500).json({ error: "Failed to delete student" });
    }
  });

  // CFI lesson templates
  app.get("/api/cfi/lesson-templates", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const templates = await storage.getCfiLessonTemplates(profile.id);
      res.json(templates);
    } catch (error) {
      console.error("Failed to load lesson templates:", error);
      res.status(500).json({ error: "Failed to load templates" });
    }
  });

  app.post("/api/cfi/lesson-templates", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const result = insertCfiLessonTemplateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const payload = result.data as any;
      const created = await storage.createCfiLessonTemplate({
        ...payload,
        cfiProfileId: profile.id,
      });
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to create lesson template:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.patch("/api/cfi/lesson-templates/:id", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const result = insertCfiLessonTemplateSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const updated = await storage.updateCfiLessonTemplate(req.params.id, profile.id, result.data as any);
      if (!updated) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Failed to update lesson template:", error);
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  app.delete("/api/cfi/lesson-templates/:id", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const success = await storage.deleteCfiLessonTemplate(req.params.id, profile.id);
      res.json({ success });
    } catch (error) {
      console.error("Failed to delete lesson template:", error);
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // CFI lessons per student
  app.get("/api/cfi/students/:id/lessons", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const student = await storage.getCfiStudentById(req.params.id);
      if (!student || student.cfiProfileId !== profile.id) {
        return res.status(404).json({ error: "Student not found" });
      }
      const lessons = await storage.getCfiLessonsByStudent(student.id);
      res.json(lessons);
    } catch (error) {
      console.error("Failed to load student lessons:", error);
      res.status(500).json({ error: "Failed to load lessons" });
    }
  });

  app.post("/api/cfi/students/:id/lessons", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const student = await storage.getCfiStudentById(req.params.id);
      if (!student || student.cfiProfileId !== profile.id) {
        return res.status(404).json({ error: "Student not found" });
      }
      const result = insertCfiLessonSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const payload = result.data as any;
      if (payload.scheduledAt === "") {
        payload.scheduledAt = null;
      } else if (payload.scheduledAt) {
        payload.scheduledAt = new Date(payload.scheduledAt);
      }
      if (payload.completedAt === "") {
        payload.completedAt = null;
      } else if (payload.completedAt) {
        payload.completedAt = new Date(payload.completedAt);
      }
      const created = await storage.createCfiLesson({
        ...payload,
        cfiProfileId: profile.id,
        studentId: student.id,
      });
      if (created.scheduledAt) {
        const scheduledAt = new Date(created.scheduledAt as any);
        await storage.createUserNotification({
          userId: student.studentUserId,
          type: "cfi_lesson_scheduled",
          title: "Lesson scheduled",
          message: `New lesson scheduled for ${format(scheduledAt, "PPpp")}: ${created.title}.`,
          channels: ["in_app"],
          referenceDate: null,
          meta: {
            lessonId: created.id,
            cfiProfileId: profile.id,
            scheduledAt: scheduledAt.toISOString(),
          },
        });
      }
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to create lesson:", error);
      res.status(500).json({ error: "Failed to create lesson" });
    }
  });

  app.patch("/api/cfi/lessons/:id", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const existingLesson = await storage.getCfiLessonById(req.params.id);
      if (!existingLesson || existingLesson.cfiProfileId !== profile.id) {
        return res.status(404).json({ error: "Lesson not found" });
      }
      const result = insertCfiLessonSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const updates = result.data as any;
      if (updates.scheduledAt === "") {
        updates.scheduledAt = null;
      } else if (updates.scheduledAt) {
        updates.scheduledAt = new Date(updates.scheduledAt);
      }
      if (updates.completedAt === "") {
        updates.completedAt = null;
      } else if (updates.completedAt) {
        updates.completedAt = new Date(updates.completedAt);
      }
      const previousScheduledAt = existingLesson.scheduledAt ? new Date(existingLesson.scheduledAt as any) : null;
      const nextScheduledAt =
        updates.scheduledAt === undefined
          ? previousScheduledAt
          : updates.scheduledAt
            ? new Date(updates.scheduledAt as any)
            : null;
      const updated = await storage.updateCfiLesson(req.params.id, profile.id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Lesson not found" });
      }
      if (
        nextScheduledAt &&
        (!previousScheduledAt || previousScheduledAt.getTime() !== nextScheduledAt.getTime())
      ) {
        const student = await storage.getCfiStudentById(existingLesson.studentId);
        if (student) {
          await storage.createUserNotification({
            userId: student.studentUserId,
            type: "cfi_lesson_scheduled",
            title: "Lesson updated",
            message: `Lesson rescheduled for ${format(nextScheduledAt, "PPpp")}: ${updated.title}.`,
            channels: ["in_app"],
            referenceDate: null,
            meta: {
              lessonId: updated.id,
              cfiProfileId: profile.id,
              scheduledAt: nextScheduledAt.toISOString(),
            },
          });
        }
      }
      res.json(updated);
    } catch (error) {
      console.error("Failed to update lesson:", error);
      res.status(500).json({ error: "Failed to update lesson" });
    }
  });

  app.delete("/api/cfi/lessons/:id", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const success = await storage.deleteCfiLesson(req.params.id, profile.id);
      res.json({ success });
    } catch (error) {
      console.error("Failed to delete lesson:", error);
      res.status(500).json({ error: "Failed to delete lesson" });
    }
  });

  // CFI student files (read-only from CFI side)
  app.get("/api/cfi/students/:id/files", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const student = await storage.getCfiStudentById(req.params.id);
      if (!student || student.cfiProfileId !== profile.id) {
        return res.status(404).json({ error: "Student not found" });
      }
      const files = await storage.getCfiStudentFiles(student.id);
      res.json(files);
    } catch (error) {
      console.error("Failed to load student files:", error);
      res.status(500).json({ error: "Failed to load files" });
    }
  });

  // CFI student milestones
  app.get("/api/cfi/students/:id/milestones", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) return res.status(404).json({ error: "CFI profile not found" });
      const student = await storage.getCfiStudentById(req.params.id);
      if (!student || student.cfiProfileId !== profile.id) {
        return res.status(404).json({ error: "Student not found" });
      }
      const milestones = await storage.getCfiStudentMilestones(student.id);
      res.json(milestones);
    } catch (error) {
      console.error("Failed to load student milestones:", error);
      res.status(500).json({ error: "Failed to load milestones" });
    }
  });

  app.post("/api/cfi/students/:id/milestones", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) return res.status(404).json({ error: "CFI profile not found" });
      const student = await storage.getCfiStudentById(req.params.id);
      if (!student || student.cfiProfileId !== profile.id) {
        return res.status(404).json({ error: "Student not found" });
      }
      const result = insertCfiStudentMilestoneSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ error: result.error.format() });
      const payload = result.data as any;
      if (payload.dueDate === "") payload.dueDate = null;
      if (payload.completedAt === "") payload.completedAt = null;
      if (payload.dueDate) payload.dueDate = new Date(payload.dueDate);
      if (payload.completedAt) payload.completedAt = new Date(payload.completedAt);
      const created = await storage.createCfiStudentMilestone({
        ...payload,
        studentId: student.id,
      });
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to create milestone:", error);
      res.status(500).json({ error: "Failed to create milestone" });
    }
  });

  app.patch("/api/cfi/milestones/:id", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const result = insertCfiStudentMilestoneSchema.partial().safeParse(req.body);
      if (!result.success) return res.status(400).json({ error: result.error.format() });
      const milestone = await storage.getCfiStudentMilestoneById(req.params.id as any);
      if (!milestone) return res.status(404).json({ error: "Milestone not found" });
      const student = await storage.getCfiStudentById(milestone.studentId);
      if (!student) return res.status(404).json({ error: "Student not found" });
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile || student.cfiProfileId !== profile.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updates = result.data as any;
      if (updates.dueDate === "") updates.dueDate = null;
      if (updates.completedAt === "") updates.completedAt = null;
      if (updates.dueDate) updates.dueDate = new Date(updates.dueDate);
      if (updates.completedAt) updates.completedAt = new Date(updates.completedAt);
      const updated = await storage.updateCfiStudentMilestone(req.params.id, student.id, updates);
      res.json(updated);
    } catch (error) {
      console.error("Failed to update milestone:", error);
      res.status(500).json({ error: "Failed to update milestone" });
    }
  });

  app.delete("/api/cfi/milestones/:id", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const milestone = await storage.getCfiStudentMilestoneById(req.params.id as any);
      if (!milestone) return res.status(404).json({ error: "Milestone not found" });
      const student = await storage.getCfiStudentById(milestone.studentId);
      if (!student) return res.status(404).json({ error: "Student not found" });
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile || student.cfiProfileId !== profile.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const success = await storage.deleteCfiStudentMilestone(req.params.id, student.id);
      res.json({ success });
    } catch (error) {
      console.error("Failed to delete milestone:", error);
      res.status(500).json({ error: "Failed to delete milestone" });
    }
  });

  // CFI student endorsements
  app.get("/api/cfi/students/:id/endorsements", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) return res.status(404).json({ error: "CFI profile not found" });
      const student = await storage.getCfiStudentById(req.params.id);
      if (!student || student.cfiProfileId !== profile.id) {
        return res.status(404).json({ error: "Student not found" });
      }
      const endorsements = await storage.getCfiStudentEndorsements(student.id);
      res.json(endorsements);
    } catch (error) {
      console.error("Failed to load endorsements:", error);
      res.status(500).json({ error: "Failed to load endorsements" });
    }
  });

  app.post("/api/cfi/students/:id/endorsements", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) return res.status(404).json({ error: "CFI profile not found" });
      const student = await storage.getCfiStudentById(req.params.id);
      if (!student || student.cfiProfileId !== profile.id) {
        return res.status(404).json({ error: "Student not found" });
      }
      const result = insertCfiStudentEndorsementSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ error: result.error.format() });
      const payload = result.data as any;
      if (payload.issuedAt === "") payload.issuedAt = null;
      if (payload.issuedAt) payload.issuedAt = new Date(payload.issuedAt);
      const created = await storage.createCfiStudentEndorsement({
        ...payload,
        studentId: student.id,
        status: payload.status || "draft",
      });
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to create endorsement:", error);
      res.status(500).json({ error: "Failed to create endorsement" });
    }
  });

  app.patch("/api/cfi/endorsements/:id", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const endorsement = await storage.getCfiStudentEndorsementById(req.params.id);
      if (!endorsement) return res.status(404).json({ error: "Endorsement not found" });
      const student = await storage.getCfiStudentById(endorsement.studentId);
      if (!student) return res.status(404).json({ error: "Student not found" });
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile || student.cfiProfileId !== profile.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const result = insertCfiStudentEndorsementSchema.partial().safeParse(req.body);
      if (!result.success) return res.status(400).json({ error: result.error.format() });
      const updates = result.data as any;
      if (updates.issuedAt === "") updates.issuedAt = null;
      if (updates.issuedAt) updates.issuedAt = new Date(updates.issuedAt);
      const updated = await storage.updateCfiStudentEndorsement(req.params.id, student.id, updates);
      res.json(updated);
    } catch (error) {
      console.error("Failed to update endorsement:", error);
      res.status(500).json({ error: "Failed to update endorsement" });
    }
  });

  app.post("/api/cfi/endorsements/:id/sign", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const endorsement = await storage.getCfiStudentEndorsementById(req.params.id);
      if (!endorsement) return res.status(404).json({ error: "Endorsement not found" });
      const student = await storage.getCfiStudentById(endorsement.studentId);
      if (!student) return res.status(404).json({ error: "Student not found" });
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile || student.cfiProfileId !== profile.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const payload = z
        .object({
          signedByName: z.string().min(1),
          signatureDataUrl: z.string().min(1),
        })
        .safeParse(req.body);
      if (!payload.success) return res.status(400).json({ error: payload.error.format() });
      const updated = await storage.updateCfiStudentEndorsement(req.params.id, student.id, {
        signedByName: payload.data.signedByName,
        signatureDataUrl: payload.data.signatureDataUrl,
        signedAt: new Date(),
        status: "signed",
      });
      res.json(updated);
    } catch (error) {
      console.error("Failed to sign endorsement:", error);
      res.status(500).json({ error: "Failed to sign endorsement" });
    }
  });

  // CFI messaging
  app.get("/api/cfi/messages/threads", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) return res.status(404).json({ error: "CFI profile not found" });
      const threads = await db
        .select({
          conversation: cfiConversations,
          student: cfiStudents,
          user: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          },
        })
        .from(cfiConversations)
        .innerJoin(cfiStudents, eq(cfiStudents.id, cfiConversations.studentId))
        .innerJoin(users, eq(users.id, cfiStudents.studentUserId))
        .where(eq(cfiConversations.cfiProfileId, profile.id))
        .orderBy(desc(cfiConversations.updatedAt));
      res.json(
        threads.map((row) => ({
          ...row.conversation,
          student: row.student,
          user: row.user,
        }))
      );
    } catch (error) {
      console.error("Failed to load message threads:", error);
      res.status(500).json({ error: "Failed to load threads" });
    }
  });

  app.get("/api/cfi/messages/:conversationId", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) return res.status(404).json({ error: "CFI profile not found" });
      const conversation = await storage.getCfiConversationById(req.params.conversationId);
      if (!conversation || conversation.cfiProfileId !== profile.id) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await storage.getCfiMessages(conversation.id);
      res.json(messages);
    } catch (error) {
      console.error("Failed to load messages:", error);
      res.status(500).json({ error: "Failed to load messages" });
    }
  });

  app.post("/api/cfi/messages/:conversationId", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) return res.status(404).json({ error: "CFI profile not found" });
      const conversation = await storage.getCfiConversationById(req.params.conversationId);
      if (!conversation || conversation.cfiProfileId !== profile.id) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const result = insertCfiMessageSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ error: result.error.format() });
      const created = await storage.createCfiMessage({
        conversationId: conversation.id,
        senderUserId: userId,
        body: result.data.body,
        isRead: false,
      } as any);
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to send message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Student training extras
  app.get("/api/student/training/milestones", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const student = await storage.getCfiStudentByStudentUser(userId);
      if (!student) return res.json([]);
      const milestones = await storage.getCfiStudentMilestones(student.id);
      res.json(milestones);
    } catch (error) {
      console.error("Failed to load student milestones:", error);
      res.status(500).json({ error: "Failed to load milestones" });
    }
  });

  app.get("/api/student/training/endorsements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const student = await storage.getCfiStudentByStudentUser(userId);
      if (!student) return res.json([]);
      const endorsements = await storage.getCfiStudentEndorsements(student.id);
      res.json(endorsements);
    } catch (error) {
      console.error("Failed to load student endorsements:", error);
      res.status(500).json({ error: "Failed to load endorsements" });
    }
  });

  app.get("/api/student/messages/threads", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const student = await storage.getCfiStudentByStudentUser(userId);
      if (!student) return res.json([]);
      const threads = await db
        .select({
          conversation: cfiConversations,
          cfiProfile: {
            id: cfiProfiles.id,
            displayName: cfiProfiles.displayName,
            airportHome: cfiProfiles.airportHome,
          },
        })
        .from(cfiConversations)
        .innerJoin(cfiProfiles, eq(cfiProfiles.id, cfiConversations.cfiProfileId))
        .where(eq(cfiConversations.studentId, student.id))
        .orderBy(desc(cfiConversations.updatedAt));
      res.json(
        threads.map((row) => ({
          ...row.conversation,
          cfiProfile: row.cfiProfile,
        }))
      );
    } catch (error) {
      console.error("Failed to load student threads:", error);
      res.status(500).json({ error: "Failed to load threads" });
    }
  });

  app.get("/api/student/messages/:conversationId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const student = await storage.getCfiStudentByStudentUser(userId);
      if (!student) return res.status(404).json({ error: "Student training profile not found" });
      const conversation = await storage.getCfiConversationById(req.params.conversationId);
      if (!conversation || conversation.studentId !== student.id) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await storage.getCfiMessages(conversation.id);
      res.json(messages);
    } catch (error) {
      console.error("Failed to load student messages:", error);
      res.status(500).json({ error: "Failed to load messages" });
    }
  });

  app.post("/api/student/messages/:conversationId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const student = await storage.getCfiStudentByStudentUser(userId);
      if (!student) return res.status(404).json({ error: "Student training profile not found" });
      const conversation = await storage.getCfiConversationById(req.params.conversationId);
      if (!conversation || conversation.studentId !== student.id) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const result = insertCfiMessageSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ error: result.error.format() });
      const created = await storage.createCfiMessage({
        conversationId: conversation.id,
        senderUserId: userId,
        body: result.data.body,
        isRead: false,
      } as any);
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to send student message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.get("/api/cfi/students/files/:id/download", isAuthenticated, requireCfiAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getCfiProfileByUser(userId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }
      const file = await storage.getCfiStudentFileById(req.params.id);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      const student = await storage.getCfiStudentById(file.studentId);
      if (!student || student.cfiProfileId !== profile.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.setHeader("Content-Disposition", `attachment; filename="${file.fileName.replace(/\"/g, "")}"`);

      if (file.storageProvider === "s3") {
        const { S3StorageService } = await import("./s3Storage");
        const s3Service = new S3StorageService();
        const { stream, contentType, contentLength } = await s3Service.getObjectStream({
          key: file.storagePath,
        });
        res.setHeader("Content-Type", contentType || file.mimeType || "application/octet-stream");
        if (contentLength) res.setHeader("Content-Length", String(contentLength));
        stream.pipe(res);
        return;
      }

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(file.storagePath);
      await objectStorageService.downloadObject(objectFile, res, 0);
    } catch (error) {
      console.error("Failed to download student file:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Student training workspace
  app.get("/api/student/training", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const student = await storage.getCfiStudentByStudentUser(userId);
      if (!student) {
        return res.json({ student: null, cfiProfile: null, lessons: [], files: [] });
      }
      const [cfiProfile, lessons, files] = await Promise.all([
        storage.getCfiProfileById(student.cfiProfileId),
        storage.getCfiLessonsByStudent(student.id),
        storage.getCfiStudentFiles(student.id),
      ]);
      res.json({ student, cfiProfile, lessons, files });
    } catch (error) {
      console.error("Failed to load student training data:", error);
      res.status(500).json({ error: "Failed to load training data" });
    }
  });

  app.patch("/api/student/training/lessons/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const student = await storage.getCfiStudentByStudentUser(userId);
      if (!student) {
        return res.status(404).json({ error: "Student training profile not found" });
      }
      const lesson = await storage.getCfiLessonById(req.params.id);
      if (!lesson || lesson.studentId !== student.id) {
        return res.status(404).json({ error: "Lesson not found" });
      }
      const updates = z.object({
        studentNotes: z.string().optional().nullable(),
      }).safeParse(req.body);
      if (!updates.success) {
        return res.status(400).json({ error: updates.error.format() });
      }
      const updated = await storage.updateCfiLesson(req.params.id, lesson.cfiProfileId, {
        studentNotes: updates.data.studentNotes || null,
      });
      res.json(updated);
    } catch (error) {
      console.error("Failed to update student lesson notes:", error);
      res.status(500).json({ error: "Failed to update lesson" });
    }
  });

  app.post("/api/student/training/files/upload", isAuthenticated, async (req: any, res) => {
    try {
      const contentType = String(req.body?.contentType || "application/pdf");
      if (process.env.AWS_S3_BUCKET) {
        const { S3StorageService } = await import("./s3Storage");
        const s3Service = new S3StorageService();
        const { uploadURL, key } = await s3Service.getPresignedUploadUrlForKey({
          prefix: "cfi-student-files",
          contentType,
        });
        return res.json({
          uploadURL,
          storageProvider: "s3",
          storagePath: key,
        });
      }
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const storagePath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      return res.json({
        uploadURL,
        storageProvider: "object",
        storagePath,
      });
    } catch (error) {
      console.error("Failed to create training file upload URL:", error);
      res.status(500).json({ error: "Failed to create upload URL" });
    }
  });

  app.post("/api/student/training/files", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const student = await storage.getCfiStudentByStudentUser(userId);
      if (!student) {
        return res.status(404).json({ error: "Student training profile not found" });
      }
      const result = insertCfiStudentFileSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const payload = result.data as any;
      if (payload.storageProvider === "object") {
        try {
          const objectStorageService = new ObjectStorageService();
          await objectStorageService.trySetObjectEntityAclPolicy(payload.storagePath, {
            owner: userId,
            visibility: "private",
          });
        } catch (aclError) {
          console.warn("Failed to set student file ACL:", aclError);
        }
      }
      const created = await storage.createCfiStudentFile({
        ...payload,
        studentId: student.id,
        uploadedByUserId: userId,
      } as any);
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to save training file:", error);
      res.status(500).json({ error: "Failed to save training file" });
    }
  });

  app.get("/api/student/training/files", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const student = await storage.getCfiStudentByStudentUser(userId);
      if (!student) {
        return res.json([]);
      }
      const files = await storage.getCfiStudentFiles(student.id);
      res.json(files);
    } catch (error) {
      console.error("Failed to load training files:", error);
      res.status(500).json({ error: "Failed to load files" });
    }
  });

  app.get("/api/student/training/files/:id/download", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const student = await storage.getCfiStudentByStudentUser(userId);
      if (!student) {
        return res.status(404).json({ error: "Student training profile not found" });
      }
      const file = await storage.getCfiStudentFileById(req.params.id);
      if (!file || file.studentId !== student.id) {
        return res.status(404).json({ error: "File not found" });
      }

      res.setHeader("Content-Disposition", `attachment; filename="${file.fileName.replace(/\"/g, "")}"`);

      if (file.storageProvider === "s3") {
        const { S3StorageService } = await import("./s3Storage");
        const s3Service = new S3StorageService();
        const { stream, contentType, contentLength } = await s3Service.getObjectStream({
          key: file.storagePath,
        });
        res.setHeader("Content-Type", contentType || file.mimeType || "application/octet-stream");
        if (contentLength) res.setHeader("Content-Length", String(contentLength));
        stream.pipe(res);
        return;
      }

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(file.storagePath);
      await objectStorageService.downloadObject(objectFile, res, 0);
    } catch (error) {
      console.error("Failed to download training file:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  app.delete("/api/student/training/files/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const student = await storage.getCfiStudentByStudentUser(userId);
      if (!student) {
        return res.status(404).json({ error: "Student training profile not found" });
      }
      const file = await storage.getCfiStudentFileById(req.params.id);
      if (!file || file.studentId !== student.id) {
        return res.status(404).json({ error: "File not found" });
      }

      if (file.storageProvider === "s3") {
        try {
          const { S3StorageService } = await import("./s3Storage");
          const s3Service = new S3StorageService();
          await s3Service.deleteObject(file.storagePath);
        } catch (deleteError) {
          console.warn("Failed to delete S3 training file:", deleteError);
        }
      }

      const success = await storage.deleteCfiStudentFile(file.id, student.id);
      res.json({ success });
    } catch (error) {
      console.error("Failed to delete training file:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Logbook Archives (Pro only)
  app.post("/api/logbook/archives/upload", isAuthenticated, requireLogbookPro, async (req: any, res) => {
    try {
      const contentType = String(req.body?.contentType || "application/pdf");
      if (!contentType.includes("pdf")) {
        return res.status(400).json({ error: "Only PDF uploads are supported" });
      }

      if (process.env.AWS_S3_BUCKET) {
        const { S3StorageService } = await import("./s3Storage");
        const s3Service = new S3StorageService();
        const { uploadURL, key } = await s3Service.getPresignedUploadUrlForKey({
          prefix: "logbook-archives",
          contentType,
        });
        return res.json({
          uploadURL,
          storageProvider: "s3",
          storagePath: key,
        });
      }

      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const storagePath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      return res.json({
        uploadURL,
        storageProvider: "object",
        storagePath,
      });
    } catch (error) {
      console.error("Failed to create logbook upload URL:", error);
      res.status(500).json({ error: "Failed to create upload URL" });
    }
  });

  app.get("/api/logbook/archives", isAuthenticated, requireLogbookPro, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const archives = await storage.getLogbookArchivesByUser(userId);
      res.json(archives);
    } catch (error) {
      console.error("Failed to fetch logbook archives:", error);
      res.status(500).json({ error: "Failed to fetch logbook archives" });
    }
  });

  app.post("/api/logbook/archives", isAuthenticated, requireLogbookPro, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = insertLogbookArchiveSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const payload = result.data as any;
      if (payload.storageProvider === "object") {
        try {
          const objectStorageService = new ObjectStorageService();
          await objectStorageService.trySetObjectEntityAclPolicy(payload.storagePath, {
            owner: userId,
            visibility: "private",
          });
        } catch (aclError) {
          console.warn("Failed to set logbook archive ACL:", aclError);
        }
      }

      const archive = await storage.createLogbookArchive({ ...payload, userId });
      res.status(201).json(archive);
    } catch (error: any) {
      console.error("Failed to create logbook archive:", error);
      res.status(500).json({ error: error.message || "Failed to create logbook archive" });
    }
  });

  app.get("/api/logbook/archives/:id/download", isAuthenticated, requireLogbookPro, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const archive = await storage.getLogbookArchiveById(req.params.id);
      if (!archive) {
        return res.status(404).json({ error: "Archive not found" });
      }
      if (archive.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${archive.fileName.replace(/\"/g, "")}"`
      );

      if (archive.storageProvider === "s3") {
        const { S3StorageService } = await import("./s3Storage");
        const s3Service = new S3StorageService();
        const { stream, contentType, contentLength } = await s3Service.getObjectStream({
          key: archive.storagePath,
        });
        res.setHeader("Content-Type", contentType || "application/pdf");
        if (contentLength) res.setHeader("Content-Length", String(contentLength));
        stream.pipe(res);
        return;
      }

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(archive.storagePath);
      await objectStorageService.downloadObject(objectFile, res, 0);
    } catch (error) {
      console.error("Failed to download logbook archive:", error);
      res.status(500).json({ error: "Failed to download logbook archive" });
    }
  });

  app.delete("/api/logbook/archives/:id", isAuthenticated, requireLogbookPro, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const archive = await storage.getLogbookArchiveById(req.params.id);
      if (!archive) {
        return res.status(404).json({ error: "Archive not found" });
      }
      if (archive.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (archive.storageProvider === "s3") {
        try {
          const { S3StorageService } = await import("./s3Storage");
          const s3Service = new S3StorageService();
          await s3Service.deleteObject(archive.storagePath);
        } catch (deleteError) {
          console.warn("Failed to delete S3 logbook archive:", deleteError);
        }
      } else {
        try {
          const objectStorageService = new ObjectStorageService();
          await objectStorageService.deleteObjectEntity(archive.storagePath);
        } catch (deleteError) {
          console.warn("Failed to delete object archive:", deleteError);
        }
      }

      const success = await storage.deleteLogbookArchive(req.params.id, userId);
      res.json({ success });
    } catch (error) {
      console.error("Failed to delete logbook archive:", error);
      res.status(500).json({ error: "Failed to delete logbook archive" });
    }
  });

  // Logbook Pro - Settings & Currency Summary
  app.get("/api/logbook/pro/settings", isAuthenticated, requireLogbookPro, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const settings = await storage.getLogbookProSettings(userId);
      res.json(settings || null);
    } catch (error) {
      console.error("Failed to fetch logbook pro settings:", error);
      res.status(500).json({ error: "Failed to fetch logbook pro settings" });
    }
  });

  app.put("/api/logbook/pro/settings", isAuthenticated, requireLogbookPro, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const payload = { ...req.body };
      const dateFields = ["medicalIssuedAt", "medicalExpiresAt", "flightReviewDate", "ipcDate"];
      dateFields.forEach((field) => {
        if (payload[field] === "") {
          payload[field] = null;
        }
      });
      const result = insertLogbookProSettingsSchema.partial().safeParse(payload);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const settings = await storage.upsertLogbookProSettings(userId, result.data as any);
      res.json(settings);
    } catch (error) {
      console.error("Failed to update logbook pro settings:", error);
      res.status(500).json({ error: "Failed to update logbook pro settings" });
    }
  });

  app.get("/api/logbook/pro/summary", isAuthenticated, requireLogbookPro, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const [settings, entries] = await Promise.all([
        storage.getLogbookProSettings(userId),
        storage.getLogbookEntriesByUser(userId),
      ]);

      const now = new Date();
      const last90 = new Date(now);
      last90.setDate(last90.getDate() - 90);
      const last6 = new Date(now);
      last6.setMonth(last6.getMonth() - 6);

      const entriesLast90 = entries.filter((entry) => entry.flightDate && new Date(entry.flightDate) >= last90);
      const entriesLast6 = entries.filter((entry) => entry.flightDate && new Date(entry.flightDate) >= last6);

      const sum = (vals: Array<number | null | undefined>) => {
        let total = 0;
        for (const val of vals) {
          if (typeof val === "number") {
            total += val;
          }
        }
        return total;
      };

      const landingsDay = sum(entriesLast90.map((e) => e.landingsDay ?? 0));
      const landingsNight = sum(entriesLast90.map((e) => e.landingsNight ?? 0));
      const totalLandings = landingsDay + landingsNight;

      const getLatestDate = (entries: any[], predicate: (entry: any) => boolean) => {
        let latest: Date | null = null;
        for (const entry of entries) {
          if (!predicate(entry)) continue;
          if (!entry.flightDate) continue;
          const date = new Date(entry.flightDate);
          if (!Number.isNaN(date.getTime()) && (!latest || date > latest)) {
            latest = date;
          }
        }
        return latest;
      };

      const lastLandingDate = getLatestDate(entriesLast90, (e) => (e.landingsDay ?? 0) + (e.landingsNight ?? 0) > 0);
      const lastNightLandingDate = getLatestDate(entriesLast90, (e) => (e.landingsNight ?? 0) > 0);

      const addDays = (date: Date, days: number) => {
        const next = new Date(date);
        next.setDate(next.getDate() + days);
        return next;
      };
      const addMonths = (date: Date, months: number) => {
        const next = new Date(date);
        next.setMonth(next.getMonth() + months);
        return next;
      };

      const dayCurrencyDueAt = lastLandingDate ? addDays(lastLandingDate, 90) : null;
      const nightCurrencyDueAt = lastNightLandingDate ? addDays(lastNightLandingDate, 90) : null;

      const approaches = sum(entriesLast6.map((e) => e.approaches ?? 0));
      const holds = sum(entriesLast6.map((e) => e.holds ?? 0));
      const instrumentTotal = approaches + holds;
      const lastInstrumentDate = getLatestDate(entriesLast6, (e) => (e.approaches ?? 0) + (e.holds ?? 0) > 0);
      const instrumentDueAt = lastInstrumentDate ? addMonths(lastInstrumentDate, 6) : null;

      const flightReviewDueAt = settings?.flightReviewDate ? addMonths(new Date(settings.flightReviewDate), 24) : null;

      res.json({
        settings: settings || null,
        currency: {
          landingsDay,
          landingsNight,
          totalLandings,
          dayCurrent: totalLandings >= 3,
          nightCurrent: landingsNight >= 3,
          dayCurrencyDueAt,
          nightCurrencyDueAt,
          approaches,
          holds,
          instrumentTotal,
          instrumentCurrent: instrumentTotal >= 6,
          instrumentDueAt,
        },
        expirations: {
          medicalExpiresAt: settings?.medicalExpiresAt || null,
          flightReviewDueAt,
          ipcDate: settings?.ipcDate || null,
        },
      });
    } catch (error) {
      console.error("Failed to fetch logbook pro summary:", error);
      res.status(500).json({ error: "Failed to fetch logbook pro summary" });
    }
  });

  // Logbook Pro - Endorsements
  app.get("/api/endorsements", isAuthenticated, requireLogbookPro, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const endorsements = await storage.getEndorsementsByUser(userId);
      res.json(endorsements);
    } catch (error) {
      console.error("Failed to fetch endorsements:", error);
      res.status(500).json({ error: "Failed to fetch endorsements" });
    }
  });

  app.post("/api/endorsements", isAuthenticated, requireLogbookPro, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = insertEndorsementSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const endorsement = await storage.createEndorsement({ ...(result.data as any), userId });
      res.status(201).json(endorsement);
    } catch (error) {
      console.error("Failed to create endorsement:", error);
      res.status(500).json({ error: "Failed to create endorsement" });
    }
  });

  app.patch("/api/endorsements/:id", isAuthenticated, requireLogbookPro, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = insertEndorsementSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const updated = await storage.updateEndorsement(req.params.id, userId, result.data as any);
      if (!updated) {
        return res.status(404).json({ error: "Endorsement not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Failed to update endorsement:", error);
      res.status(500).json({ error: "Failed to update endorsement" });
    }
  });

  app.delete("/api/endorsements/:id", isAuthenticated, requireLogbookPro, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const success = await storage.deleteEndorsement(req.params.id, userId);
      if (!success) {
        return res.status(404).json({ error: "Endorsement not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete endorsement:", error);
      res.status(500).json({ error: "Failed to delete endorsement" });
    }
  });

  // Logbook Pro - Radio Comms Sessions
  app.get("/api/radio-comms/sessions", isAuthenticated, requireLogbookPro, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessions = await storage.getRadioCommsSessionsByUser(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Failed to fetch radio comms sessions:", error);
      res.status(500).json({ error: "Failed to fetch radio comms sessions" });
    }
  });

  app.post("/api/radio-comms/sessions", isAuthenticated, requireLogbookPro, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = insertRadioCommsSessionSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const session = await storage.createRadioCommsSession({ ...(result.data as any), userId });
      res.status(201).json(session);
    } catch (error) {
      console.error("Failed to create radio comms session:", error);
      res.status(500).json({ error: "Failed to create radio comms session" });
    }
  });

  // User Notifications + Preferences
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const notifications = await storage.getUnreadUserNotifications(userId);
      res.json({ count: notifications.length });
    } catch (error) {
      console.error("Failed to fetch unread notifications:", error);
      res.status(500).json({ error: "Failed to fetch unread notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const updated = await storage.markUserNotificationRead(req.params.id, userId);
      if (!updated) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Failed to mark notification read:", error);
      res.status(500).json({ error: "Failed to update notification" });
    }
  });

  app.get("/api/notifications/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const prefs = await storage.getNotificationPreferences(userId);
      res.json(prefs || { emailEnabled: true, pushEnabled: true, inAppEnabled: true, alertDaysBefore: 30 });
    } catch (error) {
      console.error("Failed to fetch notification preferences:", error);
      res.status(500).json({ error: "Failed to fetch notification preferences" });
    }
  });

  app.put("/api/notifications/preferences", isAuthenticated, requireLogbookPro, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = insertNotificationPreferencesSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const prefs = await storage.upsertNotificationPreferences(userId, result.data as any);
      res.json(prefs);
    } catch (error) {
      console.error("Failed to update notification preferences:", error);
      res.status(500).json({ error: "Failed to update notification preferences" });
    }
  });

  app.post("/api/notifications/push-token", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = insertPushTokenSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const token = await storage.upsertPushToken(userId, result.data as any);
      res.status(201).json(token);
    } catch (error) {
      console.error("Failed to register push token:", error);
      res.status(500).json({ error: "Failed to register push token" });
    }
  });

  // Flight Planner (Logbook Pro)
  app.get("/api/flight-plans", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const entitlements = getEntitlementsForUser(user);
      let plans = await storage.getFlightPlansByUser(userId);
      if (!entitlements.canPersist && plans.length > 1) {
        plans = plans.slice(0, 1);
      }
      res.json(plans);
    } catch (error) {
      console.error("Failed to fetch flight plans:", error);
      res.status(500).json({ error: "Failed to fetch flight plans" });
    }
  });

  app.post("/api/flight-plans", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const entitlements = getEntitlementsForUser(user);
      if (!entitlements.canPersist) {
        const existingPlans = await storage.getFlightPlansByUser(userId);
        if (existingPlans.length >= 1) {
          return res.status(403).json({
            error: "Free accounts can save one flight plan. Upgrade to RSF Pro to save more.",
          });
        }
      }
      const payload = { ...req.body };
      if (payload.fuelOnBoard === "") payload.fuelOnBoard = null;
      if (payload.fuelRequired === "") payload.fuelRequired = null;
      const result = insertFlightPlanSchema.safeParse(payload);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const plan = await storage.createFlightPlan({ ...result.data, userId } as any);
      res.status(201).json(plan);
    } catch (error) {
      console.error("Failed to create flight plan:", error);
      res.status(500).json({ error: "Failed to create flight plan" });
    }
  });

  app.get("/api/flight-plans/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const plan = await storage.getFlightPlanById(req.params.id);
      if (!plan) {
        return res.status(404).json({ error: "Flight plan not found" });
      }
      if (plan.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Failed to fetch flight plan:", error);
      res.status(500).json({ error: "Failed to fetch flight plan" });
    }
  });

  app.patch("/api/flight-plans/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const plan = await storage.getFlightPlanById(req.params.id);
      if (!plan) {
        return res.status(404).json({ error: "Flight plan not found" });
      }
      if (plan.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const payload = { ...req.body };
      if (payload.fuelOnBoard === "") payload.fuelOnBoard = null;
      if (payload.fuelRequired === "") payload.fuelRequired = null;
      const result = insertFlightPlanSchema.partial().safeParse(payload);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const updated = await storage.updateFlightPlan(req.params.id, result.data as any);
      res.json(updated);
    } catch (error) {
      console.error("Failed to update flight plan:", error);
      res.status(500).json({ error: "Failed to update flight plan" });
    }
  });

  app.delete("/api/flight-plans/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const plan = await storage.getFlightPlanById(req.params.id);
      if (!plan) {
        return res.status(404).json({ error: "Flight plan not found" });
      }
      if (plan.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const success = await storage.deleteFlightPlan(req.params.id);
      res.json({ success });
    } catch (error) {
      console.error("Failed to delete flight plan:", error);
      res.status(500).json({ error: "Failed to delete flight plan" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time messaging (active rentals only)
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    logDebug('WebSocket client connected');
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Validate rental exists and is active
        if (message.type === 'chat' && message.rentalId) {
          const rental = await storage.getRental(message.rentalId);
          
          if (!rental || rental.status !== 'active') {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Messaging only available for active rentals'
            }));
            return;
          }
          
          // Store message in backend
          await storage.createMessage({
            rentalId: message.rentalId,
            senderId: message.senderId,
            receiverId: message.receiverId || rental.ownerId, // Default to owner if not specified
            content: message.content,
          });
          
          // Broadcast to all connected clients (in production, filter by rental participants)
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'chat',
                rentalId: message.rentalId,
                senderId: message.senderId,
                content: message.content,
                timestamp: new Date(),
              }));
            }
          });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

  // Cron endpoint: Logbook Pro alerts (currency + expirations)
  app.post("/api/cron/logbook-pro-alerts", async (req, res) => {
    try {
      const cronSecret = req.headers["x-cron-secret"];
      const expectedSecret = process.env.CRON_SECRET || process.env.SESSION_SECRET;
      if (!cronSecret || cronSecret !== expectedSecret) {
        console.warn("Unauthorized logbook pro cron attempt from IP:", req.ip);
        return res.status(401).json({ error: "Unauthorized" });
      }

      const leadDays = Number(process.env.LOGBOOK_PRO_ALERT_DAYS ?? 30);
      const { getLogbookProAlertEmailHtml, getLogbookProAlertEmailText } = await import("./email-templates");
      const { client, fromEmail } = await getUncachableResendClient();

      const users = await storage.getActiveLogbookProUsers();
      const today = new Date();
      const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const msPerDay = 1000 * 60 * 60 * 24;

      const getLatestDate = (entries: any[], predicate: (entry: any) => boolean) => {
        let latest: Date | null = null;
        for (const entry of entries) {
          if (!predicate(entry)) continue;
          if (!entry.flightDate) continue;
          const date = new Date(entry.flightDate);
          if (!Number.isNaN(date.getTime()) && (!latest || date > latest)) {
            latest = date;
          }
        }
        return latest;
      };

      const addDays = (date: Date, days: number) => {
        const next = new Date(date);
        next.setDate(next.getDate() + days);
        return next;
      };
      const addMonths = (date: Date, months: number) => {
        const next = new Date(date);
        next.setMonth(next.getMonth() + months);
        return next;
      };

      let processed = 0;
      let notificationsCreated = 0;
      let emailsSent = 0;
      let pushesSent = 0;
      const errors: string[] = [];

      for (const user of users) {
        processed += 1;
        try {
          const [settings, entries, prefs] = await Promise.all([
            storage.getLogbookProSettings(user.id),
            storage.getLogbookEntriesByUser(user.id),
            storage.getNotificationPreferences(user.id),
          ]);

          const preferences = prefs || { emailEnabled: true, pushEnabled: true, inAppEnabled: true, alertDaysBefore: leadDays };
          const last90 = new Date(today);
          last90.setDate(last90.getDate() - 90);
          const last6 = new Date(today);
          last6.setMonth(last6.getMonth() - 6);

          const entriesLast90 = entries.filter((entry) => entry.flightDate && new Date(entry.flightDate) >= last90);
          const entriesLast6 = entries.filter((entry) => entry.flightDate && new Date(entry.flightDate) >= last6);

          const sum = (vals: Array<number | null | undefined>): number => {
            let total: number = 0;
            for (const val of vals) {
              if (typeof val === "number") total += val;
            }
            return total;
          };
          const landingsDay: number = sum(entriesLast90.map((e) => e.landingsDay ?? 0));
          const landingsNight: number = sum(entriesLast90.map((e) => e.landingsNight ?? 0));
          const totalLandings: number = landingsDay + landingsNight;
          const approaches: number = sum(entriesLast6.map((e) => e.approaches ?? 0));
          const holds: number = sum(entriesLast6.map((e) => e.holds ?? 0));
          const instrumentTotal: number = approaches + holds;

          const lastLandingDate = getLatestDate(entriesLast90, (e) => (e.landingsDay ?? 0) + (e.landingsNight ?? 0) > 0);
          const lastNightLandingDate = getLatestDate(entriesLast90, (e) => (e.landingsNight ?? 0) > 0);
          const lastInstrumentDate = getLatestDate(entriesLast6, (e) => (e.approaches ?? 0) + (e.holds ?? 0) > 0);

          const dayCurrencyDueAt = lastLandingDate ? addDays(lastLandingDate, 90) : null;
          const nightCurrencyDueAt = lastNightLandingDate ? addDays(lastNightLandingDate, 90) : null;
          const instrumentDueAt = lastInstrumentDate ? addMonths(lastInstrumentDate, 6) : null;
          const flightReviewDueAt = settings?.flightReviewDate ? addMonths(new Date(settings.flightReviewDate), 24) : null;
          const lastLogbookEntryDate = getLatestDate(entries, () => true);
          const logbookReminderDays = Number(process.env.LOGBOOK_ACTIVITY_REMINDER_DAYS ?? 7);

          const candidates: Array<{ type: string; title: string; message: string; dueAt: Date | null }> = [
            {
              type: "currency_day_due",
              title: "90-day currency due soon",
              message: `Your day currency is due soon. Total landings: ${totalLandings}.`,
              dueAt: dayCurrencyDueAt,
            },
            {
              type: "currency_night_due",
              title: "Night currency due soon",
              message: `Your night currency is due soon. Night landings: ${landingsNight}.`,
              dueAt: nightCurrencyDueAt,
            },
            {
              type: "currency_instrument_due",
              title: "IFR currency due soon",
              message: `Your instrument currency is due soon. Approaches + holds: ${instrumentTotal}.`,
              dueAt: instrumentDueAt,
            },
            {
              type: "medical_expiration",
              title: "Medical certificate expiring",
              message: "Your medical certificate expires soon. Update your RSF Pro settings.",
              dueAt: settings?.medicalExpiresAt ? new Date(settings.medicalExpiresAt) : null,
            },
            {
              type: "flight_review_due",
              title: "Flight review due soon",
              message: "Your flight review is coming due. Schedule your review.",
              dueAt: flightReviewDueAt,
            },
            {
              type: "ipc_due",
              title: "IPC due soon",
              message: "Your instrument proficiency check is coming due.",
              dueAt: settings?.ipcDate ? new Date(settings.ipcDate) : null,
            },
          ];

          if (lastLogbookEntryDate) {
            const daysSince = Math.round((startOfDay(today).getTime() - startOfDay(lastLogbookEntryDate).getTime()) / msPerDay);
            if (daysSince >= logbookReminderDays) {
              const reminderType = "logbook_checkin";
              const referenceDate = startOfDay(today);
              const existingReminder = await storage.getUserNotificationByTypeAndDate(user.id, reminderType, referenceDate);
              if (!existingReminder) {
                const channels: string[] = [];
                const shouldInApp = preferences.inAppEnabled !== false;
                const shouldEmail = preferences.emailEnabled !== false && !!user.email;
                const shouldPush = preferences.pushEnabled !== false;

                if (shouldEmail) {
                  try {
                    const html = getLogbookProAlertEmailHtml({
                      firstName: user.firstName || user.email?.split("@")[0] || "Pilot",
                      title: "Logbook check-in",
                      message: "It looks like you haven’t logged a flight recently. Log your latest flight to keep currency accurate.",
                      dueDate: referenceDate,
                    });
                    const text = getLogbookProAlertEmailText({
                      firstName: user.firstName || user.email?.split("@")[0] || "Pilot",
                      title: "Logbook check-in",
                      message: "It looks like you haven’t logged a flight recently. Log your latest flight to keep currency accurate.",
                      dueDate: referenceDate,
                    });
                    await client.emails.send({
                      from: fromEmail,
                      to: user.email!,
                      subject: "RSF Pro: Logbook check-in",
                      html,
                      text,
                    });
                    channels.push("email");
                    emailsSent += 1;
                  } catch (emailError: any) {
                    errors.push(`Email failed for ${user.email}: ${emailError.message}`);
                  }
                }

                if (shouldPush) {
                  try {
                    const tokens = await storage.getPushTokensByUser(user.id);
                    if (tokens.length > 0) {
                      await fetch("https://exp.host/--/api/v2/push/send", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(
                          tokens.map((token) => ({
                            to: token.token,
                            title: "RSF Logbook",
                            body: "Log your latest flight to keep currency accurate.",
                            data: { type: reminderType },
                          }))
                        ),
                      });
                      channels.push("push");
                      pushesSent += tokens.length;
                    }
                  } catch (pushError: any) {
                    errors.push(`Push failed for user ${user.id}: ${pushError.message}`);
                  }
                }

                const notification = await storage.createUserNotification({
                  userId: user.id,
                  type: reminderType,
                  title: "Logbook check-in",
                  message: "Log your latest flight to keep currency accurate.",
                  referenceDate,
                  channels,
                  isRead: !shouldInApp,
                  readAt: shouldInApp ? null : new Date(),
                  meta: { lastEntry: lastLogbookEntryDate.toISOString() },
                } as any);
                if (notification) {
                  notificationsCreated += 1;
                }
              }
            }
          }

          for (const candidate of candidates) {
            if (!candidate.dueAt) continue;
            const dueDate = startOfDay(candidate.dueAt);
            const diffDays = Math.round((dueDate.getTime() - startOfDay(today).getTime()) / msPerDay);
            if (diffDays < 0 || diffDays > (preferences.alertDaysBefore ?? leadDays)) continue;

            const existing = await storage.getUserNotificationByTypeAndDate(user.id, candidate.type, dueDate);
            if (existing) continue;

            const channels: string[] = [];
            const shouldInApp = preferences.inAppEnabled !== false;
            const shouldEmail = preferences.emailEnabled !== false && !!user.email;
            const shouldPush = preferences.pushEnabled !== false;

            if (shouldEmail) {
              try {
                const html = getLogbookProAlertEmailHtml({
                  firstName: user.firstName || user.email?.split("@")[0] || "Pilot",
                  title: candidate.title,
                  message: candidate.message,
                  dueDate,
                });
                const text = getLogbookProAlertEmailText({
                  firstName: user.firstName || user.email?.split("@")[0] || "Pilot",
                  title: candidate.title,
                  message: candidate.message,
                  dueDate,
                });
                await client.emails.send({
                  from: fromEmail,
                  to: user.email!,
                  subject: `RSF Pro Alert: ${candidate.title}`,
                  html,
                  text,
                });
                channels.push("email");
                emailsSent += 1;
              } catch (emailError: any) {
                errors.push(`Email failed for ${user.email}: ${emailError.message}`);
              }
            }

            if (shouldPush) {
              try {
                const tokens = await storage.getPushTokensByUser(user.id);
                if (tokens.length > 0) {
                  await fetch("https://exp.host/--/api/v2/push/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(
                      tokens.map((token) => ({
                        to: token.token,
                        title: "RSF Pro Alert",
                        body: candidate.title,
                        data: { type: candidate.type, dueAt: dueDate.toISOString() },
                      }))
                    ),
                  });
                  channels.push("push");
                  pushesSent += tokens.length;
                }
              } catch (pushError: any) {
                errors.push(`Push failed for user ${user.id}: ${pushError.message}`);
              }
            }

            const notification = await storage.createUserNotification({
              userId: user.id,
              type: candidate.type,
              title: candidate.title,
              message: candidate.message,
              referenceDate: dueDate,
              channels,
              isRead: !shouldInApp,
              readAt: shouldInApp ? null : new Date(),
              meta: { dueAt: dueDate.toISOString() },
            } as any);
            if (notification) {
              notificationsCreated += 1;
            }
          }
        } catch (userError: any) {
          errors.push(`User ${user.id} failed: ${userError.message}`);
        }
      }

      res.json({
        usersProcessed: processed,
        notificationsCreated,
        emailsSent,
        pushesSent,
        errors,
      });
    } catch (error: any) {
      console.error("Logbook pro alerts cron error:", error);
      res.status(500).json({ error: "Failed to send logbook pro alerts" });
    }
  });

  // Cron endpoint: Airport IFR/MVFR alerts (favorites)
  app.post("/api/cron/weather-alerts", async (req, res) => {
    try {
      const cronSecret = req.headers["x-cron-secret"];
      const expectedSecret = process.env.CRON_SECRET || process.env.SESSION_SECRET;
      if (!cronSecret || cronSecret !== expectedSecret) {
        console.warn("Unauthorized weather alert cron attempt from IP:", req.ip);
        return res.status(401).json({ error: "Unauthorized" });
      }

      const favorites = await storage.getAirportFavoritesWithAlerts();
      const uniqueIcaos = Array.from(new Set(favorites.map((fav) => fav.icao)));

      const observations = new Map<string, { category: FlightCategory; raw?: string | null }>();
      for (const icao of uniqueIcaos) {
        const metarResult = await fetchMetar(icao);
        const metar = metarResult?.decoded ?? metarResult?.data ?? metarResult;
        const category = computeFlightCategory(metar);
        observations.set(icao, { category, raw: metarResult?.raw ?? metar?.rawOb ?? null });
      }

      let processed = 0;
      let notificationsCreated = 0;
      let pushesSent = 0;
      const errors: string[] = [];
      const now = new Date();

      const isIfrCategory = (category: FlightCategory) => category === "IFR" || category === "LIFR";
      const isMvfrCategory = (category: FlightCategory) =>
        category === "MVFR" || category === "IFR" || category === "LIFR";

      for (const favorite of favorites) {
        processed += 1;
        const observation = observations.get(favorite.icao);
        const category = observation?.category ?? "UNKNOWN";
        const previousCategory = (favorite.lastObservedCategory as FlightCategory | null) ?? null;

        const prevInAlert = previousCategory
          ? (favorite.alertIfr && isIfrCategory(previousCategory)) ||
            (favorite.alertMvfr && isMvfrCategory(previousCategory))
          : false;
        const currInAlert = (favorite.alertIfr && isIfrCategory(category)) ||
          (favorite.alertMvfr && isMvfrCategory(category));

        await storage.updateAirportFavoriteObservation(favorite.id, {
          lastObservedCategory: category,
          lastObservedAt: now,
        });

        if (!currInAlert) continue;
        if (prevInAlert) continue;

        const channelPrefs = await storage.getNotificationPreferences(favorite.userId);
        const preferences = channelPrefs || { emailEnabled: true, pushEnabled: true, inAppEnabled: true, alertDaysBefore: 30 };

        const ifrTriggered = favorite.alertIfr && isIfrCategory(category);
        const alertKind = ifrTriggered ? "ifr" : "mvfr";
        const type = `weather_${alertKind}_${favorite.icao}`;
        const locationLabel = favorite.name
          ? `${favorite.name} (${favorite.icao})`
          : favorite.icao;
        const title = `${category} alert for ${favorite.icao}`;
        const message = `${locationLabel} is currently ${category}.`;

        const channels: string[] = [];
        if (preferences.pushEnabled !== false) {
          try {
            const tokens = await storage.getPushTokensByUser(favorite.userId);
            if (tokens.length > 0) {
              await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                  tokens.map((token) => ({
                    to: token.token,
                    title: "RSF Weather Alert",
                    body: `${favorite.icao}: ${category}`,
                    data: { type, icao: favorite.icao, category },
                  }))
                ),
              });
              channels.push("push");
              pushesSent += tokens.length;
            }
          } catch (pushError: any) {
            errors.push(`Push failed for user ${favorite.userId}: ${pushError.message}`);
          }
        }

        const shouldInApp = preferences.inAppEnabled !== false;
        const notification = await storage.createUserNotification({
          userId: favorite.userId,
          type,
          title,
          message,
          referenceDate: now,
          channels,
          isRead: !shouldInApp,
          readAt: shouldInApp ? null : now,
          meta: {
            icao: favorite.icao,
            category,
            raw: observation?.raw ?? null,
          },
        } as any);

        if (notification) {
          notificationsCreated += 1;
        }

        await storage.updateAirportFavoriteObservation(favorite.id, {
          lastAlertCategory: category,
          lastAlertAt: now,
        });
      }

      res.json({
        favoritesProcessed: processed,
        notificationsCreated,
        pushesSent,
        errors,
      });
    } catch (error: any) {
      console.error("Weather alert cron error:", error);
      res.status(500).json({ error: "Failed to send weather alerts" });
    }
  });
    
    ws.on('close', () => {
      logDebug('WebSocket client disconnected');
    });
  });

  return httpServer;
}



