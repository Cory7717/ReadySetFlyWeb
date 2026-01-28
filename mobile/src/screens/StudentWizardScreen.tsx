import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginTop: 12 },
  stepTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
  },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 8 },
  primaryButton: { backgroundColor: '#1e40af', padding: 12, borderRadius: 10, alignItems: 'center', flex: 1 },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: { backgroundColor: '#e5e7eb', padding: 12, borderRadius: 10, alignItems: 'center', flex: 1 },
  secondaryButtonText: { color: '#111827', fontWeight: '600' },
  summary: { gap: 8 },
  summaryTitle: { fontSize: 16, fontWeight: '700' },
  summaryText: { fontSize: 13, color: '#374151' },
  summaryCallout: { fontSize: 12, color: '#6b7280', marginTop: 6 },
});
