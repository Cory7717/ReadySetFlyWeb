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
  updateActiveFlightSession,
} from '../../mobile/src/lib/activeFlightSession';

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
