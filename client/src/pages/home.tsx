import { useEffect, useState } from "react";
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
import { PageShell } from "@/components/layout/PageShell";
import { useAuth } from "@/hooks/useAuth";
import wingtipImage from "@assets/wingtip_featured_1761494838973.jpg";
import { trackEvent } from "@/lib/analytics";
import { apiUrl } from "@/lib/api";

const quickFilters = [
  { label: "IFR Equipped", value: "ifr" },
  { label: "Multi-Engine", value: "multi" },
  { label: "Glass Cockpit", value: "glass" },
];

const RENTALS_META_TITLE = "Find Aircraft Rentals Near You | ReadySetFly";
const RENTALS_META_DESCRIPTION =
  "Search verified aircraft rentals from flight schools, flying clubs, and independent operators near you and across the U.S. Compare aircraft types and rates nationwide.";

export default function Home() {
  const { isAuthenticated, user } = useAuth();
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
  const [showVerificationNudge, setShowVerificationNudge] = useState(false);

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

  return (
    <PageShell
      kicker="Rentals"
      title="Find rental aircraft without leaving the rest of your planning behind."
      description="Browse available aircraft, compare access options, then use the planner, conditions, and TFR tools in the same workflow."
      actions={
        <>
          <Badge variant="outline" className="border-white/12 bg-white/8 text-slate-100">Verified listings</Badge>
          <Button asChild className="bg-white/90 text-slate-900 hover:bg-white">
            <Link href={listAircraftHref}>Create Rental Listing</Link>
          </Button>
          <Button asChild variant="outline" className="border-white/14 bg-white/6 text-slate-100 hover:bg-white/10">
            <Link href="/marketplace">Explore Marketplace</Link>
          </Button>
        </>
      }
      contentClassName="space-y-8"
    >
      {showVerificationNudge && (
        <Alert className="border-primary/30 bg-primary/5" data-testid="alert-verification-nudge">
          <Shield className="h-4 w-4" />
          <AlertTitle>Complete Verification to Book</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Verified pilots get faster approvals and build trust with aircraft owners. Verification takes about 5
              minutes.
            </span>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" data-testid="button-verify-now">
                <Link href="/verify-identity">Verify Now →</Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
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

      <section className="rounded-[1.6rem] border border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.96),rgba(255,255,255,0.68))] p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Aircraft access</Badge>
              <Badge variant="outline">Training friendly</Badge>
              <Badge variant="outline">Plan in RSF</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[1.05rem] border border-primary/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(255,255,255,0.56))] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">1. Search by mission</div>
                <div className="mt-2 text-sm text-slate-700">Filter by aircraft type, location, and training needs before you compare listings.</div>
              </div>
              <div className="rounded-[1.05rem] border border-primary/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(255,255,255,0.56))] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">2. Check the aircraft</div>
                <div className="mt-2 text-sm text-slate-700">Review rates, avionics, insurance, and location before you request access.</div>
              </div>
              <div className="rounded-[1.05rem] border border-primary/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(255,255,255,0.56))] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">3. Plan the trip</div>
                <div className="mt-2 text-sm text-slate-700">Move into route planning, airport conditions, and airspace review once you know what you want to fly.</div>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-white/12 bg-white/80 p-4 shadow-[0_12px_26px_rgba(15,23,42,0.08)] sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="rsf-kicker">Search rentals</span>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">Start with the aircraft that matches the mission.</h2>
                </div>
                <p className="max-w-xl text-sm text-muted-foreground">
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
                      className="cursor-pointer hover-elevate text-xs sm:text-sm"
                      data-testid={`badge-filter-${filter.value}`}
                    >
                      {filter.label}
                    </Badge>
                  ))}
                </div>
                <Button
                  className="w-full rounded-full bg-accent text-accent-foreground hover:bg-accent sm:w-auto"
                  size="lg"
                  data-testid="button-search"
                  onClick={() => trackEvent("rentals_search_click", { keyword, city, state, radius })}
                >
                  <Search className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Find aircraft
                </Button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.4rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,255,255,0.5))] shadow-[0_18px_38px_rgba(15,23,42,0.12)]">
            <img
              src={wingtipImage}
              alt="Wingtip view from a rental aircraft"
              className="h-64 w-full object-cover xl:h-full"
            />
            <div className="space-y-2 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Rental access</div>
              <h3 className="text-xl font-semibold text-slate-900">Find the aircraft first, then use the rest of RSF around it.</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Compare aircraft, then move into route planning, current conditions, and TFR review without starting from scratch on another site.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4">
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="space-y-4 p-5 sm:p-6">
              <div>
                <div className="text-sm font-semibold">List your aircraft on RSF rentals</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Owners need an RSF account and verification before publishing live rental listings.
                </p>
              </div>
              <div className="rounded-lg border border-primary/20 bg-white/70 px-4 py-3 text-xs text-muted-foreground">
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
                >
                  <Link href={listAircraftHref}>Create rental listing</Link>
                </Button>
                {!isVerifiedOwner && (
                  <Button
                    variant="outline"
                    onClick={() => trackEvent("cta_click", { label: "rentals_verify_owner", target: verificationHref })}
                    asChild
                  >
                    <Link href={verificationHref}>{isAuthenticated ? "Complete verification" : "Create account"}</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-white/80 px-4 py-3 text-sm">
              <div className="text-muted-foreground">
                Want information on becoming a sponsored business?
              </div>
              <Button asChild size="sm" variant="secondary" data-testid="button-banner-ad-info-rentals">
                <a href="/banner-advertise" target="_blank" rel="noopener noreferrer">
                  Click here
                </a>
              </Button>
            </div>
            <BannerAdRotation placement="rentals" variant="compact" showLeadIn={false} />
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
            className="w-full sm:w-auto"
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
                  <div key={i} className="h-96 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredAircraft.length === 0 ? (
              <div className="rounded-[1.4rem] border border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.95),rgba(255,255,255,0.7))] px-6 py-10 text-center shadow-sm">
                <p className="text-muted-foreground">No aircraft match your current filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredAircraft.map((listing) => (
                  <AircraftCard
                    key={listing.id}
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
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-muted py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center font-display text-3xl font-bold">
            Why pilots use RSF rentals
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold">Verified pilots</h3>
              <p className="text-muted-foreground">
                All pilots are verified with license and insurance checks before they rent through the platform.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold">Insurance required</h3>
              <p className="text-muted-foreground">
                Owners and renters are required to carry the coverage needed for responsible aircraft access.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Search className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold">Built for planning</h3>
              <p className="text-muted-foreground">
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
    </PageShell>
  );
}
