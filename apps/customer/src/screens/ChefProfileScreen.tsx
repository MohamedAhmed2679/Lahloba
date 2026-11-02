import { ApiError } from '@lahloba/contracts';
import { formatMoney, pickLocalized } from '@lahloba/i18n';
import { Card, EmptyState, ErrorState, IllustrativeBadge, LoadingState, Notice, Screen, Text, useLocale } from '@lahloba/ui';
import { useApp, useAsync } from '../AppContext';
import { TopBar, errorMessage } from './shared';

/** Public chef profile. Shows area only (never the kitchen address) and no unearned badges. */
export function ChefProfileScreen(props: { chefId: string }) {
  const { api, nav } = useApp();
  const { t, locale } = useLocale();
  const chef = useAsync(() => api.chef(props.chefId), [props.chefId]);

  return (
    <Screen testID="chef-profile">
      <TopBar />
      {chef.status === 'loading' ? <LoadingState /> : null}
      {chef.status === 'error' ? (
        chef.error instanceof ApiError && chef.error.status === 404
          ? <EmptyState message={t('chef.notFound')} />
          : <ErrorState message={errorMessage(t, chef.error)} onRetry={chef.reload} />
      ) : null}
      {chef.status === 'ready' ? (
        <>
          <Text variant="display" role="header">{chef.data.publicName}</Text>
          <IllustrativeBadge show={chef.data.illustrative} />
          <Text muted>{t('chef.area', { area: pickLocalized(locale, chef.data.area.en, chef.data.area.ar) })}</Text>
          {pickLocalized(locale, chef.data.bio.en, chef.data.bio.ar) ? <Text>{pickLocalized(locale, chef.data.bio.en, chef.data.bio.ar)}</Text> : null}
          {!chef.data.acceptingOrders ? <Notice tone="warning" testID="chef-closed">{t('chef.notAccepting')}</Notice> : null}
          <Text variant="caption" muted testID="no-claims">{t('chef.noVerifiedClaims')}</Text>
          <Text variant="title" role="header">{t('chef.menu')}</Text>
          {chef.data.offers.map((o) => (
            <Card key={o.offerId} onPress={() => nav.push(`/offers/${o.offerId}`)} testID={`chef-offer-${o.offerId}`}>
              <Text variant="label">{pickLocalized(locale, o.title.en, o.title.ar)}</Text>
              <Text variant="caption" muted>{t(`entry.${o.serviceMode}.title` as const)} · {t('results.labourBasis', { amount: formatMoney(o.laborPerPersonPiastres, locale) })}</Text>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
