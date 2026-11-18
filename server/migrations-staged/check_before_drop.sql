-- Run these on a copy of production before migration 0026 drops the legacy tables. Each query counts what 0024 should have copied
-- and did not. Every count must be 0. They only read, and the runner does not read this folder.
SELECT 'planning items' AS what, count(*)::int AS missing FROM planning_items_legacy l WHERE NOT EXISTS (SELECT 1 FROM issues i WHERE i.id = l.id);
SELECT 'tasks' AS what, count(*)::int AS missing FROM tasks_legacy l WHERE NOT EXISTS (SELECT 1 FROM issues i WHERE i.id = l.id);
SELECT 'checklist lines' AS what, count(*)::int AS missing FROM task_subtasks_legacy s WHERE NOT EXISTS (SELECT 1 FROM issue_checklist_items c WHERE c.id = s.id);
SELECT 'dependencies' AS what, count(*)::int AS missing FROM task_dependencies d WHERE d.task_id <> d.depends_on_id AND NOT EXISTS (SELECT 1 FROM issue_links k WHERE k.from_id = d.depends_on_id AND k.to_id = d.task_id AND k.kind = 'blocks');
