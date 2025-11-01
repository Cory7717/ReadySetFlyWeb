import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RentalsStackParamList } from '../navigation/RentalsStack';
import { apiEndpoints } from '../services/api';

type Props = NativeStackScreenProps<RentalsStackParamList, 'AircraftDetail'>;

export default function AircraftDetailScreen({ route, navigation }: Props) {
  const { aircraftId } = route.params;

  const { data: aircraft, isLoading, error } = useQuery({
    queryKey: ['/api/aircraft', aircraftId],
    queryFn: async () => {
      const response = await apiEndpoints.aircraft.getById(aircraftId);
      return response.data;
    },
  });

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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.type}>{aircraft.type}</Text>
            <Text style={styles.nNumber}>{aircraft.nNumber}</Text>
          </View>
          {aircraft.available && (
            <View style={styles.availableBadge}>
              <Text style={styles.availableText}>Available</Text>
            </View>
          )}
        </View>
        <View style={styles.rateContainer}>
          <Text style={styles.rateAmount}>${aircraft.hourlyRate}</Text>
          <Text style={styles.rateLabel}>/hour</Text>
        </View>
      </View>

      {/* Location */}
      <View style={styles.section}>
        <View style={styles.infoRow}>
          <Ionicons name="location" size={20} color="#1e40af" />
          <Text style={styles.infoLabel}>Location:</Text>
          <Text style={styles.infoValue}>{aircraft.location}</Text>
        </View>
      </View>

      {/* Description */}
      {aircraft.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{aircraft.description}</Text>
        </View>
      )}

      {/* Specifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Specifications</Text>
        <View style={styles.specGrid}>
          {aircraft.year && (
            <View style={styles.specItem}>
              <Ionicons name="calendar-outline" size={20} color="#6b7280" />
              <Text style={styles.specLabel}>Year</Text>
              <Text style={styles.specValue}>{aircraft.year}</Text>
            </View>
          )}
          {aircraft.engineType && (
            <View style={styles.specItem}>
              <Ionicons name="settings-outline" size={20} color="#6b7280" />
              <Text style={styles.specLabel}>Engine</Text>
              <Text style={styles.specValue}>{aircraft.engineType}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Requirements */}
      {aircraft.requirements && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Requirements</Text>
          <Text style={styles.requirements}>{aircraft.requirements}</Text>
        </View>
      )}

      {/* Book Button */}
      {aircraft.available && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.bookButton}
            onPress={() => navigation.navigate('Booking', { aircraftId })}
          >
            <Text style={styles.bookButtonText}>Book This Aircraft</Text>
          </TouchableOpacity>
        </View>
      )}
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
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  type: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  nNumber: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  availableBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  availableText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  rateContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  rateAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  rateLabel: {
    fontSize: 16,
    color: '#6b7280',
    marginLeft: 4,
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4b5563',
    marginLeft: 8,
  },
  infoValue: {
    fontSize: 16,
    color: '#1f2937',
    marginLeft: 8,
  },
  description: {
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
  },
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  specItem: {
    width: '50%',
    padding: 8,
    alignItems: 'center',
  },
  specLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  specValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 2,
  },
  requirements: {
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
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
