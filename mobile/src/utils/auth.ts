import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiEndpoints } from '../services/api';
import type { User } from '@shared/schema';
import { TokenStorage } from './tokenStorage';
import { AuthSessionCache } from './authSessionCache';
import { errorDiagnostic, logDiagnostic, warnDiagnostic } from './diagnostics';
import { logOutPurchasesUser, syncPurchasesUser } from '../services/purchases';

/**
 * Hook to get current authenticated user
 * Returns null if not authenticated
 */
export function useAuth() {
  return useQuery({
    queryKey: ['/api/mobile/auth/me'],
    queryFn: async () => {
      try {
        // Check if we have a token first
        const token = await TokenStorage.getAccessToken();
        if (!token) {
          return null;
        }

        const response = await apiEndpoints.mobileAuth.getMe();
        await AuthSessionCache.setUser(response.data as User);
        await syncPurchasesUser((response.data as any)?.id);
        logDiagnostic('auth', 'me_loaded', { userId: (response.data as any)?.id });
        return response.data;
      } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (status === 401 || status === 403) {
          warnDiagnostic('auth', 'me_invalidated_session', { status });
          await TokenStorage.clearTokens();
          await AuthSessionCache.clear();
          await logOutPurchasesUser();
          return null;
        }

        const cachedUser = await AuthSessionCache.getUser();
        if (cachedUser) {
          warnDiagnostic('auth', 'me_using_cached_user', { status });
          return cachedUser;
        }

        errorDiagnostic('auth', 'me_failed_without_cache', {
          status,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Check if user is authenticated
 */
export function useIsAuthenticated() {
  const { data: user, isLoading } = useAuth();
  return { 
    isAuthenticated: !!user, 
    isLoading,
    user: user as User | null
  };
}

/**
 * Hook to handle login with email/password
 */
export function useLogin() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await apiEndpoints.mobileAuth.login(credentials);
      return response.data;
    },
    onSuccess: async (data) => {
      // Store tokens in secure storage
      await TokenStorage.setTokens(data.accessToken, data.refreshToken);
      await AuthSessionCache.setUser(data.user as User);
      await syncPurchasesUser((data.user as any)?.id);
      
      // Update query cache with user data
      queryClient.setQueryData(['/api/mobile/auth/me'], data.user);
      
      // Invalidate to trigger refetch
      await queryClient.invalidateQueries({ queryKey: ['/api/mobile/auth/me'] });
    },
    onError: async () => {
      // Clear tokens on login error
      await TokenStorage.clearTokens();
      await AuthSessionCache.clear();
      await logOutPurchasesUser();
    },
  });
}

/**
 * Hook to handle registration with email/password
 */
export function useRegister() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
    }) => {
      const response = await apiEndpoints.mobileAuth.register({
        ...data,
        firstName: data.firstName ?? '',
        lastName: data.lastName ?? '',
      });
      return response.data;
    },
    onSuccess: async (data) => {
      // Store tokens in secure storage
      await TokenStorage.setTokens(data.accessToken, data.refreshToken);
      await AuthSessionCache.setUser(data.user as User);
      await syncPurchasesUser((data.user as any)?.id);
      
      // Update query cache with user data
      queryClient.setQueryData(['/api/mobile/auth/me'], data.user);
      
      // Invalidate to trigger refetch
      await queryClient.invalidateQueries({ queryKey: ['/api/mobile/auth/me'] });
    },
    onError: async () => {
      // Clear tokens on registration error
      await TokenStorage.clearTokens();
      await AuthSessionCache.clear();
      await logOutPurchasesUser();
    },
  });
}

/**
 * Hook to handle logout
 */
export function useLogout() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const refreshToken = await TokenStorage.getRefreshToken();
      if (refreshToken) {
        await apiEndpoints.mobileAuth.logout(refreshToken);
      }
      // Clear tokens from secure storage
      await TokenStorage.clearTokens();
      await AuthSessionCache.clear();
      await logOutPurchasesUser();
      return true;
    },
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
    },
  });
}
