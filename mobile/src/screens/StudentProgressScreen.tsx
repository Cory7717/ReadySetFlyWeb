import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import FormDateTimeField from '../components/FormDateTimeField';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

export default function StudentProgressScreen({ navigation }: any) {
  const [hours, setHours] = useState('0');
  const [solos, setSolos] = useState('0');
  const [xcHours, setXcHours] = useState('0');
  const [writtenPassed, setWrittenPassed] = useState(false);
  const [checkrideDate, setCheckrideDate] = useState('');

  const totalHours = parseFloat(hours) || 0;
  const progressLabel = useMemo(() => {
    if (totalHours >= 40 && writtenPassed) return 'Checkride track';
    if (totalHours >= 20) return 'Mid-training';
    if (totalHours >= 5) return 'Building momentum';
    return 'Just getting started';
  }, [totalHours, writtenPassed]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>PROGRESS TRACKER</Text>
        <Text style={styles.heroTitle}>Keep the next milestone visible.</Text>
        <Text style={styles.heroSubtitle}>
          Log your training momentum and use the tracker as a quick lesson-planning snapshot.
        </Text>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Hours</Text>
          <Text style={styles.metricValue}>{hours}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Solos</Text>
          <Text style={styles.metricValue}>{solos}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Status</Text>
          <Text style={styles.metricSmall}>{progressLabel}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Training Snapshot</Text>
        <Text style={styles.label}>Total hours logged</Text>
        <TextInput style={styles.input} value={hours} onChangeText={setHours} keyboardType="numeric" />
        <Text style={styles.label}>Solos completed</Text>
        <TextInput style={styles.input} value={solos} onChangeText={setSolos} keyboardType="numeric" />
        <Text style={styles.label}>Cross-country hours</Text>
        <TextInput style={styles.input} value={xcHours} onChangeText={setXcHours} keyboardType="numeric" />
        <FormDateTimeField
          label="Checkride date"
          value={checkrideDate}
          onChangeText={setCheckrideDate}
          placeholder="Select checkride date"
          mode="date"
          optional
          style={styles.fieldWrapper}
        />
        <TouchableOpacity
          style={[styles.toggleButton, writtenPassed && styles.toggleButtonActive]}
          onPress={() => setWrittenPassed(!writtenPassed)}
          activeOpacity={0.92}
        >
          <Text style={[styles.toggleButtonText, writtenPassed && styles.toggleButtonTextActive]}>
            Written exam {writtenPassed ? 'passed' : 'not passed'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Next Step</Text>
        <Text style={styles.nextText}>Keep progressing with a local flight school or instructor.</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            navigation.navigate('Marketplace', { screen: 'MarketplaceCategory', params: { category: 'Flight Schools' } })
          }
          activeOpacity={0.92}
        >
          <Text style={styles.primaryButtonText}>Find Flight Schools</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.sm, paddingBottom: 120 },
  hero: { backgroundColor: colors.cockpit, borderRadius: radius.xl, padding: spacing.lg, ...shadow.floating },
  heroEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: '#93c5fd' },
  heroTitle: { ...typography.display, color: '#fff', marginTop: spacing.sm },
  heroSubtitle: { ...typography.body, color: '#dbe4f0', marginTop: spacing.sm },
  metricsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.card,
  },
  metricLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  metricValue: { ...typography.metric, marginTop: spacing.xs },
  metricSmall: { ...typography.muted, marginTop: spacing.xs, fontWeight: '700', color: colors.text },
  card: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  sectionTitle: { ...typography.h2 },
  label: { fontSize: 12, fontWeight: '700', color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md },
  fieldWrapper: { marginTop: spacing.md },
  toggleButton: { marginTop: spacing.md, backgroundColor: colors.surfaceMuted, padding: spacing.md, borderRadius: radius.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  toggleButtonActive: { backgroundColor: colors.accentSoft, borderColor: '#86efac' },
  toggleButtonText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  toggleButtonTextActive: { color: '#166534' },
  nextText: { ...typography.muted, marginTop: spacing.sm },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center', marginTop: spacing.md, ...shadow.card },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
});
