import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ResolvedActor, RouteContext } from '../app';
import { withTx, type DbClient } from '../db';
import { idempotent, requestHash, requireIdempotencyKey } from '../platform';

/**
 * Standard authenticated mutation: verified actor, required Idempotency-Key, one database
 * transaction containing the state change, audit record, outbox event and idempotency record.
 */
export async function runMutation<T>(
  ctx: RouteContext,
  req: FastifyRequest,
  reply: FastifyReply,
  opts: { route: string; params?: unknown; body?: unknown; status?: number },
  fn: (db: DbClient, actor: ResolvedActor) => Promise<T>,
): Promise<T> {
  const actor = await ctx.requireActor(req);
  const key = requireIdempotencyKey(req.headers['idempotency-key']);
  const hash = requestHash(opts.route, opts.params ?? null, opts.body ?? null);
  const status = opts.status ?? 200;
  const result = await withTx(ctx.pool, (db) =>
    idempotent(db, { actorUserId: actor.userId, route: opts.route, key, hash }, status, () => fn(db, actor)),
  );
  if (result.replayed) void reply.header('idempotent-replayed', 'true');
  void reply.status(result.status);
  return result.body;
}
