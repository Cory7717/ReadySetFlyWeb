import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

export default function NotificationsScreen() {
  const [rentalUpdates, setRentalUpdates] = useState(true);
  const [messageAlerts, setMessageAlerts] = useState(true);
  const [marketingUpdates, setMarketingUpdates] = useState(false);

  const handleOpenSettings = async () => {
    try {
      await Linking.openSettings();
    } catch (error) {
      Alert.alert('Unable to open settings', 'Please open your device settings to manage notifications.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.subtitle}>Manage what notifications you receive on this device.</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Rental updates</Text>
            <Text style={styles.rowSubtitle}>Approvals, reminders, and status changes.</Text>
          </View>
          <Switch value={rentalUpdates} onValueChange={setRentalUpdates} />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Message alerts</Text>
            <Text style={styles.rowSubtitle}>New messages from owners and renters.</Text>
          </View>
          <Switch value={messageAlerts} onValueChange={setMessageAlerts} />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Marketing updates</Text>
            <Text style={styles.rowSubtitle}>Tips, announcements, and offers.</Text>
          </View>
          <Switch value={marketingUpdates} onValueChange={setMarketingUpdates} />
        </View>
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
