import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import PushTokenRegistrar from './src/components/PushTokenRegistrar';
import { initializePurchases } from './src/services/purchases';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  useEffect(() => {
    initializePurchases().catch(() => undefined);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppNavigator />
      <PushTokenRegistrar />
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}
