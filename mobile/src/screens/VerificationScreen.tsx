import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function VerificationScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.statusCard}>
        <Ionicons name="shield-checkmark" size={64} color="#f59e0b" />
        <Text style={styles.statusTitle}>Verification Pending</Text>
        <Text style={styles.statusDescription}>
          Complete your profile verification to unlock all features
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Required Documents</Text>
        
        <View style={styles.documentItem}>
          <View style={styles.documentLeft}>
            <Ionicons name="document-text-outline" size={24} color="#6b7280" />
            <View style={styles.documentInfo}>
              <Text style={styles.documentName}>Pilot License</Text>
              <Text style={styles.documentStatus}>Not uploaded</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </View>

        <View style={styles.documentItem}>
          <View style={styles.documentLeft}>
            <Ionicons name="medkit-outline" size={24} color="#6b7280" />
            <View style={styles.documentInfo}>
              <Text style={styles.documentName}>Medical Certificate</Text>
              <Text style={styles.documentStatus}>Not uploaded</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </View>

        <View style={styles.documentItem}>
          <View style={styles.documentLeft}>
            <Ionicons name="card-outline" size={24} color="#6b7280" />
            <View style={styles.documentInfo}>
              <Text style={styles.documentName}>Government ID</Text>
              <Text style={styles.documentStatus}>Not uploaded</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </View>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={24} color="#1e40af" />
        <View style={styles.infoText}>
          <Text style={styles.infoTitle}>Why Verification?</Text>
          <Text style={styles.infoDescription}>
            Verification ensures safety and trust in our community. Verified users can book aircraft, list their own planes, and access all platform features.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  statusCard: {
    backgroundColor: '#fff',
    padding: 32,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
  },
  statusDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  documentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  documentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  documentInfo: {
    marginLeft: 12,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  documentStatus: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#dbeafe',
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e3a8a',
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 14,
    color: '#1e3a8a',
    lineHeight: 20,
  },
});
