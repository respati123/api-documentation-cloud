import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { databaseEnabled, openScratchDatabase, type ScratchDatabase } from '@/testing/database'

const STAGED = new URL('../migrations-staged/0024_issues_data.sql', import.meta.url)

type Row = Record<string, any>

// The data move of the agile model. It runs on a database that holds the old planning, task, and checklist rows.
describe.skipIf(!databaseEnabled)('moving planning and tasks into issues (staged migration 0024)', () => {
  let scratch: ScratchDatabase
  let db: SQL

  beforeAll(async () => {
    scratch = await openScratchDatabase()
    db = scratch.db
    await scratch.migrate(23)
    await seed()
    await scratch.applySql(STAGED)
  })

  afterAll(async () => {
    await scratch.drop()
  })

  async function seed() {
    await db`INSERT INTO users (id, email, password_hash) VALUES ('u1', 'owner@test.dev', 'x'), ('u2', 'dev@test.dev', 'x'), ('u3', 'solo@test.dev', 'x'), ('u4', 'multi@test.dev', 'x')`
    await db`INSERT INTO workspaces (id, name, owner_id) VALUES ('w1', 'Pari Mobile', 'u1'), ('w2', 'No Project Yet', 'u3'), ('w3', 'Two Projects', 'u4')`

    // Workspace 1: the usual shape, one project whose id is the workspace id.
    await db`INSERT INTO projects (id, workspace_id, name, created_by, key, created_at) VALUES ('w1', 'w1', 'Pari Mobile', 'u1', 'PMA', '2026-01-01T00:00:00Z')`
    await db`INSERT INTO project_members (project_id, user_id, discipline) VALUES ('w1', 'u1', 'pm'), ('w1', 'u2', 'frontend')`
    await db`INSERT INTO planning_documents (id, workspace_id, kind, title, status, current_version, created_by) VALUES ('d1', 'w1', 'prd', 'PRD', 'approved', 2, 'u1')`
    const item = (id: string, kind: string, parent: string | null, status: string, at: string, published: boolean) =>
      db`INSERT INTO planning_items (id, workspace_id, kind, parent_id, title, description, acceptance_criteria, status, published_at, source_document_id, source_version, source_section, created_by, created_at, user_story_role, user_story_action, user_story_benefit, flow)
        VALUES (${id}, 'w1', ${kind}, ${parent}, ${`Item ${id}`}, 'Description', 'Criteria', ${status}, ${published ? at : null}, 'd1', 1, 'Section', 'u1', ${at}, 'a buyer', 'pay', 'to receive goods', 'step 1')`
    await item('e1', 'epic', null, 'ready', '2026-01-02T10:00:00Z', true)
    await item('s1', 'story', 'e1', 'draft', '2026-01-02T10:01:00Z', false)
    await item('s2', 'story', 'e1', 'refinement', '2026-01-02T10:02:00Z', true)
    await item('s3', 'story', 'e1', 'ready', '2026-01-02T10:03:00Z', true)
    await item('s4', 'story', 'e1', 'in_progress', '2026-01-02T10:04:00Z', true)
    await item('s5', 'story', 'e1', 'review', '2026-01-02T10:05:00Z', true)
    await item('s6', 'story', 'e1', 'done', '2026-01-02T10:06:00Z', true)
    await item('e2', 'epic', null, 'draft', '2026-01-02T10:07:00Z', false)
    await db`UPDATE planning_items SET design_approved_by = 'u1', design_approved_at = '2026-01-03T00:00:00Z' WHERE id = 's3'`

    const task = (id: string, story: string | null, status: string, role: string | null, assignee: string | null, position: number, at: string, published: boolean) =>
      db`INSERT INTO tasks (id, project_id, story_id, title, description, status, priority, assignee_id, role, position, created_by, created_at, published_at, due_date)
        VALUES (${id}, 'w1', ${story}, ${`Task ${id}`}, 'Work', ${status}, 'high', ${assignee}, ${role}, ${position}, 'u1', ${at}, ${published ? at : null}, '2026-02-01')`
    await task('t1', 's4', 'backlog', 'backend', 'u2', 5, '2026-01-02T10:10:00Z', true)
    await task('t2', 's4', 'in_review', null, 'u2', 6, '2026-01-02T10:10:30Z', true)
    await task('t3', 's4', 'done', null, null, 7, '2026-01-02T10:10:45Z', true)
    await task('t4', null, 'todo', null, null, 20, '2026-01-02T10:11:00Z', true)
    await task('t5', null, 'in_progress', null, 'u2', 10, '2026-01-02T10:12:00Z', true)
    await task('t6', null, 'backlog', null, null, 30, '2026-01-02T10:13:00Z', false)
    await db`INSERT INTO task_subtasks (id, task_id, title, done, assignee_id, position) VALUES ('c1', 't4', 'first line', true, 'u2', 1), ('c2', 't4', 'second line', false, NULL, 2)`
    await db`INSERT INTO task_dependencies (task_id, depends_on_id) VALUES ('t5', 't4')`
    await db`INSERT INTO planning_participants (item_id, user_id) VALUES ('s4', 'u2')`
    await db`INSERT INTO story_dod_items (id, story_id, text, role, position) VALUES ('dod1', 's4', 'Tested', 'qa', 1)`
    await db`INSERT INTO planning_comments (id, workspace_id, target_kind, target_id, body, created_by) VALUES ('cm1', 'w1', 'task', 't4', 'A comment on a task', 'u1'), ('cm2', 'w1', 'story', 's4', 'A comment on a story', 'u1')`

    // Workspace 2 has documents and an epic but no project row, because the project is made when it is first needed.
    await db`INSERT INTO planning_documents (id, workspace_id, kind, title, status, current_version, created_by) VALUES ('d2', 'w2', 'prd', 'Lonely PRD', 'draft', 1, 'u3')`
    await db`INSERT INTO planning_items (id, workspace_id, kind, title, status, created_by, source_document_id, source_version) VALUES ('e3', 'w2', 'epic', 'Lonely epic', 'draft', 'u3', 'd2', 1)`

    // Workspace 3 has two projects. The one with more tasks linked to stories takes the planning.
    await db`INSERT INTO projects (id, workspace_id, name, created_by, key, created_at) VALUES ('p3a', 'w3', 'Older', 'u4', 'OLD', '2026-01-01T00:00:00Z'), ('p3b', 'w3', 'Newer', 'u4', 'NEW', '2026-01-05T00:00:00Z')`
    await db`INSERT INTO planning_items (id, workspace_id, kind, title, status, created_by, created_at) VALUES ('e4', 'w3', 'epic', 'Epic of w3', 'draft', 'u4', '2026-01-06T00:00:00Z')`
    await db`INSERT INTO planning_items (id, workspace_id, kind, parent_id, title, status, created_by, created_at) VALUES ('s7', 'w3', 'story', 'e4', 'Story of w3', 'draft', 'u4', '2026-01-06T00:01:00Z')`
    await db`INSERT INTO tasks (id, project_id, story_id, title, status, created_by, created_at, role) VALUES ('t7', 'p3a', 's7', 'one', 'todo', 'u4', '2026-01-06T00:02:00Z', 'qa'), ('t8', 'p3b', 's7', 'two', 'todo', 'u4', '2026-01-06T00:03:00Z', 'qa'), ('t9', 'p3b', 's7', 'three', 'todo', 'u4', '2026-01-06T00:04:00Z', 'qa')`
  }

  const issue = async (id: string): Promise<Row> => (await db`SELECT * FROM issues WHERE id = ${id}`)[0]
  const rows = async (query: PromiseLike<unknown>): Promise<Row[]> => (await query) as Row[]

  test('every epic, story, and task keeps its id and lands in the right project as the right type', async () => {
    for (const id of ['e1', 'e2']) expect(await issue(id)).toMatchObject({ type: 'epic', project_id: 'w1', status: null })
    for (const id of ['s1', 's2', 's3', 's4', 's5', 's6']) expect(await issue(id)).toMatchObject({ type: 'story', project_id: 'w1', parent_id: 'e1' })
    for (const id of ['t1', 't2', 't3']) expect(await issue(id)).toMatchObject({ type: 'subtask', project_id: 'w1', parent_id: 's4' })
    for (const id of ['t4', 't5', 't6']) expect(await issue(id)).toMatchObject({ type: 'task', project_id: 'w1', parent_id: null })
  })

  test('story statuses map to the new names', async () => {
    const status = async (id: string) => (await issue(id)).status
    expect([await status('s1'), await status('s2'), await status('s3'), await status('s4'), await status('s5'), await status('s6')]).toEqual([
      'draft',
      'in_design',
      'ready',
      'in_progress',
      'in_qa',
      'done',
    ])
  })

  test('task statuses map, with backlog folded into todo', async () => {
    expect([(await issue('t1')).status, (await issue('t2')).status, (await issue('t3')).status, (await issue('t4')).status, (await issue('t5')).status, (await issue('t6')).status]).toEqual([
      'todo',
      'in_review',
      'done',
      'todo',
      'in_progress',
      'todo',
    ])
  })

  test('drafts stay drafts and published items keep their time', async () => {
    expect((await issue('s1')).published_at).toBeNull()
    expect((await issue('e2')).published_at).toBeNull()
    expect((await issue('t6')).published_at).toBeNull()
    expect(new Date((await issue('s2')).published_at).toISOString()).toBe('2026-01-02T10:02:00.000Z')
  })

  test('the story fields, the source link, and the design approval carry over', async () => {
    expect(await issue('s3')).toMatchObject({
      title: 'Item s3',
      description: 'Description',
      acceptance_criteria: 'Criteria',
      user_story_role: 'a buyer',
      user_story_action: 'pay',
      user_story_benefit: 'to receive goods',
      flow: 'step 1',
      source_document_id: 'd1',
      source_version: 1,
      source_section: 'Section',
      design_approved_by: 'u1',
      created_by: 'u1',
    })
    expect((await issue('s3')).design_approved_at).not.toBeNull()
  })

  test('a task keeps its title, priority, assignee, and due date', async () => {
    expect(await issue('t1')).toMatchObject({ title: 'Task t1', description: 'Work', priority: 'high', assignee_id: 'u2' })
    expect(String((await issue('t1')).due_date)).toContain('2026')
  })

  test('issues are numbered from 1 in each project, in the order they were made', async () => {
    const numbers = await rows(db`SELECT id FROM issues WHERE project_id = 'w1' ORDER BY number`)
    expect(numbers.map((row) => row.id)).toEqual(['e1', 's1', 's2', 's3', 's4', 's5', 's6', 'e2', 't1', 't2', 't3', 't4', 't5', 't6'])
    const [project] = await rows(db`SELECT next_issue_number FROM projects WHERE id = 'w1'`)
    expect(project.next_issue_number).toBe(15)
  })

  test('stories are ranked first in creation order, then the loose tasks by their old position, and sub-tasks have no rank', async () => {
    const ranked = await rows(db`SELECT id FROM issues WHERE project_id = 'w1' AND rank IS NOT NULL ORDER BY rank`)
    expect(ranked.map((row) => row.id)).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 't5', 't4', 't6'])
    for (const id of ['e1', 'e2', 't1', 't2', 't3']) expect((await issue(id)).rank).toBeNull()
  })

  test('a sub-task gets its role from the task, else from the assignee, else backend, and the last is logged', async () => {
    expect((await issue('t1')).role).toBe('backend')
    expect((await issue('t2')).role).toBe('frontend')
    expect((await issue('t3')).role).toBe('backend')
    const events = await rows(db`SELECT target_id, action FROM planning_events WHERE action = 'issue.migrated_role_defaulted'`)
    expect(events.map((row) => row.target_id)).toEqual(['t3'])
  })

  test('sub-task lines become checklist items, and the assignee of a line is kept in the log', async () => {
    const items = await rows(db`SELECT id, issue_id, title, done, position FROM issue_checklist_items WHERE issue_id = 't4' ORDER BY position`)
    expect(items).toEqual([
      { id: 'c1', issue_id: 't4', title: 'first line', done: true, position: 1 },
      { id: 'c2', issue_id: 't4', title: 'second line', done: false, position: 2 },
    ])
    const events = await rows(db`SELECT target_id, details FROM planning_events WHERE action = 'issue.migrated_checklist_assignee'`)
    expect(events).toHaveLength(1)
    expect(events[0].target_id).toBe('t4')
    expect(events[0].details).toMatchObject({ title: 'first line', assigneeEmail: 'dev@test.dev' })
  })

  test('a dependency becomes a blocks link from the task that must finish first', async () => {
    const links = await rows(db`SELECT from_id, to_id, kind FROM issue_links`)
    expect(links).toEqual([{ from_id: 't4', to_id: 't5', kind: 'blocks' }])
  })

  test('documents belong to a project, and a workspace without one gets a project of its own', async () => {
    expect((await rows(db`SELECT project_id FROM planning_documents WHERE id = 'd1'`))[0].project_id).toBe('w1')
    const [lonely] = await rows(db`SELECT id, key, name, created_by FROM projects WHERE workspace_id = 'w2'`)
    expect(lonely).toMatchObject({ id: 'w2', key: 'NPY', name: 'No Project Yet', created_by: 'u3' })
    expect((await rows(db`SELECT project_id FROM planning_documents WHERE id = 'd2'`))[0].project_id).toBe('w2')
    expect((await issue('e3')).project_id).toBe('w2')
    expect(await rows(db`SELECT discipline FROM project_members WHERE project_id = 'w2' AND user_id = 'u3'`)).toEqual([{ discipline: 'pm' }])
  })

  test('with several projects the planning goes to the one with the most tasks linked to stories', async () => {
    expect((await issue('e4')).project_id).toBe('p3b')
    expect((await issue('s7')).project_id).toBe('p3b')
    for (const id of ['t7', 't8', 't9']) expect((await issue(id)).project_id).toBe('p3b')
    expect((await rows(db`SELECT project_id FROM planning_documents WHERE workspace_id = 'w3'`))).toEqual([])
  })

  test('story artifacts, participants, and data models now point at issues', async () => {
    const targets = await rows(db`SELECT conrelid::regclass::text AS source, confrelid::regclass::text AS target FROM pg_constraint
      WHERE contype = 'f' AND conname IN ('planning_participants_item_id_fkey', 'story_contracts_story_id_fkey', 'story_data_models_story_id_fkey', 'story_designs_story_id_fkey', 'story_dod_items_story_id_fkey', 'story_test_cases_story_id_fkey')
      ORDER BY 1`)
    expect(targets).toHaveLength(6)
    expect(targets.every((row) => row.target === 'issues')).toBe(true)
    expect((await rows(db`SELECT story_id FROM story_dod_items WHERE id = 'dod1'`))[0].story_id).toBe('s4')
    expect((await rows(db`SELECT user_id FROM planning_participants WHERE item_id = 's4'`))[0].user_id).toBe('u2')
  })

  test('comments stay where they were, and a comment can be about an issue', async () => {
    expect((await rows(db`SELECT count(*)::int AS n FROM planning_comments WHERE id IN ('cm1', 'cm2')`))[0].n).toBe(2)
    await db`INSERT INTO planning_comments (id, workspace_id, target_kind, target_id, body, created_by) VALUES ('cm3', 'w1', 'issue', 't4', 'On the new kind', 'u1')`
  })

  test('the old tables are kept under a legacy name with their rows, and the old names are gone', async () => {
    const [names] = await rows(db`SELECT to_regclass('planning_items') AS items, to_regclass('tasks') AS tasks, to_regclass('task_subtasks') AS subtasks, to_regclass('planning_items_legacy') AS items_legacy, to_regclass('tasks_legacy') AS tasks_legacy, to_regclass('task_subtasks_legacy') AS subtasks_legacy`)
    expect(names.items).toBeNull()
    expect(names.tasks).toBeNull()
    expect(names.subtasks).toBeNull()
    expect(names.items_legacy).not.toBeNull()
    expect(names.tasks_legacy).not.toBeNull()
    expect(names.subtasks_legacy).not.toBeNull()
    expect((await rows(db`SELECT count(*)::int AS n FROM planning_items_legacy`))[0].n).toBe(11)
    expect((await rows(db`SELECT count(*)::int AS n FROM tasks_legacy`))[0].n).toBe(9)
    expect((await rows(db`SELECT count(*)::int AS n FROM task_subtasks_legacy`))[0].n).toBe(2)
  })

  test('the whole move leaves no issue without a number, and every project count matches', async () => {
    const [{ total }] = await rows(db`SELECT count(*)::int AS total FROM issues`)
    expect(total).toBe(11 + 9)
    expect((await rows(db`SELECT count(*)::int AS n FROM issues WHERE number IS NULL`))[0].n).toBe(0)
  })
})
