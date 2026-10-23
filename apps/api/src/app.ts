import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import type { ServerConfig } from '@lahloba/config';
import type { Actor } from '@lahloba/domain';
import { resolveActor } from './actor';
import type { Pool } from './db';
import { forbidden, toHttpError, unauthenticated } from './errors';
import type { IdentityProvider } from './identity/provider';
import { registerChefRoutes } from './routes/chef';
import { registerDevRoutes } from './routes/dev';
import { registerEvidenceRoutes } from './routes/evidence';
import { registerMeRoutes } from './routes/me';
import { registerOpsRoutes } from './routes/ops';
import { registerPartnerRoutes } from './routes/partners';
import { registerPublicRoutes } from './routes/public';
import { registerSupplierRoutes } from './routes/supplier';
import type { EvidenceStorage } from './storage/evidence';

export type ResolvedActor = Actor & { displayName: string | null; locale: 'en' | 'ar' };

export interface AppDeps {
  config: ServerConfig;
  pool: Pool;
  identity: IdentityProvider;
  evidence: EvidenceStorage;
  logger?: boolean;
  /** Multiplies every rate limit (tests only raise it; production uses 1). */
  rateLimitScale?: number;
}

export interface RouteContext extends AppDeps {
  /** Verified, ACTIVE actor or 401/403. Identity always comes from the bearer token. */
  requireActor(req: FastifyRequest): Promise<ResolvedActor>;
}

const CORRELATION = /^[A-Za-z0-9-]{8,64}$/;

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: deps.logger ?? false,
    bodyLimit: 64 * 1024,
    trustProxy: false,
    requestIdHeader: false,
    genReqId: (req) => {
      const h = req.headers['x-correlation-id'];
      return typeof h === 'string' && CORRELATION.test(h) ? h : randomUUID();
    },
  });

  await app.register(cors, {
    origin: deps.config.corsOrigins.length ? deps.config.corsOrigins : false,
    allowedHeaders: ['authorization', 'content-type', 'idempotency-key', 'x-correlation-id'],
    exposedHeaders: ['x-correlation-id'],
    methods: ['GET', 'POST', 'PATCH', 'PUT'],
  });
  await app.register(rateLimit, { global: true, max: 300 * (deps.rateLimitScale ?? 1), timeWindow: '1 minute' });

  app.addHook('onSend', async (req, reply) => {
    reply.header('x-correlation-id', req.id);
    reply.header('cache-control', 'no-store');
    reply.header('x-content-type-options', 'nosniff');
  });

  app.setErrorHandler((err, req, reply) => {
    const e = toHttpError(err);
    if (e.status >= 500) req.log.error({ err }, 'unhandled error');
    void reply.status(e.status).send({ error: { code: e.code, message: e.message, ...(e.details !== undefined ? { details: e.details } : {}), correlationId: req.id } });
  });
  app.setNotFoundHandler((req, reply) => {
    void reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found', correlationId: req.id } });
  });

  const cache = new WeakMap<FastifyRequest, Promise<ResolvedActor>>();
  const requireActor = (req: FastifyRequest): Promise<ResolvedActor> => {
    let p = cache.get(req);
    if (!p) {
      p = (async () => {
        const h = req.headers.authorization;
        if (typeof h !== 'string' || !h.startsWith('Bearer ')) throw unauthenticated();
        const identity = await deps.identity.verify(h.slice(7).trim());
        if (!identity) throw unauthenticated();
        const actor = await resolveActor(deps.pool, identity);
        if (actor.status !== 'ACTIVE') throw forbidden('This account is not active');
        return actor;
      })();
      cache.set(req, p);
    }
    return p;
  };

  const ctx: RouteContext = { ...deps, requireActor };
  app.get('/v1/health', async () => ({ status: 'ok' }));
  await app.register(async (s) => registerPublicRoutes(s, ctx));
  await app.register(async (s) => registerMeRoutes(s, ctx));
  await app.register(async (s) => registerPartnerRoutes(s, ctx));
  await app.register(async (s) => registerOpsRoutes(s, ctx));
  await app.register(async (s) => registerChefRoutes(s, ctx));
  await app.register(async (s) => registerSupplierRoutes(s, ctx));
  await app.register(async (s) => registerEvidenceRoutes(s, ctx));
  if (deps.identity.kind === 'dev-stub' && (deps.config.env === 'development' || deps.config.env === 'test')) {
    await app.register(async (s) => registerDevRoutes(s, ctx));
  }
  return app;
}
