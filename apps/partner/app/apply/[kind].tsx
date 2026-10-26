import { Redirect, useLocalSearchParams } from 'expo-router';
import { usePartner } from '../../src/PartnerContext';
import { ApplyScreen } from '../../src/screens/ApplyScreen';

export default function ApplyRoute() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const { auth } = usePartner();
  const token = auth.status === 'signedIn';
  if (!token) return <Redirect href={'/' as never} />;
  if (kind !== 'CHEF' && kind !== 'SUPPLIER' && kind !== 'COURIER') return <Redirect href={'/roles' as never} />;
  return <ApplyScreen kind={kind} />;
}
