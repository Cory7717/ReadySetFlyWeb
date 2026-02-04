import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

const tools = [
  {
    title: 'RSF GPS Simulators',
    subtitle: 'Functionally accurate GPS workflows for IFR training.',
    icon: 'compass-outline',
    route: 'GpsSimsHub',
  },
  {
    title: 'Approach Plates',
    subtitle: 'Search FAA plates by airport and category.',
    icon: 'document-text-outline',
    route: 'ApproachPlates',
  },
  {
    title: 'VOR Trainer',
    subtitle: 'Radials, OBS, and intercept drills.',
    icon: 'radio-outline',
    route: 'StudentVorTrainer',
  },
  {
    title: 'Flight Planner',
    subtitle: 'Plan routes with fuel and time estimates.',
    icon: 'paper-plane-outline',
    route: 'FlightPlanner',
  },
  {
    title: 'Pilot Tools',
    subtitle: 'METAR/TAF with quick IFR classification.',
    icon: 'cloud-outline',
    route: 'PilotTools',
  },
  {
    title: 'NOTAMs & Active Runway',
    subtitle: 'Runway advisory plus live NOTAMs for any airport.',
    icon: 'alert-circle-outline',
    route: 'AirportBriefing',
  },
  {
    title: 'TFRs',
    subtitle: 'Temporary Flight Restrictions by ICAO.',
    icon: 'warning-outline',
    route: 'Tfrs',
  },
  {
    title: 'Radio Comms Trainer',
    subtitle: 'Scenario practice with scoring.',
    icon: 'mic-outline',
    route: 'RadioCommsTrainer',
  },
];

export default function IfrToolsScreen({ navigation }: any) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>IFR Tools</Text>
        <Text style={styles.subtitle}>
          RSF-branded simulators, plates, and IFR planning workflows.
        </Text>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Training aid only</Text>
        <Text style={styles.noticeItem}>
          RSF IFR tools are not FAA-approved devices. Verify with your instructor and current charts.
        </Text>
      </View>

      <View style={styles.section}>
        {tools.map((tool) => (
          <TouchableOpacity
            key={tool.title}
            style={styles.card}
            onPress={() => navigation.navigate(tool.route)}
          >
            <Ionicons name={tool.icon as any} size={24} color="#1e40af" />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{tool.title}</Text>
              <Text style={styles.cardSubtitle}>{tool.subtitle}</Text>
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
  noticeItem: { fontSize: 12, color: colors.textMuted },
  section: { padding: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
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
});
