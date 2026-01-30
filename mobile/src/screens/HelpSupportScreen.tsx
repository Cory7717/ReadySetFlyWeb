import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

export default function HelpSupportScreen({ navigation }: any) {
  const handleOpenPrivacyPolicy = () => {
    Linking.openURL('https://readysetfly.us/privacy-policy');
  };

  const handleOpenTerms = () => {
    Linking.openURL('https://readysetfly.us/terms-of-service');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Help & Support</Text>
      <Text style={styles.subtitle}>Find answers or contact the Ready Set Fly team.</Text>

      <View style={styles.card}>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('FAQ')}>
          <Ionicons name="chatbox-ellipses-outline" size={22} color={colors.primary} />
          <Text style={styles.menuText}>FAQ</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('ContactUs')}>
          <Ionicons name="mail-outline" size={22} color={colors.primary} />
          <Text style={styles.menuText}>Contact Us</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('ReceiverHelp')}>
          <Ionicons name="help-circle-outline" size={22} color={colors.primary} />
          <Text style={styles.menuText}>ADS-B Receiver Help</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={handleOpenPrivacyPolicy}>
          <Ionicons name="shield-outline" size={22} color={colors.primary} />
          <Text style={styles.menuText}>Privacy Policy</Text>
          <Ionicons name="open-outline" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={handleOpenTerms}>
          <Ionicons name="document-text-outline" size={22} color={colors.primary} />
          <Text style={styles.menuText}>Terms of Service</Text>
          <Ionicons name="open-outline" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  title: { ...typography.h2 },
  subtitle: { color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    ...shadow.card,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuText: { flex: 1, marginLeft: spacing.sm, fontSize: 14, color: colors.text },
});
