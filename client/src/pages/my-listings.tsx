import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { MarketplaceListing, AircraftListing } from "@shared/schema";
import { Plane, DollarSign, MapPin, Calendar } from "lucide-react";
import { formatPrice } from "@/lib/formatters";

export default function MyListings() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: marketplaceListings = [], isLoading: loadingMarketplace } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/marketplace/user", user?.id],
    enabled: !!user?.id,
  });

  const { data: aircraftListings = [], isLoading: loadingAircraft } = useQuery<AircraftListing[]>({
    queryKey: ["/api/aircraft/owner", user?.id],
    enabled: !!user?.id,
  });

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      "aircraft-sale": "Aircraft For Sale",
      "job": "Aviation Job",
      "cfi": "CFI Services",
      "flight-school": "Flight School",
      "mechanic": "Mechanic Services",
      "charter": "Charter Services",
    };
    return labels[category] || category;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2" data-testid="text-my-listings-title">
          My Listings
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your aircraft rentals and marketplace listings
        </p>
      </div>

      <Tabs defaultValue="marketplace" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-auto">
          <TabsTrigger value="marketplace" className="text-xs sm:text-sm" data-testid="tab-marketplace-listings">
            Marketplace ({marketplaceListings.length})
          </TabsTrigger>
          <TabsTrigger value="aircraft" className="text-xs sm:text-sm" data-testid="tab-aircraft-listings">
            Rentals ({aircraftListings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
            <h2 className="text-xl sm:text-2xl font-bold">Marketplace Listings</h2>
            <Button onClick={() => navigate("/create-marketplace-listing")} className="w-full sm:w-auto" data-testid="button-create-marketplace">
              Create New Listing
            </Button>
          </div>

          {loadingMarketplace ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="h-64 bg-muted" />
                </Card>
              ))}
            </div>
          ) : marketplaceListings.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground mb-4">No marketplace listings yet</p>
                <Button onClick={() => navigate("/create-marketplace-listing")} data-testid="button-create-first-marketplace">
                  Create Your First Listing
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {marketplaceListings.map((listing) => (
                <Card key={listing.id} className="hover-elevate">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <Badge variant={listing.isActive ? "default" : "secondary"} className="mb-2">
                          {listing.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <CardTitle className="text-lg line-clamp-2">{listing.title}</CardTitle>
                        <CardDescription className="line-clamp-1">
                          {getCategoryLabel(listing.category)}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {listing.price && (
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold">
                          {formatPrice(listing.price)}
                        </span>
                      </div>
                    )}
                    {(listing.city || listing.location) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span>{listing.city ? `${listing.city}, ${listing.state}` : listing.location}</span>
                      </div>
                    )}
                    {listing.createdAt && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>Created {new Date(listing.createdAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="flex gap-2 mt-4">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1" 
                        onClick={() => navigate(`/edit-marketplace-listing/${listing.id}`)}
                        data-testid={`button-edit-marketplace-${listing.id}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        data-testid={`button-toggle-marketplace-${listing.id}`}
                      >
                        {listing.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="aircraft" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
            <h2 className="text-xl sm:text-2xl font-bold">Aircraft Rental Listings</h2>
            <Button onClick={() => navigate("/list-aircraft")} className="w-full sm:w-auto" data-testid="button-list-aircraft">
              List New Aircraft
            </Button>
          </div>

          {loadingAircraft ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="h-64 bg-muted" />
                </Card>
              ))}
            </div>
          ) : aircraftListings.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground mb-4">No aircraft listed for rent yet</p>
                <Button onClick={() => navigate("/list-aircraft")} data-testid="button-list-first-aircraft">
                  List Your First Aircraft
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {aircraftListings.map((aircraft) => (
                <Card key={aircraft.id} className="hover-elevate">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <Badge variant={aircraft.isListed ? "default" : "secondary"} className="mb-2">
                          {aircraft.isListed ? "Listed" : "Unlisted"}
                        </Badge>
                        <CardTitle className="text-lg">
                          {aircraft.year} {aircraft.make} {aircraft.model}
                        </CardTitle>
                        <CardDescription>{aircraft.registration}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold">${aircraft.hourlyRate}/hour</span>
                    </div>
                    {aircraft.location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span>{aircraft.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Plane className="w-4 h-4" />
                      <span>{aircraft.category || "Single Engine"}</span>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate(`/aircraft/${aircraft.id}`)}
                        data-testid={`button-view-aircraft-${aircraft.id}`}
                      >
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        data-testid={`button-edit-aircraft-${aircraft.id}`}
                      >
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
