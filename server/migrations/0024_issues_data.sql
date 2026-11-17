-- Agile project model, step 2 of 2. It moves every epic, story, task, and checklist line into issues,
-- points the story tables at issues, and renames the old tables to *_legacy. The repositories read issues from here on.
-- The runner splits the file at every semicolon, so keep them out of comments and strings.

-- A workspace that has planning data but no project row yet gets its project now, the way ensureWorkspaceProject
-- makes one: the id is the workspace id, the name is the workspace name, and the owner is the PM.
-- The key follows the rules of makeProjectKey in models/project-key.ts.
WITH created AS (
  INSERT INTO projects (id, workspace_id, name, description, created_by, key)
  SELECT w.id, w.id, w.name, '', w.owner_id,
    CASE
      WHEN length(k.initials) >= 2 THEN left(k.initials, 6)
      WHEN length(k.letters) >= 2 THEN left(k.letters, 4)
      ELSE 'PRJ'
    END
  FROM workspaces w
  CROSS JOIN LATERAL (
    SELECT upper(regexp_replace(w.name, '[^A-Za-z]', '', 'g')) AS letters,
      coalesce((
        SELECT string_agg(left(x.word, 1), '' ORDER BY x.n)
        FROM unnest(regexp_split_to_array(upper(regexp_replace(w.name, '[^A-Za-z ]', '', 'g')), '\s+')) WITH ORDINALITY AS x(word, n)
        WHERE x.word <> ''
      ), '') AS initials
  ) AS k
  WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.workspace_id = w.id)
    AND (EXISTS (SELECT 1 FROM planning_items i WHERE i.workspace_id = w.id) OR EXISTS (SELECT 1 FROM planning_documents d WHERE d.workspace_id = w.id))
  ON CONFLICT (id) DO NOTHING
  RETURNING id, created_by
)
INSERT INTO project_members (project_id, user_id, discipline) SELECT id, created_by, 'pm' FROM created;

-- The project that takes the planning of a workspace. With one project it is that one. With several it is the one with
-- the most tasks linked to stories, then the oldest.
CREATE TEMP TABLE planning_project ON COMMIT DROP AS
SELECT DISTINCT ON (p.workspace_id) p.workspace_id, p.id AS project_id
FROM projects p
LEFT JOIN (SELECT t.project_id, count(*) AS linked FROM tasks t WHERE t.story_id IS NOT NULL GROUP BY t.project_id) l ON l.project_id = p.id
ORDER BY p.workspace_id, coalesce(l.linked, 0) DESC, p.created_at, p.id;

-- A task linked to a story moves to the project of that story, so a sub-task and its parent are always together.
CREATE TEMP TABLE legacy_task_project ON COMMIT DROP AS
SELECT t.id, coalesce(m.project_id, t.project_id) AS project_id
FROM tasks t
LEFT JOIN planning_items si ON si.id = t.story_id
LEFT JOIN planning_project m ON m.workspace_id = si.workspace_id;

-- Issue numbers count up from 1 in each project, in the order the items were made. An issue that was already made
-- through the new routes keeps its number, and the moved items follow it.
CREATE TEMP TABLE legacy_numbers ON COMMIT DROP AS
SELECT id, project_id, row_number() OVER (PARTITION BY project_id ORDER BY created_at, id) + coalesce((SELECT max(x.number) FROM issues x WHERE x.project_id = everything.project_id), 0) AS number
FROM (
  SELECT i.id, m.project_id, i.created_at FROM planning_items i JOIN planning_project m ON m.workspace_id = i.workspace_id
  UNION ALL
  SELECT t.id, lt.project_id, t.created_at FROM tasks t JOIN legacy_task_project lt ON lt.id = t.id
) AS everything;

-- Backlog order: the stories first in the order they were made, then the tasks with no story by their old position.
-- They follow any item that is already ranked.
CREATE TEMP TABLE legacy_ranks ON COMMIT DROP AS
SELECT id, (row_number() OVER (PARTITION BY project_id ORDER BY grp, ord, created_at, id) * 1024) + coalesce((SELECT max(x.rank) FROM issues x WHERE x.project_id = backlog.project_id), 0) AS rank
FROM (
  SELECT i.id, m.project_id, 0 AS grp, 0::bigint AS ord, i.created_at
  FROM planning_items i JOIN planning_project m ON m.workspace_id = i.workspace_id
  WHERE i.kind = 'story'
  UNION ALL
  SELECT t.id, lt.project_id, 1 AS grp, t.position AS ord, t.created_at
  FROM tasks t JOIN legacy_task_project lt ON lt.id = t.id
  WHERE t.story_id IS NULL
) AS backlog;

-- Epics have no status. Their status is worked out from their stories.
INSERT INTO issues (id, project_id, number, type, parent_id, title, description, acceptance_criteria, status, priority, source_document_id, source_version, source_section, published_at, created_by, created_at, updated_at)
SELECT i.id, n.project_id, n.number, 'epic', NULL, i.title, i.description, i.acceptance_criteria, NULL, 'medium', i.source_document_id, i.source_version, i.source_section, i.published_at, i.created_by, i.created_at, i.updated_at
FROM planning_items i JOIN legacy_numbers n ON n.id = i.id
WHERE i.kind = 'epic';

INSERT INTO issues (id, project_id, number, type, parent_id, title, description, acceptance_criteria, user_story_role, user_story_action, user_story_benefit, flow, status, priority, rank, source_document_id, source_version, source_section, design_approved_by, design_approved_at, published_at, created_by, created_at, updated_at)
SELECT i.id, n.project_id, n.number, 'story', i.parent_id, i.title, i.description, i.acceptance_criteria, i.user_story_role, i.user_story_action, i.user_story_benefit, i.flow,
  CASE i.status WHEN 'refinement' THEN 'in_design' WHEN 'review' THEN 'in_qa' ELSE i.status END,
  'medium', r.rank, i.source_document_id, i.source_version, i.source_section, i.design_approved_by, i.design_approved_at, i.published_at, i.created_by, i.created_at, i.updated_at
FROM planning_items i JOIN legacy_numbers n ON n.id = i.id JOIN legacy_ranks r ON r.id = i.id
WHERE i.kind = 'story';

-- A task linked to a story is the work of one role inside that story, so it becomes a sub-task. Its role is the role
-- of the task, else the first work role of its assignee in the project, else backend.
INSERT INTO issues (id, project_id, number, type, parent_id, title, description, status, priority, role, assignee_id, due_date, published_at, created_by, created_at, updated_at)
SELECT t.id, n.project_id, n.number, 'subtask', t.story_id, t.title, t.description,
  CASE t.status WHEN 'backlog' THEN 'todo' ELSE t.status END, t.priority,
  coalesce(
    t.role,
    (SELECT pm.discipline FROM project_members pm WHERE pm.project_id = n.project_id AND pm.user_id = t.assignee_id AND pm.discipline IN ('ui_ux', 'backend', 'frontend', 'mobile', 'qa') ORDER BY pm.created_at, pm.discipline LIMIT 1),
    'backend'
  ),
  t.assignee_id, t.due_date, t.published_at, t.created_by, t.created_at, t.updated_at
FROM tasks t JOIN legacy_numbers n ON n.id = t.id
WHERE t.story_id IS NOT NULL;

-- The sub-tasks that fell back to backend are written to the activity log, so the PM can fix them.
INSERT INTO planning_events (id, workspace_id, actor_id, target_kind, target_id, action, details)
SELECT gen_random_uuid()::text, p.workspace_id, t.created_by, 'issue', t.id, 'issue.migrated_role_defaulted', '{}'::jsonb
FROM tasks t JOIN legacy_numbers n ON n.id = t.id JOIN projects p ON p.id = n.project_id
WHERE t.story_id IS NOT NULL AND t.role IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = n.project_id AND pm.user_id = t.assignee_id AND pm.discipline IN ('ui_ux', 'backend', 'frontend', 'mobile', 'qa'));

INSERT INTO issues (id, project_id, number, type, title, description, status, priority, rank, assignee_id, due_date, published_at, created_by, created_at, updated_at)
SELECT t.id, n.project_id, n.number, 'task', t.title, t.description,
  CASE t.status WHEN 'backlog' THEN 'todo' ELSE t.status END, t.priority, r.rank,
  t.assignee_id, t.due_date, t.published_at, t.created_by, t.created_at, t.updated_at
FROM tasks t JOIN legacy_numbers n ON n.id = t.id JOIN legacy_ranks r ON r.id = t.id
WHERE t.story_id IS NULL;

-- Reports read the history of the status. An item that is already past its first status starts its history here.
INSERT INTO issue_status_events (id, issue_id, from_status, to_status, actor_id, created_at)
SELECT gen_random_uuid()::text, i.id, NULL, i.status, i.created_by, now()
FROM issues i JOIN legacy_numbers n ON n.id = i.id
WHERE i.status IS NOT NULL AND i.status NOT IN ('todo', 'draft');

-- The sub-task lines of a task become its checklist. A checklist line has no assignee, so who it was given to
-- is written to the activity log.
INSERT INTO issue_checklist_items (id, issue_id, title, done, position, created_at)
SELECT s.id, s.task_id, s.title, s.done, s.position, s.created_at FROM task_subtasks s;

INSERT INTO planning_events (id, workspace_id, actor_id, target_kind, target_id, action, details)
SELECT gen_random_uuid()::text, p.workspace_id, t.created_by, 'issue', t.id, 'issue.migrated_checklist_assignee',
  jsonb_build_object('title', s.title, 'assigneeEmail', u.email)
FROM task_subtasks s
JOIN tasks t ON t.id = s.task_id
JOIN legacy_numbers n ON n.id = t.id
JOIN projects p ON p.id = n.project_id
JOIN users u ON u.id = s.assignee_id
WHERE s.assignee_id IS NOT NULL;

-- A task that depends on another is blocked by it, so the link runs from the task that must finish first.
INSERT INTO issue_links (id, from_id, to_id, kind, created_by)
SELECT gen_random_uuid()::text, d.depends_on_id, d.task_id, 'blocks', t.created_by
FROM task_dependencies d JOIN tasks t ON t.id = d.task_id
WHERE d.task_id <> d.depends_on_id
ON CONFLICT DO NOTHING;

-- When a workspace had several projects the choice is written to the activity log, so the PM can see it.
INSERT INTO planning_events (id, workspace_id, actor_id, target_kind, target_id, action, details)
SELECT gen_random_uuid()::text, m.workspace_id, w.owner_id, 'project', m.project_id, 'issue.migrated_project_chosen',
  jsonb_build_object('projects', (SELECT count(*) FROM projects p WHERE p.workspace_id = m.workspace_id))
FROM planning_project m JOIN workspaces w ON w.id = m.workspace_id
WHERE (SELECT count(*) FROM projects p WHERE p.workspace_id = m.workspace_id) > 1
  AND EXISTS (SELECT 1 FROM issues i WHERE i.project_id = m.project_id);

-- BRD and PRD belong to the project that took the planning.
UPDATE planning_documents d SET project_id = m.project_id FROM planning_project m WHERE m.workspace_id = d.workspace_id;
ALTER TABLE planning_documents ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE planning_documents DROP CONSTRAINT planning_documents_project_id_fkey;
ALTER TABLE planning_documents ADD CONSTRAINT planning_documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

UPDATE projects p SET next_issue_number = n.next FROM (SELECT project_id, max(number) + 1 AS next FROM issues GROUP BY project_id) n WHERE n.project_id = p.id;

-- The tables that hung off a story now hang off the issue with the same id.
ALTER TABLE planning_participants DROP CONSTRAINT planning_participants_item_id_fkey;
ALTER TABLE planning_participants ADD CONSTRAINT planning_participants_item_id_fkey FOREIGN KEY (item_id) REFERENCES issues(id) ON DELETE CASCADE;
ALTER TABLE story_dod_items DROP CONSTRAINT story_dod_items_story_id_fkey;
ALTER TABLE story_dod_items ADD CONSTRAINT story_dod_items_story_id_fkey FOREIGN KEY (story_id) REFERENCES issues(id) ON DELETE CASCADE;
ALTER TABLE story_designs DROP CONSTRAINT story_designs_story_id_fkey;
ALTER TABLE story_designs ADD CONSTRAINT story_designs_story_id_fkey FOREIGN KEY (story_id) REFERENCES issues(id) ON DELETE CASCADE;
ALTER TABLE story_contracts DROP CONSTRAINT story_contracts_story_id_fkey;
ALTER TABLE story_contracts ADD CONSTRAINT story_contracts_story_id_fkey FOREIGN KEY (story_id) REFERENCES issues(id) ON DELETE CASCADE;
ALTER TABLE story_test_cases DROP CONSTRAINT story_test_cases_story_id_fkey;
ALTER TABLE story_test_cases ADD CONSTRAINT story_test_cases_story_id_fkey FOREIGN KEY (story_id) REFERENCES issues(id) ON DELETE CASCADE;
ALTER TABLE story_data_models DROP CONSTRAINT story_data_models_story_id_fkey;
ALTER TABLE story_data_models ADD CONSTRAINT story_data_models_story_id_fkey FOREIGN KEY (story_id) REFERENCES issues(id) ON DELETE CASCADE;

-- Comments keep their old kind and id. A comment can also be about an issue now.
ALTER TABLE planning_comments DROP CONSTRAINT planning_comments_target_kind_check;
ALTER TABLE planning_comments ADD CONSTRAINT planning_comments_target_kind_check CHECK (target_kind IN ('document', 'epic', 'story', 'task', 'issue'));

-- The old tables stay with their rows until the owner confirms the move in writing.
ALTER TABLE task_subtasks RENAME TO task_subtasks_legacy;
ALTER TABLE tasks RENAME TO tasks_legacy;
ALTER TABLE planning_items RENAME TO planning_items_legacy;
