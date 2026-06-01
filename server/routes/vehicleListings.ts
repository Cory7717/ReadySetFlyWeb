import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import OpenAI from "openai";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { isAdmin, isAuthenticated } from "../auth";
import { getUncachableResendClient } from "../resendClient";
import { vehicleListingLeads, vehicleListings } from "@shared/schema";

const VW_LISTING_ID = "1974-vw-super-beetle-convertible";
const uploadDir = path.resolve(process.cwd(), "uploads", "vw-beetle");
fs.mkdirSync(uploadDir, { recursive: true });

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const safeBase = path.basename(file.originalname).replace(/[^a-z0-9._-]/gi, "-").slice(-80);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeBase}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 30 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) return cb(null, true);
    cb(new Error("Only image uploads are supported."));
  },
});

const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const openaiBaseUrl = (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || "").trim();
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey, ...(openaiBaseUrl.startsWith("http") ? { baseURL: openaiBaseUrl } : {}) }) : null;

const defaultListing = {
  id: VW_LISTING_ID,
  title: "1974 Volkswagen Super Beetle Convertible",
  year: 1974,
  make: "Volkswagen",
  model: "Super Beetle Convertible",
  trim: "Curved Windshield Model",
  bodyStyle: "Convertible",
  windshieldType: "Curved panoramic Super Beetle windshield",
  transmission: "Manual",
  mileage: "",
  vin: "",
  vinPublic: false,
  location: "Austin, TX",
  askingPrice: null as string | null,
  priceType: "accepting_offers",
  status: "available",
  story: "My wife won the car in a raffle drawing on Memorial Day, and we have elected to sell it.",
  description: "Classic 1974 Volkswagen Super Beetle Convertible with the curved windshield model, manual transmission, restored engine, drivable condition, good body, and good interior. Known needs are dry windshield seals and minor surface rust that is described as surface-level and not structural.",
  conditionSummary: "Good Driver / Good Condition with minor needs",
  knownIssues: "Dry rot in windshield seals. Minor surface rust. Rust is surface-level and does not weaken floor boards or structural areas.",
  specsJson: {
    drivable: "Yes",
    engine: "Fully restored",
    interior: "Good condition",
    exterior: "Good shape",
    titleStatus: "",
  },
  marketValueRangesJson: [
    { condition: "Project / Needs Significant Work", description: "Non-running or major mechanical/body needs.", range: "$5,000-$9,000", notes: "Weaker comp for this car." },
    { condition: "Fair / Driver Quality", description: "Running driver with visible needs.", range: "$8,000-$13,000", notes: "Lower range if needs are more than cosmetic." },
    { condition: "Good Driver", description: "Drivable, presentable, mechanically sorted with minor needs.", range: "$13,000-$19,000", notes: "Current estimated category." },
    { condition: "Very Good / Well Sorted", description: "Well-presented car with most needs addressed.", range: "$19,000-$25,000", notes: "Likely after seals/rust/detailing are handled." },
    { condition: "Excellent / Show-Level", description: "Highly restored, show-quality presentation.", range: "$25,000-$35,000+", notes: "Requires stronger documentation and finish." },
  ],
  aiValuationJson: {
    estimatedConditionCategory: "Good Driver / Good Condition with minor needs",
    suggestedLowValue: 15000,
    suggestedHighValue: 20000,
    suggestedAskingPrice: 18500,
    curvedWindshieldValueImpact: "Positive. 1973-1979 curved windshield Super Beetle Convertibles are stronger comps than earlier flat windshield Beetles or hardtops.",
    visibleStrengths: ["Curved windshield Super Beetle Convertible", "Manual transmission", "Drivable", "Fully restored engine", "Good body", "Good interior"],
    visibleConcerns: ["Dry windshield seals", "Minor surface rust"],
    recommendedRepairsBeforeSale: ["Replace windshield seals", "Treat surface rust", "Detail and photograph interior, exterior, engine, and undercarriage"],
    listingHighlights: ["1974 curved windshield model", "Convertible body style", "Restored engine", "Honest known-needs disclosure"],
    confidence: "Low",
    disclaimer: "This AI estimate is not an appraisal. Verify value with current market comps for 1973-1979 Super Beetle Convertibles.",
  },
  photosJson: [],
  heroPhotoUrl: "",
  sellerContactJson: {
    email: process.env.VEHICLE_SELLER_EMAIL || "coryarmer@gmail.com",
    phone: "",
    preferredContactMethod: "email",
    showEmail: false,
    showPhone: false,
  },
  aiListingDraftsJson: {},
};

const listingUpdateSchema = z.object({
  title: z.string().max(180).optional(),
  mileage: z.string().max(80).optional(),
  vin: z.string().max(80).optional(),
  vinPublic: z.boolean().optional(),
  location: z.string().max(160).optional(),
  askingPrice: z.union([z.string(), z.number(), z.null()]).optional(),
  priceType: z.enum(["firm_price", "accepting_offers", "contact_for_price"]).optional(),
  status: z.enum(["available", "pending", "sold"]).optional(),
  story: z.string().max(2000).optional(),
  description: z.string().max(8000).optional(),
  conditionSummary: z.string().max(1000).optional(),
  knownIssues: z.string().max(2000).optional(),
  specsJson: z.any().optional(),
  marketValueRangesJson: z.any().optional(),
  aiValuationJson: z.any().optional(),
  photosJson: z.any().optional(),
  heroPhotoUrl: z.string().max(1000).optional(),
  sellerContactJson: z.any().optional(),
  aiListingDraftsJson: z.any().optional(),
});

const leadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(60).optional().nullable(),
  message: z.string().trim().max(3000).optional().nullable(),
  interestType: z.enum(["general_inquiry", "request_more_photos", "schedule_viewing", "make_an_offer"]).default("general_inquiry"),
  offerAmount: z.union([z.string(), z.number(), z.null()]).optional(),
  preferredContactMethod: z.string().trim().max(60).optional().nullable(),
  website: z.string().optional().default(""),
});

function sanitizeListing(row: any) {
  return row;
}

async function getListing() {
  const [row] = await db.select().from(vehicleListings).where(eq(vehicleListings.id, VW_LISTING_ID)).limit(1);
  if (row) return sanitizeListing(row);
  const [created] = await db.insert(vehicleListings).values(defaultListing as any).returning();
  return sanitizeListing(created);
}

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || trimmed.match(/\{[\s\S]*\}/)?.[0] || trimmed;
  return JSON.parse(candidate);
}

function getPublicApiBaseUrl(req: express.Request) {
  const configured = (
    process.env.VEHICLE_PUBLIC_UPLOAD_BASE_URL ||
    process.env.PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    ""
  ).trim();
  if (/^https?:\/\//i.test(configured)) return configured.replace(/\/+$/, "");

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const proto = forwardedProto || req.protocol || "https";
  const host = req.get("host");
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function toAbsolutePublicUrl(url: string, baseUrl: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return new URL(url.startsWith("/") ? url : `/${url}`, baseUrl).toString();
}

async function generateAiJson(prompt: string, fallback: any) {
  if (!openai) return { ...fallback, aiAvailable: false };
  const completion = await openai.chat.completions.create({
    model: process.env.VEHICLE_AI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: "Return only valid JSON. You help draft transparent private-party classic vehicle listing and valuation content. Do not claim to be a certified appraiser." },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
  });
  try {
    return { ...extractJson(completion.choices[0]?.message?.content || "{}"), aiAvailable: true };
  } catch {
    return { ...fallback, aiAvailable: true, rawText: completion.choices[0]?.message?.content || "" };
  }
}

async function generateAiJsonWithImages(prompt: string, fallback: any, imageUrls: string[]) {
  if (!openai || imageUrls.length === 0) return generateAiJson(prompt, fallback);
  try {
    const completion = await openai.chat.completions.create({
      model: process.env.VEHICLE_AI_VISION_MODEL || process.env.VEHICLE_AI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return only valid JSON. You help draft transparent private-party classic vehicle listing and valuation content. Do not claim to be a certified appraiser." },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...imageUrls.slice(0, 8).map((url) => ({ type: "image_url", image_url: { url } })),
          ] as any,
        },
      ],
      temperature: 0.3,
    });
    try {
      return { ...extractJson(completion.choices[0]?.message?.content || "{}"), aiAvailable: true };
    } catch {
      return { ...fallback, aiAvailable: true, rawText: completion.choices[0]?.message?.content || "" };
    }
  } catch (error: any) {
    console.warn("vehicle_ai_image_analysis_failed", {
      message: error?.message || "Unknown image analysis error",
      imageCount: imageUrls.length,
    });
    return generateAiJson(
      `${prompt}\n\nThe photo URLs could not be downloaded by the AI image analysis service. Return a conservative valuation based on the written listing details only, set confidence to Low, and include imageAnalysisUnavailable: true.`,
      {
        ...fallback,
        confidence: "Low",
        imageAnalysisUnavailable: true,
        visibleConcerns: [
          ...((fallback?.visibleConcerns as string[] | undefined) || []),
          "AI photo analysis unavailable because image download failed.",
        ],
      },
    );
  }
}

async function emailLead(listing: any, lead: any) {
  const contact = (listing.sellerContactJson || {}) as any;
  const to = contact.email || process.env.VEHICLE_SELLER_EMAIL;
  if (!to) return false;
  const { client, fromEmail } = await getUncachableResendClient();
  await client.emails.send({
    from: fromEmail,
    to,
    replyTo: lead.email,
    subject: `VW Beetle Lead - ${lead.interestType.replace(/_/g, " ")} - ${lead.name}`,
    text: [
      `Name: ${lead.name}`,
      `Email: ${lead.email}`,
      `Phone: ${lead.phone || ""}`,
      `Interest: ${lead.interestType}`,
      `Offer: ${lead.offerAmount || ""}`,
      `Preferred contact: ${lead.preferredContactMethod || ""}`,
      "",
      lead.message || "",
    ].join("\n"),
  });
  return true;
}

export function registerVehicleListingRoutes(app: Express) {
  const router = express.Router();

  router.get("/vw-beetle", async (_req, res, next) => {
    try {
      res.json({ listing: await getListing() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/vw-beetle/leads", async (req, res, next) => {
    try {
      const parsed = leadSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid lead", validation: parsed.error.format() });
      if (parsed.data.website) return res.json({ ok: true });
      const listing = await getListing();
      const [lead] = await db.insert(vehicleListingLeads).values({
        listingId: VW_LISTING_ID,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        message: parsed.data.message || null,
        interestType: parsed.data.interestType,
        offerAmount: parsed.data.offerAmount ? String(parsed.data.offerAmount) : null,
        preferredContactMethod: parsed.data.preferredContactMethod || null,
      } as any).returning();
      emailLead(listing, lead).catch((error) => console.error("vehicle_lead_email_failed", error?.message || error));
      res.status(201).json({ lead: { id: lead.id, createdAt: lead.createdAt } });
    } catch (error) {
      next(error);
    }
  });

  router.get("/vw-beetle/admin/leads", isAuthenticated, isAdmin, async (_req, res, next) => {
    try {
      const leads = await db.select().from(vehicleListingLeads).where(eq(vehicleListingLeads.listingId, VW_LISTING_ID)).orderBy(desc(vehicleListingLeads.createdAt)).limit(100);
      res.json({ leads });
    } catch (error) {
      next(error);
    }
  });

  router.put("/vw-beetle/admin", isAuthenticated, isAdmin, async (req, res, next) => {
    try {
      const parsed = listingUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid listing", validation: parsed.error.format() });
      await getListing();
      const [updated] = await db.update(vehicleListings).set({ ...parsed.data, updatedAt: new Date() } as any).where(eq(vehicleListings.id, VW_LISTING_ID)).returning();
      res.json({ listing: updated });
    } catch (error) {
      next(error);
    }
  });

  router.post("/vw-beetle/admin/photos", isAuthenticated, isAdmin, (req, res, next) => {
    photoUpload.array("photos", 30)(req, res, async (error: any) => {
      try {
        if (error) return res.status(400).json({ error: error.message || "Photo upload failed." });
        const listing = await getListing();
        const files = ((req as any).files || []) as Express.Multer.File[];
        const nextPhotos = files.map((file, index) => ({
          id: `${Date.now()}-${index}-${file.filename}`,
          url: `/uploads/vw-beetle/${file.filename}`,
          caption: "",
          category: "Exterior",
          uploadedAt: new Date().toISOString(),
        }));
        const photos = [...(((listing.photosJson as any[]) || [])), ...nextPhotos];
        const heroPhotoUrl = listing.heroPhotoUrl || nextPhotos[0]?.url || "";
        const [updated] = await db.update(vehicleListings).set({ photosJson: photos, heroPhotoUrl, updatedAt: new Date() } as any).where(eq(vehicleListings.id, VW_LISTING_ID)).returning();
        res.json({ listing: updated });
      } catch (uploadError) {
        next(uploadError);
      }
    });
  });

  router.post("/vw-beetle/admin/ai/valuation", isAuthenticated, isAdmin, async (req, res, next) => {
    try {
      const listing = await getListing();
      const baseUrl = getPublicApiBaseUrl(req);
      const imageUrls = (((listing.photosJson as any[]) || []) as Array<{ url?: string }>)
        .map((photo) => photo.url || "")
        .filter(Boolean)
        .map((url) => toAbsolutePublicUrl(url, baseUrl));
      const result = await generateAiJsonWithImages(`Analyze this private-party classic vehicle listing and uploaded photos, then return the requested valuation JSON shape. Focus comps on 1973-1979 Volkswagen Super Beetle Convertibles with curved windshield, not flat windshield standard Beetles, hardtops, or project cars unless noted as weaker comps. If photos are inaccessible, base the estimate on vehicle details and set confidence accordingly.\n\nListing data:\n${JSON.stringify({ ...listing, notes: req.body?.notes || "" }, null, 2)}\n\nReturn JSON with estimatedConditionCategory, suggestedLowValue, suggestedHighValue, suggestedAskingPrice, curvedWindshieldValueImpact, visibleStrengths, visibleConcerns, recommendedRepairsBeforeSale, listingHighlights, confidence, disclaimer.`, listing.aiValuationJson || defaultListing.aiValuationJson, imageUrls);
      res.json({ valuation: result });
    } catch (error) {
      next(error);
    }
  });

  router.post("/vw-beetle/admin/ai/listing", isAuthenticated, isAdmin, async (req, res, next) => {
    try {
      const listing = await getListing();
      const result = await generateAiJson(`Draft listing copy for a 1974 Volkswagen Super Beetle Convertible curved windshield model. Be transparent about known issues. Return JSON with professional, friendlyMarketplace, facebookShort, collectorFocused, transparentKnownIssues.\n\nListing data:\n${JSON.stringify({ ...listing, style: req.body?.style || "all" }, null, 2)}`, {
        professional: listing.description,
        friendlyMarketplace: listing.description,
        facebookShort: listing.description,
        collectorFocused: listing.description,
        transparentKnownIssues: listing.description,
      });
      res.json({ drafts: result });
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/vehicle-listings", router);
}
