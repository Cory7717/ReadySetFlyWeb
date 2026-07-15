export type CruiseAltitudePracticalityClassification =
  | "practical"
  | "marginal"
  | "impractical"
  | "unable";

export type CruiseAltitudePerformanceSource =
  | "saved_profile"
  | "aircraft_library_verified"
  | "aircraft_library_estimate"
  | "fixture"
  | "unavailable";

export type CruiseAltitudePracticalityInput = {
  routeDistanceNm: number | null | undefined;
  plannedAltitudeFt: number | null | undefined;
  departureElevationFt: number | null | undefined;
  destinationElevationFt: number | null | undefined;
  climbRateFpm?: number | null;
  climbSpeedKt?: number | null;
  descentRateFpm?: number | null;
  descentSpeedKt?: number | null;
  serviceCeilingFt?: number | null;
  performanceSource?: CruiseAltitudePerformanceSource | null;
  windComponentKt?: number | null;
  windSource?: "calculated" | "partial" | "manual" | "unavailable" | "still_air" | null;
};

export type CruiseAltitudePracticalityResult = {
  classification: CruiseAltitudePracticalityClassification;
  message: string;
  missingInputs: string[];
  assumptions: string[];
  routeDistanceNm: number | null;
  departureElevationFt: number | null;
  destinationElevationFt: number | null;
  plannedAltitudeFt: number | null;
  altitudeToClimbFt: number | null;
  altitudeToDescendFt: number | null;
  climbTimeMinutes: number | null;
  descentTimeMinutes: number | null;
  climbDistanceNm: number | null;
  descentDistanceNm: number | null;
  remainingCruiseDistanceNm: number | null;
  meaningfulCruiseDistanceNm: number;
  performanceSource: CruiseAltitudePerformanceSource;
  serviceCeilingExceeded: boolean;
  windAdjusted: boolean;
};

const toPositiveNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const toFiniteNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const round1 = (value: number) => Math.round(value * 10) / 10;
const round0 = (value: number) => Math.round(value);

export const MEANINGFUL_CRUISE_DISTANCE_NM = 10;
export const MARGINAL_CRUISE_DISTANCE_NM = 20;

export const assessCruiseAltitudePracticality = (
  input: CruiseAltitudePracticalityInput,
): CruiseAltitudePracticalityResult => {
  const routeDistanceNm = toPositiveNumber(input.routeDistanceNm);
  const plannedAltitudeFt = toPositiveNumber(input.plannedAltitudeFt);
  const departureElevationFt = toFiniteNumber(input.departureElevationFt);
  const destinationElevationFt = toFiniteNumber(input.destinationElevationFt);
  const climbRateFpm = toPositiveNumber(input.climbRateFpm);
  const climbSpeedKt = toPositiveNumber(input.climbSpeedKt);
  const descentRateFpm = toPositiveNumber(input.descentRateFpm);
  const descentSpeedKt = toPositiveNumber(input.descentSpeedKt);
  const serviceCeilingFt = toPositiveNumber(input.serviceCeilingFt);
  const performanceSource = input.performanceSource || "unavailable";
  const missingInputs: string[] = [];
  const assumptions: string[] = [];

  if (!routeDistanceNm) missingInputs.push("routeDistanceNm");
  if (!plannedAltitudeFt) missingInputs.push("plannedAltitudeFt");
  if (departureElevationFt === null) missingInputs.push("departureElevationFt");
  if (destinationElevationFt === null) missingInputs.push("destinationElevationFt");
  if (!climbRateFpm) missingInputs.push("climbRateFpm");
  if (!climbSpeedKt) missingInputs.push("climbSpeedKt");
  if (!descentRateFpm) missingInputs.push("descentRateFpm");
  if (!descentSpeedKt) missingInputs.push("descentSpeedKt");

  const serviceCeilingExceeded = Boolean(
    serviceCeilingFt && plannedAltitudeFt && plannedAltitudeFt > serviceCeilingFt,
  );

  if (missingInputs.length > 0) {
    return {
      classification: "unable",
      message: "Altitude practicality cannot be assessed with the available aircraft performance data.",
      missingInputs,
      assumptions,
      routeDistanceNm: routeDistanceNm ? round1(routeDistanceNm) : null,
      departureElevationFt,
      destinationElevationFt,
      plannedAltitudeFt,
      altitudeToClimbFt: null,
      altitudeToDescendFt: null,
      climbTimeMinutes: null,
      descentTimeMinutes: null,
      climbDistanceNm: null,
      descentDistanceNm: null,
      remainingCruiseDistanceNm: null,
      meaningfulCruiseDistanceNm: MEANINGFUL_CRUISE_DISTANCE_NM,
      performanceSource,
      serviceCeilingExceeded,
      windAdjusted: false,
    };
  }

  if (serviceCeilingExceeded) {
    return {
      classification: "impractical",
      message: "Selected altitude is above the aircraft service ceiling. Review a lower cruise altitude or verified aircraft data.",
      missingInputs,
      assumptions,
      routeDistanceNm: round1(routeDistanceNm!),
      departureElevationFt,
      destinationElevationFt,
      plannedAltitudeFt,
      altitudeToClimbFt: null,
      altitudeToDescendFt: null,
      climbTimeMinutes: null,
      descentTimeMinutes: null,
      climbDistanceNm: null,
      descentDistanceNm: null,
      remainingCruiseDistanceNm: null,
      meaningfulCruiseDistanceNm: MEANINGFUL_CRUISE_DISTANCE_NM,
      performanceSource,
      serviceCeilingExceeded,
      windAdjusted: false,
    };
  }

  const altitudeToClimbFt = plannedAltitudeFt! - departureElevationFt!;
  const altitudeToDescendFt = plannedAltitudeFt! - destinationElevationFt!;
  if (altitudeToClimbFt <= 0 || altitudeToDescendFt <= 0) {
    return {
      classification: "impractical",
      message: "Selected altitude is at or below an airport field elevation. Review the planned altitude before relying on the route analysis.",
      missingInputs,
      assumptions,
      routeDistanceNm: round1(routeDistanceNm!),
      departureElevationFt,
      destinationElevationFt,
      plannedAltitudeFt,
      altitudeToClimbFt: round0(altitudeToClimbFt),
      altitudeToDescendFt: round0(altitudeToDescendFt),
      climbTimeMinutes: null,
      descentTimeMinutes: null,
      climbDistanceNm: null,
      descentDistanceNm: null,
      remainingCruiseDistanceNm: null,
      meaningfulCruiseDistanceNm: MEANINGFUL_CRUISE_DISTANCE_NM,
      performanceSource,
      serviceCeilingExceeded,
      windAdjusted: false,
    };
  }

  const windComponentKt = toFiniteNumber(input.windComponentKt);
  const windAdjusted = Boolean(input.windSource && input.windSource !== "unavailable" && windComponentKt !== null);
  if (windAdjusted) {
    assumptions.push(`Uses ${input.windSource} route wind component for climb/descent groundspeed estimate.`);
  } else {
    assumptions.push("Still-air estimate; route wind coverage was unavailable or not selected.");
  }
  assumptions.push("Uses constant climb/descent rates and speeds; RSF does not model altitude bands or density-altitude effects here.");

  const climbGroundspeedKt = Math.max(30, climbSpeedKt! - (windAdjusted ? windComponentKt! : 0));
  const descentGroundspeedKt = Math.max(30, descentSpeedKt! - (windAdjusted ? windComponentKt! : 0));
  const climbTimeMinutes = altitudeToClimbFt / climbRateFpm!;
  const descentTimeMinutes = altitudeToDescendFt / descentRateFpm!;
  const climbDistanceNm = (climbGroundspeedKt * climbTimeMinutes) / 60;
  const descentDistanceNm = (descentGroundspeedKt * descentTimeMinutes) / 60;
  const remainingCruiseDistanceNm = routeDistanceNm! - climbDistanceNm - descentDistanceNm;

  let classification: CruiseAltitudePracticalityClassification = "practical";
  let message = "Selected altitude appears practical for this route based on available climb and descent estimates.";
  if (remainingCruiseDistanceNm < MEANINGFUL_CRUISE_DISTANCE_NM) {
    classification = "impractical";
    message = "Selected altitude is unlikely to be reached before descent. Estimated climb and descent distance consumes the planned route.";
  } else if (remainingCruiseDistanceNm < MARGINAL_CRUISE_DISTANCE_NM) {
    classification = "marginal";
    message = `Selected altitude may not be practical for this route. Only approximately ${round0(remainingCruiseDistanceNm)} NM of level cruise would remain.`;
  }

  return {
    classification,
    message,
    missingInputs,
    assumptions,
    routeDistanceNm: round1(routeDistanceNm!),
    departureElevationFt,
    destinationElevationFt,
    plannedAltitudeFt,
    altitudeToClimbFt: round0(altitudeToClimbFt),
    altitudeToDescendFt: round0(altitudeToDescendFt),
    climbTimeMinutes: round1(climbTimeMinutes),
    descentTimeMinutes: round1(descentTimeMinutes),
    climbDistanceNm: round1(climbDistanceNm),
    descentDistanceNm: round1(descentDistanceNm),
    remainingCruiseDistanceNm: round1(remainingCruiseDistanceNm),
    meaningfulCruiseDistanceNm: MEANINGFUL_CRUISE_DISTANCE_NM,
    performanceSource,
    serviceCeilingExceeded,
    windAdjusted,
  };
};

export const cruiseAltitudeBand = (altitudeFt: number | null | undefined) => {
  const value = toPositiveNumber(altitudeFt);
  if (!value) return "missing";
  if (value < 5000) return "below_5000";
  if (value < 10000) return "5000_9999";
  if (value < 18000) return "10000_17999";
  return "18000_plus";
};

export const routeDistanceBand = (distanceNm: number | null | undefined) => {
  const value = toPositiveNumber(distanceNm);
  if (!value) return "missing";
  if (value < 25) return "below_25";
  if (value < 75) return "25_74";
  if (value < 150) return "75_149";
  if (value < 300) return "150_299";
  return "300_plus";
};
