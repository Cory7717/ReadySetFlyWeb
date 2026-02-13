import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

const ICAO_REGEX = /^[A-Z0-9]{3,4}$/;
const WINDS_ALOFT_LEVELS = [3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000];

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'metar', label: 'METAR' },
  { id: 'taf', label: 'TAF' },
  { id: 'notams', label: 'NOTAMs' },
  { id: 'pireps', label: 'PIREPs' },
  { id: 'hazards', label: 'Hazards' },
  { id: 'winds', label: 'Winds Aloft' },
  { id: 'icing', label: 'Icing' },
  { id: 'turbulence', label: 'Turbulence' },
];

type AirportMeta = { lat?: number; lon?: number };

type NotamResponse = {
  notams?: Array<{ id: string; text: string }>;
};

type PirepResponse = { reports?: Array<{ rawOb?: string; obsTime?: string }> };

type WindsResponse = { stations?: Array<{ stationId: string; icao?: string; windDir?: number | null; windSpeed?: number | null; tempC?: number | null }> };

type HazardSummaryItem = {
  source: 'airsigmet' | 'gairmet' | 'airmet';
  hazard: string;
  dueTo?: string;
  validFrom?: string;
  validTo?: string;
};

const pickHazardValue = (value: any) => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const buildHazardSummary = (payload: any) => {
  const items: HazardSummaryItem[] = [];
  const pushItem = (source: HazardSummaryItem['source'], entry: any, fallback: string) => {
    if (!entry) return;
    const hazard = pickHazardValue(entry.hazard || entry.hazard_type || entry.rawAirSigmet || entry.rawAirmet || fallback);
    const dueTo = pickHazardValue(entry.dueTo || entry.due_to || entry.due_to_desc || '');
    const validFrom = pickHazardValue(entry.validTimeFrom || entry.valid_time_from || entry.validFrom || '');
    const validTo = pickHazardValue(entry.validTimeTo || entry.valid_time_to || entry.validTo || '');
    items.push({ source, hazard, dueTo: dueTo || undefined, validFrom: validFrom || undefined, validTo: validTo || undefined });
  };

  if (Array.isArray(payload?.airsigmet)) {
    payload.airsigmet.forEach((entry: any) => pushItem('airsigmet', entry, 'SIGMET'));
  }
  if (Array.isArray(payload?.gairmet)) {
    payload.gairmet.forEach((entry: any) => pushItem('gairmet', entry, 'G-AIRMET'));
  }
  if (Array.isArray(payload?.airmet)) {
    payload.airmet.forEach((entry: any) => pushItem('airmet', entry, 'AIRMET'));
  }

  const tcfCount = Array.isArray(payload?.tcf?.features) ? payload.tcf.features.length : 0;
  const warnings = Array.isArray(payload?.warnings) ? payload.warnings : [];

  return { items, warnings, tcfCount };
};

export default function AviationWeatherHubScreen() {
  const [icaoInput, setIcaoInput] = useState('KAUS');
  const [searchIcao, setSearchIcao] = useState('KAUS');
  const [activeTab, setActiveTab] = useState('overview');
  const [windsAltitude, setWindsAltitude] = useState('12000');

  const normalizedIcao = useMemo(() => icaoInput.trim().toUpperCase(), [icaoInput]);
  const canSearch = ICAO_REGEX.test(normalizedIcao);

  const submitIcao = () => {
    if (!canSearch) return;
    setSearchIcao(normalizedIcao);
  };

  const airportQuery = useQuery<AirportMeta>({
    queryKey: ['/api/airports', searchIcao],
    queryFn: async () => {
      const res = await api.get(`/api/airports/${searchIcao}`);
      return res.data;
    },
    enabled: Boolean(searchIcao),
  });

  const metarQuery = useQuery({
    queryKey: ['/api/aviation/metar', searchIcao],
    queryFn: async () => {
      const res = await api.get(`/api/aviation/metar/${searchIcao}`);
      return res.data;
    },
    enabled: Boolean(searchIcao),
  });

  const tafQuery = useQuery({
    queryKey: ['/api/aviation/taf', searchIcao],
    queryFn: async () => {
      const res = await api.get(`/api/aviation/taf/${searchIcao}`);
      return res.data;
    },
    enabled: Boolean(searchIcao),
  });

  const notamsQuery = useQuery<NotamResponse>({
    queryKey: ['/api/aviation/notams', searchIcao],
    queryFn: async () => {
      const res = await api.get(`/api/aviation/notams/${searchIcao}`);
      return res.data;
    },
    enabled: Boolean(searchIcao),
  });

  const pirepsQuery = useQuery<PirepResponse>({
    queryKey: ['/api/aviation/pireps', searchIcao],
    queryFn: async () => {
      const res = await api.get(`/api/aviation/pireps?icao=${searchIcao}&radiusNm=200&ageHours=6`);
      return res.data;
    },
    enabled: Boolean(searchIcao),
  });

  const hazardsQuery = useQuery({
    queryKey: ['/api/aviation/hazards'],
    queryFn: async () => {
      const res = await api.get('/api/aviation/hazards');
      return res.data;
    },
  });

  const windsQuery = useQuery<WindsResponse>({
    queryKey: ['/api/aviation/winds-temps', searchIcao, windsAltitude],
    queryFn: async () => {
      const airport = airportQuery.data;
      const lat = Number(airport?.lat);
      const lon = Number(airport?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { stations: [] };
      const pad = 2.0;
      const bbox = `${lat - pad},${lon - pad},${lat + pad},${lon + pad}`;
      const res = await api.get('/api/aviation/winds-temps', { params: { altitude: windsAltitude, bbox } });
      return res.data;
    },
    enabled: Boolean(searchIcao) && Boolean(airportQuery.data?.lat),
  });

  const icingQuery = useQuery({
    queryKey: ['/api/aviation/icing'],
    queryFn: async () => {
      const res = await api.get('/api/aviation/icing');
      return res.data;
    },
  });

  const turbulenceQuery = useQuery({
    queryKey: ['/api/aviation/turbulence'],
    queryFn: async () => {
      const res = await api.get('/api/aviation/turbulence');
      return res.data;
    },
  });

  const notamsCount = notamsQuery.data?.notams?.length || 0;
  const pirepsCount = pirepsQuery.data?.reports?.length || 0;
  const windsCount = windsQuery.data?.stations?.length || 0;
  const hazardsSummary = buildHazardSummary(hazardsQuery.data);
  const icingSummary = buildHazardSummary(icingQuery.data);
  const turbulenceSummary = buildHazardSummary(turbulenceQuery.data);
  const metarData = metarQuery.data?.data ?? metarQuery.data;
  const tafData = tafQuery.data?.data ?? tafQuery.data;
  const metarRaw = metarData?.rawOb || metarData?.raw || metarQuery.data?.raw || '';
  const tafRaw = tafData?.rawTAF || tafData?.raw || tafQuery.data?.raw || '';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Aviation Weather Hub</Text>
        <Text style={styles.subtitle}>NOAA/AWC METARs, TAFs, NOTAMs, PIREPs, hazards, and winds aloft.</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={icaoInput}
          onChangeText={setIcaoInput}
          onSubmitEditing={submitIcao}
          autoCapitalize="characters"
          placeholder="ICAO (e.g., KAUS)"
        />
        <TouchableOpacity style={[styles.primaryButton, !canSearch && styles.buttonDisabled]} onPress={submitIcao} disabled={!canSearch}>
          <Ionicons name="search" size={16} color="#fff" />
          <Text style={styles.primaryButtonText}>Load</Text>
        </TouchableOpacity>
      </View>
      {!canSearch && icaoInput.trim().length > 0 && (
        <Text style={styles.helperText}>Enter a valid 3-4 character ICAO code.</Text>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabButton, activeTab === tab.id && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeTab === 'overview' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>METAR</Text>
            <Text style={styles.summaryValue}>{metarQuery.data?.raw || metarQuery.data?.data?.rawOb || 'No METAR loaded.'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>TAF</Text>
            <Text style={styles.summaryValue}>{tafQuery.data?.raw || tafQuery.data?.data?.rawTAF || 'No TAF loaded.'}</Text>
          </View>
          <View style={styles.pillRow}>
            <Text style={styles.pill}>NOTAMs {notamsCount} · US-only</Text>
            <Text style={styles.pill}>PIREPs {pirepsCount} · US-only</Text>
            <Text style={styles.pill}>Winds {windsCount}</Text>
          </View>
        </View>
      )}

      {activeTab === 'metar' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>METAR</Text>
          {metarRaw ? <Text style={styles.codeBlock}>{metarRaw}</Text> : <Text style={styles.helperText}>No METAR loaded.</Text>}
          <View style={styles.listItem}>
            <Text style={styles.listTitle}>Station</Text>
            <Text style={styles.listText}>{metarData?.icaoId || metarData?.station || searchIcao}</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listTitle}>Observed</Text>
            <Text style={styles.listText}>{metarData?.obsTime || '-'}</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listTitle}>Wind</Text>
            <Text style={styles.listText}>{metarData?.windDir ?? '-'} deg / {metarData?.windSpeed ?? '-'} kt</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listTitle}>Visibility</Text>
            <Text style={styles.listText}>{metarData?.visib ?? metarData?.visibility ?? '-'}</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listTitle}>Temp / Dewpoint</Text>
            <Text style={styles.listText}>{metarData?.temp ?? '-'}C / {metarData?.dewpt ?? '-'}C</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listTitle}>Altimeter</Text>
            <Text style={styles.listText}>{metarData?.altimInHg ?? metarData?.altimeter ?? '-'}</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listTitle}>Flight Category</Text>
            <Text style={styles.listText}>{metarData?.fltCat || metarData?.flightCategory || '-'}</Text>
          </View>
        </View>
      )}

      {activeTab === 'taf' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>TAF</Text>
          {tafRaw ? <Text style={styles.codeBlock}>{tafRaw}</Text> : <Text style={styles.helperText}>No TAF loaded.</Text>}
          <View style={styles.listItem}>
            <Text style={styles.listTitle}>Station</Text>
            <Text style={styles.listText}>{tafData?.icaoId || tafData?.station || searchIcao}</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listTitle}>Issued</Text>
            <Text style={styles.listText}>{tafData?.issueTime || '-'}</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listTitle}>Valid From</Text>
            <Text style={styles.listText}>{tafData?.validTimeFrom || '-'}</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listTitle}>Valid To</Text>
            <Text style={styles.listText}>{tafData?.validTimeTo || '-'}</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listTitle}>Forecast Periods</Text>
            <Text style={styles.listText}>{Array.isArray(tafData?.fcsts) ? tafData.fcsts.length : '-'}</Text>
          </View>
        </View>
      )}

      {activeTab === 'notams' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>NOTAMs</Text>
          <Text style={styles.helperText}>US-only (FAA).</Text>
          {notamsQuery.isLoading && <ActivityIndicator color={colors.primary} />}
          {!notamsQuery.isLoading && notamsCount === 0 && <Text style={styles.helperText}>No NOTAMs available.</Text>}
          {notamsQuery.data?.notams?.map((notam) => (
            <View key={notam.id} style={styles.listItem}>
              <Text style={styles.listTitle}>{notam.id}</Text>
              <Text style={styles.listText}>{notam.text}</Text>
            </View>
          ))}
        </View>
      )}

      {activeTab === 'pireps' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>PIREPs</Text>
          <Text style={styles.helperText}>US-only (FAA).</Text>
          {pirepsQuery.isLoading && <ActivityIndicator color={colors.primary} />}
          {!pirepsQuery.isLoading && pirepsCount === 0 && <Text style={styles.helperText}>No recent PIREPs in range.</Text>}
          {pirepsQuery.data?.reports?.slice(0, 16).map((report, index) => (
            <View key={`${report.rawOb || report.obsTime || index}`} style={styles.listItem}>
              <Text style={styles.listTitle}>{report.rawOb || 'PIREP'}</Text>
              {report.obsTime && <Text style={styles.listMeta}>{report.obsTime}</Text>}
            </View>
          ))}
        </View>
      )}

      {activeTab === 'hazards' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Hazards</Text>
          <Text style={styles.helperText}>US-only (AWC/AIRMET/SIGMET).</Text>
          {hazardsSummary.warnings.length > 0 && (
            <Text style={styles.helperText}>{hazardsSummary.warnings.join(' ')}</Text>
          )}
          <Text style={styles.helperText}>
            {hazardsSummary.items.length > 0 ? `${hazardsSummary.items.length} hazard items.` : 'No hazards returned.'}
            {hazardsSummary.tcfCount > 0 ? ` TCF: ${hazardsSummary.tcfCount}.` : ''}
          </Text>
          {hazardsSummary.items.slice(0, 12).map((item, index) => (
            <View key={`${item.source}-${item.hazard}-${index}`} style={styles.listItem}>
              <Text style={styles.listTitle}>{item.hazard}</Text>
              {item.dueTo && <Text style={styles.listText}>Due to {item.dueTo}</Text>}
              {(item.validFrom || item.validTo) && (
                <Text style={styles.listMeta}>Valid {item.validFrom || '-'} to {item.validTo || '-'}</Text>
              )}
              <Text style={styles.listMeta}>{item.source.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      )}

      {activeTab === 'winds' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Winds Aloft</Text>
          <View style={styles.altitudeRow}>
            {WINDS_ALOFT_LEVELS.map((altitude) => (
              <TouchableOpacity
                key={altitude}
                style={[styles.altitudeButton, windsAltitude === String(altitude) && styles.altitudeButtonActive]}
                onPress={() => setWindsAltitude(String(altitude))}
              >
                <Text style={[styles.altitudeText, windsAltitude === String(altitude) && styles.altitudeTextActive]}>
                  {altitude.toLocaleString()} ft
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {windsQuery.isLoading && <ActivityIndicator color={colors.primary} />}
          {!windsQuery.isLoading && windsCount === 0 && <Text style={styles.helperText}>No winds aloft data in range.</Text>}
          {windsQuery.data?.stations?.slice(0, 16).map((station) => (
            <View key={`${station.stationId}-${station.icao || ''}`} style={styles.listItem}>
              <Text style={styles.listTitle}>{station.icao || station.stationId}</Text>
              <Text style={styles.listText}>
                {station.windDir ?? '-'} deg / {station.windSpeed ?? '-'} kt
                {station.tempC !== null ? `, ${station.tempC}C` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      {activeTab === 'icing' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Icing Guidance</Text>
          <Text style={styles.helperText}>Icing guidance is currently stubbed until NOAA/AWC provides a direct API.</Text>
          {icingSummary.warnings.length > 0 && (
            <Text style={styles.helperText}>{icingSummary.warnings.join(' ')}</Text>
          )}
          {icingSummary.items.length === 0 ? (
            <Text style={styles.helperText}>No icing guidance returned yet.</Text>
          ) : (
            icingSummary.items.slice(0, 12).map((item, index) => (
              <View key={`${item.source}-${item.hazard}-${index}`} style={styles.listItem}>
                <Text style={styles.listTitle}>{item.hazard}</Text>
                {item.dueTo && <Text style={styles.listText}>Due to {item.dueTo}</Text>}
                {(item.validFrom || item.validTo) && (
                  <Text style={styles.listMeta}>Valid {item.validFrom || '-'} to {item.validTo || '-'}</Text>
                )}
                <Text style={styles.listMeta}>{item.source.toUpperCase()}</Text>
              </View>
            ))
          )}
        </View>
      )}

      {activeTab === 'turbulence' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Turbulence Guidance</Text>
          <Text style={styles.helperText}>Turbulence guidance is currently stubbed until NOAA/AWC provides a direct API.</Text>
          {turbulenceSummary.warnings.length > 0 && (
            <Text style={styles.helperText}>{turbulenceSummary.warnings.join(' ')}</Text>
          )}
          {turbulenceSummary.items.length === 0 ? (
            <Text style={styles.helperText}>No turbulence guidance returned yet.</Text>
          ) : (
            turbulenceSummary.items.slice(0, 12).map((item, index) => (
              <View key={`${item.source}-${item.hazard}-${index}`} style={styles.listItem}>
                <Text style={styles.listTitle}>{item.hazard}</Text>
                {item.dueTo && <Text style={styles.listText}>Due to {item.dueTo}</Text>}
                {(item.validFrom || item.validTo) && (
                  <Text style={styles.listMeta}>Valid {item.validFrom || '-'} to {item.validTo || '-'}</Text>
                )}
                <Text style={styles.listMeta}>{item.source.toUpperCase()}</Text>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.lg },
  header: { padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { ...typography.h2 },
  subtitle: { marginTop: spacing.xs, fontSize: 13, color: colors.textMuted },
  searchRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingBottom: 0 },
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
  buttonDisabled: { opacity: 0.5 },
  helperText: { fontSize: 12, color: colors.textMuted, paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  tabRow: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  tabButtonActive: { backgroundColor: colors.primarySoft },
  tabText: { fontSize: 12, color: colors.textMuted },
  tabTextActive: { color: colors.primary, fontWeight: '600' },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm },
  summaryRow: { marginBottom: spacing.sm },
  summaryLabel: { fontSize: 12, color: colors.textMuted },
  summaryValue: { fontSize: 13, color: colors.text, marginTop: 4 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { fontSize: 12, color: colors.primary, backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md },
  codeBlock: { fontSize: 11, color: colors.textMuted, backgroundColor: colors.surfaceMuted, padding: spacing.sm, borderRadius: radius.md },
  listItem: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.xs },
  listTitle: { fontSize: 12, fontWeight: '700', color: colors.text },
  listText: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  listMeta: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  altitudeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  altitudeButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  altitudeButtonActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  altitudeText: { fontSize: 11, color: colors.textMuted },
  altitudeTextActive: { color: colors.primary, fontWeight: '600' },
});
