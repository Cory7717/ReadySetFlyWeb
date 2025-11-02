import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ConfirmDeletionModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmDeletionModal({
  visible,
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDeletionModalProps) {
  const [confirmText, setConfirmText] = useState('');

  const handleConfirm = () => {
    if (confirmText === 'DELETE') {
      onConfirm();
      setConfirmText(''); // Reset for next time
    }
  };

  const handleCancel = () => {
    setConfirmText(''); // Reset on cancel
    onCancel();
  };

  const isConfirmDisabled = confirmText !== 'DELETE' || isLoading;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Ionicons name="warning" size={40} color="#ef4444" />
              </View>
              <Text style={styles.title}>Delete Account</Text>
            </View>

            {/* Warning Message */}
            <View style={styles.messageContainer}>
              <Text style={styles.message}>
                This action cannot be undone. All your data will be permanently deleted:
              </Text>
              <View style={styles.listContainer}>
                <Text style={styles.listItem}>• Aircraft listings</Text>
                <Text style={styles.listItem}>• Marketplace listings</Text>
                <Text style={styles.listItem}>• Rental history</Text>
                <Text style={styles.listItem}>• Messages and conversations</Text>
                <Text style={styles.listItem}>• Verification documents</Text>
                <Text style={styles.listItem}>• Financial records</Text>
              </View>
            </View>

            {/* Confirmation Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                Type <Text style={styles.boldText}>DELETE</Text> to confirm:
              </Text>
              <TextInput
                style={styles.input}
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder="Type DELETE here"
                placeholderTextColor="#9ca3af"
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isLoading}
                data-testid="input-confirm-delete"
              />
            </View>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                disabled={isLoading}
                data-testid="button-cancel-delete"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  isConfirmDisabled && styles.confirmButtonDisabled,
                ]}
                onPress={handleConfirm}
                disabled={isConfirmDisabled}
                data-testid="button-confirm-delete"
              >
                <Text
                  style={[
                    styles.confirmButtonText,
                    isConfirmDisabled && styles.confirmButtonTextDisabled,
                  ]}
                >
                  {isLoading ? 'Deleting...' : 'Delete Account'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  messageContainer: {
    marginBottom: 20,
  },
  message: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
    marginBottom: 12,
  },
  listContainer: {
    paddingLeft: 8,
  },
  listItem: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 4,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#1f2937',
  },
  input: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#fee2e2',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  confirmButtonTextDisabled: {
    color: '#fca5a5',
  },
});
