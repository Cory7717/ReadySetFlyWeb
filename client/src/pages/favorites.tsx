import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MarketplaceListing, AircraftListing } from "@shared/schema";
import { Heart, MapPin, DollarSign, Plane, Calendar } from "lucide-react";
import { formatPrice } from "@/lib/formatters";
import { useLocation } from "wouter";
import { useState } from "react";
import { MarketplaceListingModal } from "@/components/marketplace-listing-modal";

export default function Favorites() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedMarketplaceListing, setSelectedMarketplaceListing] = useState<string | null>(null);

  const { data: favorites, isLoading } = useQuery<{ marketplace: MarketplaceListing[]; aircraft: AircraftListing[] }>({
    queryKey: ["/api/favorites"],
    enabled: !!user,
  });

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      "aircraft-sale": "Aircraft for Sale",
      "job": "Aviation Jobs",
      "cfi": "CFI Services",
      "flight-school": "Flight School",
      "mechanic": "Mechanic Services",
      "charter": "Charter Services",
    };
    return labels[category] || category;
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="text-center py-12">
            <Heart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">Please sign in to view your favorites</p>
            <Button onClick={() => navigate("/login")} data-testid="button-login">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2" data-testid="text-favorites-title">
          My Favorites
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Your saved aircraft rentals and marketplace listings
        </p>
      </div>

      <Tabs defaultValue="marketplace" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="marketplace" data-testid="tab-marketplace">
            Marketplace ({favorites?.marketplace?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="aircraft" data-testid="tab-aircraft">
            Aircraft Rentals ({favorites?.aircraft?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace" className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="h-64 bg-muted" />
                </Card>
              ))}
            </div>
          ) : favorites?.marketplace?.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Heart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">No marketplace listings saved yet</p>
                <Button onClick={() => navigate("/marketplace")} data-testid="button-browse-marketplace">
                  Browse Marketplace
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {favorites?.marketplace?.map((listing) => (
                <Card 
                  key={listing.id} 
                  className="hover-elevate cursor-pointer"
                  onClick={() => setSelectedMarketplaceListing(listing.id)}
                  data-testid={`card-marketplace-${listing.id}`}
                >
                  <CardHeader>
                    <CardTitle className="text-lg line-clamp-2">{listing.title}</CardTitle>
                    <CardDescription className="line-clamp-1">
                      {getCategoryLabel(listing.category)}
                    </CardDescription>
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
                        <span>Listed {new Date(listing.createdAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="aircraft" className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="h-64 bg-muted" />
                </Card>
              ))}
            </div>
          ) : favorites?.aircraft?.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Heart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">No aircraft saved yet</p>
                <Button onClick={() => navigate("/")} data-testid="button-browse-aircraft">
                  Browse Aircraft
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {favorites?.aircraft?.map((aircraft) => (
                <Card 
                  key={aircraft.id} 
                  className="hover-elevate cursor-pointer"
                  onClick={() => navigate(`/aircraft/${aircraft.id}`)}
                  data-testid={`card-aircraft-${aircraft.id}`}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {aircraft.year} {aircraft.make} {aircraft.model}
                    </CardTitle>
                    <CardDescription>{aircraft.registration}</CardDescription>
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
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <MarketplaceListingModal
        listingId={selectedMarketplaceListing || ""}
        open={!!selectedMarketplaceListing}
        onOpenChange={(open) => {
          if (!open) setSelectedMarketplaceListing(null);
        }}
      />
    </div>
  );
}
