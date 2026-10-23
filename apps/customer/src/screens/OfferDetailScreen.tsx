import { useEffect, useState } from 'react';
import { ApiError } from '@lahloba/contracts';
import { laborTotal } from '@lahloba/domain';
import { formatMoney, formatQuantity, formatSlot, pickLocalized } from '@lahloba/i18n';
import {
  Button, Card, Chip, EmptyState, ErrorState, IllustrativeBadge, IngredientLineView, LoadingState, Notice, Row, Screen,
  ServingStepper, Text, useLocale,
} from '@lahloba/ui';
import { useApp, useAsync } from '../AppContext';
import { TopBar, errorMessage } from './shared';

/**
 * C05/C06/C07 dish & variant detail (doc 02 §2.3 content hierarchy). Servings changes recompute
 * labor with integer piastres (10 EGP x 4 = 40 EGP). The order block picks who buys the
 * ingredients and a kitchen time, then the server prices everything at checkout.
 */
export function OfferDetailScreen(props: { offerId: string }) {
  const { api, nav } = useApp();
  const { t, locale } = useLocale();
  const offer = useAsync(() => api.offer(props.offerId), [props.offerId]);
  const [servings, setServings] = useState<number | null>(null);
  const [source, setSource] = useState<'CHEF' | 'SUPPLIERS' | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);

  useEffect(() => {
    if (offer.status === 'ready') setServings((s) => s ?? offer.data.servingRules.minServings);
  }, [offer.status]);

  if (offer.status === 'loading') return <Screen><TopBar /><LoadingState /></Screen>;
  if (offer.status === 'error') {
    return (
      <Screen>
        <TopBar />
        {offer.error instanceof ApiError && offer.error.status === 404
          ? <EmptyState message={t('offer.notFound')} />
          : <ErrorState message={errorMessage(t, offer.error)} onRetry={offer.reload} />}
      </Screen>
    );
  }
  const o = offer.data;
  const n = servings ?? o.servingRules.minServings;
  const money = (p: number) => formatMoney(p, locale);

  return (
    <Screen testID="offer-detail">
      <TopBar />
      <Text variant="display" role="header">{pickLocalized(locale, o.title.en, o.title.ar)}</Text>
      <IllustrativeBadge show={o.illustrative} />
      <Text variant="label">{t('offer.variants')}</Text>
      <Row wrap>
        <Chip label={t(`entry.${o.serviceMode}.title` as const)} selected onToggle={() => {}} testID="variant-current" />
        {o.siblingVariants.map((v) => (
          <Chip key={v.offerId} label={t(`entry.${v.serviceMode}.title` as const)} selected={false} onToggle={() => nav.replace(`/offers/${v.offerId}`)} testID={`variant-${v.serviceMode}`} />
        ))}
      </Row>
      <Card onPress={() => nav.push(`/chefs/${o.chef.id}`)} testID="offer-chef">
        <Text variant="label">{o.chef.publicName}</Text>
        <Text variant="caption" muted>{t('chef.area', { area: pickLocalized(locale, o.chef.area.en, o.chef.area.ar) })}</Text>
      </Card>
      {!o.chef.acceptingOrders ? <Notice tone="warning">{t('chef.notAccepting')}</Notice> : null}

      <ServingStepper value={n} rules={o.servingRules} onChange={setServings} />
      <Text testID="labour-line">{t('offer.labour', { per: money(o.laborPerPersonPiastres), total: money(laborTotal(o.laborPerPersonPiastres, n)) })}</Text>
      {o.packagingPiastres > 0 ? <Text>{t('offer.packaging', { amount: money(o.packagingPiastres) })}</Text> : null}
      {o.portion ? (
        <Text variant="caption" muted>
          {t('offer.portion', { qty: formatQuantity(o.portion.grams, 'g', locale), basis: t(`offer.weightBasis.${o.portion.basis}` as const) })}
        </Text>
      ) : null}
      <Text variant="caption" muted>{t('results.leadTime', { minutes: o.leadTimeMinutes })}</Text>
      {o.availability === 'FULLY_BOOKED' ? <Notice tone="warning" testID="offer-fully-booked">{t('offer.fullyBooked')}</Notice>
        : o.availability === 'KITCHEN_CLOSED' ? <Notice tone="warning" testID="offer-kitchen-closed">{t('offer.kitchenClosed')}</Notice>
        : (
          <Card testID="offer-slots">
            <Text variant="label">{t('offer.nextTimes')}</Text>
            {o.slots.slice(0, 3).map((s) => (
              <Text key={s.slotId} variant="caption" testID="offer-slot">{t('offer.slotUpTo', { when: formatSlot(s.startsAt, s.endsAt, locale), count: s.maxServings })}</Text>
            ))}
            {o.slots.length > 0 && !o.slots.some((s) => s.maxServings >= n)
              ? <Text tone="warning" variant="caption" testID="offer-slot-too-small">⚠ {t('offer.slotTooSmall', { count: n })}</Text> : null}
          </Card>
        )}

      <Text variant="title" role="header">{t('offer.ingredients')}</Text>
      {o.ingredients.map((i) => (
        <IngredientLineView key={i.ingredientId} name={pickLocalized(locale, i.name.en, i.name.ar)} quantityPerServing={i.quantityPerServing}
          unit={i.unit} servings={n} weightBasis={i.weightBasis} isPantry={i.isPantry} allergenDataStatus={i.allergenDataStatus} allergens={i.allergens} />
      ))}

      <Text variant="title" role="header">{t('offer.instructions')}</Text>
      <Text>{pickLocalized(locale, o.safetyInstructions.en, o.safetyInstructions.ar)}</Text>

      {o.chefIngredientsOffered ? <Text>• {t('offer.sourcing.chef')}</Text> : null}
      {o.supplierSourcingAllowed ? <Text>• {t('offer.sourcing.suppliers')}</Text> : null}
      {o.availability === 'AVAILABLE' && o.chef.acceptingOrders ? (() => {
        const sources = [...(o.chefIngredientsOffered ? ['CHEF' as const] : []), ...(o.supplierSourcingAllowed ? ['SUPPLIERS' as const] : [])];
        const chosenSource = source ?? sources[0] ?? null;
        const fitting = o.slots.filter((x) => x.maxServings >= n);
        const chosenSlot = fitting.find((x) => x.slotId === slotId) ?? fitting[0] ?? null;
        return (
          <Card testID="order-block">
            <Text variant="title" role="header">{t('order.chooseSource')}</Text>
            {sources.map((src) => (
              <Card key={src} selected={chosenSource === src} onPress={() => setSource(src)} accessibilityLabel={t(`order.source.${src}` as const)} testID={`source-${src}`}>
                <Text variant="label">{chosenSource === src ? '✓ ' : ''}{t(`order.source.${src}` as const)}</Text>
                <Text variant="caption" muted>
                  {src === 'CHEF' && o.chefIngredientsPerServingPiastres !== null ? t('order.source.CHEF.hint', { amount: money(o.chefIngredientsPerServingPiastres) }) : t('order.source.SUPPLIERS.hint')}
                </Text>
              </Card>
            ))}
            <Text variant="label">{t('order.chooseTime')}</Text>
            {fitting.length ? (
              <Row wrap>
                {fitting.slice(0, 6).map((x) => (
                  <Chip key={x.slotId} label={formatSlot(x.startsAt, x.endsAt, locale)} selected={chosenSlot?.slotId === x.slotId} onToggle={() => setSlotId(x.slotId)} testID="slot-chip" />
                ))}
              </Row>
            ) : <Text tone="warning">{t('order.noSlots')}</Text>}
            <Button label={t('offer.compareCta')} disabled={!chosenSource || !chosenSlot}
              onPress={() => nav.push(`/checkout?offerId=${o.offerId}&servings=${n}&source=${chosenSource}&slotId=${chosenSlot!.slotId}`)} testID="compare-cta" />
          </Card>
        );
      })() : null}
    </Screen>
  );
}
