import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MarketplaceStackParamList } from '../navigation/MarketplaceStack';
import { apiEndpoints } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
import UpgradeListingModal from '../components/UpgradeListingModal';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type Props = NativeStackScreenProps<MarketplaceStackParamList, 'MarketplaceDetail'>;

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

export default function MarketplaceDetailScreen({ route }: Props) {
  const { listingId } = route.params;
  const { user } = useIsAuthenticated();
  const queryClient = useQueryClient();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const { data: listing, isLoading, error } = useQuery({
    queryKey: ['/api/marketplace', listingId],
    queryFn: async () => {
      const response = await apiEndpoints.marketplace.getById(listingId);
      return response.data;
    },
  });

  const isOwner = user && listing && listing.userId === user.id;

  const contactLabel = useMemo(() => {
    if (!listing) return 'Contact';
    if (listing.contactEmail) return 'Email Seller';
    if (listing.contactPhone) return 'Call Seller';
    return 'Contact';
  }, [listing]);

  const handleContact = () => {
    if (listing?.contactEmail) {
      const categoryNames: Record<string, string> = {
        'aircraft-sale': 'Aircraft for Sale',
        job: 'Aviation Job',
        cfi: 'CFI Services',
        'flight-school': 'Flight School',
        mechanic: 'Mechanic Services',
        charter: 'Charter Service',
      };
      const categoryName = categoryNames[listing.category] || listing.category;
      const subject = encodeURIComponent(
        `Inquiry From Ready Set Fly about your ${categoryName} Listing: ${listing.title}`
      );
      const body = encodeURIComponent(
        `Hi,\n\nI'm interested in your ${categoryName} listing: ${listing.title}\n\n`
      );
      Linking.openURL(`mailto:${listing.contactEmail}?subject=${subject}&body=${body}`);
    } else if (listing?.contactPhone) {
      Linking.openURL(`tel:${listing.contactPhone}`);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading listing details...</Text>
      </View>
    );
  }

  if (error || !listing) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={styles.errorTitle}>Unable to load listing.</Text>
        <Text style={styles.errorText}>Refresh and try again. This listing may be temporarily unavailable.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>LISTING DETAIL</Text>
            <Text style={styles.heroTitle}>{listing.title}</Text>
            <Text style={styles.heroSubtitle}>{listing.location || 'Marketplace listing'}</Text>
          </View>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{listing.category}</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile label="Price" value={listing.price ? `$${listing.price}` : 'Contact'} />
          <SummaryTile label="Category" value={listing.category} />
          <SummaryTile label="Tier" value={listing.tier || 'basic'} />
        </View>

        <View style={styles.actionRow}>
          {isOwner ? (
            listing.tier !== 'premium' ? (
              <TouchableOpacity
                style={styles.ownerAction}
                onPress={() => setShowUpgradeModal(true)}
                activeOpacity={0.92}
                data-testid="button-upgrade-listing"
              >
                <Ionicons name="trending-up" size={18} color="#fff" />
                <Text style={styles.ownerActionText}>Upgrade Listing</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.ownerBadge}>
                <Text style={styles.ownerBadgeText}>Premium listing active</Text>
              </View>
            )
          ) : (
            <TouchableOpacity style={styles.primaryAction} onPress={handleContact} activeOpacity={0.92}>
              <Ionicons
                name={listing.contactEmail ? 'mail-outline' : 'call-outline'}
                size={18}
                color="#fff"
              />
              <Text style={styles.primaryActionText}>{contactLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {listing.description ? (
        <SectionCard
          title="Description"
          subtitle="The seller’s main context for the listing."
        >
          <Text style={styles.bodyText}>{listing.description}</Text>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Listing Snapshot"
        subtitle="Quick reference before you reach out or manage the listing."
      >
        <View style={styles.snapshotGrid}>
          <View style={styles.snapshotCard}>
            <Text style={styles.snapshotLabel}>Category</Text>
            <Text style={styles.snapshotValue}>{listing.category}</Text>
          </View>
          <View style={styles.snapshotCard}>
            <Text style={styles.snapshotLabel}>Location</Text>
            <Text style={styles.snapshotValue}>{listing.location || 'Not listed'}</Text>
          </View>
          <View style={styles.snapshotCard}>
            <Text style={styles.snapshotLabel}>Price</Text>
            <Text style={styles.snapshotValue}>{listing.price ? `$${listing.price}` : 'Contact seller'}</Text>
          </View>
          <View style={styles.snapshotCard}>
            <Text style={styles.snapshotLabel}>Tier</Text>
            <Text style={styles.snapshotValue}>
              {listing.tier === 'premium'
                ? 'Premium'
                : listing.tier === 'standard'
                ? 'Standard'
                : 'Basic'}
            </Text>
          </View>
        </View>
      </SectionCard>

      {(listing.contactEmail || listing.contactPhone) ? (
        <SectionCard
          title="Contact"
          subtitle="Reach the seller directly from the listing."
        >
          {listing.contactEmail ? (
            <View style={styles.contactRow}>
              <Ionicons name="mail-outline" size={18} color={colors.primary} />
              <Text style={styles.contactText}>{listing.contactEmail}</Text>
            </View>
          ) : null}
          {listing.contactPhone ? (
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={18} color={colors.primary} />
              <Text style={styles.contactText}>{listing.contactPhone}</Text>
            </View>
          ) : null}
        </SectionCard>
      ) : null}

      {isOwner ? (
        <SectionCard
          title="Owner Controls"
          subtitle="This is how the listing is currently positioned in the marketplace."
        >
          <View style={styles.ownerTierCard}>
            <Text style={styles.ownerTierLabel}>Current tier</Text>
            <Text style={styles.ownerTierValue}>
              {listing.tier === 'premium'
                ? 'Premium'
                : listing.tier === 'standard'
                ? 'Standard'
                : 'Basic'}
            </Text>
          </View>
        </SectionCard>
      ) : null}

      {!isOwner ? (
        <View style={styles.footerActionWrap}>
          <TouchableOpacity style={styles.footerAction} onPress={handleContact} activeOpacity={0.92}>
            <Text style={styles.footerActionText}>{contactLabel}</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : null}

      {isOwner && listing ? (
        <UpgradeListingModal
          visible={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          listing={listing}
          onUpgradeSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/marketplace', listingId] });
            queryClient.invalidateQueries({ queryKey: ['/api/marketplace'] });
          }}
        />
      ) : null}
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
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 320,
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
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  categoryBadgeText: {
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
  actionRow: {
    marginTop: spacing.lg,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.lg,
    paddingVertical: 15,
    backgroundColor: colors.primary,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  ownerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.lg,
    paddingVertical: 15,
    backgroundColor: colors.accent,
  },
  ownerActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  ownerBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.28)',
  },
  ownerBadgeText: {
    color: '#bbf7d0',
    fontSize: 12,
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
  bodyText: {
    ...typography.body,
    color: colors.textMuted,
  },
  snapshotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  snapshotCard: {
    width: '48%',
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  snapshotLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textSoft,
  },
  snapshotValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  contactText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  ownerTierCard: {
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceTinted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ownerTierLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  ownerTierValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
  },
  footerActionWrap: {
    paddingTop: spacing.sm,
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    ...shadow.floating,
  },
  footerActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
