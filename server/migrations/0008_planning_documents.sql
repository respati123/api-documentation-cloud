CREATE TABLE planning_documents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('brd', 'prd')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  status TEXT NOT NULL CHECK (status IN ('draft', 'review_pm', 'review_team', 'approved', 'superseded')) DEFAULT 'draft',
  current_version INTEGER NOT NULL DEFAULT 1,
  source_document_id TEXT REFERENCES planning_documents(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE planning_document_versions (
  document_id TEXT NOT NULL REFERENCES planning_documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  content TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  source_version INTEGER,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, version)
);

CREATE TABLE planning_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('epic', 'story')),
  parent_id TEXT REFERENCES planning_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  description TEXT NOT NULL DEFAULT '',
  acceptance_criteria TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'refinement', 'ready', 'in_progress', 'review', 'done')) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  source_document_id TEXT REFERENCES planning_documents(id) ON DELETE SET NULL,
  source_version INTEGER,
  source_section TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((kind = 'epic' AND parent_id IS NULL) OR (kind = 'story' AND parent_id IS NOT NULL))
);

CREATE TABLE planning_participants (
  item_id TEXT NOT NULL REFERENCES planning_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, user_id)
);

ALTER TABLE tasks ADD COLUMN story_id TEXT REFERENCES planning_items(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN published_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE planning_comments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('document', 'epic', 'story', 'task')),
  target_id TEXT NOT NULL,
  parent_id TEXT REFERENCES planning_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  is_decision BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT REFERENCES users(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE planning_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  api_key_id TEXT REFERENCES mcp_api_keys(id) ON DELETE SET NULL,
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX planning_documents_workspace_idx ON planning_documents(workspace_id, kind, updated_at DESC);
CREATE INDEX planning_items_workspace_idx ON planning_items(workspace_id, kind, created_at);
CREATE INDEX planning_comments_target_idx ON planning_comments(workspace_id, target_kind, target_id, created_at);
CREATE INDEX planning_events_workspace_idx ON planning_events(workspace_id, created_at DESC);
CREATE INDEX tasks_story_idx ON tasks(story_id);
