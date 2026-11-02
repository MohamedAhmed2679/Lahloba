-- 0005: real private evidence uploads. An evidence row is created PENDING_UPLOAD, then becomes
-- UPLOADED only after the server has received the bytes and validated size and file signature.
-- Rollback: 0005_evidence_uploads.down.sql.
ALTER TABLE partner_evidence DROP CONSTRAINT partner_evidence_storage_state_check;
ALTER TABLE partner_evidence ADD CONSTRAINT partner_evidence_storage_state_check
  CHECK (storage_state IN ('STORAGE_DISABLED','DEV_METADATA_ONLY','PENDING_UPLOAD','UPLOADED','REJECTED_FILE'));
ALTER TABLE partner_evidence ADD COLUMN sha256 text CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$');
ALTER TABLE partner_evidence ADD COLUMN uploaded_at timestamptz;
ALTER TABLE partner_evidence ADD COLUMN scan_state text NOT NULL DEFAULT 'NOT_SCANNED' CHECK (scan_state IN ('NOT_SCANNED','CLEAN','INFECTED'));
ALTER TABLE partner_evidence ADD CONSTRAINT partner_evidence_uploaded_consistent
  CHECK ((storage_state = 'UPLOADED') = (uploaded_at IS NOT NULL AND sha256 IS NOT NULL));
