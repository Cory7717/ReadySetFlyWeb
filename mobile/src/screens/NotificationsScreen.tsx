import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

export default function NotificationsScreen() {
  const { isAuthenticated, user } = useIsAuthenticated();
  const entitlements = (user as any)?.entitlements;
  const isPro = entitlements?.canUseAlerts ?? user?.logbookProStatus === 'active';
  const [prefs, setPrefs] = useState({
    emailEnabled: true,
    pushEnabled: true,
    inAppEnabled: true,
    alertDaysBefore: 30,
  });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const loadData = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [notifRes, prefsRes] = await Promise.all([
        api.get('/api/notifications'),
        isPro ? api.get('/api/notifications/preferences') : Promise.resolve({ data: null }),
      ]);
      setNotifications(notifRes.data || []);
      if (prefsRes.data) {
        setPrefs({
          emailEnabled: prefsRes.data.emailEnabled ?? true,
          pushEnabled: prefsRes.data.pushEnabled ?? true,
          inAppEnabled: prefsRes.data.inAppEnabled ?? true,
          alertDaysBefore: prefsRes.data.alertDaysBefore ?? 30,
        });
      }
    } catch (error: any) {
      Alert.alert('Notifications', error?.response?.data?.error || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAuthenticated, isPro]);

  const handleOpenSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert('Unable to open settings', 'Please open your device settings to manage notifications.');
    }
  };

  const handleSavePrefs = async () => {
    if (!isPro) return;
    setLoading(true);
    try {
      await api.put('/api/notifications/preferences', prefs);
      Alert.alert('Saved', 'Preferences updated.');
    } catch (error: any) {
      Alert.alert('Update failed', error?.response?.data?.error || 'Unable to save preferences.');
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: string) => {
    try {
      await api.patch(`/api/notifications/${id}/read`, {});
      await loadData();
    } catch (error: any) {
      Alert.alert('Update failed', error?.response?.data?.error || 'Unable to mark as read.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="notifications-outline" size={34} color="#fcd34d" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>ALERT CENTER</Text>
            <Text style={styles.heroTitle}>Stay ahead of upcoming currency and due dates.</Text>
            <Text style={styles.heroSubtitle}>
              RSF combines in-app, email, and push alerts so pilots can keep training, documents, and member actions in view.
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile label="Unread" value={String(unreadCount)} />
          <SummaryTile label="History" value={String(notifications.length)} />
          <SummaryTile label="Alerts" value={isPro ? 'Pro active' : 'Upgrade'} />
        </View>
      </View>

      {isAuthenticated && isPro ? (
        <SectionCard
          title="RSF Pro alert preferences"
          subtitle={`Alerts are currently set to go out ${prefs.alertDaysBefore} days before due dates.`}
        >
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Email alerts</Text>
              <Text style={styles.toggleSubtitle}>Get reminders by email.</Text>
            </View>
            <Switch
              value={prefs.emailEnabled}
              onValueChange={(value) => setPrefs((prev) => ({ ...prev, emailEnabled: value }))}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Push alerts</Text>
              <Text style={styles.toggleSubtitle}>Use device notifications when supported.</Text>
            </View>
            <Switch
              value={prefs.pushEnabled}
              onValueChange={(value) => setPrefs((prev) => ({ ...prev, pushEnabled: value }))}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>In-app alerts</Text>
              <Text style={styles.toggleSubtitle}>Show reminders inside the notification center.</Text>
            </View>
            <Switch
              value={prefs.inAppEnabled}
              onValueChange={(value) => setPrefs((prev) => ({ ...prev, inAppEnabled: value }))}
            />
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSavePrefs}
            disabled={loading}
            activeOpacity={0.92}
          >
            <Text style={styles.primaryButtonText}>{loading ? 'Saving...' : 'Save preferences'}</Text>
          </TouchableOpacity>
        </SectionCard>
      ) : (
        <SectionCard
          title="RSF Pro alerts"
          subtitle="Currency and expiration reminders are part of the RSF Pro and Pro+ workflow."
        >
          <Text style={styles.upgradeCopy}>
            Upgrade to RSF Pro or Pro+ to unlock currency reminders, due-date alerts, and a more complete member notification loop.
          </Text>
        </SectionCard>
      )}

      <SectionCard
        title="Alert history"
        subtitle="Review what RSF has already surfaced and clear items once they have been handled."
      >
        {loading ? (
          <Text style={styles.loadingText}>Loading notifications...</Text>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={28} color={colors.textSoft} />
            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.emptyText}>No active alerts or reminders are waiting for review.</Text>
          </View>
        ) : (
          notifications.map((notification) => (
            <View key={notification.id} style={styles.notificationCard}>
              <View style={styles.notificationHeader}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationDate}>
                  {notification.createdAt
                    ? new Date(notification.createdAt).toLocaleDateString()
                    : '—'}
                </Text>
              </View>
              <Text style={styles.notificationBody}>{notification.message}</Text>
              <View style={styles.notificationActions}>
                {notification.referenceDate ? (
                  <Text style={styles.notificationMeta}>
                    Due {new Date(notification.referenceDate).toLocaleDateString()}
                  </Text>
                ) : (
                  <View />
                )}
                {!notification.isRead ? (
                  <TouchableOpacity
                    style={styles.markReadButton}
                    onPress={() => markRead(notification.id)}
                    activeOpacity={0.92}
                  >
                    <Text style={styles.markReadText}>Mark read</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))
        )}
      </SectionCard>

      <TouchableOpacity style={styles.settingsButton} onPress={handleOpenSettings} activeOpacity={0.92}>
        <Ionicons name="settings-outline" size={18} color={colors.primary} />
        <Text style={styles.settingsButtonText}>Open device notification settings</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.sm,
    paddingBottom: 120,
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
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  heroIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#fde68a',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#fff',
    marginTop: 10,
    maxWidth: 320,
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
    maxWidth: 340,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  summaryTile: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#fde68a',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginTop: 6,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  sectionTitle: {
    ...typography.h2,
  },
  sectionSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
  sectionContent: {
    marginTop: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleCopy: {
    flex: 1,
    marginRight: spacing.sm,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  toggleSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  primaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  upgradeCopy: {
    ...typography.body,
    color: colors.textMuted,
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  notificationCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  notificationDate: {
    fontSize: 11,
    color: colors.textSoft,
  },
  notificationBody: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 18,
  },
  notificationActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  notificationMeta: {
    fontSize: 11,
    color: colors.textSoft,
  },
  markReadButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  markReadText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '800',
  },
  settingsButton: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  settingsButtonText: {
    color: colors.primary,
    fontWeight: '800',
  },
});
