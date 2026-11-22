import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { databaseEnabled, openScratchDatabase, type ScratchDatabase } from '@/testing/database'

// Migration 0032 lets a task carry a role, lets a sub-task hang under a task without one, and adds the ticket fields.
describe.skipIf(!databaseEnabled)('ticket details schema (migration 0032)', () => {
  let scratch: ScratchDatabase
  let db: SQL

  // A Bun SQL query is a lazy thenable, not a Promise. Promise.resolve().then(run) turns it into one for expect.
  const rejects = async (run: () => PromiseLike<unknown>) => {
    await expect(Promise.resolve().then(run)).rejects.toThrow()
  }

  beforeAll(async () => {
    scratch = await openScratchDatabase()
    db = scratch.db
    await scratch.migrate(31)
    await db`INSERT INTO users (id, email, password_hash) VALUES ('u1', 'owner@test.dev', 'x')`
    await db`INSERT INTO workspaces (id, name, owner_id) VALUES ('w1', 'Expenses', 'u1')`
    await db`INSERT INTO projects (id, workspace_id, name, created_by, key) VALUES ('p1', 'w1', 'Expenses', 'u1', 'EXP')`
    await db`INSERT INTO issues (id, project_id, number, type, title, created_by, feature_prefix, feature_number) VALUES ('e1', 'p1', 1, 'epic', 'Sign in', 'u1', 'AUTH', 1)`
    await db`INSERT INTO issues (id, project_id, number, type, parent_id, title, status, created_by) VALUES ('s1', 'p1', 2, 'story', 'e1', 'Story', 'draft', 'u1')`
    // A sub-task of a story from before, with its role.
    await db`INSERT INTO issues (id, project_id, number, type, parent_id, title, status, role, created_by) VALUES ('old', 'p1', 3, 'subtask', 's1', 'Old', 'todo', 'backend', 'u1')`
    await scratch.migrate(32)
  })

  afterAll(async () => {
    await scratch.drop()
  })

  test('the sub-task of a story keeps its role', async () => {
    expect((await db`SELECT role FROM issues WHERE id = 'old'`)[0].role).toBe('backend')
  })

  test('a task carries a role, and a sub-task under it needs none', async () => {
    await db`INSERT INTO issues (id, project_id, number, type, parent_id, title, status, role, created_by) VALUES ('t1', 'p1', 4, 'task', 'e1', 'Endpoint', 'todo', 'backend', 'u1')`
    await db`INSERT INTO issues (id, project_id, number, type, parent_id, title, status, created_by) VALUES ('st1', 'p1', 5, 'subtask', 't1', 'Step', 'todo', 'u1')`
    expect((await db`SELECT role FROM issues WHERE id = 'st1'`)[0].role).toBeNull()
  })

  test('a story, a bug or an epic still carries no role, and a sub-task still needs a parent', async () => {
    await rejects(() => db`INSERT INTO issues (id, project_id, number, type, title, status, role, created_by) VALUES ('b1', 'p1', 6, 'bug', 'Bug', 'todo', 'backend', 'u1')`)
    await rejects(() => db`INSERT INTO issues (id, project_id, number, type, title, status, created_by) VALUES ('st2', 'p1', 6, 'subtask', 'Loose', 'todo', 'u1')`)
  })

  test('a ticket code is used once per epic and role, and the size is S, M or L', async () => {
    await db`INSERT INTO issue_ticket_details (issue_id, epic_id, role_code, ticket_seq, size) VALUES ('t1', 'e1', 'BE', 1, 'M')`
    await db`INSERT INTO issues (id, project_id, number, type, parent_id, title, status, role, created_by) VALUES ('t2', 'p1', 7, 'task', 'e1', 'Second', 'todo', 'backend', 'u1')`
    await rejects(() => db`INSERT INTO issue_ticket_details (issue_id, epic_id, role_code, ticket_seq) VALUES ('t2', 'e1', 'BE', 1)`)
    await rejects(() => db`INSERT INTO issue_ticket_details (issue_id, epic_id, size) VALUES ('t2', 'e1', 'XL')`)
    await rejects(() => db`INSERT INTO issue_ticket_details (issue_id, epic_id, role_code) VALUES ('t2', 'e1', 'BE')`)
  })
})
