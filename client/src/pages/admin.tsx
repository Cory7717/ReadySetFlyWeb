import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Users, Plane, List, Shield, CheckCircle, XCircle, Eye, TrendingUp, DollarSign, Activity, Calendar, UserPlus, Briefcase, Phone, Mail, Plus, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User, AircraftListing, MarketplaceListing, VerificationSubmission, CrmLead, InsertCrmLead } from "@shared/schema";

export default function AdminDashboard() {
  const [userSearch, setUserSearch] = useState("");
  const [activeTab, setActiveTab] = useState("analytics");
  const [selectedSubmission, setSelectedSubmission] = useState<VerificationSubmission | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState("");
  
  // CRM state
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);
  const [leadFormData, setLeadFormData] = useState<Partial<InsertCrmLead>>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    status: "new",
    source: undefined,
  });
  
  const { toast } = useToast();

  // User search query
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users", userSearch],
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
      resetLeadForm();
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
      resetLeadForm();
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

  const resetLeadForm = () => {
    setLeadFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      company: "",
      status: "new",
      source: undefined,
    });
    setEditingLead(null);
  };

  const handleEditLead = (lead: CrmLead) => {
    setEditingLead(lead);
    setLeadFormData({
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone || "",
      company: lead.company || "",
      status: lead.status as any,
      source: lead.source as any || undefined,
      notes: lead.notes || "",
    });
    setLeadDialogOpen(true);
  };

  const handleSubmitLead = () => {
    if (editingLead) {
      updateLeadMutation.mutate({ id: editingLead.id, data: leadFormData });
    } else {
      createLeadMutation.mutate(leadFormData as InsertCrmLead);
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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <TrendingUp className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="crm" data-testid="tab-crm">
            <Briefcase className="h-4 w-4 mr-2" />
            CRM
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="verifications" data-testid="tab-verifications">
            <Shield className="h-4 w-4 mr-2" />
            Verifications
            {verificationSubmissions.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {verificationSubmissions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="aircraft" data-testid="tab-aircraft">
            <Plane className="h-4 w-4 mr-2" />
            Aircraft
          </TabsTrigger>
          <TabsTrigger value="marketplace" data-testid="tab-marketplace">
            <List className="h-4 w-4 mr-2" />
            Marketplace
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
              <Button onClick={() => { resetLeadForm(); setLeadDialogOpen(true); }} data-testid="button-add-lead">
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
                    <Card key={user.id} data-testid={`card-user-${user.id}`}>
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
                    <Card key={listing.id} data-testid={`card-aircraft-${listing.id}`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
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
                          <Badge variant={listing.isListed ? "default" : "secondary"}>
                            {listing.isListed ? "Listed" : "Unlisted"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Marketplace Listings Tab */}
        <TabsContent value="marketplace" className="space-y-4">
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
                    <Card key={listing.id} data-testid={`card-marketplace-${listing.id}`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-semibold text-foreground">
                              {listing.title}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {listing.category} • {listing.location || "No location"}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {listing.price && `$${listing.price}`} • User ID: {listing.userId}
                            </div>
                          </div>
                          <Badge variant={listing.isActive ? "default" : "secondary"}>
                            {listing.isActive ? "Active" : "Inactive"}
                          </Badge>
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

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lead-first-name">First Name *</Label>
                <Input
                  id="lead-first-name"
                  value={leadFormData.firstName}
                  onChange={(e) => setLeadFormData({ ...leadFormData, firstName: e.target.value })}
                  data-testid="input-lead-first-name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-last-name">Last Name *</Label>
                <Input
                  id="lead-last-name"
                  value={leadFormData.lastName}
                  onChange={(e) => setLeadFormData({ ...leadFormData, lastName: e.target.value })}
                  data-testid="input-lead-last-name"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-email">Email *</Label>
              <Input
                id="lead-email"
                type="email"
                value={leadFormData.email}
                onChange={(e) => setLeadFormData({ ...leadFormData, email: e.target.value })}
                data-testid="input-lead-email"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lead-phone">Phone</Label>
                <Input
                  id="lead-phone"
                  value={leadFormData.phone || ""}
                  onChange={(e) => setLeadFormData({ ...leadFormData, phone: e.target.value })}
                  data-testid="input-lead-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-company">Company</Label>
                <Input
                  id="lead-company"
                  value={leadFormData.company || ""}
                  onChange={(e) => setLeadFormData({ ...leadFormData, company: e.target.value })}
                  data-testid="input-lead-company"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lead-status">Status</Label>
                <select
                  id="lead-status"
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                  value={leadFormData.status}
                  onChange={(e) => setLeadFormData({ ...leadFormData, status: e.target.value as any })}
                  data-testid="select-lead-status"
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="proposal">Proposal</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-source">Source</Label>
                <select
                  id="lead-source"
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                  value={leadFormData.source || ""}
                  onChange={(e) => setLeadFormData({ ...leadFormData, source: e.target.value as any })}
                  data-testid="select-lead-source"
                >
                  <option value="">Select source...</option>
                  <option value="website">Website</option>
                  <option value="referral">Referral</option>
                  <option value="social_media">Social Media</option>
                  <option value="advertising">Advertising</option>
                  <option value="cold_outreach">Cold Outreach</option>
                  <option value="event">Event</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-notes">Notes</Label>
              <Textarea
                id="lead-notes"
                value={leadFormData.notes || ""}
                onChange={(e) => setLeadFormData({ ...leadFormData, notes: e.target.value })}
                data-testid="textarea-lead-notes"
                placeholder="Add any notes about this lead..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setLeadDialogOpen(false);
                resetLeadForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitLead}
              disabled={!leadFormData.firstName || !leadFormData.lastName || !leadFormData.email || createLeadMutation.isPending || updateLeadMutation.isPending}
              data-testid="button-submit-lead"
            >
              {createLeadMutation.isPending || updateLeadMutation.isPending ? "Saving..." : editingLead ? "Update Lead" : "Create Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
