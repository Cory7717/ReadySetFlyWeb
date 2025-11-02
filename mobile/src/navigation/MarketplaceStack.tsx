import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MarketplaceScreen from '../screens/MarketplaceScreen';
import MarketplaceCategoryScreen from '../screens/MarketplaceCategoryScreen';
import MarketplaceDetailScreen from '../screens/MarketplaceDetailScreen';
import CreateMarketplaceListingScreen from '../screens/CreateMarketplaceListingScreen';
import MarketplacePaymentScreen from '../screens/MarketplacePaymentScreen';

export type MarketplaceStackParamList = {
  MarketplaceHome: undefined;
  MarketplaceCategory: { category: string };
  MarketplaceDetail: { listingId: string };
  CreateMarketplaceListing: undefined;
  MarketplacePayment: { amount: number; listingData: any };
};

const Stack = createNativeStackNavigator<MarketplaceStackParamList>();

export default function MarketplaceStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="MarketplaceHome" 
        component={MarketplaceScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="MarketplaceCategory" 
        component={MarketplaceCategoryScreen}
        options={({ route }) => ({ 
          title: route.params.category,
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        })}
      />
      <Stack.Screen 
        name="MarketplaceDetail" 
        component={MarketplaceDetailScreen}
        options={{ 
          title: 'Listing Details',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="CreateMarketplaceListing" 
        component={CreateMarketplaceListingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="MarketplacePayment" 
        component={MarketplacePaymentScreen}
        options={{ 
          title: 'Complete Payment',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
    </Stack.Navigator>
  );
}
