import { ScrollView, StyleSheet, Text, View } from 'react-native';

const FAQS = [
  {
    q: 'Why subscribe to Logbook Pro?',
    a: 'Logbook Pro unlocks advanced flight planning, radio comms training, saved routes, and premium logbook analytics.',
  },
  {
    q: 'Are the training tools FAA-approved?',
    a: 'Our modules are FAA-aligned study aids. Always verify with your instructor and official FAA sources.',
  },
  {
    q: 'How do I find a flight school?',
    a: 'Use the Marketplace → Flight Schools category to browse local schools as listings grow.',
  },
];

export default function FAQScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>FAQ</Text>
      <Text style={styles.subtitle}>Quick answers to common questions.</Text>
      {FAQS.map((item) => (
        <View key={item.q} style={styles.card}>
          <Text style={styles.question}>{item.q}</Text>
          <Text style={styles.answer}>{item.a}</Text>
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
  question: { fontSize: 14, fontWeight: '600', color: '#111827' },
  answer: { fontSize: 12, color: '#6b7280', marginTop: 6 },
});
