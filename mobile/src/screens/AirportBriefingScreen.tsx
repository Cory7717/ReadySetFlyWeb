import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type RunwayBriefing = {
  icao: string;
  runwayInUse: string | null;
  wind: { direction: number | null; speed: number | null; gust: number | null };
  advisory: { runway: string; heading: number; headwind: number; crosswind: number } | null;
  runways: Array<{
    leIdent: string | null;
    heIdent: string | null;
    leHeading: number | null;
    heHeading: number | null;
    lengthFt: number | null;
    surface: string | null;
  }>;
};

type NotamResponse = {
  icao: string;
  notams: Array<{ id: string; text: string; effective?: string; expires?: string }>;
};

export default function AirportBriefingScreen() {
  const [icao, setIcao] = useState('KAUS');
  const [searchIcao, setSearchIcao] = useState('KAUS');

  const { data: briefing, isLoading: briefingLoading } = useQuery<RunwayBriefing>({
    queryKey: ['/api/airports', searchIcao, 'runway-briefing'],
    queryFn: async () => {
      const res = await api.get(`/api/airports/${searchIcao}/runway-briefing`);
      return res.data;
    },
    enabled: !!searchIcao,
  });

  const { data: notams, isLoading: notamLoading } = useQuery<NotamResponse>({
    queryKey: ['/api/notams', searchIcao],
    queryFn: async () => {
      const res = await api.get(`/api/notams/${searchIcao}`);
      return res.data;
    },
    enabled: !!searchIcao,
  });

  const handleSearch = () => {
    const value = icao.trim().toUpperCase();
    if (value.length >= 3) {
      setSearchIcao(value);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Airport Briefing</Text>
        <Text style={styles.subtitle}>Runways, wind advisory, and live NOTAMs.</Text>
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
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Runway Advisory</Text>
        {briefingLoading ? (
          <ActivityIndicator color="#1e40af" />
        ) : briefing?.advisory ? (
          <View style={styles.advisoryBox}>
            <Text style={styles.advisoryTitle}>Recommended: {briefing.advisory.runway}</Text>
            <Text style={styles.advisoryText}>
              Headwind {briefing.advisory.headwind} kt · Crosswind {briefing.advisory.crosswind} kt
            </Text>
            <Text style={styles.helperText}>
              Advisory only. Verify with ATIS and tower.
            </Text>
          </View>
        ) : (
          <Text style={styles.helperText}>Runway advisory unavailable.</Text>
        )}

        {briefing?.runwayInUse && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Runway in use</Text>
            <Text style={styles.infoValue}>{briefing.runwayInUse}</Text>
          </View>
        )}

        <View style={styles.runwayGrid}>
          {briefing?.runways?.slice(0, 6).map((runway) => (
            <View key={`${runway.leIdent}-${runway.heIdent}`} style={styles.runwayCard}>
              <Text style={styles.runwayTitle}>{runway.leIdent || '--'} / {runway.heIdent || '--'}</Text>
              <Text style={styles.runwayMeta}>
                {runway.surface || 'Surface N/A'} · {runway.lengthFt ? `${runway.lengthFt} ft` : 'Length N/A'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>NOTAMs</Text>
        {notamLoading ? (
          <ActivityIndicator color="#1e40af" />
        ) : notams?.notams?.length ? (
          notams.notams.slice(0, 6).map((notam) => (
            <View key={notam.id} style={styles.notamCard}>
              <Text style={styles.notamText}>{notam.text}</Text>
              {(notam.effective || notam.expires) && (
                <Text style={styles.notamMeta}>
                  {notam.effective ? `Effective ${notam.effective}` : ''}{' '}
                  {notam.expires ? `· Expires ${notam.expires}` : ''}
                </Text>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.helperText}>No NOTAMs available yet.</Text>
        )}
        <Text style={styles.helperText}>NOTAMs powered by FAA SWIM.</Text>
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
    borderRadius: radius.md,
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
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
  advisoryBox: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  advisoryTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  advisoryText: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  helperText: { fontSize: 12, color: colors.textMuted },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  infoLabel: { fontSize: 12, color: colors.textMuted },
  infoValue: { fontSize: 12, fontWeight: '600', color: colors.text },
  runwayGrid: { gap: spacing.xs },
  runwayCard: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  runwayTitle: { fontSize: 12, fontWeight: '700', color: colors.text },
  runwayMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  notamCard: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.xs,
  },
  notamText: { fontSize: 12, color: colors.text },
  notamMeta: { fontSize: 10, color: colors.textMuted, marginTop: 4 },
});
