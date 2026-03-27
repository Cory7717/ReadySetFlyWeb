import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

export default function DensityAltitudeScreen() {
  const [fieldElevation, setFieldElevation] = useState('500');
  const [altimeterSetting, setAltimeterSetting] = useState('29.92');
  const [oatValue, setOatValue] = useState('20');
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');

  const results = useMemo(() => {
    const elevation = Number(fieldElevation) || 0;
    const altimeter = Number(altimeterSetting) || 29.92;
    const oatInput = Number(oatValue) || 0;
    const oat = tempUnit === 'F' ? (oatInput - 32) * (5 / 9) : oatInput;
    const pressureAltitude = Math.round(elevation + (29.92 - altimeter) * 1000);
    const isaTemp = 15 - 2 * (pressureAltitude / 1000);
    const densityAltitude = Math.round(pressureAltitude + 120 * (oat - isaTemp));
    return { pressureAltitude, densityAltitude };
  }, [fieldElevation, altimeterSetting, oatValue, tempUnit]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="speedometer-outline" size={34} color="#93c5fd" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>PERFORMANCE TOOL</Text>
            <Text style={styles.heroTitle}>Estimate density altitude before you launch.</Text>
            <Text style={styles.heroSubtitle}>
              Use field elevation, altimeter, and outside air temperature to get a fast planning estimate for pressure altitude and density altitude.
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile label="Pressure alt" value={`${results.pressureAltitude.toLocaleString()} ft`} />
          <SummaryTile label="Density alt" value={`${results.densityAltitude.toLocaleString()} ft`} />
          <SummaryTile label="Temp unit" value={tempUnit} />
        </View>
      </View>

      <SectionCard
        title="Inputs"
        subtitle="Use current field conditions to build a planning estimate."
      >
        <Text style={styles.inputLabel}>Field elevation (ft)</Text>
        <TextInput
          style={styles.input}
          value={fieldElevation}
          onChangeText={setFieldElevation}
          keyboardType="numeric"
          placeholder="500"
          placeholderTextColor={colors.textSoft}
        />

        <Text style={styles.inputLabel}>Altimeter (inHg)</Text>
        <TextInput
          style={styles.input}
          value={altimeterSetting}
          onChangeText={setAltimeterSetting}
          keyboardType="numeric"
          placeholder="29.92"
          placeholderTextColor={colors.textSoft}
        />

        <Text style={styles.inputLabel}>Outside air temperature ({tempUnit === 'F' ? 'deg F' : 'deg C'})</Text>
        <View style={styles.unitRow}>
          <TextInput
            style={[styles.input, styles.unitInput]}
            value={oatValue}
            onChangeText={setOatValue}
            keyboardType="numeric"
            placeholder="20"
            placeholderTextColor={colors.textSoft}
          />
          <View style={styles.unitToggle}>
            <TouchableOpacity
              style={[styles.unitButton, tempUnit === 'C' && styles.unitButtonActive]}
              onPress={() => setTempUnit('C')}
              activeOpacity={0.92}
            >
              <Text style={[styles.unitButtonText, tempUnit === 'C' && styles.unitButtonTextActive]}>C</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.unitButton, tempUnit === 'F' && styles.unitButtonActive]}
              onPress={() => setTempUnit('F')}
              activeOpacity={0.92}
            >
              <Text style={[styles.unitButtonText, tempUnit === 'F' && styles.unitButtonTextActive]}>F</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SectionCard>

      <SectionCard
        title="Results"
        subtitle="These are planning estimates only and should be cross-checked against approved aircraft performance data."
      >
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Pressure altitude</Text>
          <Text style={styles.resultValue}>{results.pressureAltitude.toLocaleString()} ft</Text>
        </View>
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Density altitude</Text>
          <Text style={styles.resultValue}>{results.densityAltitude.toLocaleString()} ft</Text>
        </View>
        <Text style={styles.helperText}>
          Planning only. Always confirm with POH/AFM performance data.
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
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
    marginTop: spacing.sm,
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
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  unitInput: {
    flex: 1,
  },
  unitToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  unitButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  unitButtonActive: {
    backgroundColor: colors.primary,
  },
  unitButtonText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '800',
  },
  unitButtonTextActive: {
    color: '#fff',
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
    fontSize: 18,
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
