import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { databaseEnabled, openScratchDatabase, type ScratchDatabase } from '@/testing/database'

// Migration 0031 stores acceptance criteria as Given, When and Then, numbered per epic.
describe.skipIf(!databaseEnabled)('acceptance criteria schema (migration 0031)', () => {
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
    await db`INSERT INTO issues (id, project_id, number, type, parent_id, title, status, created_by) VALUES ('t1', 'p1', 2, 'task', 'e1', 'Endpoint', 'todo', 'u1')`
  })

  afterAll(async () => {
    await scratch.drop()
  })

  const insert = (id: string, number: number, extra: { given?: string; then?: string[] } = {}) =>
    db`INSERT INTO acceptance_criteria (id, epic_id, number, title, given_text, when_text, then_items, created_by)
      VALUES (${id}, 'e1', ${number}, 'Title', ${extra.given ?? 'Given'}, 'When', ARRAY(SELECT jsonb_array_elements_text((${JSON.stringify(extra.then ?? ['Then'])}::text)::jsonb)), 'u1')`

  test('a criterion needs Given, When and one to ten Then outcomes', async () => {
    await insert('a1', 1)
    await rejects(() => insert('a2', 2, { given: '' }))
    await rejects(() => insert('a2', 2, { then: [] }))
    await rejects(() => insert('a2', 2, { then: Array.from({ length: 11 }, () => 'x') }))
  })

  test('a number is used once per epic', async () => {
    await rejects(() => insert('a2', 1))
  })

  test('a struck criterion keeps its reason and time, an active one has neither', async () => {
    await rejects(() => db`UPDATE acceptance_criteria SET status = 'struck' WHERE id = 'a1'`)
    await db`UPDATE acceptance_criteria SET status = 'struck', struck_reason = 'Moved to AUTH-004', struck_at = now() WHERE id = 'a1'`
    expect((await db`SELECT status FROM acceptance_criteria WHERE id = 'a1'`)[0].status).toBe('struck')
  })

  test('tasks and test cases point at criteria, and go when the criterion goes', async () => {
    await insert('a3', 3)
    await db`INSERT INTO issue_acceptance_criteria (issue_id, ac_id, created_by) VALUES ('t1', 'a3', 'u1')`
    await db`INSERT INTO story_test_cases (id, story_id, number, title, created_by, ac_id) VALUES ('tc1', 'e1', 1, 'Check', 'u1', 'a3')`
    await db`DELETE FROM acceptance_criteria WHERE id = 'a3'`
    expect((await db`SELECT count(*)::int AS n FROM issue_acceptance_criteria`)[0].n).toBe(0)
    expect((await db`SELECT ac_id FROM story_test_cases WHERE id = 'tc1'`)[0].ac_id).toBeNull()
  })
})
