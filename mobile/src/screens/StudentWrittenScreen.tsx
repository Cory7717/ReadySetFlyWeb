import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

const TOPICS = [
  {
    id: 'wx',
    title: 'Aviation Weather',
    summary: 'METAR/TAF basics, ceiling/visibility, and go/no-go decisions.',
    question: 'Which condition indicates MVFR?',
    choices: ['Ceiling 3500 ft and 6 SM', 'Ceiling 1500 ft and 4 SM', 'Ceiling 300 ft and 1/2 SM'],
    answer: 1,
  },
  {
    id: 'airspace',
    title: 'Airspace Basics',
    summary: 'Class B/C/D entry requirements and VFR weather minimums.',
    question: 'Which equipment is required to enter Class C?',
    choices: ['Two-way radio and Mode C', 'Only a handheld radio', 'ELT only'],
    answer: 0,
  },
  {
    id: 'nav',
    title: 'Navigation',
    summary: 'Pilotage, dead reckoning, and VOR basics.',
    question: 'Which nav method uses landmarks?',
    choices: ['Pilotage', 'Dead reckoning', 'GPS RAIM'],
    answer: 0,
  },
];

export default function StudentWrittenScreen() {
  const [selected, setSelected] = useState<string | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  const topic = TOPICS.find((t) => t.id === selected) || null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>WRITTEN TEST PREP</Text>
        <Text style={styles.heroTitle}>Review the concepts that most often stall momentum.</Text>
        <Text style={styles.heroSubtitle}>
          Use quick topic drills to stay current between lessons and build stronger test recall.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Study Topics</Text>
        <Text style={styles.sectionSubtitle}>Choose a subject and run a fast knowledge check.</Text>

        {TOPICS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.topicItem, selected === item.id && styles.topicItemActive]}
            onPress={() => {
              setSelected(item.id);
              setChoice(null);
              setShowResult(false);
            }}
            activeOpacity={0.92}
          >
            <Text style={styles.topicTitle}>{item.title}</Text>
            <Text style={styles.topicSummary}>{item.summary}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {topic && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{topic.title}</Text>
          <Text style={styles.questionTitle}>{topic.question}</Text>
          {topic.choices.map((option, index) => {
            const isSelected = choice === index;
            const isCorrect = showResult && index === topic.answer;
            const isIncorrect = showResult && isSelected && index !== topic.answer;
            return (
              <TouchableOpacity
                key={option}
                style={[
                  styles.choice,
                  isSelected && styles.choiceSelected,
                  isCorrect && styles.choiceCorrect,
                  isIncorrect && styles.choiceIncorrect,
                ]}
                onPress={() => setChoice(index)}
                activeOpacity={0.92}
              >
                <Text style={styles.choiceText}>{option}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setShowResult(true)}
            disabled={choice === null}
            activeOpacity={0.92}
          >
            <Text style={styles.primaryButtonText}>Check Answer</Text>
          </TouchableOpacity>
          {showResult && (
            <Text style={styles.resultText}>
              {choice === topic.answer ? 'Correct.' : `Correct answer: ${topic.choices[topic.answer]}`}
            </Text>
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
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
  },
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
  sectionSubtitle: { ...typography.muted, marginTop: 4, marginBottom: spacing.md },
  topicItem: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.sm,
  },
  topicItemActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  topicTitle: { ...typography.h3 },
  topicSummary: { ...typography.muted, marginTop: 4 },
  questionTitle: { ...typography.h3, marginBottom: spacing.md },
  choice: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
    backgroundColor: colors.surfaceMuted,
  },
  choiceSelected: { borderColor: colors.primary },
  choiceCorrect: { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
  choiceIncorrect: { backgroundColor: '#fee2e2', borderColor: colors.danger },
  choiceText: { fontSize: 12, color: colors.text },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadow.card,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  resultText: { marginTop: spacing.sm, color: colors.text, fontSize: 12, fontWeight: '600' },
});
