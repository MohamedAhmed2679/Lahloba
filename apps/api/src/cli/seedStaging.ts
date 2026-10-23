import pg from 'pg';
import { loadServerConfig } from '@lahloba/config';
import { seedIllustrative } from '../seed/illustrative';

/**
 * Staging demo data: the same clearly labelled ILLUSTRATIVE catalog as development (fictional
 * partners named "(sample)", invented prices). Runs during the Vercel build only when
 * LAHLOBA_SEED_ILLUSTRATIVE=true, never in production, and only into an empty catalog.
 */
const config = loadServerConfig();
if (process.env.LAHLOBA_SEED_ILLUSTRATIVE !== 'true') { console.log('Illustrative seed not requested; skipped.'); process.exit(0); }
if (config.env === 'production') { console.error('Refusing to load illustrative data in production.'); process.exit(1); }
const client = new pg.Client({ connectionString: config.databaseUrl });
await client.connect();
try {
  const existing = await client.query('SELECT count(*)::int AS n FROM facets');
  if (existing.rows[0].n > 0) console.log('Catalog already has data; seed skipped.');
  else {
    await client.query('BEGIN');
    await seedIllustrative(client as unknown as pg.PoolClient);
    await client.query('COMMIT');
    console.log('Loaded ILLUSTRATIVE staging data (fictional partners, invented prices).');
  }
} catch (e) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw e;
} finally {
  await client.end();
}
