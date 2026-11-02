import pg from 'pg';
import { loadServerConfig } from '@lahloba/config';

/**
 * DEVELOPMENT/TEST ONLY: grant OPS_VERIFIER to a dev-stub subject, attributed to the seed system
 * user. Production operations roles must be provisioned through a reviewed, audited procedure
 * with a second approver (see docs/IMPLEMENTATION_STATUS.md).
 * Usage: pnpm --filter @lahloba/api ops:grant:dev <subject>
 */
const config = loadServerConfig();
if (config.env !== 'development' && config.env !== 'test') {
  console.error('Refusing outside development/test.');
  process.exit(1);
}
const subject = process.argv[2];
if (!subject || !/^[a-z0-9._-]{3,64}$/.test(subject)) {
  console.error('Provide a dev subject (e.g. my-reviewer).');
  process.exit(1);
}
const client = new pg.Client({ connectionString: config.databaseUrl });
await client.connect();
try {
  const sys = await client.query(`SELECT id FROM app_users WHERE identity_subject = 'dev:seed-system'`);
  const u = await client.query(`SELECT id FROM app_users WHERE identity_subject = $1`, [`dev:${subject}`]);
  if (!sys.rowCount || !u.rowCount) throw new Error('Seed data missing or the subject has not signed in yet.');
  await client.query(
    `INSERT INTO role_memberships (user_id, role, scope_type, approval_state, granted_by) VALUES ($1, 'OPS_VERIFIER', 'GLOBAL', 'APPROVED', $2) ON CONFLICT DO NOTHING`,
    [u.rows[0].id, sys.rows[0].id],
  );
  await client.query(
    `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, reason, correlation_id) VALUES ($1, 'OPS_ROLE_GRANTED_DEV', 'app_user', $2, 'dev CLI grant', 'cli')`,
    [sys.rows[0].id, u.rows[0].id],
  );
  console.log(`Granted OPS_VERIFIER to dev:${subject} (development only).`);
} finally {
  await client.end();
}
