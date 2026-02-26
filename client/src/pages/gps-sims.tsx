import { useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { trackEvent } from "@/lib/analytics";
import { gpsTrainerDisclaimer, gpsTrainerUnits } from "@shared/gps-sims";
import { useAuth } from "@/hooks/useAuth";

export default function GpsSimsHub() {
  const { user, isAuthenticated } = useAuth();
  const entitlements = (user as any)?.entitlements;
  const isPro = entitlements?.canUseGpsSims ?? (user?.logbookProStatus === "active");

  useEffect(() => {
    trackEvent("gps_sims_hub_view", { page: "/gps-sims" });
  }, []);

  return (
    <div className="min-h-screen">
      <section className="bg-muted py-10">
        <div className="container mx-auto px-4 space-y-3">
          <Badge variant="outline">RSF Branded</Badge>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">RSF GPS Simulators</h1>
          <p className="text-muted-foreground max-w-3xl">
            Functionally accurate training simulators for the most common GA avionics stacks.
            Practice workflows before you fly and build real IFR confidence.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/ifr-tools">Open IFR Tools</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/student">Student Hub</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 space-y-6">
        <Alert>
          <AlertTitle>Training aid only</AlertTitle>
          <AlertDescription>
            {gpsTrainerDisclaimer.join(" ")}
          </AlertDescription>
        </Alert>
        {!isPro && (
          <Alert variant="default">
            <AlertTitle>RSF Pro unlocks full GPS sims</AlertTitle>
            <AlertDescription>
              {isAuthenticated
                ? "Checkride mode, instructor-ready session reports, and advanced scenarios are available with RSF Pro."
                : "Create a free account, then upgrade to RSF Pro for full GPS simulator access and instructor reports."}
              <div className="mt-3">
                <Button asChild size="sm">
                  <Link href={isAuthenticated ? "/logbook/pro" : "/register"}>Unlock RSF Pro</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gpsTrainerUnits.map((unit) => (
            <Card key={unit.id} className="hover-elevate">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{unit.title}</CardTitle>
                  {!isPro && <Badge variant="outline">RSF Pro</Badge>}
                </div>
                <CardDescription>{unit.subtitle}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{unit.summary}</p>
                <div className="flex flex-wrap gap-2">
                  {unit.highlights.map((item) => (
                    <Badge key={item} variant="secondary">
                      {item}
                    </Badge>
                  ))}
                </div>
                <Button asChild className="w-full">
                  <Link href={`/gps-sims/${unit.id}`}>Start training</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
