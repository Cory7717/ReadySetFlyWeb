import { useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { canUseInternalPreview } from "@/lib/internal-preview";
import { gpsTrainerUnits } from "@shared/gps-sims";

export default function GpsSimsHub() {
  const { isAuthenticated, user } = useAuth();
  const canPreviewInternal = canUseInternalPreview(user);

  useEffect(() => {
    trackEvent("gps_sims_hub_view", { page: "/gps-sims" });
  }, []);

  return (
    <div className="min-h-screen">
      <section className="bg-muted py-10">
        <div className="container mx-auto px-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">RSF Premium</Badge>
            <Badge variant="outline">{canPreviewInternal ? "Internal Preview" : "Active development"}</Badge>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">
            GPS Glass Panel Simulators
          </h1>
          <p className="text-muted-foreground max-w-3xl">
            Interactive GPS trainers built for IFR pilot workflows - flight plan entry, direct-to, procedure loading, and
            checkride-ready scoring. Shipping with RSF Premium.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/ifr-tools">IFR Tools</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/tool-hub">Tool Hub</Link>
            </Button>
            {!isAuthenticated && (
              <Button asChild>
                <Link href="/register">Create Free Account</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 space-y-8">
        <Alert className="border-sky-200 bg-sky-50">
          <AlertTitle className="text-sky-800">
            What these simulators do
          </AlertTitle>
          <AlertDescription className="text-sky-700">
            Each unit maps a real GPS/FMS panel to interactive hotspots. Practice button flows, knob sequences, and
            page navigation in Learn Mode, then validate with scored Checkride Mode and downloadable instructor reports.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6 md:grid-cols-2">
          {gpsTrainerUnits.map((unit) => (
            <div
              key={unit.id}
              className="relative rounded-xl border bg-card overflow-hidden group transition-shadow hover:shadow-md"
            >
              {!canPreviewInternal ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-[2px]">
                <div className="rounded-full border-2 border-muted-foreground/30 bg-background p-3">
                  <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <Badge variant="secondary">Coming with RSF Premium</Badge>
                <Button asChild size="sm">
                  <Link href={isAuthenticated ? "/membership" : "/register"}>
                    {isAuthenticated ? "Upgrade to Premium" : "Create Free Account"}
                  </Link>
                </Button>
              </div>
              ) : null}

              <div className="p-5 space-y-3 select-none">
                <div className="flex flex-wrap items-center gap-2">
                  {unit.highlights.slice(0, 3).map((h) => (
                    <Badge key={h} variant="outline" className="text-xs">
                      {h}
                    </Badge>
                  ))}
                </div>
                <div className="font-semibold text-lg">{unit.title}</div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {unit.summary}
                </p>
                <div className="text-xs text-muted-foreground">
                  {unit.tasks.length} tasks - {unit.scenarios.length} scenarios
                </div>
                {canPreviewInternal ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/gps-sims/${unit.id}`}>Open Internal Preview</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Still being hardened</CardTitle>
            <CardDescription>
              IFR pilots judge tools on workflow accuracy and trust. These ship when they are defensible.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">·</span>
              Unit sequencing and hotspot accuracy
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">·</span>
              Checkride scoring consistency
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">·</span>
              Instructor report quality
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">·</span>
              Mobile panel layout and clarity
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );

}
