import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';
import { gpsTrainerDisclaimer, gpsTrainerUnits } from '@shared/gps-sims';

function highlightColor(index: number) {
  if (index % 3 === 0) return colors.primary;
  if (index % 3 === 1) return colors.info;
  return colors.accent;
}

export default function GpsSimsHubScreen({ navigation }: any) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>GPS TRAINERS</Text>
        <Text style={styles.heroTitle}>Rehearse avionics flows before they matter in the airplane.</Text>
        <Text style={styles.heroSubtitle}>
          RSF turns common GA GPS stacks into structured training sessions with hotspots, guided tasks,
          and scenario drills.
        </Text>
      </View>

      <View style={styles.noticeCard}>
        <View style={styles.noticeHeader}>
          <Ionicons name="school-outline" size={18} color={colors.warning} />
          <Text style={styles.noticeTitle}>Training aid only</Text>
        </View>
        {gpsTrainerDisclaimer.map((note) => (
          <Text key={note} style={styles.noticeItem}>
            {note}
          </Text>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Sim Units</Text>
          <Text style={styles.sectionSubtitle}>Choose the stack you want to build speed and confidence on.</Text>
        </View>

        {gpsTrainerUnits.map((unit, index) => (
          <TouchableOpacity
            key={unit.id}
            style={styles.unitCard}
            onPress={() => navigation.navigate('GpsSimsUnit', { unitId: unit.id })}
            activeOpacity={0.92}
          >
            <View style={[styles.unitAccent, { backgroundColor: highlightColor(index) }]} />
            <View style={styles.unitHeader}>
              <View style={[styles.unitIconWrap, { backgroundColor: `${highlightColor(index)}18` }]}>
                <Ionicons name="navigate-outline" size={22} color={highlightColor(index)} />
              </View>
              <View style={styles.unitMeta}>
                <Text style={styles.unitTitle}>{unit.title}</Text>
                <Text style={styles.unitSubtitle}>{unit.subtitle}</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={colors.textSoft} />
            </View>

            <Text style={styles.unitSummary}>{unit.summary}</Text>

            <View style={styles.tagRow}>
              {unit.highlights.map((item) => (
                <View key={item} style={styles.tag}>
                  <Text style={styles.tagText}>{item}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        ))}
      </View>
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
    maxWidth: 340,
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
    maxWidth: 350,
  },
  noticeCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  noticeTitle: {
    ...typography.h3,
  },
  noticeItem: {
    ...typography.muted,
    marginTop: 4,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h2,
  },
  sectionSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
  unitCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  unitAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  unitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unitIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitMeta: {
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.xs,
  },
  unitTitle: {
    ...typography.h2,
  },
  unitSubtitle: {
    ...typography.muted,
    marginTop: 2,
  },
  unitSummary: {
    ...typography.body,
    marginTop: spacing.md,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.primarySoft,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryStrong,
  },
});
