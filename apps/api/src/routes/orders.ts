import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import * as C from '@lahloba/contracts';
import { canManageBranch, canManageChef } from '@lahloba/domain';
import type { RouteContext } from '../app';
import { withTx } from '../db';
import { HttpError, notFound } from '../errors';
import { idempotent, requestHash, requireIdempotencyKey } from '../platform';
import {
  branchSuborders, chefCheckIngredients, chefOrders, chefReady, chefRespond, chefStart, claimLeg, collectStop,
  courierLegs, courierProfile, deliverLeg, supplierRespond, sweep,
} from '../orders/fulfilment';
import { buildQuote } from '../orders/quote';
import {
  cancelOrder, createOrder, dispatchRefunds, handleProviderEvent, loadOrderDto, orderIdFromSession, orderReference,
  paymentSession, simulateProvider, startPayment, type OrderDeps,
} from '../orders/service';
import { runMutation } from './mutation';

const Id = z.string().uuid();

/**
 * Slices 2-4: quotes, orders, SANDBOX payments, partner responses and two-leg delivery.
 * Ordering is enabled only when a payment provider and the handoff secret are configured;
 * the only provider in this build is the simulator (no real money; refused in production).
 */
export function registerOrderRoutes(app: FastifyInstance, ctx: RouteContext) {
  const deps = (): OrderDeps => {
    if (!ctx.config.orders || ctx.config.payments.provider !== 'simulator') throw new HttpError(503, 'ORDERING_DISABLED', 'Ordering is not switched on in this environment');
    return { handoffSecret: ctx.config.orders.handoffSecret, webhookSecret: ctx.config.payments.webhookSecret };
  };
  const chefActor = async (req: FastifyRequest, chefId: string) => {
    const actor = await ctx.requireActor(req);
    if (!canManageChef(actor, chefId, { allowPending: false })) throw notFound('Chef');
    return actor;
  };
  const branchActor = async (req: FastifyRequest, branchId: string) => {
    const actor = await ctx.requireActor(req);
    const b = (await ctx.pool.query(`SELECT organization_id FROM supplier_branches WHERE id = $1`, [branchId])).rows[0];
    if (!b || !canManageBranch(actor, { branchId, organizationId: b.organization_id }, { allowPending: false })) throw notFound('Branch');
    return actor;
  };
  /** Mutation that may trigger refunds: refunds are dispatched to the provider after commit. */
  type Mutate = Parameters<typeof runMutation>[4];
  const withRefunds = async <T>(req: FastifyRequest, reply: FastifyReply, route: string, params: unknown, body: unknown,
    mutate: (db: Parameters<Mutate>[0], actor: Parameters<Mutate>[1]) => Promise<string[]>, load: () => Promise<T>): Promise<T> => {
    const d = deps();
    let refunds: string[] = [];
    await runMutation(ctx, req, reply, { route, params, body }, async (db, actor) => {
      refunds = await mutate(db, actor);
      return { ok: true };
    });
    if (refunds.length) await dispatchRefunds(ctx.pool, d, refunds, req.id);
    return load();
  };

  // ---------------- customer
  app.post('/v1/quotes', { config: { rateLimit: { max: 30 * (ctx.rateLimitScale ?? 1), timeWindow: '1 minute' } } }, async (req, reply) => {
    deps();
    const body = C.QuoteRequest.parse(req.body);
    return runMutation(ctx, req, reply, { route: 'POST /v1/quotes', body, status: 201 }, async (db, actor) => (await buildQuote(db, actor, body)).dto);
  });

  app.post('/v1/orders', async (req, reply) => {
    const d = deps();
    const body = C.CreateOrderRequest.parse(req.body);
    const actor = await ctx.requireActor(req);
    const key = requireIdempotencyKey(req.headers['idempotency-key']);
    const r = await withTx(ctx.pool, (db) => idempotent(db, { actorUserId: actor.userId, route: 'POST /v1/orders', key, hash: requestHash('POST /v1/orders', null, body) }, 201,
      async () => ({ orderId: await createOrder(db, d, actor.userId, body.quoteId, req.id) })));
    void reply.status(r.status);
    if (r.replayed) void reply.header('idempotent-replayed', 'true');
    return loadOrderDto(ctx.pool, d, (r.body as { orderId: string }).orderId, { customerId: actor.userId });
  });

  app.get('/v1/orders', async (req) => {
    const actor = await ctx.requireActor(req);
    const r = await ctx.pool.query(
      `SELECT o.id, o.fulfillment_state, o.funding_state, o.total_piastres, o.created_at, q.servings, q.snapshot->'offer'->>'titleEn' AS en, q.snapshot->'offer'->>'titleAr' AS ar
       FROM orders o JOIN quotes q ON q.id = o.quote_id WHERE o.customer_id = $1 ORDER BY o.created_at DESC LIMIT 50`, [actor.userId]);
    return C.OrderList.parse({ items: r.rows.map((o) => ({
      id: o.id, reference: orderReference(o.id), dishTitle: { en: o.en, ar: o.ar }, fulfillmentState: o.fulfillment_state, fundingState: o.funding_state,
      totalPiastres: Number(o.total_piastres), createdAt: new Date(o.created_at).toISOString(), servings: o.servings,
    })) });
  });

  app.get('/v1/orders/:orderId', async (req) => {
    const { orderId } = z.object({ orderId: Id }).parse(req.params);
    const actor = await ctx.requireActor(req);
    return loadOrderDto(ctx.pool, deps(), orderId, { customerId: actor.userId });
  });

  app.post('/v1/orders/:orderId/cancel', async (req, reply) => {
    const { orderId } = z.object({ orderId: Id }).parse(req.params);
    const body = C.CancelOrderRequest.parse(req.body);
    const actor = await ctx.requireActor(req);
    return withRefunds(req, reply, 'POST /v1/orders/:id/cancel', { orderId }, body, async (db) => {
      const o = (await db.query(`SELECT fulfillment_state, chef_acceptance FROM orders WHERE id = $1 AND customer_id = $2`, [orderId, actor.userId])).rows[0];
      if (!o) throw notFound('Order');
      // Customers may cancel until the cook has accepted; afterwards support handles it (policy is an open decision).
      if (o.fulfillment_state !== 'RESERVED' || o.chef_acceptance === 'ACCEPTED') throw new HttpError(409, 'TOO_LATE_TO_CANCEL', 'The cook has already accepted this order. Contact support to cancel.');
      return cancelOrder(db, orderId, `CUSTOMER: ${body.reason}`, actor.userId, req.id, body.expectedVersion);
    }, () => loadOrderDto(ctx.pool, deps(), orderId, { customerId: actor.userId }));
  });

  app.post('/v1/orders/:orderId/payments', async (req, reply) => {
    const { orderId } = z.object({ orderId: Id }).parse(req.params);
    deps();
    return runMutation(ctx, req, reply, { route: 'POST /v1/orders/:id/payments', params: { orderId }, body: {} }, (db, actor) => startPayment(db, actor.userId, orderId, req.id));
  });

  // SANDBOX ONLY: stands in for the provider's hosted payment page.
  app.post('/v1/sandbox/payments/:sessionId/complete', async (req, reply) => {
    const d = deps();
    const { sessionId } = z.object({ sessionId: z.string().max(80) }).parse(req.params);
    const orderId = orderIdFromSession(sessionId);
    if (!orderId) throw notFound('Payment session');
    const body = C.SimulatorCompleteRequest.parse(req.body);
    const actor = await ctx.requireActor(req);
    const key = requireIdempotencyKey(req.headers['idempotency-key']);
    // Idempotent: replaying the same request never re-submits a payment.
    const r = await withTx(ctx.pool, (db) => idempotent(db, { actorUserId: actor.userId, route: 'POST /v1/sandbox/payments/:id/complete', key, hash: requestHash('sim', { sessionId }, body) }, 200, async () => ({ done: true })));
    if (!r.replayed) await simulateProvider(ctx.pool, d, actor.userId, orderId, body.outcome, body.attemptId, req.id);
    void reply.status(200);
    return paymentSession(ctx.pool, orderId);
  });

  // Provider webhook (signed). Raw body is needed for signature verification.
  app.register(async (s) => {
    s.removeContentTypeParser('application/json');
    s.addContentTypeParser('application/json', { parseAs: 'string', bodyLimit: 16 * 1024 }, (_req, body, done) => done(null, body));
    s.post('/v1/webhooks/payments/simulator', async (req) => {
      const sig = req.headers['x-simulator-signature'];
      const r = await handleProviderEvent(ctx.pool, deps(), String(req.body ?? ''), typeof sig === 'string' ? sig : undefined, req.id);
      return { received: true, duplicate: r.duplicate };
    });
  });

  // Scheduled sweep: Vercel Cron (GET with bearer CRON_SECRET) or the worker.
  app.get('/v1/internal/sweep', async (req) => {
    const secret = ctx.config.cronSecret;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) throw notFound('Route');
    return sweep(ctx.pool, deps(), req.id);
  });

  // ---------------- chef
  const ChefOrderParams = z.object({ chefId: Id, orderId: Id });
  const chefOrderDto = async (chefId: string, orderId: string) => {
    const r = await chefOrders(ctx.pool, deps(), chefId, orderId);
    if (!r[0]) throw notFound('Order');
    return r[0];
  };
  app.get('/v1/chef/:chefId/orders', async (req) => {
    const { chefId } = z.object({ chefId: Id }).parse(req.params);
    await chefActor(req, chefId);
    return C.ChefOrderList.parse({ items: await chefOrders(ctx.pool, deps(), chefId) });
  });
  app.post('/v1/chef/:chefId/orders/:orderId/respond', async (req, reply) => {
    const p = ChefOrderParams.parse(req.params);
    await chefActor(req, p.chefId);
    const body = C.ChefRespondRequest.parse(req.body);
    return withRefunds(req, reply, 'POST /v1/chef/:c/orders/:o/respond', p, body,
      (db, actor) => chefRespond(db, p.chefId, p.orderId, body, actor.userId, req.id), () => chefOrderDto(p.chefId, p.orderId));
  });
  app.post('/v1/chef/:chefId/orders/:orderId/ingredients', async (req, reply) => {
    const p = ChefOrderParams.parse(req.params);
    await chefActor(req, p.chefId);
    const body = C.ChefIngredientCheckRequest.parse(req.body);
    await runMutation(ctx, req, reply, { route: 'POST /v1/chef/:c/orders/:o/ingredients', params: p, body }, async (db, actor) => {
      await chefCheckIngredients(db, p.chefId, p.orderId, body, actor.userId, req.id);
      return { ok: true };
    });
    return chefOrderDto(p.chefId, p.orderId);
  });
  for (const [path, fn] of [['start', chefStart], ['ready', chefReady]] as const) {
    app.post(`/v1/chef/:chefId/orders/:orderId/${path}`, async (req, reply) => {
      const p = ChefOrderParams.parse(req.params);
      await chefActor(req, p.chefId);
      const body = C.ChefStepRequest.parse(req.body);
      await runMutation(ctx, req, reply, { route: `POST /v1/chef/:c/orders/:o/${path}`, params: p, body }, async (db, actor) => {
        await fn(db, p.chefId, p.orderId, body.expectedVersion, actor.userId);
        return { ok: true };
      });
      return chefOrderDto(p.chefId, p.orderId);
    });
  }

  // ---------------- supplier
  app.get('/v1/supplier/branches/:branchId/suborders', async (req) => {
    const { branchId } = z.object({ branchId: Id }).parse(req.params);
    await branchActor(req, branchId);
    return C.SupplierSuborderList.parse({ items: await branchSuborders(ctx.pool, deps(), branchId) });
  });
  app.post('/v1/supplier/branches/:branchId/suborders/:suborderId/respond', async (req, reply) => {
    const p = z.object({ branchId: Id, suborderId: Id }).parse(req.params);
    await branchActor(req, p.branchId);
    const body = C.SupplierRespondRequest.parse(req.body);
    return withRefunds(req, reply, 'POST /v1/supplier/b/suborders/s/respond', p, body,
      (db, actor) => supplierRespond(db, p.branchId, p.suborderId, body, actor.userId, req.id),
      async () => (await branchSuborders(ctx.pool, deps(), p.branchId, p.suborderId))[0]!);
  });

  // ---------------- courier
  const courierFor = async (req: FastifyRequest) => {
    const actor = await ctx.requireActor(req);
    return { actor, courier: await courierProfile(ctx.pool, actor.userId) };
  };
  const legDto = async (courier: { id: string; equipment: string[] }, legId: string) => {
    const r = await courierLegs(ctx.pool, courier, legId);
    if (!r[0]) throw notFound('Job');
    return r[0];
  };
  app.get('/v1/courier/jobs', async (req) => {
    const { courier } = await courierFor(req);
    return C.CourierLegList.parse({ items: await courierLegs(ctx.pool, courier) });
  });
  app.post('/v1/courier/legs/:legId/claim', async (req, reply) => {
    const { legId } = z.object({ legId: Id }).parse(req.params);
    const { courier } = await courierFor(req);
    const body = C.CourierClaimRequest.parse(req.body);
    await runMutation(ctx, req, reply, { route: 'POST /v1/courier/legs/:id/claim', params: { legId }, body }, async (db, actor) => {
      await claimLeg(db, courier, legId, body.expectedVersion, actor.userId, req.id);
      return { ok: true };
    });
    return legDto(courier, legId);
  });
  // Code entry is deliberately NOT idempotency-replayed: each wrong attempt must count.
  app.post('/v1/courier/legs/:legId/stops/:stopId/collect', { config: { rateLimit: { max: 20 * (ctx.rateLimitScale ?? 1), timeWindow: '1 minute' } } }, async (req) => {
    const p = z.object({ legId: Id, stopId: Id }).parse(req.params);
    const { actor, courier } = await courierFor(req);
    const body = C.CourierCodeRequest.parse(req.body);
    await collectStop(ctx.pool, deps(), courier, p.legId, p.stopId, body.code, body.expectedVersion, actor.userId, req.id);
    return legDto(courier, p.legId);
  });
  app.post('/v1/courier/legs/:legId/deliver', { config: { rateLimit: { max: 20 * (ctx.rateLimitScale ?? 1), timeWindow: '1 minute' } } }, async (req) => {
    const { legId } = z.object({ legId: Id }).parse(req.params);
    const { actor, courier } = await courierFor(req);
    const body = C.CourierCodeRequest.parse(req.body);
    await deliverLeg(ctx.pool, deps(), courier, legId, body.code, body.expectedVersion, actor.userId, req.id);
    return legDto(courier, legId);
  });
}
