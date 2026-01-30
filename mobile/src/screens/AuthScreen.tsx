import { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking
} from 'react-native';
import { useLogin, useRegister } from '../utils/auth';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://readysetfly-api.onrender.com';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const navigation = useNavigation<any>();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  const handleDeepLink = useCallback(async (event: { url: string }) => {
    const url = event.url;
    console.log('Deep link received:', url);

    if (url.startsWith('readysetfly://oauth-callback')) {
      const params = new URLSearchParams(url.split('?')[1]);
      const exchangeToken = params.get('token');

      if (exchangeToken) {
        try {
          setIsOAuthLoading(true);
          const response = await fetch(`${API_BASE_URL}/api/auth/exchange-oauth-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: exchangeToken }),
          });

          if (!response.ok) {
            throw new Error('Failed to exchange OAuth token');
          }

          const data = await response.json();
          await SecureStore.setItemAsync('accessToken', data.accessToken);
          await SecureStore.setItemAsync('refreshToken', data.refreshToken);
            // The auth state will be updated automatically by the App component
            navigation.replace('ProfileHome');
        } catch (error) {
          console.error('OAuth exchange error:', error);
          Alert.alert('Error', 'Failed to complete OAuth login');
        } finally {
          setIsOAuthLoading(false);
        }
      }
    }
  }, []);

  useEffect(() => {

    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [handleDeepLink]);

  const handleGoogleLogin = async () => {
    try {
      setIsOAuthLoading(true);
      const authUrl = `${API_BASE_URL}/api/auth/google/mobile`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, 'readysetfly://oauth-callback');

      if (result.type === 'success' && result.url) {
        await handleDeepLink({ url: result.url });
      } else if (result.type === 'cancel') {
        Alert.alert('Cancelled', 'OAuth login was cancelled');
      } else if (result.type === 'dismiss') {
        console.log('OAuth browser dismissed');
      }
    } catch (error) {
      console.error('OAuth error:', error);
      Alert.alert('Error', 'Failed to initiate OAuth login');
    } finally {
      setIsOAuthLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Basic validation
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!isLogin) {
      if (password !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }
      if (password.length < 8) {
        Alert.alert('Error', 'Password must be at least 8 characters');
        return;
      }
    }

    try {
      if (isLogin) {
        await loginMutation.mutateAsync({ email, password });
        navigation.replace('ProfileHome');
      } else {
        await registerMutation.mutateAsync({
          email,
          password,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        });
        navigation.replace('ProfileHome');
      }
      // Navigation handled by auth state change
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Authentication failed';
      Alert.alert('Error', message);
    }
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending || isOAuthLoading;

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="airplane" size={60} color="#1e40af" />
          <Text style={styles.title}>Ready Set Fly</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Welcome back!' : 'Create your account'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {!isLogin && (
            <>
              <View style={styles.row}>
                <View style={[styles.inputContainer, styles.halfWidth]}>
                  <Text style={styles.label}>First Name</Text>
                  <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="John"
                    autoCapitalize="words"
                    testID="input-firstname"
                  />
                </View>

                <View style={[styles.inputContainer, styles.halfWidth]}>
                  <Text style={styles.label}>Last Name</Text>
                  <TextInput
                    style={styles.input}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Doe"
                    autoCapitalize="words"
                    testID="input-lastname"
                  />
                </View>
              </View>
            </>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              testID="input-email"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                testID="input-password"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
                testID="button-toggle-password"
              >
                <Ionicons 
                  name={showPassword ? "eye-off" : "eye"} 
                  size={24} 
                  color="#6b7280" 
                />
              </TouchableOpacity>
            </View>
          </View>

          {!isLogin && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password-new"
                textContentType="newPassword"
                testID="input-confirm-password"
              />
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
            testID="button-submit"
          >
            {(loginMutation.isPending || registerMutation.isPending) ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isLogin ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google OAuth Button */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={isLoading}
            testID="button-google-oauth"
          >
            {isOAuthLoading ? (
              <ActivityIndicator color="#1e40af" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#1e40af" />
                <Text style={styles.googleButtonText}>Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Toggle between login and register */}
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleText}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
            </Text>
            <TouchableOpacity 
              onPress={() => {
                setIsLogin(!isLogin);
                setPassword('');
                setConfirmPassword('');
              }}
              testID="button-toggle-mode"
            >
              <Text style={styles.toggleLink}>
                {isLogin ? 'Sign Up' : 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    marginTop: spacing.md,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  form: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 16,
    backgroundColor: colors.surface,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  eyeIcon: {
    padding: 12,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadow.card,
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 13,
    marginHorizontal: spacing.md,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  googleButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  toggleText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  toggleLink: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
});
