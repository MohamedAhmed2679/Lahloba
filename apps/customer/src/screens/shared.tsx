import { ApiError, NetworkError, type OfferCard } from '@lahloba/contracts';
import type { MessageKey, Vars } from '@lahloba/i18n';
import { BrandLockup, Button, Card, IllustrativeBadge, Row, Text, useLocale } from '@lahloba/ui';
import { formatMoney, pickLocalized } from '@lahloba/i18n';
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

/** One dish offer in a list (browse and search). */
export function OfferCardItem(props: { offer: OfferCard }) {
  const { nav } = useApp();
  const { t, locale } = useLocale();
  const o = props.offer;
  return (
    <Card testID={`offer-${o.offerId}`} onPress={() => nav.push(`/offers/${o.offerId}`)}
      accessibilityLabel={`${pickLocalized(locale, o.title.en, o.title.ar)}, ${t('results.byChef', { chef: o.chef.publicName })}`}>
      <Text variant="title">{pickLocalized(locale, o.title.en, o.title.ar)}</Text>
      <Text muted>{t('results.byChef', { chef: o.chef.publicName })} · {pickLocalized(locale, o.chef.area.en, o.chef.area.ar)}</Text>
      <Text>{t('results.labourBasis', { amount: formatMoney(o.laborPerPersonPiastres, locale) })}</Text>
      <Text variant="caption" muted>{t('results.leadTime', { minutes: o.leadTimeMinutes })}</Text>
      <IllustrativeBadge show={o.illustrative} />
    </Card>
  );
}
