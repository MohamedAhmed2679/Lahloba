import type { FastifyInstance } from 'fastify';
import * as C from '@lahloba/contracts';
import type { ResolvedActor, RouteContext } from '../app';
import { audit } from '../platform';
import { runMutation } from './mutation';

const toMe = (a: ResolvedActor, overrides: Partial<{ locale: 'en' | 'ar'; displayName: string | null }> = {}) =>
  C.Me.parse({
    userId: a.userId,
    displayName: overrides.displayName !== undefined ? overrides.displayName : a.displayName,
    locale: overrides.locale ?? a.locale,
    memberships: a.memberships,
  });

export function registerMeRoutes(app: FastifyInstance, ctx: RouteContext) {
  app.get('/v1/me', async (req) => toMe(await ctx.requireActor(req)));

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
