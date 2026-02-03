import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';
import { gpsTrainerDisclaimer, gpsTrainerUnits } from '@shared/gps-sims';

export default function GpsSimsHubScreen({ navigation }: any) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>RSF GPS Simulators</Text>
        <Text style={styles.subtitle}>
          Functionally accurate GPS workflows for the most common GA avionics stacks.
        </Text>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Training aid only</Text>
        {gpsTrainerDisclaimer.map((note) => (
          <Text key={note} style={styles.noticeItem}>
            - {note}
          </Text>
        ))}
      </View>

      <View style={styles.section}>
        {gpsTrainerUnits.map((unit) => (
          <TouchableOpacity
            key={unit.id}
            style={styles.card}
            onPress={() => navigation.navigate('GpsSimsUnit', { unitId: unit.id })}
          >
            <Ionicons name="compass-outline" size={24} color="#1e40af" />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{unit.title}</Text>
              <Text style={styles.cardSubtitle}>{unit.subtitle}</Text>
              <Text style={styles.cardSummary}>{unit.summary}</Text>
              <View style={styles.highlightRow}>
                {unit.highlights.map((item) => (
                  <View key={item} style={styles.badge}>
                    <Text style={styles.badgeText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.lg },
  header: { padding: spacing.lg, backgroundColor: colors.surface },
  title: { ...typography.h2 },
  subtitle: { marginTop: spacing.xs, color: colors.textMuted },
  notice: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noticeTitle: { ...typography.h3, marginBottom: spacing.xs },
  noticeItem: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  section: { padding: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardText: { marginLeft: spacing.sm, flex: 1 },
  cardTitle: { ...typography.h3 },
  cardSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  cardSummary: { fontSize: 12, color: colors.text, marginTop: spacing.xs },
  highlightRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs, gap: 6 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  badgeText: { fontSize: 10, color: colors.primary, fontWeight: '600' },
});
