import pg from 'pg';
import { loadServerConfig } from '@lahloba/config';
import { seedIllustrative } from '../seed/illustrative';

const config = loadServerConfig();
if (config.env !== 'development' && config.env !== 'test') {
  console.error('Refusing to load illustrative data outside development/test.');
  process.exit(1);
}
const client = new pg.Client({ connectionString: config.databaseUrl });
await client.connect();
try {
  const existing = await client.query('SELECT count(*)::int AS n FROM facets');
  if (existing.rows[0].n > 0) {
    console.log('Catalog already has data; seed skipped (drop and re-migrate a disposable database to reseed).');
  } else {
    await client.query('BEGIN');
    const r = await seedIllustrative(client as unknown as pg.PoolClient);
    await client.query('COMMIT');
    console.log('Loaded ILLUSTRATIVE development data (fictional partners, invented prices).');
    console.log(`Sample chef A id: ${r.chefs.A}`);
    console.log('Dev sign-in subjects: sample-chef-a, sample-chef-b, sample-supplier, sample-ops-reviewer');
  }
} catch (e) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw e;
} finally {
  await client.end();
}
