import { Switch, Route, useLocation } from "wouter";
import { lazy, Suspense, type ComponentType, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./components/theme-provider";
import { Header } from "./components/header";
import { Footer } from "./components/footer";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent, trackSessionPing } from "@/lib/analytics";
import { SignupNudgeBanner } from "@/components/SignupNudgeBanner";
import { FreeAccountValueBar } from "@/components/FreeAccountValueBar";
import { AuthGateModal } from "@/components/AuthGateModal";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";
import { recordAnonSession, recordAnonToolInteraction, isSoftAuthEnabled } from "@/utils/anonUsage";
import { setAuthState } from "@/utils/authGate";
import Home from "@/pages/home";
import Landing from "@/pages/landing";
import Marketplace from "@/pages/marketplace";
import Dashboard from "@/pages/dashboard";
import Profile from "@/pages/profile";
import MyListings from "@/pages/my-listings";
import Messages from "@/pages/messages";
import Favorites from "@/pages/favorites";
import AircraftDetail from "@/pages/aircraft-detail";
import ListAircraft from "@/pages/list-aircraft";
import CreateMarketplaceListing from "@/pages/create-marketplace-listing";
import MarketplaceListingCheckout from "@/pages/marketplace-listing-checkout";
import RentalPayment from "@/pages/rental-payment";
import AdminDashboard from "@/pages/admin";
import AdminInviteAccept from "@/pages/admin-invite";
import VerifyIdentity from "@/pages/verify-identity";
import OwnerPayoutSetup from "@/pages/owner-payout-setup";
import OwnerWithdrawals from "@/pages/owner-withdrawals";
import RequireAuth from "@/pages/require-auth";
import NotFound from "@/pages/not-found";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfService from "@/pages/terms-of-service";
import Settings from "@/pages/settings";
import DeleteAccount from "@/pages/delete-account";
import Login from "@/pages/login";
import Register from "@/pages/register";
import VerifyEmail from "@/pages/verify-email";
import BannerAdPaymentRedirect from "@/pages/banner-ad-payment";
import BannerAdvertise from "@/pages/banner-advertise";
import Logbook from "@/pages/logbook";
import PilotTools from "@/pages/pilot-tools";
import ToolHub from "@/pages/tool-hub";
import AviationWeatherHub from "@/pages/aviation-weather";
import TfrMap from "@/pages/tfr-map";
import OwnershipCostCalculator from "@/pages/ownership-cost-calculator";
import WeightBalance from "@/pages/weight-balance";
import LogbookPro from "@/pages/logbook-pro";
import LogbookProSuccess from "@/pages/logbook-pro-success";
import LogbookProCancel from "@/pages/logbook-pro-cancel";
import FlightPlanner from "@/pages/flight-planner";
import ApproachPlates from "@/pages/approach-plates";
import FaqPage from "@/pages/faq";
import MyAircraft from "@/pages/my-aircraft";
import AdminAircraftLibrary from "@/pages/admin-aircraft-library";
import RadioCommsTrainer from "@/pages/radio-comms-trainer";
import AdsbReceiverHelp from "@/pages/adsb-receiver-help";
import NotificationsPage from "@/pages/notifications";
import AdsbLive from "@/pages/adsb-live";
import SyntheticVisionPage from "@/pages/synthetic-vision";
import Eb6Calculator from "@/pages/tools/Eb6Calculator";
import CfiDirectory from "@/pages/cfi";
import CfiProfile from "@/pages/cfi/profile";
import CfiRequest from "@/pages/cfi/request";
import CfiDashboard from "@/pages/cfi/dashboard";
import CfiSchoolDashboard from "@/pages/cfi/school-dashboard";
import CfiTrainingCenter from "@/pages/cfi/training";
import CfiTerms from "@/pages/cfi/terms";
import CfiStudentTerms from "@/pages/cfi/student-terms";

const StudentHub = lazy(() => import("@/pages/student/hub"));
const StudentWizard = lazy(() => import("@/pages/student/wizard"));
const StudentRoadmap = lazy(() => import("@/pages/student/roadmap"));
const StudentCost = lazy(() => import("@/pages/student/cost"));
const StudentProgress = lazy(() => import("@/pages/student/progress"));
const StudentTraining = lazy(() => import("@/pages/student/training"));
const StudentWritten = lazy(() => import("@/pages/student/written"));
const StudentAbbreviations = lazy(() => import("@/pages/student/abbreviations"));
const StudentSyllabi = lazy(() => import("@/pages/student/syllabi"));
const StudentVorTrainer = lazy(() => import("@/pages/student/vor-trainer"));
const StudentSixPackTrainer = lazy(() => import("@/pages/student/six-pack-trainer"));
const StudentChecklists = lazy(() => import("@/pages/student/checklists"));
const StudentWeather = lazy(() => import("@/pages/student/weather"));
const GpsSimsHub = lazy(() => import("@/pages/gps-sims"));
const GpsSimsUnit = lazy(() => import("@/pages/gps-sims-unit"));
const IfrTools = lazy(() => import("@/pages/ifr-tools"));
const EventsPage = lazy(() => import("@/pages/events"));

function StudentPageLoader({ component: Component }: { component: ComponentType }) {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-10 text-sm text-muted-foreground">Loading...</div>}>
      <Component />
    </Suspense>
  );
}

function RedirectTo({ to }: { to: string }) {
  const [location, setLocation] = useLocation();
  useEffect(() => {
    const queryIndex = location.indexOf("?");
    const suffix = queryIndex >= 0 ? location.slice(queryIndex) : "";
    setLocation(`${to}${suffix}`, { replace: true });
  }, [location, setLocation, to]);
  return null;
}

function AnalyticsTracker() {
  const [path] = useLocation();
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    trackEvent("page_view", { page: path });
    trackSessionPing(path);
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const toolPrefixes = [
      "/tool-hub",
      "/pilot-tools",
      "/aviation-weather",
      "/tfr-map",
      "/approach-plates",
      "/ownership-cost-calculator",
      "/weight-balance",
      "/tools/e6b",
      "/flight-planner",
      "/radio-comms-trainer",
      "/adsb-receiver-help",
      "/live-traffic",
      "/synthetic-vision",
      "/student",
      "/start-flying",
      "/gps-sims",
      "/ifr-tools",
    ];
    if (toolPrefixes.some((prefix) => normalized.startsWith(prefix))) {
      trackEvent("tool_used", { tool: normalized });
      if (!isAuthenticated) {
        recordAnonToolInteraction();
      }
    }
  }, [path, isAuthenticated]);
  return null;
}

function ScrollToTopOnRoute() {
  const [path] = useLocation();
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [path]);
  return null;
}

// Router component - allows anonymous browsing for rentals/marketplace
function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Public routes - accessible to everyone */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/faq" component={FaqPage} />
      <Route path="/synthetic-vision" component={SyntheticVisionPage} />
      <Route path="/logbook/pro" component={LogbookPro} />
      <Route path="/events" component={() => <StudentPageLoader component={EventsPage} />} />
      <Route path="/admin/invite" component={RequireAuth} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms-of-service" component={TermsOfService} />
      <Route path="/banner-ad-payment" component={BannerAdPaymentRedirect} />
      <Route path="/banner-advertise" component={BannerAdvertise} />
      <Route path="/tools" component={() => <RedirectTo to="/tool-hub" />} />
      <Route path="/tool-hub" component={ToolHub} />
      <Route path="/cfi" component={CfiDirectory} />
      <Route path="/cfi/terms" component={CfiTerms} />
      <Route path="/cfi/student-terms" component={CfiStudentTerms} />
      <Route path="/cfi/:slug" component={CfiProfile} />
      <Route path="/delete-account" component={DeleteAccount} />
      <Route path="/tools/eb6" component={() => <RedirectTo to="/tools/e6b" />} />
      <Route path="/404" component={NotFound} />
      
      {/* Protected routes - require authentication */}
      {isAuthenticated ? (
        <>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/dashboard/cfi" component={CfiDashboard} />
          <Route path="/dashboard/cfi-school" component={CfiSchoolDashboard} />
          <Route path="/dashboard/cfi-training" component={CfiTrainingCenter} />
          <Route path="/profile" component={Profile} />
          <Route path="/my-listings" component={MyListings} />
          <Route path="/favorites" component={Favorites} />
          <Route path="/messages" component={Messages} />
          <Route path="/rentals" component={Home} />
          <Route path="/marketplace" component={Marketplace} />
          <Route path="/cfi/:slug/request" component={CfiRequest} />
          <Route path="/aircraft/:id" component={AircraftDetail} />
          <Route path="/pilot-tools" component={PilotTools} />
          <Route path="/tool-hub" component={ToolHub} />
          <Route path="/aviation-weather" component={AviationWeatherHub} />
          <Route path="/tfr-map" component={TfrMap} />
          <Route path="/approach-plates" component={ApproachPlates} />
          <Route path="/ownership-cost-calculator" component={OwnershipCostCalculator} />
          <Route path="/weight-balance" component={WeightBalance} />
          <Route path="/tools/e6b" component={Eb6Calculator} />
          <Route path="/flight-planner" component={FlightPlanner} />
          <Route path="/radio-comms-trainer" component={RadioCommsTrainer} />
          <Route path="/adsb-receiver-help" component={AdsbReceiverHelp} />
          <Route path="/live-traffic" component={AdsbLive} />
          <Route path="/list-aircraft" component={ListAircraft} />
          <Route path="/edit-aircraft/:id" component={ListAircraft} />
          <Route path="/create-marketplace-listing" component={CreateMarketplaceListing} />
          <Route path="/edit-marketplace-listing/:id" component={CreateMarketplaceListing} />
          <Route path="/marketplace/listing/checkout" component={MarketplaceListingCheckout} />
          <Route path="/rental-payment/:id" component={RentalPayment} />
          <Route path="/owner-payout-setup" component={OwnerPayoutSetup} />
          <Route path="/owner-withdrawals" component={OwnerWithdrawals} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/admin/invite" component={AdminInviteAccept} />
          <Route path="/verify-identity" component={VerifyIdentity} />
          <Route path="/settings" component={Settings} />
          <Route path="/logbook" component={Logbook} />
          <Route path="/logbook/pro/success" component={LogbookProSuccess} />
          <Route path="/logbook/pro/cancel" component={LogbookProCancel} />
          <Route path="/adsb-receiver-help" component={AdsbReceiverHelp} />
          <Route path="/live-traffic" component={AdsbLive} />
          <Route path="/my-aircraft" component={MyAircraft} />
          <Route path="/notifications" component={NotificationsPage} />
          <Route path="/admin/aircraft-library" component={AdminAircraftLibrary} />
          <Route path="/student" component={() => <StudentPageLoader component={StudentHub} />} />
          <Route path="/start-flying" component={() => <StudentPageLoader component={StudentHub} />} />
          <Route path="/student/wizard" component={() => <StudentPageLoader component={StudentWizard} />} />
          <Route path="/student/roadmap" component={() => <StudentPageLoader component={StudentRoadmap} />} />
          <Route path="/student/cost" component={() => <StudentPageLoader component={StudentCost} />} />
          <Route path="/student/progress" component={() => <StudentPageLoader component={StudentProgress} />} />
          <Route path="/student/training" component={() => <StudentPageLoader component={StudentTraining} />} />
          <Route path="/student/written" component={() => <StudentPageLoader component={StudentWritten} />} />
          <Route path="/student/abbreviations" component={() => <StudentPageLoader component={StudentAbbreviations} />} />
          <Route path="/student/syllabi" component={() => <StudentPageLoader component={StudentSyllabi} />} />
          <Route path="/student/vor-trainer" component={() => <StudentPageLoader component={StudentVorTrainer} />} />
          <Route path="/student/six-pack-trainer" component={() => <StudentPageLoader component={StudentSixPackTrainer} />} />
          <Route path="/student/checklists" component={() => <StudentPageLoader component={StudentChecklists} />} />
          <Route path="/student/weather" component={() => <StudentPageLoader component={StudentWeather} />} />
          <Route path="/gps-sims" component={() => <StudentPageLoader component={GpsSimsHub} />} />
          <Route path="/gps-sims/:unitId" component={() => <StudentPageLoader component={GpsSimsUnit} />} />
          <Route path="/ifr-tools" component={() => <StudentPageLoader component={IfrTools} />} />
        </>
      ) : (
        <>
          {/* Show "Sign In Required" page for unauthenticated users trying to access protected routes */}
          <Route path="/dashboard" component={RequireAuth} />
          <Route path="/dashboard/cfi" component={RequireAuth} />
          <Route path="/dashboard/cfi-training" component={RequireAuth} />
          <Route path="/profile" component={RequireAuth} />
          <Route path="/my-listings" component={RequireAuth} />
          <Route path="/favorites" component={RequireAuth} />
          <Route path="/messages" component={RequireAuth} />
          <Route path="/rentals" component={Home} />
          <Route path="/marketplace" component={Marketplace} />
          <Route path="/cfi/:slug/request" component={RequireAuth} />
          <Route path="/aircraft/:id" component={AircraftDetail} />
          <Route path="/pilot-tools" component={PilotTools} />
          <Route path="/tool-hub" component={ToolHub} />
          <Route path="/aviation-weather" component={AviationWeatherHub} />
          <Route path="/tfr-map" component={TfrMap} />
          <Route path="/approach-plates" component={ApproachPlates} />
          <Route path="/ownership-cost-calculator" component={OwnershipCostCalculator} />
          <Route path="/weight-balance" component={WeightBalance} />
          <Route path="/tools/e6b" component={Eb6Calculator} />
          <Route path="/flight-planner" component={FlightPlanner} />
          <Route path="/radio-comms-trainer" component={RadioCommsTrainer} />
          <Route path="/adsb-receiver-help" component={AdsbReceiverHelp} />
          <Route path="/live-traffic" component={AdsbLive} />
          <Route path="/list-aircraft" component={RequireAuth} />
          <Route path="/edit-aircraft/:id" component={RequireAuth} />
          <Route path="/create-marketplace-listing" component={RequireAuth} />
          <Route path="/edit-marketplace-listing/:id" component={RequireAuth} />
          <Route path="/marketplace/listing/checkout" component={RequireAuth} />
          <Route path="/rental-payment/:id" component={RequireAuth} />
          <Route path="/owner-payout-setup" component={RequireAuth} />
          <Route path="/owner-withdrawals" component={RequireAuth} />
          <Route path="/admin" component={RequireAuth} />
          <Route path="/admin/invite" component={RequireAuth} />
          <Route path="/verify-identity" component={RequireAuth} />
          <Route path="/settings" component={RequireAuth} />
          <Route path="/logbook" component={RequireAuth} />
          <Route path="/logbook/pro/success" component={RequireAuth} />
          <Route path="/logbook/pro/cancel" component={RequireAuth} />
          <Route path="/adsb-receiver-help" component={RequireAuth} />
          <Route path="/my-aircraft" component={RequireAuth} />
          <Route path="/notifications" component={RequireAuth} />
          <Route path="/admin/aircraft-library" component={RequireAuth} />
          <Route path="/student" component={() => <StudentPageLoader component={StudentHub} />} />
          <Route path="/start-flying" component={() => <StudentPageLoader component={StudentHub} />} />
          <Route path="/student/wizard" component={() => <StudentPageLoader component={StudentWizard} />} />
          <Route path="/student/roadmap" component={() => <StudentPageLoader component={StudentRoadmap} />} />
          <Route path="/student/cost" component={() => <StudentPageLoader component={StudentCost} />} />
          <Route path="/student/progress" component={() => <StudentPageLoader component={StudentProgress} />} />
          <Route path="/student/training" component={RequireAuth} />
          <Route path="/student/written" component={() => <StudentPageLoader component={StudentWritten} />} />
          <Route path="/student/abbreviations" component={() => <StudentPageLoader component={StudentAbbreviations} />} />
          <Route path="/student/syllabi" component={() => <StudentPageLoader component={StudentSyllabi} />} />
          <Route path="/student/vor-trainer" component={() => <StudentPageLoader component={StudentVorTrainer} />} />
          <Route path="/student/six-pack-trainer" component={() => <StudentPageLoader component={StudentSixPackTrainer} />} />
          <Route path="/student/checklists" component={() => <StudentPageLoader component={StudentChecklists} />} />
          <Route path="/student/weather" component={() => <StudentPageLoader component={StudentWeather} />} />
          <Route path="/gps-sims" component={() => <StudentPageLoader component={GpsSimsHub} />} />
          <Route path="/gps-sims/:unitId" component={() => <StudentPageLoader component={GpsSimsUnit} />} />
          <Route path="/ifr-tools" component={() => <StudentPageLoader component={IfrTools} />} />
        </>
      )}
      
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    setAuthState(isAuthenticated);
    if (!isAuthenticated && isSoftAuthEnabled()) {
      recordAnonSession();
    }
  }, [isAuthenticated]);

  return (
    <ThemeProvider defaultTheme="light">
      <TooltipProvider>
        <div className="min-h-screen bg-background flex flex-col">
          {/* Show Header for all users (authenticated and anonymous) */}
          <Header />
          <FreeAccountValueBar />
          <div className="flex-1">
            <AnalyticsTracker />
            <ScrollToTopOnRoute />
            <Router />
          </div>
          <Footer />
        </div>
        <AuthGateModal />
        <SignupNudgeBanner />
        <ScrollToTopButton />
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}

export default App;
