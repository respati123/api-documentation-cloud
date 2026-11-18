-- Migration 0024 kept the old planning items, tasks, and checklist lines under a legacy name after copying them into issues.
-- It copied the task dependencies into issue_links too, but left the old table pointing at the legacy tasks.
-- Nothing reads any of them any more. This drops them for good, after the guard below has checked the copy.
-- There is no CASCADE on purpose. A key that still points at one of these tables stops the migration instead of being dropped with it.
-- The guard comes first. Each query below divides by zero when something that 0024 should have copied is missing,
-- which stops this migration and rolls it back, so no table is dropped. When nothing is missing, it does nothing.
SELECT 1 / (1 - least(n, 1)) AS planning_items_copied FROM (SELECT count(*)::int AS n FROM planning_items_legacy l WHERE NOT EXISTS (SELECT 1 FROM issues i WHERE i.id = l.id)) AS missing;
SELECT 1 / (1 - least(n, 1)) AS tasks_copied FROM (SELECT count(*)::int AS n FROM tasks_legacy l WHERE NOT EXISTS (SELECT 1 FROM issues i WHERE i.id = l.id)) AS missing;
SELECT 1 / (1 - least(n, 1)) AS checklist_lines_copied FROM (SELECT count(*)::int AS n FROM task_subtasks_legacy s WHERE NOT EXISTS (SELECT 1 FROM issue_checklist_items c WHERE c.id = s.id)) AS missing;
SELECT 1 / (1 - least(n, 1)) AS dependencies_copied FROM (SELECT count(*)::int AS n FROM task_dependencies d WHERE d.task_id <> d.depends_on_id AND NOT EXISTS (SELECT 1 FROM issue_links k WHERE k.from_id = d.depends_on_id AND k.to_id = d.task_id AND k.kind = 'blocks')) AS missing;
DROP TABLE IF EXISTS task_dependencies;
DROP TABLE IF EXISTS task_subtasks_legacy;
DROP TABLE IF EXISTS tasks_legacy;
DROP TABLE IF EXISTS planning_items_legacy;
