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
      <Text style={styles.title}>Written Test Prep</Text>
      <Text style={styles.subtitle}>FAA-aligned mini modules and quick quizzes.</Text>

      <View style={styles.card}>
        {TOPICS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.topicItem, selected === item.id && styles.topicItemActive]}
            onPress={() => {
              setSelected(item.id);
              setChoice(null);
              setShowResult(false);
            }}
          >
            <Text style={styles.topicTitle}>{item.title}</Text>
            <Text style={styles.topicSummary}>{item.summary}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {topic && (
        <View style={styles.card}>
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
              >
                <Text style={styles.choiceText}>{option}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setShowResult(true)}
            disabled={choice === null}
          >
            <Text style={styles.primaryButtonText}>Check Answer</Text>
          </TouchableOpacity>
          {showResult && (
            <Text style={styles.resultText}>
              {choice === topic.answer ? 'Correct!' : `Correct answer: ${topic.choices[topic.answer]}`}
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  title: { ...typography.h2 },
  subtitle: { marginTop: spacing.xs, color: colors.textMuted, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  topicItem: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  topicItemActive: { backgroundColor: colors.primarySoft },
  topicTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  topicSummary: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  questionTitle: { fontSize: 14, fontWeight: '600', marginBottom: spacing.sm, color: colors.text },
  choice: { padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  choiceSelected: { borderColor: colors.primary },
  choiceCorrect: { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
  choiceIncorrect: { backgroundColor: '#fee2e2', borderColor: colors.danger },
  choiceText: { fontSize: 12, color: colors.text },
  primaryButton: { backgroundColor: colors.primary, padding: spacing.sm, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.xs },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  resultText: { marginTop: spacing.xs, color: colors.text, fontSize: 12 },
});
