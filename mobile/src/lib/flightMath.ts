export type RoutePoint = {
  latitude: number;
  longitude: number;
  icao?: string | null;
};

export type MobileRouteLegType = 'departure' | 'enroute' | 'arrival' | 'direct-to';
export type MobileRouteLegProfile =
  | 'initial-departure'
  | 'departure-transition'
  | 'enroute'
  | 'arrival-transition'
  | 'final'
  | 'direct-to';

export type MobileRouteLeg = {
  index: number;
  from: string;
  to: string;
  nm: number;
  legType: MobileRouteLegType;
  label: string;
};

export type MobileRouteLegBehavior = {
  profile: MobileRouteLegProfile;
  legType: MobileRouteLegType;
  guidanceMode: 'departure' | 'track' | 'terminal' | 'direct';
  sequencingCaptureNm: number;
  annunciation: string;
};

export type MobileRouteTransitionRule = {
  profile: MobileRouteLegProfile;
  armAtLegProgressPct: number;
  openAtLegProgressPct: number;
  requiresLateralCapture: boolean;
  label: string;
};

export type MobileRouteExecutionSegmentKind =
  | 'runway-roll'
  | 'departure-climb'
  | 'enroute-track'
  | 'arrival-feed'
  | 'final-track'
  | 'direct-track';

export type MobileRouteExecutionSegment = {
  kind: MobileRouteExecutionSegmentKind;
  label: string;
  sequencingModel: 'auto' | 'managed';
};

export type MobileRouteExecutionTransitionClass =
  | 'pilot-advance'
  | 'course-capture'
  | 'terminal-capture'
  | 'direct-intercept';

export type MobileRouteExecutionTransition = {
  kind: MobileRouteExecutionTransitionClass;
  label: string;
};

export type MobileRouteExecutionPlanEntry = {
  index: number;
  legIndex: number;
  legLabel: string;
  legType: MobileRouteLegType;
  segment: MobileRouteExecutionSegment;
  transition: MobileRouteExecutionTransition;
};

export type MobileRouteExecutionPlanStatus =
  | 'completed'
  | 'active'
  | 'armed'
  | 'managed-open'
  | 'queued';

export type MobileRouteExecutionPlanViewEntry = MobileRouteExecutionPlanEntry & {
  status: MobileRouteExecutionPlanStatus;
  actionCue: string;
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
  activeWaypoint: string | null;
  destinationWaypoint: string | null;
  activeLegLabel: string | null;
  nextLegLabel: string | null;
  destinationLegLabel: string | null;
  activeLegNm: number;
  remainingLegNm: number;
  legProgressPct: number;
  completedLegs: number;
  legsRemaining: number;
  sequencingState: 'on-leg' | 'terminal' | 'reintercept';
  etaText: string | null;
};

type MobileRouteExecutionOptions = {
  activeLegIndex?: number | null;
};

export function buildMobileRouteLegs<T extends RoutePoint>(
  routePoints: T[],
  options?: { mode?: 'planned' | 'direct-to' },
): MobileRouteLeg[] {
  if (routePoints.length < 2) return [];

  return routePoints.slice(0, -1).map((point, index) => {
    const next = routePoints[index + 1];
    const lastLegIndex = routePoints.length - 2;
    const legType: MobileRouteLegType =
      options?.mode === 'direct-to'
        ? 'direct-to'
        : index === 0
          ? 'departure'
          : index === lastLegIndex
            ? 'arrival'
            : 'enroute';
    const from = point.icao || `PT${index + 1}`;
    const to = next.icao || `PT${index + 2}`;
    return {
      index,
      from,
      to,
      nm: greatCircleNm(point, next),
      legType,
      label: `${from} -> ${to}`,
    };
  });
}

export function getMobileRouteLegBehavior(
  leg: Pick<MobileRouteLeg, 'legType' | 'from' | 'to'> | null | undefined,
  options?: { legProgressPct?: number | null; remainingRouteNm?: number | null },
): MobileRouteLegBehavior {
  const legType = leg?.legType || 'enroute';
  const legProgressPct = options?.legProgressPct ?? 0;
  const remainingRouteNm = options?.remainingRouteNm ?? Number.POSITIVE_INFINITY;
  switch (legType) {
    case 'departure':
      if (legProgressPct < 35) {
        return {
          profile: 'initial-departure',
          legType,
          guidanceMode: 'departure',
          sequencingCaptureNm: 1.8,
          annunciation: `Run outbound ${leg?.to || '--'}`,
        };
      }
      return {
        profile: 'departure-transition',
        legType,
        guidanceMode: 'departure',
        sequencingCaptureNm: 1.4,
        annunciation: `Climb via ${leg?.to || '--'}`,
      };
    case 'arrival':
      if (remainingRouteNm <= 12 || legProgressPct >= 65) {
        return {
          profile: 'final',
          legType,
          guidanceMode: 'terminal',
          sequencingCaptureNm: 0.65,
          annunciation: `Final ${leg?.to || '--'}`,
        };
      }
      return {
        profile: 'arrival-transition',
        legType,
        guidanceMode: 'terminal',
        sequencingCaptureNm: 0.9,
        annunciation: `Arrival leg ${leg?.to || '--'}`,
      };
    case 'direct-to':
      return {
        profile: 'direct-to',
        legType,
        guidanceMode: 'direct',
        sequencingCaptureNm: 1.2,
        annunciation: `Direct ${leg?.to || '--'}`,
      };
    case 'enroute':
    default:
      return {
        profile: 'enroute',
        legType: 'enroute',
        guidanceMode: 'track',
        sequencingCaptureNm: 1.1,
        annunciation: `Track ${leg?.to || '--'}`,
      };
  }
}

export function getMobileRouteTransitionRule(
  profile: MobileRouteLegProfile,
): MobileRouteTransitionRule {
  switch (profile) {
    case 'initial-departure':
      return {
        profile,
        armAtLegProgressPct: 58,
        openAtLegProgressPct: 88,
        requiresLateralCapture: false,
        label: 'Departure rollout gate',
      };
    case 'departure-transition':
      return {
        profile,
        armAtLegProgressPct: 64,
        openAtLegProgressPct: 86,
        requiresLateralCapture: false,
        label: 'Departure transition gate',
      };
    case 'arrival-transition':
      return {
        profile,
        armAtLegProgressPct: 58,
        openAtLegProgressPct: 78,
        requiresLateralCapture: true,
        label: 'Arrival transition gate',
      };
    case 'final':
      return {
        profile,
        armAtLegProgressPct: 48,
        openAtLegProgressPct: 68,
        requiresLateralCapture: true,
        label: 'Final sequencing gate',
      };
    case 'direct-to':
      return {
        profile,
        armAtLegProgressPct: 66,
        openAtLegProgressPct: 90,
        requiresLateralCapture: false,
        label: 'Direct-to gate',
      };
    case 'enroute':
    default:
      return {
        profile: 'enroute',
        armAtLegProgressPct: 70,
        openAtLegProgressPct: 90,
        requiresLateralCapture: false,
        label: 'Enroute sequencing gate',
      };
  }
}

export function getMobileRouteExecutionSegment(
  profile: MobileRouteLegProfile,
  options?: { sequenceGateState?: 'blocked' | 'armed' | 'open' | 'hold' },
): MobileRouteExecutionSegment {
  const gateState = options?.sequenceGateState || 'blocked';
  switch (profile) {
    case 'initial-departure':
      return {
        kind: 'runway-roll',
        label: gateState === 'open' ? 'Departure release' : 'Runway rollout',
        sequencingModel: 'managed',
      };
    case 'departure-transition':
      return {
        kind: 'departure-climb',
        label: gateState === 'armed' ? 'Departure climb armed' : 'Departure climb',
        sequencingModel: 'auto',
      };
    case 'arrival-transition':
      return {
        kind: 'arrival-feed',
        label: gateState === 'armed' ? 'Arrival feed armed' : 'Arrival feed',
        sequencingModel: 'auto',
      };
    case 'final':
      return {
        kind: 'final-track',
        label: gateState === 'open' ? 'Final track open' : 'Final track',
        sequencingModel: 'auto',
      };
    case 'direct-to':
      return {
        kind: 'direct-track',
        label: gateState === 'hold' ? 'Direct hold' : 'Direct track',
        sequencingModel: 'managed',
      };
    case 'enroute':
    default:
      return {
        kind: 'enroute-track',
        label: gateState === 'armed' ? 'Enroute track armed' : 'Enroute track',
        sequencingModel: 'auto',
      };
  }
}

export function getMobileRouteExecutionTransition(
  profile: MobileRouteLegProfile,
): MobileRouteExecutionTransition {
  switch (profile) {
    case 'initial-departure':
      return {
        kind: 'pilot-advance',
        label: 'Pilot advance',
      };
    case 'departure-transition':
    case 'enroute':
      return {
        kind: 'course-capture',
        label: 'Course capture',
      };
    case 'arrival-transition':
    case 'final':
      return {
        kind: 'terminal-capture',
        label: 'Terminal capture',
      };
    case 'direct-to':
      return {
        kind: 'direct-intercept',
        label: 'Direct intercept',
      };
    default:
      return {
        kind: 'course-capture',
        label: 'Course capture',
      };
  }
}

export function buildMobileRouteExecutionPlan(
  legs: MobileRouteLeg[],
): MobileRouteExecutionPlanEntry[] {
  return legs.map((leg) => {
    const profile: MobileRouteLegProfile =
      leg.legType === 'departure'
        ? 'departure-transition'
        : leg.legType === 'arrival'
          ? 'arrival-transition'
          : leg.legType === 'direct-to'
            ? 'direct-to'
            : 'enroute';
    return {
      index: leg.index,
      legIndex: leg.index,
      legLabel: leg.label,
      legType: leg.legType,
      segment: getMobileRouteExecutionSegment(profile, { sequenceGateState: 'blocked' }),
      transition: getMobileRouteExecutionTransition(profile),
    };
  });
}

export function annotateMobileRouteExecutionPlan(
  plan: MobileRouteExecutionPlanEntry[],
  options: {
    activeLegIndex: number;
    nextLegArmed?: boolean;
    sequencingSuspended?: boolean;
    sequenceGateState?: 'blocked' | 'armed' | 'open' | 'manual-open' | 'hold';
  },
): MobileRouteExecutionPlanViewEntry[] {
  return plan.map((entry) => {
    let status: MobileRouteExecutionPlanStatus = 'queued';
    if (entry.legIndex < options.activeLegIndex) {
      status = 'completed';
    } else if (entry.legIndex === options.activeLegIndex) {
      status = options.sequenceGateState === 'manual-open' ? 'managed-open' : 'active';
    } else if (entry.legIndex === options.activeLegIndex + 1 && options.nextLegArmed) {
      status = 'armed';
    }

    const actionCue =
      status === 'completed'
        ? 'Completed'
        : status === 'active'
          ? options.sequencingSuspended
            ? 'Active - sequencing hold'
            : 'Active'
          : status === 'managed-open'
            ? 'Awaiting pilot advance'
            : status === 'armed'
              ? 'Armed next'
              : 'Queued';

    return {
      ...entry,
      status,
      actionCue,
    };
  });
}

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
  options?: MobileRouteExecutionOptions,
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

  const evaluateLeg = (index: number, traveledBeforeLeg: number) => {
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

    return { legIndex: index, offRouteNm, crossTrackNm, traveledNm, desiredTrackDeg };
  };

  const preferredLegIndex =
    typeof options?.activeLegIndex === 'number' && Number.isFinite(options.activeLegIndex)
      ? Math.min(Math.max(0, Math.round(options.activeLegIndex)), routePoints.length - 2)
      : null;

  if (preferredLegIndex != null) {
    const traveledBeforeLeg = legLengths.slice(0, preferredLegIndex).reduce((sum, value) => sum + value, 0);
    best = evaluateLeg(preferredLegIndex, traveledBeforeLeg);
  } else {
    let traveledBeforeLeg = 0;
    for (let index = 0; index < routePoints.length - 1; index += 1) {
      const candidate = evaluateLeg(index, traveledBeforeLeg);

      if (!best || candidate.offRouteNm < best.offRouteNm) {
        best = candidate;
      }
      traveledBeforeLeg += legLengths[index] ?? 0;
    }
  }

  if (!best) return null;

  const remainingRouteNm = Math.max(0, totalRouteNm - best.traveledNm);
  const activeStart = routePoints[best.legIndex] || null;
  const activeEnd = routePoints[best.legIndex + 1] || routePoints[routePoints.length - 1] || null;
  const nextStart = routePoints[best.legIndex + 1] || null;
  const nextEnd = routePoints[best.legIndex + 2] || null;
  const destinationStart = routePoints[routePoints.length - 2] || null;
  const destinationEnd = routePoints[routePoints.length - 1] || null;
  const activeLegNm = legLengths[best.legIndex] ?? 0;
  const legStartNm = legLengths.slice(0, best.legIndex).reduce((sum, value) => sum + value, 0);
  const traveledOnActiveLegNm = Math.max(0, best.traveledNm - legStartNm);
  const remainingLegNm = Math.max(0, activeLegNm - traveledOnActiveLegNm);
  const activeLegProgressPct =
    activeLegNm > 0 ? Math.min(100, Math.max(0, ((activeLegNm - remainingLegNm) / activeLegNm) * 100)) : 0;
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
    activeWaypoint: activeStart?.icao || null,
    nextWaypoint: routePoints[best.legIndex + 1]?.icao || routePoints[routePoints.length - 1]?.icao || null,
    destinationWaypoint: routePoints[routePoints.length - 1]?.icao || null,
    activeLegLabel:
      activeStart?.icao && activeEnd?.icao ? `${activeStart.icao} -> ${activeEnd.icao}` : activeEnd?.icao || activeStart?.icao || null,
    nextLegLabel:
      nextStart?.icao && nextEnd?.icao ? `${nextStart.icao} -> ${nextEnd.icao}` : nextEnd?.icao || null,
    destinationLegLabel:
      destinationStart?.icao && destinationEnd?.icao
        ? `${destinationStart.icao} -> ${destinationEnd.icao}`
        : destinationEnd?.icao || null,
    activeLegNm,
    remainingLegNm,
    legProgressPct: activeLegProgressPct,
    completedLegs: best.legIndex,
    legsRemaining: Math.max(0, legLengths.length - best.legIndex - 1),
    sequencingState:
      best.offRouteNm > 1.5 ? 'reintercept' : best.legIndex >= legLengths.length - 1 ? 'terminal' : 'on-leg',
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
      const threatLevel: 'immediate' | 'advisory' | 'monitor' =
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
