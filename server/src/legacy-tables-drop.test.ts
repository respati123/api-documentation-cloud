import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { databaseEnabled, openScratchDatabase, type ScratchDatabase } from '@/testing/database'

const DATA_MOVE = new URL('../migrations/0024_issues_data.sql', import.meta.url)
const CHECKS = new URL('../migrations-staged/check_before_drop.sql', import.meta.url)
const DROP = new URL('../migrations-staged/drop_legacy_planning_tables.sql', import.meta.url)

// Migration 0024 keeps the old planning, task, and checklist tables as *_legacy. The staged migration drops them for good.
describe.skipIf(!databaseEnabled)('dropping the legacy planning tables (staged migration)', () => {
  let scratch: ScratchDatabase
  let db: SQL

  beforeAll(async () => {
    scratch = await openScratchDatabase()
    db = scratch.db
    await scratch.migrate(23)
    await db`INSERT INTO users (id, email, password_hash) VALUES ('u1', 'owner@test.dev', 'x')`
    await db`INSERT INTO workspaces (id, name, owner_id) VALUES ('w1', 'Pari Mobile', 'u1')`
    await db`INSERT INTO projects (id, workspace_id, name, created_by, key) VALUES ('w1', 'w1', 'Pari Mobile', 'u1', 'PMA')`
    await db`INSERT INTO project_members (project_id, user_id, discipline) VALUES ('w1', 'u1', 'pm')`
    await db`INSERT INTO planning_documents (id, workspace_id, kind, title, status, current_version, created_by) VALUES ('d1', 'w1', 'prd', 'PRD', 'approved', 1, 'u1')`
    await db`INSERT INTO planning_items (id, workspace_id, kind, parent_id, title, description, acceptance_criteria, status, published_at, source_document_id, source_version, source_section, created_by)
      VALUES ('e1', 'w1', 'epic', NULL, 'Epic', '', '', 'ready', now(), 'd1', 1, 'Section', 'u1')`
    await db`INSERT INTO tasks (id, project_id, story_id, title, description, status, priority, position, created_by, published_at)
      VALUES ('t1', 'w1', NULL, 'Task', '', 'todo', 'medium', 1, 'u1', now())`
    await db`INSERT INTO task_subtasks (id, task_id, title, done, position) VALUES ('c1', 't1', 'line', false, 1)`
    await db`INSERT INTO tasks (id, project_id, story_id, title, description, status, priority, position, created_by, published_at)
      VALUES ('t2', 'w1', NULL, 'Second', '', 'todo', 'medium', 2, 'u1', now())`
    await db`INSERT INTO task_dependencies (task_id, depends_on_id) VALUES ('t2', 't1')`
    await scratch.applySql(DATA_MOVE)
  })

  afterAll(async () => {
    await scratch.drop()
  })

  const exists = async (name: string) => (await db`SELECT to_regclass(${name}) AS found`)[0].found !== null

  const missing = async () => {
    const text = (await Bun.file(CHECKS).text()).split('\n').filter((line) => !line.startsWith('--')).join('\n')
    const statements = text.split(';').map((part) => part.trim()).filter(Boolean)
    const found: Record<string, number> = {}
    for (const statement of statements) {
      const [row] = await db.unsafe(statement)
      found[row.what] = row.missing
    }
    return found
  }

  test('the checks before the drop find nothing missing after the data move, and see a row that is', async () => {
    expect(await missing()).toEqual({ 'planning items': 0, tasks: 0, 'checklist lines': 0, dependencies: 0 })
    await db`DELETE FROM issue_checklist_items WHERE id = 'c1'`
    await db`DELETE FROM issue_links`
    expect(await missing()).toMatchObject({ 'checklist lines': 1, dependencies: 1 })
    await db`INSERT INTO issue_checklist_items (id, issue_id, title, done, position) VALUES ('c1', 't1', 'line', false, 1)`
    await db`INSERT INTO issue_links (id, from_id, to_id, kind, created_by) VALUES ('k1', 't1', 't2', 'blocks', 'u1')`
    expect(await missing()).toEqual({ 'planning items': 0, tasks: 0, 'checklist lines': 0, dependencies: 0 })
  })

  const GONE = ['planning_items_legacy', 'tasks_legacy', 'task_subtasks_legacy', 'task_dependencies']

  test('the legacy tables are there after the data move, and gone after the drop', async () => {
    for (const name of GONE) expect(await exists(name)).toBe(true)
    await scratch.applySql(DROP)
    for (const name of GONE) expect(await exists(name)).toBe(false)
  })

  test('the issues, the checklist, and the tables the app reads are untouched', async () => {
    expect((await db`SELECT count(*)::int AS n FROM issues`)[0].n).toBe(3)
    expect((await db`SELECT count(*)::int AS n FROM issue_checklist_items`)[0].n).toBe(1)
    expect((await db`SELECT count(*)::int AS n FROM issue_links WHERE kind = 'blocks'`)[0].n).toBe(1)
    for (const name of ['issues', 'sprints', 'issue_links', 'story_dod_items', 'planning_comments', 'planning_documents', 'planning_participants']) {
      expect(await exists(name)).toBe(true)
    }
  })

  test('running the drop again does no harm', async () => {
    await scratch.applySql(DROP)
    for (const name of GONE) expect(await exists(name)).toBe(false)
  })
})
