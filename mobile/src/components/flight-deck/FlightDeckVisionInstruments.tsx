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
  const headingTicks = useMemo(() => {
    if (normalized == null) return ['---', '---', '---', '---', '---'];
    return [-20, -10, 0, 10, 20].map((offset) =>
      formatHeading(normalized + offset),
    );
  }, [normalized]);

  return (
    <View style={[localStyles.directionShell, compact ? localStyles.directionShellCompact : null]}>
      <Text style={localStyles.directionMode}>{modeLabel}</Text>
      <Text style={localStyles.directionValue}>{formatHeading(normalized)}</Text>
      <View style={localStyles.directionRibbon}>
        {headingTicks.map((tick, index) => (
          <View key={`${tick}-${index}`} style={localStyles.directionTickWrap}>
            <View style={[localStyles.directionTick, index === 2 ? localStyles.directionTickActive : null]} />
            <Text style={[localStyles.directionTickText, index === 2 ? localStyles.directionTickTextActive : null]}>
              {tick}
            </Text>
          </View>
        ))}
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
    top: spacing.md,
    left: '22%',
    right: '22%',
    borderRadius: radius.lg,
    backgroundColor: 'rgba(9,13,19,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(102,127,156,0.34)',
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    paddingBottom: 10,
    alignItems: 'center',
    ...shadow.flightGlass,
  },
  directionShellCompact: {
    left: '18%',
    right: '18%',
    top: 58,
  },
  directionMode: {
    color: colors.flightTextMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  directionValue: {
    color: colors.flightText,
    fontSize: 28,
    fontWeight: '700',
    marginTop: 2,
  },
  directionRibbon: {
    marginTop: 8,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  directionTickWrap: {
    alignItems: 'center',
    flex: 1,
  },
  directionTick: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(232,237,244,0.38)',
    marginBottom: 4,
  },
  directionTickActive: {
    height: 14,
    backgroundColor: colors.flightAccent,
  },
  directionTickText: {
    color: colors.flightTextMuted,
    fontSize: 9,
    fontWeight: '600',
  },
  directionTickTextActive: {
    color: colors.flightText,
    fontWeight: '700',
  },
  tapeShell: {
    position: 'absolute',
    top: 110,
    bottom: 126,
    width: 76,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(9,13,19,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(102,127,156,0.26)',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 10,
  },
  tapeShellCompact: {
    top: 116,
    bottom: 112,
    width: 68,
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
    marginBottom: 8,
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
    justifyContent: 'center',
    position: 'relative',
  },
  tapeTickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 6,
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
    left: 18,
    right: 0,
    top: '50%',
    marginTop: -18,
    borderRadius: radius.md,
    backgroundColor: 'rgba(12,18,26,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(200,146,42,0.4)',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tapeCurrentValueText: {
    color: colors.flightText,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'right',
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
    backgroundColor: 'rgba(9,13,19,0.7)',
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
    height: 44,
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
