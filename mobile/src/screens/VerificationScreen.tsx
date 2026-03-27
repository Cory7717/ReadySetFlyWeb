import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

function DocumentRow({
  icon,
  title,
  status,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  status: string;
}) {
  return (
    <TouchableOpacity style={styles.documentRow} activeOpacity={0.92}>
      <View style={styles.documentIconWrap}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.documentTitle}>{title}</Text>
        <Text style={styles.documentStatus}>{status}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
    </TouchableOpacity>
  );
}

export default function VerificationScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top, spacing.sm), paddingBottom: 120 + insets.bottom },
      ]}
    >
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="shield-checkmark-outline" size={34} color="#fcd34d" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>TRUST & COMPLIANCE</Text>
            <Text style={styles.heroTitle}>Verification is still in progress.</Text>
            <Text style={styles.heroSubtitle}>
              Finish identity and pilot-document review to unlock the full rental, marketplace, and member workflow inside RSF.
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile label="Status" value="Pending" />
          <SummaryTile label="Required docs" value="3" />
          <SummaryTile label="Access" value="Limited" />
        </View>

        <TouchableOpacity
          style={styles.heroAction}
          activeOpacity={0.92}
          onPress={() => Linking.openURL('https://readysetfly.us/verify-identity')}
        >
          <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
          <Text style={styles.heroActionText}>Continue verification</Text>
        </TouchableOpacity>
      </View>

      <SectionCard
        title="Verification checklist"
        subtitle="These documents are used to protect renters, owners, and marketplace participants across RSF."
      >
        <DocumentRow icon="document-text-outline" title="Pilot License" status="Not uploaded" />
        <DocumentRow icon="medkit-outline" title="Medical Certificate" status="Not uploaded" />
        <DocumentRow icon="card-outline" title="Government ID" status="Not uploaded" />
      </SectionCard>

      <SectionCard
        title="What verification unlocks"
        subtitle="The trust layer supports bookings, listings, approvals, and account credibility."
      >
        <View style={styles.benefitList}>
          <Text style={styles.benefitItem}>Book aircraft with stronger owner confidence and faster approvals.</Text>
          <Text style={styles.benefitItem}>List aircraft or marketplace inventory with a more trusted profile.</Text>
          <Text style={styles.benefitItem}>Build a verified member record across web and mobile workflows.</Text>
        </View>
      </SectionCard>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>Why RSF asks for this</Text>
          <Text style={styles.infoDescription}>
            Verification exists to create a safer pilot community, reduce booking friction, and make owner, renter, and marketplace actions more defensible.
          </Text>
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
  heroAction: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.lg,
    paddingVertical: 15,
    backgroundColor: colors.primary,
  },
  heroActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
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
  documentRow: {
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
  documentIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  documentStatus: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  benefitList: {
    gap: spacing.sm,
  },
  benefitItem: {
    ...typography.body,
    color: colors.textMuted,
  },
  infoCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  infoDescription: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: 6,
  },
});
