import { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../../styles/theme';

type InstrumentTone = 'default' | 'active' | 'limited' | 'warning';

export type FlightDeckInstrumentField = {
  label: string;
  value: string;
  tone?: InstrumentTone;
};

type FlightDeckInstrumentMeta = {
  code: string;
  label: string;
  tone?: InstrumentTone;
};

type FlightDeckInstrumentStripProps = {
  style?: ViewStyle | ViewStyle[];
  primaryFields: FlightDeckInstrumentField[];
  routeFields?: FlightDeckInstrumentField[] | null;
  sourceMeta: FlightDeckInstrumentMeta;
  modeMeta: FlightDeckInstrumentMeta;
  compact?: boolean;
  onPress?: () => void;
};

function getToneStyles(tone?: InstrumentTone) {
  switch (tone) {
    case 'active':
      return {
        chip: localStyles.metaChipActive,
        chipText: localStyles.metaChipTextActive,
        value: localStyles.metricValueActive,
      };
    case 'limited':
      return {
        chip: localStyles.metaChipLimited,
        chipText: localStyles.metaChipTextLimited,
        value: localStyles.metricValueLimited,
      };
    case 'warning':
      return {
        chip: localStyles.metaChipWarning,
        chipText: localStyles.metaChipTextWarning,
        value: localStyles.metricValueWarning,
      };
    default:
      return {
        chip: null,
        chipText: null,
        value: null,
      };
  }
}

function FlightDeckInstrumentStripComponent({
  style,
  primaryFields,
  routeFields,
  sourceMeta,
  modeMeta,
  compact = false,
  onPress,
}: FlightDeckInstrumentStripProps) {
  const sourceTone = getToneStyles(sourceMeta.tone);
  const modeTone = getToneStyles(modeMeta.tone);

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={[localStyles.container, compact ? localStyles.containerCompact : null, style]}
      onPress={onPress}
    >
      <View style={[localStyles.metaRow, compact ? localStyles.metaRowCompact : null]}>
        <View style={localStyles.metaChips}>
          <View style={[localStyles.metaChip, compact ? localStyles.metaChipCompact : null, sourceTone.chip]}>
            <Text style={[localStyles.metaChipText, sourceTone.chipText]} numberOfLines={1}>
              {sourceMeta.code}
            </Text>
          </View>
          <View style={[localStyles.metaChip, compact ? localStyles.metaChipCompact : null, modeTone.chip]}>
            <Text style={[localStyles.metaChipText, modeTone.chipText]} numberOfLines={1}>
              {modeMeta.label}
            </Text>
          </View>
        </View>
        {!compact ? (
          <Text style={localStyles.detailHint} numberOfLines={1}>
            Tap for details
          </Text>
        ) : null}
      </View>

      <View style={[localStyles.primaryRow, compact ? localStyles.primaryRowCompact : null]}>
        {primaryFields.map((field, index) => {
          const tone = getToneStyles(field.tone);
          return (
            <View
              key={`flight-deck-primary-${field.label}-${index}`}
              style={[
                localStyles.metricCell,
                compact ? localStyles.metricCellCompact : null,
                index > 0 ? localStyles.metricCellSeparated : null,
              ]}
            >
              <Text style={[localStyles.metricLabel, compact ? localStyles.metricLabelCompact : null]}>{field.label}</Text>
              <Text
                style={[localStyles.metricValue, compact ? localStyles.metricValueCompact : null, tone.value]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {field.value}
              </Text>
            </View>
          );
        })}
      </View>

      {!compact && routeFields?.length ? (
        <View style={localStyles.routeRow}>
          {routeFields.map((field, index) => {
            const tone = getToneStyles(field.tone);
            return (
              <View
                key={`flight-deck-route-${field.label}-${index}`}
                style={[
                  localStyles.routeMetricCell,
                  index > 0 ? localStyles.routeMetricCellSeparated : null,
                ]}
              >
                <Text style={localStyles.routeMetricLabel}>{field.label}</Text>
                <Text
                  style={[localStyles.routeMetricValue, tone.value]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {field.value}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const localStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    borderRadius: 14,
    backgroundColor: 'rgba(8, 12, 18, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(74, 94, 118, 0.46)',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    ...shadow.flightGlass,
  },
  containerCompact: {
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingTop: 5,
    paddingBottom: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metaRowCompact: {
    marginBottom: 4,
  },
  metaChips: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaChip: {
    minHeight: 22,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.flightSurfaceElevated,
    borderWidth: 1,
    borderColor: colors.flightBorder,
    marginRight: spacing.xs,
  },
  metaChipCompact: {
    minHeight: 18,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  metaChipActive: {
    backgroundColor: 'rgba(74,159,212,0.18)',
    borderColor: 'rgba(74,159,212,0.42)',
  },
  metaChipLimited: {
    backgroundColor: 'rgba(200,146,42,0.14)',
    borderColor: 'rgba(200,146,42,0.38)',
  },
  metaChipWarning: {
    backgroundColor: 'rgba(232,69,60,0.14)',
    borderColor: 'rgba(232,69,60,0.4)',
  },
  metaChipText: {
    color: colors.flightTextMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  metaChipTextActive: {
    color: colors.flightAdvisory,
  },
  metaChipTextLimited: {
    color: colors.flightAccent,
  },
  metaChipTextWarning: {
    color: colors.flightWarning,
  },
  detailHint: {
    color: colors.flightTextMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 0,
  },
  primaryRowCompact: {
    gap: 0,
  },
  metricCell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 23, 33, 0.92)',
  },
  metricCellCompact: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metricCellSeparated: {
    marginLeft: 6,
  },
  metricLabel: {
    color: colors.flightTextMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metricLabelCompact: {
    fontSize: 8,
    letterSpacing: 0.8,
  },
  metricValue: {
    color: colors.flightText,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  metricValueCompact: {
    fontSize: 14,
    marginTop: 2,
  },
  metricValueActive: {
    color: colors.flightAdvisory,
  },
  metricValueLimited: {
    color: colors.flightAccent,
  },
  metricValueWarning: {
    color: colors.flightWarning,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(61, 90, 120, 0.42)',
  },
  routeRowCompact: {
    marginTop: 8,
    paddingTop: 8,
  },
  routeMetricCell: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  routeMetricCellSeparated: {
    marginLeft: 4,
  },
  routeMetricLabel: {
    color: colors.flightTextMuted,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  routeMetricValue: {
    color: colors.flightText,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
  },
});

export const FlightDeckInstrumentStrip = memo(FlightDeckInstrumentStripComponent);
