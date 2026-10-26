import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as C from '@lahloba/contracts';
import type { RouteContext } from '../app';
import type { DbClient, Queryable } from '../db';
import { HttpError, conflict, notFound } from '../errors';
import { audit, enqueueEvent } from '../platform';
import { runMutation } from './mutation';

const MEMBERSHIP_CONFLICT = `(user_id, role, scope_type, (COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid)))`;

export const APPLICATION_COLUMNS = `a.id, a.kind, a.subject_id, a.status, a.submitted_at, a.decided_at, a.decision_reason,
  a.permitted_next_step, a.version, (SELECT count(*)::int FROM partner_evidence e WHERE e.application_id = a.id) AS evidence_count`;

export function toApplicationDto(r: Record<string, any>): C.PartnerApplicationDto {
  return C.PartnerApplicationDto.parse({
    id: r.id, kind: r.kind, subjectId: r.subject_id, status: r.status,
    submittedAt: new Date(r.submitted_at).toISOString(), decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : null,
    decisionReason: r.decision_reason, permittedNextStep: r.permitted_next_step, version: r.version, evidenceCount: r.evidence_count,
  });
}

async function assertAreas(db: Queryable, ids: string[]) {
  const unique = [...new Set(ids)];
  const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM service_areas WHERE id = ANY($1) AND status <> 'INACTIVE'`, [unique]);
  if (r.rows[0]!.n !== unique.length) throw new HttpError(422, 'UNKNOWN_AREA', 'One or more areas are not available');
}

async function upsertPendingMembership(db: DbClient, userId: string, role: string, scopeType: string, scopeId: string) {
  await db.query(
    `INSERT INTO role_memberships (user_id, role, scope_type, scope_id, approval_state) VALUES ($1, $2, $3, $4, 'PENDING')
     ON CONFLICT ${MEMBERSHIP_CONFLICT} DO UPDATE SET approval_state = 'PENDING', version = role_memberships.version + 1, updated_at = now()
     WHERE role_memberships.approval_state = 'REJECTED'`,
    [userId, role, scopeType, scopeId],
  );
}

export function registerPartnerRoutes(app: FastifyInstance, ctx: RouteContext) {
  // H01 / S01 / D01: apply. Creates PENDING subject + PENDING scoped membership. Never self-approves.
  app.post('/v1/partner-applications', { config: { rateLimit: { max: 10 * (ctx.rateLimitScale ?? 1), timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = C.CreatePartnerApplication.parse(req.body);
    return runMutation(ctx, req, reply, { route: 'POST /v1/partner-applications', body, status: 201 }, async (db, actor) => {
      const open = await db.query(`SELECT 1 FROM partner_applications WHERE applicant_user_id = $1 AND kind = $2 AND status = 'SUBMITTED'`, [actor.userId, body.kind]);
      if (open.rowCount) throw conflict('APPLICATION_ALREADY_OPEN', 'An application of this kind is already waiting for review');

      let subjectId: string;
      if (body.kind === 'CHEF') {
        const c = body.chef;
        await assertAreas(db, [c.publicAreaId, c.kitchenAddress.areaId, ...c.serviceAreaIds]);
        const existing = await db.query<{ id: string; status: string }>(`SELECT id, status FROM chefs WHERE owner_user_id = $1 FOR UPDATE`, [actor.userId]);
        const prior = existing.rows[0];
        if (prior && prior.status !== 'REJECTED') throw conflict('ALREADY_A_PARTNER', 'You already have a chef profile');
        const addr = await db.query<{ id: string }>(
          `INSERT INTO private_addresses (owner_user_id, address_text, area_id) VALUES ($1, $2, $3) RETURNING id`,
          [actor.userId, c.kitchenAddress.addressText, c.kitchenAddress.areaId],
        );
        if (prior) {
          await db.query(
            `UPDATE chefs SET public_name = $2, public_area_id = $3, kitchen_address_id = $4, status = 'PENDING', accepting_orders = false,
             version = version + 1, updated_at = now() WHERE id = $1`,
            [prior.id, c.publicName, c.publicAreaId, addr.rows[0]!.id],
          );
          await db.query(`DELETE FROM chef_service_areas WHERE chef_id = $1`, [prior.id]);
          subjectId = prior.id;
        } else {
          const chef = await db.query<{ id: string }>(
            `INSERT INTO chefs (owner_user_id, public_name, public_area_id, kitchen_address_id) VALUES ($1, $2, $3, $4) RETURNING id`,
            [actor.userId, c.publicName, c.publicAreaId, addr.rows[0]!.id],
          );
          subjectId = chef.rows[0]!.id;
        }
        await db.query(`INSERT INTO chef_service_areas (chef_id, area_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`, [subjectId, [...new Set(c.serviceAreaIds)]]);
        await upsertPendingMembership(db, actor.userId, 'CHEF_OWNER', 'CHEF', subjectId);
      } else if (body.kind === 'SUPPLIER') {
        const s = body.supplier;
        await assertAreas(db, [s.branch.areaId, s.branch.address.areaId, ...s.branch.serviceAreaIds]);
        const org = await db.query<{ id: string }>(`INSERT INTO supplier_organizations (owner_user_id, public_name) VALUES ($1, $2) RETURNING id`, [actor.userId, s.organizationName]);
        const addr = await db.query<{ id: string }>(
          `INSERT INTO private_addresses (owner_user_id, address_text, area_id) VALUES ($1, $2, $3) RETURNING id`,
          [actor.userId, s.branch.address.addressText, s.branch.address.areaId],
        );
        const branch = await db.query<{ id: string }>(
          `INSERT INTO supplier_branches (organization_id, public_name, area_id, address_id) VALUES ($1, $2, $3, $4) RETURNING id`,
          [org.rows[0]!.id, s.branch.publicName, s.branch.areaId, addr.rows[0]!.id],
        );
        await db.query(`INSERT INTO supplier_branch_service_areas (branch_id, area_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`, [branch.rows[0]!.id, [...new Set(s.branch.serviceAreaIds)]]);
        subjectId = org.rows[0]!.id;
        await upsertPendingMembership(db, actor.userId, 'SUPPLIER_OWNER', 'SUPPLIER_ORG', subjectId);
      } else {
        const k = body.courier;
        const existing = await db.query<{ id: string; status: string }>(`SELECT id, status FROM courier_profiles WHERE user_id = $1 FOR UPDATE`, [actor.userId]);
        const prior = existing.rows[0];
        if (prior && prior.status !== 'REJECTED') throw conflict('ALREADY_A_PARTNER', 'You already have a delivery partner profile');
        const equipment = [...new Set(k.equipment)];
        if (prior) {
          await db.query(`UPDATE courier_profiles SET display_name = $2, equipment = $3, status = 'PENDING', availability = 'OFFLINE' WHERE id = $1`, [prior.id, k.displayName, equipment]);
          subjectId = prior.id;
        } else {
          const cp = await db.query<{ id: string }>(`INSERT INTO courier_profiles (user_id, display_name, equipment) VALUES ($1, $2, $3) RETURNING id`, [actor.userId, k.displayName, equipment]);
          subjectId = cp.rows[0]!.id;
        }
        await upsertPendingMembership(db, actor.userId, 'COURIER', 'COURIER', subjectId);
      }

      const a = await db.query(
        `INSERT INTO partner_applications (applicant_user_id, kind, subject_id) VALUES ($1, $2, $3) RETURNING id`,
        [actor.userId, body.kind, subjectId],
      );
      const appId = a.rows[0]!.id as string;
      await audit(db, { actorUserId: actor.userId, action: 'PARTNER_APPLICATION_SUBMITTED', targetType: 'partner_application', targetId: appId, metadata: { kind: body.kind }, correlationId: req.id });
      await enqueueEvent(db, { aggregateType: 'partner_application', aggregateId: appId, eventType: 'PartnerApplicationSubmitted', payload: { applicationId: appId, kind: body.kind }, correlationId: req.id });
      const full = await db.query(`SELECT ${APPLICATION_COLUMNS} FROM partner_applications a WHERE a.id = $1`, [appId]);
      return toApplicationDto(full.rows[0]!);
    });
  });

  app.get('/v1/partner-applications/mine', async (req) => {
    const actor = await ctx.requireActor(req);
    const r = await ctx.pool.query(`SELECT ${APPLICATION_COLUMNS} FROM partner_applications a WHERE a.applicant_user_id = $1 ORDER BY a.submitted_at DESC`, [actor.userId]);
    return C.PartnerApplicationList.parse({ items: r.rows.map(toApplicationDto) });
  });

  // Private evidence reference. Only the applicant, only while the application is open.
  app.post('/v1/partner-applications/:id/evidence', { config: { rateLimit: { max: 20 * (ctx.rateLimitScale ?? 1), timeWindow: '1 minute' } } }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = C.RegisterEvidenceRequest.parse(req.body);
    return runMutation(ctx, req, reply, { route: 'POST /v1/partner-applications/:id/evidence', params: { id }, body, status: 201 }, async (db, actor) => {
      const a = await db.query(`SELECT id FROM partner_applications WHERE id = $1 AND applicant_user_id = $2 AND status = 'SUBMITTED' FOR UPDATE`, [id, actor.userId]);
      if (!a.rowCount) throw notFound('Application');
      const { objectKey, storageState } = ctx.evidence.allocateObjectKey(id);
      const e = await db.query<{ id: string }>(
        `INSERT INTO partner_evidence (application_id, evidence_type, object_key, storage_state, content_type, byte_size, expires_on, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [id, body.evidenceType, objectKey, storageState, body.contentType, body.byteSize, body.expiresOn ?? null, actor.userId],
      );
      await audit(db, { actorUserId: actor.userId, action: 'PARTNER_EVIDENCE_REGISTERED', targetType: 'partner_application', targetId: id, metadata: { evidenceType: body.evidenceType, storageState }, correlationId: req.id });
      const evidenceId = e.rows[0]!.id;
      return C.EvidenceRegistered.parse({
        evidenceId,
        upload: { status: storageState, uploadPath: storageState === 'PENDING_UPLOAD' ? `/v1/partner-evidence/${evidenceId}/content` : null },
      });
    });
  });
}
