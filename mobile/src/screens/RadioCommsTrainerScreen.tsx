import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsAuthenticated } from '../utils/auth';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';
import * as Speech from 'expo-speech';
import { api } from '../services/api';

type ScenarioStep = {
  id: string;
  prompt: string;
  expectedTokens: string[];
  atcReply: string;
  tips: string;
};

type Scenario = {
  id: string;
  title: string;
  summary: string;
  steps: ScenarioStep[];
  examples: { pilot: string; atc: string }[];
};

const SCENARIOS: Scenario[] = [
  {
    id: 'towered-pattern',
    title: 'Towered Pattern (VFR)',
    summary: 'Practice pattern entries, downwind, base, and final calls.',
    steps: [
      {
        id: 'entry-call',
        prompt: 'Make your initial call 10 miles out.',
        expectedTokens: ['tower', 'request', 'full stop'],
        atcReply: 'Cessna 123AB, enter left downwind runway 27, report midfield.',
        tips: 'Include who you are calling, who you are, position, and request.',
      },
      {
        id: 'midfield',
        prompt: 'Report midfield downwind.',
        expectedTokens: ['midfield', 'downwind', 'runway'],
        atcReply: 'Cessna 123AB, number two, follow Cherokee on base.',
        tips: 'State position, runway, and your call sign.',
      },
      {
        id: 'final',
        prompt: 'Call final for landing.',
        expectedTokens: ['final', 'runway'],
        atcReply: 'Cessna 123AB, cleared to land runway 27.',
        tips: 'Keep it short and confirm runway.',
      },
      {
        id: 'clear',
        prompt: 'Call clear of the runway.',
        expectedTokens: ['clear', 'runway'],
        atcReply: 'Cessna 123AB, taxi to parking via Alpha.',
        tips: 'Advise when you are clear and ready to taxi.',
      },
    ],
    examples: [
      {
        pilot: 'Van Nuys Tower, Cessna 123AB, ten miles east, inbound full stop with Information Alpha.',
        atc: 'Cessna 123AB, Van Nuys Tower, enter left downwind runway 16R, report midfield.',
      },
      {
        pilot: 'Van Nuys Tower, Cessna 123AB, midfield left downwind runway 16R.',
        atc: 'Cessna 123AB, number two, follow Cherokee on base.',
      },
    ],
  },
  {
    id: 'ground-departure',
    title: 'Ground + Tower Departure',
    summary: 'Taxi request, run-up, and takeoff clearance sequence.',
    steps: [
      {
        id: 'taxi-request',
        prompt: 'Request taxi for departure.',
        expectedTokens: ['ground', 'taxi', 'departure'],
        atcReply: 'Cessna 123AB, taxi to runway 18 via Bravo.',
        tips: 'Include ATIS code and your requested runway if known.',
      },
      {
        id: 'ready',
        prompt: 'Advise tower you are ready for departure.',
        expectedTokens: ['ready', 'runway'],
        atcReply: 'Cessna 123AB, cleared for takeoff runway 18.',
        tips: 'State holding short and ready for departure.',
      },
      {
        id: 'departure',
        prompt: 'Report leaving the pattern.',
        expectedTokens: ['departure', 'leaving', 'pattern'],
        atcReply: 'Cessna 123AB, contact departure on 124.7.',
        tips: 'Share your direction of departure and altitude.',
      },
    ],
    examples: [
      {
        pilot: 'Austin Ground, Cessna 123AB at Signature, ready to taxi with Information Bravo, VFR to the south.',
        atc: 'Cessna 123AB, Austin Ground, taxi to runway 18L via Bravo and Delta.',
      },
      {
        pilot: 'Austin Tower, Cessna 123AB holding short runway 18L, ready for departure.',
        atc: 'Cessna 123AB, Austin Tower, cleared for takeoff runway 18L.',
      },
    ],
  },
  {
    id: 'class-d-arrival',
    title: 'Class D Arrival',
    summary: 'Inbound call, pattern entry, and landing clearance.',
    steps: [
      {
        id: 'inbound',
        prompt: 'Call inbound to Class D.',
        expectedTokens: ['inbound', 'request', 'full stop'],
        atcReply: 'Cessna 123AB, enter right downwind runway 22, report base.',
        tips: 'Include your distance and direction from the field.',
      },
      {
        id: 'base',
        prompt: 'Report base leg.',
        expectedTokens: ['base', 'runway'],
        atcReply: 'Cessna 123AB, cleared to land runway 22.',
        tips: 'Keep the call short and precise.',
      },
      {
        id: 'clear',
        prompt: 'Call clear of the runway.',
        expectedTokens: ['clear', 'runway'],
        atcReply: 'Cessna 123AB, taxi to parking via Alpha.',
        tips: 'Advise when you are clear and ready to taxi.',
      },
    ],
    examples: [
      {
        pilot: 'McKinney Tower, Cessna 123AB, fifteen miles northeast, inbound full stop with Information Echo.',
        atc: 'Cessna 123AB, McKinney Tower, enter right downwind runway 17, report base.',
      },
      {
        pilot: 'McKinney Tower, Cessna 123AB, right base runway 17.',
        atc: 'Cessna 123AB, cleared to land runway 17.',
      },
    ],
  },
];

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function RadioCommsTrainerScreen() {
  const { user } = useIsAuthenticated();
  const entitlements = (user as any)?.entitlements;
  const isPro = entitlements?.canUseScenarioScoring ?? (user?.logbookProStatus === 'active');
  const [selectedScenarioId, setSelectedScenarioId] = useState(SCENARIOS[0].id);
  const [stepIndex, setStepIndex] = useState(0);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [attempts, setAttempts] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const sessionStartRef = useRef<number | null>(null);

  useEffect(() => {
    Speech.getAvailableVoicesAsync()
      .then((allVoices) => {
        const english = allVoices.filter((voice) => voice.language?.toLowerCase().startsWith('en'));
        setVoices(english);
        if (!selectedVoiceId && english.length > 0) {
          setSelectedVoiceId(english[0].identifier);
        }
      })
      .catch(() => setVoices([]));
  }, [selectedVoiceId]);

  useEffect(() => {
    if (!isPro) return;
    api.get('/api/radio-comms/sessions')
      .then((res) => setSessions(res.data || []))
      .catch(() => setSessions([]));
  }, [isPro]);

  const scenario = useMemo(() => {
    const found = SCENARIOS.find((s) => s.id === selectedScenarioId) || SCENARIOS[0];
    if (isPro) return found;
    return { ...found, steps: found.steps.slice(0, 2) };
  }, [selectedScenarioId, isPro]);

  const currentStep = scenario.steps[stepIndex];

  const resetScenario = () => {
    setStepIndex(0);
    setInput('');
    setFeedback(null);
    setScore({ correct: 0, total: 0 });
    setAttempts([]);
    setSessionSaved(false);
    sessionStartRef.current = Date.now();
  };

  useEffect(() => {
    if (!sessionStartRef.current) {
      sessionStartRef.current = Date.now();
    }
  }, []);

  const playSample = (textToSpeak: string) => {
    Speech.stop();
    Speech.speak(textToSpeak, {
      voice: selectedVoiceId || undefined,
      rate: 0.95,
      pitch: 1.0,
    });
  };

  const evaluate = () => {
    if (!currentStep) return;
    const tokens = currentStep.expectedTokens.map((token) => normalize(token));
    const normalized = normalize(input);
    const hit = tokens.every((token) => normalized.includes(token));
    setFeedback(hit ? 'Correct response.' : 'Needs work. Include the key elements.');
    setScore((prev) => ({ correct: prev.correct + (hit ? 1 : 0), total: prev.total + 1 }));
    setAttempts((prev) => [
      ...prev,
      {
        stepId: currentStep.id,
        input,
        expectedTokens: currentStep.expectedTokens,
        hit,
        atcReply: currentStep.atcReply,
      },
    ]);
    playSample(currentStep.atcReply);
  };

  const handleNext = async () => {
    if (stepIndex < scenario.steps.length - 1) {
      setStepIndex((prev) => prev + 1);
      setInput('');
      setFeedback(null);
      return;
    }
    setFeedback('Scenario complete. Great work!');

    if (isPro && !sessionSaved) {
      setSessionSaved(true);
      const durationSec = sessionStartRef.current
        ? Math.round((Date.now() - sessionStartRef.current) / 1000)
        : null;
      try {
        await api.post('/api/radio-comms/sessions', {
          scenarioId: scenario.id,
          scoreCorrect: score.correct,
          scoreTotal: score.total || scenario.steps.length,
          durationSec,
          attempts,
        });
        const updated = await api.get('/api/radio-comms/sessions');
        setSessions(updated.data || []);
      } catch (error: any) {
        Alert.alert('Save failed', error?.response?.data?.error || 'Unable to save session.');
      }
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>RADIO COMMS TRAINER</Text>
        <Text style={styles.heroTitle}>Build cleaner calls before you key up on frequency.</Text>
        <Text style={styles.heroSubtitle}>
          Practice ATC phraseology with guided scenarios, instant feedback, and playback on your own schedule.
        </Text>
      </View>

      {!isPro && (
        <View style={styles.alertCard}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.primaryStrong} />
          <Text style={styles.alertText}>
            Demo mode on mobile. RSF Pro unlocks full scenarios, audio practice, and scoring history.
          </Text>
        </View>
      )}

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Scenario</Text>
          <Text style={styles.metricValue}>{scenario.title}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Step</Text>
          <Text style={styles.metricValue}>
            {stepIndex + 1}/{scenario.steps.length}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Score</Text>
          <Text style={styles.metricValue}>
            {score.correct}/{score.total}
          </Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Voice Selection</Text>
        <Text style={styles.sectionSubtitle}>Choose an English voice for playback.</Text>
        {voices.length === 0 ? (
          <Text style={styles.helperText}>No voices available on this device.</Text>
        ) : (
          <TouchableOpacity style={styles.selectButton} onPress={() => setShowVoicePicker(true)} activeOpacity={0.92}>
            <Text style={styles.selectButtonText}>
              {voices.find((voice) => voice.identifier === selectedVoiceId)?.name || 'Select voice'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={showVoicePicker} animationType="slide" onRequestClose={() => setShowVoicePicker(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Voice</Text>
            <TouchableOpacity onPress={() => setShowVoicePicker(false)}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalList}>
            {voices.map((voice) => {
              const isSelected = selectedVoiceId === voice.identifier;
              return (
                <TouchableOpacity
                  key={voice.identifier}
                  style={[styles.listItem, isSelected && styles.listItemActive]}
                  onPress={() => {
                    setSelectedVoiceId(voice.identifier);
                    setShowVoicePicker(false);
                  }}
                >
                  <View style={styles.listMeta}>
                    <Text style={styles.listTitle}>{voice.name}</Text>
                    <Text style={styles.listSubtitle}>{voice.language}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Scenarios</Text>
        <Text style={styles.sectionSubtitle}>Choose a workflow and train it from first call to taxi clear.</Text>
        {SCENARIOS.map((scenarioItem) => {
          const isLocked = !isPro && scenarioItem.id !== SCENARIOS[0].id;
          const isSelected = selectedScenarioId === scenarioItem.id;
          return (
            <TouchableOpacity
              key={scenarioItem.id}
              style={[styles.scenarioCard, isSelected && styles.scenarioCardActive, isLocked && styles.scenarioCardLocked]}
              onPress={() => {
                setSelectedScenarioId(scenarioItem.id);
                resetScenario();
              }}
              disabled={isLocked}
              activeOpacity={0.92}
            >
              <View style={styles.scenarioHeader}>
                <View style={styles.scenarioMeta}>
                  <Text style={styles.cardTitle}>{scenarioItem.title}</Text>
                  <Text style={styles.cardSubtitle}>{scenarioItem.summary}</Text>
                </View>
                <Ionicons
                  name={isLocked ? 'lock-closed' : isSelected ? 'radio' : 'chevron-forward'}
                  size={16}
                  color={isLocked ? colors.textSoft : isSelected ? colors.primary : colors.textSoft}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.practiceBadge}>
          <Text style={styles.practiceBadgeText}>LIVE PRACTICE</Text>
        </View>
        <Text style={styles.sectionTitle}>{scenario.title}</Text>
        <Text style={styles.prompt}>{currentStep?.prompt}</Text>
        <Text style={styles.sectionSubtitle}>Tip: {currentStep?.tips}</Text>

        <View style={styles.sampleCard}>
          <Text style={styles.sampleLabel}>Sample pilot call</Text>
          <Text style={styles.sample}>{scenario.examples[0]?.pilot}</Text>
        </View>

        <View style={styles.audioRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => playSample(scenario.examples[0]?.pilot || '')} activeOpacity={0.92}>
            <Text style={styles.secondaryButtonText}>Play Pilot</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => playSample(currentStep?.atcReply || '')} activeOpacity={0.92}>
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
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={evaluate} disabled={!input.trim()} activeOpacity={0.92}>
            <Text style={styles.primaryButtonText}>Check Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleNext} activeOpacity={0.92}>
            <Text style={styles.secondaryButtonText}>Next Step</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={resetScenario} activeOpacity={0.92}>
            <Text style={styles.secondaryButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>

        {feedback && (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedback}>{feedback}</Text>
          </View>
        )}
      </View>

      {isPro && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Practice History</Text>
          <Text style={styles.sectionSubtitle}>Recent sessions saved to your RSF member profile.</Text>
          {sessions.length === 0 ? (
            <Text style={styles.helperText}>Complete a scenario to save your first session.</Text>
          ) : (
            sessions.map((session) => {
              const title = SCENARIOS.find((s) => s.id === session.scenarioId)?.title || session.scenarioId;
              return (
                <View key={session.id} style={styles.historyCard}>
                  <Text style={styles.cardTitle}>{title}</Text>
                  <Text style={styles.helperText}>
                    {session.createdAt ? new Date(session.createdAt).toLocaleDateString() : 'Not dated'} | Score {session.scoreCorrect ?? 0}/{session.scoreTotal ?? 0}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.sm, paddingBottom: 120 },
  hero: {
    backgroundColor: colors.cockpit,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.floating,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#93c5fd',
  },
  heroTitle: {
    ...typography.display,
    color: '#fff',
    marginTop: spacing.sm,
    maxWidth: 340,
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
  },
  alertCard: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  alertText: {
    flex: 1,
    ...typography.muted,
    color: colors.primaryStrong,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.card,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  metricValue: {
    ...typography.h3,
    marginTop: 6,
  },
  sectionCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  sectionTitle: {
    ...typography.h2,
  },
  sectionSubtitle: {
    ...typography.muted,
    marginTop: spacing.xs,
  },
  helperText: {
    ...typography.muted,
  },
  selectButton: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  selectButtonText: {
    fontSize: 14,
    color: colors.text,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  modalTitle: {
    ...typography.h2,
  },
  modalList: {
    marginTop: spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  listItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  listMeta: {
    flex: 1,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  listSubtitle: {
    ...typography.muted,
    marginTop: 2,
  },
  scenarioCard: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
  },
  scenarioCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#edf4ff',
  },
  scenarioCardLocked: {
    opacity: 0.68,
  },
  scenarioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scenarioMeta: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  cardSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
  practiceBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.sm,
  },
  practiceBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.primaryStrong,
  },
  prompt: {
    ...typography.body,
    marginTop: spacing.sm,
  },
  sampleCard: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
  },
  sampleLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  sample: {
    ...typography.body,
    marginTop: spacing.xs,
    color: colors.textMuted,
  },
  audioRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 110,
    textAlignVertical: 'top',
    marginTop: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '700',
  },
  feedbackCard: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: '#b7f0c8',
  },
  feedback: {
    fontSize: 13,
    fontWeight: '700',
    color: '#11663d',
  },
  historyCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
