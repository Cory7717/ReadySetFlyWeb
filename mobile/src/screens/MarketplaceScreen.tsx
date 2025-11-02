import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PromoBanner } from '../components/PromoBanner';

const WINGTIP_IMAGE = require('../../assets/wingtip.jpg');

const categories = [
  { id: 'Aviation Jobs', icon: 'briefcase', color: '#1e40af' },
  { id: 'Aircraft For Sale', icon: 'pricetag', color: '#7c3aed' },
  { id: 'CFIs', icon: 'school', color: '#0891b2' },
  { id: 'Flight Schools', icon: 'business', color: '#059669' },
  { id: 'Mechanics', icon: 'construct', color: '#dc2626' },
  { id: 'Charter Services', icon: 'business-outline', color: '#ea580c' },
];

export default function MarketplaceScreen({ navigation }: any) {
  return (
    <ScrollView style={styles.container}>
      <ImageBackground 
        source={WINGTIP_IMAGE}
        style={styles.header}
        imageStyle={styles.headerImage}
      >
        <View style={styles.headerOverlay}>
          <Ionicons name="storefront" size={40} color="#fff" />
          <Text style={styles.headerTitle}>Aviation Marketplace</Text>
          <Text style={styles.headerSubtitle}>Browse listings by category</Text>
        </View>
      </ImageBackground>

      {/* Promo Banner - Auto-refreshes every 30 seconds to show admin-created promos */}
      <PromoBanner />

      {/* Create Listing Button */}
      <TouchableOpacity
        style={styles.createListingButton}
        onPress={() => navigation.navigate('CreateMarketplaceListing')}
        data-testid="button-create-listing"
      >
        <Ionicons name="add-circle" size={24} color="#fff" />
        <Text style={styles.createListingText}>Create New Listing</Text>
      </TouchableOpacity>

      <View style={styles.categories}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[styles.categoryCard, { borderLeftColor: category.color }]}
            onPress={() => navigation.navigate('MarketplaceCategory', { category: category.id })}
          >
            <View style={[styles.iconContainer, { backgroundColor: category.color + '20' }]}>
              <Ionicons name={category.icon as any} size={32} color={category.color} />
            </View>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryTitle}>{category.id}</Text>
              <Text style={styles.categorySubtitle}>View listings</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#9ca3af" />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.infoSection}>
        <Ionicons name="information-circle" size={24} color="#1e40af" />
        <Text style={styles.infoText}>
          Connect with aviation professionals, find jobs, buy aircraft, and discover services across the aviation community.
        </Text>
      </View>
    </ScrollView>
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
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    marginTop: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  categories: {
    padding: 16,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
    marginLeft: 16,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  categorySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#dbeafe',
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e3a8a',
    marginLeft: 12,
    lineHeight: 20,
  },
  createListingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  createListingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});
