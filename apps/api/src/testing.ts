import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import type { ServerConfig } from '@lahloba/config';
import { buildApp } from './app';
import { createPool, withTx } from './db';
import { DevStubIdentityProvider } from './identity/provider';
import { migrateUp } from './migrator';
import { seedIllustrative, type SeedResult } from './seed/illustrative';
import { createEvidenceStorage } from './storage/evidence';

/**
 * Disposable-database harness. Each call creates a uniquely named database, applies all
 * migrations, loads illustrative data and returns an in-process API. Requires
 * TEST_DATABASE_ADMIN_URL (a role allowed to CREATE/DROP DATABASE on a throwaway server).
 */
export const TEST_DB_ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL;

export async function createDisposableDatabase() {
  if (!TEST_DB_ADMIN_URL) throw new Error('TEST_DATABASE_ADMIN_URL is not set');
  const name = `lahloba_test_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const admin = new pg.Client({ connectionString: TEST_DB_ADMIN_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const url = new URL(TEST_DB_ADMIN_URL);
  url.pathname = `/${name}`;
  return {
    name,
    url: url.toString(),
    async drop() {
      const a = new pg.Client({ connectionString: TEST_DB_ADMIN_URL });
      await a.connect();
      await a.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await a.end();
    },
  };
}

export async function createTestContext(opts: { seed?: boolean; evidence?: ServerConfig['evidenceStorage']; rateLimitScale?: number } = {}) {
  const db = await createDisposableDatabase();
  const pool = createPool(db.url, 20);
  const c = await pool.connect();
  try { await migrateUp(c); } finally { c.release(); }
  const seed: SeedResult | null = opts.seed === false ? null : await withTx(pool, (tx) => seedIllustrative(tx));
  const secret = 'test-only-secret-'.padEnd(40, 'x');
  const config: ServerConfig = {
    env: 'test', databaseUrl: db.url, apiHost: '127.0.0.1', apiPort: 0, corsOrigins: [],
    identity: { kind: 'dev-stub', signingSecret: secret }, evidenceStorage: opts.evidence ?? 'local-disk',
    storage: { localDir: join(tmpdir(), `lahloba-evidence-${db.name}`), signingSecret: 'test-storage-secret-'.padEnd(40, 'y') },
    payments: { provider: 'simulator', webhookSecret: 'test-payments-secret-'.padEnd(40, 'z') },
    orders: { handoffSecret: 'test-handoff-secret-'.padEnd(40, 'h') },
    cronSecret: 'test-cron-secret-0123456789',
    publicApiUrl: null,
    worker: { pollIntervalMs: 100, maxAttempts: 3 },
  };
  const identity = new DevStubIdentityProvider(secret);
  const app = await buildApp({ config, pool, identity, evidence: createEvidenceStorage(config.evidenceStorage, { localDir: config.storage.localDir ?? undefined }), rateLimitScale: opts.rateLimitScale ?? 100 });
  await app.ready();
  let n = 0;
  return {
    app, pool, seed, identity, dbUrl: db.url,
    token: (subject: string, name?: string) => identity.issue(subject.replace(/^dev:/, ''), name),
    key: () => `test-key-${Date.now()}-${n++}-${randomUUID().slice(0, 8)}`,
    async close() {
      await app.close();
      await pool.end();
      await db.drop();
    },
  };
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>;
