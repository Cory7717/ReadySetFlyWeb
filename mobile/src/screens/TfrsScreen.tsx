import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type TfrFeatureCollection = {
  type: string;
  updatedAt?: string;
  features: Array<{
    properties?: {
      notamId?: string;
      location?: string;
      reason?: string;
      tfrType?: string;
      altitude?: string;
      effectiveAt?: string | null;
      expiresAt?: string | null;
    };
  }>;
};

const ICAO_REGEX = /^[A-Z0-9]{3,4}$/;

export default function TfrsScreen() {
  const [icao, setIcao] = useState('KAUS');
  const [searchIcao, setSearchIcao] = useState('KAUS');

  const normalized = searchIcao.trim().toUpperCase();
  const activeIcao = ICAO_REGEX.test(normalized) ? normalized : '';

  const { data, isLoading, refetch } = useQuery<TfrFeatureCollection>({
    queryKey: ['/api/tfrs', activeIcao],
    queryFn: async () => {
      const endpoint = activeIcao ? `/api/tfrs?icao=${activeIcao}` : '/api/tfrs';
      const res = await api.get(endpoint);
      return res.data;
    },
  });

  const handleSearch = () => {
    const value = icao.trim().toUpperCase();
    if (!value || ICAO_REGEX.test(value)) {
      setSearchIcao(value);
    }
  };

  const features = data?.features || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>TFR WATCH</Text>
        <Text style={styles.heroTitle}>Check temporary restrictions before the route locks in.</Text>
        <Text style={styles.heroSubtitle}>
          Search by airport and scan active FAA SWIM restrictions without leaving the RSF workflow.
        </Text>
      </View>

      <View style={styles.searchCard}>
        <Text style={styles.sectionTitle}>Search by ICAO</Text>
        <Text style={styles.sectionSubtitle}>Filter the active list around a specific airport.</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            value={icao}
            onChangeText={setIcao}
            onSubmitEditing={handleSearch}
            autoCapitalize="characters"
            placeholder="ICAO (e.g., KAUS)"
          />
          <TouchableOpacity style={styles.primaryButton} onPress={handleSearch} activeOpacity={0.92}>
            <Ionicons name="search" size={16} color="#fff" />
            <Text style={styles.primaryButtonText}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => refetch()} activeOpacity={0.92}>
            <Ionicons name="refresh" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.resultsCard}>
        <Text style={styles.sectionTitle}>Active TFRs</Text>
        <Text style={styles.sectionSubtitle}>
          Verify with official FAA sources before flight.
        </Text>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : features.length ? (
          features.slice(0, 12).map((feature, index) => {
            const props = feature.properties || {};
            return (
              <View key={`${props.notamId || 'tfr'}-${index}`} style={styles.tfrCard}>
                <View style={styles.tfrHeader}>
                  <Text style={styles.tfrTitle}>{props.notamId || 'TFR'}</Text>
                  {!!props.tfrType && <Text style={styles.tfrBadge}>{props.tfrType}</Text>}
                </View>
                {!!props.location && <Text style={styles.tfrMeta}>{props.location}</Text>}
                {!!props.reason && <Text style={styles.tfrMeta}>Reason: {props.reason}</Text>}
                {!!props.altitude && <Text style={styles.tfrMeta}>Altitude: {props.altitude}</Text>}
                {(props.effectiveAt || props.expiresAt) && (
                  <Text style={styles.tfrMeta}>
                    {props.effectiveAt ? `Effective ${props.effectiveAt}` : ''}
                    {props.expiresAt ? ` | Expires ${props.expiresAt}` : ''}
                  </Text>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="warning-outline" size={32} color={colors.textSoft} />
            <Text style={styles.emptyTitle}>No TFRs loaded</Text>
            <Text style={styles.emptyText}>No active restrictions are available for this search yet.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.sm, paddingBottom: 120 },
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
  resultsCard: {
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
    gap: spacing.sm,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  loading: {
    marginTop: spacing.lg,
  },
  tfrCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.sm,
  },
  tfrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tfrTitle: { fontSize: 13, fontWeight: '700', color: colors.text, flex: 1 },
  tfrBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryStrong,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tfrMeta: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  emptyState: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.xl,
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
});
