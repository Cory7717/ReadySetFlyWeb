import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, isValid } from 'date-fns';
import { api } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
import { ReviewDialog } from '../components/ReviewDialog';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type Rental = {
  id: string;
  aircraftId?: string | null;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  estimatedHours?: string | number | null;
  actualHours?: string | number | null;
  hourlyRate?: string | number | null;
  totalCostRenter?: string | number | null;
  ownerId?: string | null;
};

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function formatDate(dateValue: any): string {
  if (!dateValue) return 'TBD';
  const date = new Date(dateValue);
  return isValid(date) ? format(date, 'MMM dd, yyyy') : 'Invalid date';
}

function getStatusTone(status: string) {
  switch (status) {
    case 'approved':
    case 'active':
      return {
        background: colors.accentSoft,
        text: colors.accent,
        label: 'Active',
      };
    case 'pending':
      return {
        background: '#fff3d6',
        text: colors.warning,
        label: 'Pending',
      };
    case 'completed':
      return {
        background: colors.surfaceMuted,
        text: colors.textMuted,
        label: 'Completed',
      };
    case 'cancelled':
      return {
        background: '#fee2e2',
        text: colors.danger,
        label: 'Cancelled',
      };
    default:
      return {
        background: colors.surfaceMuted,
        text: colors.textMuted,
        label: status || 'Unknown',
      };
  }
}

export default function MyRentalsScreen({ navigation }: any) {
  const { isAuthenticated, isLoading: authLoading, user } = useIsAuthenticated();
  const [reviewDialogVisible, setReviewDialogVisible] = useState(false);
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);

  const { data: rentals, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/rentals/combined', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const [ownerRes, renterRes] = await Promise.all([
        api.get(`/api/rentals/owner/${user.id}`),
        api.get(`/api/rentals/renter/${user.id}`),
      ]);
      const ownerData = Array.isArray(ownerRes.data) ? ownerRes.data : [];
      const renterData = Array.isArray(renterRes.data) ? renterRes.data : [];
      return [...ownerData, ...renterData] as Rental[];
    },
    enabled: isAuthenticated && !!user?.id,
  });

  const approvedCount = useMemo(
    () => (rentals || []).filter((item) => item.status === 'approved' || item.status === 'active').length,
    [rentals]
  );
  const pendingCount = useMemo(
    () => (rentals || []).filter((item) => item.status === 'pending').length,
    [rentals]
  );
  const completedCount = useMemo(
    () => (rentals || []).filter((item) => item.status === 'completed').length,
    [rentals]
  );

  const totalBookedHours = useMemo(
    () =>
      (rentals || []).reduce(
        (sum, item) => sum + (Number(item.actualHours) || Number(item.estimatedHours) || 0),
        0
      ),
    [rentals]
  );

  const renderRental = ({ item }: { item: Rental }) => {
    const hours = Number(item.actualHours) || Number(item.estimatedHours) || 0;
    const cost = Number(item.totalCostRenter) || 0;
    const tone = getStatusTone(item.status);

    return (
      <View style={styles.rentalCard}>
        <View style={styles.cardTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rentalTitle}>Rental #{(item.id || '').slice(0, 8)}</Text>
            <Text style={styles.rentalSubtitle}>
              {formatDate(item.startDate)} → {formatDate(item.endDate)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: tone.background }]}>
            <Text style={[styles.statusText, { color: tone.text }]}>{tone.label}</Text>
          </View>
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricCardLabel}>Hours</Text>
            <Text style={styles.metricCardValue}>{hours.toFixed(1)}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricCardLabel}>Cost</Text>
            <Text style={styles.metricCardValue}>${cost.toFixed(0)}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricCardLabel}>Rate</Text>
            <Text style={styles.metricCardValue}>
              {item.hourlyRate ? `$${Number(item.hourlyRate).toFixed(0)}/hr` : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.cardActionRow}>
          {(item.status === 'approved' || item.status === 'active') && (
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => navigation.navigate('Messages')}
              activeOpacity={0.92}
            >
              <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
              <Text style={styles.secondaryActionText}>Messages</Text>
            </TouchableOpacity>
          )}

          {item.status === 'completed' && (
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => {
                setSelectedRental(item);
                setReviewDialogVisible(true);
              }}
              activeOpacity={0.92}
            >
              <Ionicons name="star-outline" size={16} color={colors.primary} />
              <Text style={styles.secondaryActionText}>Leave Review</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (!isAuthenticated && !authLoading) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.lockedPanel}>
          <Ionicons name="lock-closed-outline" size={34} color={colors.textSoft} />
          <Text style={styles.lockedTitle}>Sign in to manage rentals.</Text>
          <Text style={styles.lockedText}>
            Track requests, active bookings, and post-flight follow-up in one place.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Profile')} activeOpacity={0.92}>
            <Text style={styles.primaryButtonText}>Go to Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading || authLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading rentals...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={styles.errorTitle}>Unable to load rentals.</Text>
        <Text style={styles.errorText}>Refresh and try again. The rentals feed may be temporarily unavailable.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => refetch()} activeOpacity={0.92}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rentals || []}
        renderItem={renderRental}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.heroPanel}>
              <View style={styles.heroTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroEyebrow}>MY RENTALS</Text>
                  <Text style={styles.heroTitle}>Track bookings, follow active trips, and close the loop after each rental.</Text>
                  <Text style={styles.heroSubtitle}>
                    This is your renter/operator workspace for status, messaging, and post-flight review.
                  </Text>
                </View>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>{(rentals || []).length} total</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <SummaryTile label="Active" value={String(approvedCount)} />
                <SummaryTile label="Pending" value={String(pendingCount)} />
                <SummaryTile label="Completed" value={String(completedCount)} />
              </View>

              <View style={styles.summaryRow}>
                <SummaryTile label="Booked hours" value={`${totalBookedHours.toFixed(1)} hrs`} />
                <SummaryTile label="Workspace" value="Member" />
                <SummaryTile label="Messaging" value="Ready" />
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Rental History</Text>
              <Text style={styles.sectionSubtitle}>
                Open a rental to message the owner or leave a review after completion.
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="airplane-outline" size={40} color={colors.textSoft} />
            <Text style={styles.emptyTitle}>No rentals yet.</Text>
            <Text style={styles.emptyText}>Book your first aircraft and your active and completed rentals will appear here.</Text>
          </View>
        }
      />

      {selectedRental && (
        <ReviewDialog
          visible={reviewDialogVisible}
          onClose={() => {
            setReviewDialogVisible(false);
            setSelectedRental(null);
          }}
          rentalId={selectedRental.id}
          revieweeId={selectedRental.ownerId}
          revieweeName="Aircraft Owner"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
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
  lockedPanel: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  lockedTitle: {
    ...typography.h2,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  lockedText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
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
    marginBottom: spacing.lg,
    textAlign: 'center',
    maxWidth: 320,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
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
  rentalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  rentalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  rentalSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metricCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textSoft,
  },
  metricCardValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
  },
  cardActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  secondaryActionText: {
    fontSize: 13,
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
