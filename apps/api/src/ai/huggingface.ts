/**
 * Hugging Face Inference client (server side only; the token never reaches an app).
 *  - translate: Helsinki-NLP opus-mt Arabic<->English on HF Inference.
 *  - embed: multilingual sentence embeddings (default intfloat/multilingual-e5-large).
 *  - vision: an OpenAI-compatible chat model with image input via the Inference Providers router.
 * Every call has a timeout and throws AiUnavailable on any failure; callers degrade gracefully.
 */
export class AiUnavailable extends Error {
  constructor(message: string) { super(message); this.name = 'AiUnavailable'; }
}

export type Lang = 'en' | 'ar';
type Fetch = typeof fetch;

export interface HuggingFace {
  translate(text: string, from: Lang, to: Lang): Promise<string>;
  embed(texts: string[], kind: 'query' | 'passage'): Promise<number[][]>;
  vision(prompt: string, image: { bytes: Uint8Array; contentType: string }): Promise<string>;
  readonly embedModel: string;
}

const ROUTER = 'https://router.huggingface.co';
export const translationModel = (from: Lang, to: Lang) => `Helsinki-NLP/opus-mt-${from}-${to}`;

export function createHuggingFace(opts: { token: string; embedModel: string; visionModel: string; fetchImpl?: Fetch; timeoutMs?: number }): HuggingFace {
  const f = opts.fetchImpl ?? fetch;
  const call = async (url: string, body: unknown, timeoutMs = opts.timeoutMs ?? 12_000): Promise<unknown> => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await f(url, {
        method: 'POST', signal: ctl.signal,
        headers: { authorization: `Bearer ${opts.token}`, 'content-type': 'application/json', 'x-wait-for-model': 'true' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new AiUnavailable(`Hugging Face answered ${r.status}`);
      return await r.json();
    } catch (e) {
      if (e instanceof AiUnavailable) throw e;
      throw new AiUnavailable((e as Error).name === 'AbortError' ? 'Hugging Face timed out' : 'Hugging Face could not be reached');
    } finally { clearTimeout(timer); }
  };

  return {
    embedModel: opts.embedModel,
    async translate(text, from, to) {
      if (from === to) return text;
      const out = await call(`${ROUTER}/hf-inference/models/${translationModel(from, to)}`, { inputs: text });
      const first = Array.isArray(out) ? out[0] : out;
      const t = (first as { translation_text?: unknown } | undefined)?.translation_text;
      if (typeof t !== 'string' || !t.trim()) throw new AiUnavailable('Unexpected translation response');
      return t.trim();
    },
    async embed(texts, kind) {
      if (!texts.length) return [];
      // e5 models expect "query: " / "passage: " prefixes.
      const prefixed = /e5/i.test(opts.embedModel) ? texts.map((t) => `${kind}: ${t}`) : texts;
      const out = await call(`${ROUTER}/hf-inference/models/${opts.embedModel}`, { inputs: prefixed, normalize: true }, 20_000);
      return toVectors(out, texts.length);
    },
    async vision(prompt, image) {
      const url = `data:${image.contentType};base64,${Buffer.from(image.bytes).toString('base64')}`;
      const out = await call(`${ROUTER}/v1/chat/completions`, {
        model: opts.visionModel, max_tokens: 160, temperature: 0,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url } }] }],
      }, 25_000) as { choices?: Array<{ message?: { content?: unknown } }> };
      const c = out.choices?.[0]?.message?.content;
      if (typeof c !== 'string') throw new AiUnavailable('Unexpected vision response');
      return c;
    },
  };
}

/** Accepts pooled vectors (n x d) or token vectors (n x tokens x d, mean-pooled here); returns unit vectors. */
export function toVectors(out: unknown, n: number): number[][] {
  if (!Array.isArray(out)) throw new AiUnavailable('Unexpected embedding response');
  let rows: unknown[] = out;
  if (n === 1 && typeof out[0] === 'number') rows = [out];
  const vecs = rows.map((r) => {
    if (Array.isArray(r) && Array.isArray(r[0])) {
      const toks = r as number[][];
      return toks[0]!.map((_, j) => toks.reduce((s, t) => s + (t[j] ?? 0), 0) / toks.length);
    }
    if (!Array.isArray(r) || typeof r[0] !== 'number') throw new AiUnavailable('Unexpected embedding response');
    return r as number[];
  });
  if (vecs.length !== n) throw new AiUnavailable('Embedding count mismatch');
  return vecs.map(unit);
}

export function unit(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

export const cosine = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);

/** Pulls the first JSON object out of a model reply (models sometimes wrap it in prose or fences). */
export function firstJson(text: string): Record<string, unknown> | null {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return null;
  try { const v = JSON.parse(m[0]); return v && typeof v === 'object' ? v as Record<string, unknown> : null; } catch { return null; }
}
