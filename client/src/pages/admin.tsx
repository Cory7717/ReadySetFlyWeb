import { useDeferredValue, useEffect, useState, useMemo, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search, Users, Plane, List, Shield, CheckCircle, XCircle, Eye, TrendingUp, DollarSign, Activity, Calendar, UserPlus, Briefcase, Phone, Mail, Plus, Edit, Trash2, AlertTriangle, FileText, Gift, RefreshCw, Clock, Bell, Image, Upload, X, Rocket, Tag, ChevronDown, ChevronRight, Wallet } from "lucide-react";
import { endOfMonth, format, parse, parseISO, startOfMonth, eachDayOfInterval, isSameMonth, startOfISOWeek, endOfISOWeek, getISOWeek, getISOWeekYear } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { crmSalesEmailTemplateTypes, insertCrmLeadSchema, insertExpenseSchema, insertPromoAlertSchema, insertPromoCodeSchema, insertBannerAdSchema, insertBannerAdOrderSchema, insertHkDailyMetricSchema, insertHkAttendantMetricSchema, leadCategories, type User, type AdminInvite, type AircraftListing, type MarketplaceListing, type VerificationSubmission, type CrmLead, type InsertCrmLead, type Expense, type InsertExpense, type PromoAlert, type InsertPromoAlert, type PromoCode, type InsertPromoCode, type AdminNotification, type BannerAd, type InsertBannerAd, type BannerAdOrder, type InsertBannerAdOrder, type InsertHkDailyMetric, type InsertHkAttendantMetric, type PartnerToolMetric, type LeadCategory, type BannerVideoOrientation, type CrmSalesEmailTemplateType } from "@shared/schema";
import { ADMIN_ROLE_LABELS, ADMIN_ROLE_PERMISSIONS, type AdminRole, type AdminPermission } from "@shared/config/adminAccess";
import { BANNER_AD_TIERS, calculateBannerAdPricing, type BannerAdTier } from "@shared/config/bannerPricing";
import { validatePromoCode, calculatePromoDiscount } from "@shared/config/promoCodes";
import { AdminUserModal } from "@/components/admin-user-modal";
import { ObjectUploader } from "@/components/ObjectUploader";
import PersonalFinance from "@/pages/admin/PersonalFinance";
import type { UploadResult } from "@uppy/core";

const resolveInvoiceUrl = (invoiceUrl?: string | null) => {
  if (!invoiceUrl) return "";
  if (/^https?:\/\//i.test(invoiceUrl)) return invoiceUrl;
  if (invoiceUrl.includes("/")) {
    return apiUrl(invoiceUrl.startsWith("/") ? invoiceUrl : `/${invoiceUrl}`);
  }
  return apiUrl(`/uploads/documents/${invoiceUrl}`);
};

const resolveObjectUrl = (value?: string | null) => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      const host = parsed.hostname.toLowerCase();
      if (host.includes("amazonaws.com") || host.includes("s3.")) {
        return `${parsed.origin}${parsed.pathname}`;
      }
      const query = parsed.search.toLowerCase();
      if (query.includes("x-amz-") || query.includes("x-goog-") || query.includes("signature=")) {
        return `${parsed.origin}${parsed.pathname}`;
      }
      if (parsed.pathname.includes("/uploads/")) {
        const idx = parsed.pathname.indexOf("/uploads/");
        if (idx >= 0) {
          return apiUrl(`/objects/${parsed.pathname.slice(idx + 1)}`);
        }
      }
    } catch {
      return value.split("?")[0];
    }
    return value;
  }
  if (value.startsWith("/objects/")) return apiUrl(value);
  if (value.includes("/uploads/")) {
    const idx = value.indexOf("/uploads/");
    return apiUrl(`/objects/${value.slice(idx + 1)}`);
  }
  return value;
};

const CRM_LEAD_CATEGORY_LABELS: Record<LeadCategory, string> = {
  aircraft_sales: "Aircraft Sales",
  aviation_jobs: "Aviation Jobs",
  flight_schools: "Flight Schools",
  rentals: "Rentals",
  cfi_services: "CFI Services",
  charter_services: "Charter Services",
  mechanic_services: "Mechanic Services",
  banner_ads: "Banner Ads",
  marketplace_services: "Marketplace Services",
  sponsorships: "Sponsorships",
  other: "Other",
};

const CRM_SALES_TEMPLATE_LABELS: Record<CrmSalesEmailTemplateType, string> = {
  new_listing: "New Listing Outreach",
  relist: "Relist / Reactivate",
  promo_offer: "Promo Offer",
};

const CRM_SALES_TEMPLATE_DESCRIPTIONS: Record<CrmSalesEmailTemplateType, string> = {
  new_listing: "Best for first-touch outreach to get a new listing or campaign live.",
  relist: "Best for restarting a stale listing, relaunching, or re-engaging an older lead.",
  promo_offer: "Best when you want to include a current promo code or limited-time incentive.",
};

type CrmSalesEmailPreview = {
  subject: string;
  html: string;
  text: string;
};

const FINANCE_EMAILS = ["coryarmer@gmail.com", "bentley.amy24@gmail.com"];

const buildBannerTrackingUrl = (
  link?: string | null,
  options?: { placement?: string | null; category?: string | null; bannerId?: string | null }
) => {
  if (!link) return "";
  try {
    const url = new URL(link);
    const placement = options?.placement || "site";
    const category = options?.category || "general";
    const bannerId = options?.bannerId || "unknown";

    url.searchParams.set("utm_source", "readysetfly");
    url.searchParams.set("utm_medium", "banner");
    url.searchParams.set("utm_campaign", `rsf-${placement}-banner`);
    url.searchParams.set("utm_content", `${category}-${bannerId}`);

    return url.toString();
  } catch {
    return link;
  }
};

const normalizeSocialUrl = (value: string | null | undefined, network: "instagram" | "facebook") => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  if (/^https?:\/\//i.test(withoutAt)) return withoutAt;
  const cleaned = withoutAt.replace(/^\/\//, "");
  const lower = cleaned.toLowerCase();
  if (lower.includes("instagram.com") || lower.includes("facebook.com")) {
    return `https://${cleaned}`;
  }
  const base = network === "instagram"
    ? "https://instagram.com/"
    : "https://facebook.com/";
  return `${base}${cleaned}`;
};

const normalizeBannerVideoOrientation = (
  value: string | null | undefined
): BannerVideoOrientation => (value === "portrait" ? "portrait" : "landscape");

type HkSettings = {
  checkoutMinutes: number;
  stayoverMinutes: number;
  lunchMinutes: number;
  mporStandard: number;
  clockInTime: string;
  roomInventory: number;
};

type HkAttendantEntry = {
  attendantName: string;
  checkoutsCleaned: string;
  stayoversCleaned: string;
  paidHours: string;
  lunchMinutes: string;
  lateCheckouts: string;
  deepCleans: string;
  recleans: string;
  notes: string;
};

type HkDayMeta = {
  roomsSold: string;
  totalDailyHours: string;
  roomRevenueDaily: string;
  roomsSoldImported?: boolean;
  notes: string;
};

type HkBudgetMap = Record<string, string>;

export default function AdminDashboard() {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const normalizedAdminEmail = (user?.email ?? "").trim().toLowerCase();
  const canSeeFinance = FINANCE_EMAILS.includes(normalizedAdminEmail);
  const adminRole = (user?.adminRole as AdminRole | undefined) || undefined;
  const adminPermissions = (user?.adminPermissions || []) as AdminPermission[];
  const canAccess = (permission: AdminPermission) =>
    isSuperAdmin ||
    (adminRole ? ADMIN_ROLE_PERMISSIONS[adminRole]?.includes(permission) : false) ||
    adminPermissions.includes(permission);

  const [userSearch, setUserSearch] = useState("");
  const [activeTab, setActiveTab] = useState("analytics");
  const [featureUsageRange, setFeatureUsageRange] = useState("7");
  const [featureEngagementOpen, setFeatureEngagementOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<VerificationSubmission | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AdminRole>("operations");
  const hkDefaultProperty = "Fairfield Austin Domain";
  const [hkProperty, setHkProperty] = useState(hkDefaultProperty);
  const [hkMonth, setHkMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [hkImportDialogOpen, setHkImportDialogOpen] = useState(false);
  const [hkImporting, setHkImporting] = useState(false);
  const [hkImportSummary, setHkImportSummary] = useState<null | {
    filesProcessed: number;
    parsedCount: number;
    updatedCount: number;
    skippedCount: number;
    conflictCount: number;
    overwrittenCount: number;
    overwrittenDates: string[];
    skipped: Array<{ fileName: string; line: number; reason: string; raw: string }>;
    conflicts: Array<{ date: string; previous: number | null; next: number }>;
  }>(null);
  const [hkSettings, setHkSettings] = useState<HkSettings>(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("hk-settings") : null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as HkSettings;
        return {
          checkoutMinutes: Number(parsed.checkoutMinutes || 30),
          stayoverMinutes: Number(parsed.stayoverMinutes || 15),
          lunchMinutes: Number(parsed.lunchMinutes || 30),
          mporStandard: Number(parsed.mporStandard || 24),
          clockInTime: parsed.clockInTime || "08:00",
          roomInventory: Number(parsed.roomInventory || 134),
        };
      } catch {}
    }
    return {
      checkoutMinutes: 30,
      stayoverMinutes: 15,
      lunchMinutes: 30,
      mporStandard: 24,
      clockInTime: "08:00",
      roomInventory: 134,
    };
  });
  const [hkMonthlyBudgets, setHkMonthlyBudgets] = useState<HkBudgetMap>(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("hk-monthly-budgets") : null;
    if (!stored) return {};
    try {
      const parsed = JSON.parse(stored) as HkBudgetMap;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });
  const [hkExpandedDays, setHkExpandedDays] = useState<Record<string, boolean>>({});
  const [hkDayMeta, setHkDayMeta] = useState<Record<string, HkDayMeta>>({});
  const [hkAttendantsByDay, setHkAttendantsByDay] = useState<Record<string, HkAttendantEntry[]>>({});
  const [hkSavingDays, setHkSavingDays] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const allowed = [
      canAccess("analytics") && "analytics",
      canAccess("hk-metrics") && "hk-metrics",
      canAccess("crm") && "crm",
      canAccess("users") && "users",
      canAccess("verifications") && "verifications",
      canAccess("aircraft") && "aircraft",
      canAccess("marketplace") && "marketplace",
      canAccess("stale") && "stale",
      canAccess("promo") && "promo",
      canAccess("promo-codes") && "promo-codes",
      canAccess("withdrawals") && "withdrawals",
      canAccess("notifications") && "notifications",
      canAccess("banners") && "banners",
      canSeeFinance && "finance",
      canSeeFinance && "personal-finance",
      isSuperAdmin && "admins",
    ].filter(Boolean) as string[];

    if (!allowed.includes(activeTab) && allowed.length > 0) {
      setActiveTab(allowed[0]);
    }
  }, [adminRole, adminPermissions, canSeeFinance, isSuperAdmin, activeTab]);
  
  // CRM state
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [leadCategoryFilter, setLeadCategoryFilter] = useState<LeadCategory | "all">("all");
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);
  const [salesEmailDialogOpen, setSalesEmailDialogOpen] = useState(false);
  const [selectedSalesLead, setSelectedSalesLead] = useState<CrmLead | null>(null);
  const [salesEmailTemplateType, setSalesEmailTemplateType] = useState<CrmSalesEmailTemplateType>("new_listing");
  const [salesEmailGreetingName, setSalesEmailGreetingName] = useState("");
  const [salesEmailSubjectOverride, setSalesEmailSubjectOverride] = useState("");
  const [salesEmailIntroOverride, setSalesEmailIntroOverride] = useState("");
  const [salesEmailCustomNote, setSalesEmailCustomNote] = useState("");
  const [salesEmailPromoCode, setSalesEmailPromoCode] = useState("");
  const [salesEmailPromoDetails, setSalesEmailPromoDetails] = useState("");
  const deferredSalesEmailGreetingName = useDeferredValue(salesEmailGreetingName);
  const deferredSalesEmailSubjectOverride = useDeferredValue(salesEmailSubjectOverride);
  const deferredSalesEmailIntroOverride = useDeferredValue(salesEmailIntroOverride);
  const deferredSalesEmailCustomNote = useDeferredValue(salesEmailCustomNote);
  const deferredSalesEmailPromoCode = useDeferredValue(salesEmailPromoCode);
  const deferredSalesEmailPromoDetails = useDeferredValue(salesEmailPromoDetails);
  
  // Expense management state
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  
  // Listing management state
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftListing | null>(null);
  const [selectedMarketplace, setSelectedMarketplace] = useState<MarketplaceListing | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'aircraft' | 'marketplace'; id: string } | null>(null);
  const [adminFreeListingDialogOpen, setAdminFreeListingDialogOpen] = useState(false);
  const [adminFreeListingEmail, setAdminFreeListingEmail] = useState("");
  const [adminFreeListingUserId, setAdminFreeListingUserId] = useState("");
  const [adminFreeListingDurationDays, setAdminFreeListingDurationDays] = useState("90");
  const [adminFreeListingAllowEmailOnly, setAdminFreeListingAllowEmailOnly] = useState(false);
  
  // Promo alerts state
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoAlert | null>(null);
  
  // Promo codes state
  const [promoCodeDialogOpen, setPromoCodeDialogOpen] = useState(false);
  const [editingPromoCode, setEditingPromoCode] = useState<PromoCode | null>(null);
  const [promoCodeSearch, setPromoCodeSearch] = useState("");
  
  // Banner ads state
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerAd | null>(null);
  const [bannerImageUrl, setBannerImageUrl] = useState<string>("");
  const [bannerVideoUrl, setBannerVideoUrl] = useState<string>("");
  
  // Banner ad orders state
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<BannerAdOrder | null>(null);
  const [selectedTier, setSelectedTier] = useState<BannerAdTier>("3months");
  const [orderImageUrl, setOrderImageUrl] = useState<string>("");
  const [orderVideoUrl, setOrderVideoUrl] = useState<string>("");
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [promoCodeValid, setPromoCodeValid] = useState<boolean | null>(null);
  const [promoCodeMessage, setPromoCodeMessage] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  
  // Withdrawal monitoring state
  const [withdrawalSearch, setWithdrawalSearch] = useState("");
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState("all");
  
  // Lead form with Zod validation
  const leadForm = useForm<InsertCrmLead>({
    resolver: zodResolver(insertCrmLeadSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      company: "",
      status: "new",
      source: undefined,
      category: "other",
      notes: "",
    },
  });

  // Expense form with Zod validation
  const expenseForm = useForm<InsertExpense>({
    resolver: zodResolver(insertExpenseSchema),
    defaultValues: {
      category: "server",
      amount: "",
      expenseDate: new Date(),
      description: "",
      invoiceUrl: "",
    },
  });
  
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [extractingData, setExtractingData] = useState(false);
  
  // Promo alert form with Zod validation
  const promoForm = useForm<InsertPromoAlert>({
    resolver: zodResolver(insertPromoAlertSchema),
    defaultValues: {
      title: "",
      message: "",
      promoCode: "",
      isEnabled: true,
      showOnMainPage: true,
      showOnCategoryPages: true,
      targetCategories: [],
      variant: "info",
    },
  });

  // Promo code form with Zod validation
  const promoCodeForm = useForm<InsertPromoCode>({
    resolver: zodResolver(insertPromoCodeSchema),
    defaultValues: {
      code: "",
      description: "",
      discountType: "percentage",
      discountValue: "",
      maxUses: undefined,
      validFrom: new Date(),
      validUntil: undefined,
      isActive: true,
      applicableToBannerAds: false,
      applicableToMarketplace: true,
    },
  });
  
  // Banner ad form with Zod validation
  const bannerForm = useForm<InsertBannerAd>({
    resolver: zodResolver(insertBannerAdSchema),
    defaultValues: {
      title: "",
      description: "",
      adCopy: "",
      imageUrl: "",
      videoUrl: "",
      videoMuted: true,
      videoOrientation: "landscape",
      link: "",
      instagramUrl: "",
      facebookUrl: "",
      placements: [],
      category: undefined,
      listingId: undefined,
      listingType: undefined,
      isActive: true,
      startDate: new Date(),
      endDate: undefined,
    },
  });
  
  // Banner ad order form with Zod validation
  const orderForm = useForm<InsertBannerAdOrder>({
    resolver: zodResolver(insertBannerAdOrderSchema),
    defaultValues: {
      sponsorName: "",
      sponsorEmail: "",
      sponsorCompany: "",
      title: "",
      description: "",
      adCopy: "",
      imageUrl: "",
      videoUrl: "",
      videoMuted: true,
      videoOrientation: "landscape",
      link: "",
      placements: [],
      category: undefined,
      tier: "3months",
      monthlyRate: "60.00",
      totalAmount: "180.00",
      creationFee: "40.00",
      grandTotal: "220.00",
      promoCode: "",
      discountAmount: "0.00",
      approvalStatus: "draft",
      paymentStatus: "pending",
      adminNotes: "",
      startDate: new Date(),
      endDate: undefined,
    },
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("hk-settings", JSON.stringify(hkSettings));
    }
  }, [hkSettings]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("hk-monthly-budgets", JSON.stringify(hkMonthlyBudgets));
    }
  }, [hkMonthlyBudgets]);

  
  const { toast } = useToast();

  const getBannerDurationDays = (start?: Date, end?: Date) => {
    if (!start || !end) return null;
    const dayMs = 24 * 60 * 60 * 1000;
    const diff = end.getTime() - start.getTime();
    if (!Number.isFinite(diff) || diff < 0) return null;
    return Math.max(1, Math.ceil(diff / dayMs));
  };

  // User search query
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: [`/api/admin/users?q=${userSearch}`],
    enabled: userSearch.length > 0,
  });

  // Aircraft listings query
  const { data: aircraftListings = [], isLoading: aircraftLoading } = useQuery<AircraftListing[]>({
    queryKey: ["/api/admin/aircraft"],
    enabled: activeTab === "aircraft",
  });

  // Marketplace listings query
  const { data: marketplaceListings = [], isLoading: marketplaceLoading } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/admin/marketplace"],
    enabled: activeTab === "marketplace",
  });

  // Flagged marketplace listings query (5+ flags)
  const { data: flaggedListings = [] } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/marketplace/flagged"],
  });

  // Pending verification submissions query (always fetch for badge count)
  const { data: verificationSubmissions = [], isLoading: verificationsLoading } = useQuery<VerificationSubmission[]>({
    queryKey: ["/api/verification-submissions/pending"],
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache results
    refetchOnMount: 'always', // Always refetch when component mounts
  });

  // Analytics query
  const { data: analytics, isLoading: analyticsLoading } = useQuery<{
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
  }>({
    queryKey: ["/api/admin/analytics"],
    enabled: activeTab === "analytics" || activeTab === "finance",
  });

  const { data: featureUsage, isLoading: featureUsageLoading } = useQuery<{
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
  }>({
    queryKey: [`/api/admin/feature-usage?days=${featureUsageRange}`],
    enabled: activeTab === "analytics",
  });

  // CRM Leads query
  const { data: leads = [], isLoading: leadsLoading } = useQuery<CrmLead[]>({
    queryKey: ["/api/crm/leads"],
    enabled: activeTab === "crm",
  });

  const filteredLeads = useMemo(
    () =>
      leadCategoryFilter === "all"
        ? leads
        : leads.filter((lead) => (lead.category || "other") === leadCategoryFilter),
    [leads, leadCategoryFilter],
  );

  const { data: salesEmailPreview, isLoading: salesEmailPreviewLoading, error: salesEmailPreviewError } = useQuery<CrmSalesEmailPreview>({
    queryKey: [
      "/api/crm/leads/sales-email-preview",
      selectedSalesLead?.id ?? "",
      salesEmailTemplateType,
      deferredSalesEmailGreetingName,
      deferredSalesEmailSubjectOverride,
      deferredSalesEmailIntroOverride,
      deferredSalesEmailCustomNote,
      deferredSalesEmailPromoCode,
      deferredSalesEmailPromoDetails,
    ],
    enabled: salesEmailDialogOpen && Boolean(selectedSalesLead?.id),
    queryFn: async () => {
      if (!selectedSalesLead?.id) {
        throw new Error("No lead selected");
      }

      const response = await fetch(apiUrl(`/api/crm/leads/${selectedSalesLead.id}/sales-email-preview`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          templateType: salesEmailTemplateType,
          greetingName: deferredSalesEmailGreetingName,
          subjectOverride: deferredSalesEmailSubjectOverride,
          introOverride: deferredSalesEmailIntroOverride,
          customNote: deferredSalesEmailCustomNote,
          promoCode: deferredSalesEmailPromoCode,
          promoDetails: deferredSalesEmailPromoDetails,
        }),
      });

      if (!response.ok) {
        const message = (await response.text()) || "Failed to load email preview";
        throw new Error(message);
      }

      return response.json();
    },
  });

  // Expenses query
  const { data: expenses = [], isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/admin/expenses"],
    enabled: activeTab === "finance",
  });

  // Promo alerts query (admin endpoint fetches all, including disabled)
  const { data: promoAlerts = [], isLoading: promoAlertsLoading } = useQuery<PromoAlert[]>({
    queryKey: ["/api/admin/promo-alerts"],
    enabled: activeTab === "promo",
  });

  // Promo codes query
  const { data: promoCodes = [], isLoading: promoCodesLoading } = useQuery<PromoCode[]>({
    queryKey: ["/api/admin/promo-codes"],
    enabled: activeTab === "promo-codes",
  });

  // Stale listings query
  const { data: staleListings, isLoading: staleLoading } = useQuery<{
    aircraft: AircraftListing[];
    marketplace: MarketplaceListing[];
    totalCount: number;
  }>({
    queryKey: ["/api/admin/stale-listings"],
    enabled: activeTab === "stale",
  });

  // Orphaned listings query
  const { data: orphanedListings, isLoading: orphanedLoading } = useQuery<{
    aircraft: AircraftListing[];
    marketplace: MarketplaceListing[];
    totalCount: number;
  }>({
    queryKey: ["/api/admin/orphaned-listings"],
    enabled: activeTab === "stale",
  });

  // User metrics query
  const { data: userMetrics, isLoading: userMetricsLoading } = useQuery<{
    totalUsers: number;
    verifiedUsers: number;
    newUsersToday: number;
    newUsersThisWeek: number;
    newUsersThisMonth: number;
    activeListingOwners: number;
    activeRenters: number;
    verificationRate: number;
    geographic: {
      byState: Array<{ state: string; count: number }>;
      byCity: Array<{ city: string; state: string; count: number }>;
    };
    retention: {
      returningUsers: number;
      oneTimeUsers: number;
      retentionRate: number;
    };
  }>({
    queryKey: ["/api/admin/user-metrics"],
    enabled: activeTab === "analytics",
  });

  // Withdrawals query
  const { data: withdrawals = [], isLoading: withdrawalsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/withdrawals"],
    enabled: activeTab === "withdrawals",
  });

  // Admin Notifications query
  const { data: adminNotifications = [], isLoading: notificationsLoading } = useQuery<AdminNotification[]>({
    queryKey: ["/api/admin/notifications"],
    enabled: activeTab === "notifications",
  });

  // Unread notifications count (always fetch for badge)
  const { data: unreadNotifications = [] } = useQuery<AdminNotification[]>({
    queryKey: ["/api/admin/notifications/unread"],
  });

  // Banner ads query
  const { data: bannerAds = [], isLoading: bannerAdsLoading } = useQuery<BannerAd[]>({
    queryKey: ["/api/admin/banner-ads"],
    enabled: activeTab === "banners",
  });

  const { data: partnerToolMetrics = [] } = useQuery<PartnerToolMetric[]>({
    queryKey: ["/api/admin/partner-tools/metrics"],
    enabled: activeTab === "banners",
  });

  // Banner ad orders query
  const { data: bannerOrders = [], isLoading: ordersLoading } = useQuery<BannerAdOrder[]>({
    queryKey: ["/api/admin/banner-ad-orders"],
    enabled: activeTab === "banners",
  });

  const { data: adminInvites = [], isLoading: invitesLoading } = useQuery<AdminInvite[]>({
    queryKey: ["/api/admin/invites"],
    enabled: activeTab === "admins" && isSuperAdmin,
  });

  const { data: adminUsers = [], isLoading: adminUsersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/admins"],
    enabled: activeTab === "admins" && isSuperAdmin,
  });

  const hkMonthRange = useMemo(() => {
    const parsed = parse(hkMonth, "yyyy-MM", new Date());
    const startDate = format(startOfMonth(parsed), "yyyy-MM-dd");
    const endDate = format(endOfMonth(parsed), "yyyy-MM-dd");
    return { startDate, endDate };
  }, [hkMonth]);

  const hkSummaryUrl = useMemo(() => {
    const propertyParam = hkProperty ? `&property=${encodeURIComponent(hkProperty)}` : "";
    return `/api/admin/hk-metrics/summary?start=${hkMonthRange.startDate}&end=${hkMonthRange.endDate}${propertyParam}`;
  }, [hkMonthRange.startDate, hkMonthRange.endDate, hkProperty]);

  const { data: hkSummary, isLoading: hkSummaryLoading } = useQuery<{
    startDate: string;
    endDate: string;
    property: string | null;
    overall: Record<string, number | null>;
    dailyEntries: Array<Record<string, any>>;
    attendantEntries: Array<Record<string, any>>;
    weeklyRollups: Array<Record<string, any>>;
    monthlyRollups: Array<Record<string, any>>;
    attendantRollups: Array<Record<string, any>>;
  }>({
    queryKey: [hkSummaryUrl],
    enabled: activeTab === "hk-metrics",
  });

  const { data: hkProperties = [] } = useQuery<string[]>({
    queryKey: ["/api/admin/hk-metrics/properties"],
    enabled: activeTab === "hk-metrics",
  });

  useEffect(() => {
    if (!hkSummary) return;
    const nextDayMeta: Record<string, HkDayMeta> = {};
    const nextAttendants: Record<string, HkAttendantEntry[]> = {};

    hkSummary.dailyEntries.forEach((entry: any) => {
      const metricDate = String(entry.metricDate || "");
      if (!metricDate) return;
      nextDayMeta[metricDate] = {
        roomsSold: entry.roomsSold?.toString() ?? "",
        totalDailyHours: entry.totalDailyHours?.toString() ?? "",
        roomRevenueDaily: entry.roomRevenueDaily?.toString() ?? "",
        roomsSoldImported: Boolean(entry.roomsSoldImported),
        notes: entry.notes ?? "",
      };
    });

    hkSummary.attendantEntries.forEach((entry: any) => {
      const metricDate = String(entry.metricDate || "");
      if (!metricDate) return;
      if (!nextAttendants[metricDate]) nextAttendants[metricDate] = [];
      nextAttendants[metricDate].push({
        attendantName: entry.attendantName || "",
        checkoutsCleaned: entry.checkoutsCleaned?.toString() ?? "",
        stayoversCleaned: entry.stayoversCleaned?.toString() ?? "",
        paidHours: entry.paidHours?.toString() ?? "",
        lunchMinutes: entry.lunchMinutes?.toString() ?? hkSettings.lunchMinutes.toString(),
        lateCheckouts: entry.lateCheckouts?.toString() ?? "",
        deepCleans: entry.deepCleans?.toString() ?? "",
        recleans: entry.recleans?.toString() ?? "",
        notes: entry.notes ?? "",
      });
    });

    setHkDayMeta((prev) => ({ ...prev, ...nextDayMeta }));
    setHkAttendantsByDay((prev) => ({ ...prev, ...nextAttendants }));
  }, [hkSummary, hkSettings.lunchMinutes]);

  // Create orderId→bannerAd lookup to check activation status
  const bannerAdsByOrderId = useMemo(() => {
    const map = new Map<string, BannerAd>();
    bannerAds.forEach(ad => {
      if (ad.orderId) {
        map.set(ad.orderId, ad);
      }
    });
    return map;
  }, [bannerAds]);

  // Helper to check if an order has been activated
  const isOrderActivated = (orderId: string) => bannerAdsByOrderId.has(orderId);

  const formatUsageLabel = (raw: string) => {
    if (!raw) return "Unknown";
    let key = raw;
    if (key.startsWith("http")) {
      try {
        key = new URL(key).pathname || "/";
      } catch {}
    }
    if (key === "/") return "Home";
    if (key.startsWith("/")) {
      const parts = key.split("/").filter(Boolean);
      if (!parts.length) return "Home";
      const labelParts = parts.map((part) =>
        part
          .replace(/[_-]+/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase())
      );
      if (parts[0] === "student") {
        return `Student • ${labelParts.slice(1).join(" • ") || "Hub"}`;
      }
      if (parts[0] === "gps-sims") {
        return `GPS Sims • ${labelParts.slice(1).join(" • ") || "Hub"}`;
      }
      return labelParts.join(" • ");
    }
    return key
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const featureUsagePages = useMemo(() => featureUsage?.pages ?? [], [featureUsage]);

  // Approve submission mutation
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/verification-submissions/${id}`, { status: "approved" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/verification-submissions/pending"] });
      toast({
        title: "Verification Approved",
        description: "User verification has been approved successfully.",
      });
      setReviewDialogOpen(false);
    },
  });

  // Reject submission mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      return await apiRequest("PATCH", `/api/verification-submissions/${id}`, {
        status: "rejected",
        rejectionReason: notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/verification-submissions/pending"] });
      toast({
        title: "Verification Rejected",
        description: "User has been notified of the rejection.",
      });
      setReviewDialogOpen(false);
      setRejectionNotes("");
    },
  });

  // CRM Lead mutations
  const createLeadMutation = useMutation({
    mutationFn: async (data: InsertCrmLead) => {
      return await apiRequest("POST", "/api/crm/leads", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      toast({ title: "Lead created successfully" });
      setLeadDialogOpen(false);
      leadForm.reset();
      setEditingLead(null);
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CrmLead> }) => {
      return await apiRequest("PATCH", `/api/crm/leads/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      toast({ title: "Lead updated successfully" });
      setLeadDialogOpen(false);
      leadForm.reset();
      setEditingLead(null);
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/crm/leads/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      toast({ title: "Lead deleted successfully" });
    },
  });

  const sendLeadSalesEmailMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      templateType: CrmSalesEmailTemplateType;
      greetingName?: string;
      subjectOverride?: string;
      introOverride?: string;
      customNote?: string;
      promoCode?: string;
      promoDetails?: string;
    }) => {
      const response = await apiRequest("POST", `/api/crm/leads/${payload.id}/send-sales-email`, {
        templateType: payload.templateType,
        greetingName: payload.greetingName,
        subjectOverride: payload.subjectOverride,
        introOverride: payload.introOverride,
        customNote: payload.customNote,
        promoCode: payload.promoCode,
        promoDetails: payload.promoDetails,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      toast({ title: "Sales email sent" });
      handleCloseSalesEmailDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send sales email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Expense mutations
  const createExpenseMutation = useMutation({
    mutationFn: async (data: InsertExpense) => {
      return await apiRequest("POST", "/api/admin/expenses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      toast({ title: "Expense added successfully" });
      setExpenseDialogOpen(false);
      expenseForm.reset();
      setEditingExpense(null);
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Expense> }) => {
      return await apiRequest("PATCH", `/api/admin/expenses/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      toast({ title: "Expense updated successfully" });
      setExpenseDialogOpen(false);
      expenseForm.reset();
      setEditingExpense(null);
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/expenses/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      toast({ title: "Expense deleted successfully" });
    },
  });

  // Notification mutations
  const markNotificationReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/admin/notifications/${id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications/unread"] });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/notifications/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications/unread"] });
      toast({ title: "Notification deleted" });
    },
  });

  const createAdminInviteMutation = useMutation({
    mutationFn: async (payload: { email: string; role: AdminRole }) => {
      const res = await apiRequest("POST", "/api/admin/invites", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      toast({ title: "Invite sent", description: "The admin invite email was sent." });
      setInviteEmail("");
      setInviteRole("operations");
    },
    onError: (error: any) => {
      toast({ title: "Invite failed", description: error.message, variant: "destructive" });
    },
  });

  const updateAdminRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AdminRole }) => {
      const permissions = ADMIN_ROLE_PERMISSIONS[role];
      return await apiRequest("PATCH", `/api/admin/users/${userId}`, {
        isAdmin: true,
        adminRole: role,
        adminPermissions: permissions,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Admin role updated" });
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const syncApproachPlatesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/approach-plates/sync", {
        mode: "incremental",
        limit: 400,
        maxMs: 30000,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync approach plates");
      }
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Approach plate sync started",
        description: "Sync runs in the background. Search again in a minute.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  const { data: plateStatus } = useQuery<{ lastFinishedAt?: string | null }>({
    queryKey: ["/api/admin/approach-plates/status"],
  });

  // Aircraft listing mutations
  const toggleAircraftMutation = useMutation({
    mutationFn: async ({ id, isListed }: { id: string; isListed: boolean }) => {
      return await apiRequest("PATCH", `/api/aircraft/${id}`, { isListed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/aircraft"] });
      toast({ title: "Aircraft listing updated" });
    },
  });

  const deleteAircraftMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/aircraft/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/aircraft"] });
      toast({ title: "Aircraft listing deleted" });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
  });

  // Marketplace listing mutations
  const toggleMarketplaceMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiRequest("PATCH", `/api/marketplace/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace"] });
      toast({ title: "Marketplace listing updated" });
    },
  });

  const adminFreeListingTokenMutation = useMutation({
    mutationFn: async (payload?: { userId?: string; email?: string; durationDays?: number; allowEmailOnly?: boolean }) => {
      const response = await apiRequest("POST", "/api/admin/marketplace/free-listing-token", payload || {});
      return response.json();
    },
    onSuccess: (data: { token: string; durationDays: number; userId?: string; email?: string; fallbackToAdmin?: boolean }) => {
      localStorage.setItem(
        'adminFreeListingGrant',
        JSON.stringify({
          token: data.token,
          durationDays: data.durationDays,
          targetUserId: data.userId,
          targetEmail: data.email,
          fallbackToAdmin: data.fallbackToAdmin,
        })
      );
      setAdminFreeListingDialogOpen(false);
      setAdminFreeListingEmail("");
      setAdminFreeListingUserId("");
      setAdminFreeListingDurationDays("90");
      setAdminFreeListingAllowEmailOnly(false);
      toast({
        title: "Admin free listing enabled",
        description: data.fallbackToAdmin
          ? `No user found. Listing will be created under your admin account (contact email set).`
          : `Grant ready for ${data.durationDays}-day listing. Complete the form to publish.`,
      });
      window.location.href = "/create-marketplace-listing?adminFree=1";
    },
    onError: (error: Error) => {
      const message = error.message || "Could not issue admin grant";
      const isMissingUserForEmail = message.includes("User not found for the provided email");
      toast({
        title: "Failed to start free listing",
        description: isMissingUserForEmail
          ? "That email is not an existing RSF account. Check 'Advertiser does not have an account yet' to create the listing under your admin account and keep the advertiser email as the contact."
          : message,
        variant: "destructive",
      });
    },
  });

  const togglePromoAlertMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      return await apiRequest("PATCH", `/api/promo-alerts/${id}`, { isEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-alerts"] });
      toast({ title: "Promotional alert updated" });
    },
  });

  const createPromoAlertMutation = useMutation({
    mutationFn: async (data: InsertPromoAlert) => {
      return await apiRequest("POST", `/api/promo-alerts`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-alerts"] });
      promoForm.reset();
      setPromoDialogOpen(false);
      setEditingPromo(null);
      toast({ title: "Promotional alert created successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create promotional alert",
        variant: "destructive" 
      });
    },
  });

  // Promo code mutations
  const createPromoCodeMutation = useMutation({
    mutationFn: async (data: InsertPromoCode) => {
      return await apiRequest("POST", "/api/admin/promo-codes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-codes"] });
      setPromoCodeDialogOpen(false);
      setEditingPromoCode(null);
      promoCodeForm.reset();
      toast({ title: "Promo code created successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create promo code",
        variant: "destructive" 
      });
    },
  });

  const updatePromoCodeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertPromoCode> }) => {
      return await apiRequest("PATCH", `/api/admin/promo-codes/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-codes"] });
      setPromoCodeDialogOpen(false);
      setEditingPromoCode(null);
      promoCodeForm.reset();
      toast({ title: "Promo code updated successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update promo code",
        variant: "destructive" 
      });
    },
  });

  const deletePromoCodeMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/promo-codes/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-codes"] });
      setPromoCodeDialogOpen(false);
      setEditingPromoCode(null);
      promoCodeForm.reset();
      toast({ title: "Promo code deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete promo code",
        variant: "destructive" 
      });
    },
  });

  const togglePromoCodeMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/promo-codes/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-codes"] });
      setPromoCodeDialogOpen(false);
      setEditingPromoCode(null);
      promoCodeForm.reset();
      toast({ title: "Promo code status updated successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update promo code status",
        variant: "destructive" 
      });
    },
  });

  // Banner image upload handlers
  const handleBannerGetUploadParameters = async () => {
    const response = await fetch(apiUrl('/api/objects/upload'), {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error("Failed to get upload URL");
    }
    const data = await response.json();
    return {
      method: 'PUT' as const,
      url: data.uploadURL,
    };
  };

  const handleBannerUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    try {
      for (const file of result.successful || []) {
        if (file.uploadURL) {
          // Set ACL policy for public access
          const aclResponse = await fetch(apiUrl('/api/objects/set-acl'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              path: file.uploadURL,
              access: 'publicRead', // Banner images need to be publicly accessible
            }),
          });
          
          // Update form field with the uploaded URL
          const aclData = aclResponse.ok ? await aclResponse.json() : null;
          const imageUrl = aclData?.objectPath || file.uploadURL.split('?')[0]; // Remove query params
          setBannerImageUrl(imageUrl);
          bannerForm.setValue('imageUrl', imageUrl, { shouldValidate: true, shouldDirty: true });
          
          toast({ 
            title: "Image uploaded successfully",
            description: "Your banner image is ready to use"
          });
        }
      }
    } catch (error) {
      console.error('Error processing banner upload:', error);
      toast({
        title: "Upload failed",
        description: "Failed to process the uploaded image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBannerVideoUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    try {
      for (const file of result.successful || []) {
        if (file.uploadURL) {
          
          const aclResponse = await fetch(apiUrl('/api/objects/set-acl'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              path: file.uploadURL,
              access: 'publicRead',
            }),
          });

          const aclData = aclResponse.ok ? await aclResponse.json() : null;
          const videoUrl = aclData?.objectPath || file.uploadURL.split('?')[0];
          setBannerVideoUrl(videoUrl);
          bannerForm.setValue('videoUrl', videoUrl, { shouldValidate: true, shouldDirty: true });

          toast({
            title: "Video uploaded successfully",
            description: "Your banner video is ready to use",
          });
        }
      }
    } catch (error) {
      console.error('Error processing banner video upload:', error);
      toast({
        title: "Upload failed",
        description: "Failed to process the uploaded video. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Order image upload handlers
  const handleOrderGetUploadParameters = async () => {
    const response = await fetch(apiUrl('/api/objects/upload'), {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error("Failed to get upload URL");
    }
    const data = await response.json();
    return {
      method: 'PUT' as const,
      url: data.uploadURL,
    };
  };

  const handleOrderUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    try {
      for (const file of result.successful || []) {
        if (file.uploadURL) {
          // Set ACL policy for public access
          const aclResponse = await fetch(apiUrl('/api/objects/set-acl'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              path: file.uploadURL,
              access: 'publicRead', // Order banner images need to be publicly accessible
            }),
          });
          
          // Update form field with the uploaded URL
          const aclData = aclResponse.ok ? await aclResponse.json() : null;
          const imageUrl = aclData?.objectPath || file.uploadURL.split('?')[0]; // Remove query params
          setOrderImageUrl(imageUrl);
          orderForm.setValue('imageUrl', imageUrl, { shouldValidate: true, shouldDirty: true });
          
          toast({ 
            title: "Image uploaded successfully",
            description: "Your banner image is ready to use"
          });
        }
      }
    } catch (error) {
      console.error('Error processing order upload:', error);
      toast({
        title: "Upload failed",
        description: "Failed to process the uploaded image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleOrderVideoUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    try {
      for (const file of result.successful || []) {
        if (file.uploadURL) {
          
          const aclResponse = await fetch(apiUrl('/api/objects/set-acl'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              path: file.uploadURL,
              access: 'publicRead',
            }),
          });

          const aclData = aclResponse.ok ? await aclResponse.json() : null;
          const videoUrl = aclData?.objectPath || file.uploadURL.split('?')[0];
          setOrderVideoUrl(videoUrl);
          orderForm.setValue('videoUrl', videoUrl, { shouldValidate: true, shouldDirty: true });

          toast({
            title: "Video uploaded successfully",
            description: "Your banner video is ready to use",
          });
        }
      }
    } catch (error) {
      console.error('Error processing order video upload:', error);
      toast({
        title: "Upload failed",
        description: "Failed to process the uploaded video. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Banner ad mutations
  const createBannerAdMutation = useMutation({
    mutationFn: async (data: InsertBannerAd) => {
      return await apiRequest("POST", `/api/admin/banner-ads`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banner-ads"] });
      bannerForm.reset();
      setBannerDialogOpen(false);
      setEditingBanner(null);
      setBannerImageUrl("");
      setBannerVideoUrl("");
      toast({ title: "Banner ad created successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create banner ad",
        variant: "destructive" 
      });
    },
  });

  const updateBannerAdMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertBannerAd> }) => {
      return await apiRequest("PATCH", `/api/admin/banner-ads/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banner-ads"] });
      bannerForm.reset();
      setBannerDialogOpen(false);
      setEditingBanner(null);
      setBannerImageUrl("");
      setBannerVideoUrl("");
      toast({ title: "Banner ad updated successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update banner ad",
        variant: "destructive" 
      });
    },
  });

  const deleteBannerAdMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/banner-ads/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banner-ads"] });
      toast({ title: "Banner ad deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete banner ad",
        variant: "destructive" 
      });
    },
  });

  const toggleBannerAdMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/banner-ads/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banner-ads"] });
      toast({ title: "Banner ad status updated" });
    },
  });

  // Banner ad order mutations
  const createOrderMutation = useMutation({
    mutationFn: async (data: InsertBannerAdOrder) => {
      return await apiRequest("POST", `/api/admin/banner-ad-orders`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banner-ad-orders"] });
      orderForm.reset();
      setOrderDialogOpen(false);
      setEditingOrder(null);
      setOrderImageUrl("");
      setOrderVideoUrl("");
      toast({ title: "Banner ad order created successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create banner ad order",
        variant: "destructive" 
      });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertBannerAdOrder> }) => {
      return await apiRequest("PATCH", `/api/admin/banner-ad-orders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banner-ad-orders"] });
      orderForm.reset();
      setOrderDialogOpen(false);
      setEditingOrder(null);
      setOrderImageUrl("");
      setOrderVideoUrl("");
      toast({ title: "Banner ad order updated successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update banner ad order",
        variant: "destructive" 
      });
    },
  });

  const activateOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/admin/banner-ad-orders/${id}/activate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banner-ad-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banner-ads"] });
      toast({ 
        title: "Order activated", 
        description: "Banner ad is now live"
      });
    },
    onError: (error: any) => {
      // Handle 409 conflict (order already activated)
      if (error?.status === 409) {
        toast({
          title: "Order already activated",
          description: "This order has an active banner ad.",
          variant: "destructive",
        });
      } else if (error?.status === 402 || error?.error === 'Payment required') {
        toast({
          title: "Payment required",
          description: "Order must be paid (and captured) before activation.",
          variant: "destructive",
        });
      } else if (error?.error === 'Payment reference missing') {
        toast({
          title: "Missing PayPal Business/Commerce reference",
          description: "Capture must complete and record a PayPal Business/Commerce order ID before activation.",
          variant: "destructive",
        });
      } else if (error?.error === 'Approval required') {
        toast({
          title: "Approval required",
          description: "Approve the order before activating the banner.",
          variant: "destructive",
        });
      } else if (error?.errorCode === 'IMAGE_REQUIRED' || error?.message?.includes('IMAGE_REQUIRED')) {
        toast({
          title: "Image required",
          description: "Please upload a banner image before activating this order.",
          variant: "destructive",
        });
      } else {
        // Handle other errors
        toast({
          title: "Activation failed",
          description: error?.message || "Failed to activate banner ad order",
          variant: "destructive",
        });
      }
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/banner-ad-orders/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banner-ad-orders"] });
      toast({ title: "Banner ad order deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete banner ad order",
        variant: "destructive" 
      });
    },
  });

  const approveOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/admin/banner-ad-orders/${id}/approval`, { 
        approvalStatus: 'approved' 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banner-ad-orders"] });
      toast({ 
        title: "Order approved", 
        description: "Banner ad order approved successfully. You can now activate it."
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to approve order",
        variant: "destructive" 
      });
    },
  });

  const rejectOrderMutation = useMutation({
    mutationFn: async ({ id, adminNotes }: { id: string; adminNotes?: string }) => {
      return await apiRequest("PATCH", `/api/admin/banner-ad-orders/${id}/approval`, { 
        approvalStatus: 'rejected',
        adminNotes 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banner-ad-orders"] });
      toast({ 
        title: "Order rejected", 
        description: "Banner ad order has been rejected."
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to reject order",
        variant: "destructive" 
      });
    },
  });

  const deleteMarketplaceMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/marketplace/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace"] });
      toast({ title: "Marketplace listing deleted" });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
  });
  
  // Promo code application handler
  const handleApplyPromoCode = () => {
    const code = promoCodeInput.trim();
    
    if (!code) {
      setPromoCodeValid(null);
      setPromoCodeMessage("");
      setAppliedPromoCode(null);
      // Reset to base pricing
      const basePricing = calculateBannerAdPricing(selectedTier);
      orderForm.setValue('promoCode', "");
      orderForm.setValue('discountAmount', "0.00");
      orderForm.setValue('creationFee', basePricing.creationFee.toString());
      orderForm.setValue('grandTotal', basePricing.grandTotal.toString());
      return;
    }
    
    const promo = validatePromoCode(code);
    
    if (!promo) {
      setPromoCodeValid(false);
      setPromoCodeMessage("Invalid or expired promo code");
      setAppliedPromoCode(null);
      
      // CRITICAL FIX: Reset to base pricing when validation fails
      const basePricing = calculateBannerAdPricing(selectedTier);
      orderForm.setValue('promoCode', "");
      orderForm.setValue('discountAmount', "0.00");
      orderForm.setValue('creationFee', basePricing.creationFee.toString());
      orderForm.setValue('grandTotal', basePricing.grandTotal.toString());
      return;
    }
    
    // Calculate discounts
    const basePricing = calculateBannerAdPricing(selectedTier);
    const discounts = calculatePromoDiscount(
      basePricing.creationFee,
      basePricing.subscriptionTotal,
      code
    );
    
    // Update form values
    orderForm.setValue('promoCode', promo.code);
    orderForm.setValue('discountAmount', discounts.totalDiscount.toFixed(2));
    orderForm.setValue('creationFee', discounts.finalCreationFee.toFixed(2));
    orderForm.setValue('grandTotal', discounts.finalGrandTotal.toFixed(2));
    
    // Update UI state
    setPromoCodeValid(true);
    setPromoCodeMessage(`Promo code applied! You save $${discounts.totalDiscount.toFixed(2)}`);
    setAppliedPromoCode(promo.code);
    
    toast({
      title: "Promo code applied!",
      description: promo.description,
    });
  };

  const handleDeleteListing = () => {
    if (!deleteTarget) return;
    
    if (deleteTarget.type === 'aircraft') {
      deleteAircraftMutation.mutate(deleteTarget.id);
    } else {
      deleteMarketplaceMutation.mutate(deleteTarget.id);
    }
  };

  // Send listing reminders mutation
  const sendRemindersMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/send-listing-reminders", {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "Email reminders sent",
        description: `Successfully sent ${data.emailsSent} emails to users with active listings.`,
      });
    },
    onError: () => {
      toast({
        title: "Failed to send reminders",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  // Refresh aircraft listing mutation
  const refreshAircraftMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/aircraft/${id}/refresh`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stale-listings"] });
      toast({ title: "Aircraft listing refreshed" });
    },
  });

  // Refresh marketplace listing mutation
  const refreshMarketplaceMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/marketplace/${id}/refresh`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stale-listings"] });
      toast({ title: "Marketplace listing refreshed" });
    },
  });

  const handleEditLead = (lead: CrmLead) => {
    setEditingLead(lead);
    leadForm.reset({
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone || "",
      company: lead.company || "",
      status: lead.status as any,
      source: lead.source as any,
      category: (lead.category as LeadCategory) || "other",
      notes: lead.notes || "",
    });
    setLeadDialogOpen(true);
  };

  const handleOpenSalesEmailDialog = (lead: CrmLead) => {
    setSelectedSalesLead(lead);
    setSalesEmailTemplateType("new_listing");
    setSalesEmailGreetingName("");
    setSalesEmailSubjectOverride("");
    setSalesEmailIntroOverride("");
    setSalesEmailCustomNote("");
    setSalesEmailPromoCode("");
    setSalesEmailPromoDetails("");
    setSalesEmailDialogOpen(true);
  };

  const handleCloseSalesEmailDialog = () => {
    setSalesEmailDialogOpen(false);
    setSelectedSalesLead(null);
    setSalesEmailTemplateType("new_listing");
    setSalesEmailGreetingName("");
    setSalesEmailSubjectOverride("");
    setSalesEmailIntroOverride("");
    setSalesEmailCustomNote("");
    setSalesEmailPromoCode("");
    setSalesEmailPromoDetails("");
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    expenseForm.reset({
      category: expense.category as any,
      amount: expense.amount,
      expenseDate: expense.expenseDate ? new Date(expense.expenseDate) : new Date(),
      description: expense.description || "",
      invoiceUrl: expense.invoiceUrl || "",
    });
    setInvoiceFile(null);
    setExpenseDialogOpen(true);
  };

  const handleSubmitExpense = async (data: InsertExpense) => {
    let finalData = { ...data };
    
    // Upload invoice file if provided
    if (invoiceFile && !editingExpense) {
      try {
        const formData = new FormData();
        formData.append('documents', invoiceFile);
        
        const response = await fetch(apiUrl("/api/upload-documents"), {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = "Please try again";
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorMessage;
          } catch {
            if (errorText) errorMessage = errorText;
          }
          toast({ 
            title: "Invoice upload failed", 
            description: errorMessage,
            variant: "destructive" 
          });
          return;
        }
        
        const uploadData = await response.json();
        finalData.invoiceUrl = uploadData.documentUrls?.[0] || "";
      } catch (error) {
        console.error('Invoice upload failed:', error);
        toast({ 
          title: "Invoice upload failed", 
          description: "Please try again",
          variant: "destructive" 
        });
        return;
      }
    }
    
    if (editingExpense) {
      updateExpenseMutation.mutate({ id: editingExpense.id, data: finalData });
    } else {
      createExpenseMutation.mutate(finalData);
    }
  };
  
  const handleExtractInvoiceData = async () => {
    if (!invoiceFile) {
      toast({ title: "No invoice selected", variant: "destructive" });
      return;
    }
    
    setExtractingData(true);
    try {
      const formData = new FormData();
      formData.append('invoice', invoiceFile);
      
      const response = await fetch(apiUrl("/api/admin/extract-invoice-data"), {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Failed to extract data";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          if (errorText) errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }
      
      const extracted = await response.json();
      
      // Validate and auto-populate form fields
      let fieldsUpdated = 0;
      if (extracted.amount && typeof extracted.amount === 'string') {
        expenseForm.setValue('amount', extracted.amount);
        fieldsUpdated++;
      }
      if (extracted.date && typeof extracted.date === 'string') {
        try {
          const parsedDate = new Date(extracted.date);
          if (!isNaN(parsedDate.getTime())) {
            expenseForm.setValue('expenseDate', parsedDate);
            fieldsUpdated++;
          }
        } catch (e) {
          console.warn('Invalid date from OCR:', extracted.date);
        }
      }
      if (extracted.description && typeof extracted.description === 'string') {
        expenseForm.setValue('description', extracted.description);
        fieldsUpdated++;
      }
      if (extracted.category && ['server', 'database', 'other'].includes(extracted.category)) {
        expenseForm.setValue('category', extracted.category as any);
        fieldsUpdated++;
      }
      
      if (fieldsUpdated > 0) {
        toast({ 
          title: "Invoice data extracted!", 
          description: `${fieldsUpdated} field(s) auto-filled. Please review before saving.`
        });
      } else {
        toast({ 
          title: "Could not extract data", 
          description: "Please enter the information manually.",
          variant: "destructive" 
        });
      }
    } catch (error) {
      console.error('OCR extraction error:', error);
      toast({ 
        title: "Failed to extract invoice data", 
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive" 
      });
    } finally {
      setExtractingData(false);
    }
  };

  const handleSubmitLead = (data: InsertCrmLead) => {
    if (editingLead) {
      updateLeadMutation.mutate({ id: editingLead.id, data });
    } else {
      createLeadMutation.mutate(data);
    }
  };

  const formatHkValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, "") : "-";
    return String(value);
  };

  const formatCurrencyValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "-";
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric);
  };

  const formatPercentValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "-";
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "-";
    return `${numeric.toFixed(1)}%`;
  };

  const normalizeCurrencyInput = (value: string) => value.replace(/[^0-9.]/g, "");

  const formatDateInputValue = (value: unknown) => {
    if (value instanceof Date) return value.toISOString().split("T")[0];
    if (typeof value === "string") return value.split("T")[0];
    return "";
  };

  const handleNumberInput = (onChange: (value: any) => void) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    onChange(value === "" ? "" : Number(value));
  };

  const handleDecimalInput = (onChange: (value: any) => void) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const toNumber = (value: unknown) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const toHours = (value: unknown) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const toMporMinutes = (paidHours: number, rooms: number) => {
    if (paidHours <= 0 || rooms <= 0) return null;
    return (paidHours * 60) / rooms;
  };

  const Sparkline = ({ values }: { values: Array<number | null> }) => {
    const width = 120;
    const height = 24;
    const points = values
      .map((value, index) => ({ value, index }))
      .filter((point) => typeof point.value === "number") as Array<{ value: number; index: number }>;
    if (points.length < 2) {
      return <span className="text-muted-foreground">—</span>;
    }
    const min = Math.min(...points.map((point) => point.value));
    const max = Math.max(...points.map((point) => point.value));
    const range = max - min || 1;
    const polyline = points
      .map((point) => {
        const x = (point.index / (values.length - 1)) * width;
        const y = height - ((point.value - min) / range) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-primary">
        <polyline
          points={polyline}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  const classifyHkDayMix = (checkouts: number, stayovers: number) => {
    const total = checkouts + stayovers;
    if (total <= 0) return "No load";
    if (checkouts / total >= 0.55) return "Heavy C/O";
    if (stayovers / total >= 0.55) return "Heavy S/O";
    return "Balanced";
  };

  const TrendTimeline = ({
    days,
  }: {
    days: Array<{ dateKey: string; mpor: number | null; dayLabel: string; shortDate: string; mixLabel: string }>;
  }) => {
    const values = days.map((day) => day.mpor);
    return (
      <div className="space-y-2">
        <Sparkline values={values} />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => (
            <div
              key={day.dateKey}
              className="min-w-[82px] rounded-md border bg-muted/20 px-2 py-2 text-center"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {day.dayLabel}
              </div>
              <div className="text-[10px] text-muted-foreground">{day.shortDate}</div>
              <div className="mt-1 text-[10px] font-medium text-primary">{day.mixLabel}</div>
              <div className="mt-1 text-xs font-semibold">{formatHkValue(day.mpor)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const computeEntryStats = (entry: HkAttendantEntry) => {
    const co = toNumber(entry.checkoutsCleaned);
    const so = toNumber(entry.stayoversCleaned);
    const dndRooms = toNumber(entry.recleans);
    const dndEffective = Math.min(dndRooms, so);
    const totalRooms = Math.max(co + so - dndEffective, 0);
    const totalRoomsForMpor = Math.max(co + so, 0);
    const paidHours = toHours(entry.paidHours);
    const productiveHours = paidHours;
    const standardHours = (co * hkSettings.checkoutMinutes + (so - dndEffective) * hkSettings.stayoverMinutes) / 60;
    const variance = paidHours - standardHours;
    const mporMinutes = paidHours > 0 && totalRoomsForMpor > 0 ? (paidHours * 60) / totalRoomsForMpor : 0;
    return {
      totalRooms,
      totalRoomsForMpor,
      paidHours,
      productiveHours,
      standardHours,
      variance,
      mporMinutes,
    };
  };

  const computeDayTotals = (dateKey: string) => {
    const entries = hkAttendantsByDay[dateKey] || [];
    const totals = entries.reduce(
      (acc, entry) => {
        const stats = computeEntryStats(entry);
        const co = toNumber(entry.checkoutsCleaned);
        const so = toNumber(entry.stayoversCleaned);
        const dndRooms = toNumber(entry.recleans);
        acc.totalCO += toNumber(entry.checkoutsCleaned);
        acc.totalSO += toNumber(entry.stayoversCleaned);
        acc.totalRoomsRaw += co + so;
        acc.totalDndRooms += dndRooms;
        acc.totalPaidHours += stats.paidHours;
        acc.totalProductiveHours += stats.productiveHours;
        acc.totalStandardHours += stats.standardHours;
        acc.totalVariance += stats.variance;
        acc.totalLateCheckouts += toNumber(entry.lateCheckouts);
        acc.totalRecleans += toNumber(entry.recleans);
        acc.totalRoomsForMpor += stats.totalRoomsForMpor;
        return acc;
      },
      {
        totalCO: 0,
        totalSO: 0,
        totalRoomsRaw: 0,
        totalDndRooms: 0,
        totalPaidHours: 0,
        totalProductiveHours: 0,
        totalStandardHours: 0,
        totalVariance: 0,
        totalLateCheckouts: 0,
        totalRecleans: 0,
        totalRoomsForMpor: 0,
      }
    );

    return {
      ...totals,
      totalRooms: Math.max(totals.totalRoomsRaw - totals.totalDndRooms, 0),
    };
  };

  const hkMonthDays = useMemo(() => {
    const parsed = parse(hkMonth, "yyyy-MM", new Date());
    return eachDayOfInterval({ start: startOfMonth(parsed), end: endOfMonth(parsed) })
      .filter((day) => isSameMonth(day, parsed))
      .map((day) => format(day, "yyyy-MM-dd"));
  }, [hkMonth]);

  const hkDayTrendContext = useMemo(() => {
    return hkMonthDays.reduce<Record<string, { dayLabel: string; shortDate: string; mixLabel: string }>>((acc, dateKey) => {
      const totals = computeDayTotals(dateKey);
      acc[dateKey] = {
        dayLabel: format(parseISO(dateKey), "EEE"),
        shortDate: format(parseISO(dateKey), "M/d"),
        mixLabel: classifyHkDayMix(totals.totalCO, totals.totalSO),
      };
      return acc;
    }, {});
  }, [hkMonthDays, hkAttendantsByDay]);

  const hkRoster = useMemo(() => {
    const names = new Set<string>();
    Object.values(hkAttendantsByDay).forEach((entries) => {
      entries.forEach((entry) => {
        if (entry.attendantName) names.add(entry.attendantName);
      });
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [hkAttendantsByDay]);

  const hkDailySummary = useMemo(() => {
    return hkMonthDays.reduce(
      (acc, dateKey) => {
        const totals = computeDayTotals(dateKey);
        const meta = hkDayMeta[dateKey] || {
          roomsSold: "",
          totalDailyHours: "",
          roomRevenueDaily: "",
          notes: "",
        };
        const roomsSoldNumber = toNumber(meta.roomsSold);
        const totalDailyHoursNumber = toNumber(meta.totalDailyHours);
        const mpor = totals.totalPaidHours > 0 && totals.totalRoomsForMpor > 0
          ? (totals.totalPaidHours * 60) / totals.totalRoomsForMpor
          : null;
        const mporVariance = mpor === null ? null : mpor - hkSettings.mporStandard;
        const hpor = roomsSoldNumber > 0 && totalDailyHoursNumber > 0 ? totalDailyHoursNumber / roomsSoldNumber : null;

        acc.sumRoomsSold += roomsSoldNumber;
        acc.sumTotalDailyHours += totalDailyHoursNumber;
        acc.sumTotalCO += totals.totalCO;
        acc.sumTotalSO += totals.totalSO;
        acc.sumTotalRooms += totals.totalRooms;
        acc.sumStandardHours += totals.totalStandardHours;
        if (mporVariance !== null) {
          acc.sumVariance += mporVariance;
          acc.varianceCount += 1;
        }

        if (meta.roomRevenueDaily) {
          acc.sumRoomRevenueDaily += toNumber(meta.roomRevenueDaily);
        }

        if (mpor !== null) {
          acc.mporPaidSum += mpor;
          acc.mporPaidCount += 1;
        }
        if (roomsSoldNumber > 0 && totalDailyHoursNumber > 0) {
          acc.hporRoomsSold += roomsSoldNumber;
          acc.hporDailyHours += totalDailyHoursNumber;
        }

        return acc;
      },
      {
        sumRoomsSold: 0,
        sumTotalDailyHours: 0,
        sumTotalCO: 0,
        sumTotalSO: 0,
        sumTotalRooms: 0,
        sumStandardHours: 0,
        sumVariance: 0,
        varianceCount: 0,
        sumRoomRevenueDaily: 0,
        mporPaidSum: 0,
        mporPaidCount: 0,
        hporRoomsSold: 0,
        hporDailyHours: 0,
      }
    );
  }, [hkMonthDays, hkDayMeta, hkAttendantsByDay, hkSettings.mporStandard]);

  const hkSelectedMonthBudget = useMemo(() => {
    const raw = hkMonthlyBudgets[hkMonth];
    if (!raw || !String(raw).trim()) return null;
    return toNumber(raw);
  }, [hkMonthlyBudgets, hkMonth]);

  const hkSelectedMonthOccupancy = useMemo(() => {
    if (hkSettings.roomInventory <= 0 || hkMonthDays.length === 0) return null;
    const availableRoomNights = hkSettings.roomInventory * hkMonthDays.length;
    if (availableRoomNights <= 0) return null;
    return (hkDailySummary.sumRoomsSold / availableRoomNights) * 100;
  }, [hkDailySummary.sumRoomsSold, hkMonthDays.length, hkSettings.roomInventory]);

  const hkSelectedMonthVarianceToBudget = useMemo(() => {
    if (hkSelectedMonthBudget === null) return null;
    return hkDailySummary.sumRoomRevenueDaily - hkSelectedMonthBudget;
  }, [hkDailySummary.sumRoomRevenueDaily, hkSelectedMonthBudget]);

  const hkLatestDayWithEntries = useMemo(() => {
    return (
      [...hkMonthDays]
        .reverse()
        .find((dateKey) => (hkAttendantsByDay[dateKey] || []).some((entry) => entry.attendantName)) || ""
    );
  }, [hkMonthDays, hkAttendantsByDay]);

  const hkWeekOptions = useMemo(() => {
    const map = new Map<string, { key: string; weekStart: string; weekEnd: string; dateKeys: string[] }>();
    hkMonthDays.forEach((dateKey) => {
      const date = parseISO(dateKey);
      const weekStart = format(startOfISOWeek(date), "yyyy-MM-dd");
      const weekEnd = format(endOfISOWeek(date), "yyyy-MM-dd");
      const key = `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, "0")}`;
      if (!map.has(key)) {
        map.set(key, { key, weekStart, weekEnd, dateKeys: [] });
      }
      map.get(key)?.dateKeys.push(dateKey);
    });

    return Array.from(map.values())
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
      .map((week) => ({
        ...week,
        label: `${week.key} (${format(parseISO(week.weekStart), "MMM d")} - ${format(parseISO(week.weekEnd), "MMM d")})`,
      }));
  }, [hkMonthDays]);

  const [hkSelectedWeekKey, setHkSelectedWeekKey] = useState("");

  useEffect(() => {
    if (!hkWeekOptions.length) {
      setHkSelectedWeekKey("");
      return;
    }
    const latestDate = hkLatestDayWithEntries || hkMonthRange.endDate;
    const date = parseISO(latestDate);
    const preferredKey = `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, "0")}`;
    const resolvedKey = hkWeekOptions.some((week) => week.key === preferredKey)
      ? preferredKey
      : hkWeekOptions[hkWeekOptions.length - 1].key;
    setHkSelectedWeekKey((prev) => (prev && hkWeekOptions.some((week) => week.key === prev) ? prev : resolvedKey));
  }, [hkWeekOptions, hkLatestDayWithEntries, hkMonthRange.endDate]);

  const hkMtdEndDate = useMemo(() => {
    const monthStart = parse(hkMonth, "yyyy-MM", new Date());
    const today = new Date();
    if (isSameMonth(monthStart, today)) {
      return format(today, "yyyy-MM-dd");
    }
    return hkMonthRange.endDate;
  }, [hkMonth, hkMonthRange.endDate]);

  const hkAttendantStats = useMemo(() => {
    const stats: Record<string, { byDate: Record<string, { rooms: number; hours: number; mpor: number | null }>; trend: Array<number | null> }> = {};
    hkMonthDays.forEach((dateKey, dayIndex) => {
      const entries = hkAttendantsByDay[dateKey] || [];
      entries.forEach((entry) => {
        const attendantName = entry.attendantName?.trim();
        if (!attendantName) return;
        const rooms = toNumber(entry.checkoutsCleaned) + toNumber(entry.stayoversCleaned);
        const hours = toHours(entry.paidHours);
        if (!stats[attendantName]) {
          stats[attendantName] = { byDate: {}, trend: Array(hkMonthDays.length).fill(null) };
        }
        const current = stats[attendantName].byDate[dateKey] || { rooms: 0, hours: 0, mpor: null };
        const roomsTotal = current.rooms + rooms;
        const hoursTotal = current.hours + hours;
        const mpor = toMporMinutes(hoursTotal, roomsTotal);
        stats[attendantName].byDate[dateKey] = { rooms: roomsTotal, hours: hoursTotal, mpor };
        stats[attendantName].trend[dayIndex] = mpor;
      });
    });
    return stats;
  }, [hkMonthDays, hkAttendantsByDay]);

  const buildAttendantRanking = (dateKeys: string[]) => {
    return Object.entries(hkAttendantStats)
      .map(([attendantName, data]) => {
        let roomsTotal = 0;
        let hoursTotal = 0;
        dateKeys.forEach((dateKey) => {
          const day = data.byDate[dateKey];
          if (!day) return;
          roomsTotal += day.rooms;
          hoursTotal += day.hours;
        });
        const mpor = toMporMinutes(hoursTotal, roomsTotal);
        const trendDays = dateKeys.map((dateKey) => {
          const context = hkDayTrendContext[dateKey] || {
            dayLabel: format(parseISO(dateKey), "EEE"),
            shortDate: format(parseISO(dateKey), "M/d"),
            mixLabel: "No load",
          };
          return {
            dateKey,
            mpor: data.byDate[dateKey]?.mpor ?? null,
            ...context,
          };
        });
        return {
          attendantName,
          roomsTotal,
          hoursTotal,
          mpor,
          trend: data.trend,
          trendDays,
        };
      })
      .filter((entry) => entry.mpor !== null)
      .sort((a, b) => (a.mpor ?? 0) - (b.mpor ?? 0));
  };

  const hkSelectedWeek = useMemo(() => {
    return hkWeekOptions.find((week) => week.key === hkSelectedWeekKey) || null;
  }, [hkWeekOptions, hkSelectedWeekKey]);

  const hkRankingWeekly = useMemo(() => {
    if (!hkSelectedWeek) return [];
    return buildAttendantRanking(hkSelectedWeek.dateKeys);
  }, [hkSelectedWeek, hkAttendantStats, hkDayTrendContext]);

  const hkRankingMtd = useMemo(() => {
    const mtdDates = hkMonthDays.filter((dateKey) => dateKey <= hkMtdEndDate);
    return buildAttendantRanking(mtdDates);
  }, [hkMonthDays, hkMtdEndDate, hkAttendantStats, hkDayTrendContext]);

  const toggleHkDay = (dateKey: string) => {
    setHkExpandedDays((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  const updateDayMeta = (dateKey: string, patch: Partial<HkDayMeta>) => {
    const nextPatch = { ...patch };
    if (Object.prototype.hasOwnProperty.call(patch, "roomsSold")) {
      nextPatch.roomsSoldImported = false;
    }
    setHkDayMeta((prev) => {
      const base = prev[dateKey] || {
        roomsSold: "",
        totalDailyHours: "",
        roomRevenueDaily: "",
        notes: "",
        roomsSoldImported: undefined,
      };
      return {
        ...prev,
        [dateKey]: {
          ...base,
          ...nextPatch,
        },
      };
    });
  };

  const saveDayMeta = async (dateKey: string, patch?: Partial<HkDayMeta>) => {
    if (!hkProperty) return;
    const baseMeta = hkDayMeta[dateKey] || {
      roomsSold: "",
      totalDailyHours: "",
      roomRevenueDaily: "",
      notes: "",
    };
    const meta = { ...baseMeta, ...patch };
    const payload = {
      metricDate: dateKey,
      property: hkProperty,
      roomsSold: meta.roomsSold === "" ? null : toNumber(meta.roomsSold),
      totalDailyHours: meta.totalDailyHours === "" ? null : meta.totalDailyHours,
      roomRevenueDaily: meta.roomRevenueDaily === "" ? null : meta.roomRevenueDaily,
      notes: meta.notes || "",
    };

    try {
      await apiRequest("PATCH", "/api/admin/hk-metrics/day", payload);
      queryClient.invalidateQueries({ queryKey: [hkSummaryUrl] });
    } catch (error: any) {
      toast({ title: "Day update failed", description: error.message, variant: "destructive" });
    }
  };


  const handleRoomsSoldUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) return;
    if (!hkProperty) {
      toast({ title: "Property required", description: "Select a property before importing rooms sold." });
      event.target.value = "";
      return;
    }

    setHkImporting(true);
    try {
      const formData = new FormData();
      formData.append("property", hkProperty);
      files.forEach((file) => formData.append("files", file));
      const response = await fetch(apiUrl("/api/admin/hk-metrics/import-rooms-sold"), {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Upload failed");
      }
      setHkImportSummary(data);
      setHkImportDialogOpen(true);
      if (data.overwrittenCount) {
        toast({ title: "Rooms sold overwritten", description: `Overwrote ${data.overwrittenCount} date(s).` });
      }
      queryClient.invalidateQueries({ queryKey: [hkSummaryUrl] });
    } catch (error: any) {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    } finally {
      setHkImporting(false);
      event.target.value = "";
    }
  };

  const updateAttendant = (dateKey: string, index: number, patch: Partial<HkAttendantEntry>) => {
    setHkAttendantsByDay((prev) => {
      const dayEntries = [...(prev[dateKey] || [])];
      const nextEntry = { ...dayEntries[index], ...patch };
      if (patch.attendantName) {
        const duplicate = dayEntries.some(
          (entry, entryIndex) => entryIndex !== index && entry.attendantName === patch.attendantName
        );
        if (duplicate) {
          toast({ title: "Duplicate attendant", description: "This attendant already exists for the day." });
          return prev;
        }
      }
      dayEntries[index] = nextEntry;
      return { ...prev, [dateKey]: dayEntries };
    });
  };

  const addAttendant = (dateKey: string) => {
    setHkAttendantsByDay((prev) => {
      const dayEntries = prev[dateKey] ? [...prev[dateKey]] : [];
      dayEntries.push({
        attendantName: "",
        checkoutsCleaned: "",
        stayoversCleaned: "",
        paidHours: "",
        lunchMinutes: "",
        lateCheckouts: "",
        deepCleans: "",
        recleans: "",
        notes: "",
      });
      return { ...prev, [dateKey]: dayEntries };
    });
    setHkExpandedDays((prev) => ({ ...prev, [dateKey]: true }));
  };

  const removeAttendant = async (dateKey: string, index: number) => {
    const entry = hkAttendantsByDay[dateKey]?.[index];
    if (!entry) return;
    if (entry.attendantName && hkProperty) {
      try {
        await apiRequest("DELETE", "/api/admin/hk-metrics/attendant", {
          metricDate: dateKey,
          property: hkProperty,
          attendantName: entry.attendantName,
        });
      } catch (error: any) {
        toast({ title: "Delete failed", description: error.message, variant: "destructive" });
        return;
      }
    }
    setHkAttendantsByDay((prev) => {
      const dayEntries = [...(prev[dateKey] || [])];
      dayEntries.splice(index, 1);
      return { ...prev, [dateKey]: dayEntries };
    });
  };

  const saveDay = async (dateKey: string) => {
    if (!hkProperty) {
      toast({ title: "Property required", description: "Select a property before saving." });
      return;
    }
    if (hkSavingDays[dateKey]) return;
    setHkSavingDays((prev) => ({ ...prev, [dateKey]: true }));
    const entries = hkAttendantsByDay[dateKey] || [];
    const totals = computeDayTotals(dateKey);
    const meta = hkDayMeta[dateKey] || {
      roomsSold: "",
      totalDailyHours: "",
      roomRevenueDaily: "",
      notes: "",
    };

    try {
      const dailyPayload: InsertHkDailyMetric = {
        metricDate: dateKey,
        property: hkProperty,
        occupiedRooms: meta.roomsSold === "" ? 0 : toNumber(meta.roomsSold),
        roomsSold: meta.roomsSold === "" ? null : toNumber(meta.roomsSold),
        totalDailyHours: meta.totalDailyHours === "" ? null : meta.totalDailyHours,
        roomRevenueDaily: meta.roomRevenueDaily === "" ? null : meta.roomRevenueDaily,
        checkouts: totals.totalCO,
        stayovers: totals.totalSO,
        roomsCleaned: totals.totalRooms,
        paidHours: totals.totalPaidHours.toFixed(2),
        lunchMinutes: 0,
        productiveHours: totals.totalProductiveHours.toFixed(2),
        attendantsWorking: entries.length,
        lateCheckouts: totals.totalLateCheckouts,
        inspections: 0,
        recleans: totals.totalRecleans,
        dndRooms: 0,
        oooRooms: 0,
        notes: meta.notes || undefined,
      };

      await apiRequest("POST", "/api/admin/hk-metrics/daily", dailyPayload);

      await Promise.all(entries.map(async (entry) => {
        if (!entry.attendantName) return;
        const stats = computeEntryStats(entry);
        const attendantPayload: InsertHkAttendantMetric = {
          metricDate: dateKey,
          property: hkProperty,
          attendantName: entry.attendantName,
          checkoutsCleaned: toNumber(entry.checkoutsCleaned),
          stayoversCleaned: toNumber(entry.stayoversCleaned),
          roomsCleaned: stats.totalRooms,
          paidHours: String(entry.paidHours || "0"),
          lunchMinutes: 0,
          productiveHours: stats.productiveHours.toFixed(2),
          deepCleans: toNumber(entry.deepCleans),
          recleans: toNumber(entry.recleans),
          inspections: 0,
          lateCheckouts: toNumber(entry.lateCheckouts),
          notes: entry.notes || undefined,
        };
        await apiRequest("POST", "/api/admin/hk-metrics/attendant", attendantPayload);
      }));

      queryClient.invalidateQueries({ queryKey: [hkSummaryUrl] });
      toast({ title: "Day saved", description: `Saved ${dateKey}` });
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setHkSavingDays((prev) => ({ ...prev, [dateKey]: false }));
    }
  };

  // Filter withdrawals based on search and status
  const filteredWithdrawals = withdrawals.filter((withdrawal: any) => {
    // Status filter
    if (withdrawalStatusFilter !== "all" && withdrawal.status !== withdrawalStatusFilter) {
      return false;
    }

    // Search filter
    if (withdrawalSearch) {
      const searchLower = withdrawalSearch.toLowerCase();
      return (
        withdrawal.userId?.toLowerCase().includes(searchLower) ||
        withdrawal.paypalEmail?.toLowerCase().includes(searchLower) ||
        withdrawal.transactionId?.toLowerCase().includes(searchLower) ||
        withdrawal.payoutBatchId?.toLowerCase().includes(searchLower) ||
        withdrawal.amount?.toString().includes(searchLower)
      );
    }

    return true;
  });

  const hkWeeklyRollups = hkSummary?.weeklyRollups ?? [];
  const hkMonthlyRollups = hkSummary?.monthlyRollups ?? [];
  const hkPropertyParam = hkProperty ? `&property=${encodeURIComponent(hkProperty)}` : "";
  const hkBudgetParam = hkSelectedMonthBudget !== null ? `&budget=${encodeURIComponent(hkSelectedMonthBudget.toFixed(2))}` : "";
  const hkRoomInventoryParam = `&roomInventory=${encodeURIComponent(hkSettings.roomInventory)}`;
  const hkPdfUrl = apiUrl(
    `/api/admin/hk-metrics/pdf?start=${hkMonthRange.startDate}&end=${hkMonthRange.endDate}${hkPropertyParam}&mporStandard=${hkSettings.mporStandard}${hkBudgetParam}${hkRoomInventoryParam}`
  );

  const financeOverviewCards = (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Today</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics?.revenueToday || "0.00"}</div>
            <p className="text-xs text-muted-foreground">
              {analytics?.transactionsToday || 0} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics?.revenueWeek || "0.00"}</div>
            <p className="text-xs text-muted-foreground">
              {analytics?.transactionsWeek || 0} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics?.revenueMonth || "0.00"}</div>
            <p className="text-xs text-muted-foreground">
              {analytics?.transactionsMonth || 0} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue This Year</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics?.revenueYear || "0.00"}</div>
            <p className="text-xs text-muted-foreground">
              {analytics?.transactionsYear || 0} transactions
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses Today</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">${analytics?.expensesToday || "0.00"}</div>
            <p className="text-xs text-muted-foreground">
              Server & database costs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses This Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">${analytics?.expensesWeek || "0.00"}</div>
            <p className="text-xs text-muted-foreground">
              Platform operating costs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">${analytics?.expensesMonth || "0.00"}</div>
            <p className="text-xs text-muted-foreground">
              Monthly operational costs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses This Year</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">${analytics?.expensesYear || "0.00"}</div>
            <p className="text-xs text-muted-foreground">
              Annual operational costs
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Today</CardTitle>
            <DollarSign className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-2">${analytics?.profitToday || "0.00"}</div>
            <p className="text-xs text-muted-foreground">
              Margin: {analytics?.profitMarginToday || "0.00"}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit This Week</CardTitle>
            <DollarSign className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-2">${analytics?.profitWeek || "0.00"}</div>
            <p className="text-xs text-muted-foreground">
              Margin: {analytics?.profitMarginWeek || "0.00"}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit This Month</CardTitle>
            <DollarSign className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-2">${analytics?.profitMonth || "0.00"}</div>
            <p className="text-xs text-muted-foreground">
              Margin: {analytics?.profitMarginMonth || "0.00"}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit This Year</CardTitle>
            <DollarSign className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-2">${analytics?.profitYear || "0.00"}</div>
            <p className="text-xs text-muted-foreground">
              Margin: {analytics?.profitMarginYear || "0.00"}%
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );

  const expenseTrackingCard = (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Expense Tracking</CardTitle>
          <CardDescription>Track server, database, and operational costs</CardDescription>
        </div>
        <Button
          onClick={() => {
            expenseForm.reset();
            setEditingExpense(null);
            setExpenseDialogOpen(true);
          }}
          data-testid="button-add-expense"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Expense
        </Button>
      </CardHeader>
      <CardContent>
        {expensesLoading && (
          <div className="text-center py-8 text-muted-foreground">
            Loading expenses...
          </div>
        )}

        {!expensesLoading && expenses.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No expenses tracked yet. Add your first expense to start tracking costs.
          </div>
        )}

        {!expensesLoading && expenses.length > 0 && (
          <div className="border rounded-md">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 text-sm font-medium">Date</th>
                  <th className="text-left p-3 text-sm font-medium">Category</th>
                  <th className="text-left p-3 text-sm font-medium">Description</th>
                  <th className="text-left p-3 text-sm font-medium">Invoice</th>
                  <th className="text-right p-3 text-sm font-medium">Amount</th>
                  <th className="text-right p-3 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-b last:border-0" data-testid={`expense-row-${expense.id}`}>
                    <td className="p-3 text-sm" data-testid={`text-date-${expense.id}`}>
                      {expense.expenseDate ? new Date(expense.expenseDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="capitalize" data-testid={`badge-category-${expense.id}`}>
                        {expense.category}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground" data-testid={`text-description-${expense.id}`}>
                      {expense.description || "—"}
                    </td>
                    <td className="p-3 text-sm">
                      {expense.invoiceUrl ? (
                        <a
                          href={resolveInvoiceUrl(expense.invoiceUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                          data-testid={`link-invoice-${expense.id}`}
                        >
                          <FileText className="h-4 w-4" />
                          View
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 text-sm text-right font-medium text-destructive" data-testid={`text-amount-${expense.id}`}>
                      ${expense.amount}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEditExpense(expense)}
                          data-testid={`button-edit-expense-${expense.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this expense?")) {
                              deleteExpenseMutation.mutate(expense.id);
                            }
                          }}
                          data-testid={`button-delete-expense-${expense.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-admin-title">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">
          Manage users, aircraft listings, and marketplace content
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-12 h-auto">
          {canAccess("analytics") && (
            <TabsTrigger value="analytics" data-testid="tab-analytics" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span>Analytics</span>
            </TabsTrigger>
          )}
          {canAccess("hk-metrics") && (
            <TabsTrigger value="hk-metrics" data-testid="tab-hk-metrics" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span>HK Metrics</span>
            </TabsTrigger>
          )}
          {canAccess("crm") && (
            <TabsTrigger value="crm" data-testid="tab-crm" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
              <Briefcase className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span>CRM</span>
            </TabsTrigger>
          )}
          {canAccess("users") && (
            <TabsTrigger value="users" data-testid="tab-users" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
              <Users className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span>Users</span>
            </TabsTrigger>
          )}
          {canAccess("verifications") && (
            <TabsTrigger value="verifications" data-testid="tab-verifications" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
              <Shield className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="flex items-center gap-1">
                Verify
                {verificationSubmissions.length > 0 && (
                  <Badge variant="destructive" className="text-xs px-1">
                    {verificationSubmissions.length}
                  </Badge>
                )}
              </span>
            </TabsTrigger>
          )}
          {canAccess("aircraft") && (
            <TabsTrigger value="aircraft" data-testid="tab-aircraft" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
              <Plane className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span>Aircraft</span>
            </TabsTrigger>
          )}
          {canAccess("marketplace") && (
            <TabsTrigger value="marketplace" data-testid="tab-marketplace" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
              <List className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="flex items-center gap-1">
                Market
                {flaggedListings.length > 0 && (
                  <Badge variant="destructive" className="text-xs px-1">
                    {flaggedListings.length}
                  </Badge>
                )}
              </span>
            </TabsTrigger>
          )}
          {canAccess("stale") && (
            <TabsTrigger value="stale" data-testid="tab-stale" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span>Stale</span>
            </TabsTrigger>
          )}
          {canAccess("promo") && (
            <TabsTrigger value="promo" data-testid="tab-promo" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
              <Gift className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span>Promos</span>
            </TabsTrigger>
          )}
          {canAccess("promo-codes") && (
            <TabsTrigger value="promo-codes" data-testid="tab-promo-codes" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
              <Tag className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span>Codes</span>
            </TabsTrigger>
          )}
          {canAccess("withdrawals") && (
            <TabsTrigger value="withdrawals" data-testid="tab-withdrawals" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span>Payouts</span>
            </TabsTrigger>
          )}
          {canAccess("notifications") && (
            <TabsTrigger value="notifications" data-testid="tab-notifications" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
              <Bell className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="flex items-center gap-1">
                Alerts
                {unreadNotifications.length > 0 && (
                  <Badge variant="destructive" className="text-xs px-1">
                    {unreadNotifications.length}
                  </Badge>
                )}
              </span>
            </TabsTrigger>
          )}
          {canAccess("banners") && (
            <TabsTrigger value="banners" data-testid="tab-banners" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
              <Image className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span>Banners</span>
            </TabsTrigger>
          )}
          {canSeeFinance && (
            <TabsTrigger value="finance" data-testid="tab-finance" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
              <Wallet className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span>Finance</span>
            </TabsTrigger>
          )}
          {canSeeFinance && (
            <TabsTrigger value="personal-finance" data-testid="tab-personal-finance" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
              <Wallet className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span>Personal Finance</span>
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="admins" data-testid="tab-admins" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
              <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span>Admins</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Feature Engagement */}
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Feature Engagement</CardTitle>
                <CardDescription>Usage across tools, training, and marketplace</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={featureUsageRange} onValueChange={setFeatureUsageRange}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFeatureEngagementOpen((current) => !current)}
                >
                  {featureEngagementOpen ? (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Collapse
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-4 w-4 mr-1" />
                      Expand
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!featureEngagementOpen && (
                <div className="text-sm text-muted-foreground">
                  {featureUsageLoading
                    ? "Loading usage..."
                    : `${featureUsage?.totalEvents || 0} events across ${featureUsage?.uniqueVisitors || 0} unique visitors in the last ${featureUsageRange} days.`}
                </div>
              )}
              {featureEngagementOpen && (
                <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <div className="text-xs text-muted-foreground">Total events</div>
                  <div className="text-2xl font-bold">{featureUsage?.totalEvents || 0}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-xs text-muted-foreground">Unique visitors</div>
                  <div className="text-2xl font-bold">{featureUsage?.uniqueVisitors || 0}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-xs text-muted-foreground">Returning visitors</div>
                  <div className="text-2xl font-bold">{featureUsage?.returningVisitors || 0}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-xs text-muted-foreground">Guest visitors</div>
                  <div className="text-2xl font-bold">{featureUsage?.guestVisitors || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {featureUsage?.guestEvents || 0} events
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold">Top pages & tools</div>
                {featureUsageLoading ? (
                  <div className="text-sm text-muted-foreground">Loading usage...</div>
                ) : featureUsagePages.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No usage data yet.</div>
                ) : (
                  <div className="space-y-2">
                    {featureUsagePages.map((item) => (
                      <div key={item.key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-medium">{formatUsageLabel(item.key)}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{item.totalEvents} events</Badge>
                          <Badge variant="secondary">{item.uniqueVisitors} unique</Badge>
                          <Badge variant="secondary">{item.returningVisitors} returning</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Marketplace Listings Stats */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Marketplace Overview</CardTitle>
                <CardDescription>Current listing statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <List className="h-5 w-5 text-chart-2" />
                    <span className="text-sm font-medium">Active Listings</span>
                  </div>
                  <Badge className="bg-chart-2" data-testid="badge-active-marketplace">{analytics?.totalActiveMarketplaceListings || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <span className="text-sm font-medium">Expired Listings</span>
                  </div>
                  <Badge variant="destructive" data-testid="badge-expired-marketplace">{analytics?.totalExpiredMarketplaceListings || 0}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Listings by Category</CardTitle>
                <CardDescription>Active listings per category</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Aviation Jobs</span>
                  <Badge variant="outline" data-testid="badge-category-job">{analytics?.marketplaceByCategory?.job || 0}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Aircraft For Sale</span>
                  <Badge variant="outline" data-testid="badge-category-aircraft-sale">{analytics?.marketplaceByCategory?.['aircraft-sale'] || 0}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">CFIs</span>
                  <Badge variant="outline" data-testid="badge-category-cfi">{analytics?.marketplaceByCategory?.cfi || 0}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Flight Schools</span>
                  <Badge variant="outline" data-testid="badge-category-flight-school">{analytics?.marketplaceByCategory?.['flight-school'] || 0}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Mechanics</span>
                  <Badge variant="outline" data-testid="badge-category-mechanic">{analytics?.marketplaceByCategory?.mechanic || 0}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Charter Services</span>
                  <Badge variant="outline" data-testid="badge-category-charter">{analytics?.marketplaceByCategory?.charter || 0}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Commission Details</CardTitle>
                <CardDescription>Ready Set Fly revenue model</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-2">Rental Commission:</p>
                  <p>• Renter: 7.5%</p>
                  <p>• Owner: 7.5%</p>
                  <p className="font-medium text-foreground mt-3 mb-2">Marketplace Fees:</p>
                  <p>• $25-$250/month per listing</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rental Metrics */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Rental Pipeline Overview</CardTitle>
                <CardDescription>Rentals by status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pending</span>
                  <Badge variant="outline" data-testid="badge-pending-rentals">{analytics?.pendingRentals || 0}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Approved</span>
                  <Badge variant="outline" data-testid="badge-approved-rentals">{analytics?.approvedRentals || 0}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Active</span>
                  <Badge variant="outline" data-testid="badge-active-rentals">{analytics?.activeRentals || 0}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Completed</span>
                  <Badge variant="outline" data-testid="badge-completed-rentals">{analytics?.completedRentals || 0}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cancelled</span>
                  <Badge variant="outline" data-testid="badge-cancelled-rentals">{analytics?.cancelledRentals || 0}</Badge>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Plane className="h-5 w-5 text-chart-1" />
                    <span className="text-sm font-medium">Grand Total</span>
                  </div>
                  <Badge className="bg-chart-1" data-testid="badge-total-rentals">{analytics?.totalRentals || 0}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rental Activity - Today</CardTitle>
                <CardDescription>New and active rentals today</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-chart-2" />
                    <span className="text-sm font-medium">New Rentals</span>
                  </div>
                  <Badge className="bg-chart-2" data-testid="badge-new-rentals-today">{analytics?.newRentalsToday || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-chart-1" />
                    <span className="text-sm font-medium">Active Rentals</span>
                  </div>
                  <Badge className="bg-chart-1" data-testid="badge-active-rentals-today">{analytics?.activeRentalsToday || 0}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rental Activity - This Week</CardTitle>
                <CardDescription>New and active rentals this week</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-chart-2" />
                    <span className="text-sm font-medium">New Rentals</span>
                  </div>
                  <Badge className="bg-chart-2" data-testid="badge-new-rentals-week">{analytics?.newRentalsWeek || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-chart-1" />
                    <span className="text-sm font-medium">Active Rentals</span>
                  </div>
                  <Badge className="bg-chart-1" data-testid="badge-active-rentals-week">{analytics?.activeRentalsWeek || 0}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* User Metrics Section */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">User Growth & Engagement</h3>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-total-users">{userMetrics?.totalUsers || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Registered accounts
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Verified Users</CardTitle>
                    <CheckCircle className="h-4 w-4 text-chart-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-chart-2" data-testid="text-verified-users">{userMetrics?.verifiedUsers || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {userMetrics?.verificationRate?.toFixed(1) || "0.0"}% verified
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Owners</CardTitle>
                    <Plane className="h-4 w-4 text-chart-1" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-chart-1" data-testid="text-active-owners">{userMetrics?.activeListingOwners || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      With active listings
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Renters</CardTitle>
                    <Activity className="h-4 w-4 text-chart-3" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-chart-3" data-testid="text-active-renters">{userMetrics?.activeRenters || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Completed rentals
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">New User Registrations</h3>
              <div className="grid gap-6 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Today</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-new-users-today">{userMetrics?.newUsersToday || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      New signups today
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">This Week</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-new-users-week">{userMetrics?.newUsersThisWeek || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Last 7 days
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">This Month</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-new-users-month">{userMetrics?.newUsersThisMonth || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Last 30 days
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Geographic Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Geographic Distribution</CardTitle>
                  <CardDescription>Users by location (top 10 states)</CardDescription>
                </CardHeader>
                <CardContent>
                  {userMetricsLoading && (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading geographic data...
                    </div>
                  )}
                  {!userMetricsLoading && (!userMetrics?.geographic?.byState || userMetrics.geographic.byState.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      No geographic data available yet
                    </div>
                  )}
                  {!userMetricsLoading && userMetrics?.geographic?.byState && userMetrics.geographic.byState.length > 0 && (
                    <div className="space-y-3">
                      {userMetrics.geographic.byState.map(({ state, count }, index) => (
                        <div key={state} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="w-8 text-center">{index + 1}</Badge>
                            <span className="text-sm font-medium">{state}</span>
                          </div>
                          <Badge data-testid={`badge-state-${state}`}>{count} users</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* User Retention */}
              <Card>
                <CardHeader>
                  <CardTitle>User Retention</CardTitle>
                  <CardDescription>Returning vs. one-time users</CardDescription>
                </CardHeader>
                <CardContent>
                  {userMetricsLoading && (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading retention data...
                    </div>
                  )}
                  {!userMetricsLoading && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="h-5 w-5 text-chart-2" />
                          <span className="text-sm font-medium">Returning Users</span>
                        </div>
                        <Badge className="bg-chart-2" data-testid="badge-returning-users">{userMetrics?.retention?.returningUsers || 0}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm font-medium">One-Time Users</span>
                        </div>
                        <Badge variant="outline" data-testid="badge-onetime-users">{userMetrics?.retention?.oneTimeUsers || 0}</Badge>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm font-medium">Retention Rate</span>
                        <Badge className="bg-chart-1" data-testid="badge-retention-rate">
                          {userMetrics?.retention?.retentionRate?.toFixed(1) || "0.0"}%
                        </Badge>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {analyticsLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
          )}
        </TabsContent>

        {/* HK Metrics Tab */}
        <TabsContent value="hk-metrics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Housekeeping Metrics (Table View)</CardTitle>
              <CardDescription>One row per day with expandable attendant production</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-6">
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Input type="month" value={hkMonth} onChange={(event) => setHkMonth(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Property</Label>
                  <Input
                    value={hkProperty}
                    onChange={(event) => setHkProperty(event.target.value)}
                    placeholder="Property name"
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Budget</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={hkMonthlyBudgets[hkMonth] ?? ""}
                      onChange={(event) =>
                        setHkMonthlyBudgets((prev) => ({
                          ...prev,
                          [hkMonth]: normalizeCurrencyInput(event.target.value),
                        }))
                      }
                      className="pl-7"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Total Rooms</Label>
                  <Input
                    type="number"
                    min="1"
                    value={hkSettings.roomInventory}
                    onChange={(event) =>
                      setHkSettings((prev) => ({ ...prev, roomInventory: Math.max(1, toNumber(event.target.value)) }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Clock In Time</Label>
                  <Input
                    type="time"
                    value={hkSettings.clockInTime}
                    onChange={(event) => setHkSettings((prev) => ({ ...prev, clockInTime: event.target.value }))}
                  />
                </div>
                <div className="flex items-end">
                  <Button asChild className="w-full">
                    <a href={hkPdfUrl} target="_blank" rel="noopener noreferrer">Export PDF</a>
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Actual Revenue</div>
                  <div className="mt-2 text-2xl font-semibold">{formatCurrencyValue(hkDailySummary.sumRoomRevenueDaily)}</div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Budget</div>
                  <div className="mt-2 text-2xl font-semibold">{formatCurrencyValue(hkSelectedMonthBudget)}</div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Variance to Budget</div>
                  <div className="mt-2 text-2xl font-semibold">{formatCurrencyValue(hkSelectedMonthVarianceToBudget)}</div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Occupancy</div>
                  <div className="mt-2 text-2xl font-semibold">{formatPercentValue(hkSelectedMonthOccupancy)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatHkValue(hkSettings.roomInventory)} rooms x {formatHkValue(hkMonthDays.length)} days
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Upload Rooms Sold TXT</Label>
                  <Input
                    type="file"
                    accept=".txt"
                    multiple
                    onChange={handleRoomsSoldUpload}
                    disabled={hkImporting}
                  />
                  <div className="text-xs text-muted-foreground">Upload one or more .txt exports to auto-fill Rooms Sold.</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Checkout Minutes</Label>
                  <Input
                    type="number"
                    min="0"
                    value={hkSettings.checkoutMinutes}
                    onChange={(event) => setHkSettings((prev) => ({ ...prev, checkoutMinutes: toNumber(event.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stayover Minutes</Label>
                  <Input
                    type="number"
                    min="0"
                    value={hkSettings.stayoverMinutes}
                    onChange={(event) => setHkSettings((prev) => ({ ...prev, stayoverMinutes: toNumber(event.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Lunch Minutes</Label>
                  <Input
                    type="number"
                    min="0"
                    value={hkSettings.lunchMinutes}
                    onChange={(event) => setHkSettings((prev) => ({ ...prev, lunchMinutes: toNumber(event.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Industry Standard MPOR (Min)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={hkSettings.mporStandard}
                    onChange={(event) => setHkSettings((prev) => ({ ...prev, mporStandard: toNumber(event.target.value) }))}
                  />
                </div>
              </div>

              {hkSummaryLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  Loading HK metrics...
                </div>
              )}

              {!hkSummaryLoading && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0 z-10">
                        <tr>
                          <th className="p-2 text-center w-32">Date</th>
                          <th className="p-2 text-center">Rooms Sold</th>
                          <th className="p-2 text-center">Room Rev</th>
                          <th className="p-2 text-center">Paid Hours (Net)</th>
                          <th className="p-2 text-center">HPOR</th>
                          <th className="p-2 text-center">Total C/O</th>
                          <th className="p-2 text-center">Total S/O</th>
                          <th className="p-2 text-center">Total Rooms</th>
                          <th className="p-2 text-center">Std Hours</th>
                          <th className="p-2 text-center">Variance</th>
                          <th className="p-2 text-center">MPOR (Min)</th>
                          <th className="p-2 text-center">Notes</th>
                          <th className="p-2 text-center">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hkMonthDays.map((dateKey) => {
                          const totals = computeDayTotals(dateKey);
                          const meta = hkDayMeta[dateKey] || {
                            roomsSold: "",
                            totalDailyHours: "",
                            roomRevenueDaily: "",
                            notes: "",
                          };
                          const roomsSoldNumber = toNumber(meta.roomsSold);
                          const totalDailyHoursNumber = toNumber(meta.totalDailyHours);
                          const mpor = totals.totalPaidHours > 0 && totals.totalRoomsForMpor > 0
                            ? (totals.totalPaidHours * 60) / totals.totalRoomsForMpor
                            : 0;
                          const mporVariance = mpor > 0 ? mpor - hkSettings.mporStandard : null;
                          const hpor = roomsSoldNumber > 0 && totalDailyHoursNumber > 0 ? totalDailyHoursNumber / roomsSoldNumber : null;
                          const roomsSoldMissing = roomsSoldNumber <= 0;
                          const isExpanded = hkExpandedDays[dateKey];

                          return (
                            <Fragment key={dateKey}>
                              <tr className="border-b">
                                <td className="p-2 font-medium">{format(parseISO(dateKey), "EEE MMM d")}</td>
                                <td className="p-2 text-right">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={meta.roomsSold}
                                    onChange={(event) => updateDayMeta(dateKey, { roomsSold: event.target.value })}
                                    onBlur={(event) => saveDayMeta(dateKey, { roomsSold: event.target.value })}
                                    className={`h-8 w-16 text-xs text-right ${roomsSoldMissing ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                  />
                                </td>
                                <td className="p-2 text-right">
                                  <div className="relative">
                                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      value={meta.roomRevenueDaily ? formatCurrencyValue(meta.roomRevenueDaily).replace("$", "") : ""}
                                      onChange={(event) =>
                                        updateDayMeta(dateKey, { roomRevenueDaily: normalizeCurrencyInput(event.target.value) })
                                      }
                                      onBlur={(event) =>
                                        saveDayMeta(dateKey, { roomRevenueDaily: normalizeCurrencyInput(event.target.value) })
                                      }
                                      className="h-8 w-24 pl-5 text-xs text-right"
                                    />
                                  </div>
                                </td>
                                <td className="p-2 text-right">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={meta.totalDailyHours}
                                    onChange={(event) => updateDayMeta(dateKey, { totalDailyHours: event.target.value })}
                                      onBlur={(event) => saveDayMeta(dateKey, { totalDailyHours: event.target.value })}
                                    className="h-8 w-24 text-xs text-right"
                                    placeholder="Net of lunch"
                                  />
                                </td>
                                <td className="p-2 text-right">{hpor ? formatHkValue(hpor) : "—"}</td>
                                <td className="p-2 text-right">{formatHkValue(totals.totalCO)}</td>
                                <td className="p-2 text-right">{formatHkValue(totals.totalSO)}</td>
                                <td className="p-2 text-right">{formatHkValue(totals.totalRooms)}</td>
                                <td className="p-2 text-right">{formatHkValue(totals.totalStandardHours)}</td>
                                <td className="p-2 text-right">{formatHkValue(mporVariance)}</td>
                                <td className="p-2 text-right">{formatHkValue(mpor)}</td>
                                <td className="p-2">
                                  <Input
                                    value={meta.notes}
                                    onChange={(event) => updateDayMeta(dateKey, { notes: event.target.value })}
                                    onBlur={(event) => saveDayMeta(dateKey, { notes: event.target.value })}
                                    className="h-8 text-xs"
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <Button size="icon" variant="ghost" onClick={() => toggleHkDay(dateKey)}>
                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  </Button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-muted/20">
                                  <td colSpan={13} className="p-4">
                                    <div className="space-y-4">
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="text-sm font-medium">Attendant Entries</div>
                                        <div className="flex gap-2">
                                          <Button size="sm" variant="outline" onClick={() => addAttendant(dateKey)}>Add Attendant</Button>
                                          <Button size="sm" onClick={() => saveDay(dateKey)} disabled={hkSavingDays[dateKey]}>
                                            {hkSavingDays[dateKey] ? "Saving..." : "Save Day"}
                                          </Button>
                                        </div>
                                      </div>

                                      {(hkAttendantsByDay[dateKey] || []).length === 0 ? (
                                        <div className="text-sm text-muted-foreground">No entries yet.</div>
                                      ) : (
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-xs">
                                            <thead className="bg-muted/60">
                                              <tr>
                                                <th className="p-2 text-left">Attendant</th>
                                                <th className="p-2 text-right">C/O</th>
                                                <th className="p-2 text-right">S/O</th>
                                                <th className="p-2 text-right">HK Paid</th>
                                                <th className="p-2 text-center">4pm C/O</th>
                                                <th className="p-2 text-right">Deep Clean</th>
                                                <th className="p-2 text-right">DND</th>
                                                <th className="p-2 text-left">Notes</th>
                                                <th className="p-2 text-right">Total Rooms</th>
                                                <th className="p-2 text-right">Std Hours</th>
                                                <th className="p-2 text-right">Variance</th>
                                                <th className="p-2 text-right">MPOR (Min)</th>
                                                <th className="p-2 text-center">Delete</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {(hkAttendantsByDay[dateKey] || []).map((entry, index) => {
                                                const stats = computeEntryStats(entry);
                                                return (
                                                  <tr key={`${dateKey}-${index}`} className="border-b">
                                                    <td className="p-2">
                                                      <Input
                                                        list="hk-attendant-roster"
                                                        value={entry.attendantName}
                                                        onChange={(event) => updateAttendant(dateKey, index, { attendantName: event.target.value })}
                                                        placeholder="Name"
                                                        className="h-8 text-xs"
                                                      />
                                                    </td>
                                                    <td className="p-2 text-right">
                                                      <Input
                                                        type="number"
                                                        min="0"
                                                        value={entry.checkoutsCleaned}
                                                        onChange={(event) => updateAttendant(dateKey, index, { checkoutsCleaned: event.target.value })}
                                                        className="h-8 text-xs text-right"
                                                      />
                                                    </td>
                                                    <td className="p-2 text-right">
                                                      <Input
                                                        type="number"
                                                        min="0"
                                                        value={entry.stayoversCleaned}
                                                        onChange={(event) => updateAttendant(dateKey, index, { stayoversCleaned: event.target.value })}
                                                        className="h-8 text-xs text-right"
                                                      />
                                                    </td>
                                                    <td className="p-2 text-right">
                                                      <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={entry.paidHours}
                                                        onChange={(event) => updateAttendant(dateKey, index, { paidHours: event.target.value })}
                                                        className="h-8 text-xs text-right"
                                                      />
                                                    </td>
                                                    <td className="p-2 text-center">
                                                      <Checkbox
                                                        checked={toNumber(entry.lateCheckouts) > 0}
                                                        onCheckedChange={(checked) => updateAttendant(dateKey, index, { lateCheckouts: checked ? "1" : "" })}
                                                      />
                                                    </td>
                                                    <td className="p-2 text-right">
                                                      <Input
                                                        type="number"
                                                        min="0"
                                                        value={entry.deepCleans}
                                                        onChange={(event) => updateAttendant(dateKey, index, { deepCleans: event.target.value })}
                                                        className="h-8 text-xs text-right"
                                                      />
                                                    </td>
                                                    <td className="p-2 text-right">
                                                      <Input
                                                        type="number"
                                                        min="0"
                                                        value={entry.recleans}
                                                        onChange={(event) => updateAttendant(dateKey, index, { recleans: event.target.value })}
                                                        className="h-8 text-xs text-right"
                                                      />
                                                    </td>
                                                    <td className="p-2">
                                                      <Input
                                                        value={entry.notes}
                                                        onChange={(event) => updateAttendant(dateKey, index, { notes: event.target.value })}
                                                        className="h-8 text-xs"
                                                      />
                                                    </td>
                                                    <td className="p-2 text-right">{formatHkValue(stats.totalRooms)}</td>
                                                    <td className="p-2 text-right">{formatHkValue(stats.standardHours)}</td>
                                                    <td className="p-2 text-right">{formatHkValue(stats.variance)}</td>
                                                    <td className="p-2 text-right">{formatHkValue(stats.mporMinutes)}</td>
                                                    <td className="p-2 text-center">
                                                      <Button size="icon" variant="ghost" onClick={() => removeAttendant(dateKey, index)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                      </Button>
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                        <tr className="bg-muted/40 border-t">
                          <td className="p-2 font-semibold text-center">Totals</td>
                          <td className="p-2 text-center">{formatHkValue(hkDailySummary.sumRoomsSold)}</td>
                          <td className="p-2 text-center">{formatCurrencyValue(hkDailySummary.sumRoomRevenueDaily)}</td>
                          <td className="p-2 text-center">{formatHkValue(hkDailySummary.sumTotalDailyHours)}</td>
                          <td className="p-2 text-center">
                            {formatHkValue(
                              hkDailySummary.hporRoomsSold
                                ? hkDailySummary.hporDailyHours / hkDailySummary.hporRoomsSold
                                : null
                            )}
                          </td>
                          <td className="p-2 text-center">{formatHkValue(hkDailySummary.sumTotalCO)}</td>
                          <td className="p-2 text-center">{formatHkValue(hkDailySummary.sumTotalSO)}</td>
                          <td className="p-2 text-center">{formatHkValue(hkDailySummary.sumTotalRooms)}</td>
                          <td className="p-2 text-center">{formatHkValue(hkDailySummary.sumStandardHours)}</td>
                          <td className="p-2 text-center">
                            {formatHkValue(
                              hkDailySummary.varianceCount ? hkDailySummary.sumVariance / hkDailySummary.varianceCount : null
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {formatHkValue(
                              hkDailySummary.mporPaidCount ? hkDailySummary.mporPaidSum / hkDailySummary.mporPaidCount : null
                            )}
                          </td>
                          <td className="p-2" />
                          <td className="p-2" />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <datalist id="hk-attendant-roster">
                {hkRoster.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Rollups</CardTitle>
              </CardHeader>
              <CardContent>
                {hkWeeklyRollups.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No weekly rollups yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="p-2 text-left">Week</th>
                          <th className="p-2 text-right">Sold</th>
                          <th className="p-2 text-right">Room Rev</th>
                          <th className="p-2 text-right">Paid Hrs</th>
                          <th className="p-2 text-right">HPOR</th>
                          <th className="p-2 text-right">Missing</th>
                          <th className="p-2 text-right">CO</th>
                          <th className="p-2 text-right">SO</th>
                          <th className="p-2 text-right">Rooms</th>
                          <th className="p-2 text-right">Std Hrs</th>
                          <th className="p-2 text-right">Variance</th>
                          <th className="p-2 text-right">MPOR (Min)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hkWeeklyRollups.map((entry: any) => {
                          const variance = typeof entry.mporPaid === "number" ? entry.mporPaid - hkSettings.mporStandard : null;
                          return (
                          <tr key={entry.key} className="border-b">
                            <td className="p-2">{entry.key}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.roomsSold)}</td>
                            <td className="p-2 text-right">{formatCurrencyValue(entry.roomRevenueDaily)}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.totalDailyHours)}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.hpor)}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.hporMissingDays)}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.checkouts)}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.stayovers)}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.roomsCleaned)}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.standardHours)}</td>
                            <td className="p-2 text-right">{formatHkValue(variance)}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.mporPaid)}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {hkWeeklyRollups.some((entry: any) => (entry.hporMissingDays || 0) > 0) && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Some weeks have missing Rooms Sold or Daily Hours and were excluded from HPOR totals.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Rollups</CardTitle>
              </CardHeader>
              <CardContent>
                {hkMonthlyRollups.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No monthly rollups yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="p-2 text-left">Month</th>
                          <th className="p-2 text-right">Sold</th>
                          <th className="p-2 text-right">Occupancy</th>
                          <th className="p-2 text-right">Room Rev</th>
                          <th className="p-2 text-right">Budget</th>
                          <th className="p-2 text-right">Var to Budget</th>
                          <th className="p-2 text-right">Paid Hrs</th>
                          <th className="p-2 text-right">HPOR</th>
                          <th className="p-2 text-right">Missing</th>
                          <th className="p-2 text-right">CO</th>
                          <th className="p-2 text-right">SO</th>
                          <th className="p-2 text-right">Rooms</th>
                          <th className="p-2 text-right">Std Hrs</th>
                          <th className="p-2 text-right">Variance</th>
                          <th className="p-2 text-right">MPOR (Min)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hkMonthlyRollups.map((entry: any) => {
                          const variance = typeof entry.mporPaid === "number" ? entry.mporPaid - hkSettings.mporStandard : null;
                          const isSelectedMonth = entry.key === hkMonth;
                          const mtdHpor = hkDailySummary.hporRoomsSold
                            ? hkDailySummary.hporDailyHours / hkDailySummary.hporRoomsSold
                            : null;
                          const roomRevenue = isSelectedMonth ? hkDailySummary.sumRoomRevenueDaily : entry.roomRevenueDaily;
                          const hporValue = isSelectedMonth ? mtdHpor : entry.hpor;
                          const roomsSoldValue = isSelectedMonth ? hkDailySummary.sumRoomsSold : Number(entry.roomsSold || 0);
                          const monthBudgetRaw = hkMonthlyBudgets[entry.key];
                          const monthBudget = monthBudgetRaw && monthBudgetRaw.trim() ? toNumber(monthBudgetRaw) : null;
                          const monthBudgetVariance = monthBudget === null ? null : Number(roomRevenue ?? 0) - monthBudget;
                          const availableRoomNights =
                            hkSettings.roomInventory > 0
                              ? hkSettings.roomInventory * eachDayOfInterval({
                                  start: parseISO(entry.monthStart),
                                  end: parseISO(entry.monthEnd),
                                }).length
                              : 0;
                          const occupancy = availableRoomNights > 0 ? (roomsSoldValue / availableRoomNights) * 100 : null;
                          return (
                          <tr key={entry.key} className="border-b">
                            <td className="p-2">{entry.key}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.roomsSold)}</td>
                            <td className="p-2 text-right">{formatPercentValue(occupancy)}</td>
                            <td className="p-2 text-right">{formatCurrencyValue(roomRevenue)}</td>
                            <td className="p-2 text-right">{formatCurrencyValue(monthBudget)}</td>
                            <td className="p-2 text-right">{formatCurrencyValue(monthBudgetVariance)}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.totalDailyHours)}</td>
                            <td className="p-2 text-right">{formatHkValue(hporValue)}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.hporMissingDays)}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.checkouts)}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.stayovers)}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.roomsCleaned)}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.standardHours)}</td>
                            <td className="p-2 text-right">{formatHkValue(variance)}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.mporPaid)}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {hkMonthlyRollups.some((entry: any) => (entry.hporMissingDays || 0) > 0) && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Some months have missing Rooms Sold or Daily Hours and were excluded from HPOR totals.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Attendant Rankings</CardTitle>
                <div className="w-full max-w-xs">
                  <Select value={hkSelectedWeekKey} onValueChange={setHkSelectedWeekKey}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select week" />
                    </SelectTrigger>
                    <SelectContent>
                      {hkWeekOptions.map((week) => (
                        <SelectItem key={week.key} value={week.key}>
                          {week.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="text-sm font-medium">
                  Weekly Ranking {hkSelectedWeek ? `(${hkSelectedWeek.label})` : ""}
                </div>
                {hkRankingWeekly.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No attendant entries for the selected week.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="p-2 text-left">Rank</th>
                          <th className="p-2 text-left">Attendant</th>
                          <th className="p-2 text-right">MPOR (Min)</th>
                          <th className="p-2 text-right">Rooms</th>
                          <th className="p-2 text-right">Hours</th>
                          <th className="p-2 text-left min-w-[340px]">Trend by Day</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hkRankingWeekly.map((entry, index) => (
                          <tr key={`weekly-${entry.attendantName}`} className="border-b">
                            <td className="p-2">{index + 1}</td>
                            <td className="p-2">{entry.attendantName}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.mpor)}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.roomsTotal)}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.hoursTotal)}</td>
                            <td className="p-2">
                              <TrendTimeline days={entry.trendDays} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">MTD Ranking</div>
                {hkRankingMtd.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No attendant entries yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="p-2 text-left">Rank</th>
                          <th className="p-2 text-left">Attendant</th>
                          <th className="p-2 text-right">MPOR (Min)</th>
                          <th className="p-2 text-right">Rooms</th>
                          <th className="p-2 text-right">Hours</th>
                          <th className="p-2 text-left min-w-[340px]">Trend by Day</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hkRankingMtd.map((entry, index) => (
                          <tr key={`mtd-${entry.attendantName}`} className="border-b">
                            <td className="p-2">{index + 1}</td>
                            <td className="p-2">{entry.attendantName}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.mpor)}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.roomsTotal)}</td>
                            <td className="p-2 text-right">{formatHkValue(entry.hoursTotal)}</td>
                            <td className="p-2">
                              <TrendTimeline days={entry.trendDays} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Dialog open={hkImportDialogOpen} onOpenChange={setHkImportDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Rooms Sold Import Summary</DialogTitle>
                <DialogDescription>Review what was updated from your TXT uploads.</DialogDescription>
              </DialogHeader>
              {hkImportSummary ? (
                <div className="space-y-4 text-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border p-3">
                      <div className="text-muted-foreground">Files processed</div>
                      <div className="text-lg font-semibold">{hkImportSummary.filesProcessed}</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-muted-foreground">Dates updated</div>
                      <div className="text-lg font-semibold">{hkImportSummary.updatedCount}</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-muted-foreground">Parsed lines</div>
                      <div className="text-lg font-semibold">{hkImportSummary.parsedCount}</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-muted-foreground">Skipped lines</div>
                      <div className="text-lg font-semibold">{hkImportSummary.skippedCount}</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-muted-foreground">Conflicts</div>
                      <div className="text-lg font-semibold">{hkImportSummary.conflictCount}</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-muted-foreground">Overwritten dates</div>
                      <div className="text-lg font-semibold">{hkImportSummary.overwrittenCount}</div>
                    </div>
                  </div>

                  {hkImportSummary.skipped.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Skipped lines</div>
                      <div className="max-h-40 overflow-auto rounded-md border p-2 text-xs">
                        {hkImportSummary.skipped.map((item, index) => (
                          <div key={`${item.fileName}-${item.line}-${index}`} className="border-b last:border-b-0 py-1">
                            <span className="font-medium">{item.fileName}</span> line {item.line}: {item.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {hkImportSummary.conflicts.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Conflicts (last upload wins)</div>
                      <div className="max-h-32 overflow-auto rounded-md border p-2 text-xs">
                        {hkImportSummary.conflicts.map((item, index) => (
                          <div key={`${item.date}-${index}`} className="border-b last:border-b-0 py-1">
                            {item.date}: {item.previous ?? "-"} → {item.next}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No import summary available.</div>
              )}
              <DialogFooter>
                <Button onClick={() => setHkImportDialogOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* CRM Tab - Sales & Marketing */}
        <TabsContent value="crm" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Sales & Marketing CRM</CardTitle>
                <CardDescription>Manage leads, contacts, and deal pipeline</CardDescription>
              </div>
              <Button onClick={() => { leadForm.reset(); setEditingLead(null); setLeadDialogOpen(true); }} data-testid="button-add-lead">
                <Plus className="h-4 w-4 mr-2" />
                Add Lead
              </Button>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-muted-foreground">
                  Organize leads by category to keep outreach segmented and easier to review.
                </div>
                <div className="w-full md:w-64">
                  <Select
                    value={leadCategoryFilter}
                    onValueChange={(value) => setLeadCategoryFilter(value as LeadCategory | "all")}
                  >
                    <SelectTrigger data-testid="select-crm-lead-category-filter">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {leadCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {CRM_LEAD_CATEGORY_LABELS[category]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {leadsLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  Loading leads...
                </div>
              )}

              {!leadsLoading && filteredLeads.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {leads.length === 0
                    ? "No leads yet. Add your first lead to get started."
                    : "No leads match the selected category."}
                </div>
              )}

              {!leadsLoading && filteredLeads.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium text-sm">Name</th>
                        <th className="text-left p-3 font-medium text-sm">Email</th>
                        <th className="text-left p-3 font-medium text-sm">Company</th>
                        <th className="text-left p-3 font-medium text-sm">Category</th>
                        <th className="text-left p-3 font-medium text-sm">Status</th>
                        <th className="text-left p-3 font-medium text-sm">Source</th>
                        <th className="text-left p-3 font-medium text-sm">Sales Email</th>
                        <th className="text-right p-3 font-medium text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map((lead) => (
                        <tr key={lead.id} className="border-b last:border-b-0" data-testid={`row-lead-${lead.id}`}>
                          <td className="p-3">
                            <div className="font-medium">{lead.firstName} {lead.lastName}</div>
                            {lead.phone && (
                              <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <Phone className="h-3 w-3" />
                                {lead.phone}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </div>
                          </td>
                          <td className="p-3 text-sm">{lead.company || "-"}</td>
                          <td className="p-3">
                            <Badge variant="outline">
                              {CRM_LEAD_CATEGORY_LABELS[(lead.category as LeadCategory) || "other"]}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant={
                              lead.status === "won" ? "default" :
                              lead.status === "lost" ? "destructive" :
                              lead.status === "new" ? "secondary" :
                              "outline"
                            }>
                              {lead.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">{lead.source || "-"}</td>
                          <td className="p-3">
                            <div className="flex flex-col items-start gap-2">
                              {isSuperAdmin ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  onClick={() => handleOpenSalesEmailDialog(lead)}
                                  disabled={sendLeadSalesEmailMutation.isPending || Boolean(lead.marketingEmailOptOutAt)}
                                  data-testid={`button-send-sales-email-${lead.id}`}
                                >
                                  <Mail className="h-3.5 w-3.5 mr-2" />
                                  {sendLeadSalesEmailMutation.isPending && sendLeadSalesEmailMutation.variables?.id === lead.id
                                    ? "Sending..."
                                    : "Send Sales Email"}
                                </Button>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                              {lead.marketingEmailOptOutAt ? (
                                <span className="text-xs text-destructive">
                                  Unsubscribed {format(parseISO(String(lead.marketingEmailOptOutAt)), "MMM d, yyyy h:mm a")}
                                </span>
                              ) : lead.salesEmailLastSentAt ? (
                                <span className="text-xs text-muted-foreground">
                                  Last sent {format(parseISO(String(lead.salesEmailLastSentAt)), "MMM d, yyyy h:mm a")}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditLead(lead)}
                                data-testid={`button-edit-lead-${lead.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this lead?")) {
                                    deleteLeadMutation.mutate(lead.id);
                                  }
                                }}
                                data-testid={`button-delete-lead-${lead.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lead Summary Stats */}
          <div className="grid gap-6 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredLeads.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New Leads</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredLeads.filter(l => l.status === "new").length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Won</CardTitle>
                <CheckCircle className="h-4 w-4 text-chart-2" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredLeads.filter(l => l.status === "won").length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredLeads.filter(l => ["contacted", "qualified", "proposal", "negotiation"].includes(l.status)).length}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Verifications Tab */}
        <TabsContent value="verifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Verification Review Queue</CardTitle>
              <CardDescription>
                Review and approve user verification submissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {verificationsLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  Loading verifications...
                </div>
              )}

              {!verificationsLoading && verificationSubmissions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No pending verification submissions
                </div>
              )}

              {!verificationsLoading && verificationSubmissions.length > 0 && (
                <div className="space-y-3">
                  {verificationSubmissions.map((submission) => {
                    const submissionData = submission.submissionData as any;
                    return (
                      <Card key={submission.id} data-testid={`card-verification-${submission.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">
                                  {submission.type === "renter_identity" ? "Renter Identity" : "Owner/Aircraft"}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  Submitted {submission.createdAt ? new Date(submission.createdAt).toLocaleDateString() : "Unknown"}
                                </span>
                              </div>
                              <div className="font-semibold text-foreground mb-1">
                                {submissionData.legalFirstName} {submissionData.legalLastName}
                              </div>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <div>User ID: {submission.userId}</div>
                                <div>DOB: {submissionData.dateOfBirth}</div>
                                {submissionData.faaCertificateNumber && (
                                  <div>FAA Certificate: {submissionData.faaCertificateNumber}</div>
                                )}
                                <div>Documents: {submission.documentUrls?.length || 0} files</div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedSubmission(submission);
                                  setReviewDialogOpen(true);
                                }}
                                data-testid={`button-review-${submission.id}`}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Review
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Users</CardTitle>
              <CardDescription>Search by first name, last name, or email</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-user-search"
                  />
                </div>
              </div>

              {usersLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  Searching...
                </div>
              )}

              {!usersLoading && userSearch && users.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No users found matching "{userSearch}"
                </div>
              )}

              {!usersLoading && users.length > 0 && (
                <div className="space-y-3">
                  {users.map((user) => (
                    <Card 
                      key={user.id} 
                      data-testid={`card-user-${user.id}`}
                      className="hover-elevate cursor-pointer transition-all"
                      onClick={() => {
                        setSelectedUserId(user.id);
                        setUserModalOpen(true);
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarImage src={user.profileImageUrl || undefined} />
                            <AvatarFallback>
                              {user.firstName?.[0]}{user.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="font-semibold text-foreground">
                              {user.firstName} {user.lastName}
                              {user.isAdmin && (
                                <Badge className="ml-2" variant="default">
                                  Admin
                                </Badge>
                              )}
                              {user.isVerified && (
                                <Badge className="ml-2" variant="secondary">
                                  Verified
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              ID: {user.id} • Joined: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"} • Flight Hours: {user.totalFlightHours}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Verified:{" "}
                              {user.emailVerified ? "Email ✓" : "Email —"} •{" "}
                              {user.phoneVerified ? "Phone ✓" : "Phone —"} •{" "}
                              {user.identityVerified ? "Identity ✓" : "Identity —"} •{" "}
                              {user.paymentVerified ? "Payment ✓" : "Payment —"} •{" "}
                              {user.isVerified ? "Approved ✓" : "Approved —"}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {!userSearch && (
                <div className="text-center py-8 text-muted-foreground">
                  Enter a search term to find users
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aircraft Listings Tab */}
        <TabsContent value="aircraft" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Aircraft Listings</CardTitle>
              <CardDescription>View and manage all aircraft rental listings</CardDescription>
            </CardHeader>
            <CardContent>
              {aircraftLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  Loading aircraft listings...
                </div>
              )}

              {!aircraftLoading && aircraftListings.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No aircraft listings found
                </div>
              )}

              {!aircraftLoading && aircraftListings.length > 0 && (
                <div className="space-y-3">
                  {aircraftListings.map((listing) => (
                    <div
                      key={listing.id}
                      data-testid={`card-aircraft-${listing.id}`}
                      className="border rounded-lg overflow-visible hover-elevate cursor-pointer transition-all"
                      onClick={() => setSelectedAircraft(listing)}
                    >
                      <div className="p-4">
                        <div className="flex gap-4">
                          {/* Main Image */}
                          {listing.images && listing.images.length > 0 && (
                            <div className="w-32 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                              <img 
                                src={listing.images[0]} 
                                alt={`${listing.make} ${listing.model}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-foreground">
                                  {listing.year} {listing.make} {listing.model}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {listing.registration} • {listing.location}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  ${listing.hourlyRate}/hr • Owner ID: {listing.ownerId}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <Badge variant={listing.isListed ? "default" : "secondary"}>
                                  {listing.isListed ? "Listed" : "Unlisted"}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleAircraftMutation.mutate({ id: listing.id, isListed: !listing.isListed })}
                                  data-testid={`button-toggle-aircraft-${listing.id}`}
                                >
                                  {listing.isListed ? "Unlist" : "List"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setDeleteTarget({ type: 'aircraft', id: listing.id });
                                    setDeleteDialogOpen(true);
                                  }}
                                  data-testid={`button-delete-aircraft-${listing.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Marketplace Listings Tab */}
        <TabsContent value="marketplace" className="space-y-4">
          {/* Flagged Listings Section */}
          {flaggedListings.length > 0 && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Flagged Listings ({flaggedListings.length})
                </CardTitle>
                <CardDescription>Listings with 5+ fraud/spam reports - review and remove if necessary</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {flaggedListings.map((listing) => (
                    <div key={listing.id} className="p-4 bg-destructive/10 rounded-lg border border-destructive/20" data-testid={`flagged-listing-${listing.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{listing.title}</h4>
                            <Badge variant="destructive" className="text-xs">
                              {listing.flagCount} flags
                            </Badge>
                            {!listing.isActive && (
                              <Badge variant="outline" className="text-xs">Inactive</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">
                            Category: {listing.category} • Location: {listing.location || listing.city}
                          </p>
                          <p className="text-sm line-clamp-2">{listing.description}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedMarketplace(listing);
                            }}
                            data-testid={`button-review-flagged-${listing.id}`}
                          >
                            Review
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setDeleteTarget({ type: 'marketplace', id: listing.id });
                              setDeleteDialogOpen(true);
                            }}
                            data-testid={`button-remove-flagged-${listing.id}`}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>All Marketplace Listings</CardTitle>
                <CardDescription>View and manage all marketplace listings</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAdminFreeListingDialogOpen(true)}
                data-testid="button-admin-free-listing"
              >
                <Gift className="h-4 w-4 mr-2" />
                Create Free Listing
              </Button>
            </CardHeader>
            <CardContent>
              {marketplaceLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  Loading marketplace listings...
                </div>
              )}

              {!marketplaceLoading && marketplaceListings.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No marketplace listings found
                </div>
              )}

              {!marketplaceLoading && marketplaceListings.length > 0 && (
                <div className="space-y-3">
                  {marketplaceListings.map((listing) => (
                    <Card 
                      key={listing.id} 
                      data-testid={`card-marketplace-${listing.id}`}
                      className="hover-elevate cursor-pointer transition-all"
                      onClick={() => setSelectedMarketplace(listing)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <div className="font-semibold text-foreground">
                              {listing.title}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {listing.category} • {listing.location || "No location"}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {listing.price && `$${listing.price}`} • User ID: {listing.userId}
                              {listing.monthlyFee === "0" && " • FREE"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Badge variant={listing.isActive ? "default" : "secondary"}>
                              {listing.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleMarketplaceMutation.mutate({ id: listing.id, isActive: !listing.isActive })}
                              data-testid={`button-toggle-marketplace-${listing.id}`}
                            >
                              {listing.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setDeleteTarget({ type: 'marketplace', id: listing.id });
                                setDeleteDialogOpen(true);
                              }}
                              data-testid={`button-delete-marketplace-${listing.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stale & Orphaned Listings Tab */}
        <TabsContent value="stale" className="space-y-6">
          <div className="space-y-6">
            {/* Send Email Reminders Section */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle>Monthly Email Reminders</CardTitle>
                    <CardDescription>
                      Send email reminders to all users with active listings to review and refresh their listings
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => sendRemindersMutation.mutate()}
                    disabled={sendRemindersMutation.isPending}
                    data-testid="button-send-reminders"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {sendRemindersMutation.isPending ? "Sending..." : "Send Reminders Now"}
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Stale Listings Section */}
            <Card>
              <CardHeader>
                <CardTitle>Stale Listings (60+ Days Without Refresh)</CardTitle>
                <CardDescription>
                  These listings haven't been refreshed by their owners in over 60 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                {staleLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : !staleListings || (staleListings.aircraft.length === 0 && staleListings.marketplace.length === 0) ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-muted-foreground">No stale listings found</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {staleListings.aircraft.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Plane className="h-4 w-4" />
                          Aircraft Listings ({staleListings.aircraft.length})
                        </h3>
                        <div className="space-y-3">
                          {staleListings.aircraft.map((aircraft) => (
                            <Card key={aircraft.id} className="hover-elevate">
                              <CardContent className="pt-6">
                                <div className="flex items-start gap-4">
                                  <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                                    <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                  </div>
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <h3 className="font-semibold text-base">
                                          {aircraft.make} {aircraft.model} - {aircraft.registration}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">{aircraft.location}</p>
                                        {aircraft.lastRefreshedAt && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            Last refreshed: {new Date(aircraft.lastRefreshedAt).toLocaleDateString()}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant={aircraft.isListed ? "default" : "secondary"}>
                                          {aircraft.isListed ? "Active" : "Inactive"}
                                        </Badge>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => refreshAircraftMutation.mutate(aircraft.id)}
                                          disabled={refreshAircraftMutation.isPending}
                                          data-testid={`button-refresh-aircraft-${aircraft.id}`}
                                        >
                                          <RefreshCw className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {staleListings.marketplace.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2">
                          <List className="h-4 w-4" />
                          Marketplace Listings ({staleListings.marketplace.length})
                        </h3>
                        <div className="space-y-3">
                          {staleListings.marketplace.map((listing) => (
                            <Card key={listing.id} className="hover-elevate">
                              <CardContent className="pt-6">
                                <div className="flex items-start gap-4">
                                  <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                                    <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                  </div>
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <h3 className="font-semibold text-base">{listing.title}</h3>
                                        <p className="text-sm text-muted-foreground">
                                          {listing.category.replace('-', ' ')} - {listing.city}
                                        </p>
                                        {listing.lastRefreshedAt && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            Last refreshed: {new Date(listing.lastRefreshedAt).toLocaleDateString()}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant={listing.isActive ? "default" : "secondary"}>
                                          {listing.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => refreshMarketplaceMutation.mutate(listing.id)}
                                          disabled={refreshMarketplaceMutation.isPending}
                                          data-testid={`button-refresh-marketplace-${listing.id}`}
                                        >
                                          <RefreshCw className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Orphaned Listings Section */}
            <Card>
              <CardHeader>
                <CardTitle>Orphaned Listings</CardTitle>
                <CardDescription>
                  Listings where the owner account no longer exists or is suspended
                </CardDescription>
              </CardHeader>
              <CardContent>
                {orphanedLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : !orphanedListings || (orphanedListings.aircraft.length === 0 && orphanedListings.marketplace.length === 0) ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-muted-foreground">No orphaned listings found</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {orphanedListings.aircraft.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Plane className="h-4 w-4" />
                          Aircraft Listings ({orphanedListings.aircraft.length})
                        </h3>
                        <div className="space-y-3">
                          {orphanedListings.aircraft.map((aircraft) => (
                            <Card key={aircraft.id} className="hover-elevate">
                              <CardContent className="pt-6">
                                <div className="flex items-start gap-4">
                                  <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                  </div>
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <h3 className="font-semibold text-base">
                                          {aircraft.make} {aircraft.model} - {aircraft.registration}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">{aircraft.location}</p>
                                        <Badge variant="destructive" className="mt-2">Orphaned</Badge>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setDeleteTarget({ type: 'aircraft', id: aircraft.id });
                                          setDeleteDialogOpen(true);
                                        }}
                                        data-testid={`button-delete-orphaned-aircraft-${aircraft.id}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {orphanedListings.marketplace.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2">
                          <List className="h-4 w-4" />
                          Marketplace Listings ({orphanedListings.marketplace.length})
                        </h3>
                        <div className="space-y-3">
                          {orphanedListings.marketplace.map((listing) => (
                            <Card key={listing.id} className="hover-elevate">
                              <CardContent className="pt-6">
                                <div className="flex items-start gap-4">
                                  <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                  </div>
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <h3 className="font-semibold text-base">{listing.title}</h3>
                                        <p className="text-sm text-muted-foreground">
                                          {listing.category.replace('-', ' ')} - {listing.city}
                                        </p>
                                        <Badge variant="destructive" className="mt-2">Orphaned</Badge>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setDeleteTarget({ type: 'marketplace', id: listing.id });
                                          setDeleteDialogOpen(true);
                                        }}
                                        data-testid={`button-delete-orphaned-marketplace-${listing.id}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Promo Alerts Tab */}
        <TabsContent value="promo" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle>Promotional Alerts</CardTitle>
                  <CardDescription>
                    Manage promotional banners and announcements that appear on the marketplace
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => {
                    setEditingPromo(null);
                    promoForm.reset();
                    setPromoDialogOpen(true);
                  }}
                  data-testid="button-add-promo"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Promo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {promoAlertsLoading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : promoAlerts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No promotional alerts configured</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {promoAlerts.map((alert) => (
                    <Card key={alert.id} className="hover-elevate">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                            <Gift className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <h3 className="font-semibold text-base">{alert.title}</h3>
                                <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                                {alert.promoCode && (
                                  <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-muted rounded-md">
                                    <span className="text-xs text-muted-foreground">Code:</span>
                                    <span className="font-mono font-semibold text-sm">{alert.promoCode}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={alert.isEnabled ? "default" : "secondary"}>
                                  {alert.isEnabled ? "Active" : "Inactive"}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => togglePromoAlertMutation.mutate({ id: alert.id, isEnabled: !alert.isEnabled })}
                                  disabled={togglePromoAlertMutation.isPending}
                                  data-testid={`button-toggle-promo-${alert.id}`}
                                >
                                  {alert.isEnabled ? "Disable" : "Enable"}
                                </Button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {alert.showOnMainPage && <Badge variant="outline">Main Page</Badge>}
                              {alert.showOnCategoryPages && <Badge variant="outline">Category Pages</Badge>}
                              {alert.targetCategories && alert.targetCategories.length > 0 && (
                                <Badge variant="outline">
                                  {alert.targetCategories.length} Categories
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Promo Codes Tab */}
        <TabsContent value="promo-codes" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle>Promo Codes Management</CardTitle>
                  <CardDescription>
                    Create and manage promotional discount codes
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => {
                    setEditingPromoCode(null);
                    promoCodeForm.reset();
                    setPromoCodeDialogOpen(true);
                  }}
                  data-testid="button-add-promo-code"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Promo Code
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search and Filter Toolbar */}
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    placeholder="Search promo codes..."
                    value={promoCodeSearch}
                    onChange={(e) => setPromoCodeSearch(e.target.value)}
                    data-testid="input-promo-code-search"
                  />
                </div>
              </div>

              {/* Loading State */}
              {promoCodesLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : promoCodes.filter(code => 
                promoCodeSearch === "" || 
                code.code.toLowerCase().includes(promoCodeSearch.toLowerCase()) ||
                code.description?.toLowerCase().includes(promoCodeSearch.toLowerCase())
              ).length === 0 ? (
                <div className="text-center py-12">
                  <Tag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {promoCodeSearch ? "No promo codes match your search" : "No promo codes configured"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {promoCodes
                    .filter(code => 
                      promoCodeSearch === "" || 
                      code.code.toLowerCase().includes(promoCodeSearch.toLowerCase()) ||
                      code.description?.toLowerCase().includes(promoCodeSearch.toLowerCase())
                    )
                    .map((code) => {
                      const isExpired = !!(code.validUntil && new Date(code.validUntil) < new Date());
                      const usage = code.usedCount || 0;
                      const maxUsage = code.maxUses || "∞";
                      
                      return (
                        <Card key={code.id} className="hover-elevate">
                          <CardContent className="pt-6">
                            <div className="flex items-start gap-4">
                              <div className="p-3 rounded-lg bg-primary/10">
                                <Tag className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1 space-y-3">
                                {/* Header Row */}
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 space-y-2">
                                    {/* Code with Copy Button */}
                                    <div className="flex items-center gap-2">
                                      <code className="px-3 py-1 bg-muted rounded-md font-mono font-bold text-lg">
                                        {code.code}
                                      </code>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          navigator.clipboard.writeText(code.code);
                                          toast({ title: "Promo code copied to clipboard" });
                                        }}
                                        data-testid={`button-copy-code-${code.id}`}
                                      >
                                        <FileText className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    
                                    {/* Description */}
                                    {code.description && (
                                      <p className="text-sm text-muted-foreground">{code.description}</p>
                                    )}
                                  </div>
                                  
                                  {/* Status and Actions */}
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      variant={code.isActive && !isExpired ? "default" : "secondary"}
                                      data-testid={`badge-status-${code.id}`}
                                    >
                                      {isExpired ? "Expired" : code.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => togglePromoCodeMutation.mutate({ 
                                        id: code.id,
                                        // @ts-ignore
                                        isActive: !((code.isActive ?? false) as boolean)
                                      })}
                                      disabled={!!togglePromoCodeMutation.isPending || !!isExpired}
                                      data-testid={`button-toggle-promo-code-${code.id}`}
                                    >
                                      {code.isActive ? "Disable" : "Enable"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingPromoCode(code);
                                        // @ts-ignore - Type coercion for form reset
                                        promoCodeForm.reset({
                                          code: code.code,
                                          description: code.description || "",
                                          discountType: code.discountType as "free_7_day" | "percentage" | "fixed_amount" | "waive_creation_fee",
                                          discountValue: code.discountValue || "",
                                          maxUses: code.maxUses || undefined,
                                          validFrom: code.validFrom ? new Date(code.validFrom) : new Date(),
                                          validUntil: code.validUntil ? new Date(code.validUntil) : undefined,
                                          isActive: code.isActive ?? undefined,
                                          applicableToBannerAds: code.applicableToBannerAds ? true : false,
                                          applicableToMarketplace: code.applicableToMarketplace ? true : false,
                                        } as any);
                                        setPromoCodeDialogOpen(true);
                                      }}
                                      data-testid={`button-edit-promo-code-${code.id}`}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        if (confirm(`Are you sure you want to delete promo code "${code.code}"?`)) {
                                          deletePromoCodeMutation.mutate(code.id);
                                        }
                                      }}
                                      disabled={deletePromoCodeMutation.isPending}
                                      data-testid={`button-delete-promo-code-${code.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>

                                {/* Details Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
                                  {/* Discount */}
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Discount</p>
                                    <p className="font-semibold">
                                      {code.discountType === 'percentage' 
                                        ? `${code.discountValue}%` 
                                        : `$${code.discountValue}`}
                                    </p>
                                  </div>

                                  {/* Valid From */}
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Valid From</p>
                                    <p className="text-sm">
                                      {code.validFrom 
                                        ? new Date(code.validFrom).toLocaleDateString() 
                                        : "—"}
                                    </p>
                                  </div>

                                  {/* Valid To */}
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Valid To</p>
                                    <p className="text-sm">
                                      {code.validUntil 
                                        ? new Date(code.validUntil).toLocaleDateString() 
                                        : "No expiry"}
                                    </p>
                                  </div>

                                  {/* Usage */}
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Usage</p>
                                    <p className="font-semibold">
                                      {usage} / {maxUsage}
                                    </p>
                                  </div>
                                </div>

                                {/* Applicability Badges */}
                                <div className="flex flex-wrap gap-2">
                                  {code.applicableToBannerAds && (
                                    <Badge variant="outline" data-testid={`badge-banner-${code.id}`}>
                                      Banner Ads
                                    </Badge>
                                  )}
                                  {code.applicableToMarketplace && (
                                    <Badge variant="outline" data-testid={`badge-marketplace-${code.id}`}>
                                      Marketplace
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Withdrawals Tab - Monitoring Dashboard */}
        <TabsContent value="withdrawals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle data-testid="heading-withdrawal-requests">Owner Payouts Dashboard</CardTitle>
              <CardDescription>Monitor and track all automated payouts to aircraft owners</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filter Controls */}
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    placeholder="Search by user ID, email, transaction ID..."
                    value={withdrawalSearch}
                    onChange={(e) => setWithdrawalSearch(e.target.value)}
                    data-testid="input-withdrawal-search"
                  />
                </div>
                <Select value={withdrawalStatusFilter} onValueChange={setWithdrawalStatusFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Summary Stats */}
              {!withdrawalsLoading && withdrawals.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Total Payouts</div>
                    <div className="text-2xl font-bold">{filteredWithdrawals.length}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Completed</div>
                    <div className="text-2xl font-bold text-green-600">
                      {filteredWithdrawals.filter((w: any) => w.status === "completed").length}
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Failed</div>
                    <div className="text-2xl font-bold text-red-600">
                      {filteredWithdrawals.filter((w: any) => w.status === "failed").length}
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Total Amount</div>
                    <div className="text-2xl font-bold">
                      ${filteredWithdrawals
                        .filter((w: any) => w.status === "completed")
                        .reduce((sum: number, w: any) => sum + parseFloat(w.amount), 0)
                        .toFixed(2)}
                    </div>
                  </Card>
                </div>
              )}

              {/* Withdrawals List */}
              {withdrawalsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading withdrawal history...
                </div>
              ) : withdrawals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-withdrawals">
                  No withdrawal history yet
                </div>
              ) : filteredWithdrawals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No withdrawals match your search criteria
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredWithdrawals.map((withdrawal: any) => (
                    <Card key={withdrawal.id} className="p-4" data-testid={`card-withdrawal-${withdrawal.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-lg" data-testid={`text-amount-${withdrawal.id}`}>
                              ${parseFloat(withdrawal.amount).toFixed(2)}
                            </span>
                            <Badge 
                              variant={
                                withdrawal.status === "completed" ? "default" : 
                                withdrawal.status === "processing" ? "secondary" : 
                                withdrawal.status === "failed" ? "destructive" : 
                                "outline"
                              }
                              data-testid={`badge-status-${withdrawal.id}`}
                            >
                              {withdrawal.status}
                            </Badge>
                          </div>
                          <div className="text-sm space-y-1">
                            <p><span className="text-muted-foreground">User ID:</span> {withdrawal.userId}</p>
                            <p><span className="text-muted-foreground">PayPal Business/Commerce Email:</span> {withdrawal.paypalEmail}</p>
                            <p><span className="text-muted-foreground">Requested:</span> {new Date(withdrawal.requestedAt).toLocaleString()}</p>
                            {withdrawal.processedAt && (
                              <p><span className="text-muted-foreground">Processed:</span> {new Date(withdrawal.processedAt).toLocaleString()}</p>
                            )}
                            {withdrawal.payoutBatchId && (
                              <p className="text-xs"><span className="text-muted-foreground">Batch ID:</span> {withdrawal.payoutBatchId}</p>
                            )}
                            {withdrawal.transactionId && (
                              <p className="text-xs"><span className="text-muted-foreground">Transaction ID:</span> {withdrawal.transactionId}</p>
                            )}
                            {withdrawal.failureReason && (
                              <p className="text-sm text-destructive">
                                <span className="font-medium">Failure Reason:</span> {withdrawal.failureReason}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <p>Automated Payout</p>
                          {withdrawal.status === "completed" && (
                            <p className="text-green-600 font-medium">✓ Sent</p>
                          )}
                          {withdrawal.status === "failed" && (
                            <p className="text-red-600 font-medium">✗ Failed</p>
                          )}
                          {withdrawal.status === "processing" && (
                            <p className="text-blue-600 font-medium">⟳ Processing</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Tools</CardTitle>
              <CardDescription>Run maintenance tasks without leaving the dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={() => syncApproachPlatesMutation.mutate()}
                disabled={syncApproachPlatesMutation.isPending}
                data-testid="button-sync-approach-plates"
              >
                {syncApproachPlatesMutation.isPending ? "Syncing plates..." : "Sync Approach Plates Now"}
              </Button>
              <Badge variant="outline">FAA d-TPP</Badge>
              {plateStatus?.lastFinishedAt && (
                <span className="text-xs text-muted-foreground">
                  Last cache refresh: {new Date(plateStatus.lastFinishedAt).toLocaleString()}
                </span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle data-testid="heading-notifications">Admin Notifications</CardTitle>
              <CardDescription>
                System alerts for listing thresholds and important events
              </CardDescription>
            </CardHeader>
            <CardContent>
              {notificationsLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading notifications...</p>
                </div>
              ) : adminNotifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {adminNotifications.map((notification) => (
                    <Card 
                      key={notification.id} 
                      className={notification.isRead ? "opacity-60" : "border-primary"}
                      data-testid={`notification-${notification.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-sm">{notification.title}</h4>
                              {!notification.isRead && (
                                <Badge variant="destructive" className="text-xs">New</Badge>
                              )}
                              {notification.type === "listing_threshold" && (
                                <Badge variant="secondary" className="text-xs">Threshold Alert</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{notification.message}</p>
                            {notification.listingCount && (
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>Category: {notification.category?.replace('-', ' ').toUpperCase()}</span>
                                <span>•</span>
                                <span>Count: {notification.listingCount}</span>
                                <span>•</span>
                                <span>Threshold: {notification.threshold}</span>
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {new Date(notification.createdAt!).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {!notification.isRead && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => markNotificationReadMutation.mutate(notification.id)}
                                data-testid={`button-mark-read-${notification.id}`}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteNotificationMutation.mutate(notification.id)}
                              data-testid={`button-delete-notification-${notification.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Banner Ads Tab */}
        <TabsContent value="banners" className="space-y-6">
          <Card>
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Want information on becoming a sponsored business?</p>
                <p className="text-sm text-muted-foreground">
                  View pricing, placement options, and submit your sponsor inquiry.
                </p>
              </div>
              <Button asChild variant="secondary" data-testid="button-banner-ad-info">
                <a href="/banner-advertise" target="_blank" rel="noopener noreferrer">
                  Click here
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Banner Ad Orders Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle data-testid="heading-banner-orders">Banner Ad Orders</CardTitle>
                <CardDescription>
                  Manage sponsor orders, track payments, and activate banner campaigns
                </CardDescription>
              </div>
              <Button 
                onClick={() => {
                  setEditingOrder(null);
                  setOrderImageUrl("");
                  setOrderVideoUrl("");
                  orderForm.reset();
                  setOrderDialogOpen(true);
                }}
                data-testid="button-create-order"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Order
              </Button>
            </CardHeader>
            <CardContent>
              {bannerOrders.some(o => o.paymentStatus !== 'paid' && o.paymentStatus !== 'comped') && (
                <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive" data-testid="alert-unpaid-banner-orders">
                  Some banner orders are unpaid. Capture payment (PayPal Business/Commerce) before approval and activation.
                </div>
              )}
              {ordersLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading orders...</p>
                </div>
              ) : bannerOrders.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Orders Yet</h3>
                  <p className="text-muted-foreground max-w-md mx-auto mb-4">
                    Create banner ad orders to manage sponsor billing and campaign activation.
                  </p>
                  <Button 
                    onClick={() => {
                      setEditingOrder(null);
                      setOrderImageUrl("");
                      setOrderVideoUrl("");
                      orderForm.reset();
                      setOrderDialogOpen(true);
                    }}
                    data-testid="button-create-first-order"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Order
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {bannerOrders.map((order) => (
                    <Card key={order.id} data-testid={`order-card-${order.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Order Image Preview */}
                          {order.imageUrl && (
                            <div className="w-32 h-20 rounded overflow-hidden flex-shrink-0 bg-muted">
                              <img 
                                src={resolveObjectUrl(order.imageUrl)} 
                                alt={order.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          
                          {/* Order Details */}
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold">{order.title}</h4>
                              <Badge variant={
                                order.approvalStatus === 'approved' ? 'default' : 
                                order.approvalStatus === 'rejected' ? 'destructive' : 
                                order.approvalStatus === 'sent' ? 'secondary' : 
                                'outline'
                              }>
                                {order.approvalStatus}
                              </Badge>
                              <Badge variant={
                                order.paymentStatus === 'paid' ? 'default' : 
                                order.paymentStatus === 'comped' ? 'secondary' :
                                order.paymentStatus === 'refunded' ? 'destructive' : 
                                'outline'
                              }>
                                {order.paymentStatus}
                              </Badge>
                              <Badge variant="outline" className="capitalize">
                                {order.tier.replace(/(\d+)month/, '$1 Month')}
                              </Badge>
                            </div>
                            
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>
                                <span className="font-medium">Sponsor:</span> {order.sponsorName}
                                {order.sponsorCompany && ` (${order.sponsorCompany})`}
                              </p>
                              <p>
                                <span className="font-medium">Email:</span> {order.sponsorEmail}
                              </p>
                              {order.description && (
                                <p>
                                  <span className="font-medium">Tagline:</span> {order.description}
                                </p>
                              )}
                              {order.adCopy && (
                                <p>
                                  <span className="font-medium">Description:</span> {order.adCopy}
                                </p>
                              )}
                              <div className="flex items-center gap-4 flex-wrap">
                                <span className="font-medium">
                                  Total: ${order.grandTotal}
                                </span>
                                {order.placements && (
                                  <span>
                                    <span className="font-medium">Placements:</span> {order.placements.length} pages
                                  </span>
                                )}
                                {order.paypalPaymentDate && (
                                  <span>
                                    <span className="font-medium">Paid:</span> {new Date(order.paypalPaymentDate).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              {order.adminNotes && (
                                <p className="text-xs italic">
                                  <span className="font-medium">Notes:</span> {order.adminNotes}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {/* Approve/Reject buttons - only show for paid orders that need approval */}
                            {(order.paymentStatus === 'paid' || order.paymentStatus === 'comped') && (order.approvalStatus === 'draft' || order.approvalStatus === 'sent' || order.approvalStatus === 'pending_review') && (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => approveOrderMutation.mutate(order.id)}
                                  disabled={approveOrderMutation.isPending}
                                  data-testid={`button-approve-order-${order.id}`}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    const notes = prompt('Rejection reason (optional):');
                                    if (notes !== null) { // null means cancelled, empty string is valid
                                      rejectOrderMutation.mutate({ id: order.id, adminNotes: notes || undefined });
                                    }
                                  }}
                                  disabled={rejectOrderMutation.isPending}
                                  data-testid={`button-reject-order-${order.id}`}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}
                            {/* Activate button - only show for paid approved orders */}
                            {(order.paymentStatus === 'paid' || order.paymentStatus === 'comped') && order.approvalStatus === 'approved' && (
                              isOrderActivated(order.id) ? (
                                <Badge variant="secondary" className="cursor-not-allowed" data-testid={`badge-activated-${order.id}`}>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Already Activated
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => activateOrderMutation.mutate(order.id)}
                                  disabled={activateOrderMutation.isPending}
                                  data-testid={`button-activate-order-${order.id}`}
                                >
                                  <Rocket className="h-4 w-4 mr-1" />
                                  Activate
                                </Button>
                              )
                            )}
                            {isSuperAdmin &&
                              !isOrderActivated(order.id) &&
                              ((order.paymentStatus !== 'paid' && order.paymentStatus !== 'comped') || order.approvalStatus !== 'approved') && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (confirm("Activate this order without payment? This will comp it and approve.")) {
                                      activateOrderMutation.mutate(order.id);
                                    }
                                  }}
                                  disabled={activateOrderMutation.isPending}
                                  data-testid={`button-activate-order-superadmin-${order.id}`}
                                >
                                  <Rocket className="h-4 w-4 mr-1" />
                                  Activate (Super Admin)
                                </Button>
                              )}
                            {/* Only allow editing order details if not yet activated */}
                            {!isOrderActivated(order.id) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingOrder(order);
                                  setOrderImageUrl(order.imageUrl ?? "");
                                  setOrderVideoUrl(order.videoUrl ?? "");
                                  setSelectedTier(order.tier as "1month" | "3months" | "6months" | "12months");
                                  
                                  // Load promo code state if exists
                                  if (order.promoCode) {
                                    setPromoCodeInput(order.promoCode);
                                    setAppliedPromoCode(order.promoCode);
                                    setPromoCodeValid(true);
                                    const discountAmt = parseFloat(order.discountAmount || "0");
                                    setPromoCodeMessage(`Promo code applied! You save $${discountAmt.toFixed(2)}`);
                                  } else {
                                    setPromoCodeInput("");
                                    setAppliedPromoCode(null);
                                    setPromoCodeValid(null);
                                    setPromoCodeMessage("");
                                  }
                                  
                                  orderForm.reset({
                                    sponsorName: order.sponsorName,
                                    sponsorEmail: order.sponsorEmail,
                                    sponsorCompany: order.sponsorCompany ?? "",
                                    title: order.title,
                                    description: order.description ?? "",
                                    adCopy: order.adCopy ?? "",
                                    imageUrl: order.imageUrl ?? "",
                                    videoUrl: order.videoUrl ?? "",
                                    videoMuted: order.videoMuted ?? true,
                                    videoOrientation: normalizeBannerVideoOrientation(order.videoOrientation),
                                    link: order.link ?? "",
                                    placements: order.placements ?? [],
                                    category: order.category ?? undefined,
                                    tier: order.tier as "1month" | "3months" | "6months" | "12months",
                                    monthlyRate: order.monthlyRate,
                                    totalAmount: order.totalAmount,
                                    creationFee: order.creationFee,
                                    promoCode: order.promoCode ?? "",
                                    discountAmount: order.discountAmount ?? "0.00",
                                    grandTotal: order.grandTotal,
                                    approvalStatus: order.approvalStatus,
                                    paymentStatus: order.paymentStatus ?? undefined,
                                    adminNotes: order.adminNotes ?? "",
                                    startDate: order.startDate ? new Date(order.startDate) : new Date(),
                                    endDate: order.endDate ? new Date(order.endDate) : undefined,
                                  });
                                  setOrderDialogOpen(true);
                                }}
                                data-testid={`button-edit-order-${order.id}`}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit Order Details
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this order?')) {
                                  deleteOrderMutation.mutate(order.id);
                                }
                              }}
                              data-testid={`button-delete-order-${order.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Banner Ads Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle data-testid="heading-banners">Live Banner Ads</CardTitle>
                <CardDescription>
                  View and manage active banner campaigns created from paid orders. Banner ads are automatically created when you activate a paid Banner Ad Order.
                </CardDescription>
              </div>
              {canAccess("banners") && (
                <Button
                  onClick={() => {
                    setEditingBanner(null);
                    setBannerImageUrl("");
                    setBannerVideoUrl("");
                    bannerForm.reset();
                    setBannerDialogOpen(true);
                  }}
                  data-testid="button-create-live-banner"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Live Banner
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {bannerAdsLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading banner ads...</p>
                </div>
              ) : bannerAds.length === 0 ? (
                <div className="text-center py-12">
                  <Image className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Live Banner Ads</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Banner ads appear here when you activate paid orders from the Banner Ad Orders section. Create an order, get payment from the sponsor, then activate it to create a live banner ad.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bannerAds.map((banner) => (
                    <Card key={banner.id} data-testid={`banner-card-${banner.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Banner Media Preview */}
                          {(banner.videoUrl || banner.imageUrl) && (
                            <div className="w-32 h-20 rounded overflow-hidden flex-shrink-0 bg-muted">
                              {banner.videoUrl ? (
                                <video
                                  src={resolveObjectUrl(banner.videoUrl)}
                                  className="w-full h-full object-cover"
                                  muted={banner.videoMuted ?? true}
                                  playsInline
                                />
                              ) : (
                                <img
                                  src={resolveObjectUrl(banner.imageUrl)}
                                  alt={banner.title}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                          )}
                          
                          {/* Banner Details */}
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{banner.title}</h4>
                              <Badge variant={banner.isActive ? "default" : "secondary"}>
                                {banner.isActive ? "Active" : "Inactive"}
                              </Badge>
                              {banner.placements && banner.placements.length > 0 && (
                                <Badge variant="outline" className="capitalize">
                                  {banner.placements[0].replace('_', ' ')}
                                </Badge>
                              )}
                              {banner.category && (
                                <Badge variant="outline" className="capitalize">
                                  {banner.category.replace('-', ' ')}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="text-sm text-muted-foreground space-y-1">
                              {banner.description && (
                                <p>
                                  <span className="font-medium">Tagline:</span> {banner.description}
                                </p>
                              )}
                              {banner.adCopy && (
                                <p>
                                  <span className="font-medium">Description:</span> {banner.adCopy}
                                </p>
                              )}
                              {banner.link && (
                                <p className="truncate">
                                  <span className="font-medium">Link URL:</span> {banner.link}
                                </p>
                              )}
                              {banner.instagramUrl && (
                                <p className="truncate">
                                  <span className="font-medium">Instagram:</span> {banner.instagramUrl}
                                </p>
                              )}
                              {banner.facebookUrl && (
                                <p className="truncate">
                                  <span className="font-medium">Facebook:</span> {banner.facebookUrl}
                                </p>
                              )}
                              {banner.link && (
                                <div className="flex items-center gap-2 flex-wrap text-xs">
                                  <span className="font-medium">Tracking:</span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => {
                                      const trackingUrl = buildBannerTrackingUrl(banner.link, {
                                        placement: banner.placements?.[0] ?? null,
                                        category: banner.category ?? null,
                                        bannerId: banner.id,
                                      });
                                      if (trackingUrl) {
                                        window.open(trackingUrl, "_blank", "noopener,noreferrer");
                                      }
                                    }}
                                    data-testid={`button-open-tracking-${banner.id}`}
                                  >
                                    Open tracked link
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={async () => {
                                      const trackingUrl = buildBannerTrackingUrl(banner.link, {
                                        placement: banner.placements?.[0] ?? null,
                                        category: banner.category ?? null,
                                        bannerId: banner.id,
                                      });
                                      if (!trackingUrl) return;
                                      try {
                                        await navigator.clipboard.writeText(trackingUrl);
                                        toast({ title: "Tracking link copied" });
                                      } catch (error) {
                                        console.error("Failed to copy tracking link", error);
                                        toast({
                                          title: "Copy failed",
                                          description: "Please copy the link manually.",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                    data-testid={`button-copy-tracking-${banner.id}`}
                                  >
                                    Copy
                                  </Button>
                                </div>
                              )}
                              <div className="flex items-center gap-4">
                                <span>
                                  <Clock className="h-3 w-3 inline mr-1" />
                                  {new Date(banner.startDate).toLocaleDateString()}
                                  {banner.endDate && ` - ${new Date(banner.endDate).toLocaleDateString()}`}
                                </span>
                                <span>
                                  <Eye className="h-3 w-3 inline mr-1" />
                                  {banner.impressions ?? 0} impressions
                                </span>
                                <span>
                                  <Activity className="h-3 w-3 inline mr-1" />
                                  {banner.clicks ?? 0} clicks
                                </span>
                                {(banner.impressions ?? 0) > 0 && (
                                  <span className="text-primary">
                                    CTR: {(((banner.clicks ?? 0) / (banner.impressions ?? 0)) * 100).toFixed(2)}%
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const url = apiUrl(`/api/admin/banner-ads/${banner.id}/summary.csv`);
                                window.open(url, "_blank", "noopener,noreferrer");
                              }}
                              data-testid={`button-download-banner-summary-${banner.id}`}
                            >
                              Download summary
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleBannerAdMutation.mutate({ 
                                id: banner.id, 
                                isActive: !banner.isActive 
                              })}
                              data-testid={`button-toggle-banner-${banner.id}`}
                            >
                              {banner.isActive ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingBanner(banner);
                                setBannerImageUrl(banner.imageUrl || ""); // Populate image preview
                                setBannerVideoUrl(banner.videoUrl || "");
                                bannerForm.reset({
                                  title: banner.title,
                                  imageUrl: banner.imageUrl || "",
                                  videoUrl: banner.videoUrl || "",
                                  videoMuted: banner.videoMuted ?? true,
                                  videoOrientation: normalizeBannerVideoOrientation(banner.videoOrientation),
                                  link: banner.link ?? "",
                                  instagramUrl: banner.instagramUrl ?? "",
                                  facebookUrl: banner.facebookUrl ?? "",
                                  description: banner.description ?? "",
                                  adCopy: banner.adCopy ?? "",
                                  placements: banner.placements || [],
                                  category: banner.category || undefined,
                                  listingId: banner.listingId || undefined,
                                  listingType: banner.listingType || undefined,
                                  isActive: banner.isActive,
                                  startDate: banner.startDate ? new Date(banner.startDate) : new Date(),
                                  endDate: banner.endDate ? new Date(banner.endDate) : undefined,
                                });
                                setBannerDialogOpen(true);
                              }}
                              data-testid={`button-edit-banner-${banner.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete the banner ad "${banner.title}"?`)) {
                                  deleteBannerAdMutation.mutate(banner.id);
                                }
                              }}
                              data-testid={`button-delete-banner-${banner.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Partner Tools Analytics</CardTitle>
              <CardDescription>
                Engagement metrics for featured partner tools (impressions, clicks, CTR).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {partnerToolMetrics.length === 0 ? (
                <p className="text-sm text-muted-foreground">No partner metrics recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Partner</th>
                        <th className="py-2 pr-4 font-medium">Impressions</th>
                        <th className="py-2 pr-4 font-medium">Clicks</th>
                        <th className="py-2 pr-4 font-medium">CTR</th>
                        <th className="py-2 pr-4 font-medium">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partnerToolMetrics.map((metric) => {
                        const impressions = metric.impressions ?? 0;
                        const clicks = metric.clicks ?? 0;
                        const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00";
                        return (
                          <tr key={metric.partner} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-semibold">{metric.partner}</td>
                            <td className="py-2 pr-4">{impressions}</td>
                            <td className="py-2 pr-4">{clicks}</td>
                            <td className="py-2 pr-4">{ctr}%</td>
                            <td className="py-2 pr-4">
                              {metric.updatedAt ? new Date(metric.updatedAt).toLocaleString() : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canSeeFinance && (
          <TabsContent value="finance" className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Finance</h2>
              <p className="text-sm text-muted-foreground">
                Revenue, expense, and margin visibility live here so analytics stays focused on product usage.
              </p>
            </div>
            {financeOverviewCards}
            {expenseTrackingCard}
            {analyticsLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              </div>
            )}
          </TabsContent>
        )}

        {canSeeFinance && (
          <TabsContent value="personal-finance" className="space-y-6">
            <PersonalFinance isActive={activeTab === "personal-finance"} />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="admins" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Invite Admin</CardTitle>
                <CardDescription>Send an admin invite to a team member by email.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="team@readysetfly.us"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as AdminRole)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ADMIN_ROLE_LABELS).map(([role, label]) => (
                          <SelectItem key={role} value={role}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Permissions: {ADMIN_ROLE_PERMISSIONS[inviteRole].join(", ")}
                </div>
                <Button
                  onClick={() => createAdminInviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole })}
                  disabled={!inviteEmail.trim() || createAdminInviteMutation.isPending}
                >
                  {createAdminInviteMutation.isPending ? "Sending..." : "Send Invite"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Admin Users</CardTitle>
                <CardDescription>Manage admin roles and access.</CardDescription>
              </CardHeader>
              <CardContent>
                {adminUsersLoading ? (
                  <div className="text-sm text-muted-foreground">Loading admins...</div>
                ) : adminUsers.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No admins found.</div>
                ) : (
                  <div className="space-y-3">
                    {adminUsers.map((admin) => (
                      <div key={admin.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                        <div>
                          <div className="font-semibold">
                            {admin.firstName || "Admin"} {admin.lastName || ""}{" "}
                            {admin.isSuperAdmin && <Badge variant="default">Super Admin</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">{admin.email}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={(admin.adminRole as AdminRole) || "operations"}
                            onValueChange={(value) => updateAdminRoleMutation.mutate({ userId: admin.id, role: value as AdminRole })}
                            disabled={Boolean(admin.isSuperAdmin)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(ADMIN_ROLE_LABELS).map(([role, label]) => (
                                <SelectItem key={role} value={role}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            onClick={() => updateAdminRoleMutation.mutate({ userId: admin.id, role: (admin.adminRole as AdminRole) || "operations" })}
                            disabled={Boolean(admin.isSuperAdmin)}
                          >
                            Update
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pending Invites</CardTitle>
                <CardDescription>Track outstanding admin invitations.</CardDescription>
              </CardHeader>
              <CardContent>
                {invitesLoading ? (
                  <div className="text-sm text-muted-foreground">Loading invites...</div>
                ) : adminInvites.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No pending invites.</div>
                ) : (
                  <div className="space-y-3">
                    {adminInvites.map((invite) => (
                      <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                        <div>
                          <div className="font-semibold">{invite.email}</div>
                          <div className="text-xs text-muted-foreground">
                            Role: {ADMIN_ROLE_LABELS[(invite.role as AdminRole) || "operations"]} •
                            Expires {invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : "—"}
                          </div>
                        </div>
                        <Badge variant={invite.acceptedAt ? "secondary" : "outline"}>
                          {invite.acceptedAt ? "Accepted" : "Pending"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Verification Review Dialog */}
      <Dialog 
        open={reviewDialogOpen} 
        onOpenChange={(open) => {
          setReviewDialogOpen(open);
          if (!open) {
            // Reset state when dialog closes
            setSelectedSubmission(null);
            setRejectionNotes("");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Verification Submission</DialogTitle>
            <DialogDescription>
              Review the submitted documents and information carefully before approving or rejecting.
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-4">
              {/* Submission Details */}
              <div className="space-y-2">
                <h3 className="font-semibold">Submission Information</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span>{" "}
                    {selectedSubmission.type === "renter_identity" ? "Renter Identity" : "Owner/Aircraft"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>{" "}
                    <Badge variant="outline">{selectedSubmission.status}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Submitted:</span>{" "}
                    {selectedSubmission.createdAt ? new Date(selectedSubmission.createdAt).toLocaleString() : "Unknown"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">User ID:</span> {selectedSubmission.userId}
                  </div>
                </div>
              </div>

              {/* User Data */}
              {(() => {
                const data = selectedSubmission.submissionData as any;
                return (
                  <div className="space-y-2">
                    <h3 className="font-semibold">User Information</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Legal Name:</span>{" "}
                        {data.legalFirstName} {data.legalLastName}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Date of Birth:</span> {data.dateOfBirth}
                      </div>
                      {data.faaCertificateNumber && (
                        <>
                          <div>
                            <span className="text-muted-foreground">FAA Certificate:</span> {data.faaCertificateNumber}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Certificate Name:</span> {data.pilotCertificateName}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Documents */}
              <div className="space-y-2">
                <h3 className="font-semibold">Documents ({selectedSubmission.documentUrls?.length || 0})</h3>
                <div className="space-y-1 text-sm">
                  {(selectedSubmission.documentUrls || []).map((url, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Document {index + 1}
                      </Badge>
                      <span className="text-muted-foreground truncate">{url}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Note: Document URLs are placeholders. In production, these will link to cloud storage.
                </p>
              </div>

              {/* Rejection Notes (if rejecting) */}
              <div className="space-y-2">
                <Label htmlFor="rejection-notes">Rejection Notes (optional)</Label>
                <Textarea
                  id="rejection-notes"
                  placeholder="Provide feedback on why this verification is being rejected..."
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  rows={3}
                  data-testid="textarea-rejection-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setReviewDialogOpen(false);
                setRejectionNotes("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedSubmission) {
                  rejectMutation.mutate({ 
                    id: selectedSubmission.id, 
                    notes: rejectionNotes || "No reason provided" 
                  });
                }
              }}
              disabled={rejectMutation.isPending}
              data-testid="button-reject-verification"
            >
              <XCircle className="h-4 w-4 mr-2" />
              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
            </Button>
            <Button
              onClick={() => {
                if (selectedSubmission) {
                  approveMutation.mutate(selectedSubmission.id);
                }
              }}
              disabled={approveMutation.isPending}
              data-testid="button-approve-verification"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {approveMutation.isPending ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Form Dialog */}
      <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-lead-form">
          <DialogHeader>
            <DialogTitle>{editingLead ? "Edit Lead" : "Add New Lead"}</DialogTitle>
            <DialogDescription>
              {editingLead ? "Update lead information" : "Add a new sales lead to your CRM"}
            </DialogDescription>
          </DialogHeader>

          <Form {...leadForm}>
            <form onSubmit={leadForm.handleSubmit(handleSubmitLead)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={leadForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-lead-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={leadForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-lead-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={leadForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} data-testid="input-lead-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={leadForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-lead-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={leadForm.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-lead-company" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={leadForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-lead-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="proposal">Proposal</SelectItem>
                          <SelectItem value="negotiation">Negotiation</SelectItem>
                          <SelectItem value="won">Won</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={leadForm.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-lead-source">
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="website">Website</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="social_media">Social Media</SelectItem>
                          <SelectItem value="advertising">Advertising</SelectItem>
                          <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                          <SelectItem value="event">Event</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={leadForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "other"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-lead-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leadCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {CRM_LEAD_CATEGORY_LABELS[category]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Group this lead by the market or service you are targeting.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={leadForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        data-testid="textarea-lead-notes"
                        placeholder="Add any notes about this lead..."
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setLeadDialogOpen(false);
                    leadForm.reset();
                    setEditingLead(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createLeadMutation.isPending || updateLeadMutation.isPending}
                  data-testid="button-submit-lead"
                >
                  {createLeadMutation.isPending || updateLeadMutation.isPending ? "Saving..." : editingLead ? "Update Lead" : "Create Lead"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={salesEmailDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setSalesEmailDialogOpen(true);
          } else {
            handleCloseSalesEmailDialog();
          }
        }}
      >
        <DialogContent className="max-w-4xl" data-testid="dialog-sales-email-preview">
          <DialogHeader>
            <DialogTitle>Review Sales Email</DialogTitle>
            <DialogDescription>
              {selectedSalesLead
                ? `Preview the email for ${selectedSalesLead.firstName} ${selectedSalesLead.lastName} at ${selectedSalesLead.email} before sending.`
                : "Preview and review the CRM sales email before sending."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="text-sm font-semibold">Lead</div>
                {selectedSalesLead ? (
                  <>
                    <div className="text-sm">{selectedSalesLead.firstName} {selectedSalesLead.lastName}</div>
                    <div className="text-sm text-muted-foreground">{selectedSalesLead.email}</div>
                    <div className="text-xs text-muted-foreground">
                      Category: {CRM_LEAD_CATEGORY_LABELS[(selectedSalesLead.category as LeadCategory) || "other"]}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">No lead selected.</div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sales-email-template">Email option</Label>
                <Select
                  value={salesEmailTemplateType}
                  onValueChange={(value) => setSalesEmailTemplateType(value as CrmSalesEmailTemplateType)}
                >
                  <SelectTrigger id="sales-email-template" data-testid="select-sales-email-template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {crmSalesEmailTemplateTypes.map((templateType) => (
                      <SelectItem key={templateType} value={templateType}>
                        {CRM_SALES_TEMPLATE_LABELS[templateType]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {CRM_SALES_TEMPLATE_DESCRIPTIONS[salesEmailTemplateType]}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sales-email-greeting">Greeting name override</Label>
                <Input
                  id="sales-email-greeting"
                  value={salesEmailGreetingName}
                  onChange={(e) => setSalesEmailGreetingName(e.target.value)}
                  placeholder={
                    selectedSalesLead
                      ? `${selectedSalesLead.firstName} ${selectedSalesLead.lastName}`.trim() || selectedSalesLead.company || "Pilot"
                      : "Jane Smith"
                  }
                  data-testid="input-sales-email-greeting"
                />
                <p className="text-xs text-muted-foreground">
                  Use this if the default greeting is too generic, like `Front` or `Info`.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sales-email-subject">Subject override</Label>
                <Input
                  id="sales-email-subject"
                  value={salesEmailSubjectOverride}
                  onChange={(e) => setSalesEmailSubjectOverride(e.target.value)}
                  placeholder="Leave blank to use the selected template subject"
                  data-testid="input-sales-email-subject"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sales-email-intro">Opening paragraph override</Label>
                <Textarea
                  id="sales-email-intro"
                  value={salesEmailIntroOverride}
                  onChange={(e) => setSalesEmailIntroOverride(e.target.value)}
                  placeholder="Customize the opening paragraph if you want a more specific message."
                  rows={4}
                  data-testid="textarea-sales-email-intro"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sales-email-promo-code">Promo code (optional)</Label>
                <Input
                  id="sales-email-promo-code"
                  value={salesEmailPromoCode}
                  onChange={(e) => setSalesEmailPromoCode(e.target.value)}
                  placeholder="TAILWINDS"
                  data-testid="input-sales-email-promo-code"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sales-email-promo-details">Offer details (optional)</Label>
                <Textarea
                  id="sales-email-promo-details"
                  value={salesEmailPromoDetails}
                  onChange={(e) => setSalesEmailPromoDetails(e.target.value)}
                  placeholder="Example: 20% off the first month or 3 free months for new listings."
                  rows={4}
                  data-testid="textarea-sales-email-promo-details"
                />
                <p className="text-xs text-muted-foreground">
                  Add any discount or limited-time details you want included in the email preview.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sales-email-note">Custom note (optional)</Label>
                <Textarea
                  id="sales-email-note"
                  value={salesEmailCustomNote}
                  onChange={(e) => setSalesEmailCustomNote(e.target.value)}
                  placeholder="Add a short custom note before the call to action."
                  rows={3}
                  data-testid="textarea-sales-email-note"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border bg-background">
                <div className="border-b px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Subject</div>
                  <div className="mt-1 text-sm font-medium">
                    {salesEmailPreviewLoading
                      ? "Loading preview..."
                      : salesEmailPreview?.subject || "No preview available"}
                  </div>
                </div>
                <div className="max-h-[460px] overflow-y-auto p-4">
                  {salesEmailPreviewLoading ? (
                    <div className="text-sm text-muted-foreground">Generating preview...</div>
                  ) : salesEmailPreviewError ? (
                    <div className="text-sm text-destructive">
                      {salesEmailPreviewError instanceof Error
                        ? salesEmailPreviewError.message
                        : "Unable to load preview."}
                    </div>
                  ) : salesEmailPreview ? (
                    <iframe
                      title="Sales email preview"
                      srcDoc={salesEmailPreview.html}
                      className="min-h-[420px] w-full rounded-md border bg-white"
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground">Select a lead to preview this email.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseSalesEmailDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!selectedSalesLead) return;
                sendLeadSalesEmailMutation.mutate({
                  id: selectedSalesLead.id,
                  templateType: salesEmailTemplateType,
                  greetingName: salesEmailGreetingName.trim() || undefined,
                  subjectOverride: salesEmailSubjectOverride.trim() || undefined,
                  introOverride: salesEmailIntroOverride.trim() || undefined,
                  customNote: salesEmailCustomNote.trim() || undefined,
                  promoCode: salesEmailPromoCode.trim() || undefined,
                  promoDetails: salesEmailPromoDetails.trim() || undefined,
                });
              }}
              disabled={
                !selectedSalesLead ||
                sendLeadSalesEmailMutation.isPending ||
                salesEmailPreviewLoading ||
                !!salesEmailPreviewError ||
                Boolean(selectedSalesLead?.marketingEmailOptOutAt)
              }
              data-testid="button-send-sales-email-confirm"
            >
              {sendLeadSalesEmailMutation.isPending ? "Sending..." : "Send Sales Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense Dialog */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-expense-form">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add New Expense"}</DialogTitle>
            <DialogDescription>
              {editingExpense ? "Update expense information" : "Track a new expense"}
            </DialogDescription>
          </DialogHeader>

          <Form {...expenseForm}>
            <form onSubmit={expenseForm.handleSubmit(handleSubmitExpense)} className="space-y-4">
              <FormField
                control={expenseForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-expense-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="server">Server</SelectItem>
                        <SelectItem value="database">Database</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={expenseForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount ($)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00"
                        data-testid="input-expense-amount" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={expenseForm.control}
                name="expenseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date"
                        value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                        onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : new Date())}
                        data-testid="input-expense-date" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Invoice Upload */}
              <FormItem>
                <FormLabel>Invoice (Optional)</FormLabel>
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setInvoiceFile(file);
                    }}
                    data-testid="input-invoice-file"
                  />
                  {invoiceFile && (
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm truncate">{invoiceFile.name}</span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleExtractInvoiceData}
                        disabled={extractingData}
                        data-testid="button-extract-invoice-data"
                      >
                        {extractingData ? "Extracting..." : "Auto-fill from invoice"}
                      </Button>
                    </div>
                  )}
                </div>
                <FormDescription>
                  Upload an invoice image or PDF. We'll automatically extract the amount, date, and description.
                </FormDescription>
              </FormItem>

              <FormField
                control={expenseForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        data-testid="textarea-expense-description"
                        placeholder="Add details about this expense..."
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setExpenseDialogOpen(false);
                    expenseForm.reset();
                    setEditingExpense(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createExpenseMutation.isPending || updateExpenseMutation.isPending}
                  data-testid="button-submit-expense"
                >
                  {createExpenseMutation.isPending || updateExpenseMutation.isPending ? "Saving..." : editingExpense ? "Update Expense" : "Add Expense"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Aircraft Detail Dialog */}
      <Dialog open={!!selectedAircraft} onOpenChange={(open) => !open && setSelectedAircraft(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aircraft Listing Details</DialogTitle>
            <DialogDescription>Review full aircraft listing information</DialogDescription>
          </DialogHeader>
          
          {selectedAircraft && (
            <div className="space-y-6">
              {/* Images */}
              {selectedAircraft.images && selectedAircraft.images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {selectedAircraft.images.slice(0, 6).map((img, i) => (
                    <div key={i} className="aspect-video rounded-lg overflow-hidden bg-muted">
                      <img src={img} alt={`Aircraft ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              {/* Basic Info */}
              <div>
                <h3 className="font-semibold text-lg mb-3">
                  {selectedAircraft.year} {selectedAircraft.make} {selectedAircraft.model}
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Registration:</span>{" "}
                    <span className="font-medium">{selectedAircraft.registration}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Location:</span>{" "}
                    <span className="font-medium">{selectedAircraft.location}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Hourly Rate:</span>{" "}
                    <span className="font-medium">${selectedAircraft.hourlyRate}/hr</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Time:</span>{" "}
                    <span className="font-medium">{selectedAircraft.totalTime} hrs</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Owner ID:</span>{" "}
                    <span className="font-medium">{selectedAircraft.ownerId}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>{" "}
                    <Badge variant={selectedAircraft.isListed ? "default" : "secondary"}>
                      {selectedAircraft.isListed ? "Listed" : "Unlisted"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedAircraft.description && (
                <div>
                  <h4 className="font-semibold mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">{selectedAircraft.description}</p>
                </div>
              )}

              {/* Certifications */}
              {selectedAircraft.requiredCertifications && selectedAircraft.requiredCertifications.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Required Certifications</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedAircraft.requiredCertifications.map((cert, i) => (
                      <Badge key={i} variant="outline">{cert}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Actions */}
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    toggleAircraftMutation.mutate({ id: selectedAircraft.id, isListed: !selectedAircraft.isListed });
                    setSelectedAircraft(null);
                  }}
                >
                  {selectedAircraft.isListed ? "Unlist" : "List"} Aircraft
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDeleteTarget({ type: 'aircraft', id: selectedAircraft.id });
                    setDeleteDialogOpen(true);
                    setSelectedAircraft(null);
                  }}
                >
                  Delete Listing
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Marketplace Detail Dialog */}
      <Dialog open={!!selectedMarketplace} onOpenChange={(open) => !open && setSelectedMarketplace(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Marketplace Listing Details</DialogTitle>
            <DialogDescription>Review full marketplace listing information</DialogDescription>
          </DialogHeader>
          
          {selectedMarketplace && (
            <div className="space-y-6">
              {/* Images */}
              {selectedMarketplace.images && selectedMarketplace.images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {selectedMarketplace.images.slice(0, 6).map((img, i) => (
                    <div key={i} className="aspect-video rounded-lg overflow-hidden bg-muted">
                      <img src={img} alt={`Listing ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              {/* Basic Info */}
              <div>
                <h3 className="font-semibold text-lg mb-3">{selectedMarketplace.title}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Category:</span>{" "}
                    <Badge variant="outline" className="ml-1">{selectedMarketplace.category}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Location:</span>{" "}
                    <span className="font-medium">{selectedMarketplace.location || "Not specified"}</span>
                  </div>
                  {selectedMarketplace.price && (
                    <div>
                      <span className="text-muted-foreground">Price:</span>{" "}
                      <span className="font-medium">${selectedMarketplace.price}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Monthly Fee:</span>{" "}
                    <span className="font-medium">
                      ${selectedMarketplace.monthlyFee}
                      {selectedMarketplace.monthlyFee === "0" && " (FREE)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">User ID:</span>{" "}
                    <span className="font-medium">{selectedMarketplace.userId}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>{" "}
                    <Badge variant={selectedMarketplace.isActive ? "default" : "secondary"}>
                      {selectedMarketplace.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {selectedMarketplace.isPaid && (
                    <div>
                      <span className="text-muted-foreground">Payment:</span>{" "}
                      <Badge variant="default">Paid</Badge>
                    </div>
                  )}
                  {selectedMarketplace.expiresAt && (
                    <div>
                      <span className="text-muted-foreground">Expires:</span>{" "}
                      <span className="font-medium">{new Date(selectedMarketplace.expiresAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              {selectedMarketplace.description && (
                <div>
                  <h4 className="font-semibold mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedMarketplace.description}</p>
                </div>
              )}

              {/* Contact Info */}
              {(selectedMarketplace.contactEmail || selectedMarketplace.contactPhone) && (
                <div>
                  <h4 className="font-semibold mb-2">Contact Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {selectedMarketplace.contactEmail && (
                      <div>
                        <span className="text-muted-foreground">Email:</span>{" "}
                        <span className="font-medium">{selectedMarketplace.contactEmail}</span>
                      </div>
                    )}
                    {selectedMarketplace.contactPhone && (
                      <div>
                        <span className="text-muted-foreground">Phone:</span>{" "}
                        <span className="font-medium">{selectedMarketplace.contactPhone}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Admin Actions */}
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    toggleMarketplaceMutation.mutate({ id: selectedMarketplace.id, isActive: !selectedMarketplace.isActive });
                    setSelectedMarketplace(null);
                  }}
                >
                  {selectedMarketplace.isActive ? "Deactivate" : "Activate"} Listing
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDeleteTarget({ type: 'marketplace', id: selectedMarketplace.id });
                    setDeleteDialogOpen(true);
                    setSelectedMarketplace(null);
                  }}
                >
                  Delete Listing
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Free Marketplace Listing Dialog */}
      <Dialog open={adminFreeListingDialogOpen} onOpenChange={setAdminFreeListingDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Free Marketplace Listing</DialogTitle>
            <DialogDescription>
              Issue a free listing grant and continue through the standard listing flow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-free-email">Advertiser email</Label>
              <Input
                id="admin-free-email"
                type="email"
                placeholder="pilot@example.com"
                value={adminFreeListingEmail}
                onChange={(e) => setAdminFreeListingEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                If this email belongs to an existing RSF user, leave the checkbox below off. If they do not have an RSF account yet, turn the checkbox on.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-free-user-id">User ID (optional)</Label>
              <Input
                id="admin-free-user-id"
                placeholder="user UUID"
                value={adminFreeListingUserId}
                onChange={(e) => setAdminFreeListingUserId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Provide this if you prefer user ID instead of email.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                checked={adminFreeListingAllowEmailOnly}
                onCheckedChange={(checked) => setAdminFreeListingAllowEmailOnly(Boolean(checked))}
                data-testid="checkbox-admin-free-email-only"
              />
              <div className="text-xs text-muted-foreground">
                Use this when the advertiser does not have an RSF account yet. The listing will be created under your admin account and the email above will be used as the public contact email.
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-free-duration">Duration (days)</Label>
              <Input
                id="admin-free-duration"
                type="number"
                min={1}
                max={90}
                value={adminFreeListingDurationDays}
                onChange={(e) => setAdminFreeListingDurationDays(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAdminFreeListingDurationDays("90")}
                >
                  Use 90-day promo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAdminFreeListingDurationDays("30")}
                >
                  30 days
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAdminFreeListingDialogOpen(false)}
              type="button"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const email = adminFreeListingEmail.trim();
                const userId = adminFreeListingUserId.trim();
                const durationDays = Number(adminFreeListingDurationDays || 90);
                if (!email && !userId) {
                  toast({
                    title: "Target user not set",
                    description: "Enter an email or user ID to create a listing for an advertiser.",
                  });
                  return;
                }
                adminFreeListingTokenMutation.mutate({
                  email: email || undefined,
                  userId: userId || undefined,
                  durationDays: Number.isFinite(durationDays) ? durationDays : 90,
                  allowEmailOnly: adminFreeListingAllowEmailOnly || undefined,
                });
              }}
              disabled={adminFreeListingTokenMutation.isPending}
              type="button"
            >
              {adminFreeListingTokenMutation.isPending ? "Preparing..." : "Start Free Listing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Listing Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Listing</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this {deleteTarget?.type === 'aircraft' ? 'aircraft' : 'marketplace'} listing? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteTarget(null);
              }}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteListing}
              disabled={deleteAircraftMutation.isPending || deleteMarketplaceMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteAircraftMutation.isPending || deleteMarketplaceMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Promo Alert Dialog */}
      <Dialog open={promoDialogOpen} onOpenChange={setPromoDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-create-promo">
          <DialogHeader>
            <DialogTitle>{editingPromo ? "Edit" : "Create"} Promotional Alert</DialogTitle>
            <DialogDescription>
              {editingPromo ? "Update" : "Create a new"} promotional banner or announcement for the marketplace
            </DialogDescription>
          </DialogHeader>
          <Form {...promoForm}>
            <form onSubmit={promoForm.handleSubmit((data) => createPromoAlertMutation.mutate(data))} className="space-y-4">
              <FormField
                control={promoForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Limited Time Offer!" {...field} data-testid="input-promo-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={promoForm.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Get your first listing free for 7 days!" 
                        {...field} 
                        data-testid="textarea-promo-message"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={promoForm.control}
                name="promoCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Promo Code (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="LAUNCH2025" 
                        {...field} 
                        value={field.value || ""}
                        data-testid="input-promo-code" 
                      />
                    </FormControl>
                    <FormDescription>Leave blank if no code needed</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={promoForm.control}
                  name="showOnMainPage"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox 
                          checked={field.value ?? false} 
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-show-main"
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer">Show on Main Page</FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={promoForm.control}
                  name="showOnCategoryPages"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox 
                          checked={field.value ?? false} 
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-show-category"
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer">Show on Category Pages</FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={promoForm.control}
                name="targetCategories"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Categories</FormLabel>
                    <div className="grid grid-cols-2 gap-3">
                      {["sale", "charter", "cfi", "flight-school", "mechanic", "job"].map((category) => (
                        <div key={category} className="flex items-center gap-2">
                          <Checkbox
                            checked={field.value?.includes(category)}
                            onCheckedChange={(checked) => {
                              const current = field.value || [];
                              if (checked) {
                                field.onChange([...current, category]);
                              } else {
                                field.onChange(current.filter((c: string) => c !== category));
                              }
                            }}
                            data-testid={`checkbox-category-${category}`}
                          />
                          <Label className="cursor-pointer capitalize">
                            {category === "cfi" ? "CFI" : category.replace("-", " ")}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <FormDescription>Leave all unchecked to show on all categories</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPromoDialogOpen(false);
                    setEditingPromo(null);
                    promoForm.reset();
                  }}
                  data-testid="button-cancel-create-promo"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createPromoAlertMutation.isPending}
                  data-testid="button-submit-promo"
                >
                  {createPromoAlertMutation.isPending ? "Creating..." : editingPromo ? "Update" : "Create"} Alert
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Banner Ad Dialog */}
      <Dialog 
        open={bannerDialogOpen} 
        onOpenChange={(open) => {
          setBannerDialogOpen(open);
          if (!open) {
            setEditingBanner(null);
            bannerForm.reset();
            setBannerImageUrl("");
            setBannerVideoUrl("");
          }
        }}
      >
        <DialogContent className="max-w-3xl p-0" data-testid="dialog-create-banner">
          <div className="flex flex-col max-h-[90vh]">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>{editingBanner ? "Edit" : "Create"} Live Banner Ad</DialogTitle>
              <DialogDescription>
                {editingBanner
                  ? "Admin override: You can edit all banner ad fields including creative content, scheduling, and status."
                  : "Banner admins can create a live banner ad without a paid order."}
              </DialogDescription>
            </DialogHeader>
            <Form {...bannerForm}>
              <form 
                onSubmit={bannerForm.handleSubmit((data) => {
                  const normalizedInstagram = normalizeSocialUrl(data.instagramUrl, "instagram");
                  const normalizedFacebook = normalizeSocialUrl(data.facebookUrl, "facebook");
                  // Use bannerImageUrl state if available (from upload), otherwise use form data
                  const payload = {
                    title: data.title,
                    description: data.description,
                    adCopy: data.adCopy,
                    imageUrl: bannerImageUrl || data.imageUrl,
                    videoUrl: bannerVideoUrl || data.videoUrl,
                    videoMuted: data.videoMuted ?? true,
                    videoOrientation: normalizeBannerVideoOrientation(data.videoOrientation),
                    link: data.link,
                    instagramUrl: normalizedInstagram,
                    facebookUrl: normalizedFacebook,
                    placements: data.placements,
                    category: data.category,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    isActive: data.isActive,
                  };

                  if (editingBanner) {
                    updateBannerAdMutation.mutate({ id: editingBanner.id, data: payload });
                    return;
                  }

                  if (!canAccess("banners")) {
                    toast({
                      title: "Error",
                      description: "Banner admin access is required to create live banner ads.",
                      variant: "destructive",
                    });
                    return;
                  }

                  if (!data.endDate) {
                    toast({
                      title: "End date required",
                      description: "Please select an end date to set the banner duration.",
                      variant: "destructive",
                    });
                    return;
                  }

                  createBannerAdMutation.mutate(payload);
                })} 
                className="flex flex-col flex-1 min-h-0"
              >
                <div className="flex-1 overflow-y-auto px-6 py-4 pb-28 space-y-4">
                  {/* Banner Creative */}
                  <div className="space-y-4 p-4 border rounded-md">
                    <h3 className="font-semibold text-sm">Banner Creative</h3>
                    
                    <FormField
                      control={bannerForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Banner Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Premium Aircraft Rentals" {...field} data-testid="input-banner-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={bannerForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tagline (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Fly with confidence" {...field} value={field.value ?? ""} data-testid="input-banner-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={bannerForm.control}
                      name="adCopy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ad Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Add 1–2 sentences about the offer or service..."
                              className="min-h-[110px]"
                              {...field}
                              value={field.value ?? ""}
                              data-testid="textarea-banner-ad-copy"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={bannerForm.control}
                      name="link"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Link URL (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com" {...field} value={field.value ?? ""} data-testid="input-banner-link" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={bannerForm.control}
                        name="instagramUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Instagram (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="@yourhandle or instagram.com/yourhandle"
                                {...field}
                                value={field.value ?? ""}
                                data-testid="input-banner-instagram"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={bannerForm.control}
                        name="facebookUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Facebook (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="facebook.com/yourpage"
                                {...field}
                                value={field.value ?? ""}
                                data-testid="input-banner-facebook"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={bannerForm.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Banner Image</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <Input 
                                placeholder="Image URL" 
                                {...field} 
                                value={field.value ?? ""}
                                data-testid="input-banner-image-url"
                              />
                              <ObjectUploader
                                onGetUploadParameters={handleBannerGetUploadParameters}
                                onComplete={handleBannerUploadComplete}
                                maxNumberOfFiles={1}
                              >
                                <div />
                              </ObjectUploader>
                              {(field.value || bannerImageUrl) && (
                                <img 
                                  src={resolveObjectUrl(field.value || bannerImageUrl)} 
                                  alt="Banner preview" 
                                  className="w-full h-32 object-cover rounded-md"
                                />
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={bannerForm.control}
                      name="videoUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Banner Video (Optional)</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <Input
                                placeholder="Video URL"
                                {...field}
                                value={field.value ?? ""}
                                data-testid="input-banner-video-url"
                              />
                              <ObjectUploader
                                onGetUploadParameters={handleBannerGetUploadParameters}
                                onComplete={handleBannerVideoUploadComplete}
                                maxNumberOfFiles={1}
                                maxFileSize={52428800}
                                allowedFileTypes={["video/*"]}
                                enableImageEditor={false}
                                buttonVariant="secondary"
                              >
                                Upload video
                              </ObjectUploader>
                              {(field.value || bannerVideoUrl) && (
                                <video
                                  src={resolveObjectUrl(field.value || bannerVideoUrl)}
                                  className={`w-full h-40 rounded-md ${
                                    (bannerForm.watch("videoOrientation") ?? "landscape") === "portrait"
                                      ? "object-contain bg-muted"
                                      : "object-cover"
                                  }`}
                                  muted={bannerForm.watch("videoMuted") ?? true}
                                  controls
                                  playsInline
                                  data-testid="preview-banner-video"
                                />
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={bannerForm.control}
                      name="videoMuted"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value ?? true}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-banner-video-muted"
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer font-normal">Mute video by default</FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={bannerForm.control}
                      name="videoOrientation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Video orientation</FormLabel>
                          <FormControl>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || "landscape"}
                            >
                              <SelectTrigger data-testid="select-banner-video-orientation">
                                <SelectValue placeholder="Select orientation" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="landscape">Landscape (16:9)</SelectItem>
                                <SelectItem value="portrait">Portrait (9:16)</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription>
                            Controls how the video fits inside the banner without changing overall size.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Placement & Category */}
                  <div className="space-y-4 p-4 border rounded-md">
                    <h3 className="font-semibold text-sm">Banner Placement</h3>
                    
                    <FormField
                      control={bannerForm.control}
                      name="placements"
                      render={() => (
                        <FormItem>
                          <FormLabel>Display On</FormLabel>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                            { value: 'home', label: 'Homepage' },
                            { value: 'student-hub', label: 'Student Hub' },
                            { value: 'pilot-tools', label: 'Pilot Tools' },
                            { value: 'cfi-directory', label: 'CFI Directory' },
                            { value: 'rentals', label: 'Aircraft Rentals' },
                            { value: 'marketplace', label: 'Marketplace Hub' },
                            { value: 'aircraft-sale', label: 'Aircraft for Sale' },
                            { value: 'jobs', label: 'Aviation Jobs' },
                            { value: 'cfi', label: 'CFI Services' },
                            { value: 'flight-school', label: 'Flight Schools' },
                            { value: 'mechanic', label: 'Mechanic Services' },
                            { value: 'charter', label: 'Charter Services' },
                            ].map((placement) => (
                              <FormField
                                key={placement.value}
                                control={bannerForm.control}
                                name="placements"
                                render={({ field }) => (
                                  <FormItem className="flex items-center gap-2 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(placement.value as any) ?? false}
                                        onCheckedChange={(checked) => {
                                          const current = field.value || [];
                                          const updated = checked
                                            ? [...current, placement.value]
                                            : current.filter((v) => v !== placement.value);
                                          field.onChange(updated);
                                        }}
                                        data-testid={`checkbox-banner-placement-${placement.value}`}
                                      />
                                    </FormControl>
                                    <FormLabel className="cursor-pointer font-normal">{placement.label}</FormLabel>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Scheduling & Status */}
                  <div className="space-y-4 p-4 border rounded-md">
                    <h3 className="font-semibold text-sm">Scheduling & Status</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={bannerForm.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date</FormLabel>
                            <FormControl>
                              <Input 
                                type="date" 
                                value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : (typeof field.value === 'string' ? (field.value as string).split('T')[0] : '')}
                                onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                                data-testid="input-banner-start-date"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={bannerForm.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Date</FormLabel>
                            <FormControl>
                              <Input 
                                type="date" 
                                value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : (typeof field.value === 'string' ? (field.value as string).split('T')[0] : '')}
                                onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                                data-testid="input-banner-end-date"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {(() => {
                      const startDate = bannerForm.getValues("startDate");
                      const endDate = bannerForm.getValues("endDate");
                      const durationDays = getBannerDurationDays(
                        startDate instanceof Date ? startDate : startDate ? new Date(startDate) : undefined,
                        endDate instanceof Date ? endDate : endDate ? new Date(endDate) : undefined
                      );
                      if (!durationDays) return null;
                      return (
                        <p className="text-xs text-muted-foreground">
                          Duration: {durationDays} day{durationDays === 1 ? "" : "s"}
                        </p>
                      );
                    })()}
                    
                    <FormField
                      control={bannerForm.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl>
                            <Checkbox 
                              checked={field.value ?? false} 
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-banner-active"
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer">Active (show banner immediately)</FormLabel>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <DialogFooter className="px-6 pb-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setBannerDialogOpen(false);
                      setEditingBanner(null);
                      bannerForm.reset();
                      setBannerImageUrl("");
                      setBannerVideoUrl("");
                    }}
                    data-testid="button-cancel-edit-banner"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateBannerAdMutation.isPending || createBannerAdMutation.isPending}
                    data-testid="button-submit-edit-banner"
                  >
                    {editingBanner
                      ? updateBannerAdMutation.isPending
                        ? "Updating..."
                        : "Update Banner Ad"
                      : createBannerAdMutation.isPending
                      ? "Creating..."
                      : "Create Live Banner"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Banner Ad Order Dialog */}
      <Dialog 
        open={orderDialogOpen} 
        onOpenChange={(open) => {
          setOrderDialogOpen(open);
          if (!open) {
            setEditingOrder(null);
            orderForm.reset();
            // Reset promo code state
            setPromoCodeInput("");
            setPromoCodeValid(null);
            setPromoCodeMessage("");
            setAppliedPromoCode(null);
            setOrderImageUrl("");
            setOrderVideoUrl("");
          }
        }}
      >
        <DialogContent className="max-w-3xl p-0" data-testid="dialog-create-order">
          <div className="flex flex-col max-h-[90vh]">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>{editingOrder ? "Edit" : "Create"} Banner Ad Order</DialogTitle>
              <DialogDescription>
                {editingOrder ? "Update" : "Create a new"} banner ad order for sponsor billing and activation
              </DialogDescription>
            </DialogHeader>
            <Form {...orderForm}>
              <form 
                onSubmit={orderForm.handleSubmit((data) => {
                  // Validate required fields
                  if (!data.placements || data.placements.length === 0) {
                    toast({
                      title: "Validation Error",
                      description: "Please select at least one page for banner placement",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Ensure imageUrl from state is included (fallback if form field is empty)
                  const submissionData = {
                    ...data,
                    imageUrl: data.imageUrl || orderImageUrl,
                    videoUrl: data.videoUrl || orderVideoUrl,
                    videoMuted: data.videoMuted ?? true,
                    videoOrientation: data.videoOrientation ?? "landscape",
                  };
                  
                  if (editingOrder) {
                    updateOrderMutation.mutate({ id: editingOrder.id, data: submissionData });
                  } else {
                    createOrderMutation.mutate(submissionData);
                  }
                })} 
                className="flex flex-col flex-1 min-h-0"
              >
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Sponsor Information Section */}
              <div className="space-y-4 p-4 border rounded-md">
                <h3 className="font-semibold text-sm">Sponsor Information</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={orderForm.control}
                    name="sponsorName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sponsor Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} data-testid="input-order-sponsor-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={orderForm.control}
                    name="sponsorEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sponsor Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="sponsor@example.com" {...field} data-testid="input-order-sponsor-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={orderForm.control}
                  name="sponsorCompany"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Aviation Corp" {...field} value={field.value ?? ""} data-testid="input-order-sponsor-company" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Banner Creative Section */}
              <div className="space-y-4 p-4 border rounded-md">
                <h3 className="font-semibold text-sm">Banner Creative</h3>
                
                <FormField
                  control={orderForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banner Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Premium Aircraft Rentals" {...field} data-testid="input-order-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={orderForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tagline (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Fly with confidence" {...field} value={field.value ?? ""} data-testid="input-order-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={orderForm.control}
                  name="adCopy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ad Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add 1–2 sentences about the offer or service..."
                          className="min-h-[110px]"
                          {...field}
                          value={field.value ?? ""}
                          data-testid="textarea-order-ad-copy"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={orderForm.control}
                  name="link"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Link URL (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com" {...field} value={field.value ?? ""} data-testid="input-order-link" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={orderForm.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banner Image</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Input 
                            placeholder="Image URL" 
                            {...field} 
                            value={field.value ?? ""}
                            data-testid="input-order-image-url"
                          />
                          <ObjectUploader
                            onGetUploadParameters={handleOrderGetUploadParameters}
                            onComplete={handleOrderUploadComplete}
                            maxNumberOfFiles={1}
                          >
                            Upload Image
                          </ObjectUploader>
                          {orderImageUrl && (
                            <img 
                              src={resolveObjectUrl(orderImageUrl)} 
                              alt="Banner preview" 
                              className="w-full h-32 object-cover rounded-md"
                            />
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={orderForm.control}
                  name="videoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banner Video (Optional)</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Input
                            placeholder="Video URL"
                            {...field}
                            value={field.value ?? ""}
                            data-testid="input-order-video-url"
                          />
                          <ObjectUploader
                            onGetUploadParameters={handleOrderGetUploadParameters}
                            onComplete={handleOrderVideoUploadComplete}
                            maxNumberOfFiles={1}
                            maxFileSize={52428800}
                            allowedFileTypes={["video/*"]}
                            enableImageEditor={false}
                            buttonVariant="secondary"
                          >
                            Upload Video
                          </ObjectUploader>
                          {(field.value || orderVideoUrl) && (
                            <video
                              src={resolveObjectUrl(field.value || orderVideoUrl)}
                              className={`w-full h-40 rounded-md ${
                                (orderForm.watch("videoOrientation") ?? "landscape") === "portrait"
                                  ? "object-contain bg-muted"
                                  : "object-cover"
                              }`}
                              muted={orderForm.watch("videoMuted") ?? true}
                              controls
                              playsInline
                              data-testid="preview-order-video"
                            />
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                  <FormField
                    control={orderForm.control}
                    name="videoMuted"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value ?? true}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-order-video-muted"
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer font-normal">Mute video by default</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              {/* Placement & Category Section */}
              <div className="space-y-4 p-4 border rounded-md">
                <h3 className="font-semibold text-sm">Banner Placement</h3>
                
                <FormField
                  control={orderForm.control}
                  name="placements"
                  render={() => (
                    <FormItem>
                      <FormLabel>Display On</FormLabel>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'home', label: 'Homepage (Landing Page)' },
                          { value: 'student-hub', label: 'Student Hub' },
                          { value: 'pilot-tools', label: 'Pilot Tools' },
                          { value: 'cfi-directory', label: 'CFI Directory (Non-marketplace)' },
                          { value: 'rentals', label: 'Aircraft Rentals Page' },
                          { value: 'marketplace', label: 'Marketplace Hub' },
                          { value: 'aircraft-sale', label: 'Aircraft for Sale' },
                          { value: 'jobs', label: 'Aviation Jobs' },
                          { value: 'cfi', label: 'CFI Services' },
                          { value: 'flight-school', label: 'Flight Schools' },
                          { value: 'mechanic', label: 'Mechanic Services' },
                          { value: 'charter', label: 'Charter Services' },
                        ].map((placement) => (
                          <FormField
                            key={placement.value}
                            control={orderForm.control}
                            name="placements"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(placement.value as any) ?? false}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || [];
                                      const updated = checked
                                        ? [...current, placement.value]
                                        : current.filter((v) => v !== placement.value);
                                      field.onChange(updated);
                                    }}
                                    data-testid={`checkbox-order-placement-${placement.value}`}
                                  />
                                </FormControl>
                                <FormLabel className="cursor-pointer font-normal">{placement.label}</FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

                  {/* Scheduling Section */}
                  <div className="space-y-4 p-4 border rounded-md">
                    <h3 className="font-semibold text-sm">Campaign Duration</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={orderForm.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                value={formatDateInputValue(field.value)}
                                onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                                data-testid="input-order-start-date"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={orderForm.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                value={formatDateInputValue(field.value)}
                                onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                                data-testid="input-order-end-date"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {(() => {
                      const startDate = orderForm.getValues("startDate");
                      const endDate = orderForm.getValues("endDate");
                      const durationDays = getBannerDurationDays(
                        startDate instanceof Date ? startDate : startDate ? new Date(startDate) : undefined,
                        endDate instanceof Date ? endDate : endDate ? new Date(endDate) : undefined
                      );
                      if (!durationDays) return null;
                      return (
                        <p className="text-xs text-muted-foreground">
                          Duration: {durationDays} day{durationDays === 1 ? "" : "s"}
                        </p>
                      );
                    })()}
                  </div>

              {/* Pricing Tier Section */}
              <div className="space-y-4 p-4 border rounded-md">
                <h3 className="font-semibold text-sm">Pricing & Billing</h3>
                
                <FormField
                  control={orderForm.control}
                  name="tier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Tier</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                          onChange={(e) => {
                            field.onChange(e);
                            const selectedTier = e.target.value as BannerAdTier;
                            setSelectedTier(selectedTier);
                            
                            // Reset promo code state when tier changes
                            setPromoCodeInput("");
                            setPromoCodeValid(null);
                            setPromoCodeMessage("");
                            setAppliedPromoCode(null);
                            
                            // Calculate base pricing (without promo)
                            const pricing = calculateBannerAdPricing(selectedTier);
                            orderForm.setValue('monthlyRate', pricing.monthlyRate.toString());
                            orderForm.setValue('totalAmount', pricing.subscriptionTotal.toString());
                            orderForm.setValue('creationFee', pricing.creationFee.toString());
                            orderForm.setValue('grandTotal', pricing.grandTotal.toString());
                            orderForm.setValue('promoCode', "");
                            orderForm.setValue('discountAmount', "0.00");
                          }}
                          data-testid="select-order-tier"
                        >
                          <option value="1month">1 Month - $75/mo</option>
                          <option value="3months">3 Months - $60/mo (Most Popular)</option>
                          <option value="6months">6 Months - $50/mo (Best Value)</option>
                          <option value="12months">12 Months - $45/mo</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Promo Code Section */}
                <div className="space-y-2">
                  <Label>Promo Code (Optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter promo code"
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                      data-testid="input-order-promo-code"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleApplyPromoCode}
                      data-testid="button-apply-promo-code"
                    >
                      Apply
                    </Button>
                  </div>
                  {promoCodeValid === false && (
                    <p className="text-sm text-destructive" data-testid="text-promo-error">
                      {promoCodeMessage}
                    </p>
                  )}
                  {promoCodeValid === true && (
                    <p className="text-sm text-green-600 flex items-center gap-1" data-testid="text-promo-success">
                      <CheckCircle className="h-4 w-4" />
                      {promoCodeMessage}
                    </p>
                  )}
                </div>
                
                {/* Pricing Summary */}
                <div className="bg-muted p-4 rounded-md space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Monthly Rate:</span>
                    <span className="font-semibold">${orderForm.watch('monthlyRate')}/mo</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Subscription ({selectedTier === '1month' ? '1' : selectedTier === '3months' ? '3' : selectedTier === '6months' ? '6' : '12'} months):</span>
                    <span className="font-semibold">${orderForm.watch('totalAmount')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>One-time creation fee:</span>
                    <span className="font-semibold">${orderForm.watch('creationFee')}</span>
                  </div>
                  
                  {/* Discount line items (shown when promo is applied) */}
                  {appliedPromoCode && parseFloat(orderForm.watch('discountAmount') || "0") > 0 && (
                    <>
                      <div className="border-t pt-2 space-y-2">
                        {(() => {
                          const basePricing = calculateBannerAdPricing(selectedTier);
                          const discounts = calculatePromoDiscount(
                            basePricing.creationFee,
                            basePricing.subscriptionTotal,
                            appliedPromoCode
                          );
                          
                          return (
                            <>
                              {discounts.creationFeeDiscount > 0 && (
                                <div className="flex justify-between text-green-600">
                                  <span>Creation fee discount:</span>
                                  <span>-${discounts.creationFeeDiscount.toFixed(2)}</span>
                                </div>
                              )}
                              {discounts.subscriptionDiscount > 0 && (
                                <div className="flex justify-between text-green-600">
                                  <span>Subscription discount (20%):</span>
                                  <span>-${discounts.subscriptionDiscount.toFixed(2)}</span>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </>
                  )}
                  
                  <div className="flex justify-between border-t pt-2 mt-2">
                    <span className="font-bold">Due Today:</span>
                    <span className="font-bold text-lg">${orderForm.watch('grandTotal')}</span>
                  </div>
                </div>
              </div>

              {/* Admin Notes */}
              <FormField
                control={orderForm.control}
                name="adminNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin Notes (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Internal notes" {...field} value={field.value ?? ""} data-testid="input-order-admin-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
                </div>
                
                <DialogFooter className="border-t bg-background px-6 py-4 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setOrderDialogOpen(false);
                      setEditingOrder(null);
                      orderForm.reset();
                      setOrderImageUrl("");
                      setOrderVideoUrl("");
                    }}
                    data-testid="button-cancel-create-order"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createOrderMutation.isPending || updateOrderMutation.isPending}
                    data-testid="button-submit-order"
                  >
                    {createOrderMutation.isPending || updateOrderMutation.isPending 
                      ? "Saving..." 
                      : editingOrder 
                      ? "Update Order" 
                      : "Create Order"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Promo Code Dialog */}
      <Dialog 
        open={promoCodeDialogOpen} 
        onOpenChange={(open) => {
          setPromoCodeDialogOpen(open);
          if (!open) {
            setEditingPromoCode(null);
            promoCodeForm.reset();
          }
        }}
      >
        <DialogContent className="max-w-2xl p-0" data-testid="dialog-create-promo-code">
          <div className="flex flex-col max-h-[90vh]">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>{editingPromoCode ? "Edit" : "Create"} Promo Code</DialogTitle>
              <DialogDescription>
                {editingPromoCode ? "Update" : "Create a new"} promotional discount code for marketplace listings or banner ads
              </DialogDescription>
            </DialogHeader>
            <Form {...promoCodeForm}>
              <form 
                onSubmit={promoCodeForm.handleSubmit((data) => {
                  // Transform code to uppercase and remove spaces
                  const transformedData = {
                    ...data,
                    code: data.code.toUpperCase().replace(/\s+/g, ''),
                  };
                  
                  if (editingPromoCode) {
                    updatePromoCodeMutation.mutate({ id: editingPromoCode.id, data: transformedData });
                  } else {
                    createPromoCodeMutation.mutate(transformedData);
                  }
                })} 
                className="flex flex-col flex-1 min-h-0"
              >
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {/* Code Field */}
                  <FormField
                    control={promoCodeForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="LAUNCH2025" 
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                            data-testid="input-promo-code-code"
                          />
                        </FormControl>
                        <FormDescription>Uppercase letters and numbers only, no spaces</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={orderForm.control}
                    name="videoOrientation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Video orientation</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || "landscape"}
                          >
                            <SelectTrigger data-testid="select-order-video-orientation">
                              <SelectValue placeholder="Select orientation" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="landscape">Landscape (16:9)</SelectItem>
                              <SelectItem value="portrait">Portrait (9:16)</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormDescription>
                          Choose portrait when the sponsor provides a vertical video.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Description Field */}
                  <FormField
                    control={promoCodeForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Launch promotion for new users" 
                            {...field}
                            rows={3}
                            data-testid="textarea-promo-code-description"
                          />
                        </FormControl>
                        <FormDescription>Internal description for this promo code</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Discount Type and Value */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={promoCodeForm.control}
                      name="discountType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-promo-code-discount-type">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="percentage">Percentage (%)</SelectItem>
                              <SelectItem value="fixed_amount">Fixed Amount ($)</SelectItem>
                              <SelectItem value="waive_creation_fee">Waive Creation Fee</SelectItem>
                              <SelectItem value="free_7_day">Free 7-Day Promo</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={promoCodeForm.control}
                      name="discountValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount Value</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              step="0.01"
                              placeholder={
                                promoCodeForm.watch('discountType') === 'percentage'
                                  ? '10'
                                  : promoCodeForm.watch('discountType') === 'fixed_amount'
                                    ? '5.00'
                                    : 'Optional'
                              }
                              {...field}
                              data-testid="input-promo-code-discount-value"
                            />
                          </FormControl>
                          <FormDescription>
                            {promoCodeForm.watch('discountType') === 'percentage'
                              ? 'Percentage (0-100)'
                              : promoCodeForm.watch('discountType') === 'fixed_amount'
                                ? 'Dollar amount'
                                : 'Not required for waive creation fee or free 7-day promos'}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Max Uses */}
                  <FormField
                    control={promoCodeForm.control}
                    name="maxUses"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Uses</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            placeholder="Unlimited"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            data-testid="input-promo-code-max-uses"
                          />
                        </FormControl>
                        <FormDescription>Leave empty for unlimited uses</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Valid From and Valid To */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={promoCodeForm.control}
                      name="validFrom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valid From</FormLabel>
                          <FormControl>
                            <Input 
                              type="date"
                              value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : (typeof field.value === 'string' ? (field.value as string).split('T')[0] : '')}
                              onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : new Date())}
                              data-testid="input-promo-code-valid-from"
                            />
                          </FormControl>
                          <FormDescription>Start date</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={promoCodeForm.control}
                      name="validUntil"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valid Until</FormLabel>
                          <FormControl>
                            <Input 
                              type="date"
                              value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : (typeof field.value === 'string' ? (field.value as string).split('T')[0] : '')}
                              onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                              data-testid="input-promo-code-valid-until"
                            />
                          </FormControl>
                          <FormDescription>Leave empty for no expiration</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Active Status */}
                  <FormField
                    control={promoCodeForm.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox 
                            checked={field.value ?? true} 
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-promo-code-active"
                          />
                        </FormControl>
                        <FormLabel className="cursor-pointer">Active (code can be used immediately)</FormLabel>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Applies To Section */}
                  <div className="space-y-3 p-4 border rounded-md">
                    <h3 className="font-semibold text-sm">Applies To</h3>
                    <div className="space-y-2">
                      <FormField
                        control={promoCodeForm.control}
                        name="applicableToBannerAds"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2 space-y-0">
                            <FormControl>
                              <Checkbox 
                                checked={field.value ?? false} 
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-promo-code-banner-ads"
                              />
                            </FormControl>
                            <FormLabel className="cursor-pointer">Banner Ads</FormLabel>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={promoCodeForm.control}
                        name="applicableToMarketplace"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2 space-y-0">
                            <FormControl>
                              <Checkbox 
                                checked={field.value ?? true} 
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-promo-code-marketplace"
                              />
                            </FormControl>
                            <FormLabel className="cursor-pointer">Marketplace Listings</FormLabel>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormDescription>Select where this promo code can be applied</FormDescription>
                  </div>
                </div>
                
                <DialogFooter className="sticky bottom-0 z-10 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/85">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPromoCodeDialogOpen(false);
                      setEditingPromoCode(null);
                      promoCodeForm.reset();
                    }}
                    data-testid="button-cancel-promo-code"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createPromoCodeMutation.isPending || updatePromoCodeMutation.isPending}
                    data-testid="button-submit-promo-code"
                  >
                    {createPromoCodeMutation.isPending || updatePromoCodeMutation.isPending
                      ? "Saving..." 
                      : editingPromoCode 
                      ? "Update Code" 
                      : "Create Code"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin User Management Modal */}
      <AdminUserModal
        userId={selectedUserId}
        open={userModalOpen}
        onOpenChange={(open) => {
          setUserModalOpen(open);
          if (!open) setSelectedUserId(null);
        }}
      />
    </div>
  );
}


