import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

export default function OwnershipCostCalculatorScreen() {
  const [monthlyFixed, setMonthlyFixed] = useState('1200');
  const [hourlyVariable, setHourlyVariable] = useState('110');
  const [hoursPerMonth, setHoursPerMonth] = useState('8');

  const total = useMemo(() => {
    const fixed = parseFloat(monthlyFixed) || 0;
    const variable = parseFloat(hourlyVariable) || 0;
    const hours = parseFloat(hoursPerMonth) || 0;
    return fixed + variable * hours;
  }, [monthlyFixed, hourlyVariable, hoursPerMonth]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Ownership Cost Calculator</Text>
      <Text style={styles.subtitle}>Estimate monthly ownership costs.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Monthly Fixed Costs</Text>
        <TextInput style={styles.input} value={monthlyFixed} onChangeText={setMonthlyFixed} keyboardType="numeric" />
        <Text style={styles.label}>Hourly Variable Costs</Text>
        <TextInput style={styles.input} value={hourlyVariable} onChangeText={setHourlyVariable} keyboardType="numeric" />
        <Text style={styles.label}>Hours per Month</Text>
        <TextInput style={styles.input} value={hoursPerMonth} onChangeText={setHoursPerMonth} keyboardType="numeric" />
      </View>

      <View style={styles.card}>
        <Text style={styles.resultLabel}>Estimated Monthly Total</Text>
        <Text style={styles.resultValue}>${total.toFixed(0)}</Text>
        <Text style={styles.resultHint}>
          Planning estimate only. Verify costs with your mechanic, insurance, and operator.
        </Text>
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
});
