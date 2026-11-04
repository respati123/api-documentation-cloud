-- Workspace variables with their own revision. The workspace head still carries variables for clients that have not moved on,
-- so a workspace with no row here reads its variables from the head at revision 0.
CREATE TABLE IF NOT EXISTS workspace_variables (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  variables JSONB NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  updated_by TEXT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
