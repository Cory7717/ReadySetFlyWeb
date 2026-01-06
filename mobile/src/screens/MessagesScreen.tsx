import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiEndpoints } from '../services/api';
import { RentalMessaging } from '../components/RentalMessaging';
import { useIsAuthenticated } from '../utils/auth';
import type { Rental } from '@shared/schema';

export default function MessagesScreen({ navigation }: any) {
  const { isAuthenticated, user, isLoading: authLoading } = useIsAuthenticated();
  const [selectedRental, setSelectedRental] = useState<string | null>(null);

  // Fetch user's rentals (active conversations)
  const { data: rentals, isLoading } = useQuery({
    queryKey: ['/api/user/rentals'],
    queryFn: async () => {
      const response = await apiEndpoints.rentals.getByUser();
      // Filter to only approved or active rentals (can have messages)
      return response.data.filter((r: Rental) => 
        r.status === 'approved' || r.status === 'active' || r.status === 'completed'
      );
    },
    enabled: isAuthenticated,
  });

  if (!isAuthenticated && !authLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="lock-closed-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyTitle}>Sign in required</Text>
          <Text style={styles.emptyText}>
            Sign in to view your messages
          </Text>
          <TouchableOpacity 
            style={styles.signInButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.signInButtonText}>Go to Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading || authLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1e40af" />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  // If a rental is selected, show the messaging component
  if (selectedRental && user) {
    return (
      <View style={styles.container}>
        <View style={styles.chatHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setSelectedRental(null)}
          >
            <Ionicons name="arrow-back" size={24} color="#1e40af" />
            <Text style={styles.backText}>Conversations</Text>
          </TouchableOpacity>
        </View>
        <RentalMessaging rentalId={selectedRental} userId={user.id} />
      </View>
    );
  }

  const renderConversation = ({ item }: { item: Rental }) => (
    <TouchableOpacity 
      style={styles.conversationCard}
      onPress={() => setSelectedRental(item.id)}
    >
      <View style={styles.conversationIcon}>
        <Ionicons name="airplane" size={24} color="#1e40af" />
      </View>
      <View style={styles.conversationInfo}>
        <Text style={styles.conversationTitle}>Rental #{item.id.slice(0, 8)}</Text>
        <Text style={styles.conversationSubtitle}>
          {item.status === 'approved' ? 'Active rental' : 
           item.status === 'completed' ? 'Completed rental' : 
           'Rental conversation'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={rentals}
        keyExtractor={(item) => item.id}
        renderItem={renderConversation}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={80} color="#9ca3af" />
            <Text style={styles.emptyTitle}>No Messages Yet</Text>
            <Text style={styles.emptyText}>
              Messages with aircraft owners and renters will appear here once you have active rentals
            </Text>
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
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
  },
  chatHeader: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    color: '#1e40af',
    marginLeft: 8,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  conversationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  conversationSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  signInButton: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
