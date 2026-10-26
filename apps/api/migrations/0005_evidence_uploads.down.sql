-- Rollback of 0005. Rows in the new states would violate the old constraint, so they are reset.
ALTER TABLE partner_evidence DROP CONSTRAINT IF EXISTS partner_evidence_uploaded_consistent;
ALTER TABLE partner_evidence DROP COLUMN IF EXISTS scan_state;
ALTER TABLE partner_evidence DROP COLUMN IF EXISTS uploaded_at;
ALTER TABLE partner_evidence DROP COLUMN IF EXISTS sha256;
ALTER TABLE partner_evidence DROP CONSTRAINT IF EXISTS partner_evidence_storage_state_check;
UPDATE partner_evidence SET storage_state = 'STORAGE_DISABLED' WHERE storage_state IN ('PENDING_UPLOAD','UPLOADED','REJECTED_FILE');
ALTER TABLE partner_evidence ADD CONSTRAINT partner_evidence_storage_state_check
  CHECK (storage_state IN ('STORAGE_DISABLED','DEV_METADATA_ONLY','UPLOADED'));
