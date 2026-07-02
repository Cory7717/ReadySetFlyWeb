import type { Express } from "express";
import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import crypto from "crypto";
import zlib from "zlib";
import AdmZip from "adm-zip";
import cors from "cors";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import OpenAI from "openai";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { Client, Environment, LogLevel, OrdersController } from "@paypal/paypal-server-sdk";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { storage } from "./storage";
import { db } from "./db";
import { insertAircraftListingSchema, insertMarketplaceListingSchema, insertRentalSchema, insertReviewSchema, insertFavoriteSchema, insertAirportFavoriteSchema, insertExpenseSchema, insertJobApplicationSchema, insertPromoAlertSchema, insertBannerAdSchema, insertLogbookEntrySchema, insertLogbookProSettingsSchema, insertLogbookArchiveSchema, insertFlightPlanSchema, insertAircraftProfileSchema, insertAircraftTypeSchema, insertEndorsementSchema, insertNotificationPreferencesSchema, insertUserSettingsSchema, insertPushTokenSchema, insertRadioCommsSessionSchema, insertAviationEventSchema, insertAnalyticsEventSchema, insertCfiProfileSchema, insertCfiSchoolSchema, insertCfiSchoolMemberSchema, insertCfiCredentialSchema, insertCfiAvailabilityRuleSchema, insertCfiBookingRequestSchema, insertCfiStudentSchema, insertCfiLessonTemplateSchema, insertCfiLessonSchema, insertCfiStudentFileSchema, insertCfiStudentMilestoneSchema, insertCfiStudentEndorsementSchema, insertCfiConversationSchema, insertCfiMessageSchema, insertCfiLegalAcceptanceSchema, insertPartnerRedirectSchema, insertCrmWeeklyReportSchema, insertFlyingClubSchema, insertFlyingClubAircraftSchema, insertFlyingClubReservationSchema, insertFlyingClubAnnouncementSchema, insertFlyingClubJoinRequestSchema, insertFlyingClubDocumentSchema, insertFlyingClubLegalAcceptanceSchema, insertFlyingClubSquawkSchema, insertFlyingClubMaintenanceItemSchema, insertFlyingClubBlackoutSchema, insertMembershipPartnerOfferSchema, aircraftListings, verificationSubmissions, partnerRedirects, analyticsEvents, aviationEvents, marketplaceListings, promoCodeUsages, notams as notamsTable, users, userNotifications, cfiStudents, cfiConversations, cfiMessages, cfiProfiles, cfiLessons, cfiStudentMilestones, flightPlanFilingActions, flightPlans, crmSalesEmailTemplateTypes, leadCategories, leadStatuses, type BannerAdOrder, type CrmSalesEmailTemplateType, type FlightPlanFilingAction, type LeadCategory, type LeadStatus, type PromoCode, type MembershipPartnerOffer } from "@shared/schema";
import { addDays, format, getISOWeek, getISOWeekYear, parse, parseISO, startOfISOWeek, endOfISOWeek, startOfMonth, endOfMonth } from "date-fns";
import { gpsTrainerUnits } from "@shared/gps-sims";
import { setupAuth, isAuthenticated, isAdmin, isSuperAdmin } from "./auth";
import { getUncachableResendClient } from "./resendClient";
import { getCrmLeadSalesEmailHtml, getCrmLeadSalesEmailSubject, getCrmLeadSalesEmailText, getCrmPlatformOverviewEmailHtml, getCrmPlatformOverviewEmailSubject, getCrmPlatformOverviewEmailText, sendBannerAdvertiserContactEmail, sendContactFormEmail, sendMarketplaceListingContactEmail, sendMembershipGrantEmail, sendUserMarketingEmail } from "./email-templates";
import { ADMIN_PERMISSIONS, ADMIN_ROLE_PERMISSIONS, normalizeAdminPermissions, type AdminPermission, type AdminRole } from "@shared/config/adminAccess";
import { canSendEmail, logger as crmLogger } from "./crmEmailSuppression";
import { buildCrmLeadTemplateCsv, buildCrmLeadTemplateXlsx, findCrmLeadImportDuplicates, mapImportedCrmLeadRows, mergeImportedLeadData, parseCrmLeadImportFile } from "./crmLeadImport";
import { buildLogbookTemplateCsv, buildLogbookTemplateXlsx, findLogbookImportDuplicates, mapImportedLogbookRows, parseLogbookImportFile } from "./logbookImport";
import registerMobileAuthRoutes from "./mobile-auth-routes";
import { registerUnifiedAuthRoutes } from "./unified-auth-routes";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { getBasePrice, getUpgradeDelta, calculateTotalWithTax, isValidUpgrade, VALID_TIERS } from "@shared/config/listingPricing";
import { paypalRequest } from "./paypal-client";
import { getEntitlementsForUser, isSuperAdminEmail, mapPayPalStatusToMembership, resolveMembershipFromPlanId, resolveMembershipFromStoreSignals, resolvePayPalPlanId } from "./membership";
import { maybeSyncLogbookProSubscription } from "./paypal-subscription-sync";
import { buildMarketplaceListingFeeBreakdown } from "./marketplace-fees";
import { resolveTfmsAccess } from "./lib/tier";
import { buildCorsOptions } from "./corsOptions";
import { getFrontendBaseUrl } from "./authRedirectUrls";
import {
  getFlightServiceCertificationReport,
  getLatestFlightServiceCertificationReport,
  listFlightServiceCertificationReports,
  resolveFlightServiceCertificationDownload,
} from "./services/flightServiceCertificationReports";
import { getFlightServiceRuntimeMode, hasFlightServiceTestAcknowledgement } from "./services/flightServiceRuntimeMode";
import {
  getFlightServiceStressRun,
  getFlightServiceStressRunFailures,
  getLatestFlightServiceStressRun,
  listFlightServiceStressRuns,
  resolveFlightServiceStressExport,
} from "./services/flightServiceStressReports";
import {
  getLeidosLabCertificationRun,
  getLeidosLabCertificationRunFailures,
  getLatestLeidosLabCertificationRun,
  listLeidosLabCertificationRuns,
  resolveLeidosLabCertificationExport,
} from "./services/flightServiceLeidosLabReports";
import { resolveTfmsProviderKey, type TfmsOverlay, type TfmsStatus } from "./services/tfms/provider";
import { createStubTfmsProvider } from "./services/tfms/providers/stub";
import { createSoftAuthRateLimiter } from "./middleware/rateLimit";
import { impressionRateLimiter, impressionDedup } from "./middleware/impressionMiddleware";
import { getSharedCacheJson, setSharedCacheJson } from "./redisCache";
import { createDbTfmsProvider } from "./services/tfms/providers/db";
import { computeTfmsRisk } from "./services/tfms/risk";
import { partners } from "./config/partners";
import { registerAdminFinanceRoutes } from "./routes/adminFinance";
import { fuelPricesRouter } from "./routes/fuelPrices";
import { aiToolsRouter } from "./routes/aiTools";
import { registerTipsRoutes } from "./routes/tips";
import { registerScheduleRoutes } from "./routes/schedule";
import { registerOpsReportRoutes } from "./routes/opsReport";
import { registerDosReportingRoutes } from "./routes/dosReporting";
import { registerIncidentReportRoutes } from "./routes/incidentReport";
import { registerCourtyardBudgetRoutes } from "./routes/courtyardBudget";
import { registerComptrollerRoutes } from "./routes/comptroller";
import { registerVehicleListingRoutes } from "./routes/vehicleListings";
import {
  flightPlanFilingProvider,
  getLeidosFlightServiceDiagnostics,
  getLeidosFlightServicePlanDebug,
  verifyLeidosRetrievedPlanAgainstStoredPayload,
  buildOtherInfoWithAircraftType,
  buildZzzzOtherInfoForLeidos,
  normalizeActualAircraftTypeForIcao,
  searchLeidosRoute,
  syncLeidosPlanMetadata,
  validateFlightPlanForAction,
  verifyLeidosWebhookAuthorization,
} from "./services/flight-plan-filing/provider";
import { getCfiVerificationReadiness } from "@shared/cfi-verification";
import { analyzeFiledRoute } from "@shared/flight-plan-route";
import { ACTIVE_FLIGHT_PLAN_LIMIT_MESSAGE, canCreateAnotherActiveFlightPlan } from "@shared/flight-plan-access";
import { isValidZzzzActualLocation } from "@shared/zzzz-location";
import { formatArtccInfo, formatProviderNotificationValue, sanitizeNotificationMessage } from "@shared/provider-notification-format";
import {
  buildFilingEventId,
  buildOtherInfoWithDof,
  mergeProviderMessages,
  normalizeRouteForProvider,
  type FilingFieldDiff,
  type FilingProviderMessage,
} from "@shared/flight-plan-filing-workflow";
import { buildWeeklyDigestProfile, type WeeklyDigestSegment } from "./weeklyEmailPersonalization";
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

// Rental payout hold period — earnings credited to owner balance only after this many hours.
// Env override supported but defaults to 24h so production works without any new env var.
const RENTAL_PAYOUT_HOLD_HOURS = parseInt(process.env.RENTAL_PAYOUT_HOLD_HOURS || "24", 10);

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

const bannerImpressionCache = new Map<string, number>();


// Clean up old entries every hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  bannerImpressionCache.forEach((timestamp, key) => {
    if (timestamp < oneHourAgo) {
      bannerImpressionCache.delete(key);
    }
  });
}, 60 * 60 * 1000);

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

const getRequestUserId = (req: any): string | null => {
  const userId = req.user?.claims?.sub || req.session?.userId;
  return userId ? String(userId) : null;
};

const normalizeMembershipOfferSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const normalizePartnerMemberNumber = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const FLEXIBLE_PARTNER_IDENTIFIER_SLUGS = new Set(["abs-2mo-pro-plus"]);

const allowsFlexiblePartnerIdentifier = (slugOrOffer?: string | { slug?: string | null } | null) => {
  const slug =
    typeof slugOrOffer === "string"
      ? slugOrOffer
      : typeof slugOrOffer?.slug === "string"
        ? slugOrOffer.slug
        : "";
  return FLEXIBLE_PARTNER_IDENTIFIER_SLUGS.has(normalizeMembershipOfferSlug(slug));
};

const buildFlexiblePartnerIdentifier = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = normalizePartnerMemberNumber(trimmed);
  if (normalized) return `SELFATTEST:${normalized}`;
  return `SELFATTEST:${Buffer.from(trimmed.toLowerCase(), "utf8").toString("base64url")}`;
};

const AIRCRAFT_VERIFICATION_DOC_FIELDS = new Set([
  "insuranceDoc",
  "annualInspectionDoc",
]);

function buildAircraftVerificationDocPrefix(userId: string, fieldName: string) {
  return `verification-docs/${userId}/${fieldName}`;
}

function isOwnedAircraftVerificationDocPath(pathValue: unknown, userId: string): pathValue is string {
  if (typeof pathValue !== "string") return false;
  const trimmed = pathValue.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/objects/")) return true;
  return trimmed.startsWith(`verification-docs/${userId}/`);
}

function normalizeAircraftRegistration(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function slugifyFlyingClubName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function buildUniqueFlyingClubSlug(name: string): Promise<string> {
  const base = slugifyFlyingClubName(name) || "flying-club";
  let slug = base;
  let suffix = 2;
  while (await storage.getFlyingClubBySlug(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

function parseBasicCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current.trim());
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  return rows;
}

const revenueCatWebhookSchema = z.object({
  api_version: z.string().optional(),
  event: z.object({
    id: z.string().optional(),
    type: z.string(),
    app_user_id: z.string().optional().nullable(),
    original_app_user_id: z.string().optional().nullable(),
    aliases: z.array(z.string()).optional().nullable(),
    product_id: z.string().optional().nullable(),
    entitlement_id: z.string().optional().nullable(),
    entitlement_ids: z.array(z.string()).optional().nullable(),
    expiration_at_ms: z.number().nullable().optional(),
    purchased_at_ms: z.number().nullable().optional(),
    event_timestamp_ms: z.number().nullable().optional(),
    store: z.string().optional().nullable(),
    environment: z.string().optional().nullable(),
  }),
});

function parseRevenueCatMs(value?: number | null): Date | null {
  if (!value || !Number.isFinite(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getRevenueCatProvider(store?: string | null): "app_store" | "google_play" | "revenuecat" {
  const normalized = String(store || "").toUpperCase();
  if (normalized === "APP_STORE" || normalized === "MAC_APP_STORE") return "app_store";
  if (normalized === "PLAY_STORE") return "google_play";
  return "revenuecat";
}

type TerrainProfilePoint = {
  lat: number;
  lon: number;
  elevationFt: number | null;
};

type NearbyObstacle = {
  id: string;
  lat: number;
  lon: number;
  amslFt: number | null;
  aglFt: number | null;
  city: string | null;
  state: string | null;
  kind: string | null;
  lighting: string | null;
  distanceNm: number;
};

type CachedObstacleRecord = Omit<NearbyObstacle, "distanceNm">;

const USGS_EPQS_URL = (process.env.USGS_EPQS_URL || "https://epqs.nationalmap.gov/v1/json").trim();
const FAA_DDOF_ZIP_URL = (
  process.env.FAA_DDOF_ZIP_URL ||
  "https://aeronav.faa.gov/Obst_Data/DDOF_CSV.zip"
).trim();
const FAA_DDOF_CACHE_TTL_MS = Math.max(60 * 60 * 1000, Number(process.env.FAA_DDOF_CACHE_TTL_MS || 12 * 60 * 60 * 1000));

let obstacleCache:
  | {
      loadedAt: number;
      rows: CachedObstacleRecord[];
    }
  | null = null;
let obstacleCachePromise: Promise<CachedObstacleRecord[]> | null = null;

function findHeaderIndex(headers: string[], aliases: string[]) {
  const normalizedAliases = aliases.map((alias) => alias.toUpperCase());
  return headers.findIndex((header) => normalizedAliases.includes(header));
}

function parseCsvNumber(value: string | undefined) {
  if (!value) return null;
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c * 0.539957;
}

function sampleRouteLine(points: Array<{ lat: number; lon: number }>, count: number) {
  if (points.length === 0) return [] as Array<{ lat: number; lon: number }>;
  if (points.length === 1) return [points[0]];

  const segments = points.slice(1).map((point, index) => {
    const start = points[index];
    return {
      start,
      end: point,
      lengthNm: haversineNm(start.lat, start.lon, point.lat, point.lon),
    };
  });
  const totalNm = segments.reduce((sum, segment) => sum + segment.lengthNm, 0);
  if (totalNm <= 0) return points;

  const sampleCount = Math.max(2, Math.min(count, 80));
  const results: Array<{ lat: number; lon: number }> = [];

  for (let i = 0; i < sampleCount; i += 1) {
    const targetNm = (totalNm * i) / (sampleCount - 1);
    let traversed = 0;
    let chosen = segments[segments.length - 1];

    for (const segment of segments) {
      if (traversed + segment.lengthNm >= targetNm) {
        chosen = segment;
        break;
      }
      traversed += segment.lengthNm;
    }

    const withinSegment = Math.max(0, targetNm - traversed);
    const ratio = chosen.lengthNm > 0 ? withinSegment / chosen.lengthNm : 0;
    results.push({
      lat: chosen.start.lat + (chosen.end.lat - chosen.start.lat) * ratio,
      lon: chosen.start.lon + (chosen.end.lon - chosen.start.lon) * ratio,
    });
  }

  return results;
}

async function fetchTerrainElevationFt(lat: number, lon: number): Promise<number | null> {
  const params = new URLSearchParams({
    x: String(lon),
    y: String(lat),
    units: "Feet",
    wkid: "4326",
    includeDate: "false",
  });
  const response = await fetchWithTimeout(`${USGS_EPQS_URL}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ReadySetFly Terrain/1.0",
    },
  }, 10000);

  if (!response.ok) {
    throw new Error(`USGS elevation query failed (${response.status})`);
  }

  const payload = await response.json();
  const candidates = [
    payload?.value,
    payload?.elevation,
    payload?.USGS_Elevation_Point_Query_Service?.Elevation_Query?.Elevation,
  ];
  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

const TERRAIN_POINT_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const TERRAIN_PROFILE_CACHE_TTL_MS = 1000 * 60 * 10;
const terrainPointCache = new Map<string, { expiresAt: number; elevationFt: number | null }>();
const terrainProfileCache = new Map<string, { expiresAt: number; payload: { source: string; samples: Array<{ lat: number; lon: number; elevationFt: number | null }>; maxElevationFt: number | null; sampledPointCount: number; partial: boolean } }>();
const terrainProfileInFlight = new Map<string, Promise<{ source: string; samples: Array<{ lat: number; lon: number; elevationFt: number | null }>; maxElevationFt: number | null; sampledPointCount: number; partial: boolean }>>();

function getTerrainPointCacheKey(lat: number, lon: number) {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

async function fetchTerrainElevationFtCached(lat: number, lon: number): Promise<number | null> {
  const key = getTerrainPointCacheKey(lat, lon);
  const cached = terrainPointCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.elevationFt;
  }

  const elevationFt = await fetchTerrainElevationFt(lat, lon);
  terrainPointCache.set(key, {
    expiresAt: Date.now() + TERRAIN_POINT_CACHE_TTL_MS,
    elevationFt,
  });
  return elevationFt;
}

async function loadCachedObstacles(): Promise<CachedObstacleRecord[]> {
  if (obstacleCache && obstacleCache.loadedAt + FAA_DDOF_CACHE_TTL_MS > Date.now()) {
    return obstacleCache.rows;
  }
  if (obstacleCachePromise) {
    return obstacleCachePromise;
  }

  obstacleCachePromise = (async () => {
    const response = await fetchWithTimeout(FAA_DDOF_ZIP_URL, {
      headers: {
        Accept: "application/zip, application/octet-stream",
        "User-Agent": "ReadySetFly Obstacles/1.0",
      },
    }, 20000);

    if (!response.ok) {
      throw new Error(`FAA DDOF download failed (${response.status})`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const zip = new AdmZip(buffer);
    const csvEntry = zip
      .getEntries()
      .find((entry) => !entry.isDirectory && entry.entryName.toLowerCase().endsWith(".csv"));

    if (!csvEntry) {
      throw new Error("FAA DDOF archive did not contain a CSV file");
    }

    const csvText = zip.readAsText(csvEntry, "utf8");
    const rows = parseBasicCsvRows(csvText);
    if (rows.length < 2) {
      throw new Error("FAA DDOF CSV did not contain obstacle rows");
    }

    const headers = rows[0].map((value) => value.trim().toUpperCase());
    const latIndex = findHeaderIndex(headers, ["LATDEC", "LATITUDE", "LATDD", "LATITUDEDECIMAL"]);
    const lonIndex = findHeaderIndex(headers, ["LONDEC", "LONGITUDE", "LONDD", "LONGITUDEDECIMAL"]);
    const amslIndex = findHeaderIndex(headers, ["AMSL", "ALT_MSL", "ELEVATION", "MSL"]);
    const aglIndex = findHeaderIndex(headers, ["AGL", "HEIGHTAGL", "HEIGHT_AGL"]);
    const cityIndex = findHeaderIndex(headers, ["CITY", "CITYNAME"]);
    const stateIndex = findHeaderIndex(headers, ["STATE", "STATEABBR"]);
    const kindIndex = findHeaderIndex(headers, ["TYPE", "OBSTACLETYPE", "KIND"]);
    const lightingIndex = findHeaderIndex(headers, ["LIGHTING", "LIGHTEDIND", "MARKER"]);
    const idIndex = findHeaderIndex(headers, ["OID", "OBSTACLEID", "ID", "NUMBER"]);

    if (latIndex < 0 || lonIndex < 0) {
      throw new Error("FAA DDOF CSV headers did not include decimal latitude/longitude");
    }

    const parsedRows: CachedObstacleRecord[] = [];
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const lat = parseCsvNumber(row[latIndex]);
      const lon = parseCsvNumber(row[lonIndex]);
      if (lat === null || lon === null) continue;
      parsedRows.push({
        id: String(row[idIndex] || `obstacle-${rowIndex}`).trim(),
        lat,
        lon,
        amslFt: amslIndex >= 0 ? parseCsvNumber(row[amslIndex]) : null,
        aglFt: aglIndex >= 0 ? parseCsvNumber(row[aglIndex]) : null,
        city: cityIndex >= 0 ? String(row[cityIndex] || "").trim() || null : null,
        state: stateIndex >= 0 ? String(row[stateIndex] || "").trim() || null : null,
        kind: kindIndex >= 0 ? String(row[kindIndex] || "").trim() || null : null,
        lighting: lightingIndex >= 0 ? String(row[lightingIndex] || "").trim() || null : null,
      });
    }

    obstacleCache = {
      loadedAt: Date.now(),
      rows: parsedRows,
    };
    obstacleCachePromise = null;
    return parsedRows;
  })().catch((error) => {
    obstacleCachePromise = null;
    throw error;
  });

  return obstacleCachePromise;
}

function mapFlyingClubFleetCsv(csvText: string) {
  const rows = parseBasicCsvRows(csvText);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.toLowerCase());

  return rows.slice(1).map((values, index) => {
    const get = (names: string[]) => {
      const headerIndex = headers.findIndex((header) => names.includes(header));
      return headerIndex >= 0 ? values[headerIndex] || "" : "";
    };

    return {
      rowNumber: index + 2,
      displayName: get(["display_name", "name", "aircraft_name"]),
      tailNumber: get(["tail_number", "tail", "registration", "n_number"]),
      makeModel: get(["make_model", "make", "model", "aircraft_type"]),
      hourlyRateWet: get(["hourly_rate_wet", "wet_rate", "rate_wet"]),
      hourlyRateDry: get(["hourly_rate_dry", "dry_rate", "rate_dry"]),
      status: get(["status"]),
      notes: get(["notes"]),
    };
  }).filter((row) => row.displayName || row.tailNumber || row.makeModel);
}

function normalizeFlyingClubRate(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const numericValue = Number(trimmed.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numericValue)) return undefined;
  return numericValue.toFixed(2);
}

type FlyingClubAccessContext = {
  club: Awaited<ReturnType<typeof storage.getFlyingClub>>;
  userId: string | null;
  membership: Awaited<ReturnType<typeof storage.getFlyingClubMembership>>;
  canManage: boolean;
  canReserve: boolean;
};

async function getFlyingClubAccessContext(req: any, clubId: string): Promise<FlyingClubAccessContext> {
  const club = await storage.getFlyingClub(clubId);
  const userId = getRequestUserId(req);
  const viewer = userId ? await storage.getUser(userId) : undefined;
  const membership = userId ? await storage.getFlyingClubMembership(clubId, userId) : undefined;
  const isOwner = !!userId && userId === club?.ownerUserId;
  const isAdmin = !!viewer?.isAdmin || !!viewer?.isSuperAdmin;
  const isManager = membership?.role === "owner" || membership?.role === "manager";
  const isActiveMember = membership?.status === "active";

  return {
    club,
    userId,
    membership,
    canManage: !!club && (isOwner || isManager || isAdmin),
    canReserve: !!club && (isOwner || isActiveMember || isAdmin),
  };
}

async function getPendingRequiredClubDocuments(clubId: string, userId: string | null) {
  const documents = await storage.getFlyingClubDocuments(clubId);
  const requiredDocuments = documents.filter((document) => document.isActive && document.requiresAcceptance);
  if (!userId || requiredDocuments.length === 0) {
    return { documents, pendingDocuments: requiredDocuments, acceptances: [] as Awaited<ReturnType<typeof storage.getFlyingClubLegalAcceptancesForUser>> };
  }
  const acceptances = await storage.getFlyingClubLegalAcceptancesForUser(clubId, userId);
  const pendingDocuments = requiredDocuments.filter((document) => {
    const accepted = acceptances.some(
      (acceptance) => acceptance.documentId === document.id && acceptance.version === document.version,
    );
    return !accepted;
  });
  return { documents, pendingDocuments, acceptances };
}

const TAILWINDS_PROMO_CODE = "TAILWINDS";
const TAILWINDS_CATEGORY_LIMIT = 5;
const TAILWINDS_DURATION_DAYS = 90;

type MarketplacePromoResolution =
  | {
      valid: true;
      code: string;
      description: string;
      discountType: string;
      discountValue: number | null;
      discountAmount: number;
      promoCodeRecord: PromoCode | null;
      durationDays: number;
      completionToken: string | null;
    }
  | {
      valid: false;
      message: string;
    };

const generateMarketplaceFreeCompletionToken = ({
  userId,
  promoCode,
  originalAmount,
  discountAmount,
  durationDays,
}: {
  userId: string;
  promoCode: string;
  originalAmount: number;
  discountAmount: number;
  durationDays: number;
}) =>
  jwt.sign(
    {
      type: "free-marketplace-listing",
      userId,
      promoCode,
      originalAmount: originalAmount.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      durationDays,
      timestamp: Date.now(),
    },
    process.env.SESSION_SECRET || "dev-secret",
    { expiresIn: "30m" },
  );

async function getOrCreateTailwindsPromoCode(): Promise<PromoCode> {
  const existing = await storage.getPromoCodeByCode(TAILWINDS_PROMO_CODE);
  if (existing) {
    return existing;
  }

  return storage.createPromoCode({
    code: TAILWINDS_PROMO_CODE,
    description: "Soft-launch offer: first eligible listing in category free for 3 months.",
    discountType: "waive_creation_fee",
    discountValue: undefined,
    maxUses: undefined,
    isActive: true,
    validFrom: new Date(),
    validUntil: undefined,
    applicableToMarketplace: true,
    applicableToBannerAds: false,
  });
}

async function resolveMarketplacePromoCode(params: {
  code: string;
  userId?: string | null;
  category?: string | null;
  amount?: number | null;
}): Promise<MarketplacePromoResolution> {
  const normalizedCode = params.code.trim().toUpperCase();
  const category = params.category?.trim() || null;
  const amount = Number.isFinite(params.amount) ? Math.max(0, Number(params.amount)) : null;

  if (normalizedCode === TAILWINDS_PROMO_CODE) {
    const promoCodeRecord = await getOrCreateTailwindsPromoCode();

    if (!params.userId) {
      return {
        valid: false,
        message: "Sign in to use the TAILWINDS soft-launch offer.",
      };
    }

    if (!category) {
      return {
        valid: false,
        message: "Marketplace category is required for TAILWINDS.",
      };
    }

    const existingListings = await storage.getMarketplaceListingsByUser(params.userId);
    const hasExistingListing = existingListings.some((listing) => !listing.isExample);
    if (hasExistingListing) {
      return {
        valid: false,
        message: "TAILWINDS applies to your first marketplace listing only.",
      };
    }

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(promoCodeUsages)
      .innerJoin(
        marketplaceListings,
        eq(promoCodeUsages.marketplaceListingId, marketplaceListings.id),
      )
      .where(
        and(
          eq(promoCodeUsages.promoCodeId, promoCodeRecord.id),
          eq(marketplaceListings.category, category),
          eq(marketplaceListings.isExample, false),
        ),
      );

    const categoryClaimCount = Number(result?.count ?? 0);
    if (categoryClaimCount >= TAILWINDS_CATEGORY_LIMIT) {
      return {
        valid: false,
        message: `TAILWINDS has already been claimed ${TAILWINDS_CATEGORY_LIMIT} times in this category.`,
      };
    }

    const discountAmount = amount ?? 0;
    return {
      valid: true,
      code: TAILWINDS_PROMO_CODE,
      description: "Soft-launch offer applied: your first listing in this category is free for 3 months.",
      discountType: "fixed",
      discountValue: amount ?? null,
      discountAmount,
      promoCodeRecord,
      durationDays: TAILWINDS_DURATION_DAYS,
      completionToken:
        params.userId && amount && amount > 0
          ? generateMarketplaceFreeCompletionToken({
              userId: params.userId,
              promoCode: TAILWINDS_PROMO_CODE,
              originalAmount: amount,
              discountAmount,
              durationDays: TAILWINDS_DURATION_DAYS,
            })
          : null,
    };
  }

  const promoCode = await storage.validatePromoCodeForContext(normalizedCode, "marketplace");
  if (!promoCode) {
    return {
      valid: false,
      message: "Invalid or expired promo code",
    };
  }

  let discountAmount = 0;
  if (amount !== null) {
    if (promoCode.discountType === "percentage") {
      discountAmount = (amount * parseFloat(promoCode.discountValue || "0")) / 100;
    } else if (promoCode.discountType === "fixed" || promoCode.discountType === "fixed_amount") {
      discountAmount = parseFloat(promoCode.discountValue || "0");
    } else if (promoCode.discountType === "free_7_day" || promoCode.discountType === "waive_creation_fee") {
      discountAmount = amount;
    }
    discountAmount = Math.min(discountAmount, amount);
  }

  const durationDays = promoCode.discountType === "free_7_day" ? 7 : 30;

  return {
    valid: true,
    code: promoCode.code,
    description: promoCode.description || "Promo code applied successfully!",
    discountType: promoCode.discountType,
    discountValue: promoCode.discountValue ? parseFloat(promoCode.discountValue) : null,
    discountAmount,
    promoCodeRecord: promoCode,
    durationDays,
    completionToken:
      params.userId && amount !== null && Math.max(0, amount - discountAmount) <= 0
        ? generateMarketplaceFreeCompletionToken({
            userId: params.userId,
            promoCode: promoCode.code,
            originalAmount: amount,
            discountAmount,
            durationDays,
          })
        : null,
  };
}

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

function getPublicFrontendBaseUrl() {
  return getFrontendBaseUrl();
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

function parseCrmSalesTemplateInput(body: any): {
  templateType: CrmSalesEmailTemplateType;
  promoCode?: string;
  promoDetails?: string;
  greetingName?: string;
  subjectOverride?: string;
  introOverride?: string;
  customNote?: string;
} {
  const templateType = typeof body?.templateType === "string" ? body.templateType : "";
  if (!crmSalesEmailTemplateTypes.includes(templateType as CrmSalesEmailTemplateType)) {
    throw new Error("Invalid CRM sales email template");
  }

  const promoCode = typeof body?.promoCode === "string" ? body.promoCode.trim() : "";
  const promoDetails = typeof body?.promoDetails === "string" ? body.promoDetails.trim() : "";
  const greetingName = typeof body?.greetingName === "string" ? body.greetingName.trim() : "";
  const subjectOverride = typeof body?.subjectOverride === "string" ? body.subjectOverride.trim() : "";
  const introOverride = typeof body?.introOverride === "string" ? body.introOverride.trim() : "";
  const customNote = typeof body?.customNote === "string" ? body.customNote.trim() : "";

  return {
    templateType: templateType as CrmSalesEmailTemplateType,
    promoCode: promoCode || undefined,
    promoDetails: promoDetails || undefined,
    greetingName: greetingName || undefined,
    subjectOverride: subjectOverride || undefined,
    introOverride: introOverride || undefined,
    customNote: customNote || undefined,
  };
}

const crmCampaignAudienceTypes = [
  "all_eligible",
  "by_category",
  "by_status",
  "never_emailed",
] as const;

type CrmCampaignAudienceType = typeof crmCampaignAudienceTypes[number];

function parseCrmCampaignRequest(body: any): {
  audienceType: CrmCampaignAudienceType;
  category?: LeadCategory;
  status?: LeadStatus;
  minDaysSinceLastEmail: number;
  templateType: CrmSalesEmailTemplateType;
  promoCode?: string;
  promoDetails?: string;
  subjectOverride?: string;
  introOverride?: string;
  customNote?: string;
} {
  const audienceType = typeof body?.audienceType === "string" ? body.audienceType : "";
  if (!crmCampaignAudienceTypes.includes(audienceType as CrmCampaignAudienceType)) {
    throw new Error("Invalid CRM campaign audience");
  }

  const category = typeof body?.category === "string" ? body.category : "";
  const status = typeof body?.status === "string" ? body.status : "";
  if (audienceType === "by_category" && !leadCategories.includes(category as LeadCategory)) {
    throw new Error("Invalid CRM campaign category");
  }
  if (audienceType === "by_status" && !leadStatuses.includes(status as LeadStatus)) {
    throw new Error("Invalid CRM campaign status");
  }

  const requestedCooldown = Number(body?.minDaysSinceLastEmail);
  const minDaysSinceLastEmail = [0, 30, 45, 60].includes(requestedCooldown) ? requestedCooldown : 45;
  const templateInput = parseCrmSalesTemplateInput(body);

  return {
    audienceType: audienceType as CrmCampaignAudienceType,
    category: category ? (category as LeadCategory) : undefined,
    status: status ? (status as LeadStatus) : undefined,
    minDaysSinceLastEmail,
    ...templateInput,
  };
}

function getCrmCampaignAudienceLabel(options: {
  audienceType: CrmCampaignAudienceType;
  category?: LeadCategory;
  status?: LeadStatus;
}) {
  if (options.audienceType === "by_category" && options.category) {
    return `Category: ${options.category}`;
  }
  if (options.audienceType === "by_status" && options.status) {
    return `Status: ${options.status}`;
  }
  if (options.audienceType === "never_emailed") {
    return "Never emailed";
  }
  return "All eligible";
}

async function buildCrmCampaignAudience(options: {
  audienceType: CrmCampaignAudienceType;
  category?: LeadCategory;
  status?: LeadStatus;
  minDaysSinceLastEmail: number;
}) {
  const allLeads = await storage.getAllLeads();
  let matchedLeads = allLeads;

  if (options.audienceType === "by_category" && options.category) {
    matchedLeads = matchedLeads.filter((lead) => (lead.category || "other") === options.category);
  } else if (options.audienceType === "by_status" && options.status) {
    matchedLeads = matchedLeads.filter((lead) => (lead.status || "new") === options.status);
  } else if (options.audienceType === "never_emailed") {
    matchedLeads = matchedLeads.filter((lead) => !lead.salesEmailLastSentAt);
  }

  const cooldownCutoff = options.minDaysSinceLastEmail > 0
    ? new Date(Date.now() - options.minDaysSinceLastEmail * 24 * 60 * 60 * 1000)
    : null;

  let excludedMissingEmail = 0;
  let excludedUnsubscribed = 0;
  let excludedRecentlyEmailed = 0;
  const eligibleLeads = matchedLeads.filter((lead) => {
    if (!lead.email?.trim()) {
      excludedMissingEmail += 1;
      return false;
    }
    if (!canSendEmail(lead) || Boolean(lead.marketingEmailOptOutAt)) {
      excludedUnsubscribed += 1;
      return false;
    }
    if (cooldownCutoff && lead.salesEmailLastSentAt && new Date(lead.salesEmailLastSentAt) > cooldownCutoff) {
      excludedRecentlyEmailed += 1;
      return false;
    }
    return true;
  });

  return {
    matchedLeads,
    eligibleLeads,
    summary: {
      audienceLabel: getCrmCampaignAudienceLabel(options),
      totalMatched: matchedLeads.length,
      eligibleCount: eligibleLeads.length,
      excludedMissingEmail,
      excludedUnsubscribed,
      excludedRecentlyEmailed,
      minDaysSinceLastEmail: options.minDaysSinceLastEmail,
    },
  };
}

function parseCrmImportExcludedRows(value: unknown): Set<number> {
  if (typeof value !== "string" || !value.trim()) return new Set<number>();
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return new Set<number>();
    return new Set(
      parsed
        .map((entry) => Number(entry))
        .filter((entry) => Number.isInteger(entry) && entry > 0),
    );
  } catch {
    return new Set<number>();
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

type AdminUserSortField =
  | "createdAt"
  | "firstName"
  | "lastName"
  | "email"
  | "membershipTier";

type AdminUserAudience =
  | "all_active"
  | "recently_joined"
  | "free_users"
  | "rsf_pro"
  | "rsf_pro_plus"
  | "without_subscription"
  | "selected_users"
  | "filtered_results";

type AdminUserFilterInput = {
  search?: string;
  joinedPreset?: "all" | "today" | "last7" | "last30" | "custom";
  joinedFrom?: string | null;
  joinedTo?: string | null;
  accountStatus?: "all" | "active" | "inactive";
  marketingStatus?: "all" | "subscribed" | "unsubscribed";
  subscriptionTier?: "all" | "free" | "pro" | "pro_plus";
  cfiProfile?: "all" | "with" | "without";
  aircraftOwner?: "all" | "with" | "without";
  sortBy?: AdminUserSortField;
  sortDirection?: "asc" | "desc";
};

type AdminAudienceRequest = AdminUserFilterInput & {
  audience?: AdminUserAudience;
  selectedUserIds?: string[];
};

type AdminUserDirectoryRow = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date | null;
  isSuspended: boolean | null;
  membershipTier: string | null;
  membershipStatus: string | null;
  membershipEndsAt: Date | null;
  membershipGrantTier: string | null;
  membershipGrantEndsAt: Date | null;
  weeklyEmailOptOutAt: Date | null;
  weeklyEmailOptIn: boolean | null;
  emailVerified: boolean | null;
  aircraftCount: number;
  marketplaceCount: number;
  hasCfiProfile: boolean;
};

const adminUserFiltersSchema = z.object({
  search: z.string().optional(),
  joinedPreset: z.enum(["all", "today", "last7", "last30", "custom"]).optional(),
  joinedFrom: z.string().optional().nullable(),
  joinedTo: z.string().optional().nullable(),
  accountStatus: z.enum(["all", "active", "inactive"]).optional(),
  marketingStatus: z.enum(["all", "subscribed", "unsubscribed"]).optional(),
  subscriptionTier: z.enum(["all", "free", "pro", "pro_plus"]).optional(),
  cfiProfile: z.enum(["all", "with", "without"]).optional(),
  aircraftOwner: z.enum(["all", "with", "without"]).optional(),
  sortBy: z.enum(["createdAt", "firstName", "lastName", "email", "membershipTier"]).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
});

const adminAudienceRequestSchema = adminUserFiltersSchema.extend({
  audience: z.enum([
    "all_active",
    "recently_joined",
    "free_users",
    "rsf_pro",
    "rsf_pro_plus",
    "without_subscription",
    "selected_users",
    "filtered_results",
  ]).optional(),
  selectedUserIds: z.array(z.string()).optional(),
});

const normalizeAdminUserFilters = (input?: AdminUserFilterInput) => ({
  search: input?.search?.trim() || "",
  joinedPreset: input?.joinedPreset || "all",
  joinedFrom: input?.joinedFrom?.trim() || "",
  joinedTo: input?.joinedTo?.trim() || "",
  accountStatus: input?.accountStatus || "all",
  marketingStatus: input?.marketingStatus || "all",
  subscriptionTier: input?.subscriptionTier || "all",
  cfiProfile: input?.cfiProfile || "all",
  aircraftOwner: input?.aircraftOwner || "all",
  sortBy: input?.sortBy || "createdAt",
  sortDirection: input?.sortDirection || "desc",
});

const parseAdminDateInput = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfDayLocal = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDayLocal = (value: Date) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const membershipTierRank = (value?: string | null) =>
  value === "pro_plus" ? 2 : value === "pro" ? 1 : 0;

const resolveEffectiveMembershipTier = (row: AdminUserDirectoryRow) => {
  const now = new Date();
  const baseTier = row.membershipTier === "pro_plus" || row.membershipTier === "pro" ? row.membershipTier : "free";
  const membershipActive =
    membershipTierRank(baseTier) > 0 &&
    (row.membershipStatus === "active" ||
      row.membershipStatus === "trialing" ||
      (!!row.membershipEndsAt && new Date(row.membershipEndsAt) > now));
  const grantTier = row.membershipGrantTier === "pro_plus" || row.membershipGrantTier === "pro" ? row.membershipGrantTier : null;
  const grantActive = !!grantTier && !!row.membershipGrantEndsAt && new Date(row.membershipGrantEndsAt) > now;

  if (membershipActive && grantActive) {
    return membershipTierRank(grantTier) > membershipTierRank(baseTier) ? grantTier! : baseTier;
  }
  if (grantActive && grantTier) return grantTier;
  if (membershipActive) return baseTier;
  return "free";
};

const hasPaidOrGrantedAccess = (row: AdminUserDirectoryRow) => resolveEffectiveMembershipTier(row) !== "free";

const isAdminUserActive = (row: AdminUserDirectoryRow) => !row.isSuspended;

const isMarketingSubscribed = (row: AdminUserDirectoryRow) =>
  !row.weeklyEmailOptOutAt &&
  row.weeklyEmailOptIn !== false;

const isValidRecipientEmail = (email?: string | null) =>
  !!email && z.string().email().safeParse(email).success;

const sortAdminUserRows = (rows: AdminUserDirectoryRow[], sortBy: AdminUserSortField, direction: "asc" | "desc") => {
  const factor = direction === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    const createdCompare =
      ((a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0)) * factor;
    if (sortBy === "createdAt") return createdCompare;

    const getValue = (row: AdminUserDirectoryRow) => {
      switch (sortBy) {
        case "firstName":
          return (row.firstName || "").toLowerCase();
        case "lastName":
          return (row.lastName || "").toLowerCase();
        case "email":
          return (row.email || "").toLowerCase();
        case "membershipTier":
          return resolveEffectiveMembershipTier(row);
        default:
          return "";
      }
    };
    const aValue = getValue(a);
    const bValue = getValue(b);
    if (aValue < bValue) return -1 * factor;
    if (aValue > bValue) return 1 * factor;
    return createdCompare || (a.id < b.id ? -1 : 1);
  });
  return rows;
};

const applyAdminUserFilters = (rows: AdminUserDirectoryRow[], rawFilters?: AdminUserFilterInput) => {
  const filters = normalizeAdminUserFilters(rawFilters);
  const now = new Date();
  const todayStart = startOfDayLocal(now);
  const joinedFrom =
    filters.joinedPreset === "today"
      ? todayStart
      : filters.joinedPreset === "last7"
        ? startOfDayLocal(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000))
        : filters.joinedPreset === "last30"
          ? startOfDayLocal(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000))
          : filters.joinedPreset === "custom"
            ? parseAdminDateInput(filters.joinedFrom)
            : null;
  const joinedTo =
    filters.joinedPreset === "custom" ? parseAdminDateInput(filters.joinedTo) : null;
  const searchLower = filters.search.toLowerCase();

  const filtered = rows.filter((row) => {
    if (filters.search) {
      const isIdLookup = searchLower.startsWith("id:");
      const idLookup = isIdLookup ? searchLower.slice(3).trim() : "";
      const haystack = [
        row.firstName || "",
        row.lastName || "",
        row.email || "",
        row.id,
        `${row.firstName || ""} ${row.lastName || ""}`.trim(),
      ]
        .join(" ")
        .toLowerCase();
      if (isIdLookup) {
        if (!idLookup || !row.id.toLowerCase().includes(idLookup)) return false;
      } else if (!haystack.includes(searchLower)) {
        return false;
      }
    }

    if (joinedFrom) {
      const created = row.createdAt ? new Date(row.createdAt) : null;
      if (!created || created < startOfDayLocal(joinedFrom)) return false;
    }
    if (joinedTo) {
      const created = row.createdAt ? new Date(row.createdAt) : null;
      if (!created || created > endOfDayLocal(joinedTo)) return false;
    }

    if (filters.accountStatus === "active" && !isAdminUserActive(row)) return false;
    if (filters.accountStatus === "inactive" && isAdminUserActive(row)) return false;

    if (filters.marketingStatus === "subscribed" && !isMarketingSubscribed(row)) return false;
    if (filters.marketingStatus === "unsubscribed" && isMarketingSubscribed(row)) return false;

    if (filters.subscriptionTier !== "all" && resolveEffectiveMembershipTier(row) !== filters.subscriptionTier) {
      return false;
    }

    if (filters.cfiProfile === "with" && !row.hasCfiProfile) return false;
    if (filters.cfiProfile === "without" && row.hasCfiProfile) return false;

    if (filters.aircraftOwner === "with" && row.aircraftCount <= 0) return false;
    if (filters.aircraftOwner === "without" && row.aircraftCount > 0) return false;

    return true;
  });

  return sortAdminUserRows(filtered, filters.sortBy, filters.sortDirection);
};

const buildAdminUserSummary = (row: AdminUserDirectoryRow) => {
  const effectiveMembershipTier = resolveEffectiveMembershipTier(row);
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    createdAt: row.createdAt,
    isSuspended: row.isSuspended,
    membershipTier: row.membershipTier,
    membershipStatus: row.membershipStatus,
    effectiveMembershipTier,
    marketingSubscribed: isMarketingSubscribed(row),
    emailVerified: row.emailVerified,
    hasCfiProfile: row.hasCfiProfile,
    aircraftCount: row.aircraftCount,
    marketplaceCount: row.marketplaceCount,
  };
};

const loadAdminUserDirectory = async (userIds?: string[]): Promise<AdminUserDirectoryRow[]> => {
  const normalizedUserIds = (userIds || []).map((id) => id.trim()).filter(Boolean);
  if (userIds && normalizedUserIds.length === 0) {
    return [];
  }

  const aircraftCounts = db
    .select({
      userId: aircraftListings.ownerId,
      aircraftCount: sql<number>`count(*)::int`.as("aircraft_count"),
    })
    .from(aircraftListings)
    .groupBy(aircraftListings.ownerId)
    .as("admin_user_aircraft_counts");

  const marketplaceCounts = db
    .select({
      userId: marketplaceListings.userId,
      marketplaceCount: sql<number>`count(*)::int`.as("marketplace_count"),
    })
    .from(marketplaceListings)
    .groupBy(marketplaceListings.userId)
    .as("admin_user_marketplace_counts");

  const cfiUsers = db
    .select({
      userId: cfiProfiles.userId,
    })
    .from(cfiProfiles)
    .groupBy(cfiProfiles.userId)
    .as("admin_user_cfi_profiles");

  let query = db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      createdAt: users.createdAt,
      isSuspended: users.isSuspended,
      membershipTier: users.membershipTier,
      membershipStatus: users.membershipStatus,
      membershipEndsAt: users.membershipEndsAt,
      membershipGrantTier: users.membershipGrantTier,
      membershipGrantEndsAt: users.membershipGrantEndsAt,
      weeklyEmailOptOutAt: users.weeklyEmailOptOutAt,
      weeklyEmailOptIn: users.weeklyEmailOptIn,
      emailVerified: users.emailVerified,
      aircraftCount: sql<number>`coalesce(${aircraftCounts.aircraftCount}, 0)::int`,
      marketplaceCount: sql<number>`coalesce(${marketplaceCounts.marketplaceCount}, 0)::int`,
      hasCfiProfile: sql<boolean>`case when ${cfiUsers.userId} is not null then true else false end`,
    })
    .from(users)
    .leftJoin(aircraftCounts, eq(aircraftCounts.userId, users.id))
    .leftJoin(marketplaceCounts, eq(marketplaceCounts.userId, users.id))
    .leftJoin(cfiUsers, eq(cfiUsers.userId, users.id));

  if (normalizedUserIds.length > 0) {
    query = query.where(inArray(users.id, normalizedUserIds)) as typeof query;
  }

  const rows = await query;

  return rows.map((row) => ({
    ...row,
    aircraftCount: Number(row.aircraftCount || 0),
    marketplaceCount: Number(row.marketplaceCount || 0),
    hasCfiProfile: Boolean(row.hasCfiProfile),
  }));
};

const loadAdminUserDirectoryForFilters = async (rawFilters?: AdminUserFilterInput) => {
  const filters = normalizeAdminUserFilters(rawFilters);
  const search = filters.search.trim();

  if (!search) {
    const directory = await loadAdminUserDirectory();
    return {
      directory,
      filteredRows: applyAdminUserFilters(directory, filters),
    };
  }

  const matchedUsers = await storage.searchUsers(search);
  const matchedIds = matchedUsers.map((user) => user.id);
  if (matchedIds.length === 0) {
    return {
      directory: [] as AdminUserDirectoryRow[],
      filteredRows: [] as AdminUserDirectoryRow[],
    };
  }

  const directory = await loadAdminUserDirectory(matchedIds);
  return {
    directory,
    filteredRows: applyAdminUserFilters(directory, { ...filters, search: "" }),
  };
};

const resolveAdminEmailAudience = (rows: AdminUserDirectoryRow[], request: AdminAudienceRequest) => {
  const audience = request.audience || "all_active";
  const filteredRows = applyAdminUserFilters(rows, request);
  const selectedIds = new Set((request.selectedUserIds || []).map((id) => id.trim()).filter(Boolean));

  switch (audience) {
    case "selected_users":
      return rows.filter((row) => selectedIds.has(row.id));
    case "recently_joined":
      return applyAdminUserFilters(rows, { ...request, joinedPreset: "last30", accountStatus: "active" });
    case "free_users":
      return rows.filter((row) => isAdminUserActive(row) && row.membershipTier === "free");
    case "rsf_pro":
      return rows.filter((row) => isAdminUserActive(row) && resolveEffectiveMembershipTier(row) === "pro");
    case "rsf_pro_plus":
      return rows.filter((row) => isAdminUserActive(row) && resolveEffectiveMembershipTier(row) === "pro_plus");
    case "without_subscription":
      return rows.filter((row) => isAdminUserActive(row) && !hasPaidOrGrantedAccess(row));
    case "filtered_results":
      return filteredRows;
    case "all_active":
    default:
      return rows.filter((row) => isAdminUserActive(row));
  }
};

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

type AirportFrequencyMeta = {
  airportIdent: string;
  type: string | null;
  description: string | null;
  frequencyMhz: number | null;
};

type AirportSurfaceGeometryFeature = {
  type: "Feature";
  geometry:
    | { type: "LineString"; coordinates: [number, number][] }
    | { type: "Polygon"; coordinates: [number, number][][] };
  properties: {
    aeroway: string;
    name: string | null;
    ref: string | null;
    surface: string | null;
  };
};

type NearbyAirportResult = AirportSearchResult & {
  distanceNm: number;
  bearingDeg: number;
  maxRunwayFt: number | null;
  surfaces: string[];
  towered: boolean;
  score: number;
  scoreReasons: string[];
  immediateReady: boolean;
  immediateReasons: string[];
  flightCategory: string | null;
  runwayAdvisory: {
    runway: string;
    headwindKt: number | null;
    crosswindKt: number | null;
  } | null;
  frequencySummary: Array<{
    type: string | null;
    description: string | null;
    frequencyMhz: number | null;
  }>;
};

function toNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function buildEffectiveValues(profile: any | null, baseType: any | null) {
  const baseCruise = toNumber(baseType?.cruiseKtas);
  const baseBurn = toNumber(baseType?.fuelBurnGph);
  const economyBurn = toNumber(baseType?.fuelBurnEconomyGph);
  const performanceBurn = toNumber(baseType?.fuelBurnPerformanceGph);
  const baseFuel = toNumber(baseType?.usableFuelGal);
  const baseWeight = toNumber(baseType?.maxGrossWeightLb);
  const overrideCruise = toNumber(profile?.cruiseKtasOverride);
  const overrideBurn = toNumber(profile?.fuelBurnOverrideGph);
  const overrideFuel = toNumber(profile?.usableFuelOverrideGal);
  const overrideWeight = toNumber(profile?.maxGrossWeightOverrideLb);
  const cruise = overrideCruise ?? baseCruise;
  const burn = overrideBurn ?? baseBurn;
  const fuel = overrideFuel ?? baseFuel;
  const estimatedStillAirRangeNm =
    cruise && burn && fuel && burn > 0
      ? Number(((fuel / burn) * cruise).toFixed(1))
      : null;

  return {
    cruise_ktas_effective: cruise,
    fuel_burn_gph_effective: burn,
    fuel_burn_economy_gph_effective: economyBurn,
    fuel_burn_performance_gph_effective: performanceBurn,
    usable_fuel_gal_effective: fuel,
    max_gross_weight_lb_effective: overrideWeight ?? baseWeight,
    estimated_still_air_range_nm_effective: estimatedStillAirRangeNm,
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
let stationCachePromise: Promise<AirportSearchResult[]> | null = null;
const AIRPORTS_CACHE_URL = "https://ourairports.com/data/airports.csv";
const AIRPORTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let airportTimezoneCache: { data: Map<string, string>; expiresAt: number } | null = null;
let airportTimezoneCachePromise: Promise<Map<string, string>> | null = null;
let airportReferenceCache: { data: Map<string, AirportReference>; expiresAt: number } | null = null;
let airportReferenceCachePromise: Promise<Map<string, AirportReference>> | null = null;
const RUNWAY_CACHE_URL = "https://ourairports.com/data/runways.csv";
const RUNWAY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let runwayCache: { data: Map<string, RunwayMeta[]>; expiresAt: number } | null = null;
let runwayCachePromise: Promise<Map<string, RunwayMeta[]>> | null = null;
const AIRPORT_FREQUENCIES_CACHE_URL = "https://ourairports.com/data/airport-frequencies.csv";
const AIRPORT_FREQUENCIES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let airportFrequencyCache: { data: Map<string, AirportFrequencyMeta[]>; expiresAt: number } | null = null;
let airportFrequencyCachePromise: Promise<Map<string, AirportFrequencyMeta[]>> | null = null;
const AIRPORT_SURFACE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const airportSurfaceGeometryCache = new Map<string, { data: any; expiresAt: number }>();
const airportSurfaceGeometryInFlight = new Map<string, Promise<any>>();
const NEARBY_AIRPORT_CACHE_TTL_MS = 45 * 1000;
const NEARBY_AIRPORT_CACHE_MAX = 200;
const nearbyAirportCache = new Map<string, { data: any; expiresAt: number }>();
const nearbyAirportInFlight = new Map<string, Promise<any>>();
const AIRPORT_SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const AIRPORT_SEARCH_CACHE_MAX = 500;
const airportSearchCache = new Map<string, { data: AirportSearchResult[]; expiresAt: number }>();
const airportSearchInFlight = new Map<string, Promise<AirportSearchResult[]>>();
const REDIS_CACHE_PREFIX = "rsf:v1";
const ROUTE_SUGGESTION_CACHE_TTL_MS = 15 * 60 * 1000;
const ROUTE_SUGGESTION_CACHE_MAX = 250;
const routeSuggestionCache = new Map<string, { data: any; expiresAt: number }>();
const routeSuggestionInFlight = new Map<string, Promise<any>>();
const RUNWAY_BRIEFING_CACHE_TTL_MS = 2 * 60 * 1000;
const runwayBriefingCache = new Map<string, { data: any; expiresAt: number }>();
const runwayBriefingInFlight = new Map<string, Promise<any>>();
const plateMetadataInFlight = new Map<string, Promise<PlateMeta[]>>();
let operationalCachePrewarmPromise: Promise<{ ok: string[]; failed: string[] }> | null = null;
const NOTAM_CACHE_TTL_MS = 2 * 60 * 1000;
const notamCache = new Map<string, { data: any; expiresAt: number }>();
const TFR_CACHE_TTL_MS = 60 * 60 * 1000;
const TFR_EMPTY_CACHE_TTL_MS = 5 * 60 * 1000;
const tfrCache = new Map<string, { data: any; expiresAt: number }>();
const TFR_STALE_MAX_AGE_MINUTES = Number(process.env.TFR_STALE_MAX_AGE_MINUTES || 12 * 60);
const TFR_STALE_MAX_AGE_MS = Math.max(30, TFR_STALE_MAX_AGE_MINUTES) * 60 * 1000;
let tfrLastSuccess: { data: any; fetchedAt: number } | null = null;
let tfrPayloadBuildPromise: Promise<{ payload: any; staleHint: boolean }> | null = null;
const boundedEnvNumber = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};
const SUA_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const suaCache = new Map<string, { data: any; expiresAt: number }>();
const TFR_ARCGIS_PROXY_URL = (process.env.TFR_ARCGIS_PROXY_URL || "").trim();
const TFR_ARCGIS_URLS_ENV = (process.env.TFR_ARCGIS_URLS || "").trim();
const TFR_ARCGIS_URLS = TFR_ARCGIS_URLS_ENV
  ? TFR_ARCGIS_URLS_ENV.split(",").map((entry) => entry.trim()).filter(Boolean)
  : [];
const TFR_WFS_ENABLED = String(process.env.TFR_WFS_ENABLED || "true").toLowerCase() === "true";
const TFR_WFS_URL = (process.env.TFR_WFS_URL || "https://sua.faa.gov/geoserver/wfs").trim();
const TFR_WFS_TIMEOUT_MS = boundedEnvNumber(process.env.TFR_WFS_TIMEOUT_MS, 3000, 1000, 10000);
const TFR_WFS_ACCESS_DENIED_COOLDOWN_MS = boundedEnvNumber(
  process.env.TFR_WFS_ACCESS_DENIED_COOLDOWN_MS,
  15 * 60 * 1000,
  60 * 1000,
  60 * 60 * 1000,
);
let tfrWfsAccessDeniedUntil = 0;
const TFR_ARCGIS_TIMEOUT_MS = boundedEnvNumber(process.env.TFR_ARCGIS_TIMEOUT_MS, 3500, 1000, 10000);
const TFR_ARCGIS_MAX_ATTEMPTS = boundedEnvNumber(
  process.env.TFR_ARCGIS_MAX_ATTEMPTS,
  TFR_ARCGIS_PROXY_URL ? 4 : 6,
  1,
  20,
);
const FAA_WMS_URL = (process.env.FAA_WMS_URL || "https://sua.faa.gov/geoserver/wms").trim();
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
].filter((value, index, arr) => value && arr.indexOf(value) === index);
const FAA_WMS_ALLOWED_LAYERS = new Set([
  "SUA:us_sectionals",
  "SUA:ifr_enroute_low",
  "SUA:ifr_enroute_high",
]);
let swimTokenCache: { token: string; expiresAt: number } | null = null;
const COASTAL_STATE_CODES = new Set([
  "AK", "AL", "CA", "CT", "DE", "FL", "GA", "HI", "LA", "MA", "MD", "ME", "MI",
  "MN", "MS", "NC", "NH", "NJ", "NY", "OH", "OR", "PA", "RI", "SC", "TX", "VA",
  "WA", "WI",
]);

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

function findBestRouteAssistStation(
  stations: AirportSearchResult[],
  departure: AirportSearchResult,
  destination: AirportSearchResult,
  target: { lat: number; lon: number },
  targetDistanceNm: number,
  exclude: Set<string>,
  maxRadiusNm: number,
  preferredLegNm?: number | null
) {
  const directRouteNm = distanceNmBetween(departure.lat, departure.lon, destination.lat, destination.lon);
  let best: { station: AirportSearchResult; score: number } | null = null;
  for (const station of stations) {
    if (!station?.icao) continue;
    if (exclude.has(station.icao)) continue;
    if (!Number.isFinite(station.lat) || !Number.isFinite(station.lon)) continue;
    const targetOffsetNm = distanceNmBetween(target.lat, target.lon, station.lat, station.lon);
    if (targetOffsetNm > maxRadiusNm) continue;

    const departureToStationNm = distanceNmBetween(departure.lat, departure.lon, station.lat, station.lon);
    const stationToDestinationNm = distanceNmBetween(station.lat, station.lon, destination.lat, destination.lon);
    const detourNm = Math.max(0, departureToStationNm + stationToDestinationNm - directRouteNm);
    const alongTrackNm = directRouteNm > 0
      ? (departureToStationNm ** 2 + directRouteNm ** 2 - stationToDestinationNm ** 2) / (2 * directRouteNm)
      : 0;
    const normalizedAlongTrackNm = Number.isFinite(alongTrackNm) ? alongTrackNm : 0;
    const crossTrackNm = Math.sqrt(Math.max(0, departureToStationNm ** 2 - normalizedAlongTrackNm ** 2));
    const legBiasNm =
      preferredLegNm && preferredLegNm > 0
        ? Math.abs(departureToStationNm - preferredLegNm)
        : 0;

    if (normalizedAlongTrackNm < -25 || normalizedAlongTrackNm > directRouteNm + 25) continue;

    const score =
      targetOffsetNm +
      detourNm * 2 +
      crossTrackNm * 1.75 +
      Math.abs(normalizedAlongTrackNm - targetDistanceNm) * 1.25 +
      legBiasNm * 0.9;

    if (!best || score < best.score) {
      best = { station, score };
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
        if (attempts.length >= TFR_ARCGIS_MAX_ATTEMPTS) {
          return { data: null, error: `${lastError} (${lastUrl})`, attempts };
        }
        const url = `${baseUrl}?${params.toString()}`;
        lastUrl = url;
        try {
          const response = await fetchWithTimeout(
            url,
            {
              headers: variant.headers,
            },
            TFR_ARCGIS_TIMEOUT_MS
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
  if (tfrWfsAccessDeniedUntil > Date.now()) {
    return {
      data: null,
      error: `WFS access denied cooldown active until ${new Date(tfrWfsAccessDeniedUntil).toISOString()}`,
      attempts: [] as Array<{ url: string; ok: boolean; status?: number; error?: string }>,
    };
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
      TFR_WFS_TIMEOUT_MS
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      const snippet = errorText.trim().slice(0, 200);
      const message = `HTTP ${response.status}${snippet ? `: ${snippet}` : ""}`;
      if (response.status === 403 || /access denied/i.test(message)) {
        tfrWfsAccessDeniedUntil = Date.now() + TFR_WFS_ACCESS_DENIED_COOLDOWN_MS;
      }
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

function airportFrequencyPriority(type?: string | null) {
  const upper = String(type || "").trim().toUpperCase();
  if (upper.includes("TOWER")) return 0;
  if (upper.includes("CTAF")) return 1;
  if (upper.includes("UNICOM")) return 2;
  if (upper.includes("APPROACH")) return 3;
  if (upper.includes("DEPARTURE")) return 4;
  if (upper.includes("GROUND")) return 5;
  if (upper.includes("ATIS")) return 6;
  if (upper.includes("AWOS")) return 7;
  if (upper.includes("ASOS")) return 8;
  return 20;
}

function isToweredFrequencyType(type?: string | null, description?: string | null) {
  const upper = `${type || ""} ${description || ""}`.toUpperCase();
  return upper.includes("TOWER") || upper.includes("GND") || upper.includes("GROUND");
}

async function loadStationCache(): Promise<AirportSearchResult[]> {
  const now = Date.now();
  if (stationCache && stationCache.expiresAt > now) return stationCache.data;
  if (stationCachePromise) return stationCachePromise;

  stationCachePromise = (async () => {
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

    stationCache = { data: mapped, expiresAt: Date.now() + STATION_CACHE_TTL_MS };
    return mapped;
  })();

  try {
    return await stationCachePromise;
  } finally {
    stationCachePromise = null;
  }
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
  if (airportTimezoneCachePromise) return airportTimezoneCachePromise;

  airportTimezoneCachePromise = (async () => {
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
      airportTimezoneCache = { data: map, expiresAt: Date.now() + AIRPORTS_CACHE_TTL_MS };
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

    airportTimezoneCache = { data: map, expiresAt: Date.now() + AIRPORTS_CACHE_TTL_MS };
    return map;
  })();

  try {
    return await airportTimezoneCachePromise;
  } finally {
    airportTimezoneCachePromise = null;
  }
}

async function loadAirportReferenceCache(): Promise<Map<string, AirportReference>> {
  const now = Date.now();
  if (airportReferenceCache && airportReferenceCache.expiresAt > now) {
    return airportReferenceCache.data;
  }
  if (airportReferenceCachePromise) return airportReferenceCachePromise;

  airportReferenceCachePromise = (async () => {
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
      airportReferenceCache = { data: map, expiresAt: Date.now() + AIRPORTS_CACHE_TTL_MS };
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

    airportReferenceCache = { data: map, expiresAt: Date.now() + AIRPORTS_CACHE_TTL_MS };
    return map;
  })();

  try {
    return await airportReferenceCachePromise;
  } finally {
    airportReferenceCachePromise = null;
  }
}

function getAirportReferenceByIcao(referenceMap: Map<string, AirportReference>, icao: string) {
  const candidates = buildIcaoCandidates(icao);
  for (const candidate of candidates) {
    const match = referenceMap.get(candidate);
    if (match) return match;
  }
  return null;
}

function computeAirportSurfaceBounds(
  airport: { lat: number; lon: number },
  radiusNm = 1.6,
) {
  const latDelta = radiusNm / 60;
  const lonDelta = radiusNm / (60 * Math.max(0.2, Math.cos((airport.lat * Math.PI) / 180)));
  return {
    minLat: airport.lat - latDelta,
    maxLat: airport.lat + latDelta,
    minLon: airport.lon - lonDelta,
    maxLon: airport.lon + lonDelta,
  };
}

function buildAirportSurfaceFeatureCollection(elements: any[]): AirportSurfaceGeometryFeature[] {
  const nodeMap = new Map<number, { lat: number; lon: number }>();
  const features: AirportSurfaceGeometryFeature[] = [];

  elements.forEach((element) => {
    if (element?.type === "node" && Number.isFinite(element.id) && Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
      nodeMap.set(element.id, { lat: element.lat, lon: element.lon });
    }
  });

  elements.forEach((element) => {
    if (element?.type !== "way" || !Array.isArray(element.nodes) || !element.nodes.length) return;
    const aeroway = typeof element.tags?.aeroway === "string" ? element.tags.aeroway : "";
    if (!aeroway) return;

    const coordinates = element.nodes
      .map((nodeId: number) => {
        const node = nodeMap.get(nodeId);
        return node ? ([node.lon, node.lat] as [number, number]) : null;
      })
      .filter(Boolean) as [number, number][];

    if (coordinates.length < 2) return;

    const isClosed =
      coordinates.length >= 4 &&
      coordinates[0][0] === coordinates[coordinates.length - 1][0] &&
      coordinates[0][1] === coordinates[coordinates.length - 1][1];
    const polygonAeroways = new Set(["apron", "runway", "helipad", "terminal"]);
    const treatAsPolygon = isClosed && (polygonAeroways.has(aeroway) || element.tags?.area === "yes");

    features.push({
      type: "Feature",
      geometry: treatAsPolygon
        ? { type: "Polygon", coordinates: [coordinates] }
        : { type: "LineString", coordinates },
      properties: {
        aeroway,
        name: typeof element.tags?.name === "string" ? element.tags.name : null,
        ref: typeof element.tags?.ref === "string" ? element.tags.ref : null,
        surface: typeof element.tags?.surface === "string" ? element.tags.surface : null,
      },
    });
  });

  return features;
}

async function fetchAirportSurfaceGeometry(airport: AirportReference) {
  const cacheKey = airport.icao.toUpperCase();
  const now = Date.now();
  const cached = airportSurfaceGeometryCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const inFlight = airportSurfaceGeometryInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const buildPromise = (async () => {
    const radiusMeters = 2600;
    const query = `
[out:json][timeout:25];
(
  way["aeroway"~"runway|taxiway|apron|taxilane|holding_position|helipad|terminal"](around:${radiusMeters},${airport.lat},${airport.lon});
);
(._;>;);
out body;
`.trim();

    const response = await fetchWithTimeout(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
          "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)",
        },
        body: query,
      },
      12000,
    );

    if (!response.ok) {
      throw new Error(`Airport surface fetch failed: ${response.status}`);
    }

    const payload = await response.json().catch(() => null);
    const features = buildAirportSurfaceFeatureCollection(Array.isArray(payload?.elements) ? payload.elements : []);
    const data = {
      icao: cacheKey,
      source: "osm-overpass",
      fetchedAt: new Date().toISOString(),
      bounds: computeAirportSurfaceBounds(airport),
      features,
    };
    airportSurfaceGeometryCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + AIRPORT_SURFACE_CACHE_TTL_MS,
    });
    return data;
  })();

  airportSurfaceGeometryInFlight.set(cacheKey, buildPromise);
  try {
    return await buildPromise;
  } finally {
    airportSurfaceGeometryInFlight.delete(cacheKey);
  }
}

async function loadRunwayCache(): Promise<Map<string, RunwayMeta[]>> {
  const now = Date.now();
  if (runwayCache && runwayCache.expiresAt > now) return runwayCache.data;
  if (runwayCachePromise) return runwayCachePromise;

  runwayCachePromise = (async () => {
    const response = await fetch(RUNWAY_CACHE_URL, {
      headers: { "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)" },
    });
    if (!response.ok) {
      throw new Error(`Failed to load runways data: ${response.status}`);
    }

    const csvText = await response.text();
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      const empty = new Map<string, RunwayMeta[]>();
      runwayCache = { data: empty, expiresAt: Date.now() + RUNWAY_CACHE_TTL_MS };
      return empty;
    }

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

    runwayCache = { data: dataMap, expiresAt: Date.now() + RUNWAY_CACHE_TTL_MS };
    return dataMap;
  })();

  try {
    return await runwayCachePromise;
  } finally {
    runwayCachePromise = null;
  }
}

async function loadAirportFrequencyCache(): Promise<Map<string, AirportFrequencyMeta[]>> {
  const now = Date.now();
  if (airportFrequencyCache && airportFrequencyCache.expiresAt > now) return airportFrequencyCache.data;
  if (airportFrequencyCachePromise) return airportFrequencyCachePromise;

  airportFrequencyCachePromise = (async () => {
    const response = await fetch(AIRPORT_FREQUENCIES_CACHE_URL, {
      headers: { "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)" },
    });
    if (!response.ok) {
      throw new Error(`Failed to load airport frequencies data: ${response.status}`);
    }

    const csvText = await response.text();
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const map = new Map<string, AirportFrequencyMeta[]>();
    if (lines.length === 0) {
      airportFrequencyCache = { data: map, expiresAt: Date.now() + AIRPORT_FREQUENCIES_CACHE_TTL_MS };
      return map;
    }

    const header = parseCsvLine(lines[0]);
    const idx = (name: string) => header.indexOf(name);
    const airportIdentIdx = idx("airport_ident");
    const typeIdx = idx("type");
    const descriptionIdx = idx("description");
    const frequencyIdx = idx("frequency_mhz");

    for (let i = 1; i < lines.length; i += 1) {
      const row = parseCsvLine(lines[i]);
      const airportIdent = row[airportIdentIdx]?.trim().toUpperCase();
      if (!airportIdent) continue;

      const item: AirportFrequencyMeta = {
        airportIdent,
        type: row[typeIdx]?.trim() || null,
        description: row[descriptionIdx]?.trim() || null,
        frequencyMhz: row[frequencyIdx] ? Number(row[frequencyIdx]) : null,
      };

      if (!map.has(airportIdent)) {
        map.set(airportIdent, []);
      }
      map.get(airportIdent)!.push(item);
    }

    airportFrequencyCache = { data: map, expiresAt: Date.now() + AIRPORT_FREQUENCIES_CACHE_TTL_MS };
    return map;
  })();

  try {
    return await airportFrequencyCachePromise;
  } finally {
    airportFrequencyCachePromise = null;
  }
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
  const shared = await getSharedCacheJson<PlateMeta[]>(buildRedisCacheKey("plates-meta", normalizedIcao));
  if (shared) {
    setCachedPlates(icao, shared);
    return shared;
  }
  const inFlight = plateMetadataInFlight.get(normalizedIcao);
  if (inFlight) return inFlight;

  const promise = (async () => {
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
    await setSharedCacheJson(buildRedisCacheKey("plates-meta", normalizedIcao), plates, PLATE_CACHE_TTL_MS / 1000);
    return plates;
  })();

  plateMetadataInFlight.set(normalizedIcao, promise);
  try {
    return await promise;
  } finally {
    plateMetadataInFlight.delete(normalizedIcao);
  }
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

const crmLeadImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const lower = file.originalname.toLowerCase();
    const isCsv = file.mimetype === "text/csv" || lower.endsWith(".csv");
    const isXlsx =
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      lower.endsWith(".xlsx");

    if (isCsv || isXlsx) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV and XLSX files are allowed for CRM lead imports"));
    }
  },
});

const logbookImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const lower = file.originalname.toLowerCase();
    const isCsv = file.mimetype === "text/csv" || lower.endsWith(".csv");
    const isXlsx =
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      lower.endsWith(".xlsx");

    if (isCsv || isXlsx) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV and XLSX files are allowed for logbook imports"));
    }
  },
});

// IP-based rate limiting middleware
interface RateLimitOptions {
  windowMs: number;
  max: number;
  dailyMax?: number;
  message?: string;
  key?: string;
}

function createIpRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, dailyMax, message = "Too many requests, please try again later", key } = options;
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
    const routeKey = key || req.route?.path || req.path || "unknown";
    const bucketKey = `${routeKey}:${ip}`;
    
    if (!requests.has(bucketKey)) {
      requests.set(bucketKey, []);
    }
    
    const timestamps = requests.get(bucketKey)!;
    
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
    requests.set(bucketKey, dailyTimestamps);
    
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

const airportSearchPublicReadRateLimiter = createIpRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AIRPORT_PUBLIC_READ_MAX || 900),
  dailyMax: Number(process.env.RATE_LIMIT_AIRPORT_PUBLIC_READ_DAILY_MAX || 20000),
  message: "Airport requests are briefly saturated. Please try again shortly.",
  key: "airport_search_public_read",
});

const nearbyAirportReadRateLimiter = createIpRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AIRPORT_NEARBY_PUBLIC_READ_MAX || process.env.RATE_LIMIT_AIRPORT_PUBLIC_READ_MAX || 900),
  dailyMax: Number(process.env.RATE_LIMIT_AIRPORT_PUBLIC_READ_DAILY_MAX || 20000),
  message: "Nearby-airport requests are briefly saturated. Please try again shortly.",
  key: "airport_nearby_public_read",
});

const routeSuggestionReadRateLimiter = createIpRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_ROUTE_SUGGESTION_PUBLIC_READ_MAX || process.env.RATE_LIMIT_AIRPORT_PUBLIC_READ_MAX || 900),
  dailyMax: Number(process.env.RATE_LIMIT_AIRPORT_PUBLIC_READ_DAILY_MAX || 20000),
  message: "Route-planning requests are briefly saturated. Please try again shortly.",
  key: "route_suggestion_public_read",
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
  anonMax: Number(process.env.RATE_LIMIT_AIRPORT_SEARCH_ANON_MAX || 1200),
  authMax: Number(process.env.RATE_LIMIT_AIRPORT_SEARCH_AUTH_MAX || 4000),
  key: "airport_search",
});

const analyticsRateLimiter = createSoftAuthRateLimiter({
  windowMs: 5 * 60 * 1000,
  anonMax: 30,
  authMax: 100,
  key: 'analytics',
});

const bannerImpressionRateLimiter = createSoftAuthRateLimiter({
  windowMs: 60 * 60 * 1000,
  anonMax: 10,
  authMax: 30,
  key: 'banner-impression',
});

const registrationRateLimiter = createSoftAuthRateLimiter({
  windowMs: 60 * 60 * 1000,
  anonMax: 5,
  authMax: 5,
  key: 'registration',
});

const flightFilingRateLimiter = createSoftAuthRateLimiter({
  windowMs: 10 * 60 * 1000,
  anonMax: 5,
  authMax: 60,
  key: 'flight_filing_provider',
});

const flightPlanUtilityRateLimiter = createSoftAuthRateLimiter({
  windowMs: 60 * 1000,
  anonMax: 30,
  authMax: 120,
  key: 'flight_plan_utility',
});

// Verification middleware - checks if user is verified
// CRITICAL: For rental-related endpoints (aircraft listings, rental bookings),
// verification is ALWAYS enforced for safety and security, regardless of any flags
const isVerified = async (req: any, res: any, next: any) => {
  try {
    const userId = getRequestUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
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
  // CORS is also applied at app boot. Keep this aligned for routes registered later in startup.
  app.use(cors(buildCorsOptions()));

  // Auth middleware
  await setupAuth(app);

  // Unified authentication routes (for both web and mobile)
  app.use('/api/auth', registerUnifiedAuthRoutes(storage));

  // Mobile app authentication routes (JWT-based for React Native) - DEPRECATED, use /api/auth instead
  app.use('/api/mobile/auth', registerMobileAuthRoutes(storage));

  registerAdminFinanceRoutes(app);
  registerTipsRoutes(app);
  registerScheduleRoutes(app);
  registerOpsReportRoutes(app);
  registerDosReportingRoutes(app);
  registerIncidentReportRoutes(app);
  registerCourtyardBudgetRoutes(app);
  registerComptrollerRoutes(app);
  registerVehicleListingRoutes(app);
  app.use("/api/fuel-prices", fuelPricesRouter);
  app.use("/api/ai-tools", aiToolsRouter);

  // Serve uploaded files
  app.use('/uploads', express.static('uploads', { dotfiles: 'deny' }));

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
      const requesterId = getRequestUserId(req);
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
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
        owner: requesterId,
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

      const requesterId = getRequestUserId(req);
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
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
            owner: requesterId,
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

  app.post('/api/aircraft/verification-docs/upload', isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = getRequestUserId(req);
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const fieldName = typeof req.body?.fieldName === "string" ? req.body.fieldName.trim() : "";
      if (!AIRCRAFT_VERIFICATION_DOC_FIELDS.has(fieldName)) {
        return res.status(400).json({ error: "Invalid verification document field" });
      }

      const contentType =
        typeof req.body?.contentType === "string" && req.body.contentType.trim()
          ? req.body.contentType.trim()
          : "application/octet-stream";

      if (process.env.AWS_S3_BUCKET) {
        const { S3StorageService } = await import('./s3Storage.js');
        const s3Service = new S3StorageService();
        const { uploadURL, key } = await s3Service.getPresignedUploadUrlForKey({
          prefix: buildAircraftVerificationDocPrefix(requesterId, fieldName),
          contentType,
        });
        return res.json({ uploadURL, storagePath: key });
      }

      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const storagePath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      return res.json({ uploadURL, storagePath });
    } catch (error) {
      console.error("Failed to prepare aircraft verification document upload:", error);
      return res.status(500).json({ error: "Failed to prepare upload" });
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

      const userEmail = String(user.email || "").trim();
      if (userEmail) {
        const canonicalUser = await storage.getUserByEmail(userEmail);
        if (canonicalUser && canonicalUser.id !== user.id) {
          logDebug("[AUTH /api/auth/user] Session user differed from canonical email user; switching session to:", canonicalUser.id);
          if (req.session) {
            req.session.userId = canonicalUser.id;
            req.session.save?.(() => undefined);
          }
          req.user = {
            claims: {
              sub: canonicalUser.id,
              email: canonicalUser.email ?? null,
              first_name: canonicalUser.firstName ?? null,
              last_name: canonicalUser.lastName ?? null,
              profile_image_url: canonicalUser.profileImageUrl ?? null,
            },
            isAdmin: Boolean(canonicalUser.isAdmin),
            isSuperAdmin: Boolean(canonicalUser.isSuperAdmin),
          };
          user = canonicalUser;
        }
      }

      // Backfill email from auth claims for legacy users that may have a null email in DB.
      const claimsEmail = String(req.user?.claims?.email || "").trim().toLowerCase();
      if (user && !user.email && claimsEmail) {
        await storage.updateUser(user.id, { email: claimsEmail });
        user = await storage.getUser(user.id);
      }
      if (!user) {
        return res.status(404).json({ message: "User not found" });
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
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const entitlements = getEntitlementsForUser(user);
      const {
        hashedPassword: _hashedPassword,
        passwordCreatedAt: _passwordCreatedAt,
        emailVerificationToken: _emailVerificationToken,
        emailVerificationExpires: _emailVerificationExpires,
        ...userResponse
      } = user as any;
      res.json({ ...userResponse, hasPassword: Boolean(user.hashedPassword), entitlements });
    } catch (error: any) {
      // Postgres error 42703 = "undefined_column" — column exists in schema but not in DB.
      // This means a migration hasn't been applied yet. Log a clear message.
      const pgCode = error?.code || error?.cause?.code || "";
      if (pgCode === "42703") {
        console.error(
          "[SCHEMA MISMATCH] /api/auth/user failed because a column referenced in the Drizzle schema does not exist in the live database.\n" +
          "Run:  psql \"$DATABASE_URL\" -f migrations/0068_add_user_home_base_and_filing_zzzz_fields.sql\n" +
          "Column detail:", error?.message || error,
        );
        return res.status(503).json({ message: "Database schema migration required — contact the site administrator." });
      }
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
      const frontendBase = getFrontendBaseUrl(req);
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

      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
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

  const createMembershipSubscription = async (userId: string, tier: "premium" | "pro" | "pro_plus", interval: "monthly" | "biannual" | "annual") => {
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
      const tier = req.body?.tier === "premium" ? "premium" : req.body?.tier === "pro_plus" ? "pro_plus" : req.body?.tier === "pro" ? "pro" : null;
      const interval = parseBillingInterval(req.body?.interval);
      if (!tier || !interval) {
        return res.status(400).json({ error: "Invalid membership tier or interval" });
      }
      const { subscription, approveUrl } = await createMembershipSubscription(requesterId, tier, interval);
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
      const { subscription, approveUrl } = await createMembershipSubscription(userId, "premium", "monthly");
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

  // RevenueCat - Webhook (app store / play store membership sync)
  app.post("/api/revenuecat/webhook", async (req, res) => {
    try {
      const configuredAuth = (process.env.REVENUECAT_WEBHOOK_AUTH || "").trim();
      if (configuredAuth) {
        const headerValue =
          req.header("authorization") ||
          req.header("Authorization") ||
          req.header("x-revenuecat-authorization") ||
          "";
        if (headerValue.trim() !== configuredAuth) {
          return res.status(401).json({ error: "Invalid RevenueCat webhook authorization" });
        }
      }

      const result = revenueCatWebhookSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid RevenueCat webhook payload" });
      }

      const event = result.data.event;
      if (event.type === "TEST") {
        return res.json({ received: true, test: true });
      }

      const candidateIds = Array.from(
        new Set(
          [
            event.app_user_id,
            event.original_app_user_id,
            ...(event.aliases || []),
          ]
            .map((value) => value?.trim())
            .filter((value): value is string => !!value)
        )
      );

      let user = null;
      for (const candidate of candidateIds) {
        user = await storage.getUser(candidate);
        if (!user && candidate.includes("@")) {
          user = await storage.getUserByEmail(candidate);
        }
        if (user) break;
      }

      if (!user) {
        console.warn("RevenueCat webhook: user not found", {
          appUserId: event.app_user_id,
          originalAppUserId: event.original_app_user_id,
          aliases: event.aliases,
          type: event.type,
        });
        return res.json({ received: true, ignored: "user_not_found" });
      }

      const membershipPlan = resolveMembershipFromStoreSignals({
        productIds: event.product_id ? [event.product_id] : [],
        entitlementIds: [
          ...(event.entitlement_ids || []),
          ...(event.entitlement_id ? [event.entitlement_id] : []),
        ],
      });

      const provider = getRevenueCatProvider(event.store);
      const expiresAt = parseRevenueCatMs(event.expiration_at_ms);
      const purchasedAt = parseRevenueCatMs(event.purchased_at_ms) || parseRevenueCatMs(event.event_timestamp_ms);

      const activeTypes = new Set([
        "INITIAL_PURCHASE",
        "RENEWAL",
        "UNCANCELLATION",
        "PRODUCT_CHANGE",
        "SUBSCRIPTION_EXTENDED",
        "TEMPORARY_ENTITLEMENT_GRANT",
        "NON_RENEWING_PURCHASE",
      ]);

      const updates: Partial<typeof user> = {
        membershipProvider: provider,
      };

      if (membershipPlan) {
        updates.membershipTier = membershipPlan.tier;
        updates.membershipInterval = membershipPlan.interval;
        updates.logbookProPlan = membershipPlan.interval;
      }

      if (purchasedAt) {
        updates.logbookProStartedAt = purchasedAt;
      }

      if (expiresAt) {
        updates.membershipEndsAt = expiresAt;
        updates.membershipNextBillingAt = expiresAt;
        updates.logbookProEndsAt = expiresAt;
      }

      if (activeTypes.has(event.type)) {
        updates.membershipStatus = "active";
        updates.logbookProStatus = "active";
        updates.logbookProCanceledAt = null;
        updates.logbookProCancelAtPeriodEnd = false;
      } else if (event.type === "BILLING_ISSUE") {
        updates.membershipStatus = "past_due";
        updates.logbookProStatus = "payment_failed";
      } else if (event.type === "CANCELLATION") {
        updates.membershipStatus = "cancelled";
        updates.logbookProStatus = "cancelled";
        updates.logbookProCanceledAt = parseRevenueCatMs(event.event_timestamp_ms) || new Date();
      } else if (event.type === "EXPIRATION") {
        updates.membershipTier = "free";
        updates.membershipStatus = "inactive";
        updates.membershipEndsAt = expiresAt;
        updates.membershipNextBillingAt = null;
        updates.membershipInterval = null;
        updates.logbookProStatus = "inactive";
        updates.logbookProPlan = null;
        updates.logbookProEndsAt = expiresAt;
        updates.logbookProCanceledAt = parseRevenueCatMs(event.event_timestamp_ms) || new Date();
        updates.logbookProCancelAtPeriodEnd = false;
      } else {
        return res.json({ received: true, ignored: event.type });
      }

      await storage.updateUser(user.id, updates);
      return res.json({ received: true });
    } catch (error) {
      console.error("RevenueCat webhook error:", error);
      return res.status(500).json({ error: "Failed to process RevenueCat webhook" });
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
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
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
        const resolvedPromo = await resolveMarketplacePromoCode({
          code: promoCode,
          userId,
          category,
          amount: fullAmount,
        });

        if (!resolvedPromo.valid) {
          return res.status(400).json({ error: resolvedPromo.message });
        }

        let serverCalculatedDiscount = Math.min(resolvedPromo.discountAmount, fullAmount);
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
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
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
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
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
      let resolvedPromo: Extract<Awaited<ReturnType<typeof resolveMarketplacePromoCode>>, { valid: true }> | null = null;

      const promoToApply = (promoCode || promoCodeUsed || "").toString().trim();
      if (promoToApply) {
        const promoResolution = await resolveMarketplacePromoCode({
          code: promoToApply,
          userId,
          category,
          amount: fullAmount,
        });
        if (!promoResolution.valid) {
          return res.status(400).json({ error: promoResolution.message });
        }
        resolvedPromo = promoResolution;
        expectedAmount = Math.max(0, fullAmount - Math.min(promoResolution.discountAmount, fullAmount));
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
        expiresAt: new Date(Date.now() + (resolvedPromo?.durationDays ?? 30) * 24 * 60 * 60 * 1000),
        ...(resolvedPromo?.durationDays && resolvedPromo.durationDays > 30
          ? { promoFreeUntil: new Date(Date.now() + resolvedPromo.durationDays * 24 * 60 * 60 * 1000) }
          : {}),
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
        if (resolvedPromo?.promoCodeRecord) {
          try {
            await storage.recordPromoCodeUsage({
              promoCodeId: resolvedPromo.promoCodeRecord.id,
              userId,
              marketplaceListingId: listing.id,
            });
            logDebug(`Promo code ${resolvedPromo.code} usage recorded for marketplace listing ${listing.id}`);
          } catch (error) {
            console.error(`Failed to record promo code usage for ${resolvedPromo.code}:`, error);
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
      const requesterId = getRequestUserId(req);
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
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
        if (tokenData.promoCode) {
          const promoResolution = await resolveMarketplacePromoCode({
            code: tokenData.promoCode,
            userId: requesterId,
            category: listingData?.category,
            amount: originalAmount,
          });
          if (!promoResolution.valid) {
            console.error(`Promo code ${tokenData.promoCode} is no longer valid for marketplace listing`);
            return res.status(400).json({
              error: "Promo code is no longer valid",
              details: "Please refresh the page and try again"
            });
          }

          const validatedData = insertMarketplaceListingSchema.parse({
            ...listingData,
            userId: requesterId,
            monthlyFee: "0",
          });

          const listing = await storage.createMarketplaceListing({
            ...validatedData,
            isPaid: true,
            expiresAt: new Date(Date.now() + promoResolution.durationDays * 24 * 60 * 60 * 1000),
            ...(promoResolution.durationDays > 30
              ? { promoFreeUntil: new Date(Date.now() + promoResolution.durationDays * 24 * 60 * 60 * 1000) }
              : {}),
          });

          try {
            if (promoResolution.promoCodeRecord) {
              await storage.recordPromoCodeUsage({
                promoCodeId: promoResolution.promoCodeRecord.id,
                userId: requesterId,
                marketplaceListingId: listing.id,
              });
            }
            logDebug(`Promo code ${tokenData.promoCode} usage recorded for FREE marketplace listing ${listing.id}`);
          } catch (error) {
            console.error(`Failed to record promo code usage for ${tokenData.promoCode}:`, error);
          }

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

          logDebug(`FREE marketplace listing ${listing.id} completed with promo code ${tokenData.promoCode} by user ${requesterId}`);

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
        }
        return res.status(400).json({ error: "No promo code provided for free listing" });
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

  app.post("/api/investor/contact", contactFormRateLimiter, async (req, res) => {
    try {
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
          details: validationResult.error.errors,
        });
      }

      const data = validationResult.data;
      const ip = req.ip || req.connection.remoteAddress || "unknown";

      const submission = await storage.createContactSubmission({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        subject: `[Investor Deck] ${data.subject}`,
        message: data.message,
        ipAddress: ip,
      });

      sendContactFormEmail({
        ...data,
        subject: `[Investor Deck] ${data.subject}`,
        recipientEmail: "cory@readysetfly.us",
      })
        .then(async () => {
          await storage.updateContactSubmissionEmailStatus(submission.id, true);
        })
        .catch((error) => {
          console.error(`Failed to send investor deck email for submission ${submission.id}:`, error);
        });

      return res.json({ success: true });
    } catch (error) {
      console.error("Investor contact form error:", error);
      return res.status(500).json({ error: "Failed to process investor inquiry" });
    }
  });

  app.post("/api/noise-and-fury/investor-contact", contactFormRateLimiter, async (req, res) => {
    try {
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
          details: validationResult.error.errors,
        });
      }

      const data = validationResult.data;
      const ip = req.ip || req.connection.remoteAddress || "unknown";

      const submission = await storage.createContactSubmission({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        subject: `[Noise & Fury Investor] ${data.subject}`,
        message: data.message,
        ipAddress: ip,
      });

      sendContactFormEmail({
        ...data,
        subject: `[Noise & Fury Investor] ${data.subject}`,
        recipientEmail: "coryarmer@gmail.com",
        ccEmail: "ceo@marcmovies.com",
        brandName: "Noise & Fury",
        headerTitle: "Noise & Fury Investor Inquiry",
        headerSubtitle: "New investor message received",
        headerColor: "#3a2515",
        messageAccentColor: "#b89258",
        footerText: "Noise & Fury - Investor Relations",
      })
        .then(async () => {
          await storage.updateContactSubmissionEmailStatus(submission.id, true);
        })
        .catch((error) => {
          console.error(`Failed to send Noise & Fury investor email for submission ${submission.id}:`, error);
        });

      return res.json({ success: true });
    } catch (error) {
      console.error("Noise & Fury investor contact form error:", error);
      return res.status(500).json({ error: "Failed to process investor inquiry" });
    }
  });

  app.post("/api/coryarmer/contact", contactFormRateLimiter, async (req, res) => {
    try {
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
          details: validationResult.error.errors,
        });
      }

      const data = validationResult.data;
      const ip = req.ip || req.connection.remoteAddress || "unknown";

      const submission = await storage.createContactSubmission({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        subject: `[Cory Armer] ${data.subject}`,
        message: data.message,
        ipAddress: ip,
      });

      sendContactFormEmail({
        ...data,
        subject: `[Cory Armer] ${data.subject}`,
        recipientEmail: "coryarmer@gmail.com",
        brandName: "Cory Armer",
        headerTitle: "Cory Armer Professional Inquiry",
        headerSubtitle: "New message from readysetfly.us/coryarmer",
        headerColor: "#0D1520",
        messageAccentColor: "#00C2C7",
        footerText: "Cory Armer - Professional Contact",
      })
        .then(async () => {
          await storage.updateContactSubmissionEmailStatus(submission.id, true);
        })
        .catch((error) => {
          console.error(`Failed to send Cory Armer contact email for submission ${submission.id}:`, error);
        });

      return res.json({ success: true });
    } catch (error) {
      console.error("Cory Armer contact form error:", error);
      return res.status(500).json({ error: "Failed to process professional inquiry" });
    }
  });

  app.post("/api/investor/confidentiality-accept", contactFormRateLimiter, async (req: any, res) => {
    try {
      const acceptanceSchema = z.object({
        pagePath: z.string().min(1).max(200),
        termsVersion: z.string().min(1).max(50),
      });

      const validationResult = acceptanceSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid confidentiality acceptance payload",
          details: validationResult.error.errors,
        });
      }

      const requesterId = getRequestUserId(req);
      const forwardedFor = req.headers["x-forwarded-for"];
      const ip = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : typeof forwardedFor === "string" && forwardedFor.trim()
          ? forwardedFor.split(",")[0]?.trim()
          : req.ip || req.connection?.remoteAddress || "unknown";
      const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;

      const entry = await storage.createInvestorDeckAccessLog({
        userId: requesterId,
        ipAddress: ip,
        userAgent,
        pagePath: validationResult.data.pagePath,
        termsVersion: validationResult.data.termsVersion,
      });

      return res.json({ success: true, loggedAt: entry.createdAt });
    } catch (error) {
      console.error("Investor confidentiality acceptance error:", error);
      return res.status(500).json({ error: "Failed to record confidentiality acceptance" });
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

  const unsubscribeCrmLeadEmail = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    await storage.unsubscribeLeadsByEmail(normalizedEmail);
    crmLogger.info("crm_unsubscribe", {
      email: normalizedEmail,
      timestamp: new Date().toISOString(),
    });
  };

  app.post("/api/crm/unsubscribe", async (req, res) => {
    try {
      const email = typeof req.body?.email === "string" ? req.body.email : "";
      if (email.trim()) {
        await unsubscribeCrmLeadEmail(email);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("CRM unsubscribe error:", error);
      res.json({ success: true });
    }
  });

  app.get("/api/crm/unsubscribe", async (req, res) => {
    try {
      const email = typeof req.query?.email === "string" ? req.query.email : "";
      if (email.trim()) {
        await unsubscribeCrmLeadEmail(email);
      }

      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"><title>Unsubscribed</title></head>
          <body style="font-family: Arial, sans-serif; padding: 24px;">
            <h2>You are unsubscribed.</h2>
            <p>If that email address exists in our CRM, it will no longer receive CRM sales emails.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("CRM unsubscribe error:", error);
      res.status(200).send("You are unsubscribed.");
    }
  });

  app.get("/api/marketing/unsubscribe", async (req, res) => {
    try {
      const token = typeof req.query?.token === "string" ? req.query.token : "";
      if (!token) {
        return res.status(400).send("Missing unsubscribe token.");
      }

      const payload = verifyMarketingToken(token);
      if (!payload || typeof payload.action !== "string") {
        return res.status(400).send("Invalid or expired unsubscribe token.");
      }

      if (payload.action === "weekly_opt_out" && payload.userId) {
        const updated = await storage.updateUser(String(payload.userId), {
          weeklyEmailOptIn: false,
          weeklyEmailOptOutAt: new Date(),
        });

        if (!updated) {
          return res.status(404).send("User not found.");
        }

        return res.status(200).send(`
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"><title>Unsubscribed</title></head>
            <body style="font-family: Arial, sans-serif; padding: 24px;">
              <h2>You are unsubscribed.</h2>
              <p>You will no longer receive weekly Ready Set Fly emails.</p>
            </body>
          </html>
        `);
      }

      if (payload.action === "crm_sales_opt_out" && payload.leadId) {
        const lead = await storage.getLead(String(payload.leadId));
        if (lead?.email) {
          await unsubscribeCrmLeadEmail(lead.email);
        }

        return res.status(200).send(`
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"><title>Unsubscribed</title></head>
            <body style="font-family: Arial, sans-serif; padding: 24px;">
              <h2>You are unsubscribed.</h2>
              <p>You will no longer receive Ready Set Fly sales outreach for this lead.</p>
            </body>
          </html>
        `);
      }

      return res.status(400).send("Invalid or expired unsubscribe token.");
    } catch (error) {
      console.error("Unsubscribe error:", error);
      res.status(500).send("Unable to process unsubscribe request.");
    }
  });

  const buildWeeklyEngagementAudience = async (options?: {
    activeWindowDays?: number;
    cooldownDays?: number;
    templateOverride?: WeeklyDigestSegment;
  }) => {
    const activeWindowDays = Math.max(7, Math.min(Number(options?.activeWindowDays) || 30, 90));
    const cooldownDays = Math.max(0, Math.min(Number(options?.cooldownDays) || 7, 30));
    const templateOverride = options?.templateOverride;
    const weeklyCutoff = cooldownDays > 0
      ? new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000)
      : null;
    const activeCutoff = new Date(Date.now() - activeWindowDays * 24 * 60 * 60 * 1000);

    const activeAnalyticsRows = await db
      .select({ userId: analyticsEvents.userId })
      .from(analyticsEvents)
      .where(and(isNotNull(analyticsEvents.userId), gte(analyticsEvents.createdAt, activeCutoff)))
      .groupBy(analyticsEvents.userId);
    const recentUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(gte(users.createdAt, activeCutoff));
    const activeUserIds = Array.from(new Set([
      ...activeAnalyticsRows.map((row) => row.userId).filter((userId): userId is string => Boolean(userId)),
      ...recentUsers.map((row) => row.id),
    ]));

    const candidates = activeUserIds.length === 0
      ? []
      : await db
          .select()
          .from(users)
          .where(and(
            eq(users.weeklyEmailOptIn, true),
            eq(users.isSuspended, false),
            inArray(users.id, activeUserIds),
          ));

    const recentEvents = activeUserIds.length === 0
      ? []
      : await db
          .select({
            userId: analyticsEvents.userId,
            event: analyticsEvents.event,
            page: analyticsEvents.page,
            createdAt: analyticsEvents.createdAt,
          })
          .from(analyticsEvents)
          .where(and(
            isNotNull(analyticsEvents.userId),
            gte(analyticsEvents.createdAt, activeCutoff),
            inArray(analyticsEvents.userId, activeUserIds),
          ));

    const eventsByUserId = new Map<string, typeof recentEvents>();
    for (const event of recentEvents) {
      if (!event.userId) continue;
      const userEvents = eventsByUserId.get(event.userId) || [];
      userEvents.push(event);
      eventsByUserId.set(event.userId, userEvents);
    }

    const eligibleRecipients: Array<{
      user: typeof candidates[number];
      firstName: string;
      digestProfile: ReturnType<typeof buildWeeklyDigestProfile>;
    }> = [];
    const segmentBreakdown: Record<string, number> = {};
    let excludedRecentlySent = 0;

    for (const user of candidates) {
      if (!user.email) continue;
      if (weeklyCutoff && user.weeklyEmailLastSentAt && user.weeklyEmailLastSentAt > weeklyCutoff) {
        excludedRecentlySent += 1;
        continue;
      }

      const firstName = user.firstName || user.email.split("@")[0];
      const digestProfile = buildWeeklyDigestProfile({
        user,
        events: eventsByUserId.get(user.id) || [],
        segmentOverride: templateOverride,
      });

      eligibleRecipients.push({ user, firstName, digestProfile });
      segmentBreakdown[digestProfile.segment] = (segmentBreakdown[digestProfile.segment] || 0) + 1;
    }

    return {
      activeWindowDays,
      cooldownDays,
      totalCandidates: candidates.length,
      excludedRecentlySent,
      eligibleRecipients,
      segmentBreakdown,
      sampleRecipients: eligibleRecipients.slice(0, 12).map(({ user, digestProfile }) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        weeklyEmailLastSentAt: user.weeklyEmailLastSentAt,
        segment: digestProfile.segment,
        subject: digestProfile.subject,
        reasonLine: digestProfile.reasonLine,
      })),
    };
  };

  const sendWeeklyEngagementEmails = async (options?: {
    activeWindowDays?: number;
    cooldownDays?: number;
    templateOverride?: WeeklyDigestSegment;
  }) => {
    const audience = await buildWeeklyEngagementAudience(options);
    const { getWeeklyEngagementEmailHtml, getWeeklyEngagementEmailText } = await import("./email-templates");
    const { client, fromEmail } = await getUncachableResendClient();
    const errors: string[] = [];
    let emailsSent = 0;

    for (const { user, firstName, digestProfile } of audience.eligibleRecipients) {
      if (!user.email) continue;

      const token = signMarketingToken({ userId: user.id, action: "weekly_opt_out" });
      const unsubscribeUrl = `${getPublicBaseUrl()}/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`;

      try {
        await client.emails.send({
          from: fromEmail,
          to: user.email,
          subject: digestProfile.subject,
          html: getWeeklyEngagementEmailHtml({
            firstName,
            unsubscribeUrl,
            headline: digestProfile.headline,
            intro: digestProfile.intro,
            reasonLine: digestProfile.reasonLine,
            modules: digestProfile.modules,
          }),
          text: getWeeklyEngagementEmailText({
            firstName,
            unsubscribeUrl,
            headline: digestProfile.headline,
            intro: digestProfile.intro,
            reasonLine: digestProfile.reasonLine,
            modules: digestProfile.modules,
          }),
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

    return {
      success: true,
      templateChoice: options?.templateOverride || "auto_personalized",
      activeWindowDays: audience.activeWindowDays,
      cooldownDays: audience.cooldownDays,
      totalCandidates: audience.totalCandidates,
      excludedRecentlySent: audience.excludedRecentlySent,
      emailsSent,
      segmentBreakdown: audience.segmentBreakdown,
      sampleRecipients: audience.sampleRecipients,
      errors: errors.length > 0 ? errors : undefined,
    };
  };

  app.post("/api/cron/send-weekly-engagement", async (req, res) => {
    try {
      const cronSecret = req.headers['x-cron-secret'];
      const expectedSecret = process.env.CRON_SECRET || process.env.SESSION_SECRET;
      if (!cronSecret || cronSecret !== expectedSecret) {
        console.warn('Unauthorized cron attempt from IP:', req.ip);
        return res.status(401).json({ error: 'Unauthorized' });
      }
      res.json(await sendWeeklyEngagementEmails());
    } catch (error: any) {
      console.error("Weekly engagement cron error:", error);
      res.status(500).json({ error: "Failed to send weekly engagement emails" });
    }
  });

  app.post("/api/admin/marketing/weekly-engagement", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const mode = typeof req.body?.mode === "string" ? req.body.mode : "dry_run";
      const activeWindowDays = Number(req.body?.activeWindowDays) || 30;
      const cooldownDays = Number(req.body?.cooldownDays) || 7;
      const testEmail = typeof req.body?.testEmail === "string" ? req.body.testEmail.trim() : "";
      const allowedTemplateSegments: WeeklyDigestSegment[] = [
        "flight_planning",
        "marketplace",
        "training",
        "logbook",
      ];
      const templateChoice = typeof req.body?.templateChoice === "string"
        ? req.body.templateChoice.trim()
        : "auto_personalized";
      const testTemplateChoice = typeof req.body?.testTemplateChoice === "string"
        ? req.body.testTemplateChoice.trim()
        : templateChoice;
      const forcedTemplate = allowedTemplateSegments.includes(templateChoice as WeeklyDigestSegment)
        ? templateChoice as WeeklyDigestSegment
        : undefined;
      const forcedTestTemplate = allowedTemplateSegments.includes(testTemplateChoice as WeeklyDigestSegment)
        ? testTemplateChoice as WeeklyDigestSegment
        : forcedTemplate;

      if (mode === "test") {
        if (!testEmail) {
          return res.status(400).json({ error: "Test email is required" });
        }

        const { getWeeklyEngagementEmailHtml, getWeeklyEngagementEmailText } = await import("./email-templates");
        const { client, fromEmail } = await getUncachableResendClient();
        const token = signMarketingToken({ userId: req.user?.claims?.sub || "test-user", action: "weekly_opt_out" });
        const unsubscribeUrl = `${getPublicBaseUrl()}/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`;
        const digestProfile = buildWeeklyDigestProfile({
          user: {
            createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
            firstName: "Pilot",
            email: testEmail,
          },
          events: [],
          segmentOverride: forcedTestTemplate,
        });

        await client.emails.send({
          from: fromEmail,
          to: testEmail,
          subject: digestProfile.subject,
          html: getWeeklyEngagementEmailHtml({
            firstName: "Pilot",
            unsubscribeUrl,
            headline: digestProfile.headline,
            intro: digestProfile.intro,
            reasonLine: `Test send for segment: ${digestProfile.segment}`,
            modules: digestProfile.modules,
          }),
          text: getWeeklyEngagementEmailText({
            firstName: "Pilot",
            unsubscribeUrl,
            headline: digestProfile.headline,
            intro: digestProfile.intro,
            reasonLine: `Test send for segment: ${digestProfile.segment}`,
            modules: digestProfile.modules,
          }),
        });

        return res.json({
          success: true,
          mode: "test",
          sentTo: testEmail,
          templateChoice: forcedTestTemplate || "auto_personalized",
          segment: digestProfile.segment,
        });
      }

      if (mode === "send") {
        return res.json(await sendWeeklyEngagementEmails({
          activeWindowDays,
          cooldownDays,
          templateOverride: forcedTemplate,
        }));
      }

      const audience = await buildWeeklyEngagementAudience({
        activeWindowDays,
        cooldownDays,
        templateOverride: forcedTemplate,
      });
      res.json({
        success: true,
        mode: "dry_run",
        templateChoice: forcedTemplate || "auto_personalized",
        activeWindowDays: audience.activeWindowDays,
        cooldownDays: audience.cooldownDays,
        totalCandidates: audience.totalCandidates,
        excludedRecentlySent: audience.excludedRecentlySent,
        eligibleCount: audience.eligibleRecipients.length,
        segmentBreakdown: audience.segmentBreakdown,
        sampleRecipients: audience.sampleRecipients,
      });
    } catch (error: any) {
      console.error("Weekly engagement admin control error:", error);
      res.status(500).json({ error: error?.message || "Failed to manage weekly engagement emails" });
    }
  });

  app.post("/api/admin/marketing/pro-trial-offer", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const dryRun = Boolean(req.body?.dryRun);
      const testEmail = typeof req.body?.testEmail === "string" ? req.body.testEmail.trim() : "";
      const forceResend = Boolean(req.body?.forceResend);
      const requestedLimit = Number(req.body?.limit);
      const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(250, requestedLimit)) : 250;

      const {
        getProTrialOfferEmailHtml,
        getProTrialOfferEmailText,
      } = await import("./email-templates");

      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          isSuspended: users.isSuspended,
          weeklyEmailOptIn: users.weeklyEmailOptIn,
          membershipTier: users.membershipTier,
          membershipStatus: users.membershipStatus,
          membershipTrialEndsAt: users.membershipTrialEndsAt,
          proTrialOfferSentAt: users.proTrialOfferSentAt,
        })
        .from(users);

      const candidates = allUsers
        .filter((user) => {
          if (!user.email) return false;
          if (user.isSuspended) return false;
          if (!user.weeklyEmailOptIn) return false;
          if (!forceResend && user.proTrialOfferSentAt) return false;
          if (user.membershipStatus === "active" || user.membershipStatus === "trialing") return false;
          if (user.membershipTrialEndsAt) return false;
          if (user.membershipTier && user.membershipTier !== "free") return false;
          return true;
        })
        .slice(0, limit);

      if (testEmail) {
        const { client, fromEmail } = await getUncachableResendClient();
        const token = signMarketingToken({ userId: req.user?.claims?.sub || "test-user", action: "weekly_opt_out" });
        const unsubscribeUrl = `${getPublicBaseUrl()}/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`;

        await client.emails.send({
          from: fromEmail,
          to: testEmail,
          subject: "Try RSF Pro free for 14 days",
          html: getProTrialOfferEmailHtml({ firstName: "Pilot", unsubscribeUrl }),
          text: getProTrialOfferEmailText({ firstName: "Pilot", unsubscribeUrl }),
        });

        return res.json({
          success: true,
          mode: "test",
          sentTo: testEmail,
        });
      }

      if (dryRun) {
        return res.json({
          success: true,
          mode: "dry-run",
          totalCandidates: candidates.length,
          candidates: candidates.map((user) => ({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            membershipTier: user.membershipTier,
            membershipStatus: user.membershipStatus,
            previouslySentAt: user.proTrialOfferSentAt,
          })),
        });
      }

      const { client, fromEmail } = await getUncachableResendClient();
      const errors: string[] = [];
      let emailsSent = 0;

      for (const user of candidates) {
        const firstName = user.firstName || user.email!.split("@")[0];
        const token = signMarketingToken({ userId: user.id, action: "weekly_opt_out" });
        const unsubscribeUrl = `${getPublicBaseUrl()}/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`;

        try {
          await client.emails.send({
            from: fromEmail,
            to: user.email!,
            subject: "Try RSF Pro free for 14 days",
            html: getProTrialOfferEmailHtml({ firstName, unsubscribeUrl }),
            text: getProTrialOfferEmailText({ firstName, unsubscribeUrl }),
          });

          await storage.updateUser(user.id, {
            proTrialOfferSentAt: new Date(),
          });

          emailsSent += 1;
        } catch (error: any) {
          console.error(`Failed to send Pro trial offer to ${user.email}:`, error);
          errors.push(`${user.email}: ${error.message || "send failed"}`);
        }
      }

      res.json({
        success: true,
        mode: "send",
        totalCandidates: candidates.length,
        emailsSent,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error("Pro trial offer campaign error:", error);
      res.status(500).json({ error: "Failed to send Pro trial offer campaign", details: error.message });
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
      const { q, category, engine_type: engineType, verified, limit, offset } = req.query as any;
      const types = await storage.getAircraftTypes({
        q: typeof q === "string" ? q : undefined,
        category: typeof category === "string" ? category : undefined,
        engineType: typeof engineType === "string" ? engineType : undefined,
        verified:
          verified === "true" ? true :
          verified === "false" ? false :
          undefined,
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
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
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
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
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
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
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
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
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
      const parseCsv = (value: unknown) =>
        typeof value === "string"
          ? value
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean)
          : [];

      const certifications = parseCsv(req.query.certifications);
      const categories = parseCsv(req.query.category);
      const avionics = parseCsv(req.query.avionics).map((suite) => suite.toLowerCase());
      const insuranceIncluded = String(req.query.insuranceIncluded || "").toLowerCase() === "true";
      const wetRateOnly = String(req.query.wetRate || "").toLowerCase() === "true";

      const listings = await storage.getAllAircraftListings();
      const filteredListings = listings.filter((listing) => {
        if (certifications.length > 0) {
          const hasCertifications = certifications.every((cert) => listing.requiredCertifications.includes(cert));
          if (!hasCertifications) return false;
        }

        if (categories.length > 0 && !categories.includes(listing.category)) {
          return false;
        }

        if (avionics.length > 0) {
          const listingAvionics = (listing.avionicsSuite || "").toLowerCase();
          const matchesAvionics = avionics.some((suite) => listingAvionics.includes(suite));
          if (!matchesAvionics) return false;
        }

        if (insuranceIncluded && !listing.insuranceIncluded) {
          return false;
        }

        if (wetRateOnly && !listing.wetRate) {
          return false;
        }

        return true;
      });

      res.json([SAMPLE_AIRCRAFT_LISTING, ...filteredListings]);
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
      const startedAt = Date.now();
      try {
        const userId = req.user.claims.sub;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        
        // Parse listing data - handle both multipart and JSON
        const hasFiles = files && Object.keys(files).length > 0;
        const listingData = hasFiles ? JSON.parse(req.body.listingData || '{}') : req.body;
        const submissionKey =
          typeof listingData.submissionKey === "string" && listingData.submissionKey.trim()
            ? listingData.submissionKey.trim().slice(0, 120)
            : null;

        const requestedInsuranceDocUrl =
          typeof listingData.insuranceDocUrl === "string" && listingData.insuranceDocUrl.trim()
            ? listingData.insuranceDocUrl.trim()
            : null;
        const requestedAnnualInspectionDocUrl =
          typeof listingData.annualInspectionDocUrl === "string" && listingData.annualInspectionDocUrl.trim()
            ? listingData.annualInspectionDocUrl.trim()
            : null;

        if (requestedInsuranceDocUrl && !isOwnedAircraftVerificationDocPath(requestedInsuranceDocUrl, userId)) {
          return res.status(400).json({ error: "Invalid insurance document path" });
        }
        if (requestedAnnualInspectionDocUrl && !isOwnedAircraftVerificationDocPath(requestedAnnualInspectionDocUrl, userId)) {
          return res.status(400).json({ error: "Invalid annual inspection document path" });
        }

        const getMultipartUploadPath = (fileList?: Express.Multer.File[]) => {
          const file = fileList?.[0];
          if (!file?.filename) return null;
          const baseDir =
            file.fieldname.includes('image') || file.mimetype.startsWith('image/')
              ? 'marketplace'
              : 'documents';
          return `/uploads/${baseDir}/${file.filename}`;
        };

        // Backward-compatible fallback for multipart uploads while the client moves to direct uploads.
        const uploadedInsuranceDocUrl = getMultipartUploadPath(files?.insuranceDoc);
        const uploadedAnnualInspectionDocUrl = getMultipartUploadPath(files?.annualInspectionDoc);

        const insuranceDocUrl = uploadedInsuranceDocUrl || requestedInsuranceDocUrl;
        const annualInspectionDocUrl = uploadedAnnualInspectionDocUrl || requestedAnnualInspectionDocUrl;
        const docUrls = [insuranceDocUrl, annualInspectionDocUrl].filter((url): url is string => Boolean(url));

        console.info(JSON.stringify({
          event: "rental_listing_create_started",
          userId,
          submissionKey,
          hasVerificationDocs: docUrls.length > 0,
          multipartDocs: hasFiles,
        }));
        
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
          submissionKey,
          isListed: docUrls.length === 0, // Publish immediately if no verification docs
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

        const normalizedRegistration = normalizeAircraftRegistration(validatedData.registration);

        const result = await db.transaction(async (tx) => {
          if (submissionKey) {
            const [existing] = await tx
              .select()
              .from(aircraftListings)
              .where(and(
                eq(aircraftListings.ownerId, userId),
                eq(aircraftListings.submissionKey, submissionKey),
              ))
              .limit(1);

            if (existing) {
              return { listing: existing, replay: true };
            }
          }

          if (normalizedRegistration) {
            const [duplicateListing] = await tx
              .select({
                id: aircraftListings.id,
                isListed: aircraftListings.isListed,
                createdAt: aircraftListings.createdAt,
              })
              .from(aircraftListings)
              .where(and(
                eq(aircraftListings.ownerId, userId),
                sql`regexp_replace(upper(${aircraftListings.registration}), '[^A-Z0-9]', '', 'g') = ${normalizedRegistration}`,
              ))
              .limit(1);

            if (duplicateListing) {
              throw new Error("You already have a rental listing for this registration.");
            }
          }

          const insertQuery = tx
            .insert(aircraftListings)
            .values(validatedData)
            .returning();

          const [listing] = submissionKey
            ? await insertQuery.onConflictDoNothing({
                target: [aircraftListings.ownerId, aircraftListings.submissionKey],
              })
            : await insertQuery;

          if (!listing) {
            const [existing] = await tx
              .select()
              .from(aircraftListings)
              .where(and(
                eq(aircraftListings.ownerId, userId),
                eq(aircraftListings.submissionKey, submissionKey!),
              ))
              .limit(1);

            if (existing) {
              return { listing: existing, replay: true };
            }

            throw new Error("Aircraft listing create conflict");
          }

          if (docUrls.length > 0) {
            await tx
              .insert(verificationSubmissions)
              .values({
                userId,
                type: 'owner_aircraft',
                status: 'pending',
                aircraftId: listing.id,
                submissionData: {
                  ...listingData,
                  registration: listing.registration,
                  make: listing.make,
                  model: listing.model,
                  submissionKey,
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

          return { listing, replay: false };
        });

        console.info(JSON.stringify({
          event: result.replay ? "rental_listing_create_replayed" : "rental_listing_create_committed",
          userId,
          submissionKey,
          listingId: result.listing.id,
          hasVerificationDocs: docUrls.length > 0,
          durationMs: Date.now() - startedAt,
        }));

        res.status(result.replay ? 200 : 201).json({
          ...result.listing,
          idempotentReplay: result.replay,
        });
      } catch (error: any) {
        console.error(JSON.stringify({
          event: "rental_listing_create_failed",
          userId: req.user?.claims?.sub || null,
          message: error?.message || "Unknown create failure",
          durationMs: Date.now() - startedAt,
        }));
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
      const { code, context, category, amount } = req.body;
      
      if (!code) {
        return res.status(400).json({ valid: false, message: "Code is required" });
      }

      const resolvedContext = context || (category ? "marketplace" : null);
      if (!resolvedContext) {
        return res.status(400).json({ valid: false, message: "Code and context are required" });
      }

      if (resolvedContext !== "banner-ad" && resolvedContext !== "marketplace") {
        return res.status(400).json({ valid: false, message: "Invalid context" });
      }

      if (resolvedContext === "marketplace") {
        const requesterId = getRequestUserId(req);
        if (!requesterId) {
          return res.status(401).json({ valid: false, message: "Sign in to validate marketplace promo codes" });
        }

        const amountNumber =
          amount === undefined || amount === null || amount === ""
            ? null
            : Number(amount);
        const resolvedPromo = await resolveMarketplacePromoCode({
          code,
          userId: requesterId,
          category,
          amount: amountNumber,
        });

        if (!resolvedPromo.valid) {
          return res.json({ valid: false, message: resolvedPromo.message });
        }

        return res.json({
          valid: true,
          code: resolvedPromo.code,
          description: resolvedPromo.description,
          discountType: resolvedPromo.discountType,
          discountValue: resolvedPromo.discountValue,
          discountAmount: resolvedPromo.discountAmount,
          durationDays: resolvedPromo.durationDays,
          completionToken: resolvedPromo.completionToken,
        });
      }

      const promoCode = await storage.validatePromoCodeForContext(code, "banner-ad");
      if (!promoCode) {
        return res.json({ valid: false, message: "Invalid or expired promo code" });
      }

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

  const membershipPartnerOfferPayloadSchema = insertMembershipPartnerOfferSchema.extend({
    memberNumbersText: z.string().optional(),
  });

  const membershipPartnerOfferUpdateSchema = insertMembershipPartnerOfferSchema.partial().extend({
    memberNumbersText: z.string().optional(),
  });

  const membershipPartnerOfferRedeemSchema = z.object({
    slug: z.string().min(2).optional(),
    memberNumber: z.string().min(1).optional(),
    claimToken: z.string().min(12).optional(),
  });

  const membershipPartnerOfferValidateSchema = z.object({
    slug: z.string().min(2),
    memberNumber: z.string().min(1),
  });

  const signMembershipPartnerClaimToken = (payload: {
    offerId: string;
    slug: string;
    memberId?: string;
    normalizedMemberNumber: string;
    inputMode?: "roster" | "self_attest";
    selfAttestedValue?: string;
  }) =>
    jwt.sign(
      {
        type: "membership_partner_offer_claim",
        ...payload,
      },
      marketingSecret,
      { expiresIn: "7d" }
    );

  const verifyMembershipPartnerClaimToken = (token: string) => {
    try {
      return jwt.verify(token, marketingSecret) as {
        type?: string;
        offerId: string;
        slug: string;
        memberId?: string;
        normalizedMemberNumber: string;
        inputMode?: "roster" | "self_attest";
        selfAttestedValue?: string;
      };
    } catch {
      return null;
    }
  };

  const parseMembershipPartnerMembers = (raw: string | undefined) => {
    const seen = new Set<string>();
    const members: Array<{ memberNumber: string; normalizedMemberNumber: string }> = [];
    for (const chunk of (raw || "").split(/[\n,]+/)) {
      const memberNumber = chunk.trim();
      if (!memberNumber) continue;
      const normalizedMemberNumber = normalizePartnerMemberNumber(memberNumber);
      if (!normalizedMemberNumber || seen.has(normalizedMemberNumber)) continue;
      seen.add(normalizedMemberNumber);
      members.push({ memberNumber, normalizedMemberNumber });
    }
    return members;
  };

  const getMembershipPartnerOfferSummary = async (offer: MembershipPartnerOffer) => {
    const members = await storage.getMembershipPartnerOfferMembers(offer.id);
    const redeemedCount = members.filter((member) => !!member.redeemedAt).length;
    const baseUrl = getPublicFrontendBaseUrl();
    const sharePath = `/logbook/pro?offer=${encodeURIComponent(offer.slug)}`;
    const signupPath = `/register?redirect=${encodeURIComponent(sharePath)}`;
    return {
      ...offer,
      totalMembers: members.length,
      redeemedCount,
      availableMembers: Math.max(0, members.length - redeemedCount),
      shareUrl: `${baseUrl}${sharePath}`,
      signupUrl: `${baseUrl}${signupPath}`,
    };
  };

  app.get("/api/membership-partner-offers/:slug", async (req, res) => {
    try {
      const slug = normalizeMembershipOfferSlug(String(req.params.slug || ""));
      if (!slug) {
        return res.status(400).json({ error: "Offer slug is required" });
      }
      const offer = await storage.getMembershipPartnerOfferBySlug(slug);
      if (!offer || !offer.isActive) {
        return res.status(404).json({ error: "Offer not found" });
      }
      res.json({
        id: offer.id,
        name: offer.name,
        partnerName: offer.partnerName,
        slug: offer.slug,
        description: offer.description,
        tier: offer.tier,
        durationDays: offer.durationDays,
        acceptsFlexibleIdentifier: allowsFlexiblePartnerIdentifier(offer),
        memberInputLabel: allowsFlexiblePartnerIdentifier(offer) ? "Member number or email" : "Member number",
        memberInputHint: allowsFlexiblePartnerIdentifier(offer)
          ? "ABS rollout mode: member number, email address, and entries with spaces or dashes are accepted."
          : "Spaces and dashes are ignored during verification.",
      });
    } catch (error) {
      console.error("Failed to load membership partner offer:", error);
      res.status(500).json({ error: "Failed to load offer" });
    }
  });

  app.post("/api/membership-partner-offers/validate-member", async (req, res) => {
    try {
      const parsed = membershipPartnerOfferValidateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.format() });
      }

      const slug = normalizeMembershipOfferSlug(parsed.data.slug);
      const rawMemberInput = parsed.data.memberNumber.trim();
      const normalizedMemberNumber = normalizePartnerMemberNumber(rawMemberInput);
      if (!rawMemberInput) {
        return res.status(400).json({ error: "Member number or email is required" });
      }

      const offer = await storage.getMembershipPartnerOfferBySlug(slug);
      if (!offer || !offer.isActive) {
        return res.status(404).json({ error: "Offer not found" });
      }

      const member = normalizedMemberNumber
        ? await storage.getMembershipPartnerOfferMemberByNumber(offer.id, normalizedMemberNumber)
        : undefined;

      let claimToken = "";
      if (member) {
        if (member.redeemedAt) {
          return res.status(409).json({ error: "That member number has already been redeemed" });
        }

        claimToken = signMembershipPartnerClaimToken({
          offerId: offer.id,
          slug: offer.slug,
          memberId: member.id,
          normalizedMemberNumber,
          inputMode: "roster",
        });
      } else if (allowsFlexiblePartnerIdentifier(offer)) {
        claimToken = signMembershipPartnerClaimToken({
          offerId: offer.id,
          slug: offer.slug,
          normalizedMemberNumber: buildFlexiblePartnerIdentifier(rawMemberInput),
          inputMode: "self_attest",
          selfAttestedValue: rawMemberInput,
        });
      } else {
        return res.status(400).json({ error: "Member number not recognized for this offer" });
      }

      res.json({
        success: true,
        claimToken,
        offer: {
          id: offer.id,
          name: offer.name,
          partnerName: offer.partnerName,
          slug: offer.slug,
          tier: offer.tier,
          durationDays: offer.durationDays,
          acceptsFlexibleIdentifier: allowsFlexiblePartnerIdentifier(offer),
        },
      });
    } catch (error) {
      console.error("Failed to validate membership partner offer member:", error);
      res.status(500).json({ error: "Failed to validate member number" });
    }
  });

  app.post("/api/membership-partner-offers/redeem", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const parsed = membershipPartnerOfferRedeemSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.format() });
      }

      let slug = "";
      let normalizedMemberNumber = "";
      let tokenMemberId = "";
      let claimInputMode: "roster" | "self_attest" = "roster";
      let selfAttestedValue = "";
      if (parsed.data.claimToken) {
        const claim = verifyMembershipPartnerClaimToken(parsed.data.claimToken);
        if (!claim || claim.type !== "membership_partner_offer_claim") {
          return res.status(400).json({ error: "This partner offer claim is invalid or expired" });
        }
        slug = normalizeMembershipOfferSlug(claim.slug);
        normalizedMemberNumber = claim.normalizedMemberNumber;
        tokenMemberId = claim.memberId || "";
        claimInputMode = claim.inputMode === "self_attest" ? "self_attest" : "roster";
        selfAttestedValue = claim.selfAttestedValue?.trim() || "";
      } else {
        slug = normalizeMembershipOfferSlug(parsed.data.slug || "");
        selfAttestedValue = parsed.data.memberNumber?.trim() || "";
        normalizedMemberNumber = normalizePartnerMemberNumber(parsed.data.memberNumber || "");
      }

      if (!slug || (!normalizedMemberNumber && !selfAttestedValue)) {
        return res.status(400).json({ error: "Offer and member number or email are required" });
      }

      const offer = await storage.getMembershipPartnerOfferBySlug(slug);
      if (!offer || !offer.isActive) {
        return res.status(404).json({ error: "Offer not found" });
      }

      const member = normalizedMemberNumber
        ? await storage.getMembershipPartnerOfferMemberByNumber(offer.id, normalizedMemberNumber)
        : undefined;
      const canUseFlexibleIdentifier = allowsFlexiblePartnerIdentifier(offer);
      const isSelfAttestedClaim = claimInputMode === "self_attest";
      if (!member && !(canUseFlexibleIdentifier && (selfAttestedValue || isSelfAttestedClaim))) {
        return res.status(400).json({ error: "Member number not recognized for this offer" });
      }
      if (member && tokenMemberId && member.id !== tokenMemberId) {
        return res.status(400).json({ error: "This partner offer claim does not match the member record" });
      }

      if (member?.redeemedByUserId && member.redeemedByUserId !== userId) {
        return res.status(409).json({ error: "That member number has already been redeemed" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const tierRank = (value?: string | null) =>
        value === "pro_plus" ? 2 : value === "pro" ? 1 : 0;
      const now = new Date();
      const currentGrantEndsAt = user.membershipGrantEndsAt ? new Date(user.membershipGrantEndsAt) : null;
      const currentGrantActive = !!currentGrantEndsAt && currentGrantEndsAt > now;
      const requestedEndsAt = addDays(now, offer.durationDays);

      let resolvedTier: "pro" | "pro_plus" = offer.tier === "pro" ? "pro" : "pro_plus";
      let resolvedEndsAt = requestedEndsAt;
      if (currentGrantActive && tierRank(user.membershipGrantTier) > tierRank(resolvedTier)) {
        resolvedTier = user.membershipGrantTier as "pro" | "pro_plus";
        resolvedEndsAt = currentGrantEndsAt as Date;
      } else if (
        currentGrantActive &&
        tierRank(user.membershipGrantTier) === tierRank(resolvedTier) &&
        currentGrantEndsAt &&
        currentGrantEndsAt > resolvedEndsAt
      ) {
        resolvedEndsAt = currentGrantEndsAt;
      }

      if (member && !member.redeemedByUserId) {
        const redeemed = await storage.redeemMembershipPartnerOfferMember(member.id, userId);
        if (!redeemed) {
          return res.status(409).json({ error: "That member number has already been redeemed" });
        }
      }

      const identifierForReason = member?.memberNumber || selfAttestedValue || normalizedMemberNumber;
      const reason = `${offer.partnerName} member offer: ${offer.name} (${identifierForReason})`;
      const updated = await storage.updateUser(userId, {
        membershipGrantTier: resolvedTier,
        membershipGrantEndsAt: resolvedEndsAt,
        membershipGrantGrantedBy: null,
        membershipGrantGrantedAt: now,
        membershipGrantReason: reason,
      });

      const tierLabel = resolvedTier === "pro_plus" ? "RSF Pro+" : "RSF Pro Core";
      await storage.createUserNotification({
        userId,
        type: "membership_grant",
        title: `${tierLabel} access unlocked`,
        message: `${offer.partnerName} unlocked ${tierLabel} for ${offer.durationDays} day${offer.durationDays === 1 ? "" : "s"}. Access is scheduled to end on ${resolvedEndsAt.toLocaleString()}.`,
        channels: user.email ? ["in_app", "email"] : ["in_app"],
        referenceDate: null,
        meta: {
          tier: resolvedTier,
          durationDays: offer.durationDays,
          grantEndsAt: resolvedEndsAt.toISOString(),
          offerSlug: offer.slug,
          partnerName: offer.partnerName,
          partnerIdentifier: identifierForReason,
          partnerIdentifierMode: member ? "roster" : "self_attest",
        },
      });

      if (user.email) {
        void sendMembershipGrantEmail({
          email: user.email,
          firstName: user.firstName,
          tier: resolvedTier,
          durationDays: offer.durationDays,
          endsAt: resolvedEndsAt,
          reason,
        }).catch((error) => {
          console.error("Membership partner offer email delivery failed:", error);
        });
      }

      res.json({
        success: true,
        offer: {
          id: offer.id,
          name: offer.name,
          partnerName: offer.partnerName,
          slug: offer.slug,
          tier: resolvedTier,
          durationDays: offer.durationDays,
        },
        membershipGrantEndsAt: resolvedEndsAt.toISOString(),
        user: updated,
      });
    } catch (error) {
      console.error("Failed to redeem membership partner offer:", error);
      res.status(500).json({ error: "Failed to redeem offer" });
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

  app.delete("/api/marketplace/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      // Check if listing is a sample listing
      const listing = await storage.getMarketplaceListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if ((listing as any).isExample) {
        return res.status(403).json({ error: "Sample listings cannot be deleted" });
      }
      const requester = await storage.getUser(userId);
      if (listing.userId !== userId && !requester?.isAdmin && !requester?.isSuperAdmin) {
        return res.status(403).json({ error: "Access denied" });
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

  app.get("/api/rentals/renter/:renterId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (req.params.renterId !== userId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }
      const rentals = await storage.getRentalsByRenter(req.params.renterId);
      res.json(rentals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch renter rentals" });
    }
  });

  app.get("/api/rentals/owner/:ownerId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (req.params.ownerId !== userId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }
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

  app.get("/api/rentals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const rental = await storage.getRental(req.params.id);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      if (rental.ownerId !== userId && rental.renterId !== userId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(rental);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rental" });
    }
  });

  app.post("/api/rentals", isAuthenticated, isVerified, async (req: any, res) => {
    try {
      const renterId = req.user.claims.sub;
      const aircraft = await storage.getAircraftListing(req.body.aircraftId);
      if (!aircraft || !aircraft.isListed) {
        return res.status(404).json({ error: "Aircraft not available for rental" });
      }

      if (aircraft.ownerId === renterId) {
        return res.status(400).json({ error: "You cannot rent your own aircraft" });
      }

      const renter = await storage.getUser(renterId);
      if (!renter) {
        return res.status(404).json({ error: "Renter not found" });
      }
      const renterHours = Number(renter.totalFlightHours || 0);
      if (renterHours < Number(aircraft.minFlightHours || 0)) {
        return res.status(400).json({
          error: `This aircraft requires at least ${aircraft.minFlightHours || 0} total flight hours`,
        });
      }
      const renterCertifications = new Set((renter.certifications || []).map((cert) => cert.toLowerCase()));
      const missingCertifications = (aircraft.requiredCertifications || []).filter(
        (cert) => !renterCertifications.has(cert.toLowerCase()),
      );
      if (missingCertifications.length > 0) {
        return res.status(400).json({
          error: `Missing required certifications: ${missingCertifications.join(", ")}`,
        });
      }

      const startDate = new Date(req.body.startDate);
      const endDate = new Date(req.body.endDate);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "Invalid rental dates" });
      }
      if (endDate < startDate) {
        return res.status(400).json({ error: "End date must be on or after start date" });
      }

      const overlappingRentals = await storage.getRentalsByAircraft(aircraft.id);
      const hasConflict = overlappingRentals.some((existingRental) => {
        if (existingRental.status !== "approved" && existingRental.status !== "active") {
          return false;
        }
        const existingStart = new Date(existingRental.startDate);
        const existingEnd = new Date(existingRental.endDate);
        return startDate < existingEnd && endDate > existingStart;
      });

      if (hasConflict) {
        return res.status(400).json({ error: "Aircraft is not available for the selected dates" });
      }

      const rentalData = {
        aircraftId: aircraft.id,
        renterId,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        estimatedHours: String(req.body.estimatedHours),
        hourlyRate: String(aircraft.hourlyRate),
        ownerId: aircraft.ownerId,
      };
      
      const validatedData = insertRentalSchema.parse(rentalData);
      const rental = await storage.createRental(validatedData);
      res.status(201).json(rental);
    } catch (error: any) {
      console.error("Rental creation error:", error);
      res.status(400).json({ error: error.message || "Invalid rental data" });
    }
  });

  app.patch("/api/rentals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rental = await storage.getRental(req.params.id);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }

      const nextStatus = typeof req.body.status === "string" ? req.body.status : null;
      if (!nextStatus) {
        return res.status(400).json({ error: "Status update required" });
      }

      if (nextStatus === "approved") {
        if (rental.ownerId !== userId) {
          return res.status(403).json({ error: "Only the aircraft owner can approve this rental" });
        }
        if (rental.status !== "pending") {
          return res.status(400).json({ error: "Only pending rentals can be approved" });
        }
      } else if (nextStatus === "cancelled") {
        if (rental.ownerId !== userId && rental.renterId !== userId) {
          return res.status(403).json({ error: "Only rental participants can cancel this rental" });
        }
        if (rental.status !== "pending" && rental.status !== "approved") {
          return res.status(400).json({ error: "Only pending or approved rentals can be cancelled" });
        }
      } else {
        return res.status(400).json({ error: "Unsupported rental update" });
      }

      const updatedRental = await storage.updateRental(req.params.id, { status: nextStatus });
      res.json(updatedRental);
    } catch (error) {
      res.status(500).json({ error: "Failed to update rental" });
    }
  });

  app.post("/api/rentals/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rental = await storage.getRental(req.params.id);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      if (rental.ownerId !== userId && rental.renterId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (rental.status !== "active") {
        return res.status(400).json({ error: "Only active rentals can be completed" });
      }
      if (new Date(rental.endDate).getTime() > Date.now()) {
        return res.status(400).json({ error: "Rental cannot be completed before the scheduled end date" });
      }

      // Place owner payout on hold — balance is NOT credited yet.
      // releaseAvailableRentalPayouts() credits it once the hold window elapses.
      const payoutAvailableAt = new Date(Date.now() + RENTAL_PAYOUT_HOLD_HOURS * 60 * 60 * 1000);

      const updatedRental = await storage.updateRental(req.params.id, {
        status: "completed",
        payoutAvailableAt,
        // payoutCompleted remains false until the hold expires and the balance is released
      });

      logDebug(`[RENTAL COMPLETE] Rental ${rental.id} payout of $${rental.ownerPayout} for owner ${rental.ownerId} on hold until ${payoutAvailableAt.toISOString()}`);

      res.json(updatedRental);
    } catch (error: any) {
      console.error("Complete rental error:", error);
      res.status(500).json({ error: error.message || "Failed to complete rental" });
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

      const updatedRental = await storage.updateRental(req.params.id, {
        isPaid: true,
        status: "active",
      });

      res.json(updatedRental);
    } catch (error: any) {
      console.error("Complete payment error:", error);
      res.status(500).json({ error: error.message || "Failed to complete rental payment" });
    }
  });

  // Messages
  app.get("/api/rentals/:rentalId/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // Verify rental exists and is active
      const rental = await storage.getRental(req.params.rentalId);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      if (rental.status !== "active") {
        return res.status(403).json({ error: "Messaging only available for active rentals" });
      }
      if (rental.ownerId !== userId && rental.renterId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const messages = await storage.getMessagesByRental(req.params.rentalId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.get("/api/messages/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [ownerRentals, renterRentals] = await Promise.all([
        storage.getRentalsByOwner(userId),
        storage.getRentalsByRenter(userId),
      ]);

      const rentalsById = new Map(
        [...ownerRentals, ...renterRentals]
          .filter((rental) => rental.status === "active")
          .map((rental) => [rental.id, rental]),
      );
      const conversations = await Promise.all(
        Array.from(rentalsById.values()).map(async (rental) => {
          const [messages, aircraft, otherUser] = await Promise.all([
            storage.getMessagesByRental(rental.id),
            storage.getAircraftListing(rental.aircraftId),
            storage.getUser(rental.ownerId === userId ? rental.renterId : rental.ownerId),
          ]);

          const latestMessage = messages[messages.length - 1];
          const unreadCount = messages.filter((message) => !message.isRead && message.receiverId === userId).length;

          return {
            id: rental.id,
            rentalId: rental.id,
            userId: otherUser?.id || "",
            userName: `${otherUser?.firstName || ""} ${otherUser?.lastName || ""}`.trim() || "RSF Member",
            userAvatar: otherUser?.profileImageUrl || null,
            aircraftName: aircraft ? `${aircraft.year} ${aircraft.make} ${aircraft.model}` : "Aircraft",
            lastMessage: latestMessage?.content || "No messages yet",
            lastMessageTime: latestMessage?.createdAt || rental.updatedAt || rental.createdAt,
            unreadCount,
          };
        }),
      );

      conversations.sort(
        (a, b) => new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime(),
      );
      res.json(conversations);
    } catch (error) {
      console.error("Failed to fetch message conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/messages/conversation/:rentalId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rental = await storage.getRental(req.params.rentalId);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }

      if (rental.ownerId !== userId && rental.renterId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (rental.status !== "active") {
        return res.status(403).json({ error: "Messaging is no longer available for this rental" });
      }

      const [messages, ownerUser, renterUser] = await Promise.all([
        storage.getMessagesByRental(rental.id),
        storage.getUser(rental.ownerId),
        storage.getUser(rental.renterId),
      ]);

      for (const message of messages) {
        if (!message.isRead && message.receiverId === userId) {
          await storage.markMessageAsRead(message.id);
        }
      }

      res.json(
        messages.map((message) => ({
          ...message,
          timestamp: message.createdAt,
          senderName:
            message.senderId === rental.ownerId
              ? `${ownerUser?.firstName || ""} ${ownerUser?.lastName || ""}`.trim() || "Owner"
              : `${renterUser?.firstName || ""} ${renterUser?.lastName || ""}`.trim() || "Renter",
        })),
      );
    } catch (error) {
      console.error("Failed to fetch message thread:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // Verify rental exists and is active
      const rental = await storage.getRental(req.body.rentalId);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      if (rental.status !== "active") {
        return res.status(403).json({ error: "Messaging only available for active rentals" });
      }
      if (rental.ownerId !== userId && rental.renterId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
      if (!content) {
        return res.status(400).json({ error: "Message content is required" });
      }

      const receiverId = rental.ownerId === userId ? rental.renterId : rental.ownerId;
      const message = await storage.createMessage({
        rentalId: rental.id,
        senderId: userId,
        receiverId,
        content,
      });
      res.status(201).json(message);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid message data" });
    }
  });

  app.patch("/api/messages/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const existing = await storage.getMessageById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Message not found" });
      }
      if (existing.receiverId !== userId && existing.senderId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
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
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
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
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
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
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
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
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
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
      { name: 'medicalCertificateFile', maxCount: 1 },
      { name: 'pilotLicenseFile', maxCount: 1 },
      { name: 'pilotCertificatePhoto', maxCount: 1 },
    ]), 
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        
        // Parse submission data from form
        const submissionData = JSON.parse(req.body.submissionData || '{}');
        const type = req.body.type || 'renter_identity';
        
        // Build documentUrls using the actual paths multer wrote to disk.
        // file.path comes from diskStorage as e.g. "uploads/documents/medicalCertificateFile-123.pdf"
        // Stored with a leading slash so the document-serving endpoint can resolve it.
        const documentUrls: string[] = [];
        const toStoragePath = (f: Express.Multer.File) =>
          ("/" + f.path.replace(/\\/g, "/")).replace(/\/\//g, "/");

        if (files.governmentIdFront?.[0])    documentUrls.push(toStoragePath(files.governmentIdFront[0]));
        if (files.governmentIdBack?.[0])     documentUrls.push(toStoragePath(files.governmentIdBack[0]));
        if (files.medicalCertificateFile?.[0]) documentUrls.push(toStoragePath(files.medicalCertificateFile[0]));
        if (files.pilotLicenseFile?.[0])     documentUrls.push(toStoragePath(files.pilotLicenseFile[0]));
        if (files.pilotCertificatePhoto?.[0]) documentUrls.push(toStoragePath(files.pilotCertificatePhoto[0]));

        const medicalCertExpiresAt =
          req.body.medicalCertExpiresAt && !Number.isNaN(Date.parse(req.body.medicalCertExpiresAt))
            ? new Date(req.body.medicalCertExpiresAt)
            : null;
        
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
          medicalCertExpiresAt,
          insuranceExpiresAt: null,
          governmentIdExpiresAt: null,
          expirationNotificationSent: false,
          lastNotificationSentAt: null,
        });

        // Notify admins so the review queue stays visible
        const applicantName = [submissionData.legalFirstName, submissionData.legalLastName]
          .filter(Boolean).join(" ") || "A user";
        const typeLabel = type === "renter_identity" ? "renter identity" : "owner/aircraft";
        await storage.createAdminNotification({
          type: "verification_pending",
          title: "New Verification Submission",
          message: `${applicantName} submitted a ${typeLabel} verification (submission ${submission.id}). Review required.`,
          isRead: false,
          isActionable: true,
        }).catch((err) => {
          // Non-fatal — submission is already saved; just log the notification failure
          console.error("[VERIFICATION] Failed to create admin notification:", err);
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

  app.get("/api/verification-submissions/:id/documents/:index", isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = getRequestUserId(req);
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const submission = await storage.getVerificationSubmissionById(req.params.id);
      if (!submission) {
        return res.status(404).json({ error: "Verification submission not found" });
      }

      const requester = await storage.getUser(requesterId);
      const canAccessSubmission =
        submission.userId === requesterId || Boolean(requester?.isAdmin || requester?.isSuperAdmin);
      if (!canAccessSubmission) {
        return res.status(403).json({ error: "Access denied" });
      }

      const documentIndex = Number.parseInt(String(req.params.index), 10);
      if (!Number.isInteger(documentIndex) || documentIndex < 0) {
        return res.status(400).json({ error: "Invalid document index" });
      }

      const rawDocumentPath = submission.documentUrls?.[documentIndex];
      if (!rawDocumentPath || typeof rawDocumentPath !== "string") {
        return res.status(404).json({ error: "Document not found" });
      }

      const documentPath = rawDocumentPath.trim();
      if (!documentPath) {
        return res.status(404).json({ error: "Document not found" });
      }

      const safeFileName = path.basename(documentPath.split("?")[0] || `verification-document-${documentIndex + 1}`);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Disposition", `inline; filename="${safeFileName.replace(/"/g, "")}"`);

      if (documentPath.startsWith("/uploads/")) {
        const uploadsRoot = path.resolve(process.cwd(), "uploads");
        const absolutePath = path.resolve(process.cwd(), `.${documentPath}`);
        if (!absolutePath.startsWith(`${uploadsRoot}${path.sep}`) && absolutePath !== uploadsRoot) {
          return res.status(400).json({ error: "Invalid document path" });
        }
        if (!fs.existsSync(absolutePath)) {
          return res.status(404).json({ error: "Document not found" });
        }
        return res.sendFile(absolutePath);
      }

      if (documentPath.startsWith("/objects/")) {
        const objectStorageService = new ObjectStorageService();
        const objectFile = await objectStorageService.getObjectEntityFile(documentPath);
        await objectStorageService.downloadObject(objectFile, res, 0);
        return;
      }

      if (!process.env.AWS_S3_BUCKET) {
        return res.status(404).json({ error: "Document not found" });
      }

      let s3Key = documentPath;
      if (/^https?:\/\//i.test(documentPath)) {
        try {
          const parsed = new URL(documentPath);
          s3Key = parsed.pathname.replace(/^\/+/, "");
          const bucketName = process.env.AWS_S3_BUCKET || "";
          if (bucketName && s3Key.startsWith(`${bucketName}/`)) {
            s3Key = s3Key.slice(bucketName.length + 1);
          }
        } catch {
          s3Key = documentPath;
        }
      }

      const { S3StorageService } = await import("./s3Storage.js");
      const s3Service = new S3StorageService();
      const { stream, contentType, contentLength } = await s3Service.getObjectStream({ key: s3Key });
      res.setHeader("Content-Type", contentType || "application/octet-stream");
      if (contentLength) {
        res.setHeader("Content-Length", String(contentLength));
      }
      await pipeline(stream, res);
    } catch (error: any) {
      if (error instanceof ObjectNotFoundError || error?.code === "ENOENT") {
        return res.status(404).json({ error: "Document not found" });
      }
      const statusCode = error?.$metadata?.httpStatusCode;
      if (error?.name === "NoSuchKey" || statusCode === 404) {
        return res.status(404).json({ error: "Document not found" });
      }
      console.error("Failed to stream verification document:", error);
      if (res.headersSent) {
        res.end();
        return;
      }
      return res.status(500).json({ error: "Failed to load document" });
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
      // Release any rental payouts whose hold has expired before reading balance
      await storage.releaseAvailableRentalPayouts(userId);
      const balance = await storage.getUserBalance(userId);
      const { heldBalance, nextAvailableAt } = await storage.getHeldRentalPayouts(userId);
      res.json({ balance, heldBalance, nextAvailableAt });
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

      // Release any held payouts whose hold has expired, then check available balance
      await storage.releaseAvailableRentalPayouts(userId);
      const userBalance = parseFloat(await storage.getUserBalance(userId));
      if (userBalance < parsedAmount) {
        const { heldBalance } = await storage.getHeldRentalPayouts(userId);
        if (parseFloat(heldBalance) > 0) {
          return res.status(400).json({
            error: "Some rental earnings are still in the payout hold period and will be available soon. Please try again later or reduce the withdrawal amount.",
            heldBalance,
          });
        }
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
  app.get("/api/admin/users/table", isAuthenticated, requireUsersAdmin, async (req, res) => {
    try {
      const parsed = adminUserFiltersSchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.format() });
      }

      const { filteredRows } = await loadAdminUserDirectoryForFilters(parsed.data);
      res.json({
        totalMatched: filteredRows.length,
        rows: filteredRows.map(buildAdminUserSummary),
      });
    } catch (error) {
      console.error("Failed to load admin user table:", error);
      res.status(500).json({ error: "Failed to load admin users" });
    }
  });

  app.post("/api/admin/users/marketing-email/preview", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const parsed = adminAudienceRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.format() });
      }

      const { directory } = await loadAdminUserDirectoryForFilters(parsed.data);
      const audienceRows = resolveAdminEmailAudience(directory, parsed.data);
      const seenEmails = new Set<string>();
      const sampleRecipients: Array<{ id: string; email: string; firstName: string | null; lastName: string | null }> = [];
      let skippedMissingEmail = 0;
      let skippedInvalidEmail = 0;
      let skippedOptedOut = 0;
      let skippedDuplicates = 0;
      let eligibleCount = 0;

      for (const row of audienceRows) {
        if (!row.email) {
          skippedMissingEmail += 1;
          continue;
        }
        if (!isValidRecipientEmail(row.email)) {
          skippedInvalidEmail += 1;
          continue;
        }
        if (!isMarketingSubscribed(row)) {
          skippedOptedOut += 1;
          continue;
        }
        const normalizedEmail = row.email.trim().toLowerCase();
        if (seenEmails.has(normalizedEmail)) {
          skippedDuplicates += 1;
          continue;
        }
        seenEmails.add(normalizedEmail);
        eligibleCount += 1;
        if (sampleRecipients.length < 12) {
          sampleRecipients.push({
            id: row.id,
            email: row.email,
            firstName: row.firstName,
            lastName: row.lastName,
          });
        }
      }

      res.json({
        audience: parsed.data.audience || "all_active",
        totalMatched: audienceRows.length,
        eligibleCount,
        skippedMissingEmail,
        skippedInvalidEmail,
        skippedOptedOut,
        skippedDuplicates,
        sampleRecipients,
      });
    } catch (error) {
      console.error("Failed to preview marketing email audience:", error);
      res.status(500).json({ error: "Failed to preview audience" });
    }
  });

  app.post("/api/admin/users/marketing-email/test", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const requesterId = req.user?.claims?.sub || req.session?.userId;
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const requester = await storage.getUser(String(requesterId));
      if (!requester?.email) {
        return res.status(400).json({ error: "Current admin email is not available" });
      }

      const parsed = z.object({
        subject: z.string().trim().min(3).max(180),
        body: z.string().trim().min(10).max(12000),
      }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.format() });
      }

      await sendUserMarketingEmail({
        to: requester.email,
        subject: `[Preview] ${parsed.data.subject}`,
        body: parsed.data.body,
        firstName: requester.firstName,
      });

      res.json({ success: true, email: requester.email });
    } catch (error) {
      console.error("Failed to send marketing email preview:", error);
      res.status(500).json({ error: "Failed to send preview email" });
    }
  });

  app.post("/api/admin/users/marketing-email/send", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const parsed = adminAudienceRequestSchema.extend({
        subject: z.string().trim().min(3).max(180),
        body: z.string().trim().min(10).max(12000),
      }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.format() });
      }

      const { directory } = await loadAdminUserDirectoryForFilters(parsed.data);
      const audienceRows = resolveAdminEmailAudience(directory, parsed.data);
      const dedupedRecipients: Array<AdminUserDirectoryRow & { normalizedEmail: string }> = [];
      const failedEmails: Array<{ email: string; error: string }> = [];
      const skipped: Array<{ email?: string | null; reason: string }> = [];
      const seenEmails = new Set<string>();

      for (const row of audienceRows) {
        if (!row.email) {
          skipped.push({ reason: "missing_email" });
          continue;
        }
        if (!isValidRecipientEmail(row.email)) {
          skipped.push({ email: row.email, reason: "invalid_email" });
          continue;
        }
        if (!isMarketingSubscribed(row)) {
          skipped.push({ email: row.email, reason: "opted_out" });
          continue;
        }
        const normalizedEmail = row.email.trim().toLowerCase();
        if (seenEmails.has(normalizedEmail)) {
          skipped.push({ email: row.email, reason: "duplicate_email" });
          continue;
        }
        seenEmails.add(normalizedEmail);
        dedupedRecipients.push({ ...row, normalizedEmail });
      }

      let sent = 0;
      const batchSize = 25;
      for (let index = 0; index < dedupedRecipients.length; index += batchSize) {
        const batch = dedupedRecipients.slice(index, index + batchSize);
        const results = await Promise.allSettled(
          batch.map((recipient) =>
            sendUserMarketingEmail({
              to: recipient.email!,
              subject: parsed.data.subject,
              body: parsed.data.body,
              firstName: recipient.firstName,
            })
          )
        );

        results.forEach((result, batchIndex) => {
          const recipient = batch[batchIndex];
          if (result.status === "fulfilled") {
            sent += 1;
            console.info("marketing_email_sent", {
              userId: recipient.id,
              email: recipient.email,
              audience: parsed.data.audience || "all_active",
            });
            return;
          }
          const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
          failedEmails.push({ email: recipient.email!, error: message });
          console.error("marketing_email_failed", {
            userId: recipient.id,
            email: recipient.email,
            audience: parsed.data.audience || "all_active",
            error: message,
          });
        });

        if (index + batchSize < dedupedRecipients.length) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }

      res.json({
        audience: parsed.data.audience || "all_active",
        totalIntendedRecipients: audienceRows.length,
        totalSent: sent,
        totalSkipped: skipped.length,
        skippedBreakdown: skipped.reduce<Record<string, number>>((acc, entry) => {
          acc[entry.reason] = (acc[entry.reason] || 0) + 1;
          return acc;
        }, {}),
        failedCount: failedEmails.length,
        failedEmails,
      });
    } catch (error) {
      console.error("Failed to send marketing emails:", error);
      res.status(500).json({ error: "Failed to send marketing emails" });
    }
  });

  app.get("/api/admin/users", isAuthenticated, requireUsersAdmin, async (req, res) => {
    try {
      const query = ((req.query.q as string) || "").trim();
      const normalized = query.toLowerCase();
      if (!query || (!normalized.startsWith("id:") && !normalized.includes("@") && query.length < 2)) {
        return res.json([]);
      }
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

  app.delete("/api/admin/users/:userId", isAuthenticated, requireUsersAdmin, async (req: any, res) => {
    try {
      const requestingUserId = req.user?.claims?.sub || req.session?.userId;
      const requestingUser = requestingUserId ? await storage.getUser(String(requestingUserId)) : null;
      if (!requestingUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (!requestingUser.isSuperAdmin) {
        return res.status(403).json({ error: "Super Admin required to delete user accounts" });
      }
      if (String(requestingUserId) === req.params.userId) {
        return res.status(400).json({ error: "You cannot delete your own account from admin" });
      }

      const targetUser = await storage.getUser(req.params.userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      if (targetUser.isSuperAdmin) {
        return res.status(403).json({ error: "Cannot delete another super admin account" });
      }

      const deleted = await storage.deleteUser(req.params.userId);
      if (!deleted) {
        return res.status(500).json({ error: "Failed to delete user account" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Admin delete user error:", error);
      res.status(500).json({ error: "Failed to delete user account" });
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

  app.post("/api/admin/users/:userId/membership-grant", isAuthenticated, requireUsersAdmin, async (req: any, res) => {
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
          membershipGrantTier: null,
          membershipGrantEndsAt: null,
          membershipGrantGrantedBy: String(adminId),
          membershipGrantGrantedAt: new Date(),
          membershipGrantReason: null,
        });
        return res.json({ membershipGrantEndsAt: null, user: updated });
      }

      const tier = req.body?.tier === "pro" ? "pro" : req.body?.tier === "pro_plus" ? "pro_plus" : null;
      if (!tier) {
        return res.status(400).json({ error: "Tier must be pro or pro_plus" });
      }

      const durationDays = Number(req.body?.durationDays || 14);
      if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 365) {
        return res.status(400).json({ error: "durationDays must be between 1 and 365" });
      }

      const reason =
        typeof req.body?.reason === "string" && req.body.reason.trim()
          ? req.body.reason.trim().slice(0, 500)
          : null;

      const now = new Date();
      const grantEndsAt = addDays(now, durationDays);
      const updated = await storage.updateUser(req.params.userId, {
        membershipGrantTier: tier,
        membershipGrantEndsAt: grantEndsAt,
        membershipGrantGrantedBy: String(adminId),
        membershipGrantGrantedAt: now,
        membershipGrantReason: reason,
      });

      const tierLabel = tier === "pro_plus" ? "RSF Pro+" : "RSF Pro Core";
      await storage.createUserNotification({
        userId: req.params.userId,
        type: "membership_grant",
        title: `${tierLabel} access granted`,
        message: `RSF upgraded your account to ${tierLabel} for ${durationDays} day${durationDays === 1 ? "" : "s"}. Access is scheduled to end on ${grantEndsAt.toLocaleString()}.`,
        channels: targetUser.email ? ["in_app", "email"] : ["in_app"],
        referenceDate: null,
        meta: {
          tier,
          durationDays,
          grantEndsAt: grantEndsAt.toISOString(),
          grantedBy: String(adminId),
          reason: reason || undefined,
        },
      });

      if (targetUser.email) {
        void sendMembershipGrantEmail({
          email: targetUser.email,
          firstName: targetUser.firstName,
          tier,
          durationDays,
          endsAt: grantEndsAt,
          reason,
        }).catch((error) => {
          console.error("Membership grant email delivery failed:", error);
        });
      }

      res.json({
        membershipGrantTier: tier,
        membershipGrantEndsAt: grantEndsAt.toISOString(),
        user: updated,
      });
    } catch (error) {
      console.error("Error granting membership support access:", error);
      res.status(500).json({ error: "Failed to update membership support access" });
    }
  });

  app.get("/api/admin/users/:userId/cfi-profile", isAuthenticated, requireUsersAdmin, async (req: any, res) => {
    try {
      const profile = await storage.getCfiProfileByUser(req.params.userId);
      if (!profile) {
        return res.json({
          profile: null,
          credentials: [],
          credentialReadiness: getCfiVerificationReadiness([]),
        });
      }

      const credentials = await storage.getCfiCredentials(profile.id);
      res.json({
        profile,
        credentials,
        credentialReadiness: getCfiVerificationReadiness(credentials),
      });
    } catch (error) {
      console.error("Failed to fetch admin CFI profile data:", error);
      res.status(500).json({ error: "Failed to load CFI profile" });
    }
  });

  app.patch("/api/admin/cfi-profiles/:profileId/verification", isAuthenticated, requireUsersAdmin, async (req: any, res) => {
    try {
      const adminId = req.user?.claims?.sub || req.session?.userId;
      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const payload = z
        .object({ action: z.enum(["verify", "unverify"]) })
        .safeParse(req.body);
      if (!payload.success) {
        return res.status(400).json({ error: payload.error.format() });
      }

      const profile = await storage.getCfiProfileById(req.params.profileId);
      if (!profile) {
        return res.status(404).json({ error: "CFI profile not found" });
      }

      if (payload.data.action === "verify") {
        const credentials = await storage.getCfiCredentials(profile.id);
        const readiness = getCfiVerificationReadiness(credentials);
        if (!readiness.isReady) {
          return res.status(400).json({
            error: "Required credentials are missing",
            missing: readiness.checks.filter((check) => !check.met).map((check) => check.label),
          });
        }
      }

      const updates =
        payload.data.action === "verify"
          ? {
              isVerified: true,
              verifiedAt: new Date(),
              verifiedByUserId: String(adminId),
            }
          : {
              isVerified: false,
              verifiedAt: null,
              verifiedByUserId: null,
            };

      const updated = await storage.updateCfiProfile(profile.id, profile.userId, updates);
      res.json(updated);
    } catch (error) {
      console.error("Failed to update CFI verification status:", error);
      res.status(500).json({ error: "Failed to update CFI verification status" });
    }
  });

  const adminInviteSchema = z.object({
    email: z.string().email(),
    role: z.enum(["operations", "finance", "sales", "support", "content"]),
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

  app.post("/api/analytics/event", analyticsRateLimiter, async (req: any, res) => {
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

  app.post("/api/analytics/session", analyticsRateLimiter, async (req: any, res) => {
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

  app.get("/api/crm/leads/import-template", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const format = String(req.query.format || "csv").toLowerCase();
      if (format === "xlsx") {
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader("Content-Disposition", 'attachment; filename="rsf-crm-leads-template.xlsx"');
        return res.send(buildCrmLeadTemplateXlsx());
      }

      if (format !== "csv") {
        return res.status(400).json({ error: "Unsupported template format" });
      }

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="rsf-crm-leads-template.csv"');
      res.send(buildCrmLeadTemplateCsv());
    } catch (error) {
      console.error("CRM lead template export failed:", error);
      res.status(500).json({ error: "Failed to export CRM lead template" });
    }
  });

  app.post("/api/crm/leads/import-preview", isAuthenticated, requireCrmAdmin, crmLeadImportUpload.single("file"), async (req: any, res) => {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        return res.status(400).json({ error: "No CRM lead file uploaded" });
      }

      const rows = parseCrmLeadImportFile(file.originalname, file.buffer);
      const { imported, skipped } = mapImportedCrmLeadRows(rows);
      const existingLeads = await storage.getAllLeads();
      const duplicates = findCrmLeadImportDuplicates(imported, existingLeads);

      res.json({
        success: true,
        fileName: file.originalname,
        totalRows: rows.length,
        importableCount: imported.length,
        duplicateCount: duplicates.length,
        skippedCount: skipped.length,
        skipped,
        duplicates,
      });
    } catch (error: any) {
      console.error("CRM lead import preview failed:", error);
      res.status(400).json({ error: error?.message || "Failed to preview CRM leads" });
    }
  });

  app.post("/api/crm/leads/import", isAuthenticated, requireCrmAdmin, crmLeadImportUpload.single("file"), async (req: any, res) => {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        return res.status(400).json({ error: "No CRM lead file uploaded" });
      }

      const rows = parseCrmLeadImportFile(file.originalname, file.buffer);
      const { imported, skipped } = mapImportedCrmLeadRows(rows);
      const excludedRowNumbers = parseCrmImportExcludedRows(req.body?.excludedRowNumbers);
      const seenEmails = new Set<string>();
      const skippedRows = [...skipped];
      let createdCount = 0;
      let updatedCount = 0;

      for (const row of imported) {
        if (excludedRowNumbers.has(row.rowNumber)) {
          skippedRows.push({ rowNumber: row.rowNumber, reason: "Skipped by user during duplicate review" });
          continue;
        }
        const email = row.lead.email.toLowerCase();
        if (seenEmails.has(email)) {
          skippedRows.push({ rowNumber: row.rowNumber, reason: "Duplicate email in import file" });
          continue;
        }
        seenEmails.add(email);

        const existingLead = await storage.getLeadByEmail(email);
        if (existingLead) {
          await storage.updateLead(
            existingLead.id,
            mergeImportedLeadData(existingLead, row),
          );
          updatedCount += 1;
        } else {
          await storage.createLead(row.lead);
          createdCount += 1;
        }
      }

      res.json({
        success: true,
        fileName: file.originalname,
        totalRows: rows.length,
        createdCount,
        updatedCount,
        skippedCount: skippedRows.length,
        skipped: skippedRows,
      });
    } catch (error: any) {
      console.error("CRM lead import failed:", error);
      res.status(400).json({ error: error?.message || "Failed to import CRM leads" });
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

  app.post("/api/crm/leads/:id/resubscribe-email", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const lead = await storage.resubscribeLeadEmail(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json({ success: true, lead });
    } catch (error) {
      console.error("CRM resubscribe error:", error);
      res.status(500).json({ error: "Failed to resubscribe lead email" });
    }
  });

  app.post("/api/crm/campaigns/platform-overview/preview", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const campaignInput = parseCrmCampaignRequest(req.body);
      const audience = await buildCrmCampaignAudience(campaignInput);
      const sampleLead = audience.eligibleLeads[0] || audience.matchedLeads[0];
      const sampleToken = signMarketingToken({
        action: "crm_sales_opt_out",
        leadId: sampleLead?.id || "preview-lead",
        email: sampleLead?.email || "preview@readysetfly.us",
      });
      const unsubscribeUrl = `${getPublicBaseUrl()}/api/marketing/unsubscribe?token=${encodeURIComponent(sampleToken)}`;

      const previewData = {
        firstName: sampleLead?.firstName || "Aviation",
        lastName: sampleLead?.lastName || "Business",
        company: sampleLead?.company || "Your Company",
        unsubscribeUrl,
        templateType: campaignInput.templateType,
        promoCode: campaignInput.promoCode,
        promoDetails: campaignInput.promoDetails,
        subjectOverride: campaignInput.subjectOverride,
        introOverride: campaignInput.introOverride,
        customNote: campaignInput.customNote,
      };

      res.json({
        summary: audience.summary,
        subject: getCrmPlatformOverviewEmailSubject(previewData),
        html: getCrmPlatformOverviewEmailHtml(previewData),
        text: getCrmPlatformOverviewEmailText(previewData),
        recipientsPreview: audience.eligibleLeads.slice(0, 10).map((lead) => ({
          id: lead.id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          company: lead.company,
          category: lead.category,
          status: lead.status,
          salesEmailLastSentAt: lead.salesEmailLastSentAt,
        })),
      });
    } catch (error: any) {
      console.error("Failed to build CRM campaign preview:", error);
      res.status(400).json({ error: error?.message || "Failed to build CRM campaign preview" });
    }
  });

  app.post("/api/crm/campaigns/platform-overview/send", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const campaignInput = parseCrmCampaignRequest(req.body);
      const audience = await buildCrmCampaignAudience(campaignInput);
      const { client } = await getUncachableResendClient();
      const crmSalesFromEmail = process.env.SUPPORT_EMAIL || "Ready Set Fly <support@readysetfly.us>";
      const errors: string[] = [];
      let emailsSent = 0;

      for (const lead of audience.eligibleLeads) {
        const token = signMarketingToken({
          action: "crm_sales_opt_out",
          leadId: lead.id,
          email: lead.email,
        });
        const unsubscribeUrl = `${getPublicBaseUrl()}/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`;

        try {
          await client.emails.send({
            from: crmSalesFromEmail,
            replyTo: crmSalesFromEmail,
            to: lead.email,
            subject: getCrmPlatformOverviewEmailSubject({
              firstName: lead.firstName,
              lastName: lead.lastName,
              company: lead.company,
              unsubscribeUrl,
              templateType: campaignInput.templateType,
              promoCode: campaignInput.promoCode,
              promoDetails: campaignInput.promoDetails,
              subjectOverride: campaignInput.subjectOverride,
              introOverride: campaignInput.introOverride,
              customNote: campaignInput.customNote,
            }),
            html: getCrmPlatformOverviewEmailHtml({
              firstName: lead.firstName,
              lastName: lead.lastName,
              company: lead.company,
              unsubscribeUrl,
              templateType: campaignInput.templateType,
              promoCode: campaignInput.promoCode,
              promoDetails: campaignInput.promoDetails,
              subjectOverride: campaignInput.subjectOverride,
              introOverride: campaignInput.introOverride,
              customNote: campaignInput.customNote,
            }),
            text: getCrmPlatformOverviewEmailText({
              firstName: lead.firstName,
              lastName: lead.lastName,
              company: lead.company,
              unsubscribeUrl,
              templateType: campaignInput.templateType,
              promoCode: campaignInput.promoCode,
              promoDetails: campaignInput.promoDetails,
              subjectOverride: campaignInput.subjectOverride,
              introOverride: campaignInput.introOverride,
              customNote: campaignInput.customNote,
            }),
          });

          await storage.updateLead(lead.id, {
            salesEmailLastSentAt: new Date(),
          });
          emailsSent += 1;
        } catch (error: any) {
          console.error(`Failed to send CRM campaign email to ${lead.email}:`, error);
          errors.push(`${lead.email}: ${error?.message || "send failed"}`);
        }
      }

      res.json({
        success: true,
        audience: audience.summary,
        emailsSent,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error("Failed to send CRM campaign:", error);
      res.status(400).json({ error: error?.message || "Failed to send CRM campaign" });
    }
  });

  app.post("/api/crm/leads/:id/sales-email-preview", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const category = (lead.category || "other") as LeadCategory;
      const templateInput = parseCrmSalesTemplateInput(req.body);
      const token = signMarketingToken({
        action: "crm_sales_opt_out",
        leadId: lead.id,
        email: lead.email,
      });
      const unsubscribeUrl = `${getPublicBaseUrl()}/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`;

      res.json({
        subject: getCrmLeadSalesEmailSubject(category, {
          firstName: lead.firstName,
          lastName: lead.lastName,
          company: lead.company,
          unsubscribeUrl,
          ...templateInput,
        }),
        html: getCrmLeadSalesEmailHtml(category, {
          firstName: lead.firstName,
          lastName: lead.lastName,
          company: lead.company,
          unsubscribeUrl,
          ...templateInput,
        }),
        text: getCrmLeadSalesEmailText(category, {
          firstName: lead.firstName,
          lastName: lead.lastName,
          company: lead.company,
          unsubscribeUrl,
          ...templateInput,
        }),
      });
    } catch (error: any) {
      console.error("Failed to build CRM sales email preview:", error);
      res.status(400).json({ error: error?.message || "Failed to build email preview" });
    }
  });

  app.post("/api/crm/leads/:id/send-sales-email", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      if (!lead.email) {
        return res.status(400).json({ error: "Lead is missing an email address" });
      }

      const suppressedByEmail = await storage.isLeadEmailSuppressed(lead.email);
      if (!canSendEmail(lead) || suppressedByEmail) {
        return res.status(409).json({ error: "Lead has unsubscribed from CRM sales emails" });
      }

      const category = (lead.category || "other") as LeadCategory;
      const templateInput = parseCrmSalesTemplateInput(req.body);
      const token = signMarketingToken({
        action: "crm_sales_opt_out",
        leadId: lead.id,
        email: lead.email,
      });
      const unsubscribeUrl = `${getPublicBaseUrl()}/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`;
      const { client } = await getUncachableResendClient();
      const crmSalesFromEmail = process.env.SUPPORT_EMAIL || "Ready Set Fly <support@readysetfly.us>";

      await client.emails.send({
        from: crmSalesFromEmail,
        to: lead.email,
        subject: getCrmLeadSalesEmailSubject(category, {
          firstName: lead.firstName,
          lastName: lead.lastName,
          company: lead.company,
          unsubscribeUrl,
          ...templateInput,
        }),
        html: getCrmLeadSalesEmailHtml(category, {
          firstName: lead.firstName,
          lastName: lead.lastName,
          company: lead.company,
          unsubscribeUrl,
          ...templateInput,
        }),
        text: getCrmLeadSalesEmailText(category, {
          firstName: lead.firstName,
          lastName: lead.lastName,
          company: lead.company,
          unsubscribeUrl,
          ...templateInput,
        }),
        replyTo: crmSalesFromEmail,
      });

      const updatedLead = await storage.updateLead(lead.id, {
        salesEmailLastSentAt: new Date(),
      });

      res.json({
        success: true,
        lead: updatedLead ?? lead,
      });
    } catch (error: any) {
      console.error("Failed to send CRM sales email:", error);
      const status = error?.message === "Invalid CRM sales email template" ? 400 : 500;
      res.status(status).json({ error: error?.message || "Failed to send sales email" });
    }
  });

  app.delete("/api/crm/leads/:id", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      if (lead.emailUnsubscribed || lead.marketingEmailOptOutAt) {
        return res.status(409).json({ error: "Suppressed leads cannot be deleted" });
      }

      const success = await storage.deleteLead(req.params.id);
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

  app.get("/api/crm/weekly-reports", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const reports = await storage.getAllWeeklyReports();
      res.json(reports);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch weekly reports" });
    }
  });

  app.post("/api/crm/weekly-reports", isAuthenticated, requireCrmAdmin, async (req: any, res) => {
    try {
      const parsed = insertCrmWeeklyReportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid weekly report", details: parsed.error.flatten() });
      }

      const report = await storage.createWeeklyReport({
        ...parsed.data,
        preparedBy: req.user.claims.sub,
      });
      res.json(report);
    } catch (error) {
      console.error("Failed to create CRM weekly report:", error);
      res.status(500).json({ error: "Failed to create weekly report" });
    }
  });

  app.patch("/api/crm/weekly-reports/:id", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const parsed = insertCrmWeeklyReportSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid weekly report update", details: parsed.error.flatten() });
      }

      const report = await storage.updateWeeklyReport(req.params.id, parsed.data);
      if (!report) {
        return res.status(404).json({ error: "Weekly report not found" });
      }
      res.json(report);
    } catch (error) {
      console.error("Failed to update CRM weekly report:", error);
      res.status(500).json({ error: "Failed to update weekly report" });
    }
  });

  app.delete("/api/crm/weekly-reports/:id", isAuthenticated, requireCrmAdmin, async (req, res) => {
    try {
      const success = await storage.deleteWeeklyReport(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Weekly report not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete CRM weekly report:", error);
      res.status(500).json({ error: "Failed to delete weekly report" });
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

  // Promo Codes (Admin only)
  app.get("/api/admin/membership-partner-offers", isAuthenticated, requireUsersAdmin, async (req: any, res) => {
    try {
      const adminId = getRequestUserId(req);
      const admin = adminId ? await storage.getUser(adminId) : null;
      if (!admin || !admin.isSuperAdmin) {
        return res.status(403).json({ error: "Super Admin required" });
      }
      const offers = await storage.getAllMembershipPartnerOffers();
      const summaries = await Promise.all(offers.map((offer) => getMembershipPartnerOfferSummary(offer)));
      res.json(summaries);
    } catch (error) {
      console.error("Failed to fetch membership partner offers:", error);
      res.status(500).json({ error: "Failed to fetch membership partner offers" });
    }
  });

  app.post("/api/admin/membership-partner-offers", isAuthenticated, requireUsersAdmin, async (req: any, res) => {
    try {
      const adminId = getRequestUserId(req);
      const admin = adminId ? await storage.getUser(adminId) : null;
      if (!admin || !admin.isSuperAdmin) {
        return res.status(403).json({ error: "Super Admin required" });
      }

      const result = membershipPartnerOfferPayloadSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }

      const members = parseMembershipPartnerMembers(result.data.memberNumbersText);

      const normalizedSlug = normalizeMembershipOfferSlug(result.data.slug);
      if (!normalizedSlug) {
        return res.status(400).json({ error: "Offer slug must contain letters or numbers" });
      }

      const { memberNumbersText, ...offerInput } = result.data;
      const created = await storage.createMembershipPartnerOffer({
        ...offerInput,
        slug: normalizedSlug,
        createdBy: adminId || undefined,
      });
      if (members.length) {
        await storage.addMembershipPartnerOfferMembers(created.id, members);
      }
      res.status(201).json(await getMembershipPartnerOfferSummary(created));
    } catch (error: any) {
      if (error.code === "23505") {
        return res.status(400).json({ error: "Offer slug already exists" });
      }
      console.error("Failed to create membership partner offer:", error);
      res.status(500).json({ error: "Failed to create membership partner offer" });
    }
  });

  app.patch("/api/admin/membership-partner-offers/:id", isAuthenticated, requireUsersAdmin, async (req: any, res) => {
    try {
      const adminId = getRequestUserId(req);
      const admin = adminId ? await storage.getUser(adminId) : null;
      if (!admin || !admin.isSuperAdmin) {
        return res.status(403).json({ error: "Super Admin required" });
      }

      const result = membershipPartnerOfferUpdateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }

      const existing = await storage.getMembershipPartnerOffer(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Offer not found" });
      }

      const { memberNumbersText, ...updates } = result.data;
      const normalizedUpdates = {
        ...updates,
        ...(typeof updates.slug === "string" ? { slug: normalizeMembershipOfferSlug(updates.slug) } : {}),
      };
      if (typeof normalizedUpdates.slug === "string" && !normalizedUpdates.slug) {
        return res.status(400).json({ error: "Offer slug must contain letters or numbers" });
      }
      const updated = await storage.updateMembershipPartnerOffer(req.params.id, normalizedUpdates);
      if (!updated) {
        return res.status(404).json({ error: "Offer not found" });
      }

      const members = parseMembershipPartnerMembers(memberNumbersText);
      if (members.length) {
        await storage.addMembershipPartnerOfferMembers(updated.id, members);
      }

      res.json(await getMembershipPartnerOfferSummary(updated));
    } catch (error: any) {
      if (error.code === "23505") {
        return res.status(400).json({ error: "Offer slug already exists" });
      }
      console.error("Failed to update membership partner offer:", error);
      res.status(500).json({ error: "Failed to update membership partner offer" });
    }
  });

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

  app.patch("/api/admin/notifications/:id/unread", isAuthenticated, requireNotificationsAdmin, async (req, res) => {
    try {
      const notification = await storage.markNotificationAsUnread(req.params.id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to reopen notification" });
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

  // Middleware chain: cloudflareGuard (global) → impressionRateLimiter → impressionDedup → handler
  app.post("/api/banner-ads/:id/impression", bannerImpressionRateLimiter, impressionRateLimiter, impressionDedup, async (req, res) => {
    try {
      const ip = req.clientIP || req.ip || 'unknown';
      const bannerId = req.params.id;

      // Bot/scraper filter — silent pass-through, don't count
      const userAgent = req.headers['user-agent'] || '';
      const isSuspiciousAgent =
        !userAgent ||
        /bot|crawler|spider|Go-http|python|curl/i.test(userAgent);

      if (isSuspiciousAgent) {
        return res.status(200).json({ counted: false, reason: 'bot' });
      }

      await storage.incrementBannerImpressions(bannerId);
      console.log(`[IMPRESSION] Counted: adId=${bannerId} ip=${ip}`);
      res.json({ counted: true });
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
    "homeBase",
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

  function getFreshCachedMetar(candidate: string): any | null {
    const cached = weatherCache.get(candidate);
    if (!cached) return null;
    if ((Date.now() - cached.timestamp) >= WEATHER_CACHE_TTL) return null;
    return cached.data?.metar ?? null;
  }

  async function primeMetarsForNearbyCandidates(candidates: string[]): Promise<Map<string, any>> {
    const metars = new Map<string, any>();
    const normalizedCandidates = Array.from(
      new Set(
        candidates
          .map((value) => normalizeIcao(value))
          .filter((value): value is string => Boolean(value))
      )
    );

    const missing: string[] = [];
    for (const candidate of normalizedCandidates) {
      const cachedMetar = getFreshCachedMetar(candidate);
      if (cachedMetar) {
        metars.set(candidate, cachedMetar);
      } else {
        missing.push(candidate);
      }
    }

    if (missing.length === 0) {
      return metars;
    }

    const metarRes = await fetchWithTimeout(
      `https://aviationweather.gov/api/data/metar?ids=${missing.join(",")}&format=json`,
      { headers: { "User-Agent": "ReadySetFly/1.0" } },
      2500
    ).catch(() => null);

    if (!metarRes || !metarRes.ok) {
      return metars;
    }

    const body = await metarRes.text().catch(() => "");
    const trimmed = body.trim();
    if (!trimmed || trimmed.startsWith("<")) {
      return metars;
    }

    try {
      const metarData = JSON.parse(trimmed);
      const rows = Array.isArray(metarData) ? metarData : [];
      const now = Date.now();
      for (const row of rows) {
        const icao = normalizeIcao(
          String(row?.icaoId || row?.icao || row?.stationId || row?.station || "")
        );
        if (!icao) continue;
        metars.set(icao, row);
        weatherCache.set(icao, {
          data: { icao, metar: row, taf: null, cached: false },
          timestamp: now,
        });
      }

      while (weatherCache.size > 100) {
        const oldestKey = weatherCache.keys().next().value as string | undefined;
        if (!oldestKey) break;
        weatherCache.delete(oldestKey);
      }
    } catch {
      // Ignore malformed batched METAR payloads for nearby enrichment.
    }

    return metars;
  }

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

  app.get("/api/airports/search", airportSearchRateLimiter, airportSearchPublicReadRateLimiter, async (req, res) => {
    try {
      const rawQuery = String(req.query.q || "");
      const query = normalizeSearch(rawQuery);
      if (!query || query.length < 2) {
        return res.json([]);
      }

      res.setHeader("x-rsf-airport-search", "1");
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=1800");
      const cacheKey = query;
      const cachedPayload = await getCachedAirportSearchPayload(cacheKey);
      if (cachedPayload) {
        return res.json(cachedPayload);
      }

      const inFlight = airportSearchInFlight.get(cacheKey);
      if (inFlight) {
        return res.json(await inFlight);
      }

      const buildPromise = (async () => {
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
        await setCachedAirportSearchPayload(cacheKey, results);
        return results;
      })();

      airportSearchInFlight.set(cacheKey, buildPromise);
      const results = await buildPromise.finally(() => {
        airportSearchInFlight.delete(cacheKey);
      });
      return res.json(results);
    } catch (error) {
      console.error("Airport search failed:", error);
      res.status(500).json({ error: "Failed to search airports" });
    }
  });

  app.get("/api/airports/nearby", nearbyAirportReadRateLimiter, async (req, res) => {
    try {
      const lat = toNumber(req.query.lat);
      const lon = toNumber(req.query.lon);
      const radiusNm = Math.max(10, Math.min(250, toNumber(req.query.radiusNm) ?? 60));
      const limit = Math.max(3, Math.min(15, Math.round(toNumber(req.query.limit) ?? 8)));
      if (lat === null || lon === null) {
        return res.status(400).json({ error: "lat and lon are required" });
      }
      res.setHeader("Cache-Control", "public, max-age=20, stale-while-revalidate=60");
      const cacheKey = getNearbyAirportCacheKey(lat, lon, radiusNm, limit);
      const cachedPayload = await getCachedNearbyAirportPayload<any>(cacheKey);
      if (cachedPayload) {
        return res.json(cachedPayload);
      }

      const buildPayload = async () => {
        const [stations, runwayMap, frequencyMap] = await Promise.all([
          loadStationCache(),
          loadRunwayCache().catch(() => null),
          loadAirportFrequencyCache().catch(() => null),
        ]);

        const deduped = new Map<string, AirportSearchResult>();
        for (const station of stations) {
          const icao = normalizeIcao(station.icao);
          if (!icao || deduped.has(icao)) continue;
          deduped.set(icao, station);
        }

        const provisional: Array<{
          station: AirportSearchResult;
          distanceNm: number;
          bearingDeg: number;
          maxRunwayFt: number | null;
          surfaces: string[];
          frequencySummary: Array<{
            type: string | null;
            description: string | null;
            frequencyMhz: number | null;
          }>;
          towered: boolean;
        }> = [];
        for (const station of Array.from(deduped.values())) {
          const distanceNm = distanceNmBetween(lat, lon, station.lat, station.lon);
          if (!Number.isFinite(distanceNm) || distanceNm > radiusNm) continue;

          const runwayCandidates = runwayMap ? buildIcaoCandidates(station.icao).flatMap((candidate) => runwayMap.get(candidate) || []) : [];
          if (runwayMap && runwayCandidates.length === 0) continue;

          const maxRunwayFt = runwayCandidates
            .map((runway) => runway.lengthFt)
            .filter((value): value is number => Number.isFinite(value ?? NaN))
            .reduce<number | null>((best, value) => (best === null || value > best ? value : best), null);
          const surfaces = Array.from(
            new Set(
              runwayCandidates
                .map((runway) => String(runway.surface || "").trim().toUpperCase())
                .filter(Boolean)
            )
          ).slice(0, 3);

          const frequencies = frequencyMap
            ? buildIcaoCandidates(station.icao).flatMap((candidate) => frequencyMap.get(candidate) || [])
            : [];
          const frequencySummary = Array.from(
            new Map(
              frequencies.map((item) => [
                `${item.type || ""}|${item.description || ""}|${item.frequencyMhz || ""}`,
                item,
              ])
            ).values()
          )
            .sort((a, b) => {
              const byPriority = airportFrequencyPriority(a.type) - airportFrequencyPriority(b.type);
              if (byPriority !== 0) return byPriority;
              return String(a.type || "").localeCompare(String(b.type || ""));
            })
            .slice(0, 3)
            .map((item) => ({
              type: item.type,
              description: item.description,
              frequencyMhz: item.frequencyMhz,
            }));
          const towered = frequencies.some((item) => isToweredFrequencyType(item.type, item.description));

          provisional.push({
            station,
            distanceNm: Number(distanceNm.toFixed(1)),
            bearingDeg: Math.round(bearingBetween(lat, lon, station.lat, station.lon)),
            maxRunwayFt,
            surfaces,
            frequencySummary,
            towered,
          });
        }

        provisional.sort((a, b) => {
          const runwayDelta = (b.maxRunwayFt ?? 0) - (a.maxRunwayFt ?? 0);
          if (Math.abs(a.distanceNm - b.distanceNm) <= 3 && runwayDelta !== 0) {
            return runwayDelta;
          }
          return a.distanceNm - b.distanceNm;
        });

        const enrichmentCandidates = provisional.slice(0, Math.max(limit + 2, 6));
        const metarsByIcao = await primeMetarsForNearbyCandidates(
          enrichmentCandidates.map((candidate) => buildIcaoCandidates(candidate.station.icao)[0] || candidate.station.icao)
        );
        const enrichedCandidates = await Promise.all(
          enrichmentCandidates.map(async (candidate) => {
            let metar: any | null = null;
            for (const icaoCandidate of buildIcaoCandidates(candidate.station.icao)) {
              metar = metarsByIcao.get(icaoCandidate) || getFreshCachedMetar(icaoCandidate);
              if (metar) break;
            }

            const runwayCandidates = runwayMap
              ? buildIcaoCandidates(candidate.station.icao).flatMap((icaoCandidate) => runwayMap.get(icaoCandidate) || [])
              : [];
            const wind = metar ? parseMetarWind(metar) : { direction: null, speed: null, gust: null };
            const advisory =
              metar &&
              wind.direction !== null &&
              wind.speed !== null &&
              runwayCandidates.length > 0
                ? computeRunwayAdvisory(runwayCandidates, wind.direction, wind.speed)
                : null;
            const flightCategory = metar ? computeFlightCategory(metar) : null;

            let score = 100 - candidate.distanceNm;
            const scoreReasons: string[] = [];
            const immediateReasons: string[] = [];

            if (candidate.maxRunwayFt !== null) {
              if (candidate.maxRunwayFt >= 5000) {
                score += 18;
                scoreReasons.push("long runway");
              } else if (candidate.maxRunwayFt >= 3500) {
                score += 10;
                scoreReasons.push("usable runway");
              }
              if (candidate.maxRunwayFt >= 3500) {
                immediateReasons.push("runway length");
              }
            }

            if (candidate.towered) {
              score += 10;
              scoreReasons.push("towered field");
              immediateReasons.push("tower support");
            }

            if (flightCategory === "VFR") {
              score += 8;
              scoreReasons.push("VFR weather");
              immediateReasons.push("VFR weather");
            } else if (flightCategory === "MVFR") {
              score += 3;
              scoreReasons.push("MVFR weather");
              immediateReasons.push("MVFR weather");
            } else if (flightCategory === "IFR") {
              score -= 8;
            } else if (flightCategory === "LIFR") {
              score -= 16;
            }

            if (advisory) {
              score += Math.max(-8, Math.min(8, advisory.headwind * 0.6 - advisory.crosswind * 0.5));
              if (advisory.crosswind <= 8) {
                scoreReasons.push("better wind alignment");
                immediateReasons.push("lower crosswind");
              }
            }

            if (candidate.distanceNm <= 20) {
              immediateReasons.push("very close");
            } else if (candidate.distanceNm <= 35) {
              immediateReasons.push("close");
            }

            const immediateReady =
              candidate.distanceNm <= 35 &&
              (candidate.maxRunwayFt ?? 0) >= 3000 &&
              (flightCategory === null || flightCategory === "VFR" || flightCategory === "MVFR") &&
              (!advisory || advisory.crosswind <= 15);

            return {
              ...candidate.station,
              distanceNm: candidate.distanceNm,
              bearingDeg: candidate.bearingDeg,
              maxRunwayFt: candidate.maxRunwayFt,
              surfaces: candidate.surfaces,
              towered: candidate.towered,
              score: Number(score.toFixed(1)),
              scoreReasons: scoreReasons.slice(0, 3),
              immediateReady,
              immediateReasons: Array.from(new Set(immediateReasons)).slice(0, 4),
              flightCategory,
              runwayAdvisory: advisory
                ? {
                    runway: advisory.runway,
                    headwindKt: Number(advisory.headwind.toFixed(1)),
                    crosswindKt: Number(advisory.crosswind.toFixed(1)),
                  }
                : null,
              frequencySummary: candidate.frequencySummary,
            } satisfies NearbyAirportResult;
          })
        );

        const candidates = enrichedCandidates.sort((a, b) => {
          const byScore = b.score - a.score;
          if (Math.abs(byScore) > 0.25) return byScore;
          return a.distanceNm - b.distanceNm;
        });

        return {
          lat,
          lon,
          radiusNm,
          airports: candidates.slice(0, limit),
        };
      };

      const inFlight = nearbyAirportInFlight.get(cacheKey);
      if (inFlight) {
        const payload = await inFlight;
        return res.json(payload);
      }

      const buildPromise = buildPayload();
      nearbyAirportInFlight.set(cacheKey, buildPromise);
      const payload = await buildPromise;
      nearbyAirportInFlight.delete(cacheKey);
      await setCachedNearbyAirportPayload(cacheKey, payload);
      return res.json(payload);
    } catch (error) {
      if (error && typeof req.query.lat !== "undefined" && typeof req.query.lon !== "undefined") {
        const lat = toNumber(req.query.lat);
        const lon = toNumber(req.query.lon);
        const radiusNm = Math.max(10, Math.min(250, toNumber(req.query.radiusNm) ?? 60));
        const limit = Math.max(3, Math.min(15, Math.round(toNumber(req.query.limit) ?? 8)));
        if (lat !== null && lon !== null) {
          nearbyAirportInFlight.delete(getNearbyAirportCacheKey(lat, lon, radiusNm, limit));
        }
      }
      console.error("Nearby airport search failed:", error);
      res.status(500).json({ error: "Failed to search nearby airports" });
    }
  });

  app.get("/api/airports/route-suggestions", routeSuggestionReadRateLimiter, async (req, res) => {
    try {
      const departure = normalizeIcao(String(req.query.departure || ""));
      const destination = normalizeIcao(String(req.query.destination || ""));
      const emptyResponse = {
        departure,
        destination,
        waypoints: [],
        plannedStops: [],
        coastlineWaypoints: [],
        coastlinePlannedStops: [],
        meta: null,
      };
      if (!/^[A-Z0-9]{3,4}$/.test(departure) || !/^[A-Z0-9]{3,4}$/.test(destination)) {
        return res.json(emptyResponse);
      }
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=1800");

      const cruiseKtas = Math.max(40, toNumber(req.query.cruiseKtas) ?? 110);
      const fuelBurnGph = Math.max(0.1, toNumber(req.query.fuelBurnGph) ?? 8);
      const usableFuelGal = Math.max(0, toNumber(req.query.usableFuelGal) ?? 40);
      const fuelOnBoard = toNumber(req.query.fuelOnBoard);
      const reserveMinutesRaw = toNumber(req.query.reserveMinutes);
      const reserveMinutes = Math.max(0, Math.min(180, reserveMinutesRaw ?? 45));
      const fuelGallons = Math.max(0, fuelOnBoard ?? usableFuelGal);
      const routeCacheKey = getRouteSuggestionCacheKey({
        departure,
        destination,
        cruiseKtas,
        fuelBurnGph,
        usableFuelGal,
        fuelGallons,
        reserveMinutes,
      });
      const cachedRoutePayload = await getCachedMapPayload<any>(
        routeSuggestionCache,
        routeCacheKey,
        ROUTE_SUGGESTION_CACHE_TTL_MS,
        "route-suggestions",
      );
      if (cachedRoutePayload) {
        return res.json(cachedRoutePayload);
      }

      const inFlight = routeSuggestionInFlight.get(routeCacheKey);
      if (inFlight) {
        return res.json(await inFlight);
      }

      const buildPromise = (async () => {
        const stations = await loadStationCache();
        const referenceMap = await loadAirportReferenceCache().catch(() => null);
        const runwayMap = await loadRunwayCache().catch(() => null);
        const maxRunwayLengthFor = (icao: string) => {
          if (!runwayMap) return null;
          const candidates = buildIcaoCandidates(icao);
          for (const candidate of candidates) {
            const runways = runwayMap.get(candidate);
            if (!runways?.length) continue;
            const lengths = runways
              .map((runway) => runway.lengthFt)
              .filter((value): value is number => Number.isFinite(value ?? NaN));
            if (lengths.length > 0) {
              return Math.max(...lengths);
            }
          }
          return null;
        };
        const hasAnyRunway = (icao: string) => {
          if (!runwayMap) return true;
          return maxRunwayLengthFor(icao) !== null;
        };
        const hasFuelStopRunway = (icao: string) => {
          if (!runwayMap) return true;
          const maxRunway = maxRunwayLengthFor(icao);
          return maxRunway !== null && maxRunway >= 2500;
        };
        const routableStations = referenceMap
          ? stations.filter((station) => {
              if (!station?.icao) return false;
              const inReference =
                referenceMap.has(station.icao) ||
                (station.icao.startsWith("K") && referenceMap.has(station.icao.slice(1)));
              return inReference && hasAnyRunway(station.icao);
            })
          : stations;
        const fuelStopStations = routableStations.filter((station) => hasFuelStopRunway(station.icao));
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
          return {
            ...emptyResponse,
            departure: departureStation?.icao ?? departure,
            destination: destinationStation?.icao ?? destination,
          };
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
      const buildFractions = (count: number) =>
        count <= 0
          ? []
          : count === 1
            ? [0.5]
            : count === 2
              ? [0.35, 0.65]
              : count === 3
                ? [0.25, 0.5, 0.75]
                : [0.2, 0.4, 0.6, 0.8];

      const probeFractions = routeDistanceNm > 260 ? [0.3, 0.5, 0.7] : routeDistanceNm > 180 ? [0.5] : [];
      const probeHits = probeFractions.filter((fraction) => {
        const targetDistanceNm = routeDistanceNm * fraction;
        const target = destinationPoint(
          departureStation.lat,
          departureStation.lon,
          bearing,
          targetDistanceNm
        );
        return Boolean(
          findBestRouteAssistStation(
            fuelStopStations.length > 0 ? fuelStopStations : routableStations,
            departureStation,
            destinationStation,
            target,
            targetDistanceNm,
            new Set<string>([departureStation.icao, destinationStation.icao]),
            45,
          )
        );
      }).length;
      const likelyCoastalEndpoints = COASTAL_STATE_CODES.has(departureStation.state || "") || COASTAL_STATE_CODES.has(destinationStation.state || "");
      const overwaterLikely =
        routeDistanceNm >= 180 &&
        likelyCoastalEndpoints &&
        probeFractions.length > 0 &&
        probeHits < Math.max(1, Math.ceil(probeFractions.length / 2));

      const buildVariant = ({
        waypointTotal,
        stopTotal,
        waypointRadii,
        stopRadii,
      }: {
        waypointTotal: number;
        stopTotal: number;
        waypointRadii: number[];
        stopRadii: number[];
      }) => {
        const used = new Set<string>([departureStation.icao, destinationStation.icao]);
        const plannedStopsLocal: string[] = [];
        const waypointsLocal: string[] = [];
        const stopPool = fuelStopStations.length > 0 ? fuelStopStations : routableStations;

        const pickAtFraction = (
          fraction: number,
          pool: AirportSearchResult[],
          radii: number[],
          origin: AirportSearchResult = departureStation,
          destinationForLeg: AirportSearchResult = destinationStation,
          targetLegNm?: number | null,
        ) => {
          const legBearing = bearingBetween(
            origin.lat,
            origin.lon,
            destinationForLeg.lat,
            destinationForLeg.lon
          );
          const legDistanceNm = distanceNmBetween(
            origin.lat,
            origin.lon,
            destinationForLeg.lat,
            destinationForLeg.lon
          );
          const targetDistanceNm = legDistanceNm * fraction;
          const target = destinationPoint(
            origin.lat,
            origin.lon,
            legBearing,
            targetDistanceNm
          );
          for (const radius of radii) {
            const candidate = findBestRouteAssistStation(
              pool,
              origin,
              destinationForLeg,
              target,
              targetDistanceNm,
              used,
              radius,
              targetLegNm,
            );
            if (candidate) {
              used.add(candidate.icao);
              return candidate.icao;
            }
          }
          return null;
        };

        if (stopTotal > 0) {
          let legOrigin = departureStation;
          for (let i = 1; i <= stopTotal; i += 1) {
            const remainingStops = stopTotal - i;
            const remainingDistanceNm = distanceNmBetween(
              legOrigin.lat,
              legOrigin.lon,
              destinationStation.lat,
              destinationStation.lon
            );
            const targetLegNm = remainingDistanceNm / (remainingStops + 1);
            const fraction = Math.max(0.2, Math.min(0.8, remainingStops > 0 ? 1 / (remainingStops + 2) : 0.5));
            const suggestion = pickAtFraction(
              fraction,
              stopPool,
              stopRadii,
              legOrigin,
              destinationStation,
              targetLegNm,
            );
            if (suggestion) plannedStopsLocal.push(suggestion);
            const suggestionStation = suggestion ? findStation(suggestion) : null;
            if (suggestionStation) {
              legOrigin = suggestionStation;
            }
          }
        }

        for (const fraction of buildFractions(waypointTotal)) {
          const suggestion = pickAtFraction(fraction, routableStations, waypointRadii);
          if (suggestion) waypointsLocal.push(suggestion);
        }

        return {
          plannedStops: plannedStopsLocal,
          waypoints: waypointsLocal,
        };
      };

      const directVariant = buildVariant({
        waypointTotal: waypointCount,
        stopTotal: stopCount,
        waypointRadii: [60, 90, 120, 160],
        stopRadii: [60, 90, 120, 160],
      });

      const coastlineWaypointCount = overwaterLikely
        ? Math.max(waypointCount, routeDistanceNm > 350 ? 3 : 2)
        : waypointCount;
      const coastlineVariant = overwaterLikely
        ? buildVariant({
            waypointTotal: coastlineWaypointCount,
            stopTotal: stopCount,
            waypointRadii: [110, 150, 210, 270, 330],
            stopRadii: [90, 130, 180, 240, 300],
          })
        : { plannedStops: [] as string[], waypoints: [] as string[] };

        const payload = {
          departure: departureStation.icao,
          destination: destinationStation.icao,
          waypoints: directVariant.waypoints,
          plannedStops: directVariant.plannedStops,
          coastlineWaypoints: coastlineVariant.waypoints,
          coastlinePlannedStops: coastlineVariant.plannedStops,
          meta: {
            routeDistanceNm: Number(routeDistanceNm.toFixed(1)),
            maxLegNm: Number(maxLegNm.toFixed(1)),
            planningLegNm: Number(planningLegNm.toFixed(1)),
            cruiseKtas,
            fuelBurnGph,
            fuelGallons,
            reserveMinutes,
            overwaterLikely,
            stopPlanningMode: stopCount > 0 ? "sequential_topoff" : "direct_no_stop",
            suggestedStopCount: directVariant.plannedStops.length,
            coastlineSuggestedStopCount: coastlineVariant.plannedStops.length,
          },
        };
        await setCachedMapPayload(
          routeSuggestionCache,
          routeCacheKey,
          payload,
          ROUTE_SUGGESTION_CACHE_TTL_MS,
          ROUTE_SUGGESTION_CACHE_MAX,
          "route-suggestions",
        );
        return payload;
      })();

      routeSuggestionInFlight.set(routeCacheKey, buildPromise);
      const payload = await buildPromise.finally(() => {
        routeSuggestionInFlight.delete(routeCacheKey);
      });
      return res.json(payload);
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

      return res.json({
        icao: requestedIcao,
        metar: null,
        taf: null,
        timestamp: now,
        cached: false,
        unavailable: true,
        message: `No weather data available for ${requestedIcao}. This airport may not report METAR/TAF data.`,
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

  app.get("/api/aviation/terrain-profile", async (req, res) => {
    try {
      const pathParam = typeof req.query.path === "string" ? req.query.path : "";
      const pointTokens = pathParam
        .split(";")
        .map((token) => token.trim())
        .filter(Boolean);

      const routePoints = pointTokens
        .map((token) => {
          const [latRaw, lonRaw] = token.split(",");
          const lat = Number(latRaw);
          const lon = Number(lonRaw);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
          return { lat, lon };
        })
        .filter((point): point is { lat: number; lon: number } => Boolean(point));

      if (routePoints.length < 2) {
        return res.status(400).json({ error: "At least two path points are required." });
      }

      const sampleCount = Math.max(8, Math.min(Number(req.query.samples) || 18, 48));
      const cacheKey = `${pathParam}|${sampleCount}`;
      const cached = terrainProfileCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return res.json(cached.payload);
      }

      const inFlight = terrainProfileInFlight.get(cacheKey);
      if (inFlight) {
        return res.json(await inFlight);
      }

      const buildPromise = (async () => {
        const sampledPath = sampleRouteLine(routePoints, sampleCount);
        const settled = await Promise.allSettled(
          sampledPath.map(async (point) => ({
            lat: point.lat,
            lon: point.lon,
            elevationFt: await fetchTerrainElevationFtCached(point.lat, point.lon),
          }))
        );

        const elevations = settled.map((result, index) => {
          const point = sampledPath[index];
          if (result.status === "fulfilled") {
            return result.value;
          }
          return {
            lat: point.lat,
            lon: point.lon,
            elevationFt: null,
          };
        });

        const validElevationCount = elevations.filter((point) => point.elevationFt != null).length;
        if (validElevationCount < 2) {
          throw new Error("Terrain profile is temporarily unavailable from USGS.");
        }

        const maxElevationFt = elevations.reduce<number | null>((max, point) => {
          if (point.elevationFt === null) return max;
          if (max === null) return point.elevationFt;
          return Math.max(max, point.elevationFt);
        }, null);

        const payload = {
          source: "USGS EPQS / 3DEP",
          samples: elevations,
          maxElevationFt,
          sampledPointCount: elevations.length,
          partial: validElevationCount !== elevations.length,
        };

        terrainProfileCache.set(cacheKey, {
          expiresAt: Date.now() + TERRAIN_PROFILE_CACHE_TTL_MS,
          payload,
        });
        return payload;
      })();

      terrainProfileInFlight.set(cacheKey, buildPromise);
      const payload = await buildPromise.finally(() => {
        terrainProfileInFlight.delete(cacheKey);
      });

      res.json(payload);
    } catch (error: any) {
      console.error("Terrain profile fetch failed:", error);
      res.status(502).json({ error: error?.message || "Failed to fetch terrain profile" });
    }
  });

  app.get("/api/aviation/obstacles/nearby", async (req, res) => {
    try {
      const lat = Number(req.query.lat);
      const lon = Number(req.query.lon);
      const radiusNm = Math.min(Math.max(Number(req.query.radiusNm) || 25, 5), 100);
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return res.status(400).json({ error: "lat and lon are required." });
      }

      const obstacles = await loadCachedObstacles();
      const nearby = obstacles
        .map((obstacle) => ({
          ...obstacle,
          distanceNm: haversineNm(lat, lon, obstacle.lat, obstacle.lon),
        }))
        .filter((obstacle) => obstacle.distanceNm <= radiusNm)
        .sort((a, b) => {
          const aHeight = a.amslFt ?? a.aglFt ?? 0;
          const bHeight = b.amslFt ?? b.aglFt ?? 0;
          if (Math.abs(a.distanceNm - b.distanceNm) < 0.25) return bHeight - aHeight;
          return a.distanceNm - b.distanceNm;
        })
        .slice(0, limit);

      const highestObstacle = nearby.reduce<NearbyObstacle | null>((highest, obstacle) => {
        const currentHeight = obstacle.amslFt ?? obstacle.aglFt ?? 0;
        const highestHeight = highest ? highest.amslFt ?? highest.aglFt ?? 0 : -Infinity;
        return currentHeight > highestHeight ? obstacle : highest;
      }, null);

      res.json({
        source: "FAA Daily DOF",
        radiusNm,
        count: nearby.length,
        highestObstacle,
        obstacles: nearby,
      });
    } catch (error: any) {
      console.error("Nearby obstacle fetch failed:", error);
      res.status(502).json({ error: error?.message || "Failed to fetch nearby obstacles" });
    }
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
    } catch (error: any) {
      const errorName = String(error?.name || "");
      const errorMessage = String(error?.message || "");
      const isAbortLike =
        errorName === "AbortError" ||
        /aborted|timed out|timeout/i.test(errorMessage);

      if (!res.headersSent) {
        if (isAbortLike) {
          return res.status(504).end();
        }
        console.error("RainViewer tile proxy failed:", error);
        return res.status(502).json({ error: "RainViewer tile unavailable" });
      }

      if (!isAbortLike) {
        console.error("RainViewer tile proxy failed:", error);
      }
    }
  });

  app.get("/api/weather/rainviewer/frames", async (_req, res) => {
    try {
      const response = await fetchWithTimeout(
        "https://api.rainviewer.com/public/weather-maps.json",
        { headers: { "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)" } },
        8000
      );
      if (!response.ok) {
        return res.status(response.status).json({ error: "RainViewer metadata unavailable" });
      }
      const data = await response.json() as any;
      const frames = [...(data?.radar?.past || []), ...(data?.radar?.nowcast || [])]
        .map((item: { path?: string }) => item.path)
        .filter(Boolean);
      res.setHeader("Cache-Control", "public, max-age=120");
      return res.json({ frames });
    } catch (error: any) {
      const errorName = String(error?.name || "");
      const errorMessage = String(error?.message || "");
      if (errorName === "AbortError" || /aborted|timed out|timeout/i.test(errorMessage)) {
        return res.status(504).json({ error: "RainViewer metadata timed out" });
      }
      console.error("RainViewer metadata proxy failed:", error);
      return res.status(502).json({ error: "RainViewer metadata unavailable" });
    }
  });

  app.get("/api/tiles/faa/wms", async (req, res) => {
    const query = req.query as Record<string, string | string[] | undefined>;
    const readQuery = (...keys: string[]) => {
      for (const key of keys) {
        const value = query[key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
      return "";
    };

    const service = readQuery("service", "SERVICE");
    const requestType = readQuery("request", "REQUEST");
    const layers = readQuery("layers", "LAYERS");
    const bbox = readQuery("bbox", "BBOX");
    const width = readQuery("width", "WIDTH");
    const height = readQuery("height", "HEIGHT");
    const format = readQuery("format", "FORMAT") || "image/png";
    const styles = readQuery("styles", "STYLES");
    const version = readQuery("version", "VERSION") || "1.1.1";
    const transparent = readQuery("transparent", "TRANSPARENT") || "false";
    const srs = readQuery("srs", "SRS");
    const crs = readQuery("crs", "CRS");

    if (service.toUpperCase() !== "WMS" || requestType.toUpperCase() !== "GETMAP") {
      return res.status(400).json({ error: "Unsupported FAA WMS request" });
    }
    if (!FAA_WMS_ALLOWED_LAYERS.has(layers)) {
      return res.status(400).json({ error: "Unsupported FAA WMS layer" });
    }
    if (!bbox || !width || !height) {
      return res.status(400).json({ error: "Missing FAA WMS tile parameters" });
    }

    try {
      const targetUrl = new URL(FAA_WMS_URL);
      targetUrl.searchParams.set("service", "WMS");
      targetUrl.searchParams.set("request", "GetMap");
      targetUrl.searchParams.set("layers", layers);
      targetUrl.searchParams.set("styles", styles);
      targetUrl.searchParams.set("format", format);
      targetUrl.searchParams.set("transparent", transparent);
      targetUrl.searchParams.set("version", version);
      if (srs) {
        targetUrl.searchParams.set("srs", srs);
      } else if (crs) {
        targetUrl.searchParams.set("crs", crs);
      }
      targetUrl.searchParams.set("width", width);
      targetUrl.searchParams.set("height", height);
      targetUrl.searchParams.set("bbox", bbox);

      const response = await fetchWithTimeout(
        targetUrl.toString(),
        { headers: { "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)" } },
        12000
      );
      const contentType = response.headers.get("content-type") || format;
      const buffer = Buffer.from(await response.arrayBuffer());

      if (!response.ok) {
        console.warn("FAA WMS proxy upstream failure:", {
          status: response.status,
          layer: layers,
          contentType,
        });
      }

      res.status(response.status);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", response.ok ? "public, max-age=1800" : "no-store");
      res.setHeader("X-RSF-FAA-WMS-Layer", layers);
      res.send(buffer);
    } catch (error: any) {
      const errorName = String(error?.name || "");
      const errorMessage = String(error?.message || "");
      const isAbortLike =
        errorName === "AbortError" ||
        /aborted|timed out|timeout/i.test(errorMessage);

      if (!res.headersSent) {
        if (isAbortLike) {
          return res.status(504).json({ error: "FAA WMS timeout" });
        }
        console.error("FAA WMS proxy failed:", error);
        return res.status(502).json({ error: "FAA WMS unavailable" });
      }

      if (!isAbortLike) {
        console.error("FAA WMS proxy failed:", error);
      }
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
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");

      const runwayMap = await loadRunwayCache();
      const runways = runwayMap.get(requestedIcao) || [];
      return res.json({ icao: requestedIcao, runways });
    } catch (error) {
      console.error("Runway lookup failed:", error);
      res.status(500).json({ error: "Failed to fetch runway data" });
    }
  });

  app.get("/api/airports/:icao/frequencies", async (req, res) => {
    try {
      const requestedIcao = normalizeIcao(req.params.icao || "");
      if (!/^[A-Z0-9]{3,4}$/.test(requestedIcao)) {
        return res.status(400).json({ error: "Invalid ICAO code format" });
      }
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");

      const frequencyMap = await loadAirportFrequencyCache();
      const candidates = buildIcaoCandidates(requestedIcao);
      const frequencies = candidates.flatMap((candidate) => frequencyMap.get(candidate) || []);

      const deduped = Array.from(
        new Map(
          frequencies.map((item) => [
            `${item.type || ""}|${item.description || ""}|${item.frequencyMhz || ""}`,
            item,
          ])
        ).values()
      );

      return res.json({
        icao: requestedIcao,
        frequencies: deduped
          .filter((item) => item.frequencyMhz !== null || item.description || item.type)
          .sort((a, b) => {
            const byType = String(a.type || "").localeCompare(String(b.type || ""));
            if (byType !== 0) return byType;
            return String(a.description || "").localeCompare(String(b.description || ""));
          }),
      });
    } catch (error) {
      console.error("Airport frequency lookup failed:", error);
      res.status(500).json({ error: "Failed to fetch airport frequency data" });
    }
  });

  app.get("/api/airports/:icao/surface-geometry", async (req, res) => {
    try {
      const requestedIcao = normalizeIcao(req.params.icao || "");
      if (!/^[A-Z0-9]{3,4}$/.test(requestedIcao)) {
        return res.status(400).json({ error: "Invalid ICAO code format" });
      }

      const referenceMap = await loadAirportReferenceCache();
      const airport = getAirportReferenceByIcao(referenceMap, requestedIcao);
      if (!airport) {
        return res.status(404).json({ error: "Airport not found" });
      }

      const data = await fetchAirportSurfaceGeometry(airport);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({
        error: "Failed to load airport surface geometry",
        details: error?.message || String(error),
      });
    }
  });

  app.get("/api/airports/:icao/runway-briefing", async (req, res) => {
    try {
      const requestedIcao = normalizeIcao(req.params.icao || "");
      if (!/^[A-Z0-9]{3,4}$/.test(requestedIcao)) {
        return res.status(400).json({ error: "Invalid ICAO code format" });
      }
      res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=600");
      const briefingCacheKey = getRunwayBriefingCacheKey(requestedIcao);
      const cachedBriefing = await getCachedMapPayload<any>(
        runwayBriefingCache,
        briefingCacheKey,
        RUNWAY_BRIEFING_CACHE_TTL_MS,
        "runway-briefings",
      );
      if (cachedBriefing) {
        return res.json(cachedBriefing);
      }
      const inFlightBriefing = runwayBriefingInFlight.get(briefingCacheKey);
      if (inFlightBriefing) {
        return res.json(await inFlightBriefing);
      }

      const buildPromise = (async () => {
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

        const payload = {
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
        };
        await setCachedMapPayload(
          runwayBriefingCache,
          briefingCacheKey,
          payload,
          RUNWAY_BRIEFING_CACHE_TTL_MS,
          undefined,
          "runway-briefings",
        );
        return payload;
      })();

      runwayBriefingInFlight.set(briefingCacheKey, buildPromise);
      try {
        return res.json(await buildPromise);
      } finally {
        runwayBriefingInFlight.delete(briefingCacheKey);
      }
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

      type TfrFetchMeta = {
        attempted: boolean;
        ok: boolean;
        error?: string;
        attempts?: Array<{ url: string; ok: boolean; status?: number; error?: string }>;
      };

      let arcgisMeta:
        | TfrFetchMeta
        | null = null;
      let wfsMeta:
        | TfrFetchMeta
        | null = null;

      const buildPayload = async () => {
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
          const resultPromise = tfrPayloadBuildPromise ?? buildPayload().finally(() => {
            tfrPayloadBuildPromise = null;
          });
          tfrPayloadBuildPromise = resultPromise;
          const result = await resultPromise;
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

      const liveUpstreamSucceeded = payload?.source === "faa-sua-wfs" || payload?.source === "faa-arcgis";

      if (!liveUpstreamSucceeded && arcgisMeta?.attempted && !arcgisMeta.ok) {
        console.warn(
          JSON.stringify({
            event: "tfr_upstream_degraded",
            requestId,
            error: arcgisMeta.error,
            attempts: arcgisMeta.attempts,
            fallbackSource: payload?.source || "unknown",
          })
        );
      }

      const wfsMetaSnapshot = wfsMeta as TfrFetchMeta | null;
      const failedWfsMeta = wfsMetaSnapshot && wfsMetaSnapshot.attempted && !wfsMetaSnapshot.ok ? wfsMetaSnapshot : null;
      if (!liveUpstreamSucceeded && failedWfsMeta) {
        console.warn(
          JSON.stringify({
            event: "tfr_wfs_upstream_degraded",
            requestId,
            error: failedWfsMeta.error,
            attempts: failedWfsMeta.attempts,
            fallbackSource: payload?.source || "unknown",
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
    max: Number(process.env.RATE_LIMIT_PLATES_PROXY_MAX || 30),
    dailyMax: Number(process.env.RATE_LIMIT_PLATES_PROXY_DAILY_MAX || 1000),
    message: "Too many plate proxy requests, please try again later",
  });

  const platesMetadataRateLimiter = createIpRateLimiter({
    windowMs: 60 * 1000,
    max: Number(process.env.RATE_LIMIT_PLATES_METADATA_MAX || 240),
    dailyMax: Number(process.env.RATE_LIMIT_PLATES_METADATA_DAILY_MAX || 12000),
    message: "Too many plate metadata requests, please try again later",
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

  app.get("/api/plates/:icao", platesMetadataRateLimiter, async (req, res) => {
    try {
      const icao = normalizeIcao(req.params.icao || "");
      if (!/^[A-Z0-9]{3,4}$/.test(icao)) {
        return res.status(400).json({ error: "Invalid ICAO code format" });
      }
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");

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
      const credentialReadiness = getCfiVerificationReadiness(credentials);
      res.json({
        profile,
        credentials,
        availability,
        legal: { cfi_terms: !!cfiTerms },
        credentialReadiness,
      });
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
      const credentials = await storage.getCfiCredentials(existing.id);
      const readiness = getCfiVerificationReadiness(credentials);
      if (!readiness.isReady) {
        return res.status(403).json({
          error: "Required CFI credentials are missing",
          missing: readiness.checks.filter((check) => !check.met).map((check) => check.label),
        });
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
      const all = String(req.query.all || "").toLowerCase() === "true";
      const page = Math.max(1, Number.parseInt(String(req.query.page || "1"), 10) || 1);
      const requestedPageSize = Number.parseInt(String(req.query.pageSize || "50"), 10) || 50;
      const pageSize = Math.min(Math.max(requestedPageSize, 1), 250);
      const offset = (page - 1) * pageSize;

      const [entries, totals] = await Promise.all([
        all
          ? storage.getLogbookEntriesByUser(userId)
          : storage.getLogbookEntriesByUser(userId, { limit: pageSize, offset }),
        storage.getLogbookEntryTotalsByUser(userId),
      ]);

      const totalEntries = totals.totalEntries;
      const effectivePageSize = all ? Math.max(totalEntries, 1) : pageSize;
      const totalPages = all ? 1 : Math.max(1, Math.ceil(totalEntries / pageSize));

      res.json({
        entries,
        totals,
        pagination: {
          page: all ? 1 : page,
          pageSize: effectivePageSize,
          totalEntries,
          totalPages,
          hasPreviousPage: !all && page > 1,
          hasNextPage: !all && page < totalPages,
        },
      });
    } catch (error) {
      console.error("Failed to fetch logbook entries:", error);
      res.status(500).json({ error: "Failed to fetch logbook entries" });
    }
  });

  app.get("/api/logbook/import-template", isAuthenticated, async (req: any, res) => {
    try {
      const format = String(req.query.format || "csv").toLowerCase();
      if (format === "xlsx") {
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader("Content-Disposition", 'attachment; filename="rsf-logbook-template.xlsx"');
        return res.send(buildLogbookTemplateXlsx());
      }

      if (format !== "csv") {
        return res.status(400).json({ error: "Unsupported template format" });
      }

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="rsf-logbook-template.csv"');
      res.send(buildLogbookTemplateCsv());
    } catch (error) {
      console.error("Logbook template export failed:", error);
      res.status(500).json({ error: "Failed to export logbook template" });
    }
  });

  app.post("/api/logbook/import-preview", isAuthenticated, logbookImportUpload.single("file"), async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        return res.status(400).json({ error: "No logbook import file uploaded" });
      }

      const rows = parseLogbookImportFile(file.originalname, file.buffer);
      const { imported, skipped } = mapImportedLogbookRows(rows);
      const existingEntries = await storage.getLogbookEntriesByUser(userId);
      const duplicates = findLogbookImportDuplicates(imported, existingEntries);

      res.json({
        success: true,
        fileName: file.originalname,
        totalRows: rows.length,
        importableCount: imported.length,
        duplicateCount: duplicates.length,
        skippedCount: skipped.length,
        skipped,
        duplicates,
      });
    } catch (error: any) {
      console.error("Logbook import preview failed:", error);
      res.status(400).json({ error: error?.message || "Failed to preview logbook import" });
    }
  });

  app.post("/api/logbook/import", isAuthenticated, logbookImportUpload.single("file"), async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        return res.status(400).json({ error: "No logbook import file uploaded" });
      }

      const rows = parseLogbookImportFile(file.originalname, file.buffer);
      const { imported, skipped } = mapImportedLogbookRows(rows);
      const existingEntries = await storage.getLogbookEntriesByUser(userId);
      const duplicates = findLogbookImportDuplicates(imported, existingEntries);
      const excludedRowNumbers = parseCrmImportExcludedRows(req.body?.excludedRowNumbers);
      const seenSignatures = new Set<string>();
      const skippedRows = [...skipped];
      let createdCount = 0;

      for (const row of imported) {
        if (excludedRowNumbers.has(row.rowNumber)) {
          skippedRows.push({ rowNumber: row.rowNumber, reason: "Skipped during duplicate review" });
          continue;
        }

        if (seenSignatures.has(row.signature)) {
          skippedRows.push({ rowNumber: row.rowNumber, reason: "Duplicate row in import file" });
          continue;
        }

        seenSignatures.add(row.signature);
        await storage.createLogbookEntry({ ...row.entry, userId });
        createdCount += 1;
      }

      res.json({
        success: true,
        fileName: file.originalname,
        totalRows: rows.length,
        createdCount,
        skippedCount: skippedRows.length,
        skipped: skippedRows,
      });
    } catch (error: any) {
      console.error("Logbook import failed:", error);
      res.status(400).json({ error: error?.message || "Failed to import logbook entries" });
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
      const { signatureDataUrl, signedByName, cfiCertNumber, cfiCertExpires } = req.body;
      if (!signatureDataUrl || !signedByName || !cfiCertNumber || !cfiCertExpires) {
        return res.status(400).json({ error: "signatureDataUrl, signedByName, cfiCertNumber, and cfiCertExpires are required" });
      }
      const forwarded = (req.headers["x-forwarded-for"] as string) || "";
      const ip = forwarded.split(",")[0].trim() || req.ip;
      const entry = await storage.countersignLogbookEntry(
        req.params.id,
        signatureDataUrl,
        signedByName,
        ip,
        cfiCertNumber,
        cfiCertExpires
      );
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
      const settings = await storage.getLogbookProSettings(userId);

      const now = new Date();
      const last90 = new Date(now);
      last90.setDate(last90.getDate() - 90);
      const last6 = new Date(now);
      last6.setMonth(last6.getMonth() - 6);

      const [entriesLast90, entriesLast6] = await Promise.all([
        storage.getLogbookEntriesByUserSince(userId, last90),
        storage.getLogbookEntriesByUserSince(userId, last6),
      ]);

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

  // Flying Clubs
  app.get("/api/flying-clubs", async (_req, res) => {
    try {
      const clubs = await storage.getFlyingClubs();
      const enriched = await Promise.all(
        clubs.map(async (club) => {
          const [members, aircraft] = await Promise.all([
            storage.getFlyingClubMembers(club.id),
            storage.getFlyingClubAircraft(club.id),
          ]);
          return {
            ...club,
            memberCount: members.filter((member) => member.status === "active").length,
            aircraftCount: aircraft.filter((entry) => entry.status === "active").length,
          };
        }),
      );
      res.json(enriched);
    } catch (error) {
      console.error("Failed to fetch flying clubs:", error);
      res.status(500).json({ error: "Failed to fetch flying clubs" });
    }
  });

  app.get("/api/flying-clubs/mine", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const clubs = await storage.getFlyingClubsByMember(userId);
      res.json(clubs);
    } catch (error) {
      console.error("Failed to fetch member flying clubs:", error);
      res.status(500).json({ error: "Failed to fetch member flying clubs" });
    }
  });

  app.post("/api/flying-clubs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const result = insertFlyingClubSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }

      const slug = await buildUniqueFlyingClubSlug(result.data.name);
      const club = await storage.createFlyingClub({
        ...result.data,
        ownerUserId: userId,
        slug,
        status: result.data.status ?? "draft",
        visibility: result.data.visibility ?? "listed",
      });

      await storage.addFlyingClubMember({
        clubId: club.id,
        userId,
        role: "owner",
        status: "active",
      });

      res.status(201).json(club);
    } catch (error) {
      console.error("Failed to create flying club:", error);
      res.status(500).json({ error: "Failed to create flying club" });
    }
  });

  app.get("/api/flying-clubs/:slug", async (req: any, res) => {
    try {
      const club = await storage.getFlyingClubBySlug(req.params.slug);
      if (!club) {
        return res.status(404).json({ error: "Flying club not found" });
      }

      const access = await getFlyingClubAccessContext(req, club.id);
      const canViewPrivate = access.canReserve || access.canManage;

      if (!canViewPrivate && (club.status !== "active" || club.visibility !== "listed")) {
        return res.status(404).json({ error: "Flying club not found" });
      }

      const [members, aircraft, reservations, announcements, squawks, maintenanceItems, blackouts] = await Promise.all([
        storage.getFlyingClubMembers(club.id),
        storage.getFlyingClubAircraft(club.id),
        canViewPrivate ? storage.getFlyingClubReservations(club.id) : Promise.resolve([]),
        storage.getFlyingClubAnnouncements(club.id),
        canViewPrivate ? storage.getFlyingClubSquawks(club.id) : Promise.resolve([]),
        canViewPrivate ? storage.getFlyingClubMaintenanceItems(club.id) : Promise.resolve([]),
        canViewPrivate ? storage.getFlyingClubBlackouts(club.id) : Promise.resolve([]),
      ]);
      const { documents, pendingDocuments, acceptances } = await getPendingRequiredClubDocuments(club.id, access.userId);
      const joinRequests = access.canManage ? await storage.getFlyingClubJoinRequests(club.id) : [];
      const viewerJoinRequest = access.userId
        ? await storage.getFlyingClubJoinRequestForApplicant(club.id, access.userId)
        : null;

      res.json({
        club,
        members,
        aircraft,
        reservations,
        announcements,
        squawks,
        maintenanceItems,
        blackouts,
        documents,
        viewerAcceptances: acceptances,
        pendingRequiredDocuments: pendingDocuments,
        joinRequests,
        viewerJoinRequest,
        viewerMembership: access.membership ?? null,
        canManage: access.canManage,
        canReserve:
          access.canReserve &&
          (!club.requirePolicyAcceptanceBeforeBooking || pendingDocuments.length === 0),
      });
    } catch (error) {
      console.error("Failed to fetch flying club detail:", error);
      res.status(500).json({ error: "Failed to fetch flying club detail" });
    }
  });

  app.post("/api/flying-clubs/:clubId/join-requests", isAuthenticated, async (req: any, res) => {
    try {
      const access = await getFlyingClubAccessContext(req, req.params.clubId);
      if (!access.club || !access.userId) {
        return res.status(404).json({ error: "Flying club not found" });
      }
      if (access.membership?.status === "active") {
        return res.status(409).json({ error: "You are already an active member of this club" });
      }

      const existing = await storage.getFlyingClubJoinRequestForApplicant(access.club.id, access.userId);
      if (existing) {
        return res.status(409).json({ error: "A join request is already pending for this club" });
      }

      const result = insertFlyingClubJoinRequestSchema.safeParse(req.body || {});
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }

      const created = await storage.createFlyingClubJoinRequest({
        clubId: access.club.id,
        applicantUserId: access.userId,
        message: result.data.message || null,
        status: "pending",
      });
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to create flying club join request:", error);
      res.status(500).json({ error: "Failed to create flying club join request" });
    }
  });

  app.patch("/api/flying-clubs/:clubId/join-requests/:requestId", isAuthenticated, async (req: any, res) => {
    try {
      const access = await getFlyingClubAccessContext(req, req.params.clubId);
      if (!access.club || !access.userId) {
        return res.status(404).json({ error: "Flying club not found" });
      }
      if (!access.canManage) {
        return res.status(403).json({ error: "Club manager access required" });
      }

      const joinRequest = await storage.getFlyingClubJoinRequest(req.params.requestId);
      if (!joinRequest || joinRequest.clubId !== access.club.id) {
        return res.status(404).json({ error: "Join request not found" });
      }
      if (joinRequest.status !== "pending") {
        return res.status(409).json({ error: "Join request has already been reviewed" });
      }

      const action = String(req.body?.action || "").toLowerCase();
      if (!["approve", "decline"].includes(action)) {
        return res.status(400).json({ error: "Invalid join request action" });
      }

      if (action === "approve") {
        const existingMembership = await storage.getFlyingClubMembership(access.club.id, joinRequest.applicantUserId);
        if (!existingMembership) {
          await storage.addFlyingClubMember({
            clubId: access.club.id,
            userId: joinRequest.applicantUserId,
            role: "member",
            status: "active",
          });
        }
      }

      const updated = await storage.updateFlyingClubJoinRequest(joinRequest.id, {
        status: action === "approve" ? "approved" : "declined",
        reviewedByUserId: access.userId,
        reviewedAt: new Date(),
      });

      res.json(updated);
    } catch (error) {
      console.error("Failed to review flying club join request:", error);
      res.status(500).json({ error: "Failed to review flying club join request" });
    }
  });

  app.post("/api/flying-clubs/:clubId/documents/upload", isAuthenticated, async (req: any, res) => {
    try {
      const access = await getFlyingClubAccessContext(req, req.params.clubId);
      if (!access.club) {
        return res.status(404).json({ error: "Flying club not found" });
      }
      if (!access.canManage) {
        return res.status(403).json({ error: "Club manager access required" });
      }
      const contentType = String(req.body?.contentType || "application/pdf");
      if (process.env.AWS_S3_BUCKET) {
        const { S3StorageService } = await import("./s3Storage");
        const s3Service = new S3StorageService();
        const { uploadURL, key } = await s3Service.getPresignedUploadUrlForKey({
          prefix: `flying-club-documents/${access.club.id}`,
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
      console.error("Failed to create club document upload URL:", error);
      res.status(500).json({ error: "Failed to create upload URL" });
    }
  });

  app.post("/api/flying-clubs/:clubId/documents", isAuthenticated, async (req: any, res) => {
    try {
      const access = await getFlyingClubAccessContext(req, req.params.clubId);
      if (!access.club || !access.userId) {
        return res.status(404).json({ error: "Flying club not found" });
      }
      if (!access.canManage) {
        return res.status(403).json({ error: "Club manager access required" });
      }
      const result = insertFlyingClubDocumentSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const created = await storage.createFlyingClubDocument({
        ...result.data,
        clubId: access.club.id,
        uploadedByUserId: access.userId,
      });
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to create club document:", error);
      res.status(500).json({ error: "Failed to create club document" });
    }
  });

  app.get("/api/flying-clubs/:clubId/documents/:documentId/download", isAuthenticated, async (req: any, res) => {
    try {
      const access = await getFlyingClubAccessContext(req, req.params.clubId);
      if (!access.club) {
        return res.status(404).json({ error: "Flying club not found" });
      }
      const document = await storage.getFlyingClubDocument(req.params.documentId);
      if (!document || document.clubId !== access.club.id) {
        return res.status(404).json({ error: "Document not found" });
      }
      const canViewDocument =
        access.canManage ||
        access.canReserve ||
        (access.club.status === "active" && access.club.visibility === "listed");
      if (!canViewDocument) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${String(document.fileName || document.title || "club-document").replace(/\"/g, "")}"`,
      );

      if (document.storageProvider === "s3") {
        const { S3StorageService } = await import("./s3Storage");
        const s3Service = new S3StorageService();
        const { stream, contentType, contentLength } = await s3Service.getObjectStream({
          key: document.storagePath,
        });
        res.setHeader("Content-Type", contentType || document.mimeType || "application/octet-stream");
        if (contentLength) res.setHeader("Content-Length", String(contentLength));
        stream.pipe(res);
        return;
      }

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(document.storagePath);
      await objectStorageService.downloadObject(objectFile, res, 0);
    } catch (error) {
      console.error("Failed to download club document:", error);
      res.status(500).json({ error: "Failed to download club document" });
    }
  });

  app.post("/api/flying-clubs/:clubId/legal-acceptances", isAuthenticated, async (req: any, res) => {
    try {
      const access = await getFlyingClubAccessContext(req, req.params.clubId);
      if (!access.club || !access.userId) {
        return res.status(404).json({ error: "Flying club not found" });
      }
      const result = insertFlyingClubLegalAcceptanceSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const document = await storage.getFlyingClubDocument(result.data.documentId);
      if (!document || document.clubId !== access.club.id || !document.isActive || !document.requiresAcceptance) {
        return res.status(404).json({ error: "Required club document not found" });
      }
      const existing = await storage.getFlyingClubLegalAcceptance(document.id, access.userId, document.version);
      if (existing) {
        return res.json(existing);
      }
      const created = await storage.createFlyingClubLegalAcceptance({
        clubId: access.club.id,
        documentId: document.id,
        userId: access.userId,
        version: document.version,
        ip: req.ip || null,
        userAgent: req.get("user-agent") || null,
      });
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to record club legal acceptance:", error);
      res.status(500).json({ error: "Failed to record club legal acceptance" });
    }
  });

  app.post("/api/flying-clubs/:clubId/aircraft", isAuthenticated, async (req: any, res) => {
    try {
      const access = await getFlyingClubAccessContext(req, req.params.clubId);
      if (!access.club) {
        return res.status(404).json({ error: "Flying club not found" });
      }
      if (!access.canManage) {
        return res.status(403).json({ error: "Club manager access required" });
      }

      const result = insertFlyingClubAircraftSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }

      const created = await storage.addFlyingClubAircraft({
        ...result.data,
        clubId: access.club.id,
        hourlyRateWet: typeof result.data.hourlyRateWet === "string" ? result.data.hourlyRateWet : result.data.hourlyRateWet ?? undefined,
        hourlyRateDry: typeof result.data.hourlyRateDry === "string" ? result.data.hourlyRateDry : result.data.hourlyRateDry ?? undefined,
      } as any);
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to add flying club aircraft:", error);
      res.status(500).json({ error: "Failed to add flying club aircraft" });
    }
  });

  app.post("/api/flying-clubs/:clubId/aircraft/import", isAuthenticated, async (req: any, res) => {
    try {
      const access = await getFlyingClubAccessContext(req, req.params.clubId);
      if (!access.club) {
        return res.status(404).json({ error: "Flying club not found" });
      }
      if (!access.canManage) {
        return res.status(403).json({ error: "Club manager access required" });
      }

      const csvText = typeof req.body?.csvText === "string" ? req.body.csvText : "";
      if (!csvText.trim()) {
        return res.status(400).json({ error: "CSV text is required" });
      }

      const mappedRows = mapFlyingClubFleetCsv(csvText);
      if (mappedRows.length === 0) {
        return res.status(400).json({ error: "No valid fleet rows found in CSV" });
      }

      const created = [];
      for (const row of mappedRows) {
        created.push(await storage.addFlyingClubAircraft({
          clubId: access.club.id,
          displayName: row.displayName || row.tailNumber || row.makeModel || `Aircraft ${row.rowNumber}`,
          tailNumber: row.tailNumber || null,
          makeModel: row.makeModel || null,
          hourlyRateWet: normalizeFlyingClubRate(row.hourlyRateWet),
          hourlyRateDry: normalizeFlyingClubRate(row.hourlyRateDry),
          status: row.status?.trim() || "active",
          notes: row.notes || null,
        } as any));
      }

      res.status(201).json({
        importedCount: created.length,
        aircraft: created,
      });
    } catch (error) {
      console.error("Failed to import flying club fleet:", error);
      res.status(500).json({ error: "Failed to import flying club fleet" });
    }
  });

  app.patch("/api/flying-clubs/:clubId/aircraft/:aircraftId", isAuthenticated, async (req: any, res) => {
    try {
      const access = await getFlyingClubAccessContext(req, req.params.clubId);
      if (!access.club) {
        return res.status(404).json({ error: "Flying club not found" });
      }
      if (!access.canManage) {
        return res.status(403).json({ error: "Club manager access required" });
      }
      const aircraft = await storage.getFlyingClubAircraftById(req.params.aircraftId);
      if (!aircraft || aircraft.clubId !== access.club.id) {
        return res.status(404).json({ error: "Club aircraft not found" });
      }
      const result = insertFlyingClubAircraftSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const updated = await storage.updateFlyingClubAircraft(aircraft.id, result.data as any);
      res.json(updated);
    } catch (error) {
      console.error("Failed to update club aircraft:", error);
      res.status(500).json({ error: "Failed to update club aircraft" });
    }
  });

  app.post("/api/flying-clubs/:clubId/squawks", isAuthenticated, async (req: any, res) => {
    try {
      const access = await getFlyingClubAccessContext(req, req.params.clubId);
      if (!access.club || !access.userId) {
        return res.status(404).json({ error: "Flying club not found" });
      }
      if (!access.canReserve) {
        return res.status(403).json({ error: "Active club membership required" });
      }
      const result = insertFlyingClubSquawkSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const aircraft = await storage.getFlyingClubAircraftById(result.data.aircraftId);
      if (!aircraft || aircraft.clubId !== access.club.id) {
        return res.status(404).json({ error: "Club aircraft not found" });
      }
      const created = await storage.createFlyingClubSquawk({
        ...result.data,
        clubId: access.club.id,
        reportedByUserId: access.userId,
      } as any);
      if (created.groundsAircraft && aircraft.status !== "grounded") {
        await storage.updateFlyingClubAircraft(aircraft.id, { status: "grounded" } as any);
      }
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to create club squawk:", error);
      res.status(500).json({ error: "Failed to create club squawk" });
    }
  });

  app.patch("/api/flying-clubs/:clubId/squawks/:squawkId", isAuthenticated, async (req: any, res) => {
    try {
      const access = await getFlyingClubAccessContext(req, req.params.clubId);
      if (!access.club || !access.userId) {
        return res.status(404).json({ error: "Flying club not found" });
      }
      if (!access.canManage) {
        return res.status(403).json({ error: "Club manager access required" });
      }
      const squawk = await storage.getFlyingClubSquawk(req.params.squawkId);
      if (!squawk || squawk.clubId !== access.club.id) {
        return res.status(404).json({ error: "Squawk not found" });
      }
      const result = insertFlyingClubSquawkSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const updates: any = { ...result.data };
      if (updates.status === "resolved") {
        updates.resolvedAt = new Date();
        updates.resolvedByUserId = access.userId;
      }
      const updated = await storage.updateFlyingClubSquawk(squawk.id, updates);
      res.json(updated);
    } catch (error) {
      console.error("Failed to update club squawk:", error);
      res.status(500).json({ error: "Failed to update club squawk" });
    }
  });

  app.post("/api/flying-clubs/:clubId/maintenance-items", isAuthenticated, async (req: any, res) => {
    try {
      const access = await getFlyingClubAccessContext(req, req.params.clubId);
      if (!access.club || !access.userId) {
        return res.status(404).json({ error: "Flying club not found" });
      }
      if (!access.canManage) {
        return res.status(403).json({ error: "Club manager access required" });
      }
      const result = insertFlyingClubMaintenanceItemSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const aircraft = await storage.getFlyingClubAircraftById(result.data.aircraftId);
      if (!aircraft || aircraft.clubId !== access.club.id) {
        return res.status(404).json({ error: "Club aircraft not found" });
      }
      const created = await storage.createFlyingClubMaintenanceItem({
        ...result.data,
        clubId: access.club.id,
        createdByUserId: access.userId,
      } as any);
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to create maintenance item:", error);
      res.status(500).json({ error: "Failed to create maintenance item" });
    }
  });

  app.patch("/api/flying-clubs/:clubId/maintenance-items/:itemId", isAuthenticated, async (req: any, res) => {
    try {
      const access = await getFlyingClubAccessContext(req, req.params.clubId);
      if (!access.club || !access.userId) {
        return res.status(404).json({ error: "Flying club not found" });
      }
      if (!access.canManage) {
        return res.status(403).json({ error: "Club manager access required" });
      }
      const item = await storage.getFlyingClubMaintenanceItem(req.params.itemId);
      if (!item || item.clubId !== access.club.id) {
        return res.status(404).json({ error: "Maintenance item not found" });
      }
      const result = insertFlyingClubMaintenanceItemSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const updates: any = { ...result.data };
      if (updates.status === "completed") {
        updates.completedAt = new Date();
        updates.completedByUserId = access.userId;
      }
      const updated = await storage.updateFlyingClubMaintenanceItem(item.id, updates);
      res.json(updated);
    } catch (error) {
      console.error("Failed to update maintenance item:", error);
      res.status(500).json({ error: "Failed to update maintenance item" });
    }
  });

  app.post("/api/flying-clubs/:clubId/blackouts", isAuthenticated, async (req: any, res) => {
    try {
      const access = await getFlyingClubAccessContext(req, req.params.clubId);
      if (!access.club || !access.userId) {
        return res.status(404).json({ error: "Flying club not found" });
      }
      if (!access.canManage) {
        return res.status(403).json({ error: "Club manager access required" });
      }
      const result = insertFlyingClubBlackoutSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const aircraft = await storage.getFlyingClubAircraftById(result.data.aircraftId);
      if (!aircraft || aircraft.clubId !== access.club.id) {
        return res.status(404).json({ error: "Club aircraft not found" });
      }
      if (!(new Date(result.data.endAt) > new Date(result.data.startAt))) {
        return res.status(400).json({ error: "Blackout end time must be after start time" });
      }
      const created = await storage.createFlyingClubBlackout({
        ...result.data,
        clubId: access.club.id,
        createdByUserId: access.userId,
      } as any);
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to create aircraft blackout:", error);
      res.status(500).json({ error: "Failed to create aircraft blackout" });
    }
  });

  app.patch("/api/flying-clubs/:clubId/blackouts/:blackoutId", isAuthenticated, async (req: any, res) => {
    try {
      const access = await getFlyingClubAccessContext(req, req.params.clubId);
      if (!access.club || !access.userId) {
        return res.status(404).json({ error: "Flying club not found" });
      }
      if (!access.canManage) {
        return res.status(403).json({ error: "Club manager access required" });
      }
      const blackout = await storage.getFlyingClubBlackout(req.params.blackoutId);
      if (!blackout || blackout.clubId !== access.club.id) {
        return res.status(404).json({ error: "Blackout not found" });
      }
      const result = insertFlyingClubBlackoutSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const updated = await storage.updateFlyingClubBlackout(blackout.id, result.data as any);
      res.json(updated);
    } catch (error) {
      console.error("Failed to update aircraft blackout:", error);
      res.status(500).json({ error: "Failed to update aircraft blackout" });
    }
  });

  app.post("/api/flying-clubs/:clubId/reservations", isAuthenticated, async (req: any, res) => {
    try {
      const access = await getFlyingClubAccessContext(req, req.params.clubId);
      if (!access.club) {
        return res.status(404).json({ error: "Flying club not found" });
      }
      if (!access.canReserve || !access.userId) {
        return res.status(403).json({ error: "Active club membership required" });
      }

      if (access.club.requirePolicyAcceptanceBeforeBooking) {
        const { pendingDocuments } = await getPendingRequiredClubDocuments(access.club.id, access.userId);
        if (pendingDocuments.length > 0) {
          return res.status(403).json({
            error: "Club policy acceptance required before booking",
            pendingDocumentIds: pendingDocuments.map((document) => document.id),
            pendingDocuments: pendingDocuments.map((document) => ({
              id: document.id,
              title: document.title,
              category: document.category,
              version: document.version,
            })),
          });
        }
      }

      const result = insertFlyingClubReservationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }

      const aircraft = await storage.getFlyingClubAircraftById(result.data.aircraftId);
      if (!aircraft || aircraft.clubId !== access.club.id) {
        return res.status(404).json({ error: "Club aircraft not found" });
      }

      const startAt = new Date(result.data.startAt);
      const endAt = new Date(result.data.endAt);
      if (!(endAt > startAt)) {
        return res.status(400).json({ error: "Reservation end time must be after start time" });
      }

      if (["maintenance", "grounded", "inactive"].includes(String(aircraft.status))) {
        return res.status(409).json({ error: "This aircraft is not currently available for booking" });
      }

      const [blackouts, squawks, maintenanceItems] = await Promise.all([
        storage.getFlyingClubBlackouts(access.club.id),
        storage.getFlyingClubSquawks(access.club.id),
        storage.getFlyingClubMaintenanceItems(access.club.id),
      ]);

      const conflictingBlackout = blackouts.find((blackout) => {
        if (blackout.aircraftId !== aircraft.id) return false;
        if (blackout.status !== "active") return false;
        const blackoutStart = new Date(blackout.startAt as any);
        const blackoutEnd = new Date(blackout.endAt as any);
        return startAt < blackoutEnd && endAt > blackoutStart;
      });
      if (conflictingBlackout) {
        return res.status(409).json({ error: "This aircraft is blocked by a maintenance or operational blackout" });
      }

      const groundingSquawk = squawks.find((squawk) => {
        if (squawk.aircraftId !== aircraft.id) return false;
        if (!squawk.groundsAircraft) return false;
        return squawk.status !== "resolved";
      });
      if (groundingSquawk) {
        return res.status(409).json({ error: "This aircraft is currently grounded by an open squawk" });
      }

      const blockingMaintenance = maintenanceItems.find((item) => {
        if (item.aircraftId !== aircraft.id) return false;
        if (!item.blocksScheduling) return false;
        return item.status !== "completed";
      });
      if (blockingMaintenance) {
        return res.status(409).json({ error: "This aircraft has an active maintenance restriction" });
      }

      const reservations = await storage.getFlyingClubReservations(access.club.id);
      const conflictingReservation = reservations.find((reservation) => {
        if (reservation.aircraftId !== result.data.aircraftId) return false;
        if (reservation.status === "cancelled") return false;
        const existingStart = new Date(reservation.startAt as any);
        const existingEnd = new Date(reservation.endAt as any);
        return startAt < existingEnd && endAt > existingStart;
      });

      if (conflictingReservation) {
        return res.status(409).json({ error: "This aircraft is already reserved during that time slot" });
      }

      const created = await storage.createFlyingClubReservation({
        ...result.data,
        clubId: access.club.id,
        memberUserId: access.userId,
      } as any);

      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to create flying club reservation:", error);
      res.status(500).json({ error: "Failed to create flying club reservation" });
    }
  });

  app.post("/api/flying-clubs/:clubId/announcements", isAuthenticated, async (req: any, res) => {
    try {
      const access = await getFlyingClubAccessContext(req, req.params.clubId);
      if (!access.club) {
        return res.status(404).json({ error: "Flying club not found" });
      }
      if (!access.canManage || !access.userId) {
        return res.status(403).json({ error: "Club manager access required" });
      }

      const result = insertFlyingClubAnnouncementSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }

      const created = await storage.createFlyingClubAnnouncement({
        ...result.data,
        clubId: access.club.id,
        authorUserId: access.userId,
      });
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to create club announcement:", error);
      res.status(500).json({ error: "Failed to create club announcement" });
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
  const asRecord = (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};

  const mergeProviderSnapshot = (existingSnapshot: unknown, incomingSnapshot: unknown) => {
    const existing = asRecord(existingSnapshot);
    const incoming = asRecord(incomingSnapshot);
    return {
      ...existing,
      ...incoming,
      route: {
        ...asRecord(existing.route),
        ...asRecord(incoming.route),
      },
      timestamps: {
        ...asRecord(existing.timestamps),
        ...asRecord(incoming.timestamps),
      },
      fieldDiffs: Array.isArray(incoming.fieldDiffs)
        ? incoming.fieldDiffs
        : Array.isArray(existing.fieldDiffs)
          ? existing.fieldDiffs
          : [],
      notices: Array.isArray(incoming.notices)
        ? incoming.notices
        : Array.isArray(existing.notices)
          ? existing.notices
          : [],
    };
  };

  const appendPlanProviderMessages = (existingMessages: unknown, incomingMessages: FilingProviderMessage[] | undefined) =>
    mergeProviderMessages(existingMessages, incomingMessages || []);

  const getProviderLifecycleStatus = (snapshot: Record<string, unknown>) =>
    String(snapshot.providerLifecycleStatus || "").toLowerCase();

  const getPlanStatusFromProviderLifecycle = (snapshot: Record<string, unknown>) => {
    const lifecycle = getProviderLifecycleStatus(snapshot);
    if (lifecycle === "cancelled") return "cancelled";
    if (lifecycle === "closed") return "closed";
    if (lifecycle === "activated") return "activated";
    if (lifecycle === "proposed" || lifecycle === "filed") return "filed";
    return null;
  };

  const normalizeNotificationValue = (value: unknown) => {
    const normalized = formatProviderNotificationValue(value).replace(/\s+/g, " ").trim();
    return normalized || null;
  };

  const getProviderSnapshotRecord = (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};

  const getFlightPlanNotificationLabel = (plan: any) => {
    const title = normalizeNotificationValue(plan?.title);
    if (title) return title;
    const departure = normalizeNotificationValue(plan?.departure);
    const destination = normalizeNotificationValue(plan?.destination);
    if (departure && destination) return `${departure} -> ${destination}`;
    return departure || destination || "this flight plan";
  };

  const addUniqueNotificationLine = (lines: string[], line: string | null | undefined) => {
    const normalized = normalizeNotificationValue(line);
    if (normalized && !lines.includes(normalized)) lines.push(normalized);
  };

  const describeProviderSnapshotChanges = ({
    previousSnapshot,
    nextSnapshot,
  }: {
    previousSnapshot?: Record<string, unknown> | null;
    nextSnapshot?: Record<string, unknown> | null;
  }) => {
    const lines: string[] = [];
    const previous = previousSnapshot || {};
    const next = nextSnapshot || {};
    const previousRoute = getProviderSnapshotRecord(previous.route);
    const nextRoute = getProviderSnapshotRecord(next.route);
    const previousLifecycle = normalizeNotificationValue(previous.providerLifecycleStatus || previous.providerStatus);
    const nextLifecycle = normalizeNotificationValue(next.providerLifecycleStatus || next.providerStatus);
    if (nextLifecycle && previousLifecycle && nextLifecycle !== previousLifecycle) {
      addUniqueNotificationLine(lines, `Provider status changed from ${previousLifecycle} to ${nextLifecycle}.`);
    } else if (nextLifecycle && !previousLifecycle) {
      addUniqueNotificationLine(lines, `Provider status is now ${nextLifecycle}.`);
    }

    const previousArtcc = normalizeNotificationValue(previous.artccState);
    const nextArtcc = normalizeNotificationValue(next.artccState);
    if (nextArtcc && previousArtcc && nextArtcc !== previousArtcc) {
      addUniqueNotificationLine(lines, `ARTCC state changed from ${previousArtcc} to ${nextArtcc}.`);
    } else if (nextArtcc && !previousArtcc) {
      addUniqueNotificationLine(lines, `ARTCC state is now ${nextArtcc}.`);
    }

    const previousBeacon = normalizeNotificationValue(previous.beaconCode);
    const nextBeacon = normalizeNotificationValue(next.beaconCode);
    if (nextBeacon && previousBeacon !== nextBeacon) {
      addUniqueNotificationLine(lines, previousBeacon ? `Beacon code changed from ${previousBeacon} to ${nextBeacon}.` : `Beacon code assigned: ${nextBeacon}.`);
    }

    const providerRoute = normalizeNotificationValue(nextRoute.providerRoute);
    const previousProviderRoute = normalizeNotificationValue(previousRoute.providerRoute);
    const transmittedRoute = normalizeNotificationValue(nextRoute.normalizedTransmittedRoute);
    if (providerRoute && previousProviderRoute && providerRoute !== previousProviderRoute) {
      addUniqueNotificationLine(lines, `Provider route changed from ${previousProviderRoute} to ${providerRoute}.`);
    } else if (providerRoute && Boolean(nextRoute.changedByProvider)) {
      addUniqueNotificationLine(lines, `Provider route differs from RSF filing: ${transmittedRoute || "filed route"} -> ${providerRoute}.`);
    }

    const fieldDiffs = Array.isArray(next.fieldDiffs) ? next.fieldDiffs as FilingFieldDiff[] : [];
    for (const diff of fieldDiffs) {
      if (!diff?.changedByProvider || diff.field === "route") continue;
      const label = diff.field === "otherInfo" ? "Other Information" : diff.field;
      addUniqueNotificationLine(lines, `${label} changed by provider from ${diff.transmittedValue || "blank"} to ${diff.providerValue || "blank"}.`);
    }

    const previousNotices = new Set((Array.isArray(previous.notices) ? previous.notices : []).map((notice) => String(notice)));
    const addedNotices = (Array.isArray(next.notices) ? next.notices : [])
      .map((notice) => normalizeNotificationValue(notice))
      .filter((notice): notice is string => Boolean(notice && !previousNotices.has(notice)));
    for (const notice of addedNotices.slice(0, 2)) {
      addUniqueNotificationLine(lines, `Provider notice: ${notice}`);
    }

    return lines;
  };

  const buildProviderHistoryChanges = ({
    previousSnapshot,
    nextSnapshot,
  }: {
    previousSnapshot?: Record<string, unknown> | null;
    nextSnapshot?: Record<string, unknown> | null;
  }) => {
    const lines: string[] = [];
    const previous = previousSnapshot || {};
    const next = nextSnapshot || {};
    const previousRoute = getProviderSnapshotRecord(previous.route);
    const nextRoute = getProviderSnapshotRecord(next.route);
    const addLine = (line: string | null | undefined) => addUniqueNotificationLine(lines, line);
    const formatArrow = (before: unknown, after: unknown) => {
      const from = normalizeNotificationValue(before) || "blank";
      const to = normalizeNotificationValue(after) || "blank";
      return `${from} -> ${to}`;
    };

    const previousRouteText = normalizeNotificationValue(previousRoute.providerRoute);
    const nextRouteText = normalizeNotificationValue(nextRoute.providerRoute);
    if (nextRouteText && previousRouteText && nextRouteText !== previousRouteText) {
      addLine(`The filing provider changed route: ${previousRouteText} -> ${nextRouteText}`);
    } else if (nextRouteText && Boolean(nextRoute.changedByProvider)) {
      addLine(`The filing provider returned a modified route: ${formatArrow(nextRoute.normalizedTransmittedRoute, nextRouteText)}`);
    }

    const previousArtcc = normalizeNotificationValue(previous.artccState);
    const nextArtcc = normalizeNotificationValue(next.artccState);
    if (nextArtcc && previousArtcc && nextArtcc !== previousArtcc) {
      addLine(`ARTCC state changed: ${formatArrow(previousArtcc, nextArtcc)}`);
    } else if (nextArtcc && !previousArtcc) {
      addLine(`ARTCC state received: ${nextArtcc}`);
    }

    const previousFlightState = normalizeNotificationValue(previous.providerLifecycleStatus || previous.providerStatus);
    const nextFlightState = normalizeNotificationValue(next.providerLifecycleStatus || next.providerStatus);
    if (nextFlightState && previousFlightState && nextFlightState !== previousFlightState) {
      addLine(`Flight state changed: ${formatArrow(previousFlightState, nextFlightState)}`);
    } else if (nextFlightState && !previousFlightState) {
      addLine(`Flight state received: ${nextFlightState}`);
    }

    const previousVersion = normalizeNotificationValue(previous.versionStamp);
    const nextVersion = normalizeNotificationValue(next.versionStamp);
    if (nextVersion && previousVersion && nextVersion !== previousVersion) {
      addLine(`Provider version updated: ${formatArrow(previousVersion, nextVersion)}`);
    }

    const previousNotices = new Set((Array.isArray(previous.notices) ? previous.notices : []).map((notice) => String(notice)));
    const addedNotices = (Array.isArray(next.notices) ? next.notices : [])
      .map((notice) => normalizeNotificationValue(notice))
      .filter((notice): notice is string => Boolean(notice && !previousNotices.has(notice)));
    for (const notice of addedNotices.slice(0, 3)) {
      addLine(`Provider notice received: ${notice}`);
    }

    return lines.filter((line) => !/\[object Object\]/.test(line));
  };

  const appendFilingHistoryEntry = (existingHistory: unknown, entry: Record<string, unknown> | null) => {
    const history = Array.isArray(existingHistory) ? existingHistory as Array<Record<string, unknown>> : [];
    if (!entry) return history;
    const nextId = String(entry.id || "").trim();
    if (nextId && history.some((item) => String(item?.id || "").trim() === nextId)) return history;
    return [...history, entry];
  };

  const buildFlightPlanNotificationMessage = ({
    plan,
    previousSnapshot,
    nextSnapshot,
    pushFields,
    providerMessages,
    fallback,
  }: {
    plan: any;
    previousSnapshot?: Record<string, unknown> | null;
    nextSnapshot?: Record<string, unknown> | null;
    pushFields?: {
      changeType?: string | null;
      alertType?: string | null;
      notificationType?: string | null;
      flightState?: string | null;
      expectedRoute?: string | null;
      artccState?: string | null;
      artccInfo?: unknown;
      flightVersionStamp?: string | null;
    };
    providerMessages?: FilingProviderMessage[];
    fallback?: string | null;
  }) => {
    const lines: string[] = [];
    const planLabel = getFlightPlanNotificationLabel(plan);
    const push = pushFields || {};
    const providerFlightState = normalizeNotificationValue(push.flightState);
    const expectedRoute = normalizeNotificationValue(push.expectedRoute);
    const artccState = normalizeNotificationValue(push.artccState);
    const artccInfo = formatArtccInfo(push.artccInfo);
    const changeType = normalizeNotificationValue(push.changeType || push.alertType);

    if (changeType && !/^flight[_\s-]*(change|alert)$/i.test(changeType)) {
      addUniqueNotificationLine(lines, `Provider reported ${changeType} for ${planLabel}.`);
    }
    if (providerFlightState) addUniqueNotificationLine(lines, `Provider flight state: ${providerFlightState}.`);
    if (expectedRoute) addUniqueNotificationLine(lines, `Expected route from provider: ${expectedRoute}.`);
    if (artccState) addUniqueNotificationLine(lines, `ARTCC state: ${artccState}.`);
    if (artccInfo) addUniqueNotificationLine(lines, `ARTCC: ${artccInfo}.`);

    for (const line of describeProviderSnapshotChanges({ previousSnapshot, nextSnapshot })) {
      addUniqueNotificationLine(lines, line);
    }

    for (const message of (providerMessages || []).slice(0, 2)) {
      addUniqueNotificationLine(lines, message.details);
    }

    const fallbackText = normalizeNotificationValue(fallback);
    if (fallbackText && !/^flight[_\s-]*(change|alert)$/i.test(fallbackText)) {
      addUniqueNotificationLine(lines, fallbackText);
    }

    if (lines.length === 0) {
      addUniqueNotificationLine(lines, `The filing provider pushed an update for ${planLabel}. RSF refreshed the provider record, but the push did not identify a specific changed field.`);
    }

    return sanitizeNotificationMessage(lines.slice(0, 4).join(" "));
  };

  const addProviderStateMismatchNotice = (plan: any, snapshot: Record<string, unknown>, forceNotice?: string | null) => {
    const providerStatus = getPlanStatusFromProviderLifecycle(snapshot);
    const localStatus = String(plan.filingStatus || "draft").toLowerCase();
    if (!forceNotice && (!providerStatus || localStatus === providerStatus)) return snapshot;

    const notice = forceNotice || `External provider change detected: the filing provider now reports ${providerStatus}, while RSF had ${localStatus || "draft"}.`;
    const notices = Array.from(new Set([
      notice,
      ...(Array.isArray(snapshot.notices) ? snapshot.notices.map(String) : []),
    ]));

    return {
      ...snapshot,
      externalChangeDetected: true,
      externalChangeNotice: notice,
      notices,
    };
  };

  const buildExternalProviderChangeMessage = (plan: any, snapshot: Record<string, unknown>): FilingProviderMessage | null => {
    const notice = String(snapshot.externalChangeNotice || "").trim();
    if (!notice) return null;
    return {
      id: buildFilingEventId("sync", plan.id, "external_provider_change", notice),
      timestamp: new Date().toISOString(),
      severity: "warning",
      title: "External provider change detected",
      details: notice,
      source: "sync",
      provider: "Leidos Flight Service",
      providerPlanId: String(plan.filingProviderPlanId || snapshot.providerPlanId || "").trim() || null,
    };
  };

  const persistLeidosProviderSync = async (
    plan: any,
    syncResult: Awaited<ReturnType<typeof syncLeidosPlanMetadata>>,
    options: { extraMessages?: FilingProviderMessage[]; forceExternalNotice?: boolean } = {},
  ) => {
    const now = new Date();
    const currentRaw =
      plan.filingRaw && typeof plan.filingRaw === "object" && !Array.isArray(plan.filingRaw)
        ? plan.filingRaw as Record<string, unknown>
        : {};
    const nextRaw = {
      ...currentRaw,
      providerPlanId: syncResult.providerPlanId ?? currentRaw.providerPlanId ?? null,
      versionStamp: syncResult.versionStamp ?? currentRaw.versionStamp ?? null,
      metadataResponse: syncResult.metadataResponse ?? currentRaw.metadataResponse ?? null,
      retrievedAt: now.toISOString(),
    };
    const mergedSnapshotBase = syncResult.providerSnapshot
      ? mergeProviderSnapshot((plan as Record<string, unknown>).filingProviderSnapshot, syncResult.providerSnapshot)
      : asRecord((plan as Record<string, unknown>).filingProviderSnapshot);
    const nextProviderSnapshot = addProviderStateMismatchNotice(
      plan,
      mergedSnapshotBase,
      options.forceExternalNotice
        ? "External provider change detected: the filing provider rejected the requested action because the flight plan is no longer in the expected provider-side state."
        : null,
    );
    const externalMessage = buildExternalProviderChangeMessage(plan, nextProviderSnapshot);
    const nextProviderMessages = appendPlanProviderMessages(
      (plan as Record<string, unknown>).filingProviderMessages,
      [
        ...(options.extraMessages || []),
        ...(externalMessage ? [externalMessage] : []),
        ...syncResult.providerMessages,
      ],
    );
    const providerStatus = getPlanStatusFromProviderLifecycle(nextProviderSnapshot);
    const statusTimestamps: Record<string, Date> = {};
    if (providerStatus === "activated" && !plan.activatedAt) statusTimestamps.activatedAt = now;
    if (providerStatus === "cancelled" && !plan.cancelledAt) statusTimestamps.cancelledAt = now;
    if (providerStatus === "closed" && !plan.closedAt) statusTimestamps.closedAt = now;

    return storage.updateFlightPlan(plan.id, {
      filingProviderPlanId: syncResult.providerPlanId ?? plan.filingProviderPlanId,
      filingStatus: providerStatus || plan.filingStatus,
      filingPendingAction: providerStatus && ["cancelled", "closed"].includes(providerStatus) ? null : plan.filingPendingAction,
      filingIsLive: providerStatus ? !["cancelled", "closed"].includes(providerStatus) : plan.filingIsLive,
      filingLastProviderSyncAt: now,
      filingProviderSnapshot: Object.keys(nextProviderSnapshot || {}).length > 0 ? nextProviderSnapshot as any : null,
      filingProviderMessages: nextProviderMessages as any,
      filingAssignedBeaconCode: String((nextProviderSnapshot as any)?.beaconCode || plan.filingAssignedBeaconCode || "").trim() || null,
      filingRaw: nextRaw as any,
      ...statusTimestamps,
    } as any);
  };

  const filingPreviewSchema = z.object({
    live: z.literal(false).optional(),
    provider: z.string().optional(),
    flightRules: z.string().trim().default("VFR"),
    departure: z.string().trim().optional().nullable(),
    destination: z.string().trim().optional().nullable(),
    route: z.string().trim().optional().nullable(),
    alternate: z.string().trim().optional().nullable(),
    plannedDepartureLocal: z.string().trim().optional().nullable(),
    plannedDepartureUtc: z.string().trim().optional().nullable(),
    departureTimeZone: z.string().trim().optional().nullable(),
    plannedArrivalLocal: z.string().trim().optional().nullable(),
    plannedArrivalUtc: z.string().trim().optional().nullable(),
    destinationTimeZone: z.string().trim().optional().nullable(),
    trueAirspeedKtas: z.coerce.number().nullable().optional(),
    plannedAltitudeFt: z.union([z.string(), z.number()]).optional().nullable(),
    estimatedEnrouteMinutes: z.coerce.number().nullable().optional(),
    enduranceMinutes: z.coerce.number().nullable().optional(),
    fuelRequiredGallons: z.coerce.number().nullable().optional(),
    fuelOnBoardGallons: z.coerce.number().nullable().optional(),
    aircraftId: z.string().trim().optional().nullable(),
    aircraftType: z.string().trim().optional().nullable(),
    actualAircraftType: z.string().trim().optional().nullable(),
    equipment: z.string().trim().optional().nullable(),
    soulsOnBoard: z.string().trim().optional().nullable(),
    aircraftColor: z.string().trim().optional().nullable(),
    pilotName: z.string().trim().optional().nullable(),
    pilotPhone: z.string().trim().optional().nullable(),
    aircraftHomeBase: z.string().trim().optional().nullable(),
    wakeTurbulence: z.string().trim().optional().nullable(),
    typeOfFlight: z.string().trim().optional().nullable(),
    surveillanceEquipment: z.string().trim().optional().nullable(),
    otherInfo: z.string().trim().optional().nullable(),
    actualDepartureLocation: z.string().trim().optional().nullable(),
    actualDestinationLocation: z.string().trim().optional().nullable(),
    actualAlternateLocation: z.string().trim().optional().nullable(),
    departureName: z.string().trim().optional().nullable(),
    destinationName: z.string().trim().optional().nullable(),
    alternateName: z.string().trim().optional().nullable(),
    remarks: z.string().trim().optional().nullable(),
  });

  const filingLifecycleActionSchema = z.object({
    action: z.enum(flightPlanFilingActions),
    closeLocation: z.string().trim().optional().nullable(),
    testAcknowledgement: z.object({
      accepted: z.literal(true),
      environment: z.string().trim().optional().nullable(),
      acknowledgedAt: z.string().trim(),
      action: z.string().trim().optional().nullable(),
    }).optional().nullable(),
  });

  app.get("/api/flight-service/environment", (_req, res) => {
    const mode = getFlightServiceRuntimeMode();
    res.json({
      ...mode,
      testBannerTitle: mode.acknowledgementRequired ? "Flight Service Test Environment" : null,
      testBannerMessage: mode.acknowledgementRequired
        ? "This feature is operating in a non-operational Flight Service validation environment. Flight plans created here are not transmitted to the operational air traffic system and are not available to Air Traffic Control."
        : null,
    });
  });

  app.get("/api/admin/leidos-flight-service/status", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      res.json({
        ...getLeidosFlightServiceDiagnostics(),
        runtimeMode: getFlightServiceRuntimeMode(),
      });
    } catch (error) {
      console.error("Failed to build Leidos Flight Service diagnostics:", error);
      res.status(500).json({ error: "Failed to build Leidos Flight Service diagnostics" });
    }
  });

  app.get("/api/admin/leidos-flight-service/debug/:planId", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const plan = await storage.getFlightPlanById(String(req.params.planId || ""));
      if (!plan) {
        return res.status(404).json({ error: "Flight plan not found" });
      }

      const debug = getLeidosFlightServicePlanDebug(plan as any);
      const retrievalVerification = plan.filingProviderPlanId
        ? await verifyLeidosRetrievedPlanAgainstStoredPayload(plan as any)
        : null;
      res.json({
        ...debug,
        retrievalVerification,
      });
    } catch (error) {
      console.error("Failed to build Leidos Flight Service plan debug:", error);
      res.status(500).json({ error: "Failed to build Leidos Flight Service plan debug" });
    }
  });

  app.get("/api/admin/certification/latest", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      const latest = getLatestFlightServiceCertificationReport();
      if (!latest) {
        return res.json({
          exists: false,
          message: "No certification report has been generated yet. Run npm run certification:flight-service:report from the backend environment.",
        });
      }
      res.json({ exists: true, ...latest });
    } catch (error) {
      console.error("Failed to read latest Flight Service certification report:", error);
      res.status(500).json({ error: "Failed to read Flight Service certification report" });
    }
  });

  app.get("/api/admin/certification/reports", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      res.json({ reports: listFlightServiceCertificationReports() });
    } catch (error) {
      console.error("Failed to list Flight Service certification reports:", error);
      res.status(500).json({ error: "Failed to list Flight Service certification reports" });
    }
  });

  app.get("/api/admin/certification/reports/:id", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const report = getFlightServiceCertificationReport(String(req.params.id || ""));
      if (!report) {
        return res.status(404).json({ error: "Certification report not found" });
      }
      res.json(report);
    } catch (error) {
      console.error("Failed to read Flight Service certification report:", error);
      res.status(500).json({ error: "Failed to read Flight Service certification report" });
    }
  });

  app.get("/api/admin/certification/reports/:id/download/:format", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const download = resolveFlightServiceCertificationDownload(String(req.params.id || ""), String(req.params.format || ""));
      if (!download) {
        return res.status(404).json({ error: "Certification report file not found" });
      }
      res.setHeader("Content-Type", download.contentType);
      res.setHeader("Content-Disposition", `${download.contentType.startsWith("text/html") ? "inline" : "attachment"}; filename="${download.fileName}"`);
      fs.createReadStream(download.path).pipe(res);
    } catch (error) {
      console.error("Failed to download Flight Service certification report:", error);
      res.status(500).json({ error: "Failed to download Flight Service certification report" });
    }
  });

  app.get("/api/admin/flight-service-certification/runs", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      res.json({ runs: listFlightServiceStressRuns() });
    } catch (error) {
      console.error("Failed to list Flight Service stress certification runs:", error);
      res.status(500).json({ error: "Failed to list Flight Service stress certification runs" });
    }
  });

  app.get("/api/admin/flight-service-certification/runs/latest", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      const latest = getLatestFlightServiceStressRun();
      if (!latest) {
        return res.json({
          exists: false,
          message: "No stress certification run has completed yet. Run npm run certification:stress -- --mode=standard from the backend environment.",
        });
      }
      res.json({ exists: true, ...latest });
    } catch (error) {
      console.error("Failed to read latest Flight Service stress certification run:", error);
      res.status(500).json({ error: "Failed to read latest Flight Service stress certification run" });
    }
  });

  app.get("/api/admin/flight-service-certification/runs/:id", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const report = getFlightServiceStressRun(String(req.params.id || ""));
      if (!report) return res.status(404).json({ error: "Stress certification run not found" });
      res.json(report);
    } catch (error) {
      console.error("Failed to read Flight Service stress certification run:", error);
      res.status(500).json({ error: "Failed to read Flight Service stress certification run" });
    }
  });

  app.get("/api/admin/flight-service-certification/runs/:id/failures", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const failures = getFlightServiceStressRunFailures(String(req.params.id || ""));
      if (!failures) return res.status(404).json({ error: "Stress certification run not found" });
      res.json({ failures });
    } catch (error) {
      console.error("Failed to read Flight Service stress certification failures:", error);
      res.status(500).json({ error: "Failed to read Flight Service stress certification failures" });
    }
  });

  app.get("/api/admin/flight-service-certification/runs/:id/export.:format", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const exportFile = resolveFlightServiceStressExport(String(req.params.id || ""), String(req.params.format || ""));
      if (!exportFile) return res.status(404).json({ error: "Stress certification export not found" });
      res.setHeader("Content-Type", exportFile.contentType);
      res.setHeader("Content-Disposition", `${exportFile.contentType.startsWith("text/html") ? "inline" : "attachment"}; filename="${exportFile.fileName}"`);
      res.send(exportFile.body);
    } catch (error) {
      console.error("Failed to export Flight Service stress certification run:", error);
      res.status(500).json({ error: "Failed to export Flight Service stress certification run" });
    }
  });

  app.get("/api/admin/flight-service-certification/leidos-lab/runs", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      res.json({ runs: listLeidosLabCertificationRuns() });
    } catch (error) {
      console.error("Failed to list Leidos LAB certification runs:", error);
      res.status(500).json({ error: "Failed to list Leidos LAB certification runs" });
    }
  });

  app.get("/api/admin/flight-service-certification/leidos-lab/runs/latest", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      const latest = getLatestLeidosLabCertificationRun();
      if (!latest) {
        return res.json({
          exists: false,
          message: "No Leidos LAB certification run has completed yet. Run npm run certification:leidos -- --mode=smoke from the backend environment after setting the LAB safety env flags.",
        });
      }
      res.json({ exists: true, ...latest });
    } catch (error) {
      console.error("Failed to read latest Leidos LAB certification run:", error);
      res.status(500).json({ error: "Failed to read latest Leidos LAB certification run" });
    }
  });

  app.get("/api/admin/flight-service-certification/leidos-lab/runs/:id", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const report = getLeidosLabCertificationRun(String(req.params.id || ""));
      if (!report) return res.status(404).json({ error: "Leidos LAB certification run not found" });
      res.json(report);
    } catch (error) {
      console.error("Failed to read Leidos LAB certification run:", error);
      res.status(500).json({ error: "Failed to read Leidos LAB certification run" });
    }
  });

  app.get("/api/admin/flight-service-certification/leidos-lab/runs/:id/failures", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const failures = getLeidosLabCertificationRunFailures(String(req.params.id || ""));
      if (!failures) return res.status(404).json({ error: "Leidos LAB certification run not found" });
      res.json({ failures });
    } catch (error) {
      console.error("Failed to read Leidos LAB certification failures:", error);
      res.status(500).json({ error: "Failed to read Leidos LAB certification failures" });
    }
  });

  app.get("/api/admin/flight-service-certification/leidos-lab/runs/:id/export.:format", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const exportFile = resolveLeidosLabCertificationExport(String(req.params.id || ""), String(req.params.format || ""));
      if (!exportFile) return res.status(404).json({ error: "Leidos LAB certification export not found" });
      res.setHeader("Content-Type", exportFile.contentType);
      res.setHeader("Content-Disposition", `${exportFile.contentType.startsWith("text/html") ? "inline" : "attachment"}; filename="${exportFile.fileName}"`);
      res.send(exportFile.body);
    } catch (error) {
      console.error("Failed to export Leidos LAB certification run:", error);
      res.status(500).json({ error: "Failed to export Leidos LAB certification run" });
    }
  });

  app.post("/api/leidos/webhooks/flight-service", async (req: any, res) => {
    // Always return 200 to Leidos — non-200 responses may cause duplicate retries.
    try {
      if (!verifyLeidosWebhookAuthorization(req.headers.authorization)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // STEP 1 — Log the full raw payload for debugging during Leidos lab testing.
      const payload = req.body ?? {};
      const alert =
        payload.flightAlert && typeof payload.flightAlert === "object" && !Array.isArray(payload.flightAlert)
          ? payload.flightAlert
          : payload;

      // Determine notification type (FLIGHT_CHANGE or FLIGHT_ALERT).
      const notificationType: string =
        alert.notificationType ??
        alert.type ??
        alert.eventType ??
        payload.notificationType ??
        payload.type ??
        payload.eventType ??
        "";

      // Defensive extraction — Leidos lab payload field names may vary.
      const flightIdentifier: string | null =
        alert.flightIdentifier ??
        alert.planId ??
        alert.flightPlanId ??
        alert.id ??
        payload.flightIdentifier ??
        payload.planId ??
        payload.flightPlanId ??
        payload.id ??
        null;
      const flightVersionStamp: string | null =
        alert.flightVersionStamp ??
        alert.versionStamp ??
        payload.flightVersionStamp ??
        payload.versionStamp ??
        null;
      const flightState: string | null = alert.flightState ?? payload.flightState ?? null;
      const expectedRoute: string | null = alert.expectedRoute ?? payload.expectedRoute ?? null;
      const artccState: string | null = alert.artccState ?? payload.artccState ?? null;
      const artccInfo = alert.artccInfo ?? payload.artccInfo ?? null;

      console.info(JSON.stringify({
        event: "leidos_push_received",
        timestamp: new Date().toISOString(),
        userAgent: req.headers["user-agent"] || null,
        notificationType,
        flightIdentifier,
        payloadKeys: payload && typeof payload === "object" && !Array.isArray(payload) ? Object.keys(payload).slice(0, 25) : [],
      }));

      const changeType: string | null =
        alert.changeType ??
        alert.change ??
        payload.changeType ??
        payload.change ??
        null;

      const alertType: string | null =
        alert.alertType ??
        alert.alert ??
        payload.alertType ??
        payload.alert ??
        null;

      const extractedMessage: string =
        alert.alertMessage ??
        alert.message ??
        alert.description ??
        alert.detail ??
        payload.alertMessage ??
        payload.message ??
        payload.description ??
        payload.detail ??
        notificationType ??
        "Flight plan update received";

      if (!flightIdentifier) {
        console.info(JSON.stringify({
          event: "leidos_push_no_flight_identifier",
          timestamp: new Date().toISOString(),
          body: payload,
        }));
        return res.status(200).json({ ok: true });
      }

      try {
        // STEP 2 — Match to RSF flight plan.
        // NOTE: storage.getFlightPlanByProviderPlanId does not exist yet — using direct db query.
        const [matchedPlan] = await db
          .select()
          .from(flightPlans)
          .where(eq(flightPlans.filingProviderPlanId, flightIdentifier))
          .limit(1);

        if (!matchedPlan) {
          console.info(JSON.stringify({
            event: "leidos_push_no_matching_plan",
            timestamp: new Date().toISOString(),
            flightIdentifier,
          }));
          return res.status(200).json({ ok: true });
        }

        const isAlert = notificationType.toUpperCase().includes("ALERT");
        const inAppType = isAlert ? "flight_alert" : "flight_change";
        const pushTitle = isAlert ? "Flight Alert" : "Flight Plan Update";
        const hasExplicitProviderChange = Boolean(
          flightVersionStamp ||
          flightState ||
          expectedRoute ||
          artccState ||
          artccInfo ||
          changeType ||
          alertType ||
          notificationType,
        );
        const notificationTitle = hasExplicitProviderChange
          ? isAlert
            ? `Flight Alert${alertType ? `: ${alertType}` : ""}`
            : `Flight Plan Change${changeType ? `: ${changeType}` : ""}`
          : "Provider push received";
        const previousProviderSnapshot = getProviderSnapshotRecord((matchedPlan as Record<string, unknown>).filingProviderSnapshot);
        const pushContext = {
          changeType,
          alertType,
          notificationType,
          flightState,
          expectedRoute,
          artccState,
          artccInfo,
          flightVersionStamp,
        };
        console.info(JSON.stringify({
          event: "provider_update_notification_context",
          timestamp: new Date().toISOString(),
          flightIdentifier,
          notificationType,
          artccInfoRaw: (() => {
            try {
              return JSON.stringify(artccInfo);
            } catch {
              return null;
            }
          })(),
          artccInfoFormatted: formatArtccInfo(artccInfo) || null,
          hasExpectedRoute: Boolean(expectedRoute),
          hasFlightState: Boolean(flightState),
          hasArtccState: Boolean(artccState),
        }));
        const providerMessageDetails = buildFlightPlanNotificationMessage({
          plan: matchedPlan,
          previousSnapshot: previousProviderSnapshot,
          pushFields: pushContext,
          fallback: hasExplicitProviderChange
            ? extractedMessage
            : "The filing provider pushed an update for this flight plan. RSF refreshed provider sync; no route, status, ARTCC, or notice changes were reported in the push payload.",
        });
        const pushReceivedAt = String(payload.notificationTimestamp || payload.timestamp || new Date().toISOString());
        const providerMessage: FilingProviderMessage = {
          id: buildFilingEventId("webhook", flightIdentifier, notificationTitle, extractedMessage, pushReceivedAt),
          timestamp: pushReceivedAt,
          severity: isAlert ? "warning" : "info",
          title: notificationTitle,
          details: providerMessageDetails,
          source: "webhook",
          provider: "Leidos Flight Service",
          providerPlanId: flightIdentifier,
          providerReferenceId: String(payload.messageId || payload.referenceId || "").trim() || null,
          raw: payload,
        };

        // STEP 3 — Create in-app notification.
        const providerPushNotification = await storage.createUserNotification({
          userId: matchedPlan.userId,
          type: inAppType,
          title: notificationTitle,
          message: providerMessageDetails,
          meta: {
            flightPlanId: matchedPlan.id,
            providerPlanId: flightIdentifier,
            raw: payload,
          },
        });

        // STEP 4 — Deliver Expo push notification.
        const tokens = await storage.getPushTokensByUser(matchedPlan.userId);
        if (tokens.length > 0) {
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              tokens.map((token) => ({
                to: token.token,
                title: pushTitle,
                body: providerMessageDetails.slice(0, 100),
                data: {
                  flightPlanId: matchedPlan.id,
                  type: inAppType,
                },
              }))
            ),
          });
        }

        const providerReviewSnapshot = {
          versionStamp: flightVersionStamp || null,
          providerExpectedRoute: expectedRoute || null,
          providerFlightState: flightState || null,
          providerArtccState: artccState || null,
          providerArtccInfo: artccInfo || null,
          providerModifiedBySpecialist: hasExplicitProviderChange,
          providerPendingReview: hasExplicitProviderChange,
          providerLastPushTitle: notificationTitle,
          providerLastPushMessage: providerMessageDetails,
          lastProviderUpdateAt: new Date().toISOString(),
        };

        let syncedNotificationMessage = providerMessageDetails;
        let syncedNotificationChanges: string[] = [];
        const syncResult = await syncLeidosPlanMetadata(matchedPlan as any).catch(() => null);
        if (syncResult) {
          const syncedPlan = await persistLeidosProviderSync(matchedPlan as any, syncResult, { extraMessages: [providerMessage] });
          const syncedSnapshot =
            syncedPlan?.filingProviderSnapshot && typeof syncedPlan.filingProviderSnapshot === "object" && !Array.isArray(syncedPlan.filingProviderSnapshot)
              ? syncedPlan.filingProviderSnapshot as Record<string, unknown>
              : {};
          syncedNotificationChanges = describeProviderSnapshotChanges({
            previousSnapshot: previousProviderSnapshot,
            nextSnapshot: syncedSnapshot,
          });
          const providerHistoryChanges = buildProviderHistoryChanges({
            previousSnapshot: previousProviderSnapshot,
            nextSnapshot: syncedSnapshot,
          });
          const providerHistoryVersion = String(syncedSnapshot.versionStamp || providerReviewSnapshot.versionStamp || flightVersionStamp || "").trim();
          const providerHistoryEntry = providerHistoryChanges.length > 0
            ? {
              id: buildFilingEventId("webhook-history", flightIdentifier, "provider_changes_detected", providerHistoryVersion || pushReceivedAt),
              action: "flight_service",
              stagedAt: new Date().toISOString(),
              live: true,
              message: "The filing provider pushed provider changes for this flight plan.",
              providerPlanId: flightIdentifier,
              providerVersionStamp: providerHistoryVersion || null,
              changeSummary: {
                providerChanges: providerHistoryChanges,
              },
              raw: {
                notificationType,
                changeType,
                alertType,
                versionStamp: providerHistoryVersion || null,
              },
            }
            : null;
          syncedNotificationMessage = sanitizeNotificationMessage(buildFlightPlanNotificationMessage({
            plan: syncedPlan || matchedPlan,
            previousSnapshot: previousProviderSnapshot,
            nextSnapshot: syncedSnapshot,
            pushFields: pushContext,
            providerMessages: syncResult.providerMessages,
            fallback: providerMessageDetails,
          }));
          const providerChangeSummaryMessage: FilingProviderMessage | null = syncedNotificationMessage
            ? {
              id: buildFilingEventId("webhook", flightIdentifier, "provider_changes_detected", syncedNotificationMessage, pushReceivedAt),
              timestamp: pushReceivedAt,
              severity: syncedNotificationChanges.length > 0 ? "warning" : isAlert ? "warning" : "info",
              title: syncedNotificationChanges.length > 0 ? "Provider changes detected" : notificationTitle,
              details: syncedNotificationChanges.length > 0
                ? `The filing provider changed this plan: ${syncedNotificationChanges.join(" ")}`
                : syncedNotificationMessage,
              source: "webhook",
              provider: "FAA Flight Service",
              providerPlanId: flightIdentifier,
              providerReferenceId: String(payload.messageId || payload.referenceId || "").trim() || null,
              raw: {
                changedFields: syncedNotificationChanges,
                notificationType,
                changeType,
                alertType,
              },
            }
            : null;
          await storage.updateFlightPlan(matchedPlan.id, {
            filingProviderMessages: appendPlanProviderMessages(
              (syncedPlan as Record<string, unknown>)?.filingProviderMessages,
              [providerMessage, providerChangeSummaryMessage].filter(Boolean) as FilingProviderMessage[],
            ) as any,
            filingActionHistory: appendFilingHistoryEntry(
              (syncedPlan as Record<string, unknown>)?.filingActionHistory,
              providerHistoryEntry,
            ) as any,
            filingProviderSnapshot: {
              ...syncedSnapshot,
              ...providerReviewSnapshot,
              versionStamp: providerReviewSnapshot.versionStamp || syncedSnapshot.versionStamp || null,
            },
          } as any);
        } else {
          const existingSnapshot =
            matchedPlan.filingProviderSnapshot && typeof matchedPlan.filingProviderSnapshot === "object" && !Array.isArray(matchedPlan.filingProviderSnapshot)
              ? matchedPlan.filingProviderSnapshot as Record<string, unknown>
              : {};
          const mergedMessages = appendPlanProviderMessages(
            (matchedPlan as Record<string, unknown>).filingProviderMessages,
            [providerMessage],
          );
          await storage.updateFlightPlan(matchedPlan.id, {
            filingProviderMessages: mergedMessages as any,
            filingProviderSnapshot: {
              ...existingSnapshot,
              ...providerReviewSnapshot,
              versionStamp: providerReviewSnapshot.versionStamp || existingSnapshot.versionStamp || null,
            },
          } as any);
        }
        if (syncedNotificationMessage !== providerMessageDetails || syncedNotificationChanges.length > 0) {
          await db
            .update(userNotifications)
            .set({
              message: syncedNotificationMessage,
              meta: {
                flightPlanId: matchedPlan.id,
                providerPlanId: flightIdentifier,
                changedFields: syncedNotificationChanges,
                raw: payload,
              } as any,
              updatedAt: new Date(),
            })
            .where(eq(userNotifications.id, providerPushNotification.id));
        }
      } catch (innerError) {
        console.error(JSON.stringify({
          event: "leidos_push_error",
          timestamp: new Date().toISOString(),
          flightIdentifier,
          error: innerError instanceof Error ? innerError.message : String(innerError),
        }));
      }

      // STEP 6 — Always return 200 to Leidos.
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error(JSON.stringify({
        event: "leidos_push_error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      }));
      // Return 200 even on unexpected errors to prevent Leidos retry storms.
      res.status(200).json({ ok: true });
    }
  });

  app.post("/api/flight-plans/filing-preview", flightPlanUtilityRateLimiter, async (req: any, res) => {
    try {
      const result = filingPreviewSchema.safeParse(req.body ?? {});
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }

      const packet = result.data;
      const flightRules = (packet.flightRules || "VFR").toUpperCase();
      const routeNormalization = normalizeRouteForProvider(packet.route);
      const dofPreview = buildOtherInfoWithDof({
        existingOtherInfo: packet.otherInfo,
        plannedDepartureAt: packet.plannedDepartureUtc,
        operationalTimeZone: packet.departureTimeZone || undefined,
      });
      const previewOtherInfo = packet.aircraftType?.toUpperCase() === "ZZZZ"
        ? buildOtherInfoWithAircraftType(dofPreview.otherInfo, packet.actualAircraftType)
        : dofPreview.otherInfo;
      const zzzzPreviewOtherInfo = buildZzzzOtherInfoForLeidos(previewOtherInfo, {
        departureName: packet.departure?.toUpperCase() === "ZZZZ" ? packet.departureName : null,
        destinationName: packet.destination?.toUpperCase() === "ZZZZ" ? packet.destinationName : null,
        alternateName: packet.alternate?.toUpperCase() === "ZZZZ" ? packet.alternateName : null,
        departureLocation: packet.departure?.toUpperCase() === "ZZZZ" ? packet.actualDepartureLocation : null,
        destinationLocation: packet.destination?.toUpperCase() === "ZZZZ" ? packet.actualDestinationLocation : null,
        alternateLocation: packet.alternate?.toUpperCase() === "ZZZZ" ? packet.actualAlternateLocation : null,
      });
      const errors: string[] = [];
      const warnings: string[] = [];
      if (!packet.departure) errors.push("Departure airport is required.");
      if (!packet.destination) errors.push("Destination airport is required.");
      if (!packet.aircraftId) errors.push("Aircraft ID / tail number is required.");
      if (!packet.aircraftType) errors.push("Aircraft type is required.");
      if (packet.aircraftType?.toUpperCase() === "ZZZZ" && !normalizeActualAircraftTypeForIcao(packet.actualAircraftType)) {
        errors.push("Actual aircraft type is required when Aircraft Type is ZZZZ.");
      }
      if (!packet.pilotName) errors.push("Pilot in command name is required.");
      if (!packet.pilotPhone) errors.push("Pilot phone number is required.");
      if (!packet.aircraftHomeBase) errors.push("Aircraft home base is required.");
      if (!packet.soulsOnBoard) errors.push("Souls on board must be entered.");
      if (!packet.wakeTurbulence) errors.push("Wake turbulence category is required.");
      if (!packet.typeOfFlight) errors.push("Type of flight is required.");
      if (!packet.surveillanceEquipment) errors.push("Surveillance equipment is required.");
      if (!packet.remarks) errors.push("Filing Remarks / ATC Remarks are required.");
      if (packet.departure?.toUpperCase() === "ZZZZ" && !isValidZzzzActualLocation(packet.actualDepartureLocation)) {
        errors.push("Departure is ZZZZ - enter an actual departure FAA identifier or latitude/longitude.");
      }
      if (packet.departure?.toUpperCase() === "ZZZZ" && !String(packet.departureName || "").trim()) {
        errors.push("Please enter a brief description of this location (for example: Private Strip, Grass Airstrip, Smith Ranch, Helipad).");
      }
      if (packet.destination?.toUpperCase() === "ZZZZ" && !isValidZzzzActualLocation(packet.actualDestinationLocation)) {
        errors.push("Destination is ZZZZ - enter an actual destination FAA identifier or latitude/longitude.");
      }
      if (packet.destination?.toUpperCase() === "ZZZZ" && !String(packet.destinationName || "").trim()) {
        errors.push("Please enter a brief description of this location (for example: Private Strip, Grass Airstrip, Smith Ranch, Helipad).");
      }
      if (packet.alternate?.toUpperCase() === "ZZZZ" && !isValidZzzzActualLocation(packet.actualAlternateLocation)) {
        errors.push("Alternate is ZZZZ - enter an actual alternate FAA identifier or latitude/longitude.");
      }
      if (packet.alternate?.toUpperCase() === "ZZZZ" && !String(packet.alternateName || "").trim()) {
        errors.push("Please enter a brief description of this location (for example: Private Strip, Grass Airstrip, Smith Ranch, Helipad).");
      }
      if (flightRules === "IFR" && !routeNormalization.normalizedRoute) {
        errors.push("IFR filing requires a route before handoff.");
      }
      if (!packet.plannedDepartureUtc) {
        errors.push("Planned departure time is missing or not convertible to UTC.");
      }
      if (!packet.enduranceMinutes || packet.enduranceMinutes <= 0) {
        warnings.push("Endurance is not available yet. Review fuel on board before filing.");
      }
      if (flightRules === "IFR" && !packet.alternate) {
        warnings.push("Consider adding an alternate before filing IFR.");
      }
      if (flightRules !== "IFR" && !routeNormalization.normalizedRoute) {
        warnings.push("VFR handoff can proceed direct, but route detail improves the filing packet.");
      }
      warnings.push(...routeNormalization.notes);
      if (!packet.equipment) {
        warnings.push("Equipment code is blank. Verify equipment capability before filing.");
      }
      if (packet.route && String(packet.route).trim().toUpperCase() !== "DCT" && !routeNormalization.hasValidToken) {
        errors.push("Route must contain at least one valid airport, fix, navaid, airway, or procedure token.");
      }

      const normalizedPacket = {
        ...packet,
        flightRules,
        route: routeNormalization.localEnteredRoute,
        normalizedRoute: routeNormalization.normalizedRoute,
        otherInfo: zzzzPreviewOtherInfo,
        dof: dofPreview.dof,
        dofInjected: dofPreview.injected,
        provider: "flight-service-handoff-staged",
      };
      const providerDiagnostics = getLeidosFlightServiceDiagnostics();

      const nextSteps = [
        "Review aircraft ID, route, and departure time for filing accuracy.",
        "Flight filing is in final validation. Use this packet only for approved testing until production approval is complete.",
        normalizedPacket.flightRules === "IFR"
          ? "After filing, obtain your IFR clearance from ATC using the published airport procedure."
          : "Activate and close the flight plan through the filing provider when appropriate.",
      ];

      const providerConfigured =
        providerDiagnostics.enabled &&
        providerDiagnostics.usernameConfigured &&
        providerDiagnostics.passwordConfigured &&
        Boolean(providerDiagnostics.actionPaths.file);
      const liveAvailable = false;

      res.json({
        live: liveAvailable,
        provider: "Flight Service provider",
        routeType: normalizedPacket.flightRules,
        readyToFile: errors.length === 0,
        providerUrl: providerDiagnostics.baseUrl,
        liveAvailable,
        diagnostics: {
          environment: providerDiagnostics.environment,
          providerConfigured,
          actionPathsConfigured: Object.entries(providerDiagnostics.actionPaths).reduce((acc, [key, value]) => ({
            ...acc,
            [key]: Boolean(value),
          }), {} as Record<string, boolean>),
        },
        errors,
        warnings,
        nextSteps,
        preview: {
          localRoute: routeNormalization.localEnteredRoute,
          transmittedRoute: routeNormalization.normalizedRoute,
          routeChanged: routeNormalization.changed,
          dof: dofPreview.dof,
          dofInjected: dofPreview.injected,
          localOtherInfo: packet.otherInfo || null,
          transmittedOtherInfo: zzzzPreviewOtherInfo,
        },
        packet: normalizedPacket,
      });
    } catch (error) {
      console.error("Failed to build filing preview:", error);
      res.status(500).json({ error: "Failed to build filing preview" });
    }
  });

  app.get("/api/flight-plans/route-search", isAuthenticated, async (req: any, res) => {
    try {
      const departure = typeof req.query.departure === "string" ? req.query.departure.trim().toUpperCase() : "";
      const destination = typeof req.query.destination === "string" ? req.query.destination.trim().toUpperCase() : "";
      const altitudeRaw = typeof req.query.altitudeFt === "string" ? Number(req.query.altitudeFt) : null;
      const altitudeFt = Number.isFinite(altitudeRaw) ? altitudeRaw : null;

      if (!departure || !destination) {
        return res.status(400).json({ error: "Departure and destination are required." });
      }

      if (!/^[A-Z0-9]{3,4}$/.test(departure) || !/^[A-Z0-9]{3,4}$/.test(destination)) {
        return res.status(400).json({ error: "Departure and destination must be valid ICAO/IATA-style identifiers." });
      }

      const payload = await searchLeidosRoute({ departure, destination, altitudeFt });
      res.json(payload);
    } catch (error: any) {
      const message = String(error?.message || "");
      const isExpectedLabTimeout =
        /route assist timed out in the lab|did not respond in time|connect timeout|fetch failed/i.test(message);
      if (!isExpectedLabTimeout) {
        console.error("Failed to search Leidos route:", error);
      }
      res.json({
        provider: "Flight Service provider",
        environment: getLeidosFlightServiceDiagnostics().environment,
        departure: typeof req.query.departure === "string" ? req.query.departure.trim().toUpperCase() : "",
        destination: typeof req.query.destination === "string" ? req.query.destination.trim().toUpperCase() : "",
        route: null,
        atcRecentIFRRoutes: [],
        codedDepartureRoutes: [],
        faaPreferredRoutes: [],
        warnings: [],
        available: false,
        message: message || "Provider route search is unavailable right now.",
      });
    }
  });

  app.get("/api/flight-plans/route-analysis", flightPlanUtilityRateLimiter, async (req: any, res) => {
    try {
      const route = typeof req.query.route === "string" ? req.query.route : "";
      const analysis = analyzeFiledRoute(route);

      if (!analysis.normalizedRoute) {
        return res.json({
          ...analysis,
          recognizedAirportTokens: [],
          unresolvedAirportTokens: [],
        });
      }

      const stations = await loadStationCache();
      const referenceMap = await loadAirportReferenceCache().catch(() => null);

      const recognizedAirportTokens = analysis.airportTokens.filter((token) => {
        const candidates = buildIcaoCandidates(token);
        if (stations.some((station) => candidates.includes(station.icao))) {
          return true;
        }
        if (!referenceMap) {
          return false;
        }
        return candidates.some((candidate) => referenceMap.has(candidate));
      });

      const unresolvedAirportTokens = analysis.airportTokens.filter((token) => !recognizedAirportTokens.includes(token));
      const warnings = [...analysis.warnings];
      if (unresolvedAirportTokens.length > 0) {
        warnings.push(`RSF could not resolve these airport-style tokens in current route references: ${unresolvedAirportTokens.join(", ")}.`);
      }

      return res.json({
        ...analysis,
        warnings,
        recognizedAirportTokens,
        unresolvedAirportTokens,
      });
    } catch (error) {
      console.error("Failed to analyze filed route:", error);
      res.status(500).json({ error: "Failed to analyze filed route" });
    }
  });

  app.post("/api/flight-plans/guest-file", flightFilingRateLimiter, async (req: any, res) => {
    return res.status(401).json({ error: "Create or sign in to your RSF account to file flight plans." });
  });

  app.post("/api/flight-plans/:id/filing-action", isAuthenticated, flightFilingRateLimiter, async (req: any, res) => {
    let planForErrorSync: any = null;
    try {
      const mergePreservedFilingRaw = (existingRaw: unknown, incomingRaw: unknown) => {
        const existingRecord =
          existingRaw && typeof existingRaw === "object" && !Array.isArray(existingRaw)
            ? existingRaw as Record<string, unknown>
            : {};
        const incomingRecord =
          incomingRaw && typeof incomingRaw === "object" && !Array.isArray(incomingRaw)
            ? incomingRaw as Record<string, unknown>
            : {};
        return {
          ...existingRecord,
          ...incomingRecord,
          metadataResponse: incomingRecord.metadataResponse ?? existingRecord.metadataResponse ?? null,
          versionStamp: incomingRecord.versionStamp ?? existingRecord.versionStamp ?? null,
          response: incomingRecord.response ?? existingRecord.response ?? null,
        };
      };

      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const plan = await storage.getFlightPlanById(req.params.id);
      if (!plan) {
        return res.status(404).json({ error: "Flight plan not found" });
      }
      planForErrorSync = plan;
      if (plan.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const parsed = filingLifecycleActionSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.format() });
      }
      const action = parsed.data.action as FlightPlanFilingAction;
      const closeLocation = parsed.data.closeLocation || null;
      const runtimeMode = getFlightServiceRuntimeMode();
      const testerEmails = new Set(
        String(process.env.FLIGHT_SERVICE_TESTER_EMAILS || "")
          .split(",")
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      );
      const userEmail = String((user as any).email || "").trim().toLowerCase();
      const canUseProviderFiling =
        runtimeMode.operationalFilingEnabled ||
        Boolean((user as any).isSuperAdmin || (user as any).isAdmin) ||
        (userEmail && testerEmails.has(userEmail));
      if (!canUseProviderFiling) {
        console.warn(JSON.stringify({
          event: "flight_service_test_mode_action_blocked",
          flight_service_environment: runtimeMode.environment,
          flight_filing_operational_enabled: runtimeMode.operationalFilingEnabled,
          testAcknowledgementRequired: runtimeMode.acknowledgementRequired,
          action,
          planId: plan.id,
          userId,
          userEmail: userEmail || null,
          blockedBecausePublicOperationalDisabled: true,
        }));
        return res.status(403).json({
          error: "Flight filing is currently in validation mode and is not available for operational use.",
          code: "FLIGHT_SERVICE_VALIDATION_ONLY",
        });
      }
      const acknowledgementAccepted = !runtimeMode.acknowledgementRequired ||
        hasFlightServiceTestAcknowledgement(req.body, runtimeMode.environment);
      console.info(JSON.stringify({
        event: "flight_service_environment",
        flight_service_environment: runtimeMode.environment,
        flight_filing_operational_enabled: runtimeMode.operationalFilingEnabled,
        testAcknowledgementRequired: runtimeMode.acknowledgementRequired,
        testAcknowledgementAccepted: acknowledgementAccepted,
        action,
        planId: plan.id,
        userId,
        userEmail: userEmail || null,
        blockedBecausePublicOperationalDisabled: false,
      }));
      if (!acknowledgementAccepted) {
        return res.status(428).json({
          error: "Flight Service validation mode acknowledgement is required before this test action.",
          code: "FLIGHT_SERVICE_TEST_ACKNOWLEDGEMENT_REQUIRED",
          flightServiceEnvironment: runtimeMode.environment,
        });
      }
      const flightRules = (plan.filingFlightRules || "VFR").toUpperCase();
      if (action === "file") {
        const entitlements = getEntitlementsForUser(user);
        const plans = await storage.getFlightPlansByUser(userId);
        const activePlanAccess = canCreateAnotherActiveFlightPlan({
          isPremium: Boolean(entitlements.canUseUnlimitedActiveFlightPlans),
          existingPlans: plans,
          exceptPlanId: plan.id,
        });
        if (!activePlanAccess.allowed) {
          return res.status(403).json({
            error: activePlanAccess.message || ACTIVE_FLIGHT_PLAN_LIMIT_MESSAGE,
            code: "ACTIVE_FLIGHT_PLAN_LIMIT",
            activeFlightPlanCount: activePlanAccess.activeCount,
          });
        }
      }
      const actionProviderSnapshot = asRecord((plan as Record<string, unknown>).filingProviderSnapshot);
      if (action === "amend" && actionProviderSnapshot.providerPendingReview === true) {
        return res.status(409).json({
          error: "The filing provider has updated this flight plan. Review and accept or reconcile those changes before submitting another amendment.",
          requiresProviderReview: true,
          providerSnapshot: actionProviderSnapshot,
          plan,
        });
      }
      if (["cancel", "close", "activate"].includes(action) && plan.filingProviderPlanId) {
        const providerSnapshot = asRecord((plan as Record<string, unknown>).filingProviderSnapshot);
        const availability = asRecord(providerSnapshot.providerActionAvailability);
        const lifecycle = getProviderLifecycleStatus(providerSnapshot);
        if (!lifecycle || lifecycle === "unknown" || availability.requiresSync === true) {
          return res.status(409).json({
            error: "RSF needs a fresh provider sync before this action because the current provider state is unknown.",
            requiresProviderSync: true,
            plan,
          });
        }
        const available = action === "cancel" ? availability.cancel : action === "close" ? availability.close : availability.activate;
        if (available === false) {
          return res.status(409).json({
            error: `The filing provider currently reports this flight plan as ${lifecycle}. ${action.toUpperCase()} is not available for that provider state.`,
            providerLifecycleStatus: lifecycle,
            plan,
          });
        }
      }
      if ((action === "activate" || action === "close") && flightRules !== "VFR") {
        return res.status(400).json({ error: `${action} is only available for VFR flight plans.` });
      }

      const effectivePlanForAction = closeLocation
        ? { ...plan, filingCloseLocation: closeLocation } as typeof plan
        : plan;

      const validation = validateFlightPlanForAction(effectivePlanForAction, action);
      if (!validation.ready) {
        console.warn(JSON.stringify({
          event: "flight_plan_filing_validation_failed",
          planId: plan.id,
          action,
          departure: plan.departure || null,
          destination: plan.destination || null,
          alternate: plan.alternate || null,
          tailNumber: plan.tailNumber || null,
          filingDepartureName: plan.filingDepartureName || null,
          filingDestinationName: plan.filingDestinationName || null,
          filingAlternateName: plan.filingAlternateName || null,
          planningReferenceDepartureAirport: (plan.plannerState as any)?.planningReferenceDepartureAirport || null,
          planningReferenceDestinationAirport: (plan.plannerState as any)?.planningReferenceDestinationAirport || null,
          planningReferenceAlternateAirport: (plan.plannerState as any)?.planningReferenceAlternateAirport || null,
          errors: validation.errors,
          warnings: validation.warnings,
        }));
        return res.status(400).json({
          error: "Flight plan is not ready for this action.",
          validation,
        });
      }

      const providerResult = await flightPlanFilingProvider.stageAction(effectivePlanForAction, action);
      const currentHistory = Array.isArray(plan.filingActionHistory) ? plan.filingActionHistory : [];
      const now = new Date();
      const historyEntry = {
        action,
        stagedAt: now.toISOString(),
        live: providerResult.live,
        message: providerResult.message,
        warnings: providerResult.warnings,
        validation,
        providerPlanId: providerResult.providerPlanId,
        raw: providerResult.raw,
      };

      const statusTimestamps: Record<string, Date> = {};
      if (providerResult.nextStatus === "filed") statusTimestamps.filedAt = now;
      if (providerResult.nextStatus === "activated") statusTimestamps.activatedAt = now;
      if (providerResult.nextStatus === "cancelled") statusTimestamps.cancelledAt = now;
      if (providerResult.nextStatus === "closed") statusTimestamps.closedAt = now;

      const preserveExistingLifecycleState =
        !providerResult.live &&
        providerResult.nextStatus === "staged" &&
        ["filed", "activated", "cancelled", "closed"].includes(String(plan.filingStatus || "").toLowerCase());

      const nextFilingStatus = preserveExistingLifecycleState
        ? plan.filingStatus
        : providerResult.nextStatus;
      const nextFilingIsLive = preserveExistingLifecycleState
        ? plan.filingIsLive
        : providerResult.live;
      const nextFilingRaw = preserveExistingLifecycleState
        ? mergePreservedFilingRaw(plan.filingRaw, providerResult.raw)
        : providerResult.raw;
      const nextProviderPlanId = preserveExistingLifecycleState
        ? providerResult.providerPlanId || plan.filingProviderPlanId
        : providerResult.providerPlanId;
      const nextFilingPayload = providerResult.payloadSnapshot ?? asRecord((plan as Record<string, unknown>).filingPayload);
      const nextProviderSnapshot = providerResult.providerSnapshot
        ? mergeProviderSnapshot((plan as Record<string, unknown>).filingProviderSnapshot, providerResult.providerSnapshot)
        : asRecord((plan as Record<string, unknown>).filingProviderSnapshot);
      const nextProviderMessages = appendPlanProviderMessages(
        (plan as Record<string, unknown>).filingProviderMessages,
        providerResult.providerMessages,
      );

      let updated = await storage.updateFlightPlan(plan.id, {
        filingProvider: "leidos_flight_service",
        filingProviderPlanId: nextProviderPlanId,
        filingStatus: nextFilingStatus,
        filingPendingAction: providerResult.live ? null : action,
        filingIsLive: nextFilingIsLive,
        filingLastProviderSyncAt: now,
        filingPayload: Object.keys(nextFilingPayload || {}).length > 0 ? nextFilingPayload as any : null,
        filingProviderSnapshot: Object.keys(nextProviderSnapshot || {}).length > 0 ? nextProviderSnapshot as any : null,
        filingProviderMessages: nextProviderMessages as any,
        filingAssignedBeaconCode: String((nextProviderSnapshot as any)?.beaconCode || plan.filingAssignedBeaconCode || "").trim() || null,
        filingRaw: nextFilingRaw,
        filingActionHistory: [...currentHistory, historyEntry],
        ...statusTimestamps,
      } as any);

      if (updated?.filingProviderPlanId) {
        try {
          const postActionSync = await syncLeidosPlanMetadata(updated as any);
          updated = await persistLeidosProviderSync(updated as any, postActionSync);
        } catch (syncError: any) {
          console.warn("Leidos post-action sync failed:", syncError?.message || syncError);
        }
      }

      if (providerResult.live) {
        const actionTitles: Record<string, string> = {
          file: "Flight plan filed",
          amend: "Amendment accepted",
          cancel: "Cancellation confirmed",
          activate: "Flight plan activated",
          close: "Flight plan closed",
        };
        const planLabel = plan.title || `${plan.departure} to ${plan.destination}`;
        const dep = plan.departure ? ` (${plan.departure}` : "";
        const dest = plan.destination ? ` → ${plan.destination})` : (dep ? ")" : "");
        const legs = dep && dest ? `${dep}${dest}` : "";
        const actionMessages: Record<string, string> = {
          file: `Your flight plan${legs} has been accepted by the filing provider. Track updates and provider changes from this notification center.`,
          amend: `Your amendment for "${planLabel}"${legs} was accepted by the provider. Check Provider Updates for the effective route.`,
          cancel: `Your flight plan${legs} has been cancelled with the provider.`,
          activate: `Your VFR flight plan${legs} is now activated. Safe flight!`,
          close: `Your VFR flight plan${legs} has been closed.`,
        };
        const today = new Date();
        storage.upsertUserNotification({
          userId,
          type: `flight_plan_${action}:${plan.id}`,
          title: actionTitles[action] || "Flight plan updated",
          message: actionMessages[action] || providerResult.message,
          referenceDate: today as any,
          channels: ["in_app"],
          isRead: false,
          meta: { planId: plan.id, planTitle: plan.title, action, providerPlanId: providerResult.providerPlanId } as any,
        }).catch((err) => console.warn("Failed to create filing notification:", err));
      }

      res.json({
        ...providerResult,
        plan: updated,
      });
    } catch (error: any) {
      console.error("Failed to stage flight plan filing action:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to stage flight plan filing action";
      const isTimeout = /timed out before Flight Service responded|connect timeout|timed out/i.test(message);
      const isProviderValidationError = /Webservice\.ValidationError/i.test(message);
      const isProviderStateRejected = /Webservice\.Cannot|not in the PROPOSED state|could not be cancelled/i.test(message);
      const isProviderRejected = /Leidos returned an unsuccessful/i.test(message);
      let syncedPlan: any = null;
      if (isProviderStateRejected && planForErrorSync?.filingProviderPlanId) {
        try {
          const mismatchSync = await syncLeidosPlanMetadata(planForErrorSync as any);
          syncedPlan = await persistLeidosProviderSync(planForErrorSync as any, mismatchSync, {
            forceExternalNotice: true,
            extraMessages: [{
              id: buildFilingEventId("provider", planForErrorSync.id, "state_mismatch", message),
              timestamp: new Date().toISOString(),
              severity: "warning",
              title: "External provider change detected",
              details: "The filing provider rejected the action because the provider-side flight plan state changed. RSF refreshed the provider record; review the current status before taking another action.",
              source: "provider",
              action: null,
              provider: "FAA Flight Service",
              providerPlanId: planForErrorSync.filingProviderPlanId || null,
            }],
          });
        } catch (syncError: any) {
          console.warn("Leidos mismatch sync failed:", syncError?.message || syncError);
        }
      }
      res.status(isTimeout ? 504 : isProviderStateRejected ? 409 : (isProviderValidationError || isProviderRejected) ? 400 : 500).json({
        error: isProviderStateRejected
          ? "The filing provider says this flight plan is no longer in the provider state required for that action. RSF refreshed the provider record; review the current status and available actions."
          : message,
        providerMessage: message,
        plan: syncedPlan,
      });
    }
  });

  app.post("/api/flight-plans/:id/filing-sync", isAuthenticated, flightFilingRateLimiter, async (req: any, res) => {
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
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const runtimeMode = getFlightServiceRuntimeMode();
      const testerEmails = new Set(
        String(process.env.FLIGHT_SERVICE_TESTER_EMAILS || "")
          .split(",")
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      );
      const userEmail = String((user as any).email || "").trim().toLowerCase();
      const canUseProviderSync =
        runtimeMode.operationalFilingEnabled ||
        Boolean((user as any).isSuperAdmin || (user as any).isAdmin) ||
        (userEmail && testerEmails.has(userEmail));
      if (!canUseProviderSync) {
        console.warn(JSON.stringify({
          event: "flight_service_test_mode_action_blocked",
          flight_service_environment: runtimeMode.environment,
          flight_filing_operational_enabled: runtimeMode.operationalFilingEnabled,
          testAcknowledgementRequired: runtimeMode.acknowledgementRequired,
          action: "sync",
          planId: plan.id,
          userId,
          userEmail: userEmail || null,
          blockedBecausePublicOperationalDisabled: true,
        }));
        return res.status(403).json({
          error: "Flight filing is currently in validation mode and is not available for operational use.",
          code: "FLIGHT_SERVICE_VALIDATION_ONLY",
        });
      }
      const acknowledgementAccepted = !runtimeMode.acknowledgementRequired ||
        hasFlightServiceTestAcknowledgement(req.body, runtimeMode.environment);
      console.info(JSON.stringify({
        event: "flight_service_environment",
        flight_service_environment: runtimeMode.environment,
        flight_filing_operational_enabled: runtimeMode.operationalFilingEnabled,
        testAcknowledgementRequired: runtimeMode.acknowledgementRequired,
        testAcknowledgementAccepted: acknowledgementAccepted,
        action: "sync",
        planId: plan.id,
        userId,
        userEmail: userEmail || null,
        blockedBecausePublicOperationalDisabled: false,
      }));
      if (!acknowledgementAccepted) {
        return res.status(428).json({
          error: "Flight Service validation mode acknowledgement is required before this test action.",
          code: "FLIGHT_SERVICE_TEST_ACKNOWLEDGEMENT_REQUIRED",
          flightServiceEnvironment: runtimeMode.environment,
        });
      }

      const syncResult = await syncLeidosPlanMetadata(plan as any);
      const updated = await persistLeidosProviderSync(plan as any, syncResult);
      const nextSnapshot = asRecord((updated as Record<string, unknown>).filingProviderSnapshot);

      console.info(JSON.stringify({
        event: "leidos_sync_persisted",
        planId: plan.id,
        providerPlanId: syncResult.providerPlanId ?? plan.filingProviderPlanId,
        versionStamp: syncResult.versionStamp,
        providerLifecycleStatus: nextSnapshot.providerLifecycleStatus || null,
        notices: Array.isArray(nextSnapshot.notices) ? nextSnapshot.notices : [],
      }));

      const routeChangedByProvider = Boolean(syncResult.providerSnapshot?.route?.changedByProvider);
      const hasProviderMessages = syncResult.providerMessages.length > 0 || Boolean(nextSnapshot.externalChangeDetected);
      if (routeChangedByProvider || hasProviderMessages) {
        const planLabel = plan.title || `${plan.departure} to ${plan.destination}`;
        const providerRoute = (syncResult.providerSnapshot?.route as any)?.providerRoute ?? null;
        const previousSnapshot = getProviderSnapshotRecord((plan as Record<string, unknown>).filingProviderSnapshot);
        const changedFields = describeProviderSnapshotChanges({ previousSnapshot, nextSnapshot });
        const syncNotificationMessage = buildFlightPlanNotificationMessage({
          plan,
          previousSnapshot,
          nextSnapshot,
          providerMessages: syncResult.providerMessages,
          fallback: nextSnapshot.externalChangeDetected
            ? String(nextSnapshot.externalChangeNotice || "The filing provider returned a state that differs from RSF's prior local state.")
            : routeChangedByProvider
            ? `Your filed route for "${planLabel}" was adjusted by the provider. Effective route: ${providerRoute || "see Provider Updates for details"}.`
            : `Provider sync completed for "${planLabel}". Your plan is current with the provider record.`,
        });
        if (syncNotificationMessage) {
          const summaryMessage: FilingProviderMessage = {
            id: buildFilingEventId("sync", plan.id, "provider_changes_detected", syncNotificationMessage, String(syncResult.versionStamp || "")),
            timestamp: new Date().toISOString(),
            severity: changedFields.length > 0 || nextSnapshot.externalChangeDetected ? "warning" : "info",
            title: changedFields.length > 0 ? "Provider changes detected" : "Provider sync update",
            details: changedFields.length > 0
              ? `The filing provider changed this plan: ${changedFields.join(" ")}`
              : syncNotificationMessage,
            source: "sync",
            provider: "FAA Flight Service",
            providerPlanId: syncResult.providerPlanId,
            raw: { changedFields, providerRoute },
          };
          await storage.updateFlightPlan(plan.id, {
            filingProviderMessages: appendPlanProviderMessages(
              (updated as Record<string, unknown>).filingProviderMessages,
              [summaryMessage],
            ) as any,
          } as any);
        }
        const today = new Date();
        storage.upsertUserNotification({
          userId,
          type: `provider_sync:${plan.id}`,
          title: nextSnapshot.externalChangeDetected ? "External provider change detected" : routeChangedByProvider ? "Route updated by provider" : "Provider sync complete",
          message: syncNotificationMessage,
          referenceDate: today as any,
          channels: ["in_app"],
          isRead: false,
          meta: {
            planId: plan.id,
            planTitle: plan.title,
            providerPlanId: syncResult.providerPlanId,
            changedByProvider: routeChangedByProvider,
            changedFields,
            providerRoute,
          } as any,
        }).catch((err) => console.warn("Failed to create sync notification:", err));
      }

      res.json({
        ok: true,
        message: syncResult.message,
        versionStamp: syncResult.versionStamp,
        providerPlanId: syncResult.providerPlanId,
        plan: updated,
      });
    } catch (error: any) {
      console.error("Failed to sync flight plan provider metadata:", error);
      res.status(500).json({
        error: error instanceof Error && error.message
          ? error.message
          : "Failed to sync flight plan provider metadata",
      });
    }
  });

  app.post("/api/flight-plans/:id/provider-review/accept", isAuthenticated, flightFilingRateLimiter, async (req: any, res) => {
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

      let currentPlan: any = plan;
      if (plan.filingProviderPlanId) {
        try {
          const syncResult = await syncLeidosPlanMetadata(plan as any);
          currentPlan = await persistLeidosProviderSync(plan as any, syncResult);
        } catch (syncError: any) {
          console.warn("Leidos provider review accept sync failed:", syncError?.message || syncError);
        }
      }

      const now = new Date();
      const currentSnapshot = getProviderSnapshotRecord((currentPlan as Record<string, unknown>).filingProviderSnapshot);
      const acceptedSnapshot = {
        ...currentSnapshot,
        providerPendingReview: false,
        providerModifiedBySpecialist: false,
        providerReviewAcceptedAt: now.toISOString(),
        providerReviewAcceptedBy: userId,
      };
      const acceptanceMessage: FilingProviderMessage = {
        id: buildFilingEventId("rsf", currentPlan.id, "provider_review_accepted", now.toISOString()),
        timestamp: now.toISOString(),
        severity: "success",
        title: "Provider changes accepted",
        details: "Pilot reviewed and accepted the current provider version in RSF. Amendments can be submitted again from this provider state.",
        source: "rsf",
        action: null,
        provider: "Leidos Flight Service",
        providerPlanId: currentPlan.filingProviderPlanId || null,
      };
      const updated = await storage.updateFlightPlan(currentPlan.id, {
        filingProviderSnapshot: acceptedSnapshot as any,
        filingProviderMessages: appendPlanProviderMessages(
          (currentPlan as Record<string, unknown>).filingProviderMessages,
          [acceptanceMessage],
        ) as any,
        filingLastProviderSyncAt: now,
      } as any);

      res.json({
        ok: true,
        message: "Provider changes accepted. You can submit an amendment from the current provider version.",
        plan: updated,
      });
    } catch (error: any) {
      console.error("Failed to accept flight plan provider review:", error);
      res.status(500).json({
        error: error instanceof Error && error.message
          ? error.message
          : "Failed to accept provider changes",
      });
    }
  });

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
      const showCertificationTests = String(req.query.showCertificationTests || "").toLowerCase() === "true";
      let plans = await storage.getFlightPlansByUser(userId);
      if (!showCertificationTests) {
        plans = plans.filter((plan) => !(plan as any).isCertificationTest);
      }
      res.json(plans);
    } catch (error: any) {
      const pgCode = error?.code || error?.cause?.code || "";
      if (pgCode === "42703") {
        console.error(
          "[SCHEMA MISMATCH] /api/flight-plans failed — missing column in DB. Run migration 0068.\nDetail:", error?.message || error,
        );
        return res.status(503).json({ error: "Database schema migration required." });
      }
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
      const payload = { ...req.body };
      if (payload.fuelOnBoard === "") payload.fuelOnBoard = null;
      if (payload.fuelRequired === "") payload.fuelRequired = null;
      for (const field of ["departure", "destination", "alternate", "tailNumber"]) {
        if (typeof payload[field] === "string") {
          payload[field] = payload[field].trim().toUpperCase();
        }
      }
      const result = insertFlightPlanSchema.safeParse(payload);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const entitlements = getEntitlementsForUser(user);
      const plans = await storage.getFlightPlansByUser(userId);
      const activePlanAccess = canCreateAnotherActiveFlightPlan({
        isPremium: Boolean(entitlements.canUseUnlimitedActiveFlightPlans),
        existingPlans: plans,
      });
      if (!activePlanAccess.allowed) {
        return res.status(403).json({
          error: activePlanAccess.message || ACTIVE_FLIGHT_PLAN_LIMIT_MESSAGE,
          code: "ACTIVE_FLIGHT_PLAN_LIMIT",
          activeFlightPlanCount: activePlanAccess.activeCount,
        });
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
      for (const field of ["departure", "destination", "alternate", "tailNumber"]) {
        if (typeof payload[field] === "string") {
          payload[field] = payload[field].trim().toUpperCase();
        }
      }
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
      const status = String(plan.filingStatus || "draft").toLowerCase();
      const hasProviderRecord = Boolean(
        plan.filingIsLive ||
        plan.filingProviderPlanId ||
        plan.filingLastProviderSyncAt ||
        (Array.isArray(plan.filingActionHistory) && plan.filingActionHistory.length > 0) ||
        ["staged", "filed", "activated", "cancelled", "closed"].includes(status)
      );
      if (hasProviderRecord) {
        return res.status(409).json({
          error: "Filed or provider-synced flight plans cannot be deleted. Close or cancel through the filing provider instead.",
        });
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



function getNearbyAirportCacheKey(lat: number, lon: number, radiusNm: number, limit: number) {
  const roundedLat = lat.toFixed(2);
  const roundedLon = lon.toFixed(2);
  const roundedRadius = Math.round(radiusNm);
  return `${roundedLat}|${roundedLon}|${roundedRadius}|${limit}`;
}

function getRouteSuggestionCacheKey(query: {
  departure: string;
  destination: string;
  cruiseKtas: number;
  fuelBurnGph: number;
  usableFuelGal: number;
  fuelGallons: number;
  reserveMinutes: number;
}) {
  return [
    query.departure,
    query.destination,
    query.cruiseKtas.toFixed(1),
    query.fuelBurnGph.toFixed(1),
    query.usableFuelGal.toFixed(1),
    query.fuelGallons.toFixed(1),
    query.reserveMinutes.toFixed(1),
  ].join("|");
}

function getRunwayBriefingCacheKey(icao: string) {
  return normalizeIcao(icao);
}

function buildRedisCacheKey(namespace: string, key: string) {
  return `${REDIS_CACHE_PREFIX}:${namespace}:${key}`;
}

async function getCachedMapPayload<T>(
  cache: Map<string, { data: T; expiresAt: number }>,
  key: string,
  ttlMs: number,
  redisNamespace?: string,
): Promise<T | null> {
  const cached = cache.get(key);
  if (cached) {
    if (Date.now() > cached.expiresAt) {
      cache.delete(key);
    } else {
      return cached.data;
    }
  }

  if (!redisNamespace) return null;
  const shared = await getSharedCacheJson<T>(buildRedisCacheKey(redisNamespace, key));
  if (shared === null) return null;
  cache.set(key, { data: shared, expiresAt: Date.now() + ttlMs });
  return shared;
}

async function setCachedMapPayload<T>(
  cache: Map<string, { data: T; expiresAt: number }>,
  key: string,
  data: T,
  ttlMs: number,
  maxEntries?: number,
  redisNamespace?: string,
) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  if (typeof maxEntries === "number" && cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (oldestKey) cache.delete(oldestKey);
  }

  if (redisNamespace) {
    await setSharedCacheJson(buildRedisCacheKey(redisNamespace, key), data, ttlMs / 1000);
  }
}

async function getCachedAirportSearchPayload(key: string): Promise<AirportSearchResult[] | null> {
  const cached = airportSearchCache.get(key);
  if (cached) {
    if (Date.now() > cached.expiresAt) {
      airportSearchCache.delete(key);
    } else {
      return cached.data;
    }
  }

  const shared = await getSharedCacheJson<AirportSearchResult[]>(buildRedisCacheKey("airport-search", key));
  if (shared === null) return null;
  airportSearchCache.set(key, { data: shared, expiresAt: Date.now() + AIRPORT_SEARCH_CACHE_TTL_MS });
  return shared;
}

async function setCachedAirportSearchPayload(key: string, data: AirportSearchResult[]) {
  airportSearchCache.set(key, { data, expiresAt: Date.now() + AIRPORT_SEARCH_CACHE_TTL_MS });
  if (airportSearchCache.size > AIRPORT_SEARCH_CACHE_MAX) {
    const oldestKey = airportSearchCache.keys().next().value as string | undefined;
    if (oldestKey) airportSearchCache.delete(oldestKey);
  }
  await setSharedCacheJson(buildRedisCacheKey("airport-search", key), data, AIRPORT_SEARCH_CACHE_TTL_MS / 1000);
}

function parseIcaoListEnv(raw: string | undefined): string[] {
  return String(raw || "")
    .split(",")
    .map((value) => normalizeIcao(value))
    .filter((value): value is string => Boolean(value));
}

export async function prewarmOperationalCaches(): Promise<{ ok: string[]; failed: string[] }> {
  if (operationalCachePrewarmPromise) {
    return operationalCachePrewarmPromise;
  }

  operationalCachePrewarmPromise = (async () => {
    const tasks: Array<{ name: string; run: () => Promise<unknown> }> = [
      { name: "airport-stations", run: () => loadStationCache() },
      { name: "airport-timezones", run: () => loadAirportTimezoneCache() },
      { name: "airport-reference", run: () => loadAirportReferenceCache() },
      { name: "airport-runways", run: () => loadRunwayCache() },
      { name: "airport-frequencies", run: () => loadAirportFrequencyCache() },
    ];

    const prewarmPlateAirports = parseIcaoListEnv(process.env.PREWARM_PLATE_AIRPORTS);
    prewarmPlateAirports.forEach((icao) => {
      tasks.push({
        name: `plates:${icao}`,
        run: () => fetchPlateMetadataForIcao(icao),
      });
    });

    const results = await Promise.allSettled(tasks.map((task) => task.run()));
    const ok: string[] = [];
    const failed: string[] = [];
    results.forEach((result, index) => {
      const name = tasks[index]?.name ?? `task-${index + 1}`;
      if (result.status === "fulfilled") {
        ok.push(name);
      } else {
        failed.push(name);
      }
    });

    return { ok, failed };
  })();

  try {
    return await operationalCachePrewarmPromise;
  } finally {
    operationalCachePrewarmPromise = null;
  }
}

async function getCachedNearbyAirportPayload<T>(key: string): Promise<T | null> {
  const cached = nearbyAirportCache.get(key);
  if (cached) {
    if (cached.expiresAt <= Date.now()) {
      nearbyAirportCache.delete(key);
    } else {
      return cached.data as T;
    }
  }

  const shared = await getSharedCacheJson<T>(buildRedisCacheKey("nearby-airports", key));
  if (shared === null) return null;
  nearbyAirportCache.set(key, { data: shared, expiresAt: Date.now() + NEARBY_AIRPORT_CACHE_TTL_MS });
  return shared;
}

async function setCachedNearbyAirportPayload<T>(key: string, data: T) {
  nearbyAirportCache.set(key, { data, expiresAt: Date.now() + NEARBY_AIRPORT_CACHE_TTL_MS });
  if (nearbyAirportCache.size > NEARBY_AIRPORT_CACHE_MAX) {
    const oldestKey = nearbyAirportCache.keys().next().value as string | undefined;
    if (oldestKey) nearbyAirportCache.delete(oldestKey);
  }
  await setSharedCacheJson(buildRedisCacheKey("nearby-airports", key), data, NEARBY_AIRPORT_CACHE_TTL_MS / 1000);
}
