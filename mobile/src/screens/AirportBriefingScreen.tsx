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

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

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
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="business-outline" size={34} color="#93c5fd" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>AIRPORT BRIEFING</Text>
            <Text style={styles.heroTitle}>Runways, wind context, and live NOTAMs in one view.</Text>
            <Text style={styles.heroSubtitle}>
              Use the airport briefing tool to quickly review runway suitability, wind advisory context, and current FAA NOTAMs before departure or arrival.
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile label="Airport" value={searchIcao} />
          <SummaryTile label="Runways" value={String(briefing?.runways?.length || 0)} />
          <SummaryTile label="NOTAMs" value={String(notams?.notams?.length || 0)} />
        </View>
      </View>

      <SectionCard
        title="Load airport"
        subtitle="Enter any airport ICAO or FAA identifier to refresh runway and NOTAM context."
      >
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            value={icao}
            onChangeText={setIcao}
            onSubmitEditing={handleSearch}
            autoCapitalize="characters"
            placeholder="ICAO (e.g., KAUS)"
            placeholderTextColor={colors.textSoft}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={handleSearch} activeOpacity={0.92}>
            <Ionicons name="search" size={16} color="#fff" />
            <Text style={styles.primaryButtonText}>Search</Text>
          </TouchableOpacity>
        </View>
      </SectionCard>

      <SectionCard
        title="Runway advisory"
        subtitle="Advisory only. Always verify runway use with ATIS, CTAF, or tower instructions."
      >
        {briefingLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : briefing?.advisory ? (
          <View style={styles.advisoryBox}>
            <Text style={styles.advisoryTitle}>Recommended runway: {briefing.advisory.runway}</Text>
            <Text style={styles.advisoryText}>
              Headwind {briefing.advisory.headwind} kt - Crosswind {briefing.advisory.crosswind} kt
            </Text>
          </View>
        ) : (
          <Text style={styles.helperText}>Runway advisory unavailable.</Text>
        )}

        {briefing?.runwayInUse ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Runway in use</Text>
            <Text style={styles.infoValue}>{briefing.runwayInUse}</Text>
          </View>
        ) : null}

        <View style={styles.runwayGrid}>
          {briefing?.runways?.slice(0, 6).map((runway) => (
            <View key={`${runway.leIdent}-${runway.heIdent}`} style={styles.runwayCard}>
              <Text style={styles.runwayTitle}>
                {runway.leIdent || '--'} / {runway.heIdent || '--'}
              </Text>
              <Text style={styles.runwayMeta}>
                {runway.surface || 'Surface N/A'} - {runway.lengthFt ? `${runway.lengthFt} ft` : 'Length N/A'}
              </Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard
        title="NOTAMs"
        subtitle="FAA NOTAMs for the selected airport."
      >
        {notamLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : notams?.notams?.length ? (
          notams.notams.slice(0, 6).map((notam) => (
            <View key={notam.id} style={styles.notamCard}>
              <Text style={styles.notamText}>{notam.text}</Text>
              {notam.effective || notam.expires ? (
                <Text style={styles.notamMeta}>
                  {notam.effective ? `Effective ${notam.effective}` : ''}
                  {notam.expires ? `${notam.effective ? ' - ' : ''}Expires ${notam.expires}` : ''}
                </Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.helperText}>No NOTAMs available yet.</Text>
        )}
        <Text style={styles.helperText}>NOTAMs powered by FAA SWIM.</Text>
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.sm, paddingBottom: 120 },
  heroPanel: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.cockpit,
    ...shadow.floating,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  heroIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#93c5fd',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#fff',
    marginTop: 10,
    maxWidth: 320,
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
    maxWidth: 340,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  summaryTile: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#bfdbfe',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginTop: 6,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  sectionTitle: {
    ...typography.h2,
  },
  sectionSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
  sectionContent: {
    marginTop: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
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
    borderRadius: radius.lg,
  },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
  advisoryBox: {
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.sm,
  },
  advisoryTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  advisoryText: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  helperText: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  infoLabel: { fontSize: 12, color: colors.textMuted },
  infoValue: { fontSize: 12, fontWeight: '800', color: colors.text },
  runwayGrid: { gap: spacing.xs },
  runwayCard: {
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
  },
  runwayTitle: { fontSize: 12, fontWeight: '800', color: colors.text },
  runwayMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  notamCard: {
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    marginBottom: spacing.xs,
  },
  notamText: { fontSize: 12, color: colors.text },
  notamMeta: { fontSize: 10, color: colors.textMuted, marginTop: 4 },
});
