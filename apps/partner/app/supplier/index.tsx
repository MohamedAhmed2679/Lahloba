import { Redirect } from 'expo-router';
import { usePartner } from '../../src/PartnerContext';
import { SupplierScreen } from '../../src/screens/WorkspaceScreens';

export default function SupplierRoute() {
  const { auth, activeRole } = usePartner();
  const token = auth.status === 'signedIn';
  if (!token || activeRole?.ui !== 'SUPPLIER') return <Redirect href={'/roles' as never} />;
  return <SupplierScreen />;
}
