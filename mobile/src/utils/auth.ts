import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiEndpoints } from '../services/api';
import type { User } from '@shared/schema';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

// Important: This tells the auth session to close automatically after redirect
WebBrowser.maybeCompleteAuthSession();

// Get the API base URL
const API_BASE_URL = 'https://readysetfly.us';

/**
 * Hook to get current authenticated user
 * Returns null if not authenticated
 */
export function useAuth() {
  return useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      try {
        const response = await apiEndpoints.auth.getUser();
        return response.data;
      } catch (error) {
        return null;
      }
    },
    retry: false,
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
 * Hook to handle login
 */
export function useLogin() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      // Use Expo's AuthSession to get a proper redirect URI
      // Note: For mobile apps with Replit Auth, we'll open the login in a browser
      // and the user will be redirected back to the web app
      // The mobile app will need to check auth status after returning from browser
      
      const loginUrl = `${API_BASE_URL}/api/login`;
      
      // Open the login page in a browser
      const result = await WebBrowser.openBrowserAsync(loginUrl);
      
      // After user returns from browser, check if they're now authenticated
      if (result.type === 'cancel' || result.type === 'dismiss') {
        // User closed the browser, check if auth succeeded anyway
        await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
        const userQuery = queryClient.getQueryData(['/api/auth/user']);
        return !!userQuery;
      }
      
      // Refetch user data to see if login succeeded
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      return true;
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
      await apiEndpoints.auth.logout();
      // Clear all cached data
      queryClient.clear();
      return true;
    },
  });
}
