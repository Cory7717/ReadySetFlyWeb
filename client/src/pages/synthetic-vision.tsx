import { useEffect } from "react";
import { Link } from "wouter";
import { Navigation } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

export default function SyntheticVisionPage() {
  const { isAuthenticated, user } = useAuth();
  const entitlements = (user as any)?.entitlements;
  const isPro = entitlements?.canUseGpsSims ?? (user?.logbookProStatus === "active");

  useEffect(() => {
    trackEvent("synthetic_vision_coming_soon_view", { page: "/synthetic-vision" });
  }, []);

  return (
    <div className="min-h-screen">
      <section className="bg-muted py-10">
        <div className="container mx-auto px-4 space-y-3">
          <Badge variant="outline">Coming soon</Badge>
          <h1 className="font-display text-3xl sm:text-4xl font-bold flex items-center gap-2">
            <Navigation className="h-7 w-7 text-primary" />
            Synthetic Vision Lab
          </h1>
          <p className="text-muted-foreground max-w-3xl">
            Synthetic Vision remains visible in RSF, but it is intentionally paused until the training logic, cockpit presentation, and review workflow are ready for serious pilot evaluation.
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
            ) : isPro ? (
              <Button asChild>
                <Link href="/logbook">Open Digital Logbook</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/logbook/pro">View RSF Pro</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 space-y-6">
        <Alert className="border-dashed">
          <AlertTitle>Active development</AlertTitle>
          <AlertDescription>
            This is one of the highest-trust IFR surfaces in RSF. It should ship only when the scenario quality, session scoring, and visual presentation are defensible.
          </AlertDescription>
        </Alert>

        <Card className="border-dashed bg-muted/40">
          <CardHeader>
            <CardTitle>Release criteria before this goes live</CardTitle>
            <CardDescription>
              Synthetic vision needs to feel precise and deliberate, not experimental.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>- More credible attitude, track, and terrain training workflows</p>
            <p>- Better integration with route context and traffic layering</p>
            <p>- Cleaner instructor review and student session history</p>
            <p>- Stronger mobile and tablet presentation</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
