import { Redirect } from 'expo-router';
import { usePartner } from '../src/PartnerContext';
import { RolesScreen } from '../src/screens/RolesScreen';

export default function RolesRoute() {
  const { auth } = usePartner();
  const token = auth.status === 'signedIn';
  return token ? <RolesScreen /> : <Redirect href={'/' as never} />;
}
