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
