import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { databaseEnabled, openScratchDatabase, type ScratchDatabase } from '@/testing/database'

// Migration 0023 only adds tables and columns. The planning and task tables stay as they were until the data move.
describe.skipIf(!databaseEnabled)('agile schema (migration 0023)', () => {
  let scratch: ScratchDatabase
  let db: SQL
  const userId = randomUUID()
  const workspaceId = randomUUID()
  const otherWorkspaceId = randomUUID()
  const ids = { first: randomUUID(), second: randomUUID(), single: randomUUID(), symbols: randomUUID(), other: randomUUID() }
  let counter = 0

  // A Bun SQL query is a lazy thenable, not a Promise. Promise.resolve().then(run) turns it into one for expect.
  const rejects = async (run: () => PromiseLike<unknown>) => {
    await expect(Promise.resolve().then(run)).rejects.toThrow()
  }

  beforeAll(async () => {
    scratch = await openScratchDatabase()
    db = scratch.db
    await scratch.migrate(22)
    await db`INSERT INTO users (id, email, password_hash) VALUES (${userId}, ${`agile-${userId}@test.dev`}, 'x')`
    await db`INSERT INTO workspaces (id, name, owner_id) VALUES (${workspaceId}, 'One', ${userId}), (${otherWorkspaceId}, 'Two', ${userId})`
    const project = (id: string, workspace: string, name: string, createdAt: string) =>
      db`INSERT INTO projects (id, workspace_id, name, created_by, created_at) VALUES (${id}, ${workspace}, ${name}, ${userId}, ${createdAt})`
    await project(ids.first, workspaceId, 'Pari Mobile App', '2026-01-01T00:00:00Z')
    await project(ids.second, workspaceId, 'Pari Mobile App', '2026-01-02T00:00:00Z')
    await project(ids.single, workspaceId, 'Dashboard', '2026-01-03T00:00:00Z')
    await project(ids.symbols, workspaceId, '123 !!', '2026-01-04T00:00:00Z')
    await project(ids.other, otherWorkspaceId, 'Pari Mobile App', '2026-01-05T00:00:00Z')
    await db`INSERT INTO tasks (id, project_id, title, created_by) VALUES (${randomUUID()}, ${ids.first}, 'Old task', ${userId})`
    await scratch.migrate(23)
  })

  afterAll(async () => {
    await scratch.drop()
  })

  const keyOf = async (id: string): Promise<string> => (await db`SELECT key FROM projects WHERE id = ${id}`)[0].key

  test('existing projects get a key from the initials of their name', async () => {
    expect(await keyOf(ids.first)).toBe('PMA')
  })

  test('a one-word name uses its first four letters, and a name with no letters becomes PRJ', async () => {
    expect(await keyOf(ids.single)).toBe('DASH')
    expect(await keyOf(ids.symbols)).toBe('PRJ')
  })

  test('a second project with the same key in one workspace gets a two-letter suffix, another workspace keeps the plain key', async () => {
    expect(await keyOf(ids.second)).toBe('PMAAA')
    expect(await keyOf(ids.other)).toBe('PMA')
  })

  test('projects start in scrum mode with no goal and issue number 1', async () => {
    const [row] = await db`SELECT mode, product_goal, next_issue_number FROM projects WHERE id = ${ids.first}`
    expect(row).toEqual({ mode: 'scrum', product_goal: '', next_issue_number: 1 })
  })

  test('a key is 2 to 10 capital letters and unique inside a workspace', async () => {
    const add = (key: string, workspace = workspaceId) =>
      db`INSERT INTO projects (id, workspace_id, name, created_by, key) VALUES (${randomUUID()}, ${workspace}, 'New', ${userId}, ${key})`
    await rejects(() => add('a'))
    await rejects(() => add('AB1'))
    await rejects(() => add('ABCDEFGHIJK'))
    await rejects(() => add('DASH'))
    await add('NEWK', otherWorkspaceId)
  })

  test('the old planning and task rows are untouched', async () => {
    const [row] = await db`SELECT count(*)::int AS count FROM tasks WHERE project_id = ${ids.first}`
    expect(row.count).toBe(1)
  })

  describe('issues', () => {
    const projectId = ids.first
    const insert = async (fields: Record<string, unknown> = {}) => {
      const row = { id: randomUUID(), number: ++counter, type: 'task', parent_id: null, status: 'todo', points: null, rank: null, role: null, ...fields }
      await db`INSERT INTO issues (id, project_id, number, type, parent_id, title, status, points, rank, role, created_by)
        VALUES (${row.id}, ${projectId}, ${row.number}, ${row.type}, ${row.parent_id}, 'Title', ${row.status}, ${row.points}, ${row.rank}, ${row.role}, ${userId})`
      return row.id as string
    }

    test('every type accepts its own statuses', async () => {
      await insert({ type: 'epic', status: null })
      await insert({ type: 'story', status: 'in_design' })
      await insert({ type: 'task', status: 'in_review' })
      await insert({ type: 'bug', status: 'done' })
    })

    test('an epic has no status, points, or rank', async () => {
      await rejects(() => insert({ type: 'epic', status: 'todo' }))
      await rejects(() => insert({ type: 'epic', status: null, points: 3 }))
      await rejects(() => insert({ type: 'epic', status: null, rank: 5 }))
    })

    test('a story and a task refuse each other statuses', async () => {
      await rejects(() => insert({ type: 'story', status: 'todo' }))
      await rejects(() => insert({ type: 'task', status: 'draft' }))
      await rejects(() => insert({ type: 'bug', status: 'in_qa' }))
    })

    test('points are Fibonacci values', async () => {
      await insert({ type: 'story', status: 'ready', points: 13 })
      await rejects(() => insert({ points: 4 }))
      await rejects(() => insert({ points: 0 }))
    })

    test('a sub-task needs a parent and a work role, and has no points or rank', async () => {
      const parent = await insert()
      await insert({ type: 'subtask', parent_id: parent, role: 'backend' })
      await rejects(() => insert({ type: 'subtask', parent_id: null, role: 'backend' }))
      await rejects(() => insert({ type: 'subtask', parent_id: parent, role: null }))
      await rejects(() => insert({ type: 'subtask', parent_id: parent, role: 'devops' }))
      await rejects(() => insert({ type: 'subtask', parent_id: parent, role: 'qa', points: 2 }))
      await rejects(() => insert({ type: 'subtask', parent_id: parent, role: 'qa', rank: 1 }))
    })

    test('only a sub-task has a role', async () => {
      await rejects(() => insert({ type: 'task', role: 'backend' }))
    })

    test('an issue number is unique inside its project', async () => {
      await insert({ number: 900 })
      await rejects(() => insert({ number: 900 }))
    })
  })

  describe('sprints', () => {
    const projectId = ids.second
    const add = (status: string, startsOn = '2026-02-02', endsOn = '2026-02-16') =>
      db`INSERT INTO sprints (id, project_id, name, status, starts_on, ends_on, created_by)
        VALUES (${randomUUID()}, ${projectId}, 'Sprint', ${status}, ${startsOn}, ${endsOn}, ${userId})`

    test('a project can have many planned and closed sprints but one active', async () => {
      await add('planned')
      await add('planned')
      await add('closed')
      await add('closed')
      await add('active')
      await rejects(() => add('active'))
    })

    test('a sprint lasts from one day to four weeks', async () => {
      await add('planned', '2026-03-01', '2026-03-29')
      await rejects(() => add('planned', '2026-03-01', '2026-03-30'))
      await rejects(() => add('planned', '2026-03-01', '2026-03-01'))
      await rejects(() => add('planned', '2026-03-05', '2026-03-01'))
    })
  })
})
