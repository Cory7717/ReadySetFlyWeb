import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiEndpoints } from '../services/api';

interface PromoCodeInputProps {
  category?: string;
  onValidCode?: (code: string, discountType: string) => void;
}

export function PromoCodeInput({ category, onValidCode }: PromoCodeInputProps) {
  const [promoCode, setPromoCode] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    description?: string;
    message?: string;
  } | null>(null);

  const checkPromoCode = async () => {
    if (!promoCode.trim()) {
      setValidationResult(null);
      return;
    }

    setIsChecking(true);
    try {
      const response = await apiEndpoints.promoCodes.validate({
        code: promoCode,
        category,
      });

      setValidationResult(response.data);

      if (response.data.valid && response.data.discountType && onValidCode) {
        onValidCode(promoCode, response.data.discountType);
      }
    } catch (error) {
      setValidationResult({
        valid: false,
        message: 'Failed to validate promo code',
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Promo Code (Optional)</Text>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={promoCode}
          onChangeText={(text) => {
            setPromoCode(text.toUpperCase());
            setValidationResult(null);
          }}
          placeholder="Enter promo code"
          placeholderTextColor="#9ca3af"
          autoCapitalize="characters"
          autoCorrect={false}
          data-testid="input-promo-code"
        />
        
        <TouchableOpacity
          style={[styles.checkButton, !promoCode.trim() && styles.checkButtonDisabled]}
          onPress={checkPromoCode}
          disabled={!promoCode.trim() || isChecking}
          data-testid="button-check-promo"
        >
          {isChecking ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.checkButtonText}>Apply</Text>
          )}
        </TouchableOpacity>
      </View>

      {validationResult && (
        <View style={[
          styles.validationMessage,
          validationResult.valid ? styles.validMessage : styles.invalidMessage
        ]}>
          <Ionicons
            name={validationResult.valid ? 'checkmark-circle' : 'close-circle'}
            size={16}
            color={validationResult.valid ? '#059669' : '#dc2626'}
          />
          <Text style={[
            styles.validationText,
            validationResult.valid ? styles.validText : styles.invalidText
          ]}>
            {validationResult.valid
              ? validationResult.description || 'Valid promo code!'
              : validationResult.message || 'Invalid promo code'
            }
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    backgroundColor: '#f9fafb',
  },
  checkButton: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  checkButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  checkButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  validationMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
  },
  validMessage: {
    backgroundColor: '#d1fae5',
  },
  invalidMessage: {
    backgroundColor: '#fee2e2',
  },
  validationText: {
    fontSize: 13,
    marginLeft: 6,
  },
  validText: {
    color: '#059669',
  },
  invalidText: {
    color: '#dc2626',
  },
});
