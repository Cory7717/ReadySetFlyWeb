import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
  primaryButton: { backgroundColor: '#1e40af', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
});
