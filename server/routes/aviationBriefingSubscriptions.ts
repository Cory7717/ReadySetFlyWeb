import crypto from "crypto";
import type { Express, Request } from "express";
import { and, desc, eq, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  aviationBriefingEmailDeliveries,
  aviationBriefingSubscribers,
  aviationBriefings,
} from "@shared/schema";
import { db } from "../db";
import { isAuthenticated, isSuperAdmin } from "../auth";
import { createSoftAuthRateLimiter } from "../middleware/rateLimit";
import { getUncachableResendClient } from "../resendClient";
import { getApiBaseUrl, getFrontendBaseUrl } from "../authRedirectUrls";

const subscribeLimit = createSoftAuthRateLimiter({
  windowMs: 60 * 60_000,
  anonMax: 8,
  authMax: 20,
  key: "aviation_briefing_subscribe",
});
const hash = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");
const token = () => crypto.randomBytes(32).toString("base64url");
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const sourceIp = (req: any) =>
  String(
    req.headers["cf-connecting-ip"] ||
      req.headers["x-forwarded-for"] ||
      req.ip ||
      "",
  )
    .split(",")[0]
    .trim()
    .slice(0, 200) || null;

function articleImage(briefing: any, req?: Request) {
  if (briefing.featuredImageStorageKey)
    return `${getApiBaseUrl(req)}/api/aviation-briefings/media?key=${encodeURIComponent(briefing.featuredImageStorageKey)}`;
  const candidate = briefing.featuredImageUrl || briefing.videoThumbnailUrl;
  if (candidate) return /^https?:\/\//i.test(candidate) ? candidate : new URL(candidate, getFrontendBaseUrl(req)).toString();
  return `${getFrontendBaseUrl(req)}/RSFOpaqueLogo.png`;
}
function articleEmail(
  briefing: any,
  subscriber: { unsubscribeToken: string },
  req?: Request,
) {
  const web = getFrontendBaseUrl(req),
    url = `${web}/aviation-briefings/${briefing.slug}`,
    unsubscribe = `${getApiBaseUrl(req)}/api/aviation-briefings/subscriptions/unsubscribe/${subscriber.unsubscribeToken}`,
    title = escapeHtml(briefing.title),
    excerpt = escapeHtml(briefing.excerpt),
    image = escapeHtml(articleImage(briefing, req));
  return {
    subject: `New Aviation Briefing: ${briefing.title}`,
    html: `<!doctype html><html><body style="margin:0;background:#07101c;font-family:Arial,sans-serif;color:#172033"><div style="max-width:680px;margin:auto;padding:24px"><div style="background:#fff;border-radius:14px;overflow:hidden"><img src="${image}" alt="" style="display:block;width:100%;max-height:330px;object-fit:cover"><div style="padding:30px"><div style="color:#2868b2;font-size:12px;font-weight:bold;letter-spacing:2px">READY SET FLY · AVIATION BRIEFINGS</div><h1 style="font-size:30px;line-height:1.15;margin:14px 0">${title}</h1><p style="font-size:17px;line-height:1.65;color:#445268">${excerpt}</p><a href="${url}" style="display:inline-block;margin-top:12px;padding:13px 20px;background:#2d73d5;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Read the full briefing</a></div></div><p style="color:#9fb0c4;font-size:12px;text-align:center;line-height:1.5">You subscribed to Aviation Briefings updates from Ready Set Fly.<br><a href="${unsubscribe}" style="color:#9fc5f8">Unsubscribe</a></p></div></body></html>`,
    text: `New Aviation Briefing: ${briefing.title}\n\n${briefing.excerpt}\n\nRead: ${url}\n\nUnsubscribe: ${unsubscribe}`,
  };
}

export async function sendAviationBriefingAnnouncement(
  briefingId: string,
  options: { req?: Request; forceRetry?: boolean } = {},
) {
  const now = new Date();
  const [briefing] = await db
    .select()
    .from(aviationBriefings)
    .where(
      and(
        eq(aviationBriefings.id, briefingId),
        or(
          eq(aviationBriefings.status, "published"),
          and(
            eq(aviationBriefings.status, "scheduled"),
            lte(aviationBriefings.scheduledAt, now),
          ),
        ),
      ),
    )
    .limit(1);
  if (!briefing) return { sent: 0, failed: 0, skipped: 0 };
  const subscribers = await db
    .select()
    .from(aviationBriefingSubscribers)
    .where(eq(aviationBriefingSubscribers.status, "active"));
  const { client, fromEmail } = await getUncachableResendClient();
  let sent = 0,
    failed = 0,
    skipped = 0;
  for (const subscriber of subscribers) {
    const [existing] = await db
      .select()
      .from(aviationBriefingEmailDeliveries)
      .where(
        and(
          eq(aviationBriefingEmailDeliveries.briefingId, briefing.id),
          eq(aviationBriefingEmailDeliveries.subscriberId, subscriber.id),
        ),
      )
      .limit(1);
    if (existing?.status === "sent" || existing?.status === "pending") {
      skipped++;
      continue;
    }
    let delivery = existing;
    if (!delivery) {
      [delivery] = await db
        .insert(aviationBriefingEmailDeliveries)
        .values({
          briefingId: briefing.id,
          subscriberId: subscriber.id,
          status: "pending",
        })
        .onConflictDoNothing()
        .returning();
      if (!delivery) {
        skipped++;
        continue;
      }
    } else
      await db
        .update(aviationBriefingEmailDeliveries)
        .set({ status: "pending", errorMessage: null, updatedAt: new Date() })
        .where(eq(aviationBriefingEmailDeliveries.id, delivery.id));
    try {
      const message = articleEmail(briefing, subscriber, options.req);
      const result: any = await client.emails.send({
        from: fromEmail,
        to: subscriber.email,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: {
          "List-Unsubscribe": `<${getApiBaseUrl(options.req)}/api/aviation-briefings/subscriptions/unsubscribe/${subscriber.unsubscribeToken}>`,
        },
      });
      await db
        .update(aviationBriefingEmailDeliveries)
        .set({
          status: "sent",
          providerMessageId:
            String(result?.id || result?.data?.id || "") || null,
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(aviationBriefingEmailDeliveries.id, delivery.id));
      sent++;
    } catch (error) {
      await db
        .update(aviationBriefingEmailDeliveries)
        .set({
          status: "failed",
          errorMessage: String(
            error instanceof Error ? error.message : "Delivery failed",
          ).slice(0, 1000),
          updatedAt: new Date(),
        })
        .where(eq(aviationBriefingEmailDeliveries.id, delivery.id));
      failed++;
    }
  }
  return { sent, failed, skipped };
}

let scheduledAnnouncementTimer: NodeJS.Timeout | null = null;
async function sendDueScheduledAnnouncements() {
  const due = await db.select({ id: aviationBriefings.id }).from(aviationBriefings).where(and(eq(aviationBriefings.status, "scheduled"), lte(aviationBriefings.scheduledAt, new Date())));
  for (const briefing of due) {
    await db.update(aviationBriefings).set({ status: "published", publishedAt: new Date(), updatedAt: new Date() }).where(and(eq(aviationBriefings.id, briefing.id), eq(aviationBriefings.status, "scheduled")));
    await sendAviationBriefingAnnouncement(briefing.id);
  }
}

export function registerAviationBriefingSubscriptionRoutes(app: Express) {
  if (!scheduledAnnouncementTimer) {
    void sendDueScheduledAnnouncements().catch(() => {});
    scheduledAnnouncementTimer = setInterval(() => void sendDueScheduledAnnouncements().catch(() => {}), 5 * 60_000);
    scheduledAnnouncementTimer.unref?.();
  }
  app.post(
    "/api/aviation-briefings/subscriptions",
    subscribeLimit,
    async (req: any, res, next) => {
      try {
        const parsed = z
          .object({
            email: z.string().trim().email().max(320),
            name: z.string().trim().max(200).default(""),
            source: z.string().trim().max(200).default("aviation-briefings"),
            company: z.string().max(0).default(""),
          })
          .safeParse(req.body);
        if (!parsed.success)
          return res
            .status(400)
            .json({ error: "Enter a valid email address." });
        const email = parsed.data.email.toLowerCase(),
          confirmToken = token(),
          unsubscribeToken = token();
        const [existing] = await db
          .select()
          .from(aviationBriefingSubscribers)
          .where(eq(aviationBriefingSubscribers.email, email))
          .limit(1);
        if (existing?.status === "active") return res.json({ received: true });
        const values = {
          name: parsed.data.name || null,
          status: "pending",
          confirmationTokenHash: hash(confirmToken),
          unsubscribeToken: existing?.unsubscribeToken || unsubscribeToken,
          unsubscribedAt: null,
          source: parsed.data.source,
          sourceIp: sourceIp(req),
          userAgent:
            String(req.headers["user-agent"] || "").slice(0, 1000) || null,
          updatedAt: new Date(),
        };
        const [subscriber] = existing
          ? await db
              .update(aviationBriefingSubscribers)
              .set(values)
              .where(eq(aviationBriefingSubscribers.id, existing.id))
              .returning()
          : await db
              .insert(aviationBriefingSubscribers)
              .values({ email, ...values })
              .returning();
        const confirmUrl = `${getApiBaseUrl(req)}/api/aviation-briefings/subscriptions/confirm/${confirmToken}`;
        const { client, fromEmail } = await getUncachableResendClient();
        await client.emails.send({
          from: fromEmail,
          to: subscriber.email,
          subject: "Confirm your Aviation Briefings subscription",
          html: `<div style="max-width:620px;margin:auto;font-family:Arial,sans-serif"><h1>Confirm Aviation Briefings updates</h1><p>Confirm that you would like an email when Ready Set Fly publishes a new Aviation Briefing.</p><p><a href="${confirmUrl}" style="display:inline-block;background:#2d73d5;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Confirm subscription</a></p><p>If you did not request this, no action is needed.</p></div>`,
          text: `Confirm your Aviation Briefings subscription: ${confirmUrl}`,
        });
        res.status(202).json({ received: true });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/aviation-briefings/subscriptions/confirm/:token",
    async (req, res, next) => {
      try {
        const [row] = await db
          .update(aviationBriefingSubscribers)
          .set({
            status: "active",
            confirmedAt: new Date(),
            confirmationTokenHash: null,
            updatedAt: new Date(),
          })
          .where(
            eq(
              aviationBriefingSubscribers.confirmationTokenHash,
              hash(req.params.token),
            ),
          )
          .returning();
        const target = `${getFrontendBaseUrl(req)}/aviation-briefings?subscription=${row ? "confirmed" : "invalid"}`;
        res.redirect(302, target);
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/aviation-briefings/subscriptions/unsubscribe/:token",
    async (req, res, next) => {
      try {
        const [row] = await db
          .update(aviationBriefingSubscribers)
          .set({
            status: "unsubscribed",
            unsubscribedAt: new Date(),
            confirmationTokenHash: null,
            updatedAt: new Date(),
          })
          .where(
            eq(aviationBriefingSubscribers.unsubscribeToken, req.params.token),
          )
          .returning();
        res.redirect(
          302,
          `${getFrontendBaseUrl(req)}/aviation-briefings?subscription=${row ? "unsubscribed" : "invalid"}`,
        );
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/admin/aviation-briefings/subscribers",
    isAuthenticated,
    isSuperAdmin,
    async (_req, res, next) => {
      try {
        const subscribers = await db
          .select()
          .from(aviationBriefingSubscribers)
          .orderBy(desc(aviationBriefingSubscribers.createdAt));
        const deliveries = await db.execute(
          sql`SELECT "briefing_id" AS "briefingId","status",count(*)::int AS "count",max("sent_at") AS "lastSentAt" FROM "aviation_briefing_email_deliveries" GROUP BY 1,2 ORDER BY max("created_at") DESC`,
        );
        res.json({ subscribers, deliveries: deliveries.rows || [] });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/admin/aviation-briefings/:id/send-announcement",
    isAuthenticated,
    isSuperAdmin,
    async (req, res, next) => {
      try {
        res.json(
          await sendAviationBriefingAnnouncement(req.params.id, {
            req,
            forceRetry: true,
          }),
        );
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/admin/aviation-briefings/:id/test-announcement",
    isAuthenticated,
    isSuperAdmin,
    async (req, res, next) => {
      try {
        const parsed = z
          .object({ email: z.string().email() })
          .safeParse(req.body);
        if (!parsed.success)
          return res.status(400).json({ error: "Enter a test email." });
        const [briefing] = await db
          .select()
          .from(aviationBriefings)
          .where(eq(aviationBriefings.id, req.params.id))
          .limit(1);
        if (!briefing)
          return res.status(404).json({ error: "Briefing not found" });
        const message = articleEmail(
          briefing,
          { unsubscribeToken: "test-preview" },
          req,
        );
        const { client, fromEmail } = await getUncachableResendClient();
        await client.emails.send({
          from: fromEmail,
          to: parsed.data.email,
          subject: `[TEST] ${message.subject}`,
          html: message.html,
          text: message.text,
        });
        res.json({ sent: true });
      } catch (e) {
        next(e);
      }
    },
  );
}
