import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

/**
 * Private evidence storage port.
 *  - "disabled": records the reference only; status STORAGE_DISABLED (no file accepted).
 *  - "dev-metadata-only": development/test; reference only, no bytes (legacy Slice 1 mode).
 *  - "local-disk": development/test; bytes on the API host's disk. Not for serverless hosting.
 *  - "vercel-blob": production; a PRIVATE Vercel Blob store (requires BLOB_READ_WRITE_TOKEN or
 *    Vercel OIDC). Files are never public; reviewers get short-lived signed links through the API.
 * Malware scanning is NOT connected yet: files are marked NOT_SCANNED and the console says so.
 */
export type StorageMode = 'disabled' | 'dev-metadata-only' | 'local-disk' | 'vercel-blob';

export interface EvidenceStorage {
  readonly mode: StorageMode;
  readonly acceptsFiles: boolean;
  allocateObjectKey(applicationId: string): { objectKey: string; storageState: 'STORAGE_DISABLED' | 'DEV_METADATA_ONLY' | 'PENDING_UPLOAD' };
  put(objectKey: string, bytes: Uint8Array, contentType: string): Promise<void>;
  read(objectKey: string): Promise<Uint8Array | null>;
}

const KEY = /^[a-z-]+\/partner-evidence\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/;

function base(mode: StorageMode, acceptsFiles: boolean) {
  return {
    mode,
    acceptsFiles,
    allocateObjectKey(applicationId: string) {
      const prefix = mode === 'disabled' ? 'unstored' : mode === 'dev-metadata-only' ? 'dev-only' : 'evidence';
      const storageState = mode === 'disabled' ? 'STORAGE_DISABLED' as const : mode === 'dev-metadata-only' ? 'DEV_METADATA_ONLY' as const : 'PENDING_UPLOAD' as const;
      return { objectKey: `${prefix}/partner-evidence/${applicationId}/${randomUUID()}`, storageState };
    },
  };
}

export function createEvidenceStorage(mode: StorageMode, opts: { localDir?: string } = {}): EvidenceStorage {
  if (mode === 'local-disk') {
    const root = resolve(opts.localDir ?? '.lahloba-evidence');
    const pathFor = (key: string) => {
      if (!KEY.test(key)) throw new Error('invalid object key');
      return join(root, key);
    };
    return {
      ...base(mode, true),
      async put(key, bytes) {
        const p = pathFor(key);
        await mkdir(dirname(p), { recursive: true, mode: 0o700 });
        await writeFile(p, bytes, { mode: 0o600 });
      },
      async read(key) {
        try { return new Uint8Array(await readFile(pathFor(key))); } catch { return null; }
      },
    };
  }
  if (mode === 'vercel-blob') {
    return {
      ...base(mode, true),
      async put(key, bytes, contentType) {
        if (!KEY.test(key)) throw new Error('invalid object key');
        const { put } = await import('@vercel/blob');
        await put(key, Buffer.from(bytes), { access: 'private', contentType, addRandomSuffix: false, allowOverwrite: false });
      },
      async read(key) {
        if (!KEY.test(key)) throw new Error('invalid object key');
        const { get } = await import('@vercel/blob');
        const r = await get(key, { access: 'private' });
        if (!r || r.statusCode !== 200 || !r.stream) return null;
        return new Uint8Array(await new Response(r.stream).arrayBuffer());
      },
    };
  }
  return {
    ...base(mode, false),
    async put() { throw new Error('This storage mode does not accept files'); },
    async read() { return null; },
  };
}

/** Short-lived signed links for reviewer access, verified by the API (works for every adapter). */
export function signEvidenceLink(secret: string, evidenceId: string, ttlSeconds = 300, now = Date.now()) {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  const sig = createHmac('sha256', secret).update(`${evidenceId}.${exp}`).digest('base64url');
  return { exp, sig };
}

export function verifyEvidenceLink(secret: string, evidenceId: string, exp: number, sig: string, now = Date.now()): boolean {
  if (!Number.isSafeInteger(exp) || exp < Math.floor(now / 1000)) return false;
  const expected = createHmac('sha256', secret).update(`${evidenceId}.${exp}`).digest();
  let given: Buffer;
  try { given = Buffer.from(sig, 'base64url'); } catch { return false; }
  return given.length === expected.length && timingSafeEqual(given, expected);
}
