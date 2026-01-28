import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const TOPICS = [
  {
    id: 'wx',
    title: 'Aviation Weather',
    summary: 'METAR/TAF basics, ceiling/visibility, and go/no-go decisions.',
    question: 'Which condition indicates MVFR?',
    choices: ['Ceiling 3500 ft and 6 SM', 'Ceiling 1500 ft and 4 SM', 'Ceiling 300 ft and 1/2 SM'],
    answer: 1,
  },
  {
    id: 'airspace',
    title: 'Airspace Basics',
    summary: 'Class B/C/D entry requirements and VFR weather minimums.',
    question: 'Which equipment is required to enter Class C?',
    choices: ['Two-way radio and Mode C', 'Only a handheld radio', 'ELT only'],
    answer: 0,
  },
  {
    id: 'nav',
    title: 'Navigation',
    summary: 'Pilotage, dead reckoning, and VOR basics.',
    question: 'Which nav method uses landmarks?',
    choices: ['Pilotage', 'Dead reckoning', 'GPS RAIM'],
    answer: 0,
  },
];

export default function StudentWrittenScreen() {
  const [selected, setSelected] = useState<string | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  const topic = TOPICS.find((t) => t.id === selected) || null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Written Test Prep</Text>
      <Text style={styles.subtitle}>FAA-aligned mini modules and quick quizzes.</Text>

      <View style={styles.card}>
        {TOPICS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.topicItem, selected === item.id && styles.topicItemActive]}
            onPress={() => {
              setSelected(item.id);
              setChoice(null);
              setShowResult(false);
            }}
          >
            <Text style={styles.topicTitle}>{item.title}</Text>
            <Text style={styles.topicSummary}>{item.summary}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {topic && (
        <View style={styles.card}>
          <Text style={styles.questionTitle}>{topic.question}</Text>
          {topic.choices.map((option, index) => {
            const isSelected = choice === index;
            const isCorrect = showResult && index === topic.answer;
            const isIncorrect = showResult && isSelected && index !== topic.answer;
            return (
              <TouchableOpacity
                key={option}
                style={[
                  styles.choice,
                  isSelected && styles.choiceSelected,
                  isCorrect && styles.choiceCorrect,
                  isIncorrect && styles.choiceIncorrect,
                ]}
                onPress={() => setChoice(index)}
              >
                <Text style={styles.choiceText}>{option}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setShowResult(true)}
            disabled={choice === null}
          >
            <Text style={styles.primaryButtonText}>Check Answer</Text>
          </TouchableOpacity>
          {showResult && (
            <Text style={styles.resultText}>
              {choice === topic.answer ? 'Correct!' : `Correct answer: ${topic.choices[topic.answer]}`}
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { marginTop: 4, color: '#6b7280', marginBottom: 12 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12 },
  topicItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  topicItemActive: { backgroundColor: '#eef2ff' },
  topicTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  topicSummary: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  questionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  choice: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
  choiceSelected: { borderColor: '#1e40af' },
  choiceCorrect: { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
  choiceIncorrect: { backgroundColor: '#fee2e2', borderColor: '#ef4444' },
  choiceText: { fontSize: 12, color: '#111827' },
  primaryButton: { backgroundColor: '#1e40af', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 6 },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  resultText: { marginTop: 8, color: '#111827', fontSize: 12 },
});
