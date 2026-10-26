import pg from 'pg';
import { loadServerConfig } from '@lahloba/config';
import { seedIllustrative } from '../seed/illustrative';

/**
 * Staging demo data: the same clearly labelled ILLUSTRATIVE catalog as development (fictional
 * partners named "(sample)", invented prices). Runs during the Vercel build only when
 * LAHLOBA_SEED_ILLUSTRATIVE=true, never in production, and only into an empty catalog.
 *
 * LAHLOBA_STAGING_DEMO_SUBJECTS (comma-separated "clerk:user_..." subjects) links real staging
 * sign-ins to the ILLUSTRATIVE partners so one tester can walk the whole order: operations
 * verifier, owner of the sample kitchens and sample shops, and the sample courier profile.
 * Only rows marked is_illustrative are touched; every link is audited; idempotent.
 */
const config = loadServerConfig();
if (process.env.LAHLOBA_SEED_ILLUSTRATIVE !== 'true') { console.log('Illustrative seed not requested; skipped.'); process.exit(0); }
if (config.env === 'production') { console.error('Refusing to load illustrative data in production.'); process.exit(1); }
const subjects = (process.env.LAHLOBA_STAGING_DEMO_SUBJECTS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
for (const s of subjects) if (!/^clerk:user_[A-Za-z0-9]{8,64}$/.test(s)) { console.error(`Not a Clerk subject: ${s}`); process.exit(1); }

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

  if (subjects.length) {
    const sys = (await client.query(`SELECT id FROM app_users WHERE identity_subject = 'dev:seed-system'`)).rows[0]?.id as string | undefined;
    if (!sys) throw new Error('Seed system user missing.');
    for (const subject of subjects) {
      const u = (await client.query(`SELECT id FROM app_users WHERE identity_subject = $1`, [subject])).rows[0]?.id as string | undefined;
      if (!u) { console.log(`${subject} has not signed in yet; demo links skipped.`); continue; }
      await client.query('BEGIN');
      const grant = async (role: string, scopeType: string, scopeId: string | null) => {
        const has = await client.query(
          `SELECT 1 FROM role_memberships WHERE user_id = $1 AND role = $2 AND scope_type = $3 AND scope_id IS NOT DISTINCT FROM $4`,
          [u, role, scopeType, scopeId]);
        if (has.rowCount) return;
        await client.query(`INSERT INTO role_memberships (user_id, role, scope_type, scope_id, approval_state, granted_by) VALUES ($1, $2, $3, $4, 'APPROVED', $5)`, [u, role, scopeType, scopeId, sys]);
        await client.query(
          `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, reason, metadata, correlation_id) VALUES ($1, 'STAGING_DEMO_ROLE_LINKED', 'app_user', $2, 'staging demo link to illustrative partner', $3, 'staging-demo-link')`,
          [sys, u, JSON.stringify({ role, scopeType, scopeId })]);
      };
      await grant('OPS_VERIFIER', 'GLOBAL', null);
      for (const c of (await client.query(`SELECT id FROM chefs WHERE is_illustrative AND status = 'APPROVED'`)).rows) await grant('CHEF_OWNER', 'CHEF', c.id);
      for (const o of (await client.query(`SELECT id FROM supplier_organizations WHERE is_illustrative AND status = 'APPROVED'`)).rows) await grant('SUPPLIER_OWNER', 'SUPPLIER_ORG', o.id);
      // A courier profile belongs to one person: hand the sample courier to the first tester.
      const mine = await client.query(`SELECT id FROM courier_profiles WHERE user_id = $1`, [u]);
      if (!mine.rowCount) {
        const cp = (await client.query(
          `SELECT cp.id FROM courier_profiles cp JOIN app_users au ON au.id = cp.user_id WHERE au.identity_subject = 'dev:sample-courier' FOR UPDATE`)).rows[0]?.id as string | undefined;
        if (cp) {
          await client.query(`UPDATE courier_profiles SET user_id = $2 WHERE id = $1`, [cp, u]);
          await client.query(`UPDATE role_memberships SET user_id = $2 WHERE role = 'COURIER' AND scope_id = $1`, [cp, u]);
          await client.query(
            `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, reason, metadata, correlation_id) VALUES ($1, 'STAGING_DEMO_ROLE_LINKED', 'app_user', $2, 'staging demo: sample courier profile handed to tester', $3, 'staging-demo-link')`,
            [sys, u, JSON.stringify({ role: 'COURIER', courierProfileId: cp })]);
        }
      }
      await client.query('COMMIT');
      console.log(`Linked ${subject} to the illustrative partners.`);
    }
  }
} catch (e) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw e;
} finally {
  await client.end();
}
