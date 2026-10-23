import { ClerkProvider, SignIn, useAuth } from '@clerk/react';
import { OpsApp } from './OpsApp';

/** Deployed sign-in for operations staff. The API still decides who may act (scoped ops roles). */
function Inner(props: { apiUrl: string }) {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  if (!isLoaded) return null;
  return (
    <OpsApp
      apiUrl={props.apiUrl}
      devStubEnabled={false}
      auth={{
        signedIn: !!isSignedIn,
        getToken: () => getToken(),
        signOut: () => { void signOut(); },
        signIn: <SignIn routing="hash" />,
      }}
    />
  );
}

export function ClerkOps(props: { apiUrl: string; publishableKey: string }) {
  return (
    <ClerkProvider publishableKey={props.publishableKey}>
      <Inner apiUrl={props.apiUrl} />
    </ClerkProvider>
  );
}
