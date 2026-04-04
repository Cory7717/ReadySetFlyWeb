import { useMemo, useReducer } from 'react';
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

// ─── Types ────────────────────────────────────────────────────────────────────

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

type WBStation = {
  id: string;
  label: string;
  weightLb: string;
  armIn: string;
  locked: boolean;
};

type EnvelopePoint = {
  id: string;
  weightLb: string;
  cgMinIn: string;
  cgMaxIn: string;
};

type WBState = {
  selectedType: AircraftType | null;
  query: string;
  showPicker: boolean;
  stations: WBStation[];
  fuelGallons: string;
  fuelArmIn: string;
  maxGrossOverride: string;
  envelopePoints: EnvelopePoint[];
};

type WBAction =
  | { type: 'set_query'; value: string }
  | { type: 'set_show_picker'; value: boolean }
  | { type: 'load_type'; payload: AircraftType }
  | { type: 'set_station'; id: string; field: 'label' | 'weightLb' | 'armIn'; value: string }
  | { type: 'add_station' }
  | { type: 'remove_station'; id: string }
  | { type: 'set_fuel'; field: 'fuelGallons' | 'fuelArmIn'; value: string }
  | { type: 'set_max_gross'; value: string }
  | { type: 'add_envelope_point' }
  | { type: 'remove_envelope_point'; id: string }
  | { type: 'set_envelope_point'; id: string; field: 'weightLb' | 'cgMinIn' | 'cgMaxIn'; value: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNumber(value: string): number {
  const num = Number(value.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(num) ? num : 0;
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Linearly interpolates CG min/max limits at the given gross weight from a
 * table of user-defined envelope points sorted by weight. Returns null when
 * fewer than one valid point is available.
 */
function interpolateCgLimits(
  envelopePoints: EnvelopePoint[],
  totalWeightLb: number,
): { cgMinIn: number; cgMaxIn: number } | null {
  const valid = envelopePoints
    .map(p => ({
      weight: toNumber(p.weightLb),
      cgMin: toNumber(p.cgMinIn),
      cgMax: toNumber(p.cgMaxIn),
    }))
    .filter(p => p.weight > 0 && p.cgMax > p.cgMin)
    .sort((a, b) => a.weight - b.weight);

  if (valid.length === 0) return null;
  if (valid.length === 1) return { cgMinIn: valid[0].cgMin, cgMaxIn: valid[0].cgMax };

  if (totalWeightLb <= valid[0].weight) {
    return { cgMinIn: valid[0].cgMin, cgMaxIn: valid[0].cgMax };
  }
  const last = valid[valid.length - 1];
  if (totalWeightLb >= last.weight) {
    return { cgMinIn: last.cgMin, cgMaxIn: last.cgMax };
  }
  for (let i = 0; i < valid.length - 1; i++) {
    const lo = valid[i];
    const hi = valid[i + 1];
    if (totalWeightLb >= lo.weight && totalWeightLb <= hi.weight) {
      const t = (totalWeightLb - lo.weight) / (hi.weight - lo.weight);
      return {
        cgMinIn: lo.cgMin + t * (hi.cgMin - lo.cgMin),
        cgMaxIn: lo.cgMax + t * (hi.cgMax - lo.cgMax),
      };
    }
  }
  return null;
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

const DEFAULT_STATIONS: WBStation[] = [
  { id: 'empty', label: 'Empty weight', weightLb: '0', armIn: '0', locked: true },
  { id: 'front', label: 'Front seats', weightLb: '0', armIn: '0', locked: false },
  { id: 'rear', label: 'Rear seats', weightLb: '0', armIn: '0', locked: false },
  { id: 'baggage', label: 'Baggage', weightLb: '0', armIn: '0', locked: false },
];

const INITIAL_STATE: WBState = {
  selectedType: null,
  query: '',
  showPicker: false,
  stations: DEFAULT_STATIONS,
  fuelGallons: '0',
  fuelArmIn: '0',
  maxGrossOverride: '',
  envelopePoints: [],
};

function wbReducer(state: WBState, action: WBAction): WBState {
  switch (action.type) {
    case 'set_query':
      return { ...state, query: action.value };
    case 'set_show_picker':
      return { ...state, showPicker: action.value };
    case 'load_type': {
      const t = action.payload;
      const stations = state.stations.map(s => {
        if (s.id === 'empty' && t.emptyArmIn != null) return { ...s, armIn: String(t.emptyArmIn) };
        if (s.id === 'front' && t.frontArmIn != null) return { ...s, armIn: String(t.frontArmIn) };
        if (s.id === 'rear' && t.rearArmIn != null) return { ...s, armIn: String(t.rearArmIn) };
        if (s.id === 'baggage' && t.baggageArmIn != null) return { ...s, armIn: String(t.baggageArmIn) };
        return s;
      });
      return {
        ...state,
        selectedType: t,
        showPicker: false,
        stations,
        fuelArmIn: t.fuelArmIn != null ? String(t.fuelArmIn) : state.fuelArmIn,
        maxGrossOverride: t.maxGrossWeightLb ? String(t.maxGrossWeightLb) : state.maxGrossOverride,
      };
    }
    case 'set_station':
      return {
        ...state,
        stations: state.stations.map(s =>
          s.id === action.id ? { ...s, [action.field]: action.value } : s,
        ),
      };
    case 'add_station':
      return {
        ...state,
        stations: [
          ...state.stations,
          { id: makeId(), label: 'Station', weightLb: '0', armIn: '0', locked: false },
        ],
      };
    case 'remove_station':
      return { ...state, stations: state.stations.filter(s => s.id !== action.id || s.locked) };
    case 'set_fuel':
      return { ...state, [action.field]: action.value };
    case 'set_max_gross':
      return { ...state, maxGrossOverride: action.value };
    case 'add_envelope_point':
      return {
        ...state,
        envelopePoints: [
          ...state.envelopePoints,
          { id: makeId(), weightLb: '', cgMinIn: '', cgMaxIn: '' },
        ],
      };
    case 'remove_envelope_point':
      return { ...state, envelopePoints: state.envelopePoints.filter(p => p.id !== action.id) };
    case 'set_envelope_point':
      return {
        ...state,
        envelopePoints: state.envelopePoints.map(p =>
          p.id === action.id ? { ...p, [action.field]: action.value } : p,
        ),
      };
    default:
      return state;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryTile({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryTileLabel}>{label}</Text>
      <Text style={[styles.summaryTileValue, danger && styles.summaryTileValueDanger]}>{value}</Text>
    </View>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function StationRow({
  station,
  dispatch,
}: {
  station: WBStation;
  dispatch: React.Dispatch<WBAction>;
}) {
  const moment = toNumber(station.weightLb) * toNumber(station.armIn);
  return (
    <View style={styles.stationRow}>
      <View style={styles.stationLabelRow}>
        <TextInput
          style={[styles.stationLabelInput, station.locked && styles.stationLabelInputLocked]}
          value={station.label}
          onChangeText={v => dispatch({ type: 'set_station', id: station.id, field: 'label', value: v })}
          editable={!station.locked}
          placeholderTextColor={colors.textSoft}
        />
        {!station.locked && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => dispatch({ type: 'remove_station', id: station.id })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="remove-circle-outline" size={18} color={colors.textSoft} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.stationFieldRow}>
        <View style={styles.stationFieldCell}>
          <Text style={styles.stationFieldLabel}>Weight (lb)</Text>
          <TextInput
            style={styles.stationFieldInput}
            value={station.weightLb}
            onChangeText={v => dispatch({ type: 'set_station', id: station.id, field: 'weightLb', value: v })}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.textSoft}
          />
        </View>
        <View style={styles.stationFieldCell}>
          <Text style={styles.stationFieldLabel}>Arm (in)</Text>
          <TextInput
            style={styles.stationFieldInput}
            value={station.armIn}
            onChangeText={v => dispatch({ type: 'set_station', id: station.id, field: 'armIn', value: v })}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.textSoft}
          />
        </View>
        <View style={[styles.stationFieldCell, { alignItems: 'flex-end' }]}>
          <Text style={styles.stationFieldLabel}>Moment</Text>
          <Text style={styles.stationMoment}>{moment.toFixed(0)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WeightBalanceScreen() {
  const [state, dispatch] = useReducer(wbReducer, INITIAL_STATE);
  const { selectedType, query, showPicker, stations, fuelGallons, fuelArmIn, maxGrossOverride, envelopePoints } = state;

  const { data: aircraftTypes, isLoading } = useQuery<AircraftType[]>({
    queryKey: ['/api/aircraft/types'],
    queryFn: async () => {
      const res = await api.get('/api/aircraft/types');
      return res.data || [];
    },
  });

  const filteredTypes = useMemo(() => {
    if (!aircraftTypes) return [];
    const q = query.trim().toLowerCase();
    if (!q) return aircraftTypes;
    return aircraftTypes.filter(t =>
      `${t.make} ${t.model} ${t.icaoType || ''}`.toLowerCase().includes(q),
    );
  }, [aircraftTypes, query]);

  const fuelWeightLb = toNumber(fuelGallons) * 6.0;
  const fuelMoment = fuelWeightLb * toNumber(fuelArmIn);

  const totals = useMemo(() => {
    const stationWeight = stations.reduce((s, r) => s + toNumber(r.weightLb), 0);
    const stationMoment = stations.reduce((s, r) => s + toNumber(r.weightLb) * toNumber(r.armIn), 0);
    const totalWeight = stationWeight + fuelWeightLb;
    const totalMoment = stationMoment + fuelMoment;
    const cg = totalWeight > 0 ? totalMoment / totalWeight : 0;
    return { totalWeight, totalMoment, cg };
  }, [stations, fuelWeightLb, fuelMoment]);

  const maxGross = toNumber(maxGrossOverride);
  const isOverMax = maxGross > 0 && totals.totalWeight > maxGross;

  const cgLimits = useMemo(
    () => interpolateCgLimits(envelopePoints, totals.totalWeight),
    [envelopePoints, totals.totalWeight],
  );

  const cgStatus: 'within' | 'forward' | 'aft' | 'unknown' =
    cgLimits && totals.totalWeight > 0
      ? totals.cg < cgLimits.cgMinIn
        ? 'forward'
        : totals.cg > cgLimits.cgMaxIn
          ? 'aft'
          : 'within'
      : 'unknown';

  const cgMarkerPct =
    cgLimits && cgLimits.cgMaxIn > cgLimits.cgMinIn
      ? Math.min(100, Math.max(0, ((totals.cg - cgLimits.cgMinIn) / (cgLimits.cgMaxIn - cgLimits.cgMinIn)) * 100))
      : 0;

  const statusLabel =
    isOverMax
      ? 'Over gross'
      : cgStatus === 'within'
        ? 'In envelope'
        : cgStatus === 'forward'
          ? 'Fwd CG'
          : cgStatus === 'aft'
            ? 'Aft CG'
            : 'Planning';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Hero ── */}
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="barbell-outline" size={34} color="#93c5fd" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>LOADING TOOL</Text>
            <Text style={styles.heroTitle}>Weight & Balance</Text>
            <Text style={styles.heroSubtitle}>
              Dynamic stations with CG envelope interpolation across any gross weight.
            </Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <SummaryTile label="Total wt" value={`${totals.totalWeight.toFixed(1)} lb`} danger={isOverMax} />
          <SummaryTile
            label="CG"
            value={totals.totalWeight > 0 ? `${totals.cg.toFixed(2)} in` : '--'}
          />
          <SummaryTile
            label="Status"
            value={statusLabel}
            danger={isOverMax || cgStatus === 'forward' || cgStatus === 'aft'}
          />
        </View>
      </View>

      {/* ── Aircraft baseline ── */}
      <SectionCard
        title="Aircraft baseline"
        subtitle="Start from the RSF library to prefill station arms and max gross."
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => dispatch({ type: 'set_show_picker', value: true })}
            activeOpacity={0.92}
          >
            <Text style={styles.selectButtonText}>
              {selectedType ? `${selectedType.make} ${selectedType.model}` : 'Choose aircraft from library'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        {selectedType ? (
          <View style={styles.selectedTypeCard}>
            <Text style={styles.selectedTypeTitle}>
              {selectedType.make} {selectedType.model}{selectedType.icaoType ? ` (${selectedType.icaoType})` : ''}
            </Text>
            <Text style={styles.selectedTypeMeta}>
              Max gross {selectedType.maxGrossWeightLb} lb · Usable fuel {selectedType.usableFuelGal} gal
            </Text>
          </View>
        ) : null}
      </SectionCard>

      {/* ── Aircraft picker modal ── */}
      <Modal
        visible={showPicker}
        animationType="slide"
        onRequestClose={() => dispatch({ type: 'set_show_picker', value: false })}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Aircraft</Text>
            <TouchableOpacity onPress={() => dispatch({ type: 'set_show_picker', value: false })}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search make, model, ICAO"
            placeholderTextColor={colors.textSoft}
            value={query}
            onChangeText={v => dispatch({ type: 'set_query', value: v })}
            autoCapitalize="characters"
          />
          <ScrollView style={styles.modalList}>
            {filteredTypes.map(t => {
              const isSelected = selectedType?.id === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.listItem, isSelected && styles.listItemActive]}
                  onPress={() => dispatch({ type: 'load_type', payload: t })}
                  activeOpacity={0.92}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>{t.make} {t.model}</Text>
                    <Text style={styles.listSubtitle}>
                      {t.icaoType || 'No ICAO'} · Max gross {t.maxGrossWeightLb} lb
                    </Text>
                  </View>
                  {isSelected ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Weight stations ── */}
      <SectionCard
        title="Weight stations"
        subtitle="Weight and arm for each loading station. Moment is computed automatically."
        action={
          <TouchableOpacity style={styles.addBtn} onPress={() => dispatch({ type: 'add_station' })}>
            <Ionicons name="add" size={15} color={colors.primary} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        }
      >
        {stations.map(station => (
          <StationRow key={station.id} station={station} dispatch={dispatch} />
        ))}
      </SectionCard>

      {/* ── Fuel ── */}
      <SectionCard title="Fuel" subtitle="Fuel weight computed at 6.0 lb/gal.">
        <View style={styles.stationFieldRow}>
          <View style={styles.stationFieldCell}>
            <Text style={styles.stationFieldLabel}>Gallons</Text>
            <TextInput
              style={styles.stationFieldInput}
              value={fuelGallons}
              onChangeText={v => dispatch({ type: 'set_fuel', field: 'fuelGallons', value: v })}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textSoft}
            />
          </View>
          <View style={styles.stationFieldCell}>
            <Text style={styles.stationFieldLabel}>Arm (in)</Text>
            <TextInput
              style={styles.stationFieldInput}
              value={fuelArmIn}
              onChangeText={v => dispatch({ type: 'set_fuel', field: 'fuelArmIn', value: v })}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textSoft}
            />
          </View>
          <View style={[styles.stationFieldCell, { alignItems: 'flex-end' }]}>
            <Text style={styles.stationFieldLabel}>Weight (lb)</Text>
            <Text style={styles.stationMoment}>{fuelWeightLb.toFixed(1)}</Text>
          </View>
        </View>
      </SectionCard>

      {/* ── CG Envelope ── */}
      <SectionCard
        title="CG envelope"
        subtitle="Define (weight, CG min, CG max) points. Limits interpolate linearly at any gross weight."
        action={
          <TouchableOpacity style={styles.addBtn} onPress={() => dispatch({ type: 'add_envelope_point' })}>
            <Ionicons name="add" size={15} color={colors.primary} />
            <Text style={styles.addBtnText}>Add point</Text>
          </TouchableOpacity>
        }
      >
        <Text style={styles.fieldLabel}>Max gross weight (lb)</Text>
        <TextInput
          style={styles.input}
          value={maxGrossOverride}
          onChangeText={v => dispatch({ type: 'set_max_gross', value: v })}
          keyboardType="numeric"
          placeholder="Enter max gross"
          placeholderTextColor={colors.textSoft}
        />

        {envelopePoints.length > 0 ? (
          <View style={styles.envelopeTable}>
            <View style={styles.envelopeTableHeader}>
              <Text style={[styles.envHeaderCell, { flex: 1.2 }]}>Wt (lb)</Text>
              <Text style={[styles.envHeaderCell, { flex: 1 }]}>CG min</Text>
              <Text style={[styles.envHeaderCell, { flex: 1 }]}>CG max</Text>
              <View style={{ width: 32 }} />
            </View>
            {envelopePoints.map(p => (
              <View key={p.id} style={styles.envelopeRow}>
                <TextInput
                  style={[styles.envCell, { flex: 1.2 }]}
                  value={p.weightLb}
                  onChangeText={v => dispatch({ type: 'set_envelope_point', id: p.id, field: 'weightLb', value: v })}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSoft}
                />
                <TextInput
                  style={[styles.envCell, { flex: 1 }]}
                  value={p.cgMinIn}
                  onChangeText={v => dispatch({ type: 'set_envelope_point', id: p.id, field: 'cgMinIn', value: v })}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSoft}
                />
                <TextInput
                  style={[styles.envCell, { flex: 1 }]}
                  value={p.cgMaxIn}
                  onChangeText={v => dispatch({ type: 'set_envelope_point', id: p.id, field: 'cgMaxIn', value: v })}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSoft}
                />
                <TouchableOpacity
                  style={styles.envRemoveBtn}
                  onPress={() => dispatch({ type: 'remove_envelope_point', id: p.id })}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <Ionicons name="remove-circle-outline" size={18} color={colors.textSoft} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.envelopeHint}>
            No envelope points yet. Add at least two rows (e.g. at empty weight and max gross) to enable interpolated CG limits.
          </Text>
        )}

        {/* CG visualization */}
        {cgLimits && totals.totalWeight > 0 ? (
          <View style={styles.cgVisual}>
            <View style={styles.cgBarTrack}>
              <View style={styles.cgBarSafe} />
              <View
                style={[
                  styles.cgBarMarker,
                  cgStatus !== 'within' && styles.cgBarMarkerOutside,
                  { left: `${cgMarkerPct}%` as any },
                ]}
              />
            </View>
            <View style={styles.cgBarLabels}>
              <Text style={styles.cgBarEdge}>Fwd {cgLimits.cgMinIn.toFixed(1)}"</Text>
              <Text
                style={[
                  styles.cgBarCenter,
                  cgStatus === 'within' ? styles.cgTextWithin : styles.cgTextOutside,
                ]}
              >
                {totals.cg.toFixed(2)}" CG
              </Text>
              <Text style={styles.cgBarEdge}>Aft {cgLimits.cgMaxIn.toFixed(1)}"</Text>
            </View>
            <Text style={[styles.cgStatusText, cgStatus !== 'within' && styles.cgStatusTextOutside]}>
              {cgStatus === 'within' && 'Within CG envelope'}
              {cgStatus === 'forward' && 'Forward of CG envelope'}
              {cgStatus === 'aft' && 'Aft of CG envelope'}
            </Text>
          </View>
        ) : null}
      </SectionCard>

      {/* ── Computed totals ── */}
      <SectionCard title="Computed totals">
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total weight</Text>
            <Text style={[styles.metricValue, isOverMax && styles.metricValueDanger]}>
              {totals.totalWeight.toFixed(1)} lb
            </Text>
            {maxGross > 0 ? (
              <Text style={[styles.metricHint, isOverMax && styles.metricHintDanger]}>
                {isOverMax
                  ? `${(totals.totalWeight - maxGross).toFixed(1)} lb over`
                  : `${(maxGross - totals.totalWeight).toFixed(1)} lb margin`}
              </Text>
            ) : null}
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>CG location</Text>
            <Text style={styles.metricValue}>
              {totals.totalWeight > 0 ? `${totals.cg.toFixed(2)} in` : '--'}
            </Text>
            <Text style={styles.metricHint}>{totals.totalMoment.toFixed(0)} lb·in</Text>
          </View>
        </View>
      </SectionCard>

      {/* ── Disclaimer ── */}
      <SectionCard title="Disclaimer">
        <Text style={styles.noteText}>
          For training and planning use only. Always verify with approved aircraft W&B data, the POH/AFM, and actual loading before every flight.
        </Text>
      </SectionCard>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.sm, paddingBottom: 120 },

  // Hero
  heroPanel: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.cockpit,
    ...shadow.floating,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
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
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  summaryTile: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  summaryTileLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#bfdbfe',
    textTransform: 'uppercase',
  },
  summaryTileValue: { fontSize: 13, fontWeight: '700', color: '#fff', marginTop: 6 },
  summaryTileValueDanger: { color: '#fca5a5' },

  // Section card
  sectionCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  sectionTitle: { ...typography.h2 },
  sectionSubtitle: { ...typography.muted, marginTop: 4 },
  sectionContent: { marginTop: spacing.md },

  // Aircraft picker
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
  selectedTypeTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  selectedTypeMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  modalContainer: { flex: 1, padding: spacing.md, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  searchInput: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalList: { marginTop: spacing.xs },
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
  listItemActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  listTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  listSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  // Station rows
  stationRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  stationLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  stationLabelInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    borderWidth: 0,
    padding: 0,
  },
  stationLabelInputLocked: { color: colors.textMuted },
  removeBtn: { padding: 4 },
  stationFieldRow: { flexDirection: 'row', gap: spacing.sm },
  stationFieldCell: { flex: 1 },
  stationFieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.textSoft,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  stationFieldInput: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  stationMoment: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 10 },

  // Add button (inline header action)
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  // Input field (max gross)
  fieldLabel: {
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

  // Envelope table
  envelopeTable: { marginTop: spacing.md },
  envelopeTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
  },
  envHeaderCell: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.textSoft,
    textTransform: 'uppercase',
  },
  envelopeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  envCell: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 13,
  },
  envRemoveBtn: { width: 32, alignItems: 'center' },
  envelopeHint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 18 },

  // CG bar visualization
  cgVisual: { marginTop: spacing.lg },
  cgBarTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  cgBarSafe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    backgroundColor: 'rgba(0,212,160,0.25)',
  },
  cgBarMarker: {
    position: 'absolute',
    top: -4,
    width: 3,
    height: 18,
    marginLeft: -1,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  cgBarMarkerOutside: { backgroundColor: colors.danger },
  cgBarLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  cgBarEdge: { fontSize: 11, color: colors.textMuted },
  cgBarCenter: { fontSize: 12, fontWeight: '700' },
  cgTextWithin: { color: '#00D4A0' },
  cgTextOutside: { color: colors.danger },
  cgStatusText: { fontSize: 12, color: '#00D4A0', marginTop: 4, textAlign: 'center' },
  cgStatusTextOutside: { color: colors.danger },

  // Metrics
  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  metricCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.textSoft,
    textTransform: 'uppercase',
  },
  metricValue: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 6 },
  metricValueDanger: { color: colors.danger },
  metricHint: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  metricHintDanger: { color: colors.danger },

  noteText: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
});
