import { Fragment, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, MapPin, Calendar, Shield, X } from "lucide-react";
import type { AircraftListing } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AircraftCard } from "@/components/aircraft-card";
import { AircraftFilters } from "@/components/aircraft-filters";
import { AircraftDetailModal } from "@/components/aircraft-detail-modal";
import { BannerAdRotation } from "@/components/banners/BannerAdRotation";
import { PostActionSignupPrompt } from "@/components/conversion/PostActionSignupPrompt";
import { PageShell } from "@/components/layout/PageShell";
import { PressDemoBanner, PressDemoSpotlight, type PressDemoStep, usePressDemo } from "@/components/press/PressDemo";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";
import { apiUrl } from "@/lib/api";
import { getCurrentReturnTo } from "@/lib/returnTo";

const quickFilters = [
  { label: "IFR Equipped", value: "ifr" },
  { label: "Multi-Engine", value: "multi" },
  { label: "Glass Cockpit", value: "glass" },
];

const RENTALS_META_TITLE = "Find Aircraft Rentals Near You | ReadySetFly";
const RENTALS_META_DESCRIPTION =
  "Search verified aircraft rentals from flight schools, flying clubs, and independent operators near you and across the U.S. Compare aircraft types and rates nationwide.";
const RENTAL_LISTING_AD_INTERVAL = 15;

export const shouldShowRentalAdAfterListing = (listingIndex: number) =>
  listingIndex >= 0 && (listingIndex + 1) % RENTAL_LISTING_AD_INTERVAL === 0;

const RENTALS_PRESS_STEPS: PressDemoStep[] = [
  {
    id: "search-rentals",
    title: "Search rentals by mission",
    body: "Start with the search panel to show how pilots find an aircraft without leaving the rest of RSF behind.",
  },
  {
    id: "owner-listing",
    title: "Show the owner listing path",
    body: "Highlight how owners and clubs verify and publish aircraft listings directly inside RSF.",
  },
  {
    id: "browse-results",
    title: "Browse and compare results",
    body: "Finish on the aircraft results so viewers see how pilots compare options before moving into planning.",
  },
];

export default function Home() {
  const { isAuthenticated, user } = useAuth();
  const pressDemo = usePressDemo(RENTALS_PRESS_STEPS);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
  const [showVerificationNudge, setShowVerificationNudge] = useState(false);
  const [showBrowseSignupPrompt, setShowBrowseSignupPrompt] = useState(false);

  useEffect(() => {
    trackEvent("rentals_view", { page: "/rentals" });
  }, []);

  useEffect(() => {
    const previousTitle = document.title;
    let descriptionElement = document.querySelector("meta[name='description']");
    const previousDescription = descriptionElement?.getAttribute("content");
    let createdDescription = false;

    document.title = RENTALS_META_TITLE;
    if (descriptionElement) {
      descriptionElement.setAttribute("content", RENTALS_META_DESCRIPTION);
    } else {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      meta.setAttribute("content", RENTALS_META_DESCRIPTION);
      document.head.appendChild(meta);
      descriptionElement = meta;
      createdDescription = true;
    }

    return () => {
      document.title = previousTitle;
      if (createdDescription && descriptionElement) {
        descriptionElement.remove();
        return;
      }
      if (descriptionElement && typeof previousDescription === "string") {
        descriptionElement.setAttribute("content", previousDescription);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const aircraftIdParam = params.get("aircraftId");
    if (aircraftIdParam) {
      setSelectedAircraftId(aircraftIdParam);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || user?.identityVerified || typeof window === "undefined") {
      setShowVerificationNudge(false);
      return;
    }

    const sessionKey = "rsf_verification_nudge_session";
    let sessionId = window.sessionStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = String(Date.now());
      window.sessionStorage.setItem(sessionKey, sessionId);
    }
    const dismissedForSession = window.localStorage.getItem("rsf_verification_nudge_dismissed") === sessionId;
    setShowVerificationNudge(!dismissedForSession);
  }, [isAuthenticated, user?.identityVerified]);

  useEffect(() => {
    if (isAuthenticated || !selectedAircraftId) return;
    setShowBrowseSignupPrompt(true);
  }, [isAuthenticated, selectedAircraftId]);

  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [radius, setRadius] = useState("100");
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedAvionics, setSelectedAvionics] = useState<string[]>([]);
  const [insuranceIncluded, setInsuranceIncluded] = useState(false);
  const [wetRateOnly, setWetRateOnly] = useState(false);

  const { data: aircraft = [], isLoading } = useQuery<AircraftListing[]>({
    queryKey: [
      "/api/aircraft",
      {
        certifications: selectedCertifications.join(","),
        category: selectedCategories.join(","),
        avionics: selectedAvionics.join(","),
        insuranceIncluded,
        wetRateOnly,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCertifications.length > 0) {
        params.set("certifications", selectedCertifications.join(","));
      }
      if (selectedCategories.length > 0) {
        params.set("category", selectedCategories.join(","));
      }
      if (selectedAvionics.length > 0) {
        params.set("avionics", selectedAvionics.join(","));
      }
      if (insuranceIncluded) {
        params.set("insuranceIncluded", "true");
      }
      if (wetRateOnly) {
        params.set("wetRate", "true");
      }
      const response = await fetch(apiUrl(`/api/aircraft${params.toString() ? `?${params.toString()}` : ""}`), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch aircraft listings");
      }
      return response.json();
    },
  });

  const filteredAircraft = aircraft.filter((item) => {
    if (keyword) {
      const searchText = `${item.make} ${item.model} ${item.registration}`.toLowerCase();
      if (!searchText.includes(keyword.toLowerCase())) {
        return false;
      }
    }
    if (city && item.location) {
      if (!item.location.toLowerCase().includes(city.toLowerCase())) {
        return false;
      }
    }
    if (state && item.location) {
      if (!item.location.toLowerCase().includes(state.toLowerCase())) {
        return false;
      }
    }
    if (selectedCertifications.length > 0) {
      const hasRequiredCert = selectedCertifications.every((cert) =>
        item.requiredCertifications?.includes(cert),
      );
      if (!hasRequiredCert) {
        return false;
      }
    }
    if (selectedCategories.length > 0 && !selectedCategories.includes(item.category)) {
      return false;
    }
    if (selectedAvionics.length > 0) {
      const listingAvionics = (item.avionicsSuite || "").toLowerCase();
      const matchesAvionics = selectedAvionics.some((suite) => listingAvionics.includes(suite.toLowerCase()));
      if (!matchesAvionics) {
        return false;
      }
    }
    if (insuranceIncluded && !item.insuranceIncluded) {
      return false;
    }
    if (wetRateOnly && !item.wetRate) {
      return false;
    }
    return true;
  });

  const handleClearFilters = () => {
    setKeyword("");
    setCity("");
    setState("");
    setRadius("100");
    setSelectedCertifications([]);
    setSelectedCategories([]);
    setSelectedAvionics([]);
    setInsuranceIncluded(false);
    setWetRateOnly(false);
  };
  const isVerifiedOwner = Boolean(user?.isVerified);
  const listAircraftHref = !isAuthenticated ? "/register" : "/list-aircraft";
  const verificationHref = !isAuthenticated ? "/register" : "/verify-identity";
  const rentalsPanelClass = "rsf-metal-panel text-[#E8EDF4]";
  const rentalsSubpanelClass = "rsf-rentals-subpanel rounded-[1rem] text-[#DCE6F2]";
  const rentalsPrimaryButtonClass = "rsf-metal-button-primary";
  const rentalsSecondaryButtonClass = "rsf-metal-button-secondary";
  const renderRentalInlineAd = (slotNumber: number) => (
    <div
      data-testid={`rental-listing-ad-slot-${slotNumber}`}
    >
      <BannerAdRotation
        placement="rentals"
        variant="listingCard"
        showLeadIn={false}
        includeAllActiveFallback
      />
    </div>
  );

  return (
    <PageShell
      kicker="Rentals"
      title="Search rentals"
      description="Find aircraft by type, location, access requirements, and availability."
      actions={
        <>
          <Badge variant="outline" className="border-white/12 bg-white/8 text-slate-100">Verified listings</Badge>
          {isAuthenticated && !isVerifiedOwner ? (
            <Button asChild variant="outline" className={rentalsSecondaryButtonClass}>
              <Link href={verificationHref}>Complete Verification</Link>
            </Button>
          ) : null}
          <Button asChild className={rentalsPrimaryButtonClass}>
            <Link href={listAircraftHref}>Create Rental Listing</Link>
          </Button>
          <Button asChild variant="outline" className={rentalsSecondaryButtonClass}>
            <Link href="/marketplace">Explore Marketplace</Link>
          </Button>
        </>
      }
      canopyClassName="rsf-metal-hero border-b border-white/10"
      contentClassName="rsf-rentals-theme space-y-6"
    >
      {pressDemo.enabled && (
        <PressDemoBanner
          pageLabel="Rentals"
          stepIndex={pressDemo.stepIndex}
          totalSteps={pressDemo.steps.length}
          currentStep={pressDemo.currentStep}
          onPrevious={pressDemo.previousStep}
          onNext={pressDemo.nextStep}
          onExit={pressDemo.exitDemo}
        />
      )}
      {!pressDemo.enabled && showVerificationNudge && (
        <Alert className={`${rentalsPanelClass} border-[#45658b]/34`} data-testid="alert-verification-nudge">
          <Shield className="h-4 w-4" />
          <AlertTitle>Complete Verification to Book</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Verified pilots get faster approvals and build trust with aircraft owners. Verification takes about 5
              minutes.
            </span>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" className={rentalsPrimaryButtonClass} data-testid="button-verify-now">
                <Link href="/verify-identity">Verify Now</Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#A9BBCD] hover:bg-transparent hover:text-[#F5F8FC]"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    const sessionId = window.sessionStorage.getItem("rsf_verification_nudge_session");
                    if (sessionId) {
                      window.localStorage.setItem("rsf_verification_nudge_dismissed", sessionId);
                    }
                  }
                  setShowVerificationNudge(false);
                }}
                data-testid="button-dismiss-verification-nudge"
                aria-label="Dismiss verification reminder"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <PressDemoSpotlight
        active={pressDemo.isActive("search-rentals")}
        stepNumber={(pressDemo.getStep("search-rentals")?.index ?? 0) + 1}
        title={pressDemo.getStep("search-rentals")?.title ?? "Search rentals"}
        body={pressDemo.getStep("search-rentals")?.body ?? ""}
      >
      <section className={`${rentalsPanelClass} rounded-[1.6rem] p-5 sm:p-6`}>
            <div className={`${rentalsSubpanelClass} p-4 sm:p-5`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="rsf-kicker">Search rentals</span>
                  <h2 className="mt-2 text-2xl font-semibold text-[#F5F8FC]">Start with the aircraft that matches the mission.</h2>
                </div>
                <p className="max-w-xl text-sm text-[#A9BBCD]">
                  Use the quick search below, then narrow the results with filters once you see what is available.
                </p>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 sm:gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium sm:mb-2 sm:text-sm">Aircraft Type</label>
                  <Select data-testid="select-aircraft-type">
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Any type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single-Engine</SelectItem>
                      <SelectItem value="multi">Multi-Engine</SelectItem>
                      <SelectItem value="jet">Jet</SelectItem>
                      <SelectItem value="turboprop">Turboprop</SelectItem>
                      <SelectItem value="helicopter">Helicopter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium sm:mb-2 sm:text-sm">Certification Required</label>
                  <Select data-testid="select-certification">
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Select certification" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ppl">PPL</SelectItem>
                      <SelectItem value="ir">IR</SelectItem>
                      <SelectItem value="cpl">CPL</SelectItem>
                      <SelectItem value="multi">Multi-Engine</SelectItem>
                      <SelectItem value="atp">ATP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium sm:mb-2 sm:text-sm">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="City or airport code"
                      className="pl-10 text-sm"
                      data-testid="input-location"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium sm:mb-2 sm:text-sm">Dates</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="date"
                      className="pl-10 text-sm"
                      data-testid="input-dates"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex flex-wrap gap-2">
                  {quickFilters.map((filter) => (
                    <Badge
                      key={filter.value}
                      variant="outline"
                      className="cursor-pointer border-[#5d6f85]/24 bg-[#141b24] text-xs text-[#E8EDF4] hover:border-[#6d87a6]/30 hover:bg-[#18212c] sm:text-sm"
                      data-testid={`badge-filter-${filter.value}`}
                    >
                      {filter.label}
                    </Badge>
                  ))}
                </div>
                <Button
                  className={`w-full sm:w-auto ${rentalsPrimaryButtonClass}`}
                  size="lg"
                  data-testid="button-search"
                  onClick={() => trackEvent("rentals_search_click", { keyword, city, state, radius })}
                >
                  <Search className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Find aircraft
                </Button>
              </div>
            </div>
      </section>
      </PressDemoSpotlight>

      <PressDemoSpotlight
        active={pressDemo.isActive("browse-results")}
        stepNumber={(pressDemo.getStep("browse-results")?.index ?? 0) + 1}
        title={pressDemo.getStep("browse-results")?.title ?? "Browse aircraft"}
        body={pressDemo.getStep("browse-results")?.body ?? ""}
      >
      <section className="container mx-auto px-4 py-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <span className="rsf-kicker">Available aircraft</span>
            <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl" data-testid="text-results-title">
              Browse aircraft that match your mission
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              <span data-testid="text-results-count">{filteredAircraft.length}</span> aircraft match your current search
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={`w-full sm:w-auto ${rentalsSecondaryButtonClass}`}
            data-testid="button-toggle-filters"
          >
            {showFilters ? "Hide" : "Show"} filters
          </Button>
        </div>

        <div className="flex gap-8">
          {showFilters && (
            <aside className="w-80 flex-shrink-0">
              <AircraftFilters
                keyword={keyword}
                setKeyword={setKeyword}
                city={city}
                setCity={setCity}
                state={state}
                setState={setState}
                radius={radius}
                setRadius={setRadius}
                selectedCertifications={selectedCertifications}
                onCertificationsChange={setSelectedCertifications}
                selectedCategories={selectedCategories}
                onCategoriesChange={setSelectedCategories}
                selectedAvionics={selectedAvionics}
                onAvionicsChange={setSelectedAvionics}
                insuranceIncluded={insuranceIncluded}
                onInsuranceIncludedChange={setInsuranceIncluded}
                wetRateOnly={wetRateOnly}
                onWetRateOnlyChange={setWetRateOnly}
                onClearAll={handleClearFilters}
              />
            </aside>
          )}

          <div className="flex-1">
            {isLoading ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-96 rounded-xl border border-[#5d6f85]/16 bg-[linear-gradient(180deg,rgba(18,22,28,0.96),rgba(9,12,16,0.98))] animate-pulse" />
                ))}
              </div>
            ) : filteredAircraft.length === 0 ? (
              <div className={`${rentalsPanelClass} rounded-[1.4rem] px-6 py-10 text-center`}>
                <p className="text-[#A9BBCD]">No aircraft match your current filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredAircraft.map((listing, index) => (
                  <Fragment key={listing.id}>
                    <AircraftCard
                      id={listing.id}
                      make={listing.make}
                      model={listing.model}
                      year={listing.year}
                      hourlyRate={listing.hourlyRate}
                      image={listing.images[0] || "https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=800"}
                      location={`${listing.location}${listing.airportCode ? ` (${listing.airportCode})` : ""}`}
                      certifications={listing.requiredCertifications}
                      totalTime={listing.totalTime}
                      avionics={listing.avionicsSuite || "N/A"}
                      insuranceIncluded={listing.insuranceIncluded || false}
                      responseTime={listing.responseTime || 24}
                      acceptanceRate={listing.acceptanceRate || 95}
                      viewCount={listing.viewCount || 0}
                      isExample={(listing as any).isExample || false}
                      onCardClick={() => {
                        trackEvent("select_item", {
                          item_id: listing.id,
                          item_name: `${listing.make} ${listing.model}`,
                          item_category: "rental_aircraft",
                          location: listing.location,
                        });
                        setSelectedAircraftId(listing.id);
                      }}
                    />
                    {!pressDemo.enabled && shouldShowRentalAdAfterListing(index) ? (
                      renderRentalInlineAd(Math.floor(index / RENTAL_LISTING_AD_INTERVAL) + 1)
                    ) : null}
                  </Fragment>
                ))}
                {!pressDemo.enabled && filteredAircraft.length < RENTAL_LISTING_AD_INTERVAL
                  ? renderRentalInlineAd(1)
                  : null}
              </div>
            )}
          </div>
        </div>
      </section>
      </PressDemoSpotlight>

      <section className="container mx-auto px-4">
        <PressDemoSpotlight
          active={pressDemo.isActive("owner-listing")}
          stepNumber={(pressDemo.getStep("owner-listing")?.index ?? 0) + 1}
          title={pressDemo.getStep("owner-listing")?.title ?? "Owner listing"}
          body={pressDemo.getStep("owner-listing")?.body ?? ""}
        >
          <Card className={rentalsPanelClass}>
            <CardContent className="space-y-4 p-5 sm:p-6">
              <div>
                <div className="text-sm font-semibold text-[#F5F8FC]">List your aircraft on RSF rentals</div>
                <p className="mt-1 text-sm text-[#A9BBCD]">
                  Owners need an RSF account and verification before publishing live rental listings.
                </p>
              </div>
              <div className={`${rentalsSubpanelClass} px-4 py-3 text-xs text-[#A9BBCD]`}>
                {!isAuthenticated
                  ? "Create your free account first, then complete owner verification and publish your listing."
                  : isVerifiedOwner
                    ? "Your account is verified. You can create a rental listing now."
                    : "Finish verification first so your rental listing can be approved and shown to pilots."}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => trackEvent("cta_click", { label: "rentals_create_listing", target: listAircraftHref })}
                  asChild
                  className={rentalsPrimaryButtonClass}
                >
                  <Link href={listAircraftHref}>Create rental listing</Link>
                </Button>
                {!isVerifiedOwner && (
                  <Button
                    variant="outline"
                    className={rentalsSecondaryButtonClass}
                    onClick={() => trackEvent("cta_click", { label: "rentals_verify_owner", target: verificationHref })}
                    asChild
                  >
                    <Link href={verificationHref}>{isAuthenticated ? "Complete verification" : "Create account"}</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </PressDemoSpotlight>
      </section>

      <section className="rsf-metal-section py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center font-display text-3xl font-bold">
            Why pilots use RSF rentals
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className={`${rentalsPanelClass} p-6 text-center`}>
              <div className="rsf-metal-icon-chip mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold">Verified pilots</h3>
              <p className="text-[#A9BBCD]">
                All pilots are verified with license and insurance checks before they rent through the platform.
              </p>
            </div>
            <div className={`${rentalsPanelClass} p-6 text-center`}>
              <div className="rsf-metal-icon-chip mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold">Insurance required</h3>
              <p className="text-[#A9BBCD]">
                Owners and renters are required to carry the coverage needed for responsible aircraft access.
              </p>
            </div>
            <div className={`${rentalsPanelClass} p-6 text-center`}>
              <div className="rsf-metal-icon-chip mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                <Search className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold">Built for planning</h3>
              <p className="text-[#A9BBCD]">
                Once you find the aircraft, RSF keeps you in the same workflow for weather, routes, and airspace review.
              </p>
            </div>
          </div>
        </div>
      </section>

      {selectedAircraftId && (
        <AircraftDetailModal
          aircraftId={selectedAircraftId}
          open={!!selectedAircraftId}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setSelectedAircraftId(null);
          }}
        />
      )}
      <PostActionSignupPrompt
        visible={showBrowseSignupPrompt && !isAuthenticated}
        source="rentals"
        returnTo={getCurrentReturnTo()}
        onDismiss={() => setShowBrowseSignupPrompt(false)}
      />
    </PageShell>
  );
}
