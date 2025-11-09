import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  DollarSign,
  CheckCircle2, 
  Info,
  ArrowLeft,
  ExternalLink,
  Zap,
  Shield
} from "lucide-react";

export default function OwnerPayoutSetup() {
  const [, navigate] = useLocation();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/dashboard")}
        className="mb-6"
        data-testid="button-back"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Set Up Instant PayPal Payouts</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Ready Set Fly uses PayPal Business for secure, instant payout processing. Get your rental earnings in minutes, not days.
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Instant Transfers</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Funds arrive in your PayPal account within minutes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Secure Processing</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Trusted PayPal Business payment gateway
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Simple Setup</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Just add your PayPal email and start withdrawing
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Info className="h-5 w-5 text-primary" />
              How PayPal Payouts Work
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Connect Your PayPal Account</p>
                  <p className="text-sm text-muted-foreground">
                    Add your PayPal email address to receive instant payouts
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Request Withdrawals Anytime</p>
                  <p className="text-sm text-muted-foreground">
                    Withdraw your available balance instantly, any time you want
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Receive Funds Instantly</p>
                  <p className="text-sm text-muted-foreground">
                    Funds typically arrive in your PayPal account within minutes
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PayPal Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Learn More About PayPal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href="https://www.paypal.com/us/business/accept-payments/payouts"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-lg border hover-elevate active-elevate-2 transition-colors"
              data-testid="link-paypal-docs"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ExternalLink className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">PayPal Payouts Documentation</p>
                  <p className="text-xs text-muted-foreground">Learn about instant payout processing</p>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>

            <a
              href="https://www.paypal.com/us/business/accept-payments/checkout"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-lg border hover-elevate active-elevate-2 transition-colors"
              data-testid="link-paypal-guide"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ExternalLink className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">PayPal Business Guide</p>
                  <p className="text-xs text-muted-foreground">Secure payment processing and withdrawals</p>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card className="border-primary">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Ready to Get Started?</h3>
                <p className="text-sm text-muted-foreground">
                  Set up instant PayPal withdrawals to receive your rental earnings
                </p>
              </div>
              <Button 
                size="lg" 
                onClick={() => navigate("/owner-withdrawals")}
                data-testid="button-setup-payouts"
                className="bg-accent text-accent-foreground hover:bg-accent"
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Go to PayPal Withdrawals
              </Button>
              <p className="text-xs text-muted-foreground">
                Funds typically arrive within minutes. US residents only.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
