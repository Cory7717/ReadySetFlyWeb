import { FlatList, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MarketplaceStackParamList } from '../navigation/MarketplaceStack';
import { apiEndpoints } from '../services/api';
import type { MarketplaceListing } from '@shared/schema';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type Props = NativeStackScreenProps<MarketplaceStackParamList, 'MarketplaceCategory'>;

const categoryLabelMap: Record<string, { title: string; subtitle: string }> = {
  'aircraft-sale': {
    title: 'Aircraft For Sale',
    subtitle: 'Aircraft listings for buyers, sellers, and owner transitions.',
  },
  charter: {
    title: 'Charter Services',
    subtitle: 'Browse operators and service-focused air travel listings.',
  },
  cfi: {
    title: 'CFI Services',
    subtitle: 'Find instructors, checkouts, and one-on-one training help.',
  },
  'flight-school': {
    title: 'Flight Schools',
    subtitle: 'Discover training organizations and school offerings.',
  },
  mechanic: {
    title: 'Mechanics',
    subtitle: 'Maintenance providers and service listings for aircraft owners.',
  },
  job: {
    title: 'Aviation Jobs',
    subtitle: 'Open aviation roles, contract work, and hiring opportunities.',
  },
};

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export default function MarketplaceCategoryScreen({ route, navigation }: Props) {
  const { category } = route.params;
  const categoryMeta = categoryLabelMap[category] || {
    title: category,
    subtitle: 'Marketplace listings in this category.',
  };

  const { data: listings, isLoading, error } = useQuery({
    queryKey: ['/api/marketplace', category],
    queryFn: async () => {
      const response = await apiEndpoints.marketplace.getAll({ category });
      return response.data as MarketplaceListing[];
    },
  });

  const renderListing = ({ item }: { item: MarketplaceListing }) => (
    <TouchableOpacity
      style={styles.listingCard}
      onPress={() => navigation.navigate('MarketplaceDetail', { listingId: item.id })}
      activeOpacity={0.92}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.categoryPill}>{item.category}</Text>
        </View>
        {item.price ? <Text style={styles.price}>${item.price}</Text> : null}
      </View>

      {item.location ? (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={16} color={colors.primary} />
          <Text style={styles.location}>{item.location}</Text>
        </View>
      ) : null}

      {item.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.footerHint}>Open listing</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading listings...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={styles.errorTitle}>Unable to load listings.</Text>
        <Text style={styles.errorText}>Refresh and try again. This category may be temporarily unavailable.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={listings || []}
        renderItem={renderListing}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.heroPanel}>
              <View style={styles.heroTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroEyebrow}>MARKETPLACE CATEGORY</Text>
                  <Text style={styles.heroTitle}>{categoryMeta.title}</Text>
                  <Text style={styles.heroSubtitle}>{categoryMeta.subtitle}</Text>
                </View>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>{(listings || []).length} listings</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <SummaryTile label="Category" value={categoryMeta.title} />
                <SummaryTile label="Listings" value={String((listings || []).length)} />
                <SummaryTile label="Browse" value="Live" />
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Listings</Text>
              <Text style={styles.sectionSubtitle}>Open a listing to review the details and follow through on the opportunity.</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={40} color={colors.textSoft} />
            <Text style={styles.emptyTitle}>No listings yet.</Text>
            <Text style={styles.emptyText}>Check back later or create a listing to help seed this category.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  errorTitle: {
    ...typography.h2,
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
    maxWidth: 320,
  },
  listContent: {
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
    maxWidth: 300,
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
  sectionHeader: {
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
  listingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h3,
  },
  categoryPill: {
    marginTop: 6,
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: 4,
  },
  location: {
    fontSize: 13,
    color: colors.textMuted,
  },
  description: {
    ...typography.body,
    color: colors.textMuted,
  },
  cardFooter: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerHint: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
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
    maxWidth: 280,
  },
});
