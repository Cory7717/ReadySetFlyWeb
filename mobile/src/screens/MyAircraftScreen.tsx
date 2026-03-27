import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type AircraftType = {
  id: string;
  make: string;
  model: string;
  icaoType?: string | null;
  cruiseKtas: number;
  fuelBurnGph: number;
  usableFuelGal: number;
  maxGrossWeightLb: number;
};

type AircraftProfile = {
  id: string;
  name: string;
  tailNumber?: string | null;
  typeId?: string | null;
  cruiseKtasOverride?: number | null;
  fuelBurnOverrideGph?: number | null;
  usableFuelOverrideGal?: number | null;
  maxGrossWeightOverrideLb?: number | null;
  type?: AircraftType | null;
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

export default function MyAircraftScreen({ navigation }: any) {
  const [profiles, setProfiles] = useState<AircraftProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AircraftType[]>([]);
  const [form, setForm] = useState({
    name: '',
    tailNumber: '',
    typeId: '',
    cruiseKtas: '',
    fuelBurn: '',
    usableFuel: '',
    maxGross: '',
  });
  const verificationNoticeKey = 'rsf-verification-owner-v1';

  const selectedType = useMemo(
    () => results.find((item) => item.id === form.typeId) ?? null,
    [results, form.typeId]
  );

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/aircraft/profiles');
      setProfiles(res.data || []);
    } catch {
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    const showNotice = async () => {
      const stored = await AsyncStorage.getItem(verificationNoticeKey);
      const lastSeen = stored ? Number(stored) : 0;
      const thirtyDays = 1000 * 60 * 60 * 24 * 30;
      if (lastSeen && Date.now() - lastSeen < thirtyDays) return;

      const markSeen = async () => {
        await AsyncStorage.setItem(verificationNoticeKey, String(Date.now()));
      };

      Alert.alert(
        'Verification keeps rentals safe',
        'Owners must verify identity, pilot credentials, and aircraft documentation to protect renters and speed approvals.',
        [
          { text: 'Got it', onPress: markSeen },
          {
            text: 'Start Verification',
            onPress: async () => {
              await markSeen();
              navigation.navigate('Verification');
            },
          },
        ]
      );
    };

    showNotice();
  }, [navigation]);

  const searchTypes = async () => {
    if (!query.trim()) return;
    try {
      const res = await api.get('/api/aircraft/types', { params: { q: query.trim() } });
      setResults(res.data || []);
    } catch {
      setResults([]);
    }
  };

  const handleSave = async () => {
    if (!form.name) {
      Alert.alert('Missing name', 'Please give your aircraft profile a name.');
      return;
    }
    try {
      await api.post('/api/aircraft/profiles', {
        name: form.name,
        tailNumber: form.tailNumber || null,
        typeId: form.typeId || null,
        cruiseKtasOverride: form.cruiseKtas ? Number(form.cruiseKtas) : null,
        fuelBurnOverrideGph: form.fuelBurn ? Number(form.fuelBurn) : null,
        usableFuelOverrideGal: form.usableFuel ? Number(form.usableFuel) : null,
        maxGrossWeightOverrideLb: form.maxGross ? Number(form.maxGross) : null,
      });
      setForm({
        name: '',
        tailNumber: '',
        typeId: '',
        cruiseKtas: '',
        fuelBurn: '',
        usableFuel: '',
        maxGross: '',
      });
      setQuery('');
      setResults([]);
      loadProfiles();
    } catch (error: any) {
      Alert.alert('Save failed', error?.response?.data?.error || 'Unable to save profile.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/aircraft/profiles/${id}`);
      loadProfiles();
    } catch (error: any) {
      Alert.alert('Delete failed', error?.response?.data?.error || 'Unable to delete profile.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="airplane-outline" size={34} color="#93c5fd" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>AIRCRAFT WORKSPACE</Text>
            <Text style={styles.heroTitle}>Save the aircraft you actually fly.</Text>
            <Text style={styles.heroSubtitle}>
              Build a profile once, reuse it across planning, rentals, and owner workflows, and keep your performance assumptions consistent.
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile label="Profiles" value={String(profiles.length)} />
          <SummaryTile label="Library matches" value={String(results.length)} />
          <SummaryTile label="Status" value={profiles.length ? 'Configured' : 'Start here'} />
        </View>

        <View style={styles.statusStrip}>
          <View style={styles.statusPill}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#bfdbfe" />
            <Text style={styles.statusPillText}>Owner verification protects renters and approvals</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.heroAction}
          onPress={() => navigation.navigate('Verification')}
          activeOpacity={0.92}
        >
          <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
          <Text style={styles.heroActionText}>Open verification</Text>
        </TouchableOpacity>
      </View>

      <SectionCard
        title="Create aircraft profile"
        subtitle="Tie your airplane to the RSF library, then add only the overrides that are specific to your aircraft."
      >
        <TextInput
          style={styles.input}
          placeholder="Profile name (e.g., My C172)"
          placeholderTextColor={colors.textSoft}
          value={form.name}
          onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Tail number (optional)"
          placeholderTextColor={colors.textSoft}
          value={form.tailNumber}
          onChangeText={(value) => setForm((prev) => ({ ...prev, tailNumber: value }))}
        />

        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, styles.searchInput]}
            placeholder="Search aircraft library (C172, SR22)"
            placeholderTextColor={colors.textSoft}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={searchTypes}
          />
          <TouchableOpacity style={styles.secondaryButton} onPress={searchTypes} activeOpacity={0.92}>
            <Ionicons name="search-outline" size={16} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {selectedType ? (
          <View style={styles.selectedLibraryCard}>
            <Text style={styles.selectedLibraryLabel}>Selected library aircraft</Text>
            <Text style={styles.selectedLibraryTitle}>
              {selectedType.make} {selectedType.model} ({selectedType.icaoType || 'N/A'})
            </Text>
            <Text style={styles.selectedLibraryMeta}>
              {selectedType.cruiseKtas} KTAS · {selectedType.fuelBurnGph} GPH · {selectedType.usableFuelGal} gal usable
            </Text>
          </View>
        ) : null}

        {results.slice(0, 6).map((item) => {
          const active = form.typeId === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.resultCard, active && styles.resultCardActive]}
              onPress={() => setForm((prev) => ({ ...prev, typeId: item.id }))}
              activeOpacity={0.92}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.resultTitle}>
                  {item.make} {item.model} ({item.icaoType || 'N/A'})
                </Text>
                <Text style={styles.resultMeta}>
                  {item.cruiseKtas} KTAS · {item.fuelBurnGph} GPH · {item.usableFuelGal} gal usable
                </Text>
              </View>
              <Ionicons
                name={active ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
                color={active ? colors.primary : colors.textSoft}
              />
            </TouchableOpacity>
          );
        })}

        <Text style={styles.helperText}>Optional overrides</Text>
        <View style={styles.overrideGrid}>
          <TextInput
            style={[styles.input, styles.gridInput]}
            placeholder="Cruise KTAS"
            placeholderTextColor={colors.textSoft}
            value={form.cruiseKtas}
            onChangeText={(value) => setForm((prev) => ({ ...prev, cruiseKtas: value }))}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, styles.gridInput]}
            placeholder="Fuel burn (GPH)"
            placeholderTextColor={colors.textSoft}
            value={form.fuelBurn}
            onChangeText={(value) => setForm((prev) => ({ ...prev, fuelBurn: value }))}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, styles.gridInput]}
            placeholder="Usable fuel (gal)"
            placeholderTextColor={colors.textSoft}
            value={form.usableFuel}
            onChangeText={(value) => setForm((prev) => ({ ...prev, usableFuel: value }))}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, styles.gridInput]}
            placeholder="Max gross (lb)"
            placeholderTextColor={colors.textSoft}
            value={form.maxGross}
            onChangeText={(value) => setForm((prev) => ({ ...prev, maxGross: value }))}
            keyboardType="numeric"
          />
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleSave} activeOpacity={0.92}>
          <Ionicons name="save-outline" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Save profile</Text>
        </TouchableOpacity>
      </SectionCard>

      <SectionCard
        title="Saved aircraft"
        subtitle="Your saved aircraft feed planning defaults across Ready Set Fly."
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading profiles...</Text>
          </View>
        ) : profiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="airplane-outline" size={26} color={colors.textSoft} />
            <Text style={styles.emptyTitle}>No aircraft profiles yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first aircraft profile above to keep planning assumptions consistent across web and mobile.
            </Text>
          </View>
        ) : (
          profiles.map((profile) => (
            <View key={profile.id} style={styles.profileCard}>
              <View style={styles.profileTopRow}>
                <View style={styles.profileIdentity}>
                  <Text style={styles.profileName}>{profile.name}</Text>
                  <Text style={styles.profileMeta}>
                    {profile.tailNumber || 'No tail number'} · {profile.type?.icaoType || 'Custom'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(profile.id)} activeOpacity={0.92}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.profileMetricsRow}>
                <View style={styles.profileMetric}>
                  <Text style={styles.profileMetricLabel}>Cruise</Text>
                  <Text style={styles.profileMetricValue}>
                    {profile.cruiseKtasOverride || profile.type?.cruiseKtas || '—'} KTAS
                  </Text>
                </View>
                <View style={styles.profileMetric}>
                  <Text style={styles.profileMetricLabel}>Fuel burn</Text>
                  <Text style={styles.profileMetricValue}>
                    {profile.fuelBurnOverrideGph || profile.type?.fuelBurnGph || '—'} GPH
                  </Text>
                </View>
                <View style={styles.profileMetric}>
                  <Text style={styles.profileMetricLabel}>Usable fuel</Text>
                  <Text style={styles.profileMetricValue}>
                    {profile.usableFuelOverrideGal || profile.type?.usableFuelGal || '—'} gal
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.sm,
    paddingBottom: 120,
  },
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
  statusStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#dbeafe',
  },
  heroAction: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.lg,
    paddingVertical: 15,
    backgroundColor: colors.primary,
  },
  heroActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
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
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  searchInput: {
    flex: 1,
  },
  secondaryButton: {
    minWidth: 108,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderRadius: radius.lg,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: '800',
  },
  selectedLibraryCard: {
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: spacing.sm,
  },
  selectedLibraryLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  selectedLibraryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
  },
  selectedLibraryMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    marginBottom: spacing.xs,
  },
  resultCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  resultMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  helperText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  overrideGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridInput: {
    width: '48%',
  },
  primaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  profileCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  profileIdentity: {
    flex: 1,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  profileMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  deleteText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  profileMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  profileMetric: {
    flex: 1,
    minWidth: 96,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileMetricLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.textSoft,
    textTransform: 'uppercase',
  },
  profileMetricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
  },
});
