import { useState } from 'react';
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
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>VOR TRAINER</Text>
        <Text style={styles.heroTitle}>Make the OBS, flag, and radial picture click faster.</Text>
        <Text style={styles.heroSubtitle}>
          Practice the relationship between course selection and station geometry before the nav lesson.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>OBS to Radial</Text>
        <Text style={styles.sectionSubtitle}>Enter a course and choose the flag to see what radial you are actually on.</Text>
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
            activeOpacity={0.92}
          >
            <Text style={[styles.toggleText, flag === 'to' && styles.toggleTextActive]}>TO</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggle, flag === 'from' && styles.toggleActive]}
            onPress={() => setFlag('from')}
            activeOpacity={0.92}
          >
            <Text style={[styles.toggleText, flag === 'from' && styles.toggleTextActive]}>FROM</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resultBox}>
          {courseValue === null ? (
            <Text style={styles.helperText}>Enter a course between 1 and 360.</Text>
          ) : (
            <>
              <Text style={styles.resultLabel}>OBS course</Text>
              <Text style={styles.resultValue}>{courseValue}</Text>
              <Text style={styles.resultMeta}>Radial from station: {radialFrom}</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.quizHeader}>
          <Text style={styles.sectionTitle}>Quick Quiz</Text>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreBadgeText}>{score.correct}/{score.total}</Text>
          </View>
        </View>
        {QUIZ.map((question) => {
          const selected = answers[question.id];
          const show = revealed[question.id];
          return (
            <View key={question.id} style={styles.quizCard}>
              <Text style={styles.quizPrompt}>{question.prompt}</Text>
              {question.options.map((option) => {
                const isSelected = selected === option;
                const isCorrect = show && option === question.answer;
                const isIncorrect = show && isSelected && option !== question.answer;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.option,
                      isSelected && styles.optionSelected,
                      isCorrect && styles.optionCorrect,
                      isIncorrect && styles.optionIncorrect,
                    ]}
                    onPress={() => setAnswers((prev) => ({ ...prev, [question.id]: option }))}
                    activeOpacity={0.92}
                  >
                    <Text style={styles.optionText}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setRevealed((prev) => ({ ...prev, [question.id]: true }))}
                disabled={!selected}
                activeOpacity={0.92}
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
  card: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  sectionTitle: { ...typography.h2 },
  sectionSubtitle: { ...typography.muted, marginTop: 4 },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  toggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  toggleActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  toggleText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  toggleTextActive: { color: colors.primaryStrong },
  resultBox: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  resultLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase', color: colors.textMuted },
  resultValue: { ...typography.metric, marginTop: spacing.xs },
  resultMeta: { ...typography.muted, marginTop: spacing.xs },
  helperText: { ...typography.muted, marginTop: spacing.sm },
  quizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  scoreBadge: {
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scoreBadgeText: { fontSize: 12, fontWeight: '700', color: colors.primaryStrong },
  quizCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  quizPrompt: { ...typography.h3, marginBottom: spacing.sm },
  option: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.xs,
  },
  optionSelected: { borderColor: colors.primary },
  optionCorrect: { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
  optionIncorrect: { backgroundColor: '#fee2e2', borderColor: colors.danger },
  optionText: { fontSize: 12, color: colors.text },
  secondaryButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  secondaryButtonText: { color: '#fff', fontWeight: '700' },
  tipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  tipText: { ...typography.body, flex: 1 },
});
