import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Gauge, PlaneTakeoff, Thermometer, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageShell } from "@/components/layout/PageShell";
import { calcDensityAltitude, calcIsaTemp, calcPressureAltitude } from "@/lib/calculators/eb6";
import { trackEvent } from "@/lib/analytics";

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatFeet = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return "--";
  return Math.round(value).toLocaleString();
};

const formatTemp = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return "--";
  return value.toFixed(1);
};

export default function DensityAltitude() {
  const [fieldElevation, setFieldElevation] = useState("500");
  const [altimeter, setAltimeter] = useState("29.92");
  const [oat, setOat] = useState("20");
  const [tempUnit, setTempUnit] = useState<"C" | "F">("C");

  useEffect(() => {
    trackEvent("tool_view", { tool: "density_altitude" });
  }, []);

  const result = useMemo(() => {
    const elevationValue = toNumber(fieldElevation);
    const altimeterValue = toNumber(altimeter);
    const oatValue = toNumber(oat);

    const errors: string[] = [];
    if (elevationValue === null || elevationValue < -1000 || elevationValue > 20000) {
      errors.push("Use a field elevation from -1,000 to 20,000 ft.");
    }
    if (altimeterValue === null || altimeterValue < 27 || altimeterValue > 32) {
      errors.push("Use an altimeter setting from 27.00 to 32.00 inHg.");
    }
    if (oatValue === null || (tempUnit === "C" && (oatValue < -60 || oatValue > 60)) || (tempUnit === "F" && (oatValue < -76 || oatValue > 140))) {
      errors.push(tempUnit === "C" ? "Use an OAT from -60 to 60 C." : "Use an OAT from -76 to 140 F.");
    }

    if (errors.length || elevationValue === null || altimeterValue === null || oatValue === null) {
      return {
        errors,
        pressureAltitude: null,
        densityAltitude: null,
        isaTemp: null,
        oatC: null,
        isaDeviation: null,
      };
    }

    const oatC = tempUnit === "F" ? ((oatValue - 32) * 5) / 9 : oatValue;
    const pressureAltitude = calcPressureAltitude(altimeterValue, elevationValue);
    const densityAltitude = calcDensityAltitude(pressureAltitude, oatC, elevationValue);
    const isaTemp = calcIsaTemp(elevationValue);

    return {
      errors,
      pressureAltitude,
      densityAltitude,
      isaTemp,
      oatC,
      isaDeviation: oatC - isaTemp,
    };
  }, [altimeter, fieldElevation, oat, tempUnit]);

  const densityDelta = result.densityAltitude !== null && result.pressureAltitude !== null
    ? result.densityAltitude - result.pressureAltitude
    : null;

  return (
    <PageShell
      kicker="EFB"
      title="Density Altitude Calculator"
      description="Calculate pressure altitude, ISA deviation, and estimated density altitude for preflight performance planning."
      actions={
        <>
          <Button asChild variant="outline" className="rsf-metal-button-secondary">
            <Link href="/tools/e6b">Open E6B</Link>
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
              <Gauge className="h-5 w-5 text-[#D9A441]" />
              Field Conditions
            </CardTitle>
            <CardDescription className="text-[#A9BBCD]">
              Enter current conditions from the airport weather report or AWOS/ASOS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="field-elevation" className="text-[#D7E3F2]">Field elevation (ft MSL)</Label>
                <Input
                  id="field-elevation"
                  inputMode="decimal"
                  value={fieldElevation}
                  onChange={(event) => setFieldElevation(event.target.value)}
                  className="border-[#5d6f85]/35 bg-[#0A0E14] text-[#F1F5FA]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="altimeter" className="text-[#D7E3F2]">Altimeter (inHg)</Label>
                <Input
                  id="altimeter"
                  inputMode="decimal"
                  value={altimeter}
                  onChange={(event) => setAltimeter(event.target.value)}
                  className="border-[#5d6f85]/35 bg-[#0A0E14] text-[#F1F5FA]"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="oat" className="text-[#D7E3F2]">Outside air temperature</Label>
                <Input
                  id="oat"
                  inputMode="decimal"
                  value={oat}
                  onChange={(event) => setOat(event.target.value)}
                  className="border-[#5d6f85]/35 bg-[#0A0E14] text-[#F1F5FA]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#D7E3F2]">Unit</Label>
                <div className="grid grid-cols-2 overflow-hidden rounded-md border border-[#5d6f85]/35">
                  {(["C", "F"] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setTempUnit(unit)}
                      className={`h-10 px-4 text-sm font-semibold transition-colors ${
                        tempUnit === unit
                          ? "bg-[#d7dde6] text-[#0A0E14]"
                          : "bg-[#0A0E14] text-[#A9BBCD] hover:bg-[#18212b]"
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {result.errors.length > 0 ? (
              <Alert className="border-[#7f6327]/40 bg-[#241c0d] text-[#F2DCA4]">
                <AlertTitle>Check inputs</AlertTitle>
                <AlertDescription>{result.errors[0]}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rsf-card-shell text-[#E8EDF4]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#F1F5FA]">
                <PlaneTakeoff className="h-5 w-5 text-[#D9A441]" />
                Result
              </CardTitle>
              <CardDescription className="text-[#A9BBCD]">Planning estimate only.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-[#5d6f85]/22 bg-[#0A0E14] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A9BBCD]">Density altitude</div>
                <div className="mt-2 text-4xl font-bold text-[#F1F5FA]">{formatFeet(result.densityAltitude)} ft</div>
              </div>
              <div className="grid gap-3">
                <div className="rsf-metal-subpanel rounded-lg p-3">
                  <div className="text-xs text-[#A9BBCD]">Pressure altitude</div>
                  <div className="text-xl font-semibold text-[#F1F5FA]">{formatFeet(result.pressureAltitude)} ft</div>
                </div>
                <div className="rsf-metal-subpanel rounded-lg p-3">
                  <div className="text-xs text-[#A9BBCD]">ISA temperature</div>
                  <div className="text-xl font-semibold text-[#F1F5FA]">{formatTemp(result.isaTemp)} C</div>
                </div>
                <div className="rsf-metal-subpanel rounded-lg p-3">
                  <div className="text-xs text-[#A9BBCD]">ISA deviation</div>
                  <div className="text-xl font-semibold text-[#F1F5FA]">
                    {result.isaDeviation === null ? "--" : `${result.isaDeviation >= 0 ? "+" : ""}${formatTemp(result.isaDeviation)} C`}
                  </div>
                </div>
                <div className="rsf-metal-subpanel rounded-lg p-3">
                  <div className="text-xs text-[#A9BBCD]">DA above pressure altitude</div>
                  <div className="text-xl font-semibold text-[#F1F5FA]">
                    {densityDelta === null ? "--" : `${densityDelta >= 0 ? "+" : ""}${formatFeet(densityDelta)} ft`}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Alert className="border-[#5d6f85]/30 bg-[#0d1420]/70 text-[#A9BBCD]">
            <Thermometer className="h-4 w-4" />
            <AlertTitle className="text-[#E8EDF4]">Performance check</AlertTitle>
            <AlertDescription className="text-[#A9BBCD]">
              Use this with your approved POH/AFM performance charts. Density altitude is not a substitute for runway, climb, obstacle, loading, or engine performance data.
            </AlertDescription>
          </Alert>

          <Card className="rsf-card-shell text-[#E8EDF4]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-[#F1F5FA]">
                <Wind className="h-4 w-4 text-[#D9A441]" />
                More EFB Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button asChild variant="outline" className="rsf-metal-button-secondary justify-start">
                <Link href="/weight-balance">Weight & Balance</Link>
              </Button>
              <Button asChild variant="outline" className="rsf-metal-button-secondary justify-start">
                <Link href="/tools/e6b">E6B Flight Computer</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
