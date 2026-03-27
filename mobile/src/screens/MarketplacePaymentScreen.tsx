import { useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { apiEndpoints } from '../services/api';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export default function MarketplacePaymentScreen({ route, navigation }: any) {
  const { listingData, amount } = route.params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const paymentUrl = `${apiEndpoints.baseURL}/mobile-paypal-marketplace-payment?category=${listingData.category}&tier=${
    listingData.tier || 'basic'
  }`;

  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'PAYMENT_SUCCESS') {
        setProcessing(true);
        await submitListingWithPayment(data.orderID);
      } else if (data.type === 'PAYMENT_ERROR') {
        Alert.alert('Payment Failed', data.error || 'An error occurred');
        navigation.goBack();
      } else if (data.type === 'PAYMENT_CANCELLED') {
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error handling payment message:', error);
      Alert.alert('Error', 'Failed to process payment');
    } finally {
      setProcessing(false);
    }
  };

  const submitListingWithPayment = async (orderID: string) => {
    try {
      await apiEndpoints.marketplace.completeCreate({
        orderId: orderID,
        listingData,
      });

      Alert.alert('Success!', 'Your listing has been created and is now live.', [
        { text: 'OK', onPress: () => navigation.navigate('MarketplaceHome') },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create listing');
      navigation.goBack();
    }
  };

  if (error) {
    return (
      <View style={styles.errorScreen}>
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={44} color={colors.danger} />
          <Text style={styles.errorTitle}>Unable to load payment form.</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => setError('')} activeOpacity={0.92}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (processing) {
    return (
      <View style={styles.processingScreen}>
        <View style={styles.processingCard}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.processingTitle}>Finalizing your listing</Text>
          <Text style={styles.processingText}>
            RSF is confirming payment and publishing the listing. Keep this screen open for a moment.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topPanel}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>MARKETPLACE PAYMENT</Text>
              <Text style={styles.heroTitle}>Launch the listing through secure checkout.</Text>
              <Text style={styles.heroSubtitle}>
                Payment runs through PayPal, then RSF publishes the listing after confirmation.
              </Text>
            </View>
            <View style={styles.heroBadge}>
              <Ionicons name="lock-closed" size={14} color="#bbf7d0" />
              <Text style={styles.heroBadgeText}>Secure</Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <SummaryTile label="Title" value={listingData.title || 'Listing'} />
            <SummaryTile label="Tier" value={listingData.tier || 'basic'} />
            <SummaryTile label="Amount" value={`$${Number(amount || 0).toFixed(2)}`} />
          </View>
        </View>
      </View>

      <View style={styles.webviewCard}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingTitle}>Loading payment form...</Text>
            <Text style={styles.loadingText}>This can take a few seconds while PayPal initializes.</Text>
          </View>
        )}

        <WebView
          source={{ uri: paymentUrl }}
          onMessage={handleWebViewMessage}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError('Failed to load secure PayPal checkout. Please check your connection and try again.');
          }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
        />
      </View>

      <View style={styles.footerBar}>
        <View style={styles.footerInner}>
          <View style={styles.footerStatus}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.accent} />
            <Text style={styles.footerStatusText}>PayPal secure checkout</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topPanel: {
    padding: spacing.sm,
    paddingBottom: 0,
  },
  heroCard: {
    backgroundColor: colors.cockpit,
    borderRadius: radius.xl,
    padding: spacing.lg,
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
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: '#fff',
    marginTop: 10,
    maxWidth: 260,
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
    maxWidth: 300,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  webviewCard: {
    flex: 1,
    margin: spacing.sm,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    zIndex: 2,
    paddingHorizontal: spacing.lg,
  },
  loadingTitle: {
    ...typography.h3,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  footerBar: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  footerInner: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    ...shadow.card,
  },
  footerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  footerStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  processingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  processingCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadow.floating,
  },
  processingTitle: {
    ...typography.h2,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  processingText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  errorScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  errorCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadow.card,
  },
  errorTitle: {
    ...typography.h2,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  retryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
