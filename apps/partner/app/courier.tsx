import { Redirect } from 'expo-router';
import { usePartner } from '../src/PartnerContext';
import { CourierJobsScreen } from '../src/screens/WorkScreens';

export default function CourierRoute() {
  const { auth, activeRole } = usePartner();
  if (auth.status !== 'signedIn' || activeRole?.ui !== 'COURIER') return <Redirect href={'/roles' as never} />;
  return <CourierJobsScreen />;
}
