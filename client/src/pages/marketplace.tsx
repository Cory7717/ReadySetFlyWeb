import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MarketplaceListing, PromoAlert } from "@shared/schema";
import { MarketplaceCard } from "@/components/marketplace-card";
import { MarketplaceListingModal } from "@/components/marketplace-listing-modal";
import { SponsoredRightRail } from "@/components/banners/SponsoredRightRail";
import { Search, SlidersHorizontal, Gift, X } from "lucide-react";
import { formatPrice } from "@/lib/formatters";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { PageShell } from "@/components/layout/PageShell";

const categories = [
  { id: "aircraft-sale", label: "Aircraft For Sale", fee: "$25-100/mo" },
  { id: "job", label: "Aviation Jobs", fee: "$40/mo" },
  { id: "cfi", label: "CFIs", fee: "$30/mo" },
  { id: "flight-school", label: "Flight Schools", fee: "$250/mo" },
  { id: "mechanic", label: "Mechanics", fee: "$40/mo" },
  { id: "charter", label: "Charter Services", fee: "$250/mo" },
];

const categoryDetails: Record<string, { title: string; summary: string; helper: string }> = {
  "aircraft-sale": {
    title: "Aircraft For Sale",
    summary: "Browse listings, compare aircraft, and connect with sellers in one place.",
    helper: "Use filters for city, price, and engine type to narrow the list quickly.",
  },
  job: {
    title: "Aviation Jobs",
    summary: "Search flying, maintenance, and aviation support roles by location and keyword.",
    helper: "Keyword and distance filters are the fastest way to narrow job results.",
  },
  cfi: {
    title: "CFI Directory",
    summary: "Find instructors, compare qualifications, and reach out directly through RSF.",
    helper: "Filter by rating and city to find the right instructor match faster.",
  },
  "flight-school": {
    title: "Flight Schools",
    summary: "Explore schools and discovery-flight opportunities as new listings come online.",
    helper: "Use city and keyword filters to check what is available in your area.",
  },
  mechanic: {
    title: "Mechanic Services",
    summary: "Browse A&P and maintenance-focused listings by service and location.",
    helper: "Search by service type or city to narrow the maintenance options.",
  },
  charter: {
    title: "Charter Services",
    summary: "Review charter operators and service listings from one marketplace view.",
    helper: "Use city and keyword filters to refine the charter results.",
  },
};

export default function Marketplace() {
  const { isAuthenticated } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("aircraft-sale");
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [dismissedBanners, setDismissedBanners] = useState<string[]>([]);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [previousCategory, setPreviousCategory] = useState("aircraft-sale");
  const [showSchoolEmptyModal, setShowSchoolEmptyModal] = useState(false);
  const [hasShownSchoolEmptyModal, setHasShownSchoolEmptyModal] = useState(false);
  
  // Generic filter states
  const [cityFilter, setCityFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  
  // Category-specific filter states
  const [engineTypeFilter, setEngineTypeFilter] = useState("all"); // Aircraft Sale
  const [keywordFilter, setKeywordFilter] = useState(""); // Jobs, CFI, Flight School, Mechanic, Charter
  const [radiusFilter, setRadiusFilter] = useState("100"); // Jobs - default 100 miles
  const [cfiRatingFilter, setCfiRatingFilter] = useState("all"); // CFI ratings
  
  const [appliedQueryParams, setAppliedQueryParams] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    trackEvent("marketplace_view", { page: "/marketplace" });
  }, []);

  // Apply query params from Student Pilot CTAs
  useEffect(() => {
    if (appliedQueryParams) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type");
    const locationParam = params.get("location");
    const radiusParam = params.get("radius");
    const tagsParam = params.get("tags");

    if (type && categories.some((c) => c.id === type)) {
      setSelectedCategory(type);
    }
    if (locationParam) setCityFilter(locationParam);
    if (radiusParam) setRadiusFilter(radiusParam);
    if (tagsParam) setKeywordFilter(tagsParam);

    if (type || locationParam || radiusParam || tagsParam) {
      setShowFilters(true);
    }
    setAppliedQueryParams(true);
  }, [appliedQueryParams]);

  // Build query params for backend filtering
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (selectedCategory) params.set('category', selectedCategory);
    if (cityFilter) params.set('city', cityFilter);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (engineTypeFilter && engineTypeFilter !== 'all') params.set('engineType', engineTypeFilter);
    if (keywordFilter) params.set('keyword', keywordFilter);
    if (radiusFilter) params.set('radius', radiusFilter);
    if (cfiRatingFilter && cfiRatingFilter !== 'all') params.set('cfiRating', cfiRatingFilter);
    return params.toString();
  };

  const queryString = buildQueryParams();

  const { data: categoryListings = [], isLoading } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/marketplace", selectedCategory, cityFilter, minPrice, maxPrice, engineTypeFilter, keywordFilter, radiusFilter, cfiRatingFilter],
    queryFn: async () => {
      const response = await fetch(apiUrl(`/api/marketplace?${queryString}`));
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
      trackEvent("marketplace_category_select", { category: selectedCategory });
      
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

  useEffect(() => {
    if (isLoading) return;
    if (hasShownSchoolEmptyModal) return;
    if (selectedCategory !== "flight-school") return;
    if (categoryListings.length > 0) return;
    if (!appliedQueryParams && !cityFilter && !keywordFilter) return;
    setShowSchoolEmptyModal(true);
    setHasShownSchoolEmptyModal(true);
  }, [selectedCategory, isLoading, categoryListings.length, appliedQueryParams, cityFilter, keywordFilter, hasShownSchoolEmptyModal]);

  const currentCategory = categories.find((category) => category.id === selectedCategory) ?? categories[0];
  const currentCategoryDetail = categoryDetails[selectedCategory] ?? categoryDetails["aircraft-sale"];
  const hasActiveFilters = Boolean(
    cityFilter || minPrice || maxPrice || engineTypeFilter !== "all" || keywordFilter || radiusFilter !== "100" || cfiRatingFilter !== "all"
  );

  return (
    <PageShell
      kicker="Marketplace"
      title="Aviation Marketplace"
      description="Connect with the aviation community. Buy, sell, and find professional services."
      actions={
        <>
            <Button
              variant="default"
              onClick={() => {
                trackEvent("cta_click", { label: "marketplace_to_rentals", target: "/rentals" });
                navigate("/rentals");
              }}
            >
              Browse Rentals
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                trackEvent("cta_click", { label: "marketplace_post_listing", target: "/create-marketplace-listing" });
                if (!isAuthenticated) {
                  trackEvent("marketplace_register_prompt", { action: "post_listing" });
                  navigate("/register");
                  return;
                }
                navigate("/create-marketplace-listing");
              }}
            >
              Post a Listing
            </Button>
        </>
      }
      contentClassName="px-0 py-0"
    >
      {!isAuthenticated && (
        <div className="container mx-auto px-4 pt-6">
          <Alert>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>Create a free account to save listings and contact sellers faster.</span>
              <Button asChild size="sm">
                <Link href="/register">Create free account</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      <section className="sticky top-16 z-40 border-b border-white/10 bg-[hsl(var(--card)/0.9)] backdrop-blur-md">
        <div className="container mx-auto px-4">
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-2 py-4">
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
          </div>
        </div>
      </section>

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

        <div className="mb-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[1.2rem] border border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--primary)/0.08))] p-5 shadow-[var(--shadow-rsf-panel)]">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary/80">Browse category</div>
              <h2 className="font-display text-2xl font-bold">{currentCategoryDetail.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">{currentCategoryDetail.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters((current) => !current)}
                  data-testid="button-toggle-filters-summary"
                >
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  {showFilters ? "Hide filters" : "Refine results"}
                </Button>
                <Badge variant="outline">{categoryListings.length} active listings</Badge>
                {hasActiveFilters ? <Badge variant="secondary">Filters applied</Badge> : null}
              </div>
            </div>

            <div className="rounded-[1.2rem] border border-white/10 bg-white/75 p-5 shadow-[var(--shadow-rsf-soft)]">
              <div className="text-sm font-semibold">How to use this page</div>
              <p className="mt-2 text-sm text-muted-foreground">{currentCategoryDetail.helper}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <Button
                  variant="default"
                  onClick={() => {
                    trackEvent("marketplace_create_listing_click", { category: selectedCategory });
                    navigate("/create-marketplace-listing");
                  }}
                  data-testid="button-create-listing-summary"
                >
                  Create Listing
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    trackEvent("cta_click", { label: "marketplace_to_rentals", target: "/rentals" });
                    navigate("/rentals");
                  }}
                >
                  Browse Rentals
                </Button>
              </div>
            </div>
          </div>
          <SponsoredRightRail
            placement="marketplace"
            category={selectedCategory}
            infoTestId="button-banner-ad-info-marketplace"
            className="xl:sticky xl:top-24 xl:self-start"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex-1">
            <h2 className="font-display text-xl sm:text-2xl font-bold mb-1">
              {currentCategory.label}
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
              onClick={() => {
                trackEvent("marketplace_create_listing_click", { category: selectedCategory });
                navigate("/create-marketplace-listing");
              }}
              className="flex-1 sm:flex-initial"
              data-testid="button-create-listing"
            >
              Create Listing
            </Button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card className="mb-6 border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),rgba(255,255,255,0.74))]">
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
                          <SelectItem value="Rotor">Rotor (Helicopters)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* CFI Filters */}
                {selectedCategory === 'cfi' && (
                  <>
                    {/* Keyword Search */}
                    <div className="space-y-2">
                      <Label htmlFor="keyword-filter">Search</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="keyword-filter"
                          placeholder="Search by name, certifications..."
                          value={keywordFilter}
                          onChange={(e) => setKeywordFilter(e.target.value)}
                          className="pl-9"
                          data-testid="input-keyword-filter"
                        />
                      </div>
                    </div>

                    {/* CFI Ratings */}
                    <div className="space-y-2">
                      <Label htmlFor="cfi-rating">Rating / Certification</Label>
                      <Select value={cfiRatingFilter} onValueChange={setCfiRatingFilter}>
                        <SelectTrigger id="cfi-rating" data-testid="select-cfi-rating">
                          <SelectValue placeholder="All ratings" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All ratings</SelectItem>
                          <SelectItem value="CFI">CFI (Basic)</SelectItem>
                          <SelectItem value="CFII">CFII (Instrument)</SelectItem>
                          <SelectItem value="MEI">MEI (Multi-Engine)</SelectItem>
                          <SelectItem value="ATP">ATP</SelectItem>
                        </SelectContent>
                      </Select>
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
                  </>
                )}

                {/* Flight School, Mechanic, Charter Filters (keyword + city only) */}
                {['flight-school', 'mechanic', 'charter'].includes(selectedCategory) && (
                  <>
                    {/* Keyword Search */}
                    <div className="space-y-2">
                      <Label htmlFor="keyword-filter">Search</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="keyword-filter"
                          placeholder="Search by name, services..."
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
                  </>
                )}
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
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
                      setCfiRatingFilter("all");
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
          <div className="rounded-[1.2rem] border border-dashed border-white/14 bg-white/70 px-6 py-12 text-center shadow-[var(--shadow-rsf-soft)]">
            <h3 className="text-xl font-semibold">{currentCategoryDetail.title} are still building out</h3>
            <p className="mt-2 text-muted-foreground">
              No listings match this category yet. Try another category, widen your filters, or create the first listing here.
            </p>
            <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                variant="default"
                onClick={() => {
                  trackEvent("marketplace_create_listing_click", { category: selectedCategory, source: "empty_state" });
                  navigate("/create-marketplace-listing");
                }}
              >
                Create Listing
              </Button>
              <Button variant="outline" onClick={() => setSelectedCategory("aircraft-sale")}>
                Browse another category
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categoryListings.map((listing) => (
              <div
                key={listing.id}
                onClick={() => {
                  trackEvent("select_item", {
                    item_id: listing.id,
                    item_name: listing.title,
                    item_category: listing.category,
                    location: listing.city && listing.state ? `${listing.city}, ${listing.state}` : listing.location,
                  });
                  setSelectedListingId(listing.id);
                }}
                className="cursor-pointer"
              >
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
                  viewCount={listing.viewCount || 0}
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

      <Dialog open={showSchoolEmptyModal} onOpenChange={setShowSchoolEmptyModal}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-flight-school-empty">
          <DialogHeader>
            <DialogTitle className="text-xl">Flight schools are coming soon</DialogTitle>
            <DialogDescription className="text-base">
              We are actively onboarding flight schools in your area. Check back soon as new listings go live.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="default"
              onClick={() => setSelectedCategory("cfi")}
              data-testid="button-flight-school-to-cfi"
            >
              Explore CFIs
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowSchoolEmptyModal(false)}
              data-testid="button-flight-school-close"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
