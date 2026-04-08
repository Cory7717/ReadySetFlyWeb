import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polygon, Polyline, UrlTile } from 'react-native-maps';
import { Platform } from 'react-native';
import { PROVIDER_GOOGLE } from 'react-native-maps';
import { colors, spacing } from '../../styles/theme';
import type { FlightDeckStateProps, FlightDeckActionsProps } from './FlightDeckViewTypes';

type FlightDeckViewProps = {
  state: FlightDeckStateProps;
  actions: FlightDeckActionsProps;
  styles: Record<string, any>;
};

function formatSourceAge(ms: number | null | undefined) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '--';
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function FlightDeckSurfaceSchematic({ preview, styles }: { preview: any; styles: any }) {
  if (!preview) return null;

  const renderSegment = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    key: string,
    style: any,
  ) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = `${Math.atan2(dy, dx)}rad`;
    return (
      <View
        key={key}
        style={[
          style,
          {
            left: `${(start.x + end.x) / 2}%`,
            top: `${(start.y + end.y) / 2}%`,
            width: `${length}%`,
            marginLeft: `${-length / 2}%`,
            marginTop: -2,
            transform: [{ rotate: angle }],
          },
        ]}
      />
    );
  };

  return (
    <View style={styles.flightDeckSurfaceCard}>
      <Text style={styles.flightDeckPanelTitle}>Airport Surface</Text>
      <Text style={styles.flightDeckPanelText}>{preview.headline}</Text>
      <View style={styles.flightDeckSurfaceDiagram}>
        <View style={styles.flightDeckSurfaceDiagramFrame}>
          <View style={styles.flightDeckSurfaceRunway} />
          <View style={styles.flightDeckSurfaceRunwayCenterline} />
          <Text style={styles.flightDeckSurfaceRunwayLabelTop}>{preview.runwayId}</Text>
          <Text style={styles.flightDeckSurfaceRunwayLabelBottom}>{preview.runwayId}</Text>
          <View
            style={[
              styles.flightDeckSurfaceHoldShort,
              preview.holdShortActive ? styles.flightDeckSurfaceHoldShortActive : null,
            ]}
          />
          {preview.secondaryRoute.map((point: any, index: number) => {
            if (index === preview.secondaryRoute.length - 1) return null;
            return renderSegment(point, preview.secondaryRoute[index + 1], `surface-secondary-${index}`, styles.flightDeckSurfaceSecondaryRoute);
          })}
          {preview.route.map((point: any, index: number) => {
            if (index === preview.route.length - 1) return null;
            return renderSegment(point, preview.route[index + 1], `surface-route-${index}`, styles.flightDeckSurfaceRoute);
          })}
          <View
            style={[
              styles.flightDeckSurfaceOwnship,
              {
                left: `${preview.ownship.x}%`,
                top: `${preview.ownship.y}%`,
                transform: [{ rotate: `${preview.ownship.headingDeg}deg` }],
              },
            ]}
          >
            <Ionicons name="navigate" size={16} color={colors.flightBackground} />
          </View>
          {preview.runwayOccupied ? (
            <View style={styles.flightDeckSurfaceOccupiedBadge}>
              <Text style={styles.flightDeckSurfaceOccupiedText}>OCC</Text>
            </View>
          ) : null}
          <Text style={styles.flightDeckSurfaceRampLabel}>RAMP</Text>
          <Text style={styles.flightDeckSurfaceTaxiLabelA}>A</Text>
          <Text style={styles.flightDeckSurfaceTaxiLabelB}>B</Text>
        </View>
      </View>
      <View style={styles.flightDeckSurfaceStatusRow}>
        <View style={styles.flightDeckSurfaceStatusCard}>
          <Text style={styles.flightDeckContextCardEyebrow}>Surface Guidance</Text>
          <Text style={styles.flightDeckContextCardTitle}>{preview.routeCall}</Text>
          <Text style={styles.flightDeckContextCardText}>{preview.support}</Text>
        </View>
        <View style={styles.flightDeckSurfaceStatusCard}>
          <Text style={styles.flightDeckContextCardEyebrow}>Runway and Comms</Text>
          <Text style={styles.flightDeckContextCardTitle}>{preview.runwayMeta}</Text>
          <Text style={styles.flightDeckContextCardText}>
            GND {preview.groundFreq} - TWR {preview.towerFreq} - ATIS {preview.atisFreq}
          </Text>
        </View>
      </View>
      <View style={styles.flightDeckControlRow}>
        <View
          style={[
            styles.flightDeckChip,
            preview.holdShortActive ? styles.flightDeckChipWarning : styles.flightDeckChipActive,
          ]}
        >
          <Text
            style={[
              styles.flightDeckChipText,
              preview.holdShortActive ? styles.flightDeckChipTextWarning : styles.flightDeckChipTextActive,
            ]}
          >
            {preview.holdShortActive ? 'Hold short' : 'Taxi cleared'}
          </Text>
        </View>
        <View
          style={[
            styles.flightDeckChip,
            preview.runwayOccupied ? styles.flightDeckChipWarning : null,
          ]}
        >
          <Text
            style={[
              styles.flightDeckChipText,
              preview.runwayOccupied ? styles.flightDeckChipTextWarning : null,
            ]}
          >
            {preview.runwayOccupied ? 'Runway occupied' : 'Runway open'}
          </Text>
        </View>
      </View>
      <Text style={styles.flightDeckPanelText}>{preview.clearanceLabel}</Text>
    </View>
  );
}

function FlightDeckSurfaceMap({ preview, styles }: { preview: any; styles: any }) {
  if (!preview?.surfaceRegion) return <FlightDeckSurfaceSchematic preview={preview} styles={styles} />;

  const surfacePolygons = Array.isArray(preview.surfaceFeatures)
    ? preview.surfaceFeatures.filter((feature: any) => feature?.geometry?.type === 'Polygon')
    : [];
  const surfaceLines = Array.isArray(preview.surfaceFeatures)
    ? preview.surfaceFeatures.filter((feature: any) => feature?.geometry?.type === 'LineString')
    : [];

  return (
    <View style={styles.flightDeckSurfaceCard}>
      <Text style={styles.flightDeckPanelTitle}>Airport Surface</Text>
      <Text style={styles.flightDeckPanelText}>{preview.headline}</Text>
      <View style={styles.flightDeckSurfaceDiagram}>
        <MapView
          style={styles.flightDeckSurfaceMap}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          region={preview.surfaceRegion}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          showsCompass={false}
          showsBuildings={false}
          showsIndoors={false}
          mapType="standard"
        >
          {surfacePolygons.map((feature: any, index: number) => (
            <Polygon
              key={`surface-polygon-${index}`}
              coordinates={(feature.geometry.coordinates?.[0] || []).map(([lon, lat]: [number, number]) => ({
                latitude: lat,
                longitude: lon,
              }))}
              strokeColor={
                feature.properties?.aeroway === 'runway'
                  ? 'rgba(232,237,244,0.72)'
                  : feature.properties?.aeroway === 'apron'
                    ? 'rgba(160,170,186,0.5)'
                    : 'rgba(104,122,150,0.45)'
              }
              fillColor={
                feature.properties?.aeroway === 'runway'
                  ? 'rgba(232,237,244,0.14)'
                  : feature.properties?.aeroway === 'apron'
                    ? 'rgba(110,122,142,0.14)'
                    : 'rgba(77,107,143,0.1)'
              }
              strokeWidth={1.5}
            />
          ))}
          {surfaceLines.map((feature: any, index: number) => (
            <Polyline
              key={`surface-line-${index}`}
              coordinates={(feature.geometry.coordinates || []).map(([lon, lat]: [number, number]) => ({
                latitude: lat,
                longitude: lon,
              }))}
              strokeColor={
                feature.properties?.aeroway === 'runway'
                  ? 'rgba(232,237,244,0.8)'
                  : feature.properties?.aeroway === 'holding_position'
                    ? colors.flightWarning
                    : 'rgba(90,160,255,0.7)'
              }
              strokeWidth={feature.properties?.aeroway === 'holding_position' ? 4 : feature.properties?.aeroway === 'runway' ? 3 : 2}
            />
          ))}
          {preview.geoRunwayCenterline?.length > 1 ? (
            <Polyline
              coordinates={preview.geoRunwayCenterline.map((point: any) => ({
                latitude: point.lat,
                longitude: point.lon,
              }))}
              strokeColor="rgba(232,237,244,0.95)"
              strokeWidth={2}
            />
          ) : null}
          {preview.geoRunwayBar?.length > 1 ? (
            <Polyline
              coordinates={preview.geoRunwayBar.map((point: any) => ({
                latitude: point.lat,
                longitude: point.lon,
              }))}
              strokeColor={colors.flightAccent}
              strokeWidth={4}
            />
          ) : null}
          {preview.geoCompletedRoute?.length > 1 ? (
            <Polyline
              coordinates={preview.geoCompletedRoute.map((point: any) => ({
                latitude: point.lat,
                longitude: point.lon,
              }))}
              strokeColor="rgba(0,212,160,0.95)"
              strokeWidth={4}
            />
          ) : null}
          {preview.geoUpcomingRoute?.length > 1 ? (
            <Polyline
              coordinates={preview.geoUpcomingRoute.map((point: any) => ({
                latitude: point.lat,
                longitude: point.lon,
              }))}
              strokeColor={colors.flightAccent}
              strokeWidth={4}
              lineDashPattern={[10, 8]}
            />
          ) : null}
          {preview.geoOwnship?.lat && preview.geoOwnship?.lon ? (
            <Marker
              coordinate={{ latitude: preview.geoOwnship.lat, longitude: preview.geoOwnship.lon }}
              anchor={{ x: 0.5, y: 0.5 }}
              flat
              rotation={preview.geoOwnship.headingDeg || 0}
            >
              <View style={styles.flightDeckSurfaceOwnshipMap}>
                <Ionicons name="navigate" size={16} color={colors.flightBackground} />
              </View>
            </Marker>
          ) : null}
        </MapView>
      </View>
      <View style={styles.flightDeckSurfaceStatusRow}>
        <View style={styles.flightDeckSurfaceStatusCard}>
          <Text style={styles.flightDeckContextCardEyebrow}>Surface Guidance</Text>
          <Text style={styles.flightDeckContextCardTitle}>{preview.progressCall}</Text>
          <Text style={styles.flightDeckContextCardText}>
            {preview.routeCall}
            {preview.activeTaxiway ? ` Active ${preview.activeTaxiway}.` : ''}
          </Text>
        </View>
        <View style={styles.flightDeckSurfaceStatusCard}>
          <Text style={styles.flightDeckContextCardEyebrow}>{preview.cameraModeLabel || 'Taxi Sequence'}</Text>
          <Text style={styles.flightDeckContextCardTitle}>{preview.nextActionCall}</Text>
          <Text style={styles.flightDeckContextCardText}>
            {preview.upcomingTaxiways?.length ? `Upcoming ${preview.upcomingTaxiways.join(' -> ')}.` : preview.support}
            {typeof preview.nextTurnDistanceNm === 'number' ? ` Turn in ${preview.nextTurnDistanceNm.toFixed(2)} NM.` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.flightDeckControlRow}>
        <View
          style={[
            styles.flightDeckChip,
            preview.holdShortActive ? styles.flightDeckChipWarning : styles.flightDeckChipActive,
          ]}
        >
          <Text
            style={[
              styles.flightDeckChipText,
              preview.holdShortActive ? styles.flightDeckChipTextWarning : styles.flightDeckChipTextActive,
            ]}
          >
            {preview.holdShortActive ? 'Hold short' : preview.activeTaxiway || 'Taxi active'}
          </Text>
        </View>
        <View
          style={[
            styles.flightDeckChip,
            preview.runwayOccupied ? styles.flightDeckChipWarning : null,
          ]}
        >
          <Text
            style={[
              styles.flightDeckChipText,
              preview.runwayOccupied ? styles.flightDeckChipTextWarning : null,
            ]}
          >
            {preview.runwayOccupied ? 'Runway occupied' : 'Runway clear'}
          </Text>
        </View>
      </View>
      <Text style={styles.flightDeckPanelText}>{preview.clearanceLabel}</Text>
    </View>
  );
}

export default function FlightDeckView({ state, actions, styles = {} }: FlightDeckViewProps) {
  const {
    insets,
    navigation,
    departure,
    destination,
    waypoints,
    plannedStops,
    plannedAltitude,
    cruiseKtas,
    routeHeadline,
    flightDeckSessionState,
    flightDeckPhaseSummary,
    routeProgress,
    routeExecutionSummary,
    activeExecutionPlanView = [],
    flightDeckView,
    flightDeckChromeVisible,
    flightDeckDrawerOpen,
    terrainRisk,
    visionRouteGuidance,
    visionTerrainColumns = [],
    visionDirectorCue = {
      lateralOffsetPct: 0,
      verticalOffsetPct: 0,
      lateralCaptured: false,
      verticalCaptured: false,
      mode: 'track',
      turnCommand: 'Track centered',
      verticalCommand: 'Hold altitude',
    },
    flightDeckVerticalPathSummary = {
      modeLabel: 'Vertical pending',
      guidanceMode: 'hold',
      targetAltitudeFt: null,
      verticalErrorFt: null,
      requiredVsiFpm: null,
      topOfDescentNm: null,
      distanceToTodNm: null,
      advisoryCall: 'Vertical path pending',
      support: 'Awaiting route and ownship.',
      recommendation: 'Set a planned altitude.',
      cueLabel: 'ALT',
      manualBugActive: false,
    },
    flightDeckVerticalConstraintSummary = {
      modeLabel: 'Heuristic path',
      sourceLabel: 'Heuristic',
      targetAltitudeFt: null,
      requiredVsiFpm: null,
      support: 'No structured vertical constraint is active yet.',
      recommendation: 'Continue using the advisory path model.',
      call: 'Vertical path pending',
      activeConstraintLabel: 'Advisory path',
      nextConstraintLabel: null,
      nextConstraintArmed: false,
      activeConstraintDistanceNm: null,
      constraintGateState: 'monitor',
      constraintGateCall: 'Vertical path monitor',
    },
    flightDeckVerticalAlertSummary = {
      severity: null,
      title: null,
      detail: null,
      deviationLabel: 'VNAV pending',
      todLabel: 'TOD pending',
    },
    visionVerticalCueLabel,
    visionGuidance,
    terrainEscapeGuidance,
    visionTrafficCue,
    visionObstacleCues = [],
    terrainClearanceFt,
    terrainProfileLoading,
    obstacleRisk,
    obstacleClearanceFt,
    obstacleScanLoading,
    selectedTrafficTarget,
    visionManeuverRecommendation,
    mapRef,
    mapStyle,
    routePoints = [],
    activeOwnship,
    activeAttitude,
    ownshipSourceSummary,
    headingSourceSummary,
    attitudeSourceSummary,
    visionReadinessSummary,
    receiverStatusSummary,
    receiverHealth,
    receiverOwnshipAgeMs,
    receiverOwnshipFresh,
    gpsOwnshipAgeMs,
    gpsOwnshipFresh,
    showCloudsGlobal,
    gibsDate,
    cloudTileUrl,
    cloudFrameIndex,
    visibleWindsPoints = [],
    selectedDiversionPoint,
    selectedDiversionIcao,
    diversionCandidates = [],
    visibleTrafficTargets = [],
    mapDisplayTrafficTargets = [],
    mapTrafficPresentation = [],
    mapRouteDisplay = { completed: [], activeLeg: [], upcoming: [] },
    mapVerticalGuidancePresentation = null,
    selectedDiversion,
    selectedDiversionRunwaySummary,
    departureBriefing,
    departureBriefingLoading,
    destinationBriefingLoading,
    destinationRunwayCue,
    destinationRunwayOverlay,
    activeRunwayOverlay,
    activeRunwayOverlayLabel,
    departureFrequenciesLoading,
    destinationFrequenciesLoading,
    flightDeckSurfacePreview,
    flightDeckRunwayOpsSummary,
    selectedDiversionBestComm,
    selectedTrafficTrend,
    mapTacticalSummary = {
      modeLabel: 'Track',
      heading: 'Track centered',
      vertical: 'Hold altitude',
      verticalSupport: 'Awaiting vertical path',
      verticalConstraintCall: 'Path monitor active',
      recommendation: 'Monitor route',
    },
    mapOverlayProfile = {
      label: 'Enroute priority',
      activeLegWidth: 5,
      completedLegWidth: 2.5,
      upcomingLegWidth: 3,
      upcomingLegOpacity: 0.42,
      runwayEmphasisWidth: 10,
      showTrafficVectors: true,
      showMonitorAltitudeTags: true,
      maxWindMarkers: 12,
      radarOpacity: 0.75,
      cloudOpacity: 0.75,
    },
    mapRunwayFocusSummary = { emphasize: false, label: 'Route corridor' },
    tacticalMapRegion,
    flightDeckTargetAltitudeFt,
    flightDeckVisibleAlert,
    flightDeckLowerStackBottom,
    flightDeckTrafficCardVisible,
    flightDeckDiversionCardVisible,
    flightDeckActionButtons = [],
    flightDeckHudExpanded,
    activeVerticalSpeedFpm,
    immediateTrafficCount,
    routeRiskLabel,
    flightDeckPanel,
    simulationEnabled,
    gpsEnabled,
    trafficEnabled,
    isSuperAdmin,
    simulationProgress,
    simulationSpeed,
    simulationConflictEnabled,
    summaryCounts = { winds: 0, notams: 0, pireps: 0, convective: 0, icing: 0, turbulence: 0 },
    topTrafficTarget,
    trafficPanelTargets = [],
    diversionPanelAirports = [],
    terrainProfile,
    obstacleScan,
    selectedDiversionBriefingLoading,
    selectedDiversionBriefing,
    flightDeckCommandBankDeg = 0,
    flightDeckBankTicks = [],
    trafficFilter,
    formatAltitudeDelta,
  } = state;

  const visionRollDeg = Math.max(-45, Math.min(45, activeAttitude?.rollDeg ?? 0));
  const visionPitchDeg = Math.max(-20, Math.min(20, activeAttitude?.pitchDeg ?? 0));
  const visionPitchTranslateY = visionPitchDeg * 5.5;
  const visionActualBankOffset = visionRollDeg * 1.12;
  const visionCommandBankOffset = Math.max(-45, Math.min(45, flightDeckCommandBankDeg || 0)) * 1.12;
  const visionPitchMarks = [-20, -15, -10, -5, 5, 10, 15, 20];
  const visionVerticalDeviationValue =
    flightDeckVerticalConstraintSummary.targetAltitudeFt != null
      ? flightDeckVerticalConstraintSummary.targetAltitudeFt - (activeOwnship?.altitudeFt ?? flightDeckVerticalPathSummary.targetAltitudeFt ?? 0)
      : flightDeckVerticalPathSummary.verticalErrorFt ?? 0;
  const visionVerticalDeviationOffset = Math.max(-30, Math.min(30, (visionVerticalDeviationValue / 600) * 26));
  const visionVerticalStateLabel =
    flightDeckVerticalConstraintSummary.targetAltitudeFt != null
      ? flightDeckVerticalConstraintSummary.nextConstraintArmed
        ? 'VPTH'
        : 'VNAV'
      : visionVerticalCueLabel === 'DES'
        ? 'DES'
        : visionVerticalCueLabel === 'CLB'
          ? 'CLB'
          : 'ALT';

  const {
    pulseFlightDeckChrome = () => {},
    toggleFlightDeckView = () => {},
    toggleFlightDeckHud = () => {},
    setMapRegion = () => {},
    setSelectedDiversionIcao = () => {},
    setSelectedTrafficId = () => {},
    setFlightDeckDrawerOpen = () => {},
    setFlightDeckPanel = () => {},
    setTrafficEnabled = () => {},
    setGpsEnabled = () => {},
    setSimulationEnabled = () => {},
    setSimulationSpeed = () => {},
    setSimulationConflictEnabled = () => {},
    setMapStyle = () => {},
    setTrafficFilter = () => {},
    focusDiversionAirport = () => {},
    engageDirectToDiversion = () => {},
    resumePlannedRoute = () => {},
    toggleSequencingSuspend = () => {},
    sequencePreviousLeg = () => {},
    sequenceNextLeg = () => {},
    focusTrafficTarget = () => {},
    setAlternate = () => {},
  } = actions;

  const activeExecutionPlanEntry =
    typeof routeExecutionSummary?.activeLegIndex === 'number'
      ? activeExecutionPlanView[routeExecutionSummary.activeLegIndex] || null
      : null;
  const nextExecutionPlanEntry =
    typeof routeExecutionSummary?.activeLegIndex === 'number'
      ? activeExecutionPlanView[routeExecutionSummary.activeLegIndex + 1] || null
      : null;

  const ownshipStatusLabel =
    ownshipSourceSummary?.code === 'SIM'
      ? 'SIM LIVE'
      : ownshipSourceSummary?.code === 'RXR'
        ? 'RXR LIVE'
        : ownshipSourceSummary?.code === 'GPS'
          ? 'GPS LIVE'
          : ownshipSourceSummary?.code === 'STALE'
            ? 'STALE'
            : 'PREFLT';
  const ownshipStatusTone =
    ownshipSourceSummary?.code === 'SIM'
      ? 'accent'
      : ownshipSourceSummary?.code === 'RXR'
        ? 'active'
        : ownshipSourceSummary?.code === 'GPS'
          ? 'default'
          : ownshipSourceSummary?.code === 'STALE'
            ? 'warning'
            : 'default';
  const ownshipFreshnessText =
    ownshipSourceSummary?.code === 'RXR'
      ? `Receiver ${formatSourceAge(receiverOwnshipAgeMs)}`
      : ownshipSourceSummary?.code === 'GPS'
        ? `GPS ${formatSourceAge(gpsOwnshipAgeMs)}`
        : ownshipSourceSummary?.freshness || 'Awaiting source';

  return (
    <View style={styles.flightDeckContainer}>
      <View style={styles.flightDeckMapShell}>
        {flightDeckView === 'vision' ? (
          <View style={styles.flightDeckVisionShell}>
            <View
              style={{
                position: 'absolute',
                inset: 0,
                transform: [
                  { translateY: visionPitchTranslateY },
                  { rotate: `${visionRollDeg}deg` },
                ],
              }}
            >
              <View style={styles.flightDeckVisionSky} />
              <View
                style={[
                  styles.flightDeckVisionGround,
                  terrainRisk === 'warning'
                    ? styles.flightDeckVisionGroundWarning
                    : terrainRisk === 'caution'
                      ? styles.flightDeckVisionGroundCaution
                      : null,
                ]}
              />
              <View
                style={[
                  styles.flightDeckVisionHorizon,
                  terrainRisk === 'warning'
                    ? styles.flightDeckVisionHorizonWarning
                    : terrainRisk === 'caution'
                      ? styles.flightDeckVisionHorizonCaution
                      : null,
                ]}
              />
              {visionPitchMarks.map((value) => {
                const major = Math.abs(value) % 10 === 0;
                return (
                  <View
                    key={`vision-ladder-${value}`}
                    style={[
                      styles.flightDeckVisionPitchMark,
                      { top: `${50 - value * 2.15}%` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.flightDeckVisionPitchMarkLabel,
                        styles.flightDeckVisionPitchMarkLabelLeft,
                      ]}
                    >
                      {Math.abs(value)}
                    </Text>
                    <View
                      style={[
                        styles.flightDeckVisionPitchMarkWing,
                        styles.flightDeckVisionPitchMarkWingLeft,
                        major
                          ? styles.flightDeckVisionPitchMarkWingMajor
                          : styles.flightDeckVisionPitchMarkWingMinor,
                      ]}
                    />
                    <View
                      style={[
                        styles.flightDeckVisionPitchMarkWing,
                        styles.flightDeckVisionPitchMarkWingRight,
                        major
                          ? styles.flightDeckVisionPitchMarkWingMajor
                          : styles.flightDeckVisionPitchMarkWingMinor,
                      ]}
                    />
                    <Text
                      style={[
                        styles.flightDeckVisionPitchMarkLabel,
                        styles.flightDeckVisionPitchMarkLabelRight,
                      ]}
                    >
                      {Math.abs(value)}
                    </Text>
                  </View>
                );
              })}
              {visionRouteGuidance ? (
                <View
                  style={[
                    styles.flightDeckVisionCenterline,
                    { left: `${visionRouteGuidance.centerlineLeftPct}%` },
                  ]}
                />
              ) : null}
              {visionRouteGuidance?.gates.map((gate: any) => (
                <View
                  key={gate.key}
                  style={[
                    styles.flightDeckVisionRouteGate,
                    {
                      left: `${gate.leftPct}%`,
                      top: `${gate.topPct}%`,
                      width: `${gate.widthPct}%`,
                      height: `${gate.heightPct}%`,
                    },
                    routeProgress?.offRouteNm && routeProgress.offRouteNm > 1.5
                      ? styles.flightDeckVisionRouteGateCaution
                      : null,
                  ]}
                />
              ))}
              {visionRouteGuidance?.tunnelBands.map((band: any) => (
                <View
                  key={band.key}
                  style={[
                    styles.flightDeckVisionTunnelBand,
                    {
                      left: `${band.leftPct}%`,
                      top: `${band.topPct}%`,
                      width: `${band.widthPct}%`,
                      height: `${band.heightPct}%`,
                    },
                    visionRouteGuidance.corridorSeverity === 'warning'
                      ? styles.flightDeckVisionTunnelBandWarning
                      : visionRouteGuidance.corridorSeverity === 'caution'
                        ? styles.flightDeckVisionTunnelBandCaution
                        : null,
                  ]}
                />
              ))}
              {destinationRunwayCue ? (
                <>
                  <View
                    style={[
                      styles.flightDeckVisionRunwayCenterline,
                      {
                        left: `${destinationRunwayCue.centerlineLeftPct}%`,
                        top: `${destinationRunwayCue.centerlineTopPct}%`,
                        height: `${destinationRunwayCue.centerlineHeightPct}%`,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.flightDeckVisionRunwayEdge,
                      {
                        left: `${destinationRunwayCue.leftPct}%`,
                        top: `${destinationRunwayCue.topPct}%`,
                        height: `${destinationRunwayCue.heightPct}%`,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.flightDeckVisionRunwayEdge,
                      {
                        left: `${destinationRunwayCue.leftPct + destinationRunwayCue.widthPct}%`,
                        top: `${destinationRunwayCue.topPct}%`,
                        height: `${destinationRunwayCue.heightPct}%`,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.flightDeckVisionRunwayBox,
                      {
                        left: `${destinationRunwayCue.leftPct}%`,
                        top: `${destinationRunwayCue.topPct}%`,
                        width: `${destinationRunwayCue.widthPct}%`,
                        height: `${destinationRunwayCue.heightPct}%`,
                      },
                    ]}
                  />
                  {[0.22, 0.4, 0.58, 0.76].map((offset, index) => (
                    <View
                      key={`runway-dash-${index}`}
                      style={[
                        styles.flightDeckVisionRunwayDash,
                        {
                          left: `${destinationRunwayCue.centerlineLeftPct}%`,
                          top: `${destinationRunwayCue.topPct + destinationRunwayCue.heightPct * offset}%`,
                        },
                      ]}
                    />
                  ))}
                  {[0.28, 0.72].map((offset, index) => (
                    <View
                      key={`runway-stripe-left-${index}`}
                      style={[
                        styles.flightDeckVisionRunwayThresholdStripe,
                        {
                          left: `${destinationRunwayCue.leftPct + destinationRunwayCue.widthPct * offset}%`,
                          top: `${destinationRunwayCue.topPct + destinationRunwayCue.heightPct * 0.18}%`,
                        },
                      ]}
                    />
                  ))}
                  {[0.28, 0.72].map((offset, index) => (
                    <View
                      key={`runway-stripe-right-${index}`}
                      style={[
                        styles.flightDeckVisionRunwayThresholdStripe,
                        {
                          left: `${destinationRunwayCue.leftPct + destinationRunwayCue.widthPct * offset}%`,
                          top: `${destinationRunwayCue.topPct + destinationRunwayCue.heightPct * 0.82}%`,
                        },
                      ]}
                    />
                  ))}
                  <View
                    style={[
                      styles.flightDeckVisionRunwayThreshold,
                      {
                        left: `${destinationRunwayCue.leftPct}%`,
                        top: `${destinationRunwayCue.topPct + destinationRunwayCue.heightPct * 0.5}%`,
                        width: `${destinationRunwayCue.widthPct}%`,
                      },
                    ]}
                  />
                </>
              ) : null}
              <View style={styles.flightDeckVisionTerrainBand}>
                {visionTerrainColumns.map((column: any) => (
                  <View
                    key={column.key}
                    style={[
                      styles.flightDeckVisionTerrainColumn,
                      {
                        left: `${column.leftPct}%`,
                        height: `${column.heightPct}%`,
                      },
                      column.risk === 'warning'
                        ? styles.flightDeckVisionTerrainColumnWarning
                        : column.risk === 'caution'
                          ? styles.flightDeckVisionTerrainColumnCaution
                          : styles.flightDeckVisionTerrainColumnNominal,
                    ]}
                  />
                ))}
              </View>
            </View>
            <View style={styles.flightDeckVisionBankArc}>
              <View style={styles.flightDeckVisionBankReference} />
              {flightDeckBankTicks.map((tick: any) => (
                <View
                  key={`vision-bank-${tick.value}`}
                  style={[
                    styles.flightDeckVisionBankTick,
                    tick.major ? styles.flightDeckVisionBankTickMajor : null,
                    { left: `${tick.leftPct}%` },
                  ]}
                />
              ))}
              <View
                style={[
                  styles.flightDeckVisionBankPointerActual,
                  { transform: [{ translateX: visionActualBankOffset }] },
                ]}
              />
              <View
                style={[
                  styles.flightDeckVisionBankPointerCommand,
                  { transform: [{ translateX: visionCommandBankOffset }] },
                ]}
              />
            </View>
            <View style={styles.flightDeckVisionFlightPathMarker}>
              <View style={styles.flightDeckVisionFlightPathInner} />
            </View>
            <View
              style={[
                styles.flightDeckVisionTrackVector,
                { transform: [{ translateX: visionDirectorCue.lateralOffsetPct * 2.1 }] },
              ]}
            />
            <View
              style={[
                styles.flightDeckVisionDirectorHorizontal,
                visionDirectorCue.mode === 'escape'
                  ? styles.flightDeckVisionDirectorWarning
                  : visionDirectorCue.mode === 'intercept'
                    ? styles.flightDeckVisionDirectorCaution
                    : visionDirectorCue.lateralCaptured
                      ? styles.flightDeckVisionDirectorCaptured
                      : null,
                { transform: [{ translateX: visionDirectorCue.lateralOffsetPct * 3.2 }] },
              ]}
            />
            <View
              style={[
                styles.flightDeckVisionDirectorVertical,
                visionDirectorCue.mode === 'escape'
                  ? styles.flightDeckVisionDirectorWarning
                  : !visionDirectorCue.verticalCaptured
                    ? styles.flightDeckVisionDirectorCaution
                    : styles.flightDeckVisionDirectorCaptured,
                { transform: [{ translateY: visionDirectorCue.verticalOffsetPct * 2.1 }] },
              ]}
            />
            <View style={[styles.flightDeckVisionCaptureTag, styles.flightDeckVisionCaptureTagTop]}>
              <Text style={styles.flightDeckVisionCaptureTagText}>
                {visionVerticalStateLabel === 'CLB' ? 'CLB' : visionVerticalStateLabel === 'VPTH' ? 'VPTH' : visionVerticalStateLabel === 'VNAV' ? 'VNAV' : 'ALT'}
              </Text>
            </View>
            <View style={[styles.flightDeckVisionCaptureTag, styles.flightDeckVisionCaptureTagBottom]}>
              <Text style={styles.flightDeckVisionCaptureTagText}>
                {visionVerticalStateLabel === 'DES' ? 'DES' : visionVerticalStateLabel === 'VPTH' ? 'ARM' : visionVerticalStateLabel === 'VNAV' ? 'PATH' : 'ALT'}
              </Text>
            </View>
            <View style={styles.flightDeckVisionVerticalScale}>
              <View style={styles.flightDeckVisionVerticalScaleCenter} />
              <View
                style={[
                  styles.flightDeckVisionVerticalBug,
                  { transform: [{ translateY: visionVerticalDeviationOffset }] },
                  flightDeckVerticalConstraintSummary.targetAltitudeFt != null
                    ? flightDeckVerticalConstraintSummary.nextConstraintArmed
                      ? styles.flightDeckVisionVerticalBugArmed
                      : styles.flightDeckVisionVerticalBugActive
                    : null,
                ]}
              />
            </View>
            <View style={styles.flightDeckVisionReadoutLeft}>
              <Text style={styles.flightDeckVisionLabel}>ALT</Text>
              <Text style={styles.flightDeckVisionValue}>
                {activeOwnship?.altitudeFt ? `${Math.round(activeOwnship.altitudeFt)}` : '--'}
              </Text>
            </View>
            <View style={styles.flightDeckVisionReadoutRight}>
              <Text style={styles.flightDeckVisionLabel}>HDG</Text>
              <Text style={styles.flightDeckVisionValue}>
                {activeOwnship?.heading ? `${Math.round(activeOwnship.heading)}` : '--'}
              </Text>
            </View>
            <View style={styles.flightDeckVisionBanner}>
              <Text style={styles.flightDeckVisionBannerTitle}>Vision Guidance</Text>
              <Text style={styles.flightDeckVisionBannerText}>
                {visionRouteGuidance?.lateralCue || visionGuidance}
              </Text>
              <Text style={styles.flightDeckVisionBannerSupport}>
                Heading {headingSourceSummary?.code || '--'} - {headingSourceSummary?.label || 'Unavailable'}
              </Text>
              <Text style={styles.flightDeckVisionBannerSupport}>{visionDirectorCue.turnCommand}</Text>
              <Text style={styles.flightDeckVisionBannerSupportMuted}>{visionDirectorCue.verticalCommand}</Text>
              <Text style={styles.flightDeckVisionBannerSupportMuted}>
                {flightDeckVerticalPathSummary.modeLabel} - {flightDeckVerticalPathSummary.support}
              </Text>
              <Text style={styles.flightDeckVisionBannerSupportMuted}>
                {flightDeckVerticalAlertSummary.deviationLabel} - {flightDeckVerticalAlertSummary.todLabel}
              </Text>
              {flightDeckVerticalConstraintSummary.targetAltitudeFt != null ? (
                <Text style={styles.flightDeckVisionBannerSupportMuted}>
                  {flightDeckVerticalConstraintSummary.modeLabel} - {flightDeckVerticalConstraintSummary.activeConstraintLabel}
                  {typeof flightDeckVerticalConstraintSummary.activeConstraintDistanceNm === 'number'
                    ? ` - ${flightDeckVerticalConstraintSummary.activeConstraintDistanceNm.toFixed(1)} NM`
                    : ''}
                  {' - '}
                  {flightDeckVerticalConstraintSummary.sourceLabel}
                </Text>
              ) : null}
              {flightDeckVerticalConstraintSummary.nextConstraintLabel ? (
                <Text style={styles.flightDeckVisionBannerSupportMuted}>
                  {flightDeckVerticalConstraintSummary.nextConstraintArmed ? 'Next constraint armed' : 'Next constraint staged'} - {flightDeckVerticalConstraintSummary.nextConstraintLabel}
                </Text>
              ) : null}
              <Text style={styles.flightDeckVisionBannerSupportMuted}>
                {flightDeckVerticalConstraintSummary.constraintGateCall}
              </Text>
              {flightDeckVerticalPathSummary.requiredVsiFpm != null ? (
                <Text style={styles.flightDeckVisionBannerSupportMuted}>
                  VNAV {Math.abs(flightDeckVerticalPathSummary.requiredVsiFpm)} fpm
                  {flightDeckVerticalPathSummary.targetAltitudeFt != null
                    ? ` - tgt ${Math.round(flightDeckVerticalPathSummary.targetAltitudeFt)} ft`
                    : ''}
                </Text>
              ) : null}
              {flightDeckVerticalConstraintSummary.requiredVsiFpm != null ? (
                <Text style={styles.flightDeckVisionBannerSupportMuted}>
                  PROC VNAV {Math.abs(flightDeckVerticalConstraintSummary.requiredVsiFpm)} fpm
                  {flightDeckVerticalConstraintSummary.targetAltitudeFt != null
                    ? ` - tgt ${Math.round(flightDeckVerticalConstraintSummary.targetAltitudeFt)} ft`
                    : ''}
                </Text>
              ) : null}
              {activeAttitude && (typeof activeAttitude.pitchDeg === 'number' || typeof activeAttitude.rollDeg === 'number') ? (
                <Text style={styles.flightDeckVisionBannerSupportMuted}>
                  Att {typeof activeAttitude.pitchDeg === 'number' ? `${activeAttitude.pitchDeg.toFixed(1)}° pitch` : '--'} / {typeof activeAttitude.rollDeg === 'number' ? `${activeAttitude.rollDeg.toFixed(1)}° bank` : '--'}
                </Text>
              ) : null}
              <Text style={styles.flightDeckVisionBannerSupportMuted}>
                {attitudeSourceSummary?.pilotGrade ? attitudeSourceSummary.detail : visionReadinessSummary?.detail}
              </Text>
              {terrainEscapeGuidance ? (
                <Text style={styles.flightDeckVisionBannerAlert}>{terrainEscapeGuidance}</Text>
              ) : null}
            </View>
            <View style={styles.flightDeckVisionGuidanceChip}>
              <Text style={styles.flightDeckVisionGuidanceText}>{visionGuidance}</Text>
            </View>
            {destinationRunwayCue ? (
              <View style={styles.flightDeckVisionApproachChip}>
                <Text style={styles.flightDeckVisionApproachTitle}>Approach</Text>
                <Text style={styles.flightDeckVisionApproachText}>
                  RWY {destinationRunwayCue.runwayId} - {destinationRunwayCue.distanceLabel}
                </Text>
                <Text style={styles.flightDeckVisionApproachMeta}>
                  {Math.abs(destinationRunwayCue.alignmentDeltaDeg) < 4
                    ? 'Aligned on final'
                    : destinationRunwayCue.alignmentDeltaDeg > 0
                      ? `Correct left ${Math.round(Math.abs(destinationRunwayCue.alignmentDeltaDeg))} deg`
                      : `Correct right ${Math.round(Math.abs(destinationRunwayCue.alignmentDeltaDeg))} deg`}
                </Text>
              </View>
            ) : destinationBriefingLoading ? (
              <View style={styles.flightDeckVisionApproachChip}>
                <Text style={styles.flightDeckVisionApproachTitle}>Approach</Text>
                <Text style={styles.flightDeckVisionApproachText}>Loading runway briefing</Text>
              </View>
            ) : null}
            {visionTrafficCue ? (
              <View
                style={{
                  position: 'absolute',
                  left: `${visionTrafficCue.xPct}%`,
                  top: `${visionTrafficCue.yPct}%`,
                }}
              >
                <View
                  style={[
                    styles.flightDeckVisionTrafficVector,
                    {
                      transform: [
                        { translateX: visionTrafficCue.vectorDxPct },
                        { translateY: visionTrafficCue.vectorDyPct },
                      ],
                    },
                  ]}
                />
                <View
                  style={[
                    styles.flightDeckVisionTrafficSymbol,
                    visionTrafficCue.threat === 'immediate'
                      ? styles.flightDeckVisionTrafficSymbolWarning
                      : visionTrafficCue.threat === 'advisory'
                        ? styles.flightDeckVisionTrafficSymbolCaution
                        : null,
                  ]}
                >
                  <Ionicons name="diamond" size={14} color={colors.flightText} />
                </View>
              </View>
            ) : null}
            {visionObstacleCues.map((cue: any) => (
              <View
                key={cue.key}
                style={[
                  styles.flightDeckVisionObstacleCue,
                  { left: `${cue.xPct}%`, top: `${cue.yPct}%` },
                  cue.risk === 'warning'
                    ? styles.flightDeckVisionObstacleCueWarning
                    : cue.risk === 'caution'
                      ? styles.flightDeckVisionObstacleCueCaution
                      : null,
                ]}
              />
            ))}
            <View style={styles.flightDeckVisionTelemetryLeft}>
              <Text style={styles.flightDeckVisionTelemetryLabel}>Terrain</Text>
              <Text
                style={[
                  styles.flightDeckVisionTelemetryValue,
                  terrainRisk === 'warning'
                    ? styles.flightDeckVisionTelemetryValueWarning
                    : terrainRisk === 'caution'
                      ? styles.flightDeckVisionTelemetryValueCaution
                      : null,
                ]}
              >
                {terrainClearanceFt != null ? `${Math.round(terrainClearanceFt)} ft clr` : terrainProfileLoading ? 'loading' : '--'}
              </Text>
            </View>
            <View style={styles.flightDeckVisionTelemetryRight}>
              <Text style={styles.flightDeckVisionTelemetryLabel}>Obstacle</Text>
              <Text
                style={[
                  styles.flightDeckVisionTelemetryValue,
                  obstacleRisk === 'warning'
                    ? styles.flightDeckVisionTelemetryValueWarning
                    : obstacleRisk === 'caution'
                      ? styles.flightDeckVisionTelemetryValueCaution
                      : null,
                ]}
              >
                {obstacleClearanceFt != null ? `${Math.round(obstacleClearanceFt)} ft clr` : obstacleScanLoading ? 'loading' : '--'}
              </Text>
            </View>
            {selectedTrafficTarget ? (
              <View style={styles.flightDeckVisionTrafficCue}>
                <Text style={styles.flightDeckVisionTrafficCueTitle}>Traffic</Text>
                <Text style={styles.flightDeckVisionTrafficCueText}>
                  {selectedTrafficTarget.callsign || 'target'} - {(selectedTrafficTarget.distanceNm ?? 0).toFixed(1)} NM - {formatAltitudeDelta?.(selectedTrafficTarget.altitudeDeltaFt ?? null) ?? '--'}
                </Text>
                <Text style={styles.flightDeckVisionTrafficCueMeta}>
                  {visionTrafficCue?.closureText || 'Monitor'} - {visionTrafficCue?.sector || 'sector'} - {visionTrafficCue?.clock || '--'}
                </Text>
              </View>
            ) : null}
            <View style={styles.flightDeckVisionManeuverCard}>
              <Text style={styles.flightDeckVisionManeuverTitle}>Recommended action</Text>
              <Text style={styles.flightDeckVisionManeuverText}>{visionManeuverRecommendation}</Text>
            </View>
          </View>
        ) : routePoints.length > 0 || activeOwnship ? (
          <MapView
            style={styles.flightDeckMap}
            ref={mapRef}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            mapType="standard"
            rotateEnabled
            pitchEnabled={false}
            showsCompass={false}
            toolbarEnabled={false}
            initialRegion={{
              latitude: tacticalMapRegion?.latitude || routePoints[0]?.latitude || activeOwnship?.lat || 39.5,
              longitude: tacticalMapRegion?.longitude || routePoints[0]?.longitude || activeOwnship?.lon || -98.35,
              latitudeDelta: tacticalMapRegion?.latitudeDelta || 3,
              longitudeDelta: tacticalMapRegion?.longitudeDelta || 3,
            }}
            onPress={() => pulseFlightDeckChrome()}
            onPanDrag={() => pulseFlightDeckChrome()}
            onRegionChangeComplete={(region) => setMapRegion(region)}
          >
            {mapStyle === 'sectional' && (
              <UrlTile
                urlTemplate="https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}"
                maximumZ={12}
                minimumZ={4}
                tileSize={256}
                opacity={0.85}
                zIndex={600}
              />
            )}
            {mapStyle === 'terrain' && (
              <UrlTile
                urlTemplate="https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}"
                maximumZ={15}
                minimumZ={4}
                tileSize={256}
                opacity={0.85}
                zIndex={600}
              />
            )}
            {mapStyle === 'radar' && (
              <UrlTile
                urlTemplate="https://nowcoast.noaa.gov/arcgis/rest/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer/tile/{z}/{y}/{x}"
                maximumZ={11}
                minimumZ={4}
                tileSize={256}
                opacity={mapOverlayProfile.radarOpacity}
                zIndex={600}
              />
            )}
            {mapStyle === 'clouds' && showCloudsGlobal && (
              <UrlTile
                urlTemplate={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`}
                maximumZ={9}
                minimumZ={2}
                tileSize={256}
                opacity={mapOverlayProfile.cloudOpacity}
                zIndex={600}
              />
            )}
            {mapStyle === 'clouds' && !showCloudsGlobal && cloudTileUrl && (
              <UrlTile
                key={`clouds-flight-${cloudFrameIndex}`}
                urlTemplate={cloudTileUrl}
                maximumZ={8}
                minimumZ={3}
                tileSize={256}
                opacity={mapOverlayProfile.cloudOpacity}
                zIndex={600}
              />
            )}
            {mapStyle === 'winds' && (
              <>
                {visibleWindsPoints.slice(0, mapOverlayProfile.maxWindMarkers).map((point: any, index: number) => {
                  if (point.windDir === null || point.windSpeed === null) return null;
                  const size = Math.min(24, Math.max(14, Math.round(point.windSpeed / 3) + 10));
                  const rotation = (point.windDir + 180) % 360;
                  return (
                    <Marker
                      key={`flight-wind-${point.stationId}-${index}`}
                      coordinate={{ latitude: point.lat, longitude: point.lon }}
                      anchor={{ x: 0.5, y: 0.5 }}
                    >
                      <View style={[styles.windMarker, { transform: [{ rotate: `${rotation}deg` }] }]}>
                        <Ionicons name="arrow-up" size={size} color={colors.flightAdvisory} />
                      </View>
                    </Marker>
                  );
                })}
              </>
            )}
            {mapRouteDisplay.upcoming?.length > 1 ? (
              <Polyline
                coordinates={mapRouteDisplay.upcoming.map((point: any) => ({ latitude: point.latitude, longitude: point.longitude }))}
                strokeColor={`rgba(200,146,42,${mapOverlayProfile.upcomingLegOpacity})`}
                strokeWidth={mapOverlayProfile.upcomingLegWidth}
              />
            ) : null}
            {mapRouteDisplay.completed?.length > 1 ? (
              <Polyline
                coordinates={mapRouteDisplay.completed.map((point: any) => ({ latitude: point.latitude, longitude: point.longitude }))}
                strokeColor="rgba(0,212,160,0.88)"
                strokeWidth={mapOverlayProfile.completedLegWidth}
              />
            ) : null}
            {mapRouteDisplay.activeLeg?.length > 1 ? (
              <Polyline
                coordinates={mapRouteDisplay.activeLeg.map((point: any) => ({ latitude: point.latitude, longitude: point.longitude }))}
                strokeColor={colors.flightAccent}
                strokeWidth={mapOverlayProfile.activeLegWidth}
              />
            ) : null}
            {activeRunwayOverlay ? (
              <>
                {mapRunwayFocusSummary.emphasize ? (
                  <Polyline
                    coordinates={activeRunwayOverlay.centerline}
                    strokeColor="rgba(200,146,42,0.18)"
                    strokeWidth={mapOverlayProfile.runwayEmphasisWidth}
                  />
                ) : null}
                <Polyline
                  coordinates={activeRunwayOverlay.centerline}
                  strokeColor="rgba(232, 237, 244, 0.86)"
                  strokeWidth={2}
                  lineDashPattern={[8, 8]}
                />
                <Polyline
                  coordinates={activeRunwayOverlay.runwayBar}
                  strokeColor={colors.flightAccent}
                  strokeWidth={4}
                />
              </>
            ) : null}
            {mapVerticalGuidancePresentation?.coordinate ? (
              <Marker
                coordinate={mapVerticalGuidancePresentation.coordinate}
                anchor={{ x: 0.5, y: 0.5 }}
                title={mapVerticalGuidancePresentation.detail}
                description={`${mapVerticalGuidancePresentation.label} ${mapVerticalGuidancePresentation.subtitle}`}
              >
                <View
                  style={[
                    styles.flightDeckVerticalMarker,
                    mapVerticalGuidancePresentation.kind === 'constraint'
                      ? styles.flightDeckVerticalMarkerConstraint
                      : styles.flightDeckVerticalMarkerTod,
                  ]}
                >
                  <Text style={styles.flightDeckVerticalMarkerLabel}>{mapVerticalGuidancePresentation.label}</Text>
                  <Text style={styles.flightDeckVerticalMarkerValue}>{mapVerticalGuidancePresentation.subtitle}</Text>
                </View>
              </Marker>
            ) : null}
            {activeOwnship && selectedTrafficTarget ? (
              <Polyline
                coordinates={[
                  { latitude: activeOwnship.lat, longitude: activeOwnship.lon },
                  { latitude: selectedTrafficTarget.lat, longitude: selectedTrafficTarget.lon },
                ]}
                strokeColor={selectedTrafficTarget.threatLevel === 'immediate' ? colors.flightWarning : colors.flightCaution}
                strokeWidth={2}
                lineDashPattern={[6, 6]}
              />
            ) : null}
            {activeOwnship && selectedDiversionPoint ? (
              <Polyline
                coordinates={[
                  { latitude: activeOwnship.lat, longitude: activeOwnship.lon },
                  selectedDiversionPoint,
                ]}
                strokeColor={colors.flightAdvisory}
                strokeWidth={2}
                lineDashPattern={[10, 8]}
              />
            ) : null}
            {diversionCandidates.slice(0, 4).map((airport: any) => {
              if (typeof airport.lat !== 'number' || typeof airport.lon !== 'number') return null;
              const active = selectedDiversionIcao === airport.icao;
              return (
                <Marker
                  key={`flight-diversion-${airport.icao}`}
                  coordinate={{ latitude: airport.lat, longitude: airport.lon }}
                  onPress={() => {
                    pulseFlightDeckChrome();
                    setSelectedDiversionIcao(airport.icao);
                  }}
                >
                  <View style={[styles.flightDeckDiversionMarker, active && styles.flightDeckDiversionMarkerActive]}>
                    <Ionicons name="business" size={14} color={active ? colors.flightBackground : colors.flightText} />
                  </View>
                </Marker>
              );
            })}
            {mapDisplayTrafficTargets.map((target: any) => {
              const trafficPresentation = mapTrafficPresentation.find((item: any) => item.id === target.id);
              return [
                trafficPresentation?.vector && trafficPresentation.vector.length > 1 && mapOverlayProfile.showTrafficVectors ? (
                  <Polyline
                    key={`flight-traffic-vector-${target.id}`}
                    coordinates={trafficPresentation.vector}
                    strokeColor={
                      target.threatLevel === 'immediate'
                        ? colors.flightWarning
                        : target.threatLevel === 'advisory'
                          ? colors.flightCaution
                          : 'rgba(232,237,244,0.5)'
                    }
                    strokeWidth={2}
                  />
                ) : null,
                <Marker
                  key={`flight-traffic-${target.id}`}
                  coordinate={{ latitude: target.lat, longitude: target.lon }}
                  onPress={() => {
                    pulseFlightDeckChrome();
                    setSelectedTrafficId(target.id);
                  }}
                  description={`${target.distanceNm.toFixed(1)} NM${target.altitudeFt ? ` - ${target.altitudeFt} ft` : ''}`}
                >
                  <View style={styles.flightTrafficMarkerWrap}>
                    {selectedTrafficTarget?.id === target.id || target.threatLevel === 'immediate' ? (
                      <View
                        style={[
                          styles.flightTrafficAttentionRing,
                          target.threatLevel === 'immediate' && styles.flightTrafficAttentionRingImmediate,
                        ]}
                      />
                    ) : null}
                    {target.threatLevel !== 'monitor' || selectedTrafficTarget?.id === target.id || mapOverlayProfile.showMonitorAltitudeTags ? (
                      <View style={styles.flightTrafficAltitudeTag}>
                        <Text style={styles.flightTrafficAltitudeTagText}>{trafficPresentation?.altitudeLabel || '--'}</Text>
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.flightTrafficMarker,
                        target.threatLevel === 'immediate'
                          ? styles.flightTrafficMarkerImmediate
                          : target.threatLevel === 'advisory'
                            ? styles.flightTrafficMarkerAdvisory
                            : styles.flightTrafficMarkerMonitor,
                        selectedTrafficTarget?.id === target.id && styles.flightTrafficMarkerSelected,
                      ]}
                    >
                      <Ionicons
                        name="diamond"
                        size={14}
                        color={target.threatLevel === 'monitor' ? colors.flightText : colors.flightBackground}
                      />
                    </View>
                  </View>
                </Marker>,
              ];
            })}
            {activeOwnship ? (
              <Marker
                coordinate={{ latitude: activeOwnship.lat, longitude: activeOwnship.lon }}
                anchor={{ x: 0.5, y: 0.5 }}
                title={simulationEnabled ? 'Simulated ownship' : 'Ownship'}
              >
                <View
                  style={[
                    styles.flightOwnshipMarker,
                    activeOwnship.heading ? { transform: [{ rotate: `${activeOwnship.heading}deg` }] } : null,
                  ]}
                >
                  <Ionicons name="navigate" size={20} color={colors.flightBackground} />
                </View>
              </Marker>
            ) : null}
          </MapView>
        ) : (
          <View style={styles.flightDeckEmptyMap}>
            <Text style={styles.flightDeckEmptyTitle}>Build a route in planner first</Text>
            <Text style={styles.flightDeckEmptyText}>Flight Deck uses the active route from the planner.</Text>
          </View>
        )}

        {flightDeckView === 'vision' && !flightDeckChromeVisible && !flightDeckDrawerOpen ? (
          <TouchableOpacity style={styles.flightDeckTapReveal} activeOpacity={1} onPress={() => pulseFlightDeckChrome()} />
        ) : null}

        {flightDeckChromeVisible ? (
          <View style={[styles.flightDeckHeader, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
            <View style={styles.flightDeckHeaderCard}>
              <Text style={styles.flightDeckEyebrow}>{flightDeckSessionState}</Text>
              <Text style={styles.flightDeckTitle}>{routeHeadline}</Text>
              <Text style={styles.flightDeckSubtitle}>
                {routeProgress
                  ? `Leg ${routeProgress.activeLegLabel || routeProgress.nextWaypoint || '--'} - ${routeProgress.remainingLegNm.toFixed(1)} NM leg / ${routeProgress.remainingRouteNm.toFixed(1)} NM route`
                  : flightDeckView === 'vision'
                    ? 'Synthetic vision guidance active.'
                    : 'Map-first tactical cockpit.'}
              </Text>
              {routeProgress ? (
                <Text style={styles.flightDeckSubtitle}>
                  Next {routeExecutionSummary?.nextLegLabel || routeProgress.nextLegLabel || routeProgress.nextWaypoint || '--'} - Dest {routeProgress.destinationWaypoint || '--'} - {routeExecutionSummary?.sequencingLabel || 'Sequencing'}
                </Text>
              ) : null}
              {routeExecutionSummary?.mode === 'direct-to' ? (
                <Text style={styles.flightDeckSubtitle}>Execution mode Direct-To diversion override is active. Planned route remains staged in planner.</Text>
              ) : null}
              {routeExecutionSummary?.sequencingSuspended ? (
                <Text style={styles.flightDeckSubtitle}>Leg sequencing is suspended. The active leg will stay locked until you resume sequencing.</Text>
              ) : null}
              {routeExecutionSummary?.sequencingDetail ? (
                <Text style={styles.flightDeckSubtitle}>{routeExecutionSummary.sequencingDetail}</Text>
              ) : null}
              {routeExecutionSummary?.activeLegAnnunciation ? (
                <Text style={styles.flightDeckSubtitle}>
                  {routeExecutionSummary.activeLegAnnunciation} Â· {routeExecutionSummary.activeLegGuidanceMode || 'track'} guidance Â· {routeExecutionSummary.activeLegProfile || 'enroute'} Â· {routeExecutionSummary.lateralExecutionState || 'intercept'}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeExecutionSegment?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Segment {routeExecutionSummary.activeExecutionSegment.label}
                  {routeExecutionSummary?.nextExecutionSegment?.label ? ` Â· Next ${routeExecutionSummary.nextExecutionSegment.label}` : ''}{activeExecutionPlanEntry?.actionCue ? ` Â· ${activeExecutionPlanEntry.actionCue}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeExecutionTransition?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Transition model {routeExecutionSummary.activeExecutionTransition.label}
                  {routeExecutionSummary?.nextExecutionTransition?.label ? ` Â· Next ${routeExecutionSummary.nextExecutionTransition.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureContext?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Navigation context {routeExecutionSummary.activeProcedureContext.label}
                  {routeExecutionSummary?.nextProcedureContext?.label ? ` Â· Next ${routeExecutionSummary.nextProcedureContext.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureHandoff?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Handoff model {routeExecutionSummary.activeProcedureHandoff.label}
                  {routeExecutionSummary?.nextProcedureHandoff?.label ? ` Â· Next ${routeExecutionSummary.nextProcedureHandoff.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureEntryRole?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Procedure role {routeExecutionSummary.activeProcedureEntryRole.label}
                  {routeExecutionSummary?.nextProcedureEntryRole?.label ? ` Â· Next ${routeExecutionSummary.nextProcedureEntryRole.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureEntryDescriptor?.positionLabel ? (
                <Text style={styles.flightDeckSubtitle}>
                  Procedure entry {routeExecutionSummary.activeProcedureEntryDescriptor.positionLabel}
                  {routeExecutionSummary?.nextProcedureEntryDescriptor?.positionLabel ? ` Â· Next ${routeExecutionSummary.nextProcedureEntryDescriptor.positionLabel}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureEntryTransitionBehavior?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Entry transition {routeExecutionSummary.activeProcedureEntryTransitionBehavior.label}
                  {routeExecutionSummary?.nextProcedureEntryTransitionBehavior?.label ? ` Â· Next ${routeExecutionSummary.nextProcedureEntryTransitionBehavior.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.verticalConstraintCall ? (
                <Text style={styles.flightDeckSubtitle}>
                  Vertical constraint {routeExecutionSummary.verticalConstraintCall}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureTransitionTable?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Transition table {routeExecutionSummary.activeProcedureTransitionTable.label}
                  {routeExecutionSummary?.nextProcedureTransitionTable?.label ? ` Â· Next ${routeExecutionSummary.nextProcedureTransitionTable.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureSegmentTemplate?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Segment template {routeExecutionSummary.activeProcedureSegmentTemplate.label}
                  {routeExecutionSummary?.nextProcedureSegmentTemplate?.label ? ` Â· Next ${routeExecutionSummary.nextProcedureSegmentTemplate.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureSegmentClass?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Segment class {routeExecutionSummary.activeProcedureSegmentClass.label}
                  {routeExecutionSummary?.nextProcedureSegmentClass?.label ? ` Â· Next ${routeExecutionSummary.nextProcedureSegmentClass.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureLegAdapter?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Leg adapter {routeExecutionSummary.activeProcedureLegAdapter.label}
                  {routeExecutionSummary?.nextProcedureLegAdapter?.label ? ` Â· Next ${routeExecutionSummary.nextProcedureLegAdapter.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureLegFamily?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Leg family {routeExecutionSummary.activeProcedureLegFamily.label}
                  {routeExecutionSummary?.nextProcedureLegFamily?.label ? ` Â· Next ${routeExecutionSummary.nextProcedureLegFamily.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureLegParserTarget?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Parser target {routeExecutionSummary.activeProcedureLegParserTarget.label}
                  {routeExecutionSummary?.nextProcedureLegParserTarget?.label ? ` Â· Next ${routeExecutionSummary.nextProcedureLegParserTarget.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureLegIngestionContract?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Ingestion contract {routeExecutionSummary.activeProcedureLegIngestionContract.label}
                  {routeExecutionSummary?.nextProcedureLegIngestionContract?.label ? ` Â· Next ${routeExecutionSummary.nextProcedureLegIngestionContract.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeParsedLegPayload?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Parsed payload {routeExecutionSummary.activeParsedLegPayload.label} Â· {routeExecutionSummary.activeParsedLegPayload.source}
                  {routeExecutionSummary?.nextParsedLegPayload?.label ? ` Â· Next ${routeExecutionSummary.nextParsedLegPayload.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureRoleCueProfile?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Role cues {routeExecutionSummary.activeProcedureRoleCueProfile.label}
                  {routeExecutionSummary?.nextProcedureRoleCueProfile?.label ? ` Â· Next ${routeExecutionSummary.nextProcedureRoleCueProfile.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureRoleExecutionPolicy?.sequencingModel ? (
                <Text style={styles.flightDeckSubtitle}>
                  Role sequencing {routeExecutionSummary.activeProcedureRoleExecutionPolicy.sequencingModel}
                  {routeExecutionSummary?.nextProcedureRoleExecutionPolicy?.sequencingModel ? ` Â· Next ${routeExecutionSummary.nextProcedureRoleExecutionPolicy.sequencingModel}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureChain?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Procedure chain {routeExecutionSummary.activeProcedureChain.label}
                  {routeExecutionSummary?.nextProcedureChain?.label ? ` Â· Next ${routeExecutionSummary.nextProcedureChain.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureChainBehavior?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Chain behavior {routeExecutionSummary.activeProcedureChainBehavior.label}
                  {routeExecutionSummary?.nextProcedureChainBehavior?.label ? ` Â· Next ${routeExecutionSummary.nextProcedureChainBehavior.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureTemplate?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Procedure template {routeExecutionSummary.activeProcedureTemplate.label}
                  {routeExecutionSummary?.nextProcedureTemplate?.label ? ` Â· Next ${routeExecutionSummary.nextProcedureTemplate.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureExecutionProfile?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Execution profile {routeExecutionSummary.activeProcedureExecutionProfile.label}
                  {routeExecutionSummary?.nextProcedureExecutionProfile?.label ? ` Â· Next ${routeExecutionSummary.nextProcedureExecutionProfile.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureCueStack?.label ? (
                <Text style={styles.flightDeckSubtitle}>
                  Cue stack {routeExecutionSummary.activeProcedureCueStack.label}
                  {routeExecutionSummary?.nextProcedureCueStack?.label ? ` Â· Next ${routeExecutionSummary.nextProcedureCueStack.label}` : ''}
                </Text>
              ) : null}
              {nextExecutionPlanEntry?.status === 'armed' ? (
                <Text style={styles.flightDeckSubtitle}>
                  Execution plan {nextExecutionPlanEntry.legLabel} Â· {nextExecutionPlanEntry.actionCue}
                </Text>
              ) : null}
              {routeExecutionSummary?.sequenceGateCall ? (
                <Text style={styles.flightDeckSubtitle}>{routeExecutionSummary.sequenceGateCall}</Text>
              ) : null}
              {routeExecutionSummary?.transitionCall ? (
                <Text style={styles.flightDeckSubtitle}>{routeExecutionSummary.transitionCall}</Text>
              ) : null}
              {routeExecutionSummary?.nextActionCall ? (
                <Text style={styles.flightDeckSubtitle}>{routeExecutionSummary.nextActionCall}</Text>
              ) : null}
              {routeExecutionSummary?.nextLegArmed ? (
                <Text style={styles.flightDeckSubtitle}>
                  {routeExecutionSummary?.manualAdvanceRequired
                    ? routeExecutionSummary?.activeProcedureCueStack?.nextLegManagedLabel || 'Next leg is staged. Manual advance remains required.'
                    : routeExecutionSummary?.activeProcedureCueStack?.nextLegAutoLabel || 'Next leg is armed for sequencing.'}
                </Text>
              ) : null}
              {routeExecutionSummary?.turnAnticipationState && routeExecutionSummary.turnAnticipationState !== 'idle' ? (
                <Text style={styles.flightDeckSubtitle}>{routeExecutionSummary.turnAnticipationCall}</Text>
              ) : null}
              <Text style={styles.flightDeckSubtitle}>
                Phase {flightDeckPhaseSummary?.label || 'Preflight'} - {flightDeckPhaseSummary?.detail || 'Awaiting active route and ownship.'}
              </Text>
              <Text style={styles.flightDeckSubtitle}>
                {ownshipSourceSummary?.label || 'No ownship'} - {ownshipSourceSummary?.detail || 'Tracking source unavailable.'}
              </Text>
              <Text style={styles.flightDeckSubtitle}>
                Heading {headingSourceSummary?.code || '--'} - Vision {visionReadinessSummary?.code || '--'} - Receiver {receiverStatusSummary?.code || '--'}
              </Text>
              <View style={styles.flightDeckHeaderMetaRow}>
                <View
                  style={[
                    styles.flightDeckHeaderMetaChip,
                    ownshipStatusTone === 'active'
                      ? styles.flightDeckHeaderMetaChipActive
                      : ownshipStatusTone === 'accent'
                        ? styles.flightDeckHeaderMetaChipAccent
                        : ownshipStatusTone === 'warning'
                          ? styles.flightDeckHeaderMetaChipWarning
                          : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.flightDeckHeaderMetaChipText,
                      ownshipStatusTone === 'active'
                        ? styles.flightDeckHeaderMetaChipTextActive
                        : ownshipStatusTone === 'accent'
                          ? styles.flightDeckHeaderMetaChipTextAccent
                          : ownshipStatusTone === 'warning'
                            ? styles.flightDeckHeaderMetaChipTextWarning
                            : null,
                    ]}
                  >
                    {ownshipStatusLabel}
                  </Text>
                </View>
                <Text style={styles.flightDeckHeaderMetaText}>{ownshipFreshnessText}</Text>
              </View>
            </View>
            <View style={styles.flightDeckHeaderActions}>
              <TouchableOpacity
                style={[styles.flightDeckExitButton, flightDeckView === 'vision' && styles.flightDeckExitButtonActive]}
                onPress={toggleFlightDeckView}
              >
                <Text style={styles.flightDeckExitText}>
                  {flightDeckView === 'vision' ? 'Map' : attitudeSourceSummary?.pilotGrade ? 'Vision' : 'Vision Assist'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.flightDeckExitButton}
                onPress={() => {
                  pulseFlightDeckChrome(true);
                  navigation.navigate('FlightPlanner', {
                    departure,
                    destination,
                    waypoints,
                    plannedStops,
                    plannedAltitude,
                    cruiseKtas,
                  });
                }}
              >
                <Text style={styles.flightDeckExitText}>Planner</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {flightDeckVisibleAlert || flightDeckChromeVisible || (flightDeckView === 'map' && (flightDeckTrafficCardVisible || flightDeckDiversionCardVisible)) ? (
          <View style={[styles.flightDeckBottomStack, { bottom: flightDeckLowerStackBottom }]}>
            {flightDeckVisibleAlert ? (
              <View
                style={[
                  styles.flightDeckAlertStrip,
                  flightDeckVisibleAlert.severity === 'warning'
                    ? styles.flightDeckAlertStripWarning
                    : flightDeckVisibleAlert.severity === 'caution'
                      ? styles.flightDeckAlertStripCaution
                      : styles.flightDeckAlertStripAdvisory,
                ]}
              >
                <Text style={styles.flightDeckAlertTitle}>{flightDeckVisibleAlert.title}</Text>
                <Text style={styles.flightDeckAlertText}>{flightDeckVisibleAlert.detail}</Text>
              </View>
            ) : null}
            {flightDeckView === 'vision' && !attitudeSourceSummary?.pilotGrade ? (
              <View style={[styles.flightDeckAlertStrip, styles.flightDeckAlertStripCaution]}>
                <Text style={styles.flightDeckAlertTitle}>Vision assist</Text>
                <Text style={styles.flightDeckAlertText}>
                  {visionReadinessSummary?.detail || 'Connect an AHRS source for full synthetic vision attitude.'}
                </Text>
              </View>
            ) : null}
            {flightDeckView === 'vision' && !activeOwnship ? (
              <View style={[styles.flightDeckAlertStrip, styles.flightDeckAlertStripAdvisory]}>
                <Text style={styles.flightDeckAlertTitle}>Ownship unavailable</Text>
                <Text style={styles.flightDeckAlertText}>
                  Vision Assist stays active until dismissed. Reconnect GPS or ADS-B ownship input to restore live guidance.
                </Text>
              </View>
            ) : null}

            {flightDeckView === 'map' && flightDeckTrafficCardVisible && selectedTrafficTarget ? (
              <View
                style={[
                  styles.flightDeckContextCard,
                  selectedTrafficTarget.threatLevel === 'immediate'
                    ? styles.flightDeckContextCardWarning
                    : selectedTrafficTarget.threatLevel === 'advisory'
                      ? styles.flightDeckContextCardCaution
                      : null,
                ]}
              >
                <View style={styles.flightDeckContextCardHeader}>
                  <Text style={styles.flightDeckContextCardEyebrow}>Traffic</Text>
                  <Text style={styles.flightDeckContextCardBadge}>
                    {visionTrafficCue?.clock || '--'} - {visionTrafficCue?.closureText || selectedTrafficTrend?.closureText || 'Monitor'}
                  </Text>
                </View>
                <Text style={styles.flightDeckContextCardTitle}>
                  {selectedTrafficTarget.callsign || 'Traffic'} - {(selectedTrafficTarget.distanceNm ?? 0).toFixed(1)} NM - {formatAltitudeDelta?.(selectedTrafficTarget.altitudeDeltaFt ?? null) ?? '--'}
                </Text>
                <Text style={styles.flightDeckContextCardText}>
                  Sector {visionTrafficCue?.sector || 'ahead'} - threat {selectedTrafficTarget.threatLevel} - score {selectedTrafficTarget.threatScore}
                </Text>
                <View style={styles.flightDeckContextCardActions}>
                  <TouchableOpacity style={styles.flightDeckMiniChip} onPress={() => focusTrafficTarget(selectedTrafficTarget)}>
                    <Text style={styles.flightDeckMiniChipText}>Focus</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.flightDeckMiniChip, styles.flightDeckMiniChipActive]}
                    onPress={() => {
                      pulseFlightDeckChrome(true);
                      setSelectedTrafficId(selectedTrafficTarget.id);
                    }}
                  >
                    <Text style={[styles.flightDeckMiniChipText, styles.flightDeckMiniChipTextActive]}>Select</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {flightDeckView === 'map' && flightDeckDiversionCardVisible && selectedDiversion ? (
              <View
                style={[
                  styles.flightDeckContextCard,
                  selectedDiversion.flightCategory === 'IFR' || selectedDiversion.flightCategory === 'LIFR'
                    ? styles.flightDeckContextCardCaution
                    : styles.flightDeckContextCardAccent,
                ]}
              >
                <View style={styles.flightDeckContextCardHeader}>
                  <Text style={styles.flightDeckContextCardEyebrow}>Diversion</Text>
                  <Text style={styles.flightDeckContextCardBadge}>{selectedDiversion.flightCategory || 'WX --'}</Text>
                </View>
                <Text style={styles.flightDeckContextCardTitle}>
                  {selectedDiversion.icao} - {selectedDiversion.distanceNm.toFixed(1)} NM - {Math.round(selectedDiversion.bearingDeg)} deg
                </Text>
                <Text style={styles.flightDeckContextCardText}>
                  {selectedDiversionRunwaySummary}
                  {selectedDiversionBestComm?.frequencyMhz ? ` - ${selectedDiversionBestComm.frequencyMhz.toFixed(3)}` : ''}
                </Text>
                <View style={styles.flightDeckContextCardActions}>
                  <TouchableOpacity style={styles.flightDeckMiniChip} onPress={() => focusDiversionAirport(selectedDiversion)}>
                    <Text style={styles.flightDeckMiniChipText}>Focus</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.flightDeckMiniChip, styles.flightDeckMiniChipActive]}
                    onPress={() => engageDirectToDiversion(selectedDiversion)}
                  >
                    <Text style={[styles.flightDeckMiniChipText, styles.flightDeckMiniChipTextActive]}>Direct-to</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
            {flightDeckView === 'map' && !flightDeckTrafficCardVisible && !flightDeckDiversionCardVisible ? (
              <View style={styles.flightDeckMapActionCard}>
                <View style={styles.flightDeckMapActionHeader}>
                  <Text style={styles.flightDeckMapActionLabel}>{mapTacticalSummary.focusLabel || 'Director'}</Text>
                  <Text style={styles.flightDeckMapActionMode}>{mapTacticalSummary.modeLabel}</Text>
                </View>
                <Text style={styles.flightDeckMapActionText}>{mapTacticalSummary.heading}</Text>
                <Text style={styles.flightDeckMapActionSubtext}>
                  {mapTacticalSummary.vertical}
                  {flightDeckTargetAltitudeFt ? ` - bug ${flightDeckTargetAltitudeFt} ft` : ''}
                </Text>
                <Text style={styles.flightDeckMapActionSubtext}>
                  {mapTacticalSummary.verticalSupport}
                  {flightDeckVerticalPathSummary.distanceToTodNm != null && flightDeckVerticalPathSummary.distanceToTodNm > 0
                    ? ` - TOD ${flightDeckVerticalPathSummary.distanceToTodNm.toFixed(1)} NM`
                    : ''}
                </Text>
                <Text style={styles.flightDeckMapActionSubtext}>{mapTacticalSummary.verticalConstraintCall}</Text>
                <Text style={styles.flightDeckMapActionSubtext}>{flightDeckVerticalConstraintSummary.constraintGateCall}</Text>
                {flightDeckVerticalConstraintSummary.targetAltitudeFt != null ? (
                  <Text style={styles.flightDeckMapActionSubtext}>
                    {flightDeckVerticalConstraintSummary.modeLabel} - {flightDeckVerticalConstraintSummary.support}
                  </Text>
                ) : null}
                <Text style={styles.flightDeckMapActionSubtext}>
                  {mapTacticalSummary.support}
                  {mapTacticalSummary.rangeLabel ? ` - ${mapTacticalSummary.rangeLabel}` : ''}
                </Text>
                <Text style={styles.flightDeckMapActionSubtext}>{mapOverlayProfile.label}</Text>
                <Text style={styles.flightDeckMapActionRecommendation}>{mapTacticalSummary.recommendation}</Text>
              </View>
            ) : null}
            {flightDeckView === 'map' && destinationRunwayCue ? (
              <View style={styles.flightDeckApproachCard}>
                <View style={styles.flightDeckApproachCardHeader}>
                  <Text style={styles.flightDeckApproachCardEyebrow}>Approach</Text>
                  <Text style={styles.flightDeckApproachCardBadge}>{destinationRunwayCue.distanceLabel}</Text>
                </View>
                <Text style={styles.flightDeckApproachCardTitle}>Runway {destinationRunwayCue.runwayId}</Text>
                <Text style={styles.flightDeckApproachCardText}>
                  Final centerline is drawn on the overhead map for live track-up following.
                </Text>
              </View>
            ) : null}
            {flightDeckView === 'map' && flightDeckRunwayOpsSummary ? (
              <View style={styles.flightDeckRunwayOpsCard}>
                <View style={styles.flightDeckApproachCardHeader}>
                  <Text style={styles.flightDeckApproachCardEyebrow}>Runway Ops</Text>
                  <Text style={styles.flightDeckApproachCardBadge}>
                    {activeRunwayOverlayLabel || flightDeckRunwayOpsSummary.sourceLabel}
                  </Text>
                </View>
                <Text style={styles.flightDeckApproachCardTitle}>
                  {flightDeckRunwayOpsSummary.airportIcao} RWY {flightDeckRunwayOpsSummary.runwayId}
                </Text>
                <Text style={styles.flightDeckApproachCardText}>{flightDeckRunwayOpsSummary.phaseCall}</Text>
                <Text style={styles.flightDeckApproachCardText}>
                  {flightDeckRunwayOpsSummary.runwayMeta}
                  {typeof flightDeckRunwayOpsSummary.headwindKt === 'number'
                    ? ` - HW ${Math.round(flightDeckRunwayOpsSummary.headwindKt)} kt`
                    : ''}
                  {typeof flightDeckRunwayOpsSummary.crosswindKt === 'number'
                    ? ` - XW ${Math.round(flightDeckRunwayOpsSummary.crosswindKt)} kt`
                    : ''}
                </Text>
                <View style={styles.flightDeckContextCardActions}>
                  <TouchableOpacity
                    style={styles.flightDeckMiniChip}
                    onPress={() => {
                      pulseFlightDeckChrome(true);
                      setFlightDeckDrawerOpen(true);
                      setFlightDeckPanel('surface');
                    }}
                  >
                    <Text style={styles.flightDeckMiniChipText}>Surface</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {flightDeckChromeVisible && !flightDeckDrawerOpen ? (
              <View style={styles.flightDeckQuickRail}>
                {flightDeckActionButtons.map((action: any) => (
                  <TouchableOpacity
                    key={action.key}
                    style={[
                      styles.flightDeckQuickButton,
                      action.active && styles.flightDeckQuickButtonActive,
                      action.tone === 'warning'
                        ? styles.flightDeckQuickButtonWarning
                        : action.tone === 'caution'
                          ? styles.flightDeckQuickButtonCaution
                          : action.tone === 'accent'
                            ? styles.flightDeckQuickButtonAccent
                            : null,
                    ]}
                    activeOpacity={0.94}
                    onPress={action.onPress}
                  >
                    <Text style={styles.flightDeckQuickButtonLabel}>{action.label}</Text>
                    <Text
                      style={[
                        styles.flightDeckQuickButtonValue,
                        action.active && styles.flightDeckQuickButtonValueActive,
                      ]}
                    >
                      {action.value}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {flightDeckHudExpanded ? (
          <View style={[styles.flightDeckHudExpandedCard, { bottom: Math.max(insets.bottom + 106, 118) }]}>
            <View style={styles.flightDeckHudExpandedRow}>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>Leg</Text>
                <Text style={styles.flightDeckHudExpandedValue}>{routeProgress?.activeLegLabel || '--'}</Text>
              </View>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>Leg Rem</Text>
                <Text style={styles.flightDeckHudExpandedValue}>
                  {routeProgress ? `${routeProgress.remainingLegNm.toFixed(1)} NM` : '--'}
                </Text>
              </View>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>Next</Text>
                <Text style={styles.flightDeckHudExpandedValue}>{routeProgress?.nextWaypoint || '--'}</Text>
              </View>
            </View>
            <View style={styles.flightDeckHudExpandedRow}>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>Dest</Text>
                <Text style={styles.flightDeckHudExpandedValue}>{routeProgress?.destinationWaypoint || '--'}</Text>
              </View>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>Route Rem</Text>
                <Text style={styles.flightDeckHudExpandedValue}>
                  {routeProgress ? `${routeProgress.remainingRouteNm.toFixed(1)} NM` : '--'}
                </Text>
              </View>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>Traffic</Text>
                <Text style={styles.flightDeckHudExpandedValue}>{immediateTrafficCount || visibleTrafficTargets.length || '--'}</Text>
              </View>
            </View>
            <View style={styles.flightDeckHudExpandedRow}>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>Diversion</Text>
                <Text style={styles.flightDeckHudExpandedValue}>{selectedDiversion?.icao || '--'}</Text>
              </View>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>Comms</Text>
                <Text style={styles.flightDeckHudExpandedValue}>
                  {selectedDiversionBestComm?.frequencyMhz ? selectedDiversionBestComm.frequencyMhz.toFixed(3) : '--'}
                </Text>
              </View>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>WX</Text>
                <Text style={styles.flightDeckHudExpandedValue}>{routeRiskLabel}</Text>
              </View>
            </View>
            <View style={styles.flightDeckHudExpandedRow}>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>Source</Text>
                <Text style={styles.flightDeckHudExpandedValue}>{ownshipSourceSummary?.code || '--'}</Text>
              </View>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>Freshness</Text>
                <Text style={styles.flightDeckHudExpandedValue}>{ownshipFreshnessText}</Text>
              </View>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>Fallback</Text>
                <Text style={styles.flightDeckHudExpandedValue}>
                  {receiverOwnshipFresh === false && gpsOwnshipFresh ? 'GPS armed' : receiverOwnshipFresh ? 'Receiver primary' : gpsOwnshipFresh ? 'GPS primary' : 'No fallback'}
                </Text>
              </View>
            </View>
            <View style={styles.flightDeckHudExpandedRow}>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>Heading</Text>
                <Text style={styles.flightDeckHudExpandedValue}>{headingSourceSummary?.code || '--'}</Text>
              </View>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>Attitude</Text>
                <Text style={styles.flightDeckHudExpandedValue}>{attitudeSourceSummary?.code || '--'}</Text>
              </View>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>Vision</Text>
                <Text style={styles.flightDeckHudExpandedValue}>{visionReadinessSummary?.code || '--'}</Text>
              </View>
            </View>
            <View style={styles.flightDeckHudExpandedRow}>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>VNAV</Text>
                <Text style={styles.flightDeckHudExpandedValue}>{flightDeckVerticalPathSummary.modeLabel}</Text>
              </View>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>Target</Text>
                <Text style={styles.flightDeckHudExpandedValue}>
                  {flightDeckVerticalConstraintSummary.targetAltitudeFt != null
                    ? `${Math.round(flightDeckVerticalConstraintSummary.targetAltitudeFt)} ft`
                    : flightDeckVerticalPathSummary.targetAltitudeFt != null
                      ? `${Math.round(flightDeckVerticalPathSummary.targetAltitudeFt)} ft`
                      : '--'}
                </Text>
              </View>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>Deviation</Text>
                <Text style={styles.flightDeckHudExpandedValue}>{flightDeckVerticalAlertSummary.deviationLabel}</Text>
              </View>
            </View>
            <View style={styles.flightDeckHudExpandedRow}>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>TOD</Text>
                <Text style={styles.flightDeckHudExpandedValue}>{flightDeckVerticalAlertSummary.todLabel}</Text>
              </View>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>Req VS</Text>
                <Text style={styles.flightDeckHudExpandedValue}>
                  {flightDeckVerticalConstraintSummary.requiredVsiFpm != null
                    ? `${Math.abs(flightDeckVerticalConstraintSummary.requiredVsiFpm)}`
                    : flightDeckVerticalPathSummary.requiredVsiFpm != null
                      ? `${Math.abs(flightDeckVerticalPathSummary.requiredVsiFpm)}`
                      : '--'}
                </Text>
              </View>
              <View style={styles.flightDeckHudExpandedMetric}>
                <Text style={styles.flightDeckHudExpandedLabel}>Source</Text>
                <Text style={styles.flightDeckHudExpandedValue}>
                  {flightDeckVerticalConstraintSummary.targetAltitudeFt != null
                    ? flightDeckVerticalConstraintSummary.sourceLabel
                    : 'HEUR'}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.flightDeckHud, { bottom: Math.max(insets.bottom + spacing.sm, 16) }]}
          activeOpacity={0.92}
          onPress={toggleFlightDeckHud}
        >
          <View
            style={[
              styles.flightDeckHudSourceChip,
              ownshipStatusTone === 'active'
                ? styles.flightDeckHudSourceChipActive
                : ownshipStatusTone === 'accent'
                  ? styles.flightDeckHudSourceChipAccent
                  : ownshipStatusTone === 'warning'
                    ? styles.flightDeckHudSourceChipWarning
                    : null,
            ]}
          >
            <Text
              style={[
                styles.flightDeckHudSourceChipText,
                ownshipStatusTone === 'active'
                  ? styles.flightDeckHudSourceChipTextActive
                  : ownshipStatusTone === 'accent'
                    ? styles.flightDeckHudSourceChipTextAccent
                    : ownshipStatusTone === 'warning'
                      ? styles.flightDeckHudSourceChipTextWarning
                      : null,
              ]}
            >
              {ownshipStatusLabel}
            </Text>
          </View>
          <View style={styles.flightDeckHudCell}>
            <Text style={styles.flightDeckHudLabel}>IAS</Text>
            <Text style={styles.flightDeckHudValue}>{activeOwnship?.speedKts ? `${activeOwnship.speedKts.toFixed(0)}` : '--'}</Text>
          </View>
          <View style={styles.flightDeckHudDivider} />
          <View style={styles.flightDeckHudCell}>
            <Text style={styles.flightDeckHudLabel}>ALT</Text>
            <Text style={styles.flightDeckHudValue}>{activeOwnship?.altitudeFt ? `${activeOwnship.altitudeFt.toFixed(0)}` : '--'}</Text>
          </View>
          <View style={styles.flightDeckHudDivider} />
          <View style={styles.flightDeckHudCell}>
            <Text style={styles.flightDeckHudLabel}>VSI</Text>
            <Text style={styles.flightDeckHudValue}>{activeVerticalSpeedFpm ? `${activeVerticalSpeedFpm.toFixed(0)}` : '--'}</Text>
          </View>
          <View style={styles.flightDeckHudDivider} />
          <View style={styles.flightDeckHudCell}>
            <Text style={styles.flightDeckHudLabel}>HDG</Text>
            <Text style={styles.flightDeckHudValue}>{activeOwnship?.heading ? `${activeOwnship.heading.toFixed(0)}` : '--'}</Text>
          </View>
          <View style={styles.flightDeckHudDivider} />
          <View style={styles.flightDeckHudCell}>
            <Text style={styles.flightDeckHudLabel}>ETE</Text>
            <Text style={styles.flightDeckHudValue}>{routeProgress?.etaText || '--'}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {flightDeckDrawerOpen ? (
        <ScrollView
          style={[styles.flightDeckSheet, { bottom: Math.max(insets.bottom + 110, 122) }]}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 16, 24) }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.flightDeckDrawerHeader}>
            <View>
              <Text style={styles.flightDeckDrawerTitle}>Cockpit Controls</Text>
              <Text style={styles.flightDeckDrawerSubtitle}>Two taps max to any tactical layer.</Text>
            </View>
            <TouchableOpacity
              style={styles.flightDeckDrawerClose}
              onPress={() => {
                setFlightDeckDrawerOpen(false);
                pulseFlightDeckChrome();
              }}
            >
              <Text style={styles.flightDeckDrawerCloseText}>Hide</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.flightDeckPanelTabs}>
            {([
              ['status', 'Status'],
              ['surface', 'Surface'],
              ['layers', 'Layers'],
              ['traffic', 'Traffic'],
              ['diversions', 'Diversions'],
            ] as const).map(([value, label]) => (
              <TouchableOpacity
                key={`deck-tab-${value}`}
                style={[styles.flightDeckTab, flightDeckPanel === value && styles.flightDeckTabActive]}
                onPress={() => {
                  pulseFlightDeckChrome(true);
                  setFlightDeckPanel(value);
                }}
              >
                <Text style={[styles.flightDeckTabText, flightDeckPanel === value && styles.flightDeckTabTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {flightDeckPanel === 'status' && (
            <View style={styles.flightDeckPanel}>
              <View style={styles.flightDeckPanelRow}>
                <View>
                  <Text style={styles.flightDeckPanelTitle}>Flight Controls</Text>
                  <Text style={styles.flightDeckPanelText}>Receiver, GPS fallback, and sim controls.</Text>
                </View>
                <Text style={styles.flightDeckBadge}>{flightDeckSessionState || 'PREFLIGHT'}</Text>
              </View>
              <Text style={styles.flightDeckPanelText}>
                Source {ownshipSourceSummary?.code || '--'} - {ownshipSourceSummary?.detail || 'Tracking source unavailable.'}
              </Text>
              <Text style={styles.flightDeckPanelText}>Freshness {ownshipFreshnessText}</Text>
              <Text style={styles.flightDeckPanelText}>
                Heading {headingSourceSummary?.code || '--'} - {headingSourceSummary?.detail || 'No heading source.'}
              </Text>
              <Text style={styles.flightDeckPanelText}>
                Attitude {attitudeSourceSummary?.code || '--'} - {attitudeSourceSummary?.detail || 'Attitude source unavailable.'}
              </Text>
              <Text style={styles.flightDeckPanelText}>
                Vision {visionReadinessSummary?.code || '--'} - {visionReadinessSummary?.detail || 'Vision readiness unavailable.'}
              </Text>
              <Text style={styles.flightDeckPanelText}>
                Phase {flightDeckPhaseSummary?.label || 'Preflight'} - {flightDeckPhaseSummary?.detail || 'Phase logic pending.'}
              </Text>
              <Text style={styles.flightDeckPanelText}>
                Receiver {receiverStatusSummary?.code || '--'} - {receiverStatusSummary?.detail || 'No receiver health summary.'}
              </Text>
              <Text style={styles.flightDeckPanelText}>
                Nav data {routeExecutionSummary?.navDataSourceSummary?.code || '--'} - {routeExecutionSummary?.navDataSourceSummary?.detail || 'No route-structure or nav-data source active.'}
              </Text>
              {typeof routeExecutionSummary?.navDataCoveragePct === 'number' ? (
                <Text style={styles.flightDeckPanelText}>
                  Coverage {routeExecutionSummary.navDataCoveragePct}% - {routeExecutionSummary.navDataStructuredLegCount || 0} structured legs
                  {typeof routeExecutionSummary?.navDataBriefingLegCount === 'number' && routeExecutionSummary.navDataBriefingLegCount > 0
                    ? ` - ${routeExecutionSummary.navDataBriefingLegCount} briefing-backed legs`
                    : ''}
                  {typeof routeExecutionSummary?.navDataProviderLegCount === 'number' && routeExecutionSummary.navDataProviderLegCount > 0
                    ? ` - ${routeExecutionSummary.navDataProviderLegCount} provider legs`
                    : ''}
                  {typeof routeExecutionSummary?.navDataAirwaySegmentCount === 'number' && routeExecutionSummary.navDataAirwaySegmentCount > 0
                    ? ` - ${routeExecutionSummary.navDataAirwaySegmentCount} airway segments tracked`
                    : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.navDataWarnings?.length ? (
                <Text style={styles.flightDeckPanelText}>Nav note {routeExecutionSummary.navDataWarnings[0]}</Text>
              ) : null}
              {receiverHealth?.warnings?.length ? (
                <Text style={styles.flightDeckPanelText}>Receiver note {receiverHealth.warnings[0]}</Text>
              ) : null}
              {receiverOwnshipFresh === false ? (
                <Text style={styles.flightDeckPanelText}>
                  Receiver ownship is stale.{gpsOwnshipFresh ? ' GPS fallback is active.' : ' No live fallback is active.'}
                </Text>
              ) : null}
              <View style={styles.flightDeckControlRow}>
                <TouchableOpacity style={[styles.flightDeckChip, trafficEnabled && styles.flightDeckChipActive]} onPress={() => setTrafficEnabled(!trafficEnabled)}>
                  <Text style={[styles.flightDeckChipText, trafficEnabled && styles.flightDeckChipTextActive]}>Traffic</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.flightDeckChip, gpsEnabled && styles.flightDeckChipActive]}
                  onPress={() => setGpsEnabled(!gpsEnabled)}
                  disabled={simulationEnabled}
                >
                  <Text style={[styles.flightDeckChipText, gpsEnabled && styles.flightDeckChipTextActive]}>GPS</Text>
                </TouchableOpacity>
                {isSuperAdmin ? (
                  <TouchableOpacity style={[styles.flightDeckChip, simulationEnabled && styles.flightDeckChipActive]} onPress={() => setSimulationEnabled(!simulationEnabled)}>
                    <Text style={[styles.flightDeckChipText, simulationEnabled && styles.flightDeckChipTextActive]}>Sim</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {isSuperAdmin && simulationEnabled ? (
                <Text style={styles.flightDeckPanelText}>
                  {Math.round((simulationProgress ?? 0) * 100)}% complete at {simulationSpeed}.
                </Text>
              ) : null}
              <View style={styles.flightDeckControlRow}>
                <TouchableOpacity
                  style={[styles.flightDeckChip, flightDeckHudExpanded && styles.flightDeckChipActive]}
                  onPress={toggleFlightDeckHud}
                >
                  <Text style={[styles.flightDeckChipText, flightDeckHudExpanded && styles.flightDeckChipTextActive]}>
                    {flightDeckHudExpanded ? 'Collapse HUD' : 'Expand HUD'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.flightDeckChip, flightDeckView === 'vision' && styles.flightDeckChipActive]}
                  onPress={toggleFlightDeckView}
                >
                  <Text style={[styles.flightDeckChipText, flightDeckView === 'vision' && styles.flightDeckChipTextActive]}>
                    {flightDeckView === 'vision' ? 'Return to map' : attitudeSourceSummary?.pilotGrade ? 'Open vision' : 'Open vision assist'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {flightDeckPanel === 'surface' && (
            <>
              <FlightDeckSurfaceMap preview={flightDeckSurfacePreview} styles={styles} />
              <View style={styles.flightDeckPanel}>
                <Text style={styles.flightDeckPanelTitle}>Runway Ops</Text>
                {flightDeckRunwayOpsSummary ? (
                  <>
                    <Text style={styles.flightDeckPanelText}>
                      {flightDeckRunwayOpsSummary.airportIcao} runway {flightDeckRunwayOpsSummary.runwayId} - {flightDeckRunwayOpsSummary.phaseCall}
                    </Text>
                    <Text style={styles.flightDeckPanelText}>
                      {flightDeckRunwayOpsSummary.runwayMeta}
                      {typeof flightDeckRunwayOpsSummary.headwindKt === 'number'
                        ? ` - HW ${Math.round(flightDeckRunwayOpsSummary.headwindKt)} kt`
                        : ''}
                      {typeof flightDeckRunwayOpsSummary.crosswindKt === 'number'
                        ? ` - XW ${Math.round(flightDeckRunwayOpsSummary.crosswindKt)} kt`
                        : ''}
                    </Text>
                    <Text style={styles.flightDeckPanelText}>
                      GND {flightDeckRunwayOpsSummary.groundFreq} - TWR {flightDeckRunwayOpsSummary.towerFreq} - ATIS {flightDeckRunwayOpsSummary.atisFreq}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.flightDeckPanelText}>
                    {departureBriefingLoading || destinationBriefingLoading || departureFrequenciesLoading || destinationFrequenciesLoading
                      ? 'Loading runway operations data...'
                      : 'Runway operations data will stage when departure or arrival becomes active.'}
                  </Text>
                )}
                {departureBriefing?.runwayInUse && flightDeckSurfacePreview?.mode === 'departure' ? (
                  <Text style={styles.flightDeckPanelText}>Departure runway in use {departureBriefing.runwayInUse}</Text>
                ) : null}
              </View>
            </>
          )}

          {flightDeckPanel === 'status' && routeProgress ? (
            <View style={styles.flightDeckPanel}>
              <Text style={styles.flightDeckPanelTitle}>Route Progress</Text>
              <Text style={styles.flightDeckPanelText}>
                Active leg {routeExecutionSummary?.activeLegLabel || routeProgress.activeLegLabel || '--'} ({routeExecutionSummary?.activeLegType || 'enroute'} / {routeExecutionSummary?.activeLegProfile || 'enroute'}) / {routeProgress.remainingLegNm.toFixed(1)} NM remaining on leg / {routeProgress.legProgressPct.toFixed(0)}% complete
              </Text>
              <Text style={styles.flightDeckPanelText}>
                Next {routeExecutionSummary?.nextLegLabel || routeProgress.nextLegLabel || routeProgress.nextWaypoint || '--'}{routeExecutionSummary?.nextLegType ? ` (${routeExecutionSummary.nextLegType})` : ''} - Destination {routeExecutionSummary?.destinationLegLabel || routeProgress.destinationWaypoint || '--'}{routeExecutionSummary?.destinationLegType ? ` (${routeExecutionSummary.destinationLegType})` : ''} - {routeProgress.legsRemaining} legs after active leg
              </Text>
              <Text style={styles.flightDeckPanelText}>
                Corridor {visionRouteGuidance?.corridorSeverity || 'nominal'} - Cross-track {routeProgress.crossTrackNm.toFixed(1)} NM - Off route {routeProgress.offRouteNm.toFixed(1)} NM - {routeExecutionSummary?.sequencingDetail || 'Sequencing nominal'}
              </Text>
              <Text style={styles.flightDeckPanelText}>
                Lateral state {routeExecutionSummary?.lateralExecutionState || 'intercept'} - {routeExecutionSummary?.activeLegGuidanceMode || 'track'} guidance active.
              </Text>
              {routeExecutionSummary?.activeExecutionSegment?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Segment {routeExecutionSummary.activeExecutionSegment.label}
                  {routeExecutionSummary?.nextExecutionSegment?.label ? ` - Next ${routeExecutionSummary.nextExecutionSegment.label}` : ''}
                  {routeExecutionSummary?.activeExecutionSegment?.sequencingModel ? ` - ${routeExecutionSummary.activeExecutionSegment.sequencingModel} sequencing` : ''}
                  {activeExecutionPlanEntry?.actionCue ? ` - ${activeExecutionPlanEntry.actionCue}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeExecutionTransition?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Transition model {routeExecutionSummary.activeExecutionTransition.label}
                  {routeExecutionSummary?.nextExecutionTransition?.label ? ` - Next ${routeExecutionSummary.nextExecutionTransition.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureContext?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Navigation context {routeExecutionSummary.activeProcedureContext.label}
                  {routeExecutionSummary?.nextProcedureContext?.label ? ` - Next ${routeExecutionSummary.nextProcedureContext.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureHandoff?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Handoff model {routeExecutionSummary.activeProcedureHandoff.label}
                  {routeExecutionSummary?.nextProcedureHandoff?.label ? ` - Next ${routeExecutionSummary.nextProcedureHandoff.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureEntryRole?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Procedure role {routeExecutionSummary.activeProcedureEntryRole.label}
                  {routeExecutionSummary?.activeProcedureEntryRole?.cue ? ` - ${routeExecutionSummary.activeProcedureEntryRole.cue}` : ''}
                  {routeExecutionSummary?.nextProcedureEntryRole?.label ? ` - Next ${routeExecutionSummary.nextProcedureEntryRole.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureEntryDescriptor?.positionLabel ? (
                <Text style={styles.flightDeckPanelText}>
                  Procedure entry {routeExecutionSummary.activeProcedureEntryDescriptor.positionLabel}
                  {routeExecutionSummary?.activeProcedureEntryDescriptor?.cueProfile?.label
                    ? ` - ${routeExecutionSummary.activeProcedureEntryDescriptor.cueProfile.label}`
                    : ''}
                  {routeExecutionSummary?.nextProcedureEntryDescriptor?.positionLabel
                    ? ` - Next ${routeExecutionSummary.nextProcedureEntryDescriptor.positionLabel}`
                    : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureEntryTransitionBehavior?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Entry transition {routeExecutionSummary.activeProcedureEntryTransitionBehavior.label}
                  {routeExecutionSummary?.activeProcedureEntryTransitionBehavior?.sequencingCue
                    ? ` - ${routeExecutionSummary.activeProcedureEntryTransitionBehavior.sequencingCue}`
                    : ''}
                  {routeExecutionSummary?.nextProcedureEntryTransitionBehavior?.label
                    ? ` - Next ${routeExecutionSummary.nextProcedureEntryTransitionBehavior.label}`
                    : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureTransitionTable?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Transition table {routeExecutionSummary.activeProcedureTransitionTable.label}
                  {routeExecutionSummary?.activeProcedureTransitionTable?.handoffPathLabel
                    ? ` - ${routeExecutionSummary.activeProcedureTransitionTable.handoffPathLabel}`
                    : ''}
                  {routeExecutionSummary?.nextProcedureTransitionTable?.label
                    ? ` - Next ${routeExecutionSummary.nextProcedureTransitionTable.label}`
                    : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureSegmentTemplate?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Segment template {routeExecutionSummary.activeProcedureSegmentTemplate.label}
                  {routeExecutionSummary?.activeProcedureSegmentTemplate?.phaseLabel
                    ? ` - ${routeExecutionSummary.activeProcedureSegmentTemplate.phaseLabel}`
                    : ''}
                  {routeExecutionSummary?.activeProcedureSegmentTemplate?.segmentCue
                    ? ` - ${routeExecutionSummary.activeProcedureSegmentTemplate.segmentCue}`
                    : ''}
                  {routeExecutionSummary?.nextProcedureSegmentTemplate?.label
                    ? ` - Next ${routeExecutionSummary.nextProcedureSegmentTemplate.label}`
                    : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureSegmentClass?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Segment class {routeExecutionSummary.activeProcedureSegmentClass.label}
                  {routeExecutionSummary?.activeProcedureSegmentClass?.lateralMode
                    ? ` - ${routeExecutionSummary.activeProcedureSegmentClass.lateralMode}`
                    : ''}
                  {typeof routeExecutionSummary?.activeProcedureSegmentClass?.terminalArea === 'boolean'
                    ? ` - ${routeExecutionSummary.activeProcedureSegmentClass.terminalArea ? 'terminal' : 'enroute'}`
                    : ''}
                  {typeof routeExecutionSummary?.activeProcedureSegmentClass?.procedureReady === 'boolean'
                    ? ` - ${routeExecutionSummary.activeProcedureSegmentClass.procedureReady ? 'procedure-ready' : 'route-only'}`
                    : ''}
                  {routeExecutionSummary?.nextProcedureSegmentClass?.label
                    ? ` - Next ${routeExecutionSummary.nextProcedureSegmentClass.label}`
                    : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureLegAdapter?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Leg adapter {routeExecutionSummary.activeProcedureLegAdapter.label}
                  {routeExecutionSummary?.activeProcedureLegAdapter?.kind
                    ? ` - ${routeExecutionSummary.activeProcedureLegAdapter.kind}`
                    : ''}
                  {typeof routeExecutionSummary?.activeProcedureLegAdapter?.navDataReady === 'boolean'
                    ? ` - ${routeExecutionSummary.activeProcedureLegAdapter.navDataReady ? 'nav-data ready' : 'synthetic'}`
                    : ''}
                  {routeExecutionSummary?.activeProcedureLegAdapter?.adapterCue
                    ? ` - ${routeExecutionSummary.activeProcedureLegAdapter.adapterCue}`
                    : ''}
                  {routeExecutionSummary?.nextProcedureLegAdapter?.label
                    ? ` - Next ${routeExecutionSummary.nextProcedureLegAdapter.label}`
                    : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureLegFamily?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Leg family {routeExecutionSummary.activeProcedureLegFamily.label}
                  {routeExecutionSummary?.activeProcedureLegFamily?.kind
                    ? ` - ${routeExecutionSummary.activeProcedureLegFamily.kind}`
                    : ''}
                  {typeof routeExecutionSummary?.activeProcedureLegFamily?.parserReady === 'boolean'
                    ? ` - ${routeExecutionSummary.activeProcedureLegFamily.parserReady ? 'parser-ready' : 'synthetic-only'}`
                    : ''}
                  {routeExecutionSummary?.activeProcedureLegFamily?.familyCue
                    ? ` - ${routeExecutionSummary.activeProcedureLegFamily.familyCue}`
                    : ''}
                  {routeExecutionSummary?.nextProcedureLegFamily?.label
                    ? ` - Next ${routeExecutionSummary.nextProcedureLegFamily.label}`
                    : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureLegParserTarget?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Parser target {routeExecutionSummary.activeProcedureLegParserTarget.label}
                  {routeExecutionSummary?.activeProcedureLegParserTarget?.kind
                    ? ` - ${routeExecutionSummary.activeProcedureLegParserTarget.kind}`
                    : ''}
                  {routeExecutionSummary?.activeProcedureLegParserTarget?.source
                    ? ` - ${routeExecutionSummary.activeProcedureLegParserTarget.source}`
                    : ''}
                  {routeExecutionSummary?.activeProcedureLegParserTarget?.requiredFields?.length
                    ? ` - fields ${routeExecutionSummary.activeProcedureLegParserTarget.requiredFields.join(', ')}`
                    : ''}
                  {routeExecutionSummary?.activeProcedureLegParserTarget?.parserCue
                    ? ` - ${routeExecutionSummary.activeProcedureLegParserTarget.parserCue}`
                    : ''}
                  {routeExecutionSummary?.nextProcedureLegParserTarget?.label
                    ? ` - Next ${routeExecutionSummary.nextProcedureLegParserTarget.label}`
                    : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureLegIngestionContract?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Ingestion contract {routeExecutionSummary.activeProcedureLegIngestionContract.label}
                  {routeExecutionSummary?.activeProcedureLegIngestionContract?.payloadShape
                    ? ` - ${routeExecutionSummary.activeProcedureLegIngestionContract.payloadShape}`
                    : ''}
                  {routeExecutionSummary?.activeProcedureLegIngestionContract?.source
                    ? ` - ${routeExecutionSummary.activeProcedureLegIngestionContract.source}`
                    : ''}
                  {routeExecutionSummary?.activeProcedureLegIngestionContract?.requiredFields?.length
                    ? ` - req ${routeExecutionSummary.activeProcedureLegIngestionContract.requiredFields.join(', ')}`
                    : ''}
                  {routeExecutionSummary?.activeProcedureLegIngestionContract?.optionalFields?.length
                    ? ` - opt ${routeExecutionSummary.activeProcedureLegIngestionContract.optionalFields.join(', ')}`
                    : ''}
                  {routeExecutionSummary?.nextProcedureLegIngestionContract?.label
                    ? ` - Next ${routeExecutionSummary.nextProcedureLegIngestionContract.label}`
                    : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeParsedLegPayload?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Parsed payload {routeExecutionSummary.activeParsedLegPayload.label}
                  {routeExecutionSummary.activeParsedLegPayload.kind === 'runway-release-payload'
                    ? ` - ${routeExecutionSummary.activeParsedLegPayload.airportIdent} ${routeExecutionSummary.activeParsedLegPayload.runwayIdent} @ ${typeof routeExecutionSummary.activeParsedLegPayload.releaseHeading === 'number' ? Math.round(routeExecutionSummary.activeParsedLegPayload.releaseHeading) : '--'}°`
                    : routeExecutionSummary.activeParsedLegPayload.kind === 'course-to-fix-payload'
                      ? ` - ${routeExecutionSummary.activeParsedLegPayload.fromFix} -> ${routeExecutionSummary.activeParsedLegPayload.toFix} @ ${typeof routeExecutionSummary.activeParsedLegPayload.courseDeg === 'number' ? Math.round(routeExecutionSummary.activeParsedLegPayload.courseDeg) : '--'}°${typeof routeExecutionSummary.activeParsedLegPayload.altitudeConstraintFt === 'number' ? ` / ${Math.round(routeExecutionSummary.activeParsedLegPayload.altitudeConstraintFt)} ft` : ''}`
                      : routeExecutionSummary.activeParsedLegPayload.kind === 'terminal-feed-payload'
                        ? ` - ${routeExecutionSummary.activeParsedLegPayload.transitionFix} -> ${routeExecutionSummary.activeParsedLegPayload.handoffFix} for ${routeExecutionSummary.activeParsedLegPayload.arrivalIdent}`
                        : routeExecutionSummary.activeParsedLegPayload.kind === 'final-capture-payload'
                          ? ` - ${routeExecutionSummary.activeParsedLegPayload.runwayIdent} @ ${typeof routeExecutionSummary.activeParsedLegPayload.finalCourseDeg === 'number' ? Math.round(routeExecutionSummary.activeParsedLegPayload.finalCourseDeg) : '--'}°`
                          : routeExecutionSummary.activeParsedLegPayload.kind === 'direct-resume-payload'
                            ? ` - ${routeExecutionSummary.activeParsedLegPayload.originFix} -> ${routeExecutionSummary.activeParsedLegPayload.targetFix}`
                            : ''}
                  {routeExecutionSummary?.nextParsedLegPayload?.label
                    ? ` - Next ${routeExecutionSummary.nextParsedLegPayload.label}`
                    : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureRoleCueProfile?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Role cues {routeExecutionSummary.activeProcedureRoleCueProfile.label}
                  {routeExecutionSummary?.activeProcedureRoleCueProfile?.sequencingSummary
                    ? ` - ${routeExecutionSummary.activeProcedureRoleCueProfile.sequencingSummary}`
                    : ''}
                  {routeExecutionSummary?.nextProcedureRoleCueProfile?.label ? ` - Next ${routeExecutionSummary.nextProcedureRoleCueProfile.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureRoleExecutionPolicy?.sequencingModel ? (
                <Text style={styles.flightDeckPanelText}>
                  Role sequencing {routeExecutionSummary.activeProcedureRoleExecutionPolicy.sequencingModel}
                  {routeExecutionSummary?.activeProcedureRoleExecutionPolicy?.manualReason
                    ? ` - ${routeExecutionSummary.activeProcedureRoleExecutionPolicy.manualReason}`
                    : ''}
                  {routeExecutionSummary?.nextProcedureRoleExecutionPolicy?.sequencingModel
                    ? ` - Next ${routeExecutionSummary.nextProcedureRoleExecutionPolicy.sequencingModel}`
                    : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureChain?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Procedure chain {routeExecutionSummary.activeProcedureChain.label}
                  {routeExecutionSummary?.nextProcedureChain?.label ? ` - Next ${routeExecutionSummary.nextProcedureChain.label}` : ''}
                  {typeof routeExecutionSummary?.activeProcedureChain?.entryCount === 'number'
                    ? ` - ${routeExecutionSummary.activeProcedureChain.entryCount} leg block`
                    : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureChainBehavior?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Chain behavior {routeExecutionSummary.activeProcedureChainBehavior.label}
                  {routeExecutionSummary?.nextProcedureChainBehavior?.label ? ` - Next ${routeExecutionSummary.nextProcedureChainBehavior.label}` : ''}
                  {routeExecutionSummary?.activeProcedureChainBehavior?.sequencingModel
                    ? ` - ${routeExecutionSummary.activeProcedureChainBehavior.sequencingModel} sequencing`
                    : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureTemplate?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Procedure template {routeExecutionSummary.activeProcedureTemplate.label}
                  {routeExecutionSummary?.nextProcedureTemplate?.label ? ` - Next ${routeExecutionSummary.nextProcedureTemplate.label}` : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureExecutionProfile?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Execution profile {routeExecutionSummary.activeProcedureExecutionProfile.label}
                  {routeExecutionSummary?.nextProcedureExecutionProfile?.label ? ` - Next ${routeExecutionSummary.nextProcedureExecutionProfile.label}` : ''}
                  {typeof routeExecutionSummary?.activeProcedureExecutionProfile?.armAtProgressPct === 'number'
                    ? ` - arm ${routeExecutionSummary.activeProcedureExecutionProfile.armAtProgressPct}%`
                    : ''}
                  {typeof routeExecutionSummary?.activeProcedureExecutionProfile?.openAtProgressPct === 'number'
                    ? ` / open ${routeExecutionSummary.activeProcedureExecutionProfile.openAtProgressPct}%`
                    : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.activeProcedureCueStack?.label ? (
                <Text style={styles.flightDeckPanelText}>
                  Cue stack {routeExecutionSummary.activeProcedureCueStack.label}
                  {routeExecutionSummary?.nextProcedureCueStack?.label ? ` - Next ${routeExecutionSummary.nextProcedureCueStack.label}` : ''}
                  {routeExecutionSummary?.activeProcedureCueStack?.sequencingSummary
                    ? ` - ${routeExecutionSummary.activeProcedureCueStack.sequencingSummary}`
                    : ''}
                </Text>
              ) : null}
              {nextExecutionPlanEntry ? (
                <Text style={styles.flightDeckPanelText}>
                  Execution plan next {nextExecutionPlanEntry.legLabel} - {nextExecutionPlanEntry.actionCue}.
                </Text>
              ) : null}
              <Text style={styles.flightDeckPanelText}>
                Sequence gate {routeExecutionSummary?.sequenceGateState || 'blocked'} - {routeExecutionSummary?.sequenceGateCall || 'Standby gate'}.
              </Text>
              {routeExecutionSummary?.sequenceGateState === 'manual-open' ? (
                <Text style={styles.flightDeckPanelText}>This segment is managed. Use Next leg when ready to sequence.</Text>
              ) : null}
              {routeExecutionSummary?.transitionCall ? (
                <Text style={styles.flightDeckPanelText}>Transition state {routeExecutionSummary.transitionCall}.</Text>
              ) : null}
              {routeExecutionSummary?.nextActionCall ? (
                <Text style={styles.flightDeckPanelText}>Next action {routeExecutionSummary.nextActionCall}.</Text>
              ) : null}
              {routeExecutionSummary?.nextLegArmed ? (
                <Text style={styles.flightDeckPanelText}>
                  {routeExecutionSummary?.manualAdvanceRequired
                    ? routeExecutionSummary?.activeProcedureCueStack?.nextLegManagedLabel || 'Next leg is staged inside a managed procedure block. Use manual advance when ready.'
                    : routeExecutionSummary?.activeProcedureCueStack?.nextLegAutoLabel || 'Next leg is armed and will capture automatically when sequencing criteria are met.'}
                </Text>
              ) : null}
              {routeExecutionSummary?.turnAnticipationState && routeExecutionSummary.turnAnticipationState !== 'idle' ? (
                <Text style={styles.flightDeckPanelText}>
                  Turn anticipation {routeExecutionSummary.turnAnticipationCall}
                  {typeof routeExecutionSummary.nextLegDesiredTrackDeg === 'number'
                    ? ` Â· next course ${Math.round(routeExecutionSummary.nextLegDesiredTrackDeg)}Â°`
                    : ''}
                </Text>
              ) : null}
              {routeExecutionSummary?.mode === 'direct-to' ? (
                <Text style={styles.flightDeckPanelText}>Direct-to override is active. Resume the planned route when ready.</Text>
              ) : null}
              <View style={styles.flightDeckControlRow}>
                <TouchableOpacity
                  style={[
                    styles.flightDeckChip,
                    !routeExecutionSummary?.canSequencePrev && styles.flightDeckChipDisabled,
                  ]}
                  onPress={sequencePreviousLeg}
                  disabled={!routeExecutionSummary?.canSequencePrev}
                >
                  <Text
                    style={[
                      styles.flightDeckChipText,
                      !routeExecutionSummary?.canSequencePrev && styles.flightDeckChipTextDisabled,
                    ]}
                  >
                    Previous leg
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.flightDeckChip,
                    !routeExecutionSummary?.canSequenceNext && styles.flightDeckChipDisabled,
                  ]}
                  onPress={sequenceNextLeg}
                  disabled={!routeExecutionSummary?.canSequenceNext}
                >
                  <Text
                    style={[
                      styles.flightDeckChipText,
                      !routeExecutionSummary?.canSequenceNext && styles.flightDeckChipTextDisabled,
                    ]}
                  >
                    {routeExecutionSummary?.nextLegControlLabel || 'Next leg'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.flightDeckControlRow}>
                <TouchableOpacity style={styles.flightDeckChip} onPress={toggleSequencingSuspend}>
                  <Text style={styles.flightDeckChipText}>
                    {routeExecutionSummary?.sequencingSuspended ? 'Resume sequencing' : 'Suspend sequencing'}
                  </Text>
                </TouchableOpacity>
                {routeExecutionSummary?.mode === 'direct-to' ? (
                  <TouchableOpacity style={styles.flightDeckChip} onPress={resumePlannedRoute}>
                    <Text style={styles.flightDeckChipText}>Resume planned route</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}

          {flightDeckPanel === 'status' && (
            <View style={styles.flightDeckPanel}>
              <Text style={styles.flightDeckPanelTitle}>Director State</Text>
              <Text style={styles.flightDeckPanelText}>
                Mode {mapTacticalSummary.modeLabel} / {visionDirectorCue.turnCommand}
              </Text>
              <Text style={styles.flightDeckPanelText}>{visionDirectorCue.verticalCommand}</Text>
              <Text style={styles.flightDeckPanelText}>
                {flightDeckVerticalPathSummary.modeLabel} - {flightDeckVerticalPathSummary.support}
              </Text>
              <Text style={styles.flightDeckPanelText}>{routeExecutionSummary?.verticalConstraintCall || mapTacticalSummary.verticalConstraintCall}</Text>
              <Text style={styles.flightDeckPanelText}>{flightDeckVerticalConstraintSummary.constraintGateCall}</Text>
              {flightDeckVerticalConstraintSummary.targetAltitudeFt != null ? (
                <Text style={styles.flightDeckPanelText}>
                  {flightDeckVerticalConstraintSummary.modeLabel} - {flightDeckVerticalConstraintSummary.support}
                  {typeof flightDeckVerticalConstraintSummary.activeConstraintDistanceNm === 'number'
                    ? ` - ${flightDeckVerticalConstraintSummary.activeConstraintDistanceNm.toFixed(1)} NM`
                    : ''}
                  {' - '}
                  {flightDeckVerticalConstraintSummary.sourceLabel}
                </Text>
              ) : null}
              {flightDeckVerticalPathSummary.requiredVsiFpm != null ? (
                <Text style={styles.flightDeckPanelText}>
                  VNAV {Math.abs(flightDeckVerticalPathSummary.requiredVsiFpm)} fpm
                  {flightDeckVerticalPathSummary.targetAltitudeFt != null
                    ? ` to ${Math.round(flightDeckVerticalPathSummary.targetAltitudeFt)} ft`
                    : ''}
                </Text>
              ) : null}
              {flightDeckVerticalConstraintSummary.requiredVsiFpm != null ? (
                <Text style={styles.flightDeckPanelText}>
                  Procedure VNAV {Math.abs(flightDeckVerticalConstraintSummary.requiredVsiFpm)} fpm
                  {flightDeckVerticalConstraintSummary.targetAltitudeFt != null
                    ? ` to ${Math.round(flightDeckVerticalConstraintSummary.targetAltitudeFt)} ft`
                    : ''}
                </Text>
              ) : null}
              <Text style={styles.flightDeckPanelText}>{mapTacticalSummary.recommendation}</Text>
              <Text style={styles.flightDeckPanelText}>{flightDeckVerticalPathSummary.recommendation}</Text>
              {flightDeckVerticalConstraintSummary.targetAltitudeFt != null ? (
                <Text style={styles.flightDeckPanelText}>{flightDeckVerticalConstraintSummary.recommendation}</Text>
              ) : null}
            </View>
          )}

          {flightDeckPanel === 'status' && (
            <View style={styles.flightDeckPanel}>
              <Text style={styles.flightDeckPanelTitle}>Operational Snapshot</Text>
              <Text style={styles.flightDeckPanelText}>Route risk {routeRiskLabel}.</Text>
              <Text style={styles.flightDeckPanelText}>
                Weather counts: winds {summaryCounts.winds} - NOTAMs {summaryCounts.notams} - PIREPs {summaryCounts.pireps}
              </Text>
              {selectedDiversion ? (
                <Text style={styles.flightDeckPanelText}>
                  Best diversion {selectedDiversion.icao} - {selectedDiversion.distanceNm.toFixed(1)} NM
                  {selectedDiversionBestComm?.frequencyMhz ? ` - ${selectedDiversionBestComm.frequencyMhz.toFixed(3)}` : ''}
                </Text>
              ) : null}
              {topTrafficTarget ? (
                <Text style={styles.flightDeckPanelText}>
                  Highest traffic target {topTrafficTarget.callsign || 'Traffic'} - {(topTrafficTarget.distanceNm ?? 0).toFixed(1)} NM - score {topTrafficTarget.threatScore}
                </Text>
              ) : null}
            </View>
          )}

          {flightDeckPanel === 'status' && (
            <View style={styles.flightDeckPanel}>
              <Text style={styles.flightDeckPanelTitle}>Quick Actions</Text>
              {selectedTrafficTarget ? (
                <Text style={styles.flightDeckPanelText}>
                  Selected traffic {selectedTrafficTarget.callsign || 'Traffic'} - {(selectedTrafficTarget.distanceNm ?? 0).toFixed(1)} NM - {formatAltitudeDelta?.(selectedTrafficTarget.altitudeDeltaFt ?? null) ?? '--'}
                </Text>
              ) : null}
              {selectedDiversion ? (
                <Text style={styles.flightDeckPanelText}>
                  Ready diversion {selectedDiversion.icao} - {selectedDiversion.distanceNm.toFixed(1)} NM
                </Text>
              ) : null}
              <View style={styles.flightDeckControlRow}>
                <TouchableOpacity style={styles.flightDeckChip} onPress={toggleSequencingSuspend}>
                  <Text style={styles.flightDeckChipText}>
                    {routeExecutionSummary?.sequencingSuspended ? 'Resume sequencing' : 'Suspend sequencing'}
                  </Text>
                </TouchableOpacity>
                {routeExecutionSummary?.mode === 'direct-to' ? (
                  <TouchableOpacity style={styles.flightDeckChip} onPress={resumePlannedRoute}>
                    <Text style={styles.flightDeckChipText}>Resume planned route</Text>
                  </TouchableOpacity>
                ) : null}
                {selectedTrafficTarget ? (
                  <TouchableOpacity style={styles.flightDeckChip} onPress={() => focusTrafficTarget(selectedTrafficTarget)}>
                    <Text style={styles.flightDeckChipText}>Focus traffic</Text>
                  </TouchableOpacity>
                ) : null}
                {selectedDiversion ? (
                  <TouchableOpacity
                    style={[styles.flightDeckChip, styles.flightDeckChipActive]}
                    onPress={() => engageDirectToDiversion(selectedDiversion)}
                  >
                    <Text style={[styles.flightDeckChipText, styles.flightDeckChipTextActive]}>Direct-to diversion</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          )}

          {flightDeckPanel === 'status' && (
            <View style={styles.flightDeckPanel}>
              <Text style={styles.flightDeckPanelTitle}>Terrain & Obstacles</Text>
              <Text style={styles.flightDeckPanelText}>
                Terrain {terrainClearanceFt != null ? `${Math.round(terrainClearanceFt)} ft clearance` : terrainProfileLoading ? 'loading terrain profile' : 'not available'}.
              </Text>
              <Text style={styles.flightDeckPanelText}>
                Obstacle {obstacleClearanceFt != null ? `${Math.round(obstacleClearanceFt)} ft clearance` : obstacleScanLoading ? 'scanning nearby obstacles' : 'not available'}.
              </Text>
              {terrainProfile?.maxElevationFt != null ? (
                <Text style={styles.flightDeckPanelText}>
                  Highest terrain on route {Math.round(terrainProfile.maxElevationFt).toLocaleString()} ft.
                </Text>
              ) : null}
              {obstacleScan?.highestObstacle ? (
                <Text style={styles.flightDeckPanelText}>
                  Highest nearby obstacle {(obstacleScan.highestObstacle.amslFt ?? obstacleScan.highestObstacle.aglFt ?? 0).toLocaleString()} ft
                  {obstacleScan.highestObstacle.kind ? ` - ${obstacleScan.highestObstacle.kind}` : ''}.
                </Text>
              ) : null}
            </View>
          )}
          {flightDeckPanel === 'layers' && (
            <View style={styles.flightDeckPanel}>
              <Text style={styles.flightDeckPanelTitle}>Layer Controls</Text>
              <View style={styles.flightDeckControlRow}>
                {(['standard', 'sectional', 'terrain', 'radar', 'winds', 'clouds'] as const).map((value) => (
                  <TouchableOpacity
                    key={`deck-layer-${value}`}
                    style={[styles.flightDeckChip, mapStyle === value && styles.flightDeckChipActive]}
                    onPress={() => setMapStyle(value)}
                  >
                    <Text style={[styles.flightDeckChipText, mapStyle === value && styles.flightDeckChipTextActive]}>
                      {value === 'standard' ? 'Map' : value === 'sectional' ? 'VFR' : value === 'terrain' ? 'Terrain' : value === 'radar' ? 'Radar' : value === 'winds' ? 'Winds' : 'Clouds'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.flightDeckControlRow}>
                {(['all', 'conflict', 'above', 'below'] as const).map((value) => (
                  <TouchableOpacity
                    key={`deck-filter-${value}`}
                    style={[styles.flightDeckChip, trafficFilter === value && styles.flightDeckChipActive]}
                    onPress={() => setTrafficFilter(value)}
                  >
                    <Text style={[styles.flightDeckChipText, trafficFilter === value && styles.flightDeckChipTextActive]}>
                      {value === 'all' ? 'All traffic' : value === 'conflict' ? 'Conflict' : value === 'above' ? 'Above' : 'Below'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {isSuperAdmin && simulationEnabled ? (
                <>
                  <View style={styles.flightDeckControlRow}>
                    {(['1x', '4x', '8x'] as const).map((value) => (
                      <TouchableOpacity
                        key={`deck-speed-${value}`}
                        style={[styles.flightDeckChip, simulationSpeed === value && styles.flightDeckChipActive]}
                        onPress={() => setSimulationSpeed(value)}
                      >
                        <Text style={[styles.flightDeckChipText, simulationSpeed === value && styles.flightDeckChipTextActive]}>{value}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.flightDeckControlRow}>
                    <TouchableOpacity
                      style={[styles.flightDeckChip, simulationConflictEnabled && styles.flightDeckChipActive]}
                      onPress={() => setSimulationConflictEnabled(!simulationConflictEnabled)}
                    >
                      <Text style={[styles.flightDeckChipText, simulationConflictEnabled && styles.flightDeckChipTextActive]}>
                        {simulationConflictEnabled ? 'Conflict injected' : 'Inject conflict'}
                      </Text>
                    </TouchableOpacity>
                    {selectedDiversion ? (
                      <TouchableOpacity style={styles.flightDeckChip} onPress={() => engageDirectToDiversion(selectedDiversion)}>
                        <Text style={styles.flightDeckChipText}>Jump to diversion</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </>
              ) : null}
            </View>
          )}

          {flightDeckPanel === 'traffic' ? (
            <View style={styles.flightDeckPanel}>
              <Text style={styles.flightDeckPanelTitle}>Traffic Watch</Text>
              {trafficPanelTargets.length === 0 ? (
                <Text style={styles.flightDeckPanelText}>No traffic targets in the current filter band.</Text>
              ) : (
                trafficPanelTargets.map((target: any) => (
                  <TouchableOpacity
                    key={`deck-traffic-${target.id}`}
                    style={[styles.flightDeckListCard, selectedTrafficTarget?.id === target.id && styles.flightDeckListCardActive]}
                    onPress={() => focusTrafficTarget(target)}
                    activeOpacity={0.92}
                  >
                    <Text style={styles.flightDeckListTitle}>{target.callsign || 'Traffic target'}</Text>
                    <Text style={styles.flightDeckListMeta}>
                      {target.threatLevel === 'immediate' ? 'Immediate' : target.threatLevel === 'advisory' ? 'Advisory' : 'Monitor'} / score {target.threatScore}
                    </Text>
                    <Text style={styles.flightDeckPanelText}>
                      {(target.distanceNm ?? 0).toFixed(1)} NM - {formatAltitudeDelta?.(target.altitudeDeltaFt ?? null) ?? '--'}
                      {typeof target.altitudeFt === 'number' ? ` - ${Math.round(target.altitudeFt)} ft` : ''}
                    </Text>
                    <View style={styles.flightDeckControlRow}>
                      <TouchableOpacity style={styles.flightDeckChip} onPress={() => focusTrafficTarget(target)}>
                        <Text style={styles.flightDeckChipText}>Focus on map</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.flightDeckChip, selectedTrafficTarget?.id === target.id && styles.flightDeckChipActive]}
                        onPress={() => setSelectedTrafficId(target.id)}
                      >
                        <Text style={[styles.flightDeckChipText, selectedTrafficTarget?.id === target.id && styles.flightDeckChipTextActive]}>
                          {selectedTrafficTarget?.id === target.id ? 'Selected' : 'Select'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          ) : null}

          {flightDeckPanel === 'diversions' && (
            <View style={styles.flightDeckPanel}>
              <Text style={styles.flightDeckPanelTitle}>Diversions</Text>
              {diversionCandidates.length === 0 ? (
                <Text style={styles.flightDeckPanelText}>Enable GPS or sim to score nearby diversion airports.</Text>
              ) : (
                diversionPanelAirports.map((airport: any) => (
                  <TouchableOpacity
                    key={`deck-diversion-${airport.icao}`}
                    style={[styles.flightDeckListCard, selectedDiversion?.icao === airport.icao && styles.flightDeckListCardActive]}
                    onPress={() => {
                      setSelectedDiversionIcao(airport.icao);
                      focusDiversionAirport(airport);
                    }}
                    activeOpacity={0.92}
                  >
                    <Text style={styles.flightDeckListTitle}>
                      {airport.icao}
                      {airport.name ? ` - ${airport.name}` : ''}
                    </Text>
                    <Text style={styles.flightDeckListMeta}>
                      {selectedDiversion?.icao === airport.icao ? 'Selected' : airport.flightCategory || 'WX --'} / {airport.towered ? 'Towered' : 'Untowered'}
                    </Text>
                    <Text style={styles.flightDeckPanelText}>
                      {airport.distanceNm.toFixed(1)} NM - {Math.round(airport.bearingDeg)} deg - {airport.flightCategory || 'WX --'}
                      {airport.maxRunwayFt ? ` - ${airport.maxRunwayFt.toLocaleString()} ft` : ''}
                      {selectedDiversion?.icao === airport.icao && selectedDiversionBestComm?.frequencyMhz
                        ? ` - ${selectedDiversionBestComm.frequencyMhz.toFixed(3)}`
                        : ''}
                    </Text>
                    {selectedDiversion?.icao === airport.icao ? (
                      selectedDiversionBriefingLoading ? (
                        <Text style={styles.flightDeckPanelText}>Loading runway briefing...</Text>
                      ) : selectedDiversionBriefing?.advisory ? (
                        <Text style={styles.flightDeckPanelText}>
                          Runway {selectedDiversionBriefing.advisory.runway || '--'} - HW {selectedDiversionBriefing.advisory.headwind ?? '--'} kt - XW {selectedDiversionBriefing.advisory.crosswind ?? '--'} kt
                          {selectedDiversionBriefing.runwayInUse ? ` - In use ${selectedDiversionBriefing.runwayInUse}` : ''}
                        </Text>
                      ) : selectedDiversionBriefing?.runwayInUse ? (
                        <Text style={styles.flightDeckPanelText}>Runway in use {selectedDiversionBriefing.runwayInUse}</Text>
                      ) : null
                    ) : null}
                    {airport.scoreReasons?.length ? (
                      <Text style={styles.flightDeckPanelText}>{airport.scoreReasons.slice(0, 3).join(' - ')}</Text>
                    ) : null}
                    {selectedDiversion?.icao === airport.icao ? (
                      <View style={styles.flightDeckControlRow}>
                        <TouchableOpacity style={styles.flightDeckChip} onPress={() => focusDiversionAirport(airport)}>
                          <Text style={styles.flightDeckChipText}>Focus</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.flightDeckChip, styles.flightDeckChipActive]}
                          onPress={() => engageDirectToDiversion(airport)}
                        >
                          <Text style={[styles.flightDeckChipText, styles.flightDeckChipTextActive]}>Direct-to</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.flightDeckChip} onPress={() => setAlternate(airport.icao)}>
                          <Text style={styles.flightDeckChipText}>Alternate</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

