import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';

const SALES_TAX_RATE = 0.0825;
const PLANS = [
  { key: 'MONTHLY', label: 'Monthly', price: 5.99 },
  { key: 'BIANNUAL', label: '6 Months', price: 34.99 },
  { key: 'YEARLY', label: 'Yearly', price: 49.99 },
] as const;

export default function LogbookProScreen() {
  const { isAuthenticated, user } = useIsAuthenticated();
  const [selectedPlan, setSelectedPlan] = useState<(typeof PLANS)[number]['key']>('MONTHLY');
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign in required', 'Please sign in to upgrade to Logbook Pro.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/api/paypal/logbook/subscribe', { plan: selectedPlan });
      const approveUrl = res.data?.approveUrl;
      if (!approveUrl) {
        throw new Error('Missing approval link.');
      }
      await Linking.openURL(approveUrl);
    } catch (error: any) {
      Alert.alert('Subscription error', error?.response?.data?.error || error.message || 'Unable to start subscription.');
    } finally {
      setLoading(false);
    }
  };

  const plan = PLANS.find((p) => p.key === selectedPlan)!;
  const tax = plan.price * SALES_TAX_RATE;
  const total = plan.price + tax;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Logbook Pro</Text>
        <Text style={styles.subtitle}>
          Advanced flight planning, radio comms training, and premium logbook tools.
        </Text>
      </View>

      <View style={styles.featureList}>
        {[
          'Advanced flight planning with aircraft profiles and route risk flags.',
          'Saved plans, per-leg breakdowns, and unlimited route storage.',
          'Radio Comms Trainer: full scenarios, audio practice, and scoring feedback.',
          'Pro currency tools, exports, and priority support.',
        ].map((item) => (
          <View key={item} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text style={styles.featureText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.planGrid}>
        {PLANS.map((p) => {
          const isSelected = p.key === selectedPlan;
          const pTax = p.price * SALES_TAX_RATE;
          const pTotal = p.price + pTax;
          return (
            <TouchableOpacity
              key={p.key}
              style={[styles.planCard, isSelected && styles.planCardActive]}
              onPress={() => setSelectedPlan(p.key)}
            >
              <Text style={styles.planLabel}>{p.label}</Text>
              <Text style={styles.planPrice}>${p.price.toFixed(2)}</Text>
              <Text style={styles.planMeta}>+ tax ${pTax.toFixed(2)} = ${pTotal.toFixed(2)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total today</Text>
        <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleSubscribe} disabled={loading}>
        <Text style={styles.primaryButtonText}>{loading ? 'Redirecting...' : 'Upgrade with PayPal'}</Text>
      </TouchableOpacity>

      {user?.logbookProStatus && (
        <Text style={styles.statusText}>Current status: {user.logbookProStatus}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16 },
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subtitle: { marginTop: 6, color: '#6b7280' },
  featureList: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  featureText: { flex: 1, fontSize: 13, color: '#374151' },
  planGrid: { gap: 10 },
  planCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  planCardActive: { borderColor: '#1e40af', backgroundColor: '#eef2ff' },
  planLabel: { fontSize: 14, color: '#6b7280' },
  planPrice: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 4 },
  planMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  totalLabel: { fontSize: 14, color: '#6b7280' },
  totalValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  primaryButton: { backgroundColor: '#1e40af', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  statusText: { marginTop: 10, fontSize: 12, color: '#6b7280' },
});
