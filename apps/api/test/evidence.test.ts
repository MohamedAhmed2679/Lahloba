import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signEvidenceLink } from '../src/storage/evidence';
import { sniff, stripJpegMetadata, stripPngMetadata } from '../src/storage/files';
import { TEST_DB_ADMIN_URL, createTestContext, type TestContext } from '../src/testing';
import { TINY_PDF, call } from './helpers';

// Minimal JPEG: SOI, APP1 "Exif" with a fake GPS payload, APP0 JFIF, SOS + data, EOI.
const seg = (marker: number, payload: number[]) => [0xff, marker, ((payload.length + 2) >> 8) & 0xff, (payload.length + 2) & 0xff, ...payload];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const JPEG_WITH_GPS = Uint8Array.from([
  0xff, 0xd8,
  ...seg(0xe1, [...ascii('Exif'), 0, 0, ...ascii('GPS 30.0566N 31.3301E home')]),
  ...seg(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
  ...seg(0xda, [1, 1, 0, 0, 0x3f, 0]), 0x11, 0x22, 0x33, 0xff, 0xd9,
]);

describe('file checks (unit)', () => {
  it('detects real file signatures, not names', () => {
    expect(sniff(TINY_PDF)).toBe('application/pdf');
    expect(sniff(JPEG_WITH_GPS)).toBe('image/jpeg');
    expect(sniff(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
  });
  it('strips EXIF/GPS from JPEGs but keeps the image data', () => {
    const out = stripJpegMetadata(JPEG_WITH_GPS);
    expect(Buffer.from(out).includes('GPS')).toBe(false);
    expect(Buffer.from(out).includes('JFIF')).toBe(true);
    expect(Array.from(out.slice(-5))).toEqual([0x11, 0x22, 0x33, 0xff, 0xd9]);
    expect(out[0]).toBe(0xff);
  });
  it('strips PNG text chunks', () => {
    const chunk = (type: string, data: number[]) => { const len = data.length; return [len >>> 24, (len >> 16) & 255, (len >> 8) & 255, len & 255, ...ascii(type), ...data, 0, 0, 0, 0]; };
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', Array(13).fill(0)), ...chunk('tEXt', ascii('Comment\0secret')), ...chunk('IEND', [])]);
    const out = stripPngMetadata(png);
    expect(Buffer.from(out).includes('secret')).toBe(false);
    expect(Buffer.from(out).includes('IEND')).toBe(true);
  });
});

describe.skipIf(!TEST_DB_ADMIN_URL)('private evidence upload and reviewer viewing', () => {
  let ctx: TestContext;
  let applicant: string;
  let ops: string;
  let appId: string;
  beforeAll(async () => {
    ctx = await createTestContext();
    applicant = await ctx.token('doc-chef');
    ops = await ctx.token('sample-ops-reviewer');
    const a = await call(ctx, 'POST', '/v1/partner-applications', { token: applicant, body: {
      kind: 'CHEF', chef: { publicName: 'Doc Kitchen', publicAreaId: ctx.seed!.area.maadi, serviceAreaIds: [ctx.seed!.area.maadi], kitchenAddress: { addressText: '1 Doc Street', areaId: ctx.seed!.area.maadi } } } });
    appId = a.body.id;
  });
  afterAll(async () => ctx?.close());

  const register = async (contentType: string, token = applicant) =>
    call(ctx, 'POST', `/v1/partner-applications/${appId}/evidence`, { token, body: { evidenceType: 'NATIONAL_ID', contentType, byteSize: 100 } });
  const upload = (path: string, bytes: Uint8Array | Buffer, contentType: string, token = applicant) =>
    ctx.app.inject({ method: 'PUT', url: path, headers: { authorization: `Bearer ${token}`, 'content-type': contentType }, payload: Buffer.from(bytes) });

  it('accepts a real PDF once, stores it privately and records its hash', async () => {
    const reg = await register('application/pdf');
    const up = await upload(reg.body.upload.uploadPath, TINY_PDF, 'application/pdf');
    expect(up.statusCode).toBe(200);
    expect(up.json()).toMatchObject({ fileState: 'UPLOADED', byteSize: TINY_PDF.length, scanState: 'NOT_SCANNED' });
    expect((await upload(reg.body.upload.uploadPath, TINY_PDF, 'application/pdf')).json().error.code).toBe('ALREADY_UPLOADED');
    const row = (await ctx.pool.query(`SELECT sha256 FROM partner_evidence WHERE id = $1`, [reg.body.evidenceId])).rows[0];
    expect(row.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a disguised file and marks it rejected', async () => {
    const reg = await register('application/pdf');
    const up = await upload(reg.body.upload.uploadPath, Buffer.from('<html><script>alert(1)</script></html>'), 'application/pdf');
    expect(up.statusCode).toBe(422);
    expect(up.json().error.code).toBe('FILE_TYPE_MISMATCH');
    const row = (await ctx.pool.query(`SELECT storage_state FROM partner_evidence WHERE id = $1`, [reg.body.evidenceId])).rows[0];
    expect(row.storage_state).toBe('REJECTED_FILE');
  });

  it('refuses other users, unsupported types and oversized bodies', async () => {
    const reg = await register('image/jpeg');
    const stranger = await ctx.token('stranger');
    expect((await upload(reg.body.upload.uploadPath, JPEG_WITH_GPS, 'image/jpeg', stranger)).statusCode).toBe(404);
    expect((await upload(reg.body.upload.uploadPath, Buffer.from('x'), 'text/html')).statusCode).toBe(415);
    expect((await upload(reg.body.upload.uploadPath, Buffer.alloc(4 * 1024 * 1024 + 10, 0xff), 'image/jpeg')).statusCode).toBe(413);
  });

  it('reviewers open files only through short-lived signed links; GPS metadata is gone; every access is audited', async () => {
    const reg = await register('image/jpeg');
    expect((await upload(reg.body.upload.uploadPath, JPEG_WITH_GPS, 'image/jpeg')).statusCode).toBe(200);
    expect((await call(ctx, 'POST', `/v1/ops/partner-evidence/${reg.body.evidenceId}/link`, { token: applicant, body: {} })).status).toBe(403);
    const link = await call(ctx, 'POST', `/v1/ops/partner-evidence/${reg.body.evidenceId}/link`, { token: ops, body: {} });
    expect(link.status).toBe(200);
    const file = await ctx.app.inject({ method: 'GET', url: link.body.url });
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toBe('image/jpeg');
    expect(file.headers['x-content-type-options']).toBe('nosniff');
    expect(file.rawPayload.includes('GPS')).toBe(false);
    expect(file.rawPayload.includes('JFIF')).toBe(true);
    // Tampered or expired links fail.
    expect((await ctx.app.inject({ method: 'GET', url: link.body.url.replace(/sig=./, 'sig=A') })).statusCode).toBe(403);
    const old = signEvidenceLink('test-storage-secret-'.padEnd(40, 'y'), reg.body.evidenceId, 60, Date.now() - 3600_000);
    expect((await ctx.app.inject({ method: 'GET', url: `/v1/evidence-files/${reg.body.evidenceId}?exp=${old.exp}&sig=${old.sig}` })).statusCode).toBe(403);
    const audits = await ctx.pool.query(`SELECT action FROM audit_events WHERE target_id = $1 ORDER BY occurred_at`, [reg.body.evidenceId]);
    expect(audits.rows.map((r) => r.action)).toEqual(['PARTNER_EVIDENCE_FILE_UPLOADED', 'PARTNER_EVIDENCE_LINK_ISSUED', 'PARTNER_EVIDENCE_FILE_SERVED']);
  });

  it('public routes never expose evidence', async () => {
    const r = await call(ctx, 'GET', `/v1/catalog/offers?area=${ctx.seed!.area.maadi}&mode=EAT_NOW`);
    expect(r.raw).not.toMatch(/partner-evidence|evidence-files/);
  });
});
