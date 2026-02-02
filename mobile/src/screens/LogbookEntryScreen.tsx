import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

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
      {loading && <ActivityIndicator color="#1e40af" style={{ marginBottom: 10 }} />}
      <Text style={styles.label}>Flight Date (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        value={form.flightDate}
        onChangeText={(value) => setForm((prev) => ({ ...prev, flightDate: value }))}
        placeholder="2026-01-28"
      />
      <Text style={styles.label}>Tail Number</Text>
      <TextInput
        style={styles.input}
        value={form.tailNumber}
        onChangeText={(value) => setForm((prev) => ({ ...prev, tailNumber: value }))}
        placeholder="N12345"
      />
      <Text style={styles.label}>Aircraft Type</Text>
      <TextInput
        style={styles.input}
        value={form.aircraftType}
        onChangeText={(value) => setForm((prev) => ({ ...prev, aircraftType: value }))}
        placeholder="C172"
      />
      <Text style={styles.label}>Route</Text>
      <TextInput
        style={styles.input}
        value={form.route}
        onChangeText={(value) => setForm((prev) => ({ ...prev, route: value }))}
        placeholder="KJFK-KBOS"
      />
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Day (hrs)</Text>
          <TextInput
            style={styles.input}
            value={form.timeDay}
            onChangeText={(value) => setForm((prev) => ({ ...prev, timeDay: value }))}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Night (hrs)</Text>
          <TextInput
            style={styles.input}
            value={form.timeNight}
            onChangeText={(value) => setForm((prev) => ({ ...prev, timeNight: value }))}
            keyboardType="numeric"
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>PIC (hrs)</Text>
          <TextInput
            style={styles.input}
            value={form.pic}
            onChangeText={(value) => setForm((prev) => ({ ...prev, pic: value }))}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>SIC (hrs)</Text>
          <TextInput
            style={styles.input}
            value={form.sic}
            onChangeText={(value) => setForm((prev) => ({ ...prev, sic: value }))}
            keyboardType="numeric"
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Dual (hrs)</Text>
          <TextInput
            style={styles.input}
            value={form.dual}
            onChangeText={(value) => setForm((prev) => ({ ...prev, dual: value }))}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Instrument (hrs)</Text>
          <TextInput
            style={styles.input}
            value={form.instrumentActual}
            onChangeText={(value) => setForm((prev) => ({ ...prev, instrumentActual: value }))}
            keyboardType="numeric"
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Landings (Day)</Text>
          <TextInput
            style={styles.input}
            value={form.landingsDay}
            onChangeText={(value) => setForm((prev) => ({ ...prev, landingsDay: value }))}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Landings (Night)</Text>
          <TextInput
            style={styles.input}
            value={form.landingsNight}
            onChangeText={(value) => setForm((prev) => ({ ...prev, landingsNight: value }))}
            keyboardType="numeric"
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Approaches</Text>
          <TextInput
            style={styles.input}
            value={form.approaches}
            onChangeText={(value) => setForm((prev) => ({ ...prev, approaches: value }))}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Holds</Text>
          <TextInput
            style={styles.input}
            value={form.holds}
            onChangeText={(value) => setForm((prev) => ({ ...prev, holds: value }))}
            keyboardType="numeric"
          />
        </View>
      </View>
      <Text style={styles.label}>Remarks</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={form.remarks}
        onChangeText={(value) => setForm((prev) => ({ ...prev, remarks: value }))}
        multiline
      />
      <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={loading}>
        <Text style={styles.primaryButtonText}>Save Entry</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  label: { fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 4 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  primaryButton: { backgroundColor: colors.primary, padding: spacing.sm, borderRadius: radius.md, alignItems: 'center', ...shadow.card },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
});
