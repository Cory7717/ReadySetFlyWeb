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
      <View style={styles.header}>
        <Text style={styles.title}>TFR Map (List)</Text>
        <Text style={styles.subtitle}>Temporary Flight Restrictions powered by FAA SWIM (US-only).</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={icao}
          onChangeText={setIcao}
          onSubmitEditing={handleSearch}
          autoCapitalize="characters"
          placeholder="ICAO (e.g., KAUS)"
        />
        <TouchableOpacity style={styles.primaryButton} onPress={handleSearch}>
          <Ionicons name="search" size={16} color="#fff" />
          <Text style={styles.primaryButtonText}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => refetch()}>
          <Ionicons name="refresh" size={16} color="#1e40af" />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Active TFRs</Text>
        {isLoading ? (
          <ActivityIndicator color="#1e40af" />
        ) : features.length ? (
          features.slice(0, 12).map((feature, index) => {
            const props = feature.properties || {};
            return (
              <View key={`${props.notamId || 'tfr'}-${index}`} style={styles.tfrCard}>
                <Text style={styles.tfrTitle}>{props.notamId || 'TFR'}</Text>
                {!!props.location && <Text style={styles.tfrMeta}>{props.location}</Text>}
                {!!props.reason && <Text style={styles.tfrMeta}>Reason: {props.reason}</Text>}
                {!!props.tfrType && <Text style={styles.tfrMeta}>Type: {props.tfrType}</Text>}
                {!!props.altitude && <Text style={styles.tfrMeta}>Altitude: {props.altitude}</Text>}
                {(props.effectiveAt || props.expiresAt) && (
                  <Text style={styles.tfrMeta}>
                    {props.effectiveAt ? `Effective ${props.effectiveAt}` : ''}
                    {props.expiresAt ? ` · Expires ${props.expiresAt}` : ''}
                  </Text>
                )}
              </View>
            );
          })
        ) : (
          <Text style={styles.helperText}>No TFRs available yet.</Text>
        )}
        <Text style={styles.helperText}>Verify with official sources before flight.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.lg },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.h2 },
  subtitle: { marginTop: spacing.xs, fontSize: 14, color: colors.textMuted },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm },
  helperText: { fontSize: 12, color: colors.textMuted },
  tfrCard: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.xs,
  },
  tfrTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  tfrMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
