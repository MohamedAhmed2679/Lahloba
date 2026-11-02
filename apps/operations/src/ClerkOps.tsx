import { ClerkProvider, useAuth, useSignIn } from '@clerk/react';
import { OpsApp } from './OpsApp';

const toError = (e: unknown) => {
  const x = e as { code?: string; message?: string; errors?: Array<{ code?: string; longMessage?: string; message?: string }> } | null;
  const f = x?.errors?.[0];
  return { code: f?.code ?? x?.code ?? 'AUTH_ERROR', message: f?.longMessage ?? f?.message ?? x?.message ?? 'Sign-in failed.' };
};

/**
 * Deployed sign-in for operations staff: email one-time code, sign-in only (staff accounts are
 * never created here). The API still decides who may act (scoped ops roles).
 */
function Inner(props: { apiUrl: string }) {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { signIn } = useSignIn();
  if (!isLoaded) return null;
  return (
    <OpsApp
      apiUrl={props.apiUrl}
      devStubEnabled={false}
      auth={{
        signedIn: !!isSignedIn,
        getToken: () => getToken(),
        signOut: () => { void signOut(); },
        codeSignIn: {
          sendCode: async (email) => {
            const r = await signIn.emailCode.sendCode({ emailAddress: email });
            return { error: r.error ? toError(r.error) : null };
          },
          verifyCode: async (code) => {
            const v = await signIn.emailCode.verifyCode({ code });
            if (v.error) return { error: toError(v.error) };
            const f = await signIn.finalize();
            return { error: f.error ? toError(f.error) : null };
          },
        },
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
