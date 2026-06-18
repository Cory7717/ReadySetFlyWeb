import express, { type Express, type RequestHandler } from "express";
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "../db";
import { courtyardDosReports, courtyardHotelUserAccess, courtyardHotels, tipsUsers } from "@shared/schema";

const DEFAULT_HOTEL_ID = "courtyard-austin-lakeline";
const ABOVE_PROPERTY_EMAILS = new Set(
  (process.env.DOS_REPORTING_ABOVE_PROPERTY_EMAILS || "coryarmer@gmail.com,cory.armer@marriott.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

const hotelIdSchema = z.string().min(1).max(120);
const reportMonthSchema = z.string().regex(/^\d{4}-\d{2}$/);
const reportSchema = z.object({
  hotelId: hotelIdSchema,
  reportMonth: reportMonthSchema,
  payload: z.record(z.unknown()),
  status: z.enum(["draft", "submitted"]).default("draft"),
});

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function getToolAccess(user: any): Record<string, boolean> {
  const access = user?.toolAccessJson;
  return access && typeof access === "object" && !Array.isArray(access) ? access as Record<string, boolean> : {};
}

function hasDosToolAccess(user: any) {
  if (!user || user.disabledAt || user.mustChangePassword) return false;
  const access = getToolAccess(user);
  const explicit = access.dosreporting;
  if (typeof explicit === "boolean") return explicit;
  const opsExplicit = access.opsreport;
  if (typeof opsExplicit === "boolean") return opsExplicit;
  return user.role === "super_admin" || user.role === "manager";
}

function dosAccessExplicitlyDenied(user: any) {
  return getToolAccess(user).dosreporting === false;
}

function isAboveProperty(user: any) {
  if (!user || user.disabledAt || user.mustChangePassword) return false;
  return user.role === "super_admin" || ABOVE_PROPERTY_EMAILS.has(normalizeEmail(user.email));
}

async function getUserBySession(req: any) {
  const userId = req.session?.tipsUserId;
  if (!userId) return null;
  const [user] = await db.select().from(tipsUsers).where(eq(tipsUsers.id, String(userId))).limit(1);
  return user || null;
}

async function getHotelsForUser(user: any) {
  const allHotels = await db.select().from(courtyardHotels).where(eq(courtyardHotels.active, true)).orderBy(asc(courtyardHotels.name));
  if (isAboveProperty(user)) return allHotels;

  const assignments = user
    ? await db
      .select({ hotel: courtyardHotels })
      .from(courtyardHotelUserAccess)
      .innerJoin(courtyardHotels, eq(courtyardHotelUserAccess.hotelId, courtyardHotels.id))
      .where(and(eq(courtyardHotelUserAccess.userId, user.id), eq(courtyardHotels.active, true)))
      .orderBy(asc(courtyardHotels.name))
    : [];
  const assignedHotels = assignments.map((row) => row.hotel);
  if (assignedHotels.length) return assignedHotels;
  if (user && hasDosToolAccess(user)) return allHotels.filter((hotel) => hotel.id === DEFAULT_HOTEL_ID);
  return [];
}

async function requireDosReportAccess(req: any, res: any, next: any) {
  try {
    const user = await getUserBySession(req);
    if (!user || user.disabledAt || user.mustChangePassword) {
      return res.status(401).json({ error: "Courtyard login is required." });
    }
    if (dosAccessExplicitlyDenied(user)) {
      return res.status(403).json({ error: "DOS Reporting access is not enabled for this account." });
    }
    if (!hasDosToolAccess(user) && !req.session?.courtyardSharedPinUnlocked && !req.session?.opsReportUnlocked && !req.session?.tipsKioskUnlocked) {
      return res.status(401).json({ error: "Shared PIN is required." });
    }
    const hotels = await getHotelsForUser(user);
    if (!hotels.length) return res.status(403).json({ error: "No hotel access has been assigned." });
    req.dosUser = user;
    req.dosHotels = hotels;
    req.dosAboveProperty = isAboveProperty(user);
    return next();
  } catch (error) {
    next(error);
  }
}

function canAccessHotel(req: any, hotelId: string) {
  return Boolean((req.dosHotels || []).some((hotel: any) => hotel.id === hotelId));
}

function publicHotel(row: any) {
  return {
    id: row.id,
    name: row.name,
    hotelCode: row.hotelCode,
    brand: row.brand,
    market: row.market,
  };
}

function publicReport(row: any, hotel?: any) {
  if (!row) return null;
  return {
    id: row.id,
    hotelId: row.hotelId,
    hotel: hotel ? publicHotel(hotel) : undefined,
    reportMonth: row.reportMonth,
    status: row.status,
    submittedAt: row.submittedAt,
    payload: row.payloadJson || {},
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
  };
}

function textValue(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function reportLines(report: any, hotel: any) {
  const payload = report.payloadJson || {};
  const meta = payload.meta || {};
  const lines = [
    `${hotel.name} (${hotel.hotelCode})`,
    `Report Month: ${report.reportMonth}`,
    `Prepared By: ${textValue(meta.preparedBy) || "Not entered"}`,
    `Status: ${report.status}`,
    "",
    "Executive Summary",
    textValue(payload.executiveSummary) || "No summary entered.",
    "",
    "Monthly Activities",
  ];
  const activities = Array.isArray(payload.monthlyActivities) ? payload.monthlyActivities : [];
  for (const item of activities.filter((row: any) => textValue(row.name)).slice(0, 20)) {
    lines.push(`- ${textValue(item.name)} | ${textValue(item.stage)} | Rooms: ${textValue(item.rooms)} | Due: ${textValue(item.dueDate)} | ${textValue(item.remarks)}`);
  }
  lines.push("", "Future Pipeline");
  const pipeline = Array.isArray(payload.pipeline) ? payload.pipeline : [];
  for (const item of pipeline.filter((row: any) => textValue(row.company)).slice(0, 20)) {
    lines.push(`- ${textValue(item.company)} | ${textValue(item.status)} | RN: ${textValue(item.roomNights)} | Room Rev: ${textValue(item.roomRevenue)} | ${textValue(item.comments)}`);
  }
  return lines;
}

async function buildReportPdf(report: any, hotel: any) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]);
  let y = 744;
  const margin = 48;
  const drawLine = (text: string, size = 10, isBold = false) => {
    const words = String(text || "").split(" ");
    let line = "";
    const maxWidth = 516;
    const activeFont = isBold ? bold : font;
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (activeFont.widthOfTextAtSize(next, size) > maxWidth && line) {
        if (y < 54) {
          page = pdf.addPage([612, 792]);
          y = 744;
        }
        page.drawText(line, { x: margin, y, size, font: activeFont, color: rgb(0.13, 0.09, 0.07) });
        y -= size + 6;
        line = word;
      } else {
        line = next;
      }
    }
    if (y < 54) {
      page = pdf.addPage([612, 792]);
      y = 744;
    }
    page.drawText(line || " ", { x: margin, y, size, font: activeFont, color: rgb(0.13, 0.09, 0.07) });
    y -= size + 6;
  };
  drawLine("DOS Sales Activities Report", 18, true);
  y -= 8;
  for (const line of reportLines(report, hotel)) {
    if (!line) {
      y -= 8;
    } else {
      drawLine(line, line === "Executive Summary" || line === "Monthly Activities" || line === "Future Pipeline" ? 12 : 10, line === "Executive Summary" || line === "Monthly Activities" || line === "Future Pipeline");
    }
  }
  return Buffer.from(await pdf.save());
}

export function registerDosReportingRoutes(app: Express) {
  const router = express.Router();

  router.get("/context", requireDosReportAccess as RequestHandler, async (req: any, res) => {
    res.json({
      user: {
        id: req.dosUser.id,
        email: normalizeEmail(req.dosUser.email),
        employeeDisplayName: req.dosUser.employeeDisplayName,
        role: req.dosUser.role,
      },
      canSelectHotel: Boolean(req.dosAboveProperty),
      currentHotelId: req.dosHotels[0]?.id || DEFAULT_HOTEL_ID,
      hotels: req.dosHotels.map(publicHotel),
    });
  });

  router.get("/reports", requireDosReportAccess as RequestHandler, async (req: any, res, next) => {
    try {
      const hotelId = typeof req.query.hotelId === "string" ? req.query.hotelId : req.dosHotels[0]?.id;
      if (!hotelId || !canAccessHotel(req, hotelId)) return res.status(403).json({ error: "Hotel access denied." });
      const reports = await db
        .select({
          id: courtyardDosReports.id,
          hotelId: courtyardDosReports.hotelId,
          reportMonth: courtyardDosReports.reportMonth,
          status: courtyardDosReports.status,
          submittedAt: courtyardDosReports.submittedAt,
          updatedAt: courtyardDosReports.updatedAt,
        })
        .from(courtyardDosReports)
        .where(eq(courtyardDosReports.hotelId, hotelId))
        .orderBy(desc(courtyardDosReports.reportMonth))
        .limit(24);
      res.json({ reports });
    } catch (error) {
      next(error);
    }
  });

  router.get("/report/:hotelId/:reportMonth", requireDosReportAccess as RequestHandler, async (req: any, res, next) => {
    try {
      const parsed = z.object({ hotelId: hotelIdSchema, reportMonth: reportMonthSchema }).safeParse(req.params);
      if (!parsed.success) return res.status(400).json({ error: "Valid hotel and report month are required." });
      if (!canAccessHotel(req, parsed.data.hotelId)) return res.status(403).json({ error: "Hotel access denied." });
      const [row] = await db
        .select({ report: courtyardDosReports, hotel: courtyardHotels })
        .from(courtyardDosReports)
        .innerJoin(courtyardHotels, eq(courtyardDosReports.hotelId, courtyardHotels.id))
        .where(and(eq(courtyardDosReports.hotelId, parsed.data.hotelId), eq(courtyardDosReports.reportMonth, parsed.data.reportMonth)))
        .limit(1);
      res.json({ report: row ? publicReport(row.report, row.hotel) : null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/report", requireDosReportAccess as RequestHandler, async (req: any, res, next) => {
    try {
      const parsed = reportSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "DOS report data is invalid.", validation: parsed.error.format() });
      if (!canAccessHotel(req, parsed.data.hotelId)) return res.status(403).json({ error: "Hotel access denied." });
      const [report] = await db
        .insert(courtyardDosReports)
        .values({
          hotelId: parsed.data.hotelId,
          reportMonth: parsed.data.reportMonth,
          status: parsed.data.status,
          submittedAt: parsed.data.status === "submitted" ? new Date() : null,
          payloadJson: parsed.data.payload,
          updatedBy: req.dosUser?.id || null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [courtyardDosReports.hotelId, courtyardDosReports.reportMonth],
          set: {
            status: parsed.data.status,
            submittedAt: parsed.data.status === "submitted" ? new Date() : null,
            payloadJson: parsed.data.payload,
            updatedBy: req.dosUser?.id || null,
            updatedAt: new Date(),
          },
        })
        .returning();
      res.json({ report: publicReport(report) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/report/:hotelId/:reportMonth/pdf", requireDosReportAccess as RequestHandler, async (req: any, res, next) => {
    try {
      const parsed = z.object({ hotelId: hotelIdSchema, reportMonth: reportMonthSchema }).safeParse(req.params);
      if (!parsed.success) return res.status(400).json({ error: "Valid hotel and report month are required." });
      if (!canAccessHotel(req, parsed.data.hotelId)) return res.status(403).json({ error: "Hotel access denied." });
      const [row] = await db
        .select({ report: courtyardDosReports, hotel: courtyardHotels })
        .from(courtyardDosReports)
        .innerJoin(courtyardHotels, eq(courtyardDosReports.hotelId, courtyardHotels.id))
        .where(and(eq(courtyardDosReports.hotelId, parsed.data.hotelId), eq(courtyardDosReports.reportMonth, parsed.data.reportMonth)))
        .limit(1);
      if (!row) return res.status(404).json({ error: "Save this DOS report before downloading the PDF." });
      const pdf = await buildReportPdf(row.report, row.hotel);
      const filename = `dos-report-${row.hotel.hotelCode}-${row.report.reportMonth}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/dosreporting", router);
}
