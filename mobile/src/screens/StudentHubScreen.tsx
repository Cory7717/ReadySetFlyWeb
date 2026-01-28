import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function StudentHubScreen({ navigation }: any) {
  const goToFlightSchools = () => {
    navigation.navigate('Marketplace', {
      screen: 'MarketplaceCategory',
      params: { category: 'Flight Schools' },
    });
  };

  return (
    <ScrollView style={styles.container}>
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
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subtitle: { marginTop: 6, color: '#6b7280' },
  section: { padding: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  cardText: { marginLeft: 12, flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  cta: { padding: 20, backgroundColor: '#fff', margin: 16, borderRadius: 12 },
  ctaTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  ctaSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  primaryButton: { marginTop: 12, backgroundColor: '#1e40af', padding: 12, borderRadius: 10, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
});
