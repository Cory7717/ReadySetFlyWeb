import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MarketplaceStackParamList } from '../navigation/MarketplaceStack';
import { apiEndpoints } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
import UpgradeListingModal from '../components/UpgradeListingModal';

type Props = NativeStackScreenProps<MarketplaceStackParamList, 'MarketplaceDetail'>;

export default function MarketplaceDetailScreen({ route }: Props) {
  const { listingId } = route.params;
  const { user } = useIsAuthenticated();
  const queryClient = useQueryClient();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const { data: listing, isLoading, error } = useQuery({
    queryKey: ['/api/marketplace', listingId],
    queryFn: async () => {
      const response = await apiEndpoints.marketplace.getById(listingId);
      return response.data;
    },
  });

  const isOwner = user && listing && listing.userId === user.id;

  const handleContact = () => {
    if (listing?.contactEmail) {
      // Create custom subject line based on category
      const categoryNames: Record<string, string> = {
        'aircraft-sale': 'Aircraft for Sale',
        'job': 'Aviation Job',
        'cfi': 'CFI Services',
        'flight-school': 'Flight School',
        'mechanic': 'Mechanic Services',
        'charter': 'Charter Service'
      };
      const categoryName = categoryNames[listing.category] || listing.category;
      const subject = encodeURIComponent(`Inquiry From Ready Set Fly about your ${categoryName} Listing: ${listing.title}`);
      const body = encodeURIComponent(`Hi,\n\nI'm interested in your ${categoryName} listing: ${listing.title}\n\n`);
      Linking.openURL(`mailto:${listing.contactEmail}?subject=${subject}&body=${body}`);
    } else if (listing?.contactPhone) {
      Linking.openURL(`tel:${listing.contactPhone}`);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  if (error || !listing) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load listing details</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{listing.title}</Text>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{listing.category}</Text>
        </View>
      </View>

      {/* Price */}
      {listing.price && (
        <View style={styles.section}>
          <Text style={styles.price}>${listing.price}</Text>
        </View>
      )}

      {/* Location */}
      {listing.location && (
        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Ionicons name="location" size={20} color="#1e40af" />
            <Text style={styles.infoValue}>{listing.location}</Text>
          </View>
        </View>
      )}

      {/* Description */}
      {listing.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{listing.description}</Text>
        </View>
      )}

      {/* Contact Information */}
      {(listing.contactEmail || listing.contactPhone) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          
          {listing.contactEmail && (
            <View style={styles.contactRow}>
              <Ionicons name="mail-outline" size={20} color="#6b7280" />
              <Text style={styles.contactText}>{listing.contactEmail}</Text>
            </View>
          )}
          
          {listing.contactPhone && (
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={20} color="#6b7280" />
              <Text style={styles.contactText}>{listing.contactPhone}</Text>
            </View>
          )}
        </View>
      )}

      {/* Tier Badge (for owners) */}
      {isOwner && listing.tier && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Listing Tier</Text>
          <View style={styles.tierBadge}>
            <Text style={styles.tierText}>
              {listing.tier === 'basic' ? 'Basic' : listing.tier === 'standard' ? 'Standard' : 'Premium'} Tier
            </Text>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        {isOwner ? (
          <>
            {listing.tier !== 'premium' && (
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() => setShowUpgradeModal(true)}
                data-testid="button-upgrade-listing"
              >
                <Ionicons name="trending-up" size={20} color="#fff" />
                <Text style={styles.upgradeButtonText}>Upgrade Listing</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <TouchableOpacity style={styles.contactButton} onPress={handleContact}>
            <Ionicons name="chatbubble-outline" size={20} color="#fff" />
            <Text style={styles.contactButtonText}>Contact Seller</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Upgrade Modal */}
      {isOwner && listing && (
        <UpgradeListingModal
          visible={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          listing={listing}
          onUpgradeSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/marketplace', listingId] });
            queryClient.invalidateQueries({ queryKey: ['/api/marketplace'] });
          }}
        />
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 12,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoValue: {
    fontSize: 16,
    color: '#1f2937',
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactText: {
    fontSize: 16,
    color: '#1f2937',
    marginLeft: 12,
  },
  tierBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  tierText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4b5563',
  },
  buttonContainer: {
    padding: 20,
  },
  contactButton: {
    backgroundColor: '#1e40af',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  upgradeButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});
