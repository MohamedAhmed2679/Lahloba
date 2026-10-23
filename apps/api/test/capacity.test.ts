import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { releaseCapacity, reserveCapacity } from '../src/capacity';
import { withTx } from '../src/db';
import { TEST_DB_ADMIN_URL, createTestContext, type TestContext } from '../src/testing';
import { call } from './helpers';

describe.skipIf(!TEST_DB_ADMIN_URL)('kitchen capacity (H04)', () => {
  let ctx: TestContext;
  let s: NonNullable<TestContext['seed']>;
  let chefA: string;
  beforeAll(async () => {
    ctx = await createTestContext();
    s = ctx.seed!;
    chefA = await ctx.token('sample-chef-a');
  });
  afterAll(async () => ctx?.close());

  const newSlot = async (hoursFromNow: number, units: number) => {
    const start = new Date(Date.now() + hoursFromNow * 3600_000);
    const end = new Date(start.getTime() + 3600_000);
    const r = await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/capacity-slots`, { token: chefA, body: { startsAt: start.toISOString(), endsAt: end.toISOString(), totalWorkUnits: units } });
    return r;
  };

  it('offer detail lists bookable slots with the servings they can still take', async () => {
    const r = await call(ctx, 'GET', `/v1/offers/${s.offers['molokhia-eat']}`);
    expect(r.body.availability).toBe('AVAILABLE');
    expect(r.body.slots.length).toBeGreaterThan(0);
    // 40 units, base 2 + 2 per serving -> 19 servings, capped by the variant max (8).
    expect(r.body.slots[0].maxServings).toBe(8);
  });

  it('chefs manage their own slots; overlaps and slots in the past are refused', async () => {
    const created = await newSlot(24 * 9, 10); // outside the seeded week, no overlap
    expect(created.status).toBe(201);
    expect((await newSlot(24 * 9 + 0.5, 10)).body.error.code).toBe('SLOT_OVERLAP');
    expect((await newSlot(-2, 10)).body.error.code).toBe('SLOT_IN_PAST');
    const other = await ctx.token('sample-chef-b');
    expect((await call(ctx, 'GET', `/v1/chef/${s.chefs.A}/capacity-slots`, { token: other })).status).toBe(404);
  });

  it('the last unit can only be reserved once under concurrency; releases are idempotent', async () => {
    const created = await newSlot(24 * 10, 6);
    const slotId = created.body.id;
    const attempt = () => withTx(ctx.pool, (db) => reserveCapacity(db, { slotId, chefId: s.chefs.A!, units: 6, ttlMinutes: 15, orderId: null, notBefore: new Date() }))
      .then((id) => ({ ok: true as const, id }), (e) => ({ ok: false as const, code: (e as { code?: string }).code }));
    const results = await Promise.all([attempt(), attempt(), attempt(), attempt()]);
    const winners = results.filter((r) => r.ok);
    expect(winners).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.code === 'CAPACITY_UNAVAILABLE')).toBe(true);
    const id = (winners[0] as { id: string }).id;
    expect(await withTx(ctx.pool, (db) => releaseCapacity(db, id, 'EXPIRED'))).toBe(true);
    expect(await withTx(ctx.pool, (db) => releaseCapacity(db, id, 'RELEASED'))).toBe(false);
    const slot = (await ctx.pool.query(`SELECT reserved_work_units FROM chef_capacity_slots WHERE id = $1`, [slotId])).rows[0];
    expect(slot.reserved_work_units).toBe(0);
    // A slot with bookings cannot be cancelled silently.
    await withTx(ctx.pool, (db) => reserveCapacity(db, { slotId, chefId: s.chefs.A!, units: 2, ttlMinutes: 15, orderId: null, notBefore: new Date() }));
    const cancel = await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/capacity-slots/${slotId}/cancel`, { token: chefA, body: { expectedVersion: 4 } });
    expect(cancel.body.error.code).toBe('SLOT_HAS_BOOKINGS');
  });

  it('a fully booked kitchen disappears from discovery and shows FULLY_BOOKED on the dish', async () => {
    const before = await call(ctx, 'GET', `/v1/catalog/offers?area=${s.area.maadi}&mode=EAT_NOW`);
    expect(before.body.items.length).toBe(3);
    await ctx.pool.query(`UPDATE chef_capacity_slots SET reserved_work_units = total_work_units WHERE chef_id = $1`, [s.chefs.A]);
    const after = await call(ctx, 'GET', `/v1/catalog/offers?area=${s.area.maadi}&mode=EAT_NOW`);
    expect(after.body.items).toEqual([]);
    const detail = await call(ctx, 'GET', `/v1/offers/${s.offers['molokhia-eat']}`);
    expect(detail.body.availability).toBe('FULLY_BOOKED');
    expect(detail.body.slots).toEqual([]);
    await ctx.pool.query(`UPDATE chef_capacity_slots SET reserved_work_units = 0 WHERE chef_id = $1`, [s.chefs.A]);
  });
});
