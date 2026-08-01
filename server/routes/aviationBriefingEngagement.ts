import crypto from "crypto";
import type { Express } from "express";
import { and, desc, eq, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  analyticsEvents,
  aviationBriefingFeedback,
  aviationBriefingSaves,
  aviationBriefingSuggestions,
  aviationBriefings,
  aviationContributorInvitations,
} from "@shared/schema";
import { db } from "../db";
import { isAuthenticated, isSuperAdmin } from "../auth";
import { createSoftAuthRateLimiter } from "../middleware/rateLimit";

const suggestionLimit = createSoftAuthRateLimiter({
  windowMs: 60 * 60_000,
  anonMax: 5,
  authMax: 15,
  key: "aviation_briefing_suggestions",
});
const feedbackLimit = createSoftAuthRateLimiter({
  windowMs: 15 * 60_000,
  anonMax: 30,
  authMax: 60,
  key: "aviation_briefing_feedback",
});
const uid = (req: any) =>
  String(req.user?.id || req.user?.claims?.sub || req.session?.userId || "") ||
  null;
const publicVisibility = () =>
  or(
    and(
      eq(aviationBriefings.status, "published"),
      lte(aviationBriefings.publishedAt, new Date()),
    ),
    and(
      eq(aviationBriefings.status, "scheduled"),
      lte(aviationBriefings.scheduledAt, new Date()),
    ),
  );
function cookie(req: any, name: string) {
  return (
    String(req.headers.cookie || "")
      .split(";")
      .map((x: string) => x.trim())
      .find((x: string) => x.startsWith(`${name}=`))
      ?.slice(name.length + 1) || ""
  );
}
function reader(req: any, res: any) {
  let token = cookie(req, "rsf_briefing_reader");
  if (!/^[a-f0-9]{48}$/.test(token)) {
    token = crypto.randomBytes(24).toString("hex");
    res.append(
      "Set-Cookie",
      `rsf_briefing_reader=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
  }
  return crypto
    .createHash("sha256")
    .update(uid(req) || token)
    .digest("hex");
}
const suggestionSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  suggestedPerson: z.string().trim().min(2).max(300),
  organization: z.string().trim().max(300).default(""),
  topic: z.string().trim().min(3).max(500),
  reason: z.string().trim().min(10).max(5000),
  website: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => !v || /^https?:\/\//i.test(v), "Invalid website")
    .default(""),
  notes: z.string().max(5000).default(""),
  sourceBriefingId: z.string().uuid().nullable().optional(),
  company: z.string().max(0).optional(),
});
export function registerAviationBriefingEngagementRoutes(app: Express) {
  app.get(
    "/api/aviation-briefings/:id/engagement",
    async (req: any, res, next) => {
      try {
        const [visible] = await db
          .select({ id: aviationBriefings.id })
          .from(aviationBriefings)
          .where(
            and(eq(aviationBriefings.id, req.params.id), publicVisibility()),
          )
          .limit(1);
        if (!visible)
          return res.status(404).json({ error: "Briefing not found" });
        const hash = reader(req, res);
        const [feedback] = await db
          .select({ responseType: aviationBriefingFeedback.responseType })
          .from(aviationBriefingFeedback)
          .where(
            and(
              eq(aviationBriefingFeedback.briefingId, req.params.id),
              eq(aviationBriefingFeedback.readerHash, hash),
            ),
          )
          .limit(1);
        const user = uid(req);
        const [saved] = user
          ? await db
              .select({ id: aviationBriefingSaves.id })
              .from(aviationBriefingSaves)
              .where(
                and(
                  eq(aviationBriefingSaves.briefingId, req.params.id),
                  eq(aviationBriefingSaves.userId, user),
                ),
              )
              .limit(1)
          : [];
        res.json({
          feedback: feedback?.responseType || null,
          saved: Boolean(saved),
          authenticated: Boolean(user),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/aviation-briefings/:id/feedback",
    feedbackLimit,
    async (req: any, res, next) => {
      try {
        const parsed = z
          .object({ responseType: z.enum(["helpful", "learn_more"]) })
          .safeParse(req.body);
        if (!parsed.success)
          return res
            .status(400)
            .json({ error: "Choose one feedback response." });
        const [visible] = await db
          .select({ id: aviationBriefings.id })
          .from(aviationBriefings)
          .where(
            and(eq(aviationBriefings.id, req.params.id), publicVisibility()),
          )
          .limit(1);
        if (!visible)
          return res.status(404).json({ error: "Briefing not found" });
        const hash = reader(req, res);
        const [row] = await db
          .insert(aviationBriefingFeedback)
          .values({
            briefingId: req.params.id,
            readerHash: hash,
            userId: uid(req),
            responseType: parsed.data.responseType,
          })
          .onConflictDoUpdate({
            target: [
              aviationBriefingFeedback.briefingId,
              aviationBriefingFeedback.readerHash,
            ],
            set: { responseType: parsed.data.responseType },
          })
          .returning();
        res.json({ feedback: row.responseType });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/aviation-briefings/:id/save",
    isAuthenticated,
    async (req: any, res, next) => {
      try {
        const [visible] = await db
          .select({ id: aviationBriefings.id })
          .from(aviationBriefings)
          .where(
            and(eq(aviationBriefings.id, req.params.id), publicVisibility()),
          )
          .limit(1);
        if (!visible)
          return res.status(404).json({ error: "Briefing not found" });
        const user = uid(req)!;
        const [row] = await db
          .insert(aviationBriefingSaves)
          .values({ briefingId: req.params.id, userId: user })
          .onConflictDoNothing()
          .returning();
        res.json({ saved: true, id: row?.id || null });
      } catch (e) {
        next(e);
      }
    },
  );
  app.delete(
    "/api/aviation-briefings/:id/save",
    isAuthenticated,
    async (req: any, res, next) => {
      try {
        await db
          .delete(aviationBriefingSaves)
          .where(
            and(
              eq(aviationBriefingSaves.briefingId, req.params.id),
              eq(aviationBriefingSaves.userId, uid(req)!),
            ),
          );
        res.json({ saved: false });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/aviation-briefings/saved/me",
    isAuthenticated,
    async (req: any, res, next) => {
      try {
        const rows = await db
          .select({
            briefing: aviationBriefings,
            savedAt: aviationBriefingSaves.createdAt,
          })
          .from(aviationBriefingSaves)
          .innerJoin(
            aviationBriefings,
            eq(aviationBriefingSaves.briefingId, aviationBriefings.id),
          )
          .where(
            and(
              eq(aviationBriefingSaves.userId, uid(req)!),
              publicVisibility(),
            ),
          )
          .orderBy(desc(aviationBriefingSaves.createdAt));
        res.json({ briefings: rows });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/aviation-briefings/suggestions",
    suggestionLimit,
    async (req, res, next) => {
      try {
        const parsed = suggestionSchema.safeParse(req.body);
        if (!parsed.success)
          return res
            .status(400)
            .json({
              error: "Please correct the suggestion form.",
              validation: parsed.error.format(),
            });
        if (parsed.data.company)
          return res.status(202).json({ received: true });
        const recent = await db
          .select({ id: aviationBriefingSuggestions.id })
          .from(aviationBriefingSuggestions)
          .where(
            and(
              eq(aviationBriefingSuggestions.email, parsed.data.email),
              eq(aviationBriefingSuggestions.topic, parsed.data.topic),
            ),
          )
          .limit(1);
        if (recent.length) return res.json({ received: true, duplicate: true });
        const { company: _, ...input } = parsed.data;
        await db
          .insert(aviationBriefingSuggestions)
          .values({
            ...input,
            organization: input.organization || null,
            website: input.website || null,
            notes: input.notes || null,
          });
        res.status(201).json({ received: true });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/admin/aviation-briefings/engagement-analytics",
    isAuthenticated,
    isSuperAdmin,
    async (_req, res, next) => {
      try {
        const [feedback, saves, suggestions, shares] = await Promise.all([
          db
            .select({
              briefingId: aviationBriefingFeedback.briefingId,
              title: aviationBriefings.title,
              category: aviationBriefings.category,
              responseType: aviationBriefingFeedback.responseType,
              count: sql<number>`count(*)::int`,
            })
            .from(aviationBriefingFeedback)
            .innerJoin(
              aviationBriefings,
              eq(aviationBriefingFeedback.briefingId, aviationBriefings.id),
            )
            .groupBy(
              aviationBriefingFeedback.briefingId,
              aviationBriefings.title,
              aviationBriefings.category,
              aviationBriefingFeedback.responseType,
            ),
          db
            .select({
              briefingId: aviationBriefingSaves.briefingId,
              title: aviationBriefings.title,
              count: sql<number>`count(*)::int`,
            })
            .from(aviationBriefingSaves)
            .innerJoin(
              aviationBriefings,
              eq(aviationBriefingSaves.briefingId, aviationBriefings.id),
            )
            .groupBy(aviationBriefingSaves.briefingId, aviationBriefings.title),
          db
            .select({
              status: aviationBriefingSuggestions.status,
              count: sql<number>`count(*)::int`,
            })
            .from(aviationBriefingSuggestions)
            .groupBy(aviationBriefingSuggestions.status),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(analyticsEvents)
            .where(eq(analyticsEvents.event, "aviation_briefing_shared")),
        ]);
        res.json({
          feedback,
          saves,
          suggestions,
          shareActions: shares[0]?.count || 0,
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/admin/aviation-briefings/performance",
    isAuthenticated,
    isSuperAdmin,
    async (req, res, next) => {
      try {
        const parsed = z
          .object({
            range: z.enum(["7", "30", "90", "lifetime"]).default("30"),
          })
          .safeParse(req.query);
        if (!parsed.success)
          return res.status(400).json({ error: "Invalid performance range" });
        const range = parsed.data.range,
          cutoff =
            range === "lifetime"
              ? null
              : new Date(Date.now() - Number(range) * 86400000),
          analyticsDate = cutoff ? sql`AND "created_at" >= ${cutoff}` : sql``,
          feedbackDate = cutoff ? sql`AND f."created_at" >= ${cutoff}` : sql``,
          savesDate = cutoff ? sql`AND s."created_at" >= ${cutoff}` : sql``;
        const [
          briefings,
          eventResult,
          returningResult,
          feedbackResult,
          saveResult,
        ] = await Promise.all([
          db
            .select({
              id: aviationBriefings.id,
              title: aviationBriefings.title,
              slug: aviationBriefings.slug,
              category: aviationBriefings.category,
              contentType: aviationBriefings.contentType,
              status: aviationBriefings.status,
              publishedAt: aviationBriefings.publishedAt,
            })
            .from(aviationBriefings)
            .where(sql`${aviationBriefings.status} <> 'archived'`)
            .orderBy(desc(aviationBriefings.publishedAt)),
          db.execute(
            sql`SELECT "meta"->>'briefingId' AS "briefingId",count(*) FILTER (WHERE "event"='aviation_briefing_opened')::int AS "views",count(DISTINCT "visitor_id") FILTER (WHERE "event"='aviation_briefing_opened')::int AS "uniqueReaders",count(*) FILTER (WHERE "event"='aviation_briefing_shared')::int AS "shares",count(*) FILTER (WHERE "event"='aviation_briefing_tool_clicked')::int AS "toolClicks",count(*) FILTER (WHERE "event"='aviation_contributor_external_link_clicked')::int AS "contributorClicks",count(*) FILTER (WHERE "event"='aviation_briefing_video_started')::int AS "videoStarts" FROM "analytics_events" WHERE "event" IN ('aviation_briefing_opened','aviation_briefing_shared','aviation_briefing_tool_clicked','aviation_contributor_external_link_clicked','aviation_briefing_video_started') AND "meta"->>'briefingId' IS NOT NULL ${analyticsDate} GROUP BY 1`,
          ),
          db.execute(
            sql`SELECT "briefingId",count(*)::int AS "returningReaders" FROM (SELECT "meta"->>'briefingId' AS "briefingId","visitor_id" FROM "analytics_events" WHERE "event"='aviation_briefing_opened' AND "meta"->>'briefingId' IS NOT NULL ${analyticsDate} GROUP BY 1,2 HAVING count(*)>1) repeated GROUP BY 1`,
          ),
          db.execute(
            sql`SELECT f."briefing_id" AS "briefingId",count(*) FILTER (WHERE f."response_type"='helpful')::int AS "helpful",count(*) FILTER (WHERE f."response_type"='learn_more')::int AS "learnMore" FROM "aviation_briefing_feedback" f WHERE true ${feedbackDate} GROUP BY 1`,
          ),
          db.execute(
            sql`SELECT s."briefing_id" AS "briefingId",count(*)::int AS "saves" FROM "aviation_briefing_saves" s WHERE true ${savesDate} GROUP BY 1`,
          ),
        ]);
        const byId = (rows: any[]) =>
            new Map(rows.map((row) => [String(row.briefingId), row])),
          events = byId(eventResult.rows || []),
          returning = byId(returningResult.rows || []),
          feedback = byId(feedbackResult.rows || []),
          saves = byId(saveResult.rows || []);
        const rows = briefings.map((briefing) => {
          const e: any = events.get(briefing.id) || {},
            r: any = returning.get(briefing.id) || {},
            f: any = feedback.get(briefing.id) || {},
            s: any = saves.get(briefing.id) || {};
          const views = Number(e.views || 0),
            helpful = Number(f.helpful || 0),
            learnMore = Number(f.learnMore || 0),
            saved = Number(s.saves || 0),
            shares = Number(e.shares || 0),
            toolClicks = Number(e.toolClicks || 0),
            contributorClicks = Number(e.contributorClicks || 0),
            actions =
              helpful +
              learnMore +
              saved +
              shares +
              toolClicks +
              contributorClicks;
          return {
            ...briefing,
            views,
            uniqueReaders: Number(e.uniqueReaders || 0),
            returningReaders: Number(r.returningReaders || 0),
            helpful,
            learnMore,
            saves: saved,
            shares,
            toolClicks,
            contributorClicks,
            videoStarts: Number(e.videoStarts || 0),
            engagementRate: views
              ? Math.round((actions / views) * 1000) / 10
              : 0,
          };
        });
        const totals = rows.reduce(
          (sum, row) => ({
            views: sum.views + row.views,
            uniqueReaders: sum.uniqueReaders + row.uniqueReaders,
            returningReaders: sum.returningReaders + row.returningReaders,
            helpful: sum.helpful + row.helpful,
            learnMore: sum.learnMore + row.learnMore,
            saves: sum.saves + row.saves,
            shares: sum.shares + row.shares,
            toolClicks: sum.toolClicks + row.toolClicks,
            contributorClicks: sum.contributorClicks + row.contributorClicks,
            videoStarts: sum.videoStarts + row.videoStarts,
          }),
          {
            views: 0,
            uniqueReaders: 0,
            returningReaders: 0,
            helpful: 0,
            learnMore: 0,
            saves: 0,
            shares: 0,
            toolClicks: 0,
            contributorClicks: 0,
            videoStarts: 0,
          },
        );
        res.json({ range, totals, rows });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/admin/aviation-briefing-suggestions",
    isAuthenticated,
    isSuperAdmin,
    async (_req, res, next) => {
      try {
        res.json({
          suggestions: await db
            .select()
            .from(aviationBriefingSuggestions)
            .orderBy(desc(aviationBriefingSuggestions.createdAt)),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/admin/aviation-briefing-suggestions/:id",
    isAuthenticated,
    isSuperAdmin,
    async (req: any, res, next) => {
      try {
        const parsed = z
          .object({
            status: z
              .enum(["new", "reviewing", "contacted", "completed", "closed"])
              .optional(),
            assignedAdminUserId: z.string().nullable().optional(),
            notes: z.string().max(5000).optional(),
          })
          .safeParse(req.body);
        if (!parsed.success)
          return res.status(400).json({ error: "Invalid suggestion update" });
        const [row] = await db
          .update(aviationBriefingSuggestions)
          .set({ ...parsed.data, updatedAt: new Date() })
          .where(eq(aviationBriefingSuggestions.id, req.params.id))
          .returning();
        res.json({ suggestion: row });
      } catch (e) {
        next(e);
      }
    },
  );
  app.delete(
    "/api/admin/aviation-briefing-suggestions/:id",
    isAuthenticated,
    isSuperAdmin,
    async (req, res, next) => {
      try {
        await db
          .delete(aviationBriefingSuggestions)
          .where(eq(aviationBriefingSuggestions.id, req.params.id));
        res.status(204).end();
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/admin/aviation-briefing-suggestions/:id/convert-to-invitation",
    isAuthenticated,
    isSuperAdmin,
    async (req: any, res, next) => {
      try {
        const [suggestion] = await db
          .select()
          .from(aviationBriefingSuggestions)
          .where(eq(aviationBriefingSuggestions.id, req.params.id))
          .limit(1);
        if (!suggestion)
          return res.status(404).json({ error: "Suggestion not found" });
        const token = crypto.randomBytes(32).toString("base64url");
        const [invite] = await db
          .insert(aviationContributorInvitations)
          .values({
            tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
            contributorName: suggestion.suggestedPerson,
            contributorEmail: suggestion.email,
            organization: suggestion.organization,
            internalNote: `Created from future briefing suggestion: ${suggestion.topic}`,
            createdByUserId: uid(req),
          })
          .returning();
        await db
          .update(aviationBriefingSuggestions)
          .set({
            status: "contacted",
            convertedInvitationId: invite.id,
            updatedAt: new Date(),
          })
          .where(eq(aviationBriefingSuggestions.id, suggestion.id));
        res
          .status(201)
          .json({
            invitation: invite,
            submissionUrl: `${req.protocol}://${req.get("host")}/aviation-briefings/submit/${token}`,
          });
      } catch (e) {
        next(e);
      }
    },
  );
}
