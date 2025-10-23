import { DollarSign, TrendingUp, Plane, Calendar, CreditCard, AlertCircle, CheckCircle2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { AircraftListing, Transaction, Rental, User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
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

  // Fetch user's transactions
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions/user", authUser?.id],
    enabled: !!authUser?.id,
  });

  // Calculate stats from actual rentals
  const completedRentals = ownerRentals.filter(r => r.status === "completed");
  const activeRentalsArray = ownerRentals.filter(r => r.status === "active");
  
  const totalEarnings = completedRentals
    .filter(r => r.payoutCompleted)
    .reduce((sum, r) => sum + parseFloat(r.ownerPayout), 0);

  const pendingPayouts = completedRentals
    .filter(r => !r.payoutCompleted)
    .reduce((sum, r) => sum + parseFloat(r.ownerPayout), 0);

  const activeListings = userAircraft.filter(a => a.isListed).length;
  const activeRentals = activeRentalsArray.length;

  // Bank account setup mutation
  const setupBankAccountMutation = useMutation({
    mutationFn: async () => {
      // This will redirect to Stripe Connect onboarding
      return await apiRequest("POST", "/api/stripe/connect/create-account", {});
    },
    onSuccess: (data: any) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to setup bank account",
        variant: "destructive",
      });
    },
  });

  // Request payout mutation
  const requestPayoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/stripe/payout/request", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rentals/owner", authUser?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/user", authUser?.id] });
      toast({
        title: "Payout Requested",
        description: "Your payout request has been submitted. Funds will be transferred within 2-7 business days.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to request payout",
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
              <p className="text-xs text-muted-foreground">
                From {completedRentals.filter(r => !r.payoutCompleted).length} completed rentals
              </p>
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

        {/* Bank Account Setup Alert */}
        {!user?.bankAccountConnected && pendingPayouts > 0 && (
          <Alert className="mb-6 border-accent" data-testid="alert-bank-setup">
            <CreditCard className="h-4 w-4" />
            <AlertTitle>Bank Account Required</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>Set up your bank account to receive payouts of ${pendingPayouts.toFixed(2)}</span>
              <Button 
                onClick={() => setupBankAccountMutation.mutate()}
                disabled={setupBankAccountMutation.isPending}
                data-testid="button-setup-bank"
              >
                {setupBankAccountMutation.isPending ? "Connecting..." : "Setup Bank Account"}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {user?.bankAccountConnected && (
          <Alert className="mb-6 border-chart-2" data-testid="alert-bank-connected">
            <CheckCircle2 className="h-4 w-4 text-chart-2" />
            <AlertTitle>Bank Account Connected</AlertTitle>
            <AlertDescription>
              Your bank account is connected and ready to receive payouts
            </AlertDescription>
          </Alert>
        )}

        {/* Main Tabs */}
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList data-testid="tabs-dashboard">
            <TabsTrigger value="active" data-testid="tab-active">Active Rentals</TabsTrigger>
            <TabsTrigger value="upcoming" data-testid="tab-upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past" data-testid="tab-past">Past</TabsTrigger>
            <TabsTrigger value="listings" data-testid="tab-listings">My Listings</TabsTrigger>
            <TabsTrigger value="financials" data-testid="tab-financials">Financials</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Rentals</CardTitle>
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
                        <div key={rental.id} className="flex items-center justify-between p-4 border rounded-lg hover-elevate" data-testid={`rental-active-${rental.id}`}>
                          <div className="flex-1">
                            <h4 className="font-semibold mb-1">
                              {aircraft?.year || ''} {aircraft?.make || 'Unknown'} {aircraft?.model || ''}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Rented to: Renter #{rental.renterId.substring(0, 8)} • {new Date(rental.startDate).toLocaleDateString()} - {new Date(rental.endDate).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-bold">${parseFloat(rental.totalCost).toFixed(2)}</p>
                              <p className="text-sm text-muted-foreground">Your payout: ${parseFloat(rental.ownerPayout).toFixed(2)}</p>
                            </div>
                            <Badge className="bg-chart-2 text-white">Active</Badge>
                            <Button size="sm" data-testid={`button-message-${rental.id}`}>Message</Button>
                          </div>
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
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>My Listings</CardTitle>
                <Button data-testid="button-add-listing">Add New Listing</Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg hover-elevate" data-testid={`listing-${i}`}>
                      <div className="flex items-center gap-4 flex-1">
                        <img
                          src="https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=200"
                          alt="Aircraft"
                          className="w-20 h-20 rounded-lg object-cover"
                        />
                        <div>
                          <h4 className="font-semibold mb-1">2018 Cessna 172 Skyhawk</h4>
                          <p className="text-sm text-muted-foreground">
                            Santa Monica, CA (SMO)
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold">$145/hr</p>
                          <Badge variant="outline" className="bg-chart-2/10 text-chart-2 border-chart-2">
                            Listed
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`button-toggle-listing-${i}`}
                        >
                          Unlist
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-edit-listing-${i}`}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financials">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>Financial Transactions</CardTitle>
                <Button 
                  variant="default" 
                  className="bg-accent text-accent-foreground hover:bg-accent" 
                  onClick={() => requestPayoutMutation.mutate()}
                  disabled={!user?.bankAccountConnected || pendingPayouts === 0 || requestPayoutMutation.isPending}
                  data-testid="button-request-payout"
                >
                  {requestPayoutMutation.isPending ? "Processing..." : `Request Payout ($${pendingPayouts.toFixed(2)})`}
                </Button>
              </CardHeader>
              <CardContent>
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
                              ) : (
                                <Badge variant="outline">Pending</Badge>
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
