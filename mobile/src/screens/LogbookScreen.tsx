import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';

type LogbookEntry = {
  id: string;
  flightDate: string;
  tailNumber?: string | null;
  aircraftType?: string | null;
  route?: string | null;
  timeDay?: string | number;
  timeNight?: string | number;
};

export default function LogbookScreen({ navigation }: any) {
  const { isAuthenticated } = useIsAuthenticated();
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadEntries = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await api.get('/api/logbook');
      setEntries(res.data || []);
    } catch (error: any) {
      Alert.alert('Logbook', error?.response?.data?.error || 'Unable to load logbook entries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={32} color="#9ca3af" />
        <Text style={styles.centerText}>Sign in to access your logbook.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Digital Logbook</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('LogbookEntry')}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>New Entry</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color="#1e40af" />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No logbook entries yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('LogbookEntry', { entryId: item.id })}
            >
              <View>
                <Text style={styles.cardTitle}>{item.flightDate}</Text>
                <Text style={styles.cardSubtitle}>
                  {item.tailNumber || 'N/A'} · {item.aircraftType || 'Aircraft'}
                </Text>
                {item.route && <Text style={styles.cardSubtitle}>Route: {item.route}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { padding: 16, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  primaryButton: { flexDirection: 'row', backgroundColor: '#1e40af', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center', gap: 6 },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  listContent: { padding: 16 },
  card: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  cardSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#6b7280' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { marginTop: 12, color: '#6b7280' },
});
