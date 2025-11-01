import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MessagesScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={80} color="#9ca3af" />
        <Text style={styles.emptyTitle}>No Messages Yet</Text>
        <Text style={styles.emptyText}>
          Messages with aircraft owners and renters will appear here
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
