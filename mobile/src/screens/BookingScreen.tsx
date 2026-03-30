import { useMemo, useState } from 'react';
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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RentalsStackParamList } from '../navigation/RentalsStack';
import { apiEndpoints } from '../services/api';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type Props = NativeStackScreenProps<RentalsStackParamList, 'Booking'>;

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad';
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
      />
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

export default function BookingScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { aircraftId } = route.params;
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hours, setHours] = useState('');

  const { data: aircraft, isLoading, error } = useQuery({
    queryKey: ['/api/aircraft', aircraftId],
    queryFn: async () => {
      const response = await apiEndpoints.aircraft.getById(aircraftId);
      return response.data;
    },
  });

  const aircraftName = useMemo(() => {
    if (!aircraft) return 'Aircraft booking';
    return `${aircraft.make || ''} ${aircraft.model || ''}`.trim() || aircraft.registration || 'Aircraft booking';
  }, [aircraft]);

  const registration = useMemo(() => {
    if (!aircraft) return 'Registration pending';
    return aircraft.registration || 'Registration pending';
  }, [aircraft]);

  const locationLabel = useMemo(() => {
    if (!aircraft) return 'Location pending';
    const parts = [aircraft.airportCode, aircraft.city, aircraft.state].filter(Boolean);
    if (parts.length) return parts.join(' • ');
    return aircraft.location || 'Location pending';
  }, [aircraft]);

  const hoursNumber = useMemo(() => {
    const parsed = parseFloat(hours);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [hours]);

  const hourlyRate = useMemo(() => Number(aircraft?.hourlyRate || 0), [aircraft]);
  const baseCost = useMemo(() => hourlyRate * hoursNumber, [hourlyRate, hoursNumber]);
  const platformFee = useMemo(() => baseCost * 0.18, [baseCost]);
  const salesTax = useMemo(() => baseCost * 0.0825, [baseCost]);
  const total = useMemo(() => baseCost + platformFee + salesTax, [baseCost, platformFee, salesTax]);

  const handleBooking = () => {
    if (!startDate || !endDate || !hours || hoursNumber <= 0) {
      Alert.alert('Missing Information', 'Enter start date, end date, and estimated hours before continuing.');
      return;
    }

    Alert.alert(
      'Confirm Booking',
      `Aircraft: ${aircraftName}\nDuration: ${hours} hours\nTotal Cost: $${total.toFixed(
        2
      )}\n\nProceed to payment?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            navigation.navigate('RentalPayment', {
              paymentData: {
                rentalId: `pending-${Date.now()}`,
                aircraftId,
                amount: total,
                startDate,
                endDate,
                hours: hoursNumber,
              },
            });
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading booking details...</Text>
      </View>
    );
  }

  if (error || !aircraft) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={styles.errorTitle}>Unable to prepare booking.</Text>
        <Text style={styles.errorText}>Refresh and try again. This aircraft may be temporarily unavailable.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top, spacing.sm), paddingBottom: 120 + insets.bottom },
      ]}
    >
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>BOOKING</Text>
            <Text style={styles.heroTitle}>{aircraftName}</Text>
            <Text style={styles.heroSubtitle}>
              {registration} • {locationLabel}
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Draft booking</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <MetricTile label="Hourly rate" value={`$${hourlyRate.toFixed(0)}/hr`} />
          <MetricTile label="Estimated hours" value={hoursNumber > 0 ? `${hoursNumber.toFixed(1)} hrs` : 'Not set'} />
          <MetricTile label="Estimated total" value={hoursNumber > 0 ? `$${total.toFixed(0)}` : 'Pending'} />
        </View>
      </View>

      <SectionCard
        title="Booking Window"
        subtitle="Set the reservation window and rough flight time before moving to payment."
      >
        <InputField
          label="Start Date"
          value={startDate}
          onChangeText={setStartDate}
          placeholder="MM/DD/YYYY"
        />
        <InputField
          label="End Date"
          value={endDate}
          onChangeText={setEndDate}
          placeholder="MM/DD/YYYY"
        />
        <InputField
          label="Estimated Hours"
          value={hours}
          onChangeText={setHours}
          placeholder="0.0"
          keyboardType="decimal-pad"
        />
      </SectionCard>

      <SectionCard
        title="Rental Snapshot"
        subtitle="Quick review of the rental before you commit to payment."
      >
        <View style={styles.snapshotGrid}>
          <View style={styles.snapshotCard}>
            <Text style={styles.snapshotLabel}>Aircraft</Text>
            <Text style={styles.snapshotValue}>{aircraftName}</Text>
          </View>
          <View style={styles.snapshotCard}>
            <Text style={styles.snapshotLabel}>Location</Text>
            <Text style={styles.snapshotValue}>{locationLabel}</Text>
          </View>
          <View style={styles.snapshotCard}>
            <Text style={styles.snapshotLabel}>Minimum time</Text>
            <Text style={styles.snapshotValue}>{aircraft.minFlightHours || 0} hrs</Text>
          </View>
          <View style={styles.snapshotCard}>
            <Text style={styles.snapshotLabel}>Rate basis</Text>
            <Text style={styles.snapshotValue}>{aircraft.wetRate ? 'Wet rate' : 'Dry rate'}</Text>
          </View>
        </View>
      </SectionCard>

      <SectionCard
        title="Cost Breakdown"
        subtitle="First-pass pricing estimate before the payment handoff."
      >
        <View style={styles.costRow}>
          <Text style={styles.costLabel}>
            Base cost ({hoursNumber > 0 ? hoursNumber.toFixed(1) : '0.0'} hrs × ${hourlyRate.toFixed(2)})
          </Text>
          <Text style={styles.costValue}>${baseCost.toFixed(2)}</Text>
        </View>
        <View style={styles.costRow}>
          <Text style={styles.costLabel}>Platform fee (18%)</Text>
          <Text style={styles.costValue}>${platformFee.toFixed(2)}</Text>
        </View>
        <View style={styles.costRow}>
          <Text style={styles.costLabel}>Sales tax (8.25%)</Text>
          <Text style={styles.costValue}>${salesTax.toFixed(2)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.costRow}>
          <Text style={styles.totalLabel}>Estimated total</Text>
          <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
        </View>
      </SectionCard>

      <View style={styles.footerActionWrap}>
        <TouchableOpacity style={styles.footerAction} onPress={handleBooking} activeOpacity={0.92}>
          <Text style={styles.footerActionText}>Continue to Payment</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  errorTitle: {
    ...typography.h2,
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 320,
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
    maxWidth: 290,
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
    maxWidth: 320,
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
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  metricTile: {
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
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  snapshotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  snapshotCard: {
    width: '48%',
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  snapshotLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textSoft,
  },
  snapshotValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  costLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.textMuted,
  },
  costValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  footerActionWrap: {
    paddingTop: spacing.sm,
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    ...shadow.floating,
  },
  footerActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
