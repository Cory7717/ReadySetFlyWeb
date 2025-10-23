import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { useLocation, useRoute, useRouter } from 'wouter';
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ArrowLeft, CheckCircle } from 'lucide-react';

// Initialize Stripe (from blueprint:javascript_stripe)
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

// Tier pricing (matching replit.md specs)
const TIER_PRICING: Record<string, number> = {
  basic: 25,
  standard: 100,
  premium: 250,
};

interface CheckoutFormProps {
  onSuccess: () => void;
}

const CheckoutForm = ({ onSuccess }: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/marketplace`,
        },
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Payment Successful",
          description: "Your listing is being created!",
        });
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Payment Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button
        type="submit"
        size="lg"
        className="w-full bg-accent text-accent-foreground hover:bg-accent"
        disabled={!stripe || isProcessing}
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
  const [clientSecret, setClientSecret] = useState("");
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

    // Create payment intent (server calculates amount)
    apiRequest("POST", "/api/create-listing-payment-intent", {
      category: data.category,
      tier: data.tier,
      listingData: data,
    })
      .then((res) => res.json())
      .then((result) => {
        setClientSecret(result.clientSecret);
        // Update amount from server (server-side pricing)
        if (result.amount) {
          const updatedData = { ...data, serverAmount: result.amount, paymentIntentId: result.paymentIntentId };
          setListingData(updatedData);
          localStorage.setItem('pendingListingData', JSON.stringify(updatedData));
        }
      })
      .catch((error) => {
        toast({
          title: "Payment Setup Failed",
          description: error.message || "Could not initialize payment",
          variant: "destructive",
        });
        navigate("/create-marketplace-listing");
      });
  }, [navigate, toast]);

  const handlePaymentSuccess = async () => {
    if (!listingData || !listingData.paymentIntentId) return;

    try {
      // Create the listing with payment verification
      const listingPayload = {
        ...listingData,
        paymentIntentId: listingData.paymentIntentId, // Backend will verify payment status
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

  if (!clientSecret || !listingData) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
        </div>
      </div>
    );
  }

  // Use server-calculated amount if available, otherwise calculate client-side as fallback
  const amount = listingData.serverAmount || 
    (listingData.category === 'aircraft-sale' && listingData.tier
      ? TIER_PRICING[listingData.tier] || 25
      : 25);

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
            Secure payment powered by Stripe
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
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm onSuccess={handlePaymentSuccess} />
          </Elements>

          <p className="text-xs text-muted-foreground text-center">
            Your payment information is securely processed by Stripe. We never store your card details.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
