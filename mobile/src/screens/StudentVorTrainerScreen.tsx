import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
};

const QUIZ: QuizQuestion[] = [
  {
    id: 'radial-definition',
    prompt: 'A VOR radial is defined as:',
    options: ['The direction TO the station', 'The direction FROM the station', 'The aircraft heading'],
    answer: 'The direction FROM the station',
    explanation: 'Radials are always the magnetic bearing FROM the station.',
  },
  {
    id: 'obs-to-flag',
    prompt: 'OBS set to 090 with TO flag means:',
    options: ['Inbound course 090', 'Outbound radial 090', 'Inbound course 270'],
    answer: 'Inbound course 090',
    explanation: 'With TO flag, the OBS course is inbound to the station.',
  },
];

function normalizeCourse(value: number) {
  if (!Number.isFinite(value)) return null;
  let normalized = Math.round(value);
  while (normalized <= 0) normalized += 360;
  while (normalized > 360) normalized -= 360;
  return normalized;
}

export default function StudentVorTrainerScreen() {
  const [obsCourse, setObsCourse] = useState('090');
  const [flag, setFlag] = useState<'to' | 'from'>('to');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const courseValue = normalizeCourse(Number(obsCourse));
  const radialFrom =
    courseValue === null
      ? null
      : flag === 'from'
        ? courseValue
        : normalizeCourse(courseValue + 180);

  const score = QUIZ.reduce(
    (acc, question) => {
      if (answers[question.id]) acc.total += 1;
      if (answers[question.id] === question.answer) acc.correct += 1;
      return acc;
    },
    { correct: 0, total: 0 }
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>VOR Trainer</Text>
        <Text style={styles.subtitle}>Radials, OBS, flags, and intercept drills.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>OBS to Radial</Text>
        <Text style={styles.helperText}>Enter an OBS course and pick the flag.</Text>
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={obsCourse}
            onChangeText={setObsCourse}
            keyboardType="number-pad"
            placeholder="090"
          />
          <TouchableOpacity
            style={[styles.toggle, flag === 'to' && styles.toggleActive]}
            onPress={() => setFlag('to')}
          >
            <Text style={styles.toggleText}>TO</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggle, flag === 'from' && styles.toggleActive]}
            onPress={() => setFlag('from')}
          >
            <Text style={styles.toggleText}>FROM</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resultBox}>
          {courseValue === null ? (
            <Text style={styles.helperText}>Enter a course between 1 and 360.</Text>
          ) : (
            <>
              <Text style={styles.resultText}>OBS course: {courseValue}</Text>
              <Text style={styles.resultText}>Radial (FROM station): {radialFrom}</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.scoreRow}>
          <Text style={styles.sectionTitle}>Quick Quiz</Text>
          <Text style={styles.scoreText}>
            {score.correct}/{score.total}
          </Text>
        </View>
        {QUIZ.map((question) => {
          const selected = answers[question.id];
          const show = revealed[question.id];
          return (
            <View key={question.id} style={styles.quizCard}>
              <Text style={styles.quizPrompt}>{question.prompt}</Text>
              <View style={styles.quizOptions}>
                {question.options.map((option) => {
                  const isSelected = selected === option;
                  const isCorrect = option === question.answer;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.optionButton,
                        isSelected && styles.optionSelected,
                        show && isCorrect && styles.optionCorrect,
                        show && isSelected && !isCorrect && styles.optionIncorrect,
                      ]}
                      onPress={() => setAnswers((prev) => ({ ...prev, [question.id]: option }))}
                    >
                      <Text style={styles.optionText}>{option}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setRevealed((prev) => ({ ...prev, [question.id]: true }))}
                disabled={!selected}
              >
                <Text style={styles.secondaryButtonText}>Check answer</Text>
              </TouchableOpacity>
              {show && <Text style={styles.helperText}>{question.explanation}</Text>}
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Quick Tips</Text>
        <View style={styles.tipRow}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.tipText}>Radials are always labeled FROM the station.</Text>
        </View>
        <View style={styles.tipRow}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.tipText}>TO flag means inbound on the OBS course.</Text>
        </View>
        <View style={styles.tipRow}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.tipText}>FROM flag means outbound on the OBS course.</Text>
        </View>
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
  card: {
    margin: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm },
  helperText: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggle: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  toggleActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  toggleText: { fontSize: 12, fontWeight: '600', color: colors.text },
  resultBox: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  resultText: { fontSize: 13, color: colors.text },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreText: { fontSize: 13, color: colors.textMuted },
  quizCard: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  quizPrompt: { fontSize: 13, fontWeight: '600', color: colors.text },
  quizOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  optionButton: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  optionSelected: { borderColor: colors.primary },
  optionCorrect: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  optionIncorrect: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  optionText: { fontSize: 12, color: colors.text },
  secondaryButton: { marginTop: spacing.sm, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  secondaryButtonText: { color: colors.primary, fontWeight: '600' },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  tipText: { fontSize: 12, color: colors.text },
});
