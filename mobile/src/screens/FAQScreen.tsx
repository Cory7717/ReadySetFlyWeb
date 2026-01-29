import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

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
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  title: { ...typography.h2 },
  subtitle: { marginTop: spacing.xs, color: colors.textMuted, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  question: { fontSize: 14, fontWeight: '600', color: colors.text },
  answer: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
});
