import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PromoCodeInput } from '../components/PromoCodeInput';
import { AIDescriptionGenerator } from '../components/AIDescriptionGenerator';
import { apiEndpoints } from '../services/api';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';
import { extractApiErrorMessage } from '../utils/diagnostics';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

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
    features: ['30-day listing', 'Basic visibility', 'Up to 3 images'],
  },
  {
    id: 'standard',
    label: 'Standard',
    price: 100,
    description: 'Enhanced features for better exposure',
    features: ['30-day listing', 'Enhanced visibility', 'Up to 5 images', 'Featured badge'],
  },
  {
    id: 'premium',
    label: 'Premium',
    price: 250,
    description: 'Maximum visibility and features',
    features: ['30-day listing', 'Top placement', 'Up to 10 images', 'Featured badge', 'Priority support'],
  },
];

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textArea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        multiline={multiline}
        numberOfLines={multiline ? 5 : 1}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );
}

function StepDot({ active, complete }: { active: boolean; complete: boolean }) {
  return <View style={[styles.stepDot, active && styles.stepDotActive, complete && styles.stepDotComplete]} />;
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

export default function CreateMarketplaceListingScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState('');
  const [tier, setTier] = useState('basic');
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscountType, setPromoDiscountType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [price, setPrice] = useState('');
  const [details, setDetails] = useState<any>({});

  const selectedCategory = categories.find((c) => c.id === category);
  const selectedTier = tiers.find((t) => t.id === tier);

  const aiDetails = useMemo(
    () => ({
      title,
      category: selectedCategory?.label,
      price,
      city,
      state,
      ...details,
    }),
    [title, selectedCategory, price, city, state, details]
  );

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

    setStep((current) => current + 1);
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((current) => current - 1);
    } else {
      navigation.goBack();
    }
  };

  const handlePromoCodeValidated = (code: string, discountType: string) => {
    setPromoCode(code);
    setPromoDiscountType(discountType);
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

      Alert.alert('Success!', 'Your listing has been created and is now live.', [
        { text: 'OK', onPress: () => navigation.navigate('MarketplaceHome') },
      ]);
    } catch (error: any) {
      Alert.alert('Error', extractApiErrorMessage(error, 'Failed to create listing'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (promoDiscountType === 'free_7_day') {
      await submitListing(promoCode);
      return;
    }

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
  };

  const renderCategorySelection = () => (
    <SectionCard
      title="Choose a Listing Type"
      subtitle="Start by picking the marketplace lane that best fits the opportunity."
    >
      <View style={styles.choiceList}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.choiceCard, category === cat.id && styles.choiceCardSelected]}
            onPress={() => setCategory(cat.id)}
            activeOpacity={0.92}
            data-testid={`button-category-${cat.id}`}
          >
            <View style={[styles.choiceIcon, { backgroundColor: `${cat.color}18` }]}>
              <Ionicons name={cat.icon as any} size={24} color={cat.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.choiceTitle}>{cat.label}</Text>
              <Text style={styles.choiceSubtitle}>Create a marketplace listing in this category</Text>
            </View>
            {category === cat.id ? <Ionicons name="checkmark-circle" size={22} color={cat.color} /> : null}
          </TouchableOpacity>
        ))}
      </View>
    </SectionCard>
  );

  const renderBaseFields = () => (
    <SectionCard
      title="Listing Details"
      subtitle="Build the seller-facing listing with enough detail to make the next action obvious."
    >
      <Field
        label="Title *"
        value={title}
        onChangeText={setTitle}
        placeholder="Enter a descriptive listing title"
      />

      <Field
        label="Description *"
        value={description}
        onChangeText={setDescription}
        placeholder="Provide detailed information about the listing"
        multiline
      />

      <AIDescriptionGenerator
        listingType={category}
        details={aiDetails}
        onDescriptionGenerated={setDescription}
        currentDescription={description}
      />

      <Field label="Location" value={location} onChangeText={setLocation} placeholder="Airport, city, or region" />
      <Field label="City" value={city} onChangeText={setCity} placeholder="City" />
      <Field label="State" value={state} onChangeText={setState} placeholder="State" />
      <Field label="Zip Code" value={zipCode} onChangeText={setZipCode} placeholder="Zip code" />
      <Field label="Price" value={price} onChangeText={setPrice} placeholder="Optional listing price" keyboardType="numeric" />
      <Field
        label="Contact Email *"
        value={contactEmail}
        onChangeText={setContactEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
      />
      <Field
        label="Contact Phone"
        value={contactPhone}
        onChangeText={setContactPhone}
        placeholder="(555) 123-4567"
        keyboardType="phone-pad"
      />
    </SectionCard>
  );

  const renderCategoryFields = () => (
    <SectionCard
      title="Category Details"
      subtitle="This is where deeper, category-specific listing fields will continue to expand."
    >
      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
        <Text style={styles.infoText}>
          Additional structured fields for {selectedCategory?.label || 'this category'} are staged next. You can continue with the current listing flow now.
        </Text>
      </View>
    </SectionCard>
  );

  const renderTierSelection = () => (
    <SectionCard
      title="Choose a Listing Tier"
      subtitle="Pick the exposure level that fits the seriousness of this listing."
    >
      <View style={styles.choiceList}>
        {tiers.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.tierCard, tier === option.id && styles.tierCardSelected]}
            onPress={() => setTier(option.id)}
            activeOpacity={0.92}
            data-testid={`button-tier-${option.id}`}
          >
            <View style={styles.tierHeader}>
              <View>
                <Text style={styles.tierTitle}>{option.label}</Text>
                <Text style={styles.tierPrice}>${option.price}/month</Text>
              </View>
              {tier === option.id ? <Ionicons name="checkmark-circle" size={24} color={colors.accent} /> : null}
            </View>
            <Text style={styles.tierDescription}>{option.description}</Text>
            {option.features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Ionicons name="checkmark" size={14} color={colors.accent} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </TouchableOpacity>
        ))}
      </View>
    </SectionCard>
  );

  const renderPromoCode = () => (
    <SectionCard
      title="Promo & Launch"
      subtitle="Apply a valid promotion or continue to payment with the selected listing tier."
    >
      <PromoCodeInput category={category} onValidCode={handlePromoCodeValidated} />

      <View style={styles.pricingCard}>
        <Text style={styles.pricingTitle}>Listing summary</Text>
        <View style={styles.pricingRow}>
          <Text style={styles.pricingLabel}>Category</Text>
          <Text style={styles.pricingValue}>{selectedCategory?.label || 'Not selected'}</Text>
        </View>
        <View style={styles.pricingRow}>
          <Text style={styles.pricingLabel}>Tier</Text>
          <Text style={styles.pricingValue}>{selectedTier?.label || 'Basic'}</Text>
        </View>
        <View style={styles.pricingRow}>
          <Text style={styles.pricingLabel}>Monthly fee</Text>
          <Text style={styles.pricingValue}>
            {promoDiscountType === 'free_7_day' ? 'FREE (7 days)' : `$${selectedTier?.price || 25}`}
          </Text>
        </View>
      </View>
    </SectionCard>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
    >
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.92} data-testid="button-back">
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>CREATE LISTING</Text>
            <Text style={styles.heroTitle}>Launch a stronger marketplace listing with a cleaner guided workflow.</Text>
            <Text style={styles.heroSubtitle}>
              Move from category to details to listing tier without dropping context.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Step {step} / 5</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile label="Category" value={selectedCategory?.label || 'Pick one'} />
          <SummaryTile label="Tier" value={selectedTier?.label || 'Basic'} />
          <SummaryTile label="Launch" value={step === 5 ? 'Ready' : 'In progress'} />
        </View>

        <View style={styles.stepIndicator}>
          {[1, 2, 3, 4, 5].map((currentStep) => (
            <StepDot key={currentStep} active={currentStep === step} complete={currentStep < step} />
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentInner, { paddingBottom: 140 + insets.bottom + tabBarHeight }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && renderCategorySelection()}
        {step === 2 && renderBaseFields()}
        {step === 3 && renderCategoryFields()}
        {step === 4 && renderTierSelection()}
        {step === 5 && renderPromoCode()}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + tabBarHeight, spacing.sm) + spacing.xs }]}>
        {step < 5 ? (
          <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.92} data-testid="button-next">
            <Text style={styles.nextButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.92}
            data-testid="button-submit"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>
                  {promoDiscountType === 'free_7_day' ? 'Create Free Listing' : 'Proceed to Payment'}
                </Text>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  heroPanel: {
    margin: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.cockpit,
    ...shadow.floating,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#93c5fd',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: '#fff',
    marginTop: 10,
    maxWidth: 250,
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
    maxWidth: 290,
  },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
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
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.lg,
  },
  stepDot: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  stepDotActive: {
    backgroundColor: '#93c5fd',
  },
  stepDotComplete: {
    backgroundColor: colors.accent,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: spacing.sm,
    paddingBottom: 120,
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
  choiceList: {
    gap: spacing.sm,
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
  },
  choiceCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  choiceIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  choiceSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
  fieldBlock: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceTinted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  infoText: {
    ...typography.body,
    color: colors.primary,
    flex: 1,
  },
  tierCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
  },
  tierCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  tierTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  tierPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.accent,
    marginTop: 4,
  },
  tierDescription: {
    ...typography.muted,
    marginTop: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  featureText: {
    fontSize: 13,
    color: colors.text,
  },
  pricingCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  pricingTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  pricingLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  pricingValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  footer: {
    padding: spacing.sm,
    backgroundColor: colors.background,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.xl,
    ...shadow.floating,
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: radius.xl,
    ...shadow.floating,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});
