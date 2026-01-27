export type AirportPoint = {
  icao: string;
  lat: number;
  lon: number;
};

export type RouteLeg = {
  from: AirportPoint;
  to: AirportPoint;
  distanceNm: number;
};

export function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceNm(from: AirportPoint, to: AirportPoint) {
  const radiusNm = 3440.065;
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radiusNm * c;
}

export function buildLegs(points: AirportPoint[]): RouteLeg[] {
  const legs: RouteLeg[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i];
    const to = points[i + 1];
    legs.push({ from, to, distanceNm: distanceNm(from, to) });
  }
  return legs;
}

export function sumDistance(legs: RouteLeg[]) {
  return legs.reduce((total, leg) => total + leg.distanceNm, 0);
}
