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
import StudentHubScreen from '../screens/StudentHubScreen';
import StudentWizardScreen from '../screens/StudentWizardScreen';
import StudentRoadmapScreen from '../screens/StudentRoadmapScreen';
import StudentCostScreen from '../screens/StudentCostScreen';
import StudentProgressScreen from '../screens/StudentProgressScreen';
import StudentWrittenScreen from '../screens/StudentWrittenScreen';
import StudentChecklistsScreen from '../screens/StudentChecklistsScreen';
import StudentWeatherScreen from '../screens/StudentWeatherScreen';
import OwnershipCostCalculatorScreen from '../screens/OwnershipCostCalculatorScreen';
import MyAircraftScreen from '../screens/MyAircraftScreen';
import FAQScreen from '../screens/FAQScreen';

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
  StudentHub: undefined;
  StudentWizard: undefined;
  StudentRoadmap: undefined;
  StudentCost: undefined;
  StudentProgress: undefined;
  StudentWritten: undefined;
  StudentChecklists: undefined;
  StudentWeather: undefined;
  OwnershipCost: undefined;
  MyAircraft: undefined;
  FAQ: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="ProfileHome" 
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="MyRentals" 
        component={MyRentalsScreen}
        options={{ 
          title: 'My Rentals',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="Balance" 
        component={BalanceScreen}
        options={{ 
          title: 'Balance & Withdrawals',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="Verification" 
        component={VerificationScreen}
        options={{ 
          title: 'Verification Status',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="Favorites" 
        component={FavoritesScreen}
        options={{ 
          title: 'My Favorites',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="Auth" 
        component={AuthScreen}
        options={{ 
          title: 'Sign In',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="PilotTools" 
        component={PilotToolsScreen}
        options={{ 
          title: 'Pilot Tools',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="ApproachPlates" 
        component={ApproachPlatesScreen}
        options={{ 
          title: 'Approach Plates',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="FlightPlanner" 
        component={FlightPlannerScreen}
        options={{ 
          title: 'Flight Planner',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="RadioCommsTrainer" 
        component={RadioCommsTrainerScreen}
        options={{ 
          title: 'Radio Comms Trainer',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="Logbook" 
        component={LogbookScreen}
        options={{ 
          title: 'Digital Logbook',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="LogbookEntry" 
        component={LogbookEntryScreen}
        options={{ 
          title: 'Logbook Entry',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="LogbookPro" 
        component={LogbookProScreen}
        options={{ 
          title: 'Logbook Pro',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="StudentHub" 
        component={StudentHubScreen}
        options={{ 
          title: 'Student Pilots',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="StudentWizard" 
        component={StudentWizardScreen}
        options={{ 
          title: 'Pilot Readiness Wizard',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="StudentRoadmap" 
        component={StudentRoadmapScreen}
        options={{ 
          title: 'Training Roadmap',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="StudentCost" 
        component={StudentCostScreen}
        options={{ 
          title: 'Training Cost',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="StudentProgress" 
        component={StudentProgressScreen}
        options={{ 
          title: 'Progress Tracker',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="StudentWritten" 
        component={StudentWrittenScreen}
        options={{ 
          title: 'Written Test Prep',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="StudentChecklists" 
        component={StudentChecklistsScreen}
        options={{ 
          title: 'Checklists',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="StudentWeather" 
        component={StudentWeatherScreen}
        options={{ 
          title: 'Student Weather',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="OwnershipCost" 
        component={OwnershipCostCalculatorScreen}
        options={{ 
          title: 'Ownership Cost',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="MyAircraft" 
        component={MyAircraftScreen}
        options={{ 
          title: 'My Aircraft',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="FAQ" 
        component={FAQScreen}
        options={{ 
          title: 'FAQ',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
    </Stack.Navigator>
  );
}
