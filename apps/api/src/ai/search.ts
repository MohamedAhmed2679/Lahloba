import { createHash } from 'node:crypto';
import type { Queryable } from '../db';
import { AiUnavailable, cosine, type HuggingFace } from './huggingface';

export interface SearchDoc { key: string; dishId: string; text: string }
type Log = { warn: (o: object, m: string) => void };

/** Arabic-aware normalisation for word matching: strips diacritics/tatweel, unifies alef/yaa/taa marbuta. */
export function normalizeText(s: string): string {
  return s.toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Share of the query's words found in the document (prefix match, so "molo" finds "molokhia"). */
export function keywordScore(query: string, text: string): number {
  const q = normalizeText(query).split(' ').filter((w) => w.length >= 2);
  if (!q.length) return 0;
  const words = normalizeText(text).split(' ');
  const hits = q.filter((w) => words.some((d) => d.startsWith(w) || (w.length >= 4 && d.includes(w)))).length;
  return hits / q.length;
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Ranks documents for a query. With Hugging Face: cosine similarity of multilingual embeddings
 * (dish vectors cached in dish_embeddings, recomputed only when the text changes), with a small
 * bonus for literal word matches. Without it, or if the call fails: keyword ranking.
 */
export async function semanticRank(db: Queryable, ai: HuggingFace | null, query: string, docs: SearchDoc[], log?: Log): Promise<{ mode: 'semantic' | 'keyword'; keys: string[] }> {
  const keyword = () => ({
    mode: 'keyword' as const,
    keys: docs.map((d) => ({ k: d.key, s: keywordScore(query, d.text) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.k),
  });
  if (!ai || !docs.length) return keyword();
  try {
    const byDish = new Map<string, string>();
    for (const d of docs) byDish.set(d.dishId, d.text);
    const dishIds = [...byDish.keys()];
    const cached = new Map((await db.query<{ dish_id: string; text_hash: string; vector: number[] }>(
      `SELECT dish_id, text_hash, vector FROM dish_embeddings WHERE model = $1 AND dish_id = ANY($2::uuid[])`, [ai.embedModel, dishIds])).rows
      .map((r) => [r.dish_id, r]));
    const stale = dishIds.filter((id) => cached.get(id)?.text_hash !== sha(byDish.get(id)!));
    for (let i = 0; i < stale.length; i += 32) {
      const batch = stale.slice(i, i + 32);
      const vecs = await ai.embed(batch.map((id) => byDish.get(id)!), 'passage');
      for (const [j, id] of batch.entries()) {
        const h = sha(byDish.get(id)!);
        await db.query(
          `INSERT INTO dish_embeddings (dish_id, model, text_hash, vector) VALUES ($1, $2, $3, $4)
           ON CONFLICT (dish_id, model) DO UPDATE SET text_hash = EXCLUDED.text_hash, vector = EXCLUDED.vector, created_at = now()`,
          [id, ai.embedModel, h, vecs[j]]);
        cached.set(id, { dish_id: id, text_hash: h, vector: vecs[j]! });
      }
    }
    const [qv] = await ai.embed([query], 'query');
    const scored = docs.map((d) => ({ k: d.key, s: cosine(qv!, cached.get(d.dishId)!.vector.map(Number)) + 0.15 * keywordScore(query, d.text) }));
    // Keep results that are plausibly related: within a margin of the best match, or a literal hit.
    const best = Math.max(...scored.map((x) => x.s));
    return { mode: 'semantic', keys: scored.filter((x) => x.s >= best - 0.12).sort((a, b) => b.s - a.s).map((x) => x.k) };
  } catch (e) {
    if (!(e instanceof AiUnavailable)) throw e;
    log?.warn({ reason: e.message }, 'semantic search unavailable; using keyword search');
    return keyword();
  }
}
