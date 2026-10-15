import crypto from "crypto";
import bcrypt from "bcrypt";
import type { RequestHandler } from "express";
import { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { getUncachableResendClient } from "../resendClient";
import { HOTEL_OPS_MODULES, HOTEL_OPS_ROLES } from "../hotelOperationsPolicy";
import {
  canTransitionSupportStatus,
  effectiveSupportPresence,
} from "../hotelOperationsSupportPolicy";
import { createSoftAuthRateLimiter } from "../middleware/rateLimit";
import {
  hotelOpsAccounts,
  hotelOpsAuditEvents,
  hotelOpsHotelMemberships,
  hotelOpsHotels,
  hotelOpsInvitations,
  hotelOpsModulePermissions,
  hotelOpsOrganizationMemberships,
  hotelOpsOrganizations,
  hotelOpsSupportAssignments,
  hotelOpsSupportConversations,
  hotelOpsSupportMessages,
  hotelOpsSupportNotifications,
  hotelOpsSupportSettings,
  hotelOpsSupportSpecialists,
  hotelOpsSupportInvitations,
  hotelOpsPasswordResets,
  hotelOpsSessions,
  hotelOpsSalesInquiries,
} from "@shared/schema";

type Dependencies = {
  requirePortalSession: RequestHandler;
  requireCsrf: RequestHandler;
  audit: (input: any) => Promise<void>;
  publicBaseUrl: () => string;
  sendPortalEmail: (
    to: string,
    subject: string,
    text: string,
    link: string,
  ) => Promise<{ provider: "brevo"; messageId: string | null }>;
  createSession: (res: any, accountId: string) => Promise<void>;
};
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const hashToken = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");
const randomToken = () => crypto.randomBytes(32).toString("base64url");
const cleanSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
const isPlatformOwner = (context: any) =>
  context.organizations.some((item: any) => item.role === "platform_owner");
const ownOrg = (context: any, id: string) =>
  context.organizations.some((item: any) => item.organizationId === id);
const ownsHotel = (context: any, id: string, organizationId: string) =>
  isPlatformOwner(context) ||
  context.organizations.some(
    (item: any) =>
      item.organizationId === organizationId &&
      item.role === "above_property_admin",
  ) ||
  context.hotelMemberships.some((item: any) => item.hotelId === id);
const reference = (type: string) =>
  `${type === "live_chat" ? "CHAT" : "TKT"}-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
const messageSchema = z.object({ body: z.string().trim().min(1).max(8000) });

function portalEmailFailureCode(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("Missing BREVO_API_KEY")) return "email_provider_not_configured";
  const status = message.match(/Brevo error\s+(\d{3})/i)?.[1];
  if (status) return `email_provider_http_${status}`;
  return "email_provider_request_failed";
}

async function specialist(context: any) {
  if (isPlatformOwner(context)) return { platformOwner: true };
  const rows = await db
    .select()
    .from(hotelOpsSupportSpecialists)
    .where(
      and(
        eq(hotelOpsSupportSpecialists.accountId, context.account.id),
        eq(hotelOpsSupportSpecialists.enabled, true),
      ),
    )
    .limit(1);
  return rows[0] || null;
}

async function settings() {
  const rows = await db
    .select()
    .from(hotelOpsSupportSettings)
    .where(eq(hotelOpsSupportSettings.id, "platform"))
    .limit(1);
  return (
    rows[0] || {
      liveChatEnabled: true,
      ticketsEnabled: true,
      escalationEmailsEnabled: true,
      firstResponseSeconds: 120,
      secondaryEscalationEnabled: false,
      secondaryEscalationSeconds: 600,
      availabilityMessage: "Our support team will respond as soon as possible.",
    }
  );
}

export function registerHotelOperationsPhase2Routes(
  router: any,
  deps: Dependencies,
) {
  const {
    requirePortalSession,
    requireCsrf,
    audit,
    publicBaseUrl,
    sendPortalEmail,
    createSession,
  } = deps;
  const supportLimiter = createSoftAuthRateLimiter({
    key: "hotel-operations-support",
    windowMs: 60_000,
    anonMax: 10,
    authMax: 90,
  });
  const publicSalesLimiter = createSoftAuthRateLimiter({
    key: "hotel-operations-public-sales",
    windowMs: 15 * 60_000,
    anonMax: 5,
    authMax: 10,
  });
  const owner: RequestHandler = (req: any, res, next) =>
    isPlatformOwner(req.hotelOps)
      ? next()
      : res.status(403).json({ error: "platform_owner_required" });
  const agent: RequestHandler = async (req: any, res, next) =>
    (await specialist(req.hotelOps))
      ? next()
      : res.status(403).json({ error: "support_specialist_required" });
  const supportAdmin: RequestHandler = async (req: any, res, next) =>
    isPlatformOwner(req.hotelOps) ||
    req.hotelOps.supportRole === "support_administrator"
      ? next()
      : res.status(403).json({ error: "support_administrator_required" });

  router.post(
    "/public/sales-inquiries",
    publicSalesLimiter,
    async (req: any, res: any, next: any) => {
      try {
        const input = z
          .object({
            fullName: z.string().trim().min(2).max(120),
            email: z.string().trim().email().max(320),
            companyName: z.string().trim().min(2).max(200),
            propertyCount: z.number().int().min(1).max(10_000).nullable().optional(),
            message: z.string().trim().min(10).max(4000),
            website: z.string().max(200).optional(),
          })
          .parse(req.body);

        // Honeypot submissions receive the same response without being stored.
        if (input.website)
          return res.status(201).json({ ok: true, received: true });

        await db
          .delete(hotelOpsSalesInquiries)
          .where(
            lt(hotelOpsSalesInquiries.retentionExpiresAt, new Date()),
          );
        const now = new Date();
        const reference = `SALES-${now.toISOString().slice(2, 10).replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
        const [inquiry] = await db
          .insert(hotelOpsSalesInquiries)
          .values({
            reference,
            fullName: input.fullName,
            email: normalizeEmail(input.email),
            companyName: input.companyName,
            propertyCount: input.propertyCount || null,
            message: input.message,
          })
          .returning();

        const salesRecipient = normalizeEmail(
          String(process.env.HOTEL_OPS_SALES_EMAIL || ""),
        );
        if (z.string().email().safeParse(salesRecipient).success) {
          try {
            await sendPortalEmail(
              salesRecipient,
              `New INNTRIX sales inquiry ${reference}`,
              "A new public sales inquiry is ready for authorized review in the Hotel Operations administration portal.",
              `${publicBaseUrl()}/hoteloperations/admin/support`,
            );
            await db
              .update(hotelOpsSalesInquiries)
              .set({ salesNotifiedAt: new Date(), updatedAt: new Date() })
              .where(eq(hotelOpsSalesInquiries.id, inquiry.id));
          } catch {
            // The durable inquiry remains available when notification delivery fails.
          }
        }
        try {
          await sendPortalEmail(
            inquiry.email,
            `We received your INNTRIX inquiry (${reference})`,
            "Thank you for contacting INNTRIX. Your inquiry has been received, and our team will follow up using the business email you provided.",
            `${publicBaseUrl()}/hoteloperations`,
          );
          await db
            .update(hotelOpsSalesInquiries)
            .set({ confirmationSentAt: new Date(), updatedAt: new Date() })
            .where(eq(hotelOpsSalesInquiries.id, inquiry.id));
        } catch {
          // On-page confirmation remains available if email delivery fails.
        }
        res.status(201).json({ ok: true, received: true, reference });
      } catch (error) {
        if (error instanceof z.ZodError)
          return res.status(400).json({ error: "invalid_sales_inquiry" });
        next(error);
      }
    },
  );

  router.get(
    "/support-invitations/:token",
    supportLimiter,
    async (req: any, res: any) => {
      const row = (
        await db
          .select()
          .from(hotelOpsSupportInvitations)
          .where(
            and(
              eq(
                hotelOpsSupportInvitations.tokenHash,
                hashToken(req.params.token),
              ),
              isNull(hotelOpsSupportInvitations.acceptedAt),
              isNull(hotelOpsSupportInvitations.revokedAt),
              gt(hotelOpsSupportInvitations.expiresAt, new Date()),
            ),
          )
          .limit(1)
      )[0];
      if (!row)
        return res.status(404).json({ error: "invitation_invalid_or_expired" });
      const existing = (
        await db
          .select({ id: hotelOpsAccounts.id })
          .from(hotelOpsAccounts)
          .where(eq(hotelOpsAccounts.email, row.email))
          .limit(1)
      )[0];
      res.json({
        email: row.email,
        role: row.supportRole,
        existingAccount: Boolean(existing),
        expiresAt: row.expiresAt,
      });
    },
  );
  router.post(
    "/support-invitations/:token/accept",
    supportLimiter,
    async (req: any, res: any, next: any) => {
      try {
        const input = z
          .object({
            displayName: z.string().trim().min(2).max(120),
            password: z.string().min(12).max(200),
            passwordConfirmation: z.string().min(12).max(200),
          })
          .refine((x) => x.password === x.passwordConfirmation)
          .parse(req.body);
        const invitation = (
          await db
            .select()
            .from(hotelOpsSupportInvitations)
            .where(
              and(
                eq(
                  hotelOpsSupportInvitations.tokenHash,
                  hashToken(req.params.token),
                ),
                isNull(hotelOpsSupportInvitations.acceptedAt),
                isNull(hotelOpsSupportInvitations.revokedAt),
                gt(hotelOpsSupportInvitations.expiresAt, new Date()),
              ),
            )
            .limit(1)
        )[0];
        if (!invitation)
          return res
            .status(404)
            .json({ error: "invitation_invalid_or_expired" });
        const account = await db.transaction(async (tx) => {
          const [claimed] = await tx
            .update(hotelOpsSupportInvitations)
            .set({ acceptedAt: new Date() })
            .where(
              and(
                eq(hotelOpsSupportInvitations.id, invitation.id),
                isNull(hotelOpsSupportInvitations.acceptedAt),
                isNull(hotelOpsSupportInvitations.revokedAt),
              ),
            )
            .returning();
          if (!claimed)
            throw Object.assign(new Error("invitation_already_used"), {
              status: 409,
            });
          let account = (
            await tx
              .select()
              .from(hotelOpsAccounts)
              .where(eq(hotelOpsAccounts.email, invitation.email))
              .limit(1)
          )[0];
          if (account) {
            if (!(await bcrypt.compare(input.password, account.passwordHash)))
              throw Object.assign(
                new Error("existing_account_password_invalid"),
                { status: 401 },
              );
          } else {
            [account] = await tx
              .insert(hotelOpsAccounts)
              .values({
                email: invitation.email,
                displayName: input.displayName,
                passwordHash: await bcrypt.hash(input.password, 12),
              })
              .returning();
          }
          await tx
            .insert(hotelOpsSupportSpecialists)
            .values({
              accountId: account.id,
              supportRole: invitation.supportRole,
              enabled: true,
            })
            .onConflictDoUpdate({
              target: hotelOpsSupportSpecialists.accountId,
              set: {
                supportRole: invitation.supportRole,
                enabled: true,
                updatedAt: new Date(),
              },
            });
          await tx
            .update(hotelOpsSupportInvitations)
            .set({ acceptedByAccountId: account.id })
            .where(eq(hotelOpsSupportInvitations.id, invitation.id));
          await tx
            .insert(hotelOpsAuditEvents)
            .values({
              actorAccountId: account.id,
              action: "support_invitation_accepted",
              targetType: "account",
              targetId: account.id,
              metadata: { supportRole: invitation.supportRole },
            });
          return account;
        });
        await createSession(res, account.id);
        res.json({ ok: true, returnTo: "/hoteloperations/admin/support" });
      } catch (e: any) {
        if (e instanceof z.ZodError)
          return res.status(400).json({ error: "invalid_acceptance" });
        if (e?.status) return res.status(e.status).json({ error: e.message });
        next(e);
      }
    },
  );

  router.get(
    "/admin/overview",
    requirePortalSession,
    owner,
    async (_req: any, res: any) => {
      const [
        organizations,
        hotels,
        accounts,
        invitations,
        conversations,
        activity,
      ] = await Promise.all([
        db.select().from(hotelOpsOrganizations),
        db.select().from(hotelOpsHotels),
        db.select().from(hotelOpsAccounts),
        db
          .select()
          .from(hotelOpsInvitations)
          .where(
            and(
              isNull(hotelOpsInvitations.acceptedAt),
              isNull(hotelOpsInvitations.revokedAt),
              gt(hotelOpsInvitations.expiresAt, new Date()),
            ),
          ),
        db.select().from(hotelOpsSupportConversations),
        db
          .select()
          .from(hotelOpsAuditEvents)
          .orderBy(desc(hotelOpsAuditEvents.createdAt))
          .limit(12),
      ]);
      res.json({
        metrics: {
          organizations: organizations.length,
          hotels: hotels.length,
          activeUsers: accounts.filter((x) => x.status === "active").length,
          pendingInvitations: invitations.length,
          activeSupport: conversations.filter((x) => x.status !== "resolved")
            .length,
          unansweredChats: conversations.filter(
            (x) =>
              x.type === "live_chat" &&
              !x.firstHumanResponseAt &&
              x.status !== "resolved",
          ).length,
          openTickets: conversations.filter(
            (x) => x.type === "ticket" && x.status !== "resolved",
          ).length,
        },
        activity,
        health: {
          database: "operational",
          emailConfigured: Boolean(process.env.BREVO_API_KEY),
          supportWorkerEnabled:
            process.env.HOTEL_OPS_SUPPORT_WORKER_DISABLED !== "true",
        },
      });
    },
  );

  router.get(
    "/admin/organizations",
    requirePortalSession,
    owner,
    async (_req: any, res: any) => {
      const organizations = await db
        .select()
        .from(hotelOpsOrganizations)
        .orderBy(asc(hotelOpsOrganizations.name));
      const hotels = await db.select().from(hotelOpsHotels);
      const memberships = await db
        .select()
        .from(hotelOpsOrganizationMemberships);
      res.json({
        organizations: organizations.map((org) => ({
          ...org,
          hotelCount: hotels.filter((h) => h.organizationId === org.id).length,
          administratorCount: memberships.filter(
            (m) =>
              m.organizationId === org.id &&
              m.role === "above_property_admin" &&
              m.status === "active",
          ).length,
        })),
      });
    },
  );
  router.post(
    "/admin/organizations",
    requirePortalSession,
    owner,
    requireCsrf,
    async (req: any, res: any, next: any) => {
      try {
        const input = z
          .object({
            name: z.string().trim().min(2).max(160),
            profile: z.record(z.unknown()).optional(),
          })
          .parse(req.body);
        const organization = await db.transaction(async (tx) => {
          const [created] = await tx
            .insert(hotelOpsOrganizations)
            .values({
              name: input.name,
              slug: `${cleanSlug(input.name)}-${crypto.randomBytes(3).toString("hex")}`,
              profile: input.profile || {},
            })
            .returning();
          await tx.insert(hotelOpsOrganizationMemberships).values({
            organizationId: created.id,
            accountId: req.hotelOps.account.id,
            role: "platform_owner",
          });
          return created;
        });
        await audit({
          organizationId: organization.id,
          actorAccountId: req.hotelOps.account.id,
          action: "organization_created",
          targetType: "organization",
          targetId: organization.id,
        });
        res.status(201).json({ organization });
      } catch (e) {
        if (e instanceof z.ZodError)
          return res
            .status(400)
            .json({ error: "invalid_organization", issues: e.issues });
        next(e);
      }
    },
  );
  router.patch(
    "/admin/organizations/:id",
    requirePortalSession,
    owner,
    requireCsrf,
    async (req: any, res: any, next: any) => {
      try {
        const input = z
          .object({
            name: z.string().trim().min(2).max(160).optional(),
            status: z.enum(["active", "inactive"]).optional(),
            profile: z.record(z.unknown()).optional(),
          })
          .parse(req.body);
        const [organization] = await db
          .update(hotelOpsOrganizations)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(hotelOpsOrganizations.id, req.params.id))
          .returning();
        if (!organization)
          return res.status(404).json({ error: "organization_not_found" });
        await audit({
          organizationId: organization.id,
          actorAccountId: req.hotelOps.account.id,
          action: "organization_updated",
          targetType: "organization",
          targetId: organization.id,
          metadata: { changedFields: Object.keys(input) },
        });
        res.json({ organization });
      } catch (e) {
        if (e instanceof z.ZodError)
          return res.status(400).json({ error: "invalid_organization" });
        next(e);
      }
    },
  );

  router.get(
    "/admin/hotels",
    requirePortalSession,
    owner,
    async (_req: any, res: any) => {
      res.json({
        hotels: await db
          .select({
            hotel: hotelOpsHotels,
            organization: hotelOpsOrganizations,
          })
          .from(hotelOpsHotels)
          .innerJoin(
            hotelOpsOrganizations,
            eq(hotelOpsOrganizations.id, hotelOpsHotels.organizationId),
          )
          .orderBy(asc(hotelOpsHotels.name)),
      });
    },
  );
  router.get(
    "/admin/users",
    requirePortalSession,
    owner,
    async (_req: any, res: any) => {
      const users = await db
        .select()
        .from(hotelOpsAccounts)
        .orderBy(asc(hotelOpsAccounts.displayName));
      const orgs = await db.select().from(hotelOpsOrganizationMemberships);
      const hotels = await db.select().from(hotelOpsHotelMemberships);
      const specialists = await db.select().from(hotelOpsSupportSpecialists);
      res.json({
        users: users.map((user) => ({
          ...user,
          passwordHash: undefined,
          organizations: orgs.filter((x) => x.accountId === user.id),
          hotels: hotels.filter((x) => x.accountId === user.id),
          specialist: specialists.find((x) => x.accountId === user.id) || null,
        })),
      });
    },
  );
  router.patch(
    "/admin/users/:id/status",
    requirePortalSession,
    owner,
    requireCsrf,
    async (req: any, res: any) => {
      if (req.params.id === req.hotelOps.account.id)
        return res.status(400).json({ error: "cannot_change_own_status" });
      const input = z
        .object({ status: z.enum(["active", "inactive"]) })
        .parse(req.body);
      const [account] = await db
        .update(hotelOpsAccounts)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(hotelOpsAccounts.id, req.params.id))
        .returning();
      if (!account) return res.status(404).json({ error: "user_not_found" });
      await audit({
        actorAccountId: req.hotelOps.account.id,
        action: "account_status_updated",
        targetType: "account",
        targetId: account.id,
        metadata: { status: input.status },
      });
      res.json({ ok: true });
    },
  );
  router.get(
    "/admin/invitations",
    requirePortalSession,
    owner,
    async (_req: any, res: any) =>
      res.json({
        invitations: await db
          .select({
            invitation: hotelOpsInvitations,
            organization: hotelOpsOrganizations,
            hotel: hotelOpsHotels,
          })
          .from(hotelOpsInvitations)
          .innerJoin(
            hotelOpsOrganizations,
            eq(hotelOpsOrganizations.id, hotelOpsInvitations.organizationId),
          )
          .leftJoin(
            hotelOpsHotels,
            eq(hotelOpsHotels.id, hotelOpsInvitations.hotelId),
          )
          .orderBy(desc(hotelOpsInvitations.createdAt)),
      }),
  );
  router.post(
    "/admin/invitations",
    requirePortalSession,
    owner,
    requireCsrf,
    async (req: any, res: any, next: any) => {
      try {
        const input = z
          .object({
            organizationId: z.string().uuid(),
            hotelId: z.string().uuid().nullable().optional(),
            email: z.string().email(),
            role: z.enum(HOTEL_OPS_ROLES).refine((v) => v !== "platform_owner"),
            moduleKeys: z.array(z.enum(HOTEL_OPS_MODULES)).default([]),
          })
          .parse(req.body);
        const org = (
          await db
            .select()
            .from(hotelOpsOrganizations)
            .where(eq(hotelOpsOrganizations.id, input.organizationId))
            .limit(1)
        )[0];
        if (!org)
          return res.status(404).json({ error: "organization_not_found" });
        if (!input.hotelId)
          return res.status(400).json({ error: "hotel_required_for_role" });
        if (input.hotelId) {
          const hotel = (
            await db
              .select()
              .from(hotelOpsHotels)
              .where(
                and(
                  eq(hotelOpsHotels.id, input.hotelId),
                  eq(hotelOpsHotels.organizationId, org.id),
                ),
              )
              .limit(1)
          )[0];
          if (!hotel)
            return res
              .status(400)
              .json({ error: "hotel_organization_mismatch" });
        }
        const token = randomToken(),
          expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
        const [invitation] = await db
          .insert(hotelOpsInvitations)
          .values({
            organizationId: org.id,
            hotelId: input.hotelId || null,
            email: normalizeEmail(input.email),
            role: input.role,
            moduleKeys: input.moduleKeys,
            tokenHash: hashToken(token),
            expiresAt,
            invitedByAccountId: req.hotelOps.account.id,
          })
          .returning();
        const link = `${publicBaseUrl()}/hoteloperations/invite/${encodeURIComponent(token)}`;
        let emailAccepted = false;
        let providerMessageId: string | null = null;
        try {
          const acceptance = await sendPortalEmail(
            input.email,
            "You're invited to INNTRIX",
            `You have been invited to join ${org.name} in INNTRIX. This secure invitation expires in 72 hours.`,
            link,
          );
          emailAccepted = true;
          providerMessageId = acceptance.messageId;
          console.info(
            JSON.stringify({
              event: "hotel_ops_invitation_email_accepted",
              invitationId: invitation.id,
              provider: acceptance.provider,
              providerMessageId,
            }),
          );
        } catch (emailError) {
          console.error(
            JSON.stringify({
              event: "hotel_ops_invitation_email_failed",
              invitationId: invitation.id,
              stage: "provider_send",
              code: portalEmailFailureCode(emailError),
            }),
          );
        }
        await audit({
          organizationId: org.id,
          hotelId: input.hotelId,
          actorAccountId: req.hotelOps.account.id,
          action: "invitation_created",
          targetType: "invitation",
          targetId: invitation.id,
          metadata: {
            role: input.role,
            delivered: emailAccepted,
            emailStatus: emailAccepted ? "accepted" : "failed",
            providerMessageId,
          },
        });
        res
          .status(201)
          .json({
            invitation: {
              ...invitation,
              tokenHash: undefined,
              delivered: emailAccepted,
              emailStatus: emailAccepted ? "accepted" : "failed",
              providerMessageId,
            },
          });
      } catch (e) {
        if (e instanceof z.ZodError)
          return res
            .status(400)
            .json({ error: "invalid_invitation", issues: e.issues });
        next(e);
      }
    },
  );
  router.post(
    "/admin/invitations/:id/revoke",
    requirePortalSession,
    owner,
    requireCsrf,
    async (req: any, res: any) => {
      const [invitation] = await db
        .update(hotelOpsInvitations)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(hotelOpsInvitations.id, req.params.id),
            isNull(hotelOpsInvitations.acceptedAt),
          ),
        )
        .returning();
      if (!invitation)
        return res.status(404).json({ error: "invitation_not_found" });
      await audit({
        organizationId: invitation.organizationId,
        hotelId: invitation.hotelId,
        actorAccountId: req.hotelOps.account.id,
        action: "invitation_revoked",
        targetType: "invitation",
        targetId: invitation.id,
      });
      res.json({ ok: true });
    },
  );
  router.post(
    "/admin/invitations/:id/resend",
    requirePortalSession,
    owner,
    requireCsrf,
    async (req: any, res: any) => {
      const existing = (
        await db
          .select({
            invitation: hotelOpsInvitations,
            organization: hotelOpsOrganizations,
          })
          .from(hotelOpsInvitations)
          .innerJoin(
            hotelOpsOrganizations,
            eq(hotelOpsOrganizations.id, hotelOpsInvitations.organizationId),
          )
          .where(
            and(
              eq(hotelOpsInvitations.id, req.params.id),
              isNull(hotelOpsInvitations.acceptedAt),
            ),
          )
          .limit(1)
      )[0];
      if (!existing)
        return res.status(404).json({ error: "invitation_not_found" });
      const token = randomToken(),
        expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
      await db
        .update(hotelOpsInvitations)
        .set({ tokenHash: hashToken(token), expiresAt, revokedAt: null })
        .where(eq(hotelOpsInvitations.id, existing.invitation.id));
      const link = `${publicBaseUrl()}/hoteloperations/invite/${encodeURIComponent(token)}`;
      let emailAccepted = false;
      let providerMessageId: string | null = null;
      try {
        const acceptance = await sendPortalEmail(
          existing.invitation.email,
          "Your renewed INNTRIX invitation",
          `Your invitation to ${existing.organization.name} in INNTRIX has been renewed and expires in 72 hours.`,
          link,
        );
        emailAccepted = true;
        providerMessageId = acceptance.messageId;
        console.info(
          JSON.stringify({
            event: "hotel_ops_invitation_resend_email_accepted",
            invitationId: existing.invitation.id,
            provider: acceptance.provider,
            providerMessageId,
          }),
        );
      } catch (emailError) {
        console.error(
          JSON.stringify({
            event: "hotel_ops_invitation_resend_email_failed",
            invitationId: existing.invitation.id,
            stage: "provider_send",
            code: portalEmailFailureCode(emailError),
          }),
        );
      }
      await audit({
        organizationId: existing.invitation.organizationId,
        hotelId: existing.invitation.hotelId,
        actorAccountId: req.hotelOps.account.id,
        action: "invitation_resent",
        targetType: "invitation",
        targetId: existing.invitation.id,
        metadata: {
          delivered: emailAccepted,
          emailStatus: emailAccepted ? "accepted" : "failed",
          providerMessageId,
        },
      });
      res.json({
        ok: true,
        delivered: emailAccepted,
        emailStatus: emailAccepted ? "accepted" : "failed",
        providerMessageId,
        expiresAt,
      });
    },
  );

  router.get(
    "/support/status",
    requirePortalSession,
    async (_req: any, res: any) => {
      const config = await settings();
      const rows = await db
        .select()
        .from(hotelOpsSupportSpecialists)
        .where(eq(hotelOpsSupportSpecialists.enabled, true));
      const presence = rows.map((x) => effectiveSupportPresence(x));
      res.json({
        liveChatEnabled: config.liveChatEnabled,
        ticketsEnabled: config.ticketsEnabled,
        availability: presence.includes("online")
          ? "available"
          : presence.includes("away")
            ? "busy"
            : "offline",
        availabilityMessage: config.availabilityMessage,
      });
    },
  );
  router.get(
    "/support/conversations",
    requirePortalSession,
    async (req: any, res: any) => {
      const conversations = await db
        .select()
        .from(hotelOpsSupportConversations)
        .where(
          eq(
            hotelOpsSupportConversations.requesterAccountId,
            req.hotelOps.account.id,
          ),
        )
        .orderBy(desc(hotelOpsSupportConversations.lastActivityAt));
      res.json({ conversations });
    },
  );
  router.post(
    "/support/conversations",
    supportLimiter,
    requirePortalSession,
    requireCsrf,
    async (req: any, res: any, next: any) => {
      try {
        const input = z
          .object({
            type: z.enum(["live_chat", "ticket"]),
            organizationId: z.string().uuid(),
            hotelId: z.string().uuid().nullable().optional(),
            subject: z.string().trim().min(3).max(180).optional(),
            category: z
              .enum([
                "General Question",
                "Technical Issue",
                "Account Access",
                "Hotel Onboarding",
                "Reporting / Data Import",
                "Feature Request",
                "Other",
              ])
              .optional(),
            message: z.string().trim().min(1).max(8000),
          })
          .parse(req.body);
        if (!ownOrg(req.hotelOps, input.organizationId))
          return res.status(403).json({ error: "organization_access_denied" });
        if (input.hotelId) {
          const hotel = (
            await db
              .select()
              .from(hotelOpsHotels)
              .where(
                and(
                  eq(hotelOpsHotels.id, input.hotelId),
                  eq(hotelOpsHotels.organizationId, input.organizationId),
                ),
              )
              .limit(1)
          )[0];
          if (
            !hotel ||
            !ownsHotel(req.hotelOps, input.hotelId, input.organizationId)
          )
            return res.status(403).json({ error: "hotel_access_denied" });
        }
        const config = await settings();
        if (
          (input.type === "live_chat" && !config.liveChatEnabled) ||
          (input.type === "ticket" && !config.ticketsEnabled)
        )
          return res.status(409).json({ error: "support_channel_disabled" });
        const now = new Date(),
          deadline =
            input.type === "live_chat"
              ? new Date(now.getTime() + config.firstResponseSeconds * 1000)
              : null;
        const conversation = await db.transaction(async (tx) => {
          const [created] = await tx
            .insert(hotelOpsSupportConversations)
            .values({
              reference: reference(input.type),
              organizationId: input.organizationId,
              hotelId: input.hotelId || null,
              requesterAccountId: req.hotelOps.account.id,
              type: input.type,
              subject:
                input.subject ||
                (input.type === "live_chat" ? "Live support" : null),
              category: input.category || null,
              firstResponseDeadlineAt: deadline,
              supportUnreadCount: 1,
            })
            .returning();
          await tx
            .insert(hotelOpsSupportMessages)
            .values({
              conversationId: created.id,
              senderAccountId: req.hotelOps.account.id,
              senderType: "requester",
              body: input.message,
            });
          if (deadline) {
            await tx
              .insert(hotelOpsSupportNotifications)
              .values({
                conversationId: created.id,
                kind: "first_response",
                dueAt: deadline,
                nextAttemptAt: deadline,
              });
            if (config.secondaryEscalationEnabled) {
              const secondaryDue = new Date(
                now.getTime() + config.secondaryEscalationSeconds * 1000,
              );
              await tx
                .insert(hotelOpsSupportNotifications)
                .values({
                  conversationId: created.id,
                  kind: "secondary_response",
                  dueAt: secondaryDue,
                  nextAttemptAt: secondaryDue,
                });
            }
          }
          return created;
        });
        await audit({
          organizationId: input.organizationId,
          hotelId: input.hotelId,
          actorAccountId: req.hotelOps.account.id,
          action: "support_conversation_created",
          targetType: "support_conversation",
          targetId: conversation.id,
          metadata: { type: input.type, reference: conversation.reference },
        });
        if (input.type === "ticket") {
          try {
            const recipients = await db
              .select({ email: hotelOpsAccounts.email })
              .from(hotelOpsSupportSpecialists)
              .innerJoin(
                hotelOpsAccounts,
                eq(hotelOpsAccounts.id, hotelOpsSupportSpecialists.accountId),
              )
              .where(
                and(
                  eq(hotelOpsSupportSpecialists.enabled, true),
                  eq(hotelOpsSupportSpecialists.emailNotifications, true),
                ),
              );
            if (recipients.length) {
              const { client, fromEmail } = await getUncachableResendClient();
              await client.emails.send({
                from: fromEmail,
                to: Array.from(new Set(recipients.map((x) => x.email))),
                subject: `New support ticket ${conversation.reference}`,
                text: `A new Hotel Operations support ticket is available. ${publicBaseUrl()}/hoteloperations/admin/support`,
                html: `<p>A new Hotel Operations support ticket is available.</p><p><a href="${publicBaseUrl()}/hoteloperations/admin/support">Open Support Center</a></p>`,
              });
            }
          } catch {
            /* Ticket is durable even when notification delivery fails. */
          }
        }
        res.status(201).json({ conversation });
      } catch (e) {
        if (e instanceof z.ZodError)
          return res
            .status(400)
            .json({ error: "invalid_support_request", issues: e.issues });
        next(e);
      }
    },
  );

  async function loadConversation(req: any, supportAccess = false) {
    const rows = await db
      .select()
      .from(hotelOpsSupportConversations)
      .where(eq(hotelOpsSupportConversations.id, req.params.id))
      .limit(1);
    const conversation = rows[0];
    if (!conversation) return null;
    if (
      supportAccess
        ? !(await specialist(req.hotelOps))
        : conversation.requesterAccountId !== req.hotelOps.account.id
    )
      return false;
    return conversation;
  }
  router.get(
    "/support/conversations/:id",
    requirePortalSession,
    async (req: any, res: any) => {
      const conversation = await loadConversation(req);
      if (!conversation)
        return res
          .status(conversation === false ? 403 : 404)
          .json({ error: "conversation_not_found" });
      const messages = await db
        .select({ message: hotelOpsSupportMessages, sender: hotelOpsAccounts })
        .from(hotelOpsSupportMessages)
        .innerJoin(
          hotelOpsAccounts,
          eq(hotelOpsAccounts.id, hotelOpsSupportMessages.senderAccountId),
        )
        .where(eq(hotelOpsSupportMessages.conversationId, conversation.id))
        .orderBy(
          asc(hotelOpsSupportMessages.createdAt),
          asc(hotelOpsSupportMessages.id),
        );
      await db
        .update(hotelOpsSupportConversations)
        .set({ requesterUnreadCount: 0 })
        .where(eq(hotelOpsSupportConversations.id, conversation.id));
      res.json({ conversation, messages });
    },
  );
  router.post(
    "/support/conversations/:id/messages",
    supportLimiter,
    requirePortalSession,
    requireCsrf,
    async (req: any, res: any) => {
      const conversation = await loadConversation(req);
      if (!conversation)
        return res
          .status(conversation === false ? 403 : 404)
          .json({ error: "conversation_not_found" });
      if (conversation.status === "resolved")
        return res.status(409).json({ error: "conversation_resolved" });
      const input = messageSchema.parse(req.body);
      const [message] = await db
        .insert(hotelOpsSupportMessages)
        .values({
          conversationId: conversation.id,
          senderAccountId: req.hotelOps.account.id,
          senderType: "requester",
          body: input.body,
        })
        .returning();
      await db
        .update(hotelOpsSupportConversations)
        .set({
          supportUnreadCount: sql`${hotelOpsSupportConversations.supportUnreadCount} + 1`,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(hotelOpsSupportConversations.id, conversation.id));
      res.status(201).json({ message });
    },
  );
  router.post(
    "/support/conversations/:id/reopen",
    requirePortalSession,
    requireCsrf,
    async (req: any, res: any) => {
      const conversation = await loadConversation(req);
      if (!conversation)
        return res
          .status(conversation === false ? 403 : 404)
          .json({ error: "conversation_not_found" });
      if (conversation.status !== "resolved")
        return res.status(409).json({ error: "conversation_not_resolved" });
      await db
        .update(hotelOpsSupportConversations)
        .set({
          status: "active",
          resolvedAt: null,
          updatedAt: new Date(),
          lastActivityAt: new Date(),
        })
        .where(eq(hotelOpsSupportConversations.id, conversation.id));
      res.json({ ok: true });
    },
  );

  router.get(
    "/admin/support",
    requirePortalSession,
    agent,
    async (_req: any, res: any) => {
      const conversations = await db
        .select({
          conversation: hotelOpsSupportConversations,
          requester: hotelOpsAccounts,
          organization: hotelOpsOrganizations,
          hotel: hotelOpsHotels,
        })
        .from(hotelOpsSupportConversations)
        .innerJoin(
          hotelOpsAccounts,
          eq(
            hotelOpsAccounts.id,
            hotelOpsSupportConversations.requesterAccountId,
          ),
        )
        .innerJoin(
          hotelOpsOrganizations,
          eq(
            hotelOpsOrganizations.id,
            hotelOpsSupportConversations.organizationId,
          ),
        )
        .leftJoin(
          hotelOpsHotels,
          eq(hotelOpsHotels.id, hotelOpsSupportConversations.hotelId),
        )
        .orderBy(desc(hotelOpsSupportConversations.lastActivityAt));
      const resolved = conversations.filter(
        (x) => x.conversation.status === "resolved",
      );
      const responded = conversations.filter(
        (x) => x.conversation.firstHumanResponseAt,
      );
      const avg = responded.length
        ? Math.round(
            responded.reduce(
              (sum, x) =>
                sum +
                (x.conversation.firstHumanResponseAt!.getTime() -
                  x.conversation.createdAt.getTime()),
              0,
            ) /
              responded.length /
              1000,
          )
        : null;
      res.json({
        conversations,
        metrics: {
          waiting: conversations.filter(
            (x) => x.conversation.status === "waiting",
          ).length,
          active: conversations.filter(
            (x) => x.conversation.status === "active",
          ).length,
          unanswered: conversations.filter(
            (x) =>
              x.conversation.type === "live_chat" &&
              !x.conversation.firstHumanResponseAt &&
              x.conversation.status !== "resolved",
          ).length,
          escalated: conversations.filter((x) => x.conversation.escalatedAt)
            .length,
          openTickets: conversations.filter(
            (x) =>
              x.conversation.type === "ticket" &&
              x.conversation.status !== "resolved",
          ).length,
          averageFirstResponseSeconds: avg,
          resolved: resolved.length,
        },
      });
    },
  );
  router.get(
    "/admin/support/:id",
    requirePortalSession,
    agent,
    async (req: any, res: any) => {
      const conversation = await loadConversation(req, true);
      if (!conversation)
        return res
          .status(conversation === false ? 403 : 404)
          .json({ error: "conversation_not_found" });
      const messages = await db
        .select({ message: hotelOpsSupportMessages, sender: hotelOpsAccounts })
        .from(hotelOpsSupportMessages)
        .innerJoin(
          hotelOpsAccounts,
          eq(hotelOpsAccounts.id, hotelOpsSupportMessages.senderAccountId),
        )
        .where(eq(hotelOpsSupportMessages.conversationId, conversation.id))
        .orderBy(
          asc(hotelOpsSupportMessages.createdAt),
          asc(hotelOpsSupportMessages.id),
        );
      await db
        .update(hotelOpsSupportConversations)
        .set({ supportUnreadCount: 0 })
        .where(eq(hotelOpsSupportConversations.id, conversation.id));
      res.json({ conversation, messages });
    },
  );
  router.post(
    "/admin/support/:id/messages",
    supportLimiter,
    requirePortalSession,
    agent,
    requireCsrf,
    async (req: any, res: any) => {
      const conversation = await loadConversation(req, true);
      if (!conversation)
        return res
          .status(conversation === false ? 403 : 404)
          .json({ error: "conversation_not_found" });
      const input = messageSchema.parse(req.body),
        now = new Date();
      const [message] = await db.transaction(async (tx) => {
        const rows = await tx
          .insert(hotelOpsSupportMessages)
          .values({
            conversationId: conversation.id,
            senderAccountId: req.hotelOps.account.id,
            senderType: "support",
            body: input.body,
          })
          .returning();
        await tx
          .update(hotelOpsSupportConversations)
          .set({
            status: "active",
            firstHumanResponseAt: conversation.firstHumanResponseAt || now,
            requesterUnreadCount: sql`${hotelOpsSupportConversations.requesterUnreadCount} + 1`,
            lastActivityAt: now,
            updatedAt: now,
          })
          .where(eq(hotelOpsSupportConversations.id, conversation.id));
        if (!conversation.firstHumanResponseAt)
          await tx
            .update(hotelOpsSupportNotifications)
            .set({ status: "suppressed", leaseExpiresAt: null, updatedAt: now })
            .where(
              and(
                eq(
                  hotelOpsSupportNotifications.conversationId,
                  conversation.id,
                ),
                inArray(hotelOpsSupportNotifications.status, [
                  "queued",
                  "retry",
                ]),
              ),
            );
        return rows;
      });
      try {
        const requester = (
          await db
            .select()
            .from(hotelOpsAccounts)
            .where(eq(hotelOpsAccounts.id, conversation.requesterAccountId))
            .limit(1)
        )[0];
        if (requester)
          await sendPortalEmail(
            requester.email,
            `Support replied to ${conversation.reference}`,
            "A support specialist replied to your request. Sign in to view the message securely.",
            `${publicBaseUrl()}/hoteloperations/dashboard`,
          );
      } catch {
        /* The persisted reply remains available in the portal. */
      }
      res.status(201).json({ message });
    },
  );
  router.patch(
    "/admin/support/:id",
    requirePortalSession,
    agent,
    requireCsrf,
    async (req: any, res: any) => {
      const conversation = await loadConversation(req, true);
      if (!conversation)
        return res
          .status(conversation === false ? 403 : 404)
          .json({ error: "conversation_not_found" });
      const input = z
        .object({
          status: z
            .enum(["waiting", "active", "pending", "resolved"])
            .optional(),
          assignedSpecialistAccountId: z.string().uuid().nullable().optional(),
        })
        .parse(req.body);
      if (
        input.status &&
        input.status !== conversation.status &&
        !canTransitionSupportStatus(conversation.status, input.status)
      )
        return res.status(409).json({ error: "invalid_status_transition" });
      if (input.assignedSpecialistAccountId) {
        const target = await db
          .select()
          .from(hotelOpsSupportSpecialists)
          .where(
            and(
              eq(
                hotelOpsSupportSpecialists.accountId,
                input.assignedSpecialistAccountId,
              ),
              eq(hotelOpsSupportSpecialists.enabled, true),
            ),
          )
          .limit(1);
        if (!target[0])
          return res.status(400).json({ error: "invalid_specialist" });
      }
      await db.transaction(async (tx) => {
        await tx
          .update(hotelOpsSupportConversations)
          .set({
            status: input.status || conversation.status,
            assignedSpecialistAccountId:
              input.assignedSpecialistAccountId === undefined
                ? conversation.assignedSpecialistAccountId
                : input.assignedSpecialistAccountId,
            resolvedAt:
              input.status === "resolved"
                ? new Date()
                : input.status
                  ? null
                  : conversation.resolvedAt,
            updatedAt: new Date(),
          })
          .where(eq(hotelOpsSupportConversations.id, conversation.id));
        if (input.assignedSpecialistAccountId !== undefined)
          await tx
            .insert(hotelOpsSupportAssignments)
            .values({
              conversationId: conversation.id,
              specialistAccountId: input.assignedSpecialistAccountId,
              assignedByAccountId: req.hotelOps.account.id,
              action: input.assignedSpecialistAccountId
                ? "assigned"
                : "unassigned",
            });
      });
      await audit({
        organizationId: conversation.organizationId,
        hotelId: conversation.hotelId,
        actorAccountId: req.hotelOps.account.id,
        action: "support_conversation_updated",
        targetType: "support_conversation",
        targetId: conversation.id,
        metadata: {
          status: input.status,
          assignmentChanged: input.assignedSpecialistAccountId !== undefined,
        },
      });
      res.json({ ok: true });
    },
  );

  router.post(
    "/admin/support/heartbeat",
    requirePortalSession,
    agent,
    requireCsrf,
    async (req: any, res: any) => {
      const input = z
        .object({
          status: z.enum(["online", "away", "offline"]).default("online"),
        })
        .parse(req.body);
      if (isPlatformOwner(req.hotelOps))
        await db
          .insert(hotelOpsSupportSpecialists)
          .values({
            accountId: req.hotelOps.account.id,
            presenceStatus: input.status,
            lastHeartbeatAt: new Date(),
          })
          .onConflictDoUpdate({
            target: hotelOpsSupportSpecialists.accountId,
            set: {
              enabled: true,
              presenceStatus: input.status,
              lastHeartbeatAt: new Date(),
              updatedAt: new Date(),
            },
          });
      else
        await db
          .update(hotelOpsSupportSpecialists)
          .set({
            presenceStatus: input.status,
            lastHeartbeatAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            eq(hotelOpsSupportSpecialists.accountId, req.hotelOps.account.id),
          );
      res.json({ ok: true });
    },
  );
  router.get(
    "/admin/sales-inquiries",
    requirePortalSession,
    supportAdmin,
    async (_req: any, res: any) => {
      await db
        .delete(hotelOpsSalesInquiries)
        .where(lt(hotelOpsSalesInquiries.retentionExpiresAt, new Date()));
      const inquiries = await db
        .select()
        .from(hotelOpsSalesInquiries)
        .orderBy(desc(hotelOpsSalesInquiries.createdAt));
      res.json({
        inquiries,
        salesRecipientConfigured: z
          .string()
          .email()
          .safeParse(normalizeEmail(String(process.env.HOTEL_OPS_SALES_EMAIL || "")))
          .success,
      });
    },
  );
  router.patch(
    "/admin/sales-inquiries/:id",
    requirePortalSession,
    supportAdmin,
    requireCsrf,
    async (req: any, res: any) => {
      const input = z
        .object({
          status: z.enum(["new", "contacted", "qualified", "closed"]).optional(),
          internalNotes: z.string().trim().max(4000).nullable().optional(),
        })
        .refine(
          (value) => value.status !== undefined || value.internalNotes !== undefined,
        )
        .parse(req.body);
      const [updated] = await db
        .update(hotelOpsSalesInquiries)
        .set({
          ...input,
          closedAt: input.status === "closed" ? new Date() : input.status ? null : undefined,
          updatedAt: new Date(),
        })
        .where(eq(hotelOpsSalesInquiries.id, req.params.id))
        .returning();
      if (!updated)
        return res.status(404).json({ error: "sales_inquiry_not_found" });
      await audit({
        actorAccountId: req.hotelOps.account.id,
        action: "sales_inquiry_updated",
        targetType: "sales_inquiry",
        targetId: updated.id,
        metadata: {
          statusChanged: input.status !== undefined,
          notesChanged: input.internalNotes !== undefined,
        },
      });
      res.json({ inquiry: updated });
    },
  );
  router.get(
    "/admin/support-specialists",
    requirePortalSession,
    supportAdmin,
    async (_req: any, res: any) => {
      const rows = await db
        .select({
          specialist: hotelOpsSupportSpecialists,
          account: hotelOpsAccounts,
        })
        .from(hotelOpsSupportSpecialists)
        .innerJoin(
          hotelOpsAccounts,
          eq(hotelOpsAccounts.id, hotelOpsSupportSpecialists.accountId),
        )
        .orderBy(asc(hotelOpsAccounts.displayName));
      const invitations = await db
        .select()
        .from(hotelOpsSupportInvitations)
        .where(
          and(
            isNull(hotelOpsSupportInvitations.acceptedAt),
            isNull(hotelOpsSupportInvitations.revokedAt),
            gt(hotelOpsSupportInvitations.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(hotelOpsSupportInvitations.createdAt));
      res.json({
        specialists: rows.map((x) => ({
          ...x,
          effectivePresence: effectiveSupportPresence(x.specialist),
        })),
        invitations,
      });
    },
  );
  router.post(
    "/admin/support-invitations",
    requirePortalSession,
    supportAdmin,
    requireCsrf,
    async (req: any, res: any) => {
      const input = z
        .object({
          email: z.string().email(),
          supportRole: z.enum(["support_specialist", "support_administrator"]),
        })
        .parse(req.body);
      const email = normalizeEmail(input.email);
      const duplicate = (
        await db
          .select()
          .from(hotelOpsSupportInvitations)
          .where(
            and(
              eq(hotelOpsSupportInvitations.email, email),
              isNull(hotelOpsSupportInvitations.acceptedAt),
              isNull(hotelOpsSupportInvitations.revokedAt),
              gt(hotelOpsSupportInvitations.expiresAt, new Date()),
            ),
          )
          .limit(1)
      )[0];
      if (duplicate)
        return res.status(409).json({ error: "active_invitation_exists" });
      await db
        .update(hotelOpsSupportInvitations)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(hotelOpsSupportInvitations.email, email),
            isNull(hotelOpsSupportInvitations.acceptedAt),
            isNull(hotelOpsSupportInvitations.revokedAt),
          ),
        );
      const token = randomToken(),
        expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const [invitation] = await db
        .insert(hotelOpsSupportInvitations)
        .values({
          email,
          supportRole: input.supportRole,
          tokenHash: hashToken(token),
          expiresAt,
          invitedByAccountId: req.hotelOps.account.id,
        })
        .returning();
      const link = `${publicBaseUrl()}/hoteloperations/support-invite/${encodeURIComponent(token)}`;
      let delivered = true;
      try {
        await sendPortalEmail(
          email,
          "Your Hotel Operations support invitation",
          `You have been invited as ${input.supportRole === "support_administrator" ? "Support Administrator" : "Support Specialist"}. This secure invitation expires in 72 hours.`,
          link,
        );
      } catch {
        delivered = false;
      }
      await audit({
        actorAccountId: req.hotelOps.account.id,
        action: "support_invitation_created",
        targetType: "support_invitation",
        targetId: invitation.id,
        metadata: { supportRole: input.supportRole, delivered },
      });
      res
        .status(201)
        .json({
          invitation: {
            id: invitation.id,
            email,
            supportRole: input.supportRole,
            expiresAt,
            delivered,
          },
        });
    },
  );
  router.post(
    "/admin/support-invitations/:id/:action",
    requirePortalSession,
    supportAdmin,
    requireCsrf,
    async (req: any, res: any) => {
      const action = z.enum(["revoke", "resend"]).parse(req.params.action);
      const invitation = (
        await db
          .select()
          .from(hotelOpsSupportInvitations)
          .where(
            and(
              eq(hotelOpsSupportInvitations.id, req.params.id),
              isNull(hotelOpsSupportInvitations.acceptedAt),
            ),
          )
          .limit(1)
      )[0];
      if (!invitation)
        return res.status(404).json({ error: "invitation_not_found" });
      if (action === "revoke") {
        await db
          .update(hotelOpsSupportInvitations)
          .set({ revokedAt: new Date() })
          .where(eq(hotelOpsSupportInvitations.id, invitation.id));
      } else {
        const token = randomToken(),
          expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
        await db
          .update(hotelOpsSupportInvitations)
          .set({ tokenHash: hashToken(token), expiresAt, revokedAt: null })
          .where(eq(hotelOpsSupportInvitations.id, invitation.id));
        await sendPortalEmail(
          invitation.email,
          "Your Hotel Operations support invitation",
          "Your secure support invitation has been renewed and expires in 72 hours.",
          `${publicBaseUrl()}/hoteloperations/support-invite/${encodeURIComponent(token)}`,
        );
      }
      await audit({
        actorAccountId: req.hotelOps.account.id,
        action: `support_invitation_${action}d`,
        targetType: "support_invitation",
        targetId: invitation.id,
      });
      res.json({ ok: true });
    },
  );
  router.put(
    "/admin/support-specialists/:accountId",
    requirePortalSession,
    supportAdmin,
    requireCsrf,
    async (req: any, res: any) => {
      const input = z
        .object({
          enabled: z.boolean(),
          supportRole: z
            .enum(["support_specialist", "support_administrator"])
            .default("support_specialist"),
          emailNotifications: z.boolean().default(true),
          escalationRecipient: z.boolean().default(true),
        })
        .parse(req.body);
      if (
        !(
          await db
            .select()
            .from(hotelOpsAccounts)
            .where(eq(hotelOpsAccounts.id, req.params.accountId))
            .limit(1)
        )[0]
      )
        return res.status(404).json({ error: "user_not_found" });
      await db
        .insert(hotelOpsSupportSpecialists)
        .values({ accountId: req.params.accountId, ...input })
        .onConflictDoUpdate({
          target: hotelOpsSupportSpecialists.accountId,
          set: {
            ...input,
            presenceStatus: "offline",
            lastHeartbeatAt: null,
            updatedAt: new Date(),
          },
        });
      if (!input.enabled)
        await db
          .update(hotelOpsSessions)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(hotelOpsSessions.accountId, req.params.accountId),
              isNull(hotelOpsSessions.revokedAt),
            ),
          );
      await audit({
        actorAccountId: req.hotelOps.account.id,
        action: "support_specialist_updated",
        targetType: "account",
        targetId: req.params.accountId,
        metadata: input,
      });
      res.json({ ok: true });
    },
  );
  router.post(
    "/admin/users/:id/password-reset",
    supportLimiter,
    requirePortalSession,
    supportAdmin,
    requireCsrf,
    async (req: any, res: any) => {
      const account = (
        await db
          .select()
          .from(hotelOpsAccounts)
          .where(eq(hotelOpsAccounts.id, req.params.id))
          .limit(1)
      )[0];
      if (account) {
        const token = randomToken();
        await db
          .insert(hotelOpsPasswordResets)
          .values({
            accountId: account.id,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          });
        await sendPortalEmail(
          account.email,
          "Reset your Hotel Operations password",
          "A support administrator initiated this secure, single-use password reset. The link expires in one hour.",
          `${publicBaseUrl()}/hoteloperations/reset/${encodeURIComponent(token)}`,
        );
        await audit({
          actorAccountId: req.hotelOps.account.id,
          action: "support_password_reset_initiated",
          targetType: "account",
          targetId: account.id,
        });
      }
      res.json({ ok: true });
    },
  );
  router.get(
    "/admin/support-settings",
    requirePortalSession,
    owner,
    async (_req: any, res: any) =>
      res.json({
        settings: await settings(),
        emailOperational: Boolean(process.env.BREVO_API_KEY),
      }),
  );
  router.patch(
    "/admin/support-settings",
    requirePortalSession,
    owner,
    requireCsrf,
    async (req: any, res: any) => {
      const input = z
        .object({
          liveChatEnabled: z.boolean().optional(),
          ticketsEnabled: z.boolean().optional(),
          escalationEmailsEnabled: z.boolean().optional(),
          firstResponseSeconds: z.number().int().min(30).max(3600).optional(),
          secondaryEscalationEnabled: z.boolean().optional(),
          secondaryEscalationSeconds: z
            .number()
            .int()
            .min(120)
            .max(86400)
            .optional(),
          availabilityMessage: z.string().trim().min(1).max(500).optional(),
        })
        .parse(req.body);
      const [updated] = await db
        .insert(hotelOpsSupportSettings)
        .values({
          id: "platform",
          ...input,
          updatedByAccountId: req.hotelOps.account.id,
        })
        .onConflictDoUpdate({
          target: hotelOpsSupportSettings.id,
          set: {
            ...input,
            updatedByAccountId: req.hotelOps.account.id,
            updatedAt: new Date(),
          },
        })
        .returning();
      await audit({
        actorAccountId: req.hotelOps.account.id,
        action: "support_settings_updated",
        targetType: "support_settings",
        targetId: "platform",
        metadata: { changedFields: Object.keys(input) },
      });
      res.json({ settings: updated });
    },
  );
}
