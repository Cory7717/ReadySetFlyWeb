import { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput,
  ActivityIndicator,
  Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';

interface AIDescriptionGeneratorProps {
  listingType: string;
  details: any;
  onDescriptionGenerated: (description: string) => void;
  currentDescription?: string;
}

export function AIDescriptionGenerator({ 
  listingType, 
  details, 
  onDescriptionGenerated,
  currentDescription 
}: AIDescriptionGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showPromptInput, setShowPromptInput] = useState(false);

  const handleGenerateDescription = async () => {
    // Validate required fields based on listing type
    if (!details || Object.keys(details).length === 0) {
      Alert.alert('Missing Information', 'Please fill out the basic details first before generating a description.');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await api.post('/api/generate-description', {
        listingType,
        details: aiPrompt ? { ...details, customPrompt: aiPrompt } : details,
      });

      onDescriptionGenerated(response.data.description);
      setAiPrompt('');
      setShowPromptInput(false);
      Alert.alert('Success!', 'AI-generated description added. Feel free to customize it!');
    } catch (error: any) {
      Alert.alert('Generation Failed', error.message || 'Could not generate description');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="sparkles" size={20} color="#8b5cf6" />
          <Text style={styles.headerText}>AI Description Generator</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowPromptInput(!showPromptInput)}
          style={styles.helpButton}
        >
          <Ionicons 
            name={showPromptInput ? "chevron-up" : "chevron-down"} 
            size={18} 
            color="#6b7280" 
          />
        </TouchableOpacity>
      </View>

      {showPromptInput && (
        <View style={styles.promptContainer}>
          <Text style={styles.promptLabel}>Custom Prompt (Optional)</Text>
          <TextInput
            style={styles.promptInput}
            placeholder="e.g., 'Highlight the aircraft's safety features and modern avionics'"
            value={aiPrompt}
            onChangeText={setAiPrompt}
            multiline
            numberOfLines={3}
          />
          <Text style={styles.promptHelp}>
            Provide specific details you'd like to emphasize in the description
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.generateButton,
          isGenerating && styles.generateButtonDisabled
        ]}
        onPress={handleGenerateDescription}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <>
            <ActivityIndicator color="#ffffff" size="small" style={styles.spinner} />
            <Text style={styles.generateButtonText}>Generating...</Text>
          </>
        ) : (
          <>
            <Ionicons name="sparkles" size={20} color="#ffffff" />
            <Text style={styles.generateButtonText}>
              {currentDescription ? 'Regenerate' : 'Generate'} with AI
            </Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        AI-generated content should be reviewed and customized before publishing
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  helpButton: {
    padding: 4,
  },
  promptContainer: {
    marginBottom: 12,
  },
  promptLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  promptInput: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  promptHelp: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  generateButton: {
    backgroundColor: '#8b5cf6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  spinner: {
    marginRight: 4,
  },
  disclaimer: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
