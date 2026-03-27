import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

const CHECKLISTS = [
  {
    title: 'Preflight Flow',
    items: ['Documents (ARROW)', 'Fuel and oil quantity', 'Control surfaces', 'Tires and brakes', 'Pitot/static covers removed'],
  },
  {
    title: 'Pattern Work',
    items: ['Airspeed check', 'Flaps set', 'Carb heat as required', 'Abeam touchdown point', 'Final stabilized'],
  },
  {
    title: 'What to Bring',
    items: ['Headset', 'Logbook', 'Kneeboard', 'E6B or calculator', 'FAA handbooks'],
  },
];

export default function StudentChecklistsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>CHECKLISTS</Text>
        <Text style={styles.heroTitle}>Keep lesson prep simple and repeatable.</Text>
        <Text style={styles.heroSubtitle}>
          Use these as training reminders, then confirm the actual aircraft checklist in the POH.
        </Text>
      </View>

      <View style={styles.noticeCard}>
        <Ionicons name="warning-outline" size={18} color={colors.warning} />
        <Text style={styles.noticeText}>General guidance only. Always use the aircraft POH checklist.</Text>
      </View>

      {CHECKLISTS.map((list) => (
        <View key={list.title} style={styles.card}>
          <Text style={styles.cardTitle}>{list.title}</Text>
          {list.items.map((item) => (
            <View key={item} style={styles.itemRow}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
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
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#93c5fd',
  },
  heroTitle: {
    ...typography.display,
    color: '#fff',
    marginTop: spacing.sm,
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
  },
  noticeCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  noticeText: {
    ...typography.muted,
    color: colors.primaryStrong,
    flex: 1,
  },
  card: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardTitle: { ...typography.h2, marginBottom: spacing.sm },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
  },
  itemText: { ...typography.body, flex: 1 },
});
