import { MAX_EVIDENCE_BYTES } from '@lahloba/contracts';

export type EvidenceFileType = 'application/pdf' | 'image/jpeg' | 'image/png';
export interface PickedFile { bytes: Uint8Array; contentType: EvidenceFileType; name: string }
export type FileSource = 'document' | 'photo' | 'camera';
/** Resolves null when the person cancels; throws { code } for problems the screen explains. */
export type PickFile = (source: FileSource) => Promise<PickedFile | null>;

const ALLOWED: EvidenceFileType[] = ['application/pdf', 'image/jpeg', 'image/png'];

export function normalizePicked(input: { bytes: Uint8Array; mimeType: string | null; name: string }): PickedFile {
  const byName = /\.pdf$/i.test(input.name) ? 'application/pdf' : /\.png$/i.test(input.name) ? 'image/png' : /\.jpe?g$/i.test(input.name) ? 'image/jpeg' : null;
  const raw = (input.mimeType ?? byName ?? '').toLowerCase().replace('image/jpg', 'image/jpeg');
  if (!ALLOWED.includes(raw as EvidenceFileType)) throw Object.assign(new Error('type'), { code: 'UNSUPPORTED_FILE' });
  if (input.bytes.length === 0) throw Object.assign(new Error('empty'), { code: 'FILE_EMPTY' });
  if (input.bytes.length > MAX_EVIDENCE_BYTES) throw Object.assign(new Error('size'), { code: 'FILE_TOO_LARGE' });
  return { bytes: input.bytes, contentType: raw as EvidenceFileType, name: input.name };
}
