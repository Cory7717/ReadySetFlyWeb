import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RentalsStackParamList } from '../navigation/RentalsStack';
import { apiEndpoints } from '../services/api';
import type { AircraftListing } from '@shared/schema';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type Props = NativeStackScreenProps<RentalsStackParamList, 'RentalsList'>;

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function FilterChip({
  label,
  value,
  onClear,
}: {
  label: string;
  value: string;
  onClear: () => void;
}) {
  return (
    <TouchableOpacity style={styles.filterChip} onPress={onClear} activeOpacity={0.92}>
      <Text style={styles.filterChipText}>
        {label}: {value}
      </Text>
      <Ionicons name="close" size={14} color={colors.primary} />
    </TouchableOpacity>
  );
}

function aircraftLocation(item: AircraftListing) {
  const parts = [item.airportCode, item.city, item.state].filter(Boolean);
  if (parts.length > 0) return parts.join(' • ');
  return item.location || 'Location pending';
}

function hourlyRateLabel(item: AircraftListing) {
  const numericRate = Number(item.hourlyRate || 0);
  return `$${numericRate.toFixed(0)}/hr`;
}

export default function RentalsScreen({ navigation }: Props) {
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [radiusValue, setRadiusValue] = useState('100');
  const [showFilterModal, setShowFilterModal] = useState(false);

  const { data: aircraft, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/aircraft'],
    queryFn: async () => {
      const response = await apiEndpoints.aircraft.getAll();
      return response.data as AircraftListing[];
    },
  });

  const filteredAircraft = useMemo(() => {
    const allAircraft = aircraft || [];

    return allAircraft.filter((item) => {
      if (keyword.trim()) {
        const searchText = [
          item.make,
          item.model,
          item.registration,
          item.category,
          item.airportCode,
          item.city,
          item.state,
          item.location,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!searchText.includes(keyword.trim().toLowerCase())) {
          return false;
        }
      }

      if (city.trim()) {
        const cityText = `${item.city || ''} ${item.location || ''}`.toLowerCase();
        if (!cityText.includes(city.trim().toLowerCase())) {
          return false;
        }
      }

      if (state.trim()) {
        const stateText = `${item.state || ''} ${item.location || ''}`.toLowerCase();
        if (!stateText.includes(state.trim().toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [aircraft, city, keyword, state]);

  const featuredCount = useMemo(
    () => (filteredAircraft || []).filter((item) => item.isFeatured).length,
    [filteredAircraft]
  );

  const avgRate = useMemo(() => {
    if (!filteredAircraft?.length) return 0;
    const total = filteredAircraft.reduce((sum, item) => sum + Number(item.hourlyRate || 0), 0);
    return total / filteredAircraft.length;
  }, [filteredAircraft]);

  const filtersActive = Boolean(keyword || city || state || radiusValue !== '100');

  const renderAircraft = ({ item }: { item: AircraftListing }) => (
    <TouchableOpacity
      style={styles.aircraftCard}
      onPress={() => navigation.navigate('AircraftDetail', { aircraftId: item.id })}
      activeOpacity={0.92}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.cardTitleBlock}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.aircraftTitle}>
              {item.make} {item.model}
            </Text>
            {item.isFeatured ? (
              <View style={styles.featuredChip}>
                <Text style={styles.featuredChipText}>Featured</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.registrationText}>{item.registration}</Text>
        </View>
        <View style={styles.pricePill}>
          <Text style={styles.pricePillValue}>{hourlyRateLabel(item)}</Text>
          <Text style={styles.pricePillMeta}>{item.wetRate ? 'Wet rate' : 'Dry rate'}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaPill}>
          <Ionicons name="navigate-outline" size={14} color={colors.primary} />
          <Text style={styles.metaPillText}>{aircraftLocation(item)}</Text>
        </View>
        <View style={styles.metaPill}>
          <Ionicons name="speedometer-outline" size={14} color={colors.primary} />
          <Text style={styles.metaPillText}>{item.category}</Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <View style={styles.detailMetric}>
          <Text style={styles.detailMetricLabel}>Minimum time</Text>
          <Text style={styles.detailMetricValue}>{item.minFlightHours || 0} hrs</Text>
        </View>
        <View style={styles.detailMetric}>
          <Text style={styles.detailMetricLabel}>Engine</Text>
          <Text style={styles.detailMetricValue}>{item.engineType || item.engine || 'Standard'}</Text>
        </View>
        <View style={styles.detailMetric}>
          <Text style={styles.detailMetricLabel}>Seats</Text>
          <Text style={styles.detailMetricValue}>{item.seatingCapacity || 'N/A'}</Text>
        </View>
      </View>

      {item.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      <View style={styles.cardFooter}>
        <View style={styles.footerStatusRow}>
          {item.insuranceIncluded ? (
            <View style={styles.statusChip}>
              <Text style={styles.statusChipText}>Insurance included</Text>
            </View>
          ) : null}
          <View style={styles.statusChipMuted}>
            <Text style={styles.statusChipMutedText}>{item.responseTime || 24}h response</Text>
          </View>
        </View>
        <View style={styles.viewDetailsButton}>
          <Text style={styles.viewDetailsText}>Open Aircraft</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading rental aircraft...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={styles.errorTitle}>Unable to load rentals.</Text>
        <Text style={styles.errorText}>Refresh and try again. The aircraft feed may be temporarily unavailable.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()} activeOpacity={0.92}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredAircraft || []}
        renderItem={renderAircraft}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={
          <>
            <View style={styles.heroPanel}>
              <View style={styles.heroTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroEyebrow}>RENTALS</Text>
                  <Text style={styles.heroTitle}>Browse aircraft with a cleaner mission-ready rental workflow.</Text>
                  <Text style={styles.heroSubtitle}>
                    Search by aircraft, region, and training fit, then move from browse to booking without losing context.
                  </Text>
                </View>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>Browse</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <SummaryTile label="Available now" value={String(filteredAircraft.length)} />
                <SummaryTile label="Featured" value={String(featuredCount)} />
                <SummaryTile label="Avg rate" value={avgRate ? `$${avgRate.toFixed(0)}/hr` : 'N/A'} />
              </View>
            </View>

            <View style={styles.searchPanel}>
              <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={18} color={colors.textSoft} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search C172, Archer, N12345, Houston..."
                  placeholderTextColor={colors.textSoft}
                  value={keyword}
                  onChangeText={setKeyword}
                  testID="input-search-aircraft"
                />
              </View>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowFilterModal(true)}
                activeOpacity={0.92}
                testID="button-show-filters"
              >
                <Ionicons name="options-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {filtersActive ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChipRow}
              >
                {keyword ? <FilterChip label="Search" value={keyword} onClear={() => setKeyword('')} /> : null}
                {city ? <FilterChip label="City" value={city} onClear={() => setCity('')} /> : null}
                {state ? <FilterChip label="State" value={state} onClear={() => setState('')} /> : null}
                {radiusValue !== '100' ? (
                  <FilterChip label="Radius" value={`${radiusValue} mi`} onClear={() => setRadiusValue('100')} />
                ) : null}
              </ScrollView>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Aircraft</Text>
              <Text style={styles.sectionSubtitle}>
                Tap an aircraft to review requirements, pricing, owner credibility, and booking flow.
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="airplane-outline" size={44} color={colors.textSoft} />
            <Text style={styles.emptyTitle}>No aircraft match this search.</Text>
            <Text style={styles.emptyText}>Adjust the search or clear filters to widen the rental pool.</Text>
          </View>
        }
      />

      <Modal
        visible={showFilterModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalEyebrow}>FILTERS</Text>
              <Text style={styles.modalTitle}>Refine the rental search</Text>
            </View>
            <TouchableOpacity onPress={() => setShowFilterModal(false)} activeOpacity={0.92}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentInner}>
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Location</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>City</Text>
                <TextInput
                  style={styles.filterInput}
                  placeholder="Austin"
                  placeholderTextColor={colors.textSoft}
                  value={city}
                  onChangeText={setCity}
                  testID="input-filter-city"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>State</Text>
                <TextInput
                  style={styles.filterInput}
                  placeholder="TX"
                  placeholderTextColor={colors.textSoft}
                  value={state}
                  onChangeText={setState}
                  maxLength={2}
                  autoCapitalize="characters"
                  testID="input-filter-state"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Planning radius</Text>
                <View style={styles.radiusOptions}>
                  {['25', '50', '100', '200', '500'].map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.radiusOption, radiusValue === option && styles.radiusOptionActive]}
                      onPress={() => setRadiusValue(option)}
                      activeOpacity={0.92}
                      testID={`button-radius-${option}`}
                    >
                      <Text
                        style={[
                          styles.radiusOptionText,
                          radiusValue === option && styles.radiusOptionTextActive,
                        ]}
                      >
                        {option} mi
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setKeyword('');
                setCity('');
                setState('');
                setRadiusValue('100');
              }}
              activeOpacity={0.92}
              testID="button-clear-filters"
            >
              <Text style={styles.clearButtonText}>Clear all filters</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setShowFilterModal(false)}
              activeOpacity={0.92}
              testID="button-apply-filters"
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContainer: {
    padding: spacing.sm,
    paddingBottom: 120,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.xs,
    maxWidth: 320,
  },
  retryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: radius.lg,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
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
    maxWidth: 310,
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
  searchPanel: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...shadow.card,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  filterButton: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  filterChipRow: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#bfd7ff',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  sectionHeader: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionTitle: {
    ...typography.h2,
  },
  sectionSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
  aircraftCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cardTitleBlock: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  aircraftTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  featuredChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
  },
  featuredChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
  },
  registrationText: {
    ...typography.muted,
    marginTop: 4,
  },
  pricePill: {
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceTinted,
    borderWidth: 1,
    borderColor: '#cfe0ff',
  },
  pricePillValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  pricePillMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  detailRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  detailMetric: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailMetricLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textSoft,
  },
  detailMetricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
  },
  description: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  cardFooter: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerStatusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
  },
  statusChipMuted: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  statusChipMutedText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
  },
  viewDetailsButton: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.primarySoft,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    ...shadow.card,
  },
  emptyTitle: {
    ...typography.h3,
    marginTop: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.backgroundElevated,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  modalTitle: {
    ...typography.h2,
    marginTop: 6,
  },
  modalContent: {
    flex: 1,
  },
  modalContentInner: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  modalSectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  filterInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  radiusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  radiusOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  radiusOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  radiusOptionText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
  },
  radiusOptionTextActive: {
    color: '#fff',
  },
  clearButton: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    paddingVertical: 14,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textMuted,
  },
  modalFooter: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  applyButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
