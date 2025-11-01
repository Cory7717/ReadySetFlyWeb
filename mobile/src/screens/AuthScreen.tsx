import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiEndpoints } from '../services/api';

export default function AuthScreen() {
  const handleSignIn = async () => {
    try {
      // Open Replit Auth login in browser
      const loginUrl = apiEndpoints.auth.login();
      const supported = await Linking.canOpenURL(loginUrl);
      
      if (supported) {
        await Linking.openURL(loginUrl);
      } else {
        console.error('Cannot open URL:', loginUrl);
      }
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Ionicons name="airplane" size={80} color="#1e40af" />
          <Text style={styles.title}>Ready Set Fly</Text>
          <Text style={styles.subtitle}>Aviation Marketplace & Rental Platform</Text>
        </View>

        <View style={styles.features}>
          <View style={styles.featureItem}>
            <Ionicons name="shield-checkmark" size={24} color="#10b981" />
            <Text style={styles.featureText}>Verified pilots & aircraft</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="cash" size={24} color="#10b981" />
            <Text style={styles.featureText}>Secure payments</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="chatbubbles" size={24} color="#10b981" />
            <Text style={styles.featureText}>Real-time messaging</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.signInButton} onPress={handleSignIn}>
          <Text style={styles.signInButtonText}>Sign In with Replit</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  features: {
    marginBottom: 48,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureText: {
    fontSize: 16,
    color: '#1f2937',
    marginLeft: 16,
  },
  signInButton: {
    backgroundColor: '#1e40af',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  signInButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  disclaimer: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 18,
  },
});
