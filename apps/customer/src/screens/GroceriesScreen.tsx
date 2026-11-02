import { useState } from 'react';
import type { GroceryCategoryList, GroceryProductList } from '@lahloba/contracts';
import { formatMoney, formatQuantity, pickLocalized } from '@lahloba/i18n';
import { Card, Chip, EmptyState, ErrorState, IllustrativeBadge, LoadingState, Notice, Row, Screen, Text, useLocale } from '@lahloba/ui';
import { useApp, useAsync } from '../AppContext';
import { TopBar, errorMessage } from './shared';

/** Groceries: supplier categories first, no cuisine step, no chef labor (doc 01 §1.4). Browse only in Slice 1. */
export function GroceriesScreen() {
  const { api, area, nav } = useApp();
  const { t, locale } = useLocale();
  const [category, setCategory] = useState<string | null>(null);
  const cats = useAsync<GroceryCategoryList | null>(async () => (area ? api.groceryCategories(area.id) : null), [area?.id]);
  const products = useAsync<GroceryProductList | null>(async () => (area && category ? api.groceryProducts(area.id, category) : null), [area?.id, category]);

  if (!area) return <Screen><TopBar /><EmptyState message={t('location.chooseManually')} actionLabel={t('location.change')} onAction={() => nav.push('/location')} /></Screen>;

  return (
    <Screen testID="groceries">
      <TopBar />
      <Text variant="display" role="header">{t('groceries.title')}</Text>
      {cats.status === 'loading' ? <LoadingState /> : null}
      {cats.status === 'error' ? <ErrorState message={errorMessage(t, cats.error)} onRetry={cats.reload} /> : null}
      {cats.status === 'ready' && cats.data?.serviceability === 'UNSUPPORTED_AREA' ? <Notice tone="warning">{t('location.unsupported')}</Notice> : null}
      {cats.status === 'ready' && cats.data?.serviceability === 'SERVICEABLE' ? (
        <>
          <Text variant="title" role="header">{t('groceries.categories')}</Text>
          <Row wrap>
            {cats.data.items.map((c) => (
              <Chip key={c.slug} testID={`category-${c.slug}`} label={pickLocalized(locale, c.label.en, c.label.ar)} count={c.productCount}
                selected={category === c.slug} disabled={c.productCount === 0} onToggle={() => setCategory(category === c.slug ? null : c.slug)} />
            ))}
          </Row>
        </>
      ) : null}
      {category && products.status === 'loading' ? <LoadingState /> : null}
      {category && products.status === 'error' ? <ErrorState message={errorMessage(t, products.error)} onRetry={products.reload} /> : null}
      {category && products.status === 'ready' && products.data ? (
        products.data.items.length === 0 ? <EmptyState message={t('groceries.empty')} /> : products.data.items.map((p) => (
          <Card key={p.productId} testID={`product-${p.productId}`}>
            <Text variant="label">{pickLocalized(locale, p.ingredient.en, p.ingredient.ar)}{p.brand ? ` · ${p.brand}` : ''}</Text>
            <Text>{formatMoney(p.pricePiastres, locale)} · {t('groceries.pack', { qty: formatQuantity(p.packQuantity, p.packUnit, locale) })}</Text>
            <Text variant="caption" muted>{t('groceries.from', { shop: p.shop.publicName })}</Text>
            {p.variableWeight ? <Text variant="caption" tone="warning">{t('groceries.variableWeight')}</Text> : null}
            <IllustrativeBadge show={p.illustrative} />
          </Card>
        ))
      ) : null}
    </Screen>
  );
}
