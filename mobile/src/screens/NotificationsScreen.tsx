import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

export default function NotificationsScreen() {
  const { isAuthenticated, user } = useIsAuthenticated();
  const isPro = user?.logbookProStatus === 'active';
  const [prefs, setPrefs] = useState({
    emailEnabled: true,
    pushEnabled: true,
    inAppEnabled: true,
    alertDaysBefore: 30,
  });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
    } catch (error) {
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
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.subtitle}>Logbook Pro alerts and device notification settings.</Text>

      {isAuthenticated && isPro ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Logbook Pro Alerts</Text>
          <Text style={styles.sectionSubtitle}>Alerts go out 30 days before due.</Text>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Email alerts</Text>
              <Text style={styles.rowSubtitle}>Get reminders by email.</Text>
            </View>
            <Switch value={prefs.emailEnabled} onValueChange={(value) => setPrefs((prev) => ({ ...prev, emailEnabled: value }))} />
          </View>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Push alerts</Text>
              <Text style={styles.rowSubtitle}>Expo push notifications.</Text>
            </View>
            <Switch value={prefs.pushEnabled} onValueChange={(value) => setPrefs((prev) => ({ ...prev, pushEnabled: value }))} />
          </View>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>In-app alerts</Text>
              <Text style={styles.rowSubtitle}>Show in notification list.</Text>
            </View>
            <Switch value={prefs.inAppEnabled} onValueChange={(value) => setPrefs((prev) => ({ ...prev, inAppEnabled: value }))} />
          </View>
          <TouchableOpacity style={styles.saveButton} onPress={handleSavePrefs} disabled={loading}>
            <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save Preferences'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.rowTitle}>Logbook Pro Alerts</Text>
          <Text style={styles.rowSubtitle}>Upgrade to Logbook Pro to receive currency and expiration alerts.</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Alert History</Text>
        {loading ? (
          <Text style={styles.rowSubtitle}>Loading notifications...</Text>
        ) : notifications.length === 0 ? (
          <Text style={styles.rowSubtitle}>Youâ€™re all caught up.</Text>
        ) : (
          notifications.map((notification) => (
            <View key={notification.id} style={styles.notificationItem}>
              <View style={styles.notificationHeader}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationDate}>
                  {notification.createdAt ? new Date(notification.createdAt).toLocaleDateString() : 'â€”'}
                </Text>
              </View>
              <Text style={styles.notificationBody}>{notification.message}</Text>
              <View style={styles.notificationActions}>
                {notification.referenceDate && (
                  <Text style={styles.notificationMeta}>Due {new Date(notification.referenceDate).toLocaleDateString()}</Text>
                )}
                {!notification.isRead && (
                  <TouchableOpacity style={styles.markReadButton} onPress={() => markRead(notification.id)}>
                    <Text style={styles.markReadText}>Mark read</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.settingsButton} onPress={handleOpenSettings}>
        <Ionicons name="settings-outline" size={18} color={colors.primary} />
        <Text style={styles.settingsButtonText}>Open device notification settings</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  title: { ...typography.h2 },
  subtitle: { color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: { flex: 1, marginRight: spacing.sm },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  rowSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  sectionSubtitle: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  saveButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '600' },
  notificationItem: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.sm },
  notificationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notificationTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  notificationDate: { fontSize: 11, color: colors.textMuted },
  notificationBody: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  notificationActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  notificationMeta: { fontSize: 11, color: colors.textMuted },
  markReadButton: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  markReadText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  settingsButton: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  settingsButtonText: { color: colors.primary, fontWeight: '600' },
});
