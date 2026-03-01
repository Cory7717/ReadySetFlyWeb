import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { trackEvent } from "@/lib/analytics";

const tools = [
  {
    title: "RSF GPS Simulators",
    description: "Functionally accurate GPS workflows for IFR training.",
    href: "/gps-sims",
    comingSoon: true,
  },
  {
    title: "IFR Approach Plates",
    description: "Search FAA plates by airport and category.",
    href: "/approach-plates",
  },
  {
    title: "VOR Trainer",
    description: "Radials, OBS, and intercept drills.",
    href: "/student/vor-trainer",
  },
  {
    title: "Flight Planner",
    description: "Plan routes with fuel and time estimates.",
    href: "/flight-planner",
  },
  {
    title: "Aviation Weather",
    description: "METAR/TAF with quick IFR classification.",
    href: "/pilot-tools",
  },
  {
    title: "TFR Map",
    description: "RSF-owned TFR map powered by FAA SWIM.",
    href: "/tfr-map",
  },
  {
    title: "Live Traffic",
    description: "Global ADS-B traffic map powered by ADSBExchange.",
    href: "/live-traffic",
    comingSoon: true,
  },
  {
    title: "Synthetic Vision Lab",
    description: "RSF Pro synthetic attitude/terrain trainer with compact live traffic panel.",
    href: "/synthetic-vision",
    comingSoon: true,
  },
  {
    title: "NOTAMs & Active Runway",
    description: "Live NOTAMs plus runway advisory for a searched airport.",
    href: "/pilot-tools",
  },
  {
    title: "Radio Comms Trainer",
    description: "Scenario practice with scoring.",
    href: "/radio-comms-trainer",
  },
];

export default function IfrTools() {
  useEffect(() => {
    trackEvent("ifr_tools_view", { page: "/ifr-tools" });
  }, []);

  return (
    <div className="min-h-screen">
      <section className="bg-muted py-10">
        <div className="container mx-auto px-4 space-y-3">
          <Badge variant="outline">IFR Tools</Badge>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">Instrument Flight Tools</h1>
          <p className="text-muted-foreground max-w-3xl">
            Train IFR workflows with RSF-branded simulators, plates, and planning tools.
            Guest mode is fully supported.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" disabled aria-disabled>
              GPS Sims coming soon
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
            RSF IFR tools are for training support and are not FAA-approved devices.
          </AlertDescription>
        </Alert>

        <Alert className="border-dashed">
          <AlertTitle>Active development</AlertTitle>
          <AlertDescription>
            GPS simulators, Synthetic Vision, and Live Traffic remain visible here, but they are intentionally held in a coming-soon state until the workflows are fully hardened.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <Card
              key={tool.href}
              className={tool.comingSoon ? "border-dashed bg-muted/40 text-muted-foreground opacity-70" : "hover-elevate"}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {tool.title}
                  {tool.comingSoon && <Badge variant="secondary">Coming soon</Badge>}
                </CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {tool.comingSoon ? (
                  <Button variant="outline" className="w-full" disabled aria-disabled>
                    Coming soon
                  </Button>
                ) : (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={tool.href}>Open tool</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
