var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  BANNER_APPROVAL_STATUSES: () => BANNER_APPROVAL_STATUSES,
  BANNER_PAYMENT_STATUSES: () => BANNER_PAYMENT_STATUSES,
  activityTypes: () => activityTypes,
  adminNotifications: () => adminNotifications,
  aircraftCategories: () => aircraftCategories,
  aircraftListings: () => aircraftListings,
  bannerAdOrders: () => bannerAdOrders,
  bannerAds: () => bannerAds,
  certificationTypes: () => certificationTypes,
  contactSubmissions: () => contactSubmissions,
  crmActivities: () => crmActivities,
  crmContacts: () => crmContacts,
  crmDeals: () => crmDeals,
  crmLeads: () => crmLeads,
  dealStages: () => dealStages,
  engineTypes: () => engineTypes,
  expenseCategories: () => expenseCategories,
  expenses: () => expenses,
  favorites: () => favorites,
  insertAdminNotificationSchema: () => insertAdminNotificationSchema,
  insertAircraftListingSchema: () => insertAircraftListingSchema,
  insertBannerAdOrderSchema: () => insertBannerAdOrderSchema,
  insertBannerAdSchema: () => insertBannerAdSchema,
  insertContactSubmissionSchema: () => insertContactSubmissionSchema,
  insertCrmActivitySchema: () => insertCrmActivitySchema,
  insertCrmContactSchema: () => insertCrmContactSchema,
  insertCrmDealSchema: () => insertCrmDealSchema,
  insertCrmLeadSchema: () => insertCrmLeadSchema,
  insertExpenseSchema: () => insertExpenseSchema,
  insertFavoriteSchema: () => insertFavoriteSchema,
  insertJobApplicationSchema: () => insertJobApplicationSchema,
  insertLogbookEntrySchema: () => insertLogbookEntrySchema,
  insertMarketplaceFlagSchema: () => insertMarketplaceFlagSchema,
  insertMarketplaceListingSchema: () => insertMarketplaceListingSchema,
  insertMessageSchema: () => insertMessageSchema,
  insertOAuthExchangeTokenSchema: () => insertOAuthExchangeTokenSchema,
  insertPromoAlertSchema: () => insertPromoAlertSchema,
  insertPromoCodeSchema: () => insertPromoCodeSchema,
  insertRefreshTokenSchema: () => insertRefreshTokenSchema,
  insertRentalSchema: () => insertRentalSchema,
  insertReviewSchema: () => insertReviewSchema,
  insertUserSchema: () => insertUserSchema,
  insertWithdrawalRequestSchema: () => insertWithdrawalRequestSchema,
  jobApplications: () => jobApplications,
  leadSources: () => leadSources,
  leadStatuses: () => leadStatuses,
  listingTiers: () => listingTiers,
  logbookEntries: () => logbookEntries,
  marketplaceCategories: () => marketplaceCategories,
  marketplaceFlags: () => marketplaceFlags,
  marketplaceListings: () => marketplaceListings,
  messages: () => messages,
  oauthExchangeTokens: () => oauthExchangeTokens,
  promoAlerts: () => promoAlerts,
  promoCodeUsages: () => promoCodeUsages,
  promoCodes: () => promoCodes,
  refreshTokens: () => refreshTokens,
  rentalStatuses: () => rentalStatuses,
  rentals: () => rentals,
  reviews: () => reviews,
  sessions: () => sessions,
  transactions: () => transactions,
  users: () => users,
  verificationSubmissions: () => verificationSubmissions,
  withdrawalRequests: () => withdrawalRequests,
  withdrawalStatuses: () => withdrawalStatuses
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, decimal, jsonb, index, uniqueIndex, foreignKey, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var certificationTypes, aircraftCategories, engineTypes, marketplaceCategories, rentalStatuses, listingTiers, leadStatuses, dealStages, activityTypes, leadSources, expenseCategories, withdrawalStatuses, sessions, refreshTokens, oauthExchangeTokens, users, aircraftListings, marketplaceListings, marketplaceFlags, jobApplications, promoAlerts, rentals, messages, reviews, favorites, transactions, withdrawalRequests, promoCodes, promoCodeUsages, expenses, adminNotifications, contactSubmissions, insertContactSubmissionSchema, BANNER_APPROVAL_STATUSES, BANNER_PAYMENT_STATUSES, bannerAdOrders, bannerAds, verificationSubmissions, crmLeads, crmContacts, crmDeals, crmActivities, insertUserSchema, insertRefreshTokenSchema, insertOAuthExchangeTokenSchema, insertAircraftListingSchema, insertMarketplaceListingSchema, logbookEntries, insertLogbookEntrySchema, insertMarketplaceFlagSchema, insertRentalSchema, insertMessageSchema, insertReviewSchema, insertFavoriteSchema, insertCrmLeadSchema, insertCrmContactSchema, insertCrmDealSchema, insertCrmActivitySchema, insertPromoCodeSchema, insertExpenseSchema, insertAdminNotificationSchema, insertBannerAdOrderSchema, insertBannerAdSchema, insertJobApplicationSchema, insertPromoAlertSchema, insertWithdrawalRequestSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    certificationTypes = ["PPL", "IR", "CPL", "Multi-Engine", "ATP", "CFI", "CFII", "MEI"];
    aircraftCategories = ["Single-Engine", "Multi-Engine", "Jet", "Turboprop", "Helicopter", "Seaplane"];
    engineTypes = ["Single-Engine", "Multi-Engine", "Turboprop", "Jet", "Rotor"];
    marketplaceCategories = ["aircraft-sale", "charter", "cfi", "flight-school", "mechanic", "job"];
    rentalStatuses = ["pending", "approved", "active", "completed", "cancelled"];
    listingTiers = ["basic", "standard", "premium"];
    leadStatuses = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"];
    dealStages = ["lead", "prospect", "proposal", "negotiation", "closed_won", "closed_lost"];
    activityTypes = ["call", "email", "meeting", "note", "task"];
    leadSources = ["website", "referral", "social_media", "advertising", "cold_outreach", "event", "other"];
    expenseCategories = ["server", "database", "storage", "api", "other"];
    withdrawalStatuses = ["pending", "processing", "completed", "failed", "cancelled"];
    sessions = pgTable(
      "sessions",
      {
        sid: varchar("sid").primaryKey(),
        sess: jsonb("sess").notNull(),
        expire: timestamp("expire").notNull()
      },
      (table) => [index("IDX_session_expire").on(table.expire)]
    );
    refreshTokens = pgTable("refresh_tokens", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      token: text("token").notNull().unique(),
      expiresAt: timestamp("expires_at").notNull(),
      createdAt: timestamp("created_at").defaultNow(),
      deviceInfo: text("device_info"),
      // Store device fingerprint for security
      ipAddress: text("ip_address")
    }, (table) => [
      index("idx_refresh_tokens_user").on(table.userId),
      index("idx_refresh_tokens_expires").on(table.expiresAt)
    ]);
    oauthExchangeTokens = pgTable("oauth_exchange_tokens", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      token: text("token").notNull().unique(),
      userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      expiresAt: timestamp("expires_at").notNull(),
      createdAt: timestamp("created_at").defaultNow()
    }, (table) => [
      index("idx_oauth_exchange_tokens_token").on(table.token),
      index("idx_oauth_exchange_tokens_expires").on(table.expiresAt)
    ]);
    users = pgTable(
      "users",
      {
        // Auth fields (from blueprint - REQUIRED)
        id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
        email: varchar("email").unique(),
        firstName: varchar("first_name"),
        lastName: varchar("last_name"),
        profileImageUrl: varchar("profile_image_url"),
        // Additional user fields
        phone: text("phone"),
        // Pilot information
        certifications: text("certifications").array().notNull().default(sql`ARRAY[]::text[]`),
        totalFlightHours: integer("total_flight_hours").default(0),
        aircraftTypesFlown: text("aircraft_types_flown").array().default(sql`ARRAY[]::text[]`),
        // Document uploads (for quick profile access)
        pilotLicenseUrl: text("pilot_license_url"),
        insuranceUrl: text("insurance_url"),
        // Basic Verification (legacy - keep for backward compatibility)
        isVerified: boolean("is_verified").default(false),
        licenseVerified: boolean("license_verified").default(false),
        backgroundCheckCompleted: boolean("background_check_completed").default(false),
        isAdmin: boolean("is_admin").default(false),
        isSuperAdmin: boolean("is_super_admin").default(false),
        // Renter Verification (new comprehensive system)
        legalFirstName: text("legal_first_name"),
        legalLastName: text("legal_last_name"),
        dateOfBirth: text("date_of_birth"),
        // YYYY-MM-DD
        phoneVerified: boolean("phone_verified").default(false),
        emailVerified: boolean("email_verified").default(false),
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
        faaVerifiedMonth: text("faa_verified_month"),
        // MM/YYYY format
        faaVerifiedAt: timestamp("faa_verified_at"),
        // Bank/payout information
        bankAccountConnected: boolean("bank_account_connected").default(false),
        stripeAccountId: text("stripe_account_id"),
        paypalEmail: text("paypal_email"),
        // For PayPal Payouts
        // Balance tracking (for owner payouts)
        balance: decimal("balance", { precision: 10, scale: 2 }).default("0.00"),
        // Mobile app authentication (optional - for users who sign up via mobile)
        hashedPassword: text("hashed_password"),
        // bcrypt hash, null for Replit Auth only users
        passwordCreatedAt: timestamp("password_created_at"),
        // Email verification (for email/password auth)
        emailVerificationToken: text("email_verification_token"),
        emailVerificationExpires: timestamp("email_verification_expires"),
        // Rating information
        averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
        // 0.00-5.00
        totalReviews: integer("total_reviews").default(0),
        // Account suspension (for expired documents)
        isSuspended: boolean("is_suspended").default(false),
        suspensionReason: text("suspension_reason"),
        suspendedAt: timestamp("suspended_at"),
        suspendedBy: varchar("suspended_by"),
        // admin who suspended
        // Timestamps (from blueprint)
        createdAt: timestamp("created_at").defaultNow(),
        updatedAt: timestamp("updated_at").defaultNow()
      },
      (t) => ({
        usersSuspendedByFk: foreignKey({
          columns: [t.suspendedBy],
          foreignColumns: [t.id]
        })
      })
    );
    aircraftListings = pgTable("aircraft_listings", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      ownerId: varchar("owner_id").notNull().references(() => users.id),
      // Aircraft details
      make: text("make").notNull(),
      model: text("model").notNull(),
      year: integer("year").notNull(),
      registration: text("registration").notNull(),
      category: text("category").notNull(),
      // Single-Engine, Multi-Engine, etc.
      // Technical specs
      totalTime: integer("total_time").notNull(),
      // hours
      engine: text("engine"),
      avionicsSuite: text("avionics_suite"),
      // Required certifications
      requiredCertifications: text("required_certifications").array().notNull(),
      minFlightHours: integer("min_flight_hours").default(0),
      // Pricing
      hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull(),
      insuranceIncluded: boolean("insurance_included").default(true),
      wetRate: boolean("wet_rate").default(true),
      // includes fuel
      // Images
      images: text("images").array().notNull(),
      // Location (structured for filtering)
      location: text("location").notNull(),
      // Legacy field, keep for backward compatibility
      city: text("city"),
      state: text("state"),
      zipCode: text("zip_code"),
      latitude: decimal("latitude", { precision: 10, scale: 7 }),
      longitude: decimal("longitude", { precision: 10, scale: 7 }),
      airportCode: text("airport_code"),
      // Aircraft Specifications (for filtering)
      engineType: text("engine_type"),
      // Single-Engine, Multi-Engine, Turboprop, Jet
      engineCount: integer("engine_count"),
      // Number of engines
      seatingCapacity: integer("seating_capacity"),
      // Number of seats
      // Listing details
      description: text("description"),
      isListed: boolean("is_listed").default(true),
      // Admin management
      adminNotes: text("admin_notes"),
      isFeatured: boolean("is_featured").default(false),
      // Owner metrics
      responseTime: integer("response_time_hours").default(24),
      acceptanceRate: integer("acceptance_rate").default(100),
      // Owner/Aircraft Verification
      serialNumber: text("serial_number"),
      registrationDocUrl: text("registration_doc_url"),
      // AC 8050-3 or 8050-64
      llcAuthorizationUrl: text("llc_authorization_url"),
      // If LLC owns aircraft
      ownershipVerified: boolean("ownership_verified").default(false),
      ownershipVerifiedAt: timestamp("ownership_verified_at"),
      registryCheckedAt: timestamp("registry_checked_at"),
      ownerNameMatch: boolean("owner_name_match"),
      // Maintenance & Inspections
      annualInspectionDocUrl: text("annual_inspection_doc_url"),
      annualInspectionDate: text("annual_inspection_date"),
      // YYYY-MM-DD
      annualDueDate: text("annual_due_date"),
      // YYYY-MM-DD (computed)
      annualSignerName: text("annual_signer_name"),
      annualSignerCertNumber: text("annual_signer_cert_number"),
      annualSignerIaNumber: text("annual_signer_ia_number"),
      annualApVerified: boolean("annual_ap_verified").default(false),
      // 100-Hour (if applicable)
      requires100Hour: boolean("requires_100_hour").default(false),
      hour100InspectionDocUrl: text("hour_100_inspection_doc_url"),
      hour100InspectionTach: integer("hour_100_inspection_tach"),
      currentTach: integer("current_tach"),
      hour100Remaining: integer("hour_100_remaining"),
      // computed
      // Maintenance Tracking (optional)
      maintenanceTrackingProvider: text("maintenance_tracking_provider"),
      // CAMP, Traxxall, etc.
      maintenanceTrackingDocUrl: text("maintenance_tracking_doc_url"),
      hasMaintenanceTracking: boolean("has_maintenance_tracking").default(false),
      // Verification Status
      maintenanceVerified: boolean("maintenance_verified").default(false),
      maintenanceVerifiedAt: timestamp("maintenance_verified_at"),
      // Stale listing tracking
      lastRefreshedAt: timestamp("last_refreshed_at").defaultNow(),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    }, (table) => [
      index("idx_aircraft_city").on(table.city),
      index("idx_aircraft_is_listed").on(table.isListed),
      index("idx_aircraft_category").on(table.category),
      index("idx_aircraft_engine_type").on(table.engineType),
      index("idx_aircraft_city_engine_type").on(table.city, table.engineType),
      index("idx_aircraft_category_city").on(table.category, table.city)
    ]);
    marketplaceListings = pgTable("marketplace_listings", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id),
      category: text("category").notNull(),
      // aircraft-sale, charter, cfi, flight-school, mechanic, job
      tier: text("tier"),
      // basic, standard, premium (for aircraft sales)
      // Common fields
      title: text("title").notNull(),
      description: text("description").notNull(),
      images: text("images").array().default(sql`ARRAY[]::text[]`),
      // Location (structured for filtering)
      location: text("location"),
      // Legacy field for display
      city: text("city"),
      state: text("state"),
      zipCode: text("zip_code"),
      latitude: decimal("latitude", { precision: 10, scale: 7 }),
      longitude: decimal("longitude", { precision: 10, scale: 7 }),
      contactEmail: text("contact_email"),
      contactPhone: text("contact_phone"),
      // Category-specific data (stored as JSON)
      details: jsonb("details"),
      // Contains category-specific fields
      // Pricing
      price: decimal("price", { precision: 12, scale: 2 }),
      // For sales, hourly rate, etc.
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
      upgradeTransactions: text("upgrade_transactions").array().default(sql`ARRAY[]::text[]`),
      // Promotional free period (admin customer service gesture)
      promoFreeUntil: timestamp("promo_free_until"),
      promoGrantedBy: varchar("promo_granted_by").references(() => users.id),
      promoGrantedAt: timestamp("promo_granted_at"),
      // Stale listing tracking
      lastRefreshedAt: timestamp("last_refreshed_at").defaultNow(),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    }, (table) => [
      index("idx_marketplace_category").on(table.category),
      index("idx_marketplace_city").on(table.city),
      index("idx_marketplace_is_active").on(table.isActive),
      index("idx_marketplace_category_city").on(table.category, table.city),
      index("idx_marketplace_category_active").on(table.category, table.isActive),
      index("idx_marketplace_flag_count").on(table.flagCount)
    ]);
    marketplaceFlags = pgTable("marketplace_flags", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      listingId: varchar("listing_id").notNull().references(() => marketplaceListings.id, { onDelete: "cascade" }),
      userId: varchar("user_id").notNull().references(() => users.id),
      reason: text("reason"),
      // Optional reason for flagging
      createdAt: timestamp("created_at").defaultNow()
    }, (table) => [
      // Unique constraint: one flag per user per listing
      uniqueIndex("idx_marketplace_flags_unique").on(table.listingId, table.userId)
    ]);
    jobApplications = pgTable("job_applications", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      listingId: varchar("listing_id").notNull().references(() => marketplaceListings.id, { onDelete: "cascade" }),
      applicantId: varchar("applicant_id").references(() => users.id),
      // null if not logged in
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
      status: text("status").default("new").notNull(),
      // new, reviewed, shortlisted, rejected, contacted
      // Employer notes
      employerNotes: text("employer_notes"),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    }, (table) => [
      index("idx_job_applications_listing").on(table.listingId),
      index("idx_job_applications_applicant").on(table.applicantId),
      index("idx_job_applications_status").on(table.status)
    ]);
    promoAlerts = pgTable("promo_alerts", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      // Alert details
      title: text("title").notNull(),
      message: text("message").notNull(),
      promoCode: text("promo_code"),
      // Optional promo code to display
      // Display settings
      isEnabled: boolean("is_enabled").default(true),
      showOnMainPage: boolean("show_on_main_page").default(true),
      showOnCategoryPages: boolean("show_on_category_pages").default(true),
      // Target categories (empty = all categories)
      targetCategories: text("target_categories").array().default(sql`ARRAY[]::text[]`),
      // Styling
      variant: text("variant").default("info"),
      // info, success, warning, destructive
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    rentals = pgTable("rentals", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      aircraftId: varchar("aircraft_id").notNull().references(() => aircraftListings.id),
      renterId: varchar("renter_id").notNull().references(() => users.id),
      ownerId: varchar("owner_id").notNull().references(() => users.id),
      // Rental details
      startDate: timestamp("start_date").notNull(),
      endDate: timestamp("end_date").notNull(),
      estimatedHours: decimal("estimated_hours", { precision: 6, scale: 2 }).notNull(),
      actualHours: decimal("actual_hours", { precision: 6, scale: 2 }),
      // Pricing
      hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull(),
      baseCost: decimal("base_cost", { precision: 10, scale: 2 }).notNull(),
      salesTax: decimal("sales_tax", { precision: 10, scale: 2 }).notNull(),
      // 8.25% of baseCost
      platformFeeRenter: decimal("platform_fee_renter", { precision: 10, scale: 2 }).notNull(),
      // 7.5% of baseCost
      platformFeeOwner: decimal("platform_fee_owner", { precision: 10, scale: 2 }).notNull(),
      // 7.5% of baseCost
      processingFee: decimal("processing_fee", { precision: 10, scale: 2 }).notNull(),
      // 3% of subtotal
      totalCostRenter: decimal("total_cost_renter", { precision: 10, scale: 2 }).notNull(),
      ownerPayout: decimal("owner_payout", { precision: 10, scale: 2 }).notNull(),
      // Status
      status: text("status").notNull().default("pending"),
      // pending, approved, active, completed, cancelled
      // Payment
      isPaid: boolean("is_paid").default(false),
      payoutCompleted: boolean("payout_completed").default(false),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    messages = pgTable("messages", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      rentalId: varchar("rental_id").notNull().references(() => rentals.id),
      senderId: varchar("sender_id").notNull().references(() => users.id),
      receiverId: varchar("receiver_id").notNull().references(() => users.id),
      content: text("content").notNull(),
      isRead: boolean("is_read").default(false),
      createdAt: timestamp("created_at").defaultNow()
    });
    reviews = pgTable("reviews", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      rentalId: varchar("rental_id").notNull().references(() => rentals.id),
      reviewerId: varchar("reviewer_id").notNull().references(() => users.id),
      // Who wrote the review
      revieweeId: varchar("reviewee_id").notNull().references(() => users.id),
      // Who is being reviewed
      // Rating (1-5 stars)
      rating: integer("rating").notNull(),
      // 1-5
      // Optional comment
      comment: text("comment"),
      // Review categories (optional detailed ratings)
      communicationRating: integer("communication_rating"),
      // 1-5
      cleanlinessRating: integer("cleanliness_rating"),
      // 1-5 (for aircraft condition)
      accuracyRating: integer("accuracy_rating"),
      // 1-5 (listing accuracy)
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    favorites = pgTable("favorites", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      // Type of listing favorited
      listingType: text("listing_type").notNull(),
      // "marketplace" or "aircraft"
      // ID of the favorited listing (polymorphic reference)
      listingId: varchar("listing_id").notNull(),
      createdAt: timestamp("created_at").defaultNow()
    }, (table) => ({
      idxFavoritesUser: index("idx_favorites_user").on(table.userId),
      idxFavoritesListing: index("idx_favorites_listing").on(table.listingType, table.listingId),
      // Unique constraint to ensure user can't favorite the same listing twice
      uniqueUserListing: uniqueIndex("idx_favorites_user_listing_unique").on(table.userId, table.listingType, table.listingId)
    }));
    transactions = pgTable("transactions", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id),
      type: text("type").notNull(),
      // rental_payout, listing_fee, platform_fee
      amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
      // Related entities
      rentalId: varchar("rental_id").references(() => rentals.id),
      marketplaceListingId: varchar("marketplace_listing_id").references(() => marketplaceListings.id),
      // Status
      status: text("status").notNull().default("pending"),
      // pending, completed, failed
      depositedToBankAt: timestamp("deposited_to_bank_at"),
      description: text("description"),
      createdAt: timestamp("created_at").defaultNow()
    });
    withdrawalRequests = pgTable("withdrawal_requests", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id),
      amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
      paypalEmail: text("paypal_email").notNull(),
      // Status tracking
      status: text("status").notNull().default("pending"),
      // pending, processing, completed, failed, cancelled
      // PayPal Payouts tracking
      payoutBatchId: text("payout_batch_id"),
      // PayPal batch ID
      payoutItemId: text("payout_item_id"),
      // PayPal item ID
      transactionId: text("transaction_id"),
      // PayPal transaction ID when completed
      // Processing
      processedAt: timestamp("processed_at"),
      processedBy: varchar("processed_by").references(() => users.id),
      // Admin who processed
      // Error handling
      failureReason: text("failure_reason"),
      // Admin notes
      adminNotes: text("admin_notes"),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    }, (table) => [
      index("idx_withdrawal_user").on(table.userId),
      index("idx_withdrawal_status").on(table.status)
    ]);
    promoCodes = pgTable("promo_codes", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      code: text("code").notNull().unique(),
      // Promo details
      description: text("description"),
      discountType: text("discount_type").notNull(),
      // "free_7_day", "percentage", "fixed_amount", "waive_creation_fee"
      discountValue: decimal("discount_value", { precision: 10, scale: 2 }),
      // For percentage or fixed amount
      // Usage limits
      maxUses: integer("max_uses"),
      // null = unlimited
      usedCount: integer("used_count").default(0),
      // Validity
      isActive: boolean("is_active").default(true),
      validFrom: timestamp("valid_from").defaultNow(),
      validUntil: timestamp("valid_until"),
      // Restrictions - applies to marketplace, banner_ads, or both
      applicableToMarketplace: boolean("applicable_to_marketplace").default(true),
      applicableToBannerAds: boolean("applicable_to_banner_ads").default(false),
      applicableCategories: text("applicable_categories").array().default(sql`ARRAY[]::text[]`),
      // empty = all categories
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    promoCodeUsages = pgTable("promo_code_usages", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      promoCodeId: varchar("promo_code_id").notNull().references(() => promoCodes.id),
      userId: varchar("user_id").references(() => users.id),
      // Optional - can be null for public banner ad orders
      marketplaceListingId: varchar("marketplace_listing_id").references(() => marketplaceListings.id),
      bannerAdOrderId: varchar("banner_ad_order_id").references(() => bannerAdOrders.id),
      createdAt: timestamp("created_at").defaultNow()
    });
    expenses = pgTable("expenses", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      category: text("category").notNull(),
      // server, database, storage, api, other
      amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
      description: text("description"),
      // Invoice document upload (optional)
      invoiceUrl: text("invoice_url"),
      // Date when expense was incurred (for time-based analytics)
      expenseDate: timestamp("expense_date").notNull().defaultNow(),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    adminNotifications = pgTable("admin_notifications", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      type: text("type").notNull(),
      // listing_threshold, verification_pending, flagged_listing, etc.
      category: text("category"),
      // marketplace category for listing_threshold notifications
      title: text("title").notNull(),
      message: text("message").notNull(),
      // Status
      isRead: boolean("is_read").default(false),
      isActionable: boolean("is_actionable").default(true),
      // false once admin addresses it
      // Metadata
      listingCount: integer("listing_count"),
      // For threshold notifications
      threshold: integer("threshold"),
      // The threshold that was reached
      createdAt: timestamp("created_at").defaultNow(),
      readAt: timestamp("read_at")
    });
    contactSubmissions = pgTable("contact_submissions", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
      createdAt: timestamp("created_at").defaultNow()
    }, (table) => [
      index("idx_contact_email").on(table.email),
      index("idx_contact_created").on(table.createdAt),
      index("idx_contact_ip").on(table.ipAddress)
    ]);
    insertContactSubmissionSchema = createInsertSchema(contactSubmissions).omit({
      id: true,
      emailSent: true,
      emailSentAt: true,
      createdAt: true
    });
    BANNER_APPROVAL_STATUSES = ["draft", "sent", "pending_review", "approved", "rejected"];
    BANNER_PAYMENT_STATUSES = ["pending", "paid", "refunded"];
    bannerAdOrders = pgTable("banner_ad_orders", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      // Sponsor information
      sponsorName: text("sponsor_name").notNull(),
      sponsorEmail: text("sponsor_email").notNull(),
      sponsorCompany: text("sponsor_company"),
      // Creative content (admin creates based on sponsor specs)
      title: text("title").notNull(),
      description: text("description"),
      // Tagline
      imageUrl: text("image_url"),
      // Created by admin, uploaded to object storage
      link: text("link").notNull(),
      // Sponsor's website
      // Placement preferences
      placements: text("placements").array().notNull().default(sql`ARRAY[]::text[]`),
      category: text("category"),
      // Pricing tier selected (1month, 3months, 6months, 12months)
      tier: text("tier").notNull(),
      monthlyRate: decimal("monthly_rate", { precision: 10, scale: 2 }).notNull(),
      // Snapshot of pricing
      totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
      // Total subscription cost
      creationFee: decimal("creation_fee", { precision: 10, scale: 2 }).default("40.00"),
      // One-time ad creation fee
      grandTotal: decimal("grand_total", { precision: 10, scale: 2 }).notNull(),
      // totalAmount + creationFee
      // Promo code and discounts
      promoCode: text("promo_code"),
      // Applied promo code (e.g., LAUNCH2025)
      discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0.00"),
      // Total discount applied
      // Workflow status
      approvalStatus: text("approval_status").notNull().default("draft"),
      // draft, sent, pending_review, approved, rejected
      paymentStatus: text("payment_status").notNull().default("pending"),
      // pending, paid, refunded
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
      updatedAt: timestamp("updated_at").defaultNow()
    }, (table) => [
      index("idx_banner_orders_status").on(table.approvalStatus, table.paymentStatus),
      index("idx_banner_orders_email").on(table.sponsorEmail)
    ]);
    bannerAds = pgTable("banner_ads", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      // Link to originating order
      orderId: varchar("order_id").references(() => bannerAdOrders.id),
      // Content (copied from approved order)
      title: text("title").notNull(),
      description: text("description"),
      // Optional tagline/description
      imageUrl: text("image_url").notNull(),
      // Stored in object storage
      link: text("link").notNull(),
      // Clickable link to sponsor's website
      // Placement - can show on multiple pages
      placements: text("placements").array().notNull().default(sql`ARRAY[]::text[]`),
      // Array of: homepage, marketplace, rentals, etc.
      category: text("category"),
      // For category-specific placements (marketplace categories)
      // Linked listing (optional - for promoting specific listings)
      listingId: varchar("listing_id"),
      listingType: text("listing_type"),
      // marketplace or rental
      // Scheduling
      isActive: boolean("is_active").default(true),
      startDate: timestamp("start_date").notNull(),
      endDate: timestamp("end_date"),
      // Set based on tier duration
      // Analytics
      impressions: integer("impressions").default(0),
      clicks: integer("clicks").default(0),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    }, (table) => [
      index("idx_banner_ads_placements").on(table.placements),
      index("idx_banner_ads_active").on(table.isActive),
      index("idx_banner_ads_dates").on(table.startDate, table.endDate),
      index("idx_banner_ads_order").on(table.orderId)
    ]);
    verificationSubmissions = pgTable("verification_submissions", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id),
      // Type of verification
      type: text("type").notNull(),
      // renter_identity, renter_payment, renter_pilot, owner_aircraft, owner_maintenance
      status: text("status").notNull().default("pending"),
      // pending, approved, rejected
      // Related entity (for owner verifications)
      aircraftId: varchar("aircraft_id").references(() => aircraftListings.id),
      // Submission data (stored as JSON for flexibility)
      submissionData: jsonb("submission_data").notNull(),
      // Documents uploaded with this submission
      documentUrls: text("document_urls").array().default(sql`ARRAY[]::text[]`),
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
      sources: text("sources").array().default(sql`ARRAY[]::text[]`),
      // e.g., ["FAA Aircraft Registry", "FAA Airmen Database"]
      fileHashes: text("file_hashes").array().default(sql`ARRAY[]::text[]`),
      // SHA-256 hashes of uploaded files
      // Document expiration tracking
      pilotLicenseExpiresAt: timestamp("pilot_license_expires_at"),
      medicalCertExpiresAt: timestamp("medical_cert_expires_at"),
      insuranceExpiresAt: timestamp("insurance_expires_at"),
      governmentIdExpiresAt: timestamp("government_id_expires_at"),
      // Expiration notifications
      expirationNotificationSent: boolean("expiration_notification_sent").default(false),
      lastNotificationSentAt: timestamp("last_notification_sent_at"),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    crmLeads = pgTable("crm_leads", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
      value: decimal("value", { precision: 10, scale: 2 }),
      // Ownership & tracking
      assignedTo: varchar("assigned_to").references(() => users.id),
      // Additional context
      notes: text("notes"),
      tags: text("tags").array().default(sql`ARRAY[]::text[]`),
      // Conversion tracking
      convertedToContactId: varchar("converted_to_contact_id"),
      convertedToDealId: varchar("converted_to_deal_id"),
      convertedAt: timestamp("converted_at"),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    crmContacts = pgTable("crm_contacts", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
      tags: text("tags").array().default(sql`ARRAY[]::text[]`),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    crmDeals = pgTable("crm_deals", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
      tags: text("tags").array().default(sql`ARRAY[]::text[]`),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    crmActivities = pgTable("crm_activities", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      // Activity details
      type: text("type").notNull(),
      subject: text("subject").notNull(),
      description: text("description"),
      // Related entities
      leadId: varchar("lead_id").references(() => crmLeads.id),
      contactId: varchar("contact_id").references(() => crmContacts.id),
      dealId: varchar("deal_id").references(() => crmDeals.id),
      // Ownership
      createdBy: varchar("created_by").notNull().references(() => users.id),
      assignedTo: varchar("assigned_to").references(() => users.id),
      // Timing
      dueDate: timestamp("due_date"),
      completedAt: timestamp("completed_at"),
      isCompleted: boolean("is_completed").default(false),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    insertUserSchema = createInsertSchema(users).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    }).extend({
      certifications: z.array(z.enum(certificationTypes)).default([]),
      totalFlightHours: z.number().min(0).default(0)
    });
    insertRefreshTokenSchema = createInsertSchema(refreshTokens).omit({
      id: true,
      createdAt: true
    });
    insertOAuthExchangeTokenSchema = createInsertSchema(oauthExchangeTokens).omit({
      id: true,
      createdAt: true
    });
    insertAircraftListingSchema = createInsertSchema(aircraftListings).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    }).extend({
      year: z.number().min(1900).max((/* @__PURE__ */ new Date()).getFullYear() + 1),
      totalTime: z.number().min(0),
      hourlyRate: z.string().regex(/^\d+(\.\d{1,2})?$/),
      requiredCertifications: z.array(z.string()).min(1),
      images: z.array(z.string()).min(1).max(15),
      engineType: z.enum(engineTypes).optional(),
      engineCount: z.number().min(1).max(8).optional(),
      seatingCapacity: z.number().min(1).max(20).optional(),
      latitude: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
      longitude: z.string().regex(/^-?\d+(\.\d+)?$/).optional()
    });
    insertMarketplaceListingSchema = createInsertSchema(marketplaceListings).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      flagCount: true,
      // Managed by the system
      viewCount: true
      // Managed by the system
    }).extend({
      category: z.enum(marketplaceCategories),
      images: z.array(z.string()).max(15),
      price: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      monthlyFee: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      latitude: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
      longitude: z.string().regex(/^-?\d+(\.\d+)?$/).optional()
    });
    logbookEntries = pgTable("logbook_entries", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id),
      flightDate: date("flight_date").notNull(),
      tailNumber: text("tail_number"),
      aircraftType: text("aircraft_type"),
      route: text("route"),
      timeDay: decimal("time_day", { precision: 6, scale: 2 }).default(sql`0`).notNull(),
      timeNight: decimal("time_night", { precision: 6, scale: 2 }).default(sql`0`).notNull(),
      pic: decimal("pic", { precision: 6, scale: 2 }).default(sql`0`).notNull(),
      sic: decimal("sic", { precision: 6, scale: 2 }).default(sql`0`).notNull(),
      dual: decimal("dual", { precision: 6, scale: 2 }).default(sql`0`).notNull(),
      instrumentActual: decimal("instrument_actual", { precision: 6, scale: 2 }).default(sql`0`).notNull(),
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
      isLocked: boolean("is_locked").default(false).notNull(),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    }, (table) => [
      index("idx_logbook_user").on(table.userId),
      index("idx_logbook_date").on(table.flightDate)
    ]);
    insertLogbookEntrySchema = createInsertSchema(logbookEntries).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      isLocked: true,
      signatureDataUrl: true,
      signedAt: true,
      signedByName: true
    }).extend({
      flightDate: z.coerce.date(),
      timeDay: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      timeNight: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      pic: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      sic: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      dual: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      instrumentActual: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      approaches: z.number().min(0).optional(),
      landingsDay: z.number().min(0).optional(),
      landingsNight: z.number().min(0).optional(),
      holds: z.number().min(0).optional(),
      hobbsStart: z.string().regex(/^\d+(\.\d)?$/).optional(),
      hobbsEnd: z.string().regex(/^\d+(\.\d)?$/).optional()
    });
    insertMarketplaceFlagSchema = createInsertSchema(marketplaceFlags).omit({
      id: true,
      createdAt: true
    });
    insertRentalSchema = createInsertSchema(rentals).omit({
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
      ownerPayout: true
    }).extend({
      // Accept date strings and coerce to Date objects
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      estimatedHours: z.string().regex(/^\d+(\.\d{1,2})?$/),
      hourlyRate: z.string().regex(/^\d+(\.\d{1,2})?$/)
    });
    insertMessageSchema = createInsertSchema(messages).omit({
      id: true,
      createdAt: true,
      isRead: true
    });
    insertReviewSchema = createInsertSchema(reviews).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    }).extend({
      rating: z.number().min(1).max(5),
      communicationRating: z.number().min(1).max(5).optional(),
      cleanlinessRating: z.number().min(1).max(5).optional(),
      accuracyRating: z.number().min(1).max(5).optional(),
      comment: z.string().max(1e3).optional()
    });
    insertFavoriteSchema = createInsertSchema(favorites).omit({
      id: true,
      createdAt: true
    }).extend({
      listingType: z.enum(["marketplace", "aircraft"])
    });
    insertCrmLeadSchema = createInsertSchema(crmLeads).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      convertedToContactId: true,
      convertedToDealId: true,
      convertedAt: true
    }).extend({
      status: z.enum(leadStatuses).default("new"),
      source: z.enum(leadSources).optional(),
      value: z.string().regex(/^\d+(\.\d{1,2})?$/).optional()
    });
    insertCrmContactSchema = createInsertSchema(crmContacts).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertCrmDealSchema = createInsertSchema(crmDeals).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    }).extend({
      stage: z.enum(dealStages).default("lead"),
      value: z.string().regex(/^\d+(\.\d{1,2})?$/),
      probability: z.number().min(0).max(100).default(50)
    });
    insertCrmActivitySchema = createInsertSchema(crmActivities).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      isCompleted: true,
      completedAt: true
    }).extend({
      type: z.enum(activityTypes)
    });
    insertPromoCodeSchema = createInsertSchema(promoCodes).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      usedCount: true,
      applicableCategories: true
    }).extend({
      code: z.string().min(1, "Promo code is required").toUpperCase(),
      description: z.string().optional(),
      discountType: z.enum(["free_7_day", "percentage", "fixed_amount", "waive_creation_fee"]),
      discountValue: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      maxUses: z.number().int().positive().optional(),
      isActive: z.boolean().default(true),
      validFrom: z.coerce.date().optional(),
      validUntil: z.coerce.date().optional(),
      applicableToMarketplace: z.boolean().default(true),
      applicableToBannerAds: z.boolean().default(false)
    });
    insertExpenseSchema = createInsertSchema(expenses).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    }).extend({
      category: z.enum(expenseCategories),
      amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
      expenseDate: z.coerce.date().optional(),
      invoiceUrl: z.string().optional()
    });
    insertAdminNotificationSchema = createInsertSchema(adminNotifications).omit({
      id: true,
      createdAt: true,
      readAt: true
    });
    insertBannerAdOrderSchema = createInsertSchema(bannerAdOrders).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      paypalOrderId: true,
      paypalPaymentDate: true
    }).extend({
      sponsorName: z.string().min(1, "Sponsor name is required"),
      sponsorEmail: z.string().email("Valid email is required"),
      title: z.string().min(1, "Title is required"),
      link: z.string().url("Please enter a valid URL (e.g., https://www.example.com)"),
      placements: z.array(z.string()).min(1, "At least one page placement is required"),
      tier: z.enum(["1month", "3months", "6months", "12months"])
    });
    insertBannerAdSchema = createInsertSchema(bannerAds).omit({
      id: true,
      impressions: true,
      clicks: true,
      createdAt: true,
      updatedAt: true
    }).extend({
      placements: z.array(z.string()).min(1, "At least one page placement is required"),
      imageUrl: z.string().min(1, "Banner image is required"),
      link: z.string().url("Please enter a valid URL (e.g., https://www.example.com)"),
      title: z.string().min(1, "Title is required")
    });
    insertJobApplicationSchema = createInsertSchema(jobApplications).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      status: true,
      employerNotes: true
    }).extend({
      firstName: z.string().min(1, "First name is required"),
      lastName: z.string().min(1, "Last name is required"),
      email: z.string().email("Valid email is required"),
      phone: z.string().optional(),
      coverLetter: z.string().optional(),
      resumeUrl: z.string().min(1, "Resume is required")
    });
    insertPromoAlertSchema = createInsertSchema(promoAlerts).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    }).extend({
      title: z.string().min(1, "Title is required"),
      message: z.string().min(1, "Message is required"),
      promoCode: z.string().optional(),
      variant: z.enum(["info", "success", "warning", "destructive"]).default("info")
    });
    insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests).omit({
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
      adminNotes: true
    }).extend({
      amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid number"),
      paypalEmail: z.string().email("Valid PayPal email is required")
    });
  }
});

// server/resendClient.ts
var resendClient_exports = {};
__export(resendClient_exports, {
  getUncachableResendClient: () => getUncachableResendClient
});
import { Resend } from "resend";
async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? "repl " + process.env.REPL_IDENTITY : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
  }
  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: {
        "Accept": "application/json",
        "X_REPLIT_TOKEN": xReplitToken
      }
    }
  ).then((res) => res.json()).then((data) => data.items?.[0]);
  if (!connectionSettings || !connectionSettings.settings.api_key) {
    throw new Error("Resend not connected");
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}
async function getUncachableResendClient() {
  const credentials = await getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: connectionSettings.settings.from_email
  };
}
var connectionSettings;
var init_resendClient = __esm({
  "server/resendClient.ts"() {
    "use strict";
  }
});

// server/email-templates.ts
var email_templates_exports = {};
__export(email_templates_exports, {
  getBannerAdExpirationReminderHtml: () => getBannerAdExpirationReminderHtml,
  getBannerAdExpirationReminderText: () => getBannerAdExpirationReminderText,
  getBannerAdOrderEmailHtml: () => getBannerAdOrderEmailHtml,
  getBannerAdOrderEmailText: () => getBannerAdOrderEmailText,
  getListingReminderEmailHtml: () => getListingReminderEmailHtml,
  getListingReminderEmailText: () => getListingReminderEmailText,
  getMarketplaceListingExpirationReminderHtml: () => getMarketplaceListingExpirationReminderHtml,
  getMarketplaceListingExpirationReminderText: () => getMarketplaceListingExpirationReminderText,
  sendContactFormEmail: () => sendContactFormEmail
});
function getListingReminderEmailHtml(userName, aircraftCount, marketplaceCount) {
  const totalListings = aircraftCount + marketplaceCount;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .listing-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 10px 0; }
    .button { display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Ready Set Fly</h1>
      <p>Monthly Listing Review Reminder</p>
    </div>
    
    <div class="content">
      <h2>Hi ${userName},</h2>
      
      <p>It's time for your monthly listing review! You currently have <strong>${totalListings} active listing${totalListings === 1 ? "" : "s"}</strong> on Ready Set Fly.</p>
      
      ${aircraftCount > 0 ? `
      <div class="listing-box">
        <h3>Aircraft Rentals: ${aircraftCount}</h3>
        <p>Keep your aircraft rental listings up to date with current availability, pricing, and maintenance status.</p>
      </div>
      ` : ""}
      
      ${marketplaceCount > 0 ? `
      <div class="listing-box">
        <h3>Marketplace Listings: ${marketplaceCount}</h3>
        <p>Review your marketplace listings for aircraft sales, jobs, CFI services, and more.</p>
      </div>
      ` : ""}
      
      <h3>Why review your listings?</h3>
      <ul>
        <li>Update availability and pricing</li>
        <li>Refresh photos and descriptions</li>
        <li>Ensure contact information is current</li>
        <li>Remove or deactivate outdated listings</li>
        <li>Keep your profile competitive</li>
      </ul>
      
      <div style="text-align: center;">
        <a href="${process.env.REPLIT_DEV_DOMAIN || "https://readysetfly.replit.app"}/dashboard" class="button">
          Review My Listings
        </a>
      </div>
      
      <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
        <strong>Pro Tip:</strong> Click the "Refresh" button on each listing to mark it as reviewed. This helps other users see that your listings are actively managed.
      </p>
    </div>
    
    <div class="footer">
      <p>Ready Set Fly - Connecting Pilots with Aircraft</p>
      <p style="font-size: 12px;">You're receiving this email because you have active listings on our platform.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
function getListingReminderEmailText(userName, aircraftCount, marketplaceCount) {
  const totalListings = aircraftCount + marketplaceCount;
  return `
Hi ${userName},

It's time for your monthly listing review! You currently have ${totalListings} active listing${totalListings === 1 ? "" : "s"} on Ready Set Fly.

${aircraftCount > 0 ? `Aircraft Rentals: ${aircraftCount}` : ""}
${marketplaceCount > 0 ? `Marketplace Listings: ${marketplaceCount}` : ""}

Why review your listings?
- Update availability and pricing
- Refresh photos and descriptions
- Ensure contact information is current
- Remove or deactivate outdated listings
- Keep your profile competitive

Review your listings here: ${process.env.REPLIT_DEV_DOMAIN || "https://readysetfly.replit.app"}/dashboard

Pro Tip: Click the "Refresh" button on each listing to mark it as reviewed. This helps other users see that your listings are actively managed.

Ready Set Fly - Connecting Pilots with Aircraft
  `.trim();
}
function getBannerAdOrderEmailHtml(sponsorName, orderDetails) {
  const hasPromo = orderDetails.promoCode && parseFloat(orderDetails.discountAmount || "0") > 0;
  const discount = parseFloat(orderDetails.discountAmount || "0");
  const tierDisplay = orderDetails.tier === "1month" ? "1 Month" : orderDetails.tier === "3months" ? "3 Months" : orderDetails.tier === "6months" ? "6 Months" : "12 Months";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .order-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 15px 0; }
    .pricing-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .pricing-label { font-weight: 500; }
    .pricing-value { font-weight: 600; }
    .discount { color: #059669; }
    .total-row { font-size: 18px; font-weight: bold; padding: 12px 0; margin-top: 10px; border-top: 2px solid #1e40af; }
    .button { display: inline-block; background: #1e40af; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 15px 0; font-weight: 600; }
    .promo-badge { background: #d1fae5; color: #047857; padding: 6px 12px; border-radius: 4px; font-weight: 600; display: inline-block; margin: 10px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
    .warning-box { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Ready Set Fly</h1>
      <p>Banner Ad Order Confirmation</p>
    </div>
    
    <div class="content">
      <h2>Hi ${sponsorName},</h2>
      
      <p>Thank you for your interest in advertising on Ready Set Fly! We've created your banner ad order and are excited to help promote your aviation business.</p>
      
      <div class="order-box">
        <h3 style="margin-top: 0; color: #1e40af;">Order Details</h3>
        <p><strong>Campaign Title:</strong> ${orderDetails.title}</p>
        <p><strong>Duration:</strong> ${tierDisplay}</p>
        <p><strong>Monthly Rate:</strong> $${orderDetails.monthlyRate}/month</p>
        
        <div style="margin-top: 20px;">
          <h4 style="margin-bottom: 10px;">Pricing Breakdown</h4>
          <div class="pricing-row">
            <span class="pricing-label">Subscription (${tierDisplay}):</span>
            <span class="pricing-value">$${orderDetails.totalAmount}</span>
          </div>
          <div class="pricing-row">
            <span class="pricing-label">Ad Creation Fee:</span>
            <span class="pricing-value">$${orderDetails.creationFee}</span>
          </div>
          ${hasPromo ? `
          <div class="pricing-row discount">
            <span class="pricing-label">Promo Discount:</span>
            <span class="pricing-value">-$${discount.toFixed(2)}</span>
          </div>
          ` : ""}
          <div class="total-row">
            <span>Due Today:</span>
            <span>$${orderDetails.grandTotal}</span>
          </div>
        </div>
        
        ${hasPromo ? `
        <div class="promo-badge">
          Promo Code Applied: ${orderDetails.promoCode}
        </div>
        <p style="color: #047857; margin-top: 5px;">You saved $${discount.toFixed(2)} on this order!</p>
        ` : ""}
      </div>
      
      <div style="text-align: center; margin: 25px 0;">
        <p style="font-size: 16px; font-weight: 600; margin-bottom: 10px;">Ready to proceed with payment?</p>
        <a href="https://readysetfly.us/banner-ad-payment?orderId=${orderDetails.orderId}" class="button">
          View Order & Make Payment
        </a>
      </div>
      
      <div class="warning-box">
        <p style="margin: 0; font-weight: 600;">Important: Payment Required</p>
        <p style="margin: 5px 0 0 0;">Your banner ad campaign will be activated once payment is received. Please complete payment within 7 days to secure your advertising slot.</p>
      </div>
      
      <h3>What happens next?</h3>
      <ol>
        <li><strong>Complete Payment</strong> - Use the button above to view your order and submit payment via PayPal</li>
        <li><strong>Order Review</strong> - Our team will review and approve your banner ad content (usually within 1 business day)</li>
        <li><strong>Campaign Launch</strong> - Your banner ad goes live on Ready Set Fly once approved</li>
        <li><strong>Monthly Renewals</strong> - Your campaign continues monthly until you choose to cancel</li>
      </ol>
      
      <p style="margin-top: 20px;">If you have any questions or need to make changes to your order, please contact us at <a href="mailto:support@readysetfly.us">support@readysetfly.us</a>.</p>
      
      <p style="font-weight: 600;">Thank you for choosing Ready Set Fly!</p>
    </div>
    
    <div class="footer">
      <p>Ready Set Fly - Connecting Pilots with Aircraft</p>
      <p style="font-size: 12px;">You're receiving this email because a banner ad order was created for ${orderDetails.title}.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
function getBannerAdOrderEmailText(sponsorName, orderDetails) {
  const hasPromo = orderDetails.promoCode && parseFloat(orderDetails.discountAmount || "0") > 0;
  const discount = parseFloat(orderDetails.discountAmount || "0");
  const tierDisplay = orderDetails.tier === "1month" ? "1 Month" : orderDetails.tier === "3months" ? "3 Months" : orderDetails.tier === "6months" ? "6 Months" : "12 Months";
  return `
Hi ${sponsorName},

Thank you for your interest in advertising on Ready Set Fly! We've created your banner ad order and are excited to help promote your aviation business.

ORDER DETAILS
-------------
Campaign Title: ${orderDetails.title}
Duration: ${tierDisplay}
Monthly Rate: $${orderDetails.monthlyRate}/month

PRICING BREAKDOWN
-----------------
Subscription (${tierDisplay}): $${orderDetails.totalAmount}
Ad Creation Fee: $${orderDetails.creationFee}
${hasPromo ? `Promo Discount (${orderDetails.promoCode}): -$${discount.toFixed(2)}` : ""}
Due Today: $${orderDetails.grandTotal}

${hasPromo ? `You saved $${discount.toFixed(2)} with promo code ${orderDetails.promoCode}!
` : ""}

READY TO PROCEED WITH PAYMENT?
View your order and make payment here:
https://readysetfly.us/banner-ad-payment?orderId=${orderDetails.orderId}

IMPORTANT: Payment Required
Your banner ad campaign will be activated once payment is received. Please complete payment within 7 days to secure your advertising slot.

WHAT HAPPENS NEXT?
1. Complete Payment - View your order and submit payment via PayPal
2. Order Review - Our team will review and approve your banner ad content (usually within 1 business day)
3. Campaign Launch - Your banner ad goes live on Ready Set Fly once approved
4. Monthly Renewals - Your campaign continues monthly until you choose to cancel

If you have any questions or need to make changes to your order, please contact us at support@readysetfly.us.

Thank you for choosing Ready Set Fly!

---
Ready Set Fly - Connecting Pilots with Aircraft
  `.trim();
}
async function sendContactFormEmail(data) {
  const { getUncachableResendClient: getUncachableResendClient2 } = await Promise.resolve().then(() => (init_resendClient(), resendClient_exports));
  const { client: resend, fromEmail } = await getUncachableResendClient2();
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 10px 0; }
    .message-box { background: #f3f4f6; border-left: 4px solid #1e40af; padding: 15px; margin: 15px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Ready Set Fly Contact Form</h1>
      <p>New Message Received</p>
    </div>
    
    <div class="content">
      <div class="info-box">
        <h3>Contact Information</h3>
        <p><strong>Name:</strong> ${data.firstName} ${data.lastName}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Subject:</strong> ${data.subject}</p>
      </div>
      
      <div class="message-box">
        <h3>Message</h3>
        <p>${data.message.replace(/\n/g, "<br>")}</p>
      </div>
      
      <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
        Reply to this message by responding to ${data.email}
      </p>
    </div>
    
    <div class="footer">
      <p>Ready Set Fly - Connecting Pilots with Aircraft</p>
    </div>
  </div>
</body>
</html>
  `.trim();
  const textBody = `
READY SET FLY CONTACT FORM
New Message Received

CONTACT INFORMATION
-------------------
Name: ${data.firstName} ${data.lastName}
Email: ${data.email}
Subject: ${data.subject}

MESSAGE
-------
${data.message}

---
Reply to this message by responding to ${data.email}

Ready Set Fly - Connecting Pilots with Aircraft
  `.trim();
  try {
    await resend.emails.send({
      from: fromEmail,
      to: "support@readysetfly.us",
      subject: `Contact Form: ${data.subject}`,
      html: htmlBody,
      text: textBody,
      replyTo: data.email
    });
  } catch (error) {
    console.error("Failed to send contact form email:", error);
  }
}
function getBannerAdExpirationReminderHtml(sponsorName, orderDetails) {
  const tierDisplay = orderDetails.tier === "1month" ? "1 Month" : orderDetails.tier === "3months" ? "3 Months" : orderDetails.tier === "6months" ? "6 Months" : "12 Months";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #dc2626; border-radius: 8px; padding: 15px; margin: 15px 0; }
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 10px 0; }
    .button { display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Action Required: Banner Campaign Ending Soon</h1>
    </div>
    
    <div class="content">
      <h2>Hi ${sponsorName},</h2>
      
      <div class="alert-box">
        <h3 style="margin-top: 0; color: #dc2626;">Your banner campaign ends in 2 days</h3>
        <p style="margin-bottom: 0;">Your ad will be automatically deactivated at midnight on <strong>${new Date(orderDetails.endDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong> and will no longer appear on Ready Set Fly.</p>
      </div>
      
      <div class="info-box">
        <h3>Campaign Summary</h3>
        <p><strong>Company:</strong> ${orderDetails.company}</p>
        <p><strong>Title:</strong> ${orderDetails.title}</p>
        <p><strong>Tier:</strong> ${tierDisplay}</p>
        <p><strong>Started:</strong> ${new Date(orderDetails.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        <p style="margin-bottom: 0;"><strong>Ends:</strong> ${new Date(orderDetails.endDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
      </div>
      
      <h3>What Happens Next?</h3>
      <p>At expiration, your banner ad will:</p>
      <ul>
        <li>Stop displaying across all placements on Ready Set Fly</li>
        <li>Be removed from the homepage, marketplace, and rental pages</li>
        <li>No longer receive impressions or clicks</li>
      </ul>
      
      <h3>Interested in Renewing?</h3>
      <p>We currently handle banner ad renewals manually. To continue your campaign:</p>
      <ul>
        <li>Reply to this email to request a renewal quote</li>
        <li>Our team will send you a new checkout link within 1 business day</li>
        <li>You can choose the same tier or upgrade to a longer duration</li>
      </ul>
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="mailto:support@readysetfly.us?subject=Renewal Request for ${encodeURIComponent(orderDetails.title)}" class="button">
          Request Renewal Quote
        </a>
      </div>
      
      <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
        <strong>Note:</strong> Auto-renewal is not currently available. Please contact us before your expiration date to ensure uninterrupted ad visibility.
      </p>
      
      <div style="background: #f3f4f6; border-radius: 8px; padding: 15px; margin: 20px 0; font-size: 12px; color: #6b7280;">
        <p style="margin: 0;"><strong>Policy Reminder:</strong> Ready Set Fly operates on a strict no-refunds policy for all banner ad campaigns. Services are available to US residents only. All fees and sales tax apply to renewed campaigns.</p>
      </div>
    </div>
    
    <div class="footer">
      <p>Ready Set Fly - Aviation Marketplace</p>
      <p style="font-size: 12px;">Questions? Contact support@readysetfly.us</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
function getBannerAdExpirationReminderText(sponsorName, adDetails) {
  const tierDisplay = adDetails.tier === "1month" ? "1 Month" : adDetails.tier === "3months" ? "3 Months" : adDetails.tier === "6months" ? "6 Months" : "12 Months";
  const leadDays = adDetails.leadDays ?? 2;
  return `
ACTION REQUIRED: Your Ready Set Fly banner campaign ends in ${leadDays} days

Hi ${sponsorName},

Your banner ad will be automatically deactivated at midnight on ${new Date(adDetails.endDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} and will no longer appear on Ready Set Fly.

CAMPAIGN SUMMARY
----------------
Company: ${adDetails.company}
Title: ${adDetails.title}
Tier: ${tierDisplay}
Started: ${new Date(adDetails.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
Ends: ${new Date(adDetails.endDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}

WHAT HAPPENS AT EXPIRATION?
At expiration, your banner ad will:
- Stop displaying across all placements on Ready Set Fly
- Be removed from the homepage, marketplace, and rental pages
- No longer receive impressions or clicks

INTERESTED IN RENEWING?
We currently handle banner ad renewals manually. To continue your campaign:
- Reply to this email to request a renewal quote
- Our team will send you a new checkout link within 1 business day
- You can choose the same tier or upgrade to a longer duration

Request renewal: support@readysetfly.us

Note: Auto-renewal is not currently available. Please contact us before your expiration date to ensure uninterrupted ad visibility.

POLICY REMINDER: Ready Set Fly operates on a strict no-refunds policy for all banner ad campaigns. Services are available to US residents only. All fees and sales tax apply to renewed campaigns.

Ready Set Fly - Aviation Marketplace
Questions? Contact support@readysetfly.us
  `.trim();
}
function getMarketplaceListingExpirationReminderHtml(userName, listingDetails) {
  const categoryDisplay = listingDetails.category === "aircraft-sale" ? "Aircraft for Sale" : listingDetails.category === "charter" ? "Charter Service" : listingDetails.category === "cfi" ? "CFI Instructor" : listingDetails.category === "flight-school" ? "Flight School" : listingDetails.category === "mechanic" ? "Mechanic Service" : "Job Listing";
  const tierDisplay = listingDetails.tier === "basic" ? "Basic" : listingDetails.tier === "standard" ? "Standard" : "Premium";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #dc2626; border-radius: 8px; padding: 15px; margin: 15px 0; }
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 10px 0; }
    .button { display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Renew Your Listing \u2013 2 Days Left</h1>
    </div>
    
    <div class="content">
      <h2>Hi ${userName},</h2>
      
      <div class="alert-box">
        <h3 style="margin-top: 0; color: #dc2626;">Your ${categoryDisplay} listing expires in 2 days</h3>
        <p style="margin-bottom: 0;">Your listing will be automatically hidden from search results and removed from your active listings at midnight on <strong>${new Date(listingDetails.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>.</p>
      </div>
      
      <div class="info-box">
        <h3>Listing Details</h3>
        <p><strong>Title:</strong> ${listingDetails.title}</p>
        <p><strong>Category:</strong> ${categoryDisplay}</p>
        <p><strong>Tier:</strong> ${tierDisplay}</p>
        <p style="margin-bottom: 0;"><strong>Expires:</strong> ${new Date(listingDetails.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
      </div>
      
      <h3>What Happens at Expiration?</h3>
      <p>When your listing expires, it will:</p>
      <ul>
        <li>Be hidden from all marketplace search results</li>
        <li>No longer appear in category browsing</li>
        <li>Become inactive in your dashboard</li>
        <li>Stop receiving views and inquiries</li>
      </ul>
      
      <h3>Why Stay Active?</h3>
      <p>Active listings benefit from:</p>
      <ul>
        <li>Continuous visibility in search results</li>
        <li>Higher trust from potential buyers/clients</li>
        <li>Ongoing lead generation</li>
        <li>Professional marketplace presence</li>
      </ul>
      
      <h3>How to Renew</h3>
      <p>To renew your listing, visit your dashboard and create a new listing. You can duplicate your current listing to save time:</p>
      <ol>
        <li>Go to your Dashboard \u2192 My Listings</li>
        <li>Find your expiring listing</li>
        <li>Click "Create New Listing" to post again</li>
        <li>Select your preferred tier and complete payment</li>
      </ol>
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="${process.env.REPLIT_DEV_DOMAIN || "https://readysetfly.us"}/dashboard" class="button">
          Go to My Listings
        </a>
      </div>
      
      <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
        <strong>Need Help?</strong> Reply to this email or contact support@readysetfly.us for assistance with renewing your listing.
      </p>
      
      <div style="background: #f3f4f6; border-radius: 8px; padding: 15px; margin: 20px 0; font-size: 12px; color: #6b7280;">
        <p style="margin: 0;"><strong>Policy Reminder:</strong> Ready Set Fly operates on a strict no-refunds policy. All marketplace fees and 8.25% sales tax apply to renewed listings. Services are available to US residents only.</p>
      </div>
    </div>
    
    <div class="footer">
      <p>Ready Set Fly - Aviation Marketplace</p>
      <p style="font-size: 12px;">Questions? Contact support@readysetfly.us</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
function getMarketplaceListingExpirationReminderText(userName, listingDetails) {
  const categoryDisplay = listingDetails.category === "aircraft-sale" ? "Aircraft for Sale" : listingDetails.category === "charter" ? "Charter Service" : listingDetails.category === "cfi" ? "CFI Instructor" : listingDetails.category === "flight-school" ? "Flight School" : listingDetails.category === "mechanic" ? "Mechanic Service" : "Job Listing";
  const tierDisplay = listingDetails.tier === "basic" ? "Basic" : listingDetails.tier === "standard" ? "Standard" : "Premium";
  const leadDays = listingDetails.leadDays ?? 2;
  return `
RENEW YOUR LISTING \u2013 ${leadDays} DAYS LEFT

Hi ${userName},

Your ${categoryDisplay} listing expires in ${leadDays} days. Your listing will be automatically hidden from search results and removed from your active listings at midnight on ${new Date(listingDetails.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.

LISTING DETAILS
---------------
Title: ${listingDetails.title}
Category: ${categoryDisplay}
Tier: ${tierDisplay}
Expires: ${new Date(listingDetails.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}

WHAT HAPPENS AT EXPIRATION?
When your listing expires, it will:
- Be hidden from all marketplace search results
- No longer appear in category browsing
- Become inactive in your dashboard
- Stop receiving views and inquiries

WHY STAY ACTIVE?
Active listings benefit from:
- Continuous visibility in search results
- Higher trust from potential buyers/clients
- Ongoing lead generation
- Professional marketplace presence

HOW TO RENEW
To renew your listing, visit your dashboard and create a new listing:
1. Go to your Dashboard \u2192 My Listings
2. Find your expiring listing
3. Click "Create New Listing" to post again
4. Select your preferred tier and complete payment

View your listings: ${process.env.REPLIT_DEV_DOMAIN || "https://readysetfly.us"}/dashboard

Need Help? Reply to this email or contact support@readysetfly.us for assistance with renewing your listing.

POLICY REMINDER: Ready Set Fly operates on a strict no-refunds policy. All marketplace fees and 8.25% sales tax apply to renewed listings. Services are available to US residents only.

Ready Set Fly - Aviation Marketplace
Questions? Contact support@readysetfly.us
  `.trim();
}
var init_email_templates = __esm({
  "server/email-templates.ts"() {
    "use strict";
  }
});

// server/paypal-payouts.ts
var paypal_payouts_exports = {};
__export(paypal_payouts_exports, {
  cancelPayoutItem: () => cancelPayoutItem,
  getPayoutStatus: () => getPayoutStatus,
  sendPayout: () => sendPayout
});
import paypal from "@paypal/payouts-sdk";
function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.");
  }
  const isProduction = process.env.NODE_ENV === "production" && !clientId.includes("sandbox") && !clientId.includes("test");
  if (isProduction) {
    return new paypal.core.LiveEnvironment(clientId, clientSecret);
  } else {
    return new paypal.core.SandboxEnvironment(clientId, clientSecret);
  }
}
async function sendPayout(request) {
  try {
    const requestBody = {
      sender_batch_header: {
        sender_batch_id: `Batch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        email_subject: request.emailSubject || "You've received a payout from Ready Set Fly",
        email_message: request.emailMessage || "Your rental earnings have been sent to your PayPal account.",
        recipient_type: "EMAIL"
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: {
            value: request.amount.toFixed(2),
            currency: "USD"
          },
          receiver: request.recipientEmail,
          sender_item_id: request.senderItemId,
          note: request.note || "Withdrawal from Ready Set Fly"
        }
      ]
    };
    const payoutRequest = new paypal.payouts.PayoutsPostRequest();
    payoutRequest.requestBody(requestBody);
    const response = await client.execute(payoutRequest);
    const batchHeader = response.result.batch_header;
    const items = response.result.items || [];
    const firstItem = items[0];
    return {
      success: true,
      batchId: batchHeader.payout_batch_id,
      itemId: firstItem?.payout_item_id,
      transactionId: firstItem?.transaction_id,
      transactionStatus: firstItem?.transaction_status || batchHeader.batch_status
    };
  } catch (error) {
    console.error("PayPal Payout Error:", error);
    let errorMessage = "Failed to process payout";
    if (error.statusCode) {
      errorMessage += ` (Status: ${error.statusCode})`;
    }
    if (error.message) {
      errorMessage += `: ${error.message}`;
    }
    if (error.headers && error.headers["paypal-debug-id"]) {
      errorMessage += ` [Debug ID: ${error.headers["paypal-debug-id"]}]`;
    }
    return {
      success: false,
      error: errorMessage
    };
  }
}
async function getPayoutStatus(batchId) {
  try {
    const request = new paypal.payouts.PayoutsGetRequest(batchId);
    request.page(1);
    request.pageSize(10);
    request.totalRequired(true);
    const response = await client.execute(request);
    return {
      success: true,
      data: response.result
    };
  } catch (error) {
    console.error("Error fetching payout status:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch payout status"
    };
  }
}
async function cancelPayoutItem(itemId) {
  try {
    const request = new paypal.payouts.PayoutsItemCancelRequest(itemId);
    const response = await client.execute(request);
    return {
      success: true,
      data: response.result
    };
  } catch (error) {
    console.error("Error cancelling payout:", error);
    return {
      success: false,
      error: error.message || "Failed to cancel payout"
    };
  }
}
var client;
var init_paypal_payouts = __esm({
  "server/paypal-payouts.ts"() {
    "use strict";
    client = new paypal.core.PayPalHttpClient(environment());
  }
});

// shared/config/bannerPricing.ts
var bannerPricing_exports = {};
__export(bannerPricing_exports, {
  BANNER_AD_CREATION_FEE: () => BANNER_AD_CREATION_FEE,
  BANNER_AD_TIERS: () => BANNER_AD_TIERS,
  calculateBannerAdPricing: () => calculateBannerAdPricing
});
function calculateBannerAdPricing(tier, includeCreationFee = true) {
  const tierData = BANNER_AD_TIERS[tier];
  const subscriptionTotal = tierData.totalPrice;
  const creationFee = includeCreationFee ? BANNER_AD_CREATION_FEE : 0;
  const grandTotal = subscriptionTotal + creationFee;
  return {
    tier,
    monthlyRate: tierData.monthlyRate,
    months: tierData.months,
    subscriptionTotal,
    creationFee,
    grandTotal,
    label: tierData.label,
    description: tierData.description,
    badge: "badge" in tierData ? tierData.badge : void 0
  };
}
var BANNER_AD_CREATION_FEE, BANNER_AD_TIERS;
var init_bannerPricing = __esm({
  "shared/config/bannerPricing.ts"() {
    "use strict";
    BANNER_AD_CREATION_FEE = 40;
    BANNER_AD_TIERS = {
      "1month": {
        label: "1 Month",
        months: 1,
        monthlyRate: 75,
        totalPrice: 75,
        description: "Entry-level, test water"
      },
      "3months": {
        label: "3 Months",
        months: 3,
        monthlyRate: 60,
        totalPrice: 180,
        description: "Most purchased",
        badge: "Popular"
      },
      "6months": {
        label: "6 Months",
        months: 6,
        monthlyRate: 50,
        totalPrice: 300,
        description: "Best long-term value",
        badge: "Best Value"
      },
      "12months": {
        label: "12 Months",
        months: 12,
        monthlyRate: 45,
        totalPrice: 540,
        description: "Commitment tier"
      }
    };
  }
});

// shared/config/promoCodes.ts
var promoCodes_exports = {};
__export(promoCodes_exports, {
  PROMO_CODES: () => PROMO_CODES,
  calculatePromoDiscount: () => calculatePromoDiscount,
  validatePromoCode: () => validatePromoCode
});
function validatePromoCode(code) {
  const normalizedCode = code.trim().toUpperCase();
  const promo = PROMO_CODES[normalizedCode];
  if (!promo || !promo.isActive) {
    return null;
  }
  const now = /* @__PURE__ */ new Date();
  if (now < promo.validFrom) {
    return null;
  }
  if (promo.validUntil && now > promo.validUntil) {
    return null;
  }
  return promo;
}
function calculatePromoDiscount(creationFee, subscriptionTotal, promoCode) {
  if (!promoCode) {
    return {
      creationFeeDiscount: 0,
      subscriptionDiscount: 0,
      totalDiscount: 0,
      finalCreationFee: creationFee,
      finalSubscriptionTotal: subscriptionTotal,
      finalGrandTotal: creationFee + subscriptionTotal
    };
  }
  const promo = validatePromoCode(promoCode);
  if (!promo) {
    return {
      creationFeeDiscount: 0,
      subscriptionDiscount: 0,
      totalDiscount: 0,
      finalCreationFee: creationFee,
      finalSubscriptionTotal: subscriptionTotal,
      finalGrandTotal: creationFee + subscriptionTotal
    };
  }
  let creationFeeDiscount = 0;
  if (promo.isPercentage) {
    creationFeeDiscount = creationFee * promo.creationFeeDiscount / 100;
  } else {
    creationFeeDiscount = Math.min(promo.creationFeeDiscount, creationFee);
  }
  let subscriptionDiscount = 0;
  if (promo.isPercentage) {
    subscriptionDiscount = subscriptionTotal * promo.subscriptionDiscount / 100;
  } else {
    subscriptionDiscount = Math.min(promo.subscriptionDiscount, subscriptionTotal);
  }
  const totalDiscount = creationFeeDiscount + subscriptionDiscount;
  const finalCreationFee = creationFee - creationFeeDiscount;
  const finalSubscriptionTotal = subscriptionTotal - subscriptionDiscount;
  const finalGrandTotal = finalCreationFee + finalSubscriptionTotal;
  return {
    creationFeeDiscount,
    subscriptionDiscount,
    totalDiscount,
    finalCreationFee,
    finalSubscriptionTotal,
    finalGrandTotal
  };
}
var PROMO_CODES;
var init_promoCodes = __esm({
  "shared/config/promoCodes.ts"() {
    "use strict";
    PROMO_CODES = {
      LAUNCH2025: {
        code: "LAUNCH2025",
        description: "Launch promotion - Free ad creation + 20% off subscription",
        creationFeeDiscount: 100,
        // 100% off creation fee (waives $40)
        subscriptionDiscount: 20,
        // 20% off subscription total
        isPercentage: true,
        validFrom: /* @__PURE__ */ new Date("2025-01-01"),
        validUntil: null,
        // No expiration for MVP
        isActive: true
      }
    };
  }
});

// server/index.ts
import dotenv2 from "dotenv";
import { fileURLToPath as fileURLToPath2 } from "url";
import { dirname as dirname2, join as join2 } from "path";
import express3 from "express";
import cors2 from "cors";

// server/routes.ts
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import OpenAI from "openai";
import { z as z4 } from "zod";
import jwt2 from "jsonwebtoken";
import { Client, Environment, LogLevel, OrdersController } from "@paypal/paypal-server-sdk";

// server/storage.ts
init_schema();

// server/db.ts
init_schema();
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, ".env") });
console.log("db.ts env loaded?", !!process.env.DATABASE_URL);
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq, and, desc, asc, or, ilike, gte, lte, sql as sql2, inArray, isNull, arrayOverlaps } from "drizzle-orm";
var DatabaseStorage = class {
  // Users
  async getUser(id) {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }
  async getUserByEmail(email) {
    const result = await db.select().from(users).where(ilike(users.email, email)).limit(1);
    return result[0];
  }
  async getUserByVerificationToken(token) {
    const result = await db.select().from(users).where(eq(users.emailVerificationToken, token)).limit(1);
    return result[0];
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async updateUser(id, updates) {
    const [user] = await db.update(users).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, id)).returning();
    return user;
  }
  async upsertUser(userData) {
    if (!userData.id) {
      throw new Error("User ID is required for upsert");
    }
    let existingUser = await this.getUser(userData.id);
    if (!existingUser && userData.email) {
      existingUser = await this.getUserByEmail(userData.email);
    }
    if (existingUser) {
      const { id, ...updateData } = userData;
      const [user] = await db.update(users).set({
        ...updateData,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(users.id, existingUser.id)).returning();
      return user;
    } else {
      const [user] = await db.insert(users).values(userData).returning();
      return user;
    }
  }
  async searchUsers(query) {
    const searchPattern = `%${query}%`;
    return await db.select().from(users).where(
      or(
        ilike(users.firstName, searchPattern),
        ilike(users.lastName, searchPattern),
        ilike(users.email, searchPattern)
      )
    ).limit(50);
  }
  async updateUserPassword(id, hashedPassword) {
    const [user] = await db.update(users).set({
      hashedPassword,
      passwordCreatedAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(users.id, id)).returning();
    return user;
  }
  async deleteUser(id) {
    try {
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, id));
      await db.delete(messages).where(
        or(
          eq(messages.senderId, id),
          eq(messages.receiverId, id)
        )
      );
      await db.delete(reviews).where(
        or(
          eq(reviews.reviewerId, id),
          eq(reviews.revieweeId, id)
        )
      );
      await db.delete(rentals).where(
        or(
          eq(rentals.renterId, id),
          eq(rentals.ownerId, id)
        )
      );
      await db.delete(aircraftListings).where(eq(aircraftListings.ownerId, id));
      await db.delete(marketplaceListings).where(eq(marketplaceListings.userId, id));
      await db.delete(verificationSubmissions).where(eq(verificationSubmissions.userId, id));
      await db.delete(transactions).where(eq(transactions.userId, id));
      await db.delete(withdrawalRequests).where(eq(withdrawalRequests.userId, id));
      await db.delete(jobApplications).where(eq(jobApplications.applicantId, id));
      await db.delete(crmContacts).where(eq(crmContacts.userId, id));
      await db.delete(crmDeals).where(eq(crmDeals.assignedTo, id));
      await db.delete(crmActivities).where(
        or(
          eq(crmActivities.createdBy, id),
          eq(crmActivities.assignedTo, id)
        )
      );
      const result = await db.delete(users).where(eq(users.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }
  // Refresh Tokens (for mobile app JWT authentication)
  async createRefreshToken(token) {
    const [refreshToken] = await db.insert(refreshTokens).values(token).returning();
    return refreshToken;
  }
  async getRefreshToken(token) {
    const result = await db.select().from(refreshTokens).where(eq(refreshTokens.token, token)).limit(1);
    return result[0];
  }
  async deleteRefreshToken(token) {
    const result = await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
    return true;
  }
  async deleteUserRefreshTokens(userId) {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    return true;
  }
  // OAuth Exchange Tokens (for mobile OAuth flow)
  async createOAuthExchangeToken(token) {
    const [exchangeToken] = await db.insert(oauthExchangeTokens).values(token).returning();
    return exchangeToken;
  }
  async verifyOAuthExchangeToken(token) {
    const [exchangeToken] = await db.select().from(oauthExchangeTokens).where(and(
      eq(oauthExchangeTokens.token, token),
      gte(oauthExchangeTokens.expiresAt, /* @__PURE__ */ new Date())
    )).limit(1);
    return exchangeToken;
  }
  async deleteOAuthExchangeToken(token) {
    await db.delete(oauthExchangeTokens).where(eq(oauthExchangeTokens.token, token));
    return true;
  }
  // User Metrics (Admin Analytics)
  async getUserMetrics() {
    const now = /* @__PURE__ */ new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
    const totalUsersResult = await db.select({ count: sql2`count(*)::int` }).from(users);
    const totalUsers = totalUsersResult[0]?.count || 0;
    const verifiedUsersResult = await db.select({ count: sql2`count(*)::int` }).from(users).where(eq(users.isVerified, true));
    const verifiedUsers = verifiedUsersResult[0]?.count || 0;
    const newUsersTodayResult = await db.select({ count: sql2`count(*)::int` }).from(users).where(gte(users.createdAt, todayStart));
    const newUsersToday = newUsersTodayResult[0]?.count || 0;
    const newUsersThisWeekResult = await db.select({ count: sql2`count(*)::int` }).from(users).where(gte(users.createdAt, weekAgo));
    const newUsersThisWeek = newUsersThisWeekResult[0]?.count || 0;
    const newUsersThisMonthResult = await db.select({ count: sql2`count(*)::int` }).from(users).where(gte(users.createdAt, monthAgo));
    const newUsersThisMonth = newUsersThisMonthResult[0]?.count || 0;
    const aircraftOwnersResult = await db.selectDistinct({ ownerId: aircraftListings.ownerId }).from(aircraftListings).where(eq(aircraftListings.isListed, true));
    const marketplaceOwnersResult = await db.selectDistinct({ userId: marketplaceListings.userId }).from(marketplaceListings).where(eq(marketplaceListings.isActive, true));
    const uniqueOwners = /* @__PURE__ */ new Set([
      ...aircraftOwnersResult.map((r) => r.ownerId),
      ...marketplaceOwnersResult.map((r) => r.userId)
    ]);
    const activeListingOwners = uniqueOwners.size;
    const activeRentersResult = await db.select({ count: sql2`count(DISTINCT ${rentals.renterId})::int` }).from(rentals).where(eq(rentals.status, "completed"));
    const activeRenters = activeRentersResult[0]?.count || 0;
    const verificationRate = totalUsers > 0 ? verifiedUsers / totalUsers * 100 : 0;
    return {
      totalUsers,
      verifiedUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      activeListingOwners,
      activeRenters,
      verificationRate
    };
  }
  async getGeographicDistribution() {
    const stateDistribution = await db.select({
      state: aircraftListings.state,
      count: sql2`count(DISTINCT ${aircraftListings.ownerId})::int`
    }).from(aircraftListings).where(and(
      eq(aircraftListings.isListed, true),
      sql2`${aircraftListings.state} IS NOT NULL AND ${aircraftListings.state} != ''`
    )).groupBy(aircraftListings.state).orderBy(desc(sql2`count(DISTINCT ${aircraftListings.ownerId})`));
    const marketplaceStateDistribution = await db.select({
      state: marketplaceListings.state,
      count: sql2`count(DISTINCT ${marketplaceListings.userId})::int`
    }).from(marketplaceListings).where(and(
      eq(marketplaceListings.isActive, true),
      sql2`${marketplaceListings.state} IS NOT NULL AND ${marketplaceListings.state} != ''`
    )).groupBy(marketplaceListings.state).orderBy(desc(sql2`count(DISTINCT ${marketplaceListings.userId})`));
    const stateMap = /* @__PURE__ */ new Map();
    [...stateDistribution, ...marketplaceStateDistribution].forEach(({ state, count }) => {
      if (state) {
        stateMap.set(state, (stateMap.get(state) || 0) + count);
      }
    });
    const byState = Array.from(stateMap.entries()).map(([state, count]) => ({ state, count })).sort((a, b) => b.count - a.count).slice(0, 10);
    const cityDistribution = await db.select({
      city: aircraftListings.city,
      state: aircraftListings.state,
      count: sql2`count(DISTINCT ${aircraftListings.ownerId})::int`
    }).from(aircraftListings).where(and(
      eq(aircraftListings.isListed, true),
      sql2`${aircraftListings.city} IS NOT NULL AND ${aircraftListings.city} != ''`
    )).groupBy(aircraftListings.city, aircraftListings.state).orderBy(desc(sql2`count(DISTINCT ${aircraftListings.ownerId})`)).limit(10);
    const byCity = cityDistribution.map(({ city, state, count }) => ({
      city: city || "",
      state: state || "",
      count
    }));
    return { byState, byCity };
  }
  async getUserRetentionMetrics() {
    const returningUsersResult = await db.select({ count: sql2`count(*)::int` }).from(
      db.select({ renterId: rentals.renterId }).from(rentals).where(eq(rentals.status, "completed")).groupBy(rentals.renterId).having(sql2`count(*) > 1`).as("returning_renters")
    );
    const returningUsers = returningUsersResult[0]?.count || 0;
    const oneTimeUsersResult = await db.select({ count: sql2`count(*)::int` }).from(
      db.select({ renterId: rentals.renterId }).from(rentals).where(eq(rentals.status, "completed")).groupBy(rentals.renterId).having(sql2`count(*) = 1`).as("one_time_renters")
    );
    const oneTimeUsers = oneTimeUsersResult[0]?.count || 0;
    const totalRenters = returningUsers + oneTimeUsers;
    const retentionRate = totalRenters > 0 ? returningUsers / totalRenters * 100 : 0;
    return {
      returningUsers,
      oneTimeUsers,
      retentionRate
    };
  }
  // Aircraft Listings
  async getAircraftListing(id) {
    const result = await db.select().from(aircraftListings).where(eq(aircraftListings.id, id)).limit(1);
    return result[0];
  }
  async getAllAircraftListings() {
    return await db.select().from(aircraftListings).where(eq(aircraftListings.isListed, true));
  }
  async getAircraftListingsByOwner(ownerId) {
    return await db.select().from(aircraftListings).where(eq(aircraftListings.ownerId, ownerId));
  }
  async createAircraftListing(insertListing) {
    const [listing] = await db.insert(aircraftListings).values(insertListing).returning();
    return listing;
  }
  async updateAircraftListing(id, updates) {
    const [listing] = await db.update(aircraftListings).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(aircraftListings.id, id)).returning();
    return listing;
  }
  async deleteAircraftListing(id) {
    const result = await db.delete(aircraftListings).where(eq(aircraftListings.id, id)).returning();
    return result.length > 0;
  }
  async toggleAircraftListingStatus(id) {
    const listing = await this.getAircraftListing(id);
    if (!listing) return void 0;
    const [updated] = await db.update(aircraftListings).set({
      isListed: !listing.isListed,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(aircraftListings.id, id)).returning();
    return updated;
  }
  // Marketplace Listings
  async getMarketplaceListing(id) {
    const result = await db.select().from(marketplaceListings).where(eq(marketplaceListings.id, id)).limit(1);
    return result[0];
  }
  async getAllMarketplaceListings() {
    return await db.select().from(marketplaceListings).where(eq(marketplaceListings.isActive, true));
  }
  async getMarketplaceListingsByCategory(category) {
    return await db.select().from(marketplaceListings).where(
      and(
        eq(marketplaceListings.category, category),
        eq(marketplaceListings.isActive, true)
      )
    );
  }
  async getMarketplaceListingsByUser(userId) {
    return await db.select().from(marketplaceListings).where(
      and(
        eq(marketplaceListings.userId, userId),
        eq(marketplaceListings.isExample, false)
      )
    );
  }
  async getFilteredMarketplaceListings(filters) {
    const conditions = [eq(marketplaceListings.isActive, true)];
    if (filters.category) {
      conditions.push(eq(marketplaceListings.category, filters.category));
    }
    if (filters.city) {
      conditions.push(ilike(marketplaceListings.city, `%${filters.city}%`));
    }
    if (filters.keyword) {
      conditions.push(
        or(
          ilike(marketplaceListings.title, `%${filters.keyword}%`),
          ilike(marketplaceListings.description, `%${filters.keyword}%`)
        )
      );
    }
    if (filters.minPrice !== void 0) {
      conditions.push(sql2`CAST(${marketplaceListings.price} AS NUMERIC) >= ${filters.minPrice}`);
    }
    if (filters.maxPrice !== void 0) {
      conditions.push(sql2`CAST(${marketplaceListings.price} AS NUMERIC) <= ${filters.maxPrice}`);
    }
    const results = await db.select().from(marketplaceListings).where(and(...conditions));
    let filteredResults = results;
    if (filters.engineType && filters.engineType !== "all") {
      filteredResults = filteredResults.filter((listing) => {
        const details = listing.details;
        return details?.engineType === filters.engineType;
      });
    }
    if (filters.cfiRating && filters.cfiRating !== "all") {
      filteredResults = filteredResults.filter((listing) => {
        const details = listing.details;
        return details?.certifications?.includes(filters.cfiRating);
      });
    }
    return filteredResults;
  }
  async createMarketplaceListing(insertListing) {
    const [listing] = await db.insert(marketplaceListings).values(insertListing).returning();
    return listing;
  }
  async updateMarketplaceListing(id, updates) {
    const [listing] = await db.update(marketplaceListings).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(marketplaceListings.id, id)).returning();
    return listing;
  }
  async deleteMarketplaceListing(id) {
    const result = await db.delete(marketplaceListings).where(eq(marketplaceListings.id, id)).returning();
    return result.length > 0;
  }
  async deactivateExpiredListings() {
    const gracePeriodEnd = new Date(Date.now() - 3 * 24 * 60 * 60 * 1e3);
    const result = await db.update(marketplaceListings).set({
      isActive: false,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(
      and(
        eq(marketplaceListings.isActive, true),
        sql2`${marketplaceListings.expiresAt} < ${gracePeriodEnd}`
      )
    ).returning();
    return { deactivatedCount: result.length };
  }
  async getExpiringMarketplaceListings(daysUntilExpiration) {
    const now = /* @__PURE__ */ new Date();
    const targetDate = /* @__PURE__ */ new Date();
    targetDate.setDate(targetDate.getDate() + daysUntilExpiration);
    const targetDateStart = new Date(targetDate);
    targetDateStart.setHours(0, 0, 0, 0);
    const targetDateEnd = new Date(targetDate);
    targetDateEnd.setHours(23, 59, 59, 999);
    return await db.select().from(marketplaceListings).where(
      and(
        eq(marketplaceListings.isActive, true),
        eq(marketplaceListings.isPaid, true),
        eq(marketplaceListings.expirationReminderSent, false),
        gte(marketplaceListings.expiresAt, targetDateStart),
        lte(marketplaceListings.expiresAt, targetDateEnd)
      )
    ).orderBy(asc(marketplaceListings.expiresAt));
  }
  // Marketplace Analytics
  async incrementMarketplaceViewCount(id) {
    await db.update(marketplaceListings).set({
      viewCount: sql2`${marketplaceListings.viewCount} + 1`
    }).where(eq(marketplaceListings.id, id));
  }
  // Marketplace Flags
  async flagMarketplaceListing(listingId, userId, reason) {
    const existingFlag = await db.select().from(marketplaceFlags).where(
      and(
        eq(marketplaceFlags.listingId, listingId),
        eq(marketplaceFlags.userId, userId)
      )
    ).limit(1);
    if (existingFlag.length > 0) {
      const listing = await this.getMarketplaceListing(listingId);
      return { success: false, flagCount: listing?.flagCount || 0 };
    }
    await db.insert(marketplaceFlags).values({
      listingId,
      userId,
      reason: reason || null
    });
    const [updatedListing] = await db.update(marketplaceListings).set({
      flagCount: sql2`${marketplaceListings.flagCount} + 1`,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(marketplaceListings.id, listingId)).returning();
    return { success: true, flagCount: updatedListing?.flagCount || 0 };
  }
  async checkIfUserFlaggedListing(listingId, userId) {
    const result = await db.select().from(marketplaceFlags).where(
      and(
        eq(marketplaceFlags.listingId, listingId),
        eq(marketplaceFlags.userId, userId)
      )
    ).limit(1);
    return result.length > 0;
  }
  async getFlaggedMarketplaceListings() {
    return await db.select().from(marketplaceListings).where(gte(marketplaceListings.flagCount, 5)).orderBy(desc(marketplaceListings.flagCount));
  }
  // Stale & Orphaned Listings Management
  async getStaleAircraftListings(daysStale = 60) {
    const staleDate = new Date(Date.now() - daysStale * 24 * 60 * 60 * 1e3);
    const results = await db.select().from(aircraftListings).leftJoin(users, eq(aircraftListings.ownerId, users.id)).where(
      and(
        eq(aircraftListings.isListed, true),
        lte(aircraftListings.lastRefreshedAt, staleDate)
      )
    ).orderBy(asc(aircraftListings.lastRefreshedAt));
    return results.map((row) => ({
      ...row.aircraft_listings,
      owner: row.users
    }));
  }
  async getStaleMarketplaceListings(daysStale = 60) {
    const staleDate = new Date(Date.now() - daysStale * 24 * 60 * 60 * 1e3);
    const results = await db.select().from(marketplaceListings).leftJoin(users, eq(marketplaceListings.userId, users.id)).where(
      and(
        eq(marketplaceListings.isActive, true),
        lte(marketplaceListings.lastRefreshedAt, staleDate)
      )
    ).orderBy(asc(marketplaceListings.lastRefreshedAt));
    return results.map((row) => ({
      ...row.marketplace_listings,
      user: row.users
    }));
  }
  async getOrphanedAircraftListings() {
    const results = await db.select({
      listing: aircraftListings,
      owner: users
    }).from(aircraftListings).leftJoin(users, eq(aircraftListings.ownerId, users.id)).where(eq(aircraftListings.isListed, true));
    return results.filter((row) => !row.owner || row.owner.isSuspended).map((row) => row.listing);
  }
  async getOrphanedMarketplaceListings() {
    const results = await db.select({
      listing: marketplaceListings,
      user: users
    }).from(marketplaceListings).leftJoin(users, eq(marketplaceListings.userId, users.id)).where(eq(marketplaceListings.isActive, true));
    return results.filter((row) => !row.user || row.user.isSuspended).map((row) => row.listing);
  }
  async refreshAircraftListing(id) {
    const [listing] = await db.update(aircraftListings).set({
      lastRefreshedAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(aircraftListings.id, id)).returning();
    return listing;
  }
  async refreshMarketplaceListing(id) {
    const [listing] = await db.update(marketplaceListings).set({
      lastRefreshedAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(marketplaceListings.id, id)).returning();
    return listing;
  }
  async getUsersWithActiveListings() {
    const aircraftOwners = await db.select({
      userId: aircraftListings.ownerId,
      count: sql2`count(*)::int`
    }).from(aircraftListings).where(eq(aircraftListings.isListed, true)).groupBy(aircraftListings.ownerId);
    const marketplaceOwners = await db.select({
      userId: marketplaceListings.userId,
      count: sql2`count(*)::int`
    }).from(marketplaceListings).where(eq(marketplaceListings.isActive, true)).groupBy(marketplaceListings.userId);
    const userIdsArray = [
      ...aircraftOwners.map((o) => o.userId),
      ...marketplaceOwners.map((o) => o.userId)
    ];
    const uniqueUserIds = Array.from(new Set(userIdsArray));
    const results = [];
    for (const userId of uniqueUserIds) {
      const user = await this.getUser(userId);
      if (user && !user.isSuspended) {
        const aircraftCount = aircraftOwners.find((o) => o.userId === userId)?.count || 0;
        const marketplaceCount = marketplaceOwners.find((o) => o.userId === userId)?.count || 0;
        results.push({
          user,
          aircraftCount,
          marketplaceCount
        });
      }
    }
    return results;
  }
  // Rentals
  async getRental(id) {
    const result = await db.select().from(rentals).where(eq(rentals.id, id)).limit(1);
    return result[0];
  }
  async getAllRentals() {
    return await db.select().from(rentals);
  }
  async getRentalsByRenter(renterId) {
    return await db.select().from(rentals).where(eq(rentals.renterId, renterId));
  }
  async getRentalsByOwner(ownerId) {
    return await db.select().from(rentals).where(eq(rentals.ownerId, ownerId));
  }
  async getRentalsByAircraft(aircraftId) {
    return await db.select().from(rentals).where(eq(rentals.aircraftId, aircraftId));
  }
  async createRental(insertRental) {
    const hourlyRate = parseFloat(insertRental.hourlyRate);
    const estimatedHours = parseFloat(insertRental.estimatedHours);
    const baseCost = hourlyRate * estimatedHours;
    const salesTax = baseCost * 0.0825;
    const platformFeeRenter = baseCost * 0.075;
    const platformFeeOwner = baseCost * 0.075;
    const subtotal = baseCost + salesTax + platformFeeRenter;
    const processingFee = subtotal * 0.03;
    const totalCostRenter = subtotal + processingFee;
    const ownerPayout = baseCost - platformFeeOwner;
    const [rental] = await db.insert(rentals).values({
      ...insertRental,
      baseCost: baseCost.toFixed(2),
      salesTax: salesTax.toFixed(2),
      platformFeeRenter: platformFeeRenter.toFixed(2),
      platformFeeOwner: platformFeeOwner.toFixed(2),
      processingFee: processingFee.toFixed(2),
      totalCostRenter: totalCostRenter.toFixed(2),
      ownerPayout: ownerPayout.toFixed(2)
    }).returning();
    return rental;
  }
  async updateRental(id, updates) {
    const [rental] = await db.update(rentals).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(rentals.id, id)).returning();
    return rental;
  }
  // Messages
  async getMessagesByRental(rentalId) {
    return await db.select().from(messages).where(eq(messages.rentalId, rentalId)).orderBy(asc(messages.createdAt));
  }
  async createMessage(insertMessage) {
    const [message] = await db.insert(messages).values(insertMessage).returning();
    return message;
  }
  async markMessageAsRead(id) {
    const [message] = await db.update(messages).set({ isRead: true }).where(eq(messages.id, id)).returning();
    return message;
  }
  // Reviews
  async getReviewsByUser(userId) {
    return await db.select().from(reviews).where(eq(reviews.revieweeId, userId)).orderBy(desc(reviews.createdAt));
  }
  async getReviewsByRental(rentalId) {
    return await db.select().from(reviews).where(eq(reviews.rentalId, rentalId)).orderBy(desc(reviews.createdAt));
  }
  async createReview(insertReview) {
    const [review] = await db.insert(reviews).values(insertReview).returning();
    const userReviews = await this.getReviewsByUser(insertReview.revieweeId);
    const totalRating = userReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = (totalRating / userReviews.length).toFixed(2);
    await this.updateUser(insertReview.revieweeId, {
      averageRating,
      totalReviews: userReviews.length
    });
    return review;
  }
  async hasUserReviewedRental(rentalId, reviewerId) {
    const result = await db.select().from(reviews).where(and(
      eq(reviews.rentalId, rentalId),
      eq(reviews.reviewerId, reviewerId)
    )).limit(1);
    return result.length > 0;
  }
  // Favorites
  async addFavorite(userId, listingType, listingId) {
    const existing = await this.checkIfFavorited(userId, listingType, listingId);
    if (existing) {
      const [favorite2] = await db.select().from(favorites).where(and(
        eq(favorites.userId, userId),
        eq(favorites.listingType, listingType),
        eq(favorites.listingId, listingId)
      )).limit(1);
      return favorite2;
    }
    const [favorite] = await db.insert(favorites).values({ userId, listingType, listingId }).returning();
    return favorite;
  }
  async removeFavorite(userId, listingType, listingId) {
    const result = await db.delete(favorites).where(and(
      eq(favorites.userId, userId),
      eq(favorites.listingType, listingType),
      eq(favorites.listingId, listingId)
    )).returning();
    return result.length > 0;
  }
  async checkIfFavorited(userId, listingType, listingId) {
    const result = await db.select().from(favorites).where(and(
      eq(favorites.userId, userId),
      eq(favorites.listingType, listingType),
      eq(favorites.listingId, listingId)
    )).limit(1);
    return result.length > 0;
  }
  async getUserFavorites(userId) {
    const userFavorites = await db.select().from(favorites).where(eq(favorites.userId, userId)).orderBy(desc(favorites.createdAt));
    const marketplaceFavoriteIds = userFavorites.filter((f) => f.listingType === "marketplace").map((f) => f.listingId);
    const aircraftFavoriteIds = userFavorites.filter((f) => f.listingType === "aircraft").map((f) => f.listingId);
    let marketplaceListingsList = [];
    if (marketplaceFavoriteIds.length > 0) {
      marketplaceListingsList = await db.select().from(marketplaceListings).where(inArray(marketplaceListings.id, marketplaceFavoriteIds));
    }
    let aircraftListingsList = [];
    if (aircraftFavoriteIds.length > 0) {
      aircraftListingsList = await db.select().from(aircraftListings).where(inArray(aircraftListings.id, aircraftFavoriteIds));
    }
    return {
      marketplace: marketplaceListingsList,
      aircraft: aircraftListingsList
    };
  }
  // Transactions
  async getTransactionsByUser(userId) {
    return await db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt));
  }
  async createTransaction(insertTransaction) {
    const [transaction] = await db.insert(transactions).values(insertTransaction).returning();
    return transaction;
  }
  async updateTransaction(id, updates) {
    const [transaction] = await db.update(transactions).set(updates).where(eq(transactions.id, id)).returning();
    return transaction;
  }
  // Verification Submissions
  async createVerificationSubmission(insertSubmission) {
    const [submission] = await db.insert(verificationSubmissions).values(insertSubmission).returning();
    return submission;
  }
  async getVerificationSubmissionsByUser(userId) {
    return await db.select().from(verificationSubmissions).where(eq(verificationSubmissions.userId, userId)).orderBy(desc(verificationSubmissions.createdAt));
  }
  async getPendingVerificationSubmissions() {
    return await db.select().from(verificationSubmissions).where(eq(verificationSubmissions.status, "pending")).orderBy(asc(verificationSubmissions.createdAt));
  }
  async updateVerificationSubmission(id, updates) {
    const [submission] = await db.update(verificationSubmissions).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(verificationSubmissions.id, id)).returning();
    return submission;
  }
  // Analytics
  async getAnalytics() {
    const now = /* @__PURE__ */ new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1e3);
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfYear = new Date(now.getFullYear(), 0, 1);
    const allTransactions = await db.select().from(transactions);
    const platformFeeTransactions = allTransactions.filter(
      (t) => t.type === "platform_fee" && t.status === "completed"
    );
    const transactionsToday = platformFeeTransactions.filter((t) => t.createdAt && t.createdAt >= today).length;
    const transactionsWeek = platformFeeTransactions.filter((t) => t.createdAt && t.createdAt >= weekAgo).length;
    const transactionsMonth = platformFeeTransactions.filter((t) => t.createdAt && t.createdAt >= firstOfMonth).length;
    const transactionsYear = platformFeeTransactions.filter((t) => t.createdAt && t.createdAt >= firstOfYear).length;
    const calculateRevenue = (txs) => {
      return txs.reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0).toFixed(2);
    };
    const revenueToday = calculateRevenue(platformFeeTransactions.filter((t) => t.createdAt && t.createdAt >= today));
    const revenueWeek = calculateRevenue(platformFeeTransactions.filter((t) => t.createdAt && t.createdAt >= weekAgo));
    const revenueMonth = calculateRevenue(platformFeeTransactions.filter((t) => t.createdAt && t.createdAt >= firstOfMonth));
    const revenueYear = calculateRevenue(platformFeeTransactions.filter((t) => t.createdAt && t.createdAt >= firstOfYear));
    const allExpenses = await db.select().from(expenses);
    const calculateExpenses = (exps) => {
      return exps.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0).toFixed(2);
    };
    const expensesToday = calculateExpenses(allExpenses.filter((e) => e.expenseDate && e.expenseDate >= today));
    const expensesWeek = calculateExpenses(allExpenses.filter((e) => e.expenseDate && e.expenseDate >= weekAgo));
    const expensesMonth = calculateExpenses(allExpenses.filter((e) => e.expenseDate && e.expenseDate >= firstOfMonth));
    const expensesYear = calculateExpenses(allExpenses.filter((e) => e.expenseDate && e.expenseDate >= firstOfYear));
    const calculateProfit = (rev, exp) => {
      return (parseFloat(rev) - parseFloat(exp)).toFixed(2);
    };
    const profitToday = calculateProfit(revenueToday, expensesToday);
    const profitWeek = calculateProfit(revenueWeek, expensesWeek);
    const profitMonth = calculateProfit(revenueMonth, expensesMonth);
    const profitYear = calculateProfit(revenueYear, expensesYear);
    const calculateProfitMargin = (profit, revenue) => {
      const rev = parseFloat(revenue);
      if (rev === 0) return "0.00";
      return (parseFloat(profit) / rev * 100).toFixed(2);
    };
    const profitMarginToday = calculateProfitMargin(profitToday, revenueToday);
    const profitMarginWeek = calculateProfitMargin(profitWeek, revenueWeek);
    const profitMarginMonth = calculateProfitMargin(profitMonth, revenueMonth);
    const profitMarginYear = calculateProfitMargin(profitYear, revenueYear);
    const allRentals = await db.select().from(rentals);
    const totalRentals = allRentals.length;
    const pendingRentals = allRentals.filter((r) => r.status === "pending").length;
    const approvedRentals = allRentals.filter((r) => r.status === "approved").length;
    const activeRentals = allRentals.filter((r) => r.status === "active").length;
    const completedRentals = allRentals.filter((r) => r.status === "completed").length;
    const cancelledRentals = allRentals.filter((r) => r.status === "cancelled").length;
    const newRentalsToday = allRentals.filter((r) => r.createdAt && r.createdAt >= today).length;
    const newRentalsWeek = allRentals.filter((r) => r.createdAt && r.createdAt >= weekAgo).length;
    const endOfToday = new Date(today.getTime() + 24 * 60 * 60 * 1e3 - 1);
    const activeRentalsToday = allRentals.filter(
      (r) => r.status === "active" && r.startDate && r.endDate && new Date(r.startDate) <= endOfToday && new Date(r.endDate) >= today
    ).length;
    const activeRentalsWeek = allRentals.filter(
      (r) => r.status === "active" && r.startDate && r.endDate && new Date(r.startDate) <= now && new Date(r.endDate) >= weekAgo
    ).length;
    const allMarketplaceListings = await db.select().from(marketplaceListings);
    const activeMarketplaceListings = allMarketplaceListings.filter(
      (l) => l.isActive && (!l.expiresAt || new Date(l.expiresAt) > now)
    );
    const expiredMarketplaceListings = allMarketplaceListings.filter(
      (l) => !l.isActive || l.expiresAt && new Date(l.expiresAt) <= now
    );
    const marketplaceByCategory = {
      "job": activeMarketplaceListings.filter((l) => l.category === "job").length,
      "aircraft-sale": activeMarketplaceListings.filter((l) => l.category === "aircraft-sale").length,
      "cfi": activeMarketplaceListings.filter((l) => l.category === "cfi").length,
      "flight-school": activeMarketplaceListings.filter((l) => l.category === "flight-school").length,
      "mechanic": activeMarketplaceListings.filter((l) => l.category === "mechanic").length,
      "charter": activeMarketplaceListings.filter((l) => l.category === "charter").length
    };
    return {
      transactionsToday,
      transactionsWeek,
      transactionsMonth,
      transactionsYear,
      revenueToday,
      revenueWeek,
      revenueMonth,
      revenueYear,
      expensesToday,
      expensesWeek,
      expensesMonth,
      expensesYear,
      profitToday,
      profitWeek,
      profitMonth,
      profitYear,
      profitMarginToday,
      profitMarginWeek,
      profitMarginMonth,
      profitMarginYear,
      totalRentals,
      pendingRentals,
      approvedRentals,
      activeRentals,
      completedRentals,
      cancelledRentals,
      newRentalsToday,
      newRentalsWeek,
      activeRentalsToday,
      activeRentalsWeek,
      totalActiveMarketplaceListings: activeMarketplaceListings.length,
      totalExpiredMarketplaceListings: expiredMarketplaceListings.length,
      marketplaceByCategory
    };
  }
  // CRM - Leads
  async getAllLeads() {
    return await db.select().from(crmLeads).orderBy(desc(crmLeads.createdAt));
  }
  async getLead(id) {
    const [lead] = await db.select().from(crmLeads).where(eq(crmLeads.id, id));
    return lead;
  }
  async createLead(insertLead) {
    const [lead] = await db.insert(crmLeads).values(insertLead).returning();
    return lead;
  }
  async updateLead(id, updates) {
    const [lead] = await db.update(crmLeads).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(crmLeads.id, id)).returning();
    return lead;
  }
  async deleteLead(id) {
    const result = await db.delete(crmLeads).where(eq(crmLeads.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  // CRM - Contacts
  async getAllContacts() {
    return await db.select().from(crmContacts).orderBy(desc(crmContacts.createdAt));
  }
  async getContact(id) {
    const [contact] = await db.select().from(crmContacts).where(eq(crmContacts.id, id));
    return contact;
  }
  async createContact(insertContact) {
    const [contact] = await db.insert(crmContacts).values(insertContact).returning();
    return contact;
  }
  async updateContact(id, updates) {
    const [contact] = await db.update(crmContacts).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(crmContacts.id, id)).returning();
    return contact;
  }
  async deleteContact(id) {
    const result = await db.delete(crmContacts).where(eq(crmContacts.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  // CRM - Deals
  async getAllDeals() {
    return await db.select().from(crmDeals).orderBy(desc(crmDeals.createdAt));
  }
  async getDeal(id) {
    const [deal] = await db.select().from(crmDeals).where(eq(crmDeals.id, id));
    return deal;
  }
  async createDeal(insertDeal) {
    const [deal] = await db.insert(crmDeals).values(insertDeal).returning();
    return deal;
  }
  async updateDeal(id, updates) {
    const [deal] = await db.update(crmDeals).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(crmDeals.id, id)).returning();
    return deal;
  }
  async deleteDeal(id) {
    const result = await db.delete(crmDeals).where(eq(crmDeals.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  // CRM - Activities
  async getAllActivities() {
    return await db.select().from(crmActivities).orderBy(desc(crmActivities.createdAt));
  }
  async getActivity(id) {
    const [activity] = await db.select().from(crmActivities).where(eq(crmActivities.id, id));
    return activity;
  }
  async createActivity(insertActivity) {
    const [activity] = await db.insert(crmActivities).values(insertActivity).returning();
    return activity;
  }
  async updateActivity(id, updates) {
    const [activity] = await db.update(crmActivities).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(crmActivities.id, id)).returning();
    return activity;
  }
  async deleteActivity(id) {
    const result = await db.delete(crmActivities).where(eq(crmActivities.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  // Expenses
  async getAllExpenses() {
    return await db.select().from(expenses).orderBy(desc(expenses.expenseDate));
  }
  async getExpense(id) {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense;
  }
  async createExpense(insertExpense) {
    const [expense] = await db.insert(expenses).values(insertExpense).returning();
    return expense;
  }
  async updateExpense(id, updates) {
    const [expense] = await db.update(expenses).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(expenses.id, id)).returning();
    return expense;
  }
  async deleteExpense(id) {
    const result = await db.delete(expenses).where(eq(expenses.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  // Promo Codes
  async getAllPromoCodes() {
    return await db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));
  }
  async getActivePromoCodes(context) {
    const now = /* @__PURE__ */ new Date();
    let query = db.select().from(promoCodes).where(
      and(
        eq(promoCodes.isActive, true),
        or(
          sql2`${promoCodes.validFrom} IS NULL`,
          lte(promoCodes.validFrom, now)
        ),
        or(
          sql2`${promoCodes.validUntil} IS NULL`,
          gte(promoCodes.validUntil, now)
        )
      )
    );
    const codes = await query.orderBy(desc(promoCodes.createdAt));
    if (context === "banner-ad") {
      return codes.filter((code) => code.applicableToBannerAds);
    } else if (context === "marketplace") {
      return codes.filter((code) => code.applicableToMarketplace);
    }
    return codes;
  }
  async getPromoCodeByCode(code) {
    const [promoCode] = await db.select().from(promoCodes).where(eq(promoCodes.code, code.toUpperCase()));
    return promoCode;
  }
  async getPromoCode(id) {
    const [promoCode] = await db.select().from(promoCodes).where(eq(promoCodes.id, id));
    return promoCode;
  }
  async createPromoCode(insertPromoCode) {
    const [promoCode] = await db.insert(promoCodes).values({
      ...insertPromoCode,
      code: insertPromoCode.code.toUpperCase()
    }).returning();
    return promoCode;
  }
  async updatePromoCode(id, updates) {
    const updateData = { ...updates, updatedAt: /* @__PURE__ */ new Date() };
    if (updates.code) {
      updateData.code = updates.code.toUpperCase();
    }
    const [promoCode] = await db.update(promoCodes).set(updateData).where(eq(promoCodes.id, id)).returning();
    return promoCode;
  }
  async deletePromoCode(id) {
    const result = await db.delete(promoCodes).where(eq(promoCodes.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  async validatePromoCodeForContext(code, context) {
    const promoCode = await this.getPromoCodeByCode(code);
    if (!promoCode) return null;
    if (!promoCode.isActive) return null;
    if (context === "banner-ad" && !promoCode.applicableToBannerAds) return null;
    if (context === "marketplace" && !promoCode.applicableToMarketplace) return null;
    const now = /* @__PURE__ */ new Date();
    if (promoCode.validFrom && promoCode.validFrom > now) return null;
    if (promoCode.validUntil && promoCode.validUntil < now) return null;
    if (promoCode.maxUses !== null && (promoCode.usedCount ?? 0) >= promoCode.maxUses) {
      return null;
    }
    return promoCode;
  }
  async recordPromoCodeUsage(usage) {
    const [promoCodeUsage] = await db.insert(promoCodeUsages).values(usage).returning();
    await db.update(promoCodes).set({
      usedCount: sql2`${promoCodes.usedCount} + 1`,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(promoCodes.id, usage.promoCodeId));
    return promoCodeUsage;
  }
  async getPromoCodeUsageCount(promoCodeId) {
    const result = await db.select({ count: sql2`count(*)::int` }).from(promoCodeUsages).where(eq(promoCodeUsages.promoCodeId, promoCodeId));
    return result[0]?.count || 0;
  }
  // Admin Notifications
  async getAllAdminNotifications() {
    return await db.select().from(adminNotifications).orderBy(desc(adminNotifications.createdAt));
  }
  async getUnreadAdminNotifications() {
    return await db.select().from(adminNotifications).where(eq(adminNotifications.isRead, false)).orderBy(desc(adminNotifications.createdAt));
  }
  async createAdminNotification(insertNotification) {
    const [notification] = await db.insert(adminNotifications).values(insertNotification).returning();
    return notification;
  }
  async markNotificationAsRead(id) {
    const [notification] = await db.update(adminNotifications).set({ isRead: true, readAt: /* @__PURE__ */ new Date() }).where(eq(adminNotifications.id, id)).returning();
    return notification;
  }
  async markNotificationAsActionable(id, isActionable) {
    const [notification] = await db.update(adminNotifications).set({ isActionable }).where(eq(adminNotifications.id, id)).returning();
    return notification;
  }
  async deleteAdminNotification(id) {
    const result = await db.delete(adminNotifications).where(eq(adminNotifications.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  // Contact Form Submissions
  async createContactSubmission(submission) {
    const [contactSubmission] = await db.insert(contactSubmissions).values(submission).returning();
    return contactSubmission;
  }
  async updateContactSubmissionEmailStatus(id, sent) {
    const [submission] = await db.update(contactSubmissions).set({ emailSent: sent, emailSentAt: sent ? /* @__PURE__ */ new Date() : null }).where(eq(contactSubmissions.id, id)).returning();
    return submission;
  }
  // Banner Ad Orders
  async getAllBannerAdOrders() {
    return await db.select().from(bannerAdOrders).orderBy(desc(bannerAdOrders.createdAt));
  }
  async getBannerAdOrder(id) {
    const [order] = await db.select().from(bannerAdOrders).where(eq(bannerAdOrders.id, id));
    return order;
  }
  async getBannerAdOrdersByStatus(approvalStatus, paymentStatus) {
    const conditions = [];
    if (approvalStatus) {
      conditions.push(eq(bannerAdOrders.approvalStatus, approvalStatus));
    }
    if (paymentStatus) {
      conditions.push(eq(bannerAdOrders.paymentStatus, paymentStatus));
    }
    if (conditions.length === 0) {
      return await this.getAllBannerAdOrders();
    }
    return await db.select().from(bannerAdOrders).where(and(...conditions)).orderBy(desc(bannerAdOrders.createdAt));
  }
  async createBannerAdOrder(insertOrder) {
    const [order] = await db.insert(bannerAdOrders).values(insertOrder).returning();
    return order;
  }
  async updateBannerAdOrder(id, updates) {
    const [order] = await db.update(bannerAdOrders).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(bannerAdOrders.id, id)).returning();
    return order;
  }
  async deleteBannerAdOrder(id) {
    await db.delete(bannerAds).where(eq(bannerAds.orderId, id));
    await db.delete(promoCodeUsages).where(eq(promoCodeUsages.bannerAdOrderId, id));
    const result = await db.delete(bannerAdOrders).where(eq(bannerAdOrders.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  async activateBannerAdOrder(orderId) {
    const order = await this.getBannerAdOrder(orderId);
    if (!order) {
      return void 0;
    }
    if (order.paymentStatus !== "paid") {
      throw new Error("UNPAID_ORDER");
    }
    if (!order.paypalOrderId || order.paypalOrderId.trim() === "") {
      throw new Error("MISSING_PAYMENT_REFERENCE");
    }
    if (order.approvalStatus !== "approved") {
      throw new Error("NOT_APPROVED");
    }
    const existingAd = await db.select().from(bannerAds).where(eq(bannerAds.orderId, orderId)).limit(1);
    if (existingAd.length > 0) {
      throw new Error("ALREADY_ACTIVATED");
    }
    if (!order.imageUrl || order.imageUrl.trim() === "") {
      throw new Error("IMAGE_REQUIRED");
    }
    const startDate = order.startDate || /* @__PURE__ */ new Date();
    let endDate = order.endDate || new Date(startDate);
    if (!order.endDate) {
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 30);
    }
    const bannerAdData = {
      orderId: order.id,
      title: order.title,
      description: order.description,
      imageUrl: order.imageUrl,
      link: order.link,
      placements: order.placements,
      category: order.category,
      isActive: true,
      startDate,
      endDate
    };
    const [ad] = await db.insert(bannerAds).values(bannerAdData).returning();
    return ad;
  }
  async getExpiringBannerAdOrders(daysUntilExpiration) {
    const now = /* @__PURE__ */ new Date();
    const targetDate = /* @__PURE__ */ new Date();
    targetDate.setDate(targetDate.getDate() + daysUntilExpiration);
    const targetDateStart = new Date(targetDate);
    targetDateStart.setHours(0, 0, 0, 0);
    const targetDateEnd = new Date(targetDate);
    targetDateEnd.setHours(23, 59, 59, 999);
    return await db.select().from(bannerAdOrders).where(
      and(
        eq(bannerAdOrders.approvalStatus, "approved"),
        eq(bannerAdOrders.paymentStatus, "paid"),
        eq(bannerAdOrders.expirationReminderSent, false),
        gte(bannerAdOrders.endDate, targetDateStart),
        lte(bannerAdOrders.endDate, targetDateEnd)
      )
    ).orderBy(asc(bannerAdOrders.endDate));
  }
  // Banner Ads
  async getAllBannerAds() {
    return await db.select().from(bannerAds).orderBy(desc(bannerAds.createdAt));
  }
  async getActiveBannerAds(placement, category) {
    const now = /* @__PURE__ */ new Date();
    const conditions = [
      eq(bannerAds.isActive, true),
      lte(bannerAds.startDate, now),
      // endDate can be null (no expiration) or >= now (not expired yet)
      or(
        isNull(bannerAds.endDate),
        gte(bannerAds.endDate, now)
      )
    ];
    if (placement) {
      conditions.push(arrayOverlaps(bannerAds.placements, [placement]));
    }
    if (category) {
      conditions.push(eq(bannerAds.category, category));
    }
    return await db.select().from(bannerAds).where(and(...conditions)).orderBy(desc(bannerAds.impressions));
  }
  async getBannerAd(id) {
    const [ad] = await db.select().from(bannerAds).where(eq(bannerAds.id, id));
    return ad;
  }
  async createBannerAd(insertAd) {
    const [ad] = await db.insert(bannerAds).values(insertAd).returning();
    return ad;
  }
  async updateBannerAd(id, updates) {
    const [ad] = await db.update(bannerAds).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(bannerAds.id, id)).returning();
    return ad;
  }
  async deleteBannerAd(id) {
    const result = await db.delete(bannerAds).where(eq(bannerAds.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  async incrementBannerImpressions(id) {
    await db.update(bannerAds).set({ impressions: sql2`${bannerAds.impressions} + 1` }).where(eq(bannerAds.id, id));
  }
  async incrementBannerClicks(id) {
    await db.update(bannerAds).set({ clicks: sql2`${bannerAds.clicks} + 1` }).where(eq(bannerAds.id, id));
  }
  // Job Applications
  async createJobApplication(insertApplication) {
    const [application] = await db.insert(jobApplications).values(insertApplication).returning();
    return application;
  }
  async getJobApplicationsByListing(listingId) {
    return await db.select().from(jobApplications).where(eq(jobApplications.listingId, listingId)).orderBy(desc(jobApplications.createdAt));
  }
  async getJobApplicationsByApplicant(applicantId) {
    return await db.select().from(jobApplications).where(eq(jobApplications.applicantId, applicantId)).orderBy(desc(jobApplications.createdAt));
  }
  async getJobApplication(id) {
    const [application] = await db.select().from(jobApplications).where(eq(jobApplications.id, id));
    return application;
  }
  async updateJobApplication(id, updates) {
    const [application] = await db.update(jobApplications).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(jobApplications.id, id)).returning();
    return application;
  }
  // Promo Alerts
  async getActivePromoAlerts() {
    return await db.select().from(promoAlerts).where(eq(promoAlerts.isEnabled, true)).orderBy(desc(promoAlerts.createdAt));
  }
  async getAllPromoAlerts() {
    return await db.select().from(promoAlerts).orderBy(desc(promoAlerts.createdAt));
  }
  async getPromoAlert(id) {
    const [alert] = await db.select().from(promoAlerts).where(eq(promoAlerts.id, id));
    return alert;
  }
  async createPromoAlert(insertAlert) {
    const [alert] = await db.insert(promoAlerts).values(insertAlert).returning();
    return alert;
  }
  async updatePromoAlert(id, updates) {
    const [alert] = await db.update(promoAlerts).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(promoAlerts.id, id)).returning();
    return alert;
  }
  async deletePromoAlert(id) {
    const result = await db.delete(promoAlerts).where(eq(promoAlerts.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  // Marketplace Listing Promotional Free Time
  async grantMarketplacePromoFreeTime(listingId, durationDays, adminId) {
    const promoFreeUntil = /* @__PURE__ */ new Date();
    promoFreeUntil.setDate(promoFreeUntil.getDate() + durationDays);
    const [listing] = await db.update(marketplaceListings).set({
      promoFreeUntil,
      promoGrantedBy: adminId,
      promoGrantedAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(marketplaceListings.id, listingId)).returning();
    return listing;
  }
  // Withdrawal Requests (PayPal Payouts)
  async getUserBalance(userId) {
    const user = await this.getUser(userId);
    return user?.balance || "0.00";
  }
  async addToUserBalance(userId, amount) {
    const [updatedUser] = await db.update(users).set({
      balance: sql2`CAST(COALESCE(${users.balance}, '0') AS DECIMAL(10,2)) + ${amount}`,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(users.id, userId)).returning();
    return updatedUser;
  }
  async deductFromUserBalance(userId, amount) {
    const [updatedUser] = await db.update(users).set({
      balance: sql2`CAST(COALESCE(${users.balance}, '0') AS DECIMAL(10,2)) - ${amount}`,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(
      and(
        eq(users.id, userId),
        sql2`CAST(COALESCE(${users.balance}, '0') AS DECIMAL(10,2)) >= ${amount}`
      )
    ).returning();
    if (!updatedUser) {
      throw new Error("Insufficient balance");
    }
    return updatedUser;
  }
  async createWithdrawalRequest(insertRequest) {
    const [request] = await db.insert(withdrawalRequests).values(insertRequest).returning();
    return request;
  }
  async getWithdrawalRequest(id) {
    const [request] = await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.id, id));
    return request;
  }
  async getWithdrawalRequestsByUser(userId) {
    return await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.userId, userId)).orderBy(desc(withdrawalRequests.createdAt));
  }
  async getPendingWithdrawalRequests() {
    return await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.status, "pending")).orderBy(desc(withdrawalRequests.createdAt));
  }
  async getAllWithdrawalRequests() {
    return await db.select().from(withdrawalRequests).orderBy(desc(withdrawalRequests.createdAt));
  }
  async updateWithdrawalRequest(id, updates) {
    const [request] = await db.update(withdrawalRequests).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(withdrawalRequests.id, id)).returning();
    return request;
  }
  // Pilot Logbook Entries
  async createLogbookEntry(insertEntry) {
    const dataToInsert = {
      ...insertEntry,
      flightDate: insertEntry.flightDate instanceof Date ? insertEntry.flightDate.toISOString().split("T")[0] : insertEntry.flightDate
    };
    const [entry] = await db.insert(logbookEntries).values(dataToInsert).returning();
    return entry;
  }
  async getLogbookEntryById(id) {
    const [entry] = await db.select().from(logbookEntries).where(eq(logbookEntries.id, id));
    return entry;
  }
  async getLogbookEntriesByUser(userId) {
    return await db.select().from(logbookEntries).where(eq(logbookEntries.userId, userId)).orderBy(desc(logbookEntries.flightDate));
  }
  async updateLogbookEntry(id, updates) {
    const existing = await this.getLogbookEntryById(id);
    if (existing?.isLocked) {
      throw new Error("Cannot edit a locked logbook entry");
    }
    const [entry] = await db.update(logbookEntries).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(logbookEntries.id, id)).returning();
    return entry;
  }
  async lockLogbookEntry(id, signatureDataUrl, signedByName) {
    const existing = await this.getLogbookEntryById(id);
    if (!existing) {
      throw new Error("Logbook entry not found");
    }
    if (existing.isLocked) {
      throw new Error("Entry is already locked");
    }
    const [entry] = await db.update(logbookEntries).set({
      isLocked: true,
      signatureDataUrl,
      signedByName,
      signedAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(logbookEntries.id, id)).returning();
    return entry;
  }
  async deleteLogbookEntry(id) {
    const existing = await this.getLogbookEntryById(id);
    if (existing?.isLocked) {
      throw new Error("Cannot delete a locked logbook entry");
    }
    const result = await db.delete(logbookEntries).where(eq(logbookEntries.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
};
var storage = new DatabaseStorage();

// server/routes.ts
init_schema();

// server/replitAuth.ts
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import passport from "passport";
import session from "express-session";
import connectPg from "connect-pg-simple";
var AUTH_DISABLED = String(process.env.AUTH_DISABLED ?? "").toLowerCase() === "true";
var HAS_GOOGLE = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
function getApiBaseUrl() {
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL;
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL;
  const port = process.env.PORT || "5000";
  return `http://localhost:${port}`;
}
function getGoogleCallbackUrl() {
  if (process.env.GOOGLE_REDIRECT_URL) return process.env.GOOGLE_REDIRECT_URL;
  return `${getApiBaseUrl()}/api/auth/google/callback`;
}
function getSession() {
  const sessionTtlSeconds = 7 * 24 * 60 * 60;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtlSeconds,
    tableName: "sessions"
  });
  return session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: true,
    cookie: {
      httpOnly: true,
      // Cross-site (frontend on readysetfly.us, API on readysetfly-api.onrender.com)
      // In production we must use SameSite=None and Secure so cookies survive cross-site in incognito.
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production" ? true : false,
      // If you have both app + api on the same apex, you can set domain to .readysetfly.us
      // Leave undefined to let the browser scope it to the API host.
      maxAge: sessionTtlSeconds * 1e3
    }
  });
}
function makePassportUser(internalUserId, profile) {
  return {
    claims: {
      sub: internalUserId,
      email: profile.emails?.[0]?.value ?? null,
      first_name: profile.name?.givenName ?? null,
      last_name: profile.name?.familyName ?? null,
      profile_image_url: profile.photos?.[0]?.value ?? null
    }
  };
}
async function resolveUserFromGoogle(profile) {
  const email = profile.emails?.[0]?.value;
  if (email) {
    const byEmail = await storage.getUserByEmail(String(email));
    if (byEmail) {
      await storage.updateUser(byEmail.id, {
        // keep id stable; just refresh profile data
        firstName: profile.name?.givenName ?? byEmail.firstName,
        lastName: profile.name?.familyName ?? byEmail.lastName,
        profileImageUrl: profile.photos?.[0]?.value ?? byEmail.profileImageUrl,
        emailVerified: true
      });
      const refreshed = await storage.getUser(byEmail.id);
      if (!refreshed) throw new Error("User not found after update (email match)");
      return refreshed;
    }
  }
  const created = await storage.createUser({
    email: email ?? null,
    firstName: profile.name?.givenName ?? null,
    lastName: profile.name?.familyName ?? null,
    profileImageUrl: profile.photos?.[0]?.value ?? null,
    emailVerified: true
    // NOTE: hashedPassword remains null for OAuth-only accounts
  });
  return created;
}
var isAuthenticated = async (req, res, next) => {
  if (AUTH_DISABLED) return next();
  if (typeof req.isAuthenticated === "function") {
    if (req.isAuthenticated() && req.user?.claims?.sub) return next();
  }
  if (req.session?.userId) return next();
  return res.status(401).json({ message: "Unauthorized" });
};
var isAdmin = async (req, res, next) => {
  if (AUTH_DISABLED) return next();
  const userId = req.user?.claims?.sub || req.session?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const dbUser = await storage.getUser(String(userId));
  if (!dbUser || !dbUser.isAdmin) {
    return res.status(403).json({ message: "Forbidden - Admin access required" });
  }
  next();
};
async function setupAuth(app2) {
  app2.set("trust proxy", 1);
  app2.use(getSession());
  if (AUTH_DISABLED) {
    console.log("[AUTH] AUTH_DISABLED=true (sessions enabled, passport disabled).");
    return;
  }
  app2.use(passport.initialize());
  app2.use(passport.session());
  passport.serializeUser((user, done) => {
    const id = user?.claims?.sub;
    done(null, id);
  });
  passport.deserializeUser(async (id, done) => {
    try {
      if (!id) return done(null, false);
      const dbUser = await storage.getUser(String(id));
      if (!dbUser) return done(null, false);
      const passportUser = {
        claims: {
          sub: dbUser.id,
          email: dbUser.email,
          first_name: dbUser.firstName,
          last_name: dbUser.lastName,
          profile_image_url: dbUser.profileImageUrl
        }
      };
      done(null, passportUser);
    } catch (e) {
      done(e);
    }
  });
  if (HAS_GOOGLE) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: getGoogleCallbackUrl()
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const dbUser = await resolveUserFromGoogle(profile);
            if (!dbUser) throw new Error("resolveUserFromGoogle returned undefined");
            const passportUser = makePassportUser(dbUser.id, profile);
            done(null, passportUser);
          } catch (err) {
            done(err);
          }
        }
      )
    );
    app2.get(
      "/api/auth/google",
      passport.authenticate("google", { scope: ["profile", "email"] })
    );
    app2.get(
      "/api/auth/google/callback",
      passport.authenticate("google", { failureRedirect: "/" }),
      (req, res) => {
        const userId = req.user?.claims?.sub;
        if (userId) req.session.userId = userId;
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("[AUTH][google callback] session save error:", saveErr);
            return res.status(500).json({ message: "Session save failed", detail: String(saveErr) });
          }
          const frontend = process.env.FRONTEND_BASE_URL || "https://readysetfly.us";
          return res.redirect(frontend);
        });
      }
    );
    console.log("[AUTH] Google OAuth 2.0 enabled. Callback:", getGoogleCallbackUrl());
  } else {
    console.log("[AUTH] Google OAuth 2.0 NOT enabled (missing GOOGLE_CLIENT_ID/SECRET).");
  }
}

// server/routes.ts
init_resendClient();
init_email_templates();

// server/mobile-auth-routes.ts
import { Router } from "express";
import bcrypt from "bcrypt";
import { z as z2 } from "zod";

// server/jwt.ts
import jwt from "jsonwebtoken";
import crypto from "crypto";
var JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "default-jwt-secret-change-in-production";
var ACCESS_TOKEN_EXPIRY = "15m";
var REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1e3;
function generateAccessToken(userId, email) {
  const payload = { userId, email };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}
function generateRefreshToken() {
  return crypto.randomBytes(40).toString("hex");
}
function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload;
  } catch (error) {
    return null;
  }
}
function getRefreshTokenExpiry() {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRY);
}

// server/mobile-auth-routes.ts
var router = Router();
var registerSchema = z2.object({
  email: z2.string().email("Valid email is required"),
  password: z2.string().min(8, "Password must be at least 8 characters"),
  firstName: z2.string().min(1, "First name is required").optional(),
  lastName: z2.string().min(1, "Last name is required").optional()
});
var loginSchema = z2.object({
  email: z2.string().email("Valid email is required"),
  password: z2.string().min(1, "Password is required")
});
var refreshSchema = z2.object({
  refreshToken: z2.string().min(1, "Refresh token is required")
});
function registerMobileAuthRoutes(storage2) {
  router.post("/register", async (req, res) => {
    try {
      const result = registerSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: "Validation failed",
          details: result.error.format()
        });
        return;
      }
      const { email, password, firstName, lastName } = result.data;
      const existingUser = await storage2.getUserByEmail(email);
      if (existingUser) {
        res.status(409).json({ error: "User with this email already exists" });
        return;
      }
      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await storage2.createUser({
        email,
        firstName,
        lastName,
        hashedPassword,
        passwordCreatedAt: /* @__PURE__ */ new Date(),
        certifications: [],
        totalFlightHours: 0
      });
      const accessToken = generateAccessToken(user.id, user.email);
      const refreshToken = generateRefreshToken();
      await storage2.createRefreshToken({
        userId: user.id,
        token: refreshToken,
        expiresAt: getRefreshTokenExpiry(),
        deviceInfo: req.headers["user-agent"] || null,
        ipAddress: req.ip || req.socket.remoteAddress || null
      });
      const { hashedPassword: _, passwordCreatedAt: __, ...userResponse } = user;
      res.status(201).json({
        user: userResponse,
        accessToken,
        refreshToken
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Failed to register user" });
    }
  });
  router.post("/login", async (req, res) => {
    try {
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: "Validation failed",
          details: result.error.format()
        });
        return;
      }
      const { email, password } = result.data;
      const user = await storage2.getUserByEmail(email);
      if (!user || !user.hashedPassword) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }
      const passwordValid = await bcrypt.compare(password, user.hashedPassword);
      if (!passwordValid) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }
      if (user.isSuspended) {
        res.status(403).json({
          error: "Account suspended",
          reason: user.suspensionReason || "Your account has been suspended"
        });
        return;
      }
      const accessToken = generateAccessToken(user.id, user.email);
      const refreshToken = generateRefreshToken();
      await storage2.createRefreshToken({
        userId: user.id,
        token: refreshToken,
        expiresAt: getRefreshTokenExpiry(),
        deviceInfo: req.headers["user-agent"] || null,
        ipAddress: req.ip || req.socket.remoteAddress || null
      });
      const { hashedPassword: _, passwordCreatedAt: __, ...userResponse } = user;
      res.status(200).json({
        user: userResponse,
        accessToken,
        refreshToken
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });
  router.post("/refresh", async (req, res) => {
    try {
      const result = refreshSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: "Validation failed",
          details: result.error.format()
        });
        return;
      }
      const { refreshToken: token } = result.data;
      const storedToken = await storage2.getRefreshToken(token);
      if (!storedToken) {
        res.status(401).json({ error: "Invalid refresh token" });
        return;
      }
      if (/* @__PURE__ */ new Date() > storedToken.expiresAt) {
        await storage2.deleteRefreshToken(token);
        res.status(401).json({ error: "Refresh token expired" });
        return;
      }
      const user = await storage2.getUser(storedToken.userId);
      if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
      }
      if (user.isSuspended) {
        res.status(403).json({
          error: "Account suspended",
          reason: user.suspensionReason || "Your account has been suspended"
        });
        return;
      }
      await storage2.deleteRefreshToken(token);
      const newAccessToken = generateAccessToken(user.id, user.email);
      const newRefreshToken = generateRefreshToken();
      await storage2.createRefreshToken({
        userId: user.id,
        token: newRefreshToken,
        expiresAt: getRefreshTokenExpiry(),
        deviceInfo: req.headers["user-agent"] || null,
        ipAddress: req.ip || req.socket.remoteAddress || null
      });
      res.status(200).json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      });
    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(500).json({ error: "Failed to refresh token" });
    }
  });
  router.post("/logout", async (req, res) => {
    try {
      const result = refreshSchema.safeParse(req.body);
      if (result.success) {
        await storage2.deleteRefreshToken(result.data.refreshToken);
      }
      res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Failed to logout" });
    }
  });
  router.get("/me", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "No token provided" });
        return;
      }
      const token = authHeader.substring(7);
      const payload = verifyAccessToken(token);
      if (!payload) {
        res.status(401).json({ error: "Invalid token" });
        return;
      }
      const user = await storage2.getUser(payload.userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      if (user.isSuspended) {
        res.status(403).json({
          error: "Account suspended",
          reason: user.suspensionReason || "Your account has been suspended"
        });
        return;
      }
      const { hashedPassword: _, passwordCreatedAt: __, ...userResponse } = user;
      res.status(200).json(userResponse);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });
  return router;
}
var mobile_auth_routes_default = registerMobileAuthRoutes;

// server/unified-auth-routes.ts
import { Router as Router2 } from "express";
import bcrypt2 from "bcrypt";
import { z as z3 } from "zod";
import crypto2 from "crypto";
init_resendClient();
var router2 = Router2();
function hashRefreshToken(token) {
  return crypto2.createHash("sha256").update(token).digest("hex");
}
function generateEmailVerificationToken() {
  return crypto2.randomBytes(32).toString("hex");
}
function getVerificationTokenExpiry() {
  const expiryDate = /* @__PURE__ */ new Date();
  expiryDate.setHours(expiryDate.getHours() + 24);
  return expiryDate;
}
var registerSchema2 = z3.object({
  email: z3.string().email("Invalid email address"),
  password: z3.string().min(8, "Password must be at least 8 characters"),
  firstName: z3.string().min(1, "First name is required"),
  lastName: z3.string().min(1, "Last name is required")
});
var loginSchema2 = z3.object({
  email: z3.string().email("Invalid email address"),
  password: z3.string().min(1, "Password is required")
});
var refreshSchema2 = z3.object({
  refreshToken: z3.string().min(1, "Refresh token is required")
});
function getRefreshTokenExpiry2() {
  const expiryDate = /* @__PURE__ */ new Date();
  expiryDate.setDate(expiryDate.getDate() + 7);
  return expiryDate;
}
function registerUnifiedAuthRoutes(storage2) {
  router2.post("/web-register", async (req, res) => {
    try {
      const result = registerSchema2.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: "Validation failed",
          details: result.error.format()
        });
        return;
      }
      const { email, password, firstName, lastName } = result.data;
      const existingUser = await storage2.getUserByEmail(email);
      if (existingUser) {
        res.status(409).json({ error: "User with this email already exists" });
        return;
      }
      const hashedPassword = await bcrypt2.hash(password, 12);
      const verificationToken = generateEmailVerificationToken();
      const verificationExpires = getVerificationTokenExpiry();
      const user = await storage2.createUser({
        email,
        firstName,
        lastName,
        hashedPassword,
        passwordCreatedAt: /* @__PURE__ */ new Date(),
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
        emailVerified: false,
        certifications: [],
        totalFlightHours: 0,
        aircraftTypesFlown: []
      });
      try {
        const { client: client2, fromEmail } = await getUncachableResendClient();
        const verificationUrl = `${req.protocol}://${req.get("host")}/verify-email?token=${verificationToken}`;
        await client2.emails.send({
          from: fromEmail,
          to: email,
          subject: "Verify your Ready Set Fly account",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1e40af;">Welcome to Ready Set Fly!</h1>
              <p>Hi ${firstName},</p>
              <p>Thank you for creating an account with Ready Set Fly. Please verify your email address by clicking the button below:</p>
              <a href="${verificationUrl}" style="display: inline-block; background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Verify Email Address</a>
              <p>Or copy and paste this link into your browser:</p>
              <p style="color: #6b7280; word-break: break-all;">${verificationUrl}</p>
              <p>This link will expire in 24 hours.</p>
              <p>If you didn't create this account, you can safely ignore this email.</p>
              <p style="color: #6b7280; margin-top: 30px;">Best regards,<br>The Ready Set Fly Team</p>
            </div>
          `
        });
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
      }
      req.session.userId = user.id;
      req.session.passport = {
        user: {
          claims: {
            sub: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`
          }
        }
      };
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          res.status(500).json({ error: "Failed to create session" });
          return;
        }
        const { hashedPassword: _, passwordCreatedAt: __, emailVerificationToken: ___, ...userResponse } = user;
        res.status(201).json({
          user: userResponse,
          message: "Account created! Please check your email to verify your account."
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Failed to register user" });
    }
  });
  router2.post("/web-login", async (req, res) => {
    try {
      const result = loginSchema2.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: "Validation failed",
          details: result.error.format()
        });
        return;
      }
      const { email, password } = result.data;
      const user = await storage2.getUserByEmail(email);
      if (!user || !user.hashedPassword) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }
      const passwordValid = await bcrypt2.compare(password, user.hashedPassword);
      if (!passwordValid) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }
      if (user.isSuspended) {
        res.status(403).json({
          error: "Account suspended",
          reason: user.suspensionReason || "Your account has been suspended"
        });
        return;
      }
      req.session.userId = user.id;
      req.session.passport = {
        user: {
          claims: {
            sub: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`
          }
        }
      };
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          res.status(500).json({ error: "Failed to create session" });
          return;
        }
        const { hashedPassword: _, passwordCreatedAt: __, emailVerificationToken: ___, ...userResponse } = user;
        res.status(200).json({ user: userResponse });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });
  router2.post("/register", async (req, res) => {
    try {
      const result = registerSchema2.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: "Validation failed",
          details: result.error.format()
        });
        return;
      }
      const { email, password, firstName, lastName } = result.data;
      const existingUser = await storage2.getUserByEmail(email);
      if (existingUser) {
        res.status(409).json({ error: "User with this email already exists" });
        return;
      }
      const hashedPassword = await bcrypt2.hash(password, 12);
      const user = await storage2.createUser({
        email,
        firstName,
        lastName,
        hashedPassword,
        passwordCreatedAt: /* @__PURE__ */ new Date(),
        certifications: [],
        totalFlightHours: 0,
        aircraftTypesFlown: []
      });
      const accessToken = generateAccessToken(user.id, user.email);
      const refreshToken = generateRefreshToken();
      await storage2.createRefreshToken({
        userId: user.id,
        token: refreshToken,
        expiresAt: getRefreshTokenExpiry2(),
        deviceInfo: req.headers["user-agent"] || null,
        ipAddress: req.ip || req.socket.remoteAddress || null
      });
      const { hashedPassword: _, passwordCreatedAt: __, ...userResponse } = user;
      res.status(201).json({
        user: userResponse,
        accessToken,
        refreshToken
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Failed to register user" });
    }
  });
  router2.post("/login", async (req, res) => {
    try {
      const result = loginSchema2.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: "Validation failed",
          details: result.error.format()
        });
        return;
      }
      const { email, password } = result.data;
      const user = await storage2.getUserByEmail(email);
      if (!user || !user.hashedPassword) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }
      const passwordValid = await bcrypt2.compare(password, user.hashedPassword);
      if (!passwordValid) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }
      if (user.isSuspended) {
        res.status(403).json({
          error: "Account suspended",
          reason: user.suspensionReason || "Your account has been suspended"
        });
        return;
      }
      const accessToken = generateAccessToken(user.id, user.email);
      const refreshToken = generateRefreshToken();
      await storage2.createRefreshToken({
        userId: user.id,
        token: refreshToken,
        expiresAt: getRefreshTokenExpiry2(),
        deviceInfo: req.headers["user-agent"] || null,
        ipAddress: req.ip || req.socket.remoteAddress || null
      });
      const { hashedPassword: _, passwordCreatedAt: __, ...userResponse } = user;
      res.status(200).json({
        user: userResponse,
        accessToken,
        refreshToken
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });
  router2.post("/refresh", async (req, res) => {
    try {
      const result = refreshSchema2.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: "Validation failed",
          details: result.error.format()
        });
        return;
      }
      const { refreshToken: token } = result.data;
      const storedToken = await storage2.getRefreshToken(token);
      if (!storedToken) {
        res.status(401).json({ error: "Invalid refresh token" });
        return;
      }
      if (/* @__PURE__ */ new Date() > storedToken.expiresAt) {
        await storage2.deleteRefreshToken(token);
        res.status(401).json({ error: "Refresh token expired" });
        return;
      }
      const user = await storage2.getUser(storedToken.userId);
      if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
      }
      if (user.isSuspended) {
        res.status(403).json({
          error: "Account suspended",
          reason: user.suspensionReason || "Your account has been suspended"
        });
        return;
      }
      await storage2.deleteRefreshToken(token);
      const newAccessToken = generateAccessToken(user.id, user.email);
      const newRefreshToken = generateRefreshToken();
      await storage2.createRefreshToken({
        userId: user.id,
        token: newRefreshToken,
        expiresAt: getRefreshTokenExpiry2(),
        deviceInfo: req.headers["user-agent"] || null,
        ipAddress: req.ip || req.socket.remoteAddress || null
      });
      res.status(200).json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      });
    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(500).json({ error: "Failed to refresh token" });
    }
  });
  router2.get("/verify-email", async (req, res) => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== "string") {
        res.status(400).json({ error: "Verification token is required" });
        return;
      }
      const user = await storage2.getUserByVerificationToken(token);
      if (!user) {
        res.status(404).json({ error: "Invalid verification token" });
        return;
      }
      if (user.emailVerificationExpires && /* @__PURE__ */ new Date() > user.emailVerificationExpires) {
        res.status(400).json({ error: "Verification token has expired" });
        return;
      }
      await storage2.updateUser(user.id, {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null
      });
      res.status(200).json({ message: "Email verified successfully!" });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ error: "Failed to verify email" });
    }
  });
  router2.post("/logout", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (refreshToken) {
        await storage2.deleteRefreshToken(refreshToken);
      }
      res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Failed to logout" });
    }
  });
  router2.get("/me", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "No token provided" });
        return;
      }
      const token = authHeader.substring(7);
      const payload = verifyAccessToken(token);
      if (!payload) {
        res.status(401).json({ error: "Invalid token" });
        return;
      }
      const user = await storage2.getUser(payload.userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      if (user.isSuspended) {
        res.status(403).json({
          error: "Account suspended",
          reason: user.suspensionReason || "Your account has been suspended"
        });
        return;
      }
      const { hashedPassword: _, passwordCreatedAt: __, ...userResponse } = user;
      res.status(200).json(userResponse);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });
  router2.get("/mobile-oauth-callback", async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      const exchangeToken = crypto2.randomBytes(32).toString("hex");
      const expiresAt = /* @__PURE__ */ new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);
      await storage2.createOAuthExchangeToken({
        token: exchangeToken,
        userId,
        expiresAt
      });
      res.redirect(`readysetfly://oauth-callback?token=${exchangeToken}`);
    } catch (error) {
      console.error("Mobile OAuth callback error:", error);
      res.status(500).json({ error: "Failed to process OAuth callback" });
    }
  });
  router2.post("/exchange-oauth-token", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(400).json({ error: "Exchange token is required" });
        return;
      }
      const exchangeData = await storage2.verifyOAuthExchangeToken(token);
      if (!exchangeData) {
        res.status(401).json({ error: "Invalid or expired exchange token" });
        return;
      }
      const user = await storage2.getUser(exchangeData.userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const accessToken = generateAccessToken(user.id, user.email);
      const refreshToken = generateRefreshToken();
      await storage2.createRefreshToken({
        userId: user.id,
        token: hashRefreshToken(refreshToken),
        expiresAt: getRefreshTokenExpiry2(),
        deviceInfo: req.headers["user-agent"] || null,
        ipAddress: req.ip || req.socket.remoteAddress || null
      });
      await storage2.deleteOAuthExchangeToken(token);
      const { hashedPassword: _, passwordCreatedAt: __, emailVerificationToken: ___, ...userResponse } = user;
      res.status(200).json({
        accessToken,
        refreshToken,
        user: userResponse
      });
    } catch (error) {
      console.error("Token exchange error:", error);
      res.status(500).json({ error: "Failed to exchange token" });
    }
  });
  return router2;
}

// server/objectStorage.ts
import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";

// server/objectAcl.ts
var ACL_POLICY_METADATA_KEY = "custom:aclPolicy";
async function setObjectAclPolicy(objectFile, aclPolicy) {
  const [exists] = await objectFile.exists();
  if (!exists) {
    throw new Error(`Object not found: ${objectFile.name}`);
  }
  await objectFile.setMetadata({
    metadata: {
      [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy)
    }
  });
}
async function getObjectAclPolicy(objectFile) {
  const [metadata] = await objectFile.getMetadata();
  const aclPolicy = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
  if (!aclPolicy) {
    return null;
  }
  return JSON.parse(aclPolicy);
}
async function canAccessObject({
  userId,
  objectFile,
  requestedPermission
}) {
  const aclPolicy = await getObjectAclPolicy(objectFile);
  if (!aclPolicy) {
    return false;
  }
  if (aclPolicy.visibility === "public" && requestedPermission === "read" /* READ */) {
    return true;
  }
  if (!userId) {
    return false;
  }
  if (aclPolicy.owner === userId) {
    return true;
  }
  return false;
}

// server/objectStorage.ts
var REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
var objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token"
      }
    },
    universe_domain: "googleapis.com"
  },
  projectId: ""
});
var ObjectNotFoundError = class _ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, _ObjectNotFoundError.prototype);
  }
};
var ObjectStorageService = class {
  constructor() {
  }
  // Gets the public object search paths.
  getPublicObjectSearchPaths() {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr.split(",").map((path3) => path3.trim()).filter((path3) => path3.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }
  // Gets the private object directory.
  getPrivateObjectDir() {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }
  // Search for a public object from the search paths.
  async searchPublicObject(filePath) {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }
    return null;
  }
  // Downloads an object to the response.
  async downloadObject(file, res, cacheTtlSec = 3600) {
    try {
      const [metadata] = await file.getMetadata();
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`
      });
      const stream = file.createReadStream();
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }
  // Gets the upload URL for an object entity.
  async getObjectEntityUploadURL() {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900
    });
  }
  // Gets the object entity file from the object path.
  async getObjectEntityFile(objectPath) {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }
    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }
  normalizeObjectEntityPath(rawPath) {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }
    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }
  // Tries to set the ACL policy for the object entity and return the normalized path.
  async trySetObjectEntityAclPolicy(rawPath, aclPolicy) {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }
    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }
  // Checks if the user can access the object entity.
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission
  }) {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? "read" /* READ */
    });
  }
};
function parseObjectPath(path3) {
  if (!path3.startsWith("/")) {
    path3 = `/${path3}`;
  }
  const pathParts = path3.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }
  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");
  return {
    bucketName,
    objectName
  };
}
async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec
}) {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1e3).toISOString()
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, make sure you're running on Replit`
    );
  }
  const { signed_url: signedURL } = await response.json();
  return signedURL;
}

// shared/config/listingPricing.ts
var TAX_RATE = 0.0825;
var CATEGORY_PRICING = {
  "aircraft-sale": {
    basic: 25,
    standard: 40,
    premium: 100
  },
  "charter": 250,
  "cfi": 30,
  "flight-school": 250,
  "mechanic": 40,
  "job": 40,
  // Backward compatibility - legacy key
  "jobs": 40
  // New key for consistency
};
var VALID_TIERS = ["basic", "standard", "premium"];
function getBasePrice(category, tier) {
  const categoryPricing = CATEGORY_PRICING[category];
  if (typeof categoryPricing === "object" && tier) {
    return categoryPricing[tier] || categoryPricing.basic || 25;
  } else if (typeof categoryPricing === "number") {
    return categoryPricing;
  }
  return 25;
}
function getUpgradeDelta(category, currentTier, newTier) {
  const currentPrice = getBasePrice(category, currentTier);
  const newPrice = getBasePrice(category, newTier);
  return newPrice - currentPrice;
}
function calculateTotalWithTax(baseAmount) {
  return baseAmount + baseAmount * TAX_RATE;
}
function getTierIndex(tier) {
  return VALID_TIERS.indexOf(tier);
}
function isValidUpgrade(currentTier, newTier) {
  const currentIndex = getTierIndex(currentTier);
  const newIndex = getTierIndex(newTier);
  return currentIndex !== -1 && newIndex !== -1 && newIndex > currentIndex;
}

// server/routes.ts
var openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
var configuredBaseUrl = (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || "").trim();
var openaiBaseUrl = configuredBaseUrl && configuredBaseUrl.startsWith("http") ? configuredBaseUrl : void 0;
if (configuredBaseUrl && !openaiBaseUrl) {
  console.warn("OpenAI base URL ignored because it is not a valid http(s) URL", configuredBaseUrl);
}
var openai = new OpenAI({
  apiKey: openaiApiKey,
  ...openaiBaseUrl ? { baseURL: openaiBaseUrl } : {}
});
if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
  throw new Error("Missing required PayPal secrets: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET");
}
var paypalClient = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: process.env.PAYPAL_CLIENT_ID,
    oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET
  },
  timeout: 0,
  environment: process.env.NODE_ENV === "production" ? Environment.Production : Environment.Sandbox,
  logging: {
    logLevel: LogLevel.Info,
    logRequest: { logBody: true },
    logResponse: { logHeaders: true }
  }
});
var ordersController = new OrdersController(paypalClient);
var storage_config = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname.includes("image") || file.mimetype.startsWith("image/")) {
      cb(null, "uploads/marketplace/");
    } else {
      cb(null, "uploads/documents/");
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = file.originalname.split(".").pop();
    cb(null, `${file.fieldname}-${uniqueSuffix}.${ext}`);
  }
});
var upload = multer({
  storage: storage_config,
  limits: { fileSize: 10 * 1024 * 1024 },
  // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/",
      "application/pdf",
      "application/msword",
      // .doc
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      // .docx
    ];
    const isAllowed = allowedTypes.some((type) => file.mimetype.startsWith(type) || file.mimetype === type);
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error("Only image, PDF, and Word document files are allowed"));
    }
  }
});
function createIpRateLimiter(options) {
  const { windowMs, max, dailyMax, message = "Too many requests, please try again later" } = options;
  const requests = /* @__PURE__ */ new Map();
  setInterval(() => {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1e3;
    for (const [ip, timestamps] of Array.from(requests.entries())) {
      const recentTimestamps = timestamps.filter((t) => now - t < dayInMs);
      if (recentTimestamps.length === 0) {
        requests.delete(ip);
      } else {
        requests.set(ip, recentTimestamps);
      }
    }
  }, 5 * 60 * 1e3);
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1e3;
    if (!requests.has(ip)) {
      requests.set(ip, []);
    }
    const timestamps = requests.get(ip);
    const dailyTimestamps = timestamps.filter((t) => now - t < dayInMs);
    if (dailyMax && dailyTimestamps.length >= dailyMax) {
      const oldestDailyTimestamp = Math.min(...dailyTimestamps);
      const retryAfter = Math.ceil((dayInMs - (now - oldestDailyTimestamp)) / 1e3);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: "Daily request limit exceeded",
        retryAfter
      });
    }
    const recentTimestamps = dailyTimestamps.filter((t) => now - t < windowMs);
    if (recentTimestamps.length >= max) {
      const oldestTimestamp = Math.min(...recentTimestamps);
      const retryAfter = Math.ceil((windowMs - (now - oldestTimestamp)) / 1e3);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: message,
        retryAfter
      });
    }
    dailyTimestamps.push(now);
    requests.set(ip, dailyTimestamps);
    next();
  };
}
var contactFormRateLimiter = createIpRateLimiter({
  windowMs: 10 * 60 * 1e3,
  // 10 minutes
  max: 5,
  dailyMax: 20,
  message: "Too many contact form submissions. Please try again later."
});
var isVerified = async (req, res, next) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!user.isVerified) {
      return res.status(403).json({
        error: "Account verification required",
        message: "Aircraft rentals require verified users for safety and security. Please complete account verification."
      });
    }
    next();
  } catch (error) {
    console.error("Error checking verification:", error);
    res.status(500).json({ error: "Verification check failed" });
  }
};
async function registerRoutes(app2) {
  app2.use(cors({
    origin: process.env.WEB_ORIGIN ? process.env.WEB_ORIGIN.split(",") : [
      "https://readysetfly.us",
      "https://www.readysetfly.us",
      "http://localhost:5173",
      "http://localhost:4173"
    ],
    credentials: true
  }));
  await setupAuth(app2);
  app2.use("/api/auth", registerUnifiedAuthRoutes(storage));
  app2.use("/api/mobile/auth", mobile_auth_routes_default(storage));
  app2.use("/uploads", express.static("uploads"));
  app2.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });
  app2.put("/api/listing-images", isAuthenticated, async (req, res) => {
    try {
      if (!req.body.imageURL) {
        return res.status(400).json({ error: "imageURL is required" });
      }
      const userId = req.user.claims.sub;
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.imageURL,
        {
          owner: userId,
          visibility: "public"
          // Listing images are public
        }
      );
      res.status(200).json({ objectPath });
    } catch (error) {
      console.error("Error setting listing image ACL:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId,
        requestedPermission: "read" /* READ */
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });
  app2.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const sessionUserId = req.user.claims.sub;
      console.log("[AUTH /api/auth/user] Looking up user with session ID:", sessionUserId);
      let user = await storage.getUser(sessionUserId);
      if (!user) {
        console.log("[AUTH /api/auth/user] User not found by ID, trying email lookup");
        const email2 = req.user.claims.email;
        if (email2) {
          user = await storage.getUserByEmail(email2);
          console.log("[AUTH /api/auth/user] Email lookup result:", user ? `Found user ${user.id}` : "Not found");
        }
        if (!user) {
          console.log("[AUTH /api/auth/user] User not found by ID or email");
          return res.status(404).json({ message: "User not found" });
        }
      }
      const email = user.email?.toLowerCase();
      const shouldBeSuperAdmin = email?.endsWith("@readysetfly.us") || email === "coryarmer@gmail.com";
      if (shouldBeSuperAdmin && !user.isSuperAdmin) {
        console.log("[AUTH /api/auth/user] Granting super admin to user:", user.id);
        await storage.updateUser(user.id, { isSuperAdmin: true, isAdmin: true, isVerified: true });
        user = await storage.getUser(user.id);
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  app2.delete("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log("[DELETE /api/auth/user] Deleting user account:", userId);
      const success = await storage.deleteUser(userId);
      if (success) {
        req.logout((err) => {
          if (err) {
            console.error("Error logging out after account deletion:", err);
          }
        });
        res.json({ message: "Account deleted successfully" });
      } else {
        res.status(500).json({ error: "Failed to delete account" });
      }
    } catch (error) {
      console.error("Error deleting user account:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });
  app2.post("/api/upload-images", isAuthenticated, upload.array("images", 15), async (req, res) => {
    try {
      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }
      const imageUrls = files.map((file) => `/uploads/marketplace/${file.filename}`);
      res.json({ imageUrls });
    } catch (error) {
      console.error("Image upload error:", error);
      res.status(500).json({ error: error.message || "Image upload failed" });
    }
  });
  app2.post("/api/upload-documents", isAuthenticated, upload.array("documents", 5), async (req, res) => {
    try {
      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }
      const documentUrls = files.map((file) => `/uploads/documents/${file.filename}`);
      res.json({ documentUrls });
    } catch (error) {
      console.error("Document upload error:", error);
      res.status(500).json({ error: error.message || "Document upload failed" });
    }
  });
  app2.get("/api/paypal/config", async (req, res) => {
    res.json({
      clientId: process.env.PAYPAL_CLIENT_ID,
      environment: process.env.NODE_ENV === "production" ? "production" : "sandbox"
    });
  });
  app2.post("/api/paypal/create-order-listing", isAuthenticated, async (req, res) => {
    try {
      const { category, tier, promoCode, discountAmount, finalAmount } = req.body;
      const userId = req.user.claims.sub;
      if (!category) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const CATEGORY_PRICING2 = {
        "aircraft-sale": {
          basic: 25,
          standard: 40,
          premium: 100
        },
        "charter": 250,
        "cfi": 30,
        "flight-school": 250,
        "mechanic": 40,
        "jobs": 40
      };
      let baseAmount;
      const categoryPricing = CATEGORY_PRICING2[category];
      if (typeof categoryPricing === "object" && tier) {
        baseAmount = categoryPricing[tier] || categoryPricing.basic || 25;
      } else if (typeof categoryPricing === "number") {
        baseAmount = categoryPricing;
      } else {
        baseAmount = 25;
      }
      const salesTax = baseAmount * 0.0825;
      const fullAmount = baseAmount + salesTax;
      let amount = fullAmount;
      if (promoCode && finalAmount !== void 0) {
        const parsedFinal = parseFloat(finalAmount);
        if (!Number.isFinite(parsedFinal) || parsedFinal < 0) {
          console.error(`Invalid final amount: ${finalAmount}`);
          return res.status(400).json({ error: "Invalid final amount" });
        }
        const validatedPromo = await storage.validatePromoCodeForContext(promoCode, "marketplace");
        if (!validatedPromo) {
          return res.status(400).json({ error: "Invalid or expired promo code" });
        }
        let serverCalculatedDiscount = 0;
        if (validatedPromo.discountType === "percentage") {
          const discountPercent = parseFloat(validatedPromo.discountValue || "0");
          serverCalculatedDiscount = fullAmount * discountPercent / 100;
        } else if (validatedPromo.discountType === "fixed") {
          serverCalculatedDiscount = parseFloat(validatedPromo.discountValue || "0");
        }
        serverCalculatedDiscount = Math.min(serverCalculatedDiscount, fullAmount);
        const expectedFinal = Math.max(0, fullAmount - serverCalculatedDiscount);
        const expectedFinalCents = Math.round(expectedFinal * 100);
        const providedFinalCents = Math.round(parsedFinal * 100);
        if (expectedFinalCents !== providedFinalCents) {
          console.error(`Amount mismatch: expected ${expectedFinal.toFixed(2)} ($${expectedFinalCents}\xA2), got ${parsedFinal.toFixed(2)} ($${providedFinalCents}\xA2)`);
          return res.status(400).json({ error: "Amount verification failed - promo discount mismatch" });
        }
        amount = expectedFinal;
      }
      amount = Math.round(amount * 100) / 100;
      if (amount <= 0) {
        return res.status(400).json({ error: "Use free completion endpoint for $0 orders" });
      }
      const collect = {
        body: {
          intent: "CAPTURE",
          purchaseUnits: [
            {
              amount: {
                currencyCode: "USD",
                value: amount.toFixed(2)
              },
              description: `Ready Set Fly - ${category} listing fee (${tier || "basic"} tier)`,
              customId: `user:${userId}|category:${category}|tier:${tier || "basic"}|purpose:marketplace_listing_fee`
            }
          ]
        },
        prefer: "return=minimal"
      };
      const { body, ...httpResponse } = await ordersController.createOrder(collect);
      const jsonResponse = JSON.parse(String(body));
      res.status(httpResponse.statusCode).json(jsonResponse);
    } catch (error) {
      console.error("PayPal create order error:", error);
      res.status(500).json({ error: error.message || "Failed to create order" });
    }
  });
  app2.post("/api/paypal/create-order-upgrade", isAuthenticated, async (req, res) => {
    try {
      const { listingId, newTier } = req.body;
      const userId = req.user.claims.sub;
      if (!listingId || !newTier) {
        return res.status(400).json({ error: "Missing required fields: listingId and newTier" });
      }
      if (!VALID_TIERS.includes(newTier)) {
        return res.status(400).json({ error: "Invalid tier" });
      }
      const listing = await storage.getMarketplaceListing(listingId);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if (listing.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to upgrade this listing" });
      }
      if (!isValidUpgrade(listing.tier || "basic", newTier)) {
        return res.status(400).json({ error: "Invalid upgrade - must upgrade to a higher tier" });
      }
      const upgradeDelta = getUpgradeDelta(listing.category, listing.tier || "basic", newTier);
      const totalWithTax = calculateTotalWithTax(upgradeDelta);
      if (totalWithTax <= 0) {
        return res.status(400).json({ error: "Upgrade amount must be greater than $0" });
      }
      const amount = Math.round(totalWithTax * 100) / 100;
      console.log(`Creating upgrade order for listing ${listingId}: ${listing.tier} \u2192 ${newTier}, amount: $${amount}`);
      const collect = {
        body: {
          intent: "CAPTURE",
          purchaseUnits: [
            {
              amount: {
                currencyCode: "USD",
                value: amount.toFixed(2)
              },
              description: `Ready Set Fly - Listing Upgrade (${listing.tier} \u2192 ${newTier})`,
              customId: `upgrade:${listingId}|user:${userId}|tier:${newTier}`
            }
          ]
        },
        prefer: "return=minimal"
      };
      const { body, ...httpResponse } = await ordersController.createOrder(collect);
      const jsonResponse = JSON.parse(String(body));
      res.status(httpResponse.statusCode).json(jsonResponse);
    } catch (error) {
      console.error("PayPal create upgrade order error:", error);
      res.status(500).json({ error: error.message || "Failed to create upgrade order" });
    }
  });
  app2.post("/api/paypal/create-order-rental", isAuthenticated, isVerified, async (req, res) => {
    try {
      const { amount, rentalId } = req.body;
      const userId = req.user.claims.sub;
      if (!amount || !rentalId) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const collect = {
        body: {
          intent: "CAPTURE",
          purchaseUnits: [
            {
              amount: {
                currencyCode: "USD",
                value: parseFloat(amount).toFixed(2)
              },
              description: `Ready Set Fly - Aircraft rental payment`,
              customId: `rental:${rentalId}|user:${userId}`
            }
          ]
        },
        prefer: "return=minimal"
      };
      const { body, ...httpResponse } = await ordersController.createOrder(collect);
      const jsonResponse = JSON.parse(String(body));
      res.status(httpResponse.statusCode).json(jsonResponse);
    } catch (error) {
      console.error("PayPal create rental order error:", error);
      res.status(500).json({ error: error.message || "Failed to create order" });
    }
  });
  app2.post("/api/paypal/create-order-banner-ad", async (req, res) => {
    try {
      const { orderId, promoCode } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: "Missing order ID" });
      }
      const order = await storage.getBannerAdOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      const originalAmount = parseFloat(order.grandTotal);
      let discountAmount = parseFloat(order.discountAmount || "0");
      let appliedPromoCode = order.promoCode || null;
      if (promoCode && !order.promoCode) {
        const validPromo = await storage.validatePromoCodeForContext(promoCode, "banner-ad");
        if (validPromo) {
          appliedPromoCode = validPromo.code;
          if (validPromo.discountType === "percentage") {
            discountAmount = originalAmount * (parseFloat(validPromo.discountValue || "0") / 100);
          } else if (validPromo.discountType === "fixed") {
            discountAmount = parseFloat(validPromo.discountValue || "0");
          }
          await storage.updateBannerAdOrder(orderId, {
            promoCode: validPromo.code,
            discountAmount: discountAmount.toFixed(2)
          });
          console.log(`Promo code ${promoCode} applied to order ${orderId}: -$${discountAmount.toFixed(2)}`);
        }
      }
      const finalAmount = Math.max(0, originalAmount - discountAmount);
      if (finalAmount <= 0) {
        const completionToken = jwt2.sign(
          {
            orderId,
            sponsorEmail: order.sponsorEmail,
            type: "free-order-completion"
          },
          process.env.SESSION_SECRET || "dev-secret",
          { expiresIn: "15m" }
          // Token expires in 15 minutes
        );
        console.log(`\u2705 Generated free completion token for banner ad order ${orderId} (100% discount applied)`);
        return res.json({
          useFreeCompletion: true,
          completionToken,
          orderId,
          message: "This order qualifies for free completion - no payment required"
        });
      }
      console.log(`Creating PayPal order for ${orderId}: original=$${originalAmount.toFixed(2)}, discount=$${discountAmount.toFixed(2)}, final=$${finalAmount.toFixed(2)}`);
      const collect = {
        body: {
          intent: "CAPTURE",
          purchaseUnits: [
            {
              amount: {
                currencyCode: "USD",
                value: finalAmount.toFixed(2)
              },
              description: `Ready Set Fly - Banner Ad: ${order.title}`,
              customId: `banner-ad:${orderId}|sponsor:${order.sponsorEmail}${appliedPromoCode ? `|promo:${appliedPromoCode}` : ""}`
            }
          ]
        },
        prefer: "return=minimal"
      };
      const { body, ...httpResponse } = await ordersController.createOrder(collect);
      const jsonResponse = JSON.parse(String(body));
      res.status(httpResponse.statusCode).json(jsonResponse);
    } catch (error) {
      console.error("PayPal create banner ad order error:", error);
      res.status(500).json({ error: error.message || "Failed to create order" });
    }
  });
  app2.post("/api/paypal/capture-order/:orderID", isAuthenticated, async (req, res) => {
    try {
      const { orderID } = req.params;
      const collect = {
        id: orderID,
        prefer: "return=minimal"
      };
      const { body, ...httpResponse } = await ordersController.captureOrder(collect);
      const jsonResponse = JSON.parse(String(body));
      res.status(httpResponse.statusCode).json(jsonResponse);
    } catch (error) {
      console.error("PayPal capture order error:", error);
      res.status(500).json({ error: error.message || "Failed to capture order" });
    }
  });
  app2.post("/api/paypal/capture-banner-ad/:orderID/:bannerAdOrderId", async (req, res) => {
    try {
      const { orderID, bannerAdOrderId } = req.params;
      const collect = {
        id: orderID,
        prefer: "return=minimal"
      };
      const { body, ...httpResponse } = await ordersController.captureOrder(collect);
      const jsonResponse = JSON.parse(String(body));
      if (jsonResponse.status === "COMPLETED") {
        const customId = jsonResponse.purchase_units?.[0]?.custom_id || "";
        const orderIdMatch = customId.match(/banner-ad:([^|]+)/);
        const capturedOrderId = orderIdMatch ? orderIdMatch[1] : null;
        if (!capturedOrderId || capturedOrderId !== bannerAdOrderId) {
          console.error(`\u274C Payment fraud attempt: PayPal order ${orderID} customId mismatch. Expected ${bannerAdOrderId}, got ${capturedOrderId}`);
          return res.status(400).json({
            error: "Payment validation failed",
            details: "Order ID mismatch - payment cannot be applied to this order"
          });
        }
        const promoMatch = customId.match(/promo:([^|]+)/);
        const promoCode = promoMatch ? promoMatch[1] : null;
        const order = await storage.getBannerAdOrder(bannerAdOrderId);
        if (!order) {
          console.error(`\u274C Banner ad order ${bannerAdOrderId} not found during payment capture`);
          return res.status(404).json({ error: "Order not found" });
        }
        if (order.paymentStatus === "paid") {
          console.warn(`\u26A0\uFE0F Banner ad order ${bannerAdOrderId} already marked as paid`);
          return res.status(400).json({ error: "Order already paid" });
        }
        if (promoCode) {
          try {
            const promoCodeRecord = await storage.getPromoCodeByCode(promoCode);
            if (promoCodeRecord) {
              await storage.recordPromoCodeUsage({
                promoCodeId: promoCodeRecord.id,
                bannerAdOrderId
              });
              console.log(`\u2705 Promo code ${promoCode} usage recorded for banner ad order ${bannerAdOrderId}`);
            }
          } catch (error) {
            console.error(`\u26A0\uFE0F Failed to record promo code usage for ${promoCode}:`, error);
          }
        }
        await storage.updateBannerAdOrder(bannerAdOrderId, {
          paymentStatus: "paid",
          paypalOrderId: orderID,
          paypalPaymentDate: /* @__PURE__ */ new Date()
        });
        console.log(`\u2705 Banner ad order ${bannerAdOrderId} payment captured: ${orderID}`);
      }
      res.status(httpResponse.statusCode).json(jsonResponse);
    } catch (error) {
      console.error("PayPal capture banner ad order error:", error);
      res.status(500).json({ error: error.message || "Failed to capture order" });
    }
  });
  app2.post("/api/banner-ad/complete-free-order/:bannerAdOrderId", async (req, res) => {
    try {
      const { bannerAdOrderId } = req.params;
      const { completionToken } = req.body;
      if (!completionToken || typeof completionToken !== "string") {
        console.error(`\u274C Missing completion token for order ${bannerAdOrderId}`);
        return res.status(400).json({ error: "Security token is required" });
      }
      let tokenData;
      try {
        tokenData = jwt2.verify(completionToken, process.env.SESSION_SECRET || "dev-secret");
      } catch (error) {
        console.error(`\u274C Invalid or expired token for order ${bannerAdOrderId}:`, error.message);
        return res.status(403).json({ error: "Invalid or expired security token" });
      }
      if (tokenData.orderId !== bannerAdOrderId) {
        console.error(`\u274C Token/order ID mismatch for ${bannerAdOrderId}. Token says: ${tokenData.orderId}`);
        return res.status(403).json({ error: "Invalid security token" });
      }
      if (tokenData.type !== "free-order-completion") {
        console.error(`\u274C Wrong token type for order ${bannerAdOrderId}: ${tokenData.type}`);
        return res.status(403).json({ error: "Invalid security token" });
      }
      const order = await storage.getBannerAdOrder(bannerAdOrderId);
      if (!order) {
        console.error(`\u274C Banner ad order ${bannerAdOrderId} not found`);
        return res.status(404).json({ error: "Order not found" });
      }
      if (order.sponsorEmail.toLowerCase() !== tokenData.sponsorEmail.toLowerCase()) {
        console.error(`\u274C Token email mismatch for order ${bannerAdOrderId}. Expected ${order.sponsorEmail}, token says ${tokenData.sponsorEmail}`);
        return res.status(403).json({ error: "Invalid security token" });
      }
      if (order.paymentStatus === "paid") {
        console.warn(`\u26A0\uFE0F Banner ad order ${bannerAdOrderId} already marked as paid`);
        return res.status(400).json({ error: "Order already paid" });
      }
      const originalAmount = parseFloat(order.grandTotal);
      const discountAmount = parseFloat(order.discountAmount || "0");
      const finalAmount = Math.max(0, originalAmount - discountAmount);
      if (finalAmount > 0) {
        console.error(`\u274C Free order validation failed for ${bannerAdOrderId}: final amount is $${finalAmount.toFixed(2)}, not $0.00`);
        return res.status(400).json({
          error: "This is not a free order",
          details: `Order total is $${finalAmount.toFixed(2)}. Payment is required.`
        });
      }
      if (order.promoCode) {
        const validPromo = await storage.validatePromoCodeForContext(order.promoCode, "banner-ad");
        if (!validPromo) {
          console.error(`\u274C Promo code ${order.promoCode} is no longer valid for order ${bannerAdOrderId}`);
          return res.status(400).json({
            error: "Promo code is no longer valid",
            details: "Please refresh the page and try again"
          });
        }
        try {
          const promoCodeRecord = await storage.getPromoCodeByCode(order.promoCode);
          if (promoCodeRecord) {
            await storage.recordPromoCodeUsage({
              promoCodeId: promoCodeRecord.id,
              bannerAdOrderId
            });
            console.log(`\u2705 Promo code ${order.promoCode} usage recorded for FREE banner ad order ${bannerAdOrderId}`);
          }
        } catch (error) {
          console.error(`\u26A0\uFE0F Failed to record promo code usage for ${order.promoCode}:`, error);
        }
      }
      await storage.updateBannerAdOrder(bannerAdOrderId, {
        paymentStatus: "paid",
        approvalStatus: "pending_review",
        paypalOrderId: "FREE-" + bannerAdOrderId,
        // Mark as free order
        paypalPaymentDate: /* @__PURE__ */ new Date()
      });
      console.log(`\u2705 FREE banner ad order ${bannerAdOrderId} completed with promo code ${order.promoCode} by ${order.sponsorEmail}`);
      res.json({
        status: "COMPLETED",
        message: "Free order completed successfully",
        orderId: bannerAdOrderId
      });
    } catch (error) {
      console.error("Free banner ad order completion error:", error);
      res.status(500).json({ error: error.message || "Failed to complete free order" });
    }
  });
  app2.post("/api/marketplace/complete-free-listing", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const { completionToken, listingData } = req.body;
      if (!completionToken || typeof completionToken !== "string") {
        console.error(`\u274C Missing completion token for free marketplace listing`);
        return res.status(400).json({ error: "Security token is required" });
      }
      let tokenData;
      try {
        tokenData = jwt2.verify(completionToken, process.env.SESSION_SECRET || "dev-secret");
      } catch (error) {
        console.error(`\u274C Invalid or expired token for free marketplace listing:`, error.message);
        return res.status(403).json({ error: "Invalid or expired security token" });
      }
      if (tokenData.userId !== userId) {
        console.error(`\u274C Token user ID mismatch. Expected ${userId}, token says ${tokenData.userId}`);
        return res.status(403).json({ error: "Invalid security token" });
      }
      const originalAmount = parseFloat(tokenData.originalAmount);
      const discountAmount = parseFloat(tokenData.discountAmount);
      const finalAmount = Math.max(0, originalAmount - discountAmount);
      if (finalAmount > 0) {
        console.error(`\u274C Free listing validation failed: final amount is $${finalAmount.toFixed(2)}, not $0.00`);
        return res.status(400).json({
          error: "This is not a free listing",
          details: `Listing total is $${finalAmount.toFixed(2)}. Payment is required.`
        });
      }
      if (tokenData.type === "free-marketplace-listing") {
        if (tokenData.promoCode) {
          const validPromo = await storage.validatePromoCodeForContext(tokenData.promoCode, "marketplace");
          if (!validPromo) {
            console.error(`\u274C Promo code ${tokenData.promoCode} is no longer valid for marketplace listing`);
            return res.status(400).json({
              error: "Promo code is no longer valid",
              details: "Please refresh the page and try again"
            });
          }
          const validatedData = insertMarketplaceListingSchema.parse({
            ...listingData,
            userId,
            monthlyFee: "0"
          });
          const listing = await storage.createMarketplaceListing({
            ...validatedData,
            isPaid: true,
            // Mark as paid since it's free with promo
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3)
            // 30 days
          });
          try {
            await storage.recordPromoCodeUsage({
              promoCodeId: tokenData.promoCode,
              userId,
              marketplaceListingId: listing.id
            });
            console.log(`\u2705 Promo code ${tokenData.promoCode} usage recorded for FREE marketplace listing ${listing.id}`);
          } catch (error) {
            console.error(`\u26A0\uFE0F Failed to record promo code usage for ${tokenData.promoCode}:`, error);
          }
          try {
            const categoryListings = await storage.getMarketplaceListingsByCategory(listing.category);
            const activeCount = categoryListings.filter((l) => l.isActive).length;
            if (activeCount === 25 || activeCount === 30) {
              await storage.createAdminNotification({
                type: "listing_threshold",
                category: listing.category,
                title: `${listing.category.replace("-", " ").toUpperCase()} Listings Threshold Reached`,
                message: `The ${listing.category.replace("-", " ")} category now has ${activeCount} active listings.`,
                isRead: false,
                isActionable: true,
                listingCount: activeCount,
                threshold: activeCount
              });
            }
          } catch (notifError) {
            console.error("Failed to create threshold notification:", notifError);
          }
          console.log(`\u2705 FREE marketplace listing ${listing.id} completed with promo code ${tokenData.promoCode} by user ${userId}`);
          return res.status(201).json({
            status: "COMPLETED",
            message: "Free listing created successfully",
            listing
          });
        } else {
          return res.status(400).json({ error: "No promo code provided for free listing" });
        }
      }
      if (tokenData.type === "admin-free-marketplace-listing") {
        const durationDays = Math.min(Math.max(Number(tokenData.durationDays) || 30, 1), 90);
        const validatedData = insertMarketplaceListingSchema.parse({
          ...listingData,
          userId,
          monthlyFee: "0"
        });
        const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1e3);
        const listing = await storage.createMarketplaceListing({
          ...validatedData,
          isPaid: true,
          monthlyFee: "0",
          expiresAt,
          promoFreeUntil: expiresAt,
          promoGrantedBy: tokenData.issuedBy || userId,
          promoGrantedAt: /* @__PURE__ */ new Date(),
          adminNotes: `Admin free listing grant (${durationDays}d) by ${tokenData.issuedBy || "admin"}`
        });
        console.log(`\u2705 Admin free marketplace listing ${listing.id} created for user ${userId} by ${tokenData.issuedBy || "admin"}`);
        return res.status(201).json({
          status: "COMPLETED",
          message: "Admin free listing created successfully",
          listing
        });
      }
      console.error(`\u274C Wrong token type for free marketplace listing: ${tokenData.type}`);
      return res.status(403).json({ error: "Invalid security token" });
    } catch (error) {
      console.error("Free marketplace listing completion error:", error);
      res.status(500).json({ error: error.message || "Failed to complete free listing" });
    }
  });
  app2.get("/mobile-paypal-rental-payment", (req, res) => {
    const { amount, rentalId } = req.query;
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #f9fafb; }
    .container { max-width: 500px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 24px; color: #111827; margin-bottom: 8px; }
    .header p { color: #6b7280; font-size: 14px; }
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 16px; }
    .amount { text-align: center; font-size: 36px; font-weight: bold; color: #1e40af; margin-bottom: 24px; }
    .field { margin-bottom: 16px; }
    .field label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #374151; }
    .field-container { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; min-height: 44px; background: #fff; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .btn { width: 100%; padding: 14px; background: #1e40af; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
    .btn:disabled { background: #9ca3af; cursor: not-allowed; }
    .loading { text-align: center; color: #6b7280; padding: 20px; }
    .error { color: #dc2626; background: #fee2e2; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
  </style>
  <script src="https://www.paypal.com/sdk/js?client-id=${process.env.PAYPAL_CLIENT_ID}&components=card-fields&disable-funding=paylater"></script>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Complete Payment</h1>
      <p>Secure payment powered by PayPal</p>
    </div>
    
    <div class="card">
      <div class="amount">$${amount}</div>
      
      <div id="error-message"></div>
      
      <div class="field">
        <label>Cardholder Name</label>
        <div id="card-name-field" class="field-container"></div>
      </div>
      
      <div class="field">
        <label>Card Number</label>
        <div id="card-number-field" class="field-container"></div>
      </div>
      
      <div class="field-row">
        <div class="field">
          <label>Expiry Date</label>
          <div id="card-expiry-field" class="field-container"></div>
        </div>
        <div class="field">
          <label>CVV</label>
          <div id="card-cvv-field" class="field-container"></div>
        </div>
      </div>
      
      <button id="pay-button" class="btn" disabled>Loading...</button>
    </div>
  </div>

  <script>
    const button = document.getElementById('pay-button');
    const errorDiv = document.getElementById('error-message');
    
    const cardFields = paypal.CardFields({
      createOrder: async () => {
        const response = await fetch('/api/paypal/create-order-rental', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            amount: '${amount}',
            rentalId: '${rentalId}'
          })
        });
        const order = await response.json();
        return order.id;
      },
      onApprove: async (data) => {
        button.disabled = true;
        button.textContent = 'Processing...';
        
        try {
          const response = await fetch('/api/paypal/capture-order/' + data.orderID, {
            method: 'POST',
            credentials: 'include'
          });
          const result = await response.json();
          
          if (result.status === 'COMPLETED') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PAYMENT_SUCCESS',
              orderID: data.orderID
            }));
          } else {
            throw new Error('Payment not completed');
          }
        } catch (error) {
          errorDiv.innerHTML = '<div class="error">Payment failed. Please try again.</div>';
          button.disabled = false;
          button.textContent = 'Pay $${amount}';
        }
      },
      onError: (error) => {
        console.error('PayPal error:', error);
        errorDiv.innerHTML = '<div class="error">Payment error. Please check your card details.</div>';
      }
    });

    if (cardFields.isEligible()) {
      cardFields.NameField().render('#card-name-field');
      cardFields.NumberField().render('#card-number-field');
      cardFields.ExpiryField().render('#card-expiry-field');
      cardFields.CVVField().render('#card-cvv-field');
      
      button.disabled = false;
      button.textContent = 'Pay $${amount}';
      
      button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = 'Processing...';
        await cardFields.submit();
      });
    } else {
      errorDiv.innerHTML = '<div class="error">Card payments are not available.</div>';
    }
  </script>
</body>
</html>
    `);
  });
  app2.get("/mobile-paypal-marketplace-payment", (req, res) => {
    const { amount, category, tier } = req.query;
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #f9fafb; }
    .container { max-width: 500px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 24px; color: #111827; margin-bottom: 8px; }
    .header p { color: #6b7280; font-size: 14px; }
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 16px; }
    .amount { text-align: center; font-size: 36px; font-weight: bold; color: #1e40af; margin-bottom: 24px; }
    .field { margin-bottom: 16px; }
    .field label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #374151; }
    .field-container { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; min-height: 44px; background: #fff; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .btn { width: 100%; padding: 14px; background: #1e40af; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
    .btn:disabled { background: #9ca3af; cursor: not-allowed; }
    .loading { text-align: center; color: #6b7280; padding: 20px; }
    .error { color: #dc2626; background: #fee2e2; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
  </style>
  <script src="https://www.paypal.com/sdk/js?client-id=${process.env.PAYPAL_CLIENT_ID}&components=card-fields&disable-funding=paylater"></script>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Complete Payment</h1>
      <p>Secure payment powered by PayPal</p>
    </div>
    
    <div class="card">
      <div class="amount">$${amount}</div>
      
      <div id="error-message"></div>
      
      <div class="field">
        <label>Cardholder Name</label>
        <div id="card-name-field" class="field-container"></div>
      </div>
      
      <div class="field">
        <label>Card Number</label>
        <div id="card-number-field" class="field-container"></div>
      </div>
      
      <div class="field-row">
        <div class="field">
          <label>Expiry Date</label>
          <div id="card-expiry-field" class="field-container"></div>
        </div>
        <div class="field">
          <label>CVV</label>
          <div id="card-cvv-field" class="field-container"></div>
        </div>
      </div>
      
      <button id="pay-button" class="btn" disabled>Loading...</button>
    </div>
  </div>

  <script>
    const button = document.getElementById('pay-button');
    const errorDiv = document.getElementById('error-message');
    
    const cardFields = paypal.CardFields({
      createOrder: async () => {
        const response = await fetch('/api/paypal/create-order-listing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            category: '${category}',
            tier: '${tier}'
          })
        });
        const order = await response.json();
        return order.id;
      },
      onApprove: async (data) => {
        button.disabled = true;
        button.textContent = 'Processing...';
        
        try {
          const response = await fetch('/api/paypal/capture-order/' + data.orderID, {
            method: 'POST',
            credentials: 'include'
          });
          const result = await response.json();
          
          if (result.status === 'COMPLETED') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PAYMENT_SUCCESS',
              orderID: data.orderID
            }));
          } else {
            throw new Error('Payment not completed');
          }
        } catch (error) {
          errorDiv.innerHTML = '<div class="error">Payment failed. Please try again.</div>';
          button.disabled = false;
          button.textContent = 'Pay $${amount}';
        }
      },
      onError: (error) => {
        console.error('PayPal error:', error);
        errorDiv.innerHTML = '<div class="error">Payment error. Please check your card details.</div>';
      }
    });

    if (cardFields.isEligible()) {
      cardFields.NameField().render('#card-name-field');
      cardFields.NumberField().render('#card-number-field');
      cardFields.ExpiryField().render('#card-expiry-field');
      cardFields.CVVField().render('#card-cvv-field');
      
      button.disabled = false;
      button.textContent = 'Pay $${amount}';
      
      button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = 'Processing...';
        await cardFields.submit();
      });
    } else {
      errorDiv.innerHTML = '<div class="error">Card payments are not available.</div>';
    }
  </script>
</body>
</html>
    `);
  });
  app2.get("/banner-ad-payment", async (req, res) => {
    const { orderId } = req.query;
    if (!orderId) {
      return res.status(400).send("Order ID is required");
    }
    const order = await storage.getBannerAdOrder(orderId);
    if (!order) {
      return res.status(404).send("Order not found");
    }
    const amount = order.grandTotal;
    const title = order.title;
    const sponsorEmail = order.sponsorEmail;
    const originalAmount = parseFloat(order.grandTotal);
    const discountAmount = parseFloat(order.discountAmount || "0");
    const finalAmount = Math.max(0, originalAmount - discountAmount);
    const isFreeOrder = finalAmount === 0;
    let completionToken = null;
    if (isFreeOrder) {
      completionToken = jwt2.sign(
        {
          type: "free-order-completion",
          orderId,
          sponsorEmail
        },
        process.env.SESSION_SECRET || "dev-secret",
        { expiresIn: "15m" }
        // Token expires in 15 minutes
      );
      console.log(`Generated free order completion token for ${orderId}`);
    }
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Banner Ad Payment - Ready Set Fly</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #f9fafb; }
    .container { max-width: 500px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 24px; color: #111827; margin-bottom: 8px; }
    .header p { color: #6b7280; font-size: 14px; }
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 16px; }
    .order-info { background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
    .order-info h3 { font-size: 14px; color: #6b7280; margin-bottom: 6px; }
    .order-info p { font-size: 16px; color: #111827; font-weight: 500; }
    .amount { text-align: center; font-size: 36px; font-weight: bold; color: #1e40af; margin-bottom: 24px; }
    .field { margin-bottom: 16px; }
    .field label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #374151; }
    .field-container { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; min-height: 44px; background: #fff; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .btn { width: 100%; padding: 14px; background: #1e40af; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
    .btn:disabled { background: #9ca3af; cursor: not-allowed; }
    .btn-secondary { background: #6b7280; }
    .btn-secondary:hover { background: #4b5563; }
    .success { background: #d1fae5; color: #047857; padding: 16px; border-radius: 8px; margin-bottom: 16px; text-align: center; }
    .info { background: #dbeafe; color: #1e40af; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
    .error { color: #dc2626; background: #fee2e2; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
    .promo-section { margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb; }
    .promo-input-group { display: flex; gap: 8px; margin-bottom: 8px; }
    .promo-input { flex: 1; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
    .promo-btn { padding: 12px 20px; background: #6b7280; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .promo-btn:hover { background: #4b5563; }
    .promo-btn:disabled { background: #9ca3af; cursor: not-allowed; }
    .discount-info { background: #d1fae5; color: #047857; padding: 12px; border-radius: 8px; font-size: 14px; margin-top: 8px; }
    .amount-breakdown { font-size: 14px; color: #6b7280; margin-top: 8px; }
    .amount-breakdown .line { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .amount-breakdown .total { font-weight: bold; color: #111827; padding-top: 8px; border-top: 1px solid #e5e7eb; margin-top: 8px; }
  </style>
  <script src="https://www.paypal.com/sdk/js?client-id=${process.env.PAYPAL_CLIENT_ID}&components=card-fields&disable-funding=paylater"></script>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Complete Payment</h1>
      <p>Secure payment powered by PayPal</p>
    </div>
    
    <div class="card">
      <div class="order-info">
        <h3>Banner Ad Campaign</h3>
        <p>${title}</p>
      </div>
      
      <div class="promo-section">
        <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px; color: #374151;">Have a promo code?</label>
        <div class="promo-input-group">
          <input 
            type="text" 
            id="promo-code-input" 
            class="promo-input" 
            placeholder="Enter promo code"
            style="text-transform: uppercase;"
          />
          <button id="apply-promo-btn" class="promo-btn">Apply</button>
        </div>
        <div id="promo-message"></div>
      </div>
      
      <div id="amount-display">
        <div class="amount">$${amount}</div>
      </div>
      
      <div id="success-message"></div>
      <div id="error-message"></div>
      
      <div id="payment-fields">
        <div class="field">
          <label>Cardholder Name</label>
          <div id="card-name-field" class="field-container"></div>
        </div>
        
        <div class="field">
          <label>Card Number</label>
          <div id="card-number-field" class="field-container"></div>
        </div>
        
        <div class="field-row">
          <div class="field">
            <label>Expiry Date</label>
            <div id="card-expiry-field" class="field-container"></div>
          </div>
          <div class="field">
            <label>CVV</label>
            <div id="card-cvv-field" class="field-container"></div>
          </div>
        </div>
        
        <button id="pay-button" class="btn" disabled>Loading...</button>
      </div>
    </div>
  </div>

  <script>
    const button = document.getElementById('pay-button');
    const errorDiv = document.getElementById('error-message');
    const successDiv = document.getElementById('success-message');
    const paymentFields = document.getElementById('payment-fields');
    const promoInput = document.getElementById('promo-code-input');
    const applyPromoBtn = document.getElementById('apply-promo-btn');
    const promoMessage = document.getElementById('promo-message');
    const amountDisplay = document.getElementById('amount-display');
    
    // Pricing state
    let originalAmount = ${amount};
    let currentAmount = ${amount};
    let appliedPromoCode = null;
    
    // Free order state
    const isFreeOrder = ${isFreeOrder};
    const finalAmount = ${finalAmount};
    const completionToken = '${completionToken || ""}';
    
    // Payment processing state management (30-second timeout)
    let processingTimeout = null;
    
    function startProcessing() {
      button.disabled = true;
      button.textContent = 'Processing...';
      errorDiv.innerHTML = '';
      
      // Set 30-second timeout
      processingTimeout = setTimeout(() => {
        resetProcessing('Payment timed out after 30 seconds. Please try again or contact support@readysetfly.us');
      }, 30000);
    }
    
    function resetProcessing(errorMessage = null) {
      if (processingTimeout) {
        clearTimeout(processingTimeout);
        processingTimeout = null;
      }
      button.disabled = false;
      button.textContent = 'Pay $' + currentAmount.toFixed(2);
      
      if (errorMessage) {
        errorDiv.innerHTML = '<div class="error">' + errorMessage + '</div>';
      }
    }
    
    // Promo code validation
    applyPromoBtn.addEventListener('click', async () => {
      const code = promoInput.value.trim().toUpperCase();
      if (!code) {
        promoMessage.innerHTML = '<div class="error">Please enter a promo code</div>';
        return;
      }
      
      applyPromoBtn.disabled = true;
      applyPromoBtn.textContent = 'Validating...';
      promoMessage.innerHTML = '';
      
      try {
        const response = await fetch('/api/promo-codes/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, context: 'banner-ad' })
        });
        const result = await response.json();
        
        if (result.valid) {
          appliedPromoCode = result;
          
          // Calculate discount
          let discount = 0;
          if (result.discountType === 'percentage') {
            discount = originalAmount * (result.discountValue / 100);
          } else if (result.discountType === 'fixed') {
            discount = result.discountValue;
          }
          
          currentAmount = Math.max(0, originalAmount - discount);
          
          // Update display with breakdown
          amountDisplay.innerHTML = \`
            <div class="amount-breakdown">
              <div class="line">
                <span>Subtotal:</span>
                <span>$\${originalAmount.toFixed(2)}</span>
              </div>
              <div class="line" style="color: #047857;">
                <span>Discount (\${result.code}):</span>
                <span>-$\${discount.toFixed(2)}</span>
              </div>
              <div class="line total">
                <span>Total:</span>
                <span style="font-size: 24px; color: #1e40af;">$\${currentAmount.toFixed(2)}</span>
              </div>
            </div>
          \`;
          
          promoMessage.innerHTML = \`<div class="discount-info">\${result.description}</div>\`;
          promoInput.disabled = true;
          applyPromoBtn.textContent = 'Applied';
          
          // Update button text with new amount
          if (button.textContent.includes('Pay')) {
            button.textContent = 'Pay $' + currentAmount.toFixed(2);
          }
        } else {
          promoMessage.innerHTML = \`<div class="error">\${result.message || 'Invalid promo code'}</div>\`;
          applyPromoBtn.disabled = false;
          applyPromoBtn.textContent = 'Apply';
        }
      } catch (error) {
        console.error('Promo code validation error:', error);
        promoMessage.innerHTML = '<div class="error">Failed to validate promo code</div>';
        applyPromoBtn.disabled = false;
        applyPromoBtn.textContent = 'Apply';
      }
    });
    
    // Handle FREE orders differently (no PayPal payment required)
    if (isFreeOrder) {
      // Show claim button instead of card fields
      paymentFields.innerHTML = \`
        <div class="info">Your total is $0.00 after applying the promo code!</div>
        <button id="claim-button" class="btn" data-testid="button-claim-free-order">Claim Free Banner Ad</button>
      \`;
      
      // Add click handler for free order claim
      const claimButton = document.getElementById('claim-button');
      claimButton.addEventListener('click', async () => {
        startProcessing();
        claimButton.textContent = 'Processing...';
        
        try {
          const response = await fetch('/api/banner-ad/complete-free-order/${orderId}', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completionToken })
          });
          
          const result = await response.json();
          
          if (response.ok) {
            // Clear timeout - success
            if (processingTimeout) {
              clearTimeout(processingTimeout);
              processingTimeout = null;
            }
            
            paymentFields.style.display = 'none';
            successDiv.innerHTML = '<div class="success"><h3>Order Claimed Successfully!</h3><p>Your free banner ad order has been confirmed. It will be reviewed and activated within 1 business day. We will contact you at ${sponsorEmail}.</p></div>';
            
            setTimeout(() => {
              window.location.href = '/';
            }, 5000);
          } else {
            resetProcessing(result.error || 'Failed to claim free order. Please contact support@readysetfly.us');
          }
        } catch (error) {
          console.error('Free order claim error:', error);
          resetProcessing('Failed to claim free order. Please try again or contact support@readysetfly.us');
        }
      });
    } else {
      // Standard PayPal payment flow for non-free orders
      const cardFields = paypal.CardFields({
        createOrder: async () => {
          const requestBody = {
            orderId: '${orderId}'
          };
          
          // Include promo code if applied
          if (appliedPromoCode) {
            requestBody.promoCode = appliedPromoCode.code;
          }
          
          const response = await fetch('/api/paypal/create-order-banner-ad', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });
          const order = await response.json();
          
          // Check if backend says this is now a free order (100% discount applied)
          if (order.useFreeCompletion) {
            // Clear timeout
            if (processingTimeout) {
              clearTimeout(processingTimeout);
              processingTimeout = null;
            }
            
            // Complete the free order immediately
            const completeResponse = await fetch('/api/banner-ad/complete-free-order/${orderId}', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ 
                completionToken: order.completionToken 
              })
            });
            
            const result = await completeResponse.json();
            
            if (completeResponse.ok) {
              paymentFields.style.display = 'none';
              successDiv.innerHTML = '<div class="success"><h3>Order Claimed Successfully!</h3><p>Your free banner ad order has been confirmed. It will be reviewed and activated within 1 business day. We will contact you at ${sponsorEmail}.</p></div>';
              
              setTimeout(() => {
                window.location.href = '/';
              }, 5000);
              
              // Throw to stop PayPal flow
              throw new Error('FREE_ORDER_COMPLETED');
            } else {
              throw new Error(result.error || 'Failed to complete free order');
            }
          }
          
          if (!order.id) {
            throw new Error(order.error || 'Failed to create payment');
          }
          return order.id;
        },
        onApprove: async (data) => {
          // Clear timeout - payment approved
          if (processingTimeout) {
            clearTimeout(processingTimeout);
            processingTimeout = null;
          }
          
          button.disabled = true;
          button.textContent = 'Processing...';
          
          try {
            // Capture the payment
            const response = await fetch('/api/paypal/capture-banner-ad/' + data.orderID + '/${orderId}', {
              method: 'POST'
            });
            const result = await response.json();
            
            if (result.status === 'COMPLETED') {
              paymentFields.style.display = 'none';
              successDiv.innerHTML = '<div class="success"><h3>Payment Successful!</h3><p>Thank you for your payment. Your banner ad order will be reviewed and activated within 1 business day. We will contact you at ${sponsorEmail}.</p></div>';
              
              setTimeout(() => {
                window.location.href = '/';
              }, 5000);
            } else {
              throw new Error('Payment not completed');
            }
          } catch (error) {
            console.error('Payment capture error:', error);
            resetProcessing('Payment capture failed. Please contact support@readysetfly.us with order ID: ${orderId}');
          }
        },
        onError: (error) => {
          console.error('PayPal error:', error);
          resetProcessing('Payment error. Please check your card details and try again.');
        }
      });

      if (cardFields.isEligible()) {
        cardFields.NameField().render('#card-name-field');
        cardFields.NumberField().render('#card-number-field');
        cardFields.ExpiryField().render('#card-expiry-field');
        cardFields.CVVField().render('#card-cvv-field');
        
        button.disabled = false;
        button.textContent = 'Pay $${amount}';
        
        button.addEventListener('click', async () => {
          startProcessing();
          
          try {
            await cardFields.submit();
          } catch (error) {
            console.error('Card field submission error:', error);
            resetProcessing('Payment submission failed. Please check your card details and try again.');
          }
        });
      } else {
        errorDiv.innerHTML = '<div class="error">Card payments are not available. Please contact support@readysetfly.us.</div>';
      }
    }
  </script>
</body>
</html>
    `);
  });
  app2.post("/api/contact", contactFormRateLimiter, async (req, res) => {
    try {
      const contactFormSchema = z4.object({
        firstName: z4.string().min(1, "First name is required").max(100),
        lastName: z4.string().min(1, "Last name is required").max(100),
        email: z4.string().email("Valid email is required").max(255),
        subject: z4.string().min(1, "Subject is required").max(200),
        message: z4.string().min(10, "Message must be at least 10 characters").max(2e3)
      });
      const validationResult = contactFormSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid form data",
          details: validationResult.error.errors
        });
      }
      const data = validationResult.data;
      const ip = req.ip || req.connection.remoteAddress || "unknown";
      const submission = await storage.createContactSubmission({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        subject: data.subject,
        message: data.message,
        ipAddress: ip
      });
      console.log(`Contact form submission persisted: ${submission.id} from ${data.email}`);
      sendContactFormEmail(data).then(async () => {
        await storage.updateContactSubmissionEmailStatus(submission.id, true);
        console.log(`Email sent successfully for submission ${submission.id}`);
      }).catch((error) => {
        console.error(`Failed to send email for submission ${submission.id}:`, error);
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Contact form error:", error);
      res.status(500).json({ error: "Failed to process contact form submission" });
    }
  });
  app2.post("/api/cron/send-expiration-reminders", async (req, res) => {
    try {
      const cronSecret = req.headers["x-cron-secret"];
      const expectedSecret = process.env.CRON_SECRET || process.env.SESSION_SECRET;
      if (!cronSecret || cronSecret !== expectedSecret) {
        console.warn("Unauthorized cron attempt from IP:", req.ip);
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { getBannerAdExpirationReminderHtml: getBannerAdExpirationReminderHtml2, getBannerAdExpirationReminderText: getBannerAdExpirationReminderText2, getMarketplaceListingExpirationReminderHtml: getMarketplaceListingExpirationReminderHtml2, getMarketplaceListingExpirationReminderText: getMarketplaceListingExpirationReminderText2 } = await Promise.resolve().then(() => (init_email_templates(), email_templates_exports));
      const { client: client2, fromEmail } = await getUncachableResendClient();
      let bannersProcessed = 0;
      let listingsProcessed = 0;
      let errors = [];
      const leadDays = Number(process.env.EXPIRATION_REMINDER_DAYS ?? 3);
      const expiringBanners = await storage.getExpiringBannerAdOrders(leadDays);
      const expiringListings = await storage.getExpiringMarketplaceListings(leadDays);
      for (const banner of expiringBanners) {
        try {
          const htmlBody = getBannerAdExpirationReminderHtml2(banner.sponsorName, {
            title: banner.title,
            company: banner.sponsorCompany || banner.sponsorName,
            tier: banner.tier,
            endDate: banner.endDate?.toISOString() || (/* @__PURE__ */ new Date()).toISOString(),
            startDate: banner.startDate?.toISOString() || (/* @__PURE__ */ new Date()).toISOString()
          });
          const textBody = getBannerAdExpirationReminderText2(banner.sponsorName, {
            title: banner.title,
            company: banner.sponsorCompany || banner.sponsorName,
            tier: banner.tier,
            endDate: banner.endDate?.toISOString() || (/* @__PURE__ */ new Date()).toISOString(),
            startDate: banner.startDate?.toISOString() || (/* @__PURE__ */ new Date()).toISOString(),
            leadDays
          });
          await client2.emails.send({
            from: fromEmail,
            to: banner.sponsorEmail,
            subject: `Action Required: Your Ready Set Fly banner campaign ends in ${leadDays} days`,
            html: htmlBody,
            text: textBody
          });
          await storage.updateBannerAdOrder(banner.id, {
            expirationReminderSent: true,
            expirationReminderSentAt: /* @__PURE__ */ new Date()
          });
          bannersProcessed++;
          console.log(`Sent expiration reminder for banner ad order ${banner.id} to ${banner.sponsorEmail}`);
        } catch (error) {
          console.error(`Failed to send reminder for banner ad ${banner.id}:`, error);
          errors.push(`Banner ${banner.id}: ${error.message}`);
        }
      }
      for (const listing of expiringListings) {
        try {
          const user = await storage.getUser(listing.userId);
          if (!user || !user.email) {
            console.warn(`Skipping listing ${listing.id} - user not found or no email`);
            continue;
          }
          const userName = user.firstName || user.email.split("@")[0];
          const htmlBody = getMarketplaceListingExpirationReminderHtml2(userName, {
            id: listing.id,
            title: listing.title,
            category: listing.category,
            tier: listing.tier || "basic",
            expiresAt: listing.expiresAt?.toISOString() || (/* @__PURE__ */ new Date()).toISOString()
          });
          const textBody = getMarketplaceListingExpirationReminderText2(userName, {
            id: listing.id,
            title: listing.title,
            category: listing.category,
            tier: listing.tier || "basic",
            expiresAt: listing.expiresAt?.toISOString() || (/* @__PURE__ */ new Date()).toISOString(),
            leadDays
          });
          await client2.emails.send({
            from: fromEmail,
            to: user.email,
            subject: `Renew your ${listing.category} listing \u2013 ${leadDays} days left on Ready Set Fly`,
            html: htmlBody,
            text: textBody
          });
          await storage.updateMarketplaceListing(listing.id, {
            expirationReminderSent: true,
            expirationReminderSentAt: /* @__PURE__ */ new Date()
          });
          listingsProcessed++;
          console.log(`Sent expiration reminder for marketplace listing ${listing.id} to ${user.email}`);
        } catch (error) {
          console.error(`Failed to send reminder for listing ${listing.id}:`, error);
          errors.push(`Listing ${listing.id}: ${error.message}`);
        }
      }
      res.json({
        success: true,
        bannersProcessed,
        listingsProcessed,
        totalReminders: bannersProcessed + listingsProcessed,
        errors: errors.length > 0 ? errors : void 0
      });
    } catch (error) {
      console.error("Cron job error:", error);
      res.status(500).json({
        error: "Failed to send expiration reminders",
        details: error.message
      });
    }
  });
  app2.post("/api/generate-description", isAuthenticated, async (req, res) => {
    try {
      const { listingType, details } = req.body;
      if (!openaiApiKey) {
        return res.status(503).json({ error: "AI service unavailable", details: "Missing OpenAI API key" });
      }
      if (!listingType || !details) {
        return res.status(400).json({ error: "Missing required fields: listingType and details" });
      }
      let systemPrompt = "";
      let userPrompt = "";
      switch (listingType) {
        case "aircraft-rental":
          systemPrompt = "You are an expert aviation copywriter specializing in aircraft rental listings. Create compelling, professional descriptions that highlight aircraft capabilities, features, and benefits for potential renters.";
          userPrompt = `Create a detailed, professional description for this aircraft rental listing:

Make: ${details.make}
Model: ${details.model}
Year: ${details.year}
Category: ${details.category}
${details.engine ? `Engine: ${details.engine}
` : ""}${details.avionics ? `Avionics: ${details.avionics}
` : ""}${details.totalTime ? `Total Time: ${details.totalTime} hours
` : ""}${details.location ? `Location: ${details.location}
` : ""}

Write a compelling 150-250 word description that emphasizes the aircraft's features, capabilities, and what makes it ideal for renters. Use professional aviation terminology but keep it accessible. Focus on practical benefits and highlight any special features or recent upgrades.`;
          break;
        case "aircraft-sale":
          systemPrompt = "You are an expert aviation sales copywriter. Create persuasive descriptions for aircraft for sale that emphasize value, condition, and investment potential.";
          userPrompt = `Create a detailed sales description for this aircraft:

${details.title}
${details.price ? `Price: $${details.price}
` : ""}${details.location ? `Location: ${details.location}
` : ""}

Write a compelling 150-250 word sales description that highlights the aircraft's value, condition, features, and investment potential. Emphasize what makes this aircraft stand out in the market.`;
          break;
        case "aviation-job":
          systemPrompt = "You are an expert in aviation recruitment. Create engaging job descriptions that attract qualified pilots and aviation professionals.";
          userPrompt = `Create a professional job description for this aviation position:

Title: ${details.title}
${details.company ? `Company: ${details.company}
` : ""}${details.location ? `Location: ${details.location}
` : ""}${details.salary ? `Salary: ${details.salary}
` : ""}

Write an engaging 150-250 word job description that outlines responsibilities, requirements, and benefits. Make it appealing to qualified aviation professionals.`;
          break;
        case "cfi-listing":
          systemPrompt = "You are an aviation education expert. Create descriptions for Certified Flight Instructor (CFI) listings that highlight expertise and teaching capabilities.";
          userPrompt = `Create a professional description for this CFI listing:

Title: ${details.title}
${details.certifications ? `Certifications: ${details.certifications}
` : ""}${details.location ? `Location: ${details.location}
` : ""}${details.experience ? `Experience: ${details.experience}
` : ""}

Write a 150-250 word description showcasing the instructor's qualifications, teaching style, and what students can expect. Emphasize expertise and approachability.`;
          break;
        case "flight-school":
          systemPrompt = "You are an aviation education marketing expert. Create compelling descriptions for flight schools that attract aspiring pilots.";
          userPrompt = `Create a professional description for this flight school:

Name: ${details.title}
${details.location ? `Location: ${details.location}
` : ""}${details.programs ? `Programs: ${details.programs}
` : ""}

Write a 150-250 word description that highlights the school's programs, instructors, aircraft, and unique advantages. Make it inspiring for aspiring pilots.`;
          break;
        case "mechanic":
          systemPrompt = "You are an aviation maintenance expert. Create professional descriptions for aircraft mechanic services that inspire confidence.";
          userPrompt = `Create a professional description for this aircraft mechanic service:

Title: ${details.title}
${details.certifications ? `Certifications: ${details.certifications}
` : ""}${details.location ? `Location: ${details.location}
` : ""}${details.specialties ? `Specialties: ${details.specialties}
` : ""}

Write a 150-250 word description that emphasizes expertise, certifications, services offered, and commitment to safety and quality.`;
          break;
        case "charter":
          systemPrompt = "You are an aviation charter service marketing expert. Create descriptions that emphasize luxury, convenience, and safety.";
          userPrompt = `Create a professional description for this charter service:

Title: ${details.title}
${details.aircraftType ? `Aircraft Type: ${details.aircraftType}
` : ""}${details.location ? `Based: ${details.location}
` : ""}${details.capacity ? `Capacity: ${details.capacity}
` : ""}

Write a 150-250 word description that highlights the service's benefits, aircraft capabilities, safety record, and commitment to customer satisfaction. Emphasize luxury and convenience.`;
          break;
        default:
          return res.status(400).json({ error: "Invalid listing type" });
      }
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      });
      const description = completion.choices[0]?.message?.content || "";
      res.json({ description });
    } catch (error) {
      console.error("AI description generation error:", {
        message: error?.message,
        status: error?.status,
        response: error?.response?.data,
        baseURL: openaiBaseUrl || "default"
      });
      res.status(500).json({
        error: "Failed to generate description",
        details: error?.message || "Unexpected error"
      });
    }
  });
  app2.get("/api/aircraft", async (req, res) => {
    try {
      const listings = await storage.getAllAircraftListings();
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch aircraft listings" });
    }
  });
  app2.get("/api/aircraft/:id", async (req, res) => {
    try {
      const listing = await storage.getAircraftListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Aircraft not found" });
      }
      res.json(listing);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch aircraft" });
    }
  });
  app2.get("/api/aircraft/owner/:ownerId", async (req, res) => {
    try {
      const listings = await storage.getAircraftListingsByOwner(req.params.ownerId);
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch owner aircraft" });
    }
  });
  app2.post(
    "/api/aircraft",
    isAuthenticated,
    isVerified,
    upload.fields([
      { name: "insuranceDoc", maxCount: 1 },
      { name: "annualInspectionDoc", maxCount: 1 }
    ]),
    async (req, res) => {
      try {
        const userId = req.user.claims.sub;
        const files = req.files;
        const hasFiles = files && Object.keys(files).length > 0;
        const listingData = hasFiles ? JSON.parse(req.body.listingData || "{}") : req.body;
        const timestamp2 = Date.now();
        const insuranceDocUrl = hasFiles && files.insuranceDoc ? `/uploads/insurance-${userId}-${timestamp2}.pdf` : null;
        const annualInspectionDocUrl = hasFiles && files.annualInspectionDoc ? `/uploads/annual-${userId}-${timestamp2}.pdf` : null;
        const docUrls = [
          insuranceDocUrl,
          annualInspectionDocUrl
        ].filter((url) => url !== null);
        let annualDueDate = null;
        if (listingData.annualInspectionDate) {
          const inspectionDate = new Date(listingData.annualInspectionDate);
          const dueDate = new Date(inspectionDate);
          dueDate.setFullYear(dueDate.getFullYear() + 1);
          annualDueDate = dueDate.toISOString().split("T")[0];
        }
        let hour100Remaining = null;
        if (listingData.requires100Hour && listingData.currentTach !== void 0 && listingData.currentTach !== null && listingData.hour100InspectionTach !== void 0 && listingData.hour100InspectionTach !== null) {
          const remaining = 100 - (listingData.currentTach - listingData.hour100InspectionTach);
          hour100Remaining = Math.max(0, remaining);
        }
        const validatedData = insertAircraftListingSchema.parse({
          ...listingData,
          ownerId: userId,
          isListed: !hasFiles || docUrls.length === 0,
          // Publish immediately if no verification docs
          ownershipVerified: false,
          maintenanceVerified: false,
          hasMaintenanceTracking: !!listingData.maintenanceTrackingProvider,
          // Automatic calculations
          annualDueDate,
          hour100Remaining,
          // Include verification doc URLs in listing for reference
          insuranceDocUrl,
          annualInspectionDocUrl
        });
        const listing = await storage.createAircraftListing(validatedData);
        if (hasFiles && docUrls.length > 0) {
          await storage.createVerificationSubmission({
            userId,
            type: "owner_aircraft",
            status: "pending",
            aircraftId: listing.id,
            submissionData: {
              ...listingData,
              registration: listing.registration,
              make: listing.make,
              model: listing.model
            },
            documentUrls: docUrls,
            reviewedBy: null,
            reviewedAt: null,
            reviewNotes: null,
            rejectionReason: null,
            faaRegistryChecked: false,
            faaRegistryMatch: null,
            faaRegistryData: null,
            sources: [],
            fileHashes: [],
            pilotLicenseExpiresAt: null,
            medicalCertExpiresAt: null,
            insuranceExpiresAt: null,
            governmentIdExpiresAt: null,
            expirationNotificationSent: false,
            lastNotificationSentAt: null
          });
        }
        res.status(201).json(listing);
      } catch (error) {
        console.error("Create aircraft listing error:", error);
        res.status(400).json({ error: error.message || "Invalid aircraft data" });
      }
    }
  );
  app2.patch("/api/aircraft/:id", isAuthenticated, isVerified, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const listing = await storage.getAircraftListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Aircraft not found" });
      }
      const user = await storage.getUser(userId);
      if (listing.ownerId !== userId && !user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ error: "Not authorized to update this aircraft" });
      }
      const updatedListing = await storage.updateAircraftListing(req.params.id, req.body);
      res.json(updatedListing);
    } catch (error) {
      res.status(500).json({ error: "Failed to update aircraft" });
    }
  });
  app2.post("/api/aircraft/:id/toggle", isAuthenticated, isVerified, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const listing = await storage.getAircraftListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Aircraft not found" });
      }
      const user = await storage.getUser(userId);
      if (listing.ownerId !== userId && !user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ error: "Not authorized to toggle this aircraft" });
      }
      const toggledListing = await storage.toggleAircraftListingStatus(req.params.id);
      res.json(toggledListing);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle aircraft status" });
    }
  });
  app2.delete("/api/aircraft/:id", isAuthenticated, isVerified, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const listing = await storage.getAircraftListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Aircraft not found" });
      }
      const user = await storage.getUser(userId);
      if (listing.ownerId !== userId && !user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ error: "Not authorized to delete this aircraft" });
      }
      await storage.deleteAircraftListing(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete aircraft" });
    }
  });
  app2.get("/api/marketplace", async (req, res) => {
    try {
      const { city, category, minPrice, maxPrice, engineType, keyword, radius, cfiRating } = req.query;
      if (!city && !category && !minPrice && !maxPrice && !engineType && !keyword && !radius && !cfiRating) {
        const listings2 = await storage.getAllMarketplaceListings();
        return res.json(listings2);
      }
      const filters = {};
      if (city) filters.city = city;
      if (category) filters.category = category;
      if (minPrice) {
        const parsed = parseFloat(minPrice);
        if (!isNaN(parsed)) filters.minPrice = parsed;
      }
      if (maxPrice) {
        const parsed = parseFloat(maxPrice);
        if (!isNaN(parsed)) filters.maxPrice = parsed;
      }
      if (engineType) filters.engineType = engineType;
      if (keyword) filters.keyword = keyword;
      if (cfiRating) filters.cfiRating = cfiRating;
      if (radius) {
        const parsed = parseFloat(radius);
        if (!isNaN(parsed)) filters.radius = parsed;
      }
      const listings = await storage.getFilteredMarketplaceListings(filters);
      res.json(listings);
    } catch (error) {
      console.error("Failed to fetch marketplace listings:", error);
      res.status(500).json({ error: "Failed to fetch marketplace listings" });
    }
  });
  app2.get("/api/marketplace/category/:category", async (req, res) => {
    try {
      const listings = await storage.getMarketplaceListingsByCategory(req.params.category);
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch category listings" });
    }
  });
  app2.get("/api/marketplace/user/:userId", async (req, res) => {
    try {
      const listings = await storage.getMarketplaceListingsByUser(req.params.userId);
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user listings" });
    }
  });
  app2.get("/api/marketplace/flagged", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const flaggedListings = await storage.getFlaggedMarketplaceListings();
      res.json(flaggedListings);
    } catch (error) {
      console.error("Error fetching flagged listings:", error);
      res.status(500).json({ error: "Failed to fetch flagged listings" });
    }
  });
  app2.get("/api/marketplace/:id", async (req, res) => {
    try {
      const listing = await storage.getMarketplaceListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      let userHasFlagged = false;
      if (req.user?.claims?.sub) {
        const userId = req.user.claims.sub;
        userHasFlagged = await storage.checkIfUserFlaggedListing(req.params.id, userId);
      }
      res.json({ ...listing, userHasFlagged });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch listing" });
    }
  });
  app2.post("/api/marketplace/:id/view", async (req, res) => {
    try {
      const listing = await storage.getMarketplaceListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      await storage.incrementMarketplaceViewCount(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to increment view count:", error);
      res.status(500).json({ error: "Failed to track view" });
    }
  });
  app2.post("/api/promo-codes/validate", async (req, res) => {
    try {
      const { code, context } = req.body;
      if (!code || !context) {
        return res.status(400).json({ valid: false, message: "Code and context are required" });
      }
      if (context !== "banner-ad" && context !== "marketplace") {
        return res.status(400).json({ valid: false, message: "Invalid context" });
      }
      const promoCode = await storage.validatePromoCodeForContext(code, context);
      if (!promoCode) {
        return res.json({ valid: false, message: "Invalid or expired promo code" });
      }
      res.json({
        valid: true,
        code: promoCode.code,
        description: promoCode.description || "Promo code applied successfully!",
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue ? parseFloat(promoCode.discountValue) : null
      });
    } catch (error) {
      console.error("Promo code validation error:", error);
      res.status(500).json({ valid: false, message: "Failed to validate promo code" });
    }
  });
  app2.post("/api/marketplace/check-expirations", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await storage.deactivateExpiredListings();
      res.json({
        deactivatedCount: result.deactivatedCount,
        message: `Deactivated ${result.deactivatedCount} expired listings`
      });
    } catch (error) {
      console.error("Failed to check expirations:", error);
      res.status(500).json({ error: "Failed to check expirations" });
    }
  });
  app2.post("/api/marketplace/:id/reactivate", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const { transactionId } = req.body;
      const listing = await storage.getMarketplaceListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if (listing.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to reactivate this listing" });
      }
      if (!transactionId) {
        return res.status(402).json({
          error: "Payment required",
          message: "Payment is required to reactivate this listing."
        });
      }
    } catch (error) {
      console.error("Failed to reactivate listing:", error);
      res.status(500).json({ error: "Failed to reactivate listing" });
    }
  });
  app2.post("/api/marketplace", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const { promoCode, paymentIntentId, ...listingData } = req.body;
      let monthlyFee = 25;
      let isPaid = false;
      let expiresAt = null;
      if (promoCode && promoCode.toUpperCase() === "LAUNCH2025") {
        monthlyFee = 0;
        isPaid = true;
        expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3);
      } else if (paymentIntentId) {
        isPaid = true;
        expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3);
      } else {
        return res.status(402).json({
          error: "Payment required",
          message: "Please complete payment to create a listing."
        });
      }
      const validatedData = insertMarketplaceListingSchema.parse({
        ...listingData,
        userId,
        monthlyFee: monthlyFee.toString()
      });
      const listing = await storage.createMarketplaceListing({
        ...validatedData,
        isPaid,
        expiresAt
      });
      try {
        const categoryListings = await storage.getMarketplaceListingsByCategory(listing.category);
        const activeCount = categoryListings.filter((l) => l.isActive).length;
        if (activeCount === 25 || activeCount === 30) {
          await storage.createAdminNotification({
            type: "listing_threshold",
            category: listing.category,
            title: `${listing.category.replace("-", " ").toUpperCase()} Listings Threshold Reached`,
            message: `The ${listing.category.replace("-", " ")} category now has ${activeCount} active listings. Consider monitoring this category for capacity.`,
            isRead: false,
            isActionable: true,
            listingCount: activeCount,
            threshold: activeCount
          });
        }
      } catch (notifError) {
        console.error("Failed to create threshold notification:", notifError);
      }
      res.status(201).json(listing);
    } catch (error) {
      console.error("Marketplace listing creation error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      res.status(400).json({ error: error.message || "Invalid listing data" });
    }
  });
  app2.patch("/api/marketplace/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const listingId = req.params.id;
      const existingListing = await storage.getMarketplaceListing(listingId);
      if (!existingListing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if (existingListing.isExample) {
        return res.status(403).json({ error: "Sample listings cannot be edited" });
      }
      if (existingListing.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized - you can only edit your own listings" });
      }
      const { userId: _, monthlyFee: __, isPaid: ___, expiresAt: ____, ...updateData } = req.body;
      const listing = await storage.updateMarketplaceListing(listingId, updateData);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      res.json(listing);
    } catch (error) {
      console.error("Marketplace listing update error:", error);
      res.status(500).json({ error: error.message || "Failed to update listing" });
    }
  });
  app2.post("/api/marketplace/:id/upgrade", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const listingId = req.params.id;
      const { newTier, transactionId } = req.body;
      if (!["basic", "standard", "premium"].includes(newTier)) {
        return res.status(400).json({ error: "Invalid tier" });
      }
      const existingListing = await storage.getMarketplaceListing(listingId);
      if (!existingListing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if (existingListing.isExample) {
        return res.status(403).json({ error: "Sample listings cannot be upgraded" });
      }
      if (existingListing.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized - you can only upgrade your own listings" });
      }
      if (existingListing.tier === newTier) {
        return res.status(400).json({ error: "Listing is already at this tier" });
      }
      const getTierPrice = (category, tier) => {
        const CATEGORY_PRICING2 = {
          "aircraft-sale": { basic: 25, standard: 40, premium: 100 },
          "charter": 250,
          "cfi": 30,
          "flight-school": 250,
          "mechanic": 40,
          "jobs": 40
        };
        const categoryPricing = CATEGORY_PRICING2[category];
        if (typeof categoryPricing === "object") {
          return categoryPricing[tier] || 25;
        }
        return typeof categoryPricing === "number" ? categoryPricing : 25;
      };
      const tierPrices = {
        basic: getTierPrice(existingListing.category, "basic"),
        standard: getTierPrice(existingListing.category, "standard"),
        premium: getTierPrice(existingListing.category, "premium")
      };
      const currentPrice = tierPrices[existingListing.tier || "basic"] || 25;
      const newPrice = tierPrices[newTier];
      const priceDifference = newPrice - currentPrice;
      if (priceDifference <= 0) {
        return res.status(400).json({ error: "Can only upgrade to a higher tier" });
      }
      const updatedListing = await storage.updateMarketplaceListing(listingId, {
        tier: newTier,
        monthlyFee: newPrice.toString()
      });
      res.json({
        message: "Listing upgraded successfully",
        listing: updatedListing,
        upgradeCost: priceDifference
      });
    } catch (error) {
      console.error("Marketplace listing upgrade error:", error);
      res.status(500).json({ error: error.message || "Failed to upgrade listing" });
    }
  });
  app2.post("/api/marketplace/:id/complete-upgrade", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const listingId = req.params.id;
      const { newTier, orderId } = req.body;
      if (!newTier || !orderId) {
        return res.status(400).json({ error: "Missing required fields: newTier and orderId" });
      }
      if (!VALID_TIERS.includes(newTier)) {
        return res.status(400).json({ error: "Invalid tier" });
      }
      const listing = await storage.getMarketplaceListing(listingId);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if (listing.isExample) {
        return res.status(403).json({ error: "Sample listings cannot be upgraded" });
      }
      if (listing.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to upgrade this listing" });
      }
      if (!isValidUpgrade(listing.tier || "basic", newTier)) {
        return res.status(400).json({ error: "Invalid upgrade - must upgrade to a higher tier" });
      }
      try {
        const { body } = await ordersController.getOrder({ id: orderId });
        const orderData = JSON.parse(String(body));
        if (orderData.status !== "COMPLETED") {
          return res.status(400).json({ error: "Payment not completed" });
        }
        const customId = orderData.purchase_units?.[0]?.custom_id || "";
        if (!customId.includes(`upgrade:${listingId}`)) {
          return res.status(400).json({ error: "Payment order mismatch" });
        }
      } catch (paypalError) {
        console.error("PayPal order verification error:", paypalError);
        return res.status(400).json({ error: "Failed to verify payment" });
      }
      const transactionHistory = listing.upgradeTransactions || [];
      if (transactionHistory.includes(orderId)) {
        return res.status(400).json({ error: "This payment has already been processed" });
      }
      const upgradeDelta = getUpgradeDelta(listing.category, listing.tier || "basic", newTier);
      const newMonthlyFee = (parseFloat(listing.monthlyFee || "25") + upgradeDelta).toString();
      const updatedListing = await storage.updateMarketplaceListing(listingId, {
        tier: newTier,
        monthlyFee: newMonthlyFee,
        upgradeTransactions: [...transactionHistory, orderId]
      });
      console.log(`\u2705 Listing ${listingId} upgraded: ${listing.tier} \u2192 ${newTier}, PayPal order: ${orderId}`);
      res.json({
        message: "Listing upgraded successfully",
        listing: updatedListing,
        transactionId: orderId
      });
    } catch (error) {
      console.error("Complete upgrade error:", error);
      res.status(500).json({ error: error.message || "Failed to complete upgrade" });
    }
  });
  app2.delete("/api/marketplace/:id", async (req, res) => {
    try {
      const listing = await storage.getMarketplaceListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if (listing.isExample) {
        return res.status(403).json({ error: "Sample listings cannot be deleted" });
      }
      const deleted = await storage.deleteMarketplaceListing(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Listing not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete listing" });
    }
  });
  app2.post("/api/marketplace/:id/flag", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const listingId = req.params.id;
      const { reason } = req.body;
      const listing = await storage.getMarketplaceListing(listingId);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      const result = await storage.flagMarketplaceListing(listingId, userId, reason);
      if (!result.success) {
        return res.status(400).json({ error: "You have already flagged this listing", flagCount: result.flagCount });
      }
      res.json({
        message: "Listing flagged successfully",
        flagCount: result.flagCount
      });
    } catch (error) {
      console.error("Error flagging marketplace listing:", error);
      res.status(500).json({ error: "Failed to flag listing" });
    }
  });
  app2.get("/api/rentals", async (req, res) => {
    try {
      const rentals2 = await storage.getAllRentals();
      res.json(rentals2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rentals" });
    }
  });
  app2.get("/api/rentals/renter/:renterId", async (req, res) => {
    try {
      const rentals2 = await storage.getRentalsByRenter(req.params.renterId);
      res.json(rentals2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch renter rentals" });
    }
  });
  app2.get("/api/rentals/owner/:ownerId", async (req, res) => {
    try {
      const rentals2 = await storage.getRentalsByOwner(req.params.ownerId);
      res.json(rentals2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch owner rentals" });
    }
  });
  app2.get("/api/rentals/aircraft/:aircraftId", async (req, res) => {
    try {
      const rentals2 = await storage.getRentalsByAircraft(req.params.aircraftId);
      res.json(rentals2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch aircraft rentals" });
    }
  });
  app2.get("/api/rentals/:id", async (req, res) => {
    try {
      const rental = await storage.getRental(req.params.id);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      res.json(rental);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rental" });
    }
  });
  app2.post("/api/rentals", isAuthenticated, isVerified, async (req, res) => {
    try {
      const renterId = req.user.claims.sub;
      const rentalData = {
        ...req.body,
        renterId,
        // Convert dates to ISO strings if they aren't already
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        // Ensure estimatedHours and hourlyRate are strings
        estimatedHours: String(req.body.estimatedHours),
        hourlyRate: String(req.body.hourlyRate)
      };
      const validatedData = insertRentalSchema.parse(rentalData);
      const rental = await storage.createRental(validatedData);
      res.status(201).json(rental);
    } catch (error) {
      console.error("Rental creation error:", error);
      res.status(400).json({ error: error.message || "Invalid rental data" });
    }
  });
  app2.patch("/api/rentals/:id", async (req, res) => {
    try {
      const rental = await storage.updateRental(req.params.id, req.body);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      res.json(rental);
    } catch (error) {
      res.status(500).json({ error: "Failed to update rental" });
    }
  });
  app2.post("/api/rentals/:id/complete-payment", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const { transactionId } = req.body;
      if (!transactionId) {
        return res.status(400).json({ error: "Transaction ID required" });
      }
      const rental = await storage.getRental(req.params.id);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      if (rental.renterId !== userId) {
        return res.status(403).json({ error: "Not authorized to complete this rental" });
      }
      if (rental.status !== "approved") {
        return res.status(400).json({ error: "Rental must be in approved status" });
      }
      console.log(`[RENTAL PAYMENT] PayPal order ${transactionId} captured for rental ${rental.id}`);
      const updatedRental = await storage.updateRental(req.params.id, {
        isPaid: true,
        status: "active"
      });
      const ownerPayoutAmount = parseFloat(rental.ownerPayout);
      await storage.addToUserBalance(rental.ownerId, ownerPayoutAmount);
      console.log(`[RENTAL PAYMENT] Credited $${ownerPayoutAmount} to owner ${rental.ownerId} for rental ${rental.id}`);
      res.json(updatedRental);
    } catch (error) {
      console.error("Complete payment error:", error);
      res.status(500).json({ error: error.message || "Failed to complete rental payment" });
    }
  });
  app2.get("/api/rentals/:rentalId/messages", async (req, res) => {
    try {
      const rental = await storage.getRental(req.params.rentalId);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      if (rental.status !== "active") {
        return res.status(403).json({ error: "Messaging only available for active rentals" });
      }
      const messages2 = await storage.getMessagesByRental(req.params.rentalId);
      res.json(messages2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });
  app2.post("/api/messages", async (req, res) => {
    try {
      const rental = await storage.getRental(req.body.rentalId);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      if (rental.status !== "active") {
        return res.status(403).json({ error: "Messaging only available for active rentals" });
      }
      const validatedData = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(validatedData);
      res.status(201).json(message);
    } catch (error) {
      res.status(400).json({ error: error.message || "Invalid message data" });
    }
  });
  app2.patch("/api/messages/:id/read", async (req, res) => {
    try {
      const message = await storage.markMessageAsRead(req.params.id);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      res.json(message);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark message as read" });
    }
  });
  app2.get("/api/reviews/user/:userId", async (req, res) => {
    try {
      const reviews2 = await storage.getReviewsByUser(req.params.userId);
      res.json(reviews2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });
  app2.get("/api/reviews/rental/:rentalId", async (req, res) => {
    try {
      const reviews2 = await storage.getReviewsByRental(req.params.rentalId);
      res.json(reviews2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });
  app2.get("/api/rentals/:rentalId/can-review", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const rental = await storage.getRental(req.params.rentalId);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      if (rental.status !== "completed") {
        return res.json({ canReview: false, reason: "Rental must be completed" });
      }
      const isParticipant = rental.renterId === userId || rental.ownerId === userId;
      if (!isParticipant) {
        return res.json({ canReview: false, reason: "Not a participant in this rental" });
      }
      const hasReviewed = await storage.hasUserReviewedRental(req.params.rentalId, userId);
      if (hasReviewed) {
        return res.json({ canReview: false, reason: "Already reviewed" });
      }
      const revieweeId = rental.renterId === userId ? rental.ownerId : rental.renterId;
      res.json({
        canReview: true,
        revieweeId,
        rental
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to check review eligibility" });
    }
  });
  app2.post("/api/reviews", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const rental = await storage.getRental(req.body.rentalId);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      if (rental.status !== "completed") {
        return res.status(400).json({ error: "Can only review completed rentals" });
      }
      const isParticipant = rental.renterId === userId || rental.ownerId === userId;
      if (!isParticipant) {
        return res.status(403).json({ error: "Not authorized to review this rental" });
      }
      const hasReviewed = await storage.hasUserReviewedRental(req.body.rentalId, userId);
      if (hasReviewed) {
        return res.status(400).json({ error: "Already reviewed this rental" });
      }
      const revieweeId = rental.renterId === userId ? rental.ownerId : rental.renterId;
      const { revieweeId: clientRevieweeId, ...reviewData } = req.body;
      const validatedData = insertReviewSchema.parse({
        ...reviewData,
        reviewerId: userId,
        revieweeId
        // Server-calculated, not from client
      });
      const review = await storage.createReview(validatedData);
      res.status(201).json(review);
    } catch (error) {
      console.error("Review creation error:", error);
      res.status(400).json({ error: error.message || "Invalid review data" });
    }
  });
  app2.post("/api/favorites", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertFavoriteSchema.parse({
        ...req.body,
        userId
        // Server-side, not from client
      });
      const favorite = await storage.addFavorite(userId, validatedData.listingType, validatedData.listingId);
      res.status(201).json(favorite);
    } catch (error) {
      console.error("Add favorite error:", error);
      res.status(400).json({ error: error.message || "Failed to add favorite" });
    }
  });
  app2.delete("/api/favorites/:listingType/:listingId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const { listingType, listingId } = req.params;
      if (listingType !== "marketplace" && listingType !== "aircraft") {
        return res.status(400).json({ error: "listingType must be 'marketplace' or 'aircraft'" });
      }
      const removed = await storage.removeFavorite(userId, listingType, listingId);
      if (!removed) {
        return res.status(404).json({ error: "Favorite not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Remove favorite error:", error);
      res.status(500).json({ error: "Failed to remove favorite" });
    }
  });
  app2.get("/api/favorites/check/:listingType/:listingId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const { listingType, listingId } = req.params;
      if (listingType !== "marketplace" && listingType !== "aircraft") {
        return res.status(400).json({ error: "listingType must be 'marketplace' or 'aircraft'" });
      }
      const isFavorited = await storage.checkIfFavorited(userId, listingType, listingId);
      res.json({ isFavorited });
    } catch (error) {
      console.error("Check favorite error:", error);
      res.status(500).json({ error: "Failed to check favorite status" });
    }
  });
  app2.get("/api/favorites", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const favorites2 = await storage.getUserFavorites(userId);
      res.json(favorites2);
    } catch (error) {
      console.error("Get favorites error:", error);
      res.status(500).json({ error: "Failed to fetch favorites" });
    }
  });
  app2.get("/api/transactions/user/:userId", async (req, res) => {
    try {
      const transactions2 = await storage.getTransactionsByUser(req.params.userId);
      res.json(transactions2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });
  app2.post("/api/transactions", async (req, res) => {
    try {
      const transaction = await storage.createTransaction(req.body);
      res.status(201).json(transaction);
    } catch (error) {
      res.status(400).json({ error: error.message || "Invalid transaction data" });
    }
  });
  app2.patch("/api/transactions/:id", async (req, res) => {
    try {
      const transaction = await storage.updateTransaction(req.params.id, req.body);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ error: "Failed to update transaction" });
    }
  });
  app2.post(
    "/api/verification-submissions",
    isAuthenticated,
    upload.fields([
      { name: "governmentIdFront", maxCount: 1 },
      { name: "governmentIdBack", maxCount: 1 },
      { name: "pilotCertificatePhoto", maxCount: 1 }
    ]),
    async (req, res) => {
      try {
        const userId = req.user.claims.sub;
        const files = req.files;
        const submissionData = JSON.parse(req.body.submissionData || "{}");
        const type = req.body.type || "renter_identity";
        const documentUrls = [];
        if (files.governmentIdFront) {
          documentUrls.push(`/uploads/id-front-${userId}-${Date.now()}.jpg`);
        }
        if (files.governmentIdBack) {
          documentUrls.push(`/uploads/id-back-${userId}-${Date.now()}.jpg`);
        }
        if (files.pilotCertificatePhoto) {
          documentUrls.push(`/uploads/pilot-cert-${userId}-${Date.now()}.jpg`);
        }
        const submission = await storage.createVerificationSubmission({
          userId,
          type,
          status: "pending",
          aircraftId: null,
          submissionData,
          documentUrls,
          reviewedBy: null,
          reviewedAt: null,
          reviewNotes: null,
          rejectionReason: null,
          faaRegistryChecked: false,
          faaRegistryMatch: null,
          faaRegistryData: null,
          sources: [],
          fileHashes: [],
          pilotLicenseExpiresAt: null,
          medicalCertExpiresAt: null,
          insuranceExpiresAt: null,
          governmentIdExpiresAt: null,
          expirationNotificationSent: false,
          lastNotificationSentAt: null
        });
        res.json(submission);
      } catch (error) {
        console.error("Verification submission error:", error);
        res.status(500).json({ error: error.message || "Failed to submit verification" });
      }
    }
  );
  app2.get("/api/verification-submissions/user/:userId", isAuthenticated, async (req, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const targetUserId = req.params.userId;
      const requestingUser = await storage.getUser(requestingUserId);
      if (requestingUserId !== targetUserId && !requestingUser?.isAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }
      const submissions = await storage.getVerificationSubmissionsByUser(targetUserId);
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch verification submissions" });
    }
  });
  app2.get("/api/verification-submissions/pending", isAuthenticated, isAdmin, async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      const submissions = await storage.getPendingVerificationSubmissions();
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending verifications" });
    }
  });
  app2.patch("/api/verification-submissions/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const reviewerId = req.user.claims.sub;
      const updates = {
        ...req.body,
        reviewedBy: reviewerId,
        reviewedAt: /* @__PURE__ */ new Date()
      };
      const submission = await storage.updateVerificationSubmission(req.params.id, updates);
      if (!submission) {
        return res.status(404).json({ error: "Verification submission not found" });
      }
      if (req.body.status === "approved") {
        if (submission.type === "renter_identity") {
          const submissionData = submission.submissionData;
          await storage.updateUser(submission.userId, {
            legalFirstName: submissionData.legalFirstName,
            legalLastName: submissionData.legalLastName,
            dateOfBirth: submissionData.dateOfBirth,
            identityVerified: true,
            identityVerifiedAt: /* @__PURE__ */ new Date(),
            isVerified: true
            // Legacy field
          });
          if (submissionData.faaCertificateNumber) {
            await storage.updateUser(submission.userId, {
              faaCertificateNumber: submissionData.faaCertificateNumber,
              pilotCertificateName: submissionData.pilotCertificateName,
              faaVerified: true,
              faaVerifiedMonth: (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { month: "2-digit", year: "numeric" }),
              faaVerifiedAt: /* @__PURE__ */ new Date()
            });
          }
        } else if (submission.type === "owner_aircraft" && submission.aircraftId) {
          await storage.updateAircraftListing(submission.aircraftId, {
            ownershipVerified: true,
            maintenanceVerified: true,
            maintenanceVerifiedAt: /* @__PURE__ */ new Date(),
            isListed: true
            // Publish the listing
          });
        }
      }
      res.json(submission);
    } catch (error) {
      res.status(500).json({ error: "Failed to update verification submission" });
    }
  });
  app2.get("/api/balance", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const balance = await storage.getUserBalance(userId);
      res.json({ balance });
    } catch (error) {
      console.error("Error fetching user balance:", error);
      res.status(500).json({ error: "Failed to fetch balance" });
    }
  });
  app2.post("/api/withdrawals", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, paypalEmail } = req.body;
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "Invalid withdrawal amount" });
      }
      if (!paypalEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail)) {
        return res.status(400).json({ error: "Valid PayPal email is required" });
      }
      const userBalance = parseFloat(await storage.getUserBalance(userId));
      if (userBalance < parsedAmount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      await storage.deductFromUserBalance(userId, parsedAmount);
      const request = await storage.createWithdrawalRequest({
        userId,
        amount: amount.toString(),
        paypalEmail
      });
      await storage.updateWithdrawalRequest(request.id, { status: "processing" });
      try {
        const { sendPayout: sendPayout2 } = await Promise.resolve().then(() => (init_paypal_payouts(), paypal_payouts_exports));
        const payoutResult = await sendPayout2({
          recipientEmail: paypalEmail,
          amount: parsedAmount,
          senderItemId: request.id,
          note: `Withdrawal request ${request.id}`,
          emailSubject: "You've received a payout from Ready Set Fly",
          emailMessage: "Your rental earnings have been sent to your PayPal account."
        });
        if (payoutResult.success) {
          const completedRequest = await storage.updateWithdrawalRequest(request.id, {
            status: "completed",
            payoutBatchId: payoutResult.batchId,
            payoutItemId: payoutResult.itemId,
            transactionId: payoutResult.transactionId,
            processedAt: /* @__PURE__ */ new Date()
          });
          console.log(`[PAYOUT SUCCESS] User ${userId} withdrawal ${request.id}: $${parsedAmount} sent to ${paypalEmail}`);
          res.json(completedRequest);
        } else {
          await storage.addToUserBalance(userId, parsedAmount);
          await storage.updateWithdrawalRequest(request.id, {
            status: "failed",
            failureReason: payoutResult.error,
            processedAt: /* @__PURE__ */ new Date()
          });
          console.error(`[PAYOUT FAILED] User ${userId} withdrawal ${request.id}: ${payoutResult.error}`);
          res.status(400).json({
            error: `Payout failed: ${payoutResult.error}. Your balance has been refunded.`
          });
        }
      } catch (payoutError) {
        await storage.addToUserBalance(userId, parsedAmount);
        await storage.updateWithdrawalRequest(request.id, {
          status: "failed",
          failureReason: payoutError.message,
          processedAt: /* @__PURE__ */ new Date()
        });
        console.error(`[PAYOUT ERROR] User ${userId} withdrawal ${request.id}:`, payoutError);
        res.status(500).json({
          error: `Payout processing error: ${payoutError.message}. Your balance has been refunded.`
        });
      }
    } catch (error) {
      console.error("Error creating withdrawal request:", error);
      res.status(500).json({ error: error.message || "Failed to create withdrawal request" });
    }
  });
  app2.get("/api/withdrawals", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getWithdrawalRequestsByUser(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching withdrawal requests:", error);
      res.status(500).json({ error: "Failed to fetch withdrawal requests" });
    }
  });
  app2.get("/api/admin/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const query = req.query.q || "";
      const users2 = query ? await storage.searchUsers(query) : [];
      res.json(users2);
    } catch (error) {
      res.status(500).json({ error: "Failed to search users" });
    }
  });
  app2.get("/api/admin/users/:userId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });
  app2.get("/api/admin/users/:userId/aircraft", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const listings = await storage.getAircraftListingsByOwner(req.params.userId);
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user's aircraft listings" });
    }
  });
  app2.get("/api/admin/users/:userId/marketplace", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const listings = await storage.getMarketplaceListingsByUser(req.params.userId);
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user's marketplace listings" });
    }
  });
  app2.get("/api/admin/users/:userId/verifications", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const verifications = await storage.getVerificationSubmissionsByUser(req.params.userId);
      res.json(verifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user's verification submissions" });
    }
  });
  app2.post("/api/admin/users/:userId/reset-password", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
        success: true,
        message: "Password reset email would be sent to user",
        email: user.email
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to initiate password reset" });
    }
  });
  app2.patch("/api/admin/users/:userId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.userId, req.body);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });
  app2.get("/api/admin/aircraft", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const listings = await storage.getAllAircraftListings();
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch aircraft listings" });
    }
  });
  app2.get("/api/admin/marketplace", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const listings = await storage.getAllMarketplaceListings();
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch marketplace listings" });
    }
  });
  app2.post("/api/admin/marketplace/free-listing-token", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const requesterId = req.user.claims.sub;
      const targetUserId = req.body?.userId || requesterId;
      const durationDays = Math.min(Math.max(Number(req.body?.durationDays) || 30, 1), 90);
      const token = jwt2.sign({
        type: "admin-free-marketplace-listing",
        userId: targetUserId,
        issuedBy: requesterId,
        durationDays,
        originalAmount: "0",
        discountAmount: "0",
        issuedAt: Date.now()
      }, process.env.SESSION_SECRET || "dev-secret", { expiresIn: "2h" });
      res.json({ token, durationDays });
    } catch (error) {
      console.error("Failed to issue admin free listing token:", error);
      res.status(500).json({ error: error.message || "Failed to issue token" });
    }
  });
  app2.patch("/api/admin/aircraft/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { isListed, isFeatured, adminNotes } = req.body;
      const updates = {};
      if (typeof isListed === "boolean") updates.isListed = isListed;
      if (typeof isFeatured === "boolean") updates.isFeatured = isFeatured;
      if (adminNotes !== void 0) updates.adminNotes = adminNotes;
      const aircraft = await storage.updateAircraftListing(req.params.id, updates);
      if (!aircraft) {
        return res.status(404).json({ error: "Aircraft listing not found" });
      }
      res.json(aircraft);
    } catch (error) {
      console.error("Error updating aircraft listing:", error);
      res.status(500).json({ error: "Failed to update aircraft listing" });
    }
  });
  app2.patch("/api/admin/marketplace/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { isActive, isFeatured, adminNotes, expiresAt } = req.body;
      const updates = {};
      if (typeof isActive === "boolean") updates.isActive = isActive;
      if (typeof isFeatured === "boolean") updates.isFeatured = isFeatured;
      if (adminNotes !== void 0) updates.adminNotes = adminNotes;
      if (expiresAt !== void 0) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
      const listing = await storage.updateMarketplaceListing(req.params.id, updates);
      if (!listing) {
        return res.status(404).json({ error: "Marketplace listing not found" });
      }
      res.json(listing);
    } catch (error) {
      console.error("Error updating marketplace listing:", error);
      res.status(500).json({ error: "Failed to update marketplace listing" });
    }
  });
  app2.get("/api/admin/analytics", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const analytics = await storage.getAnalytics();
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });
  app2.get("/api/admin/user-metrics", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const [userMetrics, geographic, retention] = await Promise.all([
        storage.getUserMetrics(),
        storage.getGeographicDistribution(),
        storage.getUserRetentionMetrics()
      ]);
      res.json({
        ...userMetrics,
        geographic,
        retention
      });
    } catch (error) {
      console.error("Error fetching user metrics:", error);
      res.status(500).json({ error: "Failed to fetch user metrics" });
    }
  });
  app2.get("/api/admin/withdrawals", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const requests = await storage.getAllWithdrawalRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching withdrawal requests:", error);
      res.status(500).json({ error: "Failed to fetch withdrawal requests" });
    }
  });
  app2.get("/api/admin/withdrawals/pending", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const requests = await storage.getPendingWithdrawalRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching pending withdrawals:", error);
      res.status(500).json({ error: "Failed to fetch pending withdrawals" });
    }
  });
  app2.post("/api/admin/withdrawals/:id/process", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const withdrawalId = req.params.id;
      const adminId = req.user.claims.sub;
      const withdrawal = await storage.getWithdrawalRequest(withdrawalId);
      if (!withdrawal) {
        return res.status(404).json({ error: "Withdrawal request not found" });
      }
      if (withdrawal.status !== "pending") {
        return res.status(400).json({ error: "Withdrawal request is not pending" });
      }
      await storage.updateWithdrawalRequest(withdrawalId, {
        status: "processing",
        processedBy: adminId,
        processedAt: /* @__PURE__ */ new Date()
      });
      const { sendPayout: sendPayout2 } = await Promise.resolve().then(() => (init_paypal_payouts(), paypal_payouts_exports));
      const payoutResult = await sendPayout2({
        recipientEmail: withdrawal.paypalEmail,
        amount: parseFloat(withdrawal.amount),
        senderItemId: withdrawalId,
        note: `Withdrawal request ${withdrawalId}`,
        emailSubject: "You've received a payout from Ready Set Fly",
        emailMessage: "Your rental earnings have been sent to your PayPal account."
      });
      if (payoutResult.success) {
        await storage.updateWithdrawalRequest(withdrawalId, {
          status: "completed",
          payoutBatchId: payoutResult.batchId,
          payoutItemId: payoutResult.itemId,
          transactionId: payoutResult.transactionId
        });
        res.json({
          success: true,
          message: "Payout sent successfully",
          withdrawal: await storage.getWithdrawalRequest(withdrawalId)
        });
      } else {
        await storage.addToUserBalance(withdrawal.userId, parseFloat(withdrawal.amount));
        await storage.updateWithdrawalRequest(withdrawalId, {
          status: "failed",
          failureReason: payoutResult.error
        });
        res.status(400).json({
          success: false,
          error: payoutResult.error,
          message: "Payout failed, user balance has been refunded"
        });
      }
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      res.status(500).json({ error: error.message || "Failed to process withdrawal" });
    }
  });
  app2.patch("/api/admin/withdrawals/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const withdrawalId = req.params.id;
      const { status, adminNotes } = req.body;
      const withdrawal = await storage.getWithdrawalRequest(withdrawalId);
      if (!withdrawal) {
        return res.status(404).json({ error: "Withdrawal request not found" });
      }
      if (status === "cancelled" && withdrawal.status === "pending") {
        await storage.addToUserBalance(withdrawal.userId, parseFloat(withdrawal.amount));
      }
      const updated = await storage.updateWithdrawalRequest(withdrawalId, {
        status,
        adminNotes,
        processedBy: req.user.claims.sub,
        processedAt: /* @__PURE__ */ new Date()
      });
      res.json(updated);
    } catch (error) {
      console.error("Error updating withdrawal:", error);
      res.status(500).json({ error: error.message || "Failed to update withdrawal" });
    }
  });
  app2.get("/api/admin/stale-listings", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const daysStale = parseInt(req.query.days) || 60;
      const [staleAircraft, staleMarketplace] = await Promise.all([
        storage.getStaleAircraftListings(daysStale),
        storage.getStaleMarketplaceListings(daysStale)
      ]);
      res.json({
        aircraft: staleAircraft,
        marketplace: staleMarketplace,
        totalCount: staleAircraft.length + staleMarketplace.length
      });
    } catch (error) {
      console.error("Error fetching stale listings:", error);
      res.status(500).json({ error: "Failed to fetch stale listings" });
    }
  });
  app2.get("/api/admin/orphaned-listings", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const [orphanedAircraft, orphanedMarketplace] = await Promise.all([
        storage.getOrphanedAircraftListings(),
        storage.getOrphanedMarketplaceListings()
      ]);
      res.json({
        aircraft: orphanedAircraft,
        marketplace: orphanedMarketplace,
        totalCount: orphanedAircraft.length + orphanedMarketplace.length
      });
    } catch (error) {
      console.error("Error fetching orphaned listings:", error);
      res.status(500).json({ error: "Failed to fetch orphaned listings" });
    }
  });
  app2.post("/api/admin/send-listing-reminders", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { getUncachableResendClient: getUncachableResendClient2 } = await Promise.resolve().then(() => (init_resendClient(), resendClient_exports));
      const { getListingReminderEmailHtml: getListingReminderEmailHtml2, getListingReminderEmailText: getListingReminderEmailText2 } = await Promise.resolve().then(() => (init_email_templates(), email_templates_exports));
      const usersWithListings = await storage.getUsersWithActiveListings();
      const { client: client2, fromEmail } = await getUncachableResendClient2();
      let successCount = 0;
      let failureCount = 0;
      const errors = [];
      for (const { user, aircraftCount, marketplaceCount } of usersWithListings) {
        if (!user.email) {
          failureCount++;
          errors.push(`User ${user.id} has no email`);
          continue;
        }
        try {
          await client2.emails.send({
            from: fromEmail,
            to: user.email,
            subject: `\u{1F4CB} Monthly Listing Review - ${aircraftCount + marketplaceCount} Active Listing${aircraftCount + marketplaceCount === 1 ? "" : "s"}`,
            html: getListingReminderEmailHtml2(user.firstName || "Pilot", aircraftCount, marketplaceCount),
            text: getListingReminderEmailText2(user.firstName || "Pilot", aircraftCount, marketplaceCount)
          });
          successCount++;
        } catch (emailError) {
          failureCount++;
          errors.push(`Failed to send to ${user.email}: ${emailError.message}`);
          console.error(`Error sending email to ${user.email}:`, emailError);
        }
      }
      res.json({
        success: true,
        totalUsers: usersWithListings.length,
        emailsSent: successCount,
        emailsFailed: failureCount,
        errors: errors.length > 0 ? errors : void 0
      });
    } catch (error) {
      console.error("Error sending listing reminders:", error);
      res.status(500).json({ error: error.message || "Failed to send listing reminders" });
    }
  });
  app2.patch("/api/aircraft/:id/refresh", isAuthenticated, async (req, res) => {
    try {
      const aircraft = await storage.getAircraftListing(req.params.id);
      if (!aircraft) {
        return res.status(404).json({ error: "Aircraft listing not found" });
      }
      const sessionUserId = req.user.claims.sub;
      const user = await storage.getUser(sessionUserId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      if (aircraft.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ error: "Not authorized to refresh this listing" });
      }
      const updated = await storage.refreshAircraftListing(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error refreshing aircraft listing:", error);
      res.status(500).json({ error: "Failed to refresh aircraft listing" });
    }
  });
  app2.patch("/api/marketplace/:id/refresh", isAuthenticated, async (req, res) => {
    try {
      const listing = await storage.getMarketplaceListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Marketplace listing not found" });
      }
      const sessionUserId = req.user.claims.sub;
      const user = await storage.getUser(sessionUserId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      if (listing.userId !== user.id && !user.isAdmin) {
        return res.status(403).json({ error: "Not authorized to refresh this listing" });
      }
      const updated = await storage.refreshMarketplaceListing(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error refreshing marketplace listing:", error);
      res.status(500).json({ error: "Failed to refresh marketplace listing" });
    }
  });
  app2.get("/api/crm/leads", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const leads = await storage.getAllLeads();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });
  app2.post("/api/crm/leads", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const lead = await storage.createLead(req.body);
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: "Failed to create lead" });
    }
  });
  app2.patch("/api/crm/leads/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const lead = await storage.updateLead(req.params.id, req.body);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: "Failed to update lead" });
    }
  });
  app2.delete("/api/crm/leads/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteLead(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });
  app2.get("/api/crm/contacts", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const contacts = await storage.getAllContacts();
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });
  app2.post("/api/crm/contacts", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const contact = await storage.createContact(req.body);
      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to create contact" });
    }
  });
  app2.patch("/api/crm/contacts/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const contact = await storage.updateContact(req.params.id, req.body);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to update contact" });
    }
  });
  app2.delete("/api/crm/contacts/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteContact(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });
  app2.get("/api/crm/deals", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const deals = await storage.getAllDeals();
      res.json(deals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deals" });
    }
  });
  app2.post("/api/crm/deals", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const deal = await storage.createDeal(req.body);
      res.json(deal);
    } catch (error) {
      res.status(500).json({ error: "Failed to create deal" });
    }
  });
  app2.patch("/api/crm/deals/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const deal = await storage.updateDeal(req.params.id, req.body);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json(deal);
    } catch (error) {
      res.status(500).json({ error: "Failed to update deal" });
    }
  });
  app2.delete("/api/crm/deals/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteDeal(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete deal" });
    }
  });
  app2.get("/api/crm/activities", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const activities = await storage.getAllActivities();
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });
  app2.post("/api/crm/activities", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const activity = await storage.createActivity(req.body);
      res.json(activity);
    } catch (error) {
      res.status(500).json({ error: "Failed to create activity" });
    }
  });
  app2.patch("/api/crm/activities/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const activity = await storage.updateActivity(req.params.id, req.body);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }
      res.json(activity);
    } catch (error) {
      res.status(500).json({ error: "Failed to update activity" });
    }
  });
  app2.delete("/api/crm/activities/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteActivity(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Activity not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete activity" });
    }
  });
  app2.get("/api/admin/expenses", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const expenses2 = await storage.getAllExpenses();
      res.json(expenses2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });
  app2.post("/api/admin/expenses", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = insertExpenseSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const expense = await storage.createExpense(result.data);
      res.status(201).json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to create expense" });
    }
  });
  app2.patch("/api/admin/expenses/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = insertExpenseSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const expense = await storage.updateExpense(req.params.id, result.data);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to update expense" });
    }
  });
  app2.delete("/api/admin/expenses/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteExpense(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });
  app2.get("/api/admin/promo-codes", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const promoCodes2 = await storage.getAllPromoCodes();
      res.json(promoCodes2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch promo codes" });
    }
  });
  app2.post("/api/admin/promo-codes", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { insertPromoCodeSchema: insertPromoCodeSchema2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const result = insertPromoCodeSchema2.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const promoCode = await storage.createPromoCode(result.data);
      res.status(201).json(promoCode);
    } catch (error) {
      if (error.code === "23505") {
        return res.status(400).json({ error: "Promo code already exists" });
      }
      res.status(500).json({ error: "Failed to create promo code" });
    }
  });
  app2.patch("/api/admin/promo-codes/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { insertPromoCodeSchema: insertPromoCodeSchema2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const result = insertPromoCodeSchema2.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const promoCode = await storage.updatePromoCode(req.params.id, result.data);
      if (!promoCode) {
        return res.status(404).json({ error: "Promo code not found" });
      }
      res.json(promoCode);
    } catch (error) {
      if (error.code === "23505") {
        return res.status(400).json({ error: "Promo code already exists" });
      }
      res.status(500).json({ error: "Failed to update promo code" });
    }
  });
  app2.delete("/api/admin/promo-codes/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deletePromoCode(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Promo code not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete promo code" });
    }
  });
  app2.get("/api/admin/notifications", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const notifications = await storage.getAllAdminNotifications();
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });
  app2.get("/api/admin/notifications/unread", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const notifications = await storage.getUnreadAdminNotifications();
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unread notifications" });
    }
  });
  app2.post("/api/admin/notifications", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const notification = await storage.createAdminNotification(req.body);
      res.status(201).json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to create notification" });
    }
  });
  app2.patch("/api/admin/notifications/:id/read", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const notification = await storage.markNotificationAsRead(req.params.id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });
  app2.patch("/api/admin/notifications/:id/actionable", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { isActionable } = req.body;
      const notification = await storage.markNotificationAsActionable(req.params.id, isActionable);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to update notification" });
    }
  });
  app2.delete("/api/admin/notifications/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteAdminNotification(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });
  app2.get("/api/admin/banner-ad-orders", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { approvalStatus, paymentStatus } = req.query;
      const orders = await storage.getBannerAdOrdersByStatus(
        approvalStatus,
        paymentStatus
      );
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch banner ad orders" });
    }
  });
  app2.get("/api/admin/banner-ad-orders/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const order = await storage.getBannerAdOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Banner ad order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch banner ad order" });
    }
  });
  app2.post("/api/admin/banner-ad-orders", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { calculateBannerAdPricing: calculateBannerAdPricing2 } = await Promise.resolve().then(() => (init_bannerPricing(), bannerPricing_exports));
      const { validatePromoCode: validatePromoCode2, calculatePromoDiscount: calculatePromoDiscount2 } = await Promise.resolve().then(() => (init_promoCodes(), promoCodes_exports));
      const tier = req.body.tier;
      const promoCode = req.body.promoCode?.trim();
      const basePricing = calculateBannerAdPricing2(tier);
      let finalPricing = {
        monthlyRate: basePricing.monthlyRate.toString(),
        totalAmount: basePricing.subscriptionTotal.toString(),
        creationFee: basePricing.creationFee.toString(),
        grandTotal: basePricing.grandTotal.toString(),
        discountAmount: "0.00",
        promoCode: ""
      };
      if (promoCode) {
        const promo = validatePromoCode2(promoCode);
        if (promo) {
          const discounts = calculatePromoDiscount2(
            basePricing.creationFee,
            basePricing.subscriptionTotal,
            promoCode
          );
          finalPricing = {
            monthlyRate: basePricing.monthlyRate.toString(),
            totalAmount: basePricing.subscriptionTotal.toString(),
            creationFee: discounts.finalCreationFee.toFixed(2),
            grandTotal: discounts.finalGrandTotal.toFixed(2),
            discountAmount: discounts.totalDiscount.toFixed(2),
            promoCode: promo.code
          };
        }
      }
      const validatedOrderData = {
        ...req.body,
        ...finalPricing
      };
      const order = await storage.createBannerAdOrder(validatedOrderData);
      (async () => {
        try {
          const { getUncachableResendClient: getUncachableResendClient2 } = await Promise.resolve().then(() => (init_resendClient(), resendClient_exports));
          const { getBannerAdOrderEmailHtml: getBannerAdOrderEmailHtml2, getBannerAdOrderEmailText: getBannerAdOrderEmailText2 } = await Promise.resolve().then(() => (init_email_templates(), email_templates_exports));
          const { client: client2, fromEmail } = await getUncachableResendClient2();
          await client2.emails.send({
            from: fromEmail,
            to: order.sponsorEmail || "noreply@readysetfly.com",
            subject: `Banner Ad Order Confirmation - ${order.title}`,
            html: getBannerAdOrderEmailHtml2(order.sponsorName || "Sponsor", {
              orderId: order.id,
              title: order.title,
              tier: order.tier,
              monthlyRate: order.monthlyRate,
              creationFee: order.creationFee,
              totalAmount: order.totalAmount,
              grandTotal: order.grandTotal,
              // @ts-ignore
              promoCode: order.promoCode || "",
              // @ts-ignore
              discountAmount: order.discountAmount || ""
            }),
            text: getBannerAdOrderEmailText2(order.sponsorName || "Sponsor", {
              orderId: order.id,
              title: order.title,
              tier: order.tier,
              monthlyRate: order.monthlyRate,
              creationFee: order.creationFee,
              totalAmount: order.totalAmount,
              grandTotal: order.grandTotal,
              // @ts-ignore
              promoCode: order.promoCode || "",
              // @ts-ignore
              discountAmount: order.discountAmount || ""
            })
          });
          console.log(`\u2705 Banner ad order confirmation email sent to ${order.sponsorEmail || "admin"}`);
        } catch (emailError) {
          console.error("\u274C Failed to send banner ad order email:", emailError);
        }
      })();
      res.status(201).json(order);
    } catch (error) {
      console.error("Banner ad order creation error:", error);
      res.status(500).json({ error: "Failed to create banner ad order", details: error instanceof Error ? error.message : String(error) });
    }
  });
  app2.patch("/api/admin/banner-ad-orders/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const existingOrder = await storage.getBannerAdOrder(req.params.id);
      if (!existingOrder) {
        return res.status(404).json({ error: "Banner ad order not found" });
      }
      const { calculateBannerAdPricing: calculateBannerAdPricing2 } = await Promise.resolve().then(() => (init_bannerPricing(), bannerPricing_exports));
      const { validatePromoCode: validatePromoCode2, calculatePromoDiscount: calculatePromoDiscount2 } = await Promise.resolve().then(() => (init_promoCodes(), promoCodes_exports));
      const tier = req.body.tier || existingOrder.tier;
      const promoCode = req.body.promoCode?.trim() ?? (req.body.promoCode === "" ? "" : existingOrder.promoCode);
      const basePricing = calculateBannerAdPricing2(tier);
      let finalPricing = {
        monthlyRate: basePricing.monthlyRate.toString(),
        totalAmount: basePricing.subscriptionTotal.toString(),
        creationFee: basePricing.creationFee.toString(),
        grandTotal: basePricing.grandTotal.toString(),
        discountAmount: "0.00",
        promoCode: ""
      };
      if (promoCode) {
        const promo = validatePromoCode2(promoCode);
        if (promo) {
          const discounts = calculatePromoDiscount2(
            basePricing.creationFee,
            basePricing.subscriptionTotal,
            promoCode
          );
          finalPricing = {
            monthlyRate: basePricing.monthlyRate.toString(),
            totalAmount: basePricing.subscriptionTotal.toString(),
            creationFee: discounts.finalCreationFee.toFixed(2),
            grandTotal: discounts.finalGrandTotal.toFixed(2),
            discountAmount: discounts.totalDiscount.toFixed(2),
            promoCode: promo.code
          };
        }
      }
      req.body = {
        ...req.body,
        tier,
        // Ensure tier is set
        ...finalPricing
      };
      const order = await storage.updateBannerAdOrder(req.params.id, req.body);
      res.json(order);
    } catch (error) {
      console.error("Banner ad order update error:", error);
      res.status(500).json({ error: "Failed to update banner ad order" });
    }
  });
  app2.delete("/api/admin/banner-ad-orders/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteBannerAdOrder(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Banner ad order not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete banner ad order" });
    }
  });
  app2.post("/api/admin/banner-ad-orders/:id/activate", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const ad = await storage.activateBannerAdOrder(req.params.id);
      if (!ad) {
        return res.status(400).json({ error: "Failed to activate order. Order must be paid and have required content." });
      }
      res.json(ad);
    } catch (error) {
      if (error instanceof Error && error.message === "ALREADY_ACTIVATED") {
        return res.status(409).json({ error: "This order has already been activated." });
      }
      if (error instanceof Error && error.message === "UNPAID_ORDER") {
        return res.status(402).json({ error: "Payment required", details: "Order must be paid before activation." });
      }
      if (error instanceof Error && error.message === "MISSING_PAYMENT_REFERENCE") {
        return res.status(400).json({ error: "Payment reference missing", details: "PayPal order ID is missing; capture must complete before activation." });
      }
      if (error instanceof Error && error.message === "NOT_APPROVED") {
        return res.status(400).json({ error: "Approval required", details: "Order must be approved before activation." });
      }
      if (error instanceof Error && error.message === "IMAGE_REQUIRED") {
        return res.status(400).json({ errorCode: "IMAGE_REQUIRED", error: "Banner image is required. Please upload an image before activating this order." });
      }
      console.error("Banner ad order activation error:", error);
      res.status(500).json({ error: "Failed to activate banner ad order", details: error instanceof Error ? error.message : String(error) });
    }
  });
  app2.patch("/api/admin/banner-ad-orders/:id/approval", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { approvalStatus, adminNotes } = req.body;
      const validStatuses = ["approved", "rejected", "sent", "draft"];
      if (!approvalStatus || !validStatuses.includes(approvalStatus)) {
        return res.status(400).json({ error: "Invalid approval status. Must be: approved, rejected, sent, or draft" });
      }
      const order = await storage.getBannerAdOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Banner ad order not found" });
      }
      if (approvalStatus === "approved" && order.paymentStatus !== "paid") {
        return res.status(400).json({ error: "Cannot approve unpaid orders. Order must be paid before approval." });
      }
      const updated = await storage.updateBannerAdOrder(req.params.id, {
        approvalStatus,
        adminNotes: adminNotes || order.adminNotes
      });
      console.log(`\u2705 Banner ad order ${req.params.id} approval status updated to: ${approvalStatus}`);
      res.json(updated);
    } catch (error) {
      console.error("Banner ad order approval error:", error);
      res.status(500).json({ error: "Failed to update approval status" });
    }
  });
  app2.get("/api/admin/banner-ads", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const ads = await storage.getAllBannerAds();
      res.json(ads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch banner ads" });
    }
  });
  app2.get("/api/admin/banner-ads/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const ad = await storage.getBannerAd(req.params.id);
      if (!ad) {
        return res.status(404).json({ error: "Banner ad not found" });
      }
      res.json(ad);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch banner ad" });
    }
  });
  app2.post("/api/admin/banner-ads", isAuthenticated, isAdmin, async (req, res) => {
    res.status(403).json({
      error: "Manual banner ad creation is not allowed",
      message: "Banner ads can only be created by activating paid banner ad orders. Please use the 'Activate Order' button in the Banner Ad Orders section."
    });
  });
  app2.patch("/api/admin/banner-ads/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      console.log("[BANNER UPDATE] Request body:", req.body);
      console.log("[BANNER UPDATE] Banner ID:", req.params.id);
      const updateData = {};
      if (req.body.startDate) {
        updateData.startDate = new Date(req.body.startDate);
      }
      if (req.body.endDate) {
        updateData.endDate = new Date(req.body.endDate);
      }
      const fieldsToUpdate = ["title", "description", "imageUrl", "link", "placements", "category", "isActive"];
      for (const field of fieldsToUpdate) {
        if (field in req.body) {
          updateData[field] = req.body[field];
        }
      }
      console.log("[BANNER UPDATE] Update data:", updateData);
      const ad = await storage.updateBannerAd(req.params.id, updateData);
      if (!ad) {
        return res.status(404).json({ error: "Banner ad not found" });
      }
      console.log("[BANNER UPDATE] Success! Updated ad:", ad);
      res.json(ad);
    } catch (error) {
      console.error("[BANNER UPDATE] Error:", error);
      res.status(500).json({ error: "Failed to update banner ad" });
    }
  });
  app2.delete("/api/admin/banner-ads/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteBannerAd(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Banner ad not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete banner ad" });
    }
  });
  app2.get("/api/banner-ads/active", async (req, res) => {
    try {
      const { placement, category } = req.query;
      const ads = await storage.getActiveBannerAds(
        placement,
        category
      );
      res.json(ads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active banner ads" });
    }
  });
  app2.post("/api/banner-ads/:id/impression", async (req, res) => {
    try {
      await storage.incrementBannerImpressions(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to track impression" });
    }
  });
  app2.post("/api/banner-ads/:id/click", async (req, res) => {
    try {
      await storage.incrementBannerClicks(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to track click" });
    }
  });
  app2.post("/api/admin/extract-invoice-data", isAuthenticated, isAdmin, upload.single("invoice"), async (req, res) => {
    const fs2 = await import("fs/promises");
    let filePath = null;
    let shouldCleanup = false;
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No invoice file provided" });
      }
      filePath = req.file.path;
      shouldCleanup = true;
      const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp", "application/pdf"];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: "Invalid file type. Please upload an image or PDF." });
      }
      const fileBuffer = await fs2.readFile(filePath);
      const base64Image = fileBuffer.toString("base64");
      const mimeType = req.file.mimetype;
      const prompt = `You are an invoice data extraction assistant. Analyze this invoice image and extract the following information in JSON format:
{
  "amount": "the total amount (just the number with decimal, no currency symbol)",
  "date": "the invoice date in YYYY-MM-DD format",
  "description": "a brief description of what the invoice is for (company name + service/product)",
  "category": "best matching category: 'server', 'database', or 'other'"
}

If you cannot find certain fields, omit them from the response. Be accurate and only return the JSON object, nothing else.`;
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
        // Lower temperature for more consistent extraction
      });
      const responseText = completion.choices[0]?.message?.content || "{}";
      let extractedData = {};
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        extractedData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch (parseError) {
        console.error("Failed to parse AI response:", responseText);
        extractedData = {};
      }
      const validatedData = {};
      if (extractedData.amount && typeof extractedData.amount === "string") {
        validatedData.amount = extractedData.amount;
      }
      if (extractedData.date && typeof extractedData.date === "string") {
        validatedData.date = extractedData.date;
      }
      if (extractedData.description && typeof extractedData.description === "string") {
        validatedData.description = extractedData.description;
      }
      if (extractedData.category && ["server", "database", "other"].includes(extractedData.category)) {
        validatedData.category = extractedData.category;
      }
      res.json(validatedData);
    } catch (error) {
      console.error("Invoice extraction error:", error);
      const errorMessage = error.message || "Failed to extract invoice data";
      res.status(500).json({ error: errorMessage });
    } finally {
      if (filePath && shouldCleanup) {
        try {
          await fs2.unlink(filePath);
        } catch (cleanupError) {
          console.error("Failed to clean up temp file:", cleanupError);
        }
      }
    }
  });
  app2.get("/api/promo-alerts", async (req, res) => {
    try {
      const alerts = await storage.getActivePromoAlerts();
      res.json(alerts);
    } catch (error) {
      console.error("Failed to fetch promo alerts:", error);
      res.status(500).json({ error: "Failed to fetch promotional alerts" });
    }
  });
  app2.get("/api/admin/promo-alerts", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const alerts = await storage.getAllPromoAlerts();
      res.json(alerts);
    } catch (error) {
      console.error("Failed to fetch all promo alerts:", error);
      res.status(500).json({ error: "Failed to fetch promotional alerts" });
    }
  });
  app2.post("/api/promo-alerts", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const validatedData = insertPromoAlertSchema.parse(req.body);
      const alert = await storage.createPromoAlert(validatedData);
      res.json(alert);
    } catch (error) {
      console.error("Failed to create promo alert:", error);
      res.status(400).json({ error: error.message || "Failed to create promotional alert" });
    }
  });
  app2.patch("/api/promo-alerts/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const partialSchema = insertPromoAlertSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      const alert = await storage.updatePromoAlert(req.params.id, validatedData);
      if (!alert) {
        return res.status(404).json({ error: "Promotional alert not found" });
      }
      res.json(alert);
    } catch (error) {
      console.error("Failed to update promo alert:", error);
      res.status(400).json({ error: error.message || "Failed to update promotional alert" });
    }
  });
  app2.delete("/api/promo-alerts/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const deleted = await storage.deletePromoAlert(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Promotional alert not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete promo alert:", error);
      res.status(500).json({ error: "Failed to delete promotional alert" });
    }
  });
  app2.post("/api/admin/marketplace/:id/grant-promo", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { durationDays } = req.body;
      if (!durationDays || durationDays < 1 || durationDays > 31) {
        return res.status(400).json({ error: "Duration must be between 1 and 31 days" });
      }
      const listing = await storage.grantMarketplacePromoFreeTime(
        req.params.id,
        durationDays,
        req.user.id
      );
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      res.json(listing);
    } catch (error) {
      console.error("Failed to grant promo free time:", error);
      res.status(500).json({ error: error.message || "Failed to grant promotional free time" });
    }
  });
  app2.post("/api/job-applications", upload.single("resume"), async (req, res) => {
    try {
      const { listingId, firstName, lastName, email, phone, currentJobTitle, yearsOfExperience, coverLetter } = req.body;
      if (!req.file) {
        return res.status(400).json({ error: "Resume file is required" });
      }
      const listing = await storage.getMarketplaceListing(listingId);
      if (!listing || listing.category !== "job") {
        return res.status(404).json({ error: "Job listing not found" });
      }
      const listingOwner = await storage.getUser(listing.userId);
      const recipientEmail = listing.contactEmail || listingOwner?.email;
      if (!recipientEmail) {
        console.error(`No recipient email found for job listing ${listingId}. contactEmail: ${listing.contactEmail}, owner email: ${listingOwner?.email}`);
        return res.status(400).json({
          error: "Job listing does not have a contact email configured. Please contact the job poster to update their listing."
        });
      }
      const applicantId = req.user ? req.user.claims.sub : null;
      const applicationData = insertJobApplicationSchema.parse({
        listingId,
        applicantId,
        firstName,
        lastName,
        email,
        phone: phone || void 0,
        currentJobTitle: currentJobTitle || void 0,
        yearsOfExperience: yearsOfExperience || void 0,
        coverLetter: coverLetter || void 0,
        resumeUrl: `/uploads/documents/${req.file.filename}`
      });
      try {
        const { client: client2, fromEmail } = await getUncachableResendClient();
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0066cc 0%, #004a99 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">New Job Application Received</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin: 0 0 20px 0;">
      You've received a new application for your job listing:
    </p>
    
    <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #0066cc;">${listing.title}</h2>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">${listing.location || "Location not specified"}</p>
    </div>
    
    <div style="margin: 25px 0;">
      <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 15px 0; color: #374151;">Applicant Information</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Name:</td>
          <td style="padding: 8px 0; font-weight: 500; font-size: 14px;">${firstName} ${lastName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email:</td>
          <td style="padding: 8px 0; font-weight: 500; font-size: 14px;">${email}</td>
        </tr>
        ${phone ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Phone:</td>
          <td style="padding: 8px 0; font-weight: 500; font-size: 14px;">${phone}</td>
        </tr>
        ` : ""}
        ${currentJobTitle ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Current Job Title:</td>
          <td style="padding: 8px 0; font-weight: 500; font-size: 14px;">${currentJobTitle}</td>
        </tr>
        ` : ""}
        ${yearsOfExperience ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Years of Experience:</td>
          <td style="padding: 8px 0; font-weight: 500; font-size: 14px;">${yearsOfExperience}</td>
        </tr>
        ` : ""}
      </table>
    </div>
    
    ${coverLetter ? `
    <div style="margin: 25px 0;">
      <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 10px 0; color: #374151;">Cover Letter</h3>
      <div style="background: #f9fafb; padding: 15px; border-radius: 6px; border-left: 3px solid #0066cc;">
        <p style="margin: 0; font-size: 14px; white-space: pre-wrap;">${coverLetter}</p>
      </div>
    </div>
    ` : ""}
    
    <div style="margin: 30px 0; padding: 20px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        <strong>Note:</strong> The applicant's resume has been uploaded to your Ready Set Fly dashboard. Log in to view the full application and resume.
      </p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}/marketplace/${listingId}` : "https://readysetfly.com"}" 
         style="display: inline-block; background: #0066cc; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 500; font-size: 16px;">
        View Application
      </a>
    </div>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 13px;">
        Ready Set Fly - Aviation Marketplace & Rental Platform
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        This is an automated notification. Please do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>
        `;
        console.log(`Sending job application email to: ${recipientEmail} for listing: ${listing.title}`);
        await client2.emails.send({
          from: fromEmail,
          to: recipientEmail,
          subject: `Inquiry From Ready Set Fly about your Aviation Jobs Listing: ${listing.title}`,
          html: emailHtml
        });
        console.log(`Job application email sent successfully to: ${recipientEmail}`);
        const application = await storage.createJobApplication(applicationData);
        res.json(application);
      } catch (emailError) {
        console.error(`CRITICAL: Failed to send job application email to ${recipientEmail}:`, emailError);
        return res.status(500).json({
          error: "Failed to send notification to job poster. Please try again or contact support@readysetfly.us"
        });
      }
    } catch (error) {
      console.error("Job application error:", error);
      res.status(500).json({ error: error.message || "Failed to submit application" });
    }
  });
  app2.get("/api/job-applications/listing/:listingId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const listing = await storage.getMarketplaceListing(req.params.listingId);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if (listing.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to view applications for this listing" });
      }
      const applications = await storage.getJobApplicationsByListing(req.params.listingId);
      res.json(applications);
    } catch (error) {
      console.error("Failed to fetch job applications:", error);
      res.status(500).json({ error: "Failed to fetch applications" });
    }
  });
  app2.get("/api/job-applications/applicant", isAuthenticated, async (req, res) => {
    try {
      const applicantId = req.user.claims.sub;
      const applications = await storage.getJobApplicationsByApplicant(applicantId);
      res.json(applications);
    } catch (error) {
      console.error("Failed to fetch user applications:", error);
      res.status(500).json({ error: "Failed to fetch applications" });
    }
  });
  app2.patch("/api/job-applications/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const application = await storage.getJobApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      const listing = await storage.getMarketplaceListing(application.listingId);
      if (!listing || listing.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to update this application" });
      }
      const updated = await storage.updateJobApplication(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Failed to update application:", error);
      res.status(500).json({ error: "Failed to update application" });
    }
  });
  app2.patch("/api/user/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const { paypalEmail } = req.body;
      const updateData = {};
      if (paypalEmail !== void 0) {
        updateData.paypalEmail = paypalEmail;
      }
      const user = await storage.updateUser(userId, updateData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });
  app2.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });
  app2.patch("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, req.body);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });
  const weatherCache = /* @__PURE__ */ new Map();
  const WEATHER_CACHE_TTL = 3 * 60 * 1e3;
  app2.get("/api/aviation-weather/:icao", async (req, res) => {
    try {
      const icao = req.params.icao.toUpperCase();
      if (!/^[A-Z]{3,4}$/.test(icao)) {
        return res.status(400).json({ error: "Invalid ICAO code format" });
      }
      const now = Date.now();
      const cached = weatherCache.get(icao);
      if (cached && now - cached.timestamp < WEATHER_CACHE_TTL) {
        return res.json({ ...cached.data, cached: true });
      }
      const metarUrl = `https://aviationweather.gov/api/data/metar?ids=${icao}&format=json`;
      const tafUrl = `https://aviationweather.gov/api/data/taf?ids=${icao}&format=json`;
      const [metarRes, tafRes] = await Promise.all([
        fetch(metarUrl, { headers: { "User-Agent": "ReadySetFly/1.0" } }),
        fetch(tafUrl, { headers: { "User-Agent": "ReadySetFly/1.0" } })
      ]);
      let metar = null;
      let taf = null;
      if (metarRes.ok) {
        const metarData = await metarRes.json();
        metar = metarData.length > 0 ? metarData[0] : null;
      }
      if (tafRes.ok) {
        const tafData = await tafRes.json();
        taf = tafData.length > 0 ? tafData[0] : null;
      }
      const responseData = {
        icao,
        metar,
        taf,
        timestamp: now,
        cached: false
      };
      weatherCache.set(icao, { data: responseData, timestamp: now });
      if (weatherCache.size > 100) {
        const oldestKey = weatherCache.keys().next().value;
        if (oldestKey) {
          weatherCache.delete(oldestKey);
        }
      }
      res.json(responseData);
    } catch (error) {
      console.error("Aviation weather fetch error:", error);
      res.status(500).json({ error: "Failed to fetch aviation weather data" });
    }
  });
  app2.get("/api/logbook", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const entries = await storage.getLogbookEntriesByUser(userId);
      res.json(entries);
    } catch (error) {
      console.error("Failed to fetch logbook entries:", error);
      res.status(500).json({ error: "Failed to fetch logbook entries" });
    }
  });
  app2.post("/api/logbook", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = insertLogbookEntrySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const entry = await storage.createLogbookEntry({ ...result.data, userId });
      res.status(201).json(entry);
    } catch (error) {
      console.error("Failed to create logbook entry:", error);
      res.status(500).json({ error: "Failed to create logbook entry" });
    }
  });
  app2.get("/api/logbook/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const entry = await storage.getLogbookEntryById(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: "Logbook entry not found" });
      }
      if (entry.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(entry);
    } catch (error) {
      console.error("Failed to fetch logbook entry:", error);
      res.status(500).json({ error: "Failed to fetch logbook entry" });
    }
  });
  app2.patch("/api/logbook/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const existing = await storage.getLogbookEntryById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Logbook entry not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const result = insertLogbookEntrySchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const updateData = {
        ...result.data,
        flightDate: result.data.flightDate ? typeof result.data.flightDate === "string" ? new Date(result.data.flightDate) : result.data.flightDate : void 0
      };
      const entry = await storage.updateLogbookEntry(req.params.id, updateData);
      res.json(entry);
    } catch (error) {
      console.error("Failed to update logbook entry:", error);
      res.status(error.message?.includes("locked") ? 403 : 500).json({
        error: error.message || "Failed to update logbook entry"
      });
    }
  });
  app2.post("/api/logbook/:id/lock", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const existing = await storage.getLogbookEntryById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Logbook entry not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { signatureDataUrl, signedByName } = req.body;
      if (!signatureDataUrl || !signedByName) {
        return res.status(400).json({ error: "signatureDataUrl and signedByName are required" });
      }
      const entry = await storage.lockLogbookEntry(req.params.id, signatureDataUrl, signedByName);
      res.json(entry);
    } catch (error) {
      console.error("Failed to lock logbook entry:", error);
      res.status(error.message?.includes("locked") || error.message?.includes("not found") ? 400 : 500).json({
        error: error.message || "Failed to lock logbook entry"
      });
    }
  });
  app2.delete("/api/logbook/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const existing = await storage.getLogbookEntryById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Logbook entry not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const success = await storage.deleteLogbookEntry(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Logbook entry not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete logbook entry:", error);
      res.status(error.message?.includes("locked") ? 403 : 500).json({
        error: error.message || "Failed to delete logbook entry"
      });
    }
  });
  const httpServer = createServer(app2);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wss.on("connection", (ws2) => {
    console.log("WebSocket client connected");
    ws2.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === "chat" && message.rentalId) {
          const rental = await storage.getRental(message.rentalId);
          if (!rental || rental.status !== "active") {
            ws2.send(JSON.stringify({
              type: "error",
              message: "Messaging only available for active rentals"
            }));
            return;
          }
          await storage.createMessage({
            rentalId: message.rentalId,
            senderId: message.senderId,
            receiverId: message.receiverId || rental.ownerId,
            // Default to owner if not specified
            content: message.content
          });
          wss.clients.forEach((client2) => {
            if (client2.readyState === WebSocket.OPEN) {
              client2.send(JSON.stringify({
                type: "chat",
                rentalId: message.rentalId,
                senderId: message.senderId,
                content: message.content,
                timestamp: /* @__PURE__ */ new Date()
              }));
            }
          });
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });
    ws2.on("close", () => {
      console.log("WebSocket client disconnected");
    });
  });
  return httpServer;
}

// server/vite.ts
import express2 from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var isGitHubPages = process.env.GITHUB_PAGES === "true";
var vite_config_default = defineConfig(async () => {
  const replitPlugins = process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
    (await import("@replit/vite-plugin-cartographer")).cartographer(),
    (await import("@replit/vite-plugin-dev-banner")).devBanner()
  ] : [];
  return {
    plugins: [react(), runtimeErrorOverlay(), ...replitPlugins],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets")
      }
    },
    root: path.resolve(import.meta.dirname, "client"),
    // IMPORTANT:
    // Render expects dist/public (your server serves this)
    // GitHub Pages expects docs (because Pages can only serve / or /docs)
    build: {
      outDir: isGitHubPages ? path.resolve(import.meta.dirname, "docs") : path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true
    },
    // If you are using a custom domain on GitHub Pages (readysetfly.us),
    // base should be "/" (this is correct for a root domain).
    base: "/",
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"]
      },
      // During development, proxy API requests to the backend server
      proxy: {
        "/api": {
          target: "http://localhost:5000",
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express2.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname2(__filename2);
dotenv2.config({ path: join2(__dirname2, ".env") });
console.log("DATABASE_URL loaded?", !!process.env.DATABASE_URL);
var app = express3();
app.set("trust proxy", 1);
app.use(cors2({
  origin: process.env.NODE_ENV === "production" ? ["https://readysetfly.us", "https://www.readysetfly.us"] : ["http://localhost:5173", "http://localhost:5000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express3.json());
app.use(express3.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
