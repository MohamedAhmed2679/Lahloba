import { ApiError, NetworkError } from '@lahloba/contracts';
import type { MessageKey, Vars } from '@lahloba/i18n';
import { BrandLockup, Button, Row, useLocale } from '@lahloba/ui';
import { pickLocalized } from '@lahloba/i18n';
import { useApp } from '../AppContext';

type T = (k: MessageKey, v?: Vars) => string;

export function errorMessage(t: T, error: unknown): string {
  if (error instanceof NetworkError) return t('common.error.network');
  if (error instanceof ApiError && error.status === 404) return t('common.error.generic');
  return t('common.error.generic');
}

/** Persistent header: back, current area (tap to change) and language. */
export function TopBar(props: { showBack?: boolean }) {
  const { nav, area } = useApp();
  const { t, locale } = useLocale();
  return (
    <Row wrap style={{ justifyContent: 'space-between' }}>
      {props.showBack !== false ? <Button variant="secondary" label={t('common.back')} onPress={() => nav.back()} testID="back" /> : <BrandLockup height={36} />}
      {area ? (
        <Button variant="secondary" label={`${pickLocalized(locale, area.label.en, area.label.ar)} · ${t('location.change')}`} onPress={() => nav.push('/location')} testID="change-area" />
      ) : null}
    </Row>
  );
}
