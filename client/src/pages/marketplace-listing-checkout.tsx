import { useEffect, useState, useRef } from 'react';
import { useLocation, useRoute, useRouter } from 'wouter';
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';

declare global {
  interface Window {
    paypal: any;
  }
}

// Category-specific pricing (base price before tax)
const CATEGORY_PRICING: Record<string, Record<string, number> | number> = {
  'aircraft-sale': {
    basic: 25,
    standard: 40,
    premium: 100,
  },
  'charter': 250,
  'cfi': 30,
  'flight-school': 250,
  'mechanic': 40,
  'job': 40,
};

const TAX_RATE = 0.0825; // 8.25% sales tax

// Helper to get base price for a listing
const getBasePrice = (category: string, tier?: string): number => {
  const categoryPricing = CATEGORY_PRICING[category];
  
  if (typeof categoryPricing === 'object' && tier) {
    return categoryPricing[tier] || categoryPricing.basic || 25;
  } else if (typeof categoryPricing === 'number') {
    return categoryPricing;
  }
  return 25; // Default fallback
};

interface CheckoutFormProps {
  listingData: any;
  onSuccess: (transactionId: string) => void;
  isFree: boolean;
  promoCode: string | null;
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
  completionToken: string | null;
  isUpgradeMode?: boolean;
  upgradeContext?: any;
}

const CheckoutForm = ({ listingData, onSuccess, isFree, promoCode, discountAmount, originalAmount, finalAmount, completionToken, isUpgradeMode, upgradeContext }: CheckoutFormProps) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [paypalConfig, setPaypalConfig] = useState<{ clientId: string; environment: string } | null>(null);
  const cardFieldsRef = useRef<any>(null);

  // Fetch PayPal config
  useEffect(() => {
    fetch('/api/paypal/config')
      .then(res => res.json())
      .then(config => setPaypalConfig(config))
      .catch(err => {
        console.error('Failed to fetch PayPal config:', err);
        toast({
          title: "Error",
          description: "Failed to load payment configuration",
          variant: "destructive",
        });
      });
  }, []);

  // Load PayPal SDK and initialize card fields
  useEffect(() => {
    if (!paypalConfig) return;

    const loadPayPalSDK = async () => {
      // Check if already loaded
      if (window.paypal) {
        initializeCardFields();
        return;
      }

      // Load PayPal SDK with card fields and disable Pay Later
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${paypalConfig.clientId}&components=card-fields&disable-funding=paylater`;
      script.async = true;
      
      script.onload = () => {
        initializeCardFields();
      };
      
      script.onerror = () => {
        toast({
          title: "Error",
          description: "Failed to load PayPal SDK",
          variant: "destructive",
        });
      };

      document.head.appendChild(script);
    };

    const initializeCardFields = async () => {
      if (!window.paypal || !window.paypal.CardFields) {
        console.error('PayPal CardFields not available');
        return;
      }

      try {
        const cardFields = window.paypal.CardFields({
          createOrder: async () => {
            // Different endpoint for upgrade vs new listing
            const endpoint = isUpgradeMode 
              ? '/api/paypal/create-order-upgrade'
              : '/api/paypal/create-order-listing';
            
            const body = isUpgradeMode 
              ? {
                  listingId: upgradeContext.listingId,
                  newTier: upgradeContext.newTier,
                }
              : {
                  category: listingData.category,
                  tier: listingData.tier,
                  promoCode: promoCode || null,
                  discountAmount: discountAmount ? discountAmount.toString() : null,
                  finalAmount: finalAmount ? finalAmount.toString() : null,
                };
            
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(body)
            });

            const order = await response.json();
            return order.id;
          },
          onApprove: async (data: any) => {
            setIsProcessing(true);
            try {
              // Capture the payment
              const captureResponse = await fetch(`/api/paypal/capture-order/${data.orderID}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
              });

              const captureData = await captureResponse.json();

              if (!captureResponse.ok || captureData.status !== 'COMPLETED') {
                throw new Error('Payment capture failed');
              }

              toast({
                title: "Payment Successful",
                description: "Your listing is being created!",
              });
              
              // Update listing data with transaction ID in localStorage
              const updatedData = { ...listingData, transactionId: data.orderID };
              localStorage.setItem('pendingListingData', JSON.stringify(updatedData));
              
              // Pass transaction ID to parent component
              onSuccess(data.orderID);
            } catch (error: any) {
              toast({
                title: "Payment Failed",
                description: error.message || "An unexpected error occurred",
                variant: "destructive",
              });
              setIsProcessing(false);
            }
          },
          onError: (err: any) => {
            console.error('PayPal error:', err);
            toast({
              title: "Payment error",
              description: "Please check your card details and try again",
              variant: "destructive",
            });
            setIsProcessing(false);
          }
        });

        // Check if card fields are eligible
        if (cardFields.isEligible()) {
          // Render individual card fields
          const numberField = cardFields.NumberField();
          numberField.render('#card-number-field');

          const expiryField = cardFields.ExpiryField();
          expiryField.render('#card-expiry-field');

          const cvvField = cardFields.CVVField();
          cvvField.render('#card-cvv-field');

          const nameField = cardFields.NameField();
          nameField.render('#card-name-field');

          cardFieldsRef.current = cardFields;
          setIsReady(true);
        } else {
          toast({
            title: "Payment unavailable",
            description: "Card payments are not available at this time",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error initializing card fields:', error);
        toast({
          title: "Error",
          description: "Failed to initialize payment form",
          variant: "destructive",
        });
      }
    };

    loadPayPalSDK();
  }, [paypalConfig, listingData.category, listingData.tier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cardFieldsRef.current) {
      return;
    }

    setIsProcessing(true);

    try {
      await cardFieldsRef.current.submit();
    } catch (err: any) {
      toast({
        title: "Payment failed",
        description: err.message || "Please check your card details and try again",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const handleFreeListing = async () => {
    setIsProcessing(true);
    try {
      const response = await apiRequest("POST", "/api/marketplace/complete-free-listing", {
        completionToken,
        listingData,
      });
      
      toast({
        title: "Success",
        description: "Your free listing has been created!",
      });
      
      // Trigger success callback with a free order indicator
      onSuccess("FREE-ORDER");
    } catch (error: any) {
      toast({
        title: "Failed to create listing",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // If this is a free order, show a different UI
  if (isFree) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200 font-medium">
            🎉 100% Discount Applied!
          </p>
          <p className="text-sm text-green-700 dark:text-green-300 mt-1">
            Your listing is completely free with the applied promo code.
          </p>
        </div>

        <Button
          onClick={handleFreeListing}
          size="lg"
          className="w-full bg-accent text-accent-foreground hover:bg-accent"
          disabled={isProcessing}
          data-testid="button-claim-free-listing"
        >
          {isProcessing ? "Creating Listing..." : "Claim Free Listing"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-4">
        <div>
          <label htmlFor="card-name-field" className="block text-sm font-medium mb-2">
            Cardholder Name
          </label>
          <div id="card-name-field" className="border rounded-md p-3 min-h-[44px]"></div>
        </div>
        
        <div>
          <label htmlFor="card-number-field" className="block text-sm font-medium mb-2">
            Card Number
          </label>
          <div id="card-number-field" className="border rounded-md p-3 min-h-[44px]"></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="card-expiry-field" className="block text-sm font-medium mb-2">
              Expiration Date
            </label>
            <div id="card-expiry-field" className="border rounded-md p-3 min-h-[44px]"></div>
          </div>
          <div>
            <label htmlFor="card-cvv-field" className="block text-sm font-medium mb-2">
              CVV
            </label>
            <div id="card-cvv-field" className="border rounded-md p-3 min-h-[44px]"></div>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full bg-accent text-accent-foreground hover:bg-accent"
        disabled={!isReady || isProcessing}
        data-testid="button-confirm-payment"
      >
        {isProcessing ? "Processing..." : "Confirm Payment"}
      </Button>
      
      <div className="mt-4 p-3 bg-muted rounded-md">
        <p className="text-xs text-center text-muted-foreground">
          🔒 Secure payments processed by <span className="font-semibold">PayPal Business</span>
        </p>
        <p className="text-xs text-center text-muted-foreground mt-1">
          Your payment information is encrypted and never stored on our servers
        </p>
      </div>
    </form>
  );
};

export default function MarketplaceListingCheckout() {
  const [location, navigate] = useLocation();
  const [, params] = useRoute("/marketplace/listing/checkout");
  const [listingData, setListingData] = useState<any>(null);
  const [isUpgradeMode, setIsUpgradeMode] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<any>(null);
  const { toast } = useToast();
  
  // Promo code state
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [finalAmount, setFinalAmount] = useState(0);
  const [completionToken, setCompletionToken] = useState<string | null>(null);
  const [autoAppliedFromListing, setAutoAppliedFromListing] = useState(false);
  const [adminGrant, setAdminGrant] = useState<{ token: string; durationDays?: number } | null>(null);

  useEffect(() => {
    // Check if this is upgrade mode
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    
    if (mode === 'upgrade') {
      setIsUpgradeMode(true);
      
      // Get upgrade context from localStorage
      const storedContext = localStorage.getItem('upgradeContext');
      if (!storedContext) {
        toast({
          title: "Error",
          description: "No upgrade data found. Please try again.",
          variant: "destructive",
        });
        navigate("/my-listings");
        return;
      }
      
      const context = JSON.parse(storedContext);
      setUpgradeContext(context);
      
      // Set initial final amount from upgrade context
      setFinalAmount(context.totalWithTax);
    } else {
      // Regular listing creation flow
      const storedData = localStorage.getItem('pendingListingData');
      if (!storedData) {
        toast({
          title: "Error",
          description: "No listing data found. Please try again.",
          variant: "destructive",
        });
        navigate("/create-marketplace-listing");
        return;
      }

      const data = JSON.parse(storedData);
      setListingData(data);
    }
  }, [navigate, toast]);

  // Auto-apply admin free grant token (admin starts flow from dashboard)
  useEffect(() => {
    if (isUpgradeMode || !listingData) return;
    const storedGrant = localStorage.getItem('adminFreeListingGrant');
    if (!storedGrant) return;
    try {
      const grant = JSON.parse(storedGrant);
      if (!grant?.token) return;

      const baseAmount = getBasePrice(listingData.category, listingData.tier);
      const taxAmount = baseAmount * TAX_RATE;
      const totalAmount = baseAmount + taxAmount;

      setAdminGrant(grant);
      setCompletionToken(grant.token);
      setAppliedPromo({
        code: 'ADMIN-FREE',
        description: `Admin free listing (${grant.durationDays || 30} days)`,
        discountType: 'fixed',
        discountValue: totalAmount.toString(),
      });
      setPromoCode('ADMIN-FREE');
      setDiscountAmount(totalAmount);
      setFinalAmount(0);
      setAutoAppliedFromListing(true);
    } catch (error) {
      console.error('Failed to apply admin free grant:', error);
    }
  }, [isUpgradeMode, listingData]);

  // Auto-apply promo code captured during listing creation so users don't re-enter it
  useEffect(() => {
    if (listingData?.promoCode && !appliedPromo && !autoAppliedFromListing) {
      handleApplyPromo(listingData.promoCode);
      setAutoAppliedFromListing(true);
    }
  }, [listingData?.promoCode, appliedPromo, autoAppliedFromListing]);

  const handlePaymentSuccess = async (transactionId: string) => {
    // UPGRADE MODE: Complete the upgrade
    if (isUpgradeMode && upgradeContext) {
      try {
        await apiRequest("POST", `/api/marketplace/${upgradeContext.listingId}/complete-upgrade`, {
          orderId: transactionId,
          newTier: upgradeContext.newTier,
        });
        
        // Clear upgrade context
        localStorage.removeItem('upgradeContext');
        
        // Invalidate cache
        queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
        queryClient.invalidateQueries({ queryKey: ["/api/marketplace", upgradeContext.listingId] });
        
        toast({
          title: "Upgrade Successful",
          description: "Your listing has been upgraded to " + upgradeContext.newTier + " tier!",
        });
        
        navigate("/my-listings");
      } catch (error: any) {
        toast({
          title: "Upgrade Failed",
          description: error.message || "Could not complete upgrade. Please contact support.",
          variant: "destructive",
        });
      }
      return;
    }
    
    // REGULAR LISTING MODE
    if (!listingData || !transactionId) return;
    
    // Handle free order success differently
    if (transactionId === "FREE-ORDER") {
      // Clear pending data
      localStorage.removeItem('pendingListingData');
      localStorage.removeItem('adminFreeListingGrant');
      setAdminGrant(null);
      
      // Invalidate marketplace cache
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      
      navigate("/marketplace");
      return;
    }

    try {
      // Calculate amounts for promo data
      const baseAmount = getBasePrice(listingData.category, listingData.tier);
      const taxAmount = baseAmount * TAX_RATE;
      const totalAmount = baseAmount + taxAmount;
      
      // Create the listing with payment verification and promo data
      const listingPayload = {
        ...listingData,
        paymentIntentId: transactionId,
        promoCodeUsed: appliedPromo?.code || null,
        discountAmount: discountAmount.toString(),
        originalAmount: totalAmount.toString(),
        finalAmount: (finalAmount || totalAmount).toString(),
      };
      
      await apiRequest("POST", "/api/marketplace", listingPayload);
      
      // Clear pending data
      localStorage.removeItem('pendingListingData');
      
      // Invalidate marketplace cache
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      
      toast({
        title: "Success",
        description: "Your marketplace listing has been created!",
      });
      
      navigate("/marketplace");
    } catch (error: any) {
      toast({
        title: "Listing Creation Failed",
        description: error.message || "Could not create listing. Please contact support.",
        variant: "destructive",
      });
    }
  };

  const handleApplyPromo = async (codeOverride?: string) => {
    setIsApplyingPromo(true);
    setPromoError("");
    if (adminGrant) {
      setPromoError("Admin free grant is applied. Remove it before adding another code.");
      setIsApplyingPromo(false);
      return;
    }
    if (!listingData && !upgradeContext) {
      setPromoError("Listing details not loaded yet");
      setIsApplyingPromo(false);
      return;
    }
    const codeToValidate = (codeOverride ?? promoCode).trim();
    if (!codeToValidate) {
      setPromoError("Please enter a promo code");
      setIsApplyingPromo(false);
      return;
    }
    // Normalize casing to avoid server-side mismatches
    const normalizedCode = codeToValidate.toUpperCase();
    setPromoCode(normalizedCode);
    
    try {
      // Calculate amounts first
      const baseAmount = getBasePrice(listingData.category, listingData.tier);
      const taxAmount = baseAmount * TAX_RATE;
      const totalAmount = baseAmount + taxAmount;
      
      const response = await fetch(`/api/promo-codes/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code: normalizedCode,
          context: "marketplace",
          amount: totalAmount,
        }),
      });
      
      const data = await response.json();
      
      if (!data.valid) {
        throw new Error(data.message || "Invalid promo code");
      }
      
      setAppliedPromo(data);
      
      // Calculate discount based on type
      let discount = 0;
      if (data.discountType === 'percentage') {
        discount = (totalAmount * parseFloat(data.discountValue)) / 100;
      } else if (data.discountType === 'fixed') {
        discount = parseFloat(data.discountValue);
      }
      
      setDiscountAmount(discount);
      const final = Math.max(0, totalAmount - discount);
      setFinalAmount(final);
      
      toast({
        title: "Promo Code Applied",
        description: data.description || "Discount applied successfully!",
      });
    } catch (error: any) {
      setPromoError(error.message);
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode("");
    setDiscountAmount(0);
    setFinalAmount(0);
    setPromoError("");
    setCompletionToken(null);
    if (adminGrant) {
      setAdminGrant(null);
      localStorage.removeItem('adminFreeListingGrant');
    }
  };
  
  // Generate completion token when promo makes order free
  useEffect(() => {
    if (adminGrant) return;
    if (appliedPromo && finalAmount === 0 && listingData) {
      // Generate signed token for free order completion
      const baseAmount = getBasePrice(listingData.category, listingData.tier);
      const taxAmount = baseAmount * TAX_RATE;
      const totalAmount = baseAmount + taxAmount;
      
      // Note: In production, this token generation should happen on the backend
      // For security, we're simulating the pattern here but the actual signing
      // will be validated server-side
      const tokenData = {
        type: 'free-marketplace-listing',
        userId: 'CURRENT_USER', // Will be replaced by server with actual user ID
        promoCode: appliedPromo.code,
        originalAmount: totalAmount.toString(),
        discountAmount: discountAmount.toString(),
        timestamp: Date.now(),
      };
      
      // Create a simple token (server will validate properly)
      const token = btoa(JSON.stringify(tokenData));
      setCompletionToken(token);
    }
  }, [appliedPromo, finalAmount, discountAmount, listingData]);

  // Loading state
  if (!listingData && !upgradeContext) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
        </div>
      </div>
    );
  }

  // Calculate amounts based on mode
  let baseAmount, taxAmount, totalAmount;
  
  if (isUpgradeMode && upgradeContext) {
    // Use upgrade delta from context
    baseAmount = upgradeContext.upgradeDelta;
    taxAmount = baseAmount * TAX_RATE;
    totalAmount = upgradeContext.totalWithTax;
  } else if (listingData) {
    // Regular listing calculation
    baseAmount = getBasePrice(listingData.category, listingData.tier);
    taxAmount = baseAmount * TAX_RATE;
    totalAmount = baseAmount + taxAmount;
  } else {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Button
        variant="ghost"
        onClick={() => navigate(isUpgradeMode ? "/my-listings" : "/create-marketplace-listing")}
        className="mb-6"
        data-testid="button-back"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {isUpgradeMode ? "Back to My Listings" : "Back to Listing"}
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isUpgradeMode ? "Complete Upgrade Payment" : "Complete Your Payment"}
          </CardTitle>
          <CardDescription>
            Secure payment powered by PayPal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Order Summary */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h3 className="font-semibold">{isUpgradeMode ? "Upgrade Summary" : "Order Summary"}</h3>
            
            {isUpgradeMode && upgradeContext ? (
              <>
                <div className="flex justify-between text-sm">
                  <span>Listing:</span>
                  <span className="font-medium">{upgradeContext.listingTitle}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Current Tier:</span>
                  <span className="capitalize">{upgradeContext.currentTier}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>New Tier:</span>
                  <span className="capitalize font-medium text-primary">{upgradeContext.newTier}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span>Upgrade Fee:</span>
                  <span>${baseAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Sales Tax (8.25%):</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                  <span>Total:</span>
                  <span>${totalAmount.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span>Listing Type:</span>
                  <span className="capitalize">{listingData?.category?.replace('-', ' ')}</span>
                </div>
                {listingData?.tier && (
                  <div className="flex justify-between text-sm">
                    <span>Tier:</span>
                    <span className="capitalize">{listingData.tier}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span>Base Price:</span>
                  <span>${baseAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Sales Tax (8.25%):</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                  <span>Total (Monthly):</span>
                  <span>${totalAmount.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          {/* Promo Code Section */}
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <h3 className="font-semibold">Promo Code</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Enter promo code"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                disabled={appliedPromo !== null || adminGrant !== null}
                data-testid="input-promo-code"
              />
              {appliedPromo ? (
                <Button
                  variant="outline"
                  onClick={handleRemovePromo}
                  data-testid="button-remove-promo"
                >
                  Remove
                </Button>
              ) : (
                <Button
                  onClick={() => handleApplyPromo()}
                  disabled={!promoCode || isApplyingPromo}
                  data-testid="button-apply-promo"
                >
                  {isApplyingPromo ? "Applying..." : "Apply"}
                </Button>
              )}
            </div>
            {appliedPromo && (
              <div className="text-sm text-green-600 dark:text-green-400">
                Promo code "{appliedPromo.code}" applied! {appliedPromo.description}
              </div>
            )}
            {adminGrant && (
              <div className="text-sm text-green-600 dark:text-green-400">
                Admin free grant active ({adminGrant.durationDays || 30} days). Checkout will publish without payment.
              </div>
            )}
            {promoError && (
              <div className="text-sm text-destructive">{promoError}</div>
            )}
          </div>

          {/* Updated Total with Discount */}
          {appliedPromo && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Original Total:</span>
                <span className="line-through">${totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                <span>Discount:</span>
                <span>-${discountAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Final Total:</span>
                <span>${finalAmount.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Payment Form */}
          <CheckoutForm 
            listingData={listingData || {}} 
            onSuccess={handlePaymentSuccess}
            isFree={appliedPromo !== null && finalAmount === 0}
            promoCode={appliedPromo?.code || null}
            discountAmount={discountAmount}
            originalAmount={totalAmount}
            finalAmount={finalAmount || totalAmount}
            completionToken={completionToken}
            isUpgradeMode={isUpgradeMode}
            upgradeContext={upgradeContext}
          />

          <p className="text-xs text-muted-foreground text-center">
            Your payment information is securely processed by PayPal. We never store your card details.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
