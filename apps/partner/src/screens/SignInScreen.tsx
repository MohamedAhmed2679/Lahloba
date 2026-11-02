import { SignInScreen as SharedSignIn } from '@lahloba/app-shell';
import { BrandLockup, LanguageSwitch, Row, useLocale } from '@lahloba/ui';
import { usePartner } from '../PartnerContext';

/** Partner sign-in: the shared one-time-code flow (Clerk in production, dev stub in development). */
export function SignInScreen() {
  const { nav } = usePartner();
  const { t } = useLocale();
  return (
    <SharedSignIn
      onSignedIn={() => nav.replace('/roles')}
      intro={t('partner.signInIntro')}
      header={<Row style={{ justifyContent: 'space-between' }}><BrandLockup height={36} /><LanguageSwitch /></Row>}
    />
  );
}
