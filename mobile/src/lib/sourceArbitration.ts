export type FlightDeckSourceTrustTier =
  | 'external-valid'
  | 'limited'
  | 'gps-only'
  | 'device-motion-only'
  | 'none';

export type FlightDeckSourceArbitrationState = {
  tier: FlightDeckSourceTrustTier;
  code: 'EXT' | 'LTD' | 'GPS' | 'MOT' | 'NONE';
  label: string;
  detail: string;
};

export function getFlightDeckSourceArbitrationState(options: {
  simulationEnabled: boolean;
  receiverOwnshipFresh: boolean;
  receiverAttitudeFresh: boolean;
  gpsOwnshipFresh: boolean;
  receiverHealthy: boolean;
  deviceMotionActive?: boolean;
}) : FlightDeckSourceArbitrationState {
  if (options.simulationEnabled || (options.receiverOwnshipFresh && options.receiverAttitudeFresh)) {
    return {
      tier: 'external-valid',
      code: 'EXT',
      label: 'External valid',
      detail: options.simulationEnabled
        ? 'Simulation playback is driving ownship and attitude.'
        : 'Receiver ownship and AHRS are current.',
    };
  }

  if (options.receiverOwnshipFresh || options.receiverHealthy) {
    return {
      tier: 'limited',
      code: 'LTD',
      label: 'Limited source',
      detail: 'Receiver ownship is available, but pilot-grade attitude is not current.',
    };
  }

  if (options.gpsOwnshipFresh) {
    return {
      tier: 'gps-only',
      code: 'GPS',
      label: 'GPS only',
      detail: 'Guidance and map follow use device GPS only.',
    };
  }

  if (options.deviceMotionActive) {
    return {
      tier: 'device-motion-only',
      code: 'MOT',
      label: 'Device motion only',
      detail: 'Device motion is present but not trusted for synthetic attitude.',
    };
  }

  return {
    tier: 'none',
    code: 'NONE',
    label: 'No valid source',
    detail: 'No current ownship or pilot-grade attitude source is active.',
  };
}
