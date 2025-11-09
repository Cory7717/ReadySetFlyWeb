import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  CreditCard, 
  Building2, 
  Shield, 
  CheckCircle2, 
  Info,
  ArrowLeft,
  ExternalLink
} from "lucide-react";

export default function OwnerPayoutSetup() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Form state for sub-merchant account
  const [formData, setFormData] = useState({
    // Personal Info
    firstName: "",
    lastName: "",
    email: user?.email || "",
    phone: "",
    dateOfBirth: "",
    ssn: "",
    streetAddress: "",
    city: "",
    state: "",
    postalCode: "",
    
    // Business Info (optional for individuals)
    businessName: "",
    taxId: "",
    
    // Bank Account Info
    accountNumber: "",
    routingNumber: "",
    accountHolderName: "",
    
    // Legal
    tosAccepted: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // TODO: Implement API call to create sub-merchant account
    toast({
      title: "Coming Soon",
      description: "Direct bank account payout setup is coming soon. Use PayPal withdrawals in the meantime.",
    });
  };

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
        <div>
          <h1 className="text-3xl font-bold mb-2">Set Up Payouts</h1>
          <p className="text-muted-foreground">
            Connect your bank account to receive rental payments directly
          </p>
        </div>

        {/* Info Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Info className="h-5 w-5 text-primary" />
              How Payouts Work
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Automatic Transfers</p>
                  <p className="text-sm text-muted-foreground">
                    Funds are automatically deposited to your bank account 2 business days after each completed rental
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Secure Processing</p>
                  <p className="text-sm text-muted-foreground">
                    All payment information is encrypted and processed securely by PayPal Business
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Platform Fees Included</p>
                  <p className="text-sm text-muted-foreground">
                    Platform fees (7.5%) are automatically deducted. You receive the remaining amount directly
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="bg-background/50 p-4 rounded-lg space-y-2">
              <p className="font-semibold text-sm">Example Payout Calculation</p>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rental Base Cost:</span>
                  <span>$1,000.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform Fee (7.5%):</span>
                  <span className="text-destructive">-$75.00</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>Your Payout:</span>
                  <span className="text-primary">$925.00</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Requirements Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              What You'll Need
            </CardTitle>
            <CardDescription>
              Have this information ready to complete your payout account setup
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="h-4 w-4 text-primary" />
                  Personal Information
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                  <li>Full legal name</li>
                  <li>Date of birth</li>
                  <li>Social Security Number (SSN)</li>
                  <li>Home address</li>
                  <li>Phone number</li>
                </ul>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Bank Account Details
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                  <li>Bank routing number</li>
                  <li>Account number</li>
                  <li>Account holder name</li>
                  <li>Must be a US checking account</li>
                </ul>
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <Info className="h-4 w-4" />
                Business Account (Optional)
              </p>
              <p className="text-sm text-muted-foreground">
                If you operate as a business, you'll also need your business legal name, DBA (if applicable), 
                and Tax ID (EIN). Individual aircraft owners can use their SSN.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Verification Process */}
        <Card>
          <CardHeader>
            <CardTitle>Verification Process</CardTitle>
            <CardDescription>
              Your account will go through identity verification before payouts can begin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium">Submit Information</p>
                  <p className="text-sm text-muted-foreground">
                    Complete the form with your personal and banking details
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium">Braintree Verification</p>
                  <p className="text-sm text-muted-foreground">
                    PayPal Braintree verifies your identity (typically 24-48 hours)
                  </p>
                  <Badge variant="secondary" className="mt-1">Status: Pending</Badge>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium">Account Activated</p>
                  <p className="text-sm text-muted-foreground">
                    Once approved, you'll start receiving payouts automatically
                  </p>
                  <Badge variant="default" className="mt-1">Status: Active</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Important Notes */}
        <Card className="border-muted">
          <CardHeader>
            <CardTitle className="text-base">Important Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground">
                <strong className="text-foreground">US Only:</strong> Payout accounts are currently only available 
                for US-based aircraft owners with US bank accounts.
              </p>
            </div>
            
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground">
                <strong className="text-foreground">Security:</strong> Your banking information is never stored 
                on our servers. All sensitive data is handled directly by PayPal Braintree's secure systems.
              </p>
            </div>

            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground">
                <strong className="text-foreground">Agreement:</strong> By setting up payouts, you agree to 
                Braintree's Terms of Service and authorize Ready Set Fly to process payments on your behalf.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* External Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Learn More</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href="https://developer.paypal.com/braintree/docs/guides/braintree-marketplace"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-lg border hover-elevate active-elevate-2 transition-colors"
              data-testid="link-braintree-docs"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ExternalLink className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Braintree Marketplace Documentation</p>
                  <p className="text-xs text-muted-foreground">Learn about sub-merchant accounts and payouts</p>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>

            <a
              href="https://articles.braintreepayments.com/guides/braintree-marketplace/funding"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-lg border hover-elevate active-elevate-2 transition-colors"
              data-testid="link-funding-guide"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ExternalLink className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Braintree Funding Guide</p>
                  <p className="text-xs text-muted-foreground">Understand payout timelines and requirements</p>
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
                  Complete your payout setup to start receiving rental payments
                </p>
              </div>
              <Button 
                size="lg" 
                onClick={handleSubmit}
                data-testid="button-setup-payouts"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Set Up Payout Account
              </Button>
              <p className="text-xs text-muted-foreground">
                This feature is coming soon. We're working with Braintree to enable marketplace functionality.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
