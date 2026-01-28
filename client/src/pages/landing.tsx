import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BannerAdRotation } from "@/components/banners/BannerAdRotation";
import { Plane, Shield, DollarSign, MessageSquare, CheckCircle2, Smartphone, BookOpen, ClipboardList, CloudSun, Calculator, Radio } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { apiUrl } from "@/lib/api";

export default function Landing() {
  const { isAuthenticated } = useAuth();
  
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-primary/20 via-background to-background">
        <div className="container mx-auto px-4 py-12 sm:py-20">
          <div className="max-w-4xl mx-auto text-center space-y-4 sm:space-y-6">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
              Ready Set Fly
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground px-4">
              The premier hub for General Aviation tools, training, and community
            </p>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              Ready Set Fly brings pilots, students, and aircraft owners together with modern tools for planning, training, weather, and logbooks - plus a growing marketplace for rentals, schools, and services.
            </p>
            <p className="text-sm sm:text-base text-muted-foreground max-w-3xl mx-auto px-4">
              Discover flight planning, approach plates, student pilot resources, aviation weather, and ownership calculators in one place. Our mission is to create the most trusted General Aviation platform for pilots at every stage.
            </p>
            <Badge variant="outline" className="mx-auto text-xs px-3 py-1">
              Available for US Residents Only
            </Badge>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Marketplace listings are growing weekly as more schools, instructors, and owners join the community.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                size="lg" 
                asChild
                data-testid="button-student-hub"
              >
                <Link href="/student">Start Flying</Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                asChild
                data-testid="button-pilot-tools"
              >
                <Link href="/pilot-tools">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Explore Pilot Tools
                </Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                asChild
                data-testid="button-marketplace"
              >
                <Link href="/marketplace">Visit Marketplace</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <BannerAdRotation 
        placement="home" 
        className="container mx-auto px-4 py-8 max-w-7xl"
      />

      {/* Student Pilot Hub Section */}
      <div className="bg-primary/5 py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <Card className="border-primary/20">
              <CardContent className="p-6 sm:p-8 lg:p-10">
                <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] items-center">
                  <div className="space-y-4">
                    <Badge variant="outline" className="text-xs w-fit">Student Pilot Hub</Badge>
                    <h2 className="text-2xl sm:text-3xl font-bold">
                      New to flying? Start here.
                    </h2>
                    <p className="text-muted-foreground">
                      Use our Student Pilot tools to map out your journey, estimate training costs, and
                      connect with trusted flight schools near you.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button asChild>
                        <Link href="/student">Open Student Pilot Hub</Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href="/marketplace?type=flight-school">Find a Flight School</Link>
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    <div className="rounded-xl border bg-background/70 p-4">
                      <div className="font-semibold">Can I Become a Pilot?</div>
                      <div className="text-sm text-muted-foreground">
                        Quick wizard with timeline, cost range, and next steps.
                      </div>
                    </div>
                    <div className="rounded-xl border bg-background/70 p-4">
                      <div className="font-semibold">Training Roadmap</div>
                      <div className="text-sm text-muted-foreground">
                        Step-by-step milestones with local recommendations.
                      </div>
                    </div>
                    <div className="rounded-xl border bg-background/70 p-4">
                      <div className="font-semibold">Cost & Progress Trackers</div>
                      <div className="text-sm text-muted-foreground">
                        Estimate costs and track your progress in one place.
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Free Pilot Tools Section */}
      <div className="bg-gradient-to-br from-blue-50 to-background dark:from-blue-950/20 dark:to-background py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              FREE Pilot Resources
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Professional tools for pilots and students - free to use, no credit card required
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Digital Logbook Card */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <ClipboardList className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold">Digital Logbook</h3>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    FREE Forever
                  </Badge>
                  <p className="text-muted-foreground">
                    Track your flight hours, aircraft types, and build your professional flight log. 
                    Export to CSV for your records or applications.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2 text-left w-full">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Track PIC, SIC, dual, instrument time & more</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Digital signatures with lock protection</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <span>CSV export for backup & reporting</span>
                    </li>
                  </ul>
                  <Button 
                    className="w-full"
                    asChild
                  >
                    <Link href={isAuthenticated ? '/logbook' : '/login'}>
                      {isAuthenticated ? 'Open Logbook' : 'Sign In to Access'}
                    </Link>
                  </Button>
                  {!isAuthenticated && (
                    <p className="text-xs text-muted-foreground">
                      Free account required - takes 30 seconds
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pilot Tools Card */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="h-16 w-16 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                    <CloudSun className="h-8 w-8 text-sky-600 dark:text-sky-400" />
                  </div>
                  <h3 className="text-xl font-semibold">Aviation Weather & Tools</h3>
                  <Badge variant="secondary" className="bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400">
                    No Sign In Required
                  </Badge>
                  <p className="text-muted-foreground">
                    Get current METAR, TAF, and quick access to essential aviation resources like NOTAMs, TFRs, and flight planning tools.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2 text-left w-full">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-sky-600 dark:text-sky-400 mt-0.5 flex-shrink-0" />
                      <span>Live METAR & TAF for any airport</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-sky-600 dark:text-sky-400 mt-0.5 flex-shrink-0" />
                      <span>Quick links to NOTAMs, TFRs & charts</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-sky-600 dark:text-sky-400 mt-0.5 flex-shrink-0" />
                      <span>Flight planning & briefing resources</span>
                    </li>
                  </ul>
                  <Button 
                    className="w-full"
                    variant="outline"
                    asChild
                  >
                    <Link href="/pilot-tools">
                      Open Pilot Tools
                    </Link>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Free for everyone - no account needed
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Radio Comms Trainer Card */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <Radio className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-semibold">Radio Comms Trainer</h3>
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                    Demo Included
                  </Badge>
                  <p className="text-muted-foreground">
                    Practice ATC phraseology with guided scenarios. Try the demo and unlock full scenarios with Logbook Pro.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2 text-left w-full">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                      <span>Towered pattern, departures, and arrivals</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                      <span>ATC response audio + transcripts</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                      <span>Scoring and coaching tips</span>
                    </li>
                  </ul>
                  <Button 
                    className="w-full"
                    variant="outline"
                    asChild
                  >
                    <Link href="/radio-comms-trainer">
                      Open Radio Trainer
                    </Link>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Demo available - full access with Logbook Pro
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Ownership Cost Calculator Card */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Calculator className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-semibold">Ownership Cost Calculator</h3>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                    New
                  </Badge>
                  <p className="text-muted-foreground">
                    Estimate hourly ownership costs and get a suggested rental price with a built-in 15% margin.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2 text-left w-full">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>Include annual fixed and per-hour variable costs</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>Adjust utilization to see impact on cost/hr</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>Instant recommended rental rate (+15%)</span>
                    </li>
                  </ul>
                  <Button 
                    className="w-full"
                    variant="outline"
                    asChild
                  >
                    <Link href="/ownership-cost-calculator">
                      Open Calculator
                    </Link>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Free for everyone - no account needed
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="container mx-auto px-4 py-12 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">
          Why Choose Ready Set Fly?
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card data-testid="card-feature-student-hub">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Student Pilot Hub</h3>
                <p className="text-muted-foreground">
                  Start flying with a guided roadmap, cost estimates, and discovery flight tools built for new pilots.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-feature-planning">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Plane className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Flight Planning Tools</h3>
                <p className="text-muted-foreground">
                  Plan routes, estimate time and fuel, and review weather with a modern GA-first flight planner.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-feature-plates">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <ClipboardList className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Approach Plates</h3>
                <p className="text-muted-foreground">
                  Fast access to current procedures and charts with safety-first updates for training and IFR prep.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-feature-logbook">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Logbook + Pro Tools</h3>
                <p className="text-muted-foreground">
                  Track hours, endorsements, and progress in one place, with Pro upgrades for serious pilots.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-feature-community">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Growing GA Community</h3>
                <p className="text-muted-foreground">
                  Find instructors, schools, and services as the marketplace grows alongside engaged pilot tools.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-feature-transparency">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Transparent Pricing</h3>
                <p className="text-muted-foreground">
                  Clear pricing and trusted listings built to scale with the community over time.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-muted/50 py-12 sm:py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Ready to Take Flight?
          </h2>
          <p className="text-base sm:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto px-4">
            Join thousands of pilots and aircraft owners in the most trusted aviation marketplace.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              onClick={() => window.location.href = apiUrl('/api/auth/google')}
              data-testid="button-cta-login"
            >
              Create Your Account
            </Button>
            <Button 
              size="lg"
              variant="outline"
              onClick={() => window.location.href = '/rentals'}
              data-testid="button-cta-browse"
            >
              Browse Listings
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile App Section */}
      <div className="py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                  {/* Content Side */}
                  <div className="p-6 sm:p-8 lg:p-12 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Smartphone className="h-6 w-6 text-primary" />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Coming Soon
                      </Badge>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                      Take Ready Set Fly Anywhere
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      Our mobile app is coming soon to iOS and Android. Book aircraft rentals, 
                      browse marketplace listings, and manage your account on the go.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-sm">Browse and book aircraft on your phone</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-sm">Real-time messaging with owners</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-sm">Manage your listings and rentals anywhere</span>
                      </div>
                    </div>
                  </div>

                  {/* App Store Badges Side */}
                  <div className="bg-muted/30 p-6 sm:p-8 lg:p-12 flex flex-col justify-center items-center gap-4">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Download on
                    </p>
                    
                    {/* App Store Badge - Placeholder */}
                    <div 
                      className="w-full max-w-[200px] h-[60px] rounded-lg border-2 border-muted flex items-center justify-center bg-background/50 cursor-not-allowed opacity-60"
                      data-testid="badge-app-store"
                    >
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Available Soon</div>
                        <div className="font-semibold">App Store</div>
                      </div>
                    </div>

                    {/* Play Store Badge - Placeholder */}
                    <div 
                      className="w-full max-w-[200px] h-[60px] rounded-lg border-2 border-muted flex items-center justify-center bg-background/50 cursor-not-allowed opacity-60"
                      data-testid="badge-play-store"
                    >
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Available Soon</div>
                        <div className="font-semibold">Google Play</div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground text-center mt-4 max-w-[250px]">
                      Sign up now to be notified when our mobile apps launch
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Admin Login */}
      <div className="py-8">
        <div className="container mx-auto px-4 text-center">
          <Button 
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = apiUrl('/api/auth/google')}
            data-testid="button-admin-login"
            className="text-muted-foreground hover:text-foreground"
          >
            Admin Login
          </Button>
        </div>
      </div>
    </div>
  );
}
