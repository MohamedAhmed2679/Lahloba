import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, newIdempotencyKey, type CapacitySlotDto, type ChefOrderDto, type CourierLegDto, type SupplierSuborderDto } from '@lahloba/contracts';
import { formatMoney, formatQuantity, formatSlot, formatTime, pickLocalized, type MessageKey } from '@lahloba/i18n';
import { OsmMap } from '@lahloba/app-shell/map';
import {
  Button, Card, Chip, EmptyState, ErrorState, LoadingState, Notice, RoleStrip, Row, Screen, StatusBadge, Text, TextField, roleAccent, useLocale,
} from '@lahloba/ui';
import { usePartner } from '../PartnerContext';

type T = (k: MessageKey, v?: Record<string, string | number>) => string;
const KNOWN = ['SLOT_OVERLAP', 'SLOT_IN_PAST', 'SLOT_HAS_BOOKINGS', 'VERSION_CONFLICT', 'ALREADY_DECIDED', 'RESPONSE_EXPIRED', 'INGREDIENTS_NOT_DELIVERED',
  'WRONG_CODE', 'CODE_LOCKED', 'NOT_READY', 'ALREADY_CLAIMED', 'EQUIPMENT_REQUIRED', 'COURIER_NOT_APPROVED'];
export function explain(t: T, e: unknown): string {
  if (e instanceof ApiError && KNOWN.includes(e.code)) return t(`pw.err.${e.code}` as MessageKey, { left: (e.details as { attemptsLeft?: number } | undefined)?.attemptsLeft ?? 0 });
  return e instanceof ApiError ? e.message : t('common.error.generic');
}

/** Big, spaced digits the partner reads out or shows to the courier. */
function CodeCard(props: { title: string; code: string; testID?: string }) {
  return (
    <Card testID={props.testID}>
      <Text variant="caption">{props.title}</Text>
      <Text variant="display" style={{ letterSpacing: 8 }} testID={props.testID ? `${props.testID}-value` : undefined}>{props.code}</Text>
    </Card>
  );
}

function usePoll(load: () => void, ms = 10_000) {
  useEffect(() => {
    load();
    const timer = setInterval(load, ms);
    return () => clearInterval(timer);
  }, [load, ms]);
}

export function Tabs<K extends string>(props: { tabs: Array<[K, string]>; value: K; onChange: (k: K) => void }) {
  return (
    <Row wrap>
      {props.tabs.map(([k, label]) => <Chip key={k} label={label} selected={props.value === k} onToggle={() => props.onChange(k)} testID={`tab-${k}`} />)}
    </Row>
  );
}

// ---------------------------------------------------------------- chef

export function ChefWorkspace(props: { chefId: string; menu: ReactNode }) {
  const { nav } = usePartner();
  const { t } = useLocale();
  const [tab, setTab] = useState<'orders' | 'times' | 'menu'>('orders');
  const accent = roleAccent.CHEF;
  return (
    <Screen testID="chef-workspace" header={<RoleStrip title={t('partner.role.CHEF')} strip={accent.strip} onStrip={accent.onStrip} />}>
      <Button variant="secondary" label={t('common.back')} onPress={() => nav.back()} />
      <Tabs tabs={[['orders', t('pw.tab.orders')], ['times', t('pw.tab.times')], ['menu', t('pw.tab.menu')]]} value={tab} onChange={setTab} />
      {tab === 'orders' ? <ChefOrdersPanel chefId={props.chefId} /> : tab === 'times' ? <ChefSlotsPanel chefId={props.chefId} /> : props.menu}
    </Screen>
  );
}

export function ChefOrdersPanel(props: { chefId: string }) {
  const { api } = usePartner();
  const { t } = useLocale();
  const [orders, setOrders] = useState<ChefOrderDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(() => { api.chefOrders(props.chefId).then((r) => { setOrders(r.items); setError(null); }, setError); }, [api, props.chefId]);
  usePoll(load);
  if (error && !orders) return <ErrorState message={t('common.error.generic')} onRetry={load} />;
  if (!orders) return <LoadingState />;
  if (!orders.length) return <EmptyState message={t('pw.noOrders')} />;
  return <>{orders.map((o) => <ChefOrderCard key={o.id} chefId={props.chefId} order={o} onChanged={load} />)}</>;
}

function ChefOrderCard(props: { chefId: string; order: ChefOrderDto; onChanged: () => void }) {
  const { api } = usePartner();
  const { t, locale } = useLocale();
  const o = props.order;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null | false>(false);
  const [ok, setOk] = useState<Record<string, boolean>>({});
  const [problem, setProblem] = useState(false);
  const [note, setNote] = useState('');
  const key = useRef(newIdempotencyKey());
  const act = async (fn: (k: string) => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(key.current); key.current = newIdempotencyKey(); props.onChanged(); } catch (e) { setError(explain(t, e)); if (e instanceof ApiError && e.code === 'VERSION_CONFLICT') props.onChanged(); } finally { setBusy(false); }
  };
  const money = (p: number) => formatMoney(p, locale);
  const ingLeg = o.legs.find((l) => l.kind === 'INGREDIENT_TO_CHEF');
  const stateLabel = o.fulfillmentState === 'RESERVED' && o.chefAcceptance === 'ACCEPTED' ? t('pw.state.RESERVED.accepted') : t(`pw.state.${o.fulfillmentState}` as MessageKey);
  const stateTone = o.fulfillmentState === 'CANCELLED' ? 'failed' : o.fulfillmentState === 'DELIVERED' ? 'confirmed' : o.fulfillmentState === 'RESERVED' ? 'pending' : 'progress';
  const toCheck = o.ingredients.filter((i) => !i.isPantry);
  return (
    <Card testID={`chef-order-${o.id}`}>
      <Text variant="caption" muted>{o.reference}</Text>
      <Text variant="label">{t('pw.orderLine', { dish: pickLocalized(locale, o.dishTitle.en, o.dishTitle.ar), count: o.servings, mode: t(`entry.${o.serviceMode}.title` as MessageKey) })}</Text>
      <Text variant="caption">{formatSlot(o.slot.startsAt, o.slot.endsAt, locale)}</Text>
      <Row style={{ justifyContent: 'space-between' }}>
        <StatusBadge status={stateTone} label={stateLabel} testID={`chef-order-state-${o.id}`} />
        <Text variant="price">{t('pw.earnings', { amount: money(o.chefEarningsPiastres) })}</Text>
      </Row>

      {o.fulfillmentState === 'RESERVED' && o.chefAcceptance === 'PENDING' ? (
        declining === false ? (
          <>
            <Text variant="caption" tone="warning">{t('pw.respondBy', { time: formatTime(o.respondBy) })}</Text>
            <Row wrap>
              <Button label={t('pw.accept')} loading={busy} onPress={() => act((k) => api.chefRespond(props.chefId, o.id, { accept: true, expectedVersion: o.version }, k))} testID={`accept-${o.id}`} />
              <Button variant="secondary" label={t('pw.decline')} disabled={busy} onPress={() => setDeclining(null)} testID={`decline-${o.id}`} />
            </Row>
          </>
        ) : (
          <>
            <Text variant="label">{t('pw.declineWhy')}</Text>
            <Row wrap>
              {(['full', 'equipment', 'ingredients'] as const).map((r) => <Chip key={r} label={t(`pw.declineReason.${r}`)} selected={declining === r} onToggle={() => setDeclining(r)} />)}
            </Row>
            <Button variant="destructive" label={t('pw.declineConfirm')} disabled={!declining} loading={busy} testID={`decline-confirm-${o.id}`}
              onPress={() => act((k) => api.chefRespond(props.chefId, o.id, { accept: false, reason: t(`pw.declineReason.${declining as 'full'}`), expectedVersion: o.version }, k))} />
          </>
        )
      ) : null}

      {o.ingredientDropoffCode && o.fulfillmentState === 'AWAITING_INGREDIENTS' && ingLeg?.state !== 'DELIVERED'
        ? <CodeCard title={t('pw.ingredientCode')} code={o.ingredientDropoffCode} testID={`ingredient-code-${o.id}`} /> : null}

      {o.fulfillmentState === 'AWAITING_INGREDIENTS' && ingLeg?.state === 'DELIVERED' ? (
        <Card testID={`check-${o.id}`}>
          <Text variant="label">{t('pw.checkIngredients')}</Text>
          <Text variant="caption" muted>{t('pw.checkHint')}</Text>
          {toCheck.map((i) => {
            const good = ok[i.ingredientId] ?? true;
            return (
              <Chip key={i.ingredientId} selected={good} onToggle={() => setOk({ ...ok, [i.ingredientId]: !good })}
                label={`${good ? '✓' : '✕'} ${pickLocalized(locale, i.name.en, i.name.ar)} · ${formatQuantity(i.quantity, i.unit as 'g', locale)}`} testID={`check-${i.ingredientId}`} />
            );
          })}
          {problem || toCheck.some((i) => ok[i.ingredientId] === false) ? (
            <>
              <TextField label={t('pw.problemNote')} value={note} onChangeText={setNote} multiline testID={`problem-note-${o.id}`} />
              <Button variant="destructive" label={t('pw.reportProblem')} disabled={note.trim().length < 3} loading={busy} testID={`report-${o.id}`}
                onPress={() => act((k) => api.chefCheckIngredients(props.chefId, o.id, { accepted: false, note: note.trim(), lines: toCheck.map((i) => ({ ingredientId: i.ingredientId, ok: ok[i.ingredientId] ?? true })), expectedVersion: o.version }, k))} />
            </>
          ) : (
            <Row wrap>
              <Button label={t('pw.acceptIngredients')} loading={busy} testID={`accept-ingredients-${o.id}`}
                onPress={() => act((k) => api.chefCheckIngredients(props.chefId, o.id, { accepted: true, lines: toCheck.map((i) => ({ ingredientId: i.ingredientId, ok: true })), expectedVersion: o.version }, k))} />
              <Button variant="tertiary" label={t('pw.reportProblem')} onPress={() => setProblem(true)} />
            </Row>
          )}
        </Card>
      ) : null}

      {o.fulfillmentState === 'READY_TO_PREPARE' ? (
        <>
          {o.ingredients.map((i) => <Text key={i.ingredientId} variant="caption">• {pickLocalized(locale, i.name.en, i.name.ar)} · {formatQuantity(i.quantity, i.unit as 'g', locale)} {i.isPantry ? t('pw.pantry') : ''}</Text>)}
          <Button label={t('pw.startCooking')} loading={busy} onPress={() => act((k) => api.chefStartPreparation(props.chefId, o.id, o.version, k))} testID={`start-${o.id}`} />
        </>
      ) : null}
      {o.fulfillmentState === 'PREPARING'
        ? <Button label={t('pw.markReady')} loading={busy} onPress={() => act((k) => api.chefMarkReady(props.chefId, o.id, o.version, k))} testID={`ready-${o.id}`} /> : null}
      {o.mealPickupCode && o.fulfillmentState === 'READY_FOR_PICKUP' ? <CodeCard title={t('pw.pickupCode')} code={o.mealPickupCode} testID={`pickup-code-${o.id}`} /> : null}
      {error ? <Notice tone="danger" testID={`chef-error-${o.id}`}>{error}</Notice> : null}
    </Card>
  );
}

const DAY_MS = 86_400_000;
/** Cairo is UTC+2 or +3; slots are created from the device clock and shown in Cairo time. */
function slotStart(dayOffset: number, hour: number) {
  const d = new Date(Date.now() + dayOffset * DAY_MS);
  d.setHours(hour, 0, 0, 0);
  return d;
}

export function ChefSlotsPanel(props: { chefId: string }) {
  const { api } = usePartner();
  const { t, locale } = useLocale();
  const [slots, setSlots] = useState<CapacitySlotDto[] | null>(null);
  const [day, setDay] = useState(1);
  const [hour, setHour] = useState(12);
  const [length, setLength] = useState(3);
  const [units, setUnits] = useState(40);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey());
  const load = useCallback(() => { api.chefSlots(props.chefId).then((r) => setSlots(r.items), () => setSlots([])); }, [api, props.chefId]);
  useEffect(load, [load]);
  const run = async (fn: (k: string) => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(key.current); key.current = newIdempotencyKey(); load(); } catch (e) { setError(explain(t, e)); } finally { setBusy(false); }
  };
  const dayLabel = (d: number) => (d === 0 ? t('pw.slots.today') : d === 1 ? t('pw.slots.tomorrow')
    : new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { weekday: 'short', day: 'numeric' }).format(new Date(Date.now() + d * DAY_MS)));
  return (
    <>
      {slots === null ? <LoadingState /> : slots.length === 0 ? <EmptyState message={t('pw.slots.none')} /> : slots.map((s) => (
        <Card key={s.id} testID={`slot-${s.id}`}>
          <Text variant="label">{formatSlot(s.startsAt, s.endsAt, locale)}</Text>
          <Text variant="caption">{t('pw.slots.usage', { used: s.reservedWorkUnits, total: s.totalWorkUnits })}</Text>
          {s.reservedWorkUnits === 0 ? <Button variant="tertiary" label={t('pw.slots.cancel')} disabled={busy} onPress={() => run((k) => api.cancelChefSlot(props.chefId, s.id, s.version, k))} /> : null}
        </Card>
      ))}
      <Text variant="title" role="header">{t('pw.slots.add')}</Text>
      <Text variant="label">{t('pw.slots.day')}</Text>
      <Row wrap>{[0, 1, 2, 3, 4, 5, 6].map((d) => <Chip key={d} label={dayLabel(d)} selected={day === d} onToggle={() => setDay(d)} testID={`slot-day-${d}`} />)}</Row>
      <Text variant="label">{t('pw.slots.start')}</Text>
      <Row wrap>{[9, 11, 12, 14, 17, 18, 20].map((h) => <Chip key={h} label={`${String(h).padStart(2, '0')}:00`} selected={hour === h} onToggle={() => setHour(h)} testID={`slot-hour-${h}`} />)}</Row>
      <Text variant="label">{t('pw.slots.length')}</Text>
      <Row wrap>{[2, 3, 4].map((n) => <Chip key={n} label={t('pw.slots.hours', { n })} selected={length === n} onToggle={() => setLength(n)} />)}</Row>
      <Text variant="label">{t('pw.slots.units')}</Text>
      <Text variant="caption" muted>{t('pw.slots.unitsHint')}</Text>
      <Row wrap>{[20, 40, 60, 100].map((n) => <Chip key={n} label={String(n)} selected={units === n} onToggle={() => setUnits(n)} />)}</Row>
      {error ? <Notice tone="danger" testID="slot-error">{error}</Notice> : null}
      <Button label={t('pw.slots.create')} loading={busy} testID="slot-create" onPress={() => {
        const start = slotStart(day, hour);
        return run((k) => api.createChefSlot(props.chefId, { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + length * 3_600_000).toISOString(), totalWorkUnits: units }, k));
      }} />
    </>
  );
}

// ---------------------------------------------------------------- supplier

export function SupplierOrdersPanel(props: { branchId: string }) {
  const { api } = usePartner();
  const { t, locale } = useLocale();
  const [items, setItems] = useState<SupplierSuborderDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey());
  const load = useCallback(() => { api.branchSuborders(props.branchId).then((r) => setItems(r.items), () => setItems([])); }, [api, props.branchId]);
  usePoll(load);
  const respond = async (s: SupplierSuborderDto, confirm: boolean, reason?: string) => {
    setBusy(true); setError(null);
    try { await api.supplierRespond(props.branchId, s.id, { confirm, ...(reason ? { reason } : {}), expectedVersion: s.version }, key.current); key.current = newIdempotencyKey(); load(); }
    catch (e) { setError(explain(t, e)); load(); } finally { setBusy(false); }
  };
  if (!items) return <LoadingState />;
  if (!items.length) return <EmptyState message={t('pw.shop.noOrders')} />;
  return (
    <>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {items.map((s) => (
        <Card key={s.id} testID={`suborder-${s.id}`}>
          <Text variant="caption" muted>{s.orderReference}</Text>
          {s.lines.map((l) => (
            <Text key={l.productId}>{pickLocalized(locale, l.name.en, l.name.ar)} · {l.packs} × {formatQuantity(l.packQuantity, l.packUnit as 'g', locale)} · {l.sku}</Text>
          ))}
          <Row style={{ justifyContent: 'space-between' }}>
            <StatusBadge status={s.state === 'HANDED_OVER' ? 'confirmed' : s.state === 'REJECTED' || s.state === 'CANCELLED' ? 'failed' : s.state === 'CONFIRMED' ? 'progress' : 'pending'}
              label={t(`pw.shop.state.${s.state}` as MessageKey)} testID={`suborder-state-${s.id}`} />
            <Text variant="price">{formatMoney(s.totalPiastres, locale)}</Text>
          </Row>
          {s.state === 'PENDING' ? (rejecting[s.id] === undefined ? (
            <>
              <Text variant="caption" tone="warning">{t('pw.respondBy', { time: formatTime(s.respondBy) })}</Text>
              <Row wrap>
                <Button label={t('pw.shop.confirm')} loading={busy} onPress={() => respond(s, true)} testID={`confirm-${s.id}`} />
                <Button variant="secondary" label={t('pw.shop.reject')} disabled={busy} onPress={() => setRejecting({ ...rejecting, [s.id]: null })} />
              </Row>
            </>
          ) : (
            <>
              <Text variant="label">{t('pw.shop.rejectWhy')}</Text>
              <Row wrap>{(['stock', 'quality'] as const).map((r) => <Chip key={r} label={t(`pw.shop.rejectReason.${r}`)} selected={rejecting[s.id] === r} onToggle={() => setRejecting({ ...rejecting, [s.id]: r })} />)}</Row>
              <Button variant="destructive" label={t('pw.shop.rejectConfirm')} disabled={!rejecting[s.id]} loading={busy}
                onPress={() => respond(s, false, t(`pw.shop.rejectReason.${rejecting[s.id] as 'stock'}`))} />
            </>
          )) : null}
          {s.pickupCode ? <CodeCard title={t('pw.shop.pickupCode')} code={s.pickupCode} testID={`shop-code-${s.id}`} /> : null}
          {s.courierName ? <Text variant="caption">{t('pw.shop.courier', { name: s.courierName })}</Text> : null}
        </Card>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- courier

export function CourierJobsScreen() {
  const { api, nav } = usePartner();
  const { t } = useLocale();
  const [legs, setLegs] = useState<CourierLegDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api.courierJobs().then((r) => { setLegs(r.items); setError(null); }, (e) => { setLegs([]); setError(explain(t, e)); });
  }, [api, t]);
  usePoll(load, 8000);
  const accent = roleAccent.COURIER;
  const mine = legs?.filter((l) => l.state !== 'OPEN') ?? [];
  const open = legs?.filter((l) => l.state === 'OPEN') ?? [];
  return (
    <Screen testID="courier" header={<RoleStrip title={t('partner.role.COURIER')} strip={accent.strip} onStrip={accent.onStrip} />}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Button variant="secondary" label={t('common.back')} onPress={() => nav.back()} />
        <Button variant="tertiary" label={t('pw.refresh')} onPress={load} testID="courier-refresh" />
      </Row>
      <Text variant="display" role="header">{t('pw.courier.title')}</Text>
      {error ? <Notice tone="danger" testID="courier-error">{error}</Notice> : null}
      {legs === null ? <LoadingState /> : null}
      {mine.length ? <Text variant="title" role="header">{t('pw.courier.mine')}</Text> : null}
      {mine.map((l) => <LegCard key={l.legId} leg={l} onChanged={load} />)}
      {legs && !error ? <Text variant="title" role="header">{t('pw.courier.open')}</Text> : null}
      {legs && !error && !open.length ? <EmptyState message={t('pw.courier.none')} /> : null}
      {open.map((l) => <LegCard key={l.legId} leg={l} onChanged={load} />)}
    </Screen>
  );
}

function LegCard(props: { leg: CourierLegDto; onChanged: () => void }) {
  const { api } = usePartner();
  const { t, locale } = useLocale();
  const l = props.leg;
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey());
  const L = (x: { en: string; ar: string }) => pickLocalized(locale, x.en, x.ar);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); props.onChanged(); } catch (e) { setError(explain(t, e)); } finally { setBusy(false); }
  };
  const markers = [l.from, l.to].filter((p): p is NonNullable<typeof p> => !!p).map((p, i) => ({ lat: p.lat, lng: p.lng, label: L(p.label), kind: i === 0 ? 'start' as const : 'end' as const }));
  const allCollected = l.stops.every((s) => s.state === 'COLLECTED');
  return (
    <Card testID={`leg-${l.legId}`}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="label">{t(`pw.leg.${l.kind}` as MessageKey)}</Text>
        <Text variant="price">{t('pw.courier.fee', { amount: formatMoney(l.feePiastres, locale) })}</Text>
      </Row>
      <Text>{t('pw.courier.route', { from: L(l.fromArea), to: L(l.toArea) })}</Text>
      {l.requiredEquipment.length ? <Text variant="caption">{t('pw.courier.needs', { items: l.requiredEquipment.map((e) => t(`equipment.${e}` as MessageKey)).join(', ') })}</Text> : null}
      {markers.length === 2 ? <OsmMap height={160} markers={markers} routes={[{ from: markers[0]!, to: markers[1]! }]} summary={t('pw.courier.route', { from: markers[0]!.label, to: markers[1]!.label })} /> : null}
      {l.state === 'OPEN' ? (
        <>
          <Text variant="caption" muted>{t('pw.courier.addressHidden')}</Text>
          {l.stops.map((s) => <Text key={s.stopId} variant="caption">• {t('pw.courier.collectFrom', { name: s.partyName })} ({L(s.area)})</Text>)}
          <Button label={t('pw.courier.claim')} disabled={!l.canClaim} loading={busy} testID={`claim-${l.legId}`}
            onPress={() => run(async () => { await api.claimLeg(l.legId, l.version, key.current); key.current = newIdempotencyKey(); })} />
          {!l.canClaim ? <Text variant="caption" tone="warning">{t('pw.courier.cantClaim')}</Text> : null}
        </>
      ) : null}
      {l.state === 'ASSIGNED' || l.state === 'PICKED_UP' ? (
        <>
          {l.stops.map((s) => (
            <Card key={s.stopId} testID={`stop-${s.stopId}`}>
              <Text variant="label">{t('pw.courier.collectFrom', { name: s.partyName })}</Text>
              {s.addressText ? <Text variant="caption">{s.addressText}</Text> : null}
              {s.state === 'COLLECTED' ? <StatusBadge status="confirmed" label={t('pw.courier.collected')} /> : (
                <>
                  <TextField label={t('pw.courier.code', { name: s.partyName })} value={codes[s.stopId] ?? ''} onChangeText={(v) => setCodes({ ...codes, [s.stopId]: v.replace(/\D/g, '').slice(0, 6) })}
                    keyboardType="numeric" testID={`stop-code-${s.stopId}`} />
                  <Button label={t('pw.courier.confirmPickup')} disabled={(codes[s.stopId] ?? '').length !== 6} loading={busy} testID={`collect-${s.stopId}`}
                    onPress={() => run(() => api.collectStop(l.legId, s.stopId, { code: codes[s.stopId]!, expectedVersion: l.version }))} />
                </>
              )}
            </Card>
          ))}
          <Card testID={`dropoff-${l.legId}`}>
            <Text variant="label">{t('pw.courier.deliverTo', { name: l.kind === 'MEAL_TO_CUSTOMER' ? t('pw.courier.customer') : l.dropoff.partyName })}</Text>
            {l.dropoff.addressText ? <Text variant="caption">{l.dropoff.addressText}</Text> : null}
            {l.dropoff.accessNotes ? <Text variant="caption">{t('pw.courier.notes', { notes: l.dropoff.accessNotes })}</Text> : null}
            {allCollected && l.state === 'PICKED_UP' ? (
              <>
                <TextField label={t('pw.courier.code', { name: l.kind === 'MEAL_TO_CUSTOMER' ? t('pw.courier.customer') : l.dropoff.partyName })} value={codes.dropoff ?? ''}
                  onChangeText={(v) => setCodes({ ...codes, dropoff: v.replace(/\D/g, '').slice(0, 6) })} keyboardType="numeric" testID={`dropoff-code-${l.legId}`} />
                <Button label={t('pw.courier.confirmDelivery')} disabled={(codes.dropoff ?? '').length !== 6} loading={busy} testID={`deliver-${l.legId}`}
                  onPress={() => run(() => api.deliverLeg(l.legId, { code: codes.dropoff!, expectedVersion: l.version }))} />
              </>
            ) : null}
          </Card>
        </>
      ) : null}
      {l.state === 'DELIVERED' ? <StatusBadge status="confirmed" label={t('pw.courier.delivered')} /> : null}
      {error ? <Notice tone="danger" testID={`leg-error-${l.legId}`}>{error}</Notice> : null}
    </Card>
  );
}
