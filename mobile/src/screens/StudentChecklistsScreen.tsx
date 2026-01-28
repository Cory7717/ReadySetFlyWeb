import { ScrollView, StyleSheet, Text, View } from 'react-native';

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
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { marginTop: 4, color: '#6b7280', marginBottom: 12 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  item: { fontSize: 12, color: '#374151', marginBottom: 4 },
});
