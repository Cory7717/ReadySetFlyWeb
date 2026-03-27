import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, isValid } from 'date-fns';
import { api } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type Review = {
  id: string;
  reviewerName?: string | null;
  rating?: number | null;
  comment?: string | null;
  createdAt?: string | Date | null;
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return isValid(date) ? format(date, 'MMM dd, yyyy') : 'N/A';
};

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export default function ReviewsScreen({ navigation }: any) {
  const { isAuthenticated, user, isLoading: authLoading } = useIsAuthenticated();

  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/reviews/user', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await api.get(`/api/reviews/user/${user.id}`);
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: isAuthenticated && !!user?.id,
  });

  const reviews = Array.isArray(data) ? (data as Review[]) : [];
  const averageRating = reviews.length
    ? (
        reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
      ).toFixed(1)
    : '—';

  if (!isAuthenticated && !authLoading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.heroPanel}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="star-outline" size={34} color="#fde68a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>REPUTATION HUB</Text>
              <Text style={styles.heroTitle}>Sign in to view your reviews.</Text>
              <Text style={styles.heroSubtitle}>
                Reviews help build trust across rentals and marketplace activity, and they live inside your member workspace.
              </Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <SummaryTile label="Reviews" value="Locked" />
            <SummaryTile label="Rating" value="Locked" />
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
        <Text style={styles.loadingText}>Loading reviews...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={styles.errorText}>Unable to load reviews</Text>
        <Text style={styles.errorSubtext}>Please try again in a moment.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="star-outline" size={34} color="#fde68a" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>REPUTATION HUB</Text>
            <Text style={styles.heroTitle}>See what other pilots are saying.</Text>
            <Text style={styles.heroSubtitle}>
              Reviews shape trust across rentals and marketplace actions, and give you a fast read on how your profile is landing.
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile label="Reviews" value={String(reviews.length)} />
          <SummaryTile label="Average" value={averageRating} />
          <SummaryTile label="Signal" value={reviews.length ? 'Active' : 'Building'} />
        </View>
      </View>

      {reviews.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="star-outline" size={64} color={colors.textSoft} />
          <Text style={styles.emptyTitle}>No reviews yet</Text>
          <Text style={styles.emptyText}>Complete a rental to receive your first review.</Text>
        </View>
      ) : (
        reviews.map((review) => (
          <View key={review.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewerName}>{review.reviewerName || 'Pilot'}</Text>
                <Text style={styles.dateText}>{formatDate(review.createdAt)}</Text>
              </View>
              <View style={styles.ratingPill}>
                <Ionicons name="star" size={14} color="#d97706" />
                <Text style={styles.ratingText}>{review.rating ? `${review.rating}/5` : '-'}</Text>
              </View>
            </View>
            <Text style={styles.commentText}>{review.comment || 'No comment provided.'}</Text>
          </View>
        ))
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
    gap: spacing.sm,
  },
  reviewerName: { fontSize: 15, fontWeight: '800', color: colors.text },
  dateText: { marginTop: 4, fontSize: 12, color: colors.textMuted },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fef3c7',
  },
  ratingText: { fontSize: 13, fontWeight: '800', color: '#92400e' },
  commentText: { marginTop: spacing.md, fontSize: 13, color: colors.text, lineHeight: 20 },
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
