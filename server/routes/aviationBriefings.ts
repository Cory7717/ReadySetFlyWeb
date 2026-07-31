import express, { type Express } from "express";
import { randomUUID } from "crypto";
import { and, asc, desc, eq, ilike, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { aviationBriefings } from "@shared/schema";
import {
  AVIATION_BRIEFING_CATEGORIES,
  aviationBriefingInputSchema,
  validateBriefingVideo,
  type AviationBriefingInput,
} from "@shared/config/aviationBriefings";
import { db } from "../db";
import { isAuthenticated, isSuperAdmin } from "../auth";
import { S3StorageService } from "../s3Storage";

const listSchema = z.object({
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(120).optional(),
  contentType: z.enum(["article", "video"]).optional(),
  featured: z.enum(["true", "false"]).optional(),
  contributor: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  sort: z.enum(["newest", "oldest", "title"]).default("newest"),
});

const adminListSchema = listSchema.extend({
  status: z.enum(["draft", "review", "scheduled", "published", "archived"]).optional(),
});

function requestUserId(req: any) {
  return String(req.user?.id || req.user?.claims?.sub || req.session?.userId || "") || null;
}

function publicVisibility(now = new Date()) {
  return or(
    and(eq(aviationBriefings.status, "published"), lte(aviationBriefings.publishedAt, now)),
    and(eq(aviationBriefings.status, "scheduled"), lte(aviationBriefings.scheduledAt, now)),
  );
}

function mapInput(input: AviationBriefingInput, userId: string | null) {
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const publishedAt = input.publishedAt ? new Date(input.publishedAt) : input.status === "published" ? new Date() : null;
  return {
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt,
    contentType: input.contentType,
    category: input.category,
    status: input.status,
    isFeatured: input.isFeatured,
    featuredImageUrl: input.featuredImageUrl || null,
    featuredImageStorageKey: input.featuredImageStorageKey || null,
    featuredImageAlt: input.featuredImageAlt || null,
    articleContentJson: input.articleContent,
    videoSourceType: input.contentType === "video" ? input.videoSourceType : null,
    videoUrl: input.contentType === "video" ? input.videoUrl || null : null,
    videoStorageKey: input.contentType === "video" ? input.videoStorageKey || null : null,
    videoThumbnailUrl: input.contentType === "video" ? input.videoThumbnailUrl || null : null,
    videoDurationSeconds: input.contentType === "video" ? input.videoDurationSeconds : null,
    videoTranscript: input.contentType === "video" ? input.videoTranscript || null : null,
    supportingContentJson: input.supportingContent,
    contributorsJson: input.contributors,
    relevantToolIdsJson: input.relevantToolIds,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    publishedAt,
    scheduledAt,
    updatedByUserId: userId,
    updatedAt: new Date(),
  };
}

function publicBriefing(row: typeof aviationBriefings.$inferSelect) {
  return {
    id: row.id, title: row.title, slug: row.slug, excerpt: row.excerpt,
    contentType: row.contentType, category: row.category, status: row.status,
    isFeatured: row.isFeatured, featuredImageUrl: row.featuredImageUrl,
    featuredImageStorageKey: row.featuredImageStorageKey,
    featuredImageAlt: row.featuredImageAlt, articleContent: row.articleContentJson,
    videoSourceType: row.videoSourceType, videoUrl: row.videoUrl, videoStorageKey: row.videoStorageKey,
    videoThumbnailUrl: row.videoThumbnailUrl, videoDurationSeconds: row.videoDurationSeconds,
    videoTranscript: row.videoTranscript, supportingContent: row.supportingContentJson,
    contributors: row.contributorsJson, relevantToolIds: row.relevantToolIdsJson,
    seoTitle: row.seoTitle, seoDescription: row.seoDescription,
    publishedAt: row.publishedAt, scheduledAt: row.scheduledAt,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

function filtersFor(input: z.infer<typeof listSchema>, includeStatus?: string) {
  const filters: any[] = [];
  if (includeStatus) filters.push(eq(aviationBriefings.status, includeStatus));
  if (input.category) filters.push(eq(aviationBriefings.category, input.category));
  if (input.contentType) filters.push(eq(aviationBriefings.contentType, input.contentType));
  if (input.featured) filters.push(eq(aviationBriefings.isFeatured, input.featured === "true"));
  if (input.search) {
    const term = `%${input.search}%`;
    filters.push(or(ilike(aviationBriefings.title, term), ilike(aviationBriefings.slug, term), ilike(aviationBriefings.excerpt, term), ilike(aviationBriefings.category, term)));
  }
  if (input.contributor) filters.push(sql`${aviationBriefings.contributorsJson}::text ILIKE ${`%${input.contributor}%`}`);
  return filters;
}

export function registerAviationBriefingRoutes(app: Express) {
  app.get("/api/aviation-briefings/categories", async (_req, res, next) => {
    try {
      const rows = await db.selectDistinct({ category: aviationBriefings.category }).from(aviationBriefings).orderBy(asc(aviationBriefings.category));
      res.json({ categories: Array.from(new Set([...AVIATION_BRIEFING_CATEGORIES, ...rows.map((row) => row.category)])) });
    } catch (error) { next(error); }
  });

  app.get("/api/aviation-briefings", async (req, res, next) => {
    try {
      const parsed = listSchema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: "Invalid briefing filters", validation: parsed.error.format() });
      const input = parsed.data;
      const conditions = [publicVisibility(), ...filtersFor(input)];
      const where = and(...conditions);
      const order = input.sort === "oldest" ? asc(aviationBriefings.publishedAt) : input.sort === "title" ? asc(aviationBriefings.title) : desc(aviationBriefings.publishedAt);
      const [rows, totals] = await Promise.all([
        db.select().from(aviationBriefings).where(where).orderBy(desc(aviationBriefings.isFeatured), order).limit(input.limit).offset((input.page - 1) * input.limit),
        db.select({ count: sql<number>`count(*)::int` }).from(aviationBriefings).where(where),
      ]);
      res.json({ briefings: rows.map(publicBriefing), page: input.page, limit: input.limit, total: totals[0]?.count || 0 });
    } catch (error) { next(error); }
  });

  app.get("/api/aviation-briefings/:slug", async (req, res, next) => {
    try {
      const [row] = await db.select().from(aviationBriefings).where(and(eq(aviationBriefings.slug, String(req.params.slug)), publicVisibility())).limit(1);
      if (!row) return res.status(404).json({ error: "Briefing not found" });
      const related = await db.select().from(aviationBriefings).where(and(publicVisibility(), eq(aviationBriefings.category, row.category), sql`${aviationBriefings.id} <> ${row.id}`)).orderBy(desc(aviationBriefings.publishedAt)).limit(3);
      res.json({ briefing: publicBriefing(row), related: related.map(publicBriefing) });
    } catch (error) { next(error); }
  });

  app.get("/api/admin/aviation-briefings", isAuthenticated, isSuperAdmin, async (req, res, next) => {
    try {
      const parsed = adminListSchema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: "Invalid briefing filters", validation: parsed.error.format() });
      const input = parsed.data;
      const filters = filtersFor(input, input.status);
      const where = filters.length ? and(...filters) : undefined;
      const [rows, totals] = await Promise.all([
        db.select().from(aviationBriefings).where(where).orderBy(desc(aviationBriefings.updatedAt)).limit(input.limit).offset((input.page - 1) * input.limit),
        db.select({ count: sql<number>`count(*)::int` }).from(aviationBriefings).where(where),
      ]);
      const summaryRows = await db.select({ status: aviationBriefings.status, contentType: aviationBriefings.contentType, featured: aviationBriefings.isFeatured, count: sql<number>`count(*)::int` }).from(aviationBriefings).groupBy(aviationBriefings.status, aviationBriefings.contentType, aviationBriefings.isFeatured);
      res.json({ briefings: rows.map(publicBriefing), total: totals[0]?.count || 0, summaryRows });
    } catch (error) { next(error); }
  });

  app.get("/api/admin/aviation-briefings/:id", isAuthenticated, isSuperAdmin, async (req, res, next) => {
    try {
      const [row] = await db.select().from(aviationBriefings).where(eq(aviationBriefings.id, String(req.params.id))).limit(1);
      if (!row) return res.status(404).json({ error: "Briefing not found" });
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      res.json({ briefing: publicBriefing(row) });
    } catch (error) { next(error); }
  });

  app.post("/api/admin/aviation-briefings", isAuthenticated, isSuperAdmin, async (req: any, res, next) => {
    try {
      const parsed = aviationBriefingInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid briefing", validation: parsed.error.format() });
      const videoError = validateBriefingVideo(parsed.data);
      if (videoError) return res.status(400).json({ error: videoError });
      if (parsed.data.status === "scheduled" && !parsed.data.scheduledAt) return res.status(400).json({ error: "A scheduled briefing requires a scheduled publication date." });
      const userId = requestUserId(req);
      const [row] = await db.insert(aviationBriefings).values({ ...mapInput(parsed.data, userId), createdByUserId: userId }).returning();
      res.status(201).json({ briefing: publicBriefing(row) });
    } catch (error: any) {
      if (error?.code === "23505") {
        const slug = typeof req.body?.slug === "string" ? req.body.slug : "";
        const [existing] = slug ? await db.select().from(aviationBriefings).where(eq(aviationBriefings.slug, slug)).limit(1) : [];
        if (existing) return res.status(200).json({ briefing: publicBriefing(existing), recoveredExisting: true });
        return res.status(409).json({ error: "That slug is already in use." });
      }
      next(error);
    }
  });

  app.patch("/api/admin/aviation-briefings/:id", isAuthenticated, isSuperAdmin, async (req: any, res, next) => {
    try {
      const parsed = aviationBriefingInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid briefing", validation: parsed.error.format() });
      const videoError = validateBriefingVideo(parsed.data);
      if (videoError) return res.status(400).json({ error: videoError });
      if (parsed.data.status === "scheduled" && !parsed.data.scheduledAt) return res.status(400).json({ error: "A scheduled briefing requires a scheduled publication date." });
      const [row] = await db.update(aviationBriefings).set(mapInput(parsed.data, requestUserId(req))).where(eq(aviationBriefings.id, String(req.params.id))).returning();
      if (!row) return res.status(404).json({ error: "Briefing not found" });
      res.json({ briefing: publicBriefing(row) });
    } catch (error: any) {
      if (error?.code === "23505") return res.status(409).json({ error: "That slug is already in use." });
      next(error);
    }
  });

  app.post("/api/admin/aviation-briefings/:id/:action", isAuthenticated, isSuperAdmin, async (req: any, res, next) => {
    try {
      const action = z.enum(["publish", "unpublish", "archive", "submit-for-review"]).safeParse(req.params.action);
      if (!action.success) return res.status(404).json({ error: "Unknown publishing action" });
      const status = action.data === "publish" ? "published" : action.data === "unpublish" ? "draft" : action.data === "archive" ? "archived" : "review";
      const updates: any = { status, updatedAt: new Date(), updatedByUserId: requestUserId(req) };
      if (status === "published") updates.publishedAt = new Date();
      const [row] = await db.update(aviationBriefings).set(updates).where(eq(aviationBriefings.id, String(req.params.id))).returning();
      if (!row) return res.status(404).json({ error: "Briefing not found" });
      res.json({ briefing: publicBriefing(row) });
    } catch (error) { next(error); }
  });

  app.delete("/api/admin/aviation-briefings/:id", isAuthenticated, isSuperAdmin, async (req, res, next) => {
    try {
      const [row] = await db.delete(aviationBriefings).where(eq(aviationBriefings.id, String(req.params.id))).returning({ id: aviationBriefings.id });
      if (!row) return res.status(404).json({ error: "Briefing not found" });
      res.status(204).end();
    } catch (error) { next(error); }
  });

  app.post("/api/admin/aviation-briefings/upload", isAuthenticated, isSuperAdmin, async (req, res, next) => {
    try {
      const parsed = z.object({ contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), size: z.number().int().positive().max(10 * 1024 * 1024) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Use a JPG, PNG, or WebP image no larger than 10 MB." });
      if (!process.env.AWS_S3_BUCKET) return res.status(503).json({ error: "Durable briefing media storage is not configured." });
      const storage = new S3StorageService();
      const upload = await storage.getPresignedUploadUrlForKey({ prefix: "aviation-briefings", contentType: parsed.data.contentType });
      res.json({ ...upload, publicUrl: `/api/aviation-briefings/media?key=${encodeURIComponent(upload.key)}` });
    } catch (error) { next(error); }
  });

  app.post(
    "/api/admin/aviation-briefings/upload-direct",
    isAuthenticated,
    isSuperAdmin,
    express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "10mb" }),
    async (req, res, next) => {
      try {
        const contentType = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
        if (!["image/jpeg", "image/png", "image/webp"].includes(contentType) || !Buffer.isBuffer(req.body) || !req.body.length) {
          return res.status(400).json({ error: "Use a JPG, PNG, or WebP image no larger than 10 MB." });
        }
        if (!process.env.AWS_S3_BUCKET) return res.status(503).json({ error: "Durable briefing media storage is not configured." });
        const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
        const key = `aviation-briefings/${randomUUID()}.${extension}`;
        await new S3StorageService().uploadBytes({ key, body: req.body, contentType });
        res.status(201).json({ key, publicUrl: `/api/aviation-briefings/media?key=${encodeURIComponent(key)}` });
      } catch (error) { next(error); }
    },
  );

  app.get("/api/aviation-briefings/media", async (req, res, next) => {
    try {
      const key = String(req.query.key || "");
      if (!key.startsWith("aviation-briefings/") || key.includes("..")) return res.status(400).json({ error: "Invalid media key" });
      const object = await new S3StorageService().getObjectStream({ key });
      res.setHeader("Content-Type", object.contentType || "application/octet-stream");
      res.setHeader("Cache-Control", "public, max-age=86400");
      object.stream.pipe(res);
    } catch (error) { next(error); }
  });
}
