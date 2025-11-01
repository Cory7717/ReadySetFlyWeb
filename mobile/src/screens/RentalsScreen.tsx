import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RentalsStackParamList } from '../navigation/RentalsStack';
import { apiEndpoints } from '../services/api';
import type { AircraftListing } from '@shared/schema';

const WINGTIP_IMAGE = require('../../assets/wingtip.jpg');

type Props = NativeStackScreenProps<RentalsStackParamList, 'RentalsList'>;

export default function RentalsScreen({ navigation }: Props) {
  const { data: aircraft, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/aircraft'],
    queryFn: async () => {
      const response = await apiEndpoints.aircraft.getAll();
      return response.data;
    },
  });

  const renderAircraft = ({ item }: { item: AircraftListing }) => (
    <TouchableOpacity 
      style={styles.aircraftCard}
      onPress={() => navigation.navigate('AircraftDetail', { aircraftId: item.id })}
    >
      <View style={styles.cardHeader}>
        <Ionicons name="airplane" size={24} color="#1e40af" />
        <View style={styles.cardHeaderText}>
          <Text style={styles.aircraftType}>{item.make} {item.model}</Text>
          <Text style={styles.aircraftNumber}>{item.registration}</Text>
        </View>
      </View>
      
      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color="#6b7280" />
          <Text style={styles.infoText}>{item.location}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Ionicons name="cash-outline" size={16} color="#6b7280" />
          <Text style={styles.infoText}>${item.hourlyRate}/hour</Text>
        </View>
        
        {item.description && (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
      
      <View style={styles.cardFooter}>
        <View style={styles.viewDetailsButton}>
          <Text style={styles.viewDetailsText}>View Details</Text>
          <Ionicons name="chevron-forward" size={20} color="#1e40af" />
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1e40af" />
        <Text style={styles.loadingText}>Loading aircraft...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load aircraft listings</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={WINGTIP_IMAGE}
        style={styles.header}
        imageStyle={styles.headerImage}
      >
        <View style={styles.headerOverlay}>
          <Ionicons name="airplane" size={40} color="#fff" />
          <Text style={styles.headerTitle}>Browse Aircraft</Text>
          <Text style={styles.headerSubtitle}>Find your perfect aircraft rental</Text>
        </View>
      </ImageBackground>
      
      <FlatList
        data={aircraft || []}
        renderItem={renderAircraft}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="airplane-outline" size={64} color="#9ca3af" />
            <Text style={styles.emptyText}>No aircraft available</Text>
            <Text style={styles.emptySubtext}>Check back later for new listings</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerImage: {
    opacity: 0.9,
  },
  headerOverlay: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(30, 64, 175, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContainer: {
    padding: 16,
  },
  aircraftCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  aircraftType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  aircraftNumber: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  availableBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availableText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  cardBody: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#4b5563',
    marginLeft: 8,
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    lineHeight: 20,
  },
  cardFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewDetailsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginRight: 4,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#1e40af',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4b5563',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
});
