import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

export default function CrosswindCalculatorScreen() {
  const [runwayHeading, setRunwayHeading] = useState('180');
  const [windDirection, setWindDirection] = useState('210');
  const [windSpeed, setWindSpeed] = useState('12');
  const [windGust, setWindGust] = useState('');

  const results = useMemo(() => {
    const heading = Number(runwayHeading) || 0;
    const windDir = Number(windDirection) || 0;
    const windKt = Number(windSpeed) || 0;
    const gustKt = Number(windGust) || 0;
    const angle = ((windDir - heading + 540) % 360) - 180;
    const angleRad = (Math.PI / 180) * angle;
    const crosswind = windKt * Math.sin(angleRad);
    const headwind = windKt * Math.cos(angleRad);
    const maxCrosswind = gustKt ? Math.abs(gustKt * Math.sin(angleRad)) : Math.abs(crosswind);
    const maxHeadwind = gustKt ? gustKt * Math.cos(angleRad) : headwind;
    const direction = crosswind > 0 ? 'from right' : crosswind < 0 ? 'from left' : 'calm';

    return { crosswind, headwind, maxCrosswind, maxHeadwind, direction };
  }, [runwayHeading, windDirection, windSpeed, windGust]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="navigate-outline" size={34} color="#93c5fd" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>RUNWAY TOOL</Text>
            <Text style={styles.heroTitle}>Estimate crosswind before you commit to the runway.</Text>
            <Text style={styles.heroSubtitle}>
              Compare runway heading to wind direction, speed, and gusts to build a quick planning picture of the crosswind and headwind components.
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile label="Crosswind" value={`${Math.abs(results.crosswind).toFixed(1)} kt`} />
          <SummaryTile label="Head/Tail" value={`${Math.abs(results.headwind).toFixed(1)} kt`} />
          <SummaryTile label="Direction" value={results.direction} />
        </View>
      </View>

      <SectionCard
        title="Inputs"
        subtitle="Use planned runway heading and current wind data to estimate the components."
      >
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.inputLabel}>Runway heading</Text>
            <TextInput
              style={styles.input}
              value={runwayHeading}
              onChangeText={setRunwayHeading}
              keyboardType="numeric"
              placeholder="180"
              placeholderTextColor={colors.textSoft}
            />
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.inputLabel}>Wind direction</Text>
            <TextInput
              style={styles.input}
              value={windDirection}
              onChangeText={setWindDirection}
              keyboardType="numeric"
              placeholder="210"
              placeholderTextColor={colors.textSoft}
            />
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.inputLabel}>Wind speed (kt)</Text>
            <TextInput
              style={styles.input}
              value={windSpeed}
              onChangeText={setWindSpeed}
              keyboardType="numeric"
              placeholder="12"
              placeholderTextColor={colors.textSoft}
            />
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.inputLabel}>Gust (kt)</Text>
            <TextInput
              style={styles.input}
              value={windGust}
              onChangeText={setWindGust}
              keyboardType="numeric"
              placeholder="Optional"
              placeholderTextColor={colors.textSoft}
            />
          </View>
        </View>
      </SectionCard>

      <SectionCard
        title="Results"
        subtitle="Use these values as a planning reference and compare them to aircraft and personal limits."
      >
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Crosswind</Text>
          <Text style={styles.resultValue}>
            {Math.abs(results.crosswind).toFixed(1)} kt {results.direction}
          </Text>
        </View>
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Head/Tailwind</Text>
          <Text style={styles.resultValue}>
            {Math.abs(results.headwind).toFixed(1)} kt {results.headwind >= 0 ? 'headwind' : 'tailwind'}
          </Text>
        </View>
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Max crosswind (gust)</Text>
          <Text style={styles.resultValue}>{results.maxCrosswind.toFixed(1)} kt</Text>
        </View>
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Max headwind (gust)</Text>
          <Text style={styles.resultValue}>{Math.abs(results.maxHeadwind).toFixed(1)} kt</Text>
        </View>
        <Text style={styles.helperText}>
          Planning only. Verify with official sources and aircraft limitations.
        </Text>
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.sm, paddingBottom: 120 },
  heroPanel: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.cockpit,
    ...shadow.floating,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  heroIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#93c5fd',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#fff',
    marginTop: 10,
    maxWidth: 320,
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
    maxWidth: 340,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  summaryTile: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#bfdbfe',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginTop: 6,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  sectionTitle: {
    ...typography.h2,
  },
  sectionSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
  sectionContent: {
    marginTop: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridItem: {
    width: '48%',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
  },
  resultCard: {
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.textSoft,
    textTransform: 'uppercase',
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
  },
  helperText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
