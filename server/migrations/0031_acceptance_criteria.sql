-- CLOUD-001, step 2. Acceptance criteria of an epic are records with a number that is never reused,
-- written as Given, When and Then. Tasks, test cases and the design point at them.
-- This file only adds tables and one column. Keep semicolons out of comments and strings.

CREATE TABLE IF NOT EXISTS acceptance_criteria (
  id TEXT PRIMARY KEY,
  epic_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  number INTEGER NOT NULL CHECK (number >= 1),
  flow TEXT NOT NULL DEFAULT '' CHECK (char_length(flow) <= 80),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  given_text TEXT NOT NULL CHECK (char_length(given_text) BETWEEN 1 AND 2000),
  when_text TEXT NOT NULL CHECK (char_length(when_text) BETWEEN 1 AND 2000),
  then_items TEXT[] NOT NULL CHECK (cardinality(then_items) BETWEEN 1 AND 10),
  -- Where the design satisfies it: a list of {repo, component, testLevel}. Empty until the tech lead maps it.
  design_mapping JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(design_mapping) = 'array'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'struck')),
  struck_reason TEXT CHECK (struck_reason IS NULL OR char_length(struck_reason) BETWEEN 1 AND 500),
  struck_at TIMESTAMPTZ,
  created_by TEXT NOT NULL REFERENCES users(id),
  api_key_id TEXT REFERENCES mcp_keys(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (epic_id, number),
  CONSTRAINT acceptance_criteria_struck_shape CHECK ((status = 'struck') = (struck_reason IS NOT NULL AND struck_at IS NOT NULL))
);

-- Which acceptance criteria a task or a bug delivers.
CREATE TABLE IF NOT EXISTS issue_acceptance_criteria (
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  ac_id TEXT NOT NULL REFERENCES acceptance_criteria(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, ac_id)
);
CREATE INDEX IF NOT EXISTS issue_acceptance_criteria_ac_idx ON issue_acceptance_criteria(ac_id);

-- A test case can check one acceptance criterion.
ALTER TABLE story_test_cases ADD COLUMN IF NOT EXISTS ac_id TEXT REFERENCES acceptance_criteria(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS story_test_cases_ac_idx ON story_test_cases(ac_id) WHERE ac_id IS NOT NULL;
