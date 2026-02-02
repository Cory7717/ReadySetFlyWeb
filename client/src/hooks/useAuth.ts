// Authentication hook (from blueprint:javascript_log_in_with_replit)
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  return {
    user: user || undefined,
    isLoading,
    isAuthenticated: !!user,
  };
}
