-- A deleted collection keeps its branches and their commits, so its history is not lost. Only live branches are listed and used,
-- and a collection can be added again under the same key, so the unique name applies to live branches only.
ALTER TABLE collection_branches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE collection_branches DROP CONSTRAINT IF EXISTS collection_branches_workspace_id_collection_key_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS collection_branches_live_name_idx ON collection_branches (workspace_id, collection_key, name) WHERE deleted_at IS NULL;
