import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { apiEndpoints } from '../services/api';

export default function BalanceScreen() {
  const { data: balanceData } = useQuery({
    queryKey: ['/api/user/balance'],
    queryFn: async () => {
      const response = await apiEndpoints.user.getBalance();
      return response.data;
    },
  });

  const balance = balanceData?.balance || 0;

  return (
    <View style={styles.container}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>${balance.toFixed(2)}</Text>
        
        <TouchableOpacity 
          style={[styles.withdrawButton, balance <= 0 && styles.withdrawButtonDisabled]}
          disabled={balance <= 0}
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
            When renters book your aircraft, you earn 82.5% of the rental cost. The platform fee (18%) covers payment processing, insurance, and platform maintenance.
          </Text>
          <Text style={styles.infoDescription}>
            Withdrawals are processed instantly to your PayPal account.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Withdrawal History</Text>
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={48} color="#9ca3af" />
          <Text style={styles.emptyText}>No withdrawals yet</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
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
});
