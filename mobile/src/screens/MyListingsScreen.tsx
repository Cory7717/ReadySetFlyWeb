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

  if (!isAuthenticated && !authLoading) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="lock-closed-outline" size={64} color="#9ca3af" />
        <Text style={styles.emptyTitle}>Sign in required</Text>
        <Text style={styles.emptyText}>Sign in to manage your marketplace listings.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('ProfileHome')}>
          <Text style={styles.primaryButtonText}>Go to Profile</Text>
        </TouchableOpacity>
      </View>
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
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>My Listings</Text>
          <Text style={styles.subtitle}>Manage your marketplace listings.</Text>
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('Marketplace', { screen: 'CreateMarketplaceListing' })}
        >
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.createButtonText}>New</Text>
        </TouchableOpacity>
      </View>

      {listings.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="storefront-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyTitle}>No listings yet</Text>
          <Text style={styles.emptyText}>Create your first marketplace listing to get started.</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Marketplace', { screen: 'CreateMarketplaceListing' })}
          >
            <Text style={styles.primaryButtonText}>Create Listing</Text>
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
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{listing.title || 'Untitled Listing'}</Text>
                <View style={[styles.statusPill, listing.isActive ? styles.statusActive : styles.statusInactive]}>
                  <Text style={[styles.statusText, listing.isActive ? styles.statusTextActive : styles.statusTextInactive]}>
                    {listing.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>{formatCategory(listing.category)}</Text>
              {listing.location ? (
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.infoText}>{listing.location}</Text>
                </View>
              ) : null}
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                <Text style={styles.infoText}>Created {formatDate(listing.createdAt)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={styles.infoText}>Expires {formatDate(listing.expiresAt)}</Text>
              </View>
              <View style={styles.footerRow}>
                {hasPrice ? <Text style={styles.priceText}>${price}</Text> : <Text style={styles.priceText}>No price</Text>}
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
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  headerText: { flex: 1, marginRight: spacing.sm },
  title: { ...typography.h2 },
  subtitle: { color: colors.textMuted, marginTop: spacing.xs },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.primarySoft,
  },
  createButtonText: { marginLeft: 6, color: colors.primary, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1, marginRight: spacing.sm },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusActive: { backgroundColor: '#dcfce7' },
  statusInactive: { backgroundColor: '#fee2e2' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusTextActive: { color: '#166534' },
  statusTextInactive: { color: '#991b1b' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  infoText: { marginLeft: 6, fontSize: 12, color: colors.textMuted },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  priceText: { fontSize: 13, fontWeight: '600', color: colors.text },
  viewText: { fontSize: 12, color: colors.textMuted },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  loadingText: { marginTop: spacing.sm, color: colors.textMuted },
  errorText: { marginTop: spacing.sm, color: colors.danger, fontWeight: '600' },
  errorSubtext: { marginTop: 6, color: colors.textMuted, textAlign: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: spacing.sm },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  primaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
});
