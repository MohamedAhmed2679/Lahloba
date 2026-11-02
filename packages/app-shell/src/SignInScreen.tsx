import { useState } from 'react';
import { BrandLockup, Button, Chip, Notice, Row, Screen, Text, TextField, useLocale } from '@lahloba/ui';
import { useAuth, type CodeChannel } from './auth';

/** Egypt-first phone normalisation to E.164. Returns null when it is not a plausible number. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s()-]/g, '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  if (/^0020\d{10}$/.test(digits)) return `+${digits.slice(2)}`;
  if (/^01[0125]\d{8}$/.test(digits)) return `+2${digits}`;
  return null;
}
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** One-time-code sign-in (email or phone). Creates the account on first use. */
export function SignInScreen(props: { onSignedIn: () => void; header?: React.ReactNode; intro?: string }) {
  const auth = useAuth();
  const { t } = useLocale();
  // Email first: SMS to Egypt needs the Clerk application's country allowlist to include it.
  const [channel, setChannel] = useState<CodeChannel>('email');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'identify' | 'verify'>('identify');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.provider === 'none') {
    return (
      <Screen testID="sign-in">
        {props.header}
        <Notice tone="warning" testID="auth-not-configured">{t('auth.notConfigured')}</Notice>
      </Screen>
    );
  }

  const send = async () => {
    const id = channel === 'phone' ? normalizePhone(identifier) : isEmail(identifier) ? identifier.trim() : null;
    if (!id && auth.provider !== 'dev-stub') return setError(channel === 'phone' ? t('auth.invalidPhone') : t('auth.invalidEmail'));
    setBusy(true);
    setError(null);
    const r = await auth.startCode(channel, id ?? identifier);
    setBusy(false);
    if (r.error) {
      const unsupportedCountry = channel === 'phone' && (/country/i.test(r.error.code) || /country.*not supported|not supported.*country/i.test(r.error.message));
      return setError(unsupportedCountry ? t('auth.phoneCountryUnsupported') : r.error.message);
    }
    setStep('verify');
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code.trim())) return setError(t('auth.invalidCode'));
    setBusy(true);
    setError(null);
    const r = await auth.verifyCode(code.trim());
    setBusy(false);
    if (r.error) return setError(r.error.message);
    props.onSignedIn();
  };

  return (
    <Screen testID="sign-in">
      {props.header ?? <BrandLockup height={40} />}
      <Text variant="heading" role="header" testID="auth-title">{t('auth.title')}</Text>
      <Text muted>{props.intro ?? t('auth.subtitle')}</Text>
      {auth.provider === 'dev-stub' ? <Notice tone="warning" testID="auth-dev-notice">{t('auth.devNotice')}</Notice> : null}
      {step === 'identify' ? (
        <>
          <Row>
            <Chip label={t('auth.usePhone')} selected={channel === 'phone'} onToggle={() => setChannel('phone')} testID="auth-phone" />
            <Chip label={t('auth.useEmail')} selected={channel === 'email'} onToggle={() => setChannel('email')} testID="auth-email" />
          </Row>
          <TextField
            label={channel === 'phone' ? t('auth.phone') : t('auth.email')}
            hint={channel === 'phone' ? t('auth.phoneHint') : undefined}
            value={identifier}
            onChangeText={setIdentifier}
            keyboardType={channel === 'phone' ? 'phone-pad' : 'email-address'}
            autoCapitalize="none"
            ltr
            error={error}
            testID="auth-identifier"
          />
          <Button label={t('auth.sendCode')} onPress={send} loading={busy} testID="auth-send" />
        </>
      ) : (
        <>
          <Notice testID="auth-code-sent">{t('auth.codeSent', { to: identifier })}</Notice>
          <TextField label={t('auth.code')} value={code} onChangeText={setCode} keyboardType="numeric" ltr error={error} testID="auth-code" />
          <Button label={t('auth.verify')} onPress={verify} loading={busy} testID="auth-verify" />
          <Button variant="tertiary" label={t('auth.changeIdentifier')} onPress={() => { setStep('identify'); setCode(''); setError(null); }} />
        </>
      )}
    </Screen>
  );
}
