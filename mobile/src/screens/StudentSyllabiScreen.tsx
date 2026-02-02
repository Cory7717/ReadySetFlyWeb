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
      <View style={styles.header}>
        <Text style={styles.title}>Independent CFI Syllabi</Text>
        <Text style={styles.subtitle}>
          ACS-aligned Part 61 templates for instructors and student pilots.
        </Text>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Compliance notes</Text>
        {trainingSyllabusComplianceNotes.map((note) => (
          <Text key={note} style={styles.noticeItem}>
            - {note}
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
                    - {standard}
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
                        - {item}
                      </Text>
                    ))}

                    <Text style={styles.listLabel}>Flight</Text>
                    {phase.flight.map((item) => (
                      <Text key={item} style={styles.listItem}>
                        - {item}
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
                    - {module}
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
  noticeFootnote: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardHeader: {
    padding: spacing.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: { ...typography.h3, flex: 1 },
  cardSubtitle: { marginTop: 4, fontSize: 12, color: colors.textMuted },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  badgeText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  chevron: { marginTop: spacing.xs },
  cardBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: { ...typography.h3, marginTop: spacing.sm },
  listLabel: { fontSize: 11, textTransform: 'uppercase', color: colors.textMuted, marginTop: spacing.xs },
  listItem: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  phaseCard: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginTop: spacing.sm,
  },
  phaseTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  phaseSummary: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
  stageCheck: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
});
