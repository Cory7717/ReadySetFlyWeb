import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MarketplaceListing, PromoAlert } from "@shared/schema";
import { MarketplaceCard } from "@/components/marketplace-card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { MarketplaceListingModal } from "@/components/marketplace-listing-modal";
import { Search, SlidersHorizontal, Gift, X } from "lucide-react";
import { formatPrice } from "@/lib/formatters";

const categories = [
  { id: "aircraft-sale", label: "Aircraft For Sale", fee: "$40-125/mo" },
  { id: "job", label: "Aviation Jobs", fee: "$25/mo" },
  { id: "cfi", label: "CFIs", fee: "$40/mo" },
  { id: "flight-school", label: "Flight Schools", fee: "$175/mo" },
  { id: "mechanic", label: "Mechanics", fee: "$40/mo" },
  { id: "charter", label: "Charter Services", fee: "$250/mo" },
];

export default function Marketplace() {
  const [selectedCategory, setSelectedCategory] = useState("aircraft-sale");
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [dismissedBanners, setDismissedBanners] = useState<string[]>([]);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [previousCategory, setPreviousCategory] = useState("aircraft-sale");
  
  // Generic filter states
  const [cityFilter, setCityFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  
  // Category-specific filter states
  const [engineTypeFilter, setEngineTypeFilter] = useState("all"); // Aircraft Sale
  const [keywordFilter, setKeywordFilter] = useState(""); // Jobs
  const [radiusFilter, setRadiusFilter] = useState("100"); // Jobs - default 100 miles
  
  const [, navigate] = useLocation();

  // Build query params for backend filtering
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (selectedCategory) params.set('category', selectedCategory);
    if (cityFilter) params.set('city', cityFilter);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (engineTypeFilter) params.set('engineType', engineTypeFilter);
    if (keywordFilter) params.set('keyword', keywordFilter);
    if (radiusFilter) params.set('radius', radiusFilter);
    return params.toString();
  };

  const queryString = buildQueryParams();

  const { data: categoryListings = [], isLoading } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/marketplace", selectedCategory, cityFilter, minPrice, maxPrice, engineTypeFilter, keywordFilter, radiusFilter],
    queryFn: async () => {
      const response = await fetch(`/api/marketplace?${queryString}`);
      if (!response.ok) throw new Error('Failed to fetch listings');
      return response.json();
    },
  });

  const { data: promoAlerts = [] } = useQuery<PromoAlert[]>({
    queryKey: ["/api/promo-alerts"],
  });

  // Detect category changes and show promo modal
  useEffect(() => {
    if (previousCategory !== selectedCategory) {
      setPreviousCategory(selectedCategory);
      
      // Check if user has seen promo for this category
      const seenKey = `promo-seen-${selectedCategory}`;
      const hasSeen = localStorage.getItem(seenKey);
      
      if (!hasSeen) {
        const categoryAlert = promoAlerts.find(
          alert => alert.showOnCategoryPages && 
          (!alert.targetCategories || alert.targetCategories.length === 0 || alert.targetCategories.includes(selectedCategory))
        );
        
        if (categoryAlert) {
          setShowPromoModal(true);
          localStorage.setItem(seenKey, 'true');
        }
      }
    }
  }, [selectedCategory, previousCategory, promoAlerts]);

  const handleDismissBanner = (alertId: string) => {
    setDismissedBanners(prev => [...prev, alertId]);
  };

  // Filter alerts for main page banner
  const mainPageAlerts = promoAlerts.filter(
    alert => alert.showOnMainPage && !dismissedBanners.includes(alert.id)
  );

  // Get current category alert for modal
  const categoryAlert = promoAlerts.find(
    alert => alert.showOnCategoryPages && 
    (!alert.targetCategories || alert.targetCategories.length === 0 || alert.targetCategories.includes(selectedCategory))
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="bg-muted py-8 sm:py-12">
        <div className="container mx-auto px-4">
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3 sm:mb-4" data-testid="text-marketplace-title">
            Aviation Marketplace
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-3xl">
            Connect with the aviation community. Buy, sell, and find professional services.
          </p>
        </div>
      </section>

      {/* Category Navigation */}
      <section className="border-b bg-background sticky top-16 z-40">
        <div className="container mx-auto px-4">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 py-4">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category.id)}
                  className="rounded-full shrink-0"
                  data-testid={`button-category-${category.id}`}
                >
                  {category.label}
                  <span className="ml-2 text-xs opacity-70">{category.fee}</span>
                </Button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </section>

      {/* Listings */}
      <section className="container mx-auto px-4 py-12">
        {/* Promotional Alerts Banner */}
        {mainPageAlerts.map((alert) => (
          <Alert 
            key={alert.id} 
            className="mb-6 border-green-500 bg-green-50 dark:bg-green-950/20"
            data-testid={`alert-promo-${alert.id}`}
          >
            <Gift className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div className="flex-1">
              <AlertTitle className="text-green-800 dark:text-green-200 font-semibold">
                {alert.title}
              </AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-300">
                {alert.message}
                {alert.promoCode && (
                  <span className="inline-block ml-2 px-2 py-1 bg-green-600 text-white text-xs font-mono rounded">
                    {alert.promoCode}
                  </span>
                )}
              </AlertDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDismissBanner(alert.id)}
              className="text-green-600 hover:text-green-800 dark:text-green-400"
              data-testid={`button-dismiss-alert-${alert.id}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </Alert>
        ))}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex-1">
            <h2 className="font-display text-xl sm:text-2xl font-bold mb-1">
              {categories.find(c => c.id === selectedCategory)?.label}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              <span data-testid="text-marketplace-count">{categoryListings.length}</span> active listings
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)}
              className="flex-1 sm:flex-initial"
              data-testid="button-toggle-filters"
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <Button 
              variant="default" 
              onClick={() => navigate("/create-marketplace-listing")}
              className="flex-1 sm:flex-initial"
              data-testid="button-create-listing"
            >
              Create Listing
            </Button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Aviation Jobs Filters */}
                {selectedCategory === 'job' && (
                  <>
                    {/* Keyword Search */}
                    <div className="space-y-2">
                      <Label htmlFor="keyword-filter">Keyword Search</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="keyword-filter"
                          placeholder="e.g. pilot, mechanic, CFI..."
                          value={keywordFilter}
                          onChange={(e) => setKeywordFilter(e.target.value)}
                          className="pl-9"
                          data-testid="input-keyword-filter"
                        />
                      </div>
                    </div>

                    {/* City Filter */}
                    <div className="space-y-2">
                      <Label htmlFor="city-filter">City</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="city-filter"
                          placeholder="Search by city..."
                          value={cityFilter}
                          onChange={(e) => setCityFilter(e.target.value)}
                          className="pl-9"
                          data-testid="input-city-filter"
                        />
                      </div>
                    </div>

                    {/* Radius Filter */}
                    <div className="space-y-2">
                      <Label htmlFor="radius-filter">Distance (miles)</Label>
                      <Select value={radiusFilter} onValueChange={setRadiusFilter}>
                        <SelectTrigger id="radius-filter" data-testid="select-radius-filter">
                          <SelectValue placeholder="Select radius" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">Within 10 miles</SelectItem>
                          <SelectItem value="25">Within 25 miles</SelectItem>
                          <SelectItem value="50">Within 50 miles</SelectItem>
                          <SelectItem value="100">Within 100 miles</SelectItem>
                          <SelectItem value="250">Within 250 miles</SelectItem>
                          <SelectItem value="500">Within 500 miles</SelectItem>
                          <SelectItem value="999999">Any distance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Aircraft Sale Filters */}
                {selectedCategory === 'aircraft-sale' && (
                  <>
                    {/* City Filter */}
                    <div className="space-y-2">
                      <Label htmlFor="city-filter">City</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="city-filter"
                          placeholder="Search by city..."
                          value={cityFilter}
                          onChange={(e) => setCityFilter(e.target.value)}
                          className="pl-9"
                          data-testid="input-city-filter"
                        />
                      </div>
                    </div>

                    {/* Min Price */}
                    <div className="space-y-2">
                      <Label htmlFor="min-price">Min Price</Label>
                      <Input
                        id="min-price"
                        type="number"
                        placeholder="$0"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        data-testid="input-min-price"
                      />
                    </div>

                    {/* Max Price */}
                    <div className="space-y-2">
                      <Label htmlFor="max-price">Max Price</Label>
                      <Input
                        id="max-price"
                        type="number"
                        placeholder="No max"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        data-testid="input-max-price"
                      />
                    </div>

                    {/* Engine Type */}
                    <div className="space-y-2">
                      <Label htmlFor="engine-type">Engine Type</Label>
                      <Select value={engineTypeFilter} onValueChange={setEngineTypeFilter}>
                        <SelectTrigger id="engine-type" data-testid="select-engine-type">
                          <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All types</SelectItem>
                          <SelectItem value="Single-Engine">Single-Engine</SelectItem>
                          <SelectItem value="Multi-Engine">Multi-Engine</SelectItem>
                          <SelectItem value="Turboprop">Turboprop</SelectItem>
                          <SelectItem value="Jet">Jet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Default Filters for Other Categories */}
                {!['job', 'aircraft-sale'].includes(selectedCategory) && (
                  <>
                    {/* City Filter */}
                    <div className="space-y-2">
                      <Label htmlFor="city-filter">City</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="city-filter"
                          placeholder="Search by city..."
                          value={cityFilter}
                          onChange={(e) => setCityFilter(e.target.value)}
                          className="pl-9"
                          data-testid="input-city-filter"
                        />
                      </div>
                    </div>

                    {/* Min Price */}
                    <div className="space-y-2">
                      <Label htmlFor="min-price">Min Price</Label>
                      <Input
                        id="min-price"
                        type="number"
                        placeholder="$0"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        data-testid="input-min-price"
                      />
                    </div>

                    {/* Max Price */}
                    <div className="space-y-2">
                      <Label htmlFor="max-price">Max Price</Label>
                      <Input
                        id="max-price"
                        type="number"
                        placeholder="No max"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        data-testid="input-max-price"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Clear Filters */}
              {(cityFilter || minPrice || maxPrice || engineTypeFilter || keywordFilter || radiusFilter) && (
                <div className="mt-4 flex justify-end">
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      setCityFilter("");
                      setMinPrice("");
                      setMaxPrice("");
                      setEngineTypeFilter("all");
                      setKeywordFilter("");
                      setRadiusFilter("100");
                    }}
                    data-testid="button-clear-filters"
                  >
                    Clear all filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Results Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : categoryListings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No listings in this category yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categoryListings.map((listing) => (
              <div key={listing.id} onClick={() => setSelectedListingId(listing.id)} className="cursor-pointer">
                <MarketplaceCard
                  id={listing.id}
                  category={listing.category}
                  title={listing.title}
                  description={listing.description}
                  price={formatPrice(listing.price)}
                  location={listing.city && listing.state ? `${listing.city}, ${listing.state}` : (listing.location || "N/A")}
                  image={listing.images?.[0]}
                  images={listing.images?.length || 0}
                  tier={listing.tier || undefined}
                  isExample={(listing as any).isExample || false}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Listing Detail Modal */}
      {selectedListingId && (
        <MarketplaceListingModal
          listingId={selectedListingId}
          open={!!selectedListingId}
          onOpenChange={(open) => !open && setSelectedListingId(null)}
        />
      )}

      {/* Category-Specific Promo Modal */}
      {categoryAlert && (
        <Dialog open={showPromoModal} onOpenChange={setShowPromoModal}>
          <DialogContent className="sm:max-w-md" data-testid="dialog-promo-modal">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                  <Gift className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-xl">{categoryAlert.title}</DialogTitle>
                </div>
              </div>
              <DialogDescription className="text-base">
                {categoryAlert.message}
              </DialogDescription>
            </DialogHeader>
            
            {categoryAlert.promoCode && (
              <div className="mt-4 p-4 bg-muted rounded-lg border-2 border-dashed border-green-500">
                <p className="text-sm text-muted-foreground mb-2 text-center">Your Promo Code</p>
                <p className="text-2xl font-mono font-bold text-center text-green-600 dark:text-green-400" data-testid="text-promo-code">
                  {categoryAlert.promoCode}
                </p>
              </div>
            )}
            
            <div className="flex justify-end mt-4">
              <Button onClick={() => setShowPromoModal(false)} data-testid="button-close-promo-modal">
                Got it, thanks!
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
