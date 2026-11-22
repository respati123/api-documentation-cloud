import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { databaseEnabled, openScratchDatabase, type ScratchDatabase } from '@/testing/database'

// Migration 0030 gives every epic a feature code and lets an epic hold a spec, a design and a contract.
describe.skipIf(!databaseEnabled)('epic feature code and documents (migration 0030)', () => {
  let scratch: ScratchDatabase
  let db: SQL

  // A Bun SQL query is a lazy thenable, not a Promise. Promise.resolve().then(run) turns it into one for expect.
  const rejects = async (run: () => PromiseLike<unknown>) => {
    await expect(Promise.resolve().then(run)).rejects.toThrow()
  }

  beforeAll(async () => {
    scratch = await openScratchDatabase()
    db = scratch.db
    await scratch.migrate(29)
    await db`INSERT INTO users (id, email, password_hash) VALUES ('u1', 'owner@test.dev', 'x')`
    await db`INSERT INTO workspaces (id, name, owner_id) VALUES ('w1', 'Expenses', 'u1')`
    await db`INSERT INTO projects (id, workspace_id, name, created_by, key) VALUES ('p1', 'w1', 'Expenses', 'u1', 'EXPENSESAP')`
    await db`INSERT INTO issues (id, project_id, number, type, title, created_by, created_at) VALUES
      ('e2', 'p1', 2, 'epic', 'Budgets', 'u1', '2026-02-01T00:00:00Z'),
      ('e1', 'p1', 1, 'epic', 'Sign in', 'u1', '2026-01-01T00:00:00Z')`
    await db`INSERT INTO issues (id, project_id, number, type, parent_id, title, status, created_by) VALUES ('t1', 'p1', 3, 'task', 'e1', 'Task', 'todo', 'u1')`
    await scratch.migrate(30)
  })

  afterAll(async () => {
    await scratch.drop()
  })

  const codeOf = async (id: string) => (await db`SELECT feature_prefix AS prefix, feature_number AS number FROM issues WHERE id = ${id}`)[0]

  test('existing epics take the project key cut to eight letters, numbered in the order they were made', async () => {
    expect(await codeOf('e1')).toEqual({ prefix: 'EXPENSES', number: 1 })
    expect(await codeOf('e2')).toEqual({ prefix: 'EXPENSES', number: 2 })
  })

  test('only an epic has a feature code', async () => {
    expect(await codeOf('t1')).toEqual({ prefix: null, number: null })
    await rejects(() => db`UPDATE issues SET feature_prefix = 'AUTH', feature_number = 1 WHERE id = 't1'`)
  })

  test('an epic without a code, a lowercase prefix, or a duplicate code is refused', async () => {
    await rejects(() => db`INSERT INTO issues (id, project_id, number, type, title, created_by) VALUES ('e3', 'p1', 4, 'epic', 'No code', 'u1')`)
    await rejects(() => db`INSERT INTO issues (id, project_id, number, type, title, created_by, feature_prefix, feature_number) VALUES ('e3', 'p1', 4, 'epic', 'Bad', 'u1', 'auth', 1)`)
    await rejects(() => db`INSERT INTO issues (id, project_id, number, type, title, created_by, feature_prefix, feature_number) VALUES ('e3', 'p1', 4, 'epic', 'Twice', 'u1', 'EXPENSES', 1)`)
  })

  test('spec, design and contract belong to an epic, BRD and PRD do not', async () => {
    await db`INSERT INTO planning_documents (id, workspace_id, project_id, kind, title, created_by, epic_id) VALUES ('s1', 'w1', 'p1', 'spec', 'Spec', 'u1', 'e1')`
    await rejects(() => db`INSERT INTO planning_documents (id, workspace_id, project_id, kind, title, created_by) VALUES ('s2', 'w1', 'p1', 'design', 'No epic', 'u1')`)
    await rejects(() => db`INSERT INTO planning_documents (id, workspace_id, project_id, kind, title, created_by, epic_id) VALUES ('s3', 'w1', 'p1', 'prd', 'PRD on epic', 'u1', 'e1')`)
  })

  test('an epic holds one live document of each kind, and a discarded one makes room', async () => {
    await rejects(() => db`INSERT INTO planning_documents (id, workspace_id, project_id, kind, title, created_by, epic_id) VALUES ('s4', 'w1', 'p1', 'spec', 'Second spec', 'u1', 'e1')`)
    await db`UPDATE planning_documents SET status = 'discarded' WHERE id = 's1'`
    await db`INSERT INTO planning_documents (id, workspace_id, project_id, kind, title, created_by, epic_id) VALUES ('s4', 'w1', 'p1', 'spec', 'Second spec', 'u1', 'e1')`
    expect((await db`SELECT count(*)::int AS n FROM planning_documents WHERE epic_id = 'e1'`)[0].n).toBe(2)
  })
})
