import pg from 'pg';
import { loadServerConfig } from '@lahloba/config';
import { createHandlers } from './handlers';
import { processBatch } from './outbox';
import { sweep } from '@lahloba/api/sweep';

const config = loadServerConfig();
const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 4, application_name: 'lahloba-worker' });
const handlers = createHandlers();
let stopping = false;
const SWEEP_EVERY_MS = 30_000;
let lastSweep = 0;

const stop = async () => {
  stopping = true;
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

console.log(JSON.stringify({ msg: 'worker started', env: config.env, pollIntervalMs: config.worker.pollIntervalMs }));
while (!stopping) {
  try {
    const r = await processBatch(pool, handlers, { maxAttempts: config.worker.maxAttempts });
    if (r.processed || r.failed || r.dead) console.log(JSON.stringify({ msg: 'outbox batch', ...r }));
    if (r.dead) console.error(JSON.stringify({ msg: 'events dead-lettered; operations review required', dead: r.dead }));
  } catch (err) {
    console.error(JSON.stringify({ msg: 'outbox batch failed', error: (err as Error).message }));
  }
  // Expiries and partner deadlines (also exposed as /v1/internal/sweep for Vercel Cron).
  if (config.orders && config.payments.provider === 'simulator' && Date.now() - lastSweep >= SWEEP_EVERY_MS) {
    lastSweep = Date.now();
    try {
      const r = await sweep(pool, { handoffSecret: config.orders.handoffSecret, webhookSecret: config.payments.webhookSecret }, `worker-sweep-${lastSweep}`);
      if (Object.values(r).some((n) => n > 0)) console.log(JSON.stringify({ msg: 'sweep', ...r }));
    } catch (err) {
      console.error(JSON.stringify({ msg: 'sweep failed', error: (err as Error).message }));
    }
  }
  await new Promise((res) => setTimeout(res, config.worker.pollIntervalMs));
}
await pool.end();
