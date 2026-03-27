import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

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
  const { isAuthenticated, user } = useIsAuthenticated();
  const entitlements = (user as any)?.entitlements;
  const isPro = entitlements?.canUseLogbook ?? (user?.logbookProStatus === 'active');
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const totalDay = entries.reduce((sum, entry) => sum + (Number(entry.timeDay) || 0), 0);
  const totalNight = entries.reduce((sum, entry) => sum + (Number(entry.timeNight) || 0), 0);
  const totalTime = totalDay + totalNight;

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
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={loadEntries}>
            <Ionicons name="refresh" size={18} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('LogbookEntry')}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>New Entry</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statsCard}>
          <Text style={styles.statsLabel}>Entries</Text>
          <Text style={styles.statsValue}>{entries.length}</Text>
        </View>
        <View style={styles.statsCard}>
          <Text style={styles.statsLabel}>Total Time</Text>
          <Text style={styles.statsValue}>{totalTime.toFixed(1)} hrs</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statsCard}>
          <Text style={styles.statsLabel}>Day</Text>
          <Text style={styles.statsValue}>{totalDay.toFixed(1)} hrs</Text>
        </View>
        <View style={styles.statsCard}>
          <Text style={styles.statsLabel}>Night</Text>
          <Text style={styles.statsValue}>{totalNight.toFixed(1)} hrs</Text>
        </View>
      </View>

      <View style={styles.proCard}>
        <Text style={styles.proTitle}>RSF Pro</Text>
        <Text style={styles.proText}>
          {isPro
            ? 'Your RSF Pro tools are active.'
            : 'Unlock currency alerts, endorsements, radio comms training, and advanced tools.'}
        </Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('LogbookPro')}>
          <Text style={styles.secondaryButtonText}>{isPro ? 'Open Member Dashboard' : 'View membership details'}</Text>
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
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { ...typography.h2 },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  primaryButton: { flexDirection: 'row', backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center', gap: 6 },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  secondaryButtonText: { color: colors.primary, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  statsCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  statsLabel: { fontSize: 12, color: colors.textMuted },
  statsValue: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 4 },
  proCard: { margin: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  proTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  proText: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.sm },
  listContent: { padding: spacing.md },
  card: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  cardSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: colors.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { marginTop: 12, color: colors.textMuted },
});
