import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

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
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { marginTop: 4, color: '#6b7280', marginBottom: 12 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 8 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10, marginTop: 6 },
  resultLabel: { fontSize: 14, color: '#6b7280' },
  resultValue: { fontSize: 24, fontWeight: '700', color: '#111827', marginTop: 6 },
  resultHint: { fontSize: 12, color: '#6b7280', marginTop: 6 },
});
