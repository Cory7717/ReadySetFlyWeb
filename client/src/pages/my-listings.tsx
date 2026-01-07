import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { MarketplaceListing, AircraftListing } from "@shared/schema";
import { Plane, DollarSign, MapPin, Calendar, RefreshCw, TrendingUp, Eye } from "lucide-react";
import { formatPrice } from "@/lib/formatters";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { UpgradeListingModal } from "@/components/upgrade-listing-modal";

export default function MyListings() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedListingForUpgrade, setSelectedListingForUpgrade] = useState<MarketplaceListing | null>(null);

  const { data: marketplaceListings = [], isLoading: loadingMarketplace } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/marketplace/user", user?.id],
    enabled: !!user?.id,
  });

  const { data: aircraftListings = [], isLoading: loadingAircraft } = useQuery<AircraftListing[]>({
    queryKey: ["/api/aircraft/owner", user?.id],
    enabled: !!user?.id,
  });

  // Refresh aircraft listing mutation
  const refreshAircraftMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/aircraft/${id}/refresh`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aircraft/owner", user?.id] });
      toast({ 
        title: "Listing refreshed",
        description: "Your aircraft listing has been marked as recently reviewed."
      });
    },
    onError: () => {
      toast({
        title: "Failed to refresh",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  // Refresh marketplace listing mutation
  const refreshMarketplaceMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/marketplace/${id}/refresh`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/user", user?.id] });
      toast({ 
        title: "Listing refreshed",
        description: "Your marketplace listing has been marked as recently reviewed."
      });
    },
    onError: () => {
      toast({
        title: "Failed to refresh",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
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
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Eye className="w-4 h-4" />
                      <span>{listing.viewCount || 0} views</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {listing.tier === 'basic' ? 'Basic' : listing.tier === 'standard' ? 'Standard' : 'Premium'} Tier
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1" 
                          onClick={() => navigate(`/edit-marketplace-listing/${listing.id}`)}
                          data-testid={`button-edit-marketplace-${listing.id}`}
                        >
                          Edit
                        </Button>
                        {listing.tier !== 'premium' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setSelectedListingForUpgrade(listing)}
                            data-testid={`button-upgrade-marketplace-${listing.id}`}
                          >
                            <TrendingUp className="h-4 w-4 mr-1" />
                            Upgrade
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => refreshMarketplaceMutation.mutate(listing.id)}
                          disabled={refreshMarketplaceMutation.isPending}
                          data-testid={`button-refresh-marketplace-${listing.id}`}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
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
                        onClick={() => navigate(`/edit-aircraft/${aircraft.id}`)}
                        data-testid={`button-edit-aircraft-${aircraft.id}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => refreshAircraftMutation.mutate(aircraft.id)}
                        disabled={refreshAircraftMutation.isPending}
                        data-testid={`button-refresh-aircraft-${aircraft.id}`}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedListingForUpgrade && (
        <UpgradeListingModal
          listing={selectedListingForUpgrade}
          isOpen={!!selectedListingForUpgrade}
          onClose={() => setSelectedListingForUpgrade(null)}
        />
      )}
    </div>
  );
}
