import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>STUDENT WEATHER</Text>
        <Text style={styles.heroTitle}>See the training day in simpler terms.</Text>
        <Text style={styles.heroSubtitle}>
          Pull the current METAR and translate it into a basic flight category before you talk through the details with your instructor.
        </Text>
      </View>

      <View style={styles.searchCard}>
        <Text style={styles.sectionTitle}>Airport Check</Text>
        <View style={styles.searchRow}>
          <TextInput style={styles.input} value={icao} onChangeText={setIcao} placeholder="ICAO (e.g., KJFK)" />
          <TouchableOpacity style={styles.primaryButton} onPress={fetchWeather} disabled={loading} activeOpacity={0.92}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Check</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {result && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Flight Category</Text>
          <Text style={styles.category}>{category}</Text>
          <Text style={styles.metarLabel}>METAR</Text>
          <Text style={styles.metar}>{raw || 'Unavailable'}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.sm, paddingBottom: 120 },
  hero: { backgroundColor: colors.cockpit, borderRadius: radius.xl, padding: spacing.lg, ...shadow.floating },
  heroEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: '#93c5fd' },
  heroTitle: { ...typography.display, color: '#fff', marginTop: spacing.sm },
  heroSubtitle: { ...typography.body, color: '#dbe4f0', marginTop: spacing.sm },
  searchCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  sectionTitle: { ...typography.h2 },
  searchRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  input: { flex: 1, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 14 },
  primaryButton: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', minWidth: 86, ...shadow.card },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  card: { marginTop: spacing.lg, backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  cardTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  category: { ...typography.display, marginTop: spacing.xs },
  metarLabel: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md, fontWeight: '700' },
  metar: { ...typography.body, marginTop: spacing.xs },
});
