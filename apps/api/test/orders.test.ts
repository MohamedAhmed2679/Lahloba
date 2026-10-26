import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sweep } from '../src/orders/fulfilment';
import { signWebhook } from '../src/orders/service';
import { TEST_DB_ADMIN_URL, createTestContext, type TestContext } from '../src/testing';
import { call } from './helpers';

/**
 * End-to-end order flow against PostgreSQL: quote -> order -> split SANDBOX payment -> partner
 * confirmation -> ingredient leg -> chef acceptance -> preparation -> meal leg -> delivered.
 * Plus compensation, expiry, duplicate/forged webhooks and handoff-code limits.
 */
describe.skipIf(!TEST_DB_ADMIN_URL)('orders, sandbox payments and two-leg delivery', () => {
  let ctx: TestContext;
  let s: NonNullable<TestContext['seed']>;
  let customer: string, other: string, chefA: string, chefB: string, shop1: string, shop2: string, courier: string;
  const address = () => ({ addressText: '12 Road 9, Maadi (test)', areaId: s.area.maadi, label: 'Home' });
  const deps = () => ({ handoffSecret: ctx.app && 'test-handoff-secret-'.padEnd(40, 'h'), webhookSecret: 'test-payments-secret-'.padEnd(40, 'z') });

  beforeAll(async () => {
    ctx = await createTestContext();
    s = ctx.seed!;
    [customer, other, chefA, chefB, shop1, shop2, courier] = await Promise.all([
      ctx.token('cust-one'), ctx.token('cust-two'), ctx.token('sample-chef-a'), ctx.token('sample-chef-b'),
      ctx.token('sample-supplier'), ctx.token('sample-supplier-2'), ctx.token('sample-courier'),
    ]);
  });
  afterAll(async () => ctx?.close());

  const firstSlot = async (offerKey: string) => (await call(ctx, 'GET', `/v1/offers/${s.offers[offerKey]}`)).body.slots[0].slotId as string;
  const quote = async (body: Record<string, unknown>, token = customer) => call(ctx, 'POST', '/v1/quotes', { token, body });
  const pay = async (orderId: string, outcome: 'SUCCEED' | 'DECLINE' | 'TIMEOUT', attemptId?: string) => {
    const start = await call(ctx, 'POST', `/v1/orders/${orderId}/payments`, { token: customer, body: {} });
    expect(start.status, start.raw).toBe(200);
    return call(ctx, 'POST', `/v1/sandbox/payments/${start.body.sessionId}/complete`, { token: customer, body: { outcome, ...(attemptId ? { attemptId } : {}) } });
  };
  const ledgerBalanced = async () => {
    const r = await ctx.pool.query(`SELECT coalesce(sum(debit_piastres),0)::bigint d, coalesce(sum(credit_piastres),0)::bigint c FROM ledger_entries`);
    return r.rows[0].d === r.rows[0].c;
  };

  it('quotes the founder example with chef-supplied ingredients, all from server data', async () => {
    const q = await quote({ offerId: s.offers['molokhia-eat'], servings: 4, source: 'CHEF', slotId: await firstSlot('molokhia-eat'), address: address() });
    expect(q.status, q.raw).toBe(201);
    const by = Object.fromEntries(q.body.lines.map((l: any) => [l.component, l.amountPiastres]));
    expect(by).toEqual({ LABOR: 4000, PACKAGING: 300, INGREDIENTS: 24000, FINAL_TRIP: 2500 });
    expect(q.body.totalPiastres).toBe(30800);
    expect(q.body.sandbox).toBe(true);
    // Clients cannot inject prices.
    expect((await quote({ offerId: s.offers['molokhia-eat'], servings: 4, source: 'CHEF', slotId: await firstSlot('molokhia-eat'), address: address(), totalPiastres: 1 })).status).toBe(400);
  });

  it('compares supplier baskets across shops, picks the cheapest complete basket, and honours a chosen product', async () => {
    const q = await quote({ offerId: s.offers['molokhia-eat'], servings: 4, source: 'SUPPLIERS', slotId: await firstSlot('molokhia-eat'), address: address() });
    expect(q.status, q.raw).toBe(201);
    const chicken = q.body.basket.find((b: any) => b.name.en.startsWith('Chicken'));
    expect(chicken.options).toHaveLength(2);
    expect(chicken.chosen.amountPiastres).toBe(16500); // 1 x 1 kg beats 2 x 500 g (18000)
    expect(chicken.chosen.leftoverQuantity).toBe(400);
    expect(q.body.pantryNote.map((p: any) => p.en)).toEqual(expect.arrayContaining(['Ghee', 'Salt']));
    const by = Object.fromEntries(q.body.lines.filter((l: any) => l.component !== 'INGREDIENTS').map((l: any) => [l.component, l.amountPiastres]));
    expect(by).toMatchObject({ LABOR: 4000, PACKAGING: 300, INGREDIENT_TRIP: 2000, FINAL_TRIP: 2500 });
    expect(q.body.totalPiastres).toBe(4000 + 300 + 16500 + 3500 + 1200 + 5500 + 2000 + 2500);
    const pick = await quote({ offerId: s.offers['molokhia-eat'], servings: 4, source: 'SUPPLIERS', slotId: await firstSlot('molokhia-eat'), address: address(),
      supplierChoices: [{ ingredientId: chicken.ingredientId, productId: s.products.chicken }] });
    expect(pick.body.basket.find((b: any) => b.ingredientId === chicken.ingredientId).chosen.amountPiastres).toBe(18000);
  });

  it('refuses unserviceable areas and unavailable slots', async () => {
    const helio = await quote({ offerId: s.offers['molokhia-eat'], servings: 4, source: 'SUPPLIERS', slotId: await firstSlot('molokhia-eat'), address: { addressText: '1 Test St, Heliopolis', areaId: s.area.heliopolis } });
    expect([422, 409]).toContain(helio.status);
    const bad = await quote({ offerId: s.offers['molokhia-eat'], servings: 4, source: 'CHEF', slotId: '00000000-0000-4000-8000-000000000001', address: address() });
    expect(bad.body.error.code).toBe('SLOT_UNAVAILABLE');
  });

  let orderId: string;
  it('creates an order that holds kitchen capacity and shop stock; partners see nothing until it is paid', async () => {
    const q = await quote({ offerId: s.offers['molokhia-eat'], servings: 4, source: 'SUPPLIERS', slotId: await firstSlot('molokhia-eat'), address: address() });
    const o = await call(ctx, 'POST', '/v1/orders', { token: customer, body: { quoteId: q.body.id } });
    expect(o.status, o.raw).toBe(201);
    orderId = o.body.id;
    expect(o.body).toMatchObject({ fulfillmentState: 'RESERVED', fundingState: 'UNFUNDED', totalPiastres: q.body.totalPiastres });
    expect(o.body.allocations).toHaveLength(5); // chef, 2 shops, 2 delivery legs
    expect(o.body.payBy).not.toBeNull();
    expect((await call(ctx, 'POST', '/v1/orders', { token: customer, body: { quoteId: q.body.id } })).body.error.code).toBe('QUOTE_USED');
    const held = await ctx.pool.query(`SELECT sum(reserved_packs)::int n FROM inventory_balances`);
    expect(held.rows[0].n).toBeGreaterThan(0);
    expect((await call(ctx, 'GET', `/v1/chef/${s.chefs.A}/orders`, { token: chefA })).body.items).toEqual([]);
    expect((await call(ctx, 'GET', `/v1/supplier/branches/${s.branchId}/suborders`, { token: shop1 })).body.items).toEqual([]);
    expect((await call(ctx, 'GET', `/v1/orders/${orderId}`, { token: other })).status).toBe(404);
  });

  it('split payment: one recipient declines, the order is partially funded, retry charges only that recipient', async () => {
    const start = await call(ctx, 'POST', `/v1/orders/${orderId}/payments`, { token: customer, body: {} });
    expect(start.body.attempts).toHaveLength(5);
    const shop2Attempt = start.body.attempts.find((a: any) => a.recipientName.startsWith('Sample Corner'));
    await call(ctx, 'POST', `/v1/sandbox/payments/${start.body.sessionId}/complete`, { token: customer, body: { outcome: 'DECLINE', attemptId: shop2Attempt.attemptId } });
    await call(ctx, 'POST', `/v1/sandbox/payments/${start.body.sessionId}/complete`, { token: customer, body: { outcome: 'SUCCEED' } });
    let o = (await call(ctx, 'GET', `/v1/orders/${orderId}`, { token: customer })).body;
    expect(o.fundingState).toBe('PARTIALLY_FUNDED');
    expect(o.allocations.filter((a: any) => a.state === 'FAILED')).toHaveLength(1);
    const retry = await call(ctx, 'POST', `/v1/orders/${orderId}/payments`, { token: customer, body: {} });
    const pendingNow = retry.body.attempts.filter((a: any) => a.state === 'PENDING');
    expect(pendingNow).toHaveLength(1);
    await call(ctx, 'POST', `/v1/sandbox/payments/${retry.body.sessionId}/complete`, { token: customer, body: { outcome: 'SUCCEED' } });
    o = (await call(ctx, 'GET', `/v1/orders/${orderId}`, { token: customer })).body;
    expect(o.fundingState).toBe('FUNDED');
    expect(o.allocations.every((a: any) => a.state === 'PAID')).toBe(true);
    const charged = await ctx.pool.query(`SELECT count(*)::int n FROM payment_attempts WHERE order_id = $1 AND state = 'SUCCEEDED'`, [orderId]);
    expect(charged.rows[0].n).toBe(5);
    expect(await ledgerBalanced()).toBe(true);
  });

  it('webhooks: forged signatures are refused and replays change nothing', async () => {
    const ev = (await ctx.pool.query(`SELECT payload FROM provider_events ORDER BY received_at LIMIT 1`)).rows[0].payload;
    const raw = JSON.stringify(ev);
    const forged = await ctx.app.inject({ method: 'POST', url: '/v1/webhooks/payments/simulator', headers: { 'content-type': 'application/json', 'x-simulator-signature': '0'.repeat(64) }, payload: raw });
    expect(forged.statusCode).toBe(401);
    const before = (await ctx.pool.query(`SELECT count(*)::int n FROM ledger_entries`)).rows[0].n;
    const replay = await ctx.app.inject({ method: 'POST', url: '/v1/webhooks/payments/simulator', headers: { 'content-type': 'application/json', 'x-simulator-signature': signWebhook(deps().webhookSecret, raw) }, payload: raw });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().duplicate).toBe(true);
    expect((await ctx.pool.query(`SELECT count(*)::int n FROM ledger_entries`)).rows[0].n).toBe(before);
  });

  let chefOrder: any;
  it('chef and both shops confirm; the ingredient run opens for couriers', async () => {
    chefOrder = (await call(ctx, 'GET', `/v1/chef/${s.chefs.A}/orders`, { token: chefA })).body.items[0];
    expect(chefOrder).toMatchObject({ id: orderId, chefAcceptance: 'PENDING', fundingState: 'FUNDED', chefEarningsPiastres: 4300 });
    expect((await call(ctx, 'GET', `/v1/chef/${s.chefs.A}/orders`, { token: chefB })).status).toBe(404);
    const acc = await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/orders/${orderId}/respond`, { token: chefA, body: { accept: true, expectedVersion: chefOrder.version } });
    expect(acc.status, acc.raw).toBe(200);
    for (const [tok, branch] of [[shop1, s.branchId], [shop2, s.branch2Id]] as const) {
      const sub = (await call(ctx, 'GET', `/v1/supplier/branches/${branch}/suborders`, { token: tok })).body.items[0];
      expect(sub.funded).toBe(true);
      const r = await call(ctx, 'POST', `/v1/supplier/branches/${branch}/suborders/${sub.id}/respond`, { token: tok, body: { confirm: true, expectedVersion: sub.version } });
      expect(r.status, r.raw).toBe(200);
      expect(r.body.pickupCode).toMatch(/^\d{6}$/);
    }
    const o = (await call(ctx, 'GET', `/v1/orders/${orderId}`, { token: customer })).body;
    expect(o.fulfillmentState).toBe('AWAITING_INGREDIENTS');
    expect(o.legs.find((l: any) => l.kind === 'INGREDIENT_TO_CHEF').state).toBe('OPEN');
  });

  it('courier collects from both shops with their codes and hands over to the chef; delivery is not acceptance', async () => {
    const jobs = (await call(ctx, 'GET', '/v1/courier/jobs', { token: courier })).body.items;
    const leg = jobs.find((j: any) => j.kind === 'INGREDIENT_TO_CHEF');
    expect(leg.stops).toHaveLength(2);
    expect(leg.stops.every((st: any) => st.addressText === null)).toBe(true); // hidden until claimed
    expect(leg.dropoff.addressText).toBeNull();
    let l = (await call(ctx, 'POST', `/v1/courier/legs/${leg.legId}/claim`, { token: courier, body: { expectedVersion: leg.version } })).body;
    expect(l.state).toBe('ASSIGNED');
    expect(l.stops[0].addressText).toMatch(/PRIVATE/);
    const wrong = await call(ctx, 'POST', `/v1/courier/legs/${leg.legId}/stops/${l.stops[0].stopId}/collect`, { token: courier, body: { code: '000000', expectedVersion: l.version } });
    expect(wrong.status).toBe(422);
    expect(wrong.body.error.details.attemptsLeft).toBe(4);
    for (const st of l.stops) {
      const branch = st.partyName.startsWith('Sample Grocer') ? s.branchId : s.branch2Id;
      const tok = branch === s.branchId ? shop1 : shop2;
      const code = (await call(ctx, 'GET', `/v1/supplier/branches/${branch}/suborders`, { token: tok })).body.items[0].pickupCode;
      const r = await call(ctx, 'POST', `/v1/courier/legs/${leg.legId}/stops/${st.stopId}/collect`, { token: courier, body: { code, expectedVersion: l.version } });
      expect(r.status, r.raw).toBe(200);
      l = r.body;
    }
    expect(l.state).toBe('PICKED_UP');
    const stock = await ctx.pool.query(`SELECT on_hand_packs, reserved_packs FROM inventory_balances WHERE product_id = $1`, [s.products.chicken2]);
    expect(stock.rows[0]).toEqual({ on_hand_packs: 9, reserved_packs: 0 });
    chefOrder = (await call(ctx, 'GET', `/v1/chef/${s.chefs.A}/orders`, { token: chefA })).body.items[0];
    const del = await call(ctx, 'POST', `/v1/courier/legs/${leg.legId}/deliver`, { token: courier, body: { code: chefOrder.ingredientDropoffCode, expectedVersion: l.version } });
    expect(del.status, del.raw).toBe(200);
    const o = (await call(ctx, 'GET', `/v1/orders/${orderId}`, { token: customer })).body;
    expect(o.fulfillmentState).toBe('AWAITING_INGREDIENTS');
  });

  it('the chef must check ingredients before cooking; then prepares and marks ready', async () => {
    chefOrder = (await call(ctx, 'GET', `/v1/chef/${s.chefs.A}/orders`, { token: chefA })).body.items[0];
    const early = await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/orders/${orderId}/start`, { token: chefA, body: { expectedVersion: chefOrder.version } });
    expect(early.status).toBe(422);
    const lines = chefOrder.ingredients.filter((i: any) => !i.isPantry).map((i: any) => ({ ingredientId: i.ingredientId, ok: true }));
    let r = await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/orders/${orderId}/ingredients`, { token: chefA, body: { accepted: true, lines, expectedVersion: chefOrder.version } });
    expect(r.status, r.raw).toBe(200);
    expect(r.body).toMatchObject({ fulfillmentState: 'READY_TO_PREPARE', ingredientsAccepted: true });
    r = await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/orders/${orderId}/start`, { token: chefA, body: { expectedVersion: r.body.version } });
    expect(r.body.fulfillmentState).toBe('PREPARING');
    r = await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/orders/${orderId}/ready`, { token: chefA, body: { expectedVersion: r.body.version } });
    expect(r.body.fulfillmentState).toBe('READY_FOR_PICKUP');
    expect(r.body.mealPickupCode).toMatch(/^\d{6}$/);
    chefOrder = r.body;
  });

  it('meal leg: collected with the chef code, delivered with the customer code', async () => {
    const leg = (await call(ctx, 'GET', '/v1/courier/jobs', { token: courier })).body.items.find((j: any) => j.kind === 'MEAL_TO_CUSTOMER' && j.state === 'OPEN');
    let l = (await call(ctx, 'POST', `/v1/courier/legs/${leg.legId}/claim`, { token: courier, body: { expectedVersion: leg.version } })).body;
    expect(l.dropoff.addressText).toBe('12 Road 9, Maadi (test)');
    l = (await call(ctx, 'POST', `/v1/courier/legs/${leg.legId}/stops/${l.stops[0].stopId}/collect`, { token: courier, body: { code: chefOrder.mealPickupCode, expectedVersion: l.version } })).body;
    let o = (await call(ctx, 'GET', `/v1/orders/${orderId}`, { token: customer })).body;
    expect(o.fulfillmentState).toBe('OUT_FOR_DELIVERY');
    expect(o.legs.find((x: any) => x.kind === 'MEAL_TO_CUSTOMER').courierName).toBe('Karim');
    const r = await call(ctx, 'POST', `/v1/courier/legs/${leg.legId}/deliver`, { token: courier, body: { code: o.dropoffCode, expectedVersion: l.version } });
    expect(r.status, r.raw).toBe(200);
    o = (await call(ctx, 'GET', `/v1/orders/${orderId}`, { token: customer })).body;
    expect(o.fulfillmentState).toBe('DELIVERED');
    expect(o.legs.every((x: any) => x.state === 'DELIVERED')).toBe(true);
    expect(o.events.map((e: any) => e.kind)).toEqual(expect.arrayContaining(['ORDER_PLACED', 'PAID', 'CONFIRMED', 'INGREDIENTS_DELIVERED', 'INGREDIENTS_ACCEPTED', 'PREPARING', 'DELIVERED']));
  });

  const newChefOrder = async () => {
    const q = await quote({ offerId: s.offers['koshari-eat'], servings: 2, source: 'CHEF', slotId: await firstSlot('koshari-eat'), address: address() });
    expect(q.status, q.raw).toBe(201);
    return (await call(ctx, 'POST', '/v1/orders', { token: customer, body: { quoteId: q.body.id } })).body.id as string;
  };

  it('a chef decline after payment cancels the order, releases capacity and refunds every recipient', async () => {
    const id = await newChefOrder();
    const slotBefore = (await ctx.pool.query(`SELECT s.reserved_work_units FROM capacity_reservations r JOIN chef_capacity_slots s ON s.id = r.slot_id WHERE r.order_id = $1`, [id])).rows[0].reserved_work_units;
    await pay(id, 'SUCCEED');
    const co = (await call(ctx, 'GET', `/v1/chef/${s.chefs.A}/orders`, { token: chefA })).body.items.find((x: any) => x.id === id);
    const r = await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/orders/${id}/respond`, { token: chefA, body: { accept: false, reason: 'Kitchen equipment broke', expectedVersion: co.version } });
    expect(r.status, r.raw).toBe(200);
    const o = (await call(ctx, 'GET', `/v1/orders/${id}`, { token: customer })).body;
    expect(o).toMatchObject({ fulfillmentState: 'CANCELLED', fundingState: 'COMPENSATED', cancelReason: 'CHEF_DECLINED' });
    expect(o.allocations.every((a: any) => a.state === 'REFUNDED')).toBe(true);
    expect(o.dropoffCode).toBeNull();
    const slotAfter = (await ctx.pool.query(`SELECT s.reserved_work_units FROM capacity_reservations r JOIN chef_capacity_slots s ON s.id = r.slot_id WHERE r.order_id = $1`, [id])).rows[0].reserved_work_units;
    expect(slotAfter).toBeLessThan(slotBefore);
    expect(await ledgerBalanced()).toBe(true);
  });

  it('timeouts are reconciled, never retried blindly; unpaid orders expire and release their holds', async () => {
    const id = await newChefOrder();
    await pay(id, 'TIMEOUT');
    expect((await call(ctx, 'POST', `/v1/orders/${id}/payments`, { token: customer, body: {} })).body.error.code).toBe('PAYMENT_RECONCILING');
    const later = new Date(Date.now() + 31 * 60_000);
    const sum1 = await sweep(ctx.pool, deps(), 'test-sweep', later);
    expect(sum1.reconciled).toBeGreaterThanOrEqual(1);
    const sum2 = await sweep(ctx.pool, deps(), 'test-sweep', later);
    expect(sum1.unpaidCancelled + sum2.unpaidCancelled).toBeGreaterThanOrEqual(1);
    const o = (await call(ctx, 'GET', `/v1/orders/${id}`, { token: customer })).body;
    expect(o.fulfillmentState).toBe('CANCELLED');
    expect(o.cancelReason).toBe('PAYMENT_NOT_COMPLETED');
  });

  it('customers can cancel before the cook accepts; paid parts are refunded', async () => {
    const id = await newChefOrder();
    await pay(id, 'SUCCEED');
    const o0 = (await call(ctx, 'GET', `/v1/orders/${id}`, { token: customer })).body;
    const r = await call(ctx, 'POST', `/v1/orders/${id}/cancel`, { token: customer, body: { reason: 'Plans changed', expectedVersion: o0.version } });
    expect(r.status, r.raw).toBe(200);
    expect(r.body).toMatchObject({ fulfillmentState: 'CANCELLED', fundingState: 'COMPENSATED' });
  });

  it('wrong handoff codes lock after five attempts', async () => {
    const id = await newChefOrder();
    await pay(id, 'SUCCEED');
    let co = (await call(ctx, 'GET', `/v1/chef/${s.chefs.A}/orders`, { token: chefA })).body.items.find((x: any) => x.id === id);
    co = (await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/orders/${id}/respond`, { token: chefA, body: { accept: true, expectedVersion: co.version } })).body;
    co = (await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/orders/${id}/start`, { token: chefA, body: { expectedVersion: co.version } })).body;
    co = (await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/orders/${id}/ready`, { token: chefA, body: { expectedVersion: co.version } })).body;
    const leg = (await call(ctx, 'GET', '/v1/courier/jobs', { token: courier })).body.items.find((j: any) => j.state === 'OPEN' && j.kind === 'MEAL_TO_CUSTOMER');
    const l = (await call(ctx, 'POST', `/v1/courier/legs/${leg.legId}/claim`, { token: courier, body: { expectedVersion: leg.version } })).body;
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await call(ctx, 'POST', `/v1/courier/legs/${leg.legId}/stops/${l.stops[0].stopId}/collect`, { token: courier, body: { code: '999999', expectedVersion: l.version } })).status);
    }
    expect(statuses).toEqual([422, 422, 422, 422, 422, 423]);
    expect((await call(ctx, 'POST', `/v1/courier/legs/${leg.legId}/stops/${l.stops[0].stopId}/collect`, { token: courier, body: { code: co.mealPickupCode, expectedVersion: l.version } })).status).toBe(423);
  });

  it('non-couriers cannot see jobs; the sweep endpoint needs the cron secret', async () => {
    expect((await call(ctx, 'GET', '/v1/courier/jobs', { token: customer })).body.error.code).toBe('COURIER_NOT_APPROVED');
    expect((await call(ctx, 'GET', '/v1/internal/sweep')).status).toBe(404);
    const ok = await ctx.app.inject({ method: 'GET', url: '/v1/internal/sweep', headers: { authorization: 'Bearer test-cron-secret-0123456789' } });
    expect(ok.statusCode).toBe(200);
  });
});
