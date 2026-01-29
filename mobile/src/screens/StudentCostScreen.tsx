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
      <Text style={styles.title}>Training Cost Estimator</Text>
      <Text style={styles.subtitle}>Estimate your total cost for a private pilot certificate.</Text>

      <View style={styles.card}>
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
          Based on {hours} hours at ${aircraftRate}/hr + ${instructorRate}/hr.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            navigation.navigate('Marketplace', { screen: 'MarketplaceCategory', params: { category: 'Flight Schools' } })
          }
        >
          <Text style={styles.primaryButtonText}>Compare Flight Schools</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  title: { ...typography.h2 },
  subtitle: { marginTop: spacing.xs, color: colors.textMuted, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  label: { fontSize: 12, fontWeight: '600', color: colors.text, marginTop: spacing.xs },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.xs },
  resultLabel: { fontSize: 14, color: colors.textMuted },
  resultValue: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  resultHint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', marginTop: spacing.sm },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
});
