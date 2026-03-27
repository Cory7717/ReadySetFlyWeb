import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiEndpoints } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
import { WithdrawalModal } from '../components/WithdrawalModal';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

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

export default function BalanceScreen({ navigation }: any) {
  const { isAuthenticated, isLoading: authLoading } = useIsAuthenticated();
  const queryClient = useQueryClient();
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);

  const { data: balanceData } = useQuery({
    queryKey: ['/api/user/balance'],
    queryFn: async () => {
      const response = await apiEndpoints.user.getBalance();
      return response.data;
    },
    enabled: isAuthenticated,
  });

  const { data: withdrawals, isLoading: isLoadingWithdrawals } = useQuery({
    queryKey: ['/api/withdrawals'],
    queryFn: async () => {
      const response = await apiEndpoints.withdrawals.getAll();
      return response.data;
    },
    enabled: isAuthenticated,
  });

  const withdrawalMutation = useMutation({
    mutationFn: async ({ amount, paypalEmail }: { amount: number; paypalEmail: string }) => {
      const response = await apiEndpoints.withdrawals.create({
        amount,
        paypalEmail,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawals'] });
      setShowWithdrawalModal(false);
      Alert.alert(
        'Withdrawal Successful',
        'Your withdrawal has been processed and sent to your PayPal account!',
        [{ text: 'OK' }]
      );
    },
    onError: (error: any) => {
      Alert.alert(
        'Withdrawal Failed',
        error.response?.data?.error || 'Failed to process withdrawal. Please try again.',
        [{ text: 'OK' }]
      );
    },
  });

  const balance = balanceData?.balance || 0;
  const withdrawalList = withdrawals || [];
  const completedCount = withdrawalList.filter((item: any) => item.status === 'completed').length;
  const pendingCount = withdrawalList.filter((item: any) =>
    item.status === 'pending' || item.status === 'processing'
  ).length;

  const handleWithdraw = async (amount: number, paypalEmail: string) => {
    await withdrawalMutation.mutateAsync({ amount, paypalEmail });
  };

  if (!isAuthenticated && !authLoading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.heroPanel}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="wallet-outline" size={34} color="#93c5fd" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>FINANCE WORKSPACE</Text>
              <Text style={styles.heroTitle}>Sign in to view your balance.</Text>
              <Text style={styles.heroSubtitle}>
                Payouts, withdrawal history, and operator earnings all live in one member workspace once you sign in.
              </Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <SummaryTile label="Balance" value="Locked" />
            <SummaryTile label="Withdrawals" value="Locked" />
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="wallet-outline" size={34} color="#93c5fd" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>FINANCE WORKSPACE</Text>
            <Text style={styles.heroTitle}>Operator earnings and payouts.</Text>
            <Text style={styles.heroSubtitle}>
              Track available balance, cash-out history, and payout readiness in one secure member surface.
            </Text>
          </View>
        </View>

        <Text style={styles.heroBalanceLabel}>Available balance</Text>
        <Text style={styles.heroBalanceAmount}>${balance.toFixed(2)}</Text>

        <View style={styles.summaryRow}>
          <SummaryTile label="Completed" value={String(completedCount)} />
          <SummaryTile label="Pending" value={String(pendingCount)} />
          <SummaryTile label="History" value={String(withdrawalList.length)} />
        </View>

        <TouchableOpacity
          style={[styles.heroAction, balance <= 0 && styles.heroActionDisabled]}
          disabled={balance <= 0}
          onPress={() => setShowWithdrawalModal(true)}
          activeOpacity={0.92}
          data-testid="button-withdraw"
        >
          <Ionicons name="cash-outline" size={18} color="#fff" />
          <Text style={styles.heroActionText}>Withdraw to PayPal</Text>
        </TouchableOpacity>
      </View>

      <SectionCard
        title="How RSF earnings work"
        subtitle="The payout model is designed to stay transparent for both owners and renters."
      >
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoText}>
              When renters book your aircraft, you receive the rental amount minus a 7.5% platform commission. Renters pay the rental amount plus a separate 7.5% service fee, so Ready Set Fly’s total take is 15%.
            </Text>
            <Text style={styles.infoText}>
              Withdrawals are processed instantly to your PayPal account when eligible.
            </Text>
          </View>
        </View>
      </SectionCard>

      <SectionCard
        title="Withdrawal history"
        subtitle="Review recent payouts, statuses, and any failed withdrawal notes."
      >
        {isLoadingWithdrawals ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading withdrawals...</Text>
          </View>
        ) : withdrawalList.length > 0 ? (
          withdrawalList.map((withdrawal: any) => (
            <View key={withdrawal.id} style={styles.withdrawalCard}>
              <View style={styles.withdrawalHeader}>
                <View style={styles.withdrawalInfo}>
                  <Text style={styles.withdrawalAmount}>${Number(withdrawal.amount).toFixed(2)}</Text>
                  <Text style={styles.withdrawalEmail}>{withdrawal.paypalEmail}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    withdrawal.status === 'completed' && styles.statusCompleted,
                    withdrawal.status === 'processing' && styles.statusProcessing,
                    withdrawal.status === 'pending' && styles.statusPending,
                    withdrawal.status === 'failed' && styles.statusFailed,
                  ]}
                >
                  <Text style={styles.statusText}>{withdrawal.status}</Text>
                </View>
              </View>
              <Text style={styles.withdrawalDate}>
                {format(new Date(withdrawal.createdAt), 'MMM d, yyyy h:mm a')}
              </Text>
              {withdrawal.status === 'failed' && withdrawal.failureReason ? (
                <Text style={styles.failureReason}>{withdrawal.failureReason}</Text>
              ) : null}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={30} color={colors.textSoft} />
            <Text style={styles.emptyTitle}>No withdrawals yet</Text>
            <Text style={styles.emptyText}>
              Once you process your first payout, the full withdrawal history will show up here.
            </Text>
          </View>
        )}
      </SectionCard>

      <WithdrawalModal
        visible={showWithdrawalModal}
        balance={balance}
        onConfirm={handleWithdraw}
        onCancel={() => setShowWithdrawalModal(false)}
      />
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
  heroBalanceLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#bfdbfe',
    textTransform: 'uppercase',
    marginTop: spacing.lg,
  },
  heroBalanceAmount: {
    fontSize: 44,
    fontWeight: '800',
    color: '#fff',
    marginTop: 8,
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
    backgroundColor: colors.success,
  },
  heroActionDisabled: {
    backgroundColor: '#64748b',
  },
  heroActionText: {
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
  infoCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  withdrawalCard: {
    backgroundColor: colors.backgroundElevated,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  withdrawalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  withdrawalInfo: {
    flex: 1,
  },
  withdrawalAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  withdrawalEmail: {
    fontSize: 13,
    color: colors.textMuted,
  },
  withdrawalDate: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusCompleted: {
    backgroundColor: '#dcfce7',
  },
  statusProcessing: {
    backgroundColor: '#dbeafe',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusFailed: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
    color: colors.text,
  },
  failureReason: {
    fontSize: 12,
    color: colors.danger,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
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
