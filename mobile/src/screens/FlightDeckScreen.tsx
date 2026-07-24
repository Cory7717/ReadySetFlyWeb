import { ActiveFlightSessionProvider } from '../lib/activeFlightSessionContext';
import FlightPlannerScreen from './FlightPlannerScreen';

export default function FlightDeckScreen() {
  return (
    <ActiveFlightSessionProvider>
      <FlightPlannerScreen />
    </ActiveFlightSessionProvider>
  );
}
