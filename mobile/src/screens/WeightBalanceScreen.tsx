import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type AircraftType = {
  id: string;
  make: string;
  model: string;
  icaoType?: string | null;
  maxGrossWeightLb: number;
  usableFuelGal: number;
  emptyArmIn?: number | null;
  frontArmIn?: number | null;
  rearArmIn?: number | null;
  baggageArmIn?: number | null;
  fuelArmIn?: number | null;
};

function toNumber(value: string) {
  const cleaned = value.replace(/[^0-9.\-]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

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

export default function WeightBalanceScreen() {
  const [query, setQuery] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [selectedType, setSelectedType] = useState<AircraftType | null>(null);
  const [emptyWeight, setEmptyWeight] = useState('0');
  const [emptyArm, setEmptyArm] = useState('0');
  const [frontWeight, setFrontWeight] = useState('0');
  const [frontArm, setFrontArm] = useState('0');
  const [rearWeight, setRearWeight] = useState('0');
  const [rearArm, setRearArm] = useState('0');
  const [baggageWeight, setBaggageWeight] = useState('0');
  const [baggageArm, setBaggageArm] = useState('0');
  const [fuelGallons, setFuelGallons] = useState('0');
  const [fuelArm, setFuelArm] = useState('0');
  const [maxGrossOverride, setMaxGrossOverride] = useState('');
  const [cgMin, setCgMin] = useState('');
  const [cgMax, setCgMax] = useState('');

  const { data: aircraftTypes, isLoading } = useQuery<AircraftType[]>({
    queryKey: ['/api/aircraft/types'],
    queryFn: async () => {
      const res = await api.get('/api/aircraft/types');
      return res.data || [];
    },
  });

  useEffect(() => {
    if (!selectedType) return;
    if (!maxGrossOverride) {
      setMaxGrossOverride(String(selectedType.maxGrossWeightLb || ''));
    }
  }, [selectedType, maxGrossOverride]);

  useEffect(() => {
    if (!selectedType) return;
    const maybeSet = (current: string, next: number | null | undefined, setter: (value: string) => void) => {
      if (current !== '' && toNumber(current) !== 0) return;
      if (typeof next !== 'number') return;
      setter(String(next));
    };
    maybeSet(emptyArm, selectedType.emptyArmIn ?? undefined, setEmptyArm);
    maybeSet(frontArm, selectedType.frontArmIn ?? undefined, setFrontArm);
    maybeSet(rearArm, selectedType.rearArmIn ?? undefined, setRearArm);
    maybeSet(baggageArm, selectedType.baggageArmIn ?? undefined, setBaggageArm);
    maybeSet(fuelArm, selectedType.fuelArmIn ?? undefined, setFuelArm);
  }, [selectedType, emptyArm, frontArm, rearArm, baggageArm, fuelArm]);

  const filteredTypes = useMemo(() => {
    if (!aircraftTypes) return [];
    const q = query.trim().toLowerCase();
    if (!q) return aircraftTypes;
    return aircraftTypes.filter((type) => {
      const label = `${type.make} ${type.model} ${type.icaoType || ''}`.toLowerCase();
      return label.includes(q);
    });
  }, [aircraftTypes, query]);

  const fuelWeight = toNumber(fuelGallons) * 6;
  const maxGross = toNumber(maxGrossOverride);
  const cgMinValue = toNumber(cgMin);
  const cgMaxValue = toNumber(cgMax);

  const totals = useMemo(() => {
    const rows = [
      { weight: toNumber(emptyWeight), arm: toNumber(emptyArm) },
      { weight: toNumber(frontWeight), arm: toNumber(frontArm) },
      { weight: toNumber(rearWeight), arm: toNumber(rearArm) },
      { weight: toNumber(baggageWeight), arm: toNumber(baggageArm) },
      { weight: fuelWeight, arm: toNumber(fuelArm) },
    ];
    const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
    const totalMoment = rows.reduce((sum, row) => sum + row.weight * row.arm, 0);
    const cg = totalWeight > 0 ? totalMoment / totalWeight : 0;
    return { totalWeight, totalMoment, cg };
  }, [emptyWeight, emptyArm, frontWeight, frontArm, rearWeight, rearArm, baggageWeight, baggageArm, fuelWeight, fuelArm]);

  const isOverMax = maxGross > 0 && totals.totalWeight > maxGross;
  const hasCgRange = cgMinValue > 0 && cgMaxValue > cgMinValue;
  const cgStatus =
    hasCgRange && totals.totalWeight > 0
      ? totals.cg < cgMinValue
        ? 'forward'
        : totals.cg > cgMaxValue
          ? 'aft'
          : 'within'
      : 'unknown';
  const cgRangeSpan = hasCgRange ? cgMaxValue - cgMinValue : 0;
  const cgMarkerPercent =
    hasCgRange && cgRangeSpan > 0
      ? Math.min(100, Math.max(0, ((totals.cg - cgMinValue) / cgRangeSpan) * 100))
      : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="barbell-outline" size={34} color="#93c5fd" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>LOADING TOOL</Text>
            <Text style={styles.heroTitle}>Build a quick weight and balance picture.</Text>
            <Text style={styles.heroSubtitle}>
              Start with an aircraft from the RSF library, add your loading stations, and estimate total weight, moment, and CG location for planning.
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile label="Total wt" value={`${totals.totalWeight.toFixed(1)} lb`} />
          <SummaryTile label="CG" value={totals.totalWeight > 0 ? totals.cg.toFixed(1) : '--'} />
          <SummaryTile label="Status" value={isOverMax ? 'Over gross' : 'Planning'} />
        </View>
      </View>

      <SectionCard
        title="Aircraft baseline"
        subtitle="Start from the RSF library to prefill max gross and station arm defaults where available."
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            <TouchableOpacity style={styles.selectButton} onPress={() => setShowPicker(true)} activeOpacity={0.92}>
              <Text style={styles.selectButtonText}>
                {selectedType ? `${selectedType.make} ${selectedType.model}` : 'Choose aircraft from library'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {selectedType ? (
              <View style={styles.selectedTypeCard}>
                <Text style={styles.selectedTypeTitle}>
                  {selectedType.make} {selectedType.model} ({selectedType.icaoType || 'N/A'})
                </Text>
                <Text style={styles.selectedTypeMeta}>
                  Max gross {selectedType.maxGrossWeightLb} lb · Usable fuel {selectedType.usableFuelGal} gal
                </Text>
              </View>
            ) : null}
          </>
        )}
      </SectionCard>

      <Modal visible={showPicker} animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Aircraft</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Search make, model, ICAO"
            placeholderTextColor={colors.textSoft}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="characters"
          />
          <ScrollView style={styles.modalList}>
            {filteredTypes.map((type) => {
              const label = `${type.make} ${type.model}`;
              const isSelected = selectedType?.id === type.id;
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[styles.listItem, isSelected && styles.listItemActive]}
                  onPress={() => {
                    setSelectedType(type);
                    setShowPicker(false);
                  }}
                  activeOpacity={0.92}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>{label}</Text>
                    <Text style={styles.listSubtitle}>
                      {type.icaoType || 'No ICAO'} · Max gross {type.maxGrossWeightLb} lb
                    </Text>
                  </View>
                  {isSelected ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      <SectionCard
        title="Weight stations"
        subtitle="Enter each station and use the library values as your starting arms when available."
      >
        <Text style={styles.inputLabel}>Empty weight (lb)</Text>
        <TextInput style={styles.input} value={emptyWeight} onChangeText={setEmptyWeight} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textSoft} />
        <Text style={styles.inputLabel}>Empty weight arm (in)</Text>
        <TextInput style={styles.input} value={emptyArm} onChangeText={setEmptyArm} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textSoft} />

        <View style={styles.divider} />

        <Text style={styles.inputLabel}>Front seats total (lb)</Text>
        <TextInput style={styles.input} value={frontWeight} onChangeText={setFrontWeight} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textSoft} />
        <Text style={styles.inputLabel}>Front seats arm (in)</Text>
        <TextInput style={styles.input} value={frontArm} onChangeText={setFrontArm} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textSoft} />

        <View style={styles.divider} />

        <Text style={styles.inputLabel}>Rear seats total (lb)</Text>
        <TextInput style={styles.input} value={rearWeight} onChangeText={setRearWeight} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textSoft} />
        <Text style={styles.inputLabel}>Rear seats arm (in)</Text>
        <TextInput style={styles.input} value={rearArm} onChangeText={setRearArm} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textSoft} />

        <View style={styles.divider} />

        <Text style={styles.inputLabel}>Baggage (lb)</Text>
        <TextInput style={styles.input} value={baggageWeight} onChangeText={setBaggageWeight} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textSoft} />
        <Text style={styles.inputLabel}>Baggage arm (in)</Text>
        <TextInput style={styles.input} value={baggageArm} onChangeText={setBaggageArm} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textSoft} />

        <View style={styles.divider} />

        <Text style={styles.inputLabel}>Fuel on board (gal)</Text>
        <TextInput style={styles.input} value={fuelGallons} onChangeText={setFuelGallons} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textSoft} />
        <Text style={styles.inputLabel}>Fuel arm (in)</Text>
        <TextInput style={styles.input} value={fuelArm} onChangeText={setFuelArm} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textSoft} />
        <Text style={styles.helperText}>Fuel weight uses 6.0 lb/gal.</Text>
      </SectionCard>

      <SectionCard
        title="Limits and summary"
        subtitle="Set max gross and CG range to visualize whether this loading estimate fits the plan."
      >
        <Text style={styles.inputLabel}>Max gross weight (lb)</Text>
        <TextInput style={styles.input} value={maxGrossOverride} onChangeText={setMaxGrossOverride} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textSoft} />
        <Text style={styles.inputLabel}>CG min (in)</Text>
        <TextInput style={styles.input} value={cgMin} onChangeText={setCgMin} keyboardType="numeric" placeholder="Optional" placeholderTextColor={colors.textSoft} />
        <Text style={styles.inputLabel}>CG max (in)</Text>
        <TextInput style={styles.input} value={cgMax} onChangeText={setCgMax} keyboardType="numeric" placeholder="Optional" placeholderTextColor={colors.textSoft} />

        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total weight</Text>
            <Text style={styles.metricValue}>{totals.totalWeight.toFixed(1)} lb</Text>
            <Text style={[styles.metricHint, isOverMax && styles.metricHintDanger]}>
              {isOverMax ? 'Over max gross' : 'Within limits (est.)'}
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>CG</Text>
            <Text style={styles.metricValue}>{totals.totalWeight > 0 ? totals.cg.toFixed(1) : '--'}</Text>
            <Text style={styles.metricHint}>Moment / total weight</Text>
          </View>
        </View>

        <Text style={styles.cgTitle}>CG envelope</Text>
        <Text style={styles.sectionSubtitle}>
          Enter CG min/max to visualize your loading location against a simple forward-to-aft bar.
        </Text>
        <View style={styles.cgBar}>
          {hasCgRange ? <View style={styles.cgSafe} /> : null}
          <View style={[styles.cgMarker, { left: `${cgMarkerPercent}%` }]} />
        </View>
        <View style={styles.cgLabels}>
          <Text style={styles.cgLabel}>Forward</Text>
          <Text style={styles.cgLabel}>
            {hasCgRange ? `${cgMinValue.toFixed(1)} - ${cgMaxValue.toFixed(1)} in` : 'Enter CG limits'}
          </Text>
          <Text style={styles.cgLabel}>Aft</Text>
        </View>
        <Text style={styles.cgStatus}>
          {cgStatus === 'within' && 'Within CG range'}
          {cgStatus === 'forward' && 'Forward of CG range'}
          {cgStatus === 'aft' && 'Aft of CG range'}
          {cgStatus === 'unknown' && 'Add CG limits to evaluate range'}
        </Text>
      </SectionCard>

      <SectionCard title="Disclaimer">
        <Text style={styles.noteText}>
          This calculator is for training and planning only. Always verify with approved aircraft weight and balance data, POH/AFM, and current loading.
        </Text>
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
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
    marginTop: spacing.xs,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  selectButtonText: { fontSize: 13, color: colors.text },
  selectedTypeCard: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedTypeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  selectedTypeMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  modalContainer: { flex: 1, padding: spacing.md, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  modalList: { marginTop: spacing.sm },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.xs,
  },
  listItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  listTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  listSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  helperText: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  metricRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  metricCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colors.textSoft, textTransform: 'uppercase' },
  metricValue: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 6 },
  metricHint: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  metricHintDanger: { color: colors.danger },
  cgTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: spacing.lg },
  cgBar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  cgSafe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', backgroundColor: '#bbf7d0' },
  cgMarker: { position: 'absolute', top: -4, width: 2, height: 18, backgroundColor: '#0f172a' },
  cgLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  cgLabel: { fontSize: 11, color: colors.textMuted },
  cgStatus: { fontSize: 12, marginTop: spacing.xs, color: colors.text },
  noteText: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
});
