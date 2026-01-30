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
import { useNavigation } from '@react-navigation/native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import { createGdl90Listener, TrafficTarget } from '../utils/gdl90';
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

const ICAO_REGEX = /^[A-Z0-9]{3,4}$/;

type WeatherResponse = {
  icao: string;
  metar: any;
  taf: any;
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

function parseFlightCategory(metar: any): 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN' {
  if (!metar?.rawOb) return 'UNKNOWN';
  const raw = metar.rawOb || '';
  const visMatch = raw.match(/\s(\d{1,2})SM/);
  const visibility = visMatch ? parseInt(visMatch[1], 10) : 10;
  const ceilingMatch = raw.match(/(BKN|OVC)(\d{3})/);
  const ceiling = ceilingMatch ? parseInt(ceilingMatch[2], 10) * 100 : 10000;

  if (ceiling >= 3000 && visibility > 5) return 'VFR';
  if (ceiling >= 1000 && visibility >= 3) return 'MVFR';
  if (ceiling >= 500 && visibility >= 1) return 'IFR';
  return 'LIFR';
}

function hasThunder(taf: any) {
  const raw = taf?.rawTAF || '';
  return raw.includes('TS');
}

export default function FlightPlannerScreen() {
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useIsAuthenticated();
  const [departure, setDeparture] = useState('KJFK');
  const [destination, setDestination] = useState('KBOS');
  const [waypoints, setWaypoints] = useState('');
  const [plannedStops, setPlannedStops] = useState('');
  const [alternate, setAlternate] = useState('');
  const [tailNumber, setTailNumber] = useState('');
  const [fuelOnBoard, setFuelOnBoard] = useState('');
  const [notes, setNotes] = useState('');
  const [suggestedMode, setSuggestedMode] = useState<'direct' | 'midpoint'>('direct');
  const [loading, setLoading] = useState(false);
  const [routeSummary, setRouteSummary] = useState<{ totalNm: number; legs: { from: string; to: string; nm: number }[] } | null>(null);
  const [routePoints, setRoutePoints] = useState<AirportMeta[]>([]);
  const [mapStyle, setMapStyle] = useState<'standard' | 'sectional' | 'terrain'>('standard');
  const [trafficEnabled, setTrafficEnabled] = useState(false);
  const [trafficPort, setTrafficPort] = useState('4000');
  const [trafficTargets, setTrafficTargets] = useState<TrafficTarget[]>([]);
  const [trafficStatus, setTrafficStatus] = useState<'idle' | 'listening' | 'error'>('idle');
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const trafficListenerRef = useState<{ stop?: () => void }>(() => ({}))[0];
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'listening' | 'error'>('idle');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsData, setGpsData] = useState<{ lat: number; lon: number; altitudeFt?: number; speedKts?: number; heading?: number } | null>(null);
  const [verticalSpeedFpm, setVerticalSpeedFpm] = useState<number | null>(null);
  const locationSubRef = useState<{ remove?: () => void }>(() => ({}))[0];

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
  const [headwind, setHeadwind] = useState('0');

  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [departureWeather, setDepartureWeather] = useState<WeatherResponse | null>(null);
  const [destinationWeather, setDestinationWeather] = useState<WeatherResponse | null>(null);
  const [departureSuggestions, setDepartureSuggestions] = useState<AirportMeta[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<AirportMeta[]>([]);

  const [checklist, setChecklist] = useState({
    weather: false,
    fuel: false,
    currency: false,
    notams: false,
  });

  useEffect(() => {
    if (trafficEnabled || gpsEnabled) {
      activateKeepAwake();
    } else {
      deactivateKeepAwake();
    }
  }, [trafficEnabled, gpsEnabled]);

  useEffect(() => {
    let lastAlt: { alt: number; time: number } | null = null;
    if (!gpsEnabled) {
      locationSubRef.remove?.();
      setGpsStatus('idle');
      setGpsError(null);
      setGpsData(null);
      setVerticalSpeedFpm(null);
      return;
    }

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatus('error');
        setGpsError('Location permission denied.');
        setGpsEnabled(false);
        return;
      }
      setGpsStatus('listening');
      setGpsError(null);
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 2000,
          distanceInterval: 5,
        },
        (location) => {
          const speedKts = location.coords.speed ? location.coords.speed * 1.94384 : undefined;
          const altitudeFt = location.coords.altitude ? location.coords.altitude * 3.28084 : undefined;
          const heading = location.coords.heading ? undefined;
          setGpsData({
            lat: location.coords.latitude,
            lon: location.coords.longitude,
            altitudeFt,
            speedKts,
            heading,
          });
          if (altitudeFt) {
            const now = Date.now();
            if (lastAlt) {
              const delta = altitudeFt - lastAlt.alt;
              const minutes = (now - lastAlt.time) / 60000;
              if (minutes > 0) {
                setVerticalSpeedFpm(delta / minutes);
              }
            }
            lastAlt = { alt: altitudeFt, time: now };
          }
        }
      );
      locationSubRef.remove = subscription.remove;
    })().catch((err) => {
      setGpsStatus('error');
      setGpsError(String(err));
    });

    return () => {
      locationSubRef.remove?.();
    };
  }, [gpsEnabled]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.get('/api/aircraft/profiles')
      .then((res) => setProfiles(res.data || []))
      .catch(() => setProfiles([]));
  }, [isAuthenticated]);

  useEffect(() => {
    const value = departure.trim();
    const normalized = value.toUpperCase();
    if (!value || ICAO_REGEX.test(normalized)) {
      setDepartureSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/api/airports/search', { params: { q: value } });
        setDepartureSuggestions(res.data || []);
      } catch {
        setDepartureSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [departure]);

  useEffect(() => {
    const value = destination.trim();
    const normalized = value.toUpperCase();
    if (!value || ICAO_REGEX.test(normalized)) {
      setDestinationSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/api/airports/search', { params: { q: value } });
        setDestinationSuggestions(res.data || []);
      } catch {
        setDestinationSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [destination]);

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

  const fetchWeather = async () => {
    const dep = departure.trim().toUpperCase();
    const dest = destination.trim().toUpperCase();
    if (!dep || !dest) {
      Alert.alert('Missing airports', 'Departure and destination are required.');
      return;
    }
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const [depRes, destRes] = await Promise.all([
        api.get(`/api/aviation-weather/${dep}`),
        api.get(`/api/aviation-weather/${dest}`),
      ]);
      setDepartureWeather(depRes.data);
      setDestinationWeather(destRes.data);
    } catch (error: any) {
      setWeatherError(error?.response?.data?.error || 'Unable to load weather.');
    } finally {
      setWeatherLoading(false);
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
    const stopList = plannedStops
      .split(/[\s,]+/)
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);
    const codes = [dep, ...stopList, ...wpList, dest];
    setLoading(true);
    try {
      const airports: AirportMeta[] = [];
      for (const code of codes) {
        const res = await api.get(`/api/airports/${code}`);
        airports.push(res.data);
      }
      let routedAirports = airports;
      if (suggestedMode === 'midpoint' && wpList.length === 0 && stopList.length === 0 && airports.length >= 2) {
        const start = airports[0];
        const end = airports[airports.length - 1];
        const lat1 = toRad(start.latitude);
        const lon1 = toRad(start.longitude);
        const lat2 = toRad(end.latitude);
        const lon2 = toRad(end.longitude);
        const dLon = lon2 - lon1;
        const bx = Math.cos(lat2) * Math.cos(dLon);
        const by = Math.cos(lat2) * Math.sin(dLon);
        const lat3 = Math.atan2(
          Math.sin(lat1) + Math.sin(lat2),
          Math.sqrt((Math.cos(lat1) + bx) ** 2 + by ** 2)
        );
        const lon3 = lon1 + Math.atan2(by, Math.cos(lat1) + bx);
        const mid: AirportMeta = {
          icao: 'MID',
          latitude: (lat3 * 180) / Math.PI,
          longitude: (lon3 * 180) / Math.PI,
          name: 'Midpoint',
        };
        routedAirports = [start, mid, end];
      }
      const legs = routedAirports.slice(0, -1).map((airport, idx) => {
        const next = routedAirports[idx + 1];
        return {
          from: airport.icao,
          to: next.icao,
          nm: greatCircleNm(airport, next),
        };
      });
      const totalNm = legs.reduce((sum, leg) => sum + leg.nm, 0);
      setRouteSummary({ totalNm, legs });
      setRoutePoints(routedAirports);
    } catch (error: any) {
      Alert.alert('Route error', error?.response?.data?.error || 'Unable to build route.');
      setRouteSummary(null);
      setRoutePoints([]);
    } finally {
      setLoading(false);
    }
  };

  const cruise = parseFloat(cruiseKtas) || 0;
  const burn = parseFloat(fuelBurnGph) || 0;
  const reserve = parseFloat(reserveMinutes) || 0;
  const wind = parseFloat(headwind) || 0;
  const totalNm = routeSummary?.totalNm || 0;
  const effectiveSpeed = Math.max(cruise - wind, 1);
  const eteHours = effectiveSpeed > 0 ? totalNm / effectiveSpeed : 0;
  const fuelRequired = eteHours * burn;
  const totalFuel = fuelRequired + (burn * (reserve / 60));
  const depCategory = parseFlightCategory(departureWeather?.metar);
  const destCategory = parseFlightCategory(destinationWeather?.metar);
  const routeRisk = [depCategory, destCategory].some((cat) => cat === 'IFR' || cat === 'LIFR') || hasThunder(departureWeather?.taf) || hasThunder(destinationWeather?.taf);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Flight Planner</Text>
        <Text style={styles.sectionSubtitle}>Build a route, estimate time and fuel, then save to Logbook Pro.</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Logbook Pro</Text>
          <Text style={styles.helperText}>Unlock saved plans, per-leg breakdowns, and export tools.</Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation?.navigate?.('LogbookPro')}
          >
            <Text style={styles.secondaryButtonText}>Upgrade to Logbook Pro</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Route Builder</Text>
        <Text style={styles.sectionSubtitle}>Enter ICAO codes or city/state to find airports.</Text>

        <Text style={styles.fieldLabel}>Departure</Text>
        <Text style={styles.fieldHelper}>Example: KAUS or Austin, TX</Text>
        <TextInput style={styles.input} value={departure} onChangeText={setDeparture} placeholder="Departure (ICAO or city/state)" />
        {departureSuggestions.length > 0 && (
          <View style={styles.suggestionList}>
            {departureSuggestions.slice(0, 6).map((airport) => (
              <TouchableOpacity
                key={`${airport.icao}-${airport.name ? ''}`}
                style={styles.suggestionItem}
                onPress={() => {
                  setDeparture(airport.icao);
                  setDepartureSuggestions([]);
                }}
              >
                <Text style={styles.suggestionItemText}>
                  {airport.icao} {airport.name ? `* ${airport.name}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.fieldLabel}>Destination</Text>
        <Text style={styles.fieldHelper}>Example: KDAL or Dallas, TX</Text>
        <TextInput style={styles.input} value={destination} onChangeText={setDestination} placeholder="Destination (ICAO or city/state)" />
        {destinationSuggestions.length > 0 && (
          <View style={styles.suggestionList}>
            {destinationSuggestions.slice(0, 6).map((airport) => (
              <TouchableOpacity
                key={`${airport.icao}-${airport.name ? ''}`}
                style={styles.suggestionItem}
                onPress={() => {
                  setDestination(airport.icao);
                  setDestinationSuggestions([]);
                }}
              >
                <Text style={styles.suggestionItemText}>
                  {airport.icao} {airport.name ? `* ${airport.name}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.fieldLabel}>Waypoints (optional)</Text>
        <Text style={styles.fieldHelper}>Space or comma separated ICAO codes.</Text>
        <TextInput
          style={styles.input}
          value={waypoints}
          onChangeText={setWaypoints}
          placeholder="Example: KACT KTYR"
        />

        <Text style={styles.fieldLabel}>Planned fuel stops (optional)</Text>
        <Text style={styles.fieldHelper}>Add airports for fuel or rest stops.</Text>
        <TextInput
          style={styles.input}
          value={plannedStops}
          onChangeText={setPlannedStops}
          placeholder="Example: KGLS"
        />

        <Text style={styles.fieldLabel}>Alternate (optional)</Text>
        <TextInput style={styles.input} value={alternate} onChangeText={setAlternate} placeholder="Alternate airport" />

        <Text style={styles.fieldLabel}>Tail Number (optional)</Text>
        <TextInput style={styles.input} value={tailNumber} onChangeText={setTailNumber} placeholder="N12345" />

        <Text style={styles.fieldLabel}>Fuel on board (gal)</Text>
        <TextInput style={styles.input} value={fuelOnBoard} onChangeText={setFuelOnBoard} placeholder="Example: 40" keyboardType="numeric" />

        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes or route details"
          multiline
        />
<View style={styles.suggestionBox}>
          <Text style={styles.suggestionTitle}>Suggested routes</Text>
          <Text style={styles.suggestionText}>Midpoint adds a virtual waypoint for planning only.</Text>
          <View style={styles.suggestionRow}>
            <TouchableOpacity
              style={[styles.suggestionButton, suggestedMode === 'direct' && styles.suggestionButtonActive]}
              onPress={() => setSuggestedMode('direct')}
            >
              <Text style={styles.suggestionButtonText}>Direct</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.suggestionButton, suggestedMode === 'midpoint' && styles.suggestionButtonActive]}
              onPress={() => setSuggestedMode('midpoint')}
              disabled={waypoints.trim().length > 0 || plannedStops.trim().length > 0}
            >
              <Text style={styles.suggestionButtonText}>Add midpoint</Text>
            </TouchableOpacity>
          </View>
          {(waypoints.trim().length > 0 || plannedStops.trim().length > 0) && (
            <Text style={styles.suggestionHint}>Midpoint is disabled when custom waypoints or stops are entered.</Text>
          )}
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={buildRoute} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Build Route</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={fetchWeather} disabled={weatherLoading}>
          {weatherLoading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.secondaryButtonText}>Check Weather</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.mapHeader}>
          <Text style={styles.sectionTitle}>Route Map</Text>
          <View style={styles.mapToggleRow}>
            <TouchableOpacity
              style={[styles.mapToggleButton, mapStyle === 'standard' && styles.mapToggleActive]}
              onPress={() => setMapStyle('standard')}
            >
              <Text style={styles.mapToggleText}>Standard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mapToggleButton, mapStyle === 'sectional' && styles.mapToggleActive]}
              onPress={() => setMapStyle('sectional')}
            >
              <Text style={styles.mapToggleText}>Sectional (FAA)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mapToggleButton, mapStyle === 'terrain' && styles.mapToggleActive]}
              onPress={() => setMapStyle('terrain')}
            >
              <Text style={styles.mapToggleText}>Terrain</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={styles.helpLink} onPress={() => navigation.navigate('ReceiverHelp')}>
          <Ionicons name="help-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.helpLinkText}>How to connect your ADS‑B receiver</Text>
        </TouchableOpacity>
        <View style={styles.trafficRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Live Traffic (ADS-B)</Text>
            <Text style={styles.helperText}>Connect to onboard receiver (GDL-90 compatible).</Text>
          </View>
          <TouchableOpacity
            style={[styles.mapToggleButton, trafficEnabled && styles.mapToggleActive]}
            onPress={() => {
              const enabled = !trafficEnabled;
              setTrafficEnabled(enabled);
              if (!enabled) {
                trafficListenerRef.stop?.();
                setTrafficStatus('idle');
                setTrafficTargets([]);
                return;
              }
              setTrafficError(null);
              setTrafficStatus('listening');
              const port = Math.max(1, Math.min(65535, Number(trafficPort) || 4000));
              const listener = createGdl90Listener(
                port,
                (target) => {
                  setTrafficTargets((prev) => {
                    const next = prev.filter((t) => Date.now() - t.updatedAt < 2 * 60 * 1000);
                    const existingIndex = next.findIndex((t) => t.id === target.id);
                    if (existingIndex >= 0) {
                      next[existingIndex] = target;
                      return [...next];
                    }
                    return [...next, target];
                  });
                },
                (err) => {
                  setTrafficStatus('error');
                  setTrafficError(String(err));
                }
              );
              trafficListenerRef.stop = listener.stop;
              listener.start();
            }}
          >
            <Text style={styles.mapToggleText}>{trafficEnabled ? 'On' : 'Off'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.trafficRow}>
          <TextInput
            style={[styles.input, styles.portInput]}
            value={trafficPort}
            onChangeText={setTrafficPort}
            keyboardType="numeric"
            placeholder="Port"
          />
          <Text style={styles.helperText}>Default ports: 4000 / 49002</Text>
        </View>
        <View style={styles.trafficRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Device GPS (fallback)</Text>
            <Text style={styles.helperText}>Uses phone GPS for altitude and speed if ADS‑B not available.</Text>
          </View>
          <TouchableOpacity
            style={[styles.mapToggleButton, gpsEnabled && styles.mapToggleActive]}
            onPress={() => setGpsEnabled((prev) => !prev)}
          >
            <Text style={styles.mapToggleText}>{gpsEnabled ? 'On' : 'Off'}</Text>
          </TouchableOpacity>
        </View>
        {gpsStatus === 'error' && gpsError && (
          <Text style={styles.errorText}>GPS error: {gpsError}</Text>
        )}
        {trafficStatus === 'error' && trafficError && (
          <Text style={styles.errorText}>Traffic error: {trafficError}</Text>
        )}
        {routePoints.length > 0 ? (
          <MapView
            style={styles.map}
            mapType={mapStyle === 'sectional' ? 'none' : 'standard'}
            initialRegion={{
              latitude: routePoints[0].latitude,
              longitude: routePoints[0].longitude,
              latitudeDelta: 3,
              longitudeDelta: 3,
            }}
          >
            {mapStyle === 'sectional' && (
              <UrlTile
                urlTemplate="https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}"
                maximumZ={12}
                minimumZ={6}
                tileSize={256}
              />
            )}
            {mapStyle === 'terrain' && (
              <UrlTile
                urlTemplate="https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}"
                maximumZ={15}
                minimumZ={6}
                tileSize={256}
              />
            )}
            <Polyline
              coordinates={routePoints.map((point) => ({ latitude: point.latitude, longitude: point.longitude }))}
              strokeColor="#0ea5e9"
              strokeWidth={3}
            />
            {trafficTargets.map((target) => (
              <Marker
                key={target.id}
                coordinate={{ latitude: target.lat, longitude: target.lon }}
                title={target.callsign || 'Traffic'}
                description={target.altitudeFt ? `${target.altitudeFt} ft` : undefined}
                pinColor="#f97316"
              />
            ))}
            {routePoints.map((point) => (
              <Marker
                key={point.icao}
                coordinate={{ latitude: point.latitude, longitude: point.longitude }}
                title={point.icao}
                description={point.name || undefined}
              />
            ))}
          </MapView>
        ) : (
          <Text style={styles.helperText}>Enter airports and build a route to preview the map.</Text>
        )}
        <Text style={styles.helperText}>Sectional tiles provided by FAA/Aeronautical Information Services.</Text>
        {mapStyle === 'terrain' && <Text style={styles.helperText}>Terrain tiles provided by USGS National Map.</Text>}
        <View style={styles.instrumentPanel}>
          <Text style={styles.instrumentTitle}>Live Flight Data</Text>
          <View style={styles.instrumentRow}>
            <View style={styles.instrumentBox}>
              <Text style={styles.instrumentLabel}>Altitude</Text>
              <Text style={styles.instrumentValue}>{gpsData?.altitudeFt ? `${gpsData.altitudeFt.toFixed(0)} ft` : '-'}</Text>
            </View>
            <View style={styles.instrumentBox}>
              <Text style={styles.instrumentLabel}>Groundspeed</Text>
              <Text style={styles.instrumentValue}>{gpsData?.speedKts ? `${gpsData.speedKts.toFixed(0)} kt` : '-'}</Text>
            </View>
          </View>
          <View style={styles.instrumentRow}>
            <View style={styles.instrumentBox}>
              <Text style={styles.instrumentLabel}>Track</Text>
              <Text style={styles.instrumentValue}>{gpsData?.heading ? `${gpsData.heading.toFixed(0)}°` : '-'}</Text>
            </View>
            <View style={styles.instrumentBox}>
              <Text style={styles.instrumentLabel}>Vert Speed</Text>
              <Text style={styles.instrumentValue}>{verticalSpeedFpm ? `${verticalSpeedFpm.toFixed(0)} fpm` : '-'}</Text>
            </View>
          </View>
        </View>
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
          <View style={styles.gridItem}>
            <Text style={styles.label}>Avg Headwind (kt)</Text>
            <TextInput style={styles.input} value={headwind} onChangeText={setHeadwind} keyboardType="numeric" />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Performance Summary</Text>
        <View style={styles.statsRow}>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>ETE</Text>
            <Text style={styles.statsValue}>{eteHours ? `${eteHours.toFixed(2)} hrs` : '-'}</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Trip Fuel</Text>
            <Text style={styles.statsValue}>{fuelRequired ? `${fuelRequired.toFixed(1)} gal` : '-'}</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Fuel + Reserve</Text>
            <Text style={styles.statsValue}>{totalFuel ? `${totalFuel.toFixed(1)} gal` : '-'}</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Effective Speed</Text>
            <Text style={styles.statsValue}>{effectiveSpeed ? `${effectiveSpeed.toFixed(0)} kt` : '-'}</Text>
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
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Route Risk</Text>
          <Text style={[styles.summaryValue, routeRisk && { color: colors.warning }]}>{routeRisk ? 'Check conditions' : 'Normal'}</Text>
        </View>
      </View>

      {(departureWeather || destinationWeather || weatherError) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weather Snapshot</Text>
          {weatherError && <Text style={styles.helperText}>{weatherError}</Text>}
          <View style={styles.weatherCard}>
            <Text style={styles.weatherTitle}>Departure {departure.toUpperCase()}</Text>
            <Text style={styles.weatherValue}>{depCategory}</Text>
            <Text style={styles.weatherText} numberOfLines={2}>{departureWeather?.metar?.rawOb || 'METAR unavailable'}</Text>
          </View>
          <View style={styles.weatherCard}>
            <Text style={styles.weatherTitle}>Destination {destination.toUpperCase()}</Text>
            <Text style={styles.weatherValue}>{destCategory}</Text>
            <Text style={styles.weatherText} numberOfLines={2}>{destinationWeather?.metar?.rawOb || 'METAR unavailable'}</Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Go / No-Go Checklist</Text>
        {[
          { key: 'weather', label: 'Weather reviewed' },
          { key: 'fuel', label: 'Fuel planned' },
          { key: 'currency', label: 'Currency checked' },
          { key: 'notams', label: 'NOTAMs acknowledged' },
        ].map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.checkRow}
            onPress={() => setChecklist((prev) => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
          >
            <View style={[styles.checkBox, checklist[item.key as keyof typeof checklist] && styles.checkBoxActive]}>
              {checklist[item.key as keyof typeof checklist] && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.checkText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {routeSummary?.legs?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route Legs</Text>
          {routeSummary.legs.map((leg) => (
            <View key={`${leg.from}-${leg.to}`} style={styles.legRow}>
              <Text style={styles.legText}>{leg.from} -> {leg.to}</Text>
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
  suggestionBox: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm, backgroundColor: colors.surfaceMuted },
  suggestionTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  suggestionText: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  suggestionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  suggestionButton: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  suggestionButtonActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  suggestionButtonText: { fontSize: 12, color: colors.text },
  suggestionHint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  suggestionList: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: spacing.sm },
  suggestionItem: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestionItemText: { fontSize: 12, color: colors.text },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  weatherCard: { backgroundColor: colors.surfaceMuted, padding: spacing.sm, borderRadius: radius.md, marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border },
  weatherTitle: { fontSize: 12, color: colors.textMuted },
  weatherValue: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  weatherText: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  checkBox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  checkBoxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkText: { fontSize: 13, color: colors.text },
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  mapToggleRow: { flexDirection: 'row', gap: spacing.xs },
  mapToggleButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  mapToggleActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  mapToggleText: { fontSize: 12, color: colors.text },
  map: { width: '100%', height: 240, borderRadius: radius.lg, overflow: 'hidden' },
  helpLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  helpLinkText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  trafficRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  portInput: { flex: 1 },
  errorText: { fontSize: 12, color: colors.danger },
  instrumentPanel: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  instrumentTitle: { fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  instrumentRow: { flexDirection: 'row', gap: spacing.sm },
  instrumentBox: { flex: 1, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  instrumentLabel: { fontSize: 11, color: colors.textMuted },
  instrumentValue: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 4 },
});

