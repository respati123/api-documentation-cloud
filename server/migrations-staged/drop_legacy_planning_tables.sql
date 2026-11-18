-- STAGED. The runner does not read this folder, so this does not run until it is moved.
-- To ship it: check a copy of production data first (issues, issue_links, and the checklist hold what 0024 copied),
-- then move this file into migrations/ under the next free number. The runner refuses a number below one already applied,
-- so it carries none here. The test is src/legacy-tables-drop.test.ts.
-- Migration 0024 kept the old planning items, tasks, and checklist lines under a legacy name after copying them into issues.
-- It copied the task dependencies into issue_links too, but left the old table pointing at the legacy tasks.
-- Nothing reads any of them any more. This drops them for good, so it must only ship once the data in production has been checked.
-- There is no CASCADE on purpose. A key that still points at one of these tables stops the migration instead of being dropped with it.
DROP TABLE IF EXISTS task_dependencies;
DROP TABLE IF EXISTS task_subtasks_legacy;
DROP TABLE IF EXISTS tasks_legacy;
DROP TABLE IF EXISTS planning_items_legacy;
