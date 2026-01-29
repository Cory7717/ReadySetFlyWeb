import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type Inputs = {
  annualHours: string;
  hangar: string;
  insurance: string;
  annualInspection: string;
  loanPaymentAnnual: string;
  subscriptions: string;
  otherFixed: string;
  fuelPerHour: string;
  oilPerHour: string;
  maintenanceReservePerHour: string;
  engineReservePerHour: string;
  otherVariablePerHour: string;
};

const STORAGE_KEY = 'ownership-cost-inputs';

const DEFAULTS: Inputs = {
  annualHours: '100',
  hangar: '3600',
  insurance: '2000',
  annualInspection: '1800',
  loanPaymentAnnual: '0',
  subscriptions: '300',
  otherFixed: '0',
  fuelPerHour: '80',
  oilPerHour: '3',
  maintenanceReservePerHour: '20',
  engineReservePerHour: '25',
  otherVariablePerHour: '0',
};

function toNumber(value: string) {
  const cleaned = value.replace(/[^0-9.\-]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

export default function OwnershipCostCalculatorScreen() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!stored) return;
        try {
          const parsed = JSON.parse(stored);
          setInputs({ ...DEFAULTS, ...parsed });
        } catch {
          setInputs(DEFAULTS);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(inputs)).catch(() => undefined);
  }, [inputs]);

  const fixedAnnual = useMemo(() => {
    return (
      toNumber(inputs.hangar) +
      toNumber(inputs.insurance) +
      toNumber(inputs.annualInspection) +
      toNumber(inputs.loanPaymentAnnual) +
      toNumber(inputs.subscriptions) +
      toNumber(inputs.otherFixed)
    );
  }, [inputs]);

  const variablePerHour = useMemo(() => {
    return (
      toNumber(inputs.fuelPerHour) +
      toNumber(inputs.oilPerHour) +
      toNumber(inputs.maintenanceReservePerHour) +
      toNumber(inputs.engineReservePerHour) +
      toNumber(inputs.otherVariablePerHour)
    );
  }, [inputs]);

  const ownershipCostPerHour = useMemo(() => {
    const annualHours = toNumber(inputs.annualHours);
    if (annualHours <= 0) return 0;
    return fixedAnnual / annualHours + variablePerHour;
  }, [fixedAnnual, variablePerHour, inputs.annualHours]);

  const recommendedRentalPerHour = useMemo(() => {
    return Math.round(ownershipCostPerHour * 1.15 * 100) / 100;
  }, [ownershipCostPerHour]);

  const updateField = (key: keyof Inputs) => (value: string) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Ownership Cost per Hour</Text>
      <Text style={styles.subtitle}>
        Estimate cost per flight hour and a suggested rental rate (+15%).
      </Text>

      <View style={styles.cardRow}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Ownership Cost/hr</Text>
          <Text style={styles.cardValue}>${ownershipCostPerHour.toFixed(2)}</Text>
          <Text style={styles.cardHint}>Fixed/hrs + variable</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Recommended Rental/hr</Text>
          <Text style={styles.cardValue}>${recommendedRentalPerHour.toFixed(2)}</Text>
          <Text style={styles.cardHint}>+15% margin</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Annual Fixed Costs</Text>
        <Text style={styles.cardValue}>${fixedAnnual.toFixed(0)}</Text>
        <Text style={styles.cardHint}>Total per year</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Inputs</Text>
        <Text style={styles.sectionHint}>Adjust assumptions to match your aircraft.</Text>

        <Text style={styles.label}>Expected Annual Utilization (hours)</Text>
        <TextInput
          style={styles.input}
          value={inputs.annualHours}
          onChangeText={updateField('annualHours')}
          keyboardType="numeric"
        />

        <View style={styles.divider} />

        <Text style={styles.sectionSubtitle}>Fixed Annual Costs</Text>
        <Text style={styles.label}>Hangar/Tie-Down (annual)</Text>
        <TextInput style={styles.input} value={inputs.hangar} onChangeText={updateField('hangar')} keyboardType="numeric" />
        <Text style={styles.label}>Insurance (annual)</Text>
        <TextInput style={styles.input} value={inputs.insurance} onChangeText={updateField('insurance')} keyboardType="numeric" />
        <Text style={styles.label}>Annual/100-hr Inspection (annual)</Text>
        <TextInput style={styles.input} value={inputs.annualInspection} onChangeText={updateField('annualInspection')} keyboardType="numeric" />
        <Text style={styles.label}>Loan Payments (annual)</Text>
        <TextInput style={styles.input} value={inputs.loanPaymentAnnual} onChangeText={updateField('loanPaymentAnnual')} keyboardType="numeric" />
        <Text style={styles.label}>Subscriptions/Misc (annual)</Text>
        <TextInput style={styles.input} value={inputs.subscriptions} onChangeText={updateField('subscriptions')} keyboardType="numeric" />
        <Text style={styles.label}>Other Fixed (annual)</Text>
        <TextInput style={styles.input} value={inputs.otherFixed} onChangeText={updateField('otherFixed')} keyboardType="numeric" />

        <View style={styles.divider} />

        <Text style={styles.sectionSubtitle}>Variable Costs (per flight hour)</Text>
        <Text style={styles.label}>Fuel ($/hr)</Text>
        <TextInput style={styles.input} value={inputs.fuelPerHour} onChangeText={updateField('fuelPerHour')} keyboardType="numeric" />
        <Text style={styles.label}>Oil ($/hr)</Text>
        <TextInput style={styles.input} value={inputs.oilPerHour} onChangeText={updateField('oilPerHour')} keyboardType="numeric" />
        <Text style={styles.label}>Maintenance Reserve ($/hr)</Text>
        <TextInput style={styles.input} value={inputs.maintenanceReservePerHour} onChangeText={updateField('maintenanceReservePerHour')} keyboardType="numeric" />
        <Text style={styles.label}>Engine/Prop Reserve ($/hr)</Text>
        <TextInput style={styles.input} value={inputs.engineReservePerHour} onChangeText={updateField('engineReservePerHour')} keyboardType="numeric" />
        <Text style={styles.label}>Other Variable ($/hr)</Text>
        <TextInput style={styles.input} value={inputs.otherVariablePerHour} onChangeText={updateField('otherVariablePerHour')} keyboardType="numeric" />
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>How this works</Text>
        <Text style={styles.noteText}>
          Ownership cost per hour = (annual fixed costs ÷ annual hours) + variable per-hour costs.
        </Text>
        <Text style={styles.noteText}>
          Recommended rental price adds a 15% margin. Verify all assumptions with your mechanic and operator.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  title: { ...typography.h2 },
  subtitle: { marginTop: spacing.xs, color: colors.textMuted, marginBottom: spacing.sm },
  cardRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardLabel: { fontSize: 12, color: colors.textMuted },
  cardValue: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  cardHint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  section: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  sectionHint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.sm },
  sectionSubtitle: { fontSize: 14, fontWeight: '600', marginBottom: spacing.xs, marginTop: spacing.sm },
  label: { fontSize: 12, fontWeight: '600', color: colors.text, marginTop: spacing.xs },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  noteCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
    ...shadow.card,
  },
  noteTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  noteText: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
});
