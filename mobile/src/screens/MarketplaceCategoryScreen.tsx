import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MarketplaceStackParamList } from '../navigation/MarketplaceStack';
import { apiEndpoints } from '../services/api';
import type { MarketplaceListing } from '@shared/schema';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type Props = NativeStackScreenProps<MarketplaceStackParamList, 'MarketplaceCategory'>;

export default function MarketplaceCategoryScreen({ route, navigation }: Props) {
  const { category } = route.params;
  const categoryLabelMap: Record<string, string> = {
    'aircraft-sale': 'Aircraft For Sale',
    charter: 'Charter Services',
    cfi: 'CFI Services',
    'flight-school': 'Flight Schools',
    mechanic: 'Mechanics',
    job: 'Aviation Jobs',
  };
  const categoryLabel = categoryLabelMap[category] || category;

  const { data: listings, isLoading, error } = useQuery({
    queryKey: ['/api/marketplace', category],
    queryFn: async () => {
      const response = await apiEndpoints.marketplace.getAll({ category });
      return response.data;
    },
  });

  const renderListing = ({ item }: { item: MarketplaceListing }) => (
    <TouchableOpacity 
      style={styles.listingCard}
      onPress={() => navigation.navigate('MarketplaceDetail', { listingId: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{item.title}</Text>
        {item.price && (
          <Text style={styles.price}>${item.price}</Text>
        )}
      </View>
      
      {item.location && (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={16} color="#6b7280" />
          <Text style={styles.location}>{item.location}</Text>
        </View>
      )}
      
      {item.description && (
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      )}
      
      <View style={styles.cardFooter}>
        <Text style={styles.category}>{item.category}</Text>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1e40af" />
        <Text style={styles.loadingText}>Loading listings...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load listings</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{categoryLabel}</Text>
        <Text style={styles.headerSubtitle}>Listings</Text>
      </View>
      <FlatList
        data={listings || []}
        renderItem={renderListing}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-outline" size={64} color="#9ca3af" />
            <Text style={styles.emptyText}>No listings in this category</Text>
            <Text style={styles.emptySubtext}>Check back later for new postings</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.md,
    paddingBottom: 0,
  },
  headerTitle: {
    ...typography.h2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContainer: {
    padding: spacing.md,
  },
  listingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    ...typography.h3,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  location: {
    fontSize: 13,
    color: colors.textMuted,
    marginLeft: 4,
  },
  description: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  category: {
    fontSize: 12,
    color: colors.textMuted,
  },
  loadingText: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  errorText: {
    fontSize: 15,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
