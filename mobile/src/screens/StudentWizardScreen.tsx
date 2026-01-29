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
        >
          <Text style={styles.primaryButtonText}>Find Flight Schools</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Pilot Readiness Wizard</Text>
      <Text style={styles.subtitle}>Step {Math.min(step + 1, STEPS.length)} of {STEPS.length}</Text>

      <View style={styles.card}>
        <Text style={styles.stepTitle}>{step < STEPS.length ? STEPS[step] : 'Summary'}</Text>
        {renderStep()}
      </View>

      <View style={styles.actions}>
        {step > 0 && (
          <TouchableOpacity style={styles.secondaryButton} onPress={back}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={next}
        >
          <Text style={styles.primaryButtonText}>{step >= STEPS.length ? 'Done' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  title: { ...typography.h2 },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  card: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg, marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  stepTitle: { ...typography.h3, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, gap: 8 },
  primaryButton: { backgroundColor: colors.primary, padding: spacing.sm, borderRadius: radius.md, alignItems: 'center', flex: 1 },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: { backgroundColor: '#e2e8f0', padding: spacing.sm, borderRadius: radius.md, alignItems: 'center', flex: 1 },
  secondaryButtonText: { color: '#111827', fontWeight: '600' },
  summary: { gap: 8 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  summaryText: { fontSize: 13, color: colors.text },
  summaryCallout: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
});
