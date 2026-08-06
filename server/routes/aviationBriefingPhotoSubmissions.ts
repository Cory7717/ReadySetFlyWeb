import crypto from "crypto";
import type { Express } from "express";
import multer from "multer";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  aviationBriefingPhotoSubmissions,
  aviationBriefings,
} from "@shared/schema";
import {
  AVIATION_PHOTO_PERMISSION_TEXT,
  AVIATION_PHOTO_PERMISSION_VERSION,
} from "@shared/config/aviationBriefings";
import { db } from "../db";
import { isAuthenticated, isSuperAdmin } from "../auth";
import { createSoftAuthRateLimiter } from "../middleware/rateLimit";
import { S3StorageService } from "../s3Storage";
import { storage } from "../storage";
import { getUncachableResendClient } from "../resendClient";

export const PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const AVIATION_PHOTO_STORAGE_PREFIX =
  "uploads/aviation-briefings/contributor-photos";
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PHOTO_MAX_BYTES, files: 1, fields: 30 },
}).single("photo");
const submitLimit = createSoftAuthRateLimiter({
  windowMs: 60 * 60_000,
  anonMax: 5,
  authMax: 12,
  key: "aviation_photo_submissions",
});
const statuses = [
  "pending",
  "approved",
  "declined",
  "needs_information",
  "published",
  "withdrawn",
] as const;
const clean = z.string().trim().max(300).default("");
const formSchema = z.object({
  submissionToken: z.string().uuid(),
  contributorName: z.string().trim().min(2).max(200),
  contributorEmail: z.string().trim().email().max(320),
  preferredCredit: z.string().trim().min(2).max(250),
  phone: clean,
  homeAirport: clean,
  cityState: clean,
  aircraftMakeModel: clean,
  aircraftRegistration: clean,
  photoLocation: clean,
  dateTaken: clean,
  description: z.string().trim().max(3000).default(""),
  storyContext: z.string().trim().max(8000).default(""),
  profileUrl: z
    .string()
    .trim()
    .max(1000)
    .refine(
      (v) => !v || /^https?:\/\//i.test(v),
      "Profile link must use HTTP or HTTPS",
    )
    .default(""),
  suggestedTopic: clean,
  identifiablePeople: z.string().trim().max(2000).default(""),
  ownershipConfirmed: z.literal("true"),
  permissionAccepted: z.literal("true"),
  company: z.string().max(0).default(""),
});
const updateSchema = z.object({
  reviewStatus: z.enum(statuses).optional(),
  internalNotes: z.string().max(10000).nullable().optional(),
  publicationStatus: z
    .enum(["unpublished", "published", "withdrawn"])
    .optional(),
  associatedBriefingId: z.string().uuid().nullable().optional(),
  publishedImageUrl: z.string().max(2000).nullable().optional(),
  finalCreditLine: z.string().max(500).nullable().optional(),
  altText: z.string().max(1000).nullable().optional(),
  caption: z.string().max(3000).nullable().optional(),
  imageTitle: z.string().max(500).nullable().optional(),
  relevantAircraftType: z.string().max(500).nullable().optional(),
  relevantAirport: z.string().max(300).nullable().optional(),
});

export function detectPhoto(buffer: Buffer) {
  if (
    buffer.length >= 12 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  )
    return { mime: "image/jpeg", ext: "jpg" };
  if (
    buffer.length >= 24 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return {
      mime: "image/png",
      ext: "png",
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return { mime: "image/webp", ext: "webp" };
  return null;
}
function optional(v: string) {
  return v || null;
}
function userId(req: any) {
  return (
    String(
      req.user?.id || req.user?.claims?.sub || req.session?.userId || "",
    ) || null
  );
}
function sourceIp(req: any) {
  return (
    String(
      req.headers["cf-connecting-ip"] ||
        req.headers["x-forwarded-for"] ||
        req.ip ||
        "",
    )
      .split(",")[0]
      .trim()
      .slice(0, 200) || null
  );
}
function safe(row: any) {
  return {
    id: row.id,
    referenceNumber: row.id,
    status: row.reviewStatus,
    createdAt: row.createdAt,
  };
}
async function confirmationEmail(row: any) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    await client.emails.send({
      from: fromEmail,
      to: row.contributorEmail,
      subject: `Ready Set Fly | Briefings photo received — ${row.id}`,
      text: `Thank you for contributing to Ready Set Fly | Briefings. We received ${row.originalFilename}.\n\nPreferred credit: ${row.preferredCredit}\nReference: ${row.id}\n\nSubmission does not guarantee publication. You retain copyright and granted Ready Set Fly the non-exclusive permission described in the Photo Usage Permission agreement. For corrections or withdrawal requests, reply to this email and include your reference number. No image is attached.`,
    });
  } catch (error) {
    console.warn(
      "Aviation photo confirmation email could not be sent",
      error instanceof Error ? error.message : "unknown error",
    );
  }
}

export function registerAviationBriefingPhotoSubmissionRoutes(app: Express) {
  app.post(
    "/api/aviation-briefings/photo-submissions",
    submitLimit,
    (req, res, next) =>
      photoUpload(req, res, (error) => {
        if (error)
          return res
            .status(
              error instanceof multer.MulterError &&
                error.code === "LIMIT_FILE_SIZE"
                ? 413
                : 400,
            )
            .json({
              error:
                error instanceof multer.MulterError &&
                error.code === "LIMIT_FILE_SIZE"
                  ? "Photo must be 15 MB or smaller."
                  : "Unable to accept this upload.",
            });
        next();
      }),
    async (req: any, res, next) => {
      let uploadedKey = "";
      try {
        const parsed = formSchema.safeParse(req.body);
        if (!parsed.success)
          return res
            .status(400)
            .json({
              error:
                "Please complete all required fields and accept the Photo Usage Permission.",
              validation: parsed.error.format(),
            });
        const [duplicate] = await db
          .select()
          .from(aviationBriefingPhotoSubmissions)
          .where(
            eq(
              aviationBriefingPhotoSubmissions.submissionToken,
              parsed.data.submissionToken,
            ),
          )
          .limit(1);
        if (duplicate)
          return res
            .status(200)
            .json({ submission: safe(duplicate), duplicate: true });
        if (!req.file)
          return res.status(400).json({ error: "A photo is required." });
        if (req.file.size > PHOTO_MAX_BYTES)
          return res
            .status(413)
            .json({ error: "Photo must be 15 MB or smaller." });
        const detected = detectPhoto(req.file.buffer);
        if (
          !detected ||
          !["image/jpeg", "image/png", "image/webp"].includes(detected.mime)
        )
          return res
            .status(415)
            .json({ error: "Upload a JPG, PNG, or WebP image." });
        const id = crypto.randomUUID(),
          storedFilename = `${crypto.randomUUID()}.${detected.ext}`;
        uploadedKey = `${AVIATION_PHOTO_STORAGE_PREFIX}/${id}/${storedFilename}`;
        const s3 = new S3StorageService();
        await s3.uploadBuffer({
          key: uploadedKey,
          buffer: req.file.buffer,
          contentType: detected.mime,
        });
        const d = parsed.data,
          now = new Date();
        let row;
        try {
          [row] = await db
            .insert(aviationBriefingPhotoSubmissions)
            .values({
              id,
              submissionToken: d.submissionToken,
              contributorName: d.contributorName,
              contributorEmail: d.contributorEmail,
              phone: optional(d.phone),
              homeAirport: optional(d.homeAirport),
              cityState: optional(d.cityState),
              preferredCredit: d.preferredCredit,
              profileUrl: optional(d.profileUrl),
              aircraftMakeModel: optional(d.aircraftMakeModel),
              aircraftRegistration: optional(d.aircraftRegistration),
              photoLocation: optional(d.photoLocation),
              dateTaken: optional(d.dateTaken),
              description: optional(d.description),
              storyContext: optional(d.storyContext),
              suggestedTopic: optional(d.suggestedTopic),
              identifiablePeople: optional(d.identifiablePeople),
              imageStorageKey: uploadedKey,
              originalFilename: req.file.originalname.slice(0, 500),
              storedFilename,
              mimeType: detected.mime,
              fileSize: req.file.size,
              imageWidth: detected.width || null,
              imageHeight: detected.height || null,
              ownershipConfirmed: true,
              permissionAccepted: true,
              permissionText: AVIATION_PHOTO_PERMISSION_TEXT,
              permissionVersion: AVIATION_PHOTO_PERMISSION_VERSION,
              consentedAt: now,
              userId: userId(req),
              sourceIp: sourceIp(req),
              userAgent:
                String(req.headers["user-agent"] || "").slice(0, 1000) || null,
            })
            .returning();
        } catch (error) {
          await s3.deleteObject(uploadedKey).catch(() => {});
          uploadedKey = "";
          throw error;
        }
        void storage
          .createAdminNotification({
            type: "aviation_briefings_photo_submission",
            title: "New Ready Set Fly Briefings photo submission",
            message: `New Ready Set Fly Briefings photo submitted by ${d.contributorName}. Reference ${id}.`,
            isRead: false,
            isActionable: true,
          })
          .catch(() => {});
        void confirmationEmail(row);
        res.status(201).json({ submission: safe(row) });
      } catch (error) {
        if (uploadedKey)
          await new S3StorageService()
            .deleteObject(uploadedKey)
            .catch(() => {});
        next(error);
      }
    },
  );
  app.get(
    "/api/admin/aviation-briefings/photo-submissions",
    isAuthenticated,
    isSuperAdmin,
    async (_req, res, next) => {
      try {
        const rows = await db
          .select()
          .from(aviationBriefingPhotoSubmissions)
          .orderBy(desc(aviationBriefingPhotoSubmissions.createdAt));
        const briefings = await db
          .select({ id: aviationBriefings.id, title: aviationBriefings.title })
          .from(aviationBriefings)
          .orderBy(desc(aviationBriefings.publishedAt));
        res.json({
          submissions: rows,
          briefings,
          permissionVersion: AVIATION_PHOTO_PERMISSION_VERSION,
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/admin/aviation-briefings/photo-submissions/:id",
    isAuthenticated,
    isSuperAdmin,
    async (req, res, next) => {
      try {
        const parsed = updateSchema.safeParse(req.body);
        if (!parsed.success)
          return res.status(400).json({ error: "Invalid review update." });
        const [row] = await db
          .update(aviationBriefingPhotoSubmissions)
          .set({ ...parsed.data, updatedAt: new Date() })
          .where(eq(aviationBriefingPhotoSubmissions.id, req.params.id))
          .returning();
        if (!row)
          return res.status(404).json({ error: "Submission not found" });
        res.json({ submission: row });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/admin/aviation-briefings/photo-submissions/:id/image",
    isAuthenticated,
    isSuperAdmin,
    async (req, res, next) => {
      try {
        const [row] = await db
          .select()
          .from(aviationBriefingPhotoSubmissions)
          .where(eq(aviationBriefingPhotoSubmissions.id, req.params.id))
          .limit(1);
        if (!row)
          return res.status(404).json({ error: "Submission not found" });
        const object = await new S3StorageService().getObjectStream({
          key: row.imageStorageKey,
        });
        res.setHeader("Content-Type", row.mimeType);
        res.setHeader("Cache-Control", "private, no-store");
        if (req.query.download === "1")
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${row.originalFilename.replace(/["\r\n]/g, "")}"`,
          );
        object.stream.pipe(res);
      } catch (e) {
        next(e);
      }
    },
  );
}
