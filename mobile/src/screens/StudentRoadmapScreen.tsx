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
      <Text style={styles.title}>Student Pilot Roadmap</Text>
      <Text style={styles.subtitle}>Typical path to the private pilot checkride.</Text>

      {STEPS.map((step, index) => (
        <View key={step.title} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.stepIndex}>{index + 1}</Text>
            <Text style={styles.stepTitle}>{step.title}</Text>
          </View>
          <Text style={styles.meta}>Time: {step.range}</Text>
          <Text style={styles.meta}>Cost: {step.cost}</Text>
          <Text style={styles.tip}>{step.action}</Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              navigation.navigate('Marketplace', { screen: 'MarketplaceCategory', params: { category: 'Flight Schools' } })
            }
          >
            <Ionicons name="school-outline" size={16} color="#1e40af" />
            <Text style={styles.secondaryButtonText}>Find a Flight School</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  title: { ...typography.h2 },
  subtitle: { marginTop: spacing.xs, color: colors.textMuted, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepIndex: { fontSize: 14, fontWeight: '700', color: colors.primary },
  stepTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  tip: { fontSize: 12, color: colors.text, marginTop: 8 },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    backgroundColor: colors.primarySoft,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  secondaryButtonText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
});
