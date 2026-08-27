import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  decimal,
  jsonb,
  index,
  uniqueIndex,
  foreignKey,
  date,
  time,
  uuid,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const certificationTypes = [
  "PPL",
  "IR",
  "CPL",
  "Multi-Engine",
  "ATP",
  "CFI",
  "CFII",
  "MEI",
] as const;
export const aircraftCategories = [
  "Single-Engine",
  "Multi-Engine",
  "Jet",
  "Turboprop",
  "Helicopter",
  "Seaplane",
] as const;
export const engineTypes = [
  "Single-Engine",
  "Multi-Engine",
  "Turboprop",
  "Jet",
  "Rotor",
] as const;
export const marketplaceCategories = [
  "aircraft-sale",
  "charter",
  "cfi",
  "flight-school",
  "mechanic",
  "job",
] as const;
export const rentalStatuses = [
  "pending",
  "approved",
  "active",
  "completed",
  "cancelled",
] as const;
export const listingTiers = ["basic", "standard", "premium"] as const;
export const leadStatuses = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;
export const dealStages = [
  "lead",
  "prospect",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
] as const;
export const activityTypes = [
  "call",
  "email",
  "meeting",
  "note",
  "task",
] as const;
export const crmWeeklyReportStatuses = ["draft", "submitted"] as const;
export const leadSources = [
  "website",
  "referral",
  "social_media",
  "advertising",
  "cold_outreach",
  "event",
  "other",
] as const;
export const leadCategories = [
  "aircraft_sales",
  "aviation_jobs",
  "flight_schools",
  "rentals",
  "cfi_services",
  "charter_services",
  "mechanic_services",
  "banner_ads",
  "marketplace_services",
  "sponsorships",
  "other",
] as const;
export const crmSalesEmailTemplateTypes = [
  "initial_outreach",
  "direct_pitch",
  "partnership_pitch",
  "relist",
  "promo_offer",
] as const;
export const flightPlanFilingStatuses = [
  "draft",
  "staged",
  "provider-outcome-unknown",
  "filed",
  "activated",
  "cancelled",
  "closed",
] as const;
export const flightPlanFilingActions = [
  "file",
  "amend",
  "activate",
  "cancel",
  "close",
] as const;
export const flyingClubStatuses = [
  "draft",
  "active",
  "paused",
  "archived",
] as const;
export const flyingClubVisibility = ["private", "listed"] as const;
export const flyingClubMemberRoles = [
  "owner",
  "manager",
  "member",
  "instructor",
] as const;
export const flyingClubMemberStatuses = [
  "invited",
  "active",
  "inactive",
] as const;
export const flyingClubAircraftStatuses = [
  "active",
  "limited",
  "maintenance",
  "grounded",
  "inactive",
] as const;
export const flyingClubReservationStatuses = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
] as const;
export const flyingClubJoinRequestStatuses = [
  "pending",
  "approved",
  "declined",
  "withdrawn",
] as const;
export const flyingClubSquawkStatuses = [
  "open",
  "in_review",
  "resolved",
  "deferred",
] as const;
export const flyingClubSquawkSeverities = [
  "info",
  "minor",
  "major",
  "critical",
] as const;
export const flyingClubMaintenanceItemTypes = [
  "ad",
  "inspection",
  "oil_change",
  "maintenance",
  "other",
] as const;
export const flyingClubMaintenanceStatuses = [
  "open",
  "scheduled",
  "completed",
  "overdue",
  "grounded",
] as const;
export const flyingClubBlackoutStatuses = [
  "active",
  "cancelled",
  "completed",
] as const;
export const expenseCategories = [
  "server",
  "database",
  "storage",
  "api",
  "other",
] as const;
export const personalFinanceOwners = ["cory", "amy", "joint"] as const;
export const personalFinanceEntryTypes = ["expense", "income"] as const;
export const personalFinanceRecurringFrequencies = [
  "monthly",
  "weekly",
  "every_x_days",
] as const;
export const personalFinanceExpenseCategories = [
  "Housing",
  "Insurance",
  "Utilities",
  "Groceries",
  "Dining",
  "Transportation",
  "Health",
  "Subscriptions",
  "Entertainment",
  "Personal Care",
  "Education",
  "Childcare",
  "Savings",
  "Loans",
  "Debt",
  "Gifts",
  "Miscellaneous",
] as const;
export const personalFinanceIncomeCategories = [
  "Primary Income",
  "Side Income",
  "Business Income",
  "Passive Income",
  "Government",
  "Other Income",
] as const;
export const personalFinanceRsfCategories = [
  "RSF - Marketing",
  "RSF - Software & Subscriptions",
  "RSF - Legal & Compliance",
  "RSF - Hosting & Infrastructure",
  "RSF - Contractor / Labor",
  "RSF - Equipment",
  "RSF - Travel",
  "RSF - Banking & Fees",
  "RSF - Revenue",
  "RSF - Investor / Funding",
  "RSF - Miscellaneous",
] as const;
export const withdrawalStatuses = [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const;
export const approachPlateTypes = [
  "IAP",
  "SID",
  "STAR",
  "AIRPORT",
  "OTHER",
] as const;
export const adminRoles = [
  "operations",
  "finance",
  "sales",
  "support",
  "content",
] as const;
export const tipEntryStatuses = ["draft", "saved", "submitted"] as const;
export const tipSubmissionStatuses = [
  "submitted",
  "reopened",
  "approved",
  "exported",
] as const;
export const tipsUserRoles = ["employee", "manager", "super_admin"] as const;
export const tipShiftTypes = [
  "breakfast",
  "lunch",
  "dinner",
  "bar",
  "other",
] as const;

// Session storage table for web and OAuth-backed authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Refresh Tokens (for mobile app JWT authentication)
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    deviceInfo: text("device_info"), // Store device fingerprint for security
    ipAddress: text("ip_address"),
  },
  (table) => [
    index("idx_refresh_tokens_user").on(table.userId),
    index("idx_refresh_tokens_expires").on(table.expiresAt),
  ],
);

// OAuth Exchange Tokens (for mobile OAuth flow - temporary tokens to exchange for JWT)
export const oauthExchangeTokens = pgTable(
  "oauth_exchange_tokens",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    token: text("token").notNull().unique(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_oauth_exchange_tokens_token").on(table.token),
    index("idx_oauth_exchange_tokens_expires").on(table.expiresAt),
  ],
);

// Users / Pilots
export const users = pgTable(
  "users",
  {
    // Auth fields (from blueprint - REQUIRED)
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    email: varchar("email").unique(),
    firstName: varchar("first_name"),
    lastName: varchar("last_name"),
    profileImageUrl: varchar("profile_image_url"),

    // Additional user fields
    phone: text("phone"),
    homeBase: text("home_base"),

    // Pilot information
    certifications: text("certifications")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    totalFlightHours: integer("total_flight_hours").default(0),
    aircraftTypesFlown: text("aircraft_types_flown")
      .array()
      .default(sql`ARRAY[]::text[]`),

    // Document uploads (for quick profile access)
    pilotLicenseUrl: text("pilot_license_url"),
    insuranceUrl: text("insurance_url"),

    // Basic Verification (legacy - keep for backward compatibility)
    isVerified: boolean("is_verified").default(false),
    licenseVerified: boolean("license_verified").default(false),
    backgroundCheckCompleted: boolean("background_check_completed").default(
      false,
    ),
    isAdmin: boolean("is_admin").default(false),
    isSuperAdmin: boolean("is_super_admin").default(false),
    adminRole: text("admin_role"),
    adminPermissions: text("admin_permissions")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    // Renter Verification (new comprehensive system)
    legalFirstName: text("legal_first_name"),
    legalLastName: text("legal_last_name"),
    dateOfBirth: text("date_of_birth"), // YYYY-MM-DD
    phoneVerified: boolean("phone_verified").default(false),
    emailVerified: boolean("email_verified").default(false),

    // Weekly engagement emails
    weeklyEmailOptIn: boolean("weekly_email_opt_in").default(true),
    weeklyEmailLastSentAt: timestamp("weekly_email_last_sent_at"),
    weeklyEmailOptOutAt: timestamp("weekly_email_opt_out_at"),
    marketingEmailOptOutAt: timestamp("marketing_email_opt_out_at"),
    proTrialOfferSentAt: timestamp("pro_trial_offer_sent_at"),

    // Identity Documents
    governmentIdFrontUrl: text("government_id_front_url"),
    governmentIdBackUrl: text("government_id_back_url"),
    selfieUrl: text("selfie_url"),
    identityVerified: boolean("identity_verified").default(false),
    identityVerifiedAt: timestamp("identity_verified_at"),

    // Payment Verification
    paymentMethodOnFile: boolean("payment_method_on_file").default(false),
    paymentVerified: boolean("payment_verified").default(false),
    paymentVerifiedAt: timestamp("payment_verified_at"),

    // Pilot License Verification (optional for renters)
    faaCertificateNumber: text("faa_certificate_number"),
    pilotCertificateName: text("pilot_certificate_name"),
    pilotCertificatePhotoUrl: text("pilot_certificate_photo_url"),
    faaVerified: boolean("faa_verified").default(false),
    faaVerifiedMonth: text("faa_verified_month"), // MM/YYYY format
    faaVerifiedAt: timestamp("faa_verified_at"),

    // Bank/payout information
    bankAccountConnected: boolean("bank_account_connected").default(false),
    stripeAccountId: text("stripe_account_id"),
    paypalEmail: text("paypal_email"), // For PayPal Payouts

    // Balance tracking (for owner payouts)
    balance: decimal("balance", { precision: 10, scale: 2 }).default("0.00"),

    // Logbook Pro subscription (PayPal Subscriptions)
    logbookProStatus: text("logbook_pro_status").default("free"), // free, pending, active, cancelled, suspended
    logbookProPlan: text("logbook_pro_plan"), // monthly, biannual, yearly
    logbookProSubscriptionId: text("logbook_pro_subscription_id"),
    logbookProStartedAt: timestamp("logbook_pro_started_at"),
    logbookProEndsAt: timestamp("logbook_pro_ends_at"),
    logbookProCanceledAt: timestamp("logbook_pro_canceled_at"),
    logbookProCancelAtPeriodEnd: boolean(
      "logbook_pro_cancel_at_period_end",
    ).default(false),

    // RSF Membership (new - keep legacy Logbook Pro fields for compatibility)
    membershipTier: text("membership_tier").default("free"), // free, premium; legacy pro/pro_plus normalize to premium
    membershipStatus: text("membership_status").default("inactive"), // active, inactive, cancelled, past_due
    membershipProvider: text("membership_provider"), // paypal or null
    membershipEndsAt: timestamp("membership_ends_at"),
    membershipInterval: text("membership_interval"), // monthly, biannual, annual
    membershipTrialEndsAt: timestamp("membership_trial_ends_at"),
    membershipNextBillingAt: timestamp("membership_next_billing_at"),
    membershipGrantTier: text("membership_grant_tier"), // premium, or null; legacy pro/pro_plus normalize to premium
    membershipGrantEndsAt: timestamp("membership_grant_ends_at"),
    membershipGrantGrantedBy: varchar("membership_grant_granted_by"),
    membershipGrantGrantedAt: timestamp("membership_grant_granted_at"),
    membershipGrantReason: text("membership_grant_reason"),
    paypalSubscriptionId: text("paypal_subscription_id"),
    paypalPlanId: text("paypal_plan_id"),

    // CFI Trial / Support Access (does not grant full RSF Premium)
    cfiTrialStartedAt: timestamp("cfi_trial_started_at"),
    cfiTrialEndsAt: timestamp("cfi_trial_ends_at"),
    cfiTrialRedeemed: boolean("cfi_trial_redeemed").default(false),
    cfiGrantEndsAt: timestamp("cfi_grant_ends_at"),
    cfiGrantGrantedBy: varchar("cfi_grant_granted_by"),
    cfiGrantGrantedAt: timestamp("cfi_grant_granted_at"),

    // Mobile app authentication (optional - for users who sign up via mobile)
    hashedPassword: text("hashed_password"), // bcrypt hash, null for OAuth-only users
    passwordCreatedAt: timestamp("password_created_at"),

    // Email verification (for email/password auth)
    emailVerificationToken: text("email_verification_token"),
    emailVerificationExpires: timestamp("email_verification_expires"),

    // Rating information
    averageRating: decimal("average_rating", { precision: 3, scale: 2 }), // 0.00-5.00
    totalReviews: integer("total_reviews").default(0),

    // Account suspension (for expired documents)
    isSuspended: boolean("is_suspended").default(false),
    suspensionReason: text("suspension_reason"),
    suspendedAt: timestamp("suspended_at"),
    suspendedBy: varchar("suspended_by"), // admin who suspended

    // Timestamps (from blueprint)
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    usersSuspendedByFk: foreignKey({
      columns: [t.suspendedBy],
      foreignColumns: [t.id],
    }),
    usersCfiGrantByFk: foreignKey({
      columns: [t.cfiGrantGrantedBy],
      foreignColumns: [t.id],
    }),
  }),
);

export const adminInvites = pgTable("admin_invites", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  role: text("role").notNull(),
  permissions: text("permissions")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  token: text("token").notNull().unique(),
  invitedBy: varchar("invited_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Standalone Courtyard Tips Tracker users. Kept separate from RSF aviation users
// so any employee email can register without aviation roles or profile requirements.
export const tipsUsers = pgTable(
  "tips_users",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: varchar("email").notNull().unique(),
    employeeDisplayName: text("employee_display_name").notNull(),
    position: text("position"),
    role: text("role").notNull().default("employee"),
    toolAccessJson: jsonb("tool_access_json")
      .$type<Record<string, boolean>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    hashedPassword: text("hashed_password").notNull(),
    mustChangePassword: boolean("must_change_password")
      .notNull()
      .default(false),
    disabledAt: timestamp("disabled_at"),
    disabledBy: varchar("disabled_by"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_tips_users_email").on(table.email)],
);

export const tipEntries = pgTable(
  "tip_entries",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => tipsUsers.id, { onDelete: "cascade" }),
    entryDate: date("entry_date").notNull(),
    payPeriodStart: date("pay_period_start").notNull(),
    payPeriodEnd: date("pay_period_end").notNull(),
    tipAmount: numeric("tip_amount", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    cashTips: numeric("cash_tips", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    creditTips: numeric("credit_tips", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    grossSales: numeric("gross_sales", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    coversServed: integer("covers_served"),
    shiftType: text("shift_type").notNull().default("other"),
    notes: text("notes"),
    status: text("status").notNull().default("saved"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_tip_entries_user_date").on(table.userId, table.entryDate),
    index("idx_tip_entries_user_period").on(
      table.userId,
      table.payPeriodStart,
      table.payPeriodEnd,
    ),
  ],
);

export const tipEntryAttachments = pgTable(
  "tip_entry_attachments",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tipEntryId: varchar("tip_entry_id")
      .notNull()
      .references(() => tipEntries.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    originalFileName: text("original_file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    uploadedAt: timestamp("uploaded_at").defaultNow(),
  },
  (table) => [index("idx_tip_entry_attachments_entry").on(table.tipEntryId)],
);

export const tipDailyReportAttachments = pgTable(
  "tip_daily_report_attachments",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    reportDate: date("report_date").notNull(),
    payPeriodStart: date("pay_period_start").notNull(),
    payPeriodEnd: date("pay_period_end").notNull(),
    storagePath: text("storage_path").notNull(),
    originalFileName: text("original_file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    uploadedBy: varchar("uploaded_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    uploadedAt: timestamp("uploaded_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_tip_daily_report_date").on(table.reportDate),
    index("idx_tip_daily_report_period").on(
      table.payPeriodStart,
      table.payPeriodEnd,
    ),
  ],
);

export const tipGridSubmissions = pgTable(
  "tip_grid_submissions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    payPeriodStart: date("pay_period_start").notNull(),
    payPeriodEnd: date("pay_period_end").notNull(),
    week1Total: numeric("week1_total", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    week2Total: numeric("week2_total", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    totalTips: numeric("total_tips", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    status: text("status").notNull().default("submitted"),
    submittedAt: timestamp("submitted_at").defaultNow(),
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: varchar("reviewed_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    pdfPath: text("pdf_path"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_tip_grid_submissions_period").on(
      table.payPeriodStart,
      table.payPeriodEnd,
    ),
  ],
);

export const tipGridDaySummaries = pgTable(
  "tip_grid_day_summaries",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    summaryDate: date("summary_date").notNull(),
    payPeriodStart: date("pay_period_start").notNull(),
    payPeriodEnd: date("pay_period_end").notNull(),
    grossSales: numeric("gross_sales", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    taxAmount: numeric("tax_amount", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    beerSales: numeric("beer_sales", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    liquorSales: numeric("liquor_sales", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    foodSales: numeric("food_sales", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    wineSales: numeric("wine_sales", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    notes: text("notes"),
    updatedBy: varchar("updated_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_tip_grid_day_summaries_date").on(table.summaryDate),
    index("idx_tip_grid_day_summaries_period").on(
      table.payPeriodStart,
      table.payPeriodEnd,
    ),
  ],
);

export const tipBanquetReports = pgTable(
  "tip_banquet_reports",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    eventDate: date("event_date").notNull(),
    payPeriodStart: date("pay_period_start").notNull(),
    payPeriodEnd: date("pay_period_end").notNull(),
    reportType: text("report_type").notNull().default("banquet_service"),
    eventName: text("event_name").notNull(),
    grossSales: numeric("gross_sales", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    serviceRate: numeric("service_rate", { precision: 5, scale: 4 })
      .notNull()
      .default("0.2100"),
    banquetTips: numeric("banquet_tips", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    assignedAssociatesJson: jsonb("assigned_associates_json")
      .$type<
        Array<{ userId: string; displayName: string; splitAmount: string }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    notes: text("notes"),
    storagePath: text("storage_path"),
    originalFileName: text("original_file_name"),
    mimeType: text("mime_type"),
    size: integer("size"),
    updatedBy: varchar("updated_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_tip_banquet_reports_date").on(table.eventDate),
    index("idx_tip_banquet_reports_period").on(
      table.payPeriodStart,
      table.payPeriodEnd,
    ),
  ],
);

export const tipsKioskSettings = pgTable("tips_kiosk_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedBy: varchar("updated_by").references(() => tipsUsers.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tipPeriodSubmissions = pgTable(
  "tip_period_submissions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => tipsUsers.id, { onDelete: "cascade" }),
    payPeriodStart: date("pay_period_start").notNull(),
    payPeriodEnd: date("pay_period_end").notNull(),
    week1Total: numeric("week1_total", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    week2Total: numeric("week2_total", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    totalTips: numeric("total_tips", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    status: text("status").notNull().default("submitted"),
    submittedAt: timestamp("submitted_at").defaultNow(),
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: varchar("reviewed_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    pdfPath: text("pdf_path"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_tip_submissions_user_period").on(
      table.userId,
      table.payPeriodStart,
      table.payPeriodEnd,
    ),
    index("idx_tip_submissions_period").on(
      table.payPeriodStart,
      table.payPeriodEnd,
    ),
  ],
);

export const tipAdminActions = pgTable(
  "tip_admin_actions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    actorUserId: varchar("actor_user_id").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    targetUserId: varchar("target_user_id").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    metadataJson: jsonb("metadata_json"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_tip_admin_actions_target").on(table.targetUserId),
    index("idx_tip_admin_actions_created").on(table.createdAt),
  ],
);

export const scheduleEmployees = pgTable(
  "schedule_employees",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    displayName: text("display_name").notNull(),
    department: text("department").notNull().default("Other"),
    position: text("position"),
    rolesJson: jsonb("roles_json"),
    roleRatesJson: jsonb("role_rates_json"),
    isSalaried: boolean("is_salaried").notNull().default(false),
    isDepartmentManager: boolean("is_department_manager")
      .notNull()
      .default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    defaultShiftType: text("default_shift_type"),
    maxWeeklyHours: numeric("max_weekly_hours", { precision: 6, scale: 2 }),
    hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
    phone: text("phone"),
    email: varchar("email"),
    active: boolean("active").notNull().default(true),
    availabilityJson: jsonb("availability_json"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_schedule_employees_department").on(table.department),
    index("idx_schedule_employees_active").on(table.active),
    index("idx_schedule_employees_sort").on(table.department, table.sortOrder),
  ],
);

export const scheduleShiftTypes = pgTable(
  "schedule_shift_types",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    label: text("label").notNull().unique(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    unpaidBreakMinutes: integer("unpaid_break_minutes").notNull().default(0),
    color: text("color").notNull(),
    textColor: text("text_color").notNull().default("#111827"),
    departmentHint: text("department_hint"),
    isOvernight: boolean("is_overnight").notNull().default(false),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_schedule_shift_types_active").on(table.active),
    index("idx_schedule_shift_types_sort").on(table.sortOrder),
  ],
);

export const weeklySchedules = pgTable(
  "weekly_schedules",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    propertyName: text("property_name")
      .notNull()
      .default("Courtyard Austin Lakeline"),
    weekStartDate: date("week_start_date").notNull(),
    weekEndDate: date("week_end_date").notNull(),
    status: text("status").notNull().default("draft"),
    departmentStatusJson: jsonb("department_status_json"),
    createdByUserId: varchar("created_by_user_id").references(
      () => tipsUsers.id,
      { onDelete: "set null" },
    ),
    publishedAt: timestamp("published_at"),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_weekly_schedules_week").on(table.weekStartDate),
    index("idx_weekly_schedules_status").on(table.status),
  ],
);

export const scheduleForecastDays = pgTable(
  "schedule_forecast_days",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    scheduleId: varchar("schedule_id")
      .notNull()
      .references(() => weeklySchedules.id, { onDelete: "cascade" }),
    forecastDate: date("forecast_date").notNull(),
    roomsSold: integer("rooms_sold").notNull().default(0),
    occupancyPercent: numeric("occupancy_percent", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    arrivals: integer("arrivals").notNull().default(0),
    departures: integer("departures").notNull().default(0),
    stayovers: integer("stayovers").notNull().default(0),
    dndRooms: integer("dnd_rooms").notNull().default(0),
    forecastAdr: numeric("forecast_adr", { precision: 10, scale: 2 }),
    roomRevenue: numeric("room_revenue", { precision: 12, scale: 2 }),
    otbRoomsSold: integer("otb_rooms_sold"),
    otbOccupancyPercent: numeric("otb_occupancy_percent", {
      precision: 5,
      scale: 2,
    }),
    otbArrivals: integer("otb_arrivals"),
    otbDepartures: integer("otb_departures"),
    otbRoomRevenue: numeric("otb_room_revenue", { precision: 12, scale: 2 }),
    actualRoomsSold: integer("actual_rooms_sold"),
    actualOccupancyPercent: numeric("actual_occupancy_percent", {
      precision: 5,
      scale: 2,
    }),
    actualArrivals: integer("actual_arrivals"),
    actualDepartures: integer("actual_departures"),
    actualRoomRevenue: numeric("actual_room_revenue", {
      precision: 12,
      scale: 2,
    }),
    popupGroupRooms: integer("popup_group_rooms").notNull().default(0),
    popupGroupNotes: text("popup_group_notes"),
    groupsEventsNotes: text("groups_events_notes"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_schedule_forecast_schedule_date").on(
      table.scheduleId,
      table.forecastDate,
    ),
  ],
);

export const scheduleShiftAssignments = pgTable(
  "schedule_shift_assignments",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    scheduleId: varchar("schedule_id")
      .notNull()
      .references(() => weeklySchedules.id, { onDelete: "cascade" }),
    employeeId: varchar("employee_id").references(() => scheduleEmployees.id, {
      onDelete: "set null",
    }),
    shiftDate: date("shift_date").notNull(),
    shiftTypeId: varchar("shift_type_id").references(
      () => scheduleShiftTypes.id,
      { onDelete: "set null" },
    ),
    customStartTime: time("custom_start_time"),
    customEndTime: time("custom_end_time"),
    unpaidBreakMinutes: integer("unpaid_break_minutes"),
    roleWorked: text("role_worked"),
    roleNote: text("role_note"),
    managerNote: text("manager_note"),
    isOpenShift: boolean("is_open_shift").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_schedule_shift_unique").on(
      table.scheduleId,
      table.employeeId,
      table.shiftDate,
    ),
    index("idx_schedule_shift_schedule_date").on(
      table.scheduleId,
      table.shiftDate,
    ),
  ],
);

export const scheduleTemplates = pgTable(
  "schedule_templates",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    occupancyTier: text("occupancy_tier").notNull().default("custom"),
    description: text("description"),
    sourceScheduleId: varchar("source_schedule_id").references(
      () => weeklySchedules.id,
      { onDelete: "set null" },
    ),
    createdByUserId: varchar("created_by_user_id").references(
      () => tipsUsers.id,
      { onDelete: "set null" },
    ),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_schedule_templates_name").on(table.name),
    index("idx_schedule_templates_tier").on(table.occupancyTier),
    index("idx_schedule_templates_active").on(table.active),
  ],
);

export const scheduleTemplateShifts = pgTable(
  "schedule_template_shifts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    templateId: varchar("template_id")
      .notNull()
      .references(() => scheduleTemplates.id, { onDelete: "cascade" }),
    dayOffset: integer("day_offset").notNull(),
    employeeId: varchar("employee_id").references(() => scheduleEmployees.id, {
      onDelete: "set null",
    }),
    employeeName: text("employee_name"),
    shiftTypeId: varchar("shift_type_id").references(
      () => scheduleShiftTypes.id,
      { onDelete: "set null" },
    ),
    shiftTypeLabel: text("shift_type_label"),
    customStartTime: time("custom_start_time"),
    customEndTime: time("custom_end_time"),
    unpaidBreakMinutes: integer("unpaid_break_minutes"),
    roleWorked: text("role_worked"),
    roleNote: text("role_note"),
    managerNote: text("manager_note"),
    isOpenShift: boolean("is_open_shift").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_schedule_template_shifts_template").on(table.templateId),
    index("idx_schedule_template_shifts_employee").on(table.employeeId),
  ],
);

export const scheduleShareLinks = pgTable(
  "schedule_share_links",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    scheduleId: varchar("schedule_id")
      .notNull()
      .references(() => weeklySchedules.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    createdByUserId: varchar("created_by_user_id").references(
      () => tipsUsers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").defaultNow(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [index("idx_schedule_share_links_schedule").on(table.scheduleId)],
);

export const scheduleRequests = pgTable(
  "schedule_requests",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    requesterUserId: varchar("requester_user_id")
      .notNull()
      .references(() => tipsUsers.id, { onDelete: "cascade" }),
    department: text("department").notNull().default("Front Desk"),
    requestDate: date("request_date").notNull(),
    requestEndDate: date("request_end_date"),
    requestGroupId: varchar("request_group_id"),
    requestType: text("request_type").notNull().default("time_off"),
    startTime: time("start_time"),
    endTime: time("end_time"),
    notes: text("notes"),
    status: text("status").notNull().default("submitted"),
    isProtectedLeave: boolean("is_protected_leave").notNull().default(false),
    policyVersion: text("policy_version"),
    policyAcceptedAt: timestamp("policy_accepted_at"),
    managerOverrideReason: text("manager_override_reason"),
    coveragePlan: text("coverage_plan"),
    reviewedByUserId: varchar("reviewed_by_user_id").references(
      () => tipsUsers.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_schedule_requests_requester").on(table.requesterUserId),
    index("idx_schedule_requests_department").on(table.department),
    index("idx_schedule_requests_date").on(table.requestDate),
    index("idx_schedule_requests_status").on(table.status),
  ],
);

export const scheduleCoverageRequirements = pgTable("schedule_coverage_requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  department: text("department").notNull(),
  role: text("role").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  minimumAssociates: integer("minimum_associates").notNull().default(1),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [uniqueIndex("uniq_schedule_coverage_requirement").on(table.department, table.role, table.startTime, table.endTime)]);

export const scheduleBlackoutDates = pgTable("schedule_blackout_dates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blackoutDate: date("blackout_date").notNull(),
  department: text("department"),
  label: text("label").notNull(),
  reason: text("reason"),
  restriction: text("restriction").notNull().default("enhanced_review"),
  createdByUserId: varchar("created_by_user_id").references(() => tipsUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("idx_schedule_blackout_date").on(table.blackoutDate)]);

export const scheduleHolidayAssignments = pgTable("schedule_holiday_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  holidayDate: date("holiday_date").notNull(),
  holidayName: text("holiday_name").notNull(),
  employeeId: varchar("employee_id").notNull().references(() => scheduleEmployees.id, { onDelete: "cascade" }),
  worked: boolean("worked").notNull().default(true),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id").references(() => tipsUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("uniq_schedule_holiday_employee").on(table.holidayDate, table.employeeId),
  index("idx_schedule_holiday_date").on(table.holidayDate),
]);

export const scheduleShiftExchanges = pgTable("schedule_shift_exchanges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterUserId: varchar("requester_user_id").notNull().references(() => tipsUsers.id, { onDelete: "cascade" }),
  replacementUserId: varchar("replacement_user_id").references(() => tipsUsers.id, { onDelete: "set null" }),
  shiftDate: date("shift_date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  department: text("department").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("proposed"),
  replacementAcceptedAt: timestamp("replacement_accepted_at"),
  reviewedByUserId: varchar("reviewed_by_user_id").references(() => tipsUsers.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [index("idx_schedule_exchange_date").on(table.shiftDate), index("idx_schedule_exchange_status").on(table.status)]);

export const scheduleHousekeepingBoards = pgTable(
  "schedule_housekeeping_boards",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    scheduleId: varchar("schedule_id")
      .notNull()
      .references(() => weeklySchedules.id, { onDelete: "cascade" }),
    employeeId: varchar("employee_id")
      .notNull()
      .references(() => scheduleEmployees.id, { onDelete: "cascade" }),
    boardDate: date("board_date").notNull(),
    actualHours: numeric("actual_hours", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    checkoutRooms: integer("checkout_rooms").notNull().default(0),
    stayoverRooms: integer("stayover_rooms").notNull().default(0),
    dndRooms: integer("dnd_rooms").notNull().default(0),
    oooRooms: integer("ooo_rooms").notNull().default(0),
    deepCleanRooms: integer("deep_clean_rooms").notNull().default(0),
    notes: text("notes"),
    enteredByUserId: varchar("entered_by_user_id").references(
      () => tipsUsers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_schedule_hk_board_unique").on(
      table.scheduleId,
      table.employeeId,
      table.boardDate,
    ),
    index("idx_schedule_hk_board_schedule_date").on(
      table.scheduleId,
      table.boardDate,
    ),
    index("idx_schedule_hk_board_employee").on(table.employeeId),
  ],
);

export const scheduleActualHours = pgTable(
  "schedule_actual_hours",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    scheduleId: varchar("schedule_id")
      .notNull()
      .references(() => weeklySchedules.id, { onDelete: "cascade" }),
    employeeId: varchar("employee_id")
      .notNull()
      .references(() => scheduleEmployees.id, { onDelete: "cascade" }),
    workDate: date("work_date").notNull(),
    actualHours: numeric("actual_hours", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    notes: text("notes"),
    source: text("source").notNull().default("manual"),
    enteredByUserId: varchar("entered_by_user_id").references(
      () => tipsUsers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_schedule_actual_hours_unique").on(
      table.scheduleId,
      table.employeeId,
      table.workDate,
    ),
    index("idx_schedule_actual_hours_schedule_date").on(
      table.scheduleId,
      table.workDate,
    ),
    index("idx_schedule_actual_hours_employee").on(table.employeeId),
  ],
);

export const scheduleAuditLog = pgTable(
  "schedule_audit_log",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    scheduleId: varchar("schedule_id").references(() => weeklySchedules.id, {
      onDelete: "cascade",
    }),
    actorUserId: varchar("actor_user_id").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    metadataJson: jsonb("metadata_json"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_schedule_audit_schedule").on(table.scheduleId),
    index("idx_schedule_audit_created").on(table.createdAt),
  ],
);

export const courtyardBudgetUploads = pgTable(
  "courtyard_budget_uploads",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    propertyId: text("property_id")
      .notNull()
      .default("courtyard-austin-lakeline"),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    originalFileName: text("original_file_name").notNull(),
    uploadedBy: varchar("uploaded_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    uploadedAt: timestamp("uploaded_at").defaultNow(),
  },
  (table) => [
    index("idx_courtyard_budget_upload_period").on(
      table.propertyId,
      table.year,
      table.month,
    ),
  ],
);

export const courtyardBudgetLineItems = pgTable(
  "courtyard_budget_line_items",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    budgetUploadId: varchar("budget_upload_id")
      .notNull()
      .references(() => courtyardBudgetUploads.id, { onDelete: "cascade" }),
    propertyId: text("property_id")
      .notNull()
      .default("courtyard-austin-lakeline"),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    department: text("department").notNull(),
    sourceSheet: text("source_sheet"),
    lineItem: text("line_item").notNull(),
    coa: text("coa"),
    categoryType: text("category_type").notNull().default("controllable"),
    visibilityLevel: text("visibility_level").notNull().default("department"),
    actualAmount: numeric("actual_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    actualPercent: numeric("actual_percent", { precision: 9, scale: 4 })
      .notNull()
      .default("0"),
    originalBudgetAmount: numeric("original_budget_amount", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    originalBudgetPercent: numeric("original_budget_percent", {
      precision: 9,
      scale: 4,
    })
      .notNull()
      .default("0"),
    updatedForecastAmount: numeric("updated_forecast_amount", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    priorYearAmount: numeric("prior_year_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    priorYearPercent: numeric("prior_year_percent", { precision: 9, scale: 4 })
      .notNull()
      .default("0"),
    ytdActualAmount: numeric("ytd_actual_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    ytdActualPercent: numeric("ytd_actual_percent", { precision: 9, scale: 4 })
      .notNull()
      .default("0"),
    ytdBudgetAmount: numeric("ytd_budget_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    ytdBudgetPercent: numeric("ytd_budget_percent", { precision: 9, scale: 4 })
      .notNull()
      .default("0"),
    isSensitive: boolean("is_sensitive").notNull().default(false),
    isHiddenFromDepartmentHead: boolean("is_hidden_from_department_head")
      .notNull()
      .default(false),
    isTotal: boolean("is_total").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_courtyard_budget_lines_period").on(
      table.propertyId,
      table.year,
      table.month,
    ),
    index("idx_courtyard_budget_lines_department").on(table.department),
  ],
);

export const courtyardBudgetCheckbookEntries = pgTable(
  "courtyard_budget_checkbook_entries",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    propertyId: text("property_id")
      .notNull()
      .default("courtyard-austin-lakeline"),
    department: text("department").notNull(),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    entryDate: date("entry_date").notNull(),
    vendor: text("vendor").notNull(),
    category: text("category").notNull(),
    description: text("description"),
    amount: numeric("amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    receiptPath: text("receipt_path"),
    enteredBy: varchar("entered_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_courtyard_budget_checkbook_period").on(
      table.propertyId,
      table.year,
      table.month,
    ),
    index("idx_courtyard_budget_checkbook_department").on(table.department),
  ],
);

export const courtyardBudgetDepartmentForecasts = pgTable(
  "courtyard_budget_department_forecasts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    propertyId: text("property_id")
      .notNull()
      .default("courtyard-austin-lakeline"),
    department: text("department").notNull(),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    forecastRevenue: numeric("forecast_revenue", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    projectedLabor: numeric("projected_labor", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    laborProjectionJson: jsonb("labor_projection_json")
      .$type<Record<string, number>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    updatedBy: varchar("updated_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_courtyard_budget_forecast_period_department").on(
      table.propertyId,
      table.year,
      table.month,
      table.department,
    ),
  ],
);

export const courtyardBudgetAuditLog = pgTable(
  "courtyard_budget_audit_log",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    actorUserId: varchar("actor_user_id").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    department: text("department"),
    month: integer("month"),
    year: integer("year"),
    metadataJson: jsonb("metadata_json"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_courtyard_budget_audit_period").on(table.year, table.month),
    index("idx_courtyard_budget_audit_created").on(table.createdAt),
  ],
);

export const courtyardOpsReportDrafts = pgTable(
  "courtyard_ops_report_drafts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    propertyId: text("property_id")
      .notNull()
      .default("courtyard-austin-lakeline"),
    weekStart: date("week_start").notNull(),
    weekEnd: date("week_end").notNull(),
    weekLabel: text("week_label").notNull().default("Week 1"),
    payloadJson: jsonb("payload_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    uploadedReportsJson: jsonb("uploaded_reports_json")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    updatedBy: varchar("updated_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_courtyard_ops_report_week").on(
      table.propertyId,
      table.weekStart,
    ),
    index("idx_courtyard_ops_report_updated").on(table.updatedAt),
  ],
);

export const courtyardOpsReportUserSettings = pgTable(
  "courtyard_ops_report_user_settings",
  {
    userId: varchar("user_id")
      .primaryKey()
      .references(() => tipsUsers.id, { onDelete: "cascade" }),
    lastWeekStart: date("last_week_start"),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
);

export const courtyardOpsMonthlySummaries = pgTable(
  "courtyard_ops_monthly_summaries",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    propertyId: text("property_id")
      .notNull()
      .default("courtyard-austin-lakeline"),
    reportMonth: text("report_month").notNull(),
    payloadJson: jsonb("payload_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    updatedBy: varchar("updated_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_courtyard_ops_monthly_summary_period").on(
      table.propertyId,
      table.reportMonth,
    ),
    index("idx_courtyard_ops_monthly_summary_updated").on(table.updatedAt),
  ],
);

export const courtyardComptrollerReports = pgTable(
  "courtyard_comptroller_reports",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    propertyId: text("property_id")
      .notNull()
      .default("courtyard-austin-lakeline"),
    reportMonth: text("report_month").notNull(),
    payloadJson: jsonb("payload_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    uploadedReportsJson: jsonb("uploaded_reports_json")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    settingsJson: jsonb("settings_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    updatedBy: varchar("updated_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_courtyard_comptroller_report_period").on(
      table.propertyId,
      table.reportMonth,
    ),
    index("idx_courtyard_comptroller_report_updated").on(table.updatedAt),
  ],
);

export const courtyardHotels = pgTable(
  "courtyard_hotels",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    hotelCode: text("hotel_code").notNull(),
    brand: text("brand"),
    market: text("market"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_courtyard_hotels_code").on(table.hotelCode),
    index("idx_courtyard_hotels_active").on(table.active),
  ],
);

export const courtyardHotelUserAccess = pgTable(
  "courtyard_hotel_user_access",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    hotelId: varchar("hotel_id")
      .notNull()
      .references(() => courtyardHotels.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => tipsUsers.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("dos"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_courtyard_hotel_user").on(table.hotelId, table.userId),
    index("idx_courtyard_hotel_access_user").on(table.userId),
  ],
);

export const courtyardDosReports = pgTable(
  "courtyard_dos_reports",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    hotelId: varchar("hotel_id")
      .notNull()
      .references(() => courtyardHotels.id, { onDelete: "cascade" }),
    reportMonth: text("report_month").notNull(),
    status: text("status").notNull().default("draft"),
    submittedAt: timestamp("submitted_at"),
    payloadJson: jsonb("payload_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    updatedBy: varchar("updated_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_courtyard_dos_report_period").on(
      table.hotelId,
      table.reportMonth,
    ),
    index("idx_courtyard_dos_report_updated").on(table.updatedAt),
  ],
);

export const courtyardSalesImportBatches = pgTable(
  "courtyard_sales_import_batches",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    hotelId: varchar("hotel_id")
      .notNull()
      .references(() => courtyardHotels.id, { onDelete: "cascade" }),
    reportYear: integer("report_year").notNull(),
    reportMonth: integer("report_month").notNull(),
    originalFilename: text("original_filename").notNull(),
    detectedDelimiter: text("detected_delimiter").notNull(),
    sourceReportType: text("source_report_type")
      .notNull()
      .default("marriott_mint_analytical_account_tracking"),
    uploadedBy: varchar("uploaded_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    rowCount: integer("row_count").notNull().default(0),
    acceptedRowCount: integer("accepted_row_count").notNull().default(0),
    rejectedRowCount: integer("rejected_row_count").notNull().default(0),
    duplicateRowCount: integer("duplicate_row_count").notNull().default(0),
    fileChecksum: text("file_checksum").notNull(),
    status: text("status").notNull().default("completed"),
    validationSummaryJson: jsonb("validation_summary_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    replacedAt: timestamp("replaced_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_courtyard_sales_import_period").on(
      table.hotelId,
      table.reportYear,
      table.reportMonth,
    ),
    index("idx_courtyard_sales_import_checksum").on(
      table.hotelId,
      table.fileChecksum,
    ),
  ],
);

export const courtyardSalesRawRows = pgTable(
  "courtyard_sales_raw_rows",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    importBatchId: varchar("import_batch_id")
      .notNull()
      .references(() => courtyardSalesImportBatches.id, {
        onDelete: "cascade",
      }),
    sourceRowNumber: integer("source_row_number").notNull(),
    rawPayloadJson: jsonb("raw_payload_json")
      .$type<Record<string, string>>()
      .notNull(),
    normalizedRowHash: text("normalized_row_hash").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_courtyard_sales_raw_batch").on(table.importBatchId)],
);

export const courtyardSalesProduction = pgTable(
  "courtyard_sales_production",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    importBatchId: varchar("import_batch_id")
      .notNull()
      .references(() => courtyardSalesImportBatches.id, {
        onDelete: "cascade",
      }),
    hotelId: varchar("hotel_id")
      .notNull()
      .references(() => courtyardHotels.id, { onDelete: "cascade" }),
    reportYear: integer("report_year").notNull(),
    reportMonth: integer("report_month").notNull(),
    globalUltimateAccountName: text("global_ultimate_account_name"),
    highestLevelAccountId: text("highest_level_account_id"),
    accountName: text("account_name"),
    accountId: text("account_id"),
    accountType: text("account_type"),
    marketCategory: text("market_category"),
    marketSegment: text("market_segment"),
    rateProgramCode: text("rate_program_code"),
    rateProgram: text("rate_program"),
    bookingOffice: text("booking_office"),
    roomNights: numeric("room_nights", { precision: 14, scale: 3 })
      .notNull()
      .default("0"),
    roomRevenue: numeric("room_revenue", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    roomAdr: numeric("room_adr", { precision: 14, scale: 2 }),
    totalRevenue: numeric("total_revenue", { precision: 16, scale: 2 }),
    totalAdr: numeric("total_adr", { precision: 14, scale: 2 }),
    averageLos: numeric("average_los", { precision: 12, scale: 3 }),
    fees: numeric("fees", { precision: 16, scale: 2 }),
    taxes: numeric("taxes", { precision: 16, scale: 2 }),
    addOns: numeric("add_ons", { precision: 16, scale: 2 }),
    stayArrivalDate: date("stay_arrival_date"),
    stayDepartureDate: date("stay_departure_date"),
    groupBookingCode: text("group_booking_code"),
    sourceProfile: text("source_profile"),
    contractedRoomNights: numeric("contracted_room_nights", {
      precision: 14,
      scale: 2,
    }),
    blockedRoomNights: numeric("blocked_room_nights", {
      precision: 14,
      scale: 2,
    }),
    cancelledRoomNights: numeric("cancelled_room_nights", {
      precision: 14,
      scale: 2,
    }),
    noShowRoomNights: numeric("no_show_room_nights", {
      precision: 14,
      scale: 2,
    }),
    cutoffDate: date("cutoff_date"),
    released: boolean("released"),
    sourceRowNumber: integer("source_row_number").notNull(),
    normalizedAccountKey: text("normalized_account_key").notNull(),
    normalizedRowHash: text("normalized_row_hash").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_courtyard_sales_production_period").on(
      table.hotelId,
      table.reportYear,
      table.reportMonth,
    ),
    index("idx_courtyard_sales_production_account").on(
      table.hotelId,
      table.normalizedAccountKey,
    ),
  ],
);

export const courtyardSalesAccountProfiles = pgTable(
  "courtyard_sales_account_profiles",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    hotelId: varchar("hotel_id")
      .notNull()
      .references(() => courtyardHotels.id, { onDelete: "cascade" }),
    normalizedAccountKey: text("normalized_account_key").notNull(),
    contactName: text("contact_name"),
    phone: text("phone"),
    email: text("email"),
    updatedBy: varchar("updated_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_courtyard_sales_profile_account").on(
      table.hotelId,
      table.normalizedAccountKey,
    ),
  ],
);

export const courtyardSalesAccountNotes = pgTable(
  "courtyard_sales_account_notes",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    profileId: varchar("profile_id")
      .notNull()
      .references(() => courtyardSalesAccountProfiles.id, {
        onDelete: "cascade",
      }),
    note: text("note").notNull(),
    createdBy: varchar("created_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_courtyard_sales_notes_profile").on(
      table.profileId,
      table.createdAt,
    ),
  ],
);

export const courtyardSalesOpportunities = pgTable(
  "courtyard_sales_opportunities",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    hotelId: varchar("hotel_id")
      .notNull()
      .references(() => courtyardHotels.id, { onDelete: "cascade" }),
    normalizedAccountKey: text("normalized_account_key").notNull(),
    accountName: text("account_name").notNull(),
    stage: text("stage").notNull().default("prospect"),
    arrivalDate: date("arrival_date"),
    departureDate: date("departure_date"),
    estimatedRoomNights: numeric("estimated_room_nights", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    estimatedRevenue: numeric("estimated_revenue", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    marketSegment: text("market_segment"),
    nextAction: text("next_action"),
    nextActionAt: timestamp("next_action_at"),
    ownerUserId: varchar("owner_user_id").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdBy: varchar("created_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_courtyard_sales_opportunity_hotel_stage").on(
      table.hotelId,
      table.stage,
    ),
    index("idx_courtyard_sales_opportunity_next_action").on(
      table.hotelId,
      table.nextActionAt,
    ),
  ],
);

export const courtyardSalesActivities = pgTable(
  "courtyard_sales_activities",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    hotelId: varchar("hotel_id")
      .notNull()
      .references(() => courtyardHotels.id, { onDelete: "cascade" }),
    normalizedAccountKey: text("normalized_account_key").notNull(),
    accountName: text("account_name").notNull(),
    opportunityId: varchar("opportunity_id").references(
      () => courtyardSalesOpportunities.id,
      { onDelete: "set null" },
    ),
    activityType: text("activity_type").notNull(),
    outcome: text("outcome"),
    details: text("details"),
    nextFollowUpAt: timestamp("next_follow_up_at"),
    createdBy: varchar("created_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_courtyard_sales_activity_hotel_created").on(
      table.hotelId,
      table.createdAt,
    ),
    index("idx_courtyard_sales_activity_account").on(
      table.hotelId,
      table.normalizedAccountKey,
    ),
  ],
);

export const courtyardSalesWeeklyReports = pgTable(
  "courtyard_sales_weekly_reports",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    hotelId: varchar("hotel_id")
      .notNull()
      .references(() => courtyardHotels.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    status: text("status").notNull().default("draft"),
    narrativeJson: jsonb("narrative_json")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    submittedAt: timestamp("submitted_at"),
    updatedBy: varchar("updated_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_courtyard_sales_weekly_report_period").on(
      table.hotelId,
      table.weekStart,
    ),
  ],
);

export const courtyardSalesAdvisorAnalyses = pgTable(
  "courtyard_sales_advisor_analyses",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    hotelId: varchar("hotel_id")
      .notNull()
      .references(() => courtyardHotels.id, { onDelete: "cascade" }),
    createdByUserId: varchar("created_by_user_id").references(
      () => tipsUsers.id,
      { onDelete: "set null" },
    ),
    analysisType: text("analysis_type").notNull(),
    lookbackMonths: integer("lookback_months").notNull(),
    businessTypesJson: jsonb("business_types_json")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    requestParametersJson: jsonb("request_parameters_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    sourceFingerprint: text("source_fingerprint").notNull(),
    inputSnapshotJson: jsonb("input_snapshot_json")
      .$type<Record<string, unknown>>()
      .notNull(),
    resultJson: jsonb("result_json").$type<Record<string, unknown>>(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    status: text("status").notNull().default("completed"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_courtyard_sales_advisor_recent").on(
      table.hotelId,
      table.createdAt,
    ),
    index("idx_courtyard_sales_advisor_fingerprint").on(
      table.hotelId,
      table.sourceFingerprint,
    ),
  ],
);

export const courtyardSalesMonthlyTargets = pgTable(
  "courtyard_sales_monthly_targets",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    hotelId: varchar("hotel_id")
      .notNull()
      .references(() => courtyardHotels.id, { onDelete: "cascade" }),
    targetYear: integer("target_year").notNull(),
    targetMonth: integer("target_month").notNull(),
    segment: text("segment").notNull(),
    targetRoomNights: numeric("target_room_nights", {
      precision: 14,
      scale: 2,
    }).notNull(),
    targetRevenue: numeric("target_revenue", {
      precision: 16,
      scale: 2,
    }).notNull(),
    targetAdr: numeric("target_adr", { precision: 14, scale: 2 }).notNull(),
    stretchRoomNights: numeric("stretch_room_nights", {
      precision: 14,
      scale: 2,
    }).notNull(),
    stretchRevenue: numeric("stretch_revenue", {
      precision: 16,
      scale: 2,
    }).notNull(),
    stretchAdr: numeric("stretch_adr", { precision: 14, scale: 2 }).notNull(),
    baselineJson: jsonb("baseline_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    rationale: text("rationale"),
    status: text("status").notNull().default("draft"),
    sourceFingerprint: text("source_fingerprint").notNull(),
    lockedAt: timestamp("locked_at"),
    createdByUserId: varchar("created_by_user_id").references(
      () => tipsUsers.id,
      { onDelete: "set null" },
    ),
    updatedByUserId: varchar("updated_by_user_id").references(
      () => tipsUsers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_courtyard_sales_monthly_target_unique").on(
      table.hotelId,
      table.targetYear,
      table.targetMonth,
      table.segment,
    ),
    index("idx_courtyard_sales_monthly_target_period").on(
      table.hotelId,
      table.targetYear,
      table.targetMonth,
    ),
  ],
);

export const courtyardSalesDemandEvents = pgTable(
  "courtyard_sales_demand_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    hotelId: varchar("hotel_id")
      .notNull()
      .references(() => courtyardHotels.id, { onDelete: "cascade" }),
    eventName: text("event_name").notNull(),
    category: text("category").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    venue: text("venue"),
    city: text("city"),
    distanceMiles: numeric("distance_miles", { precision: 8, scale: 2 }),
    demandLevel: text("demand_level").notNull().default("medium"),
    opportunityTypesJson: jsonb("opportunity_types_json")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    targetRolesJson: jsonb("target_roles_json")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    recommendedAction: text("recommended_action"),
    bookingWindowDays: integer("booking_window_days"),
    sourceName: text("source_name"),
    sourceUrl: text("source_url"),
    evidenceStatus: text("evidence_status").notNull().default("manual"),
    confidence: text("confidence").notNull().default("medium"),
    sourceLastVerifiedAt: timestamp("source_last_verified_at"),
    createdByUserId: varchar("created_by_user_id").references(
      () => tipsUsers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_courtyard_sales_demand_period").on(
      table.hotelId,
      table.startDate,
    ),
  ],
);

export const courtyardSalesRegionalProspects = pgTable(
  "courtyard_sales_regional_prospects",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    hotelId: varchar("hotel_id")
      .notNull()
      .references(() => courtyardHotels.id, { onDelete: "cascade" }),
    companyName: text("company_name").notNull(),
    address: text("address"),
    city: text("city"),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    distanceMiles: numeric("distance_miles", { precision: 8, scale: 2 }),
    distanceBand: text("distance_band"),
    industry: text("industry"),
    website: text("website"),
    phone: text("phone"),
    evidenceClass: text("evidence_class").notNull().default("local_prospect"),
    sourceType: text("source_type").notNull().default("manual"),
    sourceId: text("source_id"),
    sourceUrl: text("source_url"),
    opportunitySignalsJson: jsonb("opportunity_signals_json")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    targetRolesJson: jsonb("target_roles_json")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    historicalAccountKey: text("historical_account_key"),
    historicalRoomNights: numeric("historical_room_nights", {
      precision: 14,
      scale: 2,
    }),
    historicalRevenue: numeric("historical_revenue", {
      precision: 16,
      scale: 2,
    }),
    opportunityScore: integer("opportunity_score").notNull().default(0),
    rationale: text("rationale"),
    status: text("status").notNull().default("new"),
    projectStatus: text("project_status"),
    estimatedStartDate: date("estimated_start_date"),
    estimatedCompletionDate: date("estimated_completion_date"),
    primeContractor: text("prime_contractor"),
    engineeringFirm: text("engineering_firm"),
    architect: text("architect"),
    projectManager: text("project_manager"),
    knownSubcontractorsJson: jsonb("known_subcontractors_json")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    demandTypesJson: jsonb("demand_types_json")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    notes: text("notes"),
    nextAction: text("next_action"),
    followUpDate: date("follow_up_date"),
    assignedUserId: varchar("assigned_user_id").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    lastVerifiedAt: timestamp("last_verified_at"),
    createdByUserId: varchar("created_by_user_id").references(
      () => tipsUsers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_courtyard_sales_regional_score").on(
      table.hotelId,
      table.opportunityScore,
    ),
    uniqueIndex("idx_courtyard_sales_regional_source").on(
      table.hotelId,
      table.sourceType,
      table.sourceId,
    ),
  ],
);

export const courtyardSalesTransitions = pgTable("courtyard_sales_transitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hotelId: varchar("hotel_id").notNull().references(() => courtyardHotels.id, { onDelete: "cascade" }),
  title: text("title").notNull(), departureDate: date("departure_date"), status: text("status").notNull().default("in_progress"),
  departingUserName: text("departing_user_name"), summary: text("summary"),
  departingSignedAt: timestamp("departing_signed_at"), managerAcceptedAt: timestamp("manager_accepted_at"),
  createdByUserId: varchar("created_by_user_id").references(() => tipsUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(), updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [index("idx_sales_transition_hotel").on(table.hotelId)]);

export const courtyardSalesTransitionItems = pgTable("courtyard_sales_transition_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transitionId: varchar("transition_id").notNull().references(() => courtyardSalesTransitions.id, { onDelete: "cascade" }),
  category: text("category").notNull(), title: text("title").notNull(), description: text("description"),
  status: text("status").notNull().default("not_started"), dueDate: date("due_date"), ownerName: text("owner_name"),
  url: text("url"), username: text("username"), vaultUrl: text("vault_url"), mfaOwner: text("mfa_owner"), recoveryContact: text("recovery_contact"),
  accountKey: text("account_key"), opportunityId: varchar("opportunity_id").references(() => courtyardSalesOpportunities.id, { onDelete: "set null" }),
  frequency: text("frequency"), confidential: boolean("confidential").notNull().default(false), metadataJson: jsonb("metadata_json"),
  createdByUserId: varchar("created_by_user_id").references(() => tipsUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(), updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [index("idx_sales_transition_items_transition").on(table.transitionId), index("idx_sales_transition_items_category").on(table.category)]);

export const courtyardSalesTransitionDocuments = pgTable("courtyard_sales_transition_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transitionId: varchar("transition_id").notNull().references(() => courtyardSalesTransitions.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(), mimeType: text("mime_type").notNull(), sizeBytes: integer("size_bytes").notNull(),
  category: text("category").notNull().default("other"), description: text("description"), confidential: boolean("confidential").notNull().default(false),
  contentBase64: text("content_base64").notNull(), uploadedByUserId: varchar("uploaded_by_user_id").references(() => tipsUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("idx_sales_transition_documents_transition").on(table.transitionId)]);

export const courtyardSalesTransitionShares = pgTable("courtyard_sales_transition_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transitionId: varchar("transition_id").notNull().references(() => courtyardSalesTransitions.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(), recipientName: text("recipient_name"), recipientEmail: text("recipient_email"),
  expiresAt: timestamp("expires_at").notNull(), allowDownloads: boolean("allow_downloads").notNull().default(false), revokedAt: timestamp("revoked_at"),
  lastAccessedAt: timestamp("last_accessed_at"), accessCount: integer("access_count").notNull().default(0),
  createdByUserId: varchar("created_by_user_id").references(() => tipsUsers.id, { onDelete: "set null" }), createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("idx_sales_transition_shares_transition").on(table.transitionId)]);

export const courtyardMeetingSpaces = pgTable("courtyard_meeting_spaces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`), hotelId: varchar("hotel_id").notNull().references(() => courtyardHotels.id, { onDelete: "cascade" }),
  name: text("name").notNull(), squareFeet: integer("square_feet").notNull().default(2000), active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(), updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [uniqueIndex("uniq_courtyard_meeting_space_name").on(table.hotelId, table.name)]);

export const courtyardMeetingEvents = pgTable("courtyard_meeting_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`), hotelId: varchar("hotel_id").notNull().references(() => courtyardHotels.id, { onDelete: "cascade" }),
  spaceId: varchar("space_id").notNull().references(() => courtyardMeetingSpaces.id, { onDelete: "restrict" }), groupName: text("group_name").notNull(), eventName: text("event_name").notNull(),
  eventDate: date("event_date").notNull(), setupStartTime: time("setup_start_time").notNull(), guestStartTime: time("guest_start_time").notNull(), guestEndTime: time("guest_end_time").notNull(), breakdownEndTime: time("breakdown_end_time").notNull(),
  status: text("status").notNull().default("inquiry"), holdExpiresAt: timestamp("hold_expires_at"), attendance: integer("attendance"), squareFeetRequired: integer("square_feet_required"), roomSetup: text("room_setup"), meetingRoom: text("meeting_room"), bookingSeriesId: varchar("booking_series_id"), bookingStartDate: date("booking_start_date"),
  salesOwner: text("sales_owner"), clientName: text("client_name"), clientEmail: text("client_email"), clientPhone: text("client_phone"), expectedRevenue: numeric("expected_revenue", { precision: 12, scale: 2 }), roomRentalRevenue: numeric("room_rental_revenue", { precision: 12, scale: 2 }), taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }), serviceFeePercent: numeric("service_fee_percent", { precision: 6, scale: 3 }), gratuityPercent: numeric("gratuity_percent", { precision: 6, scale: 3 }), avRevenue: numeric("av_revenue", { precision: 12, scale: 2 }), cateringRevenue: numeric("catering_revenue", { precision: 12, scale: 2 }), otherRevenue: numeric("other_revenue", { precision: 12, scale: 2 }), expectedRoomNights: integer("expected_room_nights"),
  cateringNotes: text("catering_notes"), avNotes: text("av_notes"), accessibilityNotes: text("accessibility_notes"), internalNotes: text("internal_notes"),
  accountKey: text("account_key"), opportunityId: varchar("opportunity_id").references(() => courtyardSalesOpportunities.id, { onDelete: "set null" }),
  conflictOverrideReason: text("conflict_override_reason"), createdByUserId: varchar("created_by_user_id").references(() => tipsUsers.id, { onDelete: "set null" }), updatedByUserId: varchar("updated_by_user_id").references(() => tipsUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(), updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [index("idx_courtyard_meeting_events_date").on(table.hotelId, table.eventDate), index("idx_courtyard_meeting_events_space").on(table.spaceId, table.eventDate), index("idx_courtyard_meeting_events_status").on(table.status)]);

export const courtyardMeetingEventDocuments = pgTable("courtyard_meeting_event_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`), eventId: varchar("event_id").notNull().references(() => courtyardMeetingEvents.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(), mimeType: text("mime_type").notNull(), sizeBytes: integer("size_bytes").notNull(), category: text("category").notNull().default("other"), contentBase64: text("content_base64").notNull(),
  uploadedByUserId: varchar("uploaded_by_user_id").references(() => tipsUsers.id, { onDelete: "set null" }), createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("idx_courtyard_meeting_documents_event").on(table.eventId)]);

export const courtyardMeetingCalendarShares = pgTable("courtyard_meeting_calendar_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`), hotelId: varchar("hotel_id").notNull().references(() => courtyardHotels.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(), recipientName: text("recipient_name"), rangeStart: date("range_start"), rangeEnd: date("range_end"), expiresAt: timestamp("expires_at").notNull(), revokedAt: timestamp("revoked_at"), accessCount: integer("access_count").notNull().default(0), lastAccessedAt: timestamp("last_accessed_at"),
  createdByUserId: varchar("created_by_user_id").references(() => tipsUsers.id, { onDelete: "set null" }), createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("idx_courtyard_meeting_shares_hotel").on(table.hotelId)]);

export const courtyardIncidentReports = pgTable(
  "courtyard_incident_reports",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    propertyId: text("property_id")
      .notNull()
      .default("courtyard-austin-lakeline"),
    incidentNumber: text("incident_number").notNull(),
    incidentDate: date("incident_date").notNull(),
    incidentTime: text("incident_time").notNull(),
    location: text("location").notNull(),
    category: text("category").notNull(),
    severity: text("severity").notNull().default("moderate"),
    status: text("status").notNull().default("open"),
    reportedByName: text("reported_by_name").notNull(),
    reportedByPosition: text("reported_by_position"),
    reportedByUserId: varchar("reported_by_user_id").references(
      () => tipsUsers.id,
      { onDelete: "set null" },
    ),
    peopleInvolved: text("people_involved"),
    guestRooms: text("guest_rooms"),
    witnesses: text("witnesses"),
    description: text("description").notNull(),
    immediateActions: text("immediate_actions").notNull(),
    injuries: text("injuries"),
    propertyDamage: text("property_damage"),
    vehicleDetails: text("vehicle_details"),
    emergencyServices: text("emergency_services"),
    policeReportNumber: text("police_report_number"),
    notifications: text("notifications"),
    followUpRequired: text("follow_up_required"),
    managerNotes: text("manager_notes"),
    payloadJson: jsonb("payload_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    emailSentAt: timestamp("email_sent_at"),
    emailError: text("email_error"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_courtyard_incident_number").on(table.incidentNumber),
    index("idx_courtyard_incident_date").on(table.incidentDate),
    index("idx_courtyard_incident_status").on(table.status),
  ],
);

export const courtyardIncidentEvidence = pgTable(
  "courtyard_incident_evidence",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    incidentId: varchar("incident_id")
      .notNull()
      .references(() => courtyardIncidentReports.id, { onDelete: "cascade" }),
    evidenceType: text("evidence_type").notNull(),
    storagePath: text("storage_path").notNull(),
    originalFileName: text("original_file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    durationSeconds: integer("duration_seconds"),
    uploadedBy: varchar("uploaded_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    uploadedAt: timestamp("uploaded_at").defaultNow(),
  },
  (table) => [
    index("idx_courtyard_incident_evidence_incident").on(table.incidentId),
  ],
);

export const courtyardIncidentShareLinks = pgTable(
  "courtyard_incident_share_links",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    incidentId: varchar("incident_id")
      .notNull()
      .references(() => courtyardIncidentReports.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    createdBy: varchar("created_by").references(() => tipsUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_courtyard_incident_share_token").on(table.tokenHash),
    index("idx_courtyard_incident_share_incident").on(table.incidentId),
  ],
);

export const vehicleListings = pgTable(
  "vehicle_listings",
  {
    id: varchar("id").primaryKey(),
    title: text("title").notNull(),
    year: integer("year").notNull(),
    make: text("make").notNull(),
    model: text("model").notNull(),
    trim: text("trim"),
    bodyStyle: text("body_style"),
    windshieldType: text("windshield_type"),
    transmission: text("transmission"),
    mileage: text("mileage"),
    vin: text("vin"),
    vinPublic: boolean("vin_public").notNull().default(false),
    location: text("location"),
    askingPrice: numeric("asking_price", { precision: 12, scale: 2 }),
    priceType: text("price_type").notNull().default("accepting_offers"),
    status: text("status").notNull().default("available"),
    story: text("story"),
    description: text("description"),
    conditionSummary: text("condition_summary"),
    knownIssues: text("known_issues"),
    specsJson: jsonb("specs_json"),
    marketValueRangesJson: jsonb("market_value_ranges_json"),
    aiValuationJson: jsonb("ai_valuation_json"),
    photosJson: jsonb("photos_json"),
    heroPhotoUrl: text("hero_photo_url"),
    sellerContactJson: jsonb("seller_contact_json"),
    aiListingDraftsJson: jsonb("ai_listing_drafts_json"),
    viewCount: integer("view_count").notNull().default(1530),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_vehicle_listings_status").on(table.status),
    index("idx_vehicle_listings_view_count").on(table.viewCount),
  ],
);

export const vehicleListingLeads = pgTable(
  "vehicle_listing_leads",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    listingId: varchar("listing_id")
      .notNull()
      .references(() => vehicleListings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    message: text("message"),
    interestType: text("interest_type").notNull().default("general_inquiry"),
    offerAmount: numeric("offer_amount", { precision: 12, scale: 2 }),
    preferredContactMethod: text("preferred_contact_method"),
    status: text("status").notNull().default("new"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_vehicle_listing_leads_listing").on(table.listingId),
    index("idx_vehicle_listing_leads_created").on(table.createdAt),
  ],
);

// Aircraft Listings (for rent)
export const aircraftListings = pgTable(
  "aircraft_listings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ownerId: varchar("owner_id")
      .notNull()
      .references(() => users.id),
    submissionKey: text("submission_key"),

    // Aircraft details
    make: text("make").notNull(),
    model: text("model").notNull(),
    year: integer("year").notNull(),
    registration: text("registration").notNull(),
    category: text("category").notNull(), // Single-Engine, Multi-Engine, etc.

    // Technical specs
    totalTime: integer("total_time").notNull(), // hours
    engine: text("engine"),
    avionicsSuite: text("avionics_suite"),

    // Required certifications
    requiredCertifications: text("required_certifications").array().notNull(),
    minFlightHours: integer("min_flight_hours").default(0),

    // Pricing
    hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull(),
    insuranceIncluded: boolean("insurance_included").default(true),
    wetRate: boolean("wet_rate").default(true), // includes fuel

    // Images
    images: text("images").array().notNull(),

    // Location (structured for filtering)
    location: text("location").notNull(), // Legacy field, keep for backward compatibility
    city: text("city"),
    state: text("state"),
    zipCode: text("zip_code"),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    airportCode: text("airport_code"),

    // Aircraft Specifications (for filtering)
    engineType: text("engine_type"), // Single-Engine, Multi-Engine, Turboprop, Jet
    engineCount: integer("engine_count"), // Number of engines
    seatingCapacity: integer("seating_capacity"), // Number of seats

    // Listing details
    description: text("description"),
    isListed: boolean("is_listed").default(true),
    viewCount: integer("view_count").default(0).notNull(),

    // Admin management
    adminNotes: text("admin_notes"),
    isFeatured: boolean("is_featured").default(false),

    // Owner metrics
    responseTime: integer("response_time_hours").default(24),
    acceptanceRate: integer("acceptance_rate").default(100),

    // Owner/Aircraft Verification
    serialNumber: text("serial_number"),
    registrationDocUrl: text("registration_doc_url"), // AC 8050-3 or 8050-64
    llcAuthorizationUrl: text("llc_authorization_url"), // If LLC owns aircraft
    ownershipVerified: boolean("ownership_verified").default(false),
    ownershipVerifiedAt: timestamp("ownership_verified_at"),
    registryCheckedAt: timestamp("registry_checked_at"),
    ownerNameMatch: boolean("owner_name_match"),

    // Maintenance & Inspections
    annualInspectionDocUrl: text("annual_inspection_doc_url"),
    annualInspectionDate: text("annual_inspection_date"), // YYYY-MM-DD
    annualDueDate: text("annual_due_date"), // YYYY-MM-DD (computed)
    annualSignerName: text("annual_signer_name"),
    annualSignerCertNumber: text("annual_signer_cert_number"),
    annualSignerIaNumber: text("annual_signer_ia_number"),
    annualApVerified: boolean("annual_ap_verified").default(false),

    // 100-Hour (if applicable)
    requires100Hour: boolean("requires_100_hour").default(false),
    hour100InspectionDocUrl: text("hour_100_inspection_doc_url"),
    hour100InspectionTach: integer("hour_100_inspection_tach"),
    currentTach: integer("current_tach"),
    hour100Remaining: integer("hour_100_remaining"), // computed

    // Maintenance Tracking (optional)
    maintenanceTrackingProvider: text("maintenance_tracking_provider"), // CAMP, Traxxall, etc.
    maintenanceTrackingDocUrl: text("maintenance_tracking_doc_url"),
    hasMaintenanceTracking: boolean("has_maintenance_tracking").default(false),

    // Verification Status
    maintenanceVerified: boolean("maintenance_verified").default(false),
    maintenanceVerifiedAt: timestamp("maintenance_verified_at"),

    // Stale listing tracking
    lastRefreshedAt: timestamp("last_refreshed_at").defaultNow(),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_aircraft_city").on(table.city),
    index("idx_aircraft_is_listed").on(table.isListed),
    index("idx_aircraft_category").on(table.category),
    uniqueIndex("uidx_aircraft_owner_submission_key").on(
      table.ownerId,
      table.submissionKey,
    ),
    index("idx_aircraft_engine_type").on(table.engineType),
    index("idx_aircraft_city_engine_type").on(table.city, table.engineType),
    index("idx_aircraft_category_city").on(table.category, table.city),
  ],
);

// Marketplace Listings
export const marketplaceListings = pgTable(
  "marketplace_listings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),

    category: text("category").notNull(), // aircraft-sale, charter, cfi, flight-school, mechanic, job
    tier: text("tier"), // basic, standard, premium (for aircraft sales)

    // Common fields
    title: text("title").notNull(),
    description: text("description").notNull(),
    images: text("images")
      .array()
      .default(sql`ARRAY[]::text[]`),

    // Location (structured for filtering)
    location: text("location"), // Legacy field for display
    city: text("city"),
    state: text("state"),
    zipCode: text("zip_code"),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),

    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    instagramUrl: text("instagram_url"),
    facebookUrl: text("facebook_url"),

    // Category-specific data (stored as JSON)
    details: jsonb("details"), // Contains category-specific fields

    // Pricing
    price: decimal("price", { precision: 12, scale: 2 }), // For sales, hourly rate, etc.

    // Listing management
    isActive: boolean("is_active").default(true),
    expiresAt: timestamp("expires_at"),

    // Expiration reminder tracking
    expirationReminderSent: boolean("expiration_reminder_sent").default(false),
    expirationReminderSentAt: timestamp("expiration_reminder_sent_at"),

    // Admin management
    adminNotes: text("admin_notes"),
    isFeatured: boolean("is_featured").default(false),
    isExample: boolean("is_example").default(false),

    // Fraud detection
    flagCount: integer("flag_count").default(0).notNull(),

    // Analytics
    viewCount: integer("view_count").default(0).notNull(),

    // Payment
    isPaid: boolean("is_paid").default(false),
    monthlyFee: decimal("monthly_fee", { precision: 10, scale: 2 }),

    // Upgrade transaction tracking (for replay attack prevention)
    upgradeTransactions: text("upgrade_transactions")
      .array()
      .default(sql`ARRAY[]::text[]`),

    // Promotional free period (admin customer service gesture)
    promoFreeUntil: timestamp("promo_free_until"),
    promoGrantedBy: varchar("promo_granted_by").references(() => users.id),
    promoGrantedAt: timestamp("promo_granted_at"),

    // Stale listing tracking
    lastRefreshedAt: timestamp("last_refreshed_at").defaultNow(),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_marketplace_category").on(table.category),
    index("idx_marketplace_city").on(table.city),
    index("idx_marketplace_is_active").on(table.isActive),
    index("idx_marketplace_category_city").on(table.category, table.city),
    index("idx_marketplace_category_active").on(table.category, table.isActive),
    index("idx_marketplace_flag_count").on(table.flagCount),
  ],
);

// Marketplace Flags (fraud reporting)
export const marketplaceFlags = pgTable(
  "marketplace_flags",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    listingId: varchar("listing_id")
      .notNull()
      .references(() => marketplaceListings.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),

    reason: text("reason"), // Optional reason for flagging

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // Unique constraint: one flag per user per listing
    uniqueIndex("idx_marketplace_flags_unique").on(
      table.listingId,
      table.userId,
    ),
  ],
);

// Job Applications (for marketplace job listings)
export const jobApplications = pgTable(
  "job_applications",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    listingId: varchar("listing_id")
      .notNull()
      .references(() => marketplaceListings.id, { onDelete: "cascade" }),
    applicantId: varchar("applicant_id").references(() => users.id), // null if not logged in

    // Applicant details
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    currentJobTitle: text("current_job_title"),
    yearsOfExperience: text("years_of_experience"),

    // Application content
    coverLetter: text("cover_letter"),
    resumeUrl: text("resume_url").notNull(),

    // Application status
    status: text("status").default("new").notNull(), // new, reviewed, shortlisted, rejected, contacted

    // Employer notes
    employerNotes: text("employer_notes"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_job_applications_listing").on(table.listingId),
    index("idx_job_applications_applicant").on(table.applicantId),
    index("idx_job_applications_status").on(table.status),
  ],
);

// Promotional Alerts (for admin-managed marketplace announcements)
export const promoAlerts = pgTable("promo_alerts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Alert details
  title: text("title").notNull(),
  message: text("message").notNull(),
  promoCode: text("promo_code"), // Optional promo code to display

  // Display settings
  isEnabled: boolean("is_enabled").default(true),
  showOnMainPage: boolean("show_on_main_page").default(true),
  showOnCategoryPages: boolean("show_on_category_pages").default(true),

  // Target categories (empty = all categories)
  targetCategories: text("target_categories")
    .array()
    .default(sql`ARRAY[]::text[]`),

  // Styling
  variant: text("variant").default("info"), // info, success, warning, destructive

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Aviation Events (community calendar)
export const aviationEvents = pgTable("aviation_events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull(),
  category: text("category").notNull(),
  eventUrl: text("event_url"),
  imageUrl: text("image_url"),
  createdBy: varchar("created_by").references(() => users.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isSample: boolean("is_sample").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Rentals
export const rentals = pgTable("rentals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  aircraftId: varchar("aircraft_id")
    .notNull()
    .references(() => aircraftListings.id),
  renterId: varchar("renter_id")
    .notNull()
    .references(() => users.id),
  ownerId: varchar("owner_id")
    .notNull()
    .references(() => users.id),

  // Rental details
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  estimatedHours: decimal("estimated_hours", {
    precision: 6,
    scale: 2,
  }).notNull(),
  actualHours: decimal("actual_hours", { precision: 6, scale: 2 }),

  // Pricing
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull(),
  baseCost: decimal("base_cost", { precision: 10, scale: 2 }).notNull(),
  salesTax: decimal("sales_tax", { precision: 10, scale: 2 }).notNull(), // 8.25% of baseCost
  platformFeeRenter: decimal("platform_fee_renter", {
    precision: 10,
    scale: 2,
  }).notNull(), // 7.5% of baseCost
  platformFeeOwner: decimal("platform_fee_owner", {
    precision: 10,
    scale: 2,
  }).notNull(), // 7.5% of baseCost
  processingFee: decimal("processing_fee", {
    precision: 10,
    scale: 2,
  }).notNull(), // 3% of subtotal
  totalCostRenter: decimal("total_cost_renter", {
    precision: 10,
    scale: 2,
  }).notNull(),
  ownerPayout: decimal("owner_payout", { precision: 10, scale: 2 }).notNull(),

  // Status
  status: text("status").notNull().default("pending"), // pending, approved, active, completed, cancelled

  // Payment
  isPaid: boolean("is_paid").default(false),
  payoutCompleted: boolean("payout_completed").default(false),
  // Hold period: earnings are not withdrawable until this timestamp passes (null = immediately available)
  payoutAvailableAt: timestamp("payout_available_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Messages (only during active rentals)
export const messages = pgTable("messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  rentalId: varchar("rental_id")
    .notNull()
    .references(() => rentals.id),
  senderId: varchar("sender_id")
    .notNull()
    .references(() => users.id),
  receiverId: varchar("receiver_id")
    .notNull()
    .references(() => users.id),

  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),

  createdAt: timestamp("created_at").defaultNow(),
});

// Reviews (post-rental ratings and feedback)
export const reviews = pgTable("reviews", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  rentalId: varchar("rental_id")
    .notNull()
    .references(() => rentals.id),
  reviewerId: varchar("reviewer_id")
    .notNull()
    .references(() => users.id), // Who wrote the review
  revieweeId: varchar("reviewee_id")
    .notNull()
    .references(() => users.id), // Who is being reviewed

  // Rating (1-5 stars)
  rating: integer("rating").notNull(), // 1-5

  // Optional comment
  comment: text("comment"),

  // Review categories (optional detailed ratings)
  communicationRating: integer("communication_rating"), // 1-5
  cleanlinessRating: integer("cleanliness_rating"), // 1-5 (for aircraft condition)
  accuracyRating: integer("accuracy_rating"), // 1-5 (listing accuracy)

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Favorites (saved listings for users)
export const favorites = pgTable(
  "favorites",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Type of listing favorited
    listingType: text("listing_type").notNull(), // "marketplace" or "aircraft"

    // ID of the favorited listing (polymorphic reference)
    listingId: varchar("listing_id").notNull(),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    idxFavoritesUser: index("idx_favorites_user").on(table.userId),
    idxFavoritesListing: index("idx_favorites_listing").on(
      table.listingType,
      table.listingId,
    ),
    // Unique constraint to ensure user can't favorite the same listing twice
    uniqueUserListing: uniqueIndex("idx_favorites_user_listing_unique").on(
      table.userId,
      table.listingType,
      table.listingId,
    ),
  }),
);

// Airport favorites (user-saved airports + alert preferences)
export const airportFavorites = pgTable(
  "airport_favorites",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    icao: text("icao").notNull(),
    name: text("name"),
    city: text("city"),
    state: text("state"),
    alertIfr: boolean("alert_ifr").default(false),
    alertMvfr: boolean("alert_mvfr").default(false),
    lastObservedCategory: text("last_observed_category"),
    lastObservedAt: timestamp("last_observed_at"),
    lastAlertCategory: text("last_alert_category"),
    lastAlertAt: timestamp("last_alert_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_airport_favorites_user").on(table.userId),
    index("idx_airport_favorites_icao").on(table.icao),
    uniqueIndex("uniq_airport_favorites_user_icao").on(
      table.userId,
      table.icao,
    ),
  ],
);

// Transactions (financial tracking)
export const transactions = pgTable("transactions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),

  type: text("type").notNull(), // rental_payout, listing_fee, platform_fee
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),

  // Related entities
  rentalId: varchar("rental_id").references(() => rentals.id),
  marketplaceListingId: varchar("marketplace_listing_id").references(
    () => marketplaceListings.id,
  ),

  // Status
  status: text("status").notNull().default("pending"), // pending, completed, failed
  depositedToBankAt: timestamp("deposited_to_bank_at"),

  description: text("description"),

  createdAt: timestamp("created_at").defaultNow(),
});

// Analytics Events (feature engagement tracking)
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    event: text("event").notNull(),
    page: text("page"),
    visitorId: text("visitor_id").notNull(),
    userId: varchar("user_id").references(() => users.id),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_analytics_events_created").on(table.createdAt),
    index("idx_analytics_events_event").on(table.event),
    index("idx_analytics_events_page").on(table.page),
    index("idx_analytics_events_visitor").on(table.visitorId),
  ],
);

// Partner Redirects (featured tool outbound tracking)
export const partnerRedirects = pgTable(
  "partner_redirects",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    partner: text("partner").notNull(),
    userId: varchar("user_id").references(() => users.id),
    sessionId: text("session_id"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_partner_redirects_partner").on(table.partner),
    index("idx_partner_redirects_user").on(table.userId),
    index("idx_partner_redirects_created").on(table.createdAt),
  ],
);

// Partner Tool Metrics (featured partner cards)
export const partnerToolMetrics = pgTable(
  "partner_tool_metrics",
  {
    partner: text("partner").primaryKey(),
    impressions: integer("impressions").default(0),
    clicks: integer("clicks").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_partner_tool_metrics_partner").on(table.partner)],
);

// NMS sync state (tracks lastUpdatedDate + initial load)
export const nmsSyncState = pgTable("nms_sync_state", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// NOTAMs (FAA SWIM ingestion)
export const notams = pgTable(
  "notams",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    icao: text("icao").notNull(),
    notamId: text("notam_id").notNull(),
    text: text("text").notNull(),
    effectiveAt: timestamp("effective_at"),
    expiresAt: timestamp("expires_at"),
    source: text("source").default("swim"),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_notams_unique").on(table.notamId),
    index("idx_notams_icao").on(table.icao),
  ],
);

export const notamIngestEvents = pgTable(
  "notam_ingest_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    source: text("source").default("SWIM_AIM_FNS"),
    messageId: text("message_id").notNull(),
    receivedAt: timestamp("received_at").defaultNow(),
    parsedNotamCount: integer("parsed_notam_count").notNull(),
    reason: text("reason").notNull(),
    missingFields: text("missing_fields")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    eventTypes: text("event_types")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    xmlByteLength: integer("xml_byte_length"),
    notamKeys: text("notam_keys")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    icaos: text("icaos")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    excerpt: text("excerpt"),
    details: jsonb("details"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_notam_ingest_message").on(table.messageId),
    index("idx_notam_ingest_reason").on(table.reason),
    index("idx_notam_ingest_created").on(table.createdAt),
  ],
);

// TFMS (Operational Intelligence)
export const tfmsEvents = pgTable(
  "tfms_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    type: text("type").notNull(),
    severity: text("severity").notNull(),
    depIcao: text("dep_icao"),
    destIcao: text("dest_icao"),
    corridorGeom: jsonb("corridor_geom"),
    effectiveStart: timestamp("effective_start"),
    effectiveEnd: timestamp("effective_end"),
    details: jsonb("details"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_tfms_events_dep").on(table.depIcao),
    index("idx_tfms_events_dest").on(table.destIcao),
    index("idx_tfms_events_effective").on(table.effectiveStart),
  ],
);

export const tfmsOverlays = pgTable(
  "tfms_overlays",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    bbox: text("bbox").notNull(),
    geojson: jsonb("geojson").notNull(),
    generatedAt: timestamp("generated_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_tfms_overlays_bbox").on(table.bbox),
    index("idx_tfms_overlays_generated").on(table.generatedAt),
  ],
);

// PayPal Order Consumption (replay protection)
export const paypalOrderConsumptions = pgTable(
  "paypal_order_consumptions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orderId: text("order_id").notNull(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    purpose: text("purpose").notNull(), // rental_payment, marketplace_listing_fee, marketplace_upgrade_fee, etc.
    resourceType: text("resource_type"), // rental, listing, etc.
    resourceId: text("resource_id"),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: text("currency").default("USD"),
    status: text("status").default("consumed"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_paypal_order_consumptions_order").on(table.orderId),
    index("idx_paypal_order_consumptions_user").on(table.userId),
  ],
);

// Withdrawal Requests (PayPal Payouts for aircraft owners)
export const withdrawalRequests = pgTable(
  "withdrawal_requests",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),

    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    paypalEmail: text("paypal_email").notNull(),

    // Status tracking
    status: text("status").notNull().default("pending"), // pending, processing, completed, failed, cancelled

    // PayPal Payouts tracking
    payoutBatchId: text("payout_batch_id"), // PayPal batch ID
    payoutItemId: text("payout_item_id"), // PayPal item ID
    transactionId: text("transaction_id"), // PayPal transaction ID when completed

    // Processing
    processedAt: timestamp("processed_at"),
    processedBy: varchar("processed_by").references(() => users.id), // Admin who processed

    // Error handling
    failureReason: text("failure_reason"),

    // Admin notes
    adminNotes: text("admin_notes"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_withdrawal_user").on(table.userId),
    index("idx_withdrawal_status").on(table.status),
  ],
);

// Promo Codes (for free/discounted listings)
export const promoCodes = pgTable("promo_codes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),

  // Promo details
  description: text("description"),
  discountType: text("discount_type").notNull(), // "free_7_day", "percentage", "fixed_amount", "waive_creation_fee"
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }), // For percentage or fixed amount

  // Usage limits
  maxUses: integer("max_uses"), // null = unlimited
  usedCount: integer("used_count").default(0),

  // Validity
  isActive: boolean("is_active").default(true),
  validFrom: timestamp("valid_from").defaultNow(),
  validUntil: timestamp("valid_until"),

  // Restrictions - applies to marketplace, banner_ads, or both
  applicableToMarketplace: boolean("applicable_to_marketplace").default(true),
  applicableToBannerAds: boolean("applicable_to_banner_ads").default(false),
  applicableCategories: text("applicable_categories")
    .array()
    .default(sql`ARRAY[]::text[]`), // empty = all categories

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Promo Code Usage Tracking
export const promoCodeUsages = pgTable("promo_code_usages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  promoCodeId: varchar("promo_code_id")
    .notNull()
    .references(() => promoCodes.id),
  userId: varchar("user_id").references(() => users.id), // Optional - can be null for public banner ad orders
  marketplaceListingId: varchar("marketplace_listing_id").references(
    () => marketplaceListings.id,
  ),
  bannerAdOrderId: varchar("banner_ad_order_id").references(
    () => bannerAdOrders.id,
  ),

  createdAt: timestamp("created_at").defaultNow(),
});

export const membershipPartnerOffers = pgTable(
  "membership_partner_offers",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    partnerName: text("partner_name").notNull(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    description: text("description"),
    tier: text("tier").notNull().default("premium"), // premium; legacy pro/pro_plus normalize to premium
    durationDays: integer("duration_days").notNull().default(90),
    isActive: boolean("is_active").default(true),
    createdBy: varchar("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_membership_partner_offers_active").on(table.isActive),
    index("idx_membership_partner_offers_partner").on(table.partnerName),
  ],
);

export const membershipPartnerOfferMembers = pgTable(
  "membership_partner_offer_members",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    offerId: varchar("offer_id")
      .notNull()
      .references(() => membershipPartnerOffers.id, { onDelete: "cascade" }),
    memberNumber: text("member_number").notNull(),
    normalizedMemberNumber: varchar("normalized_member_number", {
      length: 120,
    }).notNull(),
    redeemedByUserId: varchar("redeemed_by_user_id").references(() => users.id),
    redeemedAt: timestamp("redeemed_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_membership_partner_offer_members_unique").on(
      table.offerId,
      table.normalizedMemberNumber,
    ),
    index("idx_membership_partner_offer_members_offer").on(table.offerId),
    index("idx_membership_partner_offer_members_redeemed_by").on(
      table.redeemedByUserId,
    ),
  ],
);

export const membershipPromotions = pgTable(
  "membership_promotions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    code: varchar("code", { length: 120 }).notNull().unique(),
    normalizedCode: varchar("normalized_code", { length: 120 })
      .notNull()
      .unique(),
    name: text("name").notNull(),
    description: text("description"),
    campaign: text("campaign"),
    partnerName: text("partner_name"),
    source: text("source"),
    benefitType: text("benefit_type")
      .notNull()
      .default("complimentary_membership"),
    membershipTier: text("membership_tier").notNull().default("premium"),
    membershipDurationMonths: integer("membership_duration_months")
      .notNull()
      .default(12),
    maxTotalRedemptions: integer("max_total_redemptions"),
    maxRedemptionsPerUser: integer("max_redemptions_per_user")
      .notNull()
      .default(1),
    redemptionCount: integer("redemption_count").notNull().default(0),
    validFrom: timestamp("valid_from").defaultNow(),
    expiresAt: timestamp("expires_at"),
    isActive: boolean("is_active").notNull().default(true),
    successMessage: text("success_message"),
    createdBy: varchar("created_by").references(() => users.id),
    updatedBy: varchar("updated_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_membership_promotions_active").on(table.isActive),
    index("idx_membership_promotions_campaign").on(table.campaign),
    index("idx_membership_promotions_expires").on(table.expiresAt),
  ],
);

export const membershipPromotionRedemptions = pgTable(
  "membership_promotion_redemptions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    promotionId: varchar("promotion_id")
      .notNull()
      .references(() => membershipPromotions.id),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    normalizedCode: varchar("normalized_code", { length: 120 }).notNull(),
    redeemedAt: timestamp("redeemed_at").defaultNow().notNull(),
    membershipTierGranted: text("membership_tier_granted").notNull(),
    membershipStartsAt: timestamp("membership_starts_at").notNull(),
    membershipEndsAt: timestamp("membership_ends_at").notNull(),
    previousMembershipTier: text("previous_membership_tier"),
    previousMembershipExpiresAt: timestamp("previous_membership_expires_at"),
    registrationSessionId: text("registration_session_id"),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgentSummary: text("user_agent_summary"),
  },
  (table) => [
    uniqueIndex("idx_membership_promotion_redemptions_unique_user").on(
      table.promotionId,
      table.userId,
    ),
    index("idx_membership_promotion_redemptions_promotion").on(
      table.promotionId,
    ),
    index("idx_membership_promotion_redemptions_user").on(table.userId),
  ],
);

export const aiToolUsages = pgTable(
  "ai_tool_usages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id").references(() => users.id),
    anonId: varchar("anon_id", { length: 64 }),
    toolType: varchar("tool_type", { length: 50 }).notNull(),
    ipHash: varchar("ip_hash", { length: 64 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_ai_tool_usages_user_tool").on(table.userId, table.toolType),
    index("idx_ai_tool_usages_anon_tool").on(table.anonId, table.toolType),
    index("idx_ai_tool_usages_created_at").on(table.createdAt),
  ],
);

// Expenses (for admin analytics tracking)
export const expenses = pgTable("expenses", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  category: text("category").notNull(), // server, database, storage, api, other
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),

  // Invoice document upload (optional)
  invoiceUrl: text("invoice_url"),

  // Date when expense was incurred (for time-based analytics)
  expenseDate: timestamp("expense_date").notNull().defaultNow(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const personalFinanceEntries = pgTable(
  "personal_finance_entries",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    owner: text("owner").notNull(), // "cory" | "amy" | "joint"
    month: text("month").notNull(), // YYYY-MM
    type: text("type").notNull(), // "expense" | "income"
    category: text("category").notNull(),
    rsfCategory: text("rsf_category"),
    subcategory: text("subcategory"),
    description: text("description"),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    dueDate: date("due_date"),
    isPaid: boolean("is_paid").default(false),
    paidDate: date("paid_date"),
    isRecurring: boolean("is_recurring").default(false),
    recurringFrequency: text("recurring_frequency"),
    recurringDayOfMonth: integer("recurring_day_of_month"),
    recurringDayOfWeek: integer("recurring_day_of_week"),
    recurringIntervalDays: integer("recurring_interval_days"),
    notifyDaysBefore: integer("notify_days_before").default(3),
    notificationSent: boolean("notification_sent").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_personal_finance_entries_month").on(table.month),
    index("idx_personal_finance_entries_owner").on(table.owner),
    index("idx_personal_finance_entries_type").on(table.type),
    index("idx_personal_finance_entries_due_date").on(table.dueDate),
    index("idx_personal_finance_entries_unpaid_due").on(
      table.isPaid,
      table.dueDate,
    ),
  ],
);

export const personalFinanceBudgets = pgTable(
  "personal_finance_budgets",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    month: text("month").notNull(), // YYYY-MM
    category: text("category").notNull(),
    owner: text("owner").notNull(), // "cory" | "amy" | "joint"
    budgetAmount: decimal("budget_amount", {
      precision: 10,
      scale: 2,
    }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_personal_finance_budgets_unique").on(
      table.month,
      table.category,
      table.owner,
    ),
    index("idx_personal_finance_budgets_month").on(table.month),
    index("idx_personal_finance_budgets_owner").on(table.owner),
  ],
);

// Admin Notifications (for threshold alerts)
export const adminNotifications = pgTable("admin_notifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  type: text("type").notNull(), // listing_threshold, verification_pending, flagged_listing, etc.
  category: text("category"), // marketplace category for listing_threshold notifications
  title: text("title").notNull(),
  message: text("message").notNull(),

  // Status
  isRead: boolean("is_read").default(false),
  isActionable: boolean("is_actionable").default(true), // false once admin addresses it

  // Metadata
  listingCount: integer("listing_count"), // For threshold notifications
  threshold: integer("threshold"), // The threshold that was reached

  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

// Contact Form Submissions (for audit trail and abuse protection)
export const contactSubmissions = pgTable(
  "contact_submissions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),

    // Abuse tracking
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    // Email delivery tracking
    emailSent: boolean("email_sent").default(false),
    emailSentAt: timestamp("email_sent_at"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_contact_email").on(table.email),
    index("idx_contact_created").on(table.createdAt),
    index("idx_contact_ip").on(table.ipAddress),
  ],
);

export type ContactSubmission = typeof contactSubmissions.$inferSelect;
export const insertContactSubmissionSchema = createInsertSchema(
  contactSubmissions,
).omit({
  id: true,
  emailSent: true,
  emailSentAt: true,
  createdAt: true,
});
export type InsertContactSubmission = z.infer<
  typeof insertContactSubmissionSchema
>;

export const investorDeckAccessLogs = pgTable(
  "investor_deck_access_logs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    pagePath: text("page_path").notNull(),
    termsVersion: text("terms_version").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_investor_deck_access_created").on(table.createdAt),
    index("idx_investor_deck_access_ip").on(table.ipAddress),
    index("idx_investor_deck_access_user").on(table.userId),
  ],
);

export type InvestorDeckAccessLog = typeof investorDeckAccessLogs.$inferSelect;
export const insertInvestorDeckAccessLogSchema = createInsertSchema(
  investorDeckAccessLogs,
).omit({
  id: true,
  createdAt: true,
});
export type InsertInvestorDeckAccessLog = z.infer<
  typeof insertInvestorDeckAccessLogSchema
>;

// Banner Ad Order Status Enums
export const BANNER_APPROVAL_STATUSES = [
  "draft",
  "sent",
  "pending_review",
  "approved",
  "rejected",
] as const;
export type BannerApprovalStatus = (typeof BANNER_APPROVAL_STATUSES)[number];

export const BANNER_PAYMENT_STATUSES = [
  "pending",
  "paid",
  "refunded",
  "comped",
] as const;
export type BannerPaymentStatus = (typeof BANNER_PAYMENT_STATUSES)[number];

export const BANNER_VIDEO_ORIENTATIONS = ["landscape", "portrait"] as const;
export type BannerVideoOrientation = (typeof BANNER_VIDEO_ORIENTATIONS)[number];

// Banner Ad Orders (sponsor requests before going live)
export const bannerAdOrders = pgTable(
  "banner_ad_orders",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Sponsor information
    sponsorName: text("sponsor_name").notNull(),
    sponsorEmail: text("sponsor_email").notNull(),
    sponsorCompany: text("sponsor_company"),

    // Creative content (admin creates based on sponsor specs)
    title: text("title").notNull(),
    description: text("description"), // Tagline
    adCopy: text("ad_copy"), // Longer description/body copy
    imageUrl: text("image_url"), // Created by admin, uploaded to object storage
    videoUrl: text("video_url"),
    videoMuted: boolean("video_muted").default(true),
    videoOrientation: text("video_orientation").default("landscape"),
    link: text("link").notNull(), // Sponsor's website

    // Placement preferences
    placements: text("placements")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    category: text("category"),

    // Pricing tier selected (1month, 3months, 6months, 12months)
    tier: text("tier").notNull(),
    monthlyRate: decimal("monthly_rate", { precision: 10, scale: 2 }).notNull(), // Snapshot of pricing
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(), // Total subscription cost
    creationFee: decimal("creation_fee", { precision: 10, scale: 2 }).default(
      "40.00",
    ), // One-time ad creation fee
    grandTotal: decimal("grand_total", { precision: 10, scale: 2 }).notNull(), // totalAmount + creationFee

    // Promo code and discounts
    promoCode: text("promo_code"), // Applied promo code (e.g., LAUNCH2025)
    discountAmount: decimal("discount_amount", {
      precision: 10,
      scale: 2,
    }).default("0.00"), // Total discount applied

    // Workflow status
    approvalStatus: text("approval_status").notNull().default("draft"), // draft, sent, pending_review, approved, rejected
    paymentStatus: text("payment_status").notNull().default("pending"), // pending, paid, refunded, comped

    // PayPal payment tracking
    paypalOrderId: text("paypal_order_id"),
    paypalPaymentDate: timestamp("paypal_payment_date"),

    // Campaign scheduling (after payment)
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),

    // Expiration reminder tracking
    expirationReminderSent: boolean("expiration_reminder_sent").default(false),
    expirationReminderSentAt: timestamp("expiration_reminder_sent_at"),

    // Admin notes
    adminNotes: text("admin_notes"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_banner_orders_status").on(
      table.approvalStatus,
      table.paymentStatus,
    ),
    index("idx_banner_orders_email").on(table.sponsorEmail),
  ],
);

// Banner Ads (live campaigns only)
export const bannerAds = pgTable(
  "banner_ads",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Link to originating order
    orderId: varchar("order_id").references(() => bannerAdOrders.id),

    // Content (copied from approved order)
    title: text("title").notNull(),
    description: text("description"), // Optional tagline/description
    adCopy: text("ad_copy"), // Longer description/body copy
    imageUrl: text("image_url").notNull(), // Stored in object storage
    videoUrl: text("video_url"),
    videoMuted: boolean("video_muted").default(true),
    videoOrientation: text("video_orientation").default("landscape"),
    link: text("link").notNull(), // Clickable link to sponsor's website
    instagramUrl: text("instagram_url"),
    facebookUrl: text("facebook_url"),

    // Placement - can show on multiple pages
    placements: text("placements")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`), // Array of: homepage, marketplace, rentals, etc.
    category: text("category"), // For category-specific placements (marketplace categories)

    // Linked listing (optional - for promoting specific listings)
    listingId: varchar("listing_id"),
    listingType: text("listing_type"), // marketplace or rental

    // Scheduling
    isActive: boolean("is_active").default(true),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date"), // Set based on tier duration

    // Analytics
    impressions: integer("impressions").default(0),
    clicks: integer("clicks").default(0),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_banner_ads_placements").on(table.placements),
    index("idx_banner_ads_active").on(table.isActive),
    index("idx_banner_ads_dates").on(table.startDate, table.endDate),
    index("idx_banner_ads_order").on(table.orderId),
  ],
);

// Verification Submissions (admin review queue)
export const verificationSubmissions = pgTable("verification_submissions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),

  // Type of verification
  type: text("type").notNull(), // renter_identity, renter_payment, renter_pilot, owner_aircraft, owner_maintenance
  status: text("status").notNull().default("pending"), // pending, approved, rejected

  // Related entity (for owner verifications)
  aircraftId: varchar("aircraft_id").references(() => aircraftListings.id),

  // Submission data (stored as JSON for flexibility)
  submissionData: jsonb("submission_data").notNull(),

  // Documents uploaded with this submission
  documentUrls: text("document_urls")
    .array()
    .default(sql`ARRAY[]::text[]`),

  // Admin review
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  rejectionReason: text("rejection_reason"),

  // FAA registry verification results
  faaRegistryChecked: boolean("faa_registry_checked").default(false),
  faaRegistryMatch: boolean("faa_registry_match"),
  faaRegistryData: jsonb("faa_registry_data"),

  // Audit trail
  sources: text("sources")
    .array()
    .default(sql`ARRAY[]::text[]`), // e.g., ["FAA Aircraft Registry", "FAA Airmen Database"]
  fileHashes: text("file_hashes")
    .array()
    .default(sql`ARRAY[]::text[]`), // SHA-256 hashes of uploaded files

  // Document expiration tracking
  pilotLicenseExpiresAt: timestamp("pilot_license_expires_at"),
  medicalCertExpiresAt: timestamp("medical_cert_expires_at"),
  insuranceExpiresAt: timestamp("insurance_expires_at"),
  governmentIdExpiresAt: timestamp("government_id_expires_at"),

  // Expiration notifications
  expirationNotificationSent: boolean("expiration_notification_sent").default(
    false,
  ),
  lastNotificationSentAt: timestamp("last_notification_sent_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CRM Tables (Sales & Marketing)
export const crmLeads = pgTable("crm_leads", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Contact information
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: varchar("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  title: text("title"),

  // Lead details
  status: text("status").notNull().default("new"),
  source: text("source"),
  category: text("category").notNull().default("other"),
  value: decimal("value", { precision: 10, scale: 2 }),

  // Ownership & tracking
  assignedTo: varchar("assigned_to").references(() => users.id),

  // Additional context
  notes: text("notes"),
  tags: text("tags")
    .array()
    .default(sql`ARRAY[]::text[]`),
  emailUnsubscribed: boolean("email_unsubscribed").default(false),
  emailUnsubscribedAt: timestamp("email_unsubscribed_at"),
  emailSuppressionReason: text("email_suppression_reason"),
  emailPreferences: jsonb("email_preferences").$type<Record<string, boolean>>(),
  marketingEmailOptOutAt: timestamp("marketing_email_opt_out_at"),
  salesEmailLastSentAt: timestamp("sales_email_last_sent_at"),

  // Conversion tracking
  convertedToContactId: varchar("converted_to_contact_id"),
  convertedToDealId: varchar("converted_to_deal_id"),
  convertedAt: timestamp("converted_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const crmContacts = pgTable("crm_contacts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Contact information
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: varchar("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  title: text("title"),

  // Optional user linkage (if they registered)
  userId: varchar("user_id").references(() => users.id),

  // Ownership & tracking
  assignedTo: varchar("assigned_to").references(() => users.id),

  // Context
  notes: text("notes"),
  tags: text("tags")
    .array()
    .default(sql`ARRAY[]::text[]`),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const crmDeals = pgTable("crm_deals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Deal information
  name: text("name").notNull(),
  stage: text("stage").notNull().default("lead"),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  probability: integer("probability").default(50),

  // Related entities
  contactId: varchar("contact_id").references(() => crmContacts.id),
  assignedTo: varchar("assigned_to").references(() => users.id),

  // Timing
  expectedCloseDate: timestamp("expected_close_date"),
  closedDate: timestamp("closed_date"),

  // Context
  description: text("description"),
  notes: text("notes"),
  tags: text("tags")
    .array()
    .default(sql`ARRAY[]::text[]`),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const crmActivities = pgTable("crm_activities", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Activity details
  type: text("type").notNull(),
  subject: text("subject").notNull(),
  description: text("description"),

  // Related entities
  leadId: varchar("lead_id").references(() => crmLeads.id),
  contactId: varchar("contact_id").references(() => crmContacts.id),
  dealId: varchar("deal_id").references(() => crmDeals.id),

  // Ownership
  createdBy: varchar("created_by")
    .notNull()
    .references(() => users.id),
  assignedTo: varchar("assigned_to").references(() => users.id),

  // Timing
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  isCompleted: boolean("is_completed").default(false),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const crmWeeklyReports = pgTable("crm_weekly_reports", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Reporting window
  weekStart: date("week_start").notNull(),
  weekEnd: date("week_end").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),

  // Ownership / recipients
  preparedBy: varchar("prepared_by")
    .notNull()
    .references(() => users.id),
  recipientName: text("recipient_name"),
  recipientRole: text("recipient_role"),

  // Numeric workflow metrics
  newLeadsAdded: integer("new_leads_added").default(0),
  leadsWorked: integer("leads_worked").default(0),
  outreachEmailsSent: integer("outreach_emails_sent").default(0),
  followUpsSent: integer("follow_ups_sent").default(0),
  callsCompleted: integer("calls_completed").default(0),
  meetingsBooked: integer("meetings_booked").default(0),
  proposalsSent: integer("proposals_sent").default(0),
  dealsAdvanced: integer("deals_advanced").default(0),
  closedWonCount: integer("closed_won_count").default(0),
  estimatedPipelineValue: decimal("estimated_pipeline_value", {
    precision: 10,
    scale: 2,
  }),

  // Narrative sections for leadership reporting
  executiveSummary: text("executive_summary"),
  wins: text("wins"),
  pipelineUpdates: text("pipeline_updates"),
  blockers: text("blockers"),
  nextWeekFocus: text("next_week_focus"),
  supportNeeded: text("support_needed"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    certifications: z.array(z.enum(certificationTypes)).default([]),
    totalFlightHours: z.number().min(0).default(0),
  });

export const insertTipsUserSchema = createInsertSchema(tipsUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTipEntrySchema = createInsertSchema(tipEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTipEntryAttachmentSchema = createInsertSchema(
  tipEntryAttachments,
).omit({
  id: true,
  uploadedAt: true,
});

export const insertTipDailyReportAttachmentSchema = createInsertSchema(
  tipDailyReportAttachments,
).omit({
  id: true,
  uploadedAt: true,
});

export const insertTipGridSubmissionSchema = createInsertSchema(
  tipGridSubmissions,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTipGridDaySummarySchema = createInsertSchema(
  tipGridDaySummaries,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTipBanquetReportSchema = createInsertSchema(
  tipBanquetReports,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTipsKioskSettingSchema =
  createInsertSchema(tipsKioskSettings);

export const insertTipPeriodSubmissionSchema = createInsertSchema(
  tipPeriodSubmissions,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTipAdminActionSchema = createInsertSchema(
  tipAdminActions,
).omit({
  id: true,
  createdAt: true,
});

export const insertScheduleEmployeeSchema = createInsertSchema(
  scheduleEmployees,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScheduleShiftTypeSchema = createInsertSchema(
  scheduleShiftTypes,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWeeklyScheduleSchema = createInsertSchema(
  weeklySchedules,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScheduleForecastDaySchema = createInsertSchema(
  scheduleForecastDays,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScheduleShiftAssignmentSchema = createInsertSchema(
  scheduleShiftAssignments,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScheduleTemplateSchema = createInsertSchema(
  scheduleTemplates,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScheduleTemplateShiftSchema = createInsertSchema(
  scheduleTemplateShifts,
).omit({
  id: true,
  createdAt: true,
});

export const insertScheduleShareLinkSchema = createInsertSchema(
  scheduleShareLinks,
).omit({
  id: true,
  createdAt: true,
});

export const insertScheduleRequestSchema = createInsertSchema(
  scheduleRequests,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScheduleHousekeepingBoardSchema = createInsertSchema(
  scheduleHousekeepingBoards,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScheduleAuditLogSchema = createInsertSchema(
  scheduleAuditLog,
).omit({
  id: true,
  createdAt: true,
});

export const insertCourtyardBudgetUploadSchema = createInsertSchema(
  courtyardBudgetUploads,
).omit({
  id: true,
  uploadedAt: true,
});

export const insertCourtyardBudgetLineItemSchema = createInsertSchema(
  courtyardBudgetLineItems,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCourtyardBudgetCheckbookEntrySchema = createInsertSchema(
  courtyardBudgetCheckbookEntries,
).omit({
  id: true,
  createdAt: true,
});

export const insertCourtyardBudgetAuditLogSchema = createInsertSchema(
  courtyardBudgetAuditLog,
).omit({
  id: true,
  createdAt: true,
});

export const insertAdminInviteSchema = createInsertSchema(adminInvites).omit({
  id: true,
  createdAt: true,
  acceptedAt: true,
});

export const insertRefreshTokenSchema = createInsertSchema(refreshTokens).omit({
  id: true,
  createdAt: true,
});

export const insertOAuthExchangeTokenSchema = createInsertSchema(
  oauthExchangeTokens,
).omit({
  id: true,
  createdAt: true,
});

export const insertAircraftListingSchema = createInsertSchema(aircraftListings)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    viewCount: true,
  })
  .extend({
    year: z
      .number()
      .min(1900)
      .max(new Date().getFullYear() + 1),
    totalTime: z.number().min(0),
    hourlyRate: z.string().regex(/^\d+(\.\d{1,2})?$/),
    requiredCertifications: z.array(z.string()).min(1),
    images: z.array(z.string()).min(1).max(15),
    engineType: z.enum(engineTypes).optional(),
    engineCount: z.number().min(1).max(8).optional(),
    seatingCapacity: z.number().min(1).max(20).optional(),
    latitude: z
      .string()
      .regex(/^-?\d+(\.\d+)?$/)
      .optional(),
    longitude: z
      .string()
      .regex(/^-?\d+(\.\d+)?$/)
      .optional(),
  });

export const insertMarketplaceListingSchema = createInsertSchema(
  marketplaceListings,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    flagCount: true, // Managed by the system
    viewCount: true, // Managed by the system
  })
  .extend({
    category: z.enum(marketplaceCategories),
    images: z.array(z.string()).max(15),
    price: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .optional(),
    monthlyFee: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .optional(),
    instagramUrl: z.string().max(240).optional().or(z.literal("")),
    facebookUrl: z.string().max(240).optional().or(z.literal("")),
    latitude: z
      .string()
      .regex(/^-?\d+(\.\d+)?$/)
      .optional(),
    longitude: z
      .string()
      .regex(/^-?\d+(\.\d+)?$/)
      .optional(),
  });

export const logbookEntries = pgTable(
  "logbook_entries",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    flightDate: date("flight_date").notNull(),
    tailNumber: text("tail_number"),
    aircraftType: text("aircraft_type"),
    aircraftCategory: text("aircraft_category"),
    aircraftClass: text("aircraft_class"),
    isSimulator: boolean("is_simulator").default(false).notNull(),
    deviceType: text("device_type"),
    route: text("route"),
    timeDay: decimal("time_day", { precision: 6, scale: 2 })
      .default(sql`0`)
      .notNull(),
    timeNight: decimal("time_night", { precision: 6, scale: 2 })
      .default(sql`0`)
      .notNull(),
    pic: decimal("pic", { precision: 6, scale: 2 })
      .default(sql`0`)
      .notNull(),
    sic: decimal("sic", { precision: 6, scale: 2 })
      .default(sql`0`)
      .notNull(),
    dual: decimal("dual", { precision: 6, scale: 2 })
      .default(sql`0`)
      .notNull(),
    solo: decimal("solo", { precision: 6, scale: 2 })
      .default(sql`0`)
      .notNull(),
    crossCountry: decimal("cross_country", { precision: 6, scale: 2 })
      .default(sql`0`)
      .notNull(),
    instrumentActual: decimal("instrument_actual", { precision: 6, scale: 2 })
      .default(sql`0`)
      .notNull(),
    approaches: integer("approaches").default(0).notNull(),
    landingsDay: integer("landings_day").default(0).notNull(),
    landingsNight: integer("landings_night").default(0).notNull(),
    holds: integer("holds").default(0).notNull(),
    remarks: text("remarks"),
    maneuvers: jsonb("maneuvers"),
    hobbsStart: decimal("hobbs_start", { precision: 8, scale: 1 }),
    hobbsEnd: decimal("hobbs_end", { precision: 8, scale: 1 }),
    signatureDataUrl: text("signature_data_url"),
    signedByName: text("signed_by_name"),
    signedAt: timestamp("signed_at"),
    signatureIp: text("signature_ip"),
    // Optional second signature (e.g., CFI)
    cfiSignatureDataUrl: text("cfi_signature_data_url"),
    cfiSignedByName: text("cfi_signed_by_name"),
    cfiSignedAt: timestamp("cfi_signed_at"),
    cfiSignatureIp: text("cfi_signature_ip"),
    cfiCertNumber: text("cfi_cert_number"),
    cfiCertExpires: date("cfi_cert_expires"),
    isLocked: boolean("is_locked").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_logbook_user").on(table.userId),
    index("idx_logbook_date").on(table.flightDate),
  ],
);

export const logbookProSettings = pgTable(
  "logbook_pro_settings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    medicalClass: text("medical_class"),
    medicalIssuedAt: date("medical_issued_at"),
    medicalExpiresAt: date("medical_expires_at"),
    flightReviewDate: date("flight_review_date"),
    ipcDate: date("ipc_date"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_logbook_pro_settings_user").on(table.userId),
    index("idx_logbook_pro_settings_user").on(table.userId),
  ],
);

// Logbook archives (scanned paper logbooks)
export const logbookArchives = pgTable(
  "logbook_archives",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileSizeBytes: integer("file_size_bytes"),
    storageProvider: text("storage_provider").notNull().default("object"),
    storagePath: text("storage_path").notNull(),
    pageCount: integer("page_count"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_logbook_archives_user").on(table.userId),
    index("idx_logbook_archives_created").on(table.createdAt),
  ],
);

// Notification Preferences (per user)
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emailEnabled: boolean("email_enabled").default(true),
    pushEnabled: boolean("push_enabled").default(true),
    inAppEnabled: boolean("in_app_enabled").default(true),
    alertDaysBefore: integer("alert_days_before").default(30),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_notification_preferences_user").on(table.userId),
    index("idx_notification_preferences_user").on(table.userId),
  ],
);

export const cfiSchools = pgTable(
  "cfi_schools",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ownerUserId: varchar("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    locationCity: text("location_city"),
    locationState: text("location_state"),
    airportHome: text("airport_home"),
    website: text("website"),
    phone: text("phone"),
    logoUrl: text("logo_url"),
    isPublished: boolean("is_published").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_cfi_schools_slug").on(table.slug),
    index("idx_cfi_schools_owner").on(table.ownerUserId),
  ],
);

export const cfiSchoolMembers = pgTable(
  "cfi_school_members",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    schoolId: varchar("school_id")
      .notNull()
      .references(() => cfiSchools.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("instructor"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_cfi_school_members").on(table.schoolId, table.userId),
    index("idx_cfi_school_members_school").on(table.schoolId),
    index("idx_cfi_school_members_user").on(table.userId),
  ],
);

// CFI Profiles (public instructor directory)
export const cfiProfiles = pgTable(
  "cfi_profiles",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    schoolId: varchar("school_id").references(() => cfiSchools.id, {
      onDelete: "set null",
    }),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    headline: text("headline"),
    bio: text("bio"),
    headshotUrl: text("headshot_url"),
    locationCity: text("location_city"),
    locationState: text("location_state"),
    airportHome: text("airport_home"),
    hourlyRateCents: integer("hourly_rate_cents"),
    ratingsHeld: jsonb("ratings_held").default(sql`'[]'::jsonb`),
    aircraftTypes: jsonb("aircraft_types").default(sql`'[]'::jsonb`),
    languages: jsonb("languages").default(sql`'[]'::jsonb`),
    contactNote: text("contact_note"),
    preferredPayments: text("preferred_payments"),
    isPublished: boolean("is_published").default(false),
    isVerified: boolean("is_verified").default(false),
    verifiedAt: timestamp("verified_at"),
    verifiedByUserId: varchar("verified_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_cfi_profiles_user").on(table.userId),
    uniqueIndex("uniq_cfi_profiles_slug").on(table.slug),
    index("idx_cfi_profiles_slug").on(table.slug),
    index("idx_cfi_profiles_school").on(table.schoolId),
    index("idx_cfi_profiles_verified_by").on(table.verifiedByUserId),
  ],
);

export const cfiCredentials = pgTable(
  "cfi_credentials",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    cfiProfileId: varchar("cfi_profile_id")
      .notNull()
      .references(() => cfiProfiles.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    fileUrl: text("file_url").notNull(),
    fileName: text("file_name").notNull(),
    uploadedAt: timestamp("uploaded_at").defaultNow(),
    expiresOn: date("expires_on"),
    notes: text("notes"),
  },
  (table) => [index("idx_cfi_credentials_profile").on(table.cfiProfileId)],
);

export const cfiAvailabilityRules = pgTable(
  "cfi_availability_rules",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    cfiProfileId: varchar("cfi_profile_id")
      .notNull()
      .references(() => cfiProfiles.id, { onDelete: "cascade" }),
    timezone: text("timezone").notNull(),
    weekday: integer("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    isActive: boolean("is_active").default(true),
  },
  (table) => [index("idx_cfi_availability_profile").on(table.cfiProfileId)],
);

export const fuelPriceReports = pgTable("fuel_price_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  icao: varchar("icao", { length: 5 }).notNull(),
  fuelType: varchar("fuel_type", { length: 20 }).notNull(),
  pricePPG: numeric("price_ppg", {
    precision: 6,
    scale: 3,
  }).notNull(),
  fboName: varchar("fbo_name", { length: 200 }),
  notes: text("notes"),
  reportedBy: varchar("reported_by", { length: 100 }).notNull(),
  reportedAt: timestamp("reported_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cfiBookingRequests = pgTable(
  "cfi_booking_requests",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    cfiProfileId: varchar("cfi_profile_id")
      .notNull()
      .references(() => cfiProfiles.id, { onDelete: "cascade" }),
    studentUserId: varchar("student_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestedStart: timestamp("requested_start").notNull(),
    requestedEnd: timestamp("requested_end").notNull(),
    timezone: text("timezone").notNull(),
    location: text("location"),
    sessionType: text("session_type").notNull(),
    notes: text("notes"),
    status: text("status").notNull().default("REQUESTED"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_cfi_booking_profile_status").on(
      table.cfiProfileId,
      table.status,
    ),
    index("idx_cfi_booking_student").on(table.studentUserId),
  ],
);

// CFI Training - Student roster
export const cfiStudents = pgTable(
  "cfi_students",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    cfiProfileId: varchar("cfi_profile_id")
      .notNull()
      .references(() => cfiProfiles.id, { onDelete: "cascade" }),
    studentUserId: varchar("student_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    startDate: date("start_date"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_cfi_students").on(
      table.cfiProfileId,
      table.studentUserId,
    ),
    index("idx_cfi_students_profile").on(table.cfiProfileId),
    index("idx_cfi_students_student").on(table.studentUserId),
  ],
);

export const cfiLessonTemplates = pgTable(
  "cfi_lesson_templates",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    cfiProfileId: varchar("cfi_profile_id")
      .notNull()
      .references(() => cfiProfiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    lessonType: text("lesson_type").default("flight"),
    objective: text("objective"),
    tasks: jsonb("tasks").default(sql`'[]'::jsonb`),
    estimatedMinutes: integer("estimated_minutes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_cfi_lesson_templates_profile").on(table.cfiProfileId)],
);

export const cfiLessons = pgTable(
  "cfi_lessons",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    cfiProfileId: varchar("cfi_profile_id")
      .notNull()
      .references(() => cfiProfiles.id, { onDelete: "cascade" }),
    studentId: varchar("student_id")
      .notNull()
      .references(() => cfiStudents.id, { onDelete: "cascade" }),
    templateId: varchar("template_id").references(() => cfiLessonTemplates.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    lessonType: text("lesson_type"),
    objective: text("objective"),
    tasks: jsonb("tasks").default(sql`'[]'::jsonb`),
    status: text("status").notNull().default("planned"),
    scheduledAt: timestamp("scheduled_at"),
    completedAt: timestamp("completed_at"),
    instructorNotes: text("instructor_notes"),
    studentNotes: text("student_notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_cfi_lessons_student").on(table.studentId),
    index("idx_cfi_lessons_profile").on(table.cfiProfileId),
  ],
);

export const cfiStudentFiles = pgTable(
  "cfi_student_files",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    studentId: varchar("student_id")
      .notNull()
      .references(() => cfiStudents.id, { onDelete: "cascade" }),
    uploadedByUserId: varchar("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileSizeBytes: integer("file_size_bytes"),
    storageProvider: text("storage_provider").notNull().default("object"),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_cfi_student_files_student").on(table.studentId)],
);

export const cfiStudentMilestones = pgTable(
  "cfi_student_milestones",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    studentId: varchar("student_id")
      .notNull()
      .references(() => cfiStudents.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("not_started"),
    dueDate: date("due_date"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_cfi_student_milestones_student").on(table.studentId)],
);

export const cfiStudentEndorsements = pgTable(
  "cfi_student_endorsements",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    studentId: varchar("student_id")
      .notNull()
      .references(() => cfiStudents.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    endorsementType: text("endorsement_type"),
    templateText: text("template_text"),
    issuedAt: date("issued_at"),
    instructorName: text("instructor_name"),
    instructorCertificate: text("instructor_certificate"),
    aircraftType: text("aircraft_type"),
    notes: text("notes"),
    status: text("status").notNull().default("draft"),
    signedByName: text("signed_by_name"),
    signatureDataUrl: text("signature_data_url"),
    signedAt: timestamp("signed_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_cfi_student_endorsements_student").on(table.studentId),
  ],
);

export const cfiConversations = pgTable(
  "cfi_conversations",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    cfiProfileId: varchar("cfi_profile_id")
      .notNull()
      .references(() => cfiProfiles.id, { onDelete: "cascade" }),
    studentId: varchar("student_id")
      .notNull()
      .references(() => cfiStudents.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_cfi_conversations_pair").on(
      table.cfiProfileId,
      table.studentId,
    ),
    index("idx_cfi_conversations_profile").on(table.cfiProfileId),
    index("idx_cfi_conversations_student").on(table.studentId),
  ],
);

export const cfiMessages = pgTable(
  "cfi_messages",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    conversationId: varchar("conversation_id")
      .notNull()
      .references(() => cfiConversations.id, { onDelete: "cascade" }),
    senderUserId: varchar("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    isRead: boolean("is_read").default(false),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_cfi_messages_conversation").on(table.conversationId),
    index("idx_cfi_messages_sender").on(table.senderUserId),
  ],
);

export const cfiLegalAcceptances = pgTable(
  "cfi_legal_acceptances",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    acceptanceType: text("acceptance_type").notNull(),
    acceptedAt: timestamp("accepted_at").defaultNow(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    version: text("version").notNull(),
  },
  (table) => [index("idx_cfi_legal_user").on(table.userId)],
);

export const flyingClubs = pgTable(
  "flying_clubs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ownerUserId: varchar("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    homeAirport: text("home_airport"),
    city: text("city"),
    state: text("state"),
    websiteUrl: text("website_url"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    visibility: text("visibility").notNull().default("listed"),
    status: text("status").notNull().default("draft"),
    requiresApproval: boolean("requires_approval").notNull().default(true),
    requirePolicyAcceptanceBeforeBooking: boolean(
      "require_policy_acceptance_before_booking",
    )
      .notNull()
      .default(true),
    bookingNotes: text("booking_notes"),
    policiesSummary: text("policies_summary"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_flying_clubs_slug").on(table.slug),
    index("idx_flying_clubs_owner").on(table.ownerUserId),
    index("idx_flying_clubs_status").on(table.status),
    index("idx_flying_clubs_visibility").on(table.visibility),
  ],
);

export const flyingClubMembers = pgTable(
  "flying_club_members",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clubId: varchar("club_id")
      .notNull()
      .references(() => flyingClubs.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    status: text("status").notNull().default("active"),
    joinedAt: timestamp("joined_at").defaultNow(),
    invitedByUserId: varchar("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_flying_club_membership").on(table.clubId, table.userId),
    index("idx_flying_club_members_club").on(table.clubId),
    index("idx_flying_club_members_user").on(table.userId),
  ],
);

export const flyingClubJoinRequests = pgTable(
  "flying_club_join_requests",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clubId: varchar("club_id")
      .notNull()
      .references(() => flyingClubs.id, { onDelete: "cascade" }),
    applicantUserId: varchar("applicant_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    message: text("message"),
    reviewedByUserId: varchar("reviewed_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_flying_club_join_requests_club").on(table.clubId),
    index("idx_flying_club_join_requests_applicant").on(table.applicantUserId),
    uniqueIndex("uniq_flying_club_join_request_pending").on(
      table.clubId,
      table.applicantUserId,
      table.status,
    ),
  ],
);

export const flyingClubAircraft = pgTable(
  "flying_club_aircraft",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clubId: varchar("club_id")
      .notNull()
      .references(() => flyingClubs.id, { onDelete: "cascade" }),
    aircraftListingId: varchar("aircraft_listing_id").references(
      () => aircraftListings.id,
      { onDelete: "set null" },
    ),
    displayName: text("display_name").notNull(),
    tailNumber: text("tail_number"),
    makeModel: text("make_model"),
    hourlyRateWet: decimal("hourly_rate_wet", { precision: 10, scale: 2 }),
    hourlyRateDry: decimal("hourly_rate_dry", { precision: 10, scale: 2 }),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_flying_club_aircraft_club").on(table.clubId),
    index("idx_flying_club_aircraft_listing").on(table.aircraftListingId),
  ],
);

export const flyingClubReservations = pgTable(
  "flying_club_reservations",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clubId: varchar("club_id")
      .notNull()
      .references(() => flyingClubs.id, { onDelete: "cascade" }),
    aircraftId: varchar("aircraft_id")
      .notNull()
      .references(() => flyingClubAircraft.id, { onDelete: "cascade" }),
    memberUserId: varchar("member_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startAt: timestamp("start_at").notNull(),
    endAt: timestamp("end_at").notNull(),
    status: text("status").notNull().default("confirmed"),
    purpose: text("purpose"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_flying_club_reservations_club").on(table.clubId),
    index("idx_flying_club_reservations_aircraft").on(table.aircraftId),
    index("idx_flying_club_reservations_member").on(table.memberUserId),
    index("idx_flying_club_reservations_start").on(table.startAt),
  ],
);

export const flyingClubAnnouncements = pgTable(
  "flying_club_announcements",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clubId: varchar("club_id")
      .notNull()
      .references(() => flyingClubs.id, { onDelete: "cascade" }),
    authorUserId: varchar("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    isPinned: boolean("is_pinned").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_flying_club_announcements_club").on(table.clubId)],
);

export const flyingClubDocuments = pgTable(
  "flying_club_documents",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clubId: varchar("club_id")
      .notNull()
      .references(() => flyingClubs.id, { onDelete: "cascade" }),
    uploadedByUserId: varchar("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: text("category").notNull().default("general"),
    fileName: text("file_name"),
    storageProvider: text("storage_provider").notNull().default("object"),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type"),
    version: text("version").notNull().default("1.0"),
    requiresAcceptance: boolean("requires_acceptance").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_flying_club_documents_club").on(table.clubId)],
);

export const flyingClubLegalAcceptances = pgTable(
  "flying_club_legal_acceptances",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clubId: varchar("club_id")
      .notNull()
      .references(() => flyingClubs.id, { onDelete: "cascade" }),
    documentId: varchar("document_id")
      .notNull()
      .references(() => flyingClubDocuments.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    acceptedAt: timestamp("accepted_at").defaultNow(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (table) => [
    index("idx_flying_club_legal_acceptances_club").on(table.clubId),
    index("idx_flying_club_legal_acceptances_user").on(table.userId),
    uniqueIndex("uniq_flying_club_legal_acceptance").on(
      table.documentId,
      table.userId,
      table.version,
    ),
  ],
);

export const flyingClubSquawks = pgTable(
  "flying_club_squawks",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clubId: varchar("club_id")
      .notNull()
      .references(() => flyingClubs.id, { onDelete: "cascade" }),
    aircraftId: varchar("aircraft_id")
      .notNull()
      .references(() => flyingClubAircraft.id, { onDelete: "cascade" }),
    reportedByUserId: varchar("reported_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    severity: text("severity").notNull().default("minor"),
    status: text("status").notNull().default("open"),
    groundsAircraft: boolean("grounds_aircraft").notNull().default(false),
    reportedAt: timestamp("reported_at").defaultNow(),
    resolvedAt: timestamp("resolved_at"),
    resolvedByUserId: varchar("resolved_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    resolutionNotes: text("resolution_notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_flying_club_squawks_club").on(table.clubId),
    index("idx_flying_club_squawks_aircraft").on(table.aircraftId),
    index("idx_flying_club_squawks_status").on(table.status),
  ],
);

export const flyingClubMaintenanceItems = pgTable(
  "flying_club_maintenance_items",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clubId: varchar("club_id")
      .notNull()
      .references(() => flyingClubs.id, { onDelete: "cascade" }),
    aircraftId: varchar("aircraft_id")
      .notNull()
      .references(() => flyingClubAircraft.id, { onDelete: "cascade" }),
    createdByUserId: varchar("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    completedByUserId: varchar("completed_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    itemType: text("item_type").notNull().default("maintenance"),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("open"),
    dueDate: timestamp("due_date"),
    dueHours: decimal("due_hours", { precision: 10, scale: 1 }),
    blocksScheduling: boolean("blocks_scheduling").notNull().default(false),
    complianceReference: text("compliance_reference"),
    notes: text("notes"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_flying_club_maintenance_club").on(table.clubId),
    index("idx_flying_club_maintenance_aircraft").on(table.aircraftId),
    index("idx_flying_club_maintenance_status").on(table.status),
  ],
);

export const flyingClubBlackouts = pgTable(
  "flying_club_blackouts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clubId: varchar("club_id")
      .notNull()
      .references(() => flyingClubs.id, { onDelete: "cascade" }),
    aircraftId: varchar("aircraft_id")
      .notNull()
      .references(() => flyingClubAircraft.id, { onDelete: "cascade" }),
    createdByUserId: varchar("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    reason: text("reason"),
    status: text("status").notNull().default("active"),
    startAt: timestamp("start_at").notNull(),
    endAt: timestamp("end_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_flying_club_blackouts_club").on(table.clubId),
    index("idx_flying_club_blackouts_aircraft").on(table.aircraftId),
    index("idx_flying_club_blackouts_start").on(table.startAt),
  ],
);

// User Settings (lightweight per-user preferences)
export const userSettings = pgTable(
  "user_settings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eb6OutputMode: text("eb6_output_mode").default("quick"),
    eb6SelectedOutputs: text("eb6_selected_outputs")
      .array()
      .default(sql`ARRAY[]::text[]`),
    flightServiceProfile: jsonb("flight_service_profile").$type<Record<
      string,
      unknown
    > | null>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_user_settings_user").on(table.userId),
    index("idx_user_settings_user").on(table.userId),
  ],
);

// Push tokens (Expo)
export const pushTokens = pgTable(
  "push_tokens",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    platform: text("platform"),
    deviceName: text("device_name"),
    isActive: boolean("is_active").default(true),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_push_tokens_user").on(table.userId)],
);

// User notifications (in-app history)
export const userNotifications = pgTable(
  "user_notifications",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    referenceDate: date("reference_date"),
    channels: text("channels")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    isRead: boolean("is_read").default(false),
    readAt: timestamp("read_at"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_user_notifications_reference").on(
      table.userId,
      table.type,
      table.referenceDate,
    ),
    index("idx_user_notifications_user").on(table.userId),
    index("idx_user_notifications_unread").on(table.userId, table.isRead),
  ],
);

// Endorsements (Logbook Pro)
export const endorsements = pgTable(
  "endorsements",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    endorsementType: text("endorsement_type"),
    issuedAt: date("issued_at").notNull(),
    expiresAt: date("expires_at"),
    instructorName: text("instructor_name"),
    instructorCertificate: text("instructor_certificate"),
    aircraftType: text("aircraft_type"),
    notes: text("notes"),
    documentUrl: text("document_url"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_endorsements_user").on(table.userId)],
);

// Radio comms sessions (Logbook Pro)
export const radioCommsSessions = pgTable("radio_comms_sessions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  scenarioId: text("scenario_id").notNull(),
  scoreCorrect: integer("score_correct").default(0),
  scoreTotal: integer("score_total").default(0),
  durationSec: integer("duration_sec"),
  attempts: jsonb("attempts"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const studentProfiles = pgTable(
  "student_profiles",
  {
    userId: varchar("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    wizardJson: jsonb("wizard_json"),
    roadmapJson: jsonb("roadmap_json"),
    progressJson: jsonb("progress_json"),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_student_profiles_user").on(table.userId)],
);

export const approachPlates = pgTable(
  "approach_plates",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    icao: text("icao"),
    airportName: text("airport_name"),
    procedureName: text("procedure_name").notNull(),
    plateType: text("plate_type").default("IAP"),
    fileName: text("file_name").notNull(),
    storagePath: text("storage_path").notNull(),
    cycle: text("cycle").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_approach_plates_icao").on(table.icao),
    index("idx_approach_plates_cycle").on(table.cycle),
    index("idx_approach_plates_procedure").on(table.procedureName),
  ],
);

export const flightPlans = pgTable(
  "flight_plans",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    departure: text("departure").notNull(),
    destination: text("destination").notNull(),
    route: text("route"),
    alternate: text("alternate"),
    plannedDepartureAt: timestamp("planned_departure_at"),
    plannedArrivalAt: timestamp("planned_arrival_at"),
    aircraftType: text("aircraft_type"),
    tailNumber: text("tail_number"),
    fuelOnBoard: decimal("fuel_on_board", { precision: 8, scale: 2 }),
    fuelRequired: decimal("fuel_required", { precision: 8, scale: 2 }),
    filingProvider: text("filing_provider").default("leidos_flight_service"),
    filingProviderPlanId: text("filing_provider_plan_id"),
    filingFlightRules: text("filing_flight_rules").default("VFR"),
    filingEquipment: text("filing_equipment"),
    filingDepartureName: text("filing_departure_name"),
    filingDestinationName: text("filing_destination_name"),
    filingAlternateName: text("filing_alternate_name"),
    filingCloseLocation: text("filing_close_location"),
    filingSoulsOnBoard: text("filing_souls_on_board"),
    filingAircraftColor: text("filing_aircraft_color"),
    filingPilotName: text("filing_pilot_name"),
    filingPilotPhone: text("filing_pilot_phone"),
    filingAircraftHomeBase: text("filing_aircraft_home_base"),
    filingRemarks: text("filing_remarks"),
    filingWakeTurbulence: text("filing_wake_turbulence"),
    filingTypeOfFlight: text("filing_type_of_flight"),
    filingSurveillanceEquipment: text("filing_surveillance_equipment"),
    filingOtherInfo: text("filing_other_info"),
    filingTrueAirspeedKtas: integer("filing_true_airspeed_ktas"),
    filingPlannedAltitudeFt: integer("filing_planned_altitude_ft"),
    filingEstimatedEnrouteMinutes: integer("filing_estimated_enroute_minutes"),
    filingEnduranceMinutes: integer("filing_endurance_minutes"),
    filingStatus: text("filing_status").notNull().default("draft"),
    filingPendingAction: text("filing_pending_action"),
    filingIsLive: boolean("filing_is_live").notNull().default(false),
    filedAt: timestamp("filed_at"),
    activatedAt: timestamp("activated_at"),
    cancelledAt: timestamp("cancelled_at"),
    closedAt: timestamp("closed_at"),
    filingLastProviderSyncAt: timestamp("filing_last_provider_sync_at"),
    filingPayload: jsonb("filing_payload"),
    filingProviderSnapshot: jsonb("filing_provider_snapshot"),
    filingProviderMessages: jsonb("filing_provider_messages")
      .$type<Array<Record<string, unknown>>>()
      .default(sql`'[]'::jsonb`),
    filingAssignedBeaconCode: text("filing_assigned_beacon_code"),
    filingRaw: jsonb("filing_raw"),
    filingActionHistory: jsonb("filing_action_history")
      .$type<Array<Record<string, unknown>>>()
      .default(sql`'[]'::jsonb`),
    plannerState: jsonb("planner_state").$type<Record<
      string,
      unknown
    > | null>(),
    source: text("source"),
    isCertificationTest: boolean("is_certification_test")
      .notNull()
      .default(false),
    certificationRunId: text("certification_run_id"),
    certificationCaseId: text("certification_case_id"),
    certificationCaseName: text("certification_case_name"),
    certificationSeed: integer("certification_seed"),
    certificationAudit: jsonb("certification_audit").$type<Record<
      string,
      unknown
    > | null>(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_flight_plans_user").on(table.userId),
    index("idx_flight_plans_departure").on(table.plannedDepartureAt),
    index("idx_flight_plans_certification_run").on(table.certificationRunId),
  ],
);

export const flightServiceWebhookEvents = pgTable(
  "flight_service_webhook_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    provider: text("provider").notNull().default("leidos"),
    eventFingerprint: varchar("event_fingerprint", { length: 128 }).notNull(),
    flightIdentifier: text("flight_identifier"),
    providerPlanId: text("provider_plan_id"),
    versionStamp: text("version_stamp"),
    rawFlightState: text("raw_flight_state"),
    rawArtccState: text("raw_artcc_state"),
    messageDateTime: text("message_date_time"),
    providerMessageId: text("provider_message_id"),
    notificationType: text("notification_type"),
    processingId: varchar("processing_id", { length: 64 }).notNull(),
    status: text("status").notNull().default("processing"),
    duplicateCount: integer("duplicate_count").notNull().default(0),
    payloadSummary: jsonb("payload_summary"),
    processingStartedAt: timestamp("processing_started_at")
      .defaultNow()
      .notNull(),
    processingFinishedAt: timestamp("processing_finished_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_flight_service_webhook_events_provider_fingerprint").on(
      table.provider,
      table.eventFingerprint,
    ),
    index("idx_flight_service_webhook_events_flight_identifier").on(
      table.flightIdentifier,
    ),
    index("idx_flight_service_webhook_events_provider_plan").on(
      table.providerPlanId,
    ),
    index("idx_flight_service_webhook_events_created").on(table.createdAt),
  ],
);

export const flightServiceProviderActionAttempts = pgTable(
  "flight_service_provider_action_attempts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    flightPlanId: varchar("flight_plan_id")
      .notNull()
      .references(() => flightPlans.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("leidos"),
    action: text("action").notNull(),
    idempotencyKey: text("idempotency_key"),
    requestFingerprint: varchar("request_fingerprint", {
      length: 128,
    }).notNull(),
    status: text("status").notNull().default("pending"),
    statusReason: text("status_reason"),
    providerPlanId: text("provider_plan_id"),
    versionStamp: text("version_stamp"),
    responseStatusCode: integer("response_status_code"),
    responsePlan: jsonb("response_plan"),
    responseBody: jsonb("response_body"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    dispatchedAt: timestamp("dispatched_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_flight_service_provider_action_attempts_plan").on(
      table.flightPlanId,
    ),
    index("idx_flight_service_provider_action_attempts_user").on(table.userId),
    index("idx_flight_service_provider_action_attempts_status").on(
      table.status,
    ),
    uniqueIndex("idx_flight_service_provider_action_attempts_key").on(
      table.flightPlanId,
      table.idempotencyKey,
    ),
  ],
);

export const aircraftTypes = pgTable(
  "aircraft_types",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    make: text("make").notNull(),
    model: text("model").notNull(),
    icaoType: text("icao_type"),
    category: text("category").notNull(),
    engineType: text("engine_type").notNull(),
    cruiseKtas: decimal("cruise_ktas", { precision: 6, scale: 2 }).notNull(),
    fuelBurnGph: decimal("fuel_burn_gph", { precision: 6, scale: 2 }).notNull(),
    fuelBurnEconomyGph: decimal("fuel_burn_economy_gph", {
      precision: 6,
      scale: 2,
    }),
    fuelBurnPerformanceGph: decimal("fuel_burn_performance_gph", {
      precision: 6,
      scale: 2,
    }),
    usableFuelGal: decimal("usable_fuel_gal", {
      precision: 8,
      scale: 2,
    }).notNull(),
    maxGrossWeightLb: decimal("max_gross_weight_lb", {
      precision: 10,
      scale: 2,
    }).notNull(),
    emptyArmIn: decimal("empty_arm_in", { precision: 6, scale: 2 }),
    frontArmIn: decimal("front_arm_in", { precision: 6, scale: 2 }),
    rearArmIn: decimal("rear_arm_in", { precision: 6, scale: 2 }),
    baggageArmIn: decimal("baggage_arm_in", { precision: 6, scale: 2 }),
    fuelArmIn: decimal("fuel_arm_in", { precision: 6, scale: 2 }),
    defaultAltitudeFt: integer("default_altitude_ft"),
    isVerified: boolean("is_verified").default(false),
    sourceNote: text("source_note"),
    verificationSource: text("verification_source"),
    verificationUrl: text("verification_url"),
    lastVerifiedAt: timestamp("last_verified_at"),
    updatedAt: timestamp("updated_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_aircraft_types_make_model").on(table.make, table.model),
    index("idx_aircraft_types_icao").on(table.icaoType),
  ],
);

export const aircraftProfiles = pgTable(
  "aircraft_profiles",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tailNumber: text("tail_number"),
    typeId: varchar("type_id").references(() => aircraftTypes.id, {
      onDelete: "set null",
    }),
    isDefault: boolean("is_default").notNull().default(false),
    customManufacturer: text("custom_manufacturer"),
    customModel: text("custom_model"),
    customIcaoType: text("custom_icao_type"),
    engineTypeOverride: text("engine_type_override"),
    engineCountOverride: integer("engine_count_override"),
    aircraftType: text("aircraft_type"),
    cruiseKtas: decimal("cruise_ktas", { precision: 6, scale: 2 }),
    fuelBurnGph: decimal("fuel_burn_gph", { precision: 6, scale: 2 }),
    maxRangeNm: decimal("max_range_nm", { precision: 8, scale: 2 }),
    serviceCeilingFt: integer("service_ceiling_ft"),
    wakeCategory: text("wake_category"),
    equipmentCodes: text("equipment_codes"),
    surveillanceCodes: text("surveillance_codes"),
    fuelBurnDefaultGph: decimal("fuel_burn_default_gph", {
      precision: 6,
      scale: 2,
    }),
    notes: text("notes"),
    cruiseKtasOverride: decimal("cruise_ktas_override", {
      precision: 6,
      scale: 2,
    }),
    fuelBurnOverrideGph: decimal("fuel_burn_override_gph", {
      precision: 6,
      scale: 2,
    }),
    usableFuelOverrideGal: decimal("usable_fuel_override_gal", {
      precision: 8,
      scale: 2,
    }),
    maxGrossWeightOverrideLb: decimal("max_gross_weight_override_lb", {
      precision: 10,
      scale: 2,
    }),
    filingEquipmentDefault: text("filing_equipment_default"),
    filingSoulsOnBoardDefault: text("filing_souls_on_board_default"),
    filingAircraftColorDefault: text("filing_aircraft_color_default"),
    filingPilotNameDefault: text("filing_pilot_name_default"),
    filingRemarksDefault: text("filing_remarks_default"),
    filingWakeTurbulenceDefault: text("filing_wake_turbulence_default"),
    filingTypeOfFlightDefault: text("filing_type_of_flight_default"),
    filingSurveillanceEquipmentDefault: text(
      "filing_surveillance_equipment_default",
    ),
    filingOtherInfoDefault: text("filing_other_info_default"),
    filingEmergencyEquipmentDefault: text("filing_emergency_equipment_default"),
    filingTransponderDefault: text("filing_transponder_default"),
    filingPerformanceCategoryDefault: text(
      "filing_performance_category_default",
    ),
    filingEltDefault: text("filing_elt_default"),
    filingFlightRulesDefault: text("filing_flight_rules_default"),
    filingCruisingSpeedDefault: text("filing_cruising_speed_default"),
    filingAltitudePreferenceDefault: text("filing_altitude_preference_default"),
    filingEnduranceMinutesDefault: integer("filing_endurance_minutes_default"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_aircraft_profiles_user").on(table.userId),
    index("idx_aircraft_profiles_user_default").on(
      table.userId,
      table.isDefault,
    ),
  ],
);

export const flightServiceValidationReports = pgTable(
  "flight_service_validation_reports",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    reportId: varchar("report_id", { length: 160 }).notNull(),
    reportJson: jsonb("report_json").$type<Record<string, unknown>>().notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    publishedByUserId: varchar("published_by_user_id").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_flight_service_validation_reports_report_id").on(table.reportId),
    index("idx_flight_service_validation_reports_current").on(table.isCurrent, table.publishedAt),
  ],
);

export const aviationBriefings = pgTable(
  "aviation_briefings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    title: text("title").notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    excerpt: text("excerpt").notNull(),
    contentType: text("content_type").notNull().default("article"),
    category: text("category").notNull(),
    status: text("status").notNull().default("draft"),
    isFeatured: boolean("is_featured").notNull().default(false),
    featuredImageUrl: text("featured_image_url"),
    featuredImageStorageKey: text("featured_image_storage_key"),
    featuredImageAlt: text("featured_image_alt"),
    featuredImageCredit: text("featured_image_credit"),
    featuredImageCreditUrl: text("featured_image_credit_url"),
    articleContentJson: jsonb("article_content_json")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    videoSourceType: text("video_source_type"),
    videoUrl: text("video_url"),
    videoStorageKey: text("video_storage_key"),
    videoThumbnailUrl: text("video_thumbnail_url"),
    videoDurationSeconds: integer("video_duration_seconds"),
    videoTranscript: text("video_transcript"),
    supportingContentJson: jsonb("supporting_content_json")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    contributorsJson: jsonb("contributors_json")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    relevantToolIdsJson: jsonb("relevant_tool_ids_json")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    publishedAt: timestamp("published_at"),
    scheduledAt: timestamp("scheduled_at"),
    createdByUserId: varchar("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedByUserId: varchar("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_aviation_briefings_slug").on(table.slug),
    index("idx_aviation_briefings_visibility").on(
      table.status,
      table.publishedAt,
    ),
    index("idx_aviation_briefings_category").on(table.category),
    index("idx_aviation_briefings_type").on(table.contentType),
    index("idx_aviation_briefings_featured").on(table.isFeatured),
  ],
);

export const aviationContributorInvitations = pgTable(
  "aviation_contributor_invitations",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tokenHash: text("token_hash").notNull(),
    contributorName: text("contributor_name").notNull(),
    contributorEmail: varchar("contributor_email").notNull(),
    organization: text("organization"),
    internalNote: text("internal_note"),
    status: text("status").notNull().default("active"),
    reusableForRevisions: boolean("reusable_for_revisions")
      .notNull()
      .default(true),
    expiresAt: timestamp("expires_at"),
    openedAt: timestamp("opened_at"),
    firstSubmissionAt: timestamp("first_submission_at"),
    revokedAt: timestamp("revoked_at"),
    createdByUserId: varchar("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_aviation_contributor_invite_token").on(table.tokenHash),
    index("idx_aviation_contributor_invite_status").on(
      table.status,
      table.expiresAt,
    ),
  ],
);

export const aviationBriefingSubmissions = pgTable(
  "aviation_briefing_submissions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    invitationId: varchar("invitation_id")
      .notNull()
      .references(() => aviationContributorInvitations.id, {
        onDelete: "cascade",
      }),
    contributorName: text("contributor_name").notNull(),
    contributorEmail: varchar("contributor_email").notNull(),
    contributorTitle: text("contributor_title"),
    contributorCredentials: text("contributor_credentials"),
    contributorOrganization: text("contributor_organization"),
    contributorBio: text("contributor_bio"),
    contributorProfileImageUrl: text("contributor_profile_image_url"),
    contributorLinksJson: jsonb("contributor_links_json")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    videoProvider: text("video_provider").notNull(),
    videoUrl: text("video_url").notNull(),
    originalPublicationUrl: text("original_publication_url"),
    thumbnailUrl: text("thumbnail_url"),
    videoDurationSeconds: integer("video_duration_seconds"),
    transcript: text("transcript"),
    contentOutline: text("content_outline"),
    intendedAudience: text("intended_audience"),
    relevantToolIdsJson: jsonb("relevant_tool_ids_json")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    additionalNotes: text("additional_notes"),
    disclosuresJson: jsonb("disclosures_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("draft"),
    revisionRequest: text("revision_request"),
    internalReviewNotes: text("internal_review_notes"),
    reviewChecklistJson: jsonb("review_checklist_json")
      .$type<Record<string, boolean>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    credentialsReviewed: boolean("credentials_reviewed")
      .notNull()
      .default(false),
    aviationReviewRecommended: boolean("aviation_review_recommended")
      .notNull()
      .default(false),
    aviationReviewCompleted: boolean("aviation_review_completed")
      .notNull()
      .default(false),
    assignedReviewerUserId: varchar("assigned_reviewer_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    agreementAccepted: boolean("agreement_accepted").notNull().default(false),
    agreementVersion: text("agreement_version"),
    agreementAcceptedAt: timestamp("agreement_accepted_at"),
    submittedAt: timestamp("submitted_at"),
    reviewedAt: timestamp("reviewed_at"),
    approvedAt: timestamp("approved_at"),
    rejectedAt: timestamp("rejected_at"),
    withdrawnAt: timestamp("withdrawn_at"),
    publishedBriefingId: varchar("published_briefing_id").references(
      () => aviationBriefings.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_aviation_submission_invitation").on(table.invitationId),
    index("idx_aviation_submission_status").on(table.status, table.createdAt),
    index("idx_aviation_submission_email").on(table.contributorEmail),
    index("idx_aviation_submission_category").on(table.category),
    index("idx_aviation_submission_reviewer").on(table.assignedReviewerUserId),
    index("idx_aviation_submission_briefing").on(table.publishedBriefingId),
  ],
);

export const aviationBriefingFeedback = pgTable(
  "aviation_briefing_feedback",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    briefingId: varchar("briefing_id")
      .notNull()
      .references(() => aviationBriefings.id, { onDelete: "cascade" }),
    readerHash: text("reader_hash").notNull(),
    userId: varchar("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    responseType: text("response_type").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_aviation_feedback_reader").on(
      table.briefingId,
      table.readerHash,
    ),
    index("idx_aviation_feedback_briefing").on(
      table.briefingId,
      table.createdAt,
    ),
  ],
);

export const aviationBriefingSaves = pgTable(
  "aviation_briefing_saves",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    briefingId: varchar("briefing_id")
      .notNull()
      .references(() => aviationBriefings.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_aviation_save_user_briefing").on(
      table.userId,
      table.briefingId,
    ),
    index("idx_aviation_save_briefing").on(table.briefingId),
  ],
);

export const aviationBriefingPhotoSubmissions = pgTable(
  "aviation_briefing_photo_submissions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    submissionToken: varchar("submission_token").notNull().unique(),
    contributorName: text("contributor_name").notNull(),
    contributorEmail: varchar("contributor_email").notNull(),
    phone: text("phone"),
    homeAirport: text("home_airport"),
    cityState: text("city_state"),
    preferredCredit: text("preferred_credit").notNull(),
    profileUrl: text("profile_url"),
    aircraftMakeModel: text("aircraft_make_model"),
    aircraftRegistration: text("aircraft_registration"),
    photoLocation: text("photo_location"),
    dateTaken: text("date_taken"),
    description: text("description"),
    storyContext: text("story_context"),
    suggestedTopic: text("suggested_topic"),
    identifiablePeople: text("identifiable_people"),
    imageStorageKey: text("image_storage_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    storedFilename: text("stored_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    imageWidth: integer("image_width"),
    imageHeight: integer("image_height"),
    ownershipConfirmed: boolean("ownership_confirmed").notNull(),
    permissionAccepted: boolean("permission_accepted").notNull(),
    permissionText: text("permission_text").notNull(),
    permissionVersion: text("permission_version").notNull(),
    consentedAt: timestamp("consented_at").notNull(),
    userId: varchar("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sourceIp: text("source_ip"),
    userAgent: text("user_agent"),
    reviewStatus: text("review_status").notNull().default("pending"),
    internalNotes: text("internal_notes"),
    publicationStatus: text("publication_status")
      .notNull()
      .default("unpublished"),
    associatedBriefingId: varchar("associated_briefing_id").references(
      () => aviationBriefings.id,
      { onDelete: "set null" },
    ),
    publishedImageUrl: text("published_image_url"),
    finalCreditLine: text("final_credit_line"),
    altText: text("alt_text"),
    caption: text("caption"),
    imageTitle: text("image_title"),
    relevantAircraftType: text("relevant_aircraft_type"),
    relevantAirport: text("relevant_airport"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_aviation_photo_status").on(table.reviewStatus, table.createdAt),
    index("idx_aviation_photo_email").on(table.contributorEmail),
    index("idx_aviation_photo_article").on(table.associatedBriefingId),
  ],
);

export const aviationBriefingSubscribers = pgTable("aviation_briefing_subscribers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(), name: text("name"), status: text("status").notNull().default("pending"),
  confirmationTokenHash: text("confirmation_token_hash"), unsubscribeToken: varchar("unsubscribe_token").notNull().unique(),
  confirmedAt: timestamp("confirmed_at"), unsubscribedAt: timestamp("unsubscribed_at"), source: text("source"), sourceIp: text("source_ip"), userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(), updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [index("idx_aviation_briefing_subscriber_status").on(table.status, table.createdAt)]);

export const aviationBriefingEmailDeliveries = pgTable("aviation_briefing_email_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  briefingId: varchar("briefing_id").notNull().references(() => aviationBriefings.id, { onDelete: "cascade" }),
  subscriberId: varchar("subscriber_id").notNull().references(() => aviationBriefingSubscribers.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), providerMessageId: text("provider_message_id"), errorMessage: text("error_message"), sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(), updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [uniqueIndex("idx_aviation_briefing_delivery_once").on(table.briefingId, table.subscriberId), index("idx_aviation_briefing_delivery_status").on(table.status, table.createdAt)]);

export const aviationBriefingSuggestions = pgTable(
  "aviation_briefing_suggestions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    email: varchar("email").notNull(),
    suggestedPerson: text("suggested_person").notNull(),
    organization: text("organization"),
    topic: text("topic").notNull(),
    reason: text("reason").notNull(),
    website: text("website"),
    notes: text("notes"),
    status: text("status").notNull().default("new"),
    assignedAdminUserId: varchar("assigned_admin_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    sourceBriefingId: varchar("source_briefing_id").references(
      () => aviationBriefings.id,
      { onDelete: "set null" },
    ),
    convertedInvitationId: varchar("converted_invitation_id").references(
      () => aviationContributorInvitations.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_aviation_suggestion_status").on(table.status, table.createdAt),
    index("idx_aviation_suggestion_assignee").on(table.assignedAdminUserId),
    index("idx_aviation_suggestion_email").on(table.email),
  ],
);

const logbookDecimalField = z
  .union([
    z.string().regex(/^\d+(\.\d{1,2})?$/),
    z.number().finite().min(0),
    z.literal(""),
  ])
  .optional()
  .transform((value) => {
    if (value === "" || value === undefined) return undefined;
    return typeof value === "number" ? String(value) : value;
  });

export const insertLogbookEntrySchema = createInsertSchema(logbookEntries)
  .omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
    isLocked: true,
    signatureDataUrl: true,
    signedAt: true,
    signedByName: true,
    signatureIp: true,
    cfiSignatureDataUrl: true,
    cfiSignedByName: true,
    cfiSignedAt: true,
    cfiSignatureIp: true,
    cfiCertNumber: true,
    cfiCertExpires: true,
  })
  .extend({
    flightDate: z.coerce.date(),
    timeDay: logbookDecimalField,
    timeNight: logbookDecimalField,
    pic: logbookDecimalField,
    sic: logbookDecimalField,
    dual: logbookDecimalField,
    solo: logbookDecimalField,
    crossCountry: logbookDecimalField,
    instrumentActual: logbookDecimalField,
    approaches: z.number().min(0).optional(),
    landingsDay: z.number().min(0).optional(),
    landingsNight: z.number().min(0).optional(),
    holds: z.number().min(0).optional(),
    hobbsStart: logbookDecimalField,
    hobbsEnd: logbookDecimalField,
  });

export const insertLogbookProSettingsSchema = createInsertSchema(
  logbookProSettings,
)
  .omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    medicalIssuedAt: z.string().optional().nullable(),
    medicalExpiresAt: z.string().optional().nullable(),
    flightReviewDate: z.string().optional().nullable(),
    ipcDate: z.string().optional().nullable(),
  });

export const insertLogbookArchiveSchema = createInsertSchema(logbookArchives)
  .omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    fileName: z.string().min(1),
    storageProvider: z.enum(["object", "s3"]).default("object"),
  });

export const insertNotificationPreferencesSchema = createInsertSchema(
  notificationPreferences,
).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCfiProfileSchema = createInsertSchema(cfiProfiles).omit({
  id: true,
  userId: true,
  isVerified: true,
  verifiedAt: true,
  verifiedByUserId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCfiSchoolSchema = createInsertSchema(cfiSchools).omit({
  id: true,
  ownerUserId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCfiSchoolMemberSchema = createInsertSchema(
  cfiSchoolMembers,
).omit({
  id: true,
  schoolId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCfiCredentialSchema = createInsertSchema(
  cfiCredentials,
).omit({
  id: true,
  cfiProfileId: true,
  uploadedAt: true,
});

export const insertCfiAvailabilityRuleSchema = createInsertSchema(
  cfiAvailabilityRules,
).omit({
  id: true,
  cfiProfileId: true,
});

export const insertCfiBookingRequestSchema = createInsertSchema(
  cfiBookingRequests,
).omit({
  id: true,
  cfiProfileId: true,
  studentUserId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCfiStudentSchema = createInsertSchema(cfiStudents)
  .omit({
    id: true,
    cfiProfileId: true,
    studentUserId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    startDate: z.string().optional().nullable(),
  });

export const insertCfiLessonTemplateSchema = createInsertSchema(
  cfiLessonTemplates,
)
  .omit({
    id: true,
    cfiProfileId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    tasks: z.array(z.string()).optional(),
  });

export const insertCfiLessonSchema = createInsertSchema(cfiLessons)
  .omit({
    id: true,
    cfiProfileId: true,
    studentId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    tasks: z.array(z.string()).optional(),
    scheduledAt: z.string().optional().nullable(),
    completedAt: z.string().optional().nullable(),
  });

export const insertCfiStudentFileSchema = createInsertSchema(
  cfiStudentFiles,
).omit({
  id: true,
  studentId: true,
  uploadedByUserId: true,
  createdAt: true,
});

export const insertCfiStudentMilestoneSchema = createInsertSchema(
  cfiStudentMilestones,
)
  .omit({
    id: true,
    studentId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    dueDate: z.string().optional().nullable(),
    completedAt: z.string().optional().nullable(),
  });

export const insertCfiStudentEndorsementSchema = createInsertSchema(
  cfiStudentEndorsements,
)
  .omit({
    id: true,
    studentId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    issuedAt: z.string().optional().nullable(),
  });

export const insertCfiConversationSchema = createInsertSchema(
  cfiConversations,
).omit({
  id: true,
  cfiProfileId: true,
  studentId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCfiMessageSchema = createInsertSchema(cfiMessages).omit({
  id: true,
  conversationId: true,
  senderUserId: true,
  createdAt: true,
  readAt: true,
});

export const insertCfiLegalAcceptanceSchema = createInsertSchema(
  cfiLegalAcceptances,
).omit({
  id: true,
  userId: true,
  acceptedAt: true,
});

export const insertFlyingClubSchema = createInsertSchema(flyingClubs)
  .omit({
    id: true,
    ownerUserId: true,
    slug: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    visibility: z.enum(flyingClubVisibility).optional(),
    status: z.enum(flyingClubStatuses).optional(),
  });

export const insertFlyingClubMemberSchema = createInsertSchema(
  flyingClubMembers,
)
  .omit({
    id: true,
    clubId: true,
    createdAt: true,
    updatedAt: true,
    joinedAt: true,
  })
  .extend({
    role: z.enum(flyingClubMemberRoles).optional(),
    status: z.enum(flyingClubMemberStatuses).optional(),
  });

export const insertFlyingClubJoinRequestSchema = createInsertSchema(
  flyingClubJoinRequests,
)
  .omit({
    id: true,
    clubId: true,
    applicantUserId: true,
    reviewedByUserId: true,
    reviewedAt: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    status: z.enum(flyingClubJoinRequestStatuses).optional(),
  });

export const insertFlyingClubAircraftSchema = createInsertSchema(
  flyingClubAircraft,
)
  .omit({
    id: true,
    clubId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    status: z.enum(flyingClubAircraftStatuses).optional(),
  });

export const insertFlyingClubReservationSchema = createInsertSchema(
  flyingClubReservations,
)
  .omit({
    id: true,
    clubId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    status: z.enum(flyingClubReservationStatuses).optional(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
  });

export const insertFlyingClubAnnouncementSchema = createInsertSchema(
  flyingClubAnnouncements,
).omit({
  id: true,
  clubId: true,
  authorUserId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFlyingClubDocumentSchema = createInsertSchema(
  flyingClubDocuments,
).omit({
  id: true,
  clubId: true,
  uploadedByUserId: true,
  createdAt: true,
});

export const insertFlyingClubLegalAcceptanceSchema = createInsertSchema(
  flyingClubLegalAcceptances,
).omit({
  id: true,
  clubId: true,
  userId: true,
  version: true,
  acceptedAt: true,
  ip: true,
  userAgent: true,
});

export const insertFlyingClubSquawkSchema = createInsertSchema(
  flyingClubSquawks,
)
  .omit({
    id: true,
    clubId: true,
    reportedByUserId: true,
    reportedAt: true,
    resolvedAt: true,
    resolvedByUserId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    status: z.enum(flyingClubSquawkStatuses).optional(),
    severity: z.enum(flyingClubSquawkSeverities).optional(),
  });

export const insertFlyingClubMaintenanceItemSchema = createInsertSchema(
  flyingClubMaintenanceItems,
)
  .omit({
    id: true,
    clubId: true,
    createdByUserId: true,
    completedByUserId: true,
    completedAt: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    itemType: z.enum(flyingClubMaintenanceItemTypes).optional(),
    status: z.enum(flyingClubMaintenanceStatuses).optional(),
    dueDate: z.coerce.date().optional().nullable(),
  });

export const insertFlyingClubBlackoutSchema = createInsertSchema(
  flyingClubBlackouts,
)
  .omit({
    id: true,
    clubId: true,
    createdByUserId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    status: z.enum(flyingClubBlackoutStatuses).optional(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
  });

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPushTokenSchema = createInsertSchema(pushTokens)
  .omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
    lastUsedAt: true,
  })
  .extend({
    token: z.string().min(10),
  });

export const insertUserNotificationSchema = createInsertSchema(
  userNotifications,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEndorsementSchema = createInsertSchema(endorsements)
  .omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    issuedAt: z.coerce.date(),
    expiresAt: z.coerce.date().optional().nullable(),
  });

export const insertRadioCommsSessionSchema = createInsertSchema(
  radioCommsSessions,
).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertStudentProfileSchema = createInsertSchema(
  studentProfiles,
).omit({
  updatedAt: true,
});

export const insertFlightPlanSchema = createInsertSchema(flightPlans)
  .omit({
    id: true,
    userId: true,
    filingProviderPlanId: true,
    filingPendingAction: true,
    filedAt: true,
    activatedAt: true,
    cancelledAt: true,
    closedAt: true,
    filingLastProviderSyncAt: true,
    filingPayload: true,
    filingProviderSnapshot: true,
    filingProviderMessages: true,
    filingAssignedBeaconCode: true,
    filingRaw: true,
    filingActionHistory: true,
    source: true,
    isCertificationTest: true,
    certificationRunId: true,
    certificationCaseId: true,
    certificationCaseName: true,
    certificationSeed: true,
    certificationAudit: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    plannedDepartureAt: z.coerce.date().optional().nullable(),
    plannedArrivalAt: z.coerce.date().optional().nullable(),
    fuelOnBoard: z
      .union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.literal(""), z.null()])
      .optional(),
    fuelRequired: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .optional()
      .or(z.literal("")),
    filingFlightRules: z.enum(["VFR", "IFR", "DVFR"]).optional(),
    filingWakeTurbulence: z.string().trim().max(20).optional().nullable(),
    filingTypeOfFlight: z.string().trim().max(10).optional().nullable(),
    filingSurveillanceEquipment: z
      .string()
      .trim()
      .max(20)
      .optional()
      .nullable(),
    filingOtherInfo: z.string().trim().max(1000).optional().nullable(),
    filingPilotPhone: z.string().trim().max(40).optional().nullable(),
    filingAircraftHomeBase: z.string().trim().max(12).optional().nullable(),
    filingTrueAirspeedKtas: z.coerce
      .number()
      .int()
      .min(0)
      .optional()
      .nullable(),
    filingPlannedAltitudeFt: z.coerce
      .number()
      .int()
      .min(0)
      .optional()
      .nullable(),
    filingEstimatedEnrouteMinutes: z.coerce
      .number()
      .int()
      .min(0)
      .optional()
      .nullable(),
    filingEnduranceMinutes: z.coerce
      .number()
      .int()
      .min(0)
      .optional()
      .nullable(),
    plannerState: z.record(z.any()).optional().nullable(),
    filingStatus: z.enum(flightPlanFilingStatuses).optional(),
  });

export const insertAircraftTypeSchema = createInsertSchema(aircraftTypes)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    cruiseKtas: z.coerce.number().min(60).max(450),
    fuelBurnGph: z.coerce.number().min(1).max(100),
    fuelBurnEconomyGph: z.coerce.number().min(1).max(100).optional().nullable(),
    fuelBurnPerformanceGph: z.coerce
      .number()
      .min(1)
      .max(100)
      .optional()
      .nullable(),
    usableFuelGal: z.coerce.number().min(5).max(4000),
    maxGrossWeightLb: z.coerce.number().min(500).max(2000000),
    defaultAltitudeFt: z.coerce
      .number()
      .min(1000)
      .max(45000)
      .optional()
      .nullable(),
    emptyArmIn: z.coerce.number().min(0).max(400).optional().nullable(),
    frontArmIn: z.coerce.number().min(0).max(400).optional().nullable(),
    rearArmIn: z.coerce.number().min(0).max(400).optional().nullable(),
    baggageArmIn: z.coerce.number().min(0).max(400).optional().nullable(),
    fuelArmIn: z.coerce.number().min(0).max(400).optional().nullable(),
    verificationUrl: z.string().trim().url().optional().nullable(),
  });

export const insertAircraftProfileSchema = createInsertSchema(aircraftProfiles)
  .omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    typeId: z.string().uuid().optional().nullable(),
    isDefault: z.boolean().optional(),
    customManufacturer: z.string().trim().max(120).optional().nullable(),
    customModel: z.string().trim().max(120).optional().nullable(),
    customIcaoType: z.string().trim().max(10).optional().nullable(),
    engineTypeOverride: z.string().trim().max(50).optional().nullable(),
    engineCountOverride: z.coerce
      .number()
      .int()
      .min(0)
      .max(12)
      .optional()
      .nullable(),
    aircraftType: z.string().trim().max(20).optional().nullable(),
    cruiseKtas: z.coerce.number().min(60).max(450).optional().nullable(),
    fuelBurnGph: z.coerce.number().min(1).max(100).optional().nullable(),
    maxRangeNm: z.coerce.number().min(1).max(10000).optional().nullable(),
    serviceCeilingFt: z.coerce
      .number()
      .int()
      .min(1000)
      .max(60000)
      .optional()
      .nullable(),
    wakeCategory: z.string().trim().max(20).optional().nullable(),
    equipmentCodes: z.string().trim().max(50).optional().nullable(),
    surveillanceCodes: z.string().trim().max(20).optional().nullable(),
    fuelBurnDefaultGph: z.coerce.number().min(1).max(100).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
    cruiseKtasOverride: z.coerce
      .number()
      .min(60)
      .max(450)
      .optional()
      .nullable(),
    fuelBurnOverrideGph: z.coerce
      .number()
      .min(1)
      .max(100)
      .optional()
      .nullable(),
    usableFuelOverrideGal: z.coerce
      .number()
      .min(5)
      .max(4000)
      .optional()
      .nullable(),
    maxGrossWeightOverrideLb: z.coerce
      .number()
      .min(500)
      .max(2000000)
      .optional()
      .nullable(),
    filingEquipmentDefault: z.string().trim().max(50).optional().nullable(),
    filingSoulsOnBoardDefault: z.string().trim().max(10).optional().nullable(),
    filingAircraftColorDefault: z.string().trim().max(50).optional().nullable(),
    filingPilotNameDefault: z.string().trim().max(120).optional().nullable(),
    filingRemarksDefault: z.string().trim().max(500).optional().nullable(),
    filingWakeTurbulenceDefault: z
      .string()
      .trim()
      .max(20)
      .optional()
      .nullable(),
    filingTypeOfFlightDefault: z.string().trim().max(10).optional().nullable(),
    filingSurveillanceEquipmentDefault: z
      .string()
      .trim()
      .max(20)
      .optional()
      .nullable(),
    filingOtherInfoDefault: z.string().trim().max(1000).optional().nullable(),
    filingEmergencyEquipmentDefault: z
      .string()
      .trim()
      .max(100)
      .optional()
      .nullable(),
    filingTransponderDefault: z.string().trim().max(50).optional().nullable(),
    filingPerformanceCategoryDefault: z
      .string()
      .trim()
      .max(50)
      .optional()
      .nullable(),
    filingEltDefault: z.string().trim().max(50).optional().nullable(),
    filingFlightRulesDefault: z.string().trim().max(10).optional().nullable(),
    filingCruisingSpeedDefault: z.string().trim().max(20).optional().nullable(),
    filingAltitudePreferenceDefault: z
      .string()
      .trim()
      .max(20)
      .optional()
      .nullable(),
    filingEnduranceMinutesDefault: z.coerce
      .number()
      .int()
      .min(1)
      .max(1440)
      .optional()
      .nullable(),
  });

export const insertApproachPlateSchema = createInsertSchema(approachPlates)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    plateType: z.enum(approachPlateTypes).optional(),
  });

export const insertMarketplaceFlagSchema = createInsertSchema(
  marketplaceFlags,
).omit({
  id: true,
  createdAt: true,
});

export const insertRentalSchema = createInsertSchema(rentals)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    actualHours: true,
    status: true,
    isPaid: true,
    payoutCompleted: true,
    // Omit calculated cost fields - these are computed server-side
    baseCost: true,
    salesTax: true,
    platformFeeRenter: true,
    platformFeeOwner: true,
    processingFee: true,
    totalCostRenter: true,
    ownerPayout: true,
  })
  .extend({
    // Accept date strings and coerce to Date objects
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    estimatedHours: z.string().regex(/^\d+(\.\d{1,2})?$/),
    hourlyRate: z.string().regex(/^\d+(\.\d{1,2})?$/),
  });

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  isRead: true,
});

export const insertReviewSchema = createInsertSchema(reviews)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    rating: z.number().min(1).max(5),
    communicationRating: z.number().min(1).max(5).optional(),
    cleanlinessRating: z.number().min(1).max(5).optional(),
    accuracyRating: z.number().min(1).max(5).optional(),
    comment: z.string().max(1000).optional(),
  });

export const insertFavoriteSchema = createInsertSchema(favorites)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    listingType: z.enum(["marketplace", "aircraft"]),
  });

export const insertAirportFavoriteSchema = createInsertSchema(airportFavorites)
  .omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
    lastObservedCategory: true,
    lastObservedAt: true,
    lastAlertCategory: true,
    lastAlertAt: true,
  })
  .extend({
    icao: z
      .string()
      .min(3)
      .max(4)
      .transform((value) => value.trim().toUpperCase()),
  });

export const insertCrmLeadSchema = createInsertSchema(crmLeads)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    emailUnsubscribed: true,
    emailUnsubscribedAt: true,
    emailSuppressionReason: true,
    emailPreferences: true,
    marketingEmailOptOutAt: true,
    salesEmailLastSentAt: true,
    convertedToContactId: true,
    convertedToDealId: true,
    convertedAt: true,
  })
  .extend({
    status: z.enum(leadStatuses).default("new"),
    source: z.enum(leadSources).optional(),
    category: z.enum(leadCategories).default("other"),
    value: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .optional(),
  });

export const insertCrmContactSchema = createInsertSchema(crmContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCrmDealSchema = createInsertSchema(crmDeals)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    stage: z.enum(dealStages).default("lead"),
    value: z.string().regex(/^\d+(\.\d{1,2})?$/),
    probability: z.number().min(0).max(100).default(50),
  });

export const insertCrmActivitySchema = createInsertSchema(crmActivities)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    isCompleted: true,
    completedAt: true,
  })
  .extend({
    type: z.enum(activityTypes),
  });

export const insertCrmWeeklyReportSchema = createInsertSchema(crmWeeklyReports)
  .omit({
    id: true,
    preparedBy: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    weekStart: z.string().min(1, "Week start is required"),
    weekEnd: z.string().min(1, "Week end is required"),
    title: z.string().min(1, "Title is required"),
    status: z.enum(crmWeeklyReportStatuses).default("draft"),
    recipientName: z.string().optional(),
    recipientRole: z.string().optional(),
    newLeadsAdded: z.number().int().min(0).default(0),
    leadsWorked: z.number().int().min(0).default(0),
    outreachEmailsSent: z.number().int().min(0).default(0),
    followUpsSent: z.number().int().min(0).default(0),
    callsCompleted: z.number().int().min(0).default(0),
    meetingsBooked: z.number().int().min(0).default(0),
    proposalsSent: z.number().int().min(0).default(0),
    dealsAdvanced: z.number().int().min(0).default(0),
    closedWonCount: z.number().int().min(0).default(0),
    estimatedPipelineValue: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .optional(),
    executiveSummary: z.string().optional(),
    wins: z.string().optional(),
    pipelineUpdates: z.string().optional(),
    blockers: z.string().optional(),
    nextWeekFocus: z.string().optional(),
    supportNeeded: z.string().optional(),
  });

export const insertPromoCodeSchema = createInsertSchema(promoCodes)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    usedCount: true,
    applicableCategories: true,
  })
  .extend({
    code: z.string().min(1, "Promo code is required").toUpperCase(),
    description: z.string().optional(),
    discountType: z.enum([
      "free_7_day",
      "percentage",
      "fixed_amount",
      "waive_creation_fee",
    ]),
    discountValue: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .optional(),
    maxUses: z.number().int().positive().optional(),
    isActive: z.boolean().default(true),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional(),
    applicableToMarketplace: z.boolean().default(true),
    applicableToBannerAds: z.boolean().default(false),
  });

export const insertMembershipPartnerOfferSchema = createInsertSchema(
  membershipPartnerOffers,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1, "Offer name is required").max(120),
    partnerName: z.string().min(1, "Partner name is required").max(120),
    slug: z
      .string()
      .min(2, "Offer slug is required")
      .max(120)
      .regex(
        /^[a-z0-9-]+$/,
        "Use lowercase letters, numbers, and hyphens only",
      ),
    description: z.string().max(500).optional(),
    tier: z.literal("premium").default("premium"),
    durationDays: z.number().int().min(1).max(365),
    isActive: z.boolean().default(true),
    createdBy: z.string().optional(),
  });

export const insertMembershipPromotionSchema = createInsertSchema(
  membershipPromotions,
)
  .omit({
    id: true,
    normalizedCode: true,
    redemptionCount: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    code: z.string().min(2, "Promotion code is required").max(120),
    name: z.string().min(1, "Promotion name is required").max(160),
    description: z.string().max(1000).optional().nullable(),
    campaign: z.string().max(160).optional().nullable(),
    partnerName: z.string().max(160).optional().nullable(),
    source: z.string().max(160).optional().nullable(),
    benefitType: z
      .literal("complimentary_membership")
      .default("complimentary_membership"),
    membershipTier: z.literal("premium").default("premium"),
    membershipDurationMonths: z.number().int().min(1).max(36).default(12),
    maxTotalRedemptions: z
      .number()
      .int()
      .min(1)
      .max(100000)
      .optional()
      .nullable(),
    maxRedemptionsPerUser: z.number().int().min(1).max(10).default(1),
    validFrom: z.coerce.date().optional().nullable(),
    expiresAt: z.coerce.date().optional().nullable(),
    isActive: z.boolean().default(true),
    successMessage: z.string().max(2000).optional().nullable(),
    createdBy: z.string().optional().nullable(),
    updatedBy: z.string().optional().nullable(),
  });

export const insertExpenseSchema = createInsertSchema(expenses)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    category: z.enum(expenseCategories),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
    expenseDate: z.coerce.date().optional(),
    invoiceUrl: z.string().optional(),
  });

export const insertPersonalFinanceEntrySchema = createInsertSchema(
  personalFinanceEntries,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    owner: z.enum(personalFinanceOwners),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be YYYY-MM"),
    type: z.enum(personalFinanceEntryTypes),
    category: z.union([
      z.enum(personalFinanceExpenseCategories),
      z.enum(personalFinanceIncomeCategories),
      z.enum(personalFinanceRsfCategories),
    ]),
    rsfCategory: z
      .union([z.enum(personalFinanceRsfCategories), z.null()])
      .optional(),
    subcategory: z.union([z.string(), z.null()]).optional(),
    description: z.union([z.string(), z.null()]).optional(),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
    dueDate: z.union([z.string(), z.null()]).optional(),
    paidDate: z.union([z.string(), z.null()]).optional(),
    isPaid: z.boolean().optional(),
    isRecurring: z.boolean().optional(),
    recurringFrequency: z
      .enum(personalFinanceRecurringFrequencies)
      .nullable()
      .optional(),
    recurringDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    recurringDayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
    recurringIntervalDays: z
      .number()
      .int()
      .min(1)
      .max(365)
      .nullable()
      .optional(),
    notifyDaysBefore: z.number().int().min(0).max(31).optional(),
    notificationSent: z.boolean().optional(),
  });

export const insertPersonalFinanceBudgetSchema = createInsertSchema(
  personalFinanceBudgets,
)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be YYYY-MM"),
    owner: z.enum(personalFinanceOwners),
    category: z.enum(personalFinanceExpenseCategories),
    budgetAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  });

export const insertAdminNotificationSchema = createInsertSchema(
  adminNotifications,
).omit({
  id: true,
  createdAt: true,
  readAt: true,
});

export const insertBannerAdOrderSchema = createInsertSchema(bannerAdOrders)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    paypalOrderId: true,
    paypalPaymentDate: true,
  })
  .extend({
    sponsorName: z.string().min(1, "Sponsor name is required"),
    sponsorEmail: z.string().email("Valid email is required"),
    title: z.string().min(1, "Title is required"),
    description: z
      .union([z.string().max(240), z.literal(""), z.null()])
      .optional(),
    adCopy: z.union([z.string().max(800), z.literal(""), z.null()]).optional(),
    imageUrl: z
      .union([
        z.string().url("Image URL must be valid"),
        z.literal(""),
        z.null(),
      ])
      .optional(),
    videoUrl: z
      .union([
        z.string().url("Video URL must be valid"),
        z.literal(""),
        z.null(),
      ])
      .optional(),
    videoMuted: z.boolean().optional(),
    videoOrientation: z.enum(BANNER_VIDEO_ORIENTATIONS).nullable().optional(),
    link: z
      .string()
      .url("Please enter a valid URL (e.g., https://www.example.com)"),
    placements: z
      .array(z.string())
      .min(1, "At least one page placement is required"),
    tier: z.enum(["1month", "3months", "6months", "12months"]),
  });

export const insertBannerAdSchema = createInsertSchema(bannerAds)
  .omit({
    id: true,
    impressions: true,
    clicks: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    placements: z
      .array(z.string())
      .min(1, "At least one page placement is required"),
    imageUrl: z
      .string()
      .url("Image URL must be valid")
      .min(1, "Banner image is required"),
    videoUrl: z
      .union([
        z.string().url("Video URL must be valid"),
        z.literal(""),
        z.null(),
      ])
      .optional(),
    videoMuted: z.boolean().optional(),
    videoOrientation: z.enum(BANNER_VIDEO_ORIENTATIONS).nullable().optional(),
    link: z
      .string()
      .url("Please enter a valid URL (e.g., https://www.example.com)"),
    title: z.string().min(1, "Title is required"),
    description: z
      .union([z.string().max(240), z.literal(""), z.null()])
      .optional(),
    adCopy: z.union([z.string().max(800), z.literal(""), z.null()]).optional(),
    instagramUrl: z
      .union([z.string().max(240), z.literal(""), z.null()])
      .optional(),
    facebookUrl: z
      .union([z.string().max(240), z.literal(""), z.null()])
      .optional(),
  });

export const insertJobApplicationSchema = createInsertSchema(jobApplications)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    status: true,
    employerNotes: true,
  })
  .extend({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().optional(),
    coverLetter: z.string().optional(),
    resumeUrl: z.string().min(1, "Resume is required"),
  });

export const insertPromoAlertSchema = createInsertSchema(promoAlerts)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    title: z.string().min(1, "Title is required"),
    message: z.string().min(1, "Message is required"),
    promoCode: z.string().optional(),
    variant: z
      .enum(["info", "success", "warning", "destructive"])
      .default("info"),
  });

export const insertAviationEventSchema = createInsertSchema(aviationEvents)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    isSample: true,
  })
  .extend({
    title: z.string().min(3, "Title is required"),
    description: z.string().min(20, "Description is required"),
    location: z.string().min(3, "Location is required"),
    category: z.string().min(2, "Category is required"),
    eventUrl: z
      .string()
      .url("Event URL must be valid")
      .optional()
      .or(z.literal("")),
    imageUrl: z
      .string()
      .url("Image URL must be valid")
      .optional()
      .or(z.literal("")),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  });

export const insertAnalyticsEventSchema = createInsertSchema(
  analyticsEvents,
).omit({
  id: true,
  createdAt: true,
});

export const insertPartnerRedirectSchema = createInsertSchema(
  partnerRedirects,
).omit({
  id: true,
  createdAt: true,
});

export const insertWithdrawalRequestSchema = createInsertSchema(
  withdrawalRequests,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    status: true,
    payoutBatchId: true,
    payoutItemId: true,
    transactionId: true,
    processedAt: true,
    processedBy: true,
    failureReason: true,
    adminNotes: true,
  })
  .extend({
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid number"),
    paypalEmail: z.string().email("Valid PayPal email is required"),
  });

export const insertPaypalOrderConsumptionSchema = createInsertSchema(
  paypalOrderConsumptions,
).omit({
  id: true,
  createdAt: true,
  status: true,
});

// Select types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;

export type TipsUser = typeof tipsUsers.$inferSelect;
export type InsertTipsUser = z.infer<typeof insertTipsUserSchema>;
export type TipEntry = typeof tipEntries.$inferSelect;
export type InsertTipEntry = z.infer<typeof insertTipEntrySchema>;
export type TipEntryAttachment = typeof tipEntryAttachments.$inferSelect;
export type InsertTipEntryAttachment = z.infer<
  typeof insertTipEntryAttachmentSchema
>;
export type TipDailyReportAttachment =
  typeof tipDailyReportAttachments.$inferSelect;
export type InsertTipDailyReportAttachment = z.infer<
  typeof insertTipDailyReportAttachmentSchema
>;
export type TipGridSubmission = typeof tipGridSubmissions.$inferSelect;
export type InsertTipGridSubmission = z.infer<
  typeof insertTipGridSubmissionSchema
>;
export type TipGridDaySummary = typeof tipGridDaySummaries.$inferSelect;
export type InsertTipGridDaySummary = z.infer<
  typeof insertTipGridDaySummarySchema
>;
export type TipBanquetReport = typeof tipBanquetReports.$inferSelect;
export type InsertTipBanquetReport = z.infer<
  typeof insertTipBanquetReportSchema
>;
export type TipsKioskSetting = typeof tipsKioskSettings.$inferSelect;
export type InsertTipsKioskSetting = z.infer<
  typeof insertTipsKioskSettingSchema
>;
export type TipPeriodSubmission = typeof tipPeriodSubmissions.$inferSelect;
export type InsertTipPeriodSubmission = z.infer<
  typeof insertTipPeriodSubmissionSchema
>;
export type TipAdminAction = typeof tipAdminActions.$inferSelect;
export type InsertTipAdminAction = z.infer<typeof insertTipAdminActionSchema>;
export type ScheduleEmployee = typeof scheduleEmployees.$inferSelect;
export type InsertScheduleEmployee = z.infer<
  typeof insertScheduleEmployeeSchema
>;
export type ScheduleShiftType = typeof scheduleShiftTypes.$inferSelect;
export type InsertScheduleShiftType = z.infer<
  typeof insertScheduleShiftTypeSchema
>;
export type WeeklySchedule = typeof weeklySchedules.$inferSelect;
export type InsertWeeklySchedule = z.infer<typeof insertWeeklyScheduleSchema>;
export type ScheduleForecastDay = typeof scheduleForecastDays.$inferSelect;
export type InsertScheduleForecastDay = z.infer<
  typeof insertScheduleForecastDaySchema
>;
export type ScheduleShiftAssignment =
  typeof scheduleShiftAssignments.$inferSelect;
export type InsertScheduleShiftAssignment = z.infer<
  typeof insertScheduleShiftAssignmentSchema
>;
export type ScheduleTemplate = typeof scheduleTemplates.$inferSelect;
export type InsertScheduleTemplate = z.infer<
  typeof insertScheduleTemplateSchema
>;
export type ScheduleTemplateShift = typeof scheduleTemplateShifts.$inferSelect;
export type InsertScheduleTemplateShift = z.infer<
  typeof insertScheduleTemplateShiftSchema
>;
export type ScheduleShareLink = typeof scheduleShareLinks.$inferSelect;
export type InsertScheduleShareLink = z.infer<
  typeof insertScheduleShareLinkSchema
>;
export type ScheduleRequest = typeof scheduleRequests.$inferSelect;
export type InsertScheduleRequest = z.infer<typeof insertScheduleRequestSchema>;
export type ScheduleHousekeepingBoard =
  typeof scheduleHousekeepingBoards.$inferSelect;
export type InsertScheduleHousekeepingBoard = z.infer<
  typeof insertScheduleHousekeepingBoardSchema
>;
export type ScheduleAuditLog = typeof scheduleAuditLog.$inferSelect;
export type InsertScheduleAuditLog = z.infer<
  typeof insertScheduleAuditLogSchema
>;
export type CourtyardBudgetUpload = typeof courtyardBudgetUploads.$inferSelect;
export type InsertCourtyardBudgetUpload = z.infer<
  typeof insertCourtyardBudgetUploadSchema
>;
export type CourtyardBudgetLineItem =
  typeof courtyardBudgetLineItems.$inferSelect;
export type InsertCourtyardBudgetLineItem = z.infer<
  typeof insertCourtyardBudgetLineItemSchema
>;
export type CourtyardBudgetCheckbookEntry =
  typeof courtyardBudgetCheckbookEntries.$inferSelect;
export type InsertCourtyardBudgetCheckbookEntry = z.infer<
  typeof insertCourtyardBudgetCheckbookEntrySchema
>;
export type CourtyardBudgetAuditLog =
  typeof courtyardBudgetAuditLog.$inferSelect;
export type InsertCourtyardBudgetAuditLog = z.infer<
  typeof insertCourtyardBudgetAuditLogSchema
>;

export type AdminInvite = typeof adminInvites.$inferSelect;
export type InsertAdminInvite = z.infer<typeof insertAdminInviteSchema>;

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = z.infer<typeof insertRefreshTokenSchema>;

export type OAuthExchangeToken = typeof oauthExchangeTokens.$inferSelect;
export type InsertOAuthExchangeToken = z.infer<
  typeof insertOAuthExchangeTokenSchema
>;

export type AircraftListing = typeof aircraftListings.$inferSelect;
export type InsertAircraftListing = z.infer<typeof insertAircraftListingSchema>;

export type MarketplaceListing = typeof marketplaceListings.$inferSelect;
export type InsertMarketplaceListing = z.infer<
  typeof insertMarketplaceListingSchema
>;

export type Rental = typeof rentals.$inferSelect;
export type InsertRental = z.infer<typeof insertRentalSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type AirportFavorite = typeof airportFavorites.$inferSelect;
export type InsertAirportFavorite = z.infer<typeof insertAirportFavoriteSchema>;

export type Transaction = typeof transactions.$inferSelect;

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;

export type PartnerRedirect = typeof partnerRedirects.$inferSelect;
export type PartnerToolMetric = typeof partnerToolMetrics.$inferSelect;
export type InsertPartnerRedirect = z.infer<typeof insertPartnerRedirectSchema>;

export type Notam = typeof notams.$inferSelect;
export type NotamIngestEvent = typeof notamIngestEvents.$inferSelect;
export type TfmsEvent = typeof tfmsEvents.$inferSelect;
export type TfmsOverlay = typeof tfmsOverlays.$inferSelect;

export type PaypalOrderConsumption =
  typeof paypalOrderConsumptions.$inferSelect;
export type InsertPaypalOrderConsumption = z.infer<
  typeof insertPaypalOrderConsumptionSchema
>;

export type VerificationSubmission =
  typeof verificationSubmissions.$inferSelect;
export type InsertVerificationSubmission = Omit<
  VerificationSubmission,
  "id" | "createdAt" | "updatedAt"
>;

export type CrmLead = typeof crmLeads.$inferSelect;
export type InsertCrmLead = z.infer<typeof insertCrmLeadSchema>;

export type CrmContact = typeof crmContacts.$inferSelect;
export type InsertCrmContact = z.infer<typeof insertCrmContactSchema>;

export type CrmDeal = typeof crmDeals.$inferSelect;
export type InsertCrmDeal = z.infer<typeof insertCrmDealSchema>;

export type CrmActivity = typeof crmActivities.$inferSelect;
export type InsertCrmActivity = z.infer<typeof insertCrmActivitySchema>;

export type CrmWeeklyReport = typeof crmWeeklyReports.$inferSelect;
export type InsertCrmWeeklyReport = z.infer<typeof insertCrmWeeklyReportSchema>;

export type PromoCode = typeof promoCodes.$inferSelect;
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;

export type PromoCodeUsage = typeof promoCodeUsages.$inferSelect;
export type InsertPromoCodeUsage = typeof promoCodeUsages.$inferInsert;
export type MembershipPartnerOffer =
  typeof membershipPartnerOffers.$inferSelect;
export type InsertMembershipPartnerOffer = z.infer<
  typeof insertMembershipPartnerOfferSchema
>;
export type MembershipPartnerOfferMember =
  typeof membershipPartnerOfferMembers.$inferSelect;
export type InsertMembershipPartnerOfferMember =
  typeof membershipPartnerOfferMembers.$inferInsert;
export type MembershipPromotion = typeof membershipPromotions.$inferSelect;
export type InsertMembershipPromotion = z.infer<
  typeof insertMembershipPromotionSchema
>;
export type MembershipPromotionRedemption =
  typeof membershipPromotionRedemptions.$inferSelect;
export type InsertMembershipPromotionRedemption =
  typeof membershipPromotionRedemptions.$inferInsert;
export type AiToolUsage = typeof aiToolUsages.$inferSelect;
export type InsertAiToolUsage = typeof aiToolUsages.$inferInsert;

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type PersonalFinanceEntry = typeof personalFinanceEntries.$inferSelect;
export type InsertPersonalFinanceEntry = z.infer<
  typeof insertPersonalFinanceEntrySchema
>;
export type PersonalFinanceBudget = typeof personalFinanceBudgets.$inferSelect;
export type InsertPersonalFinanceBudget = z.infer<
  typeof insertPersonalFinanceBudgetSchema
>;

export type AdminNotification = typeof adminNotifications.$inferSelect;
export type InsertAdminNotification = z.infer<
  typeof insertAdminNotificationSchema
>;

export type BannerAdOrder = typeof bannerAdOrders.$inferSelect;
export type InsertBannerAdOrder = z.infer<typeof insertBannerAdOrderSchema>;

export type BannerAd = typeof bannerAds.$inferSelect;
export type InsertBannerAd = z.infer<typeof insertBannerAdSchema>;

export type JobApplication = typeof jobApplications.$inferSelect;
export type InsertJobApplication = z.infer<typeof insertJobApplicationSchema>;

export type PromoAlert = typeof promoAlerts.$inferSelect;
export type InsertPromoAlert = z.infer<typeof insertPromoAlertSchema>;
export type AviationEvent = typeof aviationEvents.$inferSelect;
export type InsertAviationEvent = z.infer<typeof insertAviationEventSchema>;

export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type InsertWithdrawalRequest = z.infer<
  typeof insertWithdrawalRequestSchema
>;
export type LogbookEntry = typeof logbookEntries.$inferSelect;
export type InsertLogbookEntry = z.infer<typeof insertLogbookEntrySchema>;
export type LogbookProSettings = typeof logbookProSettings.$inferSelect;
export type InsertLogbookProSettings = z.infer<
  typeof insertLogbookProSettingsSchema
>;
export type LogbookArchive = typeof logbookArchives.$inferSelect;
export type InsertLogbookArchive = z.infer<typeof insertLogbookArchiveSchema>;
export type NotificationPreferences =
  typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = z.infer<
  typeof insertNotificationPreferencesSchema
>;
export type CfiProfile = typeof cfiProfiles.$inferSelect;
export type InsertCfiProfile = z.infer<typeof insertCfiProfileSchema>;
export type CfiSchool = typeof cfiSchools.$inferSelect;
export type InsertCfiSchool = z.infer<typeof insertCfiSchoolSchema>;
export type CfiSchoolMember = typeof cfiSchoolMembers.$inferSelect;
export type InsertCfiSchoolMember = z.infer<typeof insertCfiSchoolMemberSchema>;
export type CfiCredential = typeof cfiCredentials.$inferSelect;
export type InsertCfiCredential = z.infer<typeof insertCfiCredentialSchema>;
export type CfiAvailabilityRule = typeof cfiAvailabilityRules.$inferSelect;
export type InsertCfiAvailabilityRule = z.infer<
  typeof insertCfiAvailabilityRuleSchema
>;
export type CfiBookingRequest = typeof cfiBookingRequests.$inferSelect;
export type InsertCfiBookingRequest = z.infer<
  typeof insertCfiBookingRequestSchema
>;
export type CfiStudent = typeof cfiStudents.$inferSelect;
export type InsertCfiStudent = z.infer<typeof insertCfiStudentSchema>;
export type CfiLessonTemplate = typeof cfiLessonTemplates.$inferSelect;
export type InsertCfiLessonTemplate = z.infer<
  typeof insertCfiLessonTemplateSchema
>;
export type CfiLesson = typeof cfiLessons.$inferSelect;
export type InsertCfiLesson = z.infer<typeof insertCfiLessonSchema>;
export type CfiStudentFile = typeof cfiStudentFiles.$inferSelect;
export type InsertCfiStudentFile = z.infer<typeof insertCfiStudentFileSchema>;
export type CfiStudentMilestone = typeof cfiStudentMilestones.$inferSelect;
export type InsertCfiStudentMilestone = z.infer<
  typeof insertCfiStudentMilestoneSchema
>;
export type CfiStudentEndorsement = typeof cfiStudentEndorsements.$inferSelect;
export type InsertCfiStudentEndorsement = z.infer<
  typeof insertCfiStudentEndorsementSchema
>;
export type CfiConversation = typeof cfiConversations.$inferSelect;
export type InsertCfiConversation = z.infer<typeof insertCfiConversationSchema>;
export type CfiMessage = typeof cfiMessages.$inferSelect;
export type InsertCfiMessage = z.infer<typeof insertCfiMessageSchema>;
export type CfiLegalAcceptance = typeof cfiLegalAcceptances.$inferSelect;
export type InsertCfiLegalAcceptance = z.infer<
  typeof insertCfiLegalAcceptanceSchema
>;
export type FlyingClub = typeof flyingClubs.$inferSelect;
export type InsertFlyingClub = z.infer<typeof insertFlyingClubSchema>;
export type FlyingClubMember = typeof flyingClubMembers.$inferSelect;
export type InsertFlyingClubMember = z.infer<
  typeof insertFlyingClubMemberSchema
>;
export type FlyingClubJoinRequest = typeof flyingClubJoinRequests.$inferSelect;
export type InsertFlyingClubJoinRequest = z.infer<
  typeof insertFlyingClubJoinRequestSchema
>;
export type FlyingClubAircraft = typeof flyingClubAircraft.$inferSelect;
export type InsertFlyingClubAircraft = z.infer<
  typeof insertFlyingClubAircraftSchema
>;
export type FlyingClubReservation = typeof flyingClubReservations.$inferSelect;
export type InsertFlyingClubReservation = z.infer<
  typeof insertFlyingClubReservationSchema
>;
export type FlyingClubAnnouncement =
  typeof flyingClubAnnouncements.$inferSelect;
export type InsertFlyingClubAnnouncement = z.infer<
  typeof insertFlyingClubAnnouncementSchema
>;
export type FlyingClubDocument = typeof flyingClubDocuments.$inferSelect;
export type InsertFlyingClubDocument = z.infer<
  typeof insertFlyingClubDocumentSchema
>;
export type FlyingClubLegalAcceptance =
  typeof flyingClubLegalAcceptances.$inferSelect;
export type InsertFlyingClubLegalAcceptance = z.infer<
  typeof insertFlyingClubLegalAcceptanceSchema
>;
export type FlyingClubSquawk = typeof flyingClubSquawks.$inferSelect;
export type InsertFlyingClubSquawk = z.infer<
  typeof insertFlyingClubSquawkSchema
>;
export type FlyingClubMaintenanceItem =
  typeof flyingClubMaintenanceItems.$inferSelect;
export type InsertFlyingClubMaintenanceItem = z.infer<
  typeof insertFlyingClubMaintenanceItemSchema
>;
export type FlyingClubBlackout = typeof flyingClubBlackouts.$inferSelect;
export type InsertFlyingClubBlackout = z.infer<
  typeof insertFlyingClubBlackoutSchema
>;
export type FuelPriceReport = typeof fuelPriceReports.$inferSelect;
export type NewFuelPriceReport = typeof fuelPriceReports.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type PushToken = typeof pushTokens.$inferSelect;
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;
export type UserNotification = typeof userNotifications.$inferSelect;
export type InsertUserNotification = z.infer<
  typeof insertUserNotificationSchema
>;
export type Endorsement = typeof endorsements.$inferSelect;
export type InsertEndorsement = z.infer<typeof insertEndorsementSchema>;
export type RadioCommsSession = typeof radioCommsSessions.$inferSelect;
export type InsertRadioCommsSession = z.infer<
  typeof insertRadioCommsSessionSchema
>;
export type StudentProfile = typeof studentProfiles.$inferSelect;
export type InsertStudentProfile = z.infer<typeof insertStudentProfileSchema>;
export type FlightPlan = typeof flightPlans.$inferSelect;
export type InsertFlightPlan = z.infer<typeof insertFlightPlanSchema>;
export type AircraftType = typeof aircraftTypes.$inferSelect;
export type InsertAircraftType = z.infer<typeof insertAircraftTypeSchema>;
export type AircraftProfile = typeof aircraftProfiles.$inferSelect;
export type InsertAircraftProfile = z.infer<typeof insertAircraftProfileSchema>;
export type AviationBriefing = typeof aviationBriefings.$inferSelect;
export type ApproachPlate = typeof approachPlates.$inferSelect;
export type InsertApproachPlate = z.infer<typeof insertApproachPlateSchema>;

// Enum types
export type CertificationType = (typeof certificationTypes)[number];
export type AircraftCategory = (typeof aircraftCategories)[number];
export type EngineType = (typeof engineTypes)[number];
export type MarketplaceCategory = (typeof marketplaceCategories)[number];
export type RentalStatus = (typeof rentalStatuses)[number];
export type LeadStatus = (typeof leadStatuses)[number];
export type DealStage = (typeof dealStages)[number];
export type ActivityType = (typeof activityTypes)[number];
export type LeadSource = (typeof leadSources)[number];
export type LeadCategory = (typeof leadCategories)[number];
export type CrmSalesEmailTemplateType =
  (typeof crmSalesEmailTemplateTypes)[number];
export type CrmWeeklyReportStatus = (typeof crmWeeklyReportStatuses)[number];
export type FlightPlanFilingStatus = (typeof flightPlanFilingStatuses)[number];
export type FlightPlanFilingAction = (typeof flightPlanFilingActions)[number];
export type FlyingClubStatus = (typeof flyingClubStatuses)[number];
export type FlyingClubVisibility = (typeof flyingClubVisibility)[number];
export type FlyingClubMemberRole = (typeof flyingClubMemberRoles)[number];
export type FlyingClubMemberStatus = (typeof flyingClubMemberStatuses)[number];
export type FlyingClubAircraftStatus =
  (typeof flyingClubAircraftStatuses)[number];
export type FlyingClubReservationStatus =
  (typeof flyingClubReservationStatuses)[number];
export type FlyingClubJoinRequestStatus =
  (typeof flyingClubJoinRequestStatuses)[number];
export type FlyingClubSquawkStatus = (typeof flyingClubSquawkStatuses)[number];
export type FlyingClubSquawkSeverity =
  (typeof flyingClubSquawkSeverities)[number];
export type FlyingClubMaintenanceItemType =
  (typeof flyingClubMaintenanceItemTypes)[number];
export type FlyingClubMaintenanceStatus =
  (typeof flyingClubMaintenanceStatuses)[number];
export type FlyingClubBlackoutStatus =
  (typeof flyingClubBlackoutStatuses)[number];
export type ExpenseCategory = (typeof expenseCategories)[number];
export type PersonalFinanceOwner = (typeof personalFinanceOwners)[number];
export type PersonalFinanceEntryType =
  (typeof personalFinanceEntryTypes)[number];
export type PersonalFinanceRecurringFrequency =
  (typeof personalFinanceRecurringFrequencies)[number];
export type PersonalFinanceExpenseCategory =
  (typeof personalFinanceExpenseCategories)[number];
export type PersonalFinanceIncomeCategory =
  (typeof personalFinanceIncomeCategories)[number];
export type PersonalFinanceRsfCategory =
  (typeof personalFinanceRsfCategories)[number];
export type WithdrawalStatus = (typeof withdrawalStatuses)[number];
