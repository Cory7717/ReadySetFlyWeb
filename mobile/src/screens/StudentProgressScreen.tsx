import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

export default function StudentProgressScreen({ navigation }: any) {
  const [hours, setHours] = useState('0');
  const [solos, setSolos] = useState('0');
  const [xcHours, setXcHours] = useState('0');
  const [writtenPassed, setWrittenPassed] = useState(false);
  const [checkrideDate, setCheckrideDate] = useState('');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Progress Tracker</Text>
      <Text style={styles.subtitle}>Track milestones and stay on top of your training.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Total Hours Logged</Text>
        <TextInput style={styles.input} value={hours} onChangeText={setHours} keyboardType="numeric" />
        <Text style={styles.label}>Solos Completed</Text>
        <TextInput style={styles.input} value={solos} onChangeText={setSolos} keyboardType="numeric" />
        <Text style={styles.label}>Cross-country Hours</Text>
        <TextInput style={styles.input} value={xcHours} onChangeText={setXcHours} keyboardType="numeric" />
        <Text style={styles.label}>Checkride Date (optional)</Text>
        <TextInput style={styles.input} value={checkrideDate} onChangeText={setCheckrideDate} placeholder="YYYY-MM-DD" />
        <TouchableOpacity
          style={[styles.toggleButton, writtenPassed && styles.toggleButtonActive]}
          onPress={() => setWrittenPassed(!writtenPassed)}
        >
          <Text style={styles.toggleButtonText}>
            Written Exam {writtenPassed ? 'Passed' : 'Not passed'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.nextTitle}>Next Step</Text>
        <Text style={styles.nextText}>Keep progressing with a local flight school or instructor.</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            navigation.navigate('Marketplace', { screen: 'MarketplaceCategory', params: { category: 'Flight Schools' } })
          }
        >
          <Text style={styles.primaryButtonText}>Find Flight Schools</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  title: { ...typography.h2 },
  subtitle: { marginTop: spacing.xs, color: colors.textMuted, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  label: { fontSize: 12, fontWeight: '600', color: colors.text, marginTop: spacing.xs },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.xs },
  toggleButton: { marginTop: spacing.sm, backgroundColor: '#e2e8f0', padding: spacing.sm, borderRadius: radius.md, alignItems: 'center' },
  toggleButtonActive: { backgroundColor: '#bbf7d0' },
  toggleButtonText: { fontSize: 12, fontWeight: '600', color: colors.text },
  nextTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  nextText: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', marginTop: spacing.sm },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
});
