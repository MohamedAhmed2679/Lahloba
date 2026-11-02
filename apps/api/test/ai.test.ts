import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AiUnavailable, createHuggingFace, firstJson, toVectors, type HuggingFace } from '../src/ai/huggingface';
import { assessQuality } from '../src/ai/imageQuality';
import { keywordScore, normalizeText } from '../src/ai/search';
import { TEST_DB_ADMIN_URL, createTestContext, type TestContext } from '../src/testing';
import { call } from './helpers';

/** PNG test images: flat grey (blank), and a sharp checkerboard (a readable photo stand-in). */
function png(w: number, h: number, px: (x: number, y: number) => number): Buffer {
  const img = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; const v = px(x, y);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  return PNG.sync.write(img);
}
const BLANK = png(640, 480, () => 128);
const SHARP = png(640, 480, (x, y) => ((Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? 230 : 30));
const DARK = png(640, 480, (x, y) => ((Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? 30 : 5));
const BLURRY = png(640, 480, (x) => Math.round(60 + 120 * (x / 640)));

describe('photo quality (local, unit)', () => {
  it('flags blank, dark and blurry photos and passes a sharp one', () => {
    expect(assessQuality(BLANK, 'image/png').issues).toContain('BLANK');
    expect(assessQuality(DARK, 'image/png').issues).toContain('TOO_DARK');
    expect(assessQuality(BLURRY, 'image/png').issues).toContain('BLURRY');
    const ok = assessQuality(SHARP, 'image/png');
    expect(ok).toMatchObject({ ok: true, issues: [], width: 640, height: 480 });
  });
});

describe('Hugging Face client (unit)', () => {
  it('calls the router with the token, model-specific URLs and e5 prefixes', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url); const body = JSON.parse(String(init?.body));
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer hf_test');
      if (u.endsWith('/Helsinki-NLP/opus-mt-en-ar')) return new Response(JSON.stringify([{ translation_text: 'ملوخية بالفراخ' }]));
      if (u.includes('multilingual-e5')) { expect(body.inputs[0]).toMatch(/^query: /); return new Response(JSON.stringify([[3, 4]])); }
      return new Response('nope', { status: 500 });
    });
    const hf = createHuggingFace({ token: 'hf_test', embedModel: 'intfloat/multilingual-e5-large', visionModel: 'v', fetchImpl: fetchImpl as typeof fetch });
    expect(await hf.translate('Molokhia with chicken', 'en', 'ar')).toBe('ملوخية بالفراخ');
    expect(await hf.embed(['soup'], 'query')).toEqual([[0.6, 0.8]]);
    await expect(hf.vision('x', { bytes: new Uint8Array([1]), contentType: 'image/png' })).rejects.toBeInstanceOf(AiUnavailable);
  });
  it('mean-pools token embeddings and reads JSON out of chatty replies', () => {
    expect(toVectors([[[1, 0], [0, 1]]], 1)[0]!.map((x) => Math.round(x * 1000) / 1000)).toEqual([0.707, 0.707]);
    expect(firstJson('Sure! ```json\n{"kitchen":"yes","note":"stove"}\n```')).toEqual({ kitchen: 'yes', note: 'stove' });
    expect(firstJson('no json here')).toBeNull();
  });
  it('matches Arabic words regardless of diacritics and letter variants', () => {
    expect(normalizeText('مُلوخيّة')).toBe('ملوخيه');
    expect(keywordScore('ملوخية', 'Molokhia . مُلوخيّة بالفراخ')).toBe(1);
    expect(keywordScore('molo', 'Molokhia with chicken')).toBe(1);
    expect(keywordScore('pizza', 'Molokhia with chicken')).toBe(0);
  });
});

/** Fake model: embeds by keyword buckets so "something green with chicken" lands on molokhia. */
function fakeAi(): HuggingFace & { calls: string[] } {
  const calls: string[] = [];
  const dims = ['molokhia|ملوخ|green|leaf', 'chicken|فراخ|دجاج', 'soup|شوربه|شوربة|lentil|عدس', 'pasta|مكرونه|tomato', 'grill|tawook|طاووق|مشوي'];
  const vec = (t: string) => { const v = dims.map((d) => (new RegExp(d, 'i').test(t) ? 1 : 0)); return [...(v.some(Boolean) ? v : [0, 0, 0, 0, 0.01]), 0, 0, 0]; };
  return {
    calls, embedModel: 'fake-embed',
    async translate(text, from, to) { calls.push(`translate:${from}-${to}`); return `[${to}] ${text}`; },
    async embed(texts, kind) { calls.push(`embed:${kind}:${texts.length}`); return texts.map((t) => { const v = vec(t); const n = Math.hypot(...v) || 1; return v.map((x) => x / n); }); },
    async vision(prompt) { calls.push('vision'); expect(prompt).toMatch(/kitchen/); return '{"kitchen": "no", "note": "A photo of a car"}'; },
  };
}

describe.skipIf(!TEST_DB_ADMIN_URL)('assisted features (Hugging Face) over the API', () => {
  let on: TestContext; let off: TestContext; let ai: ReturnType<typeof fakeAi>;
  beforeAll(async () => {
    ai = fakeAi();
    [on, off] = await Promise.all([createTestContext({ ai }), createTestContext()]);
  });
  afterAll(async () => { await on?.close(); await off?.close(); });

  it('reports which features are on', async () => {
    expect((await call(on, 'GET', '/v1/features')).body).toEqual({ translate: true, semanticSearch: true, kitchenPhotoCheck: true, photoQualityCheck: true });
    expect((await call(off, 'GET', '/v1/features')).body).toEqual({ translate: false, semanticSearch: false, kitchenPhotoCheck: false, photoQualityCheck: true });
  });

  it('drafts menu translations for partners only, and says plainly when it is off', async () => {
    const body = { text: 'Molokhia with chicken', from: 'en', to: 'ar' };
    expect((await call(on, 'POST', '/v1/ai/translate', { body })).status).toBe(401);
    expect((await call(on, 'POST', '/v1/ai/translate', { token: await on.token('just-a-customer'), body })).status).toBe(403);
    const chef = await on.token('sample-chef-a');
    const r = await call(on, 'POST', '/v1/ai/translate', { token: chef, body });
    expect(r.body).toEqual({ text: '[ar] Molokhia with chicken', model: 'Helsinki-NLP/opus-mt-en-ar', draft: true });
    const offR = await call(off, 'POST', '/v1/ai/translate', { token: await off.token('sample-chef-a'), body });
    expect(offR.status).toBe(503);
    expect(offR.body.error.code).toBe('AI_OFF');
  });

  it('searches by meaning with embeddings cached per dish, and by words without Hugging Face', async () => {
    const area = on.seed!.area.maadi;
    const q = (ctx: TestContext, text: string) => call(ctx, 'GET', `/v1/catalog/search?area=${ctx.seed!.area.maadi}&q=${encodeURIComponent(text)}`);
    const sem = await q(on, 'something green with chicken');
    expect(sem.body.mode).toBe('semantic');
    expect(sem.body.items[0].title.en).toBe('Molokhia with chicken');
    const embedsAfterFirst = ai.calls.filter((c) => c.startsWith('embed:passage')).length;
    await q(on, 'شوربة');
    expect(ai.calls.filter((c) => c.startsWith('embed:passage')).length).toBe(embedsAfterFirst); // dish vectors reused
    const kw = await q(off, 'ملوخية');
    expect(kw.body.mode).toBe('keyword');
    expect(kw.body.items.map((i: { title: { en: string } }) => i.title.en)).toContain('Molokhia with chicken');
    expect((await q(off, 'pizza')).body.items).toEqual([]);
    expect((await call(on, 'GET', `/v1/catalog/search?area=${area}&q=a`)).status).toBe(400);
  });

  it('falls back to word search when Hugging Face fails', async () => {
    const failing = { ...fakeAi(), embedModel: 'broken', embed: async () => { throw new AiUnavailable('down'); } };
    const ctx = await createTestContext({ ai: failing });
    try {
      const r = await call(ctx, 'GET', `/v1/catalog/search?area=${ctx.seed!.area.maadi}&q=molokhia`);
      expect(r.body.mode).toBe('keyword');
      expect(r.body.items.length).toBeGreaterThan(0);
    } finally { await ctx.close(); }
  });

  it('checks uploaded photos: quality locally for every image, content only for kitchen photos', async () => {
    const applicant = await on.token('photo-chef');
    const ops = await on.token('sample-ops-reviewer');
    const a = await call(on, 'POST', '/v1/partner-applications', { token: applicant, body: {
      kind: 'CHEF', chef: { publicName: 'Photo Kitchen', publicAreaId: on.seed!.area.maadi, serviceAreaIds: [on.seed!.area.maadi], kitchenAddress: { addressText: '1 Photo Street', areaId: on.seed!.area.maadi } } } });
    const send = async (evidenceType: string, bytes: Buffer) => {
      const reg = await call(on, 'POST', `/v1/partner-applications/${a.body.id}/evidence`, { token: applicant, body: { evidenceType, contentType: 'image/png', byteSize: bytes.length } });
      const up = await on.app.inject({ method: 'PUT', url: reg.body.upload.uploadPath, headers: { authorization: `Bearer ${applicant}`, 'content-type': 'image/png' }, payload: bytes });
      expect(up.statusCode).toBe(200);
      return reg.body.evidenceId as string;
    };
    const visionBefore = ai.calls.filter((c) => c === 'vision').length;
    const idDoc = await send('NATIONAL_ID', BLANK);
    expect(ai.calls.filter((c) => c === 'vision').length).toBe(visionBefore); // identity documents never leave the server
    const kitchen = await send('KITCHEN_PHOTO', SHARP);
    expect(ai.calls.filter((c) => c === 'vision').length).toBe(visionBefore + 1);
    const detail = await call(on, 'GET', `/v1/ops/partner-applications/${a.body.id}`, { token: ops });
    const ev = (id: string) => detail.body.evidence.find((e: { evidenceId: string }) => e.evidenceId === id);
    expect(ev(idDoc)).toMatchObject({ qualityCheck: { ok: false, issues: ['BLANK'] }, contentCheck: null });
    expect(ev(kitchen)).toMatchObject({ qualityCheck: { ok: true, issues: [] }, contentCheck: { state: 'LOOKS_WRONG', note: 'A photo of a car' } });
  });
});
