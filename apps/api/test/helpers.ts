import type { TestContext } from '../src/testing';

export async function call(
  ctx: TestContext,
  method: 'GET' | 'POST' | 'PATCH',
  url: string,
  opts: { token?: string; body?: unknown; key?: string | null } = {},
) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (method !== 'GET' && opts.key !== null) headers['idempotency-key'] = opts.key ?? ctx.key();
  const res = await ctx.app.inject({ method, url, headers, ...(opts.body !== undefined ? { payload: opts.body as object } : {}) });
  return { status: res.statusCode, body: res.json() as any, headers: res.headers, raw: res.body };
}
