import { formatQuantity, pickLocalized } from '@lahloba/i18n';
import { Card, EmptyState, ErrorState, IllustrativeBadge, LoadingState, Screen, Text, WeightBasisBadge, useLocale } from '@lahloba/ui';
import { useApp, useAsync } from '../AppContext';
import { TopBar, errorMessage } from './shared';

/** C02: recipes browse without any area or login. */
export function LearnListScreen() {
  const { api, nav } = useApp();
  const { t, locale } = useLocale();
  const list = useAsync(() => api.recipes(), []);
  return (
    <Screen testID="learn">
      <TopBar />
      <Text variant="display" role="header">{t('learn.title')}</Text>
      {list.status === 'loading' ? <LoadingState /> : null}
      {list.status === 'error' ? <ErrorState message={errorMessage(t, list.error)} onRetry={list.reload} /> : null}
      {list.status === 'ready' && list.data.items.length === 0 ? <EmptyState message={t('learn.empty')} /> : null}
      {list.status === 'ready'
        ? list.data.items.map((r) => (
            <Card key={r.recipeId} onPress={() => nav.push(`/learn/${r.recipeId}`)} testID={`recipe-${r.recipeId}`}>
              <Text variant="title">{pickLocalized(locale, r.title.en, r.title.ar)}</Text>
              <Text muted>{t('results.byChef', { chef: r.chefName })}</Text>
              <IllustrativeBadge show={r.illustrative} />
            </Card>
          ))
        : null}
    </Screen>
  );
}

export function RecipeScreen(props: { recipeId: string }) {
  const { api } = useApp();
  const { t, locale } = useLocale();
  const r = useAsync(() => api.recipe(props.recipeId), [props.recipeId]);
  return (
    <Screen testID="recipe">
      <TopBar />
      {r.status === 'loading' ? <LoadingState /> : null}
      {r.status === 'error' ? <ErrorState message={errorMessage(t, r.error)} onRetry={r.reload} /> : null}
      {r.status === 'ready' ? (
        <>
          <Text variant="display" role="header">{pickLocalized(locale, r.data.title.en, r.data.title.ar)}</Text>
          <IllustrativeBadge show={r.data.illustrative} />
          <Text variant="title" role="header">{t('offer.ingredients')}</Text>
          <Text variant="caption" muted>{t('learn.servingsBasis')}</Text>
          {r.data.ingredients.map((i) => (
            <Card key={i.ingredientId}>
              <Text variant="label">{pickLocalized(locale, i.name.en, i.name.ar)}</Text>
              <Text>{t('offer.perServing', { qty: formatQuantity(i.quantityPerServing, i.unit, locale) })}</Text>
              <WeightBasisBadge basis={i.weightBasis} />
            </Card>
          ))}
          <Text variant="title" role="header">{t('learn.steps')}</Text>
          {r.data.steps.map((s, idx) => (
            <Text key={idx}>{`${idx + 1}. ${pickLocalized(locale, s.en, s.ar)}`}</Text>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
