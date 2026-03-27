import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

export default function LogbookEntryScreen({ navigation, route }: any) {
  const entryId = route?.params?.entryId as string | undefined;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    flightDate: '',
    tailNumber: '',
    aircraftType: '',
    route: '',
    timeDay: '',
    timeNight: '',
    pic: '',
    sic: '',
    dual: '',
    instrumentActual: '',
    landingsDay: '',
    landingsNight: '',
    approaches: '',
    holds: '',
    remarks: '',
  });

  const totalTime = useMemo(
    () => (Number(form.timeDay) || 0) + (Number(form.timeNight) || 0),
    [form.timeDay, form.timeNight]
  );
  const landingTotal = useMemo(
    () => (Number(form.landingsDay) || 0) + (Number(form.landingsNight) || 0),
    [form.landingsDay, form.landingsNight]
  );
  const modeLabel = entryId ? 'Edit flight entry' : 'New flight entry';

  const loadEntry = async () => {
    if (!entryId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/logbook/${entryId}`);
      const entry = res.data;
      setForm({
        flightDate: entry.flightDate || '',
        tailNumber: entry.tailNumber || '',
        aircraftType: entry.aircraftType || '',
        route: entry.route || '',
        timeDay: String(entry.timeDay || ''),
        timeNight: String(entry.timeNight || ''),
        pic: String(entry.pic || ''),
        sic: String(entry.sic || ''),
        dual: String(entry.dual || ''),
        instrumentActual: String(entry.instrumentActual || ''),
        landingsDay: String(entry.landingsDay || ''),
        landingsNight: String(entry.landingsNight || ''),
        approaches: String(entry.approaches || ''),
        holds: String(entry.holds || ''),
        remarks: entry.remarks || '',
      });
    } catch (error: any) {
      Alert.alert('Logbook', error?.response?.data?.error || 'Unable to load entry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntry();
  }, [entryId]);

  const handleSave = async () => {
    if (!form.flightDate) {
      Alert.alert('Missing date', 'Flight date is required.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        flightDate: form.flightDate,
        tailNumber: form.tailNumber || null,
        aircraftType: form.aircraftType || null,
        route: form.route || null,
        timeDay: form.timeDay ? Number(form.timeDay) : 0,
        timeNight: form.timeNight ? Number(form.timeNight) : 0,
        pic: form.pic ? Number(form.pic) : 0,
        sic: form.sic ? Number(form.sic) : 0,
        dual: form.dual ? Number(form.dual) : 0,
        instrumentActual: form.instrumentActual ? Number(form.instrumentActual) : 0,
        landingsDay: form.landingsDay ? Number(form.landingsDay) : 0,
        landingsNight: form.landingsNight ? Number(form.landingsNight) : 0,
        approaches: form.approaches ? Number(form.approaches) : 0,
        holds: form.holds ? Number(form.holds) : 0,
        remarks: form.remarks || null,
      };
      if (entryId) {
        await api.patch(`/api/logbook/${entryId}`, payload);
      } else {
        await api.post('/api/logbook', payload);
      }
      Alert.alert('Saved', 'Logbook entry saved successfully.');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Save failed', error?.response?.data?.error || 'Unable to save entry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>LOGBOOK ENTRY</Text>
            <Text style={styles.heroTitle}>{modeLabel}</Text>
            <Text style={styles.heroSubtitle}>
              Capture route, time, approaches, and remarks in a cleaner pilot-focused workflow.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{entryId ? 'Editing' : 'Draft'}</Text>
          </View>
        </View>

        <View style={styles.metricRow}>
          <SummaryMetric label="Total time" value={`${totalTime.toFixed(1)} hrs`} />
          <SummaryMetric label="Landings" value={String(landingTotal)} />
          <SummaryMetric label="Approaches" value={form.approaches || '0'} />
        </View>

        <View style={styles.heroActionRow}>
          <TouchableOpacity style={styles.primaryAction} onPress={handleSave} disabled={loading} activeOpacity={0.92}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryActionText}>Save Entry</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.goBack()} activeOpacity={0.92}>
            <Text style={styles.secondaryActionText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Flight Details</Text>
        <Text style={styles.sectionSubtitle}>Basic identity, aircraft, and route information.</Text>
        <Field
          label="Flight Date (YYYY-MM-DD)"
          value={form.flightDate}
          onChangeText={(value) => setForm((prev) => ({ ...prev, flightDate: value }))}
          placeholder="2026-01-28"
        />
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Field
              label="Tail Number"
              value={form.tailNumber}
              onChangeText={(value) => setForm((prev) => ({ ...prev, tailNumber: value }))}
              placeholder="N12345"
            />
          </View>
          <View style={styles.rowItem}>
            <Field
              label="Aircraft Type"
              value={form.aircraftType}
              onChangeText={(value) => setForm((prev) => ({ ...prev, aircraftType: value }))}
              placeholder="C172"
            />
          </View>
        </View>
        <Field
          label="Route"
          value={form.route}
          onChangeText={(value) => setForm((prev) => ({ ...prev, route: value }))}
          placeholder="KJFK-KBOS"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Time & Credit</Text>
        <Text style={styles.sectionSubtitle}>Log total time by phase and training credit.</Text>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Field
              label="Day (hrs)"
              value={form.timeDay}
              onChangeText={(value) => setForm((prev) => ({ ...prev, timeDay: value }))}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.rowItem}>
            <Field
              label="Night (hrs)"
              value={form.timeNight}
              onChangeText={(value) => setForm((prev) => ({ ...prev, timeNight: value }))}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Field
              label="PIC (hrs)"
              value={form.pic}
              onChangeText={(value) => setForm((prev) => ({ ...prev, pic: value }))}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.rowItem}>
            <Field
              label="SIC (hrs)"
              value={form.sic}
              onChangeText={(value) => setForm((prev) => ({ ...prev, sic: value }))}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Field
              label="Dual (hrs)"
              value={form.dual}
              onChangeText={(value) => setForm((prev) => ({ ...prev, dual: value }))}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.rowItem}>
            <Field
              label="Instrument (hrs)"
              value={form.instrumentActual}
              onChangeText={(value) => setForm((prev) => ({ ...prev, instrumentActual: value }))}
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Operations</Text>
        <Text style={styles.sectionSubtitle}>Approaches, holds, and landing counts.</Text>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Field
              label="Landings (Day)"
              value={form.landingsDay}
              onChangeText={(value) => setForm((prev) => ({ ...prev, landingsDay: value }))}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.rowItem}>
            <Field
              label="Landings (Night)"
              value={form.landingsNight}
              onChangeText={(value) => setForm((prev) => ({ ...prev, landingsNight: value }))}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Field
              label="Approaches"
              value={form.approaches}
              onChangeText={(value) => setForm((prev) => ({ ...prev, approaches: value }))}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.rowItem}>
            <Field
              label="Holds"
              value={form.holds}
              onChangeText={(value) => setForm((prev) => ({ ...prev, holds: value }))}
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Remarks</Text>
        <Text style={styles.sectionSubtitle}>Anything worth preserving for review, compliance, or memory.</Text>
        <Field
          label="Remarks"
          value={form.remarks}
          onChangeText={(value) => setForm((prev) => ({ ...prev, remarks: value }))}
          multiline
          placeholder="Notes, conditions, training details, or observations"
        />
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
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
    maxWidth: 330,
  },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  metricCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#bfdbfe',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginTop: 6,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  primaryAction: {
    flex: 1,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryAction: {
    borderRadius: radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
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
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowItem: {
    flex: 1,
  },
  fieldBlock: {
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
  },
  multiline: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
});
