import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Handoff codes (D04/D05). The static party shows a 6-digit code; the courier types it in.
 * Codes are derived with an HMAC from a server secret, so they can be shown again to the party
 * that holds them without being stored in plaintext. The database keeps only a separate keyed hash.
 */
export type CodePurpose = 'PICKUP' | 'DROPOFF';
export const MAX_CODE_ATTEMPTS = 5;

export function handoffCode(secret: string, subjectId: string, purpose: CodePurpose): string {
  const mac = createHmac('sha256', secret).update(`code:${purpose}:${subjectId}`).digest();
  return String(mac.readUInt32BE(0) % 1_000_000).padStart(6, '0');
}

export function codeHash(secret: string, subjectId: string, purpose: CodePurpose, code: string): string {
  return createHmac('sha256', secret).update(`hash:${purpose}:${subjectId}:${code}`).digest('hex');
}

export function codeMatches(secret: string, subjectId: string, purpose: CodePurpose, code: string, storedHash: string): boolean {
  const a = Buffer.from(codeHash(secret, subjectId, purpose, code), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
