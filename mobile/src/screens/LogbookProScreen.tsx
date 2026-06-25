import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import FormDateTimeField from '../components/FormDateTimeField';
import { useIsAuthenticated } from '../utils/auth';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';
import { membershipPlanOptions, membershipTierInfo, type MembershipInterval, type MembershipTier } from '@shared/membership-plans';
import {
  getCurrentOfferingSafe,
  getCustomerInfoSafe,
  getPurchasesRuntimeStatus,
  purchasePackageSafe,
  restorePurchasesSafe,
  selectOfferingPackage,
} from '../services/purchases';
import { extractApiErrorMessage } from '../utils/diagnostics';

function formatDate(value?: string | null) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString();
  } catch (error) {
    return value;
  }
}

function toDateOnlyValue(value?: string | null) {
  return value ? String(value).slice(0, 10) : '';
}

export default function LogbookProScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useIsAuthenticated();
  const [selectedTier, setSelectedTier] = useState<MembershipTier>('premium');
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
  const [offeringAvailable, setOfferingAvailable] = useState(false);
  const [purchaseReady, setPurchaseReady] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [purchaseStatusMessage, setPurchaseStatusMessage] = useState<string | null>(() => getPurchasesRuntimeStatus().message);
  const [canMakeRealPurchases, setCanMakeRealPurchases] = useState(() => getPurchasesRuntimeStatus().canMakeRealPurchases);
  const [matchedPackageLabel, setMatchedPackageLabel] = useState<string | null>(null);
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
          medicalIssuedAt: toDateOnlyValue(summaryRes.data.settings.medicalIssuedAt),
          medicalExpiresAt: toDateOnlyValue(summaryRes.data.settings.medicalExpiresAt),
          flightReviewDate: toDateOnlyValue(summaryRes.data.settings.flightReviewDate),
          ipcDate: toDateOnlyValue(summaryRes.data.settings.ipcDate),
        });
      }
    } catch (error: any) {
      Alert.alert('RSF Pro', extractApiErrorMessage(error, 'Unable to load RSF Pro data.'));
    }
  };

  useEffect(() => {
    loadProData();
  }, [isAuthenticated, hasAccess]);

  useEffect(() => {
    let cancelled = false;
    const loadPurchases = async () => {
      const runtimeStatus = getPurchasesRuntimeStatus();
      if (cancelled) return;
      setPurchaseStatusMessage(runtimeStatus.message);
      setCanMakeRealPurchases(runtimeStatus.canMakeRealPurchases);
      if (!runtimeStatus.enabled) {
        setOfferingAvailable(false);
        setPurchaseReady(false);
        setMatchedPackageLabel(null);
        return;
      }
      try {
        const [offering, customerInfo] = await Promise.all([
          getCurrentOfferingSafe(),
          getCustomerInfoSafe(),
        ]);
        if (cancelled) return;
        const selectedPackage = selectOfferingPackage(offering, selectedTier, selectedInterval);
        setOfferingAvailable(Boolean(offering));
        setPurchaseReady(Boolean(selectedPackage));
        setMatchedPackageLabel(
          selectedPackage ? `${selectedPackage.identifier} / ${selectedPackage.product.identifier}` : null
        );
        setPurchaseStatusMessage(
          runtimeStatus.message ||
            (!offering
              ? 'RevenueCat is configured, but the current offering is empty for this build.'
              : !selectedPackage
                ? 'RevenueCat offering loaded, but no package matched the selected tier and billing interval.'
                : null)
        );
        if (!hasAccess && customerInfo?.entitlements?.active) {
          // RevenueCat is configured and the store account already has active entitlements.
          // The backend sync layer will still be the source of truth; this is only a UI hint.
        }
      } catch {
        if (cancelled) return;
        setOfferingAvailable(false);
        setPurchaseReady(false);
        setMatchedPackageLabel(null);
        setPurchaseStatusMessage('RevenueCat could not load offerings for this build right now.');
      }
    };
    loadPurchases();
    return () => {
      cancelled = true;
    };
  }, [selectedInterval, selectedTier, hasAccess]);

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    try {
      await api.put('/api/notifications/preferences', prefs);
      Alert.alert('Saved', 'Notification preferences updated.');
    } catch (error: any) {
      Alert.alert('Update failed', extractApiErrorMessage(error, 'Unable to save preferences.'));
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
      Alert.alert('Update failed', extractApiErrorMessage(error, 'Unable to save RSF Pro settings.'));
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

  const handleStartInAppSubscription = async () => {
    setLoading(true);
    try {
      const offering = await getCurrentOfferingSafe();
      const selectedPackage = selectOfferingPackage(offering, selectedTier, selectedInterval);
      if (!selectedPackage) {
        throw new Error('No matching in-app package is configured for this plan yet.');
      }
      await purchasePackageSafe(selectedPackage);
      await queryClient.invalidateQueries({ queryKey: ['/api/mobile/auth/me'] });
      Alert.alert(
        'Purchase submitted',
        'Your in-app subscription was submitted and RSF is refreshing your membership access now.'
      );
    } catch (error: any) {
      Alert.alert('Subscription error', error?.message || 'Unable to start the in-app subscription.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestorePurchases = async () => {
    setRestoring(true);
    try {
      await restorePurchasesSafe();
      await queryClient.invalidateQueries({ queryKey: ['/api/mobile/auth/me'] });
      Alert.alert('Restore complete', 'Any eligible App Store or Google Play purchases were restored and synced to RSF.');
    } catch (error: any) {
      Alert.alert('Restore failed', error?.message || 'Unable to restore purchases right now.');
    } finally {
      setRestoring(false);
    }
  };

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
              <FormDateTimeField
                label="Medical Issued"
                value={proForm.medicalIssuedAt}
                onChangeText={(value) => setProForm((prev) => ({ ...prev, medicalIssuedAt: value }))}
                placeholder="Select issue date"
                mode="date"
                style={styles.fieldWrapper}
              />
            </View>
            <View style={styles.rowItem}>
              <FormDateTimeField
                label="Medical Expires"
                value={proForm.medicalExpiresAt}
                onChangeText={(value) => setProForm((prev) => ({ ...prev, medicalExpiresAt: value }))}
                placeholder="Select expiration date"
                mode="date"
                optional
                style={styles.fieldWrapper}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <FormDateTimeField
                label="Flight Review Date"
                value={proForm.flightReviewDate}
                onChangeText={(value) => setProForm((prev) => ({ ...prev, flightReviewDate: value }))}
                placeholder="Select flight review date"
                mode="date"
                optional
                style={styles.fieldWrapper}
              />
            </View>
            <View style={styles.rowItem}>
              <FormDateTimeField
                label="IPC Date"
                value={proForm.ipcDate}
                onChangeText={(value) => setProForm((prev) => ({ ...prev, ipcDate: value }))}
                placeholder="Select IPC date"
                mode="date"
                optional
                style={styles.fieldWrapper}
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
          In-app subscriptions are now the intended mobile billing path. Web-bought memberships should still sync after sign-in.
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
        <TouchableOpacity
          style={[styles.primaryButton, (!purchaseReady || !isAuthenticated || loading || !canMakeRealPurchases) && styles.primaryButtonDisabled]}
          onPress={handleStartInAppSubscription}
          disabled={!purchaseReady || !isAuthenticated || loading || !canMakeRealPurchases}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? 'Starting subscription...' : 'Subscribe in app'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleRestorePurchases}
          disabled={restoring || !canMakeRealPurchases}
        >
          <Text style={styles.secondaryButtonText}>
            {restoring ? 'Restoring...' : 'Restore purchases'}
          </Text>
        </TouchableOpacity>
        {purchaseStatusMessage ? <Text style={styles.statusText}>{purchaseStatusMessage}</Text> : null}
        {!purchaseStatusMessage && !offeringAvailable ? (
          <Text style={styles.statusText}>RevenueCat offerings are not configured for this app build yet.</Text>
        ) : null}
        {!purchaseStatusMessage && offeringAvailable && !purchaseReady ? (
          <Text style={styles.statusText}>No in-app package matched the selected tier/interval yet.</Text>
        ) : null}
        {matchedPackageLabel ? (
          <Text style={styles.statusText}>Matched package: {matchedPackageLabel}</Text>
        ) : null}
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
  fieldWrapper: { marginTop: spacing.sm },
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
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primaryStrong,
    marginTop: spacing.sm,
  },
  primaryButtonText: { color: '#ffffff', fontWeight: '700' },
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
  primaryButtonDisabled: { opacity: 0.55 },
  statusText: { marginTop: spacing.sm, fontSize: 12, color: colors.textMuted },
});
