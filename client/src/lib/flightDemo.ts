export type DemoRoutePoint = {
  icao: string;
  name?: string | null;
  latitude: number;
  longitude: number;
  kind?: "origin" | "waypoint" | "stop" | "destination";
};

export type DemoOwnship = {
  lat: number;
  lon: number;
  altitudeFt: number;
  speedKts: number;
  heading: number;
};

export type DemoRouteProgress = {
  totalRouteNm: number;
  remainingRouteNm: number;
  progressPct: number;
  legIndex: number;
  nextWaypoint: string | null;
  desiredTrackDeg: number | null;
  crossTrackNm: number;
};

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function projectLatLonToNm(lat: number, lon: number, refLat: number) {
  const latNm = lat * 60;
  const lonNm = lon * 60 * Math.cos((refLat * Math.PI) / 180);
  return { x: lonNm, y: latNm };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function greatCircleNm<
  TFrom extends { latitude: number; longitude: number },
  TTo extends { latitude: number; longitude: number },
>(a: TFrom, b: TTo) {
  const R = 3440.065;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function computeRouteDistanceNm<T extends { latitude: number; longitude: number }>(routePoints: T[]) {
  if (routePoints.length < 2) return 0;
  return routePoints.slice(1).reduce((sum, point, index) => sum + greatCircleNm(routePoints[index], point), 0);
}

export function bearingBetweenPoints(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function interpolateRouteOwnship<T extends { latitude: number; longitude: number }>(
  routePoints: T[],
  progressPct: number,
  cruiseKts: number,
  plannedAltitudeFt: number,
) {
  if (routePoints.length < 2) return null;

  const clampedProgress = clamp(progressPct, 0, 1);
  const legLengths = routePoints.slice(1).map((point, index) => greatCircleNm(routePoints[index], point));
  const totalRouteNm = legLengths.reduce((sum, value) => sum + value, 0);
  if (!totalRouteNm || !Number.isFinite(totalRouteNm)) return null;

  let remainingNm = totalRouteNm * clampedProgress;
  let legIndex = 0;
  while (legIndex < legLengths.length - 1 && remainingNm > legLengths[legIndex]) {
    remainingNm -= legLengths[legIndex];
    legIndex += 1;
  }

  const start = routePoints[legIndex];
  const end = routePoints[legIndex + 1] || routePoints[routePoints.length - 1];
  const legNm = Math.max(legLengths[legIndex] || 1, 1);
  const legProgress = clamp(remainingNm / legNm, 0, 1);
  const latitude = start.latitude + (end.latitude - start.latitude) * legProgress;
  const longitude = start.longitude + (end.longitude - start.longitude) * legProgress;
  const heading = bearingBetweenPoints(start, end);

  let altitudeFt = plannedAltitudeFt;
  let verticalSpeedFpm = 0;
  let speedKts = cruiseKts;
  if (clampedProgress < 0.02) {
    const taxiOutPct = clampedProgress / 0.02;
    altitudeFt = 900;
    verticalSpeedFpm = 0;
    speedKts = 12 + taxiOutPct * 38;
  } else if (clampedProgress < 0.12) {
    const climbPct = (clampedProgress - 0.02) / 0.1;
    altitudeFt = Math.max(1200, plannedAltitudeFt * (0.16 + climbPct * 0.84));
    verticalSpeedFpm = 700;
    speedKts = 50 + (cruiseKts - 50) * climbPct;
  } else if (clampedProgress > 0.985) {
    const taxiInPct = (clampedProgress - 0.985) / 0.015;
    altitudeFt = 900;
    verticalSpeedFpm = 0;
    speedKts = Math.max(10, 55 - taxiInPct * 40);
  } else if (clampedProgress > 0.88) {
    const descentPct = (clampedProgress - 0.88) / 0.12;
    altitudeFt = Math.max(1200, plannedAltitudeFt * (1 - descentPct));
    verticalSpeedFpm = -500;
    speedKts = cruiseKts - (cruiseKts - 75) * descentPct;
  }

  return {
    ownship: {
      lat: latitude,
      lon: longitude,
      altitudeFt,
      speedKts,
      heading,
    },
    verticalSpeedFpm,
  };
}

export function computeDemoRouteProgress<T extends { latitude: number; longitude: number; icao?: string }>(
  routePoints: T[],
  ownship: { lat: number; lon: number; speedKts?: number | null } | null,
): DemoRouteProgress | null {
  if (!ownship || routePoints.length < 2) return null;

  const legLengths = routePoints.slice(1).map((point, index) => greatCircleNm(routePoints[index], point));
  const totalRouteNm = legLengths.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(totalRouteNm) || totalRouteNm <= 0) return null;

  const refLat = ownship.lat;
  const ownshipPoint = projectLatLonToNm(ownship.lat, ownship.lon, refLat);
  let best:
    | {
        legIndex: number;
        crossTrackNm: number;
        traveledNm: number;
        desiredTrackDeg: number | null;
      }
    | null = null;

  let traveledBeforeLeg = 0;
  for (let index = 0; index < routePoints.length - 1; index += 1) {
    const start = routePoints[index];
    const end = routePoints[index + 1];
    const startNm = projectLatLonToNm(start.latitude, start.longitude, refLat);
    const endNm = projectLatLonToNm(end.latitude, end.longitude, refLat);
    const dx = endNm.x - startNm.x;
    const dy = endNm.y - startNm.y;
    const legLengthSq = dx * dx + dy * dy;
    const tRaw =
      legLengthSq > 0
        ? ((ownshipPoint.x - startNm.x) * dx + (ownshipPoint.y - startNm.y) * dy) / legLengthSq
        : 0;
    const t = clamp(tRaw, 0, 1);
    const nearestX = startNm.x + dx * t;
    const nearestY = startNm.y + dy * t;
    const offRouteNm = Math.hypot(ownshipPoint.x - nearestX, ownshipPoint.y - nearestY);
    const crossZ = dx * (ownshipPoint.y - startNm.y) - dy * (ownshipPoint.x - startNm.x);
    const crossTrackNm = offRouteNm === 0 ? 0 : offRouteNm * (crossZ >= 0 ? 1 : -1);
    const legLengthNm = legLengths[index] ?? 0;
    const traveledNm = traveledBeforeLeg + legLengthNm * t;
    const desiredTrackDeg = bearingBetweenPoints(start, end);

    if (!best || Math.abs(crossTrackNm) < Math.abs(best.crossTrackNm)) {
      best = { legIndex: index, crossTrackNm, traveledNm, desiredTrackDeg };
    }
    traveledBeforeLeg += legLengthNm;
  }

  if (!best) return null;

  return {
    totalRouteNm,
    remainingRouteNm: Math.max(0, totalRouteNm - best.traveledNm),
    progressPct: clamp((best.traveledNm / totalRouteNm) * 100, 0, 100),
    legIndex: best.legIndex,
    nextWaypoint: routePoints[best.legIndex + 1]?.icao || routePoints[routePoints.length - 1]?.icao || null,
    desiredTrackDeg: best.desiredTrackDeg,
    crossTrackNm: best.crossTrackNm,
  };
}

export function projectPointRelativeToOwnship(
  ownship: { lat: number; lon: number; heading: number },
  point: { latitude: number; longitude: number },
) {
  const avgLat = (ownship.lat + point.latitude) / 2;
  const northNm = (point.latitude - ownship.lat) * 60;
  const eastNm = (point.longitude - ownship.lon) * 60 * Math.cos((avgLat * Math.PI) / 180);
  const headingRad = toRad(ownship.heading);
  const forwardNm = northNm * Math.cos(headingRad) + eastNm * Math.sin(headingRad);
  const rightNm = eastNm * Math.cos(headingRad) - northNm * Math.sin(headingRad);
  return { forwardNm, rightNm };
}
