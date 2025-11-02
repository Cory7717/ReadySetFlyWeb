import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsAuthenticated } from '../utils/auth';

const WINGTIP_IMAGE = require('../../assets/wingtip.jpg');
const LOGO_IMAGE = require('../../assets/logo.png');

export default function HomeScreen({ navigation }: any) {
  const { isAuthenticated, user, isLoading } = useIsAuthenticated();

  const handleLogin = () => {
    navigation.navigate('Profile', { screen: 'Auth' });
  };

  return (
    <ScrollView style={styles.container}>
      {/* Hero Section with Wingtip Background */}
      <ImageBackground 
        source={WINGTIP_IMAGE}
        style={styles.hero}
        imageStyle={styles.heroImage}
      >
        <View style={styles.heroOverlay}>
          <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />
          <Text style={styles.heroTitle}>Ready Set Fly</Text>
          <Text style={styles.heroSubtitle}>Aviation Marketplace & Rental Platform</Text>
          
          {!isAuthenticated && !isLoading && (
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={handleLogin}
              data-testid="button-login-home"
            >
              <Ionicons name="log-in-outline" size={20} color="#fff" />
              <Text style={styles.loginButtonText}>
                Sign In
              </Text>
            </TouchableOpacity>
          )}
          
          {isAuthenticated && user && (
            <View style={styles.welcomeContainer}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.welcomeText}>Welcome back, {user.firstName}!</Text>
            </View>
          )}
        </View>
      </ImageBackground>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => navigation.navigate('Rentals')}
          data-testid="button-browse-aircraft"
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
          data-testid="button-marketplace"
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
          data-testid="button-my-profile"
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
    height: 320,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    opacity: 0.9,
  },
  heroOverlay: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(30, 64, 175, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#fff',
    marginTop: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  welcomeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 20,
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
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
