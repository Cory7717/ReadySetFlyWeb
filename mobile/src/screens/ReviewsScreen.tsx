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

  if (!isAuthenticated && !authLoading) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="lock-closed-outline" size={64} color="#9ca3af" />
        <Text style={styles.emptyTitle}>Sign in required</Text>
        <Text style={styles.emptyText}>Sign in to view your reviews.</Text>
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
      <Text style={styles.title}>Reviews</Text>
      <Text style={styles.subtitle}>See what other pilots are saying.</Text>

      {reviews.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="star-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyTitle}>No reviews yet</Text>
          <Text style={styles.emptyText}>Complete a rental to receive your first review.</Text>
        </View>
      ) : (
        reviews.map((review) => (
          <View key={review.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.reviewerName}>{review.reviewerName || 'Pilot'}</Text>
              <Text style={styles.ratingText}>{review.rating ? `${review.rating}/5` : '-'}</Text>
            </View>
            <Text style={styles.dateText}>{formatDate(review.createdAt)}</Text>
            <Text style={styles.commentText}>{review.comment || 'No comment provided.'}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  title: { ...typography.h2 },
  subtitle: { color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
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
  reviewerName: { fontSize: 14, fontWeight: '600', color: colors.text },
  ratingText: { fontSize: 13, fontWeight: '600', color: colors.text },
  dateText: { marginTop: 4, fontSize: 12, color: colors.textMuted },
  commentText: { marginTop: spacing.xs, fontSize: 13, color: colors.text },
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
