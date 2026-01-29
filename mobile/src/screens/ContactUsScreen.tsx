import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
      <Text style={styles.title}>Contact Ready Set Fly</Text>
      <Text style={styles.subtitle}>We reply quickly. Please share details so we can help.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Cory Armer" />
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@email.com" autoCapitalize="none" keyboardType="email-address" />
        <Text style={styles.label}>Topic</Text>
        <View style={styles.pillRow}>
          {topics.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.pill, topic === item && styles.pillActive]}
              onPress={() => setTopic(item)}
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
          multiline
        />
        <TouchableOpacity style={[styles.button, isSending && styles.buttonDisabled]} onPress={handleSubmit} disabled={isSending}>
          <Text style={styles.buttonText}>{isSending ? 'Sending…' : 'Send message'}</Text>
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
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  label: { fontSize: 12, fontWeight: '600', color: colors.text, marginTop: spacing.sm },
  input: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginTop: spacing.xs },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  pill: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 6, backgroundColor: colors.surfaceMuted },
  pillActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  pillText: { fontSize: 12, color: colors.textMuted },
  pillTextActive: { color: colors.primary, fontWeight: '600' },
  button: { marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
