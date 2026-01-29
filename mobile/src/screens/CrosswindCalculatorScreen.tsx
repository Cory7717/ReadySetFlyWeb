import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

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
      <View style={styles.header}>
        <Ionicons name="navigate-outline" size={28} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Crosswind Calculator</Text>
          <Text style={styles.subtitle}>Estimate crosswind and headwind components.</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Inputs</Text>
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Runway heading</Text>
            <TextInput style={styles.input} value={runwayHeading} onChangeText={setRunwayHeading} keyboardType="numeric" />
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Wind direction</Text>
            <TextInput style={styles.input} value={windDirection} onChangeText={setWindDirection} keyboardType="numeric" />
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Wind speed (kt)</Text>
            <TextInput style={styles.input} value={windSpeed} onChangeText={setWindSpeed} keyboardType="numeric" />
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Gust (kt)</Text>
            <TextInput style={styles.input} value={windGust} onChangeText={setWindGust} keyboardType="numeric" />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Results</Text>
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Crosswind</Text>
          <Text style={styles.resultValue}>{Math.abs(results.crosswind).toFixed(1)} kt {results.direction}</Text>
        </View>
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Head/Tailwind</Text>
          <Text style={styles.resultValue}>{Math.abs(results.headwind).toFixed(1)} kt {results.headwind >= 0 ? 'headwind' : 'tailwind'}</Text>
        </View>
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Max crosswind (gust)</Text>
          <Text style={styles.resultValue}>{results.maxCrosswind.toFixed(1)} kt</Text>
        </View>
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Max headwind (gust)</Text>
          <Text style={styles.resultValue}>{Math.abs(results.maxHeadwind).toFixed(1)} kt</Text>
        </View>
        <Text style={styles.helperText}>Planning only. Verify with official sources and aircraft limitations.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginBottom: spacing.md },
  title: { ...typography.h2 },
  subtitle: { color: colors.textMuted, marginTop: spacing.xs },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridItem: { width: '48%' },
  label: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  resultLabel: { fontSize: 13, color: colors.textMuted },
  resultValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  helperText: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
});
