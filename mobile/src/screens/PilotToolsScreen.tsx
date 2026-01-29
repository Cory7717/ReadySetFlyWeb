import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

export default function PilotToolsScreen({ navigation }: any) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Pilot Tools Hub</Text>
        <Text style={styles.subtitle}>
          Flight planning, weather, plates, and training tools built for pilots.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Core Tools</Text>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('FlightPlanner')}
        >
          <Ionicons name="map-outline" size={28} color="#1e40af" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Flight Planner</Text>
            <Text style={styles.cardSubtitle}>Routes, distance, time, and fuel planning.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('ApproachPlates')}
        >
          <Ionicons name="document-text-outline" size={28} color="#1e40af" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Approach Plates</Text>
            <Text style={styles.cardSubtitle}>Search and download FAA approach plates.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Training</Text>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('RadioCommsTrainer')}
        >
          <Ionicons name="radio-outline" size={28} color="#1e40af" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Radio Comms Trainer</Text>
            <Text style={styles.cardSubtitle}>Practice ATC phraseology with scenarios.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('StudentHub')}
        >
          <Ionicons name="school-outline" size={28} color="#1e40af" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Student Pilot Hub</Text>
            <Text style={styles.cardSubtitle}>Wizard, roadmap, and study tools.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Logbook & Ownership</Text>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Logbook')}
        >
          <Ionicons name="book-outline" size={28} color="#1e40af" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Digital Logbook</Text>
            <Text style={styles.cardSubtitle}>Track flights and keep your records.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('OwnershipCost')}
        >
          <Ionicons name="calculator-outline" size={28} color="#1e40af" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Ownership Cost</Text>
            <Text style={styles.cardSubtitle}>Estimate fixed and variable costs.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.lg },
  header: { padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { ...typography.h2 },
  subtitle: { marginTop: spacing.xs, fontSize: 14, color: colors.textMuted },
  section: { padding: spacing.lg, paddingBottom: 0 },
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm },
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
  cardText: { flex: 1, marginLeft: spacing.sm },
  cardTitle: { ...typography.h3 },
  cardSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
});
