import { useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RentalsStackParamList } from '../navigation/RentalsStack';
import { apiEndpoints } from '../services/api';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RentalsStackParamList, 'RentalPayment'>;

interface PaymentData {
  rentalId: string;
  aircraftId: string;
  amount: number;
  startDate: string;
  endDate: string;
  hours: number;
}

export default function RentalPaymentScreen({ route, navigation }: Props) {
  const { paymentData } = route.params as { paymentData: PaymentData };
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const webViewRef = useRef<WebView>(null);

  // Construct the payment URL with query parameters
  const paymentUrl = `${apiEndpoints.baseURL}/mobile-braintree-payment?` +
    `amount=${paymentData.amount}&` +
    `rentalId=${paymentData.rentalId}&` +
    `aircraftId=${paymentData.aircraftId}&` +
    `startDate=${encodeURIComponent(paymentData.startDate)}&` +
    `endDate=${encodeURIComponent(paymentData.endDate)}&` +
    `hours=${paymentData.hours}`;

  const handleMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'PAYMENT_SUCCESS') {
        setIsProcessing(true);
        
        // Complete the rental payment on the backend
        try {
          await apiEndpoints.rentals.completePayment(paymentData.rentalId, {
            paymentNonce: data.nonce,
            amount: paymentData.amount
          });

          Alert.alert(
            'Payment Successful',
            'Your rental has been confirmed!',
            [
              {
                text: 'OK',
                onPress: () => navigation.navigate('RentalsList')
              }
            ]
          );
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
        Alert.alert(
          'Payment Error',
          data.error || 'Failed to process payment',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  };

  if (isProcessing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1e40af" />
        <Text style={styles.processingText}>Processing your payment...</Text>
        <Text style={styles.processingSubtext}>Please do not close this screen</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#1e40af" />
          <Text style={styles.loadingText}>Loading payment form...</Text>
        </View>
      )}
      
      <WebView
        ref={webViewRef}
        source={{ uri: paymentUrl }}
        onMessage={handleMessage}
        onLoadEnd={() => setIsLoading(false)}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={true}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
          Alert.alert(
            'Connection Error',
            'Failed to load payment form. Please check your internet connection.',
            [
              {
                text: 'Retry',
                onPress: () => webViewRef.current?.reload()
              },
              {
                text: 'Cancel',
                onPress: () => navigation.goBack(),
                style: 'cancel'
              }
            ]
          );
        }}
      />

      {isLoading && (
        <View style={styles.secureIndicator}>
          <Ionicons name="lock-closed" size={16} color="#10b981" />
          <Text style={styles.secureText}>Secure Payment</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  processingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  processingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
  },
  secureIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  secureText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
});
