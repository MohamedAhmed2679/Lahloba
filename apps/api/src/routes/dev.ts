import type { FastifyInstance } from 'fastify';
import * as C from '@lahloba/contracts';
import type { RouteContext } from '../app';
import { DevStubIdentityProvider } from '../identity/provider';

/**
 * DEVELOPMENT/TEST ONLY. Registered only when the dev identity stub is configured, which config
 * loading forbids outside development/test. Issues short-lived tokens for local testing.
 * It cannot grant roles: tokens only carry a subject; roles come from the database.
 */
export function registerDevRoutes(app: FastifyInstance, ctx: RouteContext) {
  const provider = ctx.identity;
  if (!(provider instanceof DevStubIdentityProvider)) return;
  app.post('/v1/dev/tokens', { config: { rateLimit: { max: 30 * (ctx.rateLimitScale ?? 1), timeWindow: '1 minute' } } }, async (req) => {
    const body = C.DevTokenRequest.parse(req.body ?? {});
    const ttl = 8 * 3600;
    return C.DevTokenResponse.parse({
      token: await provider.issue(body.subject, body.displayName, ttl),
      expiresInSeconds: ttl,
      warning: 'Development identity stub. Not valid in staging or production.',
    });
  });
}
