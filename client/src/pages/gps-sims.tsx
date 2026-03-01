import { useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

export default function GpsSimsHub() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    trackEvent("gps_sims_hub_view", { page: "/gps-sims" });
  }, []);

  return (
    <div className="min-h-screen">
      <section className="bg-muted py-10">
        <div className="container mx-auto px-4 space-y-3">
          <Badge variant="outline">Coming soon</Badge>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">RSF GPS Simulators</h1>
          <p className="text-muted-foreground max-w-3xl">
            The GPS simulator stack is visible in RSF, but it is intentionally held in a coming-soon state while the IFR workflows, scoring, and unit accuracy are hardened.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/ifr-tools">Back to IFR Tools</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/tool-hub">Open Tool Hub</Link>
            </Button>
            {!isAuthenticated ? (
              <Button asChild>
                <Link href="/register">Create Free Account</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 space-y-6">
        <Alert className="border-dashed">
          <AlertTitle>Active development</AlertTitle>
          <AlertDescription>
            These simulators are being refined before wider release. For now, RSF keeps the category visible so pilots know it is part of the product roadmap, but access is intentionally paused.
          </AlertDescription>
        </Alert>

        <Card className="border-dashed bg-muted/40">
          <CardHeader>
            <CardTitle>What is being hardened</CardTitle>
            <CardDescription>
              IFR pilots will judge these tools on workflow accuracy, repeatability, and trust. They need to ship only when those are defensible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>- Unit behavior and sequencing accuracy</p>
            <p>- Scenario reliability and scoring consistency</p>
            <p>- Instructor review flow and report quality</p>
            <p>- Mobile layout and panel clarity</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );

}
