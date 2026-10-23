import { randomUUID } from 'node:crypto';

/**
 * Private evidence storage port. No production object-storage adapter exists yet: the real
 * adapter must issue short-lived signed upload/read URLs to a private bucket, validate type and
 * size server-side, scan for malware and strip metadata (doc 06 §6.3). Until then:
 *  - "disabled": records the reference only; status STORAGE_DISABLED.
 *  - "dev-metadata-only": development/test; records a dev-only key; no bytes are stored.
 * Neither adapter pretends a file was uploaded.
 */
export interface EvidenceStorage {
  readonly mode: 'disabled' | 'dev-metadata-only';
  allocateObjectKey(applicationId: string): { objectKey: string; storageState: 'STORAGE_DISABLED' | 'DEV_METADATA_ONLY' };
}

export function createEvidenceStorage(mode: 'disabled' | 'dev-metadata-only'): EvidenceStorage {
  return {
    mode,
    allocateObjectKey(applicationId) {
      const prefix = mode === 'disabled' ? 'unstored' : 'dev-only';
      return {
        objectKey: `${prefix}/partner-evidence/${applicationId}/${randomUUID()}`,
        storageState: mode === 'disabled' ? 'STORAGE_DISABLED' : 'DEV_METADATA_ONLY',
      };
    },
  };
}
