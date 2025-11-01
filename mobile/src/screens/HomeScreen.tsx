import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen({ navigation }: any) {
  return (
    <ScrollView style={styles.container}>
      {/* Hero Section */}
      <View style={styles.hero}>
        <Ionicons name="airplane" size={60} color="#fff" />
        <Text style={styles.heroTitle}>Ready Set Fly</Text>
        <Text style={styles.heroSubtitle}>Aviation Marketplace & Rental Platform</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => navigation.navigate('Rentals')}
        >
          <Ionicons name="airplane-outline" size={32} color="#1e40af" />
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Browse Aircraft</Text>
            <Text style={styles.actionSubtitle}>Find and rent aircraft</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => navigation.navigate('Marketplace')}
        >
          <Ionicons name="storefront-outline" size={32} color="#1e40af" />
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Marketplace</Text>
            <Text style={styles.actionSubtitle}>Jobs, sales, CFIs & more</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => navigation.navigate('Profile')}
        >
          <Ionicons name="person-outline" size={32} color="#1e40af" />
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>My Profile</Text>
            <Text style={styles.actionSubtitle}>Manage account & verification</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Features */}
      <View style={styles.features}>
        <Text style={styles.sectionTitle}>Why Choose Ready Set Fly</Text>
        
        <View style={styles.featureItem}>
          <Ionicons name="shield-checkmark" size={24} color="#10b981" />
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Verified Pilots & Aircraft</Text>
            <Text style={styles.featureDescription}>All users and aircraft are thoroughly verified</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <Ionicons name="cash" size={24} color="#10b981" />
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Secure Payments</Text>
            <Text style={styles.featureDescription}>Protected transactions with instant payouts</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <Ionicons name="chatbubbles" size={24} color="#10b981" />
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Real-time Messaging</Text>
            <Text style={styles.featureDescription}>Connect directly with owners and renters</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  hero: {
    backgroundColor: '#1e40af',
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#93c5fd',
    marginTop: 8,
    textAlign: 'center',
  },
  quickActions: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    flex: 1,
    marginLeft: 16,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  features: {
    padding: 20,
    paddingTop: 0,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  featureText: {
    flex: 1,
    marginLeft: 16,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  featureDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
});
