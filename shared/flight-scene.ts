export type SceneGeoPoint = {
  latitude: number;
  longitude: number;
};

export type SceneOwnship = {
  lat: number;
  lon: number;
  heading: number;
  altitudeFt: number;
};

export type SceneRunway = {
  runwayId: string;
  headingDeg: number;
};

export type VisionRunwayCue = {
  runwayId: string;
  distanceNm: number;
  alignmentDeltaDeg: number;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
  centerlineLeftPct: number;
  centerlineTopPct: number;
  centerlineHeightPct: number;
  distanceLabel: string;
};

export type RunwayOverlay = {
  runwayId: string;
  centerline: Array<{ latitude: number; longitude: number }>;
  runwayBar: Array<{ latitude: number; longitude: number }>;
};

export type VisionTerrainBand = {
  d: string;
  fill: string;
};

export type VisionObstacleColumn = {
  leftPct: number;
  topPct: number;
  heightPct: number;
};

export type VisionTerrainColumn = {
  key: string;
  leftPct: number;
  heightPct: number;
  risk: 'nominal' | 'caution' | 'warning';
};

export type VisionObstacleCue = {
  key: string;
  xPct: number;
  yPct: number;
  risk: 'nominal' | 'caution' | 'warning';
};

export type VisionTrafficCue = {
  xPct: number;
  yPct: number;
  threat: 'monitor' | 'advisory' | 'immediate';
  sector: string;
  clock: string;
  closureText: string;
  vectorDxPct: number;
  vectorDyPct: number;
};

export type SceneTerrainSample = {
  elevationFt?: number | null;
};

export type SceneObstacle = {
  id: string | number;
  lat: number;
  lon: number;
  amslFt?: number | null;
  aglFt?: number | null;
};

export type SceneTrafficTarget = {
  id: string | number;
  lat: number;
  lon: number;
  altitudeDeltaFt?: number | null;
  distanceNm: number;
  threatLevel: 'monitor' | 'advisory' | 'immediate';
};

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function describeSceneSector(bearingDelta: number) {
  const absBearingDelta = Math.abs(bearingDelta);
  if (absBearingDelta <= 20) return 'ahead';
  if (absBearingDelta <= 70) return bearingDelta < 0 ? 'left crossing' : 'right crossing';
  if (absBearingDelta >= 135) return 'aft sector';
  return bearingDelta < 0 ? 'left' : 'right';
}

function describeSceneClock(bearingDelta: number) {
  const normalized = ((bearingDelta % 360) + 360) % 360;
  const hour = Math.round(normalized / 30) || 12;
  return `${hour} o'clock`;
}

export function clampScene(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function sceneGreatCircleNm(a: SceneGeoPoint, b: SceneGeoPoint) {
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

export function sceneBearingBetweenPoints(from: SceneGeoPoint, to: SceneGeoPoint) {
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function normalizeSceneHeadingDelta(delta: number) {
  let normalized = ((delta + 180) % 360 + 360) % 360 - 180;
  if (normalized === -180) normalized = 180;
  return normalized;
}

export function offsetScenePointByBearing(origin: { lat: number; lon: number }, bearingDeg: number, distanceNm: number) {
  const northNm = Math.cos(toRad(bearingDeg)) * distanceNm;
  const eastNm = Math.sin(toRad(bearingDeg)) * distanceNm;
  const dLat = northNm / 60;
  const dLon = eastNm / (60 * Math.max(0.2, Math.cos(toRad(origin.lat))));
  return {
    lat: origin.lat + dLat,
    lon: origin.lon + dLon,
  };
}

export function buildArrivalRunwayCue({
  ownship,
  airport,
  runway,
  destinationElevationFt = 0,
  activeRangeNm = 18,
  maxDistanceNm = 22,
}: {
  ownship: SceneOwnship;
  airport: SceneGeoPoint;
  runway: SceneRunway;
  destinationElevationFt?: number;
  activeRangeNm?: number;
  maxDistanceNm?: number;
}): VisionRunwayCue | null {
  const distanceNm = sceneGreatCircleNm(
    { latitude: ownship.lat, longitude: ownship.lon },
    airport,
  );
  if (distanceNm > maxDistanceNm) return null;

  const bearingToAirport = sceneBearingBetweenPoints(
    { latitude: ownship.lat, longitude: ownship.lon },
    airport,
  );
  const approachCourseErrorDeg = normalizeSceneHeadingDelta(bearingToAirport - runway.headingDeg);
  const alignmentDeltaDeg = normalizeSceneHeadingDelta(ownship.heading - runway.headingDeg);
  const distanceFactor = clampScene((activeRangeNm - Math.min(distanceNm, activeRangeNm)) / activeRangeNm, 0, 1);
  const widthPct = 10 + distanceFactor * 20;
  const heightPct = 3.5 + distanceFactor * 10;
  const leftCenterPct = 50 + clampScene(approachCourseErrorDeg * 0.72, -18, 18);
  const glideslopeTargetFt = destinationElevationFt + distanceNm * 318 + 50;
  const glideslopeErrorFt = ownship.altitudeFt - glideslopeTargetFt;
  const topCenterPct = clampScene(58 - distanceFactor * 18 + glideslopeErrorFt / 145, 23, 74);

  return {
    runwayId: runway.runwayId,
    distanceNm,
    alignmentDeltaDeg,
    leftPct: clampScene(leftCenterPct - widthPct / 2, 8, 92 - widthPct),
    topPct: clampScene(topCenterPct - heightPct / 2, 16, 82 - heightPct),
    widthPct,
    heightPct,
    centerlineLeftPct: leftCenterPct,
    centerlineTopPct: clampScene(topCenterPct - (10 + distanceFactor * 11), 14, 64),
    centerlineHeightPct: 10 + distanceFactor * 16,
    distanceLabel: `${distanceNm.toFixed(1)} NM`,
  };
}

export function buildDepartureRunwayCue({
  ownship,
  airport,
  runway,
  maxDistanceNm = 6,
}: {
  ownship: SceneOwnship;
  airport: SceneGeoPoint;
  runway: SceneRunway;
  maxDistanceNm?: number;
}): VisionRunwayCue | null {
  const distanceNm = sceneGreatCircleNm(
    { latitude: ownship.lat, longitude: ownship.lon },
    airport,
  );
  if (distanceNm > maxDistanceNm) return null;

  const alignmentDeltaDeg = normalizeSceneHeadingDelta(ownship.heading - runway.headingDeg);
  const distanceFactor = clampScene((maxDistanceNm - Math.min(distanceNm, maxDistanceNm)) / maxDistanceNm, 0, 1);
  const widthPct = 8 + distanceFactor * 20;
  const heightPct = 2.5 + distanceFactor * 9;
  const leftCenterPct = 50 - clampScene(alignmentDeltaDeg * 0.5, -12, 12);
  const topCenterPct = clampScene(67 - distanceFactor * 10 - ownship.altitudeFt / 700, 48, 74);

  return {
    runwayId: runway.runwayId,
    distanceNm,
    alignmentDeltaDeg,
    leftPct: clampScene(leftCenterPct - widthPct / 2, 8, 92 - widthPct),
    topPct: clampScene(topCenterPct - heightPct / 2, 18, 82 - heightPct),
    widthPct,
    heightPct,
    centerlineLeftPct: leftCenterPct,
    centerlineTopPct: clampScene(topCenterPct - (6 + distanceFactor * 10), 16, 70),
    centerlineHeightPct: 7 + distanceFactor * 14,
    distanceLabel: distanceNm < 1 ? `${(distanceNm * 6076).toFixed(0)} FT` : `${distanceNm.toFixed(1)} NM`,
  };
}

export function buildArrivalRunwayOverlay({
  airport,
  runway,
  approachLengthNm = 6.8,
  halfWidthNm = 0.12,
}: {
  airport: SceneGeoPoint;
  runway: SceneRunway;
  approachLengthNm?: number;
  halfWidthNm?: number;
}): RunwayOverlay {
  const reciprocal = (runway.headingDeg + 180) % 360;
  const finalApproachStart = offsetScenePointByBearing(
    { lat: airport.latitude, lon: airport.longitude },
    reciprocal,
    approachLengthNm,
  );
  const leftThreshold = offsetScenePointByBearing(
    { lat: airport.latitude, lon: airport.longitude },
    runway.headingDeg - 90,
    halfWidthNm,
  );
  const rightThreshold = offsetScenePointByBearing(
    { lat: airport.latitude, lon: airport.longitude },
    runway.headingDeg + 90,
    halfWidthNm,
  );

  return {
    runwayId: runway.runwayId,
    centerline: [
      { latitude: finalApproachStart.lat, longitude: finalApproachStart.lon },
      { latitude: airport.latitude, longitude: airport.longitude },
    ],
    runwayBar: [
      { latitude: leftThreshold.lat, longitude: leftThreshold.lon },
      { latitude: rightThreshold.lat, longitude: rightThreshold.lon },
    ],
  };
}

export function buildDepartureRunwayOverlay({
  airport,
  runway,
  departureLengthNm = 6.2,
  halfWidthNm = 0.12,
}: {
  airport: SceneGeoPoint;
  runway: SceneRunway;
  departureLengthNm?: number;
  halfWidthNm?: number;
}): RunwayOverlay {
  const runwayExit = offsetScenePointByBearing(
    { lat: airport.latitude, lon: airport.longitude },
    runway.headingDeg,
    departureLengthNm,
  );
  const leftThreshold = offsetScenePointByBearing(
    { lat: airport.latitude, lon: airport.longitude },
    runway.headingDeg - 90,
    halfWidthNm,
  );
  const rightThreshold = offsetScenePointByBearing(
    { lat: airport.latitude, lon: airport.longitude },
    runway.headingDeg + 90,
    halfWidthNm,
  );

  return {
    runwayId: runway.runwayId,
    centerline: [
      { latitude: airport.latitude, longitude: airport.longitude },
      { latitude: runwayExit.lat, longitude: runwayExit.lon },
    ],
    runwayBar: [
      { latitude: leftThreshold.lat, longitude: leftThreshold.lon },
      { latitude: rightThreshold.lat, longitude: rightThreshold.lon },
    ],
  };
}

export function buildVisionTerrainBands({
  terrainAheadFt,
  obstacleAheadFt,
}: {
  terrainAheadFt: number;
  obstacleAheadFt: number;
}): VisionTerrainBand[] {
  return [
    {
      d: `M 0 100 L 0 ${clampScene(76 - terrainAheadFt / 280, 38, 72)} C 12 ${clampScene(58 - obstacleAheadFt / 360, 28, 62)}, 24 ${clampScene(82 - terrainAheadFt / 320, 40, 78)}, 36 ${clampScene(70 - obstacleAheadFt / 350, 32, 66)} C 48 ${clampScene(60 - terrainAheadFt / 330, 28, 60)}, 60 ${clampScene(84 - obstacleAheadFt / 340, 44, 80)}, 72 ${clampScene(72 - terrainAheadFt / 310, 36, 70)} C 84 ${clampScene(64 - obstacleAheadFt / 360, 30, 64)}, 92 ${clampScene(80 - terrainAheadFt / 350, 42, 78)}, 100 ${clampScene(74 - terrainAheadFt / 420, 38, 76)} L 100 100 Z`,
      fill: 'rgba(94, 67, 41, 0.92)',
    },
    {
      d: `M 0 100 L 0 ${clampScene(86 - terrainAheadFt / 420, 56, 82)} C 18 ${clampScene(78 - obstacleAheadFt / 500, 50, 78)}, 36 ${clampScene(92 - terrainAheadFt / 520, 58, 88)}, 52 ${clampScene(82 - obstacleAheadFt / 480, 52, 80)} C 68 ${clampScene(72 - terrainAheadFt / 450, 46, 74)}, 84 ${clampScene(90 - obstacleAheadFt / 520, 58, 86)}, 100 ${clampScene(84 - terrainAheadFt / 460, 54, 84)} L 100 100 Z`,
      fill: 'rgba(58, 40, 23, 0.88)',
    },
  ];
}

export function buildVisionObstacleColumn({
  terrainAheadFt,
  obstacleAheadFt,
}: {
  terrainAheadFt: number;
  obstacleAheadFt: number;
}): VisionObstacleColumn {
  return {
    leftPct: clampScene(58 + (obstacleAheadFt - terrainAheadFt) / 140, 48, 74),
    topPct: clampScene(62 - obstacleAheadFt / 170, 34, 68),
    heightPct: clampScene(14 + obstacleAheadFt / 260, 18, 40),
  };
}

export function buildVisionTerrainColumns({
  samples,
  ownshipAltitudeFt,
  maxColumns = 14,
  keyPrefix = 'terrain-column',
}: {
  samples: SceneTerrainSample[];
  ownshipAltitudeFt: number;
  maxColumns?: number;
  keyPrefix?: string;
}): VisionTerrainColumn[] {
  if (!samples.length || !Number.isFinite(ownshipAltitudeFt)) return [];
  const maxElevation = Math.max(...samples.map((sample) => sample.elevationFt ?? 0), 1);
  return samples.slice(0, maxColumns).map((sample, index, arr) => {
    const elevation = sample.elevationFt ?? 0;
    const ratio = clampScene(elevation / Math.max(maxElevation, ownshipAltitudeFt), 0.08, 0.92);
    const clearanceFt = ownshipAltitudeFt - elevation;
    return {
      key: `${keyPrefix}-${index}`,
      leftPct: arr.length <= 1 ? 50 : (index / (arr.length - 1)) * 100,
      heightPct: clampScene(ratio * 68, 10, 60),
      risk:
        clearanceFt < 1000 ? 'warning' : clearanceFt < 2000 ? 'caution' : 'nominal',
    };
  });
}

export function buildVisionObstacleCues({
  ownship,
  obstacles,
  maxCues = 3,
}: {
  ownship: SceneOwnship;
  obstacles: SceneObstacle[];
  maxCues?: number;
}): VisionObstacleCue[] {
  if (!obstacles.length) return [];
  return obstacles.slice(0, maxCues).map((obstacle, index) => {
    const bearingToObstacle = sceneBearingBetweenPoints(
      { latitude: ownship.lat, longitude: ownship.lon },
      { latitude: obstacle.lat, longitude: obstacle.lon },
    );
    const bearingDelta = normalizeSceneHeadingDelta(bearingToObstacle - ownship.heading);
    const obstacleAltitudeFt = obstacle.amslFt ?? obstacle.aglFt ?? 0;
    const altitudeDeltaFt = obstacleAltitudeFt - ownship.altitudeFt;
    return {
      key: `vision-obstacle-${obstacle.id}-${index}`,
      xPct: clampScene(50 + bearingDelta / 2.2, 14, 86),
      yPct: clampScene(54 + altitudeDeltaFt / 180, 26, 76),
      risk: altitudeDeltaFt > -700 ? 'warning' : altitudeDeltaFt > -1500 ? 'caution' : 'nominal',
    };
  });
}

export function buildVisionTrafficCue({
  ownship,
  target,
  bearingRateDegPerMin = 0,
  distanceRateNmPerMin,
  closureText,
}: {
  ownship: SceneOwnship;
  target: SceneTrafficTarget;
  bearingRateDegPerMin?: number;
  distanceRateNmPerMin?: number | null;
  closureText?: string | null;
}): VisionTrafficCue {
  const bearingToTraffic = sceneBearingBetweenPoints(
    { latitude: ownship.lat, longitude: ownship.lon },
    { latitude: target.lat, longitude: target.lon },
  );
  const bearingDelta = normalizeSceneHeadingDelta(bearingToTraffic - ownship.heading);
  const absBearingDelta = Math.abs(bearingDelta);
  return {
    xPct: clampScene(50 + bearingDelta / 1.8, 18, 82),
    yPct: clampScene(48 - (target.altitudeDeltaFt ?? 0) / 220, 18, 72),
    threat: target.threatLevel,
    sector: describeSceneSector(bearingDelta),
    clock: describeSceneClock(bearingDelta),
    closureText:
      closureText ||
      (target.distanceNm <= 2 && absBearingDelta <= 35
        ? 'Converging'
        : target.distanceNm <= 4
          ? 'Near sector'
          : 'Monitor'),
    vectorDxPct: clampScene(bearingRateDegPerMin / 8, -8, 8),
    vectorDyPct:
      distanceRateNmPerMin == null
        ? 0
        : distanceRateNmPerMin < 0
          ? 8
          : distanceRateNmPerMin > 0
            ? -8
            : 0,
  };
}
