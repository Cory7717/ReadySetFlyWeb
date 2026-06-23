import { DollarSign, TrendingUp, Plane, Calendar, CreditCard, AlertCircle, CheckCircle2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { AircraftListing, Transaction, Rental, User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StarRating } from "@/components/star-rating";
import { VerificationBadges } from "@/components/verification-badges";
import { ReviewDialog } from "@/components/review-dialog";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiUrl } from "@/lib/api";
import { WORKFLOW_NAV_GROUPS } from "@/lib/workflow-nav";

function RentalReviewAction({
  rentalId,
  revieweeId,
  revieweeName,
}: {
  rentalId: string;
  revieweeId: string;
  revieweeName: string;
}) {
  const { data } = useQuery<{ canReview: boolean; reason?: string }>({
    queryKey: ["/api/rentals", rentalId, "can-review"],
    queryFn: async () => {
      const response = await fetch(apiUrl(`/api/rentals/${rentalId}/can-review`), {
        credentials: "include",
      });
      if (!response.ok) {
        return { canReview: false };
      }
      return response.json();
    },
  });

  if (!data?.canReview) {
    return null;
  }

  return (
    <ReviewDialog
      rentalId={rentalId}
      revieweeId={revieweeId}
      revieweeName={revieweeName}
      trigger={
        <Button variant="outline" size="sm" data-testid={`button-leave-review-${rentalId}`}>
          Leave Review
        </Button>
      }
    />
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user: authUser } = useAuth();
  const { toast } = useToast();

  // Fetch user's full data
  const { data: user } = useQuery<User>({
    queryKey: ["/api/users", authUser?.id],
    enabled: !!authUser?.id,
  });

  // Fetch user's aircraft listings
  const { data: allAircraft = [] } = useQuery<AircraftListing[]>({
    queryKey: ["/api/aircraft"],
  });

  // Filter to current user's aircraft
  const userAircraft = allAircraft.filter(a => a.ownerId === authUser?.id);
  
  // Fetch owner's rentals
  const { data: ownerRentals = [] } = useQuery<Rental[]>({
    queryKey: ["/api/rentals/owner", authUser?.id],
    enabled: !!authUser?.id,
  });

  // Fetch renter's rentals
  const { data: renterRentals = [] } = useQuery<Rental[]>({
    queryKey: ["/api/rentals/renter", authUser?.id],
    enabled: !!authUser?.id,
  });

  // Fetch user's transactions
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions/user", authUser?.id],
    enabled: !!authUser?.id,
  });

  // Fetch all users to display renter information in pending requests
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Calculate stats from actual rentals
  const completedRentals = ownerRentals.filter(r => r.status === "completed");
  const activeRentalsArray = ownerRentals.filter(r => r.status === "active");
  const upcomingRentals = ownerRentals.filter(
    (r) => r.status === "approved" && new Date(r.startDate) > new Date(),
  );
  const pastRentals = ownerRentals.filter((r) => r.status === "completed");
  const pendingRequests = ownerRentals.filter(r => r.status === "pending");
  
  // Renter's rental requests
  const myPendingRequests = renterRentals.filter(r => r.status === "pending");
  const approvedRentalsAwaitingPayment = renterRentals.filter(r => r.status === "approved" && !r.isPaid);
  const myActiveRentals = renterRentals.filter(r => r.status === "active");
  const myCompletedRentals = renterRentals.filter(r => r.status === "completed");
  
  const totalEarnings = completedRentals
    .filter(r => r.payoutCompleted)
    .reduce((sum, r) => sum + parseFloat(r.ownerPayout), 0);

  const now = new Date();
  // Rental payouts that are completed but in the hold period (not yet creditable)
  const heldPayouts = completedRentals
    .filter(r => !r.payoutCompleted && r.payoutAvailableAt && new Date(r.payoutAvailableAt) > now)
    .reduce((sum, r) => sum + parseFloat(r.ownerPayout), 0);
  // Rental payouts whose hold has expired but balance hasn't been released/withdrawn yet
  const availablePayouts = completedRentals
    .filter(r => !r.payoutCompleted && (!r.payoutAvailableAt || new Date(r.payoutAvailableAt) <= now))
    .reduce((sum, r) => sum + parseFloat(r.ownerPayout), 0);
  const pendingPayouts = heldPayouts + availablePayouts;

  const activeListings = userAircraft.filter(a => a.isListed).length;
  const activeRentals = activeRentalsArray.length;

  // Navigate to PayPal withdrawals page
  const handleSetupPayouts = () => {
    navigate("/owner-withdrawals");
  };

  // Approve rental request mutation
  const approveRentalMutation = useMutation({
    mutationFn: async (rentalId: string) => {
      return await apiRequest("PATCH", `/api/rentals/${rentalId}`, { status: "approved" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rentals/owner", authUser?.id] });
      toast({
        title: "Request Approved",
        description: "The renter has been notified and can now proceed with payment.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve request",
        variant: "destructive",
      });
    },
  });

  // Decline rental request mutation
  const declineRentalMutation = useMutation({
    mutationFn: async (rentalId: string) => {
      return await apiRequest("PATCH", `/api/rentals/${rentalId}`, { status: "cancelled" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rentals/owner", authUser?.id] });
      toast({
        title: "Request Declined",
        description: "The rental request has been cancelled.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to decline request",
        variant: "destructive",
      });
    },
  });

  const completeRentalMutation = useMutation({
    mutationFn: async (rentalId: string) => {
      return await apiRequest("POST", `/api/rentals/${rentalId}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rentals/owner", authUser?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/rentals/renter", authUser?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals"] });
      toast({
        title: "Rental completed",
        description: "Messaging has been closed for this rental.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Unable to complete rental",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold mb-2" data-testid="text-dashboard-title">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage your rentals, listings, and earnings
          </p>
        </div>

        <Card className="mb-8 border-primary/25 bg-card">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Recommended first action</div>
                <h2 className="mt-1 text-2xl font-semibold">Start with a flight plan</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Create, review, and manage flight plans from one place, then branch into weather, training, aircraft, and marketplace workflows.
                </p>
              </div>
              <Button size="lg" onClick={() => navigate("/flight-planner")} data-testid="dashboard-start-flight-plan">
                <Plane className="h-4 w-4" />
                Start Flight Plan
              </Button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {WORKFLOW_NAV_GROUPS.map((group) => (
                <div key={group.id} className="rounded-lg border border-border bg-background/60 p-3">
                  <div className="text-sm font-semibold">{group.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{group.description}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {group.items.slice(0, 3).map((item) => (
                      <Button key={`${group.id}-${item.label}`} variant="outline" size="sm" onClick={() => navigate(item.href)}>
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-earnings">
                ${totalEarnings.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                From {transactions.filter(t => t.status === "completed").length} completed rentals
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-pending-payouts">
                ${pendingPayouts.toFixed(2)}
              </div>
              {heldPayouts > 0 && availablePayouts > 0 ? (
                <p className="text-xs text-muted-foreground">
                  ${availablePayouts.toFixed(2)} available · ${heldPayouts.toFixed(2)} on hold
                </p>
              ) : heldPayouts > 0 ? (
                <p className="text-xs text-amber-600">
                  ${heldPayouts.toFixed(2)} in hold period
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  From {completedRentals.filter(r => !r.payoutCompleted).length} completed rentals
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
              <Plane className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-active-listings">{activeListings}</div>
              <p className="text-xs text-muted-foreground">
                {userAircraft.length} total aircraft
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Rentals</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-active-rentals">{activeRentals}</div>
              <p className="text-xs text-muted-foreground">
                Currently rented
              </p>
            </CardContent>
          </Card>
        </div>

        {/* PayPal Setup Alert */}
        {!user?.paypalEmail && pendingPayouts > 0 && (
          <Alert className="mb-6 border-accent" data-testid="alert-paypal-setup">
            <CreditCard className="h-4 w-4" />
            <AlertTitle>PayPal Business/Commerce Account Required</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span>Set up your PayPal Business/Commerce account to receive instant payouts of ${pendingPayouts.toFixed(2)}</span>
              <Button 
                onClick={handleSetupPayouts}
                data-testid="button-setup-paypal"
                className="w-full sm:w-auto"
              >
                Set Up PayPal Business/Commerce Payouts
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {user?.paypalEmail && (
          <Alert className="mb-6 border-chart-2" data-testid="alert-paypal-connected">
            <CheckCircle2 className="h-4 w-4 text-chart-2" />
            <AlertTitle>PayPal Business/Commerce Account Connected</AlertTitle>
            <AlertDescription>
              Your PayPal Business/Commerce account ({user.paypalEmail}) is ready to receive instant payouts
            </AlertDescription>
          </Alert>
        )}

        {/* Approved Rentals Awaiting Payment Alert */}
        {approvedRentalsAwaitingPayment.length > 0 && (
          <Alert className="mb-6 border-accent" data-testid="alert-payment-needed">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Payment Required</AlertTitle>
            <AlertDescription>
              <div className="space-y-3">
                <p>You have {approvedRentalsAwaitingPayment.length} approved rental{approvedRentalsAwaitingPayment.length > 1 ? 's' : ''} awaiting payment.</p>
                <div className="space-y-2">
                  {approvedRentalsAwaitingPayment.map((rental) => {
                    const aircraft = allAircraft.find(a => a.id === rental.aircraftId);
                    return (
                      <div key={rental.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-background rounded-lg border" data-testid={`alert-payment-rental-${rental.id}`}>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{aircraft?.year} {aircraft?.make} {aircraft?.model}</p>
                          <p className="text-sm">{new Date(rental.startDate).toLocaleDateString()} - {new Date(rental.endDate).toLocaleDateString()}</p>
                        </div>
                        <div className="flex flex-row items-center justify-between sm:flex-col sm:items-end gap-2">
                          <p className="font-bold text-foreground">${parseFloat(rental.totalCostRenter).toFixed(2)}</p>
                          <Button 
                            size="sm" 
                            className="bg-accent text-accent-foreground hover:bg-accent"
                            onClick={() => {
                              // Create payment intent and redirect to payment
                              window.location.href = `/rental-payment/${rental.id}`;
                            }}
                            data-testid={`button-pay-rental-${rental.id}`}
                          >
                            Pay Now
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Main Tabs */}
        <Tabs defaultValue={pendingRequests.length > 0 ? "pending" : "active"} className="space-y-6">
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 h-auto" data-testid="tabs-dashboard">
            <TabsTrigger value="pending" data-testid="tab-pending" className="flex-col sm:flex-row gap-1">
              <span className="text-xs sm:text-sm">Pending</span>
              {pendingRequests.length > 0 && <Badge className="bg-accent text-accent-foreground text-xs">{pendingRequests.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active" className="text-xs sm:text-sm">Active</TabsTrigger>
            <TabsTrigger value="upcoming" data-testid="tab-upcoming" className="text-xs sm:text-sm">Upcoming</TabsTrigger>
            <TabsTrigger value="past" data-testid="tab-past" className="text-xs sm:text-sm">Past</TabsTrigger>
            <TabsTrigger value="listings" data-testid="tab-listings" className="text-xs sm:text-sm">Listings</TabsTrigger>
            <TabsTrigger value="financials" data-testid="tab-financials" className="text-xs sm:text-sm">Financials</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Rental Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pendingRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No pending requests at this time
                    </div>
                  ) : (
                    pendingRequests.map((rental) => {
                      const aircraft = allAircraft.find(a => a.id === rental.aircraftId);
                      const renter = allUsers.find(u => u.id === rental.renterId);
                      return (
                        <div key={rental.id} className="flex flex-col gap-4 p-4 border rounded-lg hover-elevate" data-testid={`rental-pending-${rental.id}`}>
                          <div className="flex-1">
                            <h4 className="font-semibold mb-1">
                              {aircraft?.year || ''} {aircraft?.make || 'Unknown'} {aircraft?.model || ''}
                            </h4>
                            <div className="space-y-1">
                              <p className="text-sm text-muted-foreground">
                                Renter: {renter?.firstName} {renter?.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(rental.startDate).toLocaleDateString()} - {new Date(rental.endDate).toLocaleDateString()}
                              </p>
                              {renter?.averageRating && renter?.totalReviews && renter.totalReviews > 0 && (
                                <StarRating 
                                  rating={parseFloat(renter.averageRating)} 
                                  totalReviews={renter.totalReviews || 0}
                                  size="sm"
                                />
                              )}
                              <p className="text-sm text-muted-foreground">
                                {parseFloat(rental.estimatedHours)} flight hours estimated
                              </p>
                            </div>
                          </div>
                          {renter && (
                            <div className="rounded-lg border bg-muted/20 p-3 space-y-3" data-testid={`renter-profile-${rental.id}`}>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={renter.profileImageUrl || undefined} />
                                  <AvatarFallback>
                                    {`${renter.firstName?.[0] || ""}${renter.lastName?.[0] || ""}` || "RS"}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">
                                    {renter.firstName} {renter.lastName}
                                  </p>
                                  {!renter.identityVerified && (
                                    <Badge variant="destructive" data-testid={`badge-unverified-renter-${rental.id}`}>
                                      Unverified Renter
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <VerificationBadges user={renter} type="renter" size="sm" />
                              <div className="grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground">
                                <div>
                                  <p className="font-semibold text-foreground">{renter.totalFlightHours ?? 0} hrs</p>
                                  <p>Total flight time</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-foreground">
                                    {renter.averageRating ? Number(renter.averageRating).toFixed(1) : "N/A"}
                                  </p>
                                  <p>{renter.totalReviews || 0} reviews</p>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {renter.certifications && renter.certifications.length > 0 ? (
                                    renter.certifications.map((cert) => (
                                      <Badge key={cert} variant="secondary" className="text-[10px]">
                                        {cert}
                                      </Badge>
                                    ))
                                  ) : (
                                    <Badge variant="outline" className="text-[10px]">
                                      No certs listed
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <p className="font-bold">${parseFloat(rental.totalCostRenter).toFixed(2)}</p>
                              <p className="text-sm text-muted-foreground">Your payout: ${parseFloat(rental.ownerPayout).toFixed(2)}</p>
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <Badge variant="outline" className="bg-accent/10 text-accent border-accent text-center">Pending</Badge>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  className="bg-chart-2 text-white hover:bg-chart-2 flex-1 sm:flex-none"
                                  onClick={() => approveRentalMutation.mutate(rental.id)}
                                  disabled={approveRentalMutation.isPending || declineRentalMutation.isPending}
                                  data-testid={`button-approve-${rental.id}`}
                                >
                                  Approve
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="flex-1 sm:flex-none"
                                  onClick={() => declineRentalMutation.mutate(rental.id)}
                                  disabled={approveRentalMutation.isPending || declineRentalMutation.isPending}
                                  data-testid={`button-decline-${rental.id}`}
                                >
                                  Decline
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Renter's outgoing rental requests */}
            <Card>
              <CardHeader>
                <CardTitle>My Rental Requests</CardTitle>
                <p className="text-sm text-muted-foreground">Requests you've sent to aircraft owners</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {myPendingRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No pending rental requests
                    </div>
                  ) : (
                    myPendingRequests.map((rental) => {
                      const aircraft = allAircraft.find(a => a.id === rental.aircraftId);
                      const owner = allUsers.find(u => u.id === rental.ownerId);
                      return (
                        <div key={rental.id} className="flex flex-col gap-4 p-4 border rounded-lg hover-elevate" data-testid={`my-rental-request-${rental.id}`}>
                          <div className="flex-1">
                            <h4 className="font-semibold mb-1">
                              {aircraft?.year || ''} {aircraft?.make || 'Unknown'} {aircraft?.model || ''}
                            </h4>
                            <div className="space-y-1">
                              <p className="text-sm text-muted-foreground">
                                Owner: {owner?.firstName} {owner?.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(rental.startDate).toLocaleDateString()} - {new Date(rental.endDate).toLocaleDateString()}
                              </p>
                              {owner?.averageRating && owner?.totalReviews && owner.totalReviews > 0 && (
                                <StarRating 
                                  rating={parseFloat(owner.averageRating)} 
                                  totalReviews={owner.totalReviews || 0}
                                  size="sm"
                                />
                              )}
                              <p className="text-sm text-muted-foreground">
                                {parseFloat(rental.estimatedHours)} flight hours estimated
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <p className="font-bold">${parseFloat(rental.totalCostRenter).toFixed(2)}</p>
                              <p className="text-sm text-muted-foreground">Total cost</p>
                            </div>
                            <Badge variant="outline" className="bg-accent/10 text-accent border-accent text-center">Pending Review</Badge>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Owner Active Rentals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeRentalsArray.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No active rentals at this time
                    </div>
                  ) : (
                    activeRentalsArray.map((rental) => {
                      const aircraft = allAircraft.find(a => a.id === rental.aircraftId);
                      return (
                        <div key={rental.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg hover-elevate" data-testid={`rental-active-${rental.id}`}>
                          <div className="flex-1">
                            <h4 className="font-semibold mb-1">
                              {aircraft?.year || ''} {aircraft?.make || 'Unknown'} {aircraft?.model || ''}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Rented to: Renter #{rental.renterId.substring(0, 8)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(rental.startDate).toLocaleDateString()} - {new Date(rental.endDate).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div>
                              <p className="font-bold">${parseFloat(rental.totalCostRenter).toFixed(2)}</p>
                              <p className="text-sm text-muted-foreground">Your payout: ${parseFloat(rental.ownerPayout).toFixed(2)}</p>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <Badge className="bg-chart-2 text-white text-center">Active</Badge>
                              <Button
                                size="sm"
                                className="w-full sm:w-auto"
                                data-testid={`button-message-${rental.id}`}
                                onClick={() => navigate(`/messages?rentalId=${rental.id}`)}
                              >
                                Message
                              </Button>
                              {new Date(rental.endDate).getTime() <= Date.now() && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full sm:w-auto"
                                  disabled={completeRentalMutation.isPending}
                                  onClick={() => completeRentalMutation.mutate(rental.id)}
                                  data-testid={`button-complete-rental-${rental.id}`}
                                >
                                  Complete Rental
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>My Active Rentals</CardTitle>
                <CardDescription>Rentals you have paid for and can message about while active</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {myActiveRentals.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No active renter rentals at this time
                    </div>
                  ) : (
                    myActiveRentals.map((rental) => {
                      const aircraft = allAircraft.find((a) => a.id === rental.aircraftId);
                      const owner = allUsers.find((u) => u.id === rental.ownerId);
                      return (
                        <div key={rental.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg hover-elevate" data-testid={`renter-rental-active-${rental.id}`}>
                          <div className="flex-1 space-y-1">
                            <h4 className="font-semibold">
                              {aircraft?.year || ""} {aircraft?.make || "Unknown"} {aircraft?.model || ""}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Owner: {owner?.firstName || ""} {owner?.lastName || ""}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(rental.startDate).toLocaleDateString()} - {new Date(rental.endDate).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <Badge className="bg-chart-2 text-white text-center">Active</Badge>
                            <Button
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => navigate(`/messages?rentalId=${rental.id}`)}
                              data-testid={`button-renter-message-${rental.id}`}
                            >
                              Message
                            </Button>
                            {new Date(rental.endDate).getTime() <= Date.now() && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full sm:w-auto"
                                disabled={completeRentalMutation.isPending}
                                onClick={() => completeRentalMutation.mutate(rental.id)}
                                data-testid={`button-renter-complete-rental-${rental.id}`}
                              >
                                Complete Rental
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Rentals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {upcomingRentals.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No upcoming approved rentals yet</div>
                  ) : (
                    upcomingRentals.map((rental) => {
                      const aircraft = allAircraft.find((a) => a.id === rental.aircraftId);
                      return (
                        <div
                          key={rental.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg hover-elevate"
                          data-testid={`rental-upcoming-${rental.id}`}
                        >
                          <div className="flex-1 space-y-1">
                            <h4 className="font-semibold">
                              {aircraft?.year || ""} {aircraft?.make || "Unknown"} {aircraft?.model || ""}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {new Date(rental.startDate).toLocaleDateString()} -{" "}
                              {new Date(rental.endDate).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Estimated total: ${parseFloat(rental.totalCostRenter).toFixed(2)}
                            </p>
                          </div>
                          {!rental.isPaid && (
                            <Button
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => navigate(`/rental-payment/${rental.id}`)}
                              data-testid={`button-complete-payment-${rental.id}`}
                            >
                              Complete Payment
                            </Button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="past" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Past Owner Rentals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pastRentals.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No completed rentals yet</div>
                  ) : (
                    pastRentals.map((rental) => {
                      const aircraft = allAircraft.find((a) => a.id === rental.aircraftId);
                      const renter = allUsers.find((u) => u.id === rental.renterId);
                      return (
                        <div
                          key={rental.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg hover-elevate"
                          data-testid={`rental-past-${rental.id}`}
                        >
                          <div className="flex-1 space-y-1">
                            <h4 className="font-semibold">
                              {aircraft?.year || ""} {aircraft?.make || "Unknown"} {aircraft?.model || ""}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Dates flown: {new Date(rental.startDate).toLocaleDateString()} -{" "}
                              {new Date(rental.endDate).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Total paid: ${parseFloat(rental.totalCostRenter).toFixed(2)}
                            </p>
                          </div>
                          {renter && (
                            <RentalReviewAction
                              rentalId={rental.id}
                              revieweeId={renter.id}
                              revieweeName={`${renter.firstName || ""} ${renter.lastName || ""}`.trim() || "Renter"}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>My Completed Rentals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {myCompletedRentals.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No completed renter rentals yet</div>
                  ) : (
                    myCompletedRentals.map((rental) => {
                      const aircraft = allAircraft.find((a) => a.id === rental.aircraftId);
                      const owner = allUsers.find((u) => u.id === rental.ownerId);
                      return (
                        <div key={rental.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg hover-elevate" data-testid={`renter-rental-past-${rental.id}`}>
                          <div className="flex-1 space-y-1">
                            <h4 className="font-semibold">
                              {aircraft?.year || ""} {aircraft?.make || "Unknown"} {aircraft?.model || ""}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Owner: {owner?.firstName || ""} {owner?.lastName || ""}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Dates flown: {new Date(rental.startDate).toLocaleDateString()} - {new Date(rental.endDate).toLocaleDateString()}
                            </p>
                          </div>
                          {owner && (
                            <RentalReviewAction
                              rentalId={rental.id}
                              revieweeId={owner.id}
                              revieweeName={`${owner.firstName || ""} ${owner.lastName || ""}`.trim() || "Owner"}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="listings">
            <Card>
              <CardHeader>
                <CardTitle>My Listings</CardTitle>
                <CardDescription>Manage your aircraft and marketplace listings</CardDescription>
              </CardHeader>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground mb-6">
                  View and manage all your listings in one place
                </p>
                <Button 
                  onClick={() => navigate("/my-listings")} 
                  className="w-full sm:w-auto"
                  data-testid="button-view-my-listings"
                >
                  Go to My Listings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financials">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle>Financial Transactions</CardTitle>
                <Button 
                  variant="default" 
                  className="bg-accent text-accent-foreground hover:bg-accent w-full sm:w-auto" 
                  onClick={() => navigate("/owner-withdrawals")}
                  data-testid="button-manage-withdrawals"
                >
                  Manage Withdrawals
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedRentals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No completed rentals yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      completedRentals.map((rental) => {
                        const aircraft = allAircraft.find(a => a.id === rental.aircraftId);
                        return (
                          <TableRow key={rental.id} data-testid={`transaction-${rental.id}`}>
                            <TableCell>{new Date(rental.endDate).toLocaleDateString()}</TableCell>
                            <TableCell>
                              Rental payout - {aircraft?.make || "Unknown"} {aircraft?.model || ""}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">Payout</Badge>
                            </TableCell>
                            <TableCell className="font-semibold">${parseFloat(rental.ownerPayout).toFixed(2)}</TableCell>
                            <TableCell>
                              {rental.payoutCompleted ? (
                                <Badge className="bg-chart-2 text-white">Completed</Badge>
                              ) : rental.payoutAvailableAt && new Date(rental.payoutAvailableAt) > now ? (
                                <Badge variant="outline" className="border-amber-500/50 text-amber-600">On Hold</Badge>
                              ) : (
                                <Badge variant="outline" className="border-green-500/50 text-green-600">Available</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
