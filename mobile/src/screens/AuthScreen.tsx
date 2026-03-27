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
  Linking,
} from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLogin, useRegister } from '../utils/auth';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { TokenStorage } from '../utils/tokenStorage';
import { syncPurchasesUser } from '../services/purchases';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://readysetfly-api.onrender.com';

WebBrowser.maybeCompleteAuthSession();

type FeaturePillProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

function FeaturePill({ icon, label }: FeaturePillProps) {
  return (
    <View style={styles.featurePill}>
      <Ionicons name={icon} size={14} color="#dbeafe" />
      <Text style={styles.featurePillText}>{label}</Text>
    </View>
  );
}

export default function AuthScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const handledExchangeTokenRef = useRef<string | null>(null);

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  const handleDeepLink = useCallback(async (event: { url: string }) => {
    const url = event.url;

    if (url.startsWith('readysetfly://oauth-callback')) {
      const params = new URLSearchParams(url.split('?')[1]);
      const exchangeToken = params.get('token');

      if (exchangeToken) {
        if (handledExchangeTokenRef.current === exchangeToken) {
          return;
        }
        handledExchangeTokenRef.current = exchangeToken;
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
          await TokenStorage.setTokens(data.accessToken, data.refreshToken);
          await syncPurchasesUser((data.user as any)?.id);
          queryClient.setQueryData(['/api/mobile/auth/me'], data.user);
          await queryClient.invalidateQueries({ queryKey: ['/api/mobile/auth/me'] });
          navigation.replace('ProfileHome');
        } catch (error) {
          console.error('OAuth exchange error:', error);
          handledExchangeTokenRef.current = null;
          Alert.alert('Error', 'Failed to complete OAuth login');
        } finally {
          setIsOAuthLoading(false);
        }
      }
    }
  }, [navigation, queryClient]);

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
      }
    } catch (error) {
      console.error('OAuth error:', error);
      Alert.alert('Error', 'Failed to initiate OAuth login');
    } finally {
      setIsOAuthLoading(false);
    }
  };

  const handleSubmit = async () => {
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
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Ionicons name="navigate" size={14} color="#bfdbfe" />
            <Text style={styles.heroBadgeText}>RSF ACCOUNT</Text>
          </View>
          <Text style={styles.heroTitle}>Plan on the web. Fly in the app.</Text>
          <Text style={styles.heroSubtitle}>
            Sign in to sync your routes, logbook, rentals, alerts, and cockpit workflow across every RSF surface.
          </Text>
          <View style={styles.featureRow}>
            <FeaturePill icon="map-outline" label="Flight plans" />
            <FeaturePill icon="book-outline" label="Logbook sync" />
            <FeaturePill icon="airplane-outline" label="Live cockpit tools" />
          </View>
        </View>

        <View style={styles.authCard}>
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeButton, isLogin && styles.modeButtonActive]}
              onPress={() => {
                setIsLogin(true);
                setPassword('');
                setConfirmPassword('');
              }}
              activeOpacity={0.92}
            >
              <Text style={[styles.modeButtonText, isLogin && styles.modeButtonTextActive]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, !isLogin && styles.modeButtonActive]}
              onPress={() => {
                setIsLogin(false);
                setPassword('');
                setConfirmPassword('');
              }}
              activeOpacity={0.92}
            >
              <Text style={[styles.modeButtonText, !isLogin && styles.modeButtonTextActive]}>Create Account</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{isLogin ? 'Welcome back' : 'Create your RSF account'}</Text>
            <Text style={styles.cardSubtitle}>
              {isLogin
                ? 'Pick up where you left off with synced plans, tools, and pilot workspace data.'
                : 'A free account unlocks saved planning, rental access, and member-only workflow continuity.'}
            </Text>
          </View>

          {!isLogin && (
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>First name</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="John"
                  autoCapitalize="words"
                  testID="input-firstname"
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Last name</Text>
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
          )}

          <View style={styles.inputGroup}>
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="........"
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
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={colors.textSoft}
                />
              </TouchableOpacity>
            </View>
          </View>

          {!isLogin && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="........"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password-new"
                textContentType="newPassword"
                testID="input-confirm-password"
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.92}
            testID="button-submit"
          >
            {loginMutation.isPending || registerMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={isLoading}
            activeOpacity={0.92}
            testID="button-google-oauth"
          >
            {isOAuthLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={colors.primary} />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setIsLogin(!isLogin);
                setPassword('');
                setConfirmPassword('');
              }}
              testID="button-toggle-mode"
            >
              <Text style={styles.footerLink}>{isLogin ? 'Create one' : 'Sign in'}</Text>
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
    padding: spacing.sm,
    paddingBottom: 120,
  },
  hero: {
    backgroundColor: colors.cockpit,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.floating,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(147,197,253,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: '#bfdbfe',
  },
  heroTitle: {
    ...typography.display,
    color: '#fff',
    marginTop: spacing.md,
    maxWidth: 320,
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
    maxWidth: 350,
  },
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  featurePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#eff6ff',
  },
  authCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  modeButtonTextActive: {
    color: colors.primaryStrong,
  },
  cardHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.h1,
  },
  cardSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfWidth: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  eyeIcon: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  submitButton: {
    marginTop: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...shadow.floating,
  },
  submitButtonDisabled: {
    backgroundColor: '#8aa2bb',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    fontSize: 12,
    color: colors.textMuted,
  },
  googleButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...shadow.card,
  },
  googleButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryStrong,
  },
  footerRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
});
