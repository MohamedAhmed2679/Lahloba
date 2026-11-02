import type { TestContext } from '../src/testing';

export async function call(
  ctx: TestContext,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT',
  url: string,
  opts: { token?: string; body?: unknown; key?: string | null } = {},
) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (method !== 'GET' && opts.key !== null) headers['idempotency-key'] = opts.key ?? ctx.key();
  const res = await ctx.app.inject({ method, url, headers, ...(opts.body !== undefined ? { payload: opts.body as object } : {}) });
  return { status: res.statusCode, body: res.json() as any, headers: res.headers, raw: res.body };
}

/** Minimal valid PDF bytes for upload tests. */
export const TINY_PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

/** Registers a document reference and uploads its bytes (the full partner flow). */
export async function addEvidence(ctx: TestContext, token: string, applicationId: string, evidenceType = 'NATIONAL_ID') {
  const reg = await call(ctx, 'POST', `/v1/partner-applications/${applicationId}/evidence`, { token, body: { evidenceType, contentType: 'application/pdf', byteSize: TINY_PDF.length } });
  if (reg.status !== 201) throw new Error(`register failed: ${reg.raw}`);
  const up = await ctx.app.inject({ method: 'PUT', url: reg.body.upload.uploadPath, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/pdf' }, payload: TINY_PDF });
  if (up.statusCode !== 200) throw new Error(`upload failed: ${up.body}`);
  return reg.body.evidenceId as string;
}
