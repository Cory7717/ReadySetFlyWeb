import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./components/theme-provider";
import { Header } from "./components/header";
import { useAuth } from "@/hooks/useAuth";
import Home from "@/pages/home";
import Landing from "@/pages/landing";
import Marketplace from "@/pages/marketplace";
import Dashboard from "@/pages/dashboard";
import Profile from "@/pages/profile";
import MyListings from "@/pages/my-listings";
import Messages from "@/pages/messages";
import AircraftDetail from "@/pages/aircraft-detail";
import ListAircraft from "@/pages/list-aircraft";
import CreateMarketplaceListing from "@/pages/create-marketplace-listing";
import MarketplaceListingCheckout from "@/pages/marketplace-listing-checkout";
import RentalPayment from "@/pages/rental-payment";
import AdminDashboard from "@/pages/admin";
import VerifyIdentity from "@/pages/verify-identity";
import OwnerPayoutSetup from "@/pages/owner-payout-setup";
import OwnerWithdrawals from "@/pages/owner-withdrawals";
import NotFound from "@/pages/not-found";

// Router component - allows anonymous browsing for rentals/marketplace
function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Public routes - accessible to everyone */}
      <Route path="/" component={Home} />
      <Route path="/marketplace" component={Marketplace} />
      <Route path="/aircraft/:id" component={AircraftDetail} />
      
      {/* Protected routes - require authentication */}
      {isAuthenticated && (
        <>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/profile" component={Profile} />
          <Route path="/my-listings" component={MyListings} />
          <Route path="/messages" component={Messages} />
          <Route path="/list-aircraft" component={ListAircraft} />
          <Route path="/create-marketplace-listing" component={CreateMarketplaceListing} />
          <Route path="/edit-marketplace-listing/:id" component={CreateMarketplaceListing} />
          <Route path="/marketplace/listing/checkout" component={MarketplaceListingCheckout} />
          <Route path="/rental-payment/:id" component={RentalPayment} />
          <Route path="/owner-payout-setup" component={OwnerPayoutSetup} />
          <Route path="/owner-withdrawals" component={OwnerWithdrawals} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/verify-identity" component={VerifyIdentity} />
        </>
      )}
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <div className="min-h-screen bg-background">
            {/* Show Header for all users (authenticated and anonymous) */}
            <Header />
            <Router />
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
