import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as C from '@lahloba/contracts';
import { canReviewPartnerApplications } from '@lahloba/domain';
import type { RouteContext } from '../app';
import { withTx } from '../db';
import { HttpError, forbidden, notFound } from '../errors';
import { audit } from '../platform';
import { MAX_UPLOAD_BYTES, prepareEvidence, type EvidenceContentType } from '../storage/files';
import { signEvidenceLink, verifyEvidenceLink } from '../storage/evidence';

const FILE_TYPES: EvidenceContentType[] = ['application/pdf', 'image/jpeg', 'image/png'];

/**
 * Private evidence files (H01/S01/D01/O01). Upload: applicant only, once, into the evidence slot
 * they registered; bytes are validated by signature, photos stripped of metadata, then stored
 * privately. Viewing: reviewers request a 5-minute signed link (audited); every file served is
 * audited too. Nothing here is ever reachable from public catalog routes.
 */
export function registerEvidenceRoutes(app: FastifyInstance, ctx: RouteContext) {
  for (const type of FILE_TYPES) {
    app.addContentTypeParser(type, { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_BYTES }, (_req, body, done) => done(null, body));
  }

  app.put('/v1/partner-evidence/:evidenceId/content', { bodyLimit: MAX_UPLOAD_BYTES, config: { rateLimit: { max: 20 * (ctx.rateLimitScale ?? 1), timeWindow: '1 minute' } } }, async (req) => {
    const { evidenceId } = z.object({ evidenceId: z.string().uuid() }).parse(req.params);
    const actor = await ctx.requireActor(req);
    if (!ctx.evidence.acceptsFiles) throw new HttpError(409, 'STORAGE_DISABLED', 'File upload is not enabled on this server');
    const contentType = String(req.headers['content-type'] ?? '').split(';')[0]!.trim() as EvidenceContentType;
    if (!FILE_TYPES.includes(contentType) || !Buffer.isBuffer(req.body)) throw new HttpError(415, 'UNSUPPORTED_FILE', 'Upload a PDF, JPEG or PNG file');

    const row = (await ctx.pool.query(
      `SELECT e.id, e.object_key, e.content_type, e.storage_state, a.applicant_user_id, a.status, a.id AS application_id
       FROM partner_evidence e JOIN partner_applications a ON a.id = e.application_id WHERE e.id = $1`, [evidenceId],
    )).rows[0];
    if (!row || row.applicant_user_id !== actor.userId) throw notFound('Evidence');
    if (row.status !== 'SUBMITTED') throw new HttpError(409, 'APPLICATION_CLOSED', 'This application is no longer open for documents');
    if (row.storage_state !== 'PENDING_UPLOAD') throw new HttpError(409, 'ALREADY_UPLOADED', 'A file was already received for this document; add a new document instead');
    if (row.content_type !== contentType) throw new HttpError(422, 'FILE_TYPE_MISMATCH', 'The file type does not match the document you registered');

    let prepared: { bytes: Uint8Array; sha256: string };
    try {
      prepared = prepareEvidence(contentType, new Uint8Array(req.body as Buffer));
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'FILE_INVALID';
      await withTx(ctx.pool, async (db) => {
        await db.query(`UPDATE partner_evidence SET storage_state = 'REJECTED_FILE' WHERE id = $1 AND storage_state = 'PENDING_UPLOAD'`, [evidenceId]);
        await audit(db, { actorUserId: actor.userId, action: 'PARTNER_EVIDENCE_FILE_REJECTED', targetType: 'partner_evidence', targetId: evidenceId, metadata: { code }, correlationId: req.id });
      });
      throw new HttpError(422, code, code === 'FILE_TYPE_MISMATCH' ? 'The file content is not a valid PDF, JPEG or PNG' : 'The file is empty, too large or damaged');
    }

    // Network call outside any database transaction (doc 05 §5.4), then record the result.
    await ctx.evidence.put(row.object_key, prepared.bytes, contentType);
    const updated = await withTx(ctx.pool, async (db) => {
      const u = await db.query(
        `UPDATE partner_evidence SET storage_state = 'UPLOADED', uploaded_at = now(), sha256 = $2, byte_size = $3
         WHERE id = $1 AND storage_state = 'PENDING_UPLOAD' RETURNING byte_size, scan_state`,
        [evidenceId, prepared.sha256, prepared.bytes.length],
      );
      if (!u.rowCount) throw new HttpError(409, 'ALREADY_UPLOADED', 'A file was already received for this document');
      await audit(db, { actorUserId: actor.userId, action: 'PARTNER_EVIDENCE_FILE_UPLOADED', targetType: 'partner_evidence', targetId: evidenceId, metadata: { bytes: prepared.bytes.length }, correlationId: req.id });
      return u.rows[0];
    });
    return C.EvidenceUploaded.parse({ evidenceId, fileState: 'UPLOADED', byteSize: updated.byte_size, scanState: updated.scan_state });
  });

  app.post('/v1/ops/partner-evidence/:evidenceId/link', async (req) => {
    const { evidenceId } = z.object({ evidenceId: z.string().uuid() }).parse(req.params);
    const actor = await ctx.requireActor(req);
    if (!canReviewPartnerApplications(actor)) throw forbidden('Operations verifier role required');
    const secret = ctx.config.storage.signingSecret;
    if (!secret) throw new HttpError(409, 'STORAGE_DISABLED', 'No files are stored on this server');
    const row = (await ctx.pool.query(`SELECT storage_state FROM partner_evidence WHERE id = $1`, [evidenceId])).rows[0];
    if (!row) throw notFound('Evidence');
    if (row.storage_state !== 'UPLOADED') throw new HttpError(409, 'NO_FILE', 'No file has been uploaded for this document');
    const { exp, sig } = signEvidenceLink(secret, evidenceId);
    await audit(ctx.pool, { actorUserId: actor.userId, action: 'PARTNER_EVIDENCE_LINK_ISSUED', targetType: 'partner_evidence', targetId: evidenceId, correlationId: req.id });
    const path = `/v1/evidence-files/${evidenceId}?exp=${exp}&sig=${sig}`;
    return C.EvidenceLink.parse({ url: ctx.config.publicApiUrl ? `${ctx.config.publicApiUrl.replace(/\/$/, '')}${path}` : path, expiresAt: new Date(exp * 1000).toISOString() });
  });

  app.get('/v1/evidence-files/:evidenceId', async (req, reply) => {
    const { evidenceId } = z.object({ evidenceId: z.string().uuid() }).parse(req.params);
    const q = z.object({ exp: z.coerce.number().int(), sig: z.string().max(100) }).parse(req.query);
    const secret = ctx.config.storage.signingSecret;
    if (!secret || !verifyEvidenceLink(secret, evidenceId, q.exp, q.sig)) throw new HttpError(403, 'LINK_INVALID', 'This link is invalid or has expired');
    const row = (await ctx.pool.query(`SELECT object_key, content_type, storage_state FROM partner_evidence WHERE id = $1`, [evidenceId])).rows[0];
    if (!row || row.storage_state !== 'UPLOADED') throw notFound('File');
    const bytes = await ctx.evidence.read(row.object_key);
    if (!bytes) throw notFound('File');
    await audit(ctx.pool, { actorUserId: null, action: 'PARTNER_EVIDENCE_FILE_SERVED', targetType: 'partner_evidence', targetId: evidenceId, metadata: { linkExpiry: q.exp }, correlationId: req.id });
    void reply
      .header('content-type', row.content_type)
      .header('content-disposition', 'inline; filename="document"')
      .header('content-security-policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox")
      .header('referrer-policy', 'no-referrer');
    return reply.send(Buffer.from(bytes));
  });
}
