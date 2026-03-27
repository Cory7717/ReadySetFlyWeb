import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

const STEPS = ['Goals', 'Budget', 'Time', 'Medical', 'Location'];

export default function StudentWizardScreen({ navigation }: any) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    goal: '',
    budget: '',
    time: '',
    medical: '',
    location: '',
  });

  const next = () => setStep((prev) => Math.min(prev + 1, STEPS.length));
  const back = () => setStep((prev) => Math.max(prev - 1, 0));

  const renderStep = () => {
    if (step === 0) {
      return (
        <TextInput
          style={styles.input}
          placeholder="Hobby / Career / Undecided"
          value={form.goal}
          onChangeText={(value) => setForm((prev) => ({ ...prev, goal: value }))}
        />
      );
    }
    if (step === 1) {
      return (
        <TextInput
          style={styles.input}
          placeholder="$8k-$12k / $12k-$18k / $20k+"
          value={form.budget}
          onChangeText={(value) => setForm((prev) => ({ ...prev, budget: value }))}
        />
      );
    }
    if (step === 2) {
      return (
        <TextInput
          style={styles.input}
          placeholder="Hours per week"
          value={form.time}
          onChangeText={(value) => setForm((prev) => ({ ...prev, time: value }))}
        />
      );
    }
    if (step === 3) {
      return (
        <TextInput
          style={styles.input}
          placeholder="Unknown / Likely OK / Have concerns"
          value={form.medical}
          onChangeText={(value) => setForm((prev) => ({ ...prev, medical: value }))}
        />
      );
    }
    if (step === 4) {
      return (
        <TextInput
          style={styles.input}
          placeholder="City / State or ZIP"
          value={form.location}
          onChangeText={(value) => setForm((prev) => ({ ...prev, location: value }))}
        />
      );
    }
    return (
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>Your Pilot Pathway</Text>
        <Text style={styles.summaryText}>Goal: {form.goal || 'Undecided'}</Text>
        <Text style={styles.summaryText}>Budget: {form.budget || 'Not set'}</Text>
        <Text style={styles.summaryText}>Time: {form.time || 'Not set'}</Text>
        <Text style={styles.summaryText}>Medical: {form.medical || 'Unknown'}</Text>
        <Text style={styles.summaryText}>Location: {form.location || 'Not set'}</Text>
        <Text style={styles.summaryCallout}>
          Next steps: book a discovery flight, start ground school, and connect with a local flight school.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Marketplace', { screen: 'MarketplaceCategory', params: { category: 'Flight Schools' } })}
          activeOpacity={0.92}
        >
          <Text style={styles.primaryButtonText}>Find Flight Schools</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>READINESS WIZARD</Text>
        <Text style={styles.heroTitle}>Get a first-pass answer to whether the path fits you.</Text>
        <Text style={styles.heroSubtitle}>
          Work through your goals, budget, time, medical picture, and location to frame the right next step.
        </Text>
      </View>

      <View style={styles.progressCard}>
        <Text style={styles.progressLabel}>Step {Math.min(step + 1, STEPS.length)} of {STEPS.length}</Text>
        <Text style={styles.sectionTitle}>{step < STEPS.length ? STEPS[step] : 'Summary'}</Text>
      </View>

      <View style={styles.card}>{renderStep()}</View>

      <View style={styles.actions}>
        {step > 0 && (
          <TouchableOpacity style={styles.secondaryButton} onPress={back} activeOpacity={0.92}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.primaryButton} onPress={next} activeOpacity={0.92}>
          <Text style={styles.primaryButtonText}>{step >= STEPS.length ? 'Done' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.sm, paddingBottom: 120 },
  hero: { backgroundColor: colors.cockpit, borderRadius: radius.xl, padding: spacing.lg, ...shadow.floating },
  heroEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: '#93c5fd' },
  heroTitle: { ...typography.display, color: '#fff', marginTop: spacing.sm },
  heroSubtitle: { ...typography.body, color: '#dbe4f0', marginTop: spacing.sm },
  progressCard: { marginTop: spacing.lg, backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  progressLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  sectionTitle: { ...typography.h2, marginTop: spacing.xs },
  card: { marginTop: spacing.lg, backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 14, backgroundColor: colors.surfaceMuted },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg, gap: 8 },
  primaryButton: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.lg, alignItems: 'center', flex: 1, ...shadow.card },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { backgroundColor: colors.surfaceMuted, paddingVertical: 14, borderRadius: radius.lg, alignItems: 'center', flex: 1, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontWeight: '700' },
  summary: { gap: 8 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  summaryText: { fontSize: 13, color: colors.text },
  summaryCallout: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
});
