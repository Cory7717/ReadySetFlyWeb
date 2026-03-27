import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { apiEndpoints } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
import { FavoriteButton } from '../components/FavoriteButton';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type Tab = 'aircraft' | 'marketplace';

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export default function FavoritesScreen({ navigation }: any) {
  const { isAuthenticated, isLoading: authLoading } = useIsAuthenticated();
  const [activeTab, setActiveTab] = useState<Tab>('aircraft');

  const { data: favorites, isLoading, refetch } = useQuery({
    queryKey: ['/api/favorites'],
    queryFn: async () => {
      const response = await apiEndpoints.favorites.getAll();
      return response.data;
    },
    enabled: isAuthenticated,
  });

  const aircraftFavorites = favorites?.aircraft || [];
  const marketplaceFavorites = favorites?.marketplace || [];
  const totalFavorites = aircraftFavorites.length + marketplaceFavorites.length;
  const heroSubtitle = useMemo(
    () =>
      totalFavorites
        ? `Keep the aircraft and listings you want close at hand so you can jump back into rentals or marketplace decisions quickly.`
        : 'Build a shortlist of aircraft and listings you want to track across rentals and marketplace workflows.',
    [totalFavorites]
  );

  if (!isAuthenticated && !authLoading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.heroPanel}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="heart-outline" size={34} color="#fda4af" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>FAVORITES</Text>
              <Text style={styles.heroTitle}>Sign in to save your shortlist.</Text>
              <Text style={styles.heroSubtitle}>
                Favorites tie rentals and marketplace discovery into one member workspace so your best options are always easy to reopen.
              </Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <SummaryTile label="Aircraft" value="Locked" />
            <SummaryTile label="Listings" value="Locked" />
            <SummaryTile label="Workspace" value="Guest" />
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
        <Text style={styles.loadingText}>Loading favorites...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroPanel}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="heart-outline" size={34} color="#fda4af" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>MEMBER WORKSPACE</Text>
              <Text style={styles.heroTitle}>Your saved shortlist.</Text>
              <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <SummaryTile label="Total saved" value={String(totalFavorites)} />
            <SummaryTile label="Aircraft" value={String(aircraftFavorites.length)} />
            <SummaryTile label="Marketplace" value={String(marketplaceFavorites.length)} />
          </View>
        </View>

        <View style={styles.tabShell}>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'aircraft' && styles.tabPillActive]}
            onPress={() => setActiveTab('aircraft')}
            activeOpacity={0.92}
          >
            <Text style={[styles.tabPillText, activeTab === 'aircraft' && styles.tabPillTextActive]}>
              Aircraft ({aircraftFavorites.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'marketplace' && styles.tabPillActive]}
            onPress={() => setActiveTab('marketplace')}
            activeOpacity={0.92}
          >
            <Text style={[styles.tabPillText, activeTab === 'marketplace' && styles.tabPillTextActive]}>
              Marketplace ({marketplaceFavorites.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'aircraft' ? (
          aircraftFavorites.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="airplane-outline" size={28} color={colors.textSoft} />
              <Text style={styles.emptyTitle}>No favorite aircraft yet</Text>
              <Text style={styles.emptyText}>
                Save aircraft from Rentals so you can compare your best options without searching from scratch.
              </Text>
            </View>
          ) : (
            aircraftFavorites.map((aircraft: any) => (
              <TouchableOpacity
                key={aircraft.id}
                style={styles.card}
                onPress={() =>
                  navigation.navigate('Rentals', {
                    screen: 'AircraftDetail',
                    params: { aircraftId: aircraft.id },
                  })
                }
                activeOpacity={0.92}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={styles.cardIconWrap}>
                      <Ionicons name="airplane-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardTitle}>
                        {aircraft.make} {aircraft.model}
                      </Text>
                      <Text style={styles.cardSubtitle}>{aircraft.registration}</Text>
                    </View>
                  </View>
                  <FavoriteButton
                    listingType="aircraft"
                    listingId={aircraft.id}
                    size={28}
                    onToggle={() => refetch()}
                  />
                </View>
                <View style={styles.metricRow}>
                  <View style={styles.metricPill}>
                    <Ionicons name="location-outline" size={14} color={colors.textSoft} />
                    <Text style={styles.metricPillText}>{aircraft.location}</Text>
                  </View>
                  <View style={styles.metricPill}>
                    <Ionicons name="cash-outline" size={14} color={colors.textSoft} />
                    <Text style={styles.metricPillText}>${aircraft.hourlyRate}/hr</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )
        ) : marketplaceFavorites.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="storefront-outline" size={28} color={colors.textSoft} />
            <Text style={styles.emptyTitle}>No favorite listings yet</Text>
            <Text style={styles.emptyText}>
              Save marketplace listings you want to revisit so they stay close while you compare sellers, pricing, and locations.
            </Text>
          </View>
        ) : (
          marketplaceFavorites.map((listing: any) => (
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
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.cardIconWrap, styles.marketplaceIconWrap]}>
                    <Ionicons name="storefront-outline" size={18} color="#7c3aed" />
                  </View>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.cardTitle}>{listing.title}</Text>
                    <Text style={styles.cardSubtitle}>{listing.category}</Text>
                  </View>
                </View>
                <FavoriteButton
                  listingType="marketplace"
                  listingId={listing.id}
                  size={28}
                  onToggle={() => refetch()}
                />
              </View>
              <View style={styles.metricRow}>
                {listing.location ? (
                  <View style={styles.metricPill}>
                    <Ionicons name="location-outline" size={14} color={colors.textSoft} />
                    <Text style={styles.metricPillText}>{listing.location}</Text>
                  </View>
                ) : null}
                {listing.price ? (
                  <View style={styles.metricPill}>
                    <Ionicons name="cash-outline" size={14} color={colors.textSoft} />
                    <Text style={styles.metricPillText}>${listing.price}</Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
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
    color: '#fecdd3',
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
    color: '#fecdd3',
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
  tabShell: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    ...shadow.card,
  },
  tabPillActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  tabPillText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textMuted,
  },
  tabPillTextActive: {
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  marketplaceIconWrap: {
    backgroundColor: '#ede9fe',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
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
    fontWeight: '700',
    color: colors.textMuted,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
