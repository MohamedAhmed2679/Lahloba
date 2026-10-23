import { Redirect } from 'expo-router';
import { usePartner } from '../src/PartnerContext';
import { CourierScreen } from '../src/screens/WorkspaceScreens';

export default function CourierRoute() {
  const { auth, activeRole } = usePartner();
  const token = auth.status === 'signedIn';
  if (!token || activeRole?.ui !== 'COURIER') return <Redirect href={'/roles' as never} />;
  return <CourierScreen />;
}
