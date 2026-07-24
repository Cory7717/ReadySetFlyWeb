import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBlankVfrFlightDeckParams,
  createPlannedRouteFlightDeckParams,
  isNoRouteFlightDeckEntry,
  normalizeFlightDeckRouteParams,
  shouldInitializeFlightDeckWithoutRoute,
} from '../../mobile/src/lib/flightDeckEntry';
import {
  deriveFlightDeckSourceHealth,
  expireFlightDeckTrafficTargets,
  FLIGHT_DECK_RECEIVER_OWNSHIP_STALE_MS,
  FLIGHT_DECK_TRAFFIC_STALE_MS,
} from '../../mobile/src/lib/flightDeckSafety';
import {
  createActiveFlightRoute,
  createActiveFlightSession,
  createFlightDeckParamsFromSession,
  createSessionFromLegacyResumePayload,
  mapPositionSource,
  parseActiveFlightSession,
  restoreActiveFlightSessionStorageValue,
  transitionActiveLeg,
  transitionDirectTo,
  transitionOperationalPhase,
  transitionSequencingSuspended,
  transitionSessionBackgrounded,
  transitionSessionForegrounded,
  transitionSkippedLegs,
  updateActiveFlightSession,
} from '../../mobile/src/lib/activeFlightSession';
import { deriveFlightDataState } from '../../mobile/src/lib/flight-data-engine';

const ENGINE_ROUTE_POINTS = [
  { icao: 'KARB', name: 'Ann Arbor', latitude: 42.223, longitude: -83.745 },
  { icao: '75G', name: 'Rossettie', latitude: 41.908, longitude: -84.586 },
  { icao: 'KAXV', name: 'Neil Armstrong', latitude: 40.493, longitude: -84.298 },
];

test('blank VFR entry remains no-route and does not infer a planned route', () => {
  const params = normalizeFlightDeckRouteParams(createBlankVfrFlightDeckParams());

  assert.equal(params?.entryMode, 'blank_vfr');
  assert.equal(params?.departure, undefined);
  assert.equal(params?.destination, undefined);
  assert.equal(isNoRouteFlightDeckEntry(params), true);
});

test('legacy flight mode params without route normalize to blank VFR', () => {
  const params = normalizeFlightDeckRouteParams({ mode: 'flight' });

  assert.equal(params?.entryMode, 'blank_vfr');
  assert.equal(isNoRouteFlightDeckEntry(params), true);
});

test('direct FlightDeck route without params initializes as no-route', () => {
  assert.equal(shouldInitializeFlightDeckWithoutRoute(null), true);
});

test('planned route entry normalizes route fields without changing the contract', () => {
  const params = createPlannedRouteFlightDeckParams({
    departure: ' karb ',
    destination: ' kaxv ',
    waypoints: ' dct 75g dct ',
    plannedAltitude: '14000',
    cruiseKtas: '125',
  });

  assert.equal(params.mode, 'flight');
  assert.equal(params.entryMode, 'planned_route');
  assert.equal(params.departure, 'KARB');
  assert.equal(params.destination, 'KAXV');
  assert.equal(params.waypoints, 'DCT 75G DCT');
});

test('fresh GPS outranks stale receiver ownship', () => {
  const nowMs = 1_000_000;
  const health = deriveFlightDeckSourceHealth({
    nowMs,
    simulationEnabled: false,
    simulationOwnshipAvailable: false,
    receiverOwnshipUpdatedAt: nowMs - FLIGHT_DECK_RECEIVER_OWNSHIP_STALE_MS - 1,
    gpsOwnshipUpdatedAt: nowMs - 1000,
  });

  assert.equal(health.receiverOwnshipFresh, false);
  assert.equal(health.gpsOwnshipFresh, true);
  assert.equal(health.activeSource, 'gps');
});

test('fresh receiver ownship is selected ahead of GPS', () => {
  const nowMs = 1_000_000;
  const health = deriveFlightDeckSourceHealth({
    nowMs,
    simulationEnabled: false,
    simulationOwnshipAvailable: false,
    receiverOwnshipUpdatedAt: nowMs - 1000,
    gpsOwnshipUpdatedAt: nowMs - 1000,
  });

  assert.equal(health.receiverOwnshipFresh, true);
  assert.equal(health.gpsOwnshipFresh, true);
  assert.equal(health.activeSource, 'receiver');
});

test('flight data engine selects fresh receiver ownship and derives active route legs', () => {
  const nowMs = 1_000_000;
  const route = createActiveFlightRoute({
    departure: 'KARB',
    destination: 'KAXV',
    waypoints: '75G',
    points: ENGINE_ROUTE_POINTS,
    totalNm: 106.8,
  });
  const session = createActiveFlightSession({
    id: 'engine-route',
    entryMode: 'planned_route',
    route,
    now: '2026-07-24T12:00:00.000Z',
  });
  const state = deriveFlightDataState({
    nowMs,
    session,
    routeSnapshot: route,
    routePoints: ENGINE_ROUTE_POINTS,
    routeTotalNm: 106.8,
    simulation: { active: false, ownship: null, attitude: null, trafficTargets: [] },
    deviceGps: { lat: 0, lon: 0, altitudeFt: 1000, speedKts: 90, heading: 0, updatedAt: nowMs - 1000, source: 'gps' },
    receiver: {
      health: { status: 'healthy', ownshipFresh: true },
      ownship: { lat: 42.1, lon: -84.0, altitudeFt: 3500, speedKts: 110, heading: 245, updatedAt: nowMs - 500, source: 'receiver' },
      attitude: { headingDeg: 250, updatedAt: nowMs - 500, source: 'receiver' },
    },
    trafficTargets: [],
    configuration: { plannedAltitudeFt: 6500 },
  });

  assert.equal(state.source.health.activeSource, 'receiver');
  assert.equal(state.source.ownship?.source, 'receiver');
  assert.equal(state.route.legs.length, 2);
  assert.equal(state.navigation.activeLegIndex, 0);
  assert.equal(state.navigation.progress?.nextWaypoint, '75G');
});

test('flight data engine falls back to fresh GPS when receiver ownship is stale', () => {
  const nowMs = 1_000_000;
  const state = deriveFlightDataState({
    nowMs,
    session: null,
    routeSnapshot: null,
    routePoints: [],
    simulation: { active: false, ownship: null, attitude: null, trafficTargets: [] },
    deviceGps: { lat: 42.223, lon: -83.745, altitudeFt: 1000, speedKts: 35, heading: 180, updatedAt: nowMs - 1000, source: 'gps' },
    receiver: {
      health: { status: 'stale' },
      ownship: { lat: 42.0, lon: -84.0, altitudeFt: 3000, speedKts: 95, heading: 220, updatedAt: nowMs - FLIGHT_DECK_RECEIVER_OWNSHIP_STALE_MS - 1, source: 'receiver' },
      attitude: null,
    },
    trafficTargets: [],
  });

  assert.equal(state.source.health.activeSource, 'gps');
  assert.equal(state.source.ownship?.source, 'gps');
});

test('flight data engine expires stale traffic and ranks immediate conflicts', () => {
  const nowMs = 1_000_000;
  const state = deriveFlightDataState({
    nowMs,
    session: null,
    routeSnapshot: null,
    routePoints: [],
    simulation: { active: false, ownship: null, attitude: null, trafficTargets: [] },
    deviceGps: { lat: 42.223, lon: -83.745, altitudeFt: 3000, speedKts: 90, heading: 180, updatedAt: nowMs - 1000, source: 'gps' },
    receiver: { health: null, ownship: null, attitude: null },
    trafficTargets: [
      { id: 'near', lat: 42.224, lon: -83.746, altitudeFt: 3100, updatedAt: nowMs - 1000 },
      { id: 'stale', lat: 42.224, lon: -83.746, altitudeFt: 3100, updatedAt: nowMs - FLIGHT_DECK_TRAFFIC_STALE_MS },
    ],
  });

  assert.deepEqual(state.traffic.tacticalTargets.map((target) => target.id), ['near']);
  assert.equal(state.traffic.immediateCount, 1);
  assert.equal(state.alerts.some((alert) => alert.id === 'traffic-immediate'), true);
});

test('flight data engine proposes active leg sequencing without mutating the session', () => {
  const nowMs = 1_000_000;
  const routePoints = [
    ENGINE_ROUTE_POINTS[0],
    ENGINE_ROUTE_POINTS[1],
    { icao: 'MID', name: 'Midpoint', latitude: 41.2, longitude: -84.45 },
    ENGINE_ROUTE_POINTS[2],
  ];
  const almostAt75g = {
    latitude: routePoints[1].latitude + (routePoints[2].latitude - routePoints[1].latitude) * 0.98,
    longitude: routePoints[1].longitude + (routePoints[2].longitude - routePoints[1].longitude) * 0.98,
  };
  const route = createActiveFlightRoute({
    departure: 'KARB',
    destination: 'KAXV',
    waypoints: '75G MID',
    points: routePoints,
    totalNm: 106.8,
  });
  const session = transitionActiveLeg(
    createActiveFlightSession({
      id: 'engine-sequence',
      entryMode: 'planned_route',
      route,
      now: '2026-07-24T12:00:00.000Z',
    }),
    1
  );
  const state = deriveFlightDataState({
    nowMs,
    session,
    routeSnapshot: route,
    routePoints,
    simulation: {
      active: true,
      ownship: { lat: almostAt75g.latitude, lon: almostAt75g.longitude, altitudeFt: 4500, speedKts: 115, heading: 172, updatedAt: nowMs, source: 'simulation' },
      attitude: null,
      trafficTargets: [],
    },
    deviceGps: null,
    receiver: { health: null, ownship: null, attitude: null },
    trafficTargets: [],
    configuration: { plannedAltitudeFt: 6500 },
  });

  assert.deepEqual(
    state.transitionProposals.filter((proposal) => proposal.type === 'sequence-active-leg'),
    [{ type: 'sequence-active-leg', activeLegIndex: 2, reason: 'auto-sequence' }]
  );
  assert.equal(session.navigation.activeLegIndex, 1);
});

test('flight data engine honors local active leg fallback when no session exists', () => {
  const nowMs = 1_000_000;
  const state = deriveFlightDataState({
    nowMs,
    session: null,
    routeSnapshot: null,
    routePoints: [
      ENGINE_ROUTE_POINTS[0],
      ENGINE_ROUTE_POINTS[1],
      ENGINE_ROUTE_POINTS[2],
    ],
    simulation: {
      active: true,
      ownship: { lat: 41.5, lon: -84.5, altitudeFt: 4500, speedKts: 100, heading: 170, updatedAt: nowMs, source: 'simulation' },
      attitude: null,
      trafficTargets: [],
    },
    deviceGps: null,
    receiver: { health: null, ownship: null, attitude: null },
    trafficTargets: [],
    navigation: { activeLegIndex: 1, sequencingSuspended: true },
  });

  assert.equal(state.navigation.activeLegIndex, 1);
  assert.equal(state.navigation.activeLeg?.from, '75G');
});

test('traffic expiration removes stale and timestampless targets deterministically', () => {
  const nowMs = 1_000_000;
  const targets = [
    { id: 'fresh', updatedAt: nowMs - 1000 },
    { id: 'stale', updatedAt: nowMs - FLIGHT_DECK_TRAFFIC_STALE_MS },
    { id: 'missing' },
  ];

  assert.deepEqual(expireFlightDeckTrafficTargets(targets, nowMs).map((target) => target.id), ['fresh']);
});

test('active flight session creates a versioned authoritative route snapshot', () => {
  const route = createActiveFlightRoute({
    departure: 'karb',
    destination: 'kaxv',
    waypoints: '75g',
    plannedAltitude: '14000',
    points: [
      { icao: 'KARB', name: 'Ann Arbor', latitude: 42.223, longitude: -83.745 },
      { icao: 'KAXV', name: 'Neil Armstrong', latitude: 40.493, longitude: -84.298 },
    ],
    totalNm: 106.8,
  });
  const session = createActiveFlightSession({
    id: 'session-1',
    entryMode: 'planned_route',
    route,
    now: '2026-07-24T12:00:00.000Z',
  });

  assert.equal(session.schemaVersion, 1);
  assert.equal(session.id, 'session-1');
  assert.equal(session.route?.departure, 'KARB');
  assert.equal(session.route?.points.length, 2);
  assert.equal(session.navigation.activeLegIndex, null);
});

test('active flight session updates navigation, source, traffic, and display state', () => {
  const session = createActiveFlightSession({
    id: 'session-2',
    entryMode: 'blank_vfr',
    now: '2026-07-24T12:00:00.000Z',
  });
  const updated = updateActiveFlightSession(
    session,
    {
      status: 'active',
      navigation: {
        activeLegIndex: 1,
        sequencingSuspended: true,
      },
      phase: 'cruise',
      sourceSnapshot: {
        positionSource: 'gdl90',
        receiverState: 'healthy',
        attitudeSource: 'gdl90_ahrs',
      },
      traffic: {
        targetCount: 3,
        immediateCount: 1,
        lastUpdatedAt: '2026-07-24T12:02:00.000Z',
      },
      display: {
        mode: 'split',
        orientation: 'track-up',
      },
    },
    '2026-07-24T12:02:00.000Z'
  );

  assert.equal(updated.status, 'active');
  assert.equal(updated.startedAt, '2026-07-24T12:02:00.000Z');
  assert.equal(updated.navigation.activeLegIndex, 1);
  assert.equal(updated.navigation.sequencingSuspended, true);
  assert.equal(updated.phase, 'cruise');
  assert.equal(updated.sourceSnapshot.positionSource, 'gdl90');
  assert.equal(updated.traffic.immediateCount, 1);
  assert.equal(updated.display.orientation, 'track-up');
});

test('legacy resume payload migrates into a v1 active flight session', () => {
  const session = createSessionFromLegacyResumePayload({
    departure: 'KARB',
    destination: 'KAXV',
    waypoints: '75G',
    activeFlightSessionId: 'legacy-session',
    savedAt: Date.parse('2026-07-24T12:00:00.000Z'),
  });

  assert.equal(session.id, 'legacy-session');
  assert.equal(session.entryMode, 'resume');
  assert.equal(session.route?.departure, 'KARB');
  assert.equal(session.route?.destination, 'KAXV');
});

test('stored v1 session parses and produces resume route params', () => {
  const session = createActiveFlightSession({
    id: 'session-3',
    entryMode: 'planned_route',
    route: createActiveFlightRoute({ departure: 'KARB', destination: 'KAXV', waypoints: '75G' }),
    now: '2026-07-24T12:00:00.000Z',
  });
  const parsed = parseActiveFlightSession(JSON.parse(JSON.stringify(session)));
  const params = createFlightDeckParamsFromSession(parsed!);

  assert.equal(parsed?.id, 'session-3');
  assert.equal(params.entryMode, 'resume');
  assert.equal(params.activeFlightSessionId, 'session-3');
  assert.equal(params.departure, 'KARB');
  assert.equal(params.destination, 'KAXV');
});

test('source health active source maps into session-safe source names', () => {
  assert.equal(mapPositionSource('receiver'), 'gdl90');
  assert.equal(mapPositionSource('gps'), 'device_gps');
  assert.equal(mapPositionSource('simulation'), 'simulation');
  assert.equal(mapPositionSource('none'), 'none');
});

test('session authority transitions active leg, skipped legs, sequencing, direct-to, and phase', () => {
  const session = createActiveFlightSession({
    id: 'authority-session',
    entryMode: 'planned_route',
    now: '2026-07-24T12:00:00.000Z',
  });
  const directTo = {
    mode: 'direct-to-route' as const,
    origin: { icao: 'KARB', name: 'Ann Arbor', latitude: 42.223, longitude: -83.745 },
    target: { icao: '75G', name: 'Rossettie', latitude: 41.908, longitude: -84.586 },
    activatedAt: '2026-07-24T12:01:00.000Z',
    targetLegIndex: 1,
  };
  const transitioned = transitionOperationalPhase(
    transitionSkippedLegs(
      transitionDirectTo(
        transitionSequencingSuspended(transitionActiveLeg(session, 2, '2026-07-24T12:01:00.000Z'), true),
        directTo,
        '2026-07-24T12:02:00.000Z'
      ),
      [2, 2, 1],
      '2026-07-24T12:03:00.000Z'
    ),
    'cruise',
    '2026-07-24T12:04:00.000Z'
  );

  assert.equal(transitioned.navigation.activeLegIndex, 0);
  assert.equal(transitioned.navigation.sequencingSuspended, false);
  assert.equal(transitioned.navigation.directTo?.target.icao, '75G');
  assert.deepEqual(transitioned.navigation.skippedLegIndexes, [1, 2]);
  assert.equal(transitioned.phase, 'cruise');
});

test('session lifecycle background and foreground do not preserve live source or tactical traffic', () => {
  const session = updateActiveFlightSession(
    createActiveFlightSession({ id: 'lifecycle-session', entryMode: 'planned_route', now: '2026-07-24T12:00:00.000Z' }),
    {
      status: 'active',
      sourceSnapshot: {
        positionSource: 'gdl90',
        receiverState: 'healthy',
        attitudeSource: 'gdl90_ahrs',
      },
      traffic: {
        targetCount: 4,
        immediateCount: 1,
        lastUpdatedAt: '2026-07-24T12:02:00.000Z',
      },
    },
    '2026-07-24T12:02:00.000Z'
  );
  const backgrounded = transitionSessionBackgrounded(session, '2026-07-24T12:03:00.000Z');
  const foregrounded = transitionSessionForegrounded(backgrounded, '2026-07-24T12:04:00.000Z');
  const duplicateForegrounded = transitionSessionForegrounded(foregrounded, '2026-07-24T12:05:00.000Z');

  assert.equal(backgrounded.id, session.id);
  assert.equal(backgrounded.status, 'backgrounded');
  assert.equal(backgrounded.resumeMetadata.lastBackgroundAt, '2026-07-24T12:03:00.000Z');
  assert.equal(foregrounded.id, session.id);
  assert.equal(foregrounded.status, 'active');
  assert.equal(foregrounded.sourceSnapshot.positionSource, 'none');
  assert.equal(foregrounded.sourceSnapshot.receiverState, 'foreground-pending');
  assert.equal(foregrounded.traffic.targetCount, 0);
  assert.equal(duplicateForegrounded.id, session.id);
});

test('storage restore discards corrupt json, unsupported schema, missing id, and invalid phase', () => {
  assert.deepEqual(restoreActiveFlightSessionStorageValue('{not-json').status, 'discard');
  assert.deepEqual(restoreActiveFlightSessionStorageValue(JSON.stringify({ schemaVersion: 99 })).status, 'discard');
  assert.deepEqual(
    restoreActiveFlightSessionStorageValue(
      JSON.stringify({
        schemaVersion: 1,
        status: 'active',
        entryMode: 'planned_route',
        phase: 'cruise',
        createdAt: '2026-07-24T12:00:00.000Z',
        updatedAt: '2026-07-24T12:00:00.000Z',
      })
    ).status,
    'discard'
  );
  assert.deepEqual(
    restoreActiveFlightSessionStorageValue(
      JSON.stringify({
        schemaVersion: 1,
        id: 'bad-phase',
        status: 'active',
        entryMode: 'planned_route',
        phase: 'warp',
        createdAt: '2026-07-24T12:00:00.000Z',
        updatedAt: '2026-07-24T12:00:00.000Z',
      })
    ).status,
    'discard'
  );
});

test('storage restore migrates legacy once into a v1 session', () => {
  const restored = restoreActiveFlightSessionStorageValue(
    JSON.stringify({
      departure: 'KARB',
      destination: 'KAXV',
      waypoints: '75G',
      activeFlightSessionId: 'legacy-once',
      savedAt: Date.parse('2026-07-24T12:00:00.000Z'),
    })
  );

  assert.equal(restored.status, 'migrated');
  assert.equal(restored.migrated, true);
  if (restored.status !== 'migrated') throw new Error('expected migration');
  assert.equal(restored.session.schemaVersion, 1);
  assert.equal(restored.session.id, 'legacy-once');
  assert.equal(restored.session.route?.departure, 'KARB');
});

test('restoring an existing v1 session does not create a duplicate session id', () => {
  const session = createActiveFlightSession({
    id: 'no-duplicate',
    entryMode: 'planned_route',
    now: '2026-07-24T12:00:00.000Z',
  });
  const restored = restoreActiveFlightSessionStorageValue(JSON.stringify(session));
  const restoredAgain = restoreActiveFlightSessionStorageValue(JSON.stringify(session));

  assert.equal(restored.status, 'restored');
  assert.equal(restoredAgain.status, 'restored');
  if (restored.status !== 'restored' || restoredAgain.status !== 'restored') {
    throw new Error('expected restore');
  }
  assert.equal(restored.session.id, 'no-duplicate');
  assert.equal(restoredAgain.session.id, 'no-duplicate');
});
