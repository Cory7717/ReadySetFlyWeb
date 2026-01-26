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
  type Favorite,
  type InsertFavorite,
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
  type AdminNotification,
  type InsertAdminNotification,
  type BannerAd,
  type InsertBannerAd,
  type BannerAdOrder,
  type InsertBannerAdOrder,
  type JobApplication,
  type InsertJobApplication,
  type PromoAlert,
  type InsertPromoAlert,
  type WithdrawalRequest,
  type InsertWithdrawalRequest,
  type RefreshToken,
  type InsertRefreshToken,
  type OAuthExchangeToken,
  type InsertOAuthExchangeToken,
  type ContactSubmission,
  type InsertContactSubmission,
  type PromoCode,
  type InsertPromoCode,
  type PromoCodeUsage,
  type InsertPromoCodeUsage,
  type LogbookEntry,
  type InsertLogbookEntry,
  type LogbookProSettings,
  type InsertLogbookProSettings,
  type FlightPlan,
  type InsertFlightPlan,
  type ApproachPlate,
  type InsertApproachPlate,
  users,
  aircraftListings,
  marketplaceListings,
  marketplaceFlags,
  rentals,
  messages,
  reviews,
  favorites,
  transactions,
  withdrawalRequests,
  verificationSubmissions,
  crmLeads,
  crmContacts,
  crmDeals,
  crmActivities,
  expenses,
  adminNotifications,
  bannerAds,
  bannerAdOrders,
  jobApplications,
  promoAlerts,
  promoCodes,
  promoCodeUsages,
  refreshTokens,
  oauthExchangeTokens,
  contactSubmissions,
  logbookEntries,
  logbookProSettings,
  flightPlans,
  approachPlates,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, or, ilike, gte, lte, sql, inArray, isNull, arrayOverlaps } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>; // REQUIRED for Replit Auth
  searchUsers(query: string): Promise<User[]>; // Admin search by name
  updateUserPassword(id: string, hashedPassword: string): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>; // Delete user and all related data
  
  // Refresh Tokens (for mobile app JWT authentication)
  createRefreshToken(token: InsertRefreshToken): Promise<RefreshToken>;
  getRefreshToken(token: string): Promise<RefreshToken | undefined>;
  deleteRefreshToken(token: string): Promise<boolean>;
  deleteUserRefreshTokens(userId: string): Promise<boolean>;
  
  // OAuth Exchange Tokens (for mobile OAuth flow)
  createOAuthExchangeToken(token: InsertOAuthExchangeToken): Promise<OAuthExchangeToken>;
  verifyOAuthExchangeToken(token: string): Promise<OAuthExchangeToken | undefined>;
  deleteOAuthExchangeToken(token: string): Promise<boolean>;
  
  // User Metrics (Admin Analytics)
  getUserMetrics(): Promise<{
    totalUsers: number;
    verifiedUsers: number;
    newUsersToday: number;
    newUsersThisWeek: number;
    newUsersThisMonth: number;
    activeListingOwners: number;
    activeRenters: number;
    verificationRate: number;
  }>;
  getGeographicDistribution(): Promise<{
    byState: Array<{ state: string; count: number }>;
    byCity: Array<{ city: string; state: string; count: number }>;
  }>;
  getUserRetentionMetrics(): Promise<{
    returningUsers: number;
    oneTimeUsers: number;
    retentionRate: number;
  }>;

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
    cfiRating?: string;
  }): Promise<MarketplaceListing[]>;
  createMarketplaceListing(listing: InsertMarketplaceListing): Promise<MarketplaceListing>;
  updateMarketplaceListing(id: string, updates: Partial<MarketplaceListing>): Promise<MarketplaceListing | undefined>;
  deleteMarketplaceListing(id: string): Promise<boolean>;
  deactivateExpiredListings(): Promise<{ deactivatedCount: number }>;
  getExpiringMarketplaceListings(daysUntilExpiration: number): Promise<MarketplaceListing[]>; // Find listings expiring in X days that haven't been reminded
  
  // Marketplace Analytics
  incrementMarketplaceViewCount(id: string): Promise<void>;
  incrementAircraftViewCount(id: string): Promise<void>;
  
  // Marketplace Flags
  flagMarketplaceListing(listingId: string, userId: string, reason?: string): Promise<{ success: boolean; flagCount: number }>;
  checkIfUserFlaggedListing(listingId: string, userId: string): Promise<boolean>;
  getFlaggedMarketplaceListings(): Promise<MarketplaceListing[]>; // Get listings with 5+ flags

  // Stale & Orphaned Listings Management
  getStaleAircraftListings(daysStale?: number): Promise<any[]>;
  getStaleMarketplaceListings(daysStale?: number): Promise<any[]>;
  getOrphanedAircraftListings(): Promise<AircraftListing[]>;
  getOrphanedMarketplaceListings(): Promise<MarketplaceListing[]>;
  refreshAircraftListing(id: string): Promise<AircraftListing | undefined>;
  refreshMarketplaceListing(id: string): Promise<MarketplaceListing | undefined>;
  getUsersWithActiveListings(): Promise<{ user: User; aircraftCount: number; marketplaceCount: number }[]>;

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

  // Favorites
  addFavorite(userId: string, listingType: "marketplace" | "aircraft", listingId: string): Promise<Favorite>;
  removeFavorite(userId: string, listingType: "marketplace" | "aircraft", listingId: string): Promise<boolean>;
  checkIfFavorited(userId: string, listingType: "marketplace" | "aircraft", listingId: string): Promise<boolean>;
  getUserFavorites(userId: string): Promise<{ marketplace: MarketplaceListing[]; aircraft: AircraftListing[] }>;

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
  
  // Promo Codes
  getAllPromoCodes(): Promise<PromoCode[]>;
  getActivePromoCodes(context: "banner-ad" | "marketplace" | "all"): Promise<PromoCode[]>;
  getPromoCodeByCode(code: string): Promise<PromoCode | undefined>;
  getPromoCode(id: string): Promise<PromoCode | undefined>;
  createPromoCode(promoCode: InsertPromoCode): Promise<PromoCode>;
  updatePromoCode(id: string, updates: Partial<PromoCode>): Promise<PromoCode | undefined>;
  deletePromoCode(id: string): Promise<boolean>;
  validatePromoCodeForContext(code: string, context: "banner-ad" | "marketplace"): Promise<PromoCode | null>;
  recordPromoCodeUsage(usage: { promoCodeId: string; userId?: string; marketplaceListingId?: string; bannerAdOrderId?: string }): Promise<PromoCodeUsage>;
  getPromoCodeUsageCount(promoCodeId: string): Promise<number>;
  
  // Admin Notifications
  getAllAdminNotifications(): Promise<AdminNotification[]>;
  getUnreadAdminNotifications(): Promise<AdminNotification[]>;
  createAdminNotification(notification: InsertAdminNotification): Promise<AdminNotification>;
  markNotificationAsRead(id: string): Promise<AdminNotification | undefined>;
  markNotificationAsActionable(id: string, isActionable: boolean): Promise<AdminNotification | undefined>;
  deleteAdminNotification(id: string): Promise<boolean>;
  
  // Contact Form Submissions
  createContactSubmission(submission: InsertContactSubmission): Promise<ContactSubmission>;
  updateContactSubmissionEmailStatus(id: string, sent: boolean): Promise<ContactSubmission | undefined>;
  
  // Banner Ad Orders
  getAllBannerAdOrders(): Promise<BannerAdOrder[]>;
  getBannerAdOrder(id: string): Promise<BannerAdOrder | undefined>;
  getBannerAdOrdersByStatus(approvalStatus?: string, paymentStatus?: string): Promise<BannerAdOrder[]>;
  createBannerAdOrder(order: InsertBannerAdOrder): Promise<BannerAdOrder>;
  updateBannerAdOrder(id: string, updates: Partial<BannerAdOrder>): Promise<BannerAdOrder | undefined>;
  deleteBannerAdOrder(id: string): Promise<boolean>;
  activateBannerAdOrder(orderId: string): Promise<BannerAd | undefined>; // Creates live ad from order
  getExpiringBannerAdOrders(daysUntilExpiration: number): Promise<BannerAdOrder[]>; // Find orders expiring in X days that haven't been reminded
  
  // Banner Ads
  getAllBannerAds(): Promise<BannerAd[]>;
  getActiveBannerAds(placement?: string, category?: string): Promise<BannerAd[]>;
  getBannerAd(id: string): Promise<BannerAd | undefined>;
  createBannerAd(ad: InsertBannerAd): Promise<BannerAd>;
  updateBannerAd(id: string, updates: Partial<BannerAd>): Promise<BannerAd | undefined>;
  deleteBannerAd(id: string): Promise<boolean>;
  incrementBannerImpressions(id: string): Promise<void>;
  incrementBannerClicks(id: string): Promise<void>;
  
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
  
  // Withdrawal Requests (PayPal Payouts)
  getUserBalance(userId: string): Promise<string>; // Returns balance as string (e.g., "125.50")
  addToUserBalance(userId: string, amount: number): Promise<User | undefined>; // Add earnings
  deductFromUserBalance(userId: string, amount: number): Promise<User | undefined>; // Deduct for withdrawal
  createWithdrawalRequest(request: InsertWithdrawalRequest): Promise<WithdrawalRequest>;
  getWithdrawalRequest(id: string): Promise<WithdrawalRequest | undefined>;
  getWithdrawalRequestsByUser(userId: string): Promise<WithdrawalRequest[]>;
  getPendingWithdrawalRequests(): Promise<WithdrawalRequest[]>;
  getAllWithdrawalRequests(): Promise<WithdrawalRequest[]>;
  updateWithdrawalRequest(id: string, updates: Partial<WithdrawalRequest>): Promise<WithdrawalRequest | undefined>;

  // Logbook Pro Settings
  getLogbookProSettings(userId: string): Promise<LogbookProSettings | undefined>;
  upsertLogbookProSettings(userId: string, updates: InsertLogbookProSettings): Promise<LogbookProSettings>;

  // Flight Planner
  getFlightPlansByUser(userId: string): Promise<FlightPlan[]>;
  getFlightPlanById(id: string): Promise<FlightPlan | undefined>;
  createFlightPlan(plan: InsertFlightPlan & { userId: string }): Promise<FlightPlan>;
  updateFlightPlan(id: string, updates: Partial<FlightPlan>): Promise<FlightPlan | undefined>;
  deleteFlightPlan(id: string): Promise<boolean>;

  // Approach Plates
  searchApproachPlates(query: string, limit?: number, cycle?: string): Promise<ApproachPlate[]>;
  getApproachPlateById(id: string): Promise<ApproachPlate | undefined>;
  replaceApproachPlatesForCycle(cycle: string, plates: InsertApproachPlate[]): Promise<number>;
  insertApproachPlates(plates: InsertApproachPlate[]): Promise<number>;
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
      .where(ilike(users.email, email))
      .limit(1);
    return result[0];
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.emailVerificationToken, token))
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

  async updateUserPassword(id: string, hashedPassword: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        hashedPassword, 
        passwordCreatedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      // Delete all user-related data in order to respect foreign key constraints
      
      // 1. Delete refresh tokens
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, id));
      
      // 2. Delete messages (both sent and received)
      await db.delete(messages).where(
        or(
          eq(messages.senderId, id),
          eq(messages.receiverId, id)
        )
      );
      
      // 3. Delete reviews (both as reviewer and reviewee)
      await db.delete(reviews).where(
        or(
          eq(reviews.reviewerId, id),
          eq(reviews.revieweeId, id)
        )
      );
      
      // 4. Delete rentals (both as renter and owner)
      await db.delete(rentals).where(
        or(
          eq(rentals.renterId, id),
          eq(rentals.ownerId, id)
        )
      );
      
      // 5. Delete aircraft listings
      await db.delete(aircraftListings).where(eq(aircraftListings.ownerId, id));
      
      // 6. Delete marketplace listings
      await db.delete(marketplaceListings).where(eq(marketplaceListings.userId, id));
      
      // 7. Delete verification submissions
      await db.delete(verificationSubmissions).where(eq(verificationSubmissions.userId, id));
      
      // 8. Delete transactions
      await db.delete(transactions).where(eq(transactions.userId, id));
      
      // 9. Delete withdrawal requests
      await db.delete(withdrawalRequests).where(eq(withdrawalRequests.userId, id));
      
      // 10. Delete job applications
      await db.delete(jobApplications).where(eq(jobApplications.applicantId, id));
      
      // 11. Delete CRM data (contacts, deals assigned to/created by user, activities)
      await db.delete(crmContacts).where(eq(crmContacts.userId, id));
      await db.delete(crmDeals).where(eq(crmDeals.assignedTo, id));
      await db.delete(crmActivities).where(
        or(
          eq(crmActivities.createdBy, id),
          eq(crmActivities.assignedTo, id)
        )
      );
      
      // 12. Finally, delete the user account
      const result = await db.delete(users).where(eq(users.id, id)).returning();
      
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  // Refresh Tokens (for mobile app JWT authentication)
  async createRefreshToken(token: InsertRefreshToken): Promise<RefreshToken> {
    const [refreshToken] = await db
      .insert(refreshTokens)
      .values(token)
      .returning();
    return refreshToken;
  }

  async getRefreshToken(token: string): Promise<RefreshToken | undefined> {
    const result = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, token))
      .limit(1);
    return result[0];
  }

  async deleteRefreshToken(token: string): Promise<boolean> {
    const result = await db
      .delete(refreshTokens)
      .where(eq(refreshTokens.token, token));
    return true;
  }

  async deleteUserRefreshTokens(userId: string): Promise<boolean> {
    await db
      .delete(refreshTokens)
      .where(eq(refreshTokens.userId, userId));
    return true;
  }

  // OAuth Exchange Tokens (for mobile OAuth flow)
  async createOAuthExchangeToken(token: InsertOAuthExchangeToken): Promise<OAuthExchangeToken> {
    const [exchangeToken] = await db
      .insert(oauthExchangeTokens)
      .values(token)
      .returning();
    return exchangeToken;
  }

  async verifyOAuthExchangeToken(token: string): Promise<OAuthExchangeToken | undefined> {
    const [exchangeToken] = await db
      .select()
      .from(oauthExchangeTokens)
      .where(and(
        eq(oauthExchangeTokens.token, token),
        gte(oauthExchangeTokens.expiresAt, new Date())
      ))
      .limit(1);
    return exchangeToken;
  }

  async deleteOAuthExchangeToken(token: string): Promise<boolean> {
    await db
      .delete(oauthExchangeTokens)
      .where(eq(oauthExchangeTokens.token, token));
    return true;
  }

  // User Metrics (Admin Analytics)
  async getUserMetrics(): Promise<{
    totalUsers: number;
    verifiedUsers: number;
    newUsersToday: number;
    newUsersThisWeek: number;
    newUsersThisMonth: number;
    activeListingOwners: number;
    activeRenters: number;
    verificationRate: number;
  }> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Total users count
    const totalUsersResult = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const totalUsers = totalUsersResult[0]?.count || 0;

    // Verified users count
    const verifiedUsersResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.isVerified, true));
    const verifiedUsers = verifiedUsersResult[0]?.count || 0;

    // New users today
    const newUsersTodayResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(gte(users.createdAt, todayStart));
    const newUsersToday = newUsersTodayResult[0]?.count || 0;

    // New users this week
    const newUsersThisWeekResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(gte(users.createdAt, weekAgo));
    const newUsersThisWeek = newUsersThisWeekResult[0]?.count || 0;

    // New users this month
    const newUsersThisMonthResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(gte(users.createdAt, monthAgo));
    const newUsersThisMonth = newUsersThisMonthResult[0]?.count || 0;

    // Active listing owners (users with at least one aircraft or marketplace listing)
    // Count unique aircraft owners
    const aircraftOwnersResult = await db
      .selectDistinct({ ownerId: aircraftListings.ownerId })
      .from(aircraftListings)
      .where(eq(aircraftListings.isListed, true));
    
    // Count unique marketplace listing owners
    const marketplaceOwnersResult = await db
      .selectDistinct({ userId: marketplaceListings.userId })
      .from(marketplaceListings)
      .where(eq(marketplaceListings.isActive, true));
    
    // Combine and count unique user IDs
    const uniqueOwners = new Set([
      ...aircraftOwnersResult.map(r => r.ownerId),
      ...marketplaceOwnersResult.map(r => r.userId)
    ]);
    const activeListingOwners = uniqueOwners.size;

    // Active renters (users who have completed at least one rental)
    const activeRentersResult = await db
      .select({ count: sql<number>`count(DISTINCT ${rentals.renterId})::int` })
      .from(rentals)
      .where(eq(rentals.status, 'completed'));
    const activeRenters = activeRentersResult[0]?.count || 0;

    // Verification rate
    const verificationRate = totalUsers > 0 ? (verifiedUsers / totalUsers) * 100 : 0;

    return {
      totalUsers,
      verifiedUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      activeListingOwners,
      activeRenters,
      verificationRate,
    };
  }

  async getGeographicDistribution(): Promise<{
    byState: Array<{ state: string; count: number }>;
    byCity: Array<{ city: string; state: string; count: number }>;
  }> {
    // Get state distribution from listings (aircraft + marketplace)
    const stateDistribution = await db
      .select({
        state: aircraftListings.state,
        count: sql<number>`count(DISTINCT ${aircraftListings.ownerId})::int`,
      })
      .from(aircraftListings)
      .where(and(
        eq(aircraftListings.isListed, true),
        sql`${aircraftListings.state} IS NOT NULL AND ${aircraftListings.state} != ''`
      ))
      .groupBy(aircraftListings.state)
      .orderBy(desc(sql`count(DISTINCT ${aircraftListings.ownerId})`));

    const marketplaceStateDistribution = await db
      .select({
        state: marketplaceListings.state,
        count: sql<number>`count(DISTINCT ${marketplaceListings.userId})::int`,
      })
      .from(marketplaceListings)
      .where(and(
        eq(marketplaceListings.isActive, true),
        sql`${marketplaceListings.state} IS NOT NULL AND ${marketplaceListings.state} != ''`
      ))
      .groupBy(marketplaceListings.state)
      .orderBy(desc(sql`count(DISTINCT ${marketplaceListings.userId})`));

    // Merge and aggregate state counts
    const stateMap = new Map<string, number>();
    [...stateDistribution, ...marketplaceStateDistribution].forEach(({ state, count }) => {
      if (state) {
        stateMap.set(state, (stateMap.get(state) || 0) + count);
      }
    });
    const byState = Array.from(stateMap.entries())
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 states

    // Get city distribution
    const cityDistribution = await db
      .select({
        city: aircraftListings.city,
        state: aircraftListings.state,
        count: sql<number>`count(DISTINCT ${aircraftListings.ownerId})::int`,
      })
      .from(aircraftListings)
      .where(and(
        eq(aircraftListings.isListed, true),
        sql`${aircraftListings.city} IS NOT NULL AND ${aircraftListings.city} != ''`
      ))
      .groupBy(aircraftListings.city, aircraftListings.state)
      .orderBy(desc(sql`count(DISTINCT ${aircraftListings.ownerId})`))
      .limit(10); // Top 10 cities

    const byCity = cityDistribution.map(({ city, state, count }) => ({
      city: city || '',
      state: state || '',
      count,
    }));

    return { byState, byCity };
  }

  async getUserRetentionMetrics(): Promise<{
    returningUsers: number;
    oneTimeUsers: number;
    retentionRate: number;
  }> {
    // Returning users: users with more than one completed rental
    const returningUsersResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(
        db
          .select({ renterId: rentals.renterId })
          .from(rentals)
          .where(eq(rentals.status, 'completed'))
          .groupBy(rentals.renterId)
          .having(sql`count(*) > 1`)
          .as('returning_renters')
      );
    const returningUsers = returningUsersResult[0]?.count || 0;

    // One-time users: users with exactly one completed rental
    const oneTimeUsersResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(
        db
          .select({ renterId: rentals.renterId })
          .from(rentals)
          .where(eq(rentals.status, 'completed'))
          .groupBy(rentals.renterId)
          .having(sql`count(*) = 1`)
          .as('one_time_renters')
      );
    const oneTimeUsers = oneTimeUsersResult[0]?.count || 0;

    // Retention rate
    const totalRenters = returningUsers + oneTimeUsers;
    const retentionRate = totalRenters > 0 ? (returningUsers / totalRenters) * 100 : 0;

    return {
      returningUsers,
      oneTimeUsers,
      retentionRate,
    };
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
      .where(
        and(
          eq(marketplaceListings.isActive, true),
          eq(marketplaceListings.isExample, false)
        )
      );
  }

  async getMarketplaceListingsByCategory(category: string): Promise<MarketplaceListing[]> {
    return await db
      .select()
      .from(marketplaceListings)
      .where(
        and(
          eq(marketplaceListings.category, category),
          eq(marketplaceListings.isActive, true),
          eq(marketplaceListings.isExample, false)
        )
      );
  }

  async getMarketplaceListingsByUser(userId: string): Promise<MarketplaceListing[]> {
    return await db
      .select()
      .from(marketplaceListings)
      .where(
        and(
          eq(marketplaceListings.userId, userId),
          eq(marketplaceListings.isExample, false)
        )
      );
  }

  async getFilteredMarketplaceListings(filters: {
    city?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    engineType?: string;
    keyword?: string;
    radius?: number;
    cfiRating?: string;
  }): Promise<MarketplaceListing[]> {
    const conditions: any[] = [
      eq(marketplaceListings.isActive, true),
      eq(marketplaceListings.isExample, false)
    ];

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

    // Engine type & CFI rating filters (stored in details JSONB)
    // This requires a JSON path query which is more complex with Drizzle
    // For now, we'll fetch all and filter in memory
    // TODO: Optimize with raw SQL or JSONB operators in future

    const results = await db
      .select()
      .from(marketplaceListings)
      .where(and(...conditions));

    // Post-filter for engineType or cfiRating in details JSONB
    let filteredResults = results;
    
    if (filters.engineType && filters.engineType !== 'all') {
      filteredResults = filteredResults.filter((listing) => {
        const details = listing.details as any;
        return details?.engineType === filters.engineType;
      });
    }
    
    if (filters.cfiRating && filters.cfiRating !== 'all') {
      filteredResults = filteredResults.filter((listing) => {
        const details = listing.details as any;
        // Check if the listing's certifications array includes the selected rating
        return details?.certifications?.includes(filters.cfiRating);
      });
    }

    return filteredResults;
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

  async getExpiringMarketplaceListings(daysUntilExpiration: number): Promise<MarketplaceListing[]> {
    const now = new Date();
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysUntilExpiration);
    
    const targetDateStart = new Date(targetDate);
    targetDateStart.setHours(0, 0, 0, 0);
    
    const targetDateEnd = new Date(targetDate);
    targetDateEnd.setHours(23, 59, 59, 999);
    
    return await db
      .select()
      .from(marketplaceListings)
      .where(
        and(
          eq(marketplaceListings.isActive, true),
          eq(marketplaceListings.isPaid, true),
          eq(marketplaceListings.expirationReminderSent, false),
          gte(marketplaceListings.expiresAt, targetDateStart),
          lte(marketplaceListings.expiresAt, targetDateEnd)
        )
      )
      .orderBy(asc(marketplaceListings.expiresAt));
  }

  // Marketplace Analytics
  async incrementMarketplaceViewCount(id: string): Promise<void> {
    await db
      .update(marketplaceListings)
      .set({
        viewCount: sql`${marketplaceListings.viewCount} + 1`,
      })
      .where(eq(marketplaceListings.id, id));
  }

  async incrementAircraftViewCount(id: string): Promise<void> {
    await db
      .update(aircraftListings)
      .set({
        viewCount: sql`${aircraftListings.viewCount} + 1`,
      })
      .where(eq(aircraftListings.id, id));
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

  // Stale & Orphaned Listings Management
  async getStaleAircraftListings(daysStale: number = 60): Promise<any[]> {
    const staleDate = new Date(Date.now() - (daysStale * 24 * 60 * 60 * 1000));
    
    const results = await db
      .select()
      .from(aircraftListings)
      .leftJoin(users, eq(aircraftListings.ownerId, users.id))
      .where(
        and(
          eq(aircraftListings.isListed, true),
          lte(aircraftListings.lastRefreshedAt, staleDate)
        )
      )
      .orderBy(asc(aircraftListings.lastRefreshedAt));
    
    return results.map(row => ({
      ...row.aircraft_listings,
      owner: row.users!
    }));
  }

  async getStaleMarketplaceListings(daysStale: number = 60): Promise<any[]> {
    const staleDate = new Date(Date.now() - (daysStale * 24 * 60 * 60 * 1000));
    
    const results = await db
      .select()
      .from(marketplaceListings)
      .leftJoin(users, eq(marketplaceListings.userId, users.id))
      .where(
        and(
          eq(marketplaceListings.isActive, true),
          lte(marketplaceListings.lastRefreshedAt, staleDate)
        )
      )
      .orderBy(asc(marketplaceListings.lastRefreshedAt));
    
    return results.map(row => ({
      ...row.marketplace_listings,
      user: row.users!
    }));
  }

  async getOrphanedAircraftListings(): Promise<AircraftListing[]> {
    // Find aircraft listings where the owner doesn't exist or is suspended
    const results = await db
      .select({
        listing: aircraftListings,
        owner: users
      })
      .from(aircraftListings)
      .leftJoin(users, eq(aircraftListings.ownerId, users.id))
      .where(eq(aircraftListings.isListed, true));
    
    // Filter orphaned listings (no owner or suspended owner)
    return results
      .filter(row => !row.owner || row.owner.isSuspended)
      .map(row => row.listing);
  }

  async getOrphanedMarketplaceListings(): Promise<MarketplaceListing[]> {
    // Find marketplace listings where the user doesn't exist or is suspended
    const results = await db
      .select({
        listing: marketplaceListings,
        user: users
      })
      .from(marketplaceListings)
      .leftJoin(users, eq(marketplaceListings.userId, users.id))
      .where(eq(marketplaceListings.isActive, true));
    
    // Filter orphaned listings (no user or suspended user)
    return results
      .filter(row => !row.user || row.user.isSuspended)
      .map(row => row.listing);
  }

  async refreshAircraftListing(id: string): Promise<AircraftListing | undefined> {
    const [listing] = await db
      .update(aircraftListings)
      .set({ 
        lastRefreshedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(aircraftListings.id, id))
      .returning();
    return listing;
  }

  async refreshMarketplaceListing(id: string): Promise<MarketplaceListing | undefined> {
    const [listing] = await db
      .update(marketplaceListings)
      .set({ 
        lastRefreshedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(marketplaceListings.id, id))
      .returning();
    return listing;
  }

  async getUsersWithActiveListings(): Promise<{ user: User; aircraftCount: number; marketplaceCount: number }[]> {
    // Get all users who have active aircraft or marketplace listings
    const aircraftOwners = await db
      .select({
        userId: aircraftListings.ownerId,
        count: sql<number>`count(*)::int`
      })
      .from(aircraftListings)
      .where(eq(aircraftListings.isListed, true))
      .groupBy(aircraftListings.ownerId);

    const marketplaceOwners = await db
      .select({
        userId: marketplaceListings.userId,
        count: sql<number>`count(*)::int`
      })
      .from(marketplaceListings)
      .where(eq(marketplaceListings.isActive, true))
      .groupBy(marketplaceListings.userId);

    // Combine and get unique user IDs
    const userIdsArray = [
      ...aircraftOwners.map(o => o.userId),
      ...marketplaceOwners.map(o => o.userId)
    ];
    const uniqueUserIds = Array.from(new Set(userIdsArray));

    // Fetch user details and build result
    const results: { user: User; aircraftCount: number; marketplaceCount: number }[] = [];
    
    for (const userId of uniqueUserIds) {
      const user = await this.getUser(userId);
      if (user && !user.isSuspended) {
        const aircraftCount = aircraftOwners.find(o => o.userId === userId)?.count || 0;
        const marketplaceCount = marketplaceOwners.find(o => o.userId === userId)?.count || 0;
        
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

  // Favorites
  async addFavorite(userId: string, listingType: "marketplace" | "aircraft", listingId: string): Promise<Favorite> {
    // Check if already favorited
    const existing = await this.checkIfFavorited(userId, listingType, listingId);
    if (existing) {
      // Return existing favorite
      const [favorite] = await db
        .select()
        .from(favorites)
        .where(and(
          eq(favorites.userId, userId),
          eq(favorites.listingType, listingType),
          eq(favorites.listingId, listingId)
        ))
        .limit(1);
      return favorite;
    }

    const [favorite] = await db
      .insert(favorites)
      .values({ userId, listingType, listingId })
      .returning();
    return favorite;
  }

  async removeFavorite(userId: string, listingType: "marketplace" | "aircraft", listingId: string): Promise<boolean> {
    const result = await db
      .delete(favorites)
      .where(and(
        eq(favorites.userId, userId),
        eq(favorites.listingType, listingType),
        eq(favorites.listingId, listingId)
      ))
      .returning();
    return result.length > 0;
  }

  async checkIfFavorited(userId: string, listingType: "marketplace" | "aircraft", listingId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(favorites)
      .where(and(
        eq(favorites.userId, userId),
        eq(favorites.listingType, listingType),
        eq(favorites.listingId, listingId)
      ))
      .limit(1);
    return result.length > 0;
  }

  async getUserFavorites(userId: string): Promise<{ marketplace: MarketplaceListing[]; aircraft: AircraftListing[] }> {
    // Get all favorites for user
    const userFavorites = await db
      .select()
      .from(favorites)
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt));

    // Separate marketplace and aircraft favorite IDs
    const marketplaceFavoriteIds = userFavorites
      .filter(f => f.listingType === "marketplace")
      .map(f => f.listingId);
    const aircraftFavoriteIds = userFavorites
      .filter(f => f.listingType === "aircraft")
      .map(f => f.listingId);

    // Fetch marketplace listings
    let marketplaceListingsList: MarketplaceListing[] = [];
    if (marketplaceFavoriteIds.length > 0) {
      marketplaceListingsList = await db
        .select()
        .from(marketplaceListings)
        .where(inArray(marketplaceListings.id, marketplaceFavoriteIds));
    }

    // Fetch aircraft listings
    let aircraftListingsList: AircraftListing[] = [];
    if (aircraftFavoriteIds.length > 0) {
      aircraftListingsList = await db
        .select()
        .from(aircraftListings)
        .where(inArray(aircraftListings.id, aircraftFavoriteIds));
    }

    return {
      marketplace: marketplaceListingsList,
      aircraft: aircraftListingsList,
    };
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
    pendingRentals: number;
    approvedRentals: number;
    activeRentals: number;
    completedRentals: number;
    cancelledRentals: number;
    newRentalsToday: number;
    newRentalsWeek: number;
    activeRentalsToday: number;
    activeRentalsWeek: number;
    totalActiveMarketplaceListings: number;
    totalExpiredMarketplaceListings: number;
    marketplaceByCategory: {
      job: number;
      'aircraft-sale': number;
      cfi: number;
      'flight-school': number;
      mechanic: number;
      charter: number;
    };
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

    // Get rental stats by status
    const allRentals = await db.select().from(rentals);
    const totalRentals = allRentals.length;
    const pendingRentals = allRentals.filter(r => r.status === 'pending').length;
    const approvedRentals = allRentals.filter(r => r.status === 'approved').length;
    const activeRentals = allRentals.filter(r => r.status === 'active').length;
    const completedRentals = allRentals.filter(r => r.status === 'completed').length;
    const cancelledRentals = allRentals.filter(r => r.status === 'cancelled').length;

    // New rentals (created today/this week)
    const newRentalsToday = allRentals.filter(r => r.createdAt && r.createdAt >= today).length;
    const newRentalsWeek = allRentals.filter(r => r.createdAt && r.createdAt >= weekAgo).length;

    // Active rentals during period (startDate <= period end AND endDate >= period start)
    const endOfToday = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
    
    const activeRentalsToday = allRentals.filter(r => 
      r.status === 'active' && 
      r.startDate && r.endDate &&
      new Date(r.startDate) <= endOfToday && 
      new Date(r.endDate) >= today
    ).length;
    
    // For "this week", use rolling 7-day window: from weekAgo to now
    // A rental is active this week if it overlaps with the [weekAgo, now] period
    const activeRentalsWeek = allRentals.filter(r => 
      r.status === 'active' && 
      r.startDate && r.endDate &&
      new Date(r.startDate) <= now && 
      new Date(r.endDate) >= weekAgo
    ).length;

    // Marketplace listing stats
    const allMarketplaceListings = await db.select().from(marketplaceListings);
    
    // Active listings (isActive = true AND (expiresAt is null OR expiresAt > now))
    const activeMarketplaceListings = allMarketplaceListings.filter(l => 
      l.isActive && (!l.expiresAt || new Date(l.expiresAt) > now)
    );
    
    // Expired listings (isActive = false OR expiresAt <= now)
    const expiredMarketplaceListings = allMarketplaceListings.filter(l => 
      !l.isActive || (l.expiresAt && new Date(l.expiresAt) <= now)
    );

    // Active listings by category
    const marketplaceByCategory = {
      'job': activeMarketplaceListings.filter(l => l.category === 'job').length,
      'aircraft-sale': activeMarketplaceListings.filter(l => l.category === 'aircraft-sale').length,
      'cfi': activeMarketplaceListings.filter(l => l.category === 'cfi').length,
      'flight-school': activeMarketplaceListings.filter(l => l.category === 'flight-school').length,
      'mechanic': activeMarketplaceListings.filter(l => l.category === 'mechanic').length,
      'charter': activeMarketplaceListings.filter(l => l.category === 'charter').length,
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
      marketplaceByCategory,
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

  // Promo Codes
  async getAllPromoCodes(): Promise<PromoCode[]> {
    return await db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));
  }

  async getActivePromoCodes(context: "banner-ad" | "marketplace" | "all"): Promise<PromoCode[]> {
    const now = new Date();
    
    let query = db.select().from(promoCodes).where(
      and(
        eq(promoCodes.isActive, true),
        or(
          sql`${promoCodes.validFrom} IS NULL`,
          lte(promoCodes.validFrom, now)
        ),
        or(
          sql`${promoCodes.validUntil} IS NULL`,
          gte(promoCodes.validUntil, now)
        )
      )
    );

    const codes = await query.orderBy(desc(promoCodes.createdAt));
    
    // Filter by context
    if (context === "banner-ad") {
      return codes.filter(code => code.applicableToBannerAds);
    } else if (context === "marketplace") {
      return codes.filter(code => code.applicableToMarketplace);
    }
    return codes;
  }

  async getPromoCodeByCode(code: string): Promise<PromoCode | undefined> {
    const [promoCode] = await db.select().from(promoCodes).where(eq(promoCodes.code, code.toUpperCase()));
    return promoCode;
  }

  async getPromoCode(id: string): Promise<PromoCode | undefined> {
    const [promoCode] = await db.select().from(promoCodes).where(eq(promoCodes.id, id));
    return promoCode;
  }

  async createPromoCode(insertPromoCode: InsertPromoCode): Promise<PromoCode> {
    const [promoCode] = await db.insert(promoCodes).values({
      ...insertPromoCode,
      code: insertPromoCode.code.toUpperCase(),
    }).returning();
    return promoCode;
  }

  async updatePromoCode(id: string, updates: Partial<PromoCode>): Promise<PromoCode | undefined> {
    const updateData = { ...updates, updatedAt: new Date() };
    if (updates.code) {
      updateData.code = updates.code.toUpperCase();
    }
    const [promoCode] = await db.update(promoCodes).set(updateData).where(eq(promoCodes.id, id)).returning();
    return promoCode;
  }

  async deletePromoCode(id: string): Promise<boolean> {
    const result = await db.delete(promoCodes).where(eq(promoCodes.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async validatePromoCodeForContext(code: string, context: "banner-ad" | "marketplace"): Promise<PromoCode | null> {
    const promoCode = await this.getPromoCodeByCode(code);
    if (!promoCode) return null;

    // Check if active
    if (!promoCode.isActive) return null;

    // Check context applicability
    if (context === "banner-ad" && !promoCode.applicableToBannerAds) return null;
    if (context === "marketplace" && !promoCode.applicableToMarketplace) return null;

    // Check date validity
    const now = new Date();
    if (promoCode.validFrom && promoCode.validFrom > now) return null;
    if (promoCode.validUntil && promoCode.validUntil < now) return null;

    // Check usage limits
    if (promoCode.maxUses !== null && (promoCode.usedCount ?? 0) >= promoCode.maxUses) {
      return null;
    }

    return promoCode;
  }

  async recordPromoCodeUsage(usage: { promoCodeId: string; userId?: string; marketplaceListingId?: string; bannerAdOrderId?: string }): Promise<PromoCodeUsage> {
    // Record usage
    const [promoCodeUsage] = await db.insert(promoCodeUsages).values(usage as InsertPromoCodeUsage).returning();
    
    // Increment usage count
    await db.update(promoCodes)
      .set({ 
        usedCount: sql`${promoCodes.usedCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(promoCodes.id, usage.promoCodeId));
    
    return promoCodeUsage;
  }

  async getPromoCodeUsageCount(promoCodeId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(promoCodeUsages)
      .where(eq(promoCodeUsages.promoCodeId, promoCodeId));
    return result[0]?.count || 0;
  }

  // Admin Notifications
  async getAllAdminNotifications(): Promise<AdminNotification[]> {
    return await db.select().from(adminNotifications).orderBy(desc(adminNotifications.createdAt));
  }

  async getUnreadAdminNotifications(): Promise<AdminNotification[]> {
    return await db
      .select()
      .from(adminNotifications)
      .where(eq(adminNotifications.isRead, false))
      .orderBy(desc(adminNotifications.createdAt));
  }

  async createAdminNotification(insertNotification: InsertAdminNotification): Promise<AdminNotification> {
    const [notification] = await db.insert(adminNotifications).values(insertNotification).returning();
    return notification;
  }

  async markNotificationAsRead(id: string): Promise<AdminNotification | undefined> {
    const [notification] = await db
      .update(adminNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(adminNotifications.id, id))
      .returning();
    return notification;
  }

  async markNotificationAsActionable(id: string, isActionable: boolean): Promise<AdminNotification | undefined> {
    const [notification] = await db
      .update(adminNotifications)
      .set({ isActionable })
      .where(eq(adminNotifications.id, id))
      .returning();
    return notification;
  }

  async deleteAdminNotification(id: string): Promise<boolean> {
    const result = await db.delete(adminNotifications).where(eq(adminNotifications.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Contact Form Submissions
  async createContactSubmission(submission: InsertContactSubmission): Promise<ContactSubmission> {
    const [contactSubmission] = await db.insert(contactSubmissions).values(submission).returning();
    return contactSubmission;
  }

  async updateContactSubmissionEmailStatus(id: string, sent: boolean): Promise<ContactSubmission | undefined> {
    const [submission] = await db
      .update(contactSubmissions)
      .set({ emailSent: sent, emailSentAt: sent ? new Date() : null })
      .where(eq(contactSubmissions.id, id))
      .returning();
    return submission;
  }

  // Banner Ad Orders
  async getAllBannerAdOrders(): Promise<BannerAdOrder[]> {
    return await db.select().from(bannerAdOrders).orderBy(desc(bannerAdOrders.createdAt));
  }

  async getBannerAdOrder(id: string): Promise<BannerAdOrder | undefined> {
    const [order] = await db.select().from(bannerAdOrders).where(eq(bannerAdOrders.id, id));
    return order;
  }

  async getBannerAdOrdersByStatus(approvalStatus?: string, paymentStatus?: string): Promise<BannerAdOrder[]> {
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

    return await db
      .select()
      .from(bannerAdOrders)
      .where(and(...conditions))
      .orderBy(desc(bannerAdOrders.createdAt));
  }

  async createBannerAdOrder(insertOrder: InsertBannerAdOrder): Promise<BannerAdOrder> {
    const [order] = await db.insert(bannerAdOrders).values(insertOrder).returning();
    return order;
  }

  async updateBannerAdOrder(id: string, updates: Partial<BannerAdOrder>): Promise<BannerAdOrder | undefined> {
    const [order] = await db
      .update(bannerAdOrders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bannerAdOrders.id, id))
      .returning();
    return order;
  }

  async deleteBannerAdOrder(id: string): Promise<boolean> {
    // Delete related records first to avoid foreign key constraint violations
    
    // 1. Delete any banner ads linked to this order
    await db.delete(bannerAds).where(eq(bannerAds.orderId, id));
    
    // 2. Delete any promo code usages linked to this order
    await db.delete(promoCodeUsages).where(eq(promoCodeUsages.bannerAdOrderId, id));
    
    // 3. Now delete the order itself
    const result = await db.delete(bannerAdOrders).where(eq(bannerAdOrders.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async activateBannerAdOrder(orderId: string): Promise<BannerAd | undefined> {
    const order = await this.getBannerAdOrder(orderId);
    if (!order) {
      return undefined;
    }

    // Require paid status, captured PayPal order ID, and approval before activation
    if (order.paymentStatus !== 'paid') {
      throw new Error('UNPAID_ORDER');
    }

    if (!order.paypalOrderId || order.paypalOrderId.trim() === '') {
      throw new Error('MISSING_PAYMENT_REFERENCE');
    }

    if (order.approvalStatus !== 'approved') {
      throw new Error('NOT_APPROVED');
    }

    // Check if this order has already been activated
    const existingAd = await db
      .select()
      .from(bannerAds)
      .where(eq(bannerAds.orderId, orderId))
      .limit(1);
    
    if (existingAd.length > 0) {
      // Order already activated - throw error to prevent duplicate activation
      throw new Error('ALREADY_ACTIVATED');
    }

    // Validate that order has required image
    if (!order.imageUrl || order.imageUrl.trim() === '') {
      throw new Error('IMAGE_REQUIRED');
    }

    // Calculate proper end date based on tier duration
    const startDate = order.startDate || new Date();
    let endDate: Date = order.endDate || new Date(startDate);
    
    // If no endDate is set, calculate based on tier (30 days for all tiers)
    if (!order.endDate) {
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 30);
    }

    const bannerAdData: InsertBannerAd = {
      orderId: order.id,
      title: order.title,
      description: order.description,
      imageUrl: order.imageUrl,
      link: order.link,
      placements: order.placements,
      category: order.category,
      isActive: true,
      startDate: startDate,
      endDate: endDate,
    };

    const [ad] = await db.insert(bannerAds).values(bannerAdData).returning();
    return ad;
  }

  async getExpiringBannerAdOrders(daysUntilExpiration: number): Promise<BannerAdOrder[]> {
    const now = new Date();
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysUntilExpiration);
    
    const targetDateStart = new Date(targetDate);
    targetDateStart.setHours(0, 0, 0, 0);
    
    const targetDateEnd = new Date(targetDate);
    targetDateEnd.setHours(23, 59, 59, 999);
    
    return await db
      .select()
      .from(bannerAdOrders)
      .where(
        and(
          eq(bannerAdOrders.approvalStatus, 'approved'),
          eq(bannerAdOrders.paymentStatus, 'paid'),
          eq(bannerAdOrders.expirationReminderSent, false),
          gte(bannerAdOrders.endDate, targetDateStart),
          lte(bannerAdOrders.endDate, targetDateEnd)
        )
      )
      .orderBy(asc(bannerAdOrders.endDate));
  }

  // Banner Ads
  async getAllBannerAds(): Promise<BannerAd[]> {
    return await db.select().from(bannerAds).orderBy(desc(bannerAds.createdAt));
  }

  async getActiveBannerAds(placement?: string, category?: string): Promise<BannerAd[]> {
    const now = new Date();
    
    // Build conditions array
    const conditions = [
      eq(bannerAds.isActive, true),
      lte(bannerAds.startDate, now),
      // endDate can be null (no expiration) or >= now (not expired yet)
      or(
        isNull(bannerAds.endDate),
        gte(bannerAds.endDate, now)
      )
    ];

    // Check if placement is in the placements array (uses arrayOverlaps to check if at least one match)
    if (placement) {
      conditions.push(arrayOverlaps(bannerAds.placements, [placement]));
    }

    // Check category match
    if (category) {
      conditions.push(eq(bannerAds.category, category));
    }

    return await db
      .select()
      .from(bannerAds)
      .where(and(...conditions))
      .orderBy(desc(bannerAds.impressions));
  }

  async getBannerAd(id: string): Promise<BannerAd | undefined> {
    const [ad] = await db.select().from(bannerAds).where(eq(bannerAds.id, id));
    return ad;
  }

  async createBannerAd(insertAd: InsertBannerAd): Promise<BannerAd> {
    const [ad] = await db.insert(bannerAds).values(insertAd).returning();
    return ad;
  }

  async updateBannerAd(id: string, updates: Partial<BannerAd>): Promise<BannerAd | undefined> {
    const [ad] = await db
      .update(bannerAds)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bannerAds.id, id))
      .returning();
    return ad;
  }

  async deleteBannerAd(id: string): Promise<boolean> {
    const result = await db.delete(bannerAds).where(eq(bannerAds.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async incrementBannerImpressions(id: string): Promise<void> {
    await db
      .update(bannerAds)
      .set({ impressions: sql`${bannerAds.impressions} + 1` })
      .where(eq(bannerAds.id, id));
  }

  async incrementBannerClicks(id: string): Promise<void> {
    await db
      .update(bannerAds)
      .set({ clicks: sql`${bannerAds.clicks} + 1` })
      .where(eq(bannerAds.id, id));
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

  // Logbook Pro Settings
  async getLogbookProSettings(userId: string): Promise<LogbookProSettings | undefined> {
    const [settings] = await db.select().from(logbookProSettings).where(eq(logbookProSettings.userId, userId));
    return settings;
  }

  async upsertLogbookProSettings(userId: string, updates: InsertLogbookProSettings): Promise<LogbookProSettings> {
    const existing = await this.getLogbookProSettings(userId);
    if (existing) {
      const [settings] = await db
        .update(logbookProSettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(logbookProSettings.userId, userId))
        .returning();
      return settings;
    }
    const [settings] = await db.insert(logbookProSettings).values({ ...updates, userId }).returning();
    return settings;
  }

  // Flight Planner
  async getFlightPlansByUser(userId: string): Promise<FlightPlan[]> {
    return await db
      .select()
      .from(flightPlans)
      .where(eq(flightPlans.userId, userId))
      .orderBy(desc(flightPlans.plannedDepartureAt), desc(flightPlans.createdAt));
  }

  async getFlightPlanById(id: string): Promise<FlightPlan | undefined> {
    const [plan] = await db.select().from(flightPlans).where(eq(flightPlans.id, id));
    return plan;
  }

  async createFlightPlan(plan: InsertFlightPlan & { userId: string }): Promise<FlightPlan> {
    const [created] = await db.insert(flightPlans).values(plan).returning();
    return created;
  }

  async updateFlightPlan(id: string, updates: Partial<FlightPlan>): Promise<FlightPlan | undefined> {
    const [updated] = await db
      .update(flightPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(flightPlans.id, id))
      .returning();
    return updated;
  }

  async deleteFlightPlan(id: string): Promise<boolean> {
    const result = await db.delete(flightPlans).where(eq(flightPlans.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Approach Plates
  async searchApproachPlates(query: string, limit: number = 50, cycle?: string): Promise<ApproachPlate[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      if (cycle) {
        return await db
          .select()
          .from(approachPlates)
          .where(eq(approachPlates.cycle, cycle))
          .orderBy(desc(approachPlates.createdAt))
          .limit(limit);
      }
      return await db
        .select()
        .from(approachPlates)
        .orderBy(desc(approachPlates.createdAt))
        .limit(limit);
    }

    const like = `%${trimmed.toUpperCase()}%`;
    const searchCondition = or(
      ilike(approachPlates.icao, like),
      ilike(approachPlates.procedureName, like),
      ilike(approachPlates.fileName, like),
      ilike(approachPlates.airportName, like),
    );
    return await db
      .select()
      .from(approachPlates)
      .where(cycle ? and(searchCondition, eq(approachPlates.cycle, cycle)) : searchCondition)
      .orderBy(desc(approachPlates.createdAt))
      .limit(limit);
  }

  async getApproachPlateById(id: string): Promise<ApproachPlate | undefined> {
    const [plate] = await db.select().from(approachPlates).where(eq(approachPlates.id, id));
    return plate;
  }

  async replaceApproachPlatesForCycle(cycle: string, plates: InsertApproachPlate[]): Promise<number> {
    await db.delete(approachPlates).where(eq(approachPlates.cycle, cycle));
    if (!plates.length) return 0;
    const inserted = await db.insert(approachPlates).values(plates).returning({ id: approachPlates.id });
    return inserted.length;
  }

  async insertApproachPlates(plates: InsertApproachPlate[]): Promise<number> {
    if (!plates.length) return 0;
    const inserted = await db.insert(approachPlates).values(plates).returning({ id: approachPlates.id });
    return inserted.length;
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

  // Withdrawal Requests (PayPal Payouts)
  async getUserBalance(userId: string): Promise<string> {
    const user = await this.getUser(userId);
    return user?.balance || "0.00";
  }

  async addToUserBalance(userId: string, amount: number): Promise<User | undefined> {
    // Atomic balance increment using SQL to avoid race conditions
    const [updatedUser] = await db
      .update(users)
      .set({ 
        balance: sql`CAST(COALESCE(${users.balance}, '0') AS DECIMAL(10,2)) + ${amount}`,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
  }

  async deductFromUserBalance(userId: string, amount: number): Promise<User | undefined> {
    // Atomic balance decrement with sufficient balance check in WHERE clause to avoid race conditions
    const [updatedUser] = await db
      .update(users)
      .set({ 
        balance: sql`CAST(COALESCE(${users.balance}, '0') AS DECIMAL(10,2)) - ${amount}`,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(users.id, userId),
          sql`CAST(COALESCE(${users.balance}, '0') AS DECIMAL(10,2)) >= ${amount}`
        )
      )
      .returning();
    
    if (!updatedUser) {
      throw new Error("Insufficient balance");
    }
    
    return updatedUser;
  }

  async createWithdrawalRequest(insertRequest: InsertWithdrawalRequest): Promise<WithdrawalRequest> {
    const [request] = await db
      .insert(withdrawalRequests)
      .values(insertRequest)
      .returning();
    return request;
  }

  async getWithdrawalRequest(id: string): Promise<WithdrawalRequest | undefined> {
    const [request] = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.id, id));
    return request;
  }

  async getWithdrawalRequestsByUser(userId: string): Promise<WithdrawalRequest[]> {
    return await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, userId))
      .orderBy(desc(withdrawalRequests.createdAt));
  }

  async getPendingWithdrawalRequests(): Promise<WithdrawalRequest[]> {
    return await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.status, "pending"))
      .orderBy(desc(withdrawalRequests.createdAt));
  }

  async getAllWithdrawalRequests(): Promise<WithdrawalRequest[]> {
    return await db
      .select()
      .from(withdrawalRequests)
      .orderBy(desc(withdrawalRequests.createdAt));
  }

  async updateWithdrawalRequest(id: string, updates: Partial<WithdrawalRequest>): Promise<WithdrawalRequest | undefined> {
    const [request] = await db
      .update(withdrawalRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(withdrawalRequests.id, id))
      .returning();
    return request;
  }

  // Pilot Logbook Entries
  async createLogbookEntry(insertEntry: InsertLogbookEntry & { userId: string }): Promise<LogbookEntry> {
    const dataToInsert = {
      ...insertEntry,
      flightDate: insertEntry.flightDate instanceof Date 
        ? insertEntry.flightDate.toISOString().split('T')[0]
        : insertEntry.flightDate,
    };
    const [entry] = await db.insert(logbookEntries).values(dataToInsert as any).returning();
    return entry;
  }

  async getLogbookEntryById(id: string): Promise<LogbookEntry | undefined> {
    const [entry] = await db.select().from(logbookEntries).where(eq(logbookEntries.id, id));
    return entry;
  }

  async getLogbookEntriesByUser(userId: string): Promise<LogbookEntry[]> {
    return await db.select().from(logbookEntries).where(eq(logbookEntries.userId, userId)).orderBy(desc(logbookEntries.flightDate));
  }

  async updateLogbookEntry(id: string, updates: Partial<LogbookEntry>): Promise<LogbookEntry | undefined> {
    // Prevent editing locked entries
    const existing = await this.getLogbookEntryById(id);
    if (existing?.isLocked) {
      throw new Error("Cannot edit a locked logbook entry");
    }
    const [entry] = await db.update(logbookEntries).set({ ...updates, updatedAt: new Date() }).where(eq(logbookEntries.id, id)).returning();
    return entry;
  }

  async unlockLogbookEntry(id: string): Promise<LogbookEntry | undefined> {
    const existing = await this.getLogbookEntryById(id);
    if (!existing) {
      throw new Error("Logbook entry not found");
    }
    if (!existing.isLocked) {
      return existing;
    }
    const [entry] = await db
      .update(logbookEntries)
      .set({
        isLocked: false,
        signatureDataUrl: null,
        signedByName: null,
        signedAt: null,
        signatureIp: null,
        cfiSignatureDataUrl: null,
        cfiSignedByName: null,
        cfiSignedAt: null,
        cfiSignatureIp: null,
        updatedAt: new Date(),
      })
      .where(eq(logbookEntries.id, id))
      .returning();
    return entry;
  }

  async lockLogbookEntry(id: string, signatureDataUrl: string, signedByName: string, signatureIp?: string): Promise<LogbookEntry | undefined> {
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
      signedAt: new Date(),
      signatureIp,
      updatedAt: new Date(),
    }).where(eq(logbookEntries.id, id)).returning();
    return entry;
  }

  async countersignLogbookEntry(id: string, signatureDataUrl: string, signedByName: string, signatureIp?: string): Promise<LogbookEntry | undefined> {
    const existing = await this.getLogbookEntryById(id);
    if (!existing) {
      throw new Error("Logbook entry not found");
    }
    // Allow countersign on locked entry; do not change flight data
    const [entry] = await db.update(logbookEntries).set({
      cfiSignatureDataUrl: signatureDataUrl,
      cfiSignedByName: signedByName,
      cfiSignedAt: new Date(),
      cfiSignatureIp: signatureIp,
      updatedAt: new Date(),
    }).where(eq(logbookEntries.id, id)).returning();
    return entry;
  }

  async deleteLogbookEntry(id: string): Promise<boolean> {
    // Prevent deletion of locked entries
    const existing = await this.getLogbookEntryById(id);
    if (existing?.isLocked) {
      throw new Error("Cannot delete a locked logbook entry");
    }
    const result = await db.delete(logbookEntries).where(eq(logbookEntries.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
}

export const storage = new DatabaseStorage();
