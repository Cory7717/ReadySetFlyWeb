import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FlyingClub } from "@shared/schema";
import { Link } from "wouter";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

type FlyingClubSummary = FlyingClub & {
  memberCount: number;
  aircraftCount: number;
};

const EMPTY_FORM = {
  name: "",
  description: "",
  homeAirport: "",
  city: "",
  state: "",
  contactEmail: "",
  websiteUrl: "",
};

export default function FlyingClubsPage() {
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [airportFilter, setAirportFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");

  useEffect(() => {
    trackEvent("flying_clubs_page_view");
  }, []);

  const { data: clubs = [], isLoading } = useQuery<FlyingClubSummary[]>({
    queryKey: ["/api/flying-clubs"],
  });

  const { data: myClubs = [] } = useQuery<FlyingClub[]>({
    queryKey: ["/api/flying-clubs/mine"],
    enabled: isAuthenticated,
  });

  const filteredClubs = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    const airportValue = airportFilter.trim().toLowerCase();
    const stateValue = stateFilter.trim().toLowerCase();

    return clubs.filter((club) => {
      const matchesSearch =
        !searchValue ||
        club.name.toLowerCase().includes(searchValue) ||
        String(club.description || "").toLowerCase().includes(searchValue) ||
        String(club.city || "").toLowerCase().includes(searchValue) ||
        String(club.state || "").toLowerCase().includes(searchValue);
      const matchesAirport =
        !airportValue || String(club.homeAirport || "").toLowerCase().includes(airportValue);
      const matchesState =
        !stateValue || String(club.state || "").toLowerCase().includes(stateValue);
      return matchesSearch && matchesAirport && matchesState;
    });
  }, [airportFilter, clubs, search, stateFilter]);

  const handleChange = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setFeedback("Club name is required.");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      await apiRequest("POST", "/api/flying-clubs", {
        ...form,
        visibility: "listed",
        requiresApproval: true,
        status: "draft",
      });
      setForm(EMPTY_FORM);
      setFeedback("Flying club draft created. You can build the club profile and fleet from here next.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/flying-clubs"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/flying-clubs/mine"] }),
      ]);
      trackEvent("flying_club_created");
    } catch (error) {
      console.error(error);
      setFeedback("Could not create the flying club draft.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageShell
      kicker="Flying Clubs"
      title="Manage club members, fleet access, and bookings inside RSF."
      description="This first version gives clubs a clean place to establish a profile, organize members, assign aircraft, and build toward a shared scheduling workflow."
      actions={
        <>
          <Badge variant="outline" className="border-white/12 bg-white/8 text-slate-100">Club operations</Badge>
          <Badge variant="outline" className="border-white/12 bg-white/8 text-slate-100">Scheduling foundation</Badge>
        </>
      }
      contentClassName="space-y-8"
    >
      <section className="rounded-[1.8rem] border border-white/12 bg-[linear-gradient(135deg,rgba(13,26,54,0.96),rgba(25,66,156,0.9))] p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.2)] sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">First Rule Of Flight Club</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Sign up to use RSF&apos;s Flight Club Management System.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-100/88 sm:text-base">
              Build a club profile, organize members, assign aircraft, and start shaping a scheduling workflow that actually fits how flying clubs operate.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!isAuthenticated ? (
              <>
                <Button asChild size="lg" className="bg-white text-slate-950 hover:bg-slate-100">
                  <Link href="/register">Create RSF account</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/24 bg-white/6 text-white hover:bg-white/12">
                  <Link href="/login">Sign in</Link>
                </Button>
              </>
            ) : (
              <Button
                size="lg"
                className="bg-white text-slate-950 hover:bg-slate-100"
                onClick={() => document.getElementById("start-flight-club")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                Start a club
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/12 bg-white/80">
          <CardHeader>
            <CardTitle>Member Operations</CardTitle>
            <CardDescription>Give club owners and managers one place to keep a current roster and define booking access.</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-white/12 bg-white/80">
          <CardHeader>
            <CardTitle>Fleet Visibility</CardTitle>
            <CardDescription>Associate club aircraft with RSF listings or add fleet records directly for internal scheduling.</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-white/12 bg-white/80">
          <CardHeader>
            <CardTitle>Scheduling Base</CardTitle>
            <CardDescription>Reservations, blackout periods, and announcements are part of the core model so the workflow can expand cleanly.</CardDescription>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <Card className="border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.78))]">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary text-primary-foreground">Launch Pricing</Badge>
              <Badge variant="outline">Founding club offer</Badge>
            </div>
            <CardTitle className="text-3xl">$99/month</CardTitle>
            <CardDescription>
              Start with a free first month, then move into a clean club-operations plan built for early flying club adoption inside RSF.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">Included in the current version</div>
              <div className="mt-3 grid gap-3 text-sm text-slate-700">
                <div>Club profile and public discovery inside RSF</div>
                <div>Member roster foundation with owner and manager roles</div>
                <div>Fleet assignment linked to RSF aircraft listings or club records</div>
                <div>Reservation and scheduling base for aircraft time slots</div>
                <div>Announcements and club-document support</div>
              </div>
            </div>
            <div className="text-sm leading-6 text-muted-foreground">
              The goal of the launch plan is simple: make clubs operational inside RSF first, then layer on deeper back-office tools once the workflow is proven with real clubs.
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/12 bg-white/86">
          <CardHeader>
            <CardTitle>Planned Additions</CardTitle>
            <CardDescription>
              Clubs signing on early help shape what comes next. These are the next major capabilities planned after the launch version.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">Billing Management</div>
              <div className="mt-2 text-sm leading-6 text-slate-700">Club dues, member charges, and recurring billing workflows.</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">Maintenance Controls</div>
              <div className="mt-2 text-sm leading-6 text-slate-700">Aircraft downtime, blackout periods, squawks, and service coordination.</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">Policy Enforcement</div>
              <div className="mt-2 text-sm leading-6 text-slate-700">Checkout requirements, booking windows, and club-specific operating rules.</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">Advanced Scheduling</div>
              <div className="mt-2 text-sm leading-6 text-slate-700">Waitlists, approval flows, conflict handling, and richer calendar operations.</div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="border-white/12 bg-white/85">
          <CardHeader>
            <CardTitle>Listed Flying Clubs</CardTitle>
            <CardDescription>Public clubs can use RSF as a discovery page today, then expand into member operations as the workflow rolls out.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(0,1.2fr)_180px_140px]">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search club name, city, or description" />
              <Input value={airportFilter} onChange={(event) => setAirportFilter(event.target.value)} placeholder="Airport (e.g. KAUS)" />
              <Input value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} placeholder="State" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <div>{filteredClubs.length} clubs shown</div>
              {(search || airportFilter || stateFilter) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setAirportFilter("");
                    setStateFilter("");
                  }}
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading clubs...</div>
            ) : filteredClubs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-muted-foreground">
                No clubs match those filters yet. Try a different airport, state, or search phrase.
              </div>
            ) : (
              filteredClubs.map((club) => (
                <div key={club.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-slate-900">{club.name}</h2>
                        <Badge variant="outline">{club.homeAirport || "Club profile"}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {[club.city, club.state].filter(Boolean).join(", ") || "Location coming soon"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                      <Badge variant="secondary">{club.memberCount} members</Badge>
                      <Badge variant="secondary">{club.aircraftCount} aircraft</Badge>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {club.description || "This club profile is live inside RSF and ready for member, fleet, and scheduling setup."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm">
                    <Link href={`/flying-clubs/${club.slug}`} className="text-primary underline">
                      View club
                    </Link>
                    {club.websiteUrl ? (
                      <a href={club.websiteUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                        Visit website
                      </a>
                    ) : null}
                    {club.contactEmail ? (
                      <a href={`mailto:${club.contactEmail}`} className="text-primary underline">
                        Contact club
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card id="start-flight-club" className="border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.76))]">
          <CardHeader>
            <CardTitle>Start A Club</CardTitle>
            <CardDescription>
              Create a draft club profile now. The owner account becomes the first manager and can expand into member, fleet, and booking setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isAuthenticated ? (
              <div className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-muted-foreground">
                Sign in to create a club profile and start shaping the workflow with RSF.
                <div className="flex gap-3">
                  <Button asChild size="sm">
                    <Link href="/register">Create account</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/login">Sign in</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-3">
                  <Input value={form.name} onChange={(event) => handleChange("name", event.target.value)} placeholder="Club name" />
                  <Textarea value={form.description} onChange={(event) => handleChange("description", event.target.value)} placeholder="Short description of the club, membership fit, or mission" rows={4} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input value={form.homeAirport} onChange={(event) => handleChange("homeAirport", event.target.value)} placeholder="Home airport (e.g. KDTO)" />
                    <Input value={form.contactEmail} onChange={(event) => handleChange("contactEmail", event.target.value)} placeholder="Contact email" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input value={form.city} onChange={(event) => handleChange("city", event.target.value)} placeholder="City" />
                    <Input value={form.state} onChange={(event) => handleChange("state", event.target.value)} placeholder="State" />
                  </div>
                  <Input value={form.websiteUrl} onChange={(event) => handleChange("websiteUrl", event.target.value)} placeholder="Website URL (optional)" />
                </div>
                <Button onClick={handleCreate} disabled={isSubmitting} className="w-full">
                  {isSubmitting ? "Creating club..." : "Create Flying Club Draft"}
                </Button>
                {feedback ? <div className="text-sm text-muted-foreground">{feedback}</div> : null}
              </>
            )}

            {isAuthenticated && myClubs.length > 0 ? (
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <div className="text-sm font-medium text-slate-900">My clubs</div>
                {myClubs.map((club) => (
                  <div key={club.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-900">{club.name}</div>
                        <div className="text-xs uppercase tracking-[0.14em] text-slate-500">{club.status}</div>
                      </div>
                      <Badge variant="outline">{club.visibility}</Badge>
                    </div>
                    <div className="mt-3">
                      <Link href={`/flying-clubs/${club.slug}`} className="text-sm text-primary underline">
                        Open club workspace
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
