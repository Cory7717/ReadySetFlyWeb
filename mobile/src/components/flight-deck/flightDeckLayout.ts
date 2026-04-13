export type FlightDeckDisplayMode = 'split' | 'map' | 'vision';
export type FlightDeckMapOrientationMode = 'track-up' | 'heading-up' | 'north-up';

export type FlightDeckLayoutProfile = {
  width: number;
  height: number;
  shortestSide: number;
  longestSide: number;
  isLandscape: boolean;
  isPortrait: boolean;
  deviceClass: 'phone' | 'large-phone' | 'tablet';
  allowSplitView: boolean;
  useCompactChrome: boolean;
  defaultDisplayMode: FlightDeckDisplayMode;
  defaultFocusMode: boolean;
  showTabletRecommendation: boolean;
  signature: string;
};

type GetFlightDeckLayoutProfileArgs = {
  width: number;
  height: number;
};

export function getFlightDeckLayoutProfile({
  width,
  height,
}: GetFlightDeckLayoutProfileArgs): FlightDeckLayoutProfile {
  const safeWidth = Math.max(0, Math.round(width));
  const safeHeight = Math.max(0, Math.round(height));
  const shortestSide = Math.min(safeWidth, safeHeight);
  const longestSide = Math.max(safeWidth, safeHeight);
  const isLandscape = safeWidth >= safeHeight;
  const isPortrait = !isLandscape;
  const isTablet = shortestSide >= 600;
  const isLargePhone = !isTablet && longestSide >= 820;
  const allowSplitView = isTablet || (isLandscape && shortestSide >= 390 && longestSide >= 740);
  const defaultDisplayMode: FlightDeckDisplayMode =
    isTablet && isLandscape && allowSplitView ? 'split' : 'map';
  const deviceClass = isTablet ? 'tablet' : isLargePhone ? 'large-phone' : 'phone';

  return {
    width: safeWidth,
    height: safeHeight,
    shortestSide,
    longestSide,
    isLandscape,
    isPortrait,
    deviceClass,
    allowSplitView,
    useCompactChrome: !isTablet,
    defaultDisplayMode,
    defaultFocusMode: !isTablet,
    showTabletRecommendation: !isTablet,
    signature: [
      deviceClass,
      isLandscape ? 'landscape' : 'portrait',
      allowSplitView ? 'split' : 'single',
      defaultDisplayMode,
    ].join(':'),
  };
}

export function sanitizeFlightDeckDisplayMode(
  mode: FlightDeckDisplayMode | string | null | undefined,
  profile: FlightDeckLayoutProfile,
): FlightDeckDisplayMode {
  if (mode === 'map' || mode === 'vision') {
    return mode;
  }
  if (mode === 'split' && profile.allowSplitView) {
    return mode;
  }
  return profile.defaultDisplayMode === 'split' && !profile.allowSplitView
    ? 'map'
    : profile.defaultDisplayMode;
}

export function getFlightDeckDisplayModeOptions(profile: FlightDeckLayoutProfile) {
  const orderedModes: FlightDeckDisplayMode[] = profile.allowSplitView
    ? ['map', 'split', 'vision']
    : ['map', 'vision'];

  return orderedModes.map((mode) => ({
    mode,
    label: mode === 'map' ? 'Map' : mode === 'split' ? 'Split' : 'Vision',
  }));
}

export function getMapOrientationHeading(options: {
  orientationMode: FlightDeckMapOrientationMode;
  trackHeadingDeg?: number | null;
  attitudeHeadingDeg?: number | null;
  speedKts?: number | null;
}) {
  const { orientationMode, trackHeadingDeg, attitudeHeadingDeg, speedKts } = options;
  const trackValid =
    typeof trackHeadingDeg === 'number' &&
    Number.isFinite(trackHeadingDeg) &&
    (speedKts == null || speedKts >= 25);
  const headingValid =
    typeof attitudeHeadingDeg === 'number' && Number.isFinite(attitudeHeadingDeg);

  if (orientationMode === 'north-up') {
    return 0;
  }

  if (orientationMode === 'heading-up') {
    if (headingValid) return attitudeHeadingDeg as number;
    return trackValid ? (trackHeadingDeg as number) : 0;
  }

  return trackValid ? (trackHeadingDeg as number) : 0;
}
