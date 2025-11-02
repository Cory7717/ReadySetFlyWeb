import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiEndpoints } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
import { WithdrawalModal } from '../components/WithdrawalModal';
import { format } from 'date-fns';

export default function BalanceScreen({ navigation }: any) {
  const { isAuthenticated, isLoading: authLoading } = useIsAuthenticated();
  const queryClient = useQueryClient();
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  
  const { data: balanceData, isLoading } = useQuery({
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
        paypalEmail
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

  const handleWithdraw = async (amount: number, paypalEmail: string) => {
    await withdrawalMutation.mutateAsync({ amount, paypalEmail });
  };

  if (!isAuthenticated && !authLoading) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="lock-closed-outline" size={64} color="#9ca3af" />
        <Text style={styles.emptyText}>Sign in to view your balance</Text>
        <TouchableOpacity 
          style={styles.signInButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={styles.signInButtonText}>Go to Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>${balance.toFixed(2)}</Text>
        
        <TouchableOpacity 
          style={[styles.withdrawButton, balance <= 0 && styles.withdrawButtonDisabled]}
          disabled={balance <= 0}
          onPress={() => setShowWithdrawalModal(true)}
          data-testid="button-withdraw"
        >
          <Ionicons name="cash-outline" size={20} color="#fff" />
          <Text style={styles.withdrawButtonText}>Withdraw to PayPal</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={24} color="#1e40af" />
        <View style={styles.infoText}>
          <Text style={styles.infoTitle}>How Earnings Work</Text>
          <Text style={styles.infoDescription}>
            When renters book your aircraft, you receive the rental amount minus a 7.5% platform commission. The renter pays the rental amount plus an additional 7.5% service fee, so Ready Set Fly's total take is 15% (7.5% from each side).
          </Text>
          <Text style={styles.infoDescription}>
            Withdrawals are processed instantly to your PayPal account.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Withdrawal History</Text>
        
        {isLoadingWithdrawals ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#1e40af" />
          </View>
        ) : withdrawals && withdrawals.length > 0 ? (
          <>
            {withdrawals.map((withdrawal: any) => (
              <View key={withdrawal.id} style={styles.withdrawalCard}>
                <View style={styles.withdrawalHeader}>
                  <View style={styles.withdrawalInfo}>
                    <Text style={styles.withdrawalAmount}>${Number(withdrawal.amount).toFixed(2)}</Text>
                    <Text style={styles.withdrawalEmail}>{withdrawal.paypalEmail}</Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    withdrawal.status === 'completed' && styles.statusCompleted,
                    withdrawal.status === 'processing' && styles.statusProcessing,
                    withdrawal.status === 'pending' && styles.statusPending,
                    withdrawal.status === 'failed' && styles.statusFailed,
                  ]}>
                    <Text style={styles.statusText}>{withdrawal.status}</Text>
                  </View>
                </View>
                <Text style={styles.withdrawalDate}>
                  {format(new Date(withdrawal.createdAt), 'MMM d, yyyy h:mm a')}
                </Text>
                {withdrawal.status === 'failed' && withdrawal.failureReason && (
                  <Text style={styles.failureReason}>{withdrawal.failureReason}</Text>
                )}
              </View>
            ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyText}>No withdrawals yet</Text>
          </View>
        )}
      </View>

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
    backgroundColor: '#f3f4f6',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  balanceCard: {
    backgroundColor: '#1e40af',
    padding: 32,
    margin: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#93c5fd',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  withdrawButtonDisabled: {
    backgroundColor: '#6b7280',
  },
  withdrawButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#dbeafe',
    padding: 16,
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e3a8a',
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 14,
    color: '#1e3a8a',
    lineHeight: 20,
    marginBottom: 8,
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
  signInButton: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  withdrawalCard: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1e40af',
  },
  withdrawalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  withdrawalInfo: {
    flex: 1,
  },
  withdrawalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  withdrawalEmail: {
    fontSize: 14,
    color: '#6b7280',
  },
  withdrawalDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  statusCompleted: {
    backgroundColor: '#d1fae5',
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
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
    color: '#1f2937',
  },
  failureReason: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
