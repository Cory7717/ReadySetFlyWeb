import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, isValid } from 'date-fns';
import { api } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type MarketplaceListing = {
  id: string;
  title?: string | null;
  category?: string | null;
  location?: string | null;
  price?: string | number | null;
  isActive?: boolean | null;
  expiresAt?: string | Date | null;
  createdAt?: string | Date | null;
  viewCount?: number | null;
};

const formatCategory = (value?: string | null) => {
  if (!value) return 'Listing';
  return value
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return isValid(date) ? format(date, 'MMM dd, yyyy') : 'N/A';
};

const formatPrice = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'number' ? value.toFixed(0) : value;
};

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export default function MyListingsScreen({ navigation }: any) {
  const { isAuthenticated, user, isLoading: authLoading } = useIsAuthenticated();

  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/marketplace/user', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await api.get(`/api/marketplace/user/${user.id}`);
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: isAuthenticated && !!user?.id,
  });

  const listings = Array.isArray(data) ? (data as MarketplaceListing[]) : [];
  const activeCount = listings.filter((listing) => listing.isActive).length;
  const totalViews = listings.reduce((sum, listing) => sum + Number(listing.viewCount || 0), 0);

  if (!isAuthenticated && !authLoading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.heroPanel}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="pricetags-outline" size={34} color="#93c5fd" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>SELLER WORKSPACE</Text>
              <Text style={styles.heroTitle}>Sign in to manage your listings.</Text>
              <Text style={styles.heroSubtitle}>
                Use the member workspace to launch, monitor, and refine marketplace listings across Ready Set Fly.
              </Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <SummaryTile label="Listings" value="Locked" />
            <SummaryTile label="Views" value="Locked" />
            <SummaryTile label="Status" value="Guest" />
          </View>

          <TouchableOpacity
            style={styles.heroAction}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.92}
          >
            <Ionicons name="log-in-outline" size={18} color="#fff" />
            <Text style={styles.heroActionText}>Go to profile</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (isLoading || authLoading) {
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
        <Text style={styles.errorText}>Unable to load listings</Text>
        <Text style={styles.errorSubtext}>Please try again in a moment.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="pricetags-outline" size={34} color="#93c5fd" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>SELLER WORKSPACE</Text>
            <Text style={styles.heroTitle}>Manage your marketplace presence.</Text>
            <Text style={styles.heroSubtitle}>
              Track what is live, how much attention each listing is getting, and where to launch the next listing.
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile label="Total" value={String(listings.length)} />
          <SummaryTile label="Active" value={String(activeCount)} />
          <SummaryTile label="Views" value={String(totalViews)} />
        </View>

        <TouchableOpacity
          style={styles.heroAction}
          onPress={() => navigation.navigate('Marketplace', { screen: 'CreateMarketplaceListing' })}
          activeOpacity={0.92}
        >
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.heroActionText}>Create new listing</Text>
        </TouchableOpacity>
      </View>

      {listings.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="storefront-outline" size={64} color={colors.textSoft} />
          <Text style={styles.emptyTitle}>No listings yet</Text>
          <Text style={styles.emptyText}>Create your first marketplace listing to get started.</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Marketplace', { screen: 'CreateMarketplaceListing' })}
            activeOpacity={0.92}
          >
            <Text style={styles.primaryButtonText}>Create listing</Text>
          </TouchableOpacity>
        </View>
      ) : (
        listings.map((listing) => {
          const price = formatPrice(listing.price);
          const hasPrice = price !== null && price !== undefined && price !== '';
          return (
            <TouchableOpacity
              key={listing.id}
              style={styles.card}
              onPress={() =>
                navigation.navigate('Marketplace', {
                  screen: 'MarketplaceDetail',
                  params: { listingId: listing.id },
                })
              }
              activeOpacity={0.92}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <Text style={styles.cardTitle}>{listing.title || 'Untitled Listing'}</Text>
                  <Text style={styles.cardMeta}>{formatCategory(listing.category)}</Text>
                </View>
                <View style={[styles.statusPill, listing.isActive ? styles.statusActive : styles.statusInactive]}>
                  <Text
                    style={[
                      styles.statusText,
                      listing.isActive ? styles.statusTextActive : styles.statusTextInactive,
                    ]}
                  >
                    {listing.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>

              <View style={styles.metricRow}>
                {listing.location ? (
                  <View style={styles.metricPill}>
                    <Ionicons name="location-outline" size={14} color={colors.textSoft} />
                    <Text style={styles.metricPillText}>{listing.location}</Text>
                  </View>
                ) : null}
                <View style={styles.metricPill}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textSoft} />
                  <Text style={styles.metricPillText}>Created {formatDate(listing.createdAt)}</Text>
                </View>
                <View style={styles.metricPill}>
                  <Ionicons name="time-outline" size={14} color={colors.textSoft} />
                  <Text style={styles.metricPillText}>Expires {formatDate(listing.expiresAt)}</Text>
                </View>
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.priceText}>{hasPrice ? `$${price}` : 'No price'}</Text>
                <Text style={styles.viewText}>{listing.viewCount || 0} views</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.sm, paddingBottom: 120 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
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
  card: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  cardMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusActive: { backgroundColor: '#dcfce7' },
  statusInactive: { backgroundColor: '#fee2e2' },
  statusText: { fontSize: 11, fontWeight: '800' },
  statusTextActive: { color: '#166534' },
  statusTextInactive: { color: '#991b1b' },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricPillText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  priceText: { fontSize: 14, fontWeight: '800', color: colors.text },
  viewText: { fontSize: 12, color: colors.textMuted },
  loadingText: { marginTop: spacing.sm, color: colors.textMuted },
  errorText: { marginTop: spacing.sm, color: colors.danger, fontWeight: '800' },
  errorSubtext: { marginTop: 6, color: colors.textMuted, textAlign: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  primaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
});
