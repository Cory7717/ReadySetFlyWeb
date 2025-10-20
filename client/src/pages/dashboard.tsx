import { DollarSign, TrendingUp, Plane, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { AircraftListing, Transaction } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Mock user ID - in real app would come from auth context
const CURRENT_USER_ID = "user-123";

export default function Dashboard() {
  // Fetch user's aircraft listings
  const { data: allAircraft = [] } = useQuery<AircraftListing[]>({
    queryKey: ["/api/aircraft"],
  });

  // Filter to current user's aircraft (in real app, would use /api/aircraft/owner/:ownerId)
  const userAircraft = allAircraft.filter(a => a.ownerId === CURRENT_USER_ID);
  
  // Fetch user's transactions
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions/user", CURRENT_USER_ID],
  });

  // Calculate stats
  const totalEarnings = transactions
    .filter(t => t.type === "rental" && t.status === "completed")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const pendingDeposits = transactions
    .filter(t => t.type === "rental" && t.status === "pending")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const activeListings = userAircraft.filter(a => a.isListed).length;
  const upcomingRentals = 5; // Would come from rentals API
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
              <CardTitle className="text-sm font-medium">Pending Deposits</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-pending-deposits">
                ${pendingDeposits.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                From {transactions.filter(t => t.status === "pending").length} pending rentals
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
              <CardTitle className="text-sm font-medium">Upcoming Rentals</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-upcoming-rentals">{upcomingRentals}</div>
              <p className="text-xs text-muted-foreground">
                Next rental in 2 days
              </p>
            </CardContent>
          </Card>
        </div>

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
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg hover-elevate" data-testid={`rental-active-${i}`}>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">2018 Cessna 172 Skyhawk</h4>
                        <p className="text-sm text-muted-foreground">
                          Rented to: John Smith • Dec 15-17, 2024
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold">$870.00</p>
                          <p className="text-sm text-muted-foreground">6 hours</p>
                        </div>
                        <Badge className="bg-chart-2 text-white">Active</Badge>
                        <Button size="sm" data-testid={`button-message-${i}`}>Message</Button>
                      </div>
                    </div>
                  ))}
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
                <Button variant="default" className="bg-accent text-accent-foreground hover:bg-accent" data-testid="button-request-deposit">
                  Request Deposit
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
                    {[1, 2, 3, 4, 5].map((i) => (
                      <TableRow key={i} data-testid={`transaction-${i}`}>
                        <TableCell>Dec {i}, 2024</TableCell>
                        <TableCell>Rental payout - Cessna 172</TableCell>
                        <TableCell>
                          <Badge variant="outline">Payout</Badge>
                        </TableCell>
                        <TableCell className="font-semibold">$456.75</TableCell>
                        <TableCell>
                          {i <= 2 ? (
                            <Badge className="bg-chart-2 text-white">Completed</Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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
