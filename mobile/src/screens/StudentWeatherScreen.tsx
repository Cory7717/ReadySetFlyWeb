import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';

function parseCategory(raw: string) {
  const visMatch = raw.match(/\s(\d{1,2})SM/);
  const visibility = visMatch ? parseInt(visMatch[1], 10) : 10;
  const ceilingMatch = raw.match(/(BKN|OVC)(\d{3})/);
  const ceiling = ceilingMatch ? parseInt(ceilingMatch[2], 10) * 100 : 10000;
  if (ceiling >= 3000 && visibility > 5) return 'VFR';
  if (ceiling >= 1000 && visibility >= 3) return 'MVFR';
  if (ceiling >= 500 && visibility >= 1) return 'IFR';
  return 'LIFR';
}

export default function StudentWeatherScreen() {
  const [icao, setIcao] = useState('KAUS');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const fetchWeather = async () => {
    const code = icao.trim().toUpperCase();
    if (!code) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/aviation-weather/${code}`);
      setResult(res.data);
    } catch (error: any) {
      setResult(null);
      Alert.alert('Weather', error?.response?.data?.error || 'Unable to load weather data.');
    } finally {
      setLoading(false);
    }
  };

  const raw = result?.metar?.rawOb || '';
  const category = raw ? parseCategory(raw) : 'UNKNOWN';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Student Weather</Text>
      <Text style={styles.subtitle}>Simplified training view. Always consult an instructor.</Text>

      <View style={styles.search}>
        <TextInput style={styles.input} value={icao} onChangeText={setIcao} placeholder="ICAO (e.g., KJFK)" />
        <TouchableOpacity style={styles.primaryButton} onPress={fetchWeather} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Check</Text>}
        </TouchableOpacity>
      </View>

      {result && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Flight Category</Text>
          <Text style={styles.category}>{category}</Text>
          <Text style={styles.metarLabel}>METAR</Text>
          <Text style={styles.metar}>{raw || 'Unavailable'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { color: '#6b7280', marginTop: 4 },
  search: { flexDirection: 'row', gap: 8, marginTop: 12 },
  input: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  primaryButton: { backgroundColor: '#1e40af', paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginTop: 16 },
  cardTitle: { fontSize: 14, color: '#6b7280' },
  category: { fontSize: 24, fontWeight: '700', color: '#111827', marginTop: 6 },
  metarLabel: { fontSize: 12, color: '#6b7280', marginTop: 10 },
  metar: { fontSize: 12, color: '#374151', marginTop: 4 },
});
