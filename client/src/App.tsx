import { Switch, Route, useLocation } from "wouter";
import { lazy, Suspense, type ComponentType, useEffect, useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemeProvider } from "./components/theme-provider";
import { Header } from "./components/header";
import { Footer } from "./components/footer";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent, trackSessionPing } from "@/lib/analytics";
import { pixelPageView } from "@/lib/pixel";
import { SignupNudgeBanner } from "@/components/SignupNudgeBanner";
import { FreeAccountValueBar } from "@/components/FreeAccountValueBar";
import { AiWeatherTranslatorAnnouncement } from "@/components/AiWeatherTranslatorAnnouncement";
import { MembershipGrantAnnouncement } from "@/components/MembershipGrantAnnouncement";
import { AuthGateModal } from "@/components/AuthGateModal";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";
import { recordAnonSession, recordAnonToolInteraction, isSoftAuthEnabled } from "@/utils/anonUsage";
import { setAuthState } from "@/utils/authGate";
import { PREMIUM_MONTHLY_PRICE, PREMIUM_ANNUAL_PRICE } from "@shared/membership-plans";
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
import FlightServiceOpsPage from "@/pages/flight-service-ops";
import MembershipPromotionsAdminPage from "@/pages/membership-promotions-admin";
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
import Redeem from "@/pages/redeem";
import AbsRedeem from "@/pages/abs-redeem";
import VerifyEmail from "@/pages/verify-email";
import BannerAdPaymentRedirect from "@/pages/banner-ad-payment";
import BannerAdvertise from "@/pages/banner-advertise";
import Logbook from "@/pages/logbook";
import PilotTools from "@/pages/pilot-tools";
import ToolHub from "@/pages/tool-hub";
import AviationWeatherHub from "@/pages/aviation-weather";
import CabinBrief from "@/pages/cabin-brief";
import TfrMap from "@/pages/tfr-map";
import OwnershipCostCalculator from "@/pages/ownership-cost-calculator";
import WeightBalance from "@/pages/weight-balance";
import DensityAltitude from "@/pages/density-altitude";
import CrosswindCalculator from "@/pages/crosswind-calculator";
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
import FlyingClubsPage from "@/pages/flying-clubs";
import FlyingClubDetailPage from "@/pages/flying-club-detail";
import InvestorDeck, { INVESTOR_DECK_SHARE_PATH } from "@/pages/investor-deck";
import NoiseAndFuryPage from "@/pages/noise-and-fury";
import GravesidePage from "@/pages/graveside";
import PatriotProtocolPage from "@/pages/patriot-protocol";
import TheGraspPage from "@/pages/the-grasp";
import CoryArmer from "@/pages/CoryArmer";
import TipsPage from "@/pages/tips";
import SchedulePage from "@/pages/schedule";
import OpsReportPage from "@/pages/ops-report";
import ComptrollerPage from "@/pages/comptroller";
import DosReportingPage from "@/pages/dos-reporting";
import CourtyardPortalPage from "@/pages/courtyard";
import CourtyardBudgetPage from "@/pages/courtyard-budget";
import CourtyardSalesIntelligencePage from "@/pages/courtyard-sales-intelligence";
import BankDepositPage from "@/pages/bank-deposit";
import IncidentReportPage from "@/pages/incident-report";
import IncidentReportSharePage from "@/pages/incident-report-share";
import VwBeetlePage from "@/pages/vw-beetle";

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

function PaidToolAccess({ component: Component }: { component: ComponentType }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const entitlements = (user as any)?.entitlements;
  const isPaid = entitlements?.tier ? entitlements.tier !== "free" : user?.logbookProStatus === "active";

  if (isLoading) {
    return <div className="container mx-auto px-4 py-10 text-sm text-muted-foreground">Loading...</div>;
  }

  if (!isAuthenticated || !isPaid) {
    return <LockedPremiumToolPreview component={Component} />;
  }

  return <Component />;
}

function LockedPremiumToolPreview({ component: Component }: { component: ComponentType }) {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const signupHref = isAuthenticated
    ? "/logbook/pro"
    : `/register?returnTo=${encodeURIComponent(location || "/")}`;

  return (
    <>
      <div className="relative min-h-screen bg-[#080a0d]">
        <div className="pointer-events-none select-none opacity-95" aria-hidden="true">
          <Component />
        </div>
        <button
          type="button"
          className="absolute inset-0 z-20 cursor-pointer bg-transparent"
          aria-label="Unlock this RSF Premium calculator"
          onClick={() => setOpen(true)}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rsf-metal-panel border-[#5d6f85]/30 text-[#E8EDF4] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#F5F8FC]">Available with RSF Premium</DialogTitle>
            <DialogDescription className="text-[#A9BBCD]">
              This calculator is available for RSF Premium subscribers. Premium unlocks live inputs, saved planning context, and the full RSF EFB workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-[1rem] border border-[#5d6f85]/24 bg-[#101720] p-4 text-sm text-[#DCE6F2]">
            RSF Premium is ${PREMIUM_MONTHLY_PRICE.toFixed(2)}/month or ${PREMIUM_ANNUAL_PRICE.toFixed(2)}/year. Create an account or upgrade to use this calculator.
          </div>
          <DialogFooter>
            <Button asChild className="rsf-metal-button-primary">
              <a href={signupHref}>{isAuthenticated ? "View Premium Pricing" : "Sign up for RSF Premium"}</a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
    pixelPageView();
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
      "/density-altitude",
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
      <Route path="/redeem" component={Redeem} />
      <Route path="/abs/redeem" component={AbsRedeem} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/faq" component={FaqPage} />
      <Route path="/synthetic-vision" component={SyntheticVisionPage} />
      <Route path="/flight-demo" component={SyntheticVisionPage} />
      <Route path="/logbook/pro" component={() => <LogbookPro />} />
      <Route path="/flight-planner" component={FlightPlanner} />
      <Route path="/pilot-tools" component={() => <PaidToolAccess component={PilotTools} />} />
      <Route path="/aviation-weather" component={() => <PaidToolAccess component={AviationWeatherHub} />} />
      <Route path="/tfr-map" component={() => <PaidToolAccess component={TfrMap} />} />
      <Route path="/approach-plates" component={() => <PaidToolAccess component={ApproachPlates} />} />
      <Route path="/ownership-cost-calculator" component={() => <PaidToolAccess component={OwnershipCostCalculator} />} />
      <Route path="/weight-balance" component={() => <PaidToolAccess component={WeightBalance} />} />
      <Route path="/density-altitude" component={DensityAltitude} />
      <Route path="/crosswind-calculator" component={() => <PaidToolAccess component={CrosswindCalculator} />} />
      <Route path="/tools/e6b" component={() => <PaidToolAccess component={Eb6Calculator} />} />
      <Route path="/radio-comms-trainer" component={() => <PaidToolAccess component={RadioCommsTrainer} />} />
      <Route path="/adsb-receiver-help" component={() => <PaidToolAccess component={AdsbReceiverHelp} />} />
      <Route path="/live-traffic" component={() => <PaidToolAccess component={AdsbLive} />} />
      <Route path="/adsb-live" component={() => <RedirectTo to="/live-traffic" />} />
      <Route path="/events" component={() => <StudentPageLoader component={EventsPage} />} />
      <Route path="/admin/invite" component={RequireAuth} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms-of-service" component={TermsOfService} />
      <Route path="/banner-ad-payment" component={BannerAdPaymentRedirect} />
      <Route path="/banner-advertise" component={BannerAdvertise} />
      <Route path="/tools" component={() => <RedirectTo to="/tool-hub" />} />
      <Route path="/tool-hub" component={ToolHub} />
      <Route path="/cabin-brief" component={CabinBrief} />
      <Route path="/cfi" component={CfiDirectory} />
      <Route path="/flying-clubs" component={FlyingClubsPage} />
      <Route path="/flying-clubs/:slug" component={FlyingClubDetailPage} />
      <Route path="/cfi/terms" component={CfiTerms} />
      <Route path="/cfi/student-terms" component={CfiStudentTerms} />
      <Route path="/cfi/:slug" component={CfiProfile} />
      <Route path="/delete-account" component={DeleteAccount} />
      <Route path="/tools/eb6" component={() => <RedirectTo to="/tools/e6b" />} />
      <Route path="/investor-deck" component={InvestorDeck} />
      <Route path={INVESTOR_DECK_SHARE_PATH} component={InvestorDeck} />
      <Route path="/noiseandfury" component={NoiseAndFuryPage} />
      <Route path="/graveside" component={GravesidePage} />
      <Route path="/patriotprotocol" component={PatriotProtocolPage} />
      <Route path="/thegrasp" component={TheGraspPage} />
      <Route path="/coryarmer" component={CoryArmer} />
      <Route path="/tips" component={TipsPage} />
      <Route path="/tips/admin" component={TipsPage} />
      <Route path="/courtyard" component={CourtyardPortalPage} />
      <Route path="/courtyard/budget" component={CourtyardBudgetPage} />
      <Route path="/courtyard/sales-intelligence" component={CourtyardSalesIntelligencePage} />
      <Route path="/bankdeposit" component={BankDepositPage} />
      <Route path="/schedule" component={SchedulePage} />
      <Route path="/opsreport" component={OpsReportPage} />
      <Route path="/comptroller" component={ComptrollerPage} />
      <Route path="/comtroller" component={() => <RedirectTo to="/comptroller" />} />
      <Route path="/dosreporting" component={DosReportingPage} />
      <Route path="/incidentreport" component={IncidentReportPage} />
      <Route path="/incidentreport/share/:token" component={IncidentReportSharePage} />
      <Route path="/vw-beetle" component={VwBeetlePage} />
      <Route path="/vw-beetle/admin" component={VwBeetlePage} />
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
          
          <Route path="/tool-hub" component={ToolHub} />
          
          <Route path="/list-aircraft" component={ListAircraft} />
          <Route path="/edit-aircraft/:id" component={ListAircraft} />
          <Route path="/create-marketplace-listing" component={CreateMarketplaceListing} />
          <Route path="/edit-marketplace-listing/:id" component={CreateMarketplaceListing} />
          <Route path="/marketplace/listing/checkout" component={MarketplaceListingCheckout} />
          <Route path="/rental-payment/:id" component={RentalPayment} />
          <Route path="/owner-payout-setup" component={OwnerPayoutSetup} />
          <Route path="/owner-withdrawals" component={OwnerWithdrawals} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/admin/certification" component={AdminDashboard} />
      <Route path="/super-admin/flight-service-ops" component={FlightServiceOpsPage} />
      <Route path="/super-admin/membership-promotions" component={MembershipPromotionsAdminPage} />
          <Route path="/admin/invite" component={AdminInviteAccept} />
          <Route path="/verify-identity" component={VerifyIdentity} />
          <Route path="/settings" component={Settings} />
          <Route path="/logbook" component={Logbook} />
          <Route path="/logbook/pro/success" component={LogbookProSuccess} />
          <Route path="/logbook/pro/cancel" component={LogbookProCancel} />
          
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
          
          <Route path="/tool-hub" component={ToolHub} />
          
          <Route path="/list-aircraft" component={RequireAuth} />
          <Route path="/edit-aircraft/:id" component={RequireAuth} />
          <Route path="/create-marketplace-listing" component={RequireAuth} />
          <Route path="/edit-marketplace-listing/:id" component={RequireAuth} />
          <Route path="/marketplace/listing/checkout" component={RequireAuth} />
          <Route path="/rental-payment/:id" component={RequireAuth} />
          <Route path="/owner-payout-setup" component={RequireAuth} />
          <Route path="/owner-withdrawals" component={RequireAuth} />
          <Route path="/admin" component={RequireAuth} />
          <Route path="/admin/certification" component={RequireAuth} />
          <Route path="/super-admin/flight-service-ops" component={RequireAuth} />
          <Route path="/super-admin/membership-promotions" component={RequireAuth} />
          <Route path="/admin/invite" component={RequireAuth} />
          <Route path="/verify-identity" component={RequireAuth} />
          <Route path="/settings" component={RequireAuth} />
          <Route path="/logbook" component={RequireAuth} />
          <Route path="/logbook/pro/success" component={RequireAuth} />
          <Route path="/logbook/pro/cancel" component={RequireAuth} />
          
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
  const [location] = useLocation();
  const isNoiseAndFuryPage = location.startsWith("/noiseandfury");
  const isGravesidePage = location.startsWith("/graveside");
  const isPatriotProtocolPage = location.startsWith("/patriotprotocol");
  const isTheGraspPage = location.startsWith("/thegrasp");
  const isCoryArmerPage = location.startsWith("/coryarmer");
  const isTipsPage = location.startsWith("/tips");
  const isSchedulePage = location.startsWith("/schedule");
  const isCourtyardPage = location.startsWith("/courtyard");
  const isBankDepositPage = location.startsWith("/bankdeposit");
  const isOpsReportPage = location.startsWith("/opsreport");
  const isComptrollerPage = location.startsWith("/comptroller") || location.startsWith("/comtroller");
  const isDosReportingPage = location.startsWith("/dosreporting");
  const isIncidentReportPage = location.startsWith("/incidentreport");
  const isVwBeetlePage = location.startsWith("/vw-beetle");
  const isStandalonePage =
    isNoiseAndFuryPage ||
    isGravesidePage ||
    isPatriotProtocolPage ||
    isTheGraspPage ||
    isCoryArmerPage ||
    isTipsPage ||
    isSchedulePage ||
    isCourtyardPage ||
    isBankDepositPage ||
    isOpsReportPage ||
    isComptrollerPage ||
    isDosReportingPage ||
    isIncidentReportPage ||
    isVwBeetlePage;
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
          {!isStandalonePage && <Header />}
          {!isStandalonePage && <FreeAccountValueBar />}
          <div className="flex-1">
            <AnalyticsTracker />
            <ScrollToTopOnRoute />
            <Router />
          </div>
          {!isStandalonePage && <Footer />}
        </div>
        {!isStandalonePage && <AuthGateModal />}
        {!isStandalonePage && <AiWeatherTranslatorAnnouncement />}
        {!isStandalonePage && <MembershipGrantAnnouncement />}
        {!isStandalonePage && <SignupNudgeBanner />}
        {!isStandalonePage && <ScrollToTopButton />}
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
