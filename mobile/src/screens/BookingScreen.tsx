import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RentalsStackParamList } from '../navigation/RentalsStack';
import { useQuery } from '@tanstack/react-query';
import { apiEndpoints } from '../services/api';

type Props = NativeStackScreenProps<RentalsStackParamList, 'Booking'>;

export default function BookingScreen({ route, navigation }: Props) {
  const { aircraftId } = route.params;
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hours, setHours] = useState('');

  const { data: aircraft, isLoading, error } = useQuery({
    queryKey: ['/api/aircraft', aircraftId],
    queryFn: async () => {
      const response = await apiEndpoints.aircraft.getById(aircraftId);
      return response.data;
    },
  });

  const calculateTotal = () => {
    const hoursNum = parseFloat(hours);
    if (!aircraft || !hoursNum || isNaN(hoursNum)) return 0;
    
    const hourlyRate = Number(aircraft.hourlyRate);
    const baseCost = hourlyRate * hoursNum;
    const platformFee = baseCost * 0.18; // 18% platform fee
    const salesTax = baseCost * 0.0825; // 8.25% sales tax
    return baseCost + platformFee + salesTax;
  };

  const handleBooking = () => {
    if (!startDate || !endDate || !hours) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }

    // TODO: Navigate to payment screen
    const aircraftName = `${aircraft?.make} ${aircraft?.model}`;
    Alert.alert(
      'Booking Confirmation',
      `You're about to book ${aircraftName} for ${hours} hours.\n\nTotal: $${calculateTotal().toFixed(2)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Proceed to Payment', 
          onPress: () => {
            // TODO: Implement payment flow
            Alert.alert('Payment', 'Payment integration coming soon!');
          }
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  if (error || !aircraft) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load aircraft details</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Aircraft Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aircraft</Text>
        <Text style={styles.aircraftType}>{aircraft.make} {aircraft.model}</Text>
        <Text style={styles.aircraftNumber}>{aircraft.registration}</Text>
        <Text style={styles.rate}>${Number(aircraft.hourlyRate).toFixed(2)}/hour</Text>
      </View>

      {/* Date Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rental Period</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Start Date</Text>
          <TextInput
            style={styles.input}
            placeholder="MM/DD/YYYY"
            value={startDate}
            onChangeText={setStartDate}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>End Date</Text>
          <TextInput
            style={styles.input}
            placeholder="MM/DD/YYYY"
            value={endDate}
            onChangeText={setEndDate}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Estimated Hours</Text>
          <TextInput
            style={styles.input}
            placeholder="0.0"
            value={hours}
            onChangeText={setHours}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      {/* Cost Breakdown */}
      {hours && parseFloat(hours) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cost Breakdown</Text>
          
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Base Cost ({hours} hrs × ${Number(aircraft.hourlyRate).toFixed(2)})</Text>
            <Text style={styles.costValue}>${(Number(aircraft.hourlyRate) * parseFloat(hours)).toFixed(2)}</Text>
          </View>

          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Platform Fee (18%)</Text>
            <Text style={styles.costValue}>${(Number(aircraft.hourlyRate) * parseFloat(hours) * 0.18).toFixed(2)}</Text>
          </View>

          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Sales Tax (8.25%)</Text>
            <Text style={styles.costValue}>${(Number(aircraft.hourlyRate) * parseFloat(hours) * 0.0825).toFixed(2)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.costRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${calculateTotal().toFixed(2)}</Text>
          </View>
        </View>
      )}

      {/* Book Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.bookButton} onPress={handleBooking}>
          <Text style={styles.bookButtonText}>Continue to Payment</Text>
        </TouchableOpacity>
      </View>
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
    backgroundColor: '#f3f4f6',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    marginTop: 12,
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  aircraftType: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  aircraftNumber: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  rate: {
    fontSize: 16,
    color: '#1e40af',
    fontWeight: '600',
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  costLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  costValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  buttonContainer: {
    padding: 20,
  },
  bookButton: {
    backgroundColor: '#1e40af',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  bookButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});
