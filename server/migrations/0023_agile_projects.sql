-- Agile project model, step 1 of 2. This file only adds tables and columns.
-- The planning and task tables are not touched, so the running code keeps working.
-- Migration 0024 moves their rows into issues and renames the old tables.
-- Keep semicolons out of comments and strings. The runner splits the file at every one.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'scrum' CHECK (mode IN ('scrum', 'kanban'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS product_goal TEXT NOT NULL DEFAULT '' CHECK (char_length(product_goal) <= 2000);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS next_issue_number INTEGER NOT NULL DEFAULT 1 CHECK (next_issue_number >= 1);

-- Key for the projects that exist now. The rules match makeProjectKey in models/project-key.ts.
-- Initials of the words (up to 6), else the first 4 letters, else PRJ. A repeated key in one workspace gets AA, AB, ...
UPDATE projects p SET key = k.key
FROM (
  SELECT id,
    CASE WHEN rn = 1 THEN candidate
         ELSE candidate || chr((65 + ((rn - 2) / 26) % 26)::int) || chr((65 + (rn - 2) % 26)::int)
    END AS key
  FROM (
    SELECT id, candidate,
      row_number() OVER (PARTITION BY workspace_id, candidate ORDER BY created_at, id) AS rn
    FROM (
      SELECT id, workspace_id, created_at,
        CASE
          WHEN length(initials) >= 2 THEN left(initials, 6)
          WHEN length(letters) >= 2 THEN left(letters, 4)
          ELSE 'PRJ'
        END AS candidate
      FROM (
        SELECT id, workspace_id, created_at,
          upper(regexp_replace(name, '[^A-Za-z]', '', 'g')) AS letters,
          coalesce((
            SELECT string_agg(left(w.word, 1), '' ORDER BY w.n)
            FROM unnest(regexp_split_to_array(upper(regexp_replace(projects.name, '[^A-Za-z ]', '', 'g')), '\s+')) WITH ORDINALITY AS w(word, n)
            WHERE w.word <> ''
          ), '') AS initials
        FROM projects
      ) AS named
    ) AS candidates
  ) AS ranked
) AS k
WHERE p.id = k.id;

ALTER TABLE projects ALTER COLUMN key SET NOT NULL;
ALTER TABLE projects ADD CONSTRAINT projects_key_format CHECK (key ~ '^[A-Z]{2,10}$');
CREATE UNIQUE INDEX IF NOT EXISTS projects_workspace_key_idx ON projects(workspace_id, key);

-- An old key keeps pointing at its project after a rename, so old links still open.
CREATE TABLE IF NOT EXISTS project_key_aliases (
  workspace_id TEXT NOT NULL,
  key TEXT NOT NULL CHECK (key ~ '^[A-Z]{2,10}$'),
  project_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, key),
  FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, id) ON DELETE CASCADE
);

-- Used by Kanban mode. A limit is a warning on the column, never a block.
CREATE TABLE IF NOT EXISTS project_wip_limits (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  wip_limit INTEGER NOT NULL CHECK (wip_limit >= 1),
  PRIMARY KEY (project_id, status)
);

CREATE TABLE IF NOT EXISTS sprints (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  goal TEXT NOT NULL DEFAULT '' CHECK (char_length(goal) <= 1000),
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'closed')),
  started_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on > starts_on AND ends_on - starts_on <= 28)
);
CREATE UNIQUE INDEX IF NOT EXISTS sprints_one_active_idx ON sprints(project_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS sprints_project_idx ON sprints(project_id, starts_on);

-- One table for epics, stories, tasks, bugs, and sub-tasks. Rows will keep the ids they have today.
-- The story columns (user_story_*, flow, design_approved_*) carry over from planning_items.
CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number INTEGER NOT NULL CHECK (number >= 1),
  type TEXT NOT NULL CHECK (type IN ('epic', 'story', 'task', 'bug', 'subtask')),
  parent_id TEXT REFERENCES issues(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  description TEXT NOT NULL DEFAULT '',
  acceptance_criteria TEXT NOT NULL DEFAULT '',
  user_story_role TEXT NOT NULL DEFAULT '' CHECK (char_length(user_story_role) <= 300),
  user_story_action TEXT NOT NULL DEFAULT '' CHECK (char_length(user_story_action) <= 1000),
  user_story_benefit TEXT NOT NULL DEFAULT '' CHECK (char_length(user_story_benefit) <= 1000),
  flow TEXT NOT NULL DEFAULT '' CHECK (char_length(flow) <= 20000),
  status TEXT,
  points SMALLINT CHECK (points IN (1, 2, 3, 5, 8, 13)),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  rank BIGINT,
  sprint_id TEXT REFERENCES sprints(id) ON DELETE SET NULL,
  role TEXT CHECK (role IN ('ui_ux', 'backend', 'frontend', 'mobile', 'qa')),
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  source_document_id TEXT REFERENCES planning_documents(id) ON DELETE SET NULL,
  source_version INTEGER,
  source_section TEXT,
  source_reviewed_version INTEGER,
  design_approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  design_approved_at TIMESTAMPTZ,
  test_case_id TEXT REFERENCES story_test_cases(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, number),
  CONSTRAINT issues_status_matches_type CHECK (
    (type = 'epic' AND status IS NULL)
    OR (type = 'story' AND status IN ('draft', 'in_design', 'ready', 'in_progress', 'in_qa', 'done'))
    OR (type IN ('task', 'bug', 'subtask') AND status IN ('todo', 'in_progress', 'in_review', 'done'))
  ),
  CONSTRAINT issues_epic_is_plain CHECK (
    type <> 'epic' OR (parent_id IS NULL AND points IS NULL AND rank IS NULL AND sprint_id IS NULL AND role IS NULL)
  ),
  CONSTRAINT issues_subtask_shape CHECK (
    (type = 'subtask') = (role IS NOT NULL)
    AND (type <> 'subtask' OR (parent_id IS NOT NULL AND points IS NULL AND rank IS NULL AND sprint_id IS NULL))
  )
);
CREATE INDEX IF NOT EXISTS issues_sprint_idx ON issues(project_id, sprint_id);
CREATE INDEX IF NOT EXISTS issues_rank_idx ON issues(project_id, rank) WHERE rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS issues_parent_idx ON issues(parent_id);
CREATE INDEX IF NOT EXISTS issues_type_status_idx ON issues(project_id, type, status);
CREATE INDEX IF NOT EXISTS issues_assignee_idx ON issues(project_id, assignee_id);

-- Every status change. Burndown, cycle time, and work item age read from here.
CREATE TABLE IF NOT EXISTS issue_status_events (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users(id),
  api_key_id TEXT REFERENCES mcp_api_keys(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS issue_status_events_issue_idx ON issue_status_events(issue_id, created_at);

-- Sprint scope: what was committed, added, removed, carried over, or re-estimated. The sprint report and velocity read from here.
CREATE TABLE IF NOT EXISTS sprint_scope_events (
  id TEXT PRIMARY KEY,
  sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('committed', 'added', 'removed', 'points_changed', 'carried_over')),
  points_before SMALLINT,
  points_after SMALLINT,
  after_start BOOLEAN NOT NULL,
  override_reason TEXT,
  actor_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sprint_scope_events_sprint_idx ON sprint_scope_events(sprint_id, created_at);

CREATE TABLE IF NOT EXISTS issue_links (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('blocks', 'relates', 'found_in')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_id, to_id, kind),
  CHECK (from_id <> to_id)
);
CREATE INDEX IF NOT EXISTS issue_links_to_idx ON issue_links(to_id);

-- Replaces task_subtasks. A checklist line has no assignee.
CREATE TABLE IF NOT EXISTS issue_checklist_items (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  done BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS issue_checklist_items_issue_idx ON issue_checklist_items(issue_id, position);

-- BRD and PRD belong to a project. Migration 0024 fills this and makes it required.
ALTER TABLE planning_documents ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS planning_documents_project_idx ON planning_documents(project_id);
