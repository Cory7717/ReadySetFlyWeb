import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { Rental, AircraftListing } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plane, Calendar, Clock } from "lucide-react";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY!);

function CheckoutForm({ rental, aircraft, onSuccess }: { rental: Rental; aircraft: AircraftListing; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard`,
      },
      redirect: "if_required",
    });

    if (error) {
      toast({
        title: "Payment failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      // Call secure backend endpoint to verify payment and update rental
      try {
        const response = await fetch(`/api/rentals/${rental.id}/complete-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
        });

        if (!response.ok) {
          throw new Error("Failed to complete rental");
        }

        toast({
          title: "Payment successful!",
          description: "Your rental is now active. Safe flying!",
        });
        
        onSuccess();
      } catch (err) {
        toast({
          title: "Error",
          description: "Payment processed but rental activation failed. Please contact support.",
          variant: "destructive",
        });
        setIsProcessing(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-accent text-accent-foreground hover:bg-accent"
        size="lg"
        data-testid="button-submit-payment"
      >
        {isProcessing ? "Processing..." : `Pay $${parseFloat(rental.totalCostRenter).toFixed(2)}`}
      </Button>
    </form>
  );
}

export default function RentalPayment() {
  const [, params] = useRoute("/rental-payment/:id");
  const [, setLocation] = useLocation();
  const [clientSecret, setClientSecret] = useState("");
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
    if (rental && !clientSecret) {
      // Create payment intent
      fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amount: parseFloat(rental.totalCostRenter), // Server will convert to cents
          rentalId: rental.id,
        }),
      })
        .then((res) => res.json())
        .then((data) => setClientSecret(data.clientSecret))
        .catch((error) => {
          toast({
            title: "Error",
            description: "Failed to initialize payment",
            variant: "destructive",
          });
        });
    }
  }, [rental, clientSecret, toast]);

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

  const options = {
    clientSecret,
    appearance: { theme: "stripe" as const },
  };

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
            {clientSecret && (
              <Card>
                <CardHeader>
                  <CardTitle>Payment Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <Elements stripe={stripePromise} options={options}>
                    <CheckoutForm
                      rental={rental}
                      aircraft={aircraft}
                      onSuccess={() => setLocation("/dashboard")}
                    />
                  </Elements>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
