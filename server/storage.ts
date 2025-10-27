import {
  type User,
  type UpsertUser,
  type InsertUser,
  type AircraftListing,
  type InsertAircraftListing,
  type MarketplaceListing,
  type InsertMarketplaceListing,
  type Rental,
  type InsertRental,
  type Message,
  type InsertMessage,
  type Review,
  type InsertReview,
  type Transaction,
  type VerificationSubmission,
  type InsertVerificationSubmission,
  type CrmLead,
  type InsertCrmLead,
  type CrmContact,
  type InsertCrmContact,
  type CrmDeal,
  type InsertCrmDeal,
  type CrmActivity,
  type InsertCrmActivity,
  type Expense,
  type InsertExpense,
  type JobApplication,
  type InsertJobApplication,
  type PromoAlert,
  type InsertPromoAlert,
  users,
  aircraftListings,
  marketplaceListings,
  marketplaceFlags,
  rentals,
  messages,
  reviews,
  transactions,
  verificationSubmissions,
  crmLeads,
  crmContacts,
  crmDeals,
  crmActivities,
  expenses,
  jobApplications,
  promoAlerts,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, or, ilike, gte, lte, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>; // REQUIRED for Replit Auth
  searchUsers(query: string): Promise<User[]>; // Admin search by name

  // Aircraft Listings
  getAircraftListing(id: string): Promise<AircraftListing | undefined>;
  getAllAircraftListings(): Promise<AircraftListing[]>;
  getAircraftListingsByOwner(ownerId: string): Promise<AircraftListing[]>;
  createAircraftListing(listing: InsertAircraftListing): Promise<AircraftListing>;
  updateAircraftListing(id: string, updates: Partial<AircraftListing>): Promise<AircraftListing | undefined>;
  deleteAircraftListing(id: string): Promise<boolean>;
  toggleAircraftListingStatus(id: string): Promise<AircraftListing | undefined>;

  // Marketplace Listings
  getMarketplaceListing(id: string): Promise<MarketplaceListing | undefined>;
  getAllMarketplaceListings(): Promise<MarketplaceListing[]>;
  getMarketplaceListingsByCategory(category: string): Promise<MarketplaceListing[]>;
  getMarketplaceListingsByUser(userId: string): Promise<MarketplaceListing[]>;
  getFilteredMarketplaceListings(filters: {
    city?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    engineType?: string;
    keyword?: string;
    radius?: number;
  }): Promise<MarketplaceListing[]>;
  createMarketplaceListing(listing: InsertMarketplaceListing): Promise<MarketplaceListing>;
  updateMarketplaceListing(id: string, updates: Partial<MarketplaceListing>): Promise<MarketplaceListing | undefined>;
  deleteMarketplaceListing(id: string): Promise<boolean>;
  deactivateExpiredListings(): Promise<{ deactivatedCount: number }>;
  
  // Marketplace Flags
  flagMarketplaceListing(listingId: string, userId: string, reason?: string): Promise<{ success: boolean; flagCount: number }>;
  checkIfUserFlaggedListing(listingId: string, userId: string): Promise<boolean>;
  getFlaggedMarketplaceListings(): Promise<MarketplaceListing[]>; // Get listings with 5+ flags

  // Rentals
  getRental(id: string): Promise<Rental | undefined>;
  getAllRentals(): Promise<Rental[]>;
  getRentalsByRenter(renterId: string): Promise<Rental[]>;
  getRentalsByOwner(ownerId: string): Promise<Rental[]>;
  getRentalsByAircraft(aircraftId: string): Promise<Rental[]>;
  createRental(rental: InsertRental): Promise<Rental>;
  updateRental(id: string, updates: Partial<Rental>): Promise<Rental | undefined>;
  
  // Messages
  getMessagesByRental(rentalId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: string): Promise<Message | undefined>;

  // Reviews
  getReviewsByUser(userId: string): Promise<Review[]>; // Get all reviews for a user (as reviewee)
  getReviewsByRental(rentalId: string): Promise<Review[]>; // Get reviews for a specific rental
  createReview(review: InsertReview): Promise<Review>;
  hasUserReviewedRental(rentalId: string, reviewerId: string): Promise<boolean>;

  // Transactions
  getTransactionsByUser(userId: string): Promise<Transaction[]>;
  createTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction>;
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined>;

  // Verification Submissions
  createVerificationSubmission(submission: InsertVerificationSubmission): Promise<VerificationSubmission>;
  getVerificationSubmissionsByUser(userId: string): Promise<VerificationSubmission[]>;
  getPendingVerificationSubmissions(): Promise<VerificationSubmission[]>;
  updateVerificationSubmission(id: string, updates: Partial<VerificationSubmission>): Promise<VerificationSubmission | undefined>;
  
  // Analytics
  getAnalytics(): Promise<{
    transactionsToday: number;
    transactionsWeek: number;
    transactionsMonth: number;
    transactionsYear: number;
    revenueToday: string;
    revenueWeek: string;
    revenueMonth: string;
    revenueYear: string;
    expensesToday: string;
    expensesWeek: string;
    expensesMonth: string;
    expensesYear: string;
    profitToday: string;
    profitWeek: string;
    profitMonth: string;
    profitYear: string;
    profitMarginToday: string;
    profitMarginWeek: string;
    profitMarginMonth: string;
    profitMarginYear: string;
    totalRentals: number;
    activeRentals: number;
  }>;

  // CRM - Leads
  getAllLeads(): Promise<CrmLead[]>;
  getLead(id: string): Promise<CrmLead | undefined>;
  createLead(lead: InsertCrmLead): Promise<CrmLead>;
  updateLead(id: string, updates: Partial<CrmLead>): Promise<CrmLead | undefined>;
  deleteLead(id: string): Promise<boolean>;

  // CRM - Contacts
  getAllContacts(): Promise<CrmContact[]>;
  getContact(id: string): Promise<CrmContact | undefined>;
  createContact(contact: InsertCrmContact): Promise<CrmContact>;
  updateContact(id: string, updates: Partial<CrmContact>): Promise<CrmContact | undefined>;
  deleteContact(id: string): Promise<boolean>;

  // CRM - Deals
  getAllDeals(): Promise<CrmDeal[]>;
  getDeal(id: string): Promise<CrmDeal | undefined>;
  createDeal(deal: InsertCrmDeal): Promise<CrmDeal>;
  updateDeal(id: string, updates: Partial<CrmDeal>): Promise<CrmDeal | undefined>;
  deleteDeal(id: string): Promise<boolean>;

  // CRM - Activities
  getAllActivities(): Promise<CrmActivity[]>;
  getActivity(id: string): Promise<CrmActivity | undefined>;
  createActivity(activity: InsertCrmActivity): Promise<CrmActivity>;
  updateActivity(id: string, updates: Partial<CrmActivity>): Promise<CrmActivity | undefined>;
  deleteActivity(id: string): Promise<boolean>;
  
  // Expenses (for admin analytics)
  getAllExpenses(): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, updates: Partial<Expense>): Promise<Expense | undefined>;
  
  // Job Applications
  createJobApplication(application: InsertJobApplication): Promise<JobApplication>;
  getJobApplicationsByListing(listingId: string): Promise<JobApplication[]>;
  getJobApplicationsByApplicant(applicantId: string): Promise<JobApplication[]>;
  getJobApplication(id: string): Promise<JobApplication | undefined>;
  updateJobApplication(id: string, updates: Partial<JobApplication>): Promise<JobApplication | undefined>;
  deleteExpense(id: string): Promise<boolean>;

  // Promo Alerts
  getActivePromoAlerts(): Promise<PromoAlert[]>;
  getAllPromoAlerts(): Promise<PromoAlert[]>;
  getPromoAlert(id: string): Promise<PromoAlert | undefined>;
  createPromoAlert(alert: InsertPromoAlert): Promise<PromoAlert>;
  updatePromoAlert(id: string, updates: Partial<PromoAlert>): Promise<PromoAlert | undefined>;
  deletePromoAlert(id: string): Promise<boolean>;
  
  // Marketplace Listing Promotional Free Time
  grantMarketplacePromoFreeTime(listingId: string, durationDays: number, adminId: string): Promise<MarketplaceListing | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    if (!userData.id) {
      throw new Error("User ID is required for upsert");
    }
    
    // First, try to find existing user by ID (primary key from OIDC sub claim)
    let existingUser = await this.getUser(userData.id);
    
    // If not found by ID, try by email (for migration from old auth system)
    if (!existingUser && userData.email) {
      existingUser = await this.getUserByEmail(userData.email);
    }
    
    if (existingUser) {
      // Update existing user with new data (excluding ID to avoid primary key conflicts)
      const { id, ...updateData } = userData;
      const [user] = await db
        .update(users)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();
      return user;
    } else {
      // Create new user
      const [user] = await db
        .insert(users)
        .values(userData)
        .returning();
      return user;
    }
  }

  async searchUsers(query: string): Promise<User[]> {
    const searchPattern = `%${query}%`;
    return await db
      .select()
      .from(users)
      .where(
        or(
          ilike(users.firstName, searchPattern),
          ilike(users.lastName, searchPattern),
          ilike(users.email, searchPattern)
        )
      )
      .limit(50);
  }

  // Aircraft Listings
  async getAircraftListing(id: string): Promise<AircraftListing | undefined> {
    const result = await db
      .select()
      .from(aircraftListings)
      .where(eq(aircraftListings.id, id))
      .limit(1);
    return result[0];
  }

  async getAllAircraftListings(): Promise<AircraftListing[]> {
    return await db
      .select()
      .from(aircraftListings)
      .where(eq(aircraftListings.isListed, true));
  }

  async getAircraftListingsByOwner(ownerId: string): Promise<AircraftListing[]> {
    return await db
      .select()
      .from(aircraftListings)
      .where(eq(aircraftListings.ownerId, ownerId));
  }

  async createAircraftListing(insertListing: InsertAircraftListing): Promise<AircraftListing> {
    const [listing] = await db
      .insert(aircraftListings)
      .values(insertListing)
      .returning();
    return listing;
  }

  async updateAircraftListing(id: string, updates: Partial<AircraftListing>): Promise<AircraftListing | undefined> {
    const [listing] = await db
      .update(aircraftListings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aircraftListings.id, id))
      .returning();
    return listing;
  }

  async deleteAircraftListing(id: string): Promise<boolean> {
    const result = await db
      .delete(aircraftListings)
      .where(eq(aircraftListings.id, id))
      .returning();
    return result.length > 0;
  }

  async toggleAircraftListingStatus(id: string): Promise<AircraftListing | undefined> {
    const listing = await this.getAircraftListing(id);
    if (!listing) return undefined;
    
    const [updated] = await db
      .update(aircraftListings)
      .set({ 
        isListed: !listing.isListed,
        updatedAt: new Date()
      })
      .where(eq(aircraftListings.id, id))
      .returning();
    return updated;
  }

  // Marketplace Listings
  async getMarketplaceListing(id: string): Promise<MarketplaceListing | undefined> {
    const result = await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.id, id))
      .limit(1);
    return result[0];
  }

  async getAllMarketplaceListings(): Promise<MarketplaceListing[]> {
    return await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.isActive, true));
  }

  async getMarketplaceListingsByCategory(category: string): Promise<MarketplaceListing[]> {
    return await db
      .select()
      .from(marketplaceListings)
      .where(
        and(
          eq(marketplaceListings.category, category),
          eq(marketplaceListings.isActive, true)
        )
      );
  }

  async getMarketplaceListingsByUser(userId: string): Promise<MarketplaceListing[]> {
    return await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.userId, userId));
  }

  async getFilteredMarketplaceListings(filters: {
    city?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    engineType?: string;
    keyword?: string;
    radius?: number;
  }): Promise<MarketplaceListing[]> {
    const conditions: any[] = [eq(marketplaceListings.isActive, true)];

    // Category filter
    if (filters.category) {
      conditions.push(eq(marketplaceListings.category, filters.category));
    }

    // City filter (case-insensitive partial match)
    if (filters.city) {
      conditions.push(ilike(marketplaceListings.city, `%${filters.city}%`));
    }

    // Keyword search (search in title and description)
    if (filters.keyword) {
      conditions.push(
        or(
          ilike(marketplaceListings.title, `%${filters.keyword}%`),
          ilike(marketplaceListings.description, `%${filters.keyword}%`)
        )
      );
    }

    // Price range filters (cast string price to numeric for proper comparison)
    if (filters.minPrice !== undefined) {
      conditions.push(sql`CAST(${marketplaceListings.price} AS NUMERIC) >= ${filters.minPrice}`);
    }
    if (filters.maxPrice !== undefined) {
      conditions.push(sql`CAST(${marketplaceListings.price} AS NUMERIC) <= ${filters.maxPrice}`);
    }

    // Note: Radius filtering requires geocoding service to convert city to coordinates
    // and calculate distances. This is a placeholder for future implementation.
    // For now, the radius parameter is accepted but not actively filtered.
    // TODO: Implement proper distance-based filtering with geocoding service

    // Engine type filter (for aircraft categories, stored in details JSONB)
    // This requires a JSON path query which is more complex with Drizzle
    // For now, we'll fetch all and filter in memory for engineType
    // TODO: Optimize with raw SQL or JSONB operators in future

    const results = await db
      .select()
      .from(marketplaceListings)
      .where(and(...conditions));

    // Post-filter for engineType in details JSONB
    if (filters.engineType && filters.engineType !== 'all') {
      return results.filter((listing) => {
        const details = listing.details as any;
        return details?.engineType === filters.engineType;
      });
    }

    return results;
  }

  async createMarketplaceListing(insertListing: InsertMarketplaceListing): Promise<MarketplaceListing> {
    const [listing] = await db
      .insert(marketplaceListings)
      .values(insertListing)
      .returning();
    return listing;
  }

  async updateMarketplaceListing(id: string, updates: Partial<MarketplaceListing>): Promise<MarketplaceListing | undefined> {
    const [listing] = await db
      .update(marketplaceListings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(marketplaceListings.id, id))
      .returning();
    return listing;
  }

  async deleteMarketplaceListing(id: string): Promise<boolean> {
    const result = await db
      .delete(marketplaceListings)
      .where(eq(marketplaceListings.id, id))
      .returning();
    return result.length > 0;
  }

  async deactivateExpiredListings(): Promise<{ deactivatedCount: number }> {
    // Calculate grace period end: 3 days after expiration
    const gracePeriodEnd = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000));
    
    // Find and deactivate listings where expiresAt + 3 days < now
    // Only deactivate if expiresAt is not null and isActive is true
    const result = await db
      .update(marketplaceListings)
      .set({ 
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(marketplaceListings.isActive, true),
          sql`${marketplaceListings.expiresAt} < ${gracePeriodEnd}`
        )
      )
      .returning();
    
    return { deactivatedCount: result.length };
  }

  // Marketplace Flags
  async flagMarketplaceListing(listingId: string, userId: string, reason?: string): Promise<{ success: boolean; flagCount: number }> {
    // Check if user already flagged this listing
    const existingFlag = await db
      .select()
      .from(marketplaceFlags)
      .where(
        and(
          eq(marketplaceFlags.listingId, listingId),
          eq(marketplaceFlags.userId, userId)
        )
      )
      .limit(1);

    if (existingFlag.length > 0) {
      // User already flagged this listing
      const listing = await this.getMarketplaceListing(listingId);
      return { success: false, flagCount: listing?.flagCount || 0 };
    }

    // Create the flag
    await db.insert(marketplaceFlags).values({
      listingId,
      userId,
      reason: reason || null,
    });

    // Increment the flag count
    const [updatedListing] = await db
      .update(marketplaceListings)
      .set({
        flagCount: sql`${marketplaceListings.flagCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceListings.id, listingId))
      .returning();

    return { success: true, flagCount: updatedListing?.flagCount || 0 };
  }

  async checkIfUserFlaggedListing(listingId: string, userId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(marketplaceFlags)
      .where(
        and(
          eq(marketplaceFlags.listingId, listingId),
          eq(marketplaceFlags.userId, userId)
        )
      )
      .limit(1);
    return result.length > 0;
  }

  async getFlaggedMarketplaceListings(): Promise<MarketplaceListing[]> {
    // Get all listings with 5 or more flags
    return await db
      .select()
      .from(marketplaceListings)
      .where(gte(marketplaceListings.flagCount, 5))
      .orderBy(desc(marketplaceListings.flagCount));
  }

  // Rentals
  async getRental(id: string): Promise<Rental | undefined> {
    const result = await db
      .select()
      .from(rentals)
      .where(eq(rentals.id, id))
      .limit(1);
    return result[0];
  }

  async getAllRentals(): Promise<Rental[]> {
    return await db.select().from(rentals);
  }

  async getRentalsByRenter(renterId: string): Promise<Rental[]> {
    return await db
      .select()
      .from(rentals)
      .where(eq(rentals.renterId, renterId));
  }

  async getRentalsByOwner(ownerId: string): Promise<Rental[]> {
    return await db
      .select()
      .from(rentals)
      .where(eq(rentals.ownerId, ownerId));
  }

  async getRentalsByAircraft(aircraftId: string): Promise<Rental[]> {
    return await db
      .select()
      .from(rentals)
      .where(eq(rentals.aircraftId, aircraftId));
  }

  async createRental(insertRental: InsertRental): Promise<Rental> {
    const hourlyRate = parseFloat(insertRental.hourlyRate);
    const estimatedHours = parseFloat(insertRental.estimatedHours);
    
    // Calculate base cost
    const baseCost = hourlyRate * estimatedHours;
    
    // Calculate fees and taxes
    const salesTax = baseCost * 0.0825; // 8.25% sales tax
    const platformFeeRenter = baseCost * 0.075; // 7.5% platform fee for renter
    const platformFeeOwner = baseCost * 0.075; // 7.5% platform fee for owner
    
    // Calculate subtotal before processing fee
    const subtotal = baseCost + salesTax + platformFeeRenter;
    
    // Calculate processing fee (3% of subtotal)
    const processingFee = subtotal * 0.03;
    
    // Calculate total cost to renter (includes all fees and taxes)
    const totalCostRenter = subtotal + processingFee;
    
    // Calculate owner payout (base cost minus platform fee)
    const ownerPayout = baseCost - platformFeeOwner;

    const [rental] = await db
      .insert(rentals)
      .values({
        ...insertRental,
        baseCost: baseCost.toFixed(2),
        salesTax: salesTax.toFixed(2),
        platformFeeRenter: platformFeeRenter.toFixed(2),
        platformFeeOwner: platformFeeOwner.toFixed(2),
        processingFee: processingFee.toFixed(2),
        totalCostRenter: totalCostRenter.toFixed(2),
        ownerPayout: ownerPayout.toFixed(2),
      })
      .returning();
    return rental;
  }

  async updateRental(id: string, updates: Partial<Rental>): Promise<Rental | undefined> {
    const [rental] = await db
      .update(rentals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(rentals.id, id))
      .returning();
    return rental;
  }

  // Messages
  async getMessagesByRental(rentalId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.rentalId, rentalId))
      .orderBy(asc(messages.createdAt));
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async markMessageAsRead(id: string): Promise<Message | undefined> {
    const [message] = await db
      .update(messages)
      .set({ isRead: true })
      .where(eq(messages.id, id))
      .returning();
    return message;
  }

  // Reviews
  async getReviewsByUser(userId: string): Promise<Review[]> {
    return await db
      .select()
      .from(reviews)
      .where(eq(reviews.revieweeId, userId))
      .orderBy(desc(reviews.createdAt));
  }

  async getReviewsByRental(rentalId: string): Promise<Review[]> {
    return await db
      .select()
      .from(reviews)
      .where(eq(reviews.rentalId, rentalId))
      .orderBy(desc(reviews.createdAt));
  }

  async createReview(insertReview: InsertReview): Promise<Review> {
    const [review] = await db
      .insert(reviews)
      .values(insertReview)
      .returning();
    
    // Update user's average rating
    const userReviews = await this.getReviewsByUser(insertReview.revieweeId);
    const totalRating = userReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = (totalRating / userReviews.length).toFixed(2);
    
    await this.updateUser(insertReview.revieweeId, {
      averageRating,
      totalReviews: userReviews.length,
    });
    
    return review;
  }

  async hasUserReviewedRental(rentalId: string, reviewerId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(reviews)
      .where(and(
        eq(reviews.rentalId, rentalId),
        eq(reviews.reviewerId, reviewerId)
      ))
      .limit(1);
    return result.length > 0;
  }

  // Transactions
  async getTransactionsByUser(userId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  async createTransaction(insertTransaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values(insertTransaction)
      .returning();
    return transaction;
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined> {
    const [transaction] = await db
      .update(transactions)
      .set(updates)
      .where(eq(transactions.id, id))
      .returning();
    return transaction;
  }

  // Verification Submissions
  async createVerificationSubmission(insertSubmission: InsertVerificationSubmission): Promise<VerificationSubmission> {
    const [submission] = await db
      .insert(verificationSubmissions)
      .values(insertSubmission)
      .returning();
    return submission;
  }

  async getVerificationSubmissionsByUser(userId: string): Promise<VerificationSubmission[]> {
    return await db
      .select()
      .from(verificationSubmissions)
      .where(eq(verificationSubmissions.userId, userId))
      .orderBy(desc(verificationSubmissions.createdAt));
  }

  async getPendingVerificationSubmissions(): Promise<VerificationSubmission[]> {
    return await db
      .select()
      .from(verificationSubmissions)
      .where(eq(verificationSubmissions.status, 'pending'))
      .orderBy(asc(verificationSubmissions.createdAt));
  }

  async updateVerificationSubmission(id: string, updates: Partial<VerificationSubmission>): Promise<VerificationSubmission | undefined> {
    const [submission] = await db
      .update(verificationSubmissions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(verificationSubmissions.id, id))
      .returning();
    return submission;
  }

  // Analytics
  async getAnalytics(): Promise<{
    transactionsToday: number;
    transactionsWeek: number;
    transactionsMonth: number;
    transactionsYear: number;
    revenueToday: string;
    revenueWeek: string;
    revenueMonth: string;
    revenueYear: string;
    expensesToday: string;
    expensesWeek: string;
    expensesMonth: string;
    expensesYear: string;
    profitToday: string;
    profitWeek: string;
    profitMonth: string;
    profitYear: string;
    profitMarginToday: string;
    profitMarginWeek: string;
    profitMarginMonth: string;
    profitMarginYear: string;
    totalRentals: number;
    activeRentals: number;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfYear = new Date(now.getFullYear(), 0, 1);

    // Get all transactions
    const allTransactions = await db.select().from(transactions);
    
    // Filter only completed platform_fee transactions for both counts and revenue
    const platformFeeTransactions = allTransactions.filter(
      t => t.type === 'platform_fee' && t.status === 'completed'
    );

    // Count transactions by time periods (only completed platform fees)
    const transactionsToday = platformFeeTransactions.filter(t => t.createdAt && t.createdAt >= today).length;
    const transactionsWeek = platformFeeTransactions.filter(t => t.createdAt && t.createdAt >= weekAgo).length;
    const transactionsMonth = platformFeeTransactions.filter(t => t.createdAt && t.createdAt >= firstOfMonth).length;
    const transactionsYear = platformFeeTransactions.filter(t => t.createdAt && t.createdAt >= firstOfYear).length;

    // Calculate RSF revenue (15% commission = 7.5% from renter + 7.5% from owner)
    const calculateRevenue = (txs: typeof platformFeeTransactions) => {
      return txs
        .reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0)
        .toFixed(2);
    };

    const revenueToday = calculateRevenue(platformFeeTransactions.filter(t => t.createdAt && t.createdAt >= today));
    const revenueWeek = calculateRevenue(platformFeeTransactions.filter(t => t.createdAt && t.createdAt >= weekAgo));
    const revenueMonth = calculateRevenue(platformFeeTransactions.filter(t => t.createdAt && t.createdAt >= firstOfMonth));
    const revenueYear = calculateRevenue(platformFeeTransactions.filter(t => t.createdAt && t.createdAt >= firstOfYear));

    // Get all expenses
    const allExpenses = await db.select().from(expenses);
    
    // Calculate expenses by time period
    const calculateExpenses = (exps: typeof allExpenses) => {
      return exps
        .reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0)
        .toFixed(2);
    };

    const expensesToday = calculateExpenses(allExpenses.filter(e => e.expenseDate && e.expenseDate >= today));
    const expensesWeek = calculateExpenses(allExpenses.filter(e => e.expenseDate && e.expenseDate >= weekAgo));
    const expensesMonth = calculateExpenses(allExpenses.filter(e => e.expenseDate && e.expenseDate >= firstOfMonth));
    const expensesYear = calculateExpenses(allExpenses.filter(e => e.expenseDate && e.expenseDate >= firstOfYear));

    // Calculate profit (revenue - expenses)
    const calculateProfit = (rev: string, exp: string) => {
      return (parseFloat(rev) - parseFloat(exp)).toFixed(2);
    };

    const profitToday = calculateProfit(revenueToday, expensesToday);
    const profitWeek = calculateProfit(revenueWeek, expensesWeek);
    const profitMonth = calculateProfit(revenueMonth, expensesMonth);
    const profitYear = calculateProfit(revenueYear, expensesYear);

    // Calculate profit margin percentage (profit / revenue * 100)
    const calculateProfitMargin = (profit: string, revenue: string) => {
      const rev = parseFloat(revenue);
      if (rev === 0) return "0.00";
      return ((parseFloat(profit) / rev) * 100).toFixed(2);
    };

    const profitMarginToday = calculateProfitMargin(profitToday, revenueToday);
    const profitMarginWeek = calculateProfitMargin(profitWeek, revenueWeek);
    const profitMarginMonth = calculateProfitMargin(profitMonth, revenueMonth);
    const profitMarginYear = calculateProfitMargin(profitYear, revenueYear);

    // Get rental stats
    const allRentals = await db.select().from(rentals);
    const totalRentals = allRentals.length;
    const activeRentals = allRentals.filter(r => r.status === 'active').length;

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
      activeRentals,
    };
  }

  // CRM - Leads
  async getAllLeads(): Promise<CrmLead[]> {
    return await db.select().from(crmLeads).orderBy(desc(crmLeads.createdAt));
  }

  async getLead(id: string): Promise<CrmLead | undefined> {
    const [lead] = await db.select().from(crmLeads).where(eq(crmLeads.id, id));
    return lead;
  }

  async createLead(insertLead: InsertCrmLead): Promise<CrmLead> {
    const [lead] = await db.insert(crmLeads).values(insertLead).returning();
    return lead;
  }

  async updateLead(id: string, updates: Partial<CrmLead>): Promise<CrmLead | undefined> {
    const [lead] = await db.update(crmLeads).set({ ...updates, updatedAt: new Date() }).where(eq(crmLeads.id, id)).returning();
    return lead;
  }

  async deleteLead(id: string): Promise<boolean> {
    const result = await db.delete(crmLeads).where(eq(crmLeads.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // CRM - Contacts
  async getAllContacts(): Promise<CrmContact[]> {
    return await db.select().from(crmContacts).orderBy(desc(crmContacts.createdAt));
  }

  async getContact(id: string): Promise<CrmContact | undefined> {
    const [contact] = await db.select().from(crmContacts).where(eq(crmContacts.id, id));
    return contact;
  }

  async createContact(insertContact: InsertCrmContact): Promise<CrmContact> {
    const [contact] = await db.insert(crmContacts).values(insertContact).returning();
    return contact;
  }

  async updateContact(id: string, updates: Partial<CrmContact>): Promise<CrmContact | undefined> {
    const [contact] = await db.update(crmContacts).set({ ...updates, updatedAt: new Date() }).where(eq(crmContacts.id, id)).returning();
    return contact;
  }

  async deleteContact(id: string): Promise<boolean> {
    const result = await db.delete(crmContacts).where(eq(crmContacts.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // CRM - Deals
  async getAllDeals(): Promise<CrmDeal[]> {
    return await db.select().from(crmDeals).orderBy(desc(crmDeals.createdAt));
  }

  async getDeal(id: string): Promise<CrmDeal | undefined> {
    const [deal] = await db.select().from(crmDeals).where(eq(crmDeals.id, id));
    return deal;
  }

  async createDeal(insertDeal: InsertCrmDeal): Promise<CrmDeal> {
    const [deal] = await db.insert(crmDeals).values(insertDeal).returning();
    return deal;
  }

  async updateDeal(id: string, updates: Partial<CrmDeal>): Promise<CrmDeal | undefined> {
    const [deal] = await db.update(crmDeals).set({ ...updates, updatedAt: new Date() }).where(eq(crmDeals.id, id)).returning();
    return deal;
  }

  async deleteDeal(id: string): Promise<boolean> {
    const result = await db.delete(crmDeals).where(eq(crmDeals.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // CRM - Activities
  async getAllActivities(): Promise<CrmActivity[]> {
    return await db.select().from(crmActivities).orderBy(desc(crmActivities.createdAt));
  }

  async getActivity(id: string): Promise<CrmActivity | undefined> {
    const [activity] = await db.select().from(crmActivities).where(eq(crmActivities.id, id));
    return activity;
  }

  async createActivity(insertActivity: InsertCrmActivity): Promise<CrmActivity> {
    const [activity] = await db.insert(crmActivities).values(insertActivity).returning();
    return activity;
  }

  async updateActivity(id: string, updates: Partial<CrmActivity>): Promise<CrmActivity | undefined> {
    const [activity] = await db.update(crmActivities).set({ ...updates, updatedAt: new Date() }).where(eq(crmActivities.id, id)).returning();
    return activity;
  }

  async deleteActivity(id: string): Promise<boolean> {
    const result = await db.delete(crmActivities).where(eq(crmActivities.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Expenses
  async getAllExpenses(): Promise<Expense[]> {
    return await db.select().from(expenses).orderBy(desc(expenses.expenseDate));
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense;
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const [expense] = await db.insert(expenses).values(insertExpense).returning();
    return expense;
  }

  async updateExpense(id: string, updates: Partial<Expense>): Promise<Expense | undefined> {
    const [expense] = await db.update(expenses).set({ ...updates, updatedAt: new Date() }).where(eq(expenses.id, id)).returning();
    return expense;
  }

  async deleteExpense(id: string): Promise<boolean> {
    const result = await db.delete(expenses).where(eq(expenses.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Job Applications
  async createJobApplication(insertApplication: InsertJobApplication): Promise<JobApplication> {
    const [application] = await db.insert(jobApplications).values(insertApplication).returning();
    return application;
  }

  async getJobApplicationsByListing(listingId: string): Promise<JobApplication[]> {
    return await db.select().from(jobApplications).where(eq(jobApplications.listingId, listingId)).orderBy(desc(jobApplications.createdAt));
  }

  async getJobApplicationsByApplicant(applicantId: string): Promise<JobApplication[]> {
    return await db.select().from(jobApplications).where(eq(jobApplications.applicantId, applicantId)).orderBy(desc(jobApplications.createdAt));
  }

  async getJobApplication(id: string): Promise<JobApplication | undefined> {
    const [application] = await db.select().from(jobApplications).where(eq(jobApplications.id, id));
    return application;
  }

  async updateJobApplication(id: string, updates: Partial<JobApplication>): Promise<JobApplication | undefined> {
    const [application] = await db.update(jobApplications).set({ ...updates, updatedAt: new Date() }).where(eq(jobApplications.id, id)).returning();
    return application;
  }

  // Promo Alerts
  async getActivePromoAlerts(): Promise<PromoAlert[]> {
    return await db.select().from(promoAlerts).where(eq(promoAlerts.isEnabled, true)).orderBy(desc(promoAlerts.createdAt));
  }

  async getAllPromoAlerts(): Promise<PromoAlert[]> {
    return await db.select().from(promoAlerts).orderBy(desc(promoAlerts.createdAt));
  }

  async getPromoAlert(id: string): Promise<PromoAlert | undefined> {
    const [alert] = await db.select().from(promoAlerts).where(eq(promoAlerts.id, id));
    return alert;
  }

  async createPromoAlert(insertAlert: InsertPromoAlert): Promise<PromoAlert> {
    const [alert] = await db.insert(promoAlerts).values(insertAlert).returning();
    return alert;
  }

  async updatePromoAlert(id: string, updates: Partial<PromoAlert>): Promise<PromoAlert | undefined> {
    const [alert] = await db.update(promoAlerts).set({ ...updates, updatedAt: new Date() }).where(eq(promoAlerts.id, id)).returning();
    return alert;
  }

  async deletePromoAlert(id: string): Promise<boolean> {
    const result = await db.delete(promoAlerts).where(eq(promoAlerts.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Marketplace Listing Promotional Free Time
  async grantMarketplacePromoFreeTime(listingId: string, durationDays: number, adminId: string): Promise<MarketplaceListing | undefined> {
    const promoFreeUntil = new Date();
    promoFreeUntil.setDate(promoFreeUntil.getDate() + durationDays);
    
    const [listing] = await db.update(marketplaceListings).set({
      promoFreeUntil,
      promoGrantedBy: adminId,
      promoGrantedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(marketplaceListings.id, listingId)).returning();
    
    return listing;
  }
}

export const storage = new DatabaseStorage();
