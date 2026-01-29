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

  const fuelWeight = toNumber(fuelGallons) * 6;
  const maxGross = toNumber(maxGrossOverride);

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
                    {type.make} {type.model} {type.icaoType ? `(${type.icaoType})` : ""}
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
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Total Weight</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{totals.totalWeight.toFixed(1)} lb</div>
              <p className={`text-sm ${isOverMax ? "text-destructive" : "text-muted-foreground"}`}>
                {isOverMax ? "Over max gross" : "Within limits (est.)"}
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
              <div className="text-2xl font-semibold">{totals.cg ? totals.cg.toFixed(1) : "--"}</div>
              <p className="text-sm text-muted-foreground">Moment ÷ weight</p>
            </CardContent>
          </Card>
        </div>

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
