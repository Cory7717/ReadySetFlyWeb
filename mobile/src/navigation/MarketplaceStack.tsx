import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MarketplaceScreen from '../screens/MarketplaceScreen';
import MarketplaceCategoryScreen from '../screens/MarketplaceCategoryScreen';
import MarketplaceDetailScreen from '../screens/MarketplaceDetailScreen';

export type MarketplaceStackParamList = {
  MarketplaceHome: undefined;
  MarketplaceCategory: { category: string };
  MarketplaceDetail: { listingId: string };
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
    </Stack.Navigator>
  );
}
