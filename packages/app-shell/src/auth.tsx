import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ApiClient } from '@lahloba/contracts';
import { KEYS, type KeyValueStore } from './storage';

export type CodeChannel = 'email' | 'phone';
export type AuthError = { code: string; message: string };

/**
 * Provider-neutral auth port used by every screen. Implementations: Clerk (production) and the
 * development identity stub. Screens never see provider details; the API only ever trusts a
 * verified bearer token, never anything a client claims about the user.
 */
export interface AuthPort {
  readonly provider: 'clerk' | 'dev-stub' | 'none';
  readonly status: 'loading' | 'signedOut' | 'signedIn';
  readonly label: string | null;
  getToken(): Promise<string | null>;
  /** Step 1: send a one-time code. Creates the account if it does not exist yet. */
  startCode(channel: CodeChannel, identifier: string): Promise<{ error: AuthError | null }>;
  /** Step 2: verify the code and activate the session. */
  verifyCode(code: string): Promise<{ error: AuthError | null }>;
  signOut(): Promise<void>;
}

const Ctx = createContext<AuthPort | null>(null);

export function AuthContextProvider(props: { value: AuthPort; children: ReactNode }) {
  return <Ctx.Provider value={props.value}>{props.children}</Ctx.Provider>;
}

export function useAuth(): AuthPort {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside an auth provider');
  return v;
}

/** No provider configured: browsing works, anything needing an account explains why it can't. */
export function NoAuthProvider(props: { children: ReactNode }) {
  const value = useMemo<AuthPort>(() => ({
    provider: 'none', status: 'signedOut', label: null,
    getToken: async () => null,
    startCode: async () => ({ error: { code: 'NOT_CONFIGURED', message: 'Sign-in is not configured for this build.' } }),
    verifyCode: async () => ({ error: { code: 'NOT_CONFIGURED', message: 'Sign-in is not configured for this build.' } }),
    signOut: async () => undefined,
  }), []);
  return <AuthContextProvider value={value}>{props.children}</AuthContextProvider>;
}

/**
 * DEVELOPMENT ONLY. The "code" step is simulated: the identifier becomes the dev subject and
 * any 6-digit code is accepted locally, then the API's dev-token endpoint (refused by the server
 * outside development/test) issues a token. Lets the full UI run without a Clerk account.
 */
export function DevStubAuthProvider(props: { api: ApiClient; store: KeyValueStore; children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthPort['status']>('loading');
  const pending = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    props.store.get(KEYS.devToken).then((raw) => {
      if (!alive) return;
      if (raw) {
        try {
          const v = JSON.parse(raw) as { token: string; label: string; exp: number };
          if (v.exp > Date.now()) { setToken(v.token); setLabel(v.label); setStatus('signedIn'); return; }
        } catch { /* ignore */ }
      }
      setStatus('signedOut');
    });
    return () => { alive = false; };
  }, [props.store]);

  const subjectFrom = (id: string) => id.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 64).replace(/^-|-$/g, '');

  const startCode = useCallback(async (_channel: CodeChannel, identifier: string) => {
    const subject = subjectFrom(identifier);
    if (subject.length < 3) return { error: { code: 'INVALID_IDENTIFIER', message: 'Enter at least 3 letters or digits.' } };
    pending.current = subject;
    return { error: null };
  }, []);

  const verifyCode = useCallback(async (code: string) => {
    if (!pending.current) return { error: { code: 'NO_PENDING', message: 'Request a code first.' } };
    if (!/^\d{6}$/.test(code)) return { error: { code: 'INVALID_CODE', message: 'Enter the 6-digit code.' } };
    try {
      const r = await props.api.devToken({ subject: pending.current });
      setToken(r.token);
      setLabel(pending.current);
      setStatus('signedIn');
      await props.store.set(KEYS.devToken, JSON.stringify({ token: r.token, label: pending.current, exp: Date.now() + (r.expiresInSeconds - 60) * 1000 }));
      return { error: null };
    } catch {
      return { error: { code: 'DEV_STUB_UNAVAILABLE', message: 'The development sign-in is not available on this server.' } };
    }
  }, [props.api, props.store]);

  const value = useMemo<AuthPort>(() => ({
    provider: 'dev-stub', status, label,
    getToken: async () => token,
    startCode, verifyCode,
    signOut: async () => { setToken(null); setLabel(null); setStatus('signedOut'); await props.store.remove(KEYS.devToken); },
  }), [status, label, token, startCode, verifyCode, props.store]);

  return <AuthContextProvider value={value}>{props.children}</AuthContextProvider>;
}
