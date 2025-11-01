import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MarketplaceStackParamList } from '../navigation/MarketplaceStack';
import { apiEndpoints } from '../services/api';

type Props = NativeStackScreenProps<MarketplaceStackParamList, 'MarketplaceDetail'>;

export default function MarketplaceDetailScreen({ route }: Props) {
  const { listingId } = route.params;

  const { data: listing, isLoading, error } = useQuery({
    queryKey: ['/api/marketplace', listingId],
    queryFn: async () => {
      const response = await apiEndpoints.marketplace.getById(listingId);
      return response.data;
    },
  });

  const handleContact = () => {
    if (listing?.email) {
      Linking.openURL(`mailto:${listing.email}`);
    } else if (listing?.phone) {
      Linking.openURL(`tel:${listing.phone}`);
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
      {(listing.email || listing.phone) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          
          {listing.email && (
            <View style={styles.contactRow}>
              <Ionicons name="mail-outline" size={20} color="#6b7280" />
              <Text style={styles.contactText}>{listing.email}</Text>
            </View>
          )}
          
          {listing.phone && (
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={20} color="#6b7280" />
              <Text style={styles.contactText}>{listing.phone}</Text>
            </View>
          )}
        </View>
      )}

      {/* Contact Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.contactButton} onPress={handleContact}>
          <Ionicons name="chatbubble-outline" size={20} color="#fff" />
          <Text style={styles.contactButtonText}>Contact Seller</Text>
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
});
