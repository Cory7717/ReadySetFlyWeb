import { useEffect, useState, useRef } from 'react';
import { useLocation, useRoute, useRouter } from 'wouter';
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

declare global {
  interface Window {
    paypal: any;
  }
}

// Tier pricing (matching replit.md specs)
const TIER_PRICING: Record<string, number> = {
  basic: 25,
  standard: 100,
  premium: 250,
};

interface CheckoutFormProps {
  listingData: any;
  onSuccess: (transactionId: string) => void;
}

const CheckoutForm = ({ listingData, onSuccess }: CheckoutFormProps) => {
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
            const response = await fetch('/api/paypal/create-order-listing', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                category: listingData.category,
                tier: listingData.tier
              })
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
    </form>
  );
};

export default function MarketplaceListingCheckout() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/marketplace/listing/checkout");
  const [listingData, setListingData] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Get listing data from localStorage (passed from create-marketplace-listing page)
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
  }, [navigate, toast]);

  const handlePaymentSuccess = async (transactionId: string) => {
    if (!listingData || !transactionId) return;

    try {
      // Create the listing with payment verification
      const listingPayload = {
        ...listingData,
        paymentIntentId: transactionId, // Backend will verify transaction status
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

  if (!listingData) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
        </div>
      </div>
    );
  }

  // Calculate amount based on category and tier
  const amount = listingData.category === 'aircraft-sale' && listingData.tier
    ? TIER_PRICING[listingData.tier] || 25
    : 25;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/create-marketplace-listing")}
        className="mb-6"
        data-testid="button-back"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Listing
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Complete Your Payment
          </CardTitle>
          <CardDescription>
            Secure payment powered by PayPal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Order Summary */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h3 className="font-semibold">Order Summary</h3>
            <div className="flex justify-between text-sm">
              <span>Listing Type:</span>
              <span className="capitalize">{listingData.category?.replace('-', ' ')}</span>
            </div>
            {listingData.tier && (
              <div className="flex justify-between text-sm">
                <span>Tier:</span>
                <span className="capitalize">{listingData.tier}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold pt-2 border-t">
              <span>Total (Monthly):</span>
              <span>${amount.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Form */}
          <CheckoutForm listingData={listingData} onSuccess={handlePaymentSuccess} />

          <p className="text-xs text-muted-foreground text-center">
            Your payment information is securely processed by PayPal. We never store your card details.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
