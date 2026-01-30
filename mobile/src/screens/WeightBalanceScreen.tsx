import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
      <Text style={styles.title}>Weight & Balance</Text>
      <Text style={styles.subtitle}>
        Planning estimates only. Always verify against the aircraft POH/AFM.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Select Aircraft (Library)</Text>
        <Text style={styles.cardSubtitle}>Sets max gross weight as a starting point.</Text>
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            <TouchableOpacity style={styles.selectButton} onPress={() => setShowPicker(true)}>
              <Text style={styles.selectButtonText}>
                {selectedType ? `${selectedType.make} ${selectedType.model}` : 'Choose aircraft from library'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {selectedType && (
              <Text style={styles.listSubtitle}>
                {selectedType.icaoType || 'No ICAO'} - Max gross {selectedType.maxGrossWeightLb} lb
              </Text>
            )}
          </>
        )}
      </View>

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
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>{label}</Text>
                    <Text style={styles.listSubtitle}>
                      {type.icaoType || 'No ICAO'} - Max gross {type.maxGrossWeightLb} lb
                    </Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weight Stations</Text>

        <Text style={styles.label}>Empty weight (lb)</Text>
        <TextInput style={styles.input} value={emptyWeight} onChangeText={setEmptyWeight} keyboardType="numeric" />
        <Text style={styles.label}>Empty weight arm (in)</Text>
        <TextInput style={styles.input} value={emptyArm} onChangeText={setEmptyArm} keyboardType="numeric" />

        <View style={styles.divider} />

        <Text style={styles.label}>Front seats total (lb)</Text>
        <TextInput style={styles.input} value={frontWeight} onChangeText={setFrontWeight} keyboardType="numeric" />
        <Text style={styles.label}>Front seats arm (in)</Text>
        <TextInput style={styles.input} value={frontArm} onChangeText={setFrontArm} keyboardType="numeric" />

        <View style={styles.divider} />

        <Text style={styles.label}>Rear seats total (lb)</Text>
        <TextInput style={styles.input} value={rearWeight} onChangeText={setRearWeight} keyboardType="numeric" />
        <Text style={styles.label}>Rear seats arm (in)</Text>
        <TextInput style={styles.input} value={rearArm} onChangeText={setRearArm} keyboardType="numeric" />

        <View style={styles.divider} />

        <Text style={styles.label}>Baggage (lb)</Text>
        <TextInput style={styles.input} value={baggageWeight} onChangeText={setBaggageWeight} keyboardType="numeric" />
        <Text style={styles.label}>Baggage arm (in)</Text>
        <TextInput style={styles.input} value={baggageArm} onChangeText={setBaggageArm} keyboardType="numeric" />

        <View style={styles.divider} />

        <Text style={styles.label}>Fuel on board (gal)</Text>
        <TextInput style={styles.input} value={fuelGallons} onChangeText={setFuelGallons} keyboardType="numeric" />
        <Text style={styles.label}>Fuel arm (in)</Text>
        <TextInput style={styles.input} value={fuelArm} onChangeText={setFuelArm} keyboardType="numeric" />
        <Text style={styles.hint}>Fuel weight uses 6.0 lb/gal.</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>Max gross weight (lb)</Text>
        <TextInput style={styles.input} value={maxGrossOverride} onChangeText={setMaxGrossOverride} keyboardType="numeric" />
        <Text style={styles.label}>CG min (in)</Text>
        <TextInput style={styles.input} value={cgMin} onChangeText={setCgMin} keyboardType="numeric" />
        <Text style={styles.label}>CG max (in)</Text>
        <TextInput style={styles.input} value={cgMax} onChangeText={setCgMax} keyboardType="numeric" />
      </View>

      <View style={styles.cardRow}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Total Weight</Text>
          <Text style={styles.cardValue}>{totals.totalWeight.toFixed(1)} lb</Text>
          <Text style={[styles.cardHint, isOverMax && { color: colors.danger }]}>
            {isOverMax ? 'Over max gross' : 'Within limits (est.)'}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>CG (in)</Text>
          <Text style={styles.cardValue}>{totals.totalWeight > 0 ? totals.cg.toFixed(1) : '--'}</Text>
          <Text style={styles.cardHint}>Total moment / total weight</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>CG Envelope</Text>
        <Text style={styles.cardSubtitle}>Enter CG min/max to visualize your loading location.</Text>
        <View style={styles.cgBar}>
          {hasCgRange && <View style={styles.cgSafe} />}
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
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Disclaimer</Text>
        <Text style={styles.noteText}>
          This calculator is for training and planning only. Always verify
          with approved aircraft weight & balance data, POH/AFM, and current
          loading.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  title: { ...typography.h2 },
  subtitle: { marginTop: spacing.xs, color: colors.textMuted, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  cardRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: spacing.sm },
  cardLabel: { fontSize: 12, color: colors.textMuted },
  cardValue: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  cardHint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  label: { fontSize: 12, fontWeight: '600', color: colors.text, marginTop: spacing.xs },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  list: { marginBottom: spacing.sm },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.xs,
  },
  listItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  listTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  listSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  selectButtonText: { fontSize: 13, color: colors.text },
  modalContainer: { flex: 1, padding: spacing.md, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalList: { marginTop: spacing.sm },
  cgBar: { height: 10, borderRadius: 999, backgroundColor: colors.border, marginTop: spacing.sm, position: 'relative', overflow: 'hidden' },
  cgSafe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', backgroundColor: '#bbf7d0' },
  cgMarker: { position: 'absolute', top: -4, width: 2, height: 18, backgroundColor: '#0f172a' },
  cgLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  cgLabel: { fontSize: 11, color: colors.textMuted },
  cgStatus: { fontSize: 12, marginTop: spacing.xs, color: colors.text },
  noteCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  noteTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  noteText: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
});
