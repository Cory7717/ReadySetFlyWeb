import { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Alert,
  ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PromoCodeInput } from '../components/PromoCodeInput';
import { apiEndpoints } from '../services/api';

const categories = [
  { id: 'aircraft-sale', label: 'Aircraft for Sale', icon: 'airplane', color: '#7c3aed' },
  { id: 'job', label: 'Aviation Jobs', icon: 'briefcase', color: '#1e40af' },
  { id: 'cfi', label: 'CFI Services', icon: 'school', color: '#0891b2' },
  { id: 'flight-school', label: 'Flight School', icon: 'business', color: '#059669' },
  { id: 'mechanic', label: 'Mechanic Services', icon: 'construct', color: '#dc2626' },
  { id: 'charter', label: 'Charter Services', icon: 'business-outline', color: '#ea580c' },
];

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

export default function CreateMarketplaceListingScreen({ navigation }: any) {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState('');
  const [tier, setTier] = useState('basic');
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscountType, setPromoDiscountType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Base fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [price, setPrice] = useState('');

  // Category-specific fields
  const [details, setDetails] = useState<any>({});

  const selectedCategory = categories.find(c => c.id === category);
  const selectedTier = tiers.find(t => t.id === tier);

  const handleNext = () => {
    if (step === 1 && !category) {
      Alert.alert('Required', 'Please select a category');
      return;
    }
    if (step === 2) {
      if (!title.trim()) {
        Alert.alert('Required', 'Please enter a title');
        return;
      }
      if (!description.trim() || description.length < 20) {
        Alert.alert('Required', 'Description must be at least 20 characters');
        return;
      }
      if (!contactEmail.trim()) {
        Alert.alert('Required', 'Contact email is required');
        return;
      }
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  const handlePromoCodeValidated = (code: string, discountType: string) => {
    setPromoCode(code);
    setPromoDiscountType(discountType);
  };

  const handleSubmit = async () => {
    if (promoDiscountType === 'free_7_day') {
      // Submit listing with promo code - no payment needed
      await submitListing(promoCode);
    } else {
      // Navigate to payment screen
      navigation.navigate('MarketplacePayment', {
        amount: selectedTier?.price || 25,
        listingData: {
          category,
          title,
          description,
          location,
          city,
          state,
          zipCode,
          contactEmail,
          contactPhone,
          price,
          tier,
          details,
        },
      });
    }
  };

  const submitListing = async (promoCodeToUse?: string) => {
    setIsSubmitting(true);
    try {
      const listingData = {
        category,
        title,
        description,
        location,
        city,
        state,
        zipCode,
        contactEmail,
        contactPhone,
        price,
        tier,
        details,
        promoCode: promoCodeToUse,
        monthlyFee: selectedTier?.price.toString() || '25',
        isActive: true,
        images: [],
      };

      await apiEndpoints.marketplace.create(listingData);
      
      Alert.alert(
        'Success!',
        'Your listing has been created and is now live.',
        [{ text: 'OK', onPress: () => navigation.navigate('Marketplace') }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create listing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3, 4, 5].map((s) => (
        <View key={s} style={[styles.stepDot, s <= step && styles.stepDotActive]} />
      ))}
    </View>
  );

  const renderCategorySelection = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Select Category</Text>
      <Text style={styles.stepSubtitle}>Choose the type of listing you want to create</Text>
      
      {categories.map((cat) => (
        <TouchableOpacity
          key={cat.id}
          style={[
            styles.categoryCard,
            category === cat.id && styles.categoryCardSelected,
            { borderLeftColor: cat.color }
          ]}
          onPress={() => setCategory(cat.id)}
          data-testid={`button-category-${cat.id}`}
        >
          <View style={[styles.categoryIcon, { backgroundColor: cat.color + '20' }]}>
            <Ionicons name={cat.icon as any} size={28} color={cat.color} />
          </View>
          <Text style={styles.categoryLabel}>{cat.label}</Text>
          {category === cat.id && (
            <Ionicons name="checkmark-circle" size={24} color={cat.color} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderBaseFields = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Basic Information</Text>
      
      <Text style={styles.label}>Title *</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Enter a descriptive title"
        data-testid="input-title"
      />

      <Text style={styles.label}>Description *</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Provide detailed information (minimum 20 characters)"
        multiline
        numberOfLines={4}
        data-testid="input-description"
      />

      <Text style={styles.label}>City</Text>
      <TextInput
        style={styles.input}
        value={city}
        onChangeText={setCity}
        placeholder="City"
        data-testid="input-city"
      />

      <Text style={styles.label}>State</Text>
      <TextInput
        style={styles.input}
        value={state}
        onChangeText={setState}
        placeholder="State"
        data-testid="input-state"
      />

      <Text style={styles.label}>Price</Text>
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={setPrice}
        placeholder="Enter price (optional)"
        keyboardType="numeric"
        data-testid="input-price"
      />

      <Text style={styles.label}>Contact Email *</Text>
      <TextInput
        style={styles.input}
        value={contactEmail}
        onChangeText={setContactEmail}
        placeholder="your@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        data-testid="input-contact-email"
      />

      <Text style={styles.label}>Contact Phone</Text>
      <TextInput
        style={styles.input}
        value={contactPhone}
        onChangeText={setContactPhone}
        placeholder="(555) 123-4567"
        keyboardType="phone-pad"
        data-testid="input-contact-phone"
      />
    </View>
  );

  const renderCategoryFields = () => {
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Additional Details</Text>
        <Text style={styles.stepSubtitle}>
          Category-specific information will be added here
        </Text>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#1e40af" />
          <Text style={styles.infoText}>
            Additional fields for {selectedCategory?.label} coming soon. You can proceed to create your listing.
          </Text>
        </View>
      </View>
    );
  };

  const renderTierSelection = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Select Listing Tier</Text>
      <Text style={styles.stepSubtitle}>Choose the visibility level for your listing</Text>
      
      {tiers.map((t) => (
        <TouchableOpacity
          key={t.id}
          style={[
            styles.tierCard,
            tier === t.id && styles.tierCardSelected
          ]}
          onPress={() => setTier(t.id)}
          data-testid={`button-tier-${t.id}`}
        >
          <View style={styles.tierHeader}>
            <View>
              <Text style={styles.tierLabel}>{t.label}</Text>
              <Text style={styles.tierPrice}>${t.price}/month</Text>
            </View>
            {tier === t.id && (
              <Ionicons name="checkmark-circle" size={28} color="#059669" />
            )}
          </View>
          <Text style={styles.tierDescription}>{t.description}</Text>
          {t.features.map((feature, idx) => (
            <View key={idx} style={styles.tierFeature}>
              <Ionicons name="checkmark" size={16} color="#059669" />
              <Text style={styles.tierFeatureText}>{feature}</Text>
            </View>
          ))}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderPromoCode = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Promo Code</Text>
      <Text style={styles.stepSubtitle}>Have a promotional code? Apply it here to get discounts!</Text>
      
      <PromoCodeInput 
        category={category} 
        onValidCode={handlePromoCodeValidated}
      />

      <View style={styles.pricingSummary}>
        <Text style={styles.pricingLabel}>Selected Tier:</Text>
        <Text style={styles.pricingValue}>{selectedTier?.label}</Text>
        
        <Text style={styles.pricingLabel}>Monthly Fee:</Text>
        <Text style={styles.pricingValue}>
          {promoDiscountType === 'free_7_day' ? (
            <Text style={styles.discountedPrice}>
              FREE (7 days) <Text style={styles.strikethrough}>${selectedTier?.price}</Text>
            </Text>
          ) : (
            `$${selectedTier?.price}`
          )}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} data-testid="button-back">
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Listing</Text>
        <View style={{ width: 24 }} />
      </View>

      {renderStepIndicator()}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {step === 1 && renderCategorySelection()}
        {step === 2 && renderBaseFields()}
        {step === 3 && renderCategoryFields()}
        {step === 4 && renderTierSelection()}
        {step === 5 && renderPromoCode()}
      </ScrollView>

      <View style={styles.footer}>
        {step < 5 ? (
          <TouchableOpacity 
            style={styles.nextButton} 
            onPress={handleNext}
            data-testid="button-next"
          >
            <Text style={styles.nextButtonText}>Next</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.submitButton} 
            onPress={handleSubmit}
            disabled={isSubmitting}
            data-testid="button-submit"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>
                  {promoDiscountType === 'free_7_day' ? 'Create Free Listing' : 'Proceed to Payment'}
                </Text>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
    backgroundColor: '#fff',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d1d5db',
  },
  stepDotActive: {
    backgroundColor: '#1e40af',
    width: 24,
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    padding: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryCardSelected: {
    borderWidth: 2,
    borderColor: '#1e40af',
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#1f2937',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#dbeafe',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    marginLeft: 12,
    lineHeight: 20,
  },
  tierCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  tierCardSelected: {
    borderColor: '#059669',
    backgroundColor: '#f0fdf4',
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tierLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  tierPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginTop: 4,
  },
  tierDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  tierFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  tierFeatureText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  pricingSummary: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
  },
  pricingLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  pricingValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  discountedPrice: {
    color: '#059669',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  nextButton: {
    flexDirection: 'row',
    backgroundColor: '#1e40af',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#059669',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
