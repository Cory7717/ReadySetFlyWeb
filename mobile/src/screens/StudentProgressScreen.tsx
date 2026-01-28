import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function StudentProgressScreen({ navigation }: any) {
  const [hours, setHours] = useState('0');
  const [solos, setSolos] = useState('0');
  const [xcHours, setXcHours] = useState('0');
  const [writtenPassed, setWrittenPassed] = useState(false);
  const [checkrideDate, setCheckrideDate] = useState('');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Progress Tracker</Text>
      <Text style={styles.subtitle}>Track milestones and stay on top of your training.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Total Hours Logged</Text>
        <TextInput style={styles.input} value={hours} onChangeText={setHours} keyboardType="numeric" />
        <Text style={styles.label}>Solos Completed</Text>
        <TextInput style={styles.input} value={solos} onChangeText={setSolos} keyboardType="numeric" />
        <Text style={styles.label}>Cross-country Hours</Text>
        <TextInput style={styles.input} value={xcHours} onChangeText={setXcHours} keyboardType="numeric" />
        <Text style={styles.label}>Checkride Date (optional)</Text>
        <TextInput style={styles.input} value={checkrideDate} onChangeText={setCheckrideDate} placeholder="YYYY-MM-DD" />
        <TouchableOpacity
          style={[styles.toggleButton, writtenPassed && styles.toggleButtonActive]}
          onPress={() => setWrittenPassed(!writtenPassed)}
        >
          <Text style={styles.toggleButtonText}>
            Written Exam {writtenPassed ? 'Passed' : 'Not passed'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.nextTitle}>Next Step</Text>
        <Text style={styles.nextText}>Keep progressing with a local flight school or instructor.</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            navigation.navigate('Marketplace', { screen: 'MarketplaceCategory', params: { category: 'Flight Schools' } })
          }
        >
          <Text style={styles.primaryButtonText}>Find Flight Schools</Text>
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
  toggleButton: { marginTop: 12, backgroundColor: '#e5e7eb', padding: 10, borderRadius: 10, alignItems: 'center' },
  toggleButtonActive: { backgroundColor: '#bbf7d0' },
  toggleButtonText: { fontSize: 12, fontWeight: '600', color: '#111827' },
  nextTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  nextText: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  primaryButton: { backgroundColor: '#1e40af', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
});
