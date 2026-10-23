import { Redirect, useLocalSearchParams } from 'expo-router';
import { usePartner } from '../../src/PartnerContext';
import { ChefMenuScreen } from '../../src/screens/WorkspaceScreens';

export default function ChefRoute() {
  const { chefId } = useLocalSearchParams<{ chefId: string }>();
  const { auth, activeRole } = usePartner();
  const token = auth.status === 'signedIn';
  // UI gating only; the API independently enforces chef-scoped membership.
  if (!token || activeRole?.ui !== 'CHEF' || activeRole.scopeId !== chefId) return <Redirect href={'/roles' as never} />;
  return <ChefMenuScreen chefId={String(chefId)} />;
}
