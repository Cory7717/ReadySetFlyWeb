import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Calculator, Plane } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

type AircraftType = {
  id: string;
  make: string;
  model: string;
  icaoType?: string | null;
  category: string;
  engineType: string;
  cruise_ktas_effective: number;
  fuel_burn_gph_effective: number;
  usable_fuel_gal_effective: number;
  max_gross_weight_lb_effective: number;
};

type AircraftProfile = {
  id: string;
  name: string;
  tailNumber?: string | null;
  typeId?: string | null;
  cruise_ktas_effective?: number | null;
  fuel_burn_gph_effective?: number | null;
  usable_fuel_gal_effective?: number | null;
  max_gross_weight_lb_effective?: number | null;
};

interface Inputs {
  annualHours: number;
  hangar: number;
  insurance: number;
  annualInspection: number;
  registrationAndTaxes: number;
  chartSubscriptions: number;
  avionicsSubscriptions: number;
  loanPaymentAnnual: number;
  cleaningAndManagement: number;
  otherFixed: number;
  fuelBurnGph: number;
  fuelPricePerGallon: number;
  oilPerHour: number;
  maintenanceReservePerHour: number;
  engineReservePerHour: number;
  propReservePerHour: number;
  avionicsReservePerHour: number;
  tireBrakeReservePerHour: number;
  otherVariablePerHour: number;
}

const DEFAULTS: Inputs = {
  annualHours: 100,
  hangar: 3600,
  insurance: 2000,
  annualInspection: 1800,
  registrationAndTaxes: 450,
  chartSubscriptions: 250,
  avionicsSubscriptions: 300,
  loanPaymentAnnual: 0,
  cleaningAndManagement: 0,
  otherFixed: 0,
  fuelBurnGph: 8,
  fuelPricePerGallon: 10,
  oilPerHour: 3,
  maintenanceReservePerHour: 20,
  engineReservePerHour: 25,
  propReservePerHour: 6,
  avionicsReservePerHour: 5,
  tireBrakeReservePerHour: 4,
  otherVariablePerHour: 0,
};

const DEFAULT_PROFILE_ID = "none";
const DEFAULT_TYPE_ID = "none";

const AIRCRAFT_CATEGORY_PRESETS: Record<string, Partial<Inputs>> = {
  trainer: {
    annualInspection: 1800,
    insurance: 2200,
    maintenanceReservePerHour: 18,
    engineReservePerHour: 22,
    propReservePerHour: 5,
    avionicsReservePerHour: 4,
    tireBrakeReservePerHour: 4,
  },
  single_engine: {
    annualInspection: 2400,
    insurance: 3200,
    maintenanceReservePerHour: 24,
    engineReservePerHour: 30,
    propReservePerHour: 7,
    avionicsReservePerHour: 6,
    tireBrakeReservePerHour: 5,
  },
  multi_engine: {
    annualInspection: 5200,
    insurance: 7600,
    maintenanceReservePerHour: 48,
    engineReservePerHour: 58,
    propReservePerHour: 16,
    avionicsReservePerHour: 10,
    tireBrakeReservePerHour: 8,
  },
  turboprop: {
    annualInspection: 12000,
    insurance: 18000,
    maintenanceReservePerHour: 135,
    engineReservePerHour: 185,
    propReservePerHour: 28,
    avionicsReservePerHour: 20,
    tireBrakeReservePerHour: 12,
  },
  jet: {
    annualInspection: 24000,
    insurance: 42000,
    maintenanceReservePerHour: 260,
    engineReservePerHour: 420,
    propReservePerHour: 0,
    avionicsReservePerHour: 35,
    tireBrakeReservePerHour: 20,
  },
  helicopter: {
    annualInspection: 8500,
    insurance: 14000,
    maintenanceReservePerHour: 95,
    engineReservePerHour: 160,
    propReservePerHour: 0,
    avionicsReservePerHour: 14,
    tireBrakeReservePerHour: 6,
  },
};

function toNumber(v: string): number {
  const n = Number(v.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function formatCategory(value?: string | null) {
  if (!value) return "Aircraft";
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function deriveFuelBurn(base: number, type?: AircraftType | null, profile?: AircraftProfile | null) {
  const burn =
    profile?.fuel_burn_gph_effective ??
    type?.fuel_burn_gph_effective ??
    0;
  if (!burn || burn <= 0) return base;
  return roundCurrency(burn);
}

function deriveFuelPrice(base: number, type?: AircraftType | null, profile?: AircraftProfile | null) {
  const burn =
    profile?.fuel_burn_gph_effective ??
    type?.fuel_burn_gph_effective ??
    0;
  if (!burn || burn <= 0) return base;
  const suggestedFuelPrice = burn <= 10 ? 8.5 : burn <= 18 ? 9.5 : burn <= 40 ? 12 : 14;
  return roundCurrency(suggestedFuelPrice);
}

export default function OwnershipCostCalculator() {
  const { isAuthenticated } = useAuth();
  const [selectedTypeId, setSelectedTypeId] = useState<string>(DEFAULT_TYPE_ID);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(DEFAULT_PROFILE_ID);
  const [inputs, setInputs] = useState<Inputs>(() => {
    try {
      const saved = localStorage.getItem("ownership-cost-inputs");
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  const { data: aircraftTypes = [] } = useQuery<AircraftType[]>({
    queryKey: ["/api/aircraft/types?limit=500"],
  });

  const { data: savedProfiles = [] } = useQuery<AircraftProfile[]>({
    queryKey: ["/api/aircraft/profiles"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/aircraft/profiles"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load aircraft profiles");
      return res.json();
    },
  });

  const selectedProfile = selectedProfileId === DEFAULT_PROFILE_ID
    ? null
    : savedProfiles.find((p) => p.id === selectedProfileId) || null;

  const selectedType = selectedProfile?.typeId
    ? aircraftTypes.find((t) => t.id === selectedProfile.typeId) || null
    : selectedTypeId === DEFAULT_TYPE_ID
      ? null
      : aircraftTypes.find((t) => t.id === selectedTypeId) || null;

  useEffect(() => {
    try {
      localStorage.setItem("ownership-cost-inputs", JSON.stringify(inputs));
      localStorage.setItem("ownership-cost-type", selectedTypeId);
      localStorage.setItem("ownership-cost-profile", selectedProfileId);
    } catch {}
  }, [inputs, selectedTypeId, selectedProfileId]);

  useEffect(() => {
    try {
      const savedType = localStorage.getItem("ownership-cost-type");
      const savedProfile = localStorage.getItem("ownership-cost-profile");
      if (savedType) setSelectedTypeId(savedType);
      if (savedProfile) setSelectedProfileId(savedProfile);
    } catch {}
  }, []);

  useEffect(() => {
    if (!selectedType && !selectedProfile) return;

    const presetKey = (selectedType?.category || "").toLowerCase();
    const preset = AIRCRAFT_CATEGORY_PRESETS[presetKey] || {};

    setInputs((prev) => ({
      ...prev,
      ...preset,
      fuelBurnGph: deriveFuelBurn(prev.fuelBurnGph, selectedType, selectedProfile),
      fuelPricePerGallon: deriveFuelPrice(prev.fuelPricePerGallon, selectedType, selectedProfile),
    }));
  }, [selectedType, selectedProfile]);

  const fixedAnnual = useMemo(() => {
    const {
      hangar,
      insurance,
      annualInspection,
      registrationAndTaxes,
      chartSubscriptions,
      avionicsSubscriptions,
      loanPaymentAnnual,
      cleaningAndManagement,
      otherFixed,
    } = inputs;
    return (
      hangar +
      insurance +
      annualInspection +
      registrationAndTaxes +
      chartSubscriptions +
      avionicsSubscriptions +
      loanPaymentAnnual +
      cleaningAndManagement +
      otherFixed
    );
  }, [inputs]);

  const variablePerHour = useMemo(() => {
    const {
      fuelBurnGph,
      fuelPricePerGallon,
      oilPerHour,
      maintenanceReservePerHour,
      engineReservePerHour,
      propReservePerHour,
      avionicsReservePerHour,
      tireBrakeReservePerHour,
      otherVariablePerHour,
    } = inputs;
    return (
      fuelBurnGph * fuelPricePerGallon +
      oilPerHour +
      maintenanceReservePerHour +
      engineReservePerHour +
      propReservePerHour +
      avionicsReservePerHour +
      tireBrakeReservePerHour +
      otherVariablePerHour
    );
  }, [inputs]);

  const fixedPerHour = useMemo(() => {
    if (inputs.annualHours <= 0) return 0;
    return fixedAnnual / inputs.annualHours;
  }, [fixedAnnual, inputs.annualHours]);

  const dryOwnershipCostPerHour = useMemo(() => {
    const {
      oilPerHour,
      maintenanceReservePerHour,
      engineReservePerHour,
      propReservePerHour,
      avionicsReservePerHour,
      tireBrakeReservePerHour,
      otherVariablePerHour,
    } = inputs;
    return (
      fixedPerHour +
      oilPerHour +
      maintenanceReservePerHour +
      engineReservePerHour +
      propReservePerHour +
      avionicsReservePerHour +
      tireBrakeReservePerHour +
      otherVariablePerHour
    );
  }, [fixedPerHour, inputs]);

  const ownershipCostPerHour = useMemo(() => {
    return fixedPerHour + variablePerHour;
  }, [fixedPerHour, variablePerHour]);

  const annualOperatingTotal = useMemo(() => fixedAnnual + variablePerHour * inputs.annualHours, [fixedAnnual, variablePerHour, inputs.annualHours]);
  const monthlyEquivalent = useMemo(() => annualOperatingTotal / 12, [annualOperatingTotal]);
  const breakEvenHoursPerMonth = useMemo(() => {
    const grossMarginPerHour = Math.max(ownershipCostPerHour * 1.15 - variablePerHour, 0);
    if (grossMarginPerHour <= 0) return 0;
    return fixedAnnual / 12 / grossMarginPerHour;
  }, [fixedAnnual, ownershipCostPerHour, variablePerHour]);

  const recommendedDryRentalPerHour = useMemo(() => roundCurrency(dryOwnershipCostPerHour * 1.15), [dryOwnershipCostPerHour]);
  const recommendedWetRentalPerHour = useMemo(() => roundCurrency(ownershipCostPerHour * 1.15), [ownershipCostPerHour]);
  const fuelPerHour = useMemo(() => roundCurrency(inputs.fuelBurnGph * inputs.fuelPricePerGallon), [inputs.fuelBurnGph, inputs.fuelPricePerGallon]);

  const update = (key: keyof Inputs) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputs((prev) => ({ ...prev, [key]: toNumber(e.target.value) }));
  };

  const selectedAircraftLabel = selectedProfile?.name || (selectedType ? `${selectedType.make} ${selectedType.model}`.trim() : "Manual assumptions");

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="flex items-center justify-center gap-2 text-3xl font-bold">
            <Calculator className="h-8 w-8" />
            Ownership Cost per Hour
          </h1>
          <p className="text-muted-foreground">
            Estimate fixed, hourly, reserve, and rental-rate assumptions for a more complete ownership view.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plane className="h-4 w-4" />
              Aircraft setup
            </CardTitle>
            <CardDescription>
              Select an RSF aircraft type or saved profile to prefill baseline ownership assumptions. Library values guide the model, but all costs remain editable.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>RSF Aircraft Library</Label>
              <Select
                value={selectedTypeId}
                onValueChange={(value) => {
                  setSelectedProfileId(DEFAULT_PROFILE_ID);
                  setSelectedTypeId(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select aircraft type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_TYPE_ID}>Manual assumptions</SelectItem>
                  {aircraftTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.make} {type.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Saved Profile</Label>
              <Select
                value={selectedProfileId}
                onValueChange={(value) => {
                  setSelectedProfileId(value);
                  if (value === DEFAULT_PROFILE_ID) return;
                  const profile = savedProfiles.find((item) => item.id === value);
                  if (profile?.typeId) setSelectedTypeId(profile.typeId);
                }}
                disabled={!isAuthenticated}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isAuthenticated ? "Select profile" : "Sign in to use profiles"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_PROFILE_ID}>No saved profile</SelectItem>
                  {savedProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">Current baseline</div>
              <div className="mt-1 font-semibold">{selectedAircraftLabel}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {selectedType?.category && <Badge variant="outline">{formatCategory(selectedType.category)}</Badge>}
                {selectedType?.engineType && <Badge variant="outline">{formatCategory(selectedType.engineType)}</Badge>}
                {selectedType?.fuel_burn_gph_effective && (
                  <Badge variant="secondary">{selectedType.fuel_burn_gph_effective} GPH baseline</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ownership Cost/hr</CardTitle>
              <CardDescription>Fixed plus all variable costs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-2xl font-semibold">{ownershipCostPerHour.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recommended Dry Rate/hr</CardTitle>
              <CardDescription>Excludes fuel, +15% margin</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <Badge variant="secondary" className="text-xs">Dry</Badge>
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-2xl font-semibold">{recommendedDryRentalPerHour.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recommended Wet Rate/hr</CardTitle>
              <CardDescription>Includes fuel, +15% margin</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <Badge variant="secondary" className="text-xs">Wet</Badge>
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-2xl font-semibold">{recommendedWetRentalPerHour.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Annual Total</CardTitle>
              <CardDescription>Fixed plus expected hourly use</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-2xl font-semibold">{annualOperatingTotal.toFixed(0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Equivalent</CardTitle>
              <CardDescription>Average monthly carrying cost</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-2xl font-semibold">{monthlyEquivalent.toFixed(0)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fixed Cost/hr</CardTitle>
              <CardDescription>Annual fixed costs spread over expected hours</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-2xl font-semibold">{fixedPerHour.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fuel Cost/hr</CardTitle>
              <CardDescription>Derived from burn and local fuel price</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-2xl font-semibold">{fuelPerHour.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Break-even Hours / Month</CardTitle>
              <CardDescription>At the suggested wet rate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{breakEvenHoursPerMonth.toFixed(1)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
            <CardDescription>Adjust assumptions to match your aircraft, market, and ownership model.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <section className="space-y-3">
              <Label htmlFor="annualHours">Expected Annual Utilization (hours)</Label>
              <Input id="annualHours" type="number" min={0} step="1" value={inputs.annualHours} onChange={update("annualHours")} />
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-lg font-semibold">Fixed Annual Costs</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="hangar">Hangar / Tie-Down (annual)</Label>
                  <Input id="hangar" type="number" min={0} step="1" value={inputs.hangar} onChange={update("hangar")} />
                </div>
                <div>
                  <Label htmlFor="insurance">Insurance (annual)</Label>
                  <Input id="insurance" type="number" min={0} step="1" value={inputs.insurance} onChange={update("insurance")} />
                </div>
                <div>
                  <Label htmlFor="annualInspection">Annual / 100-Hr Inspection (annual)</Label>
                  <Input id="annualInspection" type="number" min={0} step="1" value={inputs.annualInspection} onChange={update("annualInspection")} />
                </div>
                <div>
                  <Label htmlFor="registrationAndTaxes">Registration / Property Tax (annual)</Label>
                  <Input id="registrationAndTaxes" type="number" min={0} step="1" value={inputs.registrationAndTaxes} onChange={update("registrationAndTaxes")} />
                </div>
                <div>
                  <Label htmlFor="chartSubscriptions">Charts / Database (annual)</Label>
                  <Input id="chartSubscriptions" type="number" min={0} step="1" value={inputs.chartSubscriptions} onChange={update("chartSubscriptions")} />
                </div>
                <div>
                  <Label htmlFor="avionicsSubscriptions">Avionics / Connectivity Subscriptions (annual)</Label>
                  <Input id="avionicsSubscriptions" type="number" min={0} step="1" value={inputs.avionicsSubscriptions} onChange={update("avionicsSubscriptions")} />
                </div>
                <div>
                  <Label htmlFor="loanPaymentAnnual">Loan Payments (annual)</Label>
                  <Input id="loanPaymentAnnual" type="number" min={0} step="1" value={inputs.loanPaymentAnnual} onChange={update("loanPaymentAnnual")} />
                </div>
                <div>
                  <Label htmlFor="cleaningAndManagement">Cleaning / Management (annual)</Label>
                  <Input id="cleaningAndManagement" type="number" min={0} step="1" value={inputs.cleaningAndManagement} onChange={update("cleaningAndManagement")} />
                </div>
                <div>
                  <Label htmlFor="otherFixed">Other Fixed (annual)</Label>
                  <Input id="otherFixed" type="number" min={0} step="1" value={inputs.otherFixed} onChange={update("otherFixed")} />
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-lg font-semibold">Variable Costs (per flight hour)</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="fuelBurnGph">Fuel Burn (GPH)</Label>
                  <Input id="fuelBurnGph" type="number" min={0} step="0.1" value={inputs.fuelBurnGph} onChange={update("fuelBurnGph")} />
                </div>
                <div>
                  <Label htmlFor="fuelPricePerGallon">Fuel Price ($/gal)</Label>
                  <Input id="fuelPricePerGallon" type="number" min={0} step="0.1" value={inputs.fuelPricePerGallon} onChange={update("fuelPricePerGallon")} />
                </div>
                <div>
                  <Label htmlFor="oilPerHour">Oil ($/hr)</Label>
                  <Input id="oilPerHour" type="number" min={0} step="1" value={inputs.oilPerHour} onChange={update("oilPerHour")} />
                </div>
                <div>
                  <Label htmlFor="maintenanceReservePerHour">Maintenance Reserve ($/hr)</Label>
                  <Input id="maintenanceReservePerHour" type="number" min={0} step="1" value={inputs.maintenanceReservePerHour} onChange={update("maintenanceReservePerHour")} />
                </div>
                <div>
                  <Label htmlFor="engineReservePerHour">Engine Reserve ($/hr)</Label>
                  <Input id="engineReservePerHour" type="number" min={0} step="1" value={inputs.engineReservePerHour} onChange={update("engineReservePerHour")} />
                </div>
                <div>
                  <Label htmlFor="propReservePerHour">Prop Reserve ($/hr)</Label>
                  <Input id="propReservePerHour" type="number" min={0} step="1" value={inputs.propReservePerHour} onChange={update("propReservePerHour")} />
                </div>
                <div>
                  <Label htmlFor="avionicsReservePerHour">Avionics Reserve ($/hr)</Label>
                  <Input id="avionicsReservePerHour" type="number" min={0} step="1" value={inputs.avionicsReservePerHour} onChange={update("avionicsReservePerHour")} />
                </div>
                <div>
                  <Label htmlFor="tireBrakeReservePerHour">Tires / Brakes Reserve ($/hr)</Label>
                  <Input id="tireBrakeReservePerHour" type="number" min={0} step="1" value={inputs.tireBrakeReservePerHour} onChange={update("tireBrakeReservePerHour")} />
                </div>
                <div>
                  <Label htmlFor="otherVariablePerHour">Other Variable ($/hr)</Label>
                  <Input id="otherVariablePerHour" type="number" min={0} step="1" value={inputs.otherVariablePerHour} onChange={update("otherVariablePerHour")} />
                </div>
              </div>
            </section>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">How this works</CardTitle>
            <CardDescription>More complete ownership modeling</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Ownership cost per hour = fixed annual costs spread across expected annual hours, plus all hourly operating and reserve costs.
            </p>
            <p>
              Dry rate removes fuel from the hourly base before adding the 15% margin. Wet rate uses the full hourly cost including the derived fuel cost, then adds the same margin.
            </p>
            <p>
              Aircraft library and saved profiles prefill baseline assumptions like fuel burn and maintenance reserve ranges, but local costs such as insurance, hangar, fuel price, and financing still need to be customized.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} variant="outline">
            Back to Top
          </Button>
        </div>
      </div>
    </div>
  );
}
