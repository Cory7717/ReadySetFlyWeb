import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { apiEndpoints } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
import { FavoriteButton } from '../components/FavoriteButton';

type Tab = 'aircraft' | 'marketplace';

export default function FavoritesScreen({ navigation }: any) {
  const { isAuthenticated, isLoading: authLoading } = useIsAuthenticated();
  const [activeTab, setActiveTab] = useState<Tab>('aircraft');

  const { data: favorites, isLoading, refetch } = useQuery({
    queryKey: ['/api/favorites'],
    queryFn: async () => {
      const response = await apiEndpoints.favorites.getAll();
      return response.data;
    },
    enabled: isAuthenticated,
  });

  if (!isAuthenticated && !authLoading) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="lock-closed-outline" size={64} color="#9ca3af" />
        <Text style={styles.emptyTitle}>Sign in required</Text>
        <Text style={styles.emptyText}>
          Sign in to save your favorite aircraft and listings
        </Text>
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
        <Text style={styles.loadingText}>Loading favorites...</Text>
      </View>
    );
  }

  const aircraftFavorites = favorites?.aircraft || [];
  const marketplaceFavorites = favorites?.marketplace || [];

  return (
    <View style={styles.container}>
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'aircraft' && styles.activeTab]}
          onPress={() => setActiveTab('aircraft')}
        >
          <Text style={[styles.tabText, activeTab === 'aircraft' && styles.activeTabText]}>
            Aircraft ({aircraftFavorites.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'marketplace' && styles.activeTab]}
          onPress={() => setActiveTab('marketplace')}
        >
          <Text style={[styles.tabText, activeTab === 'marketplace' && styles.activeTabText]}>
            Marketplace ({marketplaceFavorites.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'aircraft' && (
          <>
            {aircraftFavorites.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="heart-outline" size={64} color="#9ca3af" />
                <Text style={styles.emptyTitle}>No favorite aircraft</Text>
                <Text style={styles.emptyText}>
                  Start adding aircraft to your favorites
                </Text>
              </View>
            ) : (
              aircraftFavorites.map((aircraft: any) => (
                <TouchableOpacity
                  key={aircraft.id}
                  style={styles.card}
                  onPress={() => navigation.navigate('Rentals', {
                    screen: 'AircraftDetail',
                    params: { aircraftId: aircraft.id }
                  })}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Ionicons name="airplane" size={24} color="#1e40af" />
                      <View style={styles.cardHeaderText}>
                        <Text style={styles.cardTitle}>{aircraft.make} {aircraft.model}</Text>
                        <Text style={styles.cardSubtitle}>{aircraft.registration}</Text>
                      </View>
                    </View>
                    <FavoriteButton
                      listingType="aircraft"
                      listingId={aircraft.id}
                      size={28}
                      onToggle={() => refetch()}
                    />
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                      <Ionicons name="location-outline" size={16} color="#6b7280" />
                      <Text style={styles.infoText}>{aircraft.location}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Ionicons name="cash-outline" size={16} color="#6b7280" />
                      <Text style={styles.infoText}>${aircraft.hourlyRate}/hour</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {activeTab === 'marketplace' && (
          <>
            {marketplaceFavorites.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="heart-outline" size={64} color="#9ca3af" />
                <Text style={styles.emptyTitle}>No favorite listings</Text>
                <Text style={styles.emptyText}>
                  Start adding marketplace listings to your favorites
                </Text>
              </View>
            ) : (
              marketplaceFavorites.map((listing: any) => (
                <TouchableOpacity
                  key={listing.id}
                  style={styles.card}
                  onPress={() => navigation.navigate('Marketplace', {
                    screen: 'MarketplaceDetail',
                    params: { listingId: listing.id }
                  })}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Ionicons name="storefront" size={24} color="#7c3aed" />
                      <View style={styles.cardHeaderText}>
                        <Text style={styles.cardTitle}>{listing.title}</Text>
                        <Text style={styles.cardSubtitle}>{listing.category}</Text>
                      </View>
                    </View>
                    <FavoriteButton
                      listingType="marketplace"
                      listingId={listing.id}
                      size={28}
                      onToggle={() => refetch()}
                    />
                  </View>
                  <View style={styles.cardBody}>
                    {listing.location && (
                      <View style={styles.infoRow}>
                        <Ionicons name="location-outline" size={16} color="#6b7280" />
                        <Text style={styles.infoText}>{listing.location}</Text>
                      </View>
                    )}
                    {listing.price && (
                      <View style={styles.infoRow}>
                        <Ionicons name="cash-outline" size={16} color="#6b7280" />
                        <Text style={styles.infoText}>${listing.price}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}
      </ScrollView>
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
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#1e40af',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#1e40af',
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 12,
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
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
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
