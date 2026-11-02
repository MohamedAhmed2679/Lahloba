import { ClerkProvider, useAuth as useClerkAuth, useClerk, useSignIn, useSignUp, useUser } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { AuthContextProvider, type AuthError, type AuthPort, type CodeChannel } from './auth';

/**
 * Clerk-backed AuthPort. One-time-code sign-in by email or phone; if the identifier has no
 * account yet, the same flow signs the person up. Session tokens are kept by Clerk (OS secure
 * store on iOS/Android via expo-secure-store; Clerk's own storage on web).
 */
function toError(e: unknown): AuthError {
  const anyE = e as { code?: string; message?: string; errors?: Array<{ code?: string; longMessage?: string; message?: string }> } | null;
  const first = anyE?.errors?.[0];
  return { code: first?.code ?? anyE?.code ?? 'AUTH_ERROR', message: first?.longMessage ?? first?.message ?? anyE?.message ?? 'Sign-in failed.' };
}
const notFound = (e: AuthError) => /identifier_not_found|not_found/.test(e.code);

function ClerkBridge(props: { children: ReactNode }) {
  const auth = useClerkAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const mode = useRef<{ flow: 'signIn' | 'signUp'; channel: CodeChannel } | null>(null);

  const startCode = useCallback(async (channel: CodeChannel, identifier: string) => {
    const id = identifier.trim();
    const res = channel === 'email'
      ? await signIn.emailCode.sendCode({ emailAddress: id })
      : await signIn.phoneCode.sendCode({ phoneNumber: id });
    if (!res.error) { mode.current = { flow: 'signIn', channel }; return { error: null }; }
    const err = toError(res.error);
    if (!notFound(err)) return { error: err };
    // No account yet: sign up with the same identifier and verify it with a code.
    const created = await signUp.create(channel === 'email' ? { emailAddress: id } : { phoneNumber: id });
    if (created.error) return { error: toError(created.error) };
    const sent = channel === 'email' ? await signUp.verifications.sendEmailCode() : await signUp.verifications.sendPhoneCode();
    if (sent.error) return { error: toError(sent.error) };
    mode.current = { flow: 'signUp', channel };
    return { error: null };
  }, [signIn, signUp]);

  const verifyCode = useCallback(async (code: string) => {
    const m = mode.current;
    if (!m) return { error: { code: 'NO_PENDING', message: 'Request a code first.' } };
    if (m.flow === 'signIn') {
      const v = m.channel === 'email' ? await signIn.emailCode.verifyCode({ code }) : await signIn.phoneCode.verifyCode({ code });
      if (v.error) return { error: toError(v.error) };
      const f = await signIn.finalize();
      return { error: f.error ? toError(f.error) : null };
    }
    const v = m.channel === 'email' ? await signUp.verifications.verifyEmailCode({ code }) : await signUp.verifications.verifyPhoneCode({ code });
    if (v.error) return { error: toError(v.error) };
    // Code-only sign-up needs the Clerk app to require nothing else (no password, no second
    // identifier). If it does, say exactly what is missing instead of a generic session error.
    const missing = (signUp as unknown as { missingFields?: string[] }).missingFields ?? [];
    if ((signUp as unknown as { status?: string }).status === 'missing_requirements' && missing.length) {
      return { error: { code: 'SIGN_UP_INCOMPLETE', message: `Sign-up needs more details (${missing.join(', ')}). The Clerk application must allow sign-up with just a verified email or phone.` } };
    }
    const f = await signUp.finalize();
    return { error: f.error ? toError(f.error) : null };
  }, [signIn, signUp]);

  const value = useMemo<AuthPort>(() => ({
    provider: 'clerk',
    status: !auth.isLoaded ? 'loading' : auth.isSignedIn ? 'signedIn' : 'signedOut',
    label: user?.primaryEmailAddress?.emailAddress ?? user?.primaryPhoneNumber?.phoneNumber ?? null,
    getToken: async () => (auth.isSignedIn ? (await auth.getToken()) ?? null : null),
    startCode,
    verifyCode,
    signOut: async () => { await clerk.signOut(); },
  }), [auth, user, clerk, startCode, verifyCode]);

  return <AuthContextProvider value={value}>{props.children}</AuthContextProvider>;
}

export function ClerkAuthProvider(props: { publishableKey: string; children: ReactNode }) {
  return (
    <ClerkProvider publishableKey={props.publishableKey} tokenCache={tokenCache}>
      <ClerkBridge>{props.children}</ClerkBridge>
    </ClerkProvider>
  );
}
