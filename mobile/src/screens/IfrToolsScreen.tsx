import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

const tools = [
  {
    title: 'RSF GPS Simulators',
    subtitle: 'Functionally accurate GPS workflows for IFR training.',
    icon: 'compass-outline',
    route: 'GpsSimsHub',
    accent: colors.primary,
  },
  {
    title: 'Approach Plates',
    subtitle: 'Search FAA plates by airport and category.',
    icon: 'document-text-outline',
    route: 'ApproachPlates',
    accent: colors.info,
  },
  {
    title: 'VOR Trainer',
    subtitle: 'Radials, OBS, and intercept drills.',
    icon: 'radio-outline',
    route: 'StudentVorTrainer',
    accent: colors.accent,
  },
  {
    title: 'Flight Planner',
    subtitle: 'Plan routes with fuel, terrain, and filing context.',
    icon: 'paper-plane-outline',
    route: 'FlightPlanner',
    accent: colors.primaryStrong,
  },
  {
    title: 'Pilot Tools',
    subtitle: 'Weather, airport data, and preflight support tools.',
    icon: 'cloud-outline',
    route: 'PilotTools',
    accent: colors.radar,
  },
  {
    title: 'NOTAMs & Active Runway',
    subtitle: 'Runway advisory plus live NOTAMs for any airport.',
    icon: 'alert-circle-outline',
    route: 'AirportBriefing',
    accent: colors.warning,
  },
  {
    title: 'TFRs',
    subtitle: 'Temporary Flight Restrictions by ICAO.',
    icon: 'warning-outline',
    route: 'Tfrs',
    accent: colors.warning,
  },
  {
    title: 'Radio Comms Trainer',
    subtitle: 'Scenario practice with scoring and playback.',
    icon: 'mic-outline',
    route: 'RadioCommsTrainer',
    accent: colors.cockpitMuted,
  },
];

export default function IfrToolsScreen({ navigation }: any) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>IFR TOOLKIT</Text>
        <Text style={styles.heroTitle}>Everything you need to brief, train, and rehearse the IFR workflow.</Text>
        <Text style={styles.heroSubtitle}>
          Keep the instruments, references, plates, and training aids in one place instead of bouncing between apps.
        </Text>
      </View>

      <View style={styles.noticeCard}>
        <View style={styles.noticeHeader}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.warning} />
          <Text style={styles.noticeTitle}>Training and planning support</Text>
        </View>
        <Text style={styles.noticeText}>
          RSF IFR tools are not FAA-approved avionics or training devices. Verify current procedures, charts, and instructor guidance before flight.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>IFR Missions</Text>
        <Text style={styles.sectionSubtitle}>Jump into the part of the workflow you need right now.</Text>
        {tools.map((tool) => (
          <TouchableOpacity
            key={tool.title}
            style={styles.toolCard}
            onPress={() => navigation.navigate(tool.route)}
            activeOpacity={0.92}
          >
            <View style={[styles.toolIconWrap, { backgroundColor: `${tool.accent}18` }]}>
              <Ionicons name={tool.icon as any} size={22} color={tool.accent} />
            </View>
            <View style={styles.toolMeta}>
              <Text style={styles.toolTitle}>{tool.title}</Text>
              <Text style={styles.toolSubtitle}>{tool.subtitle}</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={colors.textSoft} />
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
  },
  noticeCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
  noticeText: {
    ...typography.muted,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.h2,
    paddingHorizontal: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.muted,
    paddingHorizontal: spacing.xs,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  toolIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolMeta: {
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
  },
  toolTitle: {
    ...typography.h3,
  },
  toolSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
});
