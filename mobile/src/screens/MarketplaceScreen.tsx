import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PromoBanner } from '../components/PromoBanner';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

const categories = [
  {
    id: 'job',
    label: 'Aviation Jobs',
    subtitle: 'Open roles, contract work, and aviation hiring',
    icon: 'briefcase',
    color: '#1e40af',
  },
  {
    id: 'aircraft-sale',
    label: 'Aircraft For Sale',
    subtitle: 'Listings for buyers, sellers, and owner transitions',
    icon: 'pricetag',
    color: '#7c3aed',
  },
  {
    id: 'cfi',
    label: 'CFIs',
    subtitle: 'Instruction, checkout support, and training help',
    icon: 'school',
    color: '#0891b2',
  },
  {
    id: 'flight-school',
    label: 'Flight Schools',
    subtitle: 'Training programs and local school discovery',
    icon: 'business',
    color: '#059669',
  },
  {
    id: 'mechanic',
    label: 'Mechanics',
    subtitle: 'Maintenance support and aircraft service providers',
    icon: 'construct',
    color: '#dc2626',
  },
  {
    id: 'charter',
    label: 'Charter Services',
    subtitle: 'On-demand operators and air service connections',
    icon: 'business-outline',
    color: '#ea580c',
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

export default function MarketplaceScreen({ navigation }: any) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>MARKETPLACE</Text>
            <Text style={styles.heroTitle}>Connect with the aviation community through a cleaner mission-based marketplace.</Text>
            <Text style={styles.heroSubtitle}>
              Buy, sell, hire, and discover aviation services without digging through disconnected directories.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Live</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile label="Categories" value={String(categories.length)} />
          <SummaryTile label="Use cases" value="Buy • Hire • Train" />
          <SummaryTile label="Workflow" value="Browse or list" />
        </View>

        <TouchableOpacity
          style={styles.primaryAction}
          onPress={() => navigation.navigate('CreateMarketplaceListing')}
          activeOpacity={0.92}
          data-testid="button-create-listing"
        >
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.primaryActionText}>Create New Listing</Text>
        </TouchableOpacity>
      </View>

      <PromoBanner />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Marketplace Collections</Text>
        <Text style={styles.sectionSubtitle}>
          Choose the lane that matches the mission you’re on right now.
        </Text>
      </View>

      <View style={styles.categoryList}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={styles.categoryCard}
            onPress={() => navigation.navigate('MarketplaceCategory', { category: category.id })}
            activeOpacity={0.92}
          >
            <View style={[styles.iconContainer, { backgroundColor: `${category.color}18` }]}>
              <Ionicons name={category.icon as any} size={26} color={category.color} />
            </View>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryTitle}>{category.label}</Text>
              <Text style={styles.categorySubtitle}>{category.subtitle}</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={colors.textSoft} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
          <Text style={styles.infoTitle}>Why this matters</Text>
        </View>
        <Text style={styles.infoText}>
          RSF’s marketplace is meant to feel like a pilot workflow, not a generic classifieds page. Move from search to contact to transaction with less context switching.
        </Text>
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
  primaryAction: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.lg,
    paddingVertical: 15,
    backgroundColor: colors.accent,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionHeader: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionTitle: {
    ...typography.h2,
  },
  sectionSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
  categoryList: {
    gap: spacing.sm,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.card,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  categoryTitle: {
    ...typography.h3,
  },
  categorySubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
  infoCard: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceTinted,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.card,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  infoText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
