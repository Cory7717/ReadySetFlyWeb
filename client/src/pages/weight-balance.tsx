import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Plane,
  Plus,
  Save,
  Scale,
  Trash2,
  Upload,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  calculateWeightBalance,
  createScenarioForProfile,
  makeId,
  numberOrZero,
  rectangularEnvelope,
  type WeightBalanceEnvelopePoint,
  type WeightBalanceFuelTank,
  type WeightBalancePhaseResult,
  type WeightBalanceProfile,
  type WeightBalanceScenario,
  type WeightBalanceStation,
} from "@shared/weight-balance";
import {
  exportWeightBalanceData,
  loadWeightBalanceProfiles,
  loadWeightBalanceScenarios,
  parseWeightBalanceImport,
  saveWeightBalanceProfiles,
  saveWeightBalanceScenarios,
} from "@/lib/weightBalanceStorage";

type AircraftType = {
  id: string;
  make: string;
  model: string;
  icaoType?: string | null;
  maxGrossWeightLb: number | string;
  usableFuelGal: number | string;
  max_gross_weight_lb_effective?: number | string | null;
  usable_fuel_gal_effective?: number | string | null;
  emptyArmIn?: number | string | null;
  frontArmIn?: number | string | null;
  rearArmIn?: number | string | null;
  baggageArmIn?: number | string | null;
  fuelArmIn?: number | string | null;
};

type AircraftProfile = {
  id: string;
  name: string;
  tailNumber?: string | null;
  typeId?: string | null;
  isDefault?: boolean | null;
  type?: AircraftType | null;
  usableFuelOverrideGal?: number | string | null;
  maxGrossWeightOverrideLb?: number | string | null;
  usable_fuel_gal_effective?: number | string | null;
  max_gross_weight_lb_effective?: number | string | null;
};

function formatNumber(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "--";
}

function replaceAt<T>(items: T[], index: number, next: T): T[] {
  return items.map((item, itemIndex) => (itemIndex === index ? next : item));
}

function statusClasses(status: WeightBalancePhaseResult["status"]): string {
  if (status === "within") return "border-emerald-500/50 bg-emerald-500/10 text-emerald-100";
  if (status === "unknown") return "border-slate-500/50 bg-slate-500/10 text-slate-200";
  return "border-red-500/60 bg-red-500/10 text-red-100";
}

function StatusBadge({ phase }: { phase: WeightBalancePhaseResult }) {
  if (phase.status === "within") {
    return (
      <Badge className="gap-1 bg-emerald-600 text-white">
        <CheckCircle2 className="h-3 w-3" />
        Within limits
      </Badge>
    );
  }
  if (phase.status === "unknown") return <Badge variant="outline">Needs limits</Badge>;
  const label =
    phase.status === "forward"
      ? "Forward CG"
      : phase.status === "aft"
        ? "Aft CG"
        : phase.status === "overweight"
          ? "Overweight"
          : "Check limits";
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertTriangle className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function profileFromAircraft(type: AircraftType, profile?: AircraftProfile | null): WeightBalanceProfile {
  const maxGross = numberOrZero(profile?.max_gross_weight_lb_effective ?? profile?.maxGrossWeightOverrideLb)
    || numberOrZero(type.max_gross_weight_lb_effective ?? type.maxGrossWeightLb)
    || 2550;
  const usableFuel = numberOrZero(profile?.usable_fuel_gal_effective ?? profile?.usableFuelOverrideGal)
    || numberOrZero(type.usable_fuel_gal_effective ?? type.usableFuelGal)
    || 40;
  const cgMin = 35;
  const cgMax = 47.3;
  return {
    id: makeId("wb_profile"),
    name: profile?.tailNumber
      ? `${profile.tailNumber} W&B`
      : `${type.make} ${type.model} W&B`.trim(),
    tailNumber: profile?.tailNumber ?? undefined,
    make: type.make,
    model: type.model,
    icaoType: type.icaoType ?? undefined,
    source: "rsf-aircraft-library",
    verificationStatus: "needs-poh-review",
    maxRampWeightLb: maxGross,
    maxTakeoffWeightLb: maxGross,
    maxLandingWeightLb: maxGross,
    taxiFuelGal: 1,
    stations: [
      { id: "empty", name: "Basic Empty Aircraft", type: "empty", armIn: numberOrZero(type.emptyArmIn), defaultWeightLb: 0, required: true },
      { id: "front", name: "Front Seats", type: "occupant", armIn: numberOrZero(type.frontArmIn), defaultWeightLb: 0 },
      { id: "rear", name: "Rear Seats", type: "occupant", armIn: numberOrZero(type.rearArmIn), defaultWeightLb: 0 },
      { id: "baggage-a", name: "Baggage Area", type: "baggage", armIn: numberOrZero(type.baggageArmIn), defaultWeightLb: 0 },
    ],
    fuelTanks: [
      {
        id: "main",
        name: "Usable Fuel",
        armIn: numberOrZero(type.fuelArmIn),
        capacityGal: usableFuel,
        defaultFuelGal: usableFuel,
        fuelDensityLbPerGal: 6,
      },
    ],
    envelope: rectangularEnvelope(cgMin, cgMax, maxGross),
    notes: "Imported from the RSF aircraft library. Replace generic envelope and empty weight with current POH/AFM values before use.",
    updatedAt: new Date().toISOString(),
  };
}

function NumberInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Input
      className={className}
      inputMode="decimal"
      value={Number.isFinite(value) ? String(value) : ""}
      placeholder={placeholder}
      onChange={(event) => onChange(numberOrZero(event.target.value))}
    />
  );
}

export default function WeightBalance() {
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<"calculate" | "profile">("calculate");
  const [profiles, setProfiles] = useState<WeightBalanceProfile[]>(() => loadWeightBalanceProfiles());
  const [activeProfileId, setActiveProfileId] = useState(() => profiles[0]?.id ?? "");
  const [scenarios, setScenarios] = useState<WeightBalanceScenario[]>(() =>
    profiles[0] ? loadWeightBalanceScenarios(profiles[0]) : []
  );
  const [activeScenarioId, setActiveScenarioId] = useState(() => scenarios[0]?.id ?? "");
  const [importPayload, setImportPayload] = useState("");

  const { data: aircraftTypes = [] } = useQuery<AircraftType[]>({
    queryKey: ["/api/aircraft/types"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/aircraft/types"), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load aircraft library");
      return response.json();
    },
  });

  const { data: aircraftProfiles = [] } = useQuery<AircraftProfile[]>({
    queryKey: ["/api/aircraft/profiles"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/aircraft/profiles"), { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0],
    [profiles, activeProfileId]
  );
  const activeScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === activeScenarioId) ?? scenarios[0],
    [scenarios, activeScenarioId]
  );

  useEffect(() => {
    saveWeightBalanceProfiles(profiles);
  }, [profiles]);

  useEffect(() => {
    saveWeightBalanceScenarios(scenarios);
  }, [scenarios]);

  useEffect(() => {
    if (!activeProfile) return;
    const nextScenarios = loadWeightBalanceScenarios(activeProfile);
    setScenarios(nextScenarios);
    setActiveScenarioId(nextScenarios[0]?.id ?? "");
  }, [activeProfile?.id]);

  const result = useMemo(
    () => (activeProfile && activeScenario ? calculateWeightBalance(activeProfile, activeScenario) : null),
    [activeProfile, activeScenario]
  );

  const envelopeData = useMemo(() => {
    if (!activeProfile?.envelope.length) return [];
    return [...activeProfile.envelope, activeProfile.envelope[0]].map((point) => ({
      cgIn: point.cgIn,
      weightLb: point.weightLb,
    }));
  }, [activeProfile]);

  const phaseData = useMemo(
    () => result?.phases.map((phase) => ({ cgIn: phase.cgIn, weightLb: phase.weightLb, name: phase.name })) ?? [],
    [result]
  );

  const chartDomain = useMemo(() => {
    const cgValues = [...envelopeData.map((point) => point.cgIn), ...phaseData.map((point) => point.cgIn)].filter((value) => value > 0);
    const weightValues = [...envelopeData.map((point) => point.weightLb), ...phaseData.map((point) => point.weightLb)].filter((value) => value > 0);
    return {
      cgMin: Math.max(0, Math.min(...cgValues, 30) - 2),
      cgMax: Math.max(...cgValues, 50) + 2,
      weightMax: Math.max(...weightValues, activeProfile?.maxTakeoffWeightLb ?? 2500, 1000) * 1.08,
    };
  }, [activeProfile?.maxTakeoffWeightLb, envelopeData, phaseData]);

  const updateProfile = (updater: (profile: WeightBalanceProfile) => WeightBalanceProfile) => {
    if (!activeProfile) return;
    setProfiles((current) =>
      current.map((profile) =>
        profile.id === activeProfile.id ? { ...updater(profile), updatedAt: new Date().toISOString() } : profile
      )
    );
  };

  const updateScenario = (updater: (scenario: WeightBalanceScenario) => WeightBalanceScenario) => {
    if (!activeScenario) return;
    setScenarios((current) =>
      current.map((scenario) =>
        scenario.id === activeScenario.id ? { ...updater(scenario), updatedAt: new Date().toISOString() } : scenario
      )
    );
  };

  const addProfile = (profile: WeightBalanceProfile) => {
    setProfiles((current) => [...current, profile]);
    setActiveProfileId(profile.id);
    const scenario = createScenarioForProfile(profile);
    setScenarios([scenario]);
    setActiveScenarioId(scenario.id);
  };

  const addStation = () => {
    updateProfile((profile) => ({
      ...profile,
      stations: [
        ...profile.stations,
        { id: makeId("station"), name: "New Station", type: "cargo", armIn: 0, defaultWeightLb: 0 },
      ],
    }));
  };

  const addFuelTank = () => {
    updateProfile((profile) => ({
      ...profile,
      fuelTanks: [
        ...profile.fuelTanks,
        { id: makeId("tank"), name: "Aux Tank", armIn: 0, capacityGal: 0, defaultFuelGal: 0, fuelDensityLbPerGal: 6 },
      ],
    }));
  };

  const addEnvelopePoint = () => {
    updateProfile((profile) => ({
      ...profile,
      envelope: [...profile.envelope, { cgIn: 0, weightLb: profile.maxTakeoffWeightLb }],
    }));
  };

  const saveScenarioCopy = () => {
    if (!activeProfile || !activeScenario) return;
    const nextScenario: WeightBalanceScenario = {
      ...activeScenario,
      id: makeId("wb_scenario"),
      name: `${activeScenario.name} Copy`,
      updatedAt: new Date().toISOString(),
    };
    setScenarios((current) => [...current, nextScenario]);
    setActiveScenarioId(nextScenario.id);
  };

  const importData = () => {
    try {
      const parsed = parseWeightBalanceImport(importPayload);
      if (parsed.profiles.length > 0) {
        setProfiles(parsed.profiles);
        setActiveProfileId(parsed.profiles[0].id);
      }
      if (parsed.scenarios.length > 0) {
        setScenarios(parsed.scenarios);
        setActiveScenarioId(parsed.scenarios[0].id);
      }
      setImportPayload("");
    } catch {
      setImportPayload("Import failed: paste a valid RSF W&B JSON export.");
    }
  };

  if (!activeProfile || !activeScenario || !result) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <Alert>
          <AlertDescription>Weight & Balance profiles are unavailable. Refresh the page to rebuild defaults.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="w-fit gap-2">
            <Scale className="h-3.5 w-3.5" />
            GA Weight & Balance
          </Badge>
          <div>
            <h1 className="text-3xl font-bold">Weight & Balance</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Build a reusable aircraft W&B profile, load a scenario, and verify ramp, takeoff, zero-fuel, and landing CG against the approved envelope.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={mode === "calculate" ? "default" : "outline"} onClick={() => setMode("calculate")}>
            Calculate Load
          </Button>
          <Button variant={mode === "profile" ? "default" : "outline"} onClick={() => setMode("profile")}>
            Edit Aircraft Profile
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <FileText className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <Card className="rsf-card-shell">
        <CardHeader>
          <CardTitle>Aircraft & Scenario</CardTitle>
          <CardDescription>
            W&B profiles and scenarios are stored locally in this browser. Aircraft library imports are starting points only.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-2">
            <Label>W&B Profile</Label>
            <Select value={activeProfile.id} onValueChange={setActiveProfileId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              <Badge variant={activeProfile.verificationStatus === "verified" ? "default" : "outline"}>
                {activeProfile.verificationStatus === "verified" ? "POH reviewed" : "Needs POH review"}
              </Badge>
              <Badge variant="outline">
                {activeProfile.make || activeProfile.model
                  ? `${activeProfile.make ?? ""} ${activeProfile.model ?? ""}`.trim()
                  : activeProfile.source}
              </Badge>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Loading Scenario</Label>
            <Select value={activeScenario.id} onValueChange={setActiveScenarioId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scenarios.map((scenario) => (
                  <SelectItem key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={activeScenario.name} onChange={(event) => updateScenario((scenario) => ({ ...scenario, name: event.target.value }))} />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button variant="outline" onClick={() => addProfile({ ...activeProfile, id: makeId("wb_profile"), name: `${activeProfile.name} Copy`, source: "saved-wb-profile" })}>
              <Plus className="mr-2 h-4 w-4" />
              Copy Profile
            </Button>
            <Button variant="outline" onClick={saveScenarioCopy}>
              <Save className="mr-2 h-4 w-4" />
              Save Scenario
            </Button>
          </div>
        </CardContent>
      </Card>

      {mode === "calculate" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Load Sheet</CardTitle>
                <CardDescription>Enter actual occupants, baggage, equipment, fuel, taxi fuel, and planned trip fuel.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2">
                  {activeProfile.stations.map((station) => (
                    <div key={station.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Label>{station.name}</Label>
                          <p className="text-xs text-muted-foreground">
                            Arm {formatNumber(station.armIn, 2)} in
                            {station.maxWeightLb ? ` / ${station.maxWeightLb.toFixed(0)} lb max` : ""}
                          </p>
                        </div>
                        <Badge variant="outline">{station.type}</Badge>
                      </div>
                      <NumberInput
                        className="mt-3"
                        value={numberOrZero(activeScenario.stationWeights[station.id] ?? station.defaultWeightLb)}
                        onChange={(value) =>
                          updateScenario((scenario) => ({
                            ...scenario,
                            stationWeights: { ...scenario.stationWeights, [station.id]: value },
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="grid gap-3 md:grid-cols-2">
                  {activeProfile.fuelTanks.map((tank) => (
                    <div key={tank.id} className="rounded-lg border p-4">
                      <Label>{tank.name}</Label>
                      <p className="text-xs text-muted-foreground">
                        Arm {formatNumber(tank.armIn, 2)} in / {formatNumber(tank.capacityGal, 1)} gal usable /{" "}
                        {formatNumber(tank.fuelDensityLbPerGal, 2)} lb per gal
                      </p>
                      <NumberInput
                        className="mt-3"
                        value={numberOrZero(activeScenario.fuelGallons[tank.id] ?? tank.defaultFuelGal)}
                        onChange={(value) =>
                          updateScenario((scenario) => ({
                            ...scenario,
                            fuelGallons: { ...scenario.fuelGallons, [tank.id]: value },
                          }))
                        }
                      />
                    </div>
                  ))}
                  <div className="rounded-lg border p-4">
                    <Label>Taxi Fuel Burn (gal)</Label>
                    <p className="text-xs text-muted-foreground">Removed before takeoff calculations.</p>
                    <NumberInput
                      className="mt-3"
                      value={numberOrZero(activeScenario.taxiFuelGal ?? activeProfile.taxiFuelGal)}
                      onChange={(value) => updateScenario((scenario) => ({ ...scenario, taxiFuelGal: value }))}
                    />
                  </div>
                  <div className="rounded-lg border p-4">
                    <Label>Trip Fuel Burn (gal)</Label>
                    <p className="text-xs text-muted-foreground">Removed after takeoff for landing calculations.</p>
                    <NumberInput
                      className="mt-3"
                      value={activeScenario.tripFuelGal}
                      onChange={(value) => updateScenario((scenario) => ({ ...scenario, tripFuelGal: value }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Moment Worksheet</CardTitle>
                <CardDescription>Ramp loading line items before taxi fuel is removed.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-4 text-left text-xs uppercase tracking-wide text-muted-foreground">Item</th>
                      <th className="py-2 pr-4 text-right text-xs uppercase tracking-wide text-muted-foreground">Weight</th>
                      <th className="py-2 pr-4 text-right text-xs uppercase tracking-wide text-muted-foreground">Arm</th>
                      <th className="py-2 text-right text-xs uppercase tracking-wide text-muted-foreground">Moment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.lineItems.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">
                          <div className="font-medium">{item.name}</div>
                          {item.warning ? <div className="text-xs text-red-300">{item.warning}</div> : null}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">{formatNumber(item.weightLb)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{formatNumber(item.armIn, 2)}</td>
                        <td className="py-2 text-right tabular-nums">{formatNumber(item.moment)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Phase Results</CardTitle>
                <CardDescription>Each phase is checked independently against the available envelope and weight limits.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.phases.map((phase) => (
                  <div key={phase.name} className={`rounded-lg border p-4 ${statusClasses(phase.status)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{phase.name}</div>
                        <div className="text-xs opacity-80">
                          Limits {phase.cgForwardLimit ? phase.cgForwardLimit.toFixed(2) : "--"} to{" "}
                          {phase.cgAftLimit ? phase.cgAftLimit.toFixed(2) : "--"} in
                        </div>
                      </div>
                      <StatusBadge phase={phase} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <div className="text-xs uppercase tracking-wide opacity-70">Weight</div>
                        <div className="font-semibold tabular-nums">{formatNumber(phase.weightLb)} lb</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide opacity-70">CG</div>
                        <div className="font-semibold tabular-nums">{formatNumber(phase.cgIn, 2)} in</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide opacity-70">Moment</div>
                        <div className="font-semibold tabular-nums">{formatNumber(phase.moment, 0)}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {result.warnings.length > 0 ? (
                  <Alert variant="destructive">
                    <AlertDescription className="space-y-1">
                      {Array.from(new Set(result.warnings)).slice(0, 6).map((warning) => (
                        <div key={warning}>{warning}</div>
                      ))}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <AlertDescription>All calculated phases are within entered limits. Verify against POH/AFM before flight.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>CG Envelope</CardTitle>
                <CardDescription>Envelope polygon with ramp, takeoff, zero-fuel, and landing points.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={360}>
                  <ComposedChart margin={{ top: 20, right: 20, left: 8, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      dataKey="cgIn"
                      domain={[chartDomain.cgMin, chartDomain.cgMax]}
                      tickFormatter={(value) => Number(value).toFixed(1)}
                      label={{ value: "CG (in)", position: "insideBottom", offset: -10, fontSize: 12 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="weightLb"
                      domain={[0, chartDomain.weightMax]}
                      label={{ value: "Weight (lb)", angle: -90, position: "insideLeft", fontSize: 12 }}
                    />
                    <Tooltip formatter={(value: number) => Number(value).toFixed(1)} />
                    <Line
                      data={envelopeData}
                      dataKey="weightLb"
                      type="linear"
                      stroke="#22c55e"
                      strokeWidth={3}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      data={phaseData}
                      dataKey="weightLb"
                      type="linear"
                      stroke="#60a5fa"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    {result.phases.map((phase) => (
                      <ReferenceDot
                        key={phase.name}
                        x={phase.cgIn}
                        y={phase.weightLb}
                        r={7}
                        fill={phase.status === "within" ? "#16a34a" : phase.status === "unknown" ? "#64748b" : "#dc2626"}
                        stroke="#fff"
                        strokeWidth={2}
                        label={{ value: phase.name.replace(" / Run-up", ""), position: "top", fontSize: 10, fontWeight: 700 }}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Aircraft Profile</CardTitle>
                <CardDescription>Store reusable station arms, fuel tanks, weight limits, and the approved envelope.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Profile Name</Label>
                  <Input value={activeProfile.name} onChange={(event) => updateProfile((profile) => ({ ...profile, name: event.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Tail Number</Label>
                  <Input value={activeProfile.tailNumber ?? ""} onChange={(event) => updateProfile((profile) => ({ ...profile, tailNumber: event.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Max Ramp Weight</Label>
                  <NumberInput value={numberOrZero(activeProfile.maxRampWeightLb)} onChange={(value) => updateProfile((profile) => ({ ...profile, maxRampWeightLb: value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Max Takeoff Weight</Label>
                  <NumberInput value={activeProfile.maxTakeoffWeightLb} onChange={(value) => updateProfile((profile) => ({ ...profile, maxTakeoffWeightLb: value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Max Landing Weight</Label>
                  <NumberInput value={numberOrZero(activeProfile.maxLandingWeightLb)} onChange={(value) => updateProfile((profile) => ({ ...profile, maxLandingWeightLb: value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Default Taxi Fuel</Label>
                  <NumberInput value={activeProfile.taxiFuelGal} onChange={(value) => updateProfile((profile) => ({ ...profile, taxiFuelGal: value }))} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Verification</Label>
                  <Select
                    value={activeProfile.verificationStatus}
                    onValueChange={(value) =>
                      updateProfile((profile) => ({
                        ...profile,
                        verificationStatus: value as WeightBalanceProfile["verificationStatus"],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="needs-poh-review">Needs POH/AFM Review</SelectItem>
                      <SelectItem value="verified">POH/AFM Reviewed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>Stations</CardTitle>
                    <CardDescription>Define arms and station limits from the aircraft W&B record.</CardDescription>
                  </div>
                  <Button variant="outline" onClick={addStation}>
                    <Plus className="mr-2 h-4 w-4" />
                    Station
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeProfile.stations.map((station, index) => (
                  <div key={station.id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1.3fr_120px_120px_120px_auto]">
                    <Input
                      value={station.name}
                      onChange={(event) =>
                        updateProfile((profile) => ({
                          ...profile,
                          stations: replaceAt(profile.stations, index, { ...station, name: event.target.value }),
                        }))
                      }
                    />
                    <NumberInput
                      value={station.armIn}
                      placeholder="Arm"
                      onChange={(value) =>
                        updateProfile((profile) => ({
                          ...profile,
                          stations: replaceAt(profile.stations, index, { ...station, armIn: value }),
                        }))
                      }
                    />
                    <NumberInput
                      value={station.defaultWeightLb}
                      placeholder="Default"
                      onChange={(value) =>
                        updateProfile((profile) => ({
                          ...profile,
                          stations: replaceAt(profile.stations, index, { ...station, defaultWeightLb: value }),
                        }))
                      }
                    />
                    <NumberInput
                      value={numberOrZero(station.maxWeightLb)}
                      placeholder="Limit"
                      onChange={(value) =>
                        updateProfile((profile) => ({
                          ...profile,
                          stations: replaceAt(profile.stations, index, { ...station, maxWeightLb: value || undefined }),
                        }))
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        updateProfile((profile) => ({
                          ...profile,
                          stations: profile.stations.filter((candidate) => candidate.id !== station.id),
                        }))
                      }
                      disabled={station.required}
                      aria-label={`Remove ${station.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>Fuel Tanks</CardTitle>
                    <CardDescription>Support one or multiple tanks with separate arms and fuel density.</CardDescription>
                  </div>
                  <Button variant="outline" onClick={addFuelTank}>
                    <Plus className="mr-2 h-4 w-4" />
                    Tank
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeProfile.fuelTanks.map((tank, index) => (
                  <div key={tank.id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1.2fr_100px_110px_110px_110px_auto]">
                    <Input
                      value={tank.name}
                      onChange={(event) =>
                        updateProfile((profile) => ({
                          ...profile,
                          fuelTanks: replaceAt(profile.fuelTanks, index, { ...tank, name: event.target.value }),
                        }))
                      }
                    />
                    {(["armIn", "capacityGal", "defaultFuelGal", "fuelDensityLbPerGal"] as const).map((field) => (
                      <NumberInput
                        key={field}
                        value={numberOrZero(tank[field])}
                        placeholder={field}
                        onChange={(value) =>
                          updateProfile((profile) => ({
                            ...profile,
                            fuelTanks: replaceAt(profile.fuelTanks, index, { ...tank, [field]: value } as WeightBalanceFuelTank),
                          }))
                        }
                      />
                    ))}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        updateProfile((profile) => ({
                          ...profile,
                          fuelTanks: profile.fuelTanks.filter((candidate) => candidate.id !== tank.id),
                        }))
                      }
                      disabled={activeProfile.fuelTanks.length <= 1}
                      aria-label={`Remove ${tank.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>CG Envelope Points</CardTitle>
                    <CardDescription>Enter the approved envelope polygon in order around the boundary.</CardDescription>
                  </div>
                  <Button variant="outline" onClick={addEnvelopePoint}>
                    <Plus className="mr-2 h-4 w-4" />
                    Point
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeProfile.envelope.map((point, index) => (
                  <div key={`${index}-${point.cgIn}-${point.weightLb}`} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_1fr_auto]">
                    <div className="space-y-1">
                      <Label>CG In</Label>
                      <NumberInput
                        value={point.cgIn}
                        onChange={(value) =>
                          updateProfile((profile) => ({
                            ...profile,
                            envelope: replaceAt(profile.envelope, index, { ...point, cgIn: value } as WeightBalanceEnvelopePoint),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Weight Lb</Label>
                      <NumberInput
                        value={point.weightLb}
                        onChange={(value) =>
                          updateProfile((profile) => ({
                            ...profile,
                            envelope: replaceAt(profile.envelope, index, { ...point, weightLb: value } as WeightBalanceEnvelopePoint),
                          }))
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="self-end"
                      onClick={() =>
                        updateProfile((profile) => ({
                          ...profile,
                          envelope: profile.envelope.filter((_, pointIndex) => pointIndex !== index),
                        }))
                      }
                      disabled={activeProfile.envelope.length <= 3}
                      aria-label="Remove envelope point"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Import From Aircraft Library</CardTitle>
                <CardDescription>Create a W&B profile from saved aircraft or aircraft type defaults.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {aircraftProfiles.map((profile) => {
                  const type = profile.type ?? aircraftTypes.find((candidate) => candidate.id === profile.typeId);
                  if (!type) return null;
                  return (
                    <Button key={profile.id} variant="outline" className="w-full justify-start" onClick={() => addProfile(profileFromAircraft(type, profile))}>
                      <Plane className="mr-2 h-4 w-4" />
                      {profile.tailNumber ? `${profile.tailNumber} - ` : ""}
                      {profile.name}
                    </Button>
                  );
                })}
                {aircraftTypes.slice(0, 12).map((type) => (
                  <Button key={type.id} variant="outline" className="w-full justify-start" onClick={() => addProfile(profileFromAircraft(type))}>
                    <Plane className="mr-2 h-4 w-4" />
                    {type.make} {type.model}
                    {type.icaoType ? ` (${type.icaoType})` : ""}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Export / Import</CardTitle>
                <CardDescription>Move W&B profiles and scenarios between browsers without touching aircraft profile records.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setImportPayload(exportWeightBalanceData(profiles, scenarios))}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Show Export JSON
                </Button>
                <textarea
                  className="min-h-36 w-full rounded-md border bg-background p-3 text-xs font-mono"
                  value={importPayload}
                  onChange={(event) => setImportPayload(event.target.value)}
                  placeholder="Paste RSF W&B export JSON here."
                />
                <Button variant="outline" className="w-full" onClick={importData}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import JSON
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Alert>
        <AlertDescription className="text-xs">
          Weight & Balance results are planning support only. Always verify empty weight, station arms, fuel data, weight limits, and the CG envelope against the current aircraft records and approved POH/AFM before flight.
        </AlertDescription>
      </Alert>
    </div>
  );
}
