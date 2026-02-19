export type WindComponents = {
  headwind: number;
  crosswind: number;
  relativeAngleDeg: number;
};

const degToRad = (deg: number) => (deg * Math.PI) / 180;
const radToDeg = (rad: number) => (rad * 180) / Math.PI;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const normalizeHeading = (value: number) => {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

export const normalizeSignedAngle = (value: number) => {
  const angle = ((value + 540) % 360) - 180;
  return angle;
};

export const calcPressureAltitude = (altimeterInHg: number, fieldElevationFt: number) => {
  return (29.92 - altimeterInHg) * 1000 + fieldElevationFt;
};

export const calcIsaTemp = (fieldElevationFt: number) => {
  return 15 - 2 * (fieldElevationFt / 1000);
};

export const calcDensityAltitude = (pressureAltitudeFt: number, oatC: number, fieldElevationFt: number) => {
  const tIsa = calcIsaTemp(fieldElevationFt);
  return pressureAltitudeFt + 120 * (oatC - tIsa);
};

export const calcWindComponents = (windDirDeg: number, windSpeedKt: number, trueCourseDeg: number): WindComponents => {
  const relative = normalizeSignedAngle(windDirDeg - trueCourseDeg);
  const relativeRad = degToRad(relative);
  return {
    headwind: windSpeedKt * Math.cos(relativeRad),
    crosswind: windSpeedKt * Math.sin(relativeRad),
    relativeAngleDeg: relative,
  };
};

export const calcTAS = (kias: number, densityAltitudeFt: number) => {
  // Estimate: +2% TAS per 1000 ft of density altitude
  return kias * (1 + (densityAltitudeFt / 1000) * 0.02);
};

export const calcGroundSpeed = (tasKt: number, headwindKt: number) => {
  return tasKt + headwindKt;
};

export const calcWca = (crosswindKt: number, tasKt: number) => {
  if (tasKt <= 0) return 0;
  const ratio = clamp(crosswindKt / tasKt, -1, 1);
  return radToDeg(Math.asin(ratio));
};

export const calcTrueHeading = (trueCourseDeg: number, wcaDeg: number) => {
  return normalizeHeading(trueCourseDeg + wcaDeg);
};

export const calcEnduranceHours = (fuelAvailableGal: number, fuelBurnGph: number) => {
  if (fuelBurnGph <= 0) return null;
  return fuelAvailableGal / fuelBurnGph;
};

export const calcRangeNm = (groundSpeedKt: number, enduranceHours: number | null) => {
  if (enduranceHours === null) return null;
  return groundSpeedKt * enduranceHours;
};
