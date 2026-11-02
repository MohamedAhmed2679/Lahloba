import pg from 'pg';
import { loadServerConfig } from '@lahloba/config';
import { loadMigrations, migrateDown, migrateUp } from '../migrator';

const [cmd = 'status', stepsArg] = process.argv.slice(2);
const config = loadServerConfig();
const client = new pg.Client({ connectionString: config.databaseUrl });
await client.connect();
try {
  if (cmd === 'up') {
    const done = await migrateUp(client);
    console.log(done.length ? `Applied: ${done.join(', ')}` : 'Database is up to date');
  } else if (cmd === 'down') {
    if (config.env === 'production' || config.env === 'staging') {
      throw new Error('Refusing automated rollback in staging/production. Follow the reviewed recovery runbook.');
    }
    const done = await migrateDown(client, Number(stepsArg ?? 1));
    console.log(done.length ? `Rolled back: ${done.join(', ')}` : 'Nothing to roll back');
  } else {
    const applied = new Set((await client.query('SELECT id FROM schema_migrations').catch(() => ({ rows: [] as Array<{ id: string }> }))).rows.map((r) => r.id));
    for (const m of loadMigrations()) console.log(`${applied.has(m.id) ? 'applied ' : 'pending '} ${m.id}`);
  }
} finally {
  await client.end();
}
