-- CLOUD-001, step 3. A task under an epic is a ticket of one role, with the fields of the team standard, a code such
-- as AUTH-001-BE-2, and sub-tasks the engineer adds. Existing rows stay valid.
-- Keep semicolons out of comments and strings. The runner splits the file at every one.

-- A task may carry a role now. A sub-task needs a parent, and keeps a role only when its parent is a story.
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_subtask_shape;
ALTER TABLE issues ADD CONSTRAINT issues_subtask_shape CHECK (
  (type <> 'subtask' OR (parent_id IS NOT NULL AND points IS NULL AND rank IS NULL AND sprint_id IS NULL))
  AND (role IS NULL OR type IN ('task', 'subtask'))
);

-- The ticket fields of a task. The code is the feature code of the epic, the role code and a number per role.
CREATE TABLE IF NOT EXISTS issue_ticket_details (
  issue_id TEXT PRIMARY KEY REFERENCES issues(id) ON DELETE CASCADE,
  epic_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  role_code TEXT CHECK (role_code IN ('BE', 'FE', 'MOB', 'QA', 'UX')),
  ticket_seq INTEGER CHECK (ticket_seq >= 1),
  repo TEXT NOT NULL DEFAULT '' CHECK (char_length(repo) <= 100),
  goal TEXT NOT NULL DEFAULT '' CHECK (char_length(goal) <= 2000),
  scope TEXT NOT NULL DEFAULT '' CHECK (char_length(scope) <= 4000),
  design_notes TEXT NOT NULL DEFAULT '' CHECK (char_length(design_notes) <= 8000),
  code_follow TEXT NOT NULL DEFAULT '' CHECK (char_length(code_follow) <= 1000),
  code_touch TEXT NOT NULL DEFAULT '' CHECK (char_length(code_touch) <= 2000),
  -- Technical Given / When / Then, one object per check: {given, when, then: [..]}.
  ticket_acs JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(ticket_acs) = 'array'),
  -- Test cases that must exist: {case, unhappy}.
  required_tests JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(required_tests) = 'array'),
  out_of_scope TEXT NOT NULL DEFAULT '' CHECK (char_length(out_of_scope) <= 2000),
  skills TEXT[] NOT NULL DEFAULT '{}',
  size TEXT CHECK (size IN ('S', 'M', 'L')),
  uses_api BOOLEAN NOT NULL DEFAULT true,
  open_questions TEXT NOT NULL DEFAULT '' CHECK (char_length(open_questions) <= 2000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((role_code IS NULL) = (ticket_seq IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS issue_ticket_details_code_idx ON issue_ticket_details(epic_id, role_code, ticket_seq) WHERE role_code IS NOT NULL;
