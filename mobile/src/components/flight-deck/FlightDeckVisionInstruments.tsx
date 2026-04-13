import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../../styles/theme';

type TerrainSample = {
  elevationFt?: number | null;
};

type FlightDeckVisionInstrumentsProps = {
  compact?: boolean;
  speedKts: number | null;
  altitudeFt: number | null;
  targetAltitudeFt?: number | null;
  directionModeLabel: string;
  directionDeg: number | null;
  terrainProfile?: {
    samples?: TerrainSample[] | null;
    maxElevationFt?: number | null;
  } | null;
  terrainRisk?: string | null;
  terrainClearanceFt?: number | null;
  obstacleClearanceFt?: number | null;
  terrainBandBottomOffset?: number;
};

type TapeProps = {
  side: 'left' | 'right';
  compact: boolean;
  label: string;
  unit: string;
  value: number | null;
  step: number;
  formatter: (value: number) => string;
  bugValue?: number | null;
  bugLabel?: string | null;
};

function normalizeHeading(value: number) {
  return ((Math.round(value) % 360) + 360) % 360;
}

function formatHeading(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '---';
  return normalizeHeading(value).toString().padStart(3, '0');
}

function formatAltitudeValue(value: number) {
  return Math.round(value).toLocaleString();
}

function formatSpeedValue(value: number) {
  return `${Math.round(value)}`;
}

const FlightDeckDataTape = memo(function FlightDeckDataTape({
  side,
  compact,
  label,
  unit,
  value,
  step,
  formatter,
  bugValue,
  bugLabel,
}: TapeProps) {
  const safeValue = value != null && Number.isFinite(value) ? value : null;
  const tickValues = useMemo(() => {
    const current = safeValue ?? 0;
    return [-2, -1, 0, 1, 2].map((offset) => current + offset * step);
  }, [safeValue, step]);

  return (
    <View
      style={[
        localStyles.tapeShell,
        side === 'left' ? localStyles.tapeLeft : localStyles.tapeRight,
        compact ? localStyles.tapeShellCompact : null,
      ]}
    >
      <View style={localStyles.tapeHeader}>
        <Text style={localStyles.tapeLabel}>{label}</Text>
        <Text style={localStyles.tapeUnit}>{unit}</Text>
      </View>
      <View style={localStyles.tapeWindow}>
        {tickValues.map((tickValue, index) => (
          <View key={`${label}-${tickValue}-${index}`} style={localStyles.tapeTickRow}>
            <View style={[localStyles.tapeTick, index === 2 ? localStyles.tapeTickActive : null]} />
            <Text style={[localStyles.tapeTickText, index === 2 ? localStyles.tapeTickTextActive : null]}>
              {safeValue == null ? '--' : formatter(tickValue)}
            </Text>
          </View>
        ))}
        <View style={localStyles.tapeCurrentValue}>
          <Text style={localStyles.tapeCurrentValueText}>
            {safeValue == null ? '--' : formatter(safeValue)}
          </Text>
        </View>
        {bugValue != null && Number.isFinite(bugValue) ? (
          <View style={localStyles.tapeBug}>
            <View style={localStyles.tapeBugMarker} />
            <Text style={localStyles.tapeBugText}>
              {bugLabel || 'BUG'} {formatter(bugValue)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

type DirectionIndicatorProps = {
  compact: boolean;
  modeLabel: string;
  directionDeg: number | null;
};

const FlightDeckDirectionIndicator = memo(function FlightDeckDirectionIndicator({
  compact,
  modeLabel,
  directionDeg,
}: DirectionIndicatorProps) {
  const normalized = directionDeg != null && Number.isFinite(directionDeg) ? normalizeHeading(directionDeg) : null;
  const compassTicks = useMemo(
    () =>
      new Array(36).fill(null).map((_, index) => {
        const angleDeg = index * 10;
        const radians = (angleDeg - 90) * (Math.PI / 180);
        const outerRadius = compact ? 54 : 62;
        const innerRadius = index % 3 === 0 ? outerRadius - 13 : outerRadius - 8;
        const labelRadius = outerRadius - 23;
        const label =
          angleDeg === 0
            ? 'N'
            : angleDeg === 90
              ? 'E'
              : angleDeg === 180
                ? 'S'
                : angleDeg === 270
                  ? 'W'
                  : index % 3 === 0
                    ? `${angleDeg / 10}`
                    : null;
        return {
          key: `compass-${angleDeg}`,
          major: index % 3 === 0,
          tickX: Math.cos(radians) * innerRadius,
          tickY: Math.sin(radians) * innerRadius,
          labelX: Math.cos(radians) * labelRadius,
          labelY: Math.sin(radians) * labelRadius,
          angleDeg,
          label,
        };
      }),
    [compact],
  );

  return (
    <View style={[localStyles.directionShell, compact ? localStyles.directionShellCompact : null]}>
      <View style={localStyles.directionTopRow}>
        <Text style={localStyles.directionMode}>{modeLabel}</Text>
        <Text style={localStyles.directionSmallValue}>{formatHeading(normalized)}°</Text>
      </View>
      <View style={[localStyles.directionDial, compact ? localStyles.directionDialCompact : null]}>
        <View style={localStyles.directionDialRing} />
        {compassTicks.map((tick) => (
          <View
            key={tick.key}
            style={[
              localStyles.directionDialTick,
              tick.major ? localStyles.directionDialTickMajor : null,
              {
                left: '50%',
                top: '50%',
                transform: [
                  { translateX: tick.tickX - (tick.major ? 7 : 5) },
                  { translateY: tick.tickY },
                  { rotate: `${tick.angleDeg}deg` },
                ],
              },
            ]}
          />
        ))}
        {compassTicks.map((tick) =>
          tick.label ? (
            <Text
              key={`${tick.key}-label`}
              style={[
                localStyles.directionDialLabel,
                tick.major ? localStyles.directionDialLabelMajor : null,
                {
                  left: '50%',
                  top: '50%',
                  transform: [{ translateX: tick.labelX - 7 }, { translateY: tick.labelY - 7 }],
                },
              ]}
            >
              {tick.label}
            </Text>
          ) : null
        )}
        <View style={localStyles.directionDialPointer} />
        <View style={localStyles.directionCenterCore}>
          <Text style={localStyles.directionCenterValue}>{formatHeading(normalized)}</Text>
          <Text style={localStyles.directionCenterLabel}>COURSE</Text>
        </View>
      </View>
    </View>
  );
});

type TerrainBandProps = {
  compact: boolean;
  terrainProfile?: FlightDeckVisionInstrumentsProps['terrainProfile'];
  terrainRisk?: string | null;
  terrainClearanceFt?: number | null;
  obstacleClearanceFt?: number | null;
  bottomOffset?: number;
};

const FlightDeckTerrainProfileBand = memo(function FlightDeckTerrainProfileBand({
  compact,
  terrainProfile,
  terrainRisk,
  terrainClearanceFt,
  obstacleClearanceFt,
  bottomOffset = 18,
}: TerrainBandProps) {
  const samples = terrainProfile?.samples ?? [];
  const maxElevationFt = Math.max(
    terrainProfile?.maxElevationFt ?? 0,
    ...samples.map((sample) => sample.elevationFt ?? 0),
    1,
  );
  const riskStyle =
    terrainRisk === 'warning'
      ? localStyles.terrainBandWarning
      : terrainRisk === 'caution'
        ? localStyles.terrainBandCaution
        : localStyles.terrainBandNominal;

  return (
    <View
      style={[
        localStyles.terrainBandShell,
        compact ? localStyles.terrainBandShellCompact : null,
        { bottom: bottomOffset },
      ]}
    >
      <View style={localStyles.terrainBandHeader}>
        <Text style={localStyles.terrainBandTitle}>Terrain Profile</Text>
        <Text style={localStyles.terrainBandMeta}>
          {terrainClearanceFt != null ? `${Math.round(terrainClearanceFt)} ft clr` : '--'}
          {obstacleClearanceFt != null ? `  |  Obs ${Math.round(obstacleClearanceFt)} ft` : ''}
        </Text>
      </View>
      <View style={localStyles.terrainBandChart}>
        {(samples.length ? samples : new Array(18).fill(null)).map((sample, index, list) => {
          const elevationFt = sample?.elevationFt ?? 0;
          const heightPct = Math.max(10, Math.round((elevationFt / maxElevationFt) * 100));
          const farIndex = index / Math.max(1, list.length - 1);
          return (
            <View
              key={`terrain-band-${index}`}
              style={[
                localStyles.terrainBandColumn,
                riskStyle,
                {
                  height: `${heightPct}%`,
                  opacity: 0.5 + farIndex * 0.42,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
});

export const FlightDeckVisionInstruments = memo(function FlightDeckVisionInstruments({
  compact = false,
  speedKts,
  altitudeFt,
  targetAltitudeFt,
  directionModeLabel,
  directionDeg,
  terrainProfile,
  terrainRisk,
  terrainClearanceFt,
  obstacleClearanceFt,
  terrainBandBottomOffset = 18,
}: FlightDeckVisionInstrumentsProps) {
  return (
    <>
      <FlightDeckDirectionIndicator
        compact={compact}
        modeLabel={directionModeLabel}
        directionDeg={directionDeg}
      />
      <FlightDeckDataTape
        side="left"
        compact={compact}
        label="Speed"
        unit="KT"
        value={speedKts}
        step={10}
        formatter={formatSpeedValue}
      />
      <FlightDeckDataTape
        side="right"
        compact={compact}
        label="Altitude"
        unit="FT"
        value={altitudeFt}
        step={200}
        formatter={formatAltitudeValue}
        bugValue={targetAltitudeFt}
        bugLabel="BUG"
      />
      <FlightDeckTerrainProfileBand
        compact={compact}
        terrainProfile={terrainProfile}
        terrainRisk={terrainRisk}
        terrainClearanceFt={terrainClearanceFt}
        obstacleClearanceFt={obstacleClearanceFt}
        bottomOffset={terrainBandBottomOffset}
      />
    </>
  );
});

const localStyles = StyleSheet.create({
  directionShell: {
    position: 'absolute',
    left: '50%',
    bottom: 74,
    width: 164,
    marginLeft: -82,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(7,11,18,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(102,127,156,0.3)',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    alignItems: 'center',
    ...shadow.flightGlass,
  },
  directionShellCompact: {
    width: 138,
    marginLeft: -69,
    bottom: 58,
  },
  directionTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  directionMode: {
    color: colors.flightTextMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  directionSmallValue: {
    color: colors.flightAccent,
    fontSize: 12,
    fontWeight: '700',
  },
  directionDial: {
    width: 126,
    height: 126,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionDialCompact: {
    width: 108,
    height: 108,
  },
  directionDialRing: {
    position: 'absolute',
    inset: 6,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(61,87,117,0.88)',
    backgroundColor: 'rgba(5,9,14,0.8)',
  },
  directionDialTick: {
    position: 'absolute',
    width: 10,
    height: 1.5,
    borderRadius: 999,
    backgroundColor: 'rgba(232,237,244,0.38)',
  },
  directionDialTickMajor: {
    width: 14,
    backgroundColor: 'rgba(232,237,244,0.72)',
  },
  directionDialLabel: {
    position: 'absolute',
    color: colors.flightTextMuted,
    fontSize: 8,
    fontWeight: '600',
  },
  directionDialLabelMajor: {
    color: colors.flightText,
    fontWeight: '700',
  },
  directionDialPointer: {
    position: 'absolute',
    alignSelf: 'center',
    top: 2,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.flightAccent,
  },
  directionCenterCore: {
    width: 72,
    height: 48,
    borderRadius: 18,
    backgroundColor: 'rgba(9,13,19,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(102,127,156,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionCenterValue: {
    color: colors.flightText,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  directionCenterLabel: {
    marginTop: 2,
    color: colors.flightTextMuted,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tapeShell: {
    position: 'absolute',
    top: 110,
    bottom: 136,
    width: 82,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(7,11,18,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(102,127,156,0.3)',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 10,
  },
  tapeShellCompact: {
    top: 116,
    bottom: 114,
    width: 70,
  },
  tapeLeft: {
    left: spacing.sm,
  },
  tapeRight: {
    right: spacing.sm,
  },
  tapeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tapeLabel: {
    color: colors.flightTextMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  tapeUnit: {
    color: colors.flightAccent,
    fontSize: 9,
    fontWeight: '700',
  },
  tapeWindow: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: 'rgba(4,7,12,0.78)',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    paddingVertical: 10,
  },
  tapeTickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
    paddingHorizontal: 6,
  },
  tapeTick: {
    width: 14,
    height: 1,
    backgroundColor: 'rgba(232,237,244,0.4)',
  },
  tapeTickActive: {
    width: 18,
    height: 2,
    backgroundColor: colors.flightAccent,
  },
  tapeTickText: {
    color: colors.flightTextMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  tapeTickTextActive: {
    color: colors.flightText,
    fontWeight: '700',
  },
  tapeCurrentValue: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: '50%',
    marginTop: -18,
    borderRadius: radius.md,
    backgroundColor: 'rgba(12,18,26,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(200,146,42,0.58)',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tapeCurrentValueText: {
    color: colors.flightText,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  tapeBug: {
    position: 'absolute',
    right: -2,
    top: 8,
    alignItems: 'flex-end',
  },
  tapeBugMarker: {
    width: 18,
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.flightAccent,
  },
  tapeBugText: {
    marginTop: 3,
    color: colors.flightAccent,
    fontSize: 9,
    fontWeight: '700',
  },
  terrainBandShell: {
    position: 'absolute',
    left: 90,
    right: 90,
    bottom: 18,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(7,11,18,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(102,127,156,0.3)',
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    paddingBottom: 10,
  },
  terrainBandShellCompact: {
    left: 78,
    right: 78,
    bottom: 14,
  },
  terrainBandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  terrainBandTitle: {
    color: colors.flightTextMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  terrainBandMeta: {
    color: colors.flightText,
    fontSize: 10,
    fontWeight: '600',
  },
  terrainBandChart: {
    height: 30,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  terrainBandColumn: {
    flex: 1,
    minHeight: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: colors.flightNominal,
  },
  terrainBandNominal: {
    backgroundColor: '#3FA36A',
  },
  terrainBandCaution: {
    backgroundColor: colors.flightCaution,
  },
  terrainBandWarning: {
    backgroundColor: colors.flightWarning,
  },
});
