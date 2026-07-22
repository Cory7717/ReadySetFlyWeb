import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Rental, AircraftListing } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, Plane, Calendar, Clock } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

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
                body: JSON.stringify({ orderId: data.orderID }),
              });

              if (!completeResponse.ok) {
                throw new Error("Failed to complete rental");
              }

              toast({
                title: "Payment successful!",
                description: "Your rental is now active. Safe flying!",
              });

              trackEvent("purchase", {
                transaction_id: data.orderID,
                value: Number(parseFloat(rental.totalCostRenter).toFixed(2)),
                currency: "USD",
                item_category: "rental_aircraft",
                item_id: rental.aircraftId,
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
    trackEvent("add_payment_info", {
      item_category: "rental_aircraft",
      item_id: rental.aircraftId,
      value: Number(parseFloat(rental.totalCostRenter).toFixed(2)),
      currency: "USD",
    });

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
          <div id="card-name-field" className="min-h-[44px] rounded-md border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(18,22,28,0.98),rgba(9,12,16,0.99))] p-3"></div>
        </div>
        
        <div>
          <label htmlFor="card-number-field" className="block text-sm font-medium mb-2">
            Card Number
          </label>
          <div id="card-number-field" className="min-h-[44px] rounded-md border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(18,22,28,0.98),rgba(9,12,16,0.99))] p-3"></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="card-expiry-field" className="block text-sm font-medium mb-2">
              Expiration Date
            </label>
            <div id="card-expiry-field" className="min-h-[44px] rounded-md border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(18,22,28,0.98),rgba(9,12,16,0.99))] p-3"></div>
          </div>
          <div>
            <label htmlFor="card-cvv-field" className="block text-sm font-medium mb-2">
              CVV
            </label>
            <div id="card-cvv-field" className="min-h-[44px] rounded-md border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(18,22,28,0.98),rgba(9,12,16,0.99))] p-3"></div>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        disabled={!isReady || isProcessing}
        className="rsf-metal-button-primary w-full"
        size="lg"
        data-testid="button-submit-payment"
      >
        {isProcessing ? "Processing..." : `Pay $${parseFloat(rental.totalCostRenter).toFixed(2)}`}
      </Button>
      
      <div className="rsf-rentals-subpanel mt-4 rounded-md p-3">
        <p className="text-center text-xs text-[#A9BBCD]">
          🔒 Secure payments processed by <span className="font-semibold">PayPal Business/Commerce</span>, a trusted global payments platform
        </p>
        <p className="mt-1 text-center text-xs text-[#A9BBCD]">
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

  useEffect(() => {
    if (!rental || !aircraft) return;
    trackEvent("rental_payment_view", {
      rental_id: rental.id,
      aircraft_id: aircraft.id,
      value: Number(parseFloat(rental.totalCostRenter).toFixed(2)),
      currency: "USD",
    });
  }, [rental, aircraft]);

  if (!rental || !aircraft) {
    return (
      <div className="min-h-screen rsf-app-shell rsf-rentals-theme flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-[#A9BBCD]">Loading rental details...</p>
        </div>
      </div>
    );
  }

  const status = String(rental.status || "").toLowerCase();
  const isPending = status === "pending";
  const isApprovedForPayment = status === "approved" && !rental.isPaid;
  const isPaidOrActive = Boolean(rental.isPaid) || status === "active";
  const isCancelled = status === "cancelled";
  const isCompleted = status === "completed";

  const renderStatusPanel = () => {
    if (isApprovedForPayment) {
      return (
        <Card className="rsf-metal-panel text-[#E8EDF4]">
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
      );
    }

    if (isPending) {
      return (
        <Card className="rsf-metal-panel text-[#E8EDF4]" data-testid="card-rental-payment-pending">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-[#f2dca4]" />
              <div>
                <h2 className="text-xl font-semibold">Waiting for owner approval</h2>
                <p className="mt-1 text-sm text-[#A9BBCD]">
                  Your request has been sent to the aircraft owner. Payment will become available after the owner approves the rental.
                </p>
              </div>
            </div>
            <Button className="rsf-metal-button-secondary" onClick={() => setLocation("/dashboard")}>
              View request status
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (isCancelled) {
      return (
        <Card className="rsf-metal-panel text-[#E8EDF4]" data-testid="card-rental-payment-cancelled">
          <CardContent className="space-y-4 p-6">
            <h2 className="text-xl font-semibold">Rental unavailable</h2>
            <p className="text-sm text-[#A9BBCD]">
              This rental request was cancelled, so payment is no longer available.
            </p>
            <Button className="rsf-metal-button-secondary" onClick={() => setLocation("/rentals")}>
              Browse rentals
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (isPaidOrActive || isCompleted) {
      return (
        <Card className="rsf-metal-panel text-[#E8EDF4]" data-testid="card-rental-payment-complete">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#6dc8ab]" />
              <div>
                <h2 className="text-xl font-semibold">Payment already completed</h2>
                <p className="mt-1 text-sm text-[#A9BBCD]">
                  This rental is already paid. Manage the rental from your dashboard.
                </p>
              </div>
            </div>
            <Button className="rsf-metal-button-secondary" onClick={() => setLocation("/dashboard")}>
              Go to dashboard
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="rsf-metal-panel text-[#E8EDF4]" data-testid="card-rental-payment-unavailable">
        <CardContent className="space-y-4 p-6">
          <h2 className="text-xl font-semibold">Payment unavailable</h2>
          <p className="text-sm text-[#A9BBCD]">
            This rental is not currently ready for payment. Check your dashboard for the latest status.
          </p>
          <Button className="rsf-metal-button-secondary" onClick={() => setLocation("/dashboard")}>
            Go to dashboard
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen rsf-app-shell rsf-rentals-theme">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-4xl font-bold mb-8" data-testid="text-payment-title">
            Complete Your Rental Payment
          </h1>

          <div className="grid gap-6">
            {/* Rental Summary */}
            <Card className="rsf-metal-panel text-[#E8EDF4]">
              <CardHeader>
                <CardTitle>Rental Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Plane className="h-5 w-5 text-[#8fa6c0]" />
                  <div>
                    <p className="font-semibold">{aircraft.year} {aircraft.make} {aircraft.model}</p>
                    <p className="text-sm text-[#A9BBCD]">{aircraft.registration}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-[#8fa6c0]" />
                  <div>
                    <p className="text-sm">
                      {new Date(rental.startDate).toLocaleDateString()} - {new Date(rental.endDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-[#8fa6c0]" />
                  <div>
                    <p className="text-sm">{parseFloat(rental.estimatedHours)} estimated flight hours</p>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#A9BBCD]">Base cost</span>
                    <span>${parseFloat(rental.baseCost).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#A9BBCD]">Sales tax (8.25%)</span>
                    <span>${parseFloat(rental.salesTax).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#A9BBCD]">Platform fee (7.5%)</span>
                    <span>${parseFloat(rental.platformFeeRenter).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#A9BBCD]">Processing fee (3%)</span>
                    <span>${parseFloat(rental.processingFee).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span>${parseFloat(rental.totalCostRenter).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {renderStatusPanel()}
          </div>
        </div>
      </div>
    </div>
  );
}

