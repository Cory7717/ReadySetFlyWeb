import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  ComposedChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, Plane, Scale } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type AircraftType = {
  id: string;
  make: string;
  model: string;
  icaoType?: string | null;
  maxGrossWeightLb: number | string;
  usableFuelGal: number | string;
  emptyArmIn?: number | string | null;
  frontArmIn?: number | string | null;
  rearArmIn?: number | string | null;
  baggageArmIn?: number | string | null;
  fuelArmIn?: number | string | null;
};

type StationCalc = {
  label: string;
  weight: number;
  arm: number;
  moment: number;
};

type Totals = {
  weight: number;
  moment: number;
  cg: number;
};

function toNum(value: string | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calcStation(label: string, weight: number, arm: number): StationCalc {
  return { label, weight, arm, moment: weight * arm };
}

function calcTotals(stations: StationCalc[]): Totals {
  const weight = stations.reduce((sum, station) => sum + station.weight, 0);
  const moment = stations.reduce((sum, station) => sum + station.moment, 0);
  const cg = weight > 0 ? moment / weight : 0;
  return { weight, moment, cg };
}

function statusFromEnvelope(
  cg: number,
  weight: number,
  cgMin: number,
  cgMax: number,
  maxGross: number
): "within" | "forward" | "aft" | "overweight" | "unknown" {
  if (!(cgMin > 0 && cgMax > cgMin) || !(maxGross > 0) || !(weight > 0)) return "unknown";
  if (weight > maxGross) return "overweight";
  if (cg < cgMin) return "forward";
  if (cg > cgMax) return "aft";
  return "within";
}

function StatusBadge({ status, label }: { status: ReturnType<typeof statusFromEnvelope>; label: string }) {
  if (status === "within") {
    return (
      <Badge className="bg-emerald-600 text-white gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {label} within limits
      </Badge>
    );
  }
  if (status === "unknown") {
    return <Badge variant="outline">{label} pending limits</Badge>;
  }
  const text =
    status === "forward"
      ? `${label} forward CG`
      : status === "aft"
      ? `${label} aft CG`
      : `${label} over max gross`;
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertTriangle className="h-3 w-3" />
      {text}
    </Badge>
  );
}

export default function WeightBalance() {
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [fuelDensity, setFuelDensity] = useState("6.0");

  const [emptyWeight, setEmptyWeight] = useState("0");
  const [emptyArm, setEmptyArm] = useState("0");
  const [frontWeight, setFrontWeight] = useState("0");
  const [frontArm, setFrontArm] = useState("0");
  const [rearWeight, setRearWeight] = useState("0");
  const [rearArm, setRearArm] = useState("0");
  const [baggage1Weight, setBaggage1Weight] = useState("0");
  const [baggage1Arm, setBaggage1Arm] = useState("0");
  const [baggage2Weight, setBaggage2Weight] = useState("0");
  const [baggage2Arm, setBaggage2Arm] = useState("0");
  const [fuelGallons, setFuelGallons] = useState("0");
  const [fuelArm, setFuelArm] = useState("0");

  const [maxGrossOverride, setMaxGrossOverride] = useState("");
  const [cgMin, setCgMin] = useState("");
  const [cgMax, setCgMax] = useState("");

  const [fuelBurnedGal, setFuelBurnedGal] = useState("0");

  const { data: aircraftTypes = [] } = useQuery<AircraftType[]>({
    queryKey: ["/api/aircraft/types"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/aircraft/types"), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load aircraft library");
      return response.json();
    },
  });

  const selectedType = useMemo(
    () => aircraftTypes.find((type) => type.id === selectedTypeId) ?? null,
    [aircraftTypes, selectedTypeId]
  );

  useEffect(() => {
    if (!selectedType) return;

    const maybePrefill = (
      currentValue: string,
      nextValue: number | string | null | undefined,
      setter: (value: string) => void
    ) => {
      if (currentValue !== "" && toNum(currentValue) !== 0) return;
      const next = toNum(nextValue);
      if (next <= 0) return;
      setter(String(next));
    };

    maybePrefill(emptyArm, selectedType.emptyArmIn, setEmptyArm);
    maybePrefill(frontArm, selectedType.frontArmIn, setFrontArm);
    maybePrefill(rearArm, selectedType.rearArmIn, setRearArm);
    maybePrefill(baggage1Arm, selectedType.baggageArmIn, setBaggage1Arm);
    maybePrefill(fuelArm, selectedType.fuelArmIn, setFuelArm);

    if (!maxGrossOverride || toNum(maxGrossOverride) <= 0) {
      setMaxGrossOverride(String(toNum(selectedType.maxGrossWeightLb)));
    }
    if (toNum(fuelGallons) <= 0 && toNum(selectedType.usableFuelGal) > 0) {
      setFuelGallons(String(toNum(selectedType.usableFuelGal)));
    }
  }, [
    selectedType,
    emptyArm,
    frontArm,
    rearArm,
    baggage1Arm,
    fuelArm,
    maxGrossOverride,
    fuelGallons,
  ]);

  const fuelWeightPerGal = toNum(fuelDensity) > 0 ? toNum(fuelDensity) : 6.0;
  const fuelTakeoffWeight = toNum(fuelGallons) * fuelWeightPerGal;
  const fuelBurnedWeight = toNum(fuelBurnedGal) * fuelWeightPerGal;
  const fuelLandingWeight = Math.max(0, fuelTakeoffWeight - fuelBurnedWeight);
  const overBurn = fuelBurnedWeight > fuelTakeoffWeight;

  const takeoffStations = useMemo<StationCalc[]>(
    () => [
      calcStation("Empty Weight", toNum(emptyWeight), toNum(emptyArm)),
      calcStation("Front Seats", toNum(frontWeight), toNum(frontArm)),
      calcStation("Rear Seats", toNum(rearWeight), toNum(rearArm)),
      calcStation("Baggage Area 1", toNum(baggage1Weight), toNum(baggage1Arm)),
      calcStation("Baggage Area 2", toNum(baggage2Weight), toNum(baggage2Arm)),
      calcStation("Fuel", fuelTakeoffWeight, toNum(fuelArm)),
    ],
    [
      emptyWeight,
      emptyArm,
      frontWeight,
      frontArm,
      rearWeight,
      rearArm,
      baggage1Weight,
      baggage1Arm,
      baggage2Weight,
      baggage2Arm,
      fuelTakeoffWeight,
      fuelArm,
    ]
  );

  const landingStations = useMemo<StationCalc[]>(
    () => [
      calcStation("Empty Weight", toNum(emptyWeight), toNum(emptyArm)),
      calcStation("Front Seats", toNum(frontWeight), toNum(frontArm)),
      calcStation("Rear Seats", toNum(rearWeight), toNum(rearArm)),
      calcStation("Baggage Area 1", toNum(baggage1Weight), toNum(baggage1Arm)),
      calcStation("Baggage Area 2", toNum(baggage2Weight), toNum(baggage2Arm)),
      calcStation("Fuel", fuelLandingWeight, toNum(fuelArm)),
    ],
    [
      emptyWeight,
      emptyArm,
      frontWeight,
      frontArm,
      rearWeight,
      rearArm,
      baggage1Weight,
      baggage1Arm,
      baggage2Weight,
      baggage2Arm,
      fuelLandingWeight,
      fuelArm,
    ]
  );

  const takeoffTotals = useMemo(() => calcTotals(takeoffStations), [takeoffStations]);
  const landingTotals = useMemo(() => calcTotals(landingStations), [landingStations]);

  const maxGross = toNum(maxGrossOverride);
  const cgMinVal = toNum(cgMin);
  const cgMaxVal = toNum(cgMax);
  const hasEnvelopeInputs = cgMinVal > 0 && cgMaxVal > cgMinVal && maxGross > 0;

  const takeoffStatus = statusFromEnvelope(
    takeoffTotals.cg,
    takeoffTotals.weight,
    cgMinVal,
    cgMaxVal,
    maxGross
  );
  const landingStatus = statusFromEnvelope(
    landingTotals.cg,
    landingTotals.weight,
    cgMinVal,
    cgMaxVal,
    maxGross
  );

  const maxWeightForChart = Math.max(maxGross, takeoffTotals.weight, landingTotals.weight, 1000);
  const cgPadding = hasEnvelopeInputs ? (cgMaxVal - cgMinVal) * 0.3 : 2;
  const chartXMin = hasEnvelopeInputs ? cgMinVal - cgPadding : Math.max(20, takeoffTotals.cg - 5, landingTotals.cg - 5);
  const chartXMax = hasEnvelopeInputs ? cgMaxVal + cgPadding : Math.max(60, takeoffTotals.cg + 5, landingTotals.cg + 5);
  const chartData = useMemo(
    () => [
      { cg: chartXMin, weight: 0 },
      { cg: chartXMax, weight: maxWeightForChart * 1.1 },
    ],
    [chartXMin, chartXMax, maxWeightForChart]
  );

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Scale className="h-7 w-7" />
          Weight & Balance
        </h1>
        <p className="text-sm text-muted-foreground">
          Planning estimate only. Always verify against your approved POH/AFM data.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aircraft Setup</CardTitle>
          <CardDescription>
            Select your aircraft to prefill baseline arms and max gross. Confirm every value before flight.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>RSF Aircraft Library</Label>
            <Select
              value={selectedTypeId}
              onValueChange={(value) => {
                setSelectedTypeId(value);
                setMaxGrossOverride("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select aircraft type" />
              </SelectTrigger>
              <SelectContent>
                {aircraftTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.make} {type.model}
                    {type.icaoType ? ` (${type.icaoType})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">
                  Max gross baseline: {toNum(selectedType.maxGrossWeightLb).toFixed(0)} lb
                </Badge>
                <Badge variant="outline">
                  Usable fuel baseline: {toNum(selectedType.usableFuelGal).toFixed(1)} gal
                </Badge>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Fuel Weight (lb/gal)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
              <Select value={fuelDensity} onValueChange={setFuelDensity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6.0">Avgas 100LL (6.0)</SelectItem>
                  <SelectItem value="6.1">Avgas hot-day est. (6.1)</SelectItem>
                  <SelectItem value="6.7">Jet-A (6.7)</SelectItem>
                  <SelectItem value="6.8">Jet-A high-density (6.8)</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={fuelDensity}
                onChange={(e) => setFuelDensity(e.target.value)}
                placeholder="Enter your exact fuel density"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Enter the exact value used in your operation. Do not rely on default assumptions.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weight Stations</CardTitle>
          <CardDescription>Fill each station with actual values from your load sheet and POH/AFM.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {[
            { label: "Empty Weight", wVal: emptyWeight, setW: setEmptyWeight, aVal: emptyArm, setA: setEmptyArm },
            { label: "Front Seats", wVal: frontWeight, setW: setFrontWeight, aVal: frontArm, setA: setFrontArm },
            { label: "Rear Seats", wVal: rearWeight, setW: setRearWeight, aVal: rearArm, setA: setRearArm },
            { label: "Baggage Area 1", wVal: baggage1Weight, setW: setBaggage1Weight, aVal: baggage1Arm, setA: setBaggage1Arm },
            { label: "Baggage Area 2", wVal: baggage2Weight, setW: setBaggage2Weight, aVal: baggage2Arm, setA: setBaggage2Arm },
          ].map((row) => (
            <div key={row.label} className="grid gap-3 sm:grid-cols-[1fr_170px_170px] items-end">
              <div>
                <Label className="text-xs text-muted-foreground">{row.label}</Label>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Weight (lb)</Label>
                <Input value={row.wVal} onChange={(e) => row.setW(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Arm (in)</Label>
                <Input value={row.aVal} onChange={(e) => row.setA(e.target.value)} />
              </div>
            </div>
          ))}

          <Separator />

          <div className="grid gap-3 sm:grid-cols-[1fr_170px_170px] items-end">
            <div>
              <Label className="text-xs text-muted-foreground">Fuel</Label>
              <p className="text-xs text-muted-foreground">
                Auto weight: {fuelTakeoffWeight.toFixed(1)} lb ({toNum(fuelGallons).toFixed(1)} gal x{" "}
                {fuelWeightPerGal.toFixed(2)} lb/gal)
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fuel on Board (gal)</Label>
              <Input value={fuelGallons} onChange={(e) => setFuelGallons(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fuel Arm (in)</Label>
              <Input value={fuelArm} onChange={(e) => setFuelArm(e.target.value)} />
            </div>
          </div>

          <Separator />

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Max Gross Weight (lb)</Label>
              <Input value={maxGrossOverride} onChange={(e) => setMaxGrossOverride(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CG Min (in)</Label>
              <Input value={cgMin} onChange={(e) => setCgMin(e.target.value)} placeholder="Example: 35.0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CG Max (in)</Label>
              <Input value={cgMax} onChange={(e) => setCgMax(e.target.value)} placeholder="Example: 47.3" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" />
            Takeoff vs Landing
          </CardTitle>
          <CardDescription>Compare loading at brake release and expected landing state.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Fuel Burned En Route (gal)</Label>
              <Input value={fuelBurnedGal} onChange={(e) => setFuelBurnedGal(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Landing fuel: {Math.max(0, toNum(fuelGallons) - toNum(fuelBurnedGal)).toFixed(1)} gal (
                {fuelLandingWeight.toFixed(1)} lb)
              </p>
            </div>
          </div>

          {overBurn && (
            <Alert variant="destructive">
              <AlertDescription>
                Planned fuel burn exceeds fuel on board. Landing fuel has been floored to zero for math safety.
              </AlertDescription>
            </Alert>
          )}

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="py-2 px-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Condition</th>
                  <th className="py-2 px-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weight (lb)</th>
                  <th className="py-2 px-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Moment</th>
                  <th className="py-2 px-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">CG (in)</th>
                  <th className="py-2 px-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">Takeoff</td>
                  <td className="py-3 px-4 text-right tabular-nums">{takeoffTotals.weight.toFixed(1)}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{takeoffTotals.moment.toFixed(1)}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{takeoffTotals.cg.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right">
                    <StatusBadge status={takeoffStatus} label="Takeoff" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">Landing</td>
                  <td className="py-3 px-4 text-right tabular-nums">{landingTotals.weight.toFixed(1)}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{landingTotals.moment.toFixed(1)}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{landingTotals.cg.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right">
                    <StatusBadge status={landingStatus} label="Landing" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Moment Table (Takeoff)</CardTitle>
          <CardDescription>Station-by-station worksheet with full moment breakdown.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Station</th>
                <th className="py-2 pr-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weight (lb)</th>
                <th className="py-2 pr-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Arm (in)</th>
                <th className="py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Moment</th>
              </tr>
            </thead>
            <tbody>
              {takeoffStations.map((station) => (
                <tr key={station.label} className="border-b last:border-b-0">
                  <td className="py-2 pr-4">{station.label}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{station.weight.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{station.arm.toFixed(2)}</td>
                  <td className="py-2 text-right tabular-nums">{station.moment.toFixed(1)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="pt-3 pr-4">Total</td>
                <td className="pt-3 pr-4 text-right tabular-nums">{takeoffTotals.weight.toFixed(1)}</td>
                <td className="pt-3 pr-4 text-right tabular-nums">{takeoffTotals.cg.toFixed(2)}</td>
                <td className="pt-3 text-right tabular-nums">{takeoffTotals.moment.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2D CG Envelope View</CardTitle>
          <CardDescription>
            {hasEnvelopeInputs
              ? "Green envelope is based on entered CG min/max and max gross. Plot points show takeoff and landing."
              : "Enter CG min/max and max gross weight to render envelope and loading points."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasEnvelopeInputs ? (
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={chartData} margin={{ top: 20, right: 24, left: 8, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  dataKey="cg"
                  domain={[chartXMin, chartXMax]}
                  tickFormatter={(value) => Number(value).toFixed(1)}
                  fontSize={11}
                  label={{ value: "CG (in)", position: "insideBottom", offset: -8, fontSize: 12 }}
                />
                <YAxis
                  type="number"
                  dataKey="weight"
                  domain={[0, maxWeightForChart * 1.1]}
                  fontSize={11}
                  label={{ value: "Weight (lb)", angle: -90, position: "insideLeft", offset: 4, fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [Number(value).toFixed(1), name]}
                  labelFormatter={(label) => `CG ${Number(label).toFixed(2)} in`}
                />
                <ReferenceArea
                  x1={cgMinVal}
                  x2={cgMaxVal}
                  y1={0}
                  y2={maxGross}
                  fill="hsl(142 71% 45% / 0.14)"
                  stroke="hsl(142 71% 42%)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                />
                <ReferenceLine
                  y={maxGross}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="5 4"
                  label={{ value: `Max ${maxGross.toFixed(0)} lb`, position: "right", fontSize: 10 }}
                />
                <ReferenceLine x={cgMinVal} stroke="hsl(142 71% 42%)" strokeDasharray="3 3" />
                <ReferenceLine x={cgMaxVal} stroke="hsl(142 71% 42%)" strokeDasharray="3 3" />

                {takeoffTotals.weight > 0 && (
                  <ReferenceDot
                    x={takeoffTotals.cg}
                    y={takeoffTotals.weight}
                    r={8}
                    fill={takeoffStatus === "within" ? "#16a34a" : "#dc2626"}
                    stroke="#fff"
                    strokeWidth={2}
                    label={{ value: "TO", position: "top", fontSize: 11, fontWeight: 700 }}
                  />
                )}
                {landingTotals.weight > 0 && (
                  <ReferenceDot
                    x={landingTotals.cg}
                    y={landingTotals.weight}
                    r={8}
                    fill={landingStatus === "within" ? "#2563eb" : "#dc2626"}
                    stroke="#fff"
                    strokeWidth={2}
                    label={{ value: "LDG", position: "bottom", fontSize: 11, fontWeight: 700 }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 rounded-lg border border-dashed flex items-center justify-center text-sm text-muted-foreground">
              Add CG min/max and max gross to display the envelope.
            </div>
          )}

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-emerald-600" />
              Takeoff point
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-blue-600" />
              Landing point
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-red-600" />
              Outside limits
            </span>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertDescription className="text-xs">
          This tool is for planning support only. Confirm station limits, approved envelope shape, and final numbers
          with official aircraft documentation before flight.
        </AlertDescription>
      </Alert>
    </div>
  );
}

