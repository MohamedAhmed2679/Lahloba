import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import * as C from '@lahloba/contracts';
import { transition, type FulfillmentEvent, type TransitionContext } from '@lahloba/domain';
import type { DbClient, Pool, Queryable } from '../db';
import { withTx } from '../db';
import { HttpError, conflict, notFound } from '../errors';
import { audit, enqueueEvent } from '../platform';
import { confirmCapacity, releaseCapacity, reserveCapacity } from '../capacity';
import { codeHash, handoffCode } from './handoff';
import type { QuoteSnapshot } from './quote';

export const PAY_WINDOW_MINUTES = 30;
export const PARTNER_RESPONSE_MINUTES = 30;
const PLATFORM_ID = '00000000-0000-0000-0000-000000000000';
const L = (en: string, ar: string) => ({ en, ar });
const num = (v: unknown) => Number(v);

const ProviderEvent = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(['payment.succeeded', 'payment.failed', 'refund.succeeded', 'refund.failed']),
  data: z.object({ providerRef: z.string().min(1).max(100), amountPiastres: z.number().int().nonnegative(), reason: z.string().max(100).optional() }),
});

export interface OrderDeps { handoffSecret: string; webhookSecret: string }

export const orderReference = (id: string) => `LH-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

async function event(db: Queryable, orderId: string, kind: string, actorUserId: string | null, detail: Record<string, unknown> = {}) {
  await db.query(`INSERT INTO order_events (order_id, kind, actor_user_id, detail) VALUES ($1, $2, $3, $4)`, [orderId, kind, actorUserId, JSON.stringify(detail)]);
}

/** Applies a domain fulfilment transition and writes it with an optimistic version check. */
export async function applyTransition(db: DbClient, orderId: string, ev: FulfillmentEvent, ctx: Omit<TransitionContext, 'expectedVersion'>, expectedVersion?: number) {
  const o = (await db.query(`SELECT * FROM orders WHERE id = $1 FOR UPDATE`, [orderId])).rows[0];
  if (!o) throw notFound('Order');
  const next = transition({ state: o.fulfillment_state, source: o.source, version: o.version, ingredientsAccepted: o.ingredients_accepted },
    ev, { ...ctx, expectedVersion: expectedVersion ?? o.version });
  await db.query(`UPDATE orders SET fulfillment_state = $2, ingredients_accepted = $3, version = $4, updated_at = now() WHERE id = $1`,
    [orderId, next.state, next.ingredientsAccepted ?? o.ingredients_accepted, next.version]);
  return next;
}

// ---------------------------------------------------------------- create

export async function createOrder(db: DbClient, deps: OrderDeps, customerId: string, quoteId: string, correlationId: string): Promise<string> {
  const q = (await db.query(`SELECT * FROM quotes WHERE id = $1 AND customer_id = $2 FOR UPDATE`, [quoteId, customerId])).rows[0];
  if (!q) throw notFound('Quote');
  if (q.status === 'ACCEPTED') throw conflict('QUOTE_USED', 'This quote was already used for an order');
  if (q.status !== 'ACTIVE' || new Date(q.expires_at).getTime() <= Date.now()) {
    await db.query(`UPDATE quotes SET status = 'EXPIRED' WHERE id = $1 AND status = 'ACTIVE'`, [quoteId]);
    throw conflict('QUOTE_EXPIRED', 'Prices may have changed. Get a new quote.');
  }
  const s = q.snapshot as QuoteSnapshot;
  // Price versions must still match the snapshot (no silent repricing).
  const offer = (await db.query(`SELECT price_version, status FROM offer_variants WHERE id = $1`, [s.offer.id])).rows[0];
  const tariff = (await db.query(`SELECT version, eligible FROM delivery_tariffs WHERE id = $1`, [s.finalTariff.id])).rows[0];
  const prods = s.basket.length ? (await db.query(`SELECT id, price_version, status FROM supplier_products WHERE id = ANY($1)`, [s.basket.map((b) => b.productId)])).rows : [];
  const stale = !offer || offer.status !== 'ACTIVE' || offer.price_version !== s.offer.priceVersion || !tariff?.eligible || tariff.version !== s.finalTariff.version
    || s.basket.some((b) => { const p = prods.find((x) => x.id === b.productId); return !p || p.status !== 'ACTIVE' || p.price_version !== b.priceVersion; });
  if (stale) {
    await db.query(`UPDATE quotes SET status = 'SUPERSEDED' WHERE id = $1`, [quoteId]);
    throw conflict('QUOTE_STALE', 'A price or delivery fee changed. Get a new quote.');
  }

  const orderId = randomUUID();
  await db.query(
    `INSERT INTO orders (id, customer_id, quote_id, chef_id, source, chef_response_deadline, total_piastres)
     VALUES ($1, $2, $3, $4, $5, now() + make_interval(mins => $6), $7)`,
    [orderId, customerId, quoteId, s.chef.id, q.source, PAY_WINDOW_MINUTES + PARTNER_RESPONSE_MINUTES, q.total_piastres]);
  await db.query(`UPDATE quotes SET status = 'ACCEPTED' WHERE id = $1`, [quoteId]);

  // Hold kitchen capacity and stock for the payment window.
  await reserveCapacity(db, { slotId: s.slot.id, chefId: s.chef.id, units: s.workUnits, ttlMinutes: PAY_WINDOW_MINUTES, orderId, notBefore: new Date(Date.now() + s.offer.leadTimeMinutes * 60_000) });
  const byBranch = new Map<string, QuoteSnapshot['basket']>();
  for (const b of s.basket) {
    const u = await db.query(
      `UPDATE inventory_balances SET reserved_packs = reserved_packs + $2, version = version + 1 WHERE product_id = $1 AND on_hand_packs - reserved_packs >= $2`,
      [b.productId, b.packs]);
    if (!u.rowCount) throw conflict('INVENTORY_UNAVAILABLE', `A shop no longer has enough ${b.nameEn}. Get a new quote.`);
    await db.query(`INSERT INTO inventory_reservations (product_id, order_id, packs, expires_at) VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
      [b.productId, orderId, b.packs, PAY_WINDOW_MINUTES]);
    byBranch.set(b.branchId, [...(byBranch.get(b.branchId) ?? []), b]);
  }
  for (const [branchId, lines] of byBranch) {
    await db.query(
      `INSERT INTO supplier_suborders (order_id, branch_id, lines, total_piastres, response_deadline) VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5))`,
      [orderId, branchId, JSON.stringify(lines), lines.reduce((n, l) => n + l.amountPiastres, 0), PAY_WINDOW_MINUTES + PARTNER_RESPONSE_MINUTES]);
  }

  // Delivery legs. Codes are derived, never stored; only keyed hashes are kept.
  const legIds: Record<string, string> = {};
  const mealLeg = randomUUID();
  legIds.MEAL_TO_CUSTOMER = mealLeg;
  const equipment = s.offer.serviceMode === 'EAT_NOW' ? ['INSULATED_BAG'] : ['COLD_BOX'];
  await db.query(
    `INSERT INTO delivery_legs (id, order_id, kind, fee_piastres, tariff_id, state, required_equipment, from_area_id, to_area_id, destination_address_id, dropoff_code_hash)
     VALUES ($1, $2, 'MEAL_TO_CUSTOMER', $3, $4, 'WAITING', $5, $6, $7, $8, $9)`,
    [mealLeg, orderId, s.finalTariff.feePiastres, s.finalTariff.id, equipment, s.chef.areaId, s.customerAreaId, s.addressId,
      codeHash(deps.handoffSecret, mealLeg, 'DROPOFF', handoffCode(deps.handoffSecret, mealLeg, 'DROPOFF'))]);
  const mealStop = randomUUID();
  await db.query(`INSERT INTO delivery_stops (id, leg_id, seq, party_type, party_id, pickup_address_id, pickup_code_hash) VALUES ($1, $2, 1, 'CHEF', $3, $4, $5)`,
    [mealStop, mealLeg, s.chef.id, s.chef.kitchenAddressId, codeHash(deps.handoffSecret, mealStop, 'PICKUP', handoffCode(deps.handoffSecret, mealStop, 'PICKUP'))]);
  if (q.source === 'SUPPLIERS') {
    const leg = randomUUID();
    legIds.INGREDIENT_TO_CHEF = leg;
    const firstBranch = (await db.query(`SELECT area_id FROM supplier_branches WHERE id = $1`, [[...byBranch.keys()][0]])).rows[0];
    await db.query(
      `INSERT INTO delivery_legs (id, order_id, kind, fee_piastres, state, required_equipment, from_area_id, to_area_id, destination_address_id, dropoff_code_hash)
       VALUES ($1, $2, 'INGREDIENT_TO_CHEF', $3, 'WAITING', $4, $5, $6, $7, $8)`,
      [leg, orderId, s.ingredientTariff!.feePiastres, ['COLD_BOX'], firstBranch.area_id, s.chef.areaId, s.chef.kitchenAddressId,
        codeHash(deps.handoffSecret, leg, 'DROPOFF', handoffCode(deps.handoffSecret, leg, 'DROPOFF'))]);
    let seq = 1;
    for (const branchId of byBranch.keys()) {
      const b = (await db.query(`SELECT address_id FROM supplier_branches WHERE id = $1`, [branchId])).rows[0];
      const stop = randomUUID();
      await db.query(`INSERT INTO delivery_stops (id, leg_id, seq, party_type, party_id, pickup_address_id, pickup_code_hash) VALUES ($1, $2, $3, 'SUPPLIER_BRANCH', $4, $5, $6)`,
        [stop, leg, seq++, branchId, b.address_id, codeHash(deps.handoffSecret, stop, 'PICKUP', handoffCode(deps.handoffSecret, stop, 'PICKUP'))]);
    }
  }

  // Recipient-specific allocations (customer pays each identified recipient).
  const groups = new Map<string, { type: string; id: string; components: string[]; amount: number }>();
  for (const l of s.lines) {
    const id = l.recipientType === 'DELIVERY_LEG' ? legIds[l.recipientKey]! : l.recipientType === 'PLATFORM' ? PLATFORM_ID : l.recipientKey;
    const k = `${l.recipientType}:${id}`;
    const g = groups.get(k) ?? { type: l.recipientType, id, components: [], amount: 0 };
    g.components.push(l.component); g.amount += l.amountPiastres;
    groups.set(k, g);
  }
  for (const g of groups.values()) {
    if (g.amount > 0) await db.query(`INSERT INTO payment_allocations (order_id, recipient_type, recipient_id, components, amount_piastres) VALUES ($1, $2, $3, $4, $5)`,
      [orderId, g.type, g.id, g.components, g.amount]);
  }
  await event(db, orderId, 'ORDER_PLACED', customerId);
  await audit(db, { actorUserId: customerId, action: 'ORDER_CREATED', targetType: 'order', targetId: orderId, metadata: { total: num(q.total_piastres) }, correlationId });
  await enqueueEvent(db, { aggregateType: 'order', aggregateId: orderId, eventType: 'ORDER_CREATED', payload: { orderId }, correlationId });
  return orderId;
}

// ---------------------------------------------------------------- payments (sandbox simulator)

export const sessionIdFor = (orderId: string) => `sim_${orderId}`;
export const orderIdFromSession = (sessionId: string) => (/^sim_[0-9a-f-]{36}$/.test(sessionId) ? sessionId.slice(4) : null);

export async function startPayment(db: DbClient, customerId: string, orderId: string, correlationId: string) {
  const o = (await db.query(`SELECT * FROM orders WHERE id = $1 AND customer_id = $2 FOR UPDATE`, [orderId, customerId])).rows[0];
  if (!o) throw notFound('Order');
  if (o.fulfillment_state !== 'RESERVED' || !['UNFUNDED', 'PARTIALLY_FUNDED'].includes(o.funding_state)) throw conflict('PAYMENT_NOT_NEEDED', 'This order cannot be paid now');
  const live = await db.query(`SELECT 1 FROM capacity_reservations WHERE order_id = $1 AND state = 'ACTIVE' AND expires_at > now()`, [orderId]);
  if (!live.rowCount) throw conflict('PAYMENT_WINDOW_CLOSED', 'The time to pay has passed. Start a new order.');
  const unknown = await db.query(`SELECT 1 FROM payment_attempts WHERE order_id = $1 AND state = 'UNKNOWN'`, [orderId]);
  if (unknown.rowCount) throw conflict('PAYMENT_RECONCILING', 'We are still checking a previous payment. You will not be charged twice; try again in a minute.');
  const allocs = (await db.query(
    `SELECT a.* FROM payment_allocations a WHERE a.order_id = $1
       AND NOT EXISTS (SELECT 1 FROM payment_attempts p WHERE p.allocation_id = a.id AND p.state IN ('PENDING','UNKNOWN','SUCCEEDED'))`, [orderId])).rows;
  for (const a of allocs) {
    await db.query(`INSERT INTO payment_attempts (allocation_id, order_id, provider, provider_ref, amount_piastres) VALUES ($1, $2, 'simulator', $3, $4)`,
      [a.id, orderId, `simpay_${randomUUID()}`, a.amount_piastres]);
  }
  await event(db, orderId, 'PAYMENT_STARTED', customerId);
  await audit(db, { actorUserId: customerId, action: 'PAYMENT_STARTED', targetType: 'order', targetId: orderId, correlationId });
  return paymentSession(db, orderId);
}

export async function paymentSession(db: Queryable, orderId: string) {
  // Latest attempt per recipient (a succeeded attempt always wins over older failures).
  const r = await db.query(
    `SELECT DISTINCT ON (p.allocation_id) p.id, p.amount_piastres, p.state, a.recipient_type, a.recipient_id
     FROM payment_attempts p JOIN payment_allocations a ON a.id = p.allocation_id
     WHERE p.order_id = $1 AND p.state <> 'VOIDED'
     ORDER BY p.allocation_id, (p.state = 'SUCCEEDED') DESC, p.created_at DESC`, [orderId]);
  const names = await recipientNames(db, r.rows);
  const attempts = r.rows.map((x) => ({ attemptId: x.id, recipientName: names.get(x.recipient_id) ?? '', amountPiastres: num(x.amount_piastres), state: x.state }));
  return C.PaymentSessionDto.parse({
    sessionId: sessionIdFor(orderId), orderId, attempts, provider: 'simulator', sandbox: true,
    totalPiastres: attempts.reduce((n, a) => n + a.amountPiastres, 0),
  });
}

export function signWebhook(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

/**
 * Simulated provider page: decides the outcome of PENDING attempts and delivers SIGNED webhook
 * events through the same verification path a real provider would use.
 */
export async function simulateProvider(pool: Pool, deps: OrderDeps, customerId: string, orderId: string, outcome: 'SUCCEED' | 'DECLINE' | 'TIMEOUT', attemptId: string | undefined, correlationId: string) {
  const owned = (await pool.query(`SELECT 1 FROM orders WHERE id = $1 AND customer_id = $2`, [orderId, customerId])).rowCount;
  if (!owned) throw notFound('Order');
  const pending = (await pool.query(`SELECT id, provider_ref, amount_piastres FROM payment_attempts WHERE order_id = $1 AND state = 'PENDING' ${attemptId ? 'AND id = $2' : ''}`,
    attemptId ? [orderId, attemptId] : [orderId])).rows;
  if (!pending.length) throw conflict('NOTHING_TO_PAY', 'There is no payment waiting. Start the payment again.');
  for (const p of pending) {
    if (outcome === 'TIMEOUT') {
      // The customer saw no result; the provider outcome is unknown until reconciled (never retried blindly).
      await pool.query(`UPDATE payment_attempts SET state = 'UNKNOWN', updated_at = now() WHERE id = $1 AND state = 'PENDING'`, [p.id]);
      continue;
    }
    const body = JSON.stringify({ id: `evt_${randomUUID()}`, type: outcome === 'SUCCEED' ? 'payment.succeeded' : 'payment.failed',
      data: { providerRef: p.provider_ref, amountPiastres: num(p.amount_piastres), ...(outcome === 'DECLINE' ? { reason: 'CARD_DECLINED' } : {}) } });
    await handleProviderEvent(pool, deps, body, signWebhook(deps.webhookSecret, body), correlationId);
  }
  // Partial failures leave the order PARTIALLY_FUNDED; the customer can retry the failed part.
}

/** Verified, de-duplicated provider event processing (one transaction per event). */
export async function handleProviderEvent(pool: Pool, deps: OrderDeps, rawBody: string, signature: string | undefined, correlationId: string): Promise<{ duplicate: boolean; outcome: string }> {
  const expected = Buffer.from(signWebhook(deps.webhookSecret, rawBody), 'hex');
  const given = Buffer.from(typeof signature === 'string' && /^[0-9a-f]{64}$/.test(signature) ? signature : '', 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new HttpError(401, 'BAD_SIGNATURE', 'Invalid webhook signature');
  const evt = ProviderEvent.parse(JSON.parse(rawBody));
  const toDispatch: string[] = [];
  const res = await withTx(pool, async (db) => {
    const ins = await db.query(`INSERT INTO provider_events (provider, provider_event_id, payload, signature_valid) VALUES ('simulator', $1, $2, true)
      ON CONFLICT (provider, provider_event_id) DO NOTHING RETURNING id`, [evt.id, rawBody]);
    if (!ins.rowCount) return { duplicate: true, outcome: 'DUPLICATE' };
    let outcome = 'IGNORED';
    if (evt.type === 'payment.succeeded' || evt.type === 'payment.failed') {
      const a = (await db.query(`SELECT p.*, al.recipient_type, al.recipient_id FROM payment_attempts p JOIN payment_allocations al ON al.id = p.allocation_id WHERE p.provider_ref = $1 FOR UPDATE OF p`, [evt.data.providerRef])).rows[0];
      if (!a) outcome = 'UNKNOWN_REFERENCE';
      else if (evt.type === 'payment.failed') {
        const u = await db.query(`UPDATE payment_attempts SET state = 'FAILED', failure_reason = $2, updated_at = now() WHERE id = $1 AND state IN ('PENDING','UNKNOWN')`, [a.id, evt.data.reason ?? 'DECLINED']);
        outcome = u.rowCount ? 'FAILED' : 'NO_CHANGE';
        if (u.rowCount) await event(db, a.order_id, 'PAYMENT_FAILED', null, { recipient: a.recipient_type });
      } else if (num(evt.data.amountPiastres) !== num(a.amount_piastres)) {
        outcome = 'AMOUNT_MISMATCH';
        await db.query(`UPDATE orders SET hold_reason = 'PAYMENT_AMOUNT_MISMATCH', updated_at = now() WHERE id = $1`, [a.order_id]);
        await audit(db, { actorUserId: null, action: 'PAYMENT_AMOUNT_MISMATCH', targetType: 'payment_attempt', targetId: a.id, correlationId });
      } else {
        const u = await db.query(`UPDATE payment_attempts SET state = 'SUCCEEDED', updated_at = now() WHERE id = $1 AND state IN ('PENDING','UNKNOWN') RETURNING id`, [a.id]);
        if (!u.rowCount) outcome = 'NO_CHANGE';
        else {
          outcome = 'SUCCEEDED';
          const txn = randomUUID();
          await db.query(`INSERT INTO ledger_entries (txn_id, account, debit_piastres, order_id, attempt_id, memo) VALUES ($1, 'provider_clearing:simulator', $2, $3, $4, 'customer payment captured')`, [txn, a.amount_piastres, a.order_id, a.id]);
          await db.query(`INSERT INTO ledger_entries (txn_id, account, credit_piastres, order_id, attempt_id, memo) VALUES ($1, $2, $3, $4, $5, 'owed to recipient')`, [txn, `payable:${a.recipient_type}:${a.recipient_id}`, a.amount_piastres, a.order_id, a.id]);
          const o = (await db.query(`SELECT fulfillment_state FROM orders WHERE id = $1 FOR UPDATE`, [a.order_id])).rows[0];
          if (o.fulfillment_state === 'CANCELLED') {
            // Late success on a cancelled order: compensate immediately.
            toDispatch.push(...await createRefunds(db, a.order_id, 'LATE_PAYMENT_ON_CANCELLED_ORDER', null));
            await db.query(`UPDATE orders SET funding_state = 'COMPENSATING', updated_at = now() WHERE id = $1`, [a.order_id]);
          } else {
            await recomputeFunding(db, a.order_id);
          }
        }
      }
    } else if (evt.type === 'refund.succeeded' || evt.type === 'refund.failed') {
      const r = (await db.query(`SELECT * FROM refunds WHERE provider_ref = $1 FOR UPDATE`, [evt.data.providerRef])).rows[0];
      if (!r) outcome = 'UNKNOWN_REFERENCE';
      else if (r.state !== 'PENDING') outcome = 'NO_CHANGE';
      else if (evt.type === 'refund.failed') {
        await db.query(`UPDATE refunds SET state = 'FAILED', updated_at = now() WHERE id = $1`, [r.id]);
        await db.query(`UPDATE orders SET hold_reason = 'REFUND_FAILED', updated_at = now() WHERE id = $1`, [r.order_id]);
        await audit(db, { actorUserId: null, action: 'REFUND_FAILED', targetType: 'refund', targetId: r.id, correlationId });
        outcome = 'REFUND_FAILED';
      } else {
        await db.query(`UPDATE refunds SET state = 'CONFIRMED', updated_at = now() WHERE id = $1`, [r.id]);
        const a = (await db.query(`UPDATE payment_attempts SET refunded_piastres = refunded_piastres + $2, updated_at = now() WHERE id = $1 RETURNING allocation_id`, [r.attempt_id, r.amount_piastres])).rows[0];
        const al = (await db.query(`SELECT recipient_type, recipient_id FROM payment_allocations WHERE id = $1`, [a.allocation_id])).rows[0];
        const txn = randomUUID();
        await db.query(`INSERT INTO ledger_entries (txn_id, account, debit_piastres, order_id, refund_id, memo) VALUES ($1, $2, $3, $4, $5, 'refund to customer')`, [txn, `payable:${al.recipient_type}:${al.recipient_id}`, r.amount_piastres, r.order_id, r.id]);
        await db.query(`INSERT INTO ledger_entries (txn_id, account, credit_piastres, order_id, refund_id, memo) VALUES ($1, 'provider_clearing:simulator', $2, $3, $4, 'refund paid out')`, [txn, r.amount_piastres, r.order_id, r.id]);
        const open = await db.query(`SELECT 1 FROM refunds WHERE order_id = $1 AND state <> 'CONFIRMED'`, [r.order_id]);
        if (!open.rowCount) {
          await db.query(`UPDATE orders SET funding_state = 'COMPENSATED', updated_at = now() WHERE id = $1 AND funding_state = 'COMPENSATING'`, [r.order_id]);
          await event(db, r.order_id, 'REFUNDED', null);
        }
        outcome = 'REFUNDED';
      }
    }
    await db.query(`UPDATE provider_events SET outcome = $2, processed_at = now() WHERE id = $1`, [ins.rows[0].id, outcome]);
    return { duplicate: false, outcome };
  });
  if (toDispatch.length) await dispatchRefunds(pool, deps, toDispatch, correlationId);
  return res;
}

async function recomputeFunding(db: DbClient, orderId: string) {
  const r = (await db.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE EXISTS (SELECT 1 FROM payment_attempts p WHERE p.allocation_id = a.id AND p.state = 'SUCCEEDED'))::int AS paid
     FROM payment_allocations a WHERE a.order_id = $1`, [orderId])).rows[0];
  const state = r.paid === 0 ? 'UNFUNDED' : r.paid === r.total ? 'FUNDED' : 'PARTIALLY_FUNDED';
  const u = await db.query(`UPDATE orders SET funding_state = $2, updated_at = now(), version = version + 1 WHERE id = $1 AND funding_state <> $2 RETURNING id`, [orderId, state]);
  if (u.rowCount && state === 'FUNDED') {
    await confirmCapacity(db, orderId);
    // Stock stays held until the courier collects it; partners have their response window from now.
    await db.query(`UPDATE inventory_reservations SET expires_at = now() + interval '1 day' WHERE order_id = $1 AND state = 'ACTIVE'`, [orderId]);
    await db.query(`UPDATE orders SET chef_response_deadline = now() + make_interval(mins => $2) WHERE id = $1`, [orderId, PARTNER_RESPONSE_MINUTES]);
    await db.query(`UPDATE supplier_suborders SET response_deadline = now() + make_interval(mins => $2) WHERE order_id = $1 AND state = 'PENDING'`, [orderId, PARTNER_RESPONSE_MINUTES]);
    await event(db, orderId, 'PAID', null);
  }
}

// ---------------------------------------------------------------- cancellation and compensation

async function createRefunds(db: DbClient, orderId: string, reason: string, requestedBy: string | null): Promise<string[]> {
  const paid = (await db.query(
    `SELECT p.id, p.amount_piastres - p.refunded_piastres - coalesce((SELECT sum(amount_piastres) FROM refunds r WHERE r.attempt_id = p.id AND r.state = 'PENDING'), 0) AS remaining
     FROM payment_attempts p WHERE p.order_id = $1 AND p.state = 'SUCCEEDED'`, [orderId])).rows;
  const ids: string[] = [];
  for (const p of paid) {
    if (num(p.remaining) <= 0) continue;
    const r = await db.query(`INSERT INTO refunds (attempt_id, order_id, amount_piastres, reason, provider_ref, requested_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [p.id, orderId, p.remaining, reason, `simref_${randomUUID()}`, requestedBy]);
    ids.push(r.rows[0].id);
  }
  return ids;
}

/** Cancels an order that has not started preparation, releasing holds and refunding every paid recipient. */
export async function cancelOrder(db: DbClient, orderId: string, reason: string, actorUserId: string | null, correlationId: string, expectedVersion?: number): Promise<string[]> {
  const o = (await db.query(`SELECT * FROM orders WHERE id = $1 FOR UPDATE`, [orderId])).rows[0];
  if (!o) throw notFound('Order');
  if (expectedVersion !== undefined && o.version !== expectedVersion) throw conflict('VERSION_CONFLICT', 'The order changed; reload', { currentVersion: o.version });
  if (o.fulfillment_state === 'CANCELLED') return [];
  if (!['RESERVED', 'AWAITING_INGREDIENTS', 'READY_TO_PREPARE', 'ON_HOLD'].includes(o.fulfillment_state)) {
    throw conflict('TOO_LATE_TO_CANCEL', 'Preparation has started; contact support');
  }
  const res = (await db.query(`SELECT id FROM capacity_reservations WHERE order_id = $1 AND state IN ('ACTIVE','CONFIRMED')`, [orderId])).rows;
  for (const r of res) await releaseCapacity(db, r.id, 'RELEASED');
  const inv = (await db.query(`UPDATE inventory_reservations SET state = 'RELEASED' WHERE order_id = $1 AND state = 'ACTIVE' RETURNING product_id, packs`, [orderId])).rows;
  for (const i of inv) await db.query(`UPDATE inventory_balances SET reserved_packs = reserved_packs - $2, version = version + 1 WHERE product_id = $1`, [i.product_id, i.packs]);
  await db.query(`UPDATE supplier_suborders SET state = 'CANCELLED', version = version + 1 WHERE order_id = $1 AND state IN ('PENDING','CONFIRMED')`, [orderId]);
  await db.query(`UPDATE delivery_legs SET state = 'CANCELLED', version = version + 1 WHERE order_id = $1 AND state NOT IN ('DELIVERED','CANCELLED')`, [orderId]);
  await db.query(`UPDATE payment_attempts SET state = 'VOIDED', updated_at = now() WHERE order_id = $1 AND state = 'PENDING'`, [orderId]);
  const refunds = await createRefunds(db, orderId, reason, actorUserId);
  const funding = refunds.length ? 'COMPENSATING' : o.funding_state === 'FUNDED' || o.funding_state === 'PARTIALLY_FUNDED' ? 'COMPENSATED' : o.funding_state;
  await db.query(`UPDATE orders SET fulfillment_state = 'CANCELLED', cancel_reason = $2, funding_state = $3, version = version + 1, updated_at = now() WHERE id = $1`,
    [orderId, reason, funding]);
  await event(db, orderId, 'CANCELLED', actorUserId, { reason });
  await audit(db, { actorUserId, action: 'ORDER_CANCELLED', targetType: 'order', targetId: orderId, reason, correlationId });
  await enqueueEvent(db, { aggregateType: 'order', aggregateId: orderId, eventType: 'ORDER_CANCELLED', payload: { orderId, reason, refunds: refunds.length }, correlationId });
  return refunds;
}

/** Sandbox: asks the simulated provider to pay out refunds; it answers with signed webhook events. */
export async function dispatchRefunds(pool: Pool, deps: OrderDeps, refundIds: string[], correlationId: string) {
  for (const id of refundIds) {
    const r = (await pool.query(`SELECT provider_ref, amount_piastres FROM refunds WHERE id = $1 AND state = 'PENDING'`, [id])).rows[0];
    if (!r) continue;
    const body = JSON.stringify({ id: `evt_${randomUUID()}`, type: 'refund.succeeded', data: { providerRef: r.provider_ref, amountPiastres: num(r.amount_piastres) } });
    await handleProviderEvent(pool, deps, body, signWebhook(deps.webhookSecret, body), correlationId);
  }
}

/** Moves a funded order forward once the chef and every shop have confirmed. */
export async function tryConfirm(db: DbClient, orderId: string) {
  const o = (await db.query(`SELECT * FROM orders WHERE id = $1 FOR UPDATE`, [orderId])).rows[0];
  if (o.fulfillment_state !== 'RESERVED' || o.funding_state !== 'FUNDED' || o.chef_acceptance !== 'ACCEPTED') return false;
  const pendingShops = await db.query(`SELECT 1 FROM supplier_suborders WHERE order_id = $1 AND state <> 'CONFIRMED'`, [orderId]);
  if (pendingShops.rowCount) return false;
  const next = await applyTransition(db, orderId, 'CONFIRM', { partnersConfirmed: true, fundingConfirmed: true });
  if (next.state === 'AWAITING_INGREDIENTS') await db.query(`UPDATE delivery_legs SET state = 'OPEN', version = version + 1 WHERE order_id = $1 AND kind = 'INGREDIENT_TO_CHEF' AND state = 'WAITING'`, [orderId]);
  await event(db, orderId, 'CONFIRMED', null);
  return true;
}

// ---------------------------------------------------------------- read models

async function recipientNames(db: Queryable, rows: Array<{ recipient_type: string; recipient_id: string }>) {
  const names = new Map<string, string>();
  const chefIds = rows.filter((r) => r.recipient_type === 'CHEF').map((r) => r.recipient_id);
  const branchIds = rows.filter((r) => r.recipient_type === 'SUPPLIER').map((r) => r.recipient_id);
  if (chefIds.length) for (const c of (await db.query(`SELECT id, public_name FROM chefs WHERE id = ANY($1)`, [chefIds])).rows) names.set(c.id, c.public_name);
  if (branchIds.length) for (const b of (await db.query(`SELECT id, public_name FROM supplier_branches WHERE id = ANY($1)`, [branchIds])).rows) names.set(b.id, b.public_name);
  const legIds = rows.filter((r) => r.recipient_type === 'DELIVERY_LEG').map((r) => r.recipient_id);
  if (legIds.length) for (const l of (await db.query(`SELECT id, kind FROM delivery_legs WHERE id = ANY($1)`, [legIds])).rows) names.set(l.id, l.kind === 'MEAL_TO_CUSTOMER' ? 'Meal delivery' : 'Ingredient delivery');
  names.set(PLATFORM_ID, 'Lahloba');
  return names;
}

const point = (lat: unknown, lng: unknown, en: string, ar: string) =>
  lat === null || lng === null || lat === undefined ? null : { lat: num(lat), lng: num(lng), label: L(en, ar), approximate: true as const };

export async function legTracking(db: Queryable, orderId: string) {
  const r = await db.query(
    `SELECT l.id, l.kind, l.state, l.fee_piastres, cp.display_name AS courier,
            fa.latitude AS f_lat, fa.longitude AS f_lng, fa.label_en AS f_en, fa.label_ar AS f_ar,
            ta.latitude AS t_lat, ta.longitude AS t_lng, ta.label_en AS t_en, ta.label_ar AS t_ar
     FROM delivery_legs l JOIN service_areas fa ON fa.id = l.from_area_id JOIN service_areas ta ON ta.id = l.to_area_id
     LEFT JOIN courier_profiles cp ON cp.id = l.courier_id WHERE l.order_id = $1 ORDER BY l.kind = 'MEAL_TO_CUSTOMER', l.created_at`, [orderId]);
  return r.rows.map((l) => ({
    legId: l.id, kind: l.kind, state: l.state, feePiastres: num(l.fee_piastres),
    // First name only; couriers' contact details are never exposed.
    courierName: l.courier ? String(l.courier).split(' ')[0] : null,
    from: point(l.f_lat, l.f_lng, l.f_en, l.f_ar), to: point(l.t_lat, l.t_lng, l.t_en, l.t_ar),
  }));
}

export async function loadOrderDto(db: Queryable, deps: OrderDeps, orderId: string, viewer: { customerId: string }): Promise<C.OrderDto> {
  const o = (await db.query(`SELECT o.*, q.snapshot, q.servings FROM orders o JOIN quotes q ON q.id = o.quote_id WHERE o.id = $1 AND o.customer_id = $2`, [orderId, viewer.customerId])).rows[0];
  if (!o) throw notFound('Order');
  const s = o.snapshot as QuoteSnapshot;
  const allocs = (await db.query(
    `SELECT a.*, (SELECT p.state FROM payment_attempts p WHERE p.allocation_id = a.id ORDER BY (p.state = 'SUCCEEDED') DESC, p.created_at DESC LIMIT 1) AS attempt_state,
            coalesce((SELECT sum(p.refunded_piastres) FROM payment_attempts p WHERE p.allocation_id = a.id), 0) AS refunded
     FROM payment_allocations a WHERE a.order_id = $1 ORDER BY a.recipient_type, a.id`, [orderId])).rows;
  const names = await recipientNames(db, allocs);
  const subs = (await db.query(`SELECT s.state, b.public_name FROM supplier_suborders s JOIN supplier_branches b ON b.id = s.branch_id WHERE s.order_id = $1`, [orderId])).rows;
  const meal = (await db.query(`SELECT id, state FROM delivery_legs WHERE order_id = $1 AND kind = 'MEAL_TO_CUSTOMER'`, [orderId])).rows[0];
  const events = (await db.query(`SELECT kind, occurred_at FROM order_events WHERE order_id = $1 ORDER BY id`, [orderId])).rows;
  const payBy = (await db.query(`SELECT expires_at FROM capacity_reservations WHERE order_id = $1 AND state = 'ACTIVE'`, [orderId])).rows[0];
  const allocationState = (a: Record<string, unknown>) => {
    const refunded = num(a.refunded);
    if (refunded > 0) return refunded >= num(a.amount_piastres) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    return a.attempt_state === 'SUCCEEDED' ? 'PAID' : a.attempt_state === 'PENDING' ? 'PENDING' : a.attempt_state === 'FAILED' ? 'FAILED' : a.attempt_state === 'UNKNOWN' ? 'UNKNOWN' : 'UNPAID';
  };
  return C.OrderDto.parse({
    id: o.id, reference: orderReference(o.id), dishTitle: L(s.offer.titleEn, s.offer.titleAr), chef: { id: s.chef.id, publicName: s.chef.name },
    source: o.source, servings: o.servings, slot: { startsAt: s.slot.startsAt, endsAt: s.slot.endsAt },
    fulfillmentState: o.fulfillment_state, fundingState: o.funding_state, chefAcceptance: o.chef_acceptance,
    suppliers: subs.map((x) => ({ branchName: x.public_name, state: x.state })),
    totalPiastres: num(o.total_piastres),
    lines: s.lines.map((l) => ({ component: l.component, recipientType: l.recipientType, recipientName: l.recipientName, amountPiastres: l.amountPiastres })),
    allocations: allocs.map((a) => ({
      allocationId: a.id, recipientType: a.recipient_type, recipientName: names.get(a.recipient_id) ?? '', components: a.components,
      amountPiastres: num(a.amount_piastres), state: allocationState(a), refundedPiastres: num(a.refunded),
    })),
    payBy: payBy && o.fulfillment_state === 'RESERVED' && o.funding_state !== 'FUNDED' ? new Date(payBy.expires_at).toISOString() : null,
    dropoffCode: meal && ['ASSIGNED', 'PICKED_UP', 'OPEN', 'WAITING'].includes(meal.state) && o.fulfillment_state !== 'CANCELLED' ? handoffCode(deps.handoffSecret, meal.id, 'DROPOFF') : null,
    legs: await legTracking(db, orderId),
    cancelReason: o.cancel_reason,
    events: events.map((e) => ({ kind: e.kind, at: new Date(e.occurred_at).toISOString() })),
    version: o.version, createdAt: new Date(o.created_at).toISOString(), sandbox: true,
  });
}
