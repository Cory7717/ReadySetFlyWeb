import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Gauge, PlaneTakeoff, Thermometer, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageShell } from "@/components/layout/PageShell";
import { apiUrl } from "@/lib/api";
import { calcDensityAltitude, calcIsaTemp, calcPressureAltitude } from "@/lib/calculators/eb6";
import { trackEvent } from "@/lib/analytics";

type AircraftType = {
  id: string;
  make: string;
  model: string;
  icaoType?: string | null;
  category?: string | null;
  maxGrossWeightLb?: number | string | null;
  usableFuelGal?: number | string | null;
};

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
  const [selectedAircraftId, setSelectedAircraftId] = useState("");

  const { data: aircraftTypes = [] } = useQuery<AircraftType[]>({
    queryKey: ["/api/aircraft/types"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/aircraft/types"), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load aircraft library");
      return response.json();
    },
  });

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
  const densityAboveField = result.densityAltitude !== null ? result.densityAltitude - (toNumber(fieldElevation) ?? 0) : null;
  const selectedAircraft = aircraftTypes.find((aircraft) => aircraft.id === selectedAircraftId) ?? null;
  const interpretation = useMemo(() => {
    if (densityAboveField === null || result.densityAltitude === null) {
      return {
        label: "Awaiting result",
        tone: "neutral",
        summary: "Enter current field conditions to estimate how the airplane will perform.",
        bullets: [
          "Density altitude translates weather and pressure into a performance altitude.",
          "Use the result to decide when to open the aircraft performance charts.",
          "It does not replace takeoff, climb, or landing distance data.",
        ],
      };
    }
    if (densityAboveField >= 3000) {
      return {
        label: "High density altitude",
        tone: "danger",
        summary: `The airplane may perform as if it is operating near ${formatFeet(result.densityAltitude)} ft.`,
        bullets: [
          "Expect longer takeoff roll and weaker climb performance.",
          "Verify POH/AFM takeoff, climb, obstacle, and landing distance charts.",
          "Recheck weight, runway length, wind, slope, surface, and obstacle clearance.",
        ],
      };
    }
    if (densityAboveField >= 1500) {
      return {
        label: "Elevated density altitude",
        tone: "caution",
        summary: `Performance may feel closer to a ${formatFeet(result.densityAltitude)} ft airport than field elevation.`,
        bullets: [
          "Expect reduced climb and increased runway requirement.",
          "Compare the result against POH/AFM performance chart conditions.",
          "Consider fuel/load adjustments if chart margins are tight.",
        ],
      };
    }
    return {
      label: "Normal or favorable range",
      tone: "normal",
      summary: "Density altitude is close to field elevation for the current conditions.",
      bullets: [
        "Performance may be near expected values, but charts still control.",
        "Use runway, wind, slope, surface, and aircraft weight before making a go/no-go decision.",
        "Recalculate if temperature or pressure changes before departure.",
      ],
    };
  }, [densityAboveField, result.densityAltitude]);

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
        <div className="space-y-6">
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

            <div className="rounded-[1rem] border border-[#5d6f85]/24 bg-[#0A0E14] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A9BBCD]">Performance context</div>
                  <h3 className="mt-1 text-xl font-semibold text-[#F1F5FA]">{interpretation.label}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#A9BBCD]">{interpretation.summary}</p>
                </div>
                <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  interpretation.tone === "danger"
                    ? "border-[#7a3440]/45 bg-[#1a0b0e] text-[#F4CDD3]"
                    : interpretation.tone === "caution"
                      ? "border-[#7f6327]/45 bg-[#241c0d] text-[#F2DCA4]"
                      : "border-[#5d6f85]/30 bg-[#121923] text-[#DCE6F2]"
                }`}>
                  DA {formatFeet(result.densityAltitude)} ft
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  { label: "Field elevation", value: `${formatFeet(toNumber(fieldElevation))} ft`, helper: "Airport surface" },
                  { label: "Pressure altitude", value: `${formatFeet(result.pressureAltitude)} ft`, helper: "Pressure-adjusted altitude" },
                  { label: "Density altitude", value: `${formatFeet(result.densityAltitude)} ft`, helper: "Performance altitude" },
                ].map((item, index) => (
                  <div key={item.label} className="relative rounded-lg border border-[#5d6f85]/18 bg-[#101720] p-3">
                    {index < 2 ? (
                      <div className="pointer-events-none absolute -right-2 top-1/2 hidden h-px w-4 bg-[#5d6f85]/40 md:block" />
                    ) : null}
                    <div className="text-xs text-[#A9BBCD]">{item.label}</div>
                    <div className="mt-1 text-xl font-semibold text-[#F1F5FA]">{item.value}</div>
                    <div className="mt-1 text-xs text-[#7f94ab]">{item.helper}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-2 text-sm text-[#A9BBCD]">
                {interpretation.bullets.map((bullet) => (
                  <div key={bullet} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D9A441]" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rsf-card-shell text-[#E8EDF4]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#F1F5FA]">
              <PlaneTakeoff className="h-5 w-5 text-[#D9A441]" />
              Aircraft Context
            </CardTitle>
            <CardDescription className="text-[#A9BBCD]">
              Select an aircraft to frame the DA result. Runway distances still require approved POH/AFM performance data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="aircraft-type" className="text-[#D7E3F2]">RSF aircraft library</Label>
              <select
                id="aircraft-type"
                value={selectedAircraftId}
                onChange={(event) => setSelectedAircraftId(event.target.value)}
                className="h-10 w-full rounded-md border border-[#5d6f85]/35 bg-[#0A0E14] px-3 text-sm text-[#F1F5FA] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#9CB4CC]"
              >
                <option value="">Select aircraft type</option>
                {aircraftTypes.map((aircraft) => (
                  <option key={aircraft.id} value={aircraft.id}>
                    {aircraft.make} {aircraft.model}{aircraft.icaoType ? ` (${aircraft.icaoType})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedAircraft ? (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rsf-metal-subpanel rounded-lg p-3">
                  <div className="text-xs text-[#A9BBCD]">Aircraft</div>
                  <div className="mt-1 text-sm font-semibold text-[#F1F5FA]">
                    {selectedAircraft.make} {selectedAircraft.model}
                  </div>
                </div>
                <div className="rsf-metal-subpanel rounded-lg p-3">
                  <div className="text-xs text-[#A9BBCD]">Max gross</div>
                  <div className="mt-1 text-sm font-semibold text-[#F1F5FA]">
                    {selectedAircraft.maxGrossWeightLb ? `${Number(selectedAircraft.maxGrossWeightLb).toLocaleString()} lb` : "Not in library"}
                  </div>
                </div>
                <div className="rsf-metal-subpanel rounded-lg p-3">
                  <div className="text-xs text-[#A9BBCD]">Usable fuel</div>
                  <div className="mt-1 text-sm font-semibold text-[#F1F5FA]">
                    {selectedAircraft.usableFuelGal ? `${Number(selectedAircraft.usableFuelGal).toLocaleString()} gal` : "Not in library"}
                  </div>
                </div>
              </div>
            ) : null}

            <Alert className="border-[#7f6327]/40 bg-[#241c0d]/80 text-[#F2DCA4]">
              <AlertTitle className="text-[#F2DCA4]">Performance data needed</AlertTitle>
              <AlertDescription className="text-[#D9BD7A]">
                RSF can show aircraft context here, but takeoff and landing runway required must come from approved POH/AFM performance charts for the selected weight, wind, surface, slope, temperature, pressure, and obstacle condition.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
        </div>

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
