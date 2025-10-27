import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, Mail, Phone, MapPin, Calendar, Shield, CheckCircle, XCircle, Plane, List, DollarSign, Award, AlertCircle, Key, Ban, UserCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User, AircraftListing, MarketplaceListing } from "@shared/schema";
import { formatPhoneNumber } from "@/lib/formatters";
import { AircraftDetailModal } from "@/components/aircraft-detail-modal";
import { MarketplaceListingModal } from "@/components/marketplace-listing-modal";

interface AdminUserModalProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminUserModal({ userId, open, onOpenChange }: AdminUserModalProps) {
  const [activeTab, setActiveTab] = useState("profile");
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<string | null>(null);
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [selectedPromoListingId, setSelectedPromoListingId] = useState<string | null>(null);
  const [promoDuration, setPromoDuration] = useState("7");
  const { toast } = useToast();

  // Fetch user details
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/admin/users", userId],
    enabled: open && !!userId,
  });

  // Fetch user's aircraft listings
  const { data: aircraftListings = [], isLoading: aircraftLoading } = useQuery<AircraftListing[]>({
    queryKey: ["/api/admin/users", userId, "aircraft"],
    enabled: open && !!userId,
  });

  // Fetch user's marketplace listings
  const { data: marketplaceListings = [], isLoading: marketplaceLoading } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/admin/users", userId, "marketplace"],
    enabled: open && !!userId,
  });

  // Password reset mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("POST", `/api/admin/users/${userId}/reset-password`, {});
    },
    onSuccess: () => {
      toast({
        title: "Password Reset Email Sent",
        description: "The user will receive an email with password reset instructions.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send password reset email. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Toggle verification mutations
  const toggleVerificationMutation = useMutation({
    mutationFn: async ({ userId, field, value }: { userId: string; field: string; value: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}`, { [field]: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User Updated",
        description: "User verification status has been updated.",
      });
    },
  });

  // Toggle admin status mutation
  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}`, { isAdmin });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Admin Status Updated",
        description: "User admin privileges have been updated.",
      });
    },
  });

  // Grant promotional free time mutation
  const grantPromoMutation = useMutation({
    mutationFn: async ({ listingId, durationDays }: { listingId: string; durationDays: number }) => {
      return await apiRequest("POST", `/api/admin/marketplace/${listingId}/grant-promo`, { durationDays });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", userId, "marketplace"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace"] });
      toast({
        title: "Promotional Free Time Granted",
        description: "The listing has been granted free promotional time.",
      });
      setPromoDialogOpen(false);
      setSelectedPromoListingId(null);
      setPromoDuration("7");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to grant promotional free time. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!user && !userLoading) return null;

  const handleResetPassword = () => {
    if (!userId || !confirm("Are you sure you want to send a password reset email to this user?")) return;
    resetPasswordMutation.mutate(userId);
  };

  const handleToggleVerification = (field: string, currentValue: boolean) => {
    if (!userId) return;
    toggleVerificationMutation.mutate({ userId, field, value: !currentValue });
  };

  const handleToggleAdmin = () => {
    if (!userId || !user) return;
    if (!confirm(`Are you sure you want to ${user.isAdmin ? "remove" : "grant"} admin privileges for this user?`)) return;
    toggleAdminMutation.mutate({ userId, isAdmin: !user.isAdmin });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto" data-testid="modal-admin-user">
        {userLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : user ? (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={user.profileImageUrl || undefined} />
                    <AvatarFallback className="text-lg">
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="font-display text-2xl">
                      {user.firstName} {user.lastName}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2 mt-1">
                      <Mail className="h-4 w-4" />
                      {user.email}
                    </DialogDescription>
                    <div className="flex items-center gap-2 mt-2">
                      {user.isAdmin && <Badge variant="default">Admin</Badge>}
                      {user.isSuperAdmin && <Badge variant="default">Super Admin</Badge>}
                      {user.isVerified && <Badge variant="secondary">Verified</Badge>}
                      {user.identityVerified && <Badge variant="secondary">Identity Verified</Badge>}
                      {user.faaVerified && <Badge variant="secondary">FAA Verified</Badge>}
                    </div>
                  </div>
                </div>
              </div>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="profile" data-testid="tab-user-profile">
                  <Shield className="h-4 w-4 mr-2" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="aircraft" data-testid="tab-user-aircraft">
                  <Plane className="h-4 w-4 mr-2" />
                  Aircraft ({aircraftListings.length})
                </TabsTrigger>
                <TabsTrigger value="marketplace" data-testid="tab-user-marketplace">
                  <List className="h-4 w-4 mr-2" />
                  Listings ({marketplaceListings.length})
                </TabsTrigger>
                <TabsTrigger value="admin-actions" data-testid="tab-admin-actions">
                  <Key className="h-4 w-4 mr-2" />
                  Admin Actions
                </TabsTrigger>
              </TabsList>

              {/* Profile Tab */}
              <TabsContent value="profile" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Personal Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Personal Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Full Name</div>
                        <div className="text-base">{user.firstName} {user.lastName}</div>
                      </div>
                      {(user.legalFirstName || user.legalLastName) && (
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Legal Name</div>
                          <div className="text-base">{user.legalFirstName} {user.legalLastName}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Email</div>
                        <div className="text-base flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {user.email}
                          {user.emailVerified && <CheckCircle className="h-4 w-4 text-chart-2" />}
                        </div>
                      </div>
                      {user.phone && (
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Phone</div>
                          <div className="text-base flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            {formatPhoneNumber(user.phone)}
                            {user.phoneVerified && <CheckCircle className="h-4 w-4 text-chart-2" />}
                          </div>
                        </div>
                      )}
                      {user.dateOfBirth && (
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Date of Birth</div>
                          <div className="text-base">{user.dateOfBirth}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">User ID</div>
                        <div className="text-xs font-mono">{user.id}</div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Pilot Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Pilot Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Total Flight Hours</div>
                        <div className="text-base font-semibold">{user.totalFlightHours || 0} hours</div>
                      </div>
                      {user.certifications && user.certifications.length > 0 && (
                        <div>
                          <div className="text-sm font-medium text-muted-foreground mb-2">Certifications</div>
                          <div className="flex flex-wrap gap-1">
                            {user.certifications.map((cert, idx) => (
                              <Badge key={idx} variant="outline">{cert}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {user.faaCertificateNumber && (
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">FAA Certificate Number</div>
                          <div className="text-base font-mono">{user.faaCertificateNumber}</div>
                        </div>
                      )}
                      {user.aircraftTypesFlown && user.aircraftTypesFlown.length > 0 && (
                        <div>
                          <div className="text-sm font-medium text-muted-foreground mb-2">Aircraft Types Flown</div>
                          <div className="flex flex-wrap gap-1">
                            {user.aircraftTypesFlown.map((type, idx) => (
                              <Badge key={idx} variant="outline">{type}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Verification Status */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Verification Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Identity Verified</span>
                        {user.identityVerified ? (
                          <CheckCircle className="h-5 w-5 text-chart-2" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">FAA Verified</span>
                        {user.faaVerified ? (
                          <CheckCircle className="h-5 w-5 text-chart-2" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Payment Verified</span>
                        {user.paymentVerified ? (
                          <CheckCircle className="h-5 w-5 text-chart-2" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Email Verified</span>
                        {user.emailVerified ? (
                          <CheckCircle className="h-5 w-5 text-chart-2" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Phone Verified</span>
                        {user.phoneVerified ? (
                          <CheckCircle className="h-5 w-5 text-chart-2" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">License Verified</span>
                        {user.licenseVerified ? (
                          <CheckCircle className="h-5 w-5 text-chart-2" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Financial Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Financial Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Payment Method On File</span>
                        {user.paymentMethodOnFile ? (
                          <CheckCircle className="h-5 w-5 text-chart-2" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Bank Account Connected</span>
                        {user.bankAccountConnected ? (
                          <CheckCircle className="h-5 w-5 text-chart-2" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      {user.stripeAccountId && (
                        <div>
                          <div className="text-sm font-medium text-muted-foreground mt-3">Stripe Account ID</div>
                          <div className="text-xs font-mono">{user.stripeAccountId}</div>
                        </div>
                      )}
                      <div className="mt-3">
                        <div className="text-sm font-medium text-muted-foreground">Average Rating</div>
                        <div className="text-base flex items-center gap-2">
                          <Award className="h-4 w-4" />
                          {user.averageRating || "N/A"} ({user.totalReviews || 0} reviews)
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Aircraft Listings Tab */}
              <TabsContent value="aircraft" className="space-y-4 mt-4">
                {aircraftLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading aircraft listings...
                  </div>
                ) : aircraftListings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    This user has no aircraft listings
                  </div>
                ) : (
                  <div className="space-y-3">
                    {aircraftListings.map((aircraft) => (
                      <Card 
                        key={aircraft.id} 
                        className="hover-elevate cursor-pointer transition-all"
                        onClick={() => setSelectedAircraftId(aircraft.id)}
                        data-testid={`card-user-aircraft-${aircraft.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={aircraft.isListed ? "default" : "secondary"}>
                                  {aircraft.isListed ? "Listed" : "Unlisted"}
                                </Badge>
                              </div>
                              <div className="font-semibold text-lg">
                                {aircraft.year} {aircraft.make} {aircraft.model}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {aircraft.registration} • {aircraft.location}
                              </div>
                              <div className="flex items-center gap-4 mt-2">
                                <div className="flex items-center gap-1 text-sm">
                                  <DollarSign className="h-4 w-4" />
                                  ${aircraft.hourlyRate}/hour
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {aircraft.category}
                                </div>
                              </div>
                            </div>
                            {aircraft.images && aircraft.images.length > 0 && (
                              <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                <img 
                                  src={aircraft.images[0]} 
                                  alt={`${aircraft.make} ${aircraft.model}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Marketplace Listings Tab */}
              <TabsContent value="marketplace" className="space-y-4 mt-4">
                {marketplaceLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading marketplace listings...
                  </div>
                ) : marketplaceListings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    This user has no marketplace listings
                  </div>
                ) : (
                  <div className="space-y-3">
                    {marketplaceListings.map((listing) => (
                      <Card 
                        key={listing.id} 
                        className="hover-elevate cursor-pointer transition-all"
                        onClick={() => setSelectedMarketplaceId(listing.id)}
                        data-testid={`card-user-marketplace-${listing.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={listing.isActive ? "default" : "secondary"}>
                                  {listing.isActive ? "Active" : "Inactive"}
                                </Badge>
                                <Badge variant="outline" className="capitalize">
                                  {listing.category}
                                </Badge>
                                {listing.promoFreeUntil && new Date(listing.promoFreeUntil) > new Date() && (
                                  <Badge variant="default" className="bg-green-600">
                                    Free Until {new Date(listing.promoFreeUntil).toLocaleDateString()}
                                  </Badge>
                                )}
                              </div>
                              <div className="font-semibold text-lg">
                                {listing.title}
                              </div>
                              <div className="text-sm text-muted-foreground line-clamp-2">
                                {listing.description}
                              </div>
                              <div className="flex items-center gap-4 mt-2">
                                {listing.price && (
                                  <div className="flex items-center gap-1 text-sm">
                                    <DollarSign className="h-4 w-4" />
                                    ${listing.price}
                                  </div>
                                )}
                                {listing.location && (
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <MapPin className="h-4 w-4" />
                                    {listing.location}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedPromoListingId(listing.id);
                                  setPromoDialogOpen(true);
                                }}
                                data-testid={`button-grant-promo-${listing.id}`}
                              >
                                Grant Promo
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Admin Actions Tab */}
              <TabsContent value="admin-actions" className="space-y-4 mt-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    These actions affect user account settings and permissions. Use with caution.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Password Reset */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Password Reset</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Send a password reset email to the user. They will receive instructions to create a new password.
                      </p>
                      <Button 
                        onClick={handleResetPassword} 
                        disabled={resetPasswordMutation.isPending}
                        data-testid="button-reset-password"
                      >
                        <Key className="h-4 w-4 mr-2" />
                        {resetPasswordMutation.isPending ? "Sending..." : "Send Password Reset Email"}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Admin Status */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Admin Privileges</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Grant or remove admin access for this user. Admins can manage users, listings, and view analytics.
                      </p>
                      <Button 
                        variant={user.isAdmin ? "destructive" : "default"}
                        onClick={handleToggleAdmin}
                        disabled={toggleAdminMutation.isPending}
                        data-testid="button-toggle-admin"
                      >
                        <UserCheck className="h-4 w-4 mr-2" />
                        {user.isAdmin ? "Remove Admin Access" : "Grant Admin Access"}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Verification Toggles */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Verification Controls</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Identity Verified</span>
                        <Button
                          size="sm"
                          variant={user.identityVerified ? "destructive" : "default"}
                          onClick={() => handleToggleVerification("identityVerified", user.identityVerified || false)}
                          disabled={toggleVerificationMutation.isPending}
                          data-testid="button-toggle-identity"
                        >
                          {user.identityVerified ? "Revoke" : "Verify"}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">FAA Verified</span>
                        <Button
                          size="sm"
                          variant={user.faaVerified ? "destructive" : "default"}
                          onClick={() => handleToggleVerification("faaVerified", user.faaVerified || false)}
                          disabled={toggleVerificationMutation.isPending}
                          data-testid="button-toggle-faa"
                        >
                          {user.faaVerified ? "Revoke" : "Verify"}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">License Verified</span>
                        <Button
                          size="sm"
                          variant={user.licenseVerified ? "destructive" : "default"}
                          onClick={() => handleToggleVerification("licenseVerified", user.licenseVerified || false)}
                          disabled={toggleVerificationMutation.isPending}
                          data-testid="button-toggle-license"
                        >
                          {user.licenseVerified ? "Revoke" : "Verify"}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">General Verification</span>
                        <Button
                          size="sm"
                          variant={user.isVerified ? "destructive" : "default"}
                          onClick={() => handleToggleVerification("isVerified", user.isVerified || false)}
                          disabled={toggleVerificationMutation.isPending}
                          data-testid="button-toggle-verified"
                        >
                          {user.isVerified ? "Revoke" : "Verify"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Account Actions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Account Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Additional account management actions will be available here in future updates.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </DialogContent>

      {/* Aircraft Detail Modal */}
      {selectedAircraftId && (
        <AircraftDetailModal
          aircraftId={selectedAircraftId}
          open={!!selectedAircraftId}
          onOpenChange={(open) => !open && setSelectedAircraftId(null)}
        />
      )}

      {/* Marketplace Listing Modal */}
      {selectedMarketplaceId && (
        <MarketplaceListingModal
          listingId={selectedMarketplaceId}
          open={!!selectedMarketplaceId}
          onOpenChange={(open) => !open && setSelectedMarketplaceId(null)}
        />
      )}

      {/* Grant Promotional Free Time Dialog */}
      <Dialog open={promoDialogOpen} onOpenChange={setPromoDialogOpen}>
        <DialogContent data-testid="dialog-grant-promo">
          <DialogHeader>
            <DialogTitle>Grant Promotional Free Time</DialogTitle>
            <DialogDescription>
              Grant this user free listing time as a customer service gesture. The listing will be active for the selected duration without charging the user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="promo-duration">Duration</Label>
              <Select value={promoDuration} onValueChange={setPromoDuration}>
                <SelectTrigger id="promo-duration" data-testid="select-promo-duration">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 Days</SelectItem>
                  <SelectItem value="14">14 Days (2 weeks)</SelectItem>
                  <SelectItem value="21">21 Days (3 weeks)</SelectItem>
                  <SelectItem value="30">30 Days (1 month)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will extend the listing's active period by {promoDuration} days without any charge to the user. This action will be tracked for audit purposes.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPromoDialogOpen(false);
                setSelectedPromoListingId(null);
                setPromoDuration("7");
              }}
              data-testid="button-cancel-promo"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedPromoListingId) {
                  grantPromoMutation.mutate({ 
                    listingId: selectedPromoListingId, 
                    durationDays: parseInt(promoDuration) 
                  });
                }
              }}
              disabled={grantPromoMutation.isPending}
              data-testid="button-confirm-promo"
            >
              {grantPromoMutation.isPending ? "Granting..." : "Grant Free Time"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
