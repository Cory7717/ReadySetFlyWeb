import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';

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

export default function MyAircraftScreen() {
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
      setForm({ name: '', tailNumber: '', typeId: '', cruiseKtas: '', fuelBurn: '', usableFuel: '', maxGross: '' });
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
      <Text style={styles.title}>My Aircraft Profiles</Text>
      <Text style={styles.subtitle}>Save your aircraft performance data for planning.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Create Profile</Text>
        <TextInput
          style={styles.input}
          placeholder="Profile name (e.g., My C172)"
          value={form.name}
          onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Tail number (optional)"
          value={form.tailNumber}
          onChangeText={(value) => setForm((prev) => ({ ...prev, tailNumber: value }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Search aircraft library (C172, SR22)"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={searchTypes}
        />
        <TouchableOpacity style={styles.secondaryButton} onPress={searchTypes}>
          <Text style={styles.secondaryButtonText}>Search Library</Text>
        </TouchableOpacity>
        {results.slice(0, 6).map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.listItem}
            onPress={() => setForm((prev) => ({ ...prev, typeId: item.id }))}
          >
            <Text style={styles.listItemText}>
              {item.make} {item.model} ({item.icaoType || 'N/A'})
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.helperText}>Overrides (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Cruise KTAS"
          value={form.cruiseKtas}
          onChangeText={(value) => setForm((prev) => ({ ...prev, cruiseKtas: value }))}
          keyboardType="numeric"
        />
        <TextInput
          style={styles.input}
          placeholder="Fuel burn (GPH)"
          value={form.fuelBurn}
          onChangeText={(value) => setForm((prev) => ({ ...prev, fuelBurn: value }))}
          keyboardType="numeric"
        />
        <TextInput
          style={styles.input}
          placeholder="Usable fuel (gal)"
          value={form.usableFuel}
          onChangeText={(value) => setForm((prev) => ({ ...prev, usableFuel: value }))}
          keyboardType="numeric"
        />
        <TextInput
          style={styles.input}
          placeholder="Max gross weight (lb)"
          value={form.maxGross}
          onChangeText={(value) => setForm((prev) => ({ ...prev, maxGross: value }))}
          keyboardType="numeric"
        />
        <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
          <Text style={styles.primaryButtonText}>Save Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Saved Profiles</Text>
        {loading ? (
          <ActivityIndicator color="#1e40af" />
        ) : profiles.length === 0 ? (
          <Text style={styles.helperText}>No profiles yet.</Text>
        ) : (
          profiles.map((profile) => (
            <View key={profile.id} style={styles.profileRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{profile.name}</Text>
                <Text style={styles.profileMeta}>
                  {profile.tailNumber || 'No tail number'} · {profile.type?.icaoType || 'Custom'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(profile.id)}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { marginTop: 4, color: '#6b7280', marginBottom: 12 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 10 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10, marginBottom: 10 },
  secondaryButton: { backgroundColor: '#e0e7ff', padding: 10, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  secondaryButtonText: { color: '#1e40af', fontWeight: '600' },
  listItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  listItemText: { fontSize: 12, color: '#111827' },
  helperText: { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  primaryButton: { backgroundColor: '#1e40af', padding: 12, borderRadius: 10, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  profileRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  profileName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  profileMeta: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  deleteText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },
});
