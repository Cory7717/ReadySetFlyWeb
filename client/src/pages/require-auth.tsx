import { Link, useLocation } from "wouter";
import { LogIn, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/layout/PageShell";

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
        context: "Keep your flight records available across devices.",
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
          context: "Save your training path instead of starting over each visit.",
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
            context: "Publish your profile where students are already searching.",
          }
        : {
            title: "Sign In Required",
            description: "Create a free account or sign in to save work, post listings, and access this feature.",
            bullets: [
              "Save plans, profiles, and progress",
              "Manage marketplace activity and messages",
              "Keep your tools and account history in one place",
            ],
            context: "Use a free account to keep your work and listings tied together.",
          };

  return (
    <PageShell
      kicker="Free account required"
      title={config.title}
      description={config.description}
      actions={
        <>
          <Badge variant="outline" className="border-white/12 bg-white/8 text-slate-100">Free account</Badge>
          <Badge variant="outline" className="border-white/12 bg-white/8 text-slate-100">Sign in anytime</Badge>
        </>
      }
      contentClassName="flex items-center justify-center py-10"
    >
      <section className="grid w-full max-w-5xl gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[1.4rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(255,255,255,0.56))] p-5 shadow-[0_18px_38px_rgba(15,23,42,0.12)]">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/18 bg-primary/10">
            <Plane className="h-8 w-8 text-primary" />
          </div>
          <div className="mt-5">
            <span className="rsf-kicker">Why sign in</span>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{config.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{config.context}</p>
          </div>
          <div className="mt-5 grid gap-3">
            {config.bullets.map((bullet) => (
              <div
                key={bullet}
                className="rounded-[1rem] border border-primary/14 bg-white/72 px-4 py-3 text-sm text-slate-700"
              >
                {bullet}
              </div>
            ))}
          </div>
        </div>

        <Card className="border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.97),rgba(255,255,255,0.72))] shadow-[0_18px_38px_rgba(15,23,42,0.12)]">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Create account</Badge>
              <Badge variant="outline">Keep your work</Badge>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Get back to this work without starting over.</CardTitle>
              <CardDescription className="mt-2 text-base">
                Create a free RSF account to save progress, return to your tools, and keep your marketplace activity in one place.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
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
                  Sign In
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
            <p className="text-xs text-muted-foreground">
              Free accounts can browse the marketplace, save work, and return to the same tools later.
            </p>
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
