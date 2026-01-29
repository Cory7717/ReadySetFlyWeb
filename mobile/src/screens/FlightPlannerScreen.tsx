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
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type AirportMeta = {
  icao: string;
  name?: string;
  latitude: number;
  longitude: number;
};

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
  type?: AircraftType | null;
  cruiseKtasEffective?: number;
  fuelBurnGphEffective?: number;
  usableFuelGalEffective?: number;
  maxGrossWeightLbEffective?: number;
};

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function greatCircleNm(a: AirportMeta, b: AirportMeta) {
  const R = 3440.065;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export default function FlightPlannerScreen() {
  const { isAuthenticated } = useIsAuthenticated();
  const [departure, setDeparture] = useState('KJFK');
  const [destination, setDestination] = useState('KBOS');
  const [waypoints, setWaypoints] = useState('');
  const [alternate, setAlternate] = useState('');
  const [loading, setLoading] = useState(false);
  const [routeSummary, setRouteSummary] = useState<{ totalNm: number; legs: { from: string; to: string; nm: number }[] } | null>(null);

  const [aircraftQuery, setAircraftQuery] = useState('');
  const [aircraftResults, setAircraftResults] = useState<AircraftType[]>([]);
  const [selectedType, setSelectedType] = useState<AircraftType | null>(null);
  const [profiles, setProfiles] = useState<AircraftProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const [cruiseKtas, setCruiseKtas] = useState('110');
  const [fuelBurnGph, setFuelBurnGph] = useState('8.5');
  const [usableFuel, setUsableFuel] = useState('40');
  const [maxGrossWeight, setMaxGrossWeight] = useState('2400');
  const [reserveMinutes, setReserveMinutes] = useState('45');

  useEffect(() => {
    if (!isAuthenticated) return;
    api.get('/api/aircraft/profiles')
      .then((res) => setProfiles(res.data || []))
      .catch(() => setProfiles([]));
  }, [isAuthenticated]);

  const effectiveProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) || null,
    [profiles, selectedProfileId]
  );

  useEffect(() => {
    if (effectiveProfile) {
      setCruiseKtas(String(effectiveProfile.cruiseKtasEffective || ''));
      setFuelBurnGph(String(effectiveProfile.fuelBurnGphEffective || ''));
      setUsableFuel(String(effectiveProfile.usableFuelGalEffective || ''));
      setMaxGrossWeight(String(effectiveProfile.maxGrossWeightLbEffective || ''));
    }
  }, [effectiveProfile]);

  useEffect(() => {
    if (selectedType) {
      setCruiseKtas(String(selectedType.cruiseKtas));
      setFuelBurnGph(String(selectedType.fuelBurnGph));
      setUsableFuel(String(selectedType.usableFuelGal));
      setMaxGrossWeight(String(selectedType.maxGrossWeightLb));
    }
  }, [selectedType]);

  const searchAircraft = async () => {
    if (!aircraftQuery.trim()) {
      setAircraftResults([]);
      return;
    }
    try {
      const res = await api.get('/api/aircraft/types', { params: { q: aircraftQuery.trim() } });
      setAircraftResults(res.data || []);
    } catch {
      setAircraftResults([]);
    }
  };

  const buildRoute = async () => {
    const dep = departure.trim().toUpperCase();
    const dest = destination.trim().toUpperCase();
    if (!dep || !dest) {
      Alert.alert('Missing airports', 'Departure and destination are required.');
      return;
    }
    const wpList = waypoints
      .split(/[\s,]+/)
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);
    const codes = [dep, ...wpList, dest];
    setLoading(true);
    try {
      const airports: AirportMeta[] = [];
      for (const code of codes) {
        const res = await api.get(`/api/airports/${code}`);
        airports.push(res.data);
      }
      const legs = airports.slice(0, -1).map((airport, idx) => {
        const next = airports[idx + 1];
        return {
          from: airport.icao,
          to: next.icao,
          nm: greatCircleNm(airport, next),
        };
      });
      const totalNm = legs.reduce((sum, leg) => sum + leg.nm, 0);
      setRouteSummary({ totalNm, legs });
    } catch (error: any) {
      Alert.alert('Route error', error?.response?.data?.error || 'Unable to build route.');
      setRouteSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const cruise = parseFloat(cruiseKtas) || 0;
  const burn = parseFloat(fuelBurnGph) || 0;
  const reserve = parseFloat(reserveMinutes) || 0;
  const totalNm = routeSummary?.totalNm || 0;
  const eteHours = cruise > 0 ? totalNm / cruise : 0;
  const fuelRequired = eteHours * burn;
  const totalFuel = fuelRequired + (burn * (reserve / 60));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Route Builder</Text>
        <TextInput style={styles.input} value={departure} onChangeText={setDeparture} placeholder="Departure (ICAO)" />
        <TextInput style={styles.input} value={destination} onChangeText={setDestination} placeholder="Destination (ICAO)" />
        <TextInput
          style={styles.input}
          value={waypoints}
          onChangeText={setWaypoints}
          placeholder="Waypoints (optional, space or comma separated)"
        />
        <TextInput style={styles.input} value={alternate} onChangeText={setAlternate} placeholder="Alternate (optional)" />
        <TouchableOpacity style={styles.primaryButton} onPress={buildRoute} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Build Route</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aircraft Performance</Text>
        <TextInput
          style={styles.input}
          value={aircraftQuery}
          onChangeText={setAircraftQuery}
          onSubmitEditing={searchAircraft}
          placeholder="Search aircraft (C172, SR22, DA40)"
        />
        <TouchableOpacity style={styles.secondaryButton} onPress={searchAircraft}>
          <Text style={styles.secondaryButtonText}>Search Library</Text>
        </TouchableOpacity>

        {!!aircraftResults.length && (
          <View style={styles.list}>
            {aircraftResults.slice(0, 6).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.listItem}
                onPress={() => {
                  setSelectedType(item);
                  setSelectedProfileId(null);
                }}
              >
                <Text style={styles.listItemText}>{item.make} {item.model} ({item.icaoType || 'N/A'})</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {isAuthenticated && (
          <>
            <Text style={styles.subTitle}>Saved Profiles</Text>
            <View style={styles.list}>
              {profiles.length === 0 && <Text style={styles.helperText}>No saved profiles yet.</Text>}
              {profiles.map((profile) => (
                <TouchableOpacity
                  key={profile.id}
                  style={styles.listItem}
                  onPress={() => {
                    setSelectedProfileId(profile.id);
                    setSelectedType(null);
                  }}
                >
                  <Text style={styles.listItemText}>{profile.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Cruise KTAS</Text>
            <TextInput style={styles.input} value={cruiseKtas} onChangeText={setCruiseKtas} keyboardType="numeric" />
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Fuel Burn (GPH)</Text>
            <TextInput style={styles.input} value={fuelBurnGph} onChangeText={setFuelBurnGph} keyboardType="numeric" />
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Usable Fuel (gal)</Text>
            <TextInput style={styles.input} value={usableFuel} onChangeText={setUsableFuel} keyboardType="numeric" />
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Max Gross (lb)</Text>
            <TextInput style={styles.input} value={maxGrossWeight} onChangeText={setMaxGrossWeight} keyboardType="numeric" />
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Reserve (min)</Text>
            <TextInput style={styles.input} value={reserveMinutes} onChangeText={setReserveMinutes} keyboardType="numeric" />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Distance</Text>
          <Text style={styles.summaryValue}>{totalNm ? `${totalNm.toFixed(1)} NM` : '-'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Estimated Time</Text>
          <Text style={styles.summaryValue}>{eteHours ? `${eteHours.toFixed(2)} hrs` : '-'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Trip Fuel</Text>
          <Text style={styles.summaryValue}>{fuelRequired ? `${fuelRequired.toFixed(1)} gal` : '-'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Fuel + Reserve</Text>
          <Text style={styles.summaryValue}>{totalFuel ? `${totalFuel.toFixed(1)} gal` : '-'}</Text>
        </View>
      </View>

      {routeSummary?.legs?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route Legs</Text>
          {routeSummary.legs.map((leg) => (
            <View key={`${leg.from}-${leg.to}`} style={styles.legRow}>
              <Text style={styles.legText}>{leg.from} → {leg.to}</Text>
              <Text style={styles.legText}>{leg.nm.toFixed(1)} NM</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.lg },
  section: { padding: spacing.md, backgroundColor: colors.surface, marginBottom: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  secondaryButtonText: { color: colors.primary, fontWeight: '600' },
  list: { marginBottom: spacing.sm },
  listItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listItemText: { fontSize: 14, color: colors.text },
  subTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  helperText: { fontSize: 12, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridItem: { width: '48%' },
  label: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: colors.textMuted },
  summaryValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  legRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  legText: { fontSize: 13, color: colors.textMuted },
});
