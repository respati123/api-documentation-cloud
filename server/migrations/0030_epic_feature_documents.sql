-- CLOUD-001, step 1. An epic is a feature with a code such as AUTH-001, and it holds a spec, a design and a contract.
-- This file only adds columns, an index and wider checks. Every row that exists today stays valid.
-- Keep semicolons out of comments and strings. The runner splits the file at every one.

-- The feature code of an epic. The prefix is the product area the PM picks, the number counts up per prefix in a project.
ALTER TABLE issues ADD COLUMN IF NOT EXISTS feature_prefix TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS feature_number INTEGER;
ALTER TABLE issues ADD CONSTRAINT issues_feature_code_shape CHECK (
  (feature_prefix IS NULL) = (feature_number IS NULL)
  AND (feature_prefix IS NULL OR (type = 'epic' AND feature_prefix ~ '^[A-Z]{2,8}$' AND feature_number >= 1))
);
CREATE UNIQUE INDEX IF NOT EXISTS issues_feature_code_idx ON issues(project_id, feature_prefix, feature_number) WHERE feature_prefix IS NOT NULL;

-- Existing epics take the project key, cut to eight letters, and a number in the order they were made.
-- The PM can change the prefix later.
UPDATE issues i SET feature_prefix = n.prefix, feature_number = n.number
FROM (
  SELECT e.id, left(p.key, 8) AS prefix, row_number() OVER (PARTITION BY e.project_id ORDER BY e.created_at, e.id) AS number
  FROM issues e JOIN projects p ON p.id = e.project_id
  WHERE e.type = 'epic' AND e.feature_prefix IS NULL
) AS n
WHERE i.id = n.id;

-- From here on every epic has a code. The insert gives a new epic one.
ALTER TABLE issues ADD CONSTRAINT issues_epic_has_feature_code CHECK (type <> 'epic' OR feature_prefix IS NOT NULL);

-- Spec, design and contract are documents of one epic. BRD and PRD stay documents of the project.
ALTER TABLE planning_documents DROP CONSTRAINT IF EXISTS planning_documents_kind_check;
ALTER TABLE planning_documents ADD CONSTRAINT planning_documents_kind_check CHECK (kind IN ('brd', 'prd', 'spec', 'design', 'contract'));
ALTER TABLE planning_documents ADD COLUMN IF NOT EXISTS epic_id TEXT REFERENCES issues(id) ON DELETE CASCADE;
ALTER TABLE planning_documents ADD CONSTRAINT planning_documents_epic_kind CHECK ((kind IN ('spec', 'design', 'contract')) = (epic_id IS NOT NULL));

-- One live document of each kind per epic. A superseded or discarded one makes room for the next.
CREATE UNIQUE INDEX IF NOT EXISTS planning_documents_epic_kind_idx ON planning_documents(epic_id, kind)
  WHERE epic_id IS NOT NULL AND status NOT IN ('superseded', 'discarded');
