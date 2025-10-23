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
import AircraftDetail from "@/pages/aircraft-detail";
import ListAircraft from "@/pages/list-aircraft";
import CreateMarketplaceListing from "@/pages/create-marketplace-listing";
import MarketplaceListingCheckout from "@/pages/marketplace-listing-checkout";
import AdminDashboard from "@/pages/admin";
import VerifyIdentity from "@/pages/verify-identity";
import NotFound from "@/pages/not-found";

// Router component handles authenticated vs unauthenticated routing (from blueprint:javascript_log_in_with_replit)
function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/marketplace" component={Marketplace} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/profile" component={Profile} />
          <Route path="/aircraft/:id" component={AircraftDetail} />
          <Route path="/list-aircraft" component={ListAircraft} />
          <Route path="/create-marketplace-listing" component={CreateMarketplaceListing} />
          <Route path="/marketplace/listing/checkout" component={MarketplaceListingCheckout} />
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
            {/* Only show Header for authenticated users */}
            <AuthenticatedHeader />
            <Router />
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// Helper component to conditionally render Header
function AuthenticatedHeader() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading || !isAuthenticated) {
    return null;
  }
  
  return <Header />;
}

export default App;
