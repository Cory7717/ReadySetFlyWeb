import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsAuthenticated } from '../utils/auth';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

const WINGTIP_IMAGE = require('../../assets/wingtip.jpg');
const LOGO_IMAGE = require('../../assets/logo.png');

export default function HomeScreen({ navigation }: any) {
  const { isAuthenticated, user, isLoading } = useIsAuthenticated();

  const handleLogin = () => {
    navigation.navigate('Profile', { screen: 'Auth' });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hero Section with Wingtip Background */}
      <ImageBackground 
        source={WINGTIP_IMAGE}
        style={styles.hero}
        imageStyle={styles.heroImage}
      >
        <View style={styles.heroOverlay}>
          <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />
          <Text style={styles.heroTitle}>Ready Set Fly</Text>
          <Text style={styles.heroSubtitle}>The premier hub for General Aviation tools, training, and community.</Text>
          
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
          onPress={() => navigation.navigate('Profile', { screen: 'PilotTools' })}
          data-testid="button-pilot-tools"
        >
          <Ionicons name="compass-outline" size={32} color="#1e40af" />
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Pilot Tools</Text>
            <Text style={styles.actionSubtitle}>Flight planning, weather, plates</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => navigation.navigate('Profile', { screen: 'StudentHub' })}
          data-testid="button-student-hub"
        >
          <Ionicons name="school-outline" size={32} color="#1e40af" />
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Student Pilot Hub</Text>
            <Text style={styles.actionSubtitle}>Wizard, roadmap, study tools</Text>
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

      {/* Quick Calculators */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Calculators</Text>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Profile', { screen: 'CrosswindCalc' })}
          data-testid="button-crosswind-calc"
        >
          <Ionicons name="speedometer-outline" size={32} color="#1e40af" />
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Crosswind Calculator</Text>
            <Text style={styles.actionSubtitle}>Headwind & crosswind components</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Profile', { screen: 'DensityAltitude' })}
          data-testid="button-density-altitude"
        >
          <Ionicons name="analytics-outline" size={32} color="#1e40af" />
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Density Altitude</Text>
            <Text style={styles.actionSubtitle}>Pressure + density altitude</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Features */}
      <View style={styles.features}>
        <Text style={styles.sectionTitle}>Why Ready Set Fly</Text>
        
        <View style={styles.featureItem}>
          <Ionicons name="shield-checkmark" size={24} color="#10b981" />
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Pilot-first tools</Text>
            <Text style={styles.featureDescription}>Flight planning, training, logbook, and comms in one place</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <Ionicons name="cash" size={24} color="#10b981" />
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Marketplace growth</Text>
            <Text style={styles.featureDescription}>Rentals, schools, CFIs, and listings grow as the community grows</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <Ionicons name="chatbubbles" size={24} color="#10b981" />
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Verified community</Text>
            <Text style={styles.featureDescription}>Secure messaging and trusted profiles</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.lg,
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
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#e2e8f0',
    marginTop: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
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
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.h2,
    marginBottom: spacing.md,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  actionText: {
    flex: 1,
    marginLeft: 16,
  },
  actionTitle: {
    ...typography.h3,
  },
  actionSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  features: {
    padding: spacing.lg,
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
    ...typography.h3,
  },
  featureDescription: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
});
