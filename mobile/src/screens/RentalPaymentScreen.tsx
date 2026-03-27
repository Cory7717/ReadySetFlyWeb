import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RentalsStackParamList } from '../navigation/RentalsStack';
import { apiEndpoints } from '../services/api';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type Props = NativeStackScreenProps<RentalsStackParamList, 'RentalPayment'>;

interface PaymentData {
  rentalId: string;
  aircraftId: string;
  amount: number;
  startDate: string;
  endDate: string;
  hours: number;
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export default function RentalPaymentScreen({ route, navigation }: Props) {
  const { paymentData } = route.params as { paymentData: PaymentData };
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const paymentUrl = `${apiEndpoints.baseURL}/mobile-paypal-rental-payment?rentalId=${paymentData.rentalId}`;

  const bookingWindow = useMemo(() => `${paymentData.startDate} → ${paymentData.endDate}`, [paymentData]);

  const handleMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'PAYMENT_SUCCESS') {
        setIsProcessing(true);

        try {
          await apiEndpoints.rentals.completePayment(paymentData.rentalId, {
            orderId: data.orderID,
          });

          Alert.alert('Payment Successful', 'Your rental has been confirmed!', [
            {
              text: 'OK',
              onPress: () => navigation.navigate('RentalsList'),
            },
          ]);
        } catch (error: any) {
          Alert.alert(
            'Payment Error',
            error.response?.data?.error || 'Failed to process payment. Please contact support.',
            [{ text: 'OK' }]
          );
        } finally {
          setIsProcessing(false);
        }
      } else if (data.type === 'PAYMENT_CANCELLED') {
        navigation.goBack();
      } else if (data.type === 'PAYMENT_ERROR') {
        Alert.alert('Payment Error', data.error || 'Failed to process payment', [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  };

  if (isProcessing) {
    return (
      <View style={styles.processingScreen}>
        <View style={styles.processingCard}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.processingTitle}>Processing your payment</Text>
          <Text style={styles.processingText}>Please keep this screen open while RSF confirms the rental.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topPanel}>
        <View style={styles.topHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>PAYMENT</Text>
            <Text style={styles.heroTitle}>Secure checkout for your rental request.</Text>
            <Text style={styles.heroSubtitle}>
              RSF hands you into PayPal for payment, then returns to finalize the booking.
            </Text>
          </View>
          <View style={styles.secureBadge}>
            <Ionicons name="lock-closed" size={14} color="#bbf7d0" />
            <Text style={styles.secureBadgeText}>Secure</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile label="Amount" value={`$${paymentData.amount.toFixed(2)}`} />
          <SummaryTile label="Hours" value={`${paymentData.hours.toFixed(1)} hrs`} />
          <SummaryTile label="Window" value={bookingWindow} />
        </View>
      </View>

      <View style={styles.webviewCard}>
        {isLoading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingTitle}>Loading secure payment form...</Text>
            <Text style={styles.loadingText}>This can take a few seconds while PayPal initializes.</Text>
          </View>
        ) : null}

        <WebView
          ref={webViewRef}
          source={{ uri: paymentUrl }}
          onMessage={handleMessage}
          onLoadEnd={() => setIsLoading(false)}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState={false}
          scalesPageToFit
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error:', nativeEvent);
            Alert.alert('Connection Error', 'Failed to load payment form. Please check your internet connection.', [
              {
                text: 'Retry',
                onPress: () => webViewRef.current?.reload(),
              },
              {
                text: 'Cancel',
                onPress: () => navigation.goBack(),
                style: 'cancel',
              },
            ]);
          }}
        />
      </View>

      <View style={styles.footerBar}>
        <View style={styles.footerBarInner}>
          <View style={styles.footerStatus}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.accent} />
            <Text style={styles.footerStatusText}>Powered by PayPal secure checkout</Text>
          </View>
          <TouchableOpacity
            style={styles.footerAction}
            onPress={() => webViewRef.current?.reload()}
            activeOpacity={0.92}
          >
            <Ionicons name="refresh" size={16} color={colors.primary} />
            <Text style={styles.footerActionText}>Reload</Text>
          </TouchableOpacity>
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
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  topHeader: {
    backgroundColor: colors.cockpit,
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    ...shadow.floating,
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
    maxWidth: 280,
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  secureBadge: {
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
  secureBadgeText: {
    color: '#bbf7d0',
    fontSize: 11,
    fontWeight: '800',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  summaryTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    ...shadow.card,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textSoft,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
  },
  webviewCard: {
    flex: 1,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
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
  processingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
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
  footerBar: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  footerBarInner: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shadow.card,
  },
  footerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  footerStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  footerActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
});
