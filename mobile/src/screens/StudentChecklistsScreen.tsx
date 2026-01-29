import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

const CHECKLISTS = [
  {
    title: 'Preflight Flow',
    items: ['Documents (ARROW)', 'Fuel & oil quantity', 'Control surfaces', 'Tires & brakes', 'Pitot/static covers removed'],
  },
  {
    title: 'Pattern Work',
    items: ['Airspeed check', 'Flaps set', 'Carb heat as required', 'Abeam touchdown point', 'Final stabilized'],
  },
  {
    title: 'What to Bring',
    items: ['Headset', 'Logbook', 'Kneeboard', 'E6B / calculator', 'FAA handbooks'],
  },
];

export default function StudentChecklistsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Checklists & Preflight</Text>
      <Text style={styles.subtitle}>General guidance only. Always use the aircraft POH checklist.</Text>

      {CHECKLISTS.map((list) => (
        <View key={list.title} style={styles.card}>
          <Text style={styles.cardTitle}>{list.title}</Text>
          {list.items.map((item) => (
            <Text key={item} style={styles.item}>• {item}</Text>
          ))}
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
  cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: spacing.xs, color: colors.text },
  item: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
});
