import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, Plane, Wind } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/layout/PageShell";
import { calcWindComponents } from "@/lib/calculators/eb6";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function RunwayPreview({
  runwayHeading,
  windDirection,
  windSpeed,
  crosswind,
}: {
  runwayHeading: number;
  windDirection: number;
  windSpeed: number;
  crosswind: number;
}) {
  const windArrowAngle = windDirection - runwayHeading;
  const crosswindFrom = crosswind > 0 ? "right" : crosswind < 0 ? "left" : "centerline";

  return (
    <div className="flex flex-col items-center gap-3 rounded-[1rem] border border-[#5d6f85]/22 bg-[#0A0E14] p-5">
      <div className="relative h-56 w-56 rounded-full border border-[#5d6f85]/25 bg-[radial-gradient(circle_at_50%_50%,rgba(26,34,45,0.98),rgba(9,13,19,0.98))]">
        <div className="absolute left-1/2 top-1/2 h-40 w-5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[#DCE6F2]/72 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]" />
        <div className="absolute left-1/2 top-1/2 h-28 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-[#0A0E14]/80" />
        <div
          className="absolute left-1/2 top-1/2 h-1 w-28 origin-left rounded-full bg-[#D9A441] shadow-[0_0_18px_rgba(217,164,65,0.35)]"
          style={{ transform: `rotate(${windArrowAngle - 90}deg)` }}
        >
          <span className="absolute -right-1 -top-1.5 h-4 w-4 rotate-45 border-r-2 border-t-2 border-[#D9A441]" />
        </div>
        <div className="absolute left-1/2 top-3 -translate-x-1/2 text-xs font-semibold text-[#A9BBCD]">RWY</div>
      </div>
      <div className="text-center text-xs leading-5 text-[#A9BBCD]">
        Wind {Math.round(windDirection)} at {Math.round(windSpeed)} kt, crosswind from {crosswindFrom}.
      </div>
    </div>
  );
}

export default function CrosswindCalculator() {
  const [runwayHeading, setRunwayHeading] = useState("180");
  const [windDirection, setWindDirection] = useState("220");
  const [windSpeed, setWindSpeed] = useState("18");
  const [windGust, setWindGust] = useState("");

  useEffect(() => {
    trackEvent("tool_view", { tool: "crosswind_calculator" });
  }, []);

  const result = useMemo(() => {
    const runway = toNumber(runwayHeading);
    const direction = toNumber(windDirection);
    const speed = toNumber(windSpeed);
    const gust = toNumber(windGust);
    const errors: string[] = [];

    if (runway === null || runway < 0 || runway > 360) errors.push("Use a runway heading from 0 to 360 degrees.");
    if (direction === null || direction < 0 || direction > 360) errors.push("Use a wind direction from 0 to 360 degrees.");
    if (speed === null || speed < 0 || speed > 100) errors.push("Use a wind speed from 0 to 100 kt.");
    if (gust !== null && (gust < 0 || gust > 120)) errors.push("Use a gust speed from 0 to 120 kt.");

    if (errors.length || runway === null || direction === null || speed === null) {
      return {
        errors,
        runway: runway ?? 0,
        direction: direction ?? 0,
        speed: speed ?? 0,
        angle: 0,
        crosswind: 0,
        headwind: 0,
        gustCrosswind: null as number | null,
        gustHeadwind: null as number | null,
      };
    }

    const wind = calcWindComponents(direction, speed, runway);
    const gustWind = gust !== null && gust > speed ? calcWindComponents(direction, gust, runway) : null;

    return {
      errors,
      runway,
      direction,
      speed,
      angle: wind.relativeAngleDeg,
      crosswind: wind.crosswind,
      headwind: wind.headwind,
      gustCrosswind: gustWind ? gustWind.crosswind : null,
      gustHeadwind: gustWind ? gustWind.headwind : null,
    };
  }, [runwayHeading, windDirection, windSpeed, windGust]);

  const crosswindDirection = result.crosswind > 0 ? "from right" : result.crosswind < 0 ? "from left" : "calm";
  const maxCrosswind = Math.abs(result.gustCrosswind ?? result.crosswind);
  const advisoryLevel = maxCrosswind >= 20 ? "danger" : maxCrosswind >= 15 ? "caution" : "normal";

  return (
    <PageShell
      kicker="EFB"
      title="Crosswind Calculator"
      description="Calculate steady and gust crosswind, headwind, and tailwind components for runway selection and preflight planning."
      actions={
        <>
          <Button asChild variant="outline" className="rsf-metal-button-secondary">
            <Link href="/density-altitude">Density altitude</Link>
          </Button>
          <Button asChild className="rsf-metal-button-primary">
            <Link href="/flight-planner">Start Flight Plan</Link>
          </Button>
        </>
      }
      contentClassName="space-y-6"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="rsf-card-shell text-[#E8EDF4]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#F1F5FA]">
              <Wind className="h-5 w-5 text-[#D9A441]" />
              Wind Components
            </CardTitle>
            <CardDescription className="text-[#A9BBCD]">
              Enter runway heading and reported wind. Gust is optional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="runway-heading" className="text-[#D7E3F2]">Runway heading</Label>
                <Input id="runway-heading" inputMode="decimal" value={runwayHeading} onChange={(event) => setRunwayHeading(event.target.value)} className="border-[#5d6f85]/35 bg-[#0A0E14] text-[#F1F5FA]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wind-direction" className="text-[#D7E3F2]">Wind direction</Label>
                <Input id="wind-direction" inputMode="decimal" value={windDirection} onChange={(event) => setWindDirection(event.target.value)} className="border-[#5d6f85]/35 bg-[#0A0E14] text-[#F1F5FA]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wind-speed" className="text-[#D7E3F2]">Wind speed (kt)</Label>
                <Input id="wind-speed" inputMode="decimal" value={windSpeed} onChange={(event) => setWindSpeed(event.target.value)} className="border-[#5d6f85]/35 bg-[#0A0E14] text-[#F1F5FA]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wind-gust" className="text-[#D7E3F2]">Gust (kt)</Label>
                <Input id="wind-gust" inputMode="decimal" value={windGust} onChange={(event) => setWindGust(event.target.value)} placeholder="Optional" className="border-[#5d6f85]/35 bg-[#0A0E14] text-[#F1F5FA] placeholder:text-[#5d6f85]" />
              </div>
            </div>

            {result.errors.length > 0 ? (
              <Alert className="border-[#7f6327]/40 bg-[#241c0d] text-[#F2DCA4]">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{result.errors[0]}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rsf-metal-subpanel rounded-lg p-4">
                <div className="text-xs text-[#A9BBCD]">Crosswind</div>
                <div className="mt-1 text-2xl font-semibold text-[#F1F5FA]">{Math.abs(result.crosswind).toFixed(1)} kt</div>
                <div className="mt-1 text-xs text-[#A9BBCD]">{crosswindDirection}</div>
              </div>
              <div className="rsf-metal-subpanel rounded-lg p-4">
                <div className="text-xs text-[#A9BBCD]">{result.headwind >= 0 ? "Headwind" : "Tailwind"}</div>
                <div className="mt-1 text-2xl font-semibold text-[#F1F5FA]">{Math.abs(result.headwind).toFixed(1)} kt</div>
                <div className="mt-1 text-xs text-[#A9BBCD]">steady component</div>
              </div>
              <div className="rsf-metal-subpanel rounded-lg p-4">
                <div className="text-xs text-[#A9BBCD]">Wind angle</div>
                <div className="mt-1 text-2xl font-semibold text-[#F1F5FA]">{Math.abs(result.angle).toFixed(0)} deg</div>
                <div className="mt-1 text-xs text-[#A9BBCD]">relative to runway</div>
              </div>
              <div className={cn(
                "rounded-lg border p-4",
                advisoryLevel === "danger"
                  ? "border-[#7a3440]/45 bg-[#1a0b0e]/85"
                  : advisoryLevel === "caution"
                    ? "border-[#7f6327]/45 bg-[#241c0d]/85"
                    : "border-[#5d6f85]/18 bg-[#101720]"
              )}>
                <div className="text-xs text-[#A9BBCD]">Max crosswind</div>
                <div className={cn(
                  "mt-1 text-2xl font-semibold",
                  advisoryLevel === "danger" ? "text-[#F4CDD3]" : advisoryLevel === "caution" ? "text-[#F2DCA4]" : "text-[#F1F5FA]"
                )}>
                  {maxCrosswind.toFixed(1)} kt
                </div>
                <div className="mt-1 text-xs text-[#A9BBCD]">steady or gust</div>
              </div>
            </div>

            <div className="rounded-lg border border-[#5d6f85]/22 bg-[#0A0E14] p-4 text-sm text-[#A9BBCD]">
              Crosswind = {result.speed.toFixed(0)} x sin({Math.abs(result.angle).toFixed(0)} deg) ={" "}
              <span className="font-semibold text-[#F1F5FA]">{Math.abs(result.crosswind).toFixed(1)} kt</span>.
              {" "}Headwind = {result.speed.toFixed(0)} x cos({Math.abs(result.angle).toFixed(0)} deg) ={" "}
              <span className="font-semibold text-[#F1F5FA]">{Math.abs(result.headwind).toFixed(1)} kt</span>.
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <RunwayPreview
            runwayHeading={result.runway}
            windDirection={result.direction}
            windSpeed={result.speed}
            crosswind={result.crosswind}
          />
          <Alert className="border-[#5d6f85]/30 bg-[#0d1420]/70 text-[#A9BBCD]">
            <Plane className="h-4 w-4" />
            <AlertDescription className="text-[#A9BBCD]">
              Planning estimate only. Always verify runway, wind, aircraft limitations, and pilot proficiency before flight.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </PageShell>
  );
}
