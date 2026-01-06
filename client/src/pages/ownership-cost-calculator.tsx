import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Calculator } from "lucide-react";

interface Inputs {
  annualHours: number;
  // Fixed Annual Costs
  hangar: number;
  insurance: number;
  annualInspection: number;
  loanPaymentAnnual: number;
  subscriptions: number; // charts, EFB, misc
  otherFixed: number;
  // Variable Per-Hour Costs
  fuelPerHour: number;
  oilPerHour: number;
  maintenanceReservePerHour: number; // general wear items
  engineReservePerHour: number; // engine/prop reserve
  otherVariablePerHour: number;
}

const DEFAULTS: Inputs = {
  annualHours: 100,
  hangar: 3600, // $300/mo
  insurance: 2000,
  annualInspection: 1800,
  loanPaymentAnnual: 0,
  subscriptions: 300,
  otherFixed: 0,
  fuelPerHour: 80, // 8 gph @ $10/gal example
  oilPerHour: 3,
  maintenanceReservePerHour: 20,
  engineReservePerHour: 25,
  otherVariablePerHour: 0,
};

function toNumber(v: string): number {
  const n = Number(v.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export default function OwnershipCostCalculator() {
  const [inputs, setInputs] = useState<Inputs>(() => {
    try {
      const saved = localStorage.getItem("ownership-cost-inputs");
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("ownership-cost-inputs", JSON.stringify(inputs));
    } catch {}
  }, [inputs]);

  const fixedAnnual = useMemo(() => {
    const { hangar, insurance, annualInspection, loanPaymentAnnual, subscriptions, otherFixed } = inputs;
    return hangar + insurance + annualInspection + loanPaymentAnnual + subscriptions + otherFixed;
  }, [inputs]);

  const variablePerHour = useMemo(() => {
    const { fuelPerHour, oilPerHour, maintenanceReservePerHour, engineReservePerHour, otherVariablePerHour } = inputs;
    return fuelPerHour + oilPerHour + maintenanceReservePerHour + engineReservePerHour + otherVariablePerHour;
  }, [inputs]);

  const ownershipCostPerHour = useMemo(() => {
    if (inputs.annualHours <= 0) return 0;
    return fixedAnnual / inputs.annualHours + variablePerHour;
  }, [fixedAnnual, variablePerHour, inputs.annualHours]);

  const recommendedRentalPerHour = useMemo(() => {
    return Math.round(ownershipCostPerHour * 1.15 * 100) / 100; // 15% markup
  }, [ownershipCostPerHour]);

  const update = (key: keyof Inputs) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputs((prev) => ({ ...prev, [key]: toNumber(e.target.value) }));
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <Calculator className="h-8 w-8" />
            Ownership Cost per Hour
          </h1>
          <p className="text-muted-foreground">
            Estimate aircraft ownership cost per flight hour and a suggested rental price (+15%).
          </p>
        </div>

        {/* Key Results */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ownership Cost/hr</CardTitle>
              <CardDescription>Fixed/hrs + variable</CardDescription>
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
              <CardTitle className="text-base">Recommended Rental/hr</CardTitle>
              <CardDescription>+15% markup</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <Badge variant="secondary" className="text-xs">Markup</Badge>
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-2xl font-semibold">{recommendedRentalPerHour.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Annual Fixed Costs</CardTitle>
              <CardDescription>Total per year</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-2xl font-semibold">{fixedAnnual.toFixed(0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
            <CardDescription>Adjust assumptions to match your aircraft</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Utilization */}
            <section className="space-y-3">
              <Label htmlFor="annualHours">Expected Annual Utilization (hours)</Label>
              <Input id="annualHours" type="number" min={0} step="1" value={inputs.annualHours} onChange={update("annualHours")} />
            </section>

            <Separator />

            {/* Fixed Annual Costs */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">Fixed Annual Costs</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="hangar">Hangar/Tie-Down (annual)</Label>
                  <Input id="hangar" type="number" min={0} step="1" value={inputs.hangar} onChange={update("hangar")} />
                </div>
                <div>
                  <Label htmlFor="insurance">Insurance (annual)</Label>
                  <Input id="insurance" type="number" min={0} step="1" value={inputs.insurance} onChange={update("insurance")} />
                </div>
                <div>
                  <Label htmlFor="annualInspection">Annual/100-hr Inspection (annual)</Label>
                  <Input id="annualInspection" type="number" min={0} step="1" value={inputs.annualInspection} onChange={update("annualInspection")} />
                </div>
                <div>
                  <Label htmlFor="loanPaymentAnnual">Loan Payments (annual)</Label>
                  <Input id="loanPaymentAnnual" type="number" min={0} step="1" value={inputs.loanPaymentAnnual} onChange={update("loanPaymentAnnual")} />
                </div>
                <div>
                  <Label htmlFor="subscriptions">Subscriptions/Misc (annual)</Label>
                  <Input id="subscriptions" type="number" min={0} step="1" value={inputs.subscriptions} onChange={update("subscriptions")} />
                </div>
                <div>
                  <Label htmlFor="otherFixed">Other Fixed (annual)</Label>
                  <Input id="otherFixed" type="number" min={0} step="1" value={inputs.otherFixed} onChange={update("otherFixed")} />
                </div>
              </div>
            </section>

            <Separator />

            {/* Variable Per-Hour Costs */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">Variable Costs (per flight hour)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fuelPerHour">Fuel ($/hr)</Label>
                  <Input id="fuelPerHour" type="number" min={0} step="1" value={inputs.fuelPerHour} onChange={update("fuelPerHour")} />
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
                  <Label htmlFor="engineReservePerHour">Engine/Prop Reserve ($/hr)</Label>
                  <Input id="engineReservePerHour" type="number" min={0} step="1" value={inputs.engineReservePerHour} onChange={update("engineReservePerHour")} />
                </div>
                <div>
                  <Label htmlFor="otherVariablePerHour">Other Variable ($/hr)</Label>
                  <Input id="otherVariablePerHour" type="number" min={0} step="1" value={inputs.otherVariablePerHour} onChange={update("otherVariablePerHour")} />
                </div>
              </div>
            </section>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How this works</CardTitle>
            <CardDescription>Simple ownership math</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Ownership cost per hour = (annual fixed costs ÷ annual hours) + variable per-hour costs.
            </p>
            <p>
              Recommended rental price is ownership cost per hour plus a 15% margin. Adjust the inputs to fit your aircraft and local prices.
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
