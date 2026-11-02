import { Redirect } from 'expo-router';
import { LoadingState } from '@lahloba/ui';
import { usePartner } from '../src/PartnerContext';
import { SignInScreen } from '../src/screens/SignInScreen';

export default function Index() {
  const { auth } = usePartner();
  if (auth.status === 'loading') return <LoadingState />;
  return auth.status === 'signedIn' ? <Redirect href={'/roles' as never} /> : <SignInScreen />;
}
