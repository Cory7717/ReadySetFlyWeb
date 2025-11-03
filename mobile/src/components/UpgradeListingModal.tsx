import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiEndpoints } from '../services/api';

interface UpgradeListingModalProps {
  visible: boolean;
  onClose: () => void;
  listing: any;
  onUpgradeSuccess: () => void;
}

const tiers = [
  { 
    id: 'basic', 
    label: 'Basic', 
    price: 25, 
    description: 'Essential features for smaller listings',
    features: ['30-day listing', 'Basic visibility', 'Up to 3 images'] 
  },
  { 
    id: 'standard', 
    label: 'Standard', 
    price: 100, 
    description: 'Enhanced features for better exposure',
    features: ['30-day listing', 'Enhanced visibility', 'Up to 5 images', 'Featured badge'] 
  },
  { 
    id: 'premium', 
    label: 'Premium', 
    price: 250, 
    description: 'Maximum visibility and features',
    features: ['30-day listing', 'Top placement', 'Up to 10 images', 'Featured badge', 'Priority support'] 
  },
];

export default function UpgradeListingModal({
  visible,
  onClose,
  listing,
  onUpgradeSuccess,
}: UpgradeListingModalProps) {
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [isUpgrading, setIsUpgrading] = useState(false);

  const currentTier = tiers.find(t => t.id === listing?.tier);
  const currentTierIndex = tiers.findIndex(t => t.id === listing?.tier);
  const availableTiers = tiers.filter((_, index) => index > currentTierIndex);

  const selectedTierData = tiers.find(t => t.id === selectedTier);
  const upgradeCost = selectedTierData ? selectedTierData.price - (currentTier?.price || 25) : 0;

  const handleUpgrade = async () => {
    if (!selectedTier) {
      Alert.alert('Select a tier', 'Please select a tier to upgrade to');
      return;
    }

    setIsUpgrading(true);
    try {
      await apiEndpoints.marketplace.upgrade(listing.id, selectedTier);
      Alert.alert(
        'Success!',
        'Your listing has been upgraded successfully!',
        [{ text: 'OK', onPress: () => {
          onUpgradeSuccess();
          onClose();
        }}]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upgrade listing');
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="trending-up" size={24} color="#007AFF" />
              <Text style={styles.headerTitle}>Upgrade Listing</Text>
            </View>
            <TouchableOpacity onPress={onClose} data-testid="button-close-upgrade">
              <Ionicons name="close" size={28} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.currentTierSection}>
              <Text style={styles.sectionTitle}>Current Tier</Text>
              <View style={styles.currentTierBadge}>
                <Text style={styles.currentTierText}>
                  {currentTier?.label} - ${currentTier?.price}/month
                </Text>
              </View>
            </View>

            <View style={styles.tiersSection}>
              <Text style={styles.sectionTitle}>Available Upgrades</Text>
              
              {availableTiers.length === 0 ? (
                <View style={styles.noUpgradesCard}>
                  <Text style={styles.noUpgradesText}>
                    You're already at the highest tier! 🎉
                  </Text>
                </View>
              ) : (
                availableTiers.map((tier) => {
                  const cost = tier.price - (currentTier?.price || 25);
                  const isSelected = selectedTier === tier.id;
                  
                  return (
                    <TouchableOpacity
                      key={tier.id}
                      style={[
                        styles.tierCard,
                        isSelected && styles.tierCardSelected,
                      ]}
                      onPress={() => setSelectedTier(tier.id)}
                      data-testid={`tier-option-${tier.id}`}
                    >
                      <View style={styles.tierHeader}>
                        <View>
                          <Text style={styles.tierTitle}>{tier.label}</Text>
                          <Text style={styles.tierPrice}>${tier.price}/month</Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                        )}
                      </View>
                      
                      <Text style={styles.tierDescription}>{tier.description}</Text>
                      
                      <View style={styles.tierFeatures}>
                        {tier.features.map((feature, idx) => (
                          <View key={idx} style={styles.featureRow}>
                            <Ionicons name="checkmark" size={16} color="#4CAF50" />
                            <Text style={styles.featureText}>{feature}</Text>
                          </View>
                        ))}
                      </View>
                      
                      <View style={styles.tierCostRow}>
                        <Text style={styles.tierCostLabel}>Upgrade cost:</Text>
                        <Text style={styles.tierCostAmount}>${cost}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            {selectedTier && (
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <View>
                    <Text style={styles.summaryTitle}>Upgrade Summary</Text>
                    <Text style={styles.summaryDetails}>
                      {currentTier?.label} → {selectedTierData?.label}
                    </Text>
                  </View>
                  <View style={styles.summaryPriceContainer}>
                    <Text style={styles.summaryPrice}>${upgradeCost}</Text>
                    <Text style={styles.summaryPriceLabel}>one-time upgrade fee</Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={isUpgrading}
              data-testid="button-cancel-upgrade"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.upgradeButton,
                (!selectedTier || isUpgrading) && styles.upgradeButtonDisabled,
              ]}
              onPress={handleUpgrade}
              disabled={!selectedTier || isUpgrading}
              data-testid="button-confirm-upgrade"
            >
              {isUpgrading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  scrollView: {
    padding: 20,
  },
  currentTierSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    color: '#666',
  },
  currentTierBadge: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  currentTierText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tiersSection: {
    marginBottom: 20,
  },
  noUpgradesCard: {
    backgroundColor: '#F2F2F7',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  noUpgradesText: {
    fontSize: 14,
    color: '#666',
  },
  tierCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E5EA',
  },
  tierCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#E8F4FF',
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tierTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  tierPrice: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  tierDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  tierFeatures: {
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  featureText: {
    fontSize: 14,
  },
  tierCostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  tierCostLabel: {
    fontSize: 14,
    color: '#666',
  },
  tierCostAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  summaryPriceContainer: {
    alignItems: 'flex-end',
  },
  summaryPrice: {
    fontSize: 24,
    fontWeight: '700',
  },
  summaryPriceLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  upgradeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  upgradeButtonDisabled: {
    backgroundColor: '#CCC',
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
