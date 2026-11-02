/**
 * Small key/value persistence port. Native/web apps use AsyncStorage (localStorage on web);
 * tests use the in-memory store. Never store payment data or identity documents here.
 * Session tokens are NOT stored here on native: Clerk keeps them in the OS secure store.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { dump(): Record<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    async get(k) { return data.has(k) ? data.get(k)! : null; },
    async set(k, v) { data.set(k, v); },
    async remove(k) { data.delete(k); },
    dump: () => Object.fromEntries(data),
  };
}

export const KEYS = {
  area: 'lahloba.v1.area',
  locale: 'lahloba.v1.locale',
  devToken: 'lahloba.v1.devToken',
  activeRole: 'lahloba.v1.activeRole',
  checkoutDraft: 'lahloba.v1.checkoutDraft',
} as const;

/** Reads JSON, tolerating corruption (a bad value is discarded, never crashes the app). */
export async function readJson<T>(store: KeyValueStore, key: string, guard: (v: unknown) => v is T): Promise<T | null> {
  try {
    const raw = await store.get(key);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (guard(v)) return v;
  } catch { /* fall through */ }
  await store.remove(key).catch(() => undefined);
  return null;
}
