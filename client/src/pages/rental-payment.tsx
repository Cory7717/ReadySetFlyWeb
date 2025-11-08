import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Rental, AircraftListing } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plane, Calendar, Clock } from "lucide-react";

declare global {
  interface Window {
    paypal: any;
  }
}

function CheckoutForm({ rental, aircraft, onSuccess }: { rental: Rental; aircraft: AircraftListing; onSuccess: () => void }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [paypalConfig, setPaypalConfig] = useState<{ clientId: string; environment: string } | null>(null);
  const cardFieldsRef = useRef<any>(null);
  const { toast } = useToast();

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
            const response = await fetch('/api/paypal/create-order-rental', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                amount: parseFloat(rental.totalCostRenter),
                rentalId: rental.id
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

              // Verify payment and activate rental
              const completeResponse = await fetch(`/api/rentals/${rental.id}/complete-payment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ transactionId: data.orderID }),
              });

              if (!completeResponse.ok) {
                throw new Error("Failed to complete rental");
              }

              toast({
                title: "Payment successful!",
                description: "Your rental is now active. Safe flying!",
              });
              
              onSuccess();
            } catch (err: any) {
              toast({
                title: "Payment failed",
                description: err.message || "Please try again",
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
  }, [paypalConfig, rental.id, rental.totalCostRenter]);

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
        disabled={!isReady || isProcessing}
        className="w-full bg-accent text-accent-foreground hover:bg-accent"
        size="lg"
        data-testid="button-submit-payment"
      >
        {isProcessing ? "Processing..." : `Pay $${parseFloat(rental.totalCostRenter).toFixed(2)}`}
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
}

export default function RentalPayment() {
  const [, params] = useRoute("/rental-payment/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: rental } = useQuery<Rental>({
    queryKey: ["/api/rentals", params?.id],
    queryFn: async () => {
      const response = await fetch(`/api/rentals/${params?.id}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch rental");
      return response.json();
    },
    enabled: !!params?.id,
  });

  const { data: aircraft } = useQuery<AircraftListing>({
    queryKey: ["/api/aircraft", rental?.aircraftId],
    queryFn: async () => {
      const response = await fetch(`/api/aircraft/${rental?.aircraftId}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch aircraft");
      return response.json();
    },
    enabled: !!rental?.aircraftId,
  });

  if (!rental || !aircraft) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading rental details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-4xl font-bold mb-8" data-testid="text-payment-title">
            Complete Your Rental Payment
          </h1>

          <div className="grid gap-6">
            {/* Rental Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Rental Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Plane className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">{aircraft.year} {aircraft.make} {aircraft.model}</p>
                    <p className="text-sm text-muted-foreground">{aircraft.registration}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm">
                      {new Date(rental.startDate).toLocaleDateString()} - {new Date(rental.endDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm">{parseFloat(rental.estimatedHours)} estimated flight hours</p>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Base cost</span>
                    <span>${parseFloat(rental.baseCost).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sales tax (8.25%)</span>
                    <span>${parseFloat(rental.salesTax).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Platform fee (7.5%)</span>
                    <span>${parseFloat(rental.platformFeeRenter).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Processing fee (3%)</span>
                    <span>${parseFloat(rental.processingFee).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span>${parseFloat(rental.totalCostRenter).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Form */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Information</CardTitle>
              </CardHeader>
              <CardContent>
                <CheckoutForm
                  rental={rental}
                  aircraft={aircraft}
                  onSuccess={() => setLocation("/dashboard")}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
