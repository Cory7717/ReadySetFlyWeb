import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';

type Plate = {
  name: string;
  type?: string | null;
  url: string;
};

export default function ApproachPlatesScreen() {
  const [icao, setIcao] = useState('KJFK');
  const [plates, setPlates] = useState<Plate[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const handleSearch = async () => {
    const code = icao.trim().toUpperCase();
    if (!code || code.length < 3) {
      Alert.alert('Enter an airport code', 'Please enter a valid ICAO (e.g., KJFK).');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/api/plates/${code}`);
      setPlates(res.data?.plates || []);
      setFetchedAt(res.data?.fetchedAt || null);
    } catch (error: any) {
      setPlates([]);
      Alert.alert('Unable to fetch plates', error?.response?.data?.error || 'Try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  const openPlate = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Unable to open plate', 'Please try again.');
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          value={icao}
          onChangeText={setIcao}
          autoCapitalize="characters"
          placeholder="Enter ICAO (e.g., KJFK)"
          maxLength={5}
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="search" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Plates for {icao.toUpperCase()}</Text>
        {fetchedAt && <Text style={styles.metaText}>Updated {new Date(fetchedAt).toLocaleString()}</Text>}
      </View>

      <FlatList
        data={plates}
        keyExtractor={(item, index) => `${item.url}-${index}`}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={32} color="#9ca3af" />
              <Text style={styles.emptyText}>No plates found yet. Try another ICAO.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openPlate(item.url)}>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              {!!item.type && <Text style={styles.cardSubtitle}>{item.type}</Text>}
            </View>
            <Ionicons name="open-outline" size={20} color="#1e40af" />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#1e40af',
    padding: 12,
    borderRadius: 10,
    marginLeft: 8,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  metaText: { fontSize: 12, color: '#6b7280' },
  listContent: { paddingBottom: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  cardText: { flex: 1, marginRight: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  emptyState: { alignItems: 'center', marginTop: 32 },
  emptyText: { marginTop: 8, color: '#6b7280' },
});
