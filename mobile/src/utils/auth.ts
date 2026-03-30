import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiEndpoints } from '../services/api';
import type { User } from '@shared/schema';
import { TokenStorage } from './tokenStorage';
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
        await syncPurchasesUser((response.data as any)?.id);
        return response.data;
      } catch (error) {
        // If token is invalid or expired, clear it
        await TokenStorage.clearTokens();
        await logOutPurchasesUser();
        return null;
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
      await syncPurchasesUser((data.user as any)?.id);
      
      // Update query cache with user data
      queryClient.setQueryData(['/api/mobile/auth/me'], data.user);
      
      // Invalidate to trigger refetch
      await queryClient.invalidateQueries({ queryKey: ['/api/mobile/auth/me'] });
    },
    onError: async () => {
      // Clear tokens on login error
      await TokenStorage.clearTokens();
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
      await syncPurchasesUser((data.user as any)?.id);
      
      // Update query cache with user data
      queryClient.setQueryData(['/api/mobile/auth/me'], data.user);
      
      // Invalidate to trigger refetch
      await queryClient.invalidateQueries({ queryKey: ['/api/mobile/auth/me'] });
    },
    onError: async () => {
      // Clear tokens on registration error
      await TokenStorage.clearTokens();
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
      await logOutPurchasesUser();
      return true;
    },
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
    },
  });
}
