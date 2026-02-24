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
      <div className="container mx-auto px-4 py-10 space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            {profile.headshotUrl && (
              <div className="h-20 w-20 rounded-full overflow-hidden border">
                <img
                  src={resolveHeadshotUrl(profile.headshotUrl)}
                  alt={`${profile.displayName} headshot`}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="space-y-2">
              <Badge variant="outline">CFI Profile</Badge>
              <h1 className="text-3xl font-bold">{profile.displayName}</h1>
              <p className="text-muted-foreground max-w-2xl">{profile.headline || "Certified Flight Instructor"}</p>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {(profile.locationCity || profile.locationState) && (
                  <span>
                    {profile.locationCity || ""}{profile.locationCity && profile.locationState ? ", " : ""}
                    {profile.locationState || ""}
                  </span>
                )}
                {profile.airportHome && <span>Home airport: {profile.airportHome}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-lg font-semibold text-right">{formatRate(profile.hourlyRateCents)}</div>
            <Button asChild>
              <Link href={`/cfi/${profile.slug}/request`}>
                {isAuthenticated ? "Request a session" : "Sign in to request"}
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
              <CardDescription>Background and training specialties.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground whitespace-pre-line">{profile.bio || "No bio provided yet."}</p>
              {profile.contactNote && (
                <div className="text-sm">
                  <div className="font-semibold">Contact notes</div>
                  <p className="text-muted-foreground whitespace-pre-line">{profile.contactNote}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Training focus</CardTitle>
              <CardDescription>Ratings, aircraft, and languages.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ratings.length > 0 && (
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Ratings held</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {ratings.map((rating) => (
                      <Badge key={rating} variant="secondary">
                        {rating}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {aircraft.length > 0 && (
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Aircraft types</div>
                  <p className="text-sm text-muted-foreground mt-2">{aircraft.join(", ")}</p>
                </div>
              )}
              {languages.length > 0 && (
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Languages</div>
                  <p className="text-sm text-muted-foreground mt-2">{languages.join(", ")}</p>
                </div>
              )}
              {!ratings.length && !aircraft.length && !languages.length && (
                <p className="text-sm text-muted-foreground">No additional details shared yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Next steps</CardTitle>
            <CardDescription>Request a session or review student terms.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/cfi/${profile.slug}/request`}>Request a session</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/cfi/student-terms">Student terms</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/cfi">Back to directory</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
