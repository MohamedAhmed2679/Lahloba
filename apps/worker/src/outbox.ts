import type pg from 'pg';

export interface OutboxEvent {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  schemaVersion: number;
  payload: Record<string, unknown>;
  correlationId: string;
  attempts: number;
}

/**
 * A handler returns an explicit outcome string that is stored on the event. Adapters that are
 * not connected must say so (e.g. "NOTIFICATION_ADAPTER_DISABLED") rather than claim delivery.
 * Throwing schedules a retry with backoff; after maxAttempts the event is dead-lettered.
 */
export type Handler = (e: OutboxEvent) => Promise<string>;

export interface WorkerOptions {
  maxAttempts: number;
  batchSize?: number;
  leaseSeconds?: number;
  /** Backoff in seconds for attempt n (1-based). Default: min(2^n, 900). */
  backoff?: (attempt: number) => number;
  now?: () => Date;
}

const defaultBackoff = (n: number) => Math.min(2 ** n, 900);

/**
 * Claims due events with FOR UPDATE SKIP LOCKED and a lease, so several worker processes can run
 * without double-processing. Handlers run outside the claim transaction (no network inside locks).
 */
export async function processBatch(pool: pg.Pool, handlers: Record<string, Handler>, opts: WorkerOptions): Promise<{ processed: number; failed: number; dead: number }> {
  const lease = opts.leaseSeconds ?? 60;
  const claim = await pool.query(
    `UPDATE outbox_events SET locked_until = now() + make_interval(secs => $2), attempts = attempts + 1
     WHERE id IN (
       SELECT id FROM outbox_events
       WHERE status = 'PENDING' AND next_attempt_at <= now() AND (locked_until IS NULL OR locked_until < now())
       ORDER BY next_attempt_at, created_at
       LIMIT $1 FOR UPDATE SKIP LOCKED)
     RETURNING id, aggregate_type, aggregate_id, event_type, schema_version, payload, correlation_id, attempts`,
    [opts.batchSize ?? 20, lease],
  );
  let processed = 0;
  let failed = 0;
  let dead = 0;
  for (const r of claim.rows) {
    const e: OutboxEvent = {
      id: r.id, aggregateType: r.aggregate_type, aggregateId: r.aggregate_id, eventType: r.event_type,
      schemaVersion: r.schema_version, payload: r.payload, correlationId: r.correlation_id, attempts: r.attempts,
    };
    const handler = handlers[e.eventType];
    try {
      if (!handler) throw new Error(`No handler registered for ${e.eventType}`);
      const outcome = await handler(e);
      await pool.query(
        `UPDATE outbox_events SET status = 'PROCESSED', processed_at = now(), outcome = $2, locked_until = NULL, last_error = NULL WHERE id = $1 AND status = 'PENDING'`,
        [e.id, outcome.slice(0, 200)],
      );
      processed++;
    } catch (err) {
      const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      if (e.attempts >= opts.maxAttempts) {
        await pool.query(`UPDATE outbox_events SET status = 'DEAD', last_error = $2, locked_until = NULL WHERE id = $1`, [e.id, message]);
        dead++;
      } else {
        const delay = (opts.backoff ?? defaultBackoff)(e.attempts);
        await pool.query(
          `UPDATE outbox_events SET last_error = $2, locked_until = NULL, next_attempt_at = now() + make_interval(secs => $3) WHERE id = $1`,
          [e.id, message, delay],
        );
        failed++;
      }
    }
  }
  return { processed, failed, dead };
}
