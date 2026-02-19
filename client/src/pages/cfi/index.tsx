import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { CfiProfile } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

const formatRate = (value?: number | null) => {
  if (!value && value !== 0) return "Rate on request";
  return `$${Math.round(value / 100)}/hr`;
};

const normalizeList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

export default function CfiDirectory() {
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [airport, setAirport] = useState("");

  useEffect(() => {
    trackEvent("cfi_directory_view");
  }, []);

  const queryKey = useMemo(() => ["/api/cfi/profiles", search, state, airport], [search, state, airport]);
  const { data: profiles = [], isLoading } = useQuery<CfiProfile[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (state.trim()) params.set("state", state.trim());
      if (airport.trim()) params.set("airport", airport.trim());
      const url = params.toString() ? `/api/cfi/profiles?${params}` : "/api/cfi/profiles";
      const response = await fetch(apiUrl(url), { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to load CFI profiles");
      }
      return response.json();
    },
  });

  const hasFilters = search.trim() || state.trim() || airport.trim();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 space-y-8">
        <div className="space-y-2">
          <Badge variant="outline">CFI Directory</Badge>
          <h1 className="text-3xl font-bold">Find a Certified Flight Instructor</h1>
          <p className="text-muted-foreground max-w-2xl">
            Browse instructors by location, ratings, and availability. Book a training session directly with the CFI.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild>
              <Link href="/dashboard/cfi">Become a CFI on RSF</Link>
            </Button>
            {!isAuthenticated && (
              <Button asChild variant="outline">
                <Link href="/register">Create a CFI account</Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/cfi/student-terms">Student terms</Link>
            </Button>
          </div>
          {!isAuthenticated && (
            <p className="text-xs text-muted-foreground">
              Already have an RSF account? <Link href="/login" className="text-primary underline">Sign in</Link> to publish your profile.
            </p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search filters</CardTitle>
            <CardDescription>Filter by instructor name, airport, or state.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, rating, or headline"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">State</label>
              <Input
                value={state}
                onChange={(event) => setState(event.target.value)}
                placeholder="e.g. TX"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Home airport</label>
              <Input
                value={airport}
                onChange={(event) => setAirport(event.target.value)}
                placeholder="e.g. KDAL"
              />
            </div>
            {hasFilters && (
              <Button
                variant="outline"
                className="md:col-span-3"
                onClick={() => {
                  setSearch("");
                  setState("");
                  setAirport("");
                  trackEvent("cfi_directory_filter_reset");
                }}
              >
                Reset filters
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {isLoading && (
            <Card>
              <CardHeader>
                <CardTitle>Loading profiles...</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Fetching CFI directory data.</p>
              </CardContent>
            </Card>
          )}

          {!isLoading && profiles.length === 0 && (
            <Card className="md:col-span-2 lg:col-span-3">
              <CardHeader>
                <CardTitle>No instructors found</CardTitle>
                <CardDescription>Try adjusting your filters or check back soon.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/dashboard/cfi">Create the first CFI profile</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {profiles.map((profile) => {
            const ratings = normalizeList(profile.ratingsHeld);
            const aircraft = normalizeList(profile.aircraftTypes);
            const languages = normalizeList(profile.languages);
            return (
              <Card key={profile.id} className="hover-elevate">
                <CardHeader>
                  <CardTitle>{profile.displayName}</CardTitle>
                  <CardDescription>{profile.headline || "CFI on Ready Set Fly"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {(profile.locationCity || profile.locationState) && (
                      <span>
                        {profile.locationCity || ""}{profile.locationCity && profile.locationState ? ", " : ""}
                        {profile.locationState || ""}
                      </span>
                    )}
                    {profile.airportHome && <span>Home: {profile.airportHome}</span>}
                  </div>
                  <div className="text-sm font-semibold">{formatRate(profile.hourlyRateCents)}</div>
                  {ratings.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {ratings.slice(0, 4).map((rating) => (
                        <Badge key={rating} variant="secondary">
                          {rating}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {aircraft.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Aircraft: {aircraft.slice(0, 3).join(", ")}
                      {aircraft.length > 3 ? "..." : ""}
                    </p>
                  )}
                  {languages.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Languages: {languages.slice(0, 3).join(", ")}
                      {languages.length > 3 ? "..." : ""}
                    </p>
                  )}
                  <Button asChild className="w-full">
                    <Link href={`/cfi/${profile.slug}`}>View profile</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
