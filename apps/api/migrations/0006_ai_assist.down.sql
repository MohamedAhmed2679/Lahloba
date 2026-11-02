ALTER TABLE partner_evidence DROP CONSTRAINT IF EXISTS partner_evidence_content_check_kind;
ALTER TABLE partner_evidence DROP COLUMN IF EXISTS content_check, DROP COLUMN IF EXISTS quality_check;
DROP TABLE IF EXISTS dish_embeddings;
