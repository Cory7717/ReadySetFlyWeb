import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/ProfileScreen';
import MyRentalsScreen from '../screens/MyRentalsScreen';
import BalanceScreen from '../screens/BalanceScreen';
import VerificationScreen from '../screens/VerificationScreen';
import AuthScreen from '../screens/AuthScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import PilotToolsScreen from '../screens/PilotToolsScreen';
import ApproachPlatesScreen from '../screens/ApproachPlatesScreen';
import FlightPlannerScreen from '../screens/FlightPlannerScreen';
import RadioCommsTrainerScreen from '../screens/RadioCommsTrainerScreen';
import LogbookScreen from '../screens/LogbookScreen';
import LogbookEntryScreen from '../screens/LogbookEntryScreen';
import LogbookProScreen from '../screens/LogbookProScreen';
import EndorsementsScreen from '../screens/EndorsementsScreen';
import StudentHubScreen from '../screens/StudentHubScreen';
import StudentWizardScreen from '../screens/StudentWizardScreen';
import StudentRoadmapScreen from '../screens/StudentRoadmapScreen';
import StudentCostScreen from '../screens/StudentCostScreen';
import StudentProgressScreen from '../screens/StudentProgressScreen';
import StudentWrittenScreen from '../screens/StudentWrittenScreen';
import StudentChecklistsScreen from '../screens/StudentChecklistsScreen';
import StudentWeatherScreen from '../screens/StudentWeatherScreen';
import OwnershipCostCalculatorScreen from '../screens/OwnershipCostCalculatorScreen';
import CrosswindCalculatorScreen from '../screens/CrosswindCalculatorScreen';
import DensityAltitudeScreen from '../screens/DensityAltitudeScreen';
import WeightBalanceScreen from '../screens/WeightBalanceScreen';
import MyAircraftScreen from '../screens/MyAircraftScreen';
import MyListingsScreen from '../screens/MyListingsScreen';
import ReviewsScreen from '../screens/ReviewsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import FAQScreen from '../screens/FAQScreen';
import ContactUsScreen from '../screens/ContactUsScreen';
import ReceiverHelpScreen from '../screens/ReceiverHelpScreen';

export type ProfileStackParamList = {
  ProfileHome: undefined;
  MyRentals: undefined;
  Balance: undefined;
  Verification: undefined;
  Auth: undefined;
  Favorites: undefined;
  PilotTools: undefined;
  ApproachPlates: undefined;
  FlightPlanner: undefined;
  RadioCommsTrainer: undefined;
  Logbook: undefined;
  LogbookEntry: { entryId?: string } | undefined;
  LogbookPro: undefined;
  Endorsements: undefined;
  StudentHub: undefined;
  StudentWizard: undefined;
  StudentRoadmap: undefined;
  StudentCost: undefined;
  StudentProgress: undefined;
  StudentWritten: undefined;
  StudentChecklists: undefined;
  StudentWeather: undefined;
  OwnershipCost: undefined;
  CrosswindCalc: undefined;
  DensityAltitude: undefined;
  WeightBalance: undefined;
  MyAircraft: undefined;
  MyListings: undefined;
  Reviews: undefined;
  Notifications: undefined;
  HelpSupport: undefined;
  FAQ: undefined;
  ContactUs: undefined;
  ReceiverHelp: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen 
        name="ProfileHome" 
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="MyRentals" 
        component={MyRentalsScreen}
        options={{ title: 'My Rentals' }}
      />
      <Stack.Screen 
        name="Balance" 
        component={BalanceScreen}
        options={{ title: 'Balance & Withdrawals' }}
      />
      <Stack.Screen 
        name="Verification" 
        component={VerificationScreen}
        options={{ title: 'Verification Status' }}
      />
      <Stack.Screen 
        name="Favorites" 
        component={FavoritesScreen}
        options={{ title: 'My Favorites' }}
      />
      <Stack.Screen 
        name="Auth" 
        component={AuthScreen}
        options={{ title: 'Sign In' }}
      />
      <Stack.Screen 
        name="PilotTools" 
        component={PilotToolsScreen}
        options={{ title: 'Pilot Tools' }}
      />
      <Stack.Screen 
        name="ApproachPlates" 
        component={ApproachPlatesScreen}
        options={{ title: 'Approach Plates' }}
      />
      <Stack.Screen 
        name="FlightPlanner" 
        component={FlightPlannerScreen}
        options={{ title: 'Flight Planner' }}
      />
      <Stack.Screen 
        name="RadioCommsTrainer" 
        component={RadioCommsTrainerScreen}
        options={{ title: 'Radio Comms Trainer' }}
      />
      <Stack.Screen 
        name="Logbook" 
        component={LogbookScreen}
        options={{ title: 'Digital Logbook' }}
      />
      <Stack.Screen 
        name="LogbookEntry" 
        component={LogbookEntryScreen}
        options={{ title: 'Logbook Entry' }}
      />
      <Stack.Screen 
        name="LogbookPro" 
        component={LogbookProScreen}
        options={{ title: 'Logbook Pro' }}
      />
      <Stack.Screen
        name="Endorsements"
        component={EndorsementsScreen}
        options={{ title: 'Endorsements' }}
      />
      <Stack.Screen 
        name="StudentHub" 
        component={StudentHubScreen}
        options={{ title: 'Student Pilots' }}
      />
      <Stack.Screen 
        name="StudentWizard" 
        component={StudentWizardScreen}
        options={{ title: 'Pilot Readiness Wizard' }}
      />
      <Stack.Screen 
        name="StudentRoadmap" 
        component={StudentRoadmapScreen}
        options={{ title: 'Training Roadmap' }}
      />
      <Stack.Screen 
        name="StudentCost" 
        component={StudentCostScreen}
        options={{ title: 'Training Cost' }}
      />
      <Stack.Screen 
        name="StudentProgress" 
        component={StudentProgressScreen}
        options={{ title: 'Progress Tracker' }}
      />
      <Stack.Screen 
        name="StudentWritten" 
        component={StudentWrittenScreen}
        options={{ title: 'Written Test Prep' }}
      />
      <Stack.Screen 
        name="StudentChecklists" 
        component={StudentChecklistsScreen}
        options={{ title: 'Checklists' }}
      />
      <Stack.Screen 
        name="StudentWeather" 
        component={StudentWeatherScreen}
        options={{ title: 'Student Weather' }}
      />
      <Stack.Screen 
        name="OwnershipCost" 
        component={OwnershipCostCalculatorScreen}
        options={{ title: 'Ownership Cost' }}
      />
      <Stack.Screen 
        name="CrosswindCalc" 
        component={CrosswindCalculatorScreen}
        options={{ title: 'Crosswind Calculator' }}
      />
      <Stack.Screen 
        name="DensityAltitude" 
        component={DensityAltitudeScreen}
        options={{ title: 'Density Altitude' }}
      />
      <Stack.Screen
        name="WeightBalance"
        component={WeightBalanceScreen}
        options={{ title: 'Weight & Balance' }}
      />
      <Stack.Screen 
        name="MyAircraft" 
        component={MyAircraftScreen}
        options={{ title: 'My Aircraft' }}
      />
      <Stack.Screen
        name="MyListings"
        component={MyListingsScreen}
        options={{ title: 'My Listings' }}
      />
      <Stack.Screen
        name="Reviews"
        component={ReviewsScreen}
        options={{ title: 'Reviews' }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen
        name="HelpSupport"
        component={HelpSupportScreen}
        options={{ title: 'Help & Support' }}
      />
      <Stack.Screen 
        name="FAQ" 
        component={FAQScreen}
        options={{ title: 'FAQ' }}
      />
      <Stack.Screen
        name="ContactUs"
        component={ContactUsScreen}
        options={{ title: 'Contact Us' }}
      />
      <Stack.Screen
        name="ReceiverHelp"
        component={ReceiverHelpScreen}
        options={{ title: 'ADS-B Setup' }}
      />
    </Stack.Navigator>
  );
}
