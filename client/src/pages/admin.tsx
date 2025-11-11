import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search, Users, Plane, List, Shield, CheckCircle, XCircle, Eye, TrendingUp, DollarSign, Activity, Calendar, UserPlus, Briefcase, Phone, Mail, Plus, Edit, Trash2, AlertTriangle, FileText, Gift, RefreshCw, Clock, Bell, Image, Upload, X, Rocket } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { insertCrmLeadSchema, insertExpenseSchema, insertPromoAlertSchema, insertBannerAdSchema, insertBannerAdOrderSchema, type User, type AircraftListing, type MarketplaceListing, type VerificationSubmission, type CrmLead, type InsertCrmLead, type Expense, type InsertExpense, type PromoAlert, type InsertPromoAlert, type AdminNotification, type BannerAd, type InsertBannerAd, type BannerAdOrder, type InsertBannerAdOrder } from "@shared/schema";
import { BANNER_AD_TIERS, calculateBannerAdPricing, type BannerAdTier } from "@shared/config/bannerPricing";
import { validatePromoCode, calculatePromoDiscount } from "@shared/config/promoCodes";
import { AdminUserModal } from "@/components/admin-user-modal";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from "@uppy/core";

export default function AdminDashboard() {
  const [userSearch, setUserSearch] = useState("");
  const [activeTab, setActiveTab] = useState("analytics");
  const [selectedSubmission, setSelectedSubmission] = useState<VerificationSubmission | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  
  // CRM state
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);
  
  // Expense management state
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  
  // Listing management state
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftListing | null>(null);
  const [selectedMarketplace, setSelectedMarketplace] = useState<MarketplaceListing | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'aircraft' | 'marketplace'; id: string } | null>(null);
  
  // Promo alerts state
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoAlert | null>(null);
  
  // Banner ads state
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerAd | null>(null);
  const [bannerImageUrl, setBannerImageUrl] = useState<string>("");
  
  // Banner ad orders state
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<BannerAdOrder | null>(null);
  const [selectedTier, setSelectedTier] = useState<BannerAdTier>("3months");
  const [orderImageUrl, setOrderImageUrl] = useState<string>("");
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
  
  // Banner ad form with Zod validation
  const bannerForm = useForm<InsertBannerAd>({
    resolver: zodResolver(insertBannerAdSchema),
    defaultValues: {
      title: "",
      description: "",
      imageUrl: "",
      link: "",
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
      imageUrl: "",
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
    },
  });
  
  const { toast } = useToast();

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
    enabled: activeTab === "analytics",
  });

  // CRM Leads query
  const { data: leads = [], isLoading: leadsLoading } = useQuery<CrmLead[]>({
    queryKey: ["/api/crm/leads"],
    enabled: activeTab === "crm",
  });

  // Expenses query
  const { data: expenses = [], isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/admin/expenses"],
    enabled: activeTab === "analytics",
  });

  // Promo alerts query (admin endpoint fetches all, including disabled)
  const { data: promoAlerts = [], isLoading: promoAlertsLoading } = useQuery<PromoAlert[]>({
    queryKey: ["/api/admin/promo-alerts"],
    enabled: activeTab === "promo",
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

  // Banner ad orders query
  const { data: bannerOrders = [], isLoading: ordersLoading } = useQuery<BannerAdOrder[]>({
    queryKey: ["/api/admin/banner-ad-orders"],
    enabled: activeTab === "banners",
  });

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

  // Banner image upload handlers
  const handleBannerGetUploadParameters = async () => {
    const response = await fetch('/api/objects/upload', {
      method: 'POST',
      credentials: 'include',
    });
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
          const parsedUrl = new URL(file.uploadURL);
          const objectPath = parsedUrl.pathname.slice(1); // Remove leading slash
          
          await fetch('/api/objects/set-acl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              path: objectPath,
              access: 'publicRead', // Banner images need to be publicly accessible
            }),
          });
          
          // Update form field with the uploaded URL
          const imageUrl = file.uploadURL.split('?')[0]; // Remove query params
          setBannerImageUrl(imageUrl);
          bannerForm.setValue('imageUrl', imageUrl);
          
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

  // Order image upload handlers
  const handleOrderGetUploadParameters = async () => {
    const response = await fetch('/api/objects/upload', {
      method: 'POST',
      credentials: 'include',
    });
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
          const parsedUrl = new URL(file.uploadURL);
          const objectPath = parsedUrl.pathname.slice(1); // Remove leading slash
          
          await fetch('/api/objects/set-acl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              path: objectPath,
              access: 'publicRead', // Order banner images need to be publicly accessible
            }),
          });
          
          // Update form field with the uploaded URL
          const imageUrl = file.uploadURL.split('?')[0]; // Remove query params
          setOrderImageUrl(imageUrl);
          orderForm.setValue('imageUrl', imageUrl);
          
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
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to activate order",
        variant: "destructive" 
      });
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
      notes: lead.notes || "",
    });
    setLeadDialogOpen(true);
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
        
        const response = await fetch('/api/upload-documents', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          toast({ 
            title: "Invoice upload failed", 
            description: errorData.error || "Please try again",
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
      
      const response = await fetch('/api/admin/extract-invoice-data', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract data');
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-11 h-auto">
          <TabsTrigger value="analytics" data-testid="tab-analytics" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span>Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="crm" data-testid="tab-crm" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
            <Briefcase className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span>CRM</span>
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
            <Users className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span>Users</span>
          </TabsTrigger>
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
          <TabsTrigger value="aircraft" data-testid="tab-aircraft" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
            <Plane className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span>Aircraft</span>
          </TabsTrigger>
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
          <TabsTrigger value="stale" data-testid="tab-stale" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span>Stale</span>
          </TabsTrigger>
          <TabsTrigger value="promo" data-testid="tab-promo" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
            <Gift className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span>Promos</span>
          </TabsTrigger>
          <TabsTrigger value="withdrawals" data-testid="tab-withdrawals" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span>Payouts</span>
          </TabsTrigger>
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
          <TabsTrigger value="banners" data-testid="tab-banners" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
            <Image className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span>Banners</span>
          </TabsTrigger>
        </TabsList>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Revenue Cards */}
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

          {/* Expense Cards */}
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

          {/* Profit Cards */}
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

          {/* Expense Management */}
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
                            {expense.expenseDate ? new Date(expense.expenseDate).toLocaleDateString() : '—'}
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
                                href={expense.invoiceUrl} 
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

          {analyticsLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
          )}
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
              {leadsLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  Loading leads...
                </div>
              )}

              {!leadsLoading && leads.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No leads yet. Add your first lead to get started.
                </div>
              )}

              {!leadsLoading && leads.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium text-sm">Name</th>
                        <th className="text-left p-3 font-medium text-sm">Email</th>
                        <th className="text-left p-3 font-medium text-sm">Company</th>
                        <th className="text-left p-3 font-medium text-sm">Status</th>
                        <th className="text-left p-3 font-medium text-sm">Source</th>
                        <th className="text-right p-3 font-medium text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((lead) => (
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
                <div className="text-2xl font-bold">{leads.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New Leads</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{leads.filter(l => l.status === "new").length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Won</CardTitle>
                <CheckCircle className="h-4 w-4 text-chart-2" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{leads.filter(l => l.status === "won").length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {leads.filter(l => ["contacted", "qualified", "proposal", "negotiation"].includes(l.status)).length}
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
                              ID: {user.id} • Flight Hours: {user.totalFlightHours}
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
            <CardHeader>
              <CardTitle>All Marketplace Listings</CardTitle>
              <CardDescription>View and manage all marketplace listings</CardDescription>
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
                                          {aircraft.make} {aircraft.model} - {aircraft.tailNumber}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">{aircraft.location}</p>
                                        {aircraft.lastRefreshedAt && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            Last refreshed: {new Date(aircraft.lastRefreshedAt).toLocaleDateString()}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant={aircraft.isActive ? "default" : "secondary"}>
                                          {aircraft.isActive ? "Active" : "Inactive"}
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
                                          {aircraft.make} {aircraft.model} - {aircraft.tailNumber}
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
                            <p><span className="text-muted-foreground">PayPal Email:</span> {withdrawal.paypalEmail}</p>
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
                                src={order.imageUrl} 
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
                                  <span className="font-medium">Description:</span> {order.description}
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
                            {/* Activate button - only show for paid approved orders */}
                            {order.paymentStatus === 'paid' && order.approvalStatus === 'approved' && (
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
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingOrder(order);
                                setOrderImageUrl(order.imageUrl ?? "");
                                setSelectedTier(order.tier);
                                
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
                                  imageUrl: order.imageUrl ?? "",
                                  link: order.link ?? "",
                                  placements: order.placements ?? [],
                                  category: order.category ?? undefined,
                                  tier: order.tier,
                                  monthlyRate: order.monthlyRate,
                                  totalAmount: order.totalAmount,
                                  creationFee: order.creationFee,
                                  promoCode: order.promoCode ?? "",
                                  discountAmount: order.discountAmount ?? "0.00",
                                  grandTotal: order.grandTotal,
                                  approvalStatus: order.approvalStatus,
                                  paymentStatus: order.paymentStatus,
                                  adminNotes: order.adminNotes ?? "",
                                });
                                setOrderDialogOpen(true);
                              }}
                              data-testid={`button-edit-order-${order.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
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
                  Manage active banner campaigns on homepage and category pages
                </CardDescription>
              </div>
              <Button 
                onClick={() => {
                  setEditingBanner(null);
                  setBannerImageUrl(""); // Reset image state
                  bannerForm.reset();
                  setBannerDialogOpen(true);
                }}
                data-testid="button-create-banner"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Banner Ad
              </Button>
            </CardHeader>
            <CardContent>
              {bannerAdsLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading banner ads...</p>
                </div>
              ) : bannerAds.length === 0 ? (
                <div className="text-center py-12">
                  <Image className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Banner Ads Yet</h3>
                  <p className="text-muted-foreground max-w-md mx-auto mb-4">
                    Create sponsored banner ads to promote listings on the homepage and category pages.
                  </p>
                  <Button 
                    onClick={() => {
                      setEditingBanner(null);
                      setBannerImageUrl(""); // Reset image state
                      bannerForm.reset();
                      setBannerDialogOpen(true);
                    }}
                    data-testid="button-create-first-banner"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Banner Ad
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {bannerAds.map((banner) => (
                    <Card key={banner.id} data-testid={`banner-card-${banner.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Banner Image Preview */}
                          {banner.imageUrl && (
                            <div className="w-32 h-20 rounded overflow-hidden flex-shrink-0 bg-muted">
                              <img 
                                src={banner.imageUrl} 
                                alt={banner.title}
                                className="w-full h-full object-cover"
                              />
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
                              {banner.link && (
                                <p className="truncate">
                                  <span className="font-medium">Link URL:</span> {banner.link}
                                </p>
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
                                setBannerImageUrl(banner.imageUrl); // Populate image preview
                                bannerForm.reset({
                                  title: banner.title,
                                  imageUrl: banner.imageUrl,
                                  link: banner.link ?? "",
                                  description: banner.description ?? "",
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
        </TabsContent>
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
          }
        }}
      >
        <DialogContent className="max-w-2xl" data-testid="dialog-create-banner">
          <DialogHeader>
            <DialogTitle>{editingBanner ? "Edit" : "Create"} Banner Ad</DialogTitle>
            <DialogDescription>
              {editingBanner ? "Update" : "Create a new"} sponsored banner ad for homepage or category pages
            </DialogDescription>
          </DialogHeader>
          <Form {...bannerForm}>
            <form 
              onSubmit={bannerForm.handleSubmit((data) => {
                console.log('Form submitted with data:', data);
                console.log('Form errors:', bannerForm.formState.errors);
                
                // Validate required fields
                if (!data.placements || data.placements.length === 0) {
                  toast({
                    title: "Validation Error",
                    description: "Please select at least one page for banner placement",
                    variant: "destructive",
                  });
                  return;
                }
                
                // Normalize dates to ISO strings for backend
                const payload: InsertBannerAd = {
                  ...data,
                  startDate: data.startDate instanceof Date ? data.startDate as any : data.startDate as any,
                  endDate: data.endDate instanceof Date ? data.endDate as any : data.endDate as any,
                };
                
                console.log('Submitting payload:', payload);
                
                if (editingBanner) {
                  updateBannerAdMutation.mutate({ id: editingBanner.id, data: payload });
                } else {
                  createBannerAdMutation.mutate(payload);
                }
              })} 
              className="space-y-4"
            >
              <FormField
                control={bannerForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Premium Aircraft Rental" {...field} data-testid="input-banner-title" />
                    </FormControl>
                    <FormDescription>Internal title for this banner ad</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={bannerForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description/Tagline (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Fly with confidence - premium rentals" {...field} value={field.value ?? ""} data-testid="input-banner-description" />
                    </FormControl>
                    <FormDescription>Short tagline or description for the banner</FormDescription>
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
                      <Input placeholder="https://example.com/landing-page" {...field} value={field.value ?? ""} data-testid="input-banner-link" />
                    </FormControl>
                    <FormDescription>URL for clickable banner (leave blank for non-clickable)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={bannerForm.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banner Image</FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        {bannerImageUrl || field.value ? (
                          <div className="relative border rounded-lg overflow-hidden">
                            <img 
                              src={bannerImageUrl || field.value} 
                              alt="Banner preview" 
                              className="w-full h-auto max-h-64 object-cover"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2"
                              onClick={() => {
                                setBannerImageUrl("");
                                bannerForm.setValue('imageUrl', "");
                              }}
                              data-testid="button-remove-banner-image"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <ObjectUploader
                            maxNumberOfFiles={1}
                            maxFileSize={10 * 1024 * 1024}
                            onGetUploadParameters={handleBannerGetUploadParameters}
                            onComplete={handleBannerUploadComplete}
                            buttonClassName="w-full aspect-[3/1] rounded-md border-2 border-dashed flex flex-col items-center justify-center"
                            buttonVariant="ghost"
                          >
                            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                            <span className="text-sm font-medium text-muted-foreground">Upload Banner Image</span>
                            <span className="text-xs text-muted-foreground mt-1">Recommended: 1200x400px, Max 10MB</span>
                          </ObjectUploader>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>Upload a banner image for your ad (JPG, PNG, or WebP)</FormDescription>
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
                      <Input 
                        placeholder="https://www.example.com" 
                        {...field}
                        value={field.value ?? ""}
                        data-testid="input-banner-link"
                      />
                    </FormControl>
                    <FormDescription>Where users go when they click the banner</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={bannerForm.control}
                name="placements"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Banner On (Select Multiple Pages)</FormLabel>
                    <div className="space-y-2">
                      {[
                        { value: 'homepage', label: 'Homepage' },
                        { value: 'marketplace', label: 'Marketplace (All Categories)' },
                        { value: 'rentals', label: 'Aircraft Rentals Page' },
                        { value: 'aircraft-sale', label: 'Aircraft for Sale' },
                        { value: 'charter', label: 'Charter Services' },
                        { value: 'cfi', label: 'CFI Services' },
                        { value: 'flight-school', label: 'Flight Schools' },
                        { value: 'mechanic', label: 'Mechanic Services' },
                        { value: 'job', label: 'Aviation Jobs' },
                      ].map((page) => (
                        <div key={page.value} className="flex items-center space-x-2">
                          <Checkbox
                            checked={field.value?.includes(page.value) ?? false}
                            onCheckedChange={(checked) => {
                              const current = field.value || [];
                              if (checked) {
                                field.onChange([...current, page.value]);
                              } else {
                                field.onChange(current.filter((v: string) => v !== page.value));
                              }
                            }}
                            data-testid={`checkbox-placement-${page.value}`}
                          />
                          <Label className="text-sm font-normal cursor-pointer">{page.label}</Label>
                        </div>
                      ))}
                    </div>
                    <FormDescription>Select all pages where this banner ad should appear</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {bannerForm.watch("placements")?.some((p: string) => ['aircraft-sale', 'charter', 'cfi', 'flight-school', 'mechanic', 'job'].includes(p)) && (
                <FormField
                  control={bannerForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger data-testid="select-banner-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="sale">Aircraft for Sale</SelectItem>
                          <SelectItem value="charter">Charter Services</SelectItem>
                          <SelectItem value="cfi">CFI Services</SelectItem>
                          <SelectItem value="flight-school">Flight School</SelectItem>
                          <SelectItem value="mechanic">Mechanic Services</SelectItem>
                          <SelectItem value="job">Aviation Jobs</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Specific marketplace category for this banner</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
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
                          onChange={(e) => field.onChange(new Date(e.target.value))}
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
                      <FormLabel>End Date (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : (typeof field.value === 'string' ? (field.value as string).split('T')[0] : '')}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                          data-testid="input-banner-end-date"
                        />
                      </FormControl>
                      <FormDescription>Leave blank for no expiration</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
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
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setBannerDialogOpen(false);
                    setEditingBanner(null);
                    bannerForm.reset();
                  }}
                  data-testid="button-cancel-create-banner"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createBannerAdMutation.isPending || updateBannerAdMutation.isPending}
                  data-testid="button-submit-banner"
                >
                  {createBannerAdMutation.isPending || updateBannerAdMutation.isPending 
                    ? "Saving..." 
                    : editingBanner 
                    ? "Update Banner" 
                    : "Create Banner"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
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
                  
                  if (editingOrder) {
                    updateOrderMutation.mutate({ id: editingOrder.id, data });
                  } else {
                    createOrderMutation.mutate(data);
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
                      <FormLabel>Description/Tagline (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Fly with confidence" {...field} value={field.value ?? ""} data-testid="input-order-description" />
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
                            onUploadComplete={handleOrderUploadComplete}
                            allowedFileTypes={['image/*']}
                            maxNumberOfFiles={1}
                          />
                          {orderImageUrl && (
                            <img 
                              src={orderImageUrl} 
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
                          { value: 'homepage', label: 'Homepage' },
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
                
                <DialogFooter className="sticky bottom-0 border-t bg-background px-6 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setOrderDialogOpen(false);
                      setEditingOrder(null);
                      orderForm.reset();
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
