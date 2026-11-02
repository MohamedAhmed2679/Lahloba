import { createHash } from 'node:crypto';

/**
 * File checks for partner evidence. The declared content type must match the file's actual
 * signature (magic bytes); a renamed HTML or executable never passes as a PDF or photo.
 * Photos have location/camera metadata removed before storage (doc 06 §6.3).
 */
export type EvidenceContentType = 'application/pdf' | 'image/jpeg' | 'image/png';
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel Functions accept request bodies up to 4.5 MB.

export function sniff(bytes: Uint8Array): EvidenceContentType | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return 'application/pdf';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return 'image/png';
  return null;
}

/** Removes JPEG APPn metadata segments (EXIF/GPS, XMP, IPTC) except APP0 (JFIF) and APP14 (Adobe colour). */
export function stripJpegMetadata(input: Uint8Array): Uint8Array {
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i + 4 <= input.length) {
    if (input[i] !== 0xff) throw new Error('Corrupt JPEG');
    const marker = input[i + 1]!;
    if (marker === 0xda) { // start of scan: copy the rest verbatim
      for (let j = i; j < input.length; j++) out.push(input[j]!);
      return Uint8Array.from(out);
    }
    const len = (input[i + 2]! << 8) | input[i + 3]!;
    if (len < 2 || i + 2 + len > input.length) throw new Error('Corrupt JPEG');
    const isApp = marker >= 0xe1 && marker <= 0xef && marker !== 0xee;
    const isComment = marker === 0xfe;
    if (!isApp && !isComment) for (let j = i; j < i + 2 + len; j++) out.push(input[j]!);
    i += 2 + len;
  }
  throw new Error('Corrupt JPEG');
}

/** Removes PNG text and EXIF chunks (tEXt, iTXt, zTXt, eXIf, tIME). */
export function stripPngMetadata(input: Uint8Array): Uint8Array {
  const drop = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']);
  const parts: Uint8Array[] = [input.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= input.length) {
    const len = ((input[i]! << 24) | (input[i + 1]! << 16) | (input[i + 2]! << 8) | input[i + 3]!) >>> 0;
    const type = String.fromCharCode(input[i + 4]!, input[i + 5]!, input[i + 6]!, input[i + 7]!);
    const end = i + 12 + len;
    if (end > input.length) throw new Error('Corrupt PNG');
    if (!drop.has(type)) parts.push(input.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function prepareEvidence(declared: EvidenceContentType, bytes: Uint8Array): { bytes: Uint8Array; sha256: string } {
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) throw Object.assign(new Error('size'), { code: 'FILE_SIZE' });
  const actual = sniff(bytes);
  if (actual !== declared) throw Object.assign(new Error('type'), { code: 'FILE_TYPE_MISMATCH' });
  let clean = bytes;
  try {
    if (actual === 'image/jpeg') clean = stripJpegMetadata(bytes);
    else if (actual === 'image/png') clean = stripPngMetadata(bytes);
  } catch {
    throw Object.assign(new Error('corrupt'), { code: 'FILE_CORRUPT' });
  }
  return { bytes: clean, sha256: createHash('sha256').update(clean).digest('hex') };
}
