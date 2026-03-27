import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

const STEPS = [
  { title: 'Discovery Flight', range: '1 day', cost: '$150-$250', action: 'Book a discovery flight' },
  { title: 'Student Pilot Certificate', range: '1-2 weeks', cost: 'Free (CFI sign-off)', action: 'Schedule with instructor' },
  { title: 'Medical', range: '1-4 weeks', cost: '$120-$250', action: 'Find AME near you' },
  { title: 'Ground School', range: '4-8 weeks', cost: '$250-$500', action: 'Enroll in ground school' },
  { title: 'Written Exam', range: '1 day', cost: '$175', action: 'Schedule knowledge test' },
  { title: 'Pre-solo Training', range: '10-20 hrs', cost: '$2k-$4k', action: 'Practice maneuvers' },
  { title: 'Solo', range: '1 day', cost: 'Included', action: 'Solo endorsement' },
  { title: 'Cross-country', range: '10-15 hrs', cost: '$2k-$4k', action: 'Plan XC flights' },
  { title: 'Checkride', range: '1 day', cost: '$700-$1,200', action: 'Schedule checkride' },
];

export default function StudentRoadmapScreen({ navigation }: any) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>TRAINING ROADMAP</Text>
        <Text style={styles.heroTitle}>See the typical path from first lesson to checkride.</Text>
        <Text style={styles.heroSubtitle}>
          Use this as a planning guide so the timing, cost, and next milestone are always visible.
        </Text>
      </View>

      {STEPS.map((step, index) => (
        <View key={step.title} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>{index + 1}</Text>
            </View>
            <View style={styles.stepMeta}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepHint}>{step.action}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaChip}>Time: {step.range}</Text>
            <Text style={styles.metaChip}>Cost: {step.cost}</Text>
          </View>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              navigation.navigate('Marketplace', { screen: 'MarketplaceCategory', params: { category: 'Flight Schools' } })
            }
            activeOpacity={0.92}
          >
            <Ionicons name="school-outline" size={16} color={colors.primaryStrong} />
            <Text style={styles.secondaryButtonText}>Find a Flight School</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.sm, paddingBottom: 120 },
  hero: {
    backgroundColor: colors.cockpit,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.floating,
  },
  heroEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: '#93c5fd' },
  heroTitle: { ...typography.display, color: '#fff', marginTop: spacing.sm },
  heroSubtitle: { ...typography.body, color: '#dbe4f0', marginTop: spacing.sm },
  card: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardHeader: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  stepBadgeText: { fontSize: 13, fontWeight: '700', color: colors.primaryStrong },
  stepMeta: { flex: 1 },
  stepTitle: { ...typography.h3 },
  stepHint: { ...typography.muted, marginTop: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  metaChip: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  secondaryButton: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primarySoft,
    paddingVertical: 12,
    borderRadius: radius.lg,
  },
  secondaryButtonText: { color: colors.primaryStrong, fontWeight: '700', fontSize: 12 },
});
