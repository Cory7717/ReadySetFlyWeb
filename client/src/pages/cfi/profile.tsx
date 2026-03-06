import { useEffect, useMemo } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { CfiProfile } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";
import { apiUrl } from "@/lib/api";

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

export default function CfiProfilePage() {
  const [, params] = useRoute("/cfi/:slug");
  const slug = params?.slug;
  const { isAuthenticated } = useAuth();

  const queryKey = useMemo(() => ["/api/cfi/profiles", slug], [slug]);
  const { data: profile, isLoading } = useQuery<CfiProfile>({
    queryKey,
    enabled: !!slug,
  });

  useEffect(() => {
    if (slug) {
      trackEvent("cfi_profile_view", { slug });
    }
  }, [slug]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Loading profile...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Profile not found</CardTitle>
            <CardDescription>We could not find this CFI profile.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/cfi">Back to directory</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ratings = normalizeList(profile.ratingsHeld);
  const aircraft = normalizeList(profile.aircraftTypes);
  const languages = normalizeList(profile.languages);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-5">
              {profile.headshotUrl ? (
                <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-background shadow-md shrink-0">
                  <img
                    src={resolveHeadshotUrl(profile.headshotUrl)}
                    alt={`${profile.displayName} headshot`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-24 w-24 rounded-full bg-muted border-4 border-background shadow-md flex items-center justify-center text-sm font-semibold text-muted-foreground shrink-0">
                  CFI
                </div>
              )}
              <div className="space-y-1.5">
                <Badge variant="outline">CFI Profile</Badge>
                <h1 className="text-2xl font-bold">
                  {profile.displayName}
                </h1>
                <p className="text-muted-foreground">
                  {profile.headline || "Certified Flight Instructor"}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {profile.airportHome && (
                    <span className="font-semibold text-foreground">
                      ✈ {profile.airportHome}
                    </span>
                  )}
                  {(profile.locationCity || profile.locationState) && (
                    <span>
                      📍 {[profile.locationCity, profile.locationState].filter(Boolean).join(", ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end gap-3">
              <div className="text-2xl font-bold">
                {formatRate(profile.hourlyRateCents)}
              </div>
              <Button asChild size="lg">
                <Link href={`/cfi/${profile.slug}/request`}>
                  {isAuthenticated ? "Request a session" : "Sign in to request"}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/cfi">← Back to directory</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {profile.bio || "No bio provided yet."}
                </p>
                {profile.contactNote && (
                  <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm">
                    <div className="font-semibold mb-1">
                      Contact preference
                    </div>
                    <p className="text-muted-foreground whitespace-pre-line">
                      {profile.contactNote}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ready to train?</CardTitle>
                <CardDescription>
                  Send a booking request and the CFI will follow up to confirm details.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href={`/cfi/${profile.slug}/request`}>
                    Request a session
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/cfi/student-terms">Student terms</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {ratings.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    Ratings held
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {ratings.map((rating) => (
                      <Badge key={rating} variant="secondary">
                        {rating}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {aircraft.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    Aircraft types
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {aircraft.map((item) => (
                      <Badge key={item} variant="outline">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {languages.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Languages</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {languages.join(", ")}
                  </p>
                </CardContent>
              </Card>
            )}
            {profile.preferredPayments && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    Preferred payment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {profile.preferredPayments}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
