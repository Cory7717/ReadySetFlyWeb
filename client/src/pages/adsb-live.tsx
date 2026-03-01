import { useEffect } from "react";
import { Link } from "wouter";
import { Plane } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics";

export default function AdsbLive() {
  useEffect(() => {
    trackEvent("live_traffic_coming_soon_view", { page: "/live-traffic" });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="space-y-2">
          <Badge variant="outline">Coming soon</Badge>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Plane className="h-6 w-6 text-sky-600" />
            RSF Live Traffic
          </h1>
          <p className="text-muted-foreground max-w-3xl">
            Live traffic remains part of the RSF roadmap, but it is intentionally held in a coming-soon state until the traffic presentation, filtering, and pilot trust bar are where they need to be.
          </p>
        </div>

        <Alert className="border-dashed">
          <AlertTitle>Active development</AlertTitle>
          <AlertDescription>
            This surface is being held back because traffic tools need higher trust than a simple map demo. The current release path is focused on making the planner and logbook stronger first.
          </AlertDescription>
        </Alert>

        <Card className="border-dashed bg-muted/40">
          <CardHeader>
            <CardTitle>What is being completed before release</CardTitle>
            <CardDescription>
              Traffic features need operationally credible presentation, not just data on a map.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>- Cleaner traffic filtering and labeling</p>
            <p>- Better mobile map readability and performance</p>
            <p>- Stronger operational disclaimers and user expectations</p>
            <p>- Tighter integration with the rest of the RSF planning workflow</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="outline">
                <Link href="/tool-hub">Open Tool Hub</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/ifr-tools">Back to IFR Tools</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
