import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, decimal, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const certificationTypes = ["PPL", "IR", "CPL", "Multi-Engine", "ATP", "CFI", "CFII", "MEI"] as const;
export const aircraftCategories = ["Single-Engine", "Multi-Engine", "Jet", "Turboprop", "Helicopter", "Seaplane"] as const;
export const engineTypes = ["Single-Engine", "Multi-Engine", "Turboprop", "Jet", "Rotor"] as const;
export const marketplaceCategories = ["aircraft-sale", "charter", "cfi", "flight-school", "mechanic", "job"] as const;
export const rentalStatuses = ["pending", "approved", "active", "completed", "cancelled"] as const;
export const listingTiers = ["basic", "standard", "premium"] as const;
export const leadStatuses = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"] as const;
export const dealStages = ["lead", "prospect", "proposal", "negotiation", "closed_won", "closed_lost"] as const;
export const activityTypes = ["call", "email", "meeting", "note", "task"] as const;
export const leadSources = ["website", "referral", "social_media", "advertising", "cold_outreach", "event", "other"] as const;
export const expenseCategories = ["server", "database", "storage", "api", "other"] as const;
export const withdrawalStatuses = ["pending", "processing", "completed", "failed", "cancelled"] as const;

// Session storage table (REQUIRED for Replit Auth - from blueprint:javascript_log_in_with_replit)
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
export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  deviceInfo: text("device_info"), // Store device fingerprint for security
  ipAddress: text("ip_address"),
}, (table) => [
  index("idx_refresh_tokens_user").on(table.userId),
  index("idx_refresh_tokens_expires").on(table.expiresAt),
]);

// OAuth Exchange Tokens (for mobile OAuth flow - temporary tokens to exchange for JWT)
export const oauthExchangeTokens = pgTable("oauth_exchange_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_oauth_exchange_tokens_token").on(table.token),
  index("idx_oauth_exchange_tokens_expires").on(table.expiresAt),
]);

// Users / Pilots (Merged with Replit Auth requirements - from blueprint:javascript_log_in_with_replit)
export const users = pgTable("users", {
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
  dateOfBirth: text("date_of_birth"), // YYYY-MM-DD
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
  faaVerifiedMonth: text("faa_verified_month"), // MM/YYYY format
  faaVerifiedAt: timestamp("faa_verified_at"),
  
  // Bank/payout information
  bankAccountConnected: boolean("bank_account_connected").default(false),
  stripeAccountId: text("stripe_account_id"),
  paypalEmail: text("paypal_email"), // For PayPal Payouts
  
  // Balance tracking (for owner payouts)
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0.00"),
  
  // Mobile app authentication (optional - for users who sign up via mobile)
  hashedPassword: text("hashed_password"), // bcrypt hash, null for Replit Auth only users
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
  suspendedBy: varchar("suspended_by").references(() => users.id), // admin who suspended
  
  // Timestamps (from blueprint)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Aircraft Listings (for rent)
export const aircraftListings = pgTable("aircraft_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
  
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
}, (table) => [
  index("idx_aircraft_city").on(table.city),
  index("idx_aircraft_is_listed").on(table.isListed),
  index("idx_aircraft_category").on(table.category),
  index("idx_aircraft_engine_type").on(table.engineType),
  index("idx_aircraft_city_engine_type").on(table.city, table.engineType),
  index("idx_aircraft_category_city").on(table.category, table.city),
]);

// Marketplace Listings
export const marketplaceListings = pgTable("marketplace_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  category: text("category").notNull(), // aircraft-sale, charter, cfi, flight-school, mechanic, job
  tier: text("tier"), // basic, standard, premium (for aircraft sales)
  
  // Common fields
  title: text("title").notNull(),
  description: text("description").notNull(),
  images: text("images").array().default(sql`ARRAY[]::text[]`),
  
  // Location (structured for filtering)
  location: text("location"), // Legacy field for display
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  
  // Category-specific data (stored as JSON)
  details: jsonb("details"), // Contains category-specific fields
  
  // Pricing
  price: decimal("price", { precision: 12, scale: 2 }), // For sales, hourly rate, etc.
  
  // Listing management
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  
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
  
  // Promotional free period (admin customer service gesture)
  promoFreeUntil: timestamp("promo_free_until"),
  promoGrantedBy: varchar("promo_granted_by").references(() => users.id),
  promoGrantedAt: timestamp("promo_granted_at"),
  
  // Stale listing tracking
  lastRefreshedAt: timestamp("last_refreshed_at").defaultNow(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_marketplace_category").on(table.category),
  index("idx_marketplace_city").on(table.city),
  index("idx_marketplace_is_active").on(table.isActive),
  index("idx_marketplace_category_city").on(table.category, table.city),
  index("idx_marketplace_category_active").on(table.category, table.isActive),
  index("idx_marketplace_flag_count").on(table.flagCount),
]);

// Marketplace Flags (fraud reporting)
export const marketplaceFlags = pgTable("marketplace_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listingId: varchar("listing_id").notNull().references(() => marketplaceListings.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  reason: text("reason"), // Optional reason for flagging
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Unique constraint: one flag per user per listing
  index("idx_marketplace_flags_unique").on(table.listingId, table.userId),
]);

// Job Applications (for marketplace job listings)
export const jobApplications = pgTable("job_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listingId: varchar("listing_id").notNull().references(() => marketplaceListings.id, { onDelete: "cascade" }),
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
}, (table) => [
  index("idx_job_applications_listing").on(table.listingId),
  index("idx_job_applications_applicant").on(table.applicantId),
  index("idx_job_applications_status").on(table.status),
]);

// Promotional Alerts (for admin-managed marketplace announcements)
export const promoAlerts = pgTable("promo_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Alert details
  title: text("title").notNull(),
  message: text("message").notNull(),
  promoCode: text("promo_code"), // Optional promo code to display
  
  // Display settings
  isEnabled: boolean("is_enabled").default(true),
  showOnMainPage: boolean("show_on_main_page").default(true),
  showOnCategoryPages: boolean("show_on_category_pages").default(true),
  
  // Target categories (empty = all categories)
  targetCategories: text("target_categories").array().default(sql`ARRAY[]::text[]`),
  
  // Styling
  variant: text("variant").default("info"), // info, success, warning, destructive
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Rentals
export const rentals = pgTable("rentals", {
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
  salesTax: decimal("sales_tax", { precision: 10, scale: 2 }).notNull(), // 8.25% of baseCost
  platformFeeRenter: decimal("platform_fee_renter", { precision: 10, scale: 2 }).notNull(), // 7.5% of baseCost
  platformFeeOwner: decimal("platform_fee_owner", { precision: 10, scale: 2 }).notNull(), // 7.5% of baseCost
  processingFee: decimal("processing_fee", { precision: 10, scale: 2 }).notNull(), // 3% of subtotal
  totalCostRenter: decimal("total_cost_renter", { precision: 10, scale: 2 }).notNull(),
  ownerPayout: decimal("owner_payout", { precision: 10, scale: 2 }).notNull(),
  
  // Status
  status: text("status").notNull().default("pending"), // pending, approved, active, completed, cancelled
  
  // Payment
  isPaid: boolean("is_paid").default(false),
  payoutCompleted: boolean("payout_completed").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Messages (only during active rentals)
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rentalId: varchar("rental_id").notNull().references(() => rentals.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  receiverId: varchar("receiver_id").notNull().references(() => users.id),
  
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Reviews (post-rental ratings and feedback)
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rentalId: varchar("rental_id").notNull().references(() => rentals.id),
  reviewerId: varchar("reviewer_id").notNull().references(() => users.id), // Who wrote the review
  revieweeId: varchar("reviewee_id").notNull().references(() => users.id), // Who is being reviewed
  
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

// Transactions (financial tracking)
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  type: text("type").notNull(), // rental_payout, listing_fee, platform_fee
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  
  // Related entities
  rentalId: varchar("rental_id").references(() => rentals.id),
  marketplaceListingId: varchar("marketplace_listing_id").references(() => marketplaceListings.id),
  
  // Status
  status: text("status").notNull().default("pending"), // pending, completed, failed
  depositedToBankAt: timestamp("deposited_to_bank_at"),
  
  description: text("description"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Withdrawal Requests (PayPal Payouts for aircraft owners)
export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
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
}, (table) => [
  index("idx_withdrawal_user").on(table.userId),
  index("idx_withdrawal_status").on(table.status),
]);

// Promo Codes (for free/discounted listings)
export const promoCodes = pgTable("promo_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  
  // Promo details
  description: text("description"),
  discountType: text("discount_type").notNull(), // "free_7_day", "percentage", "fixed_amount"
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }), // For percentage or fixed amount
  
  // Usage limits
  maxUses: integer("max_uses"), // null = unlimited
  usedCount: integer("used_count").default(0),
  
  // Validity
  isActive: boolean("is_active").default(true),
  validFrom: timestamp("valid_from").defaultNow(),
  validUntil: timestamp("valid_until"),
  
  // Restrictions
  applicableCategories: text("applicable_categories").array().default(sql`ARRAY[]::text[]`), // empty = all categories
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Promo Code Usage Tracking
export const promoCodeUsages = pgTable("promo_code_usages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promoCodeId: varchar("promo_code_id").notNull().references(() => promoCodes.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  marketplaceListingId: varchar("marketplace_listing_id").references(() => marketplaceListings.id),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Expenses (for admin analytics tracking)
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
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

// Verification Submissions (admin review queue)
export const verificationSubmissions = pgTable("verification_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Type of verification
  type: text("type").notNull(), // renter_identity, renter_payment, renter_pilot, owner_aircraft, owner_maintenance
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  
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
  sources: text("sources").array().default(sql`ARRAY[]::text[]`), // e.g., ["FAA Aircraft Registry", "FAA Airmen Database"]
  fileHashes: text("file_hashes").array().default(sql`ARRAY[]::text[]`), // SHA-256 hashes of uploaded files
  
  // Document expiration tracking
  pilotLicenseExpiresAt: timestamp("pilot_license_expires_at"),
  medicalCertExpiresAt: timestamp("medical_cert_expires_at"),
  insuranceExpiresAt: timestamp("insurance_expires_at"),
  governmentIdExpiresAt: timestamp("government_id_expires_at"),
  
  // Expiration notifications
  expirationNotificationSent: boolean("expiration_notification_sent").default(false),
  lastNotificationSentAt: timestamp("last_notification_sent_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CRM Tables (Sales & Marketing)
export const crmLeads = pgTable("crm_leads", {
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
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const crmContacts = pgTable("crm_contacts", {
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
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const crmDeals = pgTable("crm_deals", {
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
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const crmActivities = pgTable("crm_activities", {
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
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  certifications: z.array(z.enum(certificationTypes)).default([]),
  totalFlightHours: z.number().min(0).default(0),
});

export const insertRefreshTokenSchema = createInsertSchema(refreshTokens).omit({
  id: true,
  createdAt: true,
});

export const insertOAuthExchangeTokenSchema = createInsertSchema(oauthExchangeTokens).omit({
  id: true,
  createdAt: true,
});

export const insertAircraftListingSchema = createInsertSchema(aircraftListings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  year: z.number().min(1900).max(new Date().getFullYear() + 1),
  totalTime: z.number().min(0),
  hourlyRate: z.string().regex(/^\d+(\.\d{1,2})?$/),
  requiredCertifications: z.array(z.string()).min(1),
  images: z.array(z.string()).min(1).max(15),
  engineType: z.enum(engineTypes).optional(),
  engineCount: z.number().min(1).max(8).optional(),
  seatingCapacity: z.number().min(1).max(20).optional(),
  latitude: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
  longitude: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
});

export const insertMarketplaceListingSchema = createInsertSchema(marketplaceListings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  flagCount: true, // Managed by the system
  viewCount: true, // Managed by the system
}).extend({
  category: z.enum(marketplaceCategories),
  images: z.array(z.string()).max(15),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  monthlyFee: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  latitude: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
  longitude: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
});

export const insertMarketplaceFlagSchema = createInsertSchema(marketplaceFlags).omit({
  id: true,
  createdAt: true,
});

export const insertRentalSchema = createInsertSchema(rentals).omit({
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
}).extend({
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

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  rating: z.number().min(1).max(5),
  communicationRating: z.number().min(1).max(5).optional(),
  cleanlinessRating: z.number().min(1).max(5).optional(),
  accuracyRating: z.number().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
});

export const insertCrmLeadSchema = createInsertSchema(crmLeads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  convertedToContactId: true,
  convertedToDealId: true,
  convertedAt: true,
}).extend({
  status: z.enum(leadStatuses).default("new"),
  source: z.enum(leadSources).optional(),
  value: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
});

export const insertCrmContactSchema = createInsertSchema(crmContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCrmDealSchema = createInsertSchema(crmDeals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  stage: z.enum(dealStages).default("lead"),
  value: z.string().regex(/^\d+(\.\d{1,2})?$/),
  probability: z.number().min(0).max(100).default(50),
});

export const insertCrmActivitySchema = createInsertSchema(crmActivities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isCompleted: true,
  completedAt: true,
}).extend({
  type: z.enum(activityTypes),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  category: z.enum(expenseCategories),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  expenseDate: z.coerce.date().optional(),
  invoiceUrl: z.string().optional(),
});

export const insertJobApplicationSchema = createInsertSchema(jobApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  employerNotes: true,
}).extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  coverLetter: z.string().optional(),
  resumeUrl: z.string().min(1, "Resume is required"),
});

export const insertPromoAlertSchema = createInsertSchema(promoAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message is required"),
  promoCode: z.string().optional(),
  variant: z.enum(["info", "success", "warning", "destructive"]).default("info"),
});

export const insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests).omit({
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
}).extend({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid number"),
  paypalEmail: z.string().email("Valid PayPal email is required"),
});

// Select types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert; // For Replit Auth (from blueprint:javascript_log_in_with_replit)

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = z.infer<typeof insertRefreshTokenSchema>;

export type OAuthExchangeToken = typeof oauthExchangeTokens.$inferSelect;
export type InsertOAuthExchangeToken = z.infer<typeof insertOAuthExchangeTokenSchema>;

export type AircraftListing = typeof aircraftListings.$inferSelect;
export type InsertAircraftListing = z.infer<typeof insertAircraftListingSchema>;

export type MarketplaceListing = typeof marketplaceListings.$inferSelect;
export type InsertMarketplaceListing = z.infer<typeof insertMarketplaceListingSchema>;

export type Rental = typeof rentals.$inferSelect;
export type InsertRental = z.infer<typeof insertRentalSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type Transaction = typeof transactions.$inferSelect;

export type VerificationSubmission = typeof verificationSubmissions.$inferSelect;
export type InsertVerificationSubmission = Omit<VerificationSubmission, 'id' | 'createdAt' | 'updatedAt'>;

export type CrmLead = typeof crmLeads.$inferSelect;
export type InsertCrmLead = z.infer<typeof insertCrmLeadSchema>;

export type CrmContact = typeof crmContacts.$inferSelect;
export type InsertCrmContact = z.infer<typeof insertCrmContactSchema>;

export type CrmDeal = typeof crmDeals.$inferSelect;
export type InsertCrmDeal = z.infer<typeof insertCrmDealSchema>;

export type CrmActivity = typeof crmActivities.$inferSelect;
export type InsertCrmActivity = z.infer<typeof insertCrmActivitySchema>;

export type PromoCode = typeof promoCodes.$inferSelect;
export type InsertPromoCode = typeof promoCodes.$inferInsert;

export type PromoCodeUsage = typeof promoCodeUsages.$inferSelect;
export type InsertPromoCodeUsage = typeof promoCodeUsages.$inferInsert;

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

export type JobApplication = typeof jobApplications.$inferSelect;
export type InsertJobApplication = z.infer<typeof insertJobApplicationSchema>;

export type PromoAlert = typeof promoAlerts.$inferSelect;
export type InsertPromoAlert = z.infer<typeof insertPromoAlertSchema>;

export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type InsertWithdrawalRequest = z.infer<typeof insertWithdrawalRequestSchema>;

// Enum types
export type CertificationType = typeof certificationTypes[number];
export type AircraftCategory = typeof aircraftCategories[number];
export type EngineType = typeof engineTypes[number];
export type MarketplaceCategory = typeof marketplaceCategories[number];
export type RentalStatus = typeof rentalStatuses[number];
export type LeadStatus = typeof leadStatuses[number];
export type DealStage = typeof dealStages[number];
export type ActivityType = typeof activityTypes[number];
export type LeadSource = typeof leadSources[number];
export type ExpenseCategory = typeof expenseCategories[number];
export type WithdrawalStatus = typeof withdrawalStatuses[number];
