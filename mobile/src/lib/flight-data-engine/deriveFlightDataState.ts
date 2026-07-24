import { getFlightDeckSourceArbitrationState } from '../sourceArbitration';
import { deriveFlightDeckSourceHealth, expireFlightDeckTrafficTargets } from '../flightDeckSafety';
import {
  buildMobileRouteLegs,
  clamp,
  computeMobileRouteProgress,
  getDistanceNmFromLatLon,
  getMobileRouteLegBehavior,
  getMobileRouteProcedureContext,
  getMobileRouteProcedureEntryRole,
  getMobileRouteProcedureExecutionProfile,
  getMobileRouteProcedureRoleExecutionPolicy,
  normalizeHeadingDelta,
  rankTrafficTargets,
} from '../flightMath';
import type { ActiveDirectToState, FlightOperationalPhase } from '../activeFlightSession';
import type {
  EngineRoutePoint,
  FlightDataEngineInput,
  FlightDataEngineOutput,
  FlightDataTransitionProposal,
} from './types';

function restoreRoutePoint(point: ActiveDirectToState['origin']): EngineRoutePoint {
  return {
    icao: point.icao,
    name: point.name || point.icao,
    latitude: point.latitude,
    longitude: point.longitude,
  };
}

function buildActiveRoutePoints(input: FlightDataEngineInput) {
  const directTo = input.session?.navigation.directTo || null;
  if (directTo) return [restoreRoutePoint(directTo.origin), restoreRoutePoint(directTo.target)];
  if (input.routePoints.length) return input.routePoints;
  return input.routeSnapshot?.points || [];
}

function derivePhase(input: {
  ownship: FlightDataEngineOutput['source']['ownship'];
  progress: FlightDataEngineOutput['navigation']['progress'];
  plannedAltitudeFt?: number | null;
  simulationAltitudeFt?: number | null;
}): FlightDataEngineOutput['navigation']['phase'] {
  if (!input.ownship) {
    return {
      stage: 'preflight',
      label: 'Preflight',
      detail: 'Build a route and connect a live source to start active guidance.',
    };
  }
  const speedKts = input.ownship.speedKts ?? 0;
  const altitudeFt = input.ownship.altitudeFt ?? 0;
  const progressPct = input.progress?.progressPct ?? 0;
  const remainingRouteNm = input.progress?.remainingRouteNm ?? Number.POSITIVE_INFINITY;
  const targetCruiseAltitudeFt = input.plannedAltitudeFt || input.simulationAltitudeFt || 6500;
  const cruiseCaptureFloorFt = Math.max(targetCruiseAltitudeFt * 0.88, targetCruiseAltitudeFt - 1500);

  if (progressPct >= 95 && speedKts < 45) {
    return { stage: 'taxi-in', label: 'Taxi in', detail: 'Arrival rollout complete. Surface guidance should favor ramp and parking flow.' };
  }
  if (remainingRouteNm <= 12) {
    return { stage: 'final', label: 'Final', detail: 'Runway environment should be primary with final-alignment and rollout cues.' };
  }
  if (progressPct > 78 || remainingRouteNm < 35) {
    return { stage: 'arrival', label: 'Arrival', detail: 'Arrival corridor is active. Tighten runway, terrain, and diversion awareness.' };
  }
  if (progressPct > 58 && altitudeFt < cruiseCaptureFloorFt) {
    return { stage: 'descent', label: 'Descent', detail: 'Manage descent path, terrain clearance, and arrival setup.' };
  }
  if (altitudeFt >= cruiseCaptureFloorFt && progressPct >= 25 && progressPct <= 72) {
    return { stage: 'cruise', label: 'Cruise', detail: 'Enroute tactical scan is primary. Traffic, weather, and route execution should dominate.' };
  }
  if (progressPct < 25 && altitudeFt < cruiseCaptureFloorFt && speedKts >= 85) {
    return { stage: 'climb', label: 'Climb', detail: 'Initial climb is active. Terrain, obstacle, and departure corridor cues should stay elevated.' };
  }
  if (progressPct < 10 && speedKts >= 45) {
    return { stage: 'departure', label: 'Departure', detail: 'Runway departure and initial corridor capture should be primary.' };
  }
  if (progressPct < 6 && speedKts < 45) {
    return { stage: 'taxi-out', label: 'Taxi out', detail: 'Surface movement and hold-short guidance should be primary.' };
  }
  return { stage: 'climb', label: 'Climb', detail: 'Flight is transitioning from terminal to enroute guidance.' };
}

function deriveSequencingProposal(input: {
  ownship: FlightDataEngineOutput['source']['ownship'];
  routePoints: EngineRoutePoint[];
  activeLegIndex: number;
  progress: FlightDataEngineOutput['navigation']['progress'];
  sequencingSuspended: boolean;
}): FlightDataTransitionProposal | null {
  const { ownship, progress, routePoints, activeLegIndex, sequencingSuspended } = input;
  if (!ownship || !progress || routePoints.length < 2) return null;
  const currentLegIndex = Math.min(activeLegIndex, routePoints.length - 2);
  if (currentLegIndex !== progress.legIndex) return null;
  if (currentLegIndex >= routePoints.length - 2) return null;
  if (progress.sequencingState === 'reintercept') return null;
  if (sequencingSuspended) return null;

  const activeLegEnd = routePoints[currentLegIndex + 1];
  if (!activeLegEnd) return null;

  const activeLeg = buildMobileRouteLegs(routePoints)[currentLegIndex] || null;
  const activeLegBehavior = getMobileRouteLegBehavior(activeLeg, {
    legProgressPct: progress.legProgressPct,
    remainingRouteNm: progress.remainingRouteNm,
  });
  const procedureContext = getMobileRouteProcedureContext(activeLegBehavior.profile).kind;
  const procedureProfile = getMobileRouteProcedureExecutionProfile(procedureContext);
  const rolePolicy = getMobileRouteProcedureRoleExecutionPolicy(
    getMobileRouteProcedureEntryRole(procedureContext, { entryIndexInChain: 0, entryCount: 1 }).kind
  );
  const desiredTrack = progress.desiredTrackDeg ?? 0;
  const headingDelta = normalizeHeadingDelta(desiredTrack - (ownship.heading ?? desiredTrack));
  const lateralCaptured = Math.abs(progress.crossTrackNm) < 0.25 && Math.abs(headingDelta) < 5;
  const distanceToLegEndNm = getDistanceNmFromLatLon(
    { lat: ownship.lat, lon: ownship.lon },
    { lat: activeLegEnd.latitude, lon: activeLegEnd.longitude }
  );
  const speedCaptureNm = Math.max(0.45, Math.min(2.4, (ownship.speedKts ?? 90) / 120));
  const sequencingCaptureNm = Math.max(activeLegBehavior.sequencingCaptureNm, speedCaptureNm * 0.75);
  const armingProgressPct = clamp(procedureProfile.armAtProgressPct + rolePolicy.armBiasPct, 30, 96);
  const openProgressPct = clamp(procedureProfile.openAtProgressPct + rolePolicy.openBiasPct, 40, 99);
  const gateArmed = progress.legProgressPct >= armingProgressPct || progress.remainingLegNm <= sequencingCaptureNm * 1.35;
  const gateOpenByProgress =
    progress.legProgressPct >= openProgressPct ||
    progress.remainingLegNm <= sequencingCaptureNm * 0.85 ||
    distanceToLegEndNm <= sequencingCaptureNm;
  const lateralReady = !procedureProfile.requiresLateralCapture || lateralCaptured;
  const shouldAdvance = gateArmed && gateOpenByProgress && lateralReady && rolePolicy.sequencingModel === 'auto';
  if (!shouldAdvance) return null;
  return {
    type: 'sequence-active-leg',
    activeLegIndex: Math.min(currentLegIndex + 1, routePoints.length - 2),
    reason: 'auto-sequence',
  };
}

export function deriveFlightDataState(input: FlightDataEngineInput): FlightDataEngineOutput {
  const sourceHealth = deriveFlightDeckSourceHealth({
    nowMs: input.nowMs,
    simulationEnabled: input.simulation.active,
    simulationOwnshipAvailable: Boolean(input.simulation.ownship),
    receiverOwnshipUpdatedAt: input.receiver.ownship?.updatedAt,
    receiverAttitudeUpdatedAt: input.receiver.attitude?.updatedAt,
    gpsOwnshipUpdatedAt: input.deviceGps?.updatedAt,
    receiverHealth: input.receiver.health,
  });
  const ownship = input.simulation.active && input.simulation.ownship
    ? input.simulation.ownship
    : sourceHealth.receiverOwnshipFresh && input.receiver.ownship
      ? {
          ...input.receiver.ownship,
          heading:
            sourceHealth.receiverAttitudeFresh && typeof input.receiver.attitude?.headingDeg === 'number'
              ? input.receiver.attitude.headingDeg
              : input.receiver.ownship.heading,
        }
      : sourceHealth.gpsOwnshipFresh && input.deviceGps
        ? input.deviceGps
        : null;
  const attitude = input.simulation.active && input.simulation.attitude
    ? input.simulation.attitude
    : sourceHealth.receiverAttitudeFresh
      ? input.receiver.attitude
      : null;
  const arbitration = getFlightDeckSourceArbitrationState({
    simulationEnabled: input.simulation.active,
    receiverOwnshipFresh: sourceHealth.receiverOwnshipFresh,
    receiverAttitudeFresh: sourceHealth.receiverAttitudeFresh,
    gpsOwnshipFresh: sourceHealth.gpsOwnshipFresh,
    receiverHealthy: input.receiver.health?.status === 'healthy',
    deviceMotionActive: false,
  });
  const activeRoutePoints = buildActiveRoutePoints(input);
  const directToActive = Boolean(input.session?.navigation.directTo);
  const routeLegs = buildMobileRouteLegs(activeRoutePoints, { mode: directToActive ? 'direct-to' : 'planned' });
  const activeLegIndex = Math.max(
    0,
    Math.min(
      input.session?.navigation.activeLegIndex ?? input.navigation?.activeLegIndex ?? 0,
      Math.max(0, activeRoutePoints.length - 2)
    )
  );
  const progress = computeMobileRouteProgress(activeRoutePoints, ownship, { activeLegIndex });
  const activeLeg = routeLegs[Math.min(activeLegIndex, Math.max(0, routeLegs.length - 1))] || null;
  const phase = derivePhase({
    ownship,
    progress,
    plannedAltitudeFt: input.configuration?.plannedAltitudeFt,
    simulationAltitudeFt: input.configuration?.simulationAltitudeFt,
  });
  const tacticalTargets = input.simulation.active
    ? input.simulation.trafficTargets
    : expireFlightDeckTrafficTargets(input.trafficTargets, input.nowMs, input.configuration?.trafficStaleMs);
  const rankedTargets = rankTrafficTargets(tacticalTargets, ownship);
  const transitionProposals: FlightDataTransitionProposal[] = [];
  const sequenceProposal = deriveSequencingProposal({
    ownship,
    progress,
    routePoints: activeRoutePoints,
    activeLegIndex,
    sequencingSuspended: input.session?.navigation.sequencingSuspended ?? input.navigation?.sequencingSuspended ?? false,
  });
  if (sequenceProposal) transitionProposals.push(sequenceProposal);
  if (input.session && input.session.phase !== phase.stage) {
    transitionProposals.push({ type: 'phase-change', phase: phase.stage as FlightOperationalPhase });
  }
  const alerts: FlightDataEngineOutput['alerts'] = [];
  if (!ownship && input.session?.status === 'active') {
    alerts.push({ id: 'ownship-missing', level: 'caution', message: 'No current ownship source is available.' });
  }
  if (rankedTargets.some((target) => target.threatLevel === 'immediate')) {
    alerts.push({ id: 'traffic-immediate', level: 'warning', message: 'Immediate traffic target in conflict band.' });
  }

  return {
    source: {
      health: sourceHealth,
      arbitration,
      ownship,
      attitude,
      receiverOwnshipFresh: sourceHealth.receiverOwnshipFresh,
      receiverAttitudeFresh: sourceHealth.receiverAttitudeFresh,
      gpsOwnshipFresh: sourceHealth.gpsOwnshipFresh,
    },
    route: {
      points: activeRoutePoints,
      legs: routeLegs,
      directToActive,
      totalNm: input.routeTotalNm ?? input.routeSnapshot?.totalNm ?? null,
    },
    navigation: {
      activeLegIndex,
      progress,
      activeLeg,
      phase,
    },
    traffic: {
      tacticalTargets,
      rankedTargets,
      immediateCount: rankedTargets.filter((target) => target.threatLevel === 'immediate').length,
    },
    transitionProposals,
    alerts,
  };
}
