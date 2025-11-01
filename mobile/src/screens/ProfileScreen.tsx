import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsAuthenticated, useLogin, useLogout } from '../utils/auth';

export default function ProfileScreen({ navigation }: any) {
  const { isAuthenticated, user, isLoading } = useIsAuthenticated();
  const login = useLogin();
  const logout = useLogout();

  const handleLogin = async () => {
    try {
      await login.mutateAsync();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1e40af" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Ionicons 
            name={isAuthenticated ? "person" : "person-outline"} 
            size={48} 
            color="#1e40af" 
          />
        </View>
        <Text style={styles.userName}>
          {isAuthenticated && user ? `${user.firstName} ${user.lastName}` : 'Guest User'}
        </Text>
        <Text style={styles.userEmail}>
          {isAuthenticated && user ? user.email : 'Sign in to view your profile'}
        </Text>
      </View>

      {isAuthenticated && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            
            <TouchableOpacity style={styles.menuItem} data-testid="button-personal-info">
              <Ionicons name="person-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>Personal Information</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation.navigate('Verification')}
              data-testid="button-verification-status"
            >
              <Ionicons name="shield-checkmark-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>Verification Status</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation.navigate('Balance')}
              data-testid="button-balance"
            >
              <Ionicons name="wallet-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>Balance & Withdrawals</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Activity</Text>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation.navigate('MyRentals')}
              data-testid="button-my-rentals"
            >
              <Ionicons name="airplane-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>My Rentals</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} data-testid="button-my-listings">
              <Ionicons name="list-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>My Listings</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} data-testid="button-reviews">
              <Ionicons name="star-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>Reviews</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            
            <TouchableOpacity style={styles.menuItem} data-testid="button-notifications">
              <Ionicons name="notifications-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>Notifications</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} data-testid="button-help">
              <Ionicons name="help-circle-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>Help & Support</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.signOutButton}
            onPress={handleLogout}
            disabled={logout.isPending}
            data-testid="button-sign-out"
          >
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.signOutButtonText}>
              {logout.isPending ? 'Signing out...' : 'Sign Out'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {!isAuthenticated && (
        <View style={styles.signInContainer}>
          <Ionicons name="lock-closed-outline" size={64} color="#9ca3af" />
          <Text style={styles.signInPrompt}>Sign in to access your profile</Text>
          <TouchableOpacity 
            style={styles.signInButton}
            onPress={handleLogin}
            disabled={login.isPending}
            data-testid="button-sign-in"
          >
            <Ionicons name="log-in-outline" size={20} color="#fff" />
            <Text style={styles.signInButtonText}>
              {login.isPending ? 'Signing in...' : 'Sign In with Replit'}
            </Text>
          </TouchableOpacity>
        </View>
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
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  userEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    marginLeft: 12,
  },
  signInContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
  },
  signInPrompt: {
    fontSize: 18,
    color: '#6b7280',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e40af',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fee2e2',
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginLeft: 8,
  },
});
