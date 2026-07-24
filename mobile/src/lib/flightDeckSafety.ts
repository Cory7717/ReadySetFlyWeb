export const FLIGHT_DECK_RECEIVER_OWNSHIP_STALE_MS = 15000;
export const FLIGHT_DECK_DEVICE_OWNSHIP_STALE_MS = 15000;
export const FLIGHT_DECK_RECEIVER_ATTITUDE_STALE_MS = 5000;
export const FLIGHT_DECK_TRAFFIC_STALE_MS = 2 * 60 * 1000;

export type FlightDeckSourceName = 'simulation' | 'receiver' | 'gps' | 'none';

export type FlightDeckSourceHealth = {
  activeSource: FlightDeckSourceName;
  receiverOwnshipAgeMs: number | null;
  receiverAttitudeAgeMs: number | null;
  gpsOwnshipAgeMs: number | null;
  receiverOwnshipFresh: boolean;
  receiverAttitudeFresh: boolean;
  gpsOwnshipFresh: boolean;
  receiverPacketCurrent: boolean;
  label: string;
  detail: string;
};

type ReceiverHealthLike = {
  ownshipFresh?: boolean;
  attitudeFresh?: boolean;
  trafficFresh?: boolean;
  heartbeatFresh?: boolean;
} | null | undefined;

function getAgeMs(nowMs: number, updatedAt?: number | null) {
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt) || updatedAt <= 0) return null;
  return Math.max(0, nowMs - updatedAt);
}

function isFresh(ageMs: number | null, staleMs: number) {
  return ageMs != null && ageMs <= staleMs;
}

export function deriveFlightDeckSourceHealth(options: {
  nowMs: number;
  simulationEnabled: boolean;
  simulationOwnshipAvailable: boolean;
  receiverOwnshipUpdatedAt?: number | null;
  receiverAttitudeUpdatedAt?: number | null;
  gpsOwnshipUpdatedAt?: number | null;
  receiverHealth?: ReceiverHealthLike;
  receiverOwnshipStaleMs?: number;
  receiverAttitudeStaleMs?: number;
  gpsOwnshipStaleMs?: number;
}): FlightDeckSourceHealth {
  const receiverOwnshipAgeMs = getAgeMs(options.nowMs, options.receiverOwnshipUpdatedAt);
  const receiverAttitudeAgeMs = getAgeMs(options.nowMs, options.receiverAttitudeUpdatedAt);
  const gpsOwnshipAgeMs = getAgeMs(options.nowMs, options.gpsOwnshipUpdatedAt);
  const receiverOwnshipFresh = isFresh(
    receiverOwnshipAgeMs,
    options.receiverOwnshipStaleMs ?? FLIGHT_DECK_RECEIVER_OWNSHIP_STALE_MS
  );
  const receiverAttitudeFresh = isFresh(
    receiverAttitudeAgeMs,
    options.receiverAttitudeStaleMs ?? FLIGHT_DECK_RECEIVER_ATTITUDE_STALE_MS
  );
  const gpsOwnshipFresh = isFresh(
    gpsOwnshipAgeMs,
    options.gpsOwnshipStaleMs ?? FLIGHT_DECK_DEVICE_OWNSHIP_STALE_MS
  );
  const receiverPacketCurrent = Boolean(
    options.receiverHealth?.ownshipFresh ||
      options.receiverHealth?.attitudeFresh ||
      options.receiverHealth?.trafficFresh ||
      options.receiverHealth?.heartbeatFresh ||
      receiverOwnshipFresh ||
      receiverAttitudeFresh
  );
  const activeSource: FlightDeckSourceName =
    options.simulationEnabled && options.simulationOwnshipAvailable
      ? 'simulation'
      : receiverOwnshipFresh
        ? 'receiver'
        : gpsOwnshipFresh
          ? 'gps'
          : 'none';
  const label =
    activeSource === 'simulation'
      ? 'Simulation'
      : activeSource === 'receiver'
        ? 'Receiver ownship'
        : activeSource === 'gps'
          ? 'Device GPS'
          : 'No current ownship';
  const detail =
    activeSource === 'simulation'
      ? 'Simulation is driving the Flight Deck.'
      : activeSource === 'receiver'
        ? 'Current GDL-90 receiver ownship is driving the Flight Deck.'
        : activeSource === 'gps'
          ? 'Device GPS is driving the Flight Deck because receiver ownship is unavailable or stale.'
          : 'No current ownship source is available for guidance.';

  return {
    activeSource,
    receiverOwnshipAgeMs,
    receiverAttitudeAgeMs,
    gpsOwnshipAgeMs,
    receiverOwnshipFresh,
    receiverAttitudeFresh,
    gpsOwnshipFresh,
    receiverPacketCurrent,
    label,
    detail,
  };
}

export function expireFlightDeckTrafficTargets<T extends { updatedAt?: number | null }>(
  targets: T[],
  nowMs = Date.now(),
  staleMs = FLIGHT_DECK_TRAFFIC_STALE_MS
) {
  return targets.filter((target) => {
    const ageMs = getAgeMs(nowMs, target.updatedAt);
    return ageMs != null && ageMs < staleMs;
  });
}
