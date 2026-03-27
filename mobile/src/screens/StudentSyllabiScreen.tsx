import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';
import {
  trainingSyllabi,
  trainingSyllabusComplianceNotes,
  trainingSyllabusSimulatorNote,
} from '@shared/training-syllabi';

export default function StudentSyllabiScreen() {
  const [expandedId, setExpandedId] = useState<string | null>(trainingSyllabi[0]?.id || null);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>CFI SYLLABI</Text>
        <Text style={styles.heroTitle}>Use ACS-aligned templates that keep training structured.</Text>
        <Text style={styles.heroSubtitle}>
          Independent instructors and self-driven students can use these syllabi as a structured Part 61 reference.
        </Text>
      </View>

      <View style={styles.noticeCard}>
        <View style={styles.noticeHeader}>
          <Ionicons name="document-text-outline" size={18} color={colors.warning} />
          <Text style={styles.noticeTitle}>Compliance notes</Text>
        </View>
        {trainingSyllabusComplianceNotes.map((note) => (
          <Text key={note} style={styles.noticeItem}>
            {note}
          </Text>
        ))}
        <Text style={styles.noticeFootnote}>{trainingSyllabusSimulatorNote}</Text>
      </View>

      {trainingSyllabi.map((syllabus) => {
        const isExpanded = expandedId === syllabus.id;
        return (
          <View key={syllabus.id} style={styles.card}>
            <TouchableOpacity
              onPress={() => setExpandedId(isExpanded ? null : syllabus.id)}
              style={styles.cardHeader}
              activeOpacity={0.92}
            >
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>{syllabus.title}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Template</Text>
                </View>
              </View>
              <Text style={styles.cardSubtitle}>{syllabus.subtitle}</Text>
              <Ionicons
                name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={20}
                color={colors.textMuted}
                style={styles.chevron}
              />
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.cardBody}>
                <Text style={styles.sectionTitle}>Completion standards</Text>
                {syllabus.completionStandards.map((standard) => (
                  <Text key={standard} style={styles.listItem}>
                    {standard}
                  </Text>
                ))}

                <Text style={styles.sectionTitle}>Phases and lesson focus</Text>
                {syllabus.phases.map((phase) => (
                  <View key={phase.id} style={styles.phaseCard}>
                    <Text style={styles.phaseTitle}>{phase.title}</Text>
                    <Text style={styles.phaseSummary}>{phase.summary}</Text>

                    <Text style={styles.listLabel}>Ground</Text>
                    {phase.ground.map((item) => (
                      <Text key={item} style={styles.listItem}>
                        {item}
                      </Text>
                    ))}

                    <Text style={styles.listLabel}>Flight</Text>
                    {phase.flight.map((item) => (
                      <Text key={item} style={styles.listItem}>
                        {item}
                      </Text>
                    ))}

                    {phase.stageCheck && (
                      <Text style={styles.stageCheck}>Stage check: {phase.stageCheck}</Text>
                    )}
                  </View>
                ))}

                <Text style={styles.sectionTitle}>Optional simulator modules</Text>
                {syllabus.simulatorModules.map((module) => (
                  <Text key={module} style={styles.listItem}>
                    {module}
                  </Text>
                ))}
                <Text style={styles.noticeFootnote}>{trainingSyllabusSimulatorNote}</Text>
              </View>
            )}
          </View>
        );
      })}
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
  },
  noticeCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  noticeTitle: { ...typography.h3 },
  noticeItem: { ...typography.muted, marginBottom: 4 },
  noticeFootnote: { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm },
  card: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardHeader: {
    padding: spacing.lg,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: { ...typography.h3, flex: 1 },
  cardSubtitle: { ...typography.muted, marginTop: 4 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  badgeText: { fontSize: 10, color: colors.primaryStrong, fontWeight: '700' },
  chevron: { marginTop: spacing.sm },
  cardBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  sectionTitle: { ...typography.h3, marginTop: spacing.md, marginBottom: spacing.sm },
  listLabel: { fontSize: 11, textTransform: 'uppercase', color: colors.textMuted, marginTop: spacing.sm },
  listItem: { ...typography.muted, marginTop: 4 },
  phaseCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.sm,
  },
  phaseTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  phaseSummary: { ...typography.muted, marginTop: 2, marginBottom: spacing.xs },
  stageCheck: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
});
