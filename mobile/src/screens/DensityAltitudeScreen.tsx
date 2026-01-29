import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

export default function DensityAltitudeScreen() {
  const [fieldElevation, setFieldElevation] = useState('500');
  const [altimeterSetting, setAltimeterSetting] = useState('29.92');
  const [oatValue, setOatValue] = useState('20');
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');

  const results = useMemo(() => {
    const elevation = Number(fieldElevation) || 0;
    const altimeter = Number(altimeterSetting) || 29.92;
    const oatInput = Number(oatValue) || 0;
    const oat = tempUnit == 'F' ? (oatInput - 32) * (5 / 9) : oatInput;
    const pressureAltitude = Math.round(elevation + (29.92 - altimeter) * 1000);
    const isaTemp = 15 - 2 * (pressureAltitude / 1000);
    const densityAltitude = Math.round(pressureAltitude + 120 * (oat - isaTemp));
    return { pressureAltitude, densityAltitude };
  }, [fieldElevation, altimeterSetting, oatValue, tempUnit]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="speedometer-outline" size={28} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Density Altitude</Text>
          <Text style={styles.subtitle}>Estimate pressure altitude and density altitude.</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Inputs</Text>
        <View style={styles.grid}>
          <View style={styles.gridItemFull}>
            <Text style={styles.label}>Field elevation (ft)</Text>
            <TextInput style={styles.input} value={fieldElevation} onChangeText={setFieldElevation} keyboardType="numeric" />
          </View>
          <View style={styles.gridItemFull}>
            <Text style={styles.label}>Altimeter (inHg)</Text>
            <TextInput style={styles.input} value={altimeterSetting} onChangeText={setAltimeterSetting} keyboardType="numeric" />
          </View>
          <View style={styles.gridItemFull}>
            <Text style={styles.label}>OAT ({tempUnit == 'F' ? 'deg F' : 'deg C'})</Text>
            <View style={styles.unitRow}>
              <TextInput
                style={[styles.input, styles.unitInput]}
                value={oatValue}
                onChangeText={setOatValue}
                keyboardType="numeric"
              />
              <View style={styles.unitToggle}>
                <TouchableOpacity
                  style={[styles.unitButton, tempUnit == 'C' && styles.unitButtonActive]}
                  onPress={() => setTempUnit('C')}
                >
                  <Text style={[styles.unitButtonText, tempUnit == 'C' && styles.unitButtonTextActive]}>C</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.unitButton, tempUnit == 'F' && styles.unitButtonActive]}
                  onPress={() => setTempUnit('F')}
                >
                  <Text style={[styles.unitButtonText, tempUnit == 'F' && styles.unitButtonTextActive]}>F</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Results</Text>
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Pressure altitude</Text>
          <Text style={styles.resultValue}>{results.pressureAltitude.toLocaleString()} ft</Text>
        </View>
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Density altitude</Text>
          <Text style={styles.resultValue}>{results.densityAltitude.toLocaleString()} ft</Text>
        </View>
        <Text style={styles.helperText}>Planning only. Always confirm with POH/AFM performance data.</Text>
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
  grid: { gap: spacing.sm },
  gridItemFull: { width: '100%' },
  label: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unitInput: { flex: 1 },
  unitToggle: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  unitButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, backgroundColor: colors.surface },
  unitButtonActive: { backgroundColor: colors.primary },
  unitButtonText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  unitButtonTextActive: { color: '#fff' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  resultLabel: { fontSize: 13, color: colors.textMuted },
  resultValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  helperText: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
});
