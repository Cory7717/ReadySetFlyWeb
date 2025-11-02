import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RentalsScreen from '../screens/RentalsScreen';
import AircraftDetailScreen from '../screens/AircraftDetailScreen';
import BookingScreen from '../screens/BookingScreen';
import RentalPaymentScreen from '../screens/RentalPaymentScreen';

export type RentalsStackParamList = {
  RentalsList: undefined;
  AircraftDetail: { aircraftId: string };
  Booking: { aircraftId: string };
  RentalPayment: {
    paymentData: {
      rentalId: string;
      aircraftId: string;
      amount: number;
      startDate: string;
      endDate: string;
      hours: number;
    };
  };
};

const Stack = createNativeStackNavigator<RentalsStackParamList>();

export default function RentalsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="RentalsList" 
        component={RentalsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="AircraftDetail" 
        component={AircraftDetailScreen}
        options={{ 
          title: 'Aircraft Details',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="Booking" 
        component={BookingScreen}
        options={{ 
          title: 'Book Aircraft',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="RentalPayment" 
        component={RentalPaymentScreen}
        options={{ 
          title: 'Secure Payment',
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
        }}
      />
    </Stack.Navigator>
  );
}
