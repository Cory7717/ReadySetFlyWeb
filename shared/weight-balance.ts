export type WeightBalanceStationType = "empty" | "occupant" | "baggage" | "cargo" | "equipment";

export type WeightBalanceStation = {
  id: string;
  name: string;
  type: WeightBalanceStationType;
  armIn: number;
  defaultWeightLb: number;
  maxWeightLb?: number;
  required?: boolean;
  notes?: string;
};

export type WeightBalanceFuelTank = {
  id: string;
  name: string;
  armIn: number;
  capacityGal: number;
  defaultFuelGal: number;
  fuelDensityLbPerGal: number;
  maxFuelGal?: number;
  notes?: string;
};

export type WeightBalanceEnvelopePoint = {
  cgIn: number;
  weightLb: number;
};

export type WeightBalanceProfile = {
  id: string;
  name: string;
  tailNumber?: string;
  make?: string;
  model?: string;
  icaoType?: string;
  source: "rsf-aircraft-library" | "saved-wb-profile" | "manual" | "legacy-migration";
  verificationStatus: "verified" | "needs-poh-review";
  maxRampWeightLb?: number;
  maxTakeoffWeightLb: number;
  maxLandingWeightLb?: number;
  taxiFuelGal: number;
  stations: WeightBalanceStation[];
  fuelTanks: WeightBalanceFuelTank[];
  envelope: WeightBalanceEnvelopePoint[];
  notes?: string;
  updatedAt: string;
};

export type WeightBalanceScenario = {
  id: string;
  profileId: string;
  name: string;
  stationWeights: Record<string, number>;
  fuelGallons: Record<string, number>;
  tripFuelGal: number;
  taxiFuelGal?: number;
  updatedAt: string;
};

export type WeightBalanceLineItem = {
  id: string;
  name: string;
  weightLb: number;
  armIn: number;
  moment: number;
  limitLabel?: string;
  warning?: string;
};

export type WeightBalancePhaseName = "Ramp" | "Taxi / Run-up" | "Takeoff" | "Zero Fuel" | "Landing";

export type WeightBalancePhaseResult = {
  name: WeightBalancePhaseName;
  weightLb: number;
  moment: number;
  cgIn: number;
  status: "within" | "forward" | "aft" | "overweight" | "underweight" | "unknown";
  cgForwardLimit?: number;
  cgAftLimit?: number;
  maxWeightLb?: number;
  warnings: string[];
};

export type WeightBalanceResult = {
  lineItems: WeightBalanceLineItem[];
  phases: WeightBalancePhaseResult[];
  warnings: string[];
  fuelBurnWarning?: string;
};

export function numberOrZero(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeEnvelope(points: WeightBalanceEnvelopePoint[]): WeightBalanceEnvelopePoint[] {
  return points
    .map((point) => ({ cgIn: numberOrZero(point.cgIn), weightLb: numberOrZero(point.weightLb) }))
    .filter((point) => point.cgIn > 0 && point.weightLb >= 0);
}

export function rectangularEnvelope(cgMin: number, cgMax: number, maxWeight: number): WeightBalanceEnvelopePoint[] {
  if (!(cgMin > 0 && cgMax > cgMin && maxWeight > 0)) return [];
  return [
    { cgIn: cgMin, weightLb: 0 },
    { cgIn: cgMax, weightLb: 0 },
    { cgIn: cgMax, weightLb: maxWeight },
    { cgIn: cgMin, weightLb: maxWeight },
  ];
}

export function getCgBoundsAtWeight(
  envelope: WeightBalanceEnvelopePoint[],
  weightLb: number
): { forward: number; aft: number } | null {
  const points = normalizeEnvelope(envelope);
  if (points.length < 3 || !(weightLb >= 0)) return null;
  const intersections: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const minWeight = Math.min(a.weightLb, b.weightLb);
    const maxWeight = Math.max(a.weightLb, b.weightLb);
    if (weightLb < minWeight || weightLb > maxWeight) continue;
    if (a.weightLb === b.weightLb) {
      if (weightLb === a.weightLb) {
        intersections.push(a.cgIn, b.cgIn);
      }
      continue;
    }
    const ratio = (weightLb - a.weightLb) / (b.weightLb - a.weightLb);
    intersections.push(a.cgIn + ratio * (b.cgIn - a.cgIn));
  }
  if (intersections.length < 2) return null;
  return { forward: Math.min(...intersections), aft: Math.max(...intersections) };
}

export function pointInEnvelope(envelope: WeightBalanceEnvelopePoint[], cgIn: number, weightLb: number): boolean {
  const points = normalizeEnvelope(envelope);
  if (points.length < 3 || !(cgIn > 0) || !(weightLb >= 0)) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const pi = points[i];
    const pj = points[j];
    const intersects =
      pi.weightLb > weightLb !== pj.weightLb > weightLb &&
      cgIn < ((pj.cgIn - pi.cgIn) * (weightLb - pi.weightLb)) / (pj.weightLb - pi.weightLb) + pi.cgIn;
    if (intersects) inside = !inside;
  }
  return inside;
}

function totalItems(items: WeightBalanceLineItem[]): { weightLb: number; moment: number; cgIn: number } {
  const weightLb = items.reduce((sum, item) => sum + item.weightLb, 0);
  const moment = items.reduce((sum, item) => sum + item.moment, 0);
  return { weightLb, moment, cgIn: weightLb > 0 ? moment / weightLb : 0 };
}

function evaluatePhase(
  name: WeightBalancePhaseName,
  totals: { weightLb: number; moment: number; cgIn: number },
  profile: WeightBalanceProfile,
  maxWeightLb?: number
): WeightBalancePhaseResult {
  const bounds = getCgBoundsAtWeight(profile.envelope, totals.weightLb);
  const warnings: string[] = [];
  let status: WeightBalancePhaseResult["status"] = "unknown";
  if (maxWeightLb && totals.weightLb > maxWeightLb) {
    status = "overweight";
    warnings.push(`${name} weight exceeds ${maxWeightLb.toFixed(0)} lb limit.`);
  } else if (bounds) {
    if (totals.cgIn < bounds.forward) {
      status = "forward";
      warnings.push(`${name} CG is forward of the envelope at this weight.`);
    } else if (totals.cgIn > bounds.aft) {
      status = "aft";
      warnings.push(`${name} CG is aft of the envelope at this weight.`);
    } else if (pointInEnvelope(profile.envelope, totals.cgIn, totals.weightLb)) {
      status = "within";
    } else {
      status = "unknown";
      warnings.push(`${name} CG could not be confirmed inside the envelope.`);
    }
  } else if (totals.weightLb > 0) {
    warnings.push(`${name} CG limits are unavailable at this weight.`);
  }
  return {
    name,
    weightLb: totals.weightLb,
    moment: totals.moment,
    cgIn: totals.cgIn,
    status,
    cgForwardLimit: bounds?.forward,
    cgAftLimit: bounds?.aft,
    maxWeightLb,
    warnings,
  };
}

function fuelItems(profile: WeightBalanceProfile, gallonsByTank: Record<string, number>, remainingAdjustmentGal: number) {
  let adjustmentRemaining = Math.max(0, remainingAdjustmentGal);
  return profile.fuelTanks.map((tank) => {
    const startingGal = Math.min(
      numberOrZero(gallonsByTank[tank.id] ?? tank.defaultFuelGal),
      numberOrZero(tank.maxFuelGal ?? tank.capacityGal)
    );
    const burnFromTank = Math.min(startingGal, adjustmentRemaining);
    adjustmentRemaining -= burnFromTank;
    const remainingGal = Math.max(0, startingGal - burnFromTank);
    return {
      id: `fuel-${tank.id}`,
      name: `${tank.name} fuel`,
      weightLb: remainingGal * numberOrZero(tank.fuelDensityLbPerGal),
      armIn: numberOrZero(tank.armIn),
      moment: remainingGal * numberOrZero(tank.fuelDensityLbPerGal) * numberOrZero(tank.armIn),
    };
  });
}

export function calculateWeightBalance(
  profile: WeightBalanceProfile,
  scenario: WeightBalanceScenario
): WeightBalanceResult {
  const warnings: string[] = [];
  const stationItems = profile.stations.map((station) => {
    const weightLb = numberOrZero(scenario.stationWeights[station.id] ?? station.defaultWeightLb);
    const armIn = numberOrZero(station.armIn);
    const maxWeightLb = numberOrZero(station.maxWeightLb);
    const warning = maxWeightLb > 0 && weightLb > maxWeightLb ? `${station.name} exceeds ${maxWeightLb} lb limit.` : undefined;
    if (warning) warnings.push(warning);
    return {
      id: station.id,
      name: station.name,
      weightLb,
      armIn,
      moment: weightLb * armIn,
      limitLabel: maxWeightLb > 0 ? `${maxWeightLb.toFixed(0)} lb max` : undefined,
      warning,
    };
  });

  const taxiFuelGal = Math.max(0, numberOrZero(scenario.taxiFuelGal ?? profile.taxiFuelGal));
  const tripFuelGal = Math.max(0, numberOrZero(scenario.tripFuelGal));
  const totalFuelGal = profile.fuelTanks.reduce(
    (sum, tank) => sum + Math.max(0, numberOrZero(scenario.fuelGallons[tank.id] ?? tank.defaultFuelGal)),
    0
  );
  const plannedBurnGal = taxiFuelGal + tripFuelGal;
  const fuelBurnWarning =
    plannedBurnGal > totalFuelGal
      ? `Planned taxi plus trip fuel (${plannedBurnGal.toFixed(1)} gal) exceeds fuel aboard (${totalFuelGal.toFixed(1)} gal).`
      : undefined;
  if (fuelBurnWarning) warnings.push(fuelBurnWarning);

  const rampItems = [...stationItems, ...fuelItems(profile, scenario.fuelGallons, 0)];
  const takeoffItems = [...stationItems, ...fuelItems(profile, scenario.fuelGallons, taxiFuelGal)];
  const landingItems = [...stationItems, ...fuelItems(profile, scenario.fuelGallons, taxiFuelGal + tripFuelGal)];
  const zeroFuelItems = [...stationItems];

  const ramp = evaluatePhase("Ramp", totalItems(rampItems), profile, profile.maxRampWeightLb || profile.maxTakeoffWeightLb);
  const taxi = evaluatePhase("Taxi / Run-up", totalItems(takeoffItems), profile, profile.maxTakeoffWeightLb);
  const takeoff = evaluatePhase("Takeoff", totalItems(takeoffItems), profile, profile.maxTakeoffWeightLb);
  const zeroFuel = evaluatePhase("Zero Fuel", totalItems(zeroFuelItems), profile, undefined);
  const landing = evaluatePhase("Landing", totalItems(landingItems), profile, profile.maxLandingWeightLb || profile.maxTakeoffWeightLb);

  return {
    lineItems: rampItems,
    phases: [ramp, taxi, takeoff, zeroFuel, landing],
    warnings: [...warnings, ...[ramp, taxi, takeoff, zeroFuel, landing].flatMap((phase) => phase.warnings)],
    fuelBurnWarning,
  };
}

export function buildDefaultWeightBalanceProfile(): WeightBalanceProfile {
  const now = new Date().toISOString();
  return {
    id: "manual-default",
    name: "Manual GA Aircraft",
    source: "manual",
    verificationStatus: "needs-poh-review",
    maxRampWeightLb: 2558,
    maxTakeoffWeightLb: 2550,
    maxLandingWeightLb: 2550,
    taxiFuelGal: 1,
    stations: [
      { id: "empty", name: "Basic Empty Aircraft", type: "empty", armIn: 39.5, defaultWeightLb: 1600, required: true },
      { id: "front", name: "Front Seats", type: "occupant", armIn: 37, defaultWeightLb: 340, maxWeightLb: 400 },
      { id: "rear", name: "Rear Seats", type: "occupant", armIn: 73, defaultWeightLb: 0, maxWeightLb: 400 },
      { id: "baggage-a", name: "Baggage Area A", type: "baggage", armIn: 95, defaultWeightLb: 40, maxWeightLb: 120 },
      { id: "baggage-b", name: "Baggage Area B", type: "baggage", armIn: 123, defaultWeightLb: 0, maxWeightLb: 50 },
    ],
    fuelTanks: [{ id: "main", name: "Usable Fuel", armIn: 48, capacityGal: 56, defaultFuelGal: 40, fuelDensityLbPerGal: 6 }],
    envelope: [
      { cgIn: 35, weightLb: 1500 },
      { cgIn: 35, weightLb: 1950 },
      { cgIn: 41, weightLb: 2550 },
      { cgIn: 47.3, weightLb: 2550 },
      { cgIn: 47.3, weightLb: 1500 },
    ],
    notes: "Replace defaults with current aircraft weight-and-balance record and POH/AFM envelope.",
    updatedAt: now,
  };
}

export function createScenarioForProfile(profile: WeightBalanceProfile, name = "Current Load"): WeightBalanceScenario {
  const now = new Date().toISOString();
  return {
    id: makeId("wb_scenario"),
    profileId: profile.id,
    name,
    stationWeights: Object.fromEntries(profile.stations.map((station) => [station.id, station.defaultWeightLb])),
    fuelGallons: Object.fromEntries(profile.fuelTanks.map((tank) => [tank.id, tank.defaultFuelGal])),
    tripFuelGal: 18,
    taxiFuelGal: profile.taxiFuelGal,
    updatedAt: now,
  };
}
