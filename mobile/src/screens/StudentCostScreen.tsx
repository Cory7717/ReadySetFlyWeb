import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

export default function StudentCostScreen({ navigation }: any) {
  const [aircraftRate, setAircraftRate] = useState('165');
  const [instructorRate, setInstructorRate] = useState('65');
  const [hours, setHours] = useState('60');
  const [lessonsPerWeek, setLessonsPerWeek] = useState('2');

  const total = useMemo(() => {
    const rate = parseFloat(aircraftRate) || 0;
    const instructor = parseFloat(instructorRate) || 0;
    const hrs = parseFloat(hours) || 0;
    return (rate + instructor) * hrs;
  }, [aircraftRate, instructorRate, hours]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>TRAINING COST</Text>
        <Text style={styles.heroTitle}>Estimate the budget before training starts drifting.</Text>
        <Text style={styles.heroSubtitle}>
          Build a first-pass training budget using your local aircraft rate, instructor rate, and target hours.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Training Inputs</Text>
        <Text style={styles.label}>Aircraft hourly rate (wet)</Text>
        <TextInput style={styles.input} value={aircraftRate} onChangeText={setAircraftRate} keyboardType="numeric" />
        <Text style={styles.label}>Instructor rate</Text>
        <TextInput style={styles.input} value={instructorRate} onChangeText={setInstructorRate} keyboardType="numeric" />
        <Text style={styles.label}>Expected total hours</Text>
        <TextInput style={styles.input} value={hours} onChangeText={setHours} keyboardType="numeric" />
        <Text style={styles.label}>Lessons per week</Text>
        <TextInput style={styles.input} value={lessonsPerWeek} onChangeText={setLessonsPerWeek} keyboardType="numeric" />
      </View>

      <View style={styles.card}>
        <Text style={styles.resultLabel}>Estimated Total Cost</Text>
        <Text style={styles.resultValue}>${total.toFixed(0)}</Text>
        <Text style={styles.resultHint}>
          Based on {hours} hours at ${aircraftRate}/hr plus ${instructorRate}/hr.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            navigation.navigate('Marketplace', { screen: 'MarketplaceCategory', params: { category: 'Flight Schools' } })
          }
          activeOpacity={0.92}
        >
          <Text style={styles.primaryButtonText}>Compare Flight Schools</Text>
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
  resultLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  resultValue: { ...typography.display, marginTop: spacing.xs },
  resultHint: { ...typography.muted, marginTop: spacing.sm },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center', marginTop: spacing.md, ...shadow.card },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
});
