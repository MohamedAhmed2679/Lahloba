import type { Actor, Membership } from '@lahloba/domain';
import type { Pool } from './db';
import type { VerifiedIdentity } from './identity/provider';

/**
 * Resolves (and on first sight provisions) the app user for a verified identity, then loads
 * memberships from the database. Every new user gets exactly one APPROVED CUSTOMER membership;
 * partner and operations memberships are only created through reviewed flows.
 */
export async function resolveActor(pool: Pool, id: VerifiedIdentity): Promise<Actor & { displayName: string | null; locale: 'en' | 'ar' }> {
  type Row = { id: string; status: Actor['status']; display_name: string | null; locale: 'en' | 'ar' };
  const select = () => pool.query<Row>(`SELECT id, status, display_name, locale FROM app_users WHERE identity_subject = $1`, [id.subject]);
  let user = (await select()).rows[0];
  if (!user) {
    // Concurrent first requests race safely: the unique subject makes one insert win.
    const ins = await pool.query<Row>(
      `INSERT INTO app_users (identity_subject, display_name) VALUES ($1, $2)
       ON CONFLICT (identity_subject) DO NOTHING RETURNING id, status, display_name, locale`,
      [id.subject, id.displayName],
    );
    user = ins.rows[0] ?? (await select()).rows[0]!;
    await pool.query(
      `INSERT INTO role_memberships (user_id, role, scope_type, scope_id, approval_state)
       VALUES ($1, 'CUSTOMER', 'GLOBAL', NULL, 'APPROVED') ON CONFLICT DO NOTHING`,
      [user.id],
    );
  }
  const ms = await pool.query<{ id: string; role: Membership['role']; scope_type: Membership['scopeType']; scope_id: string | null; approval_state: Membership['approvalState'] }>(
    `SELECT id, role, scope_type, scope_id, approval_state FROM role_memberships WHERE user_id = $1 ORDER BY created_at, id`,
    [user.id],
  );
  return {
    userId: user.id,
    status: user.status,
    displayName: user.display_name,
    locale: user.locale,
    memberships: ms.rows.map((m) => ({ id: m.id, role: m.role, scopeType: m.scope_type, scopeId: m.scope_id, approvalState: m.approval_state })),
  };
}
