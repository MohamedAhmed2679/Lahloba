import type { FastifyInstance } from 'fastify';
import * as C from '@lahloba/contracts';
import type { RouteContext } from '../app';
import { HttpError } from '../errors';
import { AiUnavailable, translationModel } from '../ai/huggingface';

const PARTNER_ROLES = new Set(['CHEF_OWNER', 'CHEF_STAFF', 'SUPPLIER_OWNER', 'SUPPLIER_STAFF']);

export function registerAiRoutes(app: FastifyInstance, ctx: RouteContext) {
  // Which assisted features this server offers; apps hide what is off.
  app.get('/v1/features', async () => C.Features.parse({
    translate: !!ctx.ai,
    semanticSearch: !!ctx.ai,
    kitchenPhotoCheck: !!ctx.ai,
    photoQualityCheck: true,
  }));

  // Draft translation of a partner's menu text (Hugging Face opus-mt). Always a draft the partner edits.
  app.post('/v1/ai/translate', { config: { rateLimit: { max: 30 * (ctx.rateLimitScale ?? 1), timeWindow: '1 minute' } } }, async (req) => {
    const actor = await ctx.requireActor(req);
    if (!actor.memberships.some((m) => PARTNER_ROLES.has(m.role) && (m.approvalState === 'APPROVED' || m.approvalState === 'PENDING'))) {
      throw new HttpError(403, 'FORBIDDEN', 'Translation drafts are for partners writing their menu');
    }
    const body = C.TranslateRequest.parse(req.body ?? {});
    if (!ctx.ai) throw new HttpError(503, 'AI_OFF', 'Translation drafts are not switched on for this server');
    if (body.from === body.to) return C.TranslateResponse.parse({ text: body.text, model: 'none', draft: true });
    try {
      return C.TranslateResponse.parse({ text: await ctx.ai.translate(body.text, body.from, body.to), model: translationModel(body.from, body.to), draft: true });
    } catch (e) {
      if (e instanceof AiUnavailable) throw new HttpError(503, 'AI_UNAVAILABLE', 'The translation service did not answer. Try again in a minute, or write it yourself.');
      throw e;
    }
  });
}
