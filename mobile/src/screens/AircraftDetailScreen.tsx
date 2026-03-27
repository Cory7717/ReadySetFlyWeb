import { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format, isValid } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RentalsStackParamList } from '../navigation/RentalsStack';
import { apiEndpoints } from '../services/api';
import { StarRating } from '../components/StarRating';
import { FavoriteButton } from '../components/FavoriteButton';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type Props = NativeStackScreenProps<RentalsStackParamList, 'AircraftDetail'>;

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
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

export default function AircraftDetailScreen({ route, navigation }: Props) {
  const { aircraftId } = route.params;
  const verificationNoticeKey = 'rsf-verification-renter-v1';
  const insets = useSafeAreaInsets();
  const openVerification = () => {
    navigation.getParent()?.navigate('Profile', {
      screen: 'Verification',
    });
  };

  useEffect(() => {
    const showNotice = async () => {
      const stored = await AsyncStorage.getItem(verificationNoticeKey);
      const lastSeen = stored ? Number(stored) : 0;
      const thirtyDays = 1000 * 60 * 60 * 24 * 30;
      if (lastSeen && Date.now() - lastSeen < thirtyDays) return;

      const markSeen = async () => {
        await AsyncStorage.setItem(verificationNoticeKey, String(Date.now()));
      };

      Alert.alert(
        'Verification required',
        'Renters and owners must verify ID, pilot credentials, and insurance when applicable. This protects both parties and reduces fraud.',
        [
          { text: 'Got it', onPress: markSeen },
          {
            text: 'Start Verification',
            onPress: async () => {
              await markSeen();
              openVerification();
            },
          },
        ]
      );
    };

    showNotice();
  }, [navigation]);

  const { data: aircraft, isLoading, error } = useQuery({
    queryKey: ['/api/aircraft', aircraftId],
    queryFn: async () => {
      const response = await apiEndpoints.aircraft.getById(aircraftId);
      return response.data;
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ['/api/reviews/aircraft', aircraftId],
    queryFn: async () => {
      const response = await apiEndpoints.aircraft.getById(aircraftId);
      const ownerId = response.data.ownerId;
      if (!ownerId) return [];
      const reviewsResponse = await apiEndpoints.reviews.getByUser(ownerId);
      return reviewsResponse.data;
    },
    enabled: !!aircraftId,
  });

  const aircraftTitle = useMemo(() => {
    if (!aircraft) return 'Aircraft';
    return aircraft.type || `${aircraft.make || ''} ${aircraft.model || ''}`.trim() || 'Aircraft';
  }, [aircraft]);

  const registration = useMemo(() => {
    if (!aircraft) return 'Registration pending';
    return aircraft.nNumber || aircraft.registration || 'Registration pending';
  }, [aircraft]);

  const locationLabel = useMemo(() => {
    if (!aircraft) return 'Location pending';
    const parts = [aircraft.airportCode, aircraft.city, aircraft.state].filter(Boolean);
    if (parts.length) return parts.join(' • ');
    return aircraft.location || 'Location pending';
  }, [aircraft]);

  const hourlyRate = useMemo(() => {
    const value = Number(aircraft?.hourlyRate || 0);
    return value ? `$${value.toFixed(0)}/hr` : 'Rate unavailable';
  }, [aircraft]);

  const minimumHours = useMemo(() => {
    return `${aircraft?.minFlightHours || 0} hrs`;
  }, [aircraft]);

  const reviewCount = reviews?.length || 0;
  const averageRating = useMemo(() => {
    if (!reviews?.length) return 0;
    const total = reviews.reduce((sum: number, review: any) => sum + Number(review.rating || 0), 0);
    return total / reviews.length;
  }, [reviews]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading aircraft details...</Text>
      </View>
    );
  }

  if (error || !aircraft) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={styles.errorTitle}>Unable to load this aircraft.</Text>
        <Text style={styles.errorText}>Refresh and try again. The rental listing may be temporarily unavailable.</Text>
      </View>
    );
  }

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
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>AIRCRAFT DETAIL</Text>
            <Text style={styles.heroTitle}>{aircraftTitle}</Text>
            <Text style={styles.heroSubtitle}>
              {registration} • {locationLabel}
            </Text>
          </View>
          <View style={styles.heroActions}>
            {aircraft.available ? (
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>Available</Text>
              </View>
            ) : (
              <View style={styles.heroBadgeMuted}>
                <Text style={styles.heroBadgeMutedText}>Unavailable</Text>
              </View>
            )}
            <View style={styles.favoriteWrap}>
              <FavoriteButton listingType="aircraft" listingId={aircraftId} size={26} />
            </View>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <MetricTile label="Rate" value={hourlyRate} />
          <MetricTile label="Minimum time" value={minimumHours} />
          <MetricTile label="Reviews" value={reviewCount ? `${averageRating.toFixed(1)} ★` : 'New'} />
        </View>

        <View style={styles.heroMetaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="navigate-outline" size={14} color={colors.primary} />
            <Text style={styles.metaPillText}>{locationLabel}</Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons name="speedometer-outline" size={14} color={colors.primary} />
            <Text style={styles.metaPillText}>{aircraft.category || 'Rental aircraft'}</Text>
          </View>
          {aircraft.insuranceIncluded ? (
            <View style={styles.metaPill}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
              <Text style={styles.metaPillText}>Insurance included</Text>
            </View>
          ) : null}
        </View>

        {aircraft.available ? (
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => navigation.navigate('Booking', { aircraftId })}
            activeOpacity={0.92}
          >
            <Ionicons name="calendar-outline" size={18} color="#fff" />
            <Text style={styles.primaryActionText}>Start Booking</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <SectionCard title="Aircraft Overview" subtitle="The key details a renter typically checks first.">
        <View style={styles.specGrid}>
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>Registration</Text>
            <Text style={styles.specValue}>{registration}</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>Year</Text>
            <Text style={styles.specValue}>{aircraft.year || 'N/A'}</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>Engine</Text>
            <Text style={styles.specValue}>{aircraft.engineType || aircraft.engine || 'Standard'}</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>Seats</Text>
            <Text style={styles.specValue}>{aircraft.seatingCapacity || 'N/A'}</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>Response time</Text>
            <Text style={styles.specValue}>{aircraft.responseTime || 24}h</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>Acceptance</Text>
            <Text style={styles.specValue}>{aircraft.acceptanceRate || 100}%</Text>
          </View>
        </View>
      </SectionCard>

      {aircraft.description ? (
        <SectionCard title="Description" subtitle="Owner-provided aircraft and mission context.">
          <Text style={styles.bodyText}>{aircraft.description}</Text>
        </SectionCard>
      ) : null}

      <SectionCard title="Rental Requirements" subtitle="Use this to confirm fit before you start a booking request.">
        <View style={styles.requirementList}>
          <View style={styles.requirementCard}>
            <Text style={styles.requirementLabel}>Minimum flight hours</Text>
            <Text style={styles.requirementValue}>{minimumHours}</Text>
          </View>
          <View style={styles.requirementCard}>
            <Text style={styles.requirementLabel}>Certifications</Text>
            <Text style={styles.requirementValue}>
              {Array.isArray(aircraft.requiredCertifications) && aircraft.requiredCertifications.length
                ? aircraft.requiredCertifications.join(', ')
                : 'Check with owner'}
            </Text>
          </View>
          {aircraft.requirements ? (
            <View style={styles.requirementNotes}>
              <Text style={styles.requirementNotesLabel}>Owner notes</Text>
              <Text style={styles.requirementNotesText}>{aircraft.requirements}</Text>
            </View>
          ) : null}
        </View>
      </SectionCard>

      <SectionCard title="Trust & Reviews" subtitle="Owner reputation and pilot feedback.">
        <View style={styles.trustSummary}>
          <View style={styles.trustMetric}>
            <Text style={styles.trustMetricValue}>{reviewCount ? averageRating.toFixed(1) : '—'}</Text>
            <Text style={styles.trustMetricLabel}>Average rating</Text>
          </View>
          <View style={styles.trustMetric}>
            <Text style={styles.trustMetricValue}>{reviewCount}</Text>
            <Text style={styles.trustMetricLabel}>Reviews</Text>
          </View>
        </View>

        {reviews && reviews.length > 0 ? (
          <View style={styles.reviewList}>
            {reviews.slice(0, 3).map((review: any) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewerName}>
                      {review.reviewer?.firstName} {review.reviewer?.lastName}
                    </Text>
                    <StarRating rating={review.rating} readonly size={16} />
                  </View>
                  <Text style={styles.reviewDate}>
                    {review.createdAt && isValid(new Date(review.createdAt))
                      ? format(new Date(review.createdAt), 'MMM dd, yyyy')
                      : ''}
                  </Text>
                </View>
                {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
              </View>
            ))}
            {reviews.length > 3 ? (
              <Text style={styles.moreReviews}>+{reviews.length - 3} more reviews available</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.emptyReviewState}>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.textSoft} />
            <Text style={styles.emptyReviewTitle}>No reviews yet</Text>
            <Text style={styles.emptyReviewText}>This aircraft is available to book, but pilot reviews have not been posted yet.</Text>
          </View>
        )}
      </SectionCard>

      {aircraft.available ? (
        <View style={styles.footerActionWrap}>
          <TouchableOpacity
            style={styles.footerAction}
            onPress={() => navigation.navigate('Booking', { aircraftId })}
            activeOpacity={0.92}
          >
            <Text style={styles.footerActionText}>Book This Aircraft</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
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
    maxWidth: 290,
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  heroActions: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.28)',
  },
  heroBadgeText: {
    color: '#bbf7d0',
    fontSize: 11,
    fontWeight: '800',
  },
  heroBadgeMuted: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroBadgeMutedText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  favoriteWrap: {
    borderRadius: 999,
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  metricTile: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#bfdbfe',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginTop: 6,
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: spacing.md,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#eff6ff',
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
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  specItem: {
    width: '48%',
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  specLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textSoft,
  },
  specValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
  },
  bodyText: {
    ...typography.body,
    color: colors.textMuted,
  },
  requirementList: {
    gap: spacing.sm,
  },
  requirementCard: {
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceTinted,
    borderWidth: 1,
    borderColor: '#d8e6ff',
  },
  requirementLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  requirementValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: 6,
  },
  requirementNotes: {
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  requirementNotesLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  requirementNotesText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: 6,
  },
  trustSummary: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  trustMetric: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceTinted,
    borderWidth: 1,
    borderColor: '#d8e6ff',
  },
  trustMetricValue: {
    ...typography.metric,
    color: colors.primary,
  },
  trustMetricLabel: {
    ...typography.muted,
    marginTop: 4,
  },
  reviewList: {
    gap: spacing.sm,
  },
  reviewCard: {
    borderRadius: radius.lg,
    padding: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 12,
    color: colors.textSoft,
  },
  reviewComment: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  moreReviews: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  emptyReviewState: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyReviewTitle: {
    ...typography.h3,
    marginTop: spacing.sm,
  },
  emptyReviewText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 280,
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
