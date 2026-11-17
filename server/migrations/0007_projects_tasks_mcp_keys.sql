CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discipline TEXT NOT NULL CHECK (discipline IN ('backend', 'frontend', 'pm', 'qa', 'ui_ux')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'done')) DEFAULT 'backlog',
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  due_date DATE,
  position BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, id)
);

CREATE TABLE IF NOT EXISTS mcp_api_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  key_hash TEXT NOT NULL UNIQUE,
  project_ids TEXT[] NOT NULL DEFAULT '{}',
  permissions TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_workspace_idx ON projects(workspace_id, updated_at DESC, id);
CREATE INDEX IF NOT EXISTS project_members_user_idx ON project_members(user_id, project_id);
CREATE INDEX IF NOT EXISTS tasks_project_status_idx ON tasks(project_id, status, position, created_at);
CREATE INDEX IF NOT EXISTS tasks_assignee_idx ON tasks(project_id, assignee_id, status, position);
CREATE INDEX IF NOT EXISTS mcp_api_keys_user_idx ON mcp_api_keys(user_id, workspace_id) WHERE revoked_at IS NULL;
