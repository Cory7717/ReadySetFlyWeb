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
      'Turn on your Sentry or Stratus and connect to its Wi-Fi.',
      'Confirm GDL-90 output is enabled (default for most devices).',
      'Use port 4000 if unsure.',
    ],
  },
  {
    name: 'Garmin GDL',
    steps: [
      'Connect to the Garmin GDL Wi-Fi network.',
      'Use port 4000 or 49002 depending on configuration.',
      'Enable Live Traffic to begin listening.',
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

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export default function ReceiverHelpScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="radio-outline" size={34} color="#93c5fd" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>RECEIVER SETUP</Text>
            <Text style={styles.heroTitle}>Connect a portable ADS-B receiver to RSF.</Text>
            <Text style={styles.heroSubtitle}>
              Use this guide to connect common ADS-B receivers and feed live traffic into the Ready Set Fly cockpit workflow.
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile label="Popular types" value={String(receivers.length)} />
          <SummaryTile label="Common port" value="4000" />
          <SummaryTile label="Use case" value="Live traffic" />
        </View>
      </View>

      <View style={styles.disclaimer}>
        <Ionicons name="alert-circle-outline" size={18} color={colors.primary} />
        <Text style={styles.disclaimerText}>
          Live traffic is for situational awareness only. Always use official avionics and ATC guidance.
        </Text>
      </View>

      {receivers.map((receiver) => (
        <View key={receiver.name} style={styles.card}>
          <Text style={styles.cardTitle}>{receiver.name}</Text>
          {receiver.steps.map((step, index) => (
            <View key={step} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      ))}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Troubleshooting</Text>
        <View style={styles.stepRow}>
          <View style={styles.stepBadge}>
            <Ionicons name="wifi-outline" size={14} color={colors.primary} />
          </View>
          <Text style={styles.stepText}>Make sure your phone is on the receiver Wi-Fi network.</Text>
        </View>
        <View style={styles.stepRow}>
          <View style={styles.stepBadge}>
            <Ionicons name="git-network-outline" size={14} color={colors.primary} />
          </View>
          <Text style={styles.stepText}>Try ports 4000 or 49002 if traffic does not appear.</Text>
        </View>
        <View style={styles.stepRow}>
          <View style={styles.stepBadge}>
            <Ionicons name="locate-outline" size={14} color={colors.primary} />
          </View>
          <Text style={styles.stepText}>Confirm the receiver has GPS lock and is receiving ADS-B traffic.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.sm, paddingBottom: 120 },
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
    color: '#93c5fd',
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
    color: '#bfdbfe',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginTop: 6,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  disclaimerText: { flex: 1, fontSize: 12, color: colors.primary },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  stepRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'flex-start' },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  stepText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 19 },
});
