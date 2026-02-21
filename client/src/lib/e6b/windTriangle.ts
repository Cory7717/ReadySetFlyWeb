import {
  calcGroundSpeed,
  calcTrueHeading,
  calcWca,
  calcWindComponents,
  normalizeHeading,
} from "@/lib/calculators/eb6";

export type WindTriangleInput = {
  tas: number | null;
  windDir: number | null;
  windSpeed: number | null;
  course: number | null;
};

export type WindTriangleResult = {
  wcaDeg: number | null;
  headingDeg: number | null;
  groundSpeedKt: number | null;
  headwindKt: number | null;
  crosswindKt: number | null;
  tasKt: number | null;
  courseDeg: number | null;
  windDirDeg: number | null;
  windSpeedKt: number | null;
};

const toFiniteNumber = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return null;
  return value;
};

const normalizeDeg = (value: number | null) => {
  if (value === null) return null;
  return normalizeHeading(value);
};

const clampWindSpeed = (value: number | null) => {
  if (value === null) return null;
  return Math.max(0, value);
};

export const computeWindTriangle = (input: WindTriangleInput): WindTriangleResult => {
  const tas = toFiniteNumber(input.tas);
  const course = normalizeDeg(toFiniteNumber(input.course));
  const windDir = normalizeDeg(toFiniteNumber(input.windDir));
  const windSpeed = clampWindSpeed(toFiniteNumber(input.windSpeed));

  if (tas === null || course === null || windDir === null || windSpeed === null) {
    return {
      wcaDeg: null,
      headingDeg: null,
      groundSpeedKt: null,
      headwindKt: null,
      crosswindKt: null,
      tasKt: tas,
      courseDeg: course,
      windDirDeg: windDir,
      windSpeedKt: windSpeed,
    };
  }

  const wind = calcWindComponents(windDir, windSpeed, course);
  const wca = calcWca(wind.crosswind, tas);
  const heading = calcTrueHeading(course, wca);
  const groundSpeed = calcGroundSpeed(tas, wind.headwind);

  return {
    wcaDeg: wca,
    headingDeg: heading,
    groundSpeedKt: groundSpeed,
    headwindKt: wind.headwind,
    crosswindKt: wind.crosswind,
    tasKt: tas,
    courseDeg: course,
    windDirDeg: windDir,
    windSpeedKt: windSpeed,
  };
};
