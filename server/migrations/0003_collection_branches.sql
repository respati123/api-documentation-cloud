-- A branch is one version line of one collection (a top-level folder or request of the workspace tree).
-- Each branch has its own head. The workspace-level head keeps working for clients that have not moved to branches.
CREATE TABLE IF NOT EXISTS collection_branches (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  collection_key TEXT NOT NULL,
  name TEXT NOT NULL,
  head_commit_id TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, collection_key, name)
);

ALTER TABLE commits ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES collection_branches(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS commits_branch_id_idx ON commits (branch_id);
