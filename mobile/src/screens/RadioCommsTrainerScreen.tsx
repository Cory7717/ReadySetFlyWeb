import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsAuthenticated } from '../utils/auth';

const SCENARIOS = [
  {
    id: 'towered-pattern',
    title: 'Towered Pattern (VFR)',
    prompt: 'Make your initial call 10 miles out.',
    tips: 'Include who you are calling, who you are, position, and request.',
    expectedTokens: ['tower', 'request', 'full stop'],
    sample: 'Van Nuys Tower, Cessna 123AB, ten miles east, inbound full stop with Information Alpha.',
  },
  {
    id: 'ground-departure',
    title: 'Ground + Tower Departure',
    prompt: 'Request taxi for departure.',
    tips: 'Include ATIS code and your requested runway if known.',
    expectedTokens: ['ground', 'taxi', 'departure'],
    sample: 'Austin Ground, Cessna 123AB at Signature, ready to taxi with Information Bravo, VFR to the south.',
  },
];

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function RadioCommsTrainerScreen() {
  const { user } = useIsAuthenticated();
  const isPro = user?.logbookProStatus === 'active';
  const [selected, setSelected] = useState(SCENARIOS[0]);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const evaluate = () => {
    const tokens = selected.expectedTokens.map((token) => normalize(token));
    const normalized = normalize(input);
    const hit = tokens.every((token) => normalized.includes(token));
    setFeedback(hit ? 'Correct response.' : 'Needs work. Include the key elements.');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Radio Comms Trainer</Text>
        <Text style={styles.subtitle}>Practice ATC phraseology with guided scenarios.</Text>
      </View>

      {!isPro && (
        <View style={styles.alert}>
          <Ionicons name="lock-closed-outline" size={18} color="#1e40af" />
          <Text style={styles.alertText}>
            Demo mode on mobile. Logbook Pro unlocks full scenarios, audio practice, and scoring history.
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scenarios</Text>
        {SCENARIOS.map((scenario) => (
          <TouchableOpacity
            key={scenario.id}
            style={[styles.card, selected.id === scenario.id && styles.cardActive]}
            onPress={() => {
              setSelected(scenario);
              setInput('');
              setFeedback(null);
            }}
          >
            <Text style={styles.cardTitle}>{scenario.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{selected.title}</Text>
        <Text style={styles.prompt}>{selected.prompt}</Text>
        <Text style={styles.tips}>Tip: {selected.tips}</Text>
        <Text style={styles.sampleLabel}>Sample call</Text>
        <Text style={styles.sample}>{selected.sample}</Text>

        <TextInput
          style={styles.input}
          placeholder="Type your radio call..."
          value={input}
          onChangeText={setInput}
          multiline
        />
        <TouchableOpacity style={styles.primaryButton} onPress={evaluate}>
          <Text style={styles.primaryButtonText}>Check Call</Text>
        </TouchableOpacity>
        {feedback && <Text style={styles.feedback}>{feedback}</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subtitle: { marginTop: 6, color: '#6b7280' },
  alert: { flexDirection: 'row', gap: 8, backgroundColor: '#e0e7ff', margin: 16, padding: 12, borderRadius: 10 },
  alertText: { flex: 1, color: '#1e40af', fontSize: 12 },
  section: { padding: 16, backgroundColor: '#fff', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 },
  card: { padding: 12, borderRadius: 10, backgroundColor: '#f9fafb', marginBottom: 8 },
  cardActive: { borderWidth: 1, borderColor: '#1e40af' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  prompt: { fontSize: 14, color: '#111827', marginBottom: 6 },
  tips: { fontSize: 12, color: '#6b7280', marginBottom: 10 },
  sampleLabel: { fontSize: 12, fontWeight: '600', color: '#374151' },
  sample: { fontSize: 12, color: '#4b5563', marginBottom: 12 },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  primaryButton: { backgroundColor: '#1e40af', borderRadius: 10, padding: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  feedback: { marginTop: 8, fontSize: 12, color: '#111827' },
});
