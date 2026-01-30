import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

const receivers = [
  {
    name: 'Stratux',
    steps: [
      'Power on the Stratux and wait for the Wi-Fi to broadcast.',
      'Connect your phone to the Stratux Wi-Fi network.',
      'Set ADS-B port to 4000 (default) or 49002 if configured.',
      'Toggle Live Traffic in the Flight Planner map.',
    ],
  },
  {
    name: 'Sentry / Stratus',
    steps: [
      'Turn on your Sentry/Stratus and connect to its Wi-Fi.',
      'Confirm GDL-90 output is enabled (default for most devices).',
      'Use port 4000 if unsure.',
    ],
  },
  {
    name: 'Garmin GDL',
    steps: [
      'Connect to the Garmin GDL Wi-Fi network.',
      'Use port 4000 or 49002 depending on configuration.',
      'Enable Live Traffic toggle to begin listening.',
    ],
  },
  {
    name: 'uAvionix SkyEcho',
    steps: [
      'Connect to the SkyEcho Wi-Fi.',
      'Ensure traffic output is enabled.',
      'Use port 4000 unless configured otherwise.',
    ],
  },
];

export default function ReceiverHelpScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>ADS-B Receiver Setup</Text>
      <Text style={styles.subtitle}>Connect your portable ADS-B receiver to view live traffic.</Text>

      <View style={styles.disclaimer}>
        <Ionicons name="alert-circle-outline" size={18} color={colors.primary} />
        <Text style={styles.disclaimerText}>
          Live traffic is for situational awareness only. Always use official avionics and ATC guidance.
        </Text>
      </View>

      {receivers.map((receiver) => (
        <View key={receiver.name} style={styles.card}>
          <Text style={styles.cardTitle}>{receiver.name}</Text>
          {receiver.steps.map((step) => (
            <View key={step} style={styles.stepRow}>
              <Text style={styles.stepBullet}>*</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      ))}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Troubleshooting</Text>
        <Text style={styles.stepText}>* Make sure your phone is on the receiver's Wi-Fi network.</Text>
        <Text style={styles.stepText}>* Try ports 4000 or 49002.</Text>
        <Text style={styles.stepText}>* Confirm the receiver has GPS lock and is receiving ADS-B.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  title: { ...typography.h2 },
  subtitle: { color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  disclaimerText: { flex: 1, fontSize: 12, color: colors.primary },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  stepRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  stepBullet: { fontSize: 14, color: colors.textMuted },
  stepText: { flex: 1, fontSize: 13, color: colors.textMuted },
});
