import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { apiEndpoints } from '../services/api';
import type { Rental } from '@shared/schema';
import { format, isValid } from 'date-fns';
import { useIsAuthenticated } from '../utils/auth';

export default function MyRentalsScreen({ navigation }: any) {
  const { isAuthenticated, isLoading: authLoading } = useIsAuthenticated();
  
  const { data: rentals, isLoading, error } = useQuery({
    queryKey: ['/api/user/rentals'],
    queryFn: async () => {
      const response = await apiEndpoints.rentals.getByUser();
      return response.data;
    },
    enabled: isAuthenticated,
  });

  const formatDate = (dateValue: any): string => {
    if (!dateValue) return 'N/A';
    const date = new Date(dateValue);
    return isValid(date) ? format(date, 'MMM dd, yyyy') : 'Invalid date';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'completed': return '#6b7280';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const renderRental = ({ item }: { item: Rental }) => {
    const hours = item.actualHours || item.estimatedHours || '0';
    const cost = item.totalCostRenter || '0';
    
    return (
      <View style={styles.rentalCard}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Ionicons name="airplane" size={20} color="#1e40af" />
            <Text style={styles.rentalId}>Rental #{item.id.slice(0, 8)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#6b7280" />
            <Text style={styles.infoText}>
              {formatDate(item.startDate)} - {formatDate(item.endDate)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color="#6b7280" />
            <Text style={styles.infoText}>{hours} hours</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="cash-outline" size={16} color="#6b7280" />
            <Text style={styles.infoText}>${cost}</Text>
          </View>
        </View>

        {item.status === 'approved' && (
          <View style={styles.cardFooter}>
            <TouchableOpacity style={styles.messageButton}>
              <Ionicons name="chatbubble-outline" size={16} color="#1e40af" />
              <Text style={styles.messageButtonText}>Message Owner</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (!isAuthenticated && !authLoading) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="lock-closed-outline" size={64} color="#9ca3af" />
        <Text style={styles.emptyText}>Sign in to view your rentals</Text>
        <TouchableOpacity 
          style={styles.signInButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={styles.signInButtonText}>Go to Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading || authLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1e40af" />
        <Text style={styles.loadingText}>Loading rentals...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load rentals</Text>
        <Text style={styles.errorSubtext}>Please check your connection and try again</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rentals || []}
        renderItem={renderRental}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="airplane-outline" size={64} color="#9ca3af" />
            <Text style={styles.emptyText}>No rentals yet</Text>
            <Text style={styles.emptySubtext}>Book your first aircraft to get started</Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContainer: {
    padding: 16,
  },
  rentalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rentalId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'capitalize',
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
  cardFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginLeft: 8,
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
  },
  errorSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
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
});
