export type RoutePoint = {
  latitude: number;
  longitude: number;
  icao?: string | null;
};

export type MobileRouteProgressSummary = {
  totalRouteNm: number;
  remainingRouteNm: number;
  progressPct: number;
  offRouteNm: number;
  crossTrackNm: number;
  legIndex: number;
  desiredTrackDeg: number | null;
  nextWaypoint: string | null;
  etaText: string | null;
};

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function greatCircleNm<T extends { latitude: number; longitude: number }>(a: T, b: T) {
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

function projectLatLonToNm(lat: number, lon: number, refLat: number) {
  const latNm = lat * 60;
  const lonNm = lon * 60 * Math.cos((refLat * Math.PI) / 180);
  return { x: lonNm, y: latNm };
}

export function computeMobileRouteProgress<T extends RoutePoint>(
  routePoints: T[],
  ownship: { lat: number; lon: number; speedKts?: number | null } | null,
): MobileRouteProgressSummary | null {
  if (!ownship || routePoints.length < 2) return null;

  const legLengths = routePoints.slice(1).map((point, index) => greatCircleNm(routePoints[index], point));
  const totalRouteNm = legLengths.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(totalRouteNm) || totalRouteNm <= 0) return null;

  const refLat = ownship.lat;
  const ownshipPoint = projectLatLonToNm(ownship.lat, ownship.lon, refLat);
  let best:
    | {
        legIndex: number;
        offRouteNm: number;
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
    const t = Math.min(1, Math.max(0, tRaw));
    const nearestX = startNm.x + dx * t;
    const nearestY = startNm.y + dy * t;
    const offRouteNm = Math.hypot(ownshipPoint.x - nearestX, ownshipPoint.y - nearestY);
    const crossZ = dx * (ownshipPoint.y - startNm.y) - dy * (ownshipPoint.x - startNm.x);
    const crossTrackNm = offRouteNm === 0 ? 0 : offRouteNm * (crossZ >= 0 ? 1 : -1);
    const legLengthNm = legLengths[index] ?? 0;
    const traveledNm = traveledBeforeLeg + legLengthNm * t;
    const desiredTrackDeg = bearingBetweenPoints(start, end);

    if (!best || offRouteNm < best.offRouteNm) {
      best = { legIndex: index, offRouteNm, crossTrackNm, traveledNm, desiredTrackDeg };
    }
    traveledBeforeLeg += legLengthNm;
  }

  if (!best) return null;

  const remainingRouteNm = Math.max(0, totalRouteNm - best.traveledNm);
  const speedKts = ownship.speedKts ?? null;
  const etaText =
    speedKts && speedKts > 20
      ? new Date(Date.now() + (remainingRouteNm / speedKts) * 60 * 60 * 1000).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        })
      : null;

  return {
    totalRouteNm,
    remainingRouteNm,
    progressPct: Math.min(100, Math.max(0, (best.traveledNm / totalRouteNm) * 100)),
    offRouteNm: best.offRouteNm,
    crossTrackNm: best.crossTrackNm,
    legIndex: best.legIndex,
    desiredTrackDeg: best.desiredTrackDeg,
    nextWaypoint: routePoints[best.legIndex + 1]?.icao || routePoints[routePoints.length - 1]?.icao || null,
    etaText,
  };
}

export function getDistanceNmFromLatLon(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const R = 3440.065;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
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

export function offsetLatLonByNm(lat: number, lon: number, northNm: number, eastNm: number) {
  const dLat = northNm / 60;
  const dLon = eastNm / (60 * Math.max(0.2, Math.cos(toRad(lat))));
  return {
    lat: lat + dLat,
    lon: lon + dLon,
  };
}

export function interpolateRouteOwnship<T extends { latitude: number; longitude: number }>(
  routePoints: T[],
  progressPct: number,
  cruiseKts: number,
  plannedAltitudeFt: number,
): { ownship: { lat: number; lon: number; altitudeFt: number; speedKts: number; heading: number }; verticalSpeedFpm: number } | null {
  if (routePoints.length < 2) return null;
  const clampedProgress = Math.min(1, Math.max(0, progressPct));
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
  const legProgress = Math.min(1, Math.max(0, remainingNm / legNm));
  const latitude = start.latitude + (end.latitude - start.latitude) * legProgress;
  const longitude = start.longitude + (end.longitude - start.longitude) * legProgress;
  const heading = bearingBetweenPoints(start, end);

  let altitudeFt = plannedAltitudeFt;
  let verticalSpeedFpm = 0;
  if (clampedProgress < 0.12) {
    const climbPct = clampedProgress / 0.12;
    altitudeFt = Math.max(900, plannedAltitudeFt * climbPct);
    verticalSpeedFpm = 700;
  } else if (clampedProgress > 0.88) {
    const descentPct = (clampedProgress - 0.88) / 0.12;
    altitudeFt = Math.max(1200, plannedAltitudeFt * (1 - descentPct));
    verticalSpeedFpm = -500;
  }

  return {
    ownship: {
      lat: latitude,
      lon: longitude,
      altitudeFt,
      speedKts: cruiseKts,
      heading,
    },
    verticalSpeedFpm,
  };
}

export function rankTrafficTargets<T extends { lat: number; lon: number; altitudeFt?: number | null }>(
  trafficTargets: T[],
  ownship: { lat: number; lon: number; altitudeFt?: number | null } | null,
): Array<T & {
  distanceNm: number;
  altitudeDeltaFt: number | null;
  threatScore: number;
  threatLevel: 'immediate' | 'advisory' | 'monitor';
}> {
  if (!ownship) return [];

  return trafficTargets
    .map((target) => {
      const distanceNm = getDistanceNmFromLatLon(
        { lat: ownship.lat, lon: ownship.lon },
        { lat: target.lat, lon: target.lon },
      );
      const altitudeDeltaFt =
        typeof ownship.altitudeFt === 'number' && typeof target.altitudeFt === 'number'
          ? target.altitudeFt - ownship.altitudeFt
          : null;
      const verticalGap = altitudeDeltaFt === null ? 4000 : Math.abs(altitudeDeltaFt);
      const distanceScore = distanceNm <= 2 ? 70 : distanceNm <= 5 ? 45 : distanceNm <= 10 ? 25 : 10;
      const verticalScore = verticalGap <= 500 ? 30 : verticalGap <= 1000 ? 20 : verticalGap <= 2000 ? 10 : 0;
      const threatScore = distanceScore + verticalScore;
      const threatLevel =
        threatScore >= 80 ? 'immediate' : threatScore >= 45 ? 'advisory' : 'monitor';

      return {
        ...target,
        distanceNm,
        altitudeDeltaFt,
        threatScore,
        threatLevel,
      };
    })
    .sort((a, b) => b.threatScore - a.threatScore || a.distanceNm - b.distanceNm);
}

export function normalizeHeadingDelta(delta: number) {
  let normalized = ((delta + 180) % 360 + 360) % 360 - 180;
  if (normalized === -180) normalized = 180;
  return normalized;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function relativeClockPosition(bearingDelta: number) {
  const normalized = ((bearingDelta % 360) + 360) % 360;
  const hours = Math.round(normalized / 30) || 12;
  return `${hours} o'clock`;
}
