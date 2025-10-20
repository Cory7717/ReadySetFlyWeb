import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const certificationTypes = ["PPL", "IR", "CPL", "Multi-Engine", "ATP", "CFI", "CFII", "MEI"] as const;
export const aircraftCategories = ["Single-Engine", "Multi-Engine", "Jet", "Turboprop", "Helicopter", "Seaplane"] as const;
export const marketplaceCategories = ["aircraft-sale", "charter", "cfi", "flight-school", "mechanic", "job"] as const;
export const rentalStatuses = ["pending", "approved", "active", "completed", "cancelled"] as const;
export const listingTiers = ["basic", "standard", "premium"] as const;

// Users / Pilots
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  
  // Pilot information
  certifications: text("certifications").array().notNull().default(sql`ARRAY[]::text[]`),
  totalFlightHours: integer("total_flight_hours").default(0),
  aircraftTypesFlown: text("aircraft_types_flown").array().default(sql`ARRAY[]::text[]`),
  
  // Verification
  isVerified: boolean("is_verified").default(false),
  licenseVerified: boolean("license_verified").default(false),
  backgroundCheckCompleted: boolean("background_check_completed").default(false),
  
  // Bank/payout information
  bankAccountConnected: boolean("bank_account_connected").default(false),
  stripeAccountId: text("stripe_account_id"),
  
  createdAt: timestamp("created_at").defaultNow(),
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
  
  // Location
  location: text("location").notNull(),
  airportCode: text("airport_code"),
  
  // Listing details
  description: text("description"),
  isListed: boolean("is_listed").default(true),
  
  // Owner metrics
  responseTime: integer("response_time_hours").default(24),
  acceptanceRate: integer("acceptance_rate").default(100),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  location: text("location"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  
  // Category-specific data (stored as JSON)
  details: jsonb("details"), // Contains category-specific fields
  
  // Pricing
  price: decimal("price", { precision: 12, scale: 2 }), // For sales, hourly rate, etc.
  
  // Listing management
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  
  // Payment
  isPaid: boolean("is_paid").default(false),
  monthlyFee: decimal("monthly_fee", { precision: 10, scale: 2 }),
  
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
  platformFeeRenter: decimal("platform_fee_renter", { precision: 10, scale: 2 }).notNull(), // 7.5%
  platformFeeOwner: decimal("platform_fee_owner", { precision: 10, scale: 2 }).notNull(), // 7.5%
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

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  certifications: z.array(z.enum(certificationTypes)).default([]),
  totalFlightHours: z.number().min(0).default(0),
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
});

export const insertMarketplaceListingSchema = createInsertSchema(marketplaceListings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  category: z.enum(marketplaceCategories),
  images: z.array(z.string()).max(15),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  monthlyFee: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export const insertRentalSchema = createInsertSchema(rentals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  actualHours: true,
  status: true,
  isPaid: true,
  payoutCompleted: true,
}).extend({
  estimatedHours: z.string().regex(/^\d+(\.\d{1,2})?$/),
  hourlyRate: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  isRead: true,
});

// Select types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type AircraftListing = typeof aircraftListings.$inferSelect;
export type InsertAircraftListing = z.infer<typeof insertAircraftListingSchema>;

export type MarketplaceListing = typeof marketplaceListings.$inferSelect;
export type InsertMarketplaceListing = z.infer<typeof insertMarketplaceListingSchema>;

export type Rental = typeof rentals.$inferSelect;
export type InsertRental = z.infer<typeof insertRentalSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Transaction = typeof transactions.$inferSelect;

// Certification types
export type CertificationType = typeof certificationTypes[number];
export type AircraftCategory = typeof aircraftCategories[number];
export type MarketplaceCategory = typeof marketplaceCategories[number];
export type RentalStatus = typeof rentalStatuses[number];
