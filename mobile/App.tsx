import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
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

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    NavigationBar.setPositionAsync('absolute').catch(() => undefined);
    NavigationBar.setBackgroundColorAsync('#00000000').catch(() => undefined);
    NavigationBar.setButtonStyleAsync('dark').catch(() => undefined);
    NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => undefined);
    NavigationBar.setVisibilityAsync('hidden').catch(() => undefined);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AppNavigator />
        <PushTokenRegistrar />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
