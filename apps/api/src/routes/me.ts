import type { FastifyInstance } from 'fastify';
import * as C from '@lahloba/contracts';
import type { ResolvedActor, RouteContext } from '../app';
import { audit } from '../platform';
import { runMutation } from './mutation';

const toMe = (a: ResolvedActor, overrides: Partial<{ locale: 'en' | 'ar'; displayName: string | null }> = {}, scopeNames?: Record<string, string>) =>
  C.Me.parse({
    userId: a.userId,
    displayName: overrides.displayName !== undefined ? overrides.displayName : a.displayName,
    locale: overrides.locale ?? a.locale,
    memberships: a.memberships,
    ...(scopeNames ? { scopeNames } : {}),
  });

/** Public names for the partner scopes, so a person holding several sees which is which. */
async function scopeNamesFor(db: { query: RouteContext['pool']['query'] }, a: ResolvedActor): Promise<Record<string, string>> {
  const ids = (t: string) => a.memberships.filter((m) => m.scopeType === t && m.scopeId).map((m) => m.scopeId!);
  const out: Record<string, string> = {};
  const add = async (sql: string, list: string[]) => {
    if (!list.length) return;
    for (const r of (await db.query(sql, [list])).rows as Array<{ id: string; name: string }>) out[r.id] = r.name;
  };
  await add(`SELECT id, public_name AS name FROM chefs WHERE id = ANY($1::uuid[])`, ids('CHEF'));
  await add(`SELECT id, public_name AS name FROM supplier_organizations WHERE id = ANY($1::uuid[])`, ids('SUPPLIER_ORG'));
  await add(`SELECT id, display_name AS name FROM courier_profiles WHERE id = ANY($1::uuid[])`, ids('COURIER'));
  return out;
}

export function registerMeRoutes(app: FastifyInstance, ctx: RouteContext) {
  app.get('/v1/me', async (req) => {
    const actor = await ctx.requireActor(req);
    return toMe(actor, {}, await scopeNamesFor(ctx.pool, actor));
  });

  app.patch('/v1/me', async (req, reply) => {
    const body = C.UpdateMeRequest.parse(req.body ?? {});
    return runMutation(ctx, req, reply, { route: 'PATCH /v1/me', body }, async (db, actor) => {
      const r = await db.query<{ locale: 'en' | 'ar'; display_name: string | null }>(
        `UPDATE app_users SET locale = COALESCE($2, locale), display_name = COALESCE($3, display_name), updated_at = now()
         WHERE id = $1 RETURNING locale, display_name`,
        [actor.userId, body.locale ?? null, body.displayName ?? null],
      );
      await audit(db, { actorUserId: actor.userId, action: 'USER_PROFILE_UPDATED', targetType: 'app_user', targetId: actor.userId, metadata: { fields: Object.keys(body) }, correlationId: req.id });
      const row = r.rows[0]!;
      return toMe(actor, { locale: row.locale, displayName: row.display_name });
    });
  });
}
