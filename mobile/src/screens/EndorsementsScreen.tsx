import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import FormDateTimeField from '../components/FormDateTimeField';
import { useIsAuthenticated } from '../utils/auth';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';
import { extractApiErrorMessage, logDiagnostic } from '../utils/diagnostics';

type Endorsement = {
  id: string;
  title: string;
  endorsementType?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  instructorName?: string | null;
  instructorCertificate?: string | null;
  aircraftType?: string | null;
  notes?: string | null;
  documentUrl?: string | null;
};

const emptyForm = {
  id: '',
  title: '',
  endorsementType: '',
  issuedAt: '',
  expiresAt: '',
  instructorName: '',
  instructorCertificate: '',
  aircraftType: '',
  notes: '',
  documentUrl: '',
};

function toDateOnlyValue(value?: string | null) {
  return value ? String(value).slice(0, 10) : '';
}

export default function EndorsementsScreen() {
  const { isAuthenticated } = useIsAuthenticated();
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const loadEndorsements = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await api.get('/api/endorsements');
      setEndorsements(res.data || []);
      logDiagnostic('endorsements', 'loaded', { count: Array.isArray(res.data) ? res.data.length : 0 });
    } catch (error: any) {
      Alert.alert('Endorsements', extractApiErrorMessage(error, 'Unable to load endorsements.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEndorsements();
  }, [isAuthenticated]);

  const handleSave = async () => {
    if (!form.title || !form.issuedAt) {
      Alert.alert('Missing info', 'Title and issued date are required.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: form.title,
        endorsementType: form.endorsementType || null,
        issuedAt: form.issuedAt,
        expiresAt: form.expiresAt || null,
        instructorName: form.instructorName || null,
        instructorCertificate: form.instructorCertificate || null,
        aircraftType: form.aircraftType || null,
        notes: form.notes || null,
        documentUrl: form.documentUrl || null,
      };

      if (form.id) {
        await api.patch(`/api/endorsements/${form.id}`, payload);
      } else {
        await api.post('/api/endorsements', payload);
      }

      setForm({ ...emptyForm });
      await loadEndorsements();
      Alert.alert('Saved', 'Endorsement saved.');
    } catch (error: any) {
      Alert.alert('Save failed', extractApiErrorMessage(error, 'Unable to save endorsement.'));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: Endorsement) => {
    setForm({
      id: item.id,
      title: item.title || '',
      endorsementType: item.endorsementType || '',
      issuedAt: toDateOnlyValue(item.issuedAt),
      expiresAt: toDateOnlyValue(item.expiresAt),
      instructorName: item.instructorName || '',
      instructorCertificate: item.instructorCertificate || '',
      aircraftType: item.aircraftType || '',
      notes: item.notes || '',
      documentUrl: item.documentUrl || '',
    });
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete endorsement?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await api.delete(`/api/endorsements/${id}`);
            await loadEndorsements();
          } catch (error: any) {
            Alert.alert('Delete failed', extractApiErrorMessage(error, 'Unable to delete endorsement.'));
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={32} color={colors.textMuted} />
        <Text style={styles.centerText}>Sign in to manage endorsements.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.title}>{form.id ? 'Edit Endorsement' : 'Add Endorsement'}</Text>
        <Text style={styles.subtitle}>Track CFI sign-offs and expiration dates.</Text>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={form.title}
          onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))}
          placeholder="Complex, tailwheel, IPC"
        />

        <Text style={styles.label}>Endorsement Type</Text>
        <TextInput
          style={styles.input}
          value={form.endorsementType}
          onChangeText={(value) => setForm((prev) => ({ ...prev, endorsementType: value }))}
          placeholder="61.31(e), 61.57, etc."
        />

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <FormDateTimeField
              label="Issued"
              value={form.issuedAt}
              onChangeText={(value) => setForm((prev) => ({ ...prev, issuedAt: value }))}
              placeholder="Select issue date"
              mode="date"
              style={styles.fieldWrapper}
            />
          </View>
          <View style={styles.rowItem}>
            <FormDateTimeField
              label="Expires"
              value={form.expiresAt}
              onChangeText={(value) => setForm((prev) => ({ ...prev, expiresAt: value }))}
              placeholder="Select expiration date"
              mode="date"
              optional
              style={styles.fieldWrapper}
            />
          </View>
        </View>

        <Text style={styles.label}>Instructor Name</Text>
        <TextInput
          style={styles.input}
          value={form.instructorName}
          onChangeText={(value) => setForm((prev) => ({ ...prev, instructorName: value }))}
          placeholder="Jane Smith, CFI"
        />

        <Text style={styles.label}>Instructor Certificate #</Text>
        <TextInput
          style={styles.input}
          value={form.instructorCertificate}
          onChangeText={(value) => setForm((prev) => ({ ...prev, instructorCertificate: value }))}
          placeholder="CFI-1234567"
        />

        <Text style={styles.label}>Aircraft Type/Class</Text>
        <TextInput
          style={styles.input}
          value={form.aircraftType}
          onChangeText={(value) => setForm((prev) => ({ ...prev, aircraftType: value }))}
          placeholder="C172, PA-28, ASEL"
        />

        <Text style={styles.label}>Document URL</Text>
        <TextInput
          style={styles.input}
          value={form.documentUrl}
          onChangeText={(value) => setForm((prev) => ({ ...prev, documentUrl: value }))}
          placeholder="https://..."
        />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={form.notes}
          onChangeText={(value) => setForm((prev) => ({ ...prev, notes: value }))}
          multiline
        />

        <View style={styles.rowButtons}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setForm({ ...emptyForm })}>
            <Text style={styles.secondaryButtonText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={loading}>
            <Text style={styles.primaryButtonText}>{loading ? 'Saving...' : 'Save Endorsement'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your endorsements</Text>
        {endorsements.length === 0 && !loading && (
          <Text style={styles.helperText}>No endorsements yet.</Text>
        )}
        {endorsements.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.endorsementType || 'General endorsement'}</Text>
              </View>
              <Text style={styles.cardMeta}>{item.issuedAt || 'â€”'}</Text>
            </View>
            {item.expiresAt ? (
              <Text style={styles.cardMeta}>Expires: {item.expiresAt}</Text>
            ) : null}
            {item.instructorName ? (
              <Text style={styles.cardMeta}>Instructor: {item.instructorName}</Text>
            ) : null}
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => handleEdit(item)}>
                <Text style={styles.secondaryButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerButton} onPress={() => handleDelete(item.id)}>
                <Text style={styles.dangerButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.lg },
  title: { ...typography.h2 },
  subtitle: { marginTop: spacing.xs, color: colors.textMuted },
  section: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm },
  label: { fontSize: 12, fontWeight: '600', color: colors.text, marginTop: spacing.sm, marginBottom: 4 },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: spacing.sm },
  rowItem: { flex: 1 },
  fieldWrapper: { marginTop: spacing.sm },
  rowButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  primaryButton: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontWeight: '600' },
  dangerButton: { flex: 1, backgroundColor: '#fee2e2', borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  dangerButtonText: { color: '#b91c1c', fontWeight: '600' },
  card: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  cardSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  helperText: { fontSize: 12, color: colors.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { marginTop: spacing.sm, color: colors.textMuted },
});
