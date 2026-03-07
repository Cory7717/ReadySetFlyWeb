import { Router, type Request } from "express";
import { and, desc, gte, inArray } from "drizzle-orm";
import { db } from "../db";
import { isAuthenticated } from "../auth";
import { fuelPriceReports } from "../../shared/schema";
import {
  getFuelPrices,
  mergeCommunityPrices,
  normalizeFuelType,
} from "../lib/fuelPriceClient";

type CachedFuelPriceData = Awaited<ReturnType<typeof getFuelPrices>>;

type AuthedRequest = Request & {
  user?: { claims?: { sub?: string } };
  session?: { userId?: string };
};

export const fuelPricesRouter = Router();

const cache = new Map<string, {
  data: CachedFuelPriceData;
  expiresAt: number;
}>();
const CACHE_TTL_MS = 15 * 60 * 1000;

const ipRequests = new Map<string, {
  count: number;
  resetAt: number;
}>();

function getCacheKey(
  airport?: string,
  lat?: number,
  lon?: number,
  radius?: number
) {
  return [
    airport ?? "",
    lat?.toFixed(3) ?? "",
    lon?.toFixed(3) ?? "",
    radius ?? 50,
  ].join(":");
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipRequests.get(ip);
  if (!record || record.resetAt < now) {
    ipRequests.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (record.count >= 30) return false;
  record.count++;
  return true;
}

function getCurrentUserId(req: AuthedRequest): string | null {
  const claimsUserId = req.user?.claims?.sub;
  const sessionUserId = req.session?.userId;
  return claimsUserId || sessionUserId || null;
}

fuelPricesRouter.get("/", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string | undefined)
    ?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "";

  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: "Too many requests. Please wait a moment."
    });
  }

  const airport = typeof req.query.airport === "string"
    ? req.query.airport
    : undefined;
  const latRaw = typeof req.query.lat === "string"
    ? req.query.lat
    : undefined;
  const lonRaw = typeof req.query.lon === "string"
    ? req.query.lon
    : undefined;
  const radiusRaw = typeof req.query.radiusMiles === "string"
    ? req.query.radiusMiles
    : undefined;

  if (!airport && (!latRaw || !lonRaw)) {
    return res.status(400).json({
      error: "Provide either airport or lat and lon"
    });
  }

  if (airport && !/^[A-Z0-9]{3,5}$/i.test(airport)) {
    return res.status(400).json({
      error: "Airport must be a 3-5 character ICAO identifier"
    });
  }

  const lat = latRaw ? parseFloat(latRaw) : undefined;
  const lon = lonRaw ? parseFloat(lonRaw) : undefined;
  if (lat !== undefined && (Number.isNaN(lat) || lat < -90 || lat > 90)) {
    return res.status(400).json({ error: "Invalid latitude" });
  }
  if (lon !== undefined && (Number.isNaN(lon) || lon < -180 || lon > 180)) {
    return res.status(400).json({ error: "Invalid longitude" });
  }

  const radiusMiles = radiusRaw ? parseInt(radiusRaw, 10) : 50;
  if (Number.isNaN(radiusMiles) || radiusMiles < 1 || radiusMiles > 200) {
    return res.status(400).json({
      error: "radiusMiles must be between 1 and 200"
    });
  }

  const normalizedAirport = airport?.toUpperCase();
  const cacheKey = getCacheKey(normalizedAirport, lat, lon, radiusMiles);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.data);
  }

  try {
    let data = await getFuelPrices(
      normalizedAirport,
      lat,
      lon,
      radiusMiles
    );

    if (process.env.FUEL_COMMUNITY_ENABLED === "true" && data.results.length > 0) {
      const icaos = data.results.map((result) => result.icao);
      const cutoff = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      );
      const reports = await db
        .select()
        .from(fuelPriceReports)
        .where(
          and(
            inArray(fuelPriceReports.icao, icaos),
            gte(fuelPriceReports.reportedAt, cutoff)
          )
        )
        .orderBy(desc(fuelPriceReports.reportedAt));

      if (reports.length > 0) {
        data = {
          ...data,
          source: "mixed",
          results: mergeCommunityPrices(
            data.results,
            reports.map((report) => ({
              icao: report.icao,
              fuelType: report.fuelType,
              pricePPG: Number(report.pricePPG),
              reportedAt: report.reportedAt.toISOString(),
            }))
          ),
        };
      }
    }

    cache.set(cacheKey, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return res.json(data);
  } catch (error) {
    console.error("[fuel-prices] fetch error:", error);
    return res.status(502).json({
      error: "Fuel price data temporarily unavailable"
    });
  }
});

fuelPricesRouter.post("/report", isAuthenticated, async (req: AuthedRequest, res) => {
  if (process.env.FUEL_COMMUNITY_ENABLED !== "true") {
    return res.status(403).json({
      error: "Community reporting is not yet available"
    });
  }

  const userId = getCurrentUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in to report" });
  }

  const body = req.body as Record<string, unknown>;
  const icao = typeof body.icao === "string" ? body.icao : "";
  const fuelType = typeof body.fuelType === "string" ? body.fuelType : "";
  const priceValue =
    typeof body.pricePPG === "number"
      ? body.pricePPG
      : typeof body.pricePPG === "string"
        ? Number(body.pricePPG)
        : NaN;
  const fboName = typeof body.fboName === "string" ? body.fboName : null;
  const notes = typeof body.notes === "string" ? body.notes : null;

  if (!icao || !fuelType || Number.isNaN(priceValue)) {
    return res.status(400).json({
      error: "icao, fuelType, and pricePPG are required"
    });
  }
  if (!/^[A-Z0-9]{3,5}$/i.test(icao)) {
    return res.status(400).json({ error: "Invalid ICAO" });
  }
  if (priceValue < 0.5 || priceValue > 30) {
    return res.status(400).json({
      error: "pricePPG must be between 0.50 and 30.00"
    });
  }

  try {
    const normalizedIcao = icao.toUpperCase();
    const normalizedFuelType = normalizeFuelType(fuelType);
    const [report] = await db
      .insert(fuelPriceReports)
      .values({
        icao: normalizedIcao,
        fuelType: normalizedFuelType,
        pricePPG: String(priceValue),
        fboName,
        notes,
        reportedBy: userId,
      })
      .returning();

    for (const key of Array.from(cache.keys())) {
      if (key.startsWith(normalizedIcao)) {
        cache.delete(key);
      }
    }

    return res.json({ success: true, report });
  } catch (error) {
    console.error("[fuel-prices] report error:", error);
    return res.status(500).json({
      error: "Failed to save fuel price report"
    });
  }
});
