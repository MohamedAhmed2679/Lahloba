import { useState } from 'react';
import { View } from 'react-native';
import type { OfferCard, OfferSearchResponse } from '@lahloba/contracts';
import type { ServiceMode } from '@lahloba/domain';
import { formatMoney, pickLocalized } from '@lahloba/i18n';
import { Button, Card, Chip, EmptyState, ErrorState, IllustrativeBadge, LoadingState, Notice, Row, Screen, Text, useLocale } from '@lahloba/ui';
import { useApp, useAsync } from '../AppContext';
import { TopBar, errorMessage } from './shared';

const toggle = (list: string[], slug: string) => (list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]);

/** C03/C04: independent cuisine and dish-type facets with eligible counts, reset and empty states. */
export function ResultsScreen(props: { mode: ServiceMode }) {
  const { api, area, nav } = useApp();
  const { t, locale } = useLocale();
  const [cuisine, setCuisine] = useState<string[]>([]);
  const [dishType, setDishType] = useState<string[]>([]);
  const [extra, setExtra] = useState<{ items: OfferCard[]; cursor: string | null } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const result = useAsync<OfferSearchResponse | null>(async () => {
    setExtra(null);
    if (!area) return null;
    return api.searchOffers({ area: area.id, mode: props.mode, cuisine, dishType });
  }, [area?.id, props.mode, cuisine.join(','), dishType.join(',')]);

  if (!area) {
    return (
      <Screen>
        <TopBar />
        <EmptyState message={t('location.chooseManually')} actionLabel={t('location.change')} onAction={() => nav.push('/location')} />
      </Screen>
    );
  }

  const modeTitle = t(`entry.${props.mode}.title` as const);
  const areaLabel = pickLocalized(locale, area.label.en, area.label.ar);
  const reset = () => {
    setCuisine([]);
    setDishType([]);
  };
  const selectedCount = cuisine.length + dishType.length;

  const loadMore = async (cursor: string, current: OfferCard[]) => {
    setLoadingMore(true);
    try {
      const r = await api.searchOffers({ area: area.id, mode: props.mode, cuisine, dishType, cursor });
      setExtra({ items: [...current, ...r.items], cursor: r.nextCursor });
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Screen testID="results">
      <TopBar />
      <Text variant="display" role="header">{t('results.title', { mode: modeTitle, area: areaLabel })}</Text>
      {result.status === 'loading' ? <LoadingState /> : null}
      {result.status === 'error' ? <ErrorState message={errorMessage(t, result.error)} onRetry={result.reload} /> : null}
      {result.status === 'ready' && result.data?.serviceability === 'UNSUPPORTED_AREA' ? (
        <Notice tone="warning" testID="results-unsupported">{t('results.unsupportedArea')}</Notice>
      ) : null}
      {result.status === 'ready' && result.data?.serviceability === 'SERVICEABLE' ? (() => {
        const data = result.data;
        const items = extra?.items ?? data.items;
        const cursor = extra ? extra.cursor : data.nextCursor;
        return (
          <>
            <View accessibilityRole="none" style={{ gap: 8 }} testID="filters">
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="title" role="header">{t('results.filters')}</Text>
                {selectedCount ? <Text variant="caption" testID="selected-count">{t('results.selectedCount', { count: selectedCount })}</Text> : null}
              </Row>
              <Text variant="label">{t('results.cuisine')}</Text>
              <Row wrap>
                {data.facetCounts.cuisine.map((f) => (
                  <Chip key={f.slug} testID={`cuisine-${f.slug}`} label={pickLocalized(locale, f.label.en, f.label.ar)} count={f.count}
                    selected={cuisine.includes(f.slug)} disabled={f.count === 0 && !cuisine.includes(f.slug)} onToggle={() => setCuisine((c) => toggle(c, f.slug))} />
                ))}
              </Row>
              <Text variant="label">{t('results.dishType')}</Text>
              <Row wrap>
                {data.facetCounts.dishType.map((f) => (
                  <Chip key={f.slug} testID={`dishtype-${f.slug}`} label={pickLocalized(locale, f.label.en, f.label.ar)} count={f.count}
                    selected={dishType.includes(f.slug)} disabled={f.count === 0 && !dishType.includes(f.slug)} onToggle={() => setDishType((c) => toggle(c, f.slug))} />
                ))}
              </Row>
              {selectedCount ? <Button variant="secondary" label={t('common.reset')} onPress={reset} testID="reset-filters" /> : null}
            </View>
            {items.length === 0 ? (
              <EmptyState message={t('results.empty')} actionLabel={selectedCount ? t('results.emptyAction') : undefined} onAction={selectedCount ? reset : undefined} />
            ) : (
              items.map((o) => (
                <Card key={o.offerId} testID={`offer-${o.offerId}`} onPress={() => nav.push(`/offers/${o.offerId}`)}
                  accessibilityLabel={`${pickLocalized(locale, o.title.en, o.title.ar)}, ${t('results.byChef', { chef: o.chef.publicName })}`}>
                  <Text variant="title">{pickLocalized(locale, o.title.en, o.title.ar)}</Text>
                  <Text muted>{t('results.byChef', { chef: o.chef.publicName })} · {pickLocalized(locale, o.chef.area.en, o.chef.area.ar)}</Text>
                  <Text>{t('results.labourBasis', { amount: formatMoney(o.laborPerPersonPiastres, locale) })}</Text>
                  <Text variant="caption" muted>{t('results.leadTime', { minutes: o.leadTimeMinutes })}</Text>
                  <IllustrativeBadge show={o.illustrative} />
                </Card>
              ))
            )}
            {cursor ? <Button variant="secondary" label={t('results.loadMore')} loading={loadingMore} onPress={() => loadMore(cursor, items)} testID="load-more" /> : null}
          </>
        );
      })() : null}
    </Screen>
  );
}
