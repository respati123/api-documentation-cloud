-- DBDesign and Stitchkit projects linked to a workspace. The project lives in the app, and the portal keeps only the link.
CREATE TABLE IF NOT EXISTS workspace_app_links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  app TEXT NOT NULL CHECK (app IN ('dbdesign', 'stitchkit')),
  app_project_id TEXT NOT NULL CHECK (char_length(app_project_id) BETWEEN 1 AND 100),
  app_project_name TEXT NOT NULL CHECK (char_length(app_project_name) BETWEEN 1 AND 200),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, app, app_project_id)
);

-- A story's data model: tables from a DBDesign project linked to the same workspace. Names are kept for display.
CREATE TABLE IF NOT EXISTS story_data_models (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES planning_items(id) ON DELETE CASCADE,
  app_project_id TEXT NOT NULL CHECK (char_length(app_project_id) BETWEEN 1 AND 100),
  project_name TEXT NOT NULL CHECK (char_length(project_name) BETWEEN 1 AND 200),
  table_id TEXT NOT NULL CHECK (char_length(table_id) BETWEEN 1 AND 100),
  table_name TEXT NOT NULL CHECK (char_length(table_name) BETWEEN 1 AND 200),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_id, app_project_id, table_id)
);
CREATE INDEX IF NOT EXISTS story_data_models_story_idx ON story_data_models(story_id, created_at);
