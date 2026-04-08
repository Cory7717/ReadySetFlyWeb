import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';
import { extractApiErrorMessage, logDiagnostic } from '../utils/diagnostics';

type LogbookEntry = {
  id: string;
  flightDate: string;
  tailNumber?: string | null;
  aircraftType?: string | null;
  route?: string | null;
  timeDay?: string | number;
  timeNight?: string | number;
};

function formatRecentDate(value?: string | null) {
  if (!value) return 'No entries yet';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

export default function LogbookScreen({ navigation }: any) {
  const { isAuthenticated, user } = useIsAuthenticated();
  const entitlements = (user as any)?.entitlements;
  const isPro = entitlements?.canUseLogbook ?? (user?.logbookProStatus === 'active');
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const totalDay = entries.reduce((sum, entry) => sum + (Number(entry.timeDay) || 0), 0);
  const totalNight = entries.reduce((sum, entry) => sum + (Number(entry.timeNight) || 0), 0);
  const totalTime = totalDay + totalNight;
  const recentEntry = entries[0] || null;
  const routeCount = useMemo(
    () => new Set(entries.map((entry) => entry.route).filter(Boolean)).size,
    [entries]
  );

  const loadEntries = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await api.get('/api/logbook');
      setEntries(res.data || []);
      logDiagnostic('logbook', 'entries_loaded', {
        count: Array.isArray(res.data) ? res.data.length : 0,
        userId: user?.id,
      });
    } catch (error: any) {
      Alert.alert('Logbook', extractApiErrorMessage(error, 'Unable to load logbook entries.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <View style={styles.lockedScreen}>
        <View style={styles.lockedPanel}>
          <Ionicons name="lock-closed-outline" size={34} color={colors.textSoft} />
          <Text style={styles.lockedTitle}>Sign in to access your logbook.</Text>
          <Text style={styles.lockedText}>
            Keep flight time, routes, aircraft usage, and RSF Pro history in one place.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Auth')}
            activeOpacity={0.92}
          >
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>DIGITAL LOGBOOK</Text>
            <Text style={styles.heroTitle}>Your flight history, currency, and member workflows in one place.</Text>
            <Text style={styles.heroSubtitle}>
              Built for active pilots who want quick scanning today and deeper records over time.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{isPro ? 'Pro active' : 'Free'}</Text>
          </View>
        </View>

        <View style={styles.heroMetricRow}>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricLabel}>Total time</Text>
            <Text style={styles.heroMetricValue}>{totalTime.toFixed(1)} hrs</Text>
          </View>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricLabel}>Entries</Text>
            <Text style={styles.heroMetricValue}>{entries.length}</Text>
          </View>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricLabel}>Recent</Text>
            <Text style={styles.heroMetricValue}>{formatRecentDate(recentEntry?.flightDate)}</Text>
          </View>
        </View>

        <View style={styles.heroMetricRow}>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricLabel}>Day</Text>
            <Text style={styles.heroMetricValue}>{totalDay.toFixed(1)} hrs</Text>
          </View>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricLabel}>Night</Text>
            <Text style={styles.heroMetricValue}>{totalNight.toFixed(1)} hrs</Text>
          </View>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricLabel}>Routes tracked</Text>
            <Text style={styles.heroMetricValue}>{routeCount}</Text>
          </View>
        </View>

        <View style={styles.heroActionRow}>
          <TouchableOpacity
            style={styles.heroPrimaryAction}
            onPress={() => navigation.navigate('LogbookEntry')}
            activeOpacity={0.92}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.heroPrimaryActionText}>New entry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.heroSecondaryAction}
            onPress={loadEntries}
            activeOpacity={0.92}
          >
            <Ionicons name="refresh" size={16} color={colors.text} />
            <Text style={styles.heroSecondaryActionText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.memberPanel}>
          <View style={styles.memberHeader}>
            <View>
              <Text style={styles.memberEyebrow}>RSF PRO</Text>
              <Text style={styles.memberTitle}>
                {isPro ? 'Your member logbook tools are active.' : 'Unlock currency alerts, endorsements, and advanced tracking.'}
              </Text>
            </View>
            <View style={styles.memberChip}>
              <Text style={styles.memberChipText}>{isPro ? 'ACTIVE' : 'UPGRADE'}</Text>
            </View>
          </View>
          <Text style={styles.memberText}>
            RSF Pro adds a more complete pilot workspace around the logbook, including member dashboards and deeper recurrent workflows.
          </Text>
          <TouchableOpacity
            style={styles.memberButton}
            onPress={() => navigation.navigate('LogbookPro')}
            activeOpacity={0.92}
          >
            <Text style={styles.memberButtonText}>
              {isPro ? 'Open Member Dashboard' : 'View Membership'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Entries</Text>
          <Text style={styles.sectionSubtitle}>Quick access to the flights you’re most likely to edit or review.</Text>
        </View>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading logbook entries...</Text>
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={30} color={colors.textSoft} />
            <Text style={styles.emptyTitle}>No logbook entries yet.</Text>
            <Text style={styles.emptyText}>Start with your first flight entry and build history from there.</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('LogbookEntry')}
              activeOpacity={0.92}
            >
              <Text style={styles.primaryButtonText}>Create First Entry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.entriesList}>
            {entries.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.entryCard}
                onPress={() => navigation.navigate('LogbookEntry', { entryId: item.id })}
                activeOpacity={0.92}
              >
                <View style={styles.entryTopRow}>
                  <View>
                    <Text style={styles.entryDate}>{item.flightDate}</Text>
                    <Text style={styles.entryAircraft}>
                      {item.tailNumber || 'N/A'} • {item.aircraftType || 'Aircraft'}
                    </Text>
                  </View>
                  <View style={styles.entryHoursChip}>
                    <Text style={styles.entryHoursChipText}>
                      {(Number(item.timeDay) || 0) + (Number(item.timeNight) || 0)} hrs
                    </Text>
                  </View>
                </View>
                {item.route ? <Text style={styles.entryRoute}>{item.route}</Text> : null}
                <View style={styles.entryMetaRow}>
                  <Text style={styles.entryMeta}>Day {Number(item.timeDay || 0).toFixed(1)}</Text>
                  <Text style={styles.entryMeta}>Night {Number(item.timeNight || 0).toFixed(1)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.sm, paddingBottom: 120 },
  lockedScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  lockedPanel: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  lockedTitle: {
    ...typography.h2,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  lockedText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  heroPanel: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.cockpit,
    ...shadow.floating,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#93c5fd',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#fff',
    marginTop: 10,
    maxWidth: 310,
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
    maxWidth: 330,
  },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  heroMetricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroMetricCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroMetricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#bfdbfe',
    textTransform: 'uppercase',
  },
  heroMetricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginTop: 6,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroPrimaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.lg,
    paddingVertical: 14,
    backgroundColor: colors.accent,
  },
  heroPrimaryActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  heroSecondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  heroSecondaryActionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h2,
  },
  sectionSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
  memberPanel: {
    backgroundColor: colors.surfaceTinted,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  memberEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  memberTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginTop: 8,
    maxWidth: 260,
  },
  memberChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  memberChipText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  memberText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  memberButton: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  memberButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  loadingState: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    ...shadow.card,
  },
  loadingText: {
    ...typography.muted,
    marginTop: spacing.sm,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    ...shadow.card,
  },
  emptyTitle: {
    ...typography.h3,
    marginTop: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  entriesList: {
    gap: spacing.sm,
  },
  entryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  entryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  entryDate: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  entryAircraft: {
    ...typography.muted,
    marginTop: 4,
  },
  entryHoursChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  entryHoursChipText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  entryRoute: {
    fontSize: 13,
    color: colors.text,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  entryMetaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  entryMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
