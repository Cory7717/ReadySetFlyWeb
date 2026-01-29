import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Scale } from "lucide-react";
import { apiUrl } from "@/lib/api";

type AircraftType = {
  id: string;
  make: string;
  model: string;
  icaoType?: string | null;
  maxGrossWeightLb: number;
  usableFuelGal: number;
  emptyArmIn?: number | null;
  frontArmIn?: number | null;
  rearArmIn?: number | null;
  baggageArmIn?: number | null;
  fuelArmIn?: number | null;
};

function toNumber(value: string) {
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

export default function WeightBalance() {
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [emptyWeight, setEmptyWeight] = useState("0");
  const [emptyArm, setEmptyArm] = useState("0");
  const [frontWeight, setFrontWeight] = useState("0");
  const [frontArm, setFrontArm] = useState("0");
  const [rearWeight, setRearWeight] = useState("0");
  const [rearArm, setRearArm] = useState("0");
  const [baggageWeight, setBaggageWeight] = useState("0");
  const [baggageArm, setBaggageArm] = useState("0");
  const [fuelGallons, setFuelGallons] = useState("0");
  const [fuelArm, setFuelArm] = useState("0");
  const [maxGrossOverride, setMaxGrossOverride] = useState("");
  const [cgMin, setCgMin] = useState("");
  const [cgMax, setCgMax] = useState("");

  const { data: aircraftTypes = [] } = useQuery<AircraftType[]>({
    queryKey: ["/api/aircraft/types"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/aircraft/types"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load aircraft library");
      return res.json();
    },
  });

  const selectedType = useMemo(
    () => aircraftTypes.find((type) => type.id === selectedTypeId) || null,
    [aircraftTypes, selectedTypeId]
  );

  useEffect(() => {
    if (!selectedType || maxGrossOverride) return;
    setMaxGrossOverride(String(selectedType.maxGrossWeightLb ?? ""));
  }, [selectedType, maxGrossOverride]);

  useEffect(() => {
    if (!selectedType) return;
    const maybeSet = (current: string, next?: number | null, setter?: (value: string) => void) => {
      if (!setter) return;
      if (current !== "" && toNumber(current) !== 0) return;
      if (typeof next !== "number") return;
      setter(String(next));
    };
    maybeSet(emptyArm, selectedType.emptyArmIn ?? undefined, setEmptyArm);
    maybeSet(frontArm, selectedType.frontArmIn ?? undefined, setFrontArm);
    maybeSet(rearArm, selectedType.rearArmIn ?? undefined, setRearArm);
    maybeSet(baggageArm, selectedType.baggageArmIn ?? undefined, setBaggageArm);
    maybeSet(fuelArm, selectedType.fuelArmIn ?? undefined, setFuelArm);
  }, [selectedType, emptyArm, frontArm, rearArm, baggageArm, fuelArm]);

  const fuelWeight = toNumber(fuelGallons) * 6;
  const maxGross = toNumber(maxGrossOverride);
  const cgMinValue = toNumber(cgMin);
  const cgMaxValue = toNumber(cgMax);

  const totals = useMemo(() => {
    const rows = [
      { weight: toNumber(emptyWeight), arm: toNumber(emptyArm) },
      { weight: toNumber(frontWeight), arm: toNumber(frontArm) },
      { weight: toNumber(rearWeight), arm: toNumber(rearArm) },
      { weight: toNumber(baggageWeight), arm: toNumber(baggageArm) },
      { weight: fuelWeight, arm: toNumber(fuelArm) },
    ];
    const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
    const totalMoment = rows.reduce((sum, row) => sum + row.weight * row.arm, 0);
    const cg = totalWeight > 0 ? totalMoment / totalWeight : 0;
    return { totalWeight, totalMoment, cg };
  }, [emptyWeight, emptyArm, frontWeight, frontArm, rearWeight, rearArm, baggageWeight, baggageArm, fuelWeight, fuelArm]);

  const isOverMax = maxGross > 0 && totals.totalWeight > maxGross;
  const hasCgRange = cgMinValue > 0 && cgMaxValue > cgMinValue;
  const cgStatus =
    hasCgRange && totals.cg
      ? totals.cg < cgMinValue
        ? "forward"
        : totals.cg > cgMaxValue
        ? "aft"
        : "within"
      : "unknown";
const cgRangeSpan = hasCgRange ? cgMaxValue - cgMinValue : 0;
  const cgMarkerPercent =
    hasCgRange && totals.cg
      ? Math.min(100, Math.max(0, ((totals.cg - cgMinValue) / cgRangeSpan) * 100))
      : 0;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <Scale className="h-7 w-7" />
            Weight & Balance
          </h1>
          <p className="text-muted-foreground">
            Planning estimates only. Always verify with approved aircraft data and POH/AFM.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Aircraft Library</CardTitle>
            <CardDescription>Select an aircraft to prefill max gross weight.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label>RSF Aircraft Library</Label>
            <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select aircraft type" />
              </SelectTrigger>
              <SelectContent>
                {aircraftTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.make} {type.model} {type.icaoType - `(${type.icaoType})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">Max gross {selectedType.maxGrossWeightLb} lb</Badge>
                <Badge variant="outline">Usable fuel {selectedType.usableFuelGal} gal</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weight Stations</CardTitle>
            <CardDescription>Enter your aircraft-specific arms and weights.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Empty weight (lb)</Label>
                <Input value={emptyWeight} onChange={(e) => setEmptyWeight(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Empty weight arm (in)</Label>
                <Input value={emptyArm} onChange={(e) => setEmptyArm(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Front seats total (lb)</Label>
                <Input value={frontWeight} onChange={(e) => setFrontWeight(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Front seats arm (in)</Label>
                <Input value={frontArm} onChange={(e) => setFrontArm(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Rear seats total (lb)</Label>
                <Input value={rearWeight} onChange={(e) => setRearWeight(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Rear seats arm (in)</Label>
                <Input value={rearArm} onChange={(e) => setRearArm(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Baggage (lb)</Label>
                <Input value={baggageWeight} onChange={(e) => setBaggageWeight(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Baggage arm (in)</Label>
                <Input value={baggageArm} onChange={(e) => setBaggageArm(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Fuel on board (gal)</Label>
                <Input value={fuelGallons} onChange={(e) => setFuelGallons(e.target.value)} />
                <p className="text-xs text-muted-foreground">Fuel weight uses 6.0 lb/gal.</p>
              </div>
              <div className="space-y-2">
                <Label>Fuel arm (in)</Label>
                <Input value={fuelArm} onChange={(e) => setFuelArm(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Max gross weight (lb)</Label>
                <Input value={maxGrossOverride} onChange={(e) => setMaxGrossOverride(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>CG min (in)</Label>
                <Input value={cgMin} onChange={(e) => setCgMin(e.target.value)} placeholder="e.g., 35.0" />
              </div>
              <div className="space-y-2">
                <Label>CG max (in)</Label>
                <Input value={cgMax} onChange={(e) => setCgMax(e.target.value)} placeholder="e.g., 47.0" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Total Weight</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{totals.totalWeight.toFixed(1)} lb</div>
              <p className={`text-sm ${isOverMax - "text-destructive" : "text-muted-foreground"}`}>
                {isOverMax - "Over max gross" : "Within limits (est.)"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total Moment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{totals.totalMoment.toFixed(1)}</div>
              <p className="text-sm text-muted-foreground">Weight × arm</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>CG (in)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{totals.cg - totals.cg.toFixed(1) : "--"}</div>
              <p className="text-sm text-muted-foreground">Moment ÷ weight</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>CG Envelope</CardTitle>
            <CardDescription>
              Enter CG min/max to visualize your loading location.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative h-3 w-full rounded-full bg-muted">
              <div className="absolute left-0 top-0 h-3 w-full rounded-full bg-muted" />
              {hasCgRange && (
                <div className="absolute left-0 top-0 h-3 w-full rounded-full bg-emerald-200" />
              )}
              <div
                className="absolute -top-1 h-5 w-1 rounded-full bg-slate-900"
                style={{ left: `${cgMarkerPercent}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground">
              <span>Forward</span>
              <span>
                {hasCgRange - `${cgMinValue.toFixed(1)} - ${cgMaxValue.toFixed(1)} in` : "Enter CG limits"}
              </span>
              <span>Aft</span>
            </div>
            <div className="text-sm">
              {cgStatus === "within" && <span className="text-emerald-600">Within CG range</span>}
              {cgStatus === "forward" && <span className="text-destructive">Forward of CG range</span>}
              {cgStatus === "aft" && <span className="text-destructive">Aft of CG range</span>}
              {cgStatus === "unknown" && <span className="text-muted-foreground">Add CG limits to evaluate range</span>}
            </div>
          </CardContent>
        </Card>

        <Alert>
          <AlertDescription className="text-xs">
            This calculator is for planning only. Always verify loading limits, CG envelope, and weights with official
            aircraft documentation and your instructor.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
