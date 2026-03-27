import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

const trainingDeck = [
  {
    title: 'Can I Become a Pilot?',
    subtitle: 'Quick readiness wizard plus next steps.',
    icon: 'sparkles-outline',
    route: 'StudentWizard',
    accent: colors.primary,
  },
  {
    title: 'Training Roadmap',
    subtitle: 'See the path from intro flight to checkride.',
    icon: 'trail-sign-outline',
    route: 'StudentRoadmap',
    accent: colors.info,
  },
  {
    title: 'Training Cost Estimator',
    subtitle: 'Estimate the budget for your certificate.',
    icon: 'calculator-outline',
    route: 'StudentCost',
    accent: colors.accent,
  },
  {
    title: 'Progress Tracker',
    subtitle: 'Track milestones, lessons, and study pace.',
    icon: 'speedometer-outline',
    route: 'StudentProgress',
    accent: colors.primaryStrong,
  },
  {
    title: 'Written Test Prep',
    subtitle: 'FAA-aligned study modules and quick quizzes.',
    icon: 'clipboard-outline',
    route: 'StudentWritten',
    accent: colors.warning,
  },
  {
    title: 'Checklists & Preflight',
    subtitle: 'Core procedures, flows, and lesson prep reminders.',
    icon: 'list-outline',
    route: 'StudentChecklists',
    accent: colors.cockpitMuted,
  },
];

const advancedDeck = [
  {
    title: 'VOR Trainer',
    subtitle: 'Radials, OBS, flags, and intercept drills.',
    icon: 'radio-outline',
    route: 'StudentVorTrainer',
    accent: colors.primary,
  },
  {
    title: 'RSF GPS Simulators',
    subtitle: 'IFR GPS workflows for top avionics stacks.',
    icon: 'compass-outline',
    route: 'GpsSimsHub',
    accent: colors.info,
  },
  {
    title: 'IFR Tools Hub',
    subtitle: 'Plates, simulators, and IFR planning tools.',
    icon: 'navigate-outline',
    route: 'IfrTools',
    accent: colors.primaryStrong,
  },
  {
    title: 'Independent CFI Syllabi',
    subtitle: 'ACS-aligned Part 61 templates.',
    icon: 'school-outline',
    route: 'StudentSyllabi',
    accent: colors.accent,
  },
  {
    title: 'Student Weather',
    subtitle: 'Simplified weather view for training days.',
    icon: 'cloud-outline',
    route: 'StudentWeather',
    accent: colors.radar,
  },
];

export default function StudentHubScreen({ navigation }: any) {
  const goToFlightSchools = () => {
    navigation.navigate('Marketplace', {
      screen: 'MarketplaceCategory',
      params: { category: 'Flight Schools' },
    });
  };

  const renderDeckCard = (item: any) => (
    <TouchableOpacity
      key={item.title}
      style={styles.deckCard}
      onPress={() => navigation.navigate(item.route)}
      activeOpacity={0.92}
    >
      <View style={[styles.deckIconWrap, { backgroundColor: `${item.accent}18` }]}>
        <Ionicons name={item.icon as any} size={22} color={item.accent} />
      </View>
      <View style={styles.deckMeta}>
        <Text style={styles.deckTitle}>{item.title}</Text>
        <Text style={styles.deckSubtitle}>{item.subtitle}</Text>
      </View>
      <Ionicons name="arrow-forward" size={18} color={colors.textSoft} />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>STUDENT PILOT HUB</Text>
        <Text style={styles.heroTitle}>A guided training workspace, not just a folder of tools.</Text>
        <Text style={styles.heroSubtitle}>
          Use RSF to map the journey, study smarter, and keep training momentum between lessons.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Training Foundations</Text>
        <Text style={styles.sectionSubtitle}>Start with the basics that keep your training organized and moving.</Text>
        {trainingDeck.map(renderDeckCard)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nav & IFR Readiness</Text>
        <Text style={styles.sectionSubtitle}>Move into instruments, nav trainers, and deeper proficiency tools.</Text>
        {advancedDeck.map(renderDeckCard)}
      </View>

      <View style={styles.quickCalcCard}>
        <Text style={styles.sectionTitle}>Quick Calculators</Text>
        <Text style={styles.sectionSubtitle}>Fast support tools for lesson prep and weather decisions.</Text>
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickButton} onPress={() => navigation.navigate('CrosswindCalc')} activeOpacity={0.92}>
            <Ionicons name="speedometer-outline" size={18} color={colors.primary} />
            <Text style={styles.quickButtonText}>Crosswind</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickButton} onPress={() => navigation.navigate('DensityAltitude')} activeOpacity={0.92}>
            <Ionicons name="analytics-outline" size={18} color={colors.primary} />
            <Text style={styles.quickButtonText}>Density Altitude</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.ctaCard}>
        <Text style={styles.ctaTitle}>Ready to start training?</Text>
        <Text style={styles.ctaSubtitle}>Find a flight school near you and turn the plan into action.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={goToFlightSchools} activeOpacity={0.92}>
          <Text style={styles.primaryButtonText}>Find Flight Schools</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
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
  deckCard: {
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
  deckIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckMeta: {
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
  },
  deckTitle: {
    ...typography.h3,
  },
  deckSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
  quickCalcCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  quickButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
  },
  quickButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryStrong,
  },
  ctaCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  ctaTitle: {
    ...typography.h2,
  },
  ctaSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
  primaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...shadow.card,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
