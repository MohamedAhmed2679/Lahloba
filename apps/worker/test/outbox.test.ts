import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DB_ADMIN_URL, createDisposableDatabase } from '@lahloba/api/testing';
import { createHandlers } from '../src/handlers';
import { processBatch } from '../src/outbox';

describe.skipIf(!TEST_DB_ADMIN_URL)('transactional outbox worker', () => {
  let db: Awaited<ReturnType<typeof createDisposableDatabase>>;
  let pool: pg.Pool;
  beforeAll(async () => {
    db = await createDisposableDatabase();
    pool = new pg.Pool({ connectionString: db.url, max: 6 });
    const { migrateUp } = await import('@lahloba/api/migrator');
    const c = await pool.connect();
    try { await migrateUp(c); } finally { c.release(); }
  });
  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });
  beforeEach(async () => {
    await pool.query('DELETE FROM outbox_events');
  });

  const enqueue = async (eventType: string, n = 1) => {
    for (let i = 0; i < n; i++) {
      await pool.query(
        `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, correlation_id) VALUES ('t', gen_random_uuid(), $1, '{}', 'test')`,
        [eventType],
      );
    }
  };

  it('records an explicit "adapter disabled" outcome rather than pretending delivery', async () => {
    await enqueue('PartnerApplicationSubmitted');
    const r = await processBatch(pool, createHandlers(), { maxAttempts: 3 });
    expect(r).toEqual({ processed: 1, failed: 0, dead: 0 });
    const row = (await pool.query(`SELECT status, outcome, attempts FROM outbox_events`)).rows[0];
    expect(row).toEqual({ status: 'PROCESSED', outcome: 'NOTIFICATION_ADAPTER_DISABLED', attempts: 1 });
  });

  it('retries with backoff and dead-letters after max attempts', async () => {
    await enqueue('UnknownEvent');
    const opts = { maxAttempts: 2, backoff: () => 0 };
    expect(await processBatch(pool, createHandlers(), opts)).toEqual({ processed: 0, failed: 1, dead: 0 });
    expect(await processBatch(pool, createHandlers(), opts)).toEqual({ processed: 0, failed: 0, dead: 1 });
    const row = (await pool.query(`SELECT status, attempts, last_error FROM outbox_events`)).rows[0];
    expect(row.status).toBe('DEAD');
    expect(row.attempts).toBe(2);
    expect(row.last_error).toMatch(/No handler/);
    expect(await processBatch(pool, createHandlers(), opts)).toEqual({ processed: 0, failed: 0, dead: 0 });
  });

  it('respects backoff: a failed event is not retried before next_attempt_at', async () => {
    await enqueue('UnknownEvent');
    await processBatch(pool, createHandlers(), { maxAttempts: 5, backoff: () => 600 });
    expect(await processBatch(pool, createHandlers(), { maxAttempts: 5 })).toEqual({ processed: 0, failed: 0, dead: 0 });
  });

  it('concurrent workers never process the same event twice', async () => {
    await enqueue('DishPublished', 40);
    let calls = 0;
    const handlers = { DishPublished: async () => { calls++; await new Promise((r) => setTimeout(r, 2)); return 'OK'; } };
    const results = await Promise.all([1, 2, 3, 4].map(() => processBatch(pool, handlers, { maxAttempts: 3, batchSize: 15 })));
    const total = results.reduce((a, r) => a + r.processed, 0);
    expect(calls).toBe(total);
    let remaining = 40 - total;
    while (remaining > 0) remaining -= (await processBatch(pool, handlers, { maxAttempts: 3 })).processed;
    expect(calls).toBe(40);
    const stats = (await pool.query(`SELECT count(*) FILTER (WHERE status = 'PROCESSED')::int AS done, max(attempts) AS max_attempts FROM outbox_events`)).rows[0];
    expect(stats).toEqual({ done: 40, max_attempts: 1 });
  });
});
