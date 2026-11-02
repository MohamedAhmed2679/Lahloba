import pg from 'pg';
import { loadServerConfig } from '@lahloba/config';

/**
 * STAGING/DEVELOPMENT: grants OPS_VERIFIER to a signed-in Clerk user (subject "clerk:user_..."),
 * attributed to the seed system user and audited. Refused in production, where operations roles
 * need the reviewed two-person procedure in docs/IMPLEMENTATION_STATUS.md.
 * Usage: DATABASE_URL=... LAHLOBA_ENV=staging pnpm --filter @lahloba/api ops:grant clerk:user_123
 */
const config = loadServerConfig();
if (config.env === 'production') { console.error('Refusing in production.'); process.exit(1); }
const subject = process.argv[2] ?? '';
if (!/^(clerk|dev):[A-Za-z0-9._-]{3,80}$/.test(subject)) { console.error('Provide a subject like clerk:user_2abc...'); process.exit(1); }
const client = new pg.Client({ connectionString: config.databaseUrl });
await client.connect();
try {
  const sys = await client.query(`SELECT id FROM app_users WHERE identity_subject = 'dev:seed-system'`);
  const u = await client.query(`SELECT id FROM app_users WHERE identity_subject = $1`, [subject]);
  if (!sys.rowCount || !u.rowCount) throw new Error('Seed data missing, or this user has not signed in yet.');
  await client.query('BEGIN');
  await client.query(`INSERT INTO role_memberships (user_id, role, scope_type, approval_state, granted_by) VALUES ($1, 'OPS_VERIFIER', 'GLOBAL', 'APPROVED', $2) ON CONFLICT DO NOTHING`, [u.rows[0].id, sys.rows[0].id]);
  await client.query(`INSERT INTO audit_events (actor_user_id, action, target_type, target_id, reason, metadata, correlation_id) VALUES ($1, 'OPS_ROLE_GRANTED', 'app_user', $2, 'staging grant via CLI', '{}', 'cli-ops-grant')`, [sys.rows[0].id, u.rows[0].id]);
  await client.query('COMMIT');
  console.log(`Granted OPS_VERIFIER to ${subject}.`);
} catch (e) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw e;
} finally {
  await client.end();
}
