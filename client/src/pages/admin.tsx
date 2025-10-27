import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search, Users, Plane, List, Shield, CheckCircle, XCircle, Eye, TrendingUp, DollarSign, Activity, Calendar, UserPlus, Briefcase, Phone, Mail, Plus, Edit, Trash2, AlertTriangle, FileText, Gift } from "lucide-react";
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
import { insertCrmLeadSchema, insertExpenseSchema, insertPromoAlertSchema, type User, type AircraftListing, type MarketplaceListing, type VerificationSubmission, type CrmLead, type InsertCrmLead, type Expense, type InsertExpense, type PromoAlert, type InsertPromoAlert } from "@shared/schema";
import { AdminUserModal } from "@/components/admin-user-modal";

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
    activeRentals: number;
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

  const handleDeleteListing = () => {
    if (!deleteTarget) return;
    
    if (deleteTarget.type === 'aircraft') {
      deleteAircraftMutation.mutate(deleteTarget.id);
    } else {
      deleteMarketplaceMutation.mutate(deleteTarget.id);
    }
  };

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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-7 h-auto">
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
          <TabsTrigger value="promo" data-testid="tab-promo" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm">
            <Gift className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span>Promos</span>
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

          {/* Rental Stats */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Rental Activity</CardTitle>
                <CardDescription>Current rental statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-chart-2" />
                    <span className="text-sm font-medium">Active Rentals</span>
                  </div>
                  <Badge className="bg-chart-2">{analytics?.activeRentals || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Plane className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Total Rentals</span>
                  </div>
                  <Badge variant="outline">{analytics?.totalRentals || 0}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Commission Details</CardTitle>
                <CardDescription>Ready Set Fly takes 15% commission</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  <p>• Renter commission: 7.5%</p>
                  <p>• Owner commission: 7.5%</p>
                  <p className="mt-2 font-medium text-foreground">
                    Platform fees are automatically calculated and tracked in the transactions table.
                  </p>
                </div>
              </CardContent>
            </Card>
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
                          checked={field.value} 
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
                          checked={field.value} 
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
