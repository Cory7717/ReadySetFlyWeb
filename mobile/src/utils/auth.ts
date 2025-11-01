import { useQuery } from '@tanstack/react-query';
import { apiEndpoints } from '../services/api';
import type { User } from '@shared/schema';

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
