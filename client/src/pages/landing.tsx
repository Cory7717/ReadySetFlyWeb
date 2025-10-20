import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plane, Shield, DollarSign, MessageSquare, CheckCircle2 } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-primary/20 via-background to-background">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Ready Set Fly
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground">
              The Premier Aviation Marketplace for Aircraft Rentals & Sales
            </p>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Connect with verified pilots and aircraft owners. List your aircraft, find the perfect rental, or explore our marketplace for sales, jobs, CFIs, and more.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                size="lg" 
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-login"
              >
                Get Started
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
                data-testid="button-learn-more"
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          Why Choose Ready Set Fly?
        </h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card data-testid="card-feature-verified">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Verified Users</h3>
                <p className="text-muted-foreground">
                  All pilots and owners undergo verification with license checks and background screening for your safety.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-feature-transparent">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Transparent Pricing</h3>
                <p className="text-muted-foreground">
                  Fair 15% commission split (7.5% renter + 7.5% owner). No hidden fees, just straightforward pricing.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-feature-messaging">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Secure Messaging</h3>
                <p className="text-muted-foreground">
                  Real-time messaging between renters and owners during active rentals for seamless communication.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-feature-rentals">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Plane className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Aircraft Rentals</h3>
                <p className="text-muted-foreground">
                  Browse hundreds of aircraft available for rent. Filter by certification requirements and location.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-feature-marketplace">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Full Marketplace</h3>
                <p className="text-muted-foreground">
                  Beyond rentals: aircraft sales, aviation jobs, CFI listings, flight schools, mechanics, and charter services.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-feature-financial">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Financial Tracking</h3>
                <p className="text-muted-foreground">
                  Owners can track earnings, deposits, and manage multiple aircraft listings from a single dashboard.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-muted/50 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Take Flight?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of pilots and aircraft owners in the most trusted aviation marketplace.
          </p>
          <Button 
            size="lg"
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-cta-login"
          >
            Create Your Account
          </Button>
        </div>
      </div>
    </div>
  );
}
