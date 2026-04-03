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
  courseDeg: number | null;
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

export type MobileRouteProcedureClass =
  | 'departure-procedure'
  | 'enroute-structure'
  | 'arrival-procedure'
  | 'final-approach'
  | 'direct-navigation';

export type MobileRouteProcedureContext = {
  kind: MobileRouteProcedureClass;
  label: string;
};

export type MobileRouteProcedureHandoffClass =
  | 'pilot-advance'
  | 'auto-course-handoff'
  | 'terminal-feed-handoff'
  | 'final-capture-handoff'
  | 'direct-resume';

export type MobileRouteProcedureHandoff = {
  kind: MobileRouteProcedureHandoffClass;
  label: string;
};

export type MobileRouteExecutionPlanEntry = {
  index: number;
  legIndex: number;
  legLabel: string;
  legType: MobileRouteLegType;
  fromFix: string;
  toFix: string;
  distanceNm: number;
  courseDeg: number | null;
  navDataPayload: MobileRouteNavDataLegPayload | null;
  segment: MobileRouteExecutionSegment;
  transition: MobileRouteExecutionTransition;
  procedure: MobileRouteProcedureContext;
  handoff: MobileRouteProcedureHandoff;
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
  procedureRole: MobileRouteProcedureEntryRole;
  procedureEntryDescriptor: MobileRouteProcedureEntryDescriptor;
};

export type MobileRouteProcedureChain = {
  index: number;
  kind: MobileRouteProcedureClass;
  label: string;
  startLegIndex: number;
  endLegIndex: number;
  entryCount: number;
};

export type MobileRouteProcedureChainBehavior = {
  kind: MobileRouteProcedureClass;
  sequencingModel: 'managed' | 'auto';
  armingMode: 'pilot' | 'monitor' | 'terminal' | 'final' | 'direct';
  label: string;
};

export type MobileRouteProcedureTemplate = {
  kind: MobileRouteProcedureClass;
  label: string;
  behavior: MobileRouteProcedureChainBehavior;
  gateSubject: string;
  transitionCalls: {
    armed?: string;
    rollout?: string;
    established: string;
    intercept: string;
    capture?: string;
  };
  nextLegAutoLabel: string;
  nextLegManagedLabel: string;
};

export type MobileRouteProcedureExecutionProfile = {
  kind: MobileRouteProcedureClass;
  label: string;
  behavior: MobileRouteProcedureChainBehavior;
  template: MobileRouteProcedureTemplate;
  armAtProgressPct: number;
  openAtProgressPct: number;
  requiresLateralCapture: boolean;
};

export type MobileRouteProcedureCueStack = {
  kind: MobileRouteProcedureClass;
  label: string;
  modeLabel: string;
  sequencingSummary: string;
  gateCalls: {
    blocked: string;
    armed: string;
    open: string;
    manualOpen: string;
    hold: string;
  };
  transitionCalls: {
    intercept: string;
    capture: string;
    established: string;
    armed?: string;
    rollout?: string;
    hold: string;
  };
  nextLegAutoLabel: string;
  nextLegManagedLabel: string;
};

export type MobileRouteProcedureEntryRoleKind =
  | 'departure-anchor'
  | 'departure-transition'
  | 'enroute-join'
  | 'enroute-structure'
  | 'arrival-feed'
  | 'arrival-handoff'
  | 'final-capture'
  | 'direct-intercept';

export type MobileRouteProcedureEntryRole = {
  kind: MobileRouteProcedureEntryRoleKind;
  label: string;
  cue: string;
};

export type MobileRouteProcedureRoleCueProfile = {
  kind: MobileRouteProcedureEntryRoleKind;
  label: string;
  gateSubject: string;
  sequencingSummary: string;
  transitionCalls: {
    intercept: string;
    capture: string;
    established: string;
    armed?: string;
    rollout?: string;
    hold: string;
  };
};

export type MobileRouteProcedureRoleExecutionPolicy = {
  kind: MobileRouteProcedureEntryRoleKind;
  sequencingModel: 'managed' | 'auto';
  armBiasPct: number;
  openBiasPct: number;
  manualReason: string | null;
};

export type MobileRouteProcedureSegmentTemplateKind =
  | 'departure-anchor-segment'
  | 'departure-transition-segment'
  | 'enroute-join-segment'
  | 'enroute-structure-segment'
  | 'arrival-feed-segment'
  | 'arrival-handoff-segment'
  | 'final-capture-segment'
  | 'direct-resume-segment';

export type MobileRouteProcedureSegmentTemplate = {
  kind: MobileRouteProcedureSegmentTemplateKind;
  label: string;
  phaseLabel: string;
  segmentCue: string;
};

export type MobileRouteProcedureSegmentClassKind =
  | 'runway-anchor'
  | 'climb-transition'
  | 'enroute-join'
  | 'enroute-structure'
  | 'terminal-feed'
  | 'terminal-handoff'
  | 'final-capture'
  | 'direct-resume';

export type MobileRouteProcedureSegmentClass = {
  kind: MobileRouteProcedureSegmentClassKind;
  label: string;
  lateralMode: 'managed' | 'course-capture' | 'terminal-capture' | 'final-capture' | 'direct-intercept';
  terminalArea: boolean;
  procedureReady: boolean;
};

export type MobileRouteProcedureLegAdapterKind =
  | 'runway-leg'
  | 'course-leg'
  | 'terminal-leg'
  | 'final-leg'
  | 'direct-leg';

export type MobileRouteProcedureLegAdapter = {
  kind: MobileRouteProcedureLegAdapterKind;
  label: string;
  navDataReady: boolean;
  adapterCue: string;
};

export type MobileRouteProcedureLegFamilyKind =
  | 'runway-family'
  | 'course-to-fix-family'
  | 'terminal-feed-family'
  | 'final-capture-family'
  | 'direct-resume-family';

export type MobileRouteProcedureLegFamily = {
  kind: MobileRouteProcedureLegFamilyKind;
  label: string;
  parserReady: boolean;
  familyCue: string;
};

export type MobileRouteProcedureLegParserTargetKind =
  | 'runway-release-target'
  | 'course-fix-target'
  | 'terminal-feed-target'
  | 'final-capture-target'
  | 'direct-resume-target';

export type MobileRouteProcedureLegParserTarget = {
  kind: MobileRouteProcedureLegParserTargetKind;
  label: string;
  source: 'route-chain' | 'route-structure' | 'briefing-data' | 'nav-data';
  requiredFields: string[];
  parserCue: string;
};

export type MobileRouteProcedureLegIngestionContract = {
  kind: MobileRouteProcedureLegParserTargetKind;
  label: string;
  source: 'route-chain' | 'route-structure' | 'briefing-data' | 'nav-data';
  payloadShape: string;
  requiredFields: string[];
  optionalFields: string[];
};

export type MobileRouteNavDataLegPayload =
  | {
      kind: 'course-fix-nav-data';
      sourceKind: 'route-structure' | 'nav-data';
      label: string;
      fromFix: string;
      toFix: string;
      courseDeg: number | null;
      distanceNm: number | null;
      altitudeConstraintFt: number | null;
      sourceCycle: string | null;
    }
  | {
      kind: 'runway-release-nav-data';
      sourceKind: 'briefing-data' | 'nav-data';
      label: string;
      airportIdent: string;
      runwayIdent: string;
      releaseHeading: number | null;
      initialAltitudeFt: number | null;
      sourceCycle: string | null;
    }
  | {
      kind: 'terminal-feed-nav-data';
      sourceKind: 'briefing-data' | 'nav-data';
      label: string;
      arrivalIdent: string;
      transitionFix: string;
      handoffFix: string;
      altitudeConstraintFt: number | null;
      sourceCycle: string | null;
    }
  | {
      kind: 'final-capture-nav-data';
      sourceKind: 'briefing-data' | 'nav-data';
      label: string;
      runwayIdent: string;
      finalCourseDeg: number | null;
      thresholdFix: string;
      glideslopeAngleDeg: number | null;
      sourceCycle: string | null;
    };

export type MobileRouteProcedureParsedLegPayload =
  | {
      kind: 'runway-release-payload';
      label: string;
      source: 'route-chain' | 'route-structure' | 'briefing-data' | 'nav-data';
      runwayIdent: string;
      airportIdent: string;
      releaseHeading: number | null;
      initialAltitudeFt: number | null;
    }
  | {
      kind: 'course-to-fix-payload';
      label: string;
      source: 'route-chain' | 'route-structure' | 'briefing-data' | 'nav-data';
      fromFix: string;
      toFix: string;
      courseDeg: number | null;
      distanceNm: number | null;
      altitudeConstraintFt: number | null;
    }
  | {
      kind: 'terminal-feed-payload';
      label: string;
      source: 'route-chain' | 'route-structure' | 'briefing-data' | 'nav-data';
      arrivalIdent: string;
      transitionFix: string;
      handoffFix: string;
      altitudeConstraintFt: number | null;
    }
  | {
      kind: 'final-capture-payload';
      label: string;
      source: 'route-chain' | 'route-structure' | 'briefing-data' | 'nav-data';
      runwayIdent: string;
      finalCourseDeg: number | null;
      thresholdFix: string;
      glideslopeAngleDeg: number | null;
    }
  | {
      kind: 'direct-resume-payload';
      label: string;
      source: 'route-chain' | 'route-structure' | 'briefing-data' | 'nav-data';
      originFix: string;
      targetFix: string;
      resumeFix: string | null;
      resumeCourseDeg: number | null;
    };

export type MobileRouteProcedureEntryDescriptor = {
  role: MobileRouteProcedureEntryRole;
  cueProfile: MobileRouteProcedureRoleCueProfile;
  executionPolicy: MobileRouteProcedureRoleExecutionPolicy;
  segmentTemplate: MobileRouteProcedureSegmentTemplate;
  segmentClass: MobileRouteProcedureSegmentClass;
  procedureLegAdapter: MobileRouteProcedureLegAdapter;
  procedureLegFamily: MobileRouteProcedureLegFamily;
  procedureLegParserTarget: MobileRouteProcedureLegParserTarget;
  procedureLegIngestionContract: MobileRouteProcedureLegIngestionContract;
  parsedLegPayload: MobileRouteProcedureParsedLegPayload | null;
  entryIndexInChain: number;
  entryCount: number;
  positionLabel: string;
};

export type MobileRouteProcedureEntryTransitionBehavior = {
  kind:
    | 'anchor-release'
    | 'climb-handoff'
    | 'structure-join'
    | 'structure-manage'
    | 'arrival-feed'
    | 'arrival-handoff'
    | 'final-capture'
    | 'direct-resume';
  label: string;
  sequencingCue: string;
  handoffCue: string;
  nextAction: 'pilot-advance' | 'auto-advance';
};

export type MobileRouteProcedureTransitionTable = {
  kind: MobileRouteProcedureClass;
  label: string;
  activeRoleKind: MobileRouteProcedureEntryRoleKind;
  nextRoleKind: MobileRouteProcedureEntryRoleKind | null;
  handoffPathLabel: string;
  nextAction: 'pilot-advance' | 'auto-advance';
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
      courseDeg: bearingBetweenPoints(point, next),
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

export function getMobileRouteProcedureContext(
  profile: MobileRouteLegProfile,
): MobileRouteProcedureContext {
  switch (profile) {
    case 'initial-departure':
    case 'departure-transition':
      return {
        kind: 'departure-procedure',
        label: 'Departure procedure',
      };
    case 'arrival-transition':
      return {
        kind: 'arrival-procedure',
        label: 'Arrival procedure',
      };
    case 'final':
      return {
        kind: 'final-approach',
        label: 'Final approach',
      };
    case 'direct-to':
      return {
        kind: 'direct-navigation',
        label: 'Direct navigation',
      };
    case 'enroute':
    default:
      return {
        kind: 'enroute-structure',
        label: 'Enroute structure',
      };
  }
}

export function getMobileRouteProcedureHandoff(
  profile: MobileRouteLegProfile,
): MobileRouteProcedureHandoff {
  switch (profile) {
    case 'initial-departure':
      return {
        kind: 'pilot-advance',
        label: 'Pilot advance handoff',
      };
    case 'departure-transition':
    case 'enroute':
      return {
        kind: 'auto-course-handoff',
        label: 'Auto course handoff',
      };
    case 'arrival-transition':
      return {
        kind: 'terminal-feed-handoff',
        label: 'Terminal feed handoff',
      };
    case 'final':
      return {
        kind: 'final-capture-handoff',
        label: 'Final capture handoff',
      };
    case 'direct-to':
      return {
        kind: 'direct-resume',
        label: 'Direct resume handoff',
      };
    default:
      return {
        kind: 'auto-course-handoff',
        label: 'Auto course handoff',
      };
  }
}

export function buildMobileRouteExecutionPlan(
  legs: MobileRouteLeg[],
  options?: { navDataLegsByIndex?: Record<number, MobileRouteNavDataLegPayload | undefined> },
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
      fromFix: leg.from,
      toFix: leg.to,
      distanceNm: leg.nm,
      courseDeg: leg.courseDeg,
      navDataPayload: options?.navDataLegsByIndex?.[leg.index] || null,
      segment: getMobileRouteExecutionSegment(profile, { sequenceGateState: 'blocked' }),
      transition: getMobileRouteExecutionTransition(profile),
      procedure: getMobileRouteProcedureContext(profile),
      handoff: getMobileRouteProcedureHandoff(profile),
    };
  });
}

export function buildMobileRouteProcedureChains(
  plan: MobileRouteExecutionPlanEntry[],
): MobileRouteProcedureChain[] {
  if (!plan.length) return [];

  const chains: MobileRouteProcedureChain[] = [];
  let currentKind = plan[0].procedure.kind;
  let currentLabel = plan[0].procedure.label;
  let startLegIndex = plan[0].legIndex;
  let endLegIndex = plan[0].legIndex;
  let entryCount = 1;

  const flush = () => {
    chains.push({
      index: chains.length,
      kind: currentKind,
      label: currentLabel,
      startLegIndex,
      endLegIndex,
      entryCount,
    });
  };

  for (let index = 1; index < plan.length; index += 1) {
    const entry = plan[index];
    if (entry.procedure.kind === currentKind) {
      endLegIndex = entry.legIndex;
      entryCount += 1;
      continue;
    }

    flush();
    currentKind = entry.procedure.kind;
    currentLabel = entry.procedure.label;
    startLegIndex = entry.legIndex;
    endLegIndex = entry.legIndex;
    entryCount = 1;
  }

  flush();
  return chains;
}

export function getMobileRouteProcedureChainBehavior(
  kind: MobileRouteProcedureClass,
): MobileRouteProcedureChainBehavior {
  switch (kind) {
    case 'departure-procedure':
      return {
        kind,
        sequencingModel: 'managed',
        armingMode: 'pilot',
        label: 'Managed departure block',
      };
    case 'arrival-procedure':
      return {
        kind,
        sequencingModel: 'auto',
        armingMode: 'terminal',
        label: 'Terminal arrival block',
      };
    case 'final-approach':
      return {
        kind,
        sequencingModel: 'auto',
        armingMode: 'final',
        label: 'Final capture block',
      };
    case 'direct-navigation':
      return {
        kind,
        sequencingModel: 'managed',
        armingMode: 'direct',
        label: 'Managed direct block',
      };
    case 'enroute-structure':
    default:
      return {
        kind: 'enroute-structure',
        sequencingModel: 'auto',
        armingMode: 'monitor',
        label: 'Enroute auto block',
      };
  }
}

export function getMobileRouteProcedureTemplate(
  kind: MobileRouteProcedureClass,
): MobileRouteProcedureTemplate {
  const behavior = getMobileRouteProcedureChainBehavior(kind);
  switch (kind) {
    case 'departure-procedure':
      return {
        kind,
        label: 'Departure template',
        behavior,
        gateSubject: 'Departure block',
        transitionCalls: {
          armed: 'Managed departure armed',
          rollout: 'Runway departure block active',
          established: 'Departure block established',
          intercept: 'Departure block transition',
        },
        nextLegAutoLabel: 'Departure block will auto-advance when capture criteria are met.',
        nextLegManagedLabel: 'Next leg is staged. Manual advance remains required.',
      };
    case 'arrival-procedure':
      return {
        kind,
        label: 'Arrival template',
        behavior,
        gateSubject: 'Arrival feed',
        transitionCalls: {
          armed: 'Arrival feed armed',
          established: 'Arrival feed established',
          intercept: 'Arrival feed transition',
          capture: 'Arrival feed capture',
        },
        nextLegAutoLabel: 'Next leg is armed for terminal sequencing.',
        nextLegManagedLabel: 'Arrival feed is staged for manual advance.',
      };
    case 'final-approach':
      return {
        kind,
        label: 'Final template',
        behavior,
        gateSubject: 'Final capture',
        transitionCalls: {
          established: 'Final capture established',
          intercept: 'Final capture intercept',
          capture: 'Final capture armed',
        },
        nextLegAutoLabel: 'Next leg is armed for final capture.',
        nextLegManagedLabel: 'Final segment is staged for manual advance.',
      };
    case 'direct-navigation':
      return {
        kind,
        label: 'Direct template',
        behavior,
        gateSubject: 'Direct block',
        transitionCalls: {
          established: 'Managed direct block established',
          intercept: 'Managed direct intercept',
        },
        nextLegAutoLabel: 'Direct block will auto-advance when capture criteria are met.',
        nextLegManagedLabel: 'Next leg is staged inside a managed direct block.',
      };
    case 'enroute-structure':
    default:
      return {
        kind: 'enroute-structure',
        label: 'Enroute template',
        behavior,
        gateSubject: 'Enroute block',
        transitionCalls: {
          established: 'Enroute block established',
          intercept: 'Enroute block intercept',
          capture: 'Enroute block capture',
        },
        nextLegAutoLabel: 'Next leg is armed for sequencing.',
        nextLegManagedLabel: 'Next leg is staged inside a managed enroute block.',
      };
  }
}

export function getMobileRouteProcedureArmingProgressPct(
  armingMode: MobileRouteProcedureChainBehavior['armingMode'],
): number {
  switch (armingMode) {
    case 'pilot':
      return 84;
    case 'direct':
      return 78;
    case 'terminal':
      return 62;
    case 'final':
      return 52;
    case 'monitor':
    default:
      return 70;
  }
}

export function getMobileRouteProcedureExecutionProfile(
  kind: MobileRouteProcedureClass,
): MobileRouteProcedureExecutionProfile {
  const template = getMobileRouteProcedureTemplate(kind);
  switch (kind) {
    case 'departure-procedure':
      return {
        kind,
        label: 'Departure execution profile',
        behavior: template.behavior,
        template,
        armAtProgressPct: 84,
        openAtProgressPct: 88,
        requiresLateralCapture: false,
      };
    case 'arrival-procedure':
      return {
        kind,
        label: 'Arrival execution profile',
        behavior: template.behavior,
        template,
        armAtProgressPct: 62,
        openAtProgressPct: 78,
        requiresLateralCapture: true,
      };
    case 'final-approach':
      return {
        kind,
        label: 'Final execution profile',
        behavior: template.behavior,
        template,
        armAtProgressPct: 52,
        openAtProgressPct: 68,
        requiresLateralCapture: true,
      };
    case 'direct-navigation':
      return {
        kind,
        label: 'Direct execution profile',
        behavior: template.behavior,
        template,
        armAtProgressPct: 78,
        openAtProgressPct: 90,
        requiresLateralCapture: false,
      };
    case 'enroute-structure':
    default:
      return {
        kind: 'enroute-structure',
        label: 'Enroute execution profile',
        behavior: template.behavior,
        template,
        armAtProgressPct: 70,
        openAtProgressPct: 90,
        requiresLateralCapture: false,
      };
  }
}

export function getMobileRouteProcedureCueStack(
  kind: MobileRouteProcedureClass,
): MobileRouteProcedureCueStack {
  const template = getMobileRouteProcedureTemplate(kind);
  switch (kind) {
    case 'departure-procedure':
      return {
        kind,
        label: 'Departure cue stack',
        modeLabel: 'Departure',
        sequencingSummary: 'Managed departure sequencing',
        gateCalls: {
          blocked: 'Departure block blocked',
          armed: 'Departure block armed',
          open: 'Departure block open',
          manualOpen: 'Departure block open - manual advance required',
          hold: 'Departure sequencing hold',
        },
        transitionCalls: {
          intercept: template.transitionCalls.intercept,
          capture: template.transitionCalls.armed || 'Managed departure armed',
          established: template.transitionCalls.established,
          armed: template.transitionCalls.armed,
          rollout: template.transitionCalls.rollout,
          hold: 'Departure sequencing hold',
        },
        nextLegAutoLabel: template.nextLegAutoLabel,
        nextLegManagedLabel: template.nextLegManagedLabel,
      };
    case 'arrival-procedure':
      return {
        kind,
        label: 'Arrival cue stack',
        modeLabel: 'Arrival',
        sequencingSummary: 'Terminal arrival sequencing',
        gateCalls: {
          blocked: 'Arrival feed blocked',
          armed: 'Arrival feed armed',
          open: 'Arrival feed open',
          manualOpen: 'Arrival feed open - manual advance required',
          hold: 'Arrival sequencing hold',
        },
        transitionCalls: {
          intercept: template.transitionCalls.intercept,
          capture: template.transitionCalls.capture || 'Arrival feed capture',
          established: template.transitionCalls.established,
          armed: template.transitionCalls.armed,
          hold: 'Arrival sequencing hold',
        },
        nextLegAutoLabel: template.nextLegAutoLabel,
        nextLegManagedLabel: template.nextLegManagedLabel,
      };
    case 'final-approach':
      return {
        kind,
        label: 'Final cue stack',
        modeLabel: 'Final',
        sequencingSummary: 'Final capture sequencing',
        gateCalls: {
          blocked: 'Final capture blocked',
          armed: 'Final capture armed',
          open: 'Final capture open',
          manualOpen: 'Final capture open - manual advance required',
          hold: 'Final sequencing hold',
        },
        transitionCalls: {
          intercept: template.transitionCalls.intercept,
          capture: template.transitionCalls.capture || 'Final capture armed',
          established: template.transitionCalls.established,
          armed: template.transitionCalls.armed,
          hold: 'Final sequencing hold',
        },
        nextLegAutoLabel: template.nextLegAutoLabel,
        nextLegManagedLabel: template.nextLegManagedLabel,
      };
    case 'direct-navigation':
      return {
        kind,
        label: 'Direct cue stack',
        modeLabel: 'Direct',
        sequencingSummary: 'Managed direct sequencing',
        gateCalls: {
          blocked: 'Direct block blocked',
          armed: 'Direct block armed',
          open: 'Direct block open',
          manualOpen: 'Direct block open - manual advance required',
          hold: 'Direct sequencing hold',
        },
        transitionCalls: {
          intercept: template.transitionCalls.intercept,
          capture: template.transitionCalls.armed || 'Managed direct armed',
          established: template.transitionCalls.established,
          armed: template.transitionCalls.armed,
          hold: 'Direct sequencing hold',
        },
        nextLegAutoLabel: template.nextLegAutoLabel,
        nextLegManagedLabel: template.nextLegManagedLabel,
      };
    case 'enroute-structure':
    default:
      return {
        kind: 'enroute-structure',
        label: 'Enroute cue stack',
        modeLabel: 'Enroute',
        sequencingSummary: 'Managed enroute sequencing',
        gateCalls: {
          blocked: 'Enroute block blocked',
          armed: 'Enroute block armed',
          open: 'Enroute block open',
          manualOpen: 'Enroute block open - manual advance required',
          hold: 'Enroute sequencing hold',
        },
        transitionCalls: {
          intercept: template.transitionCalls.intercept,
          capture: template.transitionCalls.capture || 'Enroute block capture',
          established: template.transitionCalls.established,
          armed: template.transitionCalls.armed,
          hold: 'Enroute sequencing hold',
        },
        nextLegAutoLabel: template.nextLegAutoLabel,
        nextLegManagedLabel: template.nextLegManagedLabel,
      };
  }
}

export function getMobileRouteProcedureEntryRole(
  kind: MobileRouteProcedureClass,
  options?: { entryIndexInChain?: number; entryCount?: number },
): MobileRouteProcedureEntryRole {
  const entryIndexInChain = options?.entryIndexInChain ?? 0;
  const entryCount = Math.max(1, options?.entryCount ?? 1);
  switch (kind) {
    case 'departure-procedure':
      return entryIndexInChain === 0
        ? {
            kind: 'departure-anchor',
            label: 'Departure anchor',
            cue: 'Runway anchor leg',
          }
        : {
            kind: 'departure-transition',
            label: 'Departure transition',
            cue: 'Climb transition leg',
          };
    case 'arrival-procedure':
      return entryIndexInChain >= entryCount - 1
        ? {
            kind: 'arrival-handoff',
            label: 'Arrival handoff',
            cue: 'Terminal handoff leg',
          }
        : {
            kind: 'arrival-feed',
            label: 'Arrival feed',
            cue: 'Arrival feed leg',
          };
    case 'final-approach':
      return {
        kind: 'final-capture',
        label: 'Final capture',
        cue: 'Runway capture leg',
      };
    case 'direct-navigation':
      return {
        kind: 'direct-intercept',
        label: 'Direct intercept',
        cue: 'Managed direct leg',
      };
    case 'enroute-structure':
    default:
      return entryIndexInChain === 0
        ? {
            kind: 'enroute-join',
            label: 'Enroute join',
            cue: 'Join structure leg',
          }
        : {
            kind: 'enroute-structure',
            label: 'Enroute structure',
            cue: 'Managed structure leg',
          };
  }
}

export function getMobileRouteProcedureRoleCueProfile(
  roleKind: MobileRouteProcedureEntryRoleKind,
): MobileRouteProcedureRoleCueProfile {
  switch (roleKind) {
    case 'departure-anchor':
      return {
        kind: roleKind,
        label: 'Departure anchor cues',
        gateSubject: 'Runway anchor',
        sequencingSummary: 'Anchor departure sequencing',
        transitionCalls: {
          intercept: 'Runway anchor active',
          capture: 'Runway anchor armed',
          established: 'Runway anchor established',
          armed: 'Runway anchor armed',
          rollout: 'Runway anchor rollout',
          hold: 'Runway anchor hold',
        },
      };
    case 'departure-transition':
      return {
        kind: roleKind,
        label: 'Departure transition cues',
        gateSubject: 'Departure transition',
        sequencingSummary: 'Climb transition sequencing',
        transitionCalls: {
          intercept: 'Departure transition active',
          capture: 'Departure transition capture',
          established: 'Departure transition established',
          armed: 'Departure transition armed',
          hold: 'Departure transition hold',
        },
      };
    case 'arrival-feed':
      return {
        kind: roleKind,
        label: 'Arrival feed cues',
        gateSubject: 'Arrival feed',
        sequencingSummary: 'Arrival feed sequencing',
        transitionCalls: {
          intercept: 'Arrival feed transition',
          capture: 'Arrival feed capture',
          established: 'Arrival feed established',
          armed: 'Arrival feed armed',
          hold: 'Arrival feed hold',
        },
      };
    case 'arrival-handoff':
      return {
        kind: roleKind,
        label: 'Arrival handoff cues',
        gateSubject: 'Arrival handoff',
        sequencingSummary: 'Terminal handoff sequencing',
        transitionCalls: {
          intercept: 'Arrival handoff transition',
          capture: 'Arrival handoff capture',
          established: 'Arrival handoff established',
          armed: 'Arrival handoff armed',
          hold: 'Arrival handoff hold',
        },
      };
    case 'final-capture':
      return {
        kind: roleKind,
        label: 'Final capture cues',
        gateSubject: 'Final capture',
        sequencingSummary: 'Runway capture sequencing',
        transitionCalls: {
          intercept: 'Final capture intercept',
          capture: 'Final capture armed',
          established: 'Final capture established',
          armed: 'Final capture armed',
          hold: 'Final capture hold',
        },
      };
    case 'direct-intercept':
      return {
        kind: roleKind,
        label: 'Direct intercept cues',
        gateSubject: 'Direct intercept',
        sequencingSummary: 'Managed direct sequencing',
        transitionCalls: {
          intercept: 'Direct intercept active',
          capture: 'Direct intercept capture',
          established: 'Direct intercept established',
          armed: 'Direct intercept armed',
          hold: 'Direct intercept hold',
        },
      };
    case 'enroute-join':
      return {
        kind: roleKind,
        label: 'Enroute join cues',
        gateSubject: 'Enroute join',
        sequencingSummary: 'Join structure sequencing',
        transitionCalls: {
          intercept: 'Enroute join intercept',
          capture: 'Enroute join capture',
          established: 'Enroute join established',
          armed: 'Enroute join armed',
          hold: 'Enroute join hold',
        },
      };
    case 'enroute-structure':
    default:
      return {
        kind: 'enroute-structure',
        label: 'Enroute structure cues',
        gateSubject: 'Enroute structure',
        sequencingSummary: 'Managed enroute sequencing',
        transitionCalls: {
          intercept: 'Enroute structure intercept',
          capture: 'Enroute structure capture',
          established: 'Enroute structure established',
          armed: 'Enroute structure armed',
          hold: 'Enroute structure hold',
        },
      };
  }
}

export function getMobileRouteProcedureRoleExecutionPolicy(
  roleKind: MobileRouteProcedureEntryRoleKind,
): MobileRouteProcedureRoleExecutionPolicy {
  switch (roleKind) {
    case 'departure-anchor':
      return {
        kind: roleKind,
        sequencingModel: 'managed',
        armBiasPct: 4,
        openBiasPct: 6,
        manualReason: 'Runway anchor remains pilot-managed until the departure transition is confirmed.',
      };
    case 'arrival-handoff':
      return {
        kind: roleKind,
        sequencingModel: 'managed',
        armBiasPct: -4,
        openBiasPct: -2,
        manualReason: 'Arrival handoff remains staged for terminal confirmation before sequencing.',
      };
    case 'direct-intercept':
      return {
        kind: roleKind,
        sequencingModel: 'managed',
        armBiasPct: 2,
        openBiasPct: 4,
        manualReason: 'Direct intercept remains managed until the pilot accepts the resume leg.',
      };
    case 'final-capture':
      return {
        kind: roleKind,
        sequencingModel: 'auto',
        armBiasPct: -4,
        openBiasPct: -6,
        manualReason: null,
      };
    case 'arrival-feed':
      return {
        kind: roleKind,
        sequencingModel: 'auto',
        armBiasPct: -2,
        openBiasPct: -4,
        manualReason: null,
      };
    case 'departure-transition':
      return {
        kind: roleKind,
        sequencingModel: 'auto',
        armBiasPct: 0,
        openBiasPct: -2,
        manualReason: null,
      };
    case 'enroute-join':
      return {
        kind: roleKind,
        sequencingModel: 'auto',
        armBiasPct: -3,
        openBiasPct: -4,
        manualReason: null,
      };
    case 'enroute-structure':
    default:
      return {
        kind: 'enroute-structure',
        sequencingModel: 'auto',
        armBiasPct: 0,
        openBiasPct: 0,
        manualReason: null,
      };
  }
}

export function getMobileRouteProcedureSegmentTemplate(
  roleKind: MobileRouteProcedureEntryRoleKind,
): MobileRouteProcedureSegmentTemplate {
  switch (roleKind) {
    case 'departure-anchor':
      return {
        kind: 'departure-anchor-segment',
        label: 'Departure anchor segment',
        phaseLabel: 'Taxi / runway',
        segmentCue: 'Anchor the departure block on the runway release segment.',
      };
    case 'departure-transition':
      return {
        kind: 'departure-transition-segment',
        label: 'Departure transition segment',
        phaseLabel: 'Initial climb',
        segmentCue: 'Carry the climb transition into the departure structure.',
      };
    case 'arrival-feed':
      return {
        kind: 'arrival-feed-segment',
        label: 'Arrival feed segment',
        phaseLabel: 'Terminal arrival',
        segmentCue: 'Feed the terminal sequence toward the handoff leg.',
      };
    case 'arrival-handoff':
      return {
        kind: 'arrival-handoff-segment',
        label: 'Arrival handoff segment',
        phaseLabel: 'Terminal handoff',
        segmentCue: 'Stage the handoff into the final capture block.',
      };
    case 'final-capture':
      return {
        kind: 'final-capture-segment',
        label: 'Final capture segment',
        phaseLabel: 'Final / runway',
        segmentCue: 'Capture and hold the runway alignment segment.',
      };
    case 'direct-intercept':
      return {
        kind: 'direct-resume-segment',
        label: 'Direct resume segment',
        phaseLabel: 'Direct navigation',
        segmentCue: 'Use the direct intercept segment until the route resume point.',
      };
    case 'enroute-join':
      return {
        kind: 'enroute-join-segment',
        label: 'Enroute join segment',
        phaseLabel: 'Join structure',
        segmentCue: 'Join the downstream enroute structure cleanly before handing off.',
      };
    case 'enroute-structure':
    default:
      return {
        kind: 'enroute-structure-segment',
        label: 'Enroute structure segment',
        phaseLabel: 'Enroute',
        segmentCue: 'Manage the active enroute structure segment and downstream capture.',
      };
  }
}

export function getMobileRouteProcedureSegmentClass(
  roleKind: MobileRouteProcedureEntryRoleKind,
): MobileRouteProcedureSegmentClass {
  switch (roleKind) {
    case 'departure-anchor':
      return {
        kind: 'runway-anchor',
        label: 'Runway anchor class',
        lateralMode: 'managed',
        terminalArea: true,
        procedureReady: true,
      };
    case 'departure-transition':
      return {
        kind: 'climb-transition',
        label: 'Climb transition class',
        lateralMode: 'course-capture',
        terminalArea: true,
        procedureReady: true,
      };
    case 'arrival-feed':
      return {
        kind: 'terminal-feed',
        label: 'Terminal feed class',
        lateralMode: 'terminal-capture',
        terminalArea: true,
        procedureReady: true,
      };
    case 'arrival-handoff':
      return {
        kind: 'terminal-handoff',
        label: 'Terminal handoff class',
        lateralMode: 'managed',
        terminalArea: true,
        procedureReady: true,
      };
    case 'final-capture':
      return {
        kind: 'final-capture',
        label: 'Final capture class',
        lateralMode: 'final-capture',
        terminalArea: true,
        procedureReady: true,
      };
    case 'direct-intercept':
      return {
        kind: 'direct-resume',
        label: 'Direct resume class',
        lateralMode: 'direct-intercept',
        terminalArea: false,
        procedureReady: false,
      };
    case 'enroute-join':
      return {
        kind: 'enroute-join',
        label: 'Enroute join class',
        lateralMode: 'course-capture',
        terminalArea: false,
        procedureReady: true,
      };
    case 'enroute-structure':
    default:
      return {
        kind: 'enroute-structure',
        label: 'Enroute structure class',
        lateralMode: 'course-capture',
        terminalArea: false,
        procedureReady: true,
      };
  }
}

export function getMobileRouteProcedureLegAdapter(
  segmentClass: MobileRouteProcedureSegmentClass,
): MobileRouteProcedureLegAdapter {
  switch (segmentClass.kind) {
    case 'runway-anchor':
      return {
        kind: 'runway-leg',
        label: 'Runway procedure leg',
        navDataReady: true,
        adapterCue: 'Maps cleanly to a runway/departure release leg when nav data is available.',
      };
    case 'climb-transition':
    case 'enroute-join':
    case 'enroute-structure':
      return {
        kind: 'course-leg',
        label: 'Course procedure leg',
        navDataReady: true,
        adapterCue: 'Maps to a course-to-fix or track-to-fix style procedure leg.',
      };
    case 'terminal-feed':
    case 'terminal-handoff':
      return {
        kind: 'terminal-leg',
        label: 'Terminal procedure leg',
        navDataReady: true,
        adapterCue: 'Maps to terminal arrival/feed legs once arrival procedure data is loaded.',
      };
    case 'final-capture':
      return {
        kind: 'final-leg',
        label: 'Final procedure leg',
        navDataReady: true,
        adapterCue: 'Maps to a final approach capture leg when procedure data is available.',
      };
    case 'direct-resume':
    default:
      return {
        kind: 'direct-leg',
        label: 'Direct procedure leg',
        navDataReady: false,
        adapterCue: 'Currently route-derived; will remain synthetic until nav-data direct/resume legs are defined.',
      };
  }
}

export function getMobileRouteProcedureLegFamily(
  adapter: MobileRouteProcedureLegAdapter,
): MobileRouteProcedureLegFamily {
  switch (adapter.kind) {
    case 'runway-leg':
      return {
        kind: 'runway-family',
        label: 'Runway leg family',
        parserReady: true,
        familyCue: 'Ready for runway-release and departure-anchor leg parsing.',
      };
    case 'course-leg':
      return {
        kind: 'course-to-fix-family',
        label: 'Course-to-fix leg family',
        parserReady: true,
        familyCue: 'Ready for course-to-fix or track-to-fix style parsing.',
      };
    case 'terminal-leg':
      return {
        kind: 'terminal-feed-family',
        label: 'Terminal feed leg family',
        parserReady: true,
        familyCue: 'Ready for terminal arrival and handoff leg parsing.',
      };
    case 'final-leg':
      return {
        kind: 'final-capture-family',
        label: 'Final capture leg family',
        parserReady: true,
        familyCue: 'Ready for final capture and runway alignment leg parsing.',
      };
    case 'direct-leg':
    default:
      return {
        kind: 'direct-resume-family',
        label: 'Direct resume leg family',
        parserReady: false,
        familyCue: 'Still synthetic until direct/resume nav-data legs are formalized.',
      };
  }
}

export function getMobileRouteProcedureLegParserTarget(
  family: MobileRouteProcedureLegFamily,
): MobileRouteProcedureLegParserTarget {
  switch (family.kind) {
    case 'runway-family':
      return {
        kind: 'runway-release-target',
        label: 'Runway release parser target',
        source: 'briefing-data',
        requiredFields: ['runwayIdent', 'airportIdent', 'releaseHeading'],
        parserCue: 'Uses briefing-backed runway release data now and can accept departure procedure parsing later.',
      };
    case 'course-to-fix-family':
      return {
        kind: 'course-fix-target',
        label: 'Course-to-fix parser target',
        source: 'nav-data',
        requiredFields: ['fromFix', 'toFix', 'courseDeg'],
        parserCue: 'Expect course-to-fix or track-to-fix leg payloads from procedure parsing.',
      };
    case 'terminal-feed-family':
      return {
        kind: 'terminal-feed-target',
        label: 'Terminal feed parser target',
        source: 'briefing-data',
        requiredFields: ['arrivalIdent', 'transitionFix', 'handoffFix'],
        parserCue: 'Uses briefing-backed terminal arrival feed data now and can accept arrival procedure parsing later.',
      };
    case 'final-capture-family':
      return {
        kind: 'final-capture-target',
        label: 'Final capture parser target',
        source: 'briefing-data',
        requiredFields: ['runwayIdent', 'finalCourseDeg', 'thresholdFix'],
        parserCue: 'Uses briefing-backed final runway data now and can accept full approach parsing later.',
      };
    case 'direct-resume-family':
    default:
      return {
        kind: 'direct-resume-target',
        label: 'Direct resume parser target',
        source: 'route-chain',
        requiredFields: ['originFix', 'targetFix'],
        parserCue: 'Uses synthetic route-chain data until nav-data direct/resume legs are formalized.',
      };
  }
}

export function getMobileRouteProcedureLegIngestionContract(
  parserTarget: MobileRouteProcedureLegParserTarget,
): MobileRouteProcedureLegIngestionContract {
  switch (parserTarget.kind) {
    case 'runway-release-target':
      return {
        kind: parserTarget.kind,
        label: 'Runway release ingestion contract',
        source: parserTarget.source,
        payloadShape: 'runway-release',
        requiredFields: ['runwayIdent', 'airportIdent', 'releaseHeading'],
        optionalFields: ['initialAltitudeFt', 'turnDirection'],
      };
    case 'course-fix-target':
      return {
        kind: parserTarget.kind,
        label: 'Course-to-fix ingestion contract',
        source: parserTarget.source,
        payloadShape: 'course-to-fix',
        requiredFields: ['fromFix', 'toFix', 'courseDeg'],
        optionalFields: ['distanceNm', 'altitudeConstraintFt'],
      };
    case 'terminal-feed-target':
      return {
        kind: parserTarget.kind,
        label: 'Terminal feed ingestion contract',
        source: parserTarget.source,
        payloadShape: 'terminal-feed',
        requiredFields: ['arrivalIdent', 'transitionFix', 'handoffFix'],
        optionalFields: ['altitudeConstraintFt', 'speedConstraintKts'],
      };
    case 'final-capture-target':
      return {
        kind: parserTarget.kind,
        label: 'Final capture ingestion contract',
        source: parserTarget.source,
        payloadShape: 'final-capture',
        requiredFields: ['runwayIdent', 'finalCourseDeg', 'thresholdFix'],
        optionalFields: ['glideslopeAngleDeg', 'decisionAltitudeFt'],
      };
    case 'direct-resume-target':
    default:
      return {
        kind: parserTarget.kind,
        label: 'Direct resume ingestion contract',
        source: parserTarget.source,
        payloadShape: 'direct-resume',
        requiredFields: ['originFix', 'targetFix'],
        optionalFields: ['resumeFix', 'resumeCourseDeg'],
      };
  }
}

export function getMobileRouteProcedureParsedLegPayload(
  entry: Pick<
    MobileRouteExecutionPlanEntry,
    'fromFix' | 'toFix' | 'distanceNm' | 'courseDeg' | 'navDataPayload'
  >,
  parserTarget: MobileRouteProcedureLegParserTarget,
): MobileRouteProcedureParsedLegPayload | null {
  switch (parserTarget.kind) {
    case 'runway-release-target':
      if (entry.navDataPayload?.kind === 'runway-release-nav-data') {
        return {
          kind: 'runway-release-payload',
          label: 'Runway-release payload',
          source: entry.navDataPayload.sourceKind,
          runwayIdent: entry.navDataPayload.runwayIdent,
          airportIdent: entry.navDataPayload.airportIdent,
          releaseHeading: entry.navDataPayload.releaseHeading,
          initialAltitudeFt: entry.navDataPayload.initialAltitudeFt,
        };
      }
      return {
        kind: 'runway-release-payload',
        label: 'Runway-release payload',
        source: 'route-chain',
        runwayIdent: entry.toFix,
        airportIdent: entry.fromFix,
        releaseHeading: entry.courseDeg,
        initialAltitudeFt: null,
      };
    case 'course-fix-target':
      if (entry.navDataPayload?.kind === 'course-fix-nav-data') {
        return {
          kind: 'course-to-fix-payload',
          label: 'Course-to-fix payload',
          source: entry.navDataPayload.sourceKind,
          fromFix: entry.navDataPayload.fromFix,
          toFix: entry.navDataPayload.toFix,
          courseDeg: entry.navDataPayload.courseDeg,
          distanceNm: entry.navDataPayload.distanceNm,
          altitudeConstraintFt: entry.navDataPayload.altitudeConstraintFt,
        };
      }
      return {
        kind: 'course-to-fix-payload',
        label: 'Course-to-fix payload',
        source: 'route-chain',
        fromFix: entry.fromFix,
        toFix: entry.toFix,
        courseDeg: entry.courseDeg,
        distanceNm: entry.distanceNm,
        altitudeConstraintFt: null,
      };
    case 'terminal-feed-target':
      if (entry.navDataPayload?.kind === 'terminal-feed-nav-data') {
        return {
          kind: 'terminal-feed-payload',
          label: 'Terminal-feed payload',
          source: entry.navDataPayload.sourceKind,
          arrivalIdent: entry.navDataPayload.arrivalIdent,
          transitionFix: entry.navDataPayload.transitionFix,
          handoffFix: entry.navDataPayload.handoffFix,
          altitudeConstraintFt: entry.navDataPayload.altitudeConstraintFt,
        };
      }
      return {
        kind: 'terminal-feed-payload',
        label: 'Terminal-feed payload',
        source: 'route-chain',
        arrivalIdent: entry.toFix,
        transitionFix: entry.fromFix,
        handoffFix: entry.toFix,
        altitudeConstraintFt: null,
      };
    case 'final-capture-target':
      if (entry.navDataPayload?.kind === 'final-capture-nav-data') {
        return {
          kind: 'final-capture-payload',
          label: 'Final-capture payload',
          source: entry.navDataPayload.sourceKind,
          runwayIdent: entry.navDataPayload.runwayIdent,
          finalCourseDeg: entry.navDataPayload.finalCourseDeg,
          thresholdFix: entry.navDataPayload.thresholdFix,
          glideslopeAngleDeg: entry.navDataPayload.glideslopeAngleDeg,
        };
      }
      return {
        kind: 'final-capture-payload',
        label: 'Final-capture payload',
        source: 'route-chain',
        runwayIdent: entry.toFix,
        finalCourseDeg: entry.courseDeg,
        thresholdFix: entry.toFix,
        glideslopeAngleDeg: null,
      };
    case 'direct-resume-target':
      return {
        kind: 'direct-resume-payload',
        label: 'Direct-resume payload',
        source: 'route-chain',
        originFix: entry.fromFix,
        targetFix: entry.toFix,
        resumeFix: null,
        resumeCourseDeg: entry.courseDeg,
      };
    default:
      return null;
  }
}

export function getMobileRouteProcedureEntryDescriptor(
  planEntry: Pick<
    MobileRouteExecutionPlanEntry,
    'fromFix' | 'toFix' | 'distanceNm' | 'courseDeg' | 'navDataPayload' | 'procedure'
  >,
  options?: { entryIndexInChain?: number; entryCount?: number },
): MobileRouteProcedureEntryDescriptor {
  const entryIndexInChain = Math.max(0, options?.entryIndexInChain ?? 0);
  const entryCount = Math.max(1, options?.entryCount ?? 1);
  const kind = planEntry.procedure.kind;
  const role = getMobileRouteProcedureEntryRole(kind, {
    entryIndexInChain,
    entryCount,
  });
  const cueProfile = getMobileRouteProcedureRoleCueProfile(role.kind);
  const executionPolicy = getMobileRouteProcedureRoleExecutionPolicy(role.kind);
  const segmentClass = getMobileRouteProcedureSegmentClass(role.kind);
  const procedureLegAdapter = getMobileRouteProcedureLegAdapter(segmentClass);
  const procedureLegFamily = getMobileRouteProcedureLegFamily(procedureLegAdapter);
  const procedureLegParserTarget = getMobileRouteProcedureLegParserTarget(procedureLegFamily);
  return {
    role,
    cueProfile,
    executionPolicy,
    segmentTemplate: getMobileRouteProcedureSegmentTemplate(role.kind),
    segmentClass,
    procedureLegAdapter,
    procedureLegFamily,
    procedureLegParserTarget,
    procedureLegIngestionContract: getMobileRouteProcedureLegIngestionContract(procedureLegParserTarget),
    parsedLegPayload: getMobileRouteProcedureParsedLegPayload(planEntry, procedureLegParserTarget),
    entryIndexInChain,
    entryCount,
    positionLabel: `Entry ${entryIndexInChain + 1}/${entryCount}`,
  };
}

export function getMobileRouteProcedureEntryTransitionBehavior(
  descriptor: MobileRouteProcedureEntryDescriptor,
): MobileRouteProcedureEntryTransitionBehavior {
  switch (descriptor.role.kind) {
    case 'departure-anchor':
      return {
        kind: 'anchor-release',
        label: 'Anchor release',
        sequencingCue: 'Hold runway anchor until the departure transition is ready.',
        handoffCue: 'Pilot confirms release into climb transition.',
        nextAction: 'pilot-advance',
      };
    case 'departure-transition':
      return {
        kind: 'climb-handoff',
        label: 'Climb handoff',
        sequencingCue: 'Managed climb transition toward the next departure segment.',
        handoffCue: 'Departure transition hands off automatically when capture is stable.',
        nextAction: 'auto-advance',
      };
    case 'arrival-feed':
      return {
        kind: 'arrival-feed',
        label: 'Arrival feed',
        sequencingCue: 'Feed the terminal sequence and monitor capture for the next entry.',
        handoffCue: 'Arrival feed hands off automatically into the terminal block.',
        nextAction: 'auto-advance',
      };
    case 'arrival-handoff':
      return {
        kind: 'arrival-handoff',
        label: 'Arrival handoff',
        sequencingCue: 'Stage the terminal handoff before releasing the next segment.',
        handoffCue: 'Pilot confirms terminal handoff when the block is ready.',
        nextAction: 'pilot-advance',
      };
    case 'final-capture':
      return {
        kind: 'final-capture',
        label: 'Final capture',
        sequencingCue: 'Capture the runway course and hold final alignment.',
        handoffCue: 'Final capture auto-sequences once runway alignment is established.',
        nextAction: 'auto-advance',
      };
    case 'direct-intercept':
      return {
        kind: 'direct-resume',
        label: 'Direct resume',
        sequencingCue: 'Managed direct intercept remains staged until the pilot resumes the route.',
        handoffCue: 'Pilot resumes the planned route after direct intercept is established.',
        nextAction: 'pilot-advance',
      };
    case 'enroute-join':
      return {
        kind: 'structure-join',
        label: 'Structure join',
        sequencingCue: 'Join the enroute structure and arm the downstream segment.',
        handoffCue: 'Structure join auto-hands off once the course is captured.',
        nextAction: 'auto-advance',
      };
    case 'enroute-structure':
    default:
      return {
        kind: 'structure-manage',
        label: 'Structure manage',
        sequencingCue: 'Manage the current enroute structure and monitor the next arm gate.',
        handoffCue: 'Enroute structure auto-hands off once sequencing criteria are met.',
        nextAction: 'auto-advance',
      };
  }
}

export function getMobileRouteProcedureTransitionTable(
  kind: MobileRouteProcedureClass,
  descriptor: MobileRouteProcedureEntryDescriptor,
  nextDescriptor?: MobileRouteProcedureEntryDescriptor | null,
): MobileRouteProcedureTransitionTable {
  const nextRoleKind = nextDescriptor?.role.kind || null;
  switch (kind) {
    case 'departure-procedure':
      return {
        kind,
        label: 'Departure transition table',
        activeRoleKind: descriptor.role.kind,
        nextRoleKind,
        handoffPathLabel:
          descriptor.role.kind === 'departure-anchor'
            ? 'Departure anchor -> departure transition'
            : nextRoleKind
              ? 'Departure transition -> downstream course capture'
              : 'Departure transition -> enroute handoff',
        nextAction:
          descriptor.role.kind === 'departure-anchor' ? 'pilot-advance' : 'auto-advance',
      };
    case 'arrival-procedure':
      return {
        kind,
        label: 'Arrival transition table',
        activeRoleKind: descriptor.role.kind,
        nextRoleKind,
        handoffPathLabel:
          descriptor.role.kind === 'arrival-feed'
            ? 'Arrival feed -> arrival handoff'
            : 'Arrival handoff -> final capture',
        nextAction:
          descriptor.role.kind === 'arrival-handoff' ? 'pilot-advance' : 'auto-advance',
      };
    case 'final-approach':
      return {
        kind,
        label: 'Final transition table',
        activeRoleKind: descriptor.role.kind,
        nextRoleKind,
        handoffPathLabel: 'Final capture -> runway alignment',
        nextAction: 'auto-advance',
      };
    case 'direct-navigation':
      return {
        kind,
        label: 'Direct transition table',
        activeRoleKind: descriptor.role.kind,
        nextRoleKind,
        handoffPathLabel: nextRoleKind
          ? 'Direct intercept -> resume planned route'
          : 'Direct intercept -> destination handoff',
        nextAction: 'pilot-advance',
      };
    case 'enroute-structure':
    default:
      return {
        kind: 'enroute-structure',
        label: 'Enroute transition table',
        activeRoleKind: descriptor.role.kind,
        nextRoleKind,
        handoffPathLabel:
          descriptor.role.kind === 'enroute-join'
            ? 'Enroute join -> managed structure'
            : 'Managed structure -> downstream capture',
        nextAction: 'auto-advance',
      };
  }
}

export function annotateMobileRouteExecutionPlan(
  plan: MobileRouteExecutionPlanEntry[],
  options: {
    activeLegIndex: number;
    nextLegArmed?: boolean;
    sequencingSuspended?: boolean;
    sequenceGateState?: 'blocked' | 'armed' | 'open' | 'manual-open' | 'hold';
    procedureChains?: MobileRouteProcedureChain[];
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

    const procedureChain =
      options.procedureChains?.find(
        (chain) => entry.legIndex >= chain.startLegIndex && entry.legIndex <= chain.endLegIndex,
      ) || null;
    const procedureEntryDescriptor = getMobileRouteProcedureEntryDescriptor(entry, {
      entryIndexInChain: procedureChain ? entry.legIndex - procedureChain.startLegIndex : 0,
      entryCount: procedureChain?.entryCount ?? 1,
    });
    const procedureRole = procedureEntryDescriptor.role;

    return {
      ...entry,
      status,
      actionCue,
      procedureRole,
      procedureEntryDescriptor,
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
