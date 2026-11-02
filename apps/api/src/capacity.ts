import type { Queryable } from './db';
import { conflict } from './errors';

/**
 * Kitchen capacity holds (H04). The slot row is the single point of truth: a conditional UPDATE
 * (reserved + units <= total) is atomic under concurrency, so the last unit can only be won once.
 * Releases are idempotent: only ACTIVE/CONFIRMED holds give units back, exactly once.
 */
export function workUnits(v: { base_work_units: number; work_units_per_serving: number }, servings: number): number {
  return v.base_work_units + v.work_units_per_serving * servings;
}

export async function reserveCapacity(
  db: Queryable,
  p: { slotId: string; chefId: string; units: number; ttlMinutes: number; orderId: string | null; notBefore: Date },
): Promise<string> {
  const upd = await db.query(
    `UPDATE chef_capacity_slots SET reserved_work_units = reserved_work_units + $3, version = version + 1
     WHERE id = $1 AND chef_id = $2 AND status = 'ACTIVE' AND starts_at >= $4 AND reserved_work_units + $3 <= total_work_units
     RETURNING id`,
    [p.slotId, p.chefId, p.units, p.notBefore],
  );
  if (!upd.rowCount) throw conflict('CAPACITY_UNAVAILABLE', 'This time slot no longer has room for that many servings. Choose another slot or fewer servings.');
  const r = await db.query<{ id: string }>(
    `INSERT INTO capacity_reservations (slot_id, order_id, work_units, state, expires_at)
     VALUES ($1, $2, $3, 'ACTIVE', now() + make_interval(mins => $4)) RETURNING id`,
    [p.slotId, p.orderId, p.units, p.ttlMinutes],
  );
  return r.rows[0]!.id;
}

/** Returns units to the slot. Safe to call repeatedly or concurrently. */
export async function releaseCapacity(db: Queryable, reservationId: string, to: 'RELEASED' | 'EXPIRED'): Promise<boolean> {
  const r = await db.query<{ slot_id: string; work_units: number }>(
    `UPDATE capacity_reservations SET state = $2, expires_at = NULL WHERE id = $1 AND state IN ('ACTIVE','CONFIRMED') RETURNING slot_id, work_units`,
    [reservationId, to],
  );
  const row = r.rows[0];
  if (!row) return false;
  await db.query(`UPDATE chef_capacity_slots SET reserved_work_units = reserved_work_units - $2, version = version + 1 WHERE id = $1`, [row.slot_id, row.work_units]);
  return true;
}

export async function confirmCapacity(db: Queryable, orderId: string): Promise<boolean> {
  const r = await db.query(`UPDATE capacity_reservations SET state = 'CONFIRMED', expires_at = NULL WHERE order_id = $1 AND state = 'ACTIVE'`, [orderId]);
  return (r.rowCount ?? 0) > 0;
}

export async function consumeCapacity(db: Queryable, orderId: string): Promise<boolean> {
  const r = await db.query(`UPDATE capacity_reservations SET state = 'CONSUMED' WHERE order_id = $1 AND state = 'CONFIRMED'`, [orderId]);
  return (r.rowCount ?? 0) > 0;
}

export async function hasConfirmedCapacity(db: Queryable, orderId: string): Promise<boolean> {
  const r = await db.query(`SELECT 1 FROM capacity_reservations WHERE order_id = $1 AND state IN ('CONFIRMED','CONSUMED')`, [orderId]);
  return (r.rowCount ?? 0) > 0;
}
