import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import OpenAI from "openai";
import { pipeline } from "stream/promises";
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
// Keep VW photos under the existing RSF uploads prefix so the production S3 IAM
// policy can write them without requiring a new bucket policy rollout.
const VW_PHOTO_PREFIX = "uploads/vw-beetle";

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
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      if (
        (parsed.hostname === "readysetfly.us" || parsed.hostname === "www.readysetfly.us") &&
        parsed.pathname.startsWith("/uploads/")
      ) {
        return new URL(`${parsed.pathname}${parsed.search}`, baseUrl).toString();
      }
    } catch {
      return url;
    }
    return url;
  }
  return new URL(url.startsWith("/") ? url : `/${url}`, baseUrl).toString();
}

function vehiclePhotoUrl(filename: string) {
  return `/api/vehicle-listings/vw-beetle/photos/${encodeURIComponent(filename)}`;
}

function extractVehiclePhotoFilename(rawUrl: string) {
  try {
    const parsed = /^https?:\/\//i.test(rawUrl) ? new URL(rawUrl) : null;
    const pathname = parsed ? parsed.pathname : rawUrl;
    const match = pathname.match(/\/(?:uploads\/vw-beetle|api\/vehicle-listings\/vw-beetle\/photos)\/([^/?#]+)$/i);
    return match ? decodeURIComponent(match[1]) : "";
  } catch {
    return "";
  }
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

function aiDraftToText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(aiDraftToText).filter(Boolean).join("\n\n").trim();
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["text", "copy", "listing", "description", "body", "content", "draft"]) {
      const text = aiDraftToText(obj[key]);
      if (text) return text;
    }
    return Object.entries(obj)
      .map(([key, nested]) => {
        const text = aiDraftToText(nested);
        return text ? `${key}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }
  return "";
}

function normalizeAiListingDrafts(drafts: any, fallbackDescription: string) {
  const source = drafts && typeof drafts === "object" ? drafts : {};
  const normalized = {
    professional: aiDraftToText(source.professional) || fallbackDescription,
    friendlyMarketplace: aiDraftToText(source.friendlyMarketplace) || fallbackDescription,
    facebookShort: aiDraftToText(source.facebookShort) || fallbackDescription,
    collectorFocused: aiDraftToText(source.collectorFocused) || fallbackDescription,
    transparentKnownIssues: aiDraftToText(source.transparentKnownIssues) || fallbackDescription,
  };
  return normalized;
}

async function generateAiJsonWithImages(prompt: string, fallback: any, imageUrls: string[]) {
  if (!openai || imageUrls.length === 0) return generateAiJson(prompt, fallback);
  try {
    const imageContent = imageUrls.map((url) => ({ type: "image_url", image_url: { url } }));
    const completion = await openai.chat.completions.create({
      model: process.env.VEHICLE_AI_VISION_MODEL || process.env.VEHICLE_AI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return only valid JSON. You help draft transparent private-party classic vehicle listing and valuation content. Do not claim to be a certified appraiser." },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...imageContent,
          ] as any,
        },
      ],
      temperature: 0.3,
    });
    try {
      return {
        ...extractJson(completion.choices[0]?.message?.content || "{}"),
        aiAvailable: true,
        imagesAnalyzed: imageUrls.length,
      };
    } catch {
      return { ...fallback, aiAvailable: true, imagesAnalyzed: imageUrls.length, rawText: completion.choices[0]?.message?.content || "" };
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
        imagesAnalyzed: 0,
        attemptedImageCount: imageUrls.length,
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

  router.get("/vw-beetle/photos/:filename", async (req, res, next) => {
    try {
      const filename = path.basename(String(req.params.filename || ""));
      if (!filename || filename !== req.params.filename || filename.includes("..")) {
        return res.status(400).json({ error: "Invalid photo filename" });
      }

      if (process.env.AWS_S3_BUCKET) {
        const { S3StorageService } = await import("../s3Storage.js");
        const s3Service = new S3StorageService();
        const { stream, contentType, contentLength } = await s3Service.getObjectStream({ key: `${VW_PHOTO_PREFIX}/${filename}` });
        res.setHeader("Content-Type", contentType || "image/jpeg");
        if (contentLength) res.setHeader("Content-Length", String(contentLength));
        res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
        await pipeline(stream, res);
        return;
      }

      const filePath = path.resolve(uploadDir, filename);
      if (!filePath.startsWith(`${uploadDir}${path.sep}`) || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Photo not found" });
      }
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      return res.sendFile(filePath);
    } catch (error: any) {
      const statusCode = error?.$metadata?.httpStatusCode;
      if (error?.name === "NoSuchKey" || statusCode === 404) {
        return res.status(404).json({ error: "Photo not found" });
      }
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
        const nextPhotos = await Promise.all(files.map(async (file, index) => {
          if (process.env.AWS_S3_BUCKET) {
            const { S3StorageService } = await import("../s3Storage.js");
            const s3Service = new S3StorageService();
            await s3Service.uploadFile({
              key: `${VW_PHOTO_PREFIX}/${file.filename}`,
              filePath: file.path,
              contentType: file.mimetype,
            });
            fs.unlink(file.path, () => {});
          }

          return {
            id: `${Date.now()}-${index}-${file.filename}`,
            url: vehiclePhotoUrl(file.filename),
            caption: "",
            category: "Exterior",
            uploadedAt: new Date().toISOString(),
          };
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

  router.delete("/vw-beetle/admin/photos", isAuthenticated, isAdmin, async (_req, res, next) => {
    try {
      const listing = await getListing();
      const photos = (((listing.photosJson as any[]) || []) as Array<{ url?: string }>);
      const filenames = Array.from(new Set(photos.map((photo) => extractVehiclePhotoFilename(photo.url || "")).filter(Boolean)));

      if (process.env.AWS_S3_BUCKET && filenames.length) {
        const { S3StorageService } = await import("../s3Storage.js");
        const s3Service = new S3StorageService();
        await Promise.allSettled(filenames.map((filename) => s3Service.deleteObject(`${VW_PHOTO_PREFIX}/${filename}`)));
      }

      await Promise.allSettled(filenames.map(async (filename) => {
        const filePath = path.resolve(uploadDir, filename);
        if (filePath.startsWith(`${uploadDir}${path.sep}`) && fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      }));

      const [updated] = await db.update(vehicleListings).set({
        photosJson: [],
        heroPhotoUrl: "",
        updatedAt: new Date(),
      } as any).where(eq(vehicleListings.id, VW_LISTING_ID)).returning();

      res.json({ listing: updated, deletedCount: filenames.length });
    } catch (error) {
      next(error);
    }
  });

  router.post("/vw-beetle/admin/ai/valuation", isAuthenticated, isAdmin, async (req, res, next) => {
    try {
      const listing = await getListing();
      const baseUrl = getPublicApiBaseUrl(req);
      const imageUrls = (((listing.photosJson as any[]) || []) as Array<{ url?: string }>)
        .map((photo) => photo.url || "")
        .filter(Boolean)
        .map((url) => {
          const filename = extractVehiclePhotoFilename(url);
          return toAbsolutePublicUrl(filename ? vehiclePhotoUrl(filename) : url, baseUrl);
        });
      const result = await generateAiJsonWithImages(`Analyze this private-party classic vehicle listing and every uploaded photo provided in this request, then return the requested valuation JSON shape. You are receiving ${imageUrls.length} uploaded photo${imageUrls.length === 1 ? "" : "s"}; consider all of them when judging condition, strengths, concerns, and price. Focus comps on 1973-1979 Volkswagen Super Beetle Convertibles with curved windshield, not flat windshield standard Beetles, hardtops, or project cars unless noted as weaker comps.

Confidence rules:
- High only if photos clearly show exterior, interior, engine bay, top, floors/undercarriage or rust-prone areas, plus the listing has mileage/title/documentation.
- Medium if photos show most major areas but some high-value inspection items are missing.
- Low if price still depends on missing inspection data such as mileage, title, undercarriage/floor pans, convertible top condition, seal/rust closeups, or restoration documentation.
Always include confidenceReason explaining why you chose the confidence level.

Listing data:
${JSON.stringify({ ...listing, notes: req.body?.notes || "" }, null, 2)}

Return JSON with estimatedConditionCategory, suggestedLowValue, suggestedHighValue, suggestedAskingPrice, curvedWindshieldValueImpact, visibleStrengths, visibleConcerns, recommendedRepairsBeforeSale, listingHighlights, photoConditionSummary, confidence, confidenceReason, imagesAnalyzed, disclaimer.`, listing.aiValuationJson || defaultListing.aiValuationJson, imageUrls);
      res.json({ valuation: result });
    } catch (error) {
      next(error);
    }
  });

  router.post("/vw-beetle/admin/ai/listing", isAuthenticated, isAdmin, async (req, res, next) => {
    try {
      const listing = await getListing();
      const result = await generateAiJson(`Write compelling, buyer-focused listing copy for a 1974 Volkswagen Super Beetle Convertible curved windshield model. Make it sound attractive and memorable for classic-car buyers while staying honest and transparent. Lead with what makes it desirable: curved windshield Super Beetle Convertible, manual transmission, drivable, restored engine, good body/interior, final-era convertible Beetle appeal. Do not sound generic. Do not overpromise show-car quality. Mention known needs in a confident, transparent way, not as a warning label.

Return JSON with exactly these string fields:
- professional: polished private-party listing suitable for the website, 2-4 short paragraphs plus concise highlights.
- friendlyMarketplace: warmer Facebook Marketplace style, inviting but not cheesy.
- facebookShort: short punchy post under 700 characters.
- collectorFocused: aimed at VW/classic collectors, emphasizing curved windshield Super Beetle convertible context.
- transparentKnownIssues: honest condition-focused version that still frames the car positively.

Each value must be plain listing text, not an object or nested structure.

Listing data:
${JSON.stringify({ ...listing, style: req.body?.style || "all" }, null, 2)}`, {
        professional: listing.description,
        friendlyMarketplace: listing.description,
        facebookShort: listing.description,
        collectorFocused: listing.description,
        transparentKnownIssues: listing.description,
      });
      const drafts = normalizeAiListingDrafts(result, listing.description || defaultListing.description);
      res.json({ drafts });
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/vehicle-listings", router);
}
