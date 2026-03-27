import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiEndpoints } from '../services/api';
import { RentalMessaging } from '../components/RentalMessaging';
import { useIsAuthenticated } from '../utils/auth';
import type { Rental } from '@shared/schema';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function statusLabel(status?: string) {
  switch (status) {
    case 'approved':
    case 'active':
      return 'Active rental';
    case 'completed':
      return 'Completed rental';
    default:
      return 'Rental conversation';
  }
}

function statusTone(status?: string) {
  switch (status) {
    case 'approved':
    case 'active':
      return { background: colors.accentSoft, text: colors.accent };
    case 'completed':
      return { background: colors.surfaceMuted, text: colors.textMuted };
    default:
      return { background: colors.primarySoft, text: colors.primary };
  }
}

export default function MessagesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user, isLoading: authLoading } = useIsAuthenticated();
  const [selectedRental, setSelectedRental] = useState<string | null>(null);

  const { data: rentals, isLoading } = useQuery({
    queryKey: ['/api/user/rentals'],
    queryFn: async () => {
      const response = await apiEndpoints.rentals.getByUser();
      return response.data.filter(
        (r: Rental) => r.status === 'approved' || r.status === 'active' || r.status === 'completed'
      );
    },
    enabled: isAuthenticated,
  });

  const activeCount = useMemo(
    () => (rentals || []).filter((item) => item.status === 'approved' || item.status === 'active').length,
    [rentals]
  );
  const completedCount = useMemo(
    () => (rentals || []).filter((item) => item.status === 'completed').length,
    [rentals]
  );

  if (!isAuthenticated && !authLoading) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.lockedPanel}>
          <Ionicons name="lock-closed-outline" size={34} color={colors.textSoft} />
          <Text style={styles.lockedTitle}>Sign in to view conversations.</Text>
          <Text style={styles.lockedText}>
            Owner and renter messages live here once you have active or completed rentals.
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
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  if (selectedRental && user) {
    return (
      <View style={styles.container}>
        <View style={[styles.threadHeaderWrap, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
          <View style={styles.threadHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => setSelectedRental(null)} activeOpacity={0.92}>
              <Ionicons name="arrow-back" size={20} color={colors.primary} />
              <Text style={styles.backText}>Back to conversations</Text>
            </TouchableOpacity>
            <View style={styles.threadBadge}>
              <Text style={styles.threadBadgeText}>Rental #{selectedRental.slice(0, 8)}</Text>
            </View>
          </View>
        </View>
        <RentalMessaging rentalId={selectedRental} userId={user.id} />
      </View>
    );
  }

  const renderConversation = ({ item }: { item: Rental }) => {
    const tone = statusTone(item.status);
    return (
      <TouchableOpacity style={styles.conversationCard} onPress={() => setSelectedRental(item.id)} activeOpacity={0.92}>
        <View style={styles.conversationIcon}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.conversationInfo}>
          <Text style={styles.conversationTitle}>Rental #{item.id.slice(0, 8)}</Text>
          <Text style={styles.conversationSubtitle}>{statusLabel(item.status)}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: tone.background }]}>
          <Text style={[styles.statusPillText, { color: tone.text }]}>
            {item.status === 'approved' ? 'approved' : item.status}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={rentals}
        keyExtractor={(item) => item.id}
        renderItem={renderConversation}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: Math.max(insets.top, spacing.sm), paddingBottom: 120 + insets.bottom },
        ]}
        ListHeaderComponent={
          <>
            <View style={styles.heroPanel}>
              <View style={styles.heroTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroEyebrow}>MESSAGES</Text>
                  <Text style={styles.heroTitle}>Keep owner and renter communication in the same workflow as the booking.</Text>
                  <Text style={styles.heroSubtitle}>
                    Conversations stay tied to the rental so you can follow approvals, logistics, and closeout without context switching.
                  </Text>
                </View>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>{(rentals || []).length} threads</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <SummaryTile label="Active" value={String(activeCount)} />
                <SummaryTile label="Completed" value={String(completedCount)} />
                <SummaryTile label="Workspace" value="Ready" />
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Conversations</Text>
              <Text style={styles.sectionSubtitle}>Open a thread to continue the conversation tied to that specific rental.</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.textSoft} />
            <Text style={styles.emptyTitle}>No messages yet.</Text>
            <Text style={styles.emptyText}>
              Messages with owners and renters will appear here once you have an active or completed rental.
            </Text>
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
  threadHeaderWrap: {
    padding: spacing.sm,
    backgroundColor: colors.background,
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    ...shadow.card,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  backText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  threadBadge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  threadBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
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
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  conversationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  conversationSubtitle: {
    ...typography.muted,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
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
