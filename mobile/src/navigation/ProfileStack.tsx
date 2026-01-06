import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/ProfileScreen';
import MyRentalsScreen from '../screens/MyRentalsScreen';
import BalanceScreen from '../screens/BalanceScreen';
import VerificationScreen from '../screens/VerificationScreen';
import AuthScreen from '../screens/AuthScreen';
import FavoritesScreen from '../screens/FavoritesScreen';

export type ProfileStackParamList = {
  ProfileHome: undefined;
  MyRentals: undefined;
  Balance: undefined;
  Verification: undefined;
  Auth: undefined;
  Favorites: undefined;
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
    </Stack.Navigator>
  );
}
