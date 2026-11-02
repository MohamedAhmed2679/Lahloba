-- 0006: Hugging Face assisted features (all advisory; nothing here decides on its own).

-- Semantic dish search: one cached embedding per dish and model. text_hash detects edits.
CREATE TABLE dish_embeddings (
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  model text NOT NULL CHECK (length(model) BETWEEN 3 AND 200),
  text_hash text NOT NULL CHECK (text_hash ~ '^[0-9a-f]{64}$'),
  vector real[] NOT NULL CHECK (array_length(vector, 1) BETWEEN 8 AND 4096),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dish_id, model)
);

-- Photo checks on partner uploads, shown to reviewers as advice only.
--   quality_check: local analysis on our server (image never leaves it).
--   content_check: Hugging Face vision model, kitchen photos only (never identity documents).
ALTER TABLE partner_evidence
  ADD COLUMN quality_check jsonb,
  ADD COLUMN content_check jsonb,
  ADD CONSTRAINT partner_evidence_content_check_kind
    CHECK (content_check IS NULL OR evidence_type = 'KITCHEN_PHOTO');
