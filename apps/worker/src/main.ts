import pg from 'pg';
import { loadServerConfig } from '@lahloba/config';
import { createHandlers } from './handlers';
import { processBatch } from './outbox';

const config = loadServerConfig();
const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 4, application_name: 'lahloba-worker' });
const handlers = createHandlers();
let stopping = false;

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
  await new Promise((res) => setTimeout(res, config.worker.pollIntervalMs));
}
await pool.end();
