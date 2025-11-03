import { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { apiEndpoints } from '../services/api';

export default function MarketplacePaymentScreen({ route, navigation }: any) {
  const { amount, listingData } = route.params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const paymentUrl = `${apiEndpoints.baseURL}/mobile-paypal-marketplace-payment?amount=${amount}&category=${listingData.category}&tier=${listingData.tier || 'basic'}`;

  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'PAYMENT_SUCCESS') {
        // Submit listing with payment confirmation
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
    }
  };

  const submitListingWithPayment = async (orderID: string) => {
    try {
      const fullListingData = {
        ...listingData,
        paymentIntentId: orderID,
      };

      await apiEndpoints.marketplace.create(fullListingData);
      
      Alert.alert(
        'Success!',
        'Your listing has been created and is now live.',
        [{ text: 'OK', onPress: () => navigation.navigate('MarketplaceHome') }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create listing');
      navigation.goBack();
    }
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubtext}>
          Unable to load payment form. Please try again.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e40af" />
          <Text style={styles.loadingText}>Loading payment form...</Text>
        </View>
      )}
      
      <WebView
        source={{ uri: paymentUrl }}
        onMessage={handleWebViewMessage}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError('Failed to load payment form');
        }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
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
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
