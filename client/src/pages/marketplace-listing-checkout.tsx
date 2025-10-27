import { useEffect, useState, useRef } from 'react';
import { useLocation, useRoute, useRouter } from 'wouter';
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

declare global {
  interface Window {
    braintree: any;
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
  const [dropinInstance, setDropinInstance] = useState<any>(null);
  const dropinContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadBraintreeAndInitialize = async () => {
      // Load Braintree scripts if not already loaded
      if (!window.braintree) {
        const clientScript = document.createElement('script');
        clientScript.src = 'https://js.braintreegateway.com/web/3.101.0/js/client.min.js';
        document.head.appendChild(clientScript);

        const dropinScript = document.createElement('script');
        dropinScript.src = 'https://js.braintreegateway.com/web/dropin/1.43.0/js/dropin.min.js';
        document.head.appendChild(dropinScript);

        await new Promise((resolve) => {
          dropinScript.onload = resolve;
        });
      }

      // Fetch client token from backend
      const response = await fetch('/api/braintree/client-token', {
        credentials: 'include',
      });
      const { clientToken } = await response.json();

      // Create Drop-in UI
      window.braintree.dropin.create({
        authorization: clientToken,
        container: dropinContainerRef.current,
        card: {
          cardholderName: {
            required: true
          }
        }
      }, (createErr: any, instance: any) => {
        if (createErr) {
          console.error('Braintree Drop-in error:', createErr);
          toast({
            title: "Error",
            description: "Failed to initialize payment form",
            variant: "destructive",
          });
          return;
        }
        setDropinInstance(instance);
      });
    };

    loadBraintreeAndInitialize();

    return () => {
      if (dropinInstance) {
        dropinInstance.teardown();
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!dropinInstance) {
      return;
    }

    setIsProcessing(true);

    try {
      // Request payment nonce from Drop-in UI
      const { nonce } = await dropinInstance.requestPaymentMethod();

      // Send nonce to backend for processing
      const response = await fetch('/api/braintree/checkout-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          paymentMethodNonce: nonce,
          category: listingData.category,
          tier: listingData.tier
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Payment failed');
      }

      toast({
        title: "Payment Successful",
        description: "Your listing is being created!",
      });
      
      // Update listing data with transaction ID in localStorage
      const updatedData = { ...listingData, transactionId: result.transactionId };
      localStorage.setItem('pendingListingData', JSON.stringify(updatedData));
      
      // Pass transaction ID to parent component
      onSuccess(result.transactionId);
    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div ref={dropinContainerRef} className="min-h-[300px]"></div>
      <Button
        type="submit"
        size="lg"
        className="w-full bg-accent text-accent-foreground hover:bg-accent"
        disabled={!dropinInstance || isProcessing}
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
            Secure payment powered by PayPal Braintree
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
            Your payment information is securely processed by PayPal Braintree. We never store your card details.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
