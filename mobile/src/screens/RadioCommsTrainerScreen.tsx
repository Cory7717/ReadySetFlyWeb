import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsAuthenticated } from '../utils/auth';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';
import * as Speech from 'expo-speech';

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
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);

  
  useEffect(() => {
    Speech.getAvailableVoicesAsync()
      .then((allVoices) => {
        const english = allVoices.filter((voice) =>
          voice.language?.toLowerCase().startsWith('en')
        );
        setVoices(english);
        if (!selectedVoiceId && english.length > 0) {
          setSelectedVoiceId(english[0].identifier);
        }
      })
      .catch(() => setVoices([]));
  }, [selectedVoiceId]);
  
  const playSample = (textToSpeak: string) => {
    Speech.stop();
    Speech.speak(textToSpeak, {
      voice: selectedVoiceId || undefined,
      rate: 0.95,
      pitch: 1.0,
    });
  };
  const evaluate = () => {
    const tokens = selected.expectedTokens.map((token) => normalize(token));
    const normalized = normalize(input);
    const hit = tokens.every((token) => normalized.includes(token));
    setFeedback(hit ? 'Correct response.' : 'Needs work. Include the key elements.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
        <Text style={styles.sectionTitle}>Voice Selection</Text>
        <Text style={styles.tips}>Choose an English voice for playback.</Text>
        <View style={styles.voiceList}>
          {voices.length === 0 && <Text style={styles.helperText}>No voices available on this device.</Text>}
          {voices.map((voice) => (
            <TouchableOpacity
              key={voice.identifier}
              style={[styles.voiceItem, selectedVoiceId === voice.identifier && styles.voiceItemActive]}
              onPress={() => setSelectedVoiceId(voice.identifier)}
            >
              <Text style={styles.voiceText}>{voice.name} ({voice.language})</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

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
        <View style={styles.audioRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => playSample(selected.sample)}>
            <Text style={styles.secondaryButtonText}>Play Pilot</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => playSample('Tower, say again your request.')}
          >
            <Text style={styles.secondaryButtonText}>Play ATC</Text>
          </TouchableOpacity>
        </View>

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
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.lg },
  header: { padding: spacing.lg, backgroundColor: colors.surface },
  title: { ...typography.h2 },
  subtitle: { marginTop: spacing.xs, color: colors.textMuted },
  alert: { flexDirection: 'row', gap: 8, backgroundColor: colors.primarySoft, margin: spacing.md, padding: spacing.sm, borderRadius: radius.md },
  alertText: { flex: 1, color: colors.primary, fontSize: 12 },
  section: { padding: spacing.md, backgroundColor: colors.surface, marginBottom: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  sectionTitle: { ...typography.h3, marginBottom: spacing.xs },
  card: { padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, marginBottom: spacing.sm },
  cardActive: { borderWidth: 1, borderColor: colors.primary },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  prompt: { fontSize: 14, color: colors.text, marginBottom: 6 },
  tips: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  sampleLabel: { fontSize: 12, fontWeight: '600', color: colors.text },
  sample: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.sm,
  },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', ...shadow.card },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  feedback: { marginTop: spacing.xs, fontSize: 12, color: colors.text },
});
