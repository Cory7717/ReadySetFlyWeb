import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

const topics = [
  'General question',
  'Account support',
  'Marketplace',
  'Billing',
  'Bug report',
  'Other',
];

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export default function ContactUsScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState(topics[0]);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      Alert.alert('Missing info', 'Please fill in name, email, and message.');
      return;
    }
    setIsSending(true);
    try {
      await api.post('/api/contact', {
        name: name.trim(),
        email: email.trim(),
        topic,
        message: message.trim(),
      });
      Alert.alert('Message sent', 'Thanks! We will get back to you soon.');
      setMessage('');
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="mail-outline" size={34} color="#93c5fd" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>CONTACT READY SET FLY</Text>
            <Text style={styles.heroTitle}>Send the team a message with real context.</Text>
            <Text style={styles.heroSubtitle}>
              Use this form for account, billing, marketplace, or product questions so the RSF team can respond with the right next step.
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile label="Support" value="Direct" />
          <SummaryTile label="Topics" value={String(topics.length)} />
          <SummaryTile label="Best use" value="Detailed help" />
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Message details</Text>
        <Text style={styles.sectionSubtitle}>
          Share enough context so the team can respond quickly without going back and forth.
        </Text>

        <View style={styles.sectionContent}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Cory Armer"
            placeholderTextColor={colors.textSoft}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            placeholderTextColor={colors.textSoft}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Topic</Text>
          <View style={styles.pillRow}>
            {topics.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.pill, topic === item && styles.pillActive]}
                onPress={() => setTopic(item)}
                activeOpacity={0.92}
              >
                <Text style={[styles.pillText, topic === item && styles.pillTextActive]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            placeholder="How can we help?"
            placeholderTextColor={colors.textSoft}
            multiline
          />

          <TouchableOpacity
            style={[styles.button, isSending && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSending}
            activeOpacity={0.92}
          >
            <Ionicons name="paper-plane-outline" size={18} color="#fff" />
            <Text style={styles.buttonText}>{isSending ? 'Sending...' : 'Send message'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.sm,
    paddingBottom: 120,
  },
  heroPanel: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.cockpit,
    ...shadow.floating,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  heroIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#93c5fd',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#fff',
    marginTop: 10,
    maxWidth: 320,
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
    maxWidth: 340,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  summaryTile: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#bfdbfe',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginTop: 6,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  sectionTitle: {
    ...typography.h2,
  },
  sectionSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
  sectionContent: {
    marginTop: spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
    marginTop: spacing.xs,
  },
  textArea: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    backgroundColor: colors.surfaceMuted,
  },
  pillActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  pillTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  button: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});
