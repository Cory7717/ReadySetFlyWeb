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
  type AirportFavorite,
  type InsertAirportFavorite,
  type Transaction,
  type AnalyticsEvent,
  type InsertAnalyticsEvent,
  type PaypalOrderConsumption,
  type InsertPaypalOrderConsumption,
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
  type CrmWeeklyReport,
  type InsertCrmWeeklyReport,
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
  type HkDailyMetric,
  type InsertHkDailyMetric,
  type HkAttendantMetric,
  type InsertHkAttendantMetric,
  type WithdrawalRequest,
  type InsertWithdrawalRequest,
  type RefreshToken,
  type InsertRefreshToken,
  type OAuthExchangeToken,
  type InsertOAuthExchangeToken,
  type ContactSubmission,
  type InsertContactSubmission,
  type InvestorDeckAccessLog,
  type InsertInvestorDeckAccessLog,
  type PromoCode,
  type InsertPromoCode,
  type PromoCodeUsage,
  type InsertPromoCodeUsage,
  type AdminInvite,
  type InsertAdminInvite,
  type PartnerToolMetric,
  type LogbookEntry,
  type InsertLogbookEntry,
  type LogbookProSettings,
  type InsertLogbookProSettings,
  type LogbookArchive,
  type InsertLogbookArchive,
  type NotificationPreferences,
  type InsertNotificationPreferences,
  type CfiProfile,
  type InsertCfiProfile,
  type CfiSchool,
  type InsertCfiSchool,
  type CfiSchoolMember,
  type InsertCfiSchoolMember,
  type CfiCredential,
  type InsertCfiCredential,
  type CfiAvailabilityRule,
  type InsertCfiAvailabilityRule,
  type CfiBookingRequest,
  type InsertCfiBookingRequest,
  type CfiStudent,
  type InsertCfiStudent,
  type CfiLessonTemplate,
  type InsertCfiLessonTemplate,
  type CfiLesson,
  type InsertCfiLesson,
  type CfiStudentFile,
  type InsertCfiStudentFile,
  type CfiStudentMilestone,
  type InsertCfiStudentMilestone,
  type CfiStudentEndorsement,
  type InsertCfiStudentEndorsement,
  type CfiConversation,
  type InsertCfiConversation,
  type CfiMessage,
  type InsertCfiMessage,
  type CfiLegalAcceptance,
  type InsertCfiLegalAcceptance,
  type FlyingClub,
  type InsertFlyingClub,
  type FlyingClubMember,
  type InsertFlyingClubMember,
  type FlyingClubAircraft,
  type InsertFlyingClubAircraft,
  type FlyingClubReservation,
  type InsertFlyingClubReservation,
  type FlyingClubAnnouncement,
  type InsertFlyingClubAnnouncement,
  type FlyingClubDocument,
  type InsertFlyingClubDocument,
  type UserSettings,
  type InsertUserSettings,
  type PushToken,
  type InsertPushToken,
  type UserNotification,
  type InsertUserNotification,
  type Endorsement,
  type InsertEndorsement,
  type RadioCommsSession,
  type InsertRadioCommsSession,
  type StudentProfile,
  type InsertStudentProfile,
  type FlightPlan,
  type InsertFlightPlan,
  type AircraftType,
  type InsertAircraftType,
  type AircraftProfile,
  type InsertAircraftProfile,
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
  airportFavorites,
  transactions,
  analyticsEvents,
  paypalOrderConsumptions,
  withdrawalRequests,
  verificationSubmissions,
  crmLeads,
  crmContacts,
  crmDeals,
  crmActivities,
  crmWeeklyReports,
  expenses,
  adminNotifications,
  bannerAds,
  bannerAdOrders,
  jobApplications,
  promoAlerts,
  hkDailyMetrics,
  hkAttendantMetrics,
  hkRoomsSoldImports,
  promoCodes,
  promoCodeUsages,
  refreshTokens,
  oauthExchangeTokens,
  contactSubmissions,
  investorDeckAccessLogs,
  logbookEntries,
  logbookProSettings,
  logbookArchives,
  notificationPreferences,
  cfiProfiles,
  cfiSchools,
  cfiSchoolMembers,
  cfiCredentials,
  cfiAvailabilityRules,
  cfiBookingRequests,
  cfiStudents,
  cfiLessonTemplates,
  cfiLessons,
  cfiStudentFiles,
  cfiStudentMilestones,
  cfiStudentEndorsements,
  cfiConversations,
  cfiMessages,
  cfiLegalAcceptances,
  flyingClubs,
  flyingClubMembers,
  flyingClubAircraft,
  flyingClubReservations,
  flyingClubAnnouncements,
  flyingClubDocuments,
  userSettings,
  pushTokens,
  userNotifications,
  endorsements,
  radioCommsSessions,
  studentProfiles,
  flightPlans,
  aircraftTypes,
  aircraftProfiles,
  approachPlates,
  adminInvites,
  partnerToolMetrics,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, or, ilike, gte, lte, sql, inArray, isNull, arrayOverlaps } from "drizzle-orm";
import { buildCrmEmailResubscribeUpdate, buildCrmEmailUnsubscribeUpdate, canSendEmail, preserveLeadEmailSuppression } from "./crmEmailSuppression";

function normalizeDateOnly(value: string | Date | null | undefined): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  return value.toISOString().slice(0, 10);
}

function toRequiredDateOnly(value: string | Date | null | undefined, fieldName: string): string {
  const normalized = normalizeDateOnly(value);
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
}

function normalizeTimestampInput(value: string | Date | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return value instanceof Date ? value : new Date(value);
}

function toDecimalString(value: number | string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return typeof value === "number" ? String(value) : value;
}

function toRequiredDecimalString(value: number | string, fieldName: string): string {
  const normalized = toDecimalString(value);
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
}

function normalizeBannerVideoOrientation(
  value: string | null | undefined
): "landscape" | "portrait" | null | undefined {
  if (value == null || value === "") return undefined;
  return value === "portrait" ? "portrait" : "landscape";
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByLogbookSubscriptionId(subscriptionId: string): Promise<User | undefined>;
  getUserByPayPalSubscriptionId(subscriptionId: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getAdminInviteByEmail(email: string): Promise<AdminInvite | undefined>;
  getAdminInviteByToken(token: string): Promise<AdminInvite | undefined>;
  listAdminInvites(): Promise<AdminInvite[]>;
  createAdminInvite(invite: InsertAdminInvite): Promise<AdminInvite>;
  acceptAdminInvite(id: string, userId: string): Promise<AdminInvite | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getAdminUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
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

  // Flying Clubs
  getFlyingClubs(): Promise<FlyingClub[]>;
  getFlyingClub(id: string): Promise<FlyingClub | undefined>;
  getFlyingClubBySlug(slug: string): Promise<FlyingClub | undefined>;
  getFlyingClubsByMember(userId: string): Promise<FlyingClub[]>;
  getFlyingClubMembership(clubId: string, userId: string): Promise<FlyingClubMember | undefined>;
  createFlyingClub(club: InsertFlyingClub & { ownerUserId: string }): Promise<FlyingClub>;
  updateFlyingClub(id: string, updates: Partial<FlyingClub>): Promise<FlyingClub | undefined>;
  getFlyingClubMembers(clubId: string): Promise<FlyingClubMember[]>;
  addFlyingClubMember(member: InsertFlyingClubMember & { clubId: string; userId: string }): Promise<FlyingClubMember>;
  getFlyingClubAircraft(clubId: string): Promise<FlyingClubAircraft[]>;
  addFlyingClubAircraft(aircraft: InsertFlyingClubAircraft & { clubId: string }): Promise<FlyingClubAircraft>;
  getFlyingClubReservations(clubId: string): Promise<FlyingClubReservation[]>;
  createFlyingClubReservation(reservation: InsertFlyingClubReservation & { clubId: string; memberUserId: string }): Promise<FlyingClubReservation>;
  getFlyingClubAnnouncements(clubId: string): Promise<FlyingClubAnnouncement[]>;
  createFlyingClubAnnouncement(announcement: InsertFlyingClubAnnouncement & { clubId: string; authorUserId: string }): Promise<FlyingClubAnnouncement>;
  getFlyingClubDocuments(clubId: string): Promise<FlyingClubDocument[]>;
  createFlyingClubDocument(document: InsertFlyingClubDocument & { clubId: string; uploadedByUserId: string }): Promise<FlyingClubDocument>;

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

  // Airport Favorites + Alerts
  addAirportFavorite(userId: string, payload: Omit<InsertAirportFavorite, "userId">): Promise<AirportFavorite>;
  removeAirportFavorite(userId: string, icao: string): Promise<boolean>;
  checkAirportFavorite(userId: string, icao: string): Promise<boolean>;
  getAirportFavorites(userId: string): Promise<AirportFavorite[]>;
  updateAirportFavoriteAlerts(
    userId: string,
    icao: string,
    updates: { alertIfr?: boolean; alertMvfr?: boolean }
  ): Promise<AirportFavorite | null>;
  updateAirportFavoriteObservation(
    favoriteId: string,
    updates: {
      lastObservedCategory?: string | null;
      lastObservedAt?: Date | null;
      lastAlertCategory?: string | null;
      lastAlertAt?: Date | null;
    }
  ): Promise<void>;
  getAirportFavoritesWithAlerts(): Promise<AirportFavorite[]>;

  // Transactions
  getTransactionsByUser(userId: string): Promise<Transaction[]>;
  createTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction>;
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined>;

  // PayPal Order Consumption (replay protection)
  isPayPalOrderConsumed(orderId: string): Promise<boolean>;
  consumePayPalOrder(consumption: InsertPaypalOrderConsumption): Promise<PaypalOrderConsumption | null>;

  // Verification Submissions
  createVerificationSubmission(submission: InsertVerificationSubmission): Promise<VerificationSubmission>;
  getVerificationSubmissionById(id: string): Promise<VerificationSubmission | undefined>;
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
  createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent>;
  getFeatureUsage(days: number): Promise<{
    rangeDays: number;
    totalEvents: number;
    uniqueVisitors: number;
    returningVisitors: number;
    guestEvents: number;
    guestVisitors: number;
    pages: Array<{
      key: string;
      totalEvents: number;
      uniqueVisitors: number;
      returningVisitors: number;
    }>;
  }>;

  // CRM - Leads
  getAllLeads(): Promise<CrmLead[]>;
  getLead(id: string): Promise<CrmLead | undefined>;
  getLeadByEmail(email: string): Promise<CrmLead | undefined>;
  unsubscribeLeadsByEmail(email: string): Promise<number>;
  isLeadEmailSuppressed(email: string): Promise<boolean>;
  resubscribeLeadEmail(id: string): Promise<CrmLead | undefined>;
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

  // CRM - Weekly Reports
  getAllWeeklyReports(): Promise<CrmWeeklyReport[]>;
  getWeeklyReport(id: string): Promise<CrmWeeklyReport | undefined>;
  createWeeklyReport(report: InsertCrmWeeklyReport & { preparedBy: string }): Promise<CrmWeeklyReport>;
  updateWeeklyReport(id: string, updates: Partial<CrmWeeklyReport>): Promise<CrmWeeklyReport | undefined>;
  deleteWeeklyReport(id: string): Promise<boolean>;
  
  // Expenses (for admin analytics)
  getAllExpenses(): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, updates: Partial<Expense>): Promise<Expense | undefined>;

  // Housekeeping metrics
  getHkDailyMetrics(startDate: string, endDate: string, property?: string | null): Promise<HkDailyMetric[]>;
  getHkDailyMetricsForDates(property: string, dates: string[]): Promise<HkDailyMetric[]>;
  upsertHkDailyMetric(metric: InsertHkDailyMetric & { createdBy?: string | null }): Promise<HkDailyMetric>;
  upsertHkDailyMetricFields(metric: {
    metricDate: string;
    property: string;
    roomsSold?: number | null;
    totalDailyHours?: string | null;
    roomRevenueDaily?: string | null;
    roomRevenueMtd?: string | null;
    occupiedRooms?: number | null;
    notes?: string | null;
    roomsSoldImported?: boolean | null;
    roomsSoldImportedAt?: Date | null;
    createdBy?: string | null;
  }): Promise<HkDailyMetric>;
  createHkRoomsSoldImport(importRecord: {
    uploadedBy?: string | null;
    filenames: string[];
    parsedCount: number;
    updatedCount: number;
    skippedCount: number;
    conflictCount: number;
    details: any;
  }): Promise<void>;
  getHkAttendantMetrics(startDate: string, endDate: string, property?: string | null): Promise<HkAttendantMetric[]>;
  upsertHkAttendantMetric(metric: InsertHkAttendantMetric & { createdBy?: string | null }): Promise<HkAttendantMetric>;
  listHkProperties(): Promise<string[]>;
  
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
  createInvestorDeckAccessLog(log: InsertInvestorDeckAccessLog): Promise<InvestorDeckAccessLog>;
  
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

  // Partner Tool Metrics
  getPartnerToolMetrics(): Promise<PartnerToolMetric[]>;
  incrementPartnerToolImpressions(partner: string): Promise<void>;
  incrementPartnerToolClicks(partner: string): Promise<void>;
  
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
  getActiveLogbookProUsers(): Promise<User[]>;

  // Logbook Archives
  createLogbookArchive(data: InsertLogbookArchive & { userId: string }): Promise<LogbookArchive>;
  getLogbookArchivesByUser(userId: string): Promise<LogbookArchive[]>;
  getLogbookArchiveById(id: string): Promise<LogbookArchive | undefined>;
  deleteLogbookArchive(id: string, userId: string): Promise<boolean>;

  // Notification Preferences + User Notifications
  getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined>;
  upsertNotificationPreferences(userId: string, updates: InsertNotificationPreferences): Promise<NotificationPreferences>;
  // CFI Booking Platform
  getCfiProfileByUser(userId: string): Promise<CfiProfile | undefined>;
  getCfiProfileBySlug(slug: string): Promise<CfiProfile | undefined>;
  getCfiProfileById(id: string): Promise<CfiProfile | undefined>;
  listPublishedCfiProfiles(filters?: { q?: string; state?: string; airport?: string }): Promise<CfiProfile[]>;
  createCfiProfile(profile: InsertCfiProfile & { userId: string }): Promise<CfiProfile>;
  updateCfiProfile(id: string, userId: string, updates: Partial<CfiProfile>): Promise<CfiProfile | undefined>;
  getCfiSchoolByOwner(userId: string): Promise<CfiSchool | undefined>;
  getCfiSchoolBySlug(slug: string): Promise<CfiSchool | undefined>;
  getCfiSchoolById(id: string): Promise<CfiSchool | undefined>;
  getCfiSchoolMembership(schoolId: string, userId: string): Promise<CfiSchoolMember | undefined>;
  listCfiSchoolsForUser(userId: string): Promise<CfiSchool[]>;
  listCfiSchoolMembershipsForUser(userId: string): Promise<CfiSchoolMember[]>;
  listCfiSchoolMembers(schoolId: string): Promise<CfiSchoolMember[]>;
  createCfiSchool(school: InsertCfiSchool & { ownerUserId: string }): Promise<CfiSchool>;
  updateCfiSchool(id: string, updates: Partial<CfiSchool>): Promise<CfiSchool | undefined>;
  addCfiSchoolMember(member: InsertCfiSchoolMember & { schoolId: string; userId: string }): Promise<CfiSchoolMember>;
  removeCfiSchoolMember(id: string, schoolId: string): Promise<boolean>;
  getCfiCredentials(profileId: string): Promise<CfiCredential[]>;
  createCfiCredential(credential: InsertCfiCredential & { cfiProfileId: string }): Promise<CfiCredential>;
  deleteCfiCredential(id: string, profileId: string): Promise<boolean>;
  getCfiAvailabilityRules(profileId: string): Promise<CfiAvailabilityRule[]>;
  replaceCfiAvailabilityRules(profileId: string, rules: InsertCfiAvailabilityRule[]): Promise<CfiAvailabilityRule[]>;
  createCfiAvailabilityRule(rule: InsertCfiAvailabilityRule & { cfiProfileId: string }): Promise<CfiAvailabilityRule>;
  updateCfiAvailabilityRule(id: string, profileId: string, updates: Partial<CfiAvailabilityRule>): Promise<CfiAvailabilityRule | undefined>;
  deleteCfiAvailabilityRule(id: string, profileId: string): Promise<boolean>;
  createCfiBookingRequest(request: InsertCfiBookingRequest & { cfiProfileId: string; studentUserId: string }): Promise<CfiBookingRequest>;
  getCfiBookingRequest(id: string): Promise<CfiBookingRequest | undefined>;
  getCfiBookingRequestsForCfi(profileId: string): Promise<CfiBookingRequest[]>;
  getCfiBookingRequestsForStudent(userId: string): Promise<CfiBookingRequest[]>;
  updateCfiBookingRequest(id: string, updates: Partial<CfiBookingRequest>): Promise<CfiBookingRequest | undefined>;
  getCfiStudentsByProfile(profileId: string): Promise<CfiStudent[]>;
  getCfiStudentById(id: string): Promise<CfiStudent | undefined>;
  getCfiStudentByProfileAndUser(profileId: string, studentUserId: string): Promise<CfiStudent | undefined>;
  getCfiStudentByStudentUser(userId: string): Promise<CfiStudent | undefined>;
  createCfiStudent(student: InsertCfiStudent & { cfiProfileId: string; studentUserId: string }): Promise<CfiStudent>;
  updateCfiStudent(id: string, profileId: string, updates: Partial<CfiStudent>): Promise<CfiStudent | undefined>;
  deleteCfiStudent(id: string, profileId: string): Promise<boolean>;
  getCfiLessonTemplates(profileId: string): Promise<CfiLessonTemplate[]>;
  createCfiLessonTemplate(template: InsertCfiLessonTemplate & { cfiProfileId: string }): Promise<CfiLessonTemplate>;
  updateCfiLessonTemplate(id: string, profileId: string, updates: Partial<CfiLessonTemplate>): Promise<CfiLessonTemplate | undefined>;
  deleteCfiLessonTemplate(id: string, profileId: string): Promise<boolean>;
  getCfiLessonsByStudent(studentId: string): Promise<CfiLesson[]>;
  getCfiLessonById(id: string): Promise<CfiLesson | undefined>;
  createCfiLesson(lesson: InsertCfiLesson & { cfiProfileId: string; studentId: string }): Promise<CfiLesson>;
  updateCfiLesson(id: string, profileId: string, updates: Partial<InsertCfiLesson>): Promise<CfiLesson | undefined>;
  deleteCfiLesson(id: string, profileId: string): Promise<boolean>;
  getCfiStudentFiles(studentId: string): Promise<CfiStudentFile[]>;
  getCfiStudentFileById(id: string): Promise<CfiStudentFile | undefined>;
  createCfiStudentFile(file: InsertCfiStudentFile & { studentId: string; uploadedByUserId: string }): Promise<CfiStudentFile>;
  deleteCfiStudentFile(id: string, studentId: string): Promise<boolean>;
  getCfiStudentMilestones(studentId: string): Promise<CfiStudentMilestone[]>;
  getCfiStudentMilestoneById(id: string): Promise<CfiStudentMilestone | undefined>;
  createCfiStudentMilestone(milestone: InsertCfiStudentMilestone & { studentId: string }): Promise<CfiStudentMilestone>;
  updateCfiStudentMilestone(id: string, studentId: string, updates: Partial<CfiStudentMilestone>): Promise<CfiStudentMilestone | undefined>;
  deleteCfiStudentMilestone(id: string, studentId: string): Promise<boolean>;
  getCfiStudentEndorsements(studentId: string): Promise<CfiStudentEndorsement[]>;
  getCfiStudentEndorsementById(id: string): Promise<CfiStudentEndorsement | undefined>;
  createCfiStudentEndorsement(endorsement: InsertCfiStudentEndorsement & { studentId: string }): Promise<CfiStudentEndorsement>;
  updateCfiStudentEndorsement(id: string, studentId: string, updates: Partial<CfiStudentEndorsement>): Promise<CfiStudentEndorsement | undefined>;
  deleteCfiStudentEndorsement(id: string, studentId: string): Promise<boolean>;
  getCfiConversationById(id: string): Promise<CfiConversation | undefined>;
  getCfiConversation(profileId: string, studentId: string): Promise<CfiConversation | undefined>;
  getCfiConversationsByProfile(profileId: string): Promise<CfiConversation[]>;
  getCfiConversationsByStudent(studentId: string): Promise<CfiConversation[]>;
  createCfiConversation(conversation: InsertCfiConversation & { cfiProfileId: string; studentId: string }): Promise<CfiConversation>;
  updateCfiConversation(id: string, updates: Partial<CfiConversation>): Promise<CfiConversation | undefined>;
  getCfiMessages(conversationId: string): Promise<CfiMessage[]>;
  createCfiMessage(message: InsertCfiMessage & { conversationId: string; senderUserId: string }): Promise<CfiMessage>;
  createCfiLegalAcceptance(acceptance: InsertCfiLegalAcceptance & { userId: string }): Promise<CfiLegalAcceptance>;
  getCfiLatestLegalAcceptance(userId: string, acceptanceType: string): Promise<CfiLegalAcceptance | undefined>;
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  upsertUserSettings(userId: string, updates: InsertUserSettings): Promise<UserSettings>;
  getUserNotifications(userId: string, limit?: number): Promise<UserNotification[]>;
  getUnreadUserNotifications(userId: string): Promise<UserNotification[]>;
  getUserNotificationByTypeAndDate(userId: string, type: string, referenceDate: Date | null): Promise<UserNotification | undefined>;
  createUserNotification(notification: InsertUserNotification & { userId: string }): Promise<UserNotification>;
  markUserNotificationRead(id: string, userId: string): Promise<UserNotification | undefined>;

  // Push Tokens
  upsertPushToken(userId: string, token: InsertPushToken): Promise<PushToken>;
  getPushTokensByUser(userId: string): Promise<PushToken[]>;

  // Endorsements
  getEndorsementsByUser(userId: string): Promise<Endorsement[]>;
  createEndorsement(endorsement: InsertEndorsement & { userId: string }): Promise<Endorsement>;
  updateEndorsement(id: string, userId: string, updates: Partial<Endorsement>): Promise<Endorsement | undefined>;
  deleteEndorsement(id: string, userId: string): Promise<boolean>;

  // Radio Comms Sessions
  getRadioCommsSessionsByUser(userId: string, limit?: number): Promise<RadioCommsSession[]>;
  createRadioCommsSession(session: InsertRadioCommsSession & { userId: string }): Promise<RadioCommsSession>;

  // Student Profiles
  getStudentProfile(userId: string): Promise<StudentProfile | undefined>;
  upsertStudentProfile(userId: string, updates: InsertStudentProfile): Promise<StudentProfile>;

  // Flight Planner
  getFlightPlansByUser(userId: string): Promise<FlightPlan[]>;
  getFlightPlanById(id: string): Promise<FlightPlan | undefined>;
  createFlightPlan(plan: InsertFlightPlan & { userId: string }): Promise<FlightPlan>;
  updateFlightPlan(id: string, updates: Partial<FlightPlan>): Promise<FlightPlan | undefined>;
  deleteFlightPlan(id: string): Promise<boolean>;

  // Aircraft Library (RSF)
  getAircraftTypes(filters?: {
    q?: string;
    category?: string;
    engineType?: string;
    limit?: number;
    offset?: number;
  }): Promise<AircraftType[]>;
  getAircraftTypeById(id: string): Promise<AircraftType | undefined>;
  getAircraftTypesByIds(ids: string[]): Promise<AircraftType[]>;
  createAircraftType(type: InsertAircraftType): Promise<AircraftType>;
  updateAircraftType(id: string, updates: Partial<AircraftType>): Promise<AircraftType | undefined>;
  deleteAircraftType(id: string): Promise<boolean>;

  // Aircraft Profiles (Flight Planner)
  getAircraftProfilesByUser(userId: string): Promise<AircraftProfile[]>;
  getAircraftProfileById(id: string): Promise<AircraftProfile | undefined>;
  createAircraftProfile(profile: InsertAircraftProfile & { userId: string }): Promise<AircraftProfile>;
  updateAircraftProfile(id: string, updates: Partial<AircraftProfile>): Promise<AircraftProfile | undefined>;
  deleteAircraftProfile(id: string): Promise<boolean>;

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

  async getUserByLogbookSubscriptionId(subscriptionId: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.logbookProSubscriptionId, subscriptionId))
      .limit(1);
    return result[0];
  }

  async getUserByPayPalSubscriptionId(subscriptionId: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.paypalSubscriptionId, subscriptionId))
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

  async getAdminUsers(): Promise<User[]> {
    return db.select().from(users).where(eq(users.isAdmin, true)).orderBy(desc(users.createdAt));
  }

  async getAdminInviteByEmail(email: string): Promise<AdminInvite | undefined> {
    const result = await db
      .select()
      .from(adminInvites)
      .where(and(eq(adminInvites.email, email.toLowerCase()), isNull(adminInvites.acceptedAt)))
      .orderBy(desc(adminInvites.createdAt))
      .limit(1);
    return result[0];
  }

  async getAdminInviteByToken(token: string): Promise<AdminInvite | undefined> {
    const result = await db
      .select()
      .from(adminInvites)
      .where(eq(adminInvites.token, token))
      .limit(1);
    return result[0];
  }

  async listAdminInvites(): Promise<AdminInvite[]> {
    return db.select().from(adminInvites).orderBy(desc(adminInvites.createdAt));
  }

  async createAdminInvite(invite: InsertAdminInvite): Promise<AdminInvite> {
    const [created] = await db.insert(adminInvites).values(invite).returning();
    return created;
  }

  async acceptAdminInvite(id: string, userId: string): Promise<AdminInvite | undefined> {
    const [invite] = await db
      .update(adminInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(adminInvites.id, id))
      .returning();

    if (!invite) return undefined;

    await db
      .update(users)
      .set({ isAdmin: true, adminRole: invite.role, adminPermissions: invite.permissions })
      .where(eq(users.id, userId));

    return invite;
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
    const trimmed = query.trim();
    if (!trimmed) return [];

    const normalized = trimmed.toLowerCase();
    const idQuery = normalized.startsWith("id:") ? trimmed.slice(3).trim() : "";
    if (idQuery) {
      return await db
        .select()
        .from(users)
        .where(ilike(users.id, `${idQuery}%`))
        .orderBy(asc(users.firstName), asc(users.lastName))
        .limit(25);
    }

    const emailQuery = normalized.includes("@") ? trimmed : "";
    if (emailQuery) {
      const emailPrefix = `${emailQuery}%`;
      const emailContains = `%${emailQuery}%`;
      return await db
        .select()
        .from(users)
        .where(ilike(users.email, emailContains))
        .orderBy(
          sql`CASE
            WHEN lower(${users.email}) = lower(${emailQuery}) THEN 0
            WHEN lower(${users.email}) LIKE lower(${emailPrefix}) THEN 1
            ELSE 2
          END`,
          asc(users.email),
        )
        .limit(25);
    }

    if (trimmed.length < 2) {
      return [];
    }

    const tokens = trimmed.split(/\s+/).filter(Boolean);
    const firstToken = tokens[0] || "";
    const secondToken = tokens[1] || "";
    const firstPrefix = `${firstToken}%`;
    const fullPrefix = `${trimmed}%`;
    const containsPattern = trimmed.length >= 3 ? `%${trimmed}%` : "";
    const searchConditions = [
      ilike(users.firstName, firstPrefix),
      ilike(users.lastName, firstPrefix),
      sql`concat(coalesce(${users.firstName}, ''), ' ', coalesce(${users.lastName}, '')) ILIKE ${fullPrefix}`,
    ];

    if (secondToken) {
      const secondTokenCondition = and(
        ilike(users.firstName, `${firstToken}%`),
        ilike(users.lastName, `${secondToken}%`),
      );
      if (secondTokenCondition) {
        searchConditions.push(secondTokenCondition);
      }
    }

    if (containsPattern) {
      searchConditions.push(ilike(users.email, containsPattern));
      searchConditions.push(ilike(users.firstName, containsPattern));
      searchConditions.push(ilike(users.lastName, containsPattern));
    }

    return await db
      .select()
      .from(users)
      .where(or(...searchConditions))
      .orderBy(
        sql`CASE
          WHEN lower(concat(coalesce(${users.firstName}, ''), ' ', coalesce(${users.lastName}, ''))) = lower(${trimmed}) THEN 0
          WHEN lower(${users.firstName}) = lower(${trimmed}) THEN 1
          WHEN lower(${users.lastName}) = lower(${trimmed}) THEN 2
          WHEN lower(${users.firstName}) LIKE lower(${firstPrefix}) THEN 3
          WHEN lower(${users.lastName}) LIKE lower(${firstPrefix}) THEN 4
          WHEN lower(concat(coalesce(${users.firstName}, ''), ' ', coalesce(${users.lastName}, ''))) LIKE lower(${fullPrefix}) THEN 5
          ELSE 6
        END`,
        asc(users.firstName),
        asc(users.lastName),
      )
      .limit(25);
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
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

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
        .where(gte(users.createdAt, firstOfMonth));
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

  // Flying Clubs
  async getFlyingClubs(): Promise<FlyingClub[]> {
    return await db
      .select()
      .from(flyingClubs)
      .where(
        and(
          eq(flyingClubs.status, "active"),
          eq(flyingClubs.visibility, "listed"),
        )
      )
      .orderBy(asc(flyingClubs.name));
  }

  async getFlyingClub(id: string): Promise<FlyingClub | undefined> {
    const [club] = await db
      .select()
      .from(flyingClubs)
      .where(eq(flyingClubs.id, id))
      .limit(1);
    return club;
  }

  async getFlyingClubBySlug(slug: string): Promise<FlyingClub | undefined> {
    const [club] = await db
      .select()
      .from(flyingClubs)
      .where(eq(flyingClubs.slug, slug))
      .limit(1);
    return club;
  }

  async getFlyingClubsByMember(userId: string): Promise<FlyingClub[]> {
    return await db
      .select({ club: flyingClubs })
      .from(flyingClubMembers)
      .innerJoin(flyingClubs, eq(flyingClubMembers.clubId, flyingClubs.id))
      .where(eq(flyingClubMembers.userId, userId))
      .orderBy(asc(flyingClubs.name))
      .then((rows) => rows.map((row) => row.club));
  }

  async getFlyingClubMembership(clubId: string, userId: string): Promise<FlyingClubMember | undefined> {
    const [membership] = await db
      .select()
      .from(flyingClubMembers)
      .where(and(eq(flyingClubMembers.clubId, clubId), eq(flyingClubMembers.userId, userId)))
      .limit(1);
    return membership;
  }

  async createFlyingClub(club: InsertFlyingClub & { ownerUserId: string }): Promise<FlyingClub> {
    const [created] = await db
      .insert(flyingClubs)
      .values(club)
      .returning();
    return created;
  }

  async updateFlyingClub(id: string, updates: Partial<FlyingClub>): Promise<FlyingClub | undefined> {
    const [updated] = await db
      .update(flyingClubs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(flyingClubs.id, id))
      .returning();
    return updated;
  }

  async getFlyingClubMembers(clubId: string): Promise<FlyingClubMember[]> {
    return await db
      .select()
      .from(flyingClubMembers)
      .where(eq(flyingClubMembers.clubId, clubId))
      .orderBy(asc(flyingClubMembers.role), asc(flyingClubMembers.createdAt));
  }

  async addFlyingClubMember(member: InsertFlyingClubMember & { clubId: string; userId: string }): Promise<FlyingClubMember> {
    const [created] = await db
      .insert(flyingClubMembers)
      .values(member)
      .returning();
    return created;
  }

  async getFlyingClubAircraft(clubId: string): Promise<FlyingClubAircraft[]> {
    return await db
      .select()
      .from(flyingClubAircraft)
      .where(eq(flyingClubAircraft.clubId, clubId))
      .orderBy(asc(flyingClubAircraft.displayName));
  }

  async addFlyingClubAircraft(aircraft: InsertFlyingClubAircraft & { clubId: string }): Promise<FlyingClubAircraft> {
    const [created] = await db
      .insert(flyingClubAircraft)
      .values(aircraft)
      .returning();
    return created;
  }

  async getFlyingClubReservations(clubId: string): Promise<FlyingClubReservation[]> {
    return await db
      .select()
      .from(flyingClubReservations)
      .where(eq(flyingClubReservations.clubId, clubId))
      .orderBy(desc(flyingClubReservations.startAt));
  }

  async createFlyingClubReservation(reservation: InsertFlyingClubReservation & { clubId: string; memberUserId: string }): Promise<FlyingClubReservation> {
    const [created] = await db
      .insert(flyingClubReservations)
      .values(reservation)
      .returning();
    return created;
  }

  async getFlyingClubAnnouncements(clubId: string): Promise<FlyingClubAnnouncement[]> {
    return await db
      .select()
      .from(flyingClubAnnouncements)
      .where(eq(flyingClubAnnouncements.clubId, clubId))
      .orderBy(desc(flyingClubAnnouncements.isPinned), desc(flyingClubAnnouncements.createdAt));
  }

  async createFlyingClubAnnouncement(announcement: InsertFlyingClubAnnouncement & { clubId: string; authorUserId: string }): Promise<FlyingClubAnnouncement> {
    const [created] = await db
      .insert(flyingClubAnnouncements)
      .values(announcement)
      .returning();
    return created;
  }

  async getFlyingClubDocuments(clubId: string): Promise<FlyingClubDocument[]> {
    return await db
      .select()
      .from(flyingClubDocuments)
      .where(eq(flyingClubDocuments.clubId, clubId))
      .orderBy(desc(flyingClubDocuments.createdAt));
  }

  async createFlyingClubDocument(document: InsertFlyingClubDocument & { clubId: string; uploadedByUserId: string }): Promise<FlyingClubDocument> {
    const [created] = await db
      .insert(flyingClubDocuments)
      .values(document)
      .returning();
    return created;
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
    const platformFeeRenter = baseCost * 0.075; // 7.5% platform fee for renter
    const platformFeeOwner = baseCost * 0.075; // 7.5% platform fee for owner
    const taxableSubtotal = baseCost + platformFeeRenter;
    const salesTax = taxableSubtotal * 0.0825; // 8.25% sales tax on rental + renter fee
    
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

  // Airport Favorites + Alerts
  async addAirportFavorite(userId: string, payload: Omit<InsertAirportFavorite, "userId">): Promise<AirportFavorite> {
    const icao = payload.icao.trim().toUpperCase();
    const existing = await db
      .select()
      .from(airportFavorites)
      .where(and(eq(airportFavorites.userId, userId), eq(airportFavorites.icao, icao)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(airportFavorites)
        .set({
          name: payload.name ?? existing[0].name,
          city: payload.city ?? existing[0].city,
          state: payload.state ?? existing[0].state,
          alertIfr: payload.alertIfr ?? existing[0].alertIfr,
          alertMvfr: payload.alertMvfr ?? existing[0].alertMvfr,
          updatedAt: new Date(),
        })
        .where(eq(airportFavorites.id, existing[0].id))
        .returning();
      return updated;
    }

    const [favorite] = await db
      .insert(airportFavorites)
      .values({
        userId,
        icao,
        name: payload.name ?? null,
        city: payload.city ?? null,
        state: payload.state ?? null,
        alertIfr: payload.alertIfr ?? false,
        alertMvfr: payload.alertMvfr ?? false,
      })
      .returning();
    return favorite;
  }

  async removeAirportFavorite(userId: string, icao: string): Promise<boolean> {
    const result = await db
      .delete(airportFavorites)
      .where(and(eq(airportFavorites.userId, userId), eq(airportFavorites.icao, icao.toUpperCase())))
      .returning();
    return result.length > 0;
  }

  async checkAirportFavorite(userId: string, icao: string): Promise<boolean> {
    const result = await db
      .select()
      .from(airportFavorites)
      .where(and(eq(airportFavorites.userId, userId), eq(airportFavorites.icao, icao.toUpperCase())))
      .limit(1);
    return result.length > 0;
  }

  async getAirportFavorites(userId: string): Promise<AirportFavorite[]> {
    return await db
      .select()
      .from(airportFavorites)
      .where(eq(airportFavorites.userId, userId))
      .orderBy(desc(airportFavorites.createdAt));
  }

  async updateAirportFavoriteAlerts(
    userId: string,
    icao: string,
    updates: { alertIfr?: boolean; alertMvfr?: boolean }
  ): Promise<AirportFavorite | null> {
    const [favorite] = await db
      .update(airportFavorites)
      .set({
        alertIfr: updates.alertIfr,
        alertMvfr: updates.alertMvfr,
        updatedAt: new Date(),
      })
      .where(and(eq(airportFavorites.userId, userId), eq(airportFavorites.icao, icao.toUpperCase())))
      .returning();
    return favorite ?? null;
  }

  async updateAirportFavoriteObservation(
    favoriteId: string,
    updates: {
      lastObservedCategory?: string | null;
      lastObservedAt?: Date | null;
      lastAlertCategory?: string | null;
      lastAlertAt?: Date | null;
    }
  ): Promise<void> {
    await db
      .update(airportFavorites)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(airportFavorites.id, favoriteId));
  }

  async getAirportFavoritesWithAlerts(): Promise<AirportFavorite[]> {
    return await db
      .select()
      .from(airportFavorites)
      .where(or(eq(airportFavorites.alertIfr, true), eq(airportFavorites.alertMvfr, true)));
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

  // PayPal Order Consumption (replay protection)
  async isPayPalOrderConsumed(orderId: string): Promise<boolean> {
    const [consumption] = await db
      .select({ id: paypalOrderConsumptions.id })
      .from(paypalOrderConsumptions)
      .where(eq(paypalOrderConsumptions.orderId, orderId))
      .limit(1);
    return !!consumption;
  }

  async consumePayPalOrder(consumption: InsertPaypalOrderConsumption): Promise<PaypalOrderConsumption | null> {
    const [record] = await db
      .insert(paypalOrderConsumptions)
      .values(consumption)
      .onConflictDoNothing({ target: paypalOrderConsumptions.orderId })
      .returning();
    return record ?? null;
  }

  // Verification Submissions
  async createVerificationSubmission(insertSubmission: InsertVerificationSubmission): Promise<VerificationSubmission> {
    const [submission] = await db
      .insert(verificationSubmissions)
      .values(insertSubmission)
      .returning();
    return submission;
  }

  async getVerificationSubmissionById(id: string): Promise<VerificationSubmission | undefined> {
    const [submission] = await db
      .select()
      .from(verificationSubmissions)
      .where(eq(verificationSubmissions.id, id));
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
      
      // Revenue transactions (completed only)
      const revenueTypes = new Set([
        'platform_fee',
        'marketplace_listing_fee',
        'marketplace_upgrade_fee',
        'listing_fee',
        'banner_ad_fee',
        'membership_fee',
      ]);
      const revenueTransactions = allTransactions.filter(
        t => revenueTypes.has(t.type) && t.status === 'completed'
      );
  
      const sumTransactions = (txs: typeof revenueTransactions) =>
        txs.reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);
  
      // Count transactions by time periods (revenue types only)
      const revenueTransactionsToday = revenueTransactions.filter(t => t.createdAt && t.createdAt >= today);
      const revenueTransactionsWeek = revenueTransactions.filter(t => t.createdAt && t.createdAt >= weekAgo);
      const revenueTransactionsMonth = revenueTransactions.filter(t => t.createdAt && t.createdAt >= firstOfMonth);
      const revenueTransactionsYear = revenueTransactions.filter(t => t.createdAt && t.createdAt >= firstOfYear);
  
      // Banner ad revenue (derived from paid orders, not transactions)
      const allBannerOrders = await db.select().from(bannerAdOrders);
      const paidBannerOrders = allBannerOrders.filter(o => o.paymentStatus === 'paid');
      const bannerOrderAmount = (order: typeof paidBannerOrders[number]) => {
        const original = parseFloat(order.grandTotal || "0");
        const discount = parseFloat(order.discountAmount || "0");
        return Math.max(0, original - discount);
      };
      const bannerOrdersToday = paidBannerOrders.filter(o => o.paypalPaymentDate && o.paypalPaymentDate >= today);
      const bannerOrdersWeek = paidBannerOrders.filter(o => o.paypalPaymentDate && o.paypalPaymentDate >= weekAgo);
      const bannerOrdersMonth = paidBannerOrders.filter(o => o.paypalPaymentDate && o.paypalPaymentDate >= firstOfMonth);
      const bannerOrdersYear = paidBannerOrders.filter(o => o.paypalPaymentDate && o.paypalPaymentDate >= firstOfYear);
  
      const bannerRevenueToday = bannerOrdersToday.reduce((sum, o) => sum + bannerOrderAmount(o), 0);
      const bannerRevenueWeek = bannerOrdersWeek.reduce((sum, o) => sum + bannerOrderAmount(o), 0);
      const bannerRevenueMonth = bannerOrdersMonth.reduce((sum, o) => sum + bannerOrderAmount(o), 0);
      const bannerRevenueYear = bannerOrdersYear.reduce((sum, o) => sum + bannerOrderAmount(o), 0);
  
      const revenueToday = (sumTransactions(revenueTransactionsToday) + bannerRevenueToday).toFixed(2);
      const revenueWeek = (sumTransactions(revenueTransactionsWeek) + bannerRevenueWeek).toFixed(2);
      const revenueMonth = (sumTransactions(revenueTransactionsMonth) + bannerRevenueMonth).toFixed(2);
      const revenueYear = (sumTransactions(revenueTransactionsYear) + bannerRevenueYear).toFixed(2);
  
      const transactionsToday = revenueTransactionsToday.length + bannerOrdersToday.length;
      const transactionsWeek = revenueTransactionsWeek.length + bannerOrdersWeek.length;
      const transactionsMonth = revenueTransactionsMonth.length + bannerOrdersMonth.length;
      const transactionsYear = revenueTransactionsYear.length + bannerOrdersYear.length;

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

  async createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const [created] = await db.insert(analyticsEvents).values(event).returning();
    return created;
  }

  async getFeatureUsage(days: number): Promise<{
    rangeDays: number;
    totalEvents: number;
    uniqueVisitors: number;
    returningVisitors: number;
    guestEvents: number;
    guestVisitors: number;
    pages: Array<{
      key: string;
      totalEvents: number;
      uniqueVisitors: number;
      returningVisitors: number;
    }>;
  }> {
    const rangeDays = Number.isFinite(days) && days > 0 ? Math.min(Math.max(days, 1), 90) : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - rangeDays);

    const totalsResult = await db.execute(sql`
      WITH returning_visitors AS (
        SELECT "visitor_id"
        FROM "analytics_events"
        GROUP BY "visitor_id"
        HAVING min("created_at") < ${startDate}
      )
      SELECT
        count(*)::int AS "totalEvents",
        count(distinct "visitor_id")::int AS "uniqueVisitors",
        count(distinct CASE WHEN "visitor_id" IN (SELECT "visitor_id" FROM returning_visitors) THEN "visitor_id" END)::int AS "returningVisitors",
        count(*) FILTER (WHERE "user_id" IS NULL)::int AS "guestEvents",
        count(distinct CASE WHEN "user_id" IS NULL THEN "visitor_id" END)::int AS "guestVisitors"
      FROM "analytics_events"
      WHERE "created_at" >= ${startDate};
    `);
    const totalsRow = (totalsResult.rows?.[0] as any) || {};

    const pagesResult = await db.execute(sql`
      WITH returning_visitors AS (
        SELECT "visitor_id"
        FROM "analytics_events"
        GROUP BY "visitor_id"
        HAVING min("created_at") < ${startDate}
      )
      SELECT
        COALESCE(NULLIF("page", ''), "event") AS "key",
        count(*)::int AS "totalEvents",
        count(distinct "visitor_id")::int AS "uniqueVisitors",
        count(distinct CASE WHEN "visitor_id" IN (SELECT "visitor_id" FROM returning_visitors) THEN "visitor_id" END)::int AS "returningVisitors"
      FROM "analytics_events"
      WHERE "created_at" >= ${startDate}
      GROUP BY 1
      ORDER BY "totalEvents" DESC
      LIMIT 30;
    `);

    return {
      rangeDays,
      totalEvents: Number(totalsRow.totalEvents || 0),
      uniqueVisitors: Number(totalsRow.uniqueVisitors || 0),
      returningVisitors: Number(totalsRow.returningVisitors || 0),
      guestEvents: Number(totalsRow.guestEvents || 0),
      guestVisitors: Number(totalsRow.guestVisitors || 0),
      pages: (pagesResult.rows || []) as Array<{
        key: string;
        totalEvents: number;
        uniqueVisitors: number;
        returningVisitors: number;
      }>,
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

  async getLeadByEmail(email: string): Promise<CrmLead | undefined> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return undefined;

    const [suppressedLead] = await db
      .select()
      .from(crmLeads)
      .where(sql`lower(${crmLeads.email}) = ${normalizedEmail} AND (${crmLeads.emailUnsubscribed} = true OR ${crmLeads.marketingEmailOptOutAt} IS NOT NULL)`)
      .orderBy(desc(crmLeads.updatedAt), desc(crmLeads.createdAt))
      .limit(1);
    if (suppressedLead) return suppressedLead;

    const [lead] = await db
      .select()
      .from(crmLeads)
      .where(sql`lower(${crmLeads.email}) = ${normalizedEmail}`)
      .orderBy(desc(crmLeads.updatedAt), desc(crmLeads.createdAt))
      .limit(1);
    return lead;
  }

  async unsubscribeLeadsByEmail(email: string): Promise<number> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return 0;

    const existingLead = await this.getLeadByEmail(normalizedEmail);
    const result = await db
      .update(crmLeads)
      .set({
        ...buildCrmEmailUnsubscribeUpdate(existingLead?.emailPreferences),
        updatedAt: new Date(),
      })
      .where(sql`lower(${crmLeads.email}) = ${normalizedEmail}`);

    return result.rowCount ?? 0;
  }

  async isLeadEmailSuppressed(email: string): Promise<boolean> {
    const lead = await this.getLeadByEmail(email);
    if (!lead) return false;
    return canSendEmail(lead) === false;
  }

  async resubscribeLeadEmail(id: string): Promise<CrmLead | undefined> {
    const existingLead = await this.getLead(id);
    if (!existingLead) return undefined;

    const [lead] = await db
      .update(crmLeads)
      .set({
        ...buildCrmEmailResubscribeUpdate(existingLead.emailPreferences),
        updatedAt: new Date(),
      })
      .where(eq(crmLeads.id, id))
      .returning();
    return lead;
  }

  async createLead(insertLead: InsertCrmLead): Promise<CrmLead> {
    const existingLead = await this.getLeadByEmail(insertLead.email);
    const leadToCreate = preserveLeadEmailSuppression(insertLead, existingLead);
    const [lead] = await db.insert(crmLeads).values(leadToCreate).returning();
    return lead;
  }

  async updateLead(id: string, updates: Partial<CrmLead>): Promise<CrmLead | undefined> {
    const existingLead = await this.getLead(id);
    if (!existingLead) return undefined;

    const matchingLeadForEmail =
      updates.email && updates.email.toLowerCase() !== existingLead.email.toLowerCase()
        ? await this.getLeadByEmail(updates.email)
        : existingLead;
    const safeUpdates = preserveLeadEmailSuppression(updates, matchingLeadForEmail);

    const [lead] = await db
      .update(crmLeads)
      .set({ ...safeUpdates, updatedAt: new Date() })
      .where(eq(crmLeads.id, id))
      .returning();
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

  // CRM - Weekly Reports
  async getAllWeeklyReports(): Promise<CrmWeeklyReport[]> {
    return await db
      .select()
      .from(crmWeeklyReports)
      .orderBy(desc(crmWeeklyReports.weekStart), desc(crmWeeklyReports.createdAt));
  }

  async getWeeklyReport(id: string): Promise<CrmWeeklyReport | undefined> {
    const [report] = await db.select().from(crmWeeklyReports).where(eq(crmWeeklyReports.id, id));
    return report;
  }

  async createWeeklyReport(insertReport: InsertCrmWeeklyReport & { preparedBy: string }): Promise<CrmWeeklyReport> {
    const [report] = await db.insert(crmWeeklyReports).values(insertReport).returning();
    return report;
  }

  async updateWeeklyReport(id: string, updates: Partial<CrmWeeklyReport>): Promise<CrmWeeklyReport | undefined> {
    const [report] = await db
      .update(crmWeeklyReports)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crmWeeklyReports.id, id))
      .returning();
    return report;
  }

  async deleteWeeklyReport(id: string): Promise<boolean> {
    const result = await db.delete(crmWeeklyReports).where(eq(crmWeeklyReports.id, id));
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

  // Housekeeping metrics
  async getHkDailyMetrics(startDate: string, endDate: string, property?: string | null): Promise<HkDailyMetric[]> {
    const filters = [gte(hkDailyMetrics.metricDate, startDate), lte(hkDailyMetrics.metricDate, endDate)];
    if (property) {
      filters.push(eq(hkDailyMetrics.property, property));
    }
    return await db
      .select()
      .from(hkDailyMetrics)
      .where(and(...filters))
      .orderBy(asc(hkDailyMetrics.metricDate));
  }

  async getHkDailyMetricsForDates(property: string, dates: string[]): Promise<HkDailyMetric[]> {
    if (!dates.length) return [];
    return await db
      .select()
      .from(hkDailyMetrics)
      .where(and(eq(hkDailyMetrics.property, property), inArray(hkDailyMetrics.metricDate, dates)));
  }

  async upsertHkDailyMetric(metric: InsertHkDailyMetric & { createdBy?: string | null }): Promise<HkDailyMetric> {
    const metricDate = toRequiredDateOnly(metric.metricDate, "metricDate");
    const payload = {
      ...metric,
      metricDate,
      updatedAt: new Date(),
    };
    const [saved] = await db
      .insert(hkDailyMetrics)
      .values(payload)
      .onConflictDoUpdate({
        target: [hkDailyMetrics.metricDate, hkDailyMetrics.property],
        set: payload,
      })
      .returning();
    return saved;
  }

  async upsertHkDailyMetricFields(metric: {
    metricDate: string;
    property: string;
    roomsSold?: number | null;
    totalDailyHours?: string | null;
    roomRevenueDaily?: string | null;
    roomRevenueMtd?: string | null;
    occupiedRooms?: number | null;
    notes?: string | null;
    roomsSoldImported?: boolean | null;
    roomsSoldImportedAt?: Date | null;
    createdBy?: string | null;
  }): Promise<HkDailyMetric> {
    const { metricDate, property, ...fields } = metric;
    const payload = {
      metricDate,
      property,
      ...fields,
      updatedAt: new Date(),
    };
    const updates: Record<string, any> = { updatedAt: payload.updatedAt };
    (Object.keys(fields) as Array<keyof typeof fields>).forEach((key) => {
      if (fields[key] !== undefined) {
        updates[key] = fields[key];
      }
    });
    const [saved] = await db
      .insert(hkDailyMetrics)
      .values(payload)
      .onConflictDoUpdate({
        target: [hkDailyMetrics.metricDate, hkDailyMetrics.property],
        set: updates,
      })
      .returning();
    return saved;
  }

  async createHkRoomsSoldImport(importRecord: {
    uploadedBy?: string | null;
    filenames: string[];
    parsedCount: number;
    updatedCount: number;
    skippedCount: number;
    conflictCount: number;
    details: any;
  }): Promise<void> {
    await db.insert(hkRoomsSoldImports).values({
      uploadedBy: importRecord.uploadedBy ?? null,
      filenames: importRecord.filenames,
      parsedCount: importRecord.parsedCount,
      updatedCount: importRecord.updatedCount,
      skippedCount: importRecord.skippedCount,
      conflictCount: importRecord.conflictCount,
      details: importRecord.details,
    });
  }

  async getHkAttendantMetrics(startDate: string, endDate: string, property?: string | null): Promise<HkAttendantMetric[]> {
    const filters = [gte(hkAttendantMetrics.metricDate, startDate), lte(hkAttendantMetrics.metricDate, endDate)];
    if (property) {
      filters.push(eq(hkAttendantMetrics.property, property));
    }
    return await db
      .select()
      .from(hkAttendantMetrics)
      .where(and(...filters))
      .orderBy(asc(hkAttendantMetrics.metricDate), asc(hkAttendantMetrics.attendantName));
  }

  async upsertHkAttendantMetric(metric: InsertHkAttendantMetric & { createdBy?: string | null }): Promise<HkAttendantMetric> {
    const metricDate = toRequiredDateOnly(metric.metricDate, "metricDate");
    const payload = {
      ...metric,
      metricDate,
      updatedAt: new Date(),
    };
    const [saved] = await db
      .insert(hkAttendantMetrics)
      .values(payload)
      .onConflictDoUpdate({
        target: [hkAttendantMetrics.metricDate, hkAttendantMetrics.property, hkAttendantMetrics.attendantName],
        set: payload,
      })
      .returning();
    return saved;
  }

  async listHkProperties(): Promise<string[]> {
    const daily = await db
      .select({ property: hkDailyMetrics.property })
      .from(hkDailyMetrics)
      .groupBy(hkDailyMetrics.property);
    const attendants = await db
      .select({ property: hkAttendantMetrics.property })
      .from(hkAttendantMetrics)
      .groupBy(hkAttendantMetrics.property);
    const combined = [...daily, ...attendants]
      .map((row) => row.property)
      .filter((property): property is string => Boolean(property));
    return Array.from(new Set(combined)).sort((a, b) => a.localeCompare(b));
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

  async createInvestorDeckAccessLog(log: InsertInvestorDeckAccessLog): Promise<InvestorDeckAccessLog> {
    const [entry] = await db.insert(investorDeckAccessLogs).values(log).returning();
    return entry;
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

    // Require paid or comped status before activation
    if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'comped') {
      throw new Error('UNPAID_ORDER');
    }

    if (order.paymentStatus === 'paid' && (!order.paypalOrderId || order.paypalOrderId.trim() === '')) {
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
      adCopy: order.adCopy,
      imageUrl: order.imageUrl,
      videoUrl: order.videoUrl ?? undefined,
      videoMuted: order.videoMuted ?? true,
      videoOrientation: normalizeBannerVideoOrientation(order.videoOrientation) ?? "landscape",
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
          or(
            eq(bannerAdOrders.paymentStatus, 'paid'),
            eq(bannerAdOrders.paymentStatus, 'comped')
          ),
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

  async getPartnerToolMetrics(): Promise<PartnerToolMetric[]> {
    return await db.select().from(partnerToolMetrics).orderBy(desc(partnerToolMetrics.updatedAt));
  }

  async incrementPartnerToolImpressions(partner: string): Promise<void> {
    await db
      .insert(partnerToolMetrics)
      .values({ partner, impressions: 1, clicks: 0 })
      .onConflictDoUpdate({
        target: partnerToolMetrics.partner,
        set: {
          impressions: sql`${partnerToolMetrics.impressions} + 1`,
          updatedAt: sql`now()`,
        },
      });
  }

  async incrementPartnerToolClicks(partner: string): Promise<void> {
    await db
      .insert(partnerToolMetrics)
      .values({ partner, impressions: 0, clicks: 1 })
      .onConflictDoUpdate({
        target: partnerToolMetrics.partner,
        set: {
          clicks: sql`${partnerToolMetrics.clicks} + 1`,
          updatedAt: sql`now()`,
        },
      });
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

  async getActiveLogbookProUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.logbookProStatus, "active"));
  }

  // Logbook Archives
  async createLogbookArchive(data: InsertLogbookArchive & { userId: string }): Promise<LogbookArchive> {
    const [archive] = await db
      .insert(logbookArchives)
      .values({
        ...data,
        fileName: data.fileName.trim(),
        storageProvider: data.storageProvider ?? "object",
        updatedAt: new Date(),
      })
      .returning();
    return archive;
  }

  async getLogbookArchivesByUser(userId: string): Promise<LogbookArchive[]> {
    return await db
      .select()
      .from(logbookArchives)
      .where(eq(logbookArchives.userId, userId))
      .orderBy(desc(logbookArchives.createdAt));
  }

  async getLogbookArchiveById(id: string): Promise<LogbookArchive | undefined> {
    const [archive] = await db
      .select()
      .from(logbookArchives)
      .where(eq(logbookArchives.id, id));
    return archive;
  }

  async deleteLogbookArchive(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(logbookArchives)
      .where(and(eq(logbookArchives.id, id), eq(logbookArchives.userId, userId)))
      .returning();
    return result.length > 0;
  }

  // Notification Preferences + User Notifications
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined> {
    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return prefs;
  }

  async upsertNotificationPreferences(userId: string, updates: InsertNotificationPreferences): Promise<NotificationPreferences> {
    const existing = await this.getNotificationPreferences(userId);
    if (existing) {
      const [prefs] = await db
        .update(notificationPreferences)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(notificationPreferences.userId, userId))
        .returning();
      return prefs;
    }
    const [prefs] = await db
      .insert(notificationPreferences)
      .values({ ...updates, userId })
      .returning();
    return prefs;
  }

  // CFI Booking Platform
  async getCfiProfileByUser(userId: string): Promise<CfiProfile | undefined> {
    const [profile] = await db.select().from(cfiProfiles).where(eq(cfiProfiles.userId, userId));
    return profile;
  }

  async getCfiProfileBySlug(slug: string): Promise<CfiProfile | undefined> {
    const [profile] = await db.select().from(cfiProfiles).where(eq(cfiProfiles.slug, slug));
    return profile;
  }

  async getCfiProfileById(id: string): Promise<CfiProfile | undefined> {
    const [profile] = await db.select().from(cfiProfiles).where(eq(cfiProfiles.id, id));
    return profile;
  }

  async listPublishedCfiProfiles(filters?: { q?: string; state?: string; airport?: string }): Promise<CfiProfile[]> {
    const conditions: any[] = [eq(cfiProfiles.isPublished, true)];
    if (filters?.q) {
      const like = `%${filters.q}%`;
      conditions.push(
        or(
          ilike(cfiProfiles.displayName, like),
          ilike(cfiProfiles.headline, like),
          ilike(cfiProfiles.locationCity, like),
          ilike(cfiProfiles.locationState, like),
          ilike(cfiProfiles.airportHome, like)
        )
      );
    }
    if (filters?.state) {
      conditions.push(ilike(cfiProfiles.locationState, filters.state));
    }
    if (filters?.airport) {
      conditions.push(ilike(cfiProfiles.airportHome, filters.airport));
    }
    return await db
      .select()
      .from(cfiProfiles)
      .where(and(...conditions))
      .orderBy(asc(cfiProfiles.displayName));
  }

  async createCfiProfile(profile: InsertCfiProfile & { userId: string }): Promise<CfiProfile> {
    const [created] = await db.insert(cfiProfiles).values(profile).returning();
    return created;
  }

  async updateCfiProfile(id: string, userId: string, updates: Partial<CfiProfile>): Promise<CfiProfile | undefined> {
    const [updated] = await db
      .update(cfiProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(cfiProfiles.id, id), eq(cfiProfiles.userId, userId)))
      .returning();
    return updated;
  }

  async getCfiSchoolByOwner(userId: string): Promise<CfiSchool | undefined> {
    const [school] = await db.select().from(cfiSchools).where(eq(cfiSchools.ownerUserId, userId));
    return school;
  }

  async getCfiSchoolBySlug(slug: string): Promise<CfiSchool | undefined> {
    const [school] = await db.select().from(cfiSchools).where(eq(cfiSchools.slug, slug));
    return school;
  }

  async getCfiSchoolById(id: string): Promise<CfiSchool | undefined> {
    const [school] = await db.select().from(cfiSchools).where(eq(cfiSchools.id, id));
    return school;
  }

  async getCfiSchoolMembership(schoolId: string, userId: string): Promise<CfiSchoolMember | undefined> {
    const [member] = await db
      .select()
      .from(cfiSchoolMembers)
      .where(and(eq(cfiSchoolMembers.schoolId, schoolId), eq(cfiSchoolMembers.userId, userId)));
    return member;
  }

  async listCfiSchoolsForUser(userId: string): Promise<CfiSchool[]> {
    return await db
      .select({ school: cfiSchools })
      .from(cfiSchoolMembers)
      .innerJoin(cfiSchools, eq(cfiSchools.id, cfiSchoolMembers.schoolId))
      .where(and(eq(cfiSchoolMembers.userId, userId), eq(cfiSchoolMembers.status, "active")))
      .then((rows) => rows.map((row) => row.school));
  }

  async listCfiSchoolMembershipsForUser(userId: string): Promise<CfiSchoolMember[]> {
    return await db
      .select()
      .from(cfiSchoolMembers)
      .where(eq(cfiSchoolMembers.userId, userId))
      .orderBy(desc(cfiSchoolMembers.createdAt));
  }

  async listCfiSchoolMembers(schoolId: string): Promise<CfiSchoolMember[]> {
    return await db
      .select()
      .from(cfiSchoolMembers)
      .where(eq(cfiSchoolMembers.schoolId, schoolId))
      .orderBy(desc(cfiSchoolMembers.createdAt));
  }

  async createCfiSchool(school: InsertCfiSchool & { ownerUserId: string }): Promise<CfiSchool> {
    const [created] = await db.insert(cfiSchools).values(school).returning();
    return created;
  }

  async updateCfiSchool(id: string, updates: Partial<CfiSchool>): Promise<CfiSchool | undefined> {
    const [updated] = await db
      .update(cfiSchools)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(cfiSchools.id, id))
      .returning();
    return updated;
  }

  async addCfiSchoolMember(member: InsertCfiSchoolMember & { schoolId: string; userId: string }): Promise<CfiSchoolMember> {
    const [created] = await db
      .insert(cfiSchoolMembers)
      .values(member)
      .onConflictDoUpdate({
        target: [cfiSchoolMembers.schoolId, cfiSchoolMembers.userId],
        set: {
          role: member.role,
          status: member.status,
          updatedAt: new Date(),
        },
      })
      .returning();
    return created;
  }

  async removeCfiSchoolMember(id: string, schoolId: string): Promise<boolean> {
    const result = await db
      .delete(cfiSchoolMembers)
      .where(and(eq(cfiSchoolMembers.id, id), eq(cfiSchoolMembers.schoolId, schoolId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getCfiCredentials(profileId: string): Promise<CfiCredential[]> {
    return await db
      .select()
      .from(cfiCredentials)
      .where(eq(cfiCredentials.cfiProfileId, profileId))
      .orderBy(desc(cfiCredentials.uploadedAt));
  }

  async createCfiCredential(credential: InsertCfiCredential & { cfiProfileId: string }): Promise<CfiCredential> {
    const [created] = await db.insert(cfiCredentials).values(credential).returning();
    return created;
  }

  async deleteCfiCredential(id: string, profileId: string): Promise<boolean> {
    const result = await db
      .delete(cfiCredentials)
      .where(and(eq(cfiCredentials.id, id), eq(cfiCredentials.cfiProfileId, profileId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getCfiAvailabilityRules(profileId: string): Promise<CfiAvailabilityRule[]> {
    return await db
      .select()
      .from(cfiAvailabilityRules)
      .where(eq(cfiAvailabilityRules.cfiProfileId, profileId))
      .orderBy(asc(cfiAvailabilityRules.weekday), asc(cfiAvailabilityRules.startTime));
  }

  async replaceCfiAvailabilityRules(profileId: string, rules: InsertCfiAvailabilityRule[]): Promise<CfiAvailabilityRule[]> {
    await db.delete(cfiAvailabilityRules).where(eq(cfiAvailabilityRules.cfiProfileId, profileId));
    if (!rules.length) return [];
    const withProfile = rules.map((rule) => ({ ...rule, cfiProfileId: profileId }));
    return await db.insert(cfiAvailabilityRules).values(withProfile as any).returning();
  }

  async createCfiAvailabilityRule(rule: InsertCfiAvailabilityRule & { cfiProfileId: string }): Promise<CfiAvailabilityRule> {
    const [created] = await db.insert(cfiAvailabilityRules).values(rule).returning();
    return created;
  }

  async updateCfiAvailabilityRule(
    id: string,
    profileId: string,
    updates: Partial<CfiAvailabilityRule>
  ): Promise<CfiAvailabilityRule | undefined> {
    const [updated] = await db
      .update(cfiAvailabilityRules)
      .set(updates)
      .where(and(eq(cfiAvailabilityRules.id, id), eq(cfiAvailabilityRules.cfiProfileId, profileId)))
      .returning();
    return updated;
  }

  async deleteCfiAvailabilityRule(id: string, profileId: string): Promise<boolean> {
    const result = await db
      .delete(cfiAvailabilityRules)
      .where(and(eq(cfiAvailabilityRules.id, id), eq(cfiAvailabilityRules.cfiProfileId, profileId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async createCfiBookingRequest(
    request: InsertCfiBookingRequest & { cfiProfileId: string; studentUserId: string }
  ): Promise<CfiBookingRequest> {
    const [created] = await db.insert(cfiBookingRequests).values(request).returning();
    return created;
  }

  async getCfiBookingRequest(id: string): Promise<CfiBookingRequest | undefined> {
    const [request] = await db.select().from(cfiBookingRequests).where(eq(cfiBookingRequests.id, id));
    return request;
  }

  async getCfiBookingRequestsForCfi(profileId: string): Promise<CfiBookingRequest[]> {
    return await db
      .select()
      .from(cfiBookingRequests)
      .where(eq(cfiBookingRequests.cfiProfileId, profileId))
      .orderBy(desc(cfiBookingRequests.createdAt));
  }

  async getCfiBookingRequestsForStudent(userId: string): Promise<CfiBookingRequest[]> {
    return await db
      .select()
      .from(cfiBookingRequests)
      .where(eq(cfiBookingRequests.studentUserId, userId))
      .orderBy(desc(cfiBookingRequests.createdAt));
  }

  async updateCfiBookingRequest(id: string, updates: Partial<CfiBookingRequest>): Promise<CfiBookingRequest | undefined> {
    const [updated] = await db
      .update(cfiBookingRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(cfiBookingRequests.id, id))
      .returning();
    return updated;
  }

  async getCfiStudentsByProfile(profileId: string): Promise<CfiStudent[]> {
    return await db
      .select()
      .from(cfiStudents)
      .where(eq(cfiStudents.cfiProfileId, profileId))
      .orderBy(desc(cfiStudents.createdAt));
  }

  async getCfiStudentById(id: string): Promise<CfiStudent | undefined> {
    const [student] = await db.select().from(cfiStudents).where(eq(cfiStudents.id, id));
    return student;
  }

  async getCfiStudentByProfileAndUser(profileId: string, studentUserId: string): Promise<CfiStudent | undefined> {
    const [student] = await db
      .select()
      .from(cfiStudents)
      .where(and(eq(cfiStudents.cfiProfileId, profileId), eq(cfiStudents.studentUserId, studentUserId)));
    return student;
  }

  async getCfiStudentByStudentUser(userId: string): Promise<CfiStudent | undefined> {
    const [student] = await db
      .select()
      .from(cfiStudents)
      .where(and(eq(cfiStudents.studentUserId, userId), eq(cfiStudents.status, "active")))
      .orderBy(desc(cfiStudents.createdAt));
    return student;
  }

  async createCfiStudent(
    student: InsertCfiStudent & { cfiProfileId: string; studentUserId: string }
  ): Promise<CfiStudent> {
    const [created] = await db.insert(cfiStudents).values(student).returning();
    return created;
  }

  async updateCfiStudent(id: string, profileId: string, updates: Partial<CfiStudent>): Promise<CfiStudent | undefined> {
    const [updated] = await db
      .update(cfiStudents)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(cfiStudents.id, id), eq(cfiStudents.cfiProfileId, profileId)))
      .returning();
    return updated;
  }

  async deleteCfiStudent(id: string, profileId: string): Promise<boolean> {
    const result = await db
      .delete(cfiStudents)
      .where(and(eq(cfiStudents.id, id), eq(cfiStudents.cfiProfileId, profileId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getCfiLessonTemplates(profileId: string): Promise<CfiLessonTemplate[]> {
    return await db
      .select()
      .from(cfiLessonTemplates)
      .where(eq(cfiLessonTemplates.cfiProfileId, profileId))
      .orderBy(desc(cfiLessonTemplates.createdAt));
  }

  async createCfiLessonTemplate(
    template: InsertCfiLessonTemplate & { cfiProfileId: string }
  ): Promise<CfiLessonTemplate> {
    const [created] = await db.insert(cfiLessonTemplates).values(template).returning();
    return created;
  }

  async updateCfiLessonTemplate(
    id: string,
    profileId: string,
    updates: Partial<CfiLessonTemplate>
  ): Promise<CfiLessonTemplate | undefined> {
    const [updated] = await db
      .update(cfiLessonTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(cfiLessonTemplates.id, id), eq(cfiLessonTemplates.cfiProfileId, profileId)))
      .returning();
    return updated;
  }

  async deleteCfiLessonTemplate(id: string, profileId: string): Promise<boolean> {
    const result = await db
      .delete(cfiLessonTemplates)
      .where(and(eq(cfiLessonTemplates.id, id), eq(cfiLessonTemplates.cfiProfileId, profileId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getCfiLessonsByStudent(studentId: string): Promise<CfiLesson[]> {
    return await db
      .select()
      .from(cfiLessons)
      .where(eq(cfiLessons.studentId, studentId))
      .orderBy(desc(cfiLessons.createdAt));
  }

  async getCfiLessonById(id: string): Promise<CfiLesson | undefined> {
    const [lesson] = await db.select().from(cfiLessons).where(eq(cfiLessons.id, id));
    return lesson;
  }

  async createCfiLesson(
    lesson: InsertCfiLesson & { cfiProfileId: string; studentId: string }
  ): Promise<CfiLesson> {
    const payload = {
      ...lesson,
      scheduledAt: normalizeTimestampInput(lesson.scheduledAt),
      completedAt: normalizeTimestampInput(lesson.completedAt),
    };
    const [created] = await db.insert(cfiLessons).values(payload).returning();
    return created;
  }

  async updateCfiLesson(
    id: string,
    profileId: string,
    updates: Partial<InsertCfiLesson>
  ): Promise<CfiLesson | undefined> {
    const [updated] = await db
      .update(cfiLessons)
      .set({
        ...updates,
        scheduledAt: normalizeTimestampInput(updates.scheduledAt),
        completedAt: normalizeTimestampInput(updates.completedAt),
        updatedAt: new Date(),
      })
      .where(and(eq(cfiLessons.id, id), eq(cfiLessons.cfiProfileId, profileId)))
      .returning();
    return updated;
  }

  async deleteCfiLesson(id: string, profileId: string): Promise<boolean> {
    const result = await db
      .delete(cfiLessons)
      .where(and(eq(cfiLessons.id, id), eq(cfiLessons.cfiProfileId, profileId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getCfiStudentFiles(studentId: string): Promise<CfiStudentFile[]> {
    return await db
      .select()
      .from(cfiStudentFiles)
      .where(eq(cfiStudentFiles.studentId, studentId))
      .orderBy(desc(cfiStudentFiles.createdAt));
  }

  async getCfiStudentFileById(id: string): Promise<CfiStudentFile | undefined> {
    const [file] = await db.select().from(cfiStudentFiles).where(eq(cfiStudentFiles.id, id));
    return file;
  }

  async createCfiStudentFile(
    file: InsertCfiStudentFile & { studentId: string; uploadedByUserId: string }
  ): Promise<CfiStudentFile> {
    const [created] = await db.insert(cfiStudentFiles).values(file).returning();
    return created;
  }

  async deleteCfiStudentFile(id: string, studentId: string): Promise<boolean> {
    const result = await db
      .delete(cfiStudentFiles)
      .where(and(eq(cfiStudentFiles.id, id), eq(cfiStudentFiles.studentId, studentId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getCfiStudentMilestones(studentId: string): Promise<CfiStudentMilestone[]> {
    return await db
      .select()
      .from(cfiStudentMilestones)
      .where(eq(cfiStudentMilestones.studentId, studentId))
      .orderBy(desc(cfiStudentMilestones.createdAt));
  }

  async getCfiStudentMilestoneById(id: string): Promise<CfiStudentMilestone | undefined> {
    const [milestone] = await db.select().from(cfiStudentMilestones).where(eq(cfiStudentMilestones.id, id));
    return milestone;
  }

  async createCfiStudentMilestone(
    milestone: InsertCfiStudentMilestone & { studentId: string }
  ): Promise<CfiStudentMilestone> {
    const payload = {
      ...milestone,
      completedAt: normalizeTimestampInput(milestone.completedAt),
    };
    const [created] = await db.insert(cfiStudentMilestones).values(payload).returning();
    return created;
  }

  async updateCfiStudentMilestone(
    id: string,
    studentId: string,
    updates: Partial<CfiStudentMilestone>
  ): Promise<CfiStudentMilestone | undefined> {
    const [updated] = await db
      .update(cfiStudentMilestones)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(cfiStudentMilestones.id, id), eq(cfiStudentMilestones.studentId, studentId)))
      .returning();
    return updated;
  }

  async deleteCfiStudentMilestone(id: string, studentId: string): Promise<boolean> {
    const result = await db
      .delete(cfiStudentMilestones)
      .where(and(eq(cfiStudentMilestones.id, id), eq(cfiStudentMilestones.studentId, studentId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getCfiStudentEndorsements(studentId: string): Promise<CfiStudentEndorsement[]> {
    return await db
      .select()
      .from(cfiStudentEndorsements)
      .where(eq(cfiStudentEndorsements.studentId, studentId))
      .orderBy(desc(cfiStudentEndorsements.createdAt));
  }

  async getCfiStudentEndorsementById(id: string): Promise<CfiStudentEndorsement | undefined> {
    const [endorsement] = await db.select().from(cfiStudentEndorsements).where(eq(cfiStudentEndorsements.id, id));
    return endorsement;
  }

  async createCfiStudentEndorsement(
    endorsement: InsertCfiStudentEndorsement & { studentId: string }
  ): Promise<CfiStudentEndorsement> {
    const [created] = await db.insert(cfiStudentEndorsements).values(endorsement).returning();
    return created;
  }

  async updateCfiStudentEndorsement(
    id: string,
    studentId: string,
    updates: Partial<CfiStudentEndorsement>
  ): Promise<CfiStudentEndorsement | undefined> {
    const [updated] = await db
      .update(cfiStudentEndorsements)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(cfiStudentEndorsements.id, id), eq(cfiStudentEndorsements.studentId, studentId)))
      .returning();
    return updated;
  }

  async deleteCfiStudentEndorsement(id: string, studentId: string): Promise<boolean> {
    const result = await db
      .delete(cfiStudentEndorsements)
      .where(and(eq(cfiStudentEndorsements.id, id), eq(cfiStudentEndorsements.studentId, studentId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getCfiConversationById(id: string): Promise<CfiConversation | undefined> {
    const [conversation] = await db.select().from(cfiConversations).where(eq(cfiConversations.id, id));
    return conversation;
  }

  async getCfiConversation(profileId: string, studentId: string): Promise<CfiConversation | undefined> {
    const [conversation] = await db
      .select()
      .from(cfiConversations)
      .where(and(eq(cfiConversations.cfiProfileId, profileId), eq(cfiConversations.studentId, studentId)));
    return conversation;
  }

  async getCfiConversationsByProfile(profileId: string): Promise<CfiConversation[]> {
    return await db
      .select()
      .from(cfiConversations)
      .where(eq(cfiConversations.cfiProfileId, profileId))
      .orderBy(desc(cfiConversations.updatedAt));
  }

  async getCfiConversationsByStudent(studentId: string): Promise<CfiConversation[]> {
    return await db
      .select()
      .from(cfiConversations)
      .where(eq(cfiConversations.studentId, studentId))
      .orderBy(desc(cfiConversations.updatedAt));
  }

  async createCfiConversation(
    conversation: InsertCfiConversation & { cfiProfileId: string; studentId: string }
  ): Promise<CfiConversation> {
    const [created] = await db
      .insert(cfiConversations)
      .values(conversation)
      .onConflictDoUpdate({
        target: [cfiConversations.cfiProfileId, cfiConversations.studentId],
        set: { updatedAt: new Date() },
      })
      .returning();
    return created;
  }

  async updateCfiConversation(id: string, updates: Partial<CfiConversation>): Promise<CfiConversation | undefined> {
    const [updated] = await db
      .update(cfiConversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(cfiConversations.id, id))
      .returning();
    return updated;
  }

  async getCfiMessages(conversationId: string): Promise<CfiMessage[]> {
    return await db
      .select()
      .from(cfiMessages)
      .where(eq(cfiMessages.conversationId, conversationId))
      .orderBy(asc(cfiMessages.createdAt));
  }

  async createCfiMessage(
    message: InsertCfiMessage & { conversationId: string; senderUserId: string }
  ): Promise<CfiMessage> {
    const [created] = await db.insert(cfiMessages).values(message).returning();
    await db
      .update(cfiConversations)
      .set({ updatedAt: new Date() })
      .where(eq(cfiConversations.id, message.conversationId));
    return created;
  }

  async createCfiLegalAcceptance(
    acceptance: InsertCfiLegalAcceptance & { userId: string }
  ): Promise<CfiLegalAcceptance> {
    const [created] = await db.insert(cfiLegalAcceptances).values(acceptance).returning();
    return created;
  }

  async getCfiLatestLegalAcceptance(userId: string, acceptanceType: string): Promise<CfiLegalAcceptance | undefined> {
    const [acceptance] = await db
      .select()
      .from(cfiLegalAcceptances)
      .where(and(eq(cfiLegalAcceptances.userId, userId), eq(cfiLegalAcceptances.acceptanceType, acceptanceType)))
      .orderBy(desc(cfiLegalAcceptances.acceptedAt))
      .limit(1);
    return acceptance;
  }

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return settings;
  }

  async upsertUserSettings(userId: string, updates: InsertUserSettings): Promise<UserSettings> {
    const existing = await this.getUserSettings(userId);
    if (existing) {
      const [settings] = await db
        .update(userSettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(userSettings.userId, userId))
        .returning();
      return settings;
    }
    const [settings] = await db
      .insert(userSettings)
      .values({ ...updates, userId })
      .returning();
    return settings;
  }

  async getUserNotifications(userId: string, limit = 50): Promise<UserNotification[]> {
    return await db
      .select()
      .from(userNotifications)
      .where(eq(userNotifications.userId, userId))
      .orderBy(desc(userNotifications.createdAt))
      .limit(limit);
  }

  async getUnreadUserNotifications(userId: string): Promise<UserNotification[]> {
    return await db
      .select()
      .from(userNotifications)
      .where(and(eq(userNotifications.userId, userId), eq(userNotifications.isRead, false)))
      .orderBy(desc(userNotifications.createdAt));
  }

  async getUserNotificationByTypeAndDate(userId: string, type: string, referenceDate: Date | null): Promise<UserNotification | undefined> {
    const [notification] = await db
      .select()
      .from(userNotifications)
      .where(
        and(
          eq(userNotifications.userId, userId),
          eq(userNotifications.type, type),
          referenceDate ? eq(userNotifications.referenceDate, referenceDate as any) : isNull(userNotifications.referenceDate)
        )
      )
      .limit(1);
    return notification;
  }

  async createUserNotification(notification: InsertUserNotification & { userId: string }): Promise<UserNotification> {
    const [created] = await db.insert(userNotifications).values(notification).returning();
    return created;
  }

  async markUserNotificationRead(id: string, userId: string): Promise<UserNotification | undefined> {
    const [updated] = await db
      .update(userNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(userNotifications.id, id), eq(userNotifications.userId, userId)))
      .returning();
    return updated;
  }

  // Push Tokens
  async upsertPushToken(userId: string, token: InsertPushToken): Promise<PushToken> {
    const existing = await db.select().from(pushTokens).where(eq(pushTokens.token, token.token)).limit(1);
    if (existing[0]) {
      const [updated] = await db
        .update(pushTokens)
        .set({
          userId,
          platform: token.platform,
          deviceName: token.deviceName,
          isActive: token.isActive ?? true,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(pushTokens.token, token.token))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(pushTokens)
      .values({
        userId,
        token: token.token,
        platform: token.platform,
        deviceName: token.deviceName,
        isActive: token.isActive ?? true,
        lastUsedAt: new Date(),
      })
      .returning();
    return created;
  }

  async getPushTokensByUser(userId: string): Promise<PushToken[]> {
    return await db
      .select()
      .from(pushTokens)
      .where(and(eq(pushTokens.userId, userId), eq(pushTokens.isActive, true)))
      .orderBy(desc(pushTokens.lastUsedAt));
  }

  // Endorsements
  async getEndorsementsByUser(userId: string): Promise<Endorsement[]> {
    return await db
      .select()
      .from(endorsements)
      .where(eq(endorsements.userId, userId))
      .orderBy(desc(endorsements.issuedAt), desc(endorsements.createdAt));
  }

  async createEndorsement(endorsement: InsertEndorsement & { userId: string }): Promise<Endorsement> {
    const payload = {
      ...endorsement,
      issuedAt: toRequiredDateOnly(endorsement.issuedAt, "issuedAt"),
      expiresAt: normalizeDateOnly(endorsement.expiresAt),
    };
    const [created] = await db.insert(endorsements).values(payload).returning();
    return created;
  }

  async updateEndorsement(id: string, userId: string, updates: Partial<Endorsement>): Promise<Endorsement | undefined> {
    const [updated] = await db
      .update(endorsements)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(endorsements.id, id), eq(endorsements.userId, userId)))
      .returning();
    return updated;
  }

  async deleteEndorsement(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(endorsements)
      .where(and(eq(endorsements.id, id), eq(endorsements.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Radio Comms Sessions
  async getRadioCommsSessionsByUser(userId: string, limit = 20): Promise<RadioCommsSession[]> {
    return await db
      .select()
      .from(radioCommsSessions)
      .where(eq(radioCommsSessions.userId, userId))
      .orderBy(desc(radioCommsSessions.createdAt))
      .limit(limit);
  }

  async createRadioCommsSession(session: InsertRadioCommsSession & { userId: string }): Promise<RadioCommsSession> {
    const [created] = await db.insert(radioCommsSessions).values(session).returning();
    return created;
  }

  // Student Profiles
  async getStudentProfile(userId: string): Promise<StudentProfile | undefined> {
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, userId));
    return profile;
  }

  async upsertStudentProfile(userId: string, updates: InsertStudentProfile): Promise<StudentProfile> {
    const existing = await this.getStudentProfile(userId);
    if (existing) {
      const [profile] = await db
        .update(studentProfiles)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(studentProfiles.userId, userId))
        .returning();
      return profile;
    }
    const [profile] = await db.insert(studentProfiles).values({ ...updates, userId }).returning();
    return profile;
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

  // Aircraft Library (RSF)
  async getAircraftTypes(filters?: {
    q?: string;
    category?: string;
    engineType?: string;
    limit?: number;
    offset?: number;
  }): Promise<AircraftType[]> {
    const limit = filters?.limit ? Math.min(filters.limit, 500) : 500;
    const offset = filters?.offset ?? 0;
    const conditions: any[] = [];

    if (filters?.q) {
      const like = `%${filters.q}%`;
      conditions.push(or(ilike(aircraftTypes.make, like), ilike(aircraftTypes.model, like), ilike(aircraftTypes.icaoType, like)));
    }
    if (filters?.category) {
      conditions.push(eq(aircraftTypes.category, filters.category));
    }
    if (filters?.engineType) {
      conditions.push(eq(aircraftTypes.engineType, filters.engineType));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;
    return await db
      .select()
      .from(aircraftTypes)
      .where(whereClause)
      .orderBy(asc(aircraftTypes.make), asc(aircraftTypes.model))
      .limit(limit)
      .offset(offset);
  }

  async getAircraftTypeById(id: string): Promise<AircraftType | undefined> {
    const [type] = await db.select().from(aircraftTypes).where(eq(aircraftTypes.id, id));
    return type;
  }

  async getAircraftTypesByIds(ids: string[]): Promise<AircraftType[]> {
    if (!ids.length) return [];
    return await db.select().from(aircraftTypes).where(inArray(aircraftTypes.id, ids));
  }

  async createAircraftType(type: InsertAircraftType): Promise<AircraftType> {
    const payload = {
      ...type,
      cruiseKtas: toRequiredDecimalString(type.cruiseKtas, "cruiseKtas"),
      fuelBurnGph: toRequiredDecimalString(type.fuelBurnGph, "fuelBurnGph"),
      usableFuelGal: toRequiredDecimalString(type.usableFuelGal, "usableFuelGal"),
      maxGrossWeightLb: toRequiredDecimalString(type.maxGrossWeightLb, "maxGrossWeightLb"),
      emptyArmIn: toDecimalString(type.emptyArmIn),
      frontArmIn: toDecimalString(type.frontArmIn),
      rearArmIn: toDecimalString(type.rearArmIn),
      baggageArmIn: toDecimalString(type.baggageArmIn),
      fuelArmIn: toDecimalString(type.fuelArmIn),
    };
    const [created] = await db.insert(aircraftTypes).values(payload).returning();
    return created;
  }

  async updateAircraftType(id: string, updates: Partial<AircraftType>): Promise<AircraftType | undefined> {
    const [updated] = await db
      .update(aircraftTypes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aircraftTypes.id, id))
      .returning();
    return updated;
  }

  async deleteAircraftType(id: string): Promise<boolean> {
    const result = await db.delete(aircraftTypes).where(eq(aircraftTypes.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Aircraft Profiles (Flight Planner)
  async getAircraftProfilesByUser(userId: string): Promise<AircraftProfile[]> {
    return await db
      .select()
      .from(aircraftProfiles)
      .where(eq(aircraftProfiles.userId, userId))
      .orderBy(desc(aircraftProfiles.createdAt));
  }

  async getAircraftProfileById(id: string): Promise<AircraftProfile | undefined> {
    const [profile] = await db.select().from(aircraftProfiles).where(eq(aircraftProfiles.id, id));
    return profile;
  }

  async createAircraftProfile(profile: InsertAircraftProfile & { userId: string }): Promise<AircraftProfile> {
    const payload = {
      ...profile,
      cruiseKtasOverride: toDecimalString(profile.cruiseKtasOverride),
      fuelBurnOverrideGph: toDecimalString(profile.fuelBurnOverrideGph),
      usableFuelOverrideGal: toDecimalString(profile.usableFuelOverrideGal),
      maxGrossWeightOverrideLb: toDecimalString(profile.maxGrossWeightOverrideLb),
    };
    const [created] = await db.insert(aircraftProfiles).values(payload).returning();
    return created;
  }

  async updateAircraftProfile(id: string, updates: Partial<AircraftProfile>): Promise<AircraftProfile | undefined> {
    const [updated] = await db
      .update(aircraftProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aircraftProfiles.id, id))
      .returning();
    return updated;
  }

  async deleteAircraftProfile(id: string): Promise<boolean> {
    const result = await db.delete(aircraftProfiles).where(eq(aircraftProfiles.id, id));
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
        cfiCertNumber: null,
        cfiCertExpires: null,
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

  async countersignLogbookEntry(
    id: string,
    signatureDataUrl: string,
    signedByName: string,
    signatureIp?: string,
    cfiCertNumber?: string,
    cfiCertExpires?: string
  ): Promise<LogbookEntry | undefined> {
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
      cfiCertNumber: cfiCertNumber || null,
      cfiCertExpires: cfiCertExpires || null,
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
