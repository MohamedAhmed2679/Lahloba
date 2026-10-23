import * as C from '@lahloba/contracts';
import type { DbClient, Pool, Queryable } from '../db';
import { withTx } from '../db';
import { HttpError, conflict, notFound } from '../errors';
import { audit } from '../platform';
import { consumeCapacity, hasConfirmedCapacity, releaseCapacity } from '../capacity';
import { MAX_CODE_ATTEMPTS, codeMatches, handoffCode } from './handoff';
import type { QuoteSnapshot } from './quote';
import { applyTransition, cancelOrder, dispatchRefunds, legTracking, orderReference, tryConfirm, type OrderDeps } from './service';

const L = (en: string, ar: string) => ({ en, ar });
const num = (v: unknown) => Number(v);
const iso = (v: unknown) => new Date(v as string).toISOString();

async function event(db: Queryable, orderId: string, kind: string, actorUserId: string | null, detail: Record<string, unknown> = {}) {
  await db.query(`INSERT INTO order_events (order_id, kind, actor_user_id, detail) VALUES ($1, $2, $3, $4)`, [orderId, kind, actorUserId, JSON.stringify(detail)]);
}

// ---------------------------------------------------------------- chef

/** Chefs only see orders once they are paid (pay first; partners are never asked to cook unpaid orders). */
export async function chefOrders(db: Queryable, deps: OrderDeps, chefId: string, orderId?: string): Promise<C.ChefOrderDto[]> {
  const r = await db.query(
    `SELECT o.*, q.snapshot, q.servings FROM orders o JOIN quotes q ON q.id = o.quote_id
     WHERE o.chef_id = $1 AND (o.funding_state IN ('FUNDED','COMPENSATING','COMPENSATED') OR o.fulfillment_state <> 'RESERVED') ${orderId ? 'AND o.id = $2' : ''}
       AND NOT (o.fulfillment_state = 'CANCELLED' AND o.chef_acceptance = 'PENDING' AND o.funding_state NOT IN ('COMPENSATING','COMPENSATED'))
     ORDER BY o.created_at DESC LIMIT 100`, orderId ? [chefId, orderId] : [chefId]);
  const out: C.ChefOrderDto[] = [];
  for (const o of r.rows) {
    const s = o.snapshot as QuoteSnapshot;
    const reqs = (await db.query(
      `SELECT r.ingredient_id, r.quantity_per_serving, r.unit, r.weight_basis, r.is_pantry, i.name_en, i.name_ar
       FROM ingredient_requirements r JOIN ingredients i ON i.id = r.ingredient_id WHERE r.recipe_version_id = $1 ORDER BY r.sort_order`, [s.offer.recipeVersionId])).rows;
    const legs = (await db.query(`SELECT id, kind, state FROM delivery_legs WHERE order_id = $1`, [o.id])).rows;
    const ingLeg = legs.find((l) => l.kind === 'INGREDIENT_TO_CHEF');
    const mealLeg = legs.find((l) => l.kind === 'MEAL_TO_CUSTOMER');
    const mealStop = mealLeg ? (await db.query(`SELECT id FROM delivery_stops WHERE leg_id = $1 AND party_type = 'CHEF'`, [mealLeg.id])).rows[0] : null;
    const active = o.fulfillment_state !== 'CANCELLED';
    out.push(C.ChefOrderDto.parse({
      id: o.id, reference: orderReference(o.id), dishTitle: L(s.offer.titleEn, s.offer.titleAr), serviceMode: s.offer.serviceMode,
      servings: o.servings, source: o.source, slot: { startsAt: s.slot.startsAt, endsAt: s.slot.endsAt },
      fulfillmentState: o.fulfillment_state, fundingState: o.funding_state, chefAcceptance: o.chef_acceptance, respondBy: iso(o.chef_response_deadline),
      ingredientsAccepted: o.ingredients_accepted,
      ingredients: reqs.map((x) => ({ ingredientId: x.ingredient_id, name: L(x.name_en, x.name_ar), quantity: num(x.quantity_per_serving) * o.servings, unit: x.unit, weightBasis: x.weight_basis, isPantry: x.is_pantry })),
      chefEarningsPiastres: s.lines.filter((l) => l.recipientType === 'CHEF').reduce((n, l) => n + l.amountPiastres, 0),
      ingredientDropoffCode: active && ingLeg && ['OPEN', 'ASSIGNED', 'PICKED_UP'].includes(ingLeg.state) ? handoffCode(deps.handoffSecret, ingLeg.id, 'DROPOFF') : null,
      mealPickupCode: active && mealLeg && mealStop && ['OPEN', 'ASSIGNED'].includes(mealLeg.state) ? handoffCode(deps.handoffSecret, mealStop.id, 'PICKUP') : null,
      legs: await legTracking(db, o.id),
      version: o.version,
    }));
  }
  return out;
}

async function lockChefOrder(db: DbClient, chefId: string, orderId: string, expectedVersion: number) {
  const o = (await db.query(`SELECT * FROM orders WHERE id = $1 AND chef_id = $2 FOR UPDATE`, [orderId, chefId])).rows[0];
  if (!o || (o.funding_state === 'UNFUNDED' && o.fulfillment_state === 'RESERVED')) throw notFound('Order');
  if (o.version !== expectedVersion) throw conflict('VERSION_CONFLICT', 'The order changed; reload', { currentVersion: o.version });
  return o;
}

export async function chefRespond(db: DbClient, chefId: string, orderId: string, body: { accept: boolean; reason?: string; expectedVersion: number }, actorUserId: string, correlationId: string): Promise<string[]> {
  const o = await lockChefOrder(db, chefId, orderId, body.expectedVersion);
  if (o.chef_acceptance !== 'PENDING' || o.fulfillment_state !== 'RESERVED') throw conflict('ALREADY_DECIDED', 'This order was already answered');
  if (o.funding_state !== 'FUNDED') throw conflict('NOT_FUNDED', 'This order is not fully paid yet');
  if (new Date(o.chef_response_deadline).getTime() < Date.now()) throw conflict('RESPONSE_EXPIRED', 'The time to answer has passed');
  if (!body.accept) {
    await db.query(`UPDATE orders SET chef_acceptance = 'REJECTED', version = version + 1 WHERE id = $1`, [orderId]);
    await audit(db, { actorUserId, action: 'CHEF_DECLINED_ORDER', targetType: 'order', targetId: orderId, reason: body.reason ?? null, correlationId });
    return cancelOrder(db, orderId, 'CHEF_DECLINED', actorUserId, correlationId);
  }
  await db.query(`UPDATE orders SET chef_acceptance = 'ACCEPTED', version = version + 1, updated_at = now() WHERE id = $1`, [orderId]);
  await event(db, orderId, 'CHEF_ACCEPTED', actorUserId);
  await audit(db, { actorUserId, action: 'CHEF_ACCEPTED_ORDER', targetType: 'order', targetId: orderId, correlationId });
  await tryConfirm(db, orderId);
  return [];
}

export async function chefCheckIngredients(db: DbClient, chefId: string, orderId: string, body: { accepted: boolean; lines: Array<{ ingredientId: string; ok: boolean; note?: string }>; note?: string; expectedVersion: number }, actorUserId: string, correlationId: string) {
  const o = await lockChefOrder(db, chefId, orderId, body.expectedVersion);
  if (o.fulfillment_state !== 'AWAITING_INGREDIENTS') throw conflict('INVALID_TRANSITION', 'Ingredients are not awaited for this order');
  const leg = (await db.query(`SELECT state FROM delivery_legs WHERE order_id = $1 AND kind = 'INGREDIENT_TO_CHEF'`, [orderId])).rows[0];
  if (leg?.state !== 'DELIVERED') throw conflict('INGREDIENTS_NOT_DELIVERED', 'The ingredients have not been handed to you yet');
  // Delivery to the chef is not acceptance: the chef's check is recorded separately (blueprint rule 12).
  await db.query(`INSERT INTO ingredient_acceptances (order_id, chef_user_id, accepted, lines, note) VALUES ($1, $2, $3, $4, $5)`,
    [orderId, actorUserId, body.accepted && body.lines.every((l) => l.ok), JSON.stringify(body.lines), body.note ?? null]);
  if (!body.accepted || !body.lines.every((l) => l.ok)) {
    await db.query(`UPDATE orders SET fulfillment_state = 'ON_HOLD', hold_reason = 'INGREDIENTS_REJECTED', version = version + 1, updated_at = now() WHERE id = $1`, [orderId]);
    await event(db, orderId, 'INGREDIENTS_REJECTED', actorUserId);
    await audit(db, { actorUserId, action: 'INGREDIENTS_REJECTED', targetType: 'order', targetId: orderId, reason: body.note ?? null, correlationId });
    return;
  }
  await applyTransition(db, orderId, 'ACCEPT_INGREDIENTS', { allRequiredAccepted: true, handoffVerified: true });
  await event(db, orderId, 'INGREDIENTS_ACCEPTED', actorUserId);
}

export async function chefStart(db: DbClient, chefId: string, orderId: string, expectedVersion: number, actorUserId: string) {
  const o = await lockChefOrder(db, chefId, orderId, expectedVersion);
  await applyTransition(db, orderId, 'START_PREPARATION', {
    fundingConfirmed: o.funding_state === 'FUNDED', capacityConfirmed: await hasConfirmedCapacity(db, orderId),
    chefIngredientsChecked: o.source === 'CHEF',
  }, expectedVersion);
  await consumeCapacity(db, orderId);
  await event(db, orderId, 'PREPARING', actorUserId);
}

export async function chefReady(db: DbClient, chefId: string, orderId: string, expectedVersion: number, actorUserId: string) {
  await lockChefOrder(db, chefId, orderId, expectedVersion);
  await applyTransition(db, orderId, 'MARK_READY', { packed: true, instructionsAttached: true }, expectedVersion);
  await db.query(`UPDATE delivery_legs SET state = 'OPEN', version = version + 1 WHERE order_id = $1 AND kind = 'MEAL_TO_CUSTOMER' AND state = 'WAITING'`, [orderId]);
  await event(db, orderId, 'READY_FOR_PICKUP', actorUserId);
}

// ---------------------------------------------------------------- supplier

export async function branchSuborders(db: Queryable, deps: OrderDeps, branchId: string, suborderId?: string): Promise<C.SupplierSuborderDto[]> {
  const r = await db.query(
    `SELECT s.*, o.funding_state, o.fulfillment_state FROM supplier_suborders s JOIN orders o ON o.id = s.order_id
     WHERE s.branch_id = $1 AND (o.funding_state <> 'UNFUNDED' OR o.fulfillment_state <> 'RESERVED') ${suborderId ? 'AND s.id = $2' : ''}
     ORDER BY s.created_at DESC LIMIT 100`, suborderId ? [branchId, suborderId] : [branchId]);
  const out: C.SupplierSuborderDto[] = [];
  for (const s of r.rows) {
    const stop = (await db.query(
      `SELECT st.id, st.state, l.state AS leg_state, cp.display_name FROM delivery_stops st JOIN delivery_legs l ON l.id = st.leg_id
       LEFT JOIN courier_profiles cp ON cp.id = l.courier_id WHERE l.order_id = $1 AND st.party_type = 'SUPPLIER_BRANCH' AND st.party_id = $2`, [s.order_id, branchId])).rows[0];
    out.push(C.SupplierSuborderDto.parse({
      id: s.id, orderReference: orderReference(s.order_id), state: s.state,
      lines: (s.lines as QuoteSnapshot['basket']).map((l) => ({ productId: l.productId, sku: l.sku, name: L(l.nameEn, l.nameAr), packs: l.packs, packQuantity: l.packQuantity, packUnit: l.packUnit, amountPiastres: l.amountPiastres })),
      totalPiastres: num(s.total_piastres), respondBy: iso(s.response_deadline), funded: s.funding_state === 'FUNDED',
      pickupCode: s.state === 'CONFIRMED' && stop && stop.state === 'PENDING' && ['WAITING', 'OPEN', 'ASSIGNED', 'PICKED_UP'].includes(stop.leg_state) ? handoffCode(deps.handoffSecret, stop.id, 'PICKUP') : null,
      courierName: stop?.display_name ? String(stop.display_name).split(' ')[0] : null,
      version: s.version,
    }));
  }
  return out;
}

export async function supplierRespond(db: DbClient, branchId: string, suborderId: string, body: { confirm: boolean; reason?: string; expectedVersion: number }, actorUserId: string, correlationId: string): Promise<string[]> {
  const s = (await db.query(`SELECT s.*, o.funding_state FROM supplier_suborders s JOIN orders o ON o.id = s.order_id WHERE s.id = $1 AND s.branch_id = $2 FOR UPDATE OF s`, [suborderId, branchId])).rows[0];
  if (!s || s.funding_state === 'UNFUNDED') throw notFound('Order');
  if (s.version !== body.expectedVersion) throw conflict('VERSION_CONFLICT', 'The order changed; reload', { currentVersion: s.version });
  if (s.state !== 'PENDING') throw conflict('ALREADY_DECIDED', 'This order was already answered');
  if (s.funding_state !== 'FUNDED') throw conflict('NOT_FUNDED', 'This order is not fully paid yet');
  if (!body.confirm) {
    await db.query(`UPDATE supplier_suborders SET state = 'REJECTED', reject_reason = $2, version = version + 1 WHERE id = $1`, [suborderId, body.reason]);
    await audit(db, { actorUserId, action: 'SUPPLIER_REJECTED_SUBORDER', targetType: 'supplier_suborder', targetId: suborderId, reason: body.reason ?? null, correlationId });
    return cancelOrder(db, s.order_id, 'SUPPLIER_REJECTED', actorUserId, correlationId);
  }
  await db.query(`UPDATE supplier_suborders SET state = 'CONFIRMED', version = version + 1 WHERE id = $1`, [suborderId]);
  await event(db, s.order_id, 'SHOP_CONFIRMED', actorUserId);
  await audit(db, { actorUserId, action: 'SUPPLIER_CONFIRMED_SUBORDER', targetType: 'supplier_suborder', targetId: suborderId, correlationId });
  await tryConfirm(db, s.order_id);
  return [];
}

// ---------------------------------------------------------------- courier

export async function courierProfile(db: Queryable, userId: string) {
  const c = (await db.query(`SELECT * FROM courier_profiles WHERE user_id = $1`, [userId])).rows[0];
  if (!c || c.status !== 'APPROVED') throw new HttpError(403, 'COURIER_NOT_APPROVED', 'Your courier account is not approved yet');
  return c as { id: string; equipment: string[]; display_name: string };
}

async function partyName(db: Queryable, type: string, id: string) {
  const r = type === 'CHEF'
    ? await db.query(`SELECT public_name FROM chefs WHERE id = $1`, [id])
    : await db.query(`SELECT public_name FROM supplier_branches WHERE id = $1`, [id]);
  return r.rows[0]?.public_name ?? '';
}

export async function courierLegs(db: Queryable, courier: { id: string; equipment: string[] }, legId?: string): Promise<C.CourierLegDto[]> {
  const r = await db.query(
    `SELECT l.*, fa.label_en f_en, fa.label_ar f_ar, fa.latitude f_lat, fa.longitude f_lng, ta.label_en t_en, ta.label_ar t_ar, ta.latitude t_lat, ta.longitude t_lng,
            da.address_text AS d_text, da.access_notes AS d_notes, da.owner_user_id AS d_owner, o.chef_id
     FROM delivery_legs l JOIN orders o ON o.id = l.order_id
     JOIN service_areas fa ON fa.id = l.from_area_id JOIN service_areas ta ON ta.id = l.to_area_id
     JOIN private_addresses da ON da.id = l.destination_address_id
     WHERE ${legId ? 'l.id = $2 AND (l.courier_id = $1 OR l.state = \'OPEN\')' : "(l.state = 'OPEN' OR (l.courier_id = $1 AND l.state IN ('ASSIGNED','PICKED_UP')))"}
     ORDER BY l.state = 'OPEN', l.created_at LIMIT 50`, legId ? [courier.id, legId] : [courier.id]);
  const out: C.CourierLegDto[] = [];
  for (const l of r.rows) {
    const mine = l.courier_id === courier.id;
    const stops = (await db.query(
      `SELECT st.*, a.address_text, sa.label_en, sa.label_ar FROM delivery_stops st LEFT JOIN private_addresses a ON a.id = st.pickup_address_id
       LEFT JOIN service_areas sa ON sa.id = a.area_id WHERE st.leg_id = $1 ORDER BY st.seq`, [l.id])).rows;
    const dropName = l.kind === 'INGREDIENT_TO_CHEF' ? await partyName(db, 'CHEF', l.chef_id) : 'Customer';
    out.push(C.CourierLegDto.parse({
      legId: l.id, kind: l.kind, state: l.state, feePiastres: num(l.fee_piastres), requiredEquipment: l.required_equipment,
      fromArea: L(l.f_en, l.f_ar), toArea: L(l.t_en, l.t_ar),
      stops: await Promise.all(stops.map(async (st) => ({
        stopId: st.id, seq: st.seq, partyType: st.party_type, partyName: await partyName(db, st.party_type, st.party_id),
        area: L(st.label_en ?? l.f_en, st.label_ar ?? l.f_ar),
        // Exact pickup and drop-off addresses only once the job is this courier's (privacy).
        addressText: mine ? st.address_text : null, state: st.state,
      }))),
      dropoff: { partyName: dropName, addressText: mine ? l.d_text : null, accessNotes: mine ? l.d_notes : null },
      from: l.f_lat === null ? null : { lat: num(l.f_lat), lng: num(l.f_lng), label: L(l.f_en, l.f_ar), approximate: true },
      to: l.t_lat === null ? null : { lat: num(l.t_lat), lng: num(l.t_lng), label: L(l.t_en, l.t_ar), approximate: true },
      version: l.version,
      canClaim: l.state === 'OPEN' && (l.required_equipment as string[]).every((e) => courier.equipment.includes(e)),
    }));
  }
  return out;
}

export async function claimLeg(db: DbClient, courier: { id: string; equipment: string[] }, legId: string, expectedVersion: number, actorUserId: string, correlationId: string) {
  const l = (await db.query(`SELECT * FROM delivery_legs WHERE id = $1 FOR UPDATE`, [legId])).rows[0];
  if (!l || (l.state !== 'OPEN' && l.courier_id !== courier.id)) throw notFound('Job');
  if (l.version !== expectedVersion) throw conflict('VERSION_CONFLICT', 'This job changed; reload', { currentVersion: l.version });
  if (l.state !== 'OPEN') throw conflict('ALREADY_CLAIMED', 'Another courier already took this job');
  if (!(l.required_equipment as string[]).every((e) => courier.equipment.includes(e))) throw new HttpError(422, 'EQUIPMENT_REQUIRED', 'This job needs equipment you have not registered', { required: l.required_equipment });
  await db.query(`UPDATE delivery_legs SET state = 'ASSIGNED', courier_id = $2, assigned_at = now(), version = version + 1 WHERE id = $1`, [legId, courier.id]);
  await event(db, l.order_id, l.kind === 'MEAL_TO_CUSTOMER' ? 'COURIER_ASSIGNED_MEAL' : 'COURIER_ASSIGNED_INGREDIENTS', actorUserId);
  await audit(db, { actorUserId, action: 'LEG_CLAIMED', targetType: 'delivery_leg', targetId: legId, correlationId });
}

async function registerFailedCode(db: DbClient, table: 'delivery_stops' | 'delivery_legs', column: 'pickup_attempts' | 'dropoff_attempts', id: string, actorUserId: string, correlationId: string) {
  const r = await db.query(`UPDATE ${table} SET ${column} = ${column} + 1 WHERE id = $1 RETURNING ${column} AS n`, [id]);
  await audit(db, { actorUserId, action: 'HANDOFF_CODE_FAILED', targetType: table, targetId: id, correlationId });
  return num(r.rows[0].n);
}

/** Code checks commit their failure count even though the request fails (attempt limiting). */
export async function collectStop(pool: Pool, deps: OrderDeps, courier: { id: string }, legId: string, stopId: string, code: string, expectedVersion: number, actorUserId: string, correlationId: string) {
  const outcome = await withTx(pool, async (db) => {
    const l = (await db.query(`SELECT * FROM delivery_legs WHERE id = $1 AND courier_id = $2 FOR UPDATE`, [legId, courier.id])).rows[0];
    if (!l) throw notFound('Job');
    if (l.version !== expectedVersion) throw conflict('VERSION_CONFLICT', 'This job changed; reload', { currentVersion: l.version });
    if (!['ASSIGNED', 'PICKED_UP'].includes(l.state)) throw conflict('INVALID_STATE', 'Nothing to collect on this job');
    const st = (await db.query(`SELECT * FROM delivery_stops WHERE id = $1 AND leg_id = $2 FOR UPDATE`, [stopId, legId])).rows[0];
    if (!st) throw notFound('Stop');
    if (st.state === 'COLLECTED') throw conflict('ALREADY_COLLECTED', 'Already collected');
    if (st.pickup_attempts >= MAX_CODE_ATTEMPTS) throw new HttpError(423, 'CODE_LOCKED', 'Too many wrong codes. Contact support to continue.');
    if (l.kind === 'MEAL_TO_CUSTOMER') {
      const o = (await db.query(`SELECT fulfillment_state FROM orders WHERE id = $1`, [l.order_id])).rows[0];
      if (o.fulfillment_state !== 'READY_FOR_PICKUP') throw conflict('NOT_READY', 'The meal is not ready yet');
    } else {
      const sub = (await db.query(`SELECT state FROM supplier_suborders WHERE order_id = $1 AND branch_id = $2`, [l.order_id, st.party_id])).rows[0];
      if (sub?.state !== 'CONFIRMED') throw conflict('NOT_READY', 'The shop has not confirmed this order');
    }
    if (!codeMatches(deps.handoffSecret, stopId, 'PICKUP', code, st.pickup_code_hash)) {
      const n = await registerFailedCode(db, 'delivery_stops', 'pickup_attempts', stopId, actorUserId, correlationId);
      return { ok: false as const, left: MAX_CODE_ATTEMPTS - n };
    }
    await db.query(`UPDATE delivery_stops SET state = 'COLLECTED', collected_at = now() WHERE id = $1`, [stopId]);
    if (st.party_type === 'SUPPLIER_BRANCH') {
      await db.query(`UPDATE supplier_suborders SET state = 'HANDED_OVER', version = version + 1 WHERE order_id = $1 AND branch_id = $2`, [l.order_id, st.party_id]);
      const inv = (await db.query(
        `UPDATE inventory_reservations r SET state = 'CONSUMED' FROM supplier_products p
         WHERE r.product_id = p.id AND p.branch_id = $2 AND r.order_id = $1 AND r.state = 'ACTIVE' RETURNING r.product_id, r.packs`, [l.order_id, st.party_id])).rows;
      for (const i of inv) await db.query(`UPDATE inventory_balances SET on_hand_packs = on_hand_packs - $2, reserved_packs = reserved_packs - $2, version = version + 1 WHERE product_id = $1`, [i.product_id, i.packs]);
    }
    const left = await db.query(`SELECT 1 FROM delivery_stops WHERE leg_id = $1 AND state = 'PENDING'`, [legId]);
    if (!left.rowCount) {
      await db.query(`UPDATE delivery_legs SET state = 'PICKED_UP', version = version + 1 WHERE id = $1`, [legId]);
      if (l.kind === 'MEAL_TO_CUSTOMER') await applyTransition(db, l.order_id, 'FINAL_PICKUP', { assignedCourier: true, handoffVerified: true });
    } else {
      await db.query(`UPDATE delivery_legs SET state = 'PICKED_UP', version = version + 1 WHERE id = $1 AND state = 'ASSIGNED'`, [legId]);
    }
    await event(db, l.order_id, st.party_type === 'CHEF' ? 'MEAL_COLLECTED' : 'INGREDIENTS_COLLECTED', actorUserId);
    return { ok: true as const };
  });
  if (!outcome.ok) throw new HttpError(422, 'WRONG_CODE', `That code is not right. ${Math.max(0, outcome.left)} tries left.`, { attemptsLeft: Math.max(0, outcome.left) });
}

export async function deliverLeg(pool: Pool, deps: OrderDeps, courier: { id: string }, legId: string, code: string, expectedVersion: number, actorUserId: string, correlationId: string) {
  const outcome = await withTx(pool, async (db) => {
    const l = (await db.query(`SELECT * FROM delivery_legs WHERE id = $1 AND courier_id = $2 FOR UPDATE`, [legId, courier.id])).rows[0];
    if (!l) throw notFound('Job');
    if (l.version !== expectedVersion) throw conflict('VERSION_CONFLICT', 'This job changed; reload', { currentVersion: l.version });
    if (l.state !== 'PICKED_UP') throw conflict('INVALID_STATE', 'Collect everything before delivering');
    const pending = await db.query(`SELECT 1 FROM delivery_stops WHERE leg_id = $1 AND state = 'PENDING'`, [legId]);
    if (pending.rowCount) throw conflict('STOPS_PENDING', 'Some pickups are not collected yet');
    if (l.dropoff_attempts >= MAX_CODE_ATTEMPTS) throw new HttpError(423, 'CODE_LOCKED', 'Too many wrong codes. Contact support to continue.');
    if (!codeMatches(deps.handoffSecret, legId, 'DROPOFF', code, l.dropoff_code_hash)) {
      const n = await registerFailedCode(db, 'delivery_legs', 'dropoff_attempts', legId, actorUserId, correlationId);
      return { ok: false as const, left: MAX_CODE_ATTEMPTS - n };
    }
    await db.query(`UPDATE delivery_legs SET state = 'DELIVERED', version = version + 1 WHERE id = $1`, [legId]);
    if (l.kind === 'MEAL_TO_CUSTOMER') {
      await applyTransition(db, l.order_id, 'DELIVER', { recipientProofVerified: true });
      await event(db, l.order_id, 'DELIVERED', actorUserId);
    } else {
      // Handed to the chef; the chef still has to check and accept the ingredients.
      await event(db, l.order_id, 'INGREDIENTS_DELIVERED', actorUserId);
    }
    await audit(db, { actorUserId, action: 'LEG_DELIVERED', targetType: 'delivery_leg', targetId: legId, correlationId });
    return { ok: true as const };
  });
  if (!outcome.ok) throw new HttpError(422, 'WRONG_CODE', `That code is not right. ${Math.max(0, outcome.left)} tries left.`, { attemptsLeft: Math.max(0, outcome.left) });
}

// ---------------------------------------------------------------- sweep (scheduled)

/**
 * Expires holds and enforces deadlines. Safe to run concurrently and repeatedly (each order is
 * handled in its own transaction with row locks). Run by the worker and by Vercel Cron.
 */
export async function sweep(pool: Pool, deps: OrderDeps, correlationId: string, now = new Date()) {
  const summary = { quotesExpired: 0, unpaidCancelled: 0, partnerTimeouts: 0, holdsExpired: 0, reconciled: 0, refundsDispatched: 0 };
  summary.quotesExpired = (await pool.query(`UPDATE quotes SET status = 'EXPIRED' WHERE status = 'ACTIVE' AND expires_at <= $1`, [now])).rowCount ?? 0;
  // Payments with no answer are reconciled with the provider before anything else happens.
  // The simulator's record of a TIMEOUT is "never captured".
  summary.reconciled = (await pool.query(`UPDATE payment_attempts SET state = 'FAILED', failure_reason = 'RECONCILED_NOT_CAPTURED', updated_at = now()
    WHERE state = 'UNKNOWN' AND provider = 'simulator' AND updated_at <= $1::timestamptz - interval '1 minute'`, [now])).rowCount ?? 0;
  const unpaid = (await pool.query(
    `SELECT o.id FROM orders o JOIN capacity_reservations r ON r.order_id = o.id
     WHERE o.fulfillment_state = 'RESERVED' AND o.funding_state IN ('UNFUNDED','PARTIALLY_FUNDED') AND r.state = 'ACTIVE' AND r.expires_at <= $1
       AND NOT EXISTS (SELECT 1 FROM payment_attempts p WHERE p.order_id = o.id AND p.state = 'UNKNOWN')`, [now])).rows;
  const late = (await pool.query(
    `SELECT o.id FROM orders o WHERE o.fulfillment_state = 'RESERVED' AND o.funding_state = 'FUNDED' AND (
       (o.chef_acceptance = 'PENDING' AND o.chef_response_deadline <= $1) OR
       EXISTS (SELECT 1 FROM supplier_suborders s WHERE s.order_id = o.id AND s.state = 'PENDING' AND s.response_deadline <= $1))`, [now])).rows;
  const refunds: string[] = [];
  for (const [rows, reason, key] of [[unpaid, 'PAYMENT_NOT_COMPLETED', 'unpaidCancelled'], [late, 'PARTNER_DID_NOT_RESPOND', 'partnerTimeouts']] as const) {
    for (const r of rows) {
      try {
        refunds.push(...await withTx(pool, (db) => cancelOrder(db, r.id, reason, null, correlationId)));
        summary[key]++;
      } catch { /* changed concurrently; next sweep re-evaluates */ }
    }
  }
  // Holds not tied to a live order (e.g. abandoned) return to the slot.
  const stale = (await pool.query(`SELECT id FROM capacity_reservations WHERE state = 'ACTIVE' AND expires_at <= $1 AND order_id IS NULL`, [now])).rows;
  for (const s of stale) if (await releaseCapacity(pool, s.id, 'EXPIRED')) summary.holdsExpired++;
  const pendingRefunds = (await pool.query(`SELECT id FROM refunds WHERE state = 'PENDING' AND created_at <= $1::timestamptz - interval '30 seconds'`, [now])).rows.map((r) => r.id as string);
  refunds.push(...pendingRefunds);
  if (refunds.length) { await dispatchRefunds(pool, deps, [...new Set(refunds)], correlationId); summary.refundsDispatched = refunds.length; }
  return summary;
}
