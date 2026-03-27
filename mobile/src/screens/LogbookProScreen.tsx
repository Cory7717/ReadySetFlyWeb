import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';
import { membershipPlanOptions, membershipTierInfo, type MembershipInterval, type MembershipTier } from '@shared/membership-plans';

function formatDate(value?: string | null) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString();
  } catch (error) {
    return value;
  }
}

export default function LogbookProScreen({ navigation }: any) {
  const { isAuthenticated, user } = useIsAuthenticated();
  const [selectedTier, setSelectedTier] = useState<MembershipTier>('pro');
  const [selectedInterval, setSelectedInterval] = useState<MembershipInterval>('annual');
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
  const entitlements = (user as any)?.entitlements;
  const hasAccess = entitlements?.tier ? entitlements.tier !== 'free' : user?.logbookProStatus === 'active';
  const membershipStatus = (user as any)?.membershipStatus;
  const membershipTrialEndsAt = (user as any)?.membershipTrialEndsAt;
  const membershipInterval = (user as any)?.membershipInterval;
  const isTrialing = membershipStatus === 'trialing';

  const loadProData = async () => {
    if (!isAuthenticated || !hasAccess) return;
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
      Alert.alert('RSF Pro', error?.response?.data?.error || 'Unable to load RSF Pro data.');
    }
  };

  useEffect(() => {
    loadProData();
  }, [isAuthenticated, hasAccess]);

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
      Alert.alert('Saved', 'RSF Pro settings updated.');
    } catch (error: any) {
      Alert.alert('Update failed', error?.response?.data?.error || 'Unable to save RSF Pro settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const planOptions = membershipPlanOptions[selectedTier];
  const selectedPlan = useMemo(
    () => planOptions.find((plan) => plan.interval === selectedInterval) || planOptions[0],
    [planOptions, selectedInterval]
  );
  const hasTrial = Boolean(selectedPlan?.trialDays);
  const selectedPlanTotal = hasTrial ? 0 : selectedPlan.price;

  if (isAuthenticated && hasAccess) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>RSF Pro Dashboard</Text>
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
          <Text style={styles.helperText}>Choose how RSF Pro notifies you.</Text>

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
        <Text style={styles.title}>RSF Pro</Text>
        <Text style={styles.subtitle}>
          Use this screen to review Pro tiers and confirm whether your existing membership is active in the app.
        </Text>
      </View>

      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerTitle}>Memberships sync into the app</Text>
        <Text style={styles.infoBannerText}>
          If you already subscribed to RSF elsewhere, sign in with the same account and your access should appear here automatically.
        </Text>
        <Text style={styles.infoBannerText}>
          This app does not launch an external checkout flow. Billing stays managed on the platform where the membership was started.
        </Text>
      </View>

      <View style={styles.featureList}>
        <Text style={styles.featureTitle}>
          Included with {membershipTierInfo[selectedTier].title}
        </Text>
        {membershipTierInfo[selectedTier].features.map((item) => (
          <View key={item} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text style={styles.featureText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.tierGrid}>
        {(Object.keys(membershipTierInfo) as MembershipTier[]).map((tier) => {
          const isSelected = tier === selectedTier;
          const monthly = membershipPlanOptions[tier].find((plan) => plan.interval === 'monthly')?.price;
          return (
            <TouchableOpacity
              key={tier}
              style={[styles.tierCard, isSelected && styles.tierCardActive]}
              onPress={() => setSelectedTier(tier)}
            >
              <Text style={styles.tierTitle}>{membershipTierInfo[tier].title}</Text>
              <Text style={styles.tierSubtitle}>{membershipTierInfo[tier].subtitle}</Text>
              {monthly !== undefined && (
                <Text style={styles.tierPrice}>From ${monthly.toFixed(2)}/mo</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.planGrid}>
        {planOptions.map((plan) => {
          const isSelected = plan.interval === selectedInterval;
          return (
            <TouchableOpacity
              key={plan.interval}
              style={[styles.planCard, isSelected && styles.planCardActive]}
              onPress={() => setSelectedInterval(plan.interval)}
            >
              <View style={styles.planRow}>
                <Text style={styles.planLabel}>{plan.label}</Text>
                {plan.badge && <Text style={styles.planBadge}>{plan.badge}</Text>}
              </View>
              <Text style={styles.planPrice}>${plan.price.toFixed(2)}</Text>
              <Text style={styles.planSubtitle}>{membershipTierInfo[selectedTier].subtitle}</Text>
              {plan.trialDays && (
                <Text style={styles.trialText}>{plan.trialDays}-day free trial</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Sample {selectedInterval} price</Text>
        <Text style={styles.totalValue}>${selectedPlanTotal.toFixed(2)}</Text>
      </View>

      <View style={styles.membershipStatusCard}>
        <Text style={styles.membershipStatusTitle}>App membership status</Text>
        <Text style={styles.membershipStatusText}>
          {!isAuthenticated
            ? 'Sign in to see whether this account already has RSF Pro access.'
            : hasAccess
              ? 'Your signed-in account currently has RSF membership access in the app.'
              : 'No active RSF membership is currently attached to this signed-in account.'}
        </Text>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            if (!isAuthenticated) {
              navigation.navigate('Auth');
              return;
            }
            navigation.navigate('ProfileHome');
          }}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>
            {!isAuthenticated ? 'Sign in to check access' : 'Return to profile'}
          </Text>
        </TouchableOpacity>
      </View>

      {membershipStatus && (
        <Text style={styles.statusText}>Current status: {membershipStatus}</Text>
      )}
      {isTrialing && membershipTrialEndsAt && (
        <Text style={styles.statusText}>Trial ends {formatDate(membershipTrialEndsAt)}</Text>
      )}
      {membershipInterval && hasAccess && (
        <Text style={styles.statusText}>Billing cadence: {membershipInterval}</Text>
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
  infoBanner: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  infoBannerTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 6 },
  infoBannerText: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  featureList: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  featureTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  featureText: { flex: 1, fontSize: 13, color: colors.text },
  tierGrid: { gap: 10, marginBottom: spacing.md },
  tierCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  tierCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  tierTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  tierSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  tierPrice: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  planGrid: { gap: 10 },
  planCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  planCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planLabel: { fontSize: 13, color: colors.textMuted },
  planPrice: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 4 },
  planSubtitle: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  planBadge: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  trialText: { fontSize: 11, color: '#10b981', marginTop: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  totalLabel: { fontSize: 14, color: colors.textMuted },
  totalValue: { fontSize: 16, fontWeight: '600', color: colors.text },
  membershipStatusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
    ...shadow.card,
  },
  membershipStatusTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 6 },
  membershipStatusText: { fontSize: 13, color: colors.textMuted },
  statusText: { marginTop: spacing.sm, fontSize: 12, color: colors.textMuted },
});
