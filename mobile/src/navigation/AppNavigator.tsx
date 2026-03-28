import { NavigationContainer, getFocusedRouteNameFromRoute, type LinkingOptions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/HomeScreen';
import RentalsStack from './RentalsStack';
import MarketplaceStack from './MarketplaceStack';
import MessagesScreen from '../screens/MessagesScreen';
import ProfileStack from './ProfileStack';
import type { RentalsStackParamList } from './RentalsStack';
import type { MarketplaceStackParamList } from './MarketplaceStack';
import type { ProfileStackParamList } from './ProfileStack';
import { colors, radius, shadow } from '../styles/theme';

const Tab = createBottomTabNavigator();

type AppTabParamList = {
  Home: undefined;
  Rentals: RentalsStackParamList;
  Marketplace: MarketplaceStackParamList;
  Messages: undefined;
  Profile: ProfileStackParamList;
};

const linking: LinkingOptions<AppTabParamList> = {
  prefixes: ['readysetfly://', 'https://readysetfly.us', 'https://www.readysetfly.us'],
  config: {
    screens: {
      Home: '',
      Rentals: {
        screens: {
          RentalsList: 'rentals',
          AircraftDetail: 'rentals/aircraft/:aircraftId',
          Booking: 'rentals/book/:aircraftId',
          RentalPayment: 'rentals/payment',
        },
      },
      Marketplace: {
        screens: {
          MarketplaceHome: 'marketplace',
          MarketplaceCategory: 'marketplace/category/:category',
          MarketplaceDetail: 'marketplace/listing/:listingId',
          CreateMarketplaceListing: 'marketplace/create',
          MarketplacePayment: 'marketplace/payment',
        },
      },
      Messages: 'messages',
      Profile: {
        screens: {
          ProfileHome: 'profile',
          PilotTools: 'pilot-tools',
          AviationWeatherHub: 'aviation-weather',
          AirportBriefing: 'airport-briefing',
          ApproachPlates: 'approach-plates',
          FlightPlanner: 'flight-planner',
          FlightDeck: 'flight-deck',
          RadioCommsTrainer: 'radio-comms-trainer',
          Logbook: 'logbook',
          LogbookEntry: 'logbook/entry/:entryId',
          LogbookPro: 'logbook-pro',
          Endorsements: 'endorsements',
          StudentHub: 'student-hub',
          StudentWizard: 'student-wizard',
          StudentRoadmap: 'student-roadmap',
          StudentCost: 'student-cost',
          StudentProgress: 'student-progress',
          StudentWritten: 'student-written',
          StudentSyllabi: 'student-syllabi',
          StudentVorTrainer: 'student-vor-trainer',
          StudentChecklists: 'student-checklists',
          StudentWeather: 'student-weather',
          GpsSimsHub: 'gps-sims',
          GpsSimsUnit: 'gps-sims/:unitId',
          IfrTools: 'ifr-tools',
          Tfrs: 'tfr-map',
          OwnershipCost: 'ownership-cost-calculator',
          CrosswindCalc: 'crosswind-calculator',
          DensityAltitude: 'density-altitude',
          WeightBalance: 'weight-balance',
          MyAircraft: 'my-aircraft',
          MyRentals: 'my-rentals',
          MyListings: 'my-listings',
          Favorites: 'favorites',
          Notifications: 'notifications',
          HelpSupport: 'help-support',
          FAQ: 'faq',
          ContactUs: 'contact-us',
          ReceiverHelp: 'receiver-help',
          Verification: 'verification',
          Balance: 'balance',
          Reviews: 'reviews',
          Auth: 'auth',
        },
      },
    },
  },
};

export default function AppNavigator() {
  const insets = useSafeAreaInsets();
  const tabBottomInset = Math.max(insets.bottom, 14);

  return (
    <NavigationContainer
      linking={linking}
      theme={{
        dark: false,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          notification: colors.danger,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '800' },
        },
      }}
    >
      <Tab.Navigator
        screenOptions={({ route }) => {
          const focusedNestedRoute = getFocusedRouteNameFromRoute(route) ?? '';
          const hideTabBarForFlightDeck = route.name === 'Profile' && focusedNestedRoute === 'FlightDeck';

          return {
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: any;

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Rentals') {
              iconName = focused ? 'airplane' : 'airplane-outline';
            } else if (route.name === 'Marketplace') {
              iconName = focused ? 'storefront' : 'storefront-outline';
            } else if (route.name === 'Messages') {
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
            } else if (route.name === 'Profile') {
              iconName = focused ? 'person' : 'person-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSoft,
          headerShown: false,
          tabBarStyle: {
            display: hideTabBarForFlightDeck ? 'none' : 'flex',
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: tabBottomInset,
            height: 64 + tabBottomInset,
            borderTopWidth: 0,
            borderRadius: radius.xl,
            backgroundColor: 'rgba(255,255,255,0.96)',
            paddingTop: 10,
            paddingBottom: tabBottomInset,
            ...shadow.floating,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
          },
          tabBarItemStyle: {
            borderRadius: radius.lg,
            marginHorizontal: 2,
          },
          tabBarHideOnKeyboard: true,
        };
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Rentals" component={RentalsStack} options={{ headerShown: false }} />
        <Tab.Screen name="Marketplace" component={MarketplaceStack} options={{ headerShown: false }} />
        <Tab.Screen name="Messages" component={MessagesScreen} />
        <Tab.Screen name="Profile" component={ProfileStack} options={{ headerShown: false }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
