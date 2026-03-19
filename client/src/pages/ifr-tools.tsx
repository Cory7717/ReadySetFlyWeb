import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { canUseInternalPreview } from "@/lib/internal-preview";
import { PageShell } from "@/components/layout/PageShell";
import { AlertTriangle, FileText, Plane, Radio } from "lucide-react";

type IfrTool = {
  title: string;
  description: string;
  href: string;
  cta: string;
  comingSoon?: boolean;
};

const tools: IfrTool[] = [
  {
    title: "RSF GPS Simulators",
    description: "Functionally accurate GPS workflows for IFR training.",
    href: "/gps-sims",
    cta: "Coming soon",
    comingSoon: true,
  },
  {
    title: "IFR Approach Plates",
    description: "Search FAA plates by airport and category.",
    href: "/approach-plates",
    cta: "Open plates",
  },
  {
    title: "VOR Trainer",
    description: "Radials, OBS, and intercept drills.",
    href: "/student/vor-trainer",
    cta: "Practice VOR",
  },
  {
    title: "Flight Planner",
    description: "Plan routes with fuel and time estimates.",
    href: "/flight-planner",
    cta: "Open planner",
  },
  {
    title: "Aviation Weather",
    description: "METAR/TAF with quick IFR classification.",
    href: "/pilot-tools",
    cta: "Open weather",
  },
  {
    title: "TFR Map",
    description: "RSF-owned TFR map powered by FAA SWIM.",
    href: "/tfr-map",
    cta: "Check airspace",
  },
  {
    title: "Live Traffic",
    description: "Global ADS-B traffic map powered by ADSBExchange.",
    href: "/live-traffic",
    cta: "Coming soon",
    comingSoon: true,
  },
  {
    title: "Synthetic Vision Lab",
    description: "RSF Pro synthetic attitude/terrain trainer with compact live traffic panel.",
    href: "/synthetic-vision",
    cta: "Coming soon",
    comingSoon: true,
  },
  {
    title: "NOTAMs & Active Runway",
    description: "Live NOTAMs plus runway advisory for a searched airport.",
    href: "/pilot-tools",
    cta: "Open briefing",
  },
  {
    title: "Radio Comms Trainer",
    description: "Scenario practice with scoring.",
    href: "/radio-comms-trainer",
    cta: "Open trainer",
  },
];

const availableNow = tools.filter((tool) => !tool.comingSoon);
const comingSoon = tools.filter((tool) => tool.comingSoon);

export default function IfrTools() {
  const { user } = useAuth();
  const canPreviewInternal = canUseInternalPreview(user);
  const previewAvailableNow = canPreviewInternal ? tools : availableNow;
  const previewComingSoon = canPreviewInternal ? [] : comingSoon;

  useEffect(() => {
    trackEvent("ifr_tools_view", { page: "/ifr-tools" });
  }, []);

  return (
    <PageShell
      kicker="Instrument"
      title="Instrument Flight Tools"
      description={
        <>
          Train IFR workflows with plates, planning tools, and radio practice built for instrument students and current pilots.
          {" "}
          Guest mode is fully supported.
        </>
      }
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/flight-planner">Open planner</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/approach-plates">Open plates</Link>
          </Button>
        </>
      }
      contentClassName="space-y-6"
    >
      <section className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.15rem] border border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--primary)/0.08))] p-5 shadow-[var(--shadow-rsf-panel)]">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary/80">Available now</div>
            <h2 className="text-2xl font-semibold">Use the IFR tools that are ready today</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Plates, planning, weather, NOTAM review, and radio practice are live now. The deeper IFR trainer surfaces stay visible below, but they remain clearly marked until they are ready.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Button asChild className="w-full">
                <Link href="/approach-plates">Open plates</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/flight-planner">Open planner</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/radio-comms-trainer">Open trainer</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { icon: FileText, title: "Review procedures", text: "Search plates and review NOTAMs before the next instrument lesson or trip." },
              { icon: Plane, title: "Plan ahead", text: "Build routes, timing, and fuel estimates with the same planner used elsewhere in RSF." },
              { icon: Radio, title: "Practice communication", text: "Use radio scenarios and VOR practice to sharpen IFR cockpit habits on the ground." },
            ].map((item) => (
              <div key={item.title} className="rounded-[1rem] border border-white/10 bg-white/75 p-4 shadow-[var(--shadow-rsf-soft)]">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <item.icon className="h-4 w-4 text-primary" />
                  {item.title}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <Alert>
          <AlertTitle>Training aid only</AlertTitle>
          <AlertDescription>
            RSF IFR tools are for training support and are not FAA-approved devices.
          </AlertDescription>
        </Alert>

        {canPreviewInternal ? (
          <Alert className="border-primary/25 bg-primary/5">
            <AlertTitle>Internal preview enabled</AlertTitle>
            <AlertDescription>
              Hidden IFR surfaces are open for your Super Admin account so you can review trainer quality before wider release.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-dashed">
            <AlertTitle>Coming soon</AlertTitle>
            <AlertDescription>
              GPS trainers, Synthetic Vision, and Live Traffic stay visible here, but they are still being finished before wider release.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Available now</h2>
              <p className="text-sm text-muted-foreground">
                These tools are live and ready for planning, procedure review, and IFR practice today.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {previewAvailableNow.map((tool) => {
                const isPreviewCard = Boolean(tool.comingSoon && canPreviewInternal);
                return (
                <Card key={tool.href} className="hover-elevate">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {tool.title}
                      {isPreviewCard ? <Badge variant="outline">Internal Preview</Badge> : null}
                    </CardTitle>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" className="w-full">
                      <Link href={tool.href}>{isPreviewCard ? "Open Internal Preview" : tool.cta}</Link>
                    </Button>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          </div>

          {previewComingSoon.length > 0 ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <h2 className="flex items-center gap-2 text-2xl font-semibold">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Coming soon
              </h2>
              <p className="text-sm text-muted-foreground">
                These IFR-critical surfaces stay visible for the roadmap, but they remain intentionally disabled until they are ready.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {previewComingSoon.map((tool) => (
                <Card
                  key={tool.href}
                  className="border-dashed bg-muted/40 text-muted-foreground opacity-70"
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {tool.title}
                      <Badge variant="secondary">Coming soon</Badge>
                    </CardTitle>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full" disabled aria-disabled>
                      Coming soon
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          ) : null}
        </div>
      </section>
    </PageShell>
  );
}
