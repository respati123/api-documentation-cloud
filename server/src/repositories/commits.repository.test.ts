import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { findCommitById, findCommitInWorkspace, insertCommit, listCommitsPage } from '@/repositories/commits.repository'
import { databaseEnabled, openTestDatabase, seedUser, seedWorkspace } from '@/testing/database'

const snapshot = { tree: [], variables: { globals: [], environments: [] } }

describe.skipIf(!databaseEnabled)('commits repository', () => {
  let db: SQL

  beforeAll(async () => {
    db = await openTestDatabase()
  })

  afterAll(async () => {
    await db.close()
  })

  test('insertCommit stores parent ids and the snapshot, and findCommitInWorkspace reads them back', async () => {
    const author = await seedUser(db)
    const { workspaceId, commitId } = await seedWorkspace(db, author.id)
    const id = randomUUID()

    await insertCommit(db, { id, workspaceId, authorId: author.id, parentIds: [commitId], message: 'Second', snapshot })

    const found = await findCommitInWorkspace(db, workspaceId, id)
    expect(found?.parentIds).toEqual([commitId])
    expect(found?.message).toBe('Second')
    expect(found?.snapshot).toEqual(snapshot)
  })

  test('insertCommit ignores a commit id that already exists', async () => {
    const author = await seedUser(db)
    const { workspaceId } = await seedWorkspace(db, author.id)
    const id = randomUUID()
    await insertCommit(db, { id, workspaceId, authorId: author.id, parentIds: [], message: 'First', snapshot })

    await insertCommit(db, { id, workspaceId, authorId: author.id, parentIds: [], message: 'Changed', snapshot })

    expect((await findCommitInWorkspace(db, workspaceId, id))?.message).toBe('First')
  })

  test('findCommitInWorkspace does not return a commit from another workspace', async () => {
    const author = await seedUser(db)
    const first = await seedWorkspace(db, author.id)
    const second = await seedWorkspace(db, author.id)

    expect(await findCommitInWorkspace(db, second.workspaceId, first.commitId)).toBeUndefined()
    expect(await findCommitById(db, first.commitId)).toBeDefined()
  })

  test('listCommitsPage returns the newest commit first and resumes after a cursor', async () => {
    const author = await seedUser(db)
    const { workspaceId, commitId } = await seedWorkspace(db, author.id)
    const newerId = randomUUID()
    await insertCommit(db, { id: newerId, workspaceId, authorId: author.id, parentIds: [commitId], message: 'Newer', snapshot })

    const first = await listCommitsPage(db, { workspaceId, after: null, limit: 1 })
    expect(first.map((row) => row.id)).toEqual([newerId])
    expect(first[0].authorEmail).toBe(author.email)

    const last = first[0]
    const rest = await listCommitsPage(db, { workspaceId, after: { sortAt: last.sortAt, id: last.id }, limit: 10 })
    expect(rest.map((row) => row.id)).toEqual([commitId])
  })
})
