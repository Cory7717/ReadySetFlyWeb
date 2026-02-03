import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

export default function StudentHubScreen({ navigation }: any) {
  const goToFlightSchools = () => {
    navigation.navigate('Marketplace', {
      screen: 'MarketplaceCategory',
      params: { category: 'Flight Schools' },
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Student Pilot Hub</Text>
        <Text style={styles.subtitle}>
          Tools and checklists to guide your training journey.
        </Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('StudentWizard')}>
          <Ionicons name="sparkles-outline" size={24} color="#1e40af" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Can I Become a Pilot?</Text>
            <Text style={styles.cardSubtitle}>Quick readiness wizard + next steps.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('StudentRoadmap')}>
          <Ionicons name="trail-sign-outline" size={24} color="#1e40af" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Training Roadmap</Text>
            <Text style={styles.cardSubtitle}>Step-by-step path to the checkride.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('StudentCost')}>
          <Ionicons name="calculator-outline" size={24} color="#1e40af" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Training Cost Estimator</Text>
            <Text style={styles.cardSubtitle}>Estimate your total training cost.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('StudentProgress')}>
          <Ionicons name="speedometer-outline" size={24} color="#1e40af" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Progress Tracker</Text>
            <Text style={styles.cardSubtitle}>Track milestones and study progress.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('StudentWritten')}>
          <Ionicons name="clipboard-outline" size={24} color="#1e40af" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Written Test Prep</Text>
            <Text style={styles.cardSubtitle}>FAA-aligned study modules and quizzes.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('StudentVorTrainer')}>
          <Ionicons name="radio-outline" size={24} color="#1e40af" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>VOR Trainer</Text>
            <Text style={styles.cardSubtitle}>Radials, OBS, flags, and intercept drills.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('GpsSimsHub')}>
          <Ionicons name="compass-outline" size={24} color="#1e40af" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>RSF GPS Simulators</Text>
            <Text style={styles.cardSubtitle}>IFR GPS workflows for top avionics stacks.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('IfrTools')}>
          <Ionicons name="clipboard-outline" size={24} color="#1e40af" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>IFR Tools Hub</Text>
            <Text style={styles.cardSubtitle}>Plates, simulators, and IFR planning tools.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('StudentSyllabi')}>
          <Ionicons name="school-outline" size={24} color="#1e40af" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Independent CFI Syllabi</Text>
            <Text style={styles.cardSubtitle}>ACS-aligned Part 61 templates.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('StudentChecklists')}>
          <Ionicons name="list-outline" size={24} color="#1e40af" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Checklists & Preflight</Text>
            <Text style={styles.cardSubtitle}>Core procedures and lesson prep.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('StudentWeather')}>
          <Ionicons name="cloud-outline" size={24} color="#1e40af" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Student Weather</Text>
            <Text style={styles.cardSubtitle}>Simplified training weather view.</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Calculators</Text>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CrosswindCalc')}>
          <Ionicons name="speedometer-outline" size={24} color="#1e40af" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Crosswind Calculator</Text>
            <Text style={styles.cardSubtitle}>Practice headwind and crosswind math.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DensityAltitude')}>
          <Ionicons name="analytics-outline" size={24} color="#1e40af" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Density Altitude</Text>
            <Text style={styles.cardSubtitle}>Pressure + density altitude estimates.</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.cta}>
        <Text style={styles.ctaTitle}>Ready to start training?</Text>
        <Text style={styles.ctaSubtitle}>Find a flight school near you.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={goToFlightSchools}>
          <Text style={styles.primaryButtonText}>Find Flight Schools</Text>
        </TouchableOpacity>
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
  cta: { padding: spacing.lg, backgroundColor: colors.surface, margin: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  ctaTitle: { ...typography.h3 },
  ctaSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  primaryButton: { marginTop: spacing.sm, backgroundColor: colors.primary, padding: spacing.sm, borderRadius: radius.md, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
});
