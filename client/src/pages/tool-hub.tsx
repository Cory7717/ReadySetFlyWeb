import { useEffect } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, BookOpen, Calculator, CloudSun, Plane, Radio } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const calculatorLinks = [
  { label: "e6b advanced", href: "/tools/e6b" },
  { label: "Crosswind", href: "/pilot-tools#calculators" },
  { label: "Density Altitude", href: "/pilot-tools#calculators" },
  { label: "Weight & Balance", href: "/weight-balance" },
  { label: "Ownership Cost", href: "/ownership-cost-calculator" },
];

export default function ToolHub() {
  useEffect(() => {
    trackEvent("tool_hub_view");
  }, []);

  return (
    <div className="min-h-screen">
      <section className="bg-muted/30 py-10">
        <div className="container mx-auto px-4 space-y-3">
          <Badge variant="outline">Tool Hub</Badge>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">Pilot Tool Hub</h1>
          <p className="text-muted-foreground max-w-3xl">
            Plan first, verify conditions, avoid restrictions, then train with confidence.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              onClick={() => trackEvent("tool_hub_click", { target: "/flight-planner" })}
            >
              <Link href="/flight-planner">Open Flight Planner</Link>
            </Button>
            <Button
              variant="outline"
              asChild
              onClick={() => trackEvent("tool_hub_click", { target: "/pilot-tools#airport-weather" })}
            >
              <Link href="/pilot-tools#airport-weather">Airport Conditions</Link>
            </Button>
            <Badge variant="secondary">Start here</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Plan → Check conditions → Verify airspace → Train
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plane className="h-5 w-5 text-primary" />
                Flight Planner
              </CardTitle>
              <CardDescription>Build routes, fuel plans, and time estimates.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/flight-planner">Open planner</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CloudSun className="h-5 w-5" />
                Airport Conditions
              </CardTitle>
              <CardDescription>Weather, NOTAMs, runway briefing, and hazards.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/pilot-tools#airport-weather">Open conditions</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Pilot Calculators
              </CardTitle>
              <CardDescription>All calculators in one place.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {calculatorLinks.map((calc) => (
                  <Badge key={calc.label} variant="outline">
                    {calc.label}
                  </Badge>
                ))}
              </div>
              <Button asChild variant="secondary" className="w-full">
                <Link href="/pilot-tools#calculators">Open calculators</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-12 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Student Tools
              </CardTitle>
              <CardDescription>Training plans, study tools, and progress tracking.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/student">Open Student Hub</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5" />
                IFR Tools
              </CardTitle>
              <CardDescription>IFR planners, plates, sims, and training aids.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/ifr-tools">Open IFR tools</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                TFRs & NOTAMs
              </CardTitle>
              <CardDescription>Verify airspace restrictions before you fly.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button asChild variant="outline">
                <Link href="/tfr-map">Open TFR map</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/pilot-tools#airport-briefing">Open NOTAM briefing</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
