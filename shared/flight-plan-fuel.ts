export const formatFuelDurationClock = (minutes: number | null | undefined) => {
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) return "-";
  const rounded = Math.max(1, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return `${hours}:${String(mins).padStart(2, "0")}`;
};

export const calculateFuelEnduranceMinutes = (
  fuelOnBoardGallons?: number | null,
  fuelBurnGph?: number | null,
) => {
  const fuel = Number(fuelOnBoardGallons);
  const burn = Number(fuelBurnGph);
  if (!Number.isFinite(fuel) || fuel <= 0) return null;
  if (!Number.isFinite(burn) || burn <= 0) return null;
  return Math.max(1, Math.round((fuel / burn) * 60));
};

export const calculateFuelRequiredGallons = ({
  eteMinutes,
  fuelBurnGph,
  reserveMinutes,
}: {
  eteMinutes?: number | null;
  fuelBurnGph?: number | null;
  reserveMinutes?: number | null;
}) => {
  const ete = Number(eteMinutes);
  const burn = Number(fuelBurnGph);
  const reserve = Number(reserveMinutes);
  if (!Number.isFinite(ete) || ete <= 0 || !Number.isFinite(burn) || burn <= 0) {
    return {
      tripFuelGallons: 0,
      reserveFuelGallons: Number.isFinite(reserve) && reserve > 0 ? (reserve / 60) * Math.max(burn, 0) : 0,
      totalRequiredFuelGallons: 0,
    };
  }
  const tripFuelGallons = (ete / 60) * burn;
  const reserveFuelGallons = Number.isFinite(reserve) && reserve > 0 ? (reserve / 60) * burn : 0;
  return {
    tripFuelGallons,
    reserveFuelGallons,
    totalRequiredFuelGallons: tripFuelGallons + reserveFuelGallons,
  };
};

export const resolveAuthoritativeEteMinutes = ({
  routeDerivedEteMinutes,
}: {
  routeDerivedEteMinutes?: number | null;
  legacyManualEstimatedEnrouteMinutes?: number | null;
}) => {
  const routeEte = Number(routeDerivedEteMinutes);
  return Number.isFinite(routeEte) && routeEte > 0
    ? Math.max(1, Math.round(routeEte))
    : null;
};

export const buildFuelEnduranceState = ({
  eteMinutes,
  fuelOnBoardGallons,
  fuelBurnGph,
  manualEnduranceMinutes,
  manualOverrideEnabled,
}: {
  eteMinutes?: number | null;
  fuelOnBoardGallons?: number | null;
  fuelBurnGph?: number | null;
  manualEnduranceMinutes?: number | null;
  manualOverrideEnabled?: boolean;
}) => {
  const calculatedEnduranceMinutes = calculateFuelEnduranceMinutes(fuelOnBoardGallons, fuelBurnGph);
  const manual = Number(manualEnduranceMinutes);
  const normalizedManual = Number.isFinite(manual) && manual > 0 ? Math.round(manual) : null;
  const filedEnduranceMinutes = manualOverrideEnabled && normalizedManual
    ? normalizedManual
    : calculatedEnduranceMinutes;
  const normalizedEte = Number(eteMinutes);
  const authoritativeEteMinutes = Number.isFinite(normalizedEte) && normalizedEte > 0
    ? Math.round(normalizedEte)
    : null;
  const surplusOrDeficitMinutes = authoritativeEteMinutes && filedEnduranceMinutes
    ? filedEnduranceMinutes - authoritativeEteMinutes
    : null;
  const manualDifferenceMinutes = manualOverrideEnabled && normalizedManual && calculatedEnduranceMinutes
    ? normalizedManual - calculatedEnduranceMinutes
    : null;

  return {
    authoritativeEteMinutes,
    calculatedEnduranceMinutes,
    filedEnduranceMinutes,
    source: manualOverrideEnabled && normalizedManual
      ? "manual_icao_endurance"
      : calculatedEnduranceMinutes
        ? "calculated_from_fuel_and_burn"
        : "missing",
    surplusOrDeficitMinutes,
    isDeficient: surplusOrDeficitMinutes !== null && surplusOrDeficitMinutes < 0,
    manualDifferenceMinutes,
    manualDiffersMaterially: manualDifferenceMinutes !== null && Math.abs(manualDifferenceMinutes) >= 5,
  };
};
