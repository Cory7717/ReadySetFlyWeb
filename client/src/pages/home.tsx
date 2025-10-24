import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, Calendar, Shield } from "lucide-react";
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
import { AircraftCard } from "@/components/aircraft-card";
import { AircraftFilters } from "@/components/aircraft-filters";
import { AircraftDetailModal } from "@/components/aircraft-detail-modal";

const quickFilters = [
  { label: "IFR Equipped", value: "ifr" },
  { label: "Multi-Engine", value: "multi" },
  { label: "Glass Cockpit", value: "glass" },
];

export default function Home() {
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);

  const { data: aircraft = [], isLoading } = useQuery<AircraftListing[]>({
    queryKey: ["/api/aircraft"],
  });

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[600px] bg-gradient-to-r from-primary/20 to-secondary/20 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-transparent z-10" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=1600')] bg-cover bg-center" />
        
        <div className="relative z-20 w-full max-w-5xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="font-display text-5xl md:text-6xl font-bold text-white mb-4" data-testid="text-hero-title">
              Find Your Perfect Aircraft
            </h1>
            <p className="text-xl text-white/90 max-w-2xl mx-auto">
              Rent from certified aircraft owners. Fly with confidence.
            </p>
          </div>

          {/* Search Card */}
          <div className="bg-background/95 backdrop-blur-lg rounded-2xl shadow-2xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Aircraft Type</label>
                <Select data-testid="select-aircraft-type">
                  <SelectTrigger>
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
                <label className="text-sm font-medium mb-2 block">Certification Required</label>
                <Select data-testid="select-certification">
                  <SelectTrigger>
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
                <label className="text-sm font-medium mb-2 block">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="City or airport code"
                    className="pl-10"
                    data-testid="input-location"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Dates</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    className="pl-10"
                    data-testid="input-dates"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-wrap gap-2 flex-1">
                {quickFilters.map((filter) => (
                  <Badge
                    key={filter.value}
                    variant="outline"
                    className="cursor-pointer hover-elevate"
                    data-testid={`badge-filter-${filter.value}`}
                  >
                    {filter.label}
                  </Badge>
                ))}
              </div>
              <Button className="bg-accent text-accent-foreground hover:bg-accent rounded-full w-full sm:w-auto" size="lg" data-testid="button-search">
                <Search className="h-5 w-5 mr-2" />
                Find Aircraft
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Filters & Results */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex-1">
            <h2 className="font-display text-2xl sm:text-3xl font-bold mb-2" data-testid="text-results-title">
              Available Aircraft
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              <span data-testid="text-results-count">{aircraft.length}</span> aircraft match your search
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="w-full sm:w-auto"
            data-testid="button-toggle-filters"
          >
            {showFilters ? "Hide" : "Show"} Filters
          </Button>
        </div>

        <div className="flex gap-8">
          {/* Filters Sidebar */}
          {showFilters && (
            <aside className="w-80 flex-shrink-0">
              <AircraftFilters />
            </aside>
          )}

          {/* Results Grid */}
          <div className="flex-1">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-96 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : aircraft.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No aircraft available at this time</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {aircraft.map((listing) => (
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
                    onCardClick={() => setSelectedAircraftId(listing.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="bg-muted py-16">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-3xl font-bold text-center mb-12">
            Why Pilots Trust Ready Set Fly
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">Verified Pilots</h3>
              <p className="text-muted-foreground">
                All pilots are verified with license checks and background screenings
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">Comprehensive Insurance</h3>
              <p className="text-muted-foreground">
                All rentals include comprehensive insurance coverage for peace of mind
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">24/7 Support</h3>
              <p className="text-muted-foreground">
                Our aviation experts are available around the clock to assist you
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Aircraft Detail Modal */}
      {selectedAircraftId && (
        <AircraftDetailModal
          aircraftId={selectedAircraftId}
          open={!!selectedAircraftId}
          onOpenChange={(open) => !open && setSelectedAircraftId(null)}
        />
      )}
    </div>
  );
}
