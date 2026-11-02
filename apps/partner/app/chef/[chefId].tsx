import { Redirect, useLocalSearchParams } from 'expo-router';
import { usePartner } from '../../src/PartnerContext';
import { ChefMenuPanel } from '../../src/screens/WorkspaceScreens';
import { ChefWorkspace } from '../../src/screens/WorkScreens';

export default function ChefRoute() {
  const { chefId } = useLocalSearchParams<{ chefId: string }>();
  const { auth, activeRole } = usePartner();
  // UI gating only; the API independently enforces chef-scoped membership.
  if (auth.status !== 'signedIn' || activeRole?.ui !== 'CHEF' || activeRole.scopeId !== chefId) return <Redirect href={'/roles' as never} />;
  return <ChefWorkspace chefId={String(chefId)} menu={<ChefMenuPanel chefId={String(chefId)} />} />;
}
