import crypto from "crypto";
import bcrypt from "bcrypt";
import type { Express, RequestHandler } from "express";
import { Router } from "express";
import { and, asc, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { createSoftAuthRateLimiter } from "../middleware/rateLimit";
import { getUncachableResendClient } from "../resendClient";
import {
  hotelOpsAccounts,
  hotelOpsAuditEvents,
  hotelOpsHotelMemberships,
  hotelOpsHotels,
  hotelOpsInvitations,
  hotelOpsModulePermissions,
  hotelOpsOrganizationMemberships,
  hotelOpsOrganizations,
  hotelOpsPasswordResets,
  hotelOpsReportingConfigurations,
  hotelOpsSessions,
  hotelOpsSupportSpecialists,
} from "@shared/schema";
import {
  HOTEL_OPS_MODULES,
  HOTEL_OPS_ROLES,
  canAccessHotelOpsProperty,
  canInviteHotelOpsRole,
  safeHotelOpsReturnPath,
  type HotelOpsRole,
} from "../hotelOperationsPolicy";
import { registerHotelOperationsPhase2Routes } from "./hotelOperationsPhase2";
import { startHotelOpsSupportNotificationWorker } from "../services/hotelOperationsSupportWorker";

const SESSION_COOKIE = "hotel_ops_session";
const CSRF_COOKIE = "hotel_ops_csrf";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

const hashToken = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");
const randomToken = () => crypto.randomBytes(32).toString("base64url");
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizePropertyCode = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);

function parseCookies(header: string | undefined): Record<string, string> {
  return Object.fromEntries(
    (header || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index < 0) return [part, ""];
        return [
          decodeURIComponent(part.slice(0, index)),
          decodeURIComponent(part.slice(index + 1)),
        ];
      }),
  );
}

function cookieOptions(httpOnly: boolean) {
  const production = process.env.NODE_ENV === "production";
  return {
    httpOnly,
    secure: production,
    sameSite: production ? ("none" as const) : ("lax" as const),
    domain: production ? "readysetfly.us" : undefined,
    path: "/",
    maxAge: SESSION_TTL_MS,
  };
}

function timingSafeEqualText(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

type HotelOpsContext = {
  account: typeof hotelOpsAccounts.$inferSelect;
  organizations: Array<
    typeof hotelOpsOrganizationMemberships.$inferSelect & {
      organization: typeof hotelOpsOrganizations.$inferSelect;
    }
  >;
  hotelMemberships: Array<typeof hotelOpsHotelMemberships.$inferSelect>;
  session: typeof hotelOpsSessions.$inferSelect;
  supportRole: string | null;
};

async function audit(input: {
  organizationId?: string | null;
  hotelId?: string | null;
  actorAccountId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(hotelOpsAuditEvents).values({
    organizationId: input.organizationId || null,
    hotelId: input.hotelId || null,
    actorAccountId: input.actorAccountId || null,
    action: input.action,
    targetType: input.targetType || null,
    targetId: input.targetId || null,
    metadata: input.metadata || {},
  });
}

async function createSession(res: any, accountId: string) {
  const token = randomToken();
  const csrf = randomToken();
  await db.insert(hotelOpsSessions).values({
    accountId,
    tokenHash: hashToken(token),
    csrfTokenHash: hashToken(csrf),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  res.cookie(SESSION_COOKIE, token, cookieOptions(true));
  res.cookie(CSRF_COOKIE, csrf, cookieOptions(false));
}

const requirePortalSession: RequestHandler = async (req: any, res, next) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const raw = cookies[SESSION_COOKIE];
    if (!raw) return res.status(401).json({ error: "portal_auth_required" });
    const rows = await db
      .select()
      .from(hotelOpsSessions)
      .where(
        and(
          eq(hotelOpsSessions.tokenHash, hashToken(raw)),
          isNull(hotelOpsSessions.revokedAt),
          gt(hotelOpsSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);
    const portalSession = rows[0];
    if (!portalSession)
      return res.status(401).json({ error: "portal_session_expired" });
    const accounts = await db
      .select()
      .from(hotelOpsAccounts)
      .where(
        and(
          eq(hotelOpsAccounts.id, portalSession.accountId),
          eq(hotelOpsAccounts.status, "active"),
        ),
      )
      .limit(1);
    if (!accounts[0])
      return res.status(401).json({ error: "portal_account_inactive" });
    const memberships = await db
      .select({
        membership: hotelOpsOrganizationMemberships,
        organization: hotelOpsOrganizations,
      })
      .from(hotelOpsOrganizationMemberships)
      .innerJoin(
        hotelOpsOrganizations,
        eq(
          hotelOpsOrganizations.id,
          hotelOpsOrganizationMemberships.organizationId,
        ),
      )
      .where(
        and(
          eq(
            hotelOpsOrganizationMemberships.accountId,
            portalSession.accountId,
          ),
          eq(hotelOpsOrganizationMemberships.status, "active"),
          eq(hotelOpsOrganizations.status, "active"),
        ),
      );
    const hotelMemberships = await db
      .select()
      .from(hotelOpsHotelMemberships)
      .where(
        and(
          eq(hotelOpsHotelMemberships.accountId, portalSession.accountId),
          eq(hotelOpsHotelMemberships.status, "active"),
        ),
      );
    const supportAccess = await db
      .select()
      .from(hotelOpsSupportSpecialists)
      .where(
        and(
          eq(hotelOpsSupportSpecialists.accountId, portalSession.accountId),
          eq(hotelOpsSupportSpecialists.enabled, true),
        ),
      )
      .limit(1);
    if (memberships.length === 0 && !supportAccess[0])
      return res.status(403).json({ error: "portal_access_revoked" });
    req.hotelOps = {
      account: accounts[0],
      organizations: memberships.map((row) => ({
        ...row.membership,
        organization: row.organization,
      })),
      hotelMemberships,
      session: portalSession,
      supportRole: supportAccess[0]?.supportRole || null,
    } satisfies HotelOpsContext;
    next();
  } catch (error) {
    next(error);
  }
};

const requireCsrf: RequestHandler = (req: any, res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  const cookie = cookies[CSRF_COOKIE] || "";
  const header = String(req.get("x-hotel-ops-csrf") || "");
  const expected = req.hotelOps?.session?.csrfTokenHash || "";
  if (
    !cookie ||
    !header ||
    !timingSafeEqualText(cookie, header) ||
    !timingSafeEqualText(hashToken(header), expected)
  ) {
    return res.status(403).json({ error: "csrf_validation_failed" });
  }
  next();
};

function primaryOrg(context: HotelOpsContext) {
  return (
    context.organizations.find(
      (membership) => membership.role === "platform_owner",
    ) || context.organizations[0]
  );
}

function selectedOrg(context: HotelOpsContext, organizationId: unknown) {
  const requestedId = String(organizationId || "").trim();
  if (!requestedId) return primaryOrg(context);
  return context.organizations.find(
    (membership) => membership.organizationId === requestedId,
  );
}

function canSeeAllHotels(role: string) {
  return role === "platform_owner" || role === "above_property_admin";
}

async function authorizedHotels(
  context: HotelOpsContext,
  organizationId: string,
) {
  const membership = context.organizations.find(
    (item) => item.organizationId === organizationId,
  );
  if (!membership) return [];
  const all = await db
    .select()
    .from(hotelOpsHotels)
    .where(eq(hotelOpsHotels.organizationId, organizationId))
    .orderBy(asc(hotelOpsHotels.name));
  if (canSeeAllHotels(membership.role)) return all;
  const allowedIds = context.hotelMemberships.map((item) => item.hotelId);
  return all.filter((hotel) =>
    canAccessHotelOpsProperty(membership.role, allowedIds, hotel.id),
  );
}

const bootstrapSchema = z.object({
  email: z.string().email(),
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(200),
  organizationName: z.string().trim().min(2).max(160),
  isDemo: z.boolean().optional(),
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
  returnTo: z.string().optional(),
});
const hotelBaseSchema = z.object({
  propertyCode: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(180),
  brand: z.string().trim().max(100).optional().nullable(),
  propertyType: z
    .enum(["branded", "independent", "boutique"])
    .optional()
    .nullable(),
  ownershipEntity: z.string().trim().max(180).optional().nullable(),
  managementEntity: z.string().trim().max(180).optional().nullable(),
  streetAddress: z.string().trim().max(220).optional().nullable(),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().max(24).optional().nullable(),
  country: z.string().trim().min(2).max(80).default("US"),
  phone: z.string().trim().max(40).optional().nullable(),
  timeZone: z.string().trim().min(3).max(80),
  roomCount: z.number().int().min(1).max(10000).optional().nullable(),
  activeRoomCount: z.number().int().min(0).max(10000).optional().nullable(),
  meetingRoomCount: z.number().int().min(0).max(1000).optional().nullable(),
  foodBeverageOutletCount: z
    .number()
    .int()
    .min(0)
    .max(1000)
    .optional()
    .nullable(),
  pmsProvider: z.string().trim().max(120).optional().nullable(),
  reportingPlatform: z.string().trim().max(120).optional().nullable(),
  accountingSystem: z.string().trim().max(120).optional().nullable(),
  laborSchedulingSystem: z.string().trim().max(120).optional().nullable(),
  brandReportingEcosystem: z.string().trim().max(120).optional().nullable(),
  businessDayCutoff: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
    .optional()
    .nullable(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase())
    .default("USD"),
  departments: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  enabledModules: z.array(z.enum(HOTEL_OPS_MODULES)).default([]),
  reportSourceTypes: z
    .array(z.string().trim().min(1).max(100))
    .max(30)
    .default([]),
  reportingIntegrationStatus: z
    .enum(["not_configured", "pending_samples", "in_development", "validated"])
    .default("not_configured"),
  status: z.enum(["active", "inactive"]).optional(),
});
const validateRoomCounts = (
  value: { roomCount?: number | null; activeRoomCount?: number | null },
  ctx: z.RefinementCtx,
) => {
  if (
    value.roomCount != null &&
    value.activeRoomCount != null &&
    value.activeRoomCount > value.roomCount
  )
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["activeRoomCount"],
      message: "Active room count cannot exceed total room count.",
    });
};
const hotelSchema = hotelBaseSchema.superRefine(validateRoomCounts);
const hotelUpdateSchema = hotelBaseSchema
  .partial()
  .superRefine(validateRoomCounts);
const inviteSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(HOTEL_OPS_ROLES),
  hotelId: z.string().uuid().optional().nullable(),
  moduleKeys: z.array(z.enum(HOTEL_OPS_MODULES)).default([]),
});

function publicBaseUrl() {
  return String(
    process.env.FRONTEND_BASE_URL || "https://readysetfly.us",
  ).replace(/\/$/, "");
}

type PortalEmailAcceptance = {
  provider: "brevo";
  messageId: string | null;
};

function portalEmailFailureCode(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("Missing BREVO_API_KEY")) return "email_provider_not_configured";
  const status = message.match(/Brevo error\s+(\d{3})/i)?.[1];
  if (status) return `email_provider_http_${status}`;
  return "email_provider_request_failed";
}

async function sendPortalEmail(
  to: string,
  subject: string,
  text: string,
  link: string,
): Promise<PortalEmailAcceptance> {
  const { client, fromEmail } = await getUncachableResendClient();
  const result = await client.emails.send({
    from: fromEmail,
    to,
    subject,
    text: `${text}\n\n${link}`,
    html: `<p>${text}</p><p><a href="${link}">${link}</a></p>`,
  });
  return {
    provider: "brevo",
    messageId:
      typeof result?.messageId === "string" ? result.messageId : null,
  };
}

export function registerHotelOperationsRoutes(app: Express) {
  const router = Router();
  const authLimiter = createSoftAuthRateLimiter({
    key: "hotel-operations-auth",
    windowMs: 10 * 60 * 1000,
    anonMax: 12,
    authMax: 40,
  });

  router.post("/bootstrap", authLimiter, async (req, res, next) => {
    try {
      const configuredToken = String(
        process.env.HOTEL_OPS_BOOTSTRAP_TOKEN || "",
      );
      const configuredEmail = normalizeEmail(
        String(process.env.HOTEL_OPS_BOOTSTRAP_EMAIL || ""),
      );
      const suppliedToken = String(
        req.get("x-hotel-ops-bootstrap-token") || "",
      );
      if (
        !configuredToken ||
        !configuredEmail ||
        !suppliedToken ||
        !timingSafeEqualText(suppliedToken, configuredToken)
      )
        return res.status(404).json({ error: "not_found" });
      const input = bootstrapSchema.parse(req.body);
      if (normalizeEmail(input.email) !== configuredEmail)
        return res
          .status(403)
          .json({ error: "bootstrap_identity_not_authorized" });
      const existingOwners = await db
        .select()
        .from(hotelOpsOrganizationMemberships)
        .where(eq(hotelOpsOrganizationMemberships.role, "platform_owner"))
        .limit(1);
      if (existingOwners[0])
        return res
          .status(200)
          .json({ provisioned: true, alreadyProvisioned: true });
      const passwordHash = await bcrypt.hash(input.password, 12);
      const result = await db.transaction(async (tx) => {
        const [organization] = await tx
          .insert(hotelOpsOrganizations)
          .values({
            name: input.organizationName,
            slug: `${normalizeSlug(input.organizationName)}-${crypto.randomBytes(3).toString("hex")}`,
            isDemo: Boolean(input.isDemo),
          })
          .returning();
        const [account] = await tx
          .insert(hotelOpsAccounts)
          .values({
            email: configuredEmail,
            displayName: input.displayName,
            passwordHash,
          })
          .returning();
        await tx
          .insert(hotelOpsOrganizationMemberships)
          .values({
            organizationId: organization.id,
            accountId: account.id,
            role: "platform_owner",
          });
        await tx
          .insert(hotelOpsAuditEvents)
          .values({
            organizationId: organization.id,
            actorAccountId: account.id,
            action: "platform_bootstrapped",
            targetType: "organization",
            targetId: organization.id,
            metadata: { method: "protected_environment_bootstrap" },
          });
        return { organization, account };
      });
      await createSession(res, result.account.id);
      res.status(201).json({ provisioned: true });
    } catch (error) {
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({ error: "invalid_bootstrap_request", issues: error.issues });
      next(error);
    }
  });

  router.post("/login", authLimiter, async (req, res, next) => {
    try {
      const input = loginSchema.parse(req.body);
      const rows = await db
        .select()
        .from(hotelOpsAccounts)
        .where(eq(hotelOpsAccounts.email, normalizeEmail(input.email)))
        .limit(1);
      const account = rows[0];
      const valid =
        account?.status === "active" &&
        (await bcrypt.compare(input.password, account.passwordHash));
      if (!valid) return res.status(401).json({ error: "invalid_credentials" });
      await createSession(res, account.id);
      await db
        .update(hotelOpsAccounts)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(hotelOpsAccounts.id, account.id));
      await audit({
        actorAccountId: account.id,
        action: "portal_login",
        targetType: "account",
        targetId: account.id,
      });
      res.json({ ok: true, returnTo: safeHotelOpsReturnPath(input.returnTo) });
    } catch (error) {
      if (error instanceof z.ZodError)
        return res.status(400).json({ error: "invalid_login_request" });
      next(error);
    }
  });

  router.get("/session", requirePortalSession, async (req: any, res) => {
    const context = req.hotelOps as HotelOpsContext;
    const org = primaryOrg(context);
    res.json({
      account: {
        id: context.account.id,
        email: context.account.email,
        displayName: context.account.displayName,
      },
      organizations: context.organizations.map((item) => ({
        id: item.organization.id,
        name: item.organization.name,
        role: item.role,
        isDemo: item.organization.isDemo,
      })),
      activeOrganizationId: org?.organizationId || null,
      supportRole: context.supportRole,
    });
  });

  router.post(
    "/logout",
    requirePortalSession,
    requireCsrf,
    async (req: any, res) => {
      await db
        .update(hotelOpsSessions)
        .set({ revokedAt: new Date() })
        .where(eq(hotelOpsSessions.id, req.hotelOps.session.id));
      res.clearCookie(SESSION_COOKIE, cookieOptions(true));
      res.clearCookie(CSRF_COOKIE, cookieOptions(false));
      res.json({ ok: true });
    },
  );

  router.get("/dashboard", requirePortalSession, async (req: any, res) => {
    const context = req.hotelOps as HotelOpsContext;
    const selectedOrganizationId = String(
      req.query.organizationId || primaryOrg(context)?.organizationId || "",
    );
    const membership = context.organizations.find(
      (item) => item.organizationId === selectedOrganizationId,
    );
    if (!membership)
      return res.status(403).json({ error: "organization_access_denied" });
    const hotels = await authorizedHotels(context, selectedOrganizationId);
    const rawRequestedHotelId = String(req.query.hotelId || "");
    const requestedHotelId =
      rawRequestedHotelId === "all" && !canSeeAllHotels(membership.role)
        ? hotels[0]?.id || ""
        : rawRequestedHotelId;
    if (
      requestedHotelId &&
      requestedHotelId !== "all" &&
      !hotels.some((hotel) => hotel.id === requestedHotelId)
    )
      return res.status(403).json({ error: "hotel_access_denied" });
    const permissions = await db
      .select()
      .from(hotelOpsModulePermissions)
      .where(eq(hotelOpsModulePermissions.accountId, context.account.id));
    const portfolioMemberships = hotels.length
      ? await db
          .select()
          .from(hotelOpsHotelMemberships)
          .where(
            and(
              eq(hotelOpsHotelMemberships.status, "active"),
              inArray(
                hotelOpsHotelMemberships.hotelId,
                hotels.map((hotel) => hotel.id),
              ),
            ),
          )
      : [];
    const assignedGmCount = new Set(
      portfolioMemberships
        .filter((item) => item.role === "property_admin")
        .map((item) => item.accountId),
    ).size;
    const selectedHotelMembership = context.hotelMemberships.find(
      (item) => item.hotelId === (requestedHotelId || hotels[0]?.id),
    );
    const effectiveRole = canSeeAllHotels(membership.role)
      ? membership.role
      : selectedHotelMembership?.role || membership.role;
    res.json({
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        isDemo: membership.organization.isDemo,
      },
      role: effectiveRole,
      canUseAllProperties: canSeeAllHotels(membership.role),
      selectedHotelId:
        requestedHotelId ||
        (canSeeAllHotels(membership.role) ? "all" : hotels[0]?.id || null),
      hotels,
      permissions,
      portfolio: {
        propertyCount: hotels.length,
        activePropertyCount: hotels.filter((hotel) => hotel.status === "active")
          .length,
        assignedGmCount,
        reportingReadyCount: hotels.filter(
          (hotel) => hotel.reportingIntegrationStatus === "validated",
        ).length,
        metricsAvailable: false,
        incidentSummaryAvailable: false,
      },
    });
  });

  router.post(
    "/hotels",
    requirePortalSession,
    requireCsrf,
    async (req: any, res, next) => {
      try {
        const context = req.hotelOps as HotelOpsContext;
        const org = selectedOrg(context, req.query.organizationId);
        if (!org || !canSeeAllHotels(org.role))
          return res.status(403).json({ error: "hotel_create_denied" });
        const input = hotelSchema.parse(req.body);
        const propertyCode = normalizePropertyCode(input.propertyCode);
        if (!propertyCode)
          return res.status(400).json({ error: "invalid_property_code" });
        const existing = await db
          .select()
          .from(hotelOpsHotels)
          .where(
            and(
              eq(hotelOpsHotels.organizationId, org.organizationId),
              eq(hotelOpsHotels.propertyCode, propertyCode),
            ),
          )
          .limit(1);
        if (existing[0])
          return res.status(409).json({ error: "duplicate_property_code" });
        const [hotel] = await db
          .insert(hotelOpsHotels)
          .values({
            ...input,
            propertyCode,
            organizationId: org.organizationId,
            createdByAccountId: context.account.id,
          })
          .returning();
        for (const reportType of ["operations", "revenue", "sales", "labor"])
          await db
            .insert(hotelOpsReportingConfigurations)
            .values({ hotelId: hotel.id, reportType })
            .onConflictDoNothing();
        await audit({
          organizationId: org.organizationId,
          hotelId: hotel.id,
          actorAccountId: context.account.id,
          action: "hotel_created",
          targetType: "hotel",
          targetId: hotel.id,
          metadata: { propertyCode },
        });
        res.status(201).json({ hotel });
      } catch (error) {
        if (error instanceof z.ZodError)
          return res
            .status(400)
            .json({ error: "invalid_hotel", issues: error.issues });
        next(error);
      }
    },
  );

  router.post(
    "/demo-seed",
    requirePortalSession,
    requireCsrf,
    async (req: any, res) => {
      const context = req.hotelOps as HotelOpsContext;
      const org = primaryOrg(context);
      if (
        !org ||
        org.role !== "platform_owner" ||
        !org.organization.isDemo ||
        process.env.HOTEL_OPS_DEMO_MODE !== "true"
      )
        return res.status(403).json({ error: "demo_seed_disabled" });
      const fictional = [
        {
          propertyCode: "DEMO-RBH",
          name: "Riverside Boutique Hotel",
          propertyType: "boutique",
          city: "Riverbend",
          state: "TX",
        },
        {
          propertyCode: "DEMO-NBS",
          name: "Northgate Business Suites",
          propertyType: "independent",
          city: "Northgate",
          state: "TX",
        },
        {
          propertyCode: "DEMO-LCH",
          name: "Lakeshore Conference Hotel",
          propertyType: "independent",
          city: "Lakeshore",
          state: "TX",
        },
      ];
      for (const hotel of fictional)
        await db
          .insert(hotelOpsHotels)
          .values({
            ...hotel,
            organizationId: org.organizationId,
            country: "US",
            timeZone: "America/Chicago",
            reportingIntegrationStatus: "not_configured",
            createdByAccountId: context.account.id,
          })
          .onConflictDoNothing();
      await audit({
        organizationId: org.organizationId,
        actorAccountId: context.account.id,
        action: "fictional_demo_hotels_seeded",
        targetType: "organization",
        targetId: org.organizationId,
        metadata: {
          fictional: true,
          propertyCodes: fictional.map((hotel) => hotel.propertyCode),
        },
      });
      res.json({ ok: true, fictional: true });
    },
  );

  router.patch(
    "/hotels/:id",
    requirePortalSession,
    requireCsrf,
    async (req: any, res, next) => {
      try {
        const context = req.hotelOps as HotelOpsContext;
        const org = selectedOrg(context, req.query.organizationId);
        if (!org || !canSeeAllHotels(org.role))
          return res.status(403).json({ error: "hotel_update_denied" });
        const allowed = (
          await authorizedHotels(context, org.organizationId)
        ).find((hotel) => hotel.id === req.params.id);
        if (!allowed) return res.status(404).json({ error: "hotel_not_found" });
        const input = hotelUpdateSchema.parse(req.body);
        const values: any = { ...input, updatedAt: new Date() };
        if (input.propertyCode)
          values.propertyCode = normalizePropertyCode(input.propertyCode);
        const [hotel] = await db
          .update(hotelOpsHotels)
          .set(values)
          .where(
            and(
              eq(hotelOpsHotels.id, allowed.id),
              eq(hotelOpsHotels.organizationId, org.organizationId),
            ),
          )
          .returning();
        await audit({
          organizationId: org.organizationId,
          hotelId: hotel.id,
          actorAccountId: context.account.id,
          action: "hotel_updated",
          targetType: "hotel",
          targetId: hotel.id,
          metadata: { changedFields: Object.keys(input) },
        });
        res.json({ hotel });
      } catch (error) {
        if (error instanceof z.ZodError)
          return res
            .status(400)
            .json({ error: "invalid_hotel", issues: error.issues });
        next(error);
      }
    },
  );

  router.get("/invitations/:token", authLimiter, async (req, res) => {
    const rows = await db
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
      .where(
        and(
          eq(hotelOpsInvitations.tokenHash, hashToken(req.params.token)),
          isNull(hotelOpsInvitations.acceptedAt),
          isNull(hotelOpsInvitations.revokedAt),
          gt(hotelOpsInvitations.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!rows[0])
      return res.status(404).json({ error: "invitation_invalid_or_expired" });
    const row = rows[0];
    res.json({
      email: row.invitation.email,
      role: row.invitation.role,
      organizationName: row.organization.name,
      hotelName: row.hotel?.name || null,
      expiresAt: row.invitation.expiresAt,
    });
  });

  router.post(
    "/invitations",
    requirePortalSession,
    requireCsrf,
    async (req: any, res, next) => {
      try {
        const context = req.hotelOps as HotelOpsContext;
        const input = inviteSchema.parse(req.body);
        const org = selectedOrg(context, input.organizationId);
        const actorHotelRole = input.hotelId
          ? context.hotelMemberships.find(
              (item) => item.hotelId === input.hotelId,
            )?.role
          : null;
        const actorRole = canSeeAllHotels(org?.role || "")
          ? org!.role
          : actorHotelRole || org?.role;
        if (
          !org ||
          !actorRole ||
          !canInviteHotelOpsRole(actorRole as HotelOpsRole, input.role)
        )
          return res.status(403).json({ error: "role_escalation_denied" });
        if (
          [
            "above_property_admin",
            "property_admin",
            "property_manager",
            "property_employee",
          ].includes(input.role) &&
          !input.hotelId
        )
          return res.status(400).json({ error: "hotel_required_for_role" });
        const selectedHotel = input.hotelId
          ? (await authorizedHotels(context, org.organizationId)).find(
              (hotel) => hotel.id === input.hotelId,
            )
          : null;
        if (input.hotelId && !selectedHotel)
          return res.status(403).json({ error: "hotel_access_denied" });
        const token = randomToken();
        const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
        const [invitation] = await db
          .insert(hotelOpsInvitations)
          .values({
            organizationId: org.organizationId,
            hotelId: input.hotelId || null,
            email: normalizeEmail(input.email),
            role: input.role,
            moduleKeys: input.moduleKeys,
            tokenHash: hashToken(token),
            expiresAt,
            invitedByAccountId: context.account.id,
          })
          .returning();
        const link = `${publicBaseUrl()}/hoteloperations/invite/${encodeURIComponent(token)}`;
        let emailAccepted = false;
        let providerMessageId: string | null = null;
        try {
          const acceptance = await sendPortalEmail(
            input.email,
            "You're invited to INNTRIX",
            `You have been invited to join ${org.organization.name} in INNTRIX${selectedHotel ? `, with ${selectedHotel.name} as your initial property context` : ""}. This secure invitation expires in 72 hours.`,
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
          organizationId: org.organizationId,
          hotelId: input.hotelId,
          actorAccountId: context.account.id,
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
        const demoLink =
          org.organization.isDemo && process.env.HOTEL_OPS_DEMO_MODE === "true"
            ? link
            : undefined;
        res
          .status(201)
          .json({
            invitation: {
              id: invitation.id,
              email: invitation.email,
              role: invitation.role,
              expiresAt,
              delivered: emailAccepted,
              emailStatus: emailAccepted ? "accepted" : "failed",
              providerMessageId,
            },
            demoLink,
          });
      } catch (error) {
        if (error instanceof z.ZodError)
          return res
            .status(400)
            .json({ error: "invalid_invitation", issues: error.issues });
        next(error);
      }
    },
  );

  router.get("/team", requirePortalSession, async (req: any, res) => {
    const context = req.hotelOps as HotelOpsContext;
    const org = selectedOrg(context, req.query.organizationId);
    if (!org)
      return res.status(403).json({ error: "organization_access_denied" });
    const mayManageTeam =
      canSeeAllHotels(org.role) ||
      context.hotelMemberships.some(
        (item) =>
          item.role === "property_admin" || item.role === "property_manager",
      );
    if (!mayManageTeam)
      return res.status(403).json({ error: "team_access_denied" });
    const hotels = await authorizedHotels(context, org.organizationId);
    const hotelIds = new Set(hotels.map((hotel) => hotel.id));
    const memberships = await db
      .select({
        membership: hotelOpsHotelMemberships,
        account: hotelOpsAccounts,
        hotel: hotelOpsHotels,
      })
      .from(hotelOpsHotelMemberships)
      .innerJoin(
        hotelOpsAccounts,
        eq(hotelOpsAccounts.id, hotelOpsHotelMemberships.accountId),
      )
      .innerJoin(
        hotelOpsHotels,
        eq(hotelOpsHotels.id, hotelOpsHotelMemberships.hotelId),
      );
    const organizationMembers = await db
      .select({
        membership: hotelOpsOrganizationMemberships,
        account: hotelOpsAccounts,
      })
      .from(hotelOpsOrganizationMemberships)
      .innerJoin(
        hotelOpsAccounts,
        eq(hotelOpsAccounts.id, hotelOpsOrganizationMemberships.accountId),
      )
      .where(
        and(
          eq(
            hotelOpsOrganizationMemberships.organizationId,
            org.organizationId,
          ),
          eq(hotelOpsOrganizationMemberships.status, "active"),
        ),
      );
    const permissions = hotels.length
      ? await db
          .select()
          .from(hotelOpsModulePermissions)
          .where(
            inArray(
              hotelOpsModulePermissions.hotelId,
              hotels.map((hotel) => hotel.id),
            ),
          )
      : [];
    const invitations = await db
      .select()
      .from(hotelOpsInvitations)
      .where(
        and(
          eq(hotelOpsInvitations.organizationId, org.organizationId),
          isNull(hotelOpsInvitations.acceptedAt),
          isNull(hotelOpsInvitations.revokedAt),
          gt(hotelOpsInvitations.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(hotelOpsInvitations.createdAt));
    res.json({
      portfolioMembers: organizationMembers
        .filter(
          (row) =>
            row.membership.role === "platform_owner" ||
            row.membership.role === "above_property_admin",
        )
        .map((row) => ({
          id: row.account.id,
          displayName: row.account.displayName,
          email: row.account.email,
          role: row.membership.role,
        })),
      members: memberships
        .filter((row) => hotelIds.has(row.membership.hotelId))
        .map((row) => ({
          id: row.account.id,
          displayName: row.account.displayName,
          email: row.account.email,
          hotelId: row.hotel.id,
          hotelName: row.hotel.name,
          role: row.membership.role,
          status: row.membership.status,
          moduleKeys: permissions
            .filter(
              (permission) =>
                permission.accountId === row.account.id &&
                permission.hotelId === row.hotel.id &&
                permission.canView,
            )
            .map((permission) => permission.moduleKey),
        })),
      invitations: invitations
        .filter((invite) => !invite.hotelId || hotelIds.has(invite.hotelId))
        .map((invite) => ({
          id: invite.id,
          email: invite.email,
          role: invite.role,
          hotelId: invite.hotelId,
          expiresAt: invite.expiresAt,
        })),
    });
  });

  router.post(
    "/invitations/:id/revoke",
    requirePortalSession,
    requireCsrf,
    async (req: any, res) => {
      const context = req.hotelOps as HotelOpsContext;
      const org = selectedOrg(context, req.query.organizationId);
      if (!org)
        return res.status(403).json({ error: "organization_access_denied" });
      const rows = await db
        .select()
        .from(hotelOpsInvitations)
        .where(
          and(
            eq(hotelOpsInvitations.id, req.params.id),
            eq(hotelOpsInvitations.organizationId, org.organizationId),
            isNull(hotelOpsInvitations.acceptedAt),
            isNull(hotelOpsInvitations.revokedAt),
          ),
        )
        .limit(1);
      const invitation = rows[0];
      if (!invitation)
        return res.status(404).json({ error: "pending_invitation_not_found" });
      const actorHotelRole = invitation.hotelId
        ? context.hotelMemberships.find(
            (item) => item.hotelId === invitation.hotelId,
          )?.role
        : null;
      const actorRole = canSeeAllHotels(org.role)
        ? org.role
        : actorHotelRole || org.role;
      if (
        !canInviteHotelOpsRole(
          actorRole as HotelOpsRole,
          invitation.role as HotelOpsRole,
        )
      )
        return res.status(403).json({ error: "invitation_revoke_denied" });
      await db
        .update(hotelOpsInvitations)
        .set({ revokedAt: new Date() })
        .where(eq(hotelOpsInvitations.id, invitation.id));
      await audit({
        organizationId: org.organizationId,
        hotelId: invitation.hotelId,
        actorAccountId: context.account.id,
        action: "invitation_revoked",
        targetType: "invitation",
        targetId: invitation.id,
      });
      res.json({ ok: true });
    },
  );

  router.patch(
    "/team/:accountId/access",
    requirePortalSession,
    requireCsrf,
    async (req: any, res, next) => {
      try {
        const context = req.hotelOps as HotelOpsContext;
        const input = z
          .object({
            organizationId: z.string().uuid(),
            hotelId: z.string().uuid(),
            role: z.enum([
              "property_admin",
              "property_manager",
              "property_employee",
            ]),
            moduleKeys: z.array(z.enum(HOTEL_OPS_MODULES)),
            status: z.enum(["active", "inactive"]).default("active"),
          })
          .parse(req.body);
        const org = selectedOrg(context, input.organizationId);
        if (
          !org ||
          !(await authorizedHotels(context, org.organizationId)).some(
            (hotel) => hotel.id === input.hotelId,
          )
        )
          return res.status(403).json({ error: "hotel_access_denied" });
        const actorRole = canSeeAllHotels(org.role)
          ? org.role
          : context.hotelMemberships.find(
              (item) => item.hotelId === input.hotelId,
            )?.role || org.role;
        if (!canInviteHotelOpsRole(actorRole as HotelOpsRole, input.role))
          return res.status(403).json({ error: "access_management_denied" });
        const target = await db
          .select()
          .from(hotelOpsHotelMemberships)
          .where(
            and(
              eq(hotelOpsHotelMemberships.hotelId, input.hotelId),
              eq(hotelOpsHotelMemberships.accountId, req.params.accountId),
            ),
          )
          .limit(1);
        if (!target[0])
          return res.status(404).json({ error: "hotel_membership_not_found" });
        await db.transaction(async (tx) => {
          await tx
            .update(hotelOpsHotelMemberships)
            .set({
              role: input.role,
              status: input.status,
              updatedAt: new Date(),
            })
            .where(eq(hotelOpsHotelMemberships.id, target[0].id));
          await tx
            .delete(hotelOpsModulePermissions)
            .where(
              and(
                eq(hotelOpsModulePermissions.accountId, req.params.accountId),
                eq(hotelOpsModulePermissions.hotelId, input.hotelId),
              ),
            );
          if (input.status === "active")
            for (const moduleKey of input.moduleKeys)
              await tx
                .insert(hotelOpsModulePermissions)
                .values({
                  accountId: req.params.accountId,
                  hotelId: input.hotelId,
                  moduleKey,
                  canView: true,
                  canManage: input.role !== "property_employee",
                });
        });
        await audit({
          organizationId: org.organizationId,
          hotelId: input.hotelId,
          actorAccountId: context.account.id,
          action: "hotel_access_updated",
          targetType: "account",
          targetId: req.params.accountId,
          metadata: {
            role: input.role,
            status: input.status,
            moduleKeys: input.moduleKeys,
          },
        });
        res.json({ ok: true });
      } catch (error) {
        if (error instanceof z.ZodError)
          return res
            .status(400)
            .json({ error: "invalid_access_update", issues: error.issues });
        next(error);
      }
    },
  );

  router.patch(
    "/team/:accountId/organization-access",
    requirePortalSession,
    requireCsrf,
    async (req: any, res, next) => {
      try {
        const context = req.hotelOps as HotelOpsContext;
        const input = z
          .object({
            organizationId: z.string().uuid(),
            status: z.enum(["active", "inactive"]),
          })
          .parse(req.body);
        const org = selectedOrg(context, input.organizationId);
        const status = input.status;
        if (
          !org ||
          org.role !== "platform_owner" ||
          req.params.accountId === context.account.id
        )
          return res
            .status(403)
            .json({ error: "organization_access_update_denied" });
        const rows = await db
          .select()
          .from(hotelOpsOrganizationMemberships)
          .where(
            and(
              eq(
                hotelOpsOrganizationMemberships.organizationId,
                org.organizationId,
              ),
              eq(
                hotelOpsOrganizationMemberships.accountId,
                req.params.accountId,
              ),
              eq(hotelOpsOrganizationMemberships.role, "above_property_admin"),
            ),
          )
          .limit(1);
        if (!rows[0])
          return res
            .status(404)
            .json({ error: "above_property_membership_not_found" });
        await db
          .update(hotelOpsOrganizationMemberships)
          .set({ status, updatedAt: new Date() })
          .where(eq(hotelOpsOrganizationMemberships.id, rows[0].id));
        if (status === "inactive")
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
          organizationId: org.organizationId,
          actorAccountId: context.account.id,
          action: "organization_access_updated",
          targetType: "account",
          targetId: req.params.accountId,
          metadata: { role: "above_property_admin", status },
        });
        res.json({ ok: true });
      } catch (error) {
        if (error instanceof z.ZodError)
          return res
            .status(400)
            .json({ error: "invalid_organization_access_update" });
        next(error);
      }
    },
  );

  router.post(
    "/invitations/:token/accept",
    authLimiter,
    async (req, res, next) => {
      try {
        const input = z
          .object({
            displayName: z.string().trim().min(2).max(120),
            password: z.string().min(12).max(200),
            passwordConfirmation: z.string().min(12).max(200),
          })
          .refine((value) => value.password === value.passwordConfirmation, {
            path: ["passwordConfirmation"],
            message: "Passwords do not match.",
          })
          .parse(req.body);
        const hash = hashToken(req.params.token);
        const rows = await db
          .select()
          .from(hotelOpsInvitations)
          .where(
            and(
              eq(hotelOpsInvitations.tokenHash, hash),
              isNull(hotelOpsInvitations.acceptedAt),
              isNull(hotelOpsInvitations.revokedAt),
              gt(hotelOpsInvitations.expiresAt, new Date()),
            ),
          )
          .limit(1);
        const invitation = rows[0];
        if (!invitation)
          return res
            .status(404)
            .json({ error: "invitation_invalid_or_expired" });
        if (
          [
            "above_property_admin",
            "property_admin",
            "property_manager",
            "property_employee",
          ].includes(invitation.role) &&
          !invitation.hotelId
        )
          return res
            .status(409)
            .json({ error: "invitation_property_scope_required" });
        const passwordHash = await bcrypt.hash(input.password, 12);
        const account = await db.transaction(async (tx) => {
          const [claimed] = await tx
            .update(hotelOpsInvitations)
            .set({ acceptedAt: new Date() })
            .where(
              and(
                eq(hotelOpsInvitations.id, invitation.id),
                isNull(hotelOpsInvitations.acceptedAt),
                isNull(hotelOpsInvitations.revokedAt),
              ),
            )
            .returning();
          if (!claimed)
            throw Object.assign(new Error("invitation_already_used"), {
              status: 409,
            });
          const existing = await tx
            .select()
            .from(hotelOpsAccounts)
            .where(eq(hotelOpsAccounts.email, invitation.email))
            .limit(1);
          let account = existing[0];
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
                passwordHash,
              })
              .returning();
          }
          // Property-specific authority lives on the hotel membership. Preserve an
          // existing organization role so a second invitation cannot demote it.
          await tx
            .insert(hotelOpsOrganizationMemberships)
            .values({
              organizationId: invitation.organizationId,
              accountId: account.id,
              role: invitation.role,
            })
            .onConflictDoNothing();
          if (
            invitation.hotelId &&
            invitation.role !== "above_property_admin"
          )
            await tx
              .insert(hotelOpsHotelMemberships)
              .values({
                hotelId: invitation.hotelId,
                accountId: account.id,
                role: invitation.role,
              })
              .onConflictDoUpdate({
                target: [
                  hotelOpsHotelMemberships.hotelId,
                  hotelOpsHotelMemberships.accountId,
                ],
                set: {
                  role: invitation.role,
                  status: "active",
                  updatedAt: new Date(),
                },
              });
          if (
            invitation.hotelId &&
            invitation.role !== "above_property_admin"
          )
            for (const moduleKey of Array.isArray(invitation.moduleKeys)
              ? (invitation.moduleKeys as string[])
              : [])
              await tx
                .insert(hotelOpsModulePermissions)
                .values({
                  accountId: account.id,
                  hotelId: invitation.hotelId,
                  moduleKey,
                  canView: true,
                  canManage: invitation.role !== "property_employee",
                })
                .onConflictDoNothing();
          await tx
            .update(hotelOpsInvitations)
            .set({ acceptedByAccountId: account.id })
            .where(eq(hotelOpsInvitations.id, invitation.id));
          await tx
            .insert(hotelOpsAuditEvents)
            .values({
              organizationId: invitation.organizationId,
              hotelId: invitation.hotelId,
              actorAccountId: account.id,
              action: "invitation_accepted",
              targetType: "invitation",
              targetId: invitation.id,
              metadata: { role: invitation.role },
            });
          return account;
        });
        await createSession(res, account.id);
        const returnParams = new URLSearchParams({
          organizationId: invitation.organizationId,
        });
        if (invitation.hotelId) returnParams.set("hotelId", invitation.hotelId);
        res.json({
          ok: true,
          returnTo: `/hoteloperations/dashboard?${returnParams.toString()}`,
        });
      } catch (error: any) {
        if (error instanceof z.ZodError)
          return res.status(400).json({ error: "invalid_acceptance" });
        if (error?.status)
          return res.status(error.status).json({ error: error.message });
        next(error);
      }
    },
  );

  router.post(
    "/password-reset/request",
    authLimiter,
    async (req, res, next) => {
      try {
        const email = normalizeEmail(
          z.object({ email: z.string().email() }).parse(req.body).email,
        );
        const rows = await db
          .select()
          .from(hotelOpsAccounts)
          .where(eq(hotelOpsAccounts.email, email))
          .limit(1);
        if (rows[0]) {
          const token = randomToken();
          await db
            .insert(hotelOpsPasswordResets)
            .values({
              accountId: rows[0].id,
              tokenHash: hashToken(token),
              expiresAt: new Date(Date.now() + RESET_TTL_MS),
            });
          const link = `${publicBaseUrl()}/hoteloperations/reset/${encodeURIComponent(token)}`;
          try {
            await sendPortalEmail(
              email,
              "Reset your hotel operations portal password",
              "Use this single-use link within one hour to reset your password.",
              link,
            );
          } catch {
            /* Keep response enumeration-safe. */
          }
        }
        res.json({ ok: true });
      } catch (error) {
        if (error instanceof z.ZodError)
          return res.status(400).json({ error: "invalid_request" });
        next(error);
      }
    },
  );

  router.post("/password-reset/:token", authLimiter, async (req, res, next) => {
    try {
      const input = z
        .object({
          password: z.string().min(12).max(200),
          passwordConfirmation: z.string().min(12).max(200),
        })
        .refine((value) => value.password === value.passwordConfirmation, {
          path: ["passwordConfirmation"],
          message: "Passwords do not match.",
        })
        .parse(req.body);
      const password = input.password;
      const rows = await db
        .select()
        .from(hotelOpsPasswordResets)
        .where(
          and(
            eq(hotelOpsPasswordResets.tokenHash, hashToken(req.params.token)),
            isNull(hotelOpsPasswordResets.usedAt),
            gt(hotelOpsPasswordResets.expiresAt, new Date()),
          ),
        )
        .limit(1);
      const reset = rows[0];
      if (!reset)
        return res.status(404).json({ error: "reset_invalid_or_expired" });
      await db.transaction(async (tx) => {
        const [claimed] = await tx
          .update(hotelOpsPasswordResets)
          .set({ usedAt: new Date() })
          .where(
            and(
              eq(hotelOpsPasswordResets.id, reset.id),
              isNull(hotelOpsPasswordResets.usedAt),
            ),
          )
          .returning();
        if (!claimed)
          throw Object.assign(new Error("reset_already_used"), { status: 409 });
        await tx
          .update(hotelOpsAccounts)
          .set({
            passwordHash: await bcrypt.hash(password, 12),
            updatedAt: new Date(),
          })
          .where(eq(hotelOpsAccounts.id, reset.accountId));
        await tx
          .update(hotelOpsSessions)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(hotelOpsSessions.accountId, reset.accountId),
              isNull(hotelOpsSessions.revokedAt),
            ),
          );
      });
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError)
        return res.status(400).json({ error: "invalid_password" });
      next(error);
    }
  });

  router.get("/audit", requirePortalSession, async (req: any, res) => {
    const context = req.hotelOps as HotelOpsContext;
    const org = selectedOrg(context, req.query.organizationId);
    if (!org || !canSeeAllHotels(org.role))
      return res.status(403).json({ error: "audit_access_denied" });
    const events = await db
      .select()
      .from(hotelOpsAuditEvents)
      .where(eq(hotelOpsAuditEvents.organizationId, org.organizationId))
      .orderBy(desc(hotelOpsAuditEvents.createdAt))
      .limit(100);
    res.json({ events });
  });

  registerHotelOperationsPhase2Routes(router, {
    requirePortalSession,
    requireCsrf,
    audit,
    publicBaseUrl,
    sendPortalEmail,
    createSession,
  });
  app.use("/api/hotel-operations", router);
  startHotelOpsSupportNotificationWorker();
}
