import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

const SALES_TAX_RATE = 0.0825;
const PLANS = [
  { key: 'MONTHLY', label: 'Monthly', price: 5.99 },
  { key: 'BIANNUAL', label: '6 Months', price: 34.99 },
  { key: 'YEARLY', label: 'Yearly', price: 49.99 },
] as const;

function formatDate(value?: string | null) {
  if (!value) return 'â€”';
  try {
    return new Date(value).toLocaleDateString();
  } catch (error) {
    return value;
  }
}

export default function LogbookProScreen({ navigation }: any) {
  const { isAuthenticated, user } = useIsAuthenticated();
  const [selectedPlan, setSelectedPlan] = useState<(typeof PLANS)[number]['key']>('MONTHLY');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [prefs, setPrefs] = useState({
    emailEnabled: true,
    pushEnabled: true,
    inAppEnabled: true,
    alertDaysBefore: 30,
  });
  const [proForm, setProForm] = useState({
    medicalClass: '',
    medicalIssuedAt: '',
    medicalExpiresAt: '',
    flightReviewDate: '',
    ipcDate: '',
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign in required', 'Please sign in to upgrade to Logbook Pro.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/api/paypal/logbook/subscribe', { plan: selectedPlan });
      const approveUrl = res.data?.approveUrl;
      if (!approveUrl) {
        throw new Error('Missing approval link.');
      }
      await Linking.openURL(approveUrl);
    } catch (error: any) {
      Alert.alert('Subscription error', error?.response?.data?.error || error.message || 'Unable to start subscription.');
    } finally {
      setLoading(false);
    }
  };

  const loadProData = async () => {
    if (!isAuthenticated || user?.logbookProStatus !== 'active') return;
    try {
      const [summaryRes, prefsRes] = await Promise.all([
        api.get('/api/logbook/pro/summary'),
        api.get('/api/notifications/preferences'),
      ]);
      setSummary(summaryRes.data);
      if (prefsRes.data) {
        setPrefs({
          emailEnabled: prefsRes.data.emailEnabled ?? true,
          pushEnabled: prefsRes.data.pushEnabled ?? true,
          inAppEnabled: prefsRes.data.inAppEnabled ?? true,
          alertDaysBefore: prefsRes.data.alertDaysBefore ?? 30,
        });
      }
      if (summaryRes.data?.settings) {
        setProForm({
          medicalClass: summaryRes.data.settings.medicalClass || '',
          medicalIssuedAt: summaryRes.data.settings.medicalIssuedAt || '',
          medicalExpiresAt: summaryRes.data.settings.medicalExpiresAt || '',
          flightReviewDate: summaryRes.data.settings.flightReviewDate || '',
          ipcDate: summaryRes.data.settings.ipcDate || '',
        });
      }
    } catch (error: any) {
      Alert.alert('Logbook Pro', error?.response?.data?.error || 'Unable to load Logbook Pro data.');
    }
  };

  useEffect(() => {
    loadProData();
  }, [isAuthenticated, user?.logbookProStatus]);

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    try {
      await api.put('/api/notifications/preferences', prefs);
      Alert.alert('Saved', 'Notification preferences updated.');
    } catch (error: any) {
      Alert.alert('Update failed', error?.response?.data?.error || 'Unable to save preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put('/api/logbook/pro/settings', {
        medicalClass: proForm.medicalClass || null,
        medicalIssuedAt: proForm.medicalIssuedAt || null,
        medicalExpiresAt: proForm.medicalExpiresAt || null,
        flightReviewDate: proForm.flightReviewDate || null,
        ipcDate: proForm.ipcDate || null,
      });
      await loadProData();
      Alert.alert('Saved', 'Logbook Pro settings updated.');
    } catch (error: any) {
      Alert.alert('Update failed', error?.response?.data?.error || 'Unable to save Logbook Pro settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const plan = PLANS.find((p) => p.key === selectedPlan)!;
  const tax = plan.price * SALES_TAX_RATE;
  const total = plan.price + tax;

  if (isAuthenticated && user?.logbookProStatus === 'active') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Logbook Pro Dashboard</Text>
          <Text style={styles.subtitle}>Currency tracking, expirations, and alerts.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Currency status</Text>
          <View style={styles.statsRow}>
            <View style={styles.statsCard}>
              <Text style={styles.statsLabel}>Total landings</Text>
              <Text style={styles.statsValue}>{summary?.currency?.totalLandings ?? 0}</Text>
              <Text style={styles.statsMeta}>Due {formatDate(summary?.currency?.dayCurrencyDueAt)}</Text>
            </View>
            <View style={styles.statsCard}>
              <Text style={styles.statsLabel}>Night landings</Text>
              <Text style={styles.statsValue}>{summary?.currency?.landingsNight ?? 0}</Text>
              <Text style={styles.statsMeta}>Due {formatDate(summary?.currency?.nightCurrencyDueAt)}</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statsCard}>
              <Text style={styles.statsLabel}>IFR currency</Text>
              <Text style={styles.statsValue}>{summary?.currency?.instrumentTotal ?? 0}</Text>
              <Text style={styles.statsMeta}>Due {formatDate(summary?.currency?.instrumentDueAt)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expiration tracking</Text>
          <Text style={styles.helperText}>Alerts go out 30 days before due.</Text>

          <Text style={styles.label}>Medical Class</Text>
          <TextInput
            style={styles.input}
            value={proForm.medicalClass}
            onChangeText={(value) => setProForm((prev) => ({ ...prev, medicalClass: value }))}
            placeholder="Class 1/2/3"
          />

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Medical Issued</Text>
              <TextInput
                style={styles.input}
                value={proForm.medicalIssuedAt}
                onChangeText={(value) => setProForm((prev) => ({ ...prev, medicalIssuedAt: value }))}
                placeholder="2026-01-20"
              />
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Medical Expires</Text>
              <TextInput
                style={styles.input}
                value={proForm.medicalExpiresAt}
                onChangeText={(value) => setProForm((prev) => ({ ...prev, medicalExpiresAt: value }))}
                placeholder="2027-01-20"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Flight Review Date</Text>
              <TextInput
                style={styles.input}
                value={proForm.flightReviewDate}
                onChangeText={(value) => setProForm((prev) => ({ ...prev, flightReviewDate: value }))}
                placeholder="2026-05-12"
              />
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.label}>IPC Date</Text>
              <TextInput
                style={styles.input}
                value={proForm.ipcDate}
                onChangeText={(value) => setProForm((prev) => ({ ...prev, ipcDate: value }))}
                placeholder="2026-09-01"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleSaveSettings} disabled={savingSettings}>
            <Text style={styles.primaryButtonText}>{savingSettings ? 'Saving...' : 'Save Expiration Dates'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alert preferences</Text>
          <Text style={styles.helperText}>Choose how Logbook Pro notifies you.</Text>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Email alerts</Text>
              <Text style={styles.toggleSubtitle}>Get reminders by email.</Text>
            </View>
            <Switch value={prefs.emailEnabled} onValueChange={(value) => setPrefs((prev) => ({ ...prev, emailEnabled: value }))} />
          </View>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Push alerts</Text>
              <Text style={styles.toggleSubtitle}>Expo push notifications.</Text>
            </View>
            <Switch value={prefs.pushEnabled} onValueChange={(value) => setPrefs((prev) => ({ ...prev, pushEnabled: value }))} />
          </View>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>In-app alerts</Text>
              <Text style={styles.toggleSubtitle}>Show in notification list.</Text>
            </View>
            <Switch value={prefs.inAppEnabled} onValueChange={(value) => setPrefs((prev) => ({ ...prev, inAppEnabled: value }))} />
          </View>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleSavePrefs} disabled={savingPrefs}>
            <Text style={styles.secondaryButtonText}>{savingPrefs ? 'Saving...' : 'Save Preferences'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pro tools</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Endorsements')}>
            <Text style={styles.secondaryButtonText}>Manage Endorsements</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Notifications')}>
            <Text style={styles.secondaryButtonText}>View Alerts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('RadioCommsTrainer')}>
            <Text style={styles.secondaryButtonText}>Radio Comms Trainer</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Logbook Pro</Text>
        <Text style={styles.subtitle}>
          Advanced flight planning, radio comms training, and premium logbook tools.
        </Text>
      </View>

      <View style={styles.featureList}>
        {[
          'Advanced flight planning with aircraft profiles and route risk flags.',
          'Saved plans, per-leg breakdowns, and unlimited route storage.',
          'Radio Comms Trainer: full scenarios, audio practice, and scoring feedback.',
          'Pro currency tools, exports, and priority support.',
        ].map((item) => (
          <View key={item} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text style={styles.featureText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.planGrid}>
        {PLANS.map((p) => {
          const isSelected = p.key === selectedPlan;
          const pTax = p.price * SALES_TAX_RATE;
          const pTotal = p.price + pTax;
          return (
            <TouchableOpacity
              key={p.key}
              style={[styles.planCard, isSelected && styles.planCardActive]}
              onPress={() => setSelectedPlan(p.key)}
            >
              <Text style={styles.planLabel}>{p.label}</Text>
              <Text style={styles.planPrice}>${p.price.toFixed(2)}</Text>
              <Text style={styles.planMeta}>+ tax ${pTax.toFixed(2)} = ${pTotal.toFixed(2)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total today</Text>
        <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleSubscribe} disabled={loading}>
        <Text style={styles.primaryButtonText}>{loading ? 'Redirecting...' : 'Upgrade with PayPal'}</Text>
      </TouchableOpacity>

      {user?.logbookProStatus && (
        <Text style={styles.statusText}>Current status: {user.logbookProStatus}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  header: { marginBottom: spacing.md },
  title: { ...typography.h2 },
  subtitle: { marginTop: spacing.xs, color: colors.textMuted },
  section: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  sectionTitle: { ...typography.h3, marginBottom: spacing.xs },
  helperText: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  label: { fontSize: 12, fontWeight: '600', color: colors.text, marginTop: spacing.sm, marginBottom: 4 },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  rowItem: { flex: 1 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  statsCard: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsLabel: { fontSize: 12, color: colors.textMuted },
  statsValue: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 4 },
  statsMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  toggleTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  toggleSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  secondaryButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  secondaryButtonText: { color: colors.text, fontWeight: '600' },
  featureList: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  featureText: { flex: 1, fontSize: 13, color: colors.text },
  planGrid: { gap: 10 },
  planCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  planCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  planLabel: { fontSize: 13, color: colors.textMuted },
  planPrice: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 4 },
  planMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  totalLabel: { fontSize: 14, color: colors.textMuted },
  totalValue: { fontSize: 16, fontWeight: '600', color: colors.text },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.md, ...shadow.card },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  statusText: { marginTop: spacing.sm, fontSize: 12, color: colors.textMuted },
});
