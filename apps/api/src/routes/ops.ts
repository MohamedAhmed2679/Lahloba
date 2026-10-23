import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import * as C from '@lahloba/contracts';
import { canReviewPartnerApplications, isSelfReview } from '@lahloba/domain';
import type { RouteContext } from '../app';
import { HttpError, conflict, forbidden, notFound } from '../errors';
import { audit, enqueueEvent } from '../platform';
import { runMutation } from './mutation';
import { APPLICATION_COLUMNS, toApplicationDto } from './partners';

const ROLE_FOR_KIND = { CHEF: 'CHEF_OWNER', SUPPLIER: 'SUPPLIER_OWNER', COURIER: 'COURIER' } as const;

/** O01: protected operations endpoints. Role checks are server-side; the console UI is not trusted. */
export function registerOpsRoutes(app: FastifyInstance, ctx: RouteContext) {
  const requireReviewer = async (req: FastifyRequest) => {
    const actor = await ctx.requireActor(req);
    if (!canReviewPartnerApplications(actor)) throw forbidden('Operations verifier role required');
    return actor;
  };

  app.get('/v1/ops/partner-applications', async (req) => {
    await requireReviewer(req);
    const q = z.object({ status: z.enum(['SUBMITTED', 'APPROVED', 'REJECTED']).default('SUBMITTED') }).parse(req.query);
    const r = await ctx.pool.query(`SELECT ${APPLICATION_COLUMNS} FROM partner_applications a WHERE a.status = $1 ORDER BY a.submitted_at LIMIT 200`, [q.status]);
    return C.PartnerApplicationList.parse({ items: r.rows.map(toApplicationDto) });
  });

  // Evidence METADATA only, audited as a sensitive read. Object keys/files are never returned.
  app.get('/v1/ops/partner-applications/:id', async (req) => {
    const actor = await requireReviewer(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const r = await ctx.pool.query(
      `SELECT ${APPLICATION_COLUMNS}, a.applicant_user_id, u.display_name AS applicant_name
       FROM partner_applications a JOIN app_users u ON u.id = a.applicant_user_id WHERE a.id = $1`,
      [id],
    );
    const row = r.rows[0];
    if (!row) throw notFound('Application');
    let summary: { publicName: string; area: { en: string; ar: string } | null; equipment: string[] } = { publicName: '', area: null, equipment: [] };
    if (row.kind === 'CHEF') {
      const s = await ctx.pool.query(`SELECT c.public_name, sa.label_en, sa.label_ar FROM chefs c JOIN service_areas sa ON sa.id = c.public_area_id WHERE c.id = $1`, [row.subject_id]);
      const x = s.rows[0];
      if (x) summary = { publicName: x.public_name, area: { en: x.label_en, ar: x.label_ar }, equipment: [] };
    } else if (row.kind === 'SUPPLIER') {
      const s = await ctx.pool.query(`SELECT public_name FROM supplier_organizations WHERE id = $1`, [row.subject_id]);
      if (s.rows[0]) summary = { publicName: s.rows[0].public_name, area: null, equipment: [] };
    } else {
      const s = await ctx.pool.query(`SELECT display_name, equipment FROM courier_profiles WHERE id = $1`, [row.subject_id]);
      if (s.rows[0]) summary = { publicName: s.rows[0].display_name, area: null, equipment: s.rows[0].equipment };
    }
    const ev = await ctx.pool.query(
      `SELECT id, evidence_type, content_type, byte_size, expires_on, review_state, created_at, storage_state, scan_state FROM partner_evidence WHERE application_id = $1 ORDER BY created_at`,
      [id],
    );
    await audit(ctx.pool, { actorUserId: actor.userId, action: 'PARTNER_EVIDENCE_METADATA_READ', targetType: 'partner_application', targetId: id, correlationId: req.id });
    return C.OpsApplicationDetail.parse({
      ...toApplicationDto(row),
      applicant: { userId: row.applicant_user_id, displayName: row.applicant_name },
      subjectSummary: summary,
      evidence: ev.rows.map((e) => ({
        evidenceId: e.id, evidenceType: e.evidence_type, contentType: e.content_type, byteSize: e.byte_size,
        expiresOn: e.expires_on, reviewState: e.review_state, createdAt: new Date(e.created_at).toISOString(),
        fileState: e.storage_state, scanState: e.scan_state,
      })),
    });
  });

  app.post('/v1/ops/partner-applications/:id/decision', async (req, reply) => {
    await requireReviewer(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = C.ApplicationDecisionRequest.parse(req.body);
    return runMutation(ctx, req, reply, { route: 'POST /v1/ops/partner-applications/:id/decision', params: { id }, body }, async (db, actor) => {
      const r = await db.query(`SELECT id, applicant_user_id, kind, subject_id, status, version FROM partner_applications WHERE id = $1 FOR UPDATE`, [id]);
      const a = r.rows[0];
      if (!a) throw notFound('Application');
      if (isSelfReview(actor, a.applicant_user_id)) throw forbidden('You cannot review your own application');
      if (a.status !== 'SUBMITTED') throw conflict('ALREADY_DECIDED', 'This application has already been decided');
      if (a.version !== body.expectedVersion) throw conflict('VERSION_CONFLICT', 'Application changed; reload before deciding', { currentVersion: a.version });

      const approve = body.decision === 'APPROVE';
      if (approve) {
        const ev = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM partner_evidence WHERE application_id = $1 AND storage_state IN ('UPLOADED','DEV_METADATA_ONLY','STORAGE_DISABLED')`, [id]);
        if (ev.rows[0]!.n < 1) throw new HttpError(422, 'EVIDENCE_REQUIRED', 'At least one uploaded document (or recorded reference where uploads are disabled) is required before approval');
      }
      const next = approve ? 'APPROVED' : 'REJECTED';
      await db.query(
        `UPDATE partner_applications SET status = $2, decided_at = now(), decided_by = $3, decision_reason = $4,
         permitted_next_step = $5, version = version + 1 WHERE id = $1`,
        [id, next, actor.userId, body.reason, body.decision === 'REJECT' ? body.permittedNextStep : null],
      );
      // Membership approval is attributed to the reviewer (granted_by <> user enforced by DB).
      await db.query(
        `UPDATE role_memberships SET approval_state = $4, granted_by = $5, version = version + 1, updated_at = now()
         WHERE user_id = $1 AND role = $2 AND scope_id = $3`,
        [a.applicant_user_id, ROLE_FOR_KIND[a.kind as keyof typeof ROLE_FOR_KIND], a.subject_id, next, actor.userId],
      );
      if (a.kind === 'CHEF') {
        await db.query(`UPDATE chefs SET status = $2, version = version + 1, updated_at = now() WHERE id = $1`, [a.subject_id, next]);
      } else if (a.kind === 'SUPPLIER') {
        await db.query(`UPDATE supplier_organizations SET status = $2 WHERE id = $1`, [a.subject_id, next]);
        await db.query(`UPDATE supplier_branches SET status = $2 WHERE organization_id = $1 AND status = 'PENDING'`, [a.subject_id, next]);
      } else {
        await db.query(`UPDATE courier_profiles SET status = $2 WHERE id = $1`, [a.subject_id, next]);
      }
      // Approval to list is NOT a verification badge; no verified claim is created here.
      await audit(db, {
        actorUserId: actor.userId, action: approve ? 'PARTNER_APPLICATION_APPROVED' : 'PARTNER_APPLICATION_REJECTED',
        targetType: 'partner_application', targetId: id, reason: body.reason, metadata: { kind: a.kind }, correlationId: req.id,
      });
      await enqueueEvent(db, {
        aggregateType: 'partner_application', aggregateId: id, eventType: 'PartnerApplicationDecided',
        payload: { applicationId: id, kind: a.kind, decision: next }, correlationId: req.id,
      });
      const full = await db.query(`SELECT ${APPLICATION_COLUMNS} FROM partner_applications a WHERE a.id = $1`, [id]);
      return toApplicationDto(full.rows[0]!);
    });
  });
}
