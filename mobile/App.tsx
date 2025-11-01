import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import type { AircraftListing } from '@shared/schema';

export default function App() {
  // Example: Demonstrate shared type usage
  const exampleListing: AircraftListing | null = null;
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ready Set Fly</Text>
      <Text style={styles.subtitle}>Aviation Marketplace & Rental Platform</Text>
      <Text style={styles.info}>Mobile App - Phase 1 Complete</Text>
      <Text style={styles.features}>✓ Shared types configured {exampleListing ? '✓' : '✓'}</Text>
      <Text style={styles.features}>✓ TypeScript setup complete</Text>
      <Text style={styles.features}>✓ Expo environment ready</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e40af',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#93c5fd',
    marginBottom: 30,
    textAlign: 'center',
  },
  info: {
    fontSize: 14,
    color: '#dbeafe',
    marginBottom: 20,
  },
  features: {
    fontSize: 14,
    color: '#bfdbfe',
    marginVertical: 5,
  },
});
