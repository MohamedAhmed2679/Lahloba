import { createHash } from 'node:crypto';
import type { DbClient, Queryable } from './db';
import { HttpError, conflict } from './errors';

/** Append-only audit record. Never pass secrets, evidence contents or exact addresses in metadata. */
export async function audit(
  db: Queryable,
  e: { actorUserId: string | null; action: string; targetType: string; targetId: string | null; reason?: string | null; metadata?: Record<string, unknown>; correlationId: string },
): Promise<void> {
  await db.query(
    `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, reason, metadata, correlation_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [e.actorUserId, e.action, e.targetType, e.targetId, e.reason ?? null, JSON.stringify(e.metadata ?? {}), e.correlationId],
  );
}

/** Transactional outbox write: must use the same client/transaction as the state change. */
export async function enqueueEvent(
  db: DbClient,
  e: { aggregateType: string; aggregateId: string; eventType: string; payload: Record<string, unknown>; correlationId: string; schemaVersion?: number },
): Promise<void> {
  await db.query(
    `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, schema_version, payload, correlation_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [e.aggregateType, e.aggregateId, e.eventType, e.schemaVersion ?? 1, JSON.stringify(e.payload), e.correlationId],
  );
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
}

export function requestHash(route: string, params: unknown, body: unknown): string {
  return createHash('sha256').update(stableStringify({ route, params, body })).digest('hex');
}

const KEY = /^[A-Za-z0-9_-]{8,128}$/;

export function requireIdempotencyKey(header: unknown): string {
  if (typeof header !== 'string' || !KEY.test(header)) {
    throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header (8-128 URL-safe characters) is required for this request');
  }
  return header;
}

/**
 * Durable idempotency inside the caller's transaction. The PK insert serializes concurrent
 * requests with the same (actor, route, key): the second waits for the first to commit, then
 * replays its stored response. A failed operation rolls back its record so a retry can proceed.
 */
export async function idempotent<T>(
  db: DbClient,
  scope: { actorUserId: string; route: string; key: string; hash: string },
  status: number,
  operation: () => Promise<T>,
): Promise<{ status: number; body: T; replayed: boolean }> {
  const inserted = await db.query(
    `INSERT INTO idempotency_records (actor_user_id, route, key, request_hash, status_code, response)
     VALUES ($1, $2, $3, $4, 0, 'null'::jsonb) ON CONFLICT DO NOTHING RETURNING key`,
    [scope.actorUserId, scope.route, scope.key, scope.hash],
  );
  if (inserted.rowCount === 0) {
    const existing = await db.query<{ request_hash: string; status_code: number; response: T }>(
      `SELECT request_hash, status_code, response FROM idempotency_records WHERE actor_user_id = $1 AND route = $2 AND key = $3`,
      [scope.actorUserId, scope.route, scope.key],
    );
    const row = existing.rows[0];
    if (!row) throw conflict('RETRY', 'Concurrent request; retry');
    if (row.request_hash !== scope.hash) throw conflict('IDEMPOTENCY_CONFLICT', 'Idempotency key was reused for a different request');
    return { status: row.status_code, body: row.response, replayed: true };
  }
  const body = await operation();
  await db.query(
    `UPDATE idempotency_records SET status_code = $4, response = $5 WHERE actor_user_id = $1 AND route = $2 AND key = $3`,
    [scope.actorUserId, scope.route, scope.key, status, JSON.stringify(body)],
  );
  return { status, body, replayed: false };
}
