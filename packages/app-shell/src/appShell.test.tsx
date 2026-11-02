import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '@lahloba/contracts';
import type { Locale } from '@lahloba/i18n';
import { LocaleProvider } from '@lahloba/ui';
import { AuthContextProvider, DevStubAuthProvider, KEYS, SignInScreen, memoryStore, normalizePhone, readJson, useAuth, type AuthPort } from './index';

afterEach(cleanup);

function L(props: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en');
  return <LocaleProvider locale={locale} setLocale={setLocale}>{props.children}</LocaleProvider>;
}

describe('phone normalisation', () => {
  it('accepts Egyptian local and international formats only', () => {
    expect(normalizePhone('010 1234 5678')).toBe('+201012345678');
    expect(normalizePhone('00201012345678')).toBe('+201012345678');
    expect(normalizePhone('+447700900123')).toBe('+447700900123');
    expect(normalizePhone('٠١٠١٢٣٤٥٦٧٨')).toBe('+201012345678');
    expect(normalizePhone('0131234567')).toBeNull();
    expect(normalizePhone('hello')).toBeNull();
  });
});

describe('storage', () => {
  it('discards corrupted values instead of crashing', async () => {
    const s = memoryStore({ [KEYS.area]: '{not json' });
    expect(await readJson(s, KEYS.area, (v): v is { id: string } => typeof v === 'object')).toBeNull();
    expect(s.dump()[KEYS.area]).toBeUndefined();
  });
});

describe('dev-stub auth', () => {
  function Probe() {
    const a = useAuth();
    return <span data-testid="probe">{`${a.provider}:${a.status}:${a.label ?? ''}`}</span>;
  }
  it('signs in through the API dev endpoint, persists the session and signs out', async () => {
    const store = memoryStore();
    const devToken = vi.fn(async () => ({ token: 'tok-1', expiresInSeconds: 3600, warning: '' }));
    render(<L><DevStubAuthProvider api={{ devToken } as unknown as ApiClient} store={store}><Probe /><SignInScreen onSignedIn={() => {}} /></DevStubAuthProvider></L>);
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('dev-stub:signedOut:'));
    expect(screen.getByTestId('auth-dev-notice')).toBeTruthy();
    fireEvent.change(screen.getByTestId('auth-identifier'), { target: { value: 'Test Chef' } });
    await act(async () => { fireEvent.click(screen.getByTestId('auth-send')); });
    fireEvent.change(screen.getByTestId('auth-code'), { target: { value: '123456' } });
    await act(async () => { fireEvent.click(screen.getByTestId('auth-verify')); });
    expect(devToken).toHaveBeenCalledWith({ subject: 'test-chef' });
    expect(screen.getByTestId('probe').textContent).toBe('dev-stub:signedIn:test-chef');
    expect(JSON.parse(store.dump()[KEYS.devToken]!).token).toBe('tok-1');
  });

  it('restores an unexpired stored session on start', async () => {
    const store = memoryStore({ [KEYS.devToken]: JSON.stringify({ token: 't', label: 'me', exp: Date.now() + 60_000 }) });
    render(<L><DevStubAuthProvider api={{} as ApiClient} store={store}><Probe /></DevStubAuthProvider></L>);
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('dev-stub:signedIn:me'));
  });
});

describe('sign-in screen with a real provider shape', () => {
  const fake = (over: Partial<AuthPort> = {}): AuthPort => ({
    provider: 'clerk', status: 'signedOut', label: null, getToken: async () => null,
    startCode: vi.fn(async () => ({ error: null })), verifyCode: vi.fn(async () => ({ error: null })), signOut: async () => undefined, ...over,
  });

  it('validates the phone number before calling the provider and normalises it', async () => {
    const auth = fake();
    const done = vi.fn();
    render(<L><AuthContextProvider value={auth}><SignInScreen onSignedIn={done} /></AuthContextProvider></L>);
    fireEvent.click(screen.getByTestId('auth-phone'));
    fireEvent.change(screen.getByTestId('auth-identifier'), { target: { value: '123' } });
    await act(async () => { fireEvent.click(screen.getByTestId('auth-send')); });
    expect(auth.startCode).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth-identifier-error').textContent).toMatch(/valid mobile/);
    fireEvent.change(screen.getByTestId('auth-identifier'), { target: { value: '01012345678' } });
    await act(async () => { fireEvent.click(screen.getByTestId('auth-send')); });
    expect(auth.startCode).toHaveBeenCalledWith('phone', '+201012345678');
    fireEvent.change(screen.getByTestId('auth-code'), { target: { value: '654321' } });
    await act(async () => { fireEvent.click(screen.getByTestId('auth-verify')); });
    expect(auth.verifyCode).toHaveBeenCalledWith('654321');
    expect(done).toHaveBeenCalled();
  });

  it('shows the provider error and stays on the code step', async () => {
    const auth = fake({ verifyCode: vi.fn(async () => ({ error: { code: 'form_code_incorrect', message: 'Incorrect code' } })) });
    render(<L><AuthContextProvider value={auth}><SignInScreen onSignedIn={() => {}} /></AuthContextProvider></L>);
    fireEvent.change(screen.getByTestId('auth-identifier'), { target: { value: 'me@example.com' } });
    await act(async () => { fireEvent.click(screen.getByTestId('auth-send')); });
    fireEvent.change(screen.getByTestId('auth-code'), { target: { value: '000000' } });
    await act(async () => { fireEvent.click(screen.getByTestId('auth-verify')); });
    expect(screen.getByTestId('auth-code-error').textContent).toMatch(/Incorrect code/);
  });

  it('starts on email and explains phone countries that are not enabled', async () => {
    const auth = fake({ startCode: vi.fn(async () => ({ error: { code: 'phone_country_not_supported', message: 'Phone numbers from this country (Egypt) are currently not supported.' } })) });
    render(<L><AuthContextProvider value={auth}><SignInScreen onSignedIn={() => {}} /></AuthContextProvider></L>);
    expect(screen.getByText('Email address')).toBeTruthy();
    fireEvent.click(screen.getByTestId('auth-phone'));
    fireEvent.change(screen.getByTestId('auth-identifier'), { target: { value: '01011019117' } });
    await act(async () => { fireEvent.click(screen.getByTestId('auth-send')); });
    expect(screen.getByTestId('auth-identifier-error').textContent).toMatch(/use your email/);
  });

  it('explains when no provider is configured', () => {
    render(<L><AuthContextProvider value={fake({ provider: 'none' })}><SignInScreen onSignedIn={() => {}} /></AuthContextProvider></L>);
    expect(screen.getByTestId('auth-not-configured')).toBeTruthy();
  });
});
