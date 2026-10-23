import { useEffect, useRef, useState } from 'react';
import { ApiError, NetworkError, newIdempotencyKey, type QuoteDto } from '@lahloba/contracts';
import { formatMoney, formatQuantity, formatSlot, formatTime, pickLocalized, type MessageKey } from '@lahloba/i18n';
import { KEYS, SignInScreen, readJson, useAuth } from '@lahloba/app-shell';
import { Button, Card, Chip, LoadingState, Notice, Row, Screen, Text, TextField, useLocale } from '@lahloba/ui';
import { useApp } from '../AppContext';
import { TopBar } from './shared';

type SavedAddress = { addressId: string; areaId: string; text: string };
const KNOWN = ['SLOT_UNAVAILABLE', 'CAPACITY_UNAVAILABLE', 'BASKET_INCOMPLETE', 'UNSERVICEABLE', 'OUTSIDE_CHEF_AREA', 'AREA_NOT_SERVED', 'QUOTE_EXPIRED',
  'QUOTE_STALE', 'INVENTORY_UNAVAILABLE', 'TOO_MANY_STOPS', 'CHEF_NOT_ACCEPTING', 'ORDERING_DISABLED'] as const;

/**
 * C08-C10 checkout: the server prices everything (cooking fee, ingredients, both delivery legs)
 * and the customer sees who each amount is paid to. Supplier baskets can be compared per
 * ingredient. Payments are SANDBOX only in this build.
 */
export function CheckoutScreen(props: { offerId: string; servings: number; source: 'CHEF' | 'SUPPLIERS'; slotId: string }) {
  const { api, nav, area, store } = useApp();
  const auth = useAuth();
  const { t, locale } = useLocale();
  const [saved, setSaved] = useState<SavedAddress | null>(null);
  const [useSaved, setUseSaved] = useState(true);
  const [text, setText] = useState('');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const orderKey = useRef(newIdempotencyKey());

  useEffect(() => {
    void readJson<SavedAddress>(store, KEYS.checkoutDraft, (v): v is SavedAddress => typeof v === 'object' && v !== null && typeof (v as SavedAddress).addressId === 'string')
      .then((v) => setSaved(v));
  }, [store]);

  const money = (p: number) => formatMoney(p, locale);
  const explain = (e: unknown) => {
    if (e instanceof NetworkError) return t('common.error.network');
    if (e instanceof ApiError && (KNOWN as readonly string[]).includes(e.code)) {
      const missing = (e.details as { missing?: string[] } | undefined)?.missing ?? [];
      return t(`err.${e.code}` as MessageKey, { items: missing.join(', ') });
    }
    return t('common.error.generic');
  };

  if (auth.status === 'loading') return <Screen><TopBar /><LoadingState /></Screen>;
  if (auth.status !== 'signedIn') {
    return <SignInScreen header={<TopBar />} intro={t('checkout.signInFirst')} onSignedIn={() => undefined} />;
  }
  if (!area) {
    return (
      <Screen>
        <TopBar />
        <Notice tone="warning">{t('location.subtitle')}</Notice>
        <Button label={t('location.title')} onPress={() => nav.push('/location')} />
      </Screen>
    );
  }

  const savedHere = saved && saved.areaId === area.id ? saved : null;
  const getPrice = async (choices?: Array<{ ingredientId: string; productId: string }>) => {
    setError(null);
    const addr = quote ? { addressId: quote.addressId } : savedHere && useSaved ? { addressId: savedHere.addressId } : null;
    if (!addr && text.trim().length < 5) { setFieldError(t('partner.form.required')); return; }
    setFieldError(null);
    setBusy(true);
    try {
      const q = await api.quote({
        offerId: props.offerId, servings: props.servings, source: props.source, slotId: props.slotId,
        ...(addr ?? { address: { addressText: text.trim(), areaId: area.id, ...(label.trim() ? { label: label.trim() } : {}), ...(notes.trim() ? { accessNotes: notes.trim() } : {}) } }),
        ...(choices ? { supplierChoices: choices } : {}),
      });
      setQuote(q);
      if (!addr) await store.set(KEYS.checkoutDraft, JSON.stringify({ addressId: q.addressId, areaId: area.id, text: text.trim() }));
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const choose = (ingredientId: string, productId: string) => {
    if (!quote) return;
    const choices = quote.basket.filter((b) => b.chosen).map((b) => ({ ingredientId: b.ingredientId, productId: b.ingredientId === ingredientId ? productId : b.chosen!.productId }));
    void getPrice(choices);
  };

  const place = async () => {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const order = await api.createOrder(quote.id, orderKey.current);
      nav.replace(`/orders/${order.id}`);
    } catch (e) {
      setError(explain(e));
      if (e instanceof ApiError && ['QUOTE_EXPIRED', 'QUOTE_STALE', 'INVENTORY_UNAVAILABLE'].includes(e.code)) { setQuote(null); orderKey.current = newIdempotencyKey(); }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="checkout">
      <TopBar />
      <Text variant="display" role="header">{t('checkout.title')}</Text>
      <Notice tone="warning" testID="sandbox-banner">{t('checkout.sandbox')}</Notice>

      <Text variant="title" role="header">{t('checkout.address')}</Text>
      <Text variant="caption" muted>{t('checkout.areaFixed', { area: pickLocalized(locale, area.label.en, area.label.ar) })}</Text>
      {quote ? null : savedHere && useSaved ? (
        <Card testID="saved-address">
          <Text>{t('checkout.useSaved', { text: savedHere.text })}</Text>
          <Button variant="tertiary" label={t('checkout.newAddress')} onPress={() => setUseSaved(false)} testID="new-address" />
        </Card>
      ) : (
        <>
          <TextField label={t('checkout.addressText')} value={text} onChangeText={setText} multiline error={fieldError ?? undefined} testID="address-text" />
          <TextField label={t('checkout.addressLabel')} value={label} onChangeText={setLabel} testID="address-label" />
          <TextField label={t('checkout.accessNotes')} value={notes} onChangeText={setNotes} testID="address-notes" />
        </>
      )}
      <Text variant="caption" muted>{t('checkout.addressHint')}</Text>

      {error ? <Notice tone="danger" testID="checkout-error">{error}</Notice> : null}
      {!quote ? <Button label={t('checkout.getPrice')} onPress={() => getPrice()} loading={busy} testID="get-price" /> : (
        <>
          <Card testID="quote-summary">
            <Text variant="label">{t('checkout.when', { dish: pickLocalized(locale, quote.dishTitle.en, quote.dishTitle.ar), count: quote.servings, when: formatSlot(quote.slot.startsAt, quote.slot.endsAt, locale) })}</Text>
            <Text variant="caption" muted>{quote.chef.publicName}</Text>
          </Card>

          {quote.basket.length ? (
            <>
              <Text variant="title" role="header">{t('checkout.basket')}</Text>
              <Text variant="caption" muted>{t('checkout.basketHint')}</Text>
              {quote.basket.map((b) => (
                <Card key={b.ingredientId} testID={`basket-${b.ingredientId}`}>
                  <Text variant="label">{pickLocalized(locale, b.name.en, b.name.ar)} · {formatQuantity(b.requiredQuantity, b.unit as 'g', locale)}</Text>
                  {b.options.map((op) => (
                    <Chip key={op.productId} selected={b.chosen?.productId === op.productId} onToggle={() => choose(b.ingredientId, op.productId)} testID={`option-${op.productId}`}
                      label={`${t('checkout.option', { shop: op.branchName, packs: op.packs, pack: formatQuantity(op.packQuantity, op.packUnit as 'g', locale), price: money(op.amountPiastres) })}${op.leftoverQuantity > 0 ? ` · ${t('checkout.leftover', { qty: formatQuantity(op.leftoverQuantity, op.packUnit as 'g', locale) })}` : ''}`} />
                  ))}
                </Card>
              ))}
            </>
          ) : null}
          {quote.pantryNote.length ? <Text variant="caption" muted>{t('checkout.pantry', { items: quote.pantryNote.map((p) => pickLocalized(locale, p.en, p.ar)).join(locale === 'ar' ? '، ' : ', ') })}</Text> : null}

          <Text variant="title" role="header">{t('checkout.lines')}</Text>
          <Card testID="price-lines">
            {quote.lines.map((l, i) => (
              <Row key={i} style={{ justifyContent: 'space-between' }}>
                <Text style={{ flex: 1 }}>
                  {t(`component.${l.component}` as const)}
                  <Text variant="caption" muted>{`\n${t('checkout.paidTo', { name: l.recipientName })}`}</Text>
                </Text>
                <Text variant="price">{money(l.amountPiastres)}</Text>
              </Row>
            ))}
            <Text variant="priceLarge" testID="quote-total">{t('checkout.total', { amount: money(quote.totalPiastres) })}</Text>
            <Text variant="caption" muted>{t('checkout.heldUntil', { time: formatTime(quote.expiresAt) })}</Text>
          </Card>
          <Button label={t('checkout.placeOrder')} onPress={place} loading={busy} testID="place-order" />
        </>
      )}
    </Screen>
  );
}
