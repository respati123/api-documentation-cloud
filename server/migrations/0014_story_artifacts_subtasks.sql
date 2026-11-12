-- Stage 2: the full story. The design-first stage is derived from status and the design approval, so no status values change.
ALTER TABLE planning_items ADD COLUMN IF NOT EXISTS user_story_role TEXT NOT NULL DEFAULT '' CHECK (char_length(user_story_role) <= 300);
ALTER TABLE planning_items ADD COLUMN IF NOT EXISTS user_story_action TEXT NOT NULL DEFAULT '' CHECK (char_length(user_story_action) <= 1000);
ALTER TABLE planning_items ADD COLUMN IF NOT EXISTS user_story_benefit TEXT NOT NULL DEFAULT '' CHECK (char_length(user_story_benefit) <= 1000);
ALTER TABLE planning_items ADD COLUMN IF NOT EXISTS flow TEXT NOT NULL DEFAULT '' CHECK (char_length(flow) <= 20000);
ALTER TABLE planning_items ADD COLUMN IF NOT EXISTS design_approved_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE planning_items ADD COLUMN IF NOT EXISTS design_approved_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS story_dod_items (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES planning_items(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
  role TEXT NOT NULL CHECK (role IN ('ui_ux', 'backend', 'frontend', 'mobile', 'qa')),
  done BOOLEAN NOT NULL DEFAULT false,
  done_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS story_dod_items_story_idx ON story_dod_items(story_id, position);

-- Stage 3: story artifacts.
CREATE TABLE IF NOT EXISTS story_designs (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES planning_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  url TEXT NOT NULL CHECK (char_length(url) BETWEEN 1 AND 2000 AND url ~ '^https?://'),
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS story_designs_story_idx ON story_designs(story_id, created_at);

-- The link keeps the request id, so a renamed request still resolves. Method, path, and name are read from the
-- current collection of the workspace when the story is read. A request that is gone is reported as missing.
CREATE TABLE IF NOT EXISTS story_contracts (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES planning_items(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 200),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_id, request_id)
);

CREATE TABLE IF NOT EXISTS story_test_cases (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES planning_items(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  precondition TEXT NOT NULL DEFAULT '' CHECK (char_length(precondition) <= 2000),
  steps TEXT[] NOT NULL DEFAULT '{}',
  expected TEXT[] NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_id, number)
);

-- Stage 4: task role, dependencies, and sub-tasks.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('ui_ux', 'backend', 'frontend', 'mobile', 'qa'));

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_id),
  CHECK (task_id <> depends_on_id)
);
CREATE INDEX IF NOT EXISTS task_dependencies_target_idx ON task_dependencies(depends_on_id);

CREATE TABLE IF NOT EXISTS task_subtasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  done BOOLEAN NOT NULL DEFAULT false,
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_subtasks_task_idx ON task_subtasks(task_id, position);
