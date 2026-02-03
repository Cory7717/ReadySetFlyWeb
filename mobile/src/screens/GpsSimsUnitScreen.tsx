import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';
import { gpsTrainerDisclaimer, gpsTrainerUnits } from '@shared/gps-sims';
import { useAuth } from '../utils/auth';
import { useStudentProfile } from '../utils/studentProfile';

type Mode = 'learn' | 'checkride';

function createStepState(length: number) {
  return new Array(length).fill(false) as boolean[];
}

export default function GpsSimsUnitScreen({ route }: any) {
  const unitId = route?.params?.unitId as string;
  const unit = useMemo(() => gpsTrainerUnits.find((item) => item.id === unitId), [unitId]);
  const { data: user } = useAuth();
  const { profile, saveProfile, saving } = useStudentProfile();
  const entitlements = (user as any)?.entitlements;
  const isPro = entitlements?.tier ? entitlements.tier !== 'free' : user?.logbookProStatus === 'active';
  const canPersist = Boolean(isPro);

  const [mode, setMode] = useState<Mode>('learn');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(unit?.tasks[0]?.id ?? null);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(
    unit?.panel?.hotspots?.[0]?.id ?? null
  );
  const [stepProgress, setStepProgress] = useState<Record<string, boolean[]>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!unit?.tasks?.length) return;
    if (!selectedTaskId || !unit.tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(unit.tasks[0].id);
    }
  }, [unit?.id, selectedTaskId]);

  useEffect(() => {
    if (!unit?.panel?.hotspots?.length) return;
    if (!selectedHotspotId || !unit.panel.hotspots.some((hotspot) => hotspot.id === selectedHotspotId)) {
      setSelectedHotspotId(unit.panel.hotspots[0].id);
    }
  }, [unit?.id, selectedHotspotId]);

  useEffect(() => {
    setLoaded(false);
  }, [unit?.id]);

  useEffect(() => {
    if (!unit || !canPersist || loaded) return;
    const saved = (profile?.progressJson as any)?.gpsTrainer?.[unit.id];
    if (saved) {
      if (saved.mode === 'learn' || saved.mode === 'checkride') {
        setMode(saved.mode);
      }
      if (saved.selectedTaskId && unit.tasks.some((task) => task.id === saved.selectedTaskId)) {
        setSelectedTaskId(saved.selectedTaskId);
      }
      if (saved.stepProgress && typeof saved.stepProgress === 'object') {
        setStepProgress(saved.stepProgress);
      }
    }
    setLoaded(true);
  }, [unit, canPersist, loaded, profile?.progressJson]);

  if (!unit) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Simulator not found</Text>
        <Text style={styles.subtitle}>Return to the GPS Sim hub.</Text>
      </View>
    );
  }

  const selectedTask = unit.tasks.find((task) => task.id === selectedTaskId) || unit.tasks[0];
  const progress = stepProgress[selectedTask.id] ?? createStepState(selectedTask.steps.length);
  const completedCount = progress.filter(Boolean).length;
  const showSteps = mode === 'learn' || revealed[selectedTask.id];
  const selectedHotspot =
    unit.panel.hotspots.find((hotspot) => hotspot.id === selectedHotspotId) || unit.panel.hotspots[0];
  const panelBaseUrl = process.env.EXPO_PUBLIC_GPS_PANEL_BASE_URL;
  const panelImage = panelBaseUrl
    ? `${panelBaseUrl.replace(/\/$/, '')}/${unit.panel.imageKey}.jpg`
    : unit.panel.image;

  const handleToggleStep = (index: number) => {
    setStepProgress((prev) => {
      const nextSteps = [...(prev[selectedTask.id] ?? createStepState(selectedTask.steps.length))];
      nextSteps[index] = !nextSteps[index];
      return { ...prev, [selectedTask.id]: nextSteps };
    });
  };

  const handleResetTask = () => {
    setStepProgress((prev) => ({
      ...prev,
      [selectedTask.id]: createStepState(selectedTask.steps.length),
    }));
    setRevealed((prev) => ({ ...prev, [selectedTask.id]: false }));
  };

  const handleSave = () => {
    if (!canPersist) return;
    const currentProgress = (profile?.progressJson as any) || {};
    const gpsTrainer = currentProgress.gpsTrainer || {};
    const payload = {
      ...currentProgress,
      gpsTrainer: {
        ...gpsTrainer,
        [unit.id]: {
          mode,
          selectedTaskId,
          stepProgress,
          updatedAt: new Date().toISOString(),
        },
      },
    };
    saveProfile({ progressJson: payload });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{unit.title}</Text>
        <Text style={styles.subtitle}>{unit.summary}</Text>
        <View style={styles.highlightRow}>
          {unit.highlights.map((item) => (
            <View key={item} style={styles.badge}>
              <Text style={styles.badgeText}>{item}</Text>
            </View>
          ))}
        </View>
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
        <Text style={styles.sectionTitle}>Trainer Mode</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'learn' && styles.modeButtonActive]}
            onPress={() => setMode('learn')}
          >
            <Text style={styles.modeButtonText}>Learn</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'checkride' && styles.modeButtonActive]}
            onPress={() => setMode('checkride')}
          >
            <Text style={styles.modeButtonText}>Checkride</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Panel Walkthrough</Text>
        <Text style={styles.helperText}>
          Tap a hotspot to rehearse the related action before running the checklist.
        </Text>
        <View style={styles.panelContainer}>
          <Image source={{ uri: panelImage }} style={styles.panelImage} />
          {unit.panel.hotspots.map((hotspot) => {
            const isActive = hotspot.id === selectedHotspot?.id;
            return (
              <TouchableOpacity
                key={hotspot.id}
                style={[
                  styles.hotspot,
                  isActive && styles.hotspotActive,
                  {
                    left: `${hotspot.x}%`,
                    top: `${hotspot.y}%`,
                    width: `${hotspot.width}%`,
                    height: `${hotspot.height}%`,
                  },
                ]}
                onPress={() => setSelectedHotspotId(hotspot.id)}
              >
                <Text style={styles.hotspotLabel}>{hotspot.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.hotspotDetail}>
          <Text style={styles.hotspotTitle}>{selectedHotspot?.label}</Text>
          <Text style={styles.hotspotDescription}>{selectedHotspot?.description}</Text>
        </View>
        <View style={styles.hotspotPillRow}>
          {unit.panel.hotspots.map((hotspot) => (
            <TouchableOpacity
              key={hotspot.id}
              style={[
                styles.hotspotPill,
                hotspot.id === selectedHotspot?.id && styles.hotspotPillActive,
              ]}
              onPress={() => setSelectedHotspotId(hotspot.id)}
            >
              <Text
                style={[
                  styles.hotspotPillText,
                  hotspot.id === selectedHotspot?.id && styles.hotspotPillTextActive,
                ]}
              >
                {hotspot.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tasks</Text>
        {unit.tasks.map((task) => (
          <TouchableOpacity
            key={task.id}
            style={[styles.taskButton, selectedTask.id === task.id && styles.taskButtonActive]}
            onPress={() => setSelectedTaskId(task.id)}
          >
            <Text style={styles.taskButtonText}>{task.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.taskHeader}>
          <Text style={styles.taskTitle}>{selectedTask.title}</Text>
          <Text style={styles.taskGoal}>{selectedTask.goal}</Text>
        </View>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            Steps: {completedCount}/{selectedTask.steps.length}
          </Text>
          <TouchableOpacity style={styles.resetButton} onPress={handleResetTask}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
          {!showSteps && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => setRevealed((prev) => ({ ...prev, [selectedTask.id]: true }))}
            >
              <Text style={styles.resetButtonText}>Reveal</Text>
            </TouchableOpacity>
          )}
        </View>

        {showSteps ? (
          <View style={styles.stepsList}>
            {selectedTask.steps.map((step, index) => (
              <TouchableOpacity
                key={step}
                style={styles.stepRow}
                onPress={() => handleToggleStep(index)}
              >
                <View style={[styles.checkbox, progress[index] && styles.checkboxActive]}>
                  {progress[index] && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.helperText}>
            Steps are hidden in Checkride mode. Reveal after you attempt the flow.
          </Text>
        )}

        {selectedTask.tips && selectedTask.tips.length > 0 && (
          <View style={styles.tipsBox}>
            <Text style={styles.tipsTitle}>Instructor tips</Text>
            {selectedTask.tips.map((tip) => (
              <Text key={tip} style={styles.tipItem}>
                - {tip}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.saveRow}>
          <Text style={styles.saveText}>
            {isPro ? 'Saved progress is enabled.' : 'Upgrade to RSF Pro to save progress.'}
          </Text>
          <TouchableOpacity
            style={[styles.saveButton, !canPersist && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canPersist || saving}
          >
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save progress'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>IFR Scenarios</Text>
        {unit.scenarios.map((scenario) => (
          <View key={scenario.id} style={styles.scenarioCard}>
            <Text style={styles.scenarioTitle}>{scenario.title}</Text>
            <Text style={styles.scenarioSummary}>{scenario.summary}</Text>
            <View style={styles.highlightRow}>
              {scenario.tasks.map((taskId) => {
                const task = unit.tasks.find((item) => item.id === taskId);
                return (
                  <View key={taskId} style={styles.badge}>
                    <Text style={styles.badgeText}>{task?.title ?? taskId}</Text>
                  </View>
                );
              })}
            </View>
            {scenario.notes && scenario.notes.length > 0 && (
              <View style={styles.tipsBox}>
                {scenario.notes.map((note) => (
                  <Text key={note} style={styles.tipItem}>
                    - {note}
                  </Text>
                ))}
              </View>
            )}
          </View>
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
  section: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm },
  highlightRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.xs },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  badgeText: { fontSize: 10, color: colors.primary, fontWeight: '600' },
  modeRow: { flexDirection: 'row', gap: spacing.sm },
  modeButton: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  modeButtonActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  modeButtonText: { fontSize: 12, fontWeight: '600', color: colors.text },
  panelContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1200 / 650,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  panelImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  hotspot: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  hotspotActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
  },
  hotspotLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  hotspotDetail: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  hotspotTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  hotspotDescription: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  hotspotPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  hotspotPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  hotspotPillActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  hotspotPillText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  hotspotPillTextActive: { color: colors.primary },
  taskButton: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  taskButtonActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  taskButtonText: { fontSize: 12, fontWeight: '600', color: colors.text },
  taskHeader: { marginBottom: spacing.xs },
  taskTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  taskGoal: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  progressRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.sm },
  progressText: { fontSize: 12, color: colors.textMuted },
  resetButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetButtonText: { fontSize: 11, fontWeight: '600', color: colors.text },
  stepsList: { gap: spacing.xs },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepText: { flex: 1, fontSize: 12, color: colors.text },
  helperText: { fontSize: 12, color: colors.textMuted },
  tipsBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tipsTitle: { fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  tipItem: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  saveRow: { marginTop: spacing.sm },
  saveText: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
  saveButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: { backgroundColor: colors.border },
  saveButtonText: { color: '#fff', fontWeight: '600' },
  scenarioCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  scenarioTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  scenarioSummary: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
});
