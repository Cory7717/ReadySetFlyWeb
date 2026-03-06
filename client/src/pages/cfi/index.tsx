import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { CfiProfile } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SponsoredRightRail } from "@/components/banners/SponsoredRightRail";
import { PageShell } from "@/components/layout/PageShell";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

const formatRate = (value?: number | null) => {
  if (!value && value !== 0) return "Rate on request";
  return `$${Math.round(value / 100)}/hr`;
};

const resolveHeadshotUrl = (value?: string | null) => {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/objects/")) return apiUrl(value);
  if (value.includes("/uploads/")) {
    const idx = value.indexOf("/uploads/");
    if (idx >= 0) {
      return apiUrl(`/objects/${value.slice(idx + 1)}`);
    }
  }
  return value;
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
  const { isAuthenticated, user } = useAuth();
  const entitlements = (user as any)?.entitlements;
  const canUseCfi = !!entitlements?.canUseCfi;
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
    <PageShell
      kicker="CFI Directory"
      title="Find a flight instructor by airport, rating, and training fit."
      description="Search instructors, review rates and ratings held, then contact the CFI that matches the training you need next."
      actions={
        <>
          <Badge variant="outline" className="border-white/12 bg-white/8 text-slate-100">Instructor search</Badge>
          <Button asChild variant="outline" className="border-white/14 bg-white/6 text-slate-100 hover:bg-white/10">
            <Link href="/cfi/student-terms">Student terms</Link>
          </Button>
        </>
      }
      contentClassName="space-y-8"
    >
      <section className="rounded-[1.6rem] border border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.96),rgba(255,255,255,0.68))] p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Students</Badge>
              <Badge variant="outline">Ratings</Badge>
              <Badge variant="outline">Local search</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[1.05rem] border border-primary/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(255,255,255,0.56))] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">1. Search by airport</div>
                <div className="mt-2 text-sm text-slate-700">Start with your home airport or the area where you want to train.</div>
              </div>
              <div className="rounded-[1.05rem] border border-primary/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(255,255,255,0.56))] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">2. Review training fit</div>
                <div className="mt-2 text-sm text-slate-700">Compare hourly rate, ratings held, aircraft types, and language support.</div>
              </div>
              <div className="rounded-[1.05rem] border border-primary/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(255,255,255,0.56))] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">3. Publish or contact</div>
                <div className="mt-2 text-sm text-slate-700">CFIs can create profiles. Students can browse and reach the right instructor faster.</div>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-white/12 bg-white/80 p-4 shadow-[0_12px_26px_rgba(15,23,42,0.08)] sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="rsf-kicker">Search instructors</span>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">Find the CFI that matches the rating or lesson you need.</h2>
                </div>
                <p className="max-w-xl text-sm text-muted-foreground">
                  Filter by name, home airport, or state, then narrow to the instructor profile that fits your next step.
                </p>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
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
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{profiles.length} instructors</Badge>
                  <Badge variant="outline">Direct profile view</Badge>
                  <Badge variant="outline">Student-friendly search</Badge>
                </div>
                {hasFilters ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setState("");
                      setAirport("");
                      trackEvent("cfi_directory_filter_reset");
                    }}
                  >
                    Clear search
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-[1.4rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(255,255,255,0.56))] p-5 shadow-[0_18px_38px_rgba(15,23,42,0.12)]">
            <div>
              <span className="rsf-kicker">For instructors</span>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">Create your RSF profile and show students how you teach.</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Publish your home airport, training specialties, aircraft types, and hourly rate so students can find the right instructor without back-and-forth guessing.
            </p>
            <div className="grid gap-3">
              <div className="rounded-[1rem] border border-primary/14 bg-white/72 px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Publish your profile</div>
                <div className="mt-1 text-sm text-slate-700">List ratings, aircraft experience, languages, and availability.</div>
              </div>
              <div className="rounded-[1rem] border border-primary/14 bg-white/72 px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Reach the right students</div>
                <div className="mt-1 text-sm text-slate-700">Show up in airport and state searches where students are already looking.</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button asChild>
                <Link href="/dashboard/cfi">Create your profile</Link>
              </Button>
              {isAuthenticated && !canUseCfi ? (
                <Button asChild variant="outline">
                  <Link href="/dashboard/cfi">Start 30-day CFI trial</Link>
                </Button>
              ) : null}
              {!isAuthenticated ? (
                <Button asChild variant="outline">
                  <Link href="/register">Create an account</Link>
                </Button>
              ) : null}
            </div>
            {!isAuthenticated ? (
              <p className="text-xs text-muted-foreground">
                Already have an RSF account? <Link href="/login" className="text-primary underline">Sign in</Link> to publish your instructor profile.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-[1.45rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(255,255,255,0.62))] p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="rsf-kicker">Available instructors</span>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Browse instructors by training fit, location, and availability.</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {profiles.length} instructor{profiles.length === 1 ? "" : "s"} match the current search.
              </p>
            </div>
            <Badge variant="outline">{hasFilters ? "Filtered search" : "All instructors"}</Badge>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
              <Card>
                <CardHeader>
                  <CardTitle>Loading profiles...</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Fetching instructor profiles.</p>
                </CardContent>
              </Card>
            ) : null}

            {!isLoading && profiles.length === 0 ? (
              <Card className="md:col-span-2 lg:col-span-3">
                <CardHeader>
                  <CardTitle>No instructors found</CardTitle>
                  <CardDescription>
                    Try a different airport, state, or search term. If you are a CFI, you can also publish the first profile for this area.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href="/dashboard/cfi">Create your CFI profile</Link>
                  </Button>
                  {hasFilters ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearch("");
                        setState("");
                        setAirport("");
                        trackEvent("cfi_directory_filter_reset");
                      }}
                    >
                      Clear search
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {profiles.map((profile) => {
              const ratings = normalizeList(profile.ratingsHeld);
              const aircraft = normalizeList(profile.aircraftTypes);
              const languages = normalizeList(profile.languages);
              return (
                <Card key={profile.id} className="hover-elevate flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      {profile.headshotUrl ? (
                        <div className="h-14 w-14 rounded-full overflow-hidden border-2 border-muted shrink-0">
                          <img
                            src={resolveHeadshotUrl(profile.headshotUrl)}
                            alt={`${profile.displayName} headshot`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground border-2 border-muted shrink-0 font-semibold">
                          CFI
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">
                          {profile.displayName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {profile.headline || "Certified Flight Instructor"}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {profile.airportHome && (
                            <span className="font-medium text-foreground">
                              {profile.airportHome}
                            </span>
                          )}
                          {(profile.locationCity || profile.locationState) && (
                            <span>
                              {[profile.locationCity, profile.locationState].filter(Boolean).join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-right shrink-0">
                        {formatRate(profile.hourlyRateCents)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-3 pt-0">
                    {ratings.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {ratings.slice(0, 5).map((rating) => (
                          <Badge key={rating} variant="secondary" className="text-xs">
                            {rating}
                          </Badge>
                        ))}
                        {ratings.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{ratings.length - 5}
                          </Badge>
                        )}
                      </div>
                    )}
                    {aircraft.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        ✈ {aircraft.slice(0, 3).join(" · ")}
                        {aircraft.length > 3 ? ` +${aircraft.length - 3}` : ""}
                      </div>
                    )}
                    {languages.length > 1 && (
                      <div className="text-xs text-muted-foreground">
                        🌐 {languages.join(", ")}
                      </div>
                    )}
                    <Button asChild className="w-full mt-auto">
                      <Link href={`/cfi/${profile.slug}`}>
                        View instructor →
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
        <SponsoredRightRail
          placement="cfi-directory"
          infoTestId="button-banner-ad-info-cfi"
          className="xl:sticky xl:top-24 xl:self-start"
        />
      </div>
    </PageShell>
  );
}
