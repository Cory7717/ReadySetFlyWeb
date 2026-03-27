import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

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
      <FlatList
        data={plates}
        keyExtractor={(item, index) => `${item.url}-${index}`}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>APPROACH PLATES</Text>
              <Text style={styles.heroTitle}>Pull the current plate set without leaving your IFR flow.</Text>
              <Text style={styles.heroSubtitle}>
                Search by airport, review the current set, and open the exact plate you need.
              </Text>
            </View>

            <View style={styles.searchCard}>
              <Text style={styles.sectionTitle}>Search by ICAO</Text>
              <Text style={styles.sectionSubtitle}>Enter the airport you want to brief.</Text>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.input}
                  value={icao}
                  onChangeText={setIcao}
                  autoCapitalize="characters"
                  placeholder="Enter ICAO (e.g., KJFK)"
                  maxLength={5}
                />
                <TouchableOpacity style={styles.searchButton} onPress={handleSearch} disabled={loading} activeOpacity={0.92}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="search" size={18} color="#fff" />}
                </TouchableOpacity>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>Plates for {icao.toUpperCase()}</Text>
                {fetchedAt && <Text style={styles.metaText}>Updated {new Date(fetchedAt).toLocaleString()}</Text>}
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={34} color={colors.textSoft} />
              <Text style={styles.emptyTitle}>No plates loaded yet</Text>
              <Text style={styles.emptyText}>Search an airport to pull the latest available FAA plates.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openPlate(item.url)} activeOpacity={0.92}>
            <View style={styles.cardMeta}>
              <Text style={styles.cardTitle} numberOfLines={2} ellipsizeMode="tail">
                {item.name}
              </Text>
              {!!item.type && (
                <Text style={styles.cardSubtitle} numberOfLines={2} ellipsizeMode="tail">
                  {item.type}
                </Text>
              )}
            </View>
            <Ionicons name="open-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.sm, paddingBottom: 120 },
  hero: {
    backgroundColor: colors.cockpit,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.floating,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#93c5fd',
  },
  heroTitle: {
    ...typography.display,
    color: '#fff',
    marginTop: spacing.sm,
    maxWidth: 340,
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
  },
  searchCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  sectionTitle: {
    ...typography.h2,
  },
  sectionSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  searchButton: {
    backgroundColor: colors.primary,
    width: 50,
    height: 50,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  metaRow: {
    marginTop: spacing.md,
    gap: 4,
  },
  metaText: {
    ...typography.muted,
  },
  emptyState: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadow.card,
  },
  emptyTitle: {
    ...typography.h3,
    marginTop: spacing.sm,
  },
  emptyText: {
    ...typography.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  card: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.card,
  },
  cardMeta: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardTitle: {
    ...typography.h3,
  },
  cardSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
});
