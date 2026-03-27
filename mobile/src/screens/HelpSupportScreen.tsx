import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function SupportAction({
  icon,
  title,
  subtitle,
  onPress,
  external,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  external?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.supportAction} onPress={onPress} activeOpacity={0.92}>
      <View style={styles.supportIconWrap}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.supportTitle}>{title}</Text>
        <Text style={styles.supportSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons
        name={external ? 'open-outline' : 'chevron-forward'}
        size={18}
        color={colors.textSoft}
      />
    </TouchableOpacity>
  );
}

export default function HelpSupportScreen({ navigation }: any) {
  const handleOpenPrivacyPolicy = () => {
    Linking.openURL('https://readysetfly.us/privacy-policy');
  };

  const handleOpenTerms = () => {
    Linking.openURL('https://readysetfly.us/terms-of-service');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="help-buoy-outline" size={34} color="#93c5fd" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>SUPPORT CENTER</Text>
            <Text style={styles.heroTitle}>Find answers fast and know where to go next.</Text>
            <Text style={styles.heroSubtitle}>
              Use the RSF support center to get help with planning, rentals, membership, receiver setup, and policy questions.
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile label="Self-serve" value="FAQ" />
          <SummaryTile label="Direct help" value="Contact" />
          <SummaryTile label="Setup" value="Receiver help" />
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Get help</Text>
        <Text style={styles.sectionSubtitle}>
          The fastest paths for answers, team contact, and guidance on more technical setup.
        </Text>

        <View style={styles.sectionContent}>
          <SupportAction
            icon="chatbox-ellipses-outline"
            title="FAQ"
            subtitle="Quick answers to common RSF questions."
            onPress={() => navigation.navigate('FAQ')}
          />
          <SupportAction
            icon="mail-outline"
            title="Contact us"
            subtitle="Reach the Ready Set Fly team directly."
            onPress={() => navigation.navigate('ContactUs')}
          />
          <SupportAction
            icon="radio-outline"
            title="ADS-B receiver help"
            subtitle="Setup guidance for receiver-backed cockpit features."
            onPress={() => navigation.navigate('ReceiverHelp')}
          />
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Policies</Text>
        <Text style={styles.sectionSubtitle}>
          Important account and platform policy documents.
        </Text>

        <View style={styles.sectionContent}>
          <SupportAction
            icon="shield-outline"
            title="Privacy policy"
            subtitle="How Ready Set Fly handles your data."
            onPress={handleOpenPrivacyPolicy}
            external
          />
          <SupportAction
            icon="document-text-outline"
            title="Terms of service"
            subtitle="Platform terms and usage expectations."
            onPress={handleOpenTerms}
            external
          />
        </View>
      </View>
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
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
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
  supportAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  supportIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  supportSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
});
