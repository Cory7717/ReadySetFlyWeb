import { Link, useLocation } from "wouter";
import { LogIn, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RequireAuth() {
  const [path] = useLocation();
  const config = path.startsWith("/logbook")
    ? {
        title: "Sign in to access your Digital Logbook",
        description: "Create a free account to log flights, export entries, and keep your history available anywhere.",
        bullets: [
          "Track flights and totals in one place",
          "Export your data anytime",
          "Upgrade later for currency alerts and endorsements",
        ],
      }
    : path.startsWith("/student")
      ? {
          title: "Sign in to save training progress",
          description: "Create a free account to keep your student training path, progress, and planning tools tied together.",
          bullets: [
            "Track milestones and training progress",
            "Return to your tools across devices",
            "Connect with schools and instructors when you're ready",
          ],
        }
      : path.startsWith("/dashboard/cfi")
        ? {
            title: "Create a free account to build your CFI profile",
            description: "Sign in to create or manage your instructor profile, ratings, and student inquiry workflow.",
            bullets: [
              "Appear in the CFI directory",
              "Show ratings and training specialties",
              "Receive student interest through RSF",
            ],
          }
        : {
            title: "Sign In Required",
            description: "Create a free account or sign in to save work, post listings, and access this feature.",
            bullets: [
              "Save plans, profiles, and progress",
              "Manage marketplace activity and messages",
              "Keep your tools and account history in one place",
            ],
          };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Plane className="h-12 w-12 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">{config.title}</CardTitle>
            <CardDescription className="text-base mt-2">
              {config.description}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm text-muted-foreground">
            {config.bullets.map((bullet) => (
              <li key={bullet}>- {bullet}</li>
            ))}
          </ul>
          <div className="flex flex-col gap-3">
            <Link href="/register">
              <Button
                size="lg"
                className="w-full"
                data-testid="button-create-account-required"
              >
                Create Free Account
              </Button>
            </Link>
            <Link href="/login">
              <Button 
                size="lg" 
                variant="outline"
                className="w-full"
                data-testid="button-sign-in-required"
              >
                <LogIn className="mr-2 h-5 w-5" />
                Sign In to Continue
              </Button>
            </Link>
            <Link href="/">
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full"
                data-testid="button-back-home"
              >
                Back to Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
