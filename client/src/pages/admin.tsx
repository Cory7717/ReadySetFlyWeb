import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, Plane, List } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { User, AircraftListing, MarketplaceListing } from "@shared/schema";

export default function AdminDashboard() {
  const [userSearch, setUserSearch] = useState("");
  const [activeTab, setActiveTab] = useState("users");

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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="aircraft" data-testid="tab-aircraft">
            <Plane className="h-4 w-4 mr-2" />
            Aircraft Listings
          </TabsTrigger>
          <TabsTrigger value="marketplace" data-testid="tab-marketplace">
            <List className="h-4 w-4 mr-2" />
            Marketplace Listings
          </TabsTrigger>
        </TabsList>

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
    </div>
  );
}
