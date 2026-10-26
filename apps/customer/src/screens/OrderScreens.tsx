import { useEffect, useRef, useState } from 'react';
import { ApiError, newIdempotencyKey, type OrderDto, type PaymentSessionDto } from '@lahloba/contracts';
import { formatMoney, formatSlot, formatTime, pickLocalized, type MessageKey } from '@lahloba/i18n';
import { KEYS, SignInScreen, useAuth } from '@lahloba/app-shell';
import { OsmMap } from '@lahloba/app-shell/map';
import { Button, Card, Chip, EmptyState, ErrorState, LoadingState, Notice, Row, Screen, StatusBadge, Text, useLocale } from '@lahloba/ui';
import { useApp, useAsync } from '../AppContext';
import { TopBar, errorMessage } from './shared';

type T = (k: MessageKey, v?: Record<string, string | number>) => string;

/** One status line from the independent fulfilment and funding states (never conflated). */
export function orderStatus(o: Pick<OrderDto, 'fulfillmentState' | 'fundingState'>, t: T): { label: string; status: 'confirmed' | 'pending' | 'progress' | 'failed' } {
  if (o.fulfillmentState === 'CANCELLED') return { label: t('order.status.CANCELLED'), status: 'failed' };
  if (o.fulfillmentState === 'DELIVERED') return { label: t('order.status.DELIVERED'), status: 'confirmed' };
  if (o.fulfillmentState === 'ON_HOLD') return { label: t('order.status.ON_HOLD'), status: 'pending' };
  if (o.fulfillmentState === 'RESERVED') {
    if (o.fundingState === 'FUNDED') return { label: t('order.status.awaitingConfirm'), status: 'pending' };
    if (o.fundingState === 'PARTIALLY_FUNDED') return { label: t('order.status.partlyPaid'), status: 'pending' };
    return { label: t('order.status.awaitingPayment'), status: 'pending' };
  }
  return { label: t(`order.status.${o.fulfillmentState}` as MessageKey), status: 'progress' };
}

const TERMINAL = (o: OrderDto) => o.fulfillmentState === 'DELIVERED' || (o.fulfillmentState === 'CANCELLED' && o.fundingState !== 'COMPENSATING');

export function OrderScreen(props: { orderId: string }) {
  const { api, nav } = useApp();
  const auth = useAuth();
  const { t, locale } = useLocale();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [session, setSession] = useState<PaymentSessionDto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const keys = useRef({ pay: newIdempotencyKey(), sim: newIdempotencyKey(), cancel: newIdempotencyKey() });

  const load = async () => {
    try { setOrder(await api.order(props.orderId)); setError(null); } catch (e) { setError(e); }
  };
  useEffect(() => {
    if (auth.status !== 'signedIn') return;
    void load();
    const timer = setInterval(() => { if (!order || !TERMINAL(order)) void load(); }, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.orderId, auth.status, order?.fulfillmentState, order?.fundingState]);

  if (auth.status === 'loading') return <Screen><TopBar /><LoadingState /></Screen>;
  if (auth.status !== 'signedIn') return <SignInScreen header={<TopBar />} onSignedIn={() => undefined} />;
  if (error && !order) return <Screen><TopBar /><ErrorState message={errorMessage(t, error)} onRetry={load} /></Screen>;
  if (!order) return <Screen><TopBar /><LoadingState /></Screen>;
  const o = order;
  const money = (p: number) => formatMoney(p, locale);
  const st = orderStatus(o, t);
  const unpaid = o.allocations.filter((a) => a.state !== 'PAID').reduce((n, a) => n + a.amountPiastres, 0);
  const canPay = o.fulfillmentState === 'RESERVED' && (o.fundingState === 'UNFUNDED' || o.fundingState === 'PARTIALLY_FUNDED');
  const canCancel = o.fulfillmentState === 'RESERVED' && o.chefAcceptance !== 'ACCEPTED';
  const mealLeg = o.legs.find((l) => l.kind === 'MEAL_TO_CUSTOMER');
  const showCode = o.dropoffCode && mealLeg && ['ASSIGNED', 'PICKED_UP'].includes(mealLeg.state);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setActionError(null);
    try { await fn(); await load(); } catch (e) {
      setActionError(e instanceof ApiError && ['PAYMENT_WINDOW_CLOSED', 'PAYMENT_RECONCILING', 'TOO_LATE_TO_CANCEL'].includes(e.code) ? t(`err.${e.code}` as MessageKey) : errorMessage(t, e));
    } finally { setBusy(false); }
  };
  const startPay = () => run(async () => { setSession(await api.startPayment(o.id, keys.current.pay)); keys.current.pay = newIdempotencyKey(); });
  const simulate = (outcome: 'SUCCEED' | 'DECLINE' | 'TIMEOUT') => run(async () => {
    await api.simulatePayment(session!.sessionId, { outcome }, keys.current.sim);
    keys.current.sim = newIdempotencyKey();
    setSession(null);
  });
  const reasonText = o.cancelReason ? t(`cancel.${o.cancelReason.startsWith('CUSTOMER') ? 'CUSTOMER' : o.cancelReason}` as MessageKey) : '';
  const legLabel = (state: string, name: string | null) => t(`leg.state.${state}` as MessageKey, { name: name ?? t('leg.courierFallback') });
  const markers = o.legs.flatMap((l) => [l.from, l.to]).filter((p): p is NonNullable<typeof p> => !!p)
    .filter((p, i, all) => all.findIndex((q) => q.lat === p.lat && q.lng === p.lng) === i)
    .map((p, i, all) => ({ lat: p.lat, lng: p.lng, label: pickLocalized(locale, p.label.en, p.label.ar), kind: i === all.length - 1 ? 'end' as const : 'start' as const }));
  const routes = o.legs.filter((l) => l.from && l.to && l.state !== 'CANCELLED').map((l) => ({ from: l.from!, to: l.to!, done: l.state === 'DELIVERED' }));

  return (
    <Screen testID="order-screen">
      <TopBar />
      <Text variant="caption" muted>{t('order.ref', { ref: o.reference })}</Text>
      <Text variant="display" role="header">{pickLocalized(locale, o.dishTitle.en, o.dishTitle.ar)}</Text>
      <StatusBadge status={st.status} label={st.label} testID="order-status" />
      <Text variant="caption" muted>{t('checkout.when', { dish: o.chef.publicName, count: o.servings, when: formatSlot(o.slot.startsAt, o.slot.endsAt, locale) })}</Text>
      <Notice tone="warning">{t('checkout.sandbox')}</Notice>
      {o.fulfillmentState === 'CANCELLED' ? <Notice tone="danger" testID="order-cancelled">{t('order.cancelledBecause', { reason: reasonText })}</Notice> : null}
      {o.fundingState === 'COMPENSATING' ? <Notice tone="info">{t('order.refunding')}</Notice> : null}
      {o.fundingState === 'COMPENSATED' ? <Notice tone="success" testID="order-refunded">{t('order.refunded')}</Notice> : null}

      {showCode ? (
        <Card testID="dropoff-code">
          <Text variant="label">{t('order.code')}</Text>
          <Text variant="display" style={{ letterSpacing: 8 }} testID="dropoff-code-value">{o.dropoffCode}</Text>
          <Text variant="caption" muted>{t('order.codeHint')}</Text>
        </Card>
      ) : null}

      {canPay ? (
        <Card testID="pay-card">
          {o.payBy ? <Text>{t('order.payBy', { time: formatTime(o.payBy) })}</Text> : null}
          {session ? (
            <Card testID="sandbox-pay">
              <Text variant="title" role="header">{t('pay.title')}</Text>
              <Text variant="caption" muted>{t('pay.explain')}</Text>
              <Text variant="priceLarge">{money(session.attempts.filter((a) => a.state === 'PENDING').reduce((n, a) => n + a.amountPiastres, 0))}</Text>
              <Button label={t('pay.succeed')} onPress={() => simulate('SUCCEED')} loading={busy} testID="pay-succeed" />
              <Button variant="secondary" label={t('pay.decline')} onPress={() => simulate('DECLINE')} disabled={busy} testID="pay-decline" />
              <Button variant="tertiary" label={t('pay.timeout')} onPress={() => simulate('TIMEOUT')} disabled={busy} testID="pay-timeout" />
            </Card>
          ) : (
            <Button label={o.fundingState === 'PARTIALLY_FUNDED' ? t('order.payRemaining', { amount: money(unpaid) }) : t('order.pay', { amount: money(o.totalPiastres) })}
              onPress={startPay} loading={busy} testID="pay-start" />
          )}
        </Card>
      ) : null}
      {actionError ? <Notice tone="danger" testID="order-action-error">{actionError}</Notice> : null}

      {o.legs.length && o.fulfillmentState !== 'CANCELLED' ? (
        <>
          <Text variant="title" role="header">{t('order.tracking')}</Text>
          {markers.length ? <OsmMap markers={markers} routes={routes} summary={t('order.mapSummary', { route: markers.map((m) => m.label).join(' → ') })} testID="order-map" /> : null}
          {o.legs.map((l) => (
            <Row key={l.legId} style={{ justifyContent: 'space-between' }}>
              <Text variant="label">{t(`leg.${l.kind}` as MessageKey)}</Text>
              <Text testID={`leg-${l.kind}`}>{legLabel(l.state, l.courierName)}</Text>
            </Row>
          ))}
        </>
      ) : null}

      <Text variant="title" role="header">{t('order.payments')}</Text>
      <Card testID="allocations">
        {o.allocations.map((a) => (
          <Row key={a.allocationId} style={{ justifyContent: 'space-between' }}>
            <Text style={{ flex: 1 }}>{a.recipientName}<Text variant="caption" muted>{`\n${a.components.map((c) => t(`component.${c}` as MessageKey)).join(' · ')}`}</Text></Text>
            <Text variant="price">{money(a.amountPiastres)}</Text>
            <StatusBadge status={a.state === 'PAID' ? 'confirmed' : a.state === 'FAILED' ? 'failed' : a.state === 'REFUNDED' || a.state === 'PARTIALLY_REFUNDED' ? 'progress' : 'pending'}
              label={t(`alloc.${a.state}` as MessageKey)} />
          </Row>
        ))}
        <Text variant="priceLarge">{t('checkout.total', { amount: money(o.totalPiastres) })}</Text>
      </Card>

      {canCancel ? (cancelOpen ? (
        <Card testID="cancel-card">
          <Text variant="label">{t('order.cancelReason')}</Text>
          <Row wrap>
            {(['changed', 'mistake', 'slow'] as const).map((r) => (
              <Chip key={r} label={t(`order.cancelReason.${r}` as const)} selected={cancelReason === r} onToggle={() => setCancelReason(r)} testID={`cancel-reason-${r}`} />
            ))}
          </Row>
          <Button variant="destructive" label={t('order.cancelConfirm')} disabled={!cancelReason} loading={busy} testID="cancel-confirm"
            onPress={() => run(() => api.cancelOrder(o.id, { reason: t(`order.cancelReason.${cancelReason as 'changed'}` as const), expectedVersion: o.version }, keys.current.cancel))} />
        </Card>
      ) : <Button variant="secondary" label={t('order.cancel')} onPress={() => setCancelOpen(true)} testID="cancel-open" />) : null}
      <Button variant="tertiary" label={t('orders.title')} onPress={() => nav.push('/orders')} />
    </Screen>
  );
}

export function OrdersScreen() {
  const { api, nav } = useApp();
  const auth = useAuth();
  const { t, locale } = useLocale();
  const list = useAsync(() => (auth.status === 'signedIn' ? api.orders() : Promise.resolve({ items: [] })), [auth.status]);
  if (auth.status !== 'signedIn') return <SignInScreen header={<TopBar />} onSignedIn={() => undefined} />;
  return (
    <Screen testID="orders-screen">
      <TopBar />
      <Text variant="display" role="header">{t('orders.title')}</Text>
      {list.status === 'loading' ? <LoadingState /> : list.status === 'error' ? <ErrorState message={errorMessage(t, list.error)} onRetry={list.reload} />
        : list.data.items.length === 0 ? <EmptyState message={t('orders.empty')} /> : list.data.items.map((o) => {
          const st = orderStatus(o, t);
          return (
            <Card key={o.id} onPress={() => nav.push(`/orders/${o.id}`)} accessibilityLabel={`${pickLocalized(locale, o.dishTitle.en, o.dishTitle.ar)}, ${st.label}`} testID={`order-${o.id}`}>
              <Text variant="label">{pickLocalized(locale, o.dishTitle.en, o.dishTitle.ar)} · {o.servings}</Text>
              <Row style={{ justifyContent: 'space-between' }}>
                <StatusBadge status={st.status} label={st.label} />
                <Text variant="price">{formatMoney(o.totalPiastres, locale)}</Text>
              </Row>
              <Text variant="caption" muted>{t('order.ref', { ref: o.reference })}</Text>
            </Card>
          );
        })}
    </Screen>
  );
}

export function AccountScreen() {
  const { nav, store } = useApp();
  const auth = useAuth();
  const { t } = useLocale();
  if (auth.status !== 'signedIn') return <SignInScreen header={<TopBar />} onSignedIn={() => nav.replace('/home')} />;
  return (
    <Screen testID="account-screen">
      <TopBar />
      <Text variant="display" role="header">{t('account.title')}</Text>
      <Text testID="account-label">{t('account.signedInAs', { label: auth.label ?? '' })}</Text>
      <Button label={t('orders.title')} onPress={() => nav.push('/orders')} testID="account-orders" />
      <Button variant="secondary" label={t('common.signOut')} testID="sign-out" onPress={async () => { await store.remove(KEYS.checkoutDraft); await auth.signOut(); nav.replace('/home'); }} />
    </Screen>
  );
}
